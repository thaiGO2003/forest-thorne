import { describe, expect, it } from "vitest";
import { createPlaceholderBridge } from "../src/app/bridge";
import { createRun, type RunState } from "../src/core/run";
import { PROGRESS_KEY, saveRun } from "../src/core/save";

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();
  get length() { return this.entries.size; }
  clear() { this.entries.clear(); }
  getItem(key: string) { return this.entries.get(key) ?? null; }
  key(index: number) { return [...this.entries.keys()][index] ?? null; }
  removeItem(key: string) { this.entries.delete(key); }
  setItem(key: string, value: string) { this.entries.set(key, value); }
}

function setup(patch: Partial<RunState> = {}) {
  const store = new MemoryStorage();
  const player = Object.assign(createRun(91), {
    aiMode: "EASY", gold: 100, craftTableLevel: 3,
    bench: [{ uid: "u1", baseId: "ant_guard", star: 3, equips: [] }],
  }, patch);
  saveRun(store, { player });
  const bridge = createPlaceholderBridge(store);
  expect(bridge.continueRun()).toBe(true);
  return { store, bridge };
}

describe("bridge planning transaction ownership", () => {
  it("stages non-destructively, checks available copies and commits craft/save/history once", () => {
    const { store, bridge } = setup({ itemBag: ["tear", "claw"] });
    expect(bridge.stageCraftItem(4, "tear")).toBe(true);
    const stagedSave = store.getItem(PROGRESS_KEY);
    expect(bridge.run()!.itemBag).toEqual(["tear", "claw"]);
    expect(bridge.stageCraftItem(0, "tear")).toBe(false);
    expect(bridge.stageCraftItem(0, "missing")).toBe(false);
    expect(store.getItem(PROGRESS_KEY)).toBe(stagedSave);
    const returned = bridge.craftStaging() as (string | null)[];
    returned[4] = "claw";
    expect(bridge.craftStaging()[4]).toBe("tear");
    let notices = 0;
    bridge.onChange(() => notices++);
    expect(bridge.craft()).toBe("eq_blue_buff");
    expect(notices).toBe(1);
    expect(bridge.run()!.itemBag).toEqual(["claw", "eq_blue_buff"]);
    expect(bridge.craftStaging()).toEqual(Array(9).fill(null));
    expect(bridge.history().entries.filter((entry) => entry.category === "CRAFT")).toHaveLength(1);
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!).payload.player.craftHistory).toEqual(["blue_buff"]);
    expect(bridge.craft()).toBeNull();
    expect(notices).toBe(1);
  });

  it("cancel and run replacement discard staging without consuming inventory", () => {
    const { store, bridge } = setup({ itemBag: ["tear"] });
    bridge.stageCraftItem(4, "tear");
    const before = store.getItem(PROGRESS_KEY);
    bridge.clearCraftStaging();
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(bridge.run()!.itemBag).toEqual(["tear"]);
    bridge.stageCraftItem(4, "tear");
    bridge.continueRun();
    expect(bridge.craftStaging()).toEqual(Array(9).fill(null));
    bridge.stageCraftItem(4, "tear");
    bridge.newRun("EndlessPvEClassic", "EASY");
    expect(bridge.craftStaging()).toEqual(Array(9).fill(null));
  });

  it("routes equip, unequip and item sale through canonical mutations and reconciles reservations", () => {
    const { store, bridge } = setup({ itemBag: ["eq_blue_buff", "tear"] });
    bridge.stageCraftItem(4, "eq_blue_buff");
    const before = store.getItem(PROGRESS_KEY);
    expect(bridge.equip("missing", "bench", 0)).toBe(false);
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(bridge.equip("eq_blue_buff", "bench", 0)).toBe(true);
    expect(bridge.craftStaging()[4]).toBeNull();
    expect(bridge.equip("eq_blue_buff", "bench", 0)).toBe(false);
    expect(bridge.unequip("bench", 0, 0)).toBe(true);
    expect(bridge.run()!.gold).toBe(98);
    expect(bridge.equip("eq_blue_buff", "bench", 0)).toBe(true);
    expect(bridge.unequipAll("bench", 0)).toBe(true);
    expect(bridge.run()!.gold).toBe(96);
    expect(bridge.sellItem(0)).toBe(true);
    expect(bridge.run()!.itemBag).toEqual(["eq_blue_buff"]);
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!).payload.player.gold).toBe(97);
  });

  it("applies augment rewards once and saves the return to Planning", () => {
    const { store, bridge } = setup({ phase: "AUGMENT", activeAugmentChoices: ["gold_cache"], round: 3 });
    expect(bridge.chooseAugment("missing")).toBe(false);
    expect(bridge.chooseAugment("gold_cache")).toBe(true);
    const after = structuredClone(bridge.run());
    expect(bridge.run()).toMatchObject({ phase: "PLANNING", augments: ["gold_cache"], augmentRoundsTaken: [3], activeAugmentChoices: [] });
    expect(bridge.run()!.gold).toBeGreaterThan(100);
    const saved = store.getItem(PROGRESS_KEY);
    expect(bridge.chooseAugment("gold_cache")).toBe(false);
    expect(bridge.run()).toEqual(after);
    expect(store.getItem(PROGRESS_KEY)).toBe(saved);
    expect(bridge.history().entries).toHaveLength(1);
  });
});
