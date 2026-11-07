/**
 * BoardSystem - Board Management System
 *
 * Manages board state and unit placement operations.
 * This system is independent of Phaser and uses pure functions where possible.
 */

import { calculateSynergies } from "./SynergyCalculator.js";

export interface UnitBaseData {
  id?: string;
  name?: string;
  species?: string;
  classType?: string;
  element?: string;
  tribe?: string;
  faction?: string;
  tier?: number;
  [key: string]: unknown;
}

export interface UnitMods {
  [key: string]: number | string | boolean | null | undefined;
  healPct?: number;
  lifestealPct?: number;
  evadePct?: number;
  shieldStart?: number;
  startingRage?: number;
  critPct?: number;
  burnOnHit?: number;
  poisonOnHit?: number;
}

export interface BoardUnit {
  uid?: string;
  baseId: string;
  star: number;
  row?: number;
  col?: number;
  classType?: string;
  element?: string;
  tribe?: string;
  faction?: string;
  base?: UnitBaseData;
  equips?: string[];
  variantTraits?: string[];
  variantSeeds?: number[];
  mods?: UnitMods;
  [key: string]: unknown;
}

export type Board = Array<Array<BoardUnit | null>>;
export type Bench = Array<BoardUnit | null>;

export interface BoardOperationResult {
  success: boolean;
  error?: string;
  swapped?: boolean;
  unit?: BoardUnit;
}

export interface BenchOperationResult extends BoardOperationResult {
  removedCount?: number;
}

export interface SynergySummary {
  classCounts: Record<string, number>;
  elementCounts: Record<string, number>;
  factionCounts: Record<string, number>;
  tribeCounts: Record<string, number>;
  activeSynergies: Array<Record<string, unknown>>;
}

const BOARD_ROWS = 5;
const BOARD_COLS = 5;
const PLAYER_COLS = 5;

export function isValidPosition(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < BOARD_ROWS &&
    col >= 0 &&
    col < BOARD_COLS
  );
}

export function isPositionEmpty(board: Board, row: number, col: number): boolean {
  if (!isValidPosition(row, col)) return false;
  return board[row][col] === null;
}

export function getUnitAt(board: Board, row: number, col: number): BoardUnit | null {
  if (!isValidPosition(row, col)) return null;
  return board[row][col];
}

export function getDeployCount(board: Board): number {
  let count = 0;
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] !== null) count++;
    }
  }
  return count;
}

export function getDeployedUnits(board: Board): BoardUnit[] {
  const units: BoardUnit[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = board[row][col];
      if (unit !== null) units.push(unit);
    }
  }
  return units;
}

export function canDeploy(board: Board, deployLimit: number): boolean {
  return getDeployCount(board) < deployLimit;
}

export function placeUnit(
  board: Board,
  unit: BoardUnit,
  row: number,
  col: number,
  deployLimit: number
): BoardOperationResult {
  if (!isValidPosition(row, col)) return { success: false, error: 'Invalid position' };
  if (!isPositionEmpty(board, row, col)) return { success: false, error: 'Position occupied' };
  if (!canDeploy(board, deployLimit)) return { success: false, error: 'Deploy limit reached' };
  board[row][col] = { ...unit, row, col };
  return { success: true };
}

export function removeUnit(board: Board, row: number, col: number): BoardOperationResult {
  if (!isValidPosition(row, col)) return { success: false, error: 'Invalid position' };
  const unit = board[row][col];
  if (!unit) return { success: false, error: 'No unit at position' };
  board[row][col] = null;
  return { success: true, unit };
}

export function moveUnit(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  allowSwap = true
): BoardOperationResult {
  if (!isValidPosition(fromRow, fromCol)) return { success: false, error: 'Invalid source position' };
  if (!isValidPosition(toRow, toCol)) return { success: false, error: 'Invalid destination position' };
  const sourceUnit = board[fromRow][fromCol];
  if (!sourceUnit) return { success: false, error: 'No unit at source position' };
  const destUnit = board[toRow][toCol];
  if (destUnit && !allowSwap) {
    return { success: false, error: 'Destination occupied and swap not allowed' };
  }
  board[toRow][toCol] = { ...sourceUnit, row: toRow, col: toCol };
  board[fromRow][fromCol] = destUnit ? { ...destUnit, row: fromRow, col: fromCol } : null;
  return { success: true, swapped: destUnit !== null };
}

export { calculateSynergies };

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: PLAYER_COLS }, () => null)
  );
}

export function checkDuplicateUnit(
  board: Board,
  baseId: string,
  ignoreRow = -1,
  ignoreCol = -1
): boolean {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < PLAYER_COLS; col++) {
      if (row === ignoreRow && col === ignoreCol) continue;
      const unit = board[row][col];
      if (unit && unit.baseId === baseId) return true;
    }
  }
  return false;
}

export function isValidPlayerBoardPosition(row: number, col: number): boolean {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < BOARD_ROWS && col >= 0 && col < PLAYER_COLS;
}

export function isValidBenchIndex(index: number, benchCap: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < benchCap;
}

import {
  placeBenchUnitOnBoard,
  moveBoardUnitToBench,
  moveBenchUnit,
  removeOwnedUnitRefs
} from './BoardBenchOps.js';

export { placeBenchUnitOnBoard, moveBoardUnitToBench, moveBenchUnit, removeOwnedUnitRefs };

export const BoardSystem = {
  isValidPosition,
  isValidPlayerBoardPosition,
  isValidBenchIndex,
  isPositionEmpty,
  getUnitAt,
  getDeployCount,
  getDeployedUnits,
  canDeploy,
  createEmptyBoard,
  checkDuplicateUnit,
  placeUnit,
  removeUnit,
  moveUnit,
  placeBenchUnitOnBoard,
  moveBoardUnitToBench,
  moveBenchUnit,
  removeOwnedUnitRefs,
  calculateSynergies
};

export default BoardSystem;
