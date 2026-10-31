// Shared unit readout + combat-strength formulas (spec A59, A68). No UI formatting/layout ownership here.
import { NORMAL_UNITS, getUnit, type Role, type UnitDef } from "../content/catalog";
import { combatStat, makeFighter, type CombatUnitSnapshot, type Fighter, type Placement, type Side, type SideBonus } from "./combat";
import type { EnvironmentId } from "./environment";
import { STAR_STAT } from "./economy";
import type { DamageType } from "./skills";

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

export interface UnitStatSnapshot {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  matk: number;
  mdef: number;
  range: number;
  rage: number;
  rageMax: number;
  shield: number;
  crit: number;
  critDmg: number;
  accuracy: number;
  evade: number;
  lifesteal: number;
  rageGainPct: number;
  healPct: number;
  onHitBurn: number;
  onHitPoison: number;
  alive: boolean;
}

export interface UnitDiagnosticEffect {
  kind: "status" | "modifier" | "reaction";
  key: string;
  turns: number;
  value: number;
  /** Combat stat modifiers store percentage points (e.g. -20 means -20%). */
  pct?: boolean;
  reflectByDamageType?: Partial<Record<DamageType, number>>;
  sourceUnitBaseId?: string;
  firstBasicMultiplier?: number;
  rageOnKill?: number;
}

export interface UnitDiagnostics {
  uid: string;
  baseId: string;
  star: number;
  side: Side;
  readonly: boolean;
  environment?: EnvironmentId;
  equips: string[];
  base: UnitStatSnapshot;
  derived: UnitStatSnapshot;
  live: UnitStatSnapshot;
  effects: UnitDiagnosticEffect[];
}

function catalogSnapshot(unit: UnitDef): UnitStatSnapshot {
  return {
    hp: unit.stats.hp,
    maxHp: unit.stats.hp,
    atk: unit.stats.atk,
    def: unit.stats.def,
    matk: unit.stats.matk,
    mdef: unit.stats.mdef,
    range: normalizeAttackRange(unit.stats.range),
    rage: 0,
    rageMax: Math.max(1, unit.stats.rageMax),
    shield: 0,
    crit: unit.stats.crit ?? 0,
    critDmg: unit.stats.critDmg ?? 1.5,
    accuracy: unit.stats.accuracy ?? 0.95,
    evade: unit.stats.evade ?? 0,
    lifesteal: 0,
    rageGainPct: 0,
    healPct: 0,
    onHitBurn: 0,
    onHitPoison: 0,
    alive: true,
  };
}

function fighterSnapshot(fighter: Fighter, live: boolean): UnitStatSnapshot {
  return {
    hp: live ? fighter.hp : fighter.maxHp,
    maxHp: fighter.maxHp,
    atk: live ? combatStat(fighter, "atk") : fighter.atk,
    def: live ? combatStat(fighter, "def") : fighter.def,
    matk: live ? combatStat(fighter, "matk") : fighter.matk,
    mdef: live ? combatStat(fighter, "mdef") : fighter.mdef,
    range: fighter.range,
    rage: fighter.rage,
    rageMax: fighter.rageMax,
    shield: fighter.shield,
    crit: fighter.crit,
    critDmg: fighter.critDmg,
    accuracy: fighter.accuracy,
    evade: live ? combatStat(fighter, "evade") : fighter.evade,
    lifesteal: fighter.lifesteal,
    rageGainPct: fighter.rageGainPct,
    healPct: fighter.healPct,
    onHitBurn: fighter.onHitBurn,
    onHitPoison: fighter.onHitPoison,
    alive: fighter.alive,
  };
}

function diagnosticEffects(fighter: Pick<Fighter, "status" | "mods" | "reflect" | "counterTurns" | "phoenix" | "berserk">): UnitDiagnosticEffect[] {
  const effects: UnitDiagnosticEffect[] = [];
  for (const [key, status] of Object.entries(fighter.status)) {
    if (status.turns <= 0) continue;
    effects.push({ kind: "status", key, turns: status.turns, value: status.value, sourceUnitBaseId: status.source?.unitBaseId });
  }
  for (const mod of fighter.mods) {
    effects.push({ kind: "modifier", key: mod.stat, turns: mod.turns, value: mod.value, pct: mod.pct });
  }
  if (fighter.reflect) {
    const reflected = Object.entries(fighter.reflect.pctByDamageType);
    effects.push({
      kind: "reaction", key: "reflect", turns: fighter.reflect.turns,
      value: Math.max(0, ...reflected.map(([, pct]) => pct ?? 0)),
      reflectByDamageType: { ...fighter.reflect.pctByDamageType },
    });
  }
  if (fighter.counterTurns > 0) effects.push({ kind: "reaction", key: "counter", turns: fighter.counterTurns, value: 0 });
  if (fighter.phoenix.armed || fighter.phoenix.used) effects.push({ kind: "reaction", key: fighter.phoenix.used ? "phoenix-used" : "phoenix", turns: 0, value: fighter.phoenix.revivePct });
  if (fighter.berserk) effects.push({ kind: "reaction", key: "berserk", turns: fighter.berserk.turns, value: fighter.berserk.lifestealPct, firstBasicMultiplier: fighter.berserk.firstBasicMultiplier, rageOnKill: fighter.berserk.rageOnKill });
  return effects;
}

export function unitDiagnostics(
  placement: Placement,
  side: Side,
  bonus: SideBonus = {},
  environment?: EnvironmentId,
  liveFighter?: Fighter,
  readonly = side === "R",
): UnitDiagnostics {
  const derivedFighter = makeFighter(placement, side, bonus, environment);
  const live = liveFighter?.uid === placement.uid ? liveFighter : derivedFighter;
  return {
    uid: placement.uid,
    baseId: placement.baseId,
    star: placement.star,
    side,
    readonly,
    environment,
    equips: [...(placement.equips ?? [])],
    base: catalogSnapshot(getUnit(placement.baseId)),
    derived: fighterSnapshot(derivedFighter, false),
    live: fighterSnapshot(live, true),
    effects: diagnosticEffects(live),
  };
}

/** Apply the inspection frame published at the visual event boundary, not the precomputed combat result. */
export function projectLiveDiagnostics(diagnostics: UnitDiagnostics, snapshot: CombatUnitSnapshot): UnitDiagnostics {
  if (diagnostics.uid !== snapshot.uid) return diagnostics;
  return {
    ...diagnostics,
    live: {
      ...diagnostics.live,
      hp: snapshot.hp, maxHp: snapshot.maxHp,
      atk: snapshot.atk, matk: snapshot.matk, def: snapshot.def, mdef: snapshot.mdef,
      rage: snapshot.rage, rageMax: snapshot.rageMax, shield: snapshot.shield,
      range: snapshot.range, evade: snapshot.evade, crit: snapshot.crit, accuracy: snapshot.accuracy,
      lifesteal: snapshot.lifesteal, healPct: snapshot.healPct, rageGainPct: snapshot.rageGainPct,
      onHitBurn: snapshot.onHitBurn, onHitPoison: snapshot.onHitPoison, alive: snapshot.alive,
    },
    effects: diagnosticEffects(snapshot),
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
