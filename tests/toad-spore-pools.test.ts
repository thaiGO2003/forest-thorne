import { describe, expect, it } from "vitest";
import {
  COLS, ROWS, SPORE_BURST_POINTS, SPORE_CYCLES, SPORE_THROWS, combatTargetPreview, enemyHalfCells, materializeCombat, simulate,
  type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { getUnit } from "../src/content/catalog";
import { SPORE_FAMILY, skillSpec } from "../src/core/skills";

const TOAD = "toad_poison";
const key = (row: number, col: number) => `${row}:${col}`;

/** Toad on the left vs `enemies` on the right; everyone is made very durable so cycles keep running. */
function arena(star: 1 | 2 | 3, enemies: Array<[number, number]>, toadHp = 5e5): Fighter[] {
  const left: Placement[] = [{ uid: "toad", baseId: TOAD, star, row: 2, col: 1 }];
  const right: Placement[] = enemies.map(([row, col], i) => ({ uid: `e${i}`, baseId: "titan_earth", star: 1, row, col }));
  const all = materializeCombat(left, right);
  for (const f of all) { f.maxHp = 1e6; f.hp = f.uid === "toad" ? toadHp : 1e6; }
  const toad = all.find((f) => f.uid === "toad")!;
  toad.rage = toad.rageMax;
  return all;
}
const fullHalf = (): Array<[number, number]> => enemyHalfCells("L").map(({ row, col }) => [row, col]);

/** Replays pool lifecycle events and asserts the owner never has two active pools on one cell. */
function activePoolsOver(events: readonly CombatEvent[]) {
  const active = new Set<string>();
  const snapshots: Set<string>[] = [];
  for (const e of events) {
    if (e.t === "sporeThrow") for (const c of e.cells) {
      expect(active.has(key(c.row, c.col)), `duplicate pool at ${key(c.row, c.col)}`).toBe(false);
      active.add(key(c.row, c.col));
    }
    if (e.t === "sporeExpire" || e.t === "sporeBurst") for (const c of e.cells) active.delete(key(c.row, c.col));
    snapshots.push(new Set(active));
  }
  return snapshots;
}

describe("Cóc Độc — Sương Độc spore pools", () => {
  it("authors the new skill while keeping tier 1 MAGE and rage 3/4/5", () => {
    const u = getUnit(TOAD);
    expect([u.tier, u.role, u.skill.family, u.skill.nameVi, u.skill.rageCost]).toEqual([1, "MAGE", SPORE_FAMILY, "Sương Độc", [3, 4, 5]]);
    for (const star of [1, 2, 3]) {
      const sp = skillSpec(TOAD, star);
      expect([sp.damage, sp.dots, sp.controls, sp.heal, sp.lifestealPct]).toEqual([null, [], [], null, 0]);
    }
  });

  it("throws 3 distinct pools on the enemy half, empty cells allowed, and never stacks an active cell", () => {
    const half = new Set(enemyHalfCells("L").map((c) => key(c.row, c.col)));
    expect(half.size).toBe((COLS / 2) * ROWS);
    const result = simulate(arena(1, [[2, 5]]), { seed: 3 });
    const throws = result.events.filter((e): e is Extract<CombatEvent, { t: "sporeThrow" }> => e.t === "sporeThrow");
    expect(throws.length).toBeGreaterThan(1);
    for (const t of throws) {
      expect(t.cycles).toBe(SPORE_CYCLES);
      expect(t.cells).toHaveLength(SPORE_THROWS);
      expect(new Set(t.cells.map((c) => key(c.row, c.col))).size).toBe(SPORE_THROWS);
      for (const c of t.cells) expect(half.has(key(c.row, c.col))).toBe(true);
    }
    expect(throws.some((t) => t.cells.some((c) => key(c.row, c.col) !== key(2, 5)))).toBe(true); // empty cells are valid
    activePoolsOver(result.events);
  });

  it("is deterministic for the same seed", () => {
    const a = simulate(arena(3, fullHalf()), { seed: 11 }).events;
    const b = simulate(arena(3, fullHalf()), { seed: 11 }).events;
    expect(a).toEqual(b);
  });

  it("scores points at cycle start from enemies standing on live pools, for 2 cycles per pool", () => {
    const all = arena(1, fullHalf());
    const result = simulate(all, { seed: 5 });
    const pos = new Map(all.map((f) => [f.uid, key(f.row, f.col)]));
    let sinceCycle = true, cycle = 0;
    const thrownAt = new Map<string, number>();
    for (const e of result.events) {
      if (e.t === "cycle") { cycle = e.cycle; sinceCycle = true; continue; }
      if (e.t === "sporeThrow") for (const c of e.cells) thrownAt.set(key(c.row, c.col), cycle);
      if (e.t === "sporePoint") {
        expect(sinceCycle, "points are only scored at the cycle-start boundary").toBe(true);
        expect(pos.get(e.dst)).toBe(key(e.row, e.col));
        const born = thrownAt.get(key(e.row, e.col))!;
        expect(cycle - born).toBeGreaterThanOrEqual(1);
        expect(cycle - born).toBeLessThanOrEqual(SPORE_CYCLES);
      } else if (e.t !== "dot" && e.t !== "sporeExpire") sinceCycle = false;
    }
    expect(result.events.some((e) => e.t === "sporePoint")).toBe(true);
  });

  it("detonates at cycle end with ≥5 points, heals 50% of real HP damage, then resets and clears the cells", () => {
    const result = simulate(arena(3, fullHalf()), { seed: 7 });
    const ev = result.events;
    const burstAt = ev.findIndex((e) => e.t === "sporeBurst");
    expect(burstAt).toBeGreaterThan(0);
    const burst = ev[burstAt] as Extract<CombatEvent, { t: "sporeBurst" }>;
    expect(burst.points).toBeGreaterThanOrEqual(SPORE_BURST_POINTS);

    // Points since the previous burst/start name the victims; each victim takes one aggregated hit.
    const earned = ev.slice(0, burstAt).filter((e): e is Extract<CombatEvent, { t: "sporePoint" }> => e.t === "sporePoint");
    expect(earned.at(-1)!.points).toBe(burst.points);
    const victims = new Set(earned.map((e) => e.dst));
    let i = burstAt + 1, hpDealt = 0;
    const hit = new Set<string>();
    for (; ev[i]?.t === "skill"; i++) {
      const e = ev[i] as Extract<CombatEvent, { t: "basic" | "skill" }>;
      expect(e.src).toBe("toad");
      expect(victims.has(e.dst)).toBe(true);
      hit.add(e.dst);
      hpDealt += e.dmg - e.absorbed;
    }
    expect(hit).toEqual(victims);
    const heal = ev[i] as Extract<CombatEvent, { t: "heal" }>;
    expect(heal).toMatchObject({ t: "heal", src: "toad", dst: "toad" });
    expect(heal.amount).toBe(Math.round(hpDealt * 0.5));

    // The burst resolves after the cycle's actions, before the next cycle starts: nothing but reaction
    // cascades (TANKER auto-casts triggered by the hits, A74) may sit between it and the next cycle.
    const nextCycle = ev.findIndex((e, j) => j > i && e.t === "cycle");
    const between = ev.slice(i + 1, nextCycle < 0 ? undefined : nextCycle);
    expect(between.some((e) => e.t === "empty" || e.t === "basic" || e.t === "sporePoint")).toBe(false);
    for (const e of between) if (e.t === "cast") expect(e.trigger).toBe("TANKER");

    // Counter restarts; detonated cells give nothing until a later throw lands on them again.
    const after = ev.slice(burstAt + 1);
    const firstPoint = after.find((e): e is Extract<CombatEvent, { t: "sporePoint" }> => e.t === "sporePoint");
    if (firstPoint) expect(firstPoint.points).toBe(1);
    const cleared = new Set(burst.cells.map((c) => key(c.row, c.col)));
    const relanded = new Set<string>();
    for (const e of after) {
      if (e.t === "sporeThrow") for (const c of e.cells) relanded.add(key(c.row, c.col));
      if (e.t === "sporePoint" && cleared.has(key(e.row, e.col))) expect(relanded.has(key(e.row, e.col))).toBe(true);
    }
  });

  it("caps active pools at the number of enemy-half cells", () => {
    const result = simulate(arena(1, [[0, 9]]), { seed: 2 });
    const half = enemyHalfCells("L").length;
    for (const active of activePoolsOver(result.events)) expect(active.size).toBeLessThanOrEqual(half);
  });

  it("biases each throw toward occupied cells by star (≈4% / ≈23% / ≈42%)", () => {
    const rate = (star: 1 | 2 | 3) => {
      let chances = 0, landed = 0;
      for (let seed = 1; seed <= 160; seed++) {
        const result = simulate(arena(star, [[2, 7]]), { seed });
        const active = new Set<string>();
        for (const e of result.events) {
          if (e.t === "sporeExpire" || e.t === "sporeBurst") for (const c of e.cells) active.delete(key(c.row, c.col));
          if (e.t !== "sporeThrow") continue;
          for (const c of e.cells) {
            // Only throws that could still reach the occupied cell count as a chance.
            if (!active.has(key(2, 7))) { chances++; if (c.row === 2 && c.col === 7) landed++; }
            active.add(key(c.row, c.col));
          }
        }
      }
      return landed / chances;
    };
    const [one, two, three] = [rate(1), rate(2), rate(3)];
    expect(one).toBeGreaterThan(0.01);
    expect(one).toBeLessThan(0.09);
    expect(two).toBeGreaterThan(0.17);
    expect(two).toBeLessThan(0.3);
    expect(three).toBeGreaterThan(0.35);
    expect(three).toBeLessThan(0.5);
  });

  it("previews the whole enemy half, including empty cells, and every enemy on it", () => {
    const fighters = materializeCombat(
      [{ uid: "toad", baseId: TOAD, star: 1, row: 2, col: 1 }],
      [{ uid: "a", baseId: "titan_earth", star: 1, row: 0, col: 5 }, { uid: "b", baseId: "titan_earth", star: 1, row: 4, col: 9 }],
    );
    const kit = combatTargetPreview(fighters, "toad", { kitPreview: true })!;
    expect(kit.skillCasterUid).toBe("toad");
    expect(new Set(kit.areaCells!.map((c) => key(c.row, c.col)))).toEqual(new Set(enemyHalfCells("L").map((c) => key(c.row, c.col))));
    expect(new Set(kit.tags!.filter((t) => t.kind === "skill").map((t) => t.uid))).toEqual(new Set(["a", "b"]));
    expect(kit.tags!.some((t) => t.kind === "basic" && t.primary)).toBe(true);
    expect(combatTargetPreview(fighters, "toad", { kitPreview: true })).toEqual(kit);
    // Rage not full: only the basic is projected.
    expect(combatTargetPreview(fighters, "toad")?.areaCells).toBeUndefined();
  });
});
