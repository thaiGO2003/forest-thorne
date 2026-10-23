/**
 * unitCatalog.js — Unit data loaded from individual JS module files.
 *
 * Source of truth:
 * - legacy units: skillId + skill + starDescriptions
 * - V3 units: attackDef + abilityDef
 *
 * Catalog output stays backward-compatible with the current runtime:
 * - exposes skillId
 * - exposes skill
 * - exposes star1Desc/star2Desc/star3Desc
 */

import { getLocale, translateForLocale } from "../i18n/index.js";
import { prettyIdLabel, resolveLocaleField, resolveLocaleKeyedText } from "../i18n/localeText.js";
import { scaledBaseStats } from "../core/gameUtils.js";
import { getFactionForSpecies } from "./factionInfo.js";
import {
  sanitizeVietnameseFieldMap,
  sanitizeVietnamesePlayerText
} from "../core/viTextSanitizer.js";
import {
  finalizeSkillRuntime,
  resolveLegacySkillStarDescriptions
} from "./skillRuntime.js";

type Obj = Record<string, unknown>;
type Locale = "vi" | "en";
type MetricsByStar = Record<number, Obj>;
type StarMetrics = Record<1 | 2 | 3, Obj>;
type MetricKey = string;

interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  matk: number;
  mdef: number;
  range?: number;
  rageMax?: number;
}

interface ScaledStats extends BaseStats {
  evasion: number;
}


function asObj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
}

function asRecord<K extends PropertyKey, V>(value: unknown): Record<K, V> {
  return value && typeof value === "object"
    ? (value as Record<K, V>)
    : ({} as Record<K, V>);
}

const activeUnitModules = import.meta.glob<Obj>(
  [
    "../../data/units/*.js",
    "../../data/units/*/index.js",
    "!../../data/units/boss_*.js",
    "!../../data/units/unitSkinFactory.js",
    "!../../data/units/*_visual.js",
    "!../../data/units/*/*_visual.js"
  ],
  { eager: true }
);

const archivedUnitModules = Object.freeze({});
const LIVE_ACTIVE_UNIT_ID_SET = new Set<string>(
  Object.values(activeUnitModules)
    .map((module) => {
      const defaultEntry = asObj(module.default);
      const rawId = typeof defaultEntry.id === "string" ? defaultEntry.id : asObj(module).id;
      return typeof rawId === "string" ? rawId : null;
    })
    .filter((id): id is string => Boolean(id))
);

const bossUnitModules = import.meta.glob<Obj>(
  [
    "../../data/units/boss_*.js"
  ],
  { eager: true }
);

function toAsciiLower(text: unknown): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferSpeciesKey(name: unknown, fallbackId = "linh-thu"): string {
  const text = toAsciiLower(name).replace(/[^a-z0-9\s]/g, " ");
  const normalized = text.replace(/\s+/g, " ").trim();
  const phraseRules = [
    ["te giac", "te-giac"], ["ky lan", "ky-lan"], ["ha ma", "ha-ma"],
    ["dai bang", "dai-bang"], ["linh mieu", "linh-mieu"], ["ho ly", "ho-ly"],
    ["su tu", "su-tu"], ["bo ngua", "bo-ngua"], ["bo cap", "bo-cap"],
    ["khung long", "khung-long"], ["hai cau", "hai-cau"], ["thien nga", "thien-nga"],
    ["bach tuoc", "bach-tuoc"], ["sao bien", "sao-bien"], ["tac ke", "tac-ke"],
    ["ca heo", "ca-heo"], ["ca sau", "ca-sau"]
  ];
  for (const [phrase, key] of phraseRules) {
    if (normalized.includes(phrase)) return key;
  }
  const tokens = normalized.split(" ").filter(Boolean);
  const animalTokens = new Set([
    "gau", "te", "rua", "trau", "nguu", "bo", "bao", "cao", "cho", "doi",
    "mieu", "meo", "ly", "quy", "hung", "voi", "lon", "ran", "ong", "sao",
    "vit", "moi", "ca", "muc", "oc", "ngua", "cuu", "tho", "soc", "vuon",
    "cong", "phuong", "long", "lan", "bang", "khi", "hau", "cu", "nai",
    "vet", "ho", "soi", "chon", "huou", "chim", "co", "diet", "buom",
    "coc", "su", "kien", "sau", "ret", "muoi", "gian", "de", "chau"
  ]);
  for (const token of tokens) {
    if (animalTokens.has(token)) return token;
  }
  if (tokens.length) return tokens[0];
  return String(fallbackId ?? "linh-thu").split("_")[0] || "linh-thu";
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeSpaces(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(text: unknown): string {
  return normalizeSpaces(text).replace(/[.。]+$/g, "").trim();
}

function ensureSentence(text: unknown): string {
  const value = stripTrailingPunctuation(text);
  return value ? `${value}.` : "";
}

function firstSentence(text: unknown): string {
  const value = normalizeSpaces(text);
  if (!value) return "";
  return stripTrailingPunctuation(value.split(/[.!?]/)[0]);
}

function sentenceCase(text: unknown): string {
  const value = normalizeSpaces(text);
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function looksVietnamese(text: unknown): boolean {
  const value = String(text ?? "");
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(value)
    || /\b(kẻ địch|đồng minh|bản thân|mục tiêu|sát thương|lượt|thiêu đốt|giảm|tăng|hình|cụm|đòn|hàng|cột|nộ|ưu tiên|chọn)\b/i.test(value);
}

const GENERIC_TARGET_TEXT_PATTERNS = [
  /^1 mục tiêu$/i,
  /^\d+\s+mục tiêu$/i,
  /^\d+\s+đồng minh$/i,
  /^\[object object\]$/i
];
const VAGUE_SCOPED_TEXT_PATTERNS = [
  /\btheo sao\b/i,
  /\bở sao cao\b/i,
  /\d+\s*-\s*\d+/,
  /\bbản thân\b.*3 sao/i,
  /\b3 sao\b.*thêm/i
];
const SCOPED_FORCE_CANONICAL_DETAIL_IDS = new Set<string>([]);

function isGenericScopedTargetText(text: unknown): boolean {
  const value = normalizeSpaces(text);
  if (!value) return true;
  return GENERIC_TARGET_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function hasVagueScopedText(text: unknown): boolean {
  const value = normalizeSpaces(text);
  if (!value) return true;
  return VAGUE_SCOPED_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function deriveUnitPitchText(text: unknown, unitName = ""): string {
  const raw = sanitizeVietnamesePlayerText(String(text ?? "").trim());
  if (!raw) return "";
  const strippedUnitName = unitName
    ? raw.replace(new RegExp(`^${unitName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "")
    : raw;
  return sanitizeVietnamesePlayerText(
    strippedUnitName
      .replace(/\([^)]*\)/g, "")
      .split(/[.;]/)[0]
      .split(/\s*,\s*/)[0]
      .replace(/\s+/g, " ")
      .trim()
  );
}

function deriveEnglishPitchText(text: unknown): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/\([^)]*\)/g, "")
    .split(/[.;]/)[0]
    .split(/\s*,\s*/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLocaleText(key: unknown, fallback = "", locale: string = getLocale()): string {
  if (typeof key === "string" && key.trim()) {
    const translated = translateForLocale(locale, key);
    return translated !== key ? translated : fallback ?? "";
  }
  return fallback ?? "";
}

function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneDeep(entry)) as T;
  if (value && typeof value === "object") {
    const copy: Obj = {};
    for (const [k, v] of Object.entries(value)) copy[k] = cloneDeep(v);
    return copy as T;
  }
  return value;
}

function mergeInto(target: Obj, patch: unknown): Obj {
  if (!patch || typeof patch !== "object") return target;
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      target[key] = value.map((entry) => cloneDeep(entry));
    } else if (value && typeof value === "object" && typeof target[key] === "object" && !Array.isArray(target[key])) {
      mergeInto(asObj(target[key]), value);
    } else {
      target[key] = cloneDeep(value);
    }
  }
  return target;
}

function resolveStarMappedValue(value: unknown, star: number, fallback: unknown = null): unknown {
  if (value == null) return fallback;
  if (typeof value !== "object") return value;
  const record = value as Record<number | string, unknown>;
  return record[star] ?? record[String(star)] ?? fallback;
}

function deriveTargetText(target: Obj | undefined, tooltipDef: Obj = {}, locale: string = getLocale()): string {
  const explicit = resolveLocaleField(tooltipDef, "targetText", {
    locale,
    allowBase: locale !== "en",
    allowCrossLocale: locale !== "en"
  });
  if (explicit) return explicit;
  const side = locale === "en"
    ? target?.side === "ally" ? "ally" : target?.side === "self" ? "self" : "enemy target"
    : target?.side === "ally" ? "đồng minh" : target?.side === "self" ? "bản thân" : "kẻ địch";
  const pluralSide = locale === "en"
    ? target?.side === "ally" ? "allies" : target?.side === "self" ? "self" : "enemies"
    : target?.side === "ally" ? "đồng minh" : target?.side === "self" ? "bản thân" : "kẻ địch";
  const shape = asObj(target?.shape).type;
  const count = asObj(target?.shape).count ?? "nhiều";
  if (target?.selector === "lowest_hp_pct" || target?.selector === "lowest_hp_pct_ally") {
    if (shape === "single") return locale === "en" ? `1 ${side} with the lowest HP%` : `1 ${side} % máu thấp nhất`;
    if (shape === "multi") return locale === "en" ? `${count} ${pluralSide} with the lowest HP%` : `${count} ${pluralSide} % máu thấp nhất`;
    return locale === "en" ? `${side} with the lowest HP%` : `${side} % máu thấp nhất`;
  }
  if (target?.selector === "lowest_rage_ally") {
    if (shape === "single") return locale === "en" ? `1 ${side} with the lowest rage` : `1 ${side} ít nộ nhất`;
    if (shape === "multi") return locale === "en" ? `${count} ${pluralSide} with the lowest rage` : `${count} ${pluralSide} ít nộ nhất`;
    return locale === "en" ? `${side} with the lowest rage` : `${side} ít nộ nhất`;
  }
  if (target?.selector === "highest_atk") {
    if (shape === "single") return locale === "en" ? `1 ${side} with the highest ATK` : `1 ${side} có ATK cao nhất`;
    if (shape === "multi") return locale === "en" ? `${count} ${pluralSide} with the highest ATK` : `${count} ${pluralSide} có ATK cao nhất`;
    return locale === "en" ? `${side} with the highest ATK` : `${side} có ATK cao nhất`;
  }
  if (target?.selector === "highest_atk_backline") {
    if (shape === "single") return locale === "en" ? `1 backline ${side} with the highest ATK` : `1 ${side} ở cột cuối cùng có ATK cao nhất`;
    if (shape === "multi") return locale === "en" ? `${count} backline ${pluralSide} with the highest ATK` : `${count} ${pluralSide} ở cột cuối cùng có ATK cao nhất`;
    return locale === "en" ? `backline ${side} with the highest ATK` : `${side} ở cột cuối cùng có ATK cao nhất`;
  }
  if (shape === "single") return `1 ${side}`;
  if (shape === "multi") return `${count} ${side}`;
  if (shape === "all_allies") return locale === "en" ? "all allies" : "toàn đội đồng minh";
  if (shape === "all_enemies") return locale === "en" ? "all enemies" : "toàn bộ kẻ địch";
  if (shape === "line") return locale === "en" ? `multiple ${side} in a line` : `nhiều ${side} trên một đường thẳng`;
  if (shape === "cone") return locale === "en" ? `multiple ${side} in a cone` : `nhiều ${side} trong vùng nón`;
  return side;
}

function deriveShapeText(target: Obj | undefined, tooltipDef: Obj = {}, locale: string = getLocale()): string {
  const explicit = resolveLocaleField(tooltipDef, "shapeText", {
    locale,
    allowBase: locale !== "en",
    allowCrossLocale: locale !== "en"
  });
  if (explicit) return explicit;
  const shapeInfo = asObj(target?.shape);
  const shape = shapeInfo.type;
  if (shape === "single") return locale === "en" ? "single tile" : "1 ô điểm";
  if (shape === "multi") return locale === "en" ? "multiple target tiles" : "nhiều ô mục tiêu";
  if (shape === "all_allies" || shape === "all_enemies") return locale === "en" ? "full formation area" : "toàn vùng đội hình";
  if (shape === "line") return locale === "en" ? "piercing line" : "đường thẳng xuyên";
  if (shape === "cone") return locale === "en" ? "front cone" : "vùng nón phía trước";
  if (shape === "aoe_radius") return locale === "en" ? `radius ${shapeInfo.radius ?? 1} circle` : `vòng tròn bán kính ${shapeInfo.radius ?? 1}`;
  return locale === "en" ? "special skill pattern" : "mẫu kỹ năng đặc thù";
}
function deriveAreaDescription(abilityDef: Obj | undefined, tooltipDef: Obj = {}, locale: string = getLocale()): string {
  return pickFirstString(
    resolveLocaleField(tooltipDef, "areaDescription", { locale, allowBase: locale !== "en", allowCrossLocale: locale !== "en" }),
    resolveLocaleText(
      tooltipDef.summaryKey,
      resolveLocaleField(tooltipDef, "summaryText", { locale, allowBase: locale !== "en", allowCrossLocale: locale !== "en" }),
      locale
    ),
    resolveLocaleField(asObj(abilityDef?.ui), "descriptionOverride", { locale, allowBase: locale !== "en", allowCrossLocale: locale !== "en" }),
    resolveLocaleField(abilityDef, "summary", { locale, allowBase: locale !== "en", allowCrossLocale: locale !== "en" })
  );
}


function translateActionPatternText(pattern: string, locale: Locale = "vi"): string {
  const map: Record<string, Record<Locale, string>> = {
    MELEE_FRONT: { vi: "Cận chiến tiền tuyến", en: "Frontline melee" },
    ASSASSIN_BACK: { vi: "Ám sát hậu tuyến", en: "Backline dive" },
    RANGED_STATIC: { vi: "Viễn chiến cố định", en: "Static ranged" },
    RANGED_CHAIN: { vi: "Chuỗi viễn chiến", en: "Ranged chain" },
    SELF: { vi: "Tự thân", en: "Self" }
  };
  return map[pattern]?.[locale] ?? pattern ?? "";
}

function buildTooltipRows(rowDefs: unknown, metricsByStar: MetricsByStar): Obj[] {
  return Array.isArray(rowDefs)
    ? rowDefs.map((row) => {
        const rowRecord = asObj(row);
        const metric = typeof rowRecord.metric === "string" ? rowRecord.metric : "";
        return {
          ...rowRecord,
          valuesByStar: {
            1: metricsByStar[1]?.[metric],
            2: metricsByStar[2]?.[metric],
            3: metricsByStar[3]?.[metric]
          }
        };
      })
    : [];
}

function buildTooltipTokensByStar(tooltipDef: Obj, metricsByStar: MetricsByStar): Record<number, Record<string, unknown>> {
  const tokensByStar: Record<number, Record<string, unknown>> = {};
  for (const star of [1, 2, 3]) {
    const starMetrics = metricsByStar[star] ?? {};
    const tokenEntries = Object.entries(asObj(tooltipDef.tokenMap)).map(([token, def]) => {
      const metric = asObj(def).metric;
      const metricKey = typeof metric === "string" ? metric : "";
      return [token, starMetrics[metricKey]];
    });
    tokensByStar[star] = Object.fromEntries(tokenEntries);
  }
  return tokensByStar;
}

function buildSharedTooltipModel({
  tooltipDef = {},
  metricsByStar,
  summaryFallbackVi = "",
  summaryFallbackEn = "",
  detailFallbackVi = "",
  detailFallbackEn = "",
  castTypeFallbackVi = "",
  castTypeFallbackEn = "",
  targetFallbackVi = "",
  targetFallbackEn = "",
  shapeFallbackVi = "",
  shapeFallbackEn = "",
  selectionRuleFallbackVi = "",
  selectionRuleFallbackEn = "",
  affectedCountFallbackVi = "",
  affectedCountFallbackEn = "",
  durationRuleFallbackVi = "",
  durationRuleFallbackEn = "",
  areaDescriptionFallbackVi = "",
  areaDescriptionFallbackEn = "",
  detailsFallback = [],
  previewCellsFallback = [],
  errorsFallback = {}
}: {
  tooltipDef?: Obj;
  metricsByStar: MetricsByStar;
  summaryFallbackVi?: string;
  summaryFallbackEn?: string;
  detailFallbackVi?: string;
  detailFallbackEn?: string;
  castTypeFallbackVi?: string;
  castTypeFallbackEn?: string;
  targetFallbackVi?: string;
  targetFallbackEn?: string;
  shapeFallbackVi?: string;
  shapeFallbackEn?: string;
  selectionRuleFallbackVi?: string;
  selectionRuleFallbackEn?: string;
  affectedCountFallbackVi?: string;
  affectedCountFallbackEn?: string;
  durationRuleFallbackVi?: string;
  durationRuleFallbackEn?: string;
  areaDescriptionFallbackVi?: string;
  areaDescriptionFallbackEn?: string;
  detailsFallback?: unknown[];
  previewCellsFallback?: unknown[];
  errorsFallback?: Obj;
}): Obj {
  return {
    header: {
      ...(asObj(tooltipDef.header)),
      resourceRows: buildTooltipRows(asObj(tooltipDef.header).resourceRows, metricsByStar)
    },
    summary: {
      key: tooltipDef.summaryKey ?? null,
      textVi: pickFirstString(
        resolveLocaleText(tooltipDef.summaryKey, String(tooltipDef.summaryTextVi ?? "")),
        resolveLocaleField(tooltipDef, "summaryText", { locale: "vi" }),
        summaryFallbackVi
      ),
      textEn: pickFirstString(
        resolveLocaleText(
          tooltipDef.summaryKey,
          resolveLocaleField(tooltipDef, "summaryText", { locale: "en", allowBase: false, allowCrossLocale: false }),
          "en"
        ),
        resolveLocaleField(tooltipDef, "summaryText", { locale: "en", allowBase: false, allowCrossLocale: false }),
        summaryFallbackEn
      ),
      tokensByStar: buildTooltipTokensByStar(tooltipDef, metricsByStar)
    },
    detail: {
      textVi: pickFirstString(
        resolveLocaleField(tooltipDef, "detailText", { locale: "vi" }),
        detailFallbackVi,
        summaryFallbackVi
      ),
      textEn: pickFirstString(
        resolveLocaleField(tooltipDef, "detailText", { locale: "en", allowBase: false, allowCrossLocale: false }),
        detailFallbackEn,
        summaryFallbackEn
      )
    },
    castTypeTextVi: pickFirstString(resolveLocaleField(tooltipDef, "castTypeText", { locale: "vi" }), castTypeFallbackVi),
    castTypeTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "castTypeText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      castTypeFallbackEn
    ),
    targetTextVi: pickFirstString(resolveLocaleField(tooltipDef, "targetText", { locale: "vi" }), targetFallbackVi),
    targetTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "targetText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      targetFallbackEn
    ),
    shapeTextVi: pickFirstString(resolveLocaleField(tooltipDef, "shapeText", { locale: "vi" }), shapeFallbackVi),
    shapeTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "shapeText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      shapeFallbackEn
    ),
    selectionRuleTextVi: pickFirstString(
      resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "vi" }),
      selectionRuleFallbackVi
    ),
    selectionRuleTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      selectionRuleFallbackEn
    ),
    affectedCountTextVi: pickFirstString(
      resolveLocaleField(tooltipDef, "affectedCountText", { locale: "vi" }),
      affectedCountFallbackVi
    ),
    affectedCountTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "affectedCountText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      affectedCountFallbackEn
    ),
    durationRuleTextVi: pickFirstString(
      resolveLocaleField(tooltipDef, "durationRuleText", { locale: "vi" }),
      durationRuleFallbackVi
    ),
    durationRuleTextEn: pickFirstString(
      resolveLocaleField(tooltipDef, "durationRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      durationRuleFallbackEn
    ),
    areaDescriptionVi: pickFirstString(
      resolveLocaleField(tooltipDef, "areaDescription", { locale: "vi" }),
      areaDescriptionFallbackVi
    ),
    areaDescriptionEn: pickFirstString(
      resolveLocaleField(tooltipDef, "areaDescription", { locale: "en", allowBase: false, allowCrossLocale: false }),
      areaDescriptionFallbackEn
    ),
    details: Array.isArray(tooltipDef.detailKeys) ? [...tooltipDef.detailKeys] : [...detailsFallback],
    statRows: buildTooltipRows(tooltipDef.statRows, metricsByStar),
    keywords: Array.isArray(tooltipDef.keywords) ? [...tooltipDef.keywords] : [],
    errors: { ...errorsFallback, ...(asObj(tooltipDef.errors)) },
    previewCells: tooltipDef.previewCells ?? previewCellsFallback,
    metricsByStar
  };
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : [];
}

function toMetricKey(prefix: string, riderKey: string, suffix: string): string {
  return `${prefix}.${riderKey}.${suffix}`;
}
function calcScaledValue(base: unknown, scaleDef: Obj | null | undefined, scaledStats: Obj): number {
  const baseValue = Number(base ?? 0) || 0;
  if (!scaleDef || typeof scaleDef !== "object") return Math.round(baseValue);
  const statKey = scaleDef.stat;
  const ratio = Number(scaleDef.ratio ?? 0) || 0;
  const statValue = Number(scaledStats[String(statKey)] ?? 0) || 0;
  return Math.max(0, Math.round(baseValue + (statValue * ratio)));
}


function buildAttackMetrics(attackDef: Obj, unitData: Obj, star: number): Record<string, number> {
  const scale = asObj(attackDef?.scale);
  const stats = asObj(unitData?.stats);
  const scaledStats = scaledBaseStats(stats as unknown as BaseStats, star, String(unitData?.classType ?? ""));
  const metrics: Record<string, number> = {};
  const scaleStat = typeof scale.stat === "string"
    ? scale.stat
    : (attackDef?.damageType === "magic" ? "matk" : "atk");
  const statValue = Number(scaledStats[scaleStat as keyof typeof scaledStats] ?? 0) || 0;
  const ratio = Number(scale.ratio ?? 1) || 1;
  metrics["attack.total_damage"] = Math.max(0, Math.round(statValue * ratio));
  metrics["attack.range"] = Number(stats.range ?? 1) || 1;
  const projectile = asObj(attackDef?.projectile);
  if (Number.isFinite(Number(projectile.travelMs))) {
    metrics["attack.projectile.travel_ms"] = Number(projectile.travelMs);
  }
  return metrics;
}

function buildAttackTooltipModel(attackDef: Obj, unitData: Obj): Obj {
  const tooltipDef = asObj(attackDef?.tooltipDef);
  const metricsByStar: StarMetrics = {
    1: buildAttackMetrics(attackDef, unitData, 1),
    2: buildAttackMetrics(attackDef, unitData, 2),
    3: buildAttackMetrics(attackDef, unitData, 3)
  };
  return buildSharedTooltipModel({
    tooltipDef,
    metricsByStar,
    castTypeFallbackVi: attackDef.delivery === "projectile"
      ? "Phóng đòn đánh tầm xa"
      : attackDef.delivery === "instant"
        ? "Thi triển tức thì"
        : "Cận chiến trực diện",
    castTypeFallbackEn: attackDef.delivery === "projectile"
      ? "Ranged projectile"
      : attackDef.delivery === "instant"
        ? "Instant cast"
        : "Direct melee",
    targetFallbackVi: deriveTargetText(asObj(attackDef.target), tooltipDef, "vi"),
    targetFallbackEn: deriveTargetText(asObj(attackDef.target), tooltipDef, "en"),
    shapeFallbackVi: deriveShapeText(asObj(attackDef.target), tooltipDef, "vi"),
    shapeFallbackEn: deriveShapeText(asObj(attackDef.target), tooltipDef, "en"),
    areaDescriptionFallbackVi: deriveAreaDescription(attackDef, tooltipDef, "vi"),
    areaDescriptionFallbackEn: deriveAreaDescription(attackDef, tooltipDef, "en")
  });
}

function resolveAbilityForStar(abilityDef: Obj, star: number): Obj {
  const resolved: Obj = cloneDeep(abilityDef);
  const starMods = asObj(abilityDef?.starMods);
  const mod = starMods[String(star)] ?? starMods[star];
  if (mod && typeof mod === "object") {
    const modRecord = asObj(mod);
    if (modRecord.patchCast) resolved.cast = mergeInto(asObj(resolved.cast), modRecord.patchCast);
    if (modRecord.patchTarget) resolved.target = mergeInto(asObj(resolved.target), modRecord.patchTarget);
    if (modRecord.patchPrimary) resolved.primary = mergeInto(asObj(resolved.primary), modRecord.patchPrimary);
    if (modRecord.patchTooltipDef) resolved.tooltipDef = mergeInto(asObj(resolved.tooltipDef), modRecord.patchTooltipDef);
    if (modRecord.patchUi) resolved.ui = mergeInto(asObj(resolved.ui), modRecord.patchUi);
    if (modRecord.patchRuntimeSkill) resolved.runtimeSkill = mergeInto(asObj(resolved.runtimeSkill), modRecord.patchRuntimeSkill);
    if (modRecord.patchRiders && Array.isArray(resolved.riders)) {
      const riders = resolved.riders as Obj[];
      const riderIndex = Object.fromEntries(riders.map((rider, index) => [asObj(rider).key, index]));
      for (const [riderKey, patch] of Object.entries(asObj(modRecord.patchRiders))) {
        const index = riderIndex[riderKey];
        if (index != null && riders[index]) mergeInto(asObj(riders[index]), patch);
      }
    }
    if (Array.isArray(modRecord.addRiders) && modRecord.addRiders.length > 0) {
      resolved.riders = [...(Array.isArray(resolved.riders) ? resolved.riders : []), ...modRecord.addRiders.map((entry) => cloneDeep(entry))];
    }
    if (typeof modRecord.summaryTextVi === "string") resolved.__starSummaryTextVi = modRecord.summaryTextVi;
    if (typeof modRecord.summaryTextEn === "string") resolved.__starSummaryTextEn = modRecord.summaryTextEn;
    if (typeof modRecord.detailTextVi === "string") resolved.__starDetailTextVi = modRecord.detailTextVi;
    if (typeof modRecord.detailTextEn === "string") resolved.__starDetailTextEn = modRecord.detailTextEn;
    if (typeof modRecord.upgradeTextVi === "string") resolved.__starUpgradeTextVi = modRecord.upgradeTextVi;
    if (typeof modRecord.upgradeTextEn === "string") resolved.__starUpgradeTextEn = modRecord.upgradeTextEn;
    const patchTooltip = asObj(modRecord.patchTooltipDef);
    if (typeof patchTooltip.summaryTextVi === "string") resolved.__starSummaryTextVi = patchTooltip.summaryTextVi;
    if (typeof patchTooltip.summaryTextEn === "string") resolved.__starSummaryTextEn = patchTooltip.summaryTextEn;
    if (typeof patchTooltip.detailTextVi === "string") resolved.__starDetailTextVi = patchTooltip.detailTextVi;
    if (typeof patchTooltip.detailTextEn === "string") resolved.__starDetailTextEn = patchTooltip.detailTextEn;
    if (typeof patchTooltip.upgradeTextVi === "string") resolved.__starUpgradeTextVi = patchTooltip.upgradeTextVi;
    if (typeof patchTooltip.upgradeTextEn === "string") resolved.__starUpgradeTextEn = patchTooltip.upgradeTextEn;
  }
  const mappedCost = Number(resolveStarMappedValue(abilityDef?.costByStar, star, asObj(resolved.cast).cost));
  if (Number.isFinite(mappedCost) && mappedCost > 0) {
    resolved.cast = { ...(asObj(resolved.cast)), cost: Math.max(1, Math.round(mappedCost)) };
  }
  return resolved;
}

function buildAbilityMetrics(abilityDef: Obj, unitData: Obj, star: number): Record<string, number> {
  const stats = asObj(unitData?.stats);
  const scaledStats = scaledBaseStats(stats as unknown as BaseStats, star, String(unitData?.classType ?? ""));
  const metrics: Record<string, number> = {};
  const cast = asObj(abilityDef?.cast);
  const target = asObj(abilityDef?.target);
  const primary = asObj(abilityDef?.primary);
  const riders = Array.isArray(abilityDef?.riders) ? (abilityDef.riders as Obj[]) : [];
  const runtimeSkill = asObj(abilityDef?.runtimeSkill);
  const powerScale = Number(resolveStarMappedValue(abilityDef?.powerScaleByStar, star, abilityDef?.powerScale ?? 1));
  const scaleFlat = (value: unknown): number | undefined => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return Math.round(numeric * (Number.isFinite(powerScale) && powerScale > 0 ? powerScale : 1));
  };
  const scaleDecimal = (value: unknown): number | undefined => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    const scaled = numeric * (Number.isFinite(powerScale) && powerScale > 0 ? powerScale : 1);
    return Number(scaled.toFixed(4));
  };

  if (Number.isFinite(Number(cast.cost))) metrics["cast.cost"] = Number(cast.cost);
  if (Number.isFinite(Number(cast.range))) metrics["cast.range"] = Number(cast.range);
  if (Number.isFinite(Number(cast.cooldownTurns))) metrics["cast.cooldownTurns"] = Number(cast.cooldownTurns);
  if (Number.isFinite(Number(cast.cooldownSeconds))) metrics["cast.cooldownSeconds"] = Number(cast.cooldownSeconds);
  const shape = asObj(target.shape);
  if (shape.type === "multi" && Number.isFinite(Number(shape.count))) {
    metrics["target.shape.count"] = Number(shape.count);
  }

  const primaryKey = primary.key;
  if (typeof primaryKey === "string" && primaryKey) {
    const prefix = `primary.${primaryKey}`;
    const primaryScale = asObj(primary.scale);
    const primaryBonusScale = asObj(primary.bonusScale);
    const primaryBase = scaleFlat(primary.base);
    const primaryScaleRatio = scaleDecimal(primaryScale.ratio ?? 0) ?? 0;
    if (Number.isFinite(primaryBase)) metrics[`${prefix}.base`] = primaryBase as number;
    if (typeof primaryScale.stat === "string") metrics[`${prefix}.scale.${primaryScale.stat}_ratio`] = primaryScaleRatio;
    if (typeof primaryBonusScale.stat === "string") metrics[`${prefix}.bonusScale.${primaryBonusScale.stat}_ratio`] = Number(primaryBonusScale.ratio ?? 0) || 0;
    if (Number.isFinite(Number(primary.hits))) metrics[`${prefix}.hits`] = Number(primary.hits);
    if (primary.kind === "damage") metrics[`${prefix}.total_damage`] = calcScaledValue(primaryBase ?? primary.base, { ...(primaryScale), ratio: primaryScaleRatio }, scaledStats as unknown as Obj);
    if (primary.kind === "heal") metrics[`${prefix}.total_heal`] = calcScaledValue(primaryBase ?? primary.base, { ...(primaryScale), ratio: primaryScaleRatio }, scaledStats as unknown as Obj);
    if (primary.kind === "shield") metrics[`${prefix}.total_shield`] = calcScaledValue(primaryBase ?? primary.base, { ...(primaryScale), ratio: primaryScaleRatio }, scaledStats as unknown as Obj);
  }

  riders.forEach((rider, index) => {
    const riderRecord = asObj(rider);
    const riderScale = asObj(riderRecord.scale);
    const riderKey = typeof riderRecord.key === "string" && riderRecord.key ? riderRecord.key : `r${index + 1}`;
    if (Number.isFinite(Number(riderRecord.value))) metrics[toMetricKey("rider", riderKey, "value")] = scaleFlat(riderRecord.value) as number;
    if (Number.isFinite(Number(riderRecord.turns))) metrics[toMetricKey("rider", riderKey, "turns")] = Number(riderRecord.turns);
    if (Number.isFinite(Number(riderRecord.rate))) metrics[toMetricKey("rider", riderKey, "rate")] = scaleDecimal(riderRecord.rate) as number;
    if (Number.isFinite(Number(riderRecord.chance))) metrics[toMetricKey("rider", riderKey, "chance")] = scaleDecimal(riderRecord.chance) as number;
    if (Number.isFinite(Number(riderRecord.damage))) metrics[toMetricKey("rider", riderKey, "damage")] = scaleFlat(riderRecord.damage) as number;
    if (Number.isFinite(Number(riderRecord.pct))) metrics[toMetricKey("rider", riderKey, "pct")] = scaleDecimal(riderRecord.pct) as number;
    if (Number.isFinite(Number(riderRecord.pctMaxHp))) metrics[toMetricKey("rider", riderKey, "pctMaxHp")] = scaleDecimal(riderRecord.pctMaxHp) as number;
    if (Number.isFinite(Number(riderRecord.count))) metrics[toMetricKey("rider", riderKey, "count")] = Number(riderRecord.count);
    const riderScaleRatio = scaleDecimal(riderScale.ratio ?? 0) ?? 0;
    if (typeof riderScale.stat === "string") metrics[toMetricKey("rider", riderKey, `scale.${riderScale.stat}_ratio`)] = riderScaleRatio;
    if (riderRecord.kind === "heal") metrics[toMetricKey("rider", riderKey, "total_heal")] = calcScaledValue(scaleFlat(riderRecord.base) ?? riderRecord.base, { ...(riderScale), ratio: riderScaleRatio }, scaledStats as unknown as Obj);
    if (riderRecord.kind === "shield") metrics[toMetricKey("rider", riderKey, "total_shield")] = calcScaledValue(scaleFlat(riderRecord.base) ?? riderRecord.base, { ...(riderScale), ratio: riderScaleRatio }, scaledStats as unknown as Obj);
    if (Number.isFinite(Number(riderRecord.base))) metrics[toMetricKey("rider", riderKey, "base")] = scaleFlat(riderRecord.base) as number;
  });

  Object.entries(runtimeSkill).forEach(([key, value]) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    metrics[`runtime.${key}`] = numeric;
  });

  return metrics;
}

function buildTooltipModel(abilityDef: Obj, unitData: Obj): Obj {
  const tooltipDef = asObj(abilityDef?.tooltipDef);
  const metricsByStar: StarMetrics = {
    1: buildAbilityMetrics(resolveAbilityForStar(abilityDef, 1), unitData, 1),
    2: buildAbilityMetrics(resolveAbilityForStar(abilityDef, 2), unitData, 2),
    3: buildAbilityMetrics(resolveAbilityForStar(abilityDef, 3), unitData, 3)
  };
  const ui = asObj(abilityDef?.ui);
  const castInfo = asObj(abilityDef?.cast);
  const previewCellsRaw = asObj(asObj(asObj(abilityDef.target).shape).previewCells);
  const previewCellsFallback = Array.isArray(previewCellsRaw) ? [...(previewCellsRaw as unknown[])] : [];
  return buildSharedTooltipModel({
    tooltipDef,
    metricsByStar,
    summaryFallbackVi: typeof ui.descriptionOverrideVi === "string" ? ui.descriptionOverrideVi : "",
    summaryFallbackEn: resolveLocaleField(ui, "descriptionOverride", {
      locale: "en",
      allowBase: false,
      allowCrossLocale: false
    }),
    detailFallbackVi: pickFirstString(
      resolveLocaleField(tooltipDef, "detailText", { locale: "vi" }),
      typeof ui.descriptionOverrideVi === "string" ? ui.descriptionOverrideVi : "",
      resolveLocaleField(tooltipDef, "summaryText", { locale: "vi" })
    ),
    detailFallbackEn: pickFirstString(
      resolveLocaleField(tooltipDef, "detailText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      resolveLocaleField(ui, "descriptionOverride", {
        locale: "en",
        allowBase: false,
        allowCrossLocale: false
      }),
      resolveLocaleField(tooltipDef, "summaryText", { locale: "en", allowBase: false, allowCrossLocale: false })
    ),
    castTypeFallbackVi: translateActionPatternText(String(castInfo.actionPattern ?? "SELF"), "vi"),
    castTypeFallbackEn: translateActionPatternText(String(castInfo.actionPattern ?? "SELF"), "en"),
    targetFallbackVi: deriveTargetText(asObj(abilityDef.target), tooltipDef, "vi"),
    targetFallbackEn: deriveTargetText(asObj(abilityDef.target), tooltipDef, "en"),
    shapeFallbackVi: deriveShapeText(asObj(abilityDef.target), tooltipDef, "vi"),
    shapeFallbackEn: deriveShapeText(asObj(abilityDef.target), tooltipDef, "en"),
    areaDescriptionFallbackVi: deriveAreaDescription(abilityDef, tooltipDef, "vi"),
    areaDescriptionFallbackEn: deriveAreaDescription(abilityDef, tooltipDef, "en"),
    previewCellsFallback,
  });
}

function extractLegacyCompatibilityFields(abilityDef: Obj): Obj {
  const riders = Array.isArray(abilityDef?.riders) ? (abilityDef.riders as Obj[]) : [];
  const primary = asObj(abilityDef?.primary);
  const primaryKind = primary.kind;
  const findRider = (pred: (rider: Obj) => boolean): Obj | undefined => riders.find((rider) => pred(rider));
  const stun = findRider((rider) => rider.kind === "stun" || rider.kind === "paralyze" || rider.kind === "freeze");
  const heal = findRider((rider) => rider.kind === "heal");
  const shield = findRider((rider) => rider.kind === "shield");
  const reflect = findRider((rider) => rider.kind === "reflect");
  const physReflect = findRider((rider) => rider.kind === "phys_reflect");
  const defBuff = findRider((rider) => rider.kind === "buff" && rider.stat === "def");
  const mdefBuff = findRider((rider) => rider.kind === "buff" && rider.stat === "mdef");
  const atkBuff = findRider((rider) => rider.kind === "buff" && rider.stat === "atk");
  const atkBuffPct = findRider((rider) => rider.kind === "buff_pct" && rider.stat === "atk");
  const offenseDebuff = findRider((rider) => rider.kind === "debuff" && ["atk", "matk", "offense"].includes(rider.stat as string));
  const atkDebuff = findRider((rider) => rider.kind === "debuff" && rider.stat === "atk");
  const poison = findRider((rider) => rider.kind === "dot" && rider.dotType === "poison");
  const burn = findRider((rider) => rider.kind === "dot" && rider.dotType === "burn");
  const hot = findRider((rider) => rider.kind === "hot" || rider.kind === "regen");
  const cleanse = findRider((rider) => rider.kind === "cleanse");
  const damageReduction = findRider((rider) => rider.kind === "damage_reduction");
  const magicReduction = findRider((rider) => rider.kind === "magic_damage_reduction");
  const guardian = findRider((rider) => rider.kind === "guardian");
  const maxHpBoost = findRider((rider) => rider.kind === "max_hp_boost");
  const shieldShare = findRider((rider) => rider.kind === "shield_share");
  const knockbackBonus = findRider((rider) => rider.kind === "knockback_bonus");
  const primaryScale = asObj(primary.scale);
  const healScale = asObj(heal?.scale);
  const shieldScale = asObj(shield?.scale);

  return {
    stunChance: stun?.chance,
    stunTurns: stun?.turns,
    healBase: heal?.base ?? (primaryKind === "heal" ? primary.base : undefined),
    healScale: healScale.ratio ?? (primaryKind === "heal" ? primaryScale.ratio : undefined),
    healScaleStat: healScale.stat ?? (primaryKind === "heal" ? primaryScale.stat : undefined),
    healPctMaxHp: heal?.pctMaxHp,
    shieldBase: shield?.base ?? (primaryKind === "shield" ? primary.base : undefined),
    shieldScale: shieldScale.ratio ?? (primaryKind === "shield" ? primaryScale.ratio : undefined),
    shieldScaleStat: shieldScale.stat ?? (primaryKind === "shield" ? primaryScale.stat : undefined),
    shieldPctMaxHp: shield?.pctMaxHp,
    reflectPct: reflect?.pct,
    reflectTurns: reflect?.turns,
    physReflectPct: physReflect?.pct,
    physReflectTurns: physReflect?.turns,
    armorBuff: defBuff?.value,
    mdefBuff: mdefBuff?.value,
    atkBuff: atkBuff?.value,
    atkBuffPct: atkBuffPct?.pct,
    offenseDebuffValue: offenseDebuff?.value,
    offenseDebuffTurns: offenseDebuff?.turns,
    offenseDebuffMode: offenseDebuff?.stat === "matk" ? "matk" : offenseDebuff?.stat === "atk" ? "autoByRole" : "autoByRole",
    atkDebuffValue: atkDebuff?.value,
    atkDebuffTurns: atkDebuff?.turns,
    poisonPerTurn: poison?.damage,
    poisonTurns: poison?.turns,
    burnChance: burn?.chance,
    burnPerTurn: burn?.damage,
    burnTurns: burn?.turns,
    hotPctMaxHp: hot?.pctMaxHp,
    hotTurns: hot?.turns,
    cleanseCount: cleanse?.count,
    damageReductionPct: damageReduction?.pct,
    damageReductionTurns: damageReduction?.turns,
    magicDamageReductionPct: magicReduction?.pct,
    magicDamageReductionTurns: magicReduction?.turns,
    guardianAbsorbPct: guardian?.pct,
    guardianTurns: guardian?.turns,
    maxHpBuffPct: maxHpBoost?.pctMaxHp,
    maxHpBuffFlat: maxHpBoost?.value,
    shieldSharePct: shieldShare?.pct,
    knockbackBonusPct: knockbackBonus?.pct,
    maxTargets: asObj(asObj(abilityDef.target).shape).count
  };
}

function deriveStarDescriptions(data: Obj): Record<number, unknown> {
  if (data?.starDescriptions) {
    const starDesc = asObj(data.starDescriptions);
    return {
      1: sanitizeVietnamesePlayerText(String(starDesc["1"] ?? "")),
      2: sanitizeVietnamesePlayerText(String(starDesc["2"] ?? "")),
      3: sanitizeVietnamesePlayerText(String(starDesc["3"] ?? ""))
    };
  }
  const starMods = asObj(asObj(data?.abilityDef).starMods);
  const starText = (star: number): unknown => {
    const mod = asObj(starMods[String(star)] ?? starMods[star]);
    const patchTooltip = asObj(mod.patchTooltipDef);
    const modUi = asObj(mod.ui);
    return pickFirstString(
      mod.upgradeTextVi,
      patchTooltip.upgradeTextVi,
      mod.summaryTextVi,
      modUi.summaryOverrideVi
    );
  };
  return {
    1: sanitizeVietnamesePlayerText(String(starText(1) ?? "")),
    2: sanitizeVietnamesePlayerText(String(starText(2) ?? "")),
    3: sanitizeVietnamesePlayerText(String(starText(3) ?? ""))
  };
}

const SCOPED_SKILL_REWRITE_EXCEPTION_IDS = new Set(["jellyfish_shock", "newt_fire"]);
const SCOPED_CUSTOM_PITCH_VI = Object.freeze({
  jellyfish_shock: "Chuỗi điện nhảy qua các kẻ địch có nộ cao nhất.",
  newt_fire: "Gây sát thương phép lửa vùng vuông vào cụm địch đông nhất.",
  butterfly_mirror: "Dựng khiên tự thân rồi phản sát thương phép.",
  dryad_tree: "Trói pháp sư hoặc hỗ trợ địch rồi tự hồi máu.",
  fairy_forest: "Hồi máu toàn đội và giữ nhịp giao tranh.",
  unicorn_light: "Tăng ATK cho đồng minh có ATK cao nhất.",
  armadillo_roll: "Tự cường DEF và MDEF để đỡ đòn kế tiếp.",
  crab_shell: "Chia sát thương để che chắn đồng minh thấp máu.",
  ox_mountain: "Tăng máu tối đa rồi tự hồi phục.",
  snail_fortress: "Dựng lớp phòng thủ miễn khống chế cho bản thân.",
  falcon_dive: "Phóng lao xuyên hàng địch đông nhất.",
  nymph_water: "Thanh tẩy và hồi máu cho đồng minh thấp máu.",
  pangolin_plate: "Phản lại đòn vật lý bằng giáp cứng.",
  turtle_mire: "Dựng khiên bền bỉ rồi hồi phục khi trụ giao tranh."
});
const SCOPED_CUSTOM_PITCH_EN = Object.freeze({
  jellyfish_shock: "Chains lightning through the highest-rage enemies.",
  newt_fire: "Drops a fire blast on the densest enemy cluster in a 3x3 square.",
  butterfly_mirror: "Raises a self shield and reflects magic damage.",
  dryad_tree: "Roots enemy mages or supports and heals itself.",
  fairy_forest: "Heals the full team and stabilizes long fights.",
  unicorn_light: "Raises ATK for the allies with the highest ATK.",
  armadillo_roll: "Fortifies DEF and MDEF to absorb the next hit.",
  crab_shell: "Shares damage to protect the lowest-HP ally.",
  ox_mountain: "Raises max HP and heals itself.",
  snail_fortress: "Builds a self-only anti-control shell.",
  falcon_dive: "Throws a piercing spear through the densest enemy row.",
  nymph_water: "Cleanses and heals the lowest-HP allies.",
  pangolin_plate: "Reflects incoming physical attacks with plated armor.",
  turtle_mire: "Builds a stubborn shield and sustains through damage."
});
const SCOPED_TOOLTIP_LABEL_EN: Record<string, string> = Object.freeze({
  "Sát thương": "Damage",
  "Tỉ lệ thiêu đốt": "Burn chance",
  "Thiêu đốt / lượt": "Burn per turn",
  "Thời lượng": "Duration",
  "Thời lượng hiệu lực": "Effect duration",
  "Tăng DEF": "DEF up",
  "Tăng MDEF": "MDEF up",
  "Giảm sát thương đòn kế": "Next-hit damage reduction",
  "Số mục tiêu": "Targets",
  "Tăng ATK": "ATK up",
  "Tăng MATK": "MATK up",
  "Giảm ATK": "ATK down",
  "Giảm MATK": "MATK down",
  "Tăng máu tối đa": "Max HP up",
  "Hồi máu": "Heal",
  "Hồi máu (% HP tối đa)": "Heal (% max HP)",
  "Khiên": "Shield",
  "Phản sát thương phép": "Magic reflect",
  "Phản sát thương vật lý": "Physical reflect",
  "Thanh tẩy": "Cleanse",
  "Miễn khống chế": "Control immunity",
  "Hút sát thương": "Guardian share",
  "Giảm sát thương": "Damage reduction",
  "Tỉ lệ phản sát thương vật lý": "Physical reflect rate",
  "Tỉ lệ chia khiên": "Shield sharing",
  "Câm lặng": "Silence",
  "Tự hồi (% HP tối đa)": "Self heal (% max HP)"
});
const SCOPED_VI_TO_EN_REPLACEMENTS = Object.freeze([
  ["toàn bộ kẻ địch trên hàng địch đông nhất", "all enemies on the densest enemy row"],
  ["toàn bộ mục tiêu cùng hàng", "all targets in that row"],
  ["toàn vùng đội hình đồng minh", "the whole allied formation"],
  ["tâm cụm địch đông nhất", "the center of the densest enemy cluster"],
  ["cột địch có tổng ATK cao nhất", "the enemy column with the highest total ATK"],
  ["hàng địch có nhiều mục tiêu nhất", "the enemy row with the most units"],
  ["hàng địch đông nhất", "the densest enemy row"],
  ["chuỗi chớp nảy không trùng mục tiêu", "a lightning chain with unique targets"],
  ["hình thập 5 ô quanh tâm", "a 5-tile cross around the center"],
  ["5 ô hình thập", "5 cross tiles"],
  ["vùng vuông 3x3 quanh điểm rơi", "a 3x3 square around the impact tile"],
  ["vùng 3x3", "3x3 area"],
  ["đường thẳng xuyên theo một hàng", "a piercing line across one row"],
  ["đường thẳng xuyên hàng", "a piercing line across one row"],
  ["các mục tiêu rời theo thứ tự chỉ số", "separate targets selected by stat order"],
  ["toàn đội đồng minh", "the whole allied team"],
  ["toàn bộ đồng minh", "all allies"],
  ["toàn bộ kẻ địch", "all enemies"],
  ["đồng minh có % máu thấp nhất", "ally with the lowest HP%"],
  ["đồng minh có ATK cao nhất", "ally with the highest ATK"],
  ["đồng minh có MATK cao nhất", "ally with the highest MATK"],
  ["pháp sư hoặc hỗ trợ địch có MATK cao nhất", "mage or support enemy with the highest MATK"],
  ["kẻ địch có nộ cao nhất", "enemy with the highest rage"],
  ["có nộ cao nhất", "with the highest rage"],
  ["ít nộ nhất", "with the lowest rage"],
  ["% máu thấp nhất", "with the lowest HP%"],
  ["ATK cao nhất", "with the highest ATK"],
  ["MATK cao nhất", "with the highest MATK"],
  ["bản thân", "self"],
  ["tự thân", "self"],
  ["đồng minh", "ally"],
  ["kẻ địch", "enemy"],
  ["mục tiêu", "target"],
  ["không trùng mục tiêu", "without repeating targets"],
  ["thiêu đốt", "burn"],
  ["đóng băng", "freeze"],
  ["choáng", "stun"],
  ["câm lặng", "silence"],
  ["ngủ", "sleep"],
  ["hóa đá", "petrify"],
  ["tức thì", "instant"],
  ["lượt", "turns"],
  ["giảm ATK", "ATK down"],
  ["giảm MATK", "MATK down"],
  ["giảm DEF", "DEF down"],
  ["giảm MDEF", "MDEF down"],
  ["tối đa", "up to"],
  ["cùng hàng", "in the same row"],
  ["cùng cột", "in the same column"],
  ["ngẫu nhiên", "randomly"]
]);

function isScopedShopSkillRewriteUnit(baseData: Obj): boolean {
  const id = String(baseData?.id ?? "");
  return LIVE_ACTIVE_UNIT_ID_SET.has(id) || SCOPED_SKILL_REWRITE_EXCEPTION_IDS.has(id);
}

function toScopedEnglishPhrase(text: unknown): string {
  let value = normalizeSpaces(text);
  if (!value) return "";
  for (const [vi, en] of [...SCOPED_VI_TO_EN_REPLACEMENTS].sort((a, b) => b[0].length - a[0].length)) {
    const escaped = vi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(escaped, "gi"), en);
  }
  return value
    .replace(/\b(\d+) ally\b/g, "$1 allies")
    .replace(/\b(\d+) enemy\b/g, "$1 enemies")
    .replace(/\b(\d+) target\b/g, "$1 targets")
    .replace(/^1 allies$/i, "1 ally")
    .replace(/^1 enemies$/i, "1 enemy")
    .replace(/^1 targets$/i, "1 target")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveScopedTooltipRowLabel(row: unknown, locale: string = "vi"): string {
  const rowRecord = asObj(row);
  const label = pickFirstString(
    locale === "en" ? rowRecord.labelEn : rowRecord.labelVi,
    rowRecord.label,
    typeof rowRecord.labelKey === "string" ? translateForLocale(locale, rowRecord.labelKey) : ""
  );
  if (locale !== "en") return normalizeSpaces(label);
  return normalizeSpaces(SCOPED_TOOLTIP_LABEL_EN[label] ?? toScopedEnglishPhrase(label));
}

function formatScopedTooltipValue(value: unknown, format: unknown, locale: string = "vi"): string {
  if (value == null || value === "") return "";
  if (format === "percent") return `${Math.round(Number(value) * 100)}%`;
  if (format === "turns") return `${Math.round(Number(value))} ${locale === "en" ? "turns" : "lượt"}`;
  if (format === "integer") return `${Math.round(Number(value))}`;
  return `${value}`;
}

function buildScopedStatClause(skill: Obj, star: number, locale: string = "vi"): string {
  const statRows: unknown = asObj(skill.tooltipModel).statRows;
  const rows = Array.isArray(statRows) ? statRows : [];
  const parts: string[] = [];
  rows.forEach((row) => {
    const rowRecord = asObj(row);
    const label = resolveScopedTooltipRowLabel(rowRecord, locale);
    const value = formatScopedTooltipValue(asObj(rowRecord.valuesByStar)[star], rowRecord.format, locale);
    if (!label || !value) return;
    parts.push(`${label} ${value}`);
  });
  return parts.join("; ");
}

function normalizeLegacySelectionVi(skill: Obj, id: string, targetTextVi: string): string {
  switch (skill?.targetSelector) {
    case "self":
      return "Chỉ ảnh hưởng bản thân.";
    case "highest_rage":
      return "Ưu tiên lần lượt các kẻ địch có nộ cao nhất.";
    case "most_clustered_row":
      return /cụm/i.test(targetTextVi)
        ? "Chọn tâm cụm địch có nhiều mục tiêu nhất."
        : "Ưu tiên hàng địch có nhiều mục tiêu nhất.";
    case "highest_total_atk_col":
      return "Ưu tiên cột địch có tổng ATK cao nhất.";
    case "lowest_hp_pct":
    case "lowest_hp_pct_ally":
      return /đồng minh/i.test(targetTextVi)
        ? "Ưu tiên đồng minh có % máu thấp nhất theo thứ tự."
        : "Ưu tiên kẻ địch có % máu thấp nhất theo thứ tự.";
    case "highest_atk":
      return /đồng minh/i.test(targetTextVi)
        ? "Ưu tiên đồng minh có ATK cao nhất theo thứ tự."
        : "Ưu tiên kẻ địch có ATK cao nhất theo thứ tự.";
    case "highest_atk_backline":
      return "Ưu tiên kẻ địch ở cột cuối cùng có ATK cao nhất.";
    case "highest_matk":
      return "Ưu tiên kẻ địch có MATK cao nhất theo thứ tự.";
    case "lowest_rage_ally":
      return "Ưu tiên đồng minh có nộ thấp nhất theo thứ tự.";
    default: {
      const current = stripTrailingPunctuation(skill?.selectionRuleTextVi ?? skill?.selectionRuleText ?? "");
      if (!current) return `Ưu tiên ${targetTextVi}.`;
      if (/^ưu tiên|^chọn|^chỉ/i.test(current)) return ensureSentence(current);
      return ensureSentence(`Ưu tiên ${current}`);
    }
  }
}

function normalizeLegacySelectionEn(skill: Obj, id: string, targetTextEn: string, selectionVi: string): string {
  switch (skill?.targetSelector) {
    case "self":
      return "Affects self only.";
    case "highest_rage":
      return "Prioritizes the highest-rage enemies in order.";
    case "most_clustered_row":
      return /center/i.test(targetTextEn)
        ? "Selects the center of the enemy cluster with the most units."
        : "Prioritizes the enemy row with the most units.";
    case "highest_total_atk_col":
      return "Prioritizes the enemy column with the highest total ATK.";
    case "lowest_hp_pct":
    case "lowest_hp_pct_ally":
      return /ally/i.test(targetTextEn)
        ? "Prioritizes allies with the lowest HP% in order."
        : "Prioritizes enemies with the lowest HP% in order.";
    case "highest_atk":
      return /ally/i.test(targetTextEn)
        ? "Prioritizes allies with the highest ATK in order."
        : "Prioritizes enemies with the highest ATK in order.";
    case "highest_atk_backline":
      return "Prioritizes the highest-ATK enemy in the last column.";
    case "highest_matk":
      return "Prioritizes enemies with the highest MATK in order.";
    case "lowest_rage_ally":
      return "Prioritizes allies with the lowest rage in order.";
    default:
      return sentenceCase(toScopedEnglishPhrase(stripTrailingPunctuation(selectionVi || skill?.selectionRuleTextEn || skill?.selectionRuleText || targetTextEn)));
  }
}

function normalizeLegacyCountVi(skill: Obj, id: string, targetTextVi: string): string {
  const current = normalizeSpaces(skill?.affectedCountTextVi || skill?.affectedCountText || "");
  if (/^\d+$/.test(current)) {
    const count = Number(current);
    if (/bản thân/i.test(targetTextVi)) return count === 1 ? "1 mục tiêu tự thân" : `${count} mục tiêu tự thân`;
    if (/đồng minh/i.test(targetTextVi)) return count === 1 ? "1 đồng minh" : `${count} đồng minh`;
    return count === 1 ? "1 mục tiêu" : `${count} mục tiêu`;
  }
  return current || "1 mục tiêu";
}

function normalizeLegacyCountEn(skill: Obj, id: string, countVi: string): string {
  if (/^\d+ mục tiêu tự thân$/i.test(countVi)) return countVi.replace(/^(\d+) mục tiêu tự thân$/i, "$1 self target");
  if (/^\d+ đồng minh$/i.test(countVi)) return countVi.replace(/^(\d+) đồng minh$/i, "$1 allies").replace(/^1 allies$/i, "1 ally");
  if (/^\d+ mục tiêu$/i.test(countVi)) return countVi.replace(/^(\d+) mục tiêu$/i, "$1 targets").replace(/^1 targets$/i, "1 target");
  return sentenceCase(toScopedEnglishPhrase(countVi));
}

function buildGenericPitchEn(baseData: Obj, fields: Obj, skill: Obj): string {
  const targetStr = String(fields?.targetTextEn ?? "");
  const target = targetStr || "the target";
  if (/self/i.test(target)) {
    const classTypeVal = String(baseData?.classType ?? "");
    if (classTypeVal === "TANKER") return "Fortifies self with a timed defensive effect.";
    return "Empowers self with a timed skill effect.";
  }
  if (/ally/i.test(target)) {
    const durationRuleStr = String(fields?.durationRuleTextEn ?? "");
    const effectStr = String(skill?.effect ?? "");
    if (/heal|cleanse|recover|regrow/i.test(durationRuleStr) || /heal/i.test(effectStr)) {
      return `Supports ${target} with healing and utility.`;
    }
    return `Supports ${target} with a timed buff.`;
  }
  const damageTypeVal = String(skill?.damageType ?? "").toLowerCase();
  if (damageTypeVal === "magic") return `Pressures ${target} with magic damage and skill riders.`;
  if (damageTypeVal === "physical") return `Pressures ${target} with physical damage and skill riders.`;
  return `Affects ${target} with a timed skill effect.`;
}

function buildScopedAbilityFields(skill: Obj): Obj {
  const explicitFields = readScopedAbilityExplicitFields(skill);
  if (hasUsableExplicitScopedClarityFields(explicitFields)) {
    return {
      targetTextVi: explicitFields.targetTextVi,
      targetTextEn: explicitFields.targetTextEn || toScopedEnglishPhrase(explicitFields.targetTextVi),
      shapeTextVi: explicitFields.shapeTextVi,
      shapeTextEn: explicitFields.shapeTextEn || toScopedEnglishPhrase(explicitFields.shapeTextVi),
      selectionRuleTextVi: explicitFields.selectionRuleTextVi,
      selectionRuleTextEn: explicitFields.selectionRuleTextEn || sentenceCase(toScopedEnglishPhrase(explicitFields.selectionRuleTextVi)),
      affectedCountTextVi: explicitFields.affectedCountTextVi,
      affectedCountTextEn: explicitFields.affectedCountTextEn || normalizeLegacyCountEn(skill, "", String(explicitFields.affectedCountTextVi ?? ""))
    };
  }
  const targetObj = skill?.resolvedAbilityDef && typeof skill.resolvedAbilityDef === "object" ? skill.resolvedAbilityDef as Record<string, unknown> : {};
  const target = targetObj.target && typeof targetObj.target === "object" ? targetObj.target as Record<string, unknown> : {};
  const selector = String(skill?.targetSelector ?? target?.selector ?? "");
  const shape = target?.shape && typeof target.shape === "object" ? target.shape as Record<string, unknown> : {};
  const side = String(target?.side ?? "enemy");
  const count = Number(shape?.count ?? 1) || 1;
  const maxTargets = skill?.maxTargets === Infinity
    ? Infinity
    : (Number.isFinite(Number(skill?.maxTargets)) ? Number(skill.maxTargets) : count);
  if (selector === "self" || side === "self") {
    return {
      targetTextVi: "bản thân",
      targetTextEn: "self",
      shapeTextVi: "tự thân",
      shapeTextEn: "self-centered effect",
      selectionRuleTextVi: "Chỉ ảnh hưởng bản thân.",
      selectionRuleTextEn: "Affects self only.",
      affectedCountTextVi: "1 mục tiêu tự thân",
      affectedCountTextEn: "self only"
    };
  }
  if (String(shape?.type ?? "") === "all_allies" || selector === "all") {
    return {
      targetTextVi: "toàn bộ đồng minh",
      targetTextEn: "all allies",
      shapeTextVi: "toàn vùng đội hình đồng minh",
      shapeTextEn: "the whole allied formation",
      selectionRuleTextVi: "Áp dụng cho toàn bộ đồng minh đang sống.",
      selectionRuleTextEn: "Applies to all living allies.",
      affectedCountTextVi: "toàn đội đồng minh",
      affectedCountTextEn: "the whole allied team"
    };
  }
  if (String(shape?.type ?? "") === "line") {
    return {
      targetTextVi: maxTargets === Infinity
        ? "toàn bộ kẻ địch trên hàng địch đông nhất"
        : `tối đa ${maxTargets} kẻ địch trên hàng địch đông nhất`,
      targetTextEn: maxTargets === Infinity
        ? "all enemies on the densest enemy row"
        : `up to ${maxTargets} enemies on the densest enemy row`,
      shapeTextVi: "đường thẳng xuyên theo một hàng",
      shapeTextEn: "a piercing line across one row",
      selectionRuleTextVi: "Ưu tiên hàng địch có nhiều mục tiêu nhất.",
      selectionRuleTextEn: "Prioritizes the enemy row with the most units.",
      affectedCountTextVi: maxTargets === Infinity
        ? "toàn bộ mục tiêu cùng hàng"
        : `tối đa ${maxTargets} mục tiêu cùng hàng`,
      affectedCountTextEn: maxTargets === Infinity
        ? "all targets in that row"
        : `up to ${maxTargets} targets in that row`
    };
  }
  let bareVi = side === "ally" ? "đồng minh" : "kẻ địch";
  let bareEn = side === "ally" ? "ally" : "enemy";
  if (selector === "highest_atk") {
    bareVi = side === "ally" ? "đồng minh có ATK cao nhất" : "kẻ địch có ATK cao nhất";
    bareEn = side === "ally" ? "ally with the highest ATK" : "enemy with the highest ATK";
  } else if (selector === "highest_matk") {
    const classes = Array.isArray(skill?.targetClasses) ? skill.targetClasses : [];
    if (classes.includes("MAGE") && classes.includes("SUPPORT")) {
      bareVi = "pháp sư hoặc hỗ trợ địch có MATK cao nhất";
      bareEn = "mage or support enemy with the highest MATK";
    } else {
      bareVi = side === "ally" ? "đồng minh có MATK cao nhất" : "kẻ địch có MATK cao nhất";
      bareEn = side === "ally" ? "ally with the highest MATK" : "enemy with the highest MATK";
    }
  } else if (selector === "lowest_hp_pct" || selector === "lowest_hp_pct_ally") {
    bareVi = side === "ally" ? "đồng minh có % máu thấp nhất" : "kẻ địch có % máu thấp nhất";
    bareEn = side === "ally" ? "ally with the lowest HP%" : "enemy with the lowest HP%";
  } else if (selector === "lowest_rage_ally") {
    bareVi = "đồng minh có nộ thấp nhất";
    bareEn = "ally with the lowest rage";
  }
  const targetTextVi = count === 1 ? `1 ${bareVi}` : `${count} ${bareVi}`;
  const targetTextEn = count === 1 ? `1 ${bareEn}` : `${count} ${bareEn.replace(/^ally$/i, "allies").replace(/^enemy$/i, "enemies")}`;
  const selectionRuleTextVi = selector === "highest_atk"
    ? (side === "ally" ? "Ưu tiên đồng minh có ATK cao nhất theo thứ tự." : "Ưu tiên kẻ địch có ATK cao nhất theo thứ tự.")
    : selector === "highest_matk"
      ? (bareVi === "pháp sư hoặc hỗ trợ địch có MATK cao nhất"
        ? "Ưu tiên pháp sư hoặc hỗ trợ địch có MATK cao nhất theo thứ tự."
        : (side === "ally" ? "Ưu tiên đồng minh có MATK cao nhất theo thứ tự." : "Ưu tiên kẻ địch có MATK cao nhất theo thứ tự."))
      : selector === "lowest_hp_pct" || selector === "lowest_hp_pct_ally"
        ? (side === "ally" ? "Ưu tiên đồng minh có % máu thấp nhất theo thứ tự." : "Ưu tiên kẻ địch có % máu thấp nhất theo thứ tự.")
        : selector === "lowest_rage_ally"
          ? "Ưu tiên đồng minh có nộ thấp nhất theo thứ tự."
          : "Ưu tiên theo thứ tự chỉ số đã author.";
  const selectionRuleTextEn = selector === "highest_atk"
    ? (side === "ally" ? "Prioritizes allies with the highest ATK in order." : "Prioritizes enemies with the highest ATK in order.")
    : selector === "highest_matk"
      ? (bareVi === "pháp sư hoặc hỗ trợ địch có MATK cao nhất"
        ? "Prioritizes mage or support enemies with the highest MATK in order."
        : (side === "ally" ? "Prioritizes allies with the highest MATK in order." : "Prioritizes enemies with the highest MATK in order."))
      : selector === "lowest_hp_pct" || selector === "lowest_hp_pct_ally"
        ? (side === "ally" ? "Prioritizes allies with the lowest HP% in order." : "Prioritizes enemies with the lowest HP% in order.")
        : selector === "lowest_rage_ally"
          ? "Prioritizes allies with the lowest rage in order."
          : "Follows the authored stat-based priority order.";
  return {
    targetTextVi,
    targetTextEn,
    shapeTextVi: "các mục tiêu rời theo thứ tự chỉ số",
    shapeTextEn: "separate targets selected by stat order",
    selectionRuleTextVi,
    selectionRuleTextEn,
    affectedCountTextVi: side === "ally"
      ? (count === 1 ? "1 đồng minh" : `${count} đồng minh`)
      : (count === 1 ? "1 mục tiêu" : `${count} mục tiêu`),
    affectedCountTextEn: side === "ally"
      ? (count === 1 ? "1 ally" : `${count} allies`)
      : (count === 1 ? "1 target" : `${count} targets`)
  };
}

function hasUsableExplicitScopedClarityFields(explicitFields: Obj, { requireDuration = false }: { requireDuration?: boolean } = {}): boolean {
  if (!explicitFields?.targetTextVi || !explicitFields?.shapeTextVi || !explicitFields?.selectionRuleTextVi || !explicitFields?.affectedCountTextVi) return false;
  if (hasVagueScopedText(explicitFields.targetTextVi) || hasVagueScopedText(explicitFields.shapeTextVi) || hasVagueScopedText(explicitFields.selectionRuleTextVi)) return false;
  if (requireDuration && !explicitFields?.durationRuleTextVi) return false;
  return true;
}
function readScopedAbilityExplicitFields(skill: Obj): Obj {
  const tooltipDef = asObj(skill?.tooltipDef);
  return {
    targetTextVi: normalizeSpaces(pickFirstString(skill?.targetTextVi, tooltipDef?.targetTextVi, skill?.targetText)),
    targetTextEn: normalizeSpaces(pickFirstString(
      typeof skill?.targetTextEn === "string" && !looksVietnamese(skill.targetTextEn) ? skill.targetTextEn : "",
      typeof tooltipDef?.targetTextEn === "string" && !looksVietnamese(tooltipDef.targetTextEn) ? tooltipDef.targetTextEn : ""
    )),
    shapeTextVi: normalizeSpaces(pickFirstString(skill?.shapeTextVi, tooltipDef?.shapeTextVi, skill?.shapeText)),
    shapeTextEn: normalizeSpaces(pickFirstString(
      typeof skill?.shapeTextEn === "string" && !looksVietnamese(skill.shapeTextEn) ? skill.shapeTextEn : "",
      typeof tooltipDef?.shapeTextEn === "string" && !looksVietnamese(tooltipDef.shapeTextEn) ? tooltipDef.shapeTextEn : ""
    )),
    selectionRuleTextVi: normalizeSpaces(pickFirstString(skill?.selectionRuleTextVi, tooltipDef?.selectionRuleTextVi, skill?.selectionRuleText)),
    selectionRuleTextEn: normalizeSpaces(pickFirstString(
      typeof skill?.selectionRuleTextEn === "string" && !looksVietnamese(skill.selectionRuleTextEn) ? skill.selectionRuleTextEn : "",
      typeof tooltipDef?.selectionRuleTextEn === "string" && !looksVietnamese(tooltipDef.selectionRuleTextEn) ? tooltipDef.selectionRuleTextEn : ""
    )),
    affectedCountTextVi: normalizeSpaces(pickFirstString(skill?.affectedCountTextVi, tooltipDef?.affectedCountTextVi, skill?.affectedCountText)),
    affectedCountTextEn: normalizeSpaces(pickFirstString(
      typeof skill?.affectedCountTextEn === "string" && !looksVietnamese(skill.affectedCountTextEn) ? skill.affectedCountTextEn : "",
      typeof tooltipDef?.affectedCountTextEn === "string" && !looksVietnamese(tooltipDef.affectedCountTextEn) ? tooltipDef.affectedCountTextEn : ""
    )),
    durationRuleTextVi: stripTrailingPunctuation(pickFirstString(skill?.durationRuleTextVi, skill?.durationRuleText)),
    durationRuleTextEn: normalizeSpaces(pickFirstString(
      typeof skill?.durationRuleTextEn === "string" && !looksVietnamese(skill.durationRuleTextEn) ? skill.durationRuleTextEn : "",
      typeof tooltipDef?.durationRuleTextEn === "string" && !looksVietnamese(tooltipDef.durationRuleTextEn) ? tooltipDef.durationRuleTextEn : ""
    ))
  };
}
function readScopedLegacyExplicitFields(skill: Obj): Obj {
  const tooltipDef = asObj(skill?.tooltipDef);
  return {
    targetTextVi: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "targetText", { locale: "vi" }), skill?.targetTextVi, skill?.targetText)),
    targetTextEn: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "targetText", { locale: "en", allowBase: false, allowCrossLocale: false }), typeof skill?.targetTextEn === "string" && !looksVietnamese(skill.targetTextEn) ? skill.targetTextEn : "")),
    shapeTextVi: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "shapeText", { locale: "vi" }), skill?.shapeTextVi, skill?.shapeText)),
    shapeTextEn: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "shapeText", { locale: "en", allowBase: false, allowCrossLocale: false }), typeof skill?.shapeTextEn === "string" && !looksVietnamese(skill.shapeTextEn) ? skill.shapeTextEn : "")),
    selectionRuleTextVi: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "vi" }), skill?.selectionRuleTextVi, skill?.selectionRuleText)),
    selectionRuleTextEn: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }), typeof skill?.selectionRuleTextEn === "string" && !looksVietnamese(skill.selectionRuleTextEn) ? skill.selectionRuleTextEn : "")),
    affectedCountTextVi: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "affectedCountText", { locale: "vi" }), skill?.affectedCountTextVi, skill?.affectedCountText)),
    affectedCountTextEn: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "affectedCountText", { locale: "en", allowBase: false, allowCrossLocale: false }), typeof skill?.affectedCountTextEn === "string" && !looksVietnamese(skill.affectedCountTextEn) ? skill.affectedCountTextEn : "")),
    durationRuleTextVi: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "durationRuleText", { locale: "vi" }), skill?.durationRuleTextVi, skill?.durationRuleText)),
    durationRuleTextEn: normalizeSpaces(pickFirstString(resolveLocaleField(tooltipDef, "durationRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }), typeof skill?.durationRuleTextEn === "string" && !looksVietnamese(skill.durationRuleTextEn) ? skill.durationRuleTextEn : ""))
  };
}
function buildScopedLegacyFields(baseData: Obj, skill: Obj) {
  const id = String(baseData?.id ?? "");
  const explicitFields = readScopedLegacyExplicitFields(skill);
  if (hasUsableExplicitScopedClarityFields(explicitFields, { requireDuration: true })) {
    return {
      targetTextVi: explicitFields.targetTextVi,
      targetTextEn: explicitFields.targetTextEn || toScopedEnglishPhrase(explicitFields.targetTextVi),
      shapeTextVi: explicitFields.shapeTextVi,
      shapeTextEn: explicitFields.shapeTextEn,
      selectionRuleTextVi: explicitFields.selectionRuleTextVi,
      selectionRuleTextEn: explicitFields.selectionRuleTextEn || sentenceCase(toScopedEnglishPhrase(explicitFields.selectionRuleTextVi)),
      affectedCountTextVi: explicitFields.affectedCountTextVi,
      affectedCountTextEn: explicitFields.affectedCountTextEn || normalizeLegacyCountEn(skill, id, String(explicitFields.affectedCountTextVi ?? "")),
      durationRuleTextVi: explicitFields.durationRuleTextVi,
      durationRuleTextEn: explicitFields.durationRuleTextEn || toScopedEnglishPhrase(explicitFields.durationRuleTextVi)
    };
  }
  const targetTextVi = id === "newt_fire"
    ? "tâm cụm địch đông nhất"
    : normalizeSpaces(skill?.targetTextVi ?? skill?.targetText ?? "1 mục tiêu");
  const shapeTextVi = id === "jellyfish_shock"
    ? "chuỗi chớp nảy không trùng mục tiêu"
    : id === "newt_fire"
      ? "vùng vuông 3x3 quanh điểm rơi"
      : normalizeSpaces(skill?.shapeTextVi ?? skill?.shapeText ?? "1 ô điểm");
  const selectionRuleTextVi = id === "jellyfish_shock"
    ? "Ưu tiên lần lượt các kẻ địch có nộ cao nhất."
    : id === "newt_fire"
      ? "Chọn tâm cụm địch có nhiều mục tiêu nhất."
      : normalizeLegacySelectionVi(skill, id, targetTextVi);
  const affectedCountTextVi = id === "jellyfish_shock"
    ? `${Number(skill?.maxHits ?? 2)} lần nảy không trùng mục tiêu`
    : id === "newt_fire"
      ? "vùng vuông 3x3"
      : normalizeLegacyCountVi(skill, id, targetTextVi);
  const durationRuleTextVi = id === "jellyfish_shock"
    ? `tức thì; lần nảy sau còn 80% lần nảy trước${Number(skill?.rageDrainFirstTarget ?? 0) > 0 ? "; mục tiêu đầu mất 1 nộ" : ""}`
    : stripTrailingPunctuation(skill?.durationRuleTextVi ?? skill?.durationRuleText ?? "tức thì");
  const targetTextEn = id === "jellyfish_shock"
    ? `${Number(skill?.maxHits ?? 2)} highest-rage enemies`
    : id === "newt_fire"
      ? "the center of the densest enemy cluster"
      : normalizeSpaces(skill?.targetTextEn && !looksVietnamese(skill.targetTextEn) ? skill.targetTextEn : toScopedEnglishPhrase(targetTextVi));
  const shapeTextEn = id === "jellyfish_shock"
    ? "a lightning chain with unique targets"
    : id === "newt_fire"
      ? "a 3x3 square around the impact tile"
      : normalizeSpaces(skill?.shapeTextEn && !looksVietnamese(skill.shapeTextEn) ? skill.shapeTextEn : toScopedEnglishPhrase(shapeTextVi));
  const selectionRuleTextEn = id === "jellyfish_shock"
    ? "Prioritizes the highest-rage enemies in order."
    : id === "newt_fire"
      ? "Selects the center of the enemy cluster with the most units."
      : normalizeLegacySelectionEn(skill, id, targetTextEn, selectionRuleTextVi);
  const affectedCountTextEn = id === "jellyfish_shock"
    ? `${Number(skill?.maxHits ?? 2)} unique bounces`
    : id === "newt_fire"
      ? "a 3x3 square"
      : normalizeLegacyCountEn(skill, id, affectedCountTextVi);
  const durationRuleTextEn = id === "jellyfish_shock"
    ? `instant; each later bounce keeps 80% of the previous hit${Number(skill?.rageDrainFirstTarget ?? 0) > 0 ? "; the first target loses 1 rage" : ""}`
    : id === "newt_fire"
      ? `burn ${Number(skill?.burnTurns ?? 3)} turns${Number(skill?.offenseDebuffTurns ?? skill?.atkDebuffTurns ?? 0) > 0 ? `; MATK down ${Number(skill?.offenseDebuffTurns ?? skill?.atkDebuffTurns ?? 0)} turns` : ""}`
      : toScopedEnglishPhrase(durationRuleTextVi);
  return {
    targetTextVi,
    targetTextEn,
    shapeTextVi,
    shapeTextEn,
    selectionRuleTextVi,
    selectionRuleTextEn,
    affectedCountTextVi,
    affectedCountTextEn,
    durationRuleTextVi,
    durationRuleTextEn
  };
}

function lowerFirstScoped(text: unknown) {
  const value = normalizeSpaces(text);
  if (!value) return "";
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function startsWithAny(text: unknown, prefixes: string[] = []) {
  const value = normalizeSpaces(text).toLowerCase();
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function buildSelectionClause(text: unknown, locale = "vi") {
  const value = stripTrailingPunctuation(text);
  if (!value) return "";
  if (locale === "vi") {
    if (startsWithAny(value, ["ưu tiên", "chọn", "chỉ", "áp dụng", "nhắm", "theo"])) {
      return ensureSentence(value);
    }
    return ensureSentence(`Ưu tiên ${lowerFirstScoped(value)}`);
  }
  if (startsWithAny(value, ["prioritizes", "selects", "affects", "targets", "follows", "hits", "applies"])) {
    return ensureSentence(value);
  }
  return ensureSentence(`Prioritizes ${lowerFirstScoped(value)}`);
}

function isInstantDuration(text: unknown, locale = "vi") {
  const value = normalizeSpaces(text).toLowerCase();
  if (!value) return true;
  return locale === "vi" ? value === "tức thì" : value === "instant";
}

function isRedundantCoverageClause(targetText: unknown, affectedCountText: unknown) {
  const target = normalizeSpaces(targetText).toLowerCase();
  const count = normalizeSpaces(affectedCountText).toLowerCase();
  if (!target || !count) return true;
  if (target === count) return true;
  const numericTarget = target.match(/^(\d+)/)?.[1];
  const numericCount = count.match(/^(\d+)/)?.[1];
  return Boolean(numericTarget && numericCount && numericTarget === numericCount);
}

function buildGenericScopedDetail({
  leadVi,
  leadEn,
  statClauseVi = "",
  statClauseEn = "",
  fields
}: {
  leadVi: string;
  leadEn: string;
  statClauseVi?: string;
  statClauseEn?: string;
  fields: Obj;
}) {
  const targetClauseVi = fields.targetTextVi ? `Nhắm ${lowerFirstScoped(fields.targetTextVi)}.` : "";
  const targetClauseEn = fields.targetTextEn ? `Targets ${lowerFirstScoped(fields.targetTextEn)}.` : "";
  const shapeClauseVi = fields.shapeTextVi ? `Tung theo dạng ${lowerFirstScoped(fields.shapeTextVi)}.` : "";
  const shapeClauseEn = fields.shapeTextEn ? `Uses ${lowerFirstScoped(fields.shapeTextEn)}.` : "";
  const coverageClauseVi = !isRedundantCoverageClause(fields.targetTextVi, fields.affectedCountTextVi)
    ? `Ảnh hưởng ${lowerFirstScoped(fields.affectedCountTextVi)}.`
    : "";
  const coverageClauseEn = !isRedundantCoverageClause(fields.targetTextEn, fields.affectedCountTextEn)
    ? `Coverage ${lowerFirstScoped(fields.affectedCountTextEn)}.`
    : "";
  const durationClauseVi = !isInstantDuration(fields.durationRuleTextVi, "vi")
    ? `Hiệu lực ${lowerFirstScoped(fields.durationRuleTextVi)}.`
    : "";
  const durationClauseEn = !isInstantDuration(fields.durationRuleTextEn, "en")
    ? `Duration ${lowerFirstScoped(fields.durationRuleTextEn)}.`
    : "";
  return {
    vi: normalizeSpaces([
      ensureSentence(leadVi),
      statClauseVi ? `Chỉ số hiệu ứng: ${statClauseVi}.` : "",
      targetClauseVi,
      shapeClauseVi,
      buildSelectionClause(fields.selectionRuleTextVi, "vi"),
      coverageClauseVi,
      durationClauseVi
    ].filter(Boolean).join(" ")),
    en: normalizeSpaces([
      ensureSentence(leadEn),
      statClauseEn ? `Effect values: ${statClauseEn}.` : "",
      targetClauseEn,
      shapeClauseEn,
      buildSelectionClause(fields.selectionRuleTextEn, "en"),
      coverageClauseEn,
      durationClauseEn
    ].filter(Boolean).join(" "))
  };
}

function buildCanonicalScopedDetail(baseData: Obj, skill: Obj, fields: Obj, star: number, pitchVi: string, pitchEn: string, statClauseVi: string, statClauseEn: string) {
  const effect = String(skill?.effect ?? "");
  const scalePct = Math.round(Number(skill?.scale ?? 0) * 100);
  const base = Number(skill?.base ?? 0);
  const maxTargets = Number.isFinite(Number(skill?.maxTargets)) ? Math.round(Number(skill.maxTargets)) : null;
  const formatFormulaVi = () => (base || scalePct) ? `(${base} + ${scalePct}% ${String(skill?.scaleStat ?? "atk").toUpperCase()})` : "";
  const formatFormulaEn = () => (base || scalePct) ? `(${base} + ${scalePct}% ${String(skill?.scaleStat ?? "atk").toUpperCase()})` : "";
  const formulaVi = formatFormulaVi();
  const formulaEn = formatFormulaEn();
  const poisonClauseVi = Number(skill?.poisonPerTurn ?? 0) > 0
    ? `nhiễm độc ${Number(skill.poisonPerTurn)} mỗi lượt trong ${Number(skill.poisonTurns ?? 2)} lượt`
    : "";
  const poisonClauseEn = Number(skill?.poisonPerTurn ?? 0) > 0
    ? `poisons for ${Number(skill.poisonPerTurn)} per turn over ${Number(skill.poisonTurns ?? 2)} turns`
    : "";
  const burnClauseVi = Number(skill?.burnPerTurn ?? 0) > 0
    ? `thiêu đốt ${Number(skill.burnPerTurn)} mỗi lượt trong ${Number(skill.burnTurns ?? 2)} lượt`
    : "";
  const burnClauseEn = Number(skill?.burnPerTurn ?? 0) > 0
    ? `burns for ${Number(skill.burnPerTurn)} per turn over ${Number(skill.burnTurns ?? 2)} turns`
    : "";

  if (baseData?.id === "jellyfish_shock") {
    const hits = Number(skill?.maxHits ?? 2);
    const rageClauseVi = Number(skill?.rageDrainFirstTarget ?? 0) > 0 ? " Mục tiêu đầu mất 1 nộ." : "";
    const rageClauseEn = Number(skill?.rageDrainFirstTarget ?? 0) > 0 ? " The first target loses 1 rage." : "";
    return {
      vi: `Phóng chuỗi điện qua ${hits} kẻ địch nhiều nộ nhất. Mục tiêu đầu chịu ${formulaVi} sát thương phép, mỗi lần nảy sau còn 80% lần trước.${rageClauseVi}`,
      en: `Launches a lightning chain through ${hits} highest-rage enemies. The first target takes ${formulaEn} magic damage, and each later bounce keeps 80% of the previous hit.${rageClauseEn}`
    };
  }

  if (baseData?.id === "newt_fire" || effect === "fireball_burn") {
    const debuffValue = Number(skill?.offenseDebuffValue ?? skill?.atkDebuffValue ?? 0) || 0;
    const debuffTurns = Number(skill?.offenseDebuffTurns ?? skill?.atkDebuffTurns ?? 0) || 0;
    const debuffClauseVi = debuffValue > 0 && debuffTurns > 0
      ? ` Pháp sư và hỗ trợ trúng đòn bị giảm ${debuffValue} MATK trong ${debuffTurns} lượt.`
      : "";
    const debuffClauseEn = debuffValue > 0 && debuffTurns > 0
      ? ` Mage and support targets hit lose ${debuffValue} MATK for ${debuffTurns} turns.`
      : "";
    return {
      vi: `Ném cầu lửa vào tâm cụm địch đông nhất, gây ${formulaVi} sát thương phép trong vùng vuông 3x3 quanh điểm rơi. Mục tiêu trúng đòn bị ${burnClauseVi}.${debuffClauseVi}`,
      en: `Throws a fireball at the center of the densest enemy cluster, dealing ${formulaEn} magic damage in a 3x3 square around the impact tile. Targets hit ${burnClauseEn}.${debuffClauseEn}`
    };
  }

  if (baseData?.id === "kirin_thunder" || effect === "global_stun") {
    const stunCount = Number(skill?.stunMaxTargets ?? 0) || 0;
    return {
      vi: `Triệu hồi sét trời giáng xuống toàn bộ kẻ địch, gây ${formulaVi} sát thương phép trên toàn bàn và choáng tối đa ${stunCount} kẻ địch có nộ cao nhất.`,
      en: `Calls down lightning on all enemies, dealing ${formulaEn} magic damage across the whole board and stunning up to ${stunCount} highest-rage enemies.`
    };
  }

  if (baseData?.id === "falcon_dive" || effect === "piercing_shot") {
    const burnChancePct = Math.round(Number(skill?.burnChance ?? 0) * 100);
    const targetCapVi = skill?.maxTargets === Infinity
      ? "Xuyên không giới hạn mục tiêu."
      : `Xuyên tối đa ${Number(skill?.maxTargets ?? 2)} mục tiêu.`;
    const targetCapEn = skill?.maxTargets === Infinity
      ? "Pierces every target in that row."
      : `Pierces up to ${Number(skill?.maxTargets ?? 2)} targets.`;
    const burnChanceClauseVi = burnChancePct > 0
      ? ` Có ${burnChancePct}% gây ${burnClauseVi}.`
      : "";
    const burnChanceClauseEn = burnChancePct > 0
      ? ` Has ${burnChancePct}% chance to ${burnClauseEn}.`
      : "";
    const vulnerabilityClauseVi = Number(skill?.fireVulnerabilityHitThreshold ?? 0) >= 3
      ? ` Nếu xuyên từ ${Number(skill.fireVulnerabilityHitThreshold)} mục tiêu trở lên, các mục tiêu trúng đòn nhận gấp ${Number(skill.fireVulnerabilityMultiplier ?? 2)} sát thương lửa trong ${Number(skill.fireVulnerabilityTurns ?? 2)} lượt.`
      : "";
    const vulnerabilityClauseEn = Number(skill?.fireVulnerabilityHitThreshold ?? 0) >= 3
      ? ` If it pierces ${Number(skill.fireVulnerabilityHitThreshold)} or more targets, affected enemies take ${Number(skill.fireVulnerabilityMultiplier ?? 2)}x fire damage for ${Number(skill.fireVulnerabilityTurns ?? 2)} turns.`
      : "";
    return {
      vi: `Phóng lao xuyên hàng địch đông nhất, mỗi mục tiêu sau chịu ít sát thương hơn mục tiêu trước. Gây ${formulaVi} sát thương vật lý. ${targetCapVi}${burnChanceClauseVi}${vulnerabilityClauseVi}`,
      en: `Throws a spear through the densest enemy row and each later target takes less damage than the previous one. Deals ${formulaEn} physical damage. ${targetCapEn}${burnChanceClauseEn}${vulnerabilityClauseEn}`
    };
  }

  if (effect === "light_purify") {
    const healClauseVi = Number(skill?.healBase ?? 0) > 0
      ? `hồi ${Number(skill.healBase)} HP mỗi mục tiêu`
      : Number(skill?.healPctMaxHp ?? 0) > 0
        ? `hồi ${Math.round(Number(skill.healPctMaxHp) * 100)}% HP tối đa mỗi mục tiêu`
        : "hồi máu mỗi mục tiêu";
    const healClauseEn = Number(skill?.healBase ?? 0) > 0
      ? `heals ${Number(skill.healBase)} HP per target`
      : Number(skill?.healPctMaxHp ?? 0) > 0
        ? `heals ${Math.round(Number(skill.healPctMaxHp) * 100)}% max HP per target`
        : "heals each target";
    const shieldClauseVi = Number(skill?.shieldBase ?? 0) > 0
      ? ` và tạo ${Number(skill.shieldBase)} khiên mỗi mục tiêu`
      : "";
    const shieldClauseEn = Number(skill?.shieldBase ?? 0) > 0
      ? ` and grants ${Number(skill.shieldBase)} shield to each target`
      : "";
    return {
      vi: `Thanh tẩy ${Number(skill?.cleanseCount ?? 1)} debuff cho ${maxTargets ?? 1} đồng minh có % máu thấp nhất, ${healClauseVi}${shieldClauseVi}.`,
      en: `Cleanses ${Number(skill?.cleanseCount ?? 1)} debuffs from the ${maxTargets ?? 1} allies with the lowest HP% and ${healClauseEn}${shieldClauseEn}.`
    };
  }

  if (effect === "heal_over_time") {
    const rageClauseVi = Number(skill?.rageGrantToWeakest ?? 0) > 0
      ? ` Đồng minh có % máu thấp nhất trong nhóm, nếu còn dưới ${Math.round(Number(skill?.rageGrantHpBelowPct ?? 0) * 100)}% máu, nhận thêm ${Number(skill.rageGrantToWeakest)} nộ.`
      : "";
    const rageClauseEn = Number(skill?.rageGrantToWeakest ?? 0) > 0
      ? ` The weakest target in that group gains ${Number(skill.rageGrantToWeakest)} rage if still below ${Math.round(Number(skill?.rageGrantHpBelowPct ?? 0) * 100)}% HP.`
      : "";
    return {
      vi: `Hồi dần ${Math.round(Number(skill?.hotPctMaxHp ?? 0) * 100)}% HP tối đa trong ${Number(skill?.hotTurns ?? skill?.turns ?? 2)} lượt cho ${maxTargets ?? 1} đồng minh có % máu thấp nhất.${rageClauseVi}`,
      en: `Restores ${Math.round(Number(skill?.hotPctMaxHp ?? 0) * 100)}% max HP over ${Number(skill?.hotTurns ?? skill?.turns ?? 2)} turns to the ${maxTargets ?? 1} allies with the lowest HP%.${rageClauseEn}`
    };
  }

  if (effect === "multi_sting_poison") {
    const hits = Number(skill?.maxHits ?? 2);
    return {
      vi: `Phóng ${hits} kim độc vào ${hits} kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi kim gây ${formulaVi} sát thương vật lý và ${poisonClauseVi}.`,
      en: `Fires ${hits} venom stings at ${hits} random unique enemies. Each sting deals ${formulaEn} physical damage and ${poisonClauseEn}.`
    };
  }

  if (effect === "arrow_rain") {
    const hits = Number(skill?.maxHits ?? 4);
    const bonusClauseVi = skill?.bonusTargetSelector ? " Sau đó bắn thêm 1 mũi vào kẻ địch có nộ cao nhất." : "";
    const bonusClauseEn = skill?.bonusTargetSelector ? " Then fires 1 extra arrow at the highest-rage enemy." : "";
    return {
      vi: `Bắn ${hits} mũi tên vào ${hits} kẻ địch được chọn theo thứ tự ưu tiên, mỗi mũi gây ${formulaVi} sát thương vật lý.${bonusClauseVi}`,
      en: `Fires ${hits} arrows at ${hits} enemies chosen by the authored priority, and each arrow deals ${formulaEn} physical damage.${bonusClauseEn}`
    };
  }

  if (effect === "self_def_fortify") {
    const tauntClauseVi = Number(skill?.tauntTurns ?? 0) > 0 ? ` Sau đó khiêu khích trong ${Number(skill.tauntTurns)} lượt.` : "";
    const tauntClauseEn = Number(skill?.tauntTurns ?? 0) > 0 ? ` It then taunts for ${Number(skill.tauntTurns)} turn${Number(skill.tauntTurns) > 1 ? "s" : ""}.` : "";
    return {
      vi: `Tự tăng ${Number(skill?.armorBuff ?? 0)} DEF và ${Number(skill?.mdefBuff ?? 0)} MDEF trong ${Number(skill?.turns ?? 2)} lượt, đồng thời giảm ${Math.round(Number(skill?.damageReductionPct ?? 0) * 100)}% sát thương từ đòn kế tiếp.${tauntClauseVi}`,
      en: `Raises self DEF by ${Number(skill?.armorBuff ?? 0)} and MDEF by ${Number(skill?.mdefBuff ?? 0)} for ${Number(skill?.turns ?? 2)} turns, while reducing the next hit by ${Math.round(Number(skill?.damageReductionPct ?? 0) * 100)}%.${tauntClauseEn}`
    };
  }

  if (effect === "aoe_poison") {
    return {
      vi: `Rải bào tử độc vào ${fields.targetTextVi}, gây ${formulaVi} sát thương phép và ${poisonClauseVi}.`,
      en: `Spreads toxic spores over ${fields.targetTextEn}, dealing ${formulaEn} magic damage and ${poisonClauseEn}.`
    };
  }

  if (effect === "fire_breath_cone" && baseData?.id === "salamander_flame") {
    return {
      vi: `Phun lửa theo ${fields.shapeTextVi}, gây ${formulaVi} sát thương phép và ${burnClauseVi}.`,
      en: `Breathes fire in ${fields.shapeTextEn}, dealing ${formulaEn} magic damage and ${burnClauseEn}.`
    };
  }

  if (effect === "global_fire" || baseData?.id === "chimera_flame" || baseData?.id === "dragon_breath") {
    const diseaseClauseVi = Number(skill?.diseaseTurns ?? 0) > 0 ? ` Mục tiêu trúng đòn còn mắc bệnh ${Number(skill?.diseaseDamage ?? 0)} mỗi lượt trong ${Number(skill?.diseaseTurns ?? 0)} lượt.` : "";
    const diseaseClauseEn = Number(skill?.diseaseTurns ?? 0) > 0 ? ` Targets hit also suffer disease for ${Number(skill?.diseaseDamage ?? 0)} per turn over ${Number(skill?.diseaseTurns ?? 0)} turns.` : "";
    return {
      vi: `Thiêu toàn bộ kẻ địch, gây ${formulaVi} sát thương phép và ${burnClauseVi}.${diseaseClauseVi}`,
      en: `Scorches all enemies, dealing ${formulaEn} magic damage and ${burnClauseEn}.${diseaseClauseEn}`
    };
  }

  if (effect === "fire_breath_cone") {
    return {
      vi: `Phun lửa về phía trước, gây ${formulaVi} sát thương phép và ${burnClauseVi}.`,
      en: `Breathes fire forward, dealing ${formulaEn} magic damage and ${burnClauseEn}.`
    };
  }

  return buildGenericScopedDetail({
    leadVi: pitchVi,
    leadEn: pitchEn,
    statClauseVi,
    statClauseEn,
    fields
  });
}

function shouldKeepAuthoredScopedDetail(baseData: Obj, skill: Obj, pitchVi: string) {
  const id = String(baseData?.id ?? "");
  if (SCOPED_FORCE_CANONICAL_DETAIL_IDS.has(id)) return false;
  const detailVi = normalizeSpaces(skill?.detailTextVi ?? skill?.detailText ?? "");
  if (!detailVi) return false;
  if (normalizeSpaces(detailVi).toLowerCase() === normalizeSpaces(pitchVi).toLowerCase()) return false;
  if (hasVagueScopedText(detailVi)) return false;
  if (/(ở sao cao|theo sao)/i.test(detailVi)) return false;
  return /\d|%/.test(detailVi)
    || /(ATK|MATK|DEF|MDEF|HP|nộ|lượt|mục tiêu|đồng minh|kẻ địch|ô|hàng|cột|vuông|nón|khiên|choáng|chảy máu|thiêu đốt|nhiễm độc|bệnh)/i.test(detailVi);
}

function normalizeScopedShopSkillText(baseData: Obj, resolvedSkill: Obj, star = 1) {
  if (!resolvedSkill || !isScopedShopSkillRewriteUnit(baseData)) return resolvedSkill;
  const id = String(baseData?.id ?? "");
  const skill = { ...resolvedSkill };
  const explicitFields = baseData?.abilityDef
    ? readScopedAbilityExplicitFields(skill)
    : readScopedLegacyExplicitFields(skill);
  const usesGeneratedScopedFields = !hasUsableExplicitScopedClarityFields(explicitFields, { requireDuration: true });
  const fields = baseData?.abilityDef
    ? {
        ...buildScopedAbilityFields(skill),
        durationRuleTextVi: stripTrailingPunctuation(skill?.durationRuleTextVi ?? skill?.durationRuleText ?? "tức thì"),
        durationRuleTextEn: normalizeSpaces(
          skill?.durationRuleTextEn && !looksVietnamese(skill.durationRuleTextEn)
            ? skill.durationRuleTextEn
            : toScopedEnglishPhrase(stripTrailingPunctuation(skill?.durationRuleTextVi ?? skill?.durationRuleText ?? "tức thì"))
        )
      }
    : buildScopedLegacyFields(baseData, skill);
  const pitchVi = stripTrailingPunctuation(
    (SCOPED_CUSTOM_PITCH_VI as Record<string, string>)[id]
    ?? firstSentence(baseData?.descriptionVi || skill?.descriptionVi || skill?.detailTextVi || baseData?.name || skill?.name)
  );
  const pitchEn = stripTrailingPunctuation(
    (SCOPED_CUSTOM_PITCH_EN as Record<string, string>)[id]
    ?? (baseData?.descriptionEn && !looksVietnamese(baseData.descriptionEn)
      ? firstSentence(baseData.descriptionEn)
      : buildGenericPitchEn(baseData, fields, skill))
  );
  const statClauseVi = buildScopedStatClause(skill, star, "vi");
  const statClauseEn = buildScopedStatClause(skill, star, "en");
  const canonicalDetail = buildCanonicalScopedDetail(
    baseData,
    skill,
    fields,
    star,
    pitchVi,
    pitchEn,
    statClauseVi,
    statClauseEn
  );
  const useAuthoredDetail = shouldKeepAuthoredScopedDetail(baseData, skill, pitchVi);
  const detailTextVi = useAuthoredDetail
    ? normalizeSpaces(skill?.detailTextVi ?? skill?.detailText ?? canonicalDetail.vi)
    : canonicalDetail.vi;
  const detailTextEn = useAuthoredDetail
    ? normalizeSpaces(skill?.detailTextEn && !looksVietnamese(skill.detailTextEn) ? skill.detailTextEn : canonicalDetail.en)
    : canonicalDetail.en;
  const nextSkill = {
    ...skill,
    descriptionVi: pitchVi,
    descriptionEn: pitchEn,
    summaryTextVi: pitchVi,
    summaryTextEn: pitchEn,
    detailTextVi,
    detailTextEn,
    targetText: String((fields as Obj).targetTextVi ?? ""),
    targetTextVi: String((fields as Obj).targetTextVi ?? ""),
    targetTextEn: String((fields as Obj).targetTextEn ?? ""),
    shapeText: String((fields as Obj).shapeTextVi ?? ""),
    shapeTextVi: String((fields as Obj).shapeTextVi ?? ""),
    shapeTextEn: String((fields as Obj).shapeTextEn ?? ""),
    selectionRuleText: String((fields as Obj).selectionRuleTextVi ?? ""),
    selectionRuleTextVi: String((fields as Obj).selectionRuleTextVi ?? ""),
    selectionRuleTextEn: String((fields as Obj).selectionRuleTextEn ?? ""),
    affectedCountText: String((fields as Obj).affectedCountTextVi ?? ""),
    affectedCountTextVi: String((fields as Obj).affectedCountTextVi ?? ""),
    affectedCountTextEn: String((fields as Obj).affectedCountTextEn ?? ""),
    durationRuleText: fields.durationRuleTextVi,
    durationRuleTextVi: fields.durationRuleTextVi,
    durationRuleTextEn: fields.durationRuleTextEn,
    __usesGeneratedScopedDetail: !useAuthoredDetail,
    __usesGeneratedScopedFields: usesGeneratedScopedFields
  };
  return nextSkill;
}

function hasLocaleTooltipText(source: Obj, baseField: string, locale = "vi") {
  return Boolean(resolveLocaleField(source, baseField, {
    locale,
    allowBase: locale !== "en",
    allowCrossLocale: locale !== "en"
  }));
}

function validateAttackTooltipAuthoring(data: Obj, options: Obj = {}) {
  const archived = Boolean(options.archived);
  if (!data?.attackDef || !data?.abilityDef) return [];
  const issues = [];
  const tooltipDef = data.attackDef && typeof data.attackDef === "object" ? (data.attackDef as Record<string, unknown>).tooltipDef ?? {} : {};
  const tooltipDefObj = tooltipDef && typeof tooltipDef === "object" ? tooltipDef : {};
  if ("deliveryTextVi" in tooltipDefObj || "deliveryTextEn" in tooltipDefObj) {
    issues.push("deprecated attackDef.tooltipDef.deliveryText*");
  }
  const requiredFields = [
    ["summaryText", "summaryTextVi", "vi"],
    ["summaryText", "summaryTextEn", "en"],
    ["castTypeText", "castTypeTextVi", "vi"],
    ["castTypeText", "castTypeTextEn", "en"],
    ["targetText", "targetTextVi", "vi"],
    ["targetText", "targetTextEn", "en"],
    ["shapeText", "shapeTextVi", "vi"],
    ["shapeText", "shapeTextEn", "en"],
    ["selectionRuleText", "selectionRuleTextVi", "vi"],
    ["selectionRuleText", "selectionRuleTextEn", "en"],
    ["affectedCountText", "affectedCountTextVi", "vi"],
    ["affectedCountText", "affectedCountTextEn", "en"]
  ];
  requiredFields.forEach(([baseField, label, locale]) => {
    if (!hasLocaleTooltipText(tooltipDefObj as Obj, String(baseField), String(locale))) {
      issues.push(`missing attackDef.tooltipDef.${label}`);
    }
  });
  return issues;
}

function validateV3UnitSchema(data: Obj, options: Obj = {}) {
  const issues = [];
  const isSupportOrTanker = data?.classType === "SUPPORT" || data?.classType === "TANKER";
  if (!data?.abilityDef) {
    if (isSupportOrTanker && shouldEnforceV3Schema(data, options)) {
      issues.push("legacy support/tanker missing abilityDef");
    }
    return issues;
  }
  if (!data.attackDef) issues.push("missing attackDef");
  const abilityDefObj = data.abilityDef && typeof data.abilityDef === "object" ? data.abilityDef as Record<string, unknown> : {};
  if (!abilityDefObj.key) issues.push("missing abilityDef.key");
  if (!abilityDefObj.starMods) issues.push("missing abilityDef.starMods");
  if (isSupportOrTanker && !Array.isArray(abilityDefObj.tooltipDef && typeof abilityDefObj.tooltipDef === "object" ? (abilityDefObj.tooltipDef as Record<string, unknown>).statRows : undefined)) {
    issues.push("missing tooltipDef.statRows");
  }
  issues.push(...validateAttackTooltipAuthoring(data, options));
  return issues;
}

function shouldEnforceV3Schema(data: Obj, options: Obj = {}) {
  const archived = Boolean(options.archived);
  const isSupportOrTanker = data?.classType === "SUPPORT" || data?.classType === "TANKER";
  if (isSupportOrTanker && Number(data?.tier) <= 2) return true;
  return Boolean(data?.attackDef && data?.abilityDef);
}

function assertV3MigrationGuard(data: Obj, issues: string[], options: Obj = {}) {
  if (!shouldEnforceV3Schema(data, options)) return;
  if (!issues.length) return;
  throw new Error(`[V3 Unit Guard] ${data?.id || "unknown"} must keep V3 attack/skill authoring complete (${issues.join(", ")})`);
}

function warnV3Issues(data: Obj, options: Obj = {}) {
  const issues = validateV3UnitSchema(data, options);
  assertV3MigrationGuard(data, issues, options);
  if (!import.meta.env?.DEV || import.meta.env?.MODE === "test") return;
  if (!issues.length) return;
  console.warn(`[V3 Unit Warning] ${data?.id || "unknown"} -> ${issues.join(", ")}`);
}

function normalizeAttackDef(data: Obj): Obj | null {
  if (!data?.attackDef) return null;
  const attackDefSrc = data.attackDef as Record<string, unknown>;
  const attackDef = cloneDeep(attackDefSrc) as Record<string, unknown>;
  attackDef.tooltipModel = sanitizeVietnameseFieldMap(buildAttackTooltipModel(attackDefSrc as Obj, data));
  attackDef.metricsByStar = (attackDef.tooltipModel as Record<string, unknown>).metricsByStar;
  attackDef.target = attackDef.target ?? {
    side: "enemy",
    selector: data?.stats && typeof data.stats === "object" && (data.stats as Record<string, unknown>).range && Number((data.stats as Record<string, unknown>).range) >= 2 ? "front" : "nearest",
    shape: { type: "single", count: 1 }
  };
  return attackDef as Obj;
}

function normalizeAbilityDefToRuntimeSkill(data: Obj, star = 1): Obj | null {
  const authoredAbilityDef = data?.abilityDef;
  const abilityDef = authoredAbilityDef ? resolveAbilityForStar(authoredAbilityDef as Obj, star) : null;
  if (!abilityDef) {
    return data?.skill
      ? normalizeScopedShopSkillText(data, finalizeSkillRuntime(data.skill as Obj, star), star)
      : null;
  }
  const abilityDefObj = abilityDef as Record<string, unknown>;
  const tooltipDef = abilityDefObj.tooltipDef && typeof abilityDefObj.tooltipDef === "object" ? abilityDefObj.tooltipDef as Record<string, unknown> : {};
  const primary = abilityDefObj.primary ?? null;
  const summaryTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    resolveLocaleText(tooltipDef.summaryKey as string | undefined, tooltipDef.summaryTextVi as string | undefined),
    tooltipDef.summaryTextVi,
    abilityDefObj.__starSummaryTextVi as string | undefined,
    data?.descriptionVi as string | undefined,
    data?.description as string | undefined,
    abilityDefObj.ui && typeof abilityDefObj.ui === "object" ? (abilityDefObj.ui as Record<string, unknown>).descriptionOverrideVi as string | undefined : undefined,
    abilityDefObj.summaryVi as string | undefined
  ));
  const summaryTextEn = pickFirstString(
    resolveLocaleText(
      tooltipDef.summaryKey as string | undefined,
      resolveLocaleField(tooltipDef, "summaryText", { locale: "en", allowBase: false, allowCrossLocale: false }),
      "en"
    ),
    data?.descriptionEn,
    resolveLocaleField(abilityDefObj?.ui as Obj | undefined, "descriptionOverride", { locale: "en", allowBase: false, allowCrossLocale: false }),
    resolveLocaleField(abilityDef as Obj | undefined, "summary", { locale: "en", allowBase: false, allowCrossLocale: false }),
    abilityDefObj.__starSummaryTextEn as string | undefined
  );
  const tooltipModel = sanitizeVietnameseFieldMap(buildTooltipModel(authoredAbilityDef as Obj, data));
  const metricsByStar = {
    1: buildAbilityMetrics(resolveAbilityForStar(authoredAbilityDef as Obj, 1) as Obj, data, 1),
    2: buildAbilityMetrics(resolveAbilityForStar(authoredAbilityDef as Obj, 2) as Obj, data, 2),
    3: buildAbilityMetrics(resolveAbilityForStar(authoredAbilityDef as Obj, 3) as Obj, data, 3)
  };
  const detailTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    abilityDefObj.__starDetailTextVi as string | undefined,
    tooltipDef.detailTextVi as string | undefined,
    (tooltipModel.detail as Record<string, unknown> | undefined)?.textVi as string | undefined,
    abilityDefObj.ui && typeof abilityDefObj.ui === "object" ? (abilityDefObj.ui as Record<string, unknown>).descriptionOverrideVi as string | undefined : undefined,
    summaryTextVi
  ));
  const detailTextEn = pickFirstString(
    abilityDefObj.__starDetailTextEn as string | undefined,
    resolveLocaleField(tooltipDef as Obj, "detailText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    (tooltipModel.detail as Record<string, unknown> | undefined)?.textEn as string | undefined,
    resolveLocaleField(abilityDefObj?.ui as Obj | undefined, "descriptionOverride", { locale: "en", allowBase: false, allowCrossLocale: false }),
    summaryTextEn
  );
  const upgradeTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    abilityDefObj.__starUpgradeTextVi as string | undefined,
    abilityDefObj.__starSummaryTextVi as string | undefined,
    tooltipDef.upgradeTextVi as string | undefined,
    (data?.starDescriptions as Record<string, unknown> | undefined)?.[String(star)] ?? (data?.starDescriptions as Record<string, unknown> | undefined)?.[star]
  ));
  const upgradeTextEn = pickFirstString(
    abilityDefObj.__starUpgradeTextEn as string | undefined,
    abilityDefObj.__starSummaryTextEn as string | undefined,
    resolveLocaleField(tooltipDef as Obj, "upgradeText", { locale: "en", allowBase: false, allowCrossLocale: false })
  );
  const compatibility = extractLegacyCompatibilityFields(abilityDef as Obj);

  const skillNameVi = pickFirstString(
    resolveLocaleKeyedText(abilityDef as Obj, "nameKey", "name", { locale: "vi", fallback: String(data?.name ?? prettyIdLabel(String(data?.id ?? ""), "Linh thú")) }),
    String(data?.name ?? "")
  );
  const skillNameEn = pickFirstString(
    resolveLocaleKeyedText(abilityDef as Obj, "nameKey", "name", {
      locale: "en",
      allowBase: false,
      allowCrossLocale: false,
      fallback: prettyIdLabel(String(abilityDefObj.key ?? data?.id ?? ""), "Skill")
    }),
    prettyIdLabel(String(abilityDefObj.key ?? data?.id ?? ""), "Skill")
  );
  const effectLabelVi = sanitizeVietnamesePlayerText(
    pickFirstString(tooltipDef.effectLabelVi as string | undefined, tooltipDef.shortLabelVi as string | undefined, abilityDefObj.ui && typeof abilityDefObj.ui === "object" ? (abilityDefObj.ui as Record<string, unknown>).shortLabelVi as string | undefined : undefined, abilityDefObj.nameVi as string | undefined, String(data?.name ?? ""))
  );
  const effectLabelEn = pickFirstString(tooltipDef.effectLabelEn as string | undefined, tooltipDef.shortLabelEn as string | undefined, abilityDefObj.ui && typeof abilityDefObj.ui === "object" ? (abilityDefObj.ui as Record<string, unknown>).shortLabelEn as string | undefined : undefined, abilityDefObj.nameEn as string | undefined, prettyIdLabel(String(abilityDefObj.key ?? data?.id ?? ""), "Skill"));
  const castTypeTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    resolveLocaleField(tooltipDef as Obj, "castTypeText", { locale: "vi" }),
    (tooltipModel as Record<string, unknown>).castTypeTextVi as string | undefined,
    translateActionPatternText(String(abilityDefObj?.cast && typeof abilityDefObj.cast === "object" ? (abilityDefObj.cast as Record<string, unknown>).actionPattern : "SELF"), "vi")
  ));
  const castTypeTextEn = pickFirstString(
    resolveLocaleField(tooltipDef as Obj, "castTypeText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    (tooltipModel as Record<string, unknown>).castTypeTextEn as string | undefined,
    translateActionPatternText(String(abilityDefObj?.cast && typeof abilityDefObj.cast === "object" ? (abilityDefObj.cast as Record<string, unknown>).actionPattern : "SELF"), "en")
  );
  const targetTextVi = sanitizeVietnamesePlayerText(
    pickFirstString(
      resolveLocaleField(tooltipDef as Obj, "targetText", { locale: "vi" }),
      (tooltipModel as Record<string, unknown>).targetTextVi as string | undefined,
      deriveTargetText(abilityDefObj.target as Obj | undefined, tooltipDef as Obj, "vi")
    )
  );
  const targetTextEn = pickFirstString(
    resolveLocaleField(tooltipDef, "targetText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.targetTextEn,
    deriveTargetText(abilityDefObj.target as Obj | undefined, tooltipDef as Obj, "en")
  );
  const shapeTextVi = sanitizeVietnamesePlayerText(
    pickFirstString(
      resolveLocaleField(tooltipDef, "shapeText", { locale: "vi" }),
      tooltipModel.shapeTextVi,
      deriveShapeText(abilityDefObj.target as Obj | undefined, tooltipDef as Obj, "vi")
    )
  );
  const shapeTextEn = pickFirstString(
    resolveLocaleField(tooltipDef, "shapeText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.shapeTextEn,
    deriveShapeText(abilityDefObj.target as Obj | undefined, tooltipDef as Obj, "en")
  );
  const selectionRuleTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "vi" }),
    tooltipModel.selectionRuleTextVi
  ));
  const selectionRuleTextEn = pickFirstString(
    resolveLocaleField(tooltipDef, "selectionRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.selectionRuleTextEn
  );
  const affectedCountTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    resolveLocaleField(tooltipDef, "affectedCountText", { locale: "vi" }),
    tooltipModel.affectedCountTextVi
  ));
  const affectedCountTextEn = pickFirstString(
    resolveLocaleField(tooltipDef, "affectedCountText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.affectedCountTextEn
  );
  const durationRuleTextVi = sanitizeVietnamesePlayerText(pickFirstString(
    resolveLocaleField(tooltipDef, "durationRuleText", { locale: "vi" }),
    tooltipModel.durationRuleTextVi
  ));
  const durationRuleTextEn = pickFirstString(
    resolveLocaleField(tooltipDef, "durationRuleText", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.durationRuleTextEn
  );
  const areaDescriptionVi = sanitizeVietnamesePlayerText(
    pickFirstString(
      resolveLocaleField(tooltipDef, "areaDescription", { locale: "vi" }),
      tooltipModel.areaDescriptionVi,
      deriveAreaDescription(abilityDef as Obj, tooltipDef as Obj, "vi")
    )
  );
  const sanitizedTooltipDef = sanitizeVietnameseFieldMap(tooltipDef as Obj);
  const areaDescriptionEn = pickFirstString(
    resolveLocaleField(tooltipDef, "areaDescription", { locale: "en", allowBase: false, allowCrossLocale: false }),
    tooltipModel.areaDescriptionEn,
    deriveAreaDescription(abilityDef as Obj, tooltipDef as Obj, "en")
  );
  const runtimeSkill = {
    id: String(abilityDefObj.key ?? ""),
    name: getLocale() === "en" ? skillNameEn : skillNameVi,
    nameVi: skillNameVi,
    nameEn: skillNameEn,
    descriptionVi: summaryTextVi,
    descriptionEn: summaryTextEn,
    summaryTextVi,
    summaryTextEn,
    detailTextVi,
    detailTextEn,
    upgradeTextVi,
    upgradeTextEn,
    actionPattern: String(abilityDefObj.cast && typeof abilityDefObj.cast === "object" ? (abilityDefObj.cast as Record<string, unknown>).actionPattern ?? "SELF" : "SELF"),
    effect: String(abilityDefObj.runtime && typeof abilityDefObj.runtime === "object" ? (abilityDefObj.runtime as Record<string, unknown>).effect ?? abilityDefObj.effectKey ?? (data?.skill && typeof data.skill === "object" ? (data.skill as Record<string, unknown>).effect : "custom") : "custom"),
    damageType: primary && typeof primary === "object" ? (primary as Record<string, unknown>).damageType ?? (abilityDefObj.runtime && typeof abilityDefObj.runtime === "object" ? (abilityDefObj.runtime as Record<string, unknown>).damageType : data?.skill && typeof data.skill === "object" ? (data.skill as Record<string, unknown>).damageType : null) : null,
    cost: abilityDefObj.cast && typeof abilityDefObj.cast === "object" ? (abilityDefObj.cast as Record<string, unknown>).cost : undefined,
    costByStar: authoredAbilityDef && typeof authoredAbilityDef === "object" ? (authoredAbilityDef as Record<string, unknown>).costByStar : undefined,
    powerScaleByStar: authoredAbilityDef && typeof authoredAbilityDef === "object" ? (authoredAbilityDef as Record<string, unknown>).powerScaleByStar : undefined,
    includeSelf: abilityDefObj.cast && typeof abilityDefObj.cast === "object" && (abilityDefObj.cast as Record<string, unknown>).targetRules && typeof (abilityDefObj.cast as Record<string, unknown>).targetRules === "object" ? ((abilityDefObj.cast as Record<string, unknown>).targetRules as Record<string, unknown>).allowSelf !== false : true,
    targetSelector: abilityDefObj.target && typeof abilityDefObj.target === "object" && (abilityDefObj.target as Record<string, unknown>).side === "enemy" ? (abilityDefObj.target as Record<string, unknown>).selector : undefined,
    allySelector: abilityDefObj.target && typeof abilityDefObj.target === "object" && (abilityDefObj.target as Record<string, unknown>).side === "ally" ? (abilityDefObj.target as Record<string, unknown>).selector : undefined,
    base: primary && typeof primary === "object" ? (primary as Record<string, unknown>).base : undefined,
    scaleStat: primary && typeof primary === "object" && (primary as Record<string, unknown>).scale && typeof (primary as Record<string, unknown>).scale === "object" ? ((primary as Record<string, unknown>).scale as Record<string, unknown>).stat : undefined,
    scale: primary && typeof primary === "object" && (primary as Record<string, unknown>).scale && typeof (primary as Record<string, unknown>).scale === "object" ? ((primary as Record<string, unknown>).scale as Record<string, unknown>).ratio : undefined,
    maxTargets: abilityDefObj.target && typeof abilityDefObj.target === "object" && (abilityDefObj.target as Record<string, unknown>).shape && typeof (abilityDefObj.target as Record<string, unknown>).shape === "object" ? ((abilityDefObj.target as Record<string, unknown>).shape as Record<string, unknown>).count : undefined,
    maxHits: primary && typeof primary === "object" ? (primary as Record<string, unknown>).hits : undefined,
    turns: primary && typeof primary === "object" ? (primary as Record<string, unknown>).turns : undefined,
    effectLabel: getLocale() === "en" ? effectLabelEn : effectLabelVi,
    effectLabelVi,
    effectLabelEn,
    castTypeText: getLocale() === "en" ? castTypeTextEn : castTypeTextVi,
    castTypeTextVi,
    castTypeTextEn,
    shapeText: getLocale() === "en" ? shapeTextEn : shapeTextVi,
    shapeTextVi,
    shapeTextEn,
    targetText: getLocale() === "en" ? targetTextEn : targetTextVi,
    targetTextVi,
    targetTextEn,
    selectionRuleText: getLocale() === "en" ? selectionRuleTextEn : selectionRuleTextVi,
    selectionRuleTextVi,
    selectionRuleTextEn,
    affectedCountText: getLocale() === "en" ? affectedCountTextEn : affectedCountTextVi,
    affectedCountTextVi,
    affectedCountTextEn,
    durationRuleText: getLocale() === "en" ? durationRuleTextEn : durationRuleTextVi,
    durationRuleTextVi,
    durationRuleTextEn,
    areaDescription: getLocale() === "en" ? areaDescriptionEn : areaDescriptionVi,
    areaDescriptionVi,
    areaDescriptionEn,
    previewCells: tooltipModel.previewCells,
    logic: abilityDef.logic ?? null,
    tooltipDef: sanitizedTooltipDef,
    tooltipModel,
    metricsByStar,
    runtimeShapeVersion: 3,
    abilityDef: authoredAbilityDef,
    resolvedAbilityDef: abilityDef,
    ...compatibility,
    ...(abilityDef.runtimeSkill ?? {})
  };
  return normalizeScopedShopSkillText(data, finalizeSkillRuntime(runtimeSkill, star), star);
}

function normalizeUnitModule(mod: unknown, options: Obj = {}) {
  const archived = (options).archived === true;
  const data = mod && typeof mod === "object" && "default" in (mod as Record<string, unknown>) ? (mod as Record<string, unknown>).default as Obj : mod as Obj;
  warnV3Issues(data, options);
  const starDescriptions = resolveLegacySkillStarDescriptions(deriveStarDescriptions(data));
  const skillsByStar = {
    1: normalizeAbilityDefToRuntimeSkill(data, 1),
    2: normalizeAbilityDefToRuntimeSkill(data, 2),
    3: normalizeAbilityDefToRuntimeSkill(data, 3)
  };
  const normalizedStarDescriptions = {
    1: pickFirstString(
      starDescriptions[1],
      sanitizeVietnamesePlayerText(skillsByStar[1]?.upgradeTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[1]?.summaryTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[1]?.descriptionVi ?? "")
    ),
    2: pickFirstString(
      starDescriptions[2],
      sanitizeVietnamesePlayerText(skillsByStar[2]?.upgradeTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[2]?.summaryTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[2]?.descriptionVi ?? "")
    ),
    3: pickFirstString(
      starDescriptions[3],
      sanitizeVietnamesePlayerText(skillsByStar[3]?.upgradeTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[3]?.summaryTextVi ?? ""),
      sanitizeVietnamesePlayerText(skillsByStar[3]?.descriptionVi ?? "")
    )
  };
  const skill = skillsByStar[1];
  const skillId = skill?.id ?? data.skillId ?? null;
  const authoredSkins = data.skins && typeof data.skins === "object" ? data.skins : {};
  const resolvedSpecies = String(data.species ?? inferSpeciesKey(data.name, String(data.id ?? "linh-thu")));
  const resolvedElement = data.element ?? data.tribe;
  const resolvedFaction = data.faction ?? getFactionForSpecies(resolvedSpecies);
  const authoredStarDescriptions = data.starDescriptions && typeof data.starDescriptions === "object" ? data.starDescriptions as Record<string | number, unknown> : {};
  const resolvedDescriptionVi = deriveUnitPitchText(
    pickFirstString(
      data.descriptionVi,
      data.description,
      skill?.descriptionVi,
      skill?.description,
      skill?.detailTextVi,
      skill?.detailText,
      authoredStarDescriptions[1]
    ),
    String(data.name ?? "")
  );
  const resolvedDescriptionEn = deriveEnglishPitchText(
    pickFirstString(
      data.descriptionEn,
      skill?.descriptionEn,
      skill?.description,
      skill?.detailTextEn,
      skill?.detailText
    )
  );
  return {
    id: data.id,
    name: getLocale() === "en"
      ? pickFirstString(data.nameEn, prettyIdLabel(String(data.id ?? ""), String(data.name ?? "")))
      : data.name,
    nameVi: data.name,
    nameEn: pickFirstString(data.nameEn, prettyIdLabel(String(data.id ?? ""), String(data.name ?? ""))),
    authoredDescriptionVi: sanitizeVietnamesePlayerText(pickFirstString(data.descriptionVi, data.description)),
    authoredDescriptionEn: pickFirstString(data.descriptionEn),
    descriptionVi: resolvedDescriptionVi,
    descriptionEn: resolvedDescriptionEn,
    species: resolvedSpecies,
    icon: data.icon,
    element: resolvedElement,
    faction: resolvedFaction,
    tribe: resolvedElement,
    tribeVi: data.tribeVi,
    classType: data.classType,
    classVi: data.classVi,
    tier: data.tier,
    skillId,
    star1Desc: normalizedStarDescriptions[1] ?? "",
    star2Desc: normalizedStarDescriptions[2] ?? "",
    star3Desc: normalizedStarDescriptions[3] ?? "",
    passiveLinesByStar: data.passiveLinesByStar && typeof data.passiveLinesByStar === "object"
      ? { ...data.passiveLinesByStar }
      : null,
    stats: data.stats ?? {},
    attackDef: normalizeAttackDef(data),
    abilityDef: data.abilityDef ?? null,
    authoredSkill: data.skill ?? null,
    starVisualIdentity: data.starVisualIdentity ?? null,
    skill,
    skins: {
      ...authoredSkins
    },
    visual: data.visual ?? null,
    archived,
    bossOnly: data.bossOnly === true
  };
}

function normalizeUnitModuleMap(moduleMap: Record<string, unknown>, { archived = false, groupLabel = "unit" } = {}) {
  const units = [];
  const sourceById = new Map();
  for (const [sourcePath, mod] of Object.entries(moduleMap)) {
    const unit = normalizeUnitModule(mod, { archived });
    const existingSource = sourceById.get(unit.id);
    if (existingSource) {
      throw new Error(
        `[UnitCatalog] Duplicate ${groupLabel} id "${unit.id}" loaded from ${existingSource} and ${sourcePath}`
      );
    }
    sourceById.set(unit.id, sourcePath);
    units.push(unit);
  }
  return units;
}

export function __buildUnitCatalogCollectionsForTests({
  activeModules = activeUnitModules,
  archivedModules = archivedUnitModules,
  bossModules = bossUnitModules
} = {}) {
  const coreUnits = normalizeUnitModuleMap(activeModules, { archived: false, groupLabel: "active unit" });
  const archivedUnits = normalizeUnitModuleMap(archivedModules, { archived: true, groupLabel: "archived unit" });
  const bossUnits = normalizeUnitModuleMap(bossModules, { archived: false, groupLabel: "boss unit" });
  const playableUnits = [...coreUnits];
  const allUnits = [...coreUnits, ...bossUnits, ...archivedUnits];

  return {
    coreUnits,
    archivedUnits,
    bossUnits,
    playableUnits,
    allUnits,
    unitById: Object.fromEntries(coreUnits.map((u) => [u.id, u])),
    archivedUnitById: Object.fromEntries(archivedUnits.map((u) => [u.id, u])),
    allUnitById: Object.fromEntries(allUnits.map((u) => [u.id, u]))
  };
}

const {
  coreUnits: CORE_UNITS,
  bossUnits: BOSS_UNITS,
  allUnits: ALL_UNITS,
  unitById: UNIT_BY_ID,
  allUnitById: ALL_UNIT_BY_ID
} = __buildUnitCatalogCollectionsForTests();

export const UNIT_CATALOG = CORE_UNITS;
export const ARCHIVED_UNIT_CATALOG = Object.freeze([]);
export const BOSS_UNIT_CATALOG = BOSS_UNITS;
export const ALL_UNIT_CATALOG = ALL_UNITS;
export const ARCHIVED_UNIT_BY_ID = Object.freeze({});
export { UNIT_BY_ID, ALL_UNIT_BY_ID };

export function resolveUnitSkillForStar(baseOrUnit: unknown, star = 1) {
  const base = typeof baseOrUnit === "string" ? ALL_UNIT_BY_ID[baseOrUnit] : baseOrUnit as Obj | undefined;
  if (!base) return null;
  if (!base.abilityDef) {
    return (base.authoredSkill ?? base.skill)
      ? normalizeScopedShopSkillText(base, finalizeSkillRuntime(base.authoredSkill ?? base.skill, star), star)
      : null;
  }
  return normalizeAbilityDefToRuntimeSkill(base, star);
}

export function resolveUnitEquipmentSlotCap(baseOrUnit: unknown, star = null) {
  const baseOrUnitObj = baseOrUnit && typeof baseOrUnit === "object" ? baseOrUnit as Obj : null;
  const base = typeof baseOrUnit === "string"
    ? ALL_UNIT_BY_ID[baseOrUnit] ?? null
    : (baseOrUnitObj ? (ALL_UNIT_BY_ID[String(baseOrUnitObj.baseId ?? "")] ?? baseOrUnitObj.base ?? baseOrUnitObj ?? null) : null);
  const resolvedStar = Number.isFinite(Number(star))
    ? Math.max(1, Math.min(3, Math.round(Number(star) || 1)))
    : Math.max(1, Math.min(3, Math.round(Number(baseOrUnitObj?.star) || 1)));
  const resolvedSkill = resolveUnitSkillForStar(base, resolvedStar);
  const fallbackCap = Number(
    baseOrUnitObj?.rageMax
    ?? (baseOrUnitObj?.stats && typeof baseOrUnitObj.stats === "object" ? (baseOrUnitObj.stats as Record<string, unknown>).rageMax : undefined)
    ?? (baseOrUnitObj?.base && typeof baseOrUnitObj.base === "object" ? (baseOrUnitObj.base as Record<string, unknown>).rageMax : undefined)
    ?? (base && typeof base === "object" && (base as Record<string, unknown>).stats && typeof (base as Record<string, unknown>).stats === "object" ? ((base as Record<string, unknown>).stats as Record<string, unknown>).rageMax : undefined)
    ?? 3
  );
  const resolvedSkillCost = resolvedSkill && typeof resolvedSkill === "object" ? (resolvedSkill as Record<string, unknown>).cost : undefined;
  return Math.max(0, Math.round(Number(resolvedSkillCost ?? fallbackCap) || 0));
}
