// Voxel arena (spec 11.7, A91.2–A91.5). One block = 1 world unit. Visual column 5 (river) sits at world x=0.
// Owns every GPU resource it creates; dispose() releases all of them.
import * as THREE from "three";
import { benchPerimeter, brownRing, riverCells, toLogical, totalRows, VISUAL_COLS, type Cell, type Profile } from "../board/geometry";
import { createScenery } from "./scenery";
import { createSky } from "./sky";
import type { EnvironmentId } from "../core/environment";
import type { DayNightPhase } from "../core/dayNight";

export const BLOCK = 1;
const TILE_H = 0.12;
const FLOW_SPEED = 0.62;

export type LightPhase = "menu" | "planning" | "combat";
export type ShadowQuality = "low" | "medium" | "high";
const LIGHT_PRESETS: Record<LightPhase, { hemi: number; sun: number; rim: number; fog: [number, number]; sky: number }> = {
  menu: { hemi: 0.9, sun: 1.6, rim: 0.3, fog: [40, 110], sky: 0x9fd3ff },
  planning: { hemi: 1.0, sun: 2.0, rim: 0.25, fog: [45, 120], sky: 0xa8dcff },
  combat: { hemi: 0.65, sun: 2.4, rim: 0.7, fog: [35, 95], sky: 0x8cb8e0 },
};

export type TacticalHighlightRole = "hover" | "source" | "valid" | "invalid" | "direct" | "area";
export interface TacticalHighlightCell {
  col: number;
  row: number;
  role: TacticalHighlightRole;
}
export interface BenchHighlightSlot {
  index: number;
  role: TacticalHighlightRole;
}

const HIGHLIGHT_COLORS: Record<TacticalHighlightRole, number> = {
  hover: 0xb9e978,
  source: 0xffe176,
  valid: 0x7fe39a,
  invalid: 0xe66c65,
  direct: 0xff3b30,
  area: 0xffd43b,
};

const HIGHLIGHT_PRIORITY = {
  hover: 1,
  source: 2,
  valid: 3,
  invalid: 4,
  area: 5,
  direct: 6,
} satisfies Record<TacticalHighlightRole, number>;

const ENVIRONMENT_LIGHT: Record<EnvironmentId, { sky: number; hemi: number; sun: number; rim: number; gain: number }> = {
  FIRE: { sky: 0xd6a27c, hemi: 0xffddbd, sun: 0xffad66, rim: 0xff7447, gain: 0.95 },
  TIDE: { sky: 0x82bddb, hemi: 0xdff5ff, sun: 0xe7f6ff, rim: 0x70b8e8, gain: 0.95 },
  WIND: { sky: 0xa8d9d1, hemi: 0xe9fff9, sun: 0xf6fff1, rim: 0x8bd8c5, gain: 1 },
  STONE: { sky: 0xb7b4a4, hemi: 0xf0ead8, sun: 0xffefd1, rim: 0xb4aa93, gain: 0.9 },
  NIGHT: { sky: 0x17233e, hemi: 0x7187bd, sun: 0x8fa6d8, rim: 0xa9bdff, gain: 0.45 },
  SWARM: { sky: 0xb9c889, hemi: 0xf1f4c9, sun: 0xe9e3a8, rim: 0xa9bf63, gain: 0.9 },
  SPIRIT: { sky: 0x8f9ed0, hemi: 0xe7e4ff, sun: 0xf0e8ff, rim: 0xc7b5ff, gain: 0.8 },
  WOOD: { sky: 0x9fcfa7, hemi: 0xe3f4d6, sun: 0xf2e4b8, rim: 0x8dbb78, gain: 0.95 },
};

/** Visual grid cell → world centre (x,z). */
export function cellToWorld(c: Cell, p: Profile): { x: number; z: number } {
  return { x: (c.x - (VISUAL_COLS - 1) / 2) * BLOCK, z: (c.z - (totalRows(p) - 1) / 2) * BLOCK };
}

/** World point → logical cell. River interior (|x| < BLOCK/2) and off-board points return null. */
export function worldToLogical(x: number, z: number, p: Profile) {
  if (Math.abs(x) < BLOCK / 2) return null;
  const visualX = Math.round(x / BLOCK + (VISUAL_COLS - 1) / 2);
  const visualZ = Math.round(z / BLOCK + (totalRows(p) - 1) / 2);
  return toLogical(Object.is(visualX, -0) ? 0 : visualX, Object.is(visualZ, -0) ? 0 : visualZ, p);
}

export interface Arena {
  root: THREE.Group;
  /** Raycast-only tactical tiles; river is intentionally excluded. */
  tiles: THREE.InstancedMesh;
  setPhase(phase: LightPhase): void;
  setEnvironment(environment: EnvironmentId): void;
  setDayNight(phase: DayNightPhase): void;
  setHighlights(cells: readonly TacticalHighlightCell[]): void;
  clearHighlights(): void;
  setBenchHighlights(slots: readonly BenchHighlightSlot[]): void;
  clearBenchHighlights(): void;
  setOccupied(col: number, row: number, occupied: boolean): void;
  setShadowQuality(q: ShadowQuality): void;
  setShadowsEnabled(enabled: boolean): void;
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
  const instancePosition = new THREE.Vector3();
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

  // Tactical top tiles: checker grass stays visible even while occupied.
  const grassA = new THREE.Color(0x6fbf4a), grassB = new THREE.Color(0x5fae3e);
  const tiles = new THREE.InstancedMesh(tileGeo, mat(0xffffff), 10 * rows);
  const tileIndex: Record<string, number> = {};
  const logicalByIndex: Array<{ col: number; row: number }> = [];
  n = 0;
  for (let x = 0; x < VISUAL_COLS; x++) for (let z = 0; z < rows; z++) {
    const l = toLogical(x, z, p);
    if (!l) continue;
    const w = cellToWorld({ x, z }, p);
    tiles.setMatrixAt(n, m4.makeTranslation(w.x, TILE_H / 2, w.z));
    tiles.setColorAt(n, (l.col + l.row) % 2 ? grassA : grassB);
    tileIndex[`${l.col},${l.row}`] = n++;
    logicalByIndex[n - 1] = { col: l.col, row: l.row };
  }
  tiles.receiveShadow = true;
  tiles.name = "tactical-tiles";
  root.add(tiles);

  // Grass tufts on free tiles; hidden per tile when occupied.
  const tuftGeo = own(new THREE.ConeGeometry(0.06, 0.22, 4));
  const tufts = new THREE.InstancedMesh(tuftGeo, mat(0x86d45a), n * 3);
  const tuftOffsets = [[-0.28, -0.22], [0.25, 0.1], [-0.05, 0.3]] as const;
  for (let i = 0; i < n; i++) {
    tiles.getMatrixAt(i, m4);
    instancePosition.setFromMatrixPosition(m4);
    for (let k = 0; k < 3; k++) {
      const [ox, oz] = tuftOffsets[k]!;
      tufts.setMatrixAt(i * 3 + k, m4.makeTranslation(instancePosition.x + ox, TILE_H + 0.1, instancePosition.z + oz));
    }
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
  const ring = ringTiles(brownRing(p), 0x8a5a34, TILE_H / 2);
  ring.name = "brown-ring";
  const benchCells = benchPerimeter(p);
  const bench = ringTiles(benchCells, 0xb48a5c, TILE_H / 2 + 0.02);
  bench.name = "bench-perimeter";
  const benchHighlightGeo = own(new THREE.BoxGeometry(BLOCK * 0.88, 0.035, BLOCK * 0.88));
  const benchHighlights = new THREE.InstancedMesh(
    benchHighlightGeo,
    mat(0xffffff, { transparent: true, opacity: 0.76, depthWrite: false }),
    benchCells.length,
  );
  benchHighlights.count = 0;
  benchHighlights.name = "bench-highlights";
  benchHighlights.raycast = () => {};
  root.add(benchHighlights);

  // River: water strip, 7 flow markers, 3 lily pads. Not raycastable.
  const riverLen = riverCells(p).length * BLOCK;
  const waterMat = mat(0x3aa0d8, { roughness: 0.25, metalness: 0.1 });
  const water = new THREE.Mesh(own(new THREE.BoxGeometry(BLOCK, 0.5, riverLen)), waterMat);
  water.name = "river-water";
  water.position.set(0, -0.3, 0);
  water.raycast = () => {};
  root.add(water);
  const markerGeo = own(new THREE.BoxGeometry(0.08, 0.02, 0.35));
  const markerMat = mat(0xd8f2ff, { transparent: true, opacity: 0.7 });
  const markers = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(markerGeo, markerMat);
    m.name = "river-flow-marker";
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
  const sky = createSky(root, own);
  const rayUniforms = {
    time: { value: 0 },
    strength: { value: 0.18 },
    tint: { value: new THREE.Color(0xffd39a) },
  };
  const rayGeo = own(new THREE.PlaneGeometry(Math.max(40, rows * 2), Math.max(28, (rows + 4) * 2)));
  const rayMat = own(new THREE.ShaderMaterial({
    uniforms: rayUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float strength;
      uniform vec3 tint;
      varying vec2 vUv;
      void main() {
        float edgeFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.78, 1.0, vUv.y));
        float bands = 0.55 + 0.45 * sin(vUv.x * 34.0 + time * 0.7);
        bands *= 0.72 + 0.28 * sin(vUv.x * 79.0 - time * 0.43);
        float alpha = strength * edgeFade * smoothstep(0.18, 0.95, bands);
        gl_FragColor = vec4(tint, alpha);
      }
    `,
  }));
  const sunRays = new THREE.Group();
  sunRays.name = "sun-rays";
  for (const yaw of [-0.38, 0.62]) {
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.rotation.set(-0.72, yaw, -0.18);
    ray.position.set(-2.5, 10.5, 0);
    ray.raycast = () => {};
    sunRays.add(ray);
  }
  root.add(sunRays);

  // One owned lighting rig, retuned per phase (A91.5).
  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5b4a2e, 1);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  const half = Math.max(VISUAL_COLS, rows) / 2 + 3;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 50 });
  sun.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.3);
  rim.position.set(10, 6, -12);
  root.add(hemi, sun, rim);
  const fog = new THREE.Fog(0xa8dcff, 45, 120);
  const background = new THREE.Color(0xa8dcff);
  const previousFog = scene.fog;
  const previousBackground = scene.background;
  scene.fog = fog;
  scene.background = background;

  let currentPhase: LightPhase = "planning";
  let currentEnvironment: EnvironmentId = "FIRE";
  let currentDayNight: DayNightPhase = "day";
  let rayQualityGain = 1;
  let shadowQuality: ShadowQuality = "high";
  let shadowsEnabled = true;
  const applyLighting = () => {
    const phase = LIGHT_PRESETS[currentPhase];
    const environment = ENVIRONMENT_LIGHT[currentEnvironment];
    const night = currentDayNight === "night";
    const dayGain = night ? 0.58 : 1;
    hemi.intensity = phase.hemi * environment.gain * dayGain;
    sun.intensity = phase.sun * environment.gain * (night ? 0.42 : 1);
    rim.intensity = phase.rim * environment.gain * (night ? 1.6 : 1);
    hemi.color.setHex(environment.hemi);
    sun.color.setHex(environment.sun);
    rim.color.setHex(environment.rim);
    rayUniforms.tint.value.setHex(night ? 0x9fb6e8 : 0xffd39a);
    rayUniforms.strength.value = 0.18 * rayQualityGain * environment.gain * (night ? 0.22 : 1);
    [fog.near, fog.far] = phase.fog;
    fog.color.setHex(environment.sky).multiplyScalar(night ? 0.46 : 1);
    background.setHex(environment.sky).multiplyScalar(night ? 0.46 : 1);
  };

  const highlighted = new Set<number>();
  const highlightColor = new THREE.Color();
  const appliedPriority = new Uint8Array(tiles.count);
  const restoreHighlights = () => {
    if (highlighted.size === 0) return false;
    for (const i of highlighted) {
      const cell = logicalByIndex[i];
      if (cell) tiles.setColorAt(i, (cell.col + cell.row) % 2 ? grassA : grassB);
      appliedPriority[i] = 0;
    }
    highlighted.clear();
    return true;
  };

  scenery.setEnvironment(currentEnvironment);
  sky.setEnvironment(currentEnvironment);
  applyLighting();

  let flowT = 0;
  return {
    root,
    tiles,
    setPhase(phase) {
      currentPhase = phase;
      applyLighting();
    },
    setEnvironment(environment) {
      currentEnvironment = environment;
      scenery.setEnvironment(environment);
      sky.setEnvironment(environment);
      applyLighting();
    },
    setDayNight(phase) {
      currentDayNight = phase;
      scenery.setDayNight(phase);
      sky.setDayNight(phase);
      applyLighting();
    },
    setHighlights(cells) {
      let changed = restoreHighlights();
      for (const cell of cells) {
        const i = tileIndex[`${cell.col},${cell.row}`];
        if (i === undefined) continue;
        const priority = HIGHLIGHT_PRIORITY[cell.role];
        if (priority <= appliedPriority[i]!) continue;
        tiles.setColorAt(i, highlightColor.setHex(HIGHLIGHT_COLORS[cell.role]));
        appliedPriority[i] = priority;
        highlighted.add(i);
        changed = true;
      }
      if (changed && tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    },
    clearHighlights() {
      if (restoreHighlights() && tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    },
    setBenchHighlights(slots) {
      let count = 0;
      for (const slot of slots) {
        const cell = benchCells[slot.index];
        if (!cell) continue;
        const w = cellToWorld(cell, p);
        benchHighlights.setMatrixAt(count, m4.makeTranslation(w.x, TILE_H + 0.075, w.z));
        benchHighlights.setColorAt(count, highlightColor.setHex(HIGHLIGHT_COLORS[slot.role]));
        count++;
      }
      benchHighlights.count = count;
      benchHighlights.instanceMatrix.needsUpdate = true;
      if (benchHighlights.instanceColor) benchHighlights.instanceColor.needsUpdate = true;
    },
    clearBenchHighlights() {
      if (benchHighlights.count === 0) return;
      benchHighlights.count = 0;
      benchHighlights.instanceMatrix.needsUpdate = true;
    },
    setOccupied(col, row, occupied) {
      const i = tileIndex[`${col},${row}`];
      if (i === undefined) return;
      tiles.getMatrixAt(i, m4);
      instancePosition.setFromMatrixPosition(m4);
      for (let k = 0; k < 3; k++) {
        const [ox, oz] = tuftOffsets[k]!;
        tufts.setMatrixAt(i * 3 + k, m4.makeTranslation(instancePosition.x + ox, occupied ? -10 : TILE_H + 0.1, instancePosition.z + oz));
      }
      tufts.instanceMatrix.needsUpdate = true;
    },
    setShadowQuality(q) {
      shadowQuality = q;
      sun.castShadow = shadowsEnabled && q !== "low";
      sunRays.visible = q !== "low";
      rayQualityGain = q === "high" ? 1 : q === "medium" ? 0.6 : 0;
      const size = q === "high" ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(size, size);
      }
      applyLighting();
    },
    setShadowsEnabled(enabled) {
      shadowsEnabled = enabled;
      sun.castShadow = enabled && shadowQuality !== "low";
    },
    update(dt) {
      flowT += Math.max(0, dt) * FLOW_SPEED;
      rayUniforms.time.value += Math.max(0, dt);
      scenery.update(Math.max(0, dt));
      sky.update(Math.max(0, dt));
      markers.forEach((m, i) => {
        m.position.z = ((((i + 0.5) * riverLen) / 7 + flowT) % riverLen + riverLen) % riverLen - riverLen / 2;
      });
    },
    dispose() {
      restoreHighlights();
      sun.shadow.map?.dispose();
      for (const d of disposables) d.dispose();
      for (const o of [soil, tiles, tufts, ring, bench, benchHighlights]) o.dispose();
      scene.remove(root);
      if (scene.fog === fog) scene.fog = previousFog;
      if (scene.background === background) scene.background = previousBackground;
    },
  };
}
