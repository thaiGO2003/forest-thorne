import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  ACHIEVEMENT_CATEGORIES, achievementRows, claimAchievementSkin, claimSkinReward, createAchievementProfile,
  createCollectionProfile, equipCollectionSkin, equipUnitSkin, normalizeCollectionProfile, rankAchievementRows,
  recordEndlessAchievementEvent, unlockedAchievementCount, validateAchievementRewards,
} from "../src/core/achievements";
import {
  COMBAT_HISTORY_CAP, createCombatHistory, createPlanningHistory, filterPlanningHistory, HISTORY_FILTERS,
  normalizeHistoryCategory, normalizeHistoryDetails, PLANNING_HISTORY_CAP, pushCombatHistory,
  pushPlanningHistory, RECENT_LOG_CAP,
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
    const ranked = rankAchievementRows(p, createCollectionProfile(), [mapping]);
    expect(ranked[0]?.id).toBe("runs_started_1");
    expect(ranked[0]?.claimable).toBe(true);
  });

  it("normalizes the A104 collection profile shape and legacy skin ids", () => {
    const unitId = NORMAL_UNITS[0]!.id;
    expect(normalizeCollectionProfile({
      version: 1,
      unlockedSkinIds: ["skin.lofi_alpha", "skin.lofi_alpha", "", 7],
      claimedAchievementIds: ["runs_started_1", "runs_started_1", ""],
      equippedSkinByUnit: { [unitId]: "skin.lofi_old" },
      equippedSkinByUnitId: { [unitId]: "skin.lofi_alpha" },
    })).toEqual({
      version: 2,
      unlockedSkinIds: ["skin.loli_alpha"],
      claimedAchievementIds: ["runs_started_1"],
      equippedSkinByUnitId: { [unitId]: "skin.loli_alpha" },
    });
  });

  it("applies idempotent collection claim/equip persistence primitives", () => {
    const unitId = NORMAL_UNITS[0]!.id;
    const c = createCollectionProfile();
    expect(claimAchievementSkin(c, "runs_started_1", "")).toBe(true);
    expect(claimAchievementSkin(c, "", "skin.lofi_reward")).toBe(true);
    expect(claimAchievementSkin(c, "runs_started_1", "skin.loli_reward")).toBe(false);
    expect(c).toMatchObject({
      claimedAchievementIds: ["runs_started_1"],
      unlockedSkinIds: ["skin.loli_reward"],
    });
    expect(equipUnitSkin(c, unitId, "skin.lofi_reward")).toBe(true);
    expect(c.equippedSkinByUnitId[unitId]).toBe("skin.loli_reward");
    expect(equipUnitSkin(c, unitId, 42)).toBe(true);
    expect(c.equippedSkinByUnitId[unitId]).toBeUndefined();
  });

  it("validates achievement skin mapping invariants", () => {
    const unitId = NORMAL_UNITS[0]!.id;
    expect(validateAchievementRewards(
      [{ achievementId: "runs_started_1", skinId: "s1", unitId }],
      [{ id: "s1", unitId, unlockType: "achievement", appearanceStars: [1, 2, 3] }],
    )).toEqual([]);
    expect(validateAchievementRewards([], [{ id: "s1", unitId, unlockType: "achievement", appearanceStars: [1, 2, 3] }])).toContain("missing reward mapping for skin s1");
  });
});

describe("history retention", () => {
  it("caps recent at 6, Planning at 300 and filters newest-first by canonical category", () => {
    const h = createPlanningHistory();
    for (let i = 0; i < PLANNING_HISTORY_CAP + 12; i++) pushPlanningHistory(h, {
      message: `m${i}`, category: i % 2 ? "SHOP" : "COMBAT", timestamp: i, round: 1,
    });
    expect(h.entries).toHaveLength(PLANNING_HISTORY_CAP);
    expect(h.recent).toHaveLength(RECENT_LOG_CAP);
    expect(h.recent.at(-1)).toBe(`m${PLANNING_HISTORY_CAP + 11}`);
    expect(HISTORY_FILTERS).toEqual(["ALL", "COMBAT", "SHOP", "CRAFT", "EVENT"]);
    const shop = filterPlanningHistory(h, "SHOP");
    expect(shop.every((entry) => entry.category === "SHOP")).toBe(true);
    expect(shop[0]!.timestamp).toBeGreaterThan(shop.at(-1)!.timestamp);
    expect(filterPlanningHistory(h, "ALL")).toHaveLength(PLANNING_HISTORY_CAP);
  });

  it("normalizes malformed categories and infers Vietnamese category text without diacritic/case drift", () => {
    expect(normalizeHistoryCategory(" combat ")).toBe("COMBAT");
    expect(normalizeHistoryCategory("unknown")).toBe("EVENT");
    expect(normalizeHistoryCategory(42)).toBe("EVENT");

    const h = createPlanningHistory();
    pushPlanningHistory(h, { message: "Đã MUA một đơn vị từ cửa hàng", timestamp: 1 });
    pushPlanningHistory(h, { message: "Ghép CÔNG THỨC từ nguyên liệu", timestamp: 2 });
    pushPlanningHistory(h, { message: "Kỹ năng gây SÁT THƯƠNG chí mạng", timestamp: 3 });
    expect(h.entries.map((entry) => entry.category)).toEqual(["SHOP", "CRAFT", "COMBAT"]);
  });

  it("preserves rich fields, flattens detail payload and uses previewText for the compact log", () => {
    const h = createPlanningHistory();
    pushPlanningHistory(h, {
      id: "round-3", message: "Kết quả vòng", previewText: "Thắng vòng 3", timestamp: 3, round: 3,
      phase: "COMBAT", category: "bad", title: "Chiến thắng", summary: "Tổng kết", icon: "trophy", tone: "positive",
      meta: { gold: 12 }, details: ["  +10 vàng  ", ["", 2, [false, "  bounty +2  "]], null],
    });
    expect(normalizeHistoryDetails([" a ", ["", 0, true]])).toEqual(["a", "0", "true"]);
    expect(h.entries[0]).toMatchObject({
      id: "round-3", category: "EVENT", title: "Chiến thắng", summary: "Tổng kết",
      details: ["+10 vàng", "2", "false", "bounty +2"], icon: "trophy", tone: "positive", meta: { gold: 12 },
    });
    expect(h.recent).toEqual(["Thắng vòng 3"]);
  });

  it("caps current combat history at 240", () => {
    const h = createCombatHistory();
    for (let i = 0; i < COMBAT_HISTORY_CAP + 5; i++) pushCombatHistory(h, `e${i}`);
    expect(h.entries).toHaveLength(COMBAT_HISTORY_CAP);
    expect(h.entries[0]).toBe("e5");
  });
});
