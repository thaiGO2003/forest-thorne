import { describe, expect, it } from "vitest";
import { ITEMS } from "../src/content/items";
import { activeIndices, BASE_MATERIALS, craft, matchRecipe, RECIPES } from "../src/core/craft";
import { EQUIPMENT, getEquipment } from "../src/core/equipment";
import { equipmentBonusCopy, hasItemArt, itemDisplayName, itemIconChar } from "../src/core/itemPresentation";

describe("classic item/recipe DB port", () => {
  it("ports every authored T1..T3 recipe with a unique, closed pattern", () => {
    expect(ITEMS).toHaveLength(205);
    expect(EQUIPMENT).toHaveLength(ITEMS.length);
    expect(RECIPES).toHaveLength(ITEMS.length);
    expect(new Set(RECIPES.map((recipe) => recipe.pattern.map((cell) => cell ?? "").join("|"))).size).toBe(RECIPES.length);
    const known = new Set<string>([...BASE_MATERIALS, ...EQUIPMENT.map((item) => item.id)]);
    for (const item of ITEMS) {
      expect(item.pattern).toHaveLength(item.size * item.size);
      expect(item.tier).toBe(item.size);
      for (const cell of item.pattern) if (cell) expect(known.has(cell)).toBe(true);
      const equipment = getEquipment(`eq_${item.id}`);
      expect(equipment?.tier).toBe(item.tier);
      expect(equipment?.bonuses).toEqual(item.bonuses);
    }
  });

  it("keeps the classic starter gear and translated bonuses", () => {
    expect(getEquipment("eq_warmog_armor")?.tier).toBe(1);
    expect(getEquipment("eq_warmog_armor")?.bonuses).toEqual({ hpPct: 15 });
    expect(getEquipment("eq_blue_buff")?.bonuses).toEqual({ startingRage: 1 });
    expect(getEquipment("eq_aegis_oath")).toMatchObject({
      tier: 2,
      nameVi: "Thệ Ước Hộ Vệ",
      bonuses: { hpPct: 20, def: 18, mdef: 12 },
    });
    expect(itemDisplayName("eq_aegis_oath")).toBe("Thệ Ước Hộ Vệ");
    expect(itemDisplayName("bark")).toBe("Gỗ Cứng");
    expect(hasItemArt("eq_warmog_armor")).toBe(true);
    expect(hasItemArt("eq_aegis_oath")).toBe(false);
    expect(itemIconChar("eq_aegis_oath")).toBe("🛡️");
    expect(equipmentBonusCopy({ hpPct: 20, def: 18, mdef: 12 })).toContain("+20%");
  });

  it("matches the ported 2×2 and 3×3 grids on the real workbench", () => {
    const two = ["eq_bramble_vest", "bark", "belt", "crystal"];
    const staged2 = Array<string | null>(9).fill(null);
    [0, 1, 3, 4].forEach((cell, index) => { staged2[cell] = two[index]!; });
    expect(matchRecipe(staged2, 2)?.id).toBe("aegis_oath");

    const recipe = RECIPES.find((entry) => entry.size === 3)!;
    const staged3 = Array<string | null>(9).fill(null);
    recipe.pattern.forEach((cell, index) => { staged3[index] = cell; });
    expect(matchRecipe(staged3, 3)?.id).toBe(recipe.id);
  });

  it("commits a ported 2×2 craft atomically", () => {
    const staged = Array<string | null>(9).fill(null);
    ["eq_bramble_vest", "bark", "belt", "crystal"].forEach((cell, index) => { staged[[0, 1, 3, 4][index]!] = cell; });
    const state = { itemBag: ["eq_bramble_vest", "bark", "belt", "crystal"], craftTableLevel: 2, craftHistory: [] };
    expect(craft(state, staged)).toBe("eq_aegis_oath");
    expect(state.itemBag).toEqual(["eq_aegis_oath"]);
    expect(state.craftHistory).toEqual(["aegis_oath"]);
  });

  it("does not emit the unreachable T4 gear or the duplicate classic id", () => {
    expect(ITEMS.some((item) => item.tier > 3)).toBe(false);
    expect(ITEMS.filter((item) => item.id === "bua_hac_am")).toHaveLength(1);
    expect(getEquipment("eq_bua_hac_am")?.tier).toBe(3);
  });

  it("matches every ported recipe on its own workbench level", () => {
    for (const recipe of RECIPES) {
      const staged = Array<string | null>(9).fill(null);
      const active = activeIndices(recipe.size);
      recipe.pattern.forEach((cell, index) => { staged[active[index]!] = cell; });
      expect(matchRecipe(staged, recipe.size)?.id, recipe.id).toBe(recipe.id);
    }
  });
});
