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

  it("logical↔visual round-trips and skips the river", () => {
    for (let col = 0; col < 10; col++) {
      const v = toVisual(col, 2);
      expect(v.x).not.toBe(RIVER_X);
      expect(toLogical(v.x, v.z)).toEqual({ col, row: 2 });
    }
    expect(toLogical(RIVER_X, 0)).toBeNull();
    expect(toLogical(-1, 0)).toBeNull();
  });

  it("brown ring and bench perimeter are disjoint, unique, and bench is 44", () => {
    const ring = brownRing().map(key);
    const bench = benchPerimeter().map(key);
    expect(new Set(ring).size).toBe(ring.length);
    expect(new Set(bench).size).toBe(44);
    expect(bench.length).toBe(44);
    expect(ring.some((k) => bench.includes(k))).toBe(false);
    // ring is exactly the inset-1 outline of the 11×5 footprint
    expect(brownRing().every((c) => c.x === -1 || c.x === 11 || c.z === -1 || c.z === 5)).toBe(true);
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
