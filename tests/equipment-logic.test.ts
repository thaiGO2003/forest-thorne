import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "../src/core/itemRegistry";
import {
  EMPTY_EQUIPMENT_LOGIC, equipmentLogicSummary, logicCoverage, logicDamageMultiplier, readTrigger,
  resolveEquipmentLogic, rollSkillProc, EQUIPMENT_TRIGGERS, HIGH_HP_THRESHOLD, LOW_HP_THRESHOLD,
} from "../src/core/equipmentLogic";
import { makeFighter, materializeCombat, simulate } from "../src/core/combat";

/** Local mulberry32 so the test never depends on engine internals. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const itemsWhere = (predicate: (logic: Record<string, unknown>) => boolean) =>
  EQUIPMENT.filter((item) => item.logic && predicate(item.logic as Record<string, unknown>));

const firstItemWhere = (predicate: (logic: Record<string, unknown>) => boolean) => itemsWhere(predicate)[0];

describe("authored equipment logic (issue #31)", () => {
  it("accepts only authored triggers", () => {
    expect(readTrigger({ trigger: "onHit" })).toBe("onHit");
    expect(readTrigger({ trigger: "combatStart" })).toBe("combatStart");
    expect(readTrigger({ trigger: "madeUp" })).toBeNull();
    expect(readTrigger("onHit")).toBeNull();
    expect(readTrigger(null)).toBeNull();
  });

  it("reports executed versus unmapped triggers and unsupported fields", () => {
    const coverage = logicCoverage();
    expect(coverage.executable).toContain("passive");
    expect(coverage.executable).toContain("onHit");
    expect(coverage.executable).toContain("combatStart");
    expect(coverage.unmapped).toContain("periodic");
    expect(coverage.unsupportedFields.length).toBeGreaterThan(0);
    const all = [...coverage.executable, ...coverage.unmapped];
    expect(new Set(all).size).toBe(all.length);
    for (const trigger of all) expect(EQUIPMENT_TRIGGERS).toContain(trigger);
  });

  it("maps combatStart shields and passive damage windows only", () => {
    const openShield = firstItemWhere((l) => l.trigger === "combatStart" && typeof l.shield === "number");
    expect(openShield).toBeDefined();
    expect(resolveEquipmentLogic([openShield!.id]).startShield).toBeGreaterThan(0);

    const low = firstItemWhere((l) => l.trigger === "passive" && typeof l.bonusDmgVsLowHp === "number");
    const high = firstItemWhere((l) => l.trigger === "passive" && typeof l.bonusDmgVsHighHp === "number");
    if (low) {
      const logic = resolveEquipmentLogic([low.id]);
      expect(logicDamageMultiplier(logic, LOW_HP_THRESHOLD - 0.05)).toBeGreaterThan(1);
      expect(logicDamageMultiplier(logic, 0.9)).toBe(1);
    }
    if (high) {
      const logic = resolveEquipmentLogic([high.id]);
      expect(logicDamageMultiplier(logic, HIGH_HP_THRESHOLD + 0.05)).toBeGreaterThan(1);
      expect(logicDamageMultiplier(logic, 0.1)).toBe(1);
    }
    expect(logicDamageMultiplier(EMPTY_EQUIPMENT_LOGIC, 0.5)).toBe(1);
    expect(resolveEquipmentLogic([])).toEqual(EMPTY_EQUIPMENT_LOGIC);
  });

  it("does not invent a shield for hpThreshold payloads", () => {
    const conditional = firstItemWhere((l) => l.trigger === "hpThreshold" && typeof l.shield === "number");
    expect(conditional).toBeDefined();
    const logic = resolveEquipmentLogic([conditional!.id]);
    expect(logic.startShield).toBe(0);
    expect(logic).toEqual(EMPTY_EQUIPMENT_LOGIC);
  });

  it("maps on-hit heal and capped atk stacks", () => {
    const healer = firstItemWhere((l) => l.trigger === "onHit" && typeof l.healOnDmgPct === "number");
    expect(healer).toBeDefined();
    expect(resolveEquipmentLogic([healer!.id]).healOnDmgPct).toBeGreaterThan(0);

    const stacker = firstItemWhere((l) => l.trigger === "onHit" && l.stackBuff === "atk");
    expect(stacker).toBeDefined();
    const logic = resolveEquipmentLogic([stacker!.id]);
    expect(logic.atkStackPct).toBeGreaterThan(0);
    expect(logic.atkStackMax).toBeGreaterThan(0);
  });

  it("rolls chance procs deterministically and never without a chance", () => {
    const chancy = firstItemWhere((l) => l.trigger === "onSkillUse" && typeof l.chance === "number" && typeof l.gainRage === "number");
    const flat = firstItemWhere((l) => l.trigger === "onSkillUse" && l.chance === undefined && typeof l.gainRage === "number");
    if (flat) expect(resolveEquipmentLogic([flat.id]).rageOnSkill).toBeGreaterThan(0);
    if (chancy) {
      const logic = resolveEquipmentLogic([chancy!.id]);
      expect(logic.skillProcChance).toBeGreaterThan(0);
      const a = Array.from({ length: 30 }, (() => { const r = mulberry32(19); return () => rollSkillProc(logic, r); })());
      const b = Array.from({ length: 30 }, (() => { const r = mulberry32(19); return () => rollSkillProc(logic, r); })());
      expect(a).toEqual(b);
    }
    expect(rollSkillProc(EMPTY_EQUIPMENT_LOGIC, mulberry32(1))).toBe(0);
  });

  it("carries logic onto the fighter and removes it when the item is unequipped", () => {
    const openShield = firstItemWhere((l) => l.trigger === "combatStart" && typeof l.shield === "number");
    const base = { uid: "u1", baseId: "ant_guard", star: 1, row: 0, col: 4 };
    const equipped = makeFighter({ ...base, equips: [openShield!.id] }, "L");
    const bare = makeFighter({ ...base, equips: [] }, "L");
    expect(equipped.logic.startShield).toBeGreaterThan(0);
    expect(bare.logic).toEqual(EMPTY_EQUIPMENT_LOGIC);
    expect(bare.shield).toBeLessThan(equipped.shield);
  });

  it("applies capped atk stacks during a real fight", () => {
    const stacker = firstItemWhere((l) => l.trigger === "onHit" && l.stackBuff === "atk");
    const logic = resolveEquipmentLogic([stacker!.id]);
    const left = [{ uid: "a", baseId: "ant_guard", star: 1, row: 0, col: 4, equips: [stacker!.id] }];
    const right = [{ uid: "b", baseId: "ant_guard", star: 1, row: 0, col: 5, equips: [] }];
    const result = simulate(materializeCombat(left, right), { seed: 7 });
    const fighter = result.fighters.find((f) => f.uid === "a")!;
    const stacks = fighter.mods.filter((m) => String(m.stackKey ?? "").startsWith("logic:atk:")).length;
    expect(stacks).toBeGreaterThan(0);
    expect(stacks).toBeLessThanOrEqual(logic.atkStackMax);
  });

  it("replays identically with logic active", () => {
    const openShield = firstItemWhere((l) => l.trigger === "combatStart" && typeof l.shield === "number");
    const build = () => materializeCombat(
      [{ uid: "a", baseId: "ant_guard", star: 1, row: 0, col: 4, equips: [openShield!.id] }],
      [{ uid: "b", baseId: "ant_guard", star: 1, row: 0, col: 5, equips: [] }],
    );
    const one = simulate(build(), { seed: 7 });
    const two = simulate(build(), { seed: 7 });
    expect(two.events).toEqual(one.events);
    expect(two.fighters.map((f) => [f.uid, f.hp, f.shield])).toEqual(one.fighters.map((f) => [f.uid, f.hp, f.shield]));
  });

  it("describes active effects for tooltips", () => {
    const openShield = firstItemWhere((l) => l.trigger === "combatStart" && typeof l.shield === "number");
    expect(equipmentLogicSummary([openShield!.id]).join(" ")).toMatch(/khiên/i);
    expect(equipmentLogicSummary([])).toEqual([]);
  });
});
