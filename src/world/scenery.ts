// Surrounding world (A25): stepped voxel meadow → forest → hills → mountains, river continuing
// through a valley, rocks, flowers, drifting clouds. Decorative only: never raycastable, layout is
// deterministic (hash of cell), every GPU resource is registered with the caller's `own`.
import * as THREE from "three";
import { RIVER_X, totalRows, VISUAL_COLS, type Cell, type Profile } from "../board/geometry";
import type { EnvironmentId } from "../core/environment";
import type { DayNightPhase } from "../core/dayNight";

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
): { setEnvironment(environment: EnvironmentId): void; setDayNight(phase: DayNightPhase): void; update(dt: number): void } {
  const rows = totalRows(p);
  // Bench slab in visual-cell space (see arena foundation).
  const minX = -2, maxX = VISUAL_COLS + 1, minZ = -2, maxZ = rows + 1;
  // Outside the board the river meanders in whole cells only (axis-aligned voxel steps, never a
  // rotated box) and is always at least 3 cells wide so the water reads as a river, not a puddle.
  const riverSpanForScenery = (cz: number): { left: number; right: number } => {
    if (cz >= minZ && cz <= maxZ) return { left: RIVER_X, right: RIVER_X };
    const edge = cz < minZ ? minZ : maxZ;
    const distance = Math.abs(cz - edge);
    const phase = cz < minZ ? 0.4 : 1.9;
    const shift = distance < 3 ? 0 : Math.round(Math.sin((distance - 3) * 0.42 + phase) * 2);
    const half = Math.min(4, 1 + Math.floor(distance / 10));
    const center = RIVER_X + shift;
    return { left: center - half, right: center + half };
  };

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
    const span = riverSpanForScenery(cz);
    if (dx === 0 && cx >= span.left && cx <= span.right) { bed.push(w); continue; } // outside-only widening river channel
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

  // Only the decorative river beyond the board meanders; the five in-arena river cells stay canonical/straight.
  const riverRows: number[] = [];
  for (let cz = minZ - REACH; cz < minZ; cz++) riverRows.push(cz);
  for (let cz = maxZ + REACH; cz > maxZ; cz--) riverRows.push(cz);
  const riverWater = instanced(riverRows.length, waterMat, "scenery-river");
  riverRows.forEach((cz, i) => {
    const span = riverSpanForScenery(cz);
    const a = toWorld({ x: span.left, z: cz });
    const b = toWorld({ x: span.right, z: cz });
    const width = span.right - span.left + 1;
    put(riverWater, i, (a.x + b.x) / 2, WATER_Y, a.z, width, WATER_H, 1);
  });

  const pathCells = columns.filter((c) => {
    if ((c.cz >= minZ && c.cz <= maxZ) || c.d < 2 || c.d > 18 || c.h > 4) return false;
    const edge = c.cz < minZ ? minZ : maxZ;
    const distance = Math.abs(c.cz - edge);
    const side = c.cz < minZ ? -1 : 1;
    const targetX = RIVER_X + side * 5 + Math.round(Math.sin(distance * 0.44 + (side < 0 ? 0.2 : 1.1)) * 1.5);
    return c.cx === targetX;
  });
  const paths = instanced(pathCells.length, white({ color: 0xb08a5d, roughness: 1 }), "scenery-path-meanders");
  pathCells.forEach((c, i) => put(paths, i, c.x, c.h + 0.045, c.z, 0.82, 0.09, 0.96, (hash(c.cx, c.cz, 30) - 0.5) * 0.16));

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
  const treePlacement = (c: Column) => {
    const k = 0.8 + hash(c.cx, c.cz, 2) * 0.5;
    const ox = (hash(c.cx, c.cz, 3) - 0.5) * 0.4;
    const oz = (hash(c.cx, c.cz, 4) - 0.5) * 0.4;
    return { k, x: c.x + ox, z: c.z + oz, rot: hash(c.cx, c.cz, 5) * Math.PI };
  };
  forest.forEach((c, i) => {
    const { k, x, z, rot } = treePlacement(c);
    put(trunks, i, x, c.h + 0.4 * k, z, 0.24 * k, 0.8 * k, 0.24 * k, rot);
    trunks.setColorAt(i, col.setHex(0x6b4426));
    put(leaves, i * 2, x, c.h + 1.15 * k, z, 0.95 * k, 0.75 * k, 0.95 * k, rot);
    put(leaves, i * 2 + 1, x, c.h + 1.7 * k, z, 0.55 * k, 0.5 * k, 0.55 * k, rot + 0.4);
    const leaf = hash(c.cx, c.cz, 6) < 0.25 ? 0x7fb83a : 0x3f8f3a;
    leaves.setColorAt(i * 2, col.setHex(leaf).offsetHSL(0, 0, (hash(c.cx, c.cz, 7) - 0.5) * 0.08));
    leaves.setColorAt(i * 2 + 1, col.offsetHSL(0, 0, 0.05));
  });

  const mossTrees = forest.filter((c) => hash(c.cx, c.cz, 31) < 0.42);
  const treeMoss = instanced(mossTrees.length, white({ color: 0x4f7f37, roughness: 1 }), "scenery-tree-moss");
  mossTrees.forEach((c, i) => {
    const { k, x, z, rot } = treePlacement(c);
    put(treeMoss, i, x, c.h + 0.08, z, 0.46 * k, 0.16, 0.42 * k, rot);
  });

  const mushroomTrees = forest.filter((c) => hash(c.cx, c.cz, 32) < 0.24);
  const mushrooms = instanced(mushroomTrees.length * 2, white({ roughness: 0.82 }), "scenery-tree-mushrooms");
  mushroomTrees.forEach((c, i) => {
    const { k, x, z } = treePlacement(c);
    for (let j = 0; j < 2; j++) {
      const side = j ? -1 : 1;
      put(mushrooms, i * 2 + j, x + side * 0.22 * k, c.h + (0.26 + j * 0.14) * k, z + 0.08 * side, 0.17, 0.1, 0.13);
      mushrooms.setColorAt(i * 2 + j, col.setHex(j ? 0xf3e2b2 : 0xd86d45));
    }
  });

  const fruitTrees = forest.filter((c) => hash(c.cx, c.cz, 33) < 0.2);
  const fruits = instanced(fruitTrees.length * 3, white({ roughness: 0.6 }), "scenery-tree-fruit");
  fruitTrees.forEach((c, i) => {
    const { k, x, z } = treePlacement(c);
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2 + hash(c.cx, c.cz, 34) * 0.8;
      put(fruits, i * 3 + j, x + Math.cos(a) * 0.42 * k, c.h + (1.2 + j * 0.16) * k, z + Math.sin(a) * 0.42 * k, 0.11, 0.12, 0.11);
      fruits.setColorAt(i * 3 + j, col.setHex(j === 1 ? 0xf2b134 : 0xcf3d36));
    }
  });

  const rockCells = columns.filter((c) => c.d >= 2 && c.h <= 6 && Math.abs(c.cx - RIVER_X) > 1 && hash(c.cx, c.cz, 8) < 0.05);
  const rocks = instanced(rockCells.length, white(), "scenery-rocks");
  rocks.castShadow = true;
  rockCells.forEach((c, i) => {
    const k = 0.3 + hash(c.cx, c.cz, 10) * 0.35;
    put(rocks, i, c.x + 0.2, c.h + k * 0.35, c.z - 0.15, k * 1.2, k * 0.7, k, hash(c.cx, c.cz, 11) * Math.PI);
    rocks.setColorAt(i, col.setHex(0x9a9b94).offsetHSL(0, 0, (hash(c.cx, c.cz, 12) - 0.5) * 0.1));
  });

  const oreCells = columns.filter((c) => c.h >= 5 && c.d >= 8 && hash(c.cx, c.cz, 35) < 0.14);
  const ore = instanced(oreCells.length * 2, white({ roughness: 0.58, metalness: 0.25 }), "scenery-mountain-ore");
  const ORE = [0xd8a83d, 0x72b7c9, 0xc87045] as const;
  oreCells.forEach((c, i) => {
    for (let j = 0; j < 2; j++) {
      const ox = (hash(c.cx, c.cz, 36 + j) - 0.5) * 0.56;
      const oz = (hash(c.cx, c.cz, 38 + j) - 0.5) * 0.56;
      put(ore, i * 2 + j, c.x + ox, c.h + 0.06 + j * 0.02, c.z + oz, 0.18 + j * 0.05, 0.12, 0.14 + j * 0.04, hash(c.cx, c.cz, 40 + j) * Math.PI);
      ore.setColorAt(i * 2 + j, col.setHex(ORE[Math.floor(hash(c.cx, c.cz, 42 + j) * ORE.length)]!));
    }
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

  // Four bounded outdoor lamps around the tactical slab. Decorative meshes never participate in picking.
  const lampPostMat = white({ color: 0x5f4632, roughness: 0.8 });
  const lampGlowMat = white({ color: 0xffd27a, emissive: 0xffc35a, emissiveIntensity: 0.45, roughness: 0.45 });
  const lampMossMat = white({ color: 0x50743b, roughness: 1 });
  const lampCells = [
    { x: -1, z: -1 }, { x: VISUAL_COLS, z: -1 },
    { x: -1, z: rows }, { x: VISUAL_COLS, z: rows },
  ] as const;
  const lampPosts = instanced(lampCells.length, lampPostMat, "scenery-lamp-posts");
  const lampBranches = instanced(lampCells.length * 2, lampPostMat, "scenery-lamp-branches");
  const lampBulbs = instanced(lampCells.length * 5, lampGlowMat, "scenery-lamp-bulbs");
  const lampMoss = instanced(lampCells.length, lampMossMat, "scenery-lamp-moss");
  const bulbOffsets = [[0, 0], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]] as const;
  const lampLights = lampCells.map((cell, i) => {
    const w = toWorld(cell);
    put(lampPosts, i, w.x, 1.05, w.z, 0.16, 2.1, 0.16);
    put(lampBranches, i * 2, w.x, 2.0, w.z, 1.05, 0.12, 0.12);
    put(lampBranches, i * 2 + 1, w.x, 2.0, w.z, 0.12, 0.12, 1.05);
    put(lampMoss, i, w.x, 0.08, w.z, 0.5, 0.16, 0.5, i * 0.37);
    bulbOffsets.forEach(([ox, oz], j) => put(lampBulbs, i * bulbOffsets.length + j, w.x + ox, 2.18, w.z + oz, 0.22, 0.22, 0.22));
    const light = new THREE.PointLight(0xffd27a, 0.3, 6, 2);
    light.position.set(w.x, 2.2, w.z);
    root.add(light);
    return light;
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

  for (const mesh of [bodies, caps, trunks, leaves, mushrooms, fruits, rocks, ore, flowers]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  let currentEnvironment: EnvironmentId = "FIRE";
  let currentDayNight: DayNightPhase = "day";
  const applyLampState = () => {
    const lampColor = currentEnvironment === "FIRE" ? 0xff8a42 : currentEnvironment === "SPIRIT" ? 0xc9dcff : 0xffd27a;
    const night = currentDayNight === "night";
    lampGlowMat.emissive.setHex(lampColor);
    lampGlowMat.emissiveIntensity = night ? 3.2 : 0.45;
    for (const light of lampLights) {
      light.color.setHex(lampColor);
      light.intensity = night ? 7 : 0.3;
    }
  };
  const setEnvironment = (environment: EnvironmentId) => {
    currentEnvironment = environment;
    applyLampState();
  };
  const setDayNight = (phase: DayNightPhase) => {
    currentDayNight = phase;
    applyLampState();
  };

  return {
    setEnvironment,
    setDayNight,
    update(dt) {
      for (const c of cloudSeeds) c.x = ((c.x + dt * 0.6 + SPAN / 2) % SPAN + SPAN) % SPAN - SPAN / 2;
      placeClouds();
    },
  };
}
