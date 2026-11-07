import {
  buildCoopSignalMetadata,
  COOP_MESSAGE_TYPES,
  COOP_SIGNAL_KINDS,
  formatCoopConnectionLabel,
  slotIndexToKey,
  slotKeyToIndex,
  type CoopMetadataInput,
  type CoopSignalMetadata,
  type CoopMessageType
} from "./coopConfig.js";
import {
  CoopPeerClient,
  createCoopPeerId,
  parseCoopSignalEnvelope,
  type CoopPeerHandler
} from "./coopPeerClient.js";

type CoopRole = "host" | "guest";

interface CoopCreateRoomResult {
  role: CoopRole;
  sessionId: string;
  roomCode: string;
  playerId: string;
  localSlot: string;
}

interface CoopCreateOfferResult {
  offerText: string;
}

interface CoopApplyAnswerResult {
  slot: string;
  awaitingOpen: true;
}

interface CoopAcceptOfferResult {
  answerText: string;
  sessionId: string;
  roomCode: string;
  localSlot: string | null;
  metadata: unknown;
  playerId: string;
}

interface HostPeerEntry {
  slot: string;
  peer: CoopPeerClient;
  offerText: string;
  intentionalClose: boolean;
  unsubscribers: Array<() => void>;
}

type PeerUnsubscribe = () => void;
type PeerFactory = () => CoopPeerClient;

const COOP_MESSAGE_TYPE_VALUES: Record<CoopMessageType, true> = Object.freeze(
  Object.fromEntries(Object.values(COOP_MESSAGE_TYPES).map((value) => [value, true])) as Record<CoopMessageType, true>
);


function clone(value: unknown): unknown {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value ?? null;
}

function augmentPayload(payload: unknown, extras: Record<string, unknown> = {}): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      ...extras
    };
  }
  return {
    value: payload ?? null,
    ...extras
  };
}

function createPeerFactory(factory: unknown): PeerFactory {
  return typeof factory === "function"
    ? (factory as PeerFactory)
    : () => new CoopPeerClient();
}

function buildOfferMetadata(transport: CoopP2PTransport, slotKey: unknown, metadata: CoopMetadataInput = {}): CoopMetadataInput {
  const targetSlot = slotIndexToKey(slotKeyToIndex(slotKey, 1));
  return {
    ...(clone(transport.sessionMetadata) as CoopMetadataInput),
    ...(clone(metadata) as CoopMetadataInput),
    sessionId: transport.sessionId,
    roomCode: transport.roomCode,
    playerId: transport.localPeerId,
    role: "host",
    requiredCapacity: transport.requiredCapacity,
    targetSlot,
    hostSlotIndex: transport.hostSlotIndex
  };
}

export class CoopP2PTransport {
  peerClientFactory: PeerFactory;
  listeners: Map<string, Set<CoopPeerHandler>>;
  role: CoopRole | null;
  sessionId: string;
  roomCode: string;
  requiredCapacity: number;
  hostSlotIndex: number;
  localPeerId: string | null;
  localSlot: string | null;
  sessionMetadata: CoopSignalMetadata;
  isOpen: boolean;
  pendingHostPeers: Map<string, HostPeerEntry>;
  connectedHostPeers: Map<string, HostPeerEntry>;
  guestPeer: CoopPeerClient | null;
  guestPeerUnsubscribers: Array<PeerUnsubscribe | null | undefined>;
  pendingAnswerText: string;
  _closingTransport: boolean;

  constructor({ peerClientFactory = null }: { peerClientFactory?: PeerFactory | null } = {}) {
    this.peerClientFactory = createPeerFactory(peerClientFactory);
    this.listeners = new Map();
    this.role = null;
    this.sessionId = "";
    this.roomCode = "";
    this.requiredCapacity = 2;
    this.hostSlotIndex = 0;
    this.localPeerId = null;
    this.localSlot = null;
    this.sessionMetadata = buildCoopSignalMetadata({});
    this.isOpen = false;
    this.pendingHostPeers = new Map();
    this.connectedHostPeers = new Map();
    this.guestPeer = null;
    this.guestPeerUnsubscribers = [];
    this.pendingAnswerText = "";
    this._closingTransport = false;
  }

  on(eventName: string, handler: CoopPeerHandler): () => void {
    if (typeof handler !== "function") return () => {};
    const handlers = this.listeners.get(eventName) ?? new Set<CoopPeerHandler>();
    handlers.add(handler);
    this.listeners.set(eventName, handlers);
    return () => this.off(eventName, handler);
  }

  off(eventName: string, handler: CoopPeerHandler): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName: string, payload: unknown): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[CoopP2PTransport] Listener failed for ${eventName}:`, error);
      }
    });
  }

  isHostRole(): boolean {
    return this.role === "host";
  }

  isGuestRole(): boolean {
    return this.role === "guest";
  }

  getConnectedSlots(): string[] {
    return Array.from(this.connectedHostPeers.keys());
  }

  hasConnectedSlot(slotKey: unknown): boolean {
    return this.connectedHostPeers.has(slotIndexToKey(slotKeyToIndex(slotKey, 1)));
  }

  getPendingOffer(slotKey: unknown): string {
    const normalizedSlot = slotIndexToKey(slotKeyToIndex(slotKey, 1));
    return this.pendingHostPeers.get(normalizedSlot)?.offerText ?? "";
  }

  getPendingAnswer(): string {
    return this.pendingAnswerText || "";
  }

  async createRoom(metadata: CoopMetadataInput = {}): Promise<CoopCreateRoomResult> {
    this.resetRoleState({ silent: true });
    this.role = "host";
    this.sessionId = typeof metadata.sessionId === "string" && metadata.sessionId.trim()
      ? metadata.sessionId.trim()
      : createCoopPeerId();
    this.roomCode = formatCoopConnectionLabel(metadata.roomCode ?? this.sessionId);
    this.requiredCapacity = buildCoopSignalMetadata(metadata).requiredCapacity;
    this.hostSlotIndex = 0;
    this.localPeerId = typeof metadata.playerId === "string" && metadata.playerId
      ? metadata.playerId
      : createCoopPeerId();
    this.localSlot = slotIndexToKey(this.hostSlotIndex);
    this.sessionMetadata = buildCoopSignalMetadata({
      ...(clone(metadata) as CoopMetadataInput),
      sessionId: this.sessionId,
      roomCode: this.roomCode,
      requiredCapacity: this.requiredCapacity,
      playerId: this.localPeerId,
      role: "host",
      hostSlotIndex: this.hostSlotIndex
    });
    this.isOpen = true;
    return {
      role: this.role,
      sessionId: this.sessionId,
      roomCode: this.roomCode,
      playerId: this.localPeerId,
      localSlot: this.localSlot
    };
  }

  async createOfferForSlot(slotKey: unknown, metadata: CoopMetadataInput = {}): Promise<string> {
    if (!this.isHostRole()) {
      throw new Error("Only the host can create coop offers.");
    }
    const normalizedSlot = slotIndexToKey(slotKeyToIndex(slotKey, 1));
    if (normalizedSlot === this.localSlot) {
      throw new Error("The host cannot create an invite for its own slot.");
    }
    if (this.connectedHostPeers.has(normalizedSlot)) {
      throw new Error(`Slot ${normalizedSlot} is already connected.`);
    }

    this.disposeHostPeerEntry(this.pendingHostPeers.get(normalizedSlot), { close: true });

    const peer = this.peerClientFactory();
    const entry: HostPeerEntry = {
      slot: normalizedSlot,
      peer,
      offerText: "",
      intentionalClose: false,
      unsubscribers: []
    };
    entry.unsubscribers = this.attachHostPeerEntry(entry);
    this.pendingHostPeers.set(normalizedSlot, entry);
    entry.offerText = await peer.createOffer(buildOfferMetadata(this, normalizedSlot, metadata));
    return entry.offerText;
  }

  async applyAnswerForSlot(slotKey: unknown, answerText: string): Promise<CoopApplyAnswerResult> {
    if (!this.isHostRole()) {
      throw new Error("Only the host can apply coop answers.");
    }
    const normalizedSlot = slotIndexToKey(slotKeyToIndex(slotKey, 1));
    const entry = this.pendingHostPeers.get(normalizedSlot);
    if (!entry?.peer) {
      throw new Error(`Missing pending offer for slot ${normalizedSlot}.`);
    }
    const envelope = parseCoopSignalEnvelope(answerText);
    if (envelope.kind !== COOP_SIGNAL_KINDS.ANSWER) {
      throw new Error("Expected a coop answer payload.");
    }
    const answerMetadata = buildCoopSignalMetadata(envelope.metadata);
    if (answerMetadata.sessionId !== this.sessionId) {
      throw new Error("Answer does not belong to the current coop session.");
    }
    if (answerMetadata.targetSlot !== normalizedSlot) {
      throw new Error(`Answer target slot mismatch. Expected ${normalizedSlot}.`);
    }
    await entry.peer.acceptAnswer(answerText);
    return {
      slot: normalizedSlot,
      awaitingOpen: true
    };
  }

  async acceptOffer(offerText: string, metadata: CoopMetadataInput = {}): Promise<CoopAcceptOfferResult> {
    this.resetRoleState({ silent: true });
    this.role = "guest";
    this.localPeerId = typeof metadata.playerId === "string" && metadata.playerId
      ? metadata.playerId
      : createCoopPeerId();
    this.localSlot = null;
    const envelope = parseCoopSignalEnvelope(offerText);
    const remoteMetadata = buildCoopSignalMetadata(envelope.metadata);
    this.sessionId = remoteMetadata.sessionId;
    this.roomCode = formatCoopConnectionLabel(remoteMetadata.roomCode ?? remoteMetadata.sessionId);
    this.requiredCapacity = remoteMetadata.requiredCapacity;
    this.hostSlotIndex = remoteMetadata.hostSlotIndex ?? 0;
    this.localSlot = remoteMetadata.targetSlot || null;
    this.sessionMetadata = remoteMetadata;
    this.guestPeer = this.peerClientFactory();
    this.guestPeerUnsubscribers = this.attachGuestPeer(this.guestPeer);
    this.pendingAnswerText = await this.guestPeer.acceptOffer(offerText, {
      ...(clone(remoteMetadata) as CoopMetadataInput),
      ...(clone(metadata) as CoopMetadataInput),
      sessionId: remoteMetadata.sessionId,
      roomCode: this.roomCode,
      requiredCapacity: this.requiredCapacity,
      targetSlot: remoteMetadata.targetSlot,
      hostSlotIndex: this.hostSlotIndex,
      playerId: this.localPeerId,
      role: "guest"
    });
    return {
      answerText: this.pendingAnswerText,
      sessionId: this.sessionId,
      roomCode: this.roomCode,
      localSlot: this.localSlot,
      metadata: clone(remoteMetadata),
      playerId: this.localPeerId
    };
  }

  send(message: unknown): void {
    if (this.isHostRole()) {
      this.connectedHostPeers.forEach(({ peer }) => {
        try {
          peer.send(message);
        } catch {
          // Best effort fan-out.
        }
      });
      return;
    }
    if (!this.guestPeer) {
      throw new Error("Coop guest transport is not connected.");
    }
    this.guestPeer.send(message);
  }

  close(code?: number, reason?: string): void {
    this.resetRoleState({ code, reason, silent: false });
  }

  resetRoleState({ code = 1000, reason = "transport_reset", silent = false }: { code?: number; reason?: string; silent?: boolean } = {}): void {
    this._closingTransport = true;

    this.pendingHostPeers.forEach((entry) => this.disposeHostPeerEntry(entry, { close: true, code, reason }));
    this.connectedHostPeers.forEach((entry) => this.disposeHostPeerEntry(entry, { close: true, code, reason }));
    this.pendingHostPeers.clear();
    this.connectedHostPeers.clear();

    this.guestPeerUnsubscribers.forEach((unsubscribe) => unsubscribe?.());
    this.guestPeerUnsubscribers = [];
    if (this.guestPeer) {
      try {
        this.guestPeer.close(code, reason);
      } catch {
        // Best effort only.
      }
    }
    this.guestPeer = null;

    const hadState = this.isOpen || this.role !== null;
    this.role = null;
    this.sessionId = "";
    this.roomCode = "";
    this.requiredCapacity = 2;
    this.hostSlotIndex = 0;
    this.localPeerId = null;
    this.localSlot = null;
    this.sessionMetadata = buildCoopSignalMetadata({});
    this.pendingAnswerText = "";
    this.isOpen = false;
    this._closingTransport = false;

    if (!silent && hadState) {
      this.emit("close", { code, reason, remote: false });
    }
  }

  attachHostPeerEntry(entry: HostPeerEntry): Array<PeerUnsubscribe> {
    const { peer, slot } = entry;
    return [
      peer.on("open", (rawPayload) => {
        if (this._closingTransport) return;
        if (this.pendingHostPeers.get(slot)?.peer !== peer) return;
        this.pendingHostPeers.delete(slot);
        this.connectedHostPeers.set(slot, entry);
        const payload = (rawPayload && typeof rawPayload === "object") ? rawPayload as Record<string, unknown> : {};
        this.emit("open", {
          ...payload,
          slot,
          slotIndex: slotKeyToIndex(slot, 1)
        });
      }),
      peer.on("message", (message) => {
        if (this._closingTransport) return;
        this.relayPeerMessage(message, slot, peer.remotePeerId);
      }),
      peer.on("close", (rawPayload) => {
        const wasConnected = this.connectedHostPeers.get(slot)?.peer === peer;
        this.disposeHostPeerEntry(entry, { close: false });
        this.connectedHostPeers.delete(slot);
        this.pendingHostPeers.delete(slot);
        const payload = (rawPayload && typeof rawPayload === "object") ? rawPayload as Record<string, unknown> : {};
        const isRemote = payload.remote;
        if (!wasConnected || isRemote === false || this._closingTransport || entry.intentionalClose) {
          return;
        }
        this.emit(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, {
          slot,
          slotIndex: slotKeyToIndex(slot, 1),
          sourceSlot: slot,
          sourcePeerId: peer.remotePeerId,
          playerId: peer.remotePeerId,
          reason: typeof payload.reason === "string" ? payload.reason : "peer_closed"
        });
      }),
      peer.on("error", (error) => {
        if (this._closingTransport) return;
        this.emit("peer_error", {
          error,
          slot,
          slotIndex: slotKeyToIndex(slot, 1),
          sourcePeerId: peer.remotePeerId
        });
      })
    ];
  }

  attachGuestPeer(peer: CoopPeerClient): Array<PeerUnsubscribe> {
    return [
      peer.on("open", (rawPayload) => {
        if (this._closingTransport) return;
        this.isOpen = true;
        const payload = (rawPayload && typeof rawPayload === "object") ? rawPayload as Record<string, unknown> : {};
        this.emit("open", {
          ...payload,
          slot: this.localSlot,
          slotIndex: slotKeyToIndex(this.localSlot, 1)
        });
      }),
      peer.on("message", (message) => {
        if (this._closingTransport) return;
        this.relayPeerMessage(message, slotIndexToKey(this.hostSlotIndex), peer.remotePeerId);
      }),
      peer.on(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, (payload) => {
        if (this._closingTransport) return;
        this.emit(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, augmentPayload(payload, {
          sourceSlot: slotIndexToKey(this.hostSlotIndex),
          sourcePeerId: peer.remotePeerId
        }));
      }),
      peer.on("close", (payload) => {
        if (this._closingTransport) return;
        this.isOpen = false;
        this.emit("close", payload);
      }),
      peer.on("error", (error) => {
        if (this._closingTransport) return;
        this.emit("error", error);
      })
    ];
  }

  disposeHostPeerEntry(entry: HostPeerEntry | undefined, { close = false, code = 1000, reason = "transport_reset" }: { close?: boolean; code?: number; reason?: string } = {}): void {
    if (!entry) return;
    entry.intentionalClose = entry.intentionalClose || close;
    entry.unsubscribers?.forEach((unsubscribe) => unsubscribe?.());
    entry.unsubscribers = [];
    if (close) {
      try {
        entry.peer?.close(code, reason);
      } catch {
        // Best effort only.
      }
    }
  }

  relayPeerMessage(message: unknown, sourceSlot: string, sourcePeerId: string | null): void {
    const parsed = message && typeof message === "object"
      ? clone(message) as { type?: unknown; payload?: unknown } | null
      : null;
    if (!parsed || typeof parsed.type !== "string") return;
    this.emit("message", {
      ...(parsed as Record<string, unknown>),
      sourceSlot,
      sourcePeerId
    });
    if (Object.hasOwn(COOP_MESSAGE_TYPE_VALUES, parsed.type)) {
      this.emit(parsed.type, augmentPayload(parsed.payload, {
        sourceSlot,
        sourcePeerId
      }));
    }
  }
}

// Internal helper kept for backward-compatible export shape
export type { CoopCreateRoomResult, CoopCreateOfferResult, CoopApplyAnswerResult, CoopAcceptOfferResult };
