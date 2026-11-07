import { ITEM_BY_ID, canEquipItemByStarLevel } from "../../data/items.js";
import type { EquipmentItem, ItemBonus } from "../../data/items.js";
import { resolveUnitEquipmentSlotCap } from "../../data/unitCatalog.js";
import { UpgradeSystem } from "../../systems/UpgradeSystem.js";
import type { CatalogItem } from "../../systems/UpgradeSystem.js";

export function getEquipmentNameKey(itemId: string): string | null {
  return UpgradeSystem.getEquipmentNameKey(itemId, ITEM_BY_ID as unknown as Record<string, CatalogItem>);
}

export function normalizeEquipIds(equips: unknown, unit: unknown = null): string[] {
  if (!Array.isArray(equips)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  equips.forEach((itemId) => {
    if (typeof itemId !== "string") return;
    const key = getEquipmentNameKey(itemId);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(itemId);
  });
  return out.slice(0, resolveUnitEquipmentSlotCap(unit));
}

interface OwnedEquipment {
  equips?: string[];
  equipment?: { kind?: string; id?: string };
}

interface EquipmentUnitLike {
  star?: number;
  [key: string]: unknown;
}

function isEquipmentItem(item: unknown): item is EquipmentItem {
  return Boolean(item && typeof item === "object" && (item as { kind?: string }).kind === "equipment" && (item as { bonus?: unknown }).bonus);
}

export function collectOwnedEquipmentItems(
  unit: EquipmentUnitLike,
  owned: OwnedEquipment | null | undefined,
  options: { includeLegacy?: boolean; assignEquipsToUnit?: boolean } = {}
): EquipmentItem[] {
  const includeLegacy = options.includeLegacy === true;
  const seen = new Set<string>();
  const equipItems: EquipmentItem[] = [];

  const append = (itemId: string, itemOverride: unknown = null): void => {
    const key = getEquipmentNameKey(itemId);
    const item = (itemOverride as EquipmentItem | null) ?? (ITEM_BY_ID[itemId] as unknown as EquipmentItem | undefined);
    if (!isEquipmentItem(item) || !key || seen.has(key)) return;
    if (!canEquipItemByStarLevel(unit, itemId)) return;
    seen.add(key);
    equipItems.push(item);
  };

  normalizeEquipIds(owned?.equips, unit ?? owned).forEach((itemId) => append(itemId));

  if (includeLegacy && owned?.equipment?.kind === "equipment" && owned.equipment.id) {
    append(owned.equipment.id, owned.equipment);
  }

  return equipItems;
}

export function applyOwnedEquipmentBonusesToUnit(
  unit: EquipmentUnitLike & { equips?: string[] },
  owned: OwnedEquipment | null | undefined,
  applyBonusToUnit: (unit: EquipmentUnitLike, bonus: ItemBonus) => void,
  options: { assignEquipsToUnit?: boolean; includeLegacy?: boolean } = {}
): EquipmentItem[] {
  const assignEquipsToUnit = options.assignEquipsToUnit === true;
  const equipItems = collectOwnedEquipmentItems(unit, owned, options);

  if (assignEquipsToUnit) {
    unit.equips = equipItems.map((item) => item.id).filter((id) => typeof id === "string");
  }

  equipItems.forEach((item) => applyBonusToUnit(unit, item.bonus));
  return equipItems;
}

export function collectOwnedEquipmentPreviewBonuses(
  unit: EquipmentUnitLike,
  owned: OwnedEquipment | null | undefined,
  options: { includeLegacy?: boolean; assignEquipsToUnit?: boolean } = {}
): { startingRage: number; shieldStart: number } {
  const totals = {
    startingRage: 0,
    shieldStart: 0
  };

  collectOwnedEquipmentItems(unit, owned, options).forEach((item) => {
    const bonus = item?.bonus ?? {};
    if (Number.isFinite(bonus.startingRage)) totals.startingRage += Number(bonus.startingRage);
    if (Number.isFinite(bonus.shieldStart)) totals.shieldStart += Number(bonus.shieldStart);
  });

  return totals;
}
