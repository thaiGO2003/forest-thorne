import { describe, expect, it } from "vitest";
import { createPlaceholderBridge } from "../src/app/bridge";
import { PROGRESS_KEY, saveRun } from "../src/core/save";
import { createModeRun, createRun } from "../src/core/run";
import { loadSettings } from "../src/core/settings";

class TrackingStorage implements Storage {
  readonly removed: string[] = [];
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.removed.push(key); this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("app bridge run lifecycle", () => {
  it("clears the previous run slot before persisting a true New Game", () => {
    const store = new TrackingStorage();
    saveRun(store, { player: createRun(7) });
    store.removed.length = 0;

    const bridge = createPlaceholderBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "EASY");

    expect(store.removed).toContain(PROGRESS_KEY);
    expect(bridge.run()).toBe(run);
    expect(bridge.saveSummary()).toMatchObject({ kind: "valid", mode: "EndlessPvEClassic", playable: true });
    expect(loadSettings(store).aiModeByGameMode.EndlessPvEClassic).toBe("EASY");
  });

  it("rejects stale locked New Game selections without replacing the prior save or run", () => {
    const store = new TrackingStorage();
    const bridge = createPlaceholderBridge(store);
    const current = bridge.newRun("EndlessPvEClassic", "HARD");
    const before = store.getItem(PROGRESS_KEY);
    const settingsBefore = JSON.stringify(bridge.settings.get());
    store.removed.length = 0;
    expect(bridge.newRun("EndlessPvEFortress", "EASY")).toBeNull();
    expect(bridge.run()).toBe(current);
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(JSON.stringify(bridge.settings.get())).toBe(settingsBefore);
    expect(store.removed).toEqual([]);
  });

  it("blocks Continue for gated saves and corruption without silently starting a new run", () => {
    const store = new TrackingStorage();
    saveRun(store, { player: createModeRun(9, "EndlessPvEFortress") });
    const bridge = createPlaceholderBridge(store);
    const before = store.getItem(PROGRESS_KEY);
    expect(bridge.saveSummary()).toMatchObject({ kind: "valid", playable: false });
    expect(bridge.continueRun()).toBe(false);
    expect(bridge.run()).toBeNull();
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    store.setItem(PROGRESS_KEY, "{invalid");
    expect(bridge.continueRun()).toBe(false);
    expect(bridge.saveSummary()).toEqual({ kind: "corrupt" });
    expect(store.getItem(PROGRESS_KEY)).toBe("{invalid");
  });

  it("hydrates the latest save on Continue and restores saved audio through the canonical settings owner", () => {
    const store = new TrackingStorage();
    const bridge = createPlaceholderBridge(store);
    const run = createRun(10);
    run.aiMode = "HARD";
    run.gold = 77;
    saveRun(store, { player: run, audioEnabled: false });
    const audio: boolean[] = [];
    bridge.settings.subscribe((settings) => audio.push(settings.audioEnabled));
    expect(bridge.continueRun()).toBe(true);
    expect(bridge.run()).toMatchObject({ aiMode: "HARD", gold: 77 });
    expect(bridge.settings.get().audioEnabled).toBe(false);
    expect(audio).toEqual([false]);
    const fresh = bridge.newRun("EndlessPvEClassic", "EASY");
    expect(fresh?.aiMode).toBe("EASY");
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!).payload.audioEnabled).toBe(false);
  });

  it("resolves a materialized battle and applies its result only once", () => {
    const store = new TrackingStorage();
    const saved = createRun(11);
    saved.aiMode = "EASY";
    saved.board[14] = { uid: "u1", baseId: "ant_guard", star: 3, equips: [] };
    saved.enemyPreview = [{ uid: "e1", baseId: "deer_song", star: 1, row: 2, col: 5 }];
    saved.enemyPreviewRound = 1;
    saveRun(store, { player: saved });
    const bridge = createPlaceholderBridge(store);
    expect(bridge.continueRun()).toBe(true);
    const session = bridge.startCombat()!;
    expect(session).not.toBeNull();
    expect(session.roster).toHaveLength(2);
    expect(bridge.run()!.phase).toBe("COMBAT");
    const summary = session.finish()!;
    expect(summary).not.toBeNull();
    expect(bridge.run()!.round).toBe(2);
    const achievementStats = bridge.achievements().stats;
    expect(achievementStats.rounds_won + achievementStats.rounds_lost).toBe(summary.winner === "DRAW" ? 0 : 1);
    expect(achievementStats.items_looted).toBe(summary.acceptedDrops.length);
    const after = store.getItem(PROGRESS_KEY);
    expect(session.finish()).toBeNull();
    expect(store.getItem(PROGRESS_KEY)).toBe(after);
    expect(bridge.achievements().stats).toEqual(achievementStats);
  });

  it.each(["new", "continue", "clear"] as const)("ignores stale combat completion after %s replaces its run owner", (replacement) => {
    const store = new TrackingStorage();
    const saved = createRun(12);
    saved.aiMode = "EASY";
    saved.board[14] = { uid: "u1", baseId: "ant_guard", star: 3, equips: [] };
    saved.enemyPreview = [{ uid: "e1", baseId: "deer_song", star: 1, row: 2, col: 5 }];
    saved.enemyPreviewRound = 1;
    saveRun(store, { player: saved });
    const bridge = createPlaceholderBridge(store);
    bridge.continueRun();
    const oldRun = bridge.run()!;
    const session = bridge.startCombat()!;
    if (replacement === "new") bridge.newRun("EndlessPvEClassic", "EASY");
    else if (replacement === "continue") expect(bridge.continueRun()).toBe(true);
    else bridge.clearRun();
    const beforeSave = store.getItem(PROGRESS_KEY);
    const beforeRun = structuredClone(bridge.run());
    const beforeHistory = structuredClone(bridge.history());
    const beforeOldRun = structuredClone(oldRun);
    const beforeStats = bridge.achievements().stats;
    let changes = 0;
    bridge.onChange(() => changes++);
    expect(session.finish()).toBeNull();
    expect(bridge.run()).toEqual(beforeRun);
    expect(oldRun).toEqual(beforeOldRun);
    expect(bridge.history()).toEqual(beforeHistory);
    expect(store.getItem(PROGRESS_KEY)).toBe(beforeSave);
    expect(changes).toBe(0);
    expect(bridge.achievements().stats).toEqual(beforeStats);
  });

  it("rejects empty boards and non-Planning phases before mutating the enemy preview", () => {
    for (const phase of ["PLANNING", "COMBAT", "GAME_OVER"] as const) {
      const store = new TrackingStorage();
      const saved = createRun(13);
      saved.aiMode = "EASY";
      saved.phase = phase;
      if (phase !== "PLANNING") saved.board[14] = { uid: "u1", baseId: "ant_guard", star: 3, equips: [] };
      saveRun(store, { player: saved });
      const bridge = createPlaceholderBridge(store);
      bridge.continueRun();
      const before = structuredClone(bridge.run());
      const beforeSave = store.getItem(PROGRESS_KEY);
      expect(bridge.startCombat()).toBeNull();
      expect(bridge.run()).toEqual(before);
      expect(store.getItem(PROGRESS_KEY)).toBe(beforeSave);
    }
  });

  it("rejects tutorial-blocked combat without generating preview or changing run/save/profile", () => {
    const store = new TrackingStorage();
    const saved = createRun(14);
    saved.board[14] = { uid: "u1", baseId: "ant_guard", star: 1, equips: [] };
    saveRun(store, { player: saved });
    const bridge = createPlaceholderBridge(store);
    bridge.continueRun();
    const before = structuredClone(bridge.run());
    const saveBefore = store.getItem(PROGRESS_KEY);
    expect(bridge.startCombat()).toBeNull();
    expect(bridge.run()).toEqual(before);
    expect(store.getItem(PROGRESS_KEY)).toBe(saveBefore);
    expect(bridge.achievements().stats.rounds_won).toBe(0);
  });
});
