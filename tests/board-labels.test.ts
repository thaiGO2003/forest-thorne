import { describe, expect, it } from "vitest";
import { cellToWorld } from "../src/world/arena";
import { BOARD_FILES, boardPositionLabels } from "../src/world/boardLabels";
import { toVisual, totalRows } from "../src/board/geometry";

describe("board position markers", () => {
  it("labels every file A-J on both edges so the dock cannot hide the coordinates", () => {
    const labels = boardPositionLabels("solo");
    const files = labels.filter((label) => label.edge === "file-near" || label.edge === "file-far");
    expect(files).toHaveLength(20);
    const near = files.filter((label) => label.edge === "file-near").map((label) => label.text);
    const far = files.filter((label) => label.edge === "file-far").map((label) => label.text);
    expect(near).toEqual([...BOARD_FILES]);
    expect(far).toEqual([...BOARD_FILES]);

    const lastRow = cellToWorld(toVisual(4, totalRows("solo") - 1), "solo");
    expect(near[4]).toBe("E");
    expect(files[4]!.z).toBeCloseTo(lastRow.z - 0.3, 12);
    const firstRow = cellToWorld(toVisual(0, 0), "solo");
    expect(files[0]!.x).toBeCloseTo(firstRow.x, 12);
    expect(files[0]!.text).toBe("A");
    expect(files[1]!.text).toBe("A");
    expect(files[1]!.z).toBeCloseTo(firstRow.z + 0.3, 12);
  });

  it("numbers every row on both flanks for each coop profile", () => {
    for (const profile of ["solo", "coop2", "coop4"] as const) {
      const rows = totalRows(profile);
      const labels = boardPositionLabels(profile);
      const left = labels.filter((label) => label.edge === "row-left");
      const right = labels.filter((label) => label.edge === "row-right");
      expect(left.map((label) => label.text)).toEqual(Array.from({ length: rows }, (_, row) => String(row)));
      expect(right.map((label) => label.text)).toEqual(Array.from({ length: rows }, (_, row) => String(row)));
      const first = cellToWorld(toVisual(0, 0), profile);
      expect(left[0]!.x).toBeCloseTo(first.x + 0.3, 12);
      expect(right[0]!.x).toBeCloseTo(cellToWorld(toVisual(9, 0), profile).x - 0.3, 12);
    }
  });
});
