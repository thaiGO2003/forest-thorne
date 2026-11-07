import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { combatTargetPreview, materializeCombat, simulate, type CombatEvent, type Fighter, type Placement } from "../src/core/combat";
import { KIRIN_HORNS_FAMILY, skillSpec } from "../src/core/skills";

type Hit = Extract<CombatEvent, { t: "basic" | "skill" }>;
const enemies: Placement[] = [
  { uid: "mage", baseId: "titan_earth", star: 1, row: 1, col: 6 },
  { uid: "northwest", baseId: "titan_earth", star: 1, row: 0, col: 5 },
  { uid: "south", baseId: "titan_earth", star: 1, row: 2, col: 6 },
  { uid: "east", baseId: "titan_earth", star: 1, row: 1, col: 7 },
  { uid: "far", baseId: "titan_earth", star: 1, row: 4, col: 9 },
];
const enemyRoles = { mage: "MAGE", northwest: "ARCHER", south: "FIGHTER", east: "SUPPORT", far: "TANKER" } as const;

function runHorns(
  star: number,
  seed = 7,
  placements: Placement[] = enemies,
  configure: (fighters: Fighter[]) => void = () => {},
) {
  const fighters = materializeCombat(
    [{ uid: "kirin", baseId: "kirin_thunder", star, row: 0, col: 4 }],
    placements,
  );
  const caster = fighters[0]!;
  caster.rage = caster.rageMax;
  caster.crit = 0;
  caster.element = "SPIRIT";
  for (const foe of fighters.slice(1)) {
    foe.role = enemyRoles[foe.uid as keyof typeof enemyRoles] ?? "FIGHTER";
    foe.hp = foe.maxHp = 100_000;
    foe.atk = foe.matk = 1;
    foe.crit = 0;
    foe.def = foe.mdef = 0;
    foe.element = "SPIRIT";
    foe.rageMax = 100_000;
  }
  configure(fighters);
  const preview = combatTargetPreview(fighters, "kirin", { kitPreview: true });
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
  const castIndex = result.events.findIndex((e) => e.t === "cast" && e.src === "kirin");
  expect(castIndex).toBeGreaterThanOrEqual(0);
  const window: CombatEvent[] = [];
  for (let i = castIndex + 1; i < result.events.length; i++) {
    const event = result.events[i]!;
    if (event.t === "cycle" || event.t === "empty" || event.t === "cast" ||
        event.t === "basic" || event.t === "miss" || event.t === "skip") break;
    window.push(event);
  }
  const hits = window.filter((e): e is Hit => e.t === "skill" && e.src === "kirin" && e.kind === "horn");
  const statuses = window.filter((e): e is Extract<CombatEvent, { t: "status" }> =>
    e.t === "status" && e.kind === "paralyze" && e.turns > 0);
  return { caster, cast: result.events[castIndex] as Extract<CombatEvent, { t: "cast" }>, hits, statuses, result, preview, window };
}

describe("Điện Linh Dương (kirin_thunder) horn barrage #97", () => {
  it("keeps the catalog identity and existing per-star total magic damage with authored probabilities", () => {
    const unit = getUnit("kirin_thunder");
    expect([unit.id, unit.nameVi, unit.tier, unit.role, unit.skill.family]).toEqual([
      "kirin_thunder", "Điện Linh Dương", 1, "FIGHTER", KIRIN_HORNS_FAMILY,
    ]);
    expect(unit.skill.hitCountByStar).toEqual([2, 4, 6]);
    expect(unit.skill.paralyzeChanceByStar).toEqual([0, 0.4, 0.95]);
    for (const [star, hits, chance, base, scale] of [
      [1, 2, 0, 45, 1.1], [2, 4, 0.4, 54, 1.32], [3, 6, 0.95, 65, 1.595],
    ]) {
      const spec = skillSpec("kirin_thunder", star);
      expect(spec).toMatchObject({
        side: "enemy", selector: "role_priority", count: 1, hitCount: hits,
        damage: { type: "magic", base, scale, stat: "matk" },
      });
      expect(spec.controls).toEqual(chance === 0 ? [] : [{ kind: "paralyze", turns: 1, chance }]);
    }
  });

  for (const [star, count] of [[1, 2], [2, 4], [3, 6]]) {
    it(`${star}★ emits exactly ${count} ordered, independent damage events alternating selected neighbors`, () => {
      const { cast, hits, statuses, preview, window } = runHorns(star);
      expect(cast.targets).toHaveLength(2);
      expect(cast.targets[0]).toBe("mage");
      expect(["northwest", "south", "east"]).toContain(cast.targets[1]);
      expect(hits).toHaveLength(count);
      expect(hits.map((hit, i) => hit.dst)).toEqual(Array.from({ length: count }, (_, i) => cast.targets[i % 2]));
      expect(hits.every((hit) => hit.kind === "horn" && hit.dmg > 0)).toBe(true);
      expect(preview?.directUids).toEqual(["mage"]);
      expect(preview?.splashUids?.slice().sort()).toEqual(["northwest", "south", "east"].sort());
      expect(window.filter((event) => event.t === "skill" && event.src === "kirin")).toHaveLength(count);
      if (star === 1) expect(statuses).toHaveLength(0);
      if (star > 1) {
        expect(statuses.every((event) => event.turns === 1 && event.source?.skillId === KIRIN_HORNS_FAMILY)).toBe(true);
      }
    });
  }

  it("takes role priority over distance and handles an empty adjacent candidate set", () => {
    const { cast } = runHorns(1);
    expect(cast.targets[0]).toBe("mage");
    const solo = runHorns(3, 7, [
      { uid: "mage", baseId: "titan_earth", star: 1, row: 3, col: 7 },
      { uid: "far", baseId: "titan_earth", star: 1, row: 0, col: 9 },
    ]);
    expect(solo.cast.targets).toEqual(["mage"]);
    expect(solo.hits).toHaveLength(6);
    expect(solo.hits.every((hit) => hit.dst === "mage")).toBe(true);
    expect(solo.preview?.splashUids).toEqual([]);
  });

  it("uniformly samples eligible adjacent enemies with seeded gameplay RNG", () => {
    const counts: Record<"northwest" | "south" | "east", number> = { northwest: 0, south: 0, east: 0 };
    for (let seed = 1; seed <= 180; seed++) {
      const selected = runHorns(1, seed).cast.targets[1]! as keyof typeof counts;
      counts[selected]++;
      expect(runHorns(1, seed).cast.targets[1]).toBe(selected);
    }
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(35);
    for (const count of Object.values(counts)) expect(count).toBeLessThan(85);
  });

  it("updates splash candidates when the board changes, without selecting stale tiles", () => {
    const moved = runHorns(2, 11, [
      { uid: "mage", baseId: "titan_earth", star: 1, row: 3, col: 7 },
      { uid: "northwest", baseId: "titan_earth", star: 1, row: 2, col: 6 },
      { uid: "south", baseId: "titan_earth", star: 1, row: 4, col: 7 },
      { uid: "east", baseId: "titan_earth", star: 1, row: 0, col: 5 },
      { uid: "far", baseId: "titan_earth", star: 1, row: 4, col: 9 },
    ]);
    expect(moved.cast.targets[0]).toBe("mage");
    expect(["northwest", "south"]).toContain(moved.cast.targets[1]);
    expect(moved.preview?.splashUids).toEqual(["northwest", "south"]);
  });

  it("rolls paralyze independently per landed hit and expires after the target loses its next action", () => {
    for (const star of [2, 3]) {
      const outcomes: number[] = [];
      for (let seed = 1; seed <= 100; seed++) {
        const { hits, statuses, result } = runHorns(star, seed, [
          { uid: "mage", baseId: "titan_earth", star: 1, row: 1, col: 6 },
        ]);
        expect(hits).toHaveLength(star * 2);
        outcomes.push(statuses.length);
        expect(statuses.length).toBeLessThanOrEqual(hits.length);
        if (statuses.length) {
          expect(result.events.some((event) => event.t === "skip" && event.src === "mage" && event.reason === "paralyze")).toBe(true);
          expect(result.events.some((event) => event.t === "status" && event.kind === "paralyze"
            && event.dst === "mage" && event.turns === 0)).toBe(true);
        }
      }
      const total = outcomes.reduce((sum, n) => sum + n, 0);
      expect(total).toBeGreaterThan(star === 2 ? 115 : 500);
      expect(total).toBeLessThan(star === 2 ? 225 : 600);
      if (star === 2) expect(outcomes.some((n) => n > 0 && n < 4)).toBe(true);
    }
  });

  it("applies magic resistance and criticals per hit, without duplicating impacts or counters", () => {
    const run = (crit: number, mdef: number, def: number) =>
      runHorns(2, 7, [{ uid: "mage", baseId: "titan_earth", star: 1, row: 1, col: 6 }], (fighters) => {
        fighters[0]!.crit = crit;
        fighters[1]!.mdef = mdef;
        fighters[1]!.def = def;
        fighters[1]!.counterTurns = 1;
      });
    const normal = run(0, 0, 0);
    const armored = run(0, 0, 900);
    const resisted = run(0, 900, 0);
    const crit = run(1, 0, 0);
    expect(normal.hits).toHaveLength(4);
    expect(armored.hits.map((hit) => hit.dmg)).toEqual(normal.hits.map((hit) => hit.dmg));
    expect(resisted.hits.every((hit, i) => hit.dmg < normal.hits[i]!.dmg)).toBe(true);
    expect(crit.hits.every((hit, i) => hit.crit && hit.dmg > normal.hits[i]!.dmg)).toBe(true);
    expect(normal.hits.every((hit) => !hit.crit)).toBe(true);
    expect(normal.window.filter((event) => event.t === "basic" || event.t === "reflect")).toHaveLength(0);
  });
});
