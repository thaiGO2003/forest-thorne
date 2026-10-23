/**
 * AITeamGeneration - Enemy Team Generation Logic
 *
 * Extracted from AISystem to keep file sizes manageable.
 * Contains team generation, position assignment, and class weighting logic.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 7.7**
 */

import { EQUIPMENT_ITEMS } from '../data/items.js';
import { UNIT_CATALOG, resolveUnitEquipmentSlotCap } from '../data/unitCatalog.js';
import { getDeployCapByLevel } from '../core/gameUtils.js';
import { getCoopBaseDifficulty } from '../core/aiModes.js';
import { getBoardProfile, normalizeBoardProfile } from '../core/boardProfiles.js';
import { AI_SETTINGS } from './AISystem.js';

const resolveEquipmentSlotCap = resolveUnitEquipmentSlotCap as unknown as (baseOrUnit: unknown, star?: number | null) => number;

type DifficultyKey =
    | 'EASY' | 'COOP_EASY' | 'COOP4_EASY'
    | 'MEDIUM' | 'COOP_MEDIUM' | 'COOP4_MEDIUM'
    | 'HARD' | 'COOP_HARD' | 'COOP4_HARD'
    | 'CREATIVE' | 'TUTORIAL';
type ClassType = 'TANKER' | 'FIGHTER' | 'ASSASSIN' | 'ARCHER' | 'MAGE' | 'SUPPORT';

interface EquipmentItem { id?: string; tier?: number; }
interface UnitLike { baseId?: string; star?: number; rageMax?: number; base?: UnitLike; }
interface CatalogUnit { id: string; classType: ClassType; tier: number; }
interface GenerationPick { baseId: string; classType: ClassType; tier: number; star: number; }
interface PositionedEnemy { baseId: string; star: number; row: number; col: number; }
interface BoardProfile { id: string; rows: number; enemyCols: number; enemyColStart: number; enemyColEnd: number; playerCount?: number; }
interface GenerationOptions { boardProfile?: string | BoardProfile; }
interface ResolvedGenerationOptions { sandbox: boolean; boardProfile: BoardProfile; }
interface RoleProfile { minFrontRatio: number; nonFrontBias: number; weights: Record<ClassType, number>; }
interface EnemySlot { row: number; col: number; }
interface EnemySlotLists { frontSlots: EnemySlot[]; backSlots: EnemySlot[]; assassinSlots: EnemySlot[]; }
type RoleCounts = Record<ClassType, number>;

function resolveDifficulty(value: unknown): DifficultyKey {
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(AI_SETTINGS, value)) {
        return value as DifficultyKey;
    }
    return 'MEDIUM';
}

function toBoardProfile(value: unknown): BoardProfile {
    if (value && typeof value === 'object') return value as BoardProfile;
    return normalizeBoardProfile(typeof value === 'string' ? value : 'solo') as BoardProfile;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}


/**
 * Utility function to select a random item from an array
 * @private
 */
function randomItem<T>(array: T[], rng: () => number = Math.random): T | undefined {
    return array[Math.floor(rng() * array.length)];
}

export function rollAiEquipmentIds(round: number, difficulty: string = 'MEDIUM', unitOrRng: UnitLike | (() => number) | null = null, maybeRng: () => number = Math.random): string[] {
    const unit = typeof unitOrRng === 'function' ? null : unitOrRng;
    const rng = typeof unitOrRng === 'function' ? unitOrRng : maybeRng;
    const ai = AI_SETTINGS[resolveDifficulty(difficulty)];
    const equipStart = ai.equipStartRound ?? Infinity;
    if (round < equipStart || EQUIPMENT_ITEMS.length <= 0) return [];

    const roundsSinceStart = round - equipStart;
    const rawChance = (ai.equipBaseChance ?? 0.1) + roundsSinceStart * (ai.equipGrowth ?? 0.02);
    const maxTier = ai.equipMaxTier ?? 1;
    const eligibleItems = (EQUIPMENT_ITEMS as EquipmentItem[]).filter((item) => (item.tier ?? 1) <= maxTier);
    if (eligibleItems.length <= 0) return [];

    const cappedChance = Math.min(
        rawChance,
        (ai.equipMaxChance ?? 0.5) + Math.max(0, roundsSinceStart - 15) * 0.05
    );
    const guaranteedSlots = Math.floor(cappedChance);
    const extraChance = cappedChance - guaranteedSlots;
    const equipmentSlotCap = resolveEquipmentSlotCap(unit, unit?.star ?? null);
    const totalEquips = Math.min(guaranteedSlots + (rng() < extraChance ? 1 : 0), equipmentSlotCap);
    if (totalEquips <= 0) return [];

    const equips: string[] = [];
    for (let slot = 0; slot < totalEquips; slot += 1) {
        const item = randomItem(eligibleItems, rng);
        if (item?.id && !equips.includes(item.id)) equips.push(item.id);
    }
    return equips;
}

/**
 * Role composition profiles for different difficulty levels
 */
const AI_ROLE_PROFILES: Partial<Record<DifficultyKey, RoleProfile>> = {
    EASY: {
        minFrontRatio: 0.55,
        nonFrontBias: 0.18,
        weights: {
            TANKER: 0.36,
            FIGHTER: 0.28,
            ARCHER: 0.14,
            SUPPORT: 0.1,
            MAGE: 0.07,
            ASSASSIN: 0.05
        }
    },
    MEDIUM: {
        minFrontRatio: 0.42,
        nonFrontBias: 0.32,
        weights: {
            TANKER: 0.24,
            FIGHTER: 0.24,
            ARCHER: 0.17,
            SUPPORT: 0.13,
            MAGE: 0.13,
            ASSASSIN: 0.09
        }
    },
    HARD: {
        minFrontRatio: 0.34,
        nonFrontBias: 0.45,
        weights: {
            TANKER: 0.19,
            FIGHTER: 0.19,
            ARCHER: 0.18,
            SUPPORT: 0.15,
            MAGE: 0.16,
            ASSASSIN: 0.13
        }
    },
    COOP_EASY: {
        minFrontRatio: 0.55,
        nonFrontBias: 0.18,
        weights: {
            TANKER: 0.36,
            FIGHTER: 0.28,
            ARCHER: 0.14,
            SUPPORT: 0.1,
            MAGE: 0.07,
            ASSASSIN: 0.05
        }
    },
    COOP_MEDIUM: {
        minFrontRatio: 0.42,
        nonFrontBias: 0.32,
        weights: {
            TANKER: 0.24,
            FIGHTER: 0.24,
            ARCHER: 0.17,
            SUPPORT: 0.13,
            MAGE: 0.13,
            ASSASSIN: 0.09
        }
    },
    COOP_HARD: {
        minFrontRatio: 0.34,
        nonFrontBias: 0.45,
        weights: {
            TANKER: 0.19,
            FIGHTER: 0.19,
            ARCHER: 0.18,
            SUPPORT: 0.15,
            MAGE: 0.16,
            ASSASSIN: 0.13
        }
    },
    COOP4_EASY: {
        minFrontRatio: 0.55,
        nonFrontBias: 0.18,
        weights: {
            TANKER: 0.36,
            FIGHTER: 0.28,
            ARCHER: 0.14,
            SUPPORT: 0.1,
            MAGE: 0.07,
            ASSASSIN: 0.05
        }
    },
    COOP4_MEDIUM: {
        minFrontRatio: 0.42,
        nonFrontBias: 0.32,
        weights: {
            TANKER: 0.24,
            FIGHTER: 0.24,
            ARCHER: 0.17,
            SUPPORT: 0.13,
            MAGE: 0.13,
            ASSASSIN: 0.09
        }
    },
    COOP4_HARD: {
        minFrontRatio: 0.34,
        nonFrontBias: 0.45,
        weights: {
            TANKER: 0.19,
            FIGHTER: 0.19,
            ARCHER: 0.18,
            SUPPORT: 0.15,
            MAGE: 0.16,
            ASSASSIN: 0.13
        }
    }
};

/**
 * Picks a class type based on weighted probabilities
 * @private
 */
function pickClassByWeights(weights: Record<ClassType, number>): ClassType {
    const roll = Math.random();
    let cumulative = 0;
    for (const [classType, weight] of Object.entries(weights) as [ClassType, number][]) {
        cumulative += weight;
        if (roll < cumulative) return classType;
    }
    return 'FIGHTER';
}

function normalizeGenerationOptions(sandboxOrOptions: boolean | GenerationOptions = false, maybeOptions: GenerationOptions | null = null): ResolvedGenerationOptions {
    if (sandboxOrOptions && typeof sandboxOrOptions === 'object' && !Array.isArray(sandboxOrOptions)) {
        return { sandbox: false, boardProfile: toBoardProfile(sandboxOrOptions.boardProfile ?? 'solo') };
    }
    return { sandbox: Boolean(sandboxOrOptions), boardProfile: toBoardProfile(maybeOptions?.boardProfile ?? 'solo') };
}

function createRowPriority(rows: number, anchors: number[]): number[] {
    const uniqueAnchors = [...new Set(anchors.filter((row) => row >= 0 && row < rows))];
    const fallbackRows = Array.from({ length: rows }, (_, idx) => idx)
        .filter((row) => !uniqueAnchors.includes(row))
        .sort((a, b) => {
            const distA = uniqueAnchors.length > 0 ? Math.min(...uniqueAnchors.map((anchor) => Math.abs(anchor - a))) : a;
            const distB = uniqueAnchors.length > 0 ? Math.min(...uniqueAnchors.map((anchor) => Math.abs(anchor - b))) : b;
            if (distA !== distB) return distA - distB;
            return a - b;
        });
    return [...uniqueAnchors, ...fallbackRows];
}

function createEnemySlotLists(boardProfile: BoardProfile): EnemySlotLists {
    const profile = toBoardProfile(boardProfile);
    const frontCols = [profile.enemyColStart, profile.enemyColStart + 1, profile.enemyColStart + 2].filter((col) => col <= profile.enemyColEnd);
    const backCols = [profile.enemyColEnd, profile.enemyColEnd - 1, profile.enemyColEnd - 2].filter((col) => col >= profile.enemyColStart);
    const midRow = Math.floor((profile.rows - 1) / 2);
    const anchors = profile.rows <= 5 ? [midRow, midRow - 1, midRow + 1, 0, profile.rows - 1] : [midRow, midRow - 1, midRow + 1, midRow - 2, midRow + 2, 0, profile.rows - 1];
    const rowPriority = createRowPriority(profile.rows, anchors);
    const frontSlots: EnemySlot[] = [];
    const backSlots: EnemySlot[] = [];
    const assassinSlots: EnemySlot[] = [];
    frontCols.forEach((col) => rowPriority.forEach((row) => frontSlots.push({ row, col })));
    backCols.forEach((col) => rowPriority.forEach((row) => backSlots.push({ row, col })));
    const assassinRows = profile.rows <= 5 ? createRowPriority(profile.rows, [0, profile.rows - 1, 1, profile.rows - 2]) : createRowPriority(profile.rows, [0, profile.rows - 1, 1, profile.rows - 2, 2, profile.rows - 3]);
    [profile.enemyColEnd, Math.max(profile.enemyColStart, profile.enemyColEnd - 1)].forEach((col) => assassinRows.forEach((row) => assassinSlots.push({ row, col })));
    return { frontSlots, backSlots, assassinSlots };
}

/**
 * Assigns board positions to enemy units based on their roles
 * @private
 */
function assignPositions(picks: GenerationPick[], boardProfile: BoardProfile = getBoardProfile("solo") as BoardProfile): PositionedEnemy[] {
    const { frontSlots, backSlots, assassinSlots } = createEnemySlotLists(boardProfile);
    const used = new Set<string>();
    const takeSlot = (list: EnemySlot[]): EnemySlot | null => {
        for (let i = 0; i < list.length; i += 1) {
            const key = `${list[i].row}:${list[i].col}`;
            if (used.has(key)) continue;
            used.add(key);
            return list[i];
        }
        return null;
    };
    const units: PositionedEnemy[] = [];
    const ordered = [
        ...picks.filter((p) => p.classType === "TANKER" || p.classType === "FIGHTER"),
        ...picks.filter((p) => p.classType === "SUPPORT" || p.classType === "MAGE" || p.classType === "ARCHER"),
        ...picks.filter((p) => p.classType === "ASSASSIN")
    ];
    ordered.forEach((pick) => {
        let slot: EnemySlot | null = null;
        if (pick.classType === "TANKER" || pick.classType === "FIGHTER") slot = takeSlot(frontSlots) ?? takeSlot(backSlots);
        else if (pick.classType === "ASSASSIN") slot = takeSlot(assassinSlots) ?? takeSlot(backSlots) ?? takeSlot(frontSlots);
        else slot = takeSlot(backSlots) ?? takeSlot(frontSlots);
        if (slot) units.push({ baseId: pick.baseId, star: pick.star, row: slot.row, col: slot.col });
    });
    return units;
}
/**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 7.7**
 */
export function generateEnemyTeam(round: number, budget: number, difficulty: string = 'MEDIUM', sandbox: boolean | GenerationOptions = false, options: GenerationOptions | null = null): PositionedEnemy[] {
    const { sandbox: resolvedSandbox, boardProfile } = normalizeGenerationOptions(sandbox, options);
    const resolvedDifficulty = resolveDifficulty(difficulty);
    const ai = AI_SETTINGS[resolvedDifficulty];
    const modeFactor = ai.budgetMult ?? 1;
    const teamSize = computeEnemyTeamSize(round, resolvedDifficulty, resolvedSandbox, { boardProfile });
    const budgetScale = Math.max(1, (boardProfile.rows ?? 5) / 5);
    const actualBudget = Math.round((8 + round * (resolvedSandbox ? 2.1 : 2.6)) * modeFactor * budgetScale);
    const maxTier = clamp(1 + Math.floor(round / 3) + (ai.maxTierBonus ?? 0), 1, 5);
    const pool = (UNIT_CATALOG as CatalogUnit[]).filter((u) => u.tier <= maxTier);

    const picks: GenerationPick[] = [];
    let coins = actualBudget;
    let frontCount = 0;
    const roleCounts: RoleCounts = {
        TANKER: 0, FIGHTER: 0, ASSASSIN: 0,
        ARCHER: 0, MAGE: 0, SUPPORT: 0
    };

    const roleProfile = AI_ROLE_PROFILES[resolvedDifficulty] ?? AI_ROLE_PROFILES.MEDIUM!;
    let guard = 0;

    while (picks.length < teamSize && guard < 260) {
        guard += 1;
        let candidates = pool.filter((u) => u.tier <= Math.max(1, coins));
        if (!candidates.length) candidates = pool.filter((u) => u.tier === 1);
        if (!candidates.length) break;

        let pick: CatalogUnit | undefined;
        const targetClass = pickClassByWeights(roleProfile.weights);
        const byClass = candidates.filter((u) => u.classType === targetClass);
        if (byClass.length) {
            const minRoleCount = Math.min(...Object.values(roleCounts));
            const diversityPool = byClass.filter((u) => roleCounts[u.classType] <= minRoleCount + 1);
            pick = randomItem(diversityPool.length ? diversityPool : byClass);
        }
        if (!pick && frontCount < Math.ceil(teamSize * roleProfile.minFrontRatio)) {
            const frontPool = candidates.filter((u) => u.classType === "TANKER" || u.classType === "FIGHTER");
            if (frontPool.length) pick = randomItem(frontPool);
        }
        if (!pick && Math.random() < roleProfile.nonFrontBias) {
            const nonFrontPool = candidates.filter((u) => u.classType !== "TANKER" && u.classType !== "FIGHTER");
            if (nonFrontPool.length) pick = randomItem(nonFrontPool);
        }
        if (!pick) pick = randomItem(candidates);
        if (!pick) break;

        let star = 1;
        const maxStar = ai.maxStar ?? 3;
        if (maxStar >= 2) {
            const starRoll = Math.random();
            const twoStarChance = clamp((round - 6) * 0.045 + (ai.star2Bonus ?? 0), 0, 0.38);
            const threeStarChance = maxStar >= 3 ? clamp((round - 11) * 0.018 + (ai.star3Bonus ?? 0), 0, 0.08) : 0;
            if (starRoll < threeStarChance) star = 3;
            else if (starRoll < threeStarChance + twoStarChance) star = 2;
        }

        picks.push({ baseId: pick.id, classType: pick.classType, tier: pick.tier, star });
        if (pick.classType === "TANKER" || pick.classType === "FIGHTER") frontCount += 1;
        roleCounts[pick.classType] += 1;
        coins -= Math.max(1, pick.tier - (star - 1));
        if (coins <= 0 && picks.length >= Math.ceil(teamSize * 0.7)) break;
    }

    if (!picks.length) {
        const fallback = randomItem(pool.filter((u) => u.tier === 1));
        if (fallback) picks.push({ baseId: fallback.id, classType: fallback.classType, tier: fallback.tier, star: 1 });
    }

    // Star guarantee logic
    const minStar2Round = ai.minStar2Round ?? Infinity;
    const minStar3Round = ai.minStar3Round ?? Infinity;
    const maxStar = ai.maxStar ?? 3;

    if (round >= minStar2Round && maxStar >= 2) {
        const guaranteed2Star = clamp(1 + Math.floor((round - minStar2Round) / 4), 1, Math.ceil(picks.length * 0.5));
        let current2Plus = picks.filter(p => p.star >= 2).length;
        for (let i = 0; i < picks.length && current2Plus < guaranteed2Star; i++) {
            if (picks[i].star < 2) {
                picks[i].star = 2;
                current2Plus++;
            }
        }
    }

    if (round >= minStar3Round && maxStar >= 3) {
        const guaranteed3Star = clamp(1 + Math.floor((round - minStar3Round) / 6), 1, Math.ceil(picks.length * 0.25));
        let current3 = picks.filter(p => p.star >= 3).length;
        const sorted = picks.map((p, idx) => ({ idx, tier: p.tier })).sort((a, b) => b.tier - a.tier);
        for (const { idx } of sorted) {
            if (current3 >= guaranteed3Star) break;
            if (picks[idx].star < 3) {
                picks[idx].star = 3;
                current3++;
            }
        }
    }

    return assignPositions(picks, boardProfile);
}

/**
 * Computes enemy team size based on round number and difficulty
 *
 * **Validates: Requirements 7.2, 7.6**
 */
export function computeEnemyTeamSize(round: number, difficulty: string = 'MEDIUM', sandbox: boolean | GenerationOptions = false, options: GenerationOptions | null = null): number {
    const { sandbox: resolvedSandbox, boardProfile } = normalizeGenerationOptions(sandbox, options);
    const resolvedDifficulty = resolveDifficulty(difficulty);
    const isCoopBoardProfile = boardProfile.id === 'coop' || boardProfile.id === 'coop4';
    const baseBoardProfile = isCoopBoardProfile ? toBoardProfile(getBoardProfile('solo')) : boardProfile;
    const isCoopDifficulty = resolvedDifficulty.startsWith('COOP');
    const baseDifficulty = isCoopBoardProfile && isCoopDifficulty
        ? resolveDifficulty(getCoopBaseDifficulty(resolvedDifficulty))
        : resolvedDifficulty;
    let finalizedSize = computeBaseEnemyTeamSize(round, baseDifficulty, resolvedSandbox, baseBoardProfile);

    if (isCoopBoardProfile) {
        const soloRows = Math.max(1, getBoardProfile('solo').rows ?? 5);
        const coopRows = Math.max(1, boardProfile.rows ?? soloRows);
        const playerCount = Math.max(
            1,
            Number.isInteger(boardProfile.playerCount)
                ? (boardProfile.playerCount ?? 1)
                : Math.floor(coopRows / soloRows)
        );
        finalizedSize *= playerCount;
    }

    const boardAreaCap = Math.max(2, (boardProfile.rows ?? 5) * (boardProfile.enemyCols ?? 5));
    const maxUnits = isCoopBoardProfile
        ? boardAreaCap
        : Math.min(15, boardAreaCap);
    return clamp(finalizedSize, 2, maxUnits);
}

function computeBaseEnemyTeamSize(round: number, difficulty: DifficultyKey, sandbox: boolean, boardProfile: BoardProfile): number {
    const ai = AI_SETTINGS[difficulty];
    const estLevel = clamp(1 + Math.floor(round / 2) + (ai.levelBonus ?? 0), 1, 15);
    const rowScale = Math.max(1, Math.floor((boardProfile.rows ?? 5) / 5));
    const base = getDeployCapByLevel(estLevel) * rowScale;
    let flatBonus = ai.teamSizeBonus ?? 0;
    if (difficulty === 'HARD' && round <= 3) flatBonus = 0;
    const growthEvery = Math.max(1, ai.teamGrowthEvery ?? 4);
    const growthCap = Math.max(0, ai.teamGrowthCap ?? 2);
    const roundGrowth = clamp(Math.floor((round - 1) / growthEvery), 0, growthCap);
    const sandboxPenalty = sandbox ? 1 : 0;
    let finalizedSize = base + flatBonus + roundGrowth - sandboxPenalty;
    if (difficulty === 'HARD' && round <= 3) finalizedSize = Math.min(finalizedSize, 3);
    return finalizedSize;
}
