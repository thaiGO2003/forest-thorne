import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import weasel from "../src/units/roster/weaselWind";
import { createUnit, hasRig } from "../src/units/registry";
import { getUnit } from "../src/content/catalog";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = weasel.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = weasel.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.47, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); weasel.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.47, star, instance: 0 };
    death.pose(parts, c);
    root.updateMatrixWorld(true);
  };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  const minY = () => new THREE.Box3().setFromObject(root, true).min.y;
  const soles = () => ["footR", "footL"].map((n) => part(n).localToWorld(new THREE.Vector3(0, -0.4, 0.3)));
  return { root, pose, die, ctx, snapshot, part, minY, soles };
}

const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Phong Liêm Dứu (weasel_quick)", () => {
  it("is now a tanker named Phong Liêm Dứu with a bespoke rig; stats untouched", () => {
    const u = getUnit("weasel_quick");
    expect([u.nameVi, u.role, u.tier, u.stats.hp, u.stats.atk]).toEqual(["Phong Liêm Dứu", "TANKER", 2, 254, 73]);
    expect(hasRig("weasel_quick")).toBe(true);
  });

  it("poses deterministically and never produces NaN", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.55, 0.9, 1]) {
      a.pose(a.ctx(state, p, 4.3, combat));
      b.pose(b.ctx(state, p, 4.3, combat));
      expect(a.snapshot().every(Number.isFinite), `${state}@${p}`).toBe(true);
      expect(a.snapshot()).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states and death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.5, 5.4]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(-0.15);
      }
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(-0.15);
      }
    }
  });

  it("keeps the feet planted in idle and swings the sickle on the attack impact", () => {
    const r = rig();
    r.pose(r.ctx("idle", 1, 0));
    const home = r.soles();
    for (const p of SAMPLES) {
      r.pose(r.ctx("idle", p, p * 4.5));
      r.soles().forEach((s, i) => expect(s.distanceTo(home[i]!), `foot${i}@${p}`).toBeLessThan(0.3));
    }
    r.pose(r.ctx("attack", 0.38, 1));
    const up = r.part("armR").rotation.x;
    r.pose(r.ctx("attack", 0.56, 1));
    expect(r.part("armR").rotation.x).toBeGreaterThan(up + 1);
    r.pose(r.ctx("skill", 0.6, 1));
    expect(Math.abs(r.part("torso").rotation.y)).toBeGreaterThan(2); // tornado spin
  });

  it("adds the wind ring at 2★ and gold armour at 3★", () => {
    const has = (star: Star, name: string) => { let f = false; rig(star).root.traverse((o) => { if (o.name === name) f = true; }); return f; };
    expect([has(1, "ring"), has(2, "ring"), has(3, "ring")]).toEqual([false, true, true]);
    const tris = (star: Star) => { let n = 0; rig(star).root.traverse((o) => { if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count; }); return n; };
    expect(tris(3)).toBeGreaterThan(tris(2));
  });
});

describe("Phong Liêm Dứu runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("plays the authored death and hides", () => {
    const u = createUnit("weasel_quick", 1);
    const done = vi.fn();
    u.update(0.1);
    u.die(done);
    for (let i = 0; i < 14; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
