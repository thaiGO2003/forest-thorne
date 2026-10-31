import { describe, expect, it } from "vitest";
import { activeIndices, craft, matchRecipe, stage, type CraftState, type Recipe } from "../src/core/craft";
import { craftRunItem, createRun, inventoryCapacity, research, stageRunCraftItem } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
import { getEquipment } from "../src/core/equipment";

const blank = (): (string | null)[] => Array(9).fill(null);
const makeState = (over: Partial<CraftState> = {}): CraftState => ({
  itemBag: [...(over.itemBag ?? [])],
  craftTableLevel: over.craftTableLevel ?? 1,
  craftHistory: [...(over.craftHistory ?? [])],
});
const counts = (bag: readonly string[]) => bag.reduce<Record<string, number>>((acc, id) => {
  acc[id] = (acc[id] ?? 0) + 1;
  return acc;
}, {});

/** The only authored recipe consumes one tear and produces one blue buff. */
const expectConserved = (after: Record<string, number>, before: Record<string, number>) => {
  const expected = { ...before };
  expected.tear = (expected.tear ?? 0) - 1;
  if (!expected.tear) delete expected.tear;
  expected.eq_blue_buff = 1;
  expect(after).toEqual(expected);
};

describe("craft staging contracts (A7)", () => {
  it("only active cells accept a staged item", () => {
    // Level 1 activates the centre cell (index 4) only.
    expect(activeIndices(1)).toEqual([4]);
    expect(stage(blank(), 4, "tear", 1)![4]).toBe("tear");
    for (const index of [0, 1, 3, 5, 8]) expect(stage(blank(), index, "tear", 1)).toBeNull();
  });

  it("staging is non-destructive: the previous grid is never mutated", () => {
    const first = stage(blank(), 4, "tear", 1)!;
    const second = stage(first, 4, "bark", 1)!;
    expect(first[4]).toBe("tear");
    expect(second[4]).toBe("bark");
    expect(first).not.toBe(second);
  });

  it("staged cells can be cleared with null", () => {
    const filled = stage(blank(), 4, "tear", 1)!;
    expect(stage(filled, 4, null, 1)![4]).toBeNull();
  });

  it("changing grid level re-scopes which cells exist", () => {
    // Index 0 is inactive at level 1 but part of the 2x2 footprint at level 2.
    expect(activeIndices(2)).toEqual([0, 1, 3, 4]);
    expect(stage(blank(), 0, "tear", 1)).toBeNull();
    expect(stage(blank(), 0, "tear", 2)![0]).toBe("tear");
  });
});

describe("craft commit contracts (A7)", () => {
  it("slides the 1x1 recipe across the active square and rejects stray ingredients", () => {
    for (const index of activeIndices(2)) {
      const staged = blank();
      staged[index] = "tear";
      expect(matchRecipe(staged, 2)?.id).toBe("blue_buff");
    }
    const stray = blank();
    stray[0] = "tear";
    stray[1] = "bark";
    expect(matchRecipe(stray, 2)).toBeNull();
  });

  it("successful craft consumes exactly the pattern and appends the output", () => {
    const s = makeState({ itemBag: ["tear", "bark"] });
    const staged = stage(blank(), 4, "tear", 1)!;
    expect(craft(s, staged)).toBe("eq_blue_buff");
    expect(s.itemBag).toEqual(["bark", "eq_blue_buff"]);
    expect(s.craftHistory).toEqual(["blue_buff"]);
    expect(getEquipment("eq_blue_buff")).not.toBeNull();
  });

  it("conserves the item multiset except for the recipe transform", () => {
    const s = makeState({ itemBag: ["tear", "tear", "bark"] });
    const staged = stage(blank(), 4, "tear", 1)!;
    const before = counts(s.itemBag);
    expect(craft(s, staged)).toBe("eq_blue_buff");
    expectConserved(counts(s.itemBag), before);
  });

  it("failed craft leaves the run untouched for every failure mode", () => {
    const noRecipe = makeState({ itemBag: ["bark"] });
    expect(craft(noRecipe, stage(blank(), 4, "bark", 1)!)).toBeNull();
    expect(noRecipe).toEqual(makeState({ itemBag: ["bark"] }));

    const missing = makeState({ itemBag: ["bark"] });
    expect(craft(missing, stage(blank(), 4, "tear", 1)!)).toBeNull();
    expect(missing).toEqual(makeState({ itemBag: ["bark"] }));

    const empty = makeState({ itemBag: ["tear"] });
    expect(craft(empty, blank())).toBeNull();
    expect(empty).toEqual(makeState({ itemBag: ["tear"] }));
  });

  it("ignores a staged layout no authored recipe can match", () => {
    const s = makeState({ itemBag: ["tear", "tear"] });
    const staged = blank();
    staged[0] = "tear";
    staged[1] = "tear";
    expect(craft(s, staged)).toBeNull();
    expect(s.itemBag).toEqual(["tear", "tear"]);
    expect(s.craftHistory).toEqual([]);
  });
  it("requires every copy of a repeated ingredient before consuming any resources", () => {
    // The authored recipe table has no tier-2 entries yet; inject a two-slot recipe to test multiset validation.
    const repeated: Recipe = { id: "two_tears", size: 2, pattern: ["tear", "tear", null, null] };
    const staged = stage(stage(blank(), 0, "tear", 2)!, 1, "tear", 2)!;
    const s = makeState({ itemBag: ["bark", "tear", "claw"], craftTableLevel: 2, craftHistory: ["previous"] });
    const bagBefore = s.itemBag;
    const historyBefore = s.craftHistory;

    expect(matchRecipe(staged, 2, [repeated])).toBe(repeated);
    expect(craft(s, staged, [repeated])).toBeNull();
    expect(s.itemBag).toBe(bagBefore);
    expect(s.craftHistory).toBe(historyBefore);
    expect(s.itemBag).toEqual(["bark", "tear", "claw"]);
    expect(s.craftHistory).toEqual(["previous"]);

    s.itemBag.push("tear");
    expect(craft(s, staged, [repeated])).toBe("eq_two_tears");
    expect(s.itemBag).toEqual(["bark", "claw", "eq_two_tears"]);
    expect(s.craftHistory).toEqual(["previous", "two_tears"]);
    expect(staged.filter((id) => id === "tear")).toHaveLength(2);
  });
});

describe("run crafting resource conservation", () => {
  it("rejects a full-bag craft missing its ingredient without changing run state", () => {
    const s = createRun(41);
    skipTutorial(s);
    s.craftTableLevel = 1;
    s.inventoryBonus = 3;
    s.itemBag = ["bark", "feather", "claw"];
    const staged = stageRunCraftItem(s, blank(), 4, "tear")!;
    const before = { bag: [...s.itemBag], history: [...s.craftHistory], seed: s.rngSeed };

    expect(s.itemBag).toHaveLength(inventoryCapacity(s));
    expect(craftRunItem(s, staged)).toBeNull();
    expect(s.itemBag).toEqual(before.bag);
    expect(s.craftHistory).toEqual(before.history);
    expect(s.rngSeed).toBe(before.seed);
    expect(staged[4]).toBe("tear");
  });

  it.each([7, 2026, 0x5eed])("conserves a seeded full bag through staging, grid upgrades and repeated crafts (%i)", (seed) => {
    const s = createRun(seed);
    skipTutorial(s);
    s.gold = 100;
    s.inventoryBonus = 4;
    s.itemBag = ["tear", "bark", "tear", "claw"];
    const bagBefore = [...s.itemBag];
    const seedBefore = s.rngSeed;
    expect(s.itemBag).toHaveLength(inventoryCapacity(s));

    expect(research(s, "craft_t")).toBe(true);
    const initiallyStaged = stageRunCraftItem(s, blank(), 4, "tear")!;
    expect(stageRunCraftItem(s, initiallyStaged, 0, "tear")).toBeNull();
    const cleared = stageRunCraftItem(s, initiallyStaged, 4, null)!;
    expect(cleared).toEqual(blank());
    expect(initiallyStaged[4]).toBe("tear");
    expect(s.itemBag).toEqual(bagBefore);
    expect(s.craftHistory).toEqual([]);

    expect(research(s, "craft_t")).toBe(true);
    expect(s.craftTableLevel).toBe(2);
    const repositioned = stageRunCraftItem(s, cleared, 0, "tear")!;
    const contaminated = stageRunCraftItem(s, repositioned, 1, "bark")!;
    expect(craftRunItem(s, contaminated)).toBeNull();
    expect(s.itemBag).toEqual(bagBefore);
    expect(s.craftHistory).toEqual([]);
    const valid = stageRunCraftItem(s, contaminated, 1, null)!;
    expect(valid[0]).toBe("tear");
    expect(craftRunItem(s, valid)).toBe("eq_blue_buff");
    expect(s.itemBag).toEqual(["bark", "tear", "claw", "eq_blue_buff"]);
    expect(s.craftHistory).toEqual(["blue_buff"]);
    expect(valid[0]).toBe("tear"); // External staging is cleared by its caller, not by the core transaction.

    expect(craftRunItem(s, blank())).toBeNull();
    expect(research(s, "craft_t")).toBe(true);
    expect(s.craftTableLevel).toBe(3);
    const finalStaging = stageRunCraftItem(s, blank(), 8, "tear")!;
    expect(craftRunItem(s, finalStaging)).toBe("eq_blue_buff");
    expect(counts(s.itemBag)).toEqual({ bark: 1, claw: 1, eq_blue_buff: 2 });
    expect(s.itemBag).toHaveLength(inventoryCapacity(s));
    expect(s.craftHistory).toEqual(["blue_buff", "blue_buff"]);
    expect(s.rngSeed).toBe(seedBefore);
  });
});
