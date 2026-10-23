/**
 * AISystem - AI Opponent Management System
 * 
 * Manages AI opponent logic including enemy team generation, difficulty scaling,
 * and tactical decision making for combat.
 * This system is independent of Phaser and uses pure functions where possible.
 * 
 * **Validates: Requirements 1.1, 1.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 13.4**
 */

import { generateEnemyTeam, computeEnemyTeamSize } from './AITeamGeneration.js';

type DifficultyKey =
  | 'EASY'
  | 'COOP_EASY'
  | 'COOP4_EASY'
  | 'MEDIUM'
  | 'COOP_MEDIUM'
  | 'COOP4_MEDIUM'
  | 'HARD'
  | 'COOP_HARD'
  | 'COOP4_HARD'
  | 'CREATIVE'
  | 'TUTORIAL';

export interface DifficultySettings {
  label: string;
  hpMult: number;
  atkMult: number;
  matkMult: number;
  rageGain: number;
  randomTargetChance: number;
  teamSizeBonus: number;
  teamGrowthEvery: number;
  teamGrowthCap: number;
  budgetMult: number;
  levelBonus: number;
  maxTierBonus: number;
  maxStar: number;
  minStar2Round?: number;
  minStar3Round?: number;
  star2Bonus: number;
  star3Bonus: number;
  equipStartRound: number;
  equipBaseChance: number;
  equipGrowth: number;
  equipMaxChance: number;
  equipMaxTier: number;
}

export interface UnitStatuses {
  stun?: number;
  silence?: number;
  disarmTurns?: number;
  tauntTargetId?: string | null;
  [key: string]: unknown;
}

export type CombatSide = 'LEFT' | 'RIGHT';

export interface CombatUnit {
  uid?: string;
  side?: CombatSide;
  alive?: boolean;
  row?: number;
  col?: number;
  range?: number;
  classType?: string;
  hp?: number;
  maxHp?: number;
  rage?: number;
  rageMax?: number;
  skillId?: string | null;
  statuses?: UnitStatuses;
  [key: string]: unknown;
}

export interface CombatState {
  units?: CombatUnit[];
  [key: string]: unknown;
}

export interface AIDecision {
  action: 'SKIP' | 'SKILL' | 'ATTACK';
  target: CombatUnit | null;
  reason: 'stunned' | 'no_target' | 'rage_full' | 'disarmed' | 'basic_attack';
}

function isDifficultyKey(value: string): value is DifficultyKey {
  return Object.prototype.hasOwnProperty.call(AI_SETTINGS, value);
}

function resolveDifficulty(difficulty: string): DifficultyKey {
  return isDifficultyKey(difficulty) ? difficulty : 'MEDIUM';
}

export const AI_SETTINGS: Record<DifficultyKey, DifficultySettings> = {
  EASY: {
    label: "Dễ",
    hpMult: 0.84,
    atkMult: 0.82,
    matkMult: 0.82,
    rageGain: 1,
    randomTargetChance: 0.58,
    teamSizeBonus: 0,
    teamGrowthEvery: 5,
    teamGrowthCap: 1,
    budgetMult: 0.9,
    levelBonus: 0,
    maxTierBonus: 0,
    maxStar: 1,
    star2Bonus: -1,
    star3Bonus: -1,
    equipStartRound: 8,      // Trang bị từ round 8
    equipBaseChance: 0.10,   // 10% cơ bản
    equipGrowth: 0.02,       // +2% mỗi round
    equipMaxChance: 0.35,    // Cap 35%
    equipMaxTier: 1
  },
  COOP_EASY: {
    label: "Co-op Dễ",
    hpMult: 0.98,
    atkMult: 0.96,
    matkMult: 0.96,
    rageGain: 1,
    randomTargetChance: 0.42,
    teamSizeBonus: 1,
    teamGrowthEvery: 4,
    teamGrowthCap: 2,
    budgetMult: 1.02,
    levelBonus: 0,
    maxTierBonus: 0,
    maxStar: 2,
    minStar2Round: 6,
    star2Bonus: 0.02,
    star3Bonus: -1,
    equipStartRound: 7,
    equipBaseChance: 0.14,
    equipGrowth: 0.03,
    equipMaxChance: 0.45,
    equipMaxTier: 2
  },
  COOP4_EASY: {
    label: "Co-op 4 Dễ",
    hpMult: 0.98,
    atkMult: 0.96,
    matkMult: 0.96,
    rageGain: 1,
    randomTargetChance: 0.42,
    teamSizeBonus: 1,
    teamGrowthEvery: 4,
    teamGrowthCap: 2,
    budgetMult: 1.02,
    levelBonus: 0,
    maxTierBonus: 0,
    maxStar: 2,
    minStar2Round: 6,
    star2Bonus: 0.02,
    star3Bonus: -1,
    equipStartRound: 7,
    equipBaseChance: 0.14,
    equipGrowth: 0.03,
    equipMaxChance: 0.45,
    equipMaxTier: 2
  },
  MEDIUM: {
    label: "Trung bình",
    hpMult: 0.95,
    atkMult: 0.93,
    matkMult: 0.93,
    rageGain: 1,
    randomTargetChance: 0.3,
    teamSizeBonus: 0,       // Giống EASY
    teamGrowthEvery: 5,     // Giống EASY
    teamGrowthCap: 1,       // Giống EASY
    budgetMult: 1,
    levelBonus: 0,
    maxTierBonus: 0,
    maxStar: 2,              // Tối đa 2★
    minStar2Round: 5,        // Guarantee 1× 2★ từ round 5
    star2Bonus: -0.02,
    star3Bonus: -1,           // Không cho 3★
    equipStartRound: 6,      // Trang bị từ round 6
    equipBaseChance: 0.12,   // 12% cơ bản
    equipGrowth: 0.03,       // +3% mỗi round
    equipMaxChance: 0.55,    // Cap 55%
    equipMaxTier: 2
  },
  COOP_MEDIUM: {
    label: "Co-op Trung bình",
    hpMult: 1.08,
    atkMult: 1.06,
    matkMult: 1.06,
    rageGain: 1,
    randomTargetChance: 0.22,
    teamSizeBonus: 1,
    teamGrowthEvery: 4,
    teamGrowthCap: 3,
    budgetMult: 1.08,
    levelBonus: 1,
    maxTierBonus: 1,
    maxStar: 2,
    minStar2Round: 5,
    star2Bonus: 0.03,
    star3Bonus: -1,
    equipStartRound: 6,
    equipBaseChance: 0.16,
    equipGrowth: 0.04,
    equipMaxChance: 0.62,
    equipMaxTier: 2
  },
  COOP4_MEDIUM: {
    label: "Co-op 4 Trung bình",
    hpMult: 1.08,
    atkMult: 1.06,
    matkMult: 1.06,
    rageGain: 1,
    randomTargetChance: 0.22,
    teamSizeBonus: 1,
    teamGrowthEvery: 4,
    teamGrowthCap: 3,
    budgetMult: 1.08,
    levelBonus: 1,
    maxTierBonus: 1,
    maxStar: 2,
    minStar2Round: 5,
    star2Bonus: 0.03,
    star3Bonus: -1,
    equipStartRound: 6,
    equipBaseChance: 0.16,
    equipGrowth: 0.04,
    equipMaxChance: 0.62,
    equipMaxTier: 2
  },
  HARD: {
    label: "Khó",
    hpMult: 1.05,
    atkMult: 1.04,
    matkMult: 1.04,
    rageGain: 1,
    randomTargetChance: 0.12,
    teamSizeBonus: 1,
    teamGrowthEvery: 4,
    teamGrowthCap: 2,
    budgetMult: 1.05,
    levelBonus: 1,
    maxTierBonus: 1,
    maxStar: 3,              // Cho phép 3★
    minStar2Round: 4,        // Guarantee 1× 2★ từ round 4
    minStar3Round: 14,       // Guarantee 1× 3★ từ round 14
    star2Bonus: 0,
    star3Bonus: 0,
    equipStartRound: 5,
    equipBaseChance: 0.15,
    equipGrowth: 0.04,
    equipMaxChance: 0.70,
    equipMaxTier: 3
  },
  COOP_HARD: {
    label: "Co-op Khó",
    hpMult: 1.18,
    atkMult: 1.15,
    matkMult: 1.15,
    rageGain: 1.05,
    randomTargetChance: 0.1,
    teamSizeBonus: 2,
    teamGrowthEvery: 3,
    teamGrowthCap: 4,
    budgetMult: 1.15,
    levelBonus: 1,
    maxTierBonus: 1,
    maxStar: 3,
    minStar2Round: 4,
    minStar3Round: 12,
    star2Bonus: 0.05,
    star3Bonus: 0.02,
    equipStartRound: 5,
    equipBaseChance: 0.18,
    equipGrowth: 0.05,
    equipMaxChance: 0.78,
    equipMaxTier: 3
  },
  COOP4_HARD: {
    label: "Co-op 4 Khó",
    hpMult: 1.18,
    atkMult: 1.15,
    matkMult: 1.15,
    rageGain: 1.05,
    randomTargetChance: 0.1,
    teamSizeBonus: 2,
    teamGrowthEvery: 3,
    teamGrowthCap: 4,
    budgetMult: 1.15,
    levelBonus: 1,
    maxTierBonus: 1,
    maxStar: 3,
    minStar2Round: 4,
    minStar3Round: 12,
    star2Bonus: 0.05,
    star3Bonus: 0.02,
    equipStartRound: 5,
    equipBaseChance: 0.18,
    equipGrowth: 0.05,
    equipMaxChance: 0.78,
    equipMaxTier: 3
  },
  CREATIVE: {
    label: "Sáng tạo",
    hpMult: 0.75,
    atkMult: 0.72,
    matkMult: 0.72,
    rageGain: 0.9,
    randomTargetChance: 0.8,
    teamSizeBonus: -1,
    teamGrowthEvery: 8,
    teamGrowthCap: 0,
    budgetMult: 0.8,
    levelBonus: 0,
    maxTierBonus: -1,
    maxStar: 1,
    star2Bonus: -1,
    star3Bonus: -1,
    equipStartRound: 99,
    equipBaseChance: 0,
    equipGrowth: 0,
    equipMaxChance: 0,
    equipMaxTier: 0
  },
  TUTORIAL: {
    label: "Hướng dẫn",
    hpMult: 0.65,
    atkMult: 0.60,
    matkMult: 0.60,
    rageGain: 0.8,
    randomTargetChance: 0.75,
    teamSizeBonus: -1,
    teamGrowthEvery: 8,
    teamGrowthCap: 0,
    budgetMult: 0.7,
    levelBonus: 0,
    maxTierBonus: -1,
    maxStar: 1,
    star2Bonus: -1,
    star3Bonus: -1,
    equipStartRound: 99,
    equipBaseChance: 0,
    equipGrowth: 0,
    equipMaxChance: 0,
    equipMaxTier: 0
  }
};

Object.entries(AI_SETTINGS).forEach(([, settings]) => Object.freeze(settings));
Object.freeze(AI_SETTINGS);

/**
 * Gets AI settings configuration for a specific difficulty level
 * Returns stat multipliers, rage gain, targeting behavior, and team composition settings
 * 
 * @param {string} difficulty - Difficulty level (EASY, MEDIUM, HARD), defaults to MEDIUM
 * @returns {Object} AI settings object with multipliers and configuration
 * @returns {string} return.label - Display label for difficulty
 * @returns {number} return.hpMult - HP multiplier for enemy units
 * @returns {number} return.atkMult - Attack multiplier for enemy units
 * @returns {number} return.matkMult - Magic attack multiplier for enemy units
 * @returns {number} return.rageGain - Rage gain multiplier
 * @returns {number} return.randomTargetChance - Probability of random target selection
 * @returns {number} return.teamSizeBonus - Flat bonus to team size
 * @returns {number} return.teamGrowthEvery - Rounds between team size growth
 * @returns {number} return.teamGrowthCap - Maximum team size growth
 * @returns {number} return.budgetMult - Budget multiplier for unit selection
 * @returns {number} return.levelBonus - Bonus to estimated level
 * @returns {number} return.maxTierBonus - Bonus to maximum tier available
 * @returns {number} return.star2Bonus - Bonus to 2-star unit chance
 * @returns {number} return.star3Bonus - Bonus to 3-star unit chance
 * 
 * @example
 * const settings = getAISettings('HARD');
 * console.log(settings.hpMult); // 1.05
 * console.log(settings.randomTargetChance); // 0.12
 * 
 * **Validates: Requirements 7.2, 7.3**
 */
export function getAISettings(difficulty: string = 'MEDIUM'): DifficultySettings & { difficulty: DifficultyKey } {
  const resolvedDifficulty = resolveDifficulty(difficulty);
  return {
    ...AI_SETTINGS[resolvedDifficulty],
    difficulty: resolvedDifficulty
  };
}

// Team generation logic extracted to AITeamGeneration.js
export { generateEnemyTeam, computeEnemyTeamSize };

// Targeting logic extracted to AITargeting.js
import { selectTarget } from './AITargeting.js';
export { selectTarget };

/**
 * Gets AI difficulty multipliers for combat stats
 *
 * @param {string} difficulty
 * @returns {Object}
 */
export function getAIDifficultyMultiplier(difficulty: string = 'MEDIUM'): Pick<DifficultySettings, 'hpMult' | 'atkMult' | 'matkMult' | 'rageGain' | 'randomTargetChance'> {
  const ai = AI_SETTINGS[resolveDifficulty(difficulty)];
  return {
    hpMult: ai.hpMult,
    atkMult: ai.atkMult,
    matkMult: ai.matkMult,
    rageGain: ai.rageGain,
    randomTargetChance: ai.randomTargetChance
  };
}

/**
 * Makes AI decision for combat action
 *
 * @param {Object} state - Combat state
 * @param {Object} aiUnit - AI unit taking action
 * @param {string} difficulty
 * @returns {Object} Decision object
 */
export function makeAIDecision(state: CombatState, aiUnit: CombatUnit, difficulty: string = 'MEDIUM'): AIDecision {
  if (aiUnit.statuses?.stun !== undefined && aiUnit.statuses.stun > 0) {
    return { action: 'SKIP', target: null, reason: 'stunned' };
  }

  const target = selectTarget(aiUnit, state, difficulty, { deterministic: false });
  if (!target) {
    return { action: 'SKIP', target: null, reason: 'no_target' };
  }

  const shouldUseSkill = (aiUnit.rage ?? 0) >= (aiUnit.rageMax || 100) &&
    (aiUnit.statuses?.silence || 0) <= 0 &&
    Boolean(aiUnit.skillId);

  if (shouldUseSkill) {
    return { action: 'SKILL', target, reason: 'rage_full' };
  }

  if ((aiUnit.statuses?.disarmTurns || 0) > 0) {
    return { action: 'SKIP', target: null, reason: 'disarmed' };
  }

  return { action: 'ATTACK', target, reason: 'basic_attack' };
}


/**
 * AISystem - Main export object with all AI operations
 */
export const AISystem = {
  getAISettings,
  getAIDifficultyMultiplier,
  generateEnemyTeam,
  computeEnemyTeamSize,
  makeAIDecision,
  selectTarget
};

export default AISystem;
