// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange, type MsgKey } from "../core/i18n";
import { boardCount } from "../core/run";
import { activeIndices, RECIPES } from "../core/craft";
import { getEquipment } from "../core/equipment";
import { AUGMENT_BY_ID } from "../core/augments";
import { normalizeKey } from "../core/settings";
import { h, kitButton } from "../ui/kit";
import { createPlanningHud } from "../ui/planning";
import { mountLibrary } from "../ui/library";
import { mountSettings } from "../ui/settings";
import { mountTechTree } from "../ui/techTree";
import { mountHistory } from "../ui/history";
import type { ModalHandle, ModalOptions } from "../ui/modal";
import { applyLocale, registerPanel, registerScreen, registerUtility, type App } from "./app";
import { runView } from "./bridge";
import { createBoardView } from "../units/boardView";
import { createPortraits } from "../units/portraits";
import { createPlanningDragController } from "./planningDrag";
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { STAR_STAT } from "../core/economy";
import { teamStrength } from "../core/inspection";
import { createCombatHud, openResult, type CombatHudView } from "../ui/combat";
import { createCombatFx, type CombatFx } from "../units/fx";
import { playCombat, type CombatPlayer, type RosterEntry } from "../units/combatPlayer";

/** One shared portrait renderer: card snapshots + live Library viewer use the real unit rigs. */
const portraits = createPortraits();

/** Open a modal panel whose view lives exactly as long as the modal (closed or replaced → disposed). */
function openPanelModal(app: App, o: ModalOptions, mount: (m: ModalHandle) => { dispose(): void }) {
  const m = app.modals.open({ closeLabel: t("ui.close"), ...o });
  const view = mount(m);
  const off = app.modals.onChange((active) => { if (active !== o.id) { off(); view.dispose(); } });
}

const ITEM_COPY: Partial<Record<string, MsgKey>> = {
  eq_warmog_armor: "item.eq_warmog_armor",
  eq_blue_buff: "item.eq_blue_buff",
  tear: "item.tear",
};
const itemName = (id: string) => ITEM_COPY[id] ? t(ITEM_COPY[id]!) : id;

function mountInventory(app: App, m: ModalHandle) {
  const render = () => {
    const run = app.bridge.run();
    m.body.replaceChildren();
    if (!run) return;
    const root = h("div", "stack");
    const itemsTitle = h("strong");
    itemsTitle.textContent = t("planning.items");
    root.append(itemsTitle);
    const bag = h("div", "row");
    for (const id of run.itemBag) {
      const item = h("div", "slot");
      item.textContent = itemName(id);
      bag.append(item);
    }
    if (!run.itemBag.length) {
      const empty = h("div", "slot");
      empty.textContent = t("planning.empty");
      bag.append(empty);
    }
    root.append(bag);

    const equipmentBag = [...new Set(run.itemBag.filter((id) => getEquipment(id) !== null))];
    const groups = [
      { title: t("planning.boardUnits"), where: "board" as const, units: run.board },
      { title: t("planning.benchUnits"), where: "bench" as const, units: run.bench },
    ];
    for (const group of groups) {
      const heading = h("strong");
      heading.textContent = group.title;
      root.append(heading);
      for (let index = 0; index < group.units.length; index++) {
        const unit = group.units[index];
        if (!unit) continue;
        const slot = h("div", "slot");
        const title = h("div");
        title.textContent = `${index + 1}. ${getUnit(unit.baseId).nameVi} ★${unit.star}`;
        const actions = h("div", "row");
        const sell = kitButton({
          skin: "wood",
          label: t("planning.sell"),
          onClick: () => { app.bridge.sell(group.where, index); },
        });
        actions.append(sell.el);
        unit.equips.forEach((itemId, equippedIndex) => {
          const unequip = kitButton({
            skin: "plum",
            label: `${t("planning.unequip")} ${itemName(itemId)}`,
            onClick: () => { app.bridge.unequip(group.where, index, equippedIndex); },
          });
          actions.append(unequip.el);
        });
        for (const itemId of equipmentBag) {
          const item = getEquipment(itemId);
          if (!item) continue;
          const equip = kitButton({
            skin: "green",
            label: `${t("planning.equip")} ${itemName(itemId)}`,
            onClick: () => { app.bridge.equip(itemId, group.where, index); },
          });
          equip.setDisabled(item.tier > unit.star);
          actions.append(equip.el);
        }
        slot.append(title, actions);
        root.append(slot);
      }
    }
    m.body.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
}

function mountCraft(app: App, m: ModalHandle) {
  const render = () => {
    const run = app.bridge.run();
    m.body.replaceChildren();
    if (!run) return;
    const staged = app.bridge.craftStaging();
    const root = h("div", "stack");
    const materialsTitle = h("strong");
    materialsTitle.textContent = t("planning.materials");
    root.append(materialsTitle);
    const materials = [...new Set(run.itemBag.filter((id) => getEquipment(id) === null))];
    for (const index of activeIndices(run.craftTableLevel)) {
      const slot = h("div", "slot");
      const title = h("div");
      title.textContent = `${t("planning.craftSlot", { slot: index + 1 })}: ${staged[index] ? itemName(staged[index]!) : t("planning.empty")}`;
      const actions = h("div", "row");
      for (const material of materials) {
        const add = kitButton({
          skin: "blue",
          label: itemName(material),
          onClick: () => { app.bridge.stageCraft(index, material); },
        });
        actions.append(add.el);
      }
      slot.append(title, actions);
      root.append(slot);
    }
    const craft = kitButton({
      skin: "green",
      label: t("planning.craftNow"),
      onClick: () => { app.bridge.craft(); },
    });
    craft.setDisabled(staged.every((item) => item === null));
    root.append(craft.el);
    m.body.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
}

function mountRecipes(m: ModalHandle) {
  const root = h("div", "choice-list");
  for (const recipe of RECIPES) {
    const row = h("div", "slot");
    row.textContent = `${recipe.pattern.map((id) => id ? itemName(id) : t("planning.empty")).join(" + ")} → ${itemName(`eq_${recipe.id}`)}`;
    root.append(row);
  }
  m.body.append(root);
  return { dispose() {} };
}

function mountAugments(app: App, m: ModalHandle) {
  const render = () => {
    const run = app.bridge.run();
    m.body.replaceChildren();
    if (!run || run.phase !== "AUGMENT") return;
    const root = h("div", "choice-list");
    for (const id of run.activeAugmentChoices) {
      const def = AUGMENT_BY_ID.get(id);
      const row = h("div", "slot");
      const copy = h("div");
      copy.textContent = def ? `${id} · ${def.effect} ${def.value >= 0 ? "+" : ""}${def.value}` : id;
      const choose = kitButton({
        skin: "green",
        label: t("planning.choose"),
        onClick: () => { if (app.bridge.chooseAugment(id)) m.close(); },
      });
      row.append(copy, choose.el);
      root.append(row);
    }
    m.body.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
}

const openLibrary = (app: App, id?: string) =>
  openPanelModal(app, { id: "library", title: t("menu.library"), size: "full" }, (m) => mountLibrary(m, portraits, app.tooltip, id));
registerPanel("library", (app) => openLibrary(app));
registerPanel("unit-detail", (app, id) => openLibrary(app, id));
registerPanel("settings", (app) =>
  openPanelModal(app, { id: "settings", title: t("menu.settings"), size: "lg" }, (m) =>
    mountSettings(m, app.bridge.settings, { hasRun: app.bridge.saveSummary().kind !== "none", clearRun: () => app.bridge.clearRun() })));
registerPanel("history", (app) =>
  openPanelModal(app, { id: "history", title: t("planning.history"), size: "lg" }, (m) => mountHistory(m, app.bridge.history())));
registerPanel("tech", (app) => {
  const run = app.bridge.run();
  if (!run) return;
  openPanelModal(app, { id: "tech", title: t("planning.tech"), size: "full" }, (m) => {
    const view = mountTechTree(m, { levels: run.techLevels, gold: run.gold }, (id) => app.bridge.research(id));
    const off = app.bridge.onChange(() => { const r = app.bridge.run(); if (r) view.update({ levels: r.techLevels, gold: r.gold }); });
    return { dispose() { off(); view.dispose(); } };
  });
});
registerPanel("inventory", (app) =>
  openPanelModal(app, { id: "inventory", title: t("planning.inventory"), size: "lg" }, (m) => mountInventory(app, m)));
registerPanel("craft", (app) =>
  openPanelModal(app, { id: "craft", title: t("planning.craft"), size: "lg" }, (m) => mountCraft(app, m)));
registerPanel("recipes", (app) =>
  openPanelModal(app, { id: "recipes", title: t("planning.recipes"), size: "lg" }, mountRecipes));
registerPanel("augment", (app) =>
  openPanelModal(app, { id: "augment", title: t("planning.augment"), size: "lg", dismissible: false }, (m) => mountAugments(app, m)));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx } | null = null;
  const drag = createPlanningDragController({
    stage,
    board,
    getRun: () => bridge.run(),
    move: (from, to) => bridge.move(from, to),
    select: (source) => {
      const unit = bridge.run()?.board[source.index];
      if (!unit) return;
      app.openPanel("unit-detail", unit.baseId);
      bridge.tutorialEvent("show_attack_preview", "show_attack_preview", {
        source: { where: "board", index: source.index },
      });
    },
    enabled: () => !combat && !app.modals.blocking() && bridge.run()?.phase === "PLANNING",
  });
  const hud = createPlanningHud(app.layers.hud, app.tooltip, portraits, {
    buy: (slot) => bridge.buy(slot),
    details: (id) => app.openPanel("unit-detail", id),
    reroll: () => bridge.reroll(),
    buyXp: () => bridge.buyXp(),
    toggleLock: () => bridge.toggleLock(),
    start: () => runCombat(),
    action: (id) => app.openPanel(id),
    tutorialDismiss: (stepId) => bridge.dismissTutorial(stepId),
    tutorialSkip: () => bridge.skipTutorial(),
    // LOGIC: A39 cortisol dance timer/state; visual hook only.
    cortisol: () => {},
    pan: (x, y) => stage.setPan(x, y),
  });
  const sync = () => {
    const run = bridge.run();
    if (!run) return;
    const preview = bridge.prepareEnemyPreview();
    const renderRun = preview && preview.units !== run.enemyPreview ? { ...run, enemyPreview: preview.units } : run;
    const locked = app.modals.blocking() || run.phase !== "PLANNING";
    if (locked) drag.cancel();
    board.sync(renderRun);
    const craftGrid = bridge.craftStaging();
    hud.update({
      run, synergies: runView.synergies(run), benchCap: runView.benchCap(run),
      deployLimit: runView.deployLimit(run), deployed: boardCount(run),
      locked,
      tutorial: bridge.tutorialStep({
        craftGrid,
        settingsVisible: app.modals.active() === "settings",
        historyVisible: app.modals.active() === "history",
      }),
    });
    if (!combat && run.phase === "AUGMENT" && !app.modals.blocking()) app.openPanel("augment");
  };

  // Combat: logic resolves the battle; presentation swaps HUDs, replays events, then shows the result.
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

  let previousModal = app.modals.active();
  const onModalChange = (active: string | null) => {
    const previous = previousModal;
    previousModal = active;
    let recorded = false;
    if (previous === "history" && active !== "history") recorded = bridge.tutorialEvent("toggle_history", "close_history") || recorded;
    if (previous === "settings" && active !== "settings") recorded = bridge.tutorialEvent("close_settings", "close_settings") || recorded;
    if (active === "history" && previous !== "history") recorded = bridge.tutorialEvent("toggle_history", "open_history") || recorded;
    if (active === "settings" && previous !== "settings") recorded = bridge.tutorialEvent("open_settings", "open_settings") || recorded;
    if (!recorded) sync();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || combat || app.modals.blocking()) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
    )) return;
    const key = normalizeKey(event.key === " " ? "SPACE" : event.key);
    if (!key) return;
    const bindings = bridge.settings.get().keys.planning;
    if (key === bindings.startCombat) {
      event.preventDefault();
      runCombat();
    } else if (key === bindings.reroll) {
      event.preventDefault();
      bridge.reroll();
    } else if (key === bindings.buyXp) {
      event.preventDefault();
      bridge.buyXp();
    } else if (key === bindings.settings) {
      event.preventDefault();
      app.openPanel("settings");
    } else if (key === bindings.toggleAudio) {
      event.preventDefault();
      const current = bridge.settings.get();
      bridge.settings.save({ audioEnabled: true, audioMuted: !current.audioMuted });
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const offs = [bridge.onChange(sync), app.modals.onChange(onModalChange), onLocaleChange(() => hud.refreshCopy())];
  sync();
  return { dispose() { window.removeEventListener("keydown", onKeyDown); drag.dispose(); endCombat(); for (const o of offs) o(); hud.dispose(); board.dispose(); } };
});

// Language: one control opens the list; selecting refreshes copy immediately (A98).
registerUtility("language", (app) => {
  const m = app.modals.open({ id: "language", title: t("menu.language"), size: "sm", closeLabel: t("ui.close") });
  const list = h("div", "choice-list");
  const names: Record<string, string> = { vi: "Tiếng Việt", en: "English" };
  for (const l of LOCALES) {
    const b = kitButton({ skin: "blue", label: names[l] ?? l, onClick: () => {
      app.bridge.settings.save({ language: l }); // canonical owner persists + switches locale
      applyLocale(l); // also syncs <html lang>
      m.close();
    } });
    b.setSelected(l === getLocale());
    list.append(b.el);
  }
  m.body.append(list);
});
