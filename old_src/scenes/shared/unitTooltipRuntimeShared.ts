import { ITEM_BY_ID, getItemSellPrice } from "../../data/items.js";
import { getClassIcon, getClassLabel, getTribeIcon, getTribeLabel } from "../../data/unitVisuals.js";
import { resolveBrowserSpeechLang } from "../../core/browserSpeech.js";
import { getLocale, t } from "../../i18n/index.js";
import { stripTooltipHighlightMarkup } from "../../core/tooltipInlineMarkup.js";
import { normalizeTooltipMode, type TooltipMode } from "../../core/uiSettings.js";
import { buildActiveStatusTooltipEntries } from "./tooltipStatusRuntime.js";

interface TooltipSectionBlock {
  title?: unknown;
  lines?: unknown[];
}

interface UnitLike {
  tier?: number;
  star?: number;
  side?: "LEFT" | "RIGHT" | string;
  classType?: string;
  tribe?: string;
  equips?: string[];
  [key: string]: unknown;
}

interface TooltipSceneLike {
  getUnitSalePrice?: (unit: unknown) => number;
  [key: string]: unknown;
}

interface TooltipSettings {
  tooltipMode?: unknown;
  expandedTooltip?: boolean;
  language?: string;
  [key: string]: unknown;
}

interface SkillLike {
  name?: string;
  description?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  summaryByStar?: Record<number, string>;
  summaryText?: string;
  detailByStar?: Record<number, string>;
  detailText?: string;
  [key: string]: unknown;
}

interface TooltipVmLike {
  skill?: SkillLike;
  [key: string]: unknown;
}

interface BaseUnitLike {
  description?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  [key: string]: unknown;
}

interface TooltipBadge {
  text?: string;
  tone?: string;
  [key: string]: unknown;
}

interface SummarySectionBlocksOptions {
  descriptionTitle?: unknown;
  descriptionLines?: unknown[];
  traitTitle?: unknown;
  traitLines?: unknown[];
  activeStatusTitle?: unknown;
  activeStatusLines?: unknown[];
  currentSkillTitle?: unknown;
  currentSkillLines?: unknown[];
}

interface MetadataBadgeOptions {
  includeClass?: boolean;
  includeTribe?: boolean;
  includeSide?: boolean;
  side?: unknown;
}

interface UnitStatusBadgesOptions {
  limit?: number;
}

interface CanonicalExpandedColumnsOptions {
  basicInfoLines?: unknown[];
  currentStatLines?: unknown[];
  activeStatusLines?: unknown[];
  passiveTitle?: unknown;
  passiveLines?: unknown[];
  basicAttackTitle?: unknown;
  basicAttackLines?: unknown[];
  skillTitle?: unknown;
  skillLines?: unknown[];
  equipmentTitle?: unknown;
  equipmentLines?: unknown[];
}

interface UnitTooltipContentModelOptions {
  tooltipMode?: TooltipMode | string | null;
  title?: unknown;
  subtitle?: string;
  headerDescription?: string;
  speechLabel?: string;
  speechLang?: string;
  avatar?: unknown;
  theme?: unknown;
  badgeRows?: unknown[];
  statusIcons?: unknown[];
  meterRows?: unknown[];
  expandedSectionColumns?: unknown[][];
  summarySectionBlocks?: TooltipSectionBlock[];
}

export function joinTooltipSectionBlocks(blocks: TooltipSectionBlock[] | null | undefined) {
  return (blocks ?? [])
    .map((block) => {
      const lines = [
        block?.title ? `🔹 ${stripTooltipHighlightMarkup(String(block.title))}` : null,
        ...(block?.lines ?? []).map((line) => stripTooltipHighlightMarkup(String(line ?? "").trimEnd()))
      ]
        .filter(Boolean);
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function resolveSceneTooltipMode(settings: TooltipSettings | null | undefined): TooltipMode {
  return normalizeTooltipMode(settings?.tooltipMode, settings?.expandedTooltip === true);
}

export function normalizeTooltipSide(side: unknown): "LEFT" | "RIGHT" {
  const normalized = String(side ?? "").trim().toUpperCase();
  if (["RIGHT", "ENEMY", "FOE", "OPPONENT"].includes(normalized)) return "RIGHT";
  if (["LEFT", "ALLY", "PLAYER", "FRIEND"].includes(normalized)) return "LEFT";
  return normalized.includes("RIGHT") || normalized.includes("ENEMY") ? "RIGHT" : "LEFT";
}

function resolveTooltipCostValue(unitLike: UnitLike | null | undefined) {
  const rawValue = Number(unitLike?.tier);
  return Math.max(1, Math.round(Number.isFinite(rawValue) ? rawValue : 1));
}

function resolveUnitSalePrice(scene: TooltipSceneLike | null | undefined, unitLike: UnitLike | null | undefined) {
  if (!unitLike) return 0;
  if (typeof scene?.getUnitSalePrice === "function") {
    const price = Number(scene.getUnitSalePrice(unitLike));
    if (Number.isFinite(price)) return Math.max(1, Math.round(price));
  }
  const tier = resolveTooltipCostValue(unitLike);
  const star = Math.max(1, Math.round(Number(unitLike?.star) || 1));
  let price = Math.max(1, Math.floor(tier * (star === 3 ? 5 : star === 2 ? 3 : 1)));
  if (Array.isArray(unitLike?.equips)) {
    unitLike.equips.forEach((itemId) => {
      const item = ITEM_BY_ID[itemId];
      if (item?.kind === "equipment") price += getItemSellPrice(itemId);
    });
  }
  return price;
}

function normalizeTooltipBlock(title: unknown, lines: unknown[] = []) {
  const normalizedLines = (lines ?? []).map((line) => String(line ?? "").trimEnd()).filter((line) => line.trim().length > 0);
  if (!normalizedLines.length) return null;
  return {
    title: String(title ?? "").trim(),
    lines: normalizedLines
  };
}

function flattenSectionColumns(columns: unknown[] = []) {
  return (columns ?? []).flatMap((column) => Array.isArray(column) ? column : []).filter(Boolean);
}

export function buildSummaryUnitSectionBlocks({
  descriptionTitle = t("tooltip.summary.description"),
  descriptionLines = [],
  traitTitle = t("tooltip.summary.traits"),
  traitLines = [],
  activeStatusTitle = "Hiệu ứng đang dính",
  activeStatusLines = [],
  currentSkillTitle = t("tooltip.summary.currentSkill"),
  currentSkillLines = []
}: SummarySectionBlocksOptions = {}) {
  return [
    normalizeTooltipBlock(descriptionTitle, descriptionLines),
    normalizeTooltipBlock(traitTitle, traitLines),
    normalizeTooltipBlock(activeStatusTitle, activeStatusLines),
    normalizeTooltipBlock(currentSkillTitle, currentSkillLines)
  ].filter(Boolean);
}

export function buildTooltipMetadataBadges(
  scene: TooltipSceneLike | null | undefined,
  unitLike: UnitLike | null | undefined,
  star: unknown,
  {
    includeClass = true,
    includeTribe = true,
    includeSide = false,
    side = unitLike?.side ?? "LEFT"
  }: MetadataBadgeOptions = {}
): TooltipBadge[] {
  const normalizedSide = normalizeTooltipSide(side);
  const tier = resolveTooltipCostValue(unitLike);
  const safeStar = Math.max(1, Math.round(Number(star ?? unitLike?.star) || 1));
  const badges: TooltipBadge[] = [
    { text: `🪙 Giá mua ${tier}`, tone: "gold" },
    { text: `🏷️ ${t("label.tier")} ${tier}`, tone: "tier" },
    { text: `⭐ Số sao ${safeStar}`, tone: "star" },
    { text: `💰 Giá bán ${resolveUnitSalePrice(scene, { ...unitLike, star: safeStar })}`, tone: "gold" }
  ];
  if (includeClass) badges.push({ text: `${getClassIcon(unitLike?.classType)} ${getClassLabel(unitLike?.classType)}`, tone: "class" });
  if (includeTribe) badges.push({ text: `${getTribeIcon(unitLike?.tribe)} ${getTribeLabel(unitLike?.tribe)}`, tone: "tribe" });
  if (includeSide) {
    badges.push({
      text: t("combat.teamBadge", { team: normalizedSide === "RIGHT" ? t("combat.teamEnemy") : t("combat.teamAlly") }),
      tone: "status"
    });
  }
  return badges.filter((badge) => String(badge?.text ?? "").trim());
}

export function getLocalizedUnitDescription(baseUnit: BaseUnitLike | null | undefined, tooltipVm: TooltipVmLike | null | undefined, star: unknown, settings: TooltipSettings | null | undefined) {
  const locale = settings?.language === "en" ? "en" : "vi";
  const numericStar = Number.isFinite(Number(star)) ? Number(star) : undefined;
  const summary = (numericStar !== undefined ? (tooltipVm?.skill?.summaryByStar?.[numericStar] ?? tooltipVm?.skill?.summaryText) : tooltipVm?.skill?.summaryText) ?? "";
  const detail = (numericStar !== undefined ? (tooltipVm?.skill?.detailByStar?.[numericStar] ?? tooltipVm?.skill?.detailText) : tooltipVm?.skill?.detailText) ?? "";
  const rawDescription = locale === "en"
    ? (baseUnit?.descriptionEn ?? "")
    : (baseUnit?.descriptionVi ?? baseUnit?.description ?? "");
  const normalizedDescription = String(rawDescription ?? "").trim();
  const looksLikeDetailedSkillText = normalizedDescription.length > 110
    || /[\d%]/.test(normalizedDescription)
    || /\b(?:ATK|MATK|DEF|MDEF|HP)\b/.test(normalizedDescription)
    || /\blượt\b/i.test(normalizedDescription)
    || normalizedDescription === String(detail ?? "").trim();
  if (locale === "en") {
    return (!looksLikeDetailedSkillText && normalizedDescription) || summary || t("combat.noDescription");
  }
  return (!looksLikeDetailedSkillText && normalizedDescription) || summary || t("combat.noDescription");
}

export function buildCurrentSkillTooltipLines(skill: SkillLike | null | undefined, tooltipVm: TooltipVmLike | null | undefined, star: unknown, settings: TooltipSettings | null | undefined) {
  const locale = settings?.language === "en" ? "en" : "vi";
  const numericStar = Number.isFinite(Number(star)) ? Number(star) : undefined;
  const summary = (numericStar !== undefined ? (tooltipVm?.skill?.summaryByStar?.[numericStar] ?? tooltipVm?.skill?.summaryText) : tooltipVm?.skill?.summaryText) ?? "";
  const resolvedSummary = summary || (locale === "en" ? skill?.descriptionEn : (skill?.descriptionVi ?? skill?.description)) || "";
  return [
    skill?.name ?? t("combat.skillNone"),
    ...String(resolvedSummary ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  ];
}

export function buildUnitStatusBadges(unit: unknown, _displayResources: Record<string, unknown> = {}, { limit = 8 }: UnitStatusBadgesOptions = {}) {
  const badges: TooltipBadge[] = [];
  buildActiveStatusTooltipEntries(unit).forEach((entry) => {
    badges.push({
      icon: entry?.icon,
      label: entry?.label,
      badgeText: entry?.badgeText,
      tone: "status"
    });
  });

  return badges.slice(0, Math.max(1, limit));
}

export function buildCanonicalUnitExpandedColumns({
  basicInfoLines = [],
  currentStatLines = [],
  activeStatusLines = [],
  passiveTitle = "",
  passiveLines = [],
  basicAttackTitle = t("combat.basicAttack"),
  basicAttackLines = [],
  skillTitle = t("combat.skillLabel"),
  skillLines = [],
  equipmentTitle = t("library.equipment"),
  equipmentLines = []
}: CanonicalExpandedColumnsOptions = {}) {
  return [
    [
      normalizeTooltipBlock("Thông tin cơ bản", basicInfoLines)
    ].filter(Boolean),
    [
      normalizeTooltipBlock("Chỉ số hiện tại", currentStatLines),
      normalizeTooltipBlock(equipmentTitle, equipmentLines),
      normalizeTooltipBlock("Hiệu ứng đang dính", activeStatusLines)
    ].filter(Boolean),
    [
      normalizeTooltipBlock(passiveTitle, passiveLines),
      normalizeTooltipBlock(basicAttackTitle, basicAttackLines)
    ].filter(Boolean),
    [
      normalizeTooltipBlock(skillTitle, skillLines)
    ].filter(Boolean)
  ].filter((column: unknown[]) => column.length > 0);
}

export function buildUnitTooltipContentModel({
  tooltipMode,
  title,
  subtitle = "",
  headerDescription = "",
  speechLabel = "",
  speechLang = resolveBrowserSpeechLang(getLocale()),
  avatar,
  theme,
  badgeRows = [],
  statusIcons = [],
  meterRows = [],
  expandedSectionColumns = [],
  summarySectionBlocks = []
}: UnitTooltipContentModelOptions = {}) {
  const sectionColumns = tooltipMode === "expanded"
    ? expandedSectionColumns
    : tooltipMode === "summary" && Array.isArray(summarySectionBlocks) && summarySectionBlocks.length
      ? [summarySectionBlocks as unknown[]]
      : [flattenSectionColumns(expandedSectionColumns)];
  const sectionBlocks = flattenSectionColumns(sectionColumns);
  return {
    layoutMode: tooltipMode,
    title,
    headerMeta: "",
    headerDescription,
    subtitle: tooltipMode === "expanded" ? "" : subtitle,
    speechLabel: String(speechLabel ?? "").trim(),
    speechLang: String(speechLang ?? "").trim() || resolveBrowserSpeechLang(getLocale()),
    avatar,
    theme,
    badgeRows: (badgeRows ?? []).filter(Boolean),
    statusIcons: (statusIcons ?? []).filter(Boolean),
    meterRows: (meterRows ?? []).filter(Boolean),
    statRows: [],
    sectionBlocks,
    sectionColumns,
    body: joinTooltipSectionBlocks(sectionBlocks as TooltipSectionBlock[] | undefined)
  };
}
