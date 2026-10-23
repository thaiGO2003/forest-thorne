import { isValidAiMode } from "../core/aiModes.js"

/**
 * GameModeConfig.js
 * 
 * Defines the configuration interface for game modes and provides
 * factory and validation functions for creating and validating game mode configs.
 * 
 * A GameModeConfig defines all the rules, systems, and behavior for a specific
 * game mode (e.g., Endless PvE Classic, Endless Mode, PVP Mode).
 * 
 * ## Creating a New Game Mode
 * 
 * To create a new game mode:
 * 
 * 1. Create a new file in `src/gameModes/` (e.g., `MyMode.js`)
 * 2. Import the required functions and enums
 * 3. Use `createGameModeConfig()` to define your mode
 * 4. Register your mode with `GameModeRegistry.register()`
 * 5. Export your mode
 * 
 * ## Example
 * 
 * ```javascript
 * import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
 * import GameModeRegistry from './GameModeRegistry.js'
 * 
 * const MyMode = createGameModeConfig('MY_MODE', {
 *   name: 'My Custom Mode',
 *   description: 'A unique gameplay experience',
 *   startingGold: 15,
 *   startingHP: 5,
 *   aiDifficulty: AI_DIFFICULTY.HARD,
 *   goldScaling: (round) => 10 + Math.floor(round * 1.5),
 *   enemyScaling: (round) => Math.floor(round * 2)
 * })
 * 
 * GameModeRegistry.register(MyMode)
 * export default MyMode
 * ```
 * 
 * See README.md in this directory for a complete guide.
 */

/**
 * Lose condition types
 * @enum {string}
 */
export const LOSE_CONDITION = {
  NO_HEARTS: 'NO_HEARTS',      // Lose when HP reaches 0
  SINGLE_LOSS: 'SINGLE_LOSS',  // Lose on first combat defeat
  TIME_LIMIT: 'TIME_LIMIT'     // Lose when time runs out
}

/**
 * AI difficulty levels
 * @enum {string}
 */
export const AI_DIFFICULTY = {
  TUTORIAL: 'TUTORIAL',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  CREATIVE: 'CREATIVE'
}

/**
 * GameModeConfig interface
 * 
 * @typedef {Object} GameModeConfig
 * @property {string} id - Unique identifier for the game mode (e.g., "EndlessPvEClassic")
 * @property {string} name - Display name for the game mode
 * @property {string} description - Description of the game mode
 * @property {string[]} scenes - Array of scene names to use in this mode
 * @property {number} startingGold - Initial gold amount
 * @property {number} startingHP - Initial HP/hearts
 * @property {string} loseCondition - Lose condition type (from LOSE_CONDITION enum)
 * @property {EnabledSystems} enabledSystems - Which systems are enabled in this mode
 * @property {string} aiDifficulty - AI difficulty level (from AI_DIFFICULTY enum)
 * @property {string[]} [availableAiModes] - Optional AI mode allowlist
 * @property {function(number): number} goldScaling - Function that returns gold per round
 * @property {function(number): number} enemyScaling - Function that returns enemy strength multiplier
 */

/**
 * Enabled systems configuration
 * 
 * @typedef {Object} EnabledSystems
 * @property {boolean} shop - Whether shop system is enabled
 * @property {boolean} crafting - Whether crafting system is enabled
 * @property {boolean} augments - Whether augments system is enabled
 * @property {boolean} pvp - Whether PVP system is enabled
 */

/**
 * Creates a GameModeConfig with defaults filled in
 * 
 * This is the main function you'll use to create a new game mode.
 * It takes a unique ID and a configuration object, merges it with sensible
 * defaults, and returns a complete GameModeConfig.
 * 
 * @param {string} id - Unique identifier for the game mode (use UPPER_SNAKE_CASE, e.g., "MY_MODE")
 * @param {Partial<GameModeConfig>} config - Partial config with overrides
 * @returns {GameModeConfig} Complete game mode configuration
 * 
 * ## Configuration Options
 * 
 * All options are optional except `name` (though providing a description is recommended):
 * 
 * - **name** (string): Display name shown to players
 * - **description** (string): Description of the game mode
 * - **scenes** (string[]): Scene names to use (default: standard flow)
 * - **startingGold** (number): Initial gold (default: 10, must be >= 0)
 * - **startingHP** (number): Initial HP (default: 3, must be > 0)
 * - **loseCondition** (string): When player loses (default: NO_HEARTS)
 * - **enabledSystems** (object): Which systems are enabled (default: all except PVP)
 * - **aiDifficulty** (string): AI difficulty (default: MEDIUM)
 * - **goldScaling** (function): Gold per round (default: always 10)
 * - **enemyScaling** (function): Enemy strength multiplier (default: equals round number)
 * 
 * ## Scaling Functions
 * 
 * Both `goldScaling` and `enemyScaling` are functions that take the round number
 * and return a number:
 * 
 * - **goldScaling(round)**: Returns how much gold the player gets this round
 * - **enemyScaling(round)**: Returns a multiplier for enemy strength
 * 
 * @example
 * // Simple mode with defaults
 * const simpleMode = createGameModeConfig("SIMPLE", {
 *   name: "Simple Mode",
 *   description: "A straightforward game mode"
 * })
 * 
 * @example
 * // Advanced mode with custom scaling
 * const endlessMode = createGameModeConfig("ENDLESS", {
 *   name: "Endless Mode",
 *   description: "Survive as long as possible",
 *   startingGold: 15,
 *   startingHP: 5,
 *   aiDifficulty: AI_DIFFICULTY.HARD,
 *   goldScaling: (round) => 10 + Math.floor(round * 1.5),
 *   enemyScaling: (round) => Math.floor(round * 2.5)
 * })
 * 
 * @example
 * // Mode with systems disabled
 * const minimalMode = createGameModeConfig("MINIMAL", {
 *   name: "Minimal Mode",
 *   description: "Shop only, no crafting",
 *   enabledSystems: {
 *     shop: true,
 *     crafting: false,
 *     augments: false,
 *     pvp: false
 *   }
 * })
 */
/**
 * Enabled systems configuration
 */
export interface EnabledSystems {
  shop: boolean;
  crafting: boolean;
  augments: boolean;
  pvp: boolean;
}

/**
 * Game mode configuration
 */
export interface GameModeConfig {
  id: string;
  name: string;
  description: string;
  nameEn?: string;
  descriptionEn?: string;
  scenes: string[];
  startingGold: number;
  startingHP: number;
  loseCondition: string;
  enabledSystems: EnabledSystems;
  aiDifficulty: string;
  availableAiModes?: readonly string[];
  recommendedAiMode?: string;
  route?: string;
  playerCapacity?: number;
  fortressMode?: boolean;
  renderStrongholds?: boolean;
  bossRounds?: boolean;
  damageRule?: string;
  sessionType?: string;
  goldScaling: (round: number) => number;
  enemyScaling: (round: number) => number;
}

/**
 * Partial configuration used to create a game mode
 */
export type PartialGameModeConfig = Partial<GameModeConfig> & { name: string };

/**
 * Result of validating a game mode config
 */
export interface GameModeValidationResult {
  valid: boolean;
  errors: string[];
}

export function createGameModeConfig(id: string, config: PartialGameModeConfig = { name: '' }): GameModeConfig {
  // Default configuration
  const defaults: GameModeConfig = {
    id,
    name: config.name || id,
    description: config.description || '',
    scenes: ['LoadingScene', 'MainMenuScene', 'PlanningScene', 'CombatScene'],
    startingGold: 10,
    startingHP: 3,
    loseCondition: LOSE_CONDITION.NO_HEARTS,
    enabledSystems: {
      shop: true,
      crafting: true,
      augments: true,
      pvp: false
    },
    aiDifficulty: AI_DIFFICULTY.MEDIUM,
    goldScaling: (_round: number) => 10,
    enemyScaling: (round: number) => round
  }

  // Merge with provided config
  const gameMode: GameModeConfig = {
    ...defaults,
    ...config,
    id, // Ensure id is not overridden
    enabledSystems: {
      ...defaults.enabledSystems,
      ...(config.enabledSystems || {})
    }
  }

  return gameMode
}

/**
 * Validates a GameModeConfig
 * 
 * This function checks that a game mode configuration is valid and complete.
 * It verifies all required fields are present, all values are the correct type,
 * and all values are within acceptable ranges.
 * 
 * You typically don't need to call this manually - the GameModeRegistry
 * automatically validates configs when you register them. However, it can
 * be useful for debugging or testing.
 * 
 * @param {GameModeConfig} config - The config to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 * 
 * ## Validation Rules
 * 
 * The function checks:
 * - **id**: Must be a non-empty string
 * - **name**: Must be a non-empty string
 * - **description**: Must be a string (can be empty)
 * - **scenes**: Must be a non-empty array of strings
 * - **startingGold**: Must be a number >= 0
 * - **startingHP**: Must be a number > 0
 * - **loseCondition**: Must be a valid LOSE_CONDITION value
 * - **enabledSystems**: Must be an object with boolean values for shop, crafting, augments, pvp
 * - **aiDifficulty**: Must be a valid AI_DIFFICULTY value
 * - **goldScaling**: Must be a function that returns a non-negative number
 * - **enemyScaling**: Must be a function that returns a non-negative number
 * 
 * @example
 * const result = validateGameModeConfig(myConfig)
 * if (!result.valid) {
 *   console.error("Invalid config:", result.errors)
 *   // ["startingGold must be >= 0", "aiDifficulty must be one of: EASY, MEDIUM, HARD"]
 * }
 * 
 * @example
 * // Validate before registering
 * const myMode = createGameModeConfig("MY_MODE", { ... })
 * const validation = validateGameModeConfig(myMode)
 * if (validation.valid) {
 *   GameModeRegistry.register(myMode)
 * } else {
 *   console.error("Cannot register invalid mode:", validation.errors)
 * }
 */
export function validateGameModeConfig(config: GameModeConfig): GameModeValidationResult {
  const errors: string[] = []

  // Validate required fields
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    errors.push('id is required and must be a non-empty string')
  }

  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    errors.push('name is required and must be a non-empty string')
  }

  if (typeof config.description !== 'string') {
    errors.push('description must be a string')
  }

  // Validate scenes array
  if (!Array.isArray(config.scenes)) {
    errors.push('scenes must be an array')
  } else if (config.scenes.length === 0) {
    errors.push('scenes array must not be empty')
  } else {
    for (let i = 0; i < config.scenes.length; i++) {
      if (typeof config.scenes[i] !== 'string') {
        errors.push(`scenes[${i}] must be a string`)
      }
    }
  }

  // Validate numeric values
  if (typeof config.startingGold !== 'number') {
    errors.push('startingGold must be a number')
  } else if (config.startingGold < 0) {
    errors.push('startingGold must be >= 0')
  }

  if (typeof config.startingHP !== 'number') {
    errors.push('startingHP must be a number')
  } else if (config.startingHP <= 0) {
    errors.push('startingHP must be > 0')
  }

  // Validate loseCondition
  const validLoseConditions = Object.values(LOSE_CONDITION)
  if (!validLoseConditions.includes(config.loseCondition)) {
    errors.push(`loseCondition must be one of: ${validLoseConditions.join(', ')}`)
  }

  // Validate enabledSystems
  if (!config.enabledSystems || typeof config.enabledSystems !== 'object') {
    errors.push('enabledSystems must be an object')
  } else {
    const requiredSystemKeys = ['shop', 'crafting', 'augments', 'pvp']
    for (const key of requiredSystemKeys) {
      if (typeof config.enabledSystems[key as keyof EnabledSystems] !== 'boolean') {
        errors.push(`enabledSystems.${key} must be a boolean`)
      }
    }
  }

  // Validate aiDifficulty
  const validDifficulties = Object.values(AI_DIFFICULTY)
  if (!validDifficulties.includes(config.aiDifficulty)) {
    errors.push(`aiDifficulty must be one of: ${validDifficulties.join(', ')}`)
  }

  if (config.availableAiModes != null) {
    if (!Array.isArray(config.availableAiModes) || config.availableAiModes.length === 0) {
      errors.push('availableAiModes must be a non-empty array when provided')
    } else {
      for (let i = 0; i < config.availableAiModes.length; i++) {
        if (!isValidAiMode(config.availableAiModes[i])) {
          errors.push(`availableAiModes[${i}] must be a valid AI mode`)
        }
      }
    }
  }

  // Validate scaling functions
  if (typeof config.goldScaling !== 'function') {
    errors.push('goldScaling must be a function')
  } else {
    // Test that it returns a positive number
    try {
      const result = config.goldScaling(1)
      if (typeof result !== 'number' || result < 0) {
        errors.push('goldScaling must return a non-negative number')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`goldScaling function threw an error: ${message}`)
    }
  }

  if (typeof config.enemyScaling !== 'function') {
    errors.push('enemyScaling must be a function')
  } else {
    // Test that it returns a positive number
    try {
      const result = config.enemyScaling(1)
      if (typeof result !== 'number' || result < 0) {
        errors.push('enemyScaling must return a non-negative number')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`enemyScaling function threw an error: ${message}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
