/**
 * GameModeRegistry.ts
 *
 * In-memory registry of game mode configurations.
 * Modes are stored by id and can be retrieved individually or in bulk.
 */

import { validateGameModeConfig, type GameModeConfig } from './GameModeConfig.js'

/**
 * Internal storage for registered game modes
 */
const gameModes = new Map<string, GameModeConfig>()

/**
 * Result of registering a game mode
 */
export interface GameModeRegistrationResult {
  success: boolean;
  error?: string;
}

/**
 * Registers a game mode configuration
 *
 * @param gameMode - The game mode configuration to register
 * @returns Result of registration
 */
export function register(gameMode: GameModeConfig): GameModeRegistrationResult {
  // Validate the config before registration
  const validation = validateGameModeConfig(gameMode)

  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid game mode config: ${validation.errors.join(', ')}`
    }
  }

  // Check if a mode with this id already exists
  if (gameModes.has(gameMode.id)) {
    return {
      success: false,
      error: `Game mode with id "${gameMode.id}" is already registered`
    }
  }

  // Register the game mode
  gameModes.set(gameMode.id, gameMode)

  return {
    success: true
  }
}

/**
 * Retrieves a game mode configuration by id
 *
 * @param gameModeId - The unique identifier of the game mode
 * @returns The game mode config, or null if not found
 */
export function get(gameModeId: string): GameModeConfig | null {
  return gameModes.get(gameModeId) || null
}

/**
 * Retrieves all registered game mode configurations
 *
 * @returns Array of all registered game modes
 */
export function getAll(): GameModeConfig[] {
  return Array.from(gameModes.values())
}

/**
 * Clears all registered game modes (useful for testing)
 */
export function clear(): void {
  gameModes.clear()
}

/**
 * Checks if a game mode with the given id is registered
 *
 * @param gameModeId - The unique identifier to check
 * @returns True if the game mode is registered
 */
export function has(gameModeId: string): boolean {
  return gameModes.has(gameModeId)
}

// Export as default object for convenience
export default {
  register,
  get,
  getAll,
  clear,
  has
}
