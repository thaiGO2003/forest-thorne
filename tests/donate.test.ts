import { describe, expect, it } from "vitest";
import {
  DONATE_ACCOUNT_NAME,
  DONATE_ACCOUNT_NUMBER,
  DONATE_QR_ADD_INFO_MESSAGES,
  buildDonateQrUrl,
  pickRandomDonateQrAddInfo,
} from "../src/core/donate";

describe("donate VietQR", () => {
  it("selects the first and last supplied addInfo messages with clamped random indexes", () => {
    expect(pickRandomDonateQrAddInfo(() => 0)).toBe(DONATE_QR_ADD_INFO_MESSAGES[0]);
    expect(pickRandomDonateQrAddInfo(() => 0.999999)).toBe(DONATE_QR_ADD_INFO_MESSAGES.at(-1));
    expect(pickRandomDonateQrAddInfo(() => -1)).toBe(DONATE_QR_ADD_INFO_MESSAGES[0]);
    expect(pickRandomDonateQrAddInfo(() => 1)).toBe(DONATE_QR_ADD_INFO_MESSAGES.at(-1));
  });

  it("builds the TPBank compact2 QR with rounded positive amount", () => {
    const url = new URL(buildDonateQrUrl(12345.6, "Test donate"));
    expect(url.origin + url.pathname).toBe(
      `https://img.vietqr.io/image/tpbank-${DONATE_ACCOUNT_NUMBER}-compact2.png`,
    );
    expect(url.searchParams.get("accountName")).toBe(DONATE_ACCOUNT_NAME);
    expect(url.searchParams.get("addInfo")).toBe("Test donate");
    expect(url.searchParams.get("amount")).toBe("12346");
  });

  it("omits amount when it is zero, negative, or non-finite", () => {
    expect(new URL(buildDonateQrUrl(0, "Zero")).searchParams.has("amount")).toBe(false);
    expect(new URL(buildDonateQrUrl(-10, "Negative")).searchParams.has("amount")).toBe(false);
    expect(new URL(buildDonateQrUrl(Number.NaN, "NaN")).searchParams.has("amount")).toBe(false);
  });
});
