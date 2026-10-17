import { describe, expect, it } from "vitest";
import {
  DONATE_ACCOUNT,
  DONATE_ACCOUNT_NAME,
  DONATE_AMOUNT_PRESETS,
  DONATE_BANK_ID,
  DONATE_QR_ADD_INFO_MESSAGES,
  buildDonateVietQrUrl,
  randomDonateMemo,
} from "../src/ui/donate";

describe("Donate VietQR", () => {
  it("uses the authoritative TPBank account and encodes transfer fields", () => {
    const url = new URL(buildDonateVietQrUrl(50_000.9, "Game hay & vui"));
    expect(url.origin + url.pathname).toBe(
      `https://img.vietqr.io/image/${DONATE_BANK_ID}-${DONATE_ACCOUNT}-compact2.png`,
    );
    expect(url.searchParams.get("amount")).toBe("50000");
    expect(url.searchParams.get("addInfo")).toBe("Game hay & vui");
    expect(url.searchParams.get("accountName")).toBe(DONATE_ACCOUNT_NAME);
  });

  it("keeps the full preset span from 10,000 through 500,000", () => {
    expect(DONATE_AMOUNT_PRESETS[0]).toBe(10_000);
    expect(DONATE_AMOUNT_PRESETS.at(-1)).toBe(500_000);
  });

  it("selects deterministic memo boundaries and clamps invalid RNG values", () => {
    expect(randomDonateMemo(() => 0)).toBe(DONATE_QR_ADD_INFO_MESSAGES[0]);
    expect(randomDonateMemo(() => 0.9999999999999999)).toBe(DONATE_QR_ADD_INFO_MESSAGES.at(-1));
    expect(randomDonateMemo(() => -1)).toBe(DONATE_QR_ADD_INFO_MESSAGES[0]);
    expect(randomDonateMemo(() => 2)).toBe(DONATE_QR_ADD_INFO_MESSAGES.at(-1));
    expect(randomDonateMemo(() => Number.NaN)).toBe(DONATE_QR_ADD_INFO_MESSAGES[0]);
  });

  it("omits transfer amount when non-positive, subunit or non-finite", () => {
    for (const amount of [0, -10, 0.9, Number.NaN, Infinity, -Infinity]) {
      expect(new URL(buildDonateVietQrUrl(amount, "Optional")).searchParams.has("amount")).toBe(false);
    }
  });
});
