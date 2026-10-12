export type DayNightPhase = "day" | "night";

/** Odd rounds are day; even rounds are night. Round values below 1 clamp to round 1. */
export function dayNightForRound(round: number): DayNightPhase {
  const normalized = Math.max(1, Math.floor(round));
  return normalized % 2 === 0 ? "night" : "day";
}
