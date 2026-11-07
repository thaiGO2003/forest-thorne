/**
 * Shared helper functions for generating unit / skill tooltip descriptions.
 * V3-first: prefer authored attackDef + tooltipModel. Legacy helpers remain as fallback.
 */

import { getLocale, t } from "../i18n/index.js";
import { prettyIdLabel, resolveLocaleField } from "../i18n/localeText.js";
import { resolveUnitSkillForStar } from "../data/unitCatalog.js";
import { scaledBaseStats } from "./gameUtils.js";
import { formatRangeLabel } from "./rangeText.js";
import {
  containsVietnamesePlayerJargon,
  sanitizeVietnamesePlayerText
} from "./viTextSanitizer.js";
import {
  BASIC_ATTACK_ROLL_MAX,
  BASIC_ATTACK_ROLL_MIN
} from "./damageResolver.js";
import {
  highlightTooltipActiveText,
  stripTooltipHighlightMarkup
} from "./tooltipInlineMarkup.js";
import {
  getRolePassiveLines,
  getRolePassiveSectionTitle
} from "./rolePassives.js";


export interface TooltipRow {
  key?: string;
  label?: string;
  labelKey?: string;
  labelVi?: string;
  labelEn?: string;
  metric?: string;
  format?: string;
  displayMode?: string | null;
  valuesByStar?: Record<number | string, unknown>;
  [key: string]: unknown;
}

export interface FormulaOperation {
  operator?: string;
  labelVi?: string;
  labelEn?: string;
  label?: string;
  value?: number | string;
  isStarCoefficient?: boolean;
  kind?: string;
  key?: string;
  [key: string]: unknown;
}

export interface ResolvedFormulaOperation {
  operator: string;
  value: number;
  valueText: string;
  displayText: string;
}

export interface TooltipKeyword {
  title?: string;
  titleKey?: string;
  body?: string;
  bodyKey?: string;
  [key: string]: unknown;
}

export interface MilestoneEntry {
  star: number;
  text: string;
}

export interface TooltipModel {
  header?: {
    resourceRows?: TooltipRow[];
    [key: string]: unknown;
  };
  summary?: {
    key?: string | null;
    text?: string;
    textVi?: string;
    textEn?: string;
    tokensByStar?: Record<number, Record<string, unknown>>;
    [key: string]: unknown;
  };
  castTypeTextVi?: string;
  castTypeTextEn?: string;
  targetTextVi?: string;
  targetTextEn?: string;
  shapeTextVi?: string;
  shapeTextEn?: string;
  selectionRuleTextVi?: string;
  selectionRuleTextEn?: string;
  affectedCountTextVi?: string;
  affectedCountTextEn?: string;
  durationRuleTextVi?: string;
  durationRuleTextEn?: string;
  areaDescriptionVi?: string;
  areaDescriptionEn?: string;
  details?: string[];
  statRows?: TooltipRow[];
  keywords?: TooltipKeyword[];
  errors?: Record<string, unknown>;
  previewCells?: unknown[];
  metricsByStar?: Record<number, Record<string, unknown>>;
  detail?: {
    textVi?: string;
    textEn?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AttackDef {
  delivery?: string;
  damageType?: string;
  scale?: {
    stat?: string;
    ratio?: number | string;
  };
  target?: {
    tooltipTextVi?: string;
    tooltipTextEn?: string;
    tooltipText?: string;
    shape?: {
      previewCells?: unknown[];
    };
    [key: string]: unknown;
  };
  tooltipDef?: {
    header?: {
      resourceRows?: TooltipRow[];
    };
    summaryKey?: string;
    summaryTextVi?: string;
    summaryTextEn?: string;
    summary?: string;
    tokenMap?: Record<string, { metric: string }>;
    castTypeTextVi?: string;
    castTypeTextEn?: string;
    targetTextVi?: string;
    targetTextEn?: string;
    shapeTextVi?: string;
    shapeTextEn?: string;
    selectionRuleTextVi?: string;
    selectionRuleTextEn?: string;
    affectedCountTextVi?: string;
    affectedCountTextEn?: string;
    durationRuleTextVi?: string;
    durationRuleTextEn?: string;
    areaDescriptionVi?: string;
    areaDescriptionEn?: string;
    detailKeys?: string[];
    statRows?: TooltipRow[];
    keywords?: TooltipKeyword[];
    errors?: Record<string, unknown>;
    previewCells?: unknown[];
    [key: string]: unknown;
  };
  tooltipModel?: TooltipModel;
  metricsByStar?: Record<number, Record<string, unknown>>;
  [key: string]: unknown;
}

export interface Skill {
  id?: string;
  name?: string;
  nameVi?: string;
  nameEn?: string;
  cost?: number;
  description?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  summaryText?: string;
  summaryTextVi?: string;
  summaryTextEn?: string;
  detailText?: string;
  detailTextVi?: string;
  detailTextEn?: string;
  actionPattern?: string;
  castTypeText?: string;
  targetText?: string | Record<number | string, string>;
  shapeText?: string;
  selectionRuleText?: string;
  affectedCountText?: string;
  durationRuleText?: string;
  areaDescription?: string;
  base?: number | string;
  scale?: number | string;
  damageType?: string;
  scaleStat?: string;
  damageFalloff?: number | string;
  maxHits?: number | string;
  formulaOperations?: FormulaOperation[];
  healBase?: number | string;
  healScale?: number | string;
  healScaleStat?: string;
  shieldBase?: number | string;
  shieldScale?: number | string;
  shieldScaleStat?: string;
  maxTargets?: number | string;
  turns?: number | string;
  armorBuff?: number | string;
  mdefBuff?: number | string;
  atkBuff?: number | string;
  offenseDebuffValue?: number | string;
  atkDebuffValue?: number | string;
  offenseDebuffMode?: string;
  offenseDebuffStat?: string;
  casterOnlyDebuff?: boolean;
  targetClasses?: string[];
  reflectPct?: number | string;
  stunChance?: number | string;
  burnChance?: number | string;
  burnPerTurn?: number | string;
  healPctMaxHp?: number | string;
  hotPctMaxHp?: number | string;
  cleanseCount?: number | string;
  damageReductionPct?: number | string;
  magicDamageReductionPct?: number | string;
  guardianAbsorbPct?: number | string;
  applyAntiHeal?: boolean;
  maxStacks?: number | string;
  maxTotalBasicHits?: number | string;
  extraAttackChance?: number | string;
  selfHpCostPct?: number | string;
  tooltipModel?: TooltipModel;
  tooltipDef?: Record<string, unknown>;
  runtimeShapeVersion?: number;
  effectLabel?: string;
  [key: string]: unknown;
}

export interface BaseUnit {
  id?: string;
  tribe?: string;
  classType?: string;
  description?: string;
  descriptionVi?: string;
  descriptionEn?: string;
  authoredDescriptionVi?: string;
  authoredDescriptionEn?: string;
  star1Desc?: string;
  star2Desc?: string;
  star3Desc?: string;
  passiveLinesByStar?: Record<number | string, unknown>;
  stats?: {
    hp?: number;
    atk?: number;
    matk?: number;
    def?: number;
    mdef?: number;
    range?: number;
    rageMax?: number;
    [key: string]: unknown;
  };
  attackDef?: AttackDef;
  skill?: Skill;
  [key: string]: unknown;
}

export interface TooltipVm {
  source?: string;
  title?: string;
  summaryText?: string;
  summaryByStar?: Record<number, string>;
  detailText?: string;
  detailByStar?: Record<number, string>;
  upgradeByStar?: Record<number, string>;
  castTypeText?: string;
  targetText?: string;
  shapeText?: string;
  selectionRuleText?: string;
  affectedCountText?: string;
  durationRuleText?: string;
  areaDescription?: string;
  resourceRows?: TooltipRow[];
  statRows?: TooltipRow[];
  keywords?: TooltipKeyword[];
  milestones?: MilestoneEntry[];
  enrichStructuralText?: boolean;
  [key: string]: unknown;
}

export interface RenderTooltipOptions {
  kind?: "attack" | "skill";
  suppressSkillMetricRowsWhenDetailed?: boolean;
  suppressSkillRageCostRow?: boolean;
  suppressAttackPresentationRows?: boolean;
  omitSkillLeadDetail?: boolean;
  enrichStructuralText?: boolean;
}


function getUnitSkillForStar(baseOrUnit: unknown, star: number = 1): Skill | null {
  return (resolveUnitSkillForStar(baseOrUnit, star) as unknown as Skill) ?? null;
}

function getScaledBaseStats(stats?: Record<string, unknown> | null, star: number = 1, classType?: string | null) {
  const safeStats: Parameters<typeof scaledBaseStats>[0] = {
    hp: Number(stats?.hp ?? 0) || 0,
    atk: Number(stats?.atk ?? 0) || 0,
    def: Number(stats?.def ?? 0) || 0,
    matk: Number(stats?.matk ?? 0) || 0,
    mdef: Number(stats?.mdef ?? 0) || 0,
    range: Number(stats?.range ?? 1) || 1,
    rageMax: Number(stats?.rageMax ?? 0) || 0
  };
  return scaledBaseStats(safeStats, star, classType ?? "");
}

const FALLBACK_LABELS: Record<string, string> = {
  "tooltip.damage": "Sát thương",
  "tooltip.heal": "Hồi máu",
  "tooltip.heal_pct_max_hp": "Hồi máu (% HP tối đa)",
  "tooltip.shield": "Khiên",
  "tooltip.shield_pct_max_hp": "Khiên (% HP tối đa)",
  "tooltip.range": "Tầm đánh",
  "tooltip.turns": "Thời lượng",
  "tooltip.target_count": "Số mục tiêu",
  "tooltip.def_buff": "Tăng DEF",
  "tooltip.mdef_buff": "Tăng MDEF",
  "tooltip.attack_buff": "Tăng ATK",
  "tooltip.attack_reduction": "Giảm ATK",
  "tooltip.magic_attack_reduction": "Giảm MATK",
  "tooltip.offense_reduction": "Giảm sức công theo vai trò",
  "tooltip.reflect_pct": "Phản chiếu",
  "tooltip.phys_reflect_pct": "Phản đòn vật lý",
  "tooltip.damage_reduction": "Giảm sát thương",
  "tooltip.magic_damage_reduction": "Giảm sát thương phép",
  "tooltip.cleanse_count": "Thanh tẩy",
  "tooltip.hot_pct_max_hp": "Hồi dần (% HP tối đa)",
  "tooltip.max_hp_pct": "Tăng HP tối đa (%)",
  "tooltip.guardian_absorb_pct": "Gánh đòn",
  "tooltip.stun_chance": "Tỉ lệ choáng",
  "tooltip.burn_chance": "Tỉ lệ thiêu đốt",
  "tooltip.burn_damage": "Thiêu đốt / lượt",
  "tooltip.cost.rage": "Nộ khí cần",
  "tooltip.cast_type": "Kiểu tung",
  "tooltip.attack_type": "Kiểu đánh"
};

const GENERIC_SHAPE = "mẫu kỹ năng đặc thù";
const GENERIC_SHAPE_EN = "special skill pattern";

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveLocaleText(key: unknown, fallback: string = ""): string {
  if (typeof key === "string" && key.trim()) {
    const translated = t(key);
    return translated !== key ? translated : (typeof key === "string" ? FALLBACK_LABELS[key] : undefined) ?? fallback ?? "";
  }
  return fallback ?? "";
}

function getLocaleFieldOptions(locale: string = getLocale()) {
  const isEnglish = locale === "en";
  return {
    locale,
    allowBase: !isEnglish,
    allowCrossLocale: !isEnglish
  };
}

function resolvePlayerFacingField(source: unknown, baseField: string, locale: string = getLocale(), fallback: string = ""): string {
  return resolveLocaleField(source, baseField, {
    ...getLocaleFieldOptions(locale),
    fallback
  });
}

function clampStar(star: unknown): number {
  const parsed = Number.parseInt(String(star ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  if (parsed > 3) return 3;
  return parsed;
}

function formatEnglishTechnicalLabel(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const normalized = text
    .replace(/\./g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  const tokenMap: Record<string, string> = {
    hp: "HP",
    atk: "ATK",
    matk: "MATK",
    def: "DEF",
    mdef: "MDEF",
    pct: "%",
    hot: "HoT",
    rage: "Rage",
    turns: "Turns",
    turn: "Turn",
    heal: "Heal",
    shield: "Shield",
    damage: "Damage",
    reduction: "Reduction",
    reflect: "Reflect",
    count: "Count",
    target: "Target",
    targets: "Targets",
    cost: "Cost",
    max: "Max"
  };
  const parts = normalized.split(/[_-]+/).filter(Boolean).map((part) => tokenMap[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`);
  return parts.join(" ").replace(/\s+%/g, "%").trim();
}

function resolveRowLabel(row: TooltipRow | null | undefined): string {
  const locale = getLocale();
  return pickFirstString(
    resolvePlayerFacingField(row, "label", locale),
    resolveLocaleText(row?.labelKey),
    locale === "en"
      ? pickFirstString(
          formatEnglishTechnicalLabel(row?.metric),
          formatEnglishTechnicalLabel(row?.key),
          formatEnglishTechnicalLabel(row?.labelKey)
        )
      : row?.label
  );
}

function resolveRowEmoji(row: TooltipRow | null | undefined): string {
  const rawKey = String(row?.labelKey ?? row?.key ?? row?.metric ?? "").trim().toLowerCase();
  if (!rawKey) return "";
  if (rawKey.includes("formula")) return "🧮";
  if (rawKey.includes("cost.rage") || rawKey.includes("maxrage") || rawKey.includes("rage")) return "🔥";
  if (rawKey.includes("shield")) return "🛡️";
  if (rawKey.includes("heal")) return "💚";
  if (rawKey.includes("mdef")) return "🔰";
  if (rawKey.includes("def")) return "🛡️";
  if (rawKey.includes("reflect")) return "🌀";
  if (rawKey.includes("range")) return "🏹";
  if (rawKey.includes("turn") || rawKey.includes("duration")) return "⏳";
  if (rawKey.includes("count") || rawKey.includes("target")) return "🔢";
  if (rawKey.includes("chance") || rawKey.includes("rate")) return "🎲";
  if (rawKey.includes("burn")) return "🔥";
  if (rawKey.includes("stun")) return "💫";
  if (rawKey.includes("attack") || rawKey.includes("atk") || rawKey.includes("damage") || rawKey.includes("damagetype")) return "⚔️";
  return "";
}

function prependEmoji(text: unknown, emoji: unknown): string {
  const normalized = String(text ?? "").trim();
  if (!normalized || !emoji) return normalized;
  return `${emoji} ${normalized}`;
}

function formatMetricValue(value: unknown, format?: string | null, metric: string = ""): string {
  if (value == null || value === "") return "-";
  const num = Number(value);
  if (format === "range_text" || metric === "attack.range") {
    return formatRangeLabel(value);
  }
  switch (format) {
    case "percent":
      if (!Number.isFinite(num)) return String(value);
      return `${Math.round(num * 100)}%`;
    case "seconds":
      if (!Number.isFinite(num)) return String(value);
      return `${num}s`;
    case "turns":
      if (!Number.isFinite(num)) return String(value);
      return getLocale() === "en" ? `${Math.round(num)} turns` : `${Math.round(num)} lượt`;
    case "ratio":
      if (!Number.isFinite(num)) return String(value);
      return num.toFixed(2);
    default:
      if (!Number.isFinite(num)) return String(value);
      return `${Math.round(num)}`;
  }
}

function formatFormulaNumber(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(3).replace(/\.?0+$/, "");
}

function formatSignedNumber(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric >= 0 ? `+${numeric}` : `${numeric}`;
}

function normalizeFormulaOperator(operator: unknown): string {
  const normalized = String(operator ?? "x").trim().toLowerCase();
  if (normalized === "*" || normalized === "×") return "x";
  if (normalized === "+" || normalized === "-" || normalized === "/" || normalized === "x") return normalized;
  return "x";
}

function buildResolvedFormulaOperations(starMult: number, formulaOperations: unknown[] = []): ResolvedFormulaOperation[] {
  const incoming: FormulaOperation[] = Array.isArray(formulaOperations)
    ? formulaOperations.filter((entry): entry is FormulaOperation => Boolean(entry && typeof entry === "object"))
    : [];
  const hasExplicitStarCoefficient = incoming.some((entry) => (
    entry?.isStarCoefficient === true
    || String(entry?.kind ?? "").trim().toLowerCase() === "star"
    || String(entry?.key ?? "").trim().toLowerCase() === "star"
  ));
  const sourceOperations: FormulaOperation[] = hasExplicitStarCoefficient
    ? incoming
    : [{
        operator: "x",
        labelVi: "Hệ số sao",
        labelEn: "Star coefficient",
        value: starMult,
        isStarCoefficient: true
      }, ...incoming];

  return sourceOperations
    .map((entry) => {
      const operator = normalizeFormulaOperator(entry?.operator);
      const numericValue = Number(entry?.value);
      if (!Number.isFinite(numericValue)) return null;
      if (operator === "/" && numericValue === 0) return null;
      const labelText = pickFirstString(
        resolvePlayerFacingField(entry, "label", getLocale()),
        getLocale() === "en" ? entry?.labelEn : entry?.labelVi,
        entry?.label
      );
      const valueText = formatFormulaNumber(numericValue);
      return {
        operator,
        value: numericValue,
        valueText,
        displayText: labelText ? `${labelText} (${valueText})` : valueText
      };
    })
    .filter((entry): entry is ResolvedFormulaOperation => Boolean(entry));
}

function applyFormulaOperationsNumeric(baseValue: unknown, formulaOperations: ResolvedFormulaOperation[] | FormulaOperation[] = []): number {
  let current = Number(baseValue) || 0;
  formulaOperations.forEach((entry) => {
    switch (entry.operator) {
      case "+":
        current += Number(entry.value) || 0;
        break;
      case "-":
        current -= Number(entry.value) || 0;
        break;
      case "/":
        current /= Number(entry.value) || 1;
        break;
      case "x":
      default:
        current *= Number(entry.value) || 0;
        break;
    }
  });
  return current;
}

function buildBasicAttackFormulaText(statKey: string, statValue: number | string, ratio: number | string, rawDamage: number | string): string {
  const minimum = Math.max(0, Math.round(Number(rawDamage) + BASIC_ATTACK_ROLL_MIN));
  const maximum = Math.max(0, Math.round(Number(rawDamage) + BASIC_ATTACK_ROLL_MAX));
  const rollText = `[${formatSignedNumber(BASIC_ATTACK_ROLL_MIN)}..${formatSignedNumber(BASIC_ATTACK_ROLL_MAX)}]`;
  if (getLocale() === "en") {
    return `${formatFormulaNumber(ratio)} x ${translateScaleStat(statKey)}(${statValue}) + random${rollText} = ${minimum}-${maximum}`;
  }
  return `${formatFormulaNumber(ratio)} x ${translateScaleStat(statKey)}(${statValue}) + ngẫu nhiên${rollText} = ${minimum}-${maximum}`;
}

function buildSkillFormulaExpression(statKey: string, baseValue: number | string, scaleValue: number | string, formulaOperations: ResolvedFormulaOperation[] | null | undefined, statValue: number | string, includeResolvedStat: boolean = false): string {
  const statToken = includeResolvedStat
    ? `${statValue}`
    : `${translateScaleStat(statKey)}`;
  let expression = `(${formatFormulaNumber(baseValue)} + ${formatFormulaNumber(scaleValue)} x ${statToken})`;
  (formulaOperations ?? []).forEach((entry, index) => {
    const left = index > 0 ? `(${expression})` : expression;
    const right = includeResolvedStat ? entry.valueText : entry.displayText;
    expression = `${left} ${entry.operator} ${right}`;
  });
  return expression;
}

function buildSkillDamageFormulaText(statKey: string, statValue: number | string, baseValue: number | string, scaleValue: number | string, starMult: number, rawDamage: number | string, damageFalloff: unknown = null, formulaOperations: unknown[] = []): string {
  const resolvedFormulaOperations = buildResolvedFormulaOperations(starMult, formulaOperations);
  const formulaExpr = buildSkillFormulaExpression(statKey, baseValue, scaleValue, resolvedFormulaOperations, statValue, false);
  const substitutedExpr = buildSkillFormulaExpression(statKey, baseValue, scaleValue, resolvedFormulaOperations, statValue, true);
  const resultLabel = getLocale() === "en"
    ? `${Math.round(Number(rawDamage))} (${translateScaleStat(statKey)})`
    : `${Math.round(Number(rawDamage))} (${translateScaleStat(statKey)})`;
  const resolvedExpr = `${formulaExpr} = ${substitutedExpr} = ${resultLabel}`;
  if (!Number.isFinite(Number(damageFalloff)) || Number(damageFalloff) <= 0 || Number(damageFalloff) >= 1) {
    return resolvedExpr;
  }
  if (getLocale() === "en") {
    return `First-hit formula = ${resolvedExpr}; later hits = previous hit x ${formatFormulaNumber(damageFalloff)}`;
  }
  return `Công thức hit đầu = ${resolvedExpr}; hit sau = hit trước x ${formatFormulaNumber(damageFalloff)}`;
}

function buildFalloffDamageSequence(firstHitDamage: unknown, maxHits: unknown, damageFalloff: unknown): { sequence: number[]; text: string; total: number } {
  const totalHits = Math.max(1, Math.round(Number(maxHits) || 1));
  const falloff = Number(damageFalloff);
  const sequence = [];
  let current = Number(firstHitDamage) || 0;
  for (let i = 0; i < totalHits; i += 1) {
    sequence.push(Math.max(1, Math.round(current)));
    current *= falloff;
  }
  return {
    sequence,
    text: sequence.join(" -> "),
    total: sequence.reduce((sum, value) => sum + value, 0)
  };
}

function buildRawDamageKeyword({ includesVariance = false, includesFalloff = false }: { includesVariance?: boolean; includesFalloff?: boolean } = {}): { title: string; body: string } {
  const isEnglish = getLocale() === "en";
  let body = isEnglish
    ? "Displayed damage is raw per-hit damage before DEF/MDEF, shields, elemental counters, and critical hits."
    : "Các số sát thương hiển thị là ST gốc theo từng hit trước DEF/MDEF, khiên, khắc hệ và bạo kích.";
  if (includesVariance) {
    body += isEnglish
      ? ` Basic attacks also roll a random value from ${formatSignedNumber(BASIC_ATTACK_ROLL_MIN)} to ${formatSignedNumber(BASIC_ATTACK_ROLL_MAX)}.`
      : ` Đánh thường còn cộng thêm một roll ngẫu nhiên từ ${formatSignedNumber(BASIC_ATTACK_ROLL_MIN)} đến ${formatSignedNumber(BASIC_ATTACK_ROLL_MAX)}.`;
  }
  if (includesFalloff) {
    body += isEnglish
      ? " Each bounce after the first deals 80% of the previous hit."
      : " Mỗi lần nảy sau hit đầu chỉ gây 80% hit ngay trước.";
  }
  return {
    title: isEnglish ? "Raw damage" : "ST gốc",
    body
  };
}

function upsertTooltipRow(rows: TooltipRow[], star: number, {
  key,
  labelVi,
  labelEn,
  format = "integer",
  displayMode = null
}: {
  key: string;
  labelVi: string;
  labelEn: string;
  format?: string;
  displayMode?: string | null;
}, value: unknown): void {
  if (value == null || value === "") return;
  let row = rows.find((entry) => entry.key === key);
  if (!row) {
    row = {
      key,
      label: getLocale() === "en" ? labelEn : labelVi,
      format,
      valuesByStar: {}
    };
    if (displayMode) row.displayMode = displayMode;
    rows.push(row);
  }
  if (!row.valuesByStar) row.valuesByStar = {};
  row.valuesByStar[star] = value;
}

function formatValuesByStar(valuesByStar?: Record<number | string, unknown> | null, format?: string | null, currentStar: number = 1, metric: string = ""): string {
  const values = [1, 2, 3].map((star) => formatMetricValue(valuesByStar?.[star], format, metric));
  const highlighted = values.map((value, index) => (
    index === currentStar - 1
      ? highlightTooltipActiveText(value)
      : value
  ));
  return `[${highlighted.join(" / ")}]`;
}

function interpolateSummary(template: unknown, tokensByStar: Record<number, Record<string, unknown>> | null | undefined, currentStar: number): string {
  if (!template) return "";
  const tokens = tokensByStar?.[currentStar] ?? {};
  return String(template).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, token) => {
    const value = tokens[token];
    if (value == null) return "-";
    return String(value);
  });
}

function normalizeSummaryTextKey(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function combineTooltipText(baseText: unknown, additionText: unknown): string {
  const base = String(baseText ?? "").replace(/\s+/g, " ").trim();
  const addition = String(additionText ?? "").replace(/\s+/g, " ").trim();
  if (!base) return addition;
  if (!addition) return base;
  if (base === addition) return base;
  if (base.includes(addition)) return base;
  if (addition.includes(base)) return addition;
  return `${base} ${addition}`.replace(/\s+/g, " ").trim();
}

function lowerFirstLabel(text: unknown): string {
  const value = String(text ?? "").trim();
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function computeWordSimilarity(left: unknown, right: unknown): number {
  const leftWords = new Set(normalizeSummaryTextKey(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalizeSummaryTextKey(right).split(" ").filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size || 1;
  return overlap / union;
}

function shouldPreferGeneratedDelta(previousText: unknown, currentText: unknown): boolean {
  const previous = sanitizeVietnamesePlayerText(previousText ?? "");
  const current = sanitizeVietnamesePlayerText(currentText ?? "");
  if (!current) return true;
  if (!previous) return false;
  if (containsVietnamesePlayerJargon(current)) return true;
  if (normalizeSummaryTextKey(previous) === normalizeSummaryTextKey(current)) return true;
  if (current.startsWith(previous) || current.includes(`${previous},`) || current.includes(`${previous}.`)) return true;
  return computeWordSimilarity(previous, current) >= 0.72;
}

function buildLegacyResourceRowsForSummary(skill: Skill | null | undefined, baseUnit: BaseUnit | null | undefined): TooltipRow[] {
  if (!baseUnit?.id) return [];
  return [{
    key: "rageCost",
    label: resolveLocaleText("tooltip.cost.rage", getLocale() === "en" ? "Required Rage" : "Nộ khí cần"),
    metric: "cast.cost",
    format: "integer",
    valuesByStar: {
      1: getUnitSkillForStar(baseUnit.id, 1)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0,
      2: getUnitSkillForStar(baseUnit.id, 2)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0,
      3: getUnitSkillForStar(baseUnit.id, 3)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0
    }
  }];
}

function buildSkillRowsForSummaryDiff(skill: Skill | null | undefined, baseUnit: BaseUnit | null | undefined): TooltipRow[] {
  if (skill?.tooltipModel) {
    return [
      ...(skill.tooltipModel.header?.resourceRows ?? []),
      ...(skill.tooltipModel.statRows ?? [])
    ].map((row) => ({
      ...row,
      label: resolveRowLabel(row)
    }));
  }
  return [
    ...buildLegacyResourceRowsForSummary(skill, baseUnit),
    ...buildLegacyMetricRows(skill, baseUnit)
  ];
}

function compareSummaryValues(previousValue: unknown, currentValue: unknown): string {
  const previousNum = Number(previousValue);
  const currentNum = Number(currentValue);
  if (Number.isFinite(previousNum) && Number.isFinite(currentNum)) {
    if (currentNum > previousNum) return "up";
    if (currentNum < previousNum) return "down";
    return "same";
  }
  if (String(previousValue ?? "") === String(currentValue ?? "")) return "same";
  return "changed";
}

function buildRowDeltaPhrase(row: TooltipRow | null | undefined, previousStar: number, currentStar: number): string {
  const previousValue = row?.valuesByStar?.[previousStar];
  const currentValue = row?.valuesByStar?.[currentStar];
  if (currentValue == null || currentValue === "") return "";
  if (compareSummaryValues(previousValue, currentValue) === "same") return "";

  const metricKey = String(row?.metric ?? row?.key ?? "").toLowerCase();
  const label = sanitizeVietnamesePlayerText(row?.label ?? "");
  const labelKey = normalizeSummaryTextKey(label);
  const currentFormatted = formatMetricValue(currentValue, row?.format, row?.metric);
  const direction = compareSummaryValues(previousValue, currentValue);

  if (["formula", "damageformula", "damagesequence", "damagetype", "attack.range"].some((part) => metricKey.includes(part))) {
    return "";
  }
  if (metricKey.includes("cast.cost") || metricKey.includes("ragecost")) {
    return direction === "down"
      ? `Giảm nộ cần còn ${currentFormatted}.`
      : `Đổi nộ cần thành ${currentFormatted}.`;
  }
  if (metricKey.includes("target_count") || labelKey.includes("so muc tieu") || labelKey.includes("phu muc tieu")) {
    return direction === "up"
      ? `Tăng số mục tiêu lên ${currentFormatted}.`
      : `Đổi số mục tiêu thành ${currentFormatted}.`;
  }
  if (metricKey.includes("turn") || labelKey.includes("thoi luong") || labelKey.includes("duy tri")) {
    return direction === "up"
      ? `Tăng thời lượng lên ${currentFormatted}.`
      : `Đổi thời lượng thành ${currentFormatted}.`;
  }
  if (direction === "down") {
    return `Giảm ${lowerFirstLabel(label)} còn ${currentFormatted}.`;
  }
  return `Tăng ${lowerFirstLabel(label)} lên ${currentFormatted}.`;
}

function buildSpecialSkillDeltaPhrases(previousSkill: Skill | null | undefined, currentSkill: Skill | null | undefined): string[] {
  const phrases: string[] = [];
  if (currentSkill?.applyAntiHeal && !previousSkill?.applyAntiHeal) {
    phrases.push("Hiệu ứng chảy máu chặn hồi máu khi con này còn trên sân.");
  }
  if ((Number(currentSkill?.maxStacks) || 0) > (Number(previousSkill?.maxStacks) || 0)) {
    phrases.push(`Tăng cộng dồn tối đa lên ${Math.round(Number(currentSkill?.maxStacks))}.`);
  }
  if ((Number(currentSkill?.maxTotalBasicHits) || 0) > (Number(previousSkill?.maxTotalBasicHits) || 0)) {
    phrases.push(`Tăng số đòn đánh thường tối đa lên ${Math.round(Number(currentSkill?.maxTotalBasicHits))}.`);
  }
  if ((Number(currentSkill?.extraAttackChance) || 0) > (Number(previousSkill?.extraAttackChance) || 0)) {
    phrases.push(`Tăng tỉ lệ đánh thêm lên ${Math.round(Number(currentSkill?.extraAttackChance) * 100)}%.`);
  }
  if ((Number(currentSkill?.selfHpCostPct) || 0) > (Number(previousSkill?.selfHpCostPct) || 0)) {
    phrases.push(`Tăng máu tiêu hao lên ${Math.round(Number(currentSkill?.selfHpCostPct) * 100)}%.`);
  }
  return phrases;
}

function resolveSkillSummaryField(skill: Skill | null | undefined, fieldBase: string, locale: string = getLocale()): string {
  return pickFirstString(
    resolvePlayerFacingField(skill?.tooltipModel, fieldBase, locale),
    resolvePlayerFacingField(skill, fieldBase, locale)
  );
}

function getUnitSkillPitch(baseUnit: BaseUnit | null | undefined, skill: Skill | null | undefined, locale: string = getLocale()): string {
  if (locale === "en") {
    return pickFirstString(
      baseUnit?.descriptionEn,
      resolvePlayerFacingField(skill, "description", locale),
      skill?.descriptionEn
    );
  }
  return pickFirstString(
    baseUnit?.descriptionVi,
    baseUnit?.description,
    resolvePlayerFacingField(skill, "description", locale),
    skill?.descriptionVi,
    skill?.description
  );
}

function buildGeneratedSkillStarDelta(baseUnit: BaseUnit | null | undefined, previousStar: number, currentStar: number): string {
  if (!baseUnit?.id) return "";
  const previousSkill = getUnitSkillForStar(baseUnit.id, previousStar);
  const currentSkill = getUnitSkillForStar(baseUnit.id, currentStar);
  if (!previousSkill || !currentSkill) return "";

  const phrases: string[] = [];
  buildSpecialSkillDeltaPhrases(previousSkill, currentSkill).forEach((phrase) => {
    if (!phrases.includes(phrase)) phrases.push(phrase);
  });

  buildSkillRowsForSummaryDiff(currentSkill, baseUnit).forEach((row) => {
    if (phrases.length >= 3) return;
    const phrase = buildRowDeltaPhrase(row, previousStar, currentStar);
    if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
  });

  const previousTarget = resolveSkillSummaryField(previousSkill, "targetText");
  const currentTarget = resolveSkillSummaryField(currentSkill, "targetText");
  const previousAffectedCount = resolveSkillSummaryField(previousSkill, "affectedCountText");
  const currentAffectedCount = resolveSkillSummaryField(currentSkill, "affectedCountText");
  let handledCountChange = false;
  if (phrases.length < 3 && currentAffectedCount && currentAffectedCount !== previousAffectedCount) {
    const countMatch = String(currentAffectedCount).match(/^\d+$/);
    if (countMatch) {
      phrases.push(`Tăng số mục tiêu lên ${countMatch[0]}.`);
    } else {
      phrases.push(`Phủ mục tiêu đổi thành ${sanitizeVietnamesePlayerText(currentAffectedCount)}.`);
    }
    handledCountChange = true;
  }
  if (phrases.length < 3 && currentTarget && currentTarget !== previousTarget) {
    const targetStartsWithCount = /^\d+\s/.test(String(currentTarget).trim());
    if (!handledCountChange || !targetStartsWithCount) {
      phrases.push(`Đổi ưu tiên mục tiêu thành ${sanitizeVietnamesePlayerText(currentTarget)}.`);
    }
  }

  const previousSelection = resolveSkillSummaryField(previousSkill, "selectionRuleText");
  const currentSelection = resolveSkillSummaryField(currentSkill, "selectionRuleText");
  if (phrases.length < 3 && currentSelection && currentSelection !== previousSelection) {
    phrases.push(`Luật chọn đổi thành ${sanitizeVietnamesePlayerText(currentSelection)}.`);
  }

  const previousDuration = resolveSkillSummaryField(previousSkill, "durationRuleText");
  const currentDuration = resolveSkillSummaryField(currentSkill, "durationRuleText");
  if (phrases.length < 3 && currentDuration && currentDuration !== previousDuration) {
    phrases.push(`Hiệu lực đổi thành ${sanitizeVietnamesePlayerText(currentDuration)}.`);
  }

  return phrases
    .map((phrase) => sanitizeVietnamesePlayerText(phrase))
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function getStarMilestones(baseUnit: BaseUnit | null | undefined, upgradeByStar: Record<number, string> | null = null, summaryByStar: Record<number, string> | null = null): MilestoneEntry[] {
  const locale = getLocale();
  const resolvedUpgradeByStar = upgradeByStar ?? buildUnitStarSummaryByStar(baseUnit, {});
  const resolvedSummaryByStar = summaryByStar ?? {};
  return [1, 2, 3]
    .map((star) => ({
      star,
      text: pickFirstString(
        resolvedUpgradeByStar?.[star],
        resolvedSummaryByStar?.[star],
        resolvePlayerFacingField(baseUnit, `star${star}Desc`, locale),
        locale === "en" ? "" : baseUnit?.[`star${star}Desc`]
      )
    }))
    .filter((entry) => entry.text);
}

function buildSkillDetailMilestones(baseUnit: BaseUnit | null | undefined, detailByStar: Record<number, string> = {}, vm: TooltipVm | null = null): MilestoneEntry[] {
  const locale = getLocale();
  if (!baseUnit?.id) return [];
  return [1, 2, 3]
    .map((star) => {
      const milestoneBaseText = pickFirstString(
        detailByStar?.[star],
        resolveLocalizedSkillText(getUnitSkillForStar(baseUnit.id, star), "detailText", locale),
        resolveLocalizedSkillText(getUnitSkillForStar(baseUnit.id, star), "description", locale)
      );
      if (!vm) {
        return {
          star,
          text: milestoneBaseText
        };
      }
      const milestoneVm = {
        ...vm,
        detailText: pickFirstString(milestoneBaseText, vm?.detailText),
        detailByStar: {
          ...(vm?.detailByStar ?? {}),
          [star]: pickFirstString(milestoneBaseText, vm?.detailByStar?.[star], vm?.detailText)
        }
      };
      return {
        star,
        text: pickFirstString(
          buildSkillDetailWithEmbeddedDamageRows(milestoneVm, star, {
            enrichStructuralText: false
          }),
          milestoneBaseText
        )
      };
    })
    .filter((entry) => entry.text);
}

function formatSkillStarMilestoneLines(milestones: MilestoneEntry[] = [], currentStar: number = 1): string[] {
  if (!Array.isArray(milestones) || !milestones.length) return [];
  const locale = getLocale();
  const lines = [locale === "en" ? "Star milestones:" : "Mốc sao:"];
  milestones.forEach((entry) => {
    const star = clampStar(entry?.star ?? 1);
    const starIcons = "⭐".repeat(star);
    const label = locale === "en"
      ? `${starIcons} ${star}-star:`
      : `${starIcons} ${star} sao:`;
    lines.push(star === currentStar ? highlightTooltipActiveText(label) : label);
    lines.push(`📜 ${entry.text}`);
  });
  return lines;
}

function shouldHideGenericShape(shapeText: unknown, targetText: unknown): boolean {
  const normalized = String(shapeText ?? "").trim().toLowerCase();
  return (normalized === GENERIC_SHAPE || normalized === GENERIC_SHAPE_EN) && !!targetText;
}

function removeStarSection(text: unknown): string {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/);
  const kept = [];
  let inStarSection = false;
  for (const line of lines) {
    if (/^\s*(mốc sao:|[⭐★]+\s*\d*\s*sao[:：]?)/i.test(line.trim())) {
      inStarSection = true;
      continue;
    }
    if (inStarSection && /^\s*(?:[-•►]|\d+\.)/.test(line.trim())) {
      continue;
    }
    if (inStarSection && !line.trim()) {
      continue;
    }
    inStarSection = false;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function getStarStatMultiplier(star: number): number {
  if (star >= 3) return 2.5;
  if (star === 2) return 1.6;
  return 1;
}

export function getStarSkillMultiplier(star: number): number {
  if (star >= 3) return 1.4;
  if (star === 2) return 1.2;
  return 1;
}

export function inferBasicActionPattern(classType?: string | null, range?: number | null): string {
  if ((range ?? 0) >= 2) return "RANGED_STATIC";
  if (classType === "ASSASSIN") return "ASSASSIN_BACK";
  return "MELEE_FRONT";
}

export function translateActionPattern(pattern?: string | null): string {
  const map: Record<string, string> = {
    MELEE_FRONT: getLocale() === "en" ? "Frontline melee" : "Cận chiến tiền tuyến",
    ASSASSIN_BACK: getLocale() === "en" ? "Backline dive" : "Ám sát hậu tuyến",
    RANGED_STATIC: getLocale() === "en" ? "Static ranged" : "Viễn chiến cố định",
    SELF: getLocale() === "en" ? "Self" : "Tự thân"
  };
  return (pattern ? map[pattern] : undefined) ?? pattern ?? "-";
}

export function translateDamageType(type?: string | null): string {
  if (type === "physical") return getLocale() === "en" ? "Physical" : "Vật lý";
  if (type === "magic") return getLocale() === "en" ? "Magic" : "Phép";
  if (type === "true") return getLocale() === "en" ? "True" : "Chuẩn";
  return type ?? "-";
}

export function translateScaleStat(stat?: string | null): string {
  if (stat === "matk") return "MATK";
  if (stat === "atk") return "ATK";
  if (stat === "def") return "DEF";
  if (stat === "mdef") return "MDEF";
  if (stat === "hp") return "HP";
  return String(stat ?? "chỉ số");
}

function buildAttackMetricsByStar(attackDef: AttackDef | null | undefined, baseUnit: BaseUnit | null | undefined): Record<number, Record<string, number>> {
  const metricsByStar: Record<number, Record<string, number>> = {};
  for (const star of [1, 2, 3]) {
    const stats = getScaledBaseStats(baseUnit?.stats, star, baseUnit?.classType);
    const scaleStat = attackDef?.scale?.stat ?? (attackDef?.damageType === "magic" ? "matk" : "atk");
    const scaleRatio = Number(attackDef?.scale?.ratio ?? 1) || 1;
    const statValue = Number((stats as unknown as Record<string, unknown>)?.[scaleStat] ?? 0) || 0;
    metricsByStar[star] = {
      "attack.total_damage": Math.max(0, Math.round(statValue * scaleRatio)),
      "attack.range": Number(baseUnit?.stats?.range ?? 1) || 1
    };
  }
  return metricsByStar;
}

function resolveAttackCastTypeText(delivery: unknown, locale: string = getLocale()): string {
  if (delivery === "projectile") return locale === "en" ? "Ranged projectile" : "Phóng đòn đánh tầm xa";
  if (delivery === "instant") return locale === "en" ? "Instant cast" : "Thi triển tức thì";
  return locale === "en" ? "Direct melee strike" : "Cận chiến trực diện";
}

function buildAttackTooltipModel(baseUnit: BaseUnit | null | undefined): TooltipModel | null {
  const attackDef = baseUnit?.attackDef;
  if (!attackDef) return null;
  if (attackDef.tooltipModel) return attackDef.tooltipModel;
  const tooltipDef = attackDef.tooltipDef ?? {};
  const metricsByStar = attackDef.metricsByStar ?? buildAttackMetricsByStar(attackDef, baseUnit);
  const mapRows = (rows: TooltipRow[] = []): TooltipRow[] => rows.map((row) => ({
    ...row,
    valuesByStar: {
      1: metricsByStar[1]?.[row.metric ?? ""],
      2: metricsByStar[2]?.[row.metric ?? ""],
      3: metricsByStar[3]?.[row.metric ?? ""]
    }
  }));
  return {
    header: {
      ...(tooltipDef.header ?? {}),
      resourceRows: mapRows(tooltipDef.header?.resourceRows ?? [])
    },
    summary: {
      key: tooltipDef.summaryKey ?? null,
      textVi: pickFirstString(tooltipDef.summaryTextVi, tooltipDef.summary),
      textEn: pickFirstString(tooltipDef.summaryTextEn),
      tokensByStar: Object.fromEntries([1, 2, 3].map((star) => [star, Object.fromEntries(
        Object.entries((tooltipDef.tokenMap ?? {}) as Record<string, { metric: string }>).map(([token, def]) => [token, metricsByStar[star]?.[def.metric]])
      )]))
    },
    castTypeTextVi: pickFirstString(tooltipDef.castTypeTextVi, resolveAttackCastTypeText(attackDef.delivery, "vi")),
    castTypeTextEn: pickFirstString(tooltipDef.castTypeTextEn, resolveAttackCastTypeText(attackDef.delivery, "en")),
    targetTextVi: pickFirstString(tooltipDef.targetTextVi, attackDef?.target?.tooltipTextVi),
    targetTextEn: pickFirstString(tooltipDef.targetTextEn, attackDef?.target?.tooltipTextEn),
    shapeTextVi: pickFirstString(tooltipDef.shapeTextVi),
    shapeTextEn: pickFirstString(tooltipDef.shapeTextEn),
    selectionRuleTextVi: pickFirstString(tooltipDef.selectionRuleTextVi),
    selectionRuleTextEn: pickFirstString(tooltipDef.selectionRuleTextEn),
    affectedCountTextVi: pickFirstString(tooltipDef.affectedCountTextVi),
    affectedCountTextEn: pickFirstString(tooltipDef.affectedCountTextEn),
    durationRuleTextVi: pickFirstString(tooltipDef.durationRuleTextVi),
    durationRuleTextEn: pickFirstString(tooltipDef.durationRuleTextEn),
    areaDescriptionVi: pickFirstString(tooltipDef.areaDescriptionVi),
    areaDescriptionEn: pickFirstString(tooltipDef.areaDescriptionEn),
    details: Array.isArray(tooltipDef.detailKeys) ? [...tooltipDef.detailKeys] : [],
    statRows: mapRows(tooltipDef.statRows ?? []),
    keywords: Array.isArray(tooltipDef.keywords) ? [...tooltipDef.keywords] : [],
    errors: { ...(tooltipDef.errors ?? {}) },
    previewCells: tooltipDef.previewCells ?? attackDef?.target?.shape?.previewCells ?? [],
    metricsByStar
  };
}

function buildTooltipSummaryByStar(tooltipModel: TooltipModel | null | undefined, locale: string, fallbackText: string = ""): Record<number, string> {
  const template = resolvePlayerFacingField(tooltipModel?.summary, "text", locale);
  const interpolated = {
    1: interpolateSummary(template, tooltipModel?.summary?.tokensByStar, 1),
    2: interpolateSummary(template, tooltipModel?.summary?.tokensByStar, 2),
    3: interpolateSummary(template, tooltipModel?.summary?.tokensByStar, 3)
  };
  return {
    1: pickFirstString(interpolated[1], fallbackText),
    2: pickFirstString(interpolated[2], fallbackText),
    3: pickFirstString(interpolated[3], fallbackText)
  };
}

function resolveLocalizedSkillText(skill: Skill | null | undefined, baseField: string, locale: string = getLocale(), fallback: string = ""): string {
  return pickFirstString(
    resolvePlayerFacingField(skill, baseField, locale),
    locale === "en"
      ? pickFirstString(skill?.[`${baseField}En`], skill?.[baseField])
      : pickFirstString(skill?.[`${baseField}Vi`], skill?.[baseField]),
    fallback
  );
}

function buildResolvedSkillTextByStar(baseUnit: BaseUnit | null | undefined, baseField: string, fallbackByStar: Record<number, string> = {}): Record<number, string> {
  const locale = getLocale();
  const values: Record<number, string> = { 1: "", 2: "", 3: "" };
  if (!baseUnit?.id) {
    return {
      1: pickFirstString(fallbackByStar?.[1]),
      2: pickFirstString(fallbackByStar?.[2], fallbackByStar?.[1]),
      3: pickFirstString(fallbackByStar?.[3], fallbackByStar?.[2], fallbackByStar?.[1])
    };
  }
  for (const star of [1, 2, 3]) {
    const resolvedSkill = getUnitSkillForStar(baseUnit.id, star);
    values[star] = pickFirstString(
      resolveLocalizedSkillText(resolvedSkill, baseField, locale),
      fallbackByStar?.[star],
      fallbackByStar?.[1]
    );
  }
  return values;
}

function buildExpandedDetailByStar(baseUnit: BaseUnit | null | undefined, authoredDetailByStar: Record<number, string> = {}, fallbackByStar: Record<number, string> = {}): Record<number, string> {
  const explicitOrEmpty = (value: unknown) => pickFirstString(value);
  const star1 = pickFirstString(authoredDetailByStar?.[1], fallbackByStar?.[1]);
  const star2Explicit = explicitOrEmpty(authoredDetailByStar?.[2]);
  const star3Explicit = explicitOrEmpty(authoredDetailByStar?.[3]);
  const star2 = pickFirstString(star2Explicit, fallbackByStar?.[2], star1);
  const star3 = pickFirstString(star3Explicit, fallbackByStar?.[3], star2, star1);
  return {
    1: pickFirstString(star1),
    2: pickFirstString(star2),
    3: pickFirstString(star3)
  };
}

function buildUnitStarSummaryByStar(baseUnit: BaseUnit | null | undefined, fallbackByStar: Record<number, string> = {}): Record<number, string> {
  if (!baseUnit || getLocale() === "en") return fallbackByStar;
  const authored = {
    1: sanitizeVietnamesePlayerText(baseUnit.star1Desc ?? ""),
    2: sanitizeVietnamesePlayerText(baseUnit.star2Desc ?? ""),
    3: sanitizeVietnamesePlayerText(baseUnit.star3Desc ?? "")
  };
  const generated2 = buildGeneratedSkillStarDelta(baseUnit, 1, 2);
  const generated3 = buildGeneratedSkillStarDelta(baseUnit, 2, 3);
  return {
    1: pickFirstString(authored[1], sanitizeVietnamesePlayerText(fallbackByStar?.[1] ?? "")),
    2: pickFirstString(
      shouldPreferGeneratedDelta(authored[1], authored[2]) ? generated2 : authored[2],
      authored[2],
      sanitizeVietnamesePlayerText(fallbackByStar?.[2] ?? "")
    ),
    3: pickFirstString(
      shouldPreferGeneratedDelta(authored[2], authored[3]) ? generated3 : authored[3],
      authored[3],
      sanitizeVietnamesePlayerText(fallbackByStar?.[3] ?? "")
    )
  };
}

function enrichSummaryByStar(summaryByStar: Record<number, string> = {}, upgradeByStar: Record<number, string> = {}): Record<number, string> {
  const rawValues: Record<number, string> = {
    1: pickFirstString(summaryByStar?.[1]),
    2: pickFirstString(summaryByStar?.[2], summaryByStar?.[1]),
    3: pickFirstString(summaryByStar?.[3], summaryByStar?.[2], summaryByStar?.[1])
  };
  const values: Record<number, string> = { ...rawValues };
  for (const star of [2, 3]) {
    const current = pickFirstString(rawValues[star]);
    const previous = pickFirstString(rawValues[star - 1], rawValues[1]);
    const baseSummary = pickFirstString(rawValues[1]);
    const upgrade = pickFirstString(upgradeByStar?.[star]);
    if (!upgrade) continue;
    const normalizedCurrent = String(current ?? "").trim();
    const normalizedPrevious = String(previous ?? "").trim();
    const normalizedBase = String(baseSummary ?? "").trim();
    const normalizedUpgrade = String(upgrade ?? "").trim();
    const shouldAppend = !normalizedCurrent || normalizedCurrent === normalizedPrevious || normalizedCurrent === normalizedBase;
    if (!shouldAppend) continue;
    if (normalizedCurrent.includes(normalizedUpgrade)) continue;
    values[star] = pickFirstString(
      normalizedCurrent ? `${normalizedCurrent} ${normalizedUpgrade}` : normalizedUpgrade,
      normalizedCurrent,
      normalizedUpgrade
    );
  }
  return values;
}

function normalizeUnitPassiveLineEntry(entry: unknown, locale: string = getLocale()): string[] {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return entry.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean);
  }
  if (typeof entry === "string") {
    return entry.trim() ? [entry.trim()] : [];
  }
  if (typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const localeEntry = record[locale];
    const fallbackEntry = locale === "en"
      ? pickFirstString(record.en, record.textEn)
      : pickFirstString(record.vi, record.textVi, record.text);
    if (Array.isArray(localeEntry)) {
      return localeEntry.map((line) => (typeof line === "string" ? line.trim() : "")).filter(Boolean);
    }
    if (typeof localeEntry === "string" && localeEntry.trim()) {
      return [localeEntry.trim()];
    }
    if (typeof fallbackEntry === "string" && fallbackEntry.trim()) {
      return [fallbackEntry.trim()];
    }
  }
  return [];
}

function buildPassiveLines(baseUnit: BaseUnit | null | undefined, currentStar: number, locale: string = getLocale()): string[] {
  const lines = [...getRolePassiveLines(baseUnit?.classType ?? "", locale)];
  const passiveLinesByStar = baseUnit?.passiveLinesByStar;
  if (!passiveLinesByStar || typeof passiveLinesByStar !== "object") return lines;
  for (let star = 1; star <= clampStar(currentStar); star += 1) {
    const entry = passiveLinesByStar?.[star] ?? passiveLinesByStar?.[String(star)];
    lines.push(...normalizeUnitPassiveLineEntry(entry, locale));
  }
  return lines.filter(Boolean);
}

function mapTooltipRows(rows: TooltipRow[] = []): TooltipRow[] {
  return rows.map((row) => ({
    ...row,
    label: resolveRowLabel(row)
  }));
}

function mapTooltipKeywords(keywords: TooltipKeyword[] = []): Array<{ title: string; body: string }> {
  const locale = getLocale();
  return Array.isArray(keywords)
    ? keywords.map((keyword) => ({
        title: pickFirstString(resolvePlayerFacingField(keyword, "title", locale), resolveLocaleText(keyword.titleKey)),
        body: pickFirstString(resolvePlayerFacingField(keyword, "body", locale), resolveLocaleText(keyword.bodyKey))
      })).filter((entry) => entry.title || entry.body)
    : [];
}

function formatTooltipRow(row: TooltipRow | null | undefined, currentStar: number): string {
  if (row?.displayMode === "current_only") {
    return formatMetricValue(row?.valuesByStar?.[currentStar], row?.format, row?.metric);
  }
  return formatValuesByStar(row?.valuesByStar, row?.format, currentStar, row?.metric);
}

function formatTooltipRowCurrentValue(row: TooltipRow | null | undefined, currentStar: number): string {
  return formatMetricValue(row?.valuesByStar?.[currentStar], row?.format, row?.metric);
}

function isRawDamageKeyword(keyword: TooltipKeyword | null | undefined): boolean {
  const title = String(keyword?.title ?? "").trim().toLowerCase();
  return title === "st gốc" || title === "raw damage";
}

function capitalizeSentence(text: unknown): string {
  const value = String(text ?? "").trim();
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function stripTrailingPeriod(text: unknown): string {
  return String(text ?? "").trim().replace(/[.。]+$/u, "");
}

function hasMeaningfulRenderedValue(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  return text !== "-" && text !== "—" && text !== "–";
}

function detailAlreadyMentionsFormula(detailText: unknown): boolean {
  const text = String(detailText ?? "").trim();
  if (!text) return false;
  return /\b(?:ATK|MATK|DEF|MDEF)\b|[%x]/iu.test(text);
}

function inlineFormulaTextIsRich(inlineFormulaText: unknown): boolean {
  const text = String(inlineFormulaText ?? "").trim();
  if (!text) return false;
  return /(?:=|\b(?:ATK|MATK|DEF|MDEF|HP)\b|\bHệ số(?:\s+sao)?\s*\([^)]*\)|\b(?:Star\s+)?Coefficient\s*\([^)]*\))/iu.test(text);
}

function detailMentionsTooltipText(detailText: unknown, tooltipText: unknown): boolean {
  const detailKey = normalizeSummaryTextKey(detailText);
  const tooltipKey = normalizeSummaryTextKey(tooltipText);
  if (!detailKey || !tooltipKey) return false;
  return detailKey.includes(tooltipKey);
}

function buildMissingSkillDetailSentences(detailText: string, vm: TooltipVm | null | undefined): string {
  const locale = getLocale();
  const clauses = [];
  const shapeText = vm?.shapeText && !shouldHideGenericShape(vm.shapeText, vm.targetText) ? vm.shapeText : "";
  const targetText = pickFirstString(vm?.targetText);
  const selectionText = pickFirstString(vm?.selectionRuleText);
  const affectedCountText = pickFirstString(vm?.affectedCountText);
  const castTypeText = pickFirstString(vm?.castTypeText);
  const durationRuleText = pickFirstString(vm?.durationRuleText);
  const areaDescription = pickFirstString(vm?.areaDescription);

  if (castTypeText && !detailMentionsTooltipText(detailText, castTypeText)) {
    clauses.push(locale === "en" ? `uses ${castTypeText}` : `tung theo kiểu ${castTypeText}`);
  }
  if (targetText && !detailMentionsTooltipText(detailText, targetText)) {
    let targetClause = locale === "en" ? `aims at ${targetText}` : `nhắm ${targetText}`;
    if (shapeText && !detailMentionsTooltipText(detailText, shapeText)) {
      targetClause += locale === "en"
        ? ` in ${shapeText} form`
        : ` theo dạng ${shapeText}`;
    }
    clauses.push(targetClause);
  } else if (shapeText && !detailMentionsTooltipText(detailText, shapeText)) {
    clauses.push(locale === "en" ? `uses ${shapeText} form` : `theo dạng ${shapeText}`);
  }
  if (
    affectedCountText
    && !detailMentionsTooltipText(detailText, affectedCountText)
    && !isCoverageRedundant(targetText, affectedCountText)
  ) {
    clauses.push(locale === "en" ? `covering ${affectedCountText}` : `phủ ${affectedCountText}`);
  }
  if (
    selectionText
    && !detailMentionsTooltipText(detailText, selectionText)
    && !isSelectionRuleRedundant(targetText, selectionText)
  ) {
    clauses.push(buildSelectionRuleClause(selectionText, locale));
  }

  const sentences = [];
  if (clauses.length) {
    sentences.push(`${capitalizeSentence(joinNaturalClauses(clauses, locale))}.`);
  }
  if (durationRuleText && !detailMentionsTooltipText(detailText, durationRuleText)) {
    sentences.push(locale === "en"
      ? `Duration ${lowerFirstLabel(stripTrailingPeriod(durationRuleText))}.`
      : `Duy trì ${lowerFirstLabel(stripTrailingPeriod(durationRuleText))}.`);
  }
  if (areaDescription && !detailMentionsTooltipText(detailText, areaDescription)) {
    sentences.push(locale === "en"
      ? `Area ${lowerFirstLabel(stripTrailingPeriod(areaDescription))}.`
      : `Phạm vi ${lowerFirstLabel(stripTrailingPeriod(areaDescription))}.`);
  }
  return sentences.join(" ").trim();
}

function enrichSkillDetailText(detailText: unknown, vm: TooltipVm | null | undefined): string {
  const baseText = String(detailText ?? "").trim();
  if (!baseText) return baseText;
  const appendix = buildMissingSkillDetailSentences(baseText, vm);
  return appendix ? `${baseText} ${appendix}`.trim() : baseText;
}

function joinNaturalClauses(clauses: string[] = [], locale: string = getLocale()): string {
  const list = clauses.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return locale === "en" ? `${list[0]} and ${list[1]}` : `${list[0]} và ${list[1]}`;
  const head = list.slice(0, -1).join(", ");
  const tail = list[list.length - 1];
  return locale === "en" ? `${head}, and ${tail}` : `${head}, và ${tail}`;
}

function isDamagePresentationRow(row: TooltipRow | null | undefined): boolean {
  return [
    "damageType",
    "damage",
    "firstHitDamage",
    "maxTotalDamage",
    "damageSequence",
    "damageFormula",
    "formula"
  ].includes(String(row?.key ?? "").trim());
}

function getDamageTypeTextFromRows(rows: TooltipRow[] = [], currentStar: number = 1): string {
  const row = rows.find((entry) => entry?.key === "damageType");
  return row ? formatTooltipRowCurrentValue(row, currentStar) : "";
}

function isSelectionRuleRedundant(targetText: unknown, selectionRuleText: unknown): boolean {
  const target = normalizeSummaryTextKey(targetText);
  const selection = normalizeSummaryTextKey(selectionRuleText);
  if (!target || !selection) return false;
  return target.includes(selection) || selection.includes(target);
}

function isCoverageRedundant(targetText: unknown, affectedCountText: unknown): boolean {
  const target = String(targetText ?? "").trim().toLowerCase();
  const coverage = String(affectedCountText ?? "").trim().toLowerCase();
  if (!target || !coverage) return false;
  if (coverage === "1 mục tiêu" && /^1\s/.test(target)) return true;
  if (coverage === "1 target" && /^1\s/.test(target)) return true;
  return target.includes(coverage);
}

function buildSelectionRuleClause(selectionRuleText: unknown, locale: string = getLocale()): string {
  const text = lowerFirstLabel(stripTrailingPeriod(selectionRuleText));
  if (!text) return "";
  if (locale === "en") return `with selection rule ${text}`;
  if (/^chọn\s+/i.test(text) || /^ưu tiên\s+/i.test(text) || /^chỉ\s+/i.test(text)) {
    return `theo luật ${text}`;
  }
  return `theo luật chọn ${text}`;
}

function buildTooltipMetaSentence(vm: TooltipVm | null | undefined, currentStar: number, kind: "attack" | "skill" = "skill"): string {
  const locale = getLocale();
  const damageTypeText = getDamageTypeTextFromRows(vm?.statRows ?? [], currentStar);
  const intro = locale === "en"
    ? (kind === "attack" ? "Basic attack" : "This skill")
    : (kind === "attack" ? "Đòn đánh thường" : "Kỹ năng này");
  const clauses = [];
  let targetingClause = "";
  const shapeText = vm?.shapeText && !shouldHideGenericShape(vm.shapeText, vm.targetText) ? vm.shapeText : "";
  if (vm?.targetText) {
    targetingClause = locale === "en"
      ? `aims at ${vm.targetText}`
      : `nhắm ${vm.targetText}`;
    if (shapeText) {
      targetingClause += locale === "en"
        ? ` in ${shapeText} form`
        : ` theo dạng ${shapeText}`;
    }
  } else if (shapeText) {
    targetingClause = locale === "en"
      ? `uses ${shapeText} form`
      : `theo dạng ${shapeText}`;
  }
  if (vm?.castTypeText) {
    clauses.push(locale === "en" ? `uses ${vm.castTypeText}` : `tung theo kiểu ${vm.castTypeText}`);
  }
  if (targetingClause) clauses.push(targetingClause);
  if (vm?.affectedCountText) {
    clauses.push(locale === "en" ? `covering ${vm.affectedCountText}` : `phủ ${vm.affectedCountText}`);
  }
  if (damageTypeText && kind === "attack") {
    clauses.push(locale === "en" ? `deals ${damageTypeText} damage` : `gây sát thương ${damageTypeText}`);
  }
  const selectionText = pickFirstString(vm?.selectionRuleText);
  if (selectionText) {
    clauses.push(buildSelectionRuleClause(selectionText, locale));
  }
  if (!clauses.length) return "";
  return `🧾 ${intro} ${joinNaturalClauses(clauses, locale)}.`;
}

function buildInlineSkillFormulaText({
  formulaText = "",
  damageFormulaText = "",
  sequenceValue = "",
  totalValue = "",
  damageValue = "",
  firstTargetLead = false
}: {
  formulaText?: string;
  damageFormulaText?: string;
  sequenceValue?: string;
  totalValue?: string;
  damageValue?: string;
  firstTargetLead?: boolean;
} = {}): string {
  const locale = getLocale();
  if (hasMeaningfulRenderedValue(damageFormulaText)) {
    const normalizedDamageFormula = String(damageFormulaText)
      .replace(/^(?:Công thức hit đầu|First-hit formula)\s*=\s*/iu, "")
      .trim();
    const head = locale === "en"
      ? `First-hit formula = ${normalizedDamageFormula}`
      : firstTargetLead
        ? `Mục tiêu đầu dính chịu ${normalizedDamageFormula}`
        : `Công thức hit đầu = ${normalizedDamageFormula}`;
    const tail = [
      hasMeaningfulRenderedValue(sequenceValue)
        ? (locale === "en" ? `bounce sequence = ${sequenceValue}` : `chuỗi nảy = ${sequenceValue}`)
        : "",
      hasMeaningfulRenderedValue(totalValue)
        ? (locale === "en" ? `max total = ${totalValue}` : `tổng tối đa = ${totalValue}`)
        : ""
    ].filter(Boolean);
    return [head, ...tail].join("; ");
  }
  if (hasMeaningfulRenderedValue(formulaText)) {
    return `${formulaText}`;
  }
  if (hasMeaningfulRenderedValue(damageValue)) {
    return locale === "en"
      ? `${damageValue}`
      : `${damageValue}`;
  }
  return "";
}

function injectInlineFormulaAfterDeal(detailText: unknown, inlineFormulaText: unknown): { text: string; injected: boolean } {
  const text = String(detailText ?? "").trim();
  const inlineText = String(inlineFormulaText ?? "").trim();
  if (!text || !inlineText) return { text, injected: false };
  const locale = getLocale();
  const replacement = locale === "en" ? `deals ${inlineText}` : `gây ${inlineText}`;
  const pattern = locale === "en"
    ? /deal(?:s|ing)?\s+.+?\s+damage(?:\s+(?:physical|magic|true))?(?:\s*\([^)]*x\s*(?:ATK|MATK|DEF|MDEF|HP)[^)]*\))?/iu
    : /gây\s+.+?\s+sát\s+thương(?:\s+(?:vật lý|phép|chuẩn))?(?:\s*\([^)]*x\s*(?:ATK|MATK|DEF|MDEF|HP)[^)]*\))?/iu;
  if (pattern.test(text)) {
    let replaced = text.replace(pattern, replacement);
    if (locale === "en" && /later hits =/iu.test(inlineText)) {
      replaced = replaced.replace(/\s+and\s+later\s+hits?\s+[^.?!]+/iu, "");
    }
    if (locale !== "en" && /hit sau =/iu.test(inlineText)) {
      replaced = replaced.replace(/\s+và\s+hit\s+sau\s+còn\s+[^.?!]+/iu, "");
    }
    return {
      text: replaced,
      injected: true
    };
  }
  const fallbackPattern = locale === "en" ? /deal(?:s|ing)?\s+/iu : /gây\s+/iu;
  if (fallbackPattern.test(text)) {
    return {
      text: text.replace(fallbackPattern, (match) => `${match}${inlineText} `),
      injected: true
    };
  }
  return { text, injected: false };
}

function usesChainFirstTargetWording(vm: TooltipVm | null | undefined): boolean {
  const shapeText = String(vm?.shapeText ?? "").toLowerCase();
  const title = String(vm?.title ?? "").toLowerCase();
  const summary = String(vm?.summaryText ?? "").toLowerCase();
  const hasChainShape = shapeText.includes("chuỗi") || title.includes("điện") || summary.includes("chuỗi điện");
  const hasBounceRows = Array.isArray(vm?.statRows) && vm.statRows.some((row) => (
    row?.key === "damageSequence" || row?.key === "firstHitDamage"
  ));
  return getLocale() !== "en" && hasChainShape && hasBounceRows;
}

function buildSkillDetailWithEmbeddedDamageRows(vm: TooltipVm | null | undefined, currentStar: number, options: { enrichStructuralText?: boolean } = {}): string {
  const enrichStructuralText = options?.enrichStructuralText !== false;
  const baseDetailText = pickFirstString(vm?.detailByStar?.[currentStar], vm?.detailText, vm?.summaryByStar?.[currentStar], vm?.summaryText);
  const detailText = enrichStructuralText
    ? enrichSkillDetailText(baseDetailText, vm)
    : String(baseDetailText ?? "").trim();
  const rows = vm?.statRows ?? [];
  const formulaText = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "formula"), currentStar);
  const damageFormulaText = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "damageFormula"), currentStar);
  const damageValue = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "damage"), currentStar);
  const firstHitValue = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "firstHitDamage"), currentStar);
  const sequenceValue = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "damageSequence"), currentStar);
  const totalValue = formatTooltipRowCurrentValue(rows.find((row) => row?.key === "maxTotalDamage"), currentStar);
  const firstTargetLead = usesChainFirstTargetWording(vm);
  const inlineFormulaText = buildInlineSkillFormulaText({
    formulaText,
    damageFormulaText,
    sequenceValue,
    totalValue,
    damageValue,
    firstTargetLead
  });
  const prefersAuthoredFormula = detailAlreadyMentionsFormula(detailText) && !inlineFormulaTextIsRich(inlineFormulaText);
  const injectedFormula = prefersAuthoredFormula
    ? { text: detailText, injected: false }
    : injectInlineFormulaAfterDeal(detailText, inlineFormulaText);
  if (injectedFormula.injected) {
    let resolvedText = pickFirstString(injectedFormula.text, detailText);
    if (firstTargetLead && getLocale() !== "en") {
      resolvedText = resolvedText
        .replace(/\bmỗi hit gây Mục tiêu đầu dính chịu\b/iu, "mục tiêu đầu dính chịu")
        .replace(/\bmỗi hit Mục tiêu đầu dính chịu\b/iu, "mục tiêu đầu dính chịu")
        .replace(/\bMỗi hit gây Mục tiêu đầu dính chịu\b/iu, "Mục tiêu đầu dính chịu");
    }
    return resolvedText;
  }
  let appendix = "";
  const locale = getLocale();
  if (hasMeaningfulRenderedValue(inlineFormulaText)) {
    appendix = `${inlineFormulaText}.`;
  } else if (hasMeaningfulRenderedValue(firstHitValue)) {
    appendix = locale === "en"
      ? `First hit deals ${firstHitValue}${hasMeaningfulRenderedValue(sequenceValue) ? `, then chains as ${sequenceValue}` : ""}${hasMeaningfulRenderedValue(totalValue) ? ` with max total ${totalValue}` : ""}.`
      : firstTargetLead
        ? `Mục tiêu đầu dính chịu ${firstHitValue}${hasMeaningfulRenderedValue(sequenceValue) ? `, rồi chuỗi nảy thành ${sequenceValue}` : ""}${hasMeaningfulRenderedValue(totalValue) ? ` với tổng tối đa ${totalValue}` : ""}.`
        : `Hit đầu gây ${firstHitValue}${hasMeaningfulRenderedValue(sequenceValue) ? `, rồi nảy thành chuỗi ${sequenceValue}` : ""}${hasMeaningfulRenderedValue(totalValue) ? ` với tổng tối đa ${totalValue}` : ""}.`;
  } else if (hasMeaningfulRenderedValue(damageValue) && hasMeaningfulRenderedValue(formulaText)) {
    appendix = `${formulaText}.`;
  } else if (hasMeaningfulRenderedValue(damageValue)) {
    appendix = locale === "en"
      ? `Skill deals ${damageValue}.`
      : `Kỹ năng gây ${damageValue}.`;
  }
  return pickFirstString([detailText, appendix].filter(Boolean).join(" ").trim(), detailText, appendix);
}

function buildResolvedAttackVm(baseUnit: BaseUnit | null | undefined): TooltipVm | null {
  const attackDef = baseUnit?.attackDef;
  if (!attackDef) return null;
  const locale = getLocale();
  const tooltipModel = buildAttackTooltipModel(baseUnit) ?? {};
  const summaryByStar = buildTooltipSummaryByStar(tooltipModel, locale);
  const statRows = mapTooltipRows(tooltipModel.statRows ?? []);
  if (!statRows.some((row) => row?.key === "damageType") && attackDef?.damageType) {
    statRows.unshift({
      key: "damageType",
      label: getLocale() === "en" ? "Damage type" : "Loại sát thương",
      format: "text",
      valuesByStar: {
        1: translateDamageType(attackDef.damageType),
        2: translateDamageType(attackDef.damageType),
        3: translateDamageType(attackDef.damageType)
      }
    });
  }
  return {
    source: "v3",
    title: t("combat.basicAttack"),
    summaryText: pickFirstString(summaryByStar?.[1]),
    summaryByStar,
    detailText: pickFirstString(summaryByStar?.[1]),
    detailByStar: { ...summaryByStar },
    upgradeByStar: { 1: "", 2: "", 3: "" },
    castTypeText: pickFirstString(
      resolvePlayerFacingField(tooltipModel, "castTypeText", locale),
      resolveAttackCastTypeText(attackDef.delivery, locale)
    ),
    targetText: pickFirstString(
      resolvePlayerFacingField(tooltipModel, "targetText", locale),
      resolvePlayerFacingField(attackDef.target, "tooltipText", locale),
      locale === "en" ? "1 enemy" : "1 kẻ địch"
    ),
    shapeText: pickFirstString(resolvePlayerFacingField(tooltipModel, "shapeText", locale)),
    selectionRuleText: pickFirstString(resolvePlayerFacingField(tooltipModel, "selectionRuleText", locale)),
    affectedCountText: pickFirstString(resolvePlayerFacingField(tooltipModel, "affectedCountText", locale)),
    durationRuleText: pickFirstString(resolvePlayerFacingField(tooltipModel, "durationRuleText", locale)),
    areaDescription: pickFirstString(resolvePlayerFacingField(tooltipModel, "areaDescription", locale)),
    resourceRows: mapTooltipRows(tooltipModel.header?.resourceRows ?? []),
    statRows,
    keywords: mapTooltipKeywords(tooltipModel.keywords ?? []),
    milestones: []
  };
}

export function describeBasicAttackFromDef(attackDef: AttackDef, baseUnit: BaseUnit | null = null, star: number = 1): string[] {
  const currentStar = clampStar(star);
  const vm = buildResolvedAttackVm(baseUnit?.attackDef ? baseUnit : { ...baseUnit, attackDef });
  return renderTooltipVmToLines(vm, currentStar, { kind: "attack" }).map((line) => stripTooltipHighlightMarkup(line));
}

function buildLegacyAttackVm(classType?: string | null, range?: number | null, baseStats: Record<string, unknown> | null = null): TooltipVm {
  const pattern = inferBasicActionPattern(classType, range);
  const isMagic = classType === "MAGE" || classType === "SUPPORT";
  const statKey = isMagic ? "matk" : "atk";
  const delivery = (range ?? 1) >= 2
    ? (isMagic ? (getLocale() === "en" ? "Ranged spell" : "Phóng phép tầm xa") : (getLocale() === "en" ? "Ranged shot/throw" : "Bắn/Ném tầm xa"))
    : pattern === "ASSASSIN_BACK"
      ? (getLocale() === "en" ? "Dive behind the target" : "Lao sau lưng mục tiêu")
      : (getLocale() === "en" ? "Close melee strike" : "Cận chiến áp sát");
  const targetText = (range ?? 1) >= 2
    ? (getLocale() === "en" ? "1 nearest enemy in the same row" : "1 kẻ địch gần nhất cùng hàng")
    : pattern === "ASSASSIN_BACK"
      ? (getLocale() === "en" ? "1 backline enemy" : "1 kẻ địch hậu tuyến")
      : (getLocale() === "en" ? "1 frontline enemy" : "1 kẻ địch tiền tuyến");
  const damageValuesByStar: Record<number, number> = {};
  const rangeValuesByStar = {
    1: Number(range ?? 1) || 1,
    2: Number(range ?? 1) || 1,
    3: Number(range ?? 1) || 1
  };
  for (const currentStar of [1, 2, 3]) {
    const scaledStats = getScaledBaseStats(baseStats, currentStar, classType);
    const statValue = Number((scaledStats as unknown as Record<string, unknown>)?.[statKey] ?? 0) || 0;
    damageValuesByStar[currentStar] = statValue;
  }
  return {
    source: "legacy",
    title: t("combat.basicAttack"),
    summaryText: "",
    summaryByStar: { 1: "", 2: "", 3: "" },
    detailText: "",
    detailByStar: { 1: "", 2: "", 3: "" },
    upgradeByStar: { 1: "", 2: "", 3: "" },
    castTypeText: delivery,
    targetText,
    shapeText: getLocale() === "en" ? "single target" : "đơn mục tiêu",
    selectionRuleText: "",
    affectedCountText: getLocale() === "en" ? "1 target" : "1 mục tiêu",
    durationRuleText: "",
    areaDescription: "",
    resourceRows: [],
    statRows: mapTooltipRows([
      {
        key: "damageType",
        labelVi: "Loại sát thương",
        labelEn: "Damage type",
        metric: "attack.damage_type",
        format: "text",
        valuesByStar: {
          1: translateDamageType(isMagic ? "magic" : "physical"),
          2: translateDamageType(isMagic ? "magic" : "physical"),
          3: translateDamageType(isMagic ? "magic" : "physical")
        }
      },
      {
        key: "damage",
        labelVi: "Sát thương",
        labelEn: "Damage",
        metric: "attack.total_damage",
        format: "integer",
        valuesByStar: damageValuesByStar
      },
      {
        key: "range",
        labelVi: "Tầm đánh",
        labelEn: "Range",
        metric: "attack.range",
        format: "range_text",
        valuesByStar: rangeValuesByStar
      }
    ]),
    keywords: [],
    milestones: []
  };
}

export function describeBasicAttackLegacy(classType?: string | null, range?: number | null, baseStats: Record<string, unknown> | null = null, star: number = 1): string[] {
  const currentStar = clampStar(star);
  return renderTooltipVmToLines(buildLegacyAttackVm(classType, range, baseStats), currentStar, { kind: "attack" })
    .map((line) => stripTooltipHighlightMarkup(line));
}

export function describeBasicAttack(arg1?: unknown, arg2?: unknown, arg3?: unknown, arg4?: unknown): string[] {
  if (arg1 && typeof arg1 === "object") {
    const unitObj = arg1 as BaseUnit;
    if (unitObj.attackDef) return describeBasicAttackFromDef(unitObj.attackDef, unitObj, typeof arg2 === "number" ? arg2 : 1);
    const attackObj = arg1 as AttackDef;
    if (attackObj.delivery || attackObj.damageType || attackObj.tooltipDef) {
      return describeBasicAttackFromDef(attackObj, { stats: (arg2 ?? {}) as BaseUnit["stats"], classType: typeof arg3 === "string" ? arg3 : undefined, attackDef: attackObj }, typeof arg4 === "number" ? arg4 : 1);
    }
  }
  return describeBasicAttackLegacy(
    typeof arg1 === "string" ? arg1 : undefined,
    typeof arg2 === "number" ? arg2 : undefined,
    (arg2 && typeof arg2 === "object" ? arg2 : arg3 && typeof arg3 === "object" ? arg3 : null) as Record<string, unknown> | null,
    typeof arg4 === "number" ? arg4 : typeof arg2 === "number" ? arg2 : 1
  );
}

function getLegacyTargetText(skill: Skill | null | undefined, star: number): string {
  const locale = getLocale();
  const localized = resolvePlayerFacingField(skill, "targetText", locale);
  if (localized) return localized;
  if (locale !== "en" && skill?.targetText && typeof skill.targetText === "object") {
    return skill.targetText[star] ?? skill.targetText[1] ?? (getLocale() === "en" ? "situational" : "theo tình huống");
  }
  if (locale !== "en" && typeof skill?.targetText === "string" && skill.targetText.trim()) return skill.targetText.trim();
  if (Number.isFinite(Number(skill?.maxTargets))) {
    return locale === "en"
      ? `${Math.max(1, Number(skill?.maxTargets))} targets`
      : `${Math.max(1, Number(skill?.maxTargets))} mục tiêu`;
  }
  return skill?.actionPattern === "SELF"
    ? (locale === "en" ? "self" : "bản thân")
    : (locale === "en" ? "situational" : "theo tình huống");
}

function getLegacyShapeText(skill: Skill | null | undefined): string {
  const locale = getLocale();
  const localized = resolvePlayerFacingField(skill, "shapeText", locale);
  if (localized) return localized;
  if (locale !== "en" && typeof skill?.shapeText === "string" && skill.shapeText.trim()) return skill.shapeText.trim();
  if (skill?.actionPattern === "SELF") return locale === "en" ? "self" : "tự thân";
  if (skill?.actionPattern === "RANGED_STATIC") return locale === "en" ? "target point" : "điểm mục tiêu";
  return locale === "en" ? "special skill pattern" : GENERIC_SHAPE;
}

function resolveLegacyOffenseDebuffMode(skill: Skill | null | undefined): string {
  if (!skill) return "";
  const explicit = String(skill.offenseDebuffMode ?? skill.offenseDebuffStat ?? "").trim();
  if (explicit === "atk" || explicit === "matk" || explicit === "autoByRole") return explicit;
  if (skill.casterOnlyDebuff) return "matk";
  if (Array.isArray(skill.targetClasses) && skill.targetClasses.length) {
    const normalized = skill.targetClasses.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean);
    if (normalized.every((value) => value === "MAGE" || value === "SUPPORT")) return "matk";
  }
  if (Number(skill.offenseDebuffValue ?? skill.atkDebuffValue) > 0) return "autoByRole";
  return "";
}

function resolveLegacyOffenseDebuffLabel(skill: Skill | null | undefined, _baseUnit?: BaseUnit | null): string {
  const mode = resolveLegacyOffenseDebuffMode(skill);
  if (mode === "matk") return resolveLocaleText("tooltip.magic_attack_reduction", getLocale() === "en" ? "MATK reduction" : "Giảm MATK");
  if (mode === "atk") return resolveLocaleText("tooltip.attack_reduction", getLocale() === "en" ? "ATK reduction" : "Giảm ATK");
  if (mode === "autoByRole") return resolveLocaleText("tooltip.offense_reduction", getLocale() === "en" ? "Offense reduction by role" : "Giảm sức công theo vai trò");
  return resolveLocaleText("tooltip.attack_reduction", getLocale() === "en" ? "ATK reduction" : "Giảm ATK");
}

function buildLegacyMetricRows(skill: Skill | null | undefined, baseUnit: BaseUnit | null | undefined): TooltipRow[] {
  const rows: TooltipRow[] = [];
  const stats = baseUnit?.stats ?? {};
  for (const star of [1, 2, 3]) {
    const resolvedSkill = baseUnit?.id ? (getUnitSkillForStar(baseUnit.id, star) ?? skill) : skill;
    if (!resolvedSkill) continue;
    const scaledStats = getScaledBaseStats(stats, star, baseUnit?.classType);
    const starMult = getStarSkillMultiplier(star);
    const rowValues: Record<string, unknown> = {};

    if (Number.isFinite(Number(resolvedSkill.base)) && Number.isFinite(Number(resolvedSkill.scale)) && resolvedSkill.damageType) {
      const statKey = resolvedSkill.scaleStat || "atk";
      const statValue = Number((scaledStats as unknown as Record<string, unknown>)?.[statKey] ?? 0) || 0;
      const formulaOperations = buildResolvedFormulaOperations(starMult, resolvedSkill.formulaOperations);
      const baseFormulaValue = Number(resolvedSkill.base) + (statValue * Number(resolvedSkill.scale));
      const rawDamage = Math.max(0, Math.round(applyFormulaOperationsNumeric(baseFormulaValue, formulaOperations)));
      const damageFalloff = Number(resolvedSkill.damageFalloff);
      const hasDamageFalloff = Number.isFinite(damageFalloff) && damageFalloff > 0 && damageFalloff < 1 && Number(resolvedSkill.maxHits) > 1;
      if (hasDamageFalloff) {
        const sequence = buildFalloffDamageSequence(rawDamage, resolvedSkill.maxHits, damageFalloff);
        rowValues.firstHitDamage = rawDamage;
        rowValues.maxTotalDamage = sequence.total;
        upsertTooltipRow(rows, star, {
          key: "damageSequence",
          labelVi: "Chuỗi sát thương",
          labelEn: "Damage sequence",
          format: "text"
        }, sequence.text);
        upsertTooltipRow(rows, star, {
          key: "damageFormula",
          labelVi: "Công thức hit đầu",
          labelEn: "First-hit formula",
          format: "text",
          displayMode: "current_only"
        }, buildSkillDamageFormulaText(
          statKey,
          statValue,
          resolvedSkill.base ?? 0,
          resolvedSkill.scale ?? 0,
          starMult,
          rawDamage,
          damageFalloff,
          resolvedSkill.formulaOperations
        ));
      } else {
        rowValues.damage = rawDamage;
        upsertTooltipRow(rows, star, {
          key: "formula",
          labelVi: "Công thức",
          labelEn: "Formula",
          format: "text",
          displayMode: "current_only"
        }, buildSkillDamageFormulaText(
          statKey,
          statValue,
          resolvedSkill.base ?? 0,
          resolvedSkill.scale ?? 0,
          starMult,
          rawDamage,
          null,
          resolvedSkill.formulaOperations
        ));
      }
    }
    if (Number.isFinite(Number(resolvedSkill?.healBase)) || Number.isFinite(Number(resolvedSkill?.healScale))) {
      const statKey = resolvedSkill.healScaleStat || resolvedSkill.scaleStat || "matk";
      const statValue = Number((scaledStats as unknown as Record<string, unknown>)?.[statKey] ?? 0) || 0;
      rowValues.heal = Math.max(0, Math.round((Number(resolvedSkill.healBase ?? 0) + (statValue * Number(resolvedSkill.healScale ?? 0))) * starMult));
    }
    if (Number.isFinite(Number(resolvedSkill?.shieldBase)) || Number.isFinite(Number(resolvedSkill?.shieldScale))) {
      const statKey = resolvedSkill.shieldScaleStat || resolvedSkill.scaleStat || "def";
      const statValue = Number((scaledStats as unknown as Record<string, unknown>)?.[statKey] ?? 0) || 0;
      rowValues.shield = Math.max(0, Math.round((Number(resolvedSkill.shieldBase ?? 0) + (statValue * Number(resolvedSkill.shieldScale ?? 0))) * starMult));
    }
    rowValues.targetCount = Number.isFinite(Number(resolvedSkill?.maxTargets)) ? Math.max(1, Number(resolvedSkill.maxTargets)) : undefined;
    rowValues.turns = Number.isFinite(Number(resolvedSkill?.turns)) ? Math.max(1, Math.round(Number(resolvedSkill.turns))) : undefined;
    rowValues.defBuff = Number.isFinite(Number(resolvedSkill?.armorBuff)) ? Math.max(1, Math.round(Number(resolvedSkill.armorBuff) * starMult)) : undefined;
    rowValues.mdefBuff = Number.isFinite(Number(resolvedSkill?.mdefBuff)) ? Math.max(1, Math.round(Number(resolvedSkill.mdefBuff) * starMult)) : undefined;
    rowValues.atkBuff = Number.isFinite(Number(resolvedSkill?.atkBuff)) ? Math.max(1, Math.round(Number(resolvedSkill.atkBuff) * starMult)) : undefined;
    rowValues.offenseDebuff = Number.isFinite(Number(resolvedSkill?.offenseDebuffValue ?? resolvedSkill?.atkDebuffValue))
      ? Math.max(1, Math.round(Number(resolvedSkill.offenseDebuffValue ?? resolvedSkill.atkDebuffValue) * starMult))
      : undefined;
    rowValues.reflectPct = Number.isFinite(Number(resolvedSkill?.reflectPct)) ? Number(resolvedSkill.reflectPct) : undefined;
    rowValues.stunChance = Number.isFinite(Number(resolvedSkill?.stunChance)) ? Math.min(1, Number(resolvedSkill.stunChance)) : undefined;
    rowValues.burnChance = Number.isFinite(Number(resolvedSkill?.burnChance)) ? Math.min(1, Number(resolvedSkill.burnChance)) : undefined;
    rowValues.burnDamage = Number.isFinite(Number(resolvedSkill?.burnPerTurn)) ? Number(resolvedSkill.burnPerTurn) : undefined;
    rowValues.healPctMaxHp = Number.isFinite(Number(resolvedSkill?.healPctMaxHp)) ? Number(resolvedSkill.healPctMaxHp) : undefined;
    rowValues.hotPctMaxHp = Number.isFinite(Number(resolvedSkill?.hotPctMaxHp)) ? Number(resolvedSkill.hotPctMaxHp) : undefined;
    rowValues.cleanseCount = Number.isFinite(Number(resolvedSkill?.cleanseCount)) ? Number(resolvedSkill.cleanseCount) : undefined;
    rowValues.damageReductionPct = Number.isFinite(Number(resolvedSkill?.damageReductionPct)) ? Number(resolvedSkill.damageReductionPct) : undefined;
    rowValues.magicDamageReductionPct = Number.isFinite(Number(resolvedSkill?.magicDamageReductionPct)) ? Number(resolvedSkill.magicDamageReductionPct) : undefined;
    rowValues.guardianAbsorbPct = Number.isFinite(Number(resolvedSkill?.guardianAbsorbPct)) ? Number(resolvedSkill.guardianAbsorbPct) : undefined;

    Object.entries(rowValues).forEach(([key, value]) => {
      if (!Number.isFinite(Number(value))) return;
      let row = rows.find((entry) => entry.key === key);
      if (!row) {
        const metaMap: Record<string, [string | null, string]> = {
          damage: ["tooltip.damage", "integer"],
          firstHitDamage: [null, "integer"],
          maxTotalDamage: [null, "integer"],
          heal: ["tooltip.heal", "integer"],
          shield: ["tooltip.shield", "integer"],
          targetCount: ["tooltip.target_count", "integer"],
          turns: ["tooltip.turns", "turns"],
          defBuff: ["tooltip.def_buff", "integer"],
          mdefBuff: ["tooltip.mdef_buff", "integer"],
          atkBuff: ["tooltip.attack_buff", "integer"],
          offenseDebuff: [null, "integer"],
          reflectPct: ["tooltip.reflect_pct", "percent"],
          stunChance: ["tooltip.stun_chance", "percent"],
          burnChance: ["tooltip.burn_chance", "percent"],
          burnDamage: ["tooltip.burn_damage", "integer"],
          healPctMaxHp: ["tooltip.heal_pct_max_hp", "percent"],
          hotPctMaxHp: ["tooltip.hot_pct_max_hp", "percent"],
          cleanseCount: ["tooltip.cleanse_count", "integer"],
          damageReductionPct: ["tooltip.damage_reduction", "percent"],
          magicDamageReductionPct: ["tooltip.magic_damage_reduction", "percent"],
          guardianAbsorbPct: ["tooltip.guardian_absorb_pct", "percent"]
        };
        const meta = metaMap[key];
        const newRow: TooltipRow = {
          key,
          label: key === "firstHitDamage"
            ? (getLocale() === "en" ? "First-hit damage" : "Sát thương hit đầu")
            : key === "maxTotalDamage"
              ? (getLocale() === "en" ? "Max total damage" : "Tổng ST tối đa")
              : key === "offenseDebuff"
                ? resolveLegacyOffenseDebuffLabel(resolvedSkill, baseUnit)
                : resolveLocaleText(meta?.[0], key),
          format: meta?.[1] ?? "integer",
          valuesByStar: {}
        };
        rows.push(newRow);
        row = newRow;
      }
      if (!row.valuesByStar) row.valuesByStar = {};
      row.valuesByStar[star] = value;
    });
  }
  return rows;
}

function buildResolvedSkillVm(skill: Skill | null | undefined, baseUnit: BaseUnit | null | undefined): TooltipVm {
  const tooltipModel = skill?.tooltipModel ?? {};
  const locale = getLocale();
  const skillPitch = getUnitSkillPitch(baseUnit, skill, locale);
  const detailFallbackByStar = {
    1: pickFirstString(
      resolveLocalizedSkillText(skill, "detailText", locale),
      resolveLocalizedSkillText(skill, "description", locale),
      tooltipModel.detail?.[locale === "en" ? "textEn" : "textVi"]
    ),
    2: pickFirstString(
      resolveLocalizedSkillText(getUnitSkillForStar(baseUnit?.id, 2) ?? skill, "detailText", locale),
      resolveLocalizedSkillText(getUnitSkillForStar(baseUnit?.id, 2) ?? skill, "description", locale),
      tooltipModel.detail?.[locale === "en" ? "textEn" : "textVi"]
    ),
    3: pickFirstString(
      resolveLocalizedSkillText(getUnitSkillForStar(baseUnit?.id, 3) ?? skill, "detailText", locale),
      resolveLocalizedSkillText(getUnitSkillForStar(baseUnit?.id, 3) ?? skill, "description", locale),
      tooltipModel.detail?.[locale === "en" ? "textEn" : "textVi"]
    )
  };
  const basePitch = locale === "en"
    ? pickFirstString(baseUnit?.descriptionEn, baseUnit?.authoredDescriptionEn)
    : pickFirstString(baseUnit?.descriptionVi, baseUnit?.description, baseUnit?.authoredDescriptionVi);
  const pinnedSummary = pickFirstString(basePitch, skillPitch);
  const summaryByStar = {
    1: pinnedSummary,
    2: pinnedSummary,
    3: pinnedSummary
  };
  const detailByStar = buildExpandedDetailByStar(
    baseUnit,
    buildResolvedSkillTextByStar(baseUnit, "detailText", {}),
    detailFallbackByStar
  );
  const upgradeByStar = { 1: "", 2: "", 3: "" };
  const fallbackResourceRows = buildLegacyResourceRowsForSummary(skill, baseUnit);
  const fallbackStatRows = buildLegacyMetricRows(skill, baseUnit);
  const resolvedResourceRows = mapTooltipRows(tooltipModel.header?.resourceRows ?? []);
  const resolvedStatRows = mapTooltipRows(tooltipModel.statRows ?? []);
  const hasDamageRows = fallbackStatRows.some((row) => ["damage", "firstHitDamage", "maxTotalDamage", "damageSequence", "damageFormula", "formula"].includes(String(row.key ?? "")));
  const hasDamageFalloff = fallbackStatRows.some((row) => row.key === "damageSequence");
  const vm: TooltipVm = {
    source: "v3",
    title: pickFirstString(
      resolvePlayerFacingField(skill, "name", locale),
      prettyIdLabel(skill?.id, locale === "en" ? "Skill" : "Kỹ năng"),
      locale === "en" ? "None" : "Không có"
    ),
    summaryText: pickFirstString(summaryByStar?.[1], skillPitch),
    summaryByStar,
    detailText: pickFirstString(detailByStar?.[1], skillPitch),
    detailByStar,
    upgradeByStar,
    castTypeText: pickFirstString(
      resolvePlayerFacingField(skill, "castTypeText", locale),
      resolvePlayerFacingField(tooltipModel, "castTypeText", locale),
      translateActionPattern(skill?.actionPattern)
    ),
    targetText: pickFirstString(
      resolvePlayerFacingField(skill, "targetText", locale),
      resolvePlayerFacingField(tooltipModel, "targetText", locale),
      getLegacyTargetText(skill, 1)
    ),
    shapeText: pickFirstString(
      resolvePlayerFacingField(skill, "shapeText", locale),
      resolvePlayerFacingField(tooltipModel, "shapeText", locale),
      getLegacyShapeText(skill)
    ),
    selectionRuleText: pickFirstString(
      resolvePlayerFacingField(skill, "selectionRuleText", locale),
      resolvePlayerFacingField(tooltipModel, "selectionRuleText", locale)
    ),
    affectedCountText: pickFirstString(
      resolvePlayerFacingField(skill, "affectedCountText", locale),
      resolvePlayerFacingField(tooltipModel, "affectedCountText", locale)
    ),
    durationRuleText: pickFirstString(
      resolvePlayerFacingField(skill, "durationRuleText", locale),
      resolvePlayerFacingField(tooltipModel, "durationRuleText", locale)
    ),
    areaDescription: pickFirstString(
      resolvePlayerFacingField(skill, "areaDescription", locale),
      resolvePlayerFacingField(tooltipModel, "areaDescription", locale)
    ),
    resourceRows: resolvedResourceRows.length ? resolvedResourceRows : mapTooltipRows(fallbackResourceRows),
    statRows: resolvedStatRows.length ? resolvedStatRows : fallbackStatRows,
    keywords: mapTooltipKeywords(tooltipModel.keywords),
    milestones: []
  };
  vm.milestones = buildSkillDetailMilestones(baseUnit, detailByStar, vm);
  return vm;
}

function buildLegacySkillVm(skill: Skill | null | undefined, baseUnit: BaseUnit | null | undefined): TooltipVm {
  const locale = getLocale();
  const summaryFallback = getUnitSkillPitch(baseUnit, skill, locale);
  const star2Skill = getUnitSkillForStar(baseUnit?.id, 2) ?? skill;
  const star3Skill = getUnitSkillForStar(baseUnit?.id, 3) ?? skill;
  const statRows = buildLegacyMetricRows(skill, baseUnit);
  const hasDamageRows = statRows.some((row) => ["damage", "firstHitDamage", "maxTotalDamage", "damageSequence", "damageFormula", "formula"].includes(String(row.key ?? "")));
  const hasDamageFalloff = statRows.some((row) => row.key === "damageSequence");
  const resourceRows = baseUnit?.id
    ? [{
        key: "rageCost",
        label: resolveLocaleText("tooltip.cost.rage", locale === "en" ? "Required Rage" : "Nộ khí cần"),
        metric: "cast.cost",
        format: "integer",
        valuesByStar: {
          1: getUnitSkillForStar(baseUnit.id, 1)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0,
          2: getUnitSkillForStar(baseUnit.id, 2)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0,
          3: getUnitSkillForStar(baseUnit.id, 3)?.cost ?? baseUnit?.stats?.rageMax ?? skill?.cost ?? 0
        }
      }]
    : [];
  const resolvedSummaryByStar = {
    1: pickFirstString(resolveLocalizedSkillText(skill, "summaryText", locale), summaryFallback),
    2: pickFirstString(resolveLocalizedSkillText(star2Skill, "summaryText", locale), getUnitSkillPitch(baseUnit, star2Skill, locale)),
    3: pickFirstString(resolveLocalizedSkillText(star3Skill, "summaryText", locale), getUnitSkillPitch(baseUnit, star3Skill, locale))
  };
  const detailFallbackByStar = {
    1: pickFirstString(resolveLocalizedSkillText(skill, "detailText", locale), resolveLocalizedSkillText(skill, "description", locale)),
    2: pickFirstString(resolveLocalizedSkillText(star2Skill, "detailText", locale), resolveLocalizedSkillText(star2Skill, "description", locale)),
    3: pickFirstString(resolveLocalizedSkillText(star3Skill, "detailText", locale), resolveLocalizedSkillText(star3Skill, "description", locale))
  };
  const basePitch = locale === "en"
    ? pickFirstString(baseUnit?.descriptionEn, baseUnit?.authoredDescriptionEn)
    : pickFirstString(baseUnit?.descriptionVi, baseUnit?.description, baseUnit?.authoredDescriptionVi);
  const pinnedSummary = pickFirstString(basePitch, summaryFallback);
  const summaryByStar = { 1: pinnedSummary, 2: pinnedSummary, 3: pinnedSummary };
  const expandedDetailByStar = buildExpandedDetailByStar(
    baseUnit,
    buildResolvedSkillTextByStar(baseUnit, "detailText", {}),
    detailFallbackByStar
  );
  const upgradeByStar = { 1: "", 2: "", 3: "" };
  const vm = {
    source: "legacy",
    title: pickFirstString(
      resolvePlayerFacingField(skill, "name", locale),
      prettyIdLabel(skill?.id, locale === "en" ? "Skill" : "Kỹ năng"),
      locale === "en" ? "None" : "Không có"
    ),
    summaryText: pickFirstString(summaryByStar?.[1], summaryFallback),
    summaryByStar,
    detailText: pickFirstString(expandedDetailByStar?.[1], resolveLocalizedSkillText(skill, "detailText", locale), resolveLocalizedSkillText(skill, "description", locale), summaryFallback),
    detailByStar: expandedDetailByStar,
    upgradeByStar,
    castTypeText: translateActionPattern(skill?.actionPattern),
    targetText: getLegacyTargetText(skill, 1),
    shapeText: getLegacyShapeText(skill),
    selectionRuleText: pickFirstString(resolvePlayerFacingField(skill, "selectionRuleText", locale), locale === "en" ? "" : skill?.selectionRuleText),
    affectedCountText: pickFirstString(resolvePlayerFacingField(skill, "affectedCountText", locale), locale === "en" ? "" : skill?.affectedCountText),
    durationRuleText: pickFirstString(resolvePlayerFacingField(skill, "durationRuleText", locale), locale === "en" ? "" : skill?.durationRuleText),
    areaDescription: pickFirstString(resolvePlayerFacingField(skill, "areaDescription", locale), locale === "en" ? "" : skill?.areaDescription),
    resourceRows,
    statRows,
    keywords: [] as TooltipKeyword[],
    milestones: [] as MilestoneEntry[]
  };
  vm.milestones = buildSkillDetailMilestones(baseUnit, expandedDetailByStar, vm);
  return vm;
}

function renderTooltipVmToLines(vm: TooltipVm | null | undefined, currentStar: number, options: RenderTooltipOptions = {}): string[] {
  if (!vm) return [t("combat.noActiveSkill")];
  const lines = [];
  const kind = options?.kind === "attack" ? "attack" : "skill";
  const suppressSkillMetricRowsWhenDetailed = options?.suppressSkillMetricRowsWhenDetailed === true;
  const suppressSkillRageCostRow = options?.suppressSkillRageCostRow === true;
  const suppressAttackPresentationRows = options?.suppressAttackPresentationRows === true;
  const omitSkillLeadDetail = options?.omitSkillLeadDetail === true;
  const metaSentence = buildTooltipMetaSentence(vm, currentStar, kind);
  const detailText = kind === "skill"
    ? buildSkillDetailWithEmbeddedDamageRows(vm, currentStar)
    : pickFirstString(vm.detailByStar?.[currentStar], vm.detailText, vm.summaryByStar?.[currentStar], vm.summaryText);
  const renderedDetailText = String(detailText ?? "").trim();
  const showSkillMetricRows = kind !== "skill" || !suppressSkillMetricRowsWhenDetailed || !renderedDetailText;
  if (kind === "skill") {
    if (omitSkillLeadDetail && vm?.milestones?.length) {
      if (metaSentence) lines.push(metaSentence);
    } else if (detailText) lines.push(detailText);
    else if (metaSentence) lines.push(metaSentence);
  } else if (!metaSentence && detailText) {
    lines.push(detailText);
  }
  if (metaSentence && kind !== "skill") lines.push(metaSentence);
  (vm.resourceRows ?? [])
    .filter((row) => {
      if (kind === "skill" && !showSkillMetricRows) return false;
      if (kind !== "skill") return true;
      if (!suppressSkillRageCostRow) return true;
      const identity = `${row?.key ?? ""} ${row?.metric ?? ""} ${row?.labelKey ?? ""} ${row?.label ?? ""}`.toLowerCase();
      return !["cost.rage", "cast.cost", "ragecost", "nộ khí cần", "required rage"].some((needle) => identity.includes(needle));
    })
    .forEach((row) => {
    const label = pickFirstString(row?.label, resolveRowLabel(row));
    const body = formatTooltipRow(row, currentStar);
    lines.push(prependEmoji(label ? `${label}: ${body}` : `${body}`, resolveRowEmoji(row)));
  });
  (vm.statRows ?? [])
    .filter((row) => {
      if (row?.key === "damageType") return false;
      if (kind === "skill" && isDamagePresentationRow(row)) return false;
      if (kind === "skill" && !showSkillMetricRows) return false;
      if (kind !== "skill") {
        if (!suppressAttackPresentationRows) return true;
        const attackKey = String(row?.key ?? "").toLowerCase();
        return !["damage", "range", "formula", "damageformula", "firsthitdamage", "maxtotaldamage", "damagesequence"].includes(attackKey);
      }
      const identity = `${row?.key ?? ""} ${row?.metric ?? ""} ${row?.labelKey ?? ""}`.toLowerCase();
      const skipByKey = [
        "tooltip.turns",
        "tooltip.target_count",
        "tooltip.range",
        "attack.range"
      ].some((needle) => identity.includes(needle));
      if (skipByKey) return false;
      const label = pickFirstString(row?.label, resolveRowLabel(row));
      const currentValue = formatTooltipRowCurrentValue(row, currentStar);
      if (
        renderedDetailText
        && label
        && currentValue
        && detailMentionsTooltipText(renderedDetailText, label)
        && detailMentionsTooltipText(renderedDetailText, currentValue)
      ) {
        return false;
      }
      return true;
    })
    .filter((row) => {
      if (kind !== "skill") return true;
      const key = String(row?.key ?? "").toLowerCase();
      return !["turns", "duration", "targetcount", "maxtargets", "range"].includes(key);
    })
    .forEach((row) => {
    const label = pickFirstString(row?.label, resolveRowLabel(row));
    const body = formatTooltipRow(row, currentStar);
    lines.push(prependEmoji(label ? `${label}: ${body}` : `${body}`, resolveRowEmoji(row)));
  });
  (vm.keywords ?? []).filter((keyword) => !isRawDamageKeyword(keyword)).forEach((keyword) => {
    if (!keyword.title && !keyword.body) return;
    lines.push(`🔎 ${keyword.title || (getLocale() === "en" ? "Note" : "Ghi chú")}: ${keyword.body}`.trim());
  });
  lines.push(...formatSkillStarMilestoneLines(vm.milestones, currentStar));
  return lines;
}

export function buildTooltipViewModel(baseUnit: BaseUnit | null | undefined, star: number = 1, context: { skill?: Skill } = {}) {
  const currentStar = clampStar(star);
  const skill = context.skill ?? baseUnit?.skill ?? null;
  const attackVm = baseUnit?.attackDef ? buildResolvedAttackVm(baseUnit) : buildLegacyAttackVm(baseUnit?.classType, baseUnit?.stats?.range, baseUnit?.stats);
  const attackLines = attackVm
    ? renderTooltipVmToLines(attackVm, currentStar, { kind: "attack" })
    : describeBasicAttackLegacy(baseUnit?.classType, baseUnit?.stats?.range, baseUnit?.stats, currentStar);
  const skillVm = skill?.tooltipModel
    ? buildResolvedSkillVm(skill, baseUnit)
    : buildLegacySkillVm(skill, baseUnit);
  const locale = getLocale();
  return {
    currentStar,
    passive: {
      title: getRolePassiveSectionTitle(locale),
      lines: buildPassiveLines(baseUnit, currentStar, locale)
    },
    attack: {
      ...attackVm,
      lines: renderTooltipVmToLines(attackVm, currentStar, {
        kind: "attack",
        suppressAttackPresentationRows: true
      })
    },
    skill: {
      ...skillVm,
      lines: renderTooltipVmToLines(skillVm, currentStar, {
        kind: "skill",
        suppressSkillMetricRowsWhenDetailed: true,
        suppressSkillRageCostRow: true,
        omitSkillLeadDetail: true
      })
    }
  };
}

export function describeResolvedTooltipModel(skill: Skill | null | undefined, _tribe?: unknown, baseUnit: BaseUnit | null = null, currentStar: number = 1): string[] {
  const vm = buildResolvedSkillVm(skill, baseUnit);
  return renderTooltipVmToLines(vm, clampStar(currentStar), { kind: "skill" })
    .map((line) => stripTooltipHighlightMarkup(line));
}

export function describeLegacySkillText(skill: Skill | null | undefined, _tribe?: unknown, baseUnit: BaseUnit | null = null, currentStar: number = 1): string[] {
  const vm = buildLegacySkillVm(skill, baseUnit);
  return renderTooltipVmToLines(vm, clampStar(currentStar), { kind: "skill" })
    .map((line) => stripTooltipHighlightMarkup(line));
}

export function describeSkillLines(skill: Skill | null | undefined, baseUnit: BaseUnit | null = null, currentStar: number = 1, tribe: unknown = baseUnit?.tribe): string[] {
  return skill?.tooltipModel
    ? describeResolvedTooltipModel(skill, tribe, baseUnit, currentStar)
    : describeLegacySkillText(skill, tribe, baseUnit, currentStar);
}

export function describeSkill(skill: Skill | null | undefined, baseUnit: BaseUnit | null = null, currentStar: number = 1, tribe: unknown = baseUnit?.tribe): string {
  return describeSkillLines(skill, baseUnit, currentStar, tribe).join(" | ");
}

export function describeSkillArea(skill: Skill | null | undefined): string {
  if (!skill) return "";
  const locale = getLocale();
  return pickFirstString(
    resolvePlayerFacingField(skill, "areaDescription", locale),
    resolvePlayerFacingField(skill?.tooltipModel?.summary, "text", locale),
    resolvePlayerFacingField(skill, "description", locale)
  );
}

export function describeSkillWithElement(skill: Skill | null | undefined, tribe: unknown, baseUnit: BaseUnit | null = null, currentStar: number = 0): string[] {
  return describeSkillLines(skill, baseUnit, currentStar || 1, tribe);
}

export function stripSkillStarNotes(description: unknown): string {
  return removeStarSection(description);
}

export function getSkillTargetCountText(skill: Skill | null | undefined, star: number = 1): string {
  if (skill?.tooltipModel || skill?.runtimeShapeVersion === 3) {
    return pickFirstString(
      resolvePlayerFacingField(skill, "targetText", getLocale()),
      resolvePlayerFacingField(skill?.tooltipDef, "targetText", getLocale())
    ) || getLegacyTargetText(skill, star);
  }
  return getLegacyTargetText(skill, star);
}

export function getSkillShapeText(skill: Skill | null | undefined): string {
  if (skill?.tooltipModel || skill?.runtimeShapeVersion === 3) {
    return pickFirstString(
      resolvePlayerFacingField(skill, "shapeText", getLocale()),
      resolvePlayerFacingField(skill?.tooltipDef, "shapeText", getLocale())
    ) || getLegacyShapeText(skill);
  }
  return getLegacyShapeText(skill);
}

export function getSkillDamageAndFormulaText(skill: Skill | null | undefined, baseStats: Record<string, unknown> | null = null, star: number = 1): string {
  const currentStar = clampStar(star);
  if (skill?.tooltipModel) {
    const row = (skill.tooltipModel.statRows ?? []).find((entry) => entry.metric?.includes(".total_damage"));
    if (row) {
      const label = resolveRowLabel(row);
      return `${label}: ${formatValuesByStar(row.valuesByStar, row.format, currentStar)}`;
    }
  }
  const lines = buildLegacyMetricRows(skill, { stats: baseStats ?? {} }).filter((row) => row.key === "damage" || row.key === "firstHitDamage");
  if (!lines.length) return "";
  const row = lines[0];
  return `${row.label}: ${formatValuesByStar(row.valuesByStar, row.format, currentStar)}`;
}

export function buildSkillStarMilestoneLines(skill: Skill | null | undefined, baseUnit: BaseUnit | null = null, currentStar: number = 1): string[] {
  if (!skill) return [];
  const vm = skill?.tooltipModel
    ? buildResolvedSkillVm(skill, baseUnit)
    : buildLegacySkillVm(skill, baseUnit);
  return formatSkillStarMilestoneLines(vm?.milestones ?? [], clampStar(currentStar))
    .map((line) => stripTooltipHighlightMarkup(line));
}

export {
  translateAugmentGroup,
  getAugmentIcon,
  translateSkillEffect,
  formatBonusSet,
  getSpeciesEvasion,
  getClassAccuracy
} from "./unitDescriptionTranslations.js";
