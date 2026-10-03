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
});
