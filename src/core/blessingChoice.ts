// Round-3 blessing choice (A-blessing): a single, atomic, player-visible pick that boosts the
// next planning/combat step. Canonical state lives on RunState so saves, replays and co-op all
// read the same choice; presentation only reads `pendingBlessingChoice`.
import type { RunState } from "./run";

export const BLESSING_CHOICE_IDS = ["gold_cache", "forest_order", "opening_fury"] as const;
export type BlessingChoiceId = (typeof BLESSING_CHOICE_IDS)[number];

export const BLESSING_CHOICE_ROUND = 3;

export interface BlessingChoiceDefinition {
  id: BlessingChoiceId;
  group: "ECONOMY" | "FORMATION" | "COMBAT";
  value: number;
}

export const BLESSING_CHOICES: readonly BlessingChoiceDefinition[] = Object.freeze([
  { id: "gold_cache", group: "ECONOMY", value: 4 },
  { id: "forest_order", group: "FORMATION", value: 1 },
  { id: "opening_fury", group: "COMBAT", value: 1 },
]);

export function isBlessingChoiceId(value: unknown): value is BlessingChoiceId {
  return typeof value === "string" && (BLESSING_CHOICE_IDS as readonly string[]).includes(value);
}

export function normalizeBlessingPicks(value: unknown): BlessingChoiceId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isBlessingChoiceId))];
}

export function normalizePendingBlessingChoice(
  value: unknown,
  round: unknown,
  phase: unknown,
  picks: readonly BlessingChoiceId[],
): boolean {
  if (picks.length > 0) return false;
  const normalizedRound = Number(round);
  if (!Number.isFinite(normalizedRound) || normalizedRound < BLESSING_CHOICE_ROUND) return false;
  if (phase !== "PLANNING" && phase !== "AUGMENT") return false;
  // Unknown legacy saves on the exact trigger round are prompted; later rounds are untouched.
  if (value === undefined) return normalizedRound === BLESSING_CHOICE_ROUND;
  return value === true;
}

/** Mark the round-3 choice as owed exactly once. Later rounds never back-fill it. */
export function syncBlessingChoice(s: RunState): boolean {
  if (s.pendingBlessingChoice) return true;
  if (s.phase === "GAME_OVER") return false;
  if (s.round !== BLESSING_CHOICE_ROUND || s.blessingPicks.length > 0) return false;
  s.pendingBlessingChoice = true;
  return true;
}

/** Atomic canonical application; the caller persists and narrates once. */
export function applyBlessingChoice(s: RunState, id: BlessingChoiceId): boolean {
  if (!s.pendingBlessingChoice || !isBlessingChoiceId(id) || s.blessingPicks.includes(id)) return false;
  switch (id) {
    case "gold_cache":
      s.gold = Math.max(0, s.gold + 4);
      break;
    case "forest_order":
      s.deployCapBonus = Math.max(0, s.deployCapBonus + 1);
      break;
    case "opening_fury":
      s.pendingCombatRage = Math.max(0, s.pendingCombatRage + 1);
      break;
  }
  s.blessingPicks.push(id);
  s.pendingBlessingChoice = false;
  return true;
}

/** Read and clear the one-shot combat rage. Returns 0 when nothing is owed. */
export function consumeBlessingCombatRage(s: RunState): number {
  const rage = Math.max(0, Math.round(Number(s.pendingCombatRage) || 0));
  s.pendingCombatRage = 0;
  return rage;
}
