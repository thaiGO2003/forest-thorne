import {
  DEFAULT_COOP_ICE_SERVERS,
  createCoopSignal,
  decodeCoopSignal,
  coopSlotsForCapacity,
  isCoopMessageType,
  normalizeConnectionLabel,
  normalizeCoopSignalTimeout,
  normalizeCoopSlot,
  type CoopMessageType,
  type CoopSignalEnvelope,
  type CoopSlot,
  type RtcSessionDescriptionData,
} from "./coopConfig";
import type { EnemyPreviewResult } from "../core/preview";
import type { RunPayload } from "../core/save";
import {
  CoopSessionStore,
  coopSessionStore,
  type CoopPlayerState,
  type CoopSessionState,
} from "./coopSession";
import { createBrowserCoopPlanningRuntime, type CoopPlanningRuntime } from "./coopPlanningRuntime";

const WIRE_VERSION = 1 as const;
const CHANNEL_PREFIX = "forest-throne-coop";

type RtcChannelState = "connecting" | "open" | "closing" | "closed";

export interface CoopRtcDataChannelLike {
  readonly label: string;
  readonly readyState: RtcChannelState | string;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface CoopRtcPeerLike {
  readonly localDescription: RtcSessionDescriptionData | null;
  readonly iceGatheringState: string;
  readonly connectionState: string;
  onicegatheringstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  ondatachannel: ((event: { channel: CoopRtcDataChannelLike }) => void) | null;
  createDataChannel(label: string): CoopRtcDataChannelLike;
  createOffer(): Promise<RtcSessionDescriptionData>;
  createAnswer(): Promise<RtcSessionDescriptionData>;
  setLocalDescription(description: RtcSessionDescriptionData): Promise<void>;
  setRemoteDescription(description: RtcSessionDescriptionData): Promise<void>;
  close(): void;
}

export type CoopRtcPeerFactory = () => CoopRtcPeerLike;

export type CoopFallbackReason = "host-disconnected" | "peer-disconnected" | "channel-error";

export interface CoopFallbackEvent {
  reason: CoopFallbackReason;
  slot: CoopSlot;
}

export interface CoopPlanningLaunchEvent {
  session: CoopSessionState;
  forceNewRun: boolean;
  restoredState: unknown | null;
}

export interface CoopWireMessage {
  version: typeof WIRE_VERSION;
  type: CoopMessageType;
  senderSlot: CoopSlot;
  sequence: number;
  payload: unknown;
}

export interface CoopWebRtcTransportOptions {
  role: "host" | "client";
  localSlot?: CoopSlot;
  hostSlot?: CoopSlot;
  playerCapacity?: number;
  playerId?: string;
  roomCode?: string;
  seed?: number;
  signalTimeoutMs?: number;
  store?: CoopSessionStore;
  peerFactory?: CoopRtcPeerFactory;
  planningRuntime?: CoopPlanningRuntime | null;
  onMessage?: (message: CoopWireMessage) => void;
  onFallback?: (event: CoopFallbackEvent) => void;
  onPlanningLaunch?: (event: CoopPlanningLaunchEvent) => void;
}

interface PeerBinding {
  peer: CoopRtcPeerLike;
  channel: CoopRtcDataChannelLike | null;
  closed: boolean;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const finiteInt = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const copy = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

export function createCoopRoomCode(random: () => number = Math.random): string {
  let out = "";
  for (let index = 0; index < 6; index++) {
    const digit = Math.min(35, Math.max(0, Math.floor(random() * 36)));
    out += digit.toString(36).toUpperCase();
  }
  return normalizeConnectionLabel(out);
}

export function createBrowserCoopPeerFactory(): CoopRtcPeerFactory {
  return () => {
    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("WebRTC is unavailable in this runtime");
    }
    return new RTCPeerConnection({
      iceServers: [{ urls: [...DEFAULT_COOP_ICE_SERVERS] }],
    }) as unknown as CoopRtcPeerLike;
  };
}

function parseWireMessage(value: unknown): CoopWireMessage | null {
  if (typeof value !== "string") return null;
  try {
    const raw = record(JSON.parse(value));
    if (!raw || raw.version !== WIRE_VERSION || !isCoopMessageType(raw.type)) return null;
    const senderSlot = normalizeCoopSlot(raw.senderSlot, "P1");
    const sequence = finiteInt(raw.sequence);
    if (sequence === null || sequence < 1) return null;
    return {
      version: WIRE_VERSION,
      type: raw.type,
      senderSlot,
      sequence,
      payload: copy(raw.payload),
    };
  } catch {
    return null;
  }
}

function toSignal(signal: string | CoopSignalEnvelope): CoopSignalEnvelope {
  return typeof signal === "string" ? decodeCoopSignal(signal) : signal;
}

function localDescription(peer: CoopRtcPeerLike): RtcSessionDescriptionData {
  const description = peer.localDescription;
  if (!description || !description.type || !description.sdp) {
    throw new Error("RTC local description is unavailable");
  }
  return { type: description.type, sdp: description.sdp };
}

async function waitForIceGathering(peer: CoopRtcPeerLike, timeoutMs: number): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      peer.onicegatheringstatechange = null;
      reject(new Error("Timed out waiting for ICE gathering"));
    }, timeoutMs);
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState !== "complete") return;
      clearTimeout(timeout);
      peer.onicegatheringstatechange = null;
      resolve();
    };
  });
}

export class CoopWebRtcTransport {
  private readonly role: "host" | "client";
  private readonly localSlot: CoopSlot;
  private readonly hostSlot: CoopSlot;
  private readonly playerId: string;
  private readonly store: CoopSessionStore;
  private readonly peerFactory: CoopRtcPeerFactory;
  private readonly signalTimeoutMs: number;
  private readonly planningRuntime: CoopPlanningRuntime | null;
  private readonly onMessage?: (message: CoopWireMessage) => void;
  private readonly onFallback?: (event: CoopFallbackEvent) => void;
  private readonly onPlanningLaunch?: (event: CoopPlanningLaunchEvent) => void;
  private readonly bindings = new Map<CoopSlot, PeerBinding>();
  private sequence = 0;
  private closing = false;
  private fallbackActive = false;

  constructor(options: CoopWebRtcTransportOptions) {
    this.role = options.role;
    this.hostSlot = normalizeCoopSlot(options.hostSlot, "P1");
    this.localSlot = normalizeCoopSlot(
      options.localSlot,
      options.role === "host" ? this.hostSlot : "P2",
    );
    this.playerId = options.playerId ?? "";
    this.store = options.store ?? coopSessionStore;
    this.peerFactory = options.peerFactory ?? createBrowserCoopPeerFactory();
    this.signalTimeoutMs = normalizeCoopSignalTimeout(options.signalTimeoutMs);
    this.onMessage = options.onMessage;
    this.onFallback = options.onFallback;
    this.onPlanningLaunch = options.onPlanningLaunch;
    this.planningRuntime = options.planningRuntime === undefined
      ? createBrowserCoopPlanningRuntime(this.store)
      : options.planningRuntime;

    const roomCode = normalizeConnectionLabel(options.roomCode)
      || (this.role === "host" ? createCoopRoomCode() : "");
    const seed = finiteInt(options.seed);
    const current = this.store.get();
    const base = current
      ? this.store.update({
        roomCode: roomCode || current.roomCode,
        sharedSeed: seed ?? current.sharedSeed,
        playerCapacity: options.playerCapacity ?? current.playerCapacity,
        localSlot: this.localSlot,
        hostSlot: this.hostSlot,
        playerId: this.playerId || current.playerId,
      })
      : this.store.create({
        roomCode,
        sharedSeed: seed,
        playerCapacity: options.playerCapacity ?? 2,
        localSlot: this.localSlot,
        hostSlot: this.hostSlot,
        playerId: this.playerId,
      });
    this.markConnected(base.localSlot, true, this.playerId);
  }

  getSession(): CoopSessionState | null {
    return this.store.get();
  }

  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  async createOffer(targetSlot: CoopSlot): Promise<CoopSignalEnvelope> {
    this.requireRole("host");
    const slot = normalizeCoopSlot(targetSlot, "P2");
    if (slot === this.hostSlot) throw new Error("Host cannot create an offer for itself");
    this.disposeBinding(slot, false);
    const binding = this.createBinding(slot);
    const channel = binding.peer.createDataChannel(`${CHANNEL_PREFIX}:${slot}`);
    this.bindChannel(slot, binding, channel);
    const offer = await binding.peer.createOffer();
    await binding.peer.setLocalDescription(offer);
    await waitForIceGathering(binding.peer, this.signalTimeoutMs);
    return createCoopSignal("coop_offer", localDescription(binding.peer), this.signalMetadata(slot, "host"));
  }

  async acceptOffer(signal: string | CoopSignalEnvelope): Promise<CoopSignalEnvelope> {
    this.requireRole("client");
    const offer = toSignal(signal);
    if (offer.kind !== "coop_offer") throw new Error("Expected a co-op offer");
    const targetSlot = offer.metadata.targetSlot;
    if (targetSlot !== this.localSlot) throw new Error(`Offer targets ${targetSlot}, not ${this.localSlot}`);
    this.store.update({
      roomCode: offer.metadata.roomCode,
      playerCapacity: offer.metadata.requiredCapacity,
      localSlot: targetSlot,
      hostSlot: normalizeCoopSlot(offer.metadata.hostSlotIndex === 0 ? "P1" : this.hostSlot, this.hostSlot),
      selectedMode: offer.metadata.selectedMode,
      aiMode: offer.metadata.aiMode,
      activeSaveSlotId: offer.metadata.saveSlotId,
      saveMode: offer.metadata.saveMode,
      resumeSummary: offer.metadata.resumeSummary ?? null,
    });
    this.disposeBinding(this.hostSlot, false);
    const binding = this.createBinding(this.hostSlot);
    binding.peer.ondatachannel = (event) => this.bindChannel(this.hostSlot, binding, event.channel);
    await binding.peer.setRemoteDescription(offer.description);
    const answer = await binding.peer.createAnswer();
    await binding.peer.setLocalDescription(answer);
    await waitForIceGathering(binding.peer, this.signalTimeoutMs);
    return createCoopSignal("coop_answer", localDescription(binding.peer), this.signalMetadata(targetSlot, "client"));
  }

  async acceptAnswer(signal: string | CoopSignalEnvelope): Promise<void> {
    this.requireRole("host");
    const answer = toSignal(signal);
    if (answer.kind !== "coop_answer") throw new Error("Expected a co-op answer");
    const binding = this.bindings.get(answer.metadata.targetSlot);
    if (!binding) throw new Error(`No pending peer for ${answer.metadata.targetSlot}`);
    await binding.peer.setRemoteDescription(answer.description);
  }

  sendReady(ready: boolean): void {
    const session = this.store.get();
    if (!session) return;
    this.store.update({
      readyBySlot: { [this.localSlot]: ready },
      players: { [this.localSlot]: { ready, connected: true, playerId: this.playerId } },
    });
    this.send("player_ready", { ready });
  }

  sendCombatResult(result: unknown): void {
    this.send("combat_result", result);
  }

  resolvePlanningEnemyPreview(): EnemyPreviewResult | null {
    if (!this.planningRuntime) return null;
    const result = this.role === "host"
      ? this.planningRuntime.resolveHostEnemyPreview()
      : this.planningRuntime.resolveGuestEnemyPreview();
    if (result && this.role === "host") this.broadcastRoomState();
    return result;
  }

  send(type: CoopMessageType, payload: unknown): void {
    const message = this.createMessage(type, payload);
    if (!this.applyMessage(message)) return;
    if (this.role === "host") {
      this.broadcast(message);
    } else {
      this.sendTo(this.hostSlot, message);
    }
  }

  close(): void {
    this.closing = true;
    for (const slot of [...this.bindings.keys()]) this.disposeBinding(slot, true);
    this.bindings.clear();
    this.store.set(null);
  }

  private createBinding(slot: CoopSlot): PeerBinding {
    const peer = this.peerFactory();
    const binding: PeerBinding = { peer, channel: null, closed: false };
    this.bindings.set(slot, binding);
    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) {
        this.handleDisconnect(slot, binding, "peer-disconnected");
      }
    };
    return binding;
  }

  private bindChannel(slot: CoopSlot, binding: PeerBinding, channel: CoopRtcDataChannelLike): void {
    binding.channel = channel;
    channel.onopen = () => this.handleOpen(slot);
    channel.onmessage = (event) => this.handleIncoming(slot, event.data);
    channel.onclose = () => this.handleDisconnect(slot, binding, "peer-disconnected");
    channel.onerror = () => this.handleDisconnect(slot, binding, "channel-error");
    if (channel.readyState === "open") this.handleOpen(slot);
  }

  private handleOpen(slot: CoopSlot): void {
    this.markConnected(slot, true);
    if (this.role === "host") this.broadcastRoomState();
  }

  private handleIncoming(sourceSlot: CoopSlot, raw: unknown): void {
    const message = parseWireMessage(raw);
    if (!message) return;
    if (this.role === "host" && message.senderSlot !== sourceSlot) return;
    if (!this.applyMessage(message)) return;
    this.onMessage?.(copy(message));
    if (this.role === "host") this.broadcast(message, sourceSlot);
  }

  private handleDisconnect(
    slot: CoopSlot,
    binding: PeerBinding,
    reason: "peer-disconnected" | "channel-error",
  ): void {
    if (this.closing || binding.closed) return;
    binding.closed = true;
    this.markConnected(slot, false);
    if (this.role === "host") {
      const message = this.createMessage("player_disconnected", { slot });
      this.applyMessage(message);
      this.broadcast(message, slot);
      this.activateFallback(reason, slot);
      return;
    }
    this.activateFallback("host-disconnected", this.hostSlot);
  }

  private activateFallback(reason: CoopFallbackReason, slot: CoopSlot): void {
    if (this.fallbackActive) return;
    this.fallbackActive = true;
    this.onFallback?.({ reason, slot });
  }

  private maybeLaunchPlanning(): void {
    if (this.role !== "host") return;
    const session = this.store.get();
    if (!session || session.planningLaunchRequested) return;
    const activeSlots = coopSlotsForCapacity(session.playerCapacity);
    if (!activeSlots.every((slot) => session.players[slot]?.connected === true && session.readyBySlot[slot] === true)) {
      return;
    }
    if (session.saveMode === "resume" && session.resumeState === null) return;

    const roomPlayers = Object.fromEntries(
      activeSlots.map((slot) => [slot, copy(session.players[slot])]),
    );
    const message = this.createMessage("planning_ready_ping", {
      readyBySlot: session.readyBySlot,
      roomPlayers,
      activeSaveSlotId: session.activeSaveSlotId,
      saveMode: session.saveMode,
      resumeSummary: session.resumeSummary,
      resumeState: session.resumeState,
    });
    if (!this.applyMessage(message)) return;
    this.onMessage?.(copy(message));
    this.broadcast(message);
  }

  private broadcastRoomState(): void {
    const session = this.store.get();
    if (!session) return;
    const message = this.createMessage("room_state", {
      roomCode: session.roomCode,
      seed: session.sharedSeed,
      playerCapacity: session.playerCapacity,
      hostSlot: session.hostSlot,
      selectedMode: session.selectedMode,
      aiMode: session.aiMode,
      readyBySlot: session.readyBySlot,
      players: session.players,
      activeSaveSlotId: session.activeSaveSlotId,
      saveMode: session.saveMode,
      resumeSummary: session.resumeSummary,
      planningLaunchRequested: session.planningLaunchRequested,
      resumeState: session.resumeState,
    });
    this.broadcast(message);
  }

  private createMessage(type: CoopMessageType, payload: unknown): CoopWireMessage {
    return {
      version: WIRE_VERSION,
      type,
      senderSlot: this.localSlot,
      sequence: ++this.sequence,
      payload: copy(payload),
    };
  }

  private broadcast(message: CoopWireMessage, excludeSlot?: CoopSlot): void {
    for (const [slot] of this.bindings) {
      if (slot !== excludeSlot) this.sendTo(slot, message);
    }
  }

  private sendTo(slot: CoopSlot, message: CoopWireMessage): void {
    const channel = this.bindings.get(slot)?.channel;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(message));
  }

  private applyMessage(message: CoopWireMessage): boolean {
    const payload = record(message.payload);
    switch (message.type) {
      case "room_state": {
        if (message.senderSlot !== this.hostSlot || !payload) return false;
        const seed = finiteInt(payload.seed);
        this.store.update({
          roomCode: typeof payload.roomCode === "string" ? normalizeConnectionLabel(payload.roomCode) : undefined,
          sharedSeed: seed,
          playerCapacity: payload.playerCapacity === undefined ? undefined : Number(payload.playerCapacity),
          hostSlot: typeof payload.hostSlot === "string" ? normalizeCoopSlot(payload.hostSlot, this.hostSlot) : undefined,
          selectedMode: typeof payload.selectedMode === "string" ? payload.selectedMode : undefined,
          aiMode: typeof payload.aiMode === "string" ? payload.aiMode : undefined,
          readyBySlot: record(payload.readyBySlot) as Record<string, boolean> | undefined,
          players: record(payload.players) as Record<string, Partial<CoopPlayerState>> | undefined,
          activeSaveSlotId: typeof payload.activeSaveSlotId === "string" ? payload.activeSaveSlotId : undefined,
          saveMode: typeof payload.saveMode === "string" ? payload.saveMode : undefined,
          resumeSummary: payload.resumeSummary,
          planningLaunchRequested: payload.planningLaunchRequested === true,
        });
        if (payload.resumeState === null) {
          this.store.update({ resumeState: null });
        } else if (payload.resumeState !== undefined) {
          if (this.planningRuntime) {
            if (!this.planningRuntime.attachPayload(payload.resumeState as RunPayload)) return false;
          } else {
            this.store.update({ resumeState: copy(payload.resumeState) });
          }
        }
        return true;
      }
      case "player_ready": {
        const ready = payload?.ready === true;
        this.store.update({
          readyBySlot: { [message.senderSlot]: ready },
          players: { [message.senderSlot]: { ready, connected: true } },
        });
        this.maybeLaunchPlanning();
        return true;
      }
      case "planning_ready_ping": {
        if (message.senderSlot !== this.hostSlot || !payload) return false;
        const current = this.store.get();
        if (!current || current.planningLaunchRequested) return false;
        this.store.update({
          readyBySlot: record(payload.readyBySlot) as Record<string, boolean> | undefined,
          roomPlayers: record(payload.roomPlayers) ?? undefined,
          activeSaveSlotId: typeof payload.activeSaveSlotId === "string" ? payload.activeSaveSlotId : undefined,
          saveMode: typeof payload.saveMode === "string" ? payload.saveMode : undefined,
          resumeSummary: payload.resumeSummary,
          resumeState: payload.resumeState,
          planningLaunchRequested: true,
        });
        const launched = this.store.get();
        if (!launched) return false;
        this.onPlanningLaunch?.({
          session: copy(launched),
          forceNewRun: launched.saveMode !== "resume",
          restoredState: launched.saveMode === "resume" ? copy(launched.resumeState) : null,
        });
        return true;
      }
      case "planning_intent": {
        if (!this.planningRuntime) return false;
        const result = message.senderSlot === this.localSlot
          ? this.planningRuntime.applyLocalIntent(message.payload)
          : this.role === "host"
            ? this.planningRuntime.applyRemoteIntent(message.senderSlot, message.payload)
            : this.planningRuntime.applyReplicatedIntent(message.senderSlot, message.payload);
        return result.applied;
      }
      case "player_disconnected": {
        const slot = normalizeCoopSlot(payload?.slot, message.senderSlot);
        this.markConnected(slot, false);
        return true;
      }
      case "authoritative_snapshot":
        this.store.update({ coopCombatSnapshot: message.payload });
        return true;
      case "combat_delta":
        this.store.update({ coopCombatDelta: message.payload });
        return true;
      case "combat_heartbeat":
        this.store.update({ coopCombatHeartbeat: message.payload });
        return true;
      case "combat_start":
      case "combat_result":
      case "combat_retreat":
        this.store.update({ currentCombatPayload: message.payload });
        return true;
      default:
        return true;
    }
  }

  private markConnected(slot: CoopSlot, connected: boolean, playerId = ""): void {
    const session = this.store.get();
    if (!session || !session.players[slot]) return;
    this.store.update({
      readyBySlot: connected ? undefined : { [slot]: false },
      players: {
        [slot]: {
          connected,
          ready: connected ? session.readyBySlot[slot] === true : false,
          playerId: connected ? (playerId || session.players[slot]?.playerId || "") : "",
        },
      },
    });
  }

  private signalMetadata(targetSlot: CoopSlot, role: "host" | "client"): Record<string, unknown> {
    const session = this.store.get();
    return {
      sessionId: session?.roomCode ?? "",
      requiredCapacity: session?.playerCapacity ?? 2,
      targetSlot,
      selectedMode: session?.selectedMode,
      aiMode: session?.aiMode,
      saveSlotId: session?.activeSaveSlotId,
      saveMode: session?.saveMode,
      resumeSummary: session?.resumeSummary ?? undefined,
      hostSlotIndex: 0,
      roomCode: session?.roomCode,
      playerId: this.playerId,
      role,
      connectionLabel: session?.roomCode,
    };
  }

  private disposeBinding(slot: CoopSlot, close: boolean): void {
    const binding = this.bindings.get(slot);
    if (!binding) return;
    binding.closed = true;
    if (close) binding.channel?.close();
    binding.peer.close();
    this.bindings.delete(slot);
  }

  private requireRole(expected: "host" | "client"): void {
    if (this.role !== expected) throw new Error(`Operation requires ${expected} role`);
  }
}
