/**
 * boardConstants.ts
 *
 * Shared board/phase constants used across PlanningScene and CombatScene.
 * Previously duplicated in multiple scene files.
 */

export const PHASE = {
    PLANNING: "PLANNING",
    AUGMENT: "AUGMENT",
    COMBAT: "COMBAT",
    GAME_OVER: "GAME_OVER"
} as const;

export type PhaseType = typeof PHASE[keyof typeof PHASE];

export const TILE_W = 98;
export const TILE_H = 50;
export const ROWS = 5;
export const COLS = 10;
export const PLAYER_COLS = 5;
export const RIGHT_COL_START = 5;
export const RIGHT_COL_END = 9;
export const BOARD_GAP_COLS = 1;
export const BOARD_FILES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const RIVER_LAYER_DEPTH = 1;
