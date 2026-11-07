import {
  distanceToBackline,
  distanceToFrontline,
  manhattan,
  sampleWithoutReplacement
} from "../../core/gameUtils.js";
import { getOffenseDebuffState } from "../../core/offenseDebuff.js";

export interface SkillTargetUnit {
  uid?: string | number;
  alive?: boolean;
  classType?: string;
  side?: string;
  row: number;
  col: number;
  range?: number;
  hp?: number;
  maxHp?: number;
  shield?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  rage?: number;
  statuses?: Record<string, unknown>;
  [key: string]: unknown;
}

export type UnitPredicate = (unit: SkillTargetUnit) => boolean;

export interface SkillFilterOptions {
  excludeUid?: string | number | null;
  targetClasses?: string[] | null;
  excludeClasses?: string[] | null;
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  requireDebuffed?: boolean;
  requireShielded?: boolean;
  preferClasses?: string[] | null;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferDebuffed?: boolean;
  preferShielded?: boolean;
  preferHighRage?: boolean;
  getEffectiveAtk?: (unit: SkillTargetUnit) => number;
  getEffectiveDef?: (unit: SkillTargetUnit) => number;
  getEffectiveMdef?: (unit: SkillTargetUnit) => number;
  getEffectiveMatk?: (unit: SkillTargetUnit) => number;
  randomFn?: () => number;
  anchor?: SkillTargetUnit | null;
  attacker?: SkillTargetUnit | null;
  target?: SkillTargetUnit | null;
  allowRepeatTargets?: boolean;
}

export type SkillTargetSelector =
  | "lowest_hp_pct"
  | "lowest_hp_pct_ally"
  | "highest_atk"
  | "highest_matk"
  | "highest_rage"
  | "lowest_rage"
  | "lowest_rage_ally"
  | "backline_caster"
  | "highest_atk_backline"
  | "highest_max_hp_front"
  | "lowest_def_front"
  | "lowest_mdef_backline"
  | "isolated_backline"
  | "most_clustered_row"
  | "most_clustered_col"
  | "highest_total_atk_row"
  | "highest_total_atk_col"
  | "same_row"
  | "same_row_carry"
  | "same_column"
  | "front"
  | "nearest"
  | "random"
  | "self"
  | "ally_lowest_hp"
  | string;

export interface SkillTargetingSkill {
  targetSelector?: SkillTargetSelector;
  fallbackTargetSelector?: SkillTargetSelector;
  targetClasses?: string[] | null;
  excludeTargetClasses?: string[] | null;
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  requireDebuffed?: boolean;
  requireShielded?: boolean;
  preferClasses?: string[] | null;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferDebuffed?: boolean;
  preferShielded?: boolean;
  preferHighRage?: boolean;
}

export type RandomFn = () => number;
type PositionedSkillTargetUnit = SkillTargetUnit & { side: "LEFT" | "RIGHT" };

function hasBoardSide(unit: SkillTargetUnit): unit is PositionedSkillTargetUnit {
  return unit.side === "LEFT" || unit.side === "RIGHT";
}

function skillDistanceToFrontline(unit: SkillTargetUnit): number {
  return hasBoardSide(unit) ? distanceToFrontline(unit) : unit.col - 5;
}

function skillDistanceToBackline(unit: SkillTargetUnit): number {
  return hasBoardSide(unit) ? distanceToBackline(unit) : 9 - unit.col;
}

export function isAliveUnit(unit: SkillTargetUnit | null | undefined): boolean {
  return Boolean(unit?.alive);
}

export function collectAliveUnits(units: SkillTargetUnit[], predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units.filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)));
}

export function isFrontlineUnit(unit: SkillTargetUnit | null | undefined): boolean {
  return Boolean(unit && skillDistanceToFrontline(unit) === 0);
}

export function isBacklineUnit(unit: SkillTargetUnit | null | undefined): boolean {
  return Boolean(unit && (skillDistanceToBackline(unit) <= 1 || skillDistanceToFrontline(unit) >= 2));
}

export function isCasterLikeUnit(unit: SkillTargetUnit | null | undefined): boolean {
  return unit?.classType === "MAGE" || unit?.classType === "SUPPORT";
}

export function isRangedLikeUnit(unit: SkillTargetUnit | null | undefined): boolean {
  return isCasterLikeUnit(unit) || Number(unit?.range ?? 1) >= 2 || unit?.classType === "ARCHER";
}

function sortByNumber<T>(items: T[], getValue: (item: T) => number, dir: "asc" | "desc" = "desc"): T[] {
  return [...items].sort((a, b) => {
    const delta = (Number(getValue(b)) || 0) - (Number(getValue(a)) || 0);
    return dir === "asc" ? -delta : delta;
  });
}

function maybePrefer<T>(items: T[], predicate: (item: T) => boolean): T[] {
  const preferred = items.filter(predicate);
  return preferred.length ? preferred : items;
}

function groupUnitsBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return groups;
}

function getUnitDefenseValue(unit: SkillTargetUnit | null | undefined, options?: SkillFilterOptions): number {
  return Number(options?.getEffectiveDef?.(unit as SkillTargetUnit) ?? unit?.def ?? 0) || 0;
}

function getUnitMagicDefenseValue(unit: SkillTargetUnit | null | undefined, options?: SkillFilterOptions): number {
  return Number(options?.getEffectiveMdef?.(unit as SkillTargetUnit) ?? unit?.mdef ?? 0) || 0;
}

function getUnitAttackValue(unit: SkillTargetUnit | null | undefined, options?: SkillFilterOptions): number {
  return Number(options?.getEffectiveAtk?.(unit as SkillTargetUnit) ?? unit?.atk ?? 0) || 0;
}

function getUnitMagicAttackValue(unit: SkillTargetUnit | null | undefined, options?: SkillFilterOptions): number {
  return Number(options?.getEffectiveMatk?.(unit as SkillTargetUnit) ?? unit?.matk ?? 0) || 0;
}

function getClusterScore(unit: SkillTargetUnit, pool: SkillTargetUnit[]): number {
  return pool.reduce((score, other) => {
    if (!other || other.uid === unit.uid) return score;
    return score + (manhattan(unit, other) <= 2 ? 1 : 0);
  }, 1);
}

function matchRequiredFilters(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit[] {
  const {
    excludeUid = null,
    targetClasses = null,
    excludeClasses = null,
    requireFrontline = false,
    requireBackline = false,
    requireRanged = false,
    requireDebuffed = false,
    requireShielded = false
  } = options;

  return units.filter((unit) => {
    if (!isAliveUnit(unit)) return false;
    if (excludeUid != null && unit.uid === excludeUid) return false;
    if (Array.isArray(targetClasses) && targetClasses.length > 0 && !targetClasses.includes(unit.classType as string)) return false;
    if (Array.isArray(excludeClasses) && excludeClasses.length > 0 && excludeClasses.includes(unit.classType as string)) return false;
    if (requireFrontline && !isFrontlineUnit(unit)) return false;
    if (requireBackline && !isBacklineUnit(unit)) return false;
    if (requireRanged && !isRangedLikeUnit(unit)) return false;
    if (requireDebuffed && !hasAnyDebuff(unit)) return false;
    if (requireShielded && !(Number(unit?.shield ?? 0) > 0)) return false;
    return true;
  });
}

function applySoftPreferences(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit[] {
  if (!units.length) return units;
  let pool: SkillTargetUnit[] = [...units];
  if (Array.isArray(options.preferClasses) && options.preferClasses.length > 0) {
    const pref = options.preferClasses;
    pool = maybePrefer(pool, (unit) => pref.includes(unit.classType as string));
  }
  if (options.preferFrontline) pool = maybePrefer(pool, (unit) => isFrontlineUnit(unit));
  if (options.preferBackline) pool = maybePrefer(pool, (unit) => isBacklineUnit(unit));
  if (options.preferRanged) pool = maybePrefer(pool, (unit) => isRangedLikeUnit(unit));
  if (options.preferDebuffed) pool = maybePrefer(pool, (unit) => hasAnyDebuff(unit));
  if (options.preferShielded) pool = maybePrefer(pool, (unit) => Number(unit?.shield ?? 0) > 0);
  if (options.preferHighRage) {
    const highestRage = Math.max(...pool.map((unit) => Number(unit?.rage ?? 0) || 0));
    pool = maybePrefer(pool, (unit) => (Number(unit?.rage ?? 0) || 0) === highestRage);
  }
  return pool;
}

function hasAnyDebuff(unit: SkillTargetUnit | null | undefined): boolean {
  const statuses = (unit?.statuses ?? {}) as Record<string, unknown>;
  const offenseDebuffActive = getOffenseDebuffState(statuses, unit).turns > 0;
  return [
    "freeze",
    "stun",
    "sleep",
    "silence",
    "burnTurns",
    "fireVulnerabilityTurns",
    "poisonTurns",
    "bleedTurns",
    "diseaseTurns",
    "healBlockTurns",
    "healReductionTurns",
    "armorBreakTurns"
  ].some((key) => Number(statuses[key] ?? 0) > 0) || offenseDebuffActive;
}

function sortByAnchorDistance(units: SkillTargetUnit[], anchor: SkillTargetUnit | null | undefined): SkillTargetUnit[] {
  if (!anchor) return [...units];
  return [...units].sort((a, b) => manhattan(anchor, a) - manhattan(anchor, b));
}

function pickUnitFromGroup(group: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const preferred = applySoftPreferences(group, options);
  const prioritized = sortByNumber(preferred, (unit) => Number(unit?.rage ?? 0) || 0, "desc");
  return prioritized[0] ?? preferred[0] ?? group[0] ?? null;
}

function findGroupedAnchor(
  units: SkillTargetUnit[],
  key: "row" | "col",
  scoreFn: (members: SkillTargetUnit[]) => number,
  options: SkillFilterOptions = {}
): SkillTargetUnit | null {
  const groups = groupUnitsBy(units, (unit) => unit?.[key]);
  const ranked = [...groups.entries()]
    .map(([groupKey, members]) => ({
      key: groupKey,
      members,
      score: scoreFn(members)
    }))
    .sort((a, b) => b.score - a.score || (a.key as number) - (b.key as number));
  if (!ranked.length) return null;
  return pickUnitFromGroup(ranked[0].members, options);
}

export function sortUnitsByHpRatioAsc(units: SkillTargetUnit[], predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units
    .filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)))
    .sort((a, b) => (a.hp ?? 0) / Math.max(1, a.maxHp ?? 0) - (b.hp ?? 0) / Math.max(1, b.maxHp ?? 0));
}

export function collectLowestHpRatioUnits(units: SkillTargetUnit[], count = 1, predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return sortUnitsByHpRatioAsc(units, predicate).slice(0, count);
}

export function findLowestHpRatioUnit(units: SkillTargetUnit[], predicate?: UnitPredicate | null): SkillTargetUnit | null {
  return collectLowestHpRatioUnits(units, 1, predicate)[0] || null;
}

export function selectRowGuardUnits(
  units: SkillTargetUnit[],
  attacker: SkillTargetUnit | null | undefined,
  { includeSelf = true, maxAllies = 1 }: { includeSelf?: boolean; maxAllies?: number } = {}
): SkillTargetUnit[] {
  const origin = attacker && typeof attacker === "object" ? attacker : null;
  if (!origin) return [];
  const sameRowAllies = units.filter((unit) => isAliveUnit(unit) && unit.row === origin.row);
  const selected: SkillTargetUnit[] = [];

  if (includeSelf && isAliveUnit(origin)) {
    selected.push(origin);
  }

  const allyCount = Math.max(0, Math.round(Number(maxAllies) || 0));
  if (allyCount <= 0) return selected;

  const rankedAllies = sameRowAllies
    .filter((unit) => unit.uid !== origin?.uid)
    .sort((left, right) => {
      const leftRatio = (Number(left?.hp ?? 0) || 0) / Math.max(1, Number(left?.maxHp ?? 0) || 0);
      const rightRatio = (Number(right?.hp ?? 0) || 0) / Math.max(1, Number(right?.maxHp ?? 0) || 0);
      if (leftRatio !== rightRatio) return leftRatio - rightRatio;
      const distanceDelta = manhattan(origin, left) - manhattan(origin, right);
      if (distanceDelta !== 0) return distanceDelta;
      const colDelta = (Number(left?.col ?? 0) || 0) - (Number(right?.col ?? 0) || 0);
      if (colDelta !== 0) return colDelta;
      return (Number(left?.row ?? 0) || 0) - (Number(right?.row ?? 0) || 0);
    })
    .slice(0, allyCount);

  return [...selected, ...rankedAllies];
}

export function collectHighestEffectiveAtkUnits(
  units: SkillTargetUnit[],
  count = 1,
  getEffectiveAtk: (unit: SkillTargetUnit) => number,
  predicate?: UnitPredicate | null
): SkillTargetUnit[] {
  return units
    .filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)))
    .sort((a, b) => getEffectiveAtk(b) - getEffectiveAtk(a))
    .slice(0, count);
}

export function findHighestEffectiveAtkUnit(
  units: SkillTargetUnit[],
  getEffectiveAtk: (unit: SkillTargetUnit) => number,
  predicate?: UnitPredicate | null
): SkillTargetUnit | null {
  return collectHighestEffectiveAtkUnits(units, 1, getEffectiveAtk, predicate)[0] || null;
}

export function collectUnitsInSameRow(units: SkillTargetUnit[], row: number, predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units.filter((unit) => isAliveUnit(unit) && unit.row === row && (!predicate || predicate(unit)));
}

export function collectUnitsInSameColumn(units: SkillTargetUnit[], col: number, predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units.filter((unit) => isAliveUnit(unit) && unit.col === col && (!predicate || predicate(unit)));
}

export function collectUnitsInAoeSquare(
  units: SkillTargetUnit[],
  center: SkillTargetUnit | null | undefined,
  radius: number,
  predicate?: UnitPredicate | null
): SkillTargetUnit[] {
  const centerRow = center?.row ?? 0;
  const centerCol = center?.col ?? 0;
  return units.filter((unit) => (
    isAliveUnit(unit) &&
    Math.abs((unit.row ?? 0) - centerRow) <= radius &&
    Math.abs((unit.col ?? 0) - centerCol) <= radius &&
    (!predicate || predicate(unit))
  ));
}

export function collectUnitsInForwardCone(
  units: SkillTargetUnit[],
  target: SkillTargetUnit | null | undefined,
  predicate?: UnitPredicate | null
): SkillTargetUnit[] {
  const targetRow = target?.row ?? 0;
  const targetCol = target?.col ?? 0;
  return units.filter((unit) => (
    isAliveUnit(unit) &&
    Math.abs((unit.row ?? 0) - targetRow) <= 1 &&
    (unit.col ?? 0) >= targetCol &&
    (!predicate || predicate(unit))
  ));
}

export function collectRandomAliveUnits(
  units: SkillTargetUnit[],
  count: number,
  predicate?: UnitPredicate | null,
  randomFn: RandomFn = Math.random
): SkillTargetUnit[] {
  const pool = units.filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)));
  return sampleWithoutReplacement(pool, Math.min(count, pool.length), randomFn);
}

export function collectLowestRageUnits(units: SkillTargetUnit[], count = 1, predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units
    .filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)))
    .sort((a, b) => (Number(a?.rage ?? 0) || 0) - (Number(b?.rage ?? 0) || 0))
    .slice(0, count);
}

export function findLowestRageUnit(units: SkillTargetUnit[], predicate?: UnitPredicate | null): SkillTargetUnit | null {
  return collectLowestRageUnits(units, 1, predicate)[0] || null;
}

export function collectHighestRageUnits(units: SkillTargetUnit[], count = 1, predicate?: UnitPredicate | null): SkillTargetUnit[] {
  return units
    .filter((unit) => isAliveUnit(unit) && (!predicate || predicate(unit)))
    .sort((a, b) => (Number(b?.rage ?? 0) || 0) - (Number(a?.rage ?? 0) || 0))
    .slice(0, count);
}

export function findHighestRageUnit(units: SkillTargetUnit[], predicate?: UnitPredicate | null): SkillTargetUnit | null {
  return collectHighestRageUnits(units, 1, predicate)[0] || null;
}

export function findBacklineCasterUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = applySoftPreferences(
    matchRequiredFilters(units, { ...options, requireBackline: false }),
    {
      ...options,
      preferClasses: options.preferClasses ?? ["MAGE", "SUPPORT", "ARCHER"],
      preferBackline: true,
      preferRanged: true,
      preferHighRage: true
    }
  );
  return sortByNumber(pool, (unit) => getUnitMagicAttackValue(unit, options) + (Number(unit?.rage ?? 0) || 0) * 100)[0] || null;
}

export function findHighestMatkUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = applySoftPreferences(matchRequiredFilters(units, options), options);
  return sortByNumber(pool, (unit) => getUnitMagicAttackValue(unit, options))[0] || null;
}

export function findHighestAtkBacklineUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = applySoftPreferences(
    matchRequiredFilters(units, options),
    { ...options, preferBackline: true, preferRanged: true }
  );
  return sortByNumber(pool, (unit) => getUnitAttackValue(unit, options))[0] || null;
}

export function findHighestMaxHpFrontlineUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, { ...options, requireFrontline: true });
  return sortByNumber(pool, (unit) => Number(unit?.maxHp ?? unit?.hp ?? 0) || 0)[0] || null;
}

export function findLowestDefFrontlineUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, { ...options, requireFrontline: true });
  return sortByNumber(pool, (unit) => getUnitDefenseValue(unit, options), "asc")[0] || null;
}

export function findLowestMdefBacklineUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = applySoftPreferences(
    matchRequiredFilters(units, options),
    { ...options, preferBackline: true, preferRanged: true }
  );
  return sortByNumber(pool, (unit) => getUnitMagicDefenseValue(unit, options), "asc")[0] || null;
}

export function findIsolatedBacklineUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = applySoftPreferences(
    matchRequiredFilters(units, options),
    { ...options, preferBackline: true, preferRanged: true }
  );
  const anchor = options?.anchor ?? options?.attacker ?? null;
  return [...pool]
    .sort((a, b) => getClusterScore(a, pool) - getClusterScore(b, pool) || manhattan(anchor ?? a, a) - manhattan(anchor ?? b, b))[0] || null;
}

export function findMostClusteredRowUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, options);
  if (!pool.length) return null;
  return findGroupedAnchor(pool, "row", (members) => (
    members.length * 100 +
    members.reduce((sum, unit) => sum + (Number(unit?.rage ?? 0) || 0), 0)
  ), options);
}

export function findMostClusteredColumnUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, options);
  if (!pool.length) return null;
  return findGroupedAnchor(pool, "col", (members) => (
    members.length * 100 +
    members.reduce((sum, unit) => sum + (Number(unit?.rage ?? 0) || 0), 0)
  ), options);
}

export function findHighestTotalAtkRowUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, options);
  if (!pool.length) return null;
  return findGroupedAnchor(
    pool,
    "row",
    (members) => members.reduce((sum, unit) => sum + getUnitAttackValue(unit, options), 0),
    options
  );
}

export function findHighestTotalAtkColumnUnit(units: SkillTargetUnit[], options: SkillFilterOptions = {}): SkillTargetUnit | null {
  const pool = matchRequiredFilters(units, options);
  if (!pool.length) return null;
  return findGroupedAnchor(
    pool,
    "col",
    (members) => members.reduce((sum, unit) => sum + getUnitAttackValue(unit, options), 0),
    options
  );
}

export function collectSameRowCarryUnits(
  units: SkillTargetUnit[],
  options: SkillFilterOptions = {},
  count: number = Number.POSITIVE_INFINITY
): SkillTargetUnit[] {
  const anchor = options?.anchor ?? options?.attacker ?? options?.target ?? null;
  const row = anchor?.row;
  if (!Number.isFinite(row)) return [];
  const pool = applySoftPreferences(
    matchRequiredFilters(units, { ...options, requireFrontline: false, requireBackline: false }),
    options
  ).filter((unit) => unit.row === row);

  return [...pool]
    .sort((a, b) => {
      const aOffense = Math.max(getUnitAttackValue(a, options), getUnitMagicAttackValue(a, options));
      const bOffense = Math.max(getUnitAttackValue(b, options), getUnitMagicAttackValue(b, options));
      if (bOffense !== aOffense) return bOffense - aOffense;
      const backlineDelta = skillDistanceToBackline(a) - skillDistanceToBackline(b);
      if (backlineDelta !== 0) return backlineDelta;
      const rageDelta = (Number(a?.rage ?? 0) || 0) - (Number(b?.rage ?? 0) || 0);
      if (rageDelta !== 0) return rageDelta;
      return anchor ? manhattan(anchor, a) - manhattan(anchor, b) : 0;
    })
    .slice(0, Number.isFinite(count) ? Math.max(1, count) : pool.length);
}

export function findUnitBySelector(
  units: SkillTargetUnit[],
  selector: SkillTargetSelector,
  options: SkillFilterOptions = {}
): SkillTargetUnit | null {
  const requiredPool = matchRequiredFilters(units, options);
  const pool = applySoftPreferences(requiredPool, options);
  if (!pool.length) return null;

  switch (selector) {
    case "lowest_hp_pct":
    case "lowest_hp_pct_ally":
      return findLowestHpRatioUnit(pool);
    case "highest_atk":
      return sortByNumber(pool, (unit) => getUnitAttackValue(unit, options))[0] || null;
    case "highest_matk":
      return findHighestMatkUnit(pool, options);
    case "highest_rage":
      return findHighestRageUnit(pool);
    case "lowest_rage":
    case "lowest_rage_ally":
      return findLowestRageUnit(pool);
    case "backline_caster":
      return findBacklineCasterUnit(pool, options);
    case "highest_atk_backline":
      return findHighestAtkBacklineUnit(pool, options);
    case "highest_max_hp_front":
      return findHighestMaxHpFrontlineUnit(pool, options);
    case "lowest_def_front":
      return findLowestDefFrontlineUnit(pool, options);
    case "lowest_mdef_backline":
      return findLowestMdefBacklineUnit(pool, options);
    case "isolated_backline":
      return findIsolatedBacklineUnit(pool, options);
    case "most_clustered_row":
      return findMostClusteredRowUnit(pool, options);
    case "most_clustered_col":
      return findMostClusteredColumnUnit(pool, options);
    case "highest_total_atk_row":
      return findHighestTotalAtkRowUnit(pool, options);
    case "highest_total_atk_col":
      return findHighestTotalAtkColumnUnit(pool, options);
    case "same_row": {
      const anchor = (options?.anchor ?? options?.target ?? options?.attacker ?? null) as SkillTargetUnit | null;
      return sortByAnchorDistance(pool.filter((unit) => unit.row === anchor?.row), anchor)[0] || null;
    }
    case "same_row_carry":
      return collectSameRowCarryUnits(pool, options, 1)[0] || null;
    case "same_column": {
      const anchor = (options?.anchor ?? options?.target ?? options?.attacker ?? null) as SkillTargetUnit | null;
      return sortByAnchorDistance(pool.filter((unit) => unit.col === anchor?.col), anchor)[0] || null;
    }
    case "front":
      return sortByNumber(pool, (unit) => skillDistanceToFrontline(unit), "asc")[0] || null;
    case "nearest":
      return sortByAnchorDistance(pool, (options?.attacker ?? options?.anchor ?? null) as SkillTargetUnit | null)[0] || null;
    case "random":
      return pool[Math.floor((options?.randomFn ?? Math.random)() * pool.length)] ?? null;
    default:
      return options?.target && pool.some((unit) => unit.uid === options.target!.uid)
        ? (options.target as SkillTargetUnit)
        : sortByAnchorDistance(pool, (options?.attacker ?? options?.anchor ?? null) as SkillTargetUnit | null)[0] || null;
  }
}

export function collectUnitsBySelector(
  units: SkillTargetUnit[],
  selector: SkillTargetSelector,
  count = 1,
  options: SkillFilterOptions = {}
): SkillTargetUnit[] {
  if (selector === "same_row_carry") {
    return collectSameRowCarryUnits(units, options, count);
  }
  const selected: SkillTargetUnit[] = [];
  const maxCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : Math.max(1, units.length);
  const allowRepeats = Boolean(options.allowRepeatTargets);

  while (selected.length < maxCount) {
    const excluded = allowRepeats ? null : new Set(selected.map((unit) => unit.uid));
    const pool = allowRepeats
      ? units
      : units.filter((unit) => !excluded!.has(unit.uid));
    const next = findUnitBySelector(pool, selector, options);
    if (!next) break;
    selected.push(next);
    if (allowRepeats) {
      if (!pool.length) break;
      if (selected.length >= maxCount) break;
    }
  }

  return selected;
}

export interface ResolveSkillPrimaryTargetOptions {
  attacker?: SkillTargetUnit | null;
  target?: SkillTargetUnit | null;
  skill?: SkillTargetingSkill;
  allies?: SkillTargetUnit[];
  enemies?: SkillTargetUnit[];
  [key: string]: unknown;
}

export function resolveSkillPrimaryTarget({
  attacker,
  target,
  skill,
  allies = [],
  enemies = [],
  ...options
}: ResolveSkillPrimaryTargetOptions): SkillTargetUnit | null {
  if (!skill?.targetSelector) return target ?? null;
  const selector = skill.targetSelector;
  if (selector === "self") return attacker ?? null;
  if (selector === "ally_lowest_hp") {
    return findLowestHpRatioUnit(allies, (unit) => unit.uid !== attacker?.uid) ?? target ?? null;
  }
  const resolved = findUnitBySelector(enemies, selector, {
    ...(options as SkillFilterOptions),
    attacker: attacker ?? null,
    target: target ?? null,
    anchor: target ?? null,
    targetClasses: skill.targetClasses ?? null,
    excludeClasses: skill.excludeTargetClasses ?? null,
    requireFrontline: skill.requireFrontline,
    requireBackline: skill.requireBackline,
    requireRanged: skill.requireRanged,
    requireDebuffed: skill.requireDebuffed,
    requireShielded: skill.requireShielded,
    preferClasses: skill.preferClasses ?? null,
    preferFrontline: skill.preferFrontline,
    preferBackline: skill.preferBackline,
    preferRanged: skill.preferRanged,
    preferDebuffed: skill.preferDebuffed,
    preferShielded: skill.preferShielded,
    preferHighRage: skill.preferHighRage
  });
  if (resolved) return resolved;
  if (skill.fallbackTargetSelector) {
    return findUnitBySelector(enemies, skill.fallbackTargetSelector, {
      ...(options as SkillFilterOptions),
      attacker: attacker ?? null,
      target: target ?? null,
      anchor: target ?? null
    }) ?? target ?? null;
  }
  return target ?? null;
}

export interface SkillSelectionOverrides {
  targetClasses?: string[] | null;
  excludeClasses?: string[] | null;
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  requireDebuffed?: boolean;
  requireShielded?: boolean;
  preferClasses?: string[] | null;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferDebuffed?: boolean;
  preferShielded?: boolean;
  preferHighRage?: boolean;
}

export interface SkillSelectionOptions extends SkillFilterOptions {
  attacker?: SkillTargetUnit | null;
  target?: SkillTargetUnit | null;
  anchor?: SkillTargetUnit | null;
  getEffectiveAtk?: (unit: SkillTargetUnit) => number;
  getEffectiveDef?: (unit: SkillTargetUnit) => number;
  getEffectiveMdef?: (unit: SkillTargetUnit) => number;
  getEffectiveMatk?: (unit: SkillTargetUnit) => number;
  randomFn?: () => number;
  targetClasses?: string[] | null;
  excludeClasses?: string[] | null;
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  requireDebuffed?: boolean;
  requireShielded?: boolean;
  preferClasses?: string[] | null;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferDebuffed?: boolean;
  preferShielded?: boolean;
  preferHighRage?: boolean;
}

export interface BuildSkillSelectionScene {
  getEffectiveAtk?: (unit: SkillTargetUnit) => number;
  getEffectiveDef?: (unit: SkillTargetUnit) => number;
  getEffectiveMdef?: (unit: SkillTargetUnit) => number;
  getEffectiveMatk?: (unit: SkillTargetUnit) => number;
  random?: () => number;
}

export function buildSkillSelectionOptions(
  scene: BuildSkillSelectionScene | null | undefined,
  attacker: SkillTargetUnit | null | undefined,
  target: SkillTargetUnit | null | undefined,
  skill: SkillTargetingSkill | null | undefined,
  overrides: SkillSelectionOverrides = {}
): SkillSelectionOptions {
  return {
    attacker: attacker ?? null,
    target: target ?? null,
    anchor: target ?? null,
    getEffectiveAtk: scene?.getEffectiveAtk?.bind(scene) as ((unit: SkillTargetUnit) => number) | undefined,
    getEffectiveDef: scene?.getEffectiveDef?.bind(scene) as ((unit: SkillTargetUnit) => number) | undefined,
    getEffectiveMdef: scene?.getEffectiveMdef?.bind(scene) as ((unit: SkillTargetUnit) => number) | undefined,
    getEffectiveMatk: scene?.getEffectiveMatk?.bind(scene) as ((unit: SkillTargetUnit) => number) | undefined,
    randomFn: scene?.random?.bind(scene),
    targetClasses: overrides.targetClasses ?? skill?.targetClasses ?? null,
    excludeClasses: overrides.excludeClasses ?? skill?.excludeTargetClasses ?? null,
    requireFrontline: overrides.requireFrontline ?? skill?.requireFrontline,
    requireBackline: overrides.requireBackline ?? skill?.requireBackline,
    requireRanged: overrides.requireRanged ?? skill?.requireRanged,
    requireDebuffed: overrides.requireDebuffed ?? skill?.requireDebuffed,
    requireShielded: overrides.requireShielded ?? skill?.requireShielded,
    preferClasses: overrides.preferClasses ?? skill?.preferClasses ?? null,
    preferFrontline: overrides.preferFrontline ?? skill?.preferFrontline,
    preferBackline: overrides.preferBackline ?? skill?.preferBackline,
    preferRanged: overrides.preferRanged ?? skill?.preferRanged,
    preferDebuffed: overrides.preferDebuffed ?? skill?.preferDebuffed,
    preferShielded: overrides.preferShielded ?? skill?.preferShielded,
    preferHighRage: overrides.preferHighRage ?? skill?.preferHighRage
  };
}
