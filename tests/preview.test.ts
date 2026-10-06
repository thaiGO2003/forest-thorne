import { describe, expect, it } from "vitest";
import { createModeRun, createRun, enemyPreview } from "../src/core/run";
import { normalizeEnemyPreview } from "../src/core/preview";
import { placeCreativeClone } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";

describe("enemy preview A68/A103/A114", () => {
  it("starts empty, generates once, then reuses the same persisted round snapshot", () => {
    const s = createRun(21);
    skipTutorial(s);
    expect([s.enemyPreview, s.enemyPreviewRound, s.enemyBudget]).toEqual([[], 0, 0]);
    const first = enemyPreview(s)!;
    expect(first.source).toBe("generated");
    expect(first.units.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(first.units);
    const second = enemyPreview(s)!;
    expect(second.source).toBe("saved");
    expect(JSON.stringify(second.units)).toBe(serialized);
    expect(s.enemyPreviewRound).toBe(1);
    expect(s.enemyBudget).toBeGreaterThan(0);
  });

  it("normalizes catalog identity, star and enemy placement while dropping invalid entries", () => {
    expect(normalizeEnemyPreview([
      { baseId: "ant_guard", star: 99, row: -8, col: 2, equips: ["x", 4] },
      { baseId: "missing_unit", row: 2, col: 7 },
    ])).toEqual([
      expect.objectContaining({ baseId: "ant_guard", star: 3, row: 0, col: 5, equips: ["x"] }),
    ]);
  });

  it("Creative RIGHT formation overrides procedural preview and clears stored procedural data", () => {
    const s = createModeRun(22, "EndlessCreative");
    skipTutorial(s);
    s.bench = [{ uid: "source", baseId: "ant_guard", star: 1, equips: [] }];
    const cloneUid = placeCreativeClone(s, "bench", 0, 2, 7)!;
    s.enemyPreview = [{ uid: "old", baseId: "deer_song", star: 1, row: 2, col: 7 }];
    s.enemyPreviewRound = 1;
    s.enemyBudget = 999;
    const preview = enemyPreview(s)!;
    expect(preview.source).toBe("creative");
    expect(preview.units.map((unit) => unit.uid)).toEqual([cloneUid]);
    expect(s.enemyPreview).toEqual([]);
    expect(s.enemyBudget).toBe(0);
  });

  it("co-op guest consumes shared preview over conflicting local state and fails closed on a mismatched round", () => {
    const s = createRun(23);
    skipTutorial(s);
    s.enemyPreview = [{ uid: "local-stale", baseId: "deer_song", star: 1, row: 1, col: 6 }];
    s.enemyPreviewRound = 1;
    s.enemyBudget = 999;
    expect(enemyPreview(s, { isHost: false })).toBeNull();
    const shared = [{ uid: "host-e0", baseId: "ant_guard", star: 1, row: 2, col: 5 }];
    const resolved = enemyPreview(s, {
      isHost: false,
      sharedPreview: shared,
      sharedPreviewRound: 1,
      sharedEnemyBudget: 17,
    })!;
    expect(resolved).toMatchObject({ source: "shared", round: 1, budget: 17 });
    expect(s.enemyPreview).toEqual([expect.objectContaining(shared[0]!)]);
    expect(s.enemyPreview[0]?.uid).not.toBe("local-stale");

    s.round = 2;
    expect(enemyPreview(s, {
      isHost: false,
      sharedPreview: shared,
      sharedPreviewRound: 1,
      sharedEnemyBudget: 17,
    })).toBeNull();
    expect(s.enemyPreviewRound).toBe(1);
  });

  it("Fortress pending node budget multiplier is applied to generated preview", () => {
    const normal = createModeRun(24, "EndlessPvEFortress");
    const elite = createModeRun(24, "EndlessPvEFortress");
    normal.aiMode = "MEDIUM";
    elite.aiMode = "MEDIUM";
    elite.fortress.pendingNode = { nodeId: "test", type: "elite" };
    const base = enemyPreview(normal)!;
    const boosted = enemyPreview(elite)!;
    expect(boosted.budget).toBeGreaterThan(base.budget);
  });
});
