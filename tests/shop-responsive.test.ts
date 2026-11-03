import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static guard for the creature shop dock: the grid must keep a fixed column
// count so a short shop cannot stretch two offers across the board, and the dock
// must stay a tray instead of a full-width board overlay.
const css = readFileSync(new URL("../src/ui/ui.css", import.meta.url), "utf8");

describe("creature shop dock sizing", () => {
  it("uses the eight-column desktop grid instead of auto-fit", () => {
    const grid = css.match(/\.pl-shop-grid\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(grid).toContain("repeat(8, minmax(0, 1fr))");
    expect(grid).not.toContain("auto-fit");
    expect(css).not.toMatch(/\.pl-shop-grid\s*\{[^}]*auto-fit/);
  });

  it("caps the dock width so it stays a tray, not a full-width overlay", () => {
    const width = css.match(/\.pl-shop\s*\{[^}]*width:\s*min\((\d+)px/)?.[1];
    expect(width).toBe("980");
    expect(css).not.toMatch(/\.pl-shop\s*\{[^}]*width:\s*min\((1[1-9]\d{2}|\d{5,})px/);
  });

  it("keeps the compact and portrait column counts", () => {
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.pl-shop-grid\s*\{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/@media \(max-width: 760px\) and \(orientation: portrait\)[\s\S]*?\.pl-shop-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it("keeps a desktop card between the 90px floor and the 140px ceiling", () => {
    // 980px dock minus 24px padding and seven 6px gaps.
    const cardWidth = (980 - 24 - 7 * 6) / 8;
    expect(cardWidth).toBeGreaterThan(90);
    expect(cardWidth).toBeLessThan(140);
  });
});
