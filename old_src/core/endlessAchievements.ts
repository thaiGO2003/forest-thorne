import { getLocale } from "../i18n/index.js";

export const ENDLESS_ACHIEVEMENT_STORAGE_KEY = "forest_throne_endless_achievements_v1";
export const ENDLESS_PVE_GAME_MODE_ID = "EndlessPvEClassic";
export const ENDLESS_ACHIEVEMENT_TOTAL = 100;

const PROFILE_VERSION = 1;

interface EndlessStats {
  runsStarted: number;
  bestRound: number;
  roundsWon: number;
  roundsLost: number;
  shopRefreshes: number;
  xpPurchases: number;
  unitsBought: number;
  merges: number;
  augmentsChosen: number;
  craftedItems: number;
  itemsLooted: number;
  highestLevel: number;
  highestGold: number;
  bestWinStreak: number;
}

interface EndlessProfile {
  version: number;
  lastUpdatedAt: number;
  stats: EndlessStats;
}

interface EndlessSnapshot {
  round?: number;
  level?: number;
  gold?: number;
  winStreak?: number;
}

interface CategoryBlueprint {
  key: string;
  statKey: keyof EndlessStats;
  icon: string;
  thresholds: readonly number[];
  title: Record<string, string>;
  description: Record<string, string>;
}

interface AchievementDefinition {
  id: string;
  key: string;
  statKey: string;
  icon: string;
  threshold: number;
  categoryLabel: string;
  title: string;
  description: string;
  sortIndex: number;
}

interface AchievementEntry extends AchievementDefinition {
  current: number;
  unlocked: boolean;
  progressRatio: number;
}

interface UI_Copy {
  button: string;
  buttonWithCount: string;
  buttonWithClaimable: string;
  title: string;
  subtitle: string;
  unlocked: string;
  locked: string;
  claim: string;
  claimed: string;
  rewardSection: string;
  rewardSkin: string;
  rewardLocked: string;
  close: string;
  summaryUnlocked: string;
  summaryBestRound: string;
  summaryRoundsWon: string;
  summaryHighestLevel: string;
  category: Record<string, string>;
}

const PROFILE_TEMPLATE = Object.freeze({
  version: PROFILE_VERSION,
  lastUpdatedAt: 0,
  stats: Object.freeze({
    runsStarted: 0,
    bestRound: 0,
    roundsWon: 0,
    roundsLost: 0,
    shopRefreshes: 0,
    xpPurchases: 0,
    unitsBought: 0,
    merges: 0,
    augmentsChosen: 0,
    craftedItems: 0,
    itemsLooted: 0,
    highestLevel: 0,
    highestGold: 0,
    bestWinStreak: 0
  })
});

const UI_COPY: Record<string, UI_Copy> = {
  vi: {
    button: "Thành tựu",
    buttonWithCount: "Thành tựu {unlocked}/{total}",
    buttonWithClaimable: "Thành tựu {unlocked}/{total} • {claimable} nhận",
    title: "100 Thành Tựu PvE Vô Tận",
    subtitle: "Tiến độ cộng dồn từ các ván solo PvE Vô tận. Creative và Co-op không được tính.",
    unlocked: "Đã mở",
    locked: "Chưa mở",
    claim: "Nhận",
    claimed: "Đã nhận",
    rewardSection: "Phần thưởng",
    rewardSkin: "Ngoại trang",
    rewardLocked: "Ngoại trang bị khóa",
    close: "Đóng",
    summaryUnlocked: "Đã mở",
    summaryBestRound: "Vòng cao nhất",
    summaryRoundsWon: "Vòng thắng",
    summaryHighestLevel: "Cấp cao nhất",
    category: {
      bestRound: "Vòng tiến sâu",
      roundsWon: "Chiến thắng",
      runsStarted: "Số ván",
      shopRefreshes: "Đổi shop",
      xpPurchases: "Mua XP",
      unitsBought: "Chiêu mộ",
      merges: "Nâng sao",
      augmentsChosen: "Pháp ấn",
      craftedItems: "Chế tạo",
      highestLevel: "Cấp độ"
    }
  },
  en: {
    button: "Achievements",
    buttonWithCount: "Achievements {unlocked}/{total}",
    buttonWithClaimable: "Achievements {unlocked}/{total} • {claimable} claim",
    title: "100 Endless PvE Achievements",
    subtitle: "Progress is tracked across solo Endless PvE runs. Creative and co-op runs do not count.",
    unlocked: "Unlocked",
    locked: "Locked",
    claim: "Claim",
    claimed: "Claimed",
    rewardSection: "Reward",
    rewardSkin: "Skin reward",
    rewardLocked: "Locked skin reward",
    close: "Close",
    summaryUnlocked: "Unlocked",
    summaryBestRound: "Best round",
    summaryRoundsWon: "Rounds won",
    summaryHighestLevel: "Best level",
    category: {
      bestRound: "Deep rounds",
      roundsWon: "Victories",
      runsStarted: "Runs started",
      shopRefreshes: "Shop refreshes",
      xpPurchases: "XP buys",
      unitsBought: "Recruitment",
      merges: "Star merges",
      augmentsChosen: "Augments",
      craftedItems: "Crafting",
      highestLevel: "Levels"
    }
  }
};

const CATEGORY_BLUEPRINTS: CategoryBlueprint[] = [
  {
    key: "bestRound",
    statKey: "bestRound",
    icon: "🌿",
    thresholds: [2, 3, 5, 8, 12, 16, 20, 25, 30, 40],
    title: {
      vi: "Tiến tới vòng {threshold}",
      en: "Reach round {threshold}"
    },
    description: {
      vi: "Đạt tới vòng {threshold} trong PvE Vô tận solo.",
      en: "Reach round {threshold} in solo Endless PvE."
    }
  },
  {
    key: "roundsWon",
    statKey: "roundsWon",
    icon: "⚔️",
    thresholds: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150],
    title: {
      vi: "Thắng {threshold} vòng",
      en: "Win {threshold} rounds"
    },
    description: {
      vi: "Tích lũy {threshold} vòng chiến thắng ở PvE Vô tận.",
      en: "Accumulate {threshold} winning rounds in Endless PvE."
    }
  },
  {
    key: "runsStarted",
    statKey: "runsStarted",
    icon: "🏕️",
    thresholds: [1, 2, 3, 5, 8, 12, 16, 20, 30, 50],
    title: {
      vi: "Bắt đầu {threshold} ván",
      en: "Start {threshold} runs"
    },
    description: {
      vi: "Khởi động {threshold} ván solo PvE Vô tận.",
      en: "Start {threshold} solo Endless PvE runs."
    }
  },
  {
    key: "shopRefreshes",
    statKey: "shopRefreshes",
    icon: "🎲",
    thresholds: [1, 5, 10, 20, 30, 50, 75, 100, 150, 250],
    title: {
      vi: "Đổi shop {threshold} lần",
      en: "Refresh shop {threshold} times"
    },
    description: {
      vi: "Dùng tính năng đổi shop {threshold} lần ở PvE Vô tận.",
      en: "Use shop refresh {threshold} times in Endless PvE."
    }
  },
  {
    key: "xpPurchases",
    statKey: "xpPurchases",
    icon: "📘",
    thresholds: [1, 3, 5, 10, 20, 30, 40, 50, 75, 100],
    title: {
      vi: "Mua XP {threshold} lần",
      en: "Buy XP {threshold} times"
    },
    description: {
      vi: "Mua XP tổng cộng {threshold} lần ở PvE Vô tận.",
      en: "Buy XP a total of {threshold} times in Endless PvE."
    }
  },
  {
    key: "unitsBought",
    statKey: "unitsBought",
    icon: "🐾",
    thresholds: [1, 5, 10, 20, 30, 50, 75, 100, 150, 200],
    title: {
      vi: "Chiêu mộ {threshold} linh thú",
      en: "Recruit {threshold} beasts"
    },
    description: {
      vi: "Mua tổng cộng {threshold} linh thú trong PvE Vô tận.",
      en: "Buy a total of {threshold} units in Endless PvE."
    }
  },
  {
    key: "merges",
    statKey: "merges",
    icon: "⭐",
    thresholds: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150],
    title: {
      vi: "Nâng sao {threshold} lần",
      en: "Merge stars {threshold} times"
    },
    description: {
      vi: "Thực hiện {threshold} lần nâng sao trong PvE Vô tận.",
      en: "Complete {threshold} star merges in Endless PvE."
    }
  },
  {
    key: "augmentsChosen",
    statKey: "augmentsChosen",
    icon: "🔮",
    thresholds: [1, 3, 5, 10, 15, 20, 25, 30, 40, 50],
    title: {
      vi: "Chọn {threshold} pháp ấn",
      en: "Choose {threshold} augments"
    },
    description: {
      vi: "Chọn tổng cộng {threshold} pháp ấn trong PvE Vô tận.",
      en: "Choose a total of {threshold} augments in Endless PvE."
    }
  },
  {
    key: "craftedItems",
    statKey: "craftedItems",
    icon: "⚒️",
    thresholds: [1, 3, 5, 10, 15, 20, 30, 40, 50, 75],
    title: {
      vi: "Chế tạo {threshold} món",
      en: "Craft {threshold} items"
    },
    description: {
      vi: "Hoàn thành {threshold} lần chế tạo ở PvE Vô tận.",
      en: "Complete {threshold} crafting actions in Endless PvE."
    }
  },
  {
    key: "highestLevel",
    statKey: "highestLevel",
    icon: "👑",
    thresholds: [2, 3, 4, 5, 6, 7, 8, 10, 12, 15],
    title: {
      vi: "Đạt cấp {threshold}",
      en: "Reach level {threshold}"
    },
    description: {
      vi: "Chạm cấp {threshold} trong một ván PvE Vô tận.",
      en: "Reach level {threshold} in an Endless PvE run."
    }
  }
];

function resolveLocaleCopy(locale: string = getLocale()): UI_Copy {
  const normalizedLocale = locale === "en" ? "en" : "vi";
  return UI_COPY[normalizedLocale] ?? UI_COPY.vi;
}

function fillTemplate(template: string | undefined, params: Record<string, unknown> = {}): string {
  let output = String(template ?? "");
  Object.entries(params).forEach(([key, value]) => {
    output = output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  });
  return output;
}

function toNonNegativeInt(value: unknown, fallback = 0): number {
  if (!Number.isFinite(Number(value))) return fallback;
  return Math.max(0, Math.floor(Number(value)));
}

function ensureStats(rawStats: unknown): EndlessStats {
  const source = rawStats && typeof rawStats === "object" ? rawStats as Record<string, unknown> : {};
  return {
    runsStarted: toNonNegativeInt(source.runsStarted),
    bestRound: toNonNegativeInt(source.bestRound),
    roundsWon: toNonNegativeInt(source.roundsWon),
    roundsLost: toNonNegativeInt(source.roundsLost),
    shopRefreshes: toNonNegativeInt(source.shopRefreshes),
    xpPurchases: toNonNegativeInt(source.xpPurchases),
    unitsBought: toNonNegativeInt(source.unitsBought),
    merges: toNonNegativeInt(source.merges),
    augmentsChosen: toNonNegativeInt(source.augmentsChosen),
    craftedItems: toNonNegativeInt(source.craftedItems),
    itemsLooted: toNonNegativeInt(source.itemsLooted),
    highestLevel: toNonNegativeInt(source.highestLevel),
    highestGold: toNonNegativeInt(source.highestGold),
    bestWinStreak: toNonNegativeInt(source.bestWinStreak)
  };
}

function applySnapshot(stats: EndlessStats, snapshot: EndlessSnapshot = {}): void {
  if (!snapshot || typeof snapshot !== "object") return;
  if (Number.isFinite(snapshot.round)) {
    stats.bestRound = Math.max(stats.bestRound, toNonNegativeInt(snapshot.round));
  }
  if (Number.isFinite(snapshot.level)) {
    stats.highestLevel = Math.max(stats.highestLevel, toNonNegativeInt(snapshot.level));
  }
  if (Number.isFinite(snapshot.gold)) {
    stats.highestGold = Math.max(stats.highestGold, toNonNegativeInt(snapshot.gold));
  }
  if (Number.isFinite(snapshot.winStreak)) {
    stats.bestWinStreak = Math.max(stats.bestWinStreak, toNonNegativeInt(snapshot.winStreak));
  }
}

function mutateProfile(profile: unknown, mutator: (stats: EndlessStats) => void): EndlessProfile {
  const next = normalizeEndlessAchievementProfile(profile);
  mutator(next.stats);
  next.lastUpdatedAt = Date.now();
  return next;
}

export function createDefaultEndlessAchievementProfile(): EndlessProfile {
  return normalizeEndlessAchievementProfile(PROFILE_TEMPLATE);
}

export function normalizeEndlessAchievementProfile(raw: unknown): EndlessProfile {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    version: PROFILE_VERSION,
    lastUpdatedAt: toNonNegativeInt(source.lastUpdatedAt),
    stats: ensureStats(source.stats)
  };
}

export function shouldTrackEndlessAchievements(options: { gameMode?: string; aiMode?: string; isCoop?: boolean } = {}): boolean {
  const { gameMode, aiMode, isCoop = false } = options;
  return gameMode === ENDLESS_PVE_GAME_MODE_ID && aiMode !== "CREATIVE" && isCoop !== true;
}

export function loadEndlessAchievementProfile(storage: Storage | null = globalThis?.localStorage): EndlessProfile {
  try {
    const raw = storage?.getItem?.(ENDLESS_ACHIEVEMENT_STORAGE_KEY);
    if (!raw) return createDefaultEndlessAchievementProfile();
    return normalizeEndlessAchievementProfile(JSON.parse(raw));
  } catch {
    return createDefaultEndlessAchievementProfile();
  }
}

export function saveEndlessAchievementProfile(profile: unknown, storage: Storage | null = globalThis?.localStorage): boolean {
  try {
    storage?.setItem?.(
      ENDLESS_ACHIEVEMENT_STORAGE_KEY,
      JSON.stringify(normalizeEndlessAchievementProfile(profile))
    );
    return true;
  } catch {
    return false;
  }
}

export function clearEndlessAchievementProfile(storage: Storage | null = globalThis?.localStorage): boolean {
  try {
    storage?.removeItem?.(ENDLESS_ACHIEVEMENT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function noteEndlessProgressSnapshot(profile: unknown, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessRunStarted(profile: unknown, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.runsStarted += 1;
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessRoundWon(profile: unknown, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.roundsWon += 1;
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessRoundLost(profile: unknown, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.roundsLost += 1;
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessShopRefresh(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.shopRefreshes += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessXpPurchase(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.xpPurchases += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessUnitBought(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.unitsBought += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessMerge(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.merges += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessAugment(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.augmentsChosen += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessCraft(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.craftedItems += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function noteEndlessLoot(profile: unknown, amount: number = 1, snapshot: EndlessSnapshot = {}): EndlessProfile {
  return mutateProfile(profile, (stats) => {
    stats.itemsLooted += toNonNegativeInt(amount, 1);
    applySnapshot(stats, snapshot);
  });
}

export function getEndlessAchievementUiCopy(locale: string = getLocale()): UI_Copy {
  return resolveLocaleCopy(locale);
}

export function getEndlessAchievementDefinitions(locale: string = getLocale()): AchievementDefinition[] {
  const normalizedLocale = locale === "en" ? "en" : "vi";
  const copy = resolveLocaleCopy(normalizedLocale);
  return CATEGORY_BLUEPRINTS.flatMap((category, categoryIndex) => (
    category.thresholds.map((threshold, thresholdIndex) => ({
      id: `${category.key}_${threshold}`,
      key: category.key,
      statKey: category.statKey,
      icon: category.icon,
      threshold,
      categoryLabel: copy.category[category.key] ?? category.key,
      title: fillTemplate(category.title[normalizedLocale] ?? category.title.vi, { threshold }),
      description: fillTemplate(category.description[normalizedLocale] ?? category.description.vi, { threshold }),
      sortIndex: categoryIndex * 100 + thresholdIndex
    }))
  ));
}

export function getEndlessAchievementEntries(profile: unknown, locale: string = getLocale()): AchievementEntry[] {
  const normalizedProfile = normalizeEndlessAchievementProfile(profile);
  return getEndlessAchievementDefinitions(locale).map((definition) => {
    const current = toNonNegativeInt(normalizedProfile.stats?.[definition.statKey as keyof EndlessStats]);
    const unlocked = current >= definition.threshold;
    return {
      ...definition,
      current,
      unlocked,
      progressRatio: definition.threshold > 0 ? Math.min(1, current / definition.threshold) : 1
    };
  });
}

export function getEndlessAchievementSummary(profile: unknown, locale: string = getLocale()): { total: number; unlocked: number; completionRatio: number; profile: EndlessProfile } {
  const normalizedProfile = normalizeEndlessAchievementProfile(profile);
  const achievements = getEndlessAchievementEntries(normalizedProfile, locale);
  const unlocked = achievements.filter((entry) => entry.unlocked).length;
  return {
    total: achievements.length,
    unlocked,
    completionRatio: achievements.length > 0 ? unlocked / achievements.length : 0,
    profile: normalizedProfile
  };
}

export function getEndlessAchievementButtonLabel(profile: unknown, locale: string = getLocale(), claimableCount: number = 0): string {
  const copy = resolveLocaleCopy(locale);
  const summary = getEndlessAchievementSummary(profile, locale);
  if ((Number(claimableCount) || 0) > 0) {
    return fillTemplate(copy.buttonWithClaimable, {
      unlocked: summary.unlocked,
      total: summary.total,
      claimable: Math.max(0, Number(claimableCount) || 0)
    });
  }
  return fillTemplate(copy.buttonWithCount, {
    unlocked: summary.unlocked,
    total: summary.total
  });
}

export function getEndlessAchievementClaimableCount(profile: unknown, collectionProfile: unknown): number {
  const claimedIds = (collectionProfile as { claimedAchievementIds?: unknown })?.claimedAchievementIds;
  const claimed = new Set(
    Array.isArray(claimedIds) ? claimedIds.filter((id): id is string => typeof id === "string") : []
  );
  return getEndlessAchievementEntries(profile)
    .filter((entry) => entry.unlocked && !claimed.has(entry.id))
    .length;
}
