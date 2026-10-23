/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import {
  ROWS,
  PLAYER_COLS,
  RIGHT_COL_START,
  RIGHT_COL_END
} from "./boardConstants.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface CombatQueueUnitLike {
  id?: string;
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  alive: boolean;
  [key: string]: unknown;
}

export interface TurnQueueCell<T extends CombatQueueUnitLike = CombatQueueUnitLike> {
  row: number;
  col: number;
  side: "LEFT" | "RIGHT";
  unit: T | null;
}

export interface BuildTurnQueueResult<T extends CombatQueueUnitLike = CombatQueueUnitLike> {
  queue: TurnQueueCell<T>[];
  turnIndex: number;
}

export interface BuildTurnQueueOptions<T extends CombatQueueUnitLike = CombatQueueUnitLike> {
  units: T[];
  rowCount?: number;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 * Sources:
 * - src/scenes/CombatScene.ts:4668 (MAX_COMBAT_CYCLES = 20)
 * - src/core/boardConstants.ts:19-24 (ROWS=5, PLAYER_COLS=5, RIGHT_COL_START=5, RIGHT_COL_END=9)
 */

export const MAX_COMBAT_CYCLES = 20;

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * Helper to group side cells into chunks: each chunk = [empty cells...] + [alive unit cell].
 * Trailing empty cells form the final chunk.
 *
 * Rationale:
 * Source: src/scenes/CombatScene.ts:4483-4495
 * Empty grid cells must take turns in combat simulation to preserve timing parity
 * between differently sized armies.
 */
function toChunks<T extends CombatQueueUnitLike>(cells: TurnQueueCell<T>[]): TurnQueueCell<T>[][] {
  const chunks: TurnQueueCell<T>[][] = [];
  let current: TurnQueueCell<T>[] = [];

  for (const cell of cells) {
    current.push(cell);
    if (cell.unit && cell.unit.alive === true) {
      chunks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Build sequential scan order for a side.
 *
 * Scanning rules:
 * - LEFT side: Frontline first (PLAYER_COLS - 1 down to 0, e.g. 4, 3, 2, 1, 0), rows 0 to rowCount-1.
 * - RIGHT side: Frontline first (RIGHT_COL_START up to RIGHT_COL_END, e.g. 5, 6, 7, 8, 9), rows 0 to rowCount-1.
 *
 * Source: src/scenes/CombatScene.ts:4512-4532
 */
export function buildOrderForSide<T extends CombatQueueUnitLike>(
  side: "LEFT" | "RIGHT",
  units: T[],
  rowCount: number = ROWS
): TurnQueueCell<T>[] {
  const list: TurnQueueCell<T>[] = [];

  if (side === "LEFT") {
    for (let col = PLAYER_COLS - 1; col >= 0; col -= 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const unit = units.find(u => u.alive === true && u.side === "LEFT" && u.row === row && u.col === col) ?? null;
        list.push({ row, col, side: "LEFT", unit });
      }
    }
  } else {
    for (let col = RIGHT_COL_START; col <= RIGHT_COL_END; col += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const unit = units.find(u => u.alive === true && u.side === "RIGHT" && u.row === row && u.col === col) ?? null;
        list.push({ row, col, side: "RIGHT", unit });
      }
    }
  }

  return list;
}

/**
 * Constructs the full interleaved combat turn queue.
 *
 * Interleave rule:
 * LEFT chunk 0, RIGHT chunk 0, LEFT chunk 1, RIGHT chunk 1...
 *
 * Source: src/scenes/CombatScene.ts:4477-4510
 */
export function buildTurnQueue<T extends CombatQueueUnitLike>(
  options: BuildTurnQueueOptions<T>
): BuildTurnQueueResult<T> {
  const rowCount = options.rowCount ?? ROWS;
  const leftOrder = buildOrderForSide("LEFT", options.units, rowCount);
  const rightOrder = buildOrderForSide("RIGHT", options.units, rowCount);

  const leftChunks = toChunks(leftOrder);
  const rightChunks = toChunks(rightOrder);

  const queue: TurnQueueCell<T>[] = [];
  const maxLen = Math.max(leftChunks.length, rightChunks.length);

  for (let i = 0; i < maxLen; i += 1) {
    if (i < leftChunks.length) {
      queue.push(...leftChunks[i]);
    }
    if (i < rightChunks.length) {
      queue.push(...rightChunks[i]);
    }
  }

  return {
    queue,
    turnIndex: 0
  };
}

/**
 * Check whether the combat cycle count has reached or exceeded the 20-cycle draw limit.
 *
 * Source: src/scenes/CombatScene.ts:4668
 */
export function isCombatCycleCapReached(turnCycleIndex: number): boolean {
  return typeof turnCycleIndex === "number" && turnCycleIndex >= MAX_COMBAT_CYCLES;
}
