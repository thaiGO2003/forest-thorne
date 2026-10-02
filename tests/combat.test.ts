import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { goldMultiplier, makeFighter, simulate, tierStunChance, turnOrder, type Placement } from "../src/core/combat";

const team = (ids: string[], side: "L" | "R"): Placement[] =>
  ids.map((baseId, i) => ({ uid: `${side}${i}`, baseId, star: 1, row: i % 5, col: side === "L" ? 4 - Math.floor(i / 5) : 5 + Math.floor(i / 5) }));
const ids = NORMAL_UNITS.map((u) => u.id);

describe("combat", () => {
  it("gold multiplier follows A13 (no floor, cap 2.0 at 210)", () => {
    expect([goldMultiplier(-5), goldMultiplier(10), goldMultiplier(11), goldMultiplier(12), goldMultiplier(210), goldMultiplier(999)])
      .toEqual([1, 1, 1.005, 1.01, 2, 2]);
  });

  it("tier stun hook is 20% at tier 4 and 30% at tier 5+", () => {
    expect([1, 3, 4, 5, 9].map(tierStunChance)).toEqual([0, 0, 0.2, 0.3, 0.3]);
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

  it("dead units leave target selection: no event targets a unit after its death", () => {
    const res = simulate(team(ids.slice(10, 15), "L"), team(ids.slice(20, 25), "R"), { seed: 11 });
    const dead: Record<string, true> = {};
    for (const e of res.events) {
      if (e.t === "revive") delete dead[e.dst];
      if ((e.t === "basic" || e.t === "skill" || e.t === "miss") && dead[e.dst]) throw new Error(`hit dead ${e.dst}`);
      if (e.t === "death") dead[e.dst] = true;
    }
  });

  it("resolves authored physical reflect after the skill cast event", () => {
    const res = simulate(
      [{ uid: "badger", baseId: "badger_stone", star: 1, row: 0, col: 4 }],
      [{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 5 }],
      { seed: 1, bonus: { L: { startRage: 4 } } },
    );
    const cast = res.events.findIndex((e) => e.t === "cast" && e.src === "badger");
    const reflect = res.events.findIndex((e) => e.t === "reflect" && e.src === "badger" && e.dst === "rhino");
    expect(cast).toBeGreaterThanOrEqual(0);
    expect(reflect).toBeGreaterThan(cast);
  });

  it("counter stance returns a forced basic against a close-range attacker", () => {
    const res = simulate(
      [{ uid: "rhino", baseId: "rhino_quake", star: 1, row: 0, col: 4 }],
      [{ uid: "ram", baseId: "ram_charge", star: 1, row: 0, col: 5 }],
      { seed: 2, bonus: { L: { startRage: 4 } } },
    );
    const incoming = res.events.findIndex((e) => e.t === "basic" && e.src === "ram" && e.dst === "rhino");
    const counter = res.events.findIndex((e, i) => i > incoming && e.t === "basic" && e.src === "rhino" && e.dst === "ram");
    expect(incoming).toBeGreaterThanOrEqual(0);
    expect(counter).toBeGreaterThan(incoming);
  });

  it("Phoenix self-rebirth revives from lethal damage only once", () => {
    const res = simulate(
      [{ uid: "phoenix", baseId: "phoenix_rebirth", star: 1, row: 0, col: 4 }],
      [{ uid: "trex", baseId: "trex_bite", star: 3, row: 0, col: 5 }],
      { seed: 3, bonus: { L: { startRage: 4 } } },
    );
    const revives = res.events.filter((e) => e.t === "revive" && e.dst === "phoenix");
    expect(revives).toHaveLength(1);
    expect(res.events.filter((e) => e.t === "death" && e.dst === "phoenix")).toHaveLength(1);
  });

  it("disease spreads to an orthogonal same-side neighbor", () => {
    const res = simulate(
      [{ uid: "cobra", baseId: "cobra_venom", star: 1, row: 0, col: 4 }],
      [
        { uid: "target", baseId: "turtle_mire", star: 1, row: 0, col: 6 },
        { uid: "neighbor", baseId: "pangolin_plate", star: 1, row: 1, col: 6 },
      ],
      { seed: 4, bonus: { L: { startRage: 4 } } },
    );
    expect(res.events.some((e) => e.t === "dot" && e.dst === "target" && e.kind === "disease")).toBe(true);
    expect(res.events.some((e) => e.t === "status" && e.dst === "neighbor" && e.kind === "disease" && e.turns === 2)).toBe(true);
  });

  it("double-hit resolves two skill hits inside one cast", () => {
    const res = simulate(
      [{ uid: "kangaroo", baseId: "kangaroo_kick", star: 1, row: 2, col: 4 }],
      [{ uid: "target", baseId: "titan_earth", star: 3, row: 2, col: 5 }],
      { seed: 6, bonus: { L: { startRage: 4 } } },
    );
    const cast = res.events.findIndex((e) => e.t === "cast" && e.src === "kangaroo");
    const nextCast = res.events.findIndex((e, i) => i > cast && e.t === "cast" && e.src === "kangaroo");
    const end = nextCast >= 0 ? nextCast : res.events.length;
    const hits = res.events.slice(cast + 1, end).filter((e) => e.t === "skill" && e.src === "kangaroo");
    expect(hits).toHaveLength(2);
    expect(hits.every((e) => e.t === "skill" && e.dst === "target")).toBe(true);
  });

  it("chain shock uses distinct bounce targets then returns to the first target at 3-star", () => {
    const res = simulate(
      [{ uid: "jelly", baseId: "jellyfish_shock", star: 3, row: 2, col: 4 }],
      [
        { uid: "r0", baseId: "titan_earth", star: 3, row: 0, col: 5 },
        { uid: "r1", baseId: "pangolin_plate", star: 3, row: 2, col: 5 },
        { uid: "r2", baseId: "turtle_mire", star: 3, row: 4, col: 5 },
      ],
      { seed: 7, bonus: { L: { startRage: 5 }, R: { startRage: 3 } } },
    );
    const cast = res.events.findIndex((e) => e.t === "cast" && e.src === "jelly");
    const nextCast = res.events.findIndex((e, i) => i > cast && e.t === "cast" && e.src === "jelly");
    const end = nextCast >= 0 ? nextCast : res.events.length;
    const hits = res.events.slice(cast + 1, end).filter((e) => e.t === "skill" && e.src === "jelly");
    expect(hits).toHaveLength(4);
    expect(new Set(hits.slice(0, 3).map((e) => e.t === "skill" ? e.dst : "")).size).toBe(3);
    expect(hits[3]).toMatchObject({ t: "skill", dst: (hits[0] as { dst: string }).dst });
  });

  it("cross-5 damages orthogonal cells but excludes a diagonal cell", () => {
    const res = simulate(
      [{ uid: "roc", baseId: "roc_legend", star: 1, row: 2, col: 4 }],
      [
        { uid: "center", baseId: "titan_earth", star: 3, row: 2, col: 5 },
        { uid: "up", baseId: "pangolin_plate", star: 3, row: 1, col: 5 },
        { uid: "right", baseId: "turtle_mire", star: 3, row: 2, col: 6 },
        { uid: "diag", baseId: "crab_shell", star: 3, row: 1, col: 6 },
      ],
      { seed: 8, bonus: { L: { startRage: 3 } } },
    );
    const cast = res.events.findIndex((e) => e.t === "cast" && e.src === "roc");
    const nextCast = res.events.findIndex((e, i) => i > cast && e.t === "cast" && e.src === "roc");
    const end = nextCast >= 0 ? nextCast : res.events.length;
    const hitIds = res.events.slice(cast + 1, end).flatMap((e) => e.t === "skill" && e.src === "roc" ? [e.dst] : []);
    expect(hitIds).toContain("center");
    expect(hitIds).toContain("up");
    expect(hitIds).toContain("right");
    expect(hitIds).not.toContain("diag");
  });

  it("global stun damages all enemies but caps the stun rider subset", () => {
    const right: Placement[] = ["titan_earth", "pangolin_plate", "turtle_mire", "crab_shell", "badger_stone"]
      .map((baseId, i) => ({ uid: `g${i}`, baseId, star: 3, row: i, col: 5 }));
    const res = simulate(
      [{ uid: "kirin", baseId: "kirin_thunder", star: 3, row: 2, col: 4 }],
      right,
      { seed: 9, bonus: { L: { startRage: 5 }, R: { startRage: 3 } } },
    );
    const cast = res.events.findIndex((e) => e.t === "cast" && e.src === "kirin");
    const nextCast = res.events.findIndex((e, i) => i > cast && e.t === "cast" && e.src === "kirin");
    const end = nextCast >= 0 ? nextCast : res.events.length;
    const during = res.events.slice(cast + 1, end);
    expect(new Set(during.flatMap((e) => e.t === "skill" && e.src === "kirin" ? [e.dst] : []))).toHaveLength(5);
    expect(during.filter((e) => e.t === "status" && e.kind === "stun")).toHaveLength(3);
  });
});
