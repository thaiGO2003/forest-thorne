import { describe, expect, it } from "vitest";
import {
  BOOT_MIN_VISIBLE_MS, BOOT_READY_GRACE_MS, bootTransitionDelay, createRequestGate,
} from "../src/app/loadLifecycle";

describe("loading lifecycle", () => {
  it("invalidates older async completions when a fresh attempt starts", () => {
    const gate = createRequestGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
    gate.invalidate();
    expect(gate.isCurrent(second)).toBe(false);
  });

  it("permanently rejects completions after disposal", () => {
    const gate = createRequestGate();
    const token = gate.begin();
    gate.dispose();
    expect(gate.isCurrent(token)).toBe(false);
    expect(gate.begin()).toBe(-1);
  });

  it("enforces both minimum visibility and post-ready grace", () => {
    expect(bootTransitionDelay(100, 100)).toBe(BOOT_MIN_VISIBLE_MS);
    expect(bootTransitionDelay(100, 1300)).toBe(200);
    expect(bootTransitionDelay(100, 1500)).toBe(BOOT_READY_GRACE_MS);
    expect(bootTransitionDelay(100, 5000)).toBe(BOOT_READY_GRACE_MS);
  });
});
