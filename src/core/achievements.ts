// Account-level Endless achievements + collection profile (spec A36, A104). Pure and corruption-tolerant.
import { UNIT_BY_ID } from "../content/catalog";
import type { GameMode } from "./modes";

export const ACHIEVEMENT_PROFILE_VERSION = 1;
export const COLLECTION_PROFILE_VERSION = 1;

export const ACHIEVEMENT_THRESHOLDS = {
  best_round: [2, 3, 5, 8, 12, 16, 20, 25, 30, 40],
  rounds_won: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150],
  runs_started: [1, 2, 3, 5, 8, 12, 16, 20, 30, 50],
  shop_refreshes: [1, 5, 10, 20, 30, 50, 75, 100, 150, 250],
  xp_purchases: [1, 3, 5, 10, 20, 30, 40, 50, 75, 100],
  units_bought: [1, 5, 10, 20, 30, 50, 75, 100, 150, 200],
  merges: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150],
  augments_chosen: [1, 3, 5, 10, 15, 20, 25, 30, 40, 50],
  crafted_items: [1, 3, 5, 10, 15, 20, 30, 40, 50, 75],
  highest_level: [2, 3, 4, 5, 6, 7, 8, 10, 12, 15],
} as const;

export type AchievementCategory = keyof typeof ACHIEVEMENT_THRESHOLDS;
export const ACHIEVEMENT_CATEGORIES = Object.keys(ACHIEVEMENT_THRESHOLDS) as AchievementCategory[];

export interface AchievementStats {
  best_round: number;
  rounds_won: number;
  runs_started: number;
  shop_refreshes: number;
  xp_purchases: number;
  units_bought: number;
  merges: number;
  augments_chosen: number;
  crafted_items: number;
  highest_level: number;
  rounds_lost: number;
  items_looted: number;
  highest_gold: number;
  best_win_streak: number;
}

export interface AchievementProfile {
  version: number;
  stats: AchievementStats;
}

export interface CollectionProfile {
  version: number;
  unlockedSkinIds: string[];
  claimedAchievementIds: string[];
  equippedSkinByUnit: Record<string, string>;
}

const DEFAULT_STATS: AchievementStats = {
  best_round: 0,
  rounds_won: 0,
  runs_started: 0,
  shop_refreshes: 0,
  xp_purchases: 0,
  units_bought: 0,
  merges: 0,
  augments_chosen: 0,
  crafted_items: 0,
  highest_level: 1,
  rounds_lost: 0,
  items_looted: 0,
  highest_gold: 0,
  best_win_streak: 0,
};

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const nonNegativeInt = (value: unknown, fallback = 0): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
};
const uniqueStrings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))]
  : [];

export function createAchievementProfile(): AchievementProfile {
  return { version: ACHIEVEMENT_PROFILE_VERSION, stats: { ...DEFAULT_STATS } };
}

export function normalizeAchievementProfile(value: unknown): AchievementProfile {
  const raw = record(value);
  const stats = record(raw?.stats) ?? raw;
  const out = createAchievementProfile();
  if (!stats) return out;
  for (const key of Object.keys(DEFAULT_STATS) as (keyof AchievementStats)[]) {
    out.stats[key] = nonNegativeInt(stats[key], DEFAULT_STATS[key]);
  }
  out.stats.highest_level = Math.max(1, out.stats.highest_level);
  return out;
}

export function createCollectionProfile(): CollectionProfile {
  return { version: COLLECTION_PROFILE_VERSION, unlockedSkinIds: [], claimedAchievementIds: [], equippedSkinByUnit: {} };
}

export function normalizeCollectionProfile(value: unknown): CollectionProfile {
  const raw = record(value);
  if (!raw) return createCollectionProfile();
  const equippedRaw = record(raw.equippedSkinByUnit);
  const equippedSkinByUnit: Record<string, string> = {};
  if (equippedRaw) for (const [unitId, skinId] of Object.entries(equippedRaw)) {
    if (UNIT_BY_ID.has(unitId) && typeof skinId === "string" && skinId) equippedSkinByUnit[unitId] = skinId;
  }
  return {
    version: COLLECTION_PROFILE_VERSION,
    unlockedSkinIds: uniqueStrings(raw.unlockedSkinIds),
    claimedAchievementIds: uniqueStrings(raw.claimedAchievementIds),
    equippedSkinByUnit,
  };
}

export const achievementId = (category: AchievementCategory, tierIndex: number): string => `${category}_${tierIndex + 1}`;

export interface AchievementRow {
  id: string;
  category: AchievementCategory;
  threshold: number;
  current: number;
  progress: number;
  unlocked: boolean;
  authoredOrder: number;
}

export function achievementRows(profile: AchievementProfile): AchievementRow[] {
  const rows: AchievementRow[] = [];
  let order = 0;
  for (const category of ACHIEVEMENT_CATEGORIES) {
    const current = profile.stats[category];
    ACHIEVEMENT_THRESHOLDS[category].forEach((threshold, tierIndex) => {
      rows.push({
        id: achievementId(category, tierIndex), category, threshold, current,
        progress: Math.min(1, threshold > 0 ? current / threshold : 1),
        unlocked: current >= threshold,
        authoredOrder: order++,
      });
    });
  }
  return rows;
}

export function unlockedAchievementCount(profile: AchievementProfile): number {
  return achievementRows(profile).filter((row) => row.unlocked).length;
}

export type EndlessAchievementEvent =
  | { type: "run_started" }
  | { type: "shop_refresh" }
  | { type: "xp_purchase" }
  | { type: "unit_bought"; count?: number }
  | { type: "merge"; count?: number }
  | { type: "augment_chosen" }
  | { type: "crafted"; count?: number }
  | { type: "round_result"; round: number; won: boolean; lost: boolean; itemsLooted?: number; gold: number; level: number; winStreak: number }
  | { type: "snapshot"; round: number; gold: number; level: number; winStreak: number };

/** Only solo Endless Classic contributes. Event mutation is additive/max exactly once per canonical event. */
export function recordEndlessAchievementEvent(profile: AchievementProfile, mode: GameMode, event: EndlessAchievementEvent): boolean {
  if (mode !== "EndlessPvEClassic") return false;
  const s = profile.stats;
  switch (event.type) {
    case "run_started": s.runs_started++; break;
    case "shop_refresh": s.shop_refreshes++; break;
    case "xp_purchase": s.xp_purchases++; break;
    case "unit_bought": s.units_bought += Math.max(1, Math.floor(event.count ?? 1)); break;
    case "merge": s.merges += Math.max(1, Math.floor(event.count ?? 1)); break;
    case "augment_chosen": s.augments_chosen++; break;
    case "crafted": s.crafted_items += Math.max(1, Math.floor(event.count ?? 1)); break;
    case "round_result":
      if (event.won) s.rounds_won++;
      if (event.lost) s.rounds_lost++;
      s.items_looted += Math.max(0, Math.floor(event.itemsLooted ?? 0));
      s.best_round = Math.max(s.best_round, Math.floor(event.round));
      s.highest_gold = Math.max(s.highest_gold, Math.floor(event.gold));
      s.highest_level = Math.max(s.highest_level, Math.floor(event.level));
      s.best_win_streak = Math.max(s.best_win_streak, Math.floor(event.winStreak));
      break;
    case "snapshot":
      s.best_round = Math.max(s.best_round, Math.floor(event.round));
      s.highest_gold = Math.max(s.highest_gold, Math.floor(event.gold));
      s.highest_level = Math.max(s.highest_level, Math.floor(event.level));
      s.best_win_streak = Math.max(s.best_win_streak, Math.floor(event.winStreak));
      break;
  }
  return true;
}

export interface AchievementRewardMapping { achievementId: string; skinId: string; unitId: string }

export interface SkinDefinitionForValidation {
  id: string;
  unitId: string;
  unlockType: "achievement" | "free" | "locked";
  appearanceStars: readonly number[];
}

/** A36 one-to-one validation. Returns human-readable invariant errors, empty when valid. */
export function validateAchievementRewards(
  mappings: readonly AchievementRewardMapping[], skins: readonly SkinDefinitionForValidation[],
): string[] {
  const errors: string[] = [];
  const validAchievementIds = new Set(achievementRows(createAchievementProfile()).map((row) => row.id));
  const skinById = new Map(skins.map((skin) => [skin.id, skin]));
  const mappedAchievements = new Set<string>();
  const mappedSkins = new Set<string>();
  for (const mapping of mappings) {
    if (!validAchievementIds.has(mapping.achievementId)) errors.push(`unknown achievement ${mapping.achievementId}`);
    if (mappedAchievements.has(mapping.achievementId)) errors.push(`duplicate achievement mapping ${mapping.achievementId}`);
    mappedAchievements.add(mapping.achievementId);
    if (mappedSkins.has(mapping.skinId)) errors.push(`duplicate skin reward ${mapping.skinId}`);
    mappedSkins.add(mapping.skinId);
    const skin = skinById.get(mapping.skinId);
    if (!skin) errors.push(`unknown skin ${mapping.skinId}`);
    else {
      if (!UNIT_BY_ID.has(mapping.unitId) || skin.unitId !== mapping.unitId) errors.push(`invalid unit for skin ${mapping.skinId}`);
      if (skin.unlockType !== "achievement") errors.push(`skin ${mapping.skinId} is not achievement-unlocked`);
      if (![1, 2, 3].every((star) => skin.appearanceStars.includes(star))) errors.push(`skin ${mapping.skinId} lacks star appearance`);
    }
  }
  for (const skin of skins) {
    if (skin.unlockType === "achievement" && !mappedSkins.has(skin.id)) errors.push(`missing reward mapping for skin ${skin.id}`);
  }
  return errors;
}

export function claimSkinReward(
  achievements: AchievementProfile, collection: CollectionProfile, mapping: AchievementRewardMapping,
): boolean {
  const row = achievementRows(achievements).find((item) => item.id === mapping.achievementId);
  if (!row?.unlocked || collection.claimedAchievementIds.includes(mapping.achievementId)) return false;
  collection.claimedAchievementIds.push(mapping.achievementId);
  if (!collection.unlockedSkinIds.includes(mapping.skinId)) collection.unlockedSkinIds.push(mapping.skinId);
  return true;
}

export function equipCollectionSkin(collection: CollectionProfile, unitId: string, skinId: string | null): boolean {
  if (!UNIT_BY_ID.has(unitId)) return false;
  if (skinId === null) {
    delete collection.equippedSkinByUnit[unitId];
    return true;
  }
  if (!collection.unlockedSkinIds.includes(skinId)) return false;
  collection.equippedSkinByUnit[unitId] = skinId;
  return true;
}

export interface RankedAchievementRow extends AchievementRow { rewardSkinId?: string; claimed: boolean; claimable: boolean }

export function rankAchievementRows(
  profile: AchievementProfile, collection: CollectionProfile, mappings: readonly AchievementRewardMapping[],
): RankedAchievementRow[] {
  const rewardByAchievement = new Map(mappings.map((mapping) => [mapping.achievementId, mapping.skinId]));
  return achievementRows(profile).map((row) => {
    const rewardSkinId = rewardByAchievement.get(row.id);
    const claimed = collection.claimedAchievementIds.includes(row.id);
    return { ...row, rewardSkinId, claimed, claimable: row.unlocked && !!rewardSkinId && !claimed };
  }).sort((a, b) => {
    const group = (row: RankedAchievementRow) => row.claimable ? 0 : !row.unlocked ? 1 : 2;
    return group(a) - group(b)
      || (group(a) === 1 ? b.progress - a.progress : 0)
      || a.authoredOrder - b.authoredOrder;
  });
}
