import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import {
  combatTargetPreview, materializeCombat, simulate,
  type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { GOLD_THROW_FAMILY, skillSpec } from "../src/core/skills";

const PRIMARY: Placement = { uid: "mage", baseId: "titan_earth", star: 1, row: 2, col: 7 };
const NEIGHBORS: Placement[] = [
  { uid: "nw", baseId: "titan_earth", star: 1, row: 1, col: 6 },
  { uid: "n", baseId: "titan_earth", star: 1, row: 1, col: 7 },
  { uid: "ne", baseId: "titan_earth", star: 1, row: 1, col: 8 },
  { uid: "w", baseId: "titan_earth", star: 1, row: 2, col: 6 },
  { uid: "e", baseId: "titan_earth", star: 1, row: 2, col: 8 },
  { uid: "sw", baseId: "titan_earth", star: 1, row: 3, col: 6 },
  { uid: "s", baseId: "titan_earth", star: 1, row: 3, col: 7 },
  { uid: "se", baseId: "titan_earth", star: 1, row: 3, col: 8 },
];
const FAR: Placement = { uid: "far", baseId: "titan_earth", star: 1, row: 4, col: 9 };

type SkillHit = Extract<CombatEvent, { t: "basic" | "skill" }>;
type Cast = Extract<CombatEvent, { t: "cast" }>;
type Status = Extract<CombatEvent, { t: "status" }>;

function battle(
  star: number,
  seed = 17,
  placements: Placement[] = [PRIMARY, ...NEIGHBORS, FAR],
  configure: (fighters: Fighter[]) => void = () => {},
) {
  const fighters = materializeCombat(
    [{ uid: "gold", baseId: "swan_grace", star, row: 2, col: 4 }],
    placements,
  );
  for (const fighter of fighters) {
    fighter.hp = fighter.maxHp = 100_000;
    fighter.def = fighter.mdef = 0;
    fighter.crit = fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.element = "SPIRIT";
    if (fighter.uid === "gold") {
      fighter.rage = fighter.rageMax;
    } else {
      fighter.role = fighter.uid === "mage" ? "MAGE" : fighter.uid === "far" ? "TANKER" : "FIGHTER";
      fighter.atk = fighter.matk = 1;
      fighter.rage = 0;
      fighter.rageMax = 100_000;
    }
  }
  configure(fighters);
  const preview = combatTargetPreview(fighters, "gold", { kitPreview: true });
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 }, captureInspection: true });
  const cycleEnd = result.events.findIndex((event) => event.t === "cycle" && event.cycle === 2);
  const firstCycle = result.events.slice(0, cycleEnd >= 0 ? cycleEnd : undefined);
  const casts = firstCycle.filter((event): event is Cast => event.t === "cast" && event.src === "gold");
  const hits = firstCycle.filter((event): event is SkillHit =>
    event.t === "skill" && event.src === "gold" && event.kind === "gold");
  const stuns = firstCycle.filter((event): event is Status =>
    event.t === "status" && event.dst === "mage" && event.kind === "stun" && event.turns > 0);
  return { result, fighters, preview, casts, hits, stuns, firstCycle };
}

describe("issue #116 swan_grace gold throws", () => {
  it("keeps catalog id, tier, SUPPORT role, stats, magic basic coefficient and rage costs", () => {
    const unit = getUnit("swan_grace");
    expect([unit.id, unit.tier, unit.role, unit.skill.family]).toEqual([
      "swan_grace", 4, "SUPPORT", GOLD_THROW_FAMILY,
    ]);
    expect(unit.stats).toEqual({
      hp: 340, atk: 29, def: 19, matk: 88, mdef: 31, range: 3,
      rageMax: 4, crit: 0.05, critDmg: 1.5, evade: 0.07, accuracy: 0.95,
    });
    expect(unit.skill.rageCost).toEqual([2, 3, 4]);
    expect(unit.basic).toMatchObject({ delivery: "projectile", damageType: "magic" });
    for (const star of [1, 2, 3]) {
      expect(skillSpec("swan_grace", star)).toMatchObject({
        side: "enemy", area: "single", count: 1, selector: "role_priority",
        damage: { base: 0, scale: 1, stat: "matk", type: "magic" },
        controls: [{ kind: "stun", turns: 1, chance: 1 }],
      });
    }
  });

  it("1★ throws once onto the priority enemy; one hit and one stun, never adjacent splash", () => {
    const { casts, hits, stuns, firstCycle, preview } = battle(1);
    expect(casts).toHaveLength(1);
    expect(casts[0]?.targets).toEqual(["mage"]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ src: "gold", dst: "mage", kind: "gold", crit: false });
    expect(hits[0]!.dmg).toBeGreaterThan(0);
    expect(stuns).toHaveLength(1);
    expect(stuns[0]?.source?.skillId).toBe(GOLD_THROW_FAMILY);
    expect(firstCycle.findIndex((event) => event === hits[0]))
      .toBeLessThan(firstCycle.findIndex((event) => event === stuns[0]));
    expect(preview?.directUids).toEqual(["mage"]);
    expect(preview?.splashUids).toEqual([]);
  });

  it("2★ strikes every occupied surrounding cell once and excludes distant or allied units", () => {
    const { casts, hits, stuns, preview } = battle(2);
    expect(casts).toHaveLength(1);
    expect(casts[0]?.targets[0]).toBe("mage");
    expect(new Set(casts[0]?.targets)).toEqual(new Set(["mage", ...NEIGHBORS.map((p) => p.uid)]));
    expect(hits).toHaveLength(9);
    expect(new Set(hits.map((hit) => hit.dst))).toEqual(new Set(casts[0]!.targets));
    expect(hits.every((hit) => hit.dmg > 0)).toBe(true);
    expect(stuns).toHaveLength(1);
    expect(new Set(preview?.splashUids)).toEqual(new Set(NEIGHBORS.map((p) => p.uid)));
    expect(hits.some((hit) => hit.dst === "far" || hit.dst === "gold")).toBe(false);
  });

  it("3★ casts twice in the same action, charging rage only once, with one hit per victim per throw", () => {
    const { casts, hits, stuns, firstCycle, result } = battle(3);
    expect(casts).toHaveLength(2);
    expect(casts[0]?.targets).toEqual(casts[1]?.targets);
    expect(casts.every((cast) => cast.targets[0] === "mage")).toBe(true);
    expect(hits).toHaveLength(18);
    for (const uid of ["mage", ...NEIGHBORS.map((p) => p.uid)]) {
      expect(hits.filter((hit) => hit.dst === uid)).toHaveLength(2);
    }
    expect(stuns).toHaveLength(2);
    const firstCast = firstCycle.indexOf(casts[0]!);
    const secondCast = firstCycle.indexOf(casts[1]!);
    expect(secondCast).toBeGreaterThan(firstCast);
    expect(firstCycle.slice(firstCast + 1, secondCast).filter((event) => event.t === "skill" && event.src === "gold")).toHaveLength(9);
    expect(result.inspectionFrames?.find((frame) => frame.eventIndex >= secondCast + 1)
      ?.units.find((unit) => unit.uid === "gold")?.rage).toBe(0);
  });

  it("role priority beats distance, with a safe fallback when all adjacent cells are empty", () => {
    const noNeighbors = battle(3, 19, [
      { uid: "close", baseId: "titan_earth", star: 1, row: 2, col: 5 },
      { uid: "mage", baseId: "titan_earth", star: 1, row: 4, col: 9 },
    ]);
    expect(noNeighbors.casts.map((cast) => cast.targets)).toEqual([["mage"], ["mage"]]);
    expect(noNeighbors.hits.map((hit) => hit.dst)).toEqual(["mage", "mage"]);
    expect(noNeighbors.preview?.splashUids).toEqual([]);
  });

  it("stun skips exactly the victim's next action and expires there; repeated throws refresh, not stack", () => {
    for (const star of [1, 2, 3]) {
      const { result, stuns } = battle(star, 23, [PRIMARY]);
      expect(stuns).toHaveLength(star === 3 ? 2 : 1);
      const skipIndex = result.events.findIndex((event) => event.t === "skip" && event.src === "mage" && event.reason === "stun");
      expect(skipIndex).toBeGreaterThan(0);
      const following = result.inspectionFrames?.find((frame) => frame.eventIndex >= skipIndex + 1);
      expect(following?.units.find((unit) => unit.uid === "mage")?.status.stun).toBeUndefined();
    }
  });

  it("reuses magic resistance/crit pipeline exactly once for each impact, not physical armor", () => {
    const one = [PRIMARY];
    const raw = battle(1, 17, one).hits[0]!;
    const armored = battle(1, 17, one, (fighters) => { fighters[1]!.def = 900; }).hits[0]!;
    const resisted = battle(1, 17, one, (fighters) => { fighters[1]!.mdef = 900; }).hits[0]!;
    const critical = battle(1, 17, one, (fighters) => { fighters[0]!.crit = 1; }).hits[0]!;
    expect(raw.dmg).toBe(armored.dmg);
    expect(resisted.dmg).toBeLessThan(raw.dmg);
    expect(critical.crit).toBe(true);
    expect(critical.dmg).toBeGreaterThan(raw.dmg);
  });

  it("seeded crit RNG is reproducible and non-degenerate across repeated independent throws", () => {
    let critical = 0;
    let ordinary = 0;
    let mixed = 0;
    for (let seed = 1; seed <= 48; seed++) {
      const setup = (fighters: Fighter[]) => { fighters[0]!.crit = 0.5; };
      const a = battle(3, seed, [PRIMARY], setup).hits;
      const b = battle(3, seed, [PRIMARY], setup).hits;
      expect(a).toEqual(b);
      expect(a).toHaveLength(2);
      critical += a.filter((hit) => hit.crit).length;
      ordinary += a.filter((hit) => !hit.crit).length;
      if (a[0]!.crit !== a[1]!.crit) mixed++;
    }
    expect(critical).toBeGreaterThan(15);
    expect(ordinary).toBeGreaterThan(15);
    expect(mixed).toBeGreaterThan(5);
  });
});
