/**
 * DifficultyValidator - Cân bằng độ khó và kiểm chứng thiết lập AI
 *
 * Kiểm tra và đảm bảo các cấu hình độ khó tuân thủ các quy tắc trong game (Easy < Medium < Hard).
 */

import { AI_SETTINGS, computeEnemyTeamSize } from './AISystem.js';

type DifficultyKey = keyof typeof AI_SETTINGS;
interface DifficultyConfig {
    hpMult?: number;
    atkMult?: number;
    matkMult?: number;
    maxStar?: number;
    star2Bonus?: number;
    star3Bonus?: number;
    minStar2Round?: number;
    minStar3Round?: number;
}

function isDifficultyConfig(value: unknown): value is DifficultyConfig {
    return typeof value === 'object' && value !== null;
}
/**
 * Tính toán Combat Power xấp xỉ của team AI dựa trên cấu hình và round.
 * Lấy cảm hứng từ: teamSize × avgStarLevel × statMultipliers
 *
 * @param {Object} config - Cấu hình AI (VD: AI_SETTINGS.HARD)
 * @param {number} round - Vòng đấu hiện tại
 * @param {string} difficulty - Mức độ khó ('EASY', 'MEDIUM', 'HARD')
 * @returns {number} Giá trị power xấp xỉ
 */
export function calculateCombatPower(config: DifficultyConfig, round: number, difficulty: string): number {
    const teamSize = computeEnemyTeamSize(round, difficulty, false);
    let avgStarLevel = 1;
    const maxStar = config.maxStar ?? 3;
    if (maxStar >= 2) {
        const twoStarChance = Math.max(0, Math.min(0.38, (round - 6) * 0.045 + (config.star2Bonus ?? 0)));
        const threeStarChance = maxStar >= 3 ? Math.max(0, Math.min(0.08, (round - 11) * 0.018 + (config.star3Bonus ?? 0))) : 0;
        avgStarLevel = 1 + twoStarChance + threeStarChance * 2;
        const minStar2Round = config.minStar2Round ?? Infinity;
        const minStar3Round = config.minStar3Round ?? Infinity;
        if (round >= minStar2Round) {
            const guaranteed2Star = 1 + Math.floor((round - minStar2Round) / 4);
            avgStarLevel = Math.max(avgStarLevel, 1 + guaranteed2Star / teamSize);
        }
        if (round >= minStar3Round && maxStar >= 3) {
            const guaranteed3Star = 1 + Math.floor((round - minStar3Round) / 6);
            avgStarLevel = Math.max(avgStarLevel, 1 + guaranteed3Star * 2 / teamSize);
        }
    }
    const statMultipliers = ((config.hpMult ?? 1) + (config.atkMult ?? 1) + (config.matkMult ?? 1)) / 3;
    return teamSize * avgStarLevel * statMultipliers;
}

/**
 * Xác thực xem config có hợp lệ không (để phòng hờ lỗi thiếu field).
 */
export function validateDifficultyConfig(configName: string, config: unknown): boolean {
    if (!isDifficultyConfig(config)) return false;
    const requiredParams: Array<keyof DifficultyConfig> = ['hpMult', 'atkMult', 'matkMult', 'maxStar'];
    for (const param of requiredParams) {
        const value = config[param];
        if (value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
            console.error(`Invalid Difficulty Config [${configName}]: missing or invalid field ${param}`);
            return false;
        }
    }
    return true;
}

/**
 * Kiểm chứng tính cân bằng của các độ khó theo thời gian (EASY < MEDIUM < HARD).
 * Hàm này có thể được gọi lúc game khởi tạo.
 * 
 * @throws {Error} nếu progression invalid.
 */
export function validateDifficultyProgression(): boolean {
    const roundsToTest = [1, 5, 10, 15, 20];
    let progressionValid = true;

    for (const key of Object.keys(AI_SETTINGS) as DifficultyKey[]) {
        if (!validateDifficultyConfig(key, AI_SETTINGS[key])) {
            progressionValid = false;
        }
    }

    // Validate tính scale của sức mạnh combat
    for (const round of roundsToTest) {
        const powerEasy = calculateCombatPower(AI_SETTINGS.EASY, round, 'EASY');
        const powerMedium = calculateCombatPower(AI_SETTINGS.MEDIUM, round, 'MEDIUM');
        const powerHard = calculateCombatPower(AI_SETTINGS.HARD, round, 'HARD');

        if (!(powerEasy <= powerMedium && powerMedium <= powerHard)) {
            console.error(`Difficulty progression invalid at round ${round}: EASY(${powerEasy.toFixed(2)}) > MEDIUM(${powerMedium.toFixed(2)}) > HARD(${powerHard.toFixed(2)})`);
            progressionValid = false;
        }
    }

    if (!progressionValid) {
        console.warn("AI Difficulty settings might be unbalanced. Check logs for details.");
        return false;
    }

    return true;
}
