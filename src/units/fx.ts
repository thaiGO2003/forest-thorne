// Combat presentation FX (§38, §39, §50.3, A16, A112): pooled world-space floating numbers, impact
// bursts and projectiles. Pools are allocated once; nothing allocates per frame. Visual only —
// every value shown here comes from an already-resolved canonical combat event.
import * as THREE from "three";
import { label } from "../ui/kit";

export type FloatKind = "damage" | "crit" | "heal" | "shield" | "miss" | "status" | "dot";
const FLOAT_STYLE: Record<FloatKind, { fill: string; size: number }> = {
  damage: { fill: "#fff1e0", size: 40 }, crit: { fill: "#ffcf3a", size: 54 }, heal: { fill: "#7cf06a", size: 40 },
  shield: { fill: "#9fd8ff", size: 36 }, miss: { fill: "#d8d0c4", size: 32 }, status: { fill: "#e6b8ff", size: 30 },
  dot: { fill: "#c6ff7a", size: 34 },
};
const FLOAT_POOL = 32, FLOAT_LIFE = 0.9, FLOAT_RISE = 0.7;
const BURST_POOL = 12, BURST_BITS = 10, BURST_LIFE = 0.45;
const SHOT_POOL = 12;

interface Float { sprite: THREE.Sprite; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; t: number; from: THREE.Vector3; drift: number }
interface Burst { mesh: THREE.InstancedMesh; t: number; at: THREE.Vector3; vel: THREE.Vector3[]; color: THREE.Color }
interface Shot { mesh: THREE.Mesh; t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; arc: number; done?: () => void }

export interface CombatFx {
  float(at: THREE.Vector3, text: string, kind: FloatKind): void;
  burst(at: THREE.Vector3, color: number): void;
  /** Projectile from → to over `seconds`; `onArrive` is the semantic impact point (A16). */
  shot(from: THREE.Vector3, to: THREE.Vector3, color: number, seconds: number, onArrive: () => void, arc?: number): void;
  /** Hit jolt (A112.1): push `root` away from `fromX` briefly, restoring origin; only for real HP damage. */
  jolt(root: THREE.Object3D, fromX: number, speed: number): void;
  update(dt: number): void;
  dispose(): void;
}

const JOLT_DIST = 0.12, JOLT_LEG = 0.065;

export function createCombatFx(scene: THREE.Scene): CombatFx {
  const group = new THREE.Group();
  group.name = "combat-fx";
  scene.add(group);

  const floats: Float[] = Array.from({ length: FLOAT_POOL }, () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 96;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(1.0, 0.375, 1);
    sprite.renderOrder = 20;
    sprite.visible = false;
    sprite.raycast = () => {};
    group.add(sprite);
    return { sprite, canvas, tex, t: -1, from: new THREE.Vector3(), drift: 0 };
  });
  let nextFloat = 0;

  const bitGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const bitMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  const bursts: Burst[] = Array.from({ length: BURST_POOL }, () => {
    const mesh = new THREE.InstancedMesh(bitGeo, bitMat, BURST_BITS);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    group.add(mesh);
    return { mesh, t: -1, at: new THREE.Vector3(), vel: Array.from({ length: BURST_BITS }, () => new THREE.Vector3()), color: new THREE.Color() };
  });
  let nextBurst = 0;

  const shotGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const shots: Shot[] = Array.from({ length: SHOT_POOL }, () => {
    const mesh = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ toneMapped: false }));
    mesh.visible = false;
    mesh.raycast = () => {};
    group.add(mesh);
    return { mesh, t: -1, dur: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), arc: 0 };
  });
  let nextShot = 0;

  const jolts = new Map<THREE.Object3D, { t: number; origin: THREE.Vector3; dir: number; leg: number }>();

  return {
    float(at, text, kind) {
      const f = floats[nextFloat]!;
      nextFloat = (nextFloat + 1) % FLOAT_POOL;
      const st = FLOAT_STYLE[kind], g = f.canvas.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, 256, 96);
      label(g, text, 128, 48, { size: st.size, fill: st.fill, weight: 900, maxW: 248 });
      f.tex.needsUpdate = true;
      f.from.copy(at);
      f.drift = (Math.random() - 0.5) * 0.3; // presentation-only jitter; never gameplay RNG
      f.t = 0;
      f.sprite.visible = true;
      f.sprite.position.copy(at);
    },
    burst(at, color) {
      const b = bursts[nextBurst]!;
      nextBurst = (nextBurst + 1) % BURST_POOL;
      b.at.copy(at);
      b.color.setHex(color);
      (b.mesh.material as THREE.MeshBasicMaterial).color.copy(b.color);
      for (const vel of b.vel) vel.set(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5).multiplyScalar(2.6);
      b.t = 0;
      b.mesh.visible = true;
    },
    shot(from, to, color, seconds, onArrive, arc = 0.6) {
      const s = shots[nextShot]!;
      nextShot = (nextShot + 1) % SHOT_POOL;
      s.done?.(); // a recycled in-flight shot still resolves its impact (never drop a canonical hit)
      s.from.copy(from); s.to.copy(to);
      s.dur = Math.max(0.05, seconds); s.arc = arc; s.t = 0; s.done = onArrive;
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      s.mesh.visible = true;
      s.mesh.position.copy(from);
    },
    jolt(root, fromX, speed) {
      const prev = jolts.get(root);
      if (prev) root.position.copy(prev.origin); // restore before restarting (A112.1)
      jolts.set(root, { t: 0, origin: root.position.clone(), dir: root.position.x >= fromX ? 1 : -1, leg: JOLT_LEG / Math.max(0.1, speed) });
    },
    update(rawDt) {
      const dt = Math.max(0, Math.min(rawDt, 0.1));
      for (const f of floats) {
        if (f.t < 0) continue;
        f.t += dt;
        const k = f.t / FLOAT_LIFE;
        if (k >= 1) { f.t = -1; f.sprite.visible = false; continue; }
        f.sprite.position.set(f.from.x + f.drift * k, f.from.y + FLOAT_RISE * (1 - (1 - k) * (1 - k)), f.from.z);
        const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.5);
        f.sprite.scale.set(pop, pop * 0.375, 1);
        (f.sprite.material as THREE.SpriteMaterial).opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      }
      for (const b of bursts) {
        if (b.t < 0) continue;
        b.t += dt;
        const k = b.t / BURST_LIFE;
        if (k >= 1) { b.t = -1; b.mesh.visible = false; continue; }
        const sc = 1 - k;
        b.vel.forEach((vel, i) => {
          v.copy(vel).multiplyScalar(b.t).add(b.at);
          v.y -= 4 * b.t * b.t;
          b.mesh.setMatrixAt(i, m4.makeScale(sc, sc, sc).setPosition(v));
        });
        b.mesh.instanceMatrix.needsUpdate = true;
      }
      for (const s of shots) {
        if (s.t < 0) continue;
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.mesh.position.lerpVectors(s.from, s.to, k);
        s.mesh.position.y += Math.sin(k * Math.PI) * s.arc;
        s.mesh.rotation.set(s.t * 9, s.t * 7, 0);
        if (k >= 1) { s.t = -1; s.mesh.visible = false; const d = s.done; s.done = undefined; d?.(); }
      }
      for (const [root, j] of jolts) {
        j.t += dt;
        const k = j.t / j.leg;
        if (k >= 2) { root.position.copy(j.origin); jolts.delete(root); continue; }
        root.position.x = j.origin.x + j.dir * JOLT_DIST * (k < 1 ? k : 2 - k);
      }
    },
    dispose() {
      for (const s of shots) s.done = undefined;
      for (const [root, j] of jolts) root.position.copy(j.origin);
      jolts.clear();
      for (const f of floats) { f.tex.dispose(); (f.sprite.material as THREE.SpriteMaterial).dispose(); }
      for (const b of bursts) b.mesh.dispose();
      for (const s of shots) (s.mesh.material as THREE.Material).dispose();
      bitGeo.dispose(); bitMat.dispose(); shotGeo.dispose();
      group.removeFromParent();
    },
  };
}
