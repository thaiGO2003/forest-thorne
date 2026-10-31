import { describe, expect, it } from "vitest";
import { cellToWorld } from "../src/world/arena";
import { BOARD_FILES, boardPositionLabels } from "../src/world/boardLabels";
import { toVisual, totalRows } from "../src/board/geometry";

describe("board position markers", () => {
  it("prints one combined A1-style coordinate per playable cell", () => {
    const labels = boardPositionLabels("solo");
    expect(labels).toHaveLength(10 * totalRows("solo"));
    expect(labels[0]!.text).toBe("A5");
    expect(labels.at(-1)!.text).toBe("J1");
    const nearLeft = labels.find((label) => label.col === 0 && label.row === 4)!;
    expect(nearLeft.text).toBe("A1");
    const world = cellToWorld(toVisual(0, 4), "solo");
    expect(nearLeft.x).toBeCloseTo(world.x - 0.29, 12);
    expect(nearLeft.z).toBeCloseTo(world.z - 0.29, 12);
    expect(new Set(labels.map((label) => label.text)).size).toBe(labels.length);
  });

  it("numbers every row for each coop profile", () => {
    for (const profile of ["solo", "coop2", "coop4"] as const) {
      const rows = totalRows(profile);
      const labels = boardPositionLabels(profile);
      expect(labels).toHaveLength(10 * rows);
      const bottom = labels.filter((label) => label.row === rows - 1);
      expect(bottom).toHaveLength(10);
      expect(bottom.every((label) => label.text.endsWith("1"))).toBe(true);
      expect(labels[0]!.text).toBe(`${BOARD_FILES[0]}${rows}`);
      expect(labels.at(-1)!.text).toBe(`${BOARD_FILES[9]}1`);
    }
  });
});
