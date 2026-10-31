import { describe, expect, it } from "vitest";
import {
  applyBlessingChoice,
  consumeBlessingCombatRage,
  normalizeBlessingPicks,
  syncBlessingChoice,
} from "../src/core/blessingChoice";
import { applyRoundResult, createRun } from "../src/core/run";
import { migrate } from "../src/core/save";

const pendingRun = (round = 3) => {
  const run = createRun(91);
  run.round = round;
  expect(syncBlessingChoice(run)).toBe(true);
  return run;
};

describe("round-3 blessing choice", () => {
  it("opens exactly once on round 3 and not on later rounds", () => {
    const run = pendingRun();
    expect(run.pendingBlessingChoice).toBe(true);
    expect(syncBlessingChoice(run)).toBe(true);

    const later = createRun(92);
    later.round = 4;
    expect(syncBlessingChoice(later)).toBe(false);
    expect(later.pendingBlessingChoice).toBe(false);
  });

  it("applies +4 gold atomically and refuses a second pick", () => {
    const run = pendingRun();
    const gold = run.gold;
    expect(applyBlessingChoice(run, "gold_cache")).toBe(true);
    expect(run.gold).toBe(gold + 4);
    expect(run.blessingPicks).toEqual(["gold_cache"]);
    expect(run.pendingBlessingChoice).toBe(false);
    expect(applyBlessingChoice(run, "forest_order")).toBe(false);
    expect(run.deployCapBonus).toBe(0);
  });

  it("grants one deploy slot and consumes one-shot combat rage", () => {
    const deploy = pendingRun();
    expect(applyBlessingChoice(deploy, "forest_order")).toBe(true);
    expect(deploy.deployCapBonus).toBe(1);

    const rage = pendingRun();
    expect(applyBlessingChoice(rage, "opening_fury")).toBe(true);
    expect(rage.pendingCombatRage).toBe(1);
    expect(consumeBlessingCombatRage(rage)).toBe(1);
    expect(rage.pendingCombatRage).toBe(0);
    expect(consumeBlessingCombatRage(rage)).toBe(0);
  });

  it("is requested when a real round result advances into round 3", () => {
    const run = createRun(93);
    run.round = 2;
    run.phase = "COMBAT";
    const summary = applyRoundResult(run, {
      combatId: "round-2",
      winner: "LEFT",
      enemySurvivors: 0,
      enemyStars: [1],
      bounty: 0,
      drops: [],
    });
    expect(summary?.nextRound).toBe(3);
    expect(run.pendingBlessingChoice).toBe(true);
    expect(run.blessingPicks).toEqual([]);
  });

  it("normalizes legacy saves without retroactively blocking later rounds", () => {
    const legacy = createRun(94) as unknown as Record<string, unknown>;
    delete legacy.blessingPicks;
    delete legacy.pendingBlessingChoice;
    delete legacy.pendingCombatRage;
    const onTrigger = migrate({ version: 4, payload: { player: { ...legacy, round: 3, phase: "PLANNING" } } });
    expect(onTrigger?.envelope.payload.player?.pendingBlessingChoice).toBe(true);
    expect(onTrigger?.envelope.payload.player?.pendingCombatRage).toBe(0);

    const later = migrate({ version: 4, payload: { player: { ...legacy, round: 5, phase: "PLANNING" } } });
    expect(later?.envelope.payload.player?.pendingBlessingChoice).toBe(false);

    const invalid = createRun(95) as unknown as Record<string, unknown>;
    invalid.blessingPicks = ["gold_cache", "unknown", "gold_cache", 3];
    invalid.pendingCombatRage = 99;
    const migrated = migrate({ version: 4, payload: { player: invalid } });
    expect(migrated?.envelope.payload.player?.blessingPicks).toEqual(["gold_cache"]);
    expect(migrated?.envelope.payload.player?.pendingCombatRage).toBe(10);
    expect(normalizeBlessingPicks("nope")).toEqual([]);
  });
});
