import { describe, expect, it } from "vitest";
import { getUnit, UNITS } from "../src/content/catalog";
import { BASE_MATERIALS } from "../src/core/craft";
import { applyOutcome, lossDamage, materialCandidates, rollLoot, type RewardTarget } from "../src/core/loot";

const seq = (...v: number[]) => () => v.shift() ?? 0.99;
const target = (): RewardTarget => ({ gold: 0, hp: 10, xpGain: 0, itemBag: [], winStreak: 0, loseStreak: 0, winGoldBonus: 1, appliedCombats: [] });

describe("loot", () => {
  it("every unit yields ≥1 valid base material candidate, deduplicated", () => {
    for (const u of UNITS) {
      const c = materialCandidates(u);
      expect(c.length).toBeGreaterThan(0);
      expect(new Set(c).size).toBe(c.length);
      for (const m of c) expect(BASE_MATERIALS as readonly string[]).toContain(m);
    }
  });

  it("first candidate always drops; extras gated by tier chance; no fabricated extras", () => {
    const id = UNITS.find((u) => materialCandidates(u).length === 1)!.id;
    expect(rollLoot(id, 1, seq(0.99)).map((d) => d.rule)).toEqual(["material"]);
    const multi = UNITS.find((u) => materialCandidates(u).length >= 2)!.id;
    expect(rollLoot(multi, 1, seq(0, 0.99, 0.99)).filter((d) => d.rule === "material").length).toBe(2);
  });

  it("equipment tier = clamp(star,1,3); empty pool drops nothing", () => {
    const id = UNITS[0]!.id;
    const pool = { 1: ["a1"], 2: ["b2"], 3: [] };
    const extra = materialCandidates(getUnit(id)).length - 1;
    const r = (star: number) => rollLoot(id, star, seq(...Array(extra).fill(0.99), 0.01, 0), pool).filter((d) => d.rule === "equipment").map((d) => d.item);
    expect([r(1), r(2), r(3)]).toEqual([["a1"], ["b2"], []]);
  });

  it("damage rules", () => {
    expect([lossDamage("onePerLoss", 5), lossDamage("survivorCount", 5), lossDamage("clamped", 7), lossDamage("clamped", 0)]).toEqual([1, 5, 4, 0]);
  });

  it("win gold = enemy count + star bonus + bounty + winGoldBonus; idempotent; capacity-bounded loot", () => {
    const t = target();
    const drops = ["x", "y", "z"].map((item) => ({ item, source: "s", rule: "material" as const }));
    const o = { combatId: "c1", won: true, enemySurvivors: 0, enemyStars: [1, 2, 3], bounty: 2, drops };
    const r = applyOutcome(t, o, 2, "clamped")!;
    expect(r.gold).toBe(3 + 3 + 2 + 1);
    expect(t.itemBag).toEqual(["x", "y"]);
    expect(r.rejected.map((d) => d.item)).toEqual(["z"]);
    expect(t.xpGain).toBe(2);
    expect(applyOutcome(t, o, 9, "clamped")).toBeNull();
    expect(t.gold).toBe(9);
  });

  it("loss pays bounty, applies mode damage, flips streak", () => {
    const t = target();
    t.winStreak = 3;
    applyOutcome(t, { combatId: "c2", won: false, enemySurvivors: 3, enemyStars: [1], bounty: 1, drops: [] }, 5, "survivorCount");
    expect([t.gold, t.hp, t.winStreak, t.loseStreak]).toEqual([1, 7, 0, 1]);
  });
});
