import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, type CombatEvent, type CombatResult, type Fighter, type Placement } from "../src/core/combat";
import { skillSpec } from "../src/core/skills";

const elephant = (star: number): Placement =>
  ({ uid: "elephant", baseId: "elephant_guard", star, row: 1, col: 3 });
const ally = (uid: string, row: number, col: number): Placement =>
  ({ uid, baseId: "ant_guard", star: 1, row, col });

function setup(star: number, extras: Placement[] = []) {
  const fighters = materializeCombat(
    [elephant(star), ...extras],
    [{ uid: "enemy", baseId: "ant_guard", star: 1, row: 1, col: 9 }],
    {},
  );
  for (const fighter of fighters) {
    fighter.hp = fighter.maxHp = 30_000;
    fighter.evade = 0;
    fighter.crit = 0;
    fighter.accuracy = 1;
    if (fighter.uid !== "elephant") {
      fighter.atk = 1;
      fighter.rageMax = 999;
    }
  }
  const caster = fighters.find((f) => f.uid === "elephant")!;
  caster.rage = caster.rageMax;
  return fighters;
}
const run = (fighters: Fighter[], seed = 47) =>
  simulate(fighters, { seed, captureInspection: true, rageGain: { L: 0, R: 0 } });
type Guard = Extract<CombatEvent, { t: "tideGuard" }>;
function firstCast(result: CombatResult) {
  const castIndex = result.events.findIndex((event) => event.t === "cast" && event.src === "elephant");
  expect(castIndex).toBeGreaterThanOrEqual(0);
  const end = result.events.findIndex((event, i) => i > castIndex && event.t === "cycle");
  const first = result.events.slice(castIndex, end < 0 ? undefined : end);
  const guards = first.filter((event): event is Guard => event.t === "tideGuard" && event.active);
  return { castIndex, cast: result.events[castIndex]!, guards };
}

describe("Issue #110 — Tượng Đại Thủy tide guard", () => {
  it("retains identity, tier, stats, rage and authored coefficients, while becoming shield-only for every star", () => {
    const unit = getUnit("elephant_guard");
    expect([unit.id, unit.tier, unit.role, unit.stats.atk]).toEqual(["elephant_guard", 4, "SUPPORT", 55]);
    expect(unit.skill.rageCost).toEqual([3, 4, 5]);
    for (const [i, base, scale] of [[1, 35, 1], [2, 42, 1.2], [3, 51, 1.45]] as const) {
      const spec = skillSpec("elephant_guard", i);
      expect(spec.shield).toMatchObject({ base, scale, stat: "atk" });
      expect(spec.side).toBe("ally");
      expect(spec.damage).toBeNull();
      expect(spec.controls).toEqual([]);
      expect(spec.dots).toEqual([]);
      expect(unit.skill.starDetailVi[i - 1]).toContain("xóa tất cả debuff");
    }
  });

  for (const star of [1, 2, 3] as const) {
    it(`${star}★ shields and cleanses each eligible ally exactly once, without skill damage, crit or recursion`, () => {
      const fighters = setup(star, [
        ally("back", 0, 2), ally("far-back", 2, 1),
        ally("front-a", 0, 4), ally("front-b", 1, 4), ally("front-c", 2, 4),
        ally("same-column", 0, 3),
      ]);
      const back = fighters.find((f) => f.uid === "back")!;
      back.status = {
        stun: { turns: 2, value: 0 },
        burn: { turns: 3, value: 7 },
        poison: { turns: 2, value: 8 },
        taunt: { turns: 2, value: 0 },
        hot: { turns: 3, value: 2 },
      };
      back.tauntBy = "enemy";
      back.mods = [{ stat: "atk", value: -10, pct: false, turns: 2 }, { stat: "def", value: 20, pct: false, turns: 2 }];
      const result = run(fighters);
      const { cast, guards } = firstCast(result);
      const targets = guards.map((event) => event.dst);
      expect(new Set(targets).size).toBe(targets.length);
      expect(targets).toContain("back");
      expect(targets).toContain("far-back");
      expect(targets.includes("same-column")).toBe(star === 3);
      expect(targets.filter((uid) => uid.startsWith("front-"))).toHaveLength(star >= 2 ? (star === 3 ? 3 : 2) : 0);
      expect(cast).toMatchObject({ t: "cast", src: "elephant", targets });
      expect(result.events.some((event) => event.t === "skill" && event.src === "elephant")).toBe(false);
      const cleansed = guards.find((event) => event.dst === "back")!;
      expect(cleansed.removed).toEqual(expect.arrayContaining(["stun", "burn", "poison", "taunt", "atkDown"]));
      expect(cleansed.removed).not.toContain("hot");
      expect(guards.every((event) => event.delta > 0)).toBe(true);
      const firstSnapshot = result.inspectionFrames!.find((frame) => frame.eventIndex >= result.events.indexOf(guards.at(-1)!) + 1)!;
      const snapshot = firstSnapshot.units.find((fighter) => fighter.uid === "back")!;
      expect(snapshot.shield).toBeGreaterThan(0);
      expect(snapshot.status.stun).toBeUndefined();
      expect(snapshot.status.burn).toBeUndefined();
      expect(snapshot.status.poison).toBeUndefined();
      expect(snapshot.status.hot).toBeDefined();
      expect(snapshot.mods).toEqual(expect.arrayContaining([{ stat: "def", value: 20, pct: false, turns: 2 }]));
      expect(snapshot.mods.some((mod) => mod.value < 0)).toBe(false);
      const expected = skillSpec("elephant_guard", star).shield!;
      const caster = fighters.find((fighter) => fighter.uid === "elephant")!;
      const amount = Math.round(expected.base + caster.atk * expected.scale);
      expect(cleansed.delta).toBe(amount);
    });
  }

  it("2★ prefers SUPPORT/TANKER for two adjacent-column slots, falls back to others", () => {
    const preferred = setup(2, [ally("a", 0, 4), ally("b", 1, 4), ally("c", 2, 4)]);
    preferred.find((f) => f.uid === "a")!.role = "FIGHTER";
    preferred.find((f) => f.uid === "b")!.role = "SUPPORT";
    preferred.find((f) => f.uid === "c")!.role = "TANKER";
    expect(firstCast(run(preferred)).guards.map((e) => e.dst).sort()).toEqual(["b", "c"]);
    const fallback = setup(2, [ally("a", 0, 4), ally("b", 1, 4), ally("c", 2, 4)]);
    for (const fighter of fallback.filter((f) => f.uid !== "elephant")) fighter.role = "FIGHTER";
    const picked = firstCast(run(fallback)).guards.map((e) => e.dst);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
    expect(picked.every((uid) => ["a", "b", "c"].includes(uid))).toBe(true);
  });

  it("2★ selects uniformly from three equally prioritized candidates using gameplay seed", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const sample = (seed: number) => {
      const fighters = setup(2, [ally("a", 0, 4), ally("b", 1, 4), ally("c", 2, 4)]);
      for (const uid of ["a", "b", "c"]) fighters.find((f) => f.uid === uid)!.role = "SUPPORT";
      return firstCast(run(fighters, seed)).guards.map((guard) => guard.dst);
    };
    for (let seed = 0; seed < 120; seed++) {
      const drawn = sample(seed);
      expect(sample(seed)).toEqual(drawn);
      expect(drawn).toHaveLength(2);
      for (const uid of drawn) counts[uid]!++;
    }
    // Each of three candidates has probability 2/3; keep generous deterministic bounds.
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(55);
    for (const count of Object.values(counts)) expect(count).toBeLessThan(105);
  });

  it("guard expires at next shared-round boundary, never consumes next-round DoT", () => {
    const fighters = setup(1, [ally("back", 0, 2)]);
    const result = run(fighters);
    const { guards } = firstCast(result);
    expect(guards).toHaveLength(1);
    const nextCycle = result.events.findIndex((event) => event.t === "cycle" && event.cycle === 2);
    expect(nextCycle).toBeGreaterThan(0);
    expect(result.events[nextCycle + 1]).toMatchObject({
      t: "tideGuard", active: false, dst: "back", delta: -guards[0]!.delta,
    });
    const cycle2 = result.inspectionFrames!.find((frame) => frame.cycle === 2)!;
    const back = cycle2.units.find((fighter) => fighter.uid === "back")!;
    expect(back.shield).toBe(0);
    expect(back.status["elephantTideShield:elephant"]).toBeUndefined();
  });

  it("independent casts and shield consumption cannot double-apply the same guard", () => {
    const fighters = setup(1, [ally("back", 0, 2)]);
    const guard = fighters.find((f) => f.uid === "back")!;
    // Non-tide shields are preserved if an attack absorbs only the tide portion.
    guard.shield = 20;
    const result = run(fighters);
    const { guards } = firstCast(result);
    expect(guards).toHaveLength(1);
    const first = result.inspectionFrames!.find((frame) => frame.eventIndex >= result.events.indexOf(guards[0]!) + 1)!;
    expect(first.units.find((f) => f.uid === "back")!.shield).toBe(20 + guards[0]!.delta);
    const next = result.inspectionFrames!.find((frame) => frame.cycle === 2)!;
    expect(next.units.find((f) => f.uid === "back")!.shield).toBe(20);
    expect(result.events.filter((event) => event.t === "skill" && event.src === "elephant")).toHaveLength(0);
  });
  it("refreshes an existing depleted guard instead of stacking, retaining unrelated shields", () => {
    const fighters = setup(1, [ally("back", 0, 2)]);
    const back = fighters.find((f) => f.uid === "back")!;
    back.shield = 20 + 35;
    back.status["elephantTideShield:elephant"] = { turns: 1, value: 35, expiresCycle: 9 };
    const result = run(fighters);
    const { guards } = firstCast(result);
    expect(guards).toHaveLength(1);
    const formula = skillSpec("elephant_guard", 1).shield!;
    const caster = fighters.find((f) => f.uid === "elephant")!;
    const amount = Math.round(formula.base + formula.scale * caster.atk);
    expect(guards[0]!.delta).toBe(amount - 35);
    const fresh = result.inspectionFrames!.find((frame) => frame.eventIndex >= result.events.indexOf(guards[0]!) + 1)!;
    expect(fresh.units.find((f) => f.uid === "back")!.shield).toBe(20 + amount);
    const next = result.inspectionFrames!.find((frame) => frame.cycle === 2)!;
    expect(next.units.find((f) => f.uid === "back")!.shield).toBe(20);
  });

  it("absorbs each enemy hit once and expires only its unconsumed shield", () => {
    const fighters = setup(1, [ally("back", 0, 2)]);
    const enemy = fighters.find((f) => f.uid === "enemy")!;
    enemy.status.taunt = { turns: 3, value: 0 };
    enemy.tauntBy = "back";
    const result = run(fighters);
    const { guards } = firstCast(result);
    expect(guards).toHaveLength(1);
    const hit = result.events.find((event) => event.t === "basic" && event.src === "enemy" && event.dst === "back");
    expect(hit).toMatchObject({ t: "basic", src: "enemy", dst: "back", crit: false });
    if (hit?.t !== "basic") throw new Error("Expected enemy basic attack against protected ally");
    expect(hit.absorbed).toBeGreaterThan(0);
    expect(hit.absorbed).toBe(hit.dmg);
    const expired = result.events.find((event) => event.t === "tideGuard" && !event.active && event.dst === "back");
    expect(expired).toMatchObject({ delta: -(guards[0]!.delta - hit.absorbed) });
    const next = result.inspectionFrames!.find((frame) => frame.cycle === 2)!;
    expect(next.units.find((f) => f.uid === "back")!.shield).toBe(0);
  });

});
