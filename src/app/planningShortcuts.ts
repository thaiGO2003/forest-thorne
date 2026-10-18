import { normalizeKey, type KeyBindings } from "../core/settings";

export interface PlanningShortcutActions {
  startCombat(): void;
  reroll(): void;
  buyXp(): void;
  newRun(): void;
  settings(): void;
  toggleAudio(): void;
}

export interface PlanningShortcutInput {
  key: string;
  code: string;
}

export function dispatchPlanningShortcut(
  input: PlanningShortcutInput,
  bindings: KeyBindings["planning"],
  actions: PlanningShortcutActions,
): boolean {
  const key = normalizeKey(input.code === "ShiftRight" ? "SHIFTRIGHT" : input.key === " " ? "SPACE" : input.key);
  if (!key) return false;

  if (key === bindings.startCombat) actions.startCombat();
  else if (key === bindings.reroll) actions.reroll();
  else if (key === bindings.buyXp) actions.buyXp();
  else if (key === bindings.newRun) actions.newRun();
  else if (key === bindings.settings) actions.settings();
  else if (key === bindings.toggleAudio) actions.toggleAudio();
  else return false;

  return true;
}
