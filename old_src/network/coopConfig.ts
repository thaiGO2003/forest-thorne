export const COOP_MESSAGE_TYPES = Object.freeze({
  ROOM_STATE: "room_state",
  PLAYER_READY: "player_ready",
  PLANNING_INTENT: "planning_intent",
  PLANNING_READY_PING: "planning_ready_ping",
  AUTHORITATIVE_SNAPSHOT: "authoritative_snapshot",
  COMBAT_DELTA: "combat_delta",
  COMBAT_HEARTBEAT: "combat_heartbeat",
  COMBAT_START: "combat_start",
  COMBAT_RESULT: "combat_result",
  COMBAT_RETREAT: "combat_retreat",
  PLAYER_DISCONNECTED: "player_disconnected"
} as const);

export const COOP_SIGNAL_KINDS = Object.freeze({
  OFFER: "coop_offer",
  ANSWER: "coop_answer"
} as const);

export const COOP_SESSION_TYPES = Object.freeze({
  P2P_HOST_RELAY: "p2p_host_relay"
} as const);

export type CoopMessageType = typeof COOP_MESSAGE_TYPES[keyof typeof COOP_MESSAGE_TYPES];
export type CoopSignalKind = typeof COOP_SIGNAL_KINDS[keyof typeof COOP_SIGNAL_KINDS];
export type CoopRole = "host" | "guest";
export type CoopMetadataInput = Record<string, unknown> & {
  sessionId?: unknown;
  requiredCapacity?: unknown;
  targetSlot?: unknown;
  selectedMode?: unknown;
  aiMode?: unknown;
  saveSlotId?: unknown;
  saveMode?: unknown;
  resumeSummary?: unknown;
  hostSlotIndex?: unknown;
  roomCode?: unknown;
  playerId?: unknown;
  role?: unknown;
  connectionLabel?: unknown;
};

export interface CoopSignalMetadata {
  sessionId: string;
  requiredCapacity: number;
  targetSlot: string;
  targetSlotIndex: number | null;
  selectedMode: string;
  aiMode: string;
  saveSlotId: string;
  saveMode: string;
  resumeSummary: unknown;
  hostSlotIndex: number;
  roomCode: string;
  playerId: string;
  role: string;
  connectionLabel: string;
}

export const DEFAULT_COOP_SIGNAL_TIMEOUT_MS = 12000;
export const DEFAULT_COOP_ROOM_CODE_LENGTH = 6;

export const DEFAULT_COOP_ICE_SERVERS = Object.freeze([
  Object.freeze({
    urls: Object.freeze([
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302"
    ])
  }),
  Object.freeze({
    urls: Object.freeze([
      "stun:stun.cloudflare.com:3478"
    ])
  })
]);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value as number));
}

function clone(value: unknown): unknown {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value ?? null;
}

export function formatCoopConnectionLabel(value: unknown, length = DEFAULT_COOP_ROOM_CODE_LENGTH): string {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, length);
  if (!normalized) return "";
  return normalized.padEnd(length, "X");
}

export function slotKeyToIndex(slotKey: unknown, fallback = 0): number {
  const match = /^P([1-4])$/i.exec(String(slotKey ?? "").trim());
  return match ? Math.max(0, Number.parseInt(match[1], 10) - 1) : fallback;
}

export function slotIndexToKey(slotIndex: unknown, fallback = "P1"): string {
  return `P${Number.isInteger(slotIndex) && (slotIndex as number) >= 0 ? (slotIndex as number) + 1 : slotKeyToIndex(fallback, 0) + 1}`;
}

export function buildCoopSignalMetadata(metadata: CoopMetadataInput = {}): CoopSignalMetadata {
  const requiredCapacity = clampInt(metadata.requiredCapacity, 2, 2, 4);
  const targetSlot = typeof metadata.targetSlot === "string"
    ? slotIndexToKey(slotKeyToIndex(metadata.targetSlot, requiredCapacity > 2 ? 1 : 1))
    : "";
  const hostSlotIndex = clampInt(metadata.hostSlotIndex, 0, 0, 3);
  return {
    sessionId: typeof metadata.sessionId === "string" ? metadata.sessionId.trim() : "",
    requiredCapacity,
    targetSlot,
    targetSlotIndex: targetSlot ? slotKeyToIndex(targetSlot, 1) : null,
    selectedMode: typeof metadata.selectedMode === "string" && metadata.selectedMode
      ? metadata.selectedMode
      : "EndlessPvEClassic",
    aiMode: typeof metadata.aiMode === "string" && metadata.aiMode
      ? metadata.aiMode
      : "COOP_MEDIUM",
    saveSlotId: typeof metadata.saveSlotId === "string" && metadata.saveSlotId
      ? metadata.saveSlotId
      : "AUTO",
    saveMode: typeof metadata.saveMode === "string" && metadata.saveMode
      ? metadata.saveMode
      : "new",
    resumeSummary: clone(metadata.resumeSummary),
    hostSlotIndex,
    roomCode: formatCoopConnectionLabel(metadata.roomCode ?? metadata.sessionId ?? ""),
    playerId: typeof metadata.playerId === "string" && metadata.playerId ? metadata.playerId : "",
    role: typeof metadata.role === "string" && metadata.role ? metadata.role : "",
    connectionLabel: formatCoopConnectionLabel(metadata.connectionLabel ?? metadata.roomCode ?? metadata.sessionId ?? "")
  };
}

export function buildDefaultCoopRtcConfig(): RTCConfiguration {
  return {
    iceServers: DEFAULT_COOP_ICE_SERVERS.map((server) => ({
      ...server,
      urls: Array.isArray(server.urls) ? [...server.urls] : server.urls
    })) as RTCIceServer[]
  };
}
