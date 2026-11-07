/**
 * AITargeting — Target selection logic cho AI combat
 *
 * Extracted từ AISystem.js để giữ file chính dưới 500 dòng.
 *
 * @private — chỉ dùng bởi AISystem
 */

import { AI_SETTINGS } from './AISystem.js';
import { getTopFirstRowSweep } from "../core/gameUtils.js";

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

interface UnitStatuses {
    tauntTargetId?: string | null;
    [key: string]: unknown;
}

interface CombatUnit {
    uid?: string;
    side?: 'LEFT' | 'RIGHT';
    alive?: boolean;
    row?: number;
    col?: number;
    range?: number;
    classType?: string;
    hp?: number;
    maxHp?: number;
    statuses?: UnitStatuses;
    [key: string]: unknown;
}

interface CombatState {
    units?: CombatUnit[];
}

interface TargetOptions {
    deterministic?: boolean;
    randomFn?: () => number;
}

function isDifficultyKey(value: string): value is DifficultyKey {
    return Object.prototype.hasOwnProperty.call(AI_SETTINGS, value);
}

function resolveDifficulty(value: string): DifficultyKey {
    return isDifficultyKey(value) ? value : 'MEDIUM';
}

function numberOrZero(value: number | undefined): number {
    return typeof value === 'number' ? value : 0;
}

 /**
  * @private
  */
function randomItem<T>(array: T[], randomFn: () => number = Math.random): T | undefined {
     return array[Math.floor(randomFn() * array.length)];
 }

/**
 * Selects target for an attacker unit using tactical AI
 *
 * @param {Object} attacker
 * @param {Object} state - Combat state
 * @param {string} difficulty
 * @param {Object} options
 * @returns {Object|null}
 */
export function selectTarget(attacker: CombatUnit, state: CombatState, difficulty: string = 'MEDIUM', options: TargetOptions = {}): CombatUnit | null {
    const enemySide: 'LEFT' | 'RIGHT' = attacker.side === 'LEFT' ? 'RIGHT' : 'LEFT';
    const enemies = (state.units || []).filter(u => u.side === enemySide && u.alive);
    const randomFn = typeof options.randomFn === 'function' ? options.randomFn : Math.random;

    if (!enemies.length) return null;

    // Check for taunt (forced target)
    if (attacker.statuses?.tauntTargetId) {
        const forced = enemies.find(e => e.uid === attacker.statuses?.tauntTargetId);
        if (forced) return forced;
    }

    const ai = AI_SETTINGS[resolveDifficulty(difficulty)];
    const keepFrontline = numberOrZero(attacker.range) <= 1 && attacker.classType !== 'ASSASSIN';
    const allowRandomTarget = attacker.classType !== 'ASSASSIN';

    // AI random target chance (only for AI units on RIGHT side)
    if (
        attacker.side === 'RIGHT' &&
        allowRandomTarget &&
        !keepFrontline &&
        !options.deterministic &&
        randomFn() < ai.randomTargetChance
    ) {
        return randomItem(enemies, randomFn) ?? null;
    }

    // Role-based target selection
    let target: CombatUnit | null = null;
    if (numberOrZero(attacker.range) <= 1 && attacker.classType !== 'ASSASSIN') {
        target = findTargetMeleeFrontline(attacker, enemies);
    } else if (attacker.classType === 'ASSASSIN') {
        target = findTargetAssassin(attacker, enemies);
    } else {
        target = findTargetRanged(attacker, enemies);
    }

    // Fallback: sort by priority and pick best
    if (!target) {
        const sorted = [...enemies].sort((a, b) => compareTargets(attacker, a, b));
        return sorted[0] || null;
    }

    return target;
}

/** @private */
function findTargetMeleeFrontline(attacker: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
    const myRow = numberOrZero(attacker.row);
    const myCol = numberOrZero(attacker.col);
    let best: CombatUnit | null = null;
    let bestScore = Infinity;

    enemies.forEach(enemy => {
        const colDist = Math.abs(numberOrZero(enemy.col) - myCol);
        const sameRow = enemy.row === myRow ? 0 : 1;
        const rowSweep = getTopFirstRowSweep(myRow, numberOrZero(enemy.row));
        const score = colDist * 1000 + sameRow * 100 + rowSweep;
        if (score < bestScore) {
            bestScore = score;
            best = enemy;
        }
    });

    return best;
}

function findTargetAssassin(attacker: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
    const myRow = numberOrZero(attacker.row);
    let best: CombatUnit | null = null;
    let bestScore = -Infinity;
    const classPriority: Record<string, number> = { MAGE: 0, ARCHER: 1, SUPPORT: 2, FIGHTER: 3, TANKER: 4 };

    enemies.forEach(enemy => {
        const enemyCol = numberOrZero(enemy.col);
        const farthestCol = attacker.side === 'LEFT' ? enemyCol : -enemyCol;
        const sameRow = enemy.row === myRow ? 0 : 1;
        const rowSweep = getTopFirstRowSweep(myRow, numberOrZero(enemy.row));
        const classScore = classPriority[enemy.classType ?? ''] !== undefined ? classPriority[enemy.classType ?? ''] : 5;
        const score = farthestCol * 1000000 - sameRow * 100000 - rowSweep * 1000 - classScore;
        if (score > bestScore) {
            bestScore = score;
            best = enemy;
        }
    });

    return best;
}
function findTargetRanged(attacker: CombatUnit, enemies: CombatUnit[]): CombatUnit | null {
    const myRow = numberOrZero(attacker.row);
    const myCol = numberOrZero(attacker.col);
    let best: CombatUnit | null = null;
    let bestScore = Infinity;

    enemies.forEach(enemy => {
        const sameRow = enemy.row === myRow ? 0 : 1;
        const rowSweep = getTopFirstRowSweep(myRow, numberOrZero(enemy.row));
        const colDist = Math.abs(numberOrZero(enemy.col) - myCol);
        const score = sameRow * 1000 + rowSweep * 100 + colDist;
        if (score < bestScore) {
            bestScore = score;
            best = enemy;
        }
    });

    return best;
}

/** @private */
function compareTargets(attacker: CombatUnit, a: CombatUnit, b: CombatUnit): number {
    const sa = scoreTarget(attacker, a);
    const sb = scoreTarget(attacker, b);
    for (let i = 0; i < sa.length; i += 1) {
        if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return 0;
}

/** @private */
function scoreTarget(attacker: CombatUnit, target: CombatUnit): number[] {
    const myRow = numberOrZero(attacker.row);
    const myCol = numberOrZero(attacker.col);
    const targetRow = numberOrZero(target.row);
    const targetCol = numberOrZero(target.col);

    const colDist = Math.abs(targetCol - myCol);
    const rowDist = Math.abs(targetRow - myRow);
    const rowSweep = getTopFirstRowSweep(myRow, targetRow);
    const sameRow = targetRow === myRow ? 0 : 1;
    const totalDist = colDist + rowDist;
    const hpRatio = Math.round((numberOrZero(target.hp) / numberOrZero(target.maxHp)) * 1000);
    const hpRaw = numberOrZero(target.hp);

    if (numberOrZero(attacker.range) <= 1) {
        if (attacker.classType === 'ASSASSIN') {
            const farthestCol = attacker.side === 'LEFT' ? -targetCol : targetCol;
            return [farthestCol, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
        }
        return [colDist, sameRow, rowSweep, totalDist, hpRatio, hpRaw];
    }

    return [sameRow, rowSweep, colDist, totalDist, hpRatio, hpRaw];
}
