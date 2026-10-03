import { describe, expect, it } from "vitest";
import { COOP_KEY, createCoopRunPayload, PROGRESS_KEY, saveCoopSlot, selectCoopSlot } from "../src/core/save";
import { persistCoopPlanningProgress, restoreCoopProgress } from "../src/network/coopPersistence";
import { CoopSessionStore } from "../src/network/coopSession";

function memoryStore() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

describe("co-op session restore and planning saves A114", () => {
  it("restores the local owner, 4P room and shared state into a clean live session", () => {
    const store = memoryStore();
    const saved = createCoopRunPayload(1, "COOP4_HARD");
    saved.localSlot = "P3";
    saved.hostSlot = "P2";
    saved.roomCode = "ROOM42";
    saved.players!.P3!.gold = 77;
    saved.shared!.round = 9;
    saved.shared!.phase = "PLANNING";
    saved.shared!.enemyPreview = [{ uid: "far-row", baseId: "ant_guard", star: 1, row: 17, col: 7 }];
    saveCoopSlot(store, "SAVE_2", saved);
    const sessions = new CoopSessionStore();
    sessions.create({
      roomCode: "OLD", readyBySlot: { P1: true }, client: { old: true },
      currentCombatPayload: { round: 1 }, coopCombatSnapshot: { revision: 20 },
      combatSnapshotsBySlot: { P1: { revision: 20 } },
    });
    let notices = 0;
    sessions.subscribe(() => notices++);
    const restored = restoreCoopProgress(store, "SAVE_2", sessions);
    expect(restored.kind).toBe("restored");
    if (restored.kind !== "restored") throw new Error("expected restore");
    expect(restored.localPlayer).toBe(restored.payload.players!.P3);
    expect(restored.localPlayer).toMatchObject({ gold: 77, round: 9 });
    expect(restored.payload.shared!.enemyPreview[0]!.row).toBe(17);
    expect(restored.localPlayer.enemyPreview[0]!.row).toBe(17);
    const session = sessions.get()!;
    expect(session).toMatchObject({
      roomCode: "ROOM42", localSlot: "P3", hostSlot: "P2", playerCapacity: 4,
      aiMode: "COOP4_HARD", activeSaveSlotId: "SAVE_2", saveMode: "resume",
      client: null, currentCombatPayload: null, coopCombatSnapshot: null, combatSnapshotsBySlot: {},
    });
    expect(Object.keys(session.players)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(Object.values(session.readyBySlot)).toEqual([false, false, false, false]);
    expect(session.resumeState).toEqual(restored.payload);
    expect(session.resumeState).not.toBe(restored.payload);
    restored.localPlayer.gold = 88;
    expect((session.resumeState as typeof restored.payload).players!.P3!.gold).toBe(77);
    expect(notices).toBe(1);
  });

  it("saves planning changes to the live active slot and updates the session mirror", () => {
    const store = memoryStore();
    const sessions = new CoopSessionStore();
    sessions.create({ activeSaveSlotId: "SAVE_3", roomCode: "ACTIVE", localSlot: "P2" });
    const payload = createCoopRunPayload(2);
    payload.players!.P2!.gold = 56;
    expect(persistCoopPlanningProgress(store, payload, sessions)).toBe("coop_saved");
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
    const saved = selectCoopSlot(store, "SAVE_3");
    expect(saved.mode).toBe("resume");
    if (saved.mode !== "resume") throw new Error("expected saved slot");
    expect(saved.payload).toMatchObject({ roomCode: "ACTIVE", localSlot: "P2" });
    expect(saved.payload.players!.P2!.gold).toBe(56);
    expect(sessions.get()!.resumeState).toEqual(saved.payload);
    expect(selectCoopSlot(store, "AUTO").mode).toBe("new");
  });

  it("leaves the session alone for an empty slot and refuses PvP or invalid save owners", () => {
    const store = memoryStore();
    const sessions = new CoopSessionStore();
    sessions.create({ roomCode: "KEEP" });
    const before = sessions.get();
    expect(restoreCoopProgress(store, "SAVE_1", sessions)).toEqual({ kind: "new", activeSlot: "SAVE_1" });
    expect(sessions.get()).toBe(before);
    sessions.update({ sessionType: "pvp_fortress" });
    expect(persistCoopPlanningProgress(store, createCoopRunPayload(), sessions)).toBe("failed");
    sessions.update({ sessionType: "p2p_host_relay", activeSaveSlotId: "UNKNOWN" });
    expect(persistCoopPlanningProgress(store, createCoopRunPayload(), sessions)).toBe("failed");
    expect(store.getItem(COOP_KEY)).toBeNull();
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
  });
});
