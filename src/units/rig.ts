// Unit rig runtime (§22.1–22.3, A24, A90.1, A90.3). Units author build + pose; this module owns the
// shared mechanics only: state timing, rest-pose reset, star multiplicity, facing, locomotion rest
// height, impact hooks, speech bubbles, death and disposal. It never decides what a creature looks like.
import * as THREE from "three";
import { kitImage, label, nineSlice, SLICE } from "../ui/kit";
import { Kit, type Bucket } from "./kit";

export type ActionState = "idle" | "attack" | "skill" | "hit" | "move";
export const ACTION_STATES: readonly ActionState[] = ["idle", "attack", "skill", "hit", "move"];
export type Motion = "ground" | "hover" | "fly" | "water";
export type Star = 1 | 2 | 3;

export interface RigFx {
  /** Speech/sleep bubble above the head (asset-first tooltip chrome). */
  say(text: string, seconds?: number): void;
}

export interface PoseCtx {
  state: ActionState;
  /** Seconds since the state started. */
  t: number;
  /** One-shot states: 0..1 progress. Looping states (idle/move): t / duration, unbounded. */
  p: number;
  /** Global seconds, offset by the unit's motion signature. */
  time: number;
  /** Deterministic 0..1 per unit id: phase/speed signature so no two species share one bob. */
  sig: number;
  star: Star;
  /** 0 = primary body, 1..2 = star-multiplicity secondaries (presentation only). */
  instance: number;
  /** Alert combat stance vs relaxed inspection idle. */
  combat: boolean;
  fx: RigFx;
}

export interface BuildOpts { star: Star; skin: string | null }

export interface UnitRigDef<P> {
  id: string;
  motion: Motion;
  /** Head-top height in voxels (billboard anchor). */
  height: number;
  durations?: Partial<Record<ActionState, number>>;
  /** Normalized time of the semantic impact for attack/skill (A16: damage commits here). */
  impact?: Partial<Record<"attack" | "skill", number>>;
  build(k: Kit, o: BuildOpts): P;
  pose(r: P, c: PoseCtx): void;
}

/** Erases the per-unit part type for the registry; each def stays fully typed where authored. */
export const defineUnit = <P>(d: UnitRigDef<P>) => d as unknown as UnitRigDef<unknown>;

export const VOXEL = 0.1;
const DUR: Record<ActionState, number> = { idle: 4, attack: 0.9, skill: 1.5, hit: 0.5, move: 0.8 };
const IMPACT = { attack: 0.55, skill: 0.6 };
const REST_Y: Record<Motion, number> = { ground: 0, hover: 0.22, fly: 0.42, water: -0.03 };
const LOOPING: Record<ActionState, boolean> = { idle: true, move: true, attack: false, skill: false, hit: false };
/** A90.3 canonical local formations: [x, z, scale]. */
const FORMATION: Record<Star, [number, number, number][]> = {
  1: [[0, 0, 1]],
  2: [[-0.32, 0.04, 0.84], [0.32, -0.04, 0.84]],
  3: [[0, 0.18, 0.78], [-0.4, -0.14, 0.68], [0.4, -0.14, 0.68]],
};
const DEATH_S = 0.6;

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false }),
};

/** A90.3 visible creature count from star + HP ratio. */
export function visibleBodies(star: Star, hpRatio: number): number {
  if (!(hpRatio > 0)) return 0;
  if (star === 1) return 1;
  if (star === 2) return hpRatio > 2 / 3 ? 2 : 1;
  return hpRatio > 2 / 3 ? 3 : hpRatio > 1 / 3 ? 2 : 1;
}

function signature(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10007) / 10007;
}

interface Body {
  group: THREE.Group;
  parts: P0;
  rest: { o: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[];
}
type P0 = unknown;

export interface PlayOpts { onImpact?: () => void; onDone?: () => void; duration?: number }

export interface UnitVisual {
  readonly id: string;
  readonly star: Star;
  /** Gameplay anchor: position this at the cell/staging point; never offset by animation. */
  root: THREE.Group;
  /** Head-top anchor for billboards / floating text, follows root. */
  anchor: THREE.Object3D;
  play(state: ActionState, o?: PlayOpts): void;
  state(): ActionState;
  setCombat(v: boolean): void;
  /** Yaw in radians; L side faces +x (enemy), R side faces -x. */
  setFacing(side: "L" | "R" | number): void;
  setHpRatio(r: number): void;
  die(onDone?: () => void): void;
  update(dt: number): void;
  dispose(): void;
}

export function createUnitVisual(def: UnitRigDef<unknown>, star: Star, skin: string | null = null): UnitVisual {
  const root = new THREE.Group();
  root.name = `unit:${def.id}`;
  const anchor = new THREE.Object3D();
  anchor.position.y = def.height * VOXEL + 0.18 + REST_Y[def.motion];
  root.add(anchor);
  const geos: THREE.BufferGeometry[] = [];
  const sig = signature(def.id);

  const bodies: Body[] = FORMATION[star].map(([x, z, s], i) => {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(VOXEL);
    group.add(inner);
    group.position.set(x, REST_Y[def.motion], z);
    group.scale.setScalar(s);
    group.name = `body${i}`;
    const k = new Kit(inner);
    const parts = def.build(k, { star, skin });
    for (const p of k.parts) p.bake(MATS, geos);
    const rest: Body["rest"] = [];
    inner.traverse((o) => { if (o !== inner) rest.push({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }); });
    root.add(group);
    return { group, parts, rest };
  });

  // Speech bubble: one reusable sprite + canvas, redrawn only when text changes.
  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = 256; bubbleCanvas.height = 96;
  const bubbleTex = new THREE.CanvasTexture(bubbleCanvas);
  bubbleTex.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex, depthWrite: false, transparent: true }));
  bubble.scale.set(1.2, 0.45, 1);
  bubble.position.y = anchor.position.y + 0.35;
  bubble.visible = false;
  bubble.raycast = () => {};
  root.add(bubble);
  let bubbleLeft = 0;
  const fx: RigFx = {
    say(text, seconds = 2.4) {
      const g = bubbleCanvas.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, 256, 96);
      g.imageSmoothingEnabled = false;
      if (kitImage("panel_tooltip")) nineSlice(g, "panel_tooltip", SLICE.panel_tooltip, 4, 4, 248, 76, 3);
      label(g, text, 128, 42, { size: 24, fill: "#3b2414", stroke: null, weight: 800, maxW: 228 });
      bubbleTex.needsUpdate = true;
      bubble.visible = true;
      bubbleLeft = seconds;
    },
  };

  let state: ActionState = "idle", t = 0, time = sig * 10, combat = false, alive = true;
  let visible = bodies.length, impactFired = false, opts: PlayOpts = {}, dur = DUR.idle;
  let dying = -1, onDeath: (() => void) | undefined;

  const durationOf = (s: ActionState) => def.durations?.[s] ?? DUR[s];

  return {
    id: def.id, star, root, anchor,
    play(s, o = {}) {
      if (!alive) return;
      state = s; t = 0; impactFired = false; opts = o;
      dur = o.duration ?? durationOf(s);
    },
    state: () => state,
    setCombat(v) { combat = v; },
    setFacing(side) { root.rotation.y = typeof side === "number" ? side : side === "L" ? Math.PI / 2 : -Math.PI / 2; },
    setHpRatio(r) {
      visible = visibleBodies(star, r);
      bodies.forEach((b, i) => { b.group.visible = i < visible; });
    },
    die(cb) { if (!alive) return; alive = false; dying = 0; onDeath = cb; },
    update(rawDt) {
      const dt = Math.max(0, Math.min(rawDt, 0.1));
      time += dt;
      if (bubble.visible && (bubbleLeft -= dt) <= 0) bubble.visible = false;
      if (dying >= 0) {
        dying += dt;
        const k = Math.min(1, dying / DEATH_S);
        for (const b of bodies) { b.group.rotation.z = k * 1.2; b.group.position.y = REST_Y[def.motion] - k * 0.35; }
        root.scale.setScalar(1 - k * 0.6);
        if (k >= 1 && root.visible) { root.visible = false; anchor.visible = false; onDeath?.(); onDeath = undefined; }
        return;
      }
      t += dt;
      const looping = LOOPING[state];
      const p = looping ? t / dur : Math.min(1, t / dur);
      if (!looping) {
        const at = state === "attack" || state === "skill" ? def.impact?.[state] ?? IMPACT[state] : 1;
        if (!impactFired && p >= at) { impactFired = true; opts.onImpact?.(); }
        if (p >= 1) {
          const done = opts.onDone;
          state = "idle"; t = 0; dur = durationOf("idle"); opts = {};
          done?.();
        }
      }
      for (let i = 0; i < visible; i++) {
        const b = bodies[i]!;
        for (const r of b.rest) { r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); }
        // Secondaries offset their local performance slightly; they never trigger impacts.
        const off = i * 0.13;
        const pp = looping ? p + off : Math.max(0, Math.min(1, p - off * 0.5));
        def.pose(b.parts, { state, t, p: pp, time: time + off * 3, sig, star, instance: i, combat, fx: i === 0 ? fx : { say() {} } });
      }
    },
    dispose() {
      for (const g of geos) g.dispose();
      bubbleTex.dispose();
      (bubble.material as THREE.SpriteMaterial).dispose();
      root.removeFromParent();
    },
  };
}

// ---------- shared pose math (generic interpolation only; authored poses live in each unit) ----------

/** 0→1→0 bell over [a,b] (smooth). */
export function bell(p: number, a = 0, b = 1): number {
  if (p <= a || p >= b) return 0;
  const x = (p - a) / (b - a);
  return Math.sin(x * Math.PI);
}
/** Smooth 0→1 ramp over [a,b]. */
export function ramp(p: number, a: number, b: number): number {
  const x = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
/** Anticipation → strike → recover curve used by most attacks: negative windup, sharp peak at `hit`. */
export function strike(p: number, hit = 0.55): number {
  if (p < hit * 0.7) return -0.35 * ramp(p, 0, hit * 0.7);
  if (p < hit) return -0.35 + 1.35 * ramp(p, hit * 0.7, hit);
  return 1 - ramp(p, hit, 1);
}
