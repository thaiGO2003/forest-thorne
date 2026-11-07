import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { combatTargetPreview, materializeCombat, simulate, type CombatEvent, type Placement } from "../src/core/combat";
import { skillSpec } from "../src/core/skills";

const roles = ["ASSASSIN", "TANKER", "FIGHTER", "SUPPORT", "ARCHER", "MAGE", "MAGE"] as const;

function runStorm(star: number, count = 7, chance: number | null = null, seed = 9, offRow = false) {
  const right: Placement[] = Array.from({ length: count }, (_, i) => ({
    uid: `foe${i}`, baseId: "titan_earth", star: 1,
    row: offRow && i === 0 ? 1 : 0, col: 5 + (i % 5),
  }));
  const fighters = materializeCombat(
    [{ uid: "storm", baseId: "butterfly_mirror", star, row: 0, col: 4 }],
    right,
  );
  const caster = fighters[0]!;
  caster.rage = caster.rageMax;
  caster.crit = 0;
  caster.element = "SPIRIT";
  caster.skill = { ...caster.skill, fourthTargetBonusChance: chance };
  for (let i = 1; i < fighters.length; i++) {
    const target = fighters[i]!;
    target.role = roles[i - 1] ?? "MAGE";
    target.hp = target.maxHp = 100_000;
    target.matk = target.atk = 1;
    target.def = target.mdef = 0;
    target.crit = 0;
    target.element = "SPIRIT";
    target.rageMax = 100_000;
  }
  const preview = combatTargetPreview(fighters, "storm", { kitPreview: true });
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
  const firstCast = result.events.findIndex((e) => e.t === "cast" && e.src === "storm");
  const nextCycle = result.events.findIndex((e, i) => i > firstCast && e.t === "cycle");
  const firstWindow = result.events.slice(firstCast, nextCycle < 0 ? undefined : nextCycle);
  const cast = firstWindow[0] as Extract<CombatEvent, { t: "cast" }>;
  const hits = firstWindow.filter((e): e is Extract<CombatEvent, { t: "basic" | "skill" }> =>
    e.t === "skill" && e.src === "storm");
  return { result, caster, preview, cast, hits };
}

describe("Bướm Cỏ (butterfly_mirror) grass row storm #94", () => {
  it("keeps persistent catalog id, changes tier/name and declares every star without statuses", () => {
    const unit = getUnit("butterfly_mirror");
    expect([unit.id, unit.nameVi, unit.tier, unit.role, unit.skill.family])
      .toEqual(["butterfly_mirror", "Bướm Cỏ", 4, "SUPPORT", "grass_row_storm"]);
    for (const [star, count] of [[1, 3], [2, 4], [3, Number.MAX_SAFE_INTEGER]]) {
      const spec = skillSpec("butterfly_mirror", star);
      expect(spec).toMatchObject({ side: "enemy", count, selector: "grass_row",
        damage: { base: 0, scale: 1, stat: "matk", type: "magic" },
        controls: [], dots: [], reaction: {}, buffs: [], debuffs: [] });
    }
    expect(skillSpec("butterfly_mirror", 2).fourthTargetBonusChance).toBeNull();
  });

  it("1★ selects up to 3 same-row targets, role first then nearest, one magic hit per target", () => {
    const { cast, hits, preview } = runStorm(1);
    expect(cast.targets).toEqual(["foe5", "foe6", "foe4"]);
    expect([...(preview?.directUids ?? []), ...(preview?.splashUids ?? [])]).toEqual(cast.targets);
    expect(hits.map((e) => e.dst)).toEqual(cast.targets);
    expect(hits.every((e) => e.kind === "grass" && !e.crit)).toBe(true);
    expect(hits.map((e) => e.dmg)).toEqual([67, 54, 40]);
    expect(new Set(hits.map((e) => e.dst)).size).toBe(hits.length);
  });

  it("2★ caps at 4 and only its fourth target may proc configurable 20% bonus", () => {
    const none = runStorm(2, 7, null);
    const forced = runStorm(2, 7, 1);
    expect(none.hits).toHaveLength(4);
    expect(forced.cast.targets).toEqual(none.cast.targets);
    expect(forced.hits.slice(0, 3).map((e) => e.dmg)).toEqual(none.hits.slice(0, 3).map((e) => e.dmg));
    expect(forced.hits[3]!.dmg).toBeGreaterThan(none.hits[3]!.dmg);
    expect(runStorm(2, 7, 0).hits.map((e) => e.dmg)).toEqual(none.hits.map((e) => e.dmg));
  });

  it("2★ bonus uses seeded gameplay RNG and matches configurable Bernoulli frequency", () => {
    const outcomes: number[] = [];
    for (let seed = 1; seed <= 160; seed++) {
      const baseline = runStorm(2, 4, 0, seed).hits[3]!.dmg;
      const trial = runStorm(2, 4, 0.4, seed).hits[3]!.dmg;
      outcomes.push(Number(trial > baseline));
      expect(trial === baseline || trial > baseline).toBe(true);
      expect(runStorm(2, 4, 0.4, seed).hits[3]!.dmg).toBe(trial);
    }
    const successes = outcomes.reduce((a, b) => a + b, 0);
    expect(successes).toBeGreaterThan(42);
    expect(successes).toBeLessThan(86);
  });

  it("3★ penetrates every same-row enemy with 15% cumulative falloff and 25% floor", () => {
    const { cast, hits, caster } = runStorm(3);
    expect(hits).toHaveLength(7);
    expect(hits.map((e) => e.dst)).toEqual(cast.targets);
    const base = Math.round(caster.matk * 1.4);
    expect(hits.map((e) => e.dmg)).toEqual(
      Array.from({ length: 7 }, (_, i) => Math.max(1, Math.round(base * Math.max(0.25, 1 - .15 * i)))),
    );
  });

  it("never picks another row, even when no preferred same-row target exists", () => {
    const { hits } = runStorm(3, 7, null, 9, true);
    expect(hits.map((e) => e.dst)).not.toContain("foe0");
    const allElsewhere = materializeCombat(
      [{ uid: "storm", baseId: "butterfly_mirror", star: 1, row: 0, col: 4 }],
      [{ uid: "other", baseId: "titan_earth", star: 1, row: 1, col: 5 }],
    );
    expect(combatTargetPreview(allElsewhere, "storm", { kitPreview: true })?.directUids).toEqual([]);
    allElsewhere[0]!.rage = allElsewhere[0]!.rageMax;
    const result = simulate(allElsewhere, { seed: 9 });
    const cast = result.events.find((e) => e.t === "cast" && e.src === "storm");
    expect(cast).toMatchObject({ targets: [] });
    expect(result.events.some((e) => e.t === "skill" && e.src === "storm")).toBe(false);
  });

  it("allows magic crits and applies MDEF rather than DEF at the impact", () => {
    const resolve = (crit: number, mdef: number, def: number) => {
      const fighters = materializeCombat(
        [{ uid: "storm", baseId: "butterfly_mirror", star: 1, row: 0, col: 4 }],
        [{ uid: "foe", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
      );
      fighters[0]!.rage = fighters[0]!.rageMax;
      fighters[0]!.crit = crit;
      fighters[1]!.hp = fighters[1]!.maxHp = 100_000;
      fighters[1]!.def = def;
      fighters[1]!.mdef = mdef;
      const result = simulate(fighters, { seed: 9 });
      return result.events.find((e) => e.t === "skill" && e.src === "storm") as Extract<CombatEvent, { t: "basic" | "skill" }>;
    };
    const normal = resolve(0, 0, 0);
    const armored = resolve(0, 0, 10_000);
    const resisted = resolve(0, 300, 0);
    const crit = resolve(1, 0, 0);
    expect(armored.dmg).toBe(normal.dmg);
    expect(resisted.dmg).toBeLessThan(normal.dmg);
    expect(crit.crit).toBe(true);
    expect(crit.dmg).toBeGreaterThan(normal.dmg);
  });

  it("leaves no new timed status after cast or at cycle boundary, without reflect recursion", () => {
    const { result } = runStorm(3);
    expect(result.events.filter((e) => e.t === "status" && e.kind === "grass")).toEqual([]);
    expect(result.events.some((e) => e.t === "reflect" && e.src === "storm")).toBe(false);
    expect(result.survivors.filter((f) => f.uid.startsWith("foe"))
      .every((f) => Object.values(f.status).every((status) => status.turns <= 0))).toBe(true);
  });
});
