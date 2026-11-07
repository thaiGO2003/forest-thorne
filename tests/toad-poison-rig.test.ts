import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import toad from "../src/units/roster/toadPoison";
import { createUnit } from "../src/units/registry";

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
    state, t: p, p, time, sig: 0.61, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); toad.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.61, star, instance: 0 };
    death.pose(parts, c);
    root.updateMatrixWorld(true);
  };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  const minY = () => new THREE.Box3().setFromObject(root, true).min.y;
  return { root, pose, die, ctx, snapshot, part, minY };
}

const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Cóc Độc rig contract", () => {
  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.17, 0.5, 0.55, 0.9, 1]) {
      a.pose(a.ctx(state, p, 6.1, combat));
      b.pose(b.ctx(state, p, 6.1, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states and death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.7, 5.9]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(-0.15);
      }
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(-0.15);
      }
      r.die(1);
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
    }
  });

  it("keeps planted feet still during relaxed idle (no foot sliding)", () => {
    const r = rig();
    const feet = ["armL", "armR", "legL", "legR"];
    const at = (name: string) => r.part(name).localToWorld(new THREE.Vector3(0, -1.2, 0.6));
    r.pose(r.ctx("idle", 1, 0));
    const home = feet.map(at);
    for (const p of SAMPLES) {
      r.pose(r.ctx("idle", p, p * 4));
      feet.forEach((n, i) => expect(at(n).distanceTo(home[i]!), `${n}@${p}`).toBeLessThan(0.3));
    }
  });

  it("separates the shuffle walk from the hop dash", () => {
    const r = rig();
    r.pose(r.ctx("move", 0.3, 1, false));
    const walkY = r.part("body").position.y, walk = r.snapshot();
    r.pose(r.ctx("move", 0.3, 1, true));
    expect(r.snapshot()).not.toEqual(walk);
    expect(r.part("body").position.y).toBeGreaterThan(walkY + 1); // the dash is airborne, the walk is not
    r.pose(r.ctx("move", 2.3, 1, false));
    const late = r.snapshot();
    r.pose(r.ctx("move", 2.3, 1, true));
    expect(r.snapshot()).toEqual(late); // sustained walking breaks into the hop
  });

  it("opens the jaw on the spit impact and sweeps three times while spraying the mist", () => {
    const r = rig();
    r.pose(r.ctx("attack", 0.5, 1));
    expect(r.part("jaw").rotation.x).toBeGreaterThan(0.6);
    r.pose(r.ctx("attack", 0.2, 1));
    expect(r.part("jaw").rotation.x).toBeLessThan(0.1);
    r.pose(r.ctx("skill", 0.4, 1));
    expect(r.part("throat").scale.y).toBeGreaterThan(1.6); // throat swells before the spray
    let flips = 0, prev = 0;
    for (let p = 0.46; p <= 0.82; p += 0.005) {
      r.pose(r.ctx("skill", p, 1));
      const s = Math.sign(r.part("head").rotation.y);
      if (s && prev && s !== prev) flips++;
      if (s) prev = s;
    }
    expect(flips).toBeGreaterThanOrEqual(2); // three sweeps → at least two direction changes
  });

  it("blinks and ripples the sacs with a per-sac lag", () => {
    const r = rig(3);
    const lids: number[] = [];
    for (let i = 0; i < 300; i++) { r.pose(r.ctx("idle", 1, i * 0.03)); lids.push(r.part("lids").scale.y); }
    expect(Math.max(...lids)).toBeGreaterThan(0.9);
    expect(Math.min(...lids)).toBeLessThan(0.1);
    r.pose(r.ctx("idle", 0.85, 3.3));
    expect(r.part("sac0").scale.x).not.toBeCloseTo(r.part("sac1").scale.x, 3);
  });

  it("keeps star detail: 3 → 5 → 6 sacs and glow only at 3★", () => {
    const count = (star: Star) => {
      let sacs = 0, glow = 0;
      rig(star).root.traverse((o) => {
        if (o.name.startsWith("sac") && o instanceof THREE.Group) sacs++;
        if (o instanceof THREE.Mesh && o.name.endsWith(":glow")) glow++;
      });
      return [sacs, glow > 0];
    };
    expect([count(1), count(2), count(3)]).toEqual([[3, false], [5, false], [6, true]]);
  });
});

describe("Cóc Độc runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("eases state changes, then plays the authored death and hides", () => {
    const u = createUnit("toad_poison", 2);
    const body = () => u.root.getObjectByName("body")!;
    u.play("hit");
    for (let i = 0; i < 9; i++) u.update(1 / 60); // ≈ p 0.3, recoiling
    const recoil = body().position.z;
    u.play("idle");
    u.update(1 / 60);
    expect(Math.abs(body().position.z - recoil)).toBeLessThan(0.3); // no snap back
    const done = vi.fn();
    u.die(done);
    for (let i = 0; i < 6; i++) u.update(0.1);
    expect(u.root.visible).toBe(true);
    for (let i = 0; i < 8; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
