// UI settings (A35) + keyboard bindings (A44). Separate persisted owner from run state.
import { normalizeAiMode, type AiMode } from "./encounter";
import { GAME_MODES, MODE_CONFIG, type GameMode } from "./modes";

export const SETTINGS_KEY = "forest_throne_ui_settings_v1";

export const RESOLUTIONS = [
  "1280x720", "1600x900", "adaptive", "1920x1080", "2436x1125", "2532x1170", "2560x1080", "2560x1440",
  "3200x1800", "3440x1440", "3840x2160", "2796x1290",
] as const;
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
  resolutionKey: (typeof RESOLUTIONS)[number]; guiScale: 2;
  language: "vi" | "en"; tooltipMode: (typeof TOOLTIP_MODES)[number]; expandedTooltip: boolean;
  subtitleEnabled: boolean; keys: KeyBindings;
  quality: (typeof QUALITY)[number]; renderScale: number; batterySaver: boolean;
}

const pick = <T>(list: readonly T[], v: unknown, def: T): T => (list.includes(v as T) ? (v as T) : def);
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const byMode = (r.aiModeByGameMode ?? {}) as Record<string, unknown>;
  const vol = Math.round(Number(r.volumeLevel));
  const scale = Number(r.renderScale);
  const tooltipMode = pick(TOOLTIP_MODES, r.tooltipMode, "summary");
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
    resolutionKey: pick(RESOLUTIONS, r.resolutionKey, "1600x900"),
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

/** Corrupt/missing → defaults; never blocks boot. */
export function loadSettings(store: KV): Settings {
  try { return normalizeSettings(JSON.parse(store.getItem(SETTINGS_KEY) ?? "null")); }
  catch { return normalizeSettings(null); }
}

type Listener = (s: Settings) => void;

export interface SettingsStore {
  get(): Settings;
  subscribe(fn: Listener): () => void;
  save(patch: Partial<Settings>): void;
  preview(patch: Partial<Settings>): void;
  resetKeys(ctx?: KeyContext): void;
}

/** Owner: normalize → write once → notify. `preview` notifies immediately and writes after 200 ms. */
export function createSettingsStore(store: KV, onLocale?: (lang: Settings["language"]) => void): SettingsStore {
  let current = loadSettings(store);
  const listeners: Listener[] = [];
  // Bumped by every save/preview; a pending debounced write only fires if still latest.
  let version = 0;
  const write = () => store.setItem(SETTINGS_KEY, JSON.stringify(current));
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
