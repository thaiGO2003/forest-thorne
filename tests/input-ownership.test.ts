import { describe, expect, it } from "vitest";
import {
  canStartBoardPan,
  canStepCombat,
  canToggleAudio,
  clearPendingOnOverlayTransition,
  combatWheelOwner,
  planningOverlayOwnsInput,
  pointerDownOwner,
  pointerMoveOwner,
  settingsBackAction,
  type InputOwnershipSnapshot,
} from "../src/core/inputOwnership";

const snap = (patch: Partial<InputOwnershipSnapshot> = {}): InputOwnershipSnapshot => ({
  phase: "PLANNING",
  ...patch,
});

describe("A88 input ownership", () => {
  it("gates combat stepping to Combat with Settings closed", () => {
    expect(canStepCombat(snap({ phase: "COMBAT" }))).toBe(true);
    expect(canStepCombat(snap({ phase: "COMBAT", settingsOpen: true }))).toBe(false);
    expect(canStepCombat(snap({ phase: "PLANNING" }))).toBe(false);
  });

  it("resolves settings/back using the authored precedence", () => {
    expect(settingsBackAction(snap({ shortcutsOpen: true, libraryOpen: true, historyOpen: true, settingsOpen: true }))).toBe("close-shortcuts");
    expect(settingsBackAction(snap({ libraryOpen: true, historyOpen: true, settingsOpen: true }))).toBe("close-library");
    expect(settingsBackAction(snap({ historyOpen: true, settingsOpen: true }))).toBe("close-history");
    expect(settingsBackAction(snap({ settingsOpen: true }))).toBe("close-settings");
    expect(settingsBackAction(snap())).toBe("open-settings");
  });

  it("suppresses the audio hotkey while a major overlay is open", () => {
    expect(canToggleAudio(snap())).toBe(true);
    expect(canToggleAudio(snap({ settingsOpen: true }))).toBe(false);
    expect(canToggleAudio(snap({ historyOpen: true }))).toBe(false);
    expect(canToggleAudio(snap({ libraryOpen: true }))).toBe(false);
  });

  it("routes combat wheel ownership with History then Library then Settings priority", () => {
    expect(combatWheelOwner(snap({ historyOpen: true, libraryOpen: true, settingsOpen: true }))).toBe("history");
    expect(combatWheelOwner(snap({ libraryOpen: true, settingsOpen: true }))).toBe("library");
    expect(combatWheelOwner(snap({ settingsOpen: true }))).toBe("settings");
    expect(combatWheelOwner(snap())).toBe("board");
  });

  it("consumes pointer-down for overlays and treats outside-board presses as UI-owned", () => {
    expect(pointerDownOwner(snap({ settingsOpen: true }), true)).toBe("settings");
    expect(pointerDownOwner(snap({ historyOpen: true }), true)).toBe("history");
    expect(pointerDownOwner(snap({ libraryOpen: true }), true)).toBe("library");
    expect(pointerDownOwner(snap(), false)).toBe("ui");
    expect(pointerDownOwner(snap(), true)).toBe("board");
  });

  it("intercepts pointer-move while overlays own input and otherwise follows active pan", () => {
    expect(pointerMoveOwner(snap({ historyOpen: true }), true)).toBe("history");
    expect(pointerMoveOwner(snap({ libraryOpen: true }), true)).toBe("library");
    expect(pointerMoveOwner(snap({ settingsOpen: true }), true)).toBe("settings");
    expect(pointerMoveOwner(snap(), true)).toBe("board");
    expect(pointerMoveOwner(snap(), false)).toBe("none");
  });

  it("allows board pan only from inside an unobscured board", () => {
    expect(canStartBoardPan(snap(), true)).toBe(true);
    expect(canStartBoardPan(snap(), false)).toBe(false);
    expect(canStartBoardPan(snap({ libraryOpen: true }), true)).toBe(false);
    expect(canStartBoardPan(snap({ blockingOverlay: true }), true)).toBe(false);
  });

  it("uses the same major/blocking overlay ownership rule in Planning", () => {
    expect(planningOverlayOwnsInput(snap())).toBe(false);
    expect(planningOverlayOwnsInput(snap({ settingsOpen: true }))).toBe(true);
    expect(planningOverlayOwnsInput(snap({ historyOpen: true }))).toBe(true);
    expect(planningOverlayOwnsInput(snap({ libraryOpen: true }))).toBe(true);
    expect(planningOverlayOwnsInput(snap({ blockingOverlay: true }))).toBe(true);
  });

  it("clears stale pending interaction when an overlay closes or is replaced", () => {
    const pending = { drag: { unitId: "wolf" }, press: { action: "buy" } };

    expect(clearPendingOnOverlayTransition(
      snap({ libraryOpen: true }),
      snap(),
      pending,
    )).toEqual({ drag: null, press: null });

    expect(clearPendingOnOverlayTransition(
      snap({ historyOpen: true }),
      snap({ settingsOpen: true }),
      pending,
    )).toEqual({ drag: null, press: null });

    expect(clearPendingOnOverlayTransition(
      snap({ libraryOpen: true }),
      snap({ libraryOpen: true }),
      pending,
    )).toBe(pending);
  });
});
