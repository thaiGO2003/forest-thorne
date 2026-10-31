import { describe, expect, it } from "vitest";
import { activeIndices, craft, matchRecipe, stage, type CraftState } from "../src/core/craft";
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
});
