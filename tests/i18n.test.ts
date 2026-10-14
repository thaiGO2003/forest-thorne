import { describe, expect, it, vi } from "vitest";
import { DICTS, onLocaleChange, setLocale, t } from "../src/core/i18n";

const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("i18n", () => {
  it("vi/en key parity and identical placeholder tokens", () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.vi).sort());
    for (const k of Object.keys(DICTS.vi) as (keyof typeof DICTS.vi)[]) expect(tokens(DICTS.en[k])).toEqual(tokens(DICTS.vi[k]));
  });

  it("substitutes params, keeps unknown tokens, switches live and notifies once", () => {
    expect(t("planning.deploy", { current: 3, max: 5 }, "vi")).toBe("Ra trận 3/5");
    expect(t("planning.reroll", {}, "en")).toBe("Reroll ({cost})");
    const fn = vi.fn();
    const off = onLocaleChange(fn);
    setLocale("en");
    setLocale("en");
    expect([fn.mock.calls.length, t("menu.continue")]).toEqual([1, "Continue"]);
    off();
    setLocale("vi");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("localizes player-facing remediation copy without raw validation tokens", () => {
    expect(t("settings.musicPrevious", {}, "vi")).toBe("Bản nhạc trước");
    expect(t("settings.musicNext", {}, "en")).toBe("Next music track");
    expect(t("mods.issueUnknown", { modId: "ghost" }, "vi")).toBe("Mod đã bật không tồn tại: ghost");
    expect(t("mods.issueMissingDependency", { modId: "alpha", dependencyId: "core" }, "en")).toBe("Missing dependency: alpha → core");
    expect(t("mods.issueConflict", { modId: "alpha", conflictId: "beta" }, "vi")).toBe("Xung đột: alpha ↔ beta");
    expect(t("info.synergyClass", {}, "vi")).toBe("Vai trò");
    expect(t("info.synergyElement", {}, "en")).toBe("Element");
  });

  it("localizes graphics quality and mod metadata values in both locales", () => {
    expect(t("quality.high", {}, "vi")).toBe("Cao");
    expect(t("quality.high", {}, "en")).toBe("High");
    expect(t("mods.packageType.ftunit", {}, "vi")).toBe("Gói đơn vị (.ftunit)");
    expect(t("mods.packageType.ftlogic", {}, "en")).toBe("Logic package (.ftlogic)");
    expect(t("mods.source.bundled", {}, "vi")).toBe("Tích hợp sẵn");
    expect(t("mods.source.local", {}, "en")).toBe("Local");
    expect(t("mods.source.workshop", {}, "vi")).toBe("Workshop");
  });
});
