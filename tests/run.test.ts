import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  autoMerge, benchToBench, benchToBoard, boardToBench, buy, createRun, equipItem, refresh, sell, sellItem, startCombat,
  unequipAll, unequipItem,
  type OwnedUnit, type RunState,
} from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";

const t1 = NORMAL_UNITS.find((u) => u.tier === 1)!;
const otherSpecies = NORMAL_UNITS.find((u) => u.species !== t1.species)!;
const unit = (uid: string, equips: string[] = [], star: 1 | 2 | 3 = 1): OwnedUnit =>
  ({ uid, baseId: t1.id, star, equips });
const otherUnit = (uid: string): OwnedUnit => ({ ...unit(uid), baseId: otherSpecies.id });
const snap = (s: RunState) => JSON.stringify(s);
const normalRun = (seed: number) => { const s = createRun(seed); skipTutorial(s); return s; };

describe("run state", () => {
  it("same seed gives same shop (deterministic)", () => {
    expect(createRun(42).shop).toEqual(createRun(42).shop);
  });

  it("buy spends tier gold, nulls slot, appends 1★ to bench", () => {
    const s = normalRun(1);
    const id = s.shop[0]!;
    const gold = s.gold;
    expect(buy(s, 0)).toBe(true);
    expect(s.shop[0]).toBeNull();
    expect(s.gold).toBeLessThan(gold);
    expect(s.bench.at(-1)?.baseId).toBe(id);
  });

  it("failed buy (no gold / null slot) changes nothing", () => {
    const s = normalRun(1);
    s.gold = 0;
    const before = snap(s);
    expect(buy(s, 0)).toBe(false);
    s.shop[1] = null;
    expect(buy(s, 1)).toBe(false);
    expect(snap(s).replace(/"shop":\[[^\]]*\]/, "")).toBe(before.replace(/"shop":\[[^\]]*\]/, ""));
  });

  it("refresh rejected while locked", () => {
    const s = normalRun(3);
    s.shopLocked = true;
    const before = snap(s);
    expect(refresh(s)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("3 bench copies merge to 2★ at compact bench tail; overflow equips go to bag", () => {
    const s = normalRun(1);
    const other = NORMAL_UNITS.find((u) => u.species !== t1.species)!;
    s.bench = [
      unit("a", ["eq_blue_buff", "eq_warmog_armor"]),
      { ...unit("other"), baseId: other.id },
      unit("b", ["eq_blue_buff"]),
      unit("c", ["eq_warmog_armor", "eq_blue_buff", "eq_warmog_armor"]),
    ];
    expect(autoMerge(s)).toBe(1);
    expect(s.bench).toHaveLength(2);
    expect(s.bench[0]?.uid).toBe("other");
    const m = s.bench[1]!;
    expect(m.star).toBe(2);
    expect(new Set(m.equips).size).toBe(m.equips.length);
    // every source item is either kept or returned exactly once
    expect([...m.equips, ...s.itemBag].sort()).toEqual([
      "eq_blue_buff", "eq_blue_buff", "eq_blue_buff", "eq_warmog_armor", "eq_warmog_armor", "eq_warmog_armor",
    ].sort());
    expect(m.uid).not.toBe("a");
  });

  it("merge prefers first board location and chains 9 copies into 3★", () => {
    const s = normalRun(1);
    s.bench = Array.from({ length: 8 }, (_, i) => unit(`b${i}`));
    s.board[7] = unit("board");
    autoMerge(s);
    expect(s.bench).toHaveLength(0);
    expect(s.board[7]?.star).toBe(3);
  });

  it("deploy cap blocks placement onto empty cell without mutation", () => {
    const s = normalRun(1);
    s.board[0] = unit("a"); s.board[1] = unit("b"); s.board[2] = unit("c");
    s.bench = [{ ...unit("d"), baseId: NORMAL_UNITS.find((u) => u.species !== t1.species)!.id }];
    const before = snap(s);
    expect(benchToBoard(s, 0, 3)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(benchToBoard(s, 0, 0)).toBe(true); // swap still allowed at cap
    expect(s.bench[0]?.uid).toBe("a");
  });

  it("bench -> board rejects duplicate species atomically", () => {
    const s = normalRun(1);
    s.board[0] = unit("deployed");
    s.bench = [unit("candidate")];
    const before = snap(s);
    expect(benchToBoard(s, 0, 1)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("bench -> board respects swap permission and still allows a valid swap", () => {
    const s = normalRun(1);
    s.board[0] = otherUnit("board");
    s.bench = [unit("bench")];
    const before = snap(s);
    expect(benchToBoard(s, 0, 0, false)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(benchToBoard(s, 0, 0, true)).toBe(true);
    expect(s.board[0]?.uid).toBe("bench");
    expect(s.bench[0]?.uid).toBe("board");
  });

  it("board → full bench fails atomically", () => {
    const s = normalRun(1);
    s.bench = Array.from({ length: 8 }, (_, i) => ({ ...unit(`b${i}`), baseId: NORMAL_UNITS[i * 3]!.id }));
    s.board[4] = unit("z");
    const before = snap(s);
    expect(boardToBench(s, 4, 8)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("board -> bench rejects locked destination and forbidden swap atomically", () => {
    const s = normalRun(1);
    s.board[0] = otherUnit("board");
    s.bench = [unit("bench")];
    const before = snap(s);
    expect(boardToBench(s, 0, 8)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(boardToBench(s, 0, 0, false)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("board -> bench swap rejects a target species already deployed", () => {
    const s = normalRun(1);
    s.board[0] = unit("existing");
    s.board[1] = otherUnit("moving-out");
    s.bench = [unit("duplicate")];
    const before = snap(s);
    expect(boardToBench(s, 1, 0)).toBe(false);
    expect(snap(s)).toBe(before);
  });

  it("bench reorder obeys capacity, swap permission and compact insertion", () => {
    const s = normalRun(1);
    s.bench = [unit("a"), otherUnit("b"), unit("c")];
    const before = snap(s);
    expect(benchToBench(s, 0, 8)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(benchToBench(s, 0, 1, false)).toBe(false);
    expect(snap(s)).toBe(before);
    expect(benchToBench(s, 0, 5)).toBe(true);
    expect(s.bench.map((u) => u.uid)).toEqual(["b", "c", "a"]);
  });

  it("sell returns equips to bag; start needs a deployed unit", () => {
    const s = normalRun(1);
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

  it("equipment mutations are atomic and use canonical tier/cost rules", () => {
    const s = normalRun(1);
    s.bench = [unit("a")];
    s.itemBag = ["eq_blue_buff", "eq_warmog_armor"];
    const before = snap(s);
    expect(equipItem(s, "eq_warmog_armor", "bench", 0)).toBe(false); // T2 cannot equip on 1★
    expect(snap(s)).toBe(before);
    expect(equipItem(s, "eq_blue_buff", "bench", 0)).toBe(true);
    expect(s.itemBag).toEqual(["eq_warmog_armor"]);
    const gold = s.gold;
    expect(unequipItem(s, "bench", 0, 0)).toBe(true);
    expect(s.gold).toBe(gold - 2);
    expect(s.itemBag).toContain("eq_blue_buff");
    expect(equipItem(s, "eq_blue_buff", "bench", 0)).toBe(true);
    expect(unequipAll(s, "bench", 0)).toBe(true);
    expect(s.gold).toBe(gold - 4);
    const bagGold = s.gold;
    expect(sellItem(s, s.itemBag.indexOf("eq_warmog_armor"))).toBe(true);
    expect(s.gold).toBe(bagGold + 4);
  });
});
