import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { goldMultiplier, makeFighter, simulate, turnOrder, type Placement } from "../src/core/combat";

const team = (ids: string[], side: "L" | "R"): Placement[] =>
  ids.map((baseId, i) => ({ uid: `${side}${i}`, baseId, star: 1, row: i % 5, col: side === "L" ? 4 - Math.floor(i / 5) : 5 + Math.floor(i / 5) }));
const ids = NORMAL_UNITS.map((u) => u.id);

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

  it("keeps participant identity and exact HP damage in the canonical event log", () => {
    const left = team([ids[0]!], "L");
    const right = team([ids[1]!], "R");
    const result = simulate(left, right, { seed: 17 });
    expect(result.participants).toEqual([
      { uid: "L0", baseId: ids[0], star: 1, side: "L" },
      { uid: "R0", baseId: ids[1], star: 1, side: "R" },
    ]);
    const hit = result.events.find((event) => event.t === "basic" || event.t === "skill");
    expect(hit).toBeDefined();
    if (!hit || (hit.t !== "basic" && hit.t !== "skill")) return;
    expect(hit.hpDamage).toBeGreaterThanOrEqual(0);
    expect(hit.hpDamage).toBeLessThanOrEqual(hit.dmg - hit.absorbed);
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
});
