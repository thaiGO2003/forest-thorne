/**
 * EndlessPvEClassicMode.js
 * 
 * Configuration for the default Endless PvE Classic game mode.
 * This represents the current/existing game mode with standard progression.
 * 
 * Players start with 10 gold and 3 HP, face medium difficulty AI opponents,
 * and progress through rounds with standard gold and enemy scaling.
 */

import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'
import { AI_DIFFICULTY_ORDER } from '../core/aiModes.js'
import { MODE_DAMAGE_ONE_PER_LOSS } from '../core/gameModeRuntime.js'

/**
 * Endless PvE Classic Mode Configuration
 * 
 * The standard game mode where players:
 * - Build teams through shop purchases
 * - Deploy units on a 5x5 board
 * - Battle AI opponents of increasing difficulty
 * - Progress through rounds earning gold
 * - Lose when HP reaches 0
 */
const EndlessPvEClassicMode = createGameModeConfig('EndlessPvEClassic', {
    name: 'PvE Vô Tận: Sinh Tồn',
    description: 'Chế độ auto-battler kinh điển. Xây dựng đội hình, triển khai chiến thuật và sống sót càng lâu càng tốt trước các đối thủ AI.',
    nameEn: 'PvE Endless: Survival',
    descriptionEn: 'Classic auto-battler progression. Build your squad, adapt your tactics, and survive as many AI rounds as possible.',

    // Standard scene flow
    scenes: ['LoadingScene', 'MainMenuScene', 'PlanningScene', 'CombatScene'],

    // Starting resources
    startingGold: 10,
    startingHP: 3,

    // Lose when HP reaches 0
    loseCondition: LOSE_CONDITION.NO_HEARTS,

    // Survival mode should only remove one heart per lost round.
    damageRule: MODE_DAMAGE_ONE_PER_LOSS,

    // All core systems enabled
    enabledSystems: {
        shop: true,
        crafting: true,
        augments: true,
        pvp: false
    },

    // Medium difficulty AI
    aiDifficulty: AI_DIFFICULTY.MEDIUM,

    // Standard gold scaling: 10 gold per round
    goldScaling: (_round: number) => 10,

    // Enemy strength scales linearly with round number
    enemyScaling: (round: number) => {
        if (round <= 10) return 1;
        return 1 + (round - 10) * 0.04;
    },

    recommendedAiMode: 'MEDIUM',
    availableAiModes: AI_DIFFICULTY_ORDER
})

// Register the mode in the registry
GameModeRegistry.register(EndlessPvEClassicMode)

export default EndlessPvEClassicMode
