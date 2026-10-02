// Mod package registry/profile normalization (mega prompt A50).
import type { KV } from "../core/settings";

export const MOD_INDEX_SCHEMA_VERSION = 1 as const;
export const MOD_PROFILE_SCHEMA_VERSION = 1 as const;
export const MOD_PROFILE_KEY = "forest-throne.mods.profile.v1";
export const MOD_PACKAGE_TYPES = [".ftunit", ".ftlogic", ".ftmodpack"] as const;
export type ModPackageType = (typeof MOD_PACKAGE_TYPES)[number];
export type ModSource = "bundled" | "local" | "workshop";

export interface ModWorkshopCapability {
  status: "placeholder" | "available";
  appId: string | null;
}

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

export interface ModIndex {
  schemaVersion: typeof MOD_INDEX_SCHEMA_VERSION;
  workshop: ModWorkshopCapability;
  mods: ModManifest[];
}

export interface ModProfile {
  schemaVersion: typeof MOD_PROFILE_SCHEMA_VERSION;
  enabledIds: string[];
  loadOrder: string[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const strings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const dedupe = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

export function normalizeModManifest(value: unknown): ModManifest | null {
  const raw = record(value);
  if (!raw) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) return null;
  const source: ModSource = raw.source === "local" || raw.source === "workshop" ? raw.source : "bundled";
  const packageType = typeof raw.packageType === "string"
    && (MOD_PACKAGE_TYPES as readonly string[]).includes(raw.packageType)
    ? raw.packageType as ModPackageType
    : ".ftmodpack";
  const manifest: ModManifest = {
    id,
    name,
    version: typeof raw.version === "string" && raw.version.trim() ? raw.version.trim() : "0.0.0",
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    author: typeof raw.author === "string" && raw.author.trim() ? raw.author.trim() : "Unknown",
    source,
    packageType,
    requires: strings(raw.requires),
    conflicts: strings(raw.conflicts),
    tags: strings(raw.tags),
  };
  if (typeof raw.entry === "string" && raw.entry.trim()) manifest.entry = raw.entry.trim();
  if (typeof raw.workshopId === "string" && raw.workshopId.trim()) manifest.workshopId = raw.workshopId.trim();
  return manifest;
}

function normalizeWorkshop(value: unknown): ModWorkshopCapability {
  const raw = record(value);
  return {
    status: raw?.status === "available" ? "available" : "placeholder",
    appId: typeof raw?.appId === "string" && raw.appId.trim() ? raw.appId.trim() : null,
  };
}

export function normalizeModIndex(value: unknown): ModIndex {
  const raw = record(value);
  const mods = Array.isArray(raw?.mods)
    ? raw.mods.map(normalizeModManifest).filter((mod): mod is ModManifest => mod !== null)
    : [];
  return {
    schemaVersion: MOD_INDEX_SCHEMA_VERSION,
    workshop: normalizeWorkshop(raw?.workshop),
    mods,
  };
}

export async function loadModIndex(
  url = "/mods/index.json",
  fetcher: typeof fetch | null = typeof fetch === "function" ? fetch : null,
): Promise<ModIndex> {
  if (!fetcher) return normalizeModIndex(null);
  try {
    const response = await fetcher(url, { cache: "no-store" });
    if (!response.ok) return normalizeModIndex(null);
    return normalizeModIndex(await response.json());
  } catch {
    return normalizeModIndex(null);
  }
}

export function normalizeModProfile(value: unknown): ModProfile {
  const raw = record(value);
  const enabledIds = dedupe(strings(raw?.enabledIds));
  const loadOrder = dedupe(strings(raw?.loadOrder));
  for (const id of enabledIds) if (!loadOrder.includes(id)) loadOrder.push(id);
  return { schemaVersion: MOD_PROFILE_SCHEMA_VERSION, enabledIds, loadOrder };
}

export function loadModProfile(store?: Pick<KV, "getItem"> | null): ModProfile {
  if (!store) return normalizeModProfile(null);
  try {
    return normalizeModProfile(JSON.parse(store.getItem(MOD_PROFILE_KEY) ?? "null"));
  } catch {
    return normalizeModProfile(null);
  }
}

export function saveModProfile(profile: ModProfile, store?: Pick<KV, "setItem"> | null): ModProfile {
  const normalized = normalizeModProfile(profile);
  try {
    store?.setItem(MOD_PROFILE_KEY, JSON.stringify(normalized));
  } catch {
    // Persistence failure must not break the in-memory manager.
  }
  return normalized;
}

export function enableMod(profile: ModProfile, id: string): ModProfile {
  const normalizedId = id.trim();
  if (!normalizedId) return normalizeModProfile(profile);
  const current = normalizeModProfile(profile);
  const enabledIds = current.enabledIds.filter((value) => value !== normalizedId);
  enabledIds.push(normalizedId);
  const loadOrder = current.loadOrder.filter((value) => value !== normalizedId);
  loadOrder.push(normalizedId);
  return { schemaVersion: MOD_PROFILE_SCHEMA_VERSION, enabledIds, loadOrder };
}

export function disableMod(profile: ModProfile, id: string): ModProfile {
  const normalizedId = id.trim();
  const current = normalizeModProfile(profile);
  return {
    schemaVersion: MOD_PROFILE_SCHEMA_VERSION,
    enabledIds: current.enabledIds.filter((value) => value !== normalizedId),
    loadOrder: current.loadOrder.filter((value) => value !== normalizedId),
  };
}

export function moveMod(profile: ModProfile, id: string, delta: -1 | 1): ModProfile {
  const current = normalizeModProfile(profile);
  const index = current.loadOrder.indexOf(id);
  if (index < 0) return current;
  const target = index + delta;
  if (target < 0 || target >= current.loadOrder.length) return current;
  const loadOrder = [...current.loadOrder];
  [loadOrder[index], loadOrder[target]] = [loadOrder[target]!, loadOrder[index]!];
  return { ...current, loadOrder };
}

export class ModProfileStore {
  private profile: ModProfile;

  constructor(private readonly store?: Pick<KV, "getItem" | "setItem"> | null) {
    this.profile = loadModProfile(store);
  }

  get(): ModProfile {
    return structuredClone(this.profile);
  }

  enable(id: string): ModProfile {
    this.profile = saveModProfile(enableMod(this.profile, id), this.store);
    return this.get();
  }

  disable(id: string): ModProfile {
    this.profile = saveModProfile(disableMod(this.profile, id), this.store);
    return this.get();
  }

  move(id: string, delta: -1 | 1): ModProfile {
    this.profile = saveModProfile(moveMod(this.profile, id, delta), this.store);
    return this.get();
  }
}
