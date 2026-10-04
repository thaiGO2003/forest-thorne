// Canonical game-speed math (A56). Pure: speed affects presentation timing only.
export const MIN_GAME_SPEED_LEVEL = 0;
export const MAX_GAME_SPEED_LEVEL = 10;
export const GAME_SPEED_STEP = 0.5;
export const BASE_COMBAT_DURATION_MULTIPLIER = 3;

export function normalizeGameSpeedLevel(speedLevel: number): number {
  const whole = Math.trunc(speedLevel);
  if (Number.isNaN(whole)) return MIN_GAME_SPEED_LEVEL;
  return Math.min(MAX_GAME_SPEED_LEVEL, Math.max(MIN_GAME_SPEED_LEVEL, whole));
}

export function getGameSpeedDisplayMultiplier(speedLevel: number): number {
  return 1 + GAME_SPEED_STEP * normalizeGameSpeedLevel(speedLevel);
}

export function getCombatDurationMultiplier(speedLevel: number): number {
  return BASE_COMBAT_DURATION_MULTIPLIER / getGameSpeedDisplayMultiplier(speedLevel);
}

export function scaleCombatPresentationMs(baseMs: number, speedLevel: number): number {
  return Math.max(0, baseMs) * getCombatDurationMultiplier(speedLevel);
}
