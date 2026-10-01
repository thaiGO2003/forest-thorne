import { describe, expect, it } from "vitest";
import {
  addXp, benchCapacity, deployCap, refreshCost, roundIncome, sellValue, shopTierOdds, xpBuyCost,
} from "../src/core/economy";
import { BOSSES, NORMAL_UNITS, UNITS } from "../src/content/catalog";

describe("XP and level (A3)", () => {
  it("carries overflow across multiple level-ups", () => {
    // L1 needs 2, L2 needs 4, L3 needs 6: 10 XP → L3 with 4 left.
    expect(addXp(1, 0, 10)).toEqual({ level: 3, xp: 4 });
  });
  it("stops at the end of the authored table", () => {
    expect(addXp(26, 0, 10_000)).toEqual({ level: 26, xp: 10_000 });
  });
  it("XP cost never drops below 1", () => {
    expect(xpBuyCost(-10)).toBe(1);
  });
});

describe("caps (A2)", () => {
  it("deploy cap starts at 3 and never exceeds 25 cells", () => {
    expect(deployCap(1)).toBe(3);
    expect(deployCap(30, 5)).toBe(25);
  });
  it("bench caps at 44 perimeter slots; Creative reserves one", () => {
    expect(benchCapacity(0)).toBe(8);
    expect(benchCapacity(10, 5)).toBe(44);
    expect(benchCapacity(0, 0, true)).toBe(7);
  });
});

describe("shop (A3)", () => {
  it("refresh cost by level band, floor 1", () => {
    expect([10, 11, 16, 21].map((l) => refreshCost(l))).toEqual([2, 3, 4, 5]);
    expect(refreshCost(1, -5)).toBe(1);
  });
  it("tier odds: level 1 forced, every level sums to exactly 1", () => {
    expect(shopTierOdds(1)).toEqual([1, 0, 0, 0, 0]);
    for (let l = 1; l <= 25; l++) {
      const sum = shopTierOdds(l).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 1e4)).toBe(1e4);
    }
    expect(shopTierOdds(25)[4]!).toBeGreaterThan(shopTierOdds(25)[0]!);
  });
  it("sell multiplier is 1/3/5 and separate from stat scaling", () => {
    expect([1, 2, 3].map((s) => sellValue(4, s))).toEqual([4, 12, 20]);
  });
});

describe("round income (A5)", () => {
  it("interest capped, larger streak bonus wins", () => {
    // base 5 + interest min(5, 5) + streak floor(5/2)=2
    expect(roundIncome(55, 5, 0)).toBe(12);
    // gold 29 → 2 interest; lose streak 7 → capped 3
    expect(roundIncome(29, 0, 7)).toBe(10);
  });
  it("interest-rate bonus still respects cap; negative gold earns none", () => {
    expect(roundIncome(70, 0, 0, 5, { interestRateBonus: 0.02 })).toBe(10);
    expect(roundIncome(-20, 1, 1)).toBe(5);
  });
});

describe("catalog (A42/A83)", () => {
  it("has 120 normal units and 5 bosses with unique ids", () => {
    expect(NORMAL_UNITS).toHaveLength(120);
    expect(BOSSES).toHaveLength(5);
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(125);
  });
});
