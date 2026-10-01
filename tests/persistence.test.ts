import { describe, expect, it, vi } from "vitest";
import { createRun } from "../src/core/run";
import {
  ACHIEVEMENTS_KEY, clearProgress, clearRunProgress, COLLECTION_KEY, COOP_KEY, importProgress, inspectSave,
  PROGRESS_KEY, remapCoopHost, saveCoopSlot, saveRun, selectCoopSlot,
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
    const text = JSON.stringify({ version: 4, payload: { player: createRun(3) }, achievementsProfile: { a: 1 }, collectionProfile: { c: 2 } });
    expect(importProgress(s, text, false)?.player?.round).toBe(1);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(importProgress(s, "[]", true)).toBeNull();
    importProgress(s, text, true);
    expect(JSON.parse(s.m[ACHIEVEMENTS_KEY]!)).toEqual({ a: 1 });
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
    expect(sel.mode === "resume" && sel.summary).toMatchObject({ round: 1, hearts: 100, playerCapacity: 2, localSlot: "P1" });
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
    expect([d.volumeLevel, d.resolutionKey, d.renderScale, d.expandedTooltip, d.language, d.guiScale]).toEqual([10, "1600x900", 0.5, true, "vi", 2]);
    expect(d.aiModeByGameMode).toEqual({ EndlessPvEClassic: "TUTORIAL", EndlessCreative: "TUTORIAL", FortressPvP4: "COOP4_MEDIUM" });
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
    expect(s.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(s.m[SETTINGS_KEY]!).volumeLevel).toBe(8);
    store.save({ keys: { ...store.get().keys, combat: { step: "Z", settings: "ESCAPE", toggleAudio: "M" } } });
    store.resetKeys("combat");
    expect(store.get().keys.combat.step).toBe("SPACE");
    vi.useRealTimers();
  });
});
