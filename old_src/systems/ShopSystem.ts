/**
 * ShopSystem - Shop Management System
 *
 * Manages shop operations including refresh, buy, sell, lock/unlock, and shop generation.
 */

import { UNIT_CATALOG, UNIT_BY_ID } from "../data/unitCatalog.js";
import { getShopRoster, getShopRosterForTier, isShopRosterUnit } from "../data/shopRoster.js";
import { getTierOddsRow, rollTierForLevel, randomItem } from "../core/gameUtils.js";

export interface ShopCatalogUnit {
  id: string;
  tier: number;
  [key: string]: unknown;
}

export interface ShopOffer {
  slot: number;
  baseId: string;
}

export interface ShopUnit {
  baseId: string;
  star: number;
  [key: string]: unknown;
}

export interface ShopPlayer {
  gold: number;
  level: number;
  shopLocked?: boolean;
  rollCostDelta?: number;
  shop: Array<ShopOffer | null>;
  bench: ShopUnit[];
  [key: string]: unknown;
}

export interface ShopFailure {
  success: false;
  error: string;
}

export interface ShopPlayerResult {
  success: true;
  player: ShopPlayer;
}

export interface BuyResult extends ShopPlayerResult {
  unit: ShopUnit;
  cost: number;
}

export interface SellResult extends ShopPlayerResult {
  sellValue: number;
}

export interface TierOdds {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  tier5: number;
}
const DEFAULT_SHOP_SLOTS = 5;
const DEFAULT_REFRESH_COST = 2;
const SHOP_POOL: readonly ShopCatalogUnit[] = Object.freeze(getShopRoster() as ShopCatalogUnit[]);

export function getShopPool(): readonly ShopCatalogUnit[] {
  return SHOP_POOL;
}

export function getShopPoolForTier(tier: number): ShopCatalogUnit[] {
  return getShopRosterForTier(tier) as ShopCatalogUnit[];
}

export function refreshShop(player: ShopPlayer | null | undefined, cost: number | null = null): ShopPlayerResult | ShopFailure {
  if (!player) return { success: false, error: 'No player provided' };
  const parsedCost = cost == null ? Number.NaN : Number(cost);
  const refreshCost = Number.isFinite(parsedCost) ? parsedCost : calculateRefreshCost(player.level, player.rollCostDelta ?? 0);
  if (player.shopLocked) return { success: false, error: 'Shop is locked' };
  if (player.gold < refreshCost) return { success: false, error: 'Not enough gold' };
  return { success: true, player: { ...player, gold: player.gold - refreshCost, shop: generateShopOffers(player.level) } };
}

type CreateUnitFn = (baseId: string, star: number) => ShopUnit | null | undefined;

export function buyUnit(
  player: ShopPlayer | null | undefined,
  slot: number,
  createUnitFn: CreateUnitFn,
  benchCap: number
): BuyResult | ShopFailure {
  if (!player) return { success: false, error: 'No player provided' };
  if (!player.shop || slot < 0 || slot >= player.shop.length) return { success: false, error: 'Invalid shop slot' };
  const offer = player.shop[slot];
  if (!offer) return { success: false, error: 'No unit in this slot' };
  const base = UNIT_BY_ID[offer.baseId] as ShopCatalogUnit | undefined;
  if (!base) return { success: false, error: 'Invalid unit data' };
  const cost = base.tier;
  if (player.gold < cost) return { success: false, error: 'Not enough gold' };
  if (player.bench.length >= benchCap) return { success: false, error: 'Bench is full' };
  const ownedUnit = createUnitFn(base.id, 1);
  if (!ownedUnit) return { success: false, error: 'Failed to create unit' };
  const updatedShop = [...player.shop];
  updatedShop[slot] = null;
  const updatedPlayer: ShopPlayer = { ...player, gold: player.gold - cost, shop: updatedShop, bench: [...player.bench, ownedUnit] };
  return { success: true, player: updatedPlayer, unit: ownedUnit, cost };
}

export function sellUnit(player: ShopPlayer | null | undefined, unit: ShopUnit | null | undefined): SellResult | ShopFailure {
  if (!player) return { success: false, error: 'No player provided' };
  if (!unit) return { success: false, error: 'No unit provided' };
  const base = UNIT_BY_ID[unit.baseId] as ShopCatalogUnit | undefined;
  if (!base) return { success: false, error: 'Invalid unit data' };
  const starMultiplier = unit.star === 3 ? 5 : unit.star === 2 ? 3 : 1;
  const sellValue = base.tier * starMultiplier;
  return { success: true, player: { ...player, gold: player.gold + sellValue }, sellValue };
}

export function lockShop(player: ShopPlayer | null | undefined): ShopPlayerResult | ShopFailure {
  if (!player) return { success: false, error: 'No player provided' };
  return { success: true, player: { ...player, shopLocked: true } };
}

export function unlockShop(player: ShopPlayer | null | undefined): ShopPlayerResult | ShopFailure {
  if (!player) return { success: false, error: 'No player provided' };
  return { success: true, player: { ...player, shopLocked: false } };
}

export function generateShopOffers(level: number, slots = DEFAULT_SHOP_SLOTS): Array<ShopOffer | null> {
  const offers: Array<ShopOffer | null> = [];
  const eligiblePool: readonly ShopCatalogUnit[] = SHOP_POOL.length ? SHOP_POOL : (UNIT_CATALOG as readonly ShopCatalogUnit[]);
  const mutablePool: ShopCatalogUnit[] = eligiblePool.slice();
  for (let i = 0; i < slots; i++) {
    const tier = rollTierForLevel(level);
    const pool = mutablePool.filter((unit) => unit.tier === tier);
    const fallback = mutablePool.filter((unit) => unit.tier <= tier);
    const base = (pool.length ? pool : fallback.length ? fallback : mutablePool) as ShopCatalogUnit[];
    const picked = randomItem(base) as ShopCatalogUnit | undefined;
    offers.push(picked ? { slot: i, baseId: picked.id } : null);
  }
  return offers;
}

export function isUnitEligibleForShop(baseId: string): boolean {
  return isShopRosterUnit(baseId);
}

export function calculateRefreshCost(level = 1, rollCostDelta = 0): number {
  const parsedLevel = Number(level);
  const safeLevel = Number.isFinite(parsedLevel) ? Math.max(1, Math.floor(parsedLevel)) : 1;
  let baseCost = DEFAULT_REFRESH_COST;
  if (safeLevel >= 21) baseCost = 5;
  else if (safeLevel >= 16) baseCost = 4;
  else if (safeLevel >= 11) baseCost = 3;
  const parsedDelta = Number(rollCostDelta);
  const delta = Number.isFinite(parsedDelta) ? parsedDelta : 0;
  return Math.max(1, baseCost + delta);
}

export function getTierOdds(level: number): TierOdds {
  const odds = getTierOddsRow(level) as number[];
  return { tier1: odds[0], tier2: odds[1], tier3: odds[2], tier4: odds[3], tier5: odds[4] };
}

export const ShopSystem = {
  refreshShop, buyUnit, sellUnit, lockShop, unlockShop,
  generateShopOffers, calculateRefreshCost, getTierOdds
};

export default ShopSystem;
