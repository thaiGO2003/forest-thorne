import { describe, expect, it } from "vitest";
import { makeFighter, simulate } from "../src/core/combat";
import { AI_PROFILE, bossForRound, encounterBudget, generateEncounter, normalizeAiMode } from "../src/core/encounter";
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
  it("freezes every authored A102 difficulty knob", () => {
    expect(AI_PROFILE.EASY).toMatchObject({ hp: 0.84, atk: 0.82, matk: 0.82, rageGain: 1, randomTarget: 0.58, teamBonus: 0, growthEvery: 5, growthCap: 1, budget: 0.9, levelBonus: 0, maxTierBonus: 0, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 8, equipBase: 0.1, equipGrowth: 0.02, equipCap: 0.35, equipMaxTier: 1 });
    expect(AI_PROFILE.MEDIUM).toMatchObject({ hp: 0.95, atk: 0.93, matk: 0.93, rageGain: 1, randomTarget: 0.3, teamBonus: 0, growthEvery: 5, growthCap: 1, budget: 1, levelBonus: 0, maxTierBonus: 0, maxStar: 2, star2Round: 5, star3Round: null, star2Bonus: -0.02, star3Bonus: -1, equipStart: 6, equipBase: 0.12, equipGrowth: 0.03, equipCap: 0.55, equipMaxTier: 2 });
    expect(AI_PROFILE.HARD).toMatchObject({ hp: 1.05, atk: 1.04, matk: 1.04, rageGain: 1, randomTarget: 0.12, teamBonus: 1, growthEvery: 4, growthCap: 2, budget: 1.05, levelBonus: 1, maxTierBonus: 1, maxStar: 3, star2Round: 4, star3Round: 14, star2Bonus: 0, star3Bonus: 0, equipStart: 5, equipBase: 0.15, equipGrowth: 0.04, equipCap: 0.7, equipMaxTier: 3 });
    expect(AI_PROFILE.CREATIVE).toMatchObject({ hp: 0.75, atk: 0.72, matk: 0.72, rageGain: 0.9, randomTarget: 0.8, teamBonus: -1, growthEvery: 8, growthCap: 0, budget: 0.8, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0, equipMaxTier: 0 });
    expect(AI_PROFILE.TUTORIAL).toMatchObject({ hp: 0.65, atk: 0.6, matk: 0.6, rageGain: 0.8, randomTarget: 0.75, teamBonus: -1, growthEvery: 8, growthCap: 0, budget: 0.7, levelBonus: 0, maxTierBonus: -1, maxStar: 1, star2Round: null, star3Round: null, star2Bonus: -1, star3Bonus: -1, equipStart: 99, equipBase: 0, equipGrowth: 0, equipCap: 0, equipMaxTier: 0 });
    expect(AI_PROFILE.COOP4_EASY).toEqual(AI_PROFILE.COOP_EASY);
    expect(AI_PROFILE.COOP4_MEDIUM).toEqual(AI_PROFILE.COOP_MEDIUM);
    expect(AI_PROFILE.COOP4_HARD).toEqual(AI_PROFILE.COOP_HARD);
    expect(AI_PROFILE.COOP_EASY).toMatchObject({ teamBonus: 1, growthEvery: 4, growthCap: 2, star2Bonus: 0.02, star3Bonus: -1, equipBase: 0.14, equipGrowth: 0.03, equipCap: 0.45 });
    expect(AI_PROFILE.COOP_MEDIUM).toMatchObject({ teamBonus: 1, growthEvery: 4, growthCap: 3, levelBonus: 1, maxTierBonus: 1, star2Bonus: 0.03, star3Bonus: -1, equipBase: 0.16, equipGrowth: 0.04, equipCap: 0.62 });
    expect(AI_PROFILE.COOP_HARD).toMatchObject({ rageGain: 1.05, teamBonus: 2, growthEvery: 3, growthCap: 4, levelBonus: 1, maxTierBonus: 1, star2Bonus: 0.05, star3Bonus: 0.02, equipBase: 0.18, equipGrowth: 0.05, equipCap: 0.78 });
  });
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
  it("applies profile team growth, level bonus and the early HARD cap", () => {
    expect(generateEncounter({ round: 5, mode: "EASY", rng: rng(2) }).units).toHaveLength(6);
    expect(generateEncounter({ round: 3, mode: "HARD", rng: rng(2) }).units).toHaveLength(3);
    expect(generateEncounter({ round: 4, mode: "HARD", rng: rng(2) }).units).toHaveLength(8);
    expect(generateEncounter({ round: 4, mode: "COOP_MEDIUM", players: 1, rng: rng(2) }).units).toHaveLength(8);
  });
  it("scales co-op teams onto all 10/20 logical rows without truncating them to the solo half-board", () => {
    for (const [mode, players] of [["COOP_MEDIUM", 2], ["COOP4_HARD", 4]] as const) {
      const generated = generateEncounter({ round: 40, mode, rng: rng(7) });
      expect(generated.units.length).toBeGreaterThan(25);
      expect(generated.units.length).toBeLessThanOrEqual(players * 25);
      expect(new Set(generated.units.map((u) => `${u.row},${u.col}`)).size).toBe(generated.units.length);
      expect(generated.units.some((u) => u.row >= 5)).toBe(true);
      expect(generated.units.every((u) => u.row >= 0 && u.row < players * 5 && u.col >= 5 && u.col <= 9)).toBe(true);
      expect(generateEncounter({ round: 40, mode, rng: rng(7) })).toEqual(generated);
    }
  });
  it("starts deterministic AI equipment at the authored round and respects tier pressure", () => {
    const before = generateEncounter({ round: 7, mode: "EASY", rng: () => 0 });
    const started = generateEncounter({ round: 8, mode: "EASY", rng: () => 0 });
    expect(before.units.every((u) => !u.equips?.length)).toBe(true);
    expect(started.units.every((u) => u.equips?.every((id) => id === "eq_blue_buff"))).toBe(true);
    expect(started.units.some((u) => u.equips?.length)).toBe(true);

    const medium = generateEncounter({ round: 6, mode: "MEDIUM", rng: () => 0 });
    expect(medium.units.some((u) => u.star === 2 && u.equips?.includes("eq_warmog_armor"))).toBe(true);
    const creative = generateEncounter({ round: 120, mode: "CREATIVE", rng: () => 0 });
    expect(creative.units.every((u) => !u.equips?.length)).toBe(true);
  });
});
