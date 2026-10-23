import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import type { AugmentDefinition, AugmentGroup } from "../../data/augments.js";
import type { Skill, BaseUnit } from "../../core/unitDescriptionHelper.js";
import type { VariantBonus, VariantTrait } from "../../core/variantTraits.js";
import type { SynergyUnit, SynergyCounts, SynergyOptions, SynergyBonus } from "../../systems/SynergySystem.js";
import { SynergySystem } from "../../systems/SynergySystem.js";
import { getAISettings, type DifficultySettings } from "../../systems/AISystem.js";
import { formatVariantBonusText } from "../../core/unitStatsFormatter.js";
import { aggregateVariantBonuses, getOwnedUnitTraitEntries } from "../../core/variantTraits.js";
import { describeBasicAttack as _describeBasicAttack, describeSkillLines as _describeSkillLines, describeSkill as _describeSkill,
  buildSkillStarMilestoneLines as _buildSkillStarMilestoneLines, stripSkillStarNotes as _stripSkillStarNotes,
  inferBasicActionPattern as _inferBasicActionPattern, translateActionPattern as _translateActionPattern,
  getStarStatMultiplier as _getStarStatMultiplier, getStarSkillMultiplier as _getStarSkillMultiplier,
  translateDamageType as _translateDamageType, translateScaleStat as _translateScaleStat,
  getSkillTargetCountText as _getSkillTargetCountText, getSkillShapeText as _getSkillShapeText,
  getSkillDamageAndFormulaText as _getSkillDamageAndFormulaText, describeSkillArea as _describeSkillArea,
  translateSkillEffect as _translateSkillEffect, translateAugmentGroup as _translateAugmentGroup, getAugmentIcon as _getAugmentIcon
} from "../../core/unitDescriptionHelper.js";

type SceneLike = Phaser.Scene & { aiMode: string; player: { extraClassCount?: number; extraTribeCount?: number }; [key: string]: unknown };
type Side = "LEFT" | "RIGHT" | string;
type BaseStats = Record<string, unknown>;
type VariantUnit = Parameters<typeof getOwnedUnitTraitEntries>[0];

export function planningFormatVariantBonus(_scene: SceneLike, bonus: VariantBonus | null | undefined): string { return formatVariantBonusText(bonus); }
export function planningInferBasicActionPattern(_scene: SceneLike, classType: string | null, range: number | null): string { return _inferBasicActionPattern(classType, range); }
export function planningDescribeBasicAttack(_scene: SceneLike, classType: string | null, range: number | null, baseStats: BaseStats | null = null, star = 1): string[] { return _describeBasicAttack(classType, range, baseStats, star); }
export function planningStripSkillStarNotes(_scene: SceneLike, description: string): string { return _stripSkillStarNotes(description); }
export function getPlanningStarStatMultiplier(_scene: SceneLike, star: number): number { return _getStarStatMultiplier(star); }
export function getPlanningStarSkillMultiplier(_scene: SceneLike, star: number): number { return _getStarSkillMultiplier(star); }
export function getPlanningSkillTargetCountText(_scene: SceneLike, skill: Skill | null, star: number): string { return _getSkillTargetCountText(skill, star); }
export function getPlanningSkillShapeText(_scene: SceneLike, skill: Skill | null): string { return _getSkillShapeText(skill); }
export function getPlanningSkillDamageAndFormulaText(_scene: SceneLike, skill: Skill | null, baseStats: BaseStats | null, star: number): string { return _getSkillDamageAndFormulaText(skill, baseStats, star); }
export function buildPlanningSkillStarMilestoneLines(_scene: SceneLike, skill: Skill | null, baseUnit: BaseUnit | null): string[] { return _buildSkillStarMilestoneLines(skill, baseUnit); }
export function planningDescribeSkillLines(_scene: SceneLike, skill: Skill | null, baseUnit: BaseUnit | null = null): string[] { return _describeSkillLines(skill, baseUnit); }
export function planningDescribeSkill(_scene: SceneLike, skill: Skill | null): string { return _describeSkill(skill); }
export function planningDescribeSkillArea(_scene: SceneLike, skill: Skill | null): string { return _describeSkillArea(skill); }
export function planningTranslateDamageType(_scene: SceneLike, type: string | null): string { return _translateDamageType(type); }
export function planningTranslateScaleStat(_scene: SceneLike, stat: string | null): string { return _translateScaleStat(stat); }
export function planningTranslateActionPattern(_scene: SceneLike, pattern: string | null): string { return _translateActionPattern(pattern); }
export function planningTranslateSkillEffect(_scene: SceneLike, effect: string): string { return _translateSkillEffect(effect); }
export function planningTranslateAugmentEffect(_scene: SceneLike, effectType: string): string {
  const map: Record<string, string> = { gold_flat: t("planning.augmentEffect.goldFlat"), interest_cap: t("planning.augmentEffect.interestCap"), roll_cost_delta: t("planning.augmentEffect.rollCostDelta"),
    deploy_cap_bonus: t("planning.augmentEffect.deployCapBonus"), bench_bonus: t("planning.augmentEffect.benchBonus"), starting_rage: t("planning.augmentEffect.startingRage"),
    team_atk_pct: t("planning.augmentEffect.teamAtkPct"), team_hp_pct: t("planning.augmentEffect.teamHpPct"), starting_shield: t("planning.augmentEffect.startingShield"),
    team_matk_pct: t("planning.augmentEffect.teamMatkPct"), extra_class_count: t("planning.augmentEffect.extraClassCount"), extra_tribe_count: t("planning.augmentEffect.extraTribeCount"),
    lifesteal_pct: t("planning.augmentEffect.lifestealPct"), hp_loss_reduce: t("planning.augmentEffect.hpLossReduce"), xp_flat: t("planning.augmentEffect.xpFlat") };
  return map[effectType] ?? effectType;
}
export function planningTranslateAugmentGroup(_scene: SceneLike, group: AugmentGroup): string { return _translateAugmentGroup(group); }
export function getPlanningAugmentIcon(_scene: SceneLike, augment: AugmentDefinition): string { return _getAugmentIcon(augment); }
export function getPlanningAI(scene: SceneLike): DifficultySettings { return getAISettings(scene.aiMode); }
export function planningComputeSynergyCounts(scene: SceneLike, units: SynergyUnit[], side: Side): SynergyCounts {
  const options: SynergyOptions = {};
  if (side === "LEFT" && units.length > 0) { options.extraClassCount = scene.player.extraClassCount || 0; options.extraTribeCount = scene.player.extraTribeCount || 0; }
  return SynergySystem.calculateSynergies(units, side, options);
}
export function getPlanningUnitVariantTraits(_scene: SceneLike, unit: VariantUnit): VariantTrait[] { return getOwnedUnitTraitEntries(unit); }
export function getPlanningUnitSkillVariant(scene: SceneLike, unit: VariantUnit): VariantTrait | null { return getPlanningUnitVariantTraits(scene, unit)[0] ?? null; }
export function getPlanningUnitVariantSummary(scene: SceneLike, unit: VariantUnit): VariantBonus { return aggregateVariantBonuses(getPlanningUnitVariantTraits(scene, unit)); }
export function getPlanningSynergyTier(_scene: SceneLike, count: number, thresholds: number[]): number { return SynergySystem.getSynergyTier(count, thresholds); }
export function planningFormatBonusSet(_scene: SceneLike, bonus: SynergyBonus | null | undefined): string { return SynergySystem.formatBonusSet(bonus); }
