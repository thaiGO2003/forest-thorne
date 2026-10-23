import {
  getCoopPlayerCapacity,
  getCoopPlayerSlots,
  normalizeAiMode
} from "./aiModes.js";
import {
  createProgressEnvelope,
  normalizeProgressEnvelope
} from "./persistence.js";
import { hydrateRunState, serializeRunState } from "./runState.js";

export const COOP_SAVE_SELECTION_NEW = "NEW";
export const COOP_SAVE_SLOT_AUTO = "AUTO";
export const COOP_SAVE_SLOT_SAVE_1 = "SAVE_1";
export const COOP_SAVE_SLOT_SAVE_2 = "SAVE_2";
export const COOP_SAVE_SLOT_SAVE_3 = "SAVE_3";
export const COOP_SAVE_SLOT_IDS = Object.freeze([
  COOP_SAVE_SLOT_AUTO,
  COOP_SAVE_SLOT_SAVE_1,
  COOP_SAVE_SLOT_SAVE_2,
  COOP_SAVE_SLOT_SAVE_3
]);
export const COOP_SAVE_SELECTION_IDS = Object.freeze([
  COOP_SAVE_SELECTION_NEW,
  ...COOP_SAVE_SLOT_IDS
]);

const COOP_SAVE_STORAGE_KEY = "forest_throne_coop_save_slots_v1";
const COOP_SAVE_STORE_VERSION = 1;

export type CoopSaveSlotId =
  | typeof COOP_SAVE_SLOT_AUTO
  | typeof COOP_SAVE_SLOT_SAVE_1
  | typeof COOP_SAVE_SLOT_SAVE_2
  | typeof COOP_SAVE_SLOT_SAVE_3;

export type CoopSaveSelectionId =
  | typeof COOP_SAVE_SELECTION_NEW
  | CoopSaveSlotId;

export interface CoopSaveSummary {
  slotId: CoopSaveSlotId | null;
  savedAt: number;
  round: number;
  hearts: number;
  aiMode: string;
  selectedMode: string;
  playerCapacity: number;
  localSlot: string;
}

export interface CoopSaveStore {
  version: number;
  slots: Partial<Record<CoopSaveSlotId, unknown>>;
}

export interface CoopSaveEntry {
  slotId: CoopSaveSlotId;
  savedAt: number;
  envelope: unknown;
  payload?: unknown;
  summary: CoopSaveSummary | null;
}

export interface BuildSummaryOptions {
  slotId?: unknown;
  savedAt?: unknown;
}

export interface SaveCoopSlotOptions {
  savedAt?: unknown;
  storage?: unknown;
}

export interface RemapCoopResumeOptions {
  desiredLocalSlot?: unknown;
  desiredHostSlot?: unknown;
  roomCode?: unknown;
}

interface CoopPlayerStateView {
  round?: unknown;
  hp?: unknown;
  gameMode?: unknown;
}

interface CoopSharedStateView {
  round?: unknown;
}

interface CoopRunStateView {
  aiMode?: unknown;
  coopDifficulty?: unknown;
  audioEnabled?: unknown;
  roomCode?: unknown;
  localSlot?: unknown;
  hostSlot?: unknown;
  playerCapacity?: unknown;
  shared?: CoopSharedStateView | null;
  players?: Record<string, CoopPlayerStateView> | null;
}

interface SoloRunStateView {
  aiMode?: unknown;
  audioEnabled?: unknown;
  player?: CoopPlayerStateView | null;
}

interface UnknownRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as UnknownRecord;
}

function isStorage(value: unknown): value is Storage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { getItem?: unknown; setItem?: unknown };
  return (
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function"
  );
}

function getStorage(storage: unknown): Storage | null {
  return isStorage(storage) ? storage : null;
}

function normalizeSaveSlotId(
  slotId: unknown,
  { allowNew = false }: { allowNew?: boolean } = {}
): CoopSaveSelectionId | null {
  if (allowNew && slotId === COOP_SAVE_SELECTION_NEW) {
    return COOP_SAVE_SELECTION_NEW;
  }
  if (
    slotId === COOP_SAVE_SLOT_AUTO ||
    slotId === COOP_SAVE_SLOT_SAVE_1 ||
    slotId === COOP_SAVE_SLOT_SAVE_2 ||
    slotId === COOP_SAVE_SLOT_SAVE_3
  ) {
    return slotId;
  }
  return null;
}

function isCoopSlotId(value: unknown): value is CoopSaveSlotId {
  return (
    value === COOP_SAVE_SLOT_AUTO ||
    value === COOP_SAVE_SLOT_SAVE_1 ||
    value === COOP_SAVE_SLOT_SAVE_2 ||
    value === COOP_SAVE_SLOT_SAVE_3
  );
}

function createEmptyStore(): CoopSaveStore {
  const slots: Partial<Record<CoopSaveSlotId, unknown>> = {};
  for (const slotId of COOP_SAVE_SLOT_IDS) {
    if (isCoopSlotId(slotId)) slots[slotId] = null;
  }
  return {
    version: COOP_SAVE_STORE_VERSION,
    slots
  };
}

function readStore(storage: unknown): CoopSaveStore {
  const target = getStorage(storage);
  if (!target) return createEmptyStore();
  try {
    const raw = target.getItem(COOP_SAVE_STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed: unknown = JSON.parse(raw);
    const parsedRecord = asRecord(parsed);
    if (!parsedRecord) return createEmptyStore();
    const persistedSlots = asRecord(parsedRecord.slots) ?? {};
    const empty = createEmptyStore();
    const slots: Partial<Record<CoopSaveSlotId, unknown>> = {
      ...empty.slots
    };
    for (const slotId of COOP_SAVE_SLOT_IDS) {
      const slotValue = persistedSlots[slotId];
      if (isCoopSlotId(slotId)) {
        if (slotValue && typeof slotValue === "object") {
          slots[slotId] = slotValue;
        } else {
          slots[slotId] = null;
        }
      }
    }
    return {
      version: COOP_SAVE_STORE_VERSION,
      slots
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store: CoopSaveStore, storage: unknown): boolean {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(COOP_SAVE_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function resolveSummaryPlayer(state: CoopRunStateView) {
  const rawAiMode = typeof state?.coopDifficulty === "string"
    ? state.coopDifficulty
    : (typeof state?.aiMode === "string" ? state.aiMode : "");
  const aiMode = normalizeAiMode(rawAiMode, "COOP_MEDIUM");
  const playerSlots = getCoopPlayerSlots(aiMode);
  const fallbackSlot = playerSlots[0];
  const localSlotCandidate =
    typeof state?.localSlot === "string" ? state.localSlot : null;
  const localSlot = localSlotCandidate && playerSlots.includes(localSlotCandidate)
    ? localSlotCandidate
    : fallbackSlot;
  const players = asRecord(state?.players) ?? {};
  const fallbackPlayer = asRecord(players[fallbackSlot]);
  const localPlayer = asRecord(players[localSlot]);
  return {
    aiMode,
    localSlot,
    player: localPlayer ?? fallbackPlayer
  };
}

export function buildCoopSaveSummary(
  runState: unknown,
  options: BuildSummaryOptions = {}
): CoopSaveSummary | null {
  const hydrated = hydrateRunState(runState);
  if (!hydrated || !("players" in hydrated) || !hydrated.players) return null;
  const coopHydrated = hydrated as CoopRunStateView;
  const savedAt = Number.isFinite(options.savedAt)
    ? Math.floor(options.savedAt as number)
    : Date.now();
  const { aiMode, localSlot, player } = resolveSummaryPlayer(coopHydrated);
  const playerRecord = asRecord(player);
  const sharedRecord = asRecord(coopHydrated.shared);
  const playerRound = Number(playerRecord?.round);
  const sharedRound = Number(sharedRecord?.round);
  const roundSource = Number.isFinite(playerRound)
    ? playerRound
    : (Number.isFinite(sharedRound) ? sharedRound : 1);
  const playerHp = Number(playerRecord?.hp);
  return {
    slotId: isCoopSlotId(options.slotId) ? options.slotId : null,
    savedAt,
    round: Math.max(1, Math.floor(roundSource)),
    hearts: Math.max(0, Math.floor(Number.isFinite(playerHp) ? playerHp : 0)),
    aiMode,
    selectedMode:
      typeof playerRecord?.gameMode === "string"
        ? playerRecord.gameMode
        : "EndlessPvEClassic",
    playerCapacity: getCoopPlayerCapacity(aiMode),
    localSlot
  };
}

function normalizeStoredEntry(
  slotId: CoopSaveSlotId,
  rawEntry: unknown
): CoopSaveEntry | null {
  const entryRecord = asRecord(rawEntry);
  if (!entryRecord) return null;
  const inlineEnvelope = asRecord(entryRecord.envelope);
  const inlinePayload = asRecord(entryRecord.payload);
  const envelopeSource = inlineEnvelope
    ?? (inlinePayload
      ? createProgressEnvelope(inlinePayload, {
        savedAt: Number.isFinite(Number(entryRecord.savedAt))
          ? Math.floor(Number(entryRecord.savedAt))
          : undefined
      })
      : null);
  const envelope = normalizeProgressEnvelope(envelopeSource);
  if (!envelope || !("payload" in envelope) || !envelope.payload) return null;
  const envelopeSavedAtSource = envelope && typeof envelope === "object" && "savedAt" in envelope
    ? (envelope as { savedAt?: unknown }).savedAt
    : undefined;
  const envelopeSavedAt = Number(envelopeSavedAtSource);
  const savedAt = Number.isFinite(Number(entryRecord.savedAt))
    ? Math.floor(Number(entryRecord.savedAt))
    : (Number.isFinite(envelopeSavedAt)
      ? Math.floor(envelopeSavedAt)
      : Date.now());
  const payload = envelope.payload;
  return {
    slotId,
    savedAt,
    envelope: envelopeSource,
    payload,
    summary: buildCoopSaveSummary(payload, { slotId, savedAt })
  };
}

export function loadCoopSaveSlots(storage: unknown): Record<CoopSaveSlotId, CoopSaveEntry | null> {
  const store = readStore(storage);
  const result = {} as Record<CoopSaveSlotId, CoopSaveEntry | null>;
  for (const slotId of COOP_SAVE_SLOT_IDS) {
    const rawSlot = isCoopSlotId(slotId) ? store.slots?.[slotId] : undefined;
    if (isCoopSlotId(slotId)) {
      result[slotId] = normalizeStoredEntry(slotId, rawSlot);
    }
  }
  return result;
}
export function loadCoopSaveSlot(
  slotId: unknown,
  storage: unknown = globalThis?.localStorage
): CoopSaveEntry | null {
  const normalizedSlotId = normalizeSaveSlotId(slotId);
  if (!isCoopSlotId(normalizedSlotId)) return null;
  return loadCoopSaveSlots(storage)[normalizedSlotId] ?? null;
}

export function saveCoopSaveSlot(
  slotId: unknown,
  runState: unknown,
  options: SaveCoopSlotOptions = {}
): CoopSaveEntry | null {
  const normalizedSlotId = normalizeSaveSlotId(slotId);
  if (!isCoopSlotId(normalizedSlotId)) return null;
  const hydrated = hydrateRunState(runState);
  if (!hydrated || !("players" in hydrated) || !hydrated.players) return null;
  const payload = serializeRunState(hydrated);
  const savedAt = Number.isFinite(options.savedAt)
    ? Math.floor(options.savedAt as number)
    : Date.now();
  const store = readStore(options.storage);
  store.slots[normalizedSlotId] = {
    slotId: normalizedSlotId,
    savedAt,
    envelope: createProgressEnvelope(payload, { savedAt })
  };
  if (!writeStore(store, options.storage)) return null;
  return {
    slotId: normalizedSlotId,
    savedAt,
    envelope: createProgressEnvelope(payload, { savedAt }),
    payload,
    summary: buildCoopSaveSummary(payload, {
      slotId: normalizedSlotId,
      savedAt
    })
  };
}

export function clearCoopSaveSlot(
  slotId: unknown,
  storage: unknown = globalThis?.localStorage
): boolean {
  const normalizedSlotId = normalizeSaveSlotId(slotId);
  if (!isCoopSlotId(normalizedSlotId)) return false;
  const store = readStore(storage);
  store.slots[normalizedSlotId] = null;
  return writeStore(store, storage);
}

export function clearAllCoopSaveSlots(storage: unknown = globalThis?.localStorage): boolean {
  return writeStore(createEmptyStore(), storage);
}

export function resolveCoopSaveSelection(
  selectionId: unknown,
  storage: unknown = globalThis?.localStorage
): {
  selectionId: CoopSaveSelectionId;
  activeSaveSlotId: CoopSaveSlotId;
  saveMode: "new" | "resume";
  resumeState: unknown;
  resumeSummary: CoopSaveSummary | null;
  entry: CoopSaveEntry | null;
} {
  const normalizedSelection =
    normalizeSaveSlotId(selectionId, { allowNew: true }) ??
    COOP_SAVE_SELECTION_NEW;
  if (normalizedSelection === COOP_SAVE_SELECTION_NEW) {
    return {
      selectionId: COOP_SAVE_SELECTION_NEW,
      activeSaveSlotId: COOP_SAVE_SLOT_AUTO,
      saveMode: "new",
      resumeState: null,
      resumeSummary: null,
      entry: null
    };
  }
  const entry = loadCoopSaveSlot(normalizedSelection, storage);
  return {
    selectionId: normalizedSelection,
    activeSaveSlotId: normalizedSelection,
    saveMode: entry ? "resume" : "new",
    resumeState: entry ? entry.payload ?? null : null,
    resumeSummary: entry?.summary ?? null,
    entry
  };
}

export function remapCoopResumeStateForHost(
  runState: unknown,
  options: RemapCoopResumeOptions = {}
): unknown {
  const hydrated = hydrateRunState(runState);
  if (!hydrated || !("players" in hydrated) || !hydrated.players) return null;
  const aiMode = normalizeAiMode(
    hydrated.coopDifficulty ?? hydrated.aiMode,
    "COOP_MEDIUM"
  );
  const playerSlots: string[] = getCoopPlayerSlots(aiMode);
  const desiredLocalCandidate =
    typeof options.desiredLocalSlot === "string"
      ? options.desiredLocalSlot
      : null;
  const desiredLocalSlot = desiredLocalCandidate && playerSlots.includes(desiredLocalCandidate)
    ? desiredLocalCandidate
    : playerSlots[0];
  const desiredHostCandidate =
    typeof options.desiredHostSlot === "string"
      ? options.desiredHostSlot
      : null;
  const desiredHostSlot = desiredHostCandidate && playerSlots.includes(desiredHostCandidate)
    ? desiredHostCandidate
    : desiredLocalSlot;
  const currentLocalCandidate =
    typeof hydrated.localSlot === "string" ? hydrated.localSlot : null;
  const currentLocalSlot = currentLocalCandidate && playerSlots.includes(currentLocalCandidate)
    ? currentLocalCandidate
    : playerSlots[0];
  if (playerSlots.length === 2 && currentLocalSlot !== desiredLocalSlot) {
    const remoteCurrentSlot =
      playerSlots.find((slot) => slot !== currentLocalSlot) ?? playerSlots[1];
    const remoteDesiredSlot =
      playerSlots.find((slot) => slot !== desiredLocalSlot) ?? playerSlots[1];
    const playersRecord = (hydrated.players ?? {}) as Record<
      string,
      unknown
    >;
    hydrated.players = {
      ...playersRecord,
      [desiredLocalSlot]: playersRecord[currentLocalSlot] ?? null,
      [remoteDesiredSlot]: playersRecord[remoteCurrentSlot] ?? null
    } as typeof hydrated.players;
  }
  hydrated.localSlot = desiredLocalSlot;
  hydrated.hostSlot = desiredHostSlot;
  hydrated.roomCode =
    typeof options.roomCode === "string"
      ? options.roomCode
      : (hydrated.roomCode ?? "");
  hydrated.playerCapacity = getCoopPlayerCapacity(aiMode);
  return serializeRunState(hydrated);
}
