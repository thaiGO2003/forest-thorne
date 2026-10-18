import { describe, expect, it } from "vitest";
import { drawLoadingTitle } from "../src/ui/loading";

function paint(title: string, progress: number): Array<[string, string]> {
  const calls: Array<[string, string]> = [];
  const context = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "middle",
    lineJoin: "round",
    lineWidth: 1,
    save() {},
    restore() {},
    translate() {},
    scale() {},
    measureText() { return { width: 10 } as TextMetrics; },
    strokeText() {},
    fillText(this: { fillStyle: string }, glyph: string) { calls.push([glyph, String(this.fillStyle)]); }
  } as unknown as CanvasRenderingContext2D;

  drawLoadingTitle(context, title, progress, 400, 160);
  return calls;
}

describe("loading title rainbow", () => {
  it("starts white, then reveals characters left-to-right and top-to-bottom from real progress", () => {
    expect(paint("AB\nCD", 0)).toEqual([
      ["A", "#ffffff"],
      ["B", "#ffffff"],
      ["C", "#ffffff"],
      ["D", "#ffffff"],
    ]);

    expect(paint("AB\nCD", 0.5)).toEqual([
      ["A", "#ff7068"],
      ["B", "#ffae58"],
      ["C", "#ffffff"],
      ["D", "#ffffff"],
    ]);

    expect(paint("AB\nCD", 1)).toEqual([
      ["A", "#ff7068"],
      ["B", "#ffae58"],
      ["C", "#f6de62"],
      ["D", "#7bdd76"],
    ]);
  });
});
