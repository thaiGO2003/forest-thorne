import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { MODE_CONFIG, normalizeAvailableMode } from "../src/core/modes";
import {
  applyRoundResult, chooseAugment, createModeRun, createRun, nextRoundIncomePreview, startCombat,
  type OwnedUnit,
} from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
import { applyFinishFast, finishFastCost, FINISH_FAST_BASE_COST } from "../src/core/combatFast";

const owned = (uid: string): OwnedUnit => ({ uid, baseId: NORMAL_UNITS[0]!.id, star: 1, equips: [] });
const normalRun = (seed: number) => { const s = createRun(seed); skipTutorial(s); return s; };

describe("game modes and run lifecycle", () => {
  it("production availability exposes Classic while retaining gated mode contracts", () => {
    expect(normalizeAvailableMode("EndlessPvEFortress")).toBe("EndlessPvEClassic");
    expect(MODE_CONFIG.EndlessPvEFortress.available).toBe(false);
    expect(MODE_CONFIG.EndlessPvEFortress.enemyScale(11)).toBeCloseTo(1.05);
    expect(createRun(1)).toMatchObject({ mode: "EndlessPvEClassic", hp: 3, gold: 10, lossCondition: "NO_HEARTS" });
  });

  it("Classic reserves one heart at combat start, consumes survivor damage on loss, and stays idempotent", () => {
    const s = normalRun(2);
    s.board[0] = owned("a");
    expect(startCombat(s)).toBeNull();
    expect([s.hp, s.heartEscrow]).toEqual([2, 1]);
    const beforePreview = JSON.stringify(s);
    expect(nextRoundIncomePreview(s)).toBeGreaterThan(0);
    expect(JSON.stringify(s)).toBe(beforePreview);
    const result = applyRoundResult(s, {
      combatId: "c1", winner: "RIGHT", enemySurvivors: 5, enemyStars: [1, 1], bounty: 0, drops: [],
    })!;
    expect(result.damageTaken).toBe(1);
    expect([s.hp, s.heartEscrow, s.round, result.incomeEarned]).toEqual([1, 0, 2, 11]);
    const after = JSON.stringify(s);
    expect(applyRoundResult(s, {
      combatId: "c1", winner: "RIGHT", enemySurvivors: 5, enemyStars: [1], bounty: 0, drops: [],
    })).toBeNull();
    expect(JSON.stringify(s)).toBe(after);
  });

  it("Classic refunds exactly the reserved heart on victory", () => {
    const s = normalRun(12);
    s.board[0] = owned("refund");
    const before = s.hp;
    expect(startCombat(s)).toBeNull();
    expect([s.hp, s.heartEscrow]).toEqual([before - 1, 1]);
    const result = applyRoundResult(s, {
      combatId: "refund", winner: "LEFT", enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [],
    });
    expect(result?.winner).toBe("LEFT");
    expect([s.hp, s.heartEscrow]).toEqual([before, 0]);
  });

  it("Finish Fast charges exactly 10 gold without changing canonical round-result math", () => {
    const normal = normalRun(14);
    const fast = normalRun(14);
    for (const s of [normal, fast]) {
      s.board[0] = owned("fast");
      s.gold = 20;
      expect(startCombat(s)).toBeNull();
    }
    const input = {
      combatId: "finish-fast",
      winner: "DRAW" as const,
      enemySurvivors: 0,
      enemyStars: [],
      bounty: 0,
      drops: [],
    };
    const normalResult = applyRoundResult(normal, input);
    const fastResult = applyFinishFast(fast, input);
    expect(fastResult).toEqual(normalResult);
    expect(fast.gold).toBe(normal.gold - FINISH_FAST_BASE_COST);
    expect([fast.round, fast.phase, fast.heartEscrow]).toEqual([normal.round, normal.phase, normal.heartEscrow]);
    const after = JSON.stringify(fast);
    expect(applyFinishFast(fast, input)).toBeNull();
    expect(JSON.stringify(fast)).toBe(after);
  });

  it("Finish Fast rejects insufficient gold atomically and ignores unrelated unequip discount", () => {
    const s = normalRun(15);
    s.board[0] = owned("poor");
    s.gold = FINISH_FAST_BASE_COST - 1;
    s.unequipDiscount = 999;
    expect(startCombat(s)).toBeNull();
    const before = JSON.stringify(s);
    expect(applyFinishFast(s, {
      combatId: "finish-fast-poor", winner: "DRAW", enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [],
    })).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });

  it("Finish Fast applies only its dedicated tech discount and checks the discounted balance atomically", () => {
    const s = normalRun(16);
    s.board[0] = owned("discounted");
    s.techLevels.speed = 3;
    s.speedLevel = 3;
    expect(finishFastCost(s)).toBe(7);
    s.gold = 6;
    expect(startCombat(s)).toBeNull();
    const before = JSON.stringify(s);
    expect(applyFinishFast(s, {
      combatId: "finish-fast-discount-poor", winner: "DRAW", enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [],
    })).toBeNull();
    expect(JSON.stringify(s)).toBe(before);

    s.gold = 7;
    const normal = normalRun(17);
    normal.board[0] = owned("discount-control");
    normal.gold = 7;
    expect(startCombat(normal)).toBeNull();
    const input = {
      combatId: "finish-fast-discount", winner: "DRAW" as const, enemySurvivors: 0, enemyStars: [], bounty: 0, drops: [],
    };
    const baseline = applyRoundResult(normal, input);
    const discounted = applyFinishFast(s, input);
    expect(discounted).toEqual(baseline);
    expect(s.gold).toBe(normal.gold - 7);
  });


  it("Classic loss can reach GAME_OVER after the reserved heart and survivor damage", () => {
    const s = normalRun(13);
    s.hp = 1;
    s.board[0] = owned("last-heart");
    expect(startCombat(s)).toBeNull();
    expect([s.hp, s.heartEscrow]).toEqual([0, 1]);
    const result = applyRoundResult(s, {
      combatId: "last-heart", winner: "RIGHT", enemySurvivors: 1, enemyStars: [], bounty: 0, drops: [],
    });
    expect(result?.gameOver).toBe(true);
    expect([s.hp, s.heartEscrow, s.phase]).toEqual([0, 0, "GAME_OVER"]);
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
    expect([fortress.hp, fortress.phase]).toEqual([93, "PLANNING"]);

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
    expect(buy(s, offer)).toEqual({ merges: 0 });
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

