// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange } from "../core/i18n";
import { boardCount } from "../core/run";
import { h, kitButton } from "../ui/kit";
import { createPlanningHud } from "../ui/planning";
import type { PortraitProvider } from "../ui/card";
import { applyLocale, registerScreen, registerUtility } from "./app";
import { runView } from "./bridge";
import { createBoardView } from "../units/boardView";

/** Replaced by the 3D portrait renderer once unit rigs are mounted (src/units/portraits.ts). */
let portraits: PortraitProvider = { get: () => null, onReady: () => () => {} };
export function setPortraitProvider(p: PortraitProvider) { portraits = p; }

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  const hud = createPlanningHud(app.layers.hud, app.tooltip, portraits, {
    buy: (slot) => bridge.buy(slot),
    details: (id) => app.openPanel("unit-detail", id),
    reroll: () => bridge.reroll(),
    buyXp: () => bridge.buyXp(),
    toggleLock: () => bridge.toggleLock(),
    start: () => bridge.startCombat(),
    action: (id) => app.openPanel(id),
    // LOGIC: A39 cortisol dance timer/state; visual hook only.
    cortisol: () => {},
    pan: (x, y) => stage.setPan(x, y),
  });
  const sync = () => {
    const run = bridge.run();
    if (!run) return;
    board.sync(run);
    hud.update({
      run, synergies: runView.synergies(run), benchCap: runView.benchCap(run),
      deployLimit: runView.deployLimit(run), deployed: boardCount(run),
      locked: app.modals.blocking() || run.phase !== "PLANNING",
    });
  };
  const offs = [bridge.onChange(sync), app.modals.onChange(sync), onLocaleChange(() => hud.refreshCopy())];
  sync();
  return { dispose() { for (const o of offs) o(); hud.dispose(); board.dispose(); } };
});

// Language: one control opens the list; selecting refreshes copy immediately (A98).
registerUtility("language", (app) => {
  const m = app.modals.open({ id: "language", title: t("menu.language"), size: "sm", closeLabel: t("ui.close") });
  const list = h("div", "choice-list");
  const names: Record<string, string> = { vi: "Tiếng Việt", en: "English" };
  for (const l of LOCALES) {
    const b = kitButton({ skin: "blue", label: names[l] ?? l, onClick: () => {
      // LOGIC: persist via SettingsStore.save({ language }) once settings wiring lands.
      applyLocale(l);
      m.close();
    } });
    b.setSelected(l === getLocale());
    list.append(b.el);
  }
  m.body.append(list);
});
