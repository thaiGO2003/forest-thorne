// UI settings (A35) + keyboard bindings (A44). Separate persisted owner from run state.
import { normalizeAiMode, type AiMode } from "./encounter";
import { GAME_MODES, MODE_CONFIG, type GameMode } from "./modes";

export const SETTINGS_KEY = "forest_throne_ui_settings_v1";
export const GRAPHICS_QUALITY_KEY = "forest-throne.graphics-quality";
export const RENDER_SCALE_KEY = "forest-throne.render-scale";
export const BATTERY_SAVER_KEY = "forest-throne.battery-saver";

export const RESOLUTIONS = [
  "1280x720", "1600x900", "adaptive", "1920x1080", "2436x1125", "2532x1170", "2560x1080", "2560x1440",
  "3200x1800", "3440x1440", "3840x2160", "2796x1290",
] as const;
export type ResolutionKey = (typeof RESOLUTIONS)[number];
export interface ResolutionSize { width: number; height: number }
export interface ResolutionSource {
  visualViewport?: { width: number; height: number } | null;
  innerWidth?: number;
  innerHeight?: number;
  screen?: { width: number; height: number } | null;
}
export const TOOLTIP_MODES = ["off", "compact", "summary", "expanded"] as const;
export const QUALITY = ["low", "medium", "high"] as const;
export const RENDER_SCALES = [0.5, 0.67, 0.75, 1] as const;
export { GAME_MODES, type GameMode } from "./modes";

export type KeyContext = "planning" | "combat" | "menu";
export const DEFAULT_KEYS = {
  planning: { startCombat: "SPACE", reroll: "D", buyXp: "F", sell: "E", newRun: "R", settings: "ESCAPE", toggleAudio: "M" },
  combat: { step: "SPACE", settings: "ESCAPE", toggleAudio: "M" },
  menu: { back: "ESCAPE" },
} as const satisfies Record<KeyContext, Record<string, string>>;
export type KeyBindings = { [C in KeyContext]: Record<keyof (typeof DEFAULT_KEYS)[C], string> };

const NAMED_KEYS = ["SPACE", "DELETE", "BACKSPACE", "ENTER", "TAB", "ESCAPE"];
/** Single letter/digit or a named key; anything else → null. */
export function normalizeKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const k = v.trim().toUpperCase();
  return /^[A-Z0-9]$/.test(k) || NAMED_KEYS.includes(k) ? k : null;
}

export function normalizeKeys(raw: unknown): KeyBindings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const out = {} as Record<string, Record<string, string>>;
  for (const [ctx, defs] of Object.entries(DEFAULT_KEYS)) {
    out[ctx] = {};
    for (const [action, def] of Object.entries(defs)) {
      const k = normalizeKey(src[ctx]?.[action]);
      // ESCAPE is reserved: only actions defaulting to it may hold it.
      out[ctx][action] = k && (k !== "ESCAPE" || def === "ESCAPE") ? k : def;
    }
  }
  return out as KeyBindings;
}

/** Mode → allowed AI modes + default (A35 / A19). */
export const MODE_AI: Record<GameMode, { allowed: readonly AiMode[]; def: AiMode }> = {
  EndlessPvEClassic: MODE_CONFIG.EndlessPvEClassic.ai,
  EndlessPvEFortress: MODE_CONFIG.EndlessPvEFortress.ai,
  EndlessCreative: MODE_CONFIG.EndlessCreative.ai,
  FortressPvP4: MODE_CONFIG.FortressPvP4.ai,
};

export interface Settings {
  audioEnabled: boolean; audioMuted: boolean; volumeLevel: number;
  aiMode: AiMode; aiModeByGameMode: Record<GameMode, AiMode>;
  loseCondition: "NO_HEARTS" | "NO_UNITS";
  resolutionKey: ResolutionKey; guiScale: 2;
  language: "vi" | "en"; tooltipMode: (typeof TOOLTIP_MODES)[number]; expandedTooltip: boolean;
  subtitleEnabled: boolean; keys: KeyBindings;
  quality: (typeof QUALITY)[number]; renderScale: number; batterySaver: boolean;
}

export interface GraphicsPreferences {
  quality: Settings["quality"];
  renderScale: number;
  batterySaver: boolean;
}

const pick = <T>(list: readonly T[], v: unknown, def: T): T => (list.includes(v as T) ? (v as T) : def);
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);

/** A66: missing settings use the authored 1600x900 default; stale/unknown saved keys recover to Adaptive. */
export function normalizeResolutionKey(value: unknown, missingDefault: ResolutionKey = "1600x900"): ResolutionKey {
  if (value == null || value === "") return missingDefault;
  return RESOLUTIONS.includes(value as ResolutionKey) ? value as ResolutionKey : "adaptive";
}

const positiveDimension = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.round(n)) : null;
};

/** A66 Adaptive: visual viewport -> normal viewport -> screen -> 1600x900. */
export function resolveResolution(key: ResolutionKey, source: ResolutionSource = {}): ResolutionSize {
  if (key !== "adaptive") {
    const [rawWidth, rawHeight] = key.split("x");
    return { width: Number(rawWidth), height: Number(rawHeight) };
  }
  const candidates: readonly [unknown, unknown][] = [
    [source.visualViewport?.width, source.visualViewport?.height],
    [source.innerWidth, source.innerHeight],
    [source.screen?.width, source.screen?.height],
  ];
  for (const [rawWidth, rawHeight] of candidates) {
    const width = positiveDimension(rawWidth);
    const height = positiveDimension(rawHeight);
    if (width && height) return { width, height };
  }
  return { width: 1600, height: 900 };
}

/** A66 preset cycling wraps in either direction and recovers stale current values through Adaptive. */
export function cycleResolution(current: unknown, direction: 1 | -1): ResolutionKey {
  const normalized = normalizeResolutionKey(current, "adaptive");
  const index = RESOLUTIONS.indexOf(normalized);
  const next = (index + direction + RESOLUTIONS.length) % RESOLUTIONS.length;
  return RESOLUTIONS[next]!;
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const byMode = (r.aiModeByGameMode ?? {}) as Record<string, unknown>;
  const vol = Math.round(Number(r.volumeLevel));
  const scale = Number(r.renderScale);
  const tooltipMode = TOOLTIP_MODES.includes(r.tooltipMode as (typeof TOOLTIP_MODES)[number])
    ? r.tooltipMode as (typeof TOOLTIP_MODES)[number]
    : r.expandedTooltip === true ? "expanded" : "summary";
  return {
    audioEnabled: bool(r.audioEnabled, true),
    audioMuted: bool(r.audioMuted, false),
    volumeLevel: Number.isFinite(vol) ? Math.min(10, Math.max(1, vol)) : 5,
    aiMode: normalizeAiMode(r.aiMode, "TUTORIAL"),
    aiModeByGameMode: Object.fromEntries(GAME_MODES.map((m) => {
      const v = normalizeAiMode(byMode[m], MODE_AI[m].def);
      return [m, MODE_AI[m].allowed.includes(v) ? v : MODE_AI[m].def];
    })) as Record<GameMode, AiMode>,
    loseCondition: r.loseCondition === "SINGLE_LOSS"
      ? "NO_UNITS"
      : pick(["NO_HEARTS", "NO_UNITS"] as const, r.loseCondition, "NO_UNITS"),
    resolutionKey: normalizeResolutionKey(r.resolutionKey),
    guiScale: 2,
    language: pick(["vi", "en"] as const, r.language, "vi"),
    tooltipMode,
    expandedTooltip: tooltipMode === "expanded",
    subtitleEnabled: bool(r.subtitleEnabled, true),
    keys: normalizeKeys(r.keys),
    quality: pick(QUALITY, r.quality, "high"),
    renderScale: Number.isFinite(scale) ? Math.min(1, Math.max(0.5, scale)) : 1,
    batterySaver: bool(r.batterySaver, false),
  };
}

export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEFAULT_GRAPHICS_PREFERENCES: GraphicsPreferences = { quality: "high", renderScale: 1, batterySaver: false };

export function normalizeGraphicsPreferences(raw: unknown, fallback: GraphicsPreferences = DEFAULT_GRAPHICS_PREFERENCES): GraphicsPreferences {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const scale = Number(value.renderScale);
  return {
    quality: pick(QUALITY, value.quality, fallback.quality),
    renderScale: Number.isFinite(scale) ? Math.min(1, Math.max(0.5, scale)) : fallback.renderScale,
    batterySaver: typeof value.batterySaver === "boolean" ? value.batterySaver : fallback.batterySaver,
  };
}

const storedBoolean = (value: string | null, fallback: boolean): boolean => {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
};

/** A104.3 graphics-only preferences live outside the shared UI settings document. */
export function loadGraphicsPreferences(
  store: Pick<KV, "getItem">,
  fallback: GraphicsPreferences = DEFAULT_GRAPHICS_PREFERENCES,
): GraphicsPreferences {
  try {
    const quality = store.getItem(GRAPHICS_QUALITY_KEY);
    const renderScale = store.getItem(RENDER_SCALE_KEY);
    const batterySaver = store.getItem(BATTERY_SAVER_KEY);
    return normalizeGraphicsPreferences({
      quality: quality ?? fallback.quality,
      renderScale: renderScale ?? fallback.renderScale,
      batterySaver: storedBoolean(batterySaver, fallback.batterySaver),
    }, fallback);
  } catch {
    return { ...fallback };
  }
}

export function saveGraphicsPreferences(store: Pick<KV, "setItem">, value: unknown): boolean {
  const normalized = normalizeGraphicsPreferences(value);
  try {
    store.setItem(GRAPHICS_QUALITY_KEY, normalized.quality);
    store.setItem(RENDER_SCALE_KEY, String(normalized.renderScale));
    store.setItem(BATTERY_SAVER_KEY, normalized.batterySaver ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

/** Corrupt/missing → defaults; never blocks boot. */
export function loadSettings(store: KV): Settings {
  let raw: unknown = null;
  try { raw = JSON.parse(store.getItem(SETTINGS_KEY) ?? "null"); } catch { raw = null; }
  const shared = normalizeSettings(raw);
  const graphics = loadGraphicsPreferences(store, {
    quality: shared.quality,
    renderScale: shared.renderScale,
    batterySaver: shared.batterySaver,
  });
  return { ...shared, ...graphics };
}

type Listener = (s: Settings) => void;

export interface SettingsStore {
  get(): Settings;
  subscribe(fn: Listener): () => void;
  save(patch: Partial<Settings>): void;
  preview(patch: Partial<Settings>): void;
  resetKeys(ctx?: KeyContext): void;
}

export interface ResolutionApplyResult {
  ok: boolean;
  active: ResolutionKey;
  recovered: boolean;
  message?: string;
}

export type ResolutionApplier = (key: ResolutionKey) => boolean | Promise<boolean>;

/**
 * A66 transactional boundary: persist only after successful application. On failure, re-apply the
 * previous mode and keep the previous setting, returning explicit recovery copy to the caller.
 */
export async function applyResolutionChange(
  settings: Pick<SettingsStore, "get" | "save">,
  requested: unknown,
  apply: ResolutionApplier,
): Promise<ResolutionApplyResult> {
  const previous = settings.get().resolutionKey;
  const next = normalizeResolutionKey(requested, "adaptive");
  try {
    if (await apply(next)) {
      settings.save({ resolutionKey: next });
      return { ok: true, active: next, recovered: false };
    }
  } catch {
    // Rollback below owns recovery for both false returns and thrown platform failures.
  }
  let recovered = false;
  try { recovered = await apply(previous); } catch { recovered = false; }
  return {
    ok: false,
    active: previous,
    recovered,
    message: recovered
      ? `Không thể áp dụng độ phân giải ${next}; đã khôi phục ${previous}.`
      : `Không thể áp dụng độ phân giải ${next}; hãy khởi động lại phần hiển thị.`,
  };
}

/** Owner: normalize → write once → notify. `preview` notifies immediately and writes after 200 ms. */
export function createSettingsStore(store: KV, onLocale?: (lang: Settings["language"]) => void): SettingsStore {
  let current = loadSettings(store);
  const listeners: Listener[] = [];
  // Bumped by every save/preview; a pending debounced write only fires if still latest.
  let version = 0;
  const write = () => {
    const { quality, renderScale, batterySaver, ...shared } = current;
    store.setItem(SETTINGS_KEY, JSON.stringify(shared));
    saveGraphicsPreferences(store, { quality, renderScale, batterySaver });
  };
  const apply = (patch: Partial<Settings>) => {
    version++;
    current = normalizeSettings({ ...current, ...patch });
    onLocale?.(current.language);
  };
  const s: SettingsStore = {
    get: () => current,
    subscribe(fn) { listeners.push(fn); return () => { listeners.splice(listeners.indexOf(fn), 1); }; },
    save(patch) { apply(patch); write(); for (const l of listeners) l(current); },
    preview(patch) {
      apply(patch); for (const l of listeners) l(current);
      const v = version;
      setTimeout(() => { if (v === version) write(); }, 200);
    },
    resetKeys(ctx) {
      s.save({ keys: ctx ? { ...current.keys, [ctx]: { ...DEFAULT_KEYS[ctx] } } : normalizeKeys(null) });
    },
  };
  return s;
}
