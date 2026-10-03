import { describe, expect, it, vi } from "vitest";
import { handleGameShortcut, resolveGameShortcut } from "../src/app/shortcuts";
import { normalizeSettings } from "../src/core/settings";

const settings = normalizeSettings(null);

describe("runtime shortcut ownership A88/A110", () => {
  it("uses current remaps for every planning command and the menu close action", () => {
    const remapped = normalizeSettings({ keys: {
      planning: { startCombat: "ENTER", rerollShop: "Q", buyXp: "G", sellUnit: "DELETE", newRun: "N" },
      menu: { close: "X" },
    } });
    for (const [key, action] of [["Enter", "startCombat"], ["q", "rerollShop"], ["G", "buyXp"], ["Delete", "sellUnit"], ["N", "newRun"]] as const) {
      expect(resolveGameShortcut({ key }, remapped, "planning", { phase: "PLANNING" })).toBe(action);
    }
    expect(resolveGameShortcut({ key: "D" }, remapped, "planning", { phase: "PLANNING" })).toBeNull();
    expect(resolveGameShortcut({ key: "X" }, remapped, "menu", { phase: "PLANNING" })).toBe("close");
  });

  it("does not reopen a modal after another owner already consumed Escape", () => {
    const open = vi.fn();
    const event = { key: "Escape", defaultPrevented: true, preventDefault: vi.fn() };
    expect(handleGameShortcut(event, settings, "planning", { phase: "PLANNING" }, { "open-settings": open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("applies back precedence and blocks obscured planning, audio and Settings-only stepping", () => {
    const owner = { phase: "COMBAT" as const, shortcutsOpen: true, libraryOpen: true, historyOpen: true, settingsOpen: true };
    expect(resolveGameShortcut({ key: "Escape" }, settings, "combat", owner)).toBe("close-shortcuts");
    owner.shortcutsOpen = false;
    expect(resolveGameShortcut({ key: "Escape" }, settings, "combat", owner)).toBe("close-library");
    owner.libraryOpen = false;
    expect(resolveGameShortcut({ key: "Escape" }, settings, "combat", owner)).toBe("close-history");
    owner.historyOpen = false;
    expect(resolveGameShortcut({ key: "Escape" }, settings, "combat", owner)).toBe("close-settings");
    expect(resolveGameShortcut({ key: " " }, settings, "combat", owner)).toBeNull();
    expect(resolveGameShortcut({ key: "M" }, settings, "combat", owner)).toBeNull();
    owner.settingsOpen = false;
    expect(resolveGameShortcut({ key: " " }, settings, "combat", owner)).toBe("stepCombat");
    expect(resolveGameShortcut({ key: "M" }, settings, "combat", owner)).toBe("toggleAudio");
    expect(resolveGameShortcut({ key: "D" }, settings, "planning", { phase: "PLANNING", blockingOverlay: true })).toBeNull();
    expect(resolveGameShortcut({ key: "Escape" }, settings, "planning", { phase: "PLANNING", blockingOverlay: true })).toBeNull();
  });

  it("ignores repeat, focused editors and browser modifier shortcuts", () => {
    for (const field of ["repeat", "editing", "ctrlKey", "altKey", "metaKey"] as const) {
      expect(resolveGameShortcut({ key: "R", [field]: true }, settings, "planning", { phase: "PLANNING" })).toBeNull();
    }
    for (const phase of ["COMBAT", "AUGMENT", "GAME_OVER"] as const) {
      expect(resolveGameShortcut({ key: "R" }, settings, "planning", { phase })).toBeNull();
    }
  });

  it("consumes and invokes a live action once; unsupported playback actions remain unhandled", () => {
    const sell = vi.fn();
    const event = { key: "E", preventDefault: vi.fn() };
    expect(handleGameShortcut(event, settings, "planning", { phase: "PLANNING" }, { sellUnit: sell })).toBe(true);
    expect(sell).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    const step = { key: " ", preventDefault: vi.fn() };
    expect(handleGameShortcut(step, settings, "combat", { phase: "COMBAT" }, {})).toBe(false);
    expect(step.preventDefault).not.toHaveBeenCalled();
  });
});
