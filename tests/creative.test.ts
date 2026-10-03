import { describe, expect, it } from "vitest";
import { BOSSES, NORMAL_UNITS } from "../src/content/catalog";
import { creativeRightEnemyOverride, mergeCreativeSandboxUnits, normalizeCreativeSandboxUnits } from "../src/core/creative";
import { createEnvelope, migrate } from "../src/core/save";
import {
  addCreativeGold, addCreativeHp, benchCap, creativeEnemyOverride, createModeRun, moveCreativeSandboxUnit, placeCreativeClone,
  removeCreativeSandboxUnit, sellCreativeSandboxUnit, summonCreativeUnit,
  type OwnedUnit,
} from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
import { rollVariantTrait } from "../src/core/variants";

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

  it("allows explicit finite Creative gold/HP grants without changing ordinary economy suppression", async () => {
    const { sellItem } = await import("../src/core/run");
    const s = createModeRun(4, "EndlessCreative");
    skipTutorial(s);
    s.gold = 7;
    s.hp = 20;
    expect(addCreativeGold(s, 13)).toBe(13);
    expect(addCreativeHp(s, 25)).toBe(25);
    expect([s.gold, s.hp]).toEqual([20, 45]);
    expect(addCreativeGold(s, Number.POSITIVE_INFINITY)).toBe(0);
    expect(addCreativeHp(s, Number.NaN)).toBe(0);
    s.itemBag.push("tear");
    expect(sellItem(s, s.itemBag.length - 1)).toBe(true);
    expect(s.gold).toBe(20);

    const normal = createModeRun(5, "EndlessPvEClassic");
    const normalGold = normal.gold;
    const normalHp = normal.hp;
    expect(addCreativeGold(normal, 9)).toBe(0);
    expect(addCreativeHp(normal, 9)).toBe(0);
    expect([normal.gold, normal.hp]).toEqual([normalGold, normalHp]);
  });

  it("can summon every one of the 120 normal catalog units with independent sandbox identity", () => {
    const s = createModeRun(6, "EndlessCreative");
    expect(NORMAL_UNITS).toHaveLength(120);
    for (const def of NORMAL_UNITS) {
      const uid = summonCreativeUnit(s, def.id, 0, 6);
      expect(uid).not.toBeNull();
      expect(s.creativeSandboxUnits[0]).toMatchObject({
        uid, baseId: def.id, star: 1, sandbox: true, sourceUid: null, side: "RIGHT", row: 0, col: 6,
      });
      expect(removeCreativeSandboxUnit(s, uid!)).toBe(true);
    }
    const first = summonCreativeUnit(s, NORMAL_UNITS[0]!.id, 0, 6)!;
    const second = summonCreativeUnit(s, NORMAL_UNITS[0]!.id, 1, 6)!;
    expect(first).not.toBe(second);
    expect(BOSSES.length).toBeGreaterThan(0);
    expect(summonCreativeUnit(s, BOSSES[0]!.id, 2, 6)).toBeNull();
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

  it("round-trips sandbox position, equipment, variant and source identity through save migration", () => {
    const def = NORMAL_UNITS[0]!;
    const s = createModeRun(7, "EndlessCreative");
    const trait = rollVariantTrait(def.role, 12345);
    s.bench = [{ uid: "source-save", baseId: def.id, star: 2, equips: ["eq_blue_buff"], traits: [trait] }];
    const uid = placeCreativeClone(s, "bench", 0, 3, 8)!;
    const before = structuredClone(s.creativeSandboxUnits.find((unit) => unit.uid === uid)!);
    const restored = migrate(createEnvelope({ player: s }))!.envelope.payload.player!;
    expect(restored.creativeSandboxUnits).toEqual([before]);
  });
});
