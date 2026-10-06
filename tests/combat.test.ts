import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  goldMultiplier,
  makeFighter,
  materializeCombatFormation,
  reflectOffenseStat,
  simulate,
  simulateMaterialized,
  turnOrder,
  type CombatEvent,
  type CombatResult,
  type Placement,
} from "../src/core/combat";

const team = (ids: string[], side: "L" | "R"): Placement[] =>
  ids.map((baseId, i) => ({ uid: `${side}${i}`, baseId, star: 1, row: i % 5, col: side === "L" ? 4 - Math.floor(i / 5) : 5 + Math.floor(i / 5) }));
const ids = NORMAL_UNITS.map((u) => u.id);
const firstCastWindow = (events: CombatEvent[], src: string): CombatEvent[] => {
  const from = events.findIndex((e) => e.t === "cast" && e.src === src);
  const to = events.findIndex((e, i) => i > from && e.t === "cast" && e.src === src);
  return from < 0 ? [] : events.slice(from, to < 0 ? undefined : to);
};
const firstTargetBy = (events: CombatEvent[], src: string) =>
  events.find((event) => (event.t === "basic" || event.t === "skill" || event.t === "miss") && event.src === src);



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

  it("materializes A77 stages once without mutating persistent placements", () => {
    const placement: Placement = {
      uid: "tank",
      baseId: "titan_earth",
      star: 1,
      row: 0,
      col: 4,
      equips: ["eq_blue_buff"],
      traits: [{ id: "tanker_thick_armor", seed: 17 }],
    };
    const before = structuredClone(placement);
    const formation = materializeCombatFormation([placement], [], {
      bonus: { L: { hpPct: 10, atkPct: 10, def: 2, startRage: 1, startShield: 3 } },
      scale: { L: { hp: 2, atk: 2, matk: 2 } },
      environment: "STONE",
      synergy: {
        L: [
          { kind: "class", key: "TANKER", count: 2, active: 2, next: 4, bonus: { hpPct: 8, def: 8 } },
          { kind: "element", key: "STONE", count: 2, active: 2, next: 4, bonus: { startShield: 18 } },
        ],
      },
    });

    expect(placement).toEqual(before);
    expect(formation).toHaveLength(1);
    expect(formation[0]).toMatchObject({
      uid: "tank",
      maxHp: 1508,
      hp: 1508,
      atk: 128,
      def: 66,
      rage: 1,
      shield: 39,
    });
  });

  it("simulateMaterialized consumes battle fighters without reapplying start modifiers", () => {
    const formation = materializeCombatFormation(
      [{ uid: "tank", baseId: "titan_earth", star: 1, row: 0, col: 4 }],
      [],
      { bonus: { L: { hpPct: 50, startRage: 2, startShield: 9 } }, environment: "STONE" },
    );
    const fighter = formation[0]!;
    const before = {
      maxHp: fighter.maxHp,
      hp: fighter.hp,
      rage: fighter.rage,
      shield: fighter.shield,
    };

    const result = simulateMaterialized(formation, { seed: 9 });

    expect(result.actions).toBe(0);
    expect(result.total).toEqual({ L: 1, R: 0 });
    expect(fighter).toMatchObject(before);
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

  it("replaces skill provenance when a stronger skill changes the merged status", () => {
    let merged: CombatEvent[] = [];
    for (let seed = 1; seed <= 32 && merged.length < 2; seed++) {
      const result = simulate(
        [
          { uid: "short", baseId: "bison_stampede", star: 1, row: 1, col: 4 },
          { uid: "long", baseId: "monkey_spear", star: 3, row: 1, col: 3 },
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
    expect(merged[0]).toMatchObject({
      turns: 1,
      source: {
        skillId: "damage_stun",
        unitUid: "short",
        unitBaseId: "bison_stampede",
        unitStar: 1,
        turns: 1,
        value: 0,
      },
    });
    expect(merged[1]).toMatchObject({
      turns: 2,
      source: {
        skillId: "rock_throw_stun",
        unitUid: "long",
        unitBaseId: "monkey_spear",
        unitStar: 3,
        turns: 2,
        value: 0,
      },
    });
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
    expect(merged[0]).toMatchObject({
      turns: 2,
      source: {
        skillId: "rock_throw_stun",
        unitUid: "long",
        unitBaseId: "monkey_spear",
        unitStar: 3,
        turns: 2,
        value: 0,
      },
    });
    expect(merged[1]).toMatchObject({
      turns: 2,
      source: {
        skillId: "rock_throw_stun",
        unitUid: "long",
        unitBaseId: "monkey_spear",
        unitStar: 3,
        turns: 2,
        value: 0,
      },
    });
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
    const healCast = observed!.result.events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "healer");
    if (!healCast) throw new Error("missing healer cast target plan");
    expect(healCast.targetPlan.skillTarget).toBe(observed!.expected);
    expect(healCast.targetPlan.unitUids).toContain(observed!.expected);

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

  it("RIGHT melee prefers nearest column, then same row, then top-first row sweep", () => {
    const melee = { uid: "right", baseId: "titan_earth", star: 1, row: 2, col: 5 };
    const nearest = simulate(
      [
        { uid: "near", baseId: "titan_earth", star: 1, row: 4, col: 4 },
        { uid: "same-far", baseId: "titan_earth", star: 1, row: 2, col: 3 },
      ],
      [melee],
      { seed: 3 },
    );
    expect(firstTargetBy(nearest.events, "right")).toMatchObject({ dst: "near" });

    const sameRow = simulate(
      [
        { uid: "top", baseId: "titan_earth", star: 1, row: 0, col: 4 },
        { uid: "same", baseId: "titan_earth", star: 1, row: 2, col: 4 },
      ],
      [melee],
      { seed: 3 },
    );
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same" });

    const topFirst = simulate(
      [
        { uid: "bottom", baseId: "titan_earth", star: 1, row: 4, col: 4 },
        { uid: "top", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      ],
      [melee],
      { seed: 3 },
    );
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top" });
  });

  it("RIGHT ranged prefers same row, then top-first row sweep before column distance", () => {
    const ranged = { uid: "right", baseId: "monkey_spear", star: 1, row: 2, col: 5 };
    const sameRow = simulate(
      [
        { uid: "top-near", baseId: "titan_earth", star: 1, row: 0, col: 4 },
        { uid: "same-far", baseId: "titan_earth", star: 1, row: 2, col: 0 },
      ],
      [ranged],
      { seed: 4 },
    );
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same-far" });

    const topFirst = simulate(
      [
        { uid: "bottom-near", baseId: "titan_earth", star: 1, row: 4, col: 4 },
        { uid: "top-far", baseId: "titan_earth", star: 1, row: 0, col: 0 },
      ],
      [ranged],
      { seed: 4 },
    );
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top-far" });
  });

  it("RIGHT Assassin takes the far/back column before row and class tie-breakers", () => {
    const result = simulate(
      [
        { uid: "near-mage", baseId: "salamander_flame", star: 1, row: 2, col: 4 },
        { uid: "far-tank", baseId: "titan_earth", star: 1, row: 4, col: 0 },
      ],
      [{ uid: "right", baseId: "weasel_quick", star: 1, row: 2, col: 5 }],
      { seed: 5 },
    );
    expect(firstTargetBy(result.events, "right")).toMatchObject({ dst: "far-tank" });
  });

  it("taunt overrides ordinary RIGHT target scoring while the taunter is alive", () => {
    const result = simulate(
      [
        { uid: "taunter", baseId: "golem_stone", star: 1, row: 0, col: 4 },
        { uid: "ordinary", baseId: "titan_earth", star: 1, row: 2, col: 4 },
      ],
      [{ uid: "right", baseId: "titan_earth", star: 1, row: 2, col: 5 }],
      { seed: 6, bonus: { L: { startRage: 4 } } },
    );
    expect(result.events.some((event) => event.t === "status" && event.dst === "right" && event.kind === "taunt")).toBe(true);
    expect(firstTargetBy(result.events, "right")).toMatchObject({ dst: "taunter" });
  });

  it("seeded RIGHT random-target pressure is reproducible and deterministic targeting suppresses only that pressure", () => {
    const left: Placement[] = [
      { uid: "same", baseId: "titan_earth", star: 1, row: 2, col: 0 },
      { uid: "top", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      { uid: "bottom", baseId: "titan_earth", star: 1, row: 4, col: 4 },
    ];
    const right: Placement[] = [{ uid: "right", baseId: "monkey_spear", star: 1, row: 2, col: 5 }];
    let observed: { seed: number; random: string; deterministic: string } | null = null;
    for (let seed = 1; seed <= 32 && !observed; seed++) {
      const pressured = firstTargetBy(simulate(left, right, { seed, rightRandomTargetChance: 1 }).events, "right");
      const deterministic = firstTargetBy(simulate(left, right, {
        seed,
        rightRandomTargetChance: 1,
        deterministicTargeting: true,
      }).events, "right");
      if (pressured && deterministic && "dst" in pressured && "dst" in deterministic && pressured.dst !== deterministic.dst) {
        observed = { seed, random: pressured.dst, deterministic: deterministic.dst };
      }
    }
    expect(observed).not.toBeNull();
    expect(observed!.deterministic).toBe("same");
    const replay = firstTargetBy(simulate(left, right, {
      seed: observed!.seed,
      rightRandomTargetChance: 1,
    }).events, "right");
    expect(replay).toMatchObject({ dst: observed!.random });
  });

  it("RIGHT Assassin breaks equal back-column ties by same row, then top-first row sweep", () => {
    const assassin = { uid: "right", baseId: "weasel_quick", star: 1, row: 2, col: 5 };
    const sameRow = simulate(
      [
        { uid: "top", baseId: "salamander_flame", star: 1, row: 0, col: 0 },
        { uid: "same", baseId: "titan_earth", star: 1, row: 2, col: 0 },
      ],
      [assassin],
      { seed: 5 },
    );
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same" });

    const topFirst = simulate(
      [
        { uid: "bottom", baseId: "titan_earth", star: 1, row: 4, col: 0 },
        { uid: "top", baseId: "salamander_flame", star: 1, row: 0, col: 0 },
      ],
      [assassin],
      { seed: 5 },
    );
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top" });
  });

  it("defers TANKER hit-response until on-hit aftermath finishes and prefers the attacker", () => {
    const result = simulate(
      [
        { uid: "attacker", baseId: "salamander_flame", star: 1, row: 4, col: 4 },
        { uid: "decoy", baseId: "titan_earth", star: 1, row: 0, col: 3 },
      ],
      [{ uid: "tank", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
      { seed: 3, environment: "FIRE", bonus: { R: { startRage: 4 } } },
    );
    const burnAt = result.events.findIndex((e) => e.t === "status" && e.dst === "tank" && e.kind === "burn");
    const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "tank" && e.trigger === "TANKER");
    expect(burnAt).toBeGreaterThanOrEqual(0);
    expect(castAt).toBeGreaterThan(burnAt);
    expect(result.events.slice(castAt + 1).find((e) => e.t === "skill" && e.src === "tank"))
      .toMatchObject({ dst: "attacker" });
  });

  it("a missed basic can still fill defender rage and schedule a TANKER auto-cast", () => {
    let observed: CombatResult | null = null;
    for (let seed = 1; seed <= 64 && !observed; seed++) {
      const result = simulate(
        [{ uid: "attacker", baseId: "titan_earth", star: 1, row: 0, col: 4 }],
        [{ uid: "tank", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
        { seed, environment: "WIND", bonus: { R: { startRage: 4 } } },
      );
      const missAt = result.events.findIndex((e) => e.t === "miss" && e.src === "attacker" && e.dst === "tank");
      const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "tank" && e.trigger === "TANKER");
      if (missAt >= 0 && castAt > missAt) observed = result;
    }
    expect(observed).not.toBeNull();
  });

  it("keeps deferred auto-cast ownership per fighter and revalidates silence before execution", () => {
    const twoTanks = simulate(
      [{ uid: "caster", baseId: "chimera_flame", star: 1, row: 0, col: 4 }],
      [
        { uid: "tankA", baseId: "kraken_deep", star: 1, row: 0, col: 5 },
        { uid: "tankB", baseId: "kraken_deep", star: 1, row: 1, col: 5 },
      ],
      { seed: 2, bonus: { L: { startRage: 5 }, R: { startRage: 4 } } },
    );
    expect(twoTanks.events.flatMap((e) => e.t === "cast" && e.trigger === "TANKER" ? [e.src] : []))
      .toEqual(expect.arrayContaining(["tankA", "tankB"]));

    const silenced = simulate(
      [{ uid: "left", baseId: "kraken_deep", star: 1, row: 0, col: 4 }],
      [{ uid: "right", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 5 }, R: { startRage: 4 } } },
    );
    const silenceAt = silenced.events.findIndex((e) => e.t === "status" && e.dst === "right" && e.kind === "silence");
    const nextRight = silenced.events.slice(silenceAt + 1).find((e) => "src" in e && e.src === "right");
    expect(silenceAt).toBeGreaterThanOrEqual(0);
    expect(nextRight).not.toMatchObject({ t: "cast", trigger: "TANKER" });
  });

  it("SUPPORT auto-casts only from a positive basic hit and self-falls back without self-harm", () => {
    const fallback = simulate(
      [{ uid: "support", baseId: "dryad_tree", star: 3, row: 0, col: 4 }],
      [{ uid: "fragile", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
      { seed: 1, bonus: { L: { startRage: 3, matkPct: 10_000 } } },
    );
    const triggeredAt = fallback.events.findIndex((e) => e.t === "cast" && e.src === "support" && e.trigger === "SUPPORT");
    expect(triggeredAt).toBeGreaterThanOrEqual(0);
    expect(fallback.events[triggeredAt]).toMatchObject({ targets: ["support"] });
    expect(fallback.events.slice(triggeredAt + 1).some((e) =>
      (e.t === "skill" && e.src === "support" && e.dst === "support")
      || (e.t === "status" && e.dst === "support" && e.kind === "silence"))).toBe(false);

    const fullRage = simulate(
      [{ uid: "support", baseId: "dryad_tree", star: 3, row: 0, col: 4 }],
      [{ uid: "enemy", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
      { seed: 1, bonus: { L: { startRage: 4 } } },
    );
    expect(fullRage.events.find((e) => e.t === "cast" && e.src === "support")).not.toHaveProperty("trigger");
  });


  it("reflects finalized HP damage, applies the authored ATK debuff, and never recursively reflects", () => {
    const reflected = simulate(
      [{ uid: "badger", baseId: "badger_stone", star: 3, row: 0, col: 4 }],
      [{ uid: "weasel", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 4, startShield: 20, hpPct: 1_000 }, R: { hpPct: 10_000 } } },
    );
    const incoming = reflected.events.find((e) => e.t === "basic" && e.src === "weasel" && e.dst === "badger");
    const bounce = reflected.events.find((e) => e.t === "reflect" && e.src === "badger" && e.dst === "weasel");
    if (!incoming || incoming.t !== "basic" || !bounce || bounce.t !== "reflect") throw new Error("missing authored physical reflect window");
    expect(bounce.dmg).toBe(Math.max(1, Math.round((incoming.dmg - incoming.absorbed) * 0.35)));
    const weasel = reflected.survivors.find((f) => f.uid === "weasel");
    expect(weasel?.mods.some((m) => m.stat === "atk" && m.value === -20)).toBe(true);
    expect(weasel?.mods.some((m) => m.stat === "matk" && m.value === -20)).toBe(false);
    expect(reflectOffenseStat("MAGE")).toBe("matk");
    expect(reflectOffenseStat("SUPPORT")).toBe("matk");
    expect(reflectOffenseStat("TANKER")).toBe("atk");

    const mirrorMatch = simulate(
      [{ uid: "left", baseId: "badger_stone", star: 1, row: 0, col: 4 }],
      [{ uid: "right", baseId: "badger_stone", star: 1, row: 0, col: 5 }],
      { seed: 3, bonus: { L: { startRage: 2 }, R: { startRage: 2 } } },
    );
    expect(mirrorMatch.events.some((e) => e.t === "reflect")).toBe(true);
    for (let i = 0; i < mirrorMatch.events.length - 1; i++) {
      if (mirrorMatch.events[i]!.t === "reflect") expect(mirrorMatch.events[i + 1]!.t).not.toBe("reflect");
    }
  });

  it("type-gates physical and magic reflection", () => {
    const physicalOnly = simulate(
      [{ uid: "badger", baseId: "badger_stone", star: 3, row: 0, col: 4 }],
      [{ uid: "mage", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 4 }, R: { matkPct: 1_000, hpPct: 500 } } },
    );
    expect(physicalOnly.events.some((e) => e.t === "reflect" && e.src === "badger")).toBe(false);

    const magicOnly = simulate(
      [{ uid: "butterfly", baseId: "butterfly_mirror", star: 1, row: 0, col: 4 }],
      [{ uid: "mage", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 2 }, R: { matkPct: 1_000, hpPct: 500 } } },
    );
    expect(magicOnly.events.some((e) => e.t === "reflect" && e.src === "butterfly" && e.dst === "mage")).toBe(true);
  });

  it("counters only a surviving melee attacker and owns lethal counter death immediately", () => {
    const lethalCounter = simulate(
      [{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 }],
      [{ uid: "enemy", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 4, atkPct: 100 } } },
    );
    const triggerAt = lethalCounter.events.findIndex((e) => e.t === "basic" && e.src === "enemy" && e.dst === "rhino");
    const counterAt = lethalCounter.events.findIndex((e, i) => i > triggerAt && e.t === "basic" && e.src === "rhino" && e.dst === "enemy");
    const deathAt = lethalCounter.events.findIndex((e) => e.t === "death" && e.dst === "enemy");
    expect(triggerAt).toBeGreaterThanOrEqual(0);
    expect(counterAt).toBe(triggerAt + 1);
    expect(deathAt).toBe(counterAt + 1);
    expect(lethalCounter.survivors.some((f) => f.uid === "enemy")).toBe(false);

    const deadDefender = simulate(
      [{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 }],
      [{ uid: "enemy", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 2 }, R: { atkPct: 2_000 } } },
    );
    expect(deadDefender.events.some((e) => e.t === "death" && e.dst === "rhino")).toBe(true);
    expect(deadDefender.events.some((e) => e.t === "basic" && e.src === "rhino" && e.dst === "enemy")).toBe(false);

    const ranged = simulate(
      [
        { uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 },
        { uid: "ally", baseId: "titan_earth", star: 1, row: 1, col: 4 },
      ],
      [{ uid: "ranged", baseId: "butterfly_mirror", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 2 } } },
    );
    const rangedHitAt = ranged.events.findIndex((e) => e.t === "basic" && e.src === "ranged" && e.dst === "rhino");
    expect(rangedHitAt).toBeGreaterThanOrEqual(0);
    const nextLeftAction = ranged.events.slice(rangedHitAt + 1).find((e) => "src" in e && (e.src === "rhino" || e.src === "ally"));
    expect(nextLeftAction).toMatchObject({ src: "ally" });
  });

  it("Phoenix rebirth is one-shot, restores the authored HP share, and later lethal damage kills normally", () => {
    const placement = { uid: "phoenix", baseId: "phoenix_rebirth", star: 1, row: 0, col: 4 };
    const base = makeFighter(placement, "L", { startRage: 3, startShield: 100 });
    const revived = simulate(
      [placement],
      [{ uid: "wolf", baseId: "wolverine_rage", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 3, startShield: 100 }, R: { atkPct: 1_000, hpPct: 1_000 } } },
    );
    const revives = revived.events.filter((e) => e.t === "revive" && e.dst === "phoenix");
    expect(revives).toHaveLength(1);
    expect(revives[0]).toMatchObject({ src: "phoenix", hp: Math.max(1, Math.round(base.maxHp * 0.3)) });
    const survivor = revived.survivors.find((f) => f.uid === "phoenix");
    expect(survivor).toMatchObject({ shield: 0, phoenix: { armed: false, used: true, revivePct: 0.3 } });

    const killedLater = simulate(
      [placement],
      [{ uid: "weasel", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 3, startShield: 100 }, R: { atkPct: 1_000_000, hpPct: 1_000 } } },
    );
    const laterRevives = killedLater.events.filter((e) => e.t === "revive" && e.dst === "phoenix");
    expect(laterRevives).toHaveLength(1);
    const reviveAt = killedLater.events.findIndex((e) => e === laterRevives[0]);
    expect(killedLater.events.findIndex((e, i) => i > reviveAt && e.t === "death" && e.dst === "phoenix")).toBeGreaterThan(reviveAt);
  });

  it("Berserk applies first-basic damage, lifesteal, kill rage/duration extension, and nearest chained basics", () => {
    const result = simulate(
      [
        { uid: "wolverine", baseId: "wolverine_rage", star: 3, row: 0, col: 4 },
        { uid: "ally1", baseId: "butterfly_mirror", star: 1, row: 1, col: 4 },
        { uid: "ally4", baseId: "butterfly_mirror", star: 1, row: 4, col: 4 },
      ],
      [
        { uid: "near", baseId: "firefly_light", star: 1, row: 0, col: 5 },
        { uid: "close", baseId: "firefly_light", star: 1, row: 1, col: 5 },
        { uid: "far", baseId: "firefly_light", star: 1, row: 4, col: 5 },
      ],
      { seed: 2, bonus: { L: { startRage: 3, atkPct: 400, hpPct: 1_000 } } },
    );
    const hits = result.events.filter((e): e is Extract<CombatEvent, { t: "basic" | "skill" }> => e.t === "basic" && e.src === "wolverine");
    expect(hits.map((e) => e.dst)).toEqual(["near", "close", "far"]);
    expect(hits.every((e) => !e.crit)).toBe(true);
    expect(hits[0]!.dmg).toBeGreaterThan(hits[1]!.dmg);
    expect(result.events.filter((e) => e.t === "heal" && e.src === "wolverine" && e.dst === "wolverine")).toHaveLength(2);
    const survivor = result.survivors.find((f) => f.uid === "wolverine");
    expect(survivor).toBeDefined();
    expect(survivor!.rage).toBe(survivor!.rageMax);
    expect(survivor!.berserk?.turns).toBe(5);
    expect(survivor!.mods.find((m) => m.stackKey === "self_bersek:atk:pct")?.turns).toBe(5);
  });

  it("A89 reuses random-unique skill targets in one resolved target plan", () => {
    const caster = makeFighter({ uid: "wasp", baseId: "wasp_sting", star: 1, row: 2, col: 4 }, "L");
    caster.rage = caster.rageMax;
    const enemies = ["a", "b", "c", "d"].map((uid, row) => {
      const fighter = makeFighter({ uid, baseId: "titan_earth", star: 1, row, col: 5 }, "R");
      fighter.maxHp = fighter.hp = 10_000;
      return fighter;
    });
    const result = simulateMaterialized([caster, ...enemies], { seed: 19 });
    const cast = result.events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "wasp");
    if (!cast) throw new Error("missing wasp cast");
    const hits = firstCastWindow(result.events, "wasp")
      .flatMap((e) => e.t === "skill" && e.src === "wasp" ? [e.dst] : []);

    expect(cast.targets).toHaveLength(2);
    expect(hits).toEqual(cast.targets);
    expect(cast.targetPlan.skillTarget).toBe(cast.targets[0]);
    expect(cast.targetPlan.unitUids).toEqual(cast.targets);
  });

  it("A89 preserves star-aware chain-shock target count and highest-rage order", () => {
    const run = (star: number) => {
      const caster = makeFighter({ uid: "shock", baseId: "jellyfish_shock", star, row: 2, col: 4 }, "L");
      caster.rage = caster.rageMax;
      const enemies = [
        { uid: "rage1", rage: 1 },
        { uid: "rage4", rage: 4 },
        { uid: "rage3", rage: 3 },
        { uid: "rage2", rage: 2 },
      ].map(({ uid, rage }, row) => {
        const fighter = makeFighter({ uid, baseId: "titan_earth", star: 1, row, col: 5 }, "R");
        fighter.rage = rage;
        fighter.maxHp = fighter.hp = 10_000;
        return fighter;
      });
      const result = simulateMaterialized([caster, ...enemies], { seed: 7 });
      const cast = result.events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "shock");
      if (!cast) throw new Error("missing chain-shock cast");
      return cast;
    };

    const oneStar = run(1);
    const twoStar = run(2);
    expect(oneStar.targets).toEqual(["rage4", "rage3"]);
    expect(oneStar.targetPlan.unitUids).toEqual(oneStar.targets);
    expect(twoStar.targets).toEqual(["rage4", "rage3", "rage2"]);
    expect(twoStar.targetPlan.unitUids).toEqual(twoStar.targets);
  });

  it("A89 resolves frost storm to the authored highest-total-ATK enemy column", () => {
    const caster = makeFighter({ uid: "frost", baseId: "ice_mage", star: 1, row: 2, col: 4 }, "L");
    caster.rage = caster.rageMax;
    const lowA = makeFighter({ uid: "lowA", baseId: "titan_earth", star: 1, row: 0, col: 5 }, "R");
    const highA = makeFighter({ uid: "highA", baseId: "titan_earth", star: 1, row: 1, col: 6 }, "R");
    const lowB = makeFighter({ uid: "lowB", baseId: "titan_earth", star: 1, row: 2, col: 5 }, "R");
    const highB = makeFighter({ uid: "highB", baseId: "titan_earth", star: 1, row: 3, col: 6 }, "R");
    lowA.atk = lowB.atk = 10;
    highA.atk = 220;
    highB.atk = 180;
    for (const fighter of [lowA, highA, lowB, highB]) fighter.maxHp = fighter.hp = 10_000;

    const result = simulateMaterialized([caster, lowA, highA, lowB, highB], { seed: 5 });
    const cast = result.events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "frost");
    if (!cast) throw new Error("missing frost cast");
    const hits = firstCastWindow(result.events, "frost")
      .flatMap((e) => e.t === "skill" && e.src === "frost" ? [e.dst] : []);

    expect(cast.targets).toEqual(["highA", "highB"]);
    expect(cast.targetPlan.skillTarget).toBe("highA");
    expect(cast.targetPlan.unitUids).toEqual(["highA", "highB"]);
    expect(hits).toEqual(["highA", "highB"]);
  });

  it("A89 expands mixed team-defense targeting to every living ally and excludes dead units", () => {
    const caster = makeFighter({ uid: "elder", baseId: "lizard_elder", star: 1, row: 2, col: 4 }, "L");
    const low = makeFighter({ uid: "low", baseId: "firefly_light", star: 1, row: 1, col: 4 }, "L");
    const healthy = makeFighter({ uid: "healthy", baseId: "salamander_flame", star: 1, row: 3, col: 4 }, "L");
    const dead = makeFighter({ uid: "dead", baseId: "dove_peace", star: 1, row: 4, col: 4 }, "L");
    const enemy = makeFighter({ uid: "enemy", baseId: "titan_earth", star: 1, row: 2, col: 5 }, "R");
    caster.rage = caster.rageMax;
    low.hp = Math.max(1, Math.floor(low.maxHp * 0.2));
    healthy.hp = Math.max(1, Math.floor(healthy.maxHp * 0.8));
    dead.hp = 0;
    dead.alive = false;
    enemy.maxHp = enemy.hp = 10_000;

    const result = simulateMaterialized([caster, low, healthy, dead, enemy], { seed: 3 });
    const cast = result.events.find((e): e is Extract<CombatEvent, { t: "cast" }> => e.t === "cast" && e.src === "elder");
    if (!cast) throw new Error("missing team-defense cast");

    expect(cast.targets).toEqual(["low"]);
    expect(cast.targetPlan.actionTarget).toBe("enemy");
    expect(cast.targetPlan.skillTarget).toBe("low");
    expect(cast.targetPlan.unitUids).toEqual(["low", "elder", "healthy"]);
    expect(cast.targetPlan.unitUids).not.toContain("dead");
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
