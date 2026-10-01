import { describe, expect, it } from "vitest";
import { activeIndices, craft, matchRecipe, type Recipe } from "../src/core/craft";
import { createRun, research } from "../src/core/run";
import { canResearch, researchCost, TECH_BY_ID, techModifiers } from "../src/core/tech";

describe("tech A8", () => {
  it("prereqs mandatory, max respected, infinite cost formula", () => {
    expect(canResearch({}, "breed", 99)).toBe(false);
    expect(canResearch({ vet: 1 }, "breed", 99)).toBe(true);
    expect(canResearch({ vet: 1 }, "vet", 99)).toBe(false);
    expect(canResearch({ survive: 1 }, "alpha_doctrine", 99)).toBe(false);
    expect(canResearch({ survive: 1, beast: 1 }, "alpha_doctrine", 99)).toBe(true);
    expect(researchCost(TECH_BY_ID.get("survive")!, 4)).toBe(22);
    expect(researchCost(TECH_BY_ID.get("fitness")!, 2)).toBe(8);
  });
  it("modifiers sum per level incl. arcane level split", () => {
    expect(techModifiers({ fitness: 3, beast: 2 })).toEqual({ hpPct: 9, atkPct: 4, critPct: 2 });
    expect(techModifiers({ arcane: 2 })).toEqual({ matkPct: 8, mdefPct: 8 });
    expect(techModifiers({ survive: 3 }).startShield).toBe(45);
  });
  it("research on run is atomic and raises craft table", () => {
    const s = createRun(1);
    s.gold = 4;
    expect(research(s, "craft_t")).toBe(false);
    expect(s.gold).toBe(4);
    s.gold = 30;
    expect(research(s, "craft_t")).toBe(true);
    expect(research(s, "craft_t")).toBe(true);
    expect([s.craftTableLevel, s.gold]).toEqual([2, 15]);
    s.gold = 100;
    research(s, "explore");
    research(s, "bench_up");
    expect([s.benchBonus, s.benchUpgradeLevel]).toEqual([2, 1]);
  });
});

describe("craft A7", () => {
  const two: Recipe = { id: "x", size: 2, pattern: ["claw", null, null, "claw"] };
  it("active grid by level", () => {
    expect(activeIndices(0)).toEqual([]);
    expect(activeIndices(1)).toEqual([4]);
    expect(activeIndices(2)).toEqual([0, 1, 3, 4]);
    expect(activeIndices(3)).toHaveLength(9);
  });
  it("1x1 recipe slides; extra ingredient invalidates", () => {
    const g = Array(9).fill(null);
    g[8] = "tear";
    expect(matchRecipe(g, 3)?.id).toBe("blue_buff");
    g[0] = "claw";
    expect(matchRecipe(g, 3)).toBeNull();
    expect(matchRecipe(["claw", null, null, null, "claw", null, null, null, null], 3, [two])?.id).toBe("x");
    expect(matchRecipe(["claw", null, null, null, "claw", null, null, null, null], 1, [two])).toBeNull();
  });
  it("commit atomic; failure leaves bag identical", () => {
    const s = { itemBag: ["claw", "tear"], craftTableLevel: 1, craftHistory: [] as string[] };
    const g = Array(9).fill(null);
    g[4] = "feather";
    expect(craft(s, g)).toBeNull();
    expect(s.itemBag).toEqual(["claw", "tear"]);
    g[4] = "tear";
    expect(craft(s, g)).toBe("eq_blue_buff");
    expect(s.itemBag).toEqual(["claw", "eq_blue_buff"]);
    expect(s.craftHistory).toEqual(["blue_buff"]);
    expect(craft(s, g)).toBeNull();
  });
});
