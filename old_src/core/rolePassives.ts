const ROLE_PASSIVE_TEXT = Object.freeze({
  TANKER: Object.freeze({
    vi: "Khi đầy nộ và bị tấn công, lập tức tự tung kỹ năng.",
    en: "When full on rage and attacked, immediately auto-casts its skill."
  }),
  MAGE: Object.freeze({
    vi: "Là vai trò duy nhất hồi nộ sau khi tung kỹ năng. Hồi lại 1 nộ cho mỗi kẻ địch dính skill.",
    en: "The only role that refunds rage after casting. Restores 1 rage for each enemy hit by the skill."
  }),
  ASSASSIN: Object.freeze({
    vi: "Tự kết liễu mục tiêu sẽ tích vàng thưởng cuối trận. Mỗi mạng: 1 sao +1 vàng, 2 sao +2 vàng, 3 sao +3 vàng.",
    en: "Last-hitting a target stores bonus gold for end of battle. Per kill: 1-star +1 gold, 2-star +2 gold, 3-star +3 gold."
  }),
  FIGHTER: Object.freeze({
    vi: "Mỗi 1% máu đã mất đổi thành +1% ATK.",
    en: "Each 1% missing HP grants +1% ATK."
  }),
  ARCHER: Object.freeze({
    vi: "Mỗi ô cách xa mục tiêu: +5% hụt, nhưng +5% tỉ lệ chí mạng và +5% sát thương bạo kích.",
    en: "Each tile away from the target: +5% miss chance, but +5% crit chance and +5% crit damage."
  }),
  SUPPORT: Object.freeze({
    vi: "Nếu đánh thường hồi đầy nộ, lập tức tự tung kỹ năng.",
    en: "If a basic attack fills rage, immediately auto-casts the skill."
  })
} as const);

export function getRolePassiveSectionTitle(locale: string = "vi"): string {
  return locale === "en" ? "Passive" : "Nội tại";
}

export function getRolePassiveDescription(classType: string, locale: string = "vi"): string {
  const entry = ROLE_PASSIVE_TEXT[String(classType ?? "").toUpperCase() as keyof typeof ROLE_PASSIVE_TEXT];
  if (!entry) return "";
  return locale === "en" ? entry.en : entry.vi;
}

export function getRolePassiveLines(classType: string, locale: string = "vi"): string[] {
  const description = getRolePassiveDescription(classType, locale);
  return description
    ? String(description).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
}

export function getAssassinBountyGoldPerKill(star: number = 1): number {
  const safeStar = Number.isFinite(Number(star)) ? Math.max(1, Math.floor(Number(star))) : 1;
  if (safeStar >= 3) return 3;
  if (safeStar >= 2) return 2;
  return 1;
}

interface UnitLike {
  classType?: string;
  base?: { classType?: string };
  maxHp?: number;
  hp?: number;
}

export function getFighterMissingHpAtkPct(unit: UnitLike | null | undefined): number {
  if ((unit?.classType ?? unit?.base?.classType) !== "FIGHTER") return 0;
  const maxHp = Number(unit?.maxHp);
  const hp = Number(unit?.hp);
  if (!Number.isFinite(maxHp) || maxHp <= 0 || !Number.isFinite(hp)) return 0;
  return Math.max(0, Math.min(1, (maxHp - hp) / maxHp));
}

interface PositionLike {
  classType?: string;
  base?: { classType?: string };
  row?: number;
  col?: number;
}

export function getArcherRangePassiveDistance(attacker: PositionLike | null | undefined, defender: PositionLike | null | undefined): number {
  if ((attacker?.classType ?? attacker?.base?.classType) !== "ARCHER") return 0;
  const attackerRow = Number(attacker?.row);
  const attackerCol = Number(attacker?.col);
  const defenderRow = Number(defender?.row);
  const defenderCol = Number(defender?.col);
  if (![attackerRow, attackerCol, defenderRow, defenderCol].every(Number.isFinite)) return 0;
  return Math.max(0, Math.abs(attackerRow - defenderRow) + Math.abs(attackerCol - defenderCol));
}

export function getArcherRangePassiveModifiers(attacker: PositionLike | null | undefined, defender: PositionLike | null | undefined): {
  distance: number;
  missBonusPct: number;
  critChanceBonusPct: number;
  critDamageBonusPct: number;
} {
  const distance = getArcherRangePassiveDistance(attacker, defender);
  const perTileBonus = 0.05;
  const totalBonus = distance * perTileBonus;
  return {
    distance,
    missBonusPct: totalBonus,
    critChanceBonusPct: totalBonus,
    critDamageBonusPct: totalBonus
  };
}

export function countMageSkillRefundTargets(trackedTargets: Set<unknown> | unknown[] | null | undefined): number {
  if (trackedTargets instanceof Set) return trackedTargets.size;
  if (Array.isArray(trackedTargets)) return new Set(trackedTargets.filter(Boolean)).size;
  return 0;
}

interface UnitWithBounty {
  side?: string;
  assassinBountyGold?: number;
  assassinBountyKills?: number;
}

export function sumTeamAssassinBounty(units: UnitWithBounty[] | null | undefined, side: string = "LEFT"): number {
  return (Array.isArray(units) ? units : [])
    .filter((unit) => unit?.side === side)
    .reduce((sum, unit) => sum + Math.max(0, Math.floor(Number(unit?.assassinBountyGold) || 0)), 0);
}

export function sumTeamAssassinBountyKills(units: UnitWithBounty[] | null | undefined, side: string = "LEFT"): number {
  return (Array.isArray(units) ? units : [])
    .filter((unit) => unit?.side === side)
    .reduce((sum, unit) => sum + Math.max(0, Math.floor(Number(unit?.assassinBountyKills) || 0)), 0);
}
