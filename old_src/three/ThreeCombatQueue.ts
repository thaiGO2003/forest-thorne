/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import {
  buildTurnQueue,
  buildOrderForSide,
  isCombatCycleCapReached,
  MAX_COMBAT_CYCLES
} from "../core/combatQueue.js";
import type {
  CombatQueueUnitLike,
  TurnQueueCell,
  BuildTurnQueueResult,
  BuildTurnQueueOptions
} from "../core/combatQueue.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */
export type {
  CombatQueueUnitLike,
  TurnQueueCell,
  BuildTurnQueueResult,
  BuildTurnQueueOptions
};

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */
export { MAX_COMBAT_CYCLES };

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */
export {
  buildTurnQueue,
  buildOrderForSide,
  isCombatCycleCapReached
};
