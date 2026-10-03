import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { visibleBodies } from "../src/units/rig";
import { normalizeBillboard, type BillboardState } from "../src/units/billboard";
import { Kit } from "../src/units/kit";
import { RIGS } from "../src/units/registry";

const base: BillboardState = { name: "x", star: 2, hp: 50, maxHp: 100, rage: 0, rageMax: 4, side: "L", statuses: [] };

describe("A92 billboard normalization", () => {
  it("segments rage: direct count up to 10, proportional above, at least one segment", () => {
    const n = (rage: number, rageMax: number) => { const r = normalizeBillboard({ ...base, rage, rageMax }); return [r.segments, r.filled]; };
    expect(n(3, 4)).toEqual([4, 3]);
    expect(n(9, 4)).toEqual([4, 4]);
    expect(n(0, 0)).toEqual([1, 0]);
    expect(n(10, 10)).toEqual([10, 10]);
    expect(n(10, 20)).toEqual([10, 5]);
    expect(n(40, 20)).toEqual([10, 10]);
  });

  it("clamps values and caps statuses at 3 per side after dedup", () => {
    const r = normalizeBillboard({
      ...base, hp: -5, maxHp: 0, star: 7,
      statuses: [
        { key: "atkUp", positive: true }, { key: "atkUp", positive: true }, { key: "regen", positive: true },
        { key: "shield", positive: true }, { key: "haste", positive: true },
        { key: "burn", positive: false }, { key: " ", positive: false },
      ],
    });
    expect([r.hp, r.maxHp, r.star, r.pos, r.neg]).toEqual([0, 1, 3, ["atkUp", "regen", "shield"], ["burn"]]);
  });
});

describe("A90.3 star multiplicity", () => {
  it("maps star + HP ratio to visible creature count at every threshold", () => {
    const rows: [1 | 2 | 3, number, number][] = [
      [1, 1, 1], [1, 0.01, 1], [1, 0, 0],
      [2, 1, 2], [2, 0.67, 2], [2, 2 / 3, 1], [2, 0.01, 1], [2, 0, 0],
      [3, 1, 3], [3, 0.67, 3], [3, 2 / 3, 2], [3, 0.34, 2], [3, 1 / 3, 1], [3, 0.01, 1], [3, 0, 0],
      [3, -0.5, 0], [2, Number.NaN, 0],
    ];
    for (const [star, hp, n] of rows) expect([star, hp, visibleBodies(star, hp)]).toEqual([star, hp, n]);
  });
});

function idlePose(id: "toad_poison" | "jaguar_hunt", combat: boolean) {
  const def = RIGS[id]!;
  const root = new THREE.Group();
  const kit = new Kit(root);
  const parts = def.build(kit, { star: 1, skin: null });
  def.pose(parts, {
    state: "idle", t: 0.2, p: 0.05, time: 1.2, sig: 0.5, star: 1, instance: 0, combat,
    fx: { say() {} },
  });
  const part = (name: string) => kit.parts.find((p) => p.name === name)!.group;
  return { part };
}

describe("Library combat-idle authored poses", () => {
  it("Cóc Độc keeps relaxed idle normally and crouches in combat idle", () => {
    const relaxed = idlePose("toad_poison", false);
    const combat = idlePose("toad_poison", true);
    expect(relaxed.part("body").position.y).toBeCloseTo(0);
    expect(combat.part("body").position.y).toBeCloseTo(-0.35);
    expect(combat.part("head").rotation.x).toBeCloseTo(0.08);
  });

  it("Báo Đốm Săn keeps inspection idle normally and uses its alert combat stance", () => {
    const relaxed = idlePose("jaguar_hunt", false);
    const combat = idlePose("jaguar_hunt", true);
    expect(relaxed.part("torso").position.y).toBeCloseTo(5.6);
    expect(combat.part("torso").position.y).toBeCloseTo(4.9);
    expect(combat.part("ears").rotation.x).toBeCloseTo(-0.35);
  });
});
