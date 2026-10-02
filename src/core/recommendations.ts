// Equipment recommendation scoring (spec A69). Works against authored recipe data when supplied.
import type { Role } from "../content/catalog";

export interface RecommendationBonuses {
  atkPct?: number; atkFlat?: number; critPct?: number; attackSpeedPct?: number; lifestealPct?: number; armorPenPct?: number;
  matkPct?: number; matkFlat?: number; spellCritPct?: number; magicPenPct?: number;
  hpPct?: number; hpFlat?: number; defPct?: number; defFlat?: number; mdefPct?: number; mdefFlat?: number;
  damageReductionPct?: number; blockPct?: number;
  healPct?: number; shieldPct?: number; healPowerPct?: number; manaRegen?: number; rageGainPct?: number;
  rageGain?: number; healOnDamage?: number; shieldOnCast?: number;
}

export interface RecommendationRecipe {
  id: string;
  name: string;
  tier: number;
  description?: string;
  bonuses?: RecommendationBonuses;
  logic?: unknown;
}

export interface RecommendationUnit {
  role: Role;
  skillDamageType?: "physical" | "magic" | "true";
}

const n = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const hasAny = (text: string, keywords: readonly string[]): boolean => keywords.some((keyword) => text.includes(keyword));

export function equipmentRecommendationScore(unit: RecommendationUnit, recipe: RecommendationRecipe): number | null {
  const b = recipe.bonuses ?? {};
  const atkLike = n(b.atkPct) + n(b.atkFlat) + n(b.critPct) + n(b.attackSpeedPct) + n(b.lifestealPct) + n(b.armorPenPct);
  const matkLike = n(b.matkPct) + n(b.matkFlat) + n(b.spellCritPct) + n(b.magicPenPct);
  const tankLike = n(b.hpPct) + n(b.hpFlat) + n(b.defPct) + n(b.defFlat) + n(b.mdefPct) + n(b.mdefFlat)
    + n(b.damageReductionPct) + n(b.blockPct);
  const supportLike = n(b.healPct) + n(b.shieldPct) + n(b.healPowerPct) + n(b.manaRegen) + n(b.rageGainPct);
  const physical = ["ARCHER", "ASSASSIN", "FIGHTER"].includes(unit.role) || unit.skillDamageType === "physical";
  const mage = unit.role === "MAGE" || unit.skillDamageType === "magic";
  const support = unit.role === "SUPPORT";
  const tanker = unit.role === "TANKER";

  let score = 0;
  if (physical) score += atkLike * 100;
  if (mage || support) score += matkLike * 100;
  if (tanker) score += tankLike * 110;
  if (support) score += supportLike * 120;

  const text = `${recipe.name} ${recipe.description ?? ""} ${JSON.stringify(b)} ${JSON.stringify(recipe.logic ?? "")}`.toLowerCase();
  if (["ARCHER", "ASSASSIN", "FIGHTER"].includes(unit.role)) {
    if (hasAny(text, ["crit", "lifesteal", "attackspeed", "onhit", "execute", "bleed"])) score += 18;
    if (hasAny(text, ["atk", "sat thuong", "damage"])) score += 10;
  }
  if (mage || support) {
    if (hasAny(text, ["matk", "magic", "mana", "rage", "shield", "heal"])) score += 18;
    if (hasAny(text, ["burn", "poison", "freeze", "stun"])) score += 8;
  }
  if (tanker) {
    if (hasAny(text, ["hp", "shield", "reflect", "thorn", "taunt", "block", "damage reduction"])) score += 22;
    if (hasAny(text, ["lifesteal", "crit", "matk"])) score -= 8;
  }
  if (support && hasAny(text, ["heal", "cleanse", "shield", "team", "ally", "rage"])) score += 20;
  if (mage && hasAny(text, ["matk", "magic", "burn", "poison", "mana", "rage"])) score += 16;

  score += n(b.rageGain) * 10;
  score += n(b.rageGainPct) * 100;
  score += n(b.healOnDamage) * (physical ? 45 : 20);
  score += n(b.shieldOnCast) * (tanker || support ? 50 : 10);
  score += n(b.critPct) * (unit.role === "ASSASSIN" || unit.role === "ARCHER" ? 120 : 40);
  score += n(b.attackSpeedPct) * (unit.role === "ARCHER" ? 120 : unit.role === "ASSASSIN" ? 90 : 35);
  score += n(b.lifestealPct) * (unit.role === "FIGHTER" || unit.role === "ASSASSIN" ? 120 : 20);
  score += n(b.hpPct) * (tanker || support ? 100 : 25);
  score += n(b.defPct) * (tanker ? 120 : 20);
  score += n(b.mdefPct) * (tanker || support ? 110 : 15);
  score += n(b.matkPct) * (mage || support ? 130 : 10);
  score += n(b.atkPct) * (physical ? 130 : 10);

  if (support && physical) score += 6;
  if (tanker && atkLike > tankLike * 1.5) score -= 12;
  if ((mage || support) && atkLike > matkLike * 1.5) score -= 10;
  if (physical && matkLike > atkLike * 1.5) score -= 10;
  return Number.isFinite(score) ? score : null;
}

export function recommendEquipment(
  unit: RecommendationUnit, recipes: readonly RecommendationRecipe[], tier = 3, limit = 3,
): RecommendationRecipe[] {
  return recipes.filter((recipe) => recipe.tier === tier)
    .map((recipe) => ({ recipe, score: equipmentRecommendationScore(unit, recipe) }))
    .filter((entry): entry is { recipe: RecommendationRecipe; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name) || a.recipe.id.localeCompare(b.recipe.id))
    .slice(0, Math.max(1, Math.floor(limit)))
    .map((entry) => entry.recipe);
}
