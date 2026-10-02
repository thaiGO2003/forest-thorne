// Voxel arena (spec 11.7, A91.2–A91.5). One block = 1 world unit. Visual column 5 (river) sits at world x=0.
// Owns every GPU resource it creates; dispose() releases all of them.
import * as THREE from "three";
import { benchPerimeter, brownRing, riverCells, toLogical, totalRows, VISUAL_COLS, type Cell, type Profile } from "../board/geometry";
import { createScenery } from "./scenery";

export const BLOCK = 1;
const TILE_H = 0.12;
const FLOW_SPEED = 0.62;

export type LightPhase = "menu" | "planning" | "combat";
const LIGHT_PRESETS: Record<LightPhase, { hemi: number; sun: number; rim: number; fog: [number, number]; sky: number }> = {
  menu: { hemi: 0.9, sun: 1.6, rim: 0.3, fog: [40, 110], sky: 0x9fd3ff },
  planning: { hemi: 1.0, sun: 2.0, rim: 0.25, fog: [45, 120], sky: 0xa8dcff },
  combat: { hemi: 0.65, sun: 2.4, rim: 0.7, fog: [35, 95], sky: 0x8cb8e0 },
};

/** Visual grid cell → world centre (x,z). */
export function cellToWorld(c: Cell, p: Profile): { x: number; z: number } {
  return { x: (c.x - (VISUAL_COLS - 1) / 2) * BLOCK, z: (c.z - (totalRows(p) - 1) / 2) * BLOCK };
}

/** World point → logical cell. River interior (|x| < BLOCK/2) and off-board points return null. */
export function worldToLogical(x: number, z: number, p: Profile) {
  if (Math.abs(x) < BLOCK / 2) return null;
  return toLogical(Math.round(x / BLOCK + (VISUAL_COLS - 1) / 2), Math.round(z / BLOCK + (totalRows(p) - 1) / 2), p);
}

export interface Arena {
  root: THREE.Group;
  /** Raycast-only tactical tiles; river is intentionally excluded. */
  tiles: THREE.InstancedMesh;
  setPhase(phase: LightPhase): void;
  setOccupied(col: number, row: number, occupied: boolean): void;
  setShadowQuality(q: "low" | "medium" | "high"): void;
  update(dt: number): void;
  dispose(): void;
}

export function createArena(scene: THREE.Scene, p: Profile): Arena {
  const root = new THREE.Group();
  root.name = "arena";
  scene.add(root);
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const m4 = new THREE.Matrix4();
  const rows = totalRows(p);

  const blockGeo = own(new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK));
  const tileGeo = own(new THREE.BoxGeometry(BLOCK * 0.96, TILE_H, BLOCK * 0.96));
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    own(new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra }));

  // Foundation: one contiguous slab under battlefield + ring + bench (no cracks between cubes).
  const minX = -2, maxX = VISUAL_COLS + 1, minZ = -2, maxZ = rows + 1;
  const soil = new THREE.InstancedMesh(blockGeo, mat(0x7a5232), (maxX - minX + 1) * (maxZ - minZ + 1));
  let n = 0;
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
    if (x === 5 && z >= 0 && z < rows) continue; // river bed carved below
    const w = cellToWorld({ x, z }, p);
    soil.setMatrixAt(n++, m4.makeTranslation(w.x, -BLOCK / 2, w.z));
  }
  soil.count = n;
  soil.receiveShadow = true;
  root.add(soil);

  // Tactical top tiles: checker grass, switch to soil-top when occupied (11.7: no grass under units).
  const grassA = new THREE.Color(0x6fbf4a), grassB = new THREE.Color(0x5fae3e), bare = new THREE.Color(0xa07a4e);
  const tiles = new THREE.InstancedMesh(tileGeo, mat(0xffffff), 10 * rows);
  const tileIndex: Record<string, number> = {};
  n = 0;
  for (let x = 0; x < VISUAL_COLS; x++) for (let z = 0; z < rows; z++) {
    const l = toLogical(x, z, p);
    if (!l) continue;
    const w = cellToWorld({ x, z }, p);
    tiles.setMatrixAt(n, m4.makeTranslation(w.x, TILE_H / 2, w.z));
    tiles.setColorAt(n, (l.col + l.row) % 2 ? grassA : grassB);
    tileIndex[`${l.col},${l.row}`] = n++;
  }
  tiles.receiveShadow = true;
  tiles.name = "tactical-tiles";
  root.add(tiles);

  // Grass tufts on free tiles; hidden per tile when occupied.
  const tuftGeo = own(new THREE.ConeGeometry(0.06, 0.22, 4));
  const tufts = new THREE.InstancedMesh(tuftGeo, mat(0x86d45a), n * 3);
  const tuftOffsets = [[-0.28, -0.22], [0.25, 0.1], [-0.05, 0.3]] as const;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    tiles.getMatrixAt(i, m4);
    const pos = new THREE.Vector3().setFromMatrixPosition(m4);
    const [ox, oz] = tuftOffsets[k]!;
    tufts.setMatrixAt(i * 3 + k, new THREE.Matrix4().makeTranslation(pos.x + ox, TILE_H + 0.1, pos.z + oz));
  }
  tufts.raycast = () => {};
  root.add(tufts);

  // Brown walkable ring + separate bench perimeter (A91.2: no blocking fence).
  const ringTiles = (cells: Cell[], color: number, y: number) => {
    const mesh = new THREE.InstancedMesh(tileGeo, mat(color), cells.length);
    cells.forEach((c, i) => { const w = cellToWorld(c, p); mesh.setMatrixAt(i, m4.makeTranslation(w.x, y, w.z)); });
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    root.add(mesh);
    return mesh;
  };
  ringTiles(brownRing(p), 0x8a5a34, TILE_H / 2);
  const bench = ringTiles(benchPerimeter(p), 0xb48a5c, TILE_H / 2 + 0.02);
  bench.name = "bench-perimeter";

  // River: water strip, 7 flow markers, 3 lily pads. Not raycastable.
  const riverLen = riverCells(p).length * BLOCK;
  const waterMat = mat(0x3aa0d8, { roughness: 0.25, metalness: 0.1 });
  const water = new THREE.Mesh(own(new THREE.BoxGeometry(BLOCK, 0.5, riverLen)), waterMat);
  water.position.set(0, -0.3, 0);
  water.raycast = () => {};
  root.add(water);
  const markerGeo = own(new THREE.BoxGeometry(0.08, 0.02, 0.35));
  const markerMat = mat(0xd8f2ff, { transparent: true, opacity: 0.7 });
  const markers = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(markerGeo, markerMat);
    m.position.set(((i % 3) - 1) * 0.25, -0.04, -riverLen / 2 + ((i + 0.5) * riverLen) / 7);
    m.raycast = () => {};
    root.add(m);
    return m;
  });
  const padGeo = own(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 7));
  const padMat = mat(0x3f8f3a);
  [[-0.2, -0.3], [0.22, 0.15], [-0.1, 0.4]].forEach(([fx, fz]) => {
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(fx!, -0.035, fz! * riverLen);
    pad.raycast = () => {};
    root.add(pad);
  });
  const scenery = createScenery(root, p, own, (c) => cellToWorld(c, p), waterMat);

  // One owned lighting rig, retuned per phase (A91.5).
  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5b4a2e, 1);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  const half = Math.max(VISUAL_COLS, rows) / 2 + 3;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 50 });
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.3);
  rim.position.set(10, 6, -12);
  root.add(hemi, sun, rim);
  scene.fog = new THREE.Fog(0xa8dcff, 45, 120);

  let flowT = 0;
  return {
    root,
    tiles,
    setPhase(phase) {
      const L = LIGHT_PRESETS[phase];
      hemi.intensity = L.hemi; sun.intensity = L.sun; rim.intensity = L.rim;
      const fog = scene.fog as THREE.Fog;
      [fog.near, fog.far] = L.fog;
      fog.color.setHex(L.sky);
      scene.background = new THREE.Color(L.sky);
    },
    setOccupied(col, row, occupied) {
      const i = tileIndex[`${col},${row}`];
      if (i === undefined) return;
      tiles.setColorAt(i, occupied ? bare : (col + row) % 2 ? grassA : grassB);
      tiles.instanceColor!.needsUpdate = true;
      tiles.getMatrixAt(i, m4);
      const pos = new THREE.Vector3().setFromMatrixPosition(m4);
      for (let k = 0; k < 3; k++) {
        const [ox, oz] = tuftOffsets[k]!;
        tufts.setMatrixAt(i * 3 + k, m4.makeTranslation(pos.x + ox, occupied ? -10 : TILE_H + 0.1, pos.z + oz));
      }
      tufts.instanceMatrix.needsUpdate = true;
    },
    setShadowQuality(q) {
      sun.castShadow = q !== "low";
      const size = q === "high" ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(size, size);
      }
    },
    update(dt) {
      flowT += Math.max(0, dt) * FLOW_SPEED;
      scenery.update(Math.max(0, dt));
      markers.forEach((m, i) => {
        m.position.z = (((-riverLen / 2 + ((i + 0.5) * riverLen) / 7 + flowT) % riverLen) + riverLen) % riverLen - riverLen / 2;
      });
    },
    dispose() {
      sun.shadow.map?.dispose();
      for (const d of disposables) d.dispose();
      for (const o of [soil, tiles, tufts, bench]) o.dispose();
      scene.remove(root);
      scene.fog = null;
    },
  };
}
