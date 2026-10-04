import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import type { CombatEvent, Placement } from "../src/core/combat";
import {
  type BasicCombatEvent,
  basicActionPattern,
  combatActionTiming,
  stageBasicCombatEvent,
  stageBasicCombatEvents,
} from "../src/core/combatStaging";
import {
  getCombatDurationMultiplier,
  getGameSpeedDisplayMultiplier,
  normalizeGameSpeedLevel,
} from "../src/core/gameSpeed";

const melee = NORMAL_UNITS.find((u) => u.basic.delivery === "melee" && u.role !== "ASSASSIN")!;
const assassin = NORMAL_UNITS.find((u) => u.basic.delivery === "melee" && u.role === "ASSASSIN")!;
const ranged = NORMAL_UNITS.find((u) => u.basic.delivery !== "melee")!;

const placement = (uid: string, baseId: string, row = 2, col = 4): Placement => ({
  uid,
  baseId,
  star: 1,
  row,
  col,
});

const basic = (src: string, dst = "target"): Extract<BasicCombatEvent, { t: "basic" }> => ({
  t: "basic",
  src,
  dst,
  dmg: 25,
  absorbed: 0,
  crit: false,
});

describe("combat action staging (A56/A119)", () => {
  it("uses the canonical purchased speed progression for presentation scaling", () => {
    expect([
      normalizeGameSpeedLevel(-2),
      normalizeGameSpeedLevel(0),
      normalizeGameSpeedLevel(1.9),
      normalizeGameSpeedLevel(99),
      normalizeGameSpeedLevel(Number.POSITIVE_INFINITY),
      normalizeGameSpeedLevel(Number.NaN),
    ]).toEqual([0, 0, 1, 10, 10, 0]);

    expect([0, 1, 2, 10].map(getGameSpeedDisplayMultiplier)).toEqual([1, 1.5, 2, 6]);
    expect([0, 1, 2, 10].map(getCombatDurationMultiplier)).toEqual([3, 2, 1.5, 0.5]);
  });

  it("keeps authored melee phases distinct and scales all four with game speed", () => {
    expect(combatActionTiming("MELEE_FRONT", 0)).toEqual({
      approachMs: 420,
      preImpactMs: 105,
      postImpactMs: 135,
      retreatMs: 420,
      impactOffsetMs: 525,
      totalMs: 1080,
    });
    expect(combatActionTiming("MELEE_FRONT", 1)).toEqual({
      approachMs: 280,
      preImpactMs: 70,
      postImpactMs: 90,
      retreatMs: 280,
      impactOffsetMs: 350,
      totalMs: 720,
    });
    expect(combatActionTiming("MELEE_FRONT", 2)).toEqual({
      approachMs: 210,
      preImpactMs: 52.5,
      postImpactMs: 67.5,
      retreatMs: 210,
      impactOffsetMs: 262.5,
      totalMs: 540,
    });
  });

  it("derives movement pattern from authored delivery and role", () => {
    expect(basicActionPattern(placement("m", melee.id))).toBe("MELEE_FRONT");
    expect(basicActionPattern(placement("a", assassin.id))).toBe("ASSASSIN_BACK");
    expect(basicActionPattern(placement("r", ranged.id))).toBe("RANGED_STATIC");
  });

  it("places damage exactly at melee impact and never stages miss damage", () => {
    const actor = placement("attacker", melee.id);
    const hit = stageBasicCombatEvent(basic(actor.uid), actor, 1, 100, 4);
    expect(hit.startAtMs).toBe(100);
    expect(hit.impactAtMs).toBe(450);
    expect(hit.damageAtMs).toBe(hit.impactAtMs);
    expect(hit.endAtMs).toBe(820);
    expect(hit.eventIndex).toBe(4);

    const miss = stageBasicCombatEvent({ t: "miss", src: actor.uid, dst: "target" }, actor, 1);
    expect(miss.damageAtMs).toBeNull();
    expect(miss.impactAtMs).toBe(350);
  });

  it("stages assassin movement without mutating canonical placement", () => {
    const actor = placement("assassin", assassin.id, 1, 3);
    const before = { ...actor };
    const staged = stageBasicCombatEvent(basic(actor.uid), actor, 0);

    expect(staged.pattern).toBe("ASSASSIN_BACK");
    expect(actor).toEqual(before);
  });

  it("preserves authoritative event indexes while sequencing melee actions", () => {
    const first = placement("first", melee.id);
    const second = placement("second", assassin.id);
    const events: CombatEvent[] = [
      basic(first.uid),
      { t: "death", dst: "target" },
      basic(second.uid),
    ];

    const staged = stageBasicCombatEvents(events, [first, second], 0);
    expect(staged.map((entry) => entry.eventIndex)).toEqual([0, 2]);
    expect(staged[0]!.damageAtMs).toBe(staged[0]!.impactAtMs);
    expect(staged[1]!.startAtMs).toBe(staged[0]!.endAtMs);
  });
});
