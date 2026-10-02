// Pure combat-result normalization/preview state (mega prompt A87).
import { addXp, roundIncome, type IncomeMods } from "./economy";
import { lossDamage, type DamageRule, type Drop } from "./loot";
import type { LossCondition } from "./modes";

export type RoundWinner = "LEFT" | "RIGHT" | "DRAW";

export interface RoundResultInput {
  combatId: string;
  winner: RoundWinner;
  enemySurvivors?: number;
  /** Current combat path. Also acts as the source for canonical base/star gold when explicit parts are absent. */
  enemyStars?: number[];
  /** Compatibility alias for Assassin bounty used by the current combat bridge. */
  bounty?: number;
  drops?: Drop[];
  /** Canonical persisted gold parts. */
  enemyUnitGold?: number;
  enemyStarGold?: number;
  assassinBounty?: number;
  /** Legacy persisted total. Used only when no canonical gold parts are present. */
  goldDelta?: number;
  /** Authoritative shared-fortress HP after combat, when supplied by network resolution. */
  fortressHpAfter?: number;
}

export interface RoundGoldBreakdown {
  enemyUnitBase: number;
  enemyStar: number;
  assassinBounty: number;
  winBonus: number;
  legacy: number;
}

export interface NormalizedRoundResult {
  combatId: string;
  winner: RoundWinner;
  enemySurvivors: number;
  enemyStars: number[];
  drops: Drop[];
  fortressHpAfter: number | null;
  goldBreakdown: RoundGoldBreakdown;
  /** Immediate result gold before persistent win bonus. */
  resultGold: number;
  passiveWinXpSuppressed: boolean;
  defeatIgnored: boolean;
}

export interface RoundResultPreviewContext {
  round: number;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  winStreak: number;
  loseStreak: number;
  lossCondition: LossCondition;
  damageRule: DamageRule;
  creative: boolean;
  /** Persistent + tech win-gold bonus already combined by the run owner. */
  winGoldBonus: number;
  nextRoundBaseIncome?: number;
  incomeMods?: IncomeMods;
  nextRoundIncomeAlreadyPaid?: boolean;
  inventoryRoom?: number;
  validItem?: (id: string) => boolean;
}

export interface RoundResultSummary {
  winner: RoundWinner;
  goldEarned: number;
  xpEarned: number;
  damageTaken: number;
  hpAfter: number;
  nextRound: number;
  gameOver: boolean;
  shouldAdvanceRound: boolean;
  winStreakAfter: number;
  loseStreakAfter: number;
  levelAfter: number;
  xpAfter: number;
  /** Wallet immediately after result rewards, before Planning income. Creative remains unchanged. */
  walletAfterRewards: number;
  incomeEarned: number;
  nextRoundIncomePreview: number;
  goldBreakdown: RoundGoldBreakdown;
  passiveWinXpSuppressed: boolean;
  defeatIgnored: boolean;
  acceptedDrops: Drop[];
  rejectedDrops: Drop[];
}

export interface LootSourceCount { source: string; count: number }
export interface LootPresentationGroup {
  item: string;
  count: number;
  topSources: LootSourceCount[];
  remainingSourceCategories: number;
}

const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const nonNegativeInt = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
const finiteHp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;

export function normalizeRoundResult(input: RoundResultInput, creative = false): NormalizedRoundResult {
  const stars = Array.isArray(input.enemyStars)
    ? input.enemyStars.filter((star) => Number.isFinite(star)).map((star) => Math.max(1, Math.round(star)))
    : [];
  const canonicalPartsPresent = own(input, "enemyUnitGold") || own(input, "enemyStarGold")
    || own(input, "assassinBounty") || own(input, "enemyStars") || own(input, "bounty");
  const enemyUnitBase = own(input, "enemyUnitGold") ? nonNegativeInt(input.enemyUnitGold) : stars.length;
  const enemyStar = own(input, "enemyStarGold")
    ? nonNegativeInt(input.enemyStarGold)
    : stars.reduce((sum, star) => sum + Math.max(0, star - 1), 0);
  const assassinBounty = own(input, "assassinBounty")
    ? nonNegativeInt(input.assassinBounty)
    : nonNegativeInt(input.bounty);
  const legacy = canonicalPartsPresent ? 0 : nonNegativeInt(input.goldDelta);
  const resultGold = canonicalPartsPresent
    ? (input.winner === "LEFT" ? enemyUnitBase + enemyStar + assassinBounty : assassinBounty)
    : legacy;

  return {
    combatId: String(input.combatId),
    winner: input.winner,
    enemySurvivors: nonNegativeInt(input.enemySurvivors),
    enemyStars: stars,
    drops: Array.isArray(input.drops) ? input.drops.filter((drop): drop is Drop => !!drop && typeof drop.item === "string") : [],
    fortressHpAfter: finiteHp(input.fortressHpAfter),
    goldBreakdown: { enemyUnitBase, enemyStar, assassinBounty, winBonus: 0, legacy },
    resultGold,
    passiveWinXpSuppressed: creative,
    defeatIgnored: creative,
  };
}

export function partitionAcceptedDrops(
  drops: readonly Drop[], room: number, validItem: (id: string) => boolean,
): { accepted: Drop[]; rejected: Drop[] } {
  const accepted: Drop[] = [];
  const rejected: Drop[] = [];
  let remaining = Math.max(0, Math.floor(room));
  for (const drop of drops) {
    if (!drop || typeof drop.item !== "string" || !validItem(drop.item) || remaining <= 0) {
      rejected.push(drop);
      continue;
    }
    accepted.push(drop);
    remaining--;
  }
  return { accepted, rejected };
}

/** Core-only presentation model: one row per item with the two most frequent source categories. */
export function groupAcceptedDrops(drops: readonly Drop[]): LootPresentationGroup[] {
  const byItem = new Map<string, { count: number; sources: Map<string, number> }>();
  for (const drop of drops) {
    if (!drop || typeof drop.item !== "string" || !drop.item) continue;
    const group = byItem.get(drop.item) ?? { count: 0, sources: new Map<string, number>() };
    group.count++;
    if (typeof drop.source === "string" && drop.source) {
      group.sources.set(drop.source, (group.sources.get(drop.source) ?? 0) + 1);
    }
    byItem.set(drop.item, group);
  }
  return [...byItem.entries()].map(([item, group]) => {
    const sources = [...group.sources.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
    return {
      item,
      count: group.count,
      topSources: sources.slice(0, 2),
      remainingSourceCategories: Math.max(0, sources.length - 2),
    };
  }).sort((a, b) => a.item.localeCompare(b.item));
}

/** Pure A87 preview. Applying the result must copy these values rather than recompute rewards. */
export function previewRoundResult(context: RoundResultPreviewContext, input: RoundResultInput): RoundResultSummary {
  const normalized = normalizeRoundResult(input, context.creative);
  let winStreakAfter = context.winStreak;
  let loseStreakAfter = context.loseStreak;
  if (normalized.winner === "LEFT") {
    winStreakAfter++;
    loseStreakAfter = 0;
  } else if (normalized.winner === "RIGHT") {
    winStreakAfter = 0;
    loseStreakAfter++;
  } else {
    winStreakAfter = 0;
    loseStreakAfter = 0;
  }

  const winBonus = normalized.winner === "LEFT" ? Math.max(0, Math.round(context.winGoldBonus)) : 0;
  const goldEarned = normalized.resultGold + winBonus;
  const xpEarned = normalized.winner === "LEFT" && !normalized.passiveWinXpSuppressed ? 2 : 0;
  const xpState = addXp(context.level, context.xp, xpEarned);
  const walletAfterRewards = context.creative ? context.gold : context.gold + goldEarned;

  let damageTaken = 0;
  let hpAfter = Math.max(0, Math.round(context.hp));
  let gameOver = false;
  if (normalized.winner === "RIGHT" && !normalized.defeatIgnored) {
    if (context.lossCondition === "NO_HEARTS") {
      if (normalized.fortressHpAfter != null) {
        hpAfter = normalized.fortressHpAfter;
        damageTaken = Math.max(0, Math.round(context.hp) - hpAfter);
      } else {
        damageTaken = lossDamage(context.damageRule, normalized.enemySurvivors);
        hpAfter = Math.max(0, Math.round(context.hp) - damageTaken);
      }
      gameOver = hpAfter <= 0;
    } else {
      gameOver = true;
    }
  } else if (normalized.winner === "DRAW" && normalized.fortressHpAfter != null && !normalized.defeatIgnored) {
    // DRAW never reports normal round damage, but authoritative fortress state still wins.
    hpAfter = normalized.fortressHpAfter;
    gameOver = hpAfter <= 0;
  }

  const shouldAdvanceRound = !gameOver;
  const nextRound = shouldAdvanceRound ? context.round + 1 : context.round;
  const nextRoundIncomePreview = shouldAdvanceRound && !context.creative
    ? roundIncome(
      walletAfterRewards,
      winStreakAfter,
      loseStreakAfter,
      context.nextRoundBaseIncome ?? 5,
      context.incomeMods,
    )
    : 0;
  const incomeEarned = context.nextRoundIncomeAlreadyPaid ? 0 : nextRoundIncomePreview;
  const room = context.inventoryRoom ?? 0;
  const drops = partitionAcceptedDrops(normalized.drops, room, context.validItem ?? (() => true));

  return {
    winner: normalized.winner,
    goldEarned,
    xpEarned,
    damageTaken,
    hpAfter,
    nextRound,
    gameOver,
    shouldAdvanceRound,
    winStreakAfter,
    loseStreakAfter,
    levelAfter: xpState.level,
    xpAfter: xpState.xp,
    walletAfterRewards,
    incomeEarned,
    nextRoundIncomePreview,
    goldBreakdown: { ...normalized.goldBreakdown, winBonus },
    passiveWinXpSuppressed: normalized.passiveWinXpSuppressed,
    defeatIgnored: normalized.defeatIgnored,
    acceptedDrops: drops.accepted,
    rejectedDrops: drops.rejected,
  };
}
