// Canonical serializable run state + atomic Planning mutations (spec A1, A2, A3, A4).
// Every mutation returns ok/false; a failed mutation leaves state untouched.
import { getUnit, NORMAL_UNITS } from "../content/catalog";
import {
  addXp, benchCapacity, deployCap, refreshCost, roundIncome, sellValue, shopTierOdds, xpBuyCost,
} from "./economy";
import { canResearch, researchCost, TECH_BY_ID, techModifiers } from "./tech";
import {
  equipmentSaleValue, getEquipment, itemUnequipCost, normalizeEquipment, slotCapForUnit,
} from "./equipment";
import { normalizeVariantTraits, rollVariantTrait, type VariantTraitRef } from "./variants";
import { applyAugment, AUGMENTS, AUGMENT_ROUNDS } from "./augments";
import { BASE_MATERIALS, craft as commitCraft, stage as stageCraft } from "./craft";
import { lossDamage, type Drop } from "./loot";
import { modeConfig, type GameMode, type LossCondition } from "./modes";
import {
  beastDenOffers, blacksmithForgeTier, completeFortressNode as completeFortressStateNode,
  createFortressState, fortressRng, isBlacksmithServiceId, pharmacyOptions, selectFortressNode as selectFortressStateNode,
  type FortressState, type PharmacyServiceResult,
} from "./fortress";
import {
  cloneSandboxUnit, creativeRightEnemyOverride, creativeSandboxSaleValue, mergeCreativeSandboxUnits,
  normalizeCreativeSandboxUnits, sandboxSideForCol, validSandboxCell, type CreativeSandboxUnit,
} from "./creative";
import type { Placement, SideBonus } from "./combat";
import type { AiMode } from "./encounter";
import {
  createTutorialState, finishTutorialIfPastEnd, incrementTutorialShopVariant, isTutorialActive,
  markTutorialPrepared, recordTutorialEvent, syncTutorialRound, tutorialActionAllowed, tutorialPreparationPlan,
  tutorialShop, TUTORIAL_AUGMENT_IDS, type TutorialState,
} from "./tutorial";
import { resolveEnemyPreview, type EnemyPreviewOptions, type EnemyPreviewResult } from "./preview";
import { computeSynergies, type SynergyLine } from "./synergy";
import {
  recordEndlessAchievementEvent, type AchievementProfile, type EndlessAchievementEvent,
} from "./achievements";

export type Phase = "PLANNING" | "AUGMENT" | "COMBAT" | "GAME_OVER";

export interface OwnedUnit {
  uid: string;
  baseId: string;
  star: 1 | 2 | 3;
  equips: string[];
  traits?: VariantTraitRef[];
}

export interface RunState {
  phase: Phase;
  mode: GameMode;
  aiMode: AiMode;
  lossCondition: LossCondition;
  round: number;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  /** 5×5 allied board, row-major index r*5+c. */
  board: (OwnedUnit | null)[];
  /** Compact ordered bench, never sparse. */
  bench: OwnedUnit[];
  itemBag: string[];
  shop: (string | null)[];
  /** Canonical offer capacity; UI may page this collection. */
  shopSlotCount: number;
  shopLocked: boolean;
  benchUpgradeLevel: number;
  benchBonus: number;
  deployCapBonus: number;
  xpCostDelta: number;
  rollCostDelta: number;
  interestCapBonus: number;
  /** Decimal rate bonus, e.g. 0.01 = +1 percentage point interest. */
  interestRateBonus: number;
  startingRage: number;
  startingShield: number;
  /** Combat percentage-point bonuses. */
  teamAtkPct: number;
  teamMatkPct: number;
  teamDefPct: number;
  teamMdefPct: number;
  teamHpPct: number;
  teamCritPct: number;
  lifestealPct: number;
  hpLossReductionPct: number;
  rageGainPct: number;
  extraClassCount: number;
  extraTribeCount: number;
  inventoryBonus: number;
  fixedIncome: number;
  winGoldBonus: number;
  winStreak: number;
  loseStreak: number;
  rngSeed: number;
  nextUid: number;
  techLevels: Record<string, number>;
  /** 0..3, raised only by tech (A7). */
  craftTableLevel: number;
  inventoryUpgradeLevel: number;
  /** Purchased game-speed progression, 0..10 (A17/A56). */
  speedLevel: number;
  unequipDiscount: number;
  craftHistory: string[];
  augments: string[];
  /** Summed augment values by effect type (A10). */
  augmentMods: Record<string, number>;
  augmentRoundsTaken: number[];
  activeAugmentChoices: string[];
  /** Combat result ids already committed; prevents result/network replay double-payment. */
  appliedCombats: string[];
  /** Round numbers whose Planning income has already been paid. Round 1 starts funded. */
  incomeRoundsPaid: number[];
  enemyPreview: Placement[];
  enemyPreviewRound: number;
  enemyBudget: number;
  tutorial: TutorialState;
  tutorialSkipped: boolean;
  fortress: FortressState;
  creativeSandboxUnits: CreativeSandboxUnit[];
}

const achievementProfileByRun = new WeakMap<RunState, AchievementProfile>();

function recordRunAchievement(s: RunState, event: EndlessAchievementEvent): boolean {
  const profile = achievementProfileByRun.get(s);
  return profile ? recordEndlessAchievementEvent(profile, s.mode, event) : false;
}

function recordRunAchievementSnapshot(s: RunState): void {
  recordRunAchievement(s, {
    type: "snapshot", round: s.round, gold: s.gold, level: s.level, winStreak: s.winStreak,
  });
}

/** Bind an account achievement profile without serializing it into RunState. */
export function bindAchievementProfile(s: RunState, profile: AchievementProfile, recordRunStarted = false): RunState {
  achievementProfileByRun.set(s, profile);
  if (recordRunStarted) recordRunAchievement(s, { type: "run_started" });
  recordRunAchievementSnapshot(s);
  return s;
}

export const BOARD_SIZE = 5;
const SHOP_SLOTS = 5;

/** Mulberry32: deterministic, serializable via one integer seed. */
function nextRandom(s: RunState): number {
  let t = (s.rngSeed = (s.rngSeed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const nextUint32 = (s: RunState): number => Math.floor(nextRandom(s) * 4294967296) >>> 0;

function allocateUid(s: RunState): string {
  const used = new Set([
    ...s.bench.map((u) => u.uid),
    ...s.board.flatMap((u) => (u ? [u.uid] : [])),
    ...s.creativeSandboxUnits.map((u) => u.uid),
  ]);
  for (;;) {
    const uid = `u${s.nextUid++}`;
    if (!used.has(uid)) return uid;
  }
}

function createModeRunInternal(seed: number, mode: GameMode): RunState {
  const cfg = modeConfig(mode);
  const s: RunState = {
    phase: "PLANNING", mode, aiMode: cfg.ai.def, lossCondition: cfg.lossCondition,
    round: 1, level: 1, xp: 0, gold: cfg.startGold, hp: cfg.startHp,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null), bench: [], itemBag: [],
    shop: [], shopSlotCount: SHOP_SLOTS, shopLocked: false, benchUpgradeLevel: 0, benchBonus: 0, deployCapBonus: 0,
    xpCostDelta: 0, rollCostDelta: 0, interestCapBonus: 0, interestRateBonus: 0, startingRage: 0, startingShield: 0,
    teamAtkPct: 0, teamMatkPct: 0, teamDefPct: 0, teamMdefPct: 0, teamHpPct: 0, teamCritPct: 0,
    lifestealPct: 0, hpLossReductionPct: 0, rageGainPct: 0, extraClassCount: 0, extraTribeCount: 0,
    inventoryBonus: 0, fixedIncome: 0, winGoldBonus: 0,
    winStreak: 0, loseStreak: 0, rngSeed: seed | 0, nextUid: 1,
    techLevels: {}, craftTableLevel: 0, inventoryUpgradeLevel: 0, speedLevel: 0,
    unequipDiscount: 0, craftHistory: [], augments: [], augmentMods: {},
    augmentRoundsTaken: [], activeAugmentChoices: [], appliedCombats: [], incomeRoundsPaid: [1],
    enemyPreview: [], enemyPreviewRound: 0, enemyBudget: 0,
    tutorial: createTutorialState(1), tutorialSkipped: false,
    fortress: createFortressState(seed),
    creativeSandboxUnits: [],
  };
  if (cfg.shop) rollShop(s);
  else s.shop = Array(SHOP_SLOTS).fill(null);
  return s;
}

/** Normal production fresh run. Current availability policy always yields Classic. */
export function createRun(seed: number, achievements?: AchievementProfile): RunState {
  const run = createModeRunInternal(seed, "EndlessPvEClassic");
  return achievements ? bindAchievementProfile(run, achievements, true) : run;
}

/** Internal mode constructor: keeps gated mode logic executable without bypassing menu availability. */
export function createModeRun(seed: number, mode: GameMode, achievements?: AchievementProfile): RunState {
  const run = createModeRunInternal(seed, mode);
  return achievements ? bindAchievementProfile(run, achievements, true) : run;
}

function rollShop(s: RunState): void {
  if (isTutorialActive(s)) {
    syncTutorialRound(s);
    const fixed = tutorialShop(s.round, s.tutorial.shopVariant, s.shopSlotCount);
    if (fixed) {
      s.shop = fixed;
      return;
    }
  }
  const odds = shopTierOdds(s.level);
  s.shop = Array.from({ length: Math.max(SHOP_SLOTS, Math.min(20, s.shopSlotCount)) }, () => {
    let r = nextRandom(s);
    let tier = 1;
    for (let i = 0; i < odds.length; i++) {
      r -= odds[i]!;
      if (r < 0) { tier = i + 1; break; }
    }
    const pool = NORMAL_UNITS.filter((u) => u.tier === tier);
    return pool[Math.floor(nextRandom(s) * pool.length)]?.id ?? null;
  });
}

const planning = (s: RunState) => s.phase === "PLANNING";
const creativeEconomy = (s: RunState) => modeConfig(s.mode).creative;
const canAfford = (s: RunState, cost: number) => creativeEconomy(s) || s.gold >= Math.max(0, cost);
const spendGold = (s: RunState, cost: number): number => {
  const normalized = Number.isFinite(cost) ? Math.max(0, cost) : 0;
  if (!normalized || creativeEconomy(s)) return 0;
  const spent = Math.min(s.gold, normalized);
  s.gold = Math.max(0, s.gold - spent);
  return spent;
};
const gainGold = (s: RunState, amount: number, allowCreativeMutation = false): number => {
  const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (!normalized || (creativeEconomy(s) && !allowCreativeMutation)) return 0;
  s.gold = Math.max(0, s.gold + normalized);
  return normalized;
};
export const boardCount = (s: RunState) => s.board.filter(Boolean).length;
export const benchCap = (s: RunState) => benchCapacity(s.benchUpgradeLevel, s.benchBonus, creativeEconomy(s));
export const deployLimit = (s: RunState) => deployCap(s.level, s.deployCapBonus);
export const inventoryCapacity = (s: RunState) =>
  Math.max(0, boardCount(s) + s.bench.length + Math.round(s.inventoryBonus));
export const inventoryDisplaySlots = (s: RunState) => Math.max(inventoryCapacity(s), s.itemBag.length);

export function buyXp(s: RunState): boolean {
  const cost = xpBuyCost(s.xpCostDelta);
  if (!planning(s) || !tutorialActionAllowed(s, "buy_xp") || !canAfford(s, cost)) return false;
  spendGold(s, cost);
  Object.assign(s, addXp(s.level, s.xp, 4));
  recordRunAchievement(s, { type: "xp_purchase" });
  recordRunAchievementSnapshot(s);
  return true;
}

export function refresh(s: RunState): boolean {
  const cost = refreshCost(s.level, s.rollCostDelta);
  if (!planning(s) || !tutorialActionAllowed(s, "roll_shop") || s.shopLocked || !canAfford(s, cost)) return false;
  spendGold(s, cost);
  if (isTutorialActive(s)) incrementTutorialShopVariant(s);
  rollShop(s);
  recordTutorialEvent(s, "roll_shop");
  recordRunAchievement(s, { type: "shop_refresh" });
  recordRunAchievementSnapshot(s);
  return true;
}

export function toggleLock(s: RunState): void {
  if (!tutorialActionAllowed(s, "toggle_shop_lock")) return;
  s.shopLocked = !s.shopLocked;
}

/** A8 research: atomic; applies the purchased level's run-state deltas. Combat % effects read techModifiers(). */
export function research(s: RunState, id: string): boolean {
  const researchGold = creativeEconomy(s) ? Number.POSITIVE_INFINITY : s.gold;
  if (!planning(s) || !tutorialActionAllowed(s, "research") || !canResearch(s.techLevels, id, researchGold)) return false;
  const t = TECH_BY_ID.get(id)!;
  const lvl = s.techLevels[id] ?? 0;
  spendGold(s, researchCost(t, lvl));
  s.techLevels[id] = lvl + 1;
  const e = t.effects[Math.min(lvl, t.effects.length - 1)]!;
  s.benchBonus += e.bench ?? 0;
  s.benchUpgradeLevel += e.benchUpgrade ?? 0;
  s.deployCapBonus += e.deployCap ?? 0;
  s.xpCostDelta += e.xpCost ?? 0;
  s.rollCostDelta += e.rerollCost ?? 0;
  s.unequipDiscount += e.unequipDiscount ?? 0;
  s.craftTableLevel = Math.min(3, s.craftTableLevel + (e.craftTable ?? 0));
  s.speedLevel = Math.min(10, s.speedLevel + (e.speed ?? 0));
  return true;
}

export function buy(s: RunState, slot: number): boolean {
  const id = s.shop[slot];
  if (!planning(s) || !id || !tutorialActionAllowed(s, "buy_unit", { shopSlot: slot })) return false;
  const price = getUnit(id).tier;
  if (!canAfford(s, price) || s.bench.length >= benchCap(s)) return false;
  spendGold(s, price);
  s.shop[slot] = null;
  const role = getUnit(id).role;
  const seed = nextUint32(s);
  s.bench.push({ uid: allocateUid(s), baseId: id, star: 1, equips: [], traits: [rollVariantTrait(role, seed)] });
  autoMerge(s);
  recordTutorialEvent(s, "buy_unit");
  recordRunAchievement(s, { type: "unit_bought" });
  recordRunAchievementSnapshot(s);
  return true;
}

/** Sell from bench ("bench", index) or board ("board", cell). Equipment returns to bag. */
export function sell(s: RunState, from: "bench" | "board", index: number): boolean {
  if (!planning(s) || !tutorialActionAllowed(s, "sell_unit", { source: { where: from, index } })) return false;
  const u = from === "bench" ? s.bench[index] : s.board[index];
  if (!u) return false;
  if (from === "bench") s.bench.splice(index, 1);
  else s.board[index] = null;
  s.itemBag.push(...u.equips);
  gainGold(s, sellValue(getUnit(u.baseId).tier, u.star));
  recordTutorialEvent(s, "sell_unit");
  return true;
}

/** A14.10: slot cap = star skill cost, else rageMax, else 3. */
export function slotCap(baseId: string, star: number): number {
  return slotCapForUnit(getUnit(baseId), star);
}

function ownedAt(s: RunState, where: "bench" | "board", index: number): OwnedUnit | null {
  return where === "bench" ? s.bench[index] ?? null : s.board[index] ?? null;
}

/** A80 equip transaction. Existing equipment must already be canonical; corrupt state fails closed. */
export function equipItem(s: RunState, itemId: string, where: "bench" | "board", index: number): boolean {
  const bagIndex = s.itemBag.indexOf(itemId);
  if (!planning(s) || !tutorialActionAllowed(s, "equip_item", {
    source: { where: "inventory", index: bagIndex, itemId },
    destination: { where, index }, itemId,
  })) return false;
  const unit = ownedAt(s, where, index);
  const item = getEquipment(itemId);
  if (!unit || !item || bagIndex < 0 || item.tier > unit.star) return false;
  const cap = slotCap(unit.baseId, unit.star);
  const current = normalizeEquipment(unit.equips, unit.star, cap);
  if (current.rejected.length || current.kept.length >= cap) return false;
  if (current.kept.some((id) => getEquipment(id)!.nameKey === item.nameKey)) return false;
  const bag = s.itemBag.slice();
  bag.splice(bagIndex, 1);
  unit.equips = [...current.kept, itemId];
  s.itemBag = bag;
  recordTutorialEvent(s, "equip_item");
  return true;
}

export function unequipQuote(s: RunState, where: "bench" | "board", index: number): number[] | null {
  const unit = ownedAt(s, where, index);
  if (!unit || !unit.equips.length) return null;
  const cap = slotCap(unit.baseId, unit.star);
  const current = normalizeEquipment(unit.equips, unit.star, cap);
  if (current.rejected.length) return null;
  return current.kept.map((id) => itemUnequipCost(getEquipment(id)!, s.unequipDiscount));
}

export function unequipItem(
  s: RunState, where: "bench" | "board", index: number, equippedIndex: number,
): boolean {
  if (!planning(s) || !tutorialActionAllowed(s, "unequip_item", { source: { where, index } })) return false;
  const unit = ownedAt(s, where, index);
  const costs = unequipQuote(s, where, index);
  if (!unit || !costs || equippedIndex < 0 || equippedIndex >= unit.equips.length) return false;
  const cost = costs[equippedIndex];
  if (cost == null || !canAfford(s, cost)) return false;
  const item = unit.equips[equippedIndex]!;
  spendGold(s, cost);
  unit.equips.splice(equippedIndex, 1);
  s.itemBag.push(item);
  recordTutorialEvent(s, "unequip_item");
  return true;
}

export function unequipAll(s: RunState, where: "bench" | "board", index: number): boolean {
  if (!planning(s) || !tutorialActionAllowed(s, "unequip_item", { source: { where, index } })) return false;
  const unit = ownedAt(s, where, index);
  const costs = unequipQuote(s, where, index);
  if (!unit || !costs?.length) return false;
  const total = costs.reduce((a, b) => a + b, 0);
  if (!canAfford(s, total)) return false;
  const returned = unit.equips.slice();
  spendGold(s, total);
  unit.equips = [];
  s.itemBag.push(...returned);
  recordTutorialEvent(s, "unequip_item");
  return true;
}

/** A6 item sale: materials = 1; equipment follows its tier table. */
export function sellItem(s: RunState, bagIndex: number): boolean {
  if (!planning(s) || !tutorialActionAllowed(s, "sell_item") || bagIndex < 0 || bagIndex >= s.itemBag.length) return false;
  const id = s.itemBag[bagIndex]!;
  const equipment = getEquipment(id);
  const value = equipment ? equipmentSaleValue(equipment.tier) : 1;
  s.itemBag.splice(bagIndex, 1);
  gainGold(s, value);
  return true;
}

type Ref = { where: "bench" | "board"; index: number; unit: OwnedUnit };

/** A81: bench order then board row-major; first group of 3 same species+star; restart scan. */
export function autoMerge(s: RunState): number {
  let merges = 0;
  for (;;) {
    const refs: Ref[] = [
      ...s.bench.map((unit, index) => ({ where: "bench" as const, index, unit })),
      ...s.board.flatMap((unit, index) => (unit ? [{ where: "board" as const, index, unit }] : [])),
    ];
    const groups = new Map<string, Ref[]>();
    let picked: Ref[] | undefined;
    for (const r of refs) {
      if (r.unit.star >= 3) continue;
      const key = `${getUnit(r.unit.baseId).species}|${r.unit.star}`;
      const g = groups.get(key) ?? [];
      g.push(r);
      groups.set(key, g);
      if (g.length === 3) { picked = g; break; }
    }
    if (!picked) {
      if (merges > 0) recordRunAchievement(s, { type: "merge", count: merges });
      return merges;
    }

    const star = (picked[0]!.unit.star + 1) as 2 | 3;
    const baseId = picked
      .map((r) => r.unit.baseId)
      .reduce((a, b) => (getUnit(b).tier > getUnit(a).tier ? b : a));
    const cap = slotCap(baseId, star);
    const equipment = normalizeEquipment(picked.flatMap((r) => r.unit.equips), star, cap);
    // A81 explicitly returns duplicate/cap overflow equipment. Invalid/non-equipment ids are ignored.
    s.itemBag.push(...equipment.rejected.filter((id) => getEquipment(id) !== null));
    const traits = picked.flatMap((r) => normalizeVariantTraits(getUnit(r.unit.baseId).role, r.unit.traits ?? []))
      .slice(0, 9);
    const result: OwnedUnit = { uid: allocateUid(s), baseId, star, equips: equipment.kept, traits };

    const boardSrc = picked.find((r) => r.where === "board");
    for (const r of picked) if (r.where === "board") s.board[r.index] = null;
    const benchIdx = picked.filter((r) => r.where === "bench").map((r) => r.index);
    const firstBench = Math.min(...benchIdx);
    s.bench = s.bench.filter((_, i) => !benchIdx.includes(i));
    if (boardSrc) s.board[boardSrc.index] = result;
    else s.bench.splice(Math.min(firstBench, s.bench.length), 0, result);
    merges++;
  }
}

/** A2 rules 1–2: bench → board cell (empty or swap). */
export function benchToBoard(s: RunState, benchIndex: number, cell: number, allowSwap = true): boolean {
  const u = s.bench[benchIndex];
  if (!planning(s) || !u || cell < 0 || cell >= s.board.length || !tutorialActionAllowed(s, "move_unit", {
    source: { where: "bench", index: benchIndex }, destination: { where: "board", index: cell }, unitUid: u.uid,
  })) return false;
  const occupant = s.board[cell];
  if (occupant && !allowSwap) return false;
  const species = getUnit(u.baseId).species;
  if (s.board.some((unit, index) => index !== cell && unit && getUnit(unit.baseId).species === species)) return false;
  if (!occupant && boardCount(s) >= deployLimit(s)) return false;
  s.board[cell] = u;
  if (occupant) s.bench[benchIndex] = occupant;
  else s.bench.splice(benchIndex, 1);
  recordTutorialEvent(s, "move_unit");
  return true;
}

/** A2 rules 3–4: board → bench position (insert when room, swap when occupied). */
export function boardToBench(s: RunState, cell: number, benchIndex: number, allowSwap = true): boolean {
  const u = s.board[cell];
  const capacity = benchCap(s);
  if (!planning(s) || !u || benchIndex < 0 || benchIndex >= capacity || !tutorialActionAllowed(s, "move_unit", {
    source: { where: "board", index: cell }, destination: { where: "bench", index: benchIndex }, unitUid: u.uid,
  })) return false;
  const target = s.bench[benchIndex];
  if (target) {
    if (!allowSwap) return false;
    const species = getUnit(target.baseId).species;
    if (s.board.some((unit, index) => index !== cell && unit && getUnit(unit.baseId).species === species)) return false;
    s.board[cell] = target;
    s.bench[benchIndex] = u;
    recordTutorialEvent(s, "move_unit");
    return true;
  }
  if (s.bench.length >= benchCap(s)) return false;
  s.board[cell] = null;
  s.bench.splice(Math.min(benchIndex, s.bench.length), 0, u);
  recordTutorialEvent(s, "move_unit");
  return true;
}

/** Board → board: move or swap. */
export function boardToBoard(s: RunState, from: number, to: number): boolean {
  const u = s.board[from];
  if (!planning(s) || !u || to < 0 || to >= s.board.length || from === to || !tutorialActionAllowed(s, "move_unit", {
    source: { where: "board", index: from }, destination: { where: "board", index: to }, unitUid: u.uid,
  })) return false;
  s.board[from] = s.board[to] ?? null;
  s.board[to] = u;
  recordTutorialEvent(s, "move_board_unit");
  recordTutorialEvent(s, "move_unit");
  return true;
}

/** A2 rules 5–6: bench reorder/swap, never creating holes. */
export function benchToBench(s: RunState, from: number, to: number, allowSwap = true): boolean {
  const u = s.bench[from];
  if (!planning(s) || !u || to < 0 || to >= benchCap(s) || from === to || !tutorialActionAllowed(s, "move_unit", {
    source: { where: "bench", index: from }, destination: { where: "bench", index: to }, unitUid: u.uid,
  })) return false;
  if (s.bench[to]) {
    if (!allowSwap) return false;
    s.bench[from] = s.bench[to]!;
    s.bench[to] = u;
  } else {
    s.bench.splice(from, 1);
    s.bench.splice(Math.min(to, s.bench.length), 0, u);
  }
  recordTutorialEvent(s, "move_unit");
  return true;
}

/** A1.1: Start accepted only in PLANNING with ≥1 deployed unit. Returns reject reason or null. */
export function startCombat(s: RunState): string | null {
  if (!planning(s)) return "not_planning";
  if (!tutorialActionAllowed(s, "begin_combat")) return "tutorial_blocked";
  if (boardCount(s) === 0) return "no_units";
  recordTutorialEvent(s, "begin_combat");
  s.phase = "COMBAT";
  return null;
}

export type RoundWinner = "LEFT" | "RIGHT" | "DRAW";

export interface RoundResultInput {
  combatId: string;
  winner: RoundWinner;
  enemySurvivors: number;
  enemyStars: number[];
  bounty: number;
  drops: Drop[];
}

export interface RoundResultSummary {
  winner: RoundWinner;
  goldEarned: number;
  rewardBreakdown: {
    baseWinGold: number;
    starWinGold: number;
    bountyGold: number;
    winBonusGold: number;
  };
  xpEarned: number;
  damageTaken: number;
  hpAfter: number;
  nextRound: number;
  gameOver: boolean;
  incomeEarned: number;
  acceptedDrops: Drop[];
  rejectedDrops: Drop[];
}

const validBagItem = (id: string) => (BASE_MATERIALS as readonly string[]).includes(id) || getEquipment(id) !== null;

function offerAugmentsIfDue(s: RunState): void {
  const cfg = modeConfig(s.mode);
  if (isTutorialActive(s) && s.round !== 7) {
    s.activeAugmentChoices = [];
    s.phase = "PLANNING";
    return;
  }
  if (!cfg.augments || !(AUGMENT_ROUNDS as readonly number[]).includes(s.round) || s.augmentRoundsTaken.includes(s.round)) {
    s.activeAugmentChoices = [];
    s.phase = "PLANNING";
    return;
  }
  const tutorialFixed = isTutorialActive(s) && s.round === 7
    ? TUTORIAL_AUGMENT_IDS.filter((id) => !s.augments.includes(id))
    : null;
  if (tutorialFixed) {
    s.activeAugmentChoices = [...tutorialFixed];
    s.phase = tutorialFixed.length ? "AUGMENT" : "PLANNING";
    return;
  }
  const remaining = AUGMENTS.filter((a) => !s.augments.includes(a.id));
  const choices: string[] = [];
  const pool = remaining.slice();
  while (choices.length < 3 && pool.length) {
    const index = Math.floor(nextRandom(s) * pool.length);
    choices.push(pool.splice(index, 1)[0]!.id);
  }
  s.activeAugmentChoices = choices;
  s.phase = choices.length ? "AUGMENT" : "PLANNING";
}

export function chooseAugment(s: RunState, id: string): boolean {
  if (s.phase !== "AUGMENT" || !tutorialActionAllowed(s, "choose_augment") || !s.activeAugmentChoices.includes(id) || s.augments.includes(id)) return false;
  if (!applyAugment(s, id)) return false;
  s.augmentRoundsTaken.push(s.round);
  s.activeAugmentChoices = [];
  s.phase = "PLANNING";
  recordTutorialEvent(s, "choose_augment", ["lastAugmentName", id]);
  recordRunAchievement(s, { type: "augment_chosen" });
  recordRunAchievementSnapshot(s);
  return true;
}

/** Tutorial-aware craft staging wrapper. Staging remains external/non-destructive. */
export function stageRunCraftItem(s: RunState, staged: (string | null)[], index: number, itemId: string | null): (string | null)[] | null {
  if (!planning(s) || !tutorialActionAllowed(s, "add_craft_item", {
    source: itemId ? { where: "inventory", index: s.itemBag.indexOf(itemId), itemId } : undefined,
    destination: { where: "craft", index }, itemId: itemId ?? undefined,
  })) return null;
  const next = stageCraft(staged, index, itemId, s.craftTableLevel);
  if (next) recordTutorialEvent(s, "add_craft_item");
  return next;
}

/** Tutorial-aware atomic craft commit. Caller clears external staging on success. */
export function craftRunItem(s: RunState, staged: (string | null)[]): string | null {
  if (!planning(s) || !tutorialActionAllowed(s, "craft_item", { inspection: { craftGrid: staged } })) return null;
  const crafted = commitCraft(s, staged);
  if (crafted) {
    recordTutorialEvent(s, "craft_item", ["lastCraftedItem", crafted]);
    recordRunAchievement(s, { type: "crafted" });
    recordRunAchievementSnapshot(s);
  }
  return crafted;
}

/** Applies authored tutorial round setup once; returns whether external craft staging must be cleared. */
export function prepareTutorialRound(s: RunState): { prepared: boolean; clearCraftStaging: boolean } {
  const plan = tutorialPreparationPlan(s);
  if (!plan) return { prepared: false, clearCraftStaging: false };
  if (plan.grantBenchBaseId) {
    const def = getUnit(plan.grantBenchBaseId);
    const seed = nextUint32(s);
    s.bench.push({ uid: allocateUid(s), baseId: def.id, star: 1, equips: [], traits: [rollVariantTrait(def.role, seed)] });
    recordTutorialEvent(s, "tutorial_reward_unit", ["lastTutorialReward", def.id]);
  }
  if (plan.grantItemId) {
    s.itemBag.push(plan.grantItemId);
    recordTutorialEvent(s, "tutorial_reward_item", ["lastTutorialReward", plan.grantItemId]);
  }
  if (plan.ensureMaterialId) {
    s.itemBag.push(plan.ensureMaterialId);
    recordTutorialEvent(s, "tutorial_reward_material", ["lastTutorialReward", plan.ensureMaterialId]);
  }
  if (plan.minCraftTableLevel != null) s.craftTableLevel = Math.max(s.craftTableLevel, plan.minCraftTableLevel);
  if (plan.reopenAugmentRound != null) s.augmentRoundsTaken = s.augmentRoundsTaken.filter((round) => round !== plan.reopenAugmentRound);
  markTutorialPrepared(s, plan);
  return { prepared: true, clearCraftStaging: plan.clearCraftStaging };
}

function payPlanningIncome(s: RunState): number {
  const cfg = modeConfig(s.mode);
  if (cfg.creative || s.incomeRoundsPaid.includes(s.round)) return 0;
  const tech = techModifiers(s.techLevels);
  const amount = roundIncome(s.gold, s.winStreak, s.loseStreak, cfg.goldIncome(s.round), {
    interestCapBonus: s.interestCapBonus + (tech.interestCap ?? 0),
    interestRateBonus: s.interestRateBonus + (tech.interestRate ?? 0) / 100,
    fixedIncome: s.fixedIncome + (tech.fixedIncome ?? 0),
  });
  s.gold += amount;
  s.incomeRoundsPaid.push(s.round);
  return amount;
}

/** Pure informational value used by result/history surfaces; does not mutate run state. */
export function nextRoundIncomePreview(s: RunState): number {
  const cfg = modeConfig(s.mode);
  if (cfg.creative) return 0;
  const tech = techModifiers(s.techLevels);
  return roundIncome(s.gold, s.winStreak, s.loseStreak, cfg.goldIncome(s.round + 1), {
    interestCapBonus: s.interestCapBonus + (tech.interestCap ?? 0),
    interestRateBonus: s.interestRateBonus + (tech.interestRate ?? 0) / 100,
    fixedIncome: s.fixedIncome + (tech.fixedIncome ?? 0),
  });
}

/** Persistent run/tech combat modifiers for the allied side. Synergy/equipment/environment remain separate stages. */
export function playerCombatBonus(s: RunState): SideBonus {
  const tech = techModifiers(s.techLevels);
  return {
    hpPct: s.teamHpPct + (tech.hpPct ?? 0),
    atkPct: s.teamAtkPct + (tech.atkPct ?? 0),
    matkPct: s.teamMatkPct + (tech.matkPct ?? 0),
    defPct: s.teamDefPct + (tech.defPct ?? 0),
    mdefPct: s.teamMdefPct + (tech.mdefPct ?? 0),
    critPct: s.teamCritPct + (tech.critPct ?? 0),
    lifestealPct: s.lifestealPct + (tech.lifestealPct ?? 0),
    rageGainPct: s.rageGainPct + (tech.rageGainPct ?? 0),
    startRage: s.startingRage + (tech.startRage ?? 0),
    startShield: s.startingShield + (tech.startShield ?? 0),
  };
}

/** Deployed-only synergy view with persisted virtual class/tribe counts. */
export function runSynergies(s: RunState): SynergyLine[] {
  return computeSynergies(
    s.board.flatMap((unit) => unit ? [unit.baseId] : []),
    Math.max(0, Math.round(s.extraClassCount)),
    Math.max(0, Math.round(s.extraTribeCount)),
  );
}

/**
 * A1/A87 normalized result mutation. It is idempotent on combatId, advances a non-terminal round once,
 * pays that new Planning round's income once, refreshes an unlocked shop, then opens any owed augment choice.
 */
export function applyRoundResult(s: RunState, input: RoundResultInput): RoundResultSummary | null {
  if (s.phase !== "COMBAT" || s.appliedCombats.includes(input.combatId)) return null;
  const cfg = modeConfig(s.mode);
  const resolvedRound = s.round;
  s.appliedCombats.push(input.combatId);

  let goldEarned = 0;
  const rewardBreakdown = {
    baseWinGold: 0,
    starWinGold: 0,
    bountyGold: Math.max(0, input.bounty),
    winBonusGold: 0,
  };
  let xpEarned = 0;
  let damageTaken = 0;
  let gameOver = false;
  if (input.winner === "LEFT") {
    s.winStreak++;
    s.loseStreak = 0;
    rewardBreakdown.baseWinGold = input.enemyStars.length;
    rewardBreakdown.starWinGold = input.enemyStars.reduce((sum, star) => sum + Math.max(0, star - 1), 0);
    rewardBreakdown.winBonusGold = s.winGoldBonus + (techModifiers(s.techLevels).winGold ?? 0);
    goldEarned = rewardBreakdown.baseWinGold + rewardBreakdown.starWinGold
      + rewardBreakdown.bountyGold + rewardBreakdown.winBonusGold;
    if (!cfg.creative) {
      s.gold += goldEarned;
      xpEarned = 2;
      Object.assign(s, addXp(s.level, s.xp, xpEarned));
    }
  } else if (input.winner === "RIGHT") {
    s.winStreak = 0;
    s.loseStreak++;
    goldEarned = rewardBreakdown.bountyGold;
    if (!cfg.creative) s.gold += goldEarned;
    if (!cfg.creative && s.lossCondition === "NO_HEARTS") {
      damageTaken = lossDamage(cfg.damageRule, input.enemySurvivors);
      s.hp = Math.max(0, s.hp - damageTaken);
      gameOver = s.hp <= 0;
    } else if (!cfg.creative) gameOver = true;
  } else {
    s.winStreak = 0;
    s.loseStreak = 0;
    goldEarned = rewardBreakdown.bountyGold;
    if (!cfg.creative) s.gold += goldEarned;
  }

  const room = Math.max(0, inventoryCapacity(s) - s.itemBag.length);
  const legalDrops = input.drops.filter((drop) => typeof drop.item === "string" && validBagItem(drop.item));
  const acceptedDrops = legalDrops.slice(0, room);
  const rejectedDrops = [...legalDrops.slice(room), ...input.drops.filter((drop) => !legalDrops.includes(drop))];
  s.itemBag.push(...acceptedDrops.map((drop) => drop.item));

  let incomeEarned = 0;
  if (gameOver) {
    s.phase = "GAME_OVER";
    s.activeAugmentChoices = [];
  } else {
    s.round++;
    syncTutorialRound(s);
    finishTutorialIfPastEnd(s);
    prepareTutorialRound(s);
    incomeEarned = payPlanningIncome(s);
    if (cfg.shop && !s.shopLocked) rollShop(s);
    offerAugmentsIfDue(s);
  }
  recordRunAchievement(s, {
    type: "round_result",
    round: resolvedRound,
    won: input.winner === "LEFT",
    lost: input.winner === "RIGHT",
    itemsLooted: acceptedDrops.length,
    gold: s.gold,
    level: s.level,
    winStreak: s.winStreak,
  });
  return {
    winner: input.winner, goldEarned, rewardBreakdown, xpEarned, damageTaken, hpAfter: s.hp, nextRound: s.round,
    gameOver, incomeEarned, acceptedDrops, rejectedDrops,
  };
}

/** A117 route selection; pure graph ownership remains in fortress.ts. */
export function selectRunFortressNode(s: RunState, nodeId: string): boolean {
  if (s.phase !== "PLANNING" || modeConfig(s.mode).route !== "fortress") return false;
  const pending = selectFortressStateNode(s.fortress, nodeId);
  if (!pending) return false;
  if (pending.type === "beast_den") {
    const seed = (s.fortress.graphSeed ^ Math.imul(s.round, 0x45d9f3b) ^ Math.imul(s.fortress.actIndex, 0x27d4eb2d)) >>> 0;
    pending.serviceOffers = beastDenOffers(s.round, s.fortress.actIndex, fortressRng(seed));
  }
  return true;
}

export function resolveFortressPharmacy(
  s: RunState, optionId: "restore" | "stimulant" | "supplies" | "skip",
): PharmacyServiceResult | null {
  const pending = s.fortress.pendingNode;
  if (s.phase !== "PLANNING" || pending?.type !== "pharmacy" || pending.serviceResult) return null;
  if (optionId === "skip") {
    const result: PharmacyServiceResult = { kind: "pharmacy", optionId, hpDelta: 0, goldDelta: 0, xpDelta: 0, levelsGained: 0 };
    pending.serviceResult = result;
    return result;
  }
  const option = pharmacyOptions(s.round, s.fortress.actIndex).find((candidate) => candidate.id === optionId);
  if (!option) return null;
  const beforeHp = s.hp;
  const beforeLevel = s.level;
  s.hp = Math.min(modeConfig(s.mode).startHp, Math.max(0, Math.floor(s.hp + option.hpDelta)));
  if (option.goldDelta > 0) gainGold(s, option.goldDelta);
  if (option.xpDelta > 0) Object.assign(s, addXp(s.level, s.xp, option.xpDelta));
  const result: PharmacyServiceResult = {
    kind: "pharmacy",
    optionId,
    hpDelta: s.hp - beforeHp,
    goldDelta: creativeEconomy(s) ? 0 : option.goldDelta,
    xpDelta: option.xpDelta,
    levelsGained: s.level - beforeLevel,
  };
  pending.serviceResult = result;
  return result;
}

export function recruitFortressBeast(s: RunState, baseId: string): boolean {
  const pending = s.fortress.pendingNode;
  if (s.phase !== "PLANNING" || pending?.type !== "beast_den" || pending.serviceResult) return false;
  if (!pending.serviceOffers?.includes(baseId) || s.bench.length >= benchCap(s)) return false;
  const def = NORMAL_UNITS.find((unit) => unit.id === baseId);
  if (!def) return false;
  const uid = allocateUid(s);
  const seed = nextUint32(s);
  s.bench.push({ uid, baseId, star: 1, equips: [], traits: [rollVariantTrait(def.role, seed)] });
  autoMerge(s);
  pending.serviceResult = { kind: "beast_den", baseId, uid };
  return true;
}

export function resolveFortressBlacksmith(s: RunState, serviceId?: string): boolean {
  const pending = s.fortress.pendingNode;
  if (s.phase !== "PLANNING" || pending?.type !== "blacksmith" || pending.serviceResult) return false;
  if (serviceId != null && !isBlacksmithServiceId(serviceId)) return false;
  pending.serviceResult = { kind: "blacksmith", forgeTier: blacksmithForgeTier(s.round, s.fortress.actIndex), serviceId };
  return true;
}

export function completeRunFortressNode(s: RunState): boolean {
  if (modeConfig(s.mode).route !== "fortress") return false;
  return completeFortressStateNode(s.fortress);
}

/** Explicit Creative-only resource mutation; ordinary Creative economy gains remain suppressed. */
export function addCreativeGold(s: RunState, amount: number): number {
  if (!planning(s) || !creativeEconomy(s)) return 0;
  return gainGold(s, amount, true);
}

/** Creative testing HP grant. HP may exceed the authored start value and stays finite/persistable. */
export function addCreativeHp(s: RunState, amount: number): number {
  if (!planning(s) || !creativeEconomy(s) || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = s.hp;
  s.hp = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, s.hp + amount));
  return s.hp - before;
}

function sandboxOccupied(s: RunState, row: number, col: number, ignoreUid?: string): boolean {
  if (s.creativeSandboxUnits.some((unit) => unit.uid !== ignoreUid && unit.row === row && unit.col === col)) return true;
  if (col < BOARD_SIZE && s.board[row * BOARD_SIZE + col]) return true;
  return false;
}

function mergeCreativeRunUnits(s: RunState): number {
  const merged = mergeCreativeSandboxUnits(s.creativeSandboxUnits, () => allocateUid(s));
  s.creativeSandboxUnits = merged.units;
  s.itemBag.push(...merged.overflow);
  return merged.merges;
}

/** Clone a normal owned unit into the separate Creative battlefield collection; source is never removed. */
export function placeCreativeClone(
  s: RunState, from: "bench" | "board", index: number, row: number, col: number,
): string | null {
  if (!planning(s) || !creativeEconomy(s) || !validSandboxCell(row, col) || sandboxOccupied(s, row, col)) return null;
  const source = ownedAt(s, from, index);
  if (!source) return null;
  const clone = cloneSandboxUnit(source, allocateUid(s), row, col);
  if (!clone) return null;
  s.creativeSandboxUnits.push(clone);
  mergeCreativeRunUnits(s);
  return clone.uid;
}

/** Summon any canonical normal roster unit directly into the separate Creative sandbox collection. */
export function summonCreativeUnit(s: RunState, baseId: string, row: number, col: number): string | null {
  if (!planning(s) || !creativeEconomy(s) || !validSandboxCell(row, col) || sandboxOccupied(s, row, col)) return null;
  const def = NORMAL_UNITS.find((unit) => unit.id === baseId);
  if (!def) return null;
  const uid = allocateUid(s);
  const seed = nextUint32(s);
  s.creativeSandboxUnits.push({
    uid,
    baseId,
    star: 1,
    equips: [],
    traits: [rollVariantTrait(def.role, seed)],
    sandbox: true,
    sourceUid: null,
    side: sandboxSideForCol(col),
    row,
    col,
  });
  mergeCreativeRunUnits(s);
  return uid;
}

export function moveCreativeSandboxUnit(s: RunState, uid: string, row: number, col: number): boolean {
  if (!planning(s) || !creativeEconomy(s) || !validSandboxCell(row, col) || sandboxOccupied(s, row, col, uid)) return false;
  const unit = s.creativeSandboxUnits.find((candidate) => candidate.uid === uid);
  if (!unit) return false;
  unit.row = row;
  unit.col = col;
  unit.side = sandboxSideForCol(col);
  mergeCreativeRunUnits(s);
  return true;
}

export function removeCreativeSandboxUnit(s: RunState, uid: string): boolean {
  if (!planning(s) || !creativeEconomy(s)) return false;
  const index = s.creativeSandboxUnits.findIndex((unit) => unit.uid === uid);
  if (index < 0) return false;
  s.creativeSandboxUnits.splice(index, 1);
  return true;
}

/** Creative sale removes only the sandbox clone and reports canonical display value; wallet remains unchanged. */
export function sellCreativeSandboxUnit(s: RunState, uid: string): number | null {
  if (!planning(s) || !creativeEconomy(s)) return null;
  const index = s.creativeSandboxUnits.findIndex((unit) => unit.uid === uid);
  if (index < 0) return null;
  const value = creativeSandboxSaleValue(s.creativeSandboxUnits[index]!);
  s.creativeSandboxUnits.splice(index, 1);
  return value;
}

export function creativeEnemyOverride(s: RunState): Placement[] | null {
  if (!creativeEconomy(s)) return null;
  return creativeRightEnemyOverride(s.creativeSandboxUnits);
}

/** Planning/Combat share this canonical persisted encounter snapshot (A68). */
export function enemyPreview(s: RunState, options: EnemyPreviewOptions = {}): EnemyPreviewResult | null {
  return resolveEnemyPreview(s, options);
}
