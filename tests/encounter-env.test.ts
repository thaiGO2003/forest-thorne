import { describe, expect, it } from "vitest";
import { makeFighter, simulate } from "../src/core/combat";
import { bossForRound, encounterBudget, generateEncounter, normalizeAiMode } from "../src/core/encounter";
import { environmentFor, environmentMods } from "../src/core/environment";
import { NORMAL_UNITS } from "../src/content/catalog";

const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

describe("environment A32", () => {
  it("cycles FIRE..WOOD every 8 rounds; round <1 clamps to FIRE", () => {
    expect([1, 2, 8, 9, 16, 0].map(environmentFor)).toEqual(["FIRE", "TIDE", "WOOD", "FIRE", "WOOD", "FIRE"]);
  });
  it("match buff vs non-match debuff, fresh object each call", () => {
    expect(environmentMods("STONE", "STONE").startShield).toBe(18);
    expect(environmentMods("STONE", "FIRE")).toMatchObject({ def: -6, mdef: -4, startShield: 0 });
    const a = environmentMods("FIRE", "WOOD");
    a.fireVuln = 9;
    expect(environmentMods("FIRE", "WOOD").fireVuln).toBe(1.25);
  });
  it("applies to combat copy: STONE shield, SWARM aura damages non-matching", () => {
    const stone = NORMAL_UNITS.find((u) => u.element === "STONE")!;
    const other = NORMAL_UNITS.find((u) => u.element !== "STONE" && u.element !== "SWARM")!;
    const p = { uid: "a", baseId: stone.id, star: 1, row: 2, col: 4 };
    expect(makeFighter(p, "L", {}, "STONE").shield).toBe(18);
    expect(makeFighter({ ...p, baseId: other.id }, "L", {}, "STONE").def).toBe(makeFighter({ ...p, baseId: other.id }, "L").def - 6);
    const r = simulate([{ ...p, baseId: other.id }], [{ uid: "b", baseId: other.id, star: 1, row: 2, col: 5 }], { seed: 3, environment: "SWARM" });
    expect(r.events.some((e) => e.t === "dot" && e.kind === "poisonAura")).toBe(true);
  });
});

describe("encounter A33/A34", () => {
  it("boss every 10 rounds, rotates, 3★ at row 2 col 7", () => {
    expect([10, 20, 50, 60, 15].map(bossForRound)).toEqual(["boss_ember_dragon", "boss_storm_phoenix", "boss_tempest_jelly", "boss_ember_dragon", null]);
    const e = generateEncounter({ round: 30, mode: "MEDIUM", rng: rng(1), bossRounds: true });
    expect(e.units).toEqual([{ uid: "e0", baseId: "boss_venom_hydra", star: 3, row: 2, col: 7 }]);
  });
  it("budget formula and unknown mode fallback", () => {
    expect(encounterBudget(10, "HARD")).toBe(Math.round((8 + 26) * 1.05));
    expect(encounterBudget(10, "MEDIUM", true)).toBe(29);
    expect(normalizeAiMode("nope")).toBe("MEDIUM");
  });
  it("deterministic, unique enemy cells, solo ≤15, stars within mode cap", () => {
    for (const mode of ["EASY", "MEDIUM", "HARD"] as const) {
      for (let round = 1; round <= 40; round++) {
        const a = generateEncounter({ round, mode, rng: rng(round) });
        expect(generateEncounter({ round, mode, rng: rng(round) })).toEqual(a);
        expect(a.units.length).toBeLessThanOrEqual(15);
        expect(new Set(a.units.map((u) => `${u.row},${u.col}`)).size).toBe(a.units.length);
        expect(a.units.every((u) => u.col >= 5 && u.col <= 9)).toBe(true);
        expect(Math.max(...a.units.map((u) => u.star))).toBeLessThanOrEqual(mode === "EASY" ? 1 : mode === "MEDIUM" ? 2 : 3);
      }
    }
  });
  it("HARD guarantees 3★ from round 14", () => {
    expect(generateEncounter({ round: 14, mode: "HARD", rng: rng(7) }).units.some((u) => u.star === 3)).toBe(true);
  });
});
