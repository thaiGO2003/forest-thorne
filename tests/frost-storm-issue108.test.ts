import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import {
  combatTargetPreview, materializeCombat, simulate, type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { FROST_STORM_FAMILY, skillSpec } from "../src/core/skills";

type Enemy = { uid: string; col: number; row: number; role?: Fighter["role"]; atk?: number; shield?: number; burn?: number };
const standardEnemies: Enemy[] = [
  { uid: "a", col: 5, row: 0 },
  { uid: "b", col: 5, row: 1 },
  { uid: "c", col: 5, row: 2 },
];

function fixture(star: number, enemies: Enemy[] = standardEnemies): Fighter[] {
  const left: Placement[] = [{ uid: "frost", baseId: "ice_mage", star, row: 0, col: 4 }];
  const right: Placement[] = enemies.map(({ uid, row, col }) => ({ uid, baseId: "titan_earth", star: 1, row, col }));
  const fighters = materializeCombat(left, right);
  for (const fighter of fighters) {
    fighter.maxHp = fighter.hp = 1_000_000;
    fighter.crit = fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.onHitBurn = fighter.onHitPoison = 0;
    fighter.rage = 0;
    fighter.rageMax = 1_000; // Prevent counter-casts and isolate a single burst.
    fighter.atk = fighter.matk = 1;
  }
  const frost = fighters[0]!;
  frost.rage = frost.rageMax;
  frost.matk = 78;
  frost.status.disarm = { turns: 100, value: 0 }; // Cast once, then no basic attacks during duration tests.
  for (const enemy of enemies) {
    const target = fighters.find((f) => f.uid === enemy.uid)!;
    if (enemy.role) target.role = enemy.role;
    if (enemy.atk !== undefined) target.atk = enemy.atk;
    if (enemy.shield !== undefined) target.shield = enemy.shield;
    if (enemy.burn !== undefined) target.status.burn = { turns: 3, value: enemy.burn };
  }
  return fighters;
}

function firstCycle(events: CombatEvent[]): CombatEvent[] {
  const end = events.findIndex((event) => event.t === "cycle" && event.cycle === 2);
  return events.slice(0, end < 0 ? undefined : end);
}

function seededRolls(seed: number, count: number): number[] {
  let a = seed | 0;
  return Array.from({ length: count }, () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

describe("issue #108 — Sương Điệp frost column", () => {
  it("preserves identity, tier, stats, rage and authored damage while specifying per-star control", () => {
    const unit = getUnit("ice_mage");
    expect(unit.tier).toBe(2);
    expect(unit.stats).toMatchObject({
      hp: 268, atk: 17, def: 10, matk: 78, mdef: 20, range: 4, rageMax: 5,
    });
    expect(unit.skill.family).toBe(FROST_STORM_FAMILY);
    expect(unit.skill.rageCost).toEqual([3, 4, 5]);
    expect(unit.skill.starDetailVi).toHaveLength(3);
    for (const [index, chance] of [0.5, 0.75, 1].entries()) {
      const sp = skillSpec("ice_mage", index + 1);
      expect(sp).toMatchObject({
        side: "enemy", area: "column", selector: "frost_role_column", count: 1,
        damage: { base: 22, scale: 0.8, stat: "matk", type: "magic" },
        controls: [{ kind: "freeze", turns: 1, chance }],
        debuffs: [], dots: [],
      });
    }
  });

  it.each([1, 2, 3])("uses exactly one seeded freeze roll per victim at %i★", (star) => {
    const chance = [0.5, 0.75, 1][star - 1]!;
    for (const seed of [1, 2, 3, 17, 27, 101, 1001]) {
      const result = simulate(fixture(star), { seed, deterministicTargeting: true });
      const first = firstCycle(result.events);
      const cast = first.find((event) => event.t === "cast" && event.src === "frost");
      expect(cast).toMatchObject({ t: "cast", targets: ["a", "b", "c"] });
      const frozen = first.filter((event) => event.t === "status" && event.kind === "freeze" && event.turns > 0)
        .map((event) => event.t === "status" ? event.dst : "");
      const expected = standardEnemies.filter((_, i) => seededRolls(seed, 3)[i]! < chance).map((enemy) => enemy.uid);
      expect(frozen).toEqual(expected);
      expect(new Set(frozen).size).toBe(frozen.length);
      for (const victim of standardEnemies) {
        expect(first.filter((event) => event.t === "skill" && event.src === "frost" && event.dst === victim.uid)).toHaveLength(1);
      }
    }
  });

  it("selects a role-priority column before higher total ATK and uses ATK only to break role ties", () => {
    const roleFirst: Enemy[] = [
      { uid: "archer", col: 5, row: 0, role: "ARCHER", atk: 800 },
      { uid: "tank", col: 5, row: 1, role: "TANKER", atk: 800 },
      { uid: "support", col: 6, row: 0, role: "SUPPORT", atk: 2 },
      { uid: "mage", col: 6, row: 1, role: "MAGE", atk: 1 },
    ];
    const atkTie: Enemy[] = [
      { uid: "mage-low", col: 5, row: 0, role: "MAGE", atk: 20 },
      { uid: "tank-low", col: 5, row: 1, role: "TANKER", atk: 3 },
      { uid: "mage-high", col: 6, row: 0, role: "MAGE", atk: 25 },
      { uid: "tank-high", col: 6, row: 1, role: "TANKER", atk: 4 },
    ];
    for (const [enemies, expected] of [
      [roleFirst, ["mage", "support"]],
      [atkTie, ["mage-high", "tank-high"]],
    ] as const) {
      const fighters = fixture(3, enemies);
      const preview = combatTargetPreview(fighters, "frost", { kitPreview: true });
      expect([...(preview?.directUids ?? []), ...(preview?.splashUids ?? [])]).toEqual(expected);
      const first = firstCycle(simulate(fighters, { seed: 3, deterministicTargeting: true }).events);
      expect(first.find((event) => event.t === "cast" && event.src === "frost")).toMatchObject({ targets: expected });
      expect(first.filter((event) => event.t === "skill" && event.src === "frost").map((event) =>
        event.t === "skill" ? event.dst : "")).toEqual(expected);
      expect(first.filter((event) => event.t === "status" && event.kind === "freeze" && event.turns > 0)
        .map((event) => event.t === "status" ? event.dst : "")).toEqual(expected);
    }
  });

  it("3★ freeze survives all twenty turn ticks when the victim takes no damage", () => {
    const result = simulate(fixture(3, [{ uid: "victim", col: 5, row: 0 }]), { seed: 42 });
    const victim = result.fighters.find((fighter) => fighter.uid === "victim")!;
    expect(victim.status.freeze).toMatchObject({
      turns: 1, permanent: true,
      source: { skillId: FROST_STORM_FAMILY, unitUid: "frost", unitStar: 3 },
    });
    expect(result.events.filter((event) => event.t === "skip" && event.src === "victim" && event.reason === "freeze")).toHaveLength(20);
    expect(result.events.filter((event) => event.t === "status" && event.dst === "victim" && event.kind === "freeze" && event.turns === 0)).toHaveLength(0);
  });

  it("3★ thaw occurs exactly on real damage, not on passing turns or fully absorbed damage", () => {
    const damage = simulate(fixture(3, [{ uid: "victim", col: 5, row: 0, burn: 5 }]), { seed: 42 });
    const first = damage.events.findIndex((event) => event.t === "status" && event.kind === "freeze" && event.turns > 0);
    const thaw = damage.events.findIndex((event) => event.t === "status" && event.kind === "freeze" && event.turns === 0);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(thaw).toBeGreaterThan(first);
    expect(damage.events[thaw - 1]).toMatchObject({ t: "dot", dst: "victim", kind: "burn" });
    expect(damage.events.slice(first, thaw).some((event) => event.t === "cycle" && event.cycle === 2)).toBe(true);
    expect(damage.fighters.find((fighter) => fighter.uid === "victim")!.status.freeze).toBeUndefined();

    const shield = simulate(fixture(3, [{ uid: "victim", col: 5, row: 0, burn: 5, shield: 100_000 }]), { seed: 42 });
    expect(shield.fighters.find((fighter) => fighter.uid === "victim")!.status.freeze?.permanent).toBe(true);
    expect(shield.events.some((event) => event.t === "status" && event.dst === "victim" && event.kind === "freeze" && event.turns === 0)).toBe(false);
  });

  it.each([1, 2])("%i★ freeze remains one turn rather than permanent", (star) => {
    // Choose a seed that freezes at least one target under each chance threshold.
    const seed = 7;
    const result = simulate(fixture(star, [{ uid: "victim", col: 5, row: 0 }]), { seed });
    expect(result.events.some((event) => event.t === "status" && event.kind === "freeze" && event.turns === 1)).toBe(true);
    expect(result.events.filter((event) => event.t === "skip" && event.src === "victim" && event.reason === "freeze")).toHaveLength(1);
    expect(result.fighters.find((fighter) => fighter.uid === "victim")!.status.freeze).toBeUndefined();
  });
});
