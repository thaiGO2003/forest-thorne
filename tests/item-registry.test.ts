import { describe, expect, it } from "vitest";
import {
  BASE_MATERIALS, EQUIPMENT, ITEM_REGISTRY, RECIPES, getEquipment, getItem, getRecipe,
  isBaseMaterial, isKnownItem, loadItemRegistry,
} from "../src/core/itemRegistry";

const authoredFixture = () => ({
  materials: ITEM_REGISTRY.materials.map((item) => ({ ...item })),
  equipment: ITEM_REGISTRY.equipment.map((item) => ({ ...item, bonuses: { ...item.bonuses } })),
  recipes: ITEM_REGISTRY.recipes.map((recipe) => ({ ...recipe, pattern: [...recipe.pattern] })),
});

describe("authoritative item registry", () => {
  it("loads exactly the authored catalog and resolves each identity consistently", () => {
    const loaded = loadItemRegistry(authoredFixture());
    expect(BASE_MATERIALS).toEqual(["bark", "feather", "belt", "claw", "tear", "crystal"]);
    expect(EQUIPMENT.map((item) => item.id)).toEqual(["eq_blue_buff", "eq_warmog_armor"]);
    expect(RECIPES).toEqual([{ id: "blue_buff", outputId: "eq_blue_buff", size: 1, pattern: ["tear"] }]);
    expect(loaded.baseMaterialIds).toEqual(BASE_MATERIALS);
    expect(loaded.recipes).toEqual(RECIPES);
    for (const id of BASE_MATERIALS) {
      expect(getItem(id)?.kind).toBe("material");
      expect(isBaseMaterial(id)).toBe(true);
    }
    expect(getEquipment("eq_blue_buff")?.tier).toBe(1);
    expect(getEquipment("eq_warmog_armor")?.tier).toBe(2);
    expect(getRecipe("blue_buff")?.outputId).toBe("eq_blue_buff");
    expect(Object.isFrozen(loaded.recipes[0]?.pattern)).toBe(true);
  });

  it("accepts an acyclic multi-step catalog and exposes immutable canonical definitions", () => {
    const catalog = authoredFixture();
    const loaded = loadItemRegistry({
      ...catalog,
      recipes: [
        ...catalog.recipes,
        { id: "warmog_armor", outputId: "eq_warmog_armor", size: 2,
          pattern: ["eq_blue_buff", "bark", null, null] },
      ],
    });
    expect(loaded.getRecipe("warmog_armor")?.outputId).toBe("eq_warmog_armor");
    expect(loaded.getItem("eq_warmog_armor")).toBe(loaded.getEquipment("eq_warmog_armor"));
    expect(Object.isFrozen(loaded.materials)).toBe(true);
    expect(Object.isFrozen(loaded.equipment[0]?.bonuses)).toBe(true);
    expect(Object.isFrozen(loaded.recipes[1]?.pattern)).toBe(true);
  });

  it("treats unknown saved identities as inert rather than guessing definitions", () => {
    expect(getItem("eq_not_authored")).toBeNull();
    expect(getEquipment("eq_not_authored")).toBeNull();
    expect(getEquipment("tear")).toBeNull();
    expect(getRecipe("not_authored")).toBeNull();
    expect(isKnownItem("eq_not_authored")).toBe(false);
    expect(isBaseMaterial("eq_not_authored")).toBe(false);
  });

  it("rejects missing catalog fields, duplicate item IDs and ID namespace collisions", () => {
    expect(() => loadItemRegistry({})).toThrow(/materials array/);
    const catalog = authoredFixture();
    expect(() => loadItemRegistry({
      ...catalog, materials: [...catalog.materials, { ...catalog.materials[0]! }],
    })).toThrow(/duplicate item ID bark/);
    expect(() => loadItemRegistry({
      ...catalog, equipment: [...catalog.equipment, { ...catalog.equipment[0]!, id: "tear" }],
    })).toThrow(/duplicate item ID tear/);
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, id: "tear" }],
    })).toThrow(/duplicate recipe ID tear/);
    expect(() => loadItemRegistry({
      ...catalog, recipes: [...catalog.recipes, { ...catalog.recipes[0]!, pattern: ["bark"] }],
    })).toThrow(/duplicate recipe ID blue_buff/);
  });
  it("rejects ambiguous equipment names used by normalization", () => {
    const catalog = authoredFixture();
    expect(() => loadItemRegistry({
      ...catalog,
      equipment: [catalog.equipment[0]!, { ...catalog.equipment[1]!, nameKey: catalog.equipment[0]!.nameKey }],
    })).toThrow(/duplicate equipment nameKey blue_buff/);
  });


  it("rejects invalid equipment tiers and invalid bonus payloads", () => {
    const catalog = authoredFixture();
    for (const tier of [0, -1, 4, 1.5, Number.NaN]) {
      expect(() => loadItemRegistry({
        ...catalog, equipment: [{ ...catalog.equipment[0]!, tier }, catalog.equipment[1]!],
      })).toThrow(/invalid equipment tier/);
    }
    expect(() => loadItemRegistry({
      ...catalog, equipment: [{ ...catalog.equipment[0]!, bonuses: { atkPct: "not_a_number" } }, catalog.equipment[1]!],
    })).toThrow(/invalid bonus/);
  });

  it("rejects unresolved outputs and unknown ingredients before making a registry", () => {
    const catalog = authoredFixture();
    for (const outputId of ["eq_not_authored", "tear"]) {
      expect(() => loadItemRegistry({
        ...catalog, recipes: [{ ...catalog.recipes[0]!, outputId }],
      })).toThrow(/unknown recipe output/);
    }
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: ["unregistered_material"] }],
    })).toThrow(/unknown recipe ingredient/);
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: [123] }],
    })).toThrow(/unknown recipe ingredient/);
  });

  it("rejects invalid grid sizes, malformed footprints and empty patterns", () => {
    const catalog = authoredFixture();
    for (const size of [0, 4, -1, 1.5]) {
      expect(() => loadItemRegistry({
        ...catalog, recipes: [{ ...catalog.recipes[0]!, size }],
      })).toThrow(/invalid recipe grid size/);
    }
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: ["tear", null] }],
    })).toThrow(/invalid recipe pattern length/);
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: [null] }],
    })).toThrow(/empty recipe pattern/);
  });

  it("rejects translated pattern collisions even across different grid sizes", () => {
    const catalog = authoredFixture();
    expect(() => loadItemRegistry({
      ...catalog,
      recipes: [
        ...catalog.recipes,
        { id: "warmog_armor", outputId: "eq_warmog_armor", size: 2, pattern: [null, null, null, "tear"] },
      ],
    })).toThrow(/colliding recipes blue_buff and warmog_armor/);
  });

  it("rejects self-referential and multi-step equipment crafting cycles", () => {
    const catalog = authoredFixture();
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: ["eq_blue_buff"] }],
    })).toThrow(/recipe dependency cycle/);

    expect(() => loadItemRegistry({
      ...catalog,
      recipes: [
        { ...catalog.recipes[0]!, pattern: ["eq_warmog_armor"] },
        { id: "warmog_armor", outputId: "eq_warmog_armor", size: 1, pattern: ["eq_blue_buff"] },
      ],
    })).toThrow(/recipe dependency cycle/);
  });

  it("keeps the runtime authority unchanged after a fixture fails validation", () => {
    const firstMaterial = ITEM_REGISTRY.getItem("tear");
    const catalog = authoredFixture();
    expect(() => loadItemRegistry({
      ...catalog, recipes: [{ ...catalog.recipes[0]!, pattern: ["eq_blue_buff"] }],
    })).toThrow();
    expect(ITEM_REGISTRY.getItem("tear")).toBe(firstMaterial);
    expect(getRecipe("blue_buff")?.pattern).toEqual(["tear"]);
  });
});
