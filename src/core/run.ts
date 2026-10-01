// Canonical serializable run state + atomic Planning mutations (spec A1, A2, A3, A4).
// Every mutation returns ok/false; a failed mutation leaves state untouched.
import { getUnit, NORMAL_UNITS } from "../content/catalog";
import {
  addXp, benchCapacity, deployCap, refreshCost, sellValue, shopTierOdds, xpBuyCost,
} from "./economy";
import { canResearch, researchCost, TECH_BY_ID } from "./tech";

export type Phase = "PLANNING" | "AUGMENT" | "COMBAT" | "GAME_OVER";

export interface OwnedUnit {
  uid: string;
  baseId: string;
  star: 1 | 2 | 3;
  equips: string[];
}

export interface RunState {
  phase: Phase;
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
  shopLocked: boolean;
  benchUpgradeLevel: number;
  benchBonus: number;
  deployBonus: number;
  xpCostDelta: number;
  rollCostDelta: number;
  winStreak: number;
  loseStreak: number;
  rngSeed: number;
  nextUid: number;
  techLevels: Record<string, number>;
  /** 0..3, raised only by tech (A7). */
  craftTableLevel: number;
  unequipDiscount: number;
  craftHistory: string[];
  augments: string[];
  /** Summed augment values by effect type (A10). */
  augmentMods: Record<string, number>;
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

export function createRun(seed: number): RunState {
  const s: RunState = {
    phase: "PLANNING", round: 1, level: 1, xp: 0, gold: 10, hp: 100,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null), bench: [], itemBag: [],
    shop: [], shopLocked: false, benchUpgradeLevel: 0, benchBonus: 0, deployBonus: 0,
    xpCostDelta: 0, rollCostDelta: 0, winStreak: 0, loseStreak: 0, rngSeed: seed | 0, nextUid: 1,
    techLevels: {}, craftTableLevel: 0, unequipDiscount: 0, craftHistory: [], augments: [], augmentMods: {},
  };
  rollShop(s);
  return s;
}

function rollShop(s: RunState): void {
  const odds = shopTierOdds(s.level);
  s.shop = Array.from({ length: SHOP_SLOTS }, () => {
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
export const boardCount = (s: RunState) => s.board.filter(Boolean).length;
export const benchCap = (s: RunState) => benchCapacity(s.benchUpgradeLevel, s.benchBonus);
export const deployLimit = (s: RunState) => deployCap(s.level, s.deployBonus);

export function buyXp(s: RunState): boolean {
  const cost = xpBuyCost(s.xpCostDelta);
  if (!planning(s) || s.gold < cost) return false;
  s.gold -= cost;
  Object.assign(s, addXp(s.level, s.xp, 4));
  return true;
}

export function refresh(s: RunState): boolean {
  const cost = refreshCost(s.level, s.rollCostDelta);
  if (!planning(s) || s.shopLocked || s.gold < cost) return false;
  s.gold -= cost;
  rollShop(s);
  return true;
}

export function toggleLock(s: RunState): void {
  s.shopLocked = !s.shopLocked;
}

/** A8 research: atomic; applies the purchased level's run-state deltas. Combat % effects read techModifiers(). */
export function research(s: RunState, id: string): boolean {
  if (!planning(s) || !canResearch(s.techLevels, id, s.gold)) return false;
  const t = TECH_BY_ID.get(id)!;
  const lvl = s.techLevels[id] ?? 0;
  s.gold -= researchCost(t, lvl);
  s.techLevels[id] = lvl + 1;
  const e = t.effects[Math.min(lvl, t.effects.length - 1)]!;
  s.benchBonus += e.bench ?? 0;
  s.benchUpgradeLevel += e.benchUpgrade ?? 0;
  s.deployBonus += e.deployCap ?? 0;
  s.xpCostDelta += e.xpCost ?? 0;
  s.rollCostDelta += e.rerollCost ?? 0;
  s.unequipDiscount += e.unequipDiscount ?? 0;
  s.craftTableLevel = Math.min(3, s.craftTableLevel + (e.craftTable ?? 0));
  return true;
}

export function buy(s: RunState, slot: number): boolean {
  const id = s.shop[slot];
  if (!planning(s) || !id) return false;
  const price = getUnit(id).tier;
  if (s.gold < price || s.bench.length >= benchCap(s)) return false;
  s.gold -= price;
  s.shop[slot] = null;
  s.bench.push({ uid: `u${s.nextUid++}`, baseId: id, star: 1, equips: [] });
  autoMerge(s);
  return true;
}

/** Sell from bench ("bench", index) or board ("board", cell). Equipment returns to bag. */
export function sell(s: RunState, from: "bench" | "board", index: number): boolean {
  if (!planning(s)) return false;
  const u = from === "bench" ? s.bench[index] : s.board[index];
  if (!u) return false;
  if (from === "bench") s.bench.splice(index, 1);
  else s.board[index] = null;
  s.itemBag.push(...u.equips);
  s.gold += sellValue(getUnit(u.baseId).tier, u.star);
  return true;
}

/** A14.10: slot cap = star skill cost, else rageMax, else 3. */
export function slotCap(baseId: string, star: number): number {
  const u = getUnit(baseId);
  const cap = u.skill.rageCost[star - 1] ?? u.stats.rageMax ?? 3;
  return Math.max(0, Math.round(cap));
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
    if (!picked) return merges;

    const star = (picked[0]!.unit.star + 1) as 2 | 3;
    const baseId = picked
      .map((r) => r.unit.baseId)
      .reduce((a, b) => (getUnit(b).tier > getUnit(a).tier ? b : a));
    // ponytail: dedupe key = item id; switch to canonical name key once item data lands.
    const cap = slotCap(baseId, star);
    const kept: string[] = [];
    for (const item of picked.flatMap((r) => r.unit.equips)) {
      if (kept.length < cap && !kept.includes(item)) kept.push(item);
      else s.itemBag.push(item);
    }
    const result: OwnedUnit = { uid: picked[0]!.unit.uid, baseId, star, equips: kept };

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
export function benchToBoard(s: RunState, benchIndex: number, cell: number): boolean {
  const u = s.bench[benchIndex];
  if (!planning(s) || !u || cell < 0 || cell >= s.board.length) return false;
  const occupant = s.board[cell];
  if (!occupant && boardCount(s) >= deployLimit(s)) return false;
  s.board[cell] = u;
  if (occupant) s.bench[benchIndex] = occupant;
  else s.bench.splice(benchIndex, 1);
  return true;
}

/** A2 rules 3–4: board → bench position (insert when room, swap when occupied). */
export function boardToBench(s: RunState, cell: number, benchIndex: number): boolean {
  const u = s.board[cell];
  if (!planning(s) || !u || benchIndex < 0) return false;
  const target = s.bench[benchIndex];
  if (target) {
    s.board[cell] = target;
    s.bench[benchIndex] = u;
    return true;
  }
  if (s.bench.length >= benchCap(s)) return false;
  s.board[cell] = null;
  s.bench.splice(Math.min(benchIndex, s.bench.length), 0, u);
  return true;
}

/** Board → board: move or swap. */
export function boardToBoard(s: RunState, from: number, to: number): boolean {
  const u = s.board[from];
  if (!planning(s) || !u || to < 0 || to >= s.board.length || from === to) return false;
  s.board[from] = s.board[to] ?? null;
  s.board[to] = u;
  return true;
}

/** A2 rules 5–6: bench reorder/swap, never creating holes. */
export function benchToBench(s: RunState, from: number, to: number): boolean {
  const u = s.bench[from];
  if (!planning(s) || !u || to < 0 || from === to) return false;
  if (s.bench[to]) {
    s.bench[from] = s.bench[to]!;
    s.bench[to] = u;
  } else {
    s.bench.splice(from, 1);
    s.bench.push(u);
  }
  return true;
}

/** A1.1: Start accepted only in PLANNING with ≥1 deployed unit. Returns reject reason or null. */
export function startCombat(s: RunState): string | null {
  if (!planning(s)) return "not_planning";
  if (boardCount(s) === 0) return "no_units";
  s.phase = "COMBAT";
  return null;
}
