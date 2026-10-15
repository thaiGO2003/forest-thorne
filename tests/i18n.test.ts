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
    expect(t("settings.resolution.adaptive")).toBe("adaptive");
  });

  it("substitutes params, keeps unknown tokens, and keeps Vietnamese stable", () => {
    expect(t("planning.deploy", { current: 3, max: 5 })).toBe("Ra trận 3/5");
    expect(t("planning.reroll")).toBe("Đổi tướng ({cost})");
    const fn = vi.fn();
    const off = onLocaleChange(fn);
    setLocale("vi");
    expect(fn).not.toHaveBeenCalled();
    expect(t("menu.continue")).toBe("Tiếp tục");
    off();
  });
});
