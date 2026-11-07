import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getUnit } from "../src/content/catalog";
import {
  materializeCombat, simulate, type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { VIKING_BULL_FAMILY, skillSpec } from "../src/core/skills";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";

type Foe = { uid: string; row: number; col: number; role?: Fighter["role"] };

function fixture(star: number, foes: Foe[] = [{ uid: "foe", row: 0, col: 5 }]): Fighter[] {
  const left: Placement[] = [{ uid: "bull", baseId: "yak_highland", star, row: 0, col: 4 }];
  const right: Placement[] = foes.map(({ uid, row, col }) => ({
    uid, baseId: "titan_earth", star: 1, row, col,
  }));
  const fighters = materializeCombat(left, right);
  for (const fighter of fighters) {
    fighter.maxHp = fighter.hp = 100_000;
    fighter.crit = fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.onHitBurn = fighter.onHitPoison = 0;
    fighter.atk = fighter.uid === "bull" ? 100 : 1;
    fighter.rageMax = 100_000;
    fighter.rage = 0;
  }
  fighters[0]!.rage = fighters[0]!.rageMax; // Cast once, then test the following basic.
  for (const foe of foes) {
    if (foe.role) fighters.find((f) => f.uid === foe.uid)!.role = foe.role;
  }
  return fighters;
}

const opts = { seed: 24, deterministicTargeting: true, rageGain: { L: 0, R: 0 } };
function byCycle(events: CombatEvent[], cycle: number): CombatEvent[] {
  const begin = events.findIndex((e) => e.t === "cycle" && e.cycle === cycle);
  const end = events.findIndex((e, i) => i > begin && e.t === "cycle");
  return begin < 0 ? [] : events.slice(begin, end < 0 ? undefined : end);
}
function stunEvents(events: CombatEvent[], uid?: string) {
  return events.filter((e): e is Extract<CombatEvent, { t: "status" }> =>
    e.t === "status" && e.kind === "stun" && e.turns > 0
    && e.source?.skillId === VIKING_BULL_FAMILY && (!uid || e.dst === uid));
}
function retaliationSeed(star: number): number {
  for (let seed = 0; seed < 120; seed++) {
    if (stunEvents(byCycle(simulate(fixture(star), { ...opts, seed }).events, 1), "foe").length) return seed;
  }
  throw new Error("No Viking retaliation observed among 120 deterministic seeds");
}

describe("issue #113 — Bò Viking (yak_highland)", () => {
  it("keeps the unit's tier, existing stats and rage cost; exposes distinct star contracts", () => {
    const unit = getUnit("yak_highland");
    expect(unit.tier).toBe(4);
    expect(unit.role).toBe("TANKER");
    expect(unit.stats).toMatchObject({
      hp: 480, atk: 55, def: 44, matk: 17, mdef: 32, range: 1, rageMax: 4,
    });
    expect(unit.skill.rageCost).toEqual([2, 3, 4]);
    expect(unit.skill.family).toBe(VIKING_BULL_FAMILY);
    expect(unit.skill.starDetailVi).toHaveLength(3);
    for (const star of [1, 2, 3]) {
      expect(skillSpec("yak_highland", star)).toMatchObject({
        side: "self", selector: "self", damage: null, controls: [],
        viking: { nextBasicStunTurns: 1, retaliationChance: star < 2 ? 0 : 1 / 3 },
      });
      expect(skillSpec("yak_highland", star).viking?.healOnStun).toEqual(
        star === 3 ? { base: 0, scale: 1, stat: "atk" } : null,
      );
    }
  });

  it.each([1, 2, 3])("%i★ roars once and stuns on next-cycle basic impact only", (star) => {
    const fighters = fixture(star);
    fighters[0]!.skill = { ...fighters[0]!.skill, viking: { ...fighters[0]!.skill.viking!, retaliationChance: 0 } }; // Isolate charged basic.
    const result = simulate(fighters, opts);
    const first = byCycle(result.events, 1);
    const second = byCycle(result.events, 2);
    const third = byCycle(result.events, 3);
    expect(first).toContainEqual({ t: "cast", src: "bull", targets: ["bull"] });
    expect(first.filter((e) => e.t === "basic" && e.src === "bull")).toHaveLength(0);
    expect(first.filter((e) => e.t === "skill" && e.src === "bull")).toHaveLength(0);
    const hitIndex = second.findIndex((e) => e.t === "basic" && e.src === "bull");
    expect(hitIndex).toBeGreaterThan(0);
    const hit = second[hitIndex]!;
    expect(hit).toMatchObject({ dst: "foe", crit: false });
    expect(second[hitIndex + 1]).toMatchObject({
      t: "status", dst: "foe", kind: "stun", source: { skillId: VIKING_BULL_FAMILY, unitStar: star },
    });
    expect(stunEvents(first)).toHaveLength(0);
    expect(stunEvents(second, "foe")).toHaveLength(1);
    expect(second).toContainEqual({ t: "status", dst: "foe", kind: "stun", turns: 0 });
    expect(second).toContainEqual({ t: "skip", src: "foe", reason: "stun" });
    expect(stunEvents(third, "foe")).toHaveLength(0);
  });

  it("selects target by role before proximity, then falls back to the available role", () => {
    const fighters = fixture(1, [
      { uid: "tank", row: 0, col: 5, role: "TANKER" },
      { uid: "mage", row: 4, col: 7, role: "MAGE" },
    ]);
    const result = simulate(fighters, opts);
    expect(byCycle(result.events, 2).find((e) => e.t === "basic" && e.src === "bull"))
      .toMatchObject({ dst: "mage" });
    const fallback = simulate(fixture(1, [{ uid: "tank", row: 0, col: 5, role: "TANKER" }]), opts);
    expect(byCycle(fallback.events, 2).find((e) => e.t === "basic" && e.src === "bull"))
      .toMatchObject({ dst: "tank" });
  });

  it.each([1, 2, 3])("%i★ rolls one seeded 1/3 retaliation per landed incoming basic", (star) => {
    let procs = 0;
    for (let seed = 0; seed < 120; seed++) {
      const result = simulate(fixture(star), { ...opts, seed });
      const first = byCycle(result.events, 1);
      expect(first.filter((e) => e.t === "basic" && e.dst === "bull")).toHaveLength(1);
      const proc = stunEvents(first, "foe").length;
      expect(proc).toBeLessThanOrEqual(1);
      if (seed % 40 === 0) expect(result.events).toEqual(simulate(fixture(star), { ...opts, seed }).events);
      procs += proc;
    }
    if (star === 1) expect(procs).toBe(0);
    else expect(procs).toBeGreaterThan(25);
    if (star >= 2) expect(procs).toBeLessThan(55);
  });

  it("expires retaliatory stun at end of following shared cycle, not after one action", () => {
    const seed = retaliationSeed(2);
    const fighters = fixture(2);
    fighters[0]!.status.disarm = { turns: 100, value: 0 }; // Block the charged basic, not the roar.
    const result = simulate(fighters, { ...opts, seed });
    expect(stunEvents(byCycle(result.events, 1), "foe")).toMatchObject([
      { expiresAfterCycle: 2, source: { unitUid: "bull" } },
    ]);
    expect(byCycle(result.events, 2)).toContainEqual({ t: "skip", src: "foe", reason: "stun" });
    const second = byCycle(result.events, 2);
    expect(second).toContainEqual({ t: "status", dst: "foe", kind: "stun", turns: 0 });
    expect(byCycle(result.events, 3).some((e) => e.t === "skip" && e.src === "foe" && e.reason === "stun")).toBe(false);
  });

  it("3★ heals only once per new stun, using current ATK and respecting max HP", () => {
    const seed = retaliationSeed(3);
    const fighters = fixture(3);
    fighters[0]!.hp = fighters[0]!.maxHp - 200;
    fighters[0]!.atk = 75;
    fighters[0]!.status.disarm = { turns: 100, value: 0 };
    const first = byCycle(simulate(fighters, { ...opts, seed }).events, 1);
    const stunIndex = first.findIndex((e) => e.t === "status" && e.kind === "stun" && e.dst === "foe");
    expect(first[stunIndex + 1]).toEqual({ t: "heal", src: "bull", dst: "bull", amount: 75 });
    expect(first.filter((e) => e.t === "heal" && e.src === "bull")).toHaveLength(1);

    const alreadyStunned = fixture(3);
    alreadyStunned[0]!.rage = 0;
    alreadyStunned[0]!.vikingNextBasicCycle = 1;
    alreadyStunned[0]!.skill = { ...alreadyStunned[0]!.skill, viking: { ...alreadyStunned[0]!.skill.viking!, retaliationChance: 0 } };
    alreadyStunned[0]!.hp -= 200;
    alreadyStunned[1]!.status.stun = { turns: 10, value: 0 };
    const events = byCycle(simulate(alreadyStunned, opts).events, 1);
    expect(events.some((e) => e.t === "basic" && e.src === "bull")).toBe(true);
    expect(stunEvents(events, "foe")).toHaveLength(0);
    expect(events.filter((e) => e.t === "heal" && e.src === "bull")).toHaveLength(0);
  });

  it.each([0, 1])("charged basic retains normal armor, shield, damage and crit (%i)", (crit) => {
    function run(charged: boolean) {
      const fighters = fixture(1);
      fighters[0]!.rage = 0;
      fighters[0]!.vikingNextBasicCycle = charged ? 1 : undefined;
      fighters[0]!.crit = crit;
      fighters[1]!.def = 100;
      fighters[1]!.shield = 500;
      return byCycle(simulate(fighters, opts).events, 1);
    }
    const normal = run(false), charged = run(true);
    const normalHit = normal.find((e) => e.t === "basic" && e.src === "bull");
    const chargedHit = charged.find((e) => e.t === "basic" && e.src === "bull");
    expect(chargedHit).toEqual(normalHit);
    expect(chargedHit).toMatchObject({ crit: !!crit, absorbed: expect.any(Number) });
    expect(stunEvents(normal)).toHaveLength(0);
    expect(stunEvents(charged, "foe")).toHaveLength(1);
    expect(charged.filter((e) => e.t === "basic" && e.src === "bull")).toHaveLength(1);
  });
});

describe("Bò Viking visual timing", () => {
  it("replays stun and its heal at the exact basic impact, then emits stun VFX once", () => {
    let frame: (dt: number) => void = () => {};
    let impact: (() => void) | undefined;
    const observed: CombatEvent[] = [];
    const bursts: number[] = [];
    const visual = (uid: string) => {
      const anchor = new THREE.Group();
      anchor.position.set(uid === "bull" ? 0 : 2, 1, 0);
      anchor.updateMatrixWorld(true);
      return {
        anchor, root: anchor, setFacing: () => {},
        play: (state: string, options?: { onImpact?: () => void }) => {
          if (uid === "bull" && state === "attack") impact = options?.onImpact;
        },
      };
    };
    const visuals = new Map([["bull", visual("bull")], ["foe", visual("foe")]]);
    const board = {
      visual: (uid: string) => visuals.get(uid),
      setLive: () => {}, slot: () => null, flashTile: () => {},
      setTurnIndicator: () => {}, setActorHighlight: () => {}, setCombatBorder: () => {},
    } as unknown as BoardView;
    const fx = {
      burst: (_at: THREE.Vector3, color: number) => { bursts.push(color); },
      float: () => {}, shot: () => {}, jolt: () => {}, update: () => {}, dispose: () => {},
    } as unknown as CombatFx;
    const roster: RosterEntry[] = [
      { uid: "bull", baseId: "yak_highland", star: 3, side: "L", hp: 80, maxHp: 100, rage: 0, rageMax: 4, shield: 0 },
      { uid: "foe", baseId: "titan_earth", star: 1, side: "R", hp: 100, maxHp: 100, rage: 0, rageMax: 4, shield: 0 },
    ];
    const events: CombatEvent[] = [
      { t: "basic", src: "bull", dst: "foe", dmg: 10, absorbed: 0, crit: false },
      { t: "status", dst: "foe", kind: "stun", turns: 1,
        source: { skillId: VIKING_BULL_FAMILY, unitUid: "bull", unitBaseId: "yak_highland", unitStar: 3, turns: 1, value: 0 } },
      { t: "heal", src: "bull", dst: "bull", amount: 20 },
    ];
    const player = playCombat({ board, fx, roster, events,
      onFrame: (fn) => { frame = fn; return () => {}; }, onTick: () => {},
      onEvent: (event) => { observed.push(event); },
    });
    for (let i = 0; i < 60 && !impact; i++) frame(1);
    expect(impact).toBeDefined();
    expect(observed).toHaveLength(0);
    impact?.();
    impact?.();
    expect(observed).toEqual(events);
    expect(bursts).toContain(0x6daeff);
    player.dispose();
  });
});
