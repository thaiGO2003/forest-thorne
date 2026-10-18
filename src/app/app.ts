// App shell (§4, A64, A115): loading → menu → planning. Owns UI layers, modal host, tooltip and
// the 3D stage; each screen is created on entry and disposed on exit so nothing resurrects.
import "../ui/ui.css";
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/vietnamese-400.css";
import "@fontsource/noto-sans/latin-700.css";
import "@fontsource/noto-sans/vietnamese-700.css";
import "@fontsource/noto-sans/latin-900.css";
import "@fontsource/noto-sans/vietnamese-900.css";
import { t, setLocale, onLocaleChange, type Locale } from "../core/i18n";
import { createStage, type Stage } from "../world/stage";
import { h, loadKit } from "../ui/kit";
import { createModalHost, type ModalHost } from "../ui/modal";
import { createTooltip, type Tooltip } from "../ui/tooltip";
import { createLoading } from "../ui/loading";
import { createMenu, type UtilityId } from "../ui/menu";
import { createBridge, type Bridge } from "./bridge";
import { createMusicDirector, type MusicDirector, type MusicPlaylists, type MusicTrack as DirectorTrack } from "../audio/MusicDirector";
import { MUSIC_TRACKS, MUSIC_PLAYLISTS } from "../data/musicPlaylists";
import type { RosterEntry } from "../units/combatPlayer";

/** Map the authored catalog (track keys + alternating fallback sources) onto the director. */
function authoredMusicPlaylists(): MusicPlaylists {
  const probe = typeof Audio !== "undefined" ? new Audio() : null;
  const firstSrc = (key: string) => {
    const track = MUSIC_TRACKS[key];
    if (!track) return null;
    // Prefer the first source the current browser can actually decode (A45 source fallbacks).
    for (const src of track.sources) {
      if (!probe) return src;
      const ext = src.slice(src.lastIndexOf(".") + 1);
      const mime = ext === "ogg" ? "audio/ogg" : "audio/mpeg";
      if (probe.canPlayType(mime) !== "") return src;
    }
    return track.sources[0] ?? null;
  };
  const toTracks = (keys: readonly string[]): DirectorTrack[] => keys.flatMap((key) => {
    const src = firstSrc(key);
    return src ? [{ key, src, source: MUSIC_TRACKS[key]?.source, longPlay: MUSIC_TRACKS[key]?.longPlay }] : [];
  });
  return {
    menu: { id: "menu", tracks: toTracks(MUSIC_PLAYLISTS.menu.tracks), shuffle: MUSIC_PLAYLISTS.menu.shuffle },
    planning: { id: "planning", tracks: toTracks(MUSIC_PLAYLISTS.planning.tracks), shuffle: MUSIC_PLAYLISTS.planning.shuffle },
    combat: { id: "combat", tracks: toTracks(MUSIC_PLAYLISTS.combat.tracks), shuffle: MUSIC_PLAYLISTS.combat.shuffle },
    victory: { id: "victory", tracks: [], shuffle: false },
    defeat: { id: "defeat", tracks: [], shuffle: false },
    ambient: { id: "ambient", tracks: [], shuffle: false },
  };
}

export type Route = "loading" | "menu" | "planning";

export interface App {
  stage: Stage; modals: ModalHost; tooltip: Tooltip; bridge: Bridge; music: MusicDirector;
  presentation: {
    combatCycle: number | null;
    liveRoster: Map<string, RosterEntry>;
    openOwnedInventory: ((uid: string) => void) | null;
  };
  route(): Route;
  go(r: Route): void;
  /** Open a registered panel (planning action, unit detail…); unknown ids are ignored. */
  openPanel(id: string, arg?: string): void;
  layers: { screen: HTMLElement; hud: HTMLElement; modal: HTMLElement; tooltip: HTMLElement };
}

/** Panels: modal surfaces opened by id from any screen (Library, Tech, History, unit detail…). */
export type PanelOpener = (app: App, arg?: string) => void;
const panels: Partial<Record<string, PanelOpener>> = {};
export function registerPanel(id: string, open: PanelOpener) { panels[id] = open; }

/** Hook for screens that live in other modules (planning/library) to register without cycles. */
export type ScreenFactory = (app: App) => { dispose(): void };
const screens: Partial<Record<Route, ScreenFactory>> = {};
export function registerScreen(r: Route, f: ScreenFactory) { screens[r] = f; }

/** Utility modals register here; menu buttons without a registered opener show nothing. */
const utilities: Partial<Record<UtilityId, (app: App) => void>> = {};
export function registerUtility(id: UtilityId, open: (app: App) => void) { utilities[id] = open; }

const UI_FONT_SAMPLE = "Bá Chủ Khu Rừng — Tiếng Việt đầy đủ dấu";

async function ensureUiFontLoaded(): Promise<void> {
  await Promise.all([400, 700, 900].map((weight) =>
    document.fonts.load(`${weight} 16px "Noto Sans"`, UI_FONT_SAMPLE),
  ));
}

export async function boot(root: HTMLElement): Promise<App> {
  await ensureUiFontLoaded();
  const stage = createStage(root);
  const ui = h("div", "ui-root");
  const mk = (cls: string) => { const l = h("div", `layer ${cls}`); ui.append(l); return l; };
  const layers = { screen: mk("layer-screen"), hud: mk("layer-hud"), modal: mk("layer-modal"), tooltip: mk("layer-tooltip") };
  layers.modal.dataset.open = "false";
  root.append(ui);

  const modals = createModalHost(layers.modal);
  const tooltip = createTooltip(layers.tooltip);
  const bridge = createBridge();
  const music: MusicDirector = createMusicDirector({
    settings: bridge.settings,
    playlists: authoredMusicPlaylists(),
    continuityStorage: typeof localStorage === "undefined" ? null : localStorage,
  });
  const applySettings = () => {
    const settings = bridge.settings.get();
    ui.style.zoom = String(settings.guiScale);
    stage.setFpsLimit(settings.fpsLimit);
    stage.setShadowQuality(settings.quality);
    stage.setShadowsEnabled(settings.shadowsEnabled);
    stage.setRenderScale(settings.renderScale);
    tooltip.setMode(settings.tooltipMode);
    document.documentElement.lang = settings.language;
  };
  bridge.settings.subscribe(applySettings);
  applySettings();
  let current: Route = "loading";
  let active: { dispose(): void } | null = null;
  const presentation = {
    combatCycle: null as number | null,
    liveRoster: new Map<string, RosterEntry>(),
    openOwnedInventory: null as ((uid: string) => void) | null,
  };

  const app: App = {
    stage, modals, tooltip, bridge, music, layers, presentation,
    route: () => current,
    openPanel(id, arg) { panels[id]?.(app, arg); },
    go(r) {
      active?.dispose();
      active = null;
      modals.closeActive();
      tooltip.hide();
      current = r;
      root.dataset.route = r;
      stage.setPhase(r === "planning" ? "planning" : "menu");
      music.play(r === "planning" ? "planning" : "menu");
      if (r === "menu") active = mountMenu();
      else active = screens[r]?.(app) ?? null;
      // Context-aware BGM (A45): scene/context change calls play(context).
      if (r !== "loading") music.play(r);
    },
  };

  function mountMenu() {
    const menu = createMenu(layers.screen, modals, tooltip, {
      continueRun: () => { if (bridge.continueRun()) app.go("planning"); },
      newRun: (mode, ai) => { bridge.newRun(mode, ai); app.go("planning"); },
      importRun: (text) => {
        if (!bridge.importRun(text)) return false;
        app.go("planning");
        return true;
      },
      clearBrokenRun: () => { bridge.clearBrokenRun(); menu.update({ save: bridge.saveSummary(), version: __APP_VERSION__ }); },
      openUtility: (id) => (utilities[id] ? utilities[id](app) : app.openPanel(id)),
    }, { save: bridge.saveSummary(), version: __APP_VERSION__ });
    const off = onLocaleChange(() => menu.refreshCopy());
    return { dispose() { off(); menu.dispose(); } };
  }

  // Loading: real progress = kit images (90%) + first stage frame (10%).
  root.dataset.route = "loading";
  const loading = createLoading(layers.screen, {
    title: t("loading.title"),
    hint: t("loading.hint"),
    tips: [t("loading.tip1"), t("loading.tip2"), t("loading.tip3"), t("loading.tip4")],
  });
  const nextFrames = () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    return promise;
  };
  const run = async () => {
    try {
      loading.setProgress(0, t("loading.assets"));
      await loadKit((p) => loading.setProgress(p * 0.9, t("loading.assets")));
      loading.setProgress(0.95, t("loading.world"));
      await nextFrames();
      loading.setProgress(1, t("loading.world"));
      loading.dispose();
      app.go("menu");
    } catch {
      loading.fail(t("loading.failed"), { retryLabel: t("loading.retry"), retry: () => void run() });
    }
  };
  await run();
  return app;
}

export function applyLocale(l: Locale) { setLocale(l); document.documentElement.lang = l; }
