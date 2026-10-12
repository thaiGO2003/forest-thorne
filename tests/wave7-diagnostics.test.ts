import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  cloneFighter,
  makeFighter,
  simulate,
  type Placement,
} from "../src/core/combat";
import { unitDiagnostics } from "../src/core/inspection";
import { environmentFor } from "../src/core/environment";

const unitId = NORMAL_UNITS[0]!.id;

const placement = (uid: string, row: number, col: number): Placement => ({
  uid,
  baseId: unitId,
  star: 1,
  row,
  col,
  equips: [],
});

describe("Wave 7 combat diagnostics", () => {
  it("retains every resolved fighter, including dead units", () => {
    const result = simulate(
      [placement("left", 0, 0)],
      [placement("right", 0, 5)],
      { seed: 7, environment: environmentFor(1) },
    );

    expect(result.fighters.map((fighter) => fighter.uid).sort()).toEqual(["left", "right"]);
    expect(result.fighters.some((fighter) => !fighter.alive)).toBe(true);
    expect(result.survivors.every((fighter) => fighter.alive)).toBe(true);
  });

  it("clones nested live-combat diagnostic state instead of exposing simulator-owned objects", () => {
    const fighter = makeFighter(placement("clone", 1, 1), "L", {}, environmentFor(1));
    fighter.status.burn = { turns: 2 } as typeof fighter.status.burn;
    fighter.mods.push({ stat: "atk", value: 5, turns: 2 } as (typeof fighter.mods)[number]);
    fighter.counterTurns = 2;

    const snapshot = cloneFighter(fighter);
    snapshot.status.burn!.turns = 9;
    snapshot.mods[0]!.value = 99;
    snapshot.counterTurns = 8;
    snapshot.env.atkPct += 100;

    expect(fighter.status.burn!.turns).toBe(2);
    expect(fighter.mods[0]!.value).toBe(5);
    expect(fighter.counterTurns).toBe(2);
    expect(snapshot.env.atkPct).not.toBe(fighter.env.atkPct);
  });

  it("uses canonical derived stats plus live fighter state for editable friendly and readonly enemy diagnostics", () => {
    const friendlyPlacement = placement("friendly", 2, 2);
    const friendlyLive = makeFighter(
      friendlyPlacement,
      "L",
      { atkPct: 25, hpPct: 10 },
      environmentFor(1),
    );
    friendlyLive.hp = Math.max(1, friendlyLive.maxHp - 17);
    friendlyLive.rage = Math.min(friendlyLive.rageMax, 23);
    friendlyLive.shield = 11;
    friendlyLive.status.poison = { turns: 3 } as typeof friendlyLive.status.poison;
    friendlyLive.mods.push({ stat: "def", value: 7, turns: 2 } as (typeof friendlyLive.mods)[number]);
    friendlyLive.counterTurns = 1;

    const friendly = unitDiagnostics(
      friendlyPlacement,
      "L",
      { atkPct: 25, hpPct: 10 },
      environmentFor(1),
      friendlyLive,
      false,
    );
    const enemy = unitDiagnostics(
      placement("enemy", 2, 7),
      "R",
      { atkPct: 15 },
      environmentFor(1),
      undefined,
      true,
    );

    expect(friendly.readonly).toBe(false);
    expect(enemy.readonly).toBe(true);
    expect(friendly.derived.atk).toBeGreaterThan(friendly.base.atk);
    expect(friendly.derived.maxHp).toBeGreaterThan(friendly.base.maxHp);
    expect(friendly.live.hp).toBe(friendlyLive.hp);
    expect(friendly.live.rage).toBe(friendlyLive.rage);
    expect(friendly.live.shield).toBe(11);
    expect(friendly.effects.some((effect) => effect.kind === "status")).toBe(true);
    expect(friendly.effects.some((effect) => effect.kind === "modifier")).toBe(true);
    expect(friendly.effects.some((effect) => effect.kind === "reaction")).toBe(true);
  });
});
