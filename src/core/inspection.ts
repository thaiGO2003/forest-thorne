// Shared unit readout + combat-strength formulas (spec A59, A68). No UI formatting/layout ownership here.
import { NORMAL_UNITS, type Role, type UnitDef } from "../content/catalog";
import { STAR_STAT } from "./economy";

export const ROLE_EVASION_BASE: Readonly<Record<Role, number>> = {
  TANKER: 0.05, FIGHTER: 0.08, ASSASSIN: 0.15, ARCHER: 0.10, MAGE: 0.05, SUPPORT: 0.07,
};
export const ROLE_CRIT_BASE: Readonly<Record<Role, number>> = {
  TANKER: 0.05, FIGHTER: 0.05, ASSASSIN: 0.25, ARCHER: 0.20, MAGE: 0.10, SUPPORT: 0.05,
};
export const ROLE_ACCURACY_READOUT: Readonly<Record<Role, number>> = {
  TANKER: 90, FIGHTER: 105, ASSASSIN: 115, ARCHER: 105, MAGE: 100, SUPPORT: 95,
};

export function normalizeAttackRange(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 1;
}

export const attackRangeKind = (value: unknown): "melee" | "ranged" => normalizeAttackRange(value) >= 2 ? "ranged" : "melee";

export interface StarStatMilestone {
  star: 1 | 2 | 3;
  hp: number;
  atk: number;
  def: number;
  matk: number;
  mdef: number;
  basicDamage: number;
  range: number;
  rageCost: number;
}

export function starStatMilestones(unit: UnitDef): StarStatMilestone[] {
  return ([1, 2, 3] as const).map((star) => {
    const scale = STAR_STAT[star] ?? 1;
    const magicBasic = unit.role === "MAGE" || unit.role === "SUPPORT" || unit.basic.damageType === "magic";
    return {
      star,
      hp: Math.round(unit.stats.hp * scale),
      atk: Math.round(unit.stats.atk * scale),
      def: Math.round(unit.stats.def * scale),
      matk: Math.round(unit.stats.matk * scale),
      mdef: Math.round(unit.stats.mdef * scale),
      basicDamage: Math.round((magicBasic ? unit.stats.matk : unit.stats.atk) * scale),
      range: normalizeAttackRange(unit.stats.range),
      rageCost: Math.max(0, Math.round(unit.skill.rageCost[star - 1] ?? unit.stats.rageMax ?? 0)),
    };
  });
}

export interface SharedUnitReadout {
  tier: number;
  role: Role;
  faction: UnitDef["faction"];
  element: UnitDef["element"];
  milestones: StarStatMilestone[];
  rangeKind: "melee" | "ranged";
  baseEvasion: number;
  critRate: number;
  critDamage?: number;
  accuracyReadout: number;
}

export function sharedUnitReadout(unit: UnitDef): SharedUnitReadout {
  return {
    tier: unit.tier,
    role: unit.role,
    faction: unit.faction,
    element: unit.element,
    milestones: starStatMilestones(unit),
    rangeKind: attackRangeKind(unit.stats.range),
    baseEvasion: ROLE_EVASION_BASE[unit.role] ?? 0.05,
    critRate: unit.stats.crit ?? ROLE_CRIT_BASE[unit.role] ?? 0.05,
    critDamage: unit.stats.critDmg,
    accuracyReadout: (ROLE_ACCURACY_READOUT[unit.role] ?? 95) + 2 * Math.max(0, unit.tier - 1),
  };
}

export interface PowerInput {
  hp: number;
  maxHp: number;
  shield: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  star: number;
  tier: number;
  alive: boolean;
  side?: "LEFT" | "RIGHT";
}

const nonNegative = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;

export function combatPower(input: PowerInput, maximum = false): number {
  if (!maximum && !input.alive) return 0;
  const hp = maximum ? nonNegative(input.maxHp) : nonNegative(input.hp);
  const shield = maximum ? 0 : nonNegative(input.shield);
  const star = Math.max(1, Math.round(Number.isFinite(input.star) ? input.star : 1));
  const tier = Math.max(1, Math.round(Number.isFinite(input.tier) ? input.tier : 1));
  return Math.round(
    hp * 0.45 + shield * 0.20 + nonNegative(input.atk) * 6 + nonNegative(input.matk) * 6
    + nonNegative(input.def) * 4 + nonNegative(input.mdef) * 4 + star * 90 + tier * 40,
  );
}

export function relativePowerRatios(units: readonly PowerInput[]): number[] {
  const powers = units.map((unit) => combatPower(unit));
  const reference = Math.max(1, ...powers);
  return powers.map((power) => Math.max(0, Math.min(1, power / reference)));
}

export interface TeamStrength {
  units: number;
  hp: number;
  maxHp: number;
  hpRatio: number;
  power: number;
  maxPower: number;
  powerRatio: number;
}

export function teamStrength(units: readonly PowerInput[]): TeamStrength {
  const hp = units.reduce((sum, unit) => sum + (unit.alive ? nonNegative(unit.hp) : 0), 0);
  const maxHp = units.reduce((sum, unit) => sum + nonNegative(unit.maxHp), 0);
  const power = units.reduce((sum, unit) => sum + combatPower(unit), 0);
  const maxPower = units.reduce((sum, unit) => sum + combatPower(unit, true), 0);
  return {
    units: units.length,
    hp,
    maxHp,
    hpRatio: maxHp > 0 ? hp / maxHp : 0,
    power,
    maxPower,
    powerRatio: maxPower > 0 ? power / maxPower : 0,
  };
}

const ROLE_ORDER: Readonly<Record<Role, number>> = { ARCHER: 0, ASSASSIN: 1, FIGHTER: 2, MAGE: 3, SUPPORT: 4, TANKER: 5 };

/** A69 deterministic normal shop roster, independent from randomized offer rolls. */
export function canonicalShopRoster(tier?: number): UnitDef[] {
  return NORMAL_UNITS.filter((unit) => tier == null || unit.tier === tier)
    .slice()
    .sort((a, b) => a.tier - b.tier || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.id.localeCompare(b.id));
}
