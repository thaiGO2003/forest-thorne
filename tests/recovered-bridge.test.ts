import { describe, expect, it } from "vitest";
import { createBridge } from "../src/app/bridge";
import { inspectSave, saveRun, PROGRESS_KEY } from "../src/core/save";
import { buy, benchToBoard } from "../src/core/run";
import { syncTutorialRound } from "../src/core/tutorial";
import type { KV } from "../src/core/settings";

function storage(): KV {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
function deployed() {
  const store = storage(), bridge = createBridge(store);
  const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
  expect(buy(run, 0)).toBe(true);
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

  it("does not publish a completed session after the player starts a different run", () => {
    const { bridge } = deployed();
    const session = bridge.startCombat();
    const replacement = bridge.newRun("EndlessPvEClassic", "EASY");
    const before = JSON.stringify(replacement);
    expect(session?.finish()).toBeNull();
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

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.augments).toContain("wild_command");
  });
});
