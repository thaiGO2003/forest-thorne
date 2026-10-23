interface CombatPowerStats {
  hp?: unknown;
  shield?: unknown;
  atk?: unknown;
  matk?: unknown;
  def?: unknown;
  mdef?: unknown;
  star?: unknown;
  tier?: unknown;
  alive?: boolean;
}

function readNumericStat(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function calculateCombatPowerFromStats(stats: CombatPowerStats = {}): number {
  const hp = Math.max(0, readNumericStat(stats.hp));
  const shield = Math.max(0, readNumericStat(stats.shield));
  const atk = Math.max(0, readNumericStat(stats.atk));
  const matk = Math.max(0, readNumericStat(stats.matk));
  const def = Math.max(0, readNumericStat(stats.def));
  const mdef = Math.max(0, readNumericStat(stats.mdef));
  const star = Math.max(1, readNumericStat(stats.star) || 1);
  const tier = Math.max(1, readNumericStat(stats.tier) || 1);
  return Math.max(0, Math.round(
    hp * 0.45
    + shield * 0.2
    + atk * 6
    + matk * 6
    + def * 4
    + mdef * 4
    + star * 90
    + tier * 40
  ));
}

export function calculateCombatUnitPower(unit: CombatPowerStats = {}): number {
  if (!unit || unit.alive === false) return 0;
  return calculateCombatPowerFromStats(unit);
}

export function getCombatPowerReference(
  units: CombatPowerStats[],
  resolveUnitPower: (unit: CombatPowerStats) => number = calculateCombatUnitPower
): number {
  const list = Array.isArray(units) ? units : [];
  const maxPower = list.reduce((max, unit) => {
    const power = Math.max(0, Math.round(resolveUnitPower(unit)));
    return power > max ? power : max;
  }, 0);
  return Math.max(1, maxPower);
}

export function getCombatPowerReferenceFromValues(values: unknown[]): number {
  const list = Array.isArray(values) ? values : [];
  const maxPower: number = list.reduce<number>((max, value) => {
    const power = Math.max(0, Math.round(readNumericStat(value)));
    return power > max ? power : max;
  }, 0);
  return Math.max(1, maxPower);
}

export function getCombatPowerRatio(power: unknown, referencePower: unknown): number {
  const current = Math.max(0, readNumericStat(power));
  const max = Math.max(1, readNumericStat(referencePower) || 0);
  return Math.max(0, Math.min(1, current / max));
}
