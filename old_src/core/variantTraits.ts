import {
    CLASS_SKILL_VARIANTS,
    VARIANT_TRAIT_BY_ID,
    VARIANT_TRAIT_BY_NAME
} from "../data/classSkillVariants.js";

const MAX_TRAIT_COUNT = 9;

export function hashVariantSeed(text: unknown): number {
    const value = String(text ?? "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

function normalizeSeed(seed: unknown, fallbackText: string): number {
    if (Number.isInteger(seed) && (seed as number) >= 0) return (seed as number) >>> 0;
    return hashVariantSeed(fallbackText);
}

export interface VariantTrait {
    id: string;
    name?: string;
    weight?: number;
    classType?: string;
    bonus?: VariantBonus;
}

export interface VariantBonus {
    critPct?: number;
    atkPct?: number;
    matkPct?: number;
    hpPct?: number;
    evadePct?: number;
    defFlat?: number;
    mdefFlat?: number;
    shieldStart?: number;
    healPct?: number;
    startingRage?: number;
    lifestealPct?: number;
    [key: string]: number | undefined;
}

type TraitPool = VariantTrait[];

function getTraitPool(classType: string): TraitPool {
    const source = CLASS_SKILL_VARIANTS[classType as keyof typeof CLASS_SKILL_VARIANTS] ?? CLASS_SKILL_VARIANTS.FIGHTER;
    return (source ?? []) as TraitPool;
}

function pickTraitByWeightedSeed(pool: TraitPool, seed: number): VariantTrait | null {
    if (!pool.length) return null;
    const totalWeight = pool.reduce((sum, trait) => sum + (trait.weight ?? 1), 0);
    if (totalWeight <= 0) return pool[seed % pool.length] ?? pool[0];
    let cursor = seed % totalWeight;
    for (const trait of pool) {
        cursor -= trait.weight ?? 1;
        if (cursor < 0) return trait;
    }
    return pool[pool.length - 1];
}

function sanitizeTraitIds(classType: string, traitIds: unknown): string[] {
    const poolIds = new Set(getTraitPool(classType).map((trait) => trait.id));
    return (Array.isArray(traitIds) ? traitIds : [])
        .filter((traitId): traitId is string => typeof traitId === "string" && poolIds.has(traitId))
        .slice(0, MAX_TRAIT_COUNT);
}

export function getVariantTraitById(traitId: string): VariantTrait | null {
    return VARIANT_TRAIT_BY_ID[traitId] ?? null;
}

export function getVariantTraitByName(name: unknown, classType: string | null = null): VariantTrait | null {
    const trait = VARIANT_TRAIT_BY_NAME[String(name ?? "").trim()] ?? null;
    if (!trait) return null;
    if (classType && trait.classType !== classType) return null;
    return trait;
}

export function selectVariantTraitBySeed(classType: string, seed: unknown): VariantTrait | null {
    return pickTraitByWeightedSeed(getTraitPool(classType), normalizeSeed(seed, `${classType}:legacy`));
}

interface RollResult {
    seed: number;
    traitId: string | null;
    trait: VariantTrait | null;
}

export function rollVariantTrait(classType: string, randomFn: () => number = Math.random): RollResult {
    const seed = Math.floor(Math.max(0, Math.min(0.999999999, Number(randomFn()) || 0)) * 0x100000000) >>> 0;
    const trait = selectVariantTraitBySeed(classType, seed);
    return trait ? { seed, traitId: trait.id, trait } : { seed, traitId: null, trait: null };
}

interface UnitLike {
    skillVariant?: unknown;
    variantSeed?: unknown;
    uid?: unknown;
    baseId?: unknown;
    variantTraits?: unknown;
    variantSeeds?: unknown;
    base?: {
        classType?: string;
    };
    classType?: string;
}

function getLegacyTrait(unitLike: UnitLike | null | undefined, classType: string): {
    variantTraits: string[];
    variantSeeds: number[];
} {
    const explicit = getVariantTraitByName(unitLike?.skillVariant, classType);
    if (explicit) {
        const legacySeed = normalizeSeed(unitLike?.variantSeed, `${unitLike?.uid ?? ""}:${unitLike?.baseId ?? ""}:legacy`);
        return {
            variantTraits: [explicit.id],
            variantSeeds: [legacySeed]
        };
    }

    const legacySeed = hashVariantSeed(`${unitLike?.uid ?? ""}:${unitLike?.baseId ?? ""}`);
    const legacyTrait = selectVariantTraitBySeed(classType, legacySeed);
    if (!legacyTrait) {
        return { variantTraits: [], variantSeeds: [] };
    }
    return {
        variantTraits: [legacyTrait.id],
        variantSeeds: [legacySeed]
    };
}

interface NormalizeOptions {
    rollTrait?: boolean;
    randomFn?: () => number;
}

export function normalizeOwnedUnitTraits(unitLike: UnitLike | null | undefined, base: { classType?: string } | null = null, options: NormalizeOptions = {}): {
    variantTraits: string[];
    variantSeeds: number[];
} {
    const classType = base?.classType ?? unitLike?.base?.classType ?? unitLike?.classType ?? "FIGHTER";
    let variantTraits = sanitizeTraitIds(classType, unitLike?.variantTraits);
    let variantSeeds = Array.isArray(unitLike?.variantSeeds) ? (unitLike!.variantSeeds as number[]).slice(0, MAX_TRAIT_COUNT) : [];

    if (!variantTraits.length) {
        const migrated = getLegacyTrait(unitLike, classType);
        variantTraits = migrated.variantTraits;
        variantSeeds = migrated.variantSeeds;
    }

    if (!variantTraits.length && options.rollTrait !== false) {
        const rolled = rollVariantTrait(classType, options.randomFn);
        if (rolled.traitId) {
            variantTraits = [rolled.traitId];
            variantSeeds = [rolled.seed];
        }
    }

    if (variantSeeds.length < variantTraits.length) {
        for (let index = variantSeeds.length; index < variantTraits.length; index += 1) {
            variantSeeds.push(hashVariantSeed(`${unitLike?.uid ?? ""}:${unitLike?.baseId ?? ""}:${variantTraits[index]}:${index}`));
        }
    }

    return {
        variantTraits: variantTraits.slice(0, MAX_TRAIT_COUNT),
        variantSeeds: variantSeeds
            .slice(0, variantTraits.length)
            .map((seed, index) => normalizeSeed(seed, `${unitLike?.uid ?? ""}:${unitLike?.baseId ?? ""}:${index}`))
    };
}

export function mergeVariantTraitPayload(units: UnitLike[] | null | undefined): {
    variantTraits: string[];
    variantSeeds: number[];
} {
    const mergedTraits: string[] = [];
    const mergedSeeds: number[] = [];

    (Array.isArray(units) ? units : []).forEach((unit, unitIndex) => {
        const payload = normalizeOwnedUnitTraits(unit, (unit as { base?: { classType?: string } })?.base ?? null, { rollTrait: false });
        payload.variantTraits.forEach((traitId, traitIndex) => {
            if (mergedTraits.length >= MAX_TRAIT_COUNT) return;
            mergedTraits.push(traitId);
            mergedSeeds.push(normalizeSeed(
                payload.variantSeeds[traitIndex],
                `${(unit as { uid?: unknown })?.uid ?? ""}:${traitId}:${unitIndex}:${traitIndex}`
            ));
        });
    });

    return {
        variantTraits: mergedTraits.slice(0, MAX_TRAIT_COUNT),
        variantSeeds: mergedSeeds.slice(0, MAX_TRAIT_COUNT)
    };
}

export function getOwnedUnitTraitEntries(unitLike: UnitLike | null | undefined): VariantTrait[] {
    const base = unitLike?.base ?? null;
    const payload = normalizeOwnedUnitTraits(unitLike, base, { rollTrait: false });
    return payload.variantTraits
        .map((traitId) => getVariantTraitById(traitId))
        .filter((trait): trait is VariantTrait => trait !== null);
}
export function aggregateVariantBonuses(traits: VariantTrait[] | null | undefined): Record<string, number> {
    const merged: Record<string, number> = {};
    (Array.isArray(traits) ? traits : []).forEach((trait) => {
        const bonus = trait?.bonus ?? {};
        Object.entries(bonus).forEach(([key, value]) => {
            if (typeof value !== "number" || !Number.isFinite(value)) return;
            merged[key] = (merged[key] ?? 0) + value;
        });
    });
    return merged;
}

export function getOwnedUnitTraitCount(unitLike: UnitLike | null | undefined): number {
    return getOwnedUnitTraitEntries(unitLike).length;
}
