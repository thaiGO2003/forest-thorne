import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import { simulate, type CombatResult } from "../src/core/combat";
import { buildCombatTally } from "../src/core/combatTally";

describe("WBS-032 combat tally", () => {
  it("derives per-unit damage, healing, unattributed damage and deterministic MVP from events", () => {
    const result: CombatResult = {
      winner: "L",
      alive: { L: 2, R: 0 },
      total: { L: 2, R: 1 },
      bounty: { L: 0, R: 0 },
      bountyKills: { L: 0, R: 0 },
      actions: 3,
      participants: [
        { uid: "l1", baseId: "a", star: 1, side: "L" },
        { uid: "l2", baseId: "b", star: 2, side: "L" },
        { uid: "r1", baseId: "c", star: 1, side: "R" },
      ],
      events: [
        { t: "basic", src: "l1", dst: "r1", dmg: 30, absorbed: 5, hpDamage: 25, crit: false },
        { t: "dot", src: "l1", dst: "r1", kind: "burn", dmg: 7, absorbed: 0, hpDamage: 7 },
        { t: "heal", src: "l2", dst: "l1", amount: 10 },
        { t: "revive", src: "l2", dst: "l1", hp: 5 },
        { t: "dot", dst: "l2", kind: "poisonAura", dmg: 4, absorbed: 0, hpDamage: 4 },
      ],
      survivors: [],
    };

    expect(buildCombatTally(result)).toEqual({
      units: [
        {
          uid: "l1", baseId: "a", star: 1, side: "L",
          damageDealt: 32, damageTaken: 0, healingDone: 0, healingReceived: 15, contribution: 32,
        },
        {
          uid: "l2", baseId: "b", star: 2, side: "L",
          damageDealt: 0, damageTaken: 4, healingDone: 15, healingReceived: 0, contribution: 15,
        },
        {
          uid: "r1", baseId: "c", star: 1, side: "R",
          damageDealt: 0, damageTaken: 32, healingDone: 0, healingReceived: 0, contribution: 0,
        },
      ],
      sides: {
        L: { damageDealt: 32, damageTaken: 4, healingDone: 15, healingReceived: 15 },
        R: { damageDealt: 0, damageTaken: 32, healingDone: 0, healingReceived: 0 },
      },
      unattributedDamage: 4,
      mvpUid: "l1",
      mvpBySide: { L: "l1", R: "r1" },
    });
  });

  it("stays deterministic and preserves a zero row for every combat participant", () => {
    const left = [
      { uid: "left-a", baseId: NORMAL_UNITS[0]!.id, star: 1, row: 0, col: 4 },
      { uid: "left-b", baseId: NORMAL_UNITS[1]!.id, star: 1, row: 1, col: 4 },
    ];
    const right = [
      { uid: "right-a", baseId: NORMAL_UNITS[2]!.id, star: 1, row: 0, col: 5 },
      { uid: "right-b", baseId: NORMAL_UNITS[3]!.id, star: 1, row: 1, col: 5 },
    ];
    const a = buildCombatTally(simulate(left, right, { seed: 41 }));
    const b = buildCombatTally(simulate(left, right, { seed: 41 }));
    expect(a).toEqual(b);
    expect(a.units.map((unit) => unit.uid)).toEqual(["left-a", "left-b", "right-a", "right-b"]);
    expect(a.units.every((unit) => unit.damageDealt >= 0 && unit.damageTaken >= 0 && unit.healingDone >= 0)).toBe(true);
  });
});
