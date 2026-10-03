import { describe, expect, it } from "vitest";
import { createPlaceholderBridge } from "../src/app/bridge";
import { createRun, type RunState } from "../src/core/run";
import { COLLECTION_KEY, PROGRESS_KEY, saveRun } from "../src/core/save";

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
    expect(bridge.achievements().stats.crafted_items).toBe(1);
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
    expect(bridge.achievements().stats.augments_chosen).toBe(1);
  });

  it("keeps selection by uid across moves and resolves context actions against current ownership", () => {
    const { bridge, store } = setup();
    expect(bridge.selectUnit("bench", 0)).toBe(true);
    expect(bridge.selectedUnit()?.uid).toBe("u1");
    expect(bridge.move({ kind: "bench", index: 0 }, { kind: "board", index: 6 })).toBe(true);
    expect(bridge.selection()).toMatchObject({ source: "BOARD", uid: "u1", row: 1, col: 1 });
    const beforeDetails = store.getItem(PROGRESS_KEY);
    expect(bridge.contextAction("DETAILS")).toMatchObject({ ok: true, mutated: false });
    expect(store.getItem(PROGRESS_KEY)).toBe(beforeDetails);
    expect(bridge.contextAction("RECALL")).toMatchObject({ ok: true, mutated: true });
    expect(bridge.selection()).toMatchObject({ source: "BENCH", uid: "u1", index: 0 });
    expect(bridge.contextAction("SELL")).toMatchObject({ ok: true, mutated: true });
    expect(bridge.run()!.bench).toEqual([]);
    expect(bridge.run()!.board.every((unit) => unit === null)).toBe(true);
    const after = store.getItem(PROGRESS_KEY);
    expect(bridge.contextAction("SELL").ok).toBe(false); // remaining fallback is a shop offer
    expect(store.getItem(PROGRESS_KEY)).toBe(after);
  });

  it("refreshes selected shop identity and resets selection on run clear", () => {
    const { bridge } = setup({ shop: ["ant_guard", "deer_song", null, null, null] });
    expect(bridge.selectUnit("shop", 1)).toBe(true);
    expect(bridge.selection()).toMatchObject({ source: "SHOP", baseId: "deer_song", index: 1 });
    bridge.buy(1);
    expect(bridge.selection()?.source).toBe("BENCH");
    bridge.clearRun();
    expect(bridge.selection()).toBeNull();
    expect(bridge.selectedUnit()).toBeNull();
  });

  it("counts successful purchases, merges, refreshes and XP transactions, without counting rejects", () => {
    const { bridge, store } = setup({
      bench: [
        { uid: "u1", baseId: "ant_guard", star: 1, equips: [] },
        { uid: "u2", baseId: "ant_guard", star: 1, equips: [] },
      ], shop: ["ant_guard", null, null, null, null],
    });
    expect(bridge.buy(0)).toBe(true);
    expect(bridge.achievements().stats).toMatchObject({ units_bought: 1, merges: 1 });
    expect(bridge.buy(0)).toBe(false);
    expect(bridge.buyXp()).toBe(true);
    bridge.toggleLock();
    expect(bridge.reroll()).toBe(false);
    expect(bridge.achievements().stats.shop_refreshes).toBe(0);
    bridge.toggleLock();
    expect(bridge.reroll()).toBe(true);
    const stats = bridge.achievements().stats;
    expect(stats).toMatchObject({ units_bought: 1, merges: 1, xp_purchases: 1, shop_refreshes: 1 });
    expect(JSON.parse(store.getItem(PROGRESS_KEY)!).achievementsProfile.stats).toEqual(stats);
    bridge.continueRun();
    expect(bridge.achievements().stats).toEqual(stats);
  });

  it("counts New Game once per start and keeps account progress through Continue and run clears", () => {
    const { bridge, store } = setup();
    store.setItem(COLLECTION_KEY, JSON.stringify({ unlockedSkinIds: ["existing-skin"] }));
    bridge.newRun("EndlessPvEClassic", "EASY");
    expect(bridge.achievements().stats.runs_started).toBe(1);
    bridge.continueRun();
    expect(bridge.achievements().stats.runs_started).toBe(1);
    bridge.clearRun();
    expect(bridge.achievements().stats.runs_started).toBe(1);
    bridge.newRun("EndlessPvEClassic", "EASY");
    expect(bridge.achievements().stats.runs_started).toBe(2);
    expect(JSON.parse(store.getItem(COLLECTION_KEY)!).unlockedSkinIds).toEqual(["existing-skin"]);
    expect(createPlaceholderBridge(store).achievements().stats.runs_started).toBe(2);
    bridge.newRun("EndlessCreative", "CREATIVE");
    expect(bridge.achievements().stats.runs_started).toBe(2);
  });
});
