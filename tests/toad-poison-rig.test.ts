import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import toad from "../src/units/roster/toadPoison";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = toad.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = toad.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.37, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); toad.pose(parts, c); root.updateMatrixWorld(true); };
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

describe("Cóc Độc rig contract", () => {
  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.13, 0.5, 0.55, 0.87, 1]) {
      a.pose(a.ctx(state, p, 7.3, combat));
      b.pose(b.ctx(state, p, 7.3, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states (no sinking feet)", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.4, 2.9, 6.1]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(-0.15);
      }
    }
  });

  it("collapses flat on death without NaN or ground penetration", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p.toFixed(3)}`).toBeGreaterThan(-0.15);
      }
      r.die(1);
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
      expect(r.part("body").scale.y).toBeLessThan(0.65);
      expect(r.part("body").position.y).toBeLessThan(2);
    }
  });

  it("opens the jaw on the attack and skill impact, then closes it", () => {
    const r = rig();
    r.pose(r.ctx("attack", 0.5, 1));
    const attackOpen = r.part("jaw").rotation.x;
    r.pose(r.ctx("attack", 0.05, 1));
    expect(attackOpen).toBeGreaterThan(0.6);
    expect(r.part("jaw").rotation.x).toBeLessThan(0.2);
    r.pose(r.ctx("skill", 0.58, 1));
    expect(r.part("jaw").rotation.x).toBeGreaterThan(0.6);
    // Impact hold: the body reads identically across the frozen window.
    const held = (p: number) => { r.pose(r.ctx("skill", p, 1)); return r.part("body").position.toArray(); };
    expect(held(0.55)).toEqual(held(0.62));
  });

  it("sweeps the head and inflates the throat for the skill", () => {
    const r = rig();
    r.pose(r.ctx("skill", 0.1, 1));
    const idleThroat = r.part("throat").scale.y;
    r.pose(r.ctx("skill", 0.45, 1));
    expect(r.part("throat").scale.y).toBeGreaterThan(idleThroat + 0.5);
    const yaws = new Set<string>();
    for (const p of [0.6, 0.65, 0.7, 0.75, 0.8]) {
      r.pose(r.ctx("skill", p, 1));
      yaws.add(r.part("head").rotation.y.toFixed(3));
    }
    expect(yaws.size).toBeGreaterThan(2); // sweeping spray, not a fixed loop
  });

  it("blinks and keeps the sacs breathing", () => {
    const r = rig();
    const lids: number[] = [], sacs = new Set<string>();
    for (let i = 0; i < 300; i++) {
      r.pose(r.ctx("idle", 1, i * 0.03));
      lids.push(r.part("lids").scale.y);
      sacs.add(r.part("sac0").scale.x.toFixed(2));
    }
    expect(Math.max(...lids)).toBeGreaterThan(0.9);
    expect(Math.min(...lids)).toBeLessThan(0.1);
    expect(sacs.size).toBeGreaterThan(2);
  });

  it("gates the satchel at 2★, the leaf crown at 3★ and grows the sac count", () => {
    const build = (star: Star) => toad.build(new Kit(new THREE.Group()), { star, skin: null }) as {
      sacs: unknown[]; pouch: unknown | null; crown: unknown | null;
    };
    const one = build(1), two = build(2), three = build(3);
    expect([one.sacs.length, two.sacs.length, three.sacs.length]).toEqual([3, 5, 6]);
    expect([one.pouch, two.pouch !== null, three.crown !== null]).toEqual([null, true, true]);
    expect([one.crown, two.crown]).toEqual([null, null]);
  });
});
