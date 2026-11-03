import { describe, expect, it } from "vitest";
import {
  assignEnemyEquipment, enemyEquipmentBudget, enemyEquipmentPool, enemyMaxTier, equipmentCost,
  ENEMY_EQUIPMENT_BUDGET_SHARE,
} from "../src/core/enemyEquipment";
import { generateEncounter, encounterBudget } from "../src/core/encounter";
import { EQUIPMENT } from "../src/core/itemRegistry";

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

describe("enemy equipment selection (issue #40)", () => {
  it("prices gear with the canonical equipment value", () => {
    expect(equipmentCost(1)).toBe(1);
    expect(equipmentCost(2)).toBe(4);
    expect(equipmentCost(3)).toBe(12);
  });

  it("derives budget and tier from the encounter, not from invented constants", () => {
    expect(enemyEquipmentBudget(0)).toBe(0);
    expect(enemyEquipmentBudget(40)).toBe(Math.floor(40 * ENEMY_EQUIPMENT_BUDGET_SHARE));
    expect(enemyEquipmentBudget(-5)).toBe(0);
    expect(enemyMaxTier(1)).toBe(1);
    expect(enemyMaxTier(8)).toBe(3);
    expect(enemyMaxTier(40)).toBe(3);
    expect(enemyMaxTier(1, -3)).toBe(1);
  });

  it("never spends more than the budget", () => {
    for (const budget of [0, 1, 3, 9, 25, 60]) {
      const result = assignEnemyEquipment({ count: 9, budget, maxTier: 3, rng: mulberry32(11) });
      expect(result.spent).toBeLessThanOrEqual(budget);
      const cost = result.assignments.flat().reduce((sum, id) => {
        const item = EQUIPMENT.find((e) => e.id === id)!;
        return sum + equipmentCost(item.tier);
      }, 0);
      expect(cost).toBe(result.spent);
    }
  });

  it("replays the same gear for a seed and differs across seeds", () => {
    const run = (seed: number) => assignEnemyEquipment({ count: 8, budget: 30, maxTier: 3, rng: mulberry32(seed) });
    expect(run(7)).toEqual(run(7));
    const a = run(7).assignments.flat();
    const b = run(8).assignments.flat();
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("returns no gear for an empty pool or a zero budget", () => {
    const emptyPool = assignEnemyEquipment({ count: 5, budget: 50, maxTier: 0, rng: mulberry32(1) });
    expect(emptyPool.poolSize).toBe(0);
    expect(emptyPool.assignments.every((list) => list.length === 0)).toBe(true);
    expect(emptyPool.spent).toBe(0);

    const noBudget = assignEnemyEquipment({ count: 5, budget: 0, maxTier: 3, rng: mulberry32(1) });
    expect(noBudget.spent).toBe(0);
    expect(noBudget.assignments.every((list) => list.length === 0)).toBe(true);

    expect(enemyEquipmentPool(3).length).toBeGreaterThan(0);
    expect(enemyEquipmentPool(2).every((item) => item.tier <= 2)).toBe(true);
  });

  it("never assigns an item above the tier cap", () => {
    const result = assignEnemyEquipment({ count: 6, budget: 100, maxTier: 1, rng: mulberry32(3) });
    const ids = result.assignments.flat();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(EQUIPMENT.find((e) => e.id === id)!.tier).toBeLessThanOrEqual(1);
  });

  it("attaches gear to generated encounters and stays deterministic", () => {
    const build = (seed: number, mode: string) => generateEncounter({ round: 9, mode, rng: mulberry32(seed) });
    const first = build(5, "NORMAL");
    const again = build(5, "NORMAL");
    expect(again.units).toEqual(first.units);
    const geared = first.units.filter((u) => (u.equips ?? []).length > 0);
    expect(geared.length).toBeGreaterThan(0);
    const spent = geared.flatMap((u) => u.equips!).reduce((sum, id) => {
      const item = EQUIPMENT.find((e) => e.id === id)!;
      return sum + equipmentCost(item.tier);
    }, 0);
    expect(spent).toBeLessThanOrEqual(enemyEquipmentBudget(encounterBudget(9, "NORMAL")));
  });

  it("gives harder AI modes at least as much gear budget as easier ones", () => {
    const easy = generateEncounter({ round: 10, mode: "EASY", rng: mulberry32(2) });
    const hard = generateEncounter({ round: 10, mode: "HARD", rng: mulberry32(2) });
    const spend = (units: typeof easy.units) => units.flatMap((u) => u.equips ?? []).reduce((sum, id) => {
      const item = EQUIPMENT.find((e) => e.id === id)!;
      return sum + equipmentCost(item.tier);
    }, 0);
    expect(spend(hard.units)).toBeGreaterThanOrEqual(spend(easy.units));
    expect(enemyMaxTier(10, 1)).toBeGreaterThanOrEqual(enemyMaxTier(10, 0));
  });
});
