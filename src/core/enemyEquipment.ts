// Deterministic AI equipment selection (issue #40). `encounter.ts` used to leave enemy gear
// unassigned, with a note that rolls were blocked until canonical cost/pool/tier rules existed.
//
// Rules defined here, all derived from data that already exists:
// - cost    = `equipmentSaleValue(tier)` (1 / 4 / 12) — the canonical equipment value, not a new price
// - pool    = authored equipment with `tier <= maxTier` (empty pool => no gear, never a guess)
// - budget  = a fixed share of the encounter budget, so gear never competes with unit strength
// - pick    = seeded rng over the affordable pool, so the same seed always replays the same gear
import { EQUIPMENT, type EquipmentDef } from "./itemRegistry";
import { equipmentSaleValue } from "./equipment";

/** Canonical cost of one piece of equipment. */
export const equipmentCost = (tier: number): number => equipmentSaleValue(tier);

/** Share of the encounter budget the AI may spend on equipment. */
export const ENEMY_EQUIPMENT_BUDGET_SHARE = 0.25;

export function enemyEquipmentBudget(encounterBudget: number): number {
  return Math.floor(Math.max(0, Number.isFinite(encounterBudget) ? encounterBudget : 0) * ENEMY_EQUIPMENT_BUDGET_SHARE);
}

/** Highest equipment tier the AI may field: grows with the round, shifted by the difficulty profile. */
export function enemyMaxTier(round: number, maxTierBonus = 0): number {
  const base = 1 + Math.floor(Math.max(0, round) / 4) + Math.round(maxTierBonus);
  return Math.min(3, Math.max(1, base));
}

export function enemyEquipmentPool(maxTier: number): EquipmentDef[] {
  if (!Number.isFinite(maxTier) || maxTier < 1) return [];
  return EQUIPMENT.filter((item) => item.tier <= maxTier);
}

export interface EnemyEquipmentOptions {
  /** Units that receive gear, in placement order. */
  count: number;
  budget: number;
  maxTier: number;
  rng: () => number;
}

export interface EnemyEquipmentResult {
  /** One equipment list per unit, index-aligned with the encounter placements. */
  assignments: string[][];
  /** Gold-equivalent actually spent (always <= budget). */
  spent: number;
  poolSize: number;
}

/**
 * Assign equipment to `count` enemy units without exceeding `budget`.
 * Deterministic for a given rng; returns empty assignments when the pool or budget is unusable.
 */
export function assignEnemyEquipment(options: EnemyEquipmentOptions): EnemyEquipmentResult {
  const count = Math.max(0, Math.floor(options.count));
  const pool = enemyEquipmentPool(options.maxTier);
  const assignments: string[][] = Array.from({ length: count }, () => []);
  const cap = Math.max(0, Math.floor(Number.isFinite(options.budget) ? options.budget : 0));
  if (!count || !pool.length || cap <= 0) return { assignments, spent: 0, poolSize: pool.length };

  let spent = 0;
  for (let unit = 0; unit < count; unit++) {
    const affordable = pool.filter((item) => equipmentCost(item.tier) <= cap - spent);
    if (!affordable.length) break;
    const pick = affordable[Math.min(affordable.length - 1, Math.floor(options.rng() * affordable.length))]!;
    assignments[unit]!.push(pick.id);
    spent += equipmentCost(pick.tier);
  }
  return { assignments, spent, poolSize: pool.length };
}
