import { describe, expect, it } from "vitest";
import { createBridge } from "../src/app/bridge";
import { inspectSave, saveAchievementProfile, saveRun, PROGRESS_KEY } from "../src/core/save";
import { buy, benchToBoard, inventoryCapacity } from "../src/core/run";
import { unitDiagnostics } from "../src/core/inspection";
import { skipTutorial, syncTutorialRound } from "../src/core/tutorial";
import {
  ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_COMPLETION_CLAIM_ID, ACHIEVEMENT_REWARDS,
  ACHIEVEMENT_THRESHOLDS, achievementRows,
} from "../src/core/achievements";
import type { KV } from "../src/core/settings";

function storage(): KV {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
function deployed() {
  const store = storage(), bridge = createBridge(store);
  const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
  expect(buy(run, 0)).not.toBeNull();
  expect(benchToBoard(run, 0, 12)).toBe(true);
  bridge.checkpoint("SHOP", "Mua và triển khai tướng");
  return { store, bridge, run };
}

describe("recovered application bridge", () => {
  it("drops the active in-memory run without overwriting newly imported progress", () => {
    const { store, bridge } = deployed();
    const imported = createBridge(storage());
    const replacement = imported.newRun("EndlessPvEClassic", "EASY");
    saveRun(store, { player: replacement });
    const before = store.getItem(PROGRESS_KEY);
    bridge.forgetRun();
    bridge.checkpoint("EVENT", "Đóng cài đặt");
    expect(bridge.run()).toBeNull();
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(replacement.aiMode).toBe("EASY");
  });
  it("imports a valid exported run through Bridge and makes it resumable", () => {
    const source = createBridge(storage());
    const sourceRun = source.newRun("EndlessPvEClassic", "EASY");
    sourceRun.gold = 37;
    source.checkpoint("EVENT", "Chuẩn bị xuất phiên chơi");
    const exported = source.exportRun();
    expect(exported).not.toBeNull();

    const store = storage();
    const bridge = createBridge(store);
    expect(bridge.importRun(exported!.text)).toBe(true);
    expect(bridge.run()?.gold).toBe(37);
    expect(bridge.run()?.aiMode).toBe("EASY");

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.gold).toBe(37);
  });

  it("rejects malformed imported JSON without replacing existing progress", () => {
    const { store, bridge, run } = deployed();
    const before = store.getItem(PROGRESS_KEY);
    expect(bridge.importRun("{not-json")).toBe(false);
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(bridge.run()).toBe(run);
  });

  it("normalizes imported interrupted combat to Planning like Continue", () => {
    const source = createBridge(storage());
    const sourceRun = source.newRun("EndlessPvEClassic", "MEDIUM");
    sourceRun.phase = "COMBAT";
    source.checkpoint("EVENT", "Mô phỏng phiên bị gián đoạn");
    const exported = source.exportRun();
    expect(exported).not.toBeNull();

    const store = storage();
    const bridge = createBridge(store);
    expect(bridge.importRun(exported!.text)).toBe(true);
    expect(bridge.run()?.phase).toBe("PLANNING");
    const saved = inspectSave(store);
    expect(saved.status).toBe("valid");
    if (saved.status !== "valid") throw new Error("imported save missing");
    expect(saved.envelope.payload.player?.phase).toBe("PLANNING");
  });
  it("persists newer HUD mutations and structured history through one checkpoint", () => {
    const { store, bridge, run } = deployed();
    const inspection = inspectSave(store);
    expect(inspection.status).toBe("valid");
    if (inspection.status !== "valid") throw new Error("save missing");
    expect(inspection.envelope.payload.player?.board[12]?.uid).toBe(run.board[12]?.uid);
    expect(bridge.history().entries.at(-1)?.category).toBe("SHOP");
    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.board[12]?.uid).toBe(run.board[12]?.uid);
  });

  it("reorders weather blessings through the Bridge and persists the chosen order", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.blessingQueue = ["weather_fire", "weather_tide", "weather_wind"];
    bridge.checkpoint("EVENT", "Seed weather blessing queue");

    expect(bridge.reorderWeatherBlessing(2, 0)).toBe(true);
    expect(run.blessingQueue).toEqual(["weather_wind", "weather_fire", "weather_tide"]);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.blessingQueue).toEqual(["weather_wind", "weather_fire", "weather_tide"]);
  });

  it("keeps planning history across a completed combat round and clears it for a new run", () => {
    const { bridge } = deployed();
    const planningMessage = "Mốc lập kế hoạch cần giữ";
    bridge.checkpoint("EVENT", planningMessage);
    expect(bridge.history().entries.some((entry) => entry.message === planningMessage)).toBe(true);

    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    expect(session?.finish()).not.toBeNull();
    expect(bridge.run()?.phase).toBe("PLANNING");
    expect(bridge.run()?.round).toBe(2);
    expect(bridge.history().entries.some((entry) => entry.message === planningMessage)).toBe(true);

    bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(bridge.history().entries).toEqual([]);
    expect(bridge.history().recent).toEqual([]);
  });

  it("replays an interrupted combat without paying its rewards twice", () => {
    const { store, bridge } = deployed();
    const original = bridge.startCombat();
    expect(original).not.toBeNull();
    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.phase).toBe("PLANNING");
    const replay = resumed.startCombat();
    expect(replay?.events).toEqual(original?.events);
    expect(replay?.finish()).not.toBeNull();
    const after = JSON.stringify(resumed.run());
    expect(replay?.finish()).toBeNull();
    expect(JSON.stringify(resumed.run())).toBe(after);
    expect(resumed.run()?.round).toBe(2);
  });

  it("projects resolved live fighters through the diagnostic snapshot", () => {
    const { bridge, run } = deployed();
    const owned = run.board[12]!;
    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    const snapshot = bridge.combatSnapshot();
    const live = snapshot?.fighters.find((fighter) => fighter.uid === owned.uid);
    expect(live).toBeDefined();
    if (!snapshot || !live) throw new Error("live combat diagnostic missing");
    const diagnostic = unitDiagnostics(
      { uid: owned.uid, baseId: owned.baseId, star: owned.star, row: 2, col: 2, equips: [...owned.equips], traits: [...(owned.traits ?? [])] },
      "L",
      {},
      snapshot.environment,
      live,
      false,
    );
    expect(diagnostic.live).toMatchObject({
      hp: live.hp,
      maxHp: live.maxHp,
      rage: live.rage,
      shield: live.shield,
      alive: live.alive,
    });
    expect(session?.fighters.find((fighter) => fighter.uid === owned.uid)?.hp).toBe(live.hp);
  });

  it("Finish Fast commits one canonical bridge result, persists it, and stale natural finish cannot reapply it", () => {
    const { store, bridge, run } = deployed();
    run.gold = 50;
    bridge.checkpoint("EVENT", "Chuẩn bị Finish Fast");
    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    const combatGold = run.gold;
    const summary = session?.finishFast();
    expect(summary).not.toBeNull();
    if (!summary) throw new Error("Finish Fast unexpectedly rejected");
    const expectedGold = combatGold + summary.goldEarned + summary.incomeEarned - 10;
    expect(run.gold).toBe(expectedGold);
    expect(run.round).toBe(2);
    const after = JSON.stringify(run);
    expect(session?.finish()).toBeNull();
    expect(session?.finishFast()).toBeNull();
    expect(JSON.stringify(run)).toBe(after);
    expect(bridge.history().entries.filter((entry) => entry.message.includes("Kết thúc giao tranh"))).toHaveLength(1);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.round).toBe(2);
    expect(resumed.run()?.gold).toBe(expectedGold);
  });

  it("Finish Fast rejects insufficient gold without mutating the resolved combat state", () => {
    const { bridge, run } = deployed();
    run.gold = 9;
    bridge.checkpoint("EVENT", "Chuẩn bị Finish Fast thiếu vàng");
    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    const before = JSON.stringify(run);
    expect(session?.finishFast()).toBeNull();
    expect(JSON.stringify(run)).toBe(before);
  });

  it("natural finish prevents a later Finish Fast charge or second result application", () => {
    const { bridge, run } = deployed();
    run.gold = 50;
    bridge.checkpoint("EVENT", "Chuẩn bị kết thúc thường");
    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    expect(session?.finish()).not.toBeNull();
    const after = JSON.stringify(run);
    expect(session?.finishFast()).toBeNull();
    expect(JSON.stringify(run)).toBe(after);
  });

  it("does not publish a completed session after the player starts a different run", () => {
    const { bridge } = deployed();
    const session = bridge.startCombat();
    const replacement = bridge.newRun("EndlessPvEClassic", "EASY");
    const before = JSON.stringify(replacement);
    expect(session?.finish()).toBeNull();
    expect(session?.finishFast()).toBeNull();
    expect(JSON.stringify(bridge.run())).toBe(before);
  });

  it("prepares and persists the enemy preview while still in Planning", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(run.enemyPreview).toEqual([]);

    const preview = bridge.prepareEnemyPreview();
    expect(preview?.units.length).toBeGreaterThan(0);
    expect(run.phase).toBe("PLANNING");
    expect(run.enemyPreview).toEqual(preview?.units);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.enemyPreview).toEqual(preview?.units);
    expect(resumed.prepareEnemyPreview()?.source).toBe("saved");
  });

  it("materializes the prepared Planning fight without mutating or persisting combat state", () => {
    const { store, bridge, run } = deployed();
    const preview = bridge.prepareEnemyPreview();
    expect(preview?.units.length).toBeGreaterThan(0);
    if (!preview) throw new Error("enemy preview missing");
    const runBefore = JSON.stringify(run);
    const persistedBefore = store.getItem(PROGRESS_KEY);
    const heartsBefore = run.hp;

    const fighters = bridge.planningCombatProjection(preview);

    expect(fighters?.some((fighter) => fighter.uid === run.board[12]?.uid && fighter.side === "L")).toBe(true);
    expect(fighters?.filter((fighter) => fighter.side === "R").map((fighter) => fighter.uid)).toEqual(preview.units.map((unit) => unit.uid));
    expect(run.phase).toBe("PLANNING");
    expect(run.hp).toBe(heartsBefore);
    expect(JSON.stringify(run)).toBe(runBefore);
    expect(store.getItem(PROGRESS_KEY)).toBe(persistedBefore);
  });

  it("rejects combat on an empty board without mutating the run", () => {
    const bridge = createBridge(storage());
    bridge.newRun("EndlessPvEClassic", "MEDIUM");
    const before = JSON.stringify(bridge.run());
    expect(bridge.startCombat()).toBeNull();
    expect(JSON.stringify(bridge.run())).toBe(before);
  });
  it("persists tutorial dismissal and canonical skip across resume", () => {
    const store = storage();
    const bridge = createBridge(store);
    bridge.newRun("EndlessPvEClassic", "TUTORIAL");
    expect(bridge.tutorialStep()?.id).toBe("welcome");
    expect(bridge.dismissTutorial("welcome")).toBe(true);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.tutorialStep()?.id).toBe("buy_unit");
    expect(resumed.skipTutorial()).toBe(true);
    expect(resumed.run()?.tutorialSkipped).toBe(true);
    expect(resumed.run()?.aiMode).toBe("EASY");

    const skipped = createBridge(store);
    expect(skipped.continueRun()).toBe(true);
    expect(skipped.tutorialStep()).toBeNull();
    expect(skipped.run()?.aiMode).toBe("EASY");
  });

  it("persists accepted presentation-only tutorial events", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "TUTORIAL");
    run.round = 4;
    run.board[0] = { uid: "preview", baseId: "ant_guard", star: 1, equips: [] };
    syncTutorialRound(run);
    expect(bridge.dismissTutorial("round4_intro")).toBe(true);
    expect(bridge.tutorialEvent("show_attack_preview", "show_attack_preview", {
      source: { where: "board", index: 0 },
    })).toBe(true);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.tutorial.roundEventCounts.show_attack_preview).toBe(1);
    expect(resumed.tutorialStep()?.id).toBe("round4_start_combat");
  });

  it("keeps canonical equipment validation behind Bridge persistence", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.bench = [{ uid: "equip", baseId: "ant_guard", star: 1, equips: [] }];
    run.itemBag = ["eq_warmog_armor"];
    expect(bridge.equip("eq_warmog_armor", "bench", 0)).toBe(false);
    expect(run.itemBag).toEqual(["eq_warmog_armor"]);

    run.bench[0]!.star = 2;
    expect(bridge.equip("eq_warmog_armor", "bench", 0)).toBe(true);
    expect(run.itemBag).toEqual([]);
    expect(run.bench[0]!.equips).toEqual(["eq_warmog_armor"]);
    const inspection = inspectSave(store);
    expect(inspection.status).toBe("valid");
    if (inspection.status !== "valid") throw new Error("save missing");
    expect(inspection.envelope.payload.player?.bench[0]?.equips).toEqual(["eq_warmog_armor"]);
  });

  it("records accepted Classic shop actions once and ignores rejected actions", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    skipTutorial(run);
    run.gold = 100;
    const slot = run.shop.findIndex((id) => id !== null);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(bridge.buy(slot)).toBe(true);
    expect(bridge.reroll()).toBe(true);
    expect(bridge.buyXp()).toBe(true);
    expect(bridge.achievementProfile().stats).toMatchObject({
      runs_started: 1,
      units_bought: 1,
      shop_refreshes: 1,
      xp_purchases: 1,
    });

    run.phase = "COMBAT";
    const before = bridge.achievementProfile().stats;
    expect(bridge.buy(run.shop.findIndex((id) => id !== null))).toBe(false);
    expect(bridge.reroll()).toBe(false);
    expect(bridge.buyXp()).toBe(false);
    expect(bridge.achievementProfile().stats).toEqual(before);
  });

  it("records the exact canonical auto-merge count from one purchase", () => {
    const bridge = createBridge(storage());
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    skipTutorial(run);
    run.gold = 100;
    const slot = run.shop.findIndex((id) => id !== null);
    const baseId = run.shop[slot]!;
    run.bench = [
      { uid: "merge-a", baseId, star: 1, equips: [] },
      { uid: "merge-b", baseId, star: 1, equips: [] },
    ];
    expect(bridge.buy(slot)).toBe(true);
    expect(run.bench).toHaveLength(1);
    expect(run.bench[0]?.star).toBe(2);
    expect(bridge.achievementProfile().stats).toMatchObject({ units_bought: 1, merges: 1 });
  });

  it("keeps achievement recording Endless Classic-only", () => {
    const bridge = createBridge(storage());
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    const before = bridge.achievementProfile().stats.augments_chosen;
    run.mode = "EndlessCreative";
    run.phase = "AUGMENT";
    run.activeAugmentChoices = ["gold_cache", "wild_command", "opening_fury"];
    expect(bridge.chooseAugment("wild_command")).toBe(true);
    expect(bridge.achievementProfile().stats.augments_chosen).toBe(before);
  });

  it("persists one round-result achievement event", () => {
    const { bridge } = deployed();
    const session = bridge.startCombat();
    expect(session).not.toBeNull();
    const summary = session!.finish();
    expect(summary).not.toBeNull();
    const stats = bridge.achievementProfile().stats;
    expect(stats.rounds_won).toBe(summary!.winner === "LEFT" ? 1 : 0);
    expect(stats.rounds_lost).toBe(summary!.winner === "RIGHT" ? 1 : 0);
    expect(stats.items_looted).toBe(summary!.acceptedDrops.length);
  });

  it("keeps craft staging external and clears it only after a successful craft", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.craftTableLevel = 1;
    run.itemBag = ["tear"];
    expect(bridge.stageCraft(4, "tear")).toBe(true);
    expect(bridge.craftStaging()[4]).toBe("tear");
    expect(bridge.craft()).toBe("eq_blue_buff");
    expect(run.itemBag).toContain("eq_blue_buff");
    expect(run.itemBag).not.toContain("tear");
    expect(bridge.craftStaging()).toEqual(Array<string | null>(9).fill(null));
    expect(bridge.achievementProfile().stats.crafted_items).toBe(1);
  });

  it("rejects inactive grid cells without losing Bridge staging, resources or saved progress", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.gold = 100;
    run.inventoryBonus = 3;
    run.itemBag = ["tear", "bark", "claw"];
    expect(bridge.research("craft_t")).toBe(true);
    expect(run.craftTableLevel).toBe(1);
    expect(bridge.stageCraft(4, "tear")).toBe(true);

    const before = {
      bag: [...run.itemBag],
      history: [...run.craftHistory],
      staging: bridge.craftStaging(),
      seed: run.rngSeed,
      saved: store.getItem(PROGRESS_KEY),
      entries: bridge.history().entries.length,
    };
    for (const index of [-1, 0, 1, 3, 5, 8, 9]) {
      expect(bridge.stageCraft(index, "bark")).toBe(false);
    }
    expect(run.itemBag).toEqual(before.bag);
    expect(run.craftHistory).toEqual(before.history);
    expect(run.rngSeed).toBe(before.seed);
    expect(bridge.craftStaging()).toEqual(before.staging);
    expect(store.getItem(PROGRESS_KEY)).toBe(before.saved);
    expect(bridge.history().entries).toHaveLength(before.entries);

    expect(bridge.stageCraft(4, null)).toBe(true);
    expect(bridge.craftStaging()).toEqual(Array<string | null>(9).fill(null));
    expect(bridge.research("craft_t")).toBe(true);
    expect(run.craftTableLevel).toBe(2);
    expect(bridge.stageCraft(0, "tear")).toBe(true);
    expect(bridge.stageCraft(8, "claw")).toBe(false);
    expect(bridge.stageCraft(1, "bark")).toBe(true);
    expect(bridge.research("craft_t")).toBe(true);
    expect(run.craftTableLevel).toBe(3);
    expect(bridge.stageCraft(8, "claw")).toBe(true);
    expect(bridge.craftStaging()[8]).toBe("claw");
    expect(run.itemBag).toEqual(before.bag);
    expect(run.craftHistory).toEqual(before.history);
  });

  it("preserves an uncraftable staged ingredient on failure but never serializes the grid", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.craftTableLevel = 1;
    run.itemBag = ["bark", "claw"];
    bridge.checkpoint("EVENT", "Seed crafting inventory");
    expect(bridge.stageCraft(4, "tear")).toBe(true);

    const staged = bridge.craftStaging();
    const bag = [...run.itemBag];
    const history = [...run.craftHistory];
    const saved = store.getItem(PROGRESS_KEY);
    expect(bridge.craft()).toBeNull();
    expect(run.itemBag).toEqual(bag);
    expect(run.craftHistory).toEqual(history);
    expect(bridge.craftStaging()).toEqual(staged);
    expect(store.getItem(PROGRESS_KEY)).toBe(saved);
    expect(bridge.achievementProfile().stats.crafted_items).toBe(0);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.itemBag).toEqual(bag);
    expect(resumed.run()?.craftHistory).toEqual(history);
    expect(resumed.craftStaging()).toEqual(Array<string | null>(9).fill(null));
  });

  it("conserves a full bag through Bridge craft, clears only successful staging and reloads the committed result", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.gold = 100;
    run.inventoryBonus = 4;
    run.itemBag = ["tear", "bark", "tear", "claw"];
    bridge.checkpoint("EVENT", "Seed full crafting inventory");
    expect(run.itemBag).toHaveLength(inventoryCapacity(run));
    expect(bridge.research("craft_t")).toBe(true);
    expect(bridge.research("craft_t")).toBe(true);
    expect(run.craftTableLevel).toBe(2);
    expect(bridge.stageCraft(0, "tear")).toBe(true);
    expect(bridge.stageCraft(1, "bark")).toBe(true);

    const beforeBag = [...run.itemBag];
    const contaminated = bridge.craftStaging();
    const savedBeforeFailure = store.getItem(PROGRESS_KEY);
    expect(bridge.craft()).toBeNull();
    expect(run.itemBag).toEqual(beforeBag);
    expect(run.craftHistory).toEqual([]);
    expect(bridge.craftStaging()).toEqual(contaminated);
    expect(store.getItem(PROGRESS_KEY)).toBe(savedBeforeFailure);

    expect(bridge.stageCraft(1, null)).toBe(true);
    expect(bridge.craft()).toBe("eq_blue_buff");
    expect([...run.itemBag].sort()).toEqual(["bark", "claw", "eq_blue_buff", "tear"]);
    expect(run.itemBag).toHaveLength(beforeBag.length);
    expect(run.itemBag).toHaveLength(inventoryCapacity(run));
    expect(run.craftHistory).toEqual(["blue_buff"]);
    expect(bridge.craftStaging()).toEqual(Array<string | null>(9).fill(null));
    expect(bridge.achievementProfile().stats.crafted_items).toBe(1);

    const saved = inspectSave(store);
    expect(saved.status).toBe("valid");
    if (saved.status !== "valid") throw new Error("crafted save missing");
    expect(saved.envelope.payload.player?.itemBag).toEqual(run.itemBag);
    expect(saved.envelope.payload.player?.craftHistory).toEqual(["blue_buff"]);
    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.itemBag).toEqual(run.itemBag);
    expect(resumed.run()?.craftHistory).toEqual(["blue_buff"]);
    expect(resumed.craftStaging()).toEqual(Array<string | null>(9).fill(null));
  });

  it("commits augment choice and returns the run to Planning", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    run.phase = "AUGMENT";
    run.activeAugmentChoices = ["gold_cache", "wild_command", "opening_fury"];
    expect(bridge.chooseAugment("wild_command")).toBe(true);
    expect(run.phase).toBe("PLANNING");
    expect(run.activeAugmentChoices).toEqual([]);
    expect(run.augments).toContain("wild_command");
    expect(bridge.achievementProfile().stats.augments_chosen).toBe(1);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.augments).toContain("wild_command");
  });
  it("claims and equips catalog rewards through bridge-owned persistence", () => {
    const store = storage();
    const bridge = createBridge(store);
    const mapping = ACHIEVEMENT_REWARDS[0]!;
    const achievements = bridge.achievementProfile();
    const row = achievementRows(achievements).find((candidate) => candidate.id === mapping.achievementId)!;
    achievements.stats[row.category] = row.threshold;
    saveAchievementProfile(store, achievements);

    expect(bridge.claimAchievement(mapping.achievementId)).toBe(true);
    expect(bridge.claimAchievement(mapping.achievementId)).toBe(false);
    expect(bridge.collectionProfile().claimedAchievementIds).toContain(mapping.achievementId);
    expect(bridge.collectionProfile().unlockedSkinIds).toContain(mapping.skinId);

    expect(bridge.equipCollectionSkin(mapping.unitId, mapping.skinId)).toBe(true);
    expect(bridge.collectionProfile().equippedSkinByUnitId[mapping.unitId]).toBe(mapping.skinId);
    expect(createBridge(store).collectionProfile().equippedSkinByUnitId[mapping.unitId]).toBe(mapping.skinId);
  });
  it("claims and persists the separate all-100 completion reward through the bridge", () => {
    const store = storage();
    const bridge = createBridge(store);
    const achievements = bridge.achievementProfile();
    for (const category of ACHIEVEMENT_CATEGORIES) {
      achievements.stats[category] = Math.max(...ACHIEVEMENT_THRESHOLDS[category]);
    }
    saveAchievementProfile(store, achievements);

    expect(bridge.claimAchievement(ACHIEVEMENT_COMPLETION_CLAIM_ID)).toBe(true);
    expect(bridge.claimAchievement(ACHIEVEMENT_COMPLETION_CLAIM_ID)).toBe(false);
    expect(createBridge(store).collectionProfile().claimedAchievementIds)
      .toContain(ACHIEVEMENT_COMPLETION_CLAIM_ID);
  });

});
