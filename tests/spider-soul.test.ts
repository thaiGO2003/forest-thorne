import { describe, expect, it } from "vitest";
import { getUnit, type Role } from "../src/content/catalog";
import {
  combatTargetPreview, materializeCombat, simulate, type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { skillSpec } from "../src/core/skills";

type Impact = Extract<CombatEvent, { t: "basic" | "skill" }>;
type Cast = Extract<CombatEvent, { t: "cast" }>;
type Configuration = {
  roles?: Role[];
  rows?: number[];
  seed?: number;
  crit?: number;
  paralyze?: number;
  enemyMdef?: number;
};

function setup(star: number, count = 3, config: Configuration = {}) {
  const left: Placement[] = [{ uid: "spider", baseId: "spider_venom", star, row: 2, col: 4 }];
  const right: Placement[] = Array.from({ length: count }, (_, i) => ({
    uid: `foe${i}`, baseId: "titan_earth", star: 1,
    row: config.rows?.[i] ?? 2, col: 5 + i,
  }));
  const fighters = materializeCombat(left, right);
  const caster = fighters[0]!;
  caster.rage = caster.rageMax;
  caster.crit = config.crit ?? 0;
  caster.element = "SPIRIT";
  caster.skill = {
    ...caster.skill,
    controls: caster.skill.controls.map((control) => control.kind === "paralyze"
      ? { ...control, chance: config.paralyze ?? control.chance } : control),
  };
  for (let i = 1; i < fighters.length; i++) {
    const target = fighters[i]!;
    target.role = config.roles?.[i - 1] ?? "MAGE";
    target.hp = target.maxHp = 100_000;
    target.atk = target.matk = 1;
    target.def = 10_000;
    target.mdef = config.enemyMdef ?? 0;
    target.crit = target.evade = 0;
    target.element = "SPIRIT";
    target.rageMax = 100_000;
  }
  return { fighters, caster };
}

function firstVolley(fighters: Fighter[], seed = 9) {
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
  const start = result.events.findIndex((event) => event.t === "cast" && event.src === "spider");
  expect(start).toBeGreaterThan(-1);
  const endOffset = result.events.slice(start + 1).findIndex((event) =>
    event.t === "cycle" || (event.t === "cast" && event.src === "spider"));
  const window = result.events.slice(start, endOffset < 0 ? undefined : start + 1 + endOffset);
  return {
    result,
    cast: window[0] as Cast,
    hits: window.filter((event): event is Impact =>
      event.t === "skill" && event.src === "spider"),
    events: window,
  };
}

describe("Nhện Linh soul volley — issue #96", () => {
  it("preserves the unit id and authored damage across all three star specs", () => {
    const unit = getUnit("spider_venom");
    expect([unit.id, unit.nameVi, unit.tier, unit.skill.nameVi, unit.skill.family])
      .toEqual(["spider_venom", "Nhện Linh", 5, "Bắn Linh Hồn", "spider_soul_volley"]);
    for (const star of [1, 2, 3]) {
      expect(skillSpec(unit.id, star)).toMatchObject({
        side: "enemy", selector: "same_row",
        damage: { base: 18, scale: 0.7, stat: "atk", type: "magic" },
        controls: [{ kind: "paralyze", turns: 1, chance: 0.2 }],
      });
    }
  });

  it("1★ uses the live same-row count at cast, with an uncrittable magic impact per soul", () => {
    const { fighters } = setup(1, 4, { rows: [2, 2, 1, 2], crit: 1, paralyze: 0 });
    const preview = combatTargetPreview(fighters, "spider", { kitPreview: true });
    expect([...(preview?.directUids ?? []), ...(preview?.splashUids ?? [])]).toHaveLength(3);
    const { cast, hits } = firstVolley(fighters);
    expect(cast.targets).toHaveLength(3);
    expect(hits).toHaveLength(3);
    expect(hits.map((event) => event.dst)).toEqual(cast.targets);
    expect(hits.every((event) => event.kind === "soul" && !event.crit)).toBe(true);
    expect(hits.map((event) => event.dst)).not.toContain("foe2");
  });

  it("2★ preserves the cast count and permits independent magic critical strikes", () => {
    const { fighters } = setup(2, 3, { crit: 1, paralyze: 0 });
    const { hits, cast } = firstVolley(fighters);
    expect(hits).toHaveLength(3);
    expect(cast.targets).toEqual(hits.map((event) => event.dst));
    expect(hits.every((event) => event.crit && event.kind === "soul")).toBe(true);
  });

  it("3★ launches twice the number of enemies snapshotted before round actions", () => {
    const { fighters } = setup(3, 3, { crit: 0, paralyze: 0 });
    const { cast, hits } = firstVolley(fighters);
    expect(hits).toHaveLength(6);
    expect(cast.targets).toHaveLength(6);
    expect(new Set(hits.map((event) => event.dst)).size).toBeLessThan(hits.length);
  });

  it("3★ retains its round-start count when an enemy dies before the spider acts and resets next round", () => {
    const left: Placement[] = [
      { uid: "killer", baseId: "titan_earth", star: 3, row: 2, col: 4 },
      { uid: "spider", baseId: "spider_venom", star: 3, row: 2, col: 3 },
    ];
    const right: Placement[] = [
      { uid: "weak", baseId: "titan_earth", star: 1, row: 2, col: 5 },
      { uid: "strong", baseId: "titan_earth", star: 1, row: 2, col: 6 },
    ];
    const fighters = materializeCombat(left, right);
    fighters[0]!.atk = 100_000;
    fighters[0]!.accuracy = 1;
    fighters[1]!.rage = fighters[1]!.rageMax;
    fighters[1]!.crit = 0;
    fighters[1]!.element = "SPIRIT";
    fighters[1]!.skill.controls = [];
    for (const fighter of fighters.slice(2)) {
      fighter.hp = fighter.maxHp = fighter.uid === "weak" ? 1 : 100_000;
      fighter.mdef = 0;
      fighter.def = 0;
      fighter.evade = 0;
      fighter.atk = fighter.matk = 1;
      fighter.element = "SPIRIT";
    }
    const result = simulate(fighters, { seed: 4, rageGain: { L: 0, R: 0 } });
    const death = result.events.findIndex((event) => event.t === "death" && event.dst === "weak");
    const casts = result.events.flatMap((event, i) =>
      event.t === "cast" && event.src === "spider" ? [i] : []);
    expect(death).toBeGreaterThan(-1);
    expect(casts[0]).toBeGreaterThan(death);
    const firstHits = result.events.slice(casts[0]!, casts[1] ?? undefined)
      .filter((event) => event.t === "skill" && event.src === "spider") as Impact[];
    expect(firstHits.map((event) => event.dst)).toEqual(["strong", "strong", "strong", "strong"]);
    const firstCast = result.events[casts[0]!] as Cast;
    expect(firstCast.targets).toEqual(firstHits.map((event) => event.dst));
    if (casts[1] !== undefined) {
      const secondCast = result.events[casts[1]!] as Cast;
      expect(secondCast.targets).toHaveLength(2);
    }
  });

  it("role priority dominates distance, and seeded adjacent selection is uniform", () => {
    const chosen: string[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const { fighters } = setup(2, 3, { roles: ["MAGE", "MAGE", "TANKER"], paralyze: 0 });
      const { cast } = firstVolley(fighters, seed);
      expect(cast.targets).toHaveLength(3);
      expect(cast.targets.every((uid) => uid === "foe0" || uid === "foe1")).toBe(true);
      chosen.push(cast.targets[1]!);
      expect(firstVolley(setup(2, 3, { roles: ["MAGE", "MAGE", "TANKER"], paralyze: 0 }).fighters, seed).cast.targets).toEqual(cast.targets);
    }
    const secondNeighbor = chosen.filter((uid) => uid === "foe1").length;
    expect(secondNeighbor).toBeGreaterThan(25);
    expect(secondNeighbor).toBeLessThan(95);
  });

  it("never creates a projectile or skill damage when no target shares the row at cast", () => {
    const { fighters } = setup(1, 2, { rows: [1, 3], paralyze: 0 });
    const preview = combatTargetPreview(fighters, "spider", { kitPreview: true });
    expect(preview?.directUids).toEqual([]);
    const { cast, hits } = firstVolley(fighters);
    expect(cast.targets).toEqual([]);
    expect(hits).toEqual([]);
  });

  it("magic resistance reduces noncrit damage while armor does not", () => {
    const first = (mdef: number, def: number) => {
      const { fighters } = setup(1, 1, { paralyze: 0, enemyMdef: mdef });
      fighters[1]!.def = def;
      return firstVolley(fighters).hits[0]!.dmg;
    };
    const normal = first(0, 0);
    expect(first(0, 10_000)).toBe(normal);
    expect(first(300, 0)).toBeLessThan(normal);
  });

  it("paralyze chance is seeded, applies once per victim, expires on its next action and does not recurse", () => {
    let applied = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const { fighters } = setup(1, 1, { paralyze: 0.2 });
      const { events, hits } = firstVolley(fighters, seed);
      expect(hits).toHaveLength(1);
      const status = events.filter((event) => event.t === "status" && event.kind === "paralyze");
      expect(status.length).toBeLessThanOrEqual(1);
      expect(events.filter((event) => event.t === "skill" && event.src === "spider")).toHaveLength(1);
      applied += status.length;
      if (status.length) {
        const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
        expect(result.events.some((event) => event.t === "skip" && event.src === "foe0" && event.reason === "paralyze")).toBe(true);
        expect(result.survivors.find((survivor) => survivor.uid === "foe0")?.status.paralyze).toBeUndefined();
      }
    }
    expect(applied).toBeGreaterThan(9);
    expect(applied).toBeLessThan(50);
  });
});
