import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, type Fighter, type CombatEvent } from "../src/core/combat";
import { skillSpec } from "../src/core/skills";

function battle(star: number, seed = 17, withMage = false) {
  const right = [{ uid: "tank", baseId: "titan_earth", star: 1, row: 2, col: 5 }];
  if (withMage) right.push({ uid: "mage", baseId: "worm_ice", star: 1, row: 2, col: 7 });
  const fighters = materializeCombat(
    [{ uid: "bird", baseId: "woodpecker_drill", star, row: 2, col: 4 }],
    right,
  );
  for (const f of fighters) {
    f.maxHp = f.hp = 100000;
    f.atk = f.uid === "bird" ? f.atk : 1;
    f.crit = f.evade = 0;
    f.rage = f.uid === "bird" ? f.rageMax : 0;
    if (f.uid !== "bird") f.rageMax = 100000;
  }
  return simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
}
const firstCast = (events: CombatEvent[]) => {
  const start = events.findIndex(e => e.t === "cast" && e.src === "bird");
  const end = events.findIndex((e, i) => i > start && e.t === "cast" && e.src === "bird");
  return events.slice(start, end < 0 ? undefined : end);
};
const fighter = (all: Fighter[], uid: string) => all.find(f => f.uid === uid)!;

describe("issue #95 hard-beak dive", () => {
  it("preserves catalog tier, id and authored physical damage at every star", () => {
    expect(getUnit("woodpecker_drill").tier).toBe(3);
    expect(getUnit("woodpecker_drill").skill.family).toBe("hard_beak_dive");
    for (const star of [1, 2, 3]) {
      expect(skillSpec("woodpecker_drill", star)).toMatchObject({
        side: "enemy", area: "single", count: 1,
        damage: { base: 10, scale: 0.45, stat: "atk", type: "physical" },
        controls: [{ kind: "stun", turns: 1, chance: 1 }],
      });
    }
  });

  it.each([1, 2, 3])("%i★ has one damage impact then stun/vulnerability; shield only at 3★", star => {
    const events = firstCast(battle(star).events);
    const cast = events[0];
    expect(cast).toMatchObject({ t: "cast", src: "bird", targets: ["tank"] });
    const damage = events.filter(e => e.t === "skill" && e.src === "bird");
    expect(damage).toHaveLength(1);
    expect(events.findIndex(e => e.t === "skill" && e.src === "bird"))
      .toBeLessThan(events.findIndex(e => e.t === "status" && e.kind === "stun"));
    expect(events).toContainEqual(expect.objectContaining({
      t: "status", dst: "tank", kind: "hardBeakVulnerability",
    }));
    expect(events.filter(e => e.t === "shield" && e.src === "bird")).toHaveLength(star === 3 ? 1 : 0);
  });

  it("uses role priority before proximity and deterministic tie-breaking", () => {
    const a = battle(1, 17, true);
    expect(firstCast(a.events)[0]).toMatchObject({ targets: ["mage"] });
    expect(a.events).toEqual(battle(1, 17, true).events);
  });

  it("1★ vulnerability expires at round boundary; 2★ and 3★ persist and never stack", () => {
    const one = fighter(battle(1).fighters, "tank");
    expect(one.status.hardBeakVulnerability).toBeUndefined();
    for (const star of [2, 3]) {
      const result = battle(star);
      const vulnerable = fighter(result.fighters, "tank").status.hardBeakVulnerability;
      expect(vulnerable).toMatchObject({ value: 2 / 3, turns: 999999 });
      const statuses = result.events.filter(e => e.t === "status" && e.kind === "hardBeakVulnerability");
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses.every(e => e.t === "status" && e.turns === 999999)).toBe(true);
    }
  });

  it("incoming vulnerability multiplies physical, magic and DOT damage exactly once before shield", () => {
    function incoming(value: number, shield: number, source: "physical" | "magic" | "dot") {
      const all = materializeCombat(
        [{ uid: "left", baseId: source === "magic" ? "worm_ice" : "woodpecker_drill", star: 1, row: 2, col: 4 }],
        [{ uid: "right", baseId: "titan_earth", star: 1, row: 2, col: 5 }],
      );
      const target = fighter(all, "right");
      target.maxHp = target.hp = 100000;
      target.shield = shield;
      target.crit = target.evade = 0;
      if (value) target.status.hardBeakVulnerability = { turns: 999999, value };
      const attacker = fighter(all, "left");
      attacker.crit = attacker.evade = 0;
      attacker.rageMax = target.rageMax = 100000;
      attacker.rage = target.rage = 0;
      if (source === "dot") {
        target.status.poison = { turns: 1, value: 30 };
        attacker.atk = 0;
      }
      const events = simulate(all, { seed: 31, rageGain: { L: 0, R: 0 } }).events;
      return events.find(e => source === "dot" ? e.t === "dot" && e.dst === "right"
        : e.t === "basic" && e.src === "left") as Extract<CombatEvent, { t: "dot" | "basic" }>;
    }
    for (const source of ["physical", "magic", "dot"] as const) {
      const base = incoming(0, 0, source);
      const boosted = incoming(2 / 3, 0, source);
      expect(boosted.dmg).toBeGreaterThan(base.dmg);
      const guarded = incoming(2 / 3, 10000, source);
      expect(guarded.dmg).toBe(boosted.dmg);
      if ("absorbed" in guarded) expect(guarded.absorbed).toBe(guarded.dmg);
    }
  });

  it("3★ generated shield absorbs later strikes in combat", () => {
    const result = battle(3);
    const shield = result.events.find(e => e.t === "shield" && e.src === "bird");
    expect(shield).toMatchObject({ t: "shield", dst: "bird", amount: expect.any(Number) });
    const amount = shield && "amount" in shield ? shield.amount : 0;
    expect(amount).toBeGreaterThan(0);
    expect(result.events.some(e => e.t === "basic" && e.dst === "bird" && e.absorbed > 0)).toBe(true);
  });
});
