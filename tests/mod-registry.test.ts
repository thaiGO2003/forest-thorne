import { describe, expect, it } from "vitest";
import {
  MOD_PACKAGE_TYPES,
  MOD_PROFILE_KEY,
  ModProfileStore,
  disableMod,
  enableMod,
  loadModIndex,
  moveMod,
  normalizeModIndex,
  normalizeModManifest,
  normalizeModProfile,
} from "../src/mods/ModRegistry";

class MemoryStore {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("mod registry", () => {
  it("normalizes manifests and keeps the exact package surface", () => {
    expect(MOD_PACKAGE_TYPES).toEqual([".ftunit", ".ftlogic", ".ftmodpack"]);
    expect(normalizeModManifest({ id: " ", name: "Bad" })).toBeNull();
    expect(normalizeModManifest({
      id: " wolf-pack ",
      name: " Wolf Pack ",
      source: "wrong",
      packageType: ".zip",
      requires: [" a ", "", 3, "a"],
      conflicts: [" b "],
      tags: [" animal "],
      entry: " ",
      workshopId: "",
    })).toEqual({
      id: "wolf-pack",
      name: "Wolf Pack",
      version: "0.0.0",
      description: "",
      author: "Unknown",
      source: "bundled",
      packageType: ".ftmodpack",
      requires: ["a", "a"],
      conflicts: ["b"],
      tags: ["animal"],
    });
  });

  it("normalizes index data and preserves the workshop capability seam", () => {
    expect(normalizeModIndex(null)).toEqual({
      schemaVersion: 1,
      workshop: { status: "placeholder", appId: null },
      mods: [],
    });
    expect(normalizeModIndex({
      workshop: { status: "available", appId: " 123 " },
      mods: [{ id: "m", name: "Mod", packageType: ".ftunit" }, { id: "", name: "drop" }],
    })).toMatchObject({
      schemaVersion: 1,
      workshop: { status: "available", appId: "123" },
      mods: [{ id: "m", packageType: ".ftunit" }],
    });
  });

  it("loads the index without cache and falls back safely on HTTP or parser failure", async () => {
    let requestUrl = "";
    let requestInit: RequestInit | undefined;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      requestUrl = String(input);
      requestInit = init;
      return {
        ok: true,
        json: async () => ({ mods: [{ id: "m", name: "Mod" }] }),
      } as Response;
    }) as typeof fetch;
    const loaded = await loadModIndex("/mods/index.json", fetcher);
    expect(requestUrl).toBe("/mods/index.json");
    expect(requestInit).toEqual({ cache: "no-store" });
    expect(loaded.mods).toHaveLength(1);

    const failed = await loadModIndex("/mods/index.json", (async () => ({
      ok: false,
    } as Response)) as typeof fetch);
    expect(failed.mods).toEqual([]);

    const thrown = await loadModIndex("/mods/index.json", (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    expect(thrown.mods).toEqual([]);
  });
});

describe("mod profile", () => {
  it("deduplicates deterministically and appends enabled ids missing from load order", () => {
    expect(normalizeModProfile({
      enabledIds: ["a", "b", "a", "c"],
      loadOrder: ["b", "b", "x"],
    })).toEqual({
      schemaVersion: 1,
      enabledIds: ["a", "b", "c"],
      loadOrder: ["b", "x", "a", "c"],
    });
  });

  it("enables, disables and moves by exactly one load-order position", () => {
    const start = normalizeModProfile({
      enabledIds: ["a", "b"],
      loadOrder: ["a", "b", "c"],
    });
    const enabled = enableMod(start, "a");
    expect(enabled).toEqual({
      schemaVersion: 1,
      enabledIds: ["b", "a"],
      loadOrder: ["b", "c", "a"],
    });
    expect(disableMod(enabled, "b")).toEqual({
      schemaVersion: 1,
      enabledIds: ["a"],
      loadOrder: ["c", "a"],
    });
    expect(moveMod(enabled, "c", -1).loadOrder).toEqual(["c", "b", "a"]);
    expect(moveMod(enabled, "b", -1).loadOrder).toEqual(enabled.loadOrder);
    expect(moveMod(enabled, "missing", 1).loadOrder).toEqual(enabled.loadOrder);
  });

  it("persists profile mutations and survives store reload", () => {
    const store = new MemoryStore();
    const manager = new ModProfileStore(store);
    manager.enable("a");
    manager.enable("b");
    manager.move("b", -1);
    manager.disable("a");

    expect(JSON.parse(store.values.get(MOD_PROFILE_KEY) ?? "{}")).toEqual({
      schemaVersion: 1,
      enabledIds: ["b"],
      loadOrder: ["b"],
    });
    expect(new ModProfileStore(store).get()).toEqual({
      schemaVersion: 1,
      enabledIds: ["b"],
      loadOrder: ["b"],
    });
  });
});
