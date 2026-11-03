import { describe, expect, it } from "vitest";
import { BASE_MATERIALS, RECIPES } from "../src/core/itemRegistry";
import {
  isRecipeCraftable, missingIngredients, rankRecipesCraftable, recipeIngredients,
} from "../src/core/recipeGraph";

const stockedBag = (): Record<string, number> => {
  const bag: Record<string, number> = {};
  for (const id of BASE_MATERIALS) bag[id] = 12;
  return bag;
};

describe("craftable-first recipe ranking (A7)", () => {
  it("reports the ingredient shortfall and craftability against a bag", () => {
    const recipe = RECIPES.find((r) => r.size === 1) ?? RECIPES[0]!;
    expect(missingIngredients(recipe, {})).toEqual(recipeIngredients(recipe));
    expect(isRecipeCraftable(recipe, {})).toBe(false);

    const bag = { ...stockedBag() };
    for (const ingredient of recipeIngredients(recipe)) bag[ingredient.id] = ingredient.count;
    expect(missingIngredients(recipe, bag)).toEqual([]);
    expect(isRecipeCraftable(recipe, bag)).toBe(true);
  });

  it("puts every craftable recipe before the blocked ones", () => {
    const bag = stockedBag();
    const ranked = rankRecipesCraftable(RECIPES, bag);
    const firstBlocked = ranked.findIndex((recipe) => !isRecipeCraftable(recipe, bag));
    expect(firstBlocked).toBeGreaterThan(0);
    expect(ranked.slice(firstBlocked).every((recipe) => !isRecipeCraftable(recipe, bag))).toBe(true);
    expect(ranked.slice(0, firstBlocked).every((recipe) => isRecipeCraftable(recipe, bag))).toBe(true);
  });

  it("orders each group by footprint then a stable key so pagination never reshuffles", () => {
    const bag = stockedBag();
    const once = rankRecipesCraftable(RECIPES, bag);
    const twice = rankRecipesCraftable(RECIPES, bag);
    expect(twice.map((r) => r.id)).toEqual(once.map((r) => r.id));

    for (let i = 1; i < once.length; i++) {
      const prev = once[i - 1]!;
      const next = once[i]!;
      const prevCraftable = isRecipeCraftable(prev, bag);
      const nextCraftable = isRecipeCraftable(next, bag);
      if (prevCraftable !== nextCraftable) {
        expect(prevCraftable).toBe(true);
        continue;
      }
      const ordered = prev.size < next.size
        || (prev.size === next.size && prev.outputId.localeCompare(next.outputId) <= 0);
      expect(ordered).toBe(true);
    }
  });

  it("keeps the first page craftable-first for a six-row page", () => {
    const bag = stockedBag();
    const ranked = rankRecipesCraftable(RECIPES, bag);
    const firstPage = ranked.slice(0, 6);
    expect(firstPage.length).toBe(6);
    expect(firstPage.every((recipe) => isRecipeCraftable(recipe, bag))).toBe(true);
  });

  it("does not drop or duplicate recipes while ranking", () => {
    const bag = stockedBag();
    const ranked = rankRecipesCraftable(RECIPES, bag);
    expect(ranked).toHaveLength(RECIPES.length);
    expect(new Set(ranked.map((r) => r.id)).size).toBe(RECIPES.length);
  });
});
