import {
  BOARD_GAP_COLS,
  COLS,
  PLAYER_COLS,
  RIGHT_COL_END,
  RIGHT_COL_START,
  ROWS
} from "./boardConstants.js";

const SOLO_ROWS = ROWS;
const SOLO_ROW_SPAN = ROWS;
const COOP_PLAYER_SLOTS = Object.freeze(["P1", "P2", "P3", "P4"]) as readonly string[];

interface PlayerSpan {
  offset: number;
  rowCount: number;
}

interface PlayerSpans {
  [slot: string]: PlayerSpan;
}

interface BoardProfile {
  id: string;
  playerCount: number;
  rowsPerPlayer: number;
  rows: number;
  logicalCols: number;
  visualCols: number;
  playerCols: number;
  enemyCols: number;
  riverGapCols: number;
  enemyColStart: number;
  enemyColEnd: number;
  playerRowSpans: PlayerSpans;
}

function createCoopPlayerSpans(playerCount: number, rowsPerPlayer: number = SOLO_ROW_SPAN): PlayerSpans {
  const spans: PlayerSpans = {};
  for (let idx = 0; idx < playerCount; idx += 1) {
    spans[`P${idx + 1}`] = Object.freeze({
      offset: rowsPerPlayer * idx,
      rowCount: rowsPerPlayer
    }) as PlayerSpan;
  }
  return Object.freeze(spans) as PlayerSpans;
}

function createCoopBoardProfile(id: string, playerCount: number, rowsPerPlayer: number = SOLO_ROW_SPAN): BoardProfile {
  const visualCols = COLS + BOARD_GAP_COLS;
  return Object.freeze({
    id,
    playerCount,
    rowsPerPlayer,
    rows: rowsPerPlayer * playerCount,
    logicalCols: COLS,
    visualCols,
    playerCols: PLAYER_COLS,
    enemyCols: PLAYER_COLS,
    riverGapCols: BOARD_GAP_COLS,
    enemyColStart: RIGHT_COL_START,
    enemyColEnd: RIGHT_COL_END,
    playerRowSpans: createCoopPlayerSpans(playerCount, rowsPerPlayer)
  }) as BoardProfile;
}

export const SOLO_BOARD_PROFILE: BoardProfile = Object.freeze({
  id: "solo",
  playerCount: 1,
  rowsPerPlayer: SOLO_ROW_SPAN,
  rows: SOLO_ROWS,
  logicalCols: COLS,
  visualCols: COLS + BOARD_GAP_COLS,
  playerCols: PLAYER_COLS,
  enemyCols: PLAYER_COLS,
  riverGapCols: BOARD_GAP_COLS,
  enemyColStart: RIGHT_COL_START,
  enemyColEnd: RIGHT_COL_END,
  playerRowSpans: Object.freeze({
    P1: Object.freeze({ offset: 0, rowCount: SOLO_ROW_SPAN }),
    P2: Object.freeze({ offset: 0, rowCount: SOLO_ROW_SPAN }),
    P3: Object.freeze({ offset: 0, rowCount: SOLO_ROW_SPAN }),
    P4: Object.freeze({ offset: 0, rowCount: SOLO_ROW_SPAN })
  })
}) as BoardProfile;

export const COOP_BOARD_PROFILE: BoardProfile = createCoopBoardProfile("coop", 2);
export const COOP4_BOARD_PROFILE: BoardProfile = createCoopBoardProfile("coop4", 4);

const BOARD_PROFILES: Record<string, BoardProfile> = Object.freeze({
  solo: SOLO_BOARD_PROFILE,
  coop: COOP_BOARD_PROFILE,
  coop4: COOP4_BOARD_PROFILE
});

export function normalizeBoardProfile(profile: string | BoardProfile = "solo"): BoardProfile {
  if (typeof profile === "string") {
    return BOARD_PROFILES[profile] ?? SOLO_BOARD_PROFILE;
  }
  if (profile && typeof profile === "object") {
    return profile;
  }
  return SOLO_BOARD_PROFILE;
}

export function getBoardProfile(profile: string | BoardProfile = "solo"): BoardProfile {
  return normalizeBoardProfile(profile);
}

export function getBoardPlayerSlots(profile: string | BoardProfile = "solo"): readonly string[] {
  const resolvedProfile = normalizeBoardProfile(profile);
  const playerCount = Math.max(1, resolvedProfile.playerCount ?? 1);
  return COOP_PLAYER_SLOTS.slice(0, playerCount);
}

export function normalizePlayerSlot(slot: string = "P1"): string {
  return COOP_PLAYER_SLOTS.includes(slot) ? slot : "P1";
}

export function getBattlefieldRowCount(profile: string | BoardProfile = "solo"): number {
  return normalizeBoardProfile(profile).rows ?? SOLO_ROWS;
}

export function getLocalBoardRowCount(profile: string | BoardProfile = "solo", slot: string = "P1"): number {
  const resolvedProfile = normalizeBoardProfile(profile);
  const resolvedSlot = normalizePlayerSlot(slot);
  return resolvedProfile.playerRowSpans?.[resolvedSlot]?.rowCount
    ?? resolvedProfile.rowsPerPlayer
    ?? SOLO_ROW_SPAN;
}

export function getBoardVisualColCount(profile: string | BoardProfile = "solo"): number {
  const resolvedProfile = normalizeBoardProfile(profile);
  return resolvedProfile.visualCols
    ?? ((resolvedProfile.logicalCols ?? COLS) + (resolvedProfile.riverGapCols ?? BOARD_GAP_COLS));
}

export function getPlayerRowOffset(profile: string | BoardProfile = "solo", slot: string = "P1"): number {
  const resolvedProfile = normalizeBoardProfile(profile);
  const resolvedSlot = normalizePlayerSlot(slot);
  return resolvedProfile.playerRowSpans?.[resolvedSlot]?.offset ?? 0;
}

export function getPlayerRowBounds(profile: string | BoardProfile = "solo", slot: string = "P1"): {
  startRow: number;
  endRow: number;
  rowCount: number;
} {
  const resolvedProfile = normalizeBoardProfile(profile);
  const resolvedSlot = normalizePlayerSlot(slot);
  const rowSpan = resolvedProfile.playerRowSpans?.[resolvedSlot] ?? { offset: 0, rowCount: resolvedProfile.rows };
  return {
    startRow: rowSpan.offset,
    endRow: rowSpan.offset + rowSpan.rowCount - 1,
    rowCount: rowSpan.rowCount
  };
}

export function isRowOwnedByPlayer(profile: string | BoardProfile = "solo", row: number, slot: string = "P1"): boolean {
  const bounds = getPlayerRowBounds(profile, slot);
  return Number.isInteger(row) && row >= bounds.startRow && row <= bounds.endRow;
}

export function getPlayerSlotForRow(profile: string | BoardProfile = "solo", row: number, fallbackSlot: string = "P1"): string {
  if (!Number.isInteger(row)) return normalizePlayerSlot(fallbackSlot);
  const resolvedProfile = normalizeBoardProfile(profile);
  const resolvedFallback = normalizePlayerSlot(fallbackSlot);
  const slots = getBoardPlayerSlots(resolvedProfile);
  const matchedSlot = slots.find((slot) => isRowOwnedByPlayer(resolvedProfile, row, slot));
  return matchedSlot ?? (slots.includes(resolvedFallback) ? resolvedFallback : slots[0] ?? "P1");
}
