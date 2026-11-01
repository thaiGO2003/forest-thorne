// Classic item/recipe DB ported by scripts/port-old-items.mjs from the old homeserver checkout.
// Each entry is one authored recipe (1×1..3×3) and also the crafted equipment identity.
import raw from "./items.json";
import type { Recipe } from "../core/craft";
import type { EquipmentBonuses, EquipmentDef } from "../core/equipment";

export interface ItemDef {
  id: string;
  nameVi: string;
  icon: string;
  tier: number;
  size: 1 | 2 | 3;
  pattern: (string | null)[];
  /** Rebuild percentage-point bonuses (old fractions were converted by the port script). */
  bonuses: EquipmentBonuses;
  descriptionVi: string;
  /** Authored old-src trigger payload, retained verbatim; the current combat engine does not run it. */
  logic?: Record<string, unknown>;
}

export const ITEMS = raw as ItemDef[];
export const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((item) => [item.id, item]));

export const ITEM_EQUIPMENT: EquipmentDef[] = ITEMS.map((item) => ({
  id: `eq_${item.id}`,
  nameKey: item.id,
  tier: item.tier,
  bonuses: item.bonuses,
  nameVi: item.nameVi,
  icon: item.icon,
  descriptionVi: item.descriptionVi,
  logic: item.logic,
}));

export const ITEM_RECIPES: Recipe[] = ITEMS.map((item) => ({
  id: item.id,
  size: item.size,
  pattern: item.pattern,
}));
