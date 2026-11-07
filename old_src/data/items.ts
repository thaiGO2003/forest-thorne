/**
 * items.js
 *
 * Loads all recipe files from data/items/**\/*.js via import.meta.glob.
 * Exports: BASE_ITEMS, CRAFT_RECIPES, EQUIPMENT_ITEMS, ITEM_BY_ID, RECIPE_BY_ID
 */

export interface ItemBonus {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ItemLogic {
  trigger?: string;
  chance?: number;
  gainRage?: number;
  healOnDmgPct?: number;
  stackBuff?: string;
  perStack?: number;
  maxStacks?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface BaseItem {
  id: string;
  name: string;
  icon: string;
  kind: "base";
  [key: string]: unknown;
}

export interface CraftRecipe {
  id: string;
  name: string;
  icon: string;
  tier: number;
  gridSize: number;
  pattern: Array<string | null>;
  requires: string[];
  bonus?: ItemBonus;
  description?: string;
  logic?: ItemLogic | null;
  [key: string]: unknown;
}

export interface EquipmentItem {
  id: string;
  name: string;
  icon: string;
  kind: "equipment";
  fromRecipe: string;
  bonus: ItemBonus;
  logic: ItemLogic | null;
  tier?: number;
  [key: string]: unknown;
}

export type ItemRecord = BaseItem | EquipmentItem;
export type ItemById = Record<string, ItemRecord>;
export type RecipeById = Record<string, CraftRecipe>;

interface RawRecipe {
  id?: unknown;
  name?: unknown;
  icon?: unknown;
  tier?: unknown;
  gridSize?: unknown;
  pattern?: unknown;
  requires?: unknown;
  bonus?: unknown;
  logic?: unknown;
  [key: string]: unknown;
}

interface RecipeModule {
  default?: RawRecipe;
}

export const BASE_ITEMS: BaseItem[] = [
  { id: "claw", name: "Răng Thú", icon: "🦷", kind: "base" },
  { id: "bark", name: "Gỗ Cứng", icon: "🪵", kind: "base" },
  { id: "crystal", name: "Pha Lê", icon: "🔮", kind: "base" },
  { id: "feather", name: "Lông Vũ", icon: "🪶", kind: "base" },
  { id: "tear", name: "Giọt Sương", icon: "💧", kind: "base" },
  { id: "belt", name: "Da Thú", icon: "🧥", kind: "base" }
];

// ═══════════════════════════════════════════════════════════════════════
//  Load recipe files from data/items/**\/*.js
// ═══════════════════════════════════════════════════════════════════════

const recipeModules = import.meta.glob<RecipeModule>("/data/items/**/*.js", { eager: true });

const CRAFT_RECIPES_RAW = Object.values(recipeModules)
  .map(mod => mod.default)
  .filter((recipe): recipe is RawRecipe => Boolean(recipe));

// ═══════════════════════════════════════════════════════════════════════
//  Normalization
// ═══════════════════════════════════════════════════════════════════════

function resolveGridSize(recipe: RawRecipe): number {
  const rawGridSize = Number(recipe.gridSize);
  const raw = Number.isFinite(rawGridSize) ? Math.floor(rawGridSize) : null;
  if (raw !== null && raw >= 1 && raw <= 3) return raw;
  if (Array.isArray(recipe.pattern) && recipe.pattern.length >= 9) return 3;
  if (Array.isArray(recipe.pattern) && recipe.pattern.length === 1) return 1;
  return 2;
}

function normalizePattern(pattern: unknown, gridSize: number, requires: string[] = []): Array<string | null> {
  const maxCells = gridSize * gridSize;
  if (Array.isArray(pattern) && pattern.length) {
    return Array.from({ length: maxCells }, (_, idx) => {
      const value = (pattern as unknown[])[idx];
      return typeof value === "string" ? value : null;
    });
  }
  const out = Array.from({ length: maxCells }, () => null as string | null);
  for (let i = 0; i < Math.min(maxCells, requires.length); i += 1) out[i] = requires[i] ?? null;
  return out;
}

function normalizeRecipe(recipe: RawRecipe): CraftRecipe {
  const gridSize = resolveGridSize(recipe);
  const rawTier = Number(recipe.tier);
  const tierRaw = Number.isFinite(rawTier) ? Math.floor(rawTier) : null;
  const tier = tierRaw && tierRaw >= 1 ? tierRaw : (gridSize >= 3 ? 3 : gridSize === 1 ? 1 : 2);
  const rawRequires = Array.isArray(recipe.requires)
    ? recipe.requires.filter((value): value is string => typeof value === "string" && Boolean(value))
    : [];
  const pattern = normalizePattern(recipe.pattern, gridSize, rawRequires);
  const requires = rawRequires.length ? rawRequires : pattern.filter((value): value is string => Boolean(value));
  return {
    ...recipe,
    id: String(recipe.id ?? ""),
    name: String(recipe.name ?? recipe.id ?? ""),
    icon: String(recipe.icon ?? "✨"),
    tier,
    gridSize,
    pattern,
    requires,
    bonus: recipe.bonus && typeof recipe.bonus === "object" && !Array.isArray(recipe.bonus)
      ? recipe.bonus as ItemBonus
      : undefined,
    logic: recipe.logic && typeof recipe.logic === "object" && !Array.isArray(recipe.logic)
      ? recipe.logic as ItemLogic
      : null
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Exports
// ═══════════════════════════════════════════════════════════════════════

export const CRAFT_RECIPES: CraftRecipe[] = CRAFT_RECIPES_RAW.map((recipe) => normalizeRecipe(recipe));

export const EQUIPMENT_ITEMS: EquipmentItem[] = CRAFT_RECIPES.map((recipe) => ({
  id: `eq_${recipe.id}`,
  name: recipe.name,
  icon: recipe.icon,
  kind: "equipment",
  fromRecipe: recipe.id,
  bonus: { ...(recipe.bonus ?? {}) },
  logic: recipe.logic ?? null,
  tier: recipe.tier
}));

export const ITEM_BY_ID: ItemById = Object.fromEntries([...BASE_ITEMS, ...EQUIPMENT_ITEMS].map((x) => [x.id, x]));
export const RECIPE_BY_ID: RecipeById = Object.fromEntries(CRAFT_RECIPES.map((x) => [x.id, x]));

// ═══════════════════════════════════════════════════════════════════════
//  Validation
// ═══════════════════════════════════════════════════════════════════════

function ingredientIsEquipment(id: string | null | undefined): boolean {
  return ITEM_BY_ID[id ?? ""]?.kind === "equipment";
}

function ingredientTier(id: string | null | undefined): number {
  if (!ingredientIsEquipment(id)) return 0;
  const recipeId = String(id).startsWith("eq_") ? String(id).slice(3) : null;
  return recipeId ? (RECIPE_BY_ID[recipeId]?.tier ?? 0) : 0;
}

export function isEquipmentItem(itemOrId: string | Pick<ItemRecord, "id"> | null | undefined): boolean {
  const itemId = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return ingredientIsEquipment(itemId);
}

export function getEquipmentTier(itemOrId: string | Pick<ItemRecord, "id"> | null | undefined): number {
  const itemId = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return ingredientTier(itemId);
}

const EQUIPMENT_ITEM_IDS_BY_TIER = Object.freeze(
  Object.fromEntries(
    [1, 2, 3, 4].map((tier) => [
      tier,
      Object.freeze(
        EQUIPMENT_ITEMS
          .filter((item) => ingredientTier(item.id) === tier)
          .map((item) => item.id)
      )
    ])
  )
);

export function getEquipmentItemIdsByTier(tier: number): readonly string[] {
  const normalizedTier = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
  return EQUIPMENT_ITEM_IDS_BY_TIER[normalizedTier] ?? [];
}

export function canEquipItemByStarLevel(
  unitOrStar: number | { star?: number } | null | undefined,
  itemOrId: string | Pick<ItemRecord, "id"> | null | undefined
): boolean {
  const rawStar = typeof unitOrStar === "object" ? unitOrStar?.star : unitOrStar;
  const unitStar = Number.isFinite(rawStar) ? Math.max(1, Math.floor(rawStar ?? 1)) : 1;
  const equipTier = getEquipmentTier(itemOrId);
  return equipTier <= unitStar;
}

function validateCraftRecipeRules(): void {
  const patternSet = new Set<string>();
  let _warnCount = 0;

  CRAFT_RECIPES.forEach((recipe) => {
    const requires = Array.isArray(recipe?.requires) ? recipe.requires.filter(Boolean) : [];

    // Check all ingredients exist (skip for cross-tier refs from generated data)
    requires.forEach((id) => {
      if (!ITEM_BY_ID[id] && !BASE_ITEMS.some(b => b.id === id)) {
        // Only warn for clearly broken refs
        if (!id.startsWith("eq_")) {
          console.warn(`[Items] Recipe ${recipe.id} references unknown ingredient: ${id}`);
          _warnCount++;
        }
      }
    });

    // Pattern uniqueness
    const key = recipe.pattern.map(x => x ?? "_").join(",");
    if (patternSet.has(key)) {
      console.warn(`[Items] Recipe ${recipe.id} has a duplicate pattern`);
      _warnCount++;
    }
    patternSet.add(key);

    // Tier-specific rules
    if (recipe.tier === 1) {
      if (recipe.gridSize !== 1) { console.warn(`[Items] T1 ${recipe.id}: gridSize should be 1`); _warnCount++; }
      if (requires.length !== 1) { console.warn(`[Items] T1 ${recipe.id}: needs exactly 1 ingredient`); _warnCount++; }
    }

    if (recipe.tier === 2) {
      if (recipe.gridSize !== 2) { console.warn(`[Items] T2 ${recipe.id}: gridSize should be 2`); _warnCount++; }
      if (requires.length !== 4) { console.warn(`[Items] T2 ${recipe.id}: needs 4 ingredients, has ${requires.length}`); _warnCount++; }
    }

    if (recipe.tier === 3 && recipe.gridSize === 3) {
      if (requires.length !== 9) { console.warn(`[Items] T3 ${recipe.id}: needs 9 ingredients, has ${requires.length}`); _warnCount++; }
    }
  });

  // Check all base materials craft T1
  const basesInT1 = new Set<string>();
  CRAFT_RECIPES.filter(r => r.tier === 1).forEach(r => {
    r.requires.filter(id => !ingredientIsEquipment(id)).forEach(id => basesInT1.add(id));
  });
  BASE_ITEMS.forEach(item => {
    if (!basesInT1.has(item.id)) { console.warn(`[Items] Base "${item.id}" has no T1 recipe`); _warnCount++; }
  });

  // Keep validation silent on success to avoid console noise during boot.
}

validateCraftRecipeRules();

/**
 * Tính giá bán của một item dựa trên tier.
 * Base (Raw): 1 vàng. Tier 1: 1 vàng. Tier 2: 4 vàng. Tier 3: 12 vàng.
 */
export function getItemSellPrice(itemId: string | null | undefined): number {
  if (!itemId) return 0;
  if (!ingredientIsEquipment(itemId)) return 1; // Base materials
  const tier = ingredientTier(itemId);
  if (tier === 1) return 1;
  if (tier === 2) return 4;
  if (tier >= 3) return 12;
  return 1;
}

/**
 * Tính phí tháo trang bị dựa trên tier.
 * Tier 1: 2 vàng. Tier 2: 7 vàng. Tier 3: 15 vàng.
 */
export function getUnequipCost(itemId: string | null | undefined): number {
  if (!itemId || !ingredientIsEquipment(itemId)) return 0;
  const tier = ingredientTier(itemId);
  if (tier === 1) return 2;
  if (tier === 2) return 7;
  if (tier >= 3) return 15;
  return 0;
}

/**
 * Kiểm tra tính duy nhất của icon.
 */
export function validateIconUniqueness(): Array<{ icon: string; items: [string, string] }> {
  const allItems = [...BASE_ITEMS, ...EQUIPMENT_ITEMS];
  const iconMap = new Map<string, ItemRecord>();
  const duplicates: Array<{ icon: string; items: [string, string] }> = [];

  for (const item of allItems) {
    if (iconMap.has(item.icon)) {
      duplicates.push({ icon: item.icon, items: [iconMap.get(item.icon)?.id ?? "", item.id] });
    } else {
      iconMap.set(item.icon, item);
    }
  }

  if (duplicates.length > 0) {
    console.warn(`[Items] ${duplicates.length} duplicate icons found`);
  }

  return duplicates;
}

// validateIconUniqueness(); // Disabled: equipment icons can legitimately repeat across tiers
