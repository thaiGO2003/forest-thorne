import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { MODE_CONFIG, normalizeAvailableMode } from "../src/core/modes";
import {
  applyRoundResult, chooseAugment, createModeRun, createRun, nextRoundIncomePreview, startCombat,
  type OwnedUnit,
} from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";

const owned = (uid: string): OwnedUnit => ({ uid, baseId: NORMAL_UNITS[0]!.id, star: 1, equips: [] });
const normalRun = (seed: number) => { const s = createRun(seed); skipTutorial(s); return s; };

describe("game modes and run lifecycle", () => {
  it("production availability exposes Classic while retaining gated mode contracts", () => {
    expect(normalizeAvailableMode("EndlessPvEFortress")).toBe("EndlessPvEClassic");
    expect(MODE_CONFIG.EndlessPvEFortress.available).toBe(false);
    expect(MODE_CONFIG.EndlessPvEFortress.enemyScale(11)).toBeCloseTo(1.05);
    expect(createRun(1)).toMatchObject({ mode: "EndlessPvEClassic", hp: 3, gold: 10, lossCondition: "NO_HEARTS" });
  });

  it("Classic loss is one heart, result id is idempotent, and round income pays once", () => {
    const s = normalRun(2);
    s.board[0] = owned("a");
    expect(startCombat(s)).toBeNull();
    const beforePreview = JSON.stringify(s);
    expect(nextRoundIncomePreview(s)).toBeGreaterThan(0);
    expect(JSON.stringify(s)).toBe(beforePreview);
    const result = applyRoundResult(s, {
      combatId: "c1", winner: "RIGHT", enemySurvivors: 5, enemyStars: [1, 1], bounty: 0, drops: [],
    })!;
    expect(result.damageTaken).toBe(1);
    expect([s.hp, s.round, result.incomeEarned]).toEqual([2, 2, 11]);
    const after = JSON.stringify(s);
    expect(applyRoundResult(s, {
      combatId: "c1", winner: "RIGHT", enemySurvivors: 5, enemyStars: [1], bounty: 0, drops: [],
    })).toBeNull();
    expect(JSON.stringify(s)).toBe(after);
  });

  it("win applies canonical gold/XP, capacity-bounded loot and round-3 augment gate", () => {
    const s = normalRun(3);
    s.round = 2;
    s.incomeRoundsPaid = [1, 2];
    s.board[0] = owned("a");
    startCombat(s);
    const gold = s.gold;
    const result = applyRoundResult(s, {
      combatId: "c2", winner: "LEFT", enemySurvivors: 0, enemyStars: [1, 2], bounty: 2,
      drops: [
        { item: "tear", source: "x", rule: "material" },
        { item: "claw", source: "x", rule: "material" },
      ],
    })!;
    expect(result.goldEarned).toBe(5); // 2 enemy base + 1 star + 2 bounty
    expect(result.rewardBreakdown).toEqual({
      baseWinGold: 2,
      starWinGold: 1,
      bountyGold: 2,
      winBonusGold: 0,
    });
    expect(result.xpEarned).toBe(2);
    expect(s.gold).toBeGreaterThan(gold + result.goldEarned); // includes round-3 income
    expect(s.itemBag).toHaveLength(1); // one owned unit -> inventory capacity 1
    expect(s.phase).toBe("AUGMENT");
    expect(new Set(s.activeAugmentChoices).size).toBe(3);
    expect(chooseAugment(s, s.activeAugmentChoices[0]!)).toBe(true);
    expect(s.phase).toBe("PLANNING");
    expect(s.augmentRoundsTaken).toEqual([3]);
  });

  it("HP-based Fortress uses survivor-count damage while Creative ignores defeat/wallet result mutation", () => {
    const fortress = createModeRun(4, "EndlessPvEFortress");
    fortress.board[0] = owned("f");
    startCombat(fortress);
    applyRoundResult(fortress, { combatId: "f1", winner: "RIGHT", enemySurvivors: 6, enemyStars: [], bounty: 0, drops: [] });
    expect([fortress.hp, fortress.phase]).toEqual([94, "PLANNING"]);

    const creative = createModeRun(5, "EndlessCreative");
    skipTutorial(creative);
    creative.board[0] = owned("c");
    startCombat(creative);
    const gold = creative.gold;
    applyRoundResult(creative, { combatId: "z", winner: "RIGHT", enemySurvivors: 99, enemyStars: [], bounty: 8, drops: [] });
    expect([creative.gold, creative.hp, creative.phase]).toEqual([gold, 100, "PLANNING"]);
  });

  it("Creative economy treats costs as free and suppresses ordinary wallet gains", async () => {
    const { buy, buyXp, refresh, research, sell, sellItem } = await import("../src/core/run");
    const s = createModeRun(6, "EndlessCreative");
    skipTutorial(s);
    s.gold = 0;
    const offer = s.shop.findIndex(Boolean);
    expect(offer).toBeGreaterThanOrEqual(0);
    expect(buy(s, offer)).toBe(true);
    expect(refresh(s)).toBe(true);
    expect(buyXp(s)).toBe(true);
    expect(research(s, "vet")).toBe(true);
    expect(s.gold).toBe(0);
    s.itemBag.push("tear");
    expect(sellItem(s, s.itemBag.length - 1)).toBe(true);
    expect(sell(s, "bench", 0)).toBe(true);
    expect(s.gold).toBe(0);
  });
});

