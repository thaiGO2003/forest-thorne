import { UNIT_BY_ID } from "../data/unitCatalog.js";
import {
  clearCollectionProfile,
  loadCollectionProfile,
  normalizeCollectionProfile,
  saveCollectionProfile
} from "./collectionProfile.js";
import {
  clearEndlessAchievementProfile,
  loadEndlessAchievementProfile,
  normalizeEndlessAchievementProfile,
  saveEndlessAchievementProfile
} from "./endlessAchievements.js";

const SAVE_KEY = "forest_throne_progress_v1";
const CURRENT_VERSION = 4; // Live roster expanded to 120 units; former archived ids remain valid in saves

// Unit replacement mapping for removed/changed units (Requirement 27.2)
const UNIT_REPLACEMENT_MAP: Record<string, string> = {
  // Map old unit IDs to equivalent new unit IDs
  // This will be populated as units are removed/changed
  // Example: "old_wolf_id": "wolf_alpha"
};

interface UnitLike {
  baseId?: unknown;
  statuses?: Record<string, unknown>;
}

interface PersistedPlayer {
  level?: unknown;
  round?: unknown;
  hp?: unknown;
  gold?: unknown;
  deployCapBonus?: unknown;
  board?: unknown;
  bench?: unknown;
  shop?: unknown;
}

interface MigrationLog {
  push(message: string): void;
}

interface PersistedPayload {
  player?: PersistedPlayer;
  players?: Record<string, PersistedPlayer>;
}

interface PersistedSaveData {
  version?: unknown;
  payload?: PersistedPayload;
}

interface PersistedSaveEnvelope {
  version?: unknown;
  savedAt?: unknown;
  payload?: unknown;
  achievementsProfile?: unknown;
  collectionProfile?: unknown;
}

interface SaveEnvelopeOptions {
  version?: number;
  savedAt?: number;
  achievementsProfile?: unknown;
  collectionProfile?: unknown;
  filename?: string;
}

interface ImportOptions {
  persist?: boolean;
}

interface MigrationResult {
  data: PersistedSaveData | null;
  migrationLog: string[];
}

interface DownloadResult {
  ok: boolean;
  filename?: string;
  reason?: string;
}

/**
 * Migrates legacy speed-based statuses to evasion-based statuses
 * Converts slowTurns to evadeDebuffTurns with 15% penalty
 * Converts hasteTurns to evadeBuffTurns with 10% bonus
 * **Validates: Requirement 7.1**
 */
function migrateLegacyStatuses(unit: UnitLike): boolean | undefined {
  if (!unit || !unit.statuses) return;

  let migrated = false;

  // Convert slowTurns to evadeDebuffTurns
  const slowTurns = unit.statuses.slowTurns;
  if (slowTurns !== undefined) {
    if (typeof slowTurns === "number" && slowTurns > 0) {
      unit.statuses.evadeDebuffTurns = slowTurns;
      unit.statuses.evadeBuffValue = 0.15; // 15% evasion penalty
      // (intentionally using evadeBuffValue key as written in the original logic)
      migrated = true;
    }
    delete unit.statuses.slowTurns;
  }

  // Convert hasteTurns to evadeBuffTurns
  const hasteTurns = unit.statuses.hasteTurns;
  if (hasteTurns !== undefined) {
    if (typeof hasteTurns === "number" && hasteTurns > 0) {
      unit.statuses.evadeBuffTurns = hasteTurns;
      unit.statuses.evadeBuffValue = 0.10; // 10% evasion bonus
      migrated = true;
    }
    delete unit.statuses.hasteTurns;
  }

  return migrated;
}

function resolvePlayableUnitId(baseId: unknown): string | null {
  if (typeof baseId !== "string" || !baseId.trim()) return null;
  if (UNIT_BY_ID[baseId]) return baseId;
  const replacement = UNIT_REPLACEMENT_MAP[baseId];
  if (replacement && UNIT_BY_ID[replacement]) return replacement;
  return null;
}

function describeInvalidUnitReason(baseId: unknown): string {
  return `Removed invalid unit ${String(baseId)}`;
}

function sanitizeBoardUnits(board: unknown, migrationLog: MigrationLog): void {
  if (!Array.isArray(board)) return;

  for (let r = 0; r < board.length; r++) {
    const row = board[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const unit = row[c] as UnitLike | null;
      if (!unit || !unit.baseId) continue;

      if (migrateLegacyStatuses(unit)) {
        migrationLog.push(`Migrated legacy speed statuses for unit ${String(unit.baseId)} at board[${r}][${c}]`);
      }

      const resolvedBaseId = resolvePlayableUnitId(unit.baseId);
      if (resolvedBaseId) {
        if (resolvedBaseId !== unit.baseId) {
          migrationLog.push(`Replaced removed unit ${String(unit.baseId)} with ${resolvedBaseId} at board[${r}][${c}]`);
          unit.baseId = resolvedBaseId;
        }
        continue;
      }

      migrationLog.push(`${describeInvalidUnitReason(unit.baseId)} from board[${r}][${c}]`);
      (board[r] as unknown[])[c] = null;
    }
  }
}

function sanitizeBenchUnits(bench: unknown, migrationLog: MigrationLog): UnitLike[] {
  if (!Array.isArray(bench)) return [];

  return bench.filter((rawUnit, idx): rawUnit is UnitLike => {
    const unit = rawUnit as UnitLike | null;
    if (!unit || !unit.baseId) return false;

    if (migrateLegacyStatuses(unit)) {
      migrationLog.push(`Migrated legacy speed statuses for unit ${String(unit.baseId)} on bench[${idx}]`);
    }

    const resolvedBaseId = resolvePlayableUnitId(unit.baseId);
    if (resolvedBaseId) {
      if (resolvedBaseId !== unit.baseId) {
        migrationLog.push(`Replaced removed unit ${String(unit.baseId)} with ${resolvedBaseId} on bench[${idx}]`);
        unit.baseId = resolvedBaseId;
      }
      return true;
    }

    migrationLog.push(`${describeInvalidUnitReason(unit.baseId)} from bench[${idx}]`);
    return false;
  });
}

function sanitizeShopOffers(shop: unknown, migrationLog: MigrationLog): (UnitLike | null)[] {
  if (!Array.isArray(shop)) return [];

  return shop.map((rawOffer, idx): UnitLike | null => {
    const offer = rawOffer as UnitLike | null;
    if (!offer || !offer.baseId) return null;

    const resolvedBaseId = resolvePlayableUnitId(offer.baseId);
    if (resolvedBaseId) {
      if (resolvedBaseId !== offer.baseId) {
        migrationLog.push(`Replaced removed unit ${String(offer.baseId)} with ${resolvedBaseId} in shop[${idx}]`);
        return { ...offer, baseId: resolvedBaseId };
      }
      return offer;
    }

    migrationLog.push(`${describeInvalidUnitReason(offer.baseId)} from shop[${idx}]`);
    return null;
  });
}

function collectPayloadPlayers(payload: unknown): { key: string; player: PersistedPlayer }[] {
  if (!payload || typeof payload !== "object") return [];
  const typedPayload = payload as PersistedPayload;
  if (typedPayload.player && typeof typedPayload.player === "object") {
    return [{ key: "player", player: typedPayload.player }];
  }
  if (typedPayload.players && typeof typedPayload.players === "object") {
    return Object.entries(typedPayload.players)
      .filter(([, player]) => player && typeof player === "object")
      .map(([slot, player]) => ({ key: `players.${slot}`, player }));
  }
  return [];
}

function clampPersistedPlayer(player: PersistedPlayer | null | undefined, migrationLog: MigrationLog, playerKey = "player"): void {
  if (!player || typeof player !== "object") return;
  const levelValue = typeof player.level === "number" ? player.level : 1;
  player.level = Math.max(1, Math.min(25, levelValue));
  const roundValue = typeof player.round === "number" ? player.round : 1;
  player.round = Math.max(1, roundValue);
  const hpValue = typeof player.hp === "number" ? player.hp : 3;
  player.hp = Math.max(0, hpValue);
  const goldValue = typeof player.gold === "number" ? player.gold : 0;
  player.gold = Math.max(0, goldValue);

  const deployCapBonus = typeof player.deployCapBonus === "number" ? player.deployCapBonus : 0;
  if (deployCapBonus < 0 || deployCapBonus > 100) {
    migrationLog.push(`WARNING: Invalid deployCapBonus ${deployCapBonus} on ${playerKey}, resetting to 0`);
    player.deployCapBonus = 0;
  }
}

/**
 * Validates and migrates save data to current version
 * **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5**
 */
function migrateSaveData(data: unknown): MigrationResult {
  const migrationLog: string[] = [];

  try {
    // Handle corrupted or invalid data (Requirement 27.5)
    if (!data || typeof data !== "object") {
      migrationLog.push("ERROR: Save data is corrupted or invalid");
      return { data: null, migrationLog };
    }

    const typedData = data as PersistedSaveData;
    const version = typeof typedData.version === "number" ? typedData.version : 1;
    let payload = typedData.payload;

    // Validate payload structure (Requirement 27.5)
    if (!payload || typeof payload !== "object") {
      migrationLog.push("ERROR: Save payload is corrupted");
      return { data: null, migrationLog };
    }

    const payloadPlayers = collectPayloadPlayers(payload);
    if (!payloadPlayers.length) {
      migrationLog.push("ERROR: Player data is corrupted");
      return { data: null, migrationLog };
    }

    // Migration from version 1 to version 2 (expanded roster + level cap update)
    if (version < 2) {
      migrationLog.push("Migrating save data from version 1 to version 2");

      payloadPlayers.forEach(({ key, player }) => {
        const oldLevelRaw = player.level;
        const oldLevel = typeof oldLevelRaw === "number" ? oldLevelRaw : 1;
        if (oldLevel > 9) {
          migrationLog.push(`WARNING: Level ${oldLevel} on ${key} exceeds old cap of 9, clamping to 25`);
        }
        player.level = Math.max(1, Math.min(25, oldLevel));
      });

      migrationLog.push("Migration to version 2 complete");
    }

    if (version < 3) {
      migrationLog.push("Migrating save data from version 2 to version 3");
      migrationLog.push("Legacy archived-roster cleanup rules are no longer applied");
      migrationLog.push("Migration to version 3 complete");
    }

    if (version < 4) {
      migrationLog.push("Migrating save data from version 3 to version 4");
      migrationLog.push("Former archived roster entries are now preserved if they exist in the live catalog");
      migrationLog.push("Migration to version 4 complete");
    }

    payloadPlayers.forEach(({ key, player }) => {
      sanitizeBoardUnits(player.board, migrationLog);
      player.bench = sanitizeBenchUnits(player.bench, migrationLog);
      player.shop = sanitizeShopOffers(player.shop, migrationLog);
      clampPersistedPlayer(player, migrationLog, key);
    });

    if (version < CURRENT_VERSION) {
      typedData.version = CURRENT_VERSION;
    }

    return { data: typedData, migrationLog };
  } catch (error) {
    // Handle any unexpected errors during migration (Requirement 27.5)
    const message = error instanceof Error ? error.message : String(error);
    migrationLog.push(`ERROR: Migration failed - ${message}`);
    return { data: null, migrationLog };
  }
}

function createSaveEnvelope(payload: unknown, options: SaveEnvelopeOptions = {}): PersistedSaveEnvelope {
  return {
    version: options.version ?? CURRENT_VERSION,
    savedAt: options.savedAt ?? Date.now(),
    payload,
    achievementsProfile: normalizeEndlessAchievementProfile(
      options.achievementsProfile ?? loadEndlessAchievementProfile()
    ),
    collectionProfile: normalizeCollectionProfile(
      options.collectionProfile ?? loadCollectionProfile()
    )
  };
}

export function createProgressEnvelope(payload: unknown, options: SaveEnvelopeOptions = {}): PersistedSaveEnvelope {
  return createSaveEnvelope(payload, options);
}

function persistWrappedProgress(data: unknown): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function logMigrationMessages(migrationLog: string[]): void {
  if (migrationLog.length > 0) {
    console.log("[Save Data Migration]");
    migrationLog.forEach(msg => console.log(`  ${msg}`));
  }
}

function migrateWrappedProgress(data: unknown): PersistedSaveEnvelope | null {
  const { data: migrated, migrationLog } = migrateSaveData(data);
  logMigrationMessages(migrationLog);

  if (!migrated) {
    console.error("[Save Data Migration] Failed to migrate save data, starting new game");
    return null;
  }

  return migrated as unknown as PersistedSaveEnvelope;
}

export function normalizeProgressEnvelope(data: unknown): PersistedSaveEnvelope | null {
  return migrateWrappedProgress(data);
}

async function readFileAsText(file: File | Blob | unknown): Promise<string | null> {
  if (!file) return null;
  const candidate = file as { text?: () => Promise<string> };
  if (typeof candidate.text === "function") {
    return candidate.text();
  }

  if (typeof FileReader !== "function") {
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file as Blob);
  });
}

function triggerJsonDownload(json: string, filename: string): DownloadResult {
  if (
    typeof Blob !== "function" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof document === "undefined" ||
    typeof document.createElement !== "function"
  ) {
    return { ok: false, reason: "unsupported" };
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    if (typeof anchor.click !== "function") {
      return { ok: false, reason: "unsupported" };
    }
    anchor.click();
    return { ok: true, filename };
  } finally {
    URL.revokeObjectURL?.(url);
  }
}

export function exportProgressToJson(payload: unknown, options: SaveEnvelopeOptions = {}): string {
  return JSON.stringify(createSaveEnvelope(payload, options));
}

export function downloadProgressAsJson(payload: unknown, options: SaveEnvelopeOptions = {}): DownloadResult {
  try {
    const json = exportProgressToJson(payload, options);
    const filename = options.filename ?? "forest-throne-progress.json";
    return triggerJsonDownload(json, filename);
  } catch (_err) {
    return { ok: false, reason: "export_failed" };
  }
}

export function importProgressFromJsonString(raw: unknown, options: ImportOptions = {}): unknown {
  try {
    if (typeof raw !== "string") return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const parsedEnvelope = parsed as PersistedSaveEnvelope;

    const migrated = migrateWrappedProgress(parsed);
    if (!migrated) return null;

    if (options.persist) {
      persistWrappedProgress(migrated);
      if (parsedEnvelope.achievementsProfile) {
        saveEndlessAchievementProfile(parsedEnvelope.achievementsProfile);
      }
      if (parsedEnvelope.collectionProfile) {
        saveCollectionProfile(parsedEnvelope.collectionProfile);
      }
    }

    return migrated.payload ?? null;
  } catch (_err) {
    return null;
  }
}

export async function importProgressFromJsonFile(file: File | Blob | unknown, options: ImportOptions = {}): Promise<unknown> {
  try {
    const raw = await readFileAsText(file);
    if (typeof raw !== "string") return null;
    return importProgressFromJsonString(raw, options);
  } catch (_err) {
    return null;
  }
}

export function saveProgress(payload: unknown): boolean {
  try {
    persistWrappedProgress(createSaveEnvelope(payload));
    return true;
  } catch (_err) {
    return false;
  }
}

export function loadProgress(): unknown {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const data = migrateWrappedProgress(parsed);
    return data?.payload ?? null;
  } catch (_err) {
    // Handle corrupted save data gracefully (Requirement 27.5)
    console.error("[Save Data Migration] Error loading save data:", _err);
    return null;
  }
}

export function clearProgress(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    clearEndlessAchievementProfile();
    clearCollectionProfile();
    return true;
  } catch (_err) {
    return false;
  }
}

export function clearRunProgress(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (_err) {
    return false;
  }
}

export function clearAllLocalStorage(): boolean {
  try {
    localStorage.clear();
    return true;
  } catch (_err) {
    return false;
  }
}
