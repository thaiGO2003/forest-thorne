/**
 * UpgradeSystem - Unit Upgrade Management System
 *
 * Manages unit upgrade operations including detection, combination, and equipment transfer.
 * This system is independent of Phaser and uses pure functions where possible.
 */
import { tryAutoMerge } from "./AutoMerge.js";
import { mergeVariantTraitPayload } from "../core/variantTraits.js";
import { resolveUnitEquipmentSlotCap } from "../data/unitCatalog.js";
import type { Board, Bench, BoardUnit } from './BoardSystem.js';
import type { UnitReference, PlacementResult } from './UpgradeMergeRuntime.js';
import type { AutoMergeResult } from './AutoMerge.js';

const resolveEquipmentSlotCap = resolveUnitEquipmentSlotCap as unknown as (baseOrUnit: unknown, star?: number | null) => number;
export interface CatalogItem {
  id?: string;
  name?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface CatalogUnit {
  id?: string;
  tier?: number;
  [key: string]: unknown;
}

export interface EquipmentMergeResult {
  kept: string[];
  overflow: string[];
}

export interface UpgradeResult {
  success: boolean;
  error?: string;
  unit?: BoardUnit;
}

export interface UpgradeCandidate {
  baseId: string;
  star: number;
  count: number;
  refs: UnitReference[];
}

export interface CombineResult {
  success: boolean;
  error?: string;
  unit?: BoardUnit;
  equipmentTransferred?: number;
}

const MAX_STAR_LEVEL = 3;
const UNITS_REQUIRED_FOR_UPGRADE = 3;

export function getEquipmentNameKey(itemId: string, itemCatalog: Record<string, CatalogItem>): string | null {
  if (!itemCatalog) return null;
  const item = itemCatalog[itemId];
  if (!item || item.kind !== 'equipment') return null;
  const byName = String(item.name ?? '').trim().toLowerCase();
  if (byName) return byName;
  return String(item.id ?? itemId).trim().toLowerCase();
}

export function getMergeSpeciesKey(unit: BoardUnit): string {
  const raw = unit.base?.species ?? unit.base?.name ?? unit.baseId ?? 'linh-thu';
  const normalized = String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || String(unit.baseId ?? 'linh-thu');
}

export function getMergeSpeciesLabel(unit: BoardUnit): string {
  const baseName = String(unit.base?.name ?? unit.baseId ?? 'Linh thú').trim();
  return baseName.replace(/\s+\d+\s*$/u, '');
}

export function canUpgradeUnit(unit: BoardUnit | null | undefined): boolean {
  if (!unit || typeof unit.star !== 'number') return false;
  return unit.star < MAX_STAR_LEVEL;
}

export function canUpgrade(units: Array<BoardUnit | null>, baseId: string, star: number): boolean {
  if (star >= MAX_STAR_LEVEL) return false;
  const matchingUnits = units.filter((unit) => unit && unit.baseId === baseId && unit.star === star);
  return matchingUnits.length >= UNITS_REQUIRED_FOR_UPGRADE;
}

export function upgradeUnit(unit: BoardUnit | null | undefined): UpgradeResult {
  if (!unit) return { success: false, error: 'No unit provided' };
  if (!canUpgradeUnit(unit)) return { success: false, error: 'Unit cannot be upgraded (max star level reached)' };
  const upgradedUnit: BoardUnit = { ...unit, star: unit.star + 1, uid: `upgraded_${Date.now()}_${Math.random()}` };
  return { success: true, unit: upgradedUnit };
}

export function findUpgradeCandidates(board: Board, bench: Bench): UpgradeCandidate[] {
  const unitRefs: UnitReference[] = [];
  bench.forEach((unit, index) => {
    if (unit) unitRefs.push({ unit, location: 'BENCH', index });
  });
  board.forEach((row, rowIndex) => row.forEach((unit, colIndex) => {
    if (unit) unitRefs.push({ unit, location: 'BOARD', row: rowIndex, col: colIndex });
  }));
  const mergeGroups: Record<string, UnitReference[]> = {};
  unitRefs.forEach((ref) => {
    const key = `${getMergeSpeciesKey(ref.unit)}:${ref.unit.star}`;
    (mergeGroups[key] ??= []).push(ref);
  });
  const candidates: UpgradeCandidate[] = [];
  Object.entries(mergeGroups).forEach(([key, refs]) => {
    const [, starStr] = key.split(':');
    const star = parseInt(starStr, 10);
    if (star >= MAX_STAR_LEVEL || refs.length < UNITS_REQUIRED_FOR_UPGRADE) return;
    candidates.push({ baseId: refs[0].unit.baseId, star, count: refs.length, refs: refs.slice(0, UNITS_REQUIRED_FOR_UPGRADE) });
  });
  return candidates;
}

export function combineUnits(units: BoardUnit[]): CombineResult {
  if (!Array.isArray(units) || units.length !== UNITS_REQUIRED_FOR_UPGRADE) return { success: false, error: `Exactly ${UNITS_REQUIRED_FOR_UPGRADE} units required for combination` };
  const baseId = units[0].baseId;
  const star = units[0].star;
  if (!units.every((unit) => unit && unit.baseId === baseId && unit.star === star)) return { success: false, error: 'All units must have same baseId and star level' };
  if (star >= MAX_STAR_LEVEL) return { success: false, error: 'Cannot upgrade beyond star level 3' };
  const allEquipment: string[] = [];
  units.forEach((unit) => {
    if (Array.isArray(unit.equips)) allEquipment.push(...unit.equips);
  });
  const mergedTraits = mergeVariantTraitPayload(units);
  const equipmentSlotCap = resolveEquipmentSlotCap(units[0], star + 1);
  const combinedUnit: BoardUnit = { ...units[0], star: star + 1, uid: `merged_${Date.now()}_${Math.random()}`, equips: allEquipment.slice(0, equipmentSlotCap), variantTraits: mergedTraits.variantTraits, variantSeeds: mergedTraits.variantSeeds };
  return { success: true, unit: combinedUnit, equipmentTransferred: allEquipment.length };
}

export function collectMergeEquips(refs: UnitReference[], itemCatalog: Record<string, CatalogItem>): EquipmentMergeResult {
  if (!Array.isArray(refs) || !itemCatalog) return { kept: [], overflow: [] };
  const targetStar = Math.max(1, Math.min(3, Math.round(Number(refs[0]?.unit.star ?? 1) || 1) + 1));
  const equipmentSlotCap = resolveEquipmentSlotCap(refs[0]?.unit, targetStar);
  const all: string[] = [];
  refs.forEach((ref) => (Array.isArray(ref.unit.equips) ? ref.unit.equips : []).forEach((itemId) => {
    if (itemCatalog[itemId]?.kind === 'equipment') all.push(itemId);
  }));
  const seen = new Set<string>();
  const kept: string[] = [];
  const overflow: string[] = [];
  all.forEach((itemId) => {
    const key = getEquipmentNameKey(itemId, itemCatalog);
    if (!key) return;
    if (seen.has(key)) { overflow.push(itemId); return; }
    seen.add(key);
    if (kept.length < equipmentSlotCap) kept.push(itemId); else overflow.push(itemId);
  });
  return { kept, overflow };
}

import { collectOwnedUnitRefs, removeUnitRefs, placeMergedUnit } from './UpgradeMergeRuntime.js';
export { collectOwnedUnitRefs, removeUnitRefs, placeMergedUnit };
export { tryAutoMerge };

export const UpgradeSystem = {
  canUpgradeUnit, canUpgrade, upgradeUnit, findUpgradeCandidates, combineUnits, collectMergeEquips,
  getEquipmentNameKey, getMergeSpeciesKey, getMergeSpeciesLabel, collectOwnedUnitRefs, removeUnitRefs,
  placeMergedUnit, tryAutoMerge
};

export default UpgradeSystem;

