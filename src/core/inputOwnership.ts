import type { Phase } from "./run";

export type MajorOverlay = "settings" | "history" | "library";
export type SettingsBackAction = "close-shortcuts" | "close-library" | "close-history" | "close-settings" | "open-settings";
export type CombatWheelOwner = "history" | "library" | "settings" | "board";
export type PointerDownOwner = MajorOverlay | "ui" | "board";
export type PointerMoveOwner = MajorOverlay | "board" | "none";

export interface InputOwnershipSnapshot {
  phase: Phase;
  settingsOpen?: boolean;
  shortcutsOpen?: boolean;
  libraryOpen?: boolean;
  historyOpen?: boolean;
  blockingOverlay?: boolean;
}

export interface PendingInteraction<TDrag = unknown, TPress = unknown> {
  drag?: TDrag | null;
  press?: TPress | null;
}

const majorOverlayOwner = (snapshot: InputOwnershipSnapshot): MajorOverlay | null => {
  if (snapshot.historyOpen) return "history";
  if (snapshot.libraryOpen) return "library";
  if (snapshot.settingsOpen) return "settings";
  return null;
};

/** A88: manual combat stepping is legal only in Combat while Settings is closed. */
export function canStepCombat(snapshot: InputOwnershipSnapshot): boolean {
  return snapshot.phase === "COMBAT" && !snapshot.settingsOpen;
}

/** A88: Escape/settings action precedence is shortcuts -> Library -> History -> Settings toggle. */
export function settingsBackAction(snapshot: InputOwnershipSnapshot): SettingsBackAction {
  if (snapshot.shortcutsOpen) return "close-shortcuts";
  if (snapshot.libraryOpen) return "close-library";
  if (snapshot.historyOpen) return "close-history";
  return snapshot.settingsOpen ? "close-settings" : "open-settings";
}

/** A88: audio hotkey is suppressed while a major overlay owns input. */
export function canToggleAudio(snapshot: InputOwnershipSnapshot): boolean {
  return !snapshot.settingsOpen && !snapshot.historyOpen && !snapshot.libraryOpen;
}

/** A88 combat wheel routing: History -> Library -> Settings capture -> board/camera. */
export function combatWheelOwner(snapshot: InputOwnershipSnapshot): CombatWheelOwner {
  if (snapshot.historyOpen) return "history";
  if (snapshot.libraryOpen) return "library";
  if (snapshot.settingsOpen) return "settings";
  return "board";
}

/** A88: a major overlay consumes pointer-down; otherwise board pan can begin only inside the board. */
export function pointerDownOwner(snapshot: InputOwnershipSnapshot, pointerInsideBoard: boolean): PointerDownOwner {
  const overlay = majorOverlayOwner(snapshot);
  if (overlay) return overlay;
  return pointerInsideBoard ? "board" : "ui";
}

/** A88: pointer movement stays with the owning overlay; active board pan owns moves when unobscured. */
export function pointerMoveOwner(snapshot: InputOwnershipSnapshot, boardPanActive: boolean): PointerMoveOwner {
  const overlay = majorOverlayOwner(snapshot);
  if (overlay) return overlay;
  return boardPanActive ? "board" : "none";
}

export function canStartBoardPan(snapshot: InputOwnershipSnapshot, pointerInsideBoard: boolean): boolean {
  return pointerInsideBoard && !planningOverlayOwnsInput(snapshot);
}

/** Planning and Combat both yield pointer/wheel ownership to visible major/blocking overlays. */
export function planningOverlayOwnsInput(snapshot: InputOwnershipSnapshot): boolean {
  return Boolean(snapshot.settingsOpen || snapshot.historyOpen || snapshot.libraryOpen || snapshot.blockingOverlay);
}

const ownershipKey = (snapshot: InputOwnershipSnapshot): string => {
  const overlay = majorOverlayOwner(snapshot);
  if (overlay) return overlay;
  return snapshot.blockingOverlay ? "blocking" : "surface";
};

/**
 * A88 stale-release guard. If the owning overlay closes or is replaced, discard pending press/drag
 * state so the later pointer-up cannot commit an obscured action.
 */
export function clearPendingOnOverlayTransition<TDrag, TPress>(
  previous: InputOwnershipSnapshot,
  next: InputOwnershipSnapshot,
  pending: PendingInteraction<TDrag, TPress>,
): PendingInteraction<TDrag, TPress> {
  if (ownershipKey(previous) === ownershipKey(next)) return pending;
  return { drag: null, press: null };
}
