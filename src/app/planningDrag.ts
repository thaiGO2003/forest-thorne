import * as THREE from "three";
import { benchPerimeter, type Profile } from "../board/geometry";
import { benchCap, type RunState } from "../core/run";
import type { BoardView } from "../units/boardView";
import { cellToWorld } from "../world/arena";
import { createBoardPickingController, setRayFromClientPoint } from "../world/boardPicking";
import type { Stage } from "../world/stage";

export type PlanningSlot = { kind: "bench" | "board"; index: number };

export interface PlanningDragController {
  cancel(): void;
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
  enabled(): boolean;
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
  enabled,
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

  let pressed: { pointerId: number; startX: number; startY: number; source: PlanningSlot } | null = null;
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
    while (current && current !== stage.scene) {
      const uid = current.userData.uid;
      if (typeof uid === "string") return uid;
      current = current.parent;
    }
    return null;
  };

  const pickSource = (clientX: number, clientY: number, run: RunState): PlanningSlot | null => {
    if (!setRayFromClientPoint(canvas, clientX, clientY, stage.camera, sourceRaycaster, sourceNdc)) return null;
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
      if (kindByUid.get(uid) === "enemy") return null;
      return sourceForUid(run, uid);
    }
    return null;
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

  const clearState = (releaseCapture: boolean) => {
    const pointerId = pressed?.pointerId;
    pressed = null;
    dragging = false;
    boardPicker.clear();
    stage.arena.clearHighlights();
    stage.arena.clearBenchHighlights();
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
    if (!run || run.phase !== "PLANNING") return;
    const source = pickSource(event.clientX, event.clientY, run);
    if (!source) return;
    pressed = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, source };
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
        return;
      }
      const run = getRun();
      if (!run || run.phase !== "PLANNING") {
        stage.arena.clearHighlights();
        stage.arena.clearBenchHighlights();
        clearPreview();
        return;
      }
      paintPointerCell(event.clientX, event.clientY, run);
      showPreview(pickSource(event.clientX, event.clientY, run), event.clientX, event.clientY);
      return;
    }
    if (!enabled()) {
      cancel();
      return;
    }
    if (!dragging) {
      const dx = event.clientX - pressed.startX;
      const dy = event.clientY - pressed.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
      dragging = true;
      clearPreview();
      canvas.setPointerCapture(event.pointerId);
      captured = true;
    }
    const run = getRun();
    if (run) paintPointerCell(event.clientX, event.clientY, run, pressed.source);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    const source = pressed.source;
    const wasDragging = dragging;
    const active = enabled();
    const run = wasDragging && active ? getRun() : null;
    const target = run ? pickTarget(event.clientX, event.clientY, run) : null;
    clearState(true);
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target) {
      const valid = move(source, target);
      showMoveFeedback(target, valid);
      return;
    }
    if (!wasDragging && active) select?.(source);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pressed?.pointerId === event.pointerId) cancel();
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (pressed?.pointerId === event.pointerId && dragging) return;
    cancel();
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
      roots.length = 0;
      hits.length = 0;
      kindByUid.clear();
    },
  };
}
