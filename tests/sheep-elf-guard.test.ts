import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, type CombatEvent, type Fighter, type Placement } from "../src/core/combat";
import { SHEEP_ELF_GUARD_FAMILY, skillSpec } from "../src/core/skills";

const center = (star: number, col = 3): Placement =>
  ({ uid: "sheep", baseId: "dryad_tree", star, row: 2, col });
const ally = (uid: string, row: number, col: number): Placement =>
  ({ uid, baseId: "titan_earth", star: 1, row, col });
const enemy: Placement = { uid: "enemy", baseId: "titan_earth", star: 1, row: 2, col: 5 };
const neighbors = [
  ally("nw", 1, 2), ally("n", 1, 3), ally("ne", 1, 4),
  ally("w", 2, 2), ally("e", 2, 4),
  ally("sw", 3, 2), ally("s", 3, 3), ally("se", 3, 4),
];

function battle(star: number, left: Placement[] = [center(star), ...neighbors],
  configure: (all: Fighter[]) => void = () => {}) {
  const all = materializeCombat(left, [enemy]);
  for (const f of all) {
    f.maxHp = f.hp = 100_000;
    f.crit = f.evade = 0;
    f.accuracy = 1;
    f.element = "SPIRIT";
    f.rage = f.uid === "sheep" ? f.rageMax : 0;
    if (f.uid !== "sheep") f.rageMax = 100_000;
    if (f.uid === "enemy") f.atk = f.matk = 1;
  }
  configure(all);
  const result = simulate(all, { seed: 15, rageGain: { L: 0, R: 0 }, captureInspection: true });
  const end = result.events.findIndex((e) => e.t === "cycle" && e.cycle === 2);
  const firstCycle = result.events.slice(0, end < 0 ? undefined : end);
  return { result, firstCycle, all };
}

const status = (events: CombatEvent[], kind: string, dst?: string) => events.filter(
  (e) => e.t === "status" && e.kind === kind && (dst === undefined || e.dst === dst));

describe("issue #115 Sheep Elf — adjacent shield and magic buffs", () => {
  it("preserves the authored tier, role, rage and shield formula across the stars", () => {
    const unit = getUnit("dryad_tree");
    expect([unit.id, unit.tier, unit.role, unit.stats.rageMax, unit.skill.family])
      .toEqual(["dryad_tree", 2, "SUPPORT", 4, SHEEP_ELF_GUARD_FAMILY]);
    for (const star of [1, 2, 3]) {
      expect(skillSpec("dryad_tree", star)).toMatchObject({
        side: "ally", selector: "adjacent_allies", count: 8,
        shield: { base: 35, scale: 0.3, stat: "matk" },
        linkedShield: {
          turns: 2,
          magicDamagePct: star >= 2 ? 10 : 0,
          magicPenPct: star === 3 ? 15 : 0,
        },
      });
    }
  });

  it.each([1, 2, 3])("%i★ shields exactly eight adjacent allies, never caster or enemies", (star) => {
    const { firstCycle } = battle(star, [...[center(star), ...neighbors], ally("far", 0, 0)]);
    const cast = firstCycle.find((e) => e.t === "cast" && e.src === "sheep");
    expect(cast?.t).toBe("cast");
    if (cast?.t !== "cast") return;
    expect(new Set(cast.targets)).toEqual(new Set(neighbors.map((p) => p.uid)));
    const grant = firstCycle.filter((e): e is Extract<CombatEvent, { t: "shield" }> => e.t === "shield" && e.src === "sheep" && e.amount > 0);
    expect(new Set(grant.map((e) => e.dst))).toEqual(new Set(neighbors.map((p) => p.uid)));
    expect(grant).toHaveLength(8);
    for (const dst of ["far", "sheep", "enemy"]) {
      expect(grant.some((e) => e.dst === dst)).toBe(false);
    }
    expect(status(firstCycle, "sheepElfMagicDamage").filter((e) => e.t === "status" && e.turns > 0))
      .toHaveLength(star >= 2 ? 8 : 0);
    expect(status(firstCycle, "sheepElfMagicPen").filter((e) => e.t === "status" && e.turns > 0))
      .toHaveLength(star === 3 ? 8 : 0);
  });

  it("magic damage bonus at 2★ and resistance penetration at 3★ affect real basic impacts", () => {
    const hit = (star: number) => {
      const { firstCycle } = battle(star, [center(star, 4), ally("caster", 2, 3)], (all) => {
        const mage = all.find((f) => f.uid === "caster")!;
        mage.role = "MAGE";
        mage.basicDamageType = "magic";
        mage.matk = 1000;
        const target = all.find((f) => f.uid === "enemy")!;
        target.mdef = 200;
      });
      const cast = firstCycle.findIndex((e) => e.t === "cast" && e.src === "sheep");
      const basic = firstCycle.findIndex((e) => e.t === "basic" && e.src === "caster");
      expect(basic).toBeGreaterThan(cast);
      const event = firstCycle[basic];
      expect(event?.t).toBe("basic");
      return event?.t === "basic" ? event.dmg : 0;
    };
    const base = hit(1), boosted = hit(2), penetrated = hit(3);
    expect(base).toBeGreaterThan(0);
    expect(boosted).toBeGreaterThan(base);
    expect(penetrated).toBeGreaterThan(boosted);
  });

  it("expired linked shields remove their own amount and statuses without removing unrelated shield", () => {
    const { result } = battle(3, [center(3, 4), ally("protected", 2, 3)], (all) => {
      all.find((f) => f.uid === "protected")!.shield = 50;
      const sheep = all.find((f) => f.uid === "sheep")!;
      sheep.rageMax = 100_000;
      sheep.rage = sheep.rageMax;
    });
    const expirations = status(result.events, "sheepElfShield", "protected")
      .filter((e) => e.t === "status" && e.turns === 0);
    expect(expirations.length).toBeGreaterThan(0);
    expect(status(result.events, "sheepElfMagicDamage", "protected").some((e) => e.t === "status" && e.turns === 0)).toBe(true);
    expect(status(result.events, "sheepElfMagicPen", "protected").some((e) => e.t === "status" && e.turns === 0)).toBe(true);
    const remaining = result.fighters.find((f) => f.uid === "protected")!;
    expect(remaining.status.sheepElfShield).toBeUndefined();
    expect(remaining.status.sheepElfMagicDamage).toBeUndefined();
    expect(remaining.status.sheepElfMagicPen).toBeUndefined();
    expect(remaining.shield).toBe(50);
  });

  it("broken linked shield immediately clears magic bonuses instead of surviving as a generic shield", () => {
    const { firstCycle, result } = battle(3, [center(3, 4), ally("protected", 2, 3)], (all) => {
      const attacker = all.find((f) => f.uid === "enemy")!;
      attacker.atk = 2000;
      attacker.basicDamageType = "physical";
      attacker.role = "FIGHTER";
      attacker.tauntBy = "protected";
      attacker.status.taunt = { turns: 4, value: 0 };
    });
    expect(firstCycle.some((e) => e.t === "shield" && e.dst === "protected" && e.amount > 0)).toBe(true);
    expect(firstCycle.some((e) => e.t === "status" && e.dst === "protected" && e.kind === "sheepElfShield" && e.turns === 0)).toBe(true);
    expect(firstCycle.some((e) => e.t === "status" && e.dst === "protected" && e.kind === "sheepElfMagicDamage" && e.turns === 0)).toBe(true);
    expect(firstCycle.some((e) => e.t === "status" && e.dst === "protected" && e.kind === "sheepElfMagicPen" && e.turns === 0)).toBe(true);
    const brokenAt = result.events.findIndex((e) => e.t === "status" && e.dst === "protected"
      && e.kind === "sheepElfShield" && e.turns === 0);
    const protectedAfterBreak = result.inspectionFrames?.find((frame) => frame.eventIndex > brokenAt)
      ?.units.find((u) => u.uid === "protected");
    expect(protectedAfterBreak?.shield).toBe(0);
    expect(protectedAfterBreak?.status).not.toHaveProperty("sheepElfMagicDamage");
    expect(protectedAfterBreak?.status).not.toHaveProperty("sheepElfMagicPen");
  });

  it("recast refreshes existing shield instead of stacking its amount or magic bonuses", () => {
    const { result } = battle(3, [center(3, 4), ally("protected", 2, 3)], (all) => {
      const sheep = all.find((f) => f.uid === "sheep")!;
      sheep.rageMax = 1;
      sheep.rage = 1;
    });
    const casts = result.events.filter((e) => e.t === "cast" && e.src === "sheep");
    expect(casts.length).toBeGreaterThan(3);
    const shields = result.events.filter((e): e is Extract<CombatEvent, { t: "shield" }> =>
      e.t === "shield" && e.src === "sheep" && e.dst === "protected" && e.amount > 0);
    expect(shields).toHaveLength(1);
    const firstShield = shields[0]!.amount;
    expect(result.inspectionFrames?.some((frame) =>
      (frame.units.find((u) => u.uid === "protected")?.shield ?? 0) > firstShield)).toBe(false);
    expect(status(result.events, "sheepElfMagicDamage", "protected").every((e) =>
      e.t === "status" && e.turns > 0)).toBe(true);
  });
});
