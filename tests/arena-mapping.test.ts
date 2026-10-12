import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { toVisual } from "../src/board/geometry";
vi.mock("../src/world/scenery", () => ({
  createScenery: () => ({ setEnvironment() {}, update() {} }),
}));
vi.mock("../src/world/sky", () => ({
  createSky: () => ({ setEnvironment() {}, update() {} }),
}));
import { cellToWorld, createArena, worldToLogical } from "../src/world/arena";

describe("arena world mapping (A91.2)", () => {
  it("round-trips every logical cell through world space", () => {
    for (const p of ["solo", "coop2", "coop4"] as const) {
      const rows = { solo: 5, coop2: 10, coop4: 20 }[p];
      for (let col = 0; col < 10; col++) for (let row = 0; row < rows; row++) {
        const w = cellToWorld(toVisual(col, row), p);
        expect(worldToLogical(w.x, w.z, p)).toEqual({ col, row });
      }
    }
  });

  it("river is centred at x=0 and its interior never resolves to a cell", () => {
    expect(cellToWorld({ x: 5, z: 2 }, "solo").x).toBe(0);
    for (const x of [-0.49, 0, 0.3, 0.49]) expect(worldToLogical(x, 0, "solo")).toBeNull();
    expect(worldToLogical(0.6, 0, "solo")).toEqual({ col: 5, row: 2 });
    expect(worldToLogical(-0.6, 0, "solo")).toEqual({ col: 4, row: 2 });
  });

  it("off-board points resolve to null", () => {
    expect(worldToLogical(9, 0, "solo")).toBeNull();
    expect(worldToLogical(1, 4, "solo")).toBeNull();
  });

  it("applies semantic highlights only to playable tiles and restores the exact checker color", () => {
    const scene = new THREE.Scene();
    const arena = createArena(scene, "solo");
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const color = new THREE.Color();
    const tileIndex = (col: number, row: number) => {
      const expected = cellToWorld(toVisual(col, row), "solo");
      for (let i = 0; i < arena.tiles.count; i++) {
        arena.tiles.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        if (Math.abs(position.x - expected.x) < 1e-6 && Math.abs(position.z - expected.z) < 1e-6) return i;
      }
      return -1;
    };
    const index = tileIndex(2, 1);
    expect(index).toBeGreaterThanOrEqual(0);
    arena.tiles.getColorAt(index, color);
    const checker = color.getHex();

    arena.setHighlights([
      { col: 2, row: 1, role: "direct" },
      { col: 99, row: 99, role: "invalid" },
      { col: -1, row: 2, role: "hover" },
    ]);
    arena.tiles.getColorAt(index, color);
    expect(color.getHex()).not.toBe(checker);
    expect(arena.tiles.count).toBe(50);
    for (let i = 0; i < arena.tiles.count; i++) {
      arena.tiles.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(Math.abs(position.x)).toBeGreaterThanOrEqual(0.5);
    }

    arena.clearHighlights();
    arena.tiles.getColorAt(index, color);
    expect(color.getHex()).toBe(checker);
    arena.dispose();
  });
});
