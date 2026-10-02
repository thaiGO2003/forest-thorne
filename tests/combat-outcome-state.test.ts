import { describe, expect, it } from "vitest";
import {
  groupAcceptedDrops, normalizeRoundResult, previewRoundResult, type RoundResultPreviewContext,
} from "../src/core/combatOutcomeState";
import { applyRoundResult, createModeRun, startCombat, type OwnedUnit } from "../src/core/run";
import { NORMAL_UNITS } from "../src/content/catalog";
import { skipTutorial } from "../src/core/tutorial";

const context = (patch: Partial<RoundResultPreviewContext> = {}): RoundResultPreviewContext => ({
  round: 4,
  level: 2,
  xp: 1,
  gold: 20,
  hp: 3,
  winStreak: 1,
  loseStreak: 0,
  lossCondition: "NO_HEARTS",
  damageRule: "onePerLoss",
  creative: false,
  winGoldBonus: 2,
  nextRoundBaseIncome: 10,
  inventoryRoom: 3,
  validItem: (id) => id !== "invalid",
  ...patch,
});

describe("combat result state A87", () => {
  it("normalizes canonical victory parts and only falls back to legacy gold when parts are absent", () => {
    const canonical = normalizeRoundResult({
      combatId: "c", winner: "LEFT", enemyStars: [1, 2, 3], bounty: 4, goldDelta: 99,
    });
    expect(canonical.goldBreakdown).toMatchObject({ enemyUnitBase: 3, enemyStar: 3, assassinBounty: 4, legacy: 0 });
    expect(canonical.resultGold).toBe(10);

    const legacy = normalizeRoundResult({ combatId: "old", winner: "LEFT", goldDelta: 7 });
    expect(legacy.resultGold).toBe(7);
    expect(legacy.goldBreakdown.legacy).toBe(7);
  });

  it("previews exact streak/reward/damage/round state without mutation", () => {
    const ctx = context();
    const before = JSON.stringify(ctx);
    const preview = previewRoundResult(ctx, {
      combatId: "p", winner: "LEFT", enemyStars: [1, 2], bounty: 2,
      drops: [
        { item: "tear", source: "wolf", rule: "material" },
        { item: "invalid", source: "wolf", rule: "material" },
      ],
    });
    expect(JSON.stringify(ctx)).toBe(before);
    expect(preview).toMatchObject({
      goldEarned: 7,
      xpEarned: 2,
      damageTaken: 0,
      hpAfter: 3,
      nextRound: 5,
      gameOver: false,
      shouldAdvanceRound: true,
      winStreakAfter: 2,
      loseStreakAfter: 0,
    });
    expect(preview.acceptedDrops.map((drop) => drop.item)).toEqual(["tear"]);
    expect(preview.rejectedDrops.map((drop) => drop.item)).toEqual(["invalid"]);
    expect(preview.nextRoundIncomePreview).toBeGreaterThan(0);
  });

  it("pays bounty on loss/draw, accepts authoritative fortress HP, and forces draw damage to zero", () => {
    const loss = previewRoundResult(context({ hp: 10, damageRule: "survivorCount" }), {
      combatId: "loss", winner: "RIGHT", enemySurvivors: 9, assassinBounty: 3, fortressHpAfter: 4,
    });
    expect(loss).toMatchObject({ goldEarned: 3, damageTaken: 6, hpAfter: 4, gameOver: false });

    const draw = previewRoundResult(context({ hp: 10 }), {
      combatId: "draw", winner: "DRAW", assassinBounty: 2, fortressHpAfter: 7,
    });
    expect(draw).toMatchObject({ goldEarned: 2, damageTaken: 0, hpAfter: 7, nextRound: 5 });
  });

  it("marks Creative defeat and passive win XP as suppressed while preserving conceptual gold", () => {
    const creativeLoss = previewRoundResult(context({ creative: true, hp: 100, gold: 10 }), {
      combatId: "cl", winner: "RIGHT", enemySurvivors: 99, assassinBounty: 8,
    });
    expect(creativeLoss).toMatchObject({
      goldEarned: 8, walletAfterRewards: 10, hpAfter: 100, defeatIgnored: true, gameOver: false,
      nextRoundIncomePreview: 0,
    });
    const creativeWin = previewRoundResult(context({ creative: true }), {
      combatId: "cw", winner: "LEFT", enemyUnitGold: 3, enemyStarGold: 2, assassinBounty: 1,
    });
    expect(creativeWin).toMatchObject({ xpEarned: 0, passiveWinXpSuppressed: true, goldEarned: 8 });
  });

  it("groups accepted loot by item and source frequency deterministically", () => {
    expect(groupAcceptedDrops([
      { item: "tear", source: "wolf", rule: "material" },
      { item: "tear", source: "wolf", rule: "material" },
      { item: "tear", source: "bear", rule: "material" },
      { item: "tear", source: "crow", rule: "material" },
      { item: "claw", source: "wasp", rule: "material" },
    ])).toEqual([
      { item: "claw", count: 1, topSources: [{ source: "wasp", count: 1 }], remainingSourceCategories: 0 },
      {
        item: "tear", count: 4,
        topSources: [{ source: "wolf", count: 2 }, { source: "bear", count: 1 }],
        remainingSourceCategories: 1,
      },
    ]);
  });

  it("mutation copies the pure preview fields and remains idempotent", () => {
    const s = createModeRun(77, "EndlessPvEClassic");
    skipTutorial(s);
    const unit: OwnedUnit = { uid: "u", baseId: NORMAL_UNITS[0]!.id, star: 1, equips: [] };
    s.board[0] = unit;
    s.round = 4;
    s.incomeRoundsPaid = [1, 2, 3, 4];
    expect(startCombat(s)).toBeNull();
    const input = { combatId: "same", winner: "LEFT" as const, enemyStars: [1, 2], bounty: 2, drops: [] };
    const pure = previewRoundResult(context({
      round: s.round,
      level: s.level,
      xp: s.xp,
      gold: s.gold,
      hp: s.hp,
      winStreak: s.winStreak,
      loseStreak: s.loseStreak,
      winGoldBonus: s.winGoldBonus,
      inventoryRoom: 1,
      validItem: () => true,
    }), input);
    const applied = applyRoundResult(s, input)!;
    expect(applied).toMatchObject({
      winner: pure.winner,
      goldEarned: pure.goldEarned,
      xpEarned: pure.xpEarned,
      damageTaken: pure.damageTaken,
      hpAfter: pure.hpAfter,
      nextRound: pure.nextRound,
      gameOver: pure.gameOver,
      shouldAdvanceRound: pure.shouldAdvanceRound,
      winStreakAfter: pure.winStreakAfter,
      loseStreakAfter: pure.loseStreakAfter,
    });
    expect(applyRoundResult(s, input)).toBeNull();
  });
});
