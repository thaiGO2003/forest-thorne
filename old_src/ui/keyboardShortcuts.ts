import { getKeyboardShortcutHelpText as buildHelpText, type BindingContext } from "../core/keyboardBindings.js";
import type { UiSettings } from "../core/uiSettings.js";

const SHORTCUT_CONTEXTS: Record<string, true> = {
  planning: true,
  combat: true,
  menu: true
};

export function getKeyboardShortcutContext(scene: { scene?: { key?: string } | null; constructor?: { name?: string } | null } | null | undefined): BindingContext {
  if (scene?.scene?.key === "CombatScene" || scene?.constructor?.name === "CombatScene") {
    return "combat";
  }
  if (scene?.scene?.key === "PlanningScene" || scene?.constructor?.name === "PlanningScene") {
    return "planning";
  }
  if (scene?.scene?.key === "MainMenuScene" || scene?.constructor?.name === "MainMenuScene") {
    return "menu";
  }
  return "planning";
}

export function getKeyboardShortcutHelpText(context: string = "planning", settings?: UiSettings): string {
  const safeContext: BindingContext = SHORTCUT_CONTEXTS[context] ? context as BindingContext : "planning";
  return buildHelpText(safeContext, settings);
}
