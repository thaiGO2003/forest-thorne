export const TIER_ODDS_PEAK_LEVELS: Record<number, number> = Object.freeze({
  1: 1,
  2: 8,
  4: 3,
  5: 4,
  6: 5
});

interface TierOddsCurveProfile {
  peakLevel: number;
  leftSpan: number;
  rightSpan: number;
}

const TIER_ODDS_CURVE_PROFILES: readonly TierOddsCurveProfile[] = Object.freeze([
  Object.freeze({ peakLevel: 1, leftSpan: 0, rightSpan: 12 }),
  Object.freeze({ peakLevel: 8, leftSpan: 7, rightSpan: 10 }),
  Object.freeze({ peakLevel: 15, leftSpan: 10, rightSpan: 10 }),
  Object.freeze({ peakLevel: 20, leftSpan: 8, rightSpan: 10 }),
  Object.freeze({ peakLevel: 25, leftSpan: 10, rightSpan: 0 })
]);

function getTierCurveWeight(level: number, profile: TierOddsCurveProfile): number {
  const { peakLevel, leftSpan, rightSpan } = profile;
  if (level === peakLevel) return 1;
  if (level < peakLevel) {
    const leftBound = peakLevel - leftSpan;
    if (leftSpan <= 0 || level <= leftBound) return 0;
    return (level - leftBound) / leftSpan;
  }
  const rightBound = peakLevel + rightSpan;
  if (rightSpan <= 0 || level >= rightBound) return 0;
  return (rightBound - level) / rightSpan;
}

function normalizeTierOdds(weights: number[]): number[] {
  const sum = weights.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return [1, 0, 0, 0, 0];
  const normalized = weights.map((value) => {
    if (value <= 0) return 0;
    return Math.round((value / sum) * 10000) / 10000;
  });
  const drift = Math.round((1 - normalized.reduce((acc, value) => acc + value, 0)) * 10000) / 10000;
  if (drift !== 0) {
    const targetIndex = normalized.reduce((bestIndex, value, index, list) => {
      if (list[bestIndex] >= value) return bestIndex;
      return index;
    }, 0);
    normalized[targetIndex] = Math.max(0, Math.round((normalized[targetIndex] + drift) * 10000) / 10000);
  }
  return normalized;
}

function buildTierOddsTable(maxLevel: number = 25): Record<number, readonly number[]> {
  const table: Record<number, readonly number[]> = {};
  for (let level = 1; level <= maxLevel; level += 1) {
    let weights = TIER_ODDS_CURVE_PROFILES.map((profile) => getTierCurveWeight(level, profile));
    if (level === 1) weights = [1, 0, 0, 0, 0];
    table[level] = Object.freeze(normalizeTierOdds(weights));
  }
  return Object.freeze(table);
}

export const TIER_ODDS_BY_LEVEL: Record<number, readonly number[]> = buildTierOddsTable();

const XP_TO_LEVEL_UP: Record<number, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 10,
  5: 16,
  6: 24,
  7: 36,
  8: 52,
  9: 68,
  10: 88,
  11: 112,
  12: 140,
  13: 172,
  14: 208,
  15: 248,
  16: 292,
  17: 340,
  18: 392,
  19: 448,
  20: 508,
  21: 572,
  22: 640,
  23: 712,
  24: 788,
  25: 868
};

let uidSeed = 1;

export function createUnitUid(): string {
  uidSeed += 1;
  return `u_${uidSeed}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function randomItem<T>(list: T[], rng: () => number = Math.random): T | null {
  if (!list.length) return null;
  const idx = Math.floor(rng() * list.length);
  return list[idx];
}

export function sampleWithoutReplacement<T>(list: T[], count: number, rng: () => number = Math.random): T[] {
  const pool = [...list];
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}

export function weightedChoice(weights: number[], rng: () => number = Math.random): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  let needle = rng() * sum;
  for (let i = 0; i < weights.length; i += 1) {
    needle -= weights[i];
    if (needle <= 0) return i;
  }
  return weights.length - 1;
}

export function getTierOddsRow(level: number): readonly number[] {
  const parsedLevel = Number(level);
  const normalizedLevel = Number.isFinite(parsedLevel) ? Math.floor(parsedLevel) : 1;
  const safeLevel = clamp(normalizedLevel, 1, 25);
  return TIER_ODDS_BY_LEVEL[safeLevel] ?? TIER_ODDS_BY_LEVEL[25];
}

export function getTierPeakLevel(tier: number): number | null {
  const parsedTier = Number(tier);
  if (!Number.isFinite(parsedTier)) return null;
  return TIER_ODDS_PEAK_LEVELS[Math.floor(parsedTier)] ?? null;
}

export function rollTierForLevel(level: number, rng: () => number = Math.random): number {
  const odds = getTierOddsRow(level);
  return weightedChoice([...odds], rng) + 1;
}

export function getDeployCapByLevel(level: number): number {
  // Start at 3 slots. Max cap increased to 25 (full 5×5 board).
  return clamp(level + 2, 3, 25);
}

export function getXpToLevelUp(level: number): number {
  return XP_TO_LEVEL_UP[level] ?? Number.POSITIVE_INFINITY;
}

export function starMultiplier(star: number): number {
  if (star <= 1) return 1;
  if (star === 2) return 1.6;
  return 2.5;
}

const BASE_EVASION_BY_CLASS: Record<string, number> = {
  TANKER: 0.05,
  FIGHTER: 0.08,
  ASSASSIN: 0.15,
  ARCHER: 0.10,
  MAGE: 0.05,
  SUPPORT: 0.07
};

export function getBaseEvasion(classType: string): number {
  return BASE_EVASION_BY_CLASS[classType] ?? 0.05;
}

const BASE_CRIT_BY_CLASS: Record<string, number> = {
  TANKER: 0.05,
  FIGHTER: 0.05,
  ASSASSIN: 0.25,
  ARCHER: 0.20,
  MAGE: 0.10,
  SUPPORT: 0.05
};

export function getBaseCritRate(classType: string): number {
  return BASE_CRIT_BY_CLASS[classType] ?? 0.05;
}

interface UnitWithMods {
  classType?: string;
  base?: { classType?: string };
  mods?: { evadePct?: number };
  environmentMods?: { evadePct?: number };
  statuses?: {
    evadeBuffTurns?: number;
    evadeBuffValue?: number;
    evadeDebuffTurns?: number;
    evadeDebuffValue?: number;
  };
}

export function getEffectiveEvasion(unit: UnitWithMods | null | undefined): number {
  const classType = unit?.classType ?? unit?.base?.classType;
  const baseEvasion = getBaseEvasion(classType ?? "");
  const modEvade = Number.isFinite(unit?.mods?.evadePct) ? (unit!.mods!.evadePct as number) : baseEvasion;
  const envEvadeRaw = unit?.environmentMods?.evadePct;
  const envEvade = Number.isFinite(envEvadeRaw) ? (envEvadeRaw as number) : 0;
  let evasion: number = modEvade + envEvade;
  const statuses = unit?.statuses ?? {};

  // Apply buffs
  if ((statuses.evadeBuffTurns ?? 0) > 0) {
    evasion += statuses.evadeBuffValue ?? 0;
  }

  // Apply debuffs
  if ((statuses.evadeDebuffTurns ?? 0) > 0) {
    evasion -= statuses.evadeDebuffValue ?? 0;
  }

  // Clamp to 0-75% range
  return Math.max(0, Math.min(0.75, evasion));
}

interface AttackerUnit {
  mods?: { accuracyPct?: number };
  environmentMods?: { accuracyPct?: number };
}

interface DefenderUnit extends UnitWithMods {}

/**
 * Calculate hit chance based on attacker accuracy and target evasion
 * @param attacker - Attacking unit (unused for now, but available for future accuracy modifiers)
 * @param defender - Defending unit
 * @returns Hit chance as a decimal (0.1 to 1.0)
 */
export function calculateHitChance(attacker: AttackerUnit | null | undefined, defender: DefenderUnit | null | undefined): number {
  const baseAccuracy = 0.95; // 95% base hit chance
  const defenderEvasion = getEffectiveEvasion(defender);
  const modAccRaw = attacker?.mods?.accuracyPct;
  const envAccRaw = attacker?.environmentMods?.accuracyPct;
  const modAcc = Number.isFinite(modAccRaw) ? (modAccRaw as number) : 0;
  const envAcc = Number.isFinite(envAccRaw) ? (envAccRaw as number) : 0;
  const attackerAccuracy: number = modAcc + envAcc;
  const hitChance: number = baseAccuracy + attackerAccuracy - defenderEvasion;

  // Ensure minimum 10% hit chance
  return Math.max(0.1, Math.min(1, hitChance));
}

export function starEffectChanceMultiplier(star: number): number {
  if (star <= 1) return 1;
  if (star === 2) return 1.4;
  return 2.0;
}

export function starTargetBonus(star: number): number {
  if (star <= 1) return 0;
  if (star === 2) return 1;
  return 2;
}

export function starAreaBonus(star: number): number {
  return Math.max(0, star - 1);
}

/** Tăng turns theo star: 1★=base, 2★=base, 3★=base+1 */
export function getStarTurns(star: number, baseTurns: number): number {
  const t = Number(baseTurns) || 2;
  if (star >= 3) return t + 1;
  return t;
}

/** Scale DoT damage theo star: 1★=base, 2★=×1.3, 3★=×1.6 */
export function getStarDotDamage(star: number, baseDmg: number): number {
  const d = Number(baseDmg) || 0;
  if (star >= 3) return Math.round(d * 1.6);
  if (star === 2) return Math.round(d * 1.3);
  return d;
}

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

export function scaledBaseStats(baseStats: BaseStats, star: number, classType: string): ScaledStats {
  const mult = starMultiplier(star);
  const evasionBase = getBaseEvasion(classType);
  const evasionBonus = star <= 1 ? 0 : star === 2 ? 0.05 : 0.10;
  return {
    hp: Math.round(baseStats.hp * mult),
    atk: Math.round(baseStats.atk * mult),
    def: Math.round(baseStats.def * mult),
    matk: Math.round(baseStats.matk * mult),
    mdef: Math.round(baseStats.mdef * mult),
    range: baseStats.range,
    rageMax: baseStats.rageMax,
    evasion: Math.min(0.60, evasionBase + evasionBonus)
  };
}

export function getGoldReserveScaling(gold: number): number {
  // Handle invalid inputs: negative, non-numeric, null/undefined
  if (typeof gold !== 'number' || gold < 0 || !isFinite(gold)) {
    return 1.0;
  }

  const baselineGold = 10;
  const goldPerPercent = 2;
  const maxMultiplier = 2.0;

  // No bonus at or below baseline
  if (gold <= baselineGold) {
    return 1.0;
  }

  // Calculate bonus: +1% per 2 gold above baseline
  const excessGold = gold - baselineGold;
  const bonusPercent = excessGold / goldPerPercent;
  const multiplier = 1.0 + (bonusPercent / 100);

  // Cap at maximum multiplier (2.0 = 100% bonus at 210 gold)
  return Math.min(multiplier, maxMultiplier);
}

interface SkillLibrary {
  [skillId: string]: unknown;
}

/**
 * Get effective skill ID for a unit, potentially upgrading to _v2 variant
 * @param baseSkillId - Base skill ID from unit definition
 * @param classType - Unit class (ASSASSIN, MAGE, etc.)
 * @param star - Star level (1-3)
 * @param skillLibrary - SKILL_LIBRARY object to check for upgraded skills
 * @returns Skill ID to use (may be upgraded variant)
 */
export function getEffectiveSkillId(baseSkillId: string, classType: string, star: number, skillLibrary: SkillLibrary | null | undefined): string {
  // Only ASSASSIN units with 2-3 stars qualify for upgrades
  if (classType !== 'ASSASSIN' || star < 2) {
    return baseSkillId;
  }

  // Construct upgraded skill ID
  const upgradedSkillId = `${baseSkillId}_v2`;

  // Check if upgraded skill exists in library
  if (skillLibrary && skillLibrary[upgradedSkillId]) {
    return upgradedSkillId;
  }

  // Fall back to base skill
  return baseSkillId;
}

export function gridKey(row: number, col: number): string {
  return `${row}:${col}`;
}

interface GridPosition {
  row: number;
  col: number;
}

export function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Row tie-breaker used by combat previews and targeting:
 * same row -> one row above -> one row below -> two above -> two below.
 */
export function getTopFirstRowSweep(sourceRow: number, targetRow: number): number {
  const delta = Number(targetRow) - Number(sourceRow);
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const rowDist = Math.abs(delta);
  return rowDist * 2 - (delta < 0 ? 1 : 0);
}

interface BoardUnit extends GridPosition {
  side: "LEFT" | "RIGHT";
}

/**
 * How many columns a unit is from the frontline (the boundary between sides).
 * LEFT side frontline = col 4, RIGHT side frontline = col 5.
 */
export function distanceToFrontline(unit: BoardUnit): number {
  if (unit.side === "LEFT") return 4 - unit.col;
  return unit.col - 5;
}

/**
 * How many columns a unit is from their own backline.
 * LEFT backline = col 0, RIGHT backline = col 9.
 */
export function distanceToBackline(unit: BoardUnit): number {
  if (unit.side === "LEFT") return unit.col;
  return 9 - unit.col;
}

interface TargetWithCol {
  col: number;
}

export function findClosest<T extends TargetWithCol>(targets: T[], myCol: number): T {
  return targets.reduce((closest, target) => {
    const distCurrent = Math.abs(target.col - myCol);
    const distClosest = Math.abs(closest.col - myCol);
    return distCurrent < distClosest ? target : closest;
  });
}

interface Enemy extends GridPosition {}

export function findTargetMeleeFrontline(myRow: number, myCol: number, enemies: Enemy[]): Enemy | null {
  // 1. Tìm cùng hàng
  const sameRow = enemies.filter(e => e.row === myRow);
  if (sameRow.length > 0) {
    return findClosest(sameRow, myCol); // Gần nhất theo cột
  }

  // 2. Tìm theo thứ tự: lên 1, xuống 1, lên 2, xuống 2
  const searchOrder = [
    myRow - 1,  // Lên 1
    myRow + 1,  // Xuống 1
    myRow - 2,  // Lên 2
    myRow + 2   // Xuống 2
  ];

  for (const row of searchOrder) {
    const targets = enemies.filter(e => e.row === row);
    if (targets.length > 0) {
      return findClosest(targets, myCol);
    }
  }

  return null; // Không tìm thấy
}

export function findTargetAssassin(myRow: number, enemies: Enemy[]): Enemy | null {
  // Chỉ tìm cùng hàng
  const sameRow = enemies.filter(e => e.row === myRow);
  if (sameRow.length === 0) return null;

  // Chọn xa nhất theo cự ly cột
  return sameRow.reduce((farthest, target) => {
    // Vì không có myCol, ta đơn giản tìm mục tiêu có cột lớn nhất (thường là hàng sau của enemy bên trái đánh phải)
    // Nhưng để chính xác cho bất kể bên nào: cột xa nhất là cột khác biệt nhiều nhất so với 4.5 (giữa bàn cờ)
    // Hoặc nếu enemies là phe phải, cột của nó là 5..9. Xa nhất với phe trái đánh phải là cột 9 (max).
    // Phe phải đánh trái, xa nhất là cột 0 (min).
    // "xa nhất cùng hàng"
    // Nếu side chưa biết, dùng giả định: phe trái tiến sang phải (tìm max col), phe phải tiến trái (tìm min col)
    // Thực tế unit có target.col. Ta sẽ tìm target.col lớn nhất.
    return target.col > farthest.col ? target : farthest;
  });
}

export function findTargetRanged(myRow: number, myCol: number, range: number, enemies: Enemy[]): Enemy | null {
  // Chỉ tìm cùng hàng và trong tầm
  const sameRow = enemies.filter(e =>
    e.row === myRow &&
    Math.abs(e.col - myCol) <= range
  );

  if (sameRow.length === 0) return null;

  // Chọn gần nhất
  return findClosest(sameRow, myCol);
}

interface Skill {
  id?: string;
  maxHits?: number;
}

interface UnitWithStar {
  star?: number;
}

/**
 * Get wasp max targets based on unit star level.
 * Wasp skills scale targets: 1★=1, 2★=2, 3★=3.
 * Non-wasp skills return skill.maxHits.
 */
export function getWaspMaxTargets(unit: UnitWithStar | null | undefined, skill: Skill | null | undefined): number | undefined {
  if (skill?.id !== "wasp_triple_strike") return skill?.maxHits;
  const star = Math.max(1, Math.min(3, Math.floor(unit?.star ?? 1)));
  return star;
}
