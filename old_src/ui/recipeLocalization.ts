import { t } from "../i18n/index.js";

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  offense: "library.recipeCategoryOffense",
  defense: "library.recipeCategoryDefense",
  magic: "library.recipeCategoryMagic"
};

const CATEGORY_SHORT_LABEL_KEYS: Record<string, string> = {
  offense: "library.recipeCategoryOffenseShort",
  defense: "library.recipeCategoryDefenseShort",
  magic: "library.recipeCategoryMagicShort"
};

function formatPercent(value: number | null | undefined): number {
  return Math.round(Number(value ?? 0) * 100);
}

export function getRecipeCategoryLabel(category: string): string {
  return t(CATEGORY_LABEL_KEYS[category] ?? category);
}

export function getRecipeCategoryShortLabel(category: string): string {
  return t(CATEGORY_SHORT_LABEL_KEYS[category] ?? category);
}

export function getRecipeIngredientSuffix(kind: string): string {
  if (kind === "equipment") return t("library.recipeEquipmentSuffix");
  return t("library.recipeIngredientSuffix");
}

export interface RecipeBonus {
  atkPct?: number;
  matkPct?: number;
  hpPct?: number;
  defFlat?: number;
  mdefFlat?: number;
  critPct?: number;
  lifestealPct?: number;
  healPct?: number;
  startingRage?: number;
  burnOnHit?: boolean;
  poisonOnHit?: boolean;
  shieldStart?: number;
  evadePct?: number;
}

export function formatRecipeBonusList(bonus: RecipeBonus = {}): string[] {
  const parts: string[] = [];
  if (bonus.atkPct) parts.push(t("library.recipeBonus.atkPct", { value: formatPercent(bonus.atkPct) }));
  if (bonus.matkPct) parts.push(t("library.recipeBonus.matkPct", { value: formatPercent(bonus.matkPct) }));
  if (bonus.hpPct) parts.push(t("library.recipeBonus.hpPct", { value: formatPercent(bonus.hpPct) }));
  if (bonus.defFlat) parts.push(t("library.recipeBonus.defFlat", { value: bonus.defFlat }));
  if (bonus.mdefFlat) parts.push(t("library.recipeBonus.mdefFlat", { value: bonus.mdefFlat }));
  if (bonus.critPct) parts.push(t("library.recipeBonus.critPct", { value: formatPercent(bonus.critPct) }));
  if (bonus.lifestealPct) parts.push(t("library.recipeBonus.lifestealPct", { value: formatPercent(bonus.lifestealPct) }));
  if (bonus.healPct) parts.push(t("library.recipeBonus.healPct", { value: formatPercent(bonus.healPct) }));
  if (bonus.startingRage) parts.push(t("library.recipeBonus.startingRage", { value: bonus.startingRage }));
  if (bonus.burnOnHit) parts.push(t("library.recipeBonus.burnOnHit"));
  if (bonus.poisonOnHit) parts.push(t("library.recipeBonus.poisonOnHit"));
  if (bonus.shieldStart) parts.push(t("library.recipeBonus.shieldStart", { value: bonus.shieldStart }));
  if (bonus.evadePct) parts.push(t("library.recipeBonus.evadePct", { value: formatPercent(bonus.evadePct) }));
  return parts;
}
