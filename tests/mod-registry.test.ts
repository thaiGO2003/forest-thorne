import { describe, expect, it, vi } from "vitest";
import {
  MOD_PROFILE_KEY,
  createModManager,
  inspectModIndex,
  loadModIndex,
  loadModIndexWithWarnings,
  loadModProfile,
  normalizeModIndex,
  normalizeModManifest,
  normalizeModProfile,
  validateEnabledMods,
  type ModIndex,
} from "../src/mods/ModRegistry";

function memoryStorage(initial?: string): Storage {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(MOD_PROFILE_KEY, initial);
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const validIndex: ModIndex = {
  schemaVersion: 1,
  workshop: { status: "placeholder", appId: null },
  mods: [
    {
      id: "beasts-plus",
      name: "Beasts Plus",
      version: "1.2.0",
      description: "Adds beasts",
      author: "Tester",
      source: "local",
      packageType: ".ftunit",
      requires: [],
      conflicts: [],
      tags: ["units"],
    },
    {
      id: "logic-plus",
      name: "Logic Plus",
      version: "0.0.0",
      description: "",
      author: "Unknown",
      source: "bundled",
      packageType: ".ftlogic",
      requires: ["beasts-plus"],
      conflicts: ["legacy-rules"],
      tags: [],
    },
  ],
};

describe("mod registry A50", () => {
  it("normalizes manifests and rejects records without id/name", () => {
    expect(normalizeModManifest({ name: "Missing id" })).toBeNull();
    expect(normalizeModManifest({ id: "missing-name" })).toBeNull();
    expect(normalizeModManifest({
      id: "  demo  ",
      name: " Demo ",
      version: " ",
      description: " description ",
      author: " ",
      source: "invalid",
      packageType: ".zip",
      entry: " ",
      workshopId: " 42 ",
      requires: [" dep ", "", 4],
      conflicts: [null, " other "],
      tags: [" tag ", "  "],
    })).toEqual({
      id: "demo",
      name: "Demo",
      version: "0.0.0",
      description: "description",
      author: "Unknown",
      source: "bundled",
      packageType: ".ftmodpack",
      workshopId: "42",
      requires: ["dep"],
      conflicts: ["other"],
      tags: ["tag"],
    });
  });

  it("normalizes only schema v1 indexes and keeps Workshop capability explicit", () => {
    const normalized = normalizeModIndex({
      schemaVersion: 1,
      workshop: { status: "available", appId: " 480 " },
      mods: [{ id: "a", name: "A", packageType: "bad" }, { id: "", name: "Dropped" }],
    });
    expect(normalized.workshop).toEqual({ status: "available", appId: "480" });
    expect(normalized.mods).toHaveLength(1);
    expect(normalized.mods[0]?.packageType).toBe(".ftmodpack");
    expect(normalizeModIndex({ schemaVersion: 2, mods: [] })).toEqual({
      schemaVersion: 1,
      mods: [],
      workshop: { status: "placeholder", appId: null },
    });
    expect(inspectModIndex({ schemaVersion: 1, mods: [{ id: "ok", name: "OK" }, { id: "", name: "bad" }] }).warnings)
      .toEqual([{ kind: "invalid-manifest", index: 1, message: "Mod manifest at index 1 is missing a non-empty id or name." }]);
  });

  it("loads index with no-store and safely falls back on missing/failed/malformed fetch", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => validIndex }));
    await expect(loadModIndex(fetcher)).resolves.toEqual(validIndex);
    expect(fetcher).toHaveBeenCalledWith("mods/index.json", { cache: "no-store" });

    await expect(loadModIndex(null)).resolves.toEqual({
      schemaVersion: 1,
      mods: [],
      workshop: { status: "placeholder", appId: null },
    });
    await expect(loadModIndex(async () => ({ ok: false, json: async () => validIndex }))).resolves.toMatchObject({ mods: [] });
    await expect(loadModIndex(async () => { throw new Error("offline"); })).resolves.toMatchObject({ mods: [] });
    await expect(loadModIndex(async () => ({ ok: true, json: async () => ({ bad: true }) }))).resolves.toMatchObject({ mods: [] });

    await expect(loadModIndexWithWarnings(null)).resolves.toMatchObject({
      warnings: [{ kind: "fetch-unavailable", message: expect.any(String) }],
    });
    await expect(loadModIndexWithWarnings(async () => ({ ok: false, json: async () => validIndex }))).resolves.toMatchObject({
      warnings: [{ kind: "http-error", message: expect.any(String) }],
    });
  });

  it("deduplicates profile order deterministically and appends enabled ids missing from load order", () => {
    expect(normalizeModProfile({
      schemaVersion: 1,
      enabledIds: [" a ", "b", "a", "", "c"],
      loadOrder: ["b", "b", "x"],
    })).toEqual({
      schemaVersion: 1,
      enabledIds: ["a", "b", "c"],
      loadOrder: ["b", "x", "a", "c"],
    });
    expect(loadModProfile(memoryStorage("{bad json"))).toEqual({ schemaVersion: 1, enabledIds: [], loadOrder: [] });
  });

  it("persists enable, disable and exact one-step reorder across reload", async () => {
    const storage = memoryStorage();
    const fetcher = async () => ({ ok: true, json: async () => validIndex });
    const manager = await createModManager(storage, fetcher);

    manager.enable("beasts-plus");
    manager.enable("logic-plus");
    manager.enable("beasts-plus");
    expect(manager.getProfile()).toEqual({
      schemaVersion: 1,
      enabledIds: ["logic-plus", "beasts-plus"],
      loadOrder: ["logic-plus", "beasts-plus"],
    });

    manager.move("beasts-plus", -1);
    manager.move("beasts-plus", -1);
    manager.move("unknown", 1);
    expect(manager.getProfile().loadOrder).toEqual(["beasts-plus", "logic-plus"]);
    manager.disable("logic-plus");
    expect(manager.getProfile()).toEqual({ schemaVersion: 1, enabledIds: ["beasts-plus"], loadOrder: ["beasts-plus"] });

    const reloaded = await createModManager(storage, fetcher);
    expect(reloaded.getProfile()).toEqual(manager.getProfile());
  });

  it("returns an empty but usable manager when the bundled index is unavailable", async () => {
    const manager = await createModManager(memoryStorage(), async () => { throw new Error("missing index"); });
    expect(manager.getIndex()).toEqual({ schemaVersion: 1, mods: [], workshop: { status: "placeholder", appId: null } });
    expect(manager.getRegistryWarnings()).toEqual([{ kind: "fetch-failed", message: expect.any(String) }]);
    expect(manager.enable("local-only").enabledIds).toEqual(["local-only"]);
    expect(manager.validateEnabled()).toEqual([{ kind: "unknown-enabled-mod", modId: "local-only" }]);
  });

  it("isolates dependency/conflict problems as validation issues instead of throwing", () => {
    const profile = normalizeModProfile({ schemaVersion: 1, enabledIds: ["logic-plus", "legacy-rules"], loadOrder: [] });
    expect(validateEnabledMods(validIndex, profile)).toEqual([
      { kind: "missing-dependency", modId: "logic-plus", dependencyId: "beasts-plus" },
      { kind: "conflict", modId: "logic-plus", conflictId: "legacy-rules" },
      { kind: "unknown-enabled-mod", modId: "legacy-rules" },
    ]);
  });
});
