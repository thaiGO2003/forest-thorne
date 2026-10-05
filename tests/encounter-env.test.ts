import { describe, expect, it } from "vitest";
import { makeFighter, simulate } from "../src/core/combat";
import { bossForRound, encounterBudget, generateEncounter, normalizeAiMode } from "../src/core/encounter";
import { environmentFor, environmentMods } from "../src/core/environment";
import { getUnit, NORMAL_UNITS } from "../src/content/catalog";

const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const fixedRng = (value: number) => () => value;

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
  it("applies authored team growth, co-op family mapping, tier pressure and star pressure", () => {
    const easyBeforeGrowth = generateEncounter({ round: 4, mode: "EASY", rng: rng(11) });
    const easyAtGrowth = generateEncounter({ round: 5, mode: "EASY", rng: rng(11) });
    expect(easyAtGrowth.units.length).toBe(easyBeforeGrowth.units.length + 1);

    const coop2 = generateEncounter({ round: 1, mode: "COOP_EASY", players: 2, rng: rng(9) });
    const coop4Family = generateEncounter({ round: 1, mode: "COOP4_EASY", players: 2, rng: rng(9) });
    const fourPlayers = generateEncounter({ round: 1, mode: "COOP4_EASY", players: 4, rng: rng(9) });
    expect(coop4Family).toEqual(coop2);
    expect(fourPlayers.units.length).toBe(coop2.units.length * 2);

    const fixed = (n: number) => () => n;
    const mediumTier = generateEncounter({ round: 3, mode: "MEDIUM", rng: fixed(0.999) });
    const coopMediumTier = generateEncounter({ round: 3, mode: "COOP_MEDIUM", rng: fixed(0.999) });
    const tiers = new Map(NORMAL_UNITS.map((unit) => [unit.id, unit.tier]));
    expect(Math.max(...mediumTier.units.map((unit) => tiers.get(unit.baseId) ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.max(...coopMediumTier.units.map((unit) => tiers.get(unit.baseId) ?? 0))).toBe(3);

    const mediumStars = generateEncounter({ round: 7, mode: "MEDIUM", rng: fixed(0.05) });
    const coopMediumStars = generateEncounter({ round: 7, mode: "COOP_MEDIUM", rng: fixed(0.05) });
    expect(mediumStars.units.filter((unit) => unit.star >= 2)).toHaveLength(1);
    expect(coopMediumStars.units.filter((unit) => unit.star >= 2).length).toBeGreaterThan(1);
  });

  it("HARD guarantees 3★ from round 14", () => {
    expect(generateEncounter({ round: 14, mode: "HARD", rng: rng(7) }).units.some((u) => u.star === 3)).toBe(true);
  });

  it("applies authored team growth cadence and level pressure to generated team size", () => {
    expect(generateEncounter({ round: 4, mode: "EASY", rng: fixedRng(0.99) }).units).toHaveLength(5);
    expect(generateEncounter({ round: 5, mode: "EASY", rng: fixedRng(0.99) }).units).toHaveLength(6);
    expect(generateEncounter({ round: 10, mode: "EASY", rng: fixedRng(0.99) }).units).toHaveLength(9);
    expect(generateEncounter({ round: 3, mode: "MEDIUM", rng: fixedRng(0.99) }).units).toHaveLength(4);
    expect(generateEncounter({ round: 3, mode: "COOP_MEDIUM", rng: fixedRng(0.99) }).units).toHaveLength(6);
  });

  it("applies max-tier bonus to the generated unit pool", () => {
    const seenMedium = new Set<number>();
    const seenCoopMedium = new Set<number>();
    for (let seed = 1; seed <= 64; seed++) {
      for (const unit of generateEncounter({ round: 3, mode: "MEDIUM", rng: rng(seed) }).units) {
        seenMedium.add(getUnit(unit.baseId).tier);
      }
      for (const unit of generateEncounter({ round: 3, mode: "COOP_MEDIUM", rng: rng(seed) }).units) {
        seenCoopMedium.add(getUnit(unit.baseId).tier);
      }
    }
    expect(Math.max(...seenMedium)).toBe(2);
    expect(Math.max(...seenCoopMedium)).toBe(3);
  });

  it("applies star chance bonuses before guaranteed-star floors", () => {
    const medium = generateEncounter({ round: 8, mode: "MEDIUM", rng: fixedRng(0.09) });
    const coopEasy = generateEncounter({ round: 8, mode: "COOP_EASY", rng: fixedRng(0.09) });
    expect(medium.units.filter((u) => u.star >= 2)).toHaveLength(1);
    expect(coopEasy.units.every((u) => u.star === 2)).toBe(true);

    const hard = generateEncounter({ round: 12, mode: "HARD", rng: fixedRng(0.03) });
    const coopHard = generateEncounter({ round: 12, mode: "COOP_HARD", rng: fixedRng(0.03) });
    expect(hard.units.some((u) => u.star === 3)).toBe(false);
    expect(coopHard.units.every((u) => u.star === 3)).toBe(true);
  });

  it("enforces guaranteed-star boundaries at the authored rounds", () => {
    expect(generateEncounter({ round: 4, mode: "MEDIUM", rng: fixedRng(0.99) }).units.some((u) => u.star >= 2)).toBe(false);
    expect(generateEncounter({ round: 5, mode: "MEDIUM", rng: fixedRng(0.99) }).units.some((u) => u.star >= 2)).toBe(true);
    expect(generateEncounter({ round: 13, mode: "HARD", rng: fixedRng(0.99) }).units.some((u) => u.star === 3)).toBe(false);
    expect(generateEncounter({ round: 14, mode: "HARD", rng: fixedRng(0.99) }).units.some((u) => u.star === 3)).toBe(true);
  });
});
