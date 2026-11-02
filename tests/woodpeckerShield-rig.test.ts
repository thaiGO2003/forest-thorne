import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import { VOXEL, type ActionState, type DeathCtx, type PoseCtx, type Star, type UnitDeathDef } from "../src/units/rig";
import def from "../src/units/roster/woodpeckerShield";
import { createUnit, hasRig } from "../src/units/registry";
import { hasUnitVisual } from "../src/content/unitVisuals";
import { getUnit } from "../src/content/catalog";

const MATS: Record<Bucket, THREE.Material> = { solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial() };
const death = def.death as UnitDeathDef<unknown>;
const GROUND = 0;

function rig(star: Star = 1) {
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = def.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone(), v: p.group.visible }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); r.g.visible = r.v; } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({ state, t: p, p, time, sig: 0.41, star, instance: 0, combat, fx: { say() {} } });
  const pose = (c: PoseCtx) => { reset(); def.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => { reset(); const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.41, star, instance: 0 }; death.pose(parts, c); root.updateMatrixWorld(true); };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  /** Lowest voxel of the creature (glass shells such as water/resin domes are VFX resting on the tile). */
  const minY = () => { const b = new THREE.Box3(); root.traverse((o) => { if (o instanceof THREE.Mesh && o.visible && !o.name.endsWith(":glass")) b.expandByObject(o, true); }); return b.min.y; };
  return { root, pose, die, ctx, snapshot, minY };
}
const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

describe("Gõ Kiến Mỏ Cứng (woodpecker_drill)", () => {
  it("is renamed, re-roled and visible; tier and stats untouched", () => {
    const u = getUnit("woodpecker_drill");
    expect([u.nameVi, u.role]).toEqual(["Gõ Kiến Mỏ Cứng", "TANKER"]);
    expect([hasRig("woodpecker_drill"), hasUnitVisual("woodpecker_drill"), def.motion]).toEqual([true, true, "ground"]);
  });

  it("poses deterministically and never produces NaN", () => {
    const a = rig(3), b = rig(3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.6, 0.9, 1]) {
      a.pose(a.ctx(state, p, 4.3, combat)); b.pose(b.ctx(state, p, 4.3, combat));
      expect(a.snapshot().every(Number.isFinite), `${state}@${p}`).toBe(true);
      expect(a.snapshot()).toEqual(b.snapshot());
    }
  });

  it("never sinks into the ground in any state or during death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.5, 5.4]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(GROUND - 0.15);
      }
      for (const p of SAMPLES) { r.die(p); expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(GROUND - 0.15); }
      expect(r.snapshot().every(Number.isFinite)).toBe(true);
    }
  });

  it("adds detail with stars", () => {
    const tris = (star: Star) => { let n = 0; rig(star).root.traverse((o) => { if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count; }); return n; };
    expect(tris(2)).toBeGreaterThan(tris(1));
    expect(tris(3)).toBeGreaterThan(tris(2));
  });
});

describe("Gõ Kiến Mỏ Cứng runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it("plays the authored death and hides", () => {
    const u = createUnit("woodpecker_drill", 2);
    const done = vi.fn();
    u.play("attack"); for (let i = 0; i < 20; i++) u.update(1 / 60);
    u.die(done);
    for (let i = 0; i < 16; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
