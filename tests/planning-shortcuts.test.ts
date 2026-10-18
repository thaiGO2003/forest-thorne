import { describe, expect, it, vi } from "vitest";
import { DEFAULT_KEYS } from "../src/core/settings";
import { dispatchPlanningShortcut, type PlanningShortcutActions } from "../src/app/planningShortcuts";

function actions(): PlanningShortcutActions {
  return {
    startCombat: vi.fn(),
    reroll: vi.fn(),
    buyXp: vi.fn(),
    newRun: vi.fn(),
    settings: vi.fn(),
    toggleAudio: vi.fn(),
  };
}

describe("planning shortcuts", () => {
  it("dispatches R to reroll and Right Shift to new run, but ignores Left Shift", () => {
    const a = actions();
    const bindings = { ...DEFAULT_KEYS.planning };

    expect(dispatchPlanningShortcut({ key: "r", code: "KeyR" }, bindings, a)).toBe(true);
    expect(a.reroll).toHaveBeenCalledTimes(1);
    expect(a.newRun).not.toHaveBeenCalled();

    expect(dispatchPlanningShortcut({ key: "Shift", code: "ShiftRight" }, bindings, a)).toBe(true);
    expect(a.newRun).toHaveBeenCalledTimes(1);

    expect(dispatchPlanningShortcut({ key: "Shift", code: "ShiftLeft" }, bindings, a)).toBe(false);
    expect(a.newRun).toHaveBeenCalledTimes(1);
  });
});
