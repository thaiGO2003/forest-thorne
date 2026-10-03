// AI encounter generation (A33) + endless boss schedule (A34). RNG injected; pure.
import { NORMAL_UNITS, type Role } from "../content/catalog";
import type { Placement } from "./combat";
import { deployCap } from "./economy";
import { EQUIPMENT, slotCapForUnit } from "./equipment";

export const AI_MODES = [
  "TUTORIAL", "EASY", "MEDIUM", "HARD", "CREATIVE", "COOP_EASY", "COOP_MEDIUM", "COOP_HARD",
  "COOP4_EASY", "COOP4_MEDIUM", "COOP4_HARD",
] as const;
export type AiMode = (typeof AI_MODES)[number];

export interface AiProfile {
  hp: number; atk: number; matk: number; rageGain: number; randomTarget: number;
  teamBonus: number; growthEvery: number; growthCap: number; budget: number; levelBonus: number; maxTierBonus: number;
  maxStar: 1 | 2 | 3; star2Round: number | null; star3Round: number | null; star2Bonus: number; star3Bonus: number;
  equipStart: number; equipBase: number; equipGrowth: number; equipCap: number; equipMaxTier: number;
  frontShare: number;
}

const P = (profile: AiProfile): AiProfile => profile;

export const AI_PROFILE: Record<AiMode, AiProfile> = {
  EASY: P({ hp: 0.84, atk: 0.82, matk: 0.82, rageGain: 1, randomTarget: 0.58, teamBonus: 0, growthEvery: 5, growthCap: 1, budget: 0.9, levelBonus: 0, maxTierBonus: 0, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 8, equipBase: 0.1, equipGrowth: 0.02, equipCap: 0.35, equipMaxTier: 1, frontShare: 0.55 }),
  COOP_EASY: P({ hp: 0.98, atk: 0.96, matk: 0.96, rageGain: 1, randomTarget: 0.42, teamBonus: 1, growthEvery: 4, growthCap: 2, budget: 1.02, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 6, star3Round: null, star2Bonus: 0.02, star3Bonus: -1, equipStart: 7, equipBase: 0.14, equipGrowth: 0.03, equipCap: 0.45, equipMaxTier: 2, frontShare: 0.55 }),
  COOP4_EASY: P({ hp: 0.98, atk: 0.96, matk: 0.96, rageGain: 1, randomTarget: 0.42, teamBonus: 1, growthEvery: 4, growthCap: 2, budget: 1.02, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 6, star3Round: null, star2Bonus: 0.02, star3Bonus: -1, equipStart: 7, equipBase: 0.14, equipGrowth: 0.03, equipCap: 0.45, equipMaxTier: 2, frontShare: 0.55 }),
  MEDIUM: P({ hp: 0.95, atk: 0.93, matk: 0.93, rageGain: 1, randomTarget: 0.3, teamBonus: 0, growthEvery: 5, growthCap: 1, budget: 1, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 5, star3Round: null, star2Bonus: -0.02, star3Bonus: -1, equipStart: 6, equipBase: 0.12, equipGrowth: 0.03, equipCap: 0.55, equipMaxTier: 2, frontShare: 0.42 }),
  COOP_MEDIUM: P({ hp: 1.08, atk: 1.06, matk: 1.06, rageGain: 1, randomTarget: 0.22, teamBonus: 1, growthEvery: 4, growthCap: 3, budget: 1.08, levelBonus: 1, maxTierBonus: 1, maxStar: 2, star2Round: 5, star3Round: null, star2Bonus: 0.03, star3Bonus: -1, equipStart: 6, equipBase: 0.16, equipGrowth: 0.04, equipCap: 0.62, equipMaxTier: 2, frontShare: 0.42 }),
  COOP4_MEDIUM: P({ hp: 1.08, atk: 1.06, matk: 1.06, rageGain: 1, randomTarget: 0.22, teamBonus: 1, growthEvery: 4, growthCap: 3, budget: 1.08, levelBonus: 1, maxTierBonus: 1, maxStar: 2, star2Round: 5, star3Round: null, star2Bonus: 0.03, star3Bonus: -1, equipStart: 6, equipBase: 0.16, equipGrowth: 0.04, equipCap: 0.62, equipMaxTier: 2, frontShare: 0.42 }),
  HARD: P({ hp: 1.05, atk: 1.04, matk: 1.04, rageGain: 1, randomTarget: 0.12, teamBonus: 1, growthEvery: 4, growthCap: 2, budget: 1.05, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 14, star2Bonus: 0, star3Bonus: 0, equipStart: 5, equipBase: 0.15, equipGrowth: 0.04, equipCap: 0.7, equipMaxTier: 3, frontShare: 0.34 }),
  COOP_HARD: P({ hp: 1.18, atk: 1.15, matk: 1.15, rageGain: 1.05, randomTarget: 0.1, teamBonus: 2, growthEvery: 3, growthCap: 4, budget: 1.15, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 12, star2Bonus: 0.05, star3Bonus: 0.02, equipStart: 5, equipBase: 0.18, equipGrowth: 0.05, equipCap: 0.78, equipMaxTier: 3, frontShare: 0.34 }),
  COOP4_HARD: P({ hp: 1.18, atk: 1.15, matk: 1.15, rageGain: 1.05, randomTarget: 0.1, teamBonus: 2, growthEvery: 3, growthCap: 4, budget: 1.15, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 12, star2Bonus: 0.05, star3Bonus: 0.02, equipStart: 5, equipBase: 0.18, equipGrowth: 0.05, equipCap: 0.78, equipMaxTier: 3, frontShare: 0.34 }),
  CREATIVE: P({ hp: 0.75, atk: 0.72, matk: 0.72, rageGain: 0.9, randomTarget: 0.8, teamBonus: -1, growthEvery: 8, growthCap: 0, budget: 0.8, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0, equipMaxTier: 0, frontShare: 0.55 }),
  TUTORIAL: P({ hp: 0.65, atk: 0.6, matk: 0.6, rageGain: 0.8, randomTarget: 0.75, teamBonus: -1, growthEvery: 8, growthCap: 0, budget: 0.7, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0, equipMaxTier: 0, frontShare: 0.55 }),
};

export const normalizeAiMode = (v: unknown, fallback: AiMode = "MEDIUM"): AiMode =>
  (AI_MODES as readonly unknown[]).includes(v) ? (v as AiMode) : fallback;

export type EncounterPlayerCount = 1 | 2 | 4;
export function encounterPlayerCount(mode: AiMode, override?: EncounterPlayerCount): EncounterPlayerCount {
  return override ?? (mode.startsWith("COOP4_") ? 4 : mode.startsWith("COOP_") ? 2 : 1);
}

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
function slotOrder(players: EncounterPlayerCount) {
  const rows = Array.from({ length: players }, (_, slot) => ROWS_ORDER.map((row) => row + slot * 5)).flat();
  const cells = (cols: number[]) => cols.flatMap((c) => rows.map((r) => ({ r, c })));
  return {
    front: cells([5, 6, 7, 8, 9]),
    back: cells([9, 8, 7, 6, 5]),
    assassin: [...cells([9]).filter((x) => x.r === 0 || x.r === players * 5 - 1), ...cells([9, 8, 7, 6, 5])],
  };
}

export interface Encounter { boss: boolean; budget: number; units: Placement[] }

export interface EncounterInput {
  round: number; mode: AiMode; rng: () => number; sandbox?: boolean; bossRounds?: boolean;
  players?: EncounterPlayerCount; budgetMult?: number;
}

/** Team spend remains approximated by the A33 level/deploy model because tier costs are not authored. */
export function generateEncounter(i: EncounterInput): Encounter {
  const { round, mode, rng } = i;
  const budget = encounterBudget(round, mode, i.sandbox, i.budgetMult);
  const boss = i.bossRounds ? bossForRound(round) : null;
  if (boss) return { boss: true, budget, units: [{ uid: "e0", baseId: boss, star: 3, row: 2, col: 7 }] };

  const ai = AI_PROFILE[mode];
  const players = encounterPlayerCount(mode, i.players);
  const slots = slotOrder(players);
  const hard = mode.endsWith("HARD");
  const maxTier = clamp(1 + Math.floor(round / 3) + ai.maxTierBonus, 1, 5);
  const level = clamp(1 + Math.floor(round / 2) + ai.levelBonus, 1, 15);
  const periodicGrowth = Math.min(ai.growthCap, Math.floor(Math.max(0, round) / ai.growthEvery));
  let size = deployCap(level) + ai.teamBonus + periodicGrowth - (i.sandbox ? 1 : 0);
  if (hard && round < 4) size = Math.min(size, 3);
  size = clamp(size * players, 1, players === 1 ? 15 : players * 25);

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

  const equipmentChance = round < ai.equipStart ? 0 : clamp(ai.equipBase + (round - ai.equipStart) * ai.equipGrowth, 0, ai.equipCap);
  const used: Record<string, true> = {};
  const units = picks.map((p, k): Placement => {
    const lane = FRONT.includes(p.u.role) ? "front" : p.u.role === "ASSASSIN" ? "assassin" : "back";
    const cell = slots[lane].find((x) => !used[`${x.r},${x.c}`])!;
    used[`${cell.r},${cell.c}`] = true;
    const eligibleEquipment = EQUIPMENT.filter((item) => item.tier <= ai.equipMaxTier && item.tier <= p.star);
    const equips: string[] = [];
    const slotCap = Math.min(slotCapForUnit(p.u, p.star), eligibleEquipment.length);
    while (equips.length < slotCap && rng() < equipmentChance) {
      const remaining = eligibleEquipment.filter((item) => !equips.includes(item.id));
      if (remaining.length === 0) break;
      equips.push(remaining[Math.floor(rng() * remaining.length)]!.id);
    }
    return { uid: `e${k}`, baseId: p.u.id, star: p.star, row: cell.r, col: cell.c, ...(equips.length ? { equips } : {}) };
  });
  return { boss: false, budget, units };
}
