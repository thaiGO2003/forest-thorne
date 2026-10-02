import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  attackRangeKind, canonicalShopRoster, combatPower, relativePowerRatios, sharedUnitReadout, starStatMilestones, teamStrength,
} from "../src/core/inspection";
import { equipmentRecommendationScore, recommendEquipment, type RecommendationRecipe } from "../src/core/recommendations";

describe("shared inspection + power metrics", () => {
  it("uses one 1★/2★/3★ stat milestone model and deterministic range/accuracy baselines", () => {
    const unit = NORMAL_UNITS[0]!;
    const m = starStatMilestones(unit);
    expect(m.map((x) => x.star)).toEqual([1, 2, 3]);
    expect(m[1]!.hp).toBe(Math.round(unit.stats.hp * 1.6));
    expect(attackRangeKind(Number.NaN)).toBe("melee");
    expect(sharedUnitReadout(unit).accuracyReadout).toBeGreaterThanOrEqual(90);
  });

  it("implements exact combat power, dead=0, relative ratio and team totals", () => {
    const u = { hp: 100, maxHp: 100, shield: 20, atk: 10, matk: 5, def: 4, mdef: 3, star: 2, tier: 3, alive: true };
    const expected = Math.round(100 * .45 + 20 * .20 + 10 * 6 + 5 * 6 + 4 * 4 + 3 * 4 + 2 * 90 + 3 * 40);
    expect(combatPower(u)).toBe(expected);
    expect(combatPower({ ...u, alive: false })).toBe(0);
    expect(relativePowerRatios([u, { ...u, hp: 50 }])[0]).toBe(1);
    const team = teamStrength([u, { ...u, hp: 0, alive: false }]);
    expect(team).toMatchObject({ units: 2, hp: 100, maxHp: 200, hpRatio: 0.5, power: expected });
    expect(team.maxPower).toBeGreaterThan(0);
  });

  it("sorts canonical shop roster by tier then role then stable id", () => {
    const roster = canonicalShopRoster();
    for (let i = 1; i < roster.length; i++) expect(roster[i]!.tier).toBeGreaterThanOrEqual(roster[i - 1]!.tier);
    expect(canonicalShopRoster(1).every((unit) => unit.tier === 1)).toBe(true);
  });
});

describe("equipment recommendations", () => {
  const recipes: RecommendationRecipe[] = [
    { id: "atk", name: "Blade", tier: 3, description: "crit onhit", bonuses: { atkPct: .12, critPct: .08, attackSpeedPct: .05 } },
    { id: "magic", name: "Orb", tier: 3, description: "magic mana burn", bonuses: { matkPct: .15, rageGainPct: .05 } },
    { id: "tank", name: "Wall", tier: 3, description: "hp shield block", bonuses: { hpPct: .18, defPct: .10, blockPct: .08 } },
    { id: "other", name: "T4", tier: 4, bonuses: { atkPct: 1 } },
  ];

  it("strongly prefers physical/magic/tank families for their matching roles", () => {
    expect(recommendEquipment({ role: "ARCHER", skillDamageType: "physical" }, recipes)[0]?.id).toBe("atk");
    expect(recommendEquipment({ role: "MAGE", skillDamageType: "magic" }, recipes)[0]?.id).toBe("magic");
    expect(recommendEquipment({ role: "TANKER" }, recipes)[0]?.id).toBe("tank");
  });

  it("filters exact tier before scoring and rejects non-finite scoring", () => {
    expect(recommendEquipment({ role: "ARCHER" }, recipes, 4).map((recipe) => recipe.id)).toEqual(["other"]);
    expect(equipmentRecommendationScore({ role: "ARCHER" }, { id: "x", name: "X", tier: 3, bonuses: { atkPct: Number.NaN } })).not.toBeNull();
  });
});
