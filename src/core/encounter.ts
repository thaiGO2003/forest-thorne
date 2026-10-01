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
  hp: number; atk: number; matk: number; randomTarget: number; budget: number; maxStar: 1 | 2 | 3;
  star2Round: number | null; star3Round: number | null; equipStart: number; equipMaxTier: number; rageGain: number;
  frontShare: number;
}

const P = (hp: number, atk: number, rt: number, budget: number, maxStar: 1 | 2 | 3, s2: number | null, s3: number | null,
  equipStart: number, equipMaxTier: number, rageGain: number, frontShare: number): AiProfile =>
  ({ hp, atk, matk: atk, randomTarget: rt, budget, maxStar, star2Round: s2, star3Round: s3, equipStart, equipMaxTier, rageGain, frontShare });

export const AI_PROFILE: Record<AiMode, AiProfile> = {
  TUTORIAL: P(0.65, 0.6, 0.75, 0.7, 1, null, null, 99, 0, 0.8, 0.55),
  EASY: P(0.84, 0.82, 0.58, 0.9, 1, null, null, 8, 1, 1, 0.55),
  MEDIUM: P(0.95, 0.93, 0.3, 1, 2, 5, null, 6, 2, 1, 0.42),
  HARD: P(1.05, 1.04, 0.12, 1.05, 3, 4, 14, 5, 3, 1, 0.34),
  CREATIVE: P(0.75, 0.72, 0.8, 0.8, 1, null, null, 99, 0, 0.9, 0.55),
  COOP_EASY: P(0.98, 0.96, 0.42, 1.02, 2, 6, null, 7, 2, 1, 0.55),
  COOP_MEDIUM: P(1.08, 1.06, 0.22, 1.08, 2, 5, null, 6, 2, 1, 0.42),
  COOP_HARD: P(1.18, 1.15, 0.1, 1.15, 3, 4, 12, 5, 3, 1.05, 0.34),
  COOP4_EASY: P(0.98, 0.96, 0.42, 1.02, 2, 6, null, 7, 2, 1, 0.55),
  COOP4_MEDIUM: P(1.08, 1.06, 0.22, 1.08, 2, 5, null, 6, 2, 1, 0.42),
  COOP4_HARD: P(1.18, 1.15, 0.1, 1.15, 3, 4, 12, 5, 3, 1.05, 0.34),
};

export const normalizeAiMode = (v: unknown, fallback: AiMode = "MEDIUM"): AiMode =>
  (AI_MODES as readonly unknown[]).includes(v) ? (v as AiMode) : fallback;

export const BOSS_ROTATION = [
  "boss_ember_dragon", "boss_storm_phoenix", "boss_venom_hydra", "boss_earth_colossus", "boss_tempest_jelly",
] as const;

export const bossForRound = (round: number): string | null =>
  round > 0 && round % 10 === 0 ? BOSS_ROTATION[(Math.floor(round / 10) - 1) % 5]! : null;

export const encounterBudget = (round: number, mode: AiMode, sandbox = false, external = 1) =>
  Math.round((8 + round * (sandbox ? 2.1 : 2.6)) * AI_PROFILE[mode].budget * external);

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
  round: number; mode: AiMode; rng: () => number; sandbox?: boolean; bossRounds?: boolean;
  players?: 1 | 2 | 4; budgetMult?: number;
}

/**
 * ponytail: "working budget" spend is approximated by team size from the A33 level/deploy model
 * (tier cost not authored); equipment rolls omitted until an equipment catalog ships.
 */
export function generateEncounter(i: EncounterInput): Encounter {
  const { round, mode, rng } = i;
  const budget = encounterBudget(round, mode, i.sandbox, i.budgetMult);
  const boss = i.bossRounds ? bossForRound(round) : null;
  if (boss) return { boss: true, budget, units: [{ uid: "e0", baseId: boss, star: 3, row: 2, col: 7 }] };

  const ai = AI_PROFILE[mode];
  const hard = mode.endsWith("HARD");
  const maxTier = clamp(1 + Math.floor(round / 3), 1, 5);
  const level = clamp(1 + Math.floor(round / 2), 1, 15);
  let size = deployCap(level) + (hard ? 1 : 0) + Math.floor(round / 10) - (i.sandbox ? 1 : 0);
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
    if (ai.maxStar >= 3 && rng() < clamp((round - 11) * 0.018, 0, 0.08)) star = 3;
    else if (ai.maxStar >= 2 && rng() < clamp((round - 6) * 0.045, 0, 0.38)) star = 2;
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
