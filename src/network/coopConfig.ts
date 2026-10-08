// Canonical co-op signalling/config normalization (mega prompt A47.1-A47.2).

export const COOP_SESSION_TYPE = "p2p_host_relay" as const;
export const COOP_SIGNAL_VERSION = 1 as const;
export const COOP_SIGNAL_KINDS = ["coop_offer", "coop_answer"] as const;
export type CoopSignalKind = (typeof COOP_SIGNAL_KINDS)[number];

export const COOP_MESSAGE_TYPES = [
  "room_state",
  "player_ready",
  "planning_intent",
  "planning_ready_ping",
  "authoritative_snapshot",
  "combat_delta",
  "combat_heartbeat",
  "combat_start",
  "combat_result",
  "combat_retreat",
  "player_disconnected",
] as const;
export type CoopMessageType = (typeof COOP_MESSAGE_TYPES)[number];

export const COOP_SLOTS = ["P1", "P2", "P3", "P4"] as const;
export type CoopSlot = (typeof COOP_SLOTS)[number];

export const DEFAULT_COOP_CAPACITY = 2;
export const DEFAULT_COOP_MODE = "EndlessPvEClassic";
export const DEFAULT_COOP_AI_MODE = "COOP_MEDIUM";
export const DEFAULT_COOP_SAVE_SLOT = "AUTO";
export const DEFAULT_COOP_SAVE_MODE = "new";
export const DEFAULT_COOP_SIGNAL_TIMEOUT_MS = 12_000;
export const MIN_COOP_SIGNAL_TIMEOUT_MS = 250;
export const DEFAULT_COOP_ICE_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun.cloudflare.com:3478",
] as const;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const finiteInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
};

function copyData(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return undefined;
  }
}

export function normalizeCoopCapacity(value: unknown, fallback = DEFAULT_COOP_CAPACITY): number {
  const base = finiteInt(value, finiteInt(fallback, DEFAULT_COOP_CAPACITY));
  return Math.min(4, Math.max(2, base));
}

export function coopSlotsForCapacity(capacity: unknown): CoopSlot[] {
  return COOP_SLOTS.slice(0, normalizeCoopCapacity(capacity));
}

export function normalizeCoopSlot(value: unknown, fallback: CoopSlot = "P1"): CoopSlot {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (COOP_SLOTS as readonly string[]).includes(normalized)
    ? normalized as CoopSlot
    : fallback;
}

export function coopSlotIndex(value: unknown, fallback: CoopSlot = "P1"): number {
  return COOP_SLOTS.indexOf(normalizeCoopSlot(value, fallback));
}

export function coopSlotFromIndex(value: unknown, fallback: CoopSlot = "P1"): CoopSlot {
  const index = finiteInt(value, -1);
  return COOP_SLOTS[index] ?? fallback;
}

export function normalizeConnectionLabel(value: unknown, length = 6): string {
  const size = Math.max(1, finiteInt(length, 6));
  const normalized = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, size);
  return normalized.length === 0 ? "" : normalized.padEnd(size, "X");
}

export function normalizeCoopSignalTimeout(value: unknown): number {
  return Math.max(MIN_COOP_SIGNAL_TIMEOUT_MS, finiteInt(value, DEFAULT_COOP_SIGNAL_TIMEOUT_MS));
}

export interface CoopSignalMetadata {
  sessionId: string;
  requiredCapacity: number;
  targetSlot: CoopSlot;
  targetSlotIndex: number;
  selectedMode: string;
  aiMode: string;
  saveSlotId: string;
  saveMode: string;
  resumeSummary?: unknown;
  hostSlotIndex: number;
  roomCode: string;
  playerId: string;
  role: string;
  connectionLabel: string;
}

export function normalizeCoopSignalMetadata(value: unknown): CoopSignalMetadata {
  const raw = record(value) ?? {};
  const requiredCapacity = normalizeCoopCapacity(raw.requiredCapacity);
  const legalSlots = coopSlotsForCapacity(requiredCapacity);
  const targetFallback = legalSlots[1] ?? legalSlots[0] ?? "P1";
  let targetSlot = normalizeCoopSlot(raw.targetSlot, coopSlotFromIndex(raw.targetSlotIndex, targetFallback));
  if (!legalSlots.includes(targetSlot)) targetSlot = targetFallback;
  const hostSlot = coopSlotFromIndex(raw.hostSlotIndex, "P1");
  const hostSlotIndex = legalSlots.includes(hostSlot) ? coopSlotIndex(hostSlot) : 0;
  const out: CoopSignalMetadata = {
    sessionId: stringValue(raw.sessionId),
    requiredCapacity,
    targetSlot,
    targetSlotIndex: coopSlotIndex(targetSlot),
    selectedMode: stringValue(raw.selectedMode, DEFAULT_COOP_MODE) || DEFAULT_COOP_MODE,
    aiMode: stringValue(raw.aiMode, DEFAULT_COOP_AI_MODE) || DEFAULT_COOP_AI_MODE,
    saveSlotId: stringValue(raw.saveSlotId, DEFAULT_COOP_SAVE_SLOT) || DEFAULT_COOP_SAVE_SLOT,
    saveMode: stringValue(raw.saveMode, DEFAULT_COOP_SAVE_MODE) || DEFAULT_COOP_SAVE_MODE,
    hostSlotIndex,
    roomCode: normalizeConnectionLabel(raw.roomCode),
    playerId: stringValue(raw.playerId),
    role: stringValue(raw.role),
    connectionLabel: normalizeConnectionLabel(raw.connectionLabel),
  };
  const resumeSummary = copyData(raw.resumeSummary);
  if (resumeSummary !== undefined) out.resumeSummary = resumeSummary;
  return out;
}

export interface RtcSessionDescriptionData {
  type: string;
  sdp: string;
}

export interface CoopSignalEnvelope {
  kind: CoopSignalKind;
  version: typeof COOP_SIGNAL_VERSION;
  description: RtcSessionDescriptionData;
  metadata: CoopSignalMetadata;
}

const isSignalKind = (value: unknown): value is CoopSignalKind =>
  typeof value === "string" && (COOP_SIGNAL_KINDS as readonly string[]).includes(value);

export const isCoopMessageType = (value: unknown): value is CoopMessageType =>
  typeof value === "string" && (COOP_MESSAGE_TYPES as readonly string[]).includes(value);

function normalizeDescription(value: unknown): RtcSessionDescriptionData | null {
  const raw = record(value);
  if (!raw || typeof raw.type !== "string" || typeof raw.sdp !== "string") return null;
  if (!raw.type.trim() || !raw.sdp.trim()) return null;
  return { type: raw.type, sdp: raw.sdp };
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeCoopSignal(envelope: CoopSignalEnvelope): string {
  const json = JSON.stringify(envelope);
  const encoded = btoa(bytesToBinary(new TextEncoder().encode(json)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeCoopSignal(value: string): CoopSignalEnvelope {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const json = new TextDecoder().decode(binaryToBytes(atob(padded)));
    const raw = record(JSON.parse(json));
    if (!raw || !isSignalKind(raw.kind) || raw.version !== COOP_SIGNAL_VERSION) {
      throw new Error("Unsupported co-op signal envelope");
    }
    const description = normalizeDescription(raw.description);
    if (!description) throw new Error("Malformed RTC description");
    return {
      kind: raw.kind,
      version: COOP_SIGNAL_VERSION,
      description,
      metadata: normalizeCoopSignalMetadata(raw.metadata),
    };
  } catch (error) {
    if (error instanceof Error && (error.message === "Unsupported co-op signal envelope" || error.message === "Malformed RTC description")) {
      throw error;
    }
    throw new Error("Malformed co-op signal", { cause: error });
  }
}

export function createCoopSignal(
  kind: CoopSignalKind,
  description: RtcSessionDescriptionData,
  metadata: unknown,
): CoopSignalEnvelope {
  const normalizedDescription = normalizeDescription(description);
  if (!normalizedDescription) throw new Error("Malformed RTC description");
  return {
    kind,
    version: COOP_SIGNAL_VERSION,
    description: normalizedDescription,
    metadata: normalizeCoopSignalMetadata(metadata),
  };
}
