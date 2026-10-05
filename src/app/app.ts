// App lifecycle recovered around the current screens, state owners and procedural units.
import "../ui/ui.css";
import { APP_VERSION, APP_VERSION_TAG } from "../core/appMeta";
import { getUnit } from "../content/catalog";
import { setLocale } from "../core/i18n";
import { teamStrength } from "../core/inspection";
import { MODE_CONFIG, GAME_MODES, type GameMode } from "../core/modes";
import { enemyPreview, chooseAugment } from "../core/run";
import { AUGMENTS } from "../core/augments";
import { getGameSpeedDisplayMultiplier } from "../core/gameSpeed";
import { recordTutorialEvent } from "../core/tutorial";
import type { KV, Settings } from "../core/settings";
import { createStage, type Stage } from "../world/stage";
import { createLoadingView } from "../ui/screens/loadingView";
import { createMainMenu } from "../ui/screens/mainMenu";
import { createPlanningHud } from "../ui/screens/planningHud";
import { createModalHost } from "../ui/modal";
import { closeModal, disposeModalManager, hasOpenModal, openModal } from "../ui/modalManager";
import { createTooltip } from "../ui/tooltip";
import { mountLibrary } from "../ui/library";
import { mountHistory } from "../ui/history";
import { createCombatHud, openResult } from "../ui/combat";
import { loadKit, h } from "../ui/kit";
import { disposeTree } from "../ui/lifecycle";
import { createPortraits } from "../units/portraits";
import { createBoardView } from "../units/boardView";
import { createCombatFx } from "../units/fx";
import { playCombat, type PlaybackTick, type RosterEntry } from "../units/combatPlayer";
import { createSemanticSfxManager } from "../audio/SoundEffects";
import { createMusicDirector } from "../audio/MusicDirector";
import { registerForestThroneServiceWorker } from "../platform/serviceWorker";
import { createBridge, type Bridge } from "./bridge";

export type Route = "loading" | "menu" | "planning" | "combat";
export interface App { stage: Stage; bridge: Bridge; route(): Route; go(route: Exclude<Route, "loading">): void; dispose(): void }

function browserStore(): KV {
  const fallback = new Map<string, string>();
  return {
    getItem(key) { if (fallback.has(key)) return fallback.get(key)!; try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { fallback.set(key, value); try { localStorage.setItem(key, value); } catch { /* Session fallback remains usable. */ } },
    removeItem(key) { fallback.delete(key); try { localStorage.removeItem(key); } catch { /* Session fallback remains usable. */ } },
  };
}

export async function boot(root: HTMLElement, store: KV = browserStore()): Promise<App> {
  const stage = createStage(root), bridge = createBridge(store);
  setLocale(bridge.settings.get().language);
  const screens = h("div", "recovered-screen"), tooltipLayer = h("div", "layer layer-tooltip");
  root.append(screens, tooltipLayer);
  const tooltip = createTooltip(tooltipLayer), modals = createModalHost(), portraits = createPortraits();
  const sfx = createSemanticSfxManager({ settings: bridge.settings });
  // No bundled audio files were present in either snapshot; avoid requesting invented tracks.
  const music = createMusicDirector({ settings: bridge.settings, playlists: {}, continuityStorage: store });
  let route: Route = "loading", active: (() => void) | null = null, disposed = false, generation = 0;
  const applySettings = (settings: Settings) => {
    setLocale(settings.language); tooltip.setMode(settings.tooltipMode);
    stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.batterySaver ? 1 : 2) * settings.renderScale);
    stage.renderer.shadowMap.enabled = settings.quality !== "low" && !settings.batterySaver;
    stage.arena.setShadowQuality(settings.batterySaver ? "low" : settings.quality);
    stage.renderer.shadowMap.needsUpdate = true;
    stage.renderer.setSize(root.clientWidth || innerWidth, root.clientHeight || innerHeight);
  };
  const offSettings = bridge.settings.subscribe(applySettings);
  applySettings(bridge.settings.get());
  const progressChanged = () => { bridge.forgetRun(); app.go("menu"); };

  const openHistory = (afterClose?: () => void) => {
    tooltip.hide();
    let view: { dispose(): void } | null = null;
    const modal = modals.open({ id: "history", title: "Lịch sử", size: "lg", onClose: () => {
      view?.dispose();
      const state = bridge.run();
      if (route === "planning" && state) { recordTutorialEvent(state, "close_history"); bridge.checkpoint("EVENT", "Đóng lịch sử"); afterClose?.(); }
    } });
    view = mountHistory(modal, bridge.history());
  };
  const openLibrary = () => {
    tooltip.hide();
    let view: { dispose(): void } | null = null;
    const modal = modals.open({ id: "library", title: "Bộ sưu tập", size: "full", onClose: () => view?.dispose() });
    view = mountLibrary(modal, portraits, tooltip);
  };
  const newGame = () => openModal("new-game", (close) => {
    const panel = h("div", "recovery-dialog"), title = h("h2", "", "Chơi mới");
    const mode = document.createElement("select"), ai = document.createElement("select");
    mode.setAttribute("aria-label", "Chế độ"); ai.setAttribute("aria-label", "Độ khó");
    for (const id of GAME_MODES) {
      const option = new Option(id, id); option.disabled = !MODE_CONFIG[id].available; mode.add(option);
    }
    const refreshAi = () => {
      ai.replaceChildren();
      const selected = mode.value as GameMode;
      for (const difficulty of MODE_CONFIG[selected].ai.allowed) ai.add(new Option(difficulty, difficulty));
      ai.value = bridge.settings.get().aiModeByGameMode[selected];
    };
    mode.addEventListener("change", refreshAi); refreshAi();
    const start = h("button", "", "Bắt đầu chơi"), cancel = h("button", "", "Hủy");
    start.addEventListener("click", () => { bridge.newRun(mode.value as GameMode, ai.value); close(); app.go("planning"); });
    cancel.addEventListener("click", close); panel.append(title, mode, ai, start, cancel); return panel;
  });

  const power = (roster: RosterEntry[], side: "L" | "R") => teamStrength(roster.filter((unit) => unit.side === side).map((unit) => {
    const definition = getUnit(unit.baseId), stats = definition.stats;
    return { ...stats, hp: unit.hp, maxHp: unit.maxHp, shield: unit.shield, alive: unit.hp > 0, star: unit.star, tier: definition.tier };
  }));

  function planning(): () => void {
    const state = bridge.run();
    if (!state) { app.go("menu"); return () => {}; }
    enemyPreview(state);
    const hud = createPlanningHud({ state, stage, kvStore: store, settingsStore: bridge.settings,
      onStartCombat: () => { if (!hasOpenModal()) app.go("combat"); }, onMainMenu: () => app.go("menu"),
      onProgressChange: progressChanged, onNewRun: newGame, onHistory: () => openHistory(() => hud.sync()),
      onMutation: (category, message) => { bridge.checkpoint(category, message); void sfx.play(category === "SHOP" ? "buy" : "click"); },
    });
    screens.append(hud.root);
    bridge.checkpoint("EVENT", `Vòng ${state.round}`);
    if (state.phase === "AUGMENT") openModal("augment", (close) => {
      const panel = h("div", "recovery-dialog"); panel.append(h("h2", "", "Chọn nâng cấp"));
      for (const id of state.activeAugmentChoices) {
        const augment = AUGMENTS.find((entry) => entry.id === id);
        const button = h("button", "", `${id}: ${augment?.effect ?? ""} ${augment?.value ?? ""}`);
        button.addEventListener("click", () => { if (chooseAugment(state, id)) { bridge.checkpoint("EVENT", `Nâng cấp ${id}`); close(); hud.sync(); } });
        panel.append(button);
      }
      return panel;
    }, { dismissible: false });
    return () => { disposeTree(hud.root); hud.dispose(); };
  }

  function combat(): (() => void) | null {
    const state = bridge.run(), round = state?.round ?? 1, session = bridge.startCombat();
    if (!state || !session) return null;
    const token = generation, board = createBoardView(stage), fx = createCombatFx(stage.scene);
    board.sync(state); board.setCombat(true);
    for (const unit of session.roster) board.setLive(unit.uid, unit);
    let speedLevel = 0, tick: PlaybackTick | null = null;
    const hud = createCombatHud(screens, { speed: () => { speedLevel = (speedLevel + 1) % 11; player.setSpeed(speedLevel); refresh(); }, history: () => openHistory() });
    function refresh() {
      const all = tick?.all ?? session!.roster;
      hud.update({ round, cycle: tick?.cycle ?? 1, speed: getGameSpeedDisplayMultiplier(speedLevel), escalation: 1,
        left: power(all, "L"), right: power(all, "R"), log: tick?.log ?? [],
        queue: (tick?.queue ?? []).flatMap((uid) => { const unit = all.find((entry) => entry.uid === uid); return unit ? [{ name: getUnit(unit.baseId).nameVi, side: unit.side, icon: "⚔️" }] : []; }),
      });
    }
    const player = playCombat({ board, fx, roster: session.roster, events: session.events,
      onFrame: stage.addUpdateHook, onTick: (value) => { tick = value; refresh(); },
      onEvent: (event) => { void sfx.play(event.t === "death" ? "ko" : event.t === "basic" ? "hit" : event.t === "heal" ? "heal" : "skill"); },
    });
    void player.done.then(() => {
      if (disposed || generation !== token || route !== "combat") return;
      const result = session.finish(); if (!result) return;
      void sfx.play(result.winner === "LEFT" ? "victory" : result.winner === "RIGHT" ? "defeat" : "draw");
      openResult(modals, round, result, () => app.go(result.gameOver ? "menu" : "planning"));
    });
    return () => { player.dispose(); board.dispose(); fx.dispose(); disposeTree(screens); hud.dispose(); };
  }

  const app: App = {
    stage, bridge, route: () => route,
    go(next) {
      if (disposed) return;
      generation++; closeModal(); tooltip.hide(); active?.(); active = null;
      disposeTree(screens); screens.replaceChildren(); route = next; root.dataset.route = next;
      stage.setPhase(next === "combat" ? "combat" : next === "planning" ? "planning" : "menu");
      music.play(next);
      if (next === "menu") {
        const menu = createMainMenu({ kvStore: store, settingsStore: bridge.settings, onNewGame: newGame,
          onContinue: () => { if (bridge.continueRun()) app.go("planning"); }, onOpenLibrary: openLibrary, onProgressChange: progressChanged });
        menu.querySelector<HTMLElement>(".ft-menu-card > div:last-child")!.textContent = APP_VERSION_TAG;
        screens.append(menu); active = () => { disposeTree(menu); menu.remove(); };
      } else if (next === "planning") active = planning();
      else { active = combat(); if (!active) app.go("planning"); }
    },
    dispose() {
      if (disposed) return; disposed = true; generation++;
      active?.(); offSettings(); tooltip.dispose(); portraits.dispose(); sfx.dispose(); music.dispose();
      disposeModalManager(); disposeTree(root); stage.dispose(); screens.remove(); tooltipLayer.remove();
    },
  };
  const loading = createLoadingView({ onReady: () => { if (!disposed) app.go("menu"); } });
  screens.append(loading.element); active = () => { loading.dispose(); disposeTree(loading.element); loading.element.remove(); };
  root.dataset.route = "loading";
  try { await loadKit((progress) => loading.setProgress(progress * .9)); }
  catch { /* Decorative kit failure does not stop the current canvas-chrome menu. */ }
  if (!disposed) loading.setProgress(1);
  void registerForestThroneServiceWorker({ production: import.meta.env.PROD, appVersion: APP_VERSION }).catch(() => undefined);
  return app;
}
