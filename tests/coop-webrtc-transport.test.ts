import { describe, expect, it } from "vitest";
import { createRun, type RunState } from "../src/core/run";
import { PROGRESS_KEY, type RunPayload } from "../src/core/save";
import { CoopPlanningRuntime } from "../src/network/coopPlanningRuntime";
import { CoopSessionStore } from "../src/network/coopSession";
import {
  CoopWebRtcTransport,
  createCoopRoomCode,
  type CoopFallbackEvent,
  type CoopRtcDataChannelLike,
  type CoopRtcPeerLike,
  type CoopPlanningLaunchEvent,
} from "../src/network/coopWebRtcTransport";
import type { RtcSessionDescriptionData } from "../src/network/coopConfig";

function mem() {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (key: string) => (key in m ? m[key]! : null),
    setItem: (key: string, value: string) => { m[key] = value; },
    removeItem: (key: string) => { delete m[key]; },
  };
}

const owned = (uid: string, baseId = "ant_guard") => ({
  uid,
  baseId,
  star: 1 as const,
  equips: [],
});

function planningRun(seed: number): RunState {
  const run = createRun(seed);
  run.tutorialSkipped = true;
  run.bench = [];
  run.board = Array(25).fill(null);
  return run;
}

function planningPayload(): RunPayload {
  return {
    players: { P1: planningRun(1), P2: planningRun(2) },
    localSlot: "P1",
    hostSlot: "P1",
    playerCapacity: 2,
    aiMode: "COOP_MEDIUM",
    selectedMode: "EndlessPvEClassic",
    roomCode: "ROOM42",
  };
}

class FakeDataChannel implements CoopRtcDataChannelLike {
  readonly label: string;
  readyState = "connecting";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private remote: FakeDataChannel | null = null;

  constructor(label: string) {
    this.label = label;
  }

  pair(remote: FakeDataChannel): void {
    this.remote = remote;
    remote.remote = this;
  }

  open(): void {
    this.readyState = "open";
    this.onopen?.();
  }

  send(data: string): void {
    if (this.readyState !== "open" || this.remote?.readyState !== "open") return;
    this.remote.onmessage?.({ data });
  }

  close(): void {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose?.();
    if (this.remote && this.remote.readyState !== "closed") {
      this.remote.readyState = "closed";
      this.remote.onclose?.();
    }
  }
}

class FakeRtcNetwork {
  readonly peers = new Map<string, FakeRtcPeer>();
  readonly created: FakeRtcPeer[] = [];

  createPeer = (): CoopRtcPeerLike => {
    const peer = new FakeRtcPeer(this, `peer-${this.created.length + 1}`);
    this.created.push(peer);
    this.peers.set(peer.id, peer);
    return peer;
  };
}

class FakeRtcPeer implements CoopRtcPeerLike {
  readonly id: string;
  localDescription: RtcSessionDescriptionData | null = null;
  iceGatheringState = "complete";
  connectionState = "new";
  onicegatheringstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: CoopRtcDataChannelLike }) => void) | null = null;
  private readonly network: FakeRtcNetwork;
  private outboundChannel: FakeDataChannel | null = null;
  private offerPeer: FakeRtcPeer | null = null;

  constructor(network: FakeRtcNetwork, id: string) {
    this.network = network;
    this.id = id;
  }

  createDataChannel(label: string): CoopRtcDataChannelLike {
    this.outboundChannel = new FakeDataChannel(label);
    return this.outboundChannel;
  }

  async createOffer(): Promise<RtcSessionDescriptionData> {
    return { type: "offer", sdp: `fake-offer:${this.id}` };
  }

  async createAnswer(): Promise<RtcSessionDescriptionData> {
    if (!this.offerPeer) throw new Error("Missing fake offer peer");
    return { type: "answer", sdp: `fake-answer:${this.id}:${this.offerPeer.id}` };
  }

  async setLocalDescription(description: RtcSessionDescriptionData): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RtcSessionDescriptionData): Promise<void> {
    if (description.type === "offer") {
      const hostId = description.sdp.replace("fake-offer:", "");
      const host = this.network.peers.get(hostId);
      if (!host?.outboundChannel) throw new Error("Missing fake host channel");
      this.offerPeer = host;
      const remoteChannel = new FakeDataChannel(host.outboundChannel.label);
      host.outboundChannel.pair(remoteChannel);
      this.ondatachannel?.({ channel: remoteChannel });
      this.connectionState = "connected";
      host.connectionState = "connected";
      remoteChannel.open();
      host.outboundChannel.open();
      this.onconnectionstatechange?.();
      host.onconnectionstatechange?.();
    }
  }

  fail(): void {
    this.connectionState = "disconnected";
    this.onconnectionstatechange?.();
  }

  close(): void {
    this.connectionState = "closed";
  }
}

async function connect(
  host: CoopWebRtcTransport,
  client: CoopWebRtcTransport,
  slot: "P2" | "P3" | "P4",
): Promise<void> {
  const offer = await host.createOffer(slot);
  const answer = await client.acceptOffer(offer);
  await host.acceptAnswer(answer);
}

describe("co-op WebRTC host relay", () => {
  it("creates normalized six-character room codes without browser dependencies", () => {
    const values = [0, 1 / 36, 10 / 36, 20 / 36, 30 / 36, 35 / 36];
    let index = 0;
    expect(createCoopRoomCode(() => values[index++] ?? 0)).toBe("01AKUZ");
  });

  it("shares room seed, relays ready state and combat results across four-player slots", async () => {
    const network = new FakeRtcNetwork();
    const hostStore = new CoopSessionStore();
    const p2Store = new CoopSessionStore();
    const p3Store = new CoopSessionStore();
    const p4Store = new CoopSessionStore();
    const host = new CoopWebRtcTransport({
      role: "host",
      localSlot: "P1",
      playerCapacity: 4,
      roomCode: "ABC123",
      seed: 424242,
      playerId: "host",
      store: hostStore,
      peerFactory: network.createPeer,
    });
    const p2 = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P2",
      playerCapacity: 4,
      playerId: "p2",
      store: p2Store,
      peerFactory: network.createPeer,
    });
    const p3 = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P3",
      playerCapacity: 4,
      playerId: "p3",
      store: p3Store,
      peerFactory: network.createPeer,
    });
    const p4 = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P4",
      playerCapacity: 4,
      playerId: "p4",
      store: p4Store,
      peerFactory: network.createPeer,
    });

    await connect(host, p2, "P2");
    await connect(host, p3, "P3");
    await connect(host, p4, "P4");

    expect(p2Store.get()).toMatchObject({ roomCode: "ABC123", sharedSeed: 424242 });
    expect(p3Store.get()).toMatchObject({ roomCode: "ABC123", sharedSeed: 424242 });
    expect(p4Store.get()).toMatchObject({ roomCode: "ABC123", sharedSeed: 424242 });
    expect(hostStore.get()?.players.P2.connected).toBe(true);
    expect(hostStore.get()?.players.P3.connected).toBe(true);
    expect(hostStore.get()?.players.P4.connected).toBe(true);

    p2.sendReady(true);
    expect(hostStore.get()?.readyBySlot.P2).toBe(true);
    expect(p3Store.get()?.readyBySlot.P2).toBe(true);
    expect(p4Store.get()?.readyBySlot.P2).toBe(true);

    p2.sendCombatResult({ round: 9, winner: "P2" });
    expect(hostStore.get()?.currentCombatPayload).toEqual({ round: 9, winner: "P2" });
    expect(p3Store.get()?.currentCombatPayload).toEqual({ round: 9, winner: "P2" });
    expect(p4Store.get()?.currentCombatPayload).toEqual({ round: 9, winner: "P2" });
  });

  it("launches Planning exactly once only after capacity is connected and every player is ready", async () => {
    const network = new FakeRtcNetwork();
    const hostStore = new CoopSessionStore();
    const clientStore = new CoopSessionStore();
    const hostLaunches: CoopPlanningLaunchEvent[] = [];
    const clientLaunches: CoopPlanningLaunchEvent[] = [];
    const host = new CoopWebRtcTransport({
      role: "host",
      localSlot: "P1",
      playerCapacity: 2,
      roomCode: "READY2",
      seed: 99,
      playerId: "host",
      store: hostStore,
      peerFactory: network.createPeer,
      onPlanningLaunch: (event) => hostLaunches.push(event),
    });
    const client = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P2",
      playerCapacity: 2,
      playerId: "guest",
      store: clientStore,
      peerFactory: network.createPeer,
      onPlanningLaunch: (event) => clientLaunches.push(event),
    });

    await connect(host, client, "P2");
    host.sendReady(true);
    expect(hostLaunches).toHaveLength(0);
    expect(clientLaunches).toHaveLength(0);

    client.sendReady(true);
    expect(hostLaunches).toHaveLength(1);
    expect(clientLaunches).toHaveLength(1);
    expect(hostLaunches[0]).toMatchObject({
      forceNewRun: true,
      session: { localSlot: "P1", hostSlot: "P1", planningLaunchRequested: true },
    });
    expect(clientLaunches[0]).toMatchObject({
      forceNewRun: true,
      session: { localSlot: "P2", hostSlot: "P1", planningLaunchRequested: true },
    });
    expect(Object.keys(hostLaunches[0]!.session.roomPlayers).sort()).toEqual(["P1", "P2"]);

    client.sendReady(true);
    host.sendReady(true);
    expect(hostLaunches).toHaveLength(1);
    expect(clientLaunches).toHaveLength(1);

    host.close();
    client.close();
    expect(hostStore.get()).toBeNull();
    expect(clientStore.get()).toBeNull();
  });

  it("propagates host resume metadata and applies planning intents once through host authority", async () => {
    const network = new FakeRtcNetwork();
    const hostStore = new CoopSessionStore();
    const clientStore = new CoopSessionStore();
    const hostLaunches: CoopPlanningLaunchEvent[] = [];
    const clientLaunches: CoopPlanningLaunchEvent[] = [];
    hostStore.create({
      roomCode: "ROOM42",
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      activeSaveSlotId: "SAVE_3",
      saveMode: "resume",
      resumeSummary: { slotId: "SAVE_3", round: 7 },
      players: { P1: { connected: true }, P2: { connected: false } },
    });
    const hostKv = mem();
    const clientKv = mem();
    const hostRuntime = new CoopPlanningRuntime(hostKv, hostStore);
    const clientRuntime = new CoopPlanningRuntime(clientKv, clientStore);
    const host = new CoopWebRtcTransport({
      role: "host",
      localSlot: "P1",
      roomCode: "ROOM42",
      playerCapacity: 2,
      playerId: "host",
      store: hostStore,
      planningRuntime: hostRuntime,
      peerFactory: network.createPeer,
      onPlanningLaunch: (event) => hostLaunches.push(event),
    });
    const client = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P2",
      playerCapacity: 2,
      playerId: "guest",
      store: clientStore,
      planningRuntime: clientRuntime,
      peerFactory: network.createPeer,
      onPlanningLaunch: (event) => clientLaunches.push(event),
    });

    await connect(host, client, "P2");
    expect(clientStore.get()).toMatchObject({
      roomCode: "ROOM42",
      activeSaveSlotId: "SAVE_3",
      saveMode: "resume",
      resumeSummary: { slotId: "SAVE_3", round: 7 },
    });

    const payload = planningPayload();
    payload.players!.P1!.bench = [owned("host-unit")];
    payload.players!.P2!.bench = [owned("guest-unit", "deer_song")];
    expect(hostRuntime.attachPayload(payload)).not.toBeNull();
    expect(clientRuntime.attachPayload(payload)).not.toBeNull();

    host.sendReady(true);
    client.sendReady(true);
    expect(hostLaunches).toHaveLength(1);
    expect(clientLaunches).toHaveLength(1);
    expect(hostLaunches[0]?.forceNewRun).toBe(false);
    expect(clientLaunches[0]?.forceNewRun).toBe(false);
    expect((hostLaunches[0]?.restoredState as RunPayload).players?.P1?.bench[0]?.uid).toBe("host-unit");
    expect((clientLaunches[0]?.restoredState as RunPayload).players?.P2?.bench[0]?.uid).toBe("guest-unit");

    client.send("planning_intent", {
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 5, col: 0 },
    });
    expect((clientStore.get()!.resumeState as RunPayload).players!.P2!.board[0]?.uid).toBe("guest-unit");
    expect((hostStore.get()!.resumeState as RunPayload).players!.P2!.board[0]?.uid).toBe("guest-unit");

    host.send("planning_intent", {
      kind: "move",
      from: { where: "bench", index: 0 },
      to: { where: "board", sharedRow: 0, col: 1 },
    });
    expect((hostStore.get()!.resumeState as RunPayload).players!.P1!.board[1]?.uid).toBe("host-unit");
    expect((clientStore.get()!.resumeState as RunPayload).players!.P1!.board[1]?.uid).toBe("host-unit");

    const beforeHost = structuredClone(hostStore.get()!.resumeState);
    client.send("planning_intent", {
      kind: "move",
      from: { where: "board", sharedRow: 5, col: 0 },
      to: { where: "board", sharedRow: 0, col: 2 },
    });
    expect(hostStore.get()!.resumeState).toEqual(beforeHost);
    expect((clientStore.get()!.resumeState as RunPayload).players!.P2!.board[0]?.uid).toBe("guest-unit");
  });

  it("relays one host-owned shared preview and makes the guest consume it without a local reroll", async () => {
    const network = new FakeRtcNetwork();
    const hostStore = new CoopSessionStore();
    const clientStore = new CoopSessionStore();
    hostStore.create({
      roomCode: "PREV42",
      playerCapacity: 2,
      localSlot: "P1",
      hostSlot: "P1",
      activeSaveSlotId: "SAVE_1",
      saveMode: "resume",
      players: { P1: { connected: true }, P2: { connected: false } },
    });
    const hostKv = mem();
    const clientKv = mem();
    const hostRuntime = new CoopPlanningRuntime(hostKv, hostStore);
    const clientRuntime = new CoopPlanningRuntime(clientKv, clientStore);
    const host = new CoopWebRtcTransport({
      role: "host",
      localSlot: "P1",
      roomCode: "PREV42",
      playerCapacity: 2,
      playerId: "host",
      store: hostStore,
      planningRuntime: hostRuntime,
      peerFactory: network.createPeer,
    });
    const client = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P2",
      playerCapacity: 2,
      playerId: "guest",
      store: clientStore,
      planningRuntime: clientRuntime,
      peerFactory: network.createPeer,
    });
    await connect(host, client, "P2");

    const payload = planningPayload();
    payload.players!.P2!.enemyPreview = [{ uid: "guest-stale", baseId: "deer_song", star: 1, row: 1, col: 6 }];
    payload.players!.P2!.enemyPreviewRound = 1;
    payload.players!.P2!.enemyBudget = 999;
    expect(hostRuntime.attachPayload(payload)).not.toBeNull();

    const first = host.resolvePlanningEnemyPreview()!;
    expect(first.source).toBe("generated");
    expect(first.units.length).toBeGreaterThan(0);
    const shared = (hostStore.get()!.resumeState as RunPayload).shared!;
    expect(shared).toMatchObject({ round: 1, enemyPreviewRound: 1, enemyBudget: first.budget });
    expect(shared.enemyPreview).toEqual(first.units);

    const guestState = clientStore.get()!.resumeState as RunPayload;
    expect(guestState.shared).toEqual(shared);
    expect(guestState.players!.P2!.enemyPreview[0]?.uid).not.toBe("guest-stale");
    const guest = client.resolvePlanningEnemyPreview()!;
    expect(guest).toMatchObject({ source: "shared", round: 1, budget: first.budget });
    expect(guest.units).toEqual(first.units);

    const second = host.resolvePlanningEnemyPreview()!;
    expect(second.source).toBe("saved");
    expect(second.units).toEqual(first.units);
    expect(hostKv.m[PROGRESS_KEY]).toBeUndefined();
    expect(clientKv.m[PROGRESS_KEY]).toBeUndefined();
  });

  it("activates deterministic fallback when a client loses the host connection", async () => {
    const network = new FakeRtcNetwork();
    const fallback: CoopFallbackEvent[] = [];
    const host = new CoopWebRtcTransport({
      role: "host",
      roomCode: "ROOM42",
      seed: 7,
      store: new CoopSessionStore(),
      peerFactory: network.createPeer,
    });
    const clientStore = new CoopSessionStore();
    const client = new CoopWebRtcTransport({
      role: "client",
      localSlot: "P2",
      store: clientStore,
      peerFactory: network.createPeer,
      onFallback: (event) => fallback.push(event),
    });
    await connect(host, client, "P2");

    network.created[1]?.fail();

    expect(client.isFallbackActive()).toBe(true);
    expect(fallback).toEqual([{ reason: "host-disconnected", slot: "P1" }]);
    expect(clientStore.get()?.players.P1.connected).toBe(false);
    expect(clientStore.get()?.readyBySlot.P1).toBe(false);
  });
});
