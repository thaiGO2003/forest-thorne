import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { creativeRightEnemyOverride, mergeCreativeSandboxUnits, normalizeCreativeSandboxUnits } from "../src/core/creative";
import {
  benchCap, creativeEnemyOverride, createModeRun, moveCreativeSandboxUnit, placeCreativeClone, sellCreativeSandboxUnit,
  type OwnedUnit,
} from "../src/core/run";
import { inspectSave, saveRun } from "../src/core/save";

function mem() {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (key: string) => (key in m ? m[key]! : null),
    setItem: (key: string, value: string) => { m[key] = value; },
    removeItem: (key: string) => { delete m[key]; },
  };
}

const source = (uid: string, baseId = NORMAL_UNITS[0]!.id): OwnedUnit => ({ uid, baseId, star: 1, equips: [], traits: [] });

describe("Creative sandbox A46", () => {
  it("reserves one canonical bench slot for the Creative selector", () => {
    const s = createModeRun(0, "EndlessCreative");
    expect(benchCap(s)).toBe(7);
    s.benchUpgradeLevel = 4;
    expect(benchCap(s)).toBe(31);
  });

  it("clones owned identity without removing source and derives LEFT/RIGHT from battlefield column", () => {
    const s = createModeRun(1, "EndlessCreative");
    s.bench = [source("src")];
    const left = placeCreativeClone(s, "bench", 0, 1, 1)!;
    const right = placeCreativeClone(s, "bench", 0, 2, 7)!;
    expect(s.bench[0]?.uid).toBe("src");
    expect(s.creativeSandboxUnits.find((unit) => unit.uid === left)).toMatchObject({ sourceUid: "src", side: "LEFT", row: 1, col: 1 });
    expect(s.creativeSandboxUnits.find((unit) => unit.uid === right)).toMatchObject({ sourceUid: "src", side: "RIGHT", row: 2, col: 7 });
    expect(creativeEnemyOverride(s)?.map((unit) => unit.uid)).toEqual([right]);
  });

  it("rejects occupied normal LEFT cells and sandbox collisions; moving across seam changes override membership", () => {
    const s = createModeRun(2, "EndlessCreative");
    s.bench = [source("src")];
    s.board[0] = source("board");
    expect(placeCreativeClone(s, "bench", 0, 0, 0)).toBeNull();
    const uid = placeCreativeClone(s, "bench", 0, 0, 6)!;
    expect(placeCreativeClone(s, "bench", 0, 0, 6)).toBeNull();
    expect(creativeEnemyOverride(s)).toHaveLength(1);
    expect(moveCreativeSandboxUnit(s, uid, 3, 2)).toBe(true);
    expect(creativeEnemyOverride(s)).toBeNull();
  });

  it("merges three exact baseId+star copies on the same side and preserves first source position", () => {
    const baseId = NORMAL_UNITS[0]!.id;
    const make = (uid: string, row: number) => ({
      ...source(uid, baseId), sandbox: true as const, sourceUid: `origin-${uid}`, side: "RIGHT" as const, row, col: 6,
    });
    let n = 0;
    const result = mergeCreativeSandboxUnits([make("a", 0), make("b", 1), make("c", 2)], () => `merged-${++n}`);
    expect(result.merges).toBe(1);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toMatchObject({ uid: "merged-1", star: 2, row: 0, col: 6, side: "RIGHT", sourceUid: "origin-a" });
  });

  it("sell reports canonical value without mutating Creative wallet", () => {
    const s = createModeRun(3, "EndlessCreative");
    s.bench = [source("src")];
    const uid = placeCreativeClone(s, "bench", 0, 1, 6)!;
    const gold = s.gold;
    expect(sellCreativeSandboxUnit(s, uid)).toBeGreaterThan(0);
    expect(s.gold).toBe(gold);
    expect(s.creativeSandboxUnits).toHaveLength(0);
  });

  it("save normalization clamps malformed positions, drops duplicate occupancy and preserves RIGHT override data", () => {
    const baseId = NORMAL_UNITS[0]!.id;
    const normalized = normalizeCreativeSandboxUnits([
      { uid: "r", baseId, star: 1, equips: [], traits: [], side: "RIGHT", row: 99, col: 1, sandbox: true },
      { uid: "dup", baseId, star: 1, equips: [], traits: [], side: "RIGHT", row: 4, col: 5, sandbox: true },
      { uid: "bad", baseId: "ghost", star: 1, side: "LEFT", row: 0, col: 0 },
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ uid: "r", side: "RIGHT", row: 4, col: 5 });
    expect(creativeRightEnemyOverride(normalized)?.[0]).toMatchObject({ uid: "r", row: 4, col: 5 });
  });

  it("round-trips sandbox side, coordinates, equipment, variants and source identity through canonical save", () => {
    const store = mem();
    const run = createModeRun(4, "EndlessCreative");
    const tanker = NORMAL_UNITS.find((unit) => unit.role === "TANKER")!;
    run.bench = [{
      uid: "source-unit",
      baseId: tanker.id,
      star: 2,
      equips: ["eq_blue_buff"],
      traits: [{ id: "tanker_thick_armor", seed: 17 }],
    }];
    const cloneUid = placeCreativeClone(run, "bench", 0, 3, 8)!;

    saveRun(store, { player: run });
    const restored = inspectSave(store);
    expect(restored.status).toBe("valid");
    if (restored.status !== "valid") throw new Error(restored.status);
    expect(restored.envelope.payload.player?.creativeSandboxUnits).toEqual([
      expect.objectContaining({
        uid: cloneUid,
        baseId: tanker.id,
        star: 2,
        equips: ["eq_blue_buff"],
        traits: [{ id: "tanker_thick_armor", seed: 17 }],
        sandbox: true,
        sourceUid: "source-unit",
        side: "RIGHT",
        row: 3,
        col: 8,
      }),
    ]);
  });
});
