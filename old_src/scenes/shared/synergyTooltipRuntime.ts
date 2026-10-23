import { AUGMENT_LIBRARY, type AugmentDefinition } from "../../data/augments.js";
import { getClassIcon, getClassLabel, getTribeIcon, getTribeLabel } from "../../data/unitVisuals.js";
import { t } from "../../i18n/index.js";
import { SynergySystem, type SynergyDefinition } from "../../systems/SynergySystem.js";
import { buildSharedTooltipTheme } from "./tooltipTheme.js";
import { joinTooltipSectionBlocks } from "./unitTooltipRuntimeShared.js";

type AnyObj = Record<string, unknown>;
type MilestoneState = "active" | "near" | "inactive";
type SynergyBlockType = "class" | "tribe";

interface SynergySceneLike {
  getAugmentIcon: (augment: AugmentDefinition | null | undefined) => string;
  [key: string]: unknown;
}
function sortSynergyCounts(counts: Record<string, number> = {}): Array<[string, number]> {
  return Object.entries(counts).sort((a, b) => {
    if ((b[1] ?? 0) !== (a[1] ?? 0)) return (b[1] ?? 0) - (a[1] ?? 0);
    return String(a[0]).localeCompare(String(b[0]));
  });
}

function resolveMilestoneState(count: number, thresholds: number[], index: number): MilestoneState {
  const threshold = Number(thresholds?.[index] ?? 0) || 0;
  if (count >= threshold) return "active";
  const activeTier = SynergySystem.getSynergyTier(count, thresholds);
  const isNextTier = index === activeTier + 1;
  if (isNextTier && threshold - count === 1) return "near";
  return "inactive";
}

function getMilestoneStatePrefix(state: MilestoneState): string {
  if (state === "active") return "🟢";
  if (state === "near") return "🟡";
  return "⚪";
}

function getMilestoneStateSuffix(state: MilestoneState, isCurrentTier: boolean): string {
  if (isCurrentTier && state === "active") return ` • ${t("tooltip.synergy.activeNow")}`;
  if (state === "near") return ` • ${t("tooltip.synergy.nearHint")}`;
  return "";
}

function formatCurrentBonus(def: SynergyDefinition | null | undefined, tier: number): string {
  if (!def || tier < 0) return t("library.noSynergy");
  return SynergySystem.formatBonusSet(def.bonuses?.[tier]);
}

function buildSynergyBlocks(entries: Array<[string, number]>, type: SynergyBlockType): Array<{ title: string; lines: string[] }> {
  return entries.map(([key, count]) => {
    const def = type === "class"
      ? SynergySystem.getClassSynergyDef(key)
      : SynergySystem.getTribeSynergyDef(key);
    if (!def) return null;
    const label = type === "class" ? getClassLabel(key) : getTribeLabel(key);
    const icon = type === "class" ? getClassIcon(key) : getTribeIcon(key);
    const activeTier = SynergySystem.getSynergyTier(count, def.thresholds);
    const lines: string[] = [
      `✨ ${t("tooltip.synergy.currentBonus")}: ${formatCurrentBonus(def, activeTier)}`
    ];

    def.thresholds.forEach((threshold: number, index: number) => {
      const state = resolveMilestoneState(count, def.thresholds, index);
      const prefix = getMilestoneStatePrefix(state);
      const bonusText = SynergySystem.formatBonusSet(def.bonuses?.[index]);
      const suffix = getMilestoneStateSuffix(state, index === activeTier);
      lines.push(`${prefix} ${t("tooltip.synergy.milestone", { value: threshold })}: ${bonusText}${suffix}`);
    });

    return {
      title: `${icon} ${type === "class" ? t("label.class") : t("label.tribe")} ${label}: ${count}`,
      lines
    };
  }).filter((block): block is { title: string; lines: string[] } => block !== null);
}

function buildAugmentBlock(scene: SynergySceneLike, augmentIds: string[] = []): { title: string; lines: string[] } | null {
  if (!Array.isArray(augmentIds) || !augmentIds.length) return null;
  const lines = augmentIds.map((id) => {
    const aug = AUGMENT_LIBRARY.find((entry) => entry.id === id);
    if (!aug) return null;
    return `${scene.getAugmentIcon(aug)} ${aug.name}: ${aug.description}`;
  }).filter((line): line is string => line !== null);
  if (!lines.length) return null;
  return {
    title: t("library.selectedAugments"),
    lines
  };
}

function countActiveSynergies(summary: AnyObj = {}): { classActive: number; tribeActive: number } {
  const classActive = Object.entries((summary.classCounts as Record<string, number> | undefined) ?? {}).filter(([key, count]) => {
    const def = SynergySystem.getClassSynergyDef(key);
    return def && SynergySystem.getSynergyTier(count, def.thresholds) >= 0;
  }).length;
  const tribeActive = Object.entries((summary.tribeCounts as Record<string, number> | undefined) ?? {}).filter(([key, count]) => {
    const def = SynergySystem.getTribeSynergyDef(key);
    return def && SynergySystem.getSynergyTier(count, def.thresholds) >= 0;
  }).length;
  return { classActive, tribeActive };
}

export function buildSynergyTooltipContent(scene: SynergySceneLike, {
  title,
  summaries = [],
  augmentIds = []
}: {
  title?: string;
  summaries?: Array<{ title?: string; summary?: AnyObj }>;
  augmentIds?: string[];
} = {}) {
  const sectionBlocks: Array<{ title?: string; lines: string[] }> = [];
  const badgeRows: Array<{ text: string; tone: string }> = [];
  const multipleSides = summaries.length > 1;

  summaries.forEach((entry) => {
    const summary = entry?.summary ?? {};
    const titleText = String(entry?.title ?? "").trim();
    if (multipleSides && titleText) {
      sectionBlocks.push({ title: titleText, lines: [] });
    }

    buildSynergyBlocks(sortSynergyCounts(summary.classCounts as Record<string, number> | undefined), "class")
      .forEach((block) => sectionBlocks.push(block));
    buildSynergyBlocks(sortSynergyCounts(summary.tribeCounts as Record<string, number> | undefined), "tribe")
      .forEach((block) => sectionBlocks.push(block));

    const counts = countActiveSynergies(summary);
    if (titleText) {
      badgeRows.push({ text: `🧩 ${titleText}`, tone: "status" });
    }
    badgeRows.push({ text: `🟢 ${t("label.class")}: ${counts.classActive}`, tone: "class" });
    badgeRows.push({ text: `🟢 ${t("label.tribe")}: ${counts.tribeActive}`, tone: "tribe" });
  });

  if (!sectionBlocks.length) {
    sectionBlocks.push({
      title: t("library.noSynergy"),
      lines: [t("tooltip.synergy.noneActive")]
    });
  }

  const augmentBlock = buildAugmentBlock(scene, augmentIds);
  if (augmentBlock) {
    sectionBlocks.push(augmentBlock);
    badgeRows.push({ text: `✨ ${t("combat.augments")}: ${augmentBlock.lines.length}`, tone: "status" });
  }

  return {
    layoutMode: "summary",
    title,
    subtitle: t("tooltip.synergy.legend"),
    avatar: {
      previewIcon: "🧩",
      icon: "🧩",
      label: title
    },
    theme: {
      ...buildSharedTooltipTheme(scene, ""),
      titleColor: "#9ff18c"
    },
    badgeRows,
    sectionBlocks,
    body: joinTooltipSectionBlocks(sectionBlocks)
  };
}
