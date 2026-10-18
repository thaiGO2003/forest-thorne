import * as THREE from "three";
import { benchPerimeter, totalRows, VISUAL_COLS, type Profile } from "../board/geometry";
import { benchCap, canBenchToBench, canBenchToBoard, canBoardToBench, canBoardToBoard, type RunState } from "../core/run";
import type { BoardView } from "../units/boardView";
import { BLOCK, cellToWorld } from "../world/arena";
import type { UnitVisual } from "../units/rig";
import { createBoardPickingController, setRayFromClientPoint } from "../world/boardPicking";
import type { Stage } from "../world/stage";

export type PlanningSlot = { kind: "bench" | "board"; index: number };

export interface PlanningDragTargetState {
  source: PlanningSlot;
  target: PlanningSlot | null;
  valid: boolean;
}

export interface PlanningDragController {
  cancel(): void;
  targetState(): PlanningDragTargetState | null;
  dispose(): void;
}

interface PlanningDragOptions {
  stage: Stage;
  board: BoardView;
  getRun(): RunState | null;
  move(from: PlanningSlot, to: PlanningSlot): boolean;
  select?(source: PlanningSlot): void;
  preview?(source: PlanningSlot, anchor: DOMRect): void;
  previewEnd?(): void;
  onTargetState?(state: PlanningDragTargetState | null): void;
  enabled(): boolean;
  /** During combat only inspect allied units; no movement is allowed. */
  inspectOnly?(): boolean;
  profile?: Profile;
}

const DRAG_THRESHOLD_SQ = 36;
const BENCH_HALF = 0.48;
const PLAYER_COLS = 5;
const LONG_PRESS_MS = 420;
const MOVE_FEEDBACK_MS = 360;

export function createPlanningDragController({
  stage,
  board,
  getRun,
  move,
  select,
  preview,
  previewEnd,
  onTargetState,
  enabled,
  inspectOnly = () => false,
  profile = "solo",
}: PlanningDragOptions): PlanningDragController {
  const canvas = stage.renderer.domElement;
  const boardPicker = createBoardPickingController(canvas, stage.camera, stage.arena.tiles, profile);
  const sourceRaycaster = new THREE.Raycaster();
  const targetRaycaster = new THREE.Raycaster();
  const sourceNdc = new THREE.Vector2();
  const targetNdc = new THREE.Vector2();
  const roots: THREE.Object3D[] = [];
  const hits: THREE.Intersection[] = [];
  const kindByUid = new Map<string, "board" | "bench" | "enemy">();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
  const groundHit = new THREE.Vector3();
  const benchWorld = benchPerimeter(profile).map((cell) => cellToWorld(cell, profile));

  // Ground-plane overlays work above grass, river and perimeter benches alike.
  const hoverGeometry = new THREE.PlaneGeometry(BLOCK * 0.94, BLOCK * 0.94);
  const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xc5f4ff, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide });
  const hover = new THREE.Mesh(hoverGeometry, hoverMaterial);
  hover.rotation.x = -Math.PI / 2;
  hover.visible = false;
  hover.raycast = () => {};
  stage.scene.add(hover);
  const previousTouchAction = canvas.style?.touchAction;
  if (canvas.style) canvas.style.touchAction = "none";
  let pressed: {
    pointerId: number; startX: number; startY: number; source: PlanningSlot;
    visual?: UnitVisual; home?: THREE.Vector3; target?: THREE.Vector3;
  } | null = null;
  let dragging = false;
  let captured = false;
  let previewed: PlanningSlot | null = null;
  let tooltipTimer = 0;
  let feedbackTimer = 0;
  const clearPreview = () => {
    clearTimeout(tooltipTimer);
    tooltipTimer = 0;
    if (previewed) previewEnd?.();
    previewed = null;
  };
  const showPreview = (source: PlanningSlot | null, clientX: number, clientY: number) => {
    if (!source) {
      clearPreview();
      return;
    }
    if (previewed && (previewed.kind !== source.kind || previewed.index !== source.index)) previewEnd?.();
    previewed = source;
    preview?.(source, new DOMRect(clientX - 1, clientY - 1, 2, 2));
  };
  const sourceCell = (source: PlanningSlot) => source.kind === "board"
    ? { col: source.index % PLAYER_COLS, row: Math.floor(source.index / PLAYER_COLS) }
    : null;
  const paintPointerCell = (clientX: number, clientY: number, run: RunState, source: PlanningSlot | null = null) => {
    const highlights: Array<{ col: number; row: number; role: "hover" | "source" }> = [];
    const benchHighlights: Array<{ index: number; role: "hover" | "source" }> = [];
    const from = source ? sourceCell(source) : null;
    if (from) highlights.push({ ...from, role: "source" });
    else if (source?.kind === "bench") benchHighlights.push({ index: source.index, role: "source" });
    const hit = boardPicker.pick(clientX, clientY);
    if (hit.kind === "cell") {
      highlights.push({ ...hit.cell, role: "hover" });
    } else {
      const benchHit = pickBench(clientX, clientY, run);
      if (benchHit) benchHighlights.push({ index: benchHit.index, role: "hover" });
    }
    stage.arena.setHighlights(highlights);
    stage.arena.setBenchHighlights(benchHighlights);
  };
  const showMoveFeedback = (target: PlanningSlot, valid: boolean) => {
    clearTimeout(feedbackTimer);
    feedbackTimer = 0;
    const role = valid ? "valid" : "invalid";
    if (target.kind === "bench") {
      stage.arena.clearHighlights();
      stage.arena.setBenchHighlights([{ index: target.index, role }]);
    } else {
      stage.arena.clearBenchHighlights();
      stage.arena.setHighlights([{
        col: target.index % PLAYER_COLS,
        row: Math.floor(target.index / PLAYER_COLS),
        role,
      }]);
    }
    feedbackTimer = window.setTimeout(() => {
      feedbackTimer = 0;
      stage.arena.clearHighlights();
      stage.arena.clearBenchHighlights();
    }, MOVE_FEEDBACK_MS);
  };
  let currentTargetState: PlanningDragTargetState | null = null;
  const offDragFrame = stage.onFrame?.((dt) => {
    if (!dragging || !pressed?.visual || !pressed.target) return;
    pressed.visual.root.position.lerp(pressed.target, Math.min(1, dt * 20));
  });

  const sameSlot = (a: PlanningSlot | null, b: PlanningSlot | null): boolean =>
    a === b || Boolean(a && b && a.kind === b.kind && a.index === b.index);

  const setTargetState = (next: PlanningDragTargetState | null) => {
    if (currentTargetState === null && next === null) return;
    if (currentTargetState && next
      && sameSlot(currentTargetState.source, next.source)
      && sameSlot(currentTargetState.target, next.target)
      && currentTargetState.valid === next.valid) return;
    currentTargetState = next;
    onTargetState?.(next);
  };

  const canMove = (run: RunState, from: PlanningSlot, to: PlanningSlot): boolean => {
    if (from.kind === "bench" && to.kind === "board") return canBenchToBoard(run, from.index, to.index);
    if (from.kind === "board" && to.kind === "bench") return canBoardToBench(run, from.index, to.index);
    if (from.kind === "board" && to.kind === "board") return canBoardToBoard(run, from.index, to.index);
    return canBenchToBench(run, from.index, to.index);
  };

  const sourceForUid = (run: RunState, uid: string): PlanningSlot | null => {
    for (let i = 0; i < run.board.length; i++) {
      if (run.board[i]?.uid === uid) return { kind: "board", index: i };
    }
    for (let i = 0; i < run.bench.length; i++) {
      if (run.bench[i]?.uid === uid) return { kind: "bench", index: i };
    }
    return null;
  };

  const uidFromHit = (object: THREE.Object3D): string | null => {
    let current: THREE.Object3D | null = object;
    let result: string | null = null;
    while (current && current !== stage.scene) {
      // Three.js raycasting includes invisible objects (e.g. hidden bench billboards/speech bubbles).
      if (!current.visible) return null;
      const uid = current.userData.uid;
      if (typeof uid === "string") result = uid;
      current = current.parent;
    }
    return result;
  };

  const pickUnit = (clientX: number, clientY: number): { uid: string; kind: "board" | "bench" | "enemy" } | null => {
    if (!setRayFromClientPoint(canvas, clientX, clientY, stage.camera, sourceRaycaster, sourceNdc)) return null;
    // Picking must observe the latest formation, even before the next renderer frame.
    stage.scene.updateMatrixWorld(true);
    roots.length = 0;
    hits.length = 0;
    kindByUid.clear();
    board.forEach((uid, visual, kind) => {
      roots.push(visual.root);
      kindByUid.set(uid, kind);
    });
    sourceRaycaster.intersectObjects(roots, true, hits);
    for (const hit of hits) {
      const uid = uidFromHit(hit.object);
      if (!uid) continue;
      const kind = kindByUid.get(uid);
      if (kind) return { uid, kind };
    }
    return null;
  };

  const pickSource = (clientX: number, clientY: number, run: RunState): PlanningSlot | null => {
    const picked = pickUnit(clientX, clientY);
    if (!picked || picked.kind === "enemy") return null;
    return sourceForUid(run, picked.uid);
  };

  const pickBench = (clientX: number, clientY: number, run: RunState): PlanningSlot | null => {
    if (!setRayFromClientPoint(canvas, clientX, clientY, stage.camera, targetRaycaster, targetNdc)) return null;
    if (!targetRaycaster.ray.intersectPlane(groundPlane, groundHit)) return null;
    const capacity = Math.min(benchCap(run), benchWorld.length);
    for (let i = 0; i < capacity; i++) {
      const world = benchWorld[i]!;
      if (Math.abs(groundHit.x - world.x) <= BENCH_HALF && Math.abs(groundHit.z - world.z) <= BENCH_HALF) {
        return { kind: "bench", index: i };
      }
    }
    return null;
  };

  const pickTarget = (clientX: number, clientY: number, run: RunState): PlanningSlot | null => {
    const boardHit = boardPicker.pick(clientX, clientY);
    if (boardHit.kind === "cell") {
      const { col, row } = boardHit.cell;
      if (col < 0 || col >= PLAYER_COLS || row < 0) return null;
      const index = row * PLAYER_COLS + col;
      return index < run.board.length ? { kind: "board", index } : null;
    }
    return pickBench(clientX, clientY, run);
  };
  const updateHover = (clientX: number, clientY: number) => {
    hover.visible = false;
    if (!enabled() || !setRayFromClientPoint(canvas, clientX, clientY, stage.camera, targetRaycaster, targetNdc)
      || !targetRaycaster.ray.intersectPlane(groundPlane, groundHit)) return;
    const visualCol = Math.round(groundHit.x / BLOCK + (VISUAL_COLS - 1) / 2);
    const visualRow = Math.round(groundHit.z / BLOCK + (totalRows(profile) - 1) / 2);
    const onField = visualCol >= 0 && visualCol < VISUAL_COLS
      && visualRow >= 0 && visualRow < totalRows(profile);
    if (onField) {
      const world = cellToWorld({ x: visualCol, z: visualRow }, profile);
      hover.position.set(world.x, 0.15, world.z);
    } else {
      const benchCell = benchWorld.find((cell) => Math.abs(cell.x - groundHit.x) <= BENCH_HALF && Math.abs(cell.z - groundHit.z) <= BENCH_HALF);
      if (!benchCell) return;
      hover.position.set(benchCell.x, 0.17, benchCell.z);
    }
    hoverMaterial.color.setHex(dragging ? (currentTargetState?.valid ? 0x75ffc0 : 0xff8279) : 0xc5f4ff);
    hover.visible = true;
  };

  const clearState = (releaseCapture: boolean) => {
    const pointerId = pressed?.pointerId;
    if (pressed?.visual && pressed.home) pressed.visual.root.position.copy(pressed.home);
    pressed = null;
    dragging = false;
    hover.visible = false;
    setTargetState(null);
    boardPicker.clear();
    stage.arena.clearHighlights();
    stage.arena.clearBenchHighlights();
    board.setHovered(null);
    clearPreview();
    clearTimeout(feedbackTimer);
    feedbackTimer = 0;
    if (releaseCapture && captured && pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
    captured = false;
  };

  const cancel = () => clearState(true);

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || !enabled()) return;
    const run = getRun();
    if (!run || (run.phase !== "PLANNING" && !inspectOnly())) return;
    const source = pickSource(event.clientX, event.clientY, run);
    if (!source) return;
    const entry = source.kind === "board" ? run.board[source.index] : run.bench[source.index];
    const visual = entry ? board.visual(entry.uid) : undefined;
    pressed = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, source, visual,
      home: visual?.root.position.clone(), target: visual?.root.position.clone() };
    dragging = false;
    if (event.pointerType !== "mouse") {
      clearTimeout(tooltipTimer);
      tooltipTimer = window.setTimeout(() => {
        tooltipTimer = 0;
        if (pressed?.pointerId === event.pointerId && !dragging) showPreview(source, event.clientX, event.clientY);
      }, LONG_PRESS_MS);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.pointerId) {
      if (event.pointerType !== "mouse" || !enabled()) {
        stage.arena.clearHighlights();
        stage.arena.clearBenchHighlights();
        clearPreview();
        board.setHovered(null);
        hover.visible = false;
      } else {
        const run = getRun();
        if (!run || run.phase !== "PLANNING") {
          stage.arena.clearHighlights();
          stage.arena.clearBenchHighlights();
          clearPreview();
          board.setHovered(null);
          hover.visible = false;
        } else {
          paintPointerCell(event.clientX, event.clientY, run);
          const picked = pickUnit(event.clientX, event.clientY);
          board.setHovered(picked?.uid ?? null);
          showPreview(picked && picked.kind !== "enemy" ? sourceForUid(run, picked.uid) : null, event.clientX, event.clientY);
          updateHover(event.clientX, event.clientY);
        }
      }
      return;
    }
    if (!enabled()) { cancel(); return; }
    if (getRun()?.phase !== "PLANNING" && !inspectOnly()) { cancel(); return; }
    if (!dragging) {
      const dx = event.clientX - pressed.startX;
      const dy = event.clientY - pressed.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
      if (inspectOnly()) { cancel(); return; }
      dragging = true;
      clearPreview();
      board.setHovered(null);
      canvas.setPointerCapture(event.pointerId);
      captured = true;
    }
    const run = getRun();
    if (run) paintPointerCell(event.clientX, event.clientY, run, pressed.source);
    const target = run ? pickTarget(event.clientX, event.clientY, run) : null;
    setTargetState(run ? { source: pressed.source, target, valid: Boolean(target && canMove(run, pressed.source, target)) } : null);
    if (pressed.target && setRayFromClientPoint(canvas, event.clientX, event.clientY, stage.camera, targetRaycaster, targetNdc)
      && targetRaycaster.ray.intersectPlane(groundPlane, groundHit)) {
      pressed.target.set(groundHit.x, pressed.home?.y ?? 0.12, groundHit.z);
    }
    updateHover(event.clientX, event.clientY);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    const source = pressed.source;
    const wasDragging = dragging;
    const active = enabled();
    const run = wasDragging && active && getRun()?.phase === "PLANNING" ? getRun() : null;
    const target = run ? pickTarget(event.clientX, event.clientY, run) : null;
    const valid = Boolean(run && target && canMove(run, source, target));
    clearState(true);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) {
      const moved = valid && move(source, target);
      showMoveFeedback(target, moved);
      return;
    }
    if (!wasDragging && active) select?.(source);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pressed?.pointerId === event.pointerId) cancel();
  };

  const onPointerLeave = (event: PointerEvent) => {
    hover.visible = false;
    if (pressed?.pointerId === event.pointerId && dragging) return;
    if (pressed?.pointerId === event.pointerId) {
      cancel();
      return;
    }
    stage.arena.clearHighlights();
    stage.arena.clearBenchHighlights();
    clearPreview();
    board.setHovered(null);
  };

  const onLostPointerCapture = (event: PointerEvent) => {
    if (pressed?.pointerId !== event.pointerId) return;
    captured = false;
    clearState(false);
  };

  const onBlur = () => { cancel(); hover.visible = false; };

  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove, true);
  canvas.addEventListener("pointerup", onPointerUp, true);
  canvas.addEventListener("pointercancel", onPointerCancel, true);
  canvas.addEventListener("pointerleave", onPointerLeave, true);
  canvas.addEventListener("lostpointercapture", onLostPointerCapture, true);
  window.addEventListener("blur", onBlur);

  return {
    targetState: () => currentTargetState,
    cancel,
    dispose() {
      cancel();
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointermove", onPointerMove, true);
      canvas.removeEventListener("pointerup", onPointerUp, true);
      canvas.removeEventListener("pointercancel", onPointerCancel, true);
      canvas.removeEventListener("pointerleave", onPointerLeave, true);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture, true);
      boardPicker.dispose();
      offDragFrame?.();
      hover.removeFromParent();
      hoverGeometry.dispose();
      hoverMaterial.dispose();
      if (canvas.style) canvas.style.touchAction = previousTouchAction ?? "";
      roots.length = 0;
      hits.length = 0;
      kindByUid.clear();
    },
  };
}
