// Authoritative authored item definitions and fail-fast registry validation.
// All consumers resolve persisted IDs through this registry; unknown IDs never become items.
import rawItems from "../content/items.json";
export interface BaseMaterialDef {
  kind: "material";
  id: string;
  displayNameKey: string;
  icon: string;
}

export interface EquipmentBonuses {
  hpPct?: number;
  atkPct?: number;
  matkPct?: number;
  def?: number;
  mdef?: number;
  healPct?: number;
  lifestealPct?: number;
  evadePct?: number;
  critPct?: number;
  burnOnHit?: number;
  poisonOnHit?: number;
  startingShield?: number;
  startingRage?: number;
}

export interface EquipmentDef {
  kind: "equipment";
  id: string;
  /** Canonical duplicate-equipment key (not localized). */
  nameKey: string;
  displayNameKey: string;
  /** Authored Vietnamese name for the ported classic catalog (no i18n key). */
  nameVi?: string;
  icon: string;
  tier: number;
  unequipCost?: number;
  bonuses: EquipmentBonuses;
  /** Authored classic trigger payload; retained but not executed by the rebuild yet. */
  logic?: Record<string, unknown>;
}

export interface Recipe {
  id: string;
  outputId: string;
  /** Footprint side: 1, 2 or 3. */
  size: 1 | 2 | 3;
  /** Row-major size×size cells; null cells must remain empty. */
  pattern: readonly (string | null)[];
}

export interface ItemCatalogSource {
  materials: readonly BaseMaterialDef[];
  equipment: readonly EquipmentDef[];
  recipes: readonly Recipe[];
}

export type ItemDef = BaseMaterialDef | EquipmentDef;

export interface ItemRegistry {
  materials: readonly BaseMaterialDef[];
  baseMaterialIds: readonly string[];
  equipment: readonly EquipmentDef[];
  recipes: readonly Recipe[];
  getItem(id: string): ItemDef | null;
  getEquipment(id: string): EquipmentDef | null;
  getRecipe(id: string): Recipe | null;
}

const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z][a-z0-9_]*$/.test(id);
const nonemptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid item registry: ${message}`);
}

const BONUS_KEYS = new Set<keyof EquipmentBonuses>([
  "hpPct", "atkPct", "matkPct", "def", "mdef", "healPct", "lifestealPct", "evadePct",
  "critPct", "burnOnHit", "poisonOnHit", "startingShield", "startingRage",
]);

/** Translation-invariant footprint: recipes may slide, but are never rotated. */
function patternSignature(recipe: Recipe): string {
  let top: number = recipe.size, left: number = recipe.size, bottom = -1, right = -1;
  for (let i = 0; i < recipe.pattern.length; i++) {
    if (recipe.pattern[i] === null) continue;
    const row = Math.floor(i / recipe.size), col = i % recipe.size;
    top = Math.min(top, row);
    left = Math.min(left, col);
    bottom = Math.max(bottom, row);
    right = Math.max(right, col);
  }
  requireValid(bottom >= 0, `empty recipe pattern ${recipe.id}`);
  const cells: (string | null)[] = [];
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) cells.push(recipe.pattern[row * recipe.size + col] ?? null);
  }
  return JSON.stringify([bottom - top + 1, right - left + 1, cells]);
}

/** Validates before publishing any item; malformed fixtures throw rather than partially loading. */
export function loadItemRegistry(source: unknown): ItemRegistry {
  requireValid(source !== null && typeof source === "object" && !Array.isArray(source), "expected catalog object");
  const catalog = source as Record<string, unknown>;
  requireValid(Array.isArray(catalog.materials), "expected materials array");
  requireValid(Array.isArray(catalog.equipment), "expected equipment array");
  requireValid(Array.isArray(catalog.recipes), "expected recipes array");

  const itemsById = new Map<string, ItemDef>();
  const equipmentById = new Map<string, EquipmentDef>();
  const recipesById = new Map<string, Recipe>();
  const patterns = new Map<string, string>();
  const equipmentNames = new Set<string>();

  const materials = catalog.materials.map((raw: unknown): BaseMaterialDef => {
    requireValid(raw !== null && typeof raw === "object" && !Array.isArray(raw), "invalid material definition");
    const fields = raw as Record<string, unknown>;
    requireValid(fields.kind === "material" && validId(fields.id), "invalid material definition");
    requireValid(!itemsById.has(fields.id), `duplicate item ID ${fields.id}`);
    requireValid(nonemptyString(fields.displayNameKey) && nonemptyString(fields.icon), `invalid material presentation ${fields.id}`);
    const material: BaseMaterialDef = Object.freeze({
      kind: "material", id: fields.id, displayNameKey: fields.displayNameKey, icon: fields.icon,
    });
    itemsById.set(material.id, material);
    return material;
  });

  const equipment = catalog.equipment.map((raw: unknown): EquipmentDef => {
    requireValid(raw !== null && typeof raw === "object" && !Array.isArray(raw), "invalid equipment definition");
    const fields = raw as Record<string, unknown>;
    requireValid(fields.kind === "equipment" && validId(fields.id), "invalid equipment definition");
    requireValid(!itemsById.has(fields.id), `duplicate item ID ${fields.id}`);
    requireValid(nonemptyString(fields.nameKey) && nonemptyString(fields.displayNameKey) && nonemptyString(fields.icon),
      `invalid equipment identity/presentation ${fields.id}`);
    requireValid(!equipmentNames.has(fields.nameKey), `duplicate equipment nameKey ${fields.nameKey}`);
    equipmentNames.add(fields.nameKey);
    requireValid(typeof fields.tier === "number" && Number.isInteger(fields.tier)
      && fields.tier >= 1 && fields.tier <= 3, `invalid equipment tier ${fields.id}`);
    requireValid(fields.unequipCost === undefined || (typeof fields.unequipCost === "number"
      && Number.isInteger(fields.unequipCost) && fields.unequipCost >= 0), `invalid unequip cost ${fields.id}`);
    requireValid(fields.bonuses !== null && typeof fields.bonuses === "object" && !Array.isArray(fields.bonuses),
      `invalid bonuses ${fields.id}`);
    const bonuses = fields.bonuses as Record<string, unknown>;
    for (const [key, value] of Object.entries(bonuses)) {
      requireValid(BONUS_KEYS.has(key as keyof EquipmentBonuses) && typeof value === "number" && Number.isFinite(value),
        `invalid bonus ${fields.id}.${key}`);
    }
    const item: EquipmentDef = Object.freeze({
      kind: "equipment", id: fields.id, nameKey: fields.nameKey, displayNameKey: fields.displayNameKey, icon: fields.icon,
      tier: fields.tier, ...(fields.unequipCost === undefined ? {} : { unequipCost: fields.unequipCost as number }),
      ...(fields.nameVi === undefined ? {} : { nameVi: fields.nameVi as string }),
      ...(fields.logic === undefined ? {} : { logic: fields.logic as Record<string, unknown> }),
      bonuses: Object.freeze({ ...bonuses }) as EquipmentBonuses,
    });
    itemsById.set(item.id, item);
    equipmentById.set(item.id, item);
    return item;
  });

  const recipes = catalog.recipes.map((raw: unknown): Recipe => {
    requireValid(raw !== null && typeof raw === "object" && !Array.isArray(raw), "invalid recipe ID");
    const fields = raw as Record<string, unknown>;
    requireValid(validId(fields.id), "invalid recipe ID");
    requireValid(!recipesById.has(fields.id) && !itemsById.has(fields.id), `duplicate recipe ID ${fields.id}`);
    requireValid(validId(fields.outputId) && equipmentById.has(fields.outputId),
      `unknown recipe output ${fields.id}`);
    requireValid(typeof fields.size === "number" && Number.isInteger(fields.size)
      && fields.size >= 1 && fields.size <= 3, `invalid recipe grid size ${fields.id}`);
    const size = fields.size as 1 | 2 | 3;
    requireValid(Array.isArray(fields.pattern) && fields.pattern.length === size * size,
      `invalid recipe pattern length ${fields.id}`);
    const pattern = fields.pattern as unknown[];
    for (const id of pattern) {
      requireValid(id === null || (typeof id === "string" && itemsById.has(id)),
        `unknown recipe ingredient ${String(id)} in ${fields.id}`);
    }
    const recipe: Recipe = Object.freeze({
      id: fields.id, outputId: fields.outputId, size, pattern: Object.freeze([...pattern]) as readonly (string | null)[],
    });
    const signature = patternSignature(recipe);
    requireValid(!patterns.has(signature), `colliding recipes ${patterns.get(signature)} and ${recipe.id}`);
    patterns.set(signature, recipe.id);
    recipesById.set(recipe.id, recipe);
    return recipe;
  });

  // Dependencies are inferred from equipment ingredients produced by any recipe.
  const byOutput = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    const existing = byOutput.get(recipe.outputId) ?? [];
    existing.push(recipe);
    byOutput.set(recipe.outputId, existing);
  }
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (outputId: string): void => {
    requireValid(!visiting.has(outputId), `recipe dependency cycle at ${outputId}`);
    if (visited.has(outputId)) return;
    visiting.add(outputId);
    for (const recipe of byOutput.get(outputId) ?? []) {
      for (const id of recipe.pattern) if (id && byOutput.has(id)) visit(id);
    }
    visiting.delete(outputId);
    visited.add(outputId);
  };
  for (const id of byOutput.keys()) visit(id);

  return Object.freeze({
    materials: Object.freeze(materials),
    baseMaterialIds: Object.freeze(materials.map((material) => material.id)),
    equipment: Object.freeze(equipment),
    recipes: Object.freeze(recipes),
    getItem: (id: string) => itemsById.get(id) ?? null,
    getEquipment: (id: string) => equipmentById.get(id) ?? null,
    getRecipe: (id: string) => recipesById.get(id) ?? null,
  });
}

interface AuthoredItem {
  id: string;
  nameVi: string;
  icon: string;
  tier: number;
  size: 1 | 2 | 3;
  pattern: (string | null)[];
  bonuses: EquipmentBonuses;
  logic?: Record<string, unknown>;
}

/** 205 classic recipes/equipment ported by scripts/port-old-items.mjs. */
const AUTHORED_ITEMS = rawItems as AuthoredItem[];

// Six authored base materials plus the ported classic equipment/recipe catalog. Materials keep
// their translated i18n keys; ported equipment carries nameVi because the classic DB has no keys.
export const ITEM_REGISTRY = loadItemRegistry({
  materials: [
    { kind: "material", id: "bark", displayNameKey: "item.bark", icon: "leaf" },
    { kind: "material", id: "feather", displayNameKey: "item.feather", icon: "wind" },
    { kind: "material", id: "belt", displayNameKey: "item.belt", icon: "shield" },
    { kind: "material", id: "claw", displayNameKey: "item.claw", icon: "swords" },
    { kind: "material", id: "tear", displayNameKey: "item.tear", icon: "droplet" },
    { kind: "material", id: "crystal", displayNameKey: "item.crystal", icon: "sparkles" },
  ],
  equipment: AUTHORED_ITEMS.map((item) => ({
    kind: "equipment" as const,
    id: `eq_${item.id}`,
    nameKey: item.id,
    displayNameKey: `item.eq_${item.id}`,
    nameVi: item.nameVi,
    icon: item.icon,
    tier: item.tier,
    bonuses: item.bonuses,
    ...(item.logic ? { logic: item.logic } : {}),
  })),
  recipes: AUTHORED_ITEMS.map((item) => ({
    id: item.id,
    outputId: `eq_${item.id}`,
    size: item.size,
    pattern: item.pattern,
  })),
} satisfies ItemCatalogSource);

export const BASE_MATERIALS = ITEM_REGISTRY.baseMaterialIds;
export const EQUIPMENT = ITEM_REGISTRY.equipment;
export const RECIPES = ITEM_REGISTRY.recipes;
export const getItem = (id: string): ItemDef | null => ITEM_REGISTRY.getItem(id);
export const isKnownItem = (id: string): boolean => getItem(id) !== null;
export const isBaseMaterial = (id: string): boolean => getItem(id)?.kind === "material";
export const getEquipment = (id: string): EquipmentDef | null => ITEM_REGISTRY.getEquipment(id);
export const isEquipment = (id: string): boolean => getEquipment(id) !== null;
export const getRecipe = (id: string): Recipe | null => ITEM_REGISTRY.getRecipe(id);
