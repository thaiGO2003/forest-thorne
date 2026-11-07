import { createEmptyBoard } from "./runState.js";
import { getCoopBoardProfileId, getCoopPlayerSlots } from "./aiModes.js";
import {
  getBoardPlayerSlots,
  getBoardProfile,
  getPlayerRowBounds,
  getPlayerRowOffset,
  normalizePlayerSlot
} from "./boardProfiles.js";

export type CoopBoardUnit = object;
export type CoopBoardCell = CoopBoardUnit | null;
export type CoopBoard = CoopBoardCell[][];

export interface CoopPlayerBoardState {
  board?: unknown;
}

export type CoopPlayers = Record<string, CoopPlayerBoardState | null | undefined>;

export interface CoopBoardOptions {
  aiMode?: string;
  boardProfile?: unknown;
}

export interface CoopBoardUnitEntry {
  unit: CoopBoardUnit;
  slot: string;
  localRow: number;
  visualRow: number;
  col: number;
}

function isCoopBoardUnit(value: unknown): value is CoopBoardUnit {
  return value !== null && typeof value === "object";
}

function resolveCoopBoardProfileId(boardProfile: unknown = "coop"): string {
  if (typeof boardProfile === "string") return boardProfile;
  if (boardProfile && typeof boardProfile === "object" && "id" in boardProfile && typeof boardProfile.id === "string") {
    return boardProfile.id;
  }
  return "coop";
}

function inferPlayersBoardProfileId(players: CoopPlayers | null = {}, options: CoopBoardOptions | null = {}): string {
  const explicitProfile = options?.boardProfile
    ?? (typeof options?.aiMode === "string" ? getCoopBoardProfileId(options.aiMode) : null);
  if (explicitProfile) return resolveCoopBoardProfileId(explicitProfile);
  const playerSlots = Object.keys(players ?? {});
  return playerSlots.some((slot) => slot === "P3" || slot === "P4") ? "coop4" : "coop";
}

function resolveCoopSlots(boardProfile: string = "coop", aiMode: string = "COOP_MEDIUM"): readonly string[] {
  const profile = getBoardProfile(boardProfile);
  const profileSlots = getBoardPlayerSlots(profile);
  if (profileSlots.length > 0) return profileSlots;
  return getCoopPlayerSlots(aiMode);
}

export function getCoopRemoteSlots(localSlot: string = "P1", options: CoopBoardOptions | null = {}): readonly string[] {
  const boardProfileId = resolveCoopBoardProfileId(options?.boardProfile ?? getCoopBoardProfileId(options?.aiMode));
  const local = normalizePlayerSlot(localSlot);
  const slots = resolveCoopSlots(boardProfileId, options?.aiMode);
  return slots.filter((slot) => slot !== local);
}

export function getCoopRemoteSlot(localSlot: string = "P1", options: CoopBoardOptions | null = {}): string {
  return getCoopRemoteSlots(localSlot, options)[0] ?? normalizePlayerSlot(localSlot);
}

export function mapLocalRowToVisualRow(localRow: number, slot: string = "P1", boardProfile: unknown = "coop"): number {
  const boardProfileId = resolveCoopBoardProfileId(boardProfile);
  return getPlayerRowOffset(boardProfileId, slot) + localRow;
}

export function mapVisualRowToLocalRow(visualRow: number, slot: string = "P1", boardProfile: unknown = "coop"): number | null {
  const boardProfileId = resolveCoopBoardProfileId(boardProfile);
  const bounds = getPlayerRowBounds(boardProfileId, slot);
  if (visualRow < bounds.startRow || visualRow > bounds.endRow) return null;
  return visualRow - bounds.startRow;
}

export function composeCoopAllyBoard(players: CoopPlayers | null = {}, options: CoopBoardOptions | null = {}): CoopBoard {
  const boardProfileId = inferPlayersBoardProfileId(players, options);
  const profile = getBoardProfile(boardProfileId);
  const board: CoopBoard = createEmptyBoard(profile.rows, profile.playerCols);
  resolveCoopSlots(boardProfileId, options?.aiMode).forEach((slot) => {
    const player = players?.[slot];
    if (!Array.isArray(player?.board)) return;
    const offset = getPlayerRowOffset(boardProfileId, slot);
    const bounds = getPlayerRowBounds(boardProfileId, slot);
    for (let row = 0; row < bounds.rowCount; row += 1) {
      for (let col = 0; col < profile.playerCols; col += 1) {
        const unit = player.board[row]?.[col];
        board[offset + row][col] = isCoopBoardUnit(unit) ? unit : null;
      }
    }
  });
  return board;
}

export function listCoopAllyBoardUnits(players: CoopPlayers | null = {}, options: CoopBoardOptions | null = {}): CoopBoardUnitEntry[] {
  const boardProfileId = inferPlayersBoardProfileId(players, options);
  const profile = getBoardProfile(boardProfileId);
  const units: CoopBoardUnitEntry[] = [];
  resolveCoopSlots(boardProfileId, options?.aiMode).forEach((slot) => {
    const player = players?.[slot];
    if (!Array.isArray(player?.board)) return;
    const offset = getPlayerRowOffset(boardProfileId, slot);
    const bounds = getPlayerRowBounds(boardProfileId, slot);
    for (let row = 0; row < bounds.rowCount; row += 1) {
      for (let col = 0; col < profile.playerCols; col += 1) {
        const unit = player.board[row]?.[col];
        if (!isCoopBoardUnit(unit)) continue;
        units.push({
          unit,
          slot,
          localRow: row,
          visualRow: offset + row,
          col
        });
      }
    }
  });
  return units;
}
