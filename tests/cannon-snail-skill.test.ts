import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { combatTargetPreview, materializeCombat, simulate, type CombatEvent, type Fighter, type Placement } from "../src/core/combat";
import { CANNON_COLUMN_BLAST_FAMILY, skillSpec } from "../src/core/skills";

type Hit = Extract<CombatEvent, { t: "basic" | "skill" }>;
const targets: Placement[] = [
  { uid: "primary", baseId: "titan_earth", star: 1, col: 7, row: 2 },
  { uid: "above", baseId: "titan_earth", star: 1, col: 7, row: 1 },
  { uid: "below", baseId: "titan_earth", star: 1, col: 7, row: 3 },
  { uid: "far-row", baseId: "titan_earth", star: 1, col: 7, row: 0 },
  { uid: "other-col", baseId: "titan_earth", star: 1, col: 8, row: 2 },
];

function blast(star: number, seed = 7, places: Placement[] = targets,
  configure: (fighters: Fighter[]) => void = () => {}) {
  const fighters = materializeCombat(
    [{ uid: "snail", baseId: "snail_fortress", star, col: 4, row: 2 }],
    places,
  );
  const snail = fighters[0]!;
  snail.rage = snail.rageMax;
  snail.crit = 0;
  snail.element = "SPIRIT";
  for (const target of fighters.slice(1)) {
    target.role = target.uid === "primary" ? "MAGE" : "FIGHTER";
    target.hp = target.maxHp = 100_000;
    target.def = target.mdef = 0;
    target.atk = target.matk = 1;
    target.crit = 0;
    target.element = "SPIRIT";
    target.rageMax = 100_000;
    target.onHitBurn = target.onHitPoison = 0;
  }
  configure(fighters);
  const preview = combatTargetPreview(fighters, "snail", { kitPreview: true });
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
  const index = result.events.findIndex((event) => event.t === "cast" && event.src === "snail");
  expect(index).toBeGreaterThanOrEqual(0);
  const cast = result.events[index] as Extract<CombatEvent, { t: "cast" }>;
  const next = result.events.findIndex((event, i) => i > index && (
    event.t === "cycle" || event.t === "empty" || event.t === "basic" || event.t === "cast"));
  const window = result.events.slice(index + 1, next < 0 ? undefined : next);
  const hits = window.filter((event): event is Hit =>
    event.t === "skill" && event.src === "snail" && event.kind === "cannon");
  return { cast, hits, window, result, preview, fighters };
}

describe("Ốc Sên Pháo Đài — Pháo Thân (issue #111)", () => {
  it("preserves catalog identity, tier, stats, rage costs, physical base formula and stat scaling", () => {
    const unit = getUnit("snail_fortress");
    expect(unit).toMatchObject({
      id: "snail_fortress", tier: 3, role: "TANKER",
      stats: { hp: 420, atk: 48, def: 40, matk: 14, mdef: 30, range: 1, rageMax: 5 },
      skill: { nameVi: "Pháo Thân", family: CANNON_COLUMN_BLAST_FAMILY, rageCost: [3, 4, 5] },
    });
    for (const star of [1, 2, 3]) {
      expect(skillSpec("snail_fortress", star)).toMatchObject({
        side: "enemy", area: "single", selector: "role_priority",
        damage: { base: 15, scale: 0.4, stat: "def", type: "physical" },
        dots: [], controls: [], buffs: [], debuffs: [], reaction: {},
        shield: null, heal: null, hot: null,
      });
    }
  });

  for (const [star, falloff] of [[1, 1 / 3], [2, 2 / 3], [3, 1]] as const) {
    it(`${star}★ damages the role-priority primary and immediate same-column neighbors once at ${falloff} splash`, () => {
      const { cast, hits, preview } = blast(star);
      expect(cast.targets).toEqual(["primary", "above", "below"]);
      expect(hits.map((hit) => hit.dst)).toEqual(cast.targets);
      expect(new Set(hits.map((hit) => hit.dst)).size).toBe(3);
      expect(hits.map((hit) => hit.kind)).toEqual(["cannon", "cannon", "cannon"]);
      expect(hits.every((hit) => hit.crit === false && hit.dmg > 0 && hit.absorbed === 0)).toBe(true);
      expect(hits[1]!.dmg).toBe(Math.max(1, Math.round(hits[0]!.dmg * falloff)));
      expect(hits[2]!.dmg).toBe(hits[1]!.dmg);
      expect(preview?.directUids).toEqual(["primary"]);
      expect(preview?.splashUids).toEqual(["above", "below"]);
      expect(preview?.tags?.filter((tag) => tag.kind === "skill").map((tag) => tag.uid))
        .toEqual(cast.targets);
    });
  }

  it("prioritizes role above distance and never spills to the next column or a non-adjacent row", () => {
    const { cast } = blast(3, 9, targets, (fighters) => {
      fighters.find((unit) => unit.uid === "other-col")!.role = "TANKER";
      fighters.find((unit) => unit.uid === "above")!.role = "ARCHER";
      fighters.find((unit) => unit.uid === "primary")!.role = "MAGE";
    });
    expect(cast.targets).toEqual(["primary", "above", "below"]);
    const one = blast(1, 9, [
      { uid: "primary", baseId: "titan_earth", star: 1, col: 8, row: 0 },
      { uid: "other-col", baseId: "titan_earth", star: 1, col: 7, row: 1 },
    ]);
    expect(one.cast.targets).toEqual(["primary"]);
    expect(one.hits).toHaveLength(1);
    expect(one.preview?.splashUids).toEqual([]);
  });

  it("falls back to deterministic distance ranking when no high-priority caster role remains", () => {
    const places: Placement[] = [
      { uid: "distant", baseId: "titan_earth", star: 1, col: 9, row: 2 },
      { uid: "nearest", baseId: "titan_earth", star: 1, col: 7, row: 2 },
      { uid: "next-row", baseId: "titan_earth", star: 1, col: 7, row: 3 },
    ];
    const { cast, hits } = blast(2, 12, places, (fighters) => {
      for (const unit of fighters.slice(1)) unit.role = "FIGHTER";
    });
    expect(cast.targets).toEqual(["nearest", "next-row"]);
    expect(hits.map((hit) => hit.dst)).toEqual(cast.targets);
  });

  it("uses independent seeded gameplay crit RNG, including its distribution and reproducibility", () => {
    let crits = 0;
    for (let seed = 1; seed <= 160; seed++) {
      const configure = (fighters: Fighter[]) => { fighters[0]!.crit = 0.4; };
      const first = blast(1, seed, [{ uid: "primary", baseId: "titan_earth", star: 1, col: 7, row: 2 }], configure).hits[0]!;
      const repeat = blast(1, seed, [{ uid: "primary", baseId: "titan_earth", star: 1, col: 7, row: 2 }], configure).hits[0]!;
      expect(repeat).toEqual(first);
      crits += Number(first.crit);
    }
    expect(crits).toBeGreaterThan(42);
    expect(crits).toBeLessThan(88);
  });

  it("applies DEF, crit and other damage multipliers before splash falloff, exactly once", () => {
    const noCrit = blast(3).hits[0]!.dmg;
    const armored = blast(3, 7, targets, (fighters) => {
      for (const foe of fighters.slice(1)) foe.def = 100;
    }).hits;
    expect(armored[0]!.dmg).toBeLessThan(noCrit);
    expect(armored[1]!.dmg).toBe(armored[0]!.dmg);
    expect(armored[2]!.dmg).toBe(armored[0]!.dmg);
    const crit = blast(1, 7, targets, (fighters) => { fighters[0]!.crit = 1; }).hits;
    expect(crit.every((hit) => hit.crit)).toBe(true);
    expect(crit[0]!.dmg).toBeGreaterThan(blast(1).hits[0]!.dmg);
    expect(crit[1]!.dmg).toBe(Math.round(crit[0]!.dmg / 3));
    const buffed = blast(2, 7, targets, (fighters) => {
      fighters[0]!.def *= 2;
    }).hits;
    expect(buffed[0]!.dmg).toBeGreaterThan(blast(2).hits[0]!.dmg);
    expect(buffed[1]!.dmg).toBe(Math.round(buffed[0]!.dmg * 2 / 3));
  });

  it("has no timed status, refresh or stack; round boundaries clean pre-existing statuses", () => {
    const { window, result } = blast(2, 17, targets, (fighters) => {
      fighters.find((f) => f.uid === "above")!.status.slow = { turns: 1, value: 0.2 };
    });
    expect(window.filter((event) => event.t === "status" && event.source?.skillId === CANNON_COLUMN_BLAST_FAMILY)).toEqual([]);
    expect(result.events.filter((event) => event.t === "shield" && event.src === "snail")).toEqual([]);
    expect(result.fighters.find((f) => f.uid === "above")!.status.slow).toBeUndefined();
    expect(result.fighters.every((f) => !f.status.cannon_column_blast)).toBe(true);
  });

  it("avoids counter-chain recursion and duplicates when targets have reflections and shields", () => {
    const { cast, window, hits } = blast(3, 7, targets, (fighters) => {
      for (const foe of fighters.slice(1)) {
        foe.shield = 10;
        foe.counterTurns = 2;
        foe.reflect = { turns: 2, pctByDamageType: { physical: 1 } };
      }
      fighters[0]!.hp = fighters[0]!.maxHp = 100_000;
    });
    expect(cast.targets).toHaveLength(3);
    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => hit.dst)).toEqual(cast.targets);
    expect(hits.every((hit) => hit.absorbed > 0)).toBe(true);
    expect(window.filter((event) => event.t === "basic" && event.src !== "snail")).toEqual([]);
  });
});
