/**
 * UpgradeMergeRuntime — Unit reference management and merge placement
 *
 * Extracted from UpgradeSystem.js to keep the main file manageable.
 */

import type { Board, Bench, BoardUnit, BoardOperationResult } from './BoardSystem.js';

export interface UnitReference {
  unit: BoardUnit;
  location: 'BOARD' | 'BENCH';
  row?: number;
  col?: number;
  index?: number;
}

export interface PlacementResult {
  success: boolean;
  error?: string;
  location?: 'BOARD' | 'BENCH';
  row?: number;
  col?: number;
  index?: number;
}

export function collectOwnedUnitRefs(board: Board, bench: Bench): UnitReference[] {
  const refs: UnitReference[] = [];
  bench.forEach((unit, index) => {
    if (unit) refs.push({ unit, location: 'BENCH', index });
  });
  board.forEach((row, rowIndex) => {
    row.forEach((unit, colIndex) => {
      if (unit) refs.push({ unit, location: 'BOARD', row: rowIndex, col: colIndex });
    });
  });
  return refs;
}

export function removeUnitRefs(
  board: Board,
  bench: Bench,
  refs: UnitReference[]
): BoardOperationResult & { removedCount?: number } {
  if (!Array.isArray(refs) || refs.length === 0) return { success: false, error: 'No references provided' };
  let removedCount = 0;
  refs.forEach((ref) => {
    if (ref.location === 'BOARD') {
      if (ref.row !== undefined && ref.col !== undefined && board[ref.row]?.[ref.col]) {
        board[ref.row][ref.col] = null;
        removedCount++;
      }
    } else if (ref.index !== undefined && bench[ref.index]) {
      bench[ref.index] = null;
      removedCount++;
    }
  });
  const filtered = bench.filter((unit) => unit !== null);
  bench.splice(0, bench.length, ...filtered);
  return { success: true, removedCount };
}

export function placeMergedUnit(
  board: Board,
  bench: Bench,
  unit: BoardUnit,
  sourceRefs: UnitReference[]
): PlacementResult {
  if (!unit) return { success: false, error: 'No unit provided' };
  const boardRef = sourceRefs.find((ref) => ref.location === 'BOARD');
  if (boardRef && boardRef.row !== undefined && boardRef.col !== undefined && board[boardRef.row]) {
    board[boardRef.row][boardRef.col] = unit;
    return { success: true, location: 'BOARD', row: boardRef.row, col: boardRef.col };
  }
  const emptyIndex = bench.findIndex((entry) => entry === null);
  if (emptyIndex !== -1) {
    bench[emptyIndex] = unit;
    return { success: true, location: 'BENCH', index: emptyIndex };
  }
  bench.push(unit);
  return { success: true, location: 'BENCH', index: bench.length - 1 };
}
