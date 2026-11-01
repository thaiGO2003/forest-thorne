import { describe, expect, it } from "vitest";
import {
  benchPerimeter, benchSlots, brownRing, localRowToSharedRow, ownsRow, riverCells, RIVER_X,
  sharedRowToLocalRow, toLogical, toVisual, totalRows, VISUAL_COLS,
} from "../src/board/geometry";

const key = (c: { x: number; z: number }) => `${c.x},${c.z}`;

describe("board geometry (A31.1)", () => {
  it("solo: 10 logical cols, 11 visual, 5 rows, 50 cells, 5-cell river", () => {
    expect(VISUAL_COLS).toBe(11);
    expect(totalRows("solo")).toBe(5);
    expect(riverCells().length).toBe(5);
    const logical = new Set<string>();
    for (let x = 0; x < VISUAL_COLS; x++) for (let z = 0; z < 5; z++) {
      const l = toLogical(x, z);
      if (l) logical.add(`${l.col},${l.row}`);
    }
    expect(logical.size).toBe(50);
  });

  it("logical↔visual bijection covers every cell and excludes river across profiles", () => {
    for (const profile of ["solo", "coop2", "coop4"] as const) {
      for (let row = 0; row < totalRows(profile); row++) {
        const mapped = new Set<number>();
        for (let col = 0; col < 10; col++) {
          const visual = toVisual(col, row, profile);
          expect(visual.x).not.toBe(RIVER_X);
          expect(toLogical(visual.x, visual.z, profile)).toEqual({ col, row });
          mapped.add(visual.x);
        }
        expect(mapped.size).toBe(10);
        expect(toLogical(RIVER_X, row, profile)).toBeNull();
      }
      expect(toLogical(0, totalRows(profile), profile)).toBeNull();
      expect(toLogical(-1, 0, profile)).toBeNull();
      expect(toLogical(0.5, 0, profile)).toBeNull();
    }
  });

  it("rejects out-of-range, fractional and non-finite logical coordinates", () => {
    for (const profile of ["solo", "coop2", "coop4"] as const) {
      const rows = totalRows(profile);
      const invalid = [
        [-1, 0], [10, 0], [0, -1], [0, rows],
        [0.5, 0], [0, 0.5], [Number.NaN, 0], [0, Number.NaN],
        [Infinity, 0], [0, -Infinity],
      ] as const;
      for (const [col, row] of invalid) {
        expect(() => toVisual(col, row, profile)).toThrow(RangeError);
      }

      // Exact column transition and terminal boundary must remain unchanged.
      expect(toVisual(0, 0, profile)).toEqual({ x: 0, z: 0 });
      expect(toVisual(4, 0, profile)).toEqual({ x: 4, z: 0 });
      expect(toVisual(5, 0, profile)).toEqual({ x: 6, z: 0 });
      expect(toVisual(9, rows - 1, profile)).toEqual({ x: 10, z: rows - 1 });

      // Inverse rejects out-of-range, fractional and non-finite visual cells.
      for (const [x, z] of [
        [-1, 0], [VISUAL_COLS, 0], [0, -1], [0, rows],
        [0.5, 0], [0, 0.5], [Number.NaN, 0], [0, Number.NaN],
        [Infinity, 0], [0, Infinity],
      ] as const) {
        expect(toLogical(x, z, profile)).toBeNull();
      }
    }
  });

  it("enumerates the entire non-river visual grid bijectively in every profile", () => {
    for (const { profile, rows, cells } of [
      { profile: "solo", rows: 5, cells: 50 },
      { profile: "coop2", rows: 10, cells: 100 },
      { profile: "coop4", rows: 20, cells: 200 },
    ] as const) {
      expect(totalRows(profile)).toBe(rows);
      const logicalCells = new Set<string>();
      const visualCells = new Set<string>();
      let playableCells = 0;
      for (let z = 0; z < rows; z++) {
        for (let x = 0; x < VISUAL_COLS; x++) {
          const logical = toLogical(x, z, profile);
          if (x === RIVER_X) {
            expect(logical).toBeNull();
            continue;
          }
          expect(logical).toEqual({ col: x < RIVER_X ? x : x - 1, row: z });
          expect(toVisual(logical!.col, logical!.row, profile)).toEqual({ x, z });
          logicalCells.add(`${logical!.col},${logical!.row}`);
          visualCells.add(`${x},${z}`);
          playableCells++;
        }
      }
      expect(playableCells).toBe(cells);
      expect(playableCells).toBe(10 * totalRows(profile));
      expect(logicalCells.size).toBe(cells);
      expect(visualCells.size).toBe(cells);
      expect(riverCells(profile)).toEqual(
        Array.from({ length: rows }, (_, z) => ({ x: RIVER_X, z })),
      );
    }
  });

  it("ring geometry is unique and disjoint from the bench perimeter in every profile", () => {
    for (const { profile, ringSize, benchSize } of [
      { profile: "solo", ringSize: 36, benchSize: 44 },
      { profile: "coop2", ringSize: 46, benchSize: 54 },
      { profile: "coop4", ringSize: 66, benchSize: 74 },
    ] as const) {
      const ring = brownRing(profile).map(key);
      const bench = benchPerimeter(profile).map(key);
      // Spec §11.4 says 40 cells for solo, but the actual inset-1 rectangle
      // contains 13×7 − 11×5 = 36 unique cells. Preserve geometry pending a spec decision.
      expect(ring.length).toBe(ringSize);
      expect(new Set(ring).size).toBe(ringSize);
      expect(bench.length).toBe(benchSize);
      expect(new Set(bench).size).toBe(benchSize);
      expect(ring.every((cell) => !bench.includes(cell))).toBe(true);
      expect(brownRing(profile).every((c) =>
        c.x === -1 || c.x === 11 || c.z === -1 || c.z === totalRows(profile),
      )).toBe(true);
    }
  });

  it("bench slots are stable prefixes capped by capacity", () => {
    expect(benchSlots(8).map(key)).toEqual(benchPerimeter().slice(0, 8).map(key));
    expect(benchSlots(100).length).toBe(44);
    expect(benchSlots(-3).length).toBe(0);
  });

  it("coop ownership spans are 5-row isolated", () => {
    expect(totalRows("coop4")).toBe(20);
    expect(ownsRow(0, 4)).toBe(true);
    expect(ownsRow(0, 5)).toBe(false);
    expect(ownsRow(1, 5)).toBe(true);
  });

  it("maps local co-op rows only within the owning player span", () => {
    expect(localRowToSharedRow(0, 4, "coop2")).toBe(4);
    expect(localRowToSharedRow(1, 0, "coop2")).toBe(5);
    expect(localRowToSharedRow(3, 4, "coop4")).toBe(19);
    expect(localRowToSharedRow(2, 0, "coop2")).toBeNull();
    expect(localRowToSharedRow(1, 5, "coop2")).toBeNull();

    expect(sharedRowToLocalRow(1, 5, "coop2")).toBe(0);
    expect(sharedRowToLocalRow(1, 9, "coop2")).toBe(4);
    expect(sharedRowToLocalRow(3, 19, "coop4")).toBe(4);
    expect(sharedRowToLocalRow(0, 5, "coop2")).toBeNull();
    expect(sharedRowToLocalRow(2, 10, "coop2")).toBeNull();
  });
});
