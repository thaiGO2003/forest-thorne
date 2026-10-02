import { describe, expect, it } from "vitest";
import { visibleBodies } from "../src/units/rig";

describe("A90.3 star multiplicity", () => {
  it("maps star + HP ratio to visible creature count at every threshold", () => {
    const rows: [1 | 2 | 3, number, number][] = [
      [1, 1, 1], [1, 0.01, 1], [1, 0, 0],
      [2, 1, 2], [2, 0.67, 2], [2, 2 / 3, 1], [2, 0.01, 1], [2, 0, 0],
      [3, 1, 3], [3, 0.67, 3], [3, 2 / 3, 2], [3, 0.34, 2], [3, 1 / 3, 1], [3, 0.01, 1], [3, 0, 0],
      [3, -0.5, 0], [2, Number.NaN, 0],
    ];
    for (const [star, hp, n] of rows) expect([star, hp, visibleBodies(star, hp)]).toEqual([star, hp, n]);
  });
});
