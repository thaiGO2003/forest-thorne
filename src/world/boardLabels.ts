// Board position markers (old_src `createPlanningBoardEdgeLabels`): chess files A..J along the
// near/far edges and row numbers on both flanks, so players can name a cell ("D2") the same way
// the legacy planning scene did. All markers share one canvas atlas and one merged geometry, so
// the whole layer costs a single draw call.
import * as THREE from "three";
import { totalRows, toVisual, VISUAL_COLS, type Profile } from "../board/geometry";
import { onKitReady, label } from "../ui/kit";

export const BOARD_FILES = "ABCDEFGHIJ";
const BLOCK = 1;
const LABEL_W = 0.42;
const LABEL_D = 0.54;
const LABEL_Y = 0.137;
const CELL = 64;
const ATLAS_COLS = 8;
const ATLAS_W = CELL * ATLAS_COLS;
const ATLAS_H = 512;
/** Markers sit on the inner half of the border tile, inside the board footprint. */
const EDGE_GAP = 0.3;

/** Same projection as arena.cellToWorld; kept local to avoid an arena ↔ labels import cycle. */
const cellToWorld = (c: { x: number; z: number }, p: Profile) => ({
  x: (c.x - (VISUAL_COLS - 1) / 2) * BLOCK,
  z: (c.z - (totalRows(p) - 1) / 2) * BLOCK,
});

export type BoardPositionEdge = "file-near" | "file-far" | "row-left" | "row-right";
export interface BoardPositionLabel {
  text: string;
  x: number;
  z: number;
  edge: BoardPositionEdge;
}

/** Pure label layout so tests can verify the file/rank convention without WebGL. */
export function boardPositionLabels(p: Profile = "solo"): BoardPositionLabel[] {
  const rows = totalRows(p);
  const out: BoardPositionLabel[] = [];
  // Both edges carry the full A..J file set: the near edge sits behind the shop dock on
  // desktop/landscape, so the far edge must stay readable on its own.
  for (let col = 0; col < BOARD_FILES.length; col++) {
    const near = cellToWorld(toVisual(col, rows - 1, p), p);
    const far = cellToWorld(toVisual(col, 0, p), p);
    out.push({ text: BOARD_FILES[col]!, x: near.x, z: near.z - EDGE_GAP, edge: "file-near" });
    out.push({ text: BOARD_FILES[col]!, x: far.x, z: far.z + EDGE_GAP, edge: "file-far" });
  }
  for (let row = 0; row < rows; row++) {
    const left = cellToWorld(toVisual(0, row, p), p);
    const right = cellToWorld(toVisual(9, row, p), p);
    out.push({ text: String(row), x: left.x + EDGE_GAP, z: left.z, edge: "row-left" });
    out.push({ text: String(row), x: right.x - EDGE_GAP, z: right.z, edge: "row-right" });
  }
  return out;
}

export interface BoardLabels {
  group: THREE.Group;
  dispose(): void;
}

/** Builds the marker layer. No-op without a DOM (headless unit tests use the pure layout above). */
export function createBoardLabels(p: Profile): BoardLabels {
  const group = new THREE.Group();
  group.name = "board-position-labels";
  const labels = boardPositionLabels(p);
  let geometry: THREE.BufferGeometry | null = null;
  let material: THREE.MeshBasicMaterial | null = null;
  let texture: THREE.CanvasTexture | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let offKitReady: (() => void) | null = null;

  if (typeof document !== "undefined" && labels.length) {
    canvas = document.createElement("canvas");
    canvas.width = ATLAS_W;
    canvas.height = ATLAS_H;
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 2;

    const draw = () => {
      if (!canvas || !texture) return;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, ATLAS_W, ATLAS_H);
      labels.forEach((marker, index) => {
        const col = index % ATLAS_COLS;
        const row = Math.floor(index / ATLAS_COLS);
        label(g, marker.text, col * CELL + CELL / 2, row * CELL + CELL / 2 + 1, {
          size: 48, fill: "#f4e6c3", stroke: "#231608", weight: 800, maxW: CELL - 6,
        });
      });
      texture.needsUpdate = true;
    };
    draw();

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    labels.forEach((marker, index) => {
      const col = index % ATLAS_COLS;
      const row = Math.floor(index / ATLAS_COLS);
      const u0 = (col * CELL) / ATLAS_W, u1 = ((col + 1) * CELL) / ATLAS_W;
      const vTop = 1 - (row * CELL) / ATLAS_H, vBottom = 1 - ((row + 1) * CELL) / ATLAS_H;
      const base = positions.length / 3;
      const x0 = marker.x - LABEL_W / 2, x1 = marker.x + LABEL_W / 2;
      // Local +y of the plane maps to world -z, so "top" of the glyph sits away from the camera.
      const z0 = marker.z - LABEL_D / 2, z1 = marker.z + LABEL_D / 2;
      positions.push(x0, LABEL_Y, z0, x1, LABEL_Y, z0, x0, LABEL_Y, z1, x1, LABEL_Y, z1);
      for (let i = 0; i < 4; i++) normals.push(0, 1, 0);
      uvs.push(u0, vTop, u1, vTop, u0, vBottom, u1, vBottom);
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    });
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "board-position-labels-mesh";
    mesh.raycast = () => {};
    group.add(mesh);

    // Fonts and the UI kit finish loading after the arena is built; redraw once they do.
    offKitReady = onKitReady(draw);
  }

  return {
    group,
    dispose() {
      offKitReady?.();
      for (const child of group.children) {
        const mesh = child as THREE.Mesh;
        (mesh.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
        const mat = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const item of mat) item?.dispose?.();
      }
      texture?.dispose();
      group.removeFromParent();
    },
  };
}
