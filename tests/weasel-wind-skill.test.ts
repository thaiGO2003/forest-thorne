import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, type Fighter, type Placement } from "../src/core/combat";

const placement = (uid: string, star: number, row: number, col: number): Placement =>
  ({ uid, baseId: "weasel_quick", star, row, col });

function setup(star: number, occupied: number[] = []) {
  const left = [placement("hook", star, 0, 4), placement("ally", 1, 1, 3)];
  const right = [placement("mage", 1, 2, 9), placement("other", 1, 0, 8),
    ...occupied.map((col, i) => placement(`block${i}`, 1, 0, col))];
  const all = materializeCombat(left, right, {});
  for (const fighter of all) {
    fighter.hp = fighter.maxHp = 10_000;
    fighter.crit = 0;
    fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.rage = 0;
  }
  all.find((f) => f.uid === "mage")!.role = "MAGE";
  all.find((f) => f.uid === "other")!.role = "FIGHTER";
  all.find((f) => f.uid === "hook")!.rage = all.find((f) => f.uid === "hook")!.rageMax;
  return all;
}

const run = (all: Fighter[]) => simulate(all, { seed: 5 });

describe("Phong Liêm Dứu — Liềm Móc", () => {
  it("has tier 3, retained damage scaling, and explicit per-star contracts", () => {
    const unit = getUnit("weasel_quick");
    expect([unit.tier, unit.skill.nameVi, unit.skill.family]).toEqual([3, "Liềm Móc", "wind_sickle_hook"]);
    expect(unit.skill.starDetailVi).toHaveLength(3);
    expect(unit.skill.starDetailVi[1]).toContain("1/3");
    expect(unit.skill.starDetailVi[2]).toContain("10 sát thương");
  });

  it.each([[[], 5], [[5], 6], [[5, 6, 7, 8], 9]])(
    "1★ hits the role-priority target before pulling through occupied columns %j", (occupied, column) => {
      const result = run(setup(1, occupied));
      const cast = result.events.findIndex((e) => e.t === "cast" && e.src === "hook");
      const hit = result.events.findIndex((e) => e.t === "skill" && e.src === "hook" && e.dst === "mage");
      const pull = result.events.findIndex((e) => e.t === "hookPull" && e.src === "hook");
      expect(cast).toBeGreaterThanOrEqual(0);
      expect(hit).toBeGreaterThan(cast);
      expect(pull).toBeGreaterThan(hit);
      expect(result.events[pull]).toMatchObject({ dst: "mage", col: column, row: 0 });
      expect(result.events.filter((e) => e.t === "skill" && e.src === "hook" && e.dst === "mage").length).toBeGreaterThanOrEqual(1);
    },
  );

  it("1★ leaves an enemy in place when every row cell is occupied", () => {
    const result = run(setup(1, [5, 6, 7, 8, 9]));
    expect(result.events.some((e) => e.t === "skill" && e.src === "hook" && e.dst === "mage")).toBe(true);
    const nextCycle = result.events.findIndex((e) => e.t === "cycle" && e.cycle === 2);
    expect(result.events.slice(0, nextCycle).some((e) => e.t === "hookPull" && e.src === "hook")).toBe(false);
  });

  it("2★ applies 2/3 offense to every enemy in the completed pull row, not other rows", () => {
    const result = run(setup(2));
    const mage = result.fighters.find((f) => f.uid === "mage")!;
    const other = result.fighters.find((f) => f.uid === "other")!;
    const ally = result.fighters.find((f) => f.uid === "ally")!;
    expect([mage.row, mage.hookOffense?.multiplier, other.hookOffense?.multiplier]).toEqual([0, 2 / 3, 2 / 3]);
    expect(ally.hookOffense).toBeUndefined();
    expect(result.fighters.find((f) => f.uid === "hook")?.hookGuardCycle).toBeUndefined();
  });

  it("3★ applies half offense and flat 10 mitigation after percentage, each damage instance", () => {
    const all = setup(3);
    const result = run(all);
    expect(result.fighters.find((f) => f.uid === "mage")?.hookOffense?.multiplier).toBe(1 / 2);
    expect(result.fighters.find((f) => f.uid === "other")?.hookOffense?.multiplier).toBe(1 / 2);
    expect(result.fighters.find((f) => f.uid === "hook")?.hookGuardCycle).toBeGreaterThanOrEqual(1);
    const attacks = result.events.filter((e) => (e.t === "basic" || e.t === "skill") && e.dst === "hook");
    expect(attacks.length).toBeGreaterThan(0);
  });

  it("subtracts 10 from each incoming hit, never below zero, and expires at cycle boundary", () => {
    const scenario = (guardCycle?: number) => {
      const fighters = materializeCombat(
        [placement("hook", 1, 0, 4)],
        [placement("enemy", 1, 0, 5)], {},
      );
      const hook = fighters.find((f) => f.uid === "hook")!;
      const enemy = fighters.find((f) => f.uid === "enemy")!;
      hook.hp = hook.maxHp = enemy.hp = enemy.maxHp = 100_000;
      hook.crit = enemy.crit = 0;
      hook.evade = enemy.evade = 0;
      hook.accuracy = enemy.accuracy = 1;
      hook.rageMax = 100;
      if (guardCycle !== undefined) hook.hookGuardCycle = guardCycle;
      return simulate(fighters, { seed: 12 });
    };
    const normal = scenario();
    const guarded = scenario(1);
    const stale = scenario(0);
    const hits = (events: typeof normal.events) => events.filter((e) => e.t === "basic" && e.src === "enemy" && e.dst === "hook");
    const first = hits(normal.events)[0];
    const guardedFirst = hits(guarded.events)[0];
    expect(first?.t).toBe("basic");
    expect(guardedFirst?.t).toBe("basic");
    if (first?.t !== "basic" || guardedFirst?.t !== "basic") return;
    expect(guardedFirst.dmg).toBe(Math.max(0, first.dmg - 10));
    expect(hits(stale.events)[0]).toMatchObject({ dmg: first.dmg });
    const secondCycleIndex = guarded.events.findIndex((e) => e.t === "cycle" && e.cycle === 2);
    const nextHit = hits(guarded.events.slice(secondCycleIndex))[0];
    const baselineNextHit = hits(normal.events.slice(normal.events.findIndex((e) => e.t === "cycle" && e.cycle === 2)))[0];
    expect(nextHit).toMatchObject({ dmg: baselineNextHit?.t === "basic" ? baselineNextHit.dmg : -1 });
  });
});
