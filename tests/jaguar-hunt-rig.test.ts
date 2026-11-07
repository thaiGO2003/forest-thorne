import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import { createUnitVisual, type ActionState, type DeathCtx, type PoseCtx, type Star, type UnitDeathDef } from "../src/units/rig";
import jaguar from "../src/units/roster/jaguarHunt";
import { createUnit } from "../src/units/registry";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = jaguar.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = jaguar.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.37, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); jaguar.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 3, sig: 0.37, star, instance: 0 };
    death.pose(parts, c);
    root.updateMatrixWorld(true);
  };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  const minY = () => new THREE.Box3().setFromObject(root, true).min.y;
  return { kit, root, pose, die, ctx, snapshot, part, minY };
}

const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Báo Đốm Săn rig contract", () => {
  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.13, 0.5, 0.62, 0.87, 1]) {
      a.pose(a.ctx(state, p, 7.3, combat));
      b.pose(b.ctx(state, p, 7.3, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states (no foot sinking)", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.4, 2.9, 6.1]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(-0.15);
      }
    }
  });

  it("death ends lying on the flank at p=1 without NaN or ground penetration", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(-0.15);
      }
      r.die(1);
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
      expect(r.part("torso").rotation.z).toBeCloseTo(Math.PI / 2);
      expect(r.part("torso").position.y).toBeLessThan(3);
    }
  });

  it("keeps planted paws still during relaxed idle (no foot sliding)", () => {
    const r = rig();
    const paws = ["fpaw1", "fpaw-1", "hpaw1", "hpaw-1"];
    // Sole centre in paw space (the paw pivot itself is the knee, which is allowed to fold).
    const at = (name: string) => r.part(name).localToWorld(new THREE.Vector3(0, -2, 0));
    r.pose(r.ctx("idle", 1, 0));
    const home = paws.map(at);
    for (const p of SAMPLES) {
      r.pose(r.ctx("idle", p, p * 5));
      paws.forEach((n, i) => expect(at(n).distanceTo(home[i]!), `${n}@${p}`).toBeLessThan(0.3));
    }
  });

  it("separates walk and run gaits", () => {
    const r = rig();
    r.pose(r.ctx("move", 0.3, 1, false));
    const walk = r.snapshot(), walkEar = r.part("earL").rotation.x, walkY = r.part("torso").position.y;
    r.pose(r.ctx("move", 0.3, 1, true));
    expect(r.snapshot()).not.toEqual(walk);
    expect(r.part("earL").rotation.x).toBeLessThan(walkEar - 0.3); // ears pinned at speed
    expect(r.part("torso").position.y).toBeGreaterThan(walkY + 0.25); // gallop is airborne, walk is not
    // Out of combat the walk breaks into the gallop after sustained movement.
    r.pose(r.ctx("move", 2.3, 1, false));
    const late = r.snapshot();
    r.pose(r.ctx("move", 2.3, 1, true));
    expect(r.snapshot()).toEqual(late);
    expect(walkY).toBeLessThan(5.95 + 0.15);
  });

  it("rakes the lead paw on an arc that never passes through the head or jaw", () => {
    const r = rig();
    const box = (name: string) => {
      const b = new THREE.Box3();
      r.part(name).children.forEach((o) => { if (o instanceof THREE.Mesh) b.expandByObject(o, true); });
      return b;
    };
    let raised = 0;
    for (const p of SAMPLES) {
      r.pose(r.ctx("attack", p, 1));
      const paw = box("fpaw1");
      raised = Math.max(raised, paw.min.y);
      expect(paw.intersectsBox(box("head")), `head@${p}`).toBe(false);
      expect(paw.intersectsBox(box("jaw")), `jaw@${p}`).toBe(false);
    }
    expect(raised).toBeGreaterThan(1.5); // the paw really leaves the ground
  });

  it("opens the jaw on the attack impact frame and holds the skill impact", () => {
    const r = rig();
    r.pose(r.ctx("attack", 0.5, 1));
    expect(r.part("jaw").rotation.x).toBeGreaterThan(0.8);
    r.pose(r.ctx("attack", 0.15, 1));
    expect(r.part("jaw").rotation.x).toBeLessThan(0.2);
    const held = (p: number) => { r.pose(r.ctx("skill", p, 1)); return r.part("torso").position.toArray(); };
    expect(held(0.6)).toEqual(held(0.64));
  });

  it("blinks, twitches ears independently and breathes through the ribs", () => {
    const r = rig();
    const lids: number[] = [], ears = new Set<string>();
    for (let i = 0; i < 400; i++) {
      r.pose(r.ctx("idle", 1, i * 0.03));
      lids.push(r.part("lids").scale.y);
      ears.add(`${r.part("earL").rotation.z.toFixed(2)}|${(-r.part("earR").rotation.z).toFixed(2)}`);
      expect(r.part("torso").scale.y).toBe(1);
    }
    expect(Math.max(...lids)).toBeGreaterThan(0.9);
    expect(Math.min(...lids)).toBeLessThan(0.1);
    expect([...ears].some((e) => { const [l, rr] = e.split("|"); return l !== rr; })).toBe(true);
  });

  it("adds star detail at 2★ and 3★ with at most ~15% more pivots than the legacy 21", () => {
    const tris = (star: Star) => {
      let n = 0, glow = 0;
      rig(star).root.traverse((o) => {
        if (o instanceof THREE.Mesh) { n += o.geometry.getAttribute("position").count / 3; if (o.name.endsWith(":glow")) glow++; }
      });
      return { n, glow };
    };
    const one = tris(1), two = tris(2), three = tris(3);
    expect(two.n).toBeGreaterThan(one.n);
    expect(three.n).toBeGreaterThan(two.n);
    expect([one.glow, two.glow, three.glow]).toEqual([0, 0, 3]);
    let meshes = 0;
    rig(2).root.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(Math.round(21 * 1.15));
  });
});

describe("rig state cross-fade + authored death", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const torsoOf = (u: ReturnType<typeof createUnit>) => u.root.getObjectByName("torso")!;

  it("eases jaguar state changes over ~0.1 s instead of snapping", () => {
    const u = createUnit("jaguar_hunt", 1);
    u.play("attack");
    for (let i = 0; i < 26; i++) u.update(1 / 60); // ≈ p 0.5, mid-lunge
    const lunging = torsoOf(u).position.z;
    u.play("hit");
    u.update(1 / 60);
    const first = torsoOf(u).position.z;
    expect(Math.abs(first - lunging)).toBeLessThan(0.5);
    for (let i = 0; i < 12; i++) u.update(1 / 60);
    expect(Math.abs(torsoOf(u).position.z - lunging)).toBeGreaterThan(1.5);
    u.dispose();
  });

  it("keeps the legacy hard cut for rigs that do not opt in", () => {
    const def = createUnitVisual({
      id: "probe", motion: "ground", height: 4,
      build: (k) => ({ a: k.part("a") }),
      pose: (r: unknown, c) => { (r as { a: { group: THREE.Group } }).a.group.position.x = c.state === "attack" ? 5 : 0; },
    }, 1);
    def.play("attack"); def.update(0.016);
    expect(def.root.getObjectByName("a")!.position.x).toBe(5);
    def.play("hit"); def.update(0.016);
    expect(def.root.getObjectByName("a")!.position.x).toBe(0);
    def.dispose();
  });

  it("plays the authored death, then hides and reports done", () => {
    const u = createUnit("jaguar_hunt", 3);
    const done = vi.fn();
    u.update(0.1);
    u.die(done);
    for (let i = 0; i < 7; i++) u.update(0.1);
    expect(u.root.visible).toBe(true);
    expect(torsoOf(u).rotation.z).toBeGreaterThan(1.4);
    for (let i = 0; i < 7; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.setHpRatio(1); u.update(0.016);
    expect(u.root.visible).toBe(true);
    expect(u.root.scale.x).toBe(1);
    u.dispose();
  });
});
