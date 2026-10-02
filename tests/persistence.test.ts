import { describe, expect, it, vi } from "vitest";
import { createRun } from "../src/core/run";
import {
  ACHIEVEMENTS_KEY, clearAchievementProfile, clearCollectionProfile, clearProgress, clearRunProgress, COLLECTION_KEY,
  COOP_KEY, createEnvelope, downloadProgress, EXPORT_FILENAME, importProgress, importProgressBlob, inspectSave,
  loadAchievementProfile, loadCollectionProfile, loadProgress, migrate, PROGRESS_KEY, remapCoopHost,
  saveAchievementProfile, saveCollectionProfile, saveCoopSlot, saveProgress, saveRun, selectCoopSlot,
} from "../src/core/save";
import {
  BATTERY_SAVER_KEY, createSettingsStore, GRAPHICS_QUALITY_KEY, loadGraphicsPreferences, loadSettings,
  normalizeSettings, RENDER_SCALE_KEY, saveGraphicsPreferences, SETTINGS_KEY,
} from "../src/core/settings";

function mem() {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (k: string) => (k in m ? m[k]! : null),
    setItem: vi.fn((k: string, v: string) => { m[k] = v; }),
    removeItem: (k: string) => { delete m[k]; },
  };
}

describe("persistence A57", () => {
  it("Continue inspection: empty / malformed / invalid / valid; malformed never throws", () => {
    const s = mem();
    expect(inspectSave(s).status).toBe("empty");
    s.m[PROGRESS_KEY] = "{not json";
    expect(inspectSave(s).status).toBe("malformed_json");
    s.m[PROGRESS_KEY] = JSON.stringify({ version: 4, payload: { nope: 1 } });
    expect(inspectSave(s).status).toBe("invalid_envelope");
    saveRun(s, { player: createRun(1) });
    expect(inspectSave(s).status).toBe("valid");
  });

  it("v1 run migrates to v4: level clamped to 25, bench_up 0..4 preserved, unknown units dropped, persisted once", () => {
    const s = mem();
    const p = createRun(2);
    Object.assign(p, { level: 40, benchUpgradeLevel: 4 });
    p.bench = [{ uid: "a", baseId: "ghost_unit", star: 1, equips: [] }, { uid: "b", baseId: "ant_guard", star: 2, equips: [] }];
    s.m[PROGRESS_KEY] = JSON.stringify({ payload: { player: p } });
    const r = inspectSave(s);
    if (r.status !== "valid") throw new Error(r.status);
    const out = r.envelope.payload.player!;
    expect([r.envelope.version, out.level, out.benchUpgradeLevel, out.bench.map((u) => u.uid)]).toEqual([4, 25, 4, ["b"]]);
    const writes = s.setItem.mock.calls.length;
    inspectSave(s);
    expect(s.setItem.mock.calls.length).toBe(writes);
  });

  it("import persist=false never writes; persist=true restores profiles", () => {
    const s = mem();
    const text = JSON.stringify({
      version: 4,
      payload: { player: createRun(3) },
      achievementsProfile: { version: 1, stats: { runs_started: 4, highest_level: 3 } },
      collectionProfile: { version: 1, unlockedSkinIds: ["skin_a"], claimedAchievementIds: [], equippedSkinByUnit: {} },
    });
    expect(importProgress(s, text, false)?.player?.round).toBe(1);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(importProgress(s, "[]", true)).toBeNull();
    importProgress(s, text, true);
    expect(JSON.parse(s.m[ACHIEVEMENTS_KEY]!).stats).toMatchObject({ runs_started: 4, highest_level: 3 });
    expect(JSON.parse(s.m[COLLECTION_KEY]!).unlockedSkinIds).toEqual(["skin_a"]);
  });

  it("uses canonical A104 profile keys, migrates legacy keys and keeps profile clear scopes independent", () => {
    expect(ACHIEVEMENTS_KEY).toBe("forest_throne_endless_achievements_v1");
    expect(COLLECTION_KEY).toBe("forest_throne_collection_profile_v1");
    const s = mem();
    s.m.forest_throne_achievements_v1 = JSON.stringify({ version: 1, stats: { runs_started: 7 } });
    s.m.forest_throne_collection_v1 = JSON.stringify({
      version: 1,
      unlockedSkinIds: ["skin.lofi_red"],
      claimedAchievementIds: ["a1"],
      equippedSkinByUnit: {},
    });
    expect(loadAchievementProfile(s).stats.runs_started).toBe(7);
    expect(loadCollectionProfile(s)).toMatchObject({ version: 2, unlockedSkinIds: ["skin.loli_red"] });
    expect(s.m.forest_throne_achievements_v1).toBeUndefined();
    expect(s.m.forest_throne_collection_v1).toBeUndefined();
    expect(s.m[ACHIEVEMENTS_KEY]).toBeTruthy();
    expect(s.m[COLLECTION_KEY]).toBeTruthy();

    saveAchievementProfile(s, { stats: { highest_level: 4 } });
    saveCollectionProfile(s, { unlockedSkinIds: ["a", "a", ""], claimedAchievementIds: [], equippedSkinByUnitId: {} });
    expect(JSON.parse(s.m[ACHIEVEMENTS_KEY]!).stats.highest_level).toBe(4);
    expect(JSON.parse(s.m[COLLECTION_KEY]!).unlockedSkinIds).toEqual(["a"]);

    s.m[SETTINGS_KEY] = "{}";
    clearCollectionProfile(s);
    expect(s.m[COLLECTION_KEY]).toBeUndefined();
    expect(s.m[ACHIEVEMENTS_KEY]).toBeTruthy();
    expect(s.m[SETTINGS_KEY]).toBe("{}");
    clearAchievementProfile(s);
    expect(s.m[ACHIEVEMENTS_KEY]).toBeUndefined();
    expect(s.m[SETTINGS_KEY]).toBe("{}");

    s.m[COLLECTION_KEY] = "{bad";
    expect(loadCollectionProfile(s)).toMatchObject({ version: 2, unlockedSkinIds: [], claimedAchievementIds: [] });
  });

  it("saveProgress/loadProgress fail softly and reuse canonical migration", () => {
    const s = mem();
    expect(saveProgress(s, { player: createRun(21) })).toBe(true);
    expect(loadProgress(s)?.player?.rngSeed).toBe(21);

    s.m[PROGRESS_KEY] = "{bad";
    expect(loadProgress(s)).toBeNull();

    const throwing = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => undefined,
    };
    expect(saveProgress(throwing, { player: createRun(22) })).toBe(false);
    expect(() => loadProgress(throwing)).not.toThrow();
    expect(loadProgress(throwing)).toBeNull();
  });

  it("imports Blob/File-compatible payloads through the same validation path", async () => {
    const s = mem();
    const env = createEnvelope({ player: createRun(23) });
    expect((await importProgressBlob(s, new Blob([JSON.stringify(env)]), false))?.player?.rngSeed).toBe(23);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(await importProgressBlob(s, new Blob(["[]"]), true)).toBeNull();
  });

  it("downloads the canonical envelope with the default portable filename", () => {
    const click = vi.fn();
    const link = { href: "", download: "", click };
    const createObjectURL = vi.fn(() => "blob:save");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    try {
      expect(downloadProgress(createEnvelope({ player: createRun(24) }))).toBe(true);
      expect(link.download).toBe(EXPORT_FILENAME);
      expect(link.href).toBe("blob:save");
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:save");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hydrates extended run ranges, shop capacity and uid allocator state without truncation", () => {
    const r = createRun(9);
    r.speedLevel = 10;
    r.benchUpgradeLevel = 4;
    r.shopSlotCount = 12;
    r.shop = [...r.shop, ...Array(7).fill(null)];
    r.bench = [{ uid: "u77", baseId: "ant_guard", star: 1, equips: [] }];
    r.nextUid = 2;
    const migrated = migrate(createEnvelope({ player: r }))!;
    expect(migrated.envelope.payload.player).toMatchObject({
      speedLevel: 10, benchUpgradeLevel: 4, shopSlotCount: 12, nextUid: 78, aiMode: "TUTORIAL",
    });
    expect(migrated.envelope.payload.player?.shop).toHaveLength(12);
  });

  it("hydrates additive run bonuses and migrates legacy deployBonus safely", () => {
    const r = createRun(10) as ReturnType<typeof createRun> & { deployBonus?: number };
    r.deployBonus = 3;
    r.deployCapBonus = Number.NaN;
    r.teamAtkPct = 7;
    r.interestRateBonus = 0.02;
    const migrated = migrate(createEnvelope({ player: r }))!;
    expect(migrated.envelope.payload.player).toMatchObject({
      deployCapBonus: 3, teamAtkPct: 7, interestRateBonus: 0.02,
    });
    expect("deployBonus" in migrated.envelope.payload.player!).toBe(false);
  });

  it("backfills newly materialized bonus fields from legacy augmentMods", () => {
    const r = createRun(11) as ReturnType<typeof createRun> & Record<string, unknown>;
    r.augmentMods = {
      team_atk_pct: 0.09,
      lifesteal_pct: 0.06,
      interest_rate_bonus: 0.02,
      extra_class_count: 1,
      inventory_bonus: 2,
      win_gold_bonus: 3,
    };
    for (const key of ["teamAtkPct", "lifestealPct", "interestRateBonus", "extraClassCount", "inventoryBonus", "winGoldBonus"]) {
      delete r[key];
    }
    const migrated = migrate(createEnvelope({ player: r as ReturnType<typeof createRun> }))!;
    expect(migrated.envelope.payload.player).toMatchObject({
      teamAtkPct: 9,
      lifestealPct: 6,
      interestRateBonus: 0.02,
      extraClassCount: 1,
      inventoryBonus: 2,
      winGoldBonus: 3,
    });
  });

  it("defensively hydrates phase, bag, tech, augments and active augment choices", () => {
    const r = createRun(12) as ReturnType<typeof createRun> & Record<string, unknown>;
    const raw = r as unknown as Record<string, unknown>;
    raw.phase = "BROKEN";
    raw.shopLocked = "yes";
    raw.itemBag = ["tear", "eq_blue_buff", "missing_item", 7];
    r.techLevels = { vet: 9, survive: 123456, ghost_tech: 4 };
    r.augments = ["gold_cache_1", "gold_cache_1", "missing_augment"];
    r.activeAugmentChoices = ["gold_cache_1", "team_atk_1", "missing_augment", "team_atk_1"];
    r.unequipDiscount = -99;
    const migrated = migrate(createEnvelope({ player: r as ReturnType<typeof createRun> }))!;
    expect(migrated.envelope.payload.player).toMatchObject({
      phase: "PLANNING",
      shopLocked: false,
      itemBag: ["tear", "eq_blue_buff"],
      techLevels: { vet: 1, survive: 123456 },
      augments: ["gold_cache_1"],
      activeAugmentChoices: ["team_atk_1"],
      unequipDiscount: 0,
    });
  });

  it("Clear Run keeps profiles + settings; full clear removes profiles", () => {
    const s = mem();
    Object.assign(s.m, { [PROGRESS_KEY]: "x", [ACHIEVEMENTS_KEY]: "{}", [COLLECTION_KEY]: "{}", [SETTINGS_KEY]: "{}" });
    clearRunProgress(s);
    expect(Object.keys(s.m).sort()).toEqual([ACHIEVEMENTS_KEY, COLLECTION_KEY, SETTINGS_KEY].sort());
    clearProgress(s);
    expect(Object.keys(s.m)).toEqual([SETTINGS_KEY]);
  });

  it("co-op: empty SAVE_2 targets SAVE_2; NEW → AUTO; malformed slot ignored; resume exposes summary", () => {
    const s = mem();
    expect(selectCoopSlot(s, "SAVE_2")).toEqual({ mode: "new", activeSlot: "SAVE_2" });
    expect(selectCoopSlot(s, "NEW")).toEqual({ mode: "new", activeSlot: "AUTO" });
    expect(() => saveCoopSlot(s, "AUTO", { player: createRun(1) })).toThrow();
    saveCoopSlot(s, "SAVE_1", { players: { P1: createRun(1), P2: createRun(2) }, localSlot: "P1", aiMode: "COOP_MEDIUM" });
    const doc = JSON.parse(s.m[COOP_KEY]!);
    doc.slots.SAVE_3 = { envelope: 42 };
    s.m[COOP_KEY] = JSON.stringify(doc);
    const sel = selectCoopSlot(s, "SAVE_1");
    expect(sel.mode === "resume" && sel.summary).toMatchObject({ round: 1, hearts: 3, playerCapacity: 2, localSlot: "P1" });
    expect(selectCoopSlot(s, "SAVE_3").mode).toBe("new");
  });

  it("two-player host swap keeps player-owned board/bench under the new local slot", () => {
    const a = createRun(1); a.gold = 77;
    const b = createRun(2); b.gold = 5;
    const out = remapCoopHost({ players: { P1: a, P2: b }, localSlot: "P1" }, "P2", "ROOM");
    expect([out.localSlot, out.hostSlot, out.roomCode, out.players!.P2!.gold, out.players!.P1!.gold]).toEqual(["P2", "P2", "ROOM", 77, 5]);
  });
});

describe("settings A35/A44", () => {
  it("defaults, clamps and per-mode AI legality", () => {
    const d = normalizeSettings({ volumeLevel: 99, resolutionKey: "800x600", renderScale: 0.2, tooltipMode: "expanded", aiModeByGameMode: { FortressPvP4: "EASY" } });
    expect([d.volumeLevel, d.resolutionKey, d.renderScale, d.expandedTooltip, d.language, d.guiScale]).toEqual([10, "adaptive", 0.5, true, "vi", 2]);
    expect(d.loseCondition).toBe("NO_UNITS");
    expect(normalizeSettings({ loseCondition: "NO_HEARTS" }).loseCondition).toBe("NO_HEARTS");
    expect(d.aiModeByGameMode).toEqual({
      EndlessPvEClassic: "TUTORIAL", EndlessPvEFortress: "MEDIUM", EndlessCreative: "TUTORIAL", FortressPvP4: "COOP4_MEDIUM",
    });
  });

  it("keys: invalid → default, ESCAPE reserved, lower-case normalized", () => {
    const k = normalizeSettings({ keys: { planning: { reroll: "q", buyXp: "ESCAPE", sell: "F1" } } }).keys.planning;
    expect([k.reroll, k.buyXp, k.sell, k.startCombat]).toEqual(["Q", "F", "E", "SPACE"]);
  });

  it("corrupt storage boots with defaults; preview notifies now, writes after 200 ms; resetKeys per context", () => {
    vi.useFakeTimers();
    const s = mem();
    s.m[SETTINGS_KEY] = "{bad";
    expect(loadSettings(s).volumeLevel).toBe(5);
    const store = createSettingsStore(s);
    const seen: number[] = [];
    store.subscribe((x) => seen.push(x.volumeLevel));
    store.preview({ volumeLevel: 7 });
    store.preview({ volumeLevel: 8 });
    expect([seen, s.setItem.mock.calls.length]).toEqual([[7, 8], 0]);
    vi.advanceTimersByTime(200);
    expect(s.setItem).toHaveBeenCalledTimes(4);
    expect(JSON.parse(s.m[SETTINGS_KEY]!).volumeLevel).toBe(8);
    expect(JSON.parse(s.m[SETTINGS_KEY]!)).not.toHaveProperty("quality");
    expect([s.m[GRAPHICS_QUALITY_KEY], s.m[RENDER_SCALE_KEY], s.m[BATTERY_SAVER_KEY]]).toEqual(["high", "1", "0"]);
    store.save({ keys: { ...store.get().keys, combat: { step: "Z", settings: "ESCAPE", toggleAudio: "M" } } });
    store.resetKeys("combat");
    expect(store.get().keys.combat.step).toBe("SPACE");
    vi.useRealTimers();
  });

  it("stores graphics-only preferences under the exact A104 device keys with legacy fallback", () => {
    const s = mem();
    s.m[SETTINGS_KEY] = JSON.stringify({ quality: "low", renderScale: 0.75, batterySaver: true });
    expect(loadSettings(s)).toMatchObject({ quality: "low", renderScale: 0.75, batterySaver: true });
    s.m[GRAPHICS_QUALITY_KEY] = "medium";
    s.m[RENDER_SCALE_KEY] = "0.67";
    s.m[BATTERY_SAVER_KEY] = "false";
    expect(loadGraphicsPreferences(s)).toEqual({ quality: "medium", renderScale: 0.67, batterySaver: false });
    expect(loadSettings(s)).toMatchObject({ quality: "medium", renderScale: 0.67, batterySaver: false });

    expect(saveGraphicsPreferences(s, { quality: "low", renderScale: 0.1, batterySaver: true })).toBe(true);
    expect([s.m[GRAPHICS_QUALITY_KEY], s.m[RENDER_SCALE_KEY], s.m[BATTERY_SAVER_KEY]]).toEqual(["low", "0.5", "1"]);

    const store = createSettingsStore(s);
    store.save({ quality: "high", renderScale: 0.75, batterySaver: false });
    const shared = JSON.parse(s.m[SETTINGS_KEY]!);
    expect(shared).not.toHaveProperty("quality");
    expect(shared).not.toHaveProperty("renderScale");
    expect(shared).not.toHaveProperty("batterySaver");
    expect([s.m[GRAPHICS_QUALITY_KEY], s.m[RENDER_SCALE_KEY], s.m[BATTERY_SAVER_KEY]]).toEqual(["high", "0.75", "0"]);
  });
});
