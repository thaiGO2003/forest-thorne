import { createDefaultCoopPlayerState } from "../core/runState.js";
import { getCoopPlayerCapacity, getCoopPlayerSlots } from "../core/aiModes.js";
import { getRequiredPlayerCapacityForGameMode } from "../core/gameModeRuntime.js";

type CoopSlot = string;
type CoopSessionListener = (snapshot: CoopSession | null) => void;

export interface CoopSession {
  client: unknown;
  roomCode: string;
  playerId: string | null;
  playerCapacity: number;
  localSlot: CoopSlot;
  hostSlot: CoopSlot;
  aiMode: string;
  selectedMode: string;
  readyBySlot: Record<CoopSlot, boolean>;
  players: Record<CoopSlot, unknown>;
  currentCombatPayload: unknown;
  roomPlayers: Array<Record<string, unknown>>;
  sessionType: string | null;
  pvpState: Record<string, unknown> | null;
  activeSaveSlotId: string;
  saveMode: string;
  resumeSummary: Record<string, unknown> | null;
  resumeState: unknown;
}

export interface CoopSessionInput {
  client?: unknown;
  roomCode?: unknown;
  playerId?: unknown;
  localSlot?: unknown;
  hostSlot?: unknown;
  aiMode?: unknown;
  selectedMode?: unknown;
  currentCombatPayload?: unknown;
  roomPlayers?: unknown;
  sessionType?: unknown;
  pvpState?: unknown;
  activeSaveSlotId?: unknown;
  saveMode?: unknown;
  resumeSummary?: unknown;
  resumeState?: unknown;
  players?: Record<CoopSlot, unknown> | null | undefined;
  readyBySlot?: Record<CoopSlot, unknown> | null | undefined;
  playerCapacity?: unknown;
}

let coopSession: CoopSession | null = null;
const listeners = new Set<CoopSessionListener>();

function notify(): void {
  const snapshot = getCoopSession();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error("[coopSession] listener failed", error);
    }
  });
}

function normalizeSlot(value: unknown, capacity = 2, fallback: CoopSlot = "P1"): CoopSlot {
  const allowedSlots = getCoopPlayerSlots(capacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM");
  if (typeof value === "string" && allowedSlots.includes(value)) return value;
  if (allowedSlots.includes(fallback)) return fallback;
  return "P1";
}

function resolveCapacityFromSessionData(data: CoopSessionInput = {}, fallback = 2): number {
  if (Number.isInteger(data.playerCapacity) && (data.playerCapacity as number) > 0) {
    return Math.max(2, Math.min(4, data.playerCapacity as number));
  }
  const modeCapacity = getRequiredPlayerCapacityForGameMode(
    typeof data.selectedMode === "string" ? data.selectedMode : "",
    typeof data.aiMode === "string" ? data.aiMode : ""
  );
  if (Number.isInteger(modeCapacity) && modeCapacity > 1) {
    return Math.max(2, Math.min(4, modeCapacity));
  }
  return getCoopPlayerCapacity(typeof data.aiMode === "string" ? data.aiMode : "") || fallback;
}

function createReadyMap(data: CoopSessionInput = {}, capacity = 2): Record<CoopSlot, boolean> {
  const readyBySlot: Record<CoopSlot, boolean> = {};
  getCoopPlayerSlots(capacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM").forEach((slot) => {
    readyBySlot[slot] = !!data.readyBySlot?.[slot];
  });
  return readyBySlot;
}

function createPlayersMap(data: CoopSessionInput = {}, capacity = 2): Record<CoopSlot, unknown> {
  const players: Record<CoopSlot, unknown> = {};
  getCoopPlayerSlots(capacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM").forEach((slot) => {
    players[slot] = createSessionPlayerState(data.players?.[slot] ?? null);
  });
  return players;
}

function createSessionPlayerState(player: unknown): unknown {
  return player && typeof player === "object"
    ? player
    : createDefaultCoopPlayerState();
}

export function subscribeToCoopSession(listener: CoopSessionListener): () => void {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearCoopSession(): void {
  coopSession = null;
  notify();
}

export function getCoopSession(): CoopSession | null {
  return coopSession;
}

export function isCoopSessionActive(): boolean {
  return !!coopSession;
}

export function createCoopSession(data: CoopSessionInput = {}): CoopSession {
  const playerCapacity = resolveCapacityFromSessionData(data);
  const localSlot = normalizeSlot(data.localSlot, playerCapacity);
  const hostSlot = normalizeSlot(data.hostSlot, playerCapacity, "P1");
  coopSession = {
    client: data.client ?? null,
    roomCode: typeof data.roomCode === "string" ? data.roomCode : "",
    playerId: typeof data.playerId === "string" ? data.playerId : null,
    playerCapacity,
    localSlot,
    hostSlot,
    aiMode: typeof data.aiMode === "string" ? data.aiMode : "COOP_MEDIUM",
    selectedMode: typeof data.selectedMode === "string" ? data.selectedMode : "EndlessPvEClassic",
    readyBySlot: createReadyMap(data, playerCapacity),
    players: createPlayersMap(data, playerCapacity),
    currentCombatPayload: data.currentCombatPayload ?? null,
    roomPlayers: Array.isArray(data.roomPlayers) ? data.roomPlayers.map((player) => ({ ...(player as Record<string, unknown>) })) : [],
    sessionType: typeof data.sessionType === "string" ? data.sessionType : null,
    pvpState: data.pvpState && typeof data.pvpState === "object" ? { ...(data.pvpState as Record<string, unknown>) } : null,
    activeSaveSlotId: typeof data.activeSaveSlotId === "string" ? data.activeSaveSlotId : "AUTO",
    saveMode: typeof data.saveMode === "string" ? data.saveMode : "new",
    resumeSummary: data.resumeSummary && typeof data.resumeSummary === "object" ? { ...(data.resumeSummary as Record<string, unknown>) } : null,
    resumeState: data.resumeState && typeof data.resumeState === "object" ? data.resumeState : null
  };
  notify();
  return coopSession;
}

export function updateCoopSession(patch: CoopSessionInput = {}): CoopSession {
  if (!coopSession) {
    return createCoopSession(patch);
  }
  const nextAiMode: string = (typeof patch.aiMode === "string" ? patch.aiMode : coopSession.aiMode) ?? coopSession.aiMode;
  const nextCapacity = resolveCapacityFromSessionData({
    ...coopSession,
    ...patch,
    aiMode: nextAiMode
  } as CoopSessionInput, coopSession.playerCapacity ?? 2);
  const updated: CoopSession = {
    ...coopSession,
    ...patch,
    aiMode: nextAiMode,
    playerCapacity: nextCapacity,
    localSlot: normalizeSlot(patch.localSlot ?? coopSession.localSlot, nextCapacity),
    hostSlot: normalizeSlot(patch.hostSlot ?? coopSession.hostSlot, nextCapacity, "P1"),
    readyBySlot: createReadyMap({
      readyBySlot: {
        ...(coopSession.readyBySlot ?? {}),
        ...(patch.readyBySlot ?? {})
      }
    }, nextCapacity),
    players: createPlayersMap({
      players: {
        ...(coopSession.players ?? {}),
        ...(patch.players ?? {})
      }
    }, nextCapacity),
    roomPlayers: Array.isArray(patch.roomPlayers)
      ? patch.roomPlayers.map((player) => ({ ...(player as Record<string, unknown>) }))
      : (Array.isArray(coopSession.roomPlayers) ? coopSession.roomPlayers.map((player) => ({ ...player })) : []),
    pvpState: patch.pvpState && typeof patch.pvpState === "object"
      ? { ...(coopSession.pvpState ?? {}), ...(patch.pvpState as Record<string, unknown>) }
      : coopSession.pvpState,
    activeSaveSlotId: typeof patch.activeSaveSlotId === "string"
      ? patch.activeSaveSlotId
      : (coopSession.activeSaveSlotId ?? "AUTO"),
    saveMode: typeof patch.saveMode === "string"
      ? patch.saveMode
      : (coopSession.saveMode ?? "new"),
    resumeSummary: patch.resumeSummary === null
      ? null
      : (patch.resumeSummary && typeof patch.resumeSummary === "object"
        ? { ...(coopSession.resumeSummary ?? {}), ...(patch.resumeSummary as Record<string, unknown>) }
        : coopSession.resumeSummary),
    resumeState: patch.resumeState === null
      ? null
      : (patch.resumeState && typeof patch.resumeState === "object"
        ? patch.resumeState
        : coopSession.resumeState)
  } as CoopSession;
  coopSession = updated;
  notify();
  return updated;
}

export function setCoopSessionPlayer(slot: unknown, playerState: unknown): CoopSession | null {
  const capacity = coopSession?.playerCapacity ?? 2;
  const normalizedSlot = normalizeSlot(slot, capacity);
  if (!coopSession) {
    createCoopSession({
      localSlot: normalizedSlot,
      playerCapacity: capacity,
      players: {
        [normalizedSlot]: createSessionPlayerState(playerState)
      }
    });
    return getCoopSession();
  }
  coopSession.players[normalizedSlot] = createSessionPlayerState(playerState);
  notify();
  return coopSession;
}

export function setCoopSessionReady(slot: unknown, ready: unknown): CoopSession | null {
  const capacity = coopSession?.playerCapacity ?? 2;
  const normalizedSlot = normalizeSlot(slot, capacity);
  if (!coopSession) {
    createCoopSession({
      localSlot: normalizedSlot,
      playerCapacity: capacity,
      readyBySlot: { [normalizedSlot]: !!ready }
    });
    return getCoopSession();
  }
  coopSession.readyBySlot[normalizedSlot] = !!ready;
  notify();
  return coopSession;
}

export function getRemoteCoopSlots(localSlot: unknown = "P1"): CoopSlot[] {
  const capacity = coopSession?.playerCapacity ?? 2;
  const normalized = normalizeSlot(localSlot, capacity);
  const slots = getCoopPlayerSlots(capacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM");
  return slots.filter((slot) => slot !== normalized);
}

export function getRemoteCoopSlot(localSlot: unknown = "P1"): CoopSlot {
  return getRemoteCoopSlots(localSlot)[0] ?? (coopSession?.localSlot ?? "P1");
}
