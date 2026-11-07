import { UNIT_CATALOG, UNIT_BY_ID } from "./unitCatalog.js";
import { normalizeCollectionProfile } from "../core/collectionProfile.js";
type UnknownRecord = Record<string, unknown>;

interface SkinUnlock {
  type?: unknown;
  achievementId?: unknown;
}

interface SkinAppearance extends UnknownRecord {
  icon?: unknown;
  previewIcon?: unknown;
  portraitKey?: unknown;
  displayNameVi?: unknown;
  displayNameEn?: unknown;
  form?: unknown;
  visual?: unknown;
  skinId?: unknown;
  starVisualIdentityOverride?: unknown;
  handlesStarEvolution?: unknown;
}

interface SkinDefinition extends UnknownRecord {
  nameVi?: unknown;
  nameEn?: unknown;
  previewIcon?: unknown;
  portraitKey?: unknown;
  form?: unknown;
  sortOrder?: unknown;
  unlock?: SkinUnlock;
  getAppearance?: ((star: number, locale?: string) => unknown) | null;
  skinId?: unknown;
  unitId?: unknown;
  starVisualIdentityOverride?: unknown;
  handlesStarEvolution?: unknown;
}

interface OwnedAppearanceOptions {
  unitId?: unknown;
  star?: unknown;
  side?: unknown;
  ownerKind?: unknown;
  collectionProfile?: unknown;
}



function toSkinId(unitId: string, skinKey: string): string {
  return `${unitId}.${skinKey}`;
}

function clampAppearanceStar(star: unknown): number {
  return Math.max(1, Math.min(3, Number(star) || 1));
}

function createNormalizedAppearanceResolver(unitId: string, skinKey: string, skinDef: SkinDefinition) {
  const resolveAppearance = skinDef.getAppearance;
  if (typeof resolveAppearance !== "function") return null;
  const skinId = toSkinId(unitId, skinKey);
  return function getAppearance(star = 1, locale = "vi") {
    const resolvedStar = clampAppearanceStar(star);
    const rawAppearance = resolveAppearance(resolvedStar, locale) ?? null;
    if (!rawAppearance || typeof rawAppearance !== "object") return rawAppearance;
    const appearance = rawAppearance as SkinAppearance;
    const previewIcon = appearance.previewIcon ?? appearance.icon ?? skinDef.previewIcon ?? "🎀";
    const displayNameVi = appearance.displayNameVi ?? skinDef.nameVi ?? skinKey;
    const displayNameEn = appearance.displayNameEn ?? skinDef.nameEn ?? skinKey;
    return {
      ...appearance,
      skinId,
      previewIcon,
      portraitKey: appearance.portraitKey ?? skinDef.portraitKey ?? `${skinId}.${resolvedStar}`,
      displayNameVi,
      displayNameEn,
      form: appearance.form ?? skinDef.form ?? "beast"
    };
  };
}

function buildSkinIndexes(): { unitSkinCatalog: Record<string, Record<string, SkinDefinition>>; skinById: Record<string, SkinDefinition>; skinByAchievementId: Record<string, SkinDefinition> } {
  const unitSkinCatalog: Record<string, Record<string, SkinDefinition>> = {};
  const skinById: Record<string, SkinDefinition> = {};
  const skinByAchievementId: Record<string, SkinDefinition> = {};
  const errors: string[] = [];

  UNIT_CATALOG.forEach((unit) => {
    const unitId = typeof unit.id === "string" ? unit.id : "";
    if (!unitId) return;
    const skins = unit.skins && typeof unit.skins === "object" ? unit.skins as UnknownRecord : {};
    unitSkinCatalog[unitId] = {};
    Object.entries(skins).forEach(([skinKey, rawSkinDef]) => {
      if (!rawSkinDef || typeof rawSkinDef !== "object") return;
      const skinDef = rawSkinDef as SkinDefinition;
      const skinId = toSkinId(unitId, skinKey);
      const normalizedGetAppearance = createNormalizedAppearanceResolver(unitId, skinKey, skinDef);
      const normalized = {
        ...skinDef,
        skinKey,
        skinId,
        unitId,
        sortOrder: typeof skinDef.sortOrder === "number" && Number.isFinite(skinDef.sortOrder) ? skinDef.sortOrder : 10,
        getAppearance: normalizedGetAppearance
      };
      if (skinById[skinId]) {
        errors.push(`Duplicate skinId detected: ${skinId}`);
      }
      unitSkinCatalog[unitId][skinKey] = normalized;
      skinById[skinId] = normalized;

      const unlockType = skinDef?.unlock?.type;
      if (unlockType === "achievement") {
        const achievementId = skinDef.unlock?.achievementId;
        if (typeof achievementId !== "string" || !achievementId) {
          errors.push(`Skin ${skinId} is missing unlock achievementId`);
        } else if (skinByAchievementId[achievementId]) {
          errors.push(`Achievement ${achievementId} is mapped to more than one skin`);
        } else {
          skinByAchievementId[achievementId] = normalized;
        }
      } else if (unlockType !== "free" && unlockType !== "locked") {
        errors.push(`Skin ${skinId} uses unsupported unlock type ${String(unlockType)}`);
      }

      if (typeof normalizedGetAppearance !== "function") {
        errors.push(`Skin ${skinId} is missing getAppearance(star)`);
      }
    });
  });

  if (errors.length) {
    throw new Error(`[UnitSkins] ${errors[0]}`);
  }

  return {
    unitSkinCatalog,
    skinById,
    skinByAchievementId
  };
}

const {
  unitSkinCatalog,
  skinById,
  skinByAchievementId
} = buildSkinIndexes();

export const UNIT_SKIN_CATALOG = unitSkinCatalog;
export const SKIN_BY_ID = skinById;
export const SKIN_BY_ACHIEVEMENT_ID = skinByAchievementId;

export function getUnitSkinDefs(unitId: string) {
  return UNIT_SKIN_CATALOG[unitId] ?? {};
}

export function getSkinById(skinId: string) {
  return SKIN_BY_ID[skinId] ?? null;
}

export function getSkinByAchievementId(achievementId: string) {
  return SKIN_BY_ACHIEVEMENT_ID[achievementId] ?? null;
}

export function isSkinUnlocked(profile: unknown, skinOrId: unknown): boolean {
  const normalizedProfile = normalizeCollectionProfile(profile);
  const skin = typeof skinOrId === "string"
    ? getSkinById(skinOrId)
    : skinOrId && typeof skinOrId === "object" ? skinOrId as SkinDefinition : null;
  if (!skin) return false;
  if (skin.unlock?.type === "free") return true;
  return typeof skin.skinId === "string" && normalizedProfile.unlockedSkinIds.includes(skin.skinId);
}

export function getEquippedSkinIdForUnit(unitId: string, collectionProfile: unknown) {
  const profile = normalizeCollectionProfile(collectionProfile);
  return profile.equippedSkinByUnitId?.[unitId] ?? null;
}

export function getUnlockedUnitSkins(unitId: string, collectionProfile: unknown) {
  return Object.values(getUnitSkinDefs(unitId)).filter((skin) => isSkinUnlocked(collectionProfile, skin));
}

export function resolveOwnedUnitAppearance({
  unitId,
  star = 1,
  side = "LEFT",
  ownerKind = "PLAYER",
  collectionProfile = null
}: OwnedAppearanceOptions = {}) {
  const profile = normalizeCollectionProfile(collectionProfile);
  const shouldApply = ownerKind === "PLAYER" || ownerKind === "LIBRARY";
  if (!shouldApply || side === "RIGHT") return null;

  if (typeof unitId !== "string") return null;
  const equippedSkinId = getEquippedSkinIdForUnit(unitId, profile);
  if (!equippedSkinId || !isSkinUnlocked(profile, equippedSkinId)) return null;
  const skin = getSkinById(equippedSkinId);
  if (!skin || typeof skin.getAppearance !== "function") return null;
  const rawAppearance = skin.getAppearance(clampAppearanceStar(star)) ?? null;
  if (!rawAppearance || typeof rawAppearance !== "object") return null;
  const appearance = rawAppearance as SkinAppearance;
  return {
    ...appearance,
    starVisualIdentityOverride: appearance.starVisualIdentityOverride ?? skin.starVisualIdentityOverride ?? null,
    handlesStarEvolution: appearance.handlesStarEvolution === true || skin.handlesStarEvolution === true
  };
}

export function validateAchievementSkinCoverage(achievementEntries: unknown) {
  const entries = Array.isArray(achievementEntries) ? achievementEntries : [];
  const seen = new Set<string>();
  const errors: string[] = [];
  entries.forEach((rawEntry) => {
    const entry = rawEntry && typeof rawEntry === "object" ? rawEntry as UnknownRecord : {};
    const achievementId = typeof entry.id === "string" ? entry.id : undefined;
    const skin = achievementId ? getSkinByAchievementId(achievementId) : null;
    if (!skin) {
      errors.push(`Missing skin reward for achievement ${String(achievementId)}`);
      return;
    }
    if (typeof skin.skinId !== "string" || typeof skin.unitId !== "string") {
      errors.push(`Skin for achievement ${achievementId} has invalid identifiers`);
      return;
    }
    if (seen.has(skin.skinId)) {
      errors.push(`Skin ${skin.skinId} is linked to more than one achievement`);
      return;
    }
    if (!UNIT_BY_ID[skin.unitId]) {
      errors.push(`Skin ${skin.skinId} points to unknown unit ${skin.unitId}`);
      return;
    }
    seen.add(skin.skinId);
  });
  return {
    ok: errors.length === 0,
    errors
  };
}
