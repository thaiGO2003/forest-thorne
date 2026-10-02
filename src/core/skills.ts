// Structured skill specs derived from the authored per-star Vietnamese skill text (A41/A83).
// The catalog only ships prose, so combat reads this parsed form; text stays the single source of truth.
// ponytail: regex parse covers authored phrasing patterns; families with bespoke mechanics
// (link, mirror, metamorphosis...) degrade to their parsed damage/heal/buff parts. Add per-family handlers when authored.
import { getUnit } from "../content/catalog";

export type Stat = "atk" | "matk" | "def" | "mdef" | "hp";
export type DamageType = "physical" | "magic" | "true";
export type DotKind = "bleed" | "burn" | "poison" | "disease";
export type ControlKind = "stun" | "freeze" | "sleep" | "silence" | "disarm" | "taunt";
export type BuffStat = "atk" | "matk" | "def" | "mdef" | "evade";
export type Area = "single" | "all" | "row" | "column" | "square";
export type SkillSelector =
  | "lowest_hp_pct" | "lowest_hp_pct_ally" | "highest_rage" | "lowest_rage_ally"
  | "highest_matk" | "highest_atk" | "highest_max_hp_front" | "lowest_def_front"
  | "lowest_mdef_backline" | "highest_atk_backline" | "isolated_backline" | "backline_caster"
  | "most_clustered_row" | "most_clustered_col" | "highest_total_atk_row" | "highest_total_atk_col"
  | "random" | "random_unique" | "same_row" | "same_row_carry" | "same_column" | "front_cone"
  | "self" | "frontline_default" | "backline_jump" | "primary_target";

export interface Formula { base: number; scale: number; stat: Stat }
export interface StatMod { stat: BuffStat; value: number; pct: boolean; turns: number }

export interface SkillSpec {
  /** Who the primary effect lands on. */
  side: "enemy" | "ally" | "self";
  count: number;
  area: Area;
  selector: SkillSelector;
  pickLowestHp: boolean;
  damage: (Formula & { type: DamageType }) | null;
  dots: { kind: DotKind; value: number; turns: number }[];
  controls: { kind: ControlKind; turns: number }[];
  /** Heal: flat formula or % of target max HP. */
  heal: { formula: Formula | null; pctMaxHp: number } | null;
  selfHealPctMaxHp: number;
  lifestealPct: number;
  shield: Formula | null;
  buffs: StatMod[];
  debuffs: StatMod[];
  rageGrant: number;
  revivePct: number;
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const STAT_WORD = String.raw`(ATK|MATK|DEF|MDEF|HP tối đa|HP)`;
const FORMULA = new RegExp(String.raw`\(${NUM}\s*\+\s*(?:${NUM}\s*x\s*|${NUM}%\s*)${STAT_WORD}\)`);
const STAT_KEY: Record<string, Stat> = { ATK: "atk", MATK: "matk", DEF: "def", MDEF: "mdef", HP: "hp", "HP tối đa": "hp" };
const DOT_WORD: Record<string, DotKind> = { "chảy máu": "bleed", "thiêu đốt": "burn", "nhiễm độc": "poison", "độc": "poison", "mắc bệnh": "disease" };
const CONTROL_WORD: Record<string, ControlKind> = {
  "choáng": "stun", "đóng băng": "freeze", "ngủ": "sleep", "câm lặng": "silence", "tước vũ khí": "disarm", "khiêu khích": "taunt",
};
const BUFF_WORD: Record<string, BuffStat> = { ATK: "atk", MATK: "matk", DEF: "def", MDEF: "mdef", "né tránh": "evade" };

function selectorFromText(text: string, side: SkillSpec["side"], family = ""): SkillSelector {
  const t = text.toLowerCase();
  if (side === "self") return "self";
  if (/ngẫu nhiên/.test(t) && /(không trùng|khác nhau|duy nhất)/.test(t)) return "random_unique";
  if (/ngẫu nhiên/.test(t)) return "random";
  if (/nộ cao nhất/.test(t)) return "highest_rage";
  if (/nộ thấp nhất/.test(t) && side === "ally") return "lowest_rage_ally";
  if (/(% máu|% hp).*thấp nhất|thấp máu nhất/.test(t)) return side === "ally" ? "lowest_hp_pct_ally" : "lowest_hp_pct";
  if (/(cột cuối|hậu tuyến).*(mdef thấp nhất|kháng phép thấp nhất)/.test(t)) return "lowest_mdef_backline";
  if (/(cột cuối|hậu tuyến).*atk cao nhất/.test(t)) return "highest_atk_backline";
  if (/(cột cuối|hậu tuyến).*(tách|cô lập)/.test(t)) return "isolated_backline";
  if (/(cột cuối|hậu tuyến).*(pháp sư|hỗ trợ)/.test(t)) return "backline_caster";
  if (/(cột đầu|tuyến trước|hàng trước).*(hp tối đa cao nhất|máu tối đa cao nhất)/.test(t)
    || /(hp tối đa cao nhất|máu tối đa cao nhất).*(cột đầu|tuyến trước|hàng trước)/.test(t)) return "highest_max_hp_front";
  if (/(cột đầu|tuyến trước|hàng trước).*(def thấp nhất|giáp thấp nhất)/.test(t)
    || /(def thấp nhất|giáp thấp nhất).*(cột đầu|tuyến trước|hàng trước)/.test(t)) return "lowest_def_front";
  if (/hàng.*tổng atk.*cao nhất|tổng atk.*hàng.*cao nhất/.test(t)) return "highest_total_atk_row";
  if (/cột.*tổng atk.*cao nhất|tổng atk.*cột.*cao nhất/.test(t)) return "highest_total_atk_col";
  if (/hàng.*đông nhất|cụm.*hàng/.test(t)) return "most_clustered_row";
  if (/cột.*đông nhất|cụm.*cột/.test(t)) return "most_clustered_col";
  if (/matk cao nhất/.test(t)) return "highest_matk";
  if (/atk cao nhất/.test(t)) return "highest_atk";
  if (/cùng hàng.*chủ lực|chủ lực.*cùng hàng/.test(t)) return "same_row_carry";
  if (/cùng hàng/.test(t)) return "same_row";
  if (/cùng cột/.test(t)) return "same_column";
  if (/hình nón|cone/.test(t)) return "front_cone";
  if (family === "chain_shock" || family === "single_sleep") return "highest_rage";
  if (family === "row_carry_rage_buff") return "same_row_carry";
  if (family === "row_random_rage_buff") return "random_unique";
  if (family === "row_charge") return "same_row";
  if (family === "frost_storm" || family === "ink_blast_debuff") return "same_column";
  if (family === "cone_shot" || family === "fire_breath_cone" || family === "cone_smash") return "front_cone";
  if (family === "revive_or_heal" || family === "heal_over_time" || family === "team_evade_buff"
    || family === "mass_cleanse" || family === "team_rage_self_heal" || family === "mimic_rage_buff") return "lowest_hp_pct_ally";
  return "frontline_default";
}

function formulaAt(m: RegExpMatchArray | null): Formula | null {
  if (!m) return null;
  const scale = m[2] !== undefined ? Number(m[2]) : Number(m[3]) / 100;
  return { base: Number(m[1]), scale, stat: STAT_KEY[m[4]!]! };
}

/** Duration of the first "N lượt" after `from` within the same sentence; default 1. */
function turnsAfter(text: string, from: number): number {
  const rest = text.slice(from);
  const end = rest.search(/\.(?!\d)/);
  const m = /(\d+) lượt/.exec(end < 0 ? rest : rest.slice(0, end));
  return m ? Number(m[1]) : 1;
}

function statMods(text: string, verb: "tăng" | "giảm"): StatMod[] {
  const out: StatMod[] = [];
  const re = new RegExp(String.raw`${verb === "tăng" ? "(?:[Tt]ăng|nhận)" : "[Gg]iảm"} ${NUM}(%?) (ATK|MATK|DEF|MDEF|né tránh)(?: và ${NUM}(%?) (ATK|MATK|DEF|MDEF|né tránh))?`, "g");
  for (const m of text.matchAll(re)) {
    const turns = turnsAfter(text, m.index!);
    out.push({ stat: BUFF_WORD[m[3]!]!, value: Number(m[1]), pct: m[2] === "%", turns });
    if (m[6]) out.push({ stat: BUFF_WORD[m[6]]!, value: Number(m[4]), pct: m[5] === "%", turns });
  }
  // "giảm 15 ATK hoặc MATK theo vai trò" — offense debuff by role (A15 autoByRole) is stored as atk; resolver maps by role.
  return out;
}

export function parseSkill(text: string): SkillSpec {
  const t = text.replace(/\s+/g, " ");
  const dmgM = t.match(new RegExp(String.raw`(?:[Gg]ây|chịu) \[?${FORMULA.source}(?:(?!\.\s)[^])*?(?:sát thương (vật lý|phép|chuẩn)|$|\.\s)`));
  const STAT_TYPE = { atk: "physical", matk: "magic" } as Record<Stat, DamageType>;
  const dmgF = formulaAt(dmgM);
  const damage = dmgF ? { ...dmgF, type: dmgM![5] ? ({ "vật lý": "physical", "phép": "magic", "chuẩn": "true" } as const)[dmgM![5] as "vật lý"] : STAT_TYPE[dmgF.stat] ?? "physical" } : null;

  const dots: SkillSpec["dots"] = [];
  for (const m of t.matchAll(/(chảy máu|thiêu đốt|nhiễm độc|mắc bệnh|độc) (\d+) mỗi lượt(?: trong (\d+) lượt)?/g)) {
    dots.push({ kind: DOT_WORD[m[1]!]!, value: Number(m[2]), turns: m[3] ? Number(m[3]) : turnsAfter(t, m.index!) });
  }
  const controls: SkillSpec["controls"] = [];
  for (const m of t.matchAll(/(choáng|đóng băng|câm lặng|tước vũ khí|khiêu khích|(?<![a-zà-ỹ])ngủ(?![a-zà-ỹ]))/g)) {
    const kind = CONTROL_WORD[m[1]!]!;
    if (!controls.some((c) => c.kind === kind)) controls.push({ kind, turns: turnsAfter(t, m.index!) });
  }

  const allyHeal = /[Hh]ồi (?:dần )?(?:máu )?(\d+)% HP tối đa(?: trong \d+ lượt)? cho (?!bản)/.exec(t);
  const flatHeal = t.match(new RegExp(String.raw`(?:[Hh]ồi|lượng máu bằng)[^.()]*?${FORMULA.source}`)) ?? t.match(/hồi (\d+) HP/);
  let heal: SkillSpec["heal"] = null;
  if (allyHeal) heal = { formula: null, pctMaxHp: Number(allyHeal[1]) / 100 };
  else if (flatHeal) heal = { formula: flatHeal[4] ? formulaAt(flatHeal) : { base: Number(flatHeal[1]), scale: 0, stat: "matk" }, pctMaxHp: 0 };
  const selfHeal = /(?:Tự hồi|hồi) (\d+)% HP tối đa(?: cho bản thân)?(?!\s*(?:trong \d+ lượt )?cho (?!bản))/.exec(t);
  const steal = /hút (\d+)% sát thương|hồi máu bằng (\d+)% sát thương/.exec(t);

  const shieldM = t.match(new RegExp(String.raw`khiên(?: bằng)? ${FORMULA.source}`)) ?? t.match(/khiên (\d+)/);
  const shield = shieldM ? (shieldM[4] ? formulaAt(shieldM) : { base: Number(shieldM[1]), scale: 0, stat: "def" as Stat }) : null;

  const rage = /(?:Bơm|tăng|hồi) (\d+) nộ/.exec(t);
  const revive = /Hồi sinh[^.]*?(\d+)% HP/.exec(t);

  const enemyFirst = t.search(/kẻ địch/);
  const allyFirst = t.search(/đồng minh/);
  const selfOnly = /^(Tự |Cuộn tròn|Vào thế|Hóa kén|Đặt trạng thái)/.test(t);
  const side: SkillSpec["side"] = damage || (enemyFirst >= 0 && (allyFirst < 0 || enemyFirst < allyFirst)) ? "enemy"
    : selfOnly && allyFirst < 0 ? "self" : allyFirst >= 0 ? "ally" : "self";

  let area: Area = "single";
  if (/toàn bộ (kẻ địch|đồng minh)|cả chiến trường|toàn bản đồ/.test(t)) area = "all";
  else if (/cả cột|cột (địch|đồng minh)? ?đông nhất|toàn bộ đồng minh cùng cột/.test(t)) area = "column";
  else if (/cả hàng|cùng hàng[^.]*toàn bộ|toàn hàng/.test(t)) area = "row";
  else if (/\dx\d/.test(t)) area = "square";
  const countM = new RegExp(String.raw`(\d+) (?:${side === "ally" ? "đồng minh" : "kẻ địch|mục tiêu|lông vũ|mũi tên|phi tiêu"})`).exec(t);

  return {
    side, area, count: Math.max(1, countM ? Number(countM[1]) : 1),
    selector: selectorFromText(t, side),
    pickLowestHp: /% máu thấp nhất|thấp máu nhất/.test(t),
    damage, dots, controls, heal,
    selfHealPctMaxHp: selfHeal && !allyHeal ? Number(selfHeal[1]) / 100 : 0,
    lifestealPct: steal ? Number(steal[1] ?? steal[2]) / 100 : 0,
    shield, buffs: statMods(t, "tăng"), debuffs: statMods(t, "giảm"),
    rageGrant: rage ? Number(rage[1]) : 0,
    revivePct: revive ? Number(revive[1]) / 100 : 0,
  };
}

const CACHE: Record<string, SkillSpec> = {};
/** Star-specific skill spec (falls back to 1★ text when a star row is missing). */
export function skillSpec(baseId: string, star: number): SkillSpec {
  const resolvedStar = Math.max(1, Math.min(3, Math.trunc(Number.isFinite(star) ? star : 1)));
  const key = `${baseId}:${resolvedStar}`;
  const cached = CACHE[key];
  if (cached) return cached;
  const u = getUnit(baseId);
  const detail = u.skill.starDetailVi[resolvedStar - 1] ?? u.skill.starDetailVi[0] ?? "";
  if (!u.boss) {
    const s = parseSkill(detail);
    const authoredTargeting = [u.skill.selectionVi, u.skill.targetVi, u.skill.shapeVi, detail].filter(Boolean).join(" ");
    s.selector = selectorFromText(authoredTargeting, s.side, u.skill.family);
    return (CACHE[key] = s);
  }
  // Boss skill prose has no numbers. ponytail: battlefield-wide 1.5× primary-stat hit plus parsed status words;
  // replace with authored boss numbers when the data ships them.
  const s = parseSkill(u.skill.detailVi ?? "");
  const magic = u.stats.matk > u.stats.atk;
  s.side = "enemy";
  s.area = "all";
  s.selector = "frontline_default";
  s.damage ??= { base: 0, scale: 1.5, stat: magic ? "matk" : "atk", type: magic ? "magic" : "physical" };
  return (CACHE[key] = s);
}
