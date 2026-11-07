import { loadUiSettings, onSettingsChange, saveUiSettingsDebounced, type UiSettings } from "./uiSettings.js";
import { t } from "../i18n/index.js";

export const KEYBOARD_BINDING_CONTEXTS = Object.freeze(["planning", "combat", "menu"] as const);

/**
 * A keyboard binding context (top-level settings group). Derived directly from
 * `KEYBOARD_BINDING_CONTEXTS` so it cannot drift out of sync.
 */
export type BindingContext = (typeof KEYBOARD_BINDING_CONTEXTS)[number];

const BINDING_ACTIONS = Object.freeze({
  planning: ["startCombat", "sellUnit", "newRun", "settings", "toggleAudio"],
  combat: ["stepCombat", "settings", "toggleAudio"],
  menu: ["close"]
} as const);

/** Union of all binding action names across every context. */
export type BindingAction = (typeof BINDING_ACTIONS)[keyof typeof BINDING_ACTIONS][number];

/** Normalized bindings for a single context: action -> key. */
export type BindingMap = Record<string, string>;

/** A normalized key-map for a single context. Used where callers index by an
 * action string (e.g. `bindings[action]` for a runtime action that may be
 * unknown to the compiler). */
export type NormalizedBindingEntry = Record<string, string>;

/**
 * A raw, untrusted binding value (a persisted key string, a key event, or
 * anything else). Widened to `unknown` so callers must narrow before use.
 */
export type BindingValue = unknown;

/** Handler invoked (with Phaser's forwarded event args) when a binding fires. */
export type KeyboardActionHandler = (...args: unknown[]) => void;

/** Mapping of action name -> handler. */
export type KeyboardHandlers = Record<string, KeyboardActionHandler>;

/**
 * Minimal structural view of a Phaser scene: the real `Phaser.Scene` (so
 * `input`/`input.keyboard` are available) intersected with a loose record so
 * helpers may read/write custom metadata (`_keyboardBindingsUninstall`) without
 * triggering unsafe-indexing errors. Matches the convention used in
 * `uiResponsive.ts`.
 */
export type KeyboardScene = Phaser.Scene & Record<string, unknown>;

/** Result of `normalizeBindingKey`: a validated key string (never empty here,
 * since the caller-supplied `fallback` carries through). */
export type BindingKey = string;

/** Phaser keyboard event name built from a normalized binding key. */
export type PhaserKeydownEvent = `keydown-${string}`;

const DEFAULT_KEYBOARD_BINDINGS: Readonly<Record<BindingContext, Readonly<Record<string, string>>>> = Object.freeze({
  planning: {
    startCombat: "SPACE",
    sellUnit: "S",
    newRun: "R",
    settings: "ESCAPE",
    toggleAudio: "M"
  },
  combat: {
    stepCombat: "SPACE",
    settings: "ESCAPE",
    toggleAudio: "M"
  },
  menu: {
    close: "ESCAPE"
  }
});

const RESERVED_KEYS: Record<string, true> = { ESCAPE: true };

const NAMED_BINDING_KEYS: Record<string, true> = {
  SPACE: true,
  DELETE: true,
  BACKSPACE: true,
  ENTER: true,
  TAB: true,
  ESCAPE: true
};

function isNamedBindingKey(key: string): boolean {
  return NAMED_BINDING_KEYS[key] === true;
}

function normalizeBindingKey(value: BindingValue, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return fallback;
  if (isNamedBindingKey(trimmed)) return trimmed;
  if (/^[A-Z0-9]$/.test(trimmed)) return trimmed;
  return fallback;
}

function cloneDefaultBindings(): Record<BindingContext, BindingMap> {
  return {
    planning: { ...DEFAULT_KEYBOARD_BINDINGS.planning },
    combat: { ...DEFAULT_KEYBOARD_BINDINGS.combat },
    menu: { ...DEFAULT_KEYBOARD_BINDINGS.menu }
  };
}

export function normalizeKeyboardBindings(raw: unknown): Record<BindingContext, BindingMap> {
  const normalized = cloneDefaultBindings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return normalized;

  const sourceRoot = raw as Record<string, unknown>;
  for (const context of KEYBOARD_BINDING_CONTEXTS) {
    const source = sourceRoot[context];
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const sourceMap = source as Record<string, unknown>;
    for (const action of BINDING_ACTIONS[context]) {
      normalized[context][action] = normalizeBindingKey(
        sourceMap[action],
        DEFAULT_KEYBOARD_BINDINGS[context][action]
      );
    }
  }
  return normalized;
}

export function getKeyboardBindings(settings: UiSettings = loadUiSettings()): Record<BindingContext, BindingMap> {
  return normalizeKeyboardBindings(settings?.keyboardBindings);
}

export function getContextKeyboardBindings(
  context: BindingContext,
  settings: UiSettings = loadUiSettings()
): NormalizedBindingEntry {
  const safeContext = KEYBOARD_BINDING_CONTEXTS.includes(context) ? context : "planning";
  return { ...getKeyboardBindings(settings)[safeContext] };
}

export function getBindingActions(context: BindingContext): BindingAction[] {
  const safeContext = KEYBOARD_BINDING_CONTEXTS.includes(context) ? context : "planning";
  return [...BINDING_ACTIONS[safeContext]];
}

export function formatBindingLabel(binding: BindingValue): string {
  const key = normalizeBindingKey(binding, "");
  if (!key) return "—";
  if (key === "ESCAPE") return "ESC";
  if (key === "SPACE") return "SPACE";
  return key;
}

export function formatBindingBracket(binding: BindingValue): string {
  return `[${formatBindingLabel(binding)}]`;
}

export function toPhaserKeyEvent(binding: BindingValue): PhaserKeydownEvent | null {
  const key = normalizeBindingKey(binding, "");
  if (!key) return null;
  if (key === "ESCAPE") return "keydown-ESC";
  return `keydown-${key}` as PhaserKeydownEvent;
}

export function captureBindingFromKeyboardEvent(event: unknown): BindingKey | null {
  if (!event || typeof event !== "object") return null;
  const key = String((event as { key?: unknown }).key ?? "");
  if (key === "Escape") return "ESCAPE";
  if (key === " " || key === "Spacebar") return "SPACE";
  if (key === "Delete") return "DELETE";
  if (key === "Backspace") return "BACKSPACE";
  if (key === "Enter") return "ENTER";
  if (key === "Tab") return "TAB";
  if (key.length === 1 && /[a-z0-9]/i.test(key)) return key.toUpperCase();
  return null;
}

export function setKeyboardBinding(
  context: BindingContext,
  action: BindingAction,
  binding: BindingValue,
  settings: UiSettings = loadUiSettings()
): UiSettings {
  const safeContext: BindingContext = KEYBOARD_BINDING_CONTEXTS.includes(context) ? context : "planning";
  const safeActions = BINDING_ACTIONS[safeContext] as readonly string[];
  if (!safeActions.includes(action)) return settings;
  const nextBinding = normalizeBindingKey(binding, DEFAULT_KEYBOARD_BINDINGS[safeContext][action as string]);
  const keyboardBindings = getKeyboardBindings(settings);
  keyboardBindings[safeContext][action] = nextBinding;
  const nextSettings = { ...settings, keyboardBindings };
  saveUiSettingsDebounced(nextSettings);
  return nextSettings;
}

export function resetKeyboardBindings(
  context?: BindingContext | null,
  settings: UiSettings = loadUiSettings()
): UiSettings {
  const keyboardBindings = getKeyboardBindings(settings);
  if (context && KEYBOARD_BINDING_CONTEXTS.includes(context)) {
    keyboardBindings[context] = { ...DEFAULT_KEYBOARD_BINDINGS[context] };
  } else {
    Object.assign(keyboardBindings, cloneDefaultBindings());
  }
  const nextSettings = { ...settings, keyboardBindings };
  saveUiSettingsDebounced(nextSettings);
  return nextSettings;
}

export function installKeyboardBindings(
  scene: KeyboardScene,
  context: BindingContext,
  handlers: KeyboardHandlers = {}
): () => void {
  if (!scene?.input?.keyboard) return () => {};
  const prevUninstall = scene["_keyboardBindingsUninstall"];
  if (typeof prevUninstall === "function") {
    prevUninstall();
    scene["_keyboardBindingsUninstall"] = null;
  }

  const bindings = getContextKeyboardBindings(context);
  const unsubs: Array<() => void> = [];

  Object.entries(handlers).forEach(([action, handler]) => {
    if (typeof handler !== "function") return;
    const eventName = toPhaserKeyEvent(bindings[action]);
    if (!eventName) return;
    const wrapped = (...args: unknown[]) => handler(...args);
    scene.input!.keyboard!.on(eventName, wrapped);
    unsubs.push(() => scene.input!.keyboard!.off(eventName, wrapped));
  });

  const uninstall = () => {
    unsubs.forEach((off) => off());
  };
  scene["_keyboardBindingsUninstall"] = uninstall;
  return uninstall;
}

export function watchKeyboardBindings(
  scene: KeyboardScene,
  context: BindingContext,
  handlers: KeyboardHandlers = {}
): () => void {
  installKeyboardBindings(scene, context, handlers);
  return onSettingsChange(() => {
    installKeyboardBindings(scene, context, handlers);
  });
}

export function getBindingActionLabel(context: BindingContext, action: BindingAction): string {
  return t(`settings.shortcuts.actions.${context}.${action}`);
}

export function getBindingInfoLines(context: BindingContext): string[] {
  const safeContext = KEYBOARD_BINDING_CONTEXTS.includes(context) ? context : "planning";
  return String(t(`settings.shortcuts.info.${safeContext}`) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildKeyboardShortcutHelpLines(
  context: BindingContext,
  settings: UiSettings = loadUiSettings()
): string[] {
  const safeContext = KEYBOARD_BINDING_CONTEXTS.includes(context) ? context : "planning";
  const bindings = getContextKeyboardBindings(safeContext, settings);
  const lines = getBindingActions(safeContext).map((action) => {
    const label = getBindingActionLabel(safeContext, action);
    return `• ${formatBindingBracket(bindings[action])} ${label}`;
  });
  return [...lines, ...getBindingInfoLines(safeContext).map((line) => `• ${line}`)];
}

export function getKeyboardShortcutHelpText(
  context: BindingContext = "planning",
  settings: UiSettings = loadUiSettings()
): string {
  return buildKeyboardShortcutHelpLines(context, settings).join("\n");
}

export function isReservedBindingKey(binding: BindingValue): boolean {
  return RESERVED_KEYS[normalizeBindingKey(binding, "")] === true;
}
