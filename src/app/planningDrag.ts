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
  enabled(): boolean;
  profile?: Profile;
}

const DRAG_THRESHOLD_SQ = 36;
const BENCH_HALF = 0.48;
const PLAYER_COLS = 5;

export function createPlanningDragController({
  stage,
  board,
  getRun,
  move,
  select,
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
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    if (!enabled()) {
      cancel();
      return;
    }
    if (!dragging) {
      const dx = event.clientX - pressed.startX;
      const dy = event.clientY - pressed.startY;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      captured = true;
    }
    const run = getRun();
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
      move(source, target);
      return;
    }
    if (!wasDragging && active && source.kind === "board") select?.(source);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (pressed?.pointerId === event.pointerId) cancel();
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (pressed?.pointerId === event.pointerId && !dragging) cancel();
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
