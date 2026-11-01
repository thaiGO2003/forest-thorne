import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import rabbit from "../src/units/roster/rabbitBlood";
import { createUnit, hasRig } from "../src/units/registry";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = rabbit.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = rabbit.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.53, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); rabbit.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.53, star, instance: 0 };
    death.pose(parts, c);
    root.updateMatrixWorld(true);
  };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  const minY = () => new THREE.Box3().setFromObject(root, true).min.y;
  /** Sole centre of each foot in kit space. */
  const soles = () => ["footR", "footL"].map((n) => part(n).localToWorld(new THREE.Vector3(0, -0.5, 0.55)));
  return { root, pose, die, ctx, snapshot, part, minY, soles };
}

const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Huyết Thố rig contract", () => {
  it("is registered as a bespoke ground rig", () => {
    expect(hasRig("rabbit_blood")).toBe(true);
    expect(rabbit.motion).toBe("ground");
  });

  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.6, 0.9, 1]) {
      a.pose(a.ctx(state, p, 3.9, combat));
      b.pose(b.ctx(state, p, 3.9, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states and death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.2, 2.4, 5.1]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(-0.15);
      }
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(-0.15);
      }
      r.die(1);
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
      expect(r.part("hips").rotation.x).toBeCloseTo(Math.PI / 2); // lying face down
    }
  });

  it("keeps both feet planted and level in the relaxed idle and the combat stance", () => {
    const r = rig();
    r.pose(r.ctx("idle", 1, 0));
    const home = r.soles();
    for (const p of SAMPLES) {
      r.pose(r.ctx("idle", p, p * 4.5));
      r.soles().forEach((s, i) => {
        expect(s.distanceTo(home[i]!), `foot${i}@${p}`).toBeLessThan(0.3);
        expect(Math.abs(s.y), `foot${i}@${p}`).toBeLessThan(0.3);
      });
    }
    const foot = r.part("footR");
    for (let t = 0; t < 8; t += 0.41) {
      r.pose(r.ctx("idle", 1, t, true));
      // Planted foot stays level: its world up vector points up.
      const up = new THREE.Vector3(0, 1, 0).transformDirection(foot.matrixWorld);
      if (r.soles()[0]!.y < 0.3) expect(up.y, `t=${t.toFixed(2)}`).toBeGreaterThan(0.97);
    }
  });

  it("separates heavy steps from the bounding dash", () => {
    const r = rig();
    let walkMax = -Infinity, dashMax = -Infinity;
    for (let p = 0; p < 0.6; p += 0.02) {
      r.pose(r.ctx("move", p, 1, false)); walkMax = Math.max(walkMax, r.minY());
      r.pose(r.ctx("move", p, 1, true)); dashMax = Math.max(dashMax, r.minY());
    }
    expect(walkMax).toBeLessThan(0.6); // a foot is always on the ground while walking
    expect(dashMax).toBeGreaterThan(0.6); // the dash leaves the ground between bounds
    r.pose(r.ctx("move", 2.3, 1, false));
    const late = r.snapshot();
    r.pose(r.ctx("move", 2.3, 1, true));
    expect(r.snapshot()).toEqual(late);
  });

  it("swipes the claw across the front on the attack impact and ignites the eyes in the skill", () => {
    const r = rig();
    r.pose(r.ctx("attack", 0.3, 1));
    const windYaw = r.part("armR").rotation.y;
    r.pose(r.ctx("attack", 0.56, 1));
    expect(r.part("armR").rotation.y).toBeLessThan(windYaw - 1); // crescent sweeps across
    r.pose(r.ctx("attack", 1, 1));
    expect(Math.abs(r.part("armR").rotation.y)).toBeLessThan(0.05); // back to rest
    r.pose(r.ctx("skill", 0.1, 1));
    const calm = r.part("eyes").scale.x;
    r.pose(r.ctx("skill", 0.45, 1));
    expect(r.part("eyes").scale.x).toBeGreaterThan(calm + 0.6);
  });

  it("trails the scarf and ear tips behind their roots (follow-through)", () => {
    const r = rig();
    const root: number[] = [], tail: number[] = [];
    for (let i = 0; i < 120; i++) {
      r.pose(r.ctx("move", 1.5 + i * 0.01, 1 + i * 0.01, true));
      root.push(r.part("scarf0").rotation.y);
      tail.push(r.part("scarf2").rotation.y);
    }
    const peak = (xs: number[]) => xs.indexOf(Math.max(...xs.slice(0, 90)));
    expect(peak(tail)).not.toBe(peak(root));
  });

  it("adds star detail: glowing ear tips + aura at 2★, crown + shoulder guards at 3★", () => {
    const parts = (star: Star) => {
      let tris = 0, glow = 0, aura = false;
      rig(star).root.traverse((o) => {
        if (o.name === "aura") aura = true;
        if (!(o instanceof THREE.Mesh)) return;
        tris += o.geometry.getAttribute("position").count / 3;
        if (o.name.endsWith(":glow")) glow++;
      });
      return { tris, glow, aura };
    };
    const one = parts(1), two = parts(2), three = parts(3);
    expect([one.aura, two.aura, three.aura]).toEqual([false, true, true]);
    expect(two.glow).toBeGreaterThan(one.glow);
    expect(three.tris).toBeGreaterThan(two.tris);
  });
});

describe("Huyết Thố runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("eases state changes, then plays the authored death and hides", () => {
    const u = createUnit("rabbit_blood", 2);
    const hips = () => u.root.getObjectByName("hips")!;
    u.play("attack");
    for (let i = 0; i < 24; i++) u.update(1 / 60); // ≈ p 0.5, lunging
    const z = hips().position.z;
    u.play("hit");
    u.update(1 / 60);
    expect(Math.abs(hips().position.z - z)).toBeLessThan(0.3);
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
