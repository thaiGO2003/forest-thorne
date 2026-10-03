// Voxel unit kit (spec 22.1, A24). Shared *parts*, never shared finished animals.
// Authoring space: 1 voxel = 1/16 world block, +z = front, y = 0 = ground. Each part is a pivot
// group at its joint holding one merged vertex-coloured mesh; species code animates pivots only.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const VOX = 1 / 16;
/** [x, y, z, w, h, d, colour] — box centre relative to the part pivot, in voxels. */
export type Box = readonly [number, number, number, number, number, number, number];
export type ActionState = "idle" | "attack" | "skill" | "hit" | "move";
export const ACTION_STATES: readonly ActionState[] = ["idle", "attack", "skill", "hit", "move"];
/** Loop length per state in seconds; preview cadence ≈ 5 s for idle (A24). */
export const ACTION_S: Record<ActionState, number> = { idle: 5, attack: 1.2, skill: 2, hit: 0.6, move: 1 };

export interface UnitModel {
  root: THREE.Group;
  /** Named VFX/impact anchors (muzzle, mouth, tail tip…). */
  anchors: Record<string, THREE.Object3D>;
  state: ActionState;
  setState(s: ActionState): void;
  update(dt: number): void;
  dispose(): void;
}

export interface Rig {
  part(name: string, pivot: readonly [number, number, number], boxes: readonly Box[], parent?: string): THREE.Group;
  anchor(name: string, at: readonly [number, number, number], parent: string): void;
  p: Record<string, THREE.Group>;
}

/** Mirror boxes across x = 0 (left/right pairs authored once). */
export const mirror = (b: readonly Box[]): Box[] => b.map(([x, y, z, w, h, d, c]) => [-x, y, z, w, h, d, c] as const);

/** Per-frame pose: t = seconds in state, k = 0..1 loop progress, sig = per-unit phase seed. */
export type Pose = (p: Record<string, THREE.Group>, s: ActionState, t: number, k: number, sig: number) => void;

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const col = new THREE.Color();

export function buildUnit(id: string, sig: number, author: (r: Rig) => Pose, glow = 0): UnitModel {
  const root = new THREE.Group();
  root.name = `unit:${id}`;
  const body = new THREE.Group();
  body.scale.setScalar(VOX);
  root.add(body);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.02, flatShading: true });
  if (glow) { mat.emissive.setHex(glow); mat.emissiveIntensity = 0.35; }
  const geos: THREE.BufferGeometry[] = [];
  const p: Record<string, THREE.Group> = {};
  const anchors: Record<string, THREE.Object3D> = {};
  const rest: { g: THREE.Group; pos: THREE.Vector3; rot: THREE.Euler; scl: THREE.Vector3 }[] = [];

  const rig: Rig = {
    p,
    part(name, [px, py, pz], boxes, parent) {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(px, py, pz);
      (parent ? p[parent] : body).add(g);
      p[name] = g;
      rest.push({ g, pos: g.position.clone(), rot: g.rotation.clone(), scl: g.scale.clone() });
      if (!boxes.length) return g;
      const parts = boxes.map(([x, y, z, w, h, d, c]) => {
        const b = unitBox.clone().scale(w, h, d).translate(x, y, z);
        col.setHex(c);
        const n = b.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
        b.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        return b;
      });
      const merged = mergeGeometries(parts);
      for (const b of parts) b.dispose();
      if (!merged) throw new Error(`unit ${id}: part ${name} failed to merge`);
      geos.push(merged);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return g;
    },
    anchor(name, [x, y, z], parent) {
      const a = new THREE.Object3D();
      a.name = name;
      a.position.set(x, y, z);
      p[parent].add(a);
      anchors[name] = a;
    },
  };
  const pose = author(rig);

  let t = 0;
  const model: UnitModel = {
    root,
    anchors,
    state: "idle",
    setState(s) { model.state = s; t = 0; },
    update(dt) {
      t += dt;
      for (const r of rest) { r.g.position.copy(r.pos); r.g.rotation.copy(r.rot); r.g.scale.copy(r.scl); }
      const len = ACTION_S[model.state];
      pose(p, model.state, t, (t % len) / len, sig);
    },
    dispose() {
      for (const g of geos) g.dispose();
      mat.dispose();
      root.removeFromParent();
    },
  };
  model.update(0);
  return model;
}

/** Deterministic 0..1 phase seed per uid so twin units never bob in lockstep (22.3). */
export function signature(uid: string): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** One-shot envelope over k∈[0,1]: wind-up to −0.4 by a, snap to +1 by b, ease back to 0. */
export function strike(k: number, a = 0.35, b = 0.55): number {
  if (k < a) return -0.4 * Math.sin((k / a) * Math.PI * 0.5);
  if (k < b) return -0.4 + 1.4 * Math.sin(((k - a) / (b - a)) * Math.PI * 0.5);
  return Math.cos(((k - b) / (1 - b)) * Math.PI * 0.5);
}

/** sin wave at hz, phase-shifted by sig (0..1 of a cycle). */
export const wave = (t: number, hz: number, sig = 0) => Math.sin((t * hz + sig) * Math.PI * 2);
