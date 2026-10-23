import { DEFAULT_LOSE_CONDITION, normalizeLoseCondition, type LoseConditionType } from "./gameRules.js";
import { normalizeAiMode } from "./aiModes.js";
import { getAvailableAiModesForGameMode, getEffectiveAiModeForGameMode } from "./gameModeRuntime.js";
import { setLocale, getAvailableLocales } from "../i18n/index.js";
import { normalizeKeyboardBindings } from "./keyboardBindings.js";

type AiModeKey = string;
type GameModeId = string;
type Locale = "vi" | "en";

export type TooltipMode = (typeof TOOLTIP_MODES)[number];

export interface ResolutionPreset {
  key: string;
  label: string;
  width: number;
  height: number;
  dynamic?: boolean;
}

export type KeyboardBindings = Record<string, Record<string, string>>;

export interface UiSettingsInput {
  audioEnabled?: boolean;
  aiMode?: AiModeKey;
  aiModeByGameMode?: Partial<Record<GameModeId, AiModeKey>>;
  loseCondition?: unknown;
  volumeLevel?: number;
  resolutionKey?: string;
  guiScale?: number;
  language?: string;
  tooltipMode?: unknown;
  expandedTooltip?: boolean;
  subtitleEnabled?: boolean;
  keyboardBindings?: unknown;
}

export interface UiSettings {
  audioEnabled: boolean;
  aiMode: AiModeKey;
  aiModeByGameMode: Record<GameModeId, AiModeKey>;
  loseCondition: LoseConditionType;
  volumeLevel: number;
  resolutionKey: string;
  guiScale: number;
  language: Locale;
  tooltipMode: TooltipMode;
  expandedTooltip: boolean;
  subtitleEnabled: boolean;
  keyboardBindings: KeyboardBindings;
}

export type SettingsChangeListener = (settings: UiSettings) => void;

const UI_SETTINGS_KEY = "forest_throne_ui_settings_v1";
export const ADAPTIVE_RESOLUTION_KEY = "adaptive";
export const TOOLTIP_MODES = Object.freeze(["off", "compact", "summary", "expanded"]);
const KNOWN_GAME_MODE_DEFAULT_AI_MODES = Object.freeze({
  EndlessPvEClassic: "TUTORIAL",
  EndlessPvEFortress: "TUTORIAL",
  PVP4Fortress: "COOP4_MEDIUM"
});

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { key: "1280x720", label: "1280x720 (16:9 HD)", width: 1280, height: 720 },
  { key: "1600x900", label: "1600x900 (16:9)", width: 1600, height: 900 },
  { key: ADAPTIVE_RESOLUTION_KEY, label: "Thích nghi (màn hình hiện tại)", width: 0, height: 0, dynamic: true },
  { key: "1920x1080", label: "1920x1080 (16:9 FHD)", width: 1920, height: 1080 },
  { key: "2436x1125", label: "2436x1125 (19.5:9 iPhone X/XS)", width: 2436, height: 1125 },
  { key: "2532x1170", label: "2532x1170 (19.5:9 iPhone 12/13/14)", width: 2532, height: 1170 },
  { key: "2560x1080", label: "2560x1080 (21:9 Ultrawide)", width: 2560, height: 1080 },
  { key: "2560x1440", label: "2560x1440 (16:9 QHD 2K)", width: 2560, height: 1440 },
  { key: "3200x1800", label: "3200x1800 (16:9 QHD+)", width: 3200, height: 1800 },
  { key: "3440x1440", label: "3440x1440 (21:9 Ultrawide QHD)", width: 3440, height: 1440 },
  { key: "3840x2160", label: "3840x2160 (16:9 4K UHD)", width: 3840, height: 2160 },
  { key: "2796x1290", label: "2796x1290 (19.5:9 iPhone Pro Max)", width: 2796, height: 1290 }
];

const DEFAULT_RESOLUTION_KEY = "1600x900";

function resolveModeAiMode(gameModeId: GameModeId, preferredAiMode: AiModeKey): AiModeKey {
  const fallbackAiMode: AiModeKey = KNOWN_GAME_MODE_DEFAULT_AI_MODES[gameModeId as keyof typeof KNOWN_GAME_MODE_DEFAULT_AI_MODES] ?? "TUTORIAL";
  const availableAiModes = getAvailableAiModesForGameMode(gameModeId);
  if (Array.isArray(availableAiModes) && availableAiModes.length > 0) {
    return getEffectiveAiModeForGameMode(gameModeId, preferredAiMode ?? fallbackAiMode);
  }
  return fallbackAiMode;
}

function normalizeAiModeByGameMode(value: unknown, legacyAiMode: AiModeKey = "TUTORIAL"): Record<GameModeId, AiModeKey> {
  const rawMap = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.keys(KNOWN_GAME_MODE_DEFAULT_AI_MODES).map((gameModeId) => [
      gameModeId,
      resolveModeAiMode(gameModeId, (rawMap[gameModeId] as AiModeKey | undefined) ?? legacyAiMode)
    ])
  );
}

export function normalizeTooltipMode(value: unknown, legacyExpandedTooltip = false, fallback: TooltipMode = "summary"): TooltipMode {
  if (typeof value === "string" && (TOOLTIP_MODES as readonly string[]).includes(value)) {
    return value as TooltipMode;
  }
  if (legacyExpandedTooltip === true) {
    return "expanded";
  }
  return (TOOLTIP_MODES as readonly string[]).includes(fallback) ? fallback : "summary";
}

export function isExpandedTooltipMode(value: unknown): boolean {
  return normalizeTooltipMode(value) === "expanded";
}

export function stepTooltipMode(value: unknown, delta = 1): TooltipMode {
  const current = normalizeTooltipMode(value);
  const currentIndex = TOOLTIP_MODES.indexOf(current);
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 1;
  const nextIndex = currentIndex >= 0
    ? (currentIndex + step % TOOLTIP_MODES.length + TOOLTIP_MODES.length) % TOOLTIP_MODES.length
    : 0;
  return TOOLTIP_MODES[nextIndex] ?? TOOLTIP_MODES[0];
}

export function cycleTooltipMode(value: unknown): TooltipMode {
  return stepTooltipMode(value, 1);
}

function createUiSettingsPayload(settings: UiSettingsInput = {}): UiSettings {
  const lang = getAvailableLocales().includes(settings.language as Locale) ? settings.language as Locale : "vi";
  const aiMode = normalizeAiMode(settings.aiMode ?? "TUTORIAL", "TUTORIAL");
  const tooltipMode = normalizeTooltipMode(settings.tooltipMode, settings.expandedTooltip === true);
  return {
    audioEnabled: settings.audioEnabled !== false,
    aiMode,
    aiModeByGameMode: normalizeAiModeByGameMode(settings.aiModeByGameMode, aiMode),
    loseCondition: normalizeLoseCondition(settings.loseCondition),
    volumeLevel: typeof settings.volumeLevel === "number" && Number.isFinite(settings.volumeLevel) ? Math.min(10, Math.max(1, Math.floor(settings.volumeLevel))) : 10,
    resolutionKey: normalizeResolutionKey(settings.resolutionKey),
    guiScale: normalizeGuiScale(settings.guiScale),
    language: lang,
    tooltipMode,
    expandedTooltip: tooltipMode === "expanded",
    subtitleEnabled: settings.subtitleEnabled !== false,
    keyboardBindings: normalizeKeyboardBindings(settings.keyboardBindings) as KeyboardBindings
  };
}

export function createDefaultUiSettings(): UiSettings {
  return {
    audioEnabled: true,
    aiMode: "TUTORIAL",
    aiModeByGameMode: normalizeAiModeByGameMode(null, "TUTORIAL"),
    loseCondition: DEFAULT_LOSE_CONDITION,
    volumeLevel: 5,
    resolutionKey: DEFAULT_RESOLUTION_KEY,
    guiScale: 2,
    language: "vi",
    tooltipMode: "summary",
    expandedTooltip: false,
    subtitleEnabled: true,
    keyboardBindings: normalizeKeyboardBindings(null) as KeyboardBindings
  };
}

export function normalizeResolutionKey(value: unknown): string {
  const key = typeof value === "string" ? value : DEFAULT_RESOLUTION_KEY;
  return RESOLUTION_PRESETS.some((preset) => preset.key === key) ? key : DEFAULT_RESOLUTION_KEY;
}

function getAdaptiveViewportResolution(): ResolutionPreset {
  const fallback = resolveStaticResolution(DEFAULT_RESOLUTION_KEY);
  const viewport = typeof window !== "undefined" ? window : null;
  const width = Math.max(
    1,
    Math.round(
      viewport?.visualViewport?.width
      ?? viewport?.innerWidth
      ?? viewport?.screen?.width
      ?? fallback.width
    )
  );
  const height = Math.max(
    1,
    Math.round(
      viewport?.visualViewport?.height
      ?? viewport?.innerHeight
      ?? viewport?.screen?.height
      ?? fallback.height
    )
  );
  return {
    key: ADAPTIVE_RESOLUTION_KEY,
    label: `Thích nghi (${width}x${height})`,
    width,
    height,
    dynamic: true
  };
}

function resolveStaticResolution(key: string): ResolutionPreset {
  return RESOLUTION_PRESETS.find((preset) => preset.key === key && !preset.dynamic) ?? RESOLUTION_PRESETS[1];
}

export function resolveResolution(value: unknown): ResolutionPreset {
  const key = normalizeResolutionKey(value);
  if (key === ADAPTIVE_RESOLUTION_KEY) {
    return getAdaptiveViewportResolution();
  }
  return resolveStaticResolution(key);
}

export function normalizeGuiScale(value: unknown): number {
  void value;
  // GUI scale levels are deprecated; keep a fixed compatibility value.
  return 2;
}

export function guiScaleToZoom(guiScale: number): number {
  void guiScale;
  // Keep UI zoom fixed to avoid level-based scaling (1..5).
  return 1;
}

export function loadUiSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) {
      return createDefaultUiSettings();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createDefaultUiSettings();
    }

    const defaults = createDefaultUiSettings();
    const parsedRecord = parsed as Record<string, unknown>;
    const knownKeys = Object.keys(KNOWN_GAME_MODE_DEFAULT_AI_MODES);

    const rawAiMode = typeof parsedRecord.aiMode === "string" ? parsedRecord.aiMode : defaults.aiMode;
    const resolvedAiMode = normalizeAiMode(rawAiMode, defaults.aiMode);
    const rawAiModesByGameMode = parsedRecord.aiModeByGameMode && typeof parsedRecord.aiModeByGameMode === "object"
      ? parsedRecord.aiModeByGameMode as Record<string, unknown>
      : {};
    const aiModeByGameMode: Record<GameModeId, AiModeKey> = Object.fromEntries(
      knownKeys.map((gameModeId) => {
        const preferredMode = rawAiModesByGameMode[gameModeId];
        return [gameModeId, resolveModeAiMode(gameModeId, typeof preferredMode === "string" ? preferredMode : resolvedAiMode)];
      })
    );
    const tooltipMode = normalizeTooltipMode(
      parsedRecord.tooltipMode,
      parsedRecord.expandedTooltip === true,
      defaults.tooltipMode
    );

    const settings: UiSettings = {
      ...defaults,
      ...parsedRecord,
      aiMode: resolvedAiMode,
      aiModeByGameMode,
      loseCondition: normalizeLoseCondition(parsedRecord.loseCondition),
      volumeLevel: typeof parsedRecord.volumeLevel === "number" && Number.isFinite(parsedRecord.volumeLevel)
        ? Math.min(10, Math.max(1, Math.floor(parsedRecord.volumeLevel)))
        : defaults.volumeLevel,
      resolutionKey: normalizeResolutionKey(parsedRecord.resolutionKey),
      guiScale: normalizeGuiScale(parsedRecord.guiScale),
      language: typeof parsedRecord.language === "string" &&
        getAvailableLocales().includes(parsedRecord.language as Locale)
        ? parsedRecord.language as Locale
        : defaults.language,
      tooltipMode,
      expandedTooltip: tooltipMode === "expanded",
      subtitleEnabled: parsedRecord.subtitleEnabled !== false,
      audioEnabled: parsedRecord.audioEnabled !== false,
      keyboardBindings: normalizeKeyboardBindings(parsedRecord.keyboardBindings) as KeyboardBindings
    };

    // Sync i18n locale with loaded settings
    setLocale(settings.language);
    return settings;
  } catch (err) {
    console.warn("Failed to load settings, using defaults:", err);
    return createDefaultUiSettings();
  }
}

const listeners = new Set<SettingsChangeListener>();

export function onSettingsChange(callback: SettingsChangeListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function offSettingsChange(callback: SettingsChangeListener): void {
  listeners.delete(callback);
}

function notifyListeners(settings: UiSettings): void {
  for (const listener of listeners) {
    try {
      listener(settings);
    } catch (e) {
      console.error("Settings listener error:", e);
    }
  }
}

export function saveUiSettings(settings: UiSettingsInput): boolean {
  try {
    const payload = createUiSettingsPayload(settings);
    setLocale(payload.language);
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(payload));
    notifyListeners(payload);
    return true;
  } catch (err) {
    console.error("Failed to save settings:", err);
    return false;
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function saveUiSettingsDebounced(settings: UiSettingsInput, onComplete?: (success: boolean) => void): void {
  clearTimeout(saveTimeout ?? undefined);

  // Notify listeners immediately for responsive UI
  const payload = createUiSettingsPayload(settings);
  notifyListeners(payload);

  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    const success = saveUiSettings(settings);
    onComplete?.(success);
  }, 200);
}
