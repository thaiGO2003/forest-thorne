import { describe, expect, it } from "vitest";
import {
  createRun, equipItem, slotCap, unequipAll, unequipItem, unequipQuote,
  type OwnedUnit, type Phase, type RunState,
} from "../src/core/run";
import { normalizeEquipment } from "../src/core/equipment";
import { skipTutorial } from "../src/core/tutorial";

const BLUE = "eq_blue_buff";
const ARMOR = "eq_warmog_armor";
const CELL = 12;
const BASE_ID = "deer_song";

function fixture(where: "bench" | "board", star: 1 | 2, equips: string[], bag: string[]): RunState {
  const run = createRun(317);
  skipTutorial(run);
  const unit: OwnedUnit = { uid: "equipment-guard", baseId: BASE_ID, star, equips: [...equips] };
  if (where === "bench") run.bench = [unit];
  else run.board[CELL] = unit;
  run.itemBag = [...bag];
  run.gold = 30;
  return run;
}

function rejected(run: RunState, action: () => boolean): void {
  const before = JSON.stringify(run);
  expect(action()).toBe(false);
  expect(JSON.stringify(run)).toBe(before);
}

describe("equipment transaction guards", () => {
  it.each(["bench", "board"] as const)("equips one bag copy on the %s for zero gold", (where) => {
    const run = fixture(where, 2, [], [BLUE, BLUE, ARMOR]);
    const index = where === "bench" ? 0 : CELL;
    run.gold = 0;
    expect(equipItem(run, BLUE, where, index)).toBe(true);
    expect((where === "bench" ? run.bench[0] : run.board[index])?.equips).toEqual([BLUE]);
    expect(run.itemBag).toEqual([BLUE, ARMOR]);
    expect(run.gold).toBe(0);
  });

  it("refuses an item when the unit's equipment slots are full", () => {
    const run = fixture("bench", 2, [BLUE, ARMOR], [BLUE]);
    expect(slotCap(BASE_ID, 2)).toBe(2);
    expect(normalizeEquipment([BLUE, ARMOR], 2, 1)).toEqual({
      kept: [BLUE],
      rejected: [ARMOR],
    });
    rejected(run, () => equipItem(run, BLUE, "bench", 0));
  });

  it("enforces tier and permits the same item after upgrading stars", () => {
    const run = fixture("bench", 1, [], [ARMOR]);
    rejected(run, () => equipItem(run, ARMOR, "bench", 0));
    run.bench[0]!.star = 2;
    expect(equipItem(run, ARMOR, "bench", 0)).toBe(true);
    expect(run.bench[0]!.equips).toEqual([ARMOR]);
    expect(run.itemBag).toEqual([]);
  });

  it("refuses duplicates even when slots remain available", () => {
    const run = fixture("bench", 2, [BLUE], [BLUE]);
    expect(slotCap(BASE_ID, 2)).toBeGreaterThan(run.bench[0]!.equips.length);
    rejected(run, () => equipItem(run, BLUE, "bench", 0));
  });

  it("refuses absent or unknown bag items and missing owned units atomically", () => {
    const run = fixture("bench", 2, [], [BLUE, "eq_unknown"]);
    rejected(run, () => equipItem(run, ARMOR, "bench", 0));
    rejected(run, () => equipItem(run, "eq_unknown", "bench", 0));
    rejected(run, () => equipItem(run, BLUE, "bench", 1));
    rejected(run, () => equipItem(run, BLUE, "board", CELL));
    rejected(run, () => unequipItem(run, "board", CELL, 0));
    rejected(run, () => unequipAll(run, "board", CELL));
    expect(unequipQuote(run, "board", CELL)).toBeNull();
  });

  it("fails closed on corrupt preexisting equipment without item loss", () => {
    const run = fixture("bench", 2, [BLUE, BLUE], [ARMOR]);
    rejected(run, () => equipItem(run, ARMOR, "bench", 0));
    expect(unequipQuote(run, "bench", 0)).toBeNull();
    rejected(run, () => unequipItem(run, "bench", 0, 0));
    rejected(run, () => unequipAll(run, "bench", 0));

    run.bench[0]!.equips = ["eq_unknown"];
    rejected(run, () => equipItem(run, ARMOR, "bench", 0));
    rejected(run, () => unequipAll(run, "bench", 0));

    run.bench[0]!.star = 1;
    run.bench[0]!.equips = [ARMOR];
    run.itemBag = [BLUE];
    rejected(run, () => equipItem(run, BLUE, "bench", 0));
    rejected(run, () => unequipItem(run, "bench", 0, 0));
  });

  it.each(["COMBAT", "AUGMENT", "GAME_OVER"] as const)(
    "rejects every equipment write in %s phase",
    (phase: Phase) => {
      const run = fixture("board", 2, [BLUE], [ARMOR]);
      run.phase = phase;
      rejected(run, () => equipItem(run, ARMOR, "board", CELL));
      rejected(run, () => unequipItem(run, "board", CELL, 0));
      rejected(run, () => unequipAll(run, "board", CELL));
    },
  );

  it("refuses invalid equipped indices without changing gold or ownership", () => {
    const run = fixture("bench", 2, [BLUE, ARMOR], []);
    rejected(run, () => unequipItem(run, "bench", 0, -1));
    rejected(run, () => unequipItem(run, "bench", 0, 2));
  });

  it("charges a single unequip only after checking affordable gold", () => {
    const run = fixture("bench", 2, [BLUE, ARMOR], []);
    expect(unequipQuote(run, "bench", 0)).toEqual([2, 7]);
    run.gold = 1;
    rejected(run, () => unequipItem(run, "bench", 0, 0));
    run.gold = 2;
    expect(unequipItem(run, "bench", 0, 0)).toBe(true);
    expect(run.gold).toBe(0);
    expect(run.bench[0]!.equips).toEqual([ARMOR]);
    expect(run.itemBag).toEqual([BLUE]);
  });

  it("does not partially charge or return items on an unaffordable unequip-all", () => {
    const run = fixture("board", 2, [BLUE, ARMOR], []);
    expect(unequipQuote(run, "board", CELL)).toEqual([2, 7]);
    run.gold = 8;
    rejected(run, () => unequipAll(run, "board", CELL));
    run.gold = 9;
    expect(unequipAll(run, "board", CELL)).toBe(true);
    expect(run.gold).toBe(0);
    expect(run.board[CELL]!.equips).toEqual([]);
    expect(run.itemBag).toEqual([BLUE, ARMOR]);
  });
});
