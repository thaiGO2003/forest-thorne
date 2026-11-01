import { describe, expect, it, vi } from "vitest";
import { createRun, type RunState } from "../src/core/run";
import {
  ACHIEVEMENTS_KEY, clearCollectionProfile, clearProgress, clearRunProgress, COLLECTION_KEY, COOP_KEY, createEnvelope,
  ENVELOPE_VERSION, exportProgress, importProgress, inspectSave, loadAchievementProfile, loadCollectionProfile, migrate, PROGRESS_KEY, remapCoopHost,
  saveCollectionProfile, saveCoopSlot, saveRun, selectCoopSlot,
} from "../src/core/save";
import { createSettingsStore, loadSettings, normalizeSettings, SETTINGS_KEY } from "../src/core/settings";

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

  it("v1 run migrates to v5: level clamped to 25, bench_up 0..4 preserved, unknown units dropped, persisted once", () => {
    const s = mem();
    const p = createRun(2);
    Object.assign(p, { level: 40, benchUpgradeLevel: 4 });
    p.bench = [{ uid: "a", baseId: "ghost_unit", star: 1, equips: [] }, { uid: "b", baseId: "ant_guard", star: 2, equips: [] }];
    s.m[PROGRESS_KEY] = JSON.stringify({ payload: { player: p } });
    const r = inspectSave(s);
    if (r.status !== "valid") throw new Error(r.status);
    const out = r.envelope.payload.player!;
    expect([r.envelope.version, out.level, out.benchUpgradeLevel, out.bench.map((u) => u.uid)]).toEqual([5, 25, 4, ["b"]]);
    const writes = s.setItem.mock.calls.length;
    inspectSave(s);
    expect(s.setItem.mock.calls.length).toBe(writes);
  });

  it("legacy saves without heartEscrow normalize to zero while persisted combat preserves a reserved heart", () => {
    const legacyStore = mem();
    const legacy = createRun(21) as Omit<RunState, "heartEscrow"> & { heartEscrow?: 0 | 1 };
    delete legacy.heartEscrow;
    legacyStore.m[PROGRESS_KEY] = JSON.stringify(createEnvelope({ player: legacy as RunState }));
    const legacyInspection = inspectSave(legacyStore);
    if (legacyInspection.status !== "valid") throw new Error(legacyInspection.status);
    expect(legacyInspection.envelope.payload.player?.heartEscrow).toBe(0);

    const combatStore = mem();
    const combat = createRun(22);
    combat.phase = "COMBAT";
    combat.heartEscrow = 1;
    saveRun(combatStore, { player: combat });
    const combatInspection = inspectSave(combatStore);
    if (combatInspection.status !== "valid") throw new Error(combatInspection.status);
    expect([combatInspection.envelope.payload.player?.phase, combatInspection.envelope.payload.player?.heartEscrow])
      .toEqual(["COMBAT", 1]);
  });

  it("import persist=false never writes; persist=true restores normalized canonical profiles", () => {
    const s = mem();
    const text = JSON.stringify({
      version: 4,
      payload: { player: createRun(3) },
      achievementsProfile: { version: 1, stats: { runs_started: 4, highest_level: 3 } },
      collectionProfile: {
        version: 1,
        unlockedSkinIds: ["skin.lofi_a", "skin.lofi_a"],
        claimedAchievementIds: [],
        equippedSkinByUnit: { ant_guard: "skin.lofi_a" },
      },
    });
    expect(importProgress(s, text, false)?.player?.round).toBe(1);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(importProgress(s, "[]", true)).toBeNull();
    importProgress(s, text, true);
    expect(ACHIEVEMENTS_KEY).toBe("forest_throne_endless_achievements_v1");
    expect(COLLECTION_KEY).toBe("forest_throne_collection_profile_v1");
    expect(JSON.parse(s.m[ACHIEVEMENTS_KEY]!).stats).toMatchObject({ runs_started: 4, highest_level: 3 });
    expect(JSON.parse(s.m[COLLECTION_KEY]!)).toEqual({
      version: 2,
      unlockedSkinIds: ["gaMaiNguNuong", "skin.loli_a"],
      claimedAchievementIds: [],
      equippedSkinByUnitId: { ant_guard: "skin.loli_a" },
    });
  });

  it("side profile stores tolerate corruption, normalize before save, and clear only their own key", () => {
    const s = mem();
    s.m[ACHIEVEMENTS_KEY] = "{bad";
    s.m[COLLECTION_KEY] = "{bad";
    expect(loadAchievementProfile(s).stats).toMatchObject({ runs_started: 0, highest_level: 1 });
    expect(loadCollectionProfile(s)).toEqual({
      version: 2,
      unlockedSkinIds: ["gaMaiNguNuong"],
      claimedAchievementIds: [],
      equippedSkinByUnitId: {},
    });
    saveCollectionProfile(s, {
      version: 1,
      unlockedSkinIds: ["skin.lofi_a", "", "skin.lofi_a"],
      claimedAchievementIds: ["runs_started_1", "runs_started_1"],
      equippedSkinByUnit: { ant_guard: "skin.lofi_a" },
    });
    expect(JSON.parse(s.m[COLLECTION_KEY]!)).toEqual({
      version: 2,
      unlockedSkinIds: ["gaMaiNguNuong", "skin.loli_a"],
      claimedAchievementIds: ["runs_started_1"],
      equippedSkinByUnitId: { ant_guard: "skin.loli_a" },
    });
    Object.assign(s.m, { [PROGRESS_KEY]: "run", [SETTINGS_KEY]: "settings", [ACHIEVEMENTS_KEY]: "{}" });
    clearCollectionProfile(s);
    expect(s.m[COLLECTION_KEY]).toBeUndefined();
    expect(s.m[PROGRESS_KEY]).toBe("run");
    expect(s.m[ACHIEVEMENTS_KEY]).toBe("{}");
    expect(s.m[SETTINGS_KEY]).toBe("settings");
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
    const r = createRun(10) as RunState & { deployBonus?: number };
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
    const r = createRun(11) as RunState & Record<string, unknown>;
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
    const migrated = migrate(createEnvelope({ player: r as RunState }))!;
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
    const r = createRun(12) as RunState & Record<string, unknown>;
    const raw = r as unknown as Record<string, unknown>;
    raw.phase = "BROKEN";
    raw.shopLocked = "yes";
    raw.itemBag = ["tear", "eq_blue_buff", "missing_item", 7];
    r.techLevels = { vet: 9, survive: 123456, ghost_tech: 4 };
    r.augments = ["gold_cache_1", "gold_cache_1", "missing_augment"];
    r.activeAugmentChoices = ["gold_cache_1", "team_atk_1", "missing_augment", "team_atk_1"];
    r.unequipDiscount = -99;
    const migrated = migrate(createEnvelope({ player: r as RunState }))!;
    expect(migrated.envelope.payload.player).toMatchObject({
      phase: "PLANNING",
      shopLocked: false,
      itemBag: ["tear", "eq_blue_buff", "missing_item"],
      techLevels: { vet: 1, survive: 123456 },
      augments: ["gold_cache_1"],
      activeAugmentChoices: ["team_atk_1"],
      unequipDiscount: 0,
    });
  });

  it("preserves unknown, duplicate and authored material/equipment IDs through v1, v4, v5 and future v6 migrations", () => {
    const ids = ["legacy_eq_alpha", "tear", "eq_blue_buff", "legacy_eq_alpha", "eq_warmog_armor"];
    const invalid = [17, null, false, { id: "tear" }, ["feather"]];
    for (const version of [1, 4, ENVELOPE_VERSION, ENVELOPE_VERSION + 1]) {
      const player = createRun(version);
      player.itemBag = [...ids, ...invalid] as unknown as string[];
      const source = createEnvelope({ player }, { version });
      const original = structuredClone(source);

      const migrated = migrate(source)!;
      expect(source).toEqual(original);
      expect(migrated.envelope.version).toBe(Math.max(version, ENVELOPE_VERSION));
      expect(migrated.envelope.payload.player?.itemBag).toEqual(ids);
      expect(migrated.envelope.payload.player?.itemBag).not.toBe(player.itemBag);

      const repeated = migrate(migrated.envelope)!;
      expect(repeated.changed).toBe(false);
      expect(repeated.envelope.payload.player?.itemBag).toEqual(ids);
    }
  });

  it("recovers rejected equipped items without losing duplicate ownership during solo migration", () => {
    const player = createRun(71);
    player.itemBag = ["legacy_ghost", "tear", "legacy_ghost"];
    player.board[0] = { uid: "board-a", baseId: "ant_guard", star: 1, equips: ["eq_blue_buff", "legacy_ghost", "legacy_ghost", "eq_warmog_armor"] };
    player.bench = [{ uid: "bench-b", baseId: "ant_guard", star: 1, equips: ["legacy_bench", "eq_warmog_armor"] }];
    const source = createEnvelope({ player }, { version: 4 });
    const original = structuredClone(source);

    const migrated = migrate(source)!;
    const saved = migrated.envelope.payload.player!;
    expect(source).toEqual(original);
    expect(saved.board[0]?.equips).toEqual(["eq_blue_buff"]);
    expect(saved.bench[0]?.equips).toEqual([]);
    expect(saved.itemBag).toEqual([
      "legacy_ghost", "tear", "legacy_ghost",
      "legacy_ghost", "legacy_ghost", "eq_warmog_armor",
      "legacy_bench", "eq_warmog_armor",
    ]);
    const repeated = migrate(migrated.envelope)!;
    expect(repeated.changed).toBe(false);
    expect(repeated.envelope.payload.player?.itemBag).toEqual(saved.itemBag);
  });

  it("keeps rejected equipment with its original co-op owner", () => {
    const a = createRun(81);
    const b = createRun(82);
    a.itemBag = ["old_a"];
    b.itemBag = ["old_b", "old_b"];
    a.board[0] = { uid: "owned-a", baseId: "ant_guard", star: 1, equips: ["old_a_equipped"] };
    b.bench = [{ uid: "owned-b", baseId: "ant_guard", star: 1, equips: ["old_b_equipped", "old_b_equipped"] }];
    const source = createEnvelope({ players: { P1: a, P2: b }, localSlot: "P1", aiMode: "COOP_MEDIUM" }, { version: 4 });
    const migrated = migrate(source)!;
    expect(migrated.envelope.payload.players?.P1?.itemBag).toEqual(["old_a", "old_a_equipped"]);
    expect(migrated.envelope.payload.players?.P2?.itemBag).toEqual(["old_b", "old_b", "old_b_equipped", "old_b_equipped"]);
    expect(migrated.envelope.payload.players?.P1?.board[0]?.equips).toEqual([]);
    expect(migrated.envelope.payload.players?.P2?.bench[0]?.equips).toEqual([]);
    expect(migrate(migrated.envelope)!.changed).toBe(false);
  });

  it("salvages items from dropped unknown units without inventing their identity", () => {
    const player = createRun(83);
    player.itemBag = ["tear", "unknown_inventory"];
    player.bench = [{ uid: "removed", baseId: "missing_unit", star: 1, equips: ["legacy_equipped", "legacy_equipped", "eq_blue_buff"] }];
    const source = createEnvelope({ player }, { version: 4 });
    const original = structuredClone(source);
    const migrated = migrate(source)!;
    const saved = migrated.envelope.payload.player!;
    expect(source).toEqual(original);
    expect(saved.bench).toEqual([]);
    expect(saved.itemBag).toEqual(["tear", "unknown_inventory", "legacy_equipped", "legacy_equipped", "eq_blue_buff"]);
    expect(migrate(migrated.envelope)!.envelope.payload.player?.itemBag).toEqual(saved.itemBag);
  });

  it("recovers equipped items on trimmed board tiles even with a full legacy bag", () => {
    const player = createRun(84);
    player.itemBag = Array(20).fill("legacy_full_slot");
    player.board[25] = { uid: "off-board", baseId: "ant_guard", star: 1, equips: ["eq_blue_buff", "legacy_overflow"] };
    const source = createEnvelope({ player }, { version: 4 });
    const migrated = migrate(source)!;
    const saved = migrated.envelope.payload.player!;
    expect(saved.board).toHaveLength(25);
    expect(saved.itemBag).toEqual([...player.itemBag, "eq_blue_buff", "legacy_overflow"]);
    expect(migrate(migrated.envelope)!.changed).toBe(false);
  });

  it("normalizes malformed non-array item bags without modifying the supplied envelope", () => {
    for (const malformed of [null, "tear", 42, { 0: "claw", length: 1 }]) {
      const player = createRun(13);
      (player as unknown as Record<string, unknown>).itemBag = malformed;
      const source = createEnvelope({ player });
      const original = structuredClone(source);
      const migrated = migrate(source)!;
      expect(source).toEqual(original);
      expect(migrated.envelope.payload.player?.itemBag).toEqual([]);
      const repeated = migrate(migrated.envelope)!;
      expect(repeated.changed).toBe(false);
      expect(repeated.envelope.payload.player?.itemBag).toEqual([]);
    }
  });

  it("keeps unknown item IDs, order and duplicates through solo save, export and import", () => {
    const ids = ["legacy_ghost", "feather", "legacy_ghost", "eq_warmog_armor", "legacy_potion"];
    const original = createRun(31);
    original.itemBag = ids.slice();
    const store = mem();
    const envelope = saveRun(store, { player: original });
    const loaded = inspectSave(store);
    if (loaded.status !== "valid") throw new Error(loaded.status);
    expect(loaded.envelope.payload.player?.itemBag).toEqual(ids);
    expect(original.itemBag).toEqual(ids);

    const exported = exportProgress(envelope);
    const importedStore = mem();
    expect(importProgress(importedStore, exported, false)?.player?.itemBag).toEqual(ids);
    expect(importedStore.setItem).not.toHaveBeenCalled();
    expect(importProgress(importedStore, exported, true)?.player?.itemBag).toEqual(ids);
    expect(inspectSave(importedStore)).toMatchObject({
      status: "valid", envelope: { payload: { player: { itemBag: ids } } },
    });
  });

  it("preserves separate unknown item ownership and duplicates across co-op recovery and host remap", () => {
    const a = createRun(41);
    const b = createRun(42);
    a.itemBag = ["old_a", "old_a", "claw"];
    b.itemBag = ["eq_warmog_armor", "old_b", "old_a"];
    const store = mem();
    saveCoopSlot(store, "SAVE_1", {
      players: { P1: a, P2: b }, localSlot: "P1", aiMode: "COOP_MEDIUM",
    });
    const slot = selectCoopSlot(store, "SAVE_1");
    expect(slot.mode).toBe("resume");
    if (slot.mode !== "resume") throw new Error("missing co-op slot");
    expect(slot.payload.players?.P1?.itemBag).toEqual(a.itemBag);
    expect(slot.payload.players?.P2?.itemBag).toEqual(b.itemBag);
    expect(slot.payload.players?.P1?.itemBag).not.toBe(slot.payload.players?.P2?.itemBag);
    expect(selectCoopSlot(store, "SAVE_1")).toMatchObject({ mode: "resume" });

    const moved = remapCoopHost(slot.payload, "P2");
    expect([moved.localSlot, moved.hostSlot]).toEqual(["P2", "P2"]);
    expect(moved.players?.P2?.itemBag).toEqual(a.itemBag);
    expect(moved.players?.P1?.itemBag).toEqual(b.itemBag);
    expect(slot.payload.players?.P1?.itemBag).toEqual(a.itemBag);
    expect(slot.payload.players?.P2?.itemBag).toEqual(b.itemBag);
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
    saveCoopSlot(s, "SAVE_2", {
      players: { P1: createRun(3), P2: createRun(4) },
      localSlot: "P3",
      aiMode: "COOP_MEDIUM",
    });
    const fallback = selectCoopSlot(s, "SAVE_2");
    expect(fallback.mode === "resume" && fallback.summary).toMatchObject({ playerCapacity: 2, localSlot: "P1" });
  });

  it("two-player host swap keeps player-owned board/bench under the new local slot", () => {
    const a = createRun(1); a.gold = 77;
    const b = createRun(2); b.gold = 5;
    const out = remapCoopHost({ players: { P1: a, P2: b }, localSlot: "P1" }, "P2", "ROOM");
    expect([out.localSlot, out.hostSlot, out.roomCode, out.players!.P2!.gold, out.players!.P1!.gold]).toEqual(["P2", "P2", "ROOM", 77, 5]);
  });

  it("co-op host remap rejects slots outside the selected player profile", () => {
    const a = createRun(1); a.gold = 77;
    const b = createRun(2); b.gold = 5;
    const out = remapCoopHost(
      { players: { P1: a, P2: b }, localSlot: "P3", aiMode: "COOP_MEDIUM" },
      "P4",
      "ROOM",
    );
    expect([out.localSlot, out.hostSlot, out.playerCapacity, out.players!.P1!.gold, out.players!.P2!.gold])
      .toEqual(["P1", "P1", 2, 77, 5]);
  });
});

describe("settings A35/A44", () => {
  it("defaults, clamps and per-mode AI legality", () => {
    const d = normalizeSettings({
      language: "en", volumeLevel: 99, musicVolume: 99, resolutionKey: "800x600", guiScale: 2,
      fpsLimit: 144, renderScale: 0.2, batterySaver: true, shadowsEnabled: "off",
      tooltipMode: "expanded", aiModeByGameMode: { FortressPvP4: "EASY" },
    });
    expect([
      d.volumeLevel, d.musicVolume, d.resolutionKey, d.expandedTooltip, d.language, d.guiScale, d.fpsLimit,
      d.renderScale, d.shadowsEnabled,
    ]).toEqual([10, 10, "1600x900", true, "vi", 1, 30, 0.5, true]);
    expect(d.aiModeByGameMode).toEqual({
      EndlessPvEClassic: "TUTORIAL", EndlessPvEFortress: "MEDIUM", EndlessCreative: "TUTORIAL", FortressPvP4: "COOP4_MEDIUM",
    });
  });

  it("preserves independent audio category flags on reload while legacy saves default them on", () => {
    const storage = mem();
    storage.m[SETTINGS_KEY] = JSON.stringify({ musicEnabled: false, audioMuted: false });
    const migrated = loadSettings(storage);
    expect([migrated.musicEnabled, migrated.ambientEnabled, migrated.uiSfxEnabled, migrated.combatSfxEnabled])
      .toEqual([false, true, true, true]);

    const settings = createSettingsStore(storage);
    settings.save({ ambientEnabled: false, uiSfxEnabled: false, combatSfxEnabled: true });
    const loaded = loadSettings(storage);
    expect([loaded.musicEnabled, loaded.ambientEnabled, loaded.uiSfxEnabled, loaded.combatSfxEnabled])
      .toEqual([false, false, false, true]);
    expect(createSettingsStore(storage).get()).toEqual(loaded);
  });

  it("migrates legacy battery saver into the FPS default without preserving the retired setting", () => {
    const migrated = normalizeSettings({ batterySaver: true, subtitleEnabled: false, fpsLimit: 120, renderScale: 1.4 });
    expect([migrated.fpsLimit, migrated.renderScale, migrated.narrationEnabled, "batterySaver" in migrated]).toEqual([120, 1, false, false]);
  });

  it("keys: defaults use R and Right Shift; invalid → default, ESCAPE reserved, lower-case normalized", () => {
    const defaults = normalizeSettings(null).keys.planning;
    expect([defaults.reroll, defaults.newRun, defaults.reroll === "D"]).toEqual(["R", "SHIFTRIGHT", false]);
    const k = normalizeSettings({ keys: { planning: { reroll: "q", buyXp: "ESCAPE", sell: "F1", newRun: "SHIFT_LEFT" } } }).keys.planning;
    expect([k.reroll, k.buyXp, k.sell, k.startCombat, k.newRun]).toEqual(["Q", "F", "E", "SPACE", "SHIFTRIGHT"]);
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
    store.preview({ volumeLevel: 8, shadowsEnabled: false });
    expect([seen, s.setItem.mock.calls.length]).toEqual([[7, 8], 0]);
    vi.advanceTimersByTime(200);
    expect(s.setItem).toHaveBeenCalledTimes(1);
    expect([JSON.parse(s.m[SETTINGS_KEY]!).volumeLevel, JSON.parse(s.m[SETTINGS_KEY]!).shadowsEnabled]).toEqual([8, false]);
    store.save({ keys: { ...store.get().keys, combat: { step: "Z", settings: "ESCAPE", toggleAudio: "M" } } });
    store.resetKeys("combat");
    expect(store.get().keys.combat.step).toBe("SPACE");
    vi.useRealTimers();
  });
});
