import { applyRoundResult, type RoundResultInput, type RoundResultSummary, type RunState } from "./run";

export const FINISH_FAST_BASE_COST = 10;

/**
 * Canonical Finish Fast transaction.
 *
 * Combat logic is already resolved before presentation starts, so this only charges the
 * presentation skip cost and commits the same canonical round result. No discount is applied:
 * current tech/augment authority exposes no Finish Fast modifier.
 */
export function applyFinishFast(
  s: RunState,
  input: RoundResultInput,
): RoundResultSummary | null {
  if (s.phase !== "COMBAT" || s.appliedCombats.includes(input.combatId)) return null;
  if (s.gold < FINISH_FAST_BASE_COST) return null;

  const summary = applyRoundResult(s, input);
  if (!summary) return null;

  // Charge after the canonical result so Finish Fast never changes authored reward/income math.
  s.gold -= FINISH_FAST_BASE_COST;
  return summary;
}
