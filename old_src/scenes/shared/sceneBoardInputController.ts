/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import type Phaser from "phaser";
import {
  isSharedPanPointer as isThreeSharedPanPointer,
  installSharedBoardViewInput as installThreeSharedBoardViewInput
} from "../../three/ThreeBoardInputController.js";
import type {
  PointerLike as ThreePointerLike,
  SharedBoardInputOptions as ThreeSharedBoardInputOptions,
  SharedBoardInputInstaller as ThreeSharedBoardInputInstaller
} from "../../three/ThreeBoardInputController.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export type PointerLike = ThreePointerLike;
export type SharedBoardInputOptions = ThreeSharedBoardInputOptions;
export type SharedBoardInputInstaller = (scene: Phaser.Scene, options?: SharedBoardInputOptions) => void;

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

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

export function isSharedPanPointer(pointer: PointerLike | null | undefined): boolean {
  return isThreeSharedPanPointer(pointer);
}

export function installSharedBoardViewInput(
  scene: Phaser.Scene,
  options: SharedBoardInputOptions = {}
): void {
  installThreeSharedBoardViewInput(scene, options);
}
