import * as THREE from "three";
import type { Profile } from "../board/geometry";
import { worldToLogical } from "./arena";

export type BoardPickState =
  | { kind: "cell"; cell: { col: number; row: number } }
  | { kind: "none"; cell: null };

export interface BoardPickingController {
  readonly state: BoardPickState;
  pick(clientX: number, clientY: number): BoardPickState;
  setBoard(tiles: THREE.InstancedMesh, profile: Profile): void;
  subscribe(listener: (state: BoardPickState) => void): () => void;
  clear(): void;
  dispose(): void;
}

const NO_CELL: BoardPickState = Object.freeze({ kind: "none", cell: null });

export type CanvasBoundsSource = Pick<HTMLCanvasElement, "getBoundingClientRect">;

/** Convert viewport client coordinates into a camera ray using the canvas bounds, not the window. */
export function setRayFromClientPoint(
  canvas: CanvasBoundsSource,
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  ndc: THREE.Vector2,
): boolean {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0
    || clientX < rect.left || clientX > rect.left + rect.width
    || clientY < rect.top || clientY > rect.top + rect.height) {
    return false;
  }

  ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);
  return true;
}

/**
 * Pointer-event board resolver. Mouse, pen and touch share the PointerEvent path,
 * while canonical world -> logical conversion remains owned by arena mapping.
 */
export function createBoardPickingController(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  initialTiles: THREE.InstancedMesh,
  initialProfile: Profile,
): BoardPickingController {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits: THREE.Intersection[] = [];
  const listeners = new Set<(state: BoardPickState) => void>();
  let tiles = initialTiles;
  let profile = initialProfile;
  let state: BoardPickState = NO_CELL;
  let disposed = false;

  const publish = (next: BoardPickState): BoardPickState => {
    const same = state.kind === next.kind
      && (next.kind === "none" || (state.kind === "cell" && state.cell.col === next.cell.col && state.cell.row === next.cell.row));
    if (same) return state;
    state = next;
    for (const listener of listeners) listener(state);
    return state;
  };

  const clear = () => publish(NO_CELL);

  const pick = (clientX: number, clientY: number): BoardPickState => {
    if (disposed) return state;
    if (!setRayFromClientPoint(canvas, clientX, clientY, camera, raycaster, ndc)) return clear();
    hits.length = 0;
    raycaster.intersectObject(tiles, false, hits);
    const hit = hits[0];
    if (!hit) return clear();

    const cell = worldToLogical(hit.point.x, hit.point.z, profile);
    return cell ? publish({ kind: "cell", cell }) : clear();
  };

  const onPointer = (event: PointerEvent) => { pick(event.clientX, event.clientY); };
  const onPointerExit = () => { clear(); };

  canvas.addEventListener("pointermove", onPointer);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointerleave", onPointerExit);
  canvas.addEventListener("pointercancel", onPointerExit);

  return {
    get state() { return state; },
    pick,
    setBoard(nextTiles, nextProfile) {
      tiles = nextTiles;
      profile = nextProfile;
      clear();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointerleave", onPointerExit);
      canvas.removeEventListener("pointercancel", onPointerExit);
      listeners.clear();
      state = NO_CELL;
      hits.length = 0;
    },
  };
}
