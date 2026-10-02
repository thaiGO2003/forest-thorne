// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange } from "../core/i18n";
import { boardCount } from "../core/run";
import { h, kitButton } from "../ui/kit";
import { createPlanningHud } from "../ui/planning";
import { mountLibrary } from "../ui/library";
import { applyLocale, registerPanel, registerScreen, registerUtility, type App } from "./app";
import { runView } from "./bridge";
import { createBoardView } from "../units/boardView";
import { createPortraits } from "../units/portraits";
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { STAR_STAT } from "../core/economy";
import { teamStrength } from "../core/inspection";
import { createCombatHud, openResult, type CombatHudView } from "../ui/combat";
import { createCombatFx, type CombatFx } from "../units/fx";
import { playCombat, type CombatPlayer, type RosterEntry } from "../units/combatPlayer";

/** One shared portrait renderer: card snapshots + live Library viewer use the real unit rigs. */
const portraits = createPortraits();

const openLibrary = (app: App, id?: string) => {
  const m = app.modals.open({ id: "library", title: t("menu.library"), size: "full", closeLabel: t("ui.close") });
  const lib = mountLibrary(m, portraits, app.tooltip, id);
  const off = app.modals.onChange((active) => { if (active !== "library") { off(); lib.dispose(); } });
};
registerPanel("library", (app) => openLibrary(app));
registerPanel("unit-detail", (app, id) => openLibrary(app, id));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  const hud = createPlanningHud(app.layers.hud, app.tooltip, portraits, {
    buy: (slot) => bridge.buy(slot),
    details: (id) => app.openPanel("unit-detail", id),
    reroll: () => bridge.reroll(),
    buyXp: () => bridge.buyXp(),
    toggleLock: () => bridge.toggleLock(),
    start: () => runCombat(),
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

  // Combat: logic resolves the battle; presentation swaps HUDs, replays events, then shows the result.
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx } | null = null;
  const endCombat = () => {
    if (!combat) return;
    combat.player.dispose(); combat.hud.dispose(); combat.fx.dispose();
    combat = null;
    board.setCombat(false);
    hud.el.hidden = false;
    stage.setPhase("planning");
  };
  function runCombat() {
    if (combat || app.modals.blocking()) return;
    const session = bridge.startCombat();
    if (!session) return;
    const run = bridge.run();
    hud.el.hidden = true;
    stage.setPhase("combat");
    board.setCombat(true);
    const fx = createCombatFx(stage.scene);
    let speed = 1;
    const chud = createCombatHud(app.layers.hud, {
      speed: () => { speed = speed >= 4 ? 1 : speed * 2; combat?.player.setSpeed(speed); },
      history: () => app.openPanel("history"),
    });
    const strength = (list: RosterEntry[]) => teamStrength(list.map((r) => {
      const u = getUnit(r.baseId), k = STAR_STAT[r.star] ?? 1;
      return { hp: r.hp, maxHp: r.maxHp, shield: r.shield, atk: u.stats.atk * k, matk: u.stats.matk * k, def: u.stats.def * k, mdef: u.stats.mdef * k, star: r.star, tier: u.tier, alive: r.hp > 0 };
    }));
    const player = playCombat({
      board, fx, roster: session.roster, events: session.events, onFrame: stage.onFrame,
      onTick: (tk) => chud.update({
        round: run?.round ?? 1, cycle: tk.cycle, speed,
        // LOGIC: anti-stall multiplier (A17) belongs to canonical combat; expose it on the session.
        escalation: 1,
        left: strength(tk.all.filter((r) => r.side === "L")), right: strength(tk.all.filter((r) => r.side === "R")),
        queue: tk.queue.map((uid) => { const r = tk.all.find((x) => x.uid === uid); return { name: r ? getUnit(r.baseId).nameVi : uid, side: r?.side ?? "L", icon: r ? ICONS[getUnit(r.baseId).role] : "❔" }; }),
        log: tk.log,
      }),
    });
    combat = { player, hud: chud, fx };
    void player.done.then(() => {
      if (!combat || combat.player !== player) return;
      const summary = session.finish();
      const round = run?.round ?? 1;
      endCombat();
      if (!summary) { sync(); return; }
      openResult(app.modals, round, summary, () => (summary.gameOver ? app.go("menu") : sync()));
    });
  }

  const offs = [bridge.onChange(sync), app.modals.onChange(sync), onLocaleChange(() => hud.refreshCopy())];
  sync();
  return { dispose() { endCombat(); for (const o of offs) o(); hud.dispose(); board.dispose(); } };
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
