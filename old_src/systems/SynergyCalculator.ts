import { CLASS_SYNERGY, ELEMENT_SYNERGY, FACTION_SYNERGY } from "../data/synergies.js";

export interface SynergyUnit {
    classType?: string;
    element?: string;
    tribe?: string;
    faction?: string;
    base?: SynergyUnit;
}

export interface SynergyBonus {
    [key: string]: number;
}

export interface SynergyDefinition {
    thresholds: number[];
    bonuses: SynergyBonus[];
}

export interface ActiveSynergy {
    type: 'class' | 'element' | 'faction';
    key: string;
    count: number;
    tier: number;
    threshold: number;
    bonuses: SynergyBonus;
}

export interface SynergyCalculationResult {
    classCounts: Record<string, number>;
    elementCounts: Record<string, number>;
    factionCounts: Record<string, number>;
    tribeCounts: Record<string, number>;
    activeSynergies: ActiveSynergy[];
}

const classDefinitions = CLASS_SYNERGY as Record<string, SynergyDefinition>;
const elementDefinitions = ELEMENT_SYNERGY as Record<string, SynergyDefinition>;
const factionDefinitions = FACTION_SYNERGY as Record<string, SynergyDefinition>;

function normalizeSynergyKey(value: unknown): string | null {
    const key = typeof value === "string" ? value.trim() : value;
    if (typeof key !== "string" || !key || key === "undefined" || key === "null") return null;
    return key;
}

function findActiveTier(definition: SynergyDefinition, count: number): number {
    let activeTier = -1;
    for (let i = 0; i < definition.thresholds.length; i++) {
        if (count >= definition.thresholds[i]) activeTier = i;
    }
    return activeTier;
}

function appendActiveSynergies(
    counts: Record<string, number>,
    definitions: Record<string, SynergyDefinition>,
    type: ActiveSynergy['type'],
    activeSynergies: ActiveSynergy[]
): void {
    Object.entries(counts).forEach(([key, count]) => {
        const definition = definitions[key];
        if (!definition) return;
        const tier = findActiveTier(definition, count);
        if (tier < 0) return;
        activeSynergies.push({
            type,
            key,
            count,
            tier,
            threshold: definition.thresholds[tier],
            bonuses: definition.bonuses[tier]
        });
    });
}

export function calculateSynergies(units: SynergyUnit[]): SynergyCalculationResult {
    const classCounts: Record<string, number> = {};
    const elementCounts: Record<string, number> = {};
    const factionCounts: Record<string, number> = {};

    units.forEach((unit) => {
        const classType = normalizeSynergyKey(unit?.classType ?? unit?.base?.classType);
        const element = normalizeSynergyKey(unit?.element ?? unit?.tribe ?? unit?.base?.element ?? unit?.base?.tribe);
        const faction = normalizeSynergyKey(unit?.faction ?? unit?.base?.faction);
        if (classType) classCounts[classType] = (classCounts[classType] ?? 0) + 1;
        if (element) elementCounts[element] = (elementCounts[element] ?? 0) + 1;
        if (faction) factionCounts[faction] = (factionCounts[faction] ?? 0) + 1;
    });

    const activeSynergies: ActiveSynergy[] = [];
    appendActiveSynergies(classCounts, classDefinitions, 'class', activeSynergies);
    appendActiveSynergies(elementCounts, elementDefinitions, 'element', activeSynergies);
    appendActiveSynergies(factionCounts, factionDefinitions, 'faction', activeSynergies);

    return { classCounts, elementCounts, factionCounts, tribeCounts: elementCounts, activeSynergies };
}
