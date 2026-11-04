import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import { skillSpec } from "../src/core/skills";
import { materializeCombat, simulate, type CombatEvent, type Fighter } from "../src/core/combat";

const kiss = (e: CombatEvent) => e.t === "skill" && e.src === "bat" && e.kind === "kiss";
const batling = (e: CombatEvent) => e.t === "skill" && e.src === "bat" && e.kind === "batling";

function roster(star: number, enemyCount = 3): Fighter[] {
  const all = materializeCombat(
    [{ uid: "bat", baseId: "bat_blood", star, row: 0, col: 0 }],
    Array.from({ length: enemyCount }, (_, i) => ({
      uid: `foe${i}`, baseId: "titan_earth", star: 1, row: i % 5, col: 5 + Math.floor(i / 5),
    })),
  );
  const source = all[0]!;
  source.rage = source.rageMax = 1; // Isolate the first two consecutive casts.
  source.hp = source.maxHp = 1e6;
  source.crit = 0;
  for (const enemy of all.slice(1)) {
    enemy.role = "MAGE"; // All hits have the same role matchup by default.
    enemy.hp = enemy.maxHp = 100_000;
    enemy.mdef = 0;
    enemy.matk = enemy.atk = 1;
    enemy.rage = 0;
    enemy.rageMax = 1e6; // No enemy skill recasts in these deterministic fixtures.
  }
  return all;
}

function firstCastEvents(events: CombatEvent[]): CombatEvent[] {
  const first = events.findIndex((e) => e.t === "cast" && e.src === "bat");
  const next = events.findIndex((e, i) => i > first && e.t === "cast" && e.src === "bat");
  return events.slice(first, next < 0 ? undefined : next);
}

describe("Dơi Tình Yêu — Hôn & Dơi Con (issue #91)", () => {
  it("retains authored damage, costs, stats and Tier 1 identity", () => {
    const unit = getUnit("bat_blood");
    expect([unit.nameVi, unit.tier, unit.role, unit.faction, unit.element]).toEqual([
      "Dơi Tình Yêu", 1, "MAGE", "BEAST", "NIGHT",
    ]);
    expect([unit.stats.hp, unit.stats.atk, unit.stats.def, unit.stats.matk, unit.stats.mdef, unit.stats.range, unit.stats.evade])
      .toEqual([300, 22, 11, 90, 24, 4, 0.1]);
    expect(unit.skill.rageCost).toEqual([3, 4, 5]);
    expect(unit.skill.family).toBe("love_kiss_batlings");
    for (const star of [1, 2, 3]) {
      const skill = skillSpec("bat_blood", star);
      expect(skill.damage).toEqual({ base: 18, scale: 0.75, stat: "matk", type: "magic" });
      expect([skill.side, skill.area, skill.count, skill.selector]).toEqual([
        "enemy", "single", star, "highest_current_hp_role",
      ]);
      expect(skill.controls).toEqual([{ kind: "stun", turns: 1, chance: 1 }]);
      expect(skill.debuffs).toEqual([]);
      expect(skill.selfHealPctMaxHp).toBe(0);
    }
  });

  for (const star of [1, 2, 3]) {
    it(`${star}★: kisses ${star} distinct targets with full, half, two-thirds base damage`, () => {
      const events = firstCastEvents(simulate(roster(star, 3), { seed: 4 }).events);
      const cast = events.find((e) => e.t === "cast" && e.src === "bat");
      expect(cast?.t === "cast" ? cast.targets : []).toHaveLength(star);
      const hits = events.filter(kiss);
      expect(hits).toHaveLength(star);
      const victims = hits.map((e) => e.t === "skill" ? e.dst : "");
      expect(new Set(victims).size).toBe(star);
      expect(events.filter(batling)).toHaveLength(0);
      const damage = hits.map((e) => e.t === "skill" ? e.dmg : 0);
      // The game rounds base damage and each subhit separately before applying mitigation.
      if (star >= 2) expect(Math.abs(damage[1]! - damage[0]! / 2)).toBeLessThanOrEqual(1);
      if (star >= 3) expect(Math.abs(damage[2]! - damage[0]! * 2 / 3)).toBeLessThanOrEqual(1);
      expect(events.filter((e) => e.t === "status" && e.kind === "stun").map((e) => e.t === "status" ? e.dst : ""))
        .toEqual(victims);
    });
  }

  it("selects role before current HP, then highest current HP within each role", () => {
    const fighters = roster(3, 4);
    const [, a, b, c, d] = fighters;
    a!.role = "TANKER"; a!.hp = 99_000;
    b!.role = "MAGE"; b!.hp = 40_000;
    c!.role = "MAGE"; c!.hp = 60_000;
    d!.role = "ARCHER"; d!.hp = 90_000;
    const events = firstCastEvents(simulate(fighters, { seed: 3 }).events);
    const cast = events.find((e) => e.t === "cast" && e.src === "bat");
    expect(cast?.t === "cast" ? cast.targets : []).toEqual(["foe2", "foe1", "foe3"]);
  });

  it("summons at the second landed kiss only, at most five unique other enemies", () => {
    const fighters = roster(1, 7);
    fighters[1]!.role = "MAGE";
    for (const enemy of fighters.slice(2)) enemy.role = "TANKER";
    const events = simulate(fighters, { seed: 7 }).events;
    const kisses = events.map((e, index) => kiss(e) && e.t === "skill" && e.dst === "foe0" ? index : -1).filter((i) => i >= 0);
    expect(kisses.length).toBeGreaterThanOrEqual(2);
    const first = events.slice(0, kisses[0]! + 1);
    expect(first.filter(batling)).toHaveLength(0);
    const nextCast = events.findIndex((e, i) => i > kisses[1]! && e.t === "cast" && e.src === "bat");
    const second = events.slice(kisses[1]!, nextCast < 0 ? undefined : nextCast);
    const bats = second.filter(batling);
    expect(bats).toHaveLength(5);
    const victims = bats.map((e) => e.t === "skill" ? e.dst : "");
    expect(new Set(victims).size).toBe(5);
    expect(victims).not.toContain("foe0");
    expect(second.filter((e) => e.t === "status" && e.kind === "stun"))
      .toHaveLength(1); // Batlings cannot reapply stun or recursively count as kisses.
    expect(second.filter(kiss)).toHaveLength(1);
  });

  for (const count of [1, 2]) {
    it(`summons exactly ${count - 1} batlings if only ${count} enemy targets exist`, () => {
      const fighters = roster(1, count);
      fighters[1]!.role = "MAGE";
      const events = simulate(fighters, { seed: 5 }).events;
      const twice = events.map((e, i) => kiss(e) && e.t === "skill" && e.dst === "foe0" ? i : -1)
        .filter((i) => i >= 0);
      expect(twice.length).toBeGreaterThanOrEqual(2);
      const nextCast = events.findIndex((e, i) => i > twice[1]! && e.t === "cast" && e.src === "bat");
      expect(events.slice(twice[1]!, nextCast < 0 ? undefined : nextCast).filter(batling))
        .toHaveLength(count - 1);
    });
  }

  it("batling target selection is seed-driven, uniform across the eligible pool", () => {
    const omissions = new Map<string, number>();
    for (let seed = 1; seed <= 90; seed++) {
      const fighters = roster(1, 7);
      fighters[1]!.role = "MAGE";
      for (const enemy of fighters.slice(2)) enemy.role = "TANKER";
      const events = simulate(fighters, { seed }).events;
      const indexes = events.map((e, i) => kiss(e) && e.t === "skill" && e.dst === "foe0" ? i : -1).filter((i) => i >= 0);
      const next = events.findIndex((e, i) => i > indexes[1]! && e.t === "cast" && e.src === "bat");
      const selected = new Set(events.slice(indexes[1]!, next < 0 ? undefined : next)
        .filter(batling).map((e) => e.t === "skill" ? e.dst : ""));
      expect(selected.size).toBe(5);
      const omitted = fighters.slice(2).find((enemy) => !selected.has(enemy.uid))!.uid;
      omissions.set(omitted, (omissions.get(omitted) ?? 0) + 1);
    }
    expect(omissions.size).toBe(6);
    for (const frequency of omissions.values()) expect(frequency).toBeGreaterThan(3);
  });

  it("one action is stunned and then the status expires without a round-boundary leak", () => {
    const fighters = roster(1, 1);
    fighters[0]!.rageMax = 3;
    fighters[0]!.rage = 3;
    const events = simulate(fighters, { seed: 11 }).events;
    const firstStun = events.findIndex((e) => e.t === "status" && e.kind === "stun" && e.dst === "foe0");
    expect(firstStun).toBeGreaterThanOrEqual(0);
    const secondStun = events.findIndex((e, i) => i > firstStun && e.t === "status" && e.kind === "stun" && e.dst === "foe0");
    const between = events.slice(firstStun + 1, secondStun < 0 ? undefined : secondStun);
    expect(between.filter((e) => e.t === "skip" && e.src === "foe0" && e.reason === "stun"))
      .toHaveLength(1);
    expect(between.some((e) => e.t === "basic" && e.src === "foe0")).toBe(true);
  });

  it("each hit uses magic mitigation and independently remains crit-eligible", () => {
    const damage = (mdef: number, crit: number) => {
      const fighters = roster(1, 1);
      fighters[1]!.mdef = mdef;
      fighters[0]!.crit = crit;
      const event = firstCastEvents(simulate(fighters, { seed: 2 }).events).find(kiss);
      if (!event || event.t !== "skill") throw new Error("Expected authored kiss damage");
      return event;
    };
    const noMitigation = damage(0, 0);
    const mitigated = damage(100, 0);
    const critical = damage(100, 1);
    expect(mitigated.dmg).toBeLessThan(noMitigation.dmg);
    expect(critical.crit).toBe(true);
    expect(critical.dmg).toBeGreaterThan(mitigated.dmg);
  });

  it("batling damage uses one third of original magic damage and the normal crit/mitigation pipeline", () => {
    const run = (mdef: number, crit: number) => {
      const fighters = roster(1, 3);
      fighters[1]!.hp = 100_000;
      for (const enemy of fighters.slice(2)) {
        enemy.hp = 70_000;
        enemy.mdef = mdef;
      }
      fighters[0]!.crit = crit;
      const events = simulate(fighters, { seed: 17 }).events;
      const kisses = events.map((e, i) => kiss(e) && e.t === "skill" && e.dst === "foe0" ? i : -1)
        .filter((i) => i >= 0);
      const nextCast = events.findIndex((e, i) => i > kisses[1]! && e.t === "cast" && e.src === "bat");
      const bats = events.slice(kisses[1]!, nextCast < 0 ? undefined : nextCast).filter(batling);
      expect(bats).toHaveLength(2);
      if (bats.some((e) => e.t !== "skill")) throw new Error("Expected batling damage events");
      return { bats, kiss: events[kisses[0]!] };
    };
    const normal = run(0, 0);
    const defended = run(120, 0);
    const critical = run(120, 1);
    if (!normal.kiss || normal.kiss.t !== "skill") throw new Error("Missing primary kiss");
    // Identical target roles/defenses: only per-hit integer rounding may differ.
    for (const event of normal.bats) {
      if (event.t !== "skill") throw new Error("Missing batling event");
      expect(Math.abs(event.dmg - normal.kiss.dmg / 3)).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < normal.bats.length; i++) {
      const a = normal.bats[i]!;
      const b = defended.bats[i]!;
      const c = critical.bats[i]!;
      if (a.t !== "skill" || b.t !== "skill" || c.t !== "skill") throw new Error("Missing batling hit");
      expect(a.dmg).toBeGreaterThan(0);
      expect(b.dmg).toBeLessThan(a.dmg);
      expect(c.crit).toBe(true);
      expect(c.dmg).toBeGreaterThan(b.dmg);
    }
  });

  it("records direct damage events in impact order with distinct kiss and batling identities", () => {
    const fighters = roster(1, 3);
    fighters[1]!.role = "MAGE";
    for (const enemy of fighters.slice(2)) enemy.role = "TANKER";
    const events = simulate(fighters, { seed: 15 }).events;
    const secondKiss = events.map((e, i) => kiss(e) ? i : -1).filter((i) => i >= 0)[1]!;
    expect(events[secondKiss]).toMatchObject({ t: "skill", kind: "kiss", src: "bat", dst: "foe0" });
    expect(events[secondKiss + 1]).toMatchObject({ t: "status", dst: "foe0", kind: "stun" });
    expect(events.slice(secondKiss + 2, secondKiss + 4).every(batling)).toBe(true);
  });
});
