// Canonical equipment identity + planning/combat helpers (spec A6, A69, A80).
// The rebuild source currently authors only two concrete equipment ids. Their bonus payloads
// are intentionally empty until the missing recipe/item table is supplied; rules must not invent stats.
import type { UnitDef } from "../content/catalog";

export interface EquipmentBonuses {
  hpPct?: number;
  atkPct?: number;
  matkPct?: number;
  def?: number;
  mdef?: number;
  healPct?: number;
  lifestealPct?: number;
  evadePct?: number;
  critPct?: number;
  burnOnHit?: number;
  poisonOnHit?: number;
  startingShield?: number;
  startingRage?: number;
}

export interface EquipmentDef {
  id: string;
  /** Stable duplicate key. Display/localized name is resolved elsewhere. */
  nameKey: string;
  tier: number;
  unequipCost?: number;
  bonuses: EquipmentBonuses;
}

export const EQUIPMENT: readonly EquipmentDef[] = [
  { id: "eq_blue_buff", nameKey: "blue_buff", tier: 1, bonuses: {} },
  { id: "eq_warmog_armor", nameKey: "warmog_armor", tier: 2, bonuses: {} },
];

export const EQUIPMENT_BY_ID: ReadonlyMap<string, EquipmentDef> = new Map(EQUIPMENT.map((item) => [item.id, item]));

export const getEquipment = (id: string): EquipmentDef | null => EQUIPMENT_BY_ID.get(id) ?? null;
export const isEquipment = (id: string): boolean => EQUIPMENT_BY_ID.has(id);

export function equipmentSaleValue(tier: number): number {
  if (tier <= 1) return 1;
  if (tier === 2) return 4;
  return 12;
}

export function defaultUnequipCost(tier: number): number {
  if (tier <= 1) return 2;
  if (tier === 2) return 7;
  return 15;
}

export const itemUnequipCost = (item: EquipmentDef, discount = 0): number =>
  Math.max(0, Math.round(item.unequipCost ?? defaultUnequipCost(item.tier)) - Math.max(0, Math.round(discount)));

/** Star-aware slot capacity: resolved skill cost -> rageMax -> compatibility default 3. */
export function slotCapForUnit(unit: UnitDef, star: number): number {
  const index = Math.max(0, Math.min(2, Math.round(star) - 1));
  const cap = unit.skill.rageCost[index] ?? unit.stats.rageMax ?? 3;
  return Math.max(0, Math.round(cap));
}

export interface NormalizedEquipment {
  kept: string[];
  rejected: string[];
}

/** A80: reject invalid/over-tier ids, dedupe by canonical name key, then enforce slot cap. */
export function normalizeEquipment(ids: readonly string[], star: number, slotCap: number): NormalizedEquipment {
  const kept: string[] = [];
  const rejected: string[] = [];
  const names = new Set<string>();
  const legalStar = Math.max(1, Math.min(3, Math.round(star)));
  for (const id of ids) {
    const item = getEquipment(id);
    if (!item || item.tier > legalStar || names.has(item.nameKey) || kept.length >= slotCap) {
      rejected.push(id);
      continue;
    }
    names.add(item.nameKey);
    kept.push(id);
  }
  return { kept, rejected };
}

export function sumEquipmentBonuses(ids: readonly string[], star: number, slotCap: number): EquipmentBonuses {
  const out: EquipmentBonuses = {};
  const { kept } = normalizeEquipment(ids, star, slotCap);
  const keys: (keyof EquipmentBonuses)[] = [
    "hpPct", "atkPct", "matkPct", "def", "mdef", "healPct", "lifestealPct", "evadePct", "critPct",
    "burnOnHit", "poisonOnHit", "startingShield", "startingRage",
  ];
  for (const id of kept) {
    const bonuses = getEquipment(id)!.bonuses;
    for (const key of keys) {
      const value = bonuses[key];
      if (typeof value === "number" && Number.isFinite(value)) out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}

export type EquipmentCategory = "offense" | "defense" | "magic";

/** A69 recipe/equipment browsing classification. */
export function equipmentCategory(item: EquipmentDef): EquipmentCategory {
  const b = item.bonuses;
  const offense = (b.atkPct ? 2 : 0) + (b.critPct ? 1.5 : 0) + (b.lifestealPct ? 0.5 : 0);
  const defense = (b.hpPct ? 1.5 : 0) + (b.def ? 1 : 0) + (b.mdef ? 1 : 0) + (b.startingShield ? 1 : 0);
  const magic = (b.matkPct ? 2 : 0) + (b.startingRage ? 0.5 : 0) + (b.healPct ? 1 : 0) + (b.burnOnHit ? 0.5 : 0);
  if (magic > offense && magic > defense) return "magic";
  if (defense > offense) return "defense";
  return "offense";
}
