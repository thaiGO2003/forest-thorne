import type Phaser from "phaser";
import { ITEM_BY_ID, RECIPE_BY_ID } from "../../data/items.js";
import { getResolvedSkillDefinition, type SkillDefinition } from "../../data/skills.js";
import { UNIT_BY_ID, resolveUnitEquipmentSlotCap } from "../../data/unitCatalog.js";
import { getClassLabel, getTribeLabel, getUnitVisual } from "../../data/unitVisuals.js";
import { PLAYER_COLS, RIGHT_COL_START, ROWS } from "../../core/boardConstants.js";
import { getBaseCritRate, getEffectiveEvasion, scaledBaseStats } from "../../core/gameUtils.js";
import { formatRangeLabel } from "../../core/rangeText.js";
import { loadUiSettings } from "../../core/uiSettings.js";
import { buildUnitStatsLines, formatVariantBonusText } from "../../core/unitStatsFormatter.js";
import { buildTooltipViewModel, getClassAccuracy } from "../../core/unitDescriptionHelper.js";
import { aggregateVariantBonuses, type VariantTrait } from "../../core/variantTraits.js";
import { resolveBrowserSpeechLang } from "../../core/browserSpeech.js";
import { getLocale, t } from "../../i18n/index.js";
import { buildSharedTooltipTheme } from "./tooltipTheme.js";
import { buildActiveStatusTooltipLines } from "./tooltipStatusRuntime.js";
import { buildSynergyTooltipContent } from "./synergyTooltipRuntime.js";
import { normalizeEquipIds as normalizeTooltipEquipIds } from "./sceneEquipmentRuntime.js";
import {
  buildCanonicalUnitExpandedColumns,
  buildCurrentSkillTooltipLines,
  buildSummaryUnitSectionBlocks,
  buildTooltipMetadataBadges,
  buildUnitStatusBadges,
  buildUnitTooltipContentModel,
  getLocalizedUnitDescription,
  normalizeTooltipSide,
  resolveSceneTooltipMode
} from "./unitTooltipRuntimeShared.js";

import { getPlanningEffectiveAtk, getPlanningEffectiveDef, getPlanningEffectiveMatk, getPlanningEffectiveMdef } from "./planningCombatCalcRuntime.js";
import { getPlanningBoardRowCount, getPlanningBoardUnit, isPlanningCoopMode } from "./planningCoopSessionRuntime.js";
import { getPlanningAugmentIcon, getPlanningUnitVariantTraits, planningComputeSynergyCounts, planningTranslateAugmentEffect, planningTranslateAugmentGroup } from "./planningDescriptionRuntime.js";
import { getPlanningUnitDisplayResources } from "./planningUnitInfoRuntime.js";

type OwnedUnitLike = {
  side?: string;
  ownerKind?: string;
  col?: number;
  equips?: Array<string | null | undefined>;
  baseId?: string;
  base?: { classType?: string; tier?: number; tribe?: string; name?: string; nameVi?: string; stats?: { rageMax?: number; range?: number; critRate?: number; critDmgMult?: number; evasion?: number; [k: string]: unknown } };
  star?: number;
  skillId?: string;
  id?: string;
  rage?: number;
  rageMax?: number;
  shield?: number;
  hp?: number;
  maxHp?: number;
  atk?: number;
  def?: number;
  matk?: number;
  mdef?: number;
  mods?: { critPct?: number };
  tier?: number;
  tribe?: string;
  classType?: string;
  [k: string]: unknown;
};
type BaseUnitLike = {
  id: string;
  classType: string;
  tribe?: string;
  skillId?: string;
  tier?: number;
  stats?: { rageMax?: number; range?: number; critRate?: number; critDmgMult?: number; evasion?: number; [k: string]: unknown };
  [k: string]: unknown;
};
type DisplayResourcesLike = { rage: number; rageMax: number; shield: number };
type PlanningTooltipScene = Phaser.Scene & Record<string, unknown> & {
  runtimeSettings?: { tooltipMode?: unknown; expandedTooltip?: boolean; language?: string; [k: string]: unknown };
  collectionProfile?: unknown;
  player?: { board?: Array<Array<OwnedUnitLike | null | undefined> | undefined> | null; augments?: string[]; [k: string]: unknown };
  aiMode?: string;
};
type AugmentLike = {
  name: string;
  group: unknown;
  description: string;
  effect: { type: string; value?: number | string | null };
  [k: string]: unknown;
};

function resolvePlanningTooltipSide(ownedUnit: OwnedUnitLike | null | undefined): "LEFT" | "RIGHT" {
  if (ownedUnit?.side != null) return normalizeTooltipSide(ownedUnit.side);
  if (ownedUnit?.ownerKind === "ENEMY") return "RIGHT";
  if (Number.isFinite(Number(ownedUnit?.col)) && Number(ownedUnit?.col ?? 0) >= RIGHT_COL_START) return "RIGHT";
  return "LEFT";
}

function resolvePlanningDisplayResources(
  scene: PlanningTooltipScene,
  ownedUnit: OwnedUnitLike | null | undefined,
  base: BaseUnitLike,
  star: number = 1
): DisplayResourcesLike {
  const fallbackSkill = base.skillId
    ? getResolvedSkillDefinition(base.skillId, { baseId: base.id, star })
    : null;
  const explicitRageMax = Number(ownedUnit?.rageMax);
  const fallbackRageMax = Number.isFinite(explicitRageMax)
    ? explicitRageMax
    : (fallbackSkill?.cost ?? base.stats?.rageMax ?? 0);
  const fallback: DisplayResourcesLike = {
    rage: ownedUnit?.rage ?? 0,
    rageMax: Math.max(0, Math.round(Number(fallbackRageMax) || 0)),
    shield: ownedUnit?.shield ?? 0
  };
  if (!ownedUnit) return fallback;
  return {
    ...fallback,
    ...(getPlanningUnitDisplayResources(scene as unknown as Parameters<typeof getPlanningUnitDisplayResources>[0], ownedUnit) || {})
  };
}

function buildPlanningCurrentStatsLines(
  scene: PlanningTooltipScene,
  base: BaseUnitLike,
  ownedUnit: OwnedUnitLike | null | undefined,
  star: number,
  displayResources: DisplayResourcesLike | null | undefined,
  variants: VariantTrait[] = []
): string[] {
  const scaledStats = scaledBaseStats(base.stats as unknown as Parameters<typeof scaledBaseStats>[0], star, base.classType);
  const hasRuntimeStats = Boolean(
    ownedUnit && (
      ownedUnit.base
      || Number.isFinite(Number(ownedUnit.atk))
      || Number.isFinite(Number(ownedUnit.matk))
      || Number.isFinite(Number(ownedUnit.def))
      || Number.isFinite(Number(ownedUnit.mdef))
    )
  );
  const effectiveAtk = hasRuntimeStats
    ? getPlanningEffectiveAtk(scene as unknown as Parameters<typeof getPlanningEffectiveAtk>[0], ownedUnit as unknown as Parameters<typeof getPlanningEffectiveAtk>[1])
    : (ownedUnit?.atk ?? scaledStats.atk);
  const effectiveDef = hasRuntimeStats
    ? getPlanningEffectiveDef(scene as unknown as Parameters<typeof getPlanningEffectiveDef>[0], ownedUnit as unknown as Parameters<typeof getPlanningEffectiveDef>[1])
    : (ownedUnit?.def ?? scaledStats.def);
  const effectiveMatk = hasRuntimeStats
    ? getPlanningEffectiveMatk(scene as unknown as Parameters<typeof getPlanningEffectiveMatk>[0], ownedUnit as unknown as Parameters<typeof getPlanningEffectiveMatk>[1])
    : (ownedUnit?.matk ?? scaledStats.matk);
  const effectiveMdef = hasRuntimeStats
    ? getPlanningEffectiveMdef(scene as unknown as Parameters<typeof getPlanningEffectiveMdef>[0], ownedUnit as unknown as Parameters<typeof getPlanningEffectiveMdef>[1])
    : (ownedUnit?.mdef ?? scaledStats.mdef);
  const effectiveEvasion = ownedUnit ? getEffectiveEvasion(ownedUnit as unknown as Parameters<typeof getEffectiveEvasion>[0]) : (base.stats?.evasion ?? 0);
  const critRate = Math.round(((ownedUnit?.mods?.critPct ?? base.stats?.critRate) ?? getBaseCritRate(base.classType)) * 100);
  const critDmgMult = Math.round((base.stats?.critDmgMult ?? 1.5) * 100);
  const accuracy = getClassAccuracy(base.classType, base.tier ?? 1);
  const currentRage = displayResources?.rage ?? ownedUnit?.rage ?? 0;
  const currentRageMax = displayResources?.rageMax ?? ownedUnit?.rageMax ?? base.stats?.rageMax ?? 0;
  const lines: string[] = [
    `🏷️ ${t("label.tier")}: ${base.tier ?? 1}`,
    `🌟 ${t("stats.tribe")}: ${getTribeLabel(base.tribe)}`,
    `⚔️ ${t("stats.roleClass")}: ${getClassLabel(base.classType)}`,
    `❤️ HP: ${ownedUnit?.hp ?? scaledStats.hp}/${ownedUnit?.maxHp ?? scaledStats.hp}`,
    `🗡️ ATK: ${effectiveAtk}`,
    `🛡️ DEF: ${effectiveDef}`,
    `✨ MATK: ${effectiveMatk}`,
    `🔰 MDEF: ${effectiveMdef}`,
    `🏹 ${t("stats.range")}: ${formatRangeLabel(ownedUnit?.range ?? base.stats?.range ?? 1)}`,
    `🎯 ${t("stats.accuracy")}: ${accuracy}%`,
    `💨 ${t("stats.evasion")}: ${(effectiveEvasion * 100).toFixed(1)}%`,
    `⚔️ ${t("stats.critRate")}: ${critRate}%`,
    `💥 ${t("stats.critDamage")}: ${critDmgMult}%`
  ];
  if (currentRageMax > 0) {
    lines.push(`🔥 ${t("stats.currentRage")}: ${currentRage}/${currentRageMax}`);
  }
  if (variants.length) {
    lines.push(`🎲 ${t("stats.variants")}: ${variants.length} ${t("stats.traitCountSuffix")}`);
    const totalBonus = aggregateVariantBonuses(variants);
    const summary = formatVariantBonusText(totalBonus);
    if (summary) lines.push(`  • ${t("stats.total")}: ${summary}`);
    variants.forEach((trait, index) => {
      const detail = formatVariantBonusText(trait?.bonus);
      lines.push(`  • ${index + 1}. ${trait?.name ?? t("stats.traitFallback")}${detail ? ` (${detail})` : ""}`);
    });
  }
  return lines;
}

export function getPlanningUnitTooltip(
  scene: PlanningTooltipScene,
  baseId: string,
  star: number = 1,
  ownedUnit: OwnedUnitLike | null = null
): unknown {
  const base = UNIT_BY_ID[baseId] as BaseUnitLike | undefined;
  if (!base) return { title: t("ui.unknown"), body: t("combat.noDescription") };
  const tooltipSide = resolvePlanningTooltipSide(ownedUnit);
  const visual = getUnitVisual(baseId, base.classType, star, {
    side: tooltipSide,
    ownerKind: tooltipSide === "RIGHT" ? "ENEMY" : "PLAYER",
    collectionProfile: scene.collectionProfile
  });
  const skill: SkillDefinition | null = getResolvedSkillDefinition(base.skillId, { baseId, star });
  const statScale = star === 1 ? 1 : star === 2 ? 1.6 : 2.5;
  const variants: VariantTrait[] = ownedUnit ? getPlanningUnitVariantTraits(scene as unknown as Parameters<typeof getPlanningUnitVariantTraits>[0], ownedUnit) : [];
  const equipmentCap = resolveUnitEquipmentSlotCap(ownedUnit ?? { baseId, base, star }, star as unknown as Parameters<typeof resolveUnitEquipmentSlotCap>[1]);
  const equippedItems = normalizeTooltipEquipIds(ownedUnit?.equips, ownedUnit ?? { baseId, base, star })
    .map((id: string) => ITEM_BY_ID[id])
    .filter((item): item is NonNullable<typeof item> & { kind: "equipment" } => item?.kind === "equipment");
  const tooltipVm = buildTooltipViewModel(base as Parameters<typeof buildTooltipViewModel>[0], star, { skill: skill ?? undefined } as unknown as Parameters<typeof buildTooltipViewModel>[2]);
  const theme = buildSharedTooltipTheme(scene as unknown as Parameters<typeof buildSharedTooltipTheme>[0], base.classType);
  const settings = scene.runtimeSettings ?? loadUiSettings();
  const tooltipMode = resolveSceneTooltipMode(settings as Parameters<typeof resolveSceneTooltipMode>[0]);
  if (tooltipMode === "off") return null;
  const displayResources = resolvePlanningDisplayResources(scene, ownedUnit, base, star);
  const descriptionText = getLocalizedUnitDescription(base as Parameters<typeof getLocalizedUnitDescription>[0], tooltipVm as Parameters<typeof getLocalizedUnitDescription>[1], star, settings as Parameters<typeof getLocalizedUnitDescription>[3]);

  let skillIcon = "✨";
  if (skill?.damageType === "physical") skillIcon = "🗡️";
  else if (skill?.damageType === "magic") skillIcon = "🪄";
  else if (skill?.damageType === "true") skillIcon = "💠";
  const skillDescLines = (tooltipVm as { skill: { lines: string[] } }).skill.lines;

  const equipCount = equippedItems.length;
  const col3Lines: string[] = [`📦 ${t("library.equipment")} (${equipCount}/${equipmentCap})`, ""];
  if (equipCount > 0) {
    equippedItems.forEach((item) => {
      const recipe = RECIPE_BY_ID[item.fromRecipe];
      col3Lines.push(`${item.icon} ${item.name}`);
      if (recipe?.description) col3Lines.push(`  ${recipe.description}`);
      col3Lines.push("");
    });
  } else {
    col3Lines.push(t("library.noEquipment"));
    col3Lines.push("");
    col3Lines.push(t("library.equipmentHint1"));
    col3Lines.push(t("library.equipmentHint2"));
  }

  type AttackStatRow = { key?: string; format?: string; metric?: string; valuesByStar?: Record<number, number> };
  type AttackContext = { statRows?: AttackStatRow[] };
  type BuildUnitStatsOpts = Parameters<typeof buildUnitStatsLines>[1];
  const attackCtx: AttackContext = ((tooltipVm as { attack: unknown }).attack as AttackContext) ?? null;
  const statsOptions: BuildUnitStatsOpts = {
    star,
    statScale,
    skill: skill as BuildUnitStatsOpts extends infer O ? O extends { skill?: infer S } ? S : never : never,
    attack: attackCtx,
    rageMaxOverride: displayResources?.rageMax,
    variants,
    formatVariantBonus: formatVariantBonusText
  };
  const statsLines = buildUnitStatsLines(base as Parameters<typeof buildUnitStatsLines>[0], statsOptions);
  const passiveLines: string[] = (tooltipVm as { passive?: { lines?: string[] } }).passive?.lines ?? [];
  const passiveTitle = (tooltipVm as { passive?: { title?: string } }).passive?.title ?? t("planning.tooltip.passive");
  const basicAtkLines: string[] = (tooltipVm as { attack: { lines: string[] } }).attack.lines;
  const scaledStats = scaledBaseStats(base.stats as unknown as Parameters<typeof scaledBaseStats>[0], star, base.classType);
  const activeStatusLines = buildActiveStatusTooltipLines(ownedUnit);
  const currentStatsLines = buildPlanningCurrentStatsLines(scene, base, ownedUnit, star, displayResources, variants);
  const summaryTraitLines: string[] = [
    `${getClassLabel(base.classType)} • ${getTribeLabel(base.tribe)}`,
    ...passiveLines.slice(0, 2)
  ].filter((line): line is string => Boolean(line));
  const summarySectionBlocks = buildSummaryUnitSectionBlocks({
    descriptionLines: String(descriptionText ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    traitLines: summaryTraitLines,
    activeStatusLines,
    currentSkillLines: buildCurrentSkillTooltipLines(skill as Parameters<typeof buildCurrentSkillTooltipLines>[0], tooltipVm as Parameters<typeof buildCurrentSkillTooltipLines>[1], star, settings as Parameters<typeof buildCurrentSkillTooltipLines>[3])
  });
  const metadataBadges = buildTooltipMetadataBadges(scene as unknown as Parameters<typeof buildTooltipMetadataBadges>[0], base as Parameters<typeof buildTooltipMetadataBadges>[1], star, {
    includeClass: true,
    includeTribe: true,
    includeSide: true,
    side: tooltipSide
  });
  const badgeRows = metadataBadges;
  const statusIcons = buildUnitStatusBadges(ownedUnit, displayResources);
  type MeterRow = { key: string; label: string; kind: string; value: number; max: number; shield?: number };
  const meterRows: MeterRow[] = [
    {
      key: "hp",
      label: t("label.hp"),
      kind: "bar",
      value: ownedUnit?.hp ?? scaledStats.hp,
      max: ownedUnit?.maxHp ?? scaledStats.hp,
      shield: ownedUnit?.shield ?? 0
    }
  ];
  if (displayResources.rageMax > 0) {
    meterRows.push({
      key: "rage",
      label: t("stats.rage"),
      kind: "pips",
      value: displayResources.rage,
      max: displayResources.rageMax
    });
  }
  const expandedSectionColumns = buildCanonicalUnitExpandedColumns({
    basicInfoLines: statsLines as Parameters<typeof buildCanonicalUnitExpandedColumns>[0] extends infer O ? O extends { basicInfoLines?: infer L } ? L : never : never,
    currentStatLines: currentStatsLines as Parameters<typeof buildCanonicalUnitExpandedColumns>[0] extends infer O ? O extends { currentStatLines?: infer L } ? L : never : never,
    activeStatusLines: activeStatusLines as Parameters<typeof buildCanonicalUnitExpandedColumns>[0] extends infer O ? O extends { activeStatusLines?: infer L } ? L : never : never,
    passiveTitle,
    passiveLines,
    basicAttackTitle: t("combat.basicAttack"),
    basicAttackLines: basicAtkLines,
    skillTitle: `${skillIcon} ${t("combat.skillLabel")}: ${skill?.name ?? t("combat.skillNone")}`,
    skillLines: skillDescLines,
    equipmentTitle: t("library.equipment"),
    equipmentLines: col3Lines
  });

  return buildUnitTooltipContentModel({
    tooltipMode,
    title: visual.name,
    subtitle: getClassLabel(base.classType),
    headerDescription: descriptionText,
    speechLabel: skill?.name ?? "",
    speechLang: resolveBrowserSpeechLang(getLocale()),
    avatar: {
      icon: visual.previewIcon ?? visual.icon ?? "🐾",
      previewIcon: visual.previewIcon ?? visual.icon ?? "🐾",
      portraitKey: visual.portraitKey ?? null,
      visual: visual.visual ?? null,
      star,
      hp: ownedUnit?.hp ?? scaledStats.hp,
      maxHp: ownedUnit?.maxHp ?? scaledStats.hp,
      side: tooltipSide,
      classType: base.classType,
      label: visual.name
    },
    theme,
    badgeRows,
    statusIcons,
    meterRows,
    expandedSectionColumns,
    summarySectionBlocks: summarySectionBlocks.filter((b): b is NonNullable<typeof b> => b !== null)
  });
}

export function getPlanningAugmentTooltip(scene: PlanningTooltipScene, augment: AugmentLike): { title: string; body: string } | null {
  const settings = scene.runtimeSettings ?? loadUiSettings();
  if (resolveSceneTooltipMode(settings as Parameters<typeof resolveSceneTooltipMode>[0]) === "off") return null;
  return {
    title: `${getPlanningAugmentIcon(scene as unknown as Parameters<typeof getPlanningAugmentIcon>[0], augment as Parameters<typeof getPlanningAugmentIcon>[1])} ${augment.name} [${planningTranslateAugmentGroup(scene as unknown as Parameters<typeof planningTranslateAugmentGroup>[0], augment.group as Parameters<typeof planningTranslateAugmentGroup>[1])}]`,
    body: `${augment.description}\n\n${t("log.detailEffect", { value: `${planningTranslateAugmentEffect(scene as unknown as Parameters<typeof planningTranslateAugmentEffect>[0], augment.effect.type)}${augment.effect.value != null ? ` (${augment.effect.value})` : ""}` })}`
  };
}

export function getPlanningSynergyTooltip(scene: PlanningTooltipScene): unknown {
  const settings = scene.runtimeSettings ?? loadUiSettings();
  if (resolveSceneTooltipMode(settings as Parameters<typeof resolveSceneTooltipMode>[0]) === "off") return null;
  const deployed: OwnedUnitLike[] = [];
  const isCoopMode = isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]);
  const rowCount = isCoopMode ? getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]) : ROWS;
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < PLAYER_COLS; col += 1) {
      const unit = isCoopMode
        ? getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col)
        : scene.player?.board?.[row]?.[col];
      if (unit) deployed.push(unit as OwnedUnitLike);
    }
  }

  const summary = planningComputeSynergyCounts(scene as unknown as Parameters<typeof planningComputeSynergyCounts>[0], deployed, "LEFT");
  return buildSynergyTooltipContent(scene as unknown as Parameters<typeof buildSynergyTooltipContent>[0], {
    title: t("library.synergyDetailTitle"),
    summaries: [{ title: t("combat.sidePlayer"), summary: summary as unknown as Record<string, unknown> }],
    augmentIds: (scene.player?.augments ?? []) as string[]
  });
}
