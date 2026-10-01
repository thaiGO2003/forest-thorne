import { describe, expect, it } from "vitest";
import { toVisual } from "../src/board/geometry";
import { cellToWorld, worldToLogical } from "../src/world/arena";

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
});
