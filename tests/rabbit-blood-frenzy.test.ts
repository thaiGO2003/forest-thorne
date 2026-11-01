import { describe, expect, it } from "vitest";
import { getUnit, NORMAL_UNITS } from "../src/content/catalog";
import { FRENZY_FAMILY, skillSpec } from "../src/core/skills";
import {
  FRENZY_ATK_PCT, FRENZY_DEF_PCT, FRENZY_LIFESTEAL, FRENZY_MDEF_PCT, FRENZY_TURNS,
  materializeCombat, simulate, type CombatEvent, type Fighter,
} from "../src/core/combat";

type Ev<T extends CombatEvent["t"]> = Extract<CombatEvent, { t: T }>;
type Hit = Extract<CombatEvent, { t: "basic" | "skill" }>;

/** Huyết Thố (L) against a passive ant guard (R) that never applies debuffs; both very durable. */
function duel(star: 1 | 2 | 3, setup: (rabbit: Fighter) => void = () => {}) {
  const all = materializeCombat(
    [{ uid: "rabbit", baseId: "rabbit_blood", star, row: 2, col: 4 }],
    [{ uid: "foe", baseId: "ant_guard", star: 1, row: 2, col: 5 }],
  );
  for (const f of all) { f.maxHp = 1e6; f.hp = 1e6; }
  const rabbit = all.find((f) => f.uid === "rabbit")!;
  rabbit.hp = 1e5; // room to heal, so lifesteal is never capped
  rabbit.rage = rabbit.rageMax;
  setup(rabbit);
  return { all, result: simulate(all, { seed: 4, captureInspection: true }) };
}

const preCursed = (rabbit: Fighter) => {
  rabbit.status.poison = { turns: 4, value: 5 };
  rabbit.status.burn = { turns: 4, value: 5 };
  rabbit.mods.push({ stat: "def", value: -10, pct: false, turns: 6 });
};

describe("Huyết Thố catalog", () => {
  it("adds a tier 2 night-beast fighter inside the T2 fighter budget", () => {
    const u = getUnit("rabbit_blood");
    expect([u.nameVi, u.tier, u.role, u.faction, u.element, u.boss]).toEqual(["Huyết Thố", 2, "FIGHTER", "BEAST", "NIGHT", false]);
    expect([u.stats.hp, u.stats.atk, u.stats.def, u.stats.mdef, u.stats.range]).toEqual([320, 72, 18, 15, 1]);
    expect([u.basic.delivery, u.basic.damageType]).toEqual(["melee", "physical"]);
    expect([u.skill.nameVi, u.skill.family, u.skill.rageCost]).toEqual(["Huyết Nộ Bộc Phá", FRENZY_FAMILY, [2, 3, 4]]);
    expect(u.skill.starDetailVi).toHaveLength(3);
    expect(NORMAL_UNITS.some((x) => x.id === "rabbit_blood")).toBe(true);
    // build-game-units budget: T2 FIGHTER eHP 317×1.18, OFF 70×1.01 → N, O inside the warn band.
    const ehp = u.stats.hp * (1 + (u.stats.def + u.stats.mdef) / 200);
    expect(ehp / (317 * 1.18)).toBeGreaterThan(0.85);
    expect(ehp / (317 * 1.18)).toBeLessThan(1.2);
    expect(u.stats.atk / (70 * 1.01)).toBeGreaterThan(0.85);
    expect(u.stats.atk / (70 * 1.01)).toBeLessThan(1.2);
  });

  it("keeps only the burst formula in the parsed spec; the frenzy is engine-owned", () => {
    for (const star of [1, 2, 3]) {
      const sp = skillSpec("rabbit_blood", star);
      expect(sp.damage).toEqual({ base: 20, scale: 1, stat: "atk", type: "physical" });
      expect([sp.side, sp.area, sp.selector, sp.buffs, sp.debuffs, sp.lifestealPct]).toEqual(["enemy", "single", "frontline_default", [], [], 0]);
    }
    expect([FRENZY_TURNS.slice(1), FRENZY_LIFESTEAL.slice(1)]).toEqual([[2, 2, 3], [0.6, 0.8, 1]]);
  });
});

describe("Huyết Nộ Bộc Phá in combat", () => {
  it("bursts the basic target, then sacrifices defence for attack while frenzied", () => {
    const { result } = duel(1);
    const ev = result.events;
    const cast = ev.findIndex((e) => e.t === "cast" && e.src === "rabbit");
    expect(ev[cast]).toMatchObject({ t: "cast", src: "rabbit", targets: ["foe"] });
    expect(ev[cast + 1]).toMatchObject({ t: "skill", src: "rabbit", dst: "foe" });
    const frame = result.inspectionFrames!.find((f) => f.eventIndex > cast)!;
    const mods = frame.units.find((u) => u.uid === "rabbit")!.mods;
    expect(mods).toEqual(expect.arrayContaining([
      expect.objectContaining({ stat: "def", value: FRENZY_DEF_PCT, pct: true }),
      expect.objectContaining({ stat: "mdef", value: FRENZY_MDEF_PCT, pct: true }),
      expect.objectContaining({ stat: "atk", value: FRENZY_ATK_PCT, pct: true }),
    ]));
  });

  it("heals the frenzied rabbit by the star lifesteal share of every basic hit", () => {
    for (const star of [1, 3] as const) {
      const ev = duel(star).result.events;
      const cast = ev.findIndex((e) => e.t === "cast" && e.src === "rabbit");
      const hit = ev.findIndex((e, i) => i > cast && e.t === "basic" && e.src === "rabbit");
      const dealt = (ev[hit] as Hit).dmg - (ev[hit] as Hit).absorbed;
      const heal = ev.slice(hit + 1).find((e): e is Ev<"heal"> => e.t === "heal" && e.dst === "rabbit")!;
      expect(heal.amount).toBe(Math.min(1e6, Math.round(dealt * FRENZY_LIFESTEAL[star]!)));
    }
  });

  it("locks existing debuffs on cast and returns the oldest after each basic, the rest on expiry", () => {
    const ev = duel(1, preCursed).result.events;
    const cast = ev.findIndex((e) => e.t === "cast" && e.src === "rabbit");
    const lock = ev.findIndex((e, i) => i > cast && e.t === "curse" && e.dst === "rabbit");
    expect(ev[lock]).toEqual({ t: "curse", dst: "rabbit", locked: 3, released: [] });
    // The billboard is told the locked statuses ended.
    const cleared = ev.slice(cast, lock).filter((e): e is Ev<"status"> => e.t === "status" && e.dst === "rabbit" && e.turns === 0);
    expect(cleared.map((e) => e.kind).sort()).toEqual(["burn", "poison"]);

    // Only this frenzy: stop at the rabbit's next cast (its rage refills and it frenzies again).
    const nextCast = ev.findIndex((e, i) => i > cast && e.t === "cast" && e.src === "rabbit");
    const end = nextCast < 0 ? ev.length : nextCast;
    const releases = ev.map((e, i) => [e, i] as const).filter(([e, i]) => i > lock && i < end && e.t === "curse" && e.dst === "rabbit")
      .map(([e, i]) => ({ i, released: (e as Ev<"curse">).released, locked: (e as Ev<"curse">).locked }));
    expect(releases.map((r) => r.released)).toEqual([["poison"], ["burn", "defDown"]]);
    expect(releases.at(-1)!.locked).toBe(0);

    // The first release follows a basic attack by the rabbit.
    // (its lifesteal heal sits between the hit and the release)
    const before = ev.slice(lock, releases[0]!.i).filter((e) => "src" in e && e.src === "rabbit" && e.t !== "heal").at(-1);
    expect(before?.t).toBe("basic");
    // While locked, poison never ticks on the rabbit.
    const ticks = ev.slice(lock, releases[0]!.i).filter((e) => e.t === "dot" && e.dst === "rabbit" && e.kind === "poison");
    expect(ticks).toEqual([]);
    // After it returns, it ticks again with its remaining turns.
    expect(ev.slice(releases[0]!.i).some((e) => e.t === "dot" && e.dst === "rabbit" && e.kind === "poison")).toBe(true);
  });

  it("still lets new debuffs land normally during the frenzy and never locks its own sacrifice", () => {
    const { result } = duel(3, preCursed);
    const ev = result.events;
    const lock = ev.findIndex((e) => e.t === "curse" && e.dst === "rabbit");
    expect((ev[lock] as Ev<"curse">).locked).toBe(3); // the −30% DEF/MDEF cost is not in the queue
    const frame = result.inspectionFrames!.find((f) => f.eventIndex > lock)!;
    const rabbit = frame.units.find((u) => u.uid === "rabbit")!;
    expect(rabbit.mods.some((m) => m.stat === "def" && m.value === FRENZY_DEF_PCT)).toBe(true);
    expect(rabbit.mods.some((m) => m.stat === "def" && m.value === -10)).toBe(false); // locked
    expect(rabbit.status.poison).toBeUndefined(); // locked
  });

  it("is deterministic", () => {
    expect(duel(2, preCursed).result.events).toEqual(duel(2, preCursed).result.events);
  });
});
