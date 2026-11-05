import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import type { ActionState, DeathCtx, PoseCtx, Star, UnitDeathDef, UnitRigDef } from "../src/units/rig";
import tigerFang from "../src/units/roster/tigerFang";
import wolfAlpha from "../src/units/roster/wolfAlpha";
import crocodileBite from "../src/units/roster/crocodileBite";
import owlNight from "../src/units/roster/owlNight";
import { createUnit, hasRig } from "../src/units/registry";
import { hasUnitVisual } from "../src/content/unitVisuals";
import { getUnit } from "../src/content/catalog";

const MATS: Record<Bucket, THREE.Material> = { solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial() };
const GROUND = 0;
const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);

const CASES: { def: UnitRigDef<unknown>; id: string; nameVi: string; role: string }[] = [
  { def: tigerFang, id: "tiger_fang", nameVi: "Hổ Nanh", role: "FIGHTER" },
  { def: wolfAlpha, id: "wolf_alpha", nameVi: "Sói Thủ Lĩnh", role: "FIGHTER" },
  { def: crocodileBite, id: "crocodile_bite", nameVi: "Cá Sấu Đầm", role: "FIGHTER" },
  { def: owlNight, id: "owl_nightshot", nameVi: "Cú Đêm", role: "ARCHER" },
];

function rig(def: UnitRigDef<unknown>, star: Star = 1) {
  const death = def.death as UnitDeathDef<unknown>;
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = def.build(kit, { star, skin: null });
  for (const p of kit.parts) p.bake(MATS, []);
  const rest = kit.parts.map((p) => ({ g: p.group, p: p.group.position.clone(), q: p.group.quaternion.clone(), s: p.group.scale.clone() }));
  const reset = () => { for (const r of rest) { r.g.position.copy(r.p); r.g.quaternion.copy(r.q); r.g.scale.copy(r.s); } };
  const ctx = (state: ActionState, p: number, time: number, combat = false): PoseCtx => ({ state, t: p, p, time, sig: 0.41, star, instance: 0, combat, fx: { say() {} } });
  const pose = (c: PoseCtx) => { reset(); def.pose(parts, c); root.updateMatrixWorld(true); };
  const die = (p: number) => { reset(); const c: DeathCtx = { t: p * death.seconds, p, time: 2, sig: 0.41, star, instance: 0 }; death.pose(parts, c); root.updateMatrixWorld(true); };
  const snapshot = () => kit.parts.flatMap((p) => [...p.group.position.toArray(), ...p.group.quaternion.toArray(), ...p.group.scale.toArray()]);
  const minY = () => {
    const b = new THREE.Box3();
    root.traverse((o) => { if (o instanceof THREE.Mesh && !o.name.endsWith(":glass")) { let v = true; for (let a: THREE.Object3D | null = o; a; a = a.parent) v &&= a.visible; if (v) b.expandByObject(o, true); } });
    return b.min.y;
  };
  return { root, pose, die, ctx, snapshot, minY };
}

describe.each(CASES)("$nameVi ($id)", ({ def, id, nameVi, role }) => {
  it("keeps catalog name and role and is visible", () => {
    const u = getUnit(id);
    expect([u.nameVi, u.role]).toEqual([nameVi, role]);
    expect([def.id, hasRig(id), hasUnitVisual(id), def.motion]).toEqual([id, true, true, "ground"]);
  });

  it("poses deterministically and never produces NaN", () => {
    const a = rig(def, 3), b = rig(def, 3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.6, 0.9, 1]) {
      a.pose(a.ctx(state, p, 4.3, combat)); b.pose(b.ctx(state, p, 4.3, combat));
      expect(a.snapshot().every(Number.isFinite), `${state}@${p}`).toBe(true);
      expect(a.snapshot()).toEqual(b.snapshot());
    }
  });

  it("never sinks into the ground in any state or during death", () => {
    for (const star of [1, 3] as const) {
      const r = rig(def, star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.5, 5.4]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(GROUND - 0.15);
      }
      for (const p of SAMPLES) { r.die(p); expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(GROUND - 0.15); }
    }
  });

  it("adds detail with stars", () => {
    const verts = (star: Star) => { let n = 0; rig(def, star).root.traverse((o) => { if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count; }); return n; };
    expect(verts(2)).toBeGreaterThan(verts(1));
    expect(verts(3)).toBeGreaterThan(verts(2));
  });
});

describe("concept-sheet rigs runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it.each(CASES)("$id plays attack + skill, fires impacts, then the authored death hides it", ({ id }) => {
    const u = createUnit(id, 2);
    const hits = vi.fn(), done = vi.fn();
    u.play("attack", { onImpact: hits }); for (let i = 0; i < 70; i++) u.update(1 / 60);
    u.play("skill", { onImpact: hits }); for (let i = 0; i < 140; i++) u.update(1 / 60);
    expect(hits).toHaveBeenCalledTimes(2);
    u.die(done);
    for (let i = 0; i < 16; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
