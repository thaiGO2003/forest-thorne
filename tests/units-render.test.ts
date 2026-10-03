import { describe, expect, it } from "vitest";
import { UNITS } from "../src/content/catalog";
import { createUnitModel } from "../src/world/units/factory";

describe("unit model factory (spec §22, A24, A90)", () => {
  it("builds all 125 units without throwing", () => {
    for (const u of UNITS) {
      const model = createUnitModel(u.id, 1);
      expect(model.root).toBeDefined();
      expect(model.root.children.length).toBeGreaterThan(0);
      model.setState("idle");
      model.update(0.016);
      model.setState("attack");
      model.update(0.016);
      model.setState("skill");
      model.update(0.016);
      model.setState("hit");
      model.update(0.016);
      model.setState("move");
      model.update(0.016);
      model.dispose();
    }
  });

  it("adds scale and star badges for 2★ and 3★", () => {
    const m1 = createUnitModel("ant_guard", 1);
    const m2 = createUnitModel("ant_guard", 2);
    const m3 = createUnitModel("ant_guard", 3);

    expect(m2.root.scale.x).toBeGreaterThan(m1.root.scale.x);
    expect(m3.root.scale.x).toBeGreaterThan(m2.root.scale.x);

    // 2★ has 2 star spheres, 3★ has 3 star spheres
    expect(m2.root.children.length).toBeGreaterThan(m1.root.children.length);
    expect(m3.root.children.length).toBeGreaterThan(m2.root.children.length);

    m1.dispose();
    m2.dispose();
    m3.dispose();
  });
});
