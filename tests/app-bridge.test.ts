import { describe, expect, it } from "vitest";
import { createPlaceholderBridge } from "../src/app/bridge";
import { PROGRESS_KEY, saveRun } from "../src/core/save";
import { createRun } from "../src/core/run";

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
  });
});
