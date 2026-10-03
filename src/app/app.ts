// App shell (§4, A64, A115): loading → menu → planning. Owns UI layers, modal host, tooltip and
// the 3D stage; each screen is created on entry and disposed on exit so nothing resurrects.
import "../ui/ui.css";
import { t, setLocale, onLocaleChange, type Locale } from "../core/i18n";
import { createStage, type Stage } from "../world/stage";
import { h, loadKit } from "../ui/kit";
import { createModalHost, type ModalHost } from "../ui/modal";
import { createTooltip, type Tooltip } from "../ui/tooltip";
import { createLoading } from "../ui/loading";
import { createMenu, type UtilityId } from "../ui/menu";
import { createPlaceholderBridge, type Bridge } from "./bridge";
import { bootTransitionDelay, createRequestGate, waitMs } from "./loadLifecycle";
import { handleGameShortcut } from "./shortcuts";

export type Route = "loading" | "menu" | "planning";

export interface App {
  stage: Stage; modals: ModalHost; tooltip: Tooltip; bridge: Bridge;
  route(): Route;
  go(r: Route): void;
  dispose(): void;
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

export async function boot(root: HTMLElement): Promise<App> {
  const stage = createStage(root);
  const ui = h("div", "ui-root");
  const mk = (cls: string) => { const l = h("div", `layer ${cls}`); ui.append(l); return l; };
  const layers = { screen: mk("layer-screen"), hud: mk("layer-hud"), modal: mk("layer-modal"), tooltip: mk("layer-tooltip") };
  layers.modal.dataset.open = "false";
  root.append(ui);

  const modals = createModalHost(layers.modal);
  const tooltip = createTooltip(layers.tooltip);
  const bridge = createPlaceholderBridge();
  let current: Route = "loading";
  let active: { dispose(): void } | null = null;
  let destroyed = false;
  const loadingGate = createRequestGate();
  let loading: ReturnType<typeof createLoading> | null = null;

  const app: App = {
    stage, modals, tooltip, bridge, layers,
    route: () => current,
    openPanel(id, arg) { panels[id]?.(app, arg); },
    go(r) {
      if (destroyed) return;
      if (current === "loading" && r !== "loading") {
        loadingGate.invalidate();
        loading?.dispose();
        loading = null;
      }
      active?.dispose();
      active = null;
      modals.closeActive();
      tooltip.hide();
      current = r;
      root.dataset.route = r;
      stage.setPhase(r === "planning" ? "planning" : "menu");
      if (r === "menu") active = mountMenu();
      else active = screens[r]?.(app) ?? null;
    },
    dispose() {
      if (destroyed) return;
      destroyed = true;
      loadingGate.dispose();
      loading?.dispose();
      loading = null;
      active?.dispose();
      active = null;
      modals.closeActive();
      tooltip.hide();
      stage.dispose();
      ui.remove();
    },
  };

  function mountMenu() {
    const menu = createMenu(layers.screen, modals, tooltip, {
      continueRun: () => { if (bridge.continueRun()) app.go("planning"); },
      newRun: (mode, ai) => { if (bridge.newRun(mode, ai)) app.go("planning"); },
      clearBrokenRun: () => { bridge.clearBrokenRun(); menu.update({ save: bridge.saveSummary(), version: __APP_VERSION__ }); },
      openUtility: (id) => (utilities[id] ? utilities[id](app) : app.openPanel(id)),
    }, { save: bridge.saveSummary(), version: __APP_VERSION__ });
    const off = onLocaleChange(() => menu.refreshCopy());
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && (
        target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
      );
      handleGameShortcut({
        key: event.key, repeat: event.repeat, defaultPrevented: event.defaultPrevented,
        ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, editing,
        preventDefault: () => event.preventDefault(),
      }, bridge.settings.get(), "menu", { phase: bridge.run()?.phase ?? "PLANNING" }, {
        close: () => modals.closeActive(),
      });
    };
    window.addEventListener("keydown", onKey);
    return { dispose() { window.removeEventListener("keydown", onKey); off(); menu.dispose(); } };
  }

  // Loading: real progress = kit images (90%) + first stage frame (10%).
  root.dataset.route = "loading";
  const loadingVisibleSince = performance.now();
  loading = createLoading(layers.screen, { title: t("loading.title"), hint: t("loading.hint") });
  const nextFrames = () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    return promise;
  };
  const run = async () => {
    const token = loadingGate.begin();
    if (token < 0 || !loading) return;
    const view = loading;
    try {
      view.setProgress(0, t("loading.assets"));
      await loadKit((p) => { if (loadingGate.isCurrent(token)) view.setProgress(p * 0.9, t("loading.assets")); });
      if (!loadingGate.isCurrent(token)) return;
      view.setProgress(0.95, t("loading.world"));
      await nextFrames();
      if (!loadingGate.isCurrent(token)) return;
      view.setProgress(1, t("loading.world"));
      await waitMs(bootTransitionDelay(loadingVisibleSince, performance.now()));
      if (!loadingGate.isCurrent(token)) return;
      app.go("menu");
    } catch {
      if (!loadingGate.isCurrent(token)) return;
      view.fail(t("loading.failed"), { retryLabel: t("loading.retry"), retry: () => void run() });
    }
  };
  await run();
  return app;
}

export function applyLocale(l: Locale) { setLocale(l); document.documentElement.lang = l; }
