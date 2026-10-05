// Pure economy/progression formulas (spec A2, A3, A4, A5). No state, no IO.

/** XP needed to go from level N to N+1; index = level. Beyond table: Infinity. */
const XP_TABLE = [0, 2, 4, 6, 10, 16, 24, 36, 52, 68, 88, 112, 140, 172, 208, 248, 292, 340, 392, 448, 508, 572, 640, 712, 788, 868];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function xpToNext(level: number): number {
  return XP_TABLE[level] ?? Infinity;
}

/** Apply XP with carry-over level-ups. */
export function addXp(
  level: number, xp: number, gain: number, maxLevel = Number.POSITIVE_INFINITY,
): { level: number; xp: number } {
  xp += gain;
  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
  }
  return { level, xp };
}

export const xpBuyCost = (xpCostDelta = 0) => Math.max(1, 4 + xpCostDelta);

export function refreshCost(level: number, rollCostDelta = 0): number {
  const base = level <= 10 ? 2 : level <= 15 ? 3 : level <= 20 ? 4 : 5;
  return Math.max(1, base + rollCostDelta);
}

/** Deploy cap: clamp(level+2, 3, 25) + bonus, never above the 25 physical cells. */
export const deployCap = (level: number, bonus = 0) => Math.min(25, clamp(level + 2, 3, 25) + bonus);

/** Bench capacity; Creative reserves one perimeter slot for its dummy selector. */
export const benchCapacity = (benchUpgradeLevel: number, benchBonus = 0, creative = false) =>
  clamp(8 + benchUpgradeLevel * 6 + benchBonus, 1, 44) - (creative ? 1 : 0);

const STAR_SELL = [0, 1, 3, 5];
export const sellValue = (tier: number, star: number) => tier * (STAR_SELL[star] ?? 0);

/** Stat, raw-skill damage, and status-chance star scaling use distinct A4/A12 tables. Index = star. */
export const STAR_STAT = [0, 1.0, 1.6, 2.5];
export const STAR_SKILL = [0, 1.0, 1.2, 1.4];
export const STAR_EFFECT_CHANCE = [0, 1.0, 1.4, 2.0];

// Shop tier odds (A3): [peak, leftSpan, rightSpan] per tier.
const TIER_PROFILES: [number, number, number][] = [
  [1, 0, 12], [8, 7, 10], [15, 10, 10], [20, 8, 10], [25, 10, 0],
];

export function shopTierOdds(level: number): number[] {
  const lv = clamp(Math.round(level), 1, 25);
  if (lv === 1) return [1, 0, 0, 0, 0];
  const rawW = TIER_PROFILES.map(([peak, l, r]) => {
    if (lv === peak) return 1;
    if (lv < peak) return l === 0 ? 0 : Math.max(0, (lv - (peak - l)) / l);
    return r === 0 ? 0 : Math.max(0, (peak + r - lv) / r);
  });
  const sum = rawW.reduce((a, b) => a + b, 0);
  const p = rawW.map((w) => Math.round((w / sum) * 1e4) / 1e4);
  const drift = 1 - p.reduce((a, b) => a + b, 0);
  const big = p.indexOf(Math.max(...p));
  p[big] = Math.round((p[big]! + drift) * 1e4) / 1e4;
  return p;
}

export interface IncomeMods {
  interestCapBonus?: number;
  interestRateBonus?: number;
  fixedIncome?: number;
}

/** Planning-round income (A5). Creative callers must skip this entirely. */
export function roundIncome(
  gold: number, winStreak: number, loseStreak: number, base = 5, m: IncomeMods = {},
): number {
  const cap = 5 + (m.interestCapBonus ?? 0);
  const rate = 0.1 + (m.interestRateBonus ?? 0);
  // Epsilon: 0.1-based float rates can land at x.9999… for integer gold; floor must see the intended integer.
  const interest = Math.min(cap, Math.floor(Math.max(0, gold) * Math.max(0, rate) + 1e-9));
  const streakBonus = (s: number) => (s >= 2 ? Math.min(3, Math.floor(s / 2)) : 0);
  return base + interest + Math.max(streakBonus(winStreak), streakBonus(loseStreak)) + Math.max(0, m.fixedIncome ?? 0);
}
