import { describe, expect, it } from "vitest";
import {
  applyRoundResult, benchToBoard, buy, chooseAugment, craftRunItem, createRun, equipItem, prepareTutorialRound, refresh,
  stageRunCraftItem, startCombat, type OwnedUnit,
} from "../src/core/run";
import {
  currentTutorialStep, dismissTutorialStep, incrementTutorialShopVariant, recommendedTutorialDeployCell,
  recordTutorialEvent, skipTutorial, syncTutorialRound, tutorialActionAllowed, tutorialShop,
  TUTORIAL_AUGMENT_IDS,
} from "../src/core/tutorial";
import { getUnit } from "../src/content/catalog";

const owned = (uid: string, baseId = "ant_guard", star: 1 | 2 | 3 = 1): OwnedUnit =>
  ({ uid, baseId, star, equips: [] });

describe("tutorial A94/A108", () => {
  it("uses the authored round-1 shop and blocks mutations until the exact step/target is legal", () => {
    const s = createRun(7);
    expect(s.shop.slice(0, 5)).toEqual(["ant_guard", "deer_song", "falcon_dive", "cat_goldbow", "ram_charge"]);
    expect(currentTutorialStep(s)?.id).toBe("welcome");
    expect(buy(s, 0)).toBe(false);

    expect(dismissTutorialStep(s, "welcome")).toBe(true);
    expect(currentTutorialStep(s)?.id).toBe("buy_unit");
    expect(buy(s, 1)).toBe(false);
    expect(buy(s, 0)).toBe(true);
    expect(currentTutorialStep(s)?.id).toBe("deploy_first_unit");

    const first = s.bench[0]!;
    const recommended = recommendedTutorialDeployCell(s, first)!;
    const wrong = Array.from({ length: 25 }, (_, i) => i).find((cell) => cell !== recommended)!;
    expect(benchToBoard(s, 0, wrong)).toBe(false);
    expect(benchToBoard(s, 0, recommended)).toBe(true);
    expect(currentTutorialStep(s)?.id).toBe("explain_synergy");

    dismissTutorialStep(s, "explain_synergy");
    const offer = s.shop.findIndex(Boolean);
    expect(buy(s, offer)).toBe(true);
    const second = s.bench[0]!;
    expect(benchToBoard(s, 0, recommendedTutorialDeployCell(s, second)!)).toBe(true);
    expect(currentTutorialStep(s)?.id).toBe("start_combat");
    expect(startCombat(s)).toBeNull();
    expect(s.tutorial.roundEventCounts.begin_combat).toBe(1);
  });

  it("resolves tutorial reroll variants deterministically and falls back to variant zero", () => {
    const s = createRun(8);
    s.round = 2;
    syncTutorialRound(s);
    s.shop = tutorialShop(2, 0, 5)!;
    for (const id of ["round2_intro", "explain_gold", "explain_xp", "explain_deploy_cap"]) {
      expect(dismissTutorialStep(s, id)).toBe(true);
    }
    s.gold = 100;
    expect(refresh(s)).toBe(true);
    expect(s.tutorial.shopVariant).toBe(1);
    expect(s.shop.slice(0, 5)).toEqual(["eagle_marksman", "owl_nightshot", "deer_song", "ant_guard", "ram_charge"]);
    incrementTutorialShopVariant(s);
    expect(tutorialShop(2, s.tutorial.shopVariant, 5)).toEqual([
      "ram_charge", "fox_flame", "cat_goldbow", "deer_song", "ant_guard",
    ]);
  });

  it("prepares rounds 3/5/6/7 once without duplicating authored gifts", () => {
    const round3 = createRun(9);
    round3.round = 3;
    syncTutorialRound(round3);
    expect(prepareTutorialRound(round3)).toEqual({ prepared: true, clearCraftStaging: false });
    expect(round3.bench.map((u) => u.baseId)).toEqual(["falcon_dive"]);
    expect(prepareTutorialRound(round3).prepared).toBe(false);
    expect(round3.bench).toHaveLength(1);

    const round5 = createRun(10);
    round5.round = 5;
    round5.board[0] = owned("round5");
    syncTutorialRound(round5);
    prepareTutorialRound(round5);
    expect(round5.itemBag.filter((id) => id === "eq_warmog_armor")).toHaveLength(1);
    expect(round5.board[0]?.star).toBe(2);
    prepareTutorialRound(round5);
    expect(round5.itemBag.filter((id) => id === "eq_warmog_armor")).toHaveLength(1);
    expect(round5.board[0]?.star).toBe(2);

    const round6 = createRun(11);
    round6.round = 6;
    syncTutorialRound(round6);
    expect(prepareTutorialRound(round6)).toEqual({ prepared: true, clearCraftStaging: true });
    expect(round6.craftTableLevel).toBe(1);
    expect(round6.itemBag).toContain("tear");
    expect(round6.tutorial.markers.clearCraftStaging).toBe(true);

    const round7 = createRun(12);
    round7.round = 7;
    round7.augmentRoundsTaken = [3, 5, 7];
    syncTutorialRound(round7);
    prepareTutorialRound(round7);
    expect(round7.augmentRoundsTaken).toEqual([3, 5]);
  });

  it("uses the exact round-7 augment ids through the canonical augment transaction", () => {
    const s = createRun(13);
    s.round = 6;
    s.tutorial.currentRound = 6;
    s.phase = "COMBAT";
    s.board[0] = owned("a");
    const result = applyRoundResult(s, {
      combatId: "to-r7", winner: "DRAW", enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [],
    });
    expect(result?.nextRound).toBe(7);
    expect(s.phase).toBe("AUGMENT");
    expect(s.activeAugmentChoices).toEqual([...TUTORIAL_AUGMENT_IDS]);
    expect(currentTutorialStep(s)?.id).toBe("round7_choose_augment");
    expect(chooseAugment(s, "wild_command")).toBe(true);
    expect(s.augments).toContain("wild_command");
    expect(s.deployCapBonus).toBe(1);
    expect(s.tutorial.markers.lastAugmentName).toBe("wild_command");
    expect(currentTutorialStep(s)?.id).toBe("round7_augment_summary");
  });

  it("keeps craft staging external while enforcing the tutorial center-slot and atomic craft flow", () => {
    const s = createRun(14);
    s.round = 6;
    syncTutorialRound(s);
    prepareTutorialRound(s);
    s.board[0] = owned("crafter");
    expect(dismissTutorialStep(s, "round6_intro")).toBe(true);
    const empty = Array<string | null>(9).fill(null);
    expect(stageRunCraftItem(s, empty, 3, "tear")).toBeNull();
    const staged = stageRunCraftItem(s, empty, 4, "tear")!;
    expect(staged[4]).toBe("tear");
    expect(currentTutorialStep(s, { craftGrid: staged })?.id).toBe("round6_craft_item");
    expect(craftRunItem(s, staged)).toBe("eq_blue_buff");
    expect(s.itemBag).toContain("eq_blue_buff");
    const cleared = Array<string | null>(9).fill(null);
    expect(currentTutorialStep(s, { craftGrid: cleared })?.id).toBe("round6_equip_crafted_item");
    expect(equipItem(s, "eq_blue_buff", "board", 0)).toBe(true);
    expect(s.itemBag).not.toContain("eq_blue_buff");
    expect(currentTutorialStep(s, { craftGrid: cleared })?.id).toBe("round6_start_combat");
  });

  it("supports external settings/history events and skip without synthesizing completion", () => {
    const s = createRun(15);
    expect(tutorialActionAllowed(s, "settings_audio")).toBe(true);
    recordTutorialEvent(s, "open_settings");
    expect(s.tutorial.roundEventCounts.open_settings).toBe(1);
    expect(skipTutorial(s)).toBe(true);
    expect(s.tutorialSkipped).toBe(true);
    expect(s.tutorial.completed).toBe(false);
    expect(s.aiMode).toBe("EASY");
    expect(s.tutorial.roundEventCounts.skip_tutorial).toBe(1);
    expect(currentTutorialStep(s)).toBeNull();
  });

  it("marks completion and hands AI to EASY only after the final tutorial combat resolves", () => {
    const s = createRun(16);
    s.round = 8;
    syncTutorialRound(s);
    s.board[0] = owned("final", getUnit("ant_guard").id);
    expect(dismissTutorialStep(s, "round8_intro")).toBe(true);
    expect(startCombat(s)).toBeNull();
    expect(s.tutorial.completed).toBe(false);
    applyRoundResult(s, { combatId: "tutorial-final", winner: "DRAW", enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [] });
    expect(s.round).toBe(9);
    expect(s.tutorial.completed).toBe(true);
    expect(s.aiMode).toBe("EASY");
  });
});
