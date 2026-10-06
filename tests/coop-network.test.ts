import { describe, expect, it } from "vitest";
import {
  COOP_MESSAGE_TYPES,
  createCoopSignal,
  decodeCoopSignal,
  encodeCoopSignal,
  normalizeConnectionLabel,
  normalizeCoopCapacity,
  normalizeCoopSignalMetadata,
  normalizeCoopSignalTimeout,
} from "../src/network/coopConfig";
import {
  CoopSessionStore,
  createCoopSession,
  firstRemoteCoopSlot,
  remoteCoopSlots,
  updateCoopSession,
} from "../src/network/coopSession";
import {
  CoopCombatRevisionClock,
  acceptCoopCombatDelta,
  acceptCoopCombatHeartbeat,
  acceptCoopCombatSnapshot,
  createCoopCombatReceiverState,
  normalizeCoopCombatDelta,
  normalizeCoopCombatSnapshot,
} from "../src/network/coopCombatSync";

describe("co-op signalling and session authority", () => {
  it("normalizes capacity, labels and metadata without retaining resume references", () => {
    expect([normalizeCoopCapacity(1), normalizeCoopCapacity(9)]).toEqual([2, 4]);
    expect(normalizeConnectionLabel("ab-1?c")).toBe("AB1CXX");
    expect(normalizeConnectionLabel("abcdefghi")).toBe("ABCDEF");
    expect(normalizeConnectionLabel("---")).toBe("");
    expect(normalizeCoopSignalTimeout(1)).toBe(250);

    const resume = { round: 7, nested: { gold: 12 } };
    const metadata = normalizeCoopSignalMetadata({
      requiredCapacity: 4,
      targetSlot: "p4",
      hostSlotIndex: 0,
      roomCode: " room-7 ",
      resumeSummary: resume,
    });
    expect(metadata).toMatchObject({
      requiredCapacity: 4,
      targetSlot: "P4",
      targetSlotIndex: 3,
      hostSlotIndex: 0,
      roomCode: "ROOM7X",
      selectedMode: "EndlessPvEClassic",
      aiMode: "COOP_MEDIUM",
      saveSlotId: "AUTO",
      saveMode: "new",
    });
    expect(metadata.resumeSummary).toEqual(resume);
    expect(metadata.resumeSummary).not.toBe(resume);
  });

  it("round-trips URL-safe signals and rejects unsupported or malformed envelopes", () => {
    const encoded = encodeCoopSignal(createCoopSignal(
      "coop_offer",
      { type: "offer", sdp: "v=0\r\na=test" },
      { sessionId: "session-1", targetSlot: "P2" },
    ));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCoopSignal(encoded)).toMatchObject({
      kind: "coop_offer",
      version: 1,
      description: { type: "offer", sdp: "v=0\r\na=test" },
      metadata: { sessionId: "session-1", targetSlot: "P2" },
    });

    const invalidKind = btoa(JSON.stringify({
      kind: "bad",
      version: 1,
      description: { type: "offer", sdp: "x" },
    })).replace(/=+$/g, "");
    expect(() => decodeCoopSignal(invalidKind)).toThrow("Unsupported co-op signal envelope");
    expect(() => decodeCoopSignal("not-json")).toThrow("Malformed co-op signal");
    expect(COOP_MESSAGE_TYPES).toHaveLength(11);
  });

  it("keeps legal P1..P4 maps, rebuilds after capacity changes and notifies subscribers", () => {
    const created = createCoopSession({ playerCapacity: 4, localSlot: "P2", readyBySlot: { P4: true } });
    expect(Object.keys(created.readyBySlot)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(Object.keys(created.players)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(remoteCoopSlots(created)).toEqual(["P1", "P3", "P4"]);
    expect(firstRemoteCoopSlot(created)).toBe("P1");

    const shrunk = updateCoopSession(created, { playerCapacity: 2, localSlot: "P4" });
    expect(Object.keys(shrunk.players)).toEqual(["P1", "P2"]);
    expect(shrunk.localSlot).toBe("P2");

    const store = new CoopSessionStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    store.create({ playerCapacity: 2 });
    store.update({ readyBySlot: { P2: true } });
    unsubscribe();
    store.update({ readyBySlot: { P1: true } });
    expect(notifications).toBe(2);
    expect(store.get()?.readyBySlot).toEqual({ P1: true, P2: true });
  });
});

describe("co-op combat synchronization", () => {
  it("normalizes snapshots and delta events to the canonical wire shape", () => {
    const snapshot = normalizeCoopCombatSnapshot({
      round: 2,
      revision: 3,
      combatRound: 4,
      units: [
        { uid: "u1", side: "R", row: -3, col: 5.4, hp: 10.6, alive: false },
        { uid: "", hp: 99 },
      ],
    });
    expect(snapshot.units).toEqual([expect.objectContaining({
      uid: "u1", side: "RIGHT", row: 0, col: 5, hp: 11, alive: false,
    })]);
    expect(snapshot.turnCycleIndex).toBe(4);

    const delta = normalizeCoopCombatDelta({
      deltaRevision: 1,
      events: [
        { eventId: "e1", attackerUid: "u1", defenderUid: "u2", damageType: "wat", outcome: "wat", amount: -4 },
        { eventId: "", attackerUid: "u1", defenderUid: "u2" },
      ],
    });
    expect(delta.events).toEqual([expect.objectContaining({
      eventId: "e1", damageType: "physical", outcome: "hit", amount: 0,
    })]);
  });

  it("never double-applies deltas or rolls back newer accepted delta state", () => {
    const state = createCoopCombatReceiverState();
    expect(acceptCoopCombatSnapshot(state, { revision: 1, lastDeltaRevision: 0 }).accepted).toBe(true);
    expect(acceptCoopCombatDelta(state, { deltaRevision: 1, lastSnapshotRevision: 1 }).accepted).toBe(true);
    expect(acceptCoopCombatDelta(state, { deltaRevision: 1, lastSnapshotRevision: 1 }).accepted).toBe(false);
    expect(acceptCoopCombatSnapshot(state, { revision: 2, lastDeltaRevision: 0 }).accepted).toBe(false);

    const heartbeat = acceptCoopCombatHeartbeat(state, {
      lastDeltaRevision: 3,
      lastSnapshotRevision: 2,
    });
    expect(heartbeat.needsResync).toBe(true);
    const resync = acceptCoopCombatSnapshot(state, { revision: 3, lastDeltaRevision: 3 });
    expect(resync.accepted).toBe(true);
    expect(resync.needsResync).toBe(false);
    expect(state.appliedDeltaRevision).toBe(3);
  });

  it("emits monotonic sender revisions", () => {
    const clock = new CoopCombatRevisionClock();
    expect(clock.nextSnapshot()).toEqual({ revision: 1, lastDeltaRevision: 0 });
    expect(clock.nextDelta()).toEqual({ deltaRevision: 1, lastSnapshotRevision: 1 });
    expect(clock.nextDelta()).toEqual({ deltaRevision: 2, lastSnapshotRevision: 1 });
    expect(clock.nextSnapshot()).toEqual({ revision: 2, lastDeltaRevision: 2 });
    expect(clock.heartbeat()).toEqual({ lastDeltaRevision: 2, lastSnapshotRevision: 2 });
  });
});
