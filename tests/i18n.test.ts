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
});
