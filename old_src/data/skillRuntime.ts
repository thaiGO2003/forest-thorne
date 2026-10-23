import {
  containsVietnamesePlayerJargon,
  sanitizeVietnameseFieldMap,
  sanitizeVietnamesePlayerText
} from "../core/viTextSanitizer.js";
import { resolveOffenseDebuffStat } from "../core/offenseDebuff.js";


export type RuntimeScalar = string | number | boolean | null | undefined;
export type RuntimeRecord = Record<string, unknown>;

function isRuntimeRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface RuntimeSkillDefinition extends RuntimeRecord {
  id?: string;
  name?: string;
  effect?: string;
  starMods?: Record<string, RuntimeRecord>;
}

function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneDeep(entry)) as unknown as T;
  if (isRuntimeRecord(value)) {
    const copy: RuntimeRecord = {};
    for (const [key, nested] of Object.entries(value)) copy[key] = cloneDeep(nested);
    return copy as T;
  }
  return value;
}

function mergeInto(target: RuntimeRecord, patch: unknown): RuntimeRecord {
  if (!isRuntimeRecord(patch)) return target;
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      target[key] = value.map((entry) => cloneDeep(entry));
    } else if (isRuntimeRecord(value) && isRuntimeRecord(target[key])) {
      mergeInto(target[key], value);
    } else {
      target[key] = cloneDeep(value);
    }
  }
  return target;
}

const STALE_STAR_TEXT_PATTERNS = [
  /giam giap muc tieu/i,
  /giam chinh xac muc tieu/i,
  /giam ne tranh muc tieu/i,
  /moi dong minh trung/i,
  /gay chay lan/i,
  /chay mau.*giam 25% hoi mau/i
];

function toAsciiLower(text: unknown): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeStar(star: unknown): number {
  const value = Number.parseInt(typeof star === "string" ? star : String(star), 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  if (value > 3) return 3;
  return value;
}

const GENERIC_SHAPE_TEXTS = new Set([
  "mau ky nang dac thu"
]);

const GENERIC_TARGET_TEXTS = [
  /^1 muc tieu$/i,
  /^\d+\s+muc tieu$/i,
  /^\d+\s+dong minh$/i,
  /^\[object object\]$/i
];

const SELECTOR_RULE_DESCRIPTIONS: Record<string, string> = {
  lowest_hp_pct: "địch % máu thấp nhất",
  lowest_hp_pct_ally: "đồng minh % máu thấp nhất",
  highest_rage: "địch nhiều nộ nhất",
  highest_matk: "địch có MATK cao nhất",
  highest_max_hp_front: "mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất",
  lowest_def_front: "mục tiêu ở cột đầu tiên phía địch có DEF thấp nhất",
  lowest_mdef_backline: "mục tiêu ở cột cuối cùng phía địch có MDEF thấp nhất",
  isolated_backline: "mục tiêu ở cột cuối cùng phía địch và đứng tách khỏi đồng đội",
  highest_atk: "địch có ATK cao nhất",
  highest_atk_backline: "mục tiêu ở cột cuối cùng phía địch có ATK cao nhất",
  lowest_rage_ally: "đồng minh ít nộ nhất",
  backline_caster: "pháp sư hoặc con hỗ trợ ở cột cuối cùng phía địch",
  most_clustered_row: "hàng địch đông nhất",
  most_clustered_col: "cột địch đông nhất",
  highest_total_atk_row: "hàng địch có tổng ATK cao nhất",
  highest_total_atk_col: "cột địch có tổng ATK cao nhất",
  random: "ngẫu nhiên",
  random_unique: "ngẫu nhiên không trùng mục tiêu",
  global: "toàn bàn",
  same_row: "cùng hàng mục tiêu",
  same_row_carry: "đồng minh cùng hàng có sức tấn công cao nhất",
  same_column: "cùng cột mục tiêu",
  front_cone: "vùng nón phía trước",
  self: "bản thân",
  frontline_default: "địch gần tuyến trước nhất",
  backline_jump: "lao vào tuyến sau",
  "dead_ally_first -> lowest_hp_pct_ally": "ưu tiên đồng minh đã ngã xuống, nếu không có thì đồng minh % máu thấp nhất",
  "self -> lowest_hp_pct_ally": "bản thân trước, rồi tới đồng minh % máu thấp nhất",
  primary_target: "mục tiêu khóa chính"
};

function normalizeText(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTextKey(text: unknown): string {
  return toAsciiLower(normalizeText(text));
}

function resolveRenderableText(value: unknown, star = 1): string {
  if (typeof value === "string") return normalizeText(value);
  if (isRuntimeRecord(value)) {
    return normalizeText(
      value[star] ?? value[String(star)] ?? value[1] ?? value["1"] ?? ""
    );
  }
  return "";
}

function isGenericTargetText(text: unknown): boolean {
  const normalized = normalizeTextKey(text);
  return GENERIC_TARGET_TEXTS.some((pattern) => pattern.test(normalized));
}

function isGenericShapeText(text: unknown): boolean {
  return GENERIC_SHAPE_TEXTS.has(normalizeTextKey(text));
}

function readCount(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.round(parsed));
}

function usesCross5Area(skill: RuntimeSkillDefinition): boolean {
  return skill?.effect === "cross_5" || normalizeText(skill?.areaPattern) === "cross_5";
}

function resolveStarMappedValue(value: unknown, star: number, fallback: RuntimeScalar = null): RuntimeScalar {
  if (value == null) return fallback;
  if (!isRuntimeRecord(value)) return value as RuntimeScalar;
  return value[star] as RuntimeScalar ?? value[String(star)] as RuntimeScalar ?? fallback;
}

const INTEGER_POWER_FIELDS = new Set([
  "base",
  "healBase",
  "armorBuff",
  "mdefBuff",
  "atkBuff",
  "atkDebuffValue",
  "offenseDebuffValue",
  "burnPerTurn",
  "poisonPerTurn",
  "bleedDamage",
  "diseaseDamage",
  "hotAmount",
  "maxHpBuffFlat"
]);

const DECIMAL_POWER_FIELDS = new Set([
  "scale",
  "healScale",
  "shieldPctMaxHp",
  "atkBuffPct",
  "reflectPct",
  "physReflectPct",
  "damageReductionPct",
  "magicDamageReductionPct",
  "guardianAbsorbPct",
  "maxHpBuffPct",
  "primaryCarryBuffPct",
  "allyBuffPct"
]);

function normalizeSelectorForDisplay(selector: unknown, { isAlly = false }: { isAlly?: boolean } = {}): string {
  const normalized = normalizeText(selector);
  if (!normalized) return "";
  if (isAlly && normalized === "lowest_hp_pct") return "lowest_hp_pct_ally";
  if (isAlly && normalized === "lowest_rage") return "lowest_rage_ally";
  return normalized;
}

function applyPowerScaleToSkill(skill: RuntimeSkillDefinition, powerScale: unknown): void {
  const numericScale = Number(powerScale);
  if (!skill || !Number.isFinite(numericScale) || numericScale <= 0 || Math.abs(numericScale - 1) < 0.0001) return;

  INTEGER_POWER_FIELDS.forEach((key) => {
    const numeric = Number(skill[key]);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    skill[key] = Math.max(1, Math.round(numeric * numericScale));
  });

  DECIMAL_POWER_FIELDS.forEach((key) => {
    const numeric = Number(skill[key]);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    skill[key] = Number((numeric * numericScale).toFixed(4));
  });
}

function inferOffenseDebuffMode(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  const explicit = normalizeText(skill.offenseDebuffMode || skill.offenseDebuffStat || "");
  if (explicit === "atk" || explicit === "matk" || explicit === "autoByRole") return explicit;
  const targetClasses = Array.isArray(skill.targetClasses)
    ? skill.targetClasses.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean)
    : [];
  if (skill.casterOnlyDebuff || (targetClasses.length > 0 && targetClasses.every((value) => value === "MAGE" || value === "SUPPORT"))) {
    return "matk";
  }
  if ((Number(skill.offenseDebuffValue ?? skill.atkDebuffValue) || 0) > 0) return "autoByRole";
  return "";
}

function formatPercent(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${Math.round(Math.min(1, numeric) * 100)}%`;
}

function formatSelectionRule(ruleKey: unknown): string {
  const normalized = normalizeText(ruleKey);
  if (!normalized) return "";
  if (normalized.includes(" -> ")) {
    return normalized
      .split(/\s*->\s*/)
      .map((part) => formatSelectionRule(part))
      .filter(Boolean)
      .join(" -> ");
  }
  const description = SELECTOR_RULE_DESCRIPTIONS[normalized];
  return description ? `${normalized} (${description})` : normalized;
}

function formatSelectionRuleVi(ruleKey: unknown): string {
  const normalized = normalizeText(ruleKey);
  if (!normalized) return "";
  const directDescription = SELECTOR_RULE_DESCRIPTIONS[normalized];
  if (directDescription) return directDescription;
  if (normalized.includes(" -> ")) {
    return normalized
      .split(/\s*->\s*/)
      .map((part) => formatSelectionRuleVi(part))
      .filter(Boolean)
      .join(" -> ");
  }
  return normalized;
}

function deriveSelectionRule(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  if (skill.selectionRuleText) return normalizeText(skill.selectionRuleText);

  const targetSelector = normalizeSelectorForDisplay(skill.targetSelector);
  const allySelector = normalizeSelectorForDisplay(skill.allySelector, { isAlly: true });
  const selector = targetSelector || allySelector;
  if (skill.effect === "revive_or_heal") return "dead_ally_first -> lowest_hp_pct_ally";
  if (skill.effect === "self_regen_team_heal") return "self -> lowest_hp_pct_ally";
  if (skill.effect === "team_shield") return "global";
  if (skill.effect === "global_stun") {
    return skill.stunSelector ? `global -> ${skill.stunSelector}` : "global";
  }
  if (skill.effect === "global_debuff_atk") {
    return skill.debuffTargetSelector ? `global -> ${skill.debuffTargetSelector}` : "global";
  }
  if (skill.effect === "flash_blind") {
    return skill.debuffTargetSelector ? `global -> ${skill.debuffTargetSelector}` : "global";
  }
  if (skill.effect === "team_rage") return allySelector || "lowest_rage_ally";
  if (skill.effect === "row_carry_rage_buff") return allySelector || "same_row_carry";
  if (skill.effect === "row_random_rage_buff") return allySelector || "same_row";
  if (
    skill.effect === "heal_over_time"
    || skill.effect === "team_evade_buff"
    || skill.effect === "mass_cleanse"
    || skill.effect === "team_rage_self_heal"
    || skill.effect === "mimic_rage_buff"
  ) {
    return allySelector || "lowest_hp_pct_ally";
  }
  if (skill.effect === "row_charge") return selector || "same_row";
  if (skill.effect === "frost_storm") return selector || "same_column";
  if (skill.effect === "ink_blast_debuff") {
    return selector || "same_column";
  }
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") {
    return selector || "front_cone";
  }
  if (
    skill.effect === "global_stun" ||
    skill.effect === "global_debuff_atk" ||
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind"
  ) {
    return "global";
  }
  if (skill.effect === "random_multi" || skill.effect === "arrow_rain" || skill.effect === "feather_bleed") {
    if (selector) return selector;
    return skill.uniqueTargets ? "random_unique" : "random";
  }
  if (skill.effect === "chain_shock") {
    return selector || normalizeText(skill.bounceSelector) || "highest_rage";
  }
  if (skill.effect === "single_sleep") {
    return selector || "highest_rage";
  }
  if (selector) return selector;
  if (skill.actionPattern === "SELF") return "self";
  if (skill.actionPattern === "ASSASSIN_BACK") return "backline_jump";
  if (skill.actionPattern === "RANGED_STATIC") return "primary_target";
  return "frontline_default";
}

function deriveAffectedCount(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  if (skill.affectedCountText) return normalizeText(skill.affectedCountText);

  if (skill.effect === "revive_or_heal") {
    const reviveCount = readCount(skill.reviveCount, 1);
    const healCount = readCount(skill.healTargetCount, 3);
    return `revive ${reviveCount} / heal ${healCount}`;
  }
  if (skill.effect === "self_regen_team_heal") {
    return `self + ${readCount(skill.maxTargets, 2)} allies`;
  }
  if (skill.effect === "row_carry_rage_buff") {
    return `${readCount(skill.maxTargets, 2)}`;
  }
  if (skill.effect === "row_random_rage_buff") {
    return `${readCount(skill.maxTargets, 2)}`;
  }
  if (skill.effect === "single_delayed_echo") return "1 + echo";
  if (skill.effect === "double_hit") return "1 (2 hits)";
  if (skill.effect === "plague_spread") {
    const cap = readCount(skill.spreadMaxTargets, 0);
    return cap > 0 ? `1 + adjacent (cap ${cap})` : "1 + adjacent";
  }
  if (skill.effect === "global_stun") {
    const stunCount = readCount(skill.stunMaxTargets, 0);
    return stunCount > 0 ? `damage all / stun ${stunCount}` : "all";
  }
  if (skill.effect === "global_debuff_atk") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    return debuffCount > 0 ? `damage all / debuff ${debuffCount}` : "all";
  }
  if (skill.effect === "flash_blind") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    return debuffCount > 0 ? `damage all / debuff ${debuffCount}` : "all";
  }
  if (skill.effect === "row_charge") return "row";
  if (skill.effect === "frost_storm") return "column";
  if (skill.effect === "ink_blast_debuff") return "column";
  if (usesCross5Area(skill)) return "cross 5";
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") return "area 3x3";
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") return "cone 3-5";
  if (
    skill.effect === "global_stun" ||
    skill.effect === "global_debuff_atk" ||
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind" ||
    skill.effect === "team_shield"
  ) {
    return "all";
  }
  const maxHits = readCount(skill.maxHits, 0);
  if (maxHits > 0) {
    if (skill.bonusTargetSelector && !skill.bonusTargetConsumesHit) return `${maxHits} + bonus 1`;
    return `${maxHits}`;
  }
  const maxTargets = readCount(skill.maxTargets, 0);
  if (maxTargets > 0) return `${maxTargets}`;
  return "1";
}

function deriveAffectedCountVi(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  if (skill.affectedCountTextVi) return normalizeText(skill.affectedCountTextVi);

  if (skill.effect === "revive_or_heal") {
    const reviveCount = readCount(skill.reviveCount, 1);
    const healCount = readCount(skill.healTargetCount, 3);
    return `hồi sinh ${reviveCount} / hồi máu ${healCount}`;
  }
  if (skill.effect === "self_regen_team_heal") {
    return `bản thân + ${readCount(skill.maxTargets, 2)} đồng minh`;
  }
  if (skill.effect === "row_carry_rage_buff") {
    return `${readCount(skill.maxTargets, 2)}`;
  }
  if (skill.effect === "row_random_rage_buff") {
    return `${readCount(skill.maxTargets, 2)}`;
  }
  if (skill.effect === "single_delayed_echo") return "1 mục tiêu + vọng âm";
  if (skill.effect === "double_hit") return "1 mục tiêu (ra đòn 2 lần)";
  if (skill.effect === "plague_spread") {
    const cap = readCount(skill.spreadMaxTargets, 0);
    return cap > 0 ? `1 mục tiêu + ô kề (tối đa ${cap})` : "1 mục tiêu + ô kề";
  }
  if (skill.effect === "global_stun") {
    const stunCount = readCount(skill.stunMaxTargets, 0);
    return stunCount > 0 ? `gây sát thương toàn bàn / choáng ${stunCount}` : "toàn bộ";
  }
  if (skill.effect === "global_debuff_atk") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    return debuffCount > 0 ? `gây sát thương toàn bàn / giảm công ${debuffCount}` : "toàn bộ";
  }
  if (skill.effect === "flash_blind") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    return debuffCount > 0 ? `gây sát thương toàn bàn / làm mù ${debuffCount}` : "toàn bộ";
  }
  if (skill.effect === "row_charge") return "1 hàng";
  if (skill.effect === "frost_storm") return "1 cột";
  if (skill.effect === "ink_blast_debuff") return "1 cột";
  if (usesCross5Area(skill)) return "5 ô hình thập";
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") return "vùng 3x3";
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") return "hình nón 3-5 ô";
  if (
    skill.effect === "global_stun" ||
    skill.effect === "global_debuff_atk" ||
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind" ||
    skill.effect === "team_shield"
  ) {
    return "toàn bộ";
  }
  const maxHits = readCount(skill.maxHits, 0);
  if (maxHits > 0) {
    if (skill.bonusTargetSelector && !skill.bonusTargetConsumesHit) return `${maxHits} + mục tiêu phụ`;
    return `${maxHits}`;
  }
  const maxTargets = readCount(skill.maxTargets, 0);
  if (maxTargets > 0) return `${maxTargets}`;
  return "1";
}

function joinDurationParts(parts: string[]): string {
  return parts.filter(Boolean).join(" + ");
}

function deriveDurationRule(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  if (skill.durationRuleText) return normalizeText(skill.durationRuleText);

  if (skill.effect === "revive_or_heal") {
    return "instant; revive branch only if dead ally exists";
  }
  if (skill.effect === "self_regen_team_heal") {
    return "instant self-heal + instant ally heal";
  }
  if (skill.effect === "row_carry_rage_buff") {
    const primaryTurns = readCount(skill.primaryCarryBuffTurns, readCount(skill.turns, 1));
    const allyTurns = readCount(skill.allyBuffTurns, readCount(skill.turns, 1));
    if (primaryTurns > allyTurns) {
      return `lead carry ${primaryTurns} turns / side carries ${allyTurns} turn`;
    }
    return `${allyTurns} turns`;
  }
  if (skill.effect === "row_random_rage_buff") {
    const bonusTurns = readCount(skill.bonusTargetBuffTurns, 0);
    const allyTurns = readCount(skill.allyBuffTurns, readCount(skill.turns, 1));
    if (bonusTurns > allyTurns) {
      return `base ${allyTurns} turn / bonus ${bonusTurns} turns`;
    }
    return `${allyTurns} turns`;
  }
  if (skill.effect === "heal_over_time") {
    return `hot ${readCount(skill.turns, 3)} turns`;
  }
  if (skill.effect === "team_rage" || skill.effect === "team_shield") {
    return "instant";
  }
  if (skill.effect === "assassin_execute_rage_refund") {
    return "instant; refunds rage only on kill";
  }
  if (skill.effect === "single_delayed_echo") {
    return "instant + delayed echo";
  }
  if (skill.effect === "double_hit") {
    return "instant double hit";
  }

  const parts = [];
  if (readCount(skill.turns, 0) > 0) parts.push(`${readCount(skill.turns)} turns`);
  if (readCount(skill.hotTurns, 0) > 0) parts.push(`hot ${readCount(skill.hotTurns)} turns`);
  if (readCount(skill.stunTurns, 0) > 0) {
    const chance = formatPercent(skill.stunChance);
    parts.push(chance ? `stun ${readCount(skill.stunTurns)} turn (${chance})` : `stun ${readCount(skill.stunTurns)} turn`);
  }
  if (readCount(skill.sleepTurns, 0) > 0) {
    const chance = formatPercent(skill.sleepChance);
    parts.push(chance ? `sleep ${readCount(skill.sleepTurns)} turn (${chance})` : `sleep ${readCount(skill.sleepTurns)} turn`);
  }
  if (readCount(skill.freezeTurns, 0) > 0) {
    const freezeIfColumnHasRangedCount = readCount(skill.freezeIfColumnHasRangedCount, 0);
    const freezeIfRowHasRangedCount = readCount(skill.freezeIfRowHasRangedCount, 0);
    if (freezeIfColumnHasRangedCount > 0) {
      parts.push(`freeze ${readCount(skill.freezeTurns)} turn if column has ${freezeIfColumnHasRangedCount} ranged`);
    } else if (freezeIfRowHasRangedCount > 0) {
      parts.push(`freeze ${readCount(skill.freezeTurns)} turn if row has ${freezeIfRowHasRangedCount} ranged`);
    } else {
      parts.push(`freeze ${readCount(skill.freezeTurns)} turn`);
    }
  }
  if (readCount(skill.disarmTurns, 0) > 0) parts.push(`disarm ${readCount(skill.disarmTurns)} turn`);
  if (readCount(skill.burnTurns, 0) > 0) parts.push(`burn ${readCount(skill.burnTurns)} turns`);
  if (readCount(skill.poisonTurns, 0) > 0) parts.push(`poison ${readCount(skill.poisonTurns)} turns`);
  if (readCount(skill.bleedTurns, 0) > 0) parts.push(`bleed ${readCount(skill.bleedTurns)} turns`);
  if (readCount(skill.diseaseTurns, 0) > 0) parts.push(`disease ${readCount(skill.diseaseTurns)} turns`);
  if (readCount(skill.armorBreakTurns, 0) > 0) parts.push(`armor break ${readCount(skill.armorBreakTurns)} turns`);
  if (readCount(skill.antiShieldBonusTurns, 0) > 0) parts.push(`bonus ${readCount(skill.antiShieldBonusTurns)} vs shield/tanker`);

  if (parts.length) return joinDurationParts(parts);
  return "instant";
}

function deriveDurationRuleVi(skill: RuntimeSkillDefinition): string {
  if (!skill || typeof skill !== "object") return "";
  if (skill.durationRuleTextVi) return normalizeText(skill.durationRuleTextVi);

  if (skill.effect === "revive_or_heal") {
    return "tức thì; chỉ hồi sinh nếu có đồng minh đã ngã xuống";
  }
  if (skill.effect === "self_regen_team_heal") {
    return "tức thì; tự hồi trước rồi hồi đồng minh";
  }
  if (skill.effect === "row_carry_rage_buff") {
    const primaryTurns = readCount(skill.primaryCarryBuffTurns, readCount(skill.turns, 1));
    const allyTurns = readCount(skill.allyBuffTurns, readCount(skill.turns, 1));
    if (primaryTurns > allyTurns) {
      return `cơ bản ${allyTurns} lượt / mục tiêu nhận thêm nhịp ${primaryTurns} lượt`;
    }
    return `${allyTurns} lượt`;
  }
  if (skill.effect === "row_random_rage_buff") {
    const bonusTurns = readCount(skill.bonusTargetBuffTurns, 0);
    const allyTurns = readCount(skill.allyBuffTurns, readCount(skill.turns, 1));
    if (bonusTurns > allyTurns) {
      return `cơ bản ${allyTurns} lượt / mục tiêu nhận thêm nhịp ${bonusTurns} lượt`;
    }
    return `${allyTurns} lượt`;
  }
  if (skill.effect === "heal_over_time") {
    return `hồi dần ${readCount(skill.turns, 3)} lượt`;
  }
  if (skill.effect === "team_rage" || skill.effect === "team_shield") {
    return "tức thì";
  }
  if (skill.effect === "assassin_execute_rage_refund") {
    return "tức thì; chỉ hồi nộ khi kết liễu";
  }
  if (skill.effect === "single_delayed_echo") {
    return "tức thì + vọng âm trễ";
  }
  if (skill.effect === "double_hit") {
    return "tức thì, ra đòn 2 lần";
  }

  const parts = [];
  if (readCount(skill.turns, 0) > 0) parts.push(`${readCount(skill.turns)} lượt`);
  if (readCount(skill.hotTurns, 0) > 0) parts.push(`hồi dần ${readCount(skill.hotTurns)} lượt`);
  if (readCount(skill.stunTurns, 0) > 0) {
    const chance = formatPercent(skill.stunChance);
    parts.push(chance ? `choáng ${readCount(skill.stunTurns)} lượt (${chance})` : `choáng ${readCount(skill.stunTurns)} lượt`);
  }
  if (readCount(skill.sleepTurns, 0) > 0) {
    const chance = formatPercent(skill.sleepChance);
    parts.push(chance ? `ngủ ${readCount(skill.sleepTurns)} lượt (${chance})` : `ngủ ${readCount(skill.sleepTurns)} lượt`);
  }
  if (readCount(skill.freezeTurns, 0) > 0) {
    const freezeIfColumnHasRangedCount = readCount(skill.freezeIfColumnHasRangedCount, 0);
    const freezeIfRowHasRangedCount = readCount(skill.freezeIfRowHasRangedCount, 0);
    if (freezeIfColumnHasRangedCount > 0) {
      parts.push(`đóng băng ${readCount(skill.freezeTurns)} lượt nếu cột đó có ít nhất ${freezeIfColumnHasRangedCount} tướng đánh xa`);
    } else if (freezeIfRowHasRangedCount > 0) {
      parts.push(`đóng băng ${readCount(skill.freezeTurns)} lượt nếu hàng đó có ít nhất ${freezeIfRowHasRangedCount} tướng đánh xa`);
    } else {
      parts.push(`đóng băng ${readCount(skill.freezeTurns)} lượt`);
    }
  }
  if (readCount(skill.disarmTurns, 0) > 0) parts.push(`giải giới ${readCount(skill.disarmTurns)} lượt`);
  if (readCount(skill.burnTurns, 0) > 0) parts.push(`thiêu đốt ${readCount(skill.burnTurns)} lượt`);
  if (readCount(skill.poisonTurns, 0) > 0) parts.push(`nhiễm độc ${readCount(skill.poisonTurns)} lượt`);
  if (readCount(skill.bleedTurns, 0) > 0) parts.push(`chảy máu ${readCount(skill.bleedTurns)} lượt`);
  if (readCount(skill.diseaseTurns, 0) > 0) parts.push(`bệnh ${readCount(skill.diseaseTurns)} lượt`);
  if (readCount(skill.armorBreakTurns, 0) > 0) parts.push(`giảm giáp ${readCount(skill.armorBreakTurns)} lượt`);
  if (readCount(skill.antiShieldBonusTurns, 0) > 0) {
    parts.push(`thêm ${readCount(skill.antiShieldBonusTurns)} lượt nếu mục tiêu có khiên hoặc là tanker`);
  }

  if (parts.length) return joinDurationParts(parts);
  return "tức thì";
}

function describeRuleSuffix(ruleKey: unknown): string {
  const normalized = normalizeText(ruleKey);
  switch (normalized) {
    case "lowest_hp_pct":
      return "% máu thấp nhất";
    case "lowest_hp_pct_ally":
      return "% máu thấp nhất";
    case "highest_rage":
      return "nhiều nộ nhất";
    case "highest_matk":
      return "MATK cao nhất";
    case "highest_max_hp_front":
      return "đứng gần tuyến trước nhất và có HP tối đa cao nhất";
    case "lowest_def_front":
      return "đứng gần tuyến trước nhất và có DEF thấp nhất";
    case "lowest_mdef_backline":
      return "ở tuyến sau và có MDEF thấp nhất";
    case "isolated_backline":
      return "ở tuyến sau và đứng tách";
    case "highest_atk":
      return "ATK cao nhất";
    case "highest_atk_backline":
      return "ở tuyến sau và có ATK cao nhất";
    case "lowest_rage_ally":
      return "ít nộ nhất";
    case "backline_caster":
      return "pháp sư hoặc con hỗ trợ ở tuyến sau";
    case "highest_total_atk_col":
      return "cột địch có tổng ATK cao nhất";
    case "same_row_carry":
      return "cùng hàng, ưu tiên sức tấn công cao nhất";
    case "random_unique":
      return "khác nhau ngẫu nhiên";
    case "random":
      return "ngẫu nhiên";
    case "backline_jump":
      return "hậu tuyến bị khóa";
    case "frontline_default":
      return "tuyến trước bị khóa";
    default:
      return SELECTOR_RULE_DESCRIPTIONS[normalized] ?? "";
  }
}

function describeRuleSuffixEn(ruleKey: unknown): string {
  const normalized = normalizeText(ruleKey);
  switch (normalized) {
    case "lowest_hp_pct":
      return "with the lowest HP%";
    case "lowest_hp_pct_ally":
      return "ally with the lowest HP%";
    case "highest_rage":
      return "with the highest rage";
    case "highest_matk":
      return "with the highest MATK";
    case "highest_max_hp_front":
      return "in the first enemy column with the highest max HP";
    case "lowest_def_front":
      return "in the first enemy column with the lowest DEF";
    case "lowest_mdef_backline":
      return "in the last enemy column with the lowest MDEF";
    case "isolated_backline":
      return "isolated in the last enemy column";
    case "highest_atk":
      return "with the highest ATK";
    case "highest_atk_backline":
      return "in the last enemy column with the highest ATK";
    case "lowest_rage_ally":
      return "ally with the lowest rage";
    case "backline_caster":
      return "backline mage or support";
    case "highest_total_atk_col":
      return "in the enemy column with the highest total ATK";
    case "same_row_carry":
      return "in the same row, prioritizing the highest attacker";
    case "random_unique":
      return "random unique targets";
    case "random":
      return "random targets";
    case "backline_jump":
      return "locked backline target";
    case "frontline_default":
      return "locked frontline target";
    default:
      return "";
  }
}

function deriveTargetText(skill: RuntimeSkillDefinition, selectionRule: string, affectedCount: string, currentTargetText: string): string {
  if (!skill || typeof skill !== "object") return currentTargetText;
  if (skill.effect === "revive_or_heal") {
    return `ưu tiên ${readCount(skill.reviveCount, 1)} đồng minh đã ngã xuống, nếu không có thì ${readCount(skill.healTargetCount, 3)} đồng minh % máu thấp nhất`;
  }
  if (skill.effect === "self_regen_team_heal") {
    return `bản thân và ${readCount(skill.maxTargets, 2)} đồng minh % máu thấp nhất`;
  }
  if (skill.effect === "team_shield") return "toàn bộ đồng minh";
  if (
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind"
  ) {
    return "toàn bộ kẻ địch";
  }
  if (skill.effect === "row_charge") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `toàn bộ kẻ địch ở ${suffix}` : "toàn bộ kẻ địch cùng hàng";
  }
  if (skill.effect === "frost_storm") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `toàn bộ kẻ địch ở ${suffix}` : "toàn bộ kẻ địch cùng cột";
  }
  if (skill.effect === "ink_blast_debuff") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `toàn bộ kẻ địch ở ${suffix}` : "toàn bộ kẻ địch cùng cột";
  }
  if (usesCross5Area(skill)) {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `tâm ${suffix}` : "tâm khóa chính của vùng thập 5 ô";
  }
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `vùng 3x3 quanh ${suffix}` : "vùng 3x3 quanh tâm ném";
  }
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") {
    return "mọi kẻ địch trong hình nón phía trước";
  }
  if (skill.effect === "team_rage") {
    return `${readCount(skill.maxTargets, 3)} đồng minh ít nộ nhất`;
  }
  if (skill.effect === "row_carry_rage_buff") {
    return `${readCount(skill.maxTargets, 2)} đồng minh cùng hàng có sức tấn công cao nhất`;
  }
  if (skill.effect === "row_random_rage_buff") {
    return `${readCount(skill.maxTargets, 2)} đồng minh ngẫu nhiên cùng hàng`;
  }
  if (skill.effect === "heal_over_time") {
    return `${readCount(skill.maxTargets, 3)} đồng minh % máu thấp nhất`;
  }
  if (skill.effect === "team_evade_buff") {
    if (readCount(skill.maxTargets, 0) > 0) return `${readCount(skill.maxTargets)} đồng minh % máu thấp nhất`;
    return "toàn bộ đồng minh";
  }
  if (skill.effect === "random_multi" || skill.effect === "arrow_rain" || skill.effect === "feather_bleed") {
    const count = readCount(skill.maxHits, 3);
    const suffix = describeRuleSuffix(selectionRule);
    const bonusTarget = normalizeText(skill.bonusTargetSelector);
    if (bonusTarget && !skill.bonusTargetConsumesHit) {
      const bonusSuffix = describeRuleSuffix(bonusTarget);
      const bonusText = bonusSuffix ? `, cộng thêm 1 mục tiêu ${bonusSuffix}` : ", cộng thêm 1 mục tiêu bonus";
      return suffix ? `${count} kẻ địch ${suffix}${bonusText}` : `${count} kẻ địch ngẫu nhiên${bonusText}`;
    }
    return suffix ? `${count} kẻ địch ${suffix}` : `${count} kẻ địch ngẫu nhiên`;
  }
  if (skill.effect === "chain_shock") {
    const count = readCount(skill.maxHits, 2);
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `${count} kẻ địch ${suffix}` : `${count} kẻ địch liên tiếp`;
  }
  if (skill.effect === "single_sleep") {
    const count = readCount(skill.maxTargets, 1);
    return count > 1 ? `${count} kẻ địch nhiều nộ nhất` : "kẻ địch nhiều nộ nhất";
  }
  if (skill.effect === "global_stun") {
    const stunCount = readCount(skill.stunMaxTargets, 0);
    if (stunCount > 0) {
      const stunRule = describeRuleSuffix(skill.stunSelector || "highest_rage");
      return stunRule ? `toàn bộ kẻ địch, choáng ${stunCount} mục tiêu ${stunRule}` : `toàn bộ kẻ địch, choáng ${stunCount} mục tiêu`;
    }
    return "toàn bộ kẻ địch";
  }
  if (skill.effect === "global_debuff_atk") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    if (debuffCount > 0) {
      const debuffRule = describeRuleSuffix(skill.debuffTargetSelector || "highest_atk");
      return debuffRule ? `toàn bộ kẻ địch, giảm ATK cho ${debuffCount} mục tiêu ${debuffRule}` : `toàn bộ kẻ địch, giảm ATK cho ${debuffCount} mục tiêu`;
    }
    return "toàn bộ kẻ địch";
  }
  if (affectedCount === "1 (2 hits)") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `1 kẻ địch ${suffix}` : "1 kẻ địch";
  }
  if (affectedCount === "1 + echo") {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `1 kẻ địch ${suffix}` : "1 kẻ địch";
  }
  if (affectedCount === "1 + adjacent" || String(affectedCount).startsWith("1 + adjacent")) {
    const suffix = describeRuleSuffix(selectionRule);
    return suffix ? `1 kẻ địch ${suffix}, rồi lan sang ô kề` : "1 kẻ địch, rồi lan sang ô kề";
  }

  const count = readCount(skill.maxTargets, 0) || readCount(skill.maxHits, 0);
  const suffix = describeRuleSuffix(selectionRule);
  if (count > 0) {
    const teamWord = selectionRule.includes("_ally") || selectionRule.includes("lowest_rage_ally")
      ? "đồng minh"
      : "kẻ địch";
    if (suffix) return `${count} ${teamWord} ${suffix}`;
    return `${count} ${teamWord}`;
  }
  if (suffix) {
    const teamWord = selectionRule.includes("_ally") ? "đồng minh" : "kẻ địch";
    return `${teamWord} ${suffix}`;
  }
  return currentTargetText;
}

function deriveTargetTextEn(skill: RuntimeSkillDefinition, selectionRule: string, affectedCount: string, currentTargetText: string): string {
  if (!skill || typeof skill !== "object") return currentTargetText;
  if (skill.effect === "revive_or_heal") {
    return `revive ${readCount(skill.reviveCount, 1)} fallen ally first, otherwise heal ${readCount(skill.healTargetCount, 3)} allies with the lowest HP%`;
  }
  if (skill.effect === "self_regen_team_heal") {
    return `self and ${readCount(skill.maxTargets, 2)} allies with the lowest HP%`;
  }
  if (skill.effect === "team_shield") return "all allies";
  if (
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind"
  ) {
    return "all enemies";
  }
  if (skill.effect === "row_charge") {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `all enemies ${suffix}` : "all enemies in the targeted row";
  }
  if (skill.effect === "frost_storm") {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `all enemies ${suffix}` : "all enemies in the targeted column";
  }
  if (skill.effect === "ink_blast_debuff") {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `all enemies ${suffix}` : "all enemies in the targeted column";
  }
  if (usesCross5Area(skill)) {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `chosen center ${suffix}` : "chosen center of the 5-tile cross";
  }
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `3x3 area around the target ${suffix}` : "3x3 area around the chosen center";
  }
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") {
    return "all enemies inside the forward cone";
  }
  if (skill.effect === "team_rage") {
    return `${readCount(skill.maxTargets, 3)} allies with the lowest rage`;
  }
  if (skill.effect === "row_carry_rage_buff") {
    return `${readCount(skill.maxTargets, 2)} same-row allies with the highest attack`;
  }
  if (skill.effect === "row_random_rage_buff") {
    return `${readCount(skill.maxTargets, 2)} random same-row allies`;
  }
  if (skill.effect === "heal_over_time") {
    return `${readCount(skill.maxTargets, 3)} allies with the lowest HP%`;
  }
  if (skill.effect === "team_evade_buff") {
    if (readCount(skill.maxTargets, 0) > 0) return `${readCount(skill.maxTargets)} allies with the lowest HP%`;
    return "all allies";
  }
  if (skill.effect === "random_multi" || skill.effect === "arrow_rain" || skill.effect === "feather_bleed") {
    const count = readCount(skill.maxHits, 3);
    const suffix = describeRuleSuffixEn(selectionRule);
    const bonusTarget = normalizeText(skill.bonusTargetSelector);
    if (bonusTarget && !skill.bonusTargetConsumesHit) {
      const bonusSuffix = describeRuleSuffixEn(bonusTarget);
      const bonusText = bonusSuffix ? ` plus 1 bonus target ${bonusSuffix}` : " plus 1 bonus target";
      return suffix ? `${count} enemies ${suffix}${bonusText}` : `${count} random enemies${bonusText}`;
    }
    return suffix ? `${count} enemies ${suffix}` : `${count} random enemies`;
  }
  if (skill.effect === "chain_shock") {
    const count = readCount(skill.maxHits, 2);
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `${count} enemies ${suffix}` : `${count} chained enemies`;
  }
  if (skill.effect === "single_sleep") {
    const count = readCount(skill.maxTargets, 1);
    return count > 1 ? `${count} enemies with the highest rage` : "enemy with the highest rage";
  }
  if (skill.effect === "global_stun") {
    const stunCount = readCount(skill.stunMaxTargets, 0);
    if (stunCount > 0) {
      const stunRule = describeRuleSuffixEn(skill.stunSelector || "highest_rage");
      return stunRule ? `all enemies, stunning ${stunCount} targets ${stunRule}` : `all enemies, stunning ${stunCount} targets`;
    }
    return "all enemies";
  }
  if (skill.effect === "global_debuff_atk") {
    const debuffCount = readCount(skill.debuffMaxTargets, 0);
    if (debuffCount > 0) {
      const debuffRule = describeRuleSuffixEn(skill.debuffTargetSelector || "highest_atk");
      return debuffRule ? `all enemies, debuffing ${debuffCount} targets ${debuffRule}` : `all enemies, debuffing ${debuffCount} targets`;
    }
    return "all enemies";
  }
  if (affectedCount === "1 (2 hits)" || affectedCount === "1 + echo") {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `1 enemy ${suffix}` : "1 enemy";
  }
  if (affectedCount === "1 + adjacent" || String(affectedCount).startsWith("1 + adjacent")) {
    const suffix = describeRuleSuffixEn(selectionRule);
    return suffix ? `1 enemy ${suffix}, then adjacent targets` : "1 enemy, then adjacent targets";
  }

  const count = readCount(skill.maxTargets, 0) || readCount(skill.maxHits, 0);
  const suffix = describeRuleSuffixEn(selectionRule);
  if (count > 0) {
    const teamWord = selectionRule.includes("_ally") || selectionRule.includes("lowest_rage_ally")
      ? "allies"
      : "enemies";
    if (suffix) return `${count} ${teamWord} ${suffix}`;
    return `${count} ${teamWord}`;
  }
  if (suffix) {
    const teamWord = selectionRule.includes("_ally") ? "ally" : "enemy";
    return `${teamWord} ${suffix}`;
  }
  return currentTargetText;
}

function deriveShapeText(skill: RuntimeSkillDefinition, currentShapeText: string): string {
  if (!skill || typeof skill !== "object") return currentShapeText;
  if (skill.effect === "row_charge") return "quét toàn bộ một hàng địch";
  if (skill.effect === "frost_storm") return "quét toàn bộ một cột địch";
  if (skill.effect === "ink_blast_debuff") return "quét toàn bộ một cột địch";
  if (usesCross5Area(skill)) return "hình thập 5 ô quanh tâm";
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") return "vùng vuông 3x3 quanh tâm";
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") return "vùng nón 3-5 ô phía trước";
  if (
    skill.effect === "global_stun" ||
    skill.effect === "global_debuff_atk" ||
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind"
  ) {
    return "toàn bàn địch";
  }
  if (skill.effect === "team_shield") return "toàn bàn đồng minh";
  if (skill.effect === "random_multi" || skill.effect === "arrow_rain" || skill.effect === "feather_bleed") {
    return "nhiều ô rải ngẫu nhiên trên bàn địch";
  }
  if (skill.effect === "chain_shock") return "chuỗi chớp nhảy qua các mục tiêu đã chọn";
  if (skill.effect === "heal_over_time" || skill.effect === "team_rage" || skill.effect === "team_evade_buff") {
    return "nhóm đồng minh được chọn";
  }
  if (skill.effect === "row_carry_rage_buff") return "nhóm đồng minh cùng hàng của bản thân";
  if (skill.effect === "row_random_rage_buff") return "nhóm đồng minh ngẫu nhiên cùng hàng của bản thân";
  if (skill.effect === "revive_or_heal") return "ưu tiên hồi sinh, nếu không có thì nhóm hồi máu";
  if (skill.effect === "self_regen_team_heal") return "bản thân + nhóm đồng minh hỗ trợ";
  if (skill.allySelector || skill.targetGroup === "ally") return "nhóm đồng minh được chọn";
  if (skill.targetSelector) return "1 ô khóa mục tiêu";
  if (skill.actionPattern === "SELF") return "tự thân hoặc nhóm đồng minh quanh bản thân";
  if (skill.actionPattern === "RANGED_STATIC") return "1 ô khóa mục tiêu";
  if (skill.actionPattern === "ASSASSIN_BACK") return "lao vào 1 ô hậu tuyến";
  if (skill.actionPattern === "MELEE_FRONT") return "1 ô áp sát tiền tuyến";
  if (readCount(skill.maxHits, 0) > 0 || readCount(skill.maxTargets, 0) > 0) return "1 ô đơn mục tiêu";
  return currentShapeText;
}

function deriveShapeTextEn(skill: RuntimeSkillDefinition, currentShapeText: string): string {
  if (!skill || typeof skill !== "object") return currentShapeText;
  if (skill.effect === "row_charge") return "full enemy row sweep";
  if (skill.effect === "frost_storm") return "full enemy column sweep";
  if (skill.effect === "ink_blast_debuff") return "full enemy column sweep";
  if (usesCross5Area(skill)) return "5-tile cross around the center";
  if (skill.effect === "aoe_circle_stun" || skill.effect === "dust_sleep") return "3x3 square around the center";
  if (skill.effect === "cone_shot" || skill.effect === "fire_breath_cone" || skill.effect === "cone_smash") return "3-5 tile forward cone";
  if (
    skill.effect === "global_stun" ||
    skill.effect === "global_debuff_atk" ||
    skill.effect === "global_fire" ||
    skill.effect === "global_poison_team" ||
    skill.effect === "flash_blind"
  ) {
    return "entire enemy board";
  }
  if (skill.effect === "team_shield") return "entire allied board";
  if (skill.effect === "random_multi" || skill.effect === "arrow_rain" || skill.effect === "feather_bleed") {
    return "random spread across the enemy board";
  }
  if (skill.effect === "chain_shock") return "non-repeating lightning chain";
  if (skill.effect === "heal_over_time" || skill.effect === "team_rage" || skill.effect === "team_evade_buff") {
    return "selected ally group";
  }
  if (skill.effect === "row_carry_rage_buff") return "same-row ally group";
  if (skill.effect === "row_random_rage_buff") return "random same-row ally group";
  if (skill.effect === "revive_or_heal") return "revive branch first, otherwise healing group";
  if (skill.effect === "self_regen_team_heal") return "self plus support ally group";
  if (skill.allySelector || skill.targetGroup === "ally") return "selected ally group";
  if (skill.targetSelector) return "locked target tile";
  if (skill.actionPattern === "SELF") return "self or allied area around the caster";
  if (skill.actionPattern === "RANGED_STATIC") return "locked target tile";
  if (skill.actionPattern === "ASSASSIN_BACK") return "single backline dive tile";
  if (skill.actionPattern === "MELEE_FRONT") return "single frontline melee tile";
  if (readCount(skill.maxHits, 0) > 0 || readCount(skill.maxTargets, 0) > 0) return "single-target tile";
  return currentShapeText;
}

function shouldOverrideTargetText(skill: RuntimeSkillDefinition, targetText: string, selectionRule: string, affectedCount: string): boolean {
  const normalized = normalizeText(targetText);
  if (!normalized) return true;
  if (isGenericTargetText(normalized)) return true;
  if (skill?.effect === "global_stun" || skill?.effect === "global_debuff_atk") return true;
  if (selectionRule === "dead_ally_first -> lowest_hp_pct_ally") return true;
  if (selectionRule === "self -> lowest_hp_pct_ally") return true;
  const numericCount = readCount(skill?.maxHits, 0) || readCount(skill?.maxTargets, 0);
  if (numericCount > 0 && !normalized.includes(String(numericCount)) && /^\d+$/.test(String(affectedCount))) {
    return true;
  }
  if (selectionRule.includes("highest_rage") && !normalizeTextKey(normalized).includes("no")) return false;
  return false;
}

function shouldOverrideShapeText(shapeText: unknown): boolean {
  return !normalizeText(shapeText) || isGenericShapeText(shapeText);
}

function materializeSkillClarity(skill: RuntimeSkillDefinition, star: number): RuntimeRecord {
  const currentTargetText = resolveRenderableText(skill?.targetText, star);
  const currentShapeText = resolveRenderableText(skill?.shapeText, star);
  const currentTargetTextEn = resolveRenderableText(skill?.targetTextEn, star);
  const currentShapeTextEn = resolveRenderableText(skill?.shapeTextEn, star);
  const selectionRule = deriveSelectionRule(skill);
  const affectedCount = deriveAffectedCount(skill);
  const durationRule = deriveDurationRule(skill);
  const targetText = shouldOverrideTargetText(skill, currentTargetText, selectionRule, affectedCount)
    ? deriveTargetText(skill, selectionRule, affectedCount, currentTargetText)
    : currentTargetText;
  const shapeText = shouldOverrideShapeText(currentShapeText)
    ? deriveShapeText(skill, currentShapeText)
    : currentShapeText;
  const targetTextEn = shouldOverrideTargetText(skill, currentTargetTextEn, selectionRule, affectedCount)
    ? deriveTargetTextEn(skill, selectionRule, affectedCount, currentTargetTextEn)
    : currentTargetTextEn;
  const shapeTextEn = shouldOverrideShapeText(currentShapeTextEn)
    ? deriveShapeTextEn(skill, currentShapeTextEn)
    : currentShapeTextEn;

  return {
    targetText: normalizeText(targetText),
    targetTextEn: normalizeText(targetTextEn),
    shapeText: normalizeText(shapeText),
    shapeTextEn: normalizeText(shapeTextEn),
    selectionRuleText: formatSelectionRule(selectionRule),
    selectionRuleTextEn: formatSelectionRule(selectionRule),
    selectionRuleTextVi: formatSelectionRuleVi(selectionRule),
    affectedCountText: normalizeText(affectedCount),
    affectedCountTextEn: normalizeText(affectedCount),
    affectedCountTextVi: deriveAffectedCountVi(skill),
    durationRuleText: normalizeText(durationRule),
    durationRuleTextEn: normalizeText(durationRule),
    durationRuleTextVi: deriveDurationRuleVi(skill)
  };
}

export const TEMPORARY_SHOP_SKILL_DATA_VERSION = "2026-03-11";

export function isStaleLegacyStarText(text: unknown): boolean {
  const normalized = toAsciiLower(text);
  return STALE_STAR_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function resolveLegacySkillStarDescriptions(fallback: Record<string, unknown> = {}): Record<number, string> {
  const normalized: Record<number, string> = {};
  for (const star of [1, 2, 3]) {
    const value = fallback[star] ?? fallback[String(star)] ?? "";
    normalized[star] = isStaleLegacyStarText(value) ? "" : String(value).trim();
  }
  return normalized;
}

export function finalizeSkillRuntime(skill: RuntimeSkillDefinition | null | undefined, star = 1): RuntimeSkillDefinition {
  const result = cloneDeep<RuntimeSkillDefinition>(skill ?? {});
  const resolvedStar = normalizeStar(star);
  const starMods = result.starMods ?? {};
  const starMod = starMods[String(resolvedStar)] ?? {};
  mergeInto(result, starMod);
  if (starMod?.patchTooltipDef) {
    result.tooltipDef = mergeInto((result.tooltipDef ?? {}) as RuntimeRecord, starMod.patchTooltipDef);
  }
  if (starMod?.patchRuntimeSkill) {
    mergeInto(result, starMod.patchRuntimeSkill);
  }

  const resolvedCost = Number(resolveStarMappedValue(result.costByStar, resolvedStar, result.cost as RuntimeScalar));
  if (Number.isFinite(resolvedCost) && resolvedCost > 0) {
    result.cost = Math.max(1, Math.round(resolvedCost));
  }

  const resolvedPowerScale = Number(resolveStarMappedValue(result.powerScaleByStar, resolvedStar, (result.powerScale ?? 1) as RuntimeScalar));
  if (Number.isFinite(resolvedPowerScale) && resolvedPowerScale > 0) {
    result.powerScale = Number(resolvedPowerScale.toFixed(4));
    applyPowerScaleToSkill(result, resolvedPowerScale);
  }

  const resolvedOffenseDebuffValue = Number(result.offenseDebuffValue ?? result.atkDebuffValue);
  const resolvedOffenseDebuffTurns = Number(result.offenseDebuffTurns ?? result.atkDebuffTurns);
  if (Number.isFinite(resolvedOffenseDebuffValue) && resolvedOffenseDebuffValue > 0) {
    result.offenseDebuffValue = Math.max(1, Math.round(resolvedOffenseDebuffValue));
  }
  if (Number.isFinite(resolvedOffenseDebuffTurns) && resolvedOffenseDebuffTurns > 0) {
    result.offenseDebuffTurns = Math.max(1, Math.round(resolvedOffenseDebuffTurns));
  }
  const offenseDebuffMode = inferOffenseDebuffMode(result);
  if (offenseDebuffMode) {
    result.offenseDebuffMode = offenseDebuffMode;
    result.offenseDebuffStat = offenseDebuffMode === "matk" || offenseDebuffMode === "atk"
      ? offenseDebuffMode
      : "atk";
  }

  const clarity = materializeSkillClarity(result, resolvedStar);
  result.targetText = clarity.targetText;
  result.targetTextEn = clarity.targetTextEn;
  result.shapeText = clarity.shapeText;
  result.shapeTextEn = clarity.shapeTextEn;
  result.selectionRuleText = clarity.selectionRuleText;
  result.selectionRuleTextEn = clarity.selectionRuleTextEn;
  result.selectionRuleTextVi = clarity.selectionRuleTextVi;
  result.affectedCountText = clarity.affectedCountText;
  result.affectedCountTextEn = clarity.affectedCountTextEn;
  result.affectedCountTextVi = clarity.affectedCountTextVi;
  result.durationRuleText = clarity.durationRuleText;
  result.durationRuleTextEn = clarity.durationRuleTextEn;
  result.durationRuleTextVi = clarity.durationRuleTextVi;
  const tooltipDef: RuntimeRecord = isRuntimeRecord(result.tooltipDef) ? result.tooltipDef : {};
  const tooltipModel: RuntimeRecord = isRuntimeRecord(result.tooltipModel) ? result.tooltipModel : {};
  result.tooltipDef = sanitizeVietnameseFieldMap(tooltipDef);
  result.tooltipModel = sanitizeVietnameseFieldMap(tooltipModel);

  [
    "descriptionVi",
    "summaryTextVi",
    "detailTextVi",
    "upgradeTextVi",
    "effectLabelVi",
    "castTypeTextVi",
    "targetTextVi",
    "shapeTextVi",
    "selectionRuleTextVi",
    "affectedCountTextVi",
    "durationRuleTextVi",
    "areaDescriptionVi"
  ].forEach((field) => {
    const rawValue = result[field];
    if (typeof rawValue !== "string") return;
    const sanitizedValue = sanitizeVietnamesePlayerText(rawValue);
    result[field] = sanitizedValue;
    const baseField = field.replace(/Vi$/, "");
    if (typeof result[baseField] === "string" && result[baseField] === rawValue) {
      result[baseField] = sanitizedValue;
    }
  });
  [
    "description",
    "detailText",
    "upgradeText",
    "effectLabel",
    "castTypeText",
    "targetText",
    "shapeText",
    "selectionRuleText",
    "affectedCountText",
    "durationRuleText",
    "areaDescription"
  ].forEach((field) => {
    const rawValue = result[field];
    if (typeof rawValue !== "string") return;
    if (!containsVietnamesePlayerJargon(rawValue)) return;
    result[field] = sanitizeVietnamesePlayerText(rawValue);
  });
  return result;
}
