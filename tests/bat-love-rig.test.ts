import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef } from "../src/units/rig";
import bat, { BAT_GROUND_Y } from "../src/units/roster/batLove";
import { createUnit, hasRig } from "../src/units/registry";

const MATS: Record<Bucket, THREE.Material> = {
  solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(),
};
const death = bat.death as UnitDeathDef<unknown>;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = bat.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({
    state, t: p, p, time, sig: 0.29, star, instance: 0, combat, fx: { say() {} },
  });
  const pose = (c: PoseCtx) => { reset(); bat.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => {
    reset();
    const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.29, star, instance: 0 };
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

describe("Dơi Tình Yêu rig contract", () => {
  it("is registered under the legacy id", () => {
    expect(hasRig("bat_blood")).toBe(true);
    expect(bat.motion).toBe("fly");
  });

  it("poses deterministically and never produces NaN in any state", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.55, 0.9, 1]) {
      a.pose(a.ctx(state, p, 4.7, combat));
      b.pose(b.ctx(state, p, 4.7, combat));
      const sa = a.snapshot();
      expect(sa.every(Number.isFinite), `${state}/${combat}@${p}`).toBe(true);
      expect(sa).toEqual(b.snapshot());
    }
  });

  it("stays airborne while alive and lands on (not through) the ground when it dies", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.2, 5.6]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(BAT_GROUND_Y + 0.3);
      }
      for (const p of SAMPLES) {
        r.die(p);
        expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(BAT_GROUND_Y - 0.15);
      }
      r.die(1);
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
      expect(r.minY()).toBeLessThan(BAT_GROUND_Y + 1); // actually lying on the ground
    }
  });

  it("flaps the outer wing segment behind the inner one (follow-through)", () => {
    const r = rig();
    const inner: number[] = [], outer: number[] = [];
    for (let i = 0; i < 80; i++) {
      r.pose(r.ctx("idle", 1, i * 0.01));
      inner.push(r.part("wingRIn").rotation.z);
      outer.push(r.part("wingROut").rotation.z);
    }
    const peak = (xs: number[]) => xs.indexOf(Math.max(...xs.slice(0, 60)));
    expect(peak(outer)).toBeGreaterThan(peak(inner));
  });

  it("separates the slow flap from the dash and opens the mouth on impacts", () => {
    const r = rig();
    r.pose(r.ctx("move", 0.3, 1, false));
    const walk = r.snapshot(), walkPitch = r.part("body").rotation.x;
    r.pose(r.ctx("move", 0.3, 1, true));
    expect(r.snapshot()).not.toEqual(walk);
    expect(r.part("body").rotation.x).toBeGreaterThan(walkPitch + 0.2); // dives forward to dash
    r.pose(r.ctx("move", 2.3, 1, false));
    const late = r.snapshot();
    r.pose(r.ctx("move", 2.3, 1, true));
    expect(r.snapshot()).toEqual(late);
    r.pose(r.ctx("attack", 0.5, 1));
    expect(r.part("mouth").scale.y).toBeGreaterThan(2);
    r.pose(r.ctx("skill", 0.55, 1));
    expect(r.part("mouth").scale.y).toBeGreaterThan(1.8);
  });

  it("blinks and twitches each ear on its own", () => {
    const r = rig();
    const lids: number[] = [];
    let independent = false;
    for (let i = 0; i < 300; i++) {
      r.pose(r.ctx("idle", 1, i * 0.03));
      lids.push(r.part("lids").scale.y);
      if (Math.abs(r.part("earL").rotation.z + r.part("earR").rotation.z) > 0.02) independent = true;
    }
    expect(Math.max(...lids)).toBeGreaterThan(0.9);
    expect(Math.min(...lids)).toBeLessThan(0.1);
    expect(independent).toBe(true);
  });

  it("adds star detail: gold trim at 2★, heart crown + glowing wing hearts at 3★", () => {
    const count = (star: Star) => {
      let n = 0, glow = 0;
      rig(star).root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        n += o.geometry.getAttribute("position").count / 3;
        if (o.name.endsWith(":glow")) glow++;
      });
      return { n, glow };
    };
    const one = count(1), two = count(2), three = count(3);
    expect(two.n).toBeGreaterThan(one.n);
    expect(three.n).toBeGreaterThan(two.n);
    expect(three.glow).toBeGreaterThan(one.glow);
  });
});

describe("Dơi Tình Yêu runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("eases state changes, then plays the authored death and hides", () => {
    const u = createUnit("bat_blood", 2);
    const body = () => u.root.getObjectByName("body")!;
    u.play("attack");
    for (let i = 0; i < 27; i++) u.update(1 / 60); // ≈ p 0.5, shooting
    const z = body().position.z;
    u.play("hit");
    u.update(1 / 60);
    expect(Math.abs(body().position.z - z)).toBeLessThan(0.3);
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
