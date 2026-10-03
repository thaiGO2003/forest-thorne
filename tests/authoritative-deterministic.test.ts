import { describe, expect, it } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import {
  LOGICAL_COLS,
  PROFILE_PLAYERS,
  ROWS_PER_PLAYER,
  RIVER_X,
  VISUAL_COLS,
  benchPerimeter,
  benchSlots,
  brownRing,
  ownsRow,
  riverCells,
  ringCells,
  toLogical,
  toVisual,
  totalRows,
  type Profile,
} from "../src/board/geometry";
import {
  effectiveHitChance,
  goldMultiplier,
  resolveDamageMath,
  simulate,
} from "../src/core/combat";

const PROFILES: readonly Profile[] = ["solo", "coop2", "coop4"];
const key = (cell: { x: number; z: number }) => `${cell.x},${cell.z}`;

describe("WBS-090 authoritative A31 board contracts", () => {
  it("exhaustively round-trips every valid logical cell for every profile", () => {
    expect(LOGICAL_COLS).toBe(10);
    expect(VISUAL_COLS).toBe(11);
    expect(ROWS_PER_PLAYER).toBe(5);

    for (const profile of PROFILES) {
      const rows = PROFILE_PLAYERS[profile] * ROWS_PER_PLAYER;
      expect(totalRows(profile)).toBe(rows);
      expect(riverCells(profile)).toHaveLength(rows);

      const seen = new Set<string>();
      for (let row = 0; row < rows; row++) {
        expect(toLogical(RIVER_X, row, profile)).toBeNull();
        for (let col = 0; col < LOGICAL_COLS; col++) {
          const visual = toVisual(col, row);
          expect(visual.x).not.toBe(RIVER_X);
          expect(toLogical(visual.x, visual.z, profile)).toEqual({ col, row });
          seen.add(`${col},${row}`);
        }
      }
      expect(seen.size).toBe(LOGICAL_COLS * rows);
    }
  });

  it("rejects river, fractional and out-of-bounds visual coordinates", () => {
    const invalid = [
      [-1, 0], [VISUAL_COLS, 0], [0, -1], [0, ROWS_PER_PLAYER],
      [RIVER_X, 0], [0.5, 0], [0, 0.5],
    ] as const;
    for (const [x, z] of invalid) expect(toLogical(x, z, "solo")).toBeNull();
  });

  it("keeps deterministic non-overlapping ring and bench perimeters", () => {
    const ring = brownRing("solo");
    const bench = benchPerimeter("solo");
    const ringKeys = new Set(ring.map(key));
    const benchKeys = new Set(bench.map(key));

    // An inset-1 outline around the explicit 11x5 visual footprint is mathematically 36 cells.
    // WBS-033 and geometry.ts use these coordinates; A31 prose still says 40 and is audited separately.
    expect(ring).toHaveLength(36);
    expect(bench).toHaveLength(44);
    expect(ringKeys.size).toBe(ring.length);
    expect(benchKeys.size).toBe(bench.length);
    expect([...ringKeys].some((cell) => benchKeys.has(cell))).toBe(false);
    expect(ring).toEqual(ringCells(1, "solo"));
    expect(bench).toEqual(ringCells(2, "solo"));
  });

  it("keeps bench slot order as a stable capped prefix", () => {
    const perimeter = benchPerimeter("solo");
    for (const capacity of [0, 1, 8, 32, 44, 999]) {
      expect(benchSlots(capacity, "solo")).toEqual(perimeter.slice(0, Math.min(capacity, perimeter.length)));
    }
    expect(benchSlots(-1, "solo")).toEqual([]);
  });

  it("enforces ownership only inside the selected profile and player span", () => {
    for (const profile of PROFILES) {
      const players = PROFILE_PLAYERS[profile];
      const rows = totalRows(profile);
      for (let slot = 0; slot < players; slot++) {
        for (let row = 0; row < rows; row++) {
          expect(ownsRow(slot, row, profile)).toBe(Math.floor(row / ROWS_PER_PLAYER) === slot);
        }
      }
      expect(ownsRow(-1, 0, profile)).toBe(false);
      expect(ownsRow(players, rows - 1, profile)).toBe(false);
      expect(ownsRow(0, -1, profile)).toBe(false);
      expect(ownsRow(0, rows, profile)).toBe(false);
      expect(ownsRow(0.5, 0, profile)).toBe(false);
    }
  });
});

describe("WBS-090 authoritative combat math (A31.19 / A12-A13)", () => {
  it("clamps effective hit chance and archer distance penalty deterministically", () => {
    expect(effectiveHitChance(0.95, 0)).toBe(0.95);
    expect(effectiveHitChance(0.95, 0.75)).toBeCloseTo(0.2, 12);
    expect(effectiveHitChance(0.95, 2)).toBeCloseTo(0.2, 12);
    expect(effectiveHitChance(0.95, 0, 0.2)).toBe(1);
    expect(effectiveHitChance(0.95, 0.75, 0, 10)).toBe(0.1);
  });

  it("applies hit/evasion to magic basic attacks, not only physical basics", () => {
    const mage = NORMAL_UNITS.find((unit) => unit.role === "MAGE");
    const defender = NORMAL_UNITS.find((unit) => unit.role === "SUPPORT");
    expect(mage).toBeDefined();
    expect(defender).toBeDefined();
    if (!mage || !defender) return;

    const result = simulate(
      [{ uid: "mage", baseId: mage.id, star: 1, row: 0, col: 4 }],
      [{ uid: "target", baseId: defender.id, star: 1, row: 0, col: 5 }],
      { seed: 1, bonus: { R: { evadePct: 100 } } },
    );
    expect(result.events[0]).toEqual({ t: "miss", src: "mage", dst: "target" });
  });

  it("preserves the exact gold reserve multiplier without floor drift", () => {
    expect(goldMultiplier(-1)).toBe(1);
    expect(goldMultiplier(10)).toBe(1);
    expect(goldMultiplier(11)).toBe(1.005);
    expect(goldMultiplier(12)).toBe(1.01);
    expect(goldMultiplier(209)).toBe(1.995);
    expect(goldMultiplier(210)).toBe(2);
    expect(goldMultiplier(999)).toBe(2);
  });

  it("applies DEF and MDEF mitigation while true damage bypasses both", () => {
    const base = {
      attackerElement: "WOOD" as const,
      defenderElement: "STONE" as const,
      attackerRole: "SUPPORT" as const,
      defenderRole: "SUPPORT" as const,
      crit: false,
      critDmg: 1.5,
      globalMult: 1,
    };
    expect(resolveDamageMath({ ...base, raw: 200, type: "physical", def: 100, mdef: 300 })).toBe(100);
    expect(resolveDamageMath({ ...base, raw: 200, type: "magic", def: 100, mdef: 300 })).toBe(50);
    expect(resolveDamageMath({ ...base, raw: 200, type: "true", def: 9999, mdef: 9999 })).toBe(200);
  });

  it("lets physical and magic crits ignore mitigation while true damage cannot crit", () => {
    const base = {
      raw: 200,
      attackerElement: "WOOD" as const,
      defenderElement: "STONE" as const,
      attackerRole: "SUPPORT" as const,
      defenderRole: "SUPPORT" as const,
      def: 9999,
      mdef: 9999,
      crit: true,
      critDmg: 1.5,
    };
    expect(resolveDamageMath({ ...base, type: "physical" })).toBe(300);
    expect(resolveDamageMath({ ...base, type: "magic" })).toBe(300);
    expect(resolveDamageMath({ ...base, type: "true" })).toBe(200);
  });

  it("applies tanker counter resistance, elemental advantage and class counters", () => {
    const base = { raw: 200, type: "true" as const, def: 0, mdef: 0, crit: false };
    expect(resolveDamageMath({
      ...base, attackerElement: "FIRE", defenderElement: "SPIRIT",
      attackerRole: "SUPPORT", defenderRole: "TANKER",
    })).toBe(100);
    expect(resolveDamageMath({
      ...base, attackerElement: "FIRE", defenderElement: "SPIRIT",
      attackerRole: "SUPPORT", defenderRole: "MAGE",
    })).toBe(300);
    expect(resolveDamageMath({
      ...base, attackerElement: "WOOD", defenderElement: "STONE",
      attackerRole: "FIGHTER", defenderRole: "ASSASSIN",
    })).toBe(300);
  });

  it("applies fire vulnerability and global multiplier before final rounding with a minimum of one", () => {
    const base = {
      attackerElement: "FIRE" as const,
      defenderElement: "TIDE" as const,
      attackerRole: "SUPPORT" as const,
      defenderRole: "SUPPORT" as const,
      def: 100,
      mdef: 100,
      crit: false,
    };
    expect(resolveDamageMath({ ...base, raw: 80, type: "true", fireVuln: 1.25, globalMult: 1.4 })).toBe(140);
    expect(resolveDamageMath({ ...base, raw: 1, type: "physical", def: 100_000, globalMult: 0.01 })).toBe(1);
  });
});
