export const MAX_SPEED_LEVEL = 10;
export const SPEED_UPGRADE_COST = 3;
export const BASE_COMBAT_SPEED_MULTIPLIER = 3;
export const BASE_SPEED_MULTIPLIER = 1;
export const SPEED_STEP_MULTIPLIER = 0.5;
export const BASE_EMPTY_DELAY_MS = 50;
export const MIN_EMPTY_DELAY_MS = 1;

export function clampSpeedLevel(level: unknown): number {
  const numeric = Math.floor(Number(level) || 0);
  return Math.max(0, Math.min(MAX_SPEED_LEVEL, numeric));
}

export function isMaxSpeedLevel(level: unknown): boolean {
  return clampSpeedLevel(level) >= MAX_SPEED_LEVEL;
}

export function getSpeedUpgradeCost(level: unknown): number {
  return isMaxSpeedLevel(level) ? Infinity : SPEED_UPGRADE_COST;
}

export function getSpeedDisplayMultiplier(level: unknown): number {
  return BASE_SPEED_MULTIPLIER + clampSpeedLevel(level) * SPEED_STEP_MULTIPLIER;
}

export function getSpeedDisplayLabel(level: unknown): string {
  return `x${getSpeedDisplayMultiplier(level).toFixed(1)}`;
}

export function getCombatDurationMultiplier(level: unknown): number {
  return BASE_COMBAT_SPEED_MULTIPLIER / getSpeedDisplayMultiplier(level);
}

export function getSpeedEmptyDelayMs(level: unknown): number {
  const delay = BASE_EMPTY_DELAY_MS / getSpeedDisplayMultiplier(level);
  return Math.max(MIN_EMPTY_DELAY_MS, Math.round(delay));
}
