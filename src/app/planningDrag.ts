import * as THREE from "three";
import { benchPerimeter, type Profile } from "../board/geometry";
import { benchCap, canBenchToBench, canBenchToBoard, canBoardToBench, canBoardToBoard, type RunState } from "../core/run";
import type { BoardView } from "../units/boardView";
import { cellToWorld, type BenchHighlightSlot, type TacticalHighlightCell } from "../world/arena";
import type { UnitVisual } from "../units/rig";
import { createBoardPickingController, setRayFromClientPoint, type BoardPickState } from "../world/boardPicking";
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
  /** Enemy units are not draggable; they only get a hover summary tooltip. */
  previewEnemy?(uid: string, anchor: DOMRect): void;
  /** Enemy units cannot be selected or dragged; a tap opens their read-only detail. */
  inspectEnemy?(uid: string): void;
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
type PickedUnit = { uid: string; kind: "board" | "bench" | "enemy" };

export function createPlanningDragController({
  stage,
  board,
  getRun,
  move,
  select,
  preview,
  previewEnemy,
  inspectEnemy,
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

  // Board/bench feedback is rendered by arena only. A second ground-plane mesh
  // could tint a different cell (including the river) and obscure role colors.
  const previousTouchAction = canvas.style?.touchAction;
  if (canvas.style) canvas.style.touchAction = "none";
  let pressed: {
    pointerId: number; startX: number; startY: number; source: PlanningSlot;
    visual?: UnitVisual; home?: THREE.Vector3; target?: THREE.Vector3;
  } | null = null;
  /** A tap on an enemy token: inspectable, but never a drag source. */
  let pressedEnemy: { pointerId: number; startX: number; startY: number; uid: string } | null = null;
  let dragging = false;
  let captured = false;
  let previewed: PlanningSlot | null = null;
  let previewedEnemy: string | null = null;
  let tooltipTimer = 0;
  let feedbackTimer = 0;
  const clearPreview = () => {
    clearTimeout(tooltipTimer);
    tooltipTimer = 0;
    if (previewed || previewedEnemy) previewEnd?.();
    previewed = null;
    previewedEnemy = null;
  };
  const showPreview = (source: PlanningSlot | null, clientX: number, clientY: number) => {
    if (!source) {
      clearPreview();
      return;
    }
    if (previewedEnemy || (previewed && (previewed.kind !== source.kind || previewed.index !== source.index))) previewEnd?.();
    previewedEnemy = null;
    previewed = source;
    preview?.(source, new DOMRect(clientX - 1, clientY - 1, 2, 2));
  };
  const showEnemyPreview = (uid: string, clientX: number, clientY: number) => {
    if (previewed || previewedEnemy !== uid) previewEnd?.();
    previewed = null;
    previewedEnemy = uid;
    previewEnemy?.(uid, new DOMRect(clientX - 1, clientY - 1, 2, 2));
  };
  const sourceCell = (source: PlanningSlot) => source.kind === "board"
    ? { col: source.index % PLAYER_COLS, row: Math.floor(source.index / PLAYER_COLS) }
    : null;
  const boardSlot = (col: number, row: number, run: RunState): PlanningSlot | null => {
    if (col < 0 || col >= PLAYER_COLS || row < 0) return null;
    const index = row * PLAYER_COLS + col;
    return index < run.board.length ? { kind: "board", index } : null;
  };
  const paintPointerCell = (
    clientX: number, clientY: number, run: RunState,
    source: PlanningSlot | null = null,
    hovered: PickedUnit | null = null,
    boardHit: BoardPickState = boardPicker.pick(clientX, clientY),
  ): PlanningDragTargetState | null => {
    const highlights: TacticalHighlightCell[] = [];
    const benchHighlights: BenchHighlightSlot[] = [];
    const from = source ? sourceCell(source) : null;
    if (from) highlights.push({ ...from, role: "source" });
    else if (source?.kind === "bench") benchHighlights.push({ index: source.index, role: "source" });
    const target = boardHit.kind === "cell"
      ? boardSlot(boardHit.cell.col, boardHit.cell.row, run)
      : pickBench(clientX, clientY, run);
    const valid = Boolean(source && target && canMove(run, source, target));
    // Hovering any token, ally or enemy, uses the same neutral tactical tint;
    // hostile red is reserved for invalid drops so ownership never changes the signal.
    const role = source ? (valid ? "valid" : "invalid") : "hover";
    // A direct model hit can project over a neighboring tile. Highlight its
    // canonical occupied cell, not the ray's underlying screen-space tile.
    const slot = !source && hovered && hovered.kind !== "bench" ? board.slot(hovered.uid) : undefined;
    const cell = slot && slot.kind !== "bench"
      ? { col: slot.col, row: slot.row }
      : boardHit.kind === "cell" ? boardHit.cell : null;
    if (cell) {
      if (from && from.col === cell.col && from.row === cell.row) {
        highlights[0] = { ...cell, role: "invalid" };
      } else {
        highlights.push({ ...cell, role });
      }
    } else if (target?.kind === "bench"
      && (source?.kind !== "bench" || source.index !== target.index)) {
      benchHighlights.push({ index: target.index, role });
    }
    stage.arena.setHighlights(highlights);
    stage.arena.setBenchHighlights(benchHighlights);
    return source ? { source, target, valid } : null;
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
  const pickOccupiedTile = (hit: BoardPickState, run: RunState): PickedUnit | null => {
    if (hit.kind !== "cell") return null;
    const { col, row } = hit.cell;
    if (col < PLAYER_COLS) {
      const slot = boardSlot(col, row, run);
      const unit = slot && run.board[slot.index];
      return unit ? { uid: unit.uid, kind: "board" } : null;
    }
    // The BoardView contains the *rendered* enemy formation, which can differ
    // from run.enemyPreview while the planning combat projection is active.
    let occupied: PickedUnit | null = null;
    board.forEach((uid, _visual, kind) => {
      if (occupied || kind !== "enemy") return;
      const slot = board.slot(uid);
      if (slot?.kind === "enemy" && slot.col === col && slot.row === row) {
        occupied = { uid, kind: "enemy" };
      }
    });
    return occupied;
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
    return boardHit.kind === "cell"
      ? boardSlot(boardHit.cell.col, boardHit.cell.row, run)
      : pickBench(clientX, clientY, run);
  };

  const clearState = (releaseCapture: boolean, restoreVisual = true) => {
    const pointerId = pressed?.pointerId;
    if (restoreVisual && pressed?.visual && pressed.home) pressed.visual.root.position.copy(pressed.home);
    pressed = null;
    pressedEnemy = null;
    dragging = false;
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
    const picked = pickUnit(event.clientX, event.clientY);
    const source = picked && picked.kind !== "enemy" ? sourceForUid(run, picked.uid) : null;
    if (!source) {
      // Enemy tokens are never drag sources, but a tap still inspects them like allies.
      if (picked?.kind !== "enemy") return;
      pressedEnemy = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, uid: picked.uid };
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
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
    if (pressedEnemy) {
      if (event.pointerId !== pressedEnemy.pointerId) return;
      const dx = event.clientX - pressedEnemy.startX;
      const dy = event.clientY - pressedEnemy.startY;
      // Moving past the tap threshold means a camera pan or scroll, not an inspect.
      if (dx * dx + dy * dy <= DRAG_THRESHOLD_SQ) return;
      pressedEnemy = null;
    }
    if (!pressed || event.pointerId !== pressed.pointerId) {
      const run = enabled() ? getRun() : null;
      if (!run || run.phase !== "PLANNING") {
        stage.arena.clearHighlights();
        stage.arena.clearBenchHighlights();
        clearPreview();
        board.setHovered(null);
      } else {
        const tileHit = boardPicker.pick(event.clientX, event.clientY);
        const picked = pickUnit(event.clientX, event.clientY) ?? pickOccupiedTile(tileHit, run);
        paintPointerCell(event.clientX, event.clientY, run, null, picked, tileHit);
        board.setHovered(picked?.uid ?? null);
        if (picked?.kind === "enemy") {
          showEnemyPreview(picked.uid, event.clientX, event.clientY);
        } else {
          showPreview(picked ? sourceForUid(run, picked.uid) : null, event.clientX, event.clientY);
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
    setTargetState(run ? paintPointerCell(event.clientX, event.clientY, run, pressed.source) : null);
    if (pressed.target && setRayFromClientPoint(canvas, event.clientX, event.clientY, stage.camera, targetRaycaster, targetNdc)
      && targetRaycaster.ray.intersectPlane(groundPlane, groundHit)) {
      pressed.target.set(groundHit.x, pressed.home?.y ?? 0.12, groundHit.z);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pressedEnemy) {
      if (event.pointerId !== pressedEnemy.pointerId) return;
      const uid = pressedEnemy.uid;
      pressedEnemy = null;
      if (enabled()) inspectEnemy?.(uid);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    const source = pressed.source;
    const wasDragging = dragging;
    const active = enabled();
    const run = wasDragging && active && getRun()?.phase === "PLANNING" ? getRun() : null;
    const target = run ? pickTarget(event.clientX, event.clientY, run) : null;
    const valid = Boolean(run && target && canMove(run, source, target));
    const entry = run ? (source.kind === "board" ? run.board[source.index] : run.bench[source.index]) : null;
    const uid = entry?.uid;
    const moved = valid && target ? move(source, target) : false;
    // A committed drop keeps the rig where the pointer released it, then lands on the tile.
    // Restoring the origin position here made the unit fly from its old cell instead.
    if (moved && uid) board.landUnit?.(uid);
    clearState(true, !moved);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) {
      showMoveFeedback(target, moved);
      return;
    }
    if (!wasDragging && active) select?.(source);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pressedEnemy?.pointerId === event.pointerId) pressedEnemy = null;
    if (!pressed) clearState(false);
    else if (pressed.pointerId === event.pointerId) cancel();
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (pressedEnemy) pressedEnemy = null;
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

  const onBlur = () => cancel();

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
      if (canvas.style) canvas.style.touchAction = previousTouchAction ?? "";
      roots.length = 0;
      hits.length = 0;
      kindByUid.clear();
    },
  };
}
