/**
 * SynergySystem - Synergy Management System
 *
 * Manages synergy calculation and application for team compositions.
 * This system is independent of Phaser and uses pure functions.
 */

import { CLASS_SYNERGY, ELEMENT_SYNERGY, FACTION_SYNERGY, TRIBE_SYNERGY } from "../data/synergies.js";
import { getClassLabelVi, getTribeLabelVi } from "../data/unitVisuals.js";
import { getFactionLabelVi } from "../data/factionInfo.js";

export interface SynergyBonus {
  [key: string]: number;
}

export interface SynergyDefinition {
  thresholds: number[];
  bonuses: SynergyBonus[];
}

export interface SynergyMods {
  healPct?: number;
  lifestealPct?: number;
  evadePct?: number;
  shieldStart?: number;
  startingRage?: number;
  critPct?: number;
  burnOnHit?: number;
  poisonOnHit?: number;
  [key: string]: number | undefined;
}

export interface SynergyUnit {
  classType?: string;
  element?: string;
  tribe?: string;
  faction?: string;
  hp?: number;
  maxHp?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  rage?: number;
  rageMax?: number;
  shield?: number;
  mods?: SynergyMods;
  base?: SynergyUnit;
  [key: string]: unknown;
}

export interface SynergyCounts {
  classCounts: Record<string, number>;
  elementCounts: Record<string, number>;
  factionCounts: Record<string, number>;
  tribeCounts: Record<string, number>;
}

export interface SynergyOptions {
  extraClassCount?: number;
  extraTribeCount?: number;
  extraElementCount?: number;
  extraFactionCount?: number;
}

export interface ActiveSynergy {
  type: 'class' | 'element' | 'faction';
  key: string;
  count: number;
  tier: number;
  threshold: number;
  bonuses: SynergyBonus;
  description?: string;
  icon?: string;
}

const classDefinitions = CLASS_SYNERGY as Record<string, SynergyDefinition>;
const elementDefinitions = ELEMENT_SYNERGY as Record<string, SynergyDefinition>;
const factionDefinitions = FACTION_SYNERGY as Record<string, SynergyDefinition>;
const tribeDefinitions = TRIBE_SYNERGY as Record<string, SynergyDefinition>;

function normalizeSynergyKey(value: unknown): string | null {
  const key = typeof value === "string" ? value.trim() : value;
  if (typeof key !== "string" || !key || key === "undefined" || key === "null") return null;
  return key;
}

export function calculateSynergies(units: SynergyUnit[], side = "LEFT", options: SynergyOptions = {}): SynergyCounts {
  const { extraClassCount = 0, extraTribeCount = 0, extraElementCount, extraFactionCount = 0 } = options;
  const resolvedExtraElementCount = extraElementCount ?? extraTribeCount;
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
  if (side === "LEFT" && units.length > 0) {
    if (extraClassCount > 0) {
      const topClass = Object.keys(classCounts).sort((a, b) => classCounts[b] - classCounts[a])[0];
      if (topClass) classCounts[topClass] += extraClassCount;
    }
    if (resolvedExtraElementCount > 0) {
      const topElement = Object.keys(elementCounts).sort((a, b) => elementCounts[b] - elementCounts[a])[0];
      if (topElement) elementCounts[topElement] += resolvedExtraElementCount;
    }
    if (extraFactionCount > 0) {
      const topFaction = Object.keys(factionCounts).sort((a, b) => factionCounts[b] - factionCounts[a])[0];
      if (topFaction) factionCounts[topFaction] += extraFactionCount;
    }
  }
  return { classCounts, elementCounts, factionCounts, tribeCounts: elementCounts };
}

export function getSynergyBonus(synergyDef: SynergyDefinition | null | undefined, count: number): SynergyBonus | null {
  if (!synergyDef || !synergyDef.thresholds || !synergyDef.bonuses) return null;
  let bonus: SynergyBonus | null = null;
  for (let i = 0; i < synergyDef.thresholds.length; i += 1) {
    if (count >= synergyDef.thresholds[i]) bonus = synergyDef.bonuses[i];
  }
  return bonus;
}

export function getSynergyTier(count: number, thresholds: number[] | null | undefined): number {
  if (!Array.isArray(thresholds)) return -1;
  let idx = -1;
  for (let i = 0; i < thresholds.length; i += 1) if (count >= thresholds[i]) idx = i;
  return idx;
}

export function applySynergiesToUnit(unit: SynergyUnit | null | undefined, synergyCounts: SynergyCounts | null | undefined): void {
  if (!unit || !synergyCounts) return;
  const { classCounts, elementCounts, factionCounts, tribeCounts } = synergyCounts;
  const resolvedElementCounts = elementCounts ?? tribeCounts ?? {};
  const classType = unit.classType;
  if (classType && classCounts[classType]) {
    const bonus = getSynergyBonus(classDefinitions[classType], classCounts[classType]);
    if (bonus) applyBonusToUnit(unit, bonus);
  }
  const element = unit.element ?? unit.tribe;
  if (element && resolvedElementCounts[element]) {
    const bonus = getSynergyBonus(elementDefinitions[element], resolvedElementCounts[element]);
    if (bonus) applyBonusToUnit(unit, bonus);
  }
  const faction = unit.faction;
  if (faction && factionCounts?.[faction]) {
    const bonus = getSynergyBonus(factionDefinitions[faction], factionCounts[faction]);
    if (bonus) applyBonusToUnit(unit, bonus);
  }
}

function applyBonusToUnit(unit: SynergyUnit, bonus: SynergyBonus): void {
  if (!unit.mods) unit.mods = {};
  Object.keys(bonus).forEach((key) => {
    const value = bonus[key];
    if (typeof value !== "number") return;
    unit.mods![key] = typeof unit.mods![key] === "number" ? unit.mods![key]! + value : value;
  });
}

export function applyBonusToCombatUnit(unit: SynergyUnit | null | undefined, bonus: SynergyBonus | null | undefined): void {
  if (!unit || !bonus) return;
  const hpPct = bonus.hpPct ?? bonus.teamHpPct ?? 0;
  const atkPct = bonus.atkPct ?? bonus.teamAtkPct ?? 0;
  const matkPct = bonus.matkPct ?? bonus.teamMatkPct ?? 0;
  if (bonus.defFlat && unit.def !== undefined) unit.def += bonus.defFlat;
  if (bonus.mdefFlat && unit.mdef !== undefined) unit.mdef += bonus.mdefFlat;
  if (hpPct && unit.maxHp !== undefined && unit.hp !== undefined) {
    const add = Math.round(unit.maxHp * hpPct);
    unit.maxHp += add;
    unit.hp += add;
  }
  if (atkPct && unit.atk !== undefined) unit.atk = Math.round(unit.atk * (1 + atkPct));
  if (matkPct && unit.matk !== undefined) unit.matk = Math.round(unit.matk * (1 + matkPct));
  if (!unit.mods) unit.mods = {};
  const modKeys: Array<keyof SynergyMods> = ['healPct', 'lifestealPct', 'evadePct', 'shieldStart', 'startingRage', 'critPct', 'burnOnHit', 'poisonOnHit'];
  modKeys.forEach((key) => {
    const value = bonus[key];
    if (typeof value === 'number') unit.mods![key] = (unit.mods![key] ?? 0) + value;
  });
}

export function applySynergyBonusesToTeam(units: SynergyUnit[], side = "LEFT", options: SynergyOptions = {}): void {
  if (!Array.isArray(units)) return;
  const { classCounts, elementCounts, factionCounts } = calculateSynergies(units, side, options);
  units.forEach((unit) => {
    const classType = unit.classType;
    if (classType && classCounts[classType]) {
      const bonus = getSynergyBonus(classDefinitions[classType], classCounts[classType]);
      if (bonus) applyBonusToCombatUnit(unit, bonus);
    }
    const element = unit.element ?? unit.tribe;
    if (element && elementCounts[element]) {
      const bonus = getSynergyBonus(elementDefinitions[element], elementCounts[element]);
      if (bonus) applyBonusToCombatUnit(unit, bonus);
    }
    const faction = unit.faction;
    if (faction && factionCounts[faction]) {
      const bonus = getSynergyBonus(factionDefinitions[faction], factionCounts[faction]);
      if (bonus) applyBonusToCombatUnit(unit, bonus);
    }
    if (unit.mods) {
      if (unit.mods.startingRage && unit.rage !== undefined) unit.rage = Math.min(unit.rageMax || 100, unit.rage + Math.min(4, unit.mods.startingRage));
      if (unit.mods.shieldStart) unit.shield = (unit.shield || 0) + unit.mods.shieldStart;
    }
  });
}

export function getSynergyDescription(synergyId: string, level: number, type = "class"): string {
  const synergyDef = type === "class" ? classDefinitions[synergyId] : type === "faction" ? factionDefinitions[synergyId] : elementDefinitions[synergyId];
  if (!synergyDef || level < 0 || level >= synergyDef.bonuses.length) return "";
  const bonus = synergyDef.bonuses[level];
  const threshold = synergyDef.thresholds[level];
  const label = type === "class" ? getClassLabelVi(synergyId) : type === "faction" ? getFactionLabelVi(synergyId) : getTribeLabelVi(synergyId);
  return `${label} (${threshold}): ${formatBonusSet(bonus)}`;
}

export function getSynergyIcon(synergyId: string, type = "class"): string {
  const classIcons: Record<string, string> = { TANKER: "🛡️", ASSASSIN: "🗡️", ARCHER: "🏹", MAGE: "🔮", SUPPORT: "💚", FIGHTER: "⚔️" };
  const tribeIcons: Record<string, string> = { FIRE: "🔥", SPIRIT: "👻", TIDE: "🌊", STONE: "🪨", WIND: "💨", NIGHT: "🌙", SWARM: "🐝", WOOD: "🌲" };
  const factionIcons: Record<string, string> = { BEAST: "🐾", AVIAN: "🦅", INSECT: "🐛", REPTILE: "🦎", AQUATIC: "🌊", MYTHICAL: "✨" };
  if (type === "class") return classIcons[synergyId] ?? "◎";
  if (type === "faction") return factionIcons[synergyId] ?? "◎";
  return tribeIcons[synergyId] ?? "◎";
}

function formatBonusSet(bonus: SynergyBonus | null | undefined): string {
  if (!bonus || typeof bonus !== "object") return "";
  const parts: string[] = [];
  if (bonus.defFlat) parts.push(`+${bonus.defFlat} Giáp`);
  if (bonus.mdefFlat) parts.push(`+${bonus.mdefFlat} Kháng phép`);
  if (bonus.hpPct) parts.push(`+${Math.round(bonus.hpPct * 100)}% HP`);
  if (bonus.atkPct) parts.push(`+${Math.round(bonus.atkPct * 100)}% Tấn công`);
  if (bonus.matkPct) parts.push(`+${Math.round(bonus.matkPct * 100)}% Phép thuật`);
  if (bonus.healPct) parts.push(`+${Math.round(bonus.healPct * 100)}% Hồi máu`);
  if (bonus.evadePct) parts.push(`+${Math.round(bonus.evadePct * 100)}% Né tránh`);
  if (bonus.critPct) parts.push(`+${Math.round(bonus.critPct * 100)}% Chí mạng`);
  if (bonus.lifestealPct) parts.push(`+${Math.round(bonus.lifestealPct * 100)}% Hút máu`);
  if (bonus.shieldStart) parts.push(`+${bonus.shieldStart} Khiên ban đầu`);
  if (bonus.startingRage) parts.push(`+${bonus.startingRage} Nộ ban đầu`);
  if (bonus.poisonOnHit) parts.push(`Độc ${bonus.poisonOnHit}/lượt khi đánh`);
  if (bonus.burnOnHit) parts.push(`Cháy ${bonus.burnOnHit}/lượt khi đánh`);
  return parts.join(", ") || "Không có bonus";
}

export { formatBonusSet };

export function getActiveSynergies(units: SynergyUnit[], side = "LEFT", options: SynergyOptions = {}): ActiveSynergy[] {
  const { classCounts, elementCounts, factionCounts } = calculateSynergies(units, side, options);
  const activeSynergies: ActiveSynergy[] = [];
  const append = (counts: Record<string, number>, definitions: Record<string, SynergyDefinition>, type: ActiveSynergy['type']): void => {
    Object.entries(counts).forEach(([key, count]) => {
      const def = definitions[key];
      if (!def) return;
      const tier = getSynergyTier(count, def.thresholds);
      if (tier >= 0) activeSynergies.push({ type, key, count, tier, threshold: def.thresholds[tier], bonuses: def.bonuses[tier], description: getSynergyDescription(key, tier, type), icon: getSynergyIcon(key, type) });
    });
  };
  append(classCounts, classDefinitions, "class");
  append(elementCounts, elementDefinitions, "element");
  append(factionCounts, factionDefinitions, "faction");
  return activeSynergies;
}

export function getClassSynergyDef(classType: string): SynergyDefinition | null { return classDefinitions[classType] || null; }
export function getTribeSynergyDef(tribe: string): SynergyDefinition | null { return tribeDefinitions[tribe] || null; }

export const SynergySystem = {
  calculateSynergies, getActiveSynergies, getSynergyBonus, getSynergyTier,
  applySynergiesToUnit, applyBonusToCombatUnit, applySynergyBonusesToTeam,
  getSynergyDescription, getSynergyIcon, formatBonusSet, getClassSynergyDef, getTribeSynergyDef
};

export default SynergySystem;
