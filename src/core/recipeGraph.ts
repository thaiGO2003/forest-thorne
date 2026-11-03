// Recipe relationship helpers shared by the workbench, item info and crafting library.
// Pure data: no DOM, no gameplay mutation.
import { BASE_MATERIALS, RECIPES, type Recipe } from "./itemRegistry";

export interface IngredientCount {
  id: string;
  count: number;
}

export interface RecipeNode {
  id: string;
  count: number;
  recipe: Recipe | null;
  children: RecipeNode[];
}

export const outputIdForRecipe = (recipe: Recipe): string => recipe.outputId;
export const isBaseMaterial = (id: string): boolean => (BASE_MATERIALS as readonly string[]).includes(id);

export function recipeForOutput(outputId: string): Recipe | null {
  if (!outputId.startsWith("eq_")) return null;
  const id = outputId.slice(3);
  return RECIPES.find((recipe) => recipe.id === id) ?? null;
}

export function recipesUsing(itemId: string): Recipe[] {
  return RECIPES.filter((recipe) => recipe.pattern.includes(itemId));
}

/** Unique ingredient counts in authored order. */
export function recipeIngredients(recipe: Recipe): IngredientCount[] {
  const counts = new Map<string, number>();
  for (const cell of recipe.pattern) if (cell) counts.set(cell, (counts.get(cell) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

/** Ingredient shortfall for a bag; empty when the recipe can be crafted right now. */
export function missingIngredients(recipe: Recipe, bag: Readonly<Record<string, number>>): IngredientCount[] {
  return recipeIngredients(recipe).filter((ingredient) => (bag[ingredient.id] ?? 0) < ingredient.count);
}

export const isRecipeCraftable = (recipe: Recipe, bag: Readonly<Record<string, number>>): boolean =>
  missingIngredients(recipe, bag).length === 0;

/**
 * A7 ranking: craftable recipes first so the list answers "what can I build now".
 * Craftable rows are ordered by smaller footprint, then by a stable key, so pagination
 * never reshuffles a page between renders; uncraftable rows keep the same stable order.
 */
export function rankRecipesCraftable<T extends Recipe>(
  recipes: readonly T[],
  bag: Readonly<Record<string, number>>,
): T[] {
  const stable = (a: T, b: T) => a.size - b.size || a.outputId.localeCompare(b.outputId) || a.id.localeCompare(b.id);
  const craftable: T[] = [];
  const blocked: T[] = [];
  for (const recipe of recipes) (isRecipeCraftable(recipe, bag) ? craftable : blocked).push(recipe);
  craftable.sort(stable);
  blocked.sort(stable);
  return [...craftable, ...blocked];
}

/** Recursive base-material bill of materials for an equipment output. */
export function baseIngredients(outputId: string): IngredientCount[] {
  const totals = new Map<string, number>();
  const visit = (id: string, quantity: number, stack: ReadonlySet<string>) => {
    const recipe = recipeForOutput(id);
    if (!recipe) {
      totals.set(id, (totals.get(id) ?? 0) + quantity);
      return;
    }
    if (stack.has(id)) return;
    const next = new Set(stack).add(id);
    for (const ingredient of recipeIngredients(recipe)) visit(ingredient.id, quantity * ingredient.count, next);
  };
  visit(outputId, 1, new Set());
  return [...totals]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Expand an equipment output into a depth-limited ingredient tree. */
export function recipeTree(outputId: string, depth = 4): RecipeNode | null {
  const rootRecipe = recipeForOutput(outputId);
  if (!rootRecipe) return null;
  const build = (id: string, count: number, level: number, stack: ReadonlySet<string>): RecipeNode => {
    const recipe = recipeForOutput(id);
    if (!recipe || level >= depth || stack.has(id)) return { id, count, recipe, children: [] };
    const next = new Set(stack).add(id);
    return {
      id,
      count,
      recipe,
      children: recipeIngredients(recipe).map((ingredient) => build(ingredient.id, count * ingredient.count, level + 1, next)),
    };
  };
  return build(outputId, 1, 0, new Set());
}
