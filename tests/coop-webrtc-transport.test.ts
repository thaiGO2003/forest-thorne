import { describe, expect, it } from "vitest";
import { CoopSessionStore } from "../src/network/coopSession";
import {
  CoopWebRtcTransport,
  createCoopRoomCode,
  type CoopFallbackEvent,
  type CoopRtcDataChannelLike,
  type CoopRtcPeerLike,
} from "../src/network/coopWebRtcTransport";
import type { RtcSessionDescriptionData } from "../src/network/coopConfig";

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

    await connect(host, p2, "P2");
    await connect(host, p3, "P3");

    expect(p2Store.get()).toMatchObject({ roomCode: "ABC123", sharedSeed: 424242 });
    expect(p3Store.get()).toMatchObject({ roomCode: "ABC123", sharedSeed: 424242 });
    expect(hostStore.get()?.players.P2.connected).toBe(true);
    expect(hostStore.get()?.players.P3.connected).toBe(true);

    p2.sendReady(true);
    expect(hostStore.get()?.readyBySlot.P2).toBe(true);
    expect(p3Store.get()?.readyBySlot.P2).toBe(true);

    p2.sendCombatResult({ round: 9, winner: "P2" });
    expect(hostStore.get()?.currentCombatPayload).toEqual({ round: 9, winner: "P2" });
    expect(p3Store.get()?.currentCombatPayload).toEqual({ round: 9, winner: "P2" });
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
