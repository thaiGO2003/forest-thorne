// Augments (spec A10). Generated families × 5 authored values; apply once per id; score is presentation-only.
import { addXp } from "./economy";
import type { RunState } from "./run";

export type AugGroup = "ECONOMY" | "FORMATION" | "COMBAT" | "SYNERGY";
export interface Augment {
  id: string;
  effect: string;
  value: number;
  group: AugGroup;
}

export const AUGMENT_ROUNDS = [3, 5, 7] as const;

const FAMILIES: [string, string, AugGroup, number[]][] = [
  ["gold_cache", "gold_flat", "ECONOMY", [4, 6, 8, 10, 12]],
  ["reroll_bargain", "roll_cost_delta", "ECONOMY", [-1, -1, -1, -1, -2]],
  ["xp_sprout", "xp_flat", "ECONOMY", [6, 8, 10, 12, 14]],
  ["xp_discount", "xp_cost_delta", "ECONOMY", [-1, -1, -1, -1, -2]],
  ["victory_gold", "win_gold_bonus", "ECONOMY", [1, 1, 2, 2, 3]],
  ["interest_flow", "interest_rate_bonus", "ECONOMY", [0.01, 0.01, 0.02, 0.02, 0.03]],
  ...(["atk", "def", "hp", "matk", "mdef"] as const).map(
    (k): [string, string, AugGroup, number[]] => [`team_${k}`, `team_${k}_pct`, "COMBAT", [0.05, 0.07, 0.09, 0.11, 0.13]]),
  ["opening_rage", "starting_rage", "COMBAT", [1, 1, 1, 2, 2]],
  ["starting_shield", "starting_shield", "COMBAT", [18, 24, 30, 36, 42]],
  ["lifesteal", "lifesteal_pct", "COMBAT", [0.04, 0.05, 0.06, 0.08, 0.1]],
  ["interest_cap", "interest_cap", "ECONOMY", [1, 1, 1, 2, 2]],
  ["deploy_cap", "deploy_cap_bonus", "FORMATION", [1, 1, 1, 1, 1]],
  ["bench", "bench_bonus", "FORMATION", [1, 1, 2, 2, 3]],
  ["inventory", "inventory_bonus", "FORMATION", [1, 1, 2, 2, 3]],
  ["class_echo", "extra_class_count", "SYNERGY", [1, 1, 1, 1, 1]],
  ["tribe_echo", "extra_tribe_count", "SYNERGY", [1, 1, 1, 1, 1]],
];

export const AUGMENTS: Augment[] = FAMILIES.flatMap(([fam, effect, group, vals]) =>
  vals.map((value, i) => ({ id: `${fam}_${i + 1}`, effect, value, group })));
export const AUGMENT_BY_ID: ReadonlyMap<string, Augment> = new Map(AUGMENTS.map((a) => [a.id, a]));

const GROUP_BONUS: Record<AugGroup, number> = { ECONOMY: 2, FORMATION: 5, COMBAT: 4, SYNERGY: 8 };
/** [base, valueUnit, weight, maxBonus, abs]. */
const SCORE: Record<string, [number, number, number, number, boolean]> = {
  gold_flat: [43, 1, 2.3, 18, false], interest_cap: [66, 1, 12, 18, false], roll_cost_delta: [60, 1, 10, 14, true],
  deploy_cap_bonus: [74, 1, 11, 14, false], bench_bonus: [56, 1, 6, 12, false], inventory_bonus: [44, 1, 7, 10, false],
  starting_rage: [63, 1, 10, 14, false], team_atk_pct: [52, 0.01, 1.2, 16, false], team_hp_pct: [52, 0.01, 1.15, 16, false],
  team_matk_pct: [54, 0.01, 1.2, 18, false], team_def_pct: [51, 0.01, 1.1, 15, false], team_mdef_pct: [51, 0.01, 1.1, 15, false],
  starting_shield: [54, 5, 1.5, 16, false], extra_class_count: [79, 1, 7, 10, false], extra_tribe_count: [79, 1, 7, 10, false],
  lifesteal_pct: [58, 0.01, 1.15, 14, false], xp_flat: [47, 1, 1.25, 16, false], win_gold_bonus: [56, 1, 7, 16, false],
  interest_rate_bonus: [72, 0.01, 6, 12, false], xp_cost_delta: [72, 1, 10, 12, true], rage_gain_pct: [56, 0.01, 1.15, 16, false],
};

export function augmentScore(a: Augment): number {
  const p = SCORE[a.effect];
  if (!p) return 50 + GROUP_BONUS[a.group];
  const [base, unit, weight, max, abs] = p;
  const scaled = (abs ? Math.abs(a.value) : a.value) / unit;
  return Math.max(0, Math.min(100, Math.round(base + Math.min(max, scaled * weight) + GROUP_BONUS[a.group])));
}

export const augmentBand = (score: number) => (score >= 82 ? "Rare" : score >= 62 ? "Strong" : "Tactical");

/** Fields on RunState that an augment effect directly owns. */
const RUN_FIELD: Partial<Record<string, "rollCostDelta" | "xpCostDelta" | "deployBonus" | "benchBonus">> = {
  roll_cost_delta: "rollCostDelta", xp_cost_delta: "xpCostDelta", deploy_cap_bonus: "deployBonus", bench_bonus: "benchBonus",
};

/** Apply once per id: immediate gold/XP + persistent modifier accumulation. Returns false (no change) on repeat/unknown. */
export function applyAugment(s: RunState, id: string): boolean {
  const a = AUGMENT_BY_ID.get(id);
  if (!a || s.augments.includes(id)) return false;
  s.augments.push(id);
  s.augmentMods[a.effect] = (s.augmentMods[a.effect] ?? 0) + a.value;
  if (a.effect === "gold_flat") s.gold += a.value;
  if (a.effect === "xp_flat") Object.assign(s, addXp(s.level, s.xp, a.value));
  const f = RUN_FIELD[a.effect];
  if (f) s[f] += a.value;
  return true;
}
