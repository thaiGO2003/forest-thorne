export interface CollectionProfile {
  version: number;
  unlockedSkinIds: string[];
  claimedAchievementIds: string[];
  equippedSkinByUnitId: Record<string, string>;
}

interface CollectionProfileStorage {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}


export const COLLECTION_PROFILE_STORAGE_KEY = "forest_throne_collection_profile_v1";

const PROFILE_VERSION = 2;

const PROFILE_TEMPLATE = Object.freeze({
  version: PROFILE_VERSION,
  unlockedSkinIds: Object.freeze([]),
  claimedAchievementIds: Object.freeze([]),
  equippedSkinByUnitId: Object.freeze({})
});

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .map((entry) => renameLegacySkinId(entry) as string)
  )];
}

function normalizeEquippedSkinMap(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).flatMap(([unitId, skinId]) => {
    const renamedSkinId = renameLegacySkinId(skinId);
    return unitId.trim() && typeof renamedSkinId === "string" && renamedSkinId.trim()
      ? [[unitId, renamedSkinId] as const]
      : [];
  });
  return Object.fromEntries(entries);
}

export function renameLegacySkinId(skinId: string): string;
export function renameLegacySkinId(skinId: unknown): unknown;
export function renameLegacySkinId(skinId: unknown): unknown {
  if (typeof skinId !== "string" || !skinId.trim()) return skinId;
  if (!skinId.includes(".lofi_")) return skinId;
  return skinId.replace(".lofi_", ".loli_");
}

export function createDefaultCollectionProfile(): CollectionProfile {
  return {
    version: PROFILE_VERSION,
    unlockedSkinIds: [],
    claimedAchievementIds: [],
    equippedSkinByUnitId: {}
  };
}

export function normalizeCollectionProfile(raw: unknown): CollectionProfile {
  const source = raw !== null && typeof raw === "object" ? raw : PROFILE_TEMPLATE;
  return {
    version: PROFILE_VERSION,
    unlockedSkinIds: normalizeStringList("unlockedSkinIds" in source ? source.unlockedSkinIds : undefined),
    claimedAchievementIds: normalizeStringList("claimedAchievementIds" in source ? source.claimedAchievementIds : undefined),
    equippedSkinByUnitId: normalizeEquippedSkinMap("equippedSkinByUnitId" in source ? source.equippedSkinByUnitId : undefined)
  };
}

export function loadCollectionProfile(storage: CollectionProfileStorage | undefined = globalThis?.localStorage): CollectionProfile {
  try {
    const raw = storage?.getItem?.(COLLECTION_PROFILE_STORAGE_KEY);
    if (!raw) return createDefaultCollectionProfile();
    return normalizeCollectionProfile(JSON.parse(raw));
  } catch (_err) {
    return createDefaultCollectionProfile();
  }
}

export function saveCollectionProfile(profile: unknown, storage: CollectionProfileStorage | undefined = globalThis?.localStorage): boolean {
  try {
    storage?.setItem?.(
      COLLECTION_PROFILE_STORAGE_KEY,
      JSON.stringify(normalizeCollectionProfile(profile))
    );
    return true;
  } catch (_err) {
    return false;
  }
}

export function clearCollectionProfile(storage: CollectionProfileStorage | undefined = globalThis?.localStorage): boolean {
  try {
    storage?.removeItem?.(COLLECTION_PROFILE_STORAGE_KEY);
    return true;
  } catch (_err) {
    return false;
  }
}

export function isAchievementClaimed(profile: unknown, achievementId: string): boolean {
  return normalizeCollectionProfile(profile).claimedAchievementIds.includes(achievementId);
}

export function isSkinUnlocked(profile: unknown, skinId: string): boolean {
  return normalizeCollectionProfile(profile).unlockedSkinIds.includes(skinId);
}

export function claimAchievementSkin(profile: unknown, achievementId: string, skinId: string): CollectionProfile {
  const next = normalizeCollectionProfile(profile);
  if (achievementId && !next.claimedAchievementIds.includes(achievementId)) {
    next.claimedAchievementIds.push(achievementId);
  }
  if (skinId && !next.unlockedSkinIds.includes(skinId)) {
    next.unlockedSkinIds.push(skinId);
  }
  return next;
}

export function equipUnitSkin(profile: unknown, unitId: unknown, skinId: unknown): CollectionProfile {
  const next = normalizeCollectionProfile(profile);
  if (typeof unitId !== "string" || !unitId.trim()) return next;
  if (typeof skinId === "string" && skinId.trim()) {
    next.equippedSkinByUnitId[unitId] = skinId;
  } else {
    delete next.equippedSkinByUnitId[unitId];
  }
  return next;
}
