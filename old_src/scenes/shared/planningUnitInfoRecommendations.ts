import type { CraftRecipe, ItemBonus, ItemLogic } from "../../data/items.js";
import type { SkillDefinition } from "../../data/skills.js";

interface RecipeScoringBonus extends ItemBonus {
  [key: string]: string | number | boolean | null | undefined;
}

interface RecipeScoringLogic extends ItemLogic {
  [key: string]: string | number | boolean | null | undefined;
}

interface ScoredRecipe {
  name?: string;
  description?: string;
  bonus?: RecipeScoringBonus;
  logic?: RecipeScoringLogic | null;
  tier?: number;
  [key: string]: unknown;
}

interface ScoringBaseUnit {
  classType?: string;
  [key: string]: unknown;
}

interface ScoringSkill extends SkillDefinition {
  damageType?: string;
  [key: string]: unknown;
}

function buildRecipeText(recipe: ScoredRecipe | null | undefined): string {
  return [
    recipe?.name,
    recipe?.description,
    JSON.stringify(recipe?.bonus ?? {}),
    JSON.stringify(recipe?.logic ?? {})
  ].join(" ").toLowerCase();
}

function numericBonus(bonus: RecipeScoringBonus | null | undefined, key: string): number {
  const value = Number(bonus?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function hasAnyText(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function scorePlanningEquipmentRecipeForUnit(
  baseUnit: ScoringBaseUnit | null | undefined,
  recipe: ScoredRecipe | null | undefined,
  skill: ScoringSkill | null = null
): number {
  if (!baseUnit || !recipe) return Number.NEGATIVE_INFINITY;
  const bonus = recipe.bonus ?? {};
  const text = buildRecipeText(recipe);
  const classType = String(baseUnit.classType ?? "").toUpperCase();
  const damageType = String(skill?.damageType ?? "").toLowerCase();
  const isTank = classType === "TANKER";
  const isSupport = classType === "SUPPORT";
  const isMage = classType === "MAGE" || damageType === "magic";
  const isArcher = classType === "ARCHER";
  const isAssassin = classType === "ASSASSIN";
  const isFighter = classType === "FIGHTER";
  const isPhysical = isArcher || isAssassin || isFighter || damageType === "physical";

  let score = 0;

  const atkLike = numericBonus(bonus, "atkPct") + numericBonus(bonus, "atkFlat") + numericBonus(bonus, "critPct")
    + numericBonus(bonus, "attackSpeedPct") + numericBonus(bonus, "lifestealPct") + numericBonus(bonus, "armorPenPct");
  const matkLike = numericBonus(bonus, "matkPct") + numericBonus(bonus, "matkFlat") + numericBonus(bonus, "spellCritPct")
    + numericBonus(bonus, "magicPenPct");
  const tankLike = numericBonus(bonus, "hpPct") + numericBonus(bonus, "hpFlat") + numericBonus(bonus, "defPct")
    + numericBonus(bonus, "defFlat") + numericBonus(bonus, "mdefPct") + numericBonus(bonus, "mdefFlat")
    + numericBonus(bonus, "damageReductionPct") + numericBonus(bonus, "blockPct");
  const supportLike = numericBonus(bonus, "healPct") + numericBonus(bonus, "shieldPct") + numericBonus(bonus, "healPowerPct")
    + numericBonus(bonus, "manaRegen") + numericBonus(bonus, "rageGainPct");

  if (isPhysical) score += atkLike * 100;
  if (isMage || isSupport) score += matkLike * 100;
  if (isTank) score += tankLike * 110;
  if (isSupport) score += supportLike * 120;

  if (isArcher || isAssassin || isFighter) {
    if (hasAnyText(text, ["crit", "lifesteal", "attackspeed", "onhit", "execute", "bleed"])) score += 18;
    if (hasAnyText(text, ["atk", "sat thuong", "damage"])) score += 10;
  }
  if (isMage || isSupport) {
    if (hasAnyText(text, ["matk", "magic", "mana", "rage", "shield", "heal"])) score += 18;
    if (hasAnyText(text, ["burn", "poison", "freeze", "stun"])) score += 8;
  }
  if (isTank) {
    if (hasAnyText(text, ["hp", "shield", "reflect", "thorn", "taunt", "block", "damage reduction"])) score += 22;
    if (hasAnyText(text, ["lifesteal", "crit", "matk"])) score -= 8;
  }
  if (isSupport) {
    if (hasAnyText(text, ["heal", "cleanse", "shield", "team", "ally", "rage"])) score += 20;
  }
  if (isMage) {
    if (hasAnyText(text, ["matk", "magic", "burn", "poison", "mana", "rage"])) score += 16;
  }

  score += numericBonus(bonus, "rageGain") * 10;
  score += numericBonus(bonus, "rageGainPct") * 100;
  score += numericBonus(bonus, "healOnDmgPct") * (isPhysical ? 45 : 20);
  score += numericBonus(bonus, "shieldOnCastPct") * (isTank || isSupport ? 50 : 10);
  score += numericBonus(bonus, "critPct") * (isAssassin || isArcher ? 120 : 40);
  score += numericBonus(bonus, "attackSpeedPct") * (isArcher ? 120 : isAssassin ? 90 : 35);
  score += numericBonus(bonus, "lifestealPct") * (isFighter || isAssassin ? 120 : 20);
  score += numericBonus(bonus, "hpPct") * (isTank || isSupport ? 100 : 25);
  score += numericBonus(bonus, "defPct") * (isTank ? 120 : 20);
  score += numericBonus(bonus, "mdefPct") * (isTank || isSupport ? 110 : 15);
  score += numericBonus(bonus, "matkPct") * (isMage || isSupport ? 130 : 10);
  score += numericBonus(bonus, "atkPct") * (isPhysical ? 130 : 10);

  if (isSupport && isPhysical) score += 6;
  if (isTank && atkLike > tankLike * 1.5) score -= 12;
  if ((isMage || isSupport) && atkLike > matkLike * 1.5) score -= 10;
  if (isPhysical && matkLike > atkLike * 1.5) score -= 10;

  return score;
}

export function recommendPlanningEquipmentRecipes(
  baseUnit: ScoringBaseUnit | null | undefined,
  recipes: ReadonlyArray<CraftRecipe> | null | undefined,
  skill: ScoringSkill | null = null,
  tier: number = 3,
  limit: number = 3
): CraftRecipe[] {
  const pool: CraftRecipe[] = Array.isArray(recipes)
    ? recipes.filter((recipe: CraftRecipe) => Number(recipe?.tier) === Number(tier))
    : [];
  type ScoredEntry = { recipe: CraftRecipe; score: number };
  return pool
    .map<ScoredEntry>((recipe: CraftRecipe) => ({
      recipe,
      score: scorePlanningEquipmentRecipeForUnit(baseUnit, recipe as ScoredRecipe, skill)
    }))
    .filter((entry: ScoredEntry) => Number.isFinite(entry.score))
    .sort((left: ScoredEntry, right: ScoredEntry) =>
      right.score - left.score || String(left.recipe?.name ?? "").localeCompare(String(right.recipe?.name ?? ""))
    )
    .slice(0, Math.max(1, limit))
    .map((entry: ScoredEntry) => entry.recipe);
}
