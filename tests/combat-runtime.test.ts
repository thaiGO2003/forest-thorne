import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { resolveRunCombat } from "../src/core/combatRuntime";
import { createModeRun, createRun, type OwnedUnit } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";

const owned = (uid: string, baseId = "titan_earth", star: 1 | 2 | 3 = 1): OwnedUnit => ({
  uid,
  baseId,
  star,
  equips: [],
  traits: [],
});

function savedCombat(seed: number) {
  const s = createRun(seed);
  skipTutorial(s);
  s.board[0] = owned("player", "titan_earth", 3);
  s.teamAtkPct = 10_000;
  s.enemyPreview = [{
    uid: "saved-right",
    baseId: NORMAL_UNITS.find((unit) => unit.id !== "titan_earth")!.id,
    star: 1,
    row: 2,
    col: 5,
  }];
  s.enemyPreviewRound = s.round;
  s.enemyBudget = 37;
  return s;
}

describe("production combat runtime", () => {
  it("reuses the persisted same-round preview, clones persistent placements, and commits once", () => {
    const s = savedCombat(41);
    const boardBefore = structuredClone(s.board);
    const previewBefore = structuredClone(s.enemyPreview);

    const session = resolveRunCombat(s);
    expect(session).not.toBeNull();
    expect(session!.previewSource).toBe("saved");
    expect(session!.roster.filter((fighter) => fighter.side === "R").map((fighter) => fighter.uid))
      .toEqual(["saved-right"]);
    expect(session!.roster.find((fighter) => fighter.uid === "player")?.rage).toBe(s.startingRage);
    expect(s.board).toEqual(boardBefore);
    expect(s.enemyPreview).toEqual([{ ...previewBefore[0]!, equips: [], traits: [] }]);
    const normalizedPreview = structuredClone(s.enemyPreview);
    expect(s.phase).toBe("COMBAT");

    const first = session!.finish();
    expect(first).not.toBeNull();
    expect(s.appliedCombats).toEqual([session!.combatId]);
    const after = structuredClone(s);
    expect(session!.finish()).toBeNull();
    expect(s).toEqual(after);
    expect(s.board).toEqual(boardBefore);
    expect(s.enemyPreview).toEqual(normalizedPreview);
  });

  it("is deterministic for combat events and loot from identical canonical run state", () => {
    const a = savedCombat(77);
    const b = savedCombat(77);

    const combatA = resolveRunCombat(a)!;
    const combatB = resolveRunCombat(b)!;
    expect(combatA.combatId).toBe(combatB.combatId);
    expect(combatA.events).toEqual(combatB.events);

    const resultA = combatA.finish()!;
    const resultB = combatB.finish()!;
    expect(resultA).toEqual(resultB);
    expect(resultA.acceptedDrops.length + resultA.rejectedDrops.length).toBeGreaterThan(0);
  });

  it("consumes the exact Creative RIGHT formation without procedural preview generation", () => {
    const s = createModeRun(91, "EndlessCreative");
    skipTutorial(s);
    s.board[0] = owned("creative-left", "titan_earth", 2);
    const rightBaseId = NORMAL_UNITS.find((unit) => unit.id !== "titan_earth")!.id;
    s.creativeSandboxUnits = [{
      uid: "manual-right",
      baseId: rightBaseId,
      star: 2,
      equips: [],
      traits: [],
      sandbox: true,
      sourceUid: null,
      side: "RIGHT",
      row: 4,
      col: 8,
    }];

    const session = resolveRunCombat(s);
    expect(session).not.toBeNull();
    expect(session!.previewSource).toBe("creative");
    expect(session!.roster.filter((fighter) => fighter.side === "R").map((fighter) => ({
      uid: fighter.uid,
      baseId: fighter.baseId,
      star: fighter.star,
    }))).toEqual([{ uid: "manual-right", baseId: rightBaseId, star: 2 }]);
    expect(s.enemyPreview).toEqual([]);
  });

  it("honors the canonical start gate and leaves a rejected run out of combat", () => {
    const s = savedCombat(101);
    s.phase = "AUGMENT";

    expect(resolveRunCombat(s)).toBeNull();
    expect(s.phase).toBe("AUGMENT");
    expect(s.appliedCombats).toEqual([]);
  });
});
