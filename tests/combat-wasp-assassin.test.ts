import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getUnit } from "../src/content/catalog";
import {
  combatTargetPreview, materializeCombat, simulate,
  type CombatEvent, type Fighter, type Placement,
} from "../src/core/combat";
import { STAR_SKILL } from "../src/core/economy";
import { skillSpec } from "../src/core/skills";
import { playCombat } from "../src/units/combatPlayer";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";

const unit = (uid: string, baseId: string, star: number, row: number, col: number): Placement =>
  ({ uid, baseId, star, row, col });

const get = (all: Fighter[], uid: string): Fighter => all.find((fighter) => fighter.uid === uid)!;
const marks = (events: CombatEvent[]) =>
  events.filter((event): event is Extract<CombatEvent, { t: "status" }> =>
    event.t === "status" && event.kind === "waspMark");

function control(all: Fighter[]) {
  for (const fighter of all) {
    fighter.crit = 0;
    fighter.evade = 0;
    fighter.accuracy = 1;
    fighter.rageMax = 1000;
    fighter.rage = 0;
    fighter.onHitBurn = 0;
    fighter.onHitPoison = 0;
    fighter.def = 0;
  }
}

function focusBattle(star: number, withAllies = false) {
  const left = [
    unit("wasp", "wasp_assassin", star, 0, 4),
    ...(withAllies
      ? [unit("ally-a", "titan_earth", 1, 1, 4), unit("ally-b", "titan_earth", 1, 2, 4)]
      : []),
  ];
  const all = materializeCombat(left, [
    unit("victim", "titan_earth", 1, 0, 5),
    unit("marked", "beetle_mystic", 1, 1, 5),
  ]);
  control(all);
  get(all, "victim").hp = 1;
  get(all, "marked").maxHp = 100_000;
  get(all, "marked").hp = withAllies ? 110 : 100_000;
  get(all, "marked").atk = 1;
  if (withAllies) {
    for (const uid of ["ally-a", "ally-b"]) {
      const ally = get(all, uid);
      ally.atk = 70;
      ally.hp = ally.maxHp - 130;
    }
  } else {
    get(all, "wasp").maxHp = get(all, "wasp").hp = 100_000;
  }
  return all;
}

describe("issue #112 — wasp assassin focus mark", () => {
  it("keeps all three authored damage formulas, types, rage costs, and unit identity unchanged", () => {
    const catalog = getUnit("wasp_assassin");
    expect([catalog.id, catalog.tier, catalog.role, catalog.stats.hp, catalog.stats.atk])
      .toEqual(["wasp_assassin", 4, "ASSASSIN", 290, 86]);
    expect(catalog.skill.rageCost).toEqual([1, 2, 3]);
    for (const star of [1, 2, 3]) {
      const spec = skillSpec("wasp_assassin", star);
      expect(spec.damage).toEqual({ base: 40, scale: 1.5, stat: "atk", type: "physical" });
      expect(spec.area).toBe("single");
      expect(spec.count).toBe(1);
    }
  });

  it("1★ marks on lethal contact; allies focus it regardless of distance, without a payout", () => {
    const result = simulate(focusBattle(1, true), { seed: 17 });
    const first = marks(result.events)[0]!;
    expect(first).toMatchObject({ dst: "marked", turns: 2, source: { unitBaseId: "wasp_assassin", unitStar: 1 } });
    const hitIndex = result.events.findIndex((event) =>
      event.t === "basic" && event.src === "wasp" && event.dst === "victim");
    const deathIndex = result.events.findIndex((event) => event.t === "death" && event.dst === "victim");
    const markIndex = result.events.indexOf(first);
    const allyIndex = result.events.findIndex((event) => event.t === "basic" && event.src === "ally-a");
    expect(hitIndex).toBeLessThan(deathIndex);
    expect(deathIndex).toBeLessThan(markIndex);
    expect(markIndex).toBeLessThan(allyIndex);
    expect(result.events[allyIndex]).toMatchObject({ dst: "marked" });
    expect(result.events.filter((event) => event.t === "heal" || event.t === "rage")).toEqual([]);
  });

  for (const star of [2, 3]) {
    it(`${star}★ pays each distinct living contributor once after marked death, never recursively`, () => {
      const all = focusBattle(star, true);
      const initialHealth = new Map(["ally-a", "ally-b"].map((uid) => [uid, get(all, uid).hp]));
      const result = simulate(all, { seed: 33 });
      const killedAt = result.events.findIndex((event) => event.t === "death" && event.dst === "marked");
      expect(killedAt).toBeGreaterThan(0);
      const hits = result.events.filter((event): event is Extract<CombatEvent, { t: "basic" | "skill" }> =>
        event.t === "basic" && event.dst === "marked" && (event.src === "ally-a" || event.src === "ally-b"));
      expect(hits.map((event) => event.src)).toEqual(["ally-a", "ally-b"]);
      expect(marks(result.events).filter((event) => event.turns === 0)).toHaveLength(1);
      const heals = result.events.filter((event): event is Extract<CombatEvent, { t: "heal" }> => event.t === "heal" && event.src.startsWith("ally-"));
      expect(heals.map((event) => event.dst)).toEqual(["ally-a", "ally-b"]);
      for (const event of heals) {
        const inflicted = hits.find((hit) => hit.src === event.src)!;
        expect(event.amount).toBeGreaterThan(0);
        expect(event.amount).toBeLessThanOrEqual(inflicted.dmg);
        expect(initialHealth.get(event.src)).toBeLessThan(get(all, event.src).maxHp);
      }
      expect(result.events.indexOf(heals[0]!)).toBeGreaterThan(killedAt);
      const rage = result.events.filter((event) => event.t === "rage");
      expect(rage.map((event) => event.dst)).toEqual(star === 3 ? ["ally-a", "ally-b"] : []);
      expect(rage.every((event) => event.t === "rage" && event.amount === 1)).toBe(true);
      expect(result.events.filter((event) => event.t === "death" && event.dst === "marked")).toHaveLength(1);
    });
  }

  it("selects mark targets by role before proximity and keeps the nearest within that role", () => {
    const all = materializeCombat(
      [unit("wasp", "wasp_assassin", 1, 0, 4)],
      [unit("victim", "titan_earth", 1, 0, 5),
        unit("near-tank", "titan_earth", 1, 1, 5),
        unit("far-mage", "beetle_mystic", 1, 4, 9),
        unit("near-mage", "beetle_mystic", 1, 2, 5)],
    );
    control(all);
    get(all, "victim").hp = 1;
    for (const uid of ["near-tank", "near-mage", "far-mage"]) {
      const f = get(all, uid);
      f.maxHp = f.hp = 100_000;
      f.atk = 1;
    }
    const result = simulate(all, { seed: 6 });
    expect(marks(result.events)[0]!.dst).toBe("near-mage");
  });

  it("uniformly and reproducibly samples equal-role, equal-distance ties using seeded gameplay RNG", () => {
    const chosen = { above: 0, below: 0 };
    for (let seed = 1; seed <= 160; seed++) {
      const make = () => {
        const all = materializeCombat(
          [unit("wasp", "wasp_assassin", 1, 2, 4)],
          [unit("victim", "titan_earth", 1, 2, 5),
            unit("above", "beetle_mystic", 1, 1, 5),
            unit("below", "beetle_mystic", 1, 3, 5)],
        );
        control(all);
        get(all, "victim").hp = 1;
        for (const uid of ["above", "below"]) {
          const f = get(all, uid);
          f.maxHp = f.hp = 100_000;
          f.atk = 1;
        }
        return all;
      };
      const a = marks(simulate(make(), { seed }).events)[0]?.dst;
      const b = marks(simulate(make(), { seed }).events)[0]?.dst;
      expect(a).toBe(b);
      expect(a === "above" || a === "below").toBe(true);
      chosen[a as keyof typeof chosen]++;
    }
    expect(chosen.above).toBeGreaterThan(55);
    expect(chosen.below).toBeGreaterThan(55);
  });

  it("expires at the end of the next shared cycle, with inspection cleanup", () => {
    const all = focusBattle(1);
    const result = simulate(all, { seed: 5, captureInspection: true });
    expect(marks(result.events).map((event) => event.turns)).toEqual([2, 0]);
    const first = marks(result.events)[0]!;
    const expired = marks(result.events)[1]!;
    const cycle2 = result.events.findIndex((event) => event.t === "cycle" && event.cycle === 2);
    const cycle3 = result.events.findIndex((event) => event.t === "cycle" && event.cycle === 3);
    expect(result.events.indexOf(first)).toBeLessThan(cycle2);
    expect(result.events.indexOf(expired)).toBeGreaterThan(cycle2);
    expect(result.events.indexOf(expired)).toBeLessThan(cycle3);
    const atTwo = result.inspectionFrames!.find((frame) =>
      frame.cycle === 2 && frame.units.some((f) => f.uid === "marked" && f.status.waspMark?.turns === 1));
    const atThree = result.inspectionFrames!.find((frame) =>
      frame.cycle === 3 && frame.units.some((f) => f.uid === "marked" && !f.status.waspMark));
    expect(atTwo).toBeDefined();
    expect(atThree).toBeDefined();
    expect(combatTargetPreview(result.fighters, "wasp")?.skillCasterUid).toBeNull();
  });

  it("refreshes the same mark rather than stacking, then cleans up once", () => {
    const all = materializeCombat(
      [unit("first", "wasp_assassin", 1, 0, 4), unit("second", "wasp_assassin", 1, 1, 4)],
      [unit("victim-a", "titan_earth", 1, 0, 5),
        unit("victim-b", "titan_earth", 1, 1, 5),
        unit("focus", "beetle_mystic", 1, 2, 5)],
    );
    control(all);
    get(all, "victim-a").hp = 1;
    get(all, "victim-b").hp = 120;
    get(all, "focus").maxHp = get(all, "focus").hp = 100_000;
    get(all, "focus").atk = 1;
    get(all, "second").status.taunt = { turns: 3, value: 0 };
    get(all, "second").tauntBy = "victim-b";
    const result = simulate(all, { seed: 9 });
    const applied = marks(result.events).filter((event) => event.turns > 0);
    expect(applied.map((event) => event.dst)).toEqual(["focus", "focus"]);
    expect(marks(result.events).filter((event) => event.turns === 0)).toHaveLength(1);
    const current = get(result.fighters, "focus");
    expect(current.status.waspMark).toBeUndefined();
    expect(result.events.filter((event) => event.t === "death" && event.dst === "victim-b")).toHaveLength(1);
  });

  for (const star of [1, 2, 3]) {
    it(`${star}★ keeps the authored single-hit physical formula, armor mitigation and crit eligibility`, () => {
      function strikeWith(def: number, crit: number) {
        const all = materializeCombat(
          [unit("wasp", "wasp_assassin", star, 0, 4)],
          [unit("target", "titan_earth", 1, 0, 5)],
        );
        control(all);
        const wasp = get(all, "wasp");
        const target = get(all, "target");
        wasp.rageMax = wasp.rage = getUnit("wasp_assassin").skill.rageCost[star - 1]!;
        wasp.crit = crit;
        wasp.element = target.element;
        target.role = wasp.role;
        target.def = def;
        target.maxHp = target.hp = 100_000;
        target.atk = 1;
        const raw = Math.round((40 + 1.5 * wasp.atk) * STAR_SKILL[star]!);
        const result = simulate(all, { seed: 15 });
        const from = result.events.findIndex((event) => event.t === "cast" && event.src === "wasp");
        const next = result.events.slice(from + 1).find((event) => event.t === "skill" && event.src === "wasp");
        const firstCast = result.events.slice(from + 1, result.events.findIndex((event, i) => i > from && event.t === "cast" && event.src === "wasp"));
        return { next, raw, firstCast };
      }
      const full = strikeWith(0, 0);
      const armored = strikeWith(100, 0);
      const critical = strikeWith(100, 1);
      expect(full.next).toMatchObject({ t: "skill", dst: "target", crit: false, dmg: full.raw });
      expect(armored.next).toMatchObject({ crit: false, dmg: Math.round(full.raw * 100 / 200) });
      expect(critical.next).toMatchObject({ crit: true, dmg: Math.round(full.raw * 1.5) });
      expect(full.firstCast.filter((event) => event.t === "skill" && event.src === "wasp")).toHaveLength(1);
    });
  }

  it("defers the canonical skill damage and death/mark visualization until the rig impact", () => {
    const all = materializeCombat(
      [unit("wasp", "wasp_assassin", 1, 0, 4)],
      [unit("victim", "beetle_mystic", 1, 0, 5), unit("focus", "titan_earth", 1, 1, 5)],
    );
    control(all);
    const wasp = get(all, "wasp");
    wasp.rageMax = wasp.rage = 1;
    get(all, "victim").hp = 1;
    get(all, "focus").hp = get(all, "focus").maxHp = 100_000;
    const roster = all.map((f) => ({
      uid: f.uid, baseId: f.baseId, star: f.star, side: f.side,
      hp: f.hp, maxHp: f.maxHp, rage: f.rage, rageMax: f.rageMax, shield: f.shield,
    }));
    const result = simulate(all, { seed: 4 });
    const start = result.events.findIndex((event) => event.t === "cast" && event.src === "wasp");
    const markAt = result.events.findIndex((event) => event.t === "status" && event.kind === "waspMark");
    expect(markAt).toBeGreaterThan(start);
    const events = result.events.slice(start, markAt + 1);
    expect(events.filter((event) => event.t === "skill" && event.src === "wasp")).toHaveLength(1);
    const seen: CombatEvent[] = [];
    const visuals = new Map(roster.map((f) => [f.uid, {
      root: new THREE.Object3D(),
      anchor: new THREE.Object3D(),
      play: (_kind: string, options?: { onImpact?: () => void; onDone?: () => void }) => {
        if (f.uid === "wasp" && _kind === "skill") impact = options;
      },
      die: () => { seenVisual.push(`death:${f.uid}`); },
      setFacing: () => {},
    }]));
    let impact: { onImpact?: () => void; onDone?: () => void } | undefined;
    let frame: ((dt: number) => void) | undefined;
    const seenVisual: string[] = [];
    const board = {
      visual: (uid: string) => visuals.get(uid),
      flashSkill: () => {}, flashTile: () => {}, setCombatBorder: () => {},
      setTurnIndicator: () => {}, setActorHighlight: () => {},
      setLive: (_uid: string, state: { statuses: { key: string }[] }) => {
        if (state.statuses.some((s) => s.key === "waspMark")) seenVisual.push("mark:visible");
      },
    } as unknown as BoardView;
    const fx = {
      update: () => {}, float: () => {}, burst: () => {},
    } as unknown as CombatFx;
    const player = playCombat({
      board, fx, roster, events, onTick: () => {},
      onEvent: (event) => { seen.push(event); },
      onFrame: (callback) => { frame = callback; return () => {}; },
    });
    for (let i = 0; i < 5; i++) frame!(0.1);
    expect(impact?.onImpact).toBeTypeOf("function");
    expect(seen.filter((event) => event.t === "skill" || event.t === "death" || event.t === "status")).toEqual([]);
    impact!.onImpact!();
    expect(seen.filter((event) => event.t === "skill")).toHaveLength(1);
    expect(seenVisual).not.toContain("mark:visible");
    impact!.onDone!();
    for (let i = 0; i < 20; i++) frame!(0.1);
    expect(seen.filter((event) => event.t === "status" && event.kind === "waspMark")).toHaveLength(1);
    expect(seenVisual).toContain("mark:visible");
    expect(seenVisual.indexOf("death:victim")).toBeLessThan(seenVisual.indexOf("mark:visible"));
    player.dispose();
  });
});
