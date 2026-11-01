import { describe, expect, it } from "vitest";
import { getUnit } from "../src/content/catalog";
import {
  combatTargetPreview,
  materializeCombat,
  simulate as runCombat,
  type CombatEvent,
  type Fighter,
  type Placement,
} from "../src/core/combat";

const TOAD = "toad_poison";
const ENEMY = "jaguar_hunt";

/** Every fighter is unkillable and pinned in place so only the poison mechanic drives the events. */
function pacify(fighters: Fighter[]) {
  for (const f of fighters) {
    f.hp = f.maxHp = 100_000;
    f.shield = 0;
    f.range = 99; // nobody needs to reposition, so field cells stay occupied
    if (f.uid !== "toad") { f.atk = 0; f.matk = 0; }
  }
}

function duel(star: 1 | 2 | 3, seed: number, row = 0) {
  const fighters = materializeCombat(
    [{ uid: "toad", baseId: TOAD, star, row: 2, col: 4 }],
    // The enemy starts on the first cell of the enemy half so the toad acts first (col 4 → col 5).
    [{ uid: "foe", baseId: ENEMY, star: 1, row, col: 5 }],
  );
  pacify(fighters);
  const toad = fighters.find((f) => f.uid === "toad")!;
  toad.rage = toad.rageMax;
  return runCombat(fighters, { seed });
}

const firstFields = (events: CombatEvent[]) => {
  const start = events.findIndex((e) => e.t === "cast" && e.src === "toad");
  return events
    .slice(start < 0 ? events.length : start)
    .filter((e): e is Extract<CombatEvent, { t: "poisonField" }> => e.t === "poisonField" && e.turns > 0)
    .slice(0, 3);
};

describe("Cóc Độc poison fields", () => {
  it("casts three distinct pools on random enemy-half cells", () => {
    const fields = firstFields(duel(1, 7).events);
    expect(fields).toHaveLength(3);
    const cells = new Set(fields.map((f) => `${f.col},${f.row}`));
    expect(cells.size).toBe(3);
    for (const field of fields) {
      expect(field.col).toBeGreaterThanOrEqual(5);
      expect(field.col).toBeLessThanOrEqual(9);
      expect(field.row).toBeGreaterThanOrEqual(0);
      expect(field.row).toBeLessThanOrEqual(4);
      expect(field.turns).toBe(2);
    }
  });

  it("marks enemies at the start of each cycle, keeps pools two cycles, then bursts at five points", () => {
    const left: Placement[] = [{ uid: "toad", baseId: TOAD, star: 1, row: 2, col: 4 }];
    // Fill the whole enemy half: every random pool lands on an enemy, so marks are deterministic.
    const right: Placement[] = [];
    for (let col = 5; col < 10; col++) for (let row = 0; row < 5; row++) {
      right.push({ uid: `foe-${col}-${row}`, baseId: ENEMY, star: 1, row, col });
    }
    const fighters = materializeCombat(left, right);
    pacify(fighters);
    const toad = fighters.find((f) => f.uid === "toad")!;
    toad.hp = Math.floor(toad.maxHp / 2); // leave room so the burst heal is observable
    // Huge rage pool: enemies still grant rage on hit, and a second cast before the burst would
    // place extra fields and blur the two-cycle contract under test.
    toad.rageMax = 1000;
    toad.rage = 1000;
    const result = runCombat(fighters, { seed: 11 });

    const firstBurst = result.events.findIndex((e) => e.t === "poisonBurst");
    expect(firstBurst).toBeGreaterThan(0);
    const beforeBurst = result.events.slice(0, firstBurst);
    const marks = beforeBurst.filter((e): e is Extract<CombatEvent, { t: "poisonMark" }> => e.t === "poisonMark");
    expect(marks.map((m) => m.points)).toEqual([1, 2, 3, 4, 5, 6]);
    const burst = result.events[firstBurst] as Extract<CombatEvent, { t: "poisonBurst" }>;
    const perMark = Math.round(10 + toad.matk * 0.25);
    expect(burst.points).toBe(6);
    expect(burst.dmg).toBe(perMark * 6);
    expect(burst.heal).toBe(Math.round(perMark * 6 * 0.5));
    const heal = result.events.find((e) => e.t === "heal" && e.src === "toad" && e.dst === "toad");
    expect(heal).toMatchObject({ t: "heal", amount: Math.round(perMark * 6 * 0.5) });
    // Expired pools surface a turns=0 field event so playback can remove the puddle.
    expect(result.events.some((e) => e.t === "poisonField" && e.turns === 0)).toBe(true);
  });

  it("biases the first throw toward occupied cells by 0% / 20% / 40% per star", () => {
    // First throw only: a hit removes the occupied cell from the remaining pool, which would
    // otherwise dilute the measured bias.
    const hits = (star: 1 | 2 | 3) => {
      let onEnemy = 0, total = 0;
      for (let seed = 1; seed <= 80; seed++) {
        const fields = firstFields(duel(star, seed, 2).events);
        if (!fields.length) continue;
        total++;
        if (fields[0]!.col === 5 && fields[0]!.row === 2) onEnemy++;
      }
      return { ratio: onEnemy / total, total };
    };
    const one = hits(1), two = hits(2), three = hits(3);
    expect(one.ratio).toBeGreaterThan(0);
    expect(one.ratio).toBeLessThan(0.1);
    expect(two.ratio).toBeGreaterThan(0.15);
    expect(two.ratio).toBeLessThan(0.31);
    expect(three.ratio).toBeGreaterThan(0.34);
    expect(three.ratio).toBeLessThan(0.51);
    expect(three.ratio).toBeGreaterThan(two.ratio);
    expect(two.ratio).toBeGreaterThan(one.ratio);
    expect([one.total, two.total, three.total]).toEqual([80, 80, 80]);
  });

  it("previews the whole enemy half without pretending there is a direct target", () => {
    const fighters = materializeCombat(
      [{ uid: "toad", baseId: TOAD, star: 1, row: 2, col: 4 }],
      [{ uid: "foe", baseId: ENEMY, star: 1, row: 1, col: 6 }],
    );
    const preview = combatTargetPreview(fighters, "toad", { kitPreview: true });
    expect(preview).not.toBeNull();
    expect(preview!.skillCasterUid).toBe("toad");
    expect(preview!.directUids).toEqual([]);
    expect(preview!.splashUids).toEqual([]);
    expect(preview!.scanCells).toHaveLength(25);
    expect(preview!.scanCells.every((cell) => cell.col >= 5)).toBe(true);
  });

  it("is catalogued as a tier-1 mage with the field skill", () => {
    const unit = getUnit(TOAD);
    expect(unit.tier).toBe(1);
    expect(unit.role).toBe("MAGE");
    expect(unit.skill.family).toBe("toad_poison_fields");
    expect(unit.skill.nameVi).toBe("Sương Độc");
    expect(unit.skill.rageCost).toEqual([3, 4, 5]);
    expect(unit.skill.starDetailVi).toHaveLength(3);
    expect(unit.skill.starDetailVi[1]).toContain("20%");
    expect(unit.skill.starDetailVi[2]).toContain("40%");
  });
});
