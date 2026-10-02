import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { equipmentCategory, getEquipment, normalizeEquipment } from "../src/core/equipment";
import { makeFighter } from "../src/core/combat";
import { normalizeVariantTraits, rollVariantTrait, sumVariantBonuses, VARIANTS_BY_ROLE } from "../src/core/variants";

describe("variant traits and equipment contracts", () => {
  it("rolls one deterministic trait from the requested role and normalizes ancestry", () => {
    const a = rollVariantTrait("TANKER", 123);
    const b = rollVariantTrait("TANKER", 123);
    expect(a).toEqual(b);
    expect(VARIANTS_BY_ROLE.TANKER.some((t) => t.id === a.id)).toBe(true);
    const normalized = normalizeVariantTraits("TANKER", [a, { id: "mage_focus_spell", seed: 2 }, { id: a.id, seed: -1 }]);
    expect(normalized).toHaveLength(2);
    expect(normalized[1]!.seed).toBeGreaterThanOrEqual(0);
  });

  it("sums authored trait bonuses and applies them to fresh combat materialization", () => {
    const unit = NORMAL_UNITS.find((u) => u.role === "TANKER")!;
    const traits = [
      { id: "tanker_thick_armor", seed: 1 },
      { id: "tanker_rebound", seed: 2 },
    ];
    expect(sumVariantBonuses("TANKER", traits)).toMatchObject({ def: 6, hpPct: 4, startingShield: 18 });
    const plain = makeFighter({ uid: "p", baseId: unit.id, star: 1, row: 0, col: 0 }, "L");
    const boosted = makeFighter({ uid: "b", baseId: unit.id, star: 1, row: 0, col: 0, traits }, "L");
    expect(boosted.maxHp).toBeGreaterThan(plain.maxHp);
    expect(boosted.def).toBe(plain.def + 6);
    expect(boosted.shield).toBe(18);
  });

  it("equipment normalization rejects invalid, duplicate and over-tier ids without guessing bonuses", () => {
    const n = normalizeEquipment(["eq_blue_buff", "ghost", "eq_blue_buff", "eq_warmog_armor"], 1, 3);
    expect(n.kept).toEqual(["eq_blue_buff"]);
    expect(n.rejected).toEqual(["ghost", "eq_blue_buff", "eq_warmog_armor"]);
    expect(equipmentCategory(getEquipment("eq_blue_buff")!)).toBe("offense");
  });
});
