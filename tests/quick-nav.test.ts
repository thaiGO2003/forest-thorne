import { describe, expect, it } from "vitest";
import { hasMessage, t } from "../src/core/i18n";
import { isQuickNavPanel, QUICK_NAV_TARGETS } from "../src/ui/quickNav";

describe("quick navigate targets (#26)", () => {
  it("offers exactly the three workshop surfaces that lost their tab bar", () => {
    expect(QUICK_NAV_TARGETS.map((target) => target.id)).toEqual(["inventory", "craft", "recipes"]);
    expect(new Set(QUICK_NAV_TARGETS.map((target) => target.id)).size).toBe(3);
  });

  it("localizes every target and keeps a semantic icon", () => {
    for (const target of QUICK_NAV_TARGETS) {
      expect(hasMessage(target.key)).toBe(true);
      expect(t(target.key)).not.toBe(target.key);
      expect(target.icon.length).toBeGreaterThan(0);
    }
    expect(hasMessage("planning.quickNav")).toBe(true);
    expect(hasMessage("quickNav.hint")).toBe(true);
    expect(hasMessage("quickNav.open")).toBe(true);
  });

  it("guards panel ids so an unknown id cannot be routed", () => {
    expect(isQuickNavPanel("craft")).toBe(true);
    expect(isQuickNavPanel("quick-nav")).toBe(false);
    expect(isQuickNavPanel("settings")).toBe(false);
  });
});
