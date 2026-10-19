import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { goldMultiplier, materializeCombat, reflectOffenseStat, simulate as runCombat, turnOrder, type CombatEvent, type CombatOptions, type CombatResult, type Placement, type SideBonus } from "../src/core/combat";

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
type BattleOptions = CombatOptions & {
  bonus?: Partial<Record<"L" | "R", SideBonus>>;
  environment?: NonNullable<Parameters<typeof materializeCombat>[2]>["environment"];
};
const battle = (left: Placement[], right: Placement[], options: BattleOptions): CombatResult => {
  const { bonus, environment, ...runtime } = options;
  return runCombat(materializeCombat(left, right, {
    leftPersistent: bonus?.L,
    synergy: bonus?.R ? { R: bonus.R } : undefined,
    environment,
  }), runtime);
};
const materializeOne = (placement: Placement, side: "L" | "R", bonus?: SideBonus, environment?: BattleOptions["environment"]) =>
  materializeCombat(side === "L" ? [placement] : [], side === "R" ? [placement] : [], {
    leftPersistent: side === "L" ? bonus : undefined,
    synergy: side === "R" && bonus ? { R: bonus } : undefined,
    environment,
  })[0]!;



describe("combat", () => {
  it("gold multiplier follows A13 (no floor, cap 2.0 at 210)", () => {
    expect([goldMultiplier(-5), goldMultiplier(10), goldMultiplier(11), goldMultiplier(12), goldMultiplier(210), goldMultiplier(999)])
      .toEqual([1, 1, 1.005, 1.01, 2, 2]);
  });

  it("turn order interleaves sides, LEFT cols 4→0, RIGHT cols 5→9", () => {
    const fs = [
      materializeOne({ uid: "a", baseId: ids[0]!, star: 1, row: 0, col: 3 }, "L"),
      materializeOne({ uid: "b", baseId: ids[0]!, star: 1, row: 1, col: 4 }, "L"),
      materializeOne({ uid: "c", baseId: ids[0]!, star: 1, row: 0, col: 6 }, "R"),
      materializeOne({ uid: "d", baseId: ids[0]!, star: 1, row: 2, col: 5 }, "R"),
    ];
    expect(turnOrder(fs).map((f) => f.uid)).toEqual(["b", "d", "a", "c"]);
  });

  it("keeps empty-cell timing entries presentation-only for sparse scan positions", () => {
    const frontLeft: Placement[] = [{ uid: "left", baseId: "salamander_flame", star: 1, row: 0, col: 4 }];
    const frontRight: Placement[] = [{ uid: "right", baseId: "salamander_flame", star: 1, row: 0, col: 5 }];
    const sparseLeft: Placement[] = [{ ...frontLeft[0]!, col: 0 }];
    const sparseRight: Placement[] = [{ ...frontRight[0]!, col: 9 }];
    const front = battle(frontLeft, frontRight, { seed: 17 });
    const sparse = battle(sparseLeft, sparseRight, { seed: 17 });
    const frontFirstAction = front.events.findIndex((event) =>
      event.t === "basic" || event.t === "skill" || event.t === "miss" || event.t === "skip");
    const sparseFirstAction = sparse.events.findIndex((event) =>
      event.t === "basic" || event.t === "skill" || event.t === "miss" || event.t === "skip");
    const frontSemantic = {
      winner: front.winner,
      alive: front.alive,
      total: front.total,
      bounty: front.bounty,
      bountyKills: front.bountyKills,
      actions: front.actions,
      events: front.events.filter((event) => event.t !== "empty"),
      survivors: front.survivors.map(({ uid, hp, maxHp, rage, shield, alive }) => ({
        uid, hp, maxHp, rage, shield, alive,
      })),
    };
    const sparseSemantic = {
      winner: sparse.winner,
      alive: sparse.alive,
      total: sparse.total,
      bounty: sparse.bounty,
      bountyKills: sparse.bountyKills,
      actions: sparse.actions,
      events: sparse.events.filter((event) => event.t !== "empty"),
      survivors: sparse.survivors.map(({ uid, hp, maxHp, rage, shield, alive }) => ({
        uid, hp, maxHp, rage, shield, alive,
      })),
    };

    expect(sparseFirstAction).toBeGreaterThan(frontFirstAction);
    expect(sparse.events.some((event) => event.t === "empty")).toBe(true);
    expect(sparseSemantic).toEqual(frontSemantic);
  });

  it("interleaves multi-unit sparse chunks without letting empty slots reorder attacks", () => {
    const fighters = materializeCombat(
      [
        { uid: "L-back", baseId: "titan_earth", star: 1, row: 2, col: 2 },
        { uid: "L-front-low", baseId: "titan_earth", star: 1, row: 3, col: 4 },
        { uid: "L-front-high", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      ],
      [
        { uid: "R-back", baseId: "titan_earth", star: 1, row: 1, col: 8 },
        { uid: "R-middle", baseId: "titan_earth", star: 1, row: 4, col: 6 },
        { uid: "R-front", baseId: "titan_earth", star: 1, row: 2, col: 5 },
      ],
    );
    expect(turnOrder(fighters).map((fighter) => fighter.uid)).toEqual([
      "L-front-high", "R-front", "L-front-low", "R-middle", "L-back", "R-back",
    ]);
    for (const fighter of fighters) {
      fighter.maxHp = fighter.hp = 1_000_000;
      fighter.atk = fighter.matk = 1;
      fighter.rageMax = 1_000;
      fighter.crit = fighter.evade = 0;
    }
    const result = runCombat(fighters, { seed: 29, rageGain: { L: 0, R: 0 } });
    const cycleTwo = result.events.findIndex((event) => event.t === "cycle" && event.cycle === 2);
    expect(cycleTwo).toBeGreaterThan(0);
    const chunks: string[][] = [];
    let emptySlots: string[] = [];
    for (const event of result.events.slice(1, cycleTwo)) {
      if (event.t === "empty") emptySlots.push(`${event.side}${event.col}:${event.row}`);
      if (event.t === "basic" || event.t === "miss" || event.t === "skip") {
        chunks.push([...emptySlots, event.src]);
        emptySlots = [];
      }
    }
    expect(chunks).toEqual([
      ["L-front-high"],
      ["R5:0", "R5:1", "R-front"],
      ["L4:1", "L4:2", "L-front-low"],
      ["R5:3", "R5:4", "R6:0", "R6:1", "R6:2", "R6:3", "R-middle"],
      ["L4:4", "L3:0", "L3:1", "L3:2", "L3:3", "L3:4", "L2:0", "L2:1", "L-back"],
      ["R7:0", "R7:1", "R7:2", "R7:3", "R7:4", "R8:0", "R-back"],
    ]);
    expect(emptySlots).toEqual([
      "L2:3", "L2:4", "L1:0", "L1:1", "L1:2", "L1:3", "L1:4",
      "L0:0", "L0:1", "L0:2", "L0:3", "L0:4",
      "R8:2", "R8:3", "R8:4", "R9:0", "R9:1", "R9:2", "R9:3", "R9:4",
    ]);
  });

  it("stops after exactly 20 full cycles when both sides survive", () => {
    const fighters = materializeCombat(
      [{ uid: "L", baseId: "titan_earth", star: 1, row: 0, col: 4 }],
      [{ uid: "R", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
    );
    for (const fighter of fighters) {
      fighter.maxHp = fighter.hp = 1_000_000;
      fighter.atk = fighter.matk = 1;
      fighter.rageMax = 1_000;
      fighter.crit = fighter.evade = 0;
    }
    const result = runCombat(fighters, { seed: 53, rageGain: { L: 0, R: 0 } });
    expect(result.events.filter((event) => event.t === "cycle").map((event) => event.cycle))
      .toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(result.actions).toBe(40);
    expect(result.alive).toEqual({ L: 1, R: 1 });
    expect(result.winner).toBeNull();
  });

  it("ticks an existing burn exactly once at each cycle boundary and never again during turns", () => {
    const fighters = materializeCombat(
      [{ uid: "burned", baseId: "titan_earth", star: 1, row: 0, col: 4 }],
      [{ uid: "enemy", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
    );
    for (const fighter of fighters) {
      fighter.maxHp = 1_000_000;
      fighter.hp = 1_000_000;
      fighter.atk = 1;
      fighter.matk = 1;
    }
    fighters[0]!.status.burn = { turns: 2, value: 7 };

    const result = runCombat(fighters, { seed: 19 });
    const burnEvents = result.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.t === "dot" && event.dst === "burned" && event.kind === "burn");
    expect(burnEvents).toHaveLength(2);
    expect(burnEvents.map(({ event }) => event.t === "dot" ? event.dmg : 0)).toEqual([7, 7]);

    const cycleForEvent = (eventIndex: number) => {
      for (let index = eventIndex; index >= 0; index--) {
        const event = result.events[index]!;
        if (event.t === "cycle") return event.cycle;
      }
      return null;
    };
    expect(burnEvents.map(({ index }) => cycleForEvent(index))).toEqual([1, 2]);
    expect(result.events.filter((event) => event.t === "cycle").length).toBeGreaterThan(2);
    expect(result.fighters.find((fighter) => fighter.uid === "burned")?.status.burn).toBeUndefined();
  });

  it("is deterministic for identical input + seed", () => {
    const l = team(ids.slice(0, 5), "L");
    const r = team(ids.slice(5, 10), "R");
    const a = battle(l, r, { seed: 7 });
    const b = battle(l, r, { seed: 7 });
    expect(a.events).toEqual(b.events);
    expect(a.winner).toBe(b.winner);
  });

  it("every unit fights to a valid resolution without throwing; HP never out of bounds", () => {
    for (let i = 0; i < ids.length; i += 5) {
      const res = battle(team(ids.slice(i, i + 5), "L"), team(ids.slice((i + 60) % 120, (i + 60) % 120 + 5), "R"), { seed: i });
      expect(res.actions).toBeGreaterThan(0);
      for (const f of res.survivors) expect(f.hp).toBeGreaterThan(0), expect(f.hp).toBeLessThanOrEqual(f.maxHp);
      if (res.winner) expect(res.alive[res.winner === "L" ? "R" : "L"]).toBe(0);
    }
  });

  it("3★ team beats the same 1★ team", () => {
    const l = team(ids.slice(0, 5), "L").map((p) => ({ ...p, star: 3 }));
    expect(battle(l, team(ids.slice(0, 5), "R"), { seed: 3 }).winner).toBe("L");
  });
  it("gates stun with deterministic RNG after damage and never stuns a killed target", () => {
    const left = [{ uid: "bison", baseId: "bison_stampede", star: 1, row: 0, col: 4 }];
    const right = [{ uid: "target", baseId: "titan_earth", star: 1, row: 0, col: 5 }];
    const outcomes = new Set<boolean>();
    let successfulWindow: CombatEvent[] = [];
    for (let seed = 1; seed <= 24; seed++) {
      const result = battle(left, right, { seed, bonus: { L: { startRage: 3 } } });
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

    const lethal = battle([{ uid: "bison", baseId: "bison_stampede", star: 3, row: 0, col: 4 }],
    [{ uid: "fragile", baseId: "salamander_flame", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 5 } } },);
    const lethalWindow = firstCastWindow(lethal.events, "bison");
    expect(lethalWindow.some((e) => e.t === "death" && e.dst === "fragile")).toBe(true);
    expect(lethalWindow.some((e) => e.t === "status" && e.dst === "fragile" && e.kind === "stun")).toBe(false);
  });

  it("team DEF refresh keeps the stronger value and longer duration instead of stacking", () => {
    const result = battle([
      { uid: "strong", baseId: "titan_earth", star: 3, row: 0, col: 4 },
      { uid: "weak", baseId: "lizard_elder", star: 1, row: 1, col: 4 },
      { uid: "finisher", baseId: "bison_stampede", star: 3, row: 2, col: 4 },
    ],
    [{ uid: "fragile", baseId: "salamander_flame", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 4 } } },);
    const strong = result.survivors.find((f) => f.uid === "strong")!;
    const defense = strong.mods.filter((m) => m.stat === "def" && !m.pct);
    expect(defense).toHaveLength(1);
    expect(defense[0]).toMatchObject({ value: 45, turns: 4 });
  });

  it("applies the star effect-chance multiplier before stun gating", () => {
    for (let seed = 1; seed <= 24; seed++) {
      const result = battle([{ uid: "bison", baseId: "bison_stampede", star: 3, row: 0, col: 4 }],
      [{ uid: "target", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
      { seed, bonus: { L: { startRage: 4 } } },);
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
      const result = battle([
        { uid: "short", baseId: "bison_stampede", star: 1, row: 1, col: 4 },
        { uid: "long", baseId: "monkey_spear", star: 3, row: 1, col: 3 },
      ],
      [
        { uid: "decoy", baseId: "titan_earth", star: 1, row: 0, col: 5 },
        { uid: "target", baseId: "titan_earth", star: 1, row: 1, col: 5 },
      ],
      { seed, bonus: { L: { startRage: 4 } } },);
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
      const result = battle([
        { uid: "long", baseId: "monkey_spear", star: 3, row: 1, col: 4 },
        { uid: "short", baseId: "bison_stampede", star: 1, row: 1, col: 3 },
      ],
      [
        { uid: "decoy", baseId: "titan_earth", star: 1, row: 0, col: 5 },
        { uid: "target", baseId: "titan_earth", star: 1, row: 1, col: 5 },
      ],
      { seed, bonus: { L: { startRage: 4 } } },);
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
      const result = battle(left, right, { seed, bonus: { L: { startRage: 2 } } });
      const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "healer");
      if (castAt < 0) continue;
      const before = result.events.slice(0, castAt);
      const ratios = left.slice(0, 2).map((p) => {
        const fighter = materializeOne(p, "L", { startRage: 2 });
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

    const full = battle([{ uid: "healer", baseId: "dove_peace", star: 1, row: 0, col: 4 }],
    [{ uid: "enemy", baseId: "titan_earth", star: 1, row: 4, col: 5 }],
    { seed: 1, bonus: { L: { startRage: 2 } } },);
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
      const result = battle(left, right, { seed, bonus: { L: { startRage: 2 } } });
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
    const nearest = battle([
      { uid: "near", baseId: "titan_earth", star: 1, row: 4, col: 4 },
      { uid: "same-far", baseId: "titan_earth", star: 1, row: 2, col: 3 },
    ],
    [melee],
    { seed: 3 },);
    expect(firstTargetBy(nearest.events, "right")).toMatchObject({ dst: "near" });

    const sameRow = battle([
      { uid: "top", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      { uid: "same", baseId: "titan_earth", star: 1, row: 2, col: 4 },
    ],
    [melee],
    { seed: 3 },);
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same" });

    const topFirst = battle([
      { uid: "bottom", baseId: "titan_earth", star: 1, row: 4, col: 4 },
      { uid: "top", baseId: "titan_earth", star: 1, row: 0, col: 4 },
    ],
    [melee],
    { seed: 3 },);
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top" });
  });

  it("RIGHT ranged prefers same row, then top-first row sweep before column distance", () => {
    const ranged = { uid: "right", baseId: "monkey_spear", star: 1, row: 2, col: 5 };
    const sameRow = battle([
      { uid: "top-near", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      { uid: "same-far", baseId: "titan_earth", star: 1, row: 2, col: 0 },
    ],
    [ranged],
    { seed: 4 },);
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same-far" });

    const topFirst = battle([
      { uid: "bottom-near", baseId: "titan_earth", star: 1, row: 4, col: 4 },
      { uid: "top-far", baseId: "titan_earth", star: 1, row: 0, col: 0 },
    ],
    [ranged],
    { seed: 4 },);
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top-far" });
  });

  it("RIGHT Assassin takes the far/back column before row and class tie-breakers", () => {
    const result = battle([
      { uid: "near-mage", baseId: "salamander_flame", star: 1, row: 2, col: 4 },
      { uid: "far-tank", baseId: "titan_earth", star: 1, row: 4, col: 0 },
    ],
    [{ uid: "right", baseId: "weasel_quick", star: 1, row: 2, col: 5 }],
    { seed: 5 },);
    expect(firstTargetBy(result.events, "right")).toMatchObject({ dst: "far-tank" });
  });

  it("taunt overrides ordinary RIGHT target scoring while the taunter is alive", () => {
    const result = battle([
      { uid: "taunter", baseId: "golem_stone", star: 1, row: 0, col: 4 },
      { uid: "ordinary", baseId: "titan_earth", star: 1, row: 2, col: 4 },
    ],
    [{ uid: "right", baseId: "titan_earth", star: 1, row: 2, col: 5 }],
    { seed: 6, bonus: { L: { startRage: 4 } } },);
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
      const pressured = firstTargetBy(battle(left, right, { seed, rightRandomTargetChance: 1 }).events, "right");
      const deterministic = firstTargetBy(battle(left, right, {
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
    const replay = firstTargetBy(battle(left, right, {
      seed: observed!.seed,
      rightRandomTargetChance: 1,
    }).events, "right");
    expect(replay).toMatchObject({ dst: observed!.random });
  });

  it("RIGHT Assassin breaks equal back-column ties by same row, then top-first row sweep", () => {
    const assassin = { uid: "right", baseId: "weasel_quick", star: 1, row: 2, col: 5 };
    const sameRow = battle([
      { uid: "top", baseId: "salamander_flame", star: 1, row: 0, col: 0 },
      { uid: "same", baseId: "titan_earth", star: 1, row: 2, col: 0 },
    ],
    [assassin],
    { seed: 5 },);
    expect(firstTargetBy(sameRow.events, "right")).toMatchObject({ dst: "same" });

    const topFirst = battle([
      { uid: "bottom", baseId: "titan_earth", star: 1, row: 4, col: 0 },
      { uid: "top", baseId: "salamander_flame", star: 1, row: 0, col: 0 },
    ],
    [assassin],
    { seed: 5 },);
    expect(firstTargetBy(topFirst.events, "right")).toMatchObject({ dst: "top" });
  });

  it("defers TANKER hit-response until on-hit aftermath finishes and prefers the attacker", () => {
    const result = battle([
      { uid: "attacker", baseId: "salamander_flame", star: 1, row: 4, col: 4 },
      { uid: "decoy", baseId: "titan_earth", star: 1, row: 0, col: 3 },
    ],
    [{ uid: "tank", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
    { seed: 3, environment: "FIRE", bonus: { R: { startRage: 4 } } },);
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
      const result = battle([{ uid: "attacker", baseId: "titan_earth", star: 1, row: 0, col: 4 }],
      [{ uid: "tank", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
      { seed, environment: "WIND", bonus: { R: { startRage: 4 } } },);
      const missAt = result.events.findIndex((e) => e.t === "miss" && e.src === "attacker" && e.dst === "tank");
      const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "tank" && e.trigger === "TANKER");
      if (missAt >= 0 && castAt > missAt) observed = result;
    }
    expect(observed).not.toBeNull();
  });

  it("keeps deferred auto-cast ownership per fighter and revalidates silence before execution", () => {
    const twoTanks = battle([{ uid: "caster", baseId: "chimera_flame", star: 1, row: 0, col: 4 }],
    [
      { uid: "tankA", baseId: "kraken_deep", star: 1, row: 0, col: 5 },
      { uid: "tankB", baseId: "kraken_deep", star: 1, row: 1, col: 5 },
    ],
    { seed: 2, bonus: { L: { startRage: 5 }, R: { startRage: 4 } } },);
    expect(twoTanks.events.flatMap((e) => e.t === "cast" && e.trigger === "TANKER" ? [e.src] : []))
      .toEqual(expect.arrayContaining(["tankA", "tankB"]));

    const silenced = battle([{ uid: "left", baseId: "kraken_deep", star: 1, row: 0, col: 4 }],
    [{ uid: "right", baseId: "kraken_deep", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 5 }, R: { startRage: 4 } } },);
    const silenceAt = silenced.events.findIndex((e) => e.t === "status" && e.dst === "right" && e.kind === "silence");
    const nextRight = silenced.events.slice(silenceAt + 1).find((e) => "src" in e && e.src === "right");
    expect(silenceAt).toBeGreaterThanOrEqual(0);
    expect(nextRight).not.toMatchObject({ t: "cast", trigger: "TANKER" });
  });

  it("SUPPORT auto-casts only from a positive basic hit and self-falls back without self-harm", () => {
    const fallback = battle([{ uid: "support", baseId: "dryad_tree", star: 3, row: 0, col: 4 }],
    [{ uid: "fragile", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
    { seed: 1, bonus: { L: { startRage: 3, matkPct: 10_000 } } },);
    const triggeredAt = fallback.events.findIndex((e) => e.t === "cast" && e.src === "support" && e.trigger === "SUPPORT");
    expect(triggeredAt).toBeGreaterThanOrEqual(0);
    expect(fallback.events[triggeredAt]).toMatchObject({ targets: ["support"] });
    expect(fallback.events.slice(triggeredAt + 1).some((e) =>
      (e.t === "skill" && e.src === "support" && e.dst === "support")
      || (e.t === "status" && e.dst === "support" && e.kind === "silence"))).toBe(false);

    const fullRage = battle([{ uid: "support", baseId: "dryad_tree", star: 3, row: 0, col: 4 }],
    [{ uid: "enemy", baseId: "titan_earth", star: 1, row: 0, col: 5 }],
    { seed: 1, bonus: { L: { startRage: 4 } } },);
    expect(fullRage.events.find((e) => e.t === "cast" && e.src === "support")).not.toHaveProperty("trigger");
  });


  it("reflects finalized HP damage, applies the authored ATK debuff, and never recursively reflects", () => {
    const reflected = battle([{ uid: "badger", baseId: "badger_stone", star: 3, row: 0, col: 4 }],
    [{ uid: "weasel", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 4, startShield: 20, hpPct: 1_000 }, R: { hpPct: 10_000 } } },);
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

    const mirrorMatch = battle([{ uid: "left", baseId: "badger_stone", star: 1, row: 0, col: 4 }],
    [{ uid: "right", baseId: "badger_stone", star: 1, row: 0, col: 5 }],
    { seed: 3, bonus: { L: { startRage: 2 }, R: { startRage: 2 } } },);
    expect(mirrorMatch.events.some((e) => e.t === "reflect")).toBe(true);
    for (let i = 0; i < mirrorMatch.events.length - 1; i++) {
      if (mirrorMatch.events[i]!.t === "reflect") expect(mirrorMatch.events[i + 1]!.t).not.toBe("reflect");
    }
  });

  it("type-gates physical and magic reflection", () => {
    const physicalOnly = battle([{ uid: "badger", baseId: "badger_stone", star: 3, row: 0, col: 4 }],
    [{ uid: "mage", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 4 }, R: { matkPct: 1_000, hpPct: 500 } } },);
    expect(physicalOnly.events.some((e) => e.t === "reflect" && e.src === "badger")).toBe(false);
    const mage = physicalOnly.survivors.find((f) => f.uid === "mage");
    expect(mage?.mods.some((m) => (m.stat === "atk" || m.stat === "matk") && m.value === -20)).toBe(false);

    const magicOnly = battle([{ uid: "butterfly", baseId: "butterfly_mirror", star: 1, row: 0, col: 4 }],
    [{ uid: "mage", baseId: "firefly_light", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 2 }, R: { matkPct: 1_000, hpPct: 500 } } },);
    expect(magicOnly.events.some((e) => e.t === "reflect" && e.src === "butterfly" && e.dst === "mage")).toBe(true);
  });

  it("does not let lifesteal rescue an attacker made lethal by reflect", () => {
    const result = battle([{ uid: "badger", baseId: "badger_stone", star: 3, row: 0, col: 4 }],
    [{ uid: "attacker", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    {
      seed: 2,
      bonus: {
        L: { startRage: 4, hpPct: 10_000 },
        R: { atkPct: 10_000, lifestealPct: 100 },
      },
    },);
    const reflectAt = result.events.findIndex((e) => e.t === "reflect" && e.src === "badger" && e.dst === "attacker");
    expect(reflectAt).toBeGreaterThanOrEqual(0);
    expect(result.events.slice(reflectAt + 1).find((e) => e.t === "heal" && e.src === "attacker")).toBeUndefined();
    expect(result.events.slice(reflectAt + 1).find((e) => e.t === "death" && e.dst === "attacker")).toBeDefined();
  });

  it("counters only a surviving melee attacker and owns lethal counter death immediately", () => {
    const lethalCounter = battle([{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 }],
    [{ uid: "enemy", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 4, atkPct: 100 } } },);
    const triggerAt = lethalCounter.events.findIndex((e) => e.t === "basic" && e.src === "enemy" && e.dst === "rhino");
    const counterAt = lethalCounter.events.findIndex((e, i) => i > triggerAt && e.t === "basic" && e.src === "rhino" && e.dst === "enemy");
    const deathAt = lethalCounter.events.findIndex((e) => e.t === "death" && e.dst === "enemy");
    expect(triggerAt).toBeGreaterThanOrEqual(0);
    expect(counterAt).toBe(triggerAt + 1);
    expect(deathAt).toBe(counterAt + 1);
    expect(lethalCounter.survivors.some((f) => f.uid === "enemy")).toBe(false);

    const deadDefender = battle([{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 }],
    [{ uid: "enemy", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 2 }, R: { atkPct: 2_000 } } },);
    expect(deadDefender.events.some((e) => e.t === "death" && e.dst === "rhino")).toBe(true);
    expect(deadDefender.events.some((e) => e.t === "basic" && e.src === "rhino" && e.dst === "enemy")).toBe(false);

    const ranged = battle([
      { uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 },
      { uid: "ally", baseId: "titan_earth", star: 1, row: 1, col: 4 },
    ],
    [{ uid: "ranged", baseId: "butterfly_mirror", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 2 } } },);
    const rangedHitAt = ranged.events.findIndex((e) => e.t === "basic" && e.src === "ranged" && e.dst === "rhino");
    expect(rangedHitAt).toBeGreaterThanOrEqual(0);
    const nextLeftAction = ranged.events.slice(rangedHitAt + 1).find((e) => "src" in e && (e.src === "rhino" || e.src === "ally"));
    expect(nextLeftAction).toMatchObject({ src: "ally" });
  });

  it("Phoenix rebirth is one-shot, restores the authored HP share, and later lethal damage kills normally", () => {
    const placement = { uid: "phoenix", baseId: "phoenix_rebirth", star: 1, row: 0, col: 4 };
    const base = materializeOne(placement, "L", { startRage: 3, startShield: 100 });
    const revived = battle([placement],
    [{ uid: "wolf", baseId: "wolverine_rage", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 3, startShield: 100 }, R: { atkPct: 1_000, hpPct: 1_000 } } },);
    const revives = revived.events.filter((e) => e.t === "revive" && e.dst === "phoenix");
    expect(revives).toHaveLength(1);
    expect(revives[0]).toMatchObject({ src: "phoenix", hp: Math.max(1, Math.round(base.maxHp * 0.3)) });
    const survivor = revived.survivors.find((f) => f.uid === "phoenix");
    expect(survivor).toMatchObject({ shield: 0, phoenix: { armed: false, used: true, revivePct: 0.3 } });

    const killedLater = battle([placement],
    [{ uid: "weasel", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 3, startShield: 100 }, R: { atkPct: 1_000_000, hpPct: 1_000 } } },);
    const laterRevives = killedLater.events.filter((e) => e.t === "revive" && e.dst === "phoenix");
    expect(laterRevives).toHaveLength(1);
    const reviveAt = killedLater.events.findIndex((e) => e === laterRevives[0]);
    expect(killedLater.events.findIndex((e, i) => i > reviveAt && e.t === "death" && e.dst === "phoenix")).toBeGreaterThan(reviveAt);
  });

  it("Berserk applies first-basic damage, lifesteal, kill rage/duration extension, and nearest chained basics", () => {
    const result = battle([
      { uid: "wolverine", baseId: "wolverine_rage", star: 3, row: 0, col: 4 },
      { uid: "ally1", baseId: "butterfly_mirror", star: 1, row: 1, col: 4 },
      { uid: "ally4", baseId: "butterfly_mirror", star: 1, row: 4, col: 4 },
    ],
    [
      { uid: "near", baseId: "firefly_light", star: 1, row: 0, col: 5 },
      { uid: "close", baseId: "firefly_light", star: 1, row: 1, col: 5 },
      { uid: "far", baseId: "firefly_light", star: 1, row: 4, col: 5 },
    ],
    { seed: 2, bonus: { L: { startRage: 3, atkPct: 400, hpPct: 1_000 } } },);
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

  it("ticks authored HOT at start of the living target turn instead of healing on cast", () => {
    const result = battle([
      { uid: "front", baseId: "titan_earth", star: 1, row: 0, col: 4 },
      { uid: "deer", baseId: "deer_song", star: 1, row: 0, col: 3 },
    ],
    [{ uid: "enemy", baseId: "weasel_quick", star: 1, row: 0, col: 5 }],
    { seed: 2, bonus: { L: { startRage: 1 }, R: { hpPct: 1_000 } } },);
    const castAt = result.events.findIndex((e) => e.t === "cast" && e.src === "deer");
    const hotAt = result.events.findIndex((e, i) => i > castAt && e.t === "status" && e.kind === "hot" && e.dst === "deer");
    const interveningHitAt = result.events.findIndex((e, i) => i > hotAt && e.t === "skill" && e.src === "enemy" && e.dst === "deer");
    const healAt = result.events.findIndex((e, i) => i > hotAt && e.t === "heal" && e.src === "deer" && e.dst === "deer");
    const nextDeerActionAt = result.events.findIndex((e, i) => i > hotAt
      && (e.t === "basic" || e.t === "skill" || e.t === "miss" || e.t === "skip" || e.t === "cast") && e.src === "deer");
    expect(castAt).toBeGreaterThanOrEqual(0);
    expect(hotAt).toBeGreaterThan(castAt);
    expect(interveningHitAt).toBeGreaterThan(hotAt);
    expect(healAt).toBeGreaterThan(interveningHitAt);
    expect(healAt).toBeLessThan(nextDeerActionAt);
  });

  it("dead units leave target selection: no event targets a unit after its death", () => {
    const res = battle(team(ids.slice(10, 15), "L"), team(ids.slice(20, 25), "R"), { seed: 11 });
    const dead: Record<string, true> = {};
    for (const e of res.events) {
      if (e.t === "revive") delete dead[e.dst];
      if ((e.t === "basic" || e.t === "skill" || e.t === "miss") && dead[e.dst]) throw new Error(`hit dead ${e.dst}`);
      if (e.t === "death") dead[e.dst] = true;
    }
  });
});

describe("A77 combat materialization", () => {
  it("applies final formation synergy after variant stats", () => {
    const unit = NORMAL_UNITS.find((candidate) => candidate.role === "TANKER")!;
    const placement: Placement = {
      uid: "tank",
      baseId: unit.id,
      star: 1,
      row: 0,
      col: 4,
      traits: [{ id: "tanker_thick_armor", seed: 1 }],
    };
    const baseline = materializeCombat([{ ...placement, traits: [] }], [])[0]!;
    const variantOnly = materializeCombat([placement], [])[0]!;
    const withSynergy = materializeCombat([placement], [], { synergy: { L: { defPct: 100 } } })[0]!;

    expect(variantOnly.def).toBe(baseline.def + 6);
    expect(withSynergy.def).toBe(Math.round(variantOnly.def * 2));
  });

  it("halves Tutorial RIGHT HP only after AI and mode scaling", () => {
    const placement: Placement = { uid: "enemy", baseId: ids[0]!, star: 1, row: 0, col: 5 };
    const baseline = materializeCombat([], [placement])[0]!;
    const scaled = materializeCombat([], [placement], {
      rightAi: { hp: 0.65, atk: 0.6, matk: 0.6 },
      rightModeScale: 1.4,
      tutorialRightHpHalving: true,
    })[0]!;

    expect(scaled.maxHp).toBe(Math.max(1, Math.round(Math.max(1, Math.round(baseline.maxHp * 0.65)) * 1.4 / 2)));
    expect(scaled.atk).toBe(Math.max(1, Math.round(Math.max(1, Math.round(baseline.atk * 0.6)) * 1.4)));
  });

  it("applies persistent and queued opening shield exactly once", () => {
    const unit = NORMAL_UNITS.find((candidate) => candidate.role === "SUPPORT")!;
    const fighter = materializeCombat([{
      uid: "support",
      baseId: unit.id,
      star: 1,
      row: 0,
      col: 4,
      traits: [{ id: "support_divine_guard", seed: 1 }],
    }], [], {
      leftPersistent: { startShield: 5 },
      synergy: { L: { startShield: 7 } },
    })[0]!;

    expect(fighter.shield).toBe(28);
  });

  it("simulates the exact authoritative Fighter records without rematerializing", () => {
    const fighters = materializeCombat(
      [{ uid: "left", baseId: ids[0]!, star: 1, row: 0, col: 4 }],
      [{ uid: "right", baseId: ids[1]!, star: 1, row: 0, col: 5 }],
      { leftPersistent: { startShield: 1_000_000 }, synergy: { L: { atkPct: 10_000 } } },
    );
    const authoritativeLeft = fighters[0]!;
    const result = runCombat(fighters, { seed: 17 });

    expect(result.survivors.find((fighter) => fighter.uid === "left")).toStrictEqual(authoritativeLeft);
    expect(result.survivors.find((fighter) => fighter.uid === "left")).not.toBe(authoritativeLeft);
  });
});
