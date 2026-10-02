import { describe, expect, it } from "vitest";
import {
  RESOLUTIONS, SETTINGS_KEY, applyResolutionChange, createSettingsStore, cycleResolution,
  normalizeSettings, resolveResolution,
} from "../src/core/settings";

class MemoryStore implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("resolution settings A66", () => {
  it("keeps the authored default while recovering stale saved keys through Adaptive", () => {
    expect(normalizeSettings(null).resolutionKey).toBe("1600x900");
    expect(normalizeSettings({ resolutionKey: "800x600" }).resolutionKey).toBe("adaptive");
    expect(normalizeSettings({ expandedTooltip: true }).tooltipMode).toBe("expanded");
  });

  it("resolves Adaptive from viewport sources in priority order with a safe fallback", () => {
    expect(resolveResolution("adaptive", {
      visualViewport: { width: 1111.4, height: 777.6 }, innerWidth: 900, innerHeight: 600,
      screen: { width: 1920, height: 1080 },
    })).toEqual({ width: 1111, height: 778 });
    expect(resolveResolution("adaptive", { innerWidth: 1366, innerHeight: 768 })).toEqual({ width: 1366, height: 768 });
    expect(resolveResolution("adaptive", { screen: { width: 2560, height: 1440 } })).toEqual({ width: 2560, height: 1440 });
    expect(resolveResolution("adaptive", {})).toEqual({ width: 1600, height: 900 });
    expect(resolveResolution("3440x1440")).toEqual({ width: 3440, height: 1440 });
  });

  it("cycles presets in both directions and wraps", () => {
    expect(cycleResolution(RESOLUTIONS.at(-1), 1)).toBe(RESOLUTIONS[0]);
    expect(cycleResolution(RESOLUTIONS[0], -1)).toBe(RESOLUTIONS.at(-1));
    expect(cycleResolution("stale", 1)).toBe("1920x1080");
  });

  it("persists only successful application and rolls back failed platform changes", async () => {
    const storage = new MemoryStore();
    const settings = createSettingsStore(storage);
    settings.save({ resolutionKey: "1600x900" });
    const applied: string[] = [];
    const failed = await applyResolutionChange(settings, "3840x2160", async (key) => {
      applied.push(key);
      return key !== "3840x2160";
    });
    expect(failed).toMatchObject({ ok: false, active: "1600x900", recovered: true });
    expect(applied).toEqual(["3840x2160", "1600x900"]);
    expect(settings.get().resolutionKey).toBe("1600x900");

    const succeeded = await applyResolutionChange(settings, "2560x1440", () => true);
    expect(succeeded).toEqual({ ok: true, active: "2560x1440", recovered: false });
    expect(settings.get().resolutionKey).toBe("2560x1440");
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? "{}").resolutionKey).toBe("2560x1440");
  });
});
