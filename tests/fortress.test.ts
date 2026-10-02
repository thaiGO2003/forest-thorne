import { describe, expect, it } from "vitest";
import {
  beastDenMaxTier, beastDenOffers, blacksmithForgeTier, completeFortressNode, createFortressState,
  FORTRESS_BUDGET_MULTIPLIER, generateFortressGraph, normalizeFortressState, pharmacyOptions, selectFortressNode,
} from "../src/core/fortress";
import {
  completeRunFortressNode, createModeRun, recruitFortressBeast, resolveFortressBlacksmith,
  resolveFortressPharmacy, selectRunFortressNode,
} from "../src/core/run";

describe("Fortress route and services", () => {
  it("generates deterministic seven-layer graph with authored composition and all-to-next edges", () => {
    const a = generateFortressGraph(42, 1);
    const b = generateFortressGraph(42, 1);
    expect(a).toEqual(b);
    expect(a.layers.map((layer) => layer.length)).toEqual([3, 3, 3, 3, 3, 3, 1]);
    const expected = [
      ["battle", "shop", "beast_den"], ["battle", "pharmacy", "blacksmith"], ["battle", "battle", "shop"],
      ["elite", "pharmacy", "blacksmith"], ["battle", "beast_den", "shop"], ["elite", "battle", "blacksmith"], ["boss"],
    ];
    for (let i = 0; i < a.layers.length; i++) {
      expect(a.layers[i]!.map((node) => node.type).sort()).toEqual([...expected[i]!].sort());
      if (i < 6) for (const node of a.layers[i]!) expect(node.next).toEqual(a.layers[i + 1]!.map((next) => next.id));
    }
    expect(FORTRESS_BUDGET_MULTIPLIER).toMatchObject({ blacksmith: 1.05, elite: 1.25, boss: 1.6 });
  });

  it("latches one legal node at a time and regenerates the next act after boss completion", () => {
    const state = createFortressState(7);
    for (let layer = 0; layer < 7; layer++) {
      const node = state.graph.layers[layer]![0]!;
      expect(selectFortressNode(state, node.id)?.nodeId).toBe(node.id);
      expect(selectFortressNode(state, node.id)).toBeNull();
      expect(completeFortressNode(state)).toBe(true);
    }
    expect([state.actIndex, state.stepIndex, state.pendingNode]).toEqual([2, 0, null]);
    expect(state.graph.actIndex).toBe(2);
  });

  it("uses exact pharmacy, beast-den and blacksmith progression formulas", () => {
    expect(pharmacyOptions(1, 1)).toEqual([
      { id: "restore", kind: "heal", hpDelta: 26, xpDelta: 0, goldDelta: 0 },
      { id: "stimulant", kind: "heal_xp", hpDelta: 18, xpDelta: 2, goldDelta: 0 },
      { id: "supplies", kind: "heal_gold", hpDelta: 14, xpDelta: 0, goldDelta: 2 },
    ]);
    expect([beastDenMaxTier(1, 1), beastDenMaxTier(9, 3), blacksmithForgeTier(9, 3)]).toEqual([1, 4, 4]);
    const offers = beastDenOffers(9, 3, () => 0);
    expect(new Set(offers).size).toBe(offers.length);
    expect(offers.length).toBeLessThanOrEqual(3);
  });

  it("run integration resolves service results without a duplicate Fortress inventory model", () => {
    const s = createModeRun(19, "EndlessPvEFortress");
    const pharmacy = s.fortress.graph.layers[1]!.find((node) => node.type === "pharmacy")!;
    const first = s.fortress.graph.layers[0]![0]!;
    expect(selectRunFortressNode(s, first.id)).toBe(true);
    expect(completeRunFortressNode(s)).toBe(true);
    expect(selectRunFortressNode(s, pharmacy.id)).toBe(true);
    s.hp = 50;
    expect(resolveFortressPharmacy(s, "restore")?.hpDelta).toBeGreaterThan(0);
    expect(resolveFortressPharmacy(s, "restore")).toBeNull();
  });

  it("beast den validates deterministic offered ids and blacksmith records canonical forge tier", () => {
    const s = createModeRun(31, "EndlessPvEFortress");
    const beast = s.fortress.graph.layers[0]!.find((node) => node.type === "beast_den")!;
    expect(selectRunFortressNode(s, beast.id)).toBe(true);
    const offer = s.fortress.pendingNode!.serviceOffers![0]!;
    expect(recruitFortressBeast(s, "not-a-real-unit")).toBe(false);
    expect(recruitFortressBeast(s, offer)).toBe(true);
    expect(s.bench.some((unit) => unit.baseId === offer)).toBe(true);
    expect(completeRunFortressNode(s)).toBe(true);

    // Advance to a layer-2 blacksmith from the selected layer-1 node.
    const smith = s.fortress.graph.layers[1]!.find((node) => node.type === "blacksmith")!;
    expect(selectRunFortressNode(s, smith.id)).toBe(true);
    expect(resolveFortressBlacksmith(s, "forge")).toBe(true);
    expect(s.fortress.pendingNode?.serviceResult).toMatchObject({ kind: "blacksmith", forgeTier: 1, serviceId: "forge" });
    const restored = normalizeFortressState(JSON.parse(JSON.stringify(s.fortress)), 999);
    expect(restored.pendingNode?.serviceResult).toMatchObject({ kind: "blacksmith", forgeTier: 1, serviceId: "forge" });
  });
});
