export interface ShopRosterUnit {
  id: string;
  tier?: number;
  classType?: string;
  [key: string]: unknown;
}
export type ShopRosterUnitMap = Record<string, ShopRosterUnit>;

import { UNIT_CATALOG, UNIT_BY_ID } from "./unitCatalog.js";

const SHOP_CLASS_ORDER = Object.freeze([
  "ARCHER",
  "ASSASSIN",
  "FIGHTER",
  "MAGE",
  "SUPPORT",
  "TANKER"
]);

function compareShopRosterUnits(left: ShopRosterUnit, right: ShopRosterUnit): number {
  const tierDelta = (Number(left?.tier ?? 0) || 0) - (Number(right?.tier ?? 0) || 0);
  if (tierDelta !== 0) return tierDelta;

  const classDelta = SHOP_CLASS_ORDER.indexOf(left?.classType ?? "") - SHOP_CLASS_ORDER.indexOf(right?.classType ?? "");
  if (classDelta !== 0) return classDelta;

  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}
export const SHOP_ROSTER_UNIT_IDS: readonly string[] = Object.freeze(
  [...(UNIT_CATALOG as unknown as readonly ShopRosterUnit[])]
    .sort(compareShopRosterUnits)
    .map((unit) => unit.id)
);

const SHOP_ROSTER_UNIT_ID_SET = new Set<string>(SHOP_ROSTER_UNIT_IDS);
const SHOP_ROSTER: readonly ShopRosterUnit[] = Object.freeze(
  SHOP_ROSTER_UNIT_IDS
    .map((id) => (UNIT_BY_ID as unknown as ShopRosterUnitMap)[id])
    .filter((unit): unit is ShopRosterUnit => Boolean(unit))
);
export function getShopRoster(): readonly ShopRosterUnit[] {
  return SHOP_ROSTER;
}

export function getShopRosterForTier(tier: number): readonly ShopRosterUnit[] {
  return SHOP_ROSTER.filter((unit) => unit.tier === tier);
}

export function isShopRosterUnit(unitOrId: string | Pick<ShopRosterUnit, "id"> | null | undefined): boolean {
  const baseId = typeof unitOrId === "string" ? unitOrId : unitOrId?.id;
  return baseId ? SHOP_ROSTER_UNIT_ID_SET.has(baseId) : false;
}

export function filterShopRosterUnits(
  units: readonly (ShopRosterUnit | string | null | undefined)[]
): ShopRosterUnit[] {
  if (!Array.isArray(units)) return [];
  return units.filter((unit): unit is ShopRosterUnit =>
    typeof unit === "object" && unit !== null && isShopRosterUnit(unit)
  );
}
