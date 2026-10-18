import { describe, expect, it, vi } from "vitest";
import { DICTS, onLocaleChange, setLocale, t } from "../src/core/i18n";

describe("i18n", () => {
  it("ships Vietnamese as the only UI locale", () => {
    expect(Object.keys(DICTS)).toEqual(["vi"]);
    expect(t("menu.continue")).toBe("Tiếp tục");
    expect(t("mode.EndlessPvEClassic")).toBe("Vô Tận Cổ Điển");
  });

  it("localizes settings display values without changing their canonical ids", () => {
    expect(t("settings.quality.low")).toBe("Thấp");
    expect(t("settings.quality.medium")).toBe("Trung bình");
    expect(t("settings.tooltip.expanded")).toBe("Đầy đủ");
    expect(t("settings.tooltip.off")).toBe("Tắt");
    expect(t("settings.resolution.adaptive", {}, "vi")).toBe("Thích nghi");
    expect(t("settings.fpsValue", { value: 60 }, "vi")).toBe("60 Khung hình trên giây");
  });

  it("substitutes params, keeps unknown tokens, and keeps Vietnamese stable", () => {
    expect(t("planning.deploy", { current: 3, max: 5 })).toBe("Ra trận 3/5");
    expect(t("planning.reroll")).toBe("Đổi thú ({cost})");
    const fn = vi.fn();
    const off = onLocaleChange(fn);
    setLocale("vi");
    expect(fn).not.toHaveBeenCalled();
    expect(t("menu.continue")).toBe("Tiếp tục");
    off();
  });

  it("localizes player-facing remediation copy without raw validation tokens", () => {
    expect(t("settings.musicPrevious", {}, "vi")).toBe("Bản nhạc trước");
    expect(t("settings.musicNext", {}, "vi")).toBe("Bản nhạc tiếp theo");
    expect(t("mods.issueUnknown", { modId: "ghost" }, "vi")).toBe("Mod đã bật không tồn tại: ghost");
    expect(t("mods.issueMissingDependency", { modId: "alpha", dependencyId: "core" }, "vi")).toBe("Thiếu phụ thuộc: alpha → core");
    expect(t("mods.issueConflict", { modId: "alpha", conflictId: "beta" }, "vi")).toBe("Xung đột: alpha ↔ beta");
    expect(t("info.synergyClass", {}, "vi")).toBe("Vai trò");
    expect(t("info.synergyElement", {}, "vi")).toBe("Nguyên tố");
  });

  it("localizes graphics quality and mod metadata in Vietnamese", () => {
    expect(t("quality.high", {}, "vi")).toBe("Cao");
    expect(t("quality.high", {}, "en")).toBe("Cao");
    expect(t("mods.packageType.ftunit", {}, "vi")).toBe("Gói đơn vị (.ftunit)");
    expect(t("mods.packageType.ftlogic", {}, "vi")).toBe("Gói logic (.ftlogic)");
    expect(t("mods.source.bundled", {}, "vi")).toBe("Tích hợp sẵn");
    expect(t("mods.source.local", {}, "vi")).toBe("Cục bộ");
    expect(t("mods.source.workshop", {}, "vi")).toBe("Workshop");
  });
});
