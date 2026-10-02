// Creative sandbox persistent unit model (spec A46). No rendering or input code lives here.
import { getUnit, UNIT_BY_ID } from "../content/catalog";
import { equipmentSaleValue, getEquipment, normalizeEquipment, slotCapForUnit } from "./equipment";
import type { Placement } from "./combat";
import type { OwnedUnit } from "./run";
import { normalizeVariantTraits, type VariantTraitRef } from "./variants";

export type SandboxSide = "LEFT" | "RIGHT";

export interface CreativeSandboxUnit extends OwnedUnit {
  sandbox: true;
  sourceUid: string | null;
  side: SandboxSide;
  row: number;
  col: number;
}

export const SANDBOX_ROWS = 5;
export const SANDBOX_COLS = 10;
export const RIGHT_COL_START = 5;

export const sandboxSideForCol = (col: number): SandboxSide => col >= RIGHT_COL_START ? "RIGHT" : "LEFT";
export const validSandboxCell = (row: number, col: number): boolean =>
  Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < SANDBOX_ROWS && col >= 0 && col < SANDBOX_COLS;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function normalizeCreativeSandboxUnits(value: unknown): CreativeSandboxUnit[] {
  if (!Array.isArray(value)) return [];
  const out: CreativeSandboxUnit[] = [];
  const occupied = new Set<string>();
  for (const entry of value) {
    const raw = record(entry);
    if (!raw || typeof raw.uid !== "string" || typeof raw.baseId !== "string" || !UNIT_BY_ID.has(raw.baseId)) continue;
    const def = getUnit(raw.baseId);
    const star = Math.min(3, Math.max(1, Math.round(Number(raw.star) || 1))) as 1 | 2 | 3;
    const side: SandboxSide = raw.side === "RIGHT" ? "RIGHT" : "LEFT";
    const row = Math.min(4, Math.max(0, Math.floor(Number(raw.row) || 0)));
    const rawCol = Math.floor(Number(raw.col) || 0);
    const col = side === "RIGHT"
      ? Math.min(9, Math.max(5, rawCol))
      : Math.min(4, Math.max(0, rawCol));
    const cell = `${row}:${col}`;
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    const rawEquips = Array.isArray(raw.equips) ? raw.equips.filter((id): id is string => typeof id === "string") : [];
    const equips = normalizeEquipment(rawEquips, star, slotCapForUnit(def, star)).kept;
    const rawTraits: VariantTraitRef[] = Array.isArray(raw.traits)
      ? raw.traits.flatMap((trait) => {
        const item = record(trait);
        return item && typeof item.id === "string" ? [{ id: item.id, seed: Number(item.seed) }] : [];
      })
      : [];
    out.push({
      uid: raw.uid,
      baseId: raw.baseId,
      star,
      equips,
      traits: normalizeVariantTraits(def.role, rawTraits),
      sandbox: true,
      sourceUid: typeof raw.sourceUid === "string" ? raw.sourceUid : null,
      side,
      row,
      col,
    });
  }
  return out;
}

export function cloneSandboxUnit(
  source: OwnedUnit, uid: string, row: number, col: number,
): CreativeSandboxUnit | null {
  if (!validSandboxCell(row, col) || !UNIT_BY_ID.has(source.baseId)) return null;
  const def = getUnit(source.baseId);
  const star = Math.min(3, Math.max(1, source.star)) as 1 | 2 | 3;
  return {
    uid,
    baseId: source.baseId,
    star,
    equips: normalizeEquipment(source.equips, star, slotCapForUnit(def, star)).kept,
    traits: normalizeVariantTraits(def.role, source.traits ?? []),
    sandbox: true,
    sourceUid: source.uid,
    side: sandboxSideForCol(col),
    row,
    col,
  };
}

const starSellMultiplier = (star: number): number => star >= 3 ? 5 : star === 2 ? 3 : 1;

export function creativeSandboxSaleValue(unit: CreativeSandboxUnit): number {
  const base = getUnit(unit.baseId).tier * starSellMultiplier(unit.star);
  const equipment = unit.equips.reduce((sum, id) => {
    const item = getEquipment(id);
    return sum + (item ? equipmentSaleValue(item.tier) : 0);
  }, 0);
  return Math.max(1, base + equipment);
}

export interface SandboxMergeResult {
  units: CreativeSandboxUnit[];
  overflow: string[];
  merges: number;
}

/** A46 sandbox merge: exact baseId+star+side, first source owns position/source chain, cascade allowed. */
export function mergeCreativeSandboxUnits(
  input: readonly CreativeSandboxUnit[], uidFactory: () => string,
): SandboxMergeResult {
  let units: CreativeSandboxUnit[] = input.map((unit) => ({
    ...unit,
    equips: [...unit.equips],
    traits: [...(unit.traits ?? [])],
  }));
  const overflow: string[] = [];
  let merges = 0;
  for (;;) {
    const groups = new Map<string, number[]>();
    let picked: number[] | null = null;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      if (unit.star >= 3) continue;
      const key = `${unit.side}|${unit.baseId}|${unit.star}`;
      const refs = groups.get(key) ?? [];
      refs.push(i);
      groups.set(key, refs);
      if (refs.length === 3) { picked = refs; break; }
    }
    if (!picked) break;
    const sources = picked.map((index) => units[index]!);
    const first = sources[0]!;
    const star = (first.star + 1) as 2 | 3;
    const def = getUnit(first.baseId);
    const normalized = normalizeEquipment(sources.flatMap((unit) => unit.equips), star, slotCapForUnit(def, star));
    overflow.push(...normalized.rejected.filter((id) => getEquipment(id) !== null));
    const traits = sources.flatMap((unit) => normalizeVariantTraits(def.role, unit.traits ?? [])).slice(0, 9);
    const merged: CreativeSandboxUnit = {
      uid: uidFactory(), baseId: first.baseId, star, equips: normalized.kept, traits,
      sandbox: true, sourceUid: first.sourceUid, side: first.side, row: first.row, col: first.col,
    };
    const removed = new Set(picked);
    units = units.filter((_, index) => !removed.has(index));
    units.push(merged);
    merges++;
  }
  return { units, overflow, merges };
}

/** Presence of RIGHT sandbox units is authoritative enemy override; null means use normal encounter source. */
export function creativeRightEnemyOverride(units: readonly CreativeSandboxUnit[]): Placement[] | null {
  const right = units.filter((unit) => unit.side === "RIGHT");
  if (!right.length) return null;
  return right.map((unit) => ({
    uid: unit.uid,
    baseId: unit.baseId,
    star: unit.star,
    row: unit.row,
    col: unit.col,
    equips: [...unit.equips],
    traits: [...(unit.traits ?? [])],
  }));
}
