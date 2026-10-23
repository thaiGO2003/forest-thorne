/**
 * AutoMerge - Automatic Unit Merge Logic
 *
 * Extracted from UpgradeSystem to keep file sizes manageable.
 */

import { mergeVariantTraitPayload } from "../core/variantTraits.js";
import {
  getMergeSpeciesKey,
  collectOwnedUnitRefs,
  collectMergeEquips,
  removeUnitRefs,
  placeMergedUnit
} from "./UpgradeSystem.js";
import type { Board, Bench, BoardUnit } from './BoardSystem.js';
import type { UnitReference } from './UpgradeMergeRuntime.js';

interface CatalogUnit {
  tier?: number;
  [key: string]: unknown;
}

interface CatalogItem {
  kind?: string;
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface MergedTraitPayload {
  variantTraits: string[];
  variantSeeds: number[];
}

export interface AutoMergeLogEntry {
  baseId: string;
  fromStar: number;
  toStar: number;
  equipCount: number;
  equipOverflow: number;
  overflowItems: string[];
  traitCount: number;
}

export interface AutoMergeResult {
  mergeCount: number;
  log: AutoMergeLogEntry[];
}

type CreateUnitFn = (
  baseId: string,
  star: number,
  equips: string[],
  traits: MergedTraitPayload
) => BoardUnit | null | undefined;

const MAX_STAR_LEVEL = 3;

export function tryAutoMerge(
  board: Board,
  bench: Bench,
  itemCatalog: Record<string, CatalogItem>,
  unitCatalog: Record<string, CatalogUnit>,
  createUnitFn: CreateUnitFn
): AutoMergeResult {
  const mergeLog: AutoMergeLogEntry[] = [];
  let totalMerges = 0;
  let merged = true;

  while (merged) {
    merged = false;
    const refs: UnitReference[] = collectOwnedUnitRefs(board, bench);
    const groups = new Map<string, UnitReference[]>();
    refs.forEach((ref) => {
      const key = `${getMergeSpeciesKey(ref.unit)}:${ref.unit.star}`;
      const group = groups.get(key);
      if (group) group.push(ref);
      else groups.set(key, [ref]);
    });

    for (const group of groups.values()) {
      if (group.length < 3) continue;
      const picked = group.slice(0, 3);
      const star = picked[0].unit.star;
      if (star >= MAX_STAR_LEVEL) continue;
      const baseId = picked
        .map((ref) => ref.unit.baseId)
        .sort((a, b) => (unitCatalog[b]?.tier ?? 0) - (unitCatalog[a]?.tier ?? 0))[0];
      const mergedEquip = collectMergeEquips(picked, itemCatalog);
      const mergedTraits: MergedTraitPayload = mergeVariantTraitPayload(picked.map((ref) => ref.unit));
      removeUnitRefs(board, bench, picked);
      const upgraded = createUnitFn(
        baseId,
        Math.min(MAX_STAR_LEVEL, star + 1),
        mergedEquip.kept,
        mergedTraits
      );
      if (!upgraded) continue;
      placeMergedUnit(board, bench, upgraded, picked);
      mergeLog.push({
        baseId,
        fromStar: star,
        toStar: star + 1,
        equipCount: mergedEquip.kept.length,
        equipOverflow: mergedEquip.overflow.length,
        overflowItems: mergedEquip.overflow,
        traitCount: mergedTraits.variantTraits.length
      });
      totalMerges++;
      merged = true;
      break;
    }
  }
  return { mergeCount: totalMerges, log: mergeLog };
}
