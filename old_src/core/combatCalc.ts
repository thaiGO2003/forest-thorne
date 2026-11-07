import { getOffenseDebuffValueForStat } from "./offenseDebuff.js";
import { getFighterMissingHpAtkPct } from "./rolePassives.js";

/**
 * Shared combat stat calculation functions.
 * 
 * Extracted from CombatScene, PlanningScene, and BoardPrototypeScene
 * to eliminate duplication. All scenes should import from this module.
 *
 * These are pure functions — they take a unit object and return a number.
 * No side effects, no scene references.
 */

interface UnitBase {
  stats?: {
    atk?: number;
    def?: number;
    matk?: number;
    mdef?: number;
  };
  classType?: string;
}

interface CombatUnit {
  atk?: number;
  def?: number;
  matk?: number;
  mdef?: number;
  star?: number;
  base?: UnitBase;
  statuses?: {
    atkBuffTurns?: number;
    atkBuffValue?: number;
    defBuffTurns?: number;
    defBuffValue?: number;
    matkBuffTurns?: number;
    matkBuffValue?: number;
    mdefBuffTurns?: number;
    mdefBuffValue?: number;
  };
  classType?: string;
  maxHp?: number;
  hp?: number;
}
/**
 * Safely read a stat from a unit, falling back to base stats if needed.
 * @param unit - Combat unit
 * @param statKey - e.g. "atk", "def", "matk", "mdef"
 * @param defaultValue - Default value if stat not found
 * @returns Stat value
 */
export function getUnitStatFallback(unit: CombatUnit | null | undefined, statKey: string, defaultValue: number = 0): number {
  if (!unit || typeof unit !== "object") return defaultValue;
  const direct = unit[statKey as keyof CombatUnit];
  if (Number.isFinite(direct)) return direct as number;
  const baseStat = unit.base?.stats?.[statKey as keyof UnitBase["stats"]];
  if (typeof baseStat !== "number" || !Number.isFinite(baseStat)) return defaultValue;
  const starRaw = unit.star;
  const star = typeof starRaw === "number" && Number.isFinite(starRaw) ? Math.max(1, Math.min(3, Math.floor(starRaw))) : 1;
  const scale = star >= 3 ? 2.5 : star === 2 ? 1.6 : 1;
  return Math.round(baseStat * scale);
}

/**
 * Effective ATK = base + buff - debuff (min 1)
 */
export function getEffectiveAtk(unit: CombatUnit | null | undefined): number {
  const statuses = unit?.statuses ?? {};
  const atkBase = getUnitStatFallback(unit, "atk", 1);
  const buff = (statuses.atkBuffTurns ?? 0) > 0 ? (statuses.atkBuffValue ?? 0) : 0;
  const debuff = getOffenseDebuffValueForStat(unit as Parameters<typeof getOffenseDebuffValueForStat>[0], "atk");
  const passivePct = getFighterMissingHpAtkPct(unit);
  return Math.max(1, Math.round((atkBase + buff - debuff) * (1 + passivePct)));
}

/**
 * Effective DEF = base + buff (min 0)
 */
export function getEffectiveDef(unit: CombatUnit | null | undefined): number {
  const statuses = unit?.statuses ?? {};
  const defBase = getUnitStatFallback(unit, "def", 0);
  const buff = (statuses.defBuffTurns ?? 0) > 0 ? (statuses.defBuffValue ?? 0) : 0;
  return Math.max(0, defBase + buff);
}

/**
 * Effective MATK = base (min 1)
 */
export function getEffectiveMatk(unit: CombatUnit | null | undefined): number {
  const statuses = unit?.statuses ?? {};
  const matkBase = getUnitStatFallback(unit, "matk", 1);
  const buff = (statuses.matkBuffTurns ?? 0) > 0 ? (statuses.matkBuffValue ?? 0) : 0;
  const debuff = getOffenseDebuffValueForStat(unit as Parameters<typeof getOffenseDebuffValueForStat>[0], "matk");
  return Math.max(1, matkBase + buff - debuff);
}

/**
 * Effective MDEF = base + buff (min 0)
 */
export function getEffectiveMdef(unit: CombatUnit | null | undefined): number {
  const statuses = unit?.statuses ?? {};
  const mdefBase = getUnitStatFallback(unit, "mdef", 0);
  const buff = (statuses.mdefBuffTurns ?? 0) > 0 ? (statuses.mdefBuffValue ?? 0) : 0;
  return Math.max(0, mdefBase + buff);
}
