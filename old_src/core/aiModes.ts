export const AI_DIFFICULTY_ORDER = Object.freeze([
  "TUTORIAL",
  "EASY",
  "MEDIUM",
  "HARD",
  "CREATIVE",
  "COOP_EASY",
  "COOP_MEDIUM",
  "COOP_HARD",
  "COOP4_EASY",
  "COOP4_MEDIUM",
  "COOP4_HARD"
]);

export const AI_DIFFICULTY_VALUES = Object.freeze(new Set(AI_DIFFICULTY_ORDER));
export const CREATIVE_AI_MODE = "CREATIVE";
export const CREATIVE_GOLD_LABEL = "∞";
export const COOP_2P_AI_MODES = Object.freeze([
  "COOP_EASY",
  "COOP_MEDIUM",
  "COOP_HARD"
]);
export const COOP_4P_AI_MODES = Object.freeze([
  "COOP4_EASY",
  "COOP4_MEDIUM",
  "COOP4_HARD"
]);
export const COOP_AI_MODES = Object.freeze([
  ...COOP_2P_AI_MODES,
  ...COOP_4P_AI_MODES
]);
export const SOLO_FULL_AI_MODES = Object.freeze(
  AI_DIFFICULTY_ORDER.filter((mode) => !COOP_AI_MODES.includes(mode))
);
export const COOP_PLAYER_SLOTS = Object.freeze(["P1", "P2", "P3", "P4"]);
export const AI_MODE_I18N_KEYS = Object.freeze({
  TUTORIAL: "difficulty.tutorial",
  EASY: "difficulty.easy",
  MEDIUM: "difficulty.medium",
  HARD: "difficulty.hard",
  CREATIVE: "difficulty.creative",
  COOP_EASY: "difficulty.coopEasy",
  COOP_MEDIUM: "difficulty.coopMedium",
  COOP_HARD: "difficulty.coopHard",
  COOP4_EASY: "difficulty.coop4Easy",
  COOP4_MEDIUM: "difficulty.coop4Medium",
  COOP4_HARD: "difficulty.coop4Hard"
});

export function isValidAiMode(value: string) {
  return AI_DIFFICULTY_VALUES.has(value);
}

export function normalizeAiMode(value: string, fallback = "TUTORIAL") {
  return isValidAiMode(value) ? value : fallback;
}

export function isCreativeMode(aiMode: string) {
  return aiMode === CREATIVE_AI_MODE;
}

export function isCoopAiMode(mode: string) {
  return COOP_AI_MODES.includes(mode);
}

export function isFourPlayerCoopAiMode(mode: string) {
  return COOP_4P_AI_MODES.includes(mode);
}

export function getCoopPlayerCapacity(mode: string = "COOP_MEDIUM") {
  if (!isCoopAiMode(mode)) return 1;
  return isFourPlayerCoopAiMode(mode) ? 4 : 2;
}

export function getCoopPlayerSlots(mode: string = "COOP_MEDIUM") {
  const capacity = getCoopPlayerCapacity(mode);
  return COOP_PLAYER_SLOTS.slice(0, capacity);
}

export function getCoopBoardProfileId(mode: string = "COOP_MEDIUM") {
  return isFourPlayerCoopAiMode(mode) ? "coop4" : "coop";
}

export function getAiModeI18nKey(mode: string) {
  return (AI_MODE_I18N_KEYS as Record<string, string>)[mode] ?? null;
}

export function getCoopBaseDifficulty(mode: string) {
  switch (mode) {
    case "COOP_EASY":
    case "COOP4_EASY":
      return "EASY";
    case "COOP_HARD":
    case "COOP4_HARD":
      return "HARD";
    case "COOP_MEDIUM":
    case "COOP4_MEDIUM":
    default:
      return "MEDIUM";
  }
}

export function getGoldDisplayValue(aiMode: string, gold: number | string) {
  return isCreativeMode(aiMode) ? CREATIVE_GOLD_LABEL : gold;
}

export function shouldLockInRunDifficultyChanges() {
  return true;
}

export function hasManualEnemySandboxUnits(player: { creativeSandboxUnits?: Array<{ side?: string }> }) {
  if (!Array.isArray(player?.creativeSandboxUnits)) return false;
  return player.creativeSandboxUnits.some((unit) => unit?.side === "RIGHT");
}
