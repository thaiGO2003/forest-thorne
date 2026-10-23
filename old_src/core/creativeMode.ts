import { CREATIVE_AI_MODE, CREATIVE_GOLD_LABEL, hasManualEnemySandboxUnits as hasManualEnemySandboxUnitsBase } from "./aiModes.js";

export function isCreativeMode(aiMode: string): boolean {
  return aiMode === CREATIVE_AI_MODE;
}

export function hasCreativeInfiniteGold(aiMode: string): boolean {
  return isCreativeMode(aiMode);
}

export function getCreativeGoldLabel(): string {
  return CREATIVE_GOLD_LABEL;
}

export function getDisplayedGold(aiMode: string, gold: number): number | string {
  return hasCreativeInfiniteGold(aiMode) ? CREATIVE_GOLD_LABEL : gold;
}

export function canAffordWithCreative(aiMode: string, gold: number, cost: number): boolean {
  if (hasCreativeInfiniteGold(aiMode)) return true;
  return gold >= cost;
}

export function spendGoldWithCreative(player: { gold?: number } | null, aiMode: string, cost: number): number {
  if (!player || !Number.isFinite(cost) || cost <= 0) return 0;
  if (hasCreativeInfiniteGold(aiMode)) return 0;
  player.gold = Math.max(0, (player.gold ?? 0) - cost);
  return cost;
}

export function gainGoldWithCreative(player: { gold?: number } | null, aiMode: string, amount: number, options: { allowCreativeMutation?: boolean } = {}): number {
  if (!player || !Number.isFinite(amount) || amount === 0) return 0;
  const { allowCreativeMutation = false } = options;
  if (hasCreativeInfiniteGold(aiMode) && !allowCreativeMutation) return 0;
  player.gold = Math.max(0, (player.gold ?? 0) + amount);
  return amount;
}

interface CreativeSandboxUnitLike {
  baseId?: unknown;
  star?: number;
  variantTraits?: unknown;
  variantSeeds?: unknown;
  equips?: unknown[];
  uid?: string;
  side?: string;
  row?: number;
  col?: number;
  sourceUid?: string | null;
}

export function normalizeCreativeSandboxUnit(raw: Record<string, unknown>, normalizeOwnedUnit: (u: unknown) => Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw || typeof normalizeOwnedUnit !== "function") return null;
  const unit = normalizeOwnedUnit(raw);
  if (!unit) return null;
  const side = raw["side"] === "RIGHT" ? "RIGHT" : "LEFT";
  const row = Number.isInteger(raw["row"]) ? raw["row"] as number : 0;
  const col = Number.isInteger(raw["col"]) ? raw["col"] as number : 0;
  const sourceUid = typeof raw["sourceUid"] === "string" ? raw["sourceUid"] as string : null;
  return {
    ...unit,
    side,
    row,
    col,
    sandbox: true,
    sourceUid
  };
}

export function createCreativeSandboxClone(sourceUnit: CreativeSandboxUnitLike, createOwnedUnit: (baseId: string, star: number, variant: unknown, equips: unknown, opts: Record<string, unknown>) => Record<string, unknown> | null, overrides: { side?: string; row?: number; col?: number } = {}): Record<string, unknown> | null {
  if (!sourceUnit || typeof createOwnedUnit !== "function") return null;
  const baseId = typeof sourceUnit.baseId === "string" ? sourceUnit.baseId : "";
  const clone = createOwnedUnit(baseId, sourceUnit.star ?? 1, null, sourceUnit.equips ?? [], {
    variantTraits: sourceUnit.variantTraits,
    variantSeeds: sourceUnit.variantSeeds,
    rollTrait: false
  });
  if (!clone) return null;
  const side = overrides.side === "RIGHT" ? "RIGHT" : "LEFT";
  const row = Number.isInteger(overrides.row) ? overrides.row : 0;
  const col = Number.isInteger(overrides.col) ? overrides.col : 0;
  return {
    ...clone,
    sandbox: true,
    sourceUid: sourceUnit.uid ?? null,
    side,
    row,
    col
  };
}
function hasSide(unit: unknown): unit is { side?: string } {
  return typeof unit === "object" && unit !== null;
}

export function getCreativeSandboxUnits(player: { creativeSandboxUnits?: unknown[] | null } | null, side: string | null = null): unknown[] {
  const units = Array.isArray(player?.creativeSandboxUnits) ? player.creativeSandboxUnits : [];
  if (!side) return units;
  return units.filter((unit) => hasSide(unit) && unit.side === side);
}

export function hasManualEnemySandboxUnits(player: { creativeSandboxUnits?: Array<{ side?: string }> | null } | null): boolean {
  return hasManualEnemySandboxUnitsBase(player as Parameters<typeof hasManualEnemySandboxUnitsBase>[0]);
}

export function removeCreativeSandboxUnit(player: { creativeSandboxUnits?: unknown[] | null } | null, uid: string): boolean {
  if (!player || !Array.isArray(player.creativeSandboxUnits) || !uid) return false;
  const index = player.creativeSandboxUnits.findIndex((unit) => hasSide(unit) && (unit as { uid?: string }).uid === uid);
  if (index < 0) return false;
  player.creativeSandboxUnits.splice(index, 1);
  return true;
}
