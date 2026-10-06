// Persistence (A37, A57): versioned envelope, ordered migration, Continue inspection,
// import/export, three distinct clear scopes, Co-op slot store.
import { getUnit, UNIT_BY_ID } from "../content/catalog";
import { getEquipment, normalizeEquipment, slotCapForUnit } from "./equipment";
import { normalizeVariantTraits, type VariantTraitRef } from "./variants";
import { isGameMode, modeConfig } from "./modes";
import { normalizeFortressState } from "./fortress";
import { normalizeCreativeSandboxUnits } from "./creative";
import { normalizeAiMode } from "./encounter";
import { normalizeTutorialState, TUTORIAL_END_ROUND } from "./tutorial";
import { normalizeEnemyPreview } from "./preview";
import { BASE_MATERIALS } from "./craft";
import { AUGMENT_BY_ID } from "./augments";
import { TECH_BY_ID, maxLevel } from "./tech";
import {
  normalizeAchievementProfile, normalizeCollectionProfile,
  type AchievementProfile, type CollectionProfile,
} from "./achievements";
import type { KV } from "./settings";
import type { OwnedUnit, RunState } from "./run";

export const PROGRESS_KEY = "forest_throne_progress_v1";
export const COOP_KEY = "forest_throne_coop_save_slots_v1";
export const ACHIEVEMENTS_KEY = "forest_throne_endless_achievements_v1";
export const COLLECTION_KEY = "forest_throne_collection_profile_v1";
export const ENVELOPE_VERSION = 4;
export const EXPORT_FILENAME = "forest-throne-progress.json";

export interface CoopSharedState {
  round: number;
  phase: RunState["phase"];
  enemyPreview: RunState["enemyPreview"];
  enemyPreviewRound: number;
  enemyBudget: number;
  [key: string]: unknown;
}

/** Solo runs store `player`; multiplayer stores `players` keyed by slot. */
export interface RunPayload {
  player?: RunState;
  players?: Record<string, RunState>;
  localSlot?: string; hostSlot?: string; roomCode?: string; playerCapacity?: number;
  aiMode?: string; selectedMode?: string;
  shared?: CoopSharedState;
}
export interface Envelope {
  version: number; savedAt: number; payload: RunPayload;
  achievementsProfile: AchievementProfile; collectionProfile: CollectionProfile;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const clampInt = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const finiteNumber = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export function createEnvelope(payload: RunPayload, extra: Partial<Envelope> = {}): Envelope {
  return {
    version: extra.version ?? ENVELOPE_VERSION,
    savedAt: extra.savedAt ?? Date.now(),
    payload,
    achievementsProfile: normalizeAchievementProfile(extra.achievementsProfile),
    collectionProfile: normalizeCollectionProfile(extra.collectionProfile),
  };
}

/** Explicit removed-id replacements; never guess by name/species (A57.2). */
export const UNIT_REPLACEMENTS: Record<string, string> = {};

function sanitizeUnit(u: unknown, log: string[]): OwnedUnit | null {
  if (!isObj(u) || typeof u.baseId !== "string" || typeof u.uid !== "string") return null;
  const id = UNIT_BY_ID.has(u.baseId) ? u.baseId : UNIT_REPLACEMENTS[u.baseId];
  if (!id || !UNIT_BY_ID.has(id)) { log.push(`drop unknown unit ${u.baseId}`); return null; }
  if (id !== u.baseId) log.push(`replace ${u.baseId} → ${id}`);
  const def = getUnit(id);
  const star = clampInt(u.star, 1, 3, 1) as 1 | 2 | 3;
  const rawEquips = Array.isArray(u.equips) ? u.equips.filter((e): e is string => typeof e === "string") : [];
  const equipment = normalizeEquipment(rawEquips, star, slotCapForUnit(def, star));
  if (equipment.rejected.length) log.push(`normalize equipment ${u.uid}: dropped ${equipment.rejected.length}`);
  const rawTraits: VariantTraitRef[] = Array.isArray(u.traits)
    ? u.traits.flatMap((v) => isObj(v) && typeof v.id === "string" ? [{ id: v.id, seed: Number(v.seed) }] : [])
    : [];
  const traits = normalizeVariantTraits(def.role, rawTraits);
  if (traits.length !== rawTraits.length) log.push(`normalize traits ${u.uid}: dropped ${rawTraits.length - traits.length}`);
  return {
    uid: u.uid, baseId: id, star: clampInt(u.star, 1, 3, 1) as 1 | 2 | 3,
    equips: equipment.kept, traits,
  };
}

/** Clamp numeric ranges without truncating legal progression (A37). Mutates and returns p. */
function sanitizePlayer(p: RunState, log: string[]): RunState {
  const legacy = p as RunState & { deployBonus?: unknown };
  p.phase = p.phase === "AUGMENT" || p.phase === "COMBAT" || p.phase === "GAME_OVER" ? p.phase : "PLANNING";
  p.mode = isGameMode(p.mode) ? p.mode : "EndlessPvEClassic";
  const cfg = modeConfig(p.mode);
  const normalizedAi = normalizeAiMode(p.aiMode, cfg.ai.def);
  p.aiMode = cfg.ai.allowed.includes(normalizedAi) ? normalizedAi : cfg.ai.def;
  p.lossCondition = cfg.lossCondition;
  p.round = clampInt(p.round, 1, 999999, 1);
  p.tutorialSkipped = p.tutorialSkipped === true;
  p.tutorial = normalizeTutorialState(p.tutorial, p.round);
  if (p.tutorial.completed || p.tutorialSkipped || p.round > TUTORIAL_END_ROUND) {
    if (p.round > TUTORIAL_END_ROUND && !p.tutorialSkipped) p.tutorial.completed = true;
    if (p.aiMode === "TUTORIAL" && cfg.ai.allowed.includes("EASY")) p.aiMode = "EASY";
  }
  p.level = clampInt(p.level, 1, 25, 1);
  p.xp = clampInt(p.xp, 0, Number.MAX_SAFE_INTEGER, 0);
  p.gold = clampInt(p.gold, 0, Number.MAX_SAFE_INTEGER, 0);
  p.hp = clampInt(p.hp, 0, Number.MAX_SAFE_INTEGER, cfg.startHp);
  p.shopLocked = p.shopLocked === true;
  p.benchUpgradeLevel = clampInt(p.benchUpgradeLevel, 0, 4, 0);
  p.craftTableLevel = clampInt(p.craftTableLevel, 0, 3, 0);
  p.inventoryUpgradeLevel = clampInt(p.inventoryUpgradeLevel, 0, 999, 0);
  p.speedLevel = clampInt(p.speedLevel, 0, 10, 0);
  p.unequipDiscount = clampInt(p.unequipDiscount, 0, Number.MAX_SAFE_INTEGER, 0);
  const rawTech = isObj(p.techLevels) ? p.techLevels : {};
  const techLevels: Record<string, number> = {};
  for (const [id, value] of Object.entries(rawTech)) {
    const node = TECH_BY_ID.get(id);
    if (!node) continue;
    const max = maxLevel(node);
    const level = clampInt(value, 0, Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER, 0);
    if (level > 0) techLevels[id] = level;
  }
  p.techLevels = techLevels;
  p.craftHistory = Array.isArray(p.craftHistory)
    ? p.craftHistory.filter((id): id is string => typeof id === "string") : [];
  p.augments = Array.isArray(p.augments)
    ? [...new Set(p.augments.filter((id): id is string => typeof id === "string" && AUGMENT_BY_ID.has(id)))] : [];
  p.augmentMods = isObj(p.augmentMods)
    ? Object.fromEntries(Object.entries(p.augmentMods).flatMap(([key, value]) => {
      const n = Number(value);
      return Number.isFinite(n) ? [[key, n]] : [];
    }))
    : {};
  const augment = (key: string, scale = 1) => finiteNumber(p.augmentMods[key], 0) * scale;
  p.benchBonus = clampInt(p.benchBonus, 0, Number.MAX_SAFE_INTEGER, 0);
  p.deployCapBonus = finiteNumber(p.deployCapBonus, finiteNumber(legacy.deployBonus, 0));
  if (p.deployCapBonus < 0 || p.deployCapBonus > 100) {
    log.push(`reset invalid deployCapBonus ${p.deployCapBonus}`);
    p.deployCapBonus = 0;
  }
  p.deployCapBonus = Math.round(p.deployCapBonus);
  p.xpCostDelta = finiteNumber(p.xpCostDelta, 0);
  p.rollCostDelta = finiteNumber(p.rollCostDelta, 0);
  p.interestCapBonus = finiteNumber(p.interestCapBonus, augment("interest_cap"));
  p.interestRateBonus = finiteNumber(p.interestRateBonus, augment("interest_rate_bonus"));
  p.startingRage = finiteNumber(p.startingRage, augment("starting_rage"));
  p.startingShield = finiteNumber(p.startingShield, augment("starting_shield"));
  p.teamAtkPct = finiteNumber(p.teamAtkPct, augment("team_atk_pct", 100));
  p.teamMatkPct = finiteNumber(p.teamMatkPct, augment("team_matk_pct", 100));
  p.teamDefPct = finiteNumber(p.teamDefPct, augment("team_def_pct", 100));
  p.teamMdefPct = finiteNumber(p.teamMdefPct, augment("team_mdef_pct", 100));
  p.teamHpPct = finiteNumber(p.teamHpPct, augment("team_hp_pct", 100));
  p.teamCritPct = finiteNumber(p.teamCritPct, augment("team_crit_pct", 100));
  p.lifestealPct = finiteNumber(p.lifestealPct, augment("lifesteal_pct", 100));
  p.hpLossReductionPct = finiteNumber(p.hpLossReductionPct, augment("hp_loss_reduction_pct", 100));
  p.rageGainPct = finiteNumber(p.rageGainPct, augment("rage_gain_pct", 100));
  p.extraClassCount = clampInt(p.extraClassCount, 0, Number.MAX_SAFE_INTEGER, Math.round(augment("extra_class_count")));
  p.extraTribeCount = clampInt(p.extraTribeCount, 0, Number.MAX_SAFE_INTEGER, Math.round(augment("extra_tribe_count")));
  p.inventoryBonus = clampInt(p.inventoryBonus, 0, Number.MAX_SAFE_INTEGER, Math.round(augment("inventory_bonus")));
  p.fixedIncome = finiteNumber(p.fixedIncome, augment("fixed_income"));
  p.winGoldBonus = finiteNumber(p.winGoldBonus, augment("win_gold_bonus"));
  delete legacy.deployBonus;
  p.winStreak = clampInt(p.winStreak, 0, Number.MAX_SAFE_INTEGER, 0);
  p.loseStreak = clampInt(p.loseStreak, 0, Number.MAX_SAFE_INTEGER, 0);
  p.rngSeed = Number.isFinite(Number(p.rngSeed)) ? Number(p.rngSeed) | 0 : 1;
  const validBagItem = (id: string) => (BASE_MATERIALS as readonly string[]).includes(id) || getEquipment(id) !== null;
  p.itemBag = Array.isArray(p.itemBag)
    ? p.itemBag.filter((id): id is string => typeof id === "string" && validBagItem(id)) : [];
  p.board = Array.isArray(p.board) ? p.board.map((u) => (u ? sanitizeUnit(u, log) : null)) : [];
  p.board = p.board.slice(0, 25);
  while (p.board.length < 25) p.board.push(null);
  p.bench = Array.isArray(p.bench) ? p.bench.map((u) => sanitizeUnit(u, log)).filter((u): u is OwnedUnit => !!u) : [];
  p.shop = Array.isArray(p.shop) ? p.shop.map((id) => (typeof id === "string" && UNIT_BY_ID.has(id) ? id : null)) : [];
  const savedShopLength = Math.min(20, Math.max(5, p.shop.length));
  p.shopSlotCount = clampInt(p.shopSlotCount, savedShopLength, 20, savedShopLength);
  p.shop = p.shop.slice(0, p.shopSlotCount);
  while (p.shop.length < p.shopSlotCount) p.shop.push(null);
  p.enemyPreview = normalizeEnemyPreview(p.enemyPreview);
  p.enemyPreviewRound = clampInt(p.enemyPreviewRound, 0, Number.MAX_SAFE_INTEGER, 0);
  p.enemyBudget = clampInt(p.enemyBudget, 0, Number.MAX_SAFE_INTEGER, 0);
  p.augmentRoundsTaken = Array.isArray(p.augmentRoundsTaken)
    ? [...new Set(p.augmentRoundsTaken.map((v) => clampInt(v, 1, 9999, 1)))] : [];
  p.activeAugmentChoices = Array.isArray(p.activeAugmentChoices)
    ? [...new Set(p.activeAugmentChoices.filter((v): v is string =>
      typeof v === "string" && AUGMENT_BY_ID.has(v) && !p.augments.includes(v)))] : [];
  if (p.phase === "AUGMENT" && p.activeAugmentChoices.length === 0) p.phase = "PLANNING";
  p.appliedCombats = Array.isArray(p.appliedCombats)
    ? [...new Set(p.appliedCombats.filter((v): v is string => typeof v === "string"))] : [];
  p.incomeRoundsPaid = Array.isArray(p.incomeRoundsPaid)
    ? [...new Set(p.incomeRoundsPaid.map((v) => clampInt(v, 1, 9999, 1)))] : [1];
  p.fortress = normalizeFortressState(p.fortress, p.rngSeed);
  p.creativeSandboxUnits = normalizeCreativeSandboxUnits(p.creativeSandboxUnits);
  const allUids = [
    ...p.bench.map((unit) => unit.uid),
    ...p.board.flatMap((unit) => unit ? [unit.uid] : []),
    ...p.creativeSandboxUnits.map((unit) => unit.uid),
  ];
  const highestGeneratedUid = allUids.reduce((max, uid) => {
    const match = /^u(\d+)$/.exec(uid);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  p.nextUid = Math.max(highestGeneratedUid + 1, clampInt(p.nextUid, 1, Number.MAX_SAFE_INTEGER, 1));
  return p;
}

const playersOf = (pl: RunPayload): RunState[] =>
  [pl.player, ...Object.values(pl.players ?? {})].filter((p): p is RunState => isObj(p));
function normalizeCoopSharedState(payload: RunPayload): void {
  if (!payload.players || Object.keys(payload.players).length === 0) return;
  const source = (payload.hostSlot && payload.players[payload.hostSlot])
    || (payload.localSlot && payload.players[payload.localSlot])
    || Object.values(payload.players)[0];
  if (!source) return;
  const raw: Record<string, unknown> = isObj(payload.shared) ? payload.shared : {};
  const phase = raw.phase === "AUGMENT" || raw.phase === "COMBAT" || raw.phase === "GAME_OVER"
    ? raw.phase
    : "PLANNING";
  const shared: CoopSharedState = {
    ...raw,
    round: clampInt(raw.round, 1, Number.MAX_SAFE_INTEGER, source.round),
    phase: raw.phase === undefined ? source.phase : phase,
    enemyPreview: normalizeEnemyPreview(raw.enemyPreview === undefined ? source.enemyPreview : raw.enemyPreview),
    enemyPreviewRound: clampInt(raw.enemyPreviewRound, 0, Number.MAX_SAFE_INTEGER, source.enemyPreviewRound),
    enemyBudget: clampInt(raw.enemyBudget, 0, Number.MAX_SAFE_INTEGER, source.enemyBudget),
  };
  payload.shared = shared;
  for (const player of Object.values(payload.players)) {
    player.round = shared.round;
    player.phase = shared.phase;
    player.enemyPreview = structuredClone(shared.enemyPreview);
    player.enemyPreviewRound = shared.enemyPreviewRound;
    player.enemyBudget = shared.enemyBudget;
  }
}


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
    normalizeCoopSharedState(payload);
    const changed = from < ENVELOPE_VERSION || JSON.stringify(payload) !== before;
    const envelope = createEnvelope(payload, {
      version: Math.max(from, ENVELOPE_VERSION),
      savedAt: typeof raw.savedAt === "number" ? raw.savedAt : Date.now(),
      achievementsProfile: normalizeAchievementProfile(raw.achievementsProfile),
      collectionProfile: normalizeCollectionProfile(raw.collectionProfile),
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
    achievementsProfile: loadAchievementProfile(store),
    collectionProfile: loadCollectionProfile(store),
  });
  store.setItem(PROGRESS_KEY, JSON.stringify(env));
  return env;
}

function readStoredJson(store: KV, key: string): unknown {
  try {
    return JSON.parse(store.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function loadAchievementProfile(store: KV): AchievementProfile {
  return normalizeAchievementProfile(readStoredJson(store, ACHIEVEMENTS_KEY));
}

export function saveAchievementProfile(store: KV, value: unknown): AchievementProfile {
  const normalized = normalizeAchievementProfile(value);
  store.setItem(ACHIEVEMENTS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearAchievementProfile(store: KV): void {
  store.removeItem(ACHIEVEMENTS_KEY);
}

export function loadCollectionProfile(store: KV): CollectionProfile {
  return normalizeCollectionProfile(readStoredJson(store, COLLECTION_KEY));
}

export function saveCollectionProfile(store: KV, value: unknown): CollectionProfile {
  const normalized = normalizeCollectionProfile(value);
  store.setItem(COLLECTION_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearCollectionProfile(store: KV): void {
  store.removeItem(COLLECTION_KEY);
}

export type { KV } from "./settings";
export const exportProgress = (env: Envelope) => JSON.stringify(env, null, 2);

/** A57.4: same migration path as Continue; `persist=false` never writes. */
export function importProgress(store: KV, text: string, persist: boolean): RunPayload | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const m = migrate(raw);
  if (!m) return null;
  if (persist) {
    store.setItem(PROGRESS_KEY, JSON.stringify(m.envelope));
    if (isObj(raw) && isObj(raw.achievementsProfile)) saveAchievementProfile(store, m.envelope.achievementsProfile);
    if (isObj(raw) && isObj(raw.collectionProfile)) saveCollectionProfile(store, m.envelope.collectionProfile);
  }
  return m.envelope.payload;
}
export const exportSaveJson = exportProgress;
export const importSaveJson = importProgress;

// A57.5 — three intentionally different scopes.
export const clearRunProgress = (store: KV) => store.removeItem(PROGRESS_KEY);
export function clearProgress(store: KV) {
  store.removeItem(PROGRESS_KEY);
  clearAchievementProfile(store);
  clearCollectionProfile(store);
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

const COOP_PLAYER_SLOTS = ["P1", "P2", "P3", "P4"] as const;
const coopCapacity = (aiMode: string) => (aiMode.startsWith("COOP4_") ? 4 : 2);
const allowedCoopSlots = (aiMode: string) => COOP_PLAYER_SLOTS.slice(0, coopCapacity(aiMode));

function normalizeCoopLocalSlot(payload: RunPayload): string {
  const allowed = allowedCoopSlots(payload.aiMode ?? "COOP_MEDIUM");
  if (payload.localSlot && allowed.some((slot) => slot === payload.localSlot)) return payload.localSlot;
  return allowed.find((slot) => payload.players?.[slot]) ?? allowed[0]!;
}

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
  const localSlot = normalizeCoopLocalSlot(p);
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
  const canonical = structuredClone(payload);
  normalizeCoopSharedState(canonical);
  const entry: CoopEntry = { slotId, savedAt: Date.now(), envelope: createEnvelope(canonical) };
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
  const allowed = allowedCoopSlots(p.aiMode ?? "COOP_MEDIUM");
  const from = normalizeCoopLocalSlot(p);
  const target = allowed.some((slot) => slot === desiredLocal) && players[desiredLocal]
    ? desiredLocal
    : from;
  if (Object.keys(players).length === 2 && target !== from && players[from] && players[target]) {
    [players[from], players[target]] = [players[target]!, players[from]!];
  }
  p.localSlot = target;
  p.hostSlot = target;
  if (roomCode) p.roomCode = roomCode;
  p.playerCapacity = allowed.length;
  return p;
}
