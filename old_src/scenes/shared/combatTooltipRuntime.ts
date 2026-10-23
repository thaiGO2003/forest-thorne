import { ITEM_BY_ID, RECIPE_BY_ID, type EquipmentItem } from "../../data/items.js";
import type { SkillDefinition } from "../../data/skills.js";
import { getResolvedSkillForUnit } from "../../data/skills.js";
import { UNIT_BY_ID, resolveUnitEquipmentSlotCap } from "../../data/unitCatalog.js";
import { type SynergyUnit } from "../../systems/SynergySystem.js";
import { getClassLabel, getTribeLabel, getUnitVisual } from "../../data/unitVisuals.js";
import { getElementLabel } from "../../data/elementInfo.js";
import { getBaseCritRate, getEffectiveEvasion } from "../../core/gameUtils.js";
import { formatRangeLabel } from "../../core/rangeText.js";
import { loadUiSettings, type UiSettings } from "../../core/uiSettings.js";
import { buildUnitStatsLines, formatVariantBonusText } from "../../core/unitStatsFormatter.js";
import { resolveBrowserSpeechLang } from "../../core/browserSpeech.js";
import { getLocale, t } from "../../i18n/index.js";
import { buildTooltipViewModel, getClassAccuracy } from "../../core/unitDescriptionHelper.js";
import type { Skill, TooltipVm, AttackDef } from "../../core/unitDescriptionHelper.js";
import { aggregateVariantBonuses, type VariantTrait } from "../../core/variantTraits.js";
import { SynergySystem } from "../../systems/SynergySystem.js";
import { buildSharedTooltipTheme } from "./tooltipTheme.js";
import { buildActiveStatusTooltipLines } from "./tooltipStatusRuntime.js";
import { buildSynergyTooltipContent } from "./synergyTooltipRuntime.js";
import { normalizeEquipIds as normalizeTooltipEquipIds } from "./sceneEquipmentRuntime.js";
import { buildCanonicalUnitExpandedColumns, buildCurrentSkillTooltipLines, buildSummaryUnitSectionBlocks, buildTooltipMetadataBadges, buildUnitStatusBadges, buildUnitTooltipContentModel, getLocalizedUnitDescription, resolveSceneTooltipMode } from "./unitTooltipRuntimeShared.js";

type StatsBlock = { critDmgMult?: number; rageMax?: number; range?: number; hp?: number; [key: string]: unknown };
type UnitCatalogEntry = {
  id: string; tier?: number; classType?: string; tribe?: string; star1Desc?: string; star2Desc?: string; star3Desc?: string;
  stats?: StatsBlock; attackDef?: AttackDef; [key: string]: unknown;
};
type CombatTooltipUnitLike = {
  baseId?: string; classType?: string; tribe?: string; star?: number; side?: string;
  hp?: number; maxHp?: number; shield?: number; range?: number; rage?: number; rageMax?: number;
  mods?: { critPct?: number }; tier?: number; equips?: unknown;
  [key: string]: unknown;
};
type CombatTooltipSceneLike = {
  collectionProfile?: unknown; runtimeSettings?: UiSettings;
  player?: { augments?: unknown[]; extraClassCount?: number; extraTribeCount?: number; [key: string]: unknown };
  getEffectiveAtk?(unit: CombatTooltipUnitLike): number;
  getEffectiveDef?(unit: CombatTooltipUnitLike): number;
  getEffectiveMatk?(unit: CombatTooltipUnitLike): number;
  getEffectiveMdef?(unit: CombatTooltipUnitLike): number;
  getStarStatMultiplier?(star: number): number;
  getUnitVariantTraits?(unit: CombatTooltipUnitLike): VariantTrait[];
  getCombatUnits?(side: string): unknown[];
  [key: string]: unknown;
};

function buildCombatCurrentStatsLines(
  scene: CombatTooltipSceneLike,
  unit: CombatTooltipUnitLike,
  baseUnit: UnitCatalogEntry | null | undefined,
  variantTraits: VariantTrait[] = []
): string[] {
  const elementLabel = getElementLabel(unit.tribe as string);
  const accuracy = getClassAccuracy(unit.classType as string, baseUnit?.tier ?? unit?.tier ?? 1);
  const effectiveEvasion = getEffectiveEvasion(unit as unknown as Parameters<typeof getEffectiveEvasion>[0]);
  const critRate = Math.round((unit?.mods?.critPct ?? getBaseCritRate(unit.classType as string)) * 100);
  const critDmgMult = Math.round((baseUnit?.stats?.critDmgMult ?? 1.5) * 100);
  const currentRage = unit.rage ?? 0;
  const currentRageMax = unit.rageMax ?? baseUnit?.stats?.rageMax ?? 0;
  const lines: string[] = [
    `🏷️ ${t("label.tier")}: ${baseUnit?.tier ?? unit?.tier ?? 1}`,
    `🌟 ${t("stats.tribe")}: ${elementLabel || getTribeLabel(unit.tribe)}`,
    `⚔️ ${t("stats.roleClass")}: ${getClassLabel(unit.classType)}`,
    `❤️ HP: ${unit.hp ?? 0}/${unit.maxHp ?? 0}`,
    `🗡️ ATK: ${scene.getEffectiveAtk?.(unit) ?? 0}`,
    `🛡️ DEF: ${scene.getEffectiveDef?.(unit) ?? 0}`,
    `✨ MATK: ${scene.getEffectiveMatk?.(unit) ?? 0}`,
    `🔰 MDEF: ${scene.getEffectiveMdef?.(unit) ?? 0}`,
    `🏹 ${t("stats.range")}: ${formatRangeLabel(unit.range ?? baseUnit?.stats?.range ?? 1)}`,
    `🎯 ${t("stats.accuracy")}: ${accuracy}%`,
    `💨 ${t("stats.evasion")}: ${(effectiveEvasion * 100).toFixed(1)}%`,
    `⚔️ ${t("stats.critRate")}: ${critRate}%`,
    `💥 ${t("stats.critDamage")}: ${critDmgMult}%`
  ];
  if (currentRageMax > 0) lines.push(`🔥 ${t("stats.currentRage")}: ${currentRage}/${currentRageMax}`);
  if (variantTraits.length) {
    lines.push(`🎲 ${t("stats.variants")}: ${variantTraits.length} ${t("stats.traitCountSuffix")}`);
    const totalBonus = aggregateVariantBonuses(variantTraits);
    const summary = formatVariantBonusText(totalBonus);
    if (summary) lines.push(`  • ${t("stats.total")}: ${summary}`);
    variantTraits.forEach((trait, index) => {
      const detail = formatVariantBonusText(trait?.bonus);
      lines.push(`  • ${index + 1}. ${trait?.name ?? t("stats.traitFallback")}${detail ? ` (${detail})` : ""}`);
    });
  }
  return lines;
}

export function getCombatUnitTooltip(scene: CombatTooltipSceneLike, unit: CombatTooltipUnitLike): unknown {
  if (!unit) return { title: t("ui.unknown"), body: t("combat.noDescription") };
  const visual = getUnitVisual(unit.baseId as string, unit.classType, unit.star ?? 1, {
    side: unit.side, ownerKind: unit.side === "LEFT" ? "PLAYER" : "ENEMY", collectionProfile: scene.collectionProfile
  });
  const skill: Skill | null | undefined = getResolvedSkillForUnit(unit) as Skill | null | undefined;
  let skillIcon = "✨";
  if (skill?.damageType === "physical") skillIcon = "🗡️";
  else if (skill?.damageType === "magic") skillIcon = "🪄";
  else if (skill?.damageType === "true") skillIcon = "💠";
  const baseUnit = unit.baseId ? (UNIT_BY_ID[unit.baseId] as UnitCatalogEntry | undefined) : undefined;
  const variantTraits = scene.getUnitVariantTraits?.(unit) ?? [];
  const tooltipVm: TooltipVm = buildTooltipViewModel(baseUnit as Parameters<typeof buildTooltipViewModel>[0], unit.star ?? 1, {
    skill: skill as Skill | undefined
  });
  const skillDescLines = (tooltipVm as { skill: { lines: string[] } }).skill.lines;
  const equipmentCap = resolveUnitEquipmentSlotCap(unit, (unit.star ?? 1) as unknown as Parameters<typeof resolveUnitEquipmentSlotCap>[1]);
  const equippedItems = normalizeTooltipEquipIds(unit.equips, unit).map((id: string) => ITEM_BY_ID[id]).filter((item): item is EquipmentItem => item?.kind === "equipment");
  const equipCount = equippedItems.length;
  const col3Lines: string[] = [`📦 ${t("library.equipment")} (${equipCount}/${equipmentCap})`, ""];
  if (equipCount > 0) {
    equippedItems.forEach((item) => {
      const recipe = item.fromRecipe ? (RECIPE_BY_ID[item.fromRecipe] as { description?: string } | undefined) : undefined;
      col3Lines.push(`${item.icon} ${item.name}`);
      if (recipe?.description) col3Lines.push(`  ${recipe.description}`);
      col3Lines.push("");
    });
  } else {
    col3Lines.push(t("library.noEquipment"));
  }

  const passiveLines = ((tooltipVm as { passive?: { lines: string[] } }).passive?.lines ?? []) as string[];
  const passiveTitle = (tooltipVm as { passive?: { title?: string } }).passive?.title ?? "Nội tại";
  const basicAtkLines = (tooltipVm as { attack: { lines: string[] } }).attack.lines;
  const currentStatsLines = buildCombatCurrentStatsLines(scene, unit, baseUnit, variantTraits);
  const activeStatusLines = buildActiveStatusTooltipLines(unit) as string[];
  const statsLines = baseUnit ? buildUnitStatsLines(baseUnit, {
    star: unit.star ?? 1, statScale: scene.getStarStatMultiplier?.(unit.star ?? 1) ?? 1,
    skill: skill as Parameters<typeof buildUnitStatsLines>[1] extends infer O ? O extends { skill?: infer S } ? S : never : never,
    attack: (tooltipVm as { attack: unknown }).attack as Parameters<typeof buildUnitStatsLines>[1] extends infer O ? O extends { attack?: infer A } ? A : never : never,
    rageMaxOverride: unit.rageMax ?? baseUnit?.stats?.rageMax ?? 0, variants: variantTraits, formatVariantBonus: formatVariantBonusText
  }) : [];
  const theme = buildSharedTooltipTheme(scene, unit.classType as Parameters<typeof buildSharedTooltipTheme>[1]);
  const settings = (scene.runtimeSettings ?? loadUiSettings()) as unknown as Parameters<typeof resolveSceneTooltipMode>[0];
  const tooltipMode = resolveSceneTooltipMode(settings);
  if (tooltipMode === "off") return null;
  const descriptionText = getLocalizedUnitDescription(baseUnit, tooltipVm, unit.star ?? 1, settings);
  type MeterRow = { key: string; label: string; kind: string; value: number; max: number; shield?: number };
  const meterRows: MeterRow[] = [{ key: "hp", label: t("label.hp"), kind: "bar", value: unit.hp ?? 0, max: unit.maxHp ?? 1, shield: unit.shield ?? 0 }];
  if ((unit.rageMax ?? baseUnit?.stats?.rageMax ?? 0) > 0) {
    meterRows.push({ key: "rage", label: t("stats.rage"), kind: "pips", value: unit.rage ?? 0, max: unit.rageMax ?? baseUnit?.stats?.rageMax ?? 0 });
  }
  const metadataUnit = (baseUnit ?? unit) as unknown as Parameters<typeof buildTooltipMetadataBadges>[1];
  const metadataBadges = buildTooltipMetadataBadges(scene, metadataUnit, unit.star ?? 1, { includeClass: true, includeTribe: true, includeSide: true, side: unit.side }) as Array<unknown>;
  const summaryTraitLines = [`${getClassLabel(unit.classType)} • ${getTribeLabel(unit.tribe)}`, ...passiveLines.slice(0, 2)].filter(Boolean) as string[];
  const badgeRows = (metadataBadges as Array<unknown>).filter(Boolean);
  const statusIcons = buildUnitStatusBadges(unit, { rage: unit.rage ?? 0, rageMax: unit.rageMax ?? baseUnit?.stats?.rageMax ?? 0, shield: unit.shield ?? 0 });
  const summarySectionBlocks = buildSummaryUnitSectionBlocks({
    descriptionLines: String(descriptionText ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    traitLines: summaryTraitLines, activeStatusLines, currentSkillLines: buildCurrentSkillTooltipLines(skill, tooltipVm, unit.star ?? 1, settings)
  });
  const expandedSectionColumns = buildCanonicalUnitExpandedColumns({
    basicInfoLines: statsLines, currentStatLines: currentStatsLines, activeStatusLines, passiveTitle, passiveLines,
    basicAttackTitle: t("combat.basicAttack"), basicAttackLines: basicAtkLines,
    skillTitle: `${skillIcon} ${t("combat.skillLabel")}: ${skill?.name ?? t("combat.skillNone")}`, skillLines: skillDescLines,
    equipmentTitle: t("library.equipment"), equipmentLines: col3Lines
  });
  return buildUnitTooltipContentModel({
    tooltipMode, title: visual.name, subtitle: getClassLabel(unit.classType), headerDescription: descriptionText,
    speechLabel: skill?.name ?? "", speechLang: resolveBrowserSpeechLang(getLocale()),
    avatar: { icon: visual.previewIcon ?? visual.icon ?? "🐾", previewIcon: visual.previewIcon ?? visual.icon ?? "🐾",
      portraitKey: visual.portraitKey ?? null, visual: visual.visual ?? null, star: unit.star ?? 1,
      hp: unit.hp ?? 0, maxHp: unit.maxHp ?? baseUnit?.stats?.hp ?? 1, side: unit.side, classType: unit.classType, label: visual.name },
    theme, badgeRows, statusIcons, meterRows, expandedSectionColumns, summarySectionBlocks: (summarySectionBlocks as unknown) as Parameters<typeof buildUnitTooltipContentModel>[0] extends infer O ? O extends { summarySectionBlocks?: infer B } ? B : never : never
  });
}
export function getCombatSynergyTooltip(scene: CombatTooltipSceneLike): unknown {
  if (resolveSceneTooltipMode(loadUiSettings() as unknown as Parameters<typeof resolveSceneTooltipMode>[0]) === "off") return null;
  const leftTeam = scene.getCombatUnits?.("LEFT") ?? [];
  const rightTeam = scene.getCombatUnits?.("RIGHT") ?? [];
  const leftSummary = SynergySystem.calculateSynergies(leftTeam as unknown as SynergyUnit[], "LEFT", { extraClassCount: scene.player?.extraClassCount || 0, extraTribeCount: scene.player?.extraTribeCount || 0 });
  const rightSummary = SynergySystem.calculateSynergies(rightTeam as unknown as SynergyUnit[], "RIGHT", {});
  return buildSynergyTooltipContent(scene as unknown as Parameters<typeof buildSynergyTooltipContent>[0], {
    title: t("library.synergyBattleTitle"),
    summaries: [{ title: t("combat.sidePlayer"), summary: leftSummary as unknown as Record<string, unknown> }, { title: t("combat.sideEnemy"), summary: rightSummary as unknown as Record<string, unknown> }],
    augmentIds: (scene.player?.augments ?? []) as string[]
  });
}
