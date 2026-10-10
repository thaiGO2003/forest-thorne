// User mod registry/profile runtime (A28/A50). Intentionally presentation-free.

export const MOD_INDEX_SCHEMA_VERSION = 1 as const;
export const MOD_PROFILE_SCHEMA_VERSION = 1 as const;
export const MOD_PROFILE_KEY = "forest-throne.mods.profile.v1";
export const DEFAULT_MOD_INDEX_URL = "mods/index.json";

export const MOD_PACKAGE_TYPES = [".ftunit", ".ftlogic", ".ftmodpack"] as const;
export type ModPackageType = (typeof MOD_PACKAGE_TYPES)[number];
export type ModSource = "bundled" | "local" | "workshop";

export interface ModManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  source: ModSource;
  packageType: ModPackageType;
  entry?: string;
  workshopId?: string;
  requires: string[];
  conflicts: string[];
  tags: string[];
}

export interface WorkshopCapability {
  status: "placeholder" | "available";
  appId: string | null;
}

export interface ModIndex {
  schemaVersion: typeof MOD_INDEX_SCHEMA_VERSION;
  mods: ModManifest[];
  workshop: WorkshopCapability;
}

export interface ModProfile {
  schemaVersion: typeof MOD_PROFILE_SCHEMA_VERSION;
  enabledIds: string[];
  loadOrder: string[];
}

export type ModStorage = Pick<Storage, "getItem" | "setItem">;

export interface ModFetchResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type ModFetch = (
  input: string,
  init: { cache: "no-store" },
) => Promise<ModFetchResponse>;

export type ModValidationIssue =
  | { kind: "unknown-enabled-mod"; modId: string }
  | { kind: "missing-dependency"; modId: string; dependencyId: string }
  | { kind: "conflict"; modId: string; conflictId: string };

export type ModRegistryWarning =
  | { kind: "fetch-unavailable"; message: string }
  | { kind: "fetch-failed"; message: string }
  | { kind: "http-error"; message: string }
  | { kind: "invalid-index"; message: string }
  | { kind: "invalid-manifest"; index: number; message: string };

export interface ModIndexLoadResult {
  index: ModIndex;
  warnings: ModRegistryWarning[];
}
export type LocalModImportResult =
  | { ok: true; manifest: ModManifest }
  | { ok: false; error: string };


export interface ModManager {
  getIndex(): ModIndex;
  getProfile(): ModProfile;
  getRegistryWarnings(): ModRegistryWarning[];
  isEnabled(id: string): boolean;
  enable(id: string): ModProfile;
  disable(id: string): ModProfile;
  move(id: string, direction: -1 | 1): ModProfile;
  validateEnabled(): ModValidationIssue[];
  importLocal(filename: string, payload: unknown): LocalModImportResult;
}

const EMPTY_WORKSHOP: WorkshopCapability = { status: "placeholder", appId: null };

function emptyIndex(): ModIndex {
  return { schemaVersion: MOD_INDEX_SCHEMA_VERSION, mods: [], workshop: { ...EMPTY_WORKSHOP } };
}

function emptyProfile(): ModProfile {
  return { schemaVersion: MOD_PROFILE_SCHEMA_VERSION, enabledIds: [], loadOrder: [] };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function trimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result.length > 0 ? result : undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const value = trimmed(item);
    return value === undefined ? [] : [value];
  });
}

function uniqueStringList(value: unknown): string[] {
  const seen = new Set<string>();
  return stringList(value).filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

export function normalizeModManifest(value: unknown): ModManifest | null {
  const raw = record(value);
  if (!raw) return null;
  const id = trimmed(raw.id);
  const name = trimmed(raw.name);
  if (!id || !name) return null;

  const version = trimmed(raw.version) ?? "0.0.0";
  const author = trimmed(raw.author) ?? "Unknown";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const source: ModSource = raw.source === "local" || raw.source === "workshop" || raw.source === "bundled"
    ? raw.source
    : "bundled";
  const packageType: ModPackageType = MOD_PACKAGE_TYPES.includes(raw.packageType as ModPackageType)
    ? raw.packageType as ModPackageType
    : ".ftmodpack";
  const entry = trimmed(raw.entry);
  const workshopId = trimmed(raw.workshopId);

  return {
    id,
    name,
    version,
    description,
    author,
    source,
    packageType,
    ...(entry === undefined ? {} : { entry }),
    ...(workshopId === undefined ? {} : { workshopId }),
    requires: stringList(raw.requires),
    conflicts: stringList(raw.conflicts),
    tags: stringList(raw.tags),
  };
}
function packageTypeFromFilename(filename: string): ModPackageType | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = filename.slice(dot) as ModPackageType;
  return MOD_PACKAGE_TYPES.includes(extension) ? extension : null;
}

function validOptionalString(raw: Record<string, unknown>, key: string): boolean {
  return raw[key] === undefined || typeof raw[key] === "string";
}

function validOptionalStringList(raw: Record<string, unknown>, key: string): boolean {
  const value = raw[key];
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

export function parseLocalModManifest(filename: string, payload: unknown): LocalModImportResult {
  const packageType = packageTypeFromFilename(filename);
  if (!packageType) {
    return { ok: false, error: `Unsupported mod package extension for ${filename}.` };
  }

  const raw = record(payload);
  if (!raw || !trimmed(raw.id) || !trimmed(raw.name)) {
    return { ok: false, error: "Local mod manifest must contain non-empty id and name fields." };
  }
  if (raw.packageType !== undefined && raw.packageType !== packageType) {
    return { ok: false, error: `Manifest packageType must match ${packageType}.` };
  }
  for (const key of ["version", "description", "author", "entry", "workshopId"] as const) {
    if (!validOptionalString(raw, key)) return { ok: false, error: `Manifest field ${key} must be a string.` };
  }
  for (const key of ["requires", "conflicts", "tags"] as const) {
    if (!validOptionalStringList(raw, key)) return { ok: false, error: `Manifest field ${key} must be an array of strings.` };
  }

  const manifest = normalizeModManifest({ ...raw, source: "local", packageType });
  if (!manifest) return { ok: false, error: "Local mod manifest is invalid." };
  return { ok: true, manifest };
}


function normalizeWorkshop(value: unknown): WorkshopCapability {
  const raw = record(value);
  if (!raw) return { ...EMPTY_WORKSHOP };
  return {
    status: raw.status === "available" ? "available" : "placeholder",
    appId: trimmed(raw.appId) ?? null,
  };
}

/** Invalid index envelopes normalize to an empty, usable registry rather than throwing. */
export function normalizeModIndex(value: unknown): ModIndex {
  return inspectModIndex(value).index;
}

export function inspectModIndex(value: unknown): ModIndexLoadResult {
  const raw = record(value);
  if (!raw || raw.schemaVersion !== MOD_INDEX_SCHEMA_VERSION || !Array.isArray(raw.mods)) {
    return {
      index: emptyIndex(),
      warnings: [{ kind: "invalid-index", message: "Mod index must use schemaVersion 1 and contain a mods array." }],
    };
  }
  const warnings: ModRegistryWarning[] = [];
  const mods = raw.mods.flatMap((item, index) => {
      const manifest = normalizeModManifest(item);
      if (manifest !== null) return [manifest];
      warnings.push({ kind: "invalid-manifest", index, message: `Mod manifest at index ${index} is missing a non-empty id or name.` });
      return [];
    });
  return {
    index: {
      schemaVersion: MOD_INDEX_SCHEMA_VERSION,
      mods,
      workshop: normalizeWorkshop(raw.workshop),
    },
    warnings,
  };
}

function defaultFetch(): ModFetch | undefined {
  if (typeof globalThis.fetch !== "function") return undefined;
  return (input, init) => globalThis.fetch(input, init);
}

/** Missing fetch, HTTP errors, malformed JSON/data and thrown exceptions all resolve to an empty index. */
export async function loadModIndex(
  fetchImpl: ModFetch | null | undefined = defaultFetch(),
  url = DEFAULT_MOD_INDEX_URL,
): Promise<ModIndex> {
  return (await loadModIndexWithWarnings(fetchImpl, url)).index;
}

export async function loadModIndexWithWarnings(
  fetchImpl: ModFetch | null | undefined = defaultFetch(),
  url = DEFAULT_MOD_INDEX_URL,
): Promise<ModIndexLoadResult> {
  if (!fetchImpl) {
    return {
      index: emptyIndex(),
      warnings: [{ kind: "fetch-unavailable", message: "Mod index fetch is unavailable; using an empty registry." }],
    };
  }
  try {
    const response = await fetchImpl(url, { cache: "no-store" });
    if (!response.ok) {
      return {
        index: emptyIndex(),
        warnings: [{ kind: "http-error", message: "Mod index request failed; using an empty registry." }],
      };
    }
    return inspectModIndex(await response.json());
  } catch {
    return {
      index: emptyIndex(),
      warnings: [{ kind: "fetch-failed", message: "Mod index could not be loaded; using an empty registry." }],
    };
  }
}

export function normalizeModProfile(value: unknown): ModProfile {
  const raw = record(value);
  if (!raw || raw.schemaVersion !== MOD_PROFILE_SCHEMA_VERSION) return emptyProfile();
  const enabledIds = uniqueStringList(raw.enabledIds);
  const loadOrder = uniqueStringList(raw.loadOrder);
  const present = new Set(loadOrder);
  for (const id of enabledIds) {
    if (!present.has(id)) {
      present.add(id);
      loadOrder.push(id);
    }
  }
  return { schemaVersion: MOD_PROFILE_SCHEMA_VERSION, enabledIds, loadOrder };
}

export function loadModProfile(storage: ModStorage): ModProfile {
  try {
    return normalizeModProfile(JSON.parse(storage.getItem(MOD_PROFILE_KEY) ?? "null"));
  } catch {
    return emptyProfile();
  }
}

function persistProfile(storage: ModStorage, profile: ModProfile): void {
  try {
    storage.setItem(MOD_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // User storage failure must not crash the running game or corrupt the in-memory profile.
  }
}

function cloneProfile(profile: ModProfile): ModProfile {
  return {
    schemaVersion: MOD_PROFILE_SCHEMA_VERSION,
    enabledIds: [...profile.enabledIds],
    loadOrder: [...profile.loadOrder],
  };
}

export function validateEnabledMods(index: ModIndex, profile: ModProfile): ModValidationIssue[] {
  const manifests = new Map<string, ModManifest>();
  for (const manifest of index.mods) if (!manifests.has(manifest.id)) manifests.set(manifest.id, manifest);
  const enabled = new Set(profile.enabledIds);
  const issues: ModValidationIssue[] = [];

  for (const modId of profile.enabledIds) {
    const manifest = manifests.get(modId);
    if (!manifest) {
      issues.push({ kind: "unknown-enabled-mod", modId });
      continue;
    }
    for (const dependencyId of manifest.requires) {
      if (!enabled.has(dependencyId)) issues.push({ kind: "missing-dependency", modId, dependencyId });
    }
    for (const conflictId of manifest.conflicts) {
      if (enabled.has(conflictId)) issues.push({ kind: "conflict", modId, conflictId });
    }
  }
  return issues;
}

export async function createModManager(
  storage: ModStorage,
  fetchImpl: ModFetch | null | undefined = defaultFetch(),
  url = DEFAULT_MOD_INDEX_URL,
): Promise<ModManager> {
  const loaded = await loadModIndexWithWarnings(fetchImpl, url);
  let index = loaded.index;
  let profile = loadModProfile(storage);

  const commit = (next: ModProfile): ModProfile => {
    profile = normalizeModProfile(next);
    persistProfile(storage, profile);
    return cloneProfile(profile);
  };

  return {
    getIndex: () => ({ ...index, mods: index.mods.map((manifest) => ({ ...manifest, requires: [...manifest.requires], conflicts: [...manifest.conflicts], tags: [...manifest.tags] })), workshop: { ...index.workshop } }),
    getProfile: () => cloneProfile(profile),
    getRegistryWarnings: () => loaded.warnings.map((warning) => ({ ...warning })),
    isEnabled: (id) => profile.enabledIds.includes(id),
    enable(id) {
      const normalizedId = trimmed(id);
      if (!normalizedId) return cloneProfile(profile);
      return commit({
        schemaVersion: MOD_PROFILE_SCHEMA_VERSION,
        enabledIds: [...profile.enabledIds.filter((existing) => existing !== normalizedId), normalizedId],
        loadOrder: [...profile.loadOrder.filter((existing) => existing !== normalizedId), normalizedId],
      });
    },
    disable(id) {
      const normalizedId = trimmed(id);
      if (!normalizedId) return cloneProfile(profile);
      return commit({
        schemaVersion: MOD_PROFILE_SCHEMA_VERSION,
        enabledIds: profile.enabledIds.filter((existing) => existing !== normalizedId),
        loadOrder: profile.loadOrder.filter((existing) => existing !== normalizedId),
      });
    },
    move(id, direction) {
      if (direction !== -1 && direction !== 1) return cloneProfile(profile);
      const normalizedId = trimmed(id);
      if (!normalizedId) return cloneProfile(profile);
      const position = profile.loadOrder.indexOf(normalizedId);
      const target = position + direction;
      if (position < 0 || target < 0 || target >= profile.loadOrder.length) return cloneProfile(profile);
      const loadOrder = [...profile.loadOrder];
      [loadOrder[position], loadOrder[target]] = [loadOrder[target]!, loadOrder[position]!];
      return commit({ ...profile, loadOrder });
    },
    importLocal(filename, payload) {
      const parsed = parseLocalModManifest(filename, payload);
      if (!parsed.ok) return parsed;
      if (index.mods.some((manifest) => manifest.id === parsed.manifest.id)) {
        return { ok: false, error: `A mod with id ${parsed.manifest.id} is already registered.` };
      }
      const manifest = {
        ...parsed.manifest,
        requires: [...parsed.manifest.requires],
        conflicts: [...parsed.manifest.conflicts],
        tags: [...parsed.manifest.tags],
      };
      index = { ...index, mods: [...index.mods, manifest] };
      return { ok: true, manifest: { ...manifest, requires: [...manifest.requires], conflicts: [...manifest.conflicts], tags: [...manifest.tags] } };
    },
    validateEnabled: () => validateEnabledMods(index, profile),
  };
}
