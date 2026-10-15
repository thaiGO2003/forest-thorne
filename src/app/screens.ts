// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange, type MsgKey } from "../core/i18n";
import { boardCount } from "../core/run";
import { activeIndices, matchRecipe, RECIPES } from "../core/craft";
import { getEquipment } from "../core/equipment";
import { AUGMENT_BY_ID } from "../core/augments";
import { normalizeKey } from "../core/settings";
import { DONATE_ACCOUNT_NAME, DONATE_ACCOUNT_NUMBER, DONATE_BANK, buildDonateQrUrl, pickRandomDonateQrAddInfo } from "../core/donate";
import {
  buildAuthoredAchievementRewardCatalog, claimSkinReward, equipCollectionSkin,
  rankAchievementRows, unlockedAchievementCount,
} from "../core/achievements";
import { loadAchievementProfile, loadCollectionProfile, saveCollectionProfile } from "../core/save";
import { APP_LAST_UPDATED, APP_VERSION_TAG } from "../core/appMeta";
import { createModManager } from "../mods/ModRegistry";
import { openExternalHttpUrl } from "../platform/discordActivity";
import { h, kitButton, panelEl } from "../ui/kit";
import { createPlanningHud } from "../ui/planning";
import { mountLibrary } from "../ui/library";
import { mountUnitInventory } from "../ui/unitInventory";
import { findOwnedUnit, inspectOwnedUnit, type OwnedUnitInspection } from "../core/unitInventory";
import { snapshotWithResources } from "../core/combat";
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

function mountInventory(app: App, host: HTMLElement) {
  const render = () => {
    const run = app.bridge.run();
    host.replaceChildren();
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
    host.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
}

function mountCraft(app: App, host: HTMLElement) {
  let selectedMaterial: string | null = null;
  let buttons: ReturnType<typeof kitButton>[] = [];
  const render = () => {
    for (const button of buttons) button.dispose();
    buttons = [];
    host.replaceChildren();
    const run = app.bridge.run();
    if (!run) return;
    const staged = app.bridge.craftStaging();
    const active = new Set(activeIndices(run.craftTableLevel));
    const materials = [...new Set(run.itemBag.filter((id) => !getEquipment(id)))];
    const remaining = (id: string) =>
      run.itemBag.filter((entry) => entry === id).length - staged.filter((entry) => entry === id).length;
    if (selectedMaterial && remaining(selectedMaterial) <= 0) selectedMaterial = null;

    const workspace = h("div", "craft-workspace");
    const board = h("div", "craft-grid");
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", t("planning.craft"));
    for (let index = 0; index < 9; index++) {
      const slot = h("div", "craft-cell");
      const material = staged[index];
      const enabled = active.has(index);
      const title = material ? itemName(material) : t("planning.empty");
      const button = kitButton({
        skin: material ? "green" : "wood",
        label: `${index + 1}. ${enabled ? title : "🔒"}`,
        onClick: () => {
          if (!enabled) return;
          const choice = selectedMaterial && remaining(selectedMaterial) > 0 ? selectedMaterial : null;
          if (app.bridge.stageCraft(index, choice)) render();
        },
      });
      button.setDisabled(!enabled);
      button.el.title = !enabled
        ? t("planning.craftSlot", { slot: index + 1 })
        : material ? `${title} · Chọn ô để thay hoặc bỏ nguyên liệu` : "Chọn nguyên liệu bên kho rồi chọn ô";
      buttons.push(button);
      slot.append(button.el);
      if (material) {
        const clear = kitButton({
          skin: "plum", label: "Bỏ",
          onClick: () => { if (app.bridge.stageCraft(index, null)) render(); },
        });
        buttons.push(clear);
        slot.append(clear.el);
      }
      board.append(slot);
    }
    const bag = h("div", "craft-bag");
    bag.append(h("strong", "", t("planning.materials")), h("p", "", "Chọn nguyên liệu, sau đó chọn ô trên bàn chế tạo."));
    for (const material of materials) {
      const count = remaining(material);
      const entry = h("div", "slot craft-material");
      const img = h("img");
      img.src = `/assets/items/${encodeURIComponent(material)}.svg`;
      img.alt = "";
      img.loading = "lazy";
      const choice = kitButton({
        skin: "blue", label: `${itemName(material)} · ×${count}`,
        onClick: () => {
          selectedMaterial = selectedMaterial === material ? null : material;
          render();
        },
      });
      choice.setDisabled(count <= 0);
      choice.setSelected(selectedMaterial === material);
      buttons.push(choice);
      entry.append(img, choice.el);
      bag.append(entry);
    }
    if (!materials.length) bag.append(h("div", "slot", t("planning.empty")));
    const matched = matchRecipe(staged.slice(), run.craftTableLevel);
    const result = h("div", "craft-result");
    result.append(h("span", "", matched ? `${itemName(`eq_${matched.id}`)}` : t("planning.empty")));
    const craft = kitButton({
      skin: "green", label: t("planning.craftNow"),
      onClick: () => { app.bridge.craft(); },
    });
    craft.setDisabled(!matched || run.phase !== "PLANNING");
    buttons.push(craft);
    result.append(craft.el);
    bag.append(result);
    workspace.append(board, bag);
    host.append(workspace);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose() { off(); for (const b of buttons) b.dispose(); } };
}

function mountRecipes(host: HTMLElement) {
  const root = h("div", "choice-list");
  for (const recipe of RECIPES) {
    const row = h("div", "slot");
    row.textContent = `${recipe.pattern.map((id) => id ? itemName(id) : t("planning.empty")).join(" + ")} → ${itemName(`eq_${recipe.id}`)}`;
    root.append(row);
  }
  host.append(root);
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
function mountWorkshop(app: App, modal: ModalHandle, initial: "inventory" | "craft" | "recipes") {
  const tabs = h("div", "craft-tabs");
  tabs.setAttribute("role", "tablist");
  const body = h("div", "craft-content");
  let active = initial;
  let view: { dispose(): void } | null = null;
  const entries = [
    { id: "inventory", label: t("planning.inventory") },
    { id: "craft", label: t("planning.craft") },
    { id: "recipes", label: t("planning.recipes") },
  ] as const;
  const tabButtons = entries.map(({ id, label }) => {
    const button = kitButton({ skin: "blue", label, onClick: () => show(id) });
    button.el.setAttribute("role", "tab");
    tabs.append(button.el);
    return button;
  });
  const show = (id: typeof active) => {
    view?.dispose();
    view = null;
    active = id;
    for (let i = 0; i < entries.length; i++) {
      const selected = entries[i]!.id === active;
      tabButtons[i]!.setSelected(selected);
      tabButtons[i]!.el.setAttribute("aria-selected", String(selected));
    }
    body.replaceChildren();
    if (id === "inventory") view = mountInventory(app, body);
    else if (id === "craft") view = mountCraft(app, body);
    else mountRecipes(body);
  };
  modal.body.append(tabs, body);
  show(initial);
  return { dispose() { view?.dispose(); for (const b of tabButtons) b.dispose(); } };
}
for (const id of ["inventory", "craft", "recipes"] as const) {
  registerPanel(id, (app) =>
    openPanelModal(app, { id, title: t("planning.craft"), size: "full" }, (m) => mountWorkshop(app, m, id)));
}
registerPanel("augment", (app) =>
  openPanelModal(app, { id: "augment", title: t("planning.augment"), size: "lg", dismissible: false }, (m) => mountAugments(app, m)));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx } | null = null;
  let selectedUid: string | null = null;
  let inventoryView: ReturnType<typeof mountUnitInventory> | null = null;
  let inventoryInspection: OwnedUnitInspection | null = null;
  let inventoryUid: string | null = null;
  const liveRoster = new Map<string, RosterEntry>();
  const withOwned = (uid: string, action: (where: "board" | "bench", index: number) => boolean) => {
    const run = bridge.run();
    const found = run ? findOwnedUnit(run, uid) : null;
    return found ? action(found.where, found.index) : false;
  };
  const openOwnedInventory = (uid: string) => {
    const run = bridge.run();
    const inspection = run ? inspectOwnedUnit(run, uid) : null;
    if (!inspection) return;
    openPanelModal(app, { id: "unit-inventory", title: t("inventory.title"), size: "full" }, (m) => {
      inventoryUid = uid; inventoryInspection = inspection;
      const view = mountUnitInventory(m, portraits, {
        getModel: () => {
          const state = bridge.run();
          if (!state || !inventoryInspection || !findOwnedUnit(state, uid)) return null;
          const live = liveRoster.get(uid);
          const current = live?.inspection ? snapshotWithResources(live.inspection, live, getUnit(inventoryInspection.unit.baseId).role) : inventoryInspection.boosted;
          return { run: state, inspection: inventoryInspection, current, inCombat: state.phase === "COMBAT" };
        },
        select: () => { selectedUid = uid; board.setSelected?.(uid); },
        sell: () => withOwned(uid, (where, index) => bridge.sell(where, index)),
        equip: (itemId) => withOwned(uid, (where, index) => bridge.equip(itemId, where, index)),
        unequip: (index) => withOwned(uid, (where, at) => bridge.unequip(where, at, index)),
        unequipAll: () => withOwned(uid, (where, index) => bridge.unequipAll(where, index)),
      });
      inventoryView = view;
      return { dispose() { view.dispose(); if (inventoryView === view) { inventoryView = null; inventoryUid = null; inventoryInspection = null; } } };
    });
  };
  const drag = createPlanningDragController({
    stage,
    board,
    getRun: () => bridge.run(),
    move: (from, to) => bridge.move(from, to),
    select: (source) => {
      const state = bridge.run();
      const unit = source.kind === "board" ? state?.board[source.index] : state?.bench[source.index];
      if (!unit) return;
      openOwnedInventory(unit.uid);
      if (source.kind === "board" && state?.phase === "PLANNING") bridge.tutorialEvent("show_attack_preview", "show_attack_preview", {
        source: { where: "board", index: source.index },
      });
    },
    enabled: () => !app.modals.blocking() && (bridge.run()?.phase === "PLANNING" || Boolean(combat)),
    inspectOnly: () => Boolean(combat),
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
    if (selectedUid && !findOwnedUnit(run, selectedUid)) { selectedUid = null; board.setSelected?.(null); }
    if (inventoryUid) { inventoryInspection = inspectOwnedUnit(run, inventoryUid); inventoryView?.update(); }
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
    liveRoster.clear();
    if (app.modals.active() === "unit-inventory") app.modals.closeActive();
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
      return { hp: r.hp, maxHp: r.maxHp, shield: r.shield, atk: r.inspection?.atk ?? u.stats.atk * k, matk: r.inspection?.matk ?? u.stats.matk * k, def: r.inspection?.def ?? u.stats.def * k, mdef: r.inspection?.mdef ?? u.stats.mdef * k, star: r.star, tier: u.tier, alive: r.hp > 0 };
    }));
    const player = playCombat({
      board, fx, roster: session.roster, events: session.events, inspectionFrames: session.inspectionFrames, onFrame: stage.onFrame,
      onTick: (tk) => {
        for (const entry of tk.all) liveRoster.set(entry.uid, entry);
        inventoryView?.update();
        chud.update({
        round: run?.round ?? 1, cycle: tk.cycle, speed,
        // LOGIC: anti-stall multiplier (A17) belongs to canonical combat; expose it on the session.
        escalation: 1,
        left: strength(tk.all.filter((r) => r.side === "L")), right: strength(tk.all.filter((r) => r.side === "R")),
        queue: tk.queue.map((uid) => { const r = tk.all.find((x) => x.uid === uid); return { name: r ? getUnit(r.baseId).nameVi : uid, side: r?.side ?? "L", icon: r ? ICONS[getUnit(r.baseId).role] : "❔" }; }),
        log: tk.log,
        });
      },
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
    // The modal host may already have consumed Escape and closed its dialog.
    if (event.defaultPrevented || event.repeat || combat || app.modals.blocking()) return;
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
  const names: Record<string, string> = { vi: "Tiếng Việt" };
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

registerUtility("donate", (app) => {
  const m = app.modals.open({ id: "donate", title: t("menu.donate"), size: "md", closeLabel: t("ui.close") });
  const stack = h("div", "stack donate-stack");
  const account = h("div", "slot", `${DONATE_BANK} · ${DONATE_ACCOUNT_NUMBER} · ${DONATE_ACCOUNT_NAME}`);
  const field = h("label", "field");
  const amountLabel = h("span", "", t("menu.donateAmount"));
  const amount = h("input");
  amount.type = "number";
  amount.inputMode = "numeric";
  amount.min = "0";
  amount.step = "1000";
  amount.placeholder = t("menu.donateOptional");
  amount.value = "20000";
  field.append(amountLabel, amount);
  const qr = h("img", "donate-qr");
  qr.alt = t("menu.donateQrAlt");
  qr.decoding = "async";
  const message = h("div", "slot");
  const presets = h("div", "choice-list donate-presets");
  const presetAmounts = [5_000, 10_000, 15_000, 20_000, 30_000, 50_000, 100_000, 200_000, 500_000] as const;
  const presetButtons: Array<{ amount: number | null; button: ReturnType<typeof kitButton> }> = [];
  const amountLabelFor = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
  const syncPresetSelection = () => {
    const value = Number(amount.value);
    const preset = Number.isFinite(value) ? presetAmounts.find((candidate) => candidate === value) : undefined;
    for (const entry of presetButtons) entry.button.setSelected(entry.amount === (preset ?? null));
  };
  const refresh = () => {
    const numericAmount = Number(amount.value);
    const addInfo = pickRandomDonateQrAddInfo();
    qr.src = buildDonateQrUrl(Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0, addInfo);
    message.textContent = t("menu.donateMessage", { message: addInfo });
    syncPresetSelection();
  };
  const selectPreset = (value: number | null) => {
    amount.value = value === null ? "" : String(value);
    refresh();
    if (value === null) amount.focus();
  };
  for (const value of presetAmounts) {
    const button = kitButton({ skin: "blue", label: amountLabelFor(value), onClick: () => selectPreset(value) });
    presetButtons.push({ amount: value, button });
    presets.append(button.el);
  }
  const custom = kitButton({ skin: "blue", label: t("menu.donateCustom"), onClick: () => selectPreset(null) });
  presetButtons.push({ amount: null, button: custom });
  presets.append(custom.el);
  amount.addEventListener("input", syncPresetSelection);
  const regenerate = kitButton({ skin: "green", label: t("menu.donateRefresh"), onClick: refresh });
  stack.append(account, presets, field, regenerate.el, qr, message);
  m.body.append(stack);
  refresh();
});

registerUtility("version", (app) => {
  const m = app.modals.open({ id: "version", title: t("menu.version"), size: "sm", closeLabel: t("ui.close") });
  m.body.append(
    h("div", "slot", `Bá Chủ Khu Rừng ${APP_VERSION_TAG}`),
    h("div", "slot", t("menu.versionUpdated", { date: APP_LAST_UPDATED })),
  );
});

registerUtility("achievements", (app) => {
  const m = app.modals.open({ id: "achievements", title: t("menu.achievements"), size: "md", closeLabel: t("ui.close") });
  const profile = loadAchievementProfile(localStorage);
  const collection = loadCollectionProfile(localStorage);
  const rewards = buildAuthoredAchievementRewardCatalog();
  const rewardByAchievement = new Map(rewards.mappings.map((mapping) => [mapping.achievementId, mapping]));
  const render = () => {
    m.body.replaceChildren();
    const ranked = rankAchievementRows(profile, collection, rewards.mappings);
    m.body.append(
      h("div", "slot", t("menu.achievementsSummary", {
        unlocked: unlockedAchievementCount(profile),
        total: ranked.length,
        claimed: collection.claimedAchievementIds.length,
      })),
      h("div", "slot", t("menu.achievementsStats", {
        bestRound: profile.stats.best_round,
        roundsWon: profile.stats.rounds_won,
        highestLevel: profile.stats.highest_level,
      })),
    );
    const list = h("div", "stack");
    for (const row of ranked) {
      const card = h("div", "stack");
      const categoryName = t(`achievement.${row.category}` as MsgKey);
      card.append(h("div", "slot", t("menu.achievementRow", {
        category: categoryName,
        current: row.current,
        target: row.threshold,
      })));
      const mapping = rewardByAchievement.get(row.id);
      if (!mapping) {
        card.append(h("div", "slot", t("menu.achievementMissingReward")));
        list.append(card);
        continue;
      }
      const unit = getUnit(mapping.unitId);
      card.append(h("div", "slot", t("menu.achievementReward", {
        skin: unit.skin?.stagesVi[0] ?? mapping.skinId,
        unit: unit.nameVi,
      })));
      if (!row.unlocked) {
        card.append(h("div", "slot", t("menu.achievementLocked")));
      } else if (row.claimable) {
        const claim = kitButton({
          skin: "green",
          label: t("menu.achievementClaim"),
          onClick: () => {
            if (!claimSkinReward(profile, collection, mapping)) return;
            saveCollectionProfile(localStorage, collection);
            render();
          },
        });
        card.append(claim.el);
      } else {
        card.append(h("div", "slot", t("menu.achievementClaimed")));
        const equipped = collection.equippedSkinByUnitId[mapping.unitId] === mapping.skinId;
        const equip = kitButton({
          skin: "blue",
          label: t(equipped ? "menu.achievementEquipped" : "menu.achievementEquip"),
          onClick: () => {
            if (!equipCollectionSkin(collection, mapping.unitId, mapping.skinId)) return;
            saveCollectionProfile(localStorage, collection);
            render();
          },
        });
        equip.setSelected(equipped);
        card.append(equip.el);
      }
      list.append(card);
    }
    m.body.append(list);
  };
  render();
});

registerUtility("mods", (app) => {
  const m = app.modals.open({ id: "mods", title: t("menu.mods"), size: "full", closeLabel: t("ui.close") });
  const root = h("div", "lib");
  const loading = h("div", "slot", t("menu.modsLoading"));
  root.append(loading);
  m.body.append(root);
  void createModManager(localStorage).then((manager) => {
    type ModTab = "discover" | "installed" | "enabled" | "updates";
    const sections: readonly { id: ModTab; title: string }[] = [
      { id: "discover", title: "Khám phá" },
      { id: "installed", title: "Đã cài" },
      { id: "enabled", title: "Đang bật" },
      { id: "updates", title: "Cập nhật" },
    ];
    let tab: ModTab = "installed";
    let query = "";
    let selectedId: string | null = null;
    let importStatus = "";
    const fileInput = h("input");
    fileInput.type = "file";
    fileInput.accept = ".ftunit,.ftlogic,.ftmodpack";
    fileInput.hidden = true;
    const importButton = kitButton({
      skin: "green", label: t("menu.modsImport"),
      onClick: () => fileInput.click(),
    });
    const search = h("input", "lib-input");
    search.type = "search";
    search.placeholder = "Tìm theo tên, tác giả hoặc loại mod";
    search.setAttribute("aria-label", search.placeholder);
    search.addEventListener("input", () => {
      query = search.value.trim().toLocaleLowerCase("vi");
      renderResults();
    });
    const results = h("div", "choice-list");
    const detail = panelEl("panel_tooltip", "slot stack");
    const status = h("div", "slot");
    const nav = h("div", "tabs");
    const buttons = sections.map(({ id, title }) => {
      const button = kitButton({
        skin: "wood", label: title,
        onClick: () => { tab = id; selectedId = null; render(); },
      });
      nav.append(button.el);
      return { id, button };
    });
    const toolbar = h("div", "row");
    const searchWell = panelEl("slot_well", "lib-search grow");
    searchWell.append(search);
    toolbar.append(importButton.el, searchWell);
    const layout = h("div", "lib-detail");
    const list = h("div", "lib-info");
    list.append(results);
    layout.append(list, detail);

    function renderDetails() {
      detail.replaceChildren();
      const index = manager.getIndex();
      const manifest = index.mods.find((mod) => mod.id === selectedId);
      if (!manifest) {
        detail.append(h("h3", "", "Chi tiết gói mở rộng"), h("p", "", "Chọn một gói để xem thông tin và thao tác."));
        return;
      }
      detail.append(
        h("h3", "", manifest.name),
        h("p", "", `Phiên bản ${manifest.version} · ${manifest.author}`),
        h("p", "", manifest.description || "Không có mô tả."),
        h("p", "", `Loại: ${manifest.packageType} · Nguồn: ${manifest.source}`),
        h("p", "", `Trạng thái: ${manager.isEnabled(manifest.id) ? "Đang bật" : "Đã tắt"}`),
      );
      if (manifest.requires.length) detail.append(h("p", "", `Phụ thuộc: ${manifest.requires.join(", ")}`));
      if (manifest.conflicts.length) detail.append(h("p", "", `Xung đột: ${manifest.conflicts.join(", ")}`));
      if (manifest.tags.length) detail.append(h("p", "", `Nhãn: ${manifest.tags.join(", ")}`));
      const actions = h("div", "row");
      const enabled = manager.isEnabled(manifest.id);
      const toggle = kitButton({
        skin: enabled ? "plum" : "green",
        label: enabled ? t("menu.modsDisable") : t("menu.modsEnable"),
        onClick: () => { if (enabled) manager.disable(manifest.id); else manager.enable(manifest.id); render(); },
      });
      actions.append(toggle.el);
      if (enabled) {
        const profile = manager.getProfile();
        const position = profile.loadOrder.indexOf(manifest.id);
        for (const [direction, caption] of [[-1, "↑ Ưu tiên"], [1, "↓ Ưu tiên"]] as const) {
          const move = kitButton({
            skin: "wood", label: caption,
            onClick: () => { manager.move(manifest.id, direction); render(); },
          });
          move.setDisabled(position < 0 || position + direction < 0 || position + direction >= profile.loadOrder.length);
          actions.append(move.el);
        }
      }
      if (manifest.source === "local") {
        const remove = kitButton({
          skin: "plum", label: "Gỡ gói khỏi danh sách",
          onClick: () => {
            if (!window.confirm(`Gỡ gói ${manifest.name} khỏi danh sách mod cục bộ?`)) return;
            if (manager.removeLocal(manifest.id)) { selectedId = null; render(); }
          },
        });
        actions.append(remove.el);
      }
      detail.append(actions);
    }

    function renderResults() {
      results.replaceChildren();
      const index = manager.getIndex();
      const profile = manager.getProfile();
      const matches = index.mods.filter((mod) => {
        if (tab === "enabled" && !profile.enabledIds.includes(mod.id)) return false;
        if (tab === "installed" && mod.source !== "local") return false;
        if (tab === "discover" && mod.source === "local") return false;
        if (tab === "updates") return false; // Registry does not provide release/update metadata.
        const haystack = `${mod.name} ${mod.author} ${mod.packageType} ${mod.tags.join(" ")}`.toLocaleLowerCase("vi");
        return haystack.includes(query);
      }).sort((a, b) => {
        if (tab !== "enabled") return a.name.localeCompare(b.name, "vi");
        return profile.loadOrder.indexOf(a.id) - profile.loadOrder.indexOf(b.id);
      });
      if (!matches.length) {
        const message = tab === "updates"
          ? "Nguồn mod hiện không cung cấp dữ liệu phiên bản mới để kiểm tra cập nhật."
          : tab === "discover" && index.workshop.status === "placeholder"
            ? t("menu.modsWorkshopUnavailable")
            : tab === "installed"
              ? "Chưa có mod cục bộ. Dùng nút Nhập mod cục bộ để thêm gói."
              : tab === "enabled" ? "Chưa có mod nào đang bật." : "Không tìm thấy gói phù hợp.";
        results.append(h("div", "slot", message));
      }
      for (const mod of matches) {
        const entry = panelEl("slot_well", "slot stack");
        entry.append(
          h("strong", "", mod.name),
          h("span", "", `${mod.packageType} · v${mod.version} · ${mod.author}`),
          h("span", "", manager.isEnabled(mod.id) ? "● Đang bật" : "○ Đã tắt"),
        );
        const select = kitButton({
          skin: selectedId === mod.id ? "green" : "wood",
          label: selectedId === mod.id ? "Đang xem" : "Xem chi tiết",
          onClick: () => { selectedId = mod.id; renderResults(); },
        });
        entry.append(select.el);
        results.append(entry);
      }
      renderDetails();
    }

    function render() {
      if (!root.isConnected) return;
      root.replaceChildren();
      for (const { id, button } of buttons) button.setSelected(tab === id);
      status.textContent = importStatus;
      root.append(nav, toolbar, fileInput);
      if (importStatus) root.append(status);
      root.append(h("div", "slot", t("menu.modsSummary", {
        enabled: manager.getProfile().enabledIds.length, total: manager.getIndex().mods.length,
      })), layout);
      const issues = manager.validateEnabled();
      if (issues.length) root.append(h("div", "slot", `Cảnh báo phụ thuộc hoặc xung đột: ${issues.map((issue) => JSON.stringify(issue)).join(" · ")}`));
      const warnings = manager.getRegistryWarnings();
      if (warnings.length) root.append(h("div", "slot", t("menu.modsWarnings", { count: warnings.length })));
      renderResults();
    }

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      void file.text().then((raw) => {
        try {
          const result = manager.importLocal(file.name, JSON.parse(raw));
          importStatus = result.ok
            ? t("menu.modsImportSuccess", { name: result.manifest.name })
            : t("menu.modsImportError", { error: result.error });
          if (result.ok) { tab = "installed"; selectedId = result.manifest.id; }
        } catch {
          importStatus = t("menu.modsImportError", { error: "JSON không hợp lệ" });
        }
        fileInput.value = "";
        render();
      }, (error: unknown) => {
        importStatus = t("menu.modsImportError", { error: error instanceof Error ? error.message : String(error) });
        fileInput.value = "";
        render();
      });
    });
    render();
  }).catch((error: unknown) => {
    if (root.isConnected) root.replaceChildren(h("div", "slot", `Không tải được danh sách mod: ${error instanceof Error ? error.message : String(error)}`));
  });
});

registerUtility("tribute", (app) => {
  const m = app.modals.open({ id: "tribute", title: t("menu.tribute"), size: "sm", closeLabel: t("ui.close") });
  m.body.append(h("div", "slot", t("menu.tributeEmpty")));
});

registerUtility("social", (app) => {
  const m = app.modals.open({ id: "social", title: t("menu.social"), size: "sm", closeLabel: t("ui.close") });
  const github = kitButton({
    skin: "blue",
    label: t("menu.socialGithub"),
    onClick: () => { void openExternalHttpUrl("https://github.com/thaiGO2003/forest-thorne", { window }); },
  });
  m.body.append(github.el, h("div", "slot", t("menu.socialUnavailable")));
});
