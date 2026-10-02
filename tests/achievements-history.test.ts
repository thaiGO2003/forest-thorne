import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  ACHIEVEMENT_CATEGORIES, achievementRows, claimAchievementSkin, claimSkinReward, createAchievementProfile,
  createCollectionProfile, equipCollectionSkin, equipUnitSkin, normalizeCollectionProfile, rankAchievementRows,
  recordEndlessAchievementEvent, unlockedAchievementCount, validateAchievementRewards,
} from "../src/core/achievements";
import {
  COMBAT_HISTORY_CAP, createCombatHistory, createPlanningHistory, filterPlanningHistory, PLANNING_HISTORY_CAP,
  pushCombatHistory, pushPlanningHistory, RECENT_LOG_CAP,
} from "../src/core/history";

describe("achievement + collection profile", () => {
  it("defines exactly 100 threshold achievements and tracks only Endless Classic", () => {
    expect(ACHIEVEMENT_CATEGORIES).toHaveLength(10);
    const p = createAchievementProfile();
    expect(achievementRows(p)).toHaveLength(100);
    expect(recordEndlessAchievementEvent(p, "EndlessCreative", { type: "run_started" })).toBe(false);
    expect(recordEndlessAchievementEvent(p, "EndlessPvEClassic", { type: "run_started" })).toBe(true);
    recordEndlessAchievementEvent(p, "EndlessPvEClassic", {
      type: "round_result", round: 8, won: true, lost: false, itemsLooted: 3, gold: 42, level: 5, winStreak: 4,
    });
    expect(p.stats).toMatchObject({ runs_started: 1, rounds_won: 1, best_round: 8, items_looted: 3, highest_gold: 42, highest_level: 5, best_win_streak: 4 });
    expect(unlockedAchievementCount(p)).toBeGreaterThan(0);
  });

  it("claims a reward once, equips only unlocked skins and ranks claimable rows first", () => {
    const p = createAchievementProfile();
    recordEndlessAchievementEvent(p, "EndlessPvEClassic", { type: "run_started" });
    const c = createCollectionProfile();
    const mapping = { achievementId: "runs_started_1", skinId: "skin_test", unitId: NORMAL_UNITS[0]!.id };
    expect(claimSkinReward(p, c, mapping)).toBe(true);
    expect(claimSkinReward(p, c, mapping)).toBe(false);
    expect(equipCollectionSkin(c, mapping.unitId, "locked_skin")).toBe(false);
    expect(equipCollectionSkin(c, mapping.unitId, "skin_test")).toBe(true);
    expect(c.equippedSkinByUnitId[mapping.unitId]).toBe("skin_test");
    const ranked = rankAchievementRows(p, createCollectionProfile(), [mapping]);
    expect(ranked[0]?.id).toBe("runs_started_1");
    expect(ranked[0]?.claimable).toBe(true);
  });

  it("validates achievement skin mapping invariants", () => {
    const unitId = NORMAL_UNITS[0]!.id;
    expect(validateAchievementRewards(
      [{ achievementId: "runs_started_1", skinId: "s1", unitId }],
      [{ id: "s1", unitId, unlockType: "achievement", appearanceStars: [1, 2, 3] }],
    )).toEqual([]);
    expect(validateAchievementRewards([], [{ id: "s1", unitId, unlockType: "achievement", appearanceStars: [1, 2, 3] }])).toContain("missing reward mapping for skin s1");
  });

  it("normalizes the v2 collection shape and migrates legacy .lofi_ skin ids", () => {
    const unitId = NORMAL_UNITS[0]!.id;
    const collection = normalizeCollectionProfile({
      version: 1,
      unlockedSkinIds: ["skin.lofi_red", " skin.loli_red ", ""],
      claimedAchievementIds: [" a1 ", "a1", ""],
      equippedSkinByUnit: { [unitId]: "skin.lofi_red" },
    });
    expect(collection).toEqual({
      version: 2,
      unlockedSkinIds: ["skin.loli_red"],
      claimedAchievementIds: ["a1"],
      equippedSkinByUnitId: { [unitId]: "skin.loli_red" },
    });
    expect(claimAchievementSkin(collection, "a2", "skin.lofi_blue")).toBe(true);
    expect(claimAchievementSkin(collection, "a2", "skin.loli_blue")).toBe(false);
    expect(collection.unlockedSkinIds).toContain("skin.loli_blue");
    expect(equipUnitSkin(collection, unitId, "skin.lofi_blue")).toBe(true);
    expect(collection.equippedSkinByUnitId[unitId]).toBe("skin.loli_blue");
    expect(equipUnitSkin(collection, unitId, " ")).toBe(true);
    expect(collection.equippedSkinByUnitId[unitId]).toBeUndefined();
  });
});

describe("history retention", () => {
  it("caps recent at 6, Planning at 300 and filters by canonical category", () => {
    const h = createPlanningHistory();
    for (let i = 0; i < PLANNING_HISTORY_CAP + 12; i++) pushPlanningHistory(h, {
      message: `m${i}`, category: i % 2 ? "SHOP" : "COMBAT", timestamp: i, round: 1,
    });
    expect(h.entries).toHaveLength(PLANNING_HISTORY_CAP);
    expect(h.recent).toHaveLength(RECENT_LOG_CAP);
    expect(h.recent.at(-1)).toBe(`m${PLANNING_HISTORY_CAP + 11}`);
    expect(filterPlanningHistory(h, "SHOP").every((entry) => entry.category === "SHOP")).toBe(true);
    expect(filterPlanningHistory(h, "ALL")).toHaveLength(PLANNING_HISTORY_CAP);
  });

  it("caps current combat history at 240", () => {
    const h = createCombatHistory();
    for (let i = 0; i < COMBAT_HISTORY_CAP + 5; i++) pushCombatHistory(h, `e${i}`);
    expect(h.entries).toHaveLength(COMBAT_HISTORY_CAP);
    expect(h.entries[0]).toBe("e5");
  });
});
