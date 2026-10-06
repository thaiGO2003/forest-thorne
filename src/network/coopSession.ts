// In-memory co-op session authority (mega prompt A47.6). Pure state; no rendering.
import {
  COOP_SESSION_TYPE,
  coopSlotFromIndex,
  coopSlotIndex,
  coopSlotsForCapacity,
  normalizeCoopCapacity,
  normalizeCoopSlot,
  type CoopSlot,
} from "./coopConfig";

export interface CoopPlayerState {
  slot: CoopSlot;
  slotIndex: number;
  playerId: string;
  connected: boolean;
  ready: boolean;
}

export interface CoopSessionState {
  client: unknown;
  roomCode: string;
  sharedSeed: number | null;
  playerId: string;
  playerCapacity: number;
  localSlot: CoopSlot;
  hostSlot: CoopSlot;
  aiMode: string;
  selectedMode: string;
  readyBySlot: Record<string, boolean>;
  players: Record<string, CoopPlayerState>;
  currentCombatPayload: unknown | null;
  roomPlayers: Record<string, unknown>;
  sessionType: typeof COOP_SESSION_TYPE | "pvp_fortress";
  pvpState: Record<string, unknown>;
  activeSaveSlotId: string;
  saveMode: string;
  resumeSummary: unknown | null;
  resumeState: unknown | null;
  coopCombatSnapshot: unknown | null;
  coopCombatDelta: unknown | null;
  coopCombatHeartbeat: unknown | null;
  combatSnapshotsBySlot: Record<string, unknown>;
  planningLaunchRequested: boolean;
}

export type CoopSessionPatch = Omit<Partial<CoopSessionState>, "readyBySlot" | "players"> & {
  readyBySlot?: Record<string, boolean>;
  players?: Record<string, Partial<CoopPlayerState>>;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const cloneValue = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

function capacityFromContext(patch: CoopSessionPatch, fallback: number): number {
  if (patch.playerCapacity !== undefined) return normalizeCoopCapacity(patch.playerCapacity, fallback);
  const hints = [patch.selectedMode, patch.aiMode].filter((value): value is string => typeof value === "string");
  for (const hint of hints) {
    const direct = hint.match(/(?:COOP|PVP|FORTRESS)[^0-9]*([234])/i) ?? hint.match(/([234])\s*P/i);
    if (direct?.[1]) return normalizeCoopCapacity(Number(direct[1]), fallback);
  }
  return normalizeCoopCapacity(fallback);
}

function normalizeSlotForCapacity(value: unknown, capacity: number, fallback: CoopSlot): CoopSlot {
  const legal = coopSlotsForCapacity(capacity);
  const candidate = normalizeCoopSlot(value, fallback);
  return legal.includes(candidate) ? candidate : legal.includes(fallback) ? fallback : legal[0] ?? "P1";
}

function defaultPlayer(slot: CoopSlot, ready = false): CoopPlayerState {
  return {
    slot,
    slotIndex: coopSlotIndex(slot),
    playerId: "",
    connected: false,
    ready,
  };
}

function rebuildMaps(
  capacity: number,
  readyInput: Record<string, boolean> | undefined,
  playerInput: Record<string, Partial<CoopPlayerState>> | undefined,
): Pick<CoopSessionState, "readyBySlot" | "players"> {
  const readyBySlot: Record<string, boolean> = {};
  const players: Record<string, CoopPlayerState> = {};
  for (const slot of coopSlotsForCapacity(capacity)) {
    const ready = readyInput?.[slot] === true;
    readyBySlot[slot] = ready;
    const patch = playerInput?.[slot];
    players[slot] = {
      ...defaultPlayer(slot, ready),
      ...(patch ?? {}),
      slot,
      slotIndex: coopSlotIndex(slot),
      playerId: typeof patch?.playerId === "string" ? patch.playerId : "",
      connected: patch?.connected === true,
      ready,
    };
  }
  return { readyBySlot, players };
}

export function createCoopSession(patch: CoopSessionPatch = {}): CoopSessionState {
  const capacity = capacityFromContext(patch, 2);
  const localSlot = normalizeSlotForCapacity(patch.localSlot, capacity, "P1");
  const hostFallback = coopSlotFromIndex(0, "P1");
  const hostSlot = normalizeSlotForCapacity(patch.hostSlot, capacity, hostFallback);
  const maps = rebuildMaps(capacity, patch.readyBySlot, patch.players);
  return {
    client: patch.client ?? null,
    roomCode: typeof patch.roomCode === "string" ? patch.roomCode : "",
    sharedSeed: typeof patch.sharedSeed === "number" && Number.isFinite(patch.sharedSeed)
      ? Math.trunc(patch.sharedSeed)
      : null,
    playerId: typeof patch.playerId === "string" ? patch.playerId : "",
    playerCapacity: capacity,
    localSlot,
    hostSlot,
    aiMode: typeof patch.aiMode === "string" ? patch.aiMode : "COOP_MEDIUM",
    selectedMode: typeof patch.selectedMode === "string" ? patch.selectedMode : "EndlessPvEClassic",
    ...maps,
    currentCombatPayload: patch.currentCombatPayload === undefined ? null : cloneValue(patch.currentCombatPayload),
    roomPlayers: cloneValue(record(patch.roomPlayers)),
    sessionType: patch.sessionType === "pvp_fortress" ? "pvp_fortress" : COOP_SESSION_TYPE,
    pvpState: cloneValue(record(patch.pvpState)),
    activeSaveSlotId: typeof patch.activeSaveSlotId === "string" ? patch.activeSaveSlotId : "AUTO",
    saveMode: typeof patch.saveMode === "string" ? patch.saveMode : "new",
    resumeSummary: patch.resumeSummary === undefined ? null : cloneValue(patch.resumeSummary),
    resumeState: patch.resumeState === undefined ? null : cloneValue(patch.resumeState),
    coopCombatSnapshot: patch.coopCombatSnapshot === undefined ? null : cloneValue(patch.coopCombatSnapshot),
    coopCombatDelta: patch.coopCombatDelta === undefined ? null : cloneValue(patch.coopCombatDelta),
    coopCombatHeartbeat: patch.coopCombatHeartbeat === undefined ? null : cloneValue(patch.coopCombatHeartbeat),
    planningLaunchRequested: patch.planningLaunchRequested === true,
    combatSnapshotsBySlot: cloneValue(record(patch.combatSnapshotsBySlot)),
  };
}

export function updateCoopSession(current: CoopSessionState | null, patch: CoopSessionPatch): CoopSessionState {
  if (!current) return createCoopSession(patch);
  const capacity = capacityFromContext(patch, current.playerCapacity);
  const localSlot = normalizeSlotForCapacity(patch.localSlot ?? current.localSlot, capacity, current.localSlot);
  const hostSlot = normalizeSlotForCapacity(patch.hostSlot ?? current.hostSlot, capacity, current.hostSlot);
  const mergedReady = { ...current.readyBySlot, ...(patch.readyBySlot ?? {}) };
  const mergedPlayers: Record<string, Partial<CoopPlayerState>> = {};
  for (const slot of coopSlotsForCapacity(capacity)) {
    mergedPlayers[slot] = { ...(current.players[slot] ?? {}), ...(patch.players?.[slot] ?? {}) };
  }
  const maps = rebuildMaps(capacity, mergedReady, mergedPlayers);
  const nullable = <K extends keyof CoopSessionState>(key: K): CoopSessionState[K] =>
    patch[key] === undefined ? current[key] : cloneValue(patch[key] as CoopSessionState[K]);
  return {
    ...current,
    ...patch,
    playerCapacity: capacity,
    localSlot,
    hostSlot,
    ...maps,
    roomPlayers: patch.roomPlayers === undefined
      ? cloneValue(current.roomPlayers)
      : cloneValue(record(patch.roomPlayers)),
    pvpState: patch.pvpState === undefined
      ? cloneValue(current.pvpState)
      : { ...cloneValue(current.pvpState), ...cloneValue(record(patch.pvpState)) },
    resumeSummary: nullable("resumeSummary"),
    resumeState: nullable("resumeState"),
    coopCombatSnapshot: nullable("coopCombatSnapshot"),
    coopCombatDelta: nullable("coopCombatDelta"),
    coopCombatHeartbeat: nullable("coopCombatHeartbeat"),
    currentCombatPayload: nullable("currentCombatPayload"),
    combatSnapshotsBySlot: patch.combatSnapshotsBySlot === undefined
      ? cloneValue(current.combatSnapshotsBySlot)
      : { ...cloneValue(current.combatSnapshotsBySlot), ...cloneValue(record(patch.combatSnapshotsBySlot)) },
  };
}

export function remoteCoopSlots(session: Pick<CoopSessionState, "playerCapacity" | "localSlot">): CoopSlot[] {
  const local = normalizeSlotForCapacity(session.localSlot, session.playerCapacity, "P1");
  return coopSlotsForCapacity(session.playerCapacity).filter((slot) => slot !== local);
}

export function firstRemoteCoopSlot(session: Pick<CoopSessionState, "playerCapacity" | "localSlot">): CoopSlot | null {
  return remoteCoopSlots(session)[0] ?? null;
}

export type CoopSessionSubscriber = (session: CoopSessionState | null) => void;

export class CoopSessionStore {
  private state: CoopSessionState | null = null;
  private readonly subscribers = new Set<CoopSessionSubscriber>();

  get(): CoopSessionState | null {
    return this.state;
  }

  set(next: CoopSessionState | null): CoopSessionState | null {
    this.state = next;
    this.notify();
    return this.state;
  }

  create(patch: CoopSessionPatch = {}): CoopSessionState {
    return this.set(createCoopSession(patch))!;
  }

  update(patch: CoopSessionPatch): CoopSessionState {
    return this.set(updateCoopSession(this.state, patch))!;
  }

  subscribe(subscriber: CoopSessionSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber(this.state);
  }
}

export const coopSessionStore = new CoopSessionStore();
