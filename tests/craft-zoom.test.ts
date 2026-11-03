import { describe, expect, it } from "vitest";
import {
  clampZoom, commandFromKey, commandFromWheel, nextZoom, zoomPercent, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP,
} from "../src/ui/crafting/zoom";

describe("recipe diagram zoom (issue #35)", () => {
  it("clamps to the authored range and rejects non-finite input", () => {
    expect(clampZoom(0.1)).toBe(ZOOM_MIN);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(1.234)).toBe(1.23);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_DEFAULT);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(ZOOM_DEFAULT);
  });

  it("steps in and out and resets without leaving the range", () => {
    expect(nextZoom(ZOOM_DEFAULT, "in")).toBe(ZOOM_DEFAULT + ZOOM_STEP);
    expect(nextZoom(ZOOM_DEFAULT, "out")).toBe(ZOOM_DEFAULT - ZOOM_STEP);
    expect(nextZoom(ZOOM_MAX, "in")).toBe(ZOOM_MAX);
    expect(nextZoom(ZOOM_MIN, "out")).toBe(ZOOM_MIN);
    expect(nextZoom(ZOOM_MAX, "reset")).toBe(ZOOM_DEFAULT);
  });

  it("maps wheel and keyboard intent to the same commands", () => {
    expect(commandFromWheel(-120)).toBe("in");
    expect(commandFromWheel(120)).toBe("out");
    expect(commandFromWheel(0)).toBeNull();
    expect(commandFromWheel(Number.NaN)).toBeNull();
    expect(commandFromKey("+")).toBe("in");
    expect(commandFromKey("=")).toBe("in");
    expect(commandFromKey("-")).toBe("out");
    expect(commandFromKey("0")).toBe("reset");
    expect(commandFromKey("ArrowLeft")).toBeNull();
  });

  it("reports the scale as a whole percentage", () => {
    expect(zoomPercent(1)).toBe(100);
    expect(zoomPercent(1.2)).toBe(120);
    expect(zoomPercent(0.6)).toBe(60);
    expect(zoomPercent(99)).toBe(180);
  });
});
