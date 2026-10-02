import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { applyAugment, augmentBand, augmentScore, AUGMENT_BY_ID, AUGMENTS } from "../src/core/augments";
import { createRun, playerCombatBonus } from "../src/core/run";
import { computeSynergies, counterMultiplier } from "../src/core/synergy";

const tankers = NORMAL_UNITS.filter((u) => u.role === "TANKER").map((u) => u.id);

describe("synergy A9", () => {
  it("thresholds 2/4/6 with current/active/next", () => {
    const line = (n: number, echo = 0) => computeSynergies(tankers.slice(0, n), echo).find((l) => l.key === "TANKER")!;
    expect([line(1).active, line(1).next]).toEqual([0, 2]);
    expect([line(3).active, line(3).next, line(3).bonus]).toEqual([2, 4, { def: 8, mdef: 6 }]);
    expect([line(6).active, line(6).next]).toEqual([6, null]);
    expect(line(3, 1).count).toBe(4);
    expect(line(3, 1).active).toBe(4);
  });
  it("virtual class count applies only to the stable most-numerous identity", () => {
    const first = NORMAL_UNITS[0]!;
    const second = NORMAL_UNITS.find((u) => u.role !== first.role)!;
    const lines = computeSynergies([first.id, second.id], 1);
    expect(lines.find((line) => line.kind === "class" && line.key === first.role)?.count).toBe(2);
    expect(lines.find((line) => line.kind === "class" && line.key === second.role)?.count).toBe(1);
  });
  it("counters: element and class edges stack at 0.5 each", () => {
    const find = (p: (u: (typeof NORMAL_UNITS)[number]) => boolean) => NORMAL_UNITS.find(p)!.id;
    const fireAssassin = NORMAL_UNITS.find((u) => u.element === "FIRE" && u.role === "ASSASSIN");
    const spiritMage = find((u) => u.element === "SPIRIT" && u.role === "MAGE");
    const swarm = find((u) => u.element === "SWARM" && u.role === "TANKER");
    expect(counterMultiplier(swarm, spiritMage)).toBe(1);
    if (fireAssassin) expect(counterMultiplier(fireAssassin.id, spiritMage)).toBe(2);
  });
});

describe("augments A10", () => {
  it("score bands match exact formula", () => {
    // gold flat 4: 43 + min(18, 9.2) + 2 = 54.2 -> 54
    expect(augmentScore(AUGMENT_BY_ID.get("gold_cache_1")!)).toBe(54);
    expect(augmentScore(AUGMENT_BY_ID.get("class_echo_1")!)).toBe(94);
    expect(augmentScore(AUGMENT_BY_ID.get("reroll_bargain_5")!)).toBe(76);
    expect([augmentBand(61), augmentBand(62), augmentBand(81), augmentBand(82)]).toEqual(["Tactical", "Strong", "Strong", "Rare"]);
    expect(AUGMENTS.every((a) => augmentScore(a) >= 0 && augmentScore(a) <= 100)).toBe(true);
  });
  it("apply once: immediate gold not repeated, modifiers accumulate", () => {
    const s = createRun(3);
    const g = s.gold;
    expect(applyAugment(s, "gold_cache_3")).toBe(true);
    expect(applyAugment(s, "gold_cache_3")).toBe(false);
    expect(s.gold).toBe(g + 8);
    applyAugment(s, "reroll_bargain_1");
    applyAugment(s, "reroll_bargain_5");
    expect([s.rollCostDelta, s.augmentMods.roll_cost_delta]).toEqual([-3, -3]);
    expect(applyAugment(s, "nope")).toBe(false);
  });
  it("materializes persistent augment values into canonical run/combat fields", () => {
    const s = createRun(4);
    applyAugment(s, "team_atk_1");
    applyAugment(s, "lifesteal_1");
    applyAugment(s, "interest_flow_1");
    applyAugment(s, "deploy_cap_1");
    applyAugment(s, "class_echo_1");
    expect(s).toMatchObject({
      teamAtkPct: 5, lifestealPct: 4, interestRateBonus: 0.01, deployCapBonus: 1, extraClassCount: 1,
    });
    expect(playerCombatBonus(s)).toMatchObject({ atkPct: 5, lifestealPct: 4 });
  });
});
