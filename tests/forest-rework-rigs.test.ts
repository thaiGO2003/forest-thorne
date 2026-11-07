// Rig checks for the November 2026 concept-sheet reworks. Only name, role and visual changed;
// tier and stats are owned by the designer and intentionally not asserted here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Kit, type Bucket } from "../src/units/kit";
import { type ActionState, type DeathCtx, type PoseCtx, type Star, type UnitDeathDef, type UnitRigDef } from "../src/units/rig";
import snakeSoul from "../src/units/roster/snakeSoul";
import beetleNibble from "../src/units/roster/beetleNibble";
import monkeySage from "../src/units/roster/monkeySage";
import pumpkinKing from "../src/units/roster/pumpkinKing";
import deerNurse from "../src/units/roster/deerNurse";
import squirrelMonk from "../src/units/roster/squirrelMonk";
import ferretBlades from "../src/units/roster/ferretBlades";
import sharkOctopus from "../src/units/roster/sharkOctopus";
import oxMountain from "../src/units/roster/oxMountain";
import foxSlingshot from "../src/units/roster/foxSlingshot";
import saolaFrost from "../src/units/roster/saolaFrost";
import boarGlutton from "../src/units/roster/boarGlutton";
import timeCloth from "../src/units/roster/timeCloth";
import pigCharm from "../src/units/roster/pigCharm";
import bullRage from "../src/units/roster/bullRage";
import hedgehogSun from "../src/units/roster/hedgehogSun";
import duckKing from "../src/units/roster/duckKing";
import elfSheep from "../src/units/roster/elfSheep";
import { createUnit, hasRig } from "../src/units/registry";
import { hasUnitVisual } from "../src/content/unitVisuals";
import { getUnit, type Role } from "../src/content/catalog";

const MATS: Record<Bucket, THREE.Material> = { solid: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial() };
const CASES: [UnitRigDef<unknown>, string, Role][] = [
  [snakeSoul, "Rắn Đoạt Hồn", "MAGE"],
  [beetleNibble, "Bọ Hung Nhấm Nháp", "ASSASSIN"],
  [monkeySage, "Sơn Thân", "ASSASSIN"],
  [pumpkinKing, "Bí Ngô Ma Vương", "FIGHTER"],
  [deerNurse, "Nai Y Tá", "SUPPORT"],
  [squirrelMonk, "Sóc Tu", "MAGE"],
  [ferretBlades, "Song Đao Chồn Sóc", "ASSASSIN"],
  [sharkOctopus, "Bạch Tuộc Đầu Cá Mập", "TANKER"],
  [oxMountain, "Ngọn Núi Đầu Bò", "TANKER"],
  [foxSlingshot, "Cáo Ná Thun", "ARCHER"],
  [saolaFrost, "Sao La Làng", "MAGE"],
  [boarGlutton, "Lợn Háu Ăn", "TANKER"],
  [timeCloth, "Ma Vải Thời Gian", "MAGE"],
  [pigCharm, "Lợn Quyến Rũ", "TANKER"],
  [bullRage, "Bò Điên Tóc Đỏ", "TANKER"],
  [hedgehogSun, "Nhím Mặt Trời", "ARCHER"],
  [duckKing, "Vua Vịt Vàng", "MAGE"],
  [elfSheep, "Elf Lùn Cừu", "SUPPORT"],
];
const STATES: [ActionState, boolean][] = [["idle", false], ["idle", true], ["move", false], ["move", true], ["attack", false], ["skill", false], ["hit", false]];
const SAMPLES = Array.from({ length: 41 }, (_, i) => i / 40);
const GROUND = 0;

function rig(def: UnitRigDef<unknown>, star: Star = 1) {
  const death = def.death as UnitDeathDef<unknown>;
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
  const minY = () => { const b = new THREE.Box3(); root.traverse((o) => { if (o instanceof THREE.Mesh && o.visible && !o.name.endsWith(":glass")) b.expandByObject(o, true); }); return b.min.y; };
  return { root, pose, die, ctx, snapshot, minY };
}

describe.each(CASES)("%#: rework rig", (def, name, role) => {
  it(`${name} (${def.id}) is renamed, re-roled and visible`, () => {
    const u = getUnit(def.id);
    expect([u.nameVi, u.role]).toEqual([name, role]);
    expect([hasRig(def.id), hasUnitVisual(def.id), def.motion, def.death !== undefined]).toEqual([true, true, "ground", true]);
  });

  it(`${name} poses deterministically and never produces NaN`, () => {
    const a = rig(def, 3), b = rig(def, 3);
    for (const [state, combat] of STATES) for (const p of [0, 0.2, 0.5, 0.6, 0.9, 1]) {
      a.pose(a.ctx(state, p, 4.3, combat)); b.pose(b.ctx(state, p, 4.3, combat));
      expect(a.snapshot().every(Number.isFinite), `${state}@${p}`).toBe(true);
      expect(a.snapshot()).toEqual(b.snapshot());
    }
  });

  it(`${name} never sinks into the ground in any state or during death`, () => {
    for (const star of [1, 3] as const) {
      const r = rig(def, star);
      for (const [state, combat] of STATES) for (const p of SAMPLES) for (const time of [0.3, 2.5, 5.4]) {
        r.pose(r.ctx(state, state === "move" ? p * 3 : p, time, combat));
        expect(r.minY(), `${star}★ ${state}/${combat}@${p.toFixed(3)} t=${time}`).toBeGreaterThan(GROUND - 0.15);
      }
      for (const p of SAMPLES) { r.die(p); expect(r.minY(), `${star}★ death@${p}`).toBeGreaterThan(GROUND - 0.15); }
    }
  });

  it(`${name} adds detail with stars`, () => {
    const verts = (star: Star) => { let n = 0; rig(def, star).root.traverse((o) => { if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position").count; }); return n; };
    expect(verts(2)).toBeGreaterThan(verts(1));
    expect(verts(3)).toBeGreaterThan(verts(2));
  });
});

describe("rework rigs runtime", () => {
  beforeEach(() => { vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => null }) }); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it.each(CASES.map(([d]) => d.id))("%s plays the authored death and hides", (id) => {
    const u = createUnit(id, 2);
    const done = vi.fn();
    u.play("skill"); for (let i = 0; i < 20; i++) u.update(1 / 60);
    u.die(done);
    for (let i = 0; i < 16; i++) u.update(0.1);
    expect(u.root.visible).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    u.dispose();
  });
});
