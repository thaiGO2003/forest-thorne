// A88/A110 semantic keyboard ownership. Views supply current modal state and actions; this module owns no presentation.
import { canStepCombat, canToggleAudio, settingsBackAction, type InputOwnershipSnapshot, type SettingsBackAction } from "../core/inputOwnership";
import { keyboardBinding, normalizeKey, type KeyContext, type Settings } from "../core/settings";

export type GameShortcutAction = "startCombat" | "rerollShop" | "buyXp" | "sellUnit" | "newRun" | "stepCombat" | "toggleAudio" | SettingsBackAction | "close";
export interface ShortcutInput {
  key: string;
  repeat?: boolean;
  defaultPrevented?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  editing?: boolean;
}

export function resolveGameShortcut(
  input: ShortcutInput, settings: Pick<Settings, "keys">, context: KeyContext, owner: InputOwnershipSnapshot,
): GameShortcutAction | null {
  if (input.repeat || input.defaultPrevented || input.editing || input.ctrlKey || input.altKey || input.metaKey) return null;
  const key = normalizeKey(input.key);
  if (!key) return null;
  if (context === "menu") return key === keyboardBinding(settings, context, "close") ? "close" : null;
  if (owner.blockingOverlay && !owner.settingsOpen && !owner.historyOpen && !owner.libraryOpen && !owner.shortcutsOpen) return null;
  if (key === keyboardBinding(settings, context, "settings")) return settingsBackAction(owner);
  if (key === keyboardBinding(settings, context, "toggleAudio")) {
    return canToggleAudio(owner) && !owner.blockingOverlay ? "toggleAudio" : null;
  }
  if (context === "combat") {
    return key === keyboardBinding(settings, context, "stepCombat") && canStepCombat(owner) ? "stepCombat" : null;
  }
  if (owner.phase !== "PLANNING" || owner.settingsOpen || owner.historyOpen || owner.libraryOpen || owner.blockingOverlay) return null;
  for (const action of ["startCombat", "rerollShop", "buyXp", "sellUnit", "newRun"] as const) {
    if (key === keyboardBinding(settings, context, action)) return action;
  }
  return null;
}

export type ShortcutCommands = Partial<Record<GameShortcutAction, () => void>>;

/** Consume only actions with a live owner. Unsupported playback actions stay explicitly unhandled. */
export function handleGameShortcut(
  input: ShortcutInput & { preventDefault(): void }, settings: Pick<Settings, "keys">,
  context: KeyContext, owner: InputOwnershipSnapshot, commands: ShortcutCommands,
): boolean {
  const action = resolveGameShortcut(input, settings, context, owner);
  if (!action || !commands[action]) return false;
  input.preventDefault();
  commands[action]!();
  return true;
}
