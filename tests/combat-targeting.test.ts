import { describe, expect, it, vi } from "vitest";
import { NORMAL_UNITS, type Role } from "../src/content/catalog";
import { makeFighter, selectBasicTarget, simulateMaterialized, type Fighter, type Side } from "../src/core/combat";

const fighter = (role: Role, side: Side, uid: string, row: number, col: number): Fighter => makeFighter({
  uid, baseId: NORMAL_UNITS.find((unit) => unit.role === role)!.id, star: 1, row, col,
}, side);

describe("combat target and action choice A102", () => {
  it("melee prioritizes the nearest column before the same row, with above-before-below ties", () => {
    const actor = fighter("FIGHTER", "L", "actor", 2, 4);
    const sameRow = fighter("TANKER", "R", "same", 2, 8);
    const above = fighter("TANKER", "R", "above", 1, 5);
    const below = fighter("TANKER", "R", "below", 3, 5);
    expect(selectBasicTarget(actor, [sameRow, below, above])?.uid).toBe("above");
    above.alive = false;
    expect(selectBasicTarget(actor, [sameRow, below, above])?.uid).toBe("below");
  });

  it("ranged prioritizes same row then top-first sweep while respecting available range", () => {
    const actor = fighter("MAGE", "L", "actor", 2, 4);
    actor.range = 4;
    const sameRow = fighter("TANKER", "R", "same", 2, 7);
    const above = fighter("TANKER", "R", "above", 1, 5);
    const below = fighter("TANKER", "R", "below", 3, 5);
    expect(selectBasicTarget(actor, [below, above, sameRow])?.uid).toBe("same");
    sameRow.col = 9; // out of range, while above/below remain reachable
    expect(selectBasicTarget(actor, [below, sameRow, above])?.uid).toBe("above");
  });

  it("Assassin back-column priority is side-aware and uses class priority for otherwise equal candidates", () => {
    for (const side of ["L", "R"] as const) {
      const opponent = side === "L" ? "R" : "L";
      const actor = fighter("ASSASSIN", side, "actor", 2, side === "L" ? 4 : 5);
      const front = fighter("TANKER", opponent, "front", 2, side === "L" ? 5 : 4);
      const back = fighter("MAGE", opponent, "mage", 0, side === "L" ? 9 : 0);
      expect(selectBasicTarget(actor, [front, back])?.uid).toBe("mage");
      const archer = fighter("ARCHER", opponent, "a-archer", back.row, back.col);
      expect(selectBasicTarget(actor, [archer, back])?.uid).toBe("mage");
    }
  });

  it("live taunt overrides scoring and randomness; dead taunters release targeting", () => {
    const actor = fighter("MAGE", "R", "actor", 2, 5);
    const ordinary = fighter("TANKER", "L", "ordinary", 2, 4);
    const taunter = fighter("TANKER", "L", "taunter", 4, 0);
    actor.tauntBy = taunter.uid;
    actor.status.taunt = { turns: 2, value: 0 };
    const rng = vi.fn(() => 0);
    expect(selectBasicTarget(actor, [ordinary, taunter], { randomTargetChance: 1, rng })?.uid).toBe("taunter");
    expect(rng).not.toHaveBeenCalled();
    taunter.alive = false;
    expect(selectBasicTarget(actor, [ordinary, taunter], { randomTargetChance: 1, rng })?.uid).toBe("ordinary");
  });

  it("random target rolls are restricted to RIGHT ranged non-frontline and disabled by deterministic targeting", () => {
    const actor = fighter("MAGE", "R", "actor", 2, 5);
    actor.range = 4;
    const targets = [fighter("TANKER", "L", "same", 2, 4), fighter("TANKER", "L", "other", 1, 4)];
    const rng = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.99);
    expect(selectBasicTarget(actor, targets, { randomTargetChance: 1, rng })?.uid).toBe("other");
    const forbidden = vi.fn(() => { throw new Error("unexpected RNG consumption"); });
    expect(selectBasicTarget(actor, targets, { randomTargetChance: 1, rng: forbidden, deterministicTargeting: true })?.uid).toBe("same");
    for (const role of ["ASSASSIN", "TANKER", "FIGHTER"] as const) {
      actor.role = role;
      expect(selectBasicTarget(actor, targets, { randomTargetChance: 1, rng: forbidden })).not.toBeNull();
    }
    actor.role = "MAGE";
    actor.side = "L";
    targets.forEach((target) => { target.side = "R"; target.col = 5; });
    expect(selectBasicTarget(actor, targets, { randomTargetChance: 1, rng: forbidden })).not.toBeNull();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("full rage casts before disarm; silence and stun preserve the captured turn gates", () => {
    for (const status of ["disarm", "silence", "stun"] as const) {
      const actor = fighter("FIGHTER", "L", "actor", 2, 4);
      actor.rage = actor.rageMax;
      actor.status.disarm = { turns: 1, value: 0 };
      if (status !== "disarm") actor.status[status] = { turns: 1, value: 0 };
      const target = fighter("TANKER", "R", "enemy", 2, 5);
      target.hp = target.maxHp = 1_000_000;
      target.status.stun = { turns: 100, value: 0 };
      const result = simulateMaterialized([actor, target], { seed: 1, deterministicTargeting: true });
      const first = result.events.find((event) => "src" in event && event.src === "actor" && ["cast", "skip", "basic"].includes(event.t));
      if (status === "disarm") expect(first).toMatchObject({ t: "cast" });
      else expect(first).toMatchObject({ t: "skip", reason: status === "stun" ? "stun" : "disarm" });
    }
  });
});
