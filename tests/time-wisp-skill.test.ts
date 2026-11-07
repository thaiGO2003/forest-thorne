import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { materializeCombat, simulate, type CombatEvent, type Fighter, type Placement } from "../src/core/combat";
import { skillSpec } from "../src/core/skills";

const at = (uid: string, star: number, row: number, col: number, baseId = "titan_earth"): Placement =>
  ({ uid, baseId, star, row, col });

function lineup(star: number, enemies: Array<[string, number, number, Fighter["role"]]> = [
  ["primary", 2, 5, "MAGE"],
  ["right", 2, 6, "FIGHTER"],
  ["above", 1, 5, "ARCHER"],
  ["below", 3, 5, "SUPPORT"],
]) {
  const fighters = materializeCombat(
    [at("wisp", star, 2, 4, "wisp_light")],
    enemies.map(([uid, row, col]) => at(uid, 1, row, col)),
  );
  for (const fighter of fighters) {
    fighter.hp = fighter.maxHp = 200_000;
    fighter.crit = fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.rageMax = 500;
    fighter.rage = fighter.uid === "wisp" ? 500 : 0;
    fighter.atk = 1;
  }
  for (const [uid, , , role] of enemies) fighters.find((f) => f.uid === uid)!.role = role;
  return fighters;
}

function firstCast(fighters: Fighter[], seed = 17) {
  const result = simulate(fighters, { seed, rageGain: { L: 0, R: 0 } });
  const from = result.events.findIndex((event) => event.t === "cast" && event.src === "wisp");
  const to = result.events.findIndex((event, i) => i > from && event.t === "teleport" && event.src === "wisp");
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  const window = result.events.slice(from, to + 1);
  const sand = window.filter((event): event is Extract<CombatEvent, { t: "basic" | "skill" }> =>
    event.t === "skill" && event.kind === "sand" && event.src === "wisp");
  return { result, from, to, window, sand };
}

describe("Ma Vải Thời Gian — ném cát thời gian", () => {
  it("retains catalog identity, tier, stats, costs and explicit magic damage for all stars", () => {
    const unit = getUnit("wisp_light");
    expect([unit.id, unit.tier, unit.role]).toEqual(["wisp_light", 3, "MAGE"]);
    expect(unit.stats).toMatchObject({
      hp: 285, atk: 27, def: 17, matk: 74, mdef: 28, range: 3, rageMax: 4,
    });
    expect(unit.skill.rageCost).toEqual([2, 3, 4]);
    expect(unit.skill.starDetailVi).toHaveLength(3);
    for (const star of [1, 2, 3]) {
      expect(skillSpec("wisp_light", star).damage).toEqual({ base: 18, scale: 0.55, stat: "matk", type: "magic" });
      expect(unit.skill.starDetailVi[star - 1]).toContain("MATK");
    }
  });

  it("1★ delivers exactly one crit-eligible damage event before knock-up then legal teleport", () => {
    const { window, sand } = firstCast(lineup(1));
    expect(sand).toHaveLength(1);
    expect(sand[0]).toMatchObject({ dst: "primary", kind: "sand", from: "wisp", crit: false });
    const statusIndex = window.findIndex((event) => event.t === "status" && event.kind === "knockup");
    const teleportIndex = window.findIndex((event) => event.t === "teleport");
    expect(statusIndex).toBeGreaterThan(window.indexOf(sand[0]!));
    expect(teleportIndex).toBeGreaterThan(statusIndex);
    const teleport = window[teleportIndex];
    if (teleport?.t !== "teleport") throw new Error("teleport event missing");
    expect(teleport.col).toBeGreaterThanOrEqual(0);
    expect(teleport.col).toBeLessThan(5);
    expect(teleport.row).toBeGreaterThanOrEqual(0);
    expect(teleport.row).toBeLessThan(5);
    expect([teleport.col, teleport.row]).not.toEqual([4, 2]);
  });

  it.each([2, 3])("%i★ splashes every orthogonal neighbor once and performs at most five independent chain hops", (star) => {
    const fighters = lineup(star);
    const byUid = new Map(fighters.map((f) => [f.uid, f]));
    const { window, sand } = firstCast(fighters);
    expect(sand).toHaveLength(9); // primary + three adjacent + five chain hops
    expect(sand.slice(0, 4).map((hit) => hit.dst)).toEqual(["primary", "right", "above", "below"]);
    for (const hit of sand.slice(1, 4)) expect(hit.from).toBe("primary");
    for (let i = 4; i < sand.length; i++) {
      const previous = sand[i - 1]!;
      const current = sand[i]!;
      expect(current.from).toBe(previous.dst);
      const a = byUid.get(previous.dst)!, b = byUid.get(current.dst)!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
    expect(new Set(sand.map((hit) => hit.dst)).size).toBeLessThan(sand.length);
    const cast = window[0];
    expect(cast.t).toBe("cast");
    if (cast.t === "cast") expect(cast.targets).toEqual(sand.map((hit) => hit.dst));
    const lastHit = window.indexOf(sand.at(-1)!);
    expect(window.findIndex((event) => event.t === "status" && event.kind === "knockup")).toBeGreaterThan(lastHit);
    expect(window.findIndex((event) => event.t === "teleport")).toBeGreaterThan(lastHit);
  });

  it("3★ petrifies exactly living units hit at least twice, after the last damage event", () => {
    const { sand, window } = firstCast(lineup(3));
    const counts = new Map<string, number>();
    for (const hit of sand) counts.set(hit.dst, (counts.get(hit.dst) ?? 0) + 1);
    const expected = [...counts].filter(([, count]) => count >= 2).map(([uid]) => uid).sort();
    const petrified = window.filter((event): event is Extract<CombatEvent, { t: "status" }> =>
      event.t === "status" && event.kind === "petrify");
    expect(expected.length).toBeGreaterThan(0);
    expect(petrified.map((event) => event.dst).sort()).toEqual(expected);
    expect(petrified.every((event) => event.turns === 1)).toBe(true);
    expect(window.indexOf(petrified[0]!)).toBeGreaterThan(window.indexOf(sand.at(-1)!));
    expect(window.filter((event) => event.t === "status" && event.kind === "knockup")).toHaveLength(1);
  });

  it("seeded role-first selection falls back when preferred role is absent, and distributes uniformly among ties", () => {
    const candidates: Record<string, number> = { mageA: 0, mageB: 0 };
    for (let seed = 1; seed <= 180; seed++) {
      const fighters = lineup(1, [
        ["mageA", 1, 5, "MAGE"], ["mageB", 3, 5, "MAGE"], ["archer", 2, 6, "ARCHER"],
      ]);
      const { sand } = firstCast(fighters, seed);
      expect(["mageA", "mageB"]).toContain(sand[0]?.dst);
      candidates[sand[0]!.dst]!++;
    }
    expect(candidates.mageA).toBeGreaterThan(55);
    expect(candidates.mageB).toBeGreaterThan(55);
    const fallback = firstCast(lineup(1, [
      ["archer", 1, 5, "ARCHER"], ["fighter", 2, 5, "FIGHTER"],
    ])).sand[0];
    expect(fallback?.dst).toBe("archer");
    expect(firstCast(lineup(1), 99).window).toEqual(firstCast(lineup(1), 99).window);
  });

  it("teleport samples all legal home-half cells without occupancy or seed drift", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 180; seed++) {
      const { window } = firstCast(lineup(1), seed);
      const destination = window.find((event) => event.t === "teleport");
      if (destination?.t !== "teleport") throw new Error("missing relocation");
      seen.add(`${destination.col},${destination.row}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(21);
    expect(seen.has("4,2")).toBe(false);
  });

  it("knock-up and petrify suppress the next victim action, expire once, and do not stack", () => {
    const fighters = lineup(3);
    const primary = fighters.find((f) => f.uid === "primary")!;
    primary.status.petrify = { turns: 1, value: 0 };
    primary.status.knockup = { turns: 1, value: 0 };
    const { result, to, window } = firstCast(fighters);
    const applied = window.filter((event): event is Extract<CombatEvent, { t: "status" }> => event.t === "status"
      && event.dst === "primary" && ["knockup", "petrify"].includes(event.kind));
    expect(applied.map((event) => event.turns)).toEqual(applied.map(() => 1));
    const after = result.events.slice(to + 1);
    const skips = after.filter((event) => event.t === "skip" && event.src === "primary"
      && ["knockup", "petrify"].includes(event.reason));
    expect(skips).toHaveLength(1);
    const cleanup = after.filter((event): event is Extract<CombatEvent, { t: "status" }> => event.t === "status" && event.dst === "primary"
      && event.turns === 0 && ["knockup", "petrify"].includes(event.kind));
    expect(cleanup.map((event) => event.kind).sort()).toEqual(["knockup", "petrify"]);
    const nextBasic = after.findIndex((event) => event.t === "basic" && event.src === "primary");
    expect(nextBasic).toBeGreaterThan(after.indexOf(skips[0]!));
    expect(result.fighters.find((f) => f.uid === "primary")!.status.petrify).toBeUndefined();
  });

  it("magic mitigation is applied once per hit while independent crits retain eligibility", () => {
    const scenario = (mdef: number, crit: number) => {
      const fighters = lineup(2);
      const caster = fighters.find((f) => f.uid === "wisp")!;
      caster.crit = crit;
      for (const enemy of fighters.filter((f) => f.side === "R")) enemy.mdef = mdef;
      return firstCast(fighters, 42).sand;
    };
    const plain = scenario(0, 0), mitigated = scenario(160, 0), critical = scenario(160, 1);
    expect(plain).toHaveLength(9);
    expect(mitigated).toHaveLength(9);
    expect(critical).toHaveLength(9);
    expect(mitigated.every((hit, i) => hit.dmg < plain[i]!.dmg && !hit.crit)).toBe(true);
    expect(critical.every((hit, i) => hit.crit && hit.dmg > mitigated[i]!.dmg)).toBe(true);
  });
});
