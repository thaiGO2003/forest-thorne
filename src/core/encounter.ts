// AI encounter generation (A33) + endless boss schedule (A34). RNG injected; pure.
import { NORMAL_UNITS, type Role } from "../content/catalog";
import type { Placement } from "./combat";
import { deployCap } from "./economy";

export const AI_MODES = [
  "TUTORIAL", "EASY", "MEDIUM", "HARD", "CREATIVE", "COOP_EASY", "COOP_MEDIUM", "COOP_HARD",
  "COOP4_EASY", "COOP4_MEDIUM", "COOP4_HARD",
] as const;
export type AiMode = (typeof AI_MODES)[number];

export interface AiProfile {
  hp: number;
  atk: number;
  matk: number;
  rageGain: number;
  randomTarget: number;
  teamBonus: number;
  growthEvery: number;
  growthCap: number;
  budget: number;
  levelBonus: number;
  maxTierBonus: number;
  maxStar: 1 | 2 | 3;
  star2Round: number | null;
  star3Round: number | null;
  star2Bonus: number;
  star3Bonus: number;
  equipStart: number;
  equipBase: number;
  equipGrowth: number;
  equipCap: number;
  equipMaxTier: number;
  frontShare: number;
}

const P = (p: Omit<AiProfile, "matk"> & { matk?: number }): AiProfile => ({ ...p, matk: p.matk ?? p.atk });

const EASY = P({
  hp: 0.84, atk: 0.82, rageGain: 1, randomTarget: 0.58, teamBonus: 0, growthEvery: 5, growthCap: 1,
  budget: 0.9, levelBonus: 0, maxTierBonus: 0, maxStar: 1, star2Round: null, star3Round: null,
  star2Bonus: -1, star3Bonus: -1, equipStart: 8, equipBase: 0.1, equipGrowth: 0.02, equipCap: 0.35,
  equipMaxTier: 1, frontShare: 0.55,
});
const MEDIUM = P({
  hp: 0.95, atk: 0.93, rageGain: 1, randomTarget: 0.3, teamBonus: 0, growthEvery: 5, growthCap: 1,
  budget: 1, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 5, star3Round: null,
  star2Bonus: -0.02, star3Bonus: -1, equipStart: 6, equipBase: 0.12, equipGrowth: 0.03, equipCap: 0.55,
  equipMaxTier: 2, frontShare: 0.42,
});
const HARD = P({
  hp: 1.05, atk: 1.04, rageGain: 1, randomTarget: 0.12, teamBonus: 1, growthEvery: 4, growthCap: 2,
  budget: 1.05, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 14,
  star2Bonus: 0, star3Bonus: 0, equipStart: 5, equipBase: 0.15, equipGrowth: 0.04, equipCap: 0.7,
  equipMaxTier: 3, frontShare: 0.34,
});
const COOP_EASY = P({
  hp: 0.98, atk: 0.96, rageGain: 1, randomTarget: 0.42, teamBonus: 1, growthEvery: 4, growthCap: 2,
  budget: 1.02, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 6, star3Round: null,
  star2Bonus: 0.02, star3Bonus: -1, equipStart: 7, equipBase: 0.14, equipGrowth: 0.03, equipCap: 0.45,
  equipMaxTier: 2, frontShare: 0.55,
});
const COOP_MEDIUM = P({
  hp: 1.08, atk: 1.06, rageGain: 1, randomTarget: 0.22, teamBonus: 1, growthEvery: 4, growthCap: 3,
  budget: 1.08, levelBonus: 1, maxTierBonus: 1, maxStar: 2, star2Round: 5, star3Round: null,
  star2Bonus: 0.03, star3Bonus: -1, equipStart: 6, equipBase: 0.16, equipGrowth: 0.04, equipCap: 0.62,
  equipMaxTier: 2, frontShare: 0.42,
});
const COOP_HARD = P({
  hp: 1.18, atk: 1.15, rageGain: 1.05, randomTarget: 0.1, teamBonus: 2, growthEvery: 3, growthCap: 4,
  budget: 1.15, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 12,
  star2Bonus: 0.05, star3Bonus: 0.02, equipStart: 5, equipBase: 0.18, equipGrowth: 0.05, equipCap: 0.78,
  equipMaxTier: 3, frontShare: 0.34,
});
const CREATIVE = P({
  hp: 0.75, atk: 0.72, rageGain: 0.9, randomTarget: 0.8, teamBonus: -1, growthEvery: 8, growthCap: 0,
  budget: 0.8, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null,
  star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0,
  equipMaxTier: 0, frontShare: 0.55,
});
const TUTORIAL = P({
  hp: 0.65, atk: 0.6, rageGain: 0.8, randomTarget: 0.75, teamBonus: -1, growthEvery: 8, growthCap: 0,
  budget: 0.7, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null,
  star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0,
  equipMaxTier: 0, frontShare: 0.55,
});

export const AI_PROFILE: Record<AiMode, AiProfile> = {
  TUTORIAL,
  EASY,
  MEDIUM,
  HARD,
  CREATIVE,
  COOP_EASY,
  COOP_MEDIUM,
  COOP_HARD,
  COOP4_EASY: { ...COOP_EASY },
  COOP4_MEDIUM: { ...COOP_MEDIUM },
  COOP4_HARD: { ...COOP_HARD },
};

export const normalizeAiMode = (v: unknown, fallback: AiMode = "MEDIUM"): AiMode =>
  (AI_MODES as readonly unknown[]).includes(v) ? (v as AiMode) : fallback;

export const BOSS_ROTATION = [
  "boss_ember_dragon", "boss_storm_phoenix", "boss_venom_hydra", "boss_earth_colossus", "boss_tempest_jelly",
] as const;

export const bossForRound = (round: number): string | null =>
  round > 0 && round % 10 === 0 ? BOSS_ROTATION[(Math.floor(round / 10) - 1) % 5]! : null;

export const encounterBudget = (round: number, mode: unknown, sandbox = false, external = 1) => {
  const profile = AI_PROFILE[normalizeAiMode(mode)];
  return Math.round((8 + round * (sandbox ? 2.1 : 2.6)) * profile.budget * external);
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const FRONT: Role[] = ["TANKER", "FIGHTER"];
// Enemy half: cols 5 (front) .. 9 (back). Role priority lists consume unique cells deterministically.
const ROWS_ORDER = [2, 1, 3, 0, 4];
const cells = (cols: number[]) => cols.flatMap((c) => ROWS_ORDER.map((r) => ({ r, c })));
const SLOT_ORDER: Record<"front" | "back" | "assassin", { r: number; c: number }[]> = {
  front: cells([5, 6, 7, 8, 9]),
  back: cells([9, 8, 7, 6, 5]),
  assassin: [...cells([9]).filter((x) => x.r === 0 || x.r === 4), ...cells([9, 8, 7, 6, 5])],
};

export interface Encounter { boss: boolean; budget: number; units: Placement[] }

export interface EncounterInput {
  round: number; mode: unknown; rng: () => number; sandbox?: boolean; bossRounds?: boolean;
  players?: 1 | 2 | 4; budgetMult?: number;
}

/**
 * ponytail: "working budget" spend is approximated by team size from the A33 level/deploy model
 * (tier cost not authored); equipment rolls stay blocked until canonical encounter item-selection semantics exist.
 */
export function generateEncounter(i: EncounterInput): Encounter {
  const { round, rng } = i;
  const mode = normalizeAiMode(i.mode);
  const budget = encounterBudget(round, mode, i.sandbox, i.budgetMult);
  const boss = i.bossRounds ? bossForRound(round) : null;
  if (boss) return { boss: true, budget, units: [{ uid: "e0", baseId: boss, star: 3, row: 2, col: 7 }] };

  const ai = AI_PROFILE[mode];
  const hard = mode.endsWith("HARD");
  const maxTier = clamp(1 + Math.floor(round / 3) + ai.maxTierBonus, 1, 5);
  const level = clamp(1 + Math.floor(round / 2) + ai.levelBonus, 1, 15);
  const periodicGrowth = ai.growthCap > 0 ? Math.min(ai.growthCap, Math.floor(round / ai.growthEvery)) : 0;
  let size = deployCap(level) + ai.teamBonus + periodicGrowth - (i.sandbox ? 1 : 0);
  if (hard && round < 4) size = Math.min(size, 3);
  size = clamp(size * (i.players ?? 1), 1, (i.players ?? 1) === 1 ? 15 : 25);

  const pool = NORMAL_UNITS.filter((u) => u.tier <= maxTier);
  const pickFrom = (wantFront: boolean) => {
    const sub = pool.filter((u) => FRONT.includes(u.role) === wantFront);
    const list = sub.length ? sub : pool;
    return list[Math.floor(rng() * list.length)]!;
  };
  const frontNeed = Math.ceil(size * ai.frontShare);
  const picks = Array.from({ length: size }, (_, k) => {
    const u = pickFrom(k < frontNeed);
    let star: 1 | 2 | 3 = 1;
    if (ai.maxStar >= 3 && rng() < clamp((round - 11) * 0.018 + ai.star3Bonus, 0, 0.08)) star = 3;
    else if (ai.maxStar >= 2 && rng() < clamp((round - 6) * 0.045 + ai.star2Bonus, 0, 0.38)) star = 2;
    return { u, star };
  });
  // Guaranteed stars: 2★ grows every 4 rounds up to half; 3★ every 6 rounds up to quarter, higher tier first.
  const byTier = [...picks].sort((a, b) => b.u.tier - a.u.tier);
  if (ai.star3Round !== null && round >= ai.star3Round) {
    const need = Math.min(Math.floor(size / 4), 1 + Math.floor((round - ai.star3Round) / 6));
    for (const p of byTier.filter((p) => p.star < 3).slice(0, Math.max(0, need - picks.filter((p) => p.star === 3).length))) p.star = 3;
  }
  if (ai.star2Round !== null && round >= ai.star2Round) {
    const need = Math.min(Math.floor(size / 2), 1 + Math.floor((round - ai.star2Round) / 4));
    for (const p of byTier.filter((p) => p.star < 2).slice(0, Math.max(0, need - picks.filter((p) => p.star >= 2).length))) p.star = 2;
  }

  const used: Record<string, true> = {};
  const units = picks.map((p, k): Placement => {
    const lane = FRONT.includes(p.u.role) ? "front" : p.u.role === "ASSASSIN" ? "assassin" : "back";
    const cell = SLOT_ORDER[lane].find((x) => !used[`${x.r},${x.c}`])!;
    used[`${cell.r},${cell.c}`] = true;
    return { uid: `e${k}`, baseId: p.u.id, star: p.star, row: cell.r, col: cell.c };
  });
  return { boss: false, budget, units };
}
