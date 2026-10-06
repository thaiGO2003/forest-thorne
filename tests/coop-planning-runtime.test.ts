import { describe, expect, it, vi } from "vitest";
import { createRun, type OwnedUnit, type RunState } from "../src/core/run";
import { COOP_KEY, PROGRESS_KEY, selectCoopSlot, type RunPayload } from "../src/core/save";
import {
  CoopPlanningRuntime,
  composeCoopSharedBoard,
  sharedBoardLocationToLocalIndex,
} from "../src/network/coopPlanningRuntime";
import { CoopSessionStore } from "../src/network/coopSession";

function mem() {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (key: string) => (key in m ? m[key]! : null),
    setItem: vi.fn((key: string, value: string) => { m[key] = value; }),
    removeItem: (key: string) => { delete m[key]; },
  };
}

const owned = (uid: string, baseId = "ant_guard"): OwnedUnit => ({
  uid,
  baseId,
  star: 1,
  equips: [],
});

function planningRun(seed: number): RunState {
  const run = createRun(seed);
  run.tutorialSkipped = true;
  run.bench = [];
  run.board = Array(25).fill(null);
  return run;
}

function payloadFor(capacity: 2 | 4): RunPayload {
  const players: Record<string, RunState> = {};
  for (let index = 0; index < capacity; index++) {
    players[`P${index + 1}`] = planningRun(index + 1);
  }
  return {
    players,
    localSlot: "P1",
    hostSlot: "P1",
    playerCapacity: capacity,
    aiMode: capacity === 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM",
    selectedMode: "EndlessPvEClassic",
    roomCode: "ROOM42",
  };
}

describe("co-op planning runtime ownership", () => {
  it("maps 2P/4P shared rows only inside the actor-owned five-row span", () => {
    expect(sharedBoardLocationToLocalIndex(
      { playerCapacity: 2 },
      "P1",
      { where: "board", sharedRow: 4, col: 3 },
    )).toEqual({ where: "board", index: 23 });
    expect(sharedBoardLocationToLocalIndex(
      { playerCapacity: 2 },
      "P2",
      { where: "board", sharedRow: 5, col: 2 },
    )).toEqual({ where: "board", index: 2 });
    expect(sharedBoardLocationToLocalIndex(
      { playerCapacity: 2 },
      "P1",
      { where: "board", sharedRow: 5, col: 0 },
    )).toBeNull();
    expect(sharedBoardLocationToLocalIndex(
      { playerCapacity: 4 },
      "P4",
      { where: "board", sharedRow: 19, col: 4 },
    )).toEqual({ where: "board", index: 24 });
    expect(sharedBoardLocationToLocalIndex(
      { playerCapacity: 4 },
      "P4",
      { where: "board", sharedRow: 14, col: 4 },
    )).toBeNull();

    const payload = payloadFor(4);
    payload.players!.P1!.board[0] = owned("p1");
    payload.players!.P2!.board[6] = owned("p2", "deer_song");
    payload.players!.P3!.board[24] = owned("p3", "ram_charge");
    payload.players!.P4!.board[4] = owned("p4", "fox_flame");
    expect(composeCoopSharedBoard(payload, { playerCapacity: 4 }).map(
      ({ slot, localRow, sharedRow, col, unit }) => [slot, localRow, sharedRow, col, unit.uid],
    )).toEqual([
      ["P1", 0, 0, 0, "p1"],
      ["P2", 1, 6, 1, "p2"],
      ["P3", 4, 14, 4, "p3"],
      ["P4", 0, 15, 4, "p4"],
    ]);
  });

  it("applies local canonical move/replace/board-move/sell and persists only the active co-op slot", () => {
    const storage = mem();
    const sessions = new CoopSessionStore();
    sessions.create({
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      aiMode: "COOP_MEDIUM",
      activeSaveSlotId: "SAVE_2",
      roomCode: "ROOM42",
      players: { P1: { connected: true }, P2: { connected: true } },
    });
    const payload = payloadFor(2);
    payload.players!.P1!.bench = [owned("a"), owned("b", "deer_song")];
    payload.players!.P2!.bench = [owned("remote", "ram_charge")];
    const runtime = new CoopPlanningRuntime(storage, sessions);
    expect(runtime.attachPayload(payload)).not.toBeNull();

    expect(runtime.applyLocalIntent({
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 0, col: 0 },
    }).applied).toBe(true);
    expect(runtime.applyLocalIntent({
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 0, col: 0 },
      allowSwap: false,
    })).toMatchObject({ applied: false, reason: "mutation_rejected" });
    expect(runtime.applyLocalIntent({
      kind: "replace",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 0, col: 0 },
    }).applied).toBe(true);
    expect(runtime.applyLocalIntent({
      kind: "move",
      from: { where: "board", sharedRow: 0, col: 0 },
      to: { where: "board", sharedRow: 0, col: 1 },
    }).applied).toBe(true);

    const beforeSell = (sessions.get()!.resumeState as RunPayload).players!.P1!.gold;
    expect(runtime.applyLocalIntent({
      kind: "sell",
      from: { where: "board", sharedRow: 0, col: 1 },
    }).applied).toBe(true);

    const state = sessions.get()!;
    const resumed = state.resumeState as RunPayload;
    expect(resumed.players!.P1!.board[1]).toBeNull();
    expect(resumed.players!.P1!.gold).toBeGreaterThan(beforeSell);
    expect(resumed.players!.P2!.bench.map((unit) => unit.uid)).toEqual(["remote"]);
    expect(state.resumeSummary).toMatchObject({ slotId: "SAVE_2", localSlot: "P1", playerCapacity: 2 });
    expect(selectCoopSlot(storage, "SAVE_2")).toMatchObject({ mode: "resume", activeSlot: "SAVE_2" });
    expect(storage.m[COOP_KEY]).toBeDefined();
    expect(storage.m[PROGRESS_KEY]).toBeUndefined();
  });

  it("preserves shared preview authority through planning mutation and keeps the canonical saved payload in session state", () => {
    const storage = mem();
    const sessions = new CoopSessionStore();
    sessions.create({
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      activeSaveSlotId: "SAVE_2",
      players: { P1: { connected: true }, P2: { connected: true } },
    });
    const payload = payloadFor(2);
    payload.players!.P1!.bench = [owned("local")];
    payload.shared = {
      round: 1,
      phase: "PLANNING",
      enemyPreview: [{ uid: "host-e0", baseId: "ant_guard", star: 1, row: 2, col: 5 }],
      enemyPreviewRound: 1,
      enemyBudget: 17,
    };
    payload.players!.P2!.enemyPreview = [{ uid: "guest-stale", baseId: "deer_song", star: 1, row: 1, col: 6 }];
    payload.players!.P2!.enemyPreviewRound = 1;
    payload.players!.P2!.enemyBudget = 99;
    const runtime = new CoopPlanningRuntime(storage, sessions);
    runtime.attachPayload(payload);

    const result = runtime.applyLocalIntent({
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 0, col: 0 },
    });
    expect(result.applied).toBe(true);
    if (!result.applied) throw new Error("expected planning mutation");
    const resumed = sessions.get()!.resumeState as RunPayload;
    expect(resumed).toEqual(result.entry.envelope.payload);
    expect(resumed.shared).toMatchObject({ round: 1, enemyPreviewRound: 1, enemyBudget: 17 });
    expect(resumed.players!.P1!.enemyPreview[0]?.uid).toBe("host-e0");
    expect(resumed.players!.P2!.enemyPreview[0]?.uid).toBe("host-e0");
    const selected = selectCoopSlot(storage, "SAVE_2");
    expect(selected.mode === "resume" && selected.payload.shared).toEqual(resumed.shared);
  });

  it("rejects a local mutation into a remote-owned shared row without mutating or writing save state", () => {
    const storage = mem();
    const sessions = new CoopSessionStore();
    sessions.create({
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      activeSaveSlotId: "SAVE_1",
      players: { P1: { connected: true }, P2: { connected: true } },
    });
    const payload = payloadFor(2);
    payload.players!.P1!.bench = [owned("local")];
    const runtime = new CoopPlanningRuntime(storage, sessions);
    runtime.attachPayload(payload);
    const before = structuredClone(sessions.get()!.resumeState);
    const writes = storage.setItem.mock.calls.length;

    expect(runtime.applyLocalIntent({
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 5, col: 0 },
    })).toEqual({ applied: false, actorSlot: "P1", reason: "remote_cell" });
    expect(sessions.get()!.resumeState).toEqual(before);
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
    expect(storage.m[COOP_KEY]).toBeUndefined();
    expect(storage.m[PROGRESS_KEY]).toBeUndefined();
  });

  it("lets the host mutate only a connected sender-owned player and reloads it from the active co-op slot", () => {
    const storage = mem();
    const sessions = new CoopSessionStore();
    sessions.create({
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      aiMode: "COOP_MEDIUM",
      activeSaveSlotId: "SAVE_1",
      players: { P1: { connected: true }, P2: { connected: true } },
    });
    const payload = payloadFor(2);
    payload.players!.P1!.bench = [owned("host")];
    payload.players!.P2!.bench = [owned("guest", "deer_song")];
    const runtime = new CoopPlanningRuntime(storage, sessions);
    runtime.attachPayload(payload);

    expect(runtime.applyRemoteIntent("P2", {
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 5, col: 4 },
    }).applied).toBe(true);
    const current = sessions.get()!.resumeState as RunPayload;
    expect(current.players!.P1!.bench.map((unit) => unit.uid)).toEqual(["host"]);
    expect(current.players!.P2!.bench).toEqual([]);
    expect(current.players!.P2!.board[4]?.uid).toBe("guest");

    const restoredSessions = new CoopSessionStore();
    restoredSessions.create({
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      aiMode: "COOP_MEDIUM",
      activeSaveSlotId: "SAVE_1",
      players: { P1: { connected: true }, P2: { connected: true } },
    });
    const restored = new CoopPlanningRuntime(storage, restoredSessions).restoreActiveSave();
    expect(restored?.players?.P2?.board[4]?.uid).toBe("guest");

    sessions.update({ players: { P2: { connected: false } } });
    const writes = storage.setItem.mock.calls.length;
    expect(runtime.applyRemoteIntent("P2", {
      kind: "sell",
      from: { where: "board", sharedRow: 5, col: 4 },
    })).toEqual({ applied: false, actorSlot: "P2", reason: "sender_not_connected" });
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
    expect((sessions.get()!.resumeState as RunPayload).players!.P2!.board[4]?.uid).toBe("guest");
    expect(storage.m[PROGRESS_KEY]).toBeUndefined();
  });
});
