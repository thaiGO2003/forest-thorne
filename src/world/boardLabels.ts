// Board position markers (old_src `toPlanningChessCoord`): every playable cell carries a faint,
// embossed "A1" coordinate so players can name a tile the way the legacy planning tooltip did.
// All markers share one canvas atlas and one merged geometry → one draw call for the whole board.
import * as THREE from "three";
import { totalRows, toVisual, VISUAL_COLS, type Profile } from "../board/geometry";
import { onKitReady, label } from "../ui/kit";

export const BOARD_FILES = "ABCDEFGHIJ";
const BLOCK = 1;
const LABEL_Y = 0.126;
const CELL_W = 72;
const CELL_H = 36;
const ATLAS_COLS = 8;
const ATLAS_W = CELL_W * ATLAS_COLS;
const ATLAS_H = 1024;
/** Marker plane is 2:1 like the atlas cell; kept small and faint on the tile. */
const PLANE_W = 0.34;
const PLANE_D = PLANE_W * (CELL_H / CELL_W);
const CORNER = 0.29;

/** Same projection as arena.cellToWorld; kept local to avoid an arena ↔ labels import cycle. */
const cellToWorld = (c: { x: number; z: number }, p: Profile) => ({
  x: (c.x - (VISUAL_COLS - 1) / 2) * BLOCK,
  z: (c.z - (totalRows(p) - 1) / 2) * BLOCK,
});

export interface BoardPositionLabel {
  text: string;
  x: number;
  z: number;
  col: number;
  row: number;
}

/**
 * One coordinate per playable cell: file A..J + rank counted from the player's near edge (1-based),
 * so A1 is the bottom-left ally tile and A5 the top-left tile of a solo board.
 */
export function boardPositionLabels(p: Profile = "solo"): BoardPositionLabel[] {
  const rows = totalRows(p);
  const out: BoardPositionLabel[] = [];
  for (let row = 0; row < rows; row++) {
    const rank = rows - row;
    for (let col = 0; col < BOARD_FILES.length; col++) {
      const w = cellToWorld(toVisual(col, row, p), p);
      out.push({
        text: `${BOARD_FILES[col]!}${rank}`,
        x: w.x - CORNER,
        z: w.z - CORNER,
        col,
        row,
      });
    }
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
    texture.generateMipmaps = false;

    const draw = () => {
      if (!canvas || !texture) return;
      const g = canvas.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, ATLAS_W, ATLAS_H);
      labels.forEach((marker, index) => {
        const col = index % ATLAS_COLS;
        const row = Math.floor(index / ATLAS_COLS);
        const cx = col * CELL_W + CELL_W / 2;
        const cy = row * CELL_H + CELL_H / 2 + 1;
        const style = { size: 22, weight: 800, maxW: CELL_W - 6 } as const;
        // Embossed copies: warm highlight up-left, dark extrusion down-right, outlined face.
        label(g, marker.text, cx - 1, cy - 1, { ...style, fill: "#fff3cf", stroke: null });
        label(g, marker.text, cx + 1, cy + 1.6, { ...style, fill: "#4a3517", stroke: null });
        label(g, marker.text, cx, cy, { ...style, fill: "#f1dfb4", stroke: "#2a1f0d" });
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
      const u0 = (col * CELL_W) / ATLAS_W, u1 = ((col + 1) * CELL_W) / ATLAS_W;
      const vTop = 1 - (row * CELL_H) / ATLAS_H;
      const vBottom = 1 - ((row + 1) * CELL_H) / ATLAS_H;
      const base = positions.length / 3;
      const x0 = marker.x - PLANE_W / 2, x1 = marker.x + PLANE_W / 2;
      // Local +y of the plane maps to world -z, so "top" of the glyph sits away from the camera.
      const z0 = marker.z - PLANE_D / 2, z1 = marker.z + PLANE_D / 2;
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
      map: texture, transparent: true, opacity: .58, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
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
