import { describe, expect, it } from "vitest";
import { getUnit, NORMAL_UNITS } from "../src/content/catalog";
import { BLOOD_SWORD_OATH_FAMILY, skillSpec } from "../src/core/skills";
import {
  combatStat, materializeCombat, simulate, type CombatEvent, type CombatResult, type Fighter,
} from "../src/core/combat";

type Star = 1 | 2 | 3;
type Hit = Extract<CombatEvent, { t: "basic" | "skill" }>;
type Oath = Extract<CombatEvent, { t: "oath" }>;
type Heal = Extract<CombatEvent, { t: "heal" }>;

/** Huge HP pools allow full cycle-boundary inspection without premature victory. */
function duel(star: Star, setup: (rabbit: Fighter, foe: Fighter) => void = () => {}, seed = 4) {
  const all = materializeCombat(
    [{ uid: "rabbit", baseId: "rabbit_blood", star, row: 2, col: 4 }],
    [{ uid: "foe", baseId: "ant_guard", star: 1, row: 2, col: 5 }],
  );
  for (const f of all) { f.maxHp = 1e6; f.hp = 1e6; }
  const rabbit = all.find((f) => f.uid === "rabbit")!;
  const foe = all.find((f) => f.uid === "foe")!;
  rabbit.hp = 1e5;
  rabbit.rage = rabbit.rageMax;
  setup(rabbit, foe);
  return { rabbit, foe, result: simulate(all, { seed, captureInspection: true }) };
}

function preCursed(rabbit: Fighter) {
  rabbit.status.poison = { turns: 4, value: 5 };
  rabbit.status.burn = { turns: 4, value: 5 };
  rabbit.mods.push({ stat: "def", value: -10, pct: false, turns: 6 });
}

function eventsInCycle(events: CombatEvent[], cycle: number): CombatEvent[] {
  const start = events.findIndex((e) => e.t === "cycle" && e.cycle === cycle);
  const end = events.findIndex((e, i) => i > start && e.t === "cycle");
  return start < 0 ? [] : events.slice(start, end < 0 ? events.length : end);
}

function firstOath(result: CombatResult) {
  const events = result.events;
  const start = events.findIndex((e) => e.t === "oath" && e.active);
  const end = events.findIndex((e, i) => i > start && e.t === "oath" && !e.active);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return { start, end, event: events[start] as Oath };
}

describe("Huyết Thố Giơ Kiếm Lên Trời catalog", () => {
  it("preserves the tier-2 fighter stats and authored physical burst", () => {
    const u = getUnit("rabbit_blood");
    expect([u.nameVi, u.tier, u.role, u.faction, u.element, u.boss]).toEqual(["Huyết Thố", 2, "FIGHTER", "BEAST", "NIGHT", false]);
    expect([u.stats.hp, u.stats.atk, u.stats.def, u.stats.mdef, u.stats.range]).toEqual([320, 72, 18, 15, 1]);
    expect([u.basic.delivery, u.basic.damageType]).toEqual(["melee", "physical"]);
    expect([u.skill.nameVi, u.skill.family, u.skill.rageCost]).toEqual(["Giơ Kiếm Lên Trời", BLOOD_SWORD_OATH_FAMILY, [2, 3, 4]]);
    expect(NORMAL_UNITS.some((unit) => unit.id === u.id)).toBe(true);
    for (const star of [1, 2, 3] as const) {
      const sp = skillSpec(u.id, star);
      expect(sp.damage).toEqual({ base: 20, scale: 1, stat: "atk", type: "physical" });
      expect([sp.side, sp.area, sp.count, sp.selector]).toEqual(["enemy", "single", 1, "frontline_default"]);
      expect([sp.dots, sp.controls, sp.buffs, sp.debuffs, sp.heal, sp.hot, sp.lifestealPct])
        .toEqual([[], [], [], [], null, null, 0]);
    }
    expect(u.skill.starDetailVi).toHaveLength(3);
  });
});

describe("Huyết Thố action and next-round oath", () => {
  it("uses the basic target, with one crit-eligible physical impact and an action-scoped shield cue", () => {
    const { result } = duel(1);
    const ev = result.events;
    const cast = ev.findIndex((e) => e.t === "cast" && e.src === "rabbit");
    const { start, end } = firstOath(result);
    expect(ev[cast]).toMatchObject({ t: "cast", src: "rabbit", targets: ["foe"] });
    expect(cast).toBeLessThan(start);
    expect(ev.slice(start + 1, end).filter((e) => e.t === "skill" && e.src === "rabbit"))
      .toEqual([expect.objectContaining({ t: "skill", dst: "foe", absorbed: 0, crit: expect.any(Boolean) })]);
    expect(ev.slice(start, end + 1).filter((e) => e.t === "heal" && e.src === "rabbit")).toEqual([]);
    expect(ev[end]).toMatchObject({ t: "oath", dst: "rabbit", active: false });
  });

  it("suppresses exactly one uniformly chosen debuff at 1★, preserving every duration", () => {
    const frequency: Record<string, number> = { burn: 0, poison: 0, defDown: 0 };
    for (let seed = 0; seed < 120; seed++) {
      const { result } = duel(1, preCursed, seed);
      const { end, event } = firstOath(result);
      expect(event.suppressed).toHaveLength(1);
      const key = event.suppressed[0]!;
      expect(Object.hasOwn(frequency, key)).toBe(true);
      frequency[key]!++;
      const frame = result.inspectionFrames!.find((f) => f.eventIndex >= end + 1)!;
      const rabbit = frame.units.find((u) => u.uid === "rabbit")!;
      expect([rabbit.status.poison?.turns, rabbit.status.burn?.turns]).toEqual([3, 3]);
      expect(rabbit.mods.find((m) => m.stat === "def" && m.value === -10)?.turns).toBe(5);
    }
    for (const count of Object.values(frequency)) {
      expect(count).toBeGreaterThan(15);
      expect(count).toBeLessThan(65);
    }
  });

  it.each([2, 3] as const)("%i★ disables every active debuff only within the action, without clearing it", (star) => {
    const { result } = duel(star, preCursed);
    const { start, end, event } = firstOath(result);
    expect(event.suppressed.sort()).toEqual(["burn", "defDown", "poison"]);
    expect(result.events[end]).toEqual({ t: "oath", dst: "rabbit", suppressed: event.suppressed, active: false });
    const frame = result.inspectionFrames!.find((f) => f.eventIndex >= end + 1)!;
    const rabbit = frame.units.find((u) => u.uid === "rabbit")!;
    expect([rabbit.status.poison?.turns, rabbit.status.burn?.turns]).toEqual([3, 3]);
    expect(rabbit.mods.find((m) => m.stat === "def" && m.value === -10)?.turns).toBe(5);
    expect(result.events.slice(start, end).filter((e) => e.t === "status" && e.turns === 0)).toEqual([]);
  });

  it.each([[1, 0.5], [2, 1], [3, 2]] as const)(
    "%i★ heals %i× actual next-round HP damage, never during cast or after the round", (star, ratio) => {
      const { result } = duel(star);
      const cycle1 = eventsInCycle(result.events, 1);
      const cycle2 = eventsInCycle(result.events, 2);
      const cycle3 = eventsInCycle(result.events, 3);
      expect(cycle1.filter((e) => e.t === "heal" && e.src === "rabbit")).toEqual([]);
      const index = cycle2.findIndex((e) => (e.t === "basic" || e.t === "skill") && e.src === "rabbit");
      expect(index).toBeGreaterThan(-1);
      const hit = cycle2[index] as Hit;
      const heals = cycle2.slice(index + 1).filter((e): e is Heal => e.t === "heal" && e.src === "rabbit");
      expect(heals[0]?.amount).toBe(Math.round((hit.dmg - hit.absorbed) * ratio));
      expect(cycle3.filter((e) => e.t === "heal" && e.src === "rabbit")).toEqual([]);
    },
  );

  it("applies the shared healing modifiers and max-HP cap", () => {
    const { result } = duel(2, (rabbit, foe) => {
      rabbit.healPct = 0.25;
      rabbit.env.healRecvPct = 0.2;
      foe.shield = 100000;
    });
    const cycle2 = eventsInCycle(result.events, 2);
    const hit = cycle2.find((e): e is Hit => e.t === "basic" && e.src === "rabbit");
    expect(hit).toBeDefined();
    expect(hit!.absorbed).toBeGreaterThan(0);
    expect(cycle2.some((e) => e.t === "heal" && e.src === "rabbit")).toBe(false);
    const capped = duel(3, (rabbit) => { rabbit.hp = rabbit.maxHp - 1; rabbit.healPct = 0.5; });
    expect(capped.result.fighters.find((f) => f.uid === "rabbit")!.hp).toBeLessThanOrEqual(1e6);
  });

  it("3★ immediately heals current physical ATK at the following cycle start, then cleanses one surviving debuff at cycle end", () => {
    const { result } = duel(3, preCursed);
    const c2 = eventsInCycle(result.events, 2);
    expect(c2[0]).toEqual({ t: "cycle", cycle: 2 });
    const firstHeal = c2.find((e): e is Heal => e.t === "heal" && e.src === "rabbit");
    const startIndex = result.events.findIndex((e) => e.t === "cycle" && e.cycle === 2);
    const before = result.inspectionFrames!.filter((f) => f.eventIndex <= startIndex).at(-1)!;
    const atk = before.units.find((u) => u.uid === "rabbit")!.atk;
    expect(firstHeal?.amount).toBe(atk);
    expect(c2[1]).toEqual(firstHeal);
    const expired = c2.filter((e): e is Extract<CombatEvent, { t: "status" }> => e.t === "status" && e.dst === "rabbit" && e.turns === 0);
    expect(expired).toHaveLength(1);
    expect(["poison", "burn", "defDown"]).toContain(expired[0]!.kind);
    const cleanupIndex = c2.indexOf(expired[0]!);
    expect(c2.slice(cleanupIndex + 1).some((e) => e.t === "basic" || e.t === "skill")).toBe(false);
  });

  it("3★ cleanses each remaining debuff with uniform gameplay RNG", () => {
    const counts: Record<string, number> = { poison: 0, burn: 0, defDown: 0 };
    for (let seed = 0; seed < 120; seed++) {
      const { result } = duel(3, preCursed, seed);
      const cleansed = eventsInCycle(result.events, 2).filter(
        (event): event is Extract<CombatEvent, { t: "status" }> =>
          event.t === "status" && event.dst === "rabbit" && event.turns === 0,
      );
      expect(cleansed).toHaveLength(1);
      const key = cleansed[0]!.kind;
      expect(Object.hasOwn(counts, key)).toBe(true);
      counts[key]!++;
    }
    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThan(15);
      expect(count).toBeLessThan(65);
    }
  });

  it("refreshes the pending oath instead of accumulating independent heals and remains deterministic", () => {
    const one = duel(2, preCursed).result;
    const two = duel(2, preCursed).result;
    expect(one.events).toEqual(two.events);
    expect(one.events.filter((e) => e.t === "skill" && e.src === "rabbit" && e.kind === "batling")).toEqual([]);
    for (const [index, event] of one.events.entries()) {
      if (event.t !== "skill" || event.src !== "rabbit") continue;
      expect(one.events.slice(0, index + 1).filter((e) => e.t === "cast" && e.src === "rabbit").length).toBeGreaterThan(0);
    }
  });
});
