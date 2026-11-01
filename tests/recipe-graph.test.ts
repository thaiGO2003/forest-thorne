import { describe, expect, it } from "vitest";
import { BASE_MATERIALS, RECIPES } from "../src/core/craft";
import {
  baseIngredients, isBaseMaterial, outputIdForRecipe, recipeForOutput, recipeIngredients, recipeTree, recipesUsing,
} from "../src/core/recipeGraph";

describe("recipe relationship graph", () => {
  it("resolves recipe/output identities in both directions", () => {
    const recipe = RECIPES.find((entry) => entry.id === "aegis_oath")!;
    expect(outputIdForRecipe(recipe)).toBe("eq_aegis_oath");
    expect(recipeForOutput("eq_aegis_oath")?.id).toBe("aegis_oath");
    expect(recipeForOutput("bark")).toBeNull();
    expect(recipeIngredients(recipe)).toEqual([
      { id: "eq_bramble_vest", count: 1 },
      { id: "bark", count: 1 },
      { id: "belt", count: 1 },
      { id: "crystal", count: 1 },
    ]);
    expect(recipesUsing("eq_bramble_vest").map((entry) => entry.id)).toContain("aegis_oath");
  });

  it("reduces every crafted item to base materials only", () => {
    const bases = new Set<string>(BASE_MATERIALS);
    for (const recipe of RECIPES) {
      const breakdown = baseIngredients(outputIdForRecipe(recipe));
      expect(breakdown.length, recipe.id).toBeGreaterThan(0);
      for (const ingredient of breakdown) {
        expect(bases.has(ingredient.id), `${recipe.id} → ${ingredient.id}`).toBe(true);
        expect(ingredient.count).toBeGreaterThan(0);
      }
    }
  });

  it("builds a depth-limited tree with multiplied quantities", () => {
    const tree = recipeTree("eq_aegis_oath", 3)!;
    expect(tree.recipe?.id).toBe("aegis_oath");
    const bramble = tree.children.find((node) => node.id === "eq_bramble_vest");
    expect(bramble?.count).toBe(1);
    expect(bramble?.children.every((node) => isBaseMaterial(node.id))).toBe(true);
    expect(tree.children.filter((node) => isBaseMaterial(node.id)).map((node) => node.id)).toEqual(["bark", "belt", "crystal"]);
  });

  it("never loops on the full catalog", () => {
    for (const recipe of RECIPES) {
      expect(() => recipeTree(outputIdForRecipe(recipe), 8)).not.toThrow();
    }
  });
});
