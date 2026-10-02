// Surrounding world (A25): stepped voxel meadow → forest → hills → mountains, river continuing
// through a valley, rocks, flowers, drifting clouds. Decorative only: never raycastable, layout is
// deterministic (hash of cell), every GPU resource is registered with the caller's `own`.
import * as THREE from "three";
import { RIVER_X, totalRows, VISUAL_COLS, type Cell, type Profile } from "../board/geometry";

/** Rings of terrain beyond the bench slab. */
const REACH = 34;
/** Flat meadow width; the camera side (+z) gets more so trees never occlude the bench row. */
const APRON = 3;
const APRON_CAMERA_SIDE = 12;
const BOTTOM = -2;
/** Grass/stone cap slab thickness on each terrain column. */
const CAP = 0.3;
const WATER_Y = -0.3;
const WATER_H = 0.5;

const hash = (x: number, z: number, k = 0) => {
  const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

type Own = <T extends { dispose(): void }>(x: T) => T;

export function createScenery(
  root: THREE.Group,
  p: Profile,
  own: Own,
  toWorld: (c: Cell) => { x: number; z: number },
  waterMat: THREE.Material,
): { update(dt: number): void } {
  const rows = totalRows(p);
  // Bench slab in visual-cell space (see arena foundation).
  const minX = -2, maxX = VISUAL_COLS + 1, minZ = -2, maxZ = rows + 1;

  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const white = (extra: THREE.MeshStandardMaterialParameters = {}) =>
    own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true, ...extra }));

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = 0) => {
    mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), q.setFromAxisAngle(up, rot), s.set(sx, sy, sz)));
  };
  const instanced = (n: number, mat: THREE.Material, name: string) => {
    const mesh = own(new THREE.InstancedMesh(box, mat, Math.max(1, n)));
    mesh.count = n;
    mesh.name = name;
    mesh.raycast = () => {};
    root.add(mesh);
    return mesh;
  };

  // --- Terrain layout --------------------------------------------------------------------------
  interface Column { x: number; z: number; h: number; d: number; cx: number; cz: number }
  const columns: Column[] = [];
  const bed: { x: number; z: number }[] = [];
  for (let cx = minX - REACH; cx <= maxX + REACH; cx++) for (let cz = minZ - REACH; cz <= maxZ + REACH; cz++) {
    const dx = Math.max(minX - cx, cx - maxX, 0), dz = Math.max(minZ - cz, cz - maxZ, 0);
    const d = Math.max(dx, dz);
    if (d === 0) continue;
    const w = toWorld({ x: cx, z: cz });
    if (cx === RIVER_X && dx === 0) { bed.push(w); continue; } // river channel
    const flat = cz > maxZ ? APRON_CAMERA_SIDE : APRON;
    const valley = dx === 0 ? Math.min(1, Math.max(0, (Math.abs(cx - RIVER_X) - 1) / 5)) : 1;
    const wave = Math.sin(cx * 0.35) + Math.sin(cz * 0.29 + 1.3) + Math.sin((cx + cz) * 0.17);
    const h = Math.max(0, Math.round(Math.max(0, d - flat) * 0.3 * (1 + 0.3 * wave) * valley));
    columns.push({ x: w.x, z: w.z, h, d, cx, cz });
  }

  const bodies = instanced(columns.length + bed.length, white(), "scenery-terrain");
  const caps = instanced(columns.length, white(), "scenery-caps");
  caps.receiveShadow = bodies.receiveShadow = true;
  columns.forEach((c, i) => {
    const bodyH = c.h - BOTTOM - CAP;
    put(bodies, i, c.x, BOTTOM + bodyH / 2, c.z, 1, bodyH, 1);
    bodies.setColorAt(i, col.setHex(c.h > 4 ? 0x7d7f78 : 0x7a5232));
    const cap = c.h >= 9 ? 0xf2f6f8 : c.h >= 7 ? 0x8d8f86 : c.h >= 5 ? 0x4f9a3d : c.h >= 3 ? 0x58a63f : c.h >= 1 ? 0x62b444 : 0x6cbf4c;
    caps.setColorAt(i, col.setHex(cap).offsetHSL(0, 0, (hash(c.cx, c.cz, 9) - 0.5) * 0.05));
    put(caps, i, c.x, c.h - CAP / 2, c.z, 1, CAP, 1);
  });
  // River bed under the extended water.
  const bedTop = WATER_Y - WATER_H / 2;
  bed.forEach((b, i) => {
    put(bodies, columns.length + i, b.x, (BOTTOM + bedTop) / 2, b.z, 1, bedTop - BOTTOM, 1);
    bodies.setColorAt(columns.length + i, col.setHex(0x5e4027));
  });

  // Water continues past both ends of the board through the valley.
  for (const [from, to] of [[minZ - REACH, minZ - 1], [maxZ + 1, maxZ + REACH]] as const) {
    const a = toWorld({ x: RIVER_X, z: from }), b = toWorld({ x: RIVER_X, z: to });
    const len = Math.abs(b.z - a.z) + 1;
    const water = new THREE.Mesh(own(new THREE.BoxGeometry(1, WATER_H, len)), waterMat);
    water.position.set(a.x, WATER_Y, (a.z + b.z) / 2);
    water.raycast = () => {};
    root.add(water);
  }

  // --- Props -----------------------------------------------------------------------------------
  const forest = columns.filter((c) => {
    if (c.h > 6 || Math.abs(c.cx - RIVER_X) <= 1) return false;
    if (c.d < (c.cz > maxZ ? APRON_CAMERA_SIDE : APRON + 1)) return false;
    const density = c.d <= 16 ? 0.3 : 0.12;
    return hash(c.cx, c.cz, 1) < density;
  });
  const trunks = instanced(forest.length, white(), "scenery-trunks");
  const leaves = instanced(forest.length * 2, white(), "scenery-leaves");
  trunks.castShadow = leaves.castShadow = true;
  forest.forEach((c, i) => {
    const k = 0.8 + hash(c.cx, c.cz, 2) * 0.5;
    const ox = (hash(c.cx, c.cz, 3) - 0.5) * 0.4, oz = (hash(c.cx, c.cz, 4) - 0.5) * 0.4;
    const rot = hash(c.cx, c.cz, 5) * Math.PI;
    const x = c.x + ox, z = c.z + oz;
    put(trunks, i, x, c.h + 0.4 * k, z, 0.24 * k, 0.8 * k, 0.24 * k, rot);
    trunks.setColorAt(i, col.setHex(0x6b4426));
    put(leaves, i * 2, x, c.h + 1.15 * k, z, 0.95 * k, 0.75 * k, 0.95 * k, rot);
    put(leaves, i * 2 + 1, x, c.h + 1.7 * k, z, 0.55 * k, 0.5 * k, 0.55 * k, rot + 0.4);
    const leaf = hash(c.cx, c.cz, 6) < 0.25 ? 0x7fb83a : 0x3f8f3a;
    leaves.setColorAt(i * 2, col.setHex(leaf).offsetHSL(0, 0, (hash(c.cx, c.cz, 7) - 0.5) * 0.08));
    leaves.setColorAt(i * 2 + 1, col.offsetHSL(0, 0, 0.05));
  });

  const rockCells = columns.filter((c) => c.d >= 2 && c.h <= 6 && Math.abs(c.cx - RIVER_X) > 1 && hash(c.cx, c.cz, 8) < 0.05);
  const rocks = instanced(rockCells.length, white(), "scenery-rocks");
  rocks.castShadow = true;
  rockCells.forEach((c, i) => {
    const k = 0.3 + hash(c.cx, c.cz, 10) * 0.35;
    put(rocks, i, c.x + 0.2, c.h + k * 0.35, c.z - 0.15, k * 1.2, k * 0.7, k, hash(c.cx, c.cz, 11) * Math.PI);
    rocks.setColorAt(i, col.setHex(0x9a9b94).offsetHSL(0, 0, (hash(c.cx, c.cz, 12) - 0.5) * 0.1));
  });

  const FLOWER = [0xffd84a, 0xff8fb8, 0xffffff, 0xb59cff] as const;
  const bloomCells = columns.filter((c) => c.h === 0 && Math.abs(c.cx - RIVER_X) > 1 && hash(c.cx, c.cz, 13) < 0.22);
  const flowers = instanced(bloomCells.length * 2, white({ roughness: 0.7 }), "scenery-flowers");
  bloomCells.forEach((c, i) => {
    for (let k = 0; k < 2; k++) {
      const ox = (hash(c.cx, c.cz, 14 + k) - 0.5) * 0.7, oz = (hash(c.cx, c.cz, 16 + k) - 0.5) * 0.7;
      put(flowers, i * 2 + k, c.x + ox, 0.07, c.z + oz, 0.12, 0.14, 0.12);
      flowers.setColorAt(i * 2 + k, col.setHex(FLOWER[Math.floor(hash(c.cx, c.cz, 18 + k) * FLOWER.length)]!));
    }
  });

  // --- Clouds: few voxel clusters drifting along +x, wrapping across the sky. ------------------
  const SPAN = 110;
  const PUFFS = [[0, 0, 0, 3.2, 1.1, 2], [1.8, 0.5, 0.3, 2.2, 1.2, 1.6], [-1.7, 0.2, -0.2, 2, 0.9, 1.5]] as const;
  const cloudSeeds = Array.from({ length: 9 }, (_, i) => ({
    x: (hash(i, 0, 20) - 0.5) * SPAN,
    y: 15 + hash(i, 0, 21) * 6,
    z: (hash(i, 0, 22) - 0.6) * 80,
    k: 1 + hash(i, 0, 23) * 1.2,
  }));
  const clouds = instanced(cloudSeeds.length * PUFFS.length, white({ roughness: 1 }), "scenery-clouds");
  const placeClouds = () => {
    cloudSeeds.forEach((c, i) => PUFFS.forEach(([px, py, pz, sx, sy, sz], j) =>
      put(clouds, i * PUFFS.length + j, c.x + px * c.k, c.y + py * c.k, c.z + pz * c.k, sx * c.k, sy * c.k, sz * c.k)));
    clouds.instanceMatrix.needsUpdate = true;
  };
  placeClouds();

  for (const mesh of [bodies, caps, trunks, leaves, rocks, flowers]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    update(dt) {
      for (const c of cloudSeeds) c.x = ((c.x + dt * 0.6 + SPAN / 2) % SPAN + SPAN) % SPAN - SPAN / 2;
      placeClouds();
    },
  };
}
