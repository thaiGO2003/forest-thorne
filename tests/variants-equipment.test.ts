import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { equipmentCategory, normalizeEquipment, slotCapForUnit } from "../src/core/equipment";
import { getEquipment } from "../src/core/itemRegistry";
import { materializeCombat } from "../src/core/combat";
import { normalizeVariantTraits, rollVariantTrait, sumVariantBonuses, VARIANT_TRAITS, VARIANTS_BY_ROLE } from "../src/core/variants";

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
    const plain = materializeCombat([{ uid: "p", baseId: unit.id, star: 1, row: 0, col: 0 }], [])[0]!;
    const boosted = materializeCombat([{ uid: "b", baseId: unit.id, star: 1, row: 0, col: 0, traits }], [])[0]!;
    expect(boosted.maxHp).toBeGreaterThan(plain.maxHp);
    expect(boosted.def).toBe(plain.def + 6);
    expect(boosted.shield).toBe(18);
  });

  it("keeps every ported trait named and id-stable for old-src save ancestry", () => {
    expect(VARIANT_TRAITS).toHaveLength(30);
    expect(new Set(VARIANT_TRAITS.map((trait) => trait.id)).size).toBe(30);
    for (const trait of VARIANT_TRAITS) {
      expect(trait.nameVi.trim().length, trait.id).toBeGreaterThan(1);
    }
    expect(VARIANT_TRAITS.find((trait) => trait.id === "fighter_endurance")?.nameVi).toBe("Bền Bỉ");
    expect(VARIANT_TRAITS.find((trait) => trait.id === "fighter_crushing_guard")?.nameVi).toBe("Phá Thế");
  });

  it("caps equipment slots by star: 1★ one, 2★ two, 3★ three", () => {
    const unit = NORMAL_UNITS[0]!;
    const rageCaps = unit.skill.rageCost;
    expect(slotCapForUnit(unit, 1)).toBe(rageCaps[0]);
    expect(slotCapForUnit(unit, 2)).toBe(rageCaps[1]);
    expect(slotCapForUnit(unit, 3)).toBe(rageCaps[2]);
    expect(slotCapForUnit(unit, 0)).toBe(rageCaps[0]);
    expect(slotCapForUnit(unit, 9)).toBe(rageCaps[2]);
  });

  it("equipment normalization rejects invalid, duplicate and over-tier ids without guessing bonuses", () => {
    const n = normalizeEquipment(["eq_blue_buff", "ghost", "eq_blue_buff", "eq_aegis_oath"], 1, 3);
    expect(n.kept).toEqual(["eq_blue_buff"]);
    expect(n.rejected).toEqual(["ghost", "eq_blue_buff", "eq_aegis_oath"]);
    expect(equipmentCategory(getEquipment("eq_blue_buff")!)).toBe("magic");
  });
});
