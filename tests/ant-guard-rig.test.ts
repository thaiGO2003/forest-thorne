import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import ant from "../src/units/roster/antGuard";
import { createUnit, hasRig } from "../src/units/registry";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = ant.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = ant.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.43, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); ant.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.43, star, instance: 0 };
    death.pose(parts, c);
    root.updateMatrixWorld(true);
  };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  /** Lowest voxel of the creature (the dome is a VFX shell resting on the ground, checked separately). */
  const minY = () => {
    const box = new THREE.Box3();
    root.traverse((o) => { if (o instanceof THREE.Mesh && !o.name.startsWith("dome")) box.expandByObject(o, true); });
    return box.min.y;
  };
  const feet = () => kit.parts.filter((p) => p.name.startsWith("knee"))
    .map((p) => p.group.localToWorld(new THREE.Vector3(0, -4.55, 0)));
  return { root, pose, die, ctx, snapshot, part, minY, feet };
}

const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Kiến Hộ Vệ rig contract", () => {
  it("is registered as a bespoke rig (no more pending-art signpost)", () => {
    expect(hasRig("ant_guard")).toBe(true);
  });

  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.6, 0.9, 1]) {
      a.pose(a.ctx(state, p, 5.3, combat));
      b.pose(b.ctx(state, p, 5.3, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("keeps every voxel above the ground in all states and death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.4, 2.6, 6.2]) {
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

  it("keeps the feet planted on the ground in the held idle and combat stance", () => {
    const r = rig();
    for (const combat of [false, true]) for (let time = 0; time < 12; time += 0.37) {
      r.pose(r.ctx("idle", 1, time, combat));
      // Combat "shields up" beats lift the two forelegs on purpose; the other four always stand.
      r.feet().forEach((f, i) => {
        if (combat && i < 2) return;
        expect(Math.abs(f.y), `leg${i} combat=${combat} t=${time.toFixed(2)}`).toBeLessThan(0.45);
      });
    }
  });

  it("does not slide planted feet during relaxed idle (except the grooming foreleg)", () => {
    const r = rig();
    r.pose(r.ctx("idle", 1, 0));
    const home = r.feet();
    for (const p of SAMPLES) {
      r.pose(r.ctx("idle", p, p * 4.5));
      r.feet().forEach((f, i) => { if (i !== 0) expect(f.distanceTo(home[i]!), `leg${i}@${p}`).toBeLessThan(0.35); });
    }
  });

  it("alternates tripods and separates the walk from the scuttle", () => {
    const r = rig();
    r.pose(r.ctx("move", 0.7, 1, false));
    const lifted = r.feet().map((f) => f.y > 0.25);
    // Exactly one tripod is in swing: {L1,R2,L3} vs {R1,L2,R3} (build order L1,R1,L2,R2,L3,R3).
    const a = [lifted[0], lifted[3], lifted[4]], b = [lifted[1], lifted[2], lifted[5]];
    expect(a.every((x) => x === a[0]) && b.every((x) => x === b[0]) && a[0] !== b[0]).toBe(true);
    const walk = r.snapshot(), walkY = r.part("thorax").position.y;
    r.pose(r.ctx("move", 0.7, 1, true));
    expect(r.snapshot()).not.toEqual(walk);
    expect(r.part("thorax").position.y).toBeLessThan(walkY); // the scuttle runs low
    r.pose(r.ctx("move", 2.3, 1, false));
    const late = r.snapshot();
    r.pose(r.ctx("move", 2.3, 1, true));
    expect(r.snapshot()).toEqual(late); // sustained walking breaks into the scuttle
  });

  it("snaps the mandibles shut on the attack impact and raises the resin dome for the skill", () => {
    const r = rig();
    r.pose(r.ctx("attack", 0.35, 1));
    const open = r.part("mandR").rotation.y;
    r.pose(r.ctx("attack", 0.52, 1));
    expect(open).toBeGreaterThan(0.4);
    expect(r.part("mandR").rotation.y).toBeLessThan(0.05);
    const dome = (p: number) => { r.pose(r.ctx("skill", p, 1)); return r.part("dome"); };
    expect(dome(0.1).visible).toBe(false);
    expect(dome(0.55).visible).toBe(true);
    expect(dome(0.6).scale.y).toBeGreaterThan(0.9);
    expect(dome(1).visible).toBe(false);
    for (const s of ["idle", "move", "attack", "hit"] as const) { r.pose(r.ctx(s, 0.5, 1)); expect(r.part("dome").visible).toBe(false); }
  });

  it("collapses the hidden dome so portrait framing ignores it", () => {
    const r = rig();
    r.pose(r.ctx("idle", 1, 0));
    // Same union-of-geometry-boxes framing as portraits.visualBounds, with and without the dome.
    const bounds = (withDome: boolean) => {
      const box = new THREE.Box3();
      r.root.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || (!withDome && o.name.startsWith("dome"))) return;
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
      });
      return box;
    };
    const a = bounds(true), b = bounds(false);
    // The collapsed dome is a speck on the ground inside the footprint: framing moves < 0.1 voxel.
    expect(a.min.distanceTo(b.min)).toBeLessThan(0.1);
    expect(a.max.distanceTo(b.max)).toBeLessThan(0.1);
    expect(r.part("dome").scale.x).toBeLessThan(0.01);
  });

  it("adds star detail: amber plates at 2★, glass guards + crown at 3★", () => {
    const tris = (star: Star) => {
      let n = 0, glass = 0;
      rig(star).root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        n += o.geometry.getAttribute("position").count / 3;
        if (o.name.endsWith(":glass") && !o.name.startsWith("dome")) glass++;
      });
      return { n, glass };
    };
    const one = tris(1), two = tris(2), three = tris(3);
    expect(two.n).toBeGreaterThan(one.n);
    expect(three.n).toBeGreaterThan(two.n);
    expect([one.glass, two.glass, three.glass]).toEqual([0, 0, 1]);
  });
});

describe("Kiến Hộ Vệ runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("eases state changes, then plays the authored death and hides", () => {
    const u = createUnit("ant_guard", 3);
    const thorax = () => u.root.getObjectByName("thorax")!;
    u.play("attack");
    for (let i = 0; i < 25; i++) u.update(1 / 60); // ≈ p 0.5, lunging
    const lunge = thorax().position.z;
    u.play("hit");
    u.update(1 / 60);
    expect(Math.abs(thorax().position.z - lunge)).toBeLessThan(0.4); // no snap
    const done = vi.fn();
    u.die(done);
    for (let i = 0; i < 5; i++) u.update(0.1);
    expect(u.root.visible).toBe(true);
    for (let i = 0; i < 6; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
