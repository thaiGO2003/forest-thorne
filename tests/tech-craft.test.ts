import { describe, expect, it } from "vitest";
import {
  activeIndices, availableItemStacks, craft, matchRecipe, prepopulateRecipe, recipeSuggestions, type Recipe,
} from "../src/core/craft";
import { createRun, expandBench, research } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
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
    skipTutorial(s);
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

  it("dedicated bench expansion finishes explore, bench upgrades, then barracks", () => {
    const s = createRun(2);
    skipTutorial(s);
    s.gold = 1_000;
    const purchased: Array<[number, number, number]> = [];
    for (let i = 0; i < 10; i++) {
      expect(expandBench(s)).toBe(true);
      purchased.push([
        s.techLevels.explore ?? 0,
        s.techLevels.bench_up ?? 0,
        s.techLevels.barracks ?? 0,
      ]);
    }
    expect(purchased[0]).toEqual([1, 0, 0]);
    expect(purchased[4]).toEqual([1, 4, 0]);
    expect(purchased[9]).toEqual([1, 4, 5]);
    expect([s.benchUpgradeLevel, s.benchBonus]).toEqual([4, 12]);
    expect(expandBench(s)).toBe(false);
  });

  it("bench expansion is atomic when the next stage cannot be afforded", () => {
    const s = createRun(3);
    skipTutorial(s);
    s.gold = 3;
    const before = structuredClone(s);
    expect(expandBench(s)).toBe(false);
    expect(s).toEqual(before);
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

  it("A86 subtracts staged reservations from available bag counts", () => {
    expect(availableItemStacks(
      ["tear", "claw", "tear", "bark", "tear", "claw"],
      ["tear", null, "claw", null, null, null, null, null, null],
    )).toEqual([
      { id: "tear", count: 2 },
      { id: "bark", count: 1 },
      { id: "claw", count: 1 },
    ]);
  });

  it("A86 ranks craftable, tier, ratio, have-count and name deterministically", () => {
    const recipes: Recipe[] = [
      { id: "partial-high", name: "Zulu", tier: 5, size: 2, pattern: ["tear", "tear", "tear", "tear"] },
      { id: "full-low", name: "Alpha", tier: 1, size: 1, pattern: ["claw"] },
      { id: "full-high-b", name: "Beta", tier: 4, size: 1, pattern: ["tear"] },
      { id: "full-high-a", name: "Alpha", tier: 4, size: 1, pattern: ["tear"] },
      { id: "missing", name: "Missing", tier: 9, size: 1, pattern: ["crystal"] },
    ];
    expect(recipeSuggestions(["tear", "tear", "claw"], recipes).map((x) => x.recipe.id)).toEqual([
      "full-high-a", "full-high-b", "full-low", "partial-high",
    ]);
    expect(recipeSuggestions(["tear", "tear", "claw"], recipes).find((x) => x.recipe.id === "partial-high"))
      .toMatchObject({ haveCount: 2, totalRequiredCopies: 4, ratio: 0.5, craftable: false });
  });

  it("A86 pre-populates through active-slot staging and full-bag requirements", () => {
    const one: Recipe = { id: "one", size: 1, pattern: ["tear"] };
    expect(prepopulateRecipe(["tear"], one, 1)).toEqual([null, null, null, null, "tear", null, null, null, null]);
    expect(prepopulateRecipe([], one, 1)).toBeNull();
    expect(prepopulateRecipe(["claw", "claw"], two, 1)).toBeNull();
    const staged = prepopulateRecipe(["claw", "claw"], two, 2)!;
    expect(matchRecipe(staged, 2, [two])).toBe(two);
  });
});
