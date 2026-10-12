import { describe, expect, it } from "vitest";
import { UNITS } from "../src/content/catalog";
import { BASE_MATERIALS } from "../src/core/craft";
import { itemDisplayName, itemSemanticIcon } from "../src/core/itemPresentation";
import {
  applyOutcome, groupDrops, lossDamage, materialCandidates, rollEquipmentLoot, rollMaterialLoot, type RewardTarget,
} from "../src/core/loot";

const seq = (...v: number[]) => () => v.shift() ?? 0.99;
const target = (): RewardTarget => ({ gold: 0, hp: 10, xpGain: 0, itemBag: [], winStreak: 0, loseStreak: 0, winGoldBonus: 1, appliedCombats: [] });

describe("loot", () => {
  it("every unit yields ≥1 valid base material candidate, deduplicated", () => {
    for (const u of UNITS) {
      const c = materialCandidates(u);
      expect(c.length).toBeGreaterThan(0);
      expect(new Set(c).size).toBe(c.length);
      for (const m of c) expect(BASE_MATERIALS as readonly string[]).toContain(m);
    }
  });

  it("first material candidate always drops; extras stay tier-gated", () => {
    const id = UNITS.find((u) => materialCandidates(u).length === 1)!.id;
    expect(rollMaterialLoot(id, seq(0.99)).map((d) => d.rule)).toEqual(["material"]);
    const multi = UNITS.find((u) => materialCandidates(u).length >= 2)!.id;
    expect(rollMaterialLoot(multi, seq(0, 0.99)).length).toBe(2);
  });

  it("equipment roll uses a strict 5% boundary and uniform exact-tier selection", () => {
    const pool = [{ id: "first", tier: 1 }, { id: "second", tier: 1 }] as const;
    expect(rollEquipmentLoot(1, seq(0.049, 0), pool)).toEqual([
      { item: "first", source: "1", rule: "equipment" },
    ]);
    expect(rollEquipmentLoot(1, seq(0.05, 0), pool)).toEqual([]);
    expect(rollEquipmentLoot(1, seq(0.049, 0.75), pool)[0]?.item).toBe("second");
  });

  it("equipment tier clamps to 1..3, never downgrades, and records the enemy star", () => {
    const pool = [{ id: "a1", tier: 1 }, { id: "b2", tier: 2 }] as const;
    expect(rollEquipmentLoot(0, seq(0.01, 0), pool)).toEqual([
      { item: "a1", source: "0", rule: "equipment" },
    ]);
    expect(rollEquipmentLoot(2, seq(0.01, 0), pool)[0]?.item).toBe("b2");
    expect(rollEquipmentLoot(4, seq(0.01, 0), pool)).toEqual([]);
  });

  it("groups accepted loot by item while preserving the total quantity", () => {
    const drops = [
      { item: "tear", source: "a", rule: "material" as const },
      { item: "eq_blue_buff", source: "1", rule: "equipment" as const },
      { item: "tear", source: "b", rule: "material" as const },
    ];
    expect(groupDrops(drops)).toEqual({
      total: 3,
      groups: [
        { item: "tear", quantity: 2 },
        { item: "eq_blue_buff", quantity: 1 },
      ],
    });
  });
  it("resolves canonical localized names and semantic icon hooks for loot items", () => {
    expect(itemDisplayName("bark")).toBe("Vỏ Cây");
    expect(itemDisplayName("eq_blue_buff")).toBe("Bùa Xanh");
    expect(itemSemanticIcon("bark")).toBe("leaf");
    expect(itemSemanticIcon("eq_warmog_armor")).toBe("shield");
  });

  it("damage rules", () => {
    expect([lossDamage("onePerLoss", 5), lossDamage("survivorCount", 5), lossDamage("clamped", 7), lossDamage("clamped", 0)]).toEqual([1, 5, 4, 0]);
  });

  it("win gold = enemy count + star bonus + bounty + winGoldBonus; idempotent; capacity-bounded loot", () => {
    const t = target();
    const drops = ["x", "y", "z"].map((item) => ({ item, source: "s", rule: "material" as const }));
    const o = { combatId: "c1", won: true, enemySurvivors: 0, enemyStars: [1, 2, 3], bounty: 2, drops };
    const r = applyOutcome(t, o, 2, "clamped")!;
    expect(r.gold).toBe(3 + 3 + 2 + 1);
    expect(t.itemBag).toEqual(["x", "y"]);
    expect(r.rejected.map((d) => d.item)).toEqual(["z"]);
    expect(t.xpGain).toBe(2);
    expect(applyOutcome(t, o, 9, "clamped")).toBeNull();
    expect(t.gold).toBe(9);
  });

  it("loss pays bounty, applies mode damage, flips streak", () => {
    const t = target();
    t.winStreak = 3;
    applyOutcome(t, { combatId: "c2", won: false, enemySurvivors: 3, enemyStars: [1], bounty: 1, drops: [] }, 5, "survivorCount");
    expect([t.gold, t.hp, t.winStreak, t.loseStreak]).toEqual([1, 7, 0, 1]);
  });
});
