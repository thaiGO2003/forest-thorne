// Persistence (A37, A57): versioned envelope, ordered migration, Continue inspection,
// import/export, three distinct clear scopes, Co-op slot store.
import { UNIT_BY_ID } from "../content/catalog";
import type { KV } from "./settings";
import type { OwnedUnit, RunState } from "./run";

export const PROGRESS_KEY = "forest_throne_progress_v1";
export const COOP_KEY = "forest_throne_coop_save_slots_v1";
export const ACHIEVEMENTS_KEY = "forest_throne_achievements_v1";
export const COLLECTION_KEY = "forest_throne_collection_v1";
export const ENVELOPE_VERSION = 4;
export const EXPORT_FILENAME = "forest-throne-progress.json";

/** Solo runs store `player`; multiplayer stores `players` keyed by slot. */
export interface RunPayload {
  player?: RunState;
  players?: Record<string, RunState>;
  localSlot?: string; hostSlot?: string; roomCode?: string; playerCapacity?: number;
  aiMode?: string; selectedMode?: string;
}
export interface Envelope {
  version: number; savedAt: number; payload: RunPayload;
  achievementsProfile: Record<string, unknown>; collectionProfile: Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
// ponytail: profiles are opaque objects until the achievement/collection owners define their schemas.
const normProfile = (v: unknown) => (isObj(v) ? v : {});
const clampInt = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export function createEnvelope(payload: RunPayload, extra: Partial<Envelope> = {}): Envelope {
  return {
    version: extra.version ?? ENVELOPE_VERSION,
    savedAt: extra.savedAt ?? Date.now(),
    payload,
    achievementsProfile: normProfile(extra.achievementsProfile),
    collectionProfile: normProfile(extra.collectionProfile),
  };
}

/** Explicit removed-id replacements; never guess by name/species (A57.2). */
export const UNIT_REPLACEMENTS: Record<string, string> = {};

function sanitizeUnit(u: unknown, log: string[]): OwnedUnit | null {
  if (!isObj(u) || typeof u.baseId !== "string" || typeof u.uid !== "string") return null;
  const id = UNIT_BY_ID.has(u.baseId) ? u.baseId : UNIT_REPLACEMENTS[u.baseId];
  if (!id || !UNIT_BY_ID.has(id)) { log.push(`drop unknown unit ${u.baseId}`); return null; }
  if (id !== u.baseId) log.push(`replace ${u.baseId} → ${id}`);
  return {
    uid: u.uid, baseId: id, star: clampInt(u.star, 1, 3, 1) as 1 | 2 | 3,
    equips: Array.isArray(u.equips) ? u.equips.filter((e): e is string => typeof e === "string") : [],
  };
}

/** Clamp numeric ranges without truncating legal progression (A37). Mutates and returns p. */
function sanitizePlayer(p: RunState, log: string[]): RunState {
  p.level = clampInt(p.level, 1, 25, 1);
  p.benchUpgradeLevel = clampInt(p.benchUpgradeLevel, 0, 4, 0);
  p.craftTableLevel = clampInt(p.craftTableLevel, 0, 3, 0);
  p.board = Array.isArray(p.board) ? p.board.map((u) => (u ? sanitizeUnit(u, log) : null)) : [];
  p.bench = Array.isArray(p.bench) ? p.bench.map((u) => sanitizeUnit(u, log)).filter((u): u is OwnedUnit => !!u) : [];
  p.shop = Array.isArray(p.shop) ? p.shop.map((id) => (typeof id === "string" && UNIT_BY_ID.has(id) ? id : null)) : [];
  return p;
}

const playersOf = (pl: RunPayload): RunState[] =>
  [pl.player, ...Object.values(pl.players ?? {})].filter((p): p is RunState => isObj(p));

export interface MigrateResult { envelope: Envelope; changed: boolean; log: string[] }

/** Fail-closed: returns null for any invalid shape or migration exception. */
export function migrate(raw: unknown): MigrateResult | null {
  try {
    if (!isObj(raw) || !isObj(raw.payload)) return null;
    const payload = structuredClone(raw.payload) as RunPayload;
    const hasPlayer = isObj(payload.player);
    const hasPlayers = isObj(payload.players) && Object.values(payload.players).every(isObj) && Object.keys(payload.players).length > 0;
    if (!hasPlayer && !hasPlayers) return null;
    const from = typeof raw.version === "number" ? raw.version : 1;
    const log: string[] = [];
    // v1→v2: level into 1..25 (old >9 allowed, clamped to 25). v2→v3: legacy archived-roster cleanup is NOT applied.
    // v3→v4: archived ids kept when present in the live catalog — handled by sanitizeUnit below.
    if (from < 2) for (const p of playersOf(payload)) p.level = clampInt(p.level, 1, 25, 1);
    const before = JSON.stringify(payload);
    for (const p of playersOf(payload)) sanitizePlayer(p, log);
    const changed = from < ENVELOPE_VERSION || JSON.stringify(payload) !== before;
    const envelope = createEnvelope(payload, {
      version: Math.max(from, ENVELOPE_VERSION),
      savedAt: typeof raw.savedAt === "number" ? raw.savedAt : Date.now(),
      achievementsProfile: raw.achievementsProfile as Record<string, unknown>,
      collectionProfile: raw.collectionProfile as Record<string, unknown>,
    });
    return { envelope, changed, log };
  } catch {
    return null;
  }
}

export type ContinueState =
  | { status: "empty" }
  | { status: "malformed_json" }
  | { status: "invalid_envelope" }
  | { status: "valid"; envelope: Envelope; log: string[] };

/** A57.3 inspection; persists the normalized envelope once if migration changed it. */
export function inspectSave(store: KV): ContinueState {
  const text = store.getItem(PROGRESS_KEY);
  if (text == null) return { status: "empty" };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { status: "malformed_json" }; }
  const m = migrate(raw);
  if (!m) return { status: "invalid_envelope" };
  if (m.changed) store.setItem(PROGRESS_KEY, JSON.stringify(m.envelope));
  return { status: "valid", envelope: m.envelope, log: m.log };
}

export function saveRun(store: KV, payload: RunPayload): Envelope {
  const env = createEnvelope(structuredClone(payload), {
    achievementsProfile: readJson(store, ACHIEVEMENTS_KEY), collectionProfile: readJson(store, COLLECTION_KEY),
  });
  store.setItem(PROGRESS_KEY, JSON.stringify(env));
  return env;
}

function readJson(store: KV, key: string): Record<string, unknown> {
  try { return normProfile(JSON.parse(store.getItem(key) ?? "null")); } catch { return {}; }
}

export const exportProgress = (env: Envelope) => JSON.stringify(env, null, 2);

/** A57.4: same migration path as Continue; `persist=false` never writes. */
export function importProgress(store: KV, text: string, persist: boolean): RunPayload | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const m = migrate(raw);
  if (!m) return null;
  if (persist) {
    store.setItem(PROGRESS_KEY, JSON.stringify(m.envelope));
    if (isObj(raw) && isObj(raw.achievementsProfile)) store.setItem(ACHIEVEMENTS_KEY, JSON.stringify(m.envelope.achievementsProfile));
    if (isObj(raw) && isObj(raw.collectionProfile)) store.setItem(COLLECTION_KEY, JSON.stringify(m.envelope.collectionProfile));
  }
  return m.envelope.payload;
}

// A57.5 — three intentionally different scopes.
export const clearRunProgress = (store: KV) => store.removeItem(PROGRESS_KEY);
export function clearProgress(store: KV) {
  store.removeItem(PROGRESS_KEY);
  store.removeItem(ACHIEVEMENTS_KEY);
  store.removeItem(COLLECTION_KEY);
}
export const clearAllLocalStorage = (store: Pick<Storage, "clear">) => store.clear();

// A57.6 Co-op slot store. NEW is a selection command, not a storage slot.
export const COOP_STORE_VERSION = 1;
export const COOP_SLOTS = ["AUTO", "SAVE_1", "SAVE_2", "SAVE_3"] as const;
export type CoopSlot = (typeof COOP_SLOTS)[number];
export type CoopSelectId = "NEW" | CoopSlot;
export interface CoopEntry { slotId: CoopSlot; savedAt: number; envelope: Envelope }
export interface CoopSummary {
  slotId: CoopSlot; savedAt: number; round: number; hearts: number;
  aiMode: string; selectedMode: string; playerCapacity: number; localSlot: string;
}
interface CoopStore { version: number; slots: Partial<Record<CoopSlot, CoopEntry>> }

/** Co-op AI mode → player capacity. ponytail: COOP4_* = 4 seats, every other co-op mode = 2. */
const coopCapacity = (aiMode: string) => (aiMode.startsWith("COOP4_") ? 4 : 2);

function normEntry(slotId: CoopSlot, v: unknown): CoopEntry | null {
  if (!isObj(v)) return null;
  const m = migrate(v.envelope);
  if (!m || !isObj(m.envelope.payload.players)) return null;
  return { slotId, savedAt: typeof v.savedAt === "number" ? v.savedAt : m.envelope.savedAt, envelope: m.envelope };
}

export function readCoopStore(store: KV): Partial<Record<CoopSlot, CoopEntry>> {
  let raw: unknown;
  try { raw = JSON.parse(store.getItem(COOP_KEY) ?? "null"); } catch { return {}; }
  const slots = isObj(raw) && isObj(raw.slots) ? raw.slots : {};
  const out: Partial<Record<CoopSlot, CoopEntry>> = {};
  for (const id of COOP_SLOTS) { const e = normEntry(id, slots[id]); if (e) out[id] = e; }
  return out;
}

export function coopSummary(e: CoopEntry): CoopSummary {
  const p = e.envelope.payload;
  const aiMode = p.aiMode ?? "COOP_MEDIUM";
  const localSlot = p.localSlot ?? Object.keys(p.players ?? {})[0] ?? "P1";
  const local = p.players?.[localSlot];
  return {
    slotId: e.slotId, savedAt: e.savedAt,
    round: Math.max(1, Math.round(Number(local?.round) || 1)),
    hearts: Math.max(0, Math.floor(Number(local?.hp) || 0)),
    aiMode, selectedMode: p.selectedMode ?? "EndlessPvEClassic",
    playerCapacity: coopCapacity(aiMode), localSlot,
  };
}

export function saveCoopSlot(store: KV, slotId: CoopSlot, payload: RunPayload): CoopEntry {
  if (!isObj(payload.players) || !Object.keys(payload.players).length) throw new Error("co-op save requires players state");
  const slots = readCoopStore(store);
  const entry: CoopEntry = { slotId, savedAt: Date.now(), envelope: createEnvelope(structuredClone(payload)) };
  slots[slotId] = entry;
  const doc: CoopStore = { version: COOP_STORE_VERSION, slots };
  store.setItem(COOP_KEY, JSON.stringify(doc));
  return entry;
}

export type CoopSelection =
  | { mode: "new"; activeSlot: CoopSlot }
  | { mode: "resume"; activeSlot: CoopSlot; payload: RunPayload; summary: CoopSummary };

export function selectCoopSlot(store: KV, id: CoopSelectId): CoopSelection {
  if (id === "NEW") return { mode: "new", activeSlot: "AUTO" };
  const e = readCoopStore(store)[id];
  return e ? { mode: "resume", activeSlot: id, payload: e.envelope.payload, summary: coopSummary(e) } : { mode: "new", activeSlot: id };
}

/** Host remap: when the desired local slot differs, swap player payloads so local state follows the host. */
export function remapCoopHost(payload: RunPayload, desiredLocal: string, roomCode?: string): RunPayload {
  const p = structuredClone(payload);
  const players = p.players ?? {};
  const slots = Object.keys(players);
  const target = slots.includes(desiredLocal) ? desiredLocal : (p.localSlot ?? slots[0]!);
  const from = p.localSlot ?? slots[0]!;
  if (slots.length === 2 && target !== from) [players[from], players[target]] = [players[target]!, players[from]!];
  p.localSlot = target;
  p.hostSlot = target;
  if (roomCode) p.roomCode = roomCode;
  p.playerCapacity = coopCapacity(p.aiMode ?? "COOP_MEDIUM");
  return p;
}
