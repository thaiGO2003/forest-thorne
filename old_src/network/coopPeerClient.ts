import {
  buildCoopSignalMetadata,
  buildDefaultCoopRtcConfig,
  COOP_MESSAGE_TYPES,
  COOP_SIGNAL_KINDS,
  DEFAULT_COOP_SIGNAL_TIMEOUT_MS,
  formatCoopConnectionLabel,
  type CoopMetadataInput,
  type CoopSignalKind,
  type CoopSignalMetadata
} from "./coopConfig.js";

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

const SIGNAL_VERSION = 1;


const RECOGNIZED_MESSAGE_TYPES: Record<string, true> = Object.freeze(
  Object.fromEntries(Object.values(COOP_MESSAGE_TYPES).map((value) => [value, true])) as Record<string, true>
);

const COOP_SIGNAL_KIND_VALUES: Record<CoopSignalKind, true> = Object.freeze(
  Object.fromEntries(Object.values(COOP_SIGNAL_KINDS).map((value) => [value, true])) as Record<CoopSignalKind, true>
);

export interface CoopSignalEnvelope {
  kind: string;
  version: number;
  description: { type: string; sdp: string };
  metadata: CoopSignalMetadata & Record<string, unknown>;
}

export interface CoopDataChannelLike {
  readyState: "connecting" | "open" | "closing" | "closed";
  binaryType?: string;
  close?: () => void;
  send?: (data: string) => void;
  addEventListener?: (type: string, listener: (event: { data?: unknown; [key: string]: unknown }) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
}

export interface CoopRtcSessionDescription {
  type: string;
  sdp?: string;
}

export interface CoopRtcDataChannelEvent {
  channel?: CoopDataChannelLike | null;
}

export interface CoopRtcPeerConnection {
  connectionState?: string;
  iceConnectionState?: string;
  iceGatheringState?: string;
  localDescription?: CoopRtcSessionDescription | null;
  remoteDescription?: CoopRtcSessionDescription | null;
  signalingState?: string;
  createDataChannel?: (label: string) => CoopDataChannelLike;
  createOffer?: (options?: unknown) => Promise<CoopRtcSessionDescription>;
  createAnswer?: (options?: unknown) => Promise<CoopRtcSessionDescription>;
  setLocalDescription?: (description: CoopRtcSessionDescription) => Promise<void>;
  setRemoteDescription?: (description: CoopRtcSessionDescription) => Promise<void>;
  close?: () => void;
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
}

export type CoopPeerFactory = (rtcConfig: RTCConfiguration) => CoopRtcPeerConnection;

interface GlobalWithBuffer {
  Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } };
}

interface GlobalWithCrypto {
  crypto?: { randomUUID?: () => string };
}

function createPeerConnectionFactory(rtcConfig: RTCConfiguration): CoopPeerFactory {
  return () => {
    if (typeof RTCPeerConnection !== "function") {
      throw new Error("WebRTC is not available in this environment.");
    }
    return new RTCPeerConnection(rtcConfig) as unknown as CoopRtcPeerConnection;
  };
}

export function createCoopPeerId(): string {
  const cryptoLike = (globalThis as GlobalWithCrypto).crypto;
  if (typeof cryptoLike?.randomUUID === "function") {
    return cryptoLike.randomUUID();
  }
  return `peer_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBase64Url(value: unknown): string {
  return String(value ?? "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeUtf8Base64Url(value: unknown): string {
  const text = String(value ?? "");
  const bufferCtor = (globalThis as GlobalWithBuffer).Buffer;
  if (typeof bufferCtor !== "undefined") {
    return normalizeBase64Url(bufferCtor.from(text, "utf8").toString("base64"));
  }
  const encoded = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_match, hex: string) => (
    String.fromCharCode(Number.parseInt(hex, 16))
  ));
  const btoa = globalThis.btoa?.bind(globalThis);
  return normalizeBase64Url(btoa ? btoa(encoded) : "");
}

function decodeUtf8Base64Url(value: unknown): string {
  const normalized = String(value ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const bufferCtor = (globalThis as GlobalWithBuffer).Buffer;
  if (typeof bufferCtor !== "undefined") {
    return bufferCtor.from(`${normalized}${padding}`, "base64").toString("utf8");
  }
  const atob = globalThis.atob?.bind(globalThis);
  const decoded = atob ? atob(`${normalized}${padding}`) : "";
  const percentEncoded = Array.from(decoded, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(percentEncoded);
}

function cloneMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object") {
    return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
  }
  return {};
}

function generateConnectionLabel(seed: unknown = ""): string {
  return formatCoopConnectionLabel(seed || "COOPP2P");
}

function buildSignalEnvelope(
  kind: string,
  description: CoopRtcSessionDescription | null | undefined,
  metadata: Record<string, unknown> = {}
): CoopSignalEnvelope {
  if (!description || typeof description.type !== "string" || typeof description.sdp !== "string") {
    throw new Error("Missing RTC session description.");
  }
  return {
    kind,
    version: SIGNAL_VERSION,
    description: {
      type: description.type,
      sdp: description.sdp
    },
    metadata: cloneMetadata(metadata) as CoopSignalMetadata & Record<string, unknown>
  };
}

export function serializeCoopSignalEnvelope(envelope: CoopSignalEnvelope): string {
  return encodeUtf8Base64Url(JSON.stringify(envelope));
}

export function parseCoopSignalEnvelope(text: unknown): CoopSignalEnvelope {
  const decoded = decodeUtf8Base64Url(text);
  const parsed = JSON.parse(decoded) as { kind?: unknown; version?: unknown; description?: { type?: unknown; sdp?: unknown }; metadata?: unknown } | null;
  if (!parsed || typeof parsed.kind !== "string" || !Object.hasOwn(COOP_SIGNAL_KIND_VALUES, parsed.kind)) {
    throw new Error("Unsupported coop signal payload.");
  }
  const description = parsed.description;
  if (!description || typeof description.type !== "string" || typeof description.sdp !== "string") {
    throw new Error("Invalid coop signal description.");
  }
  return {
    kind: parsed.kind,
    version: typeof parsed.version === "number" ? parsed.version : SIGNAL_VERSION,
    description: { type: description.type, sdp: description.sdp },
    metadata: (parsed.metadata ?? {}) as CoopSignalMetadata & Record<string, unknown>
  };
}

function waitForIceGatheringComplete(
  peerConnection: CoopRtcPeerConnection | null,
  timeoutMs = DEFAULT_COOP_SIGNAL_TIMEOUT_MS
): Promise<void> {
  if (!peerConnection) return Promise.resolve();
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    peerConnection.removeEventListener?.("icegatheringstatechange", handleChange);
    clearTimeout(timer);
    resolve();
  };
  const handleChange = () => {
    if (peerConnection.iceGatheringState === "complete") {
      finish();
    }
  };
  const timer = setTimeout(finish, Math.max(250, timeoutMs));
  peerConnection.addEventListener?.("icegatheringstatechange", handleChange);
  return promise;
}

function safeCloseDataChannel(channel: CoopDataChannelLike | null): void {
  try {
    if (channel && channel.readyState !== "closed") {
      channel.close?.();
    }
  } catch {
    // best effort
  }
}

function safeClosePeerConnection(peerConnection: CoopRtcPeerConnection | null): void {
  try {
    peerConnection?.close?.();
  } catch {
    // best effort
  }
}

export interface CoopPeerClientOptions {
  rtcConfig?: RTCConfiguration;
  peerFactory?: CoopPeerFactory;
  signalTimeoutMs?: number;
}

export type CoopPeerHandler = (payload: unknown) => void;

export class CoopPeerClient {
  rtcConfig: RTCConfiguration;
  peerFactory: CoopPeerFactory;
  signalTimeoutMs: number;
  peerConnection: CoopRtcPeerConnection | null;
  dataChannel: CoopDataChannelLike | null;
  listeners: Map<string, Set<CoopPeerHandler>>;
  isOpen: boolean;
  localRole: string | null;
  localPeerId: string | null;
  remotePeerId: string | null;
  connectionLabel: string;
  remoteMetadata: CoopSignalMetadata | null;
  _intentionalClose: boolean;
  _closeNotified: boolean;

  constructor({
    rtcConfig = buildDefaultCoopRtcConfig(),
    peerFactory = createPeerConnectionFactory(rtcConfig),
    signalTimeoutMs = DEFAULT_COOP_SIGNAL_TIMEOUT_MS
  }: CoopPeerClientOptions = {}) {
    this.rtcConfig = rtcConfig;
    this.peerFactory = peerFactory;
    this.signalTimeoutMs = signalTimeoutMs;
    this.peerConnection = null;
    this.dataChannel = null;
    this.listeners = new Map();
    this.isOpen = false;
    this.localRole = null;
    this.localPeerId = null;
    this.remotePeerId = null;
    this.connectionLabel = "";
    this.remoteMetadata = null;
    this._intentionalClose = false;
    this._closeNotified = false;
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
        console.error(`[CoopPeerClient] Listener failed for ${eventName}:`, error);
      }
    });
  }

  resetTransportState(): void {
    this._intentionalClose = false;
    this._closeNotified = false;
    this.isOpen = false;
  }

  cleanupTransport(): void {
    safeCloseDataChannel(this.dataChannel);
    safeClosePeerConnection(this.peerConnection);
    this.dataChannel = null;
    this.peerConnection = null;
    this.isOpen = false;
  }

  notifyClosed(reason: string = "closed", { remote = false, event = null }: { remote?: boolean; event?: unknown } = {}): void {
    if (this._closeNotified) return;
    this._closeNotified = true;
    this.isOpen = false;
    if (remote) {
      this.emit(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, {
        reason,
        playerId: this.remotePeerId
      });
    }
    this.emit("close", { reason, remote, event });
  }

  handlePeerFailure(reason: string, event: unknown = null): void {
    if (this._intentionalClose) return;
    this.notifyClosed(reason, { remote: true, event });
  }

  wirePeerConnection(peerConnection: CoopRtcPeerConnection): void {
    peerConnection.addEventListener?.("connectionstatechange", () => {
      const state = peerConnection.connectionState;
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.handlePeerFailure(`connection_state_${state}`);
      }
    });
    peerConnection.addEventListener?.("iceconnectionstatechange", () => {
      const state = peerConnection.iceConnectionState;
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.handlePeerFailure(`ice_state_${state}`);
      }
    });
    peerConnection.addEventListener?.("datachannel", (rawEvent) => {
      if (rawEvent && typeof rawEvent === "object" && "channel" in rawEvent) {
        const channel = (rawEvent as CoopRtcDataChannelEvent).channel ?? null;
        this.wireDataChannel(channel);
      } else {
        this.wireDataChannel(null);
      }
    });
  }

  wireDataChannel(channel: CoopDataChannelLike | null): void {
    if (!channel) return;
    this.dataChannel = channel;
    channel.addEventListener?.("open", () => {
      this.isOpen = true;
      this._closeNotified = false;
      this.emit("open", {
        connectionLabel: this.connectionLabel,
        localRole: this.localRole,
        localPeerId: this.localPeerId,
        remotePeerId: this.remotePeerId
      });
    });
    channel.addEventListener?.("close", (event) => {
      this.notifyClosed("datachannel_closed", { remote: !this._intentionalClose, event });
    });
    channel.addEventListener?.("error", (event) => {
      this.emit("error", event);
      if (!this._intentionalClose) {
        this.handlePeerFailure("datachannel_error", event);
      }
    });
    channel.addEventListener?.("message", (event) => {
      this.handleMessage(event?.data);
    });
  }

  createPeerConnection(): CoopRtcPeerConnection {
    this.cleanupTransport();
    this.resetTransportState();
    this.peerConnection = this.peerFactory(this.rtcConfig);
    this.wirePeerConnection(this.peerConnection);
    return this.peerConnection;
  }

  async createOffer(metadata: CoopMetadataInput = {}): Promise<string> {
    const normalizedMetadata = buildCoopSignalMetadata(metadata);
    this.localRole = "host";
    this.localPeerId = normalizedMetadata.playerId || createCoopPeerId();
    this.remotePeerId = null;
    this.remoteMetadata = null;
    this.connectionLabel = generateConnectionLabel(
      normalizedMetadata.roomCode
      ?? normalizedMetadata.connectionLabel
      ?? this.localPeerId
    );
    const peerConnection = this.createPeerConnection();
    if (typeof peerConnection.createDataChannel !== "function") {
      throw new Error("WebRTC is not available in this environment.");
    }
    const dataChannel = peerConnection.createDataChannel("coop");
    this.wireDataChannel(dataChannel);
    if (typeof peerConnection.createOffer !== "function" || typeof peerConnection.setLocalDescription !== "function") {
      throw new Error("WebRTC is not available in this environment.");
    }
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection, this.signalTimeoutMs);
    return serializeCoopSignalEnvelope(buildSignalEnvelope(
      COOP_SIGNAL_KINDS.OFFER,
      peerConnection.localDescription ?? offer,
      {
        ...cloneMetadata(normalizedMetadata),
        roomCode: this.connectionLabel,
        playerId: this.localPeerId,
        role: this.localRole
      }
    ));
  }

  async acceptOffer(offerText: unknown, metadata: CoopMetadataInput = {}): Promise<string> {
    const envelope = parseCoopSignalEnvelope(offerText);
    if (envelope.kind !== COOP_SIGNAL_KINDS.OFFER) {
      throw new Error("Expected a coop offer payload.");
    }
    const normalizedMetadata = buildCoopSignalMetadata({
      ...(cloneMetadata(envelope.metadata) as CoopMetadataInput),
      ...cloneMetadata(metadata)
    });
    this.localRole = "guest";
    this.localPeerId = normalizedMetadata.playerId || createCoopPeerId();
    this.remotePeerId = typeof envelope.metadata.playerId === "string" ? envelope.metadata.playerId : null;
    this.remoteMetadata = cloneMetadata(normalizedMetadata) as unknown as CoopSignalMetadata;
    this.connectionLabel = generateConnectionLabel(
      normalizedMetadata.roomCode
      ?? normalizedMetadata.connectionLabel
      ?? this.remotePeerId
    );
    const peerConnection = this.createPeerConnection();
    if (
      typeof peerConnection.setRemoteDescription !== "function"
      || typeof peerConnection.createAnswer !== "function"
      || typeof peerConnection.setLocalDescription !== "function"
    ) {
      throw new Error("WebRTC is not available in this environment.");
    }
    await peerConnection.setRemoteDescription(envelope.description);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await waitForIceGatheringComplete(peerConnection, this.signalTimeoutMs);
    return serializeCoopSignalEnvelope(buildSignalEnvelope(
      COOP_SIGNAL_KINDS.ANSWER,
      peerConnection.localDescription ?? answer,
      {
        ...cloneMetadata(normalizedMetadata),
        roomCode: this.connectionLabel,
        playerId: this.localPeerId,
        role: this.localRole
      }
    ));
  }

  async acceptAnswer(answerText: unknown): Promise<void> {
    const envelope = parseCoopSignalEnvelope(answerText);
    if (envelope.kind !== COOP_SIGNAL_KINDS.ANSWER) {
      throw new Error("Expected a coop answer payload.");
    }
    if (!this.peerConnection) {
      throw new Error("Missing pending peer connection for coop answer.");
    }
    this.remotePeerId = typeof envelope.metadata.playerId === "string" ? envelope.metadata.playerId : this.remotePeerId;
    this.remoteMetadata = cloneMetadata(buildCoopSignalMetadata(envelope.metadata)) as unknown as CoopSignalMetadata;
    this.connectionLabel = generateConnectionLabel(
      envelope.metadata.roomCode
      ?? envelope.metadata.connectionLabel
      ?? this.connectionLabel
      ?? this.remotePeerId
    );
    if (typeof this.peerConnection.setRemoteDescription !== "function") {
      throw new Error("WebRTC is not available in this environment.");
    }
    await this.peerConnection.setRemoteDescription(envelope.description);
  }

  send(message: unknown): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("Coop peer data channel is not connected.");
    }
    if (typeof this.dataChannel.send !== "function") {
      throw new Error("Coop peer data channel is not connected.");
    }
    this.dataChannel.send(JSON.stringify(message));
  }

  close(code?: number, reason?: string): void {
    this._intentionalClose = true;
    safeCloseDataChannel(this.dataChannel);
    safeClosePeerConnection(this.peerConnection);
    this.dataChannel = null;
    this.peerConnection = null;
    this.isOpen = false;
    this.notifyClosed(reason ?? "closed_by_local_peer", {
      remote: false,
      event: { code, reason }
    });
  }

  handleMessage(rawMessage: unknown): void {
    let parsed: { type?: unknown; payload?: unknown } | null;
    try {
      parsed = JSON.parse(String(rawMessage ?? "")) as { type?: unknown; payload?: unknown };
    } catch {
      this.emit("error", new Error("Received invalid coop peer payload."));
      return;
    }

    const { type, payload } = parsed ?? {};
    this.emit("message", parsed);
    if (type === "error") {
      this.emit("error", payload ?? parsed);
      return;
    }
    if (typeof type === "string" && RECOGNIZED_MESSAGE_TYPES[type]) {
      this.emit(type, payload ?? {});
    }
  }
}
