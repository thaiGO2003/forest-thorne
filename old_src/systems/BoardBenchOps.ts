/**
 * BoardBenchOps — Complex board+bench operations
 *
 * Extracted from BoardSystem.js to keep the main file manageable.
 */

import {
  isValidPlayerBoardPosition,
  isValidBenchIndex,
  getDeployCount,
  checkDuplicateUnit
} from './BoardSystem.js';
import type { Board, Bench, BoardUnit, BoardOperationResult } from './BoardSystem.js';
import type { UnitReference } from './UpgradeMergeRuntime.js';

export function placeBenchUnitOnBoard(
  board: Board,
  bench: Bench,
  benchIndex: number,
  row: number,
  col: number,
  deployLimit: number,
  allowSwap = true
): BoardOperationResult {
  if (benchIndex >= bench.length) return { success: false, error: 'Invalid bench index' };
  if (!isValidPlayerBoardPosition(row, col)) return { success: false, error: 'Invalid board position' };
  const moving = bench[benchIndex];
  if (!moving) return { success: false, error: 'No unit at bench index' };
  if (checkDuplicateUnit(board, moving.baseId, row, col)) return { success: false, error: 'Duplicate unit on board' };
  const target = board[row][col];
  if (!target && getDeployCount(board) >= deployLimit) return { success: false, error: 'Deploy limit reached' };
  if (target && !allowSwap) return { success: false, error: 'Position occupied and swap not allowed' };
  board[row][col] = moving;
  if (target) bench[benchIndex] = target;
  else bench.splice(benchIndex, 1);
  return { success: true, swapped: !!target };
}

export function moveBoardUnitToBench(
  board: Board,
  bench: Bench,
  row: number,
  col: number,
  benchIndex: number,
  benchCap: number,
  allowSwap = true
): BoardOperationResult {
  if (!isValidPlayerBoardPosition(row, col)) return { success: false, error: 'Invalid board position' };
  if (!isValidBenchIndex(benchIndex, benchCap)) return { success: false, error: 'Invalid bench index' };
  const moving = board[row][col];
  if (!moving) return { success: false, error: 'No unit at board position' };
  const target = bench[benchIndex] ?? null;
  if (target && !allowSwap) return { success: false, error: 'Bench position occupied and swap not allowed' };
  if (!target && bench.length >= benchCap) return { success: false, error: 'Bench is full' };
  if (target) {
    board[row][col] = target;
    bench[benchIndex] = moving;
  } else {
    board[row][col] = null;
    if (benchIndex >= bench.length) bench.push(moving);
    else if (bench[benchIndex] == null) bench[benchIndex] = moving;
    else bench.splice(benchIndex, 0, moving);
  }
  return { success: true, swapped: !!target };
}

export function moveBenchUnit(
  bench: Bench,
  fromIndex: number,
  toIndex: number,
  allowSwap = true
): BoardOperationResult {
  if (fromIndex >= bench.length) return { success: false, error: 'Invalid source bench index' };
  if (fromIndex === toIndex) return { success: false, error: 'Source and destination are the same' };
  const moving = bench[fromIndex];
  if (!moving) return { success: false, error: 'No unit at source bench index' };
  const target = bench[toIndex] ?? null;
  if (target) {
    if (!allowSwap) return { success: false, error: 'Destination occupied and swap not allowed' };
    bench[toIndex] = moving;
    bench[fromIndex] = target;
  } else {
    bench.splice(fromIndex, 1);
    const insertIndex = Math.max(0, Math.min(toIndex, bench.length));
    bench.splice(insertIndex, 0, moving);
  }
  return { success: true, swapped: !!target };
}

export function removeOwnedUnitRefs(
  board: Board,
  bench: Bench,
  refs: UnitReference[]
): BoardOperationResult & { removedCount?: number } {
  if (!Array.isArray(refs) || !refs.length) return { success: false, error: 'No references provided' };
  const benchUidSet = new Set<string>();
  const benchIndexFallback: number[] = [];
  let removedCount = 0;
  refs.forEach((ref) => {
    if (ref.location === "BOARD") {
      if (typeof ref.row === "number" && typeof ref.col === "number" && isValidPlayerBoardPosition(ref.row, ref.col)) {
        board[ref.row][ref.col] = null;
        removedCount++;
      }
      return;
    }
    const uid = ref.unit.uid;
    if (uid) benchUidSet.add(uid);
    else if (typeof ref.index === "number" && Number.isInteger(ref.index)) benchIndexFallback.push(ref.index);
  });
  if (benchUidSet.size) {
    const beforeLength = bench.length;
    bench.splice(0, bench.length, ...bench.filter((unit) => !unit || !unit.uid || !benchUidSet.has(unit.uid)));
    removedCount += beforeLength - bench.length;
  }
  benchIndexFallback.sort((a, b) => b - a).forEach((index) => {
    if (index >= 0 && index < bench.length) {
      bench.splice(index, 1);
      removedCount++;
    }
  });
  return { success: true, removedCount };
}
