import { applyRoundResult, type RoundResultInput, type RoundResultSummary, type RunState } from "./run";
import { techModifiers } from "./tech";

export const FINISH_FAST_BASE_COST = 10;

/**
 * Canonical Finish Fast transaction. Combat resolution remains owned by applyRoundResult(); this
 * layer only prices the presentation skip from purchased technology and charges it afterward.
 */
export function finishFastCost(s: Pick<RunState, "techLevels">): number {
  const discount = Math.max(0, Math.floor(techModifiers(s.techLevels).finishFastDiscount ?? 0));
  return Math.max(0, FINISH_FAST_BASE_COST - discount);
}
export function applyFinishFast(
  s: RunState,
  input: RoundResultInput,
): RoundResultSummary | null {
  if (s.phase !== "COMBAT" || s.appliedCombats.includes(input.combatId)) return null;
  const cost = finishFastCost(s);
  if (s.gold < cost) return null;

  const summary = applyRoundResult(s, input);
  if (!summary) return null;

  // Charge after the canonical result so Finish Fast never changes authored reward/income math.
  s.gold -= cost;
  return summary;
}
