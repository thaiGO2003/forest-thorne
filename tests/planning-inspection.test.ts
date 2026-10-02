import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  contextActionsFor, executePlanningContextAction, inspectPlanningSelection, resolvePlanningSelection,
  selectBenchUnit, selectBoardUnit, selectShopOffer,
  type PlanningSelection,
} from "../src/core/planningInspection";
import { benchToBoard, createRun, type OwnedUnit } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";

const base = NORMAL_UNITS[0]!;
const other = NORMAL_UNITS.find((unit) => unit.id !== base.id)!;
const owned = (uid: string, baseId = base.id, star: 1 | 2 | 3 = 1): OwnedUnit => ({ uid, baseId, star, equips: [] });
const run = (seed = 1) => { const state = createRun(seed); skipTutorial(state); return state; };

describe("A85 planning selection", () => {
  it("keeps owned identity by uid across bench -> board movement", () => {
    const s = run();
    s.bench = [owned("stable")];
    const selected = selectBenchUnit(s, 0)!;
    expect(benchToBoard(s, 0, 6)).toBe(true);

    const resolved = resolvePlanningSelection(s, selected)!;
    expect(resolved.selection).toMatchObject({ source: "BOARD", uid: "stable", row: 1, col: 1 });
  });

  it("uses remembered location only when base id still matches", () => {
    const s = run();
    s.bench = [owned("new-uid")];
    const stale: PlanningSelection = { source: "BENCH", uid: "gone", baseId: base.id, star: 1, index: 0 };
    expect(resolvePlanningSelection(s, stale)?.selection).toMatchObject({ uid: "new-uid", baseId: base.id });

    s.bench[0] = owned("different", other.id);
    expect(resolvePlanningSelection(s, stale)).toBeNull();
  });

  it("refreshes a shop selection after reroll/replacement", () => {
    const s = run();
    s.shop = [base.id, null, null, null, null];
    const selected = selectShopOffer(s, 0)!;
    s.shop[0] = other.id;
    expect(resolvePlanningSelection(s, selected)?.selection).toEqual({ source: "SHOP", baseId: other.id, star: 1, index: 0 });
  });

  it("uses deterministic no-selection fallback order", () => {
    const s = run();
    s.bench = [owned("bench-0"), owned("bench-1", other.id)];
    s.board[0] = owned("board");
    s.shop = [other.id, null, null, null, null];

    expect(resolvePlanningSelection(s, null, 1)?.selection).toMatchObject({ source: "BENCH", uid: "bench-1" });
    expect(resolvePlanningSelection(s)?.selection).toMatchObject({ source: "BENCH", uid: "bench-0" });
    s.bench = [];
    expect(resolvePlanningSelection(s)?.selection).toMatchObject({ source: "BOARD", uid: "board", row: 0, col: 0 });
    s.board.fill(null);
    expect(resolvePlanningSelection(s)?.selection).toMatchObject({ source: "SHOP", index: 0 });
    s.shop.fill(null);
    expect(resolvePlanningSelection(s)).toBeNull();
  });
});

describe("A85 planning inspection + context actions", () => {
  it("is star-aware and combines live resources with owner opening resources", () => {
    const s = run();
    s.startingRage = 2;
    s.startingShield = 7;
    s.board[6] = owned("unit", base.id, 2);
    const resolved = resolvePlanningSelection(s, selectBoardUnit(s, 1, 1))!;
    const inspected = inspectPlanningSelection(s, resolved, {
      liveResources: { unit: { hp: 11, maxHp: 222, rage: 1, rageMax: 5, shield: 3 } },
    });

    expect(inspected.star).toBe(2);
    expect(inspected.stats).toMatchObject({ hp: 11, maxHp: 222 });
    expect(inspected.resources).toMatchObject({ rageMax: 5, rage: 2, shield: 7, ownerStartingRage: 2, ownerStartingShield: 7 });
    expect(inspected.skill.rageCost).toBe(base.skill.rageCost[1]);
  });

  it("uses co-op row owner opening resources for a deployed ally", () => {
    const local = run(2);
    const rowOwner = run(3);
    rowOwner.startingRage = 4;
    rowOwner.startingShield = 9;
    local.board[10] = owned("ally");
    const resolved = resolvePlanningSelection(local, selectBoardUnit(local, 2, 0))!;

    const inspected = inspectPlanningSelection(local, resolved, { ownerForBoardRow: (row) => row === 2 ? rowOwner : undefined });
    expect(inspected.resources.ownerStartingRage).toBe(4);
    expect(inspected.resources.ownerStartingShield).toBe(9);
  });

  it("recalls through canonical board-to-bench, fails atomically when full, and sells canonically", () => {
    const s = run();
    s.board[0] = owned("board");
    let resolved = resolvePlanningSelection(s, selectBoardUnit(s, 0, 0))!;
    expect(contextActionsFor("BOARD")).toEqual(["DETAILS", "RECALL", "SELL"]);
    expect(executePlanningContextAction(s, resolved, "RECALL")).toMatchObject({ ok: true, mutated: true });
    expect(s.board[0]).toBeNull();
    expect(s.bench[0]?.uid).toBe("board");

    s.board[1] = owned("blocked", other.id);
    while (s.bench.length < 8) s.bench.push(owned(`b${s.bench.length}`, NORMAL_UNITS[s.bench.length + 2]!.id));
    resolved = resolvePlanningSelection(s, selectBoardUnit(s, 0, 1))!;
    const snapshot = JSON.stringify(s);
    expect(executePlanningContextAction(s, resolved, "RECALL")).toMatchObject({ ok: false, feedback: "bench_full" });
    expect(JSON.stringify(s)).toBe(snapshot);

    const benchSelection = resolvePlanningSelection(s, selectBenchUnit(s, 0))!;
    const gold = s.gold;
    expect(executePlanningContextAction(s, benchSelection, "SELL")).toMatchObject({ ok: true, mutated: true, selection: null });
    expect(s.gold).toBeGreaterThan(gold);
  });

  it("shop exposes Details only and inspection never creates an owned instance", () => {
    const s = run();
    s.shop = [base.id, null, null, null, null];
    const resolved = resolvePlanningSelection(s, selectShopOffer(s, 0))!;
    expect(contextActionsFor("SHOP")).toEqual(["DETAILS"]);
    expect(inspectPlanningSelection(s, resolved).uid).toBeNull();
    expect(executePlanningContextAction(s, resolved, "SELL")).toMatchObject({ ok: false, feedback: "action_unavailable" });
  });
});
