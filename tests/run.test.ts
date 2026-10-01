import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  autoMerge, benchToBoard, boardToBench, buy, createRun, refresh, sell, startCombat,
  type OwnedUnit, type RunState,
} from "../src/core/run";

const t1 = NORMAL_UNITS.find((u) => u.tier === 1)!;
const unit = (uid: string, equips: string[] = [], star: 1 | 2 | 3 = 1): OwnedUnit =>
  ({ uid, baseId: t1.id, star, equips });
const snap = (s: RunState) => JSON.stringify(s);

describe("run state", () => {
  it("same seed gives same shop (deterministic)", () => {
    expect(createRun(42).shop).toEqual(createRun(42).shop);
  });

  it("buy spends tier gold, nulls slot, appends 1★ to bench", () => {
    const s = createRun(1);
    const id = s.shop[0]!;
    const gold = s.gold;
    expect(buy(s, 0)).toBe(true);
    expect(s.shop[0]).toBeNull();
    expect(s.gold).toBeLessThan(gold);
    expect(s.bench.at(-1)?.baseId).toBe(id);
  });

  it("failed buy (no gold / null slot) changes nothing", () => {
    const s = createRun(1);
    s.gold = 0;
    const before = snap(s);
    expect(buy(s, 0)).toBe(false);
    s.shop[1] = null;
    expect(buy(s, 1)).toBe(false);
    expect(snap(s).replace(/"shop":\[[^\]]*\]/, "")).toBe(before.replace(/"shop":\[[^\]]*\]/, ""));
  });

  it("refresh rejected while locked", () => {
    const s = createRun(3);
    s.shopLocked = true;
    const before = snap(s);
    expect(refresh(s)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("3 copies merge to 2★ at first bench slot; overflow equips go to bag", () => {
    const s = createRun(1);
    s.bench = [unit("a", ["x", "y"]), unit("b", ["x"]), unit("c", ["z", "w", "v", "q", "r"])];
    expect(autoMerge(s)).toBe(1);
    expect(s.bench).toHaveLength(1);
    const m = s.bench[0]!;
    expect(m.star).toBe(2);
    expect(new Set(m.equips).size).toBe(m.equips.length);
    // every source item is either kept or returned exactly once
    expect([...m.equips, ...s.itemBag].sort()).toEqual(["q", "r", "v", "w", "x", "x", "y", "z"]);
  });

  it("merge prefers first board location and chains 9 copies into 3★", () => {
    const s = createRun(1);
    s.bench = Array.from({ length: 8 }, (_, i) => unit(`b${i}`));
    s.board[7] = unit("board");
    autoMerge(s);
    expect(s.bench).toHaveLength(0);
    expect(s.board[7]?.star).toBe(3);
  });

  it("deploy cap blocks placement onto empty cell without mutation", () => {
    const s = createRun(1);
    s.board[0] = unit("a"); s.board[1] = unit("b"); s.board[2] = unit("c");
    s.bench = [{ ...unit("d"), baseId: NORMAL_UNITS.find((u) => u.species !== t1.species)!.id }];
    const before = snap(s);
    expect(benchToBoard(s, 0, 3)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(benchToBoard(s, 0, 0)).toBe(true); // swap still allowed at cap
    expect(s.bench[0]?.uid).toBe("a");
  });

  it("board → full bench fails atomically", () => {
    const s = createRun(1);
    s.bench = Array.from({ length: 8 }, (_, i) => ({ ...unit(`b${i}`), baseId: NORMAL_UNITS[i * 3]!.id }));
    s.board[4] = unit("z");
    const before = snap(s);
    expect(boardToBench(s, 4, 8)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("sell returns equips to bag; start needs a deployed unit", () => {
    const s = createRun(1);
    expect(startCombat(s)).toBe("no_units");
    s.board[0] = unit("a", ["sword"]);
    const gold = s.gold;
    expect(sell(s, "board", 0)).toBe(true);
    expect(s.itemBag).toContain("sword");
    expect(s.gold).toBe(gold + t1.tier);
    s.board[0] = unit("b");
    expect(startCombat(s)).toBeNull();
    expect(s.phase).toBe("COMBAT");
    expect(buy(s, 0)).toBe(false);
  });
});
