import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { goldMultiplier, makeFighter, simulate, turnOrder, type CombatEvent, type CombatResult, type Placement } from "../src/core/combat";

const team = (ids: string[], side: "L" | "R"): Placement[] =>
  ids.map((baseId, i) => ({ uid: `${side}${i}`, baseId, star: 1, row: i % 5, col: side === "L" ? 4 - Math.floor(i / 5) : 5 + Math.floor(i / 5) }));
const ids = NORMAL_UNITS.map((u) => u.id);
const firstCastWindow = (events: CombatEvent[], src: string): CombatEvent[] => {
  const from = events.findIndex((e) => e.t === "cast" && e.src === src);
  const to = events.findIndex((e, i) => i > from && e.t === "cast" && e.src === src);
  return from < 0 ? [] : events.slice(from, to < 0 ? undefined : to);
};


describe("combat", () => {
  it("gold multiplier follows A13 (no floor, cap 2.0 at 210)", () => {
    expect([goldMultiplier(-5), goldMultiplier(10), goldMultiplier(11), goldMultiplier(12), goldMultiplier(210), goldMultiplier(999)])
      .toEqual([1, 1, 1.005, 1.01, 2, 2]);
  });

  it("turn order interleaves sides, LEFT cols 4→0, RIGHT cols 5→9", () => {
    const fs = [
      makeFighter({ uid: "a", baseId: ids[0]!, star: 1, row: 0, col: 3 }, "L"),
      makeFighter({ uid: "b", baseId: ids[0]!, star: 1, row: 1, col: 4 }, "L"),
      makeFighter({ uid: "c", baseId: ids[0]!, star: 1, row: 0, col: 6 }, "R"),
      makeFighter({ uid: "d", baseId: ids[0]!, star: 1, row: 2, col: 5 }, "R"),
    ];
    expect(turnOrder(fs).map((f) => f.uid)).toEqual(["b", "d", "a", "c"]);
  });

  it("is deterministic for identical input + seed", () => {
    const l = team(ids.slice(0, 5), "L");
    const r = team(ids.slice(5, 10), "R");
    const a = simulate(l, r, { seed: 7 });
    const b = simulate(l, r, { seed: 7 });
    expect(a.events).toEqual(b.events);
    expect(a.winner).toBe(b.winner);
  });

  it("every unit fights to a valid resolution without throwing; HP never out of bounds", () => {
    for (let i = 0; i < ids.length; i += 5) {
      const res = simulate(team(ids.slice(i, i + 5), "L"), team(ids.slice((i + 60) % 120, (i + 60) % 120 + 5), "R"), { seed: i });
      expect(res.actions).toBeGreaterThan(0);
      for (const f of res.survivors) expect(f.hp).toBeGreaterThan(0), expect(f.hp).toBeLessThanOrEqual(f.maxHp);
      if (res.winner) expect(res.alive[res.winner === "L" ? "R" : "L"]).toBe(0);
    }
  });

  it("3★ team beats the same 1★ team", () => {
    const l = team(ids.slice(0, 5), "L").map((p) => ({ ...p, star: 3 }));
    expect(simulate(l, team(ids.slice(0, 5), "R"), { seed: 3 }).winner).toBe("L");
  });
  it("gates stun with deterministic RNG after damage and never stuns a killed target", () => {
    const left = [{ uid: "bison", baseId: "bison_stampede", star: 1, row: 0, col: 4 }];
    const right = [{ uid: "target", baseId: "titan_earth", star: 1, row: 0, col: 5 }];
    const outcomes = new Set<boolean>();
    let successfulWindow: CombatEvent[] = [];
    for (let seed = 1; seed <= 24; seed++) {
      const result = simulate(left, right, { seed, bonus: { L: { startRage: 3 } } });
      const window = firstCastWindow(result.events, "bison");
      const stunned = window.some((e) => e.t === "status" && e.dst === "target" && e.kind === "stun");
      outcomes.add(stunned);
      if (stunned && successfulWindow.length === 0) successfulWindow = window;
    }
    expect(outcomes).toEqual(new Set([true, false]));
    const hitAt = successfulWindow.findIndex((e) => e.t === "skill" && e.dst === "target");
    const stunAt = successfulWindow.findIndex((e) => e.t === "status" && e.dst === "target" && e.kind === "stun");
    expect(hitAt).toBeGreaterThanOrEqual(0);
    expect(stunAt).toBeGreaterThan(hitAt);

    const lethal = simulate(
      [{ uid: "bison", baseId: "bison_stampede", star: 3, row: 0, col: 4 }],
      [{ uid: "fragile", baseId: "salamander_flame", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 5 } } },
    );
    const lethalWindow = firstCastWindow(lethal.events, "bison");
    expect(lethalWindow.some((e) => e.t === "death" && e.dst === "fragile")).toBe(true);
    expect(lethalWindow.some((e) => e.t === "status" && e.dst === "fragile" && e.kind === "stun")).toBe(false);
  });

  it("team DEF refresh keeps the stronger value and longer duration instead of stacking", () => {
    const result = simulate(
      [
        { uid: "strong", baseId: "titan_earth", star: 3, row: 0, col: 4 },
        { uid: "weak", baseId: "lizard_elder", star: 1, row: 1, col: 4 },
        { uid: "finisher", baseId: "bison_stampede", star: 3, row: 2, col: 4 },
      ],
      [{ uid: "fragile", baseId: "salamander_flame", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 4 } } },
    );
    const strong = result.survivors.find((f) => f.uid === "strong")!;
    const defense = strong.mods.filter((m) => m.stat === "def" && !m.pct);
    expect(defense).toHaveLength(1);
    expect(defense[0]).toMatchObject({ value: 45, turns: 4 });
  });

  it("applies the star effect-chance multiplier before stun gating", () => {
    for (let seed = 1; seed <= 24; seed++) {
      const result = simulate(
        [{ uid: "bison", baseId: "bison_stampede", star: 3, row: 0, col: 4 }],
        [{ uid: "target", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
        { seed, bonus: { L: { startRage: 4 } } },
      );
      const window = firstCastWindow(result.events, "bison");
      const killed = window.some((e) => e.t === "death" && e.dst === "target");
      if (!killed) {
        expect(window.some((e) => e.t === "status" && e.dst === "target" && e.kind === "stun")).toBe(true);
      }
    }
  });

  it("keeps a longer active stun when a shorter stun lands before the target turn", () => {
    let merged: CombatEvent[] = [];
    for (let seed = 1; seed <= 32 && merged.length < 2; seed++) {
      const result = simulate(
        [
          { uid: "long", baseId: "monkey_spear", star: 3, row: 1, col: 4 },
          { uid: "short", baseId: "bison_stampede", star: 1, row: 1, col: 3 },
        ],
        [
          { uid: "decoy", baseId: "titan_earth", star: 1, row: 0, col: 5 },
          { uid: "target", baseId: "titan_earth", star: 1, row: 1, col: 5 },
        ],
        { seed, bonus: { L: { startRage: 4 } } },
      );
      const targetTurn = result.events.findIndex((e) => e.t === "skip" && e.src === "target");
      const beforeTargetTurn = targetTurn < 0 ? result.events : result.events.slice(0, targetTurn);
      merged = beforeTargetTurn.filter((e) => e.t === "status" && e.dst === "target" && e.kind === "stun");
    }
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ turns: 2 });
    expect(merged[1]).toMatchObject({ turns: 2 });
  });

  it("single heal picks the lowest injured HP ratio and never invents a full-health heal", () => {
    const left: Placement[] = [
      { uid: "allyA", baseId: "salamander_flame", star: 1, row: 0, col: 4 },
      { uid: "allyB", baseId: "firefly_light", star: 1, row: 1, col: 4 },
      { uid: "healer", baseId: "dove_peace", star: 1, row: 2, col: 4 },
    ];
    const right: Placement[] = [
      { uid: "enemyA", baseId: "titan_earth", star: 1, row: 0, col: 5 },
      { uid: "enemyB", baseId: "titan_earth", star: 1, row: 1, col: 5 },
    ];
    let observed: { result: CombatResult; expected: string } | null = null;
    for (let seed = 1; seed <= 32 && !observed; seed++) {
      const result = simulate(left, right, { seed, bonus: { L: { startRage: 2 } } });
      const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "healer");
      if (castAt < 0) continue;
      const before = result.events.slice(0, castAt);
      const ratios = left.slice(0, 2).map((p) => {
        const fighter = makeFighter(p, "L", { startRage: 2 });
        const lost = before.reduce((sum, e) =>
          (e.t === "basic" || e.t === "skill") && e.dst === p.uid ? sum + e.dmg : sum, 0);
        return { uid: p.uid, ratio: (fighter.maxHp - lost) / fighter.maxHp, lost };
      });
      if (ratios.every((x) => x.lost > 0)) {
        ratios.sort((a, b) => a.ratio - b.ratio || a.uid.localeCompare(b.uid));
        observed = { result, expected: ratios[0]!.uid };
      }
    }
    expect(observed).not.toBeNull();
    const heals = firstCastWindow(observed!.result.events, "healer")
      .flatMap((e) => e.t === "heal" && e.src === "healer" ? [e] : []);
    expect(heals).toHaveLength(1);
    expect(heals[0]!.dst).toBe(observed!.expected);

    const full = simulate(
      [{ uid: "healer", baseId: "dove_peace", star: 1, row: 0, col: 4 }],
      [{ uid: "enemy", baseId: "titan_earth", star: 1, row: 4, col: 5 }],
      { seed: 1, bonus: { L: { startRage: 2 } } },
    );
    expect(firstCastWindow(full.events, "healer").some((e) => e.t === "heal" && e.src === "healer")).toBe(false);
  });

  it("global heal reaches every injured living ally", () => {
    const left: Placement[] = [
      { uid: "allyA", baseId: "salamander_flame", star: 1, row: 0, col: 4 },
      { uid: "allyB", baseId: "firefly_light", star: 1, row: 1, col: 4 },
      { uid: "healer", baseId: "fairy_forest", star: 1, row: 2, col: 4 },
    ];
    const right: Placement[] = [
      { uid: "enemyA", baseId: "titan_earth", star: 1, row: 0, col: 5 },
      { uid: "enemyB", baseId: "titan_earth", star: 1, row: 1, col: 5 },
    ];
    let healed = new Set<string>();
    for (let seed = 1; seed <= 32 && healed.size < 2; seed++) {
      const result = simulate(left, right, { seed, bonus: { L: { startRage: 2 } } });
      const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "healer");
      if (castAt < 0) continue;
      const before = result.events.slice(0, castAt);
      if (!["allyA", "allyB"].every((uid) => before.some((e) => (e.t === "basic" || e.t === "skill") && e.dst === uid))) continue;
      healed = new Set(firstCastWindow(result.events, "healer")
        .flatMap((e) => e.t === "heal" && e.src === "healer" ? [e.dst] : []));
    }
    expect(healed).toEqual(new Set(["allyA", "allyB"]));
  });

  it("dead units leave target selection: no event targets a unit after its death", () => {
    const res = simulate(team(ids.slice(10, 15), "L"), team(ids.slice(20, 25), "R"), { seed: 11 });
    const dead: Record<string, true> = {};
    for (const e of res.events) {
      if (e.t === "revive") delete dead[e.dst];
      if ((e.t === "basic" || e.t === "skill" || e.t === "miss") && dead[e.dst]) throw new Error(`hit dead ${e.dst}`);
      if (e.t === "death") dead[e.dst] = true;
    }
  });
});
