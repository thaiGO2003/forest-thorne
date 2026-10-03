import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  ACHIEVEMENT_CATEGORIES, achievementRows, claimSkinReward, createAchievementProfile, createCollectionProfile,
  equipCollectionSkin, rankAchievementRows, recordEndlessAchievementEvent, unlockedAchievementCount,
  validateAchievementRewards,
} from "../src/core/achievements";
import {
  applyRoundResult, autoMerge, buy, buyXp, chooseAugment, craftRunItem, createModeRun, createRun, refresh,
} from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
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

  it("tracks canonical Endless run mutations through a profile bound outside RunState", () => {
    const profile = createAchievementProfile();
    const s = createRun(101, profile);
    expect(profile.stats.runs_started).toBe(1);
    expect("achievementsProfile" in s).toBe(false);

    skipTutorial(s);
    s.gold = 100;
    expect(refresh(s)).toBe(true);
    expect(buyXp(s)).toBe(true);

    s.shop[0] = "ant_guard";
    expect(buy(s, 0)).toBe(true);
    s.bench = [
      { uid: "m1", baseId: "ant_guard", star: 1, equips: [] },
      { uid: "m2", baseId: "ant_guard", star: 1, equips: [] },
      { uid: "m3", baseId: "ant_guard", star: 1, equips: [] },
    ];
    expect(autoMerge(s)).toBe(1);

    s.phase = "AUGMENT";
    s.activeAugmentChoices = ["gold_cache_1"];
    expect(chooseAugment(s, "gold_cache_1")).toBe(true);

    s.craftTableLevel = 1;
    s.itemBag = ["tear"];
    const staged = Array<string | null>(9).fill(null);
    staged[4] = "tear";
    expect(craftRunItem(s, staged)).toBe("eq_blue_buff");

    s.phase = "COMBAT";
    const resolvedRound = s.round;
    expect(applyRoundResult(s, {
      combatId: "achievement-integration", winner: "LEFT", enemySurvivors: 0, enemyStars: [1], bounty: 0, drops: [],
    })).not.toBeNull();

    expect(profile.stats).toMatchObject({
      runs_started: 1,
      shop_refreshes: 1,
      xp_purchases: 1,
      units_bought: 1,
      merges: 1,
      augments_chosen: 1,
      crafted_items: 1,
      rounds_won: 1,
      best_round: resolvedRound,
    });

    s.phase = "COMBAT";
    s.hp = 1;
    expect(applyRoundResult(s, {
      combatId: "achievement-game-over", winner: "RIGHT", enemySurvivors: 1, enemyStars: [], bounty: 0, drops: [],
    })?.gameOver).toBe(true);
    expect(s.phase).toBe("GAME_OVER");
    expect(profile.stats).toMatchObject({ runs_started: 1, rounds_won: 1, rounds_lost: 1 });

    createModeRun(102, "EndlessCreative", profile);
    expect(profile.stats.runs_started).toBe(1);
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
