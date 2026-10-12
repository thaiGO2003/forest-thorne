// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange, type MsgKey } from "../core/i18n";
import { BOARD_SIZE, boardCount, slotCap, type RoundResultSummary } from "../core/run";
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
import { teamStrength, unitDiagnostics, type UnitDiagnostics, type UnitStatSnapshot } from "../core/inspection";
import { environmentFor } from "../core/environment";
import { dayNightForRound } from "../core/dayNight";
import { getGameSpeedDisplayMultiplier } from "../core/gameSpeed";
import { finishFastCost } from "../core/combatFast";
import { createModManager, type ModManager, type ModValidationIssue } from "../mods/ModRegistry";
import { createCombatHud, openResult, type CombatHudView } from "../ui/combat";
import { createCombatFx, type CombatFx } from "../units/fx";
import { playCombat, type CombatPlayer, type RosterEntry } from "../units/combatPlayer";
import type { TacticalHighlightCell } from "../world/arena";
import { createVictoryFireworks, type VictoryFireworks, type VictoryFireworkOrigin } from "../world/victoryFireworks";
import {
  DONATE_ACCOUNT,
  DONATE_ACCOUNT_NAME,
  DONATE_AMOUNT_PRESETS,
  DONATE_BANK_NAME,
  buildDonateVietQrUrl,
  randomDonateMemo,
} from "../ui/donate";

/** One shared portrait renderer: card snapshots + live Library viewer use the real unit rigs. */
const portraits = createPortraits();

/** Open a modal panel whose view lives exactly as long as the modal (closed or replaced → disposed). */
function openPanelModal(app: App, o: ModalOptions, mount: (m: ModalHandle) => { dispose(): void }) {
  const m = app.modals.open({ closeLabel: t("ui.close"), ...o });
  const view = mount(m);
  const off = app.modals.onChange((active) => { if (active !== o.id) { off(); view.dispose(); } });
}

function openReturnToMenuConfirm(app: App) {
  const m = app.modals.open({ id: "return-menu-confirm", title: t("settings.home"), size: "sm", closeLabel: t("ui.close") });
  const body = h("div", "stack");
  body.append(h("p", "dialog-copy", t("settings.homeConfirm")));
  const actions = h("div", "row dialog-actions");
  const cancel = kitButton({ skin: "wood", label: t("common.cancel"), onClick: () => { m.close(); app.openPanel("settings"); } });
  const confirm = kitButton({ skin: "red", label: t("common.confirm"), cls: "fit-btn", onClick: () => { m.close(); app.go("menu"); } });
  confirm.el.append(h("span", "kit-fit-measure", t("common.confirm")));
  actions.append(cancel.el, confirm.el);
  body.append(actions);
  m.body.append(body);
}

const ITEM_COPY: Partial<Record<string, MsgKey>> = {
  eq_warmog_armor: "item.eq_warmog_armor",
  eq_blue_buff: "item.eq_blue_buff",
  tear: "item.tear",
};
const itemName = (id: string) => ITEM_COPY[id] ? t(ITEM_COPY[id]!) : id;

let modManagerPromise: Promise<ModManager> | null = null;
const modManager = () => {
  if (!modManagerPromise) {
    const storage = typeof localStorage === "undefined"
      ? { getItem: () => null, setItem: () => {} }
      : localStorage;
    modManagerPromise = createModManager(storage);
  }
  return modManagerPromise;
};

function openUndeveloped(app: App, id: "tribute" | "social") {
  const title = t(id === "tribute" ? "menu.tribute" : "menu.social");
  const m = app.modals.open({ id: `${id}-undeveloped`, title, size: "sm", closeLabel: t("ui.close") });
  m.body.append(h("p", "dialog-copy", t("utility.undeveloped")));
}

function openDonate(app: App) {
  const m = app.modals.open({ id: "donate", title: t("menu.donate"), size: "md", closeLabel: t("ui.close") });
  m.body.classList.add("donate-modal-body");
  const root = h("div", "donate");
  const details = h("div", "stack donate-details");
  const account = h("div", "slot donate-account");
  const kv = (label: string, value: string) => {
    const row = h("div", "info-kv");
    row.append(h("strong", "", label), h("span", "", value));
    return row;
  };
  account.append(
    kv(t("donate.bank"), DONATE_BANK_NAME),
    kv(t("donate.account"), DONATE_ACCOUNT),
    kv(t("donate.accountName"), DONATE_ACCOUNT_NAME),
  );

  const formatter = new Intl.NumberFormat(getLocale() === "vi" ? "vi-VN" : "en-US");
  let amount: number = DONATE_AMOUNT_PRESETS[0];
  let memo = randomDonateMemo();
  const selectedAmount = h("strong", "donate-selected");
  const presets = h("div", "donate-presets");
  const presetButtons = DONATE_AMOUNT_PRESETS.map((preset) => {
    const button = kitButton({
      skin: "green",
      label: formatter.format(preset),
      onClick: () => {
        amount = preset;
        update();
      },
    });
    presets.append(button.el);
    return { amount: preset, button };
  });
  const memoCopy = h("div", "slot donate-memo");
  const randomize = kitButton({
    skin: "wood",
    label: t("donate.randomize"),
    cls: "fit-btn",
    onClick: () => {
      memo = randomDonateMemo();
      update();
    },
  });
  randomize.el.append(h("span", "kit-fit-measure", t("donate.randomize")));
  details.append(account, selectedAmount, presets, h("strong", "", t("donate.memo")), memoCopy, randomize.el);

  const qrWrap = h("div", "donate-qr-wrap");
  const qr = document.createElement("img");
  qr.className = "donate-qr";
  qr.alt = t("donate.qrAlt");
  qr.decoding = "async";
  qrWrap.append(qr);
  root.append(details, qrWrap);
  m.body.append(root);

  function update() {
    selectedAmount.textContent = t("donate.selectedAmount", { amount: formatter.format(amount) });
    memoCopy.textContent = memo;
    qr.src = buildDonateVietQrUrl(amount, memo);
    for (const preset of presetButtons) preset.button.setSelected(preset.amount === amount);
  }
  update();
}

function openMods(app: App) {
  const m = app.modals.open({ id: "mods", title: t("menu.mods"), size: "full", closeLabel: t("ui.close") });
  const root = h("div", "stack mods");
  m.body.append(root);
  root.append(h("div", "slot", t("loading.assets")));
  const issueCopy = (issue: ModValidationIssue) => issue.kind === "unknown-enabled-mod"
    ? t("mods.issueUnknown", { modId: issue.modId })
    : issue.kind === "missing-dependency"
      ? t("mods.issueMissingDependency", { modId: issue.modId, dependencyId: issue.dependencyId })
      : t("mods.issueConflict", { modId: issue.modId, conflictId: issue.conflictId });
  const listCopy = (values: string[]) => values.length ? values.join(", ") : t("mods.none");
  void modManager().then((manager) => {
    if (app.modals.active() !== "mods") return;
    const render = () => {
      root.replaceChildren();
      const index = manager.getIndex();
      const profile = manager.getProfile();
      const rank = new Map(profile.loadOrder.map((id, position) => [id, position]));
      const manifests = [...index.mods].sort((a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      const warnings = manager.getRegistryWarnings();
      const issues = manager.validateEnabled();
      const workshopStatus = index.workshop.status === "available" ? t("mods.workshopAvailable") : t("mods.workshopPlaceholder");
      const summary = h("div", "mods-summary");
      summary.append(
        h("div", "slot", t("mods.summary", { enabled: profile.enabledIds.length, total: manifests.length })),
        h("div", "slot", t("mods.workshop") + ": " + workshopStatus + (index.workshop.appId ? " · " + index.workshop.appId : "")),
      );
      root.append(summary);
      if (!manifests.length) root.append(h("div", "slot", t("mods.empty")));
      for (const manifest of manifests) {
        const card = h("div", "slot mod-row");
        const copy = h("div", "grow mod-copy");
        const enabled = manager.isEnabled(manifest.id);
        const position = profile.loadOrder.indexOf(manifest.id);
        copy.append(
          h("strong", "", manifest.name + " · v" + manifest.version),
          h("div", "mod-state", t(enabled ? "mods.enabled" : "mods.disabled") + " · " + t("mods.loadOrder") + ": " + (position >= 0 ? String(position + 1) : "—")),
          h("div", "", manifest.description),
        );
        const meta = h("div", "mod-meta");
        meta.append(
          h("small", "", t("mods.packageType") + ": " + manifest.packageType),
          h("small", "", t("mods.source") + ": " + manifest.source),
          h("small", "", t("mods.author") + ": " + manifest.author),
        );
        const relations = h("div", "mod-relations");
        relations.append(
          h("small", "", t("mods.requires") + ": " + listCopy(manifest.requires)),
          h("small", "", t("mods.conflicts") + ": " + listCopy(manifest.conflicts)),
          h("small", "", t("mods.tags") + ": " + listCopy(manifest.tags)),
        );
        copy.append(meta, relations);
        if (manifest.workshopId) copy.append(h("small", "", t("mods.workshop") + ": " + manifest.workshopId));
        const packageIssues = issues.filter((issue) => issue.modId === manifest.id);
        if (packageIssues.length) {
          const packageValidation = h("div", "mod-package-issues");
          for (const issue of packageIssues) packageValidation.append(h("small", "", issueCopy(issue)));
          copy.append(packageValidation);
        }
        const actions = h("div", "row mod-actions");
        const toggle = kitButton({
          skin: enabled ? "red" : "green",
          label: t(enabled ? "mods.disable" : "mods.enable"),
          onClick: () => {
            if (manager.isEnabled(manifest.id)) manager.disable(manifest.id);
            else manager.enable(manifest.id);
            render();
          },
        });
        const up = kitButton({ skin: "wood", label: t("mods.up"), onClick: () => { manager.move(manifest.id, -1); render(); } });
        const down = kitButton({ skin: "wood", label: t("mods.down"), onClick: () => { manager.move(manifest.id, 1); render(); } });
        up.setDisabled(!enabled || position <= 0);
        down.setDisabled(!enabled || position < 0 || position >= profile.loadOrder.length - 1);
        actions.append(toggle.el, up.el, down.el);
        card.append(copy, actions);
        root.append(card);
      }
      const validation = h("div", "stack mod-validation");
      validation.append(h("strong", "", t("mods.validation")));
      if (!issues.length && !warnings.length) validation.append(h("div", "slot", t("mods.noIssues")));
      for (const issue of issues) validation.append(h("div", "slot", issueCopy(issue)));
      for (const warning of warnings) validation.append(h("div", "slot", t("mods.warning") + ": " + warning.message));
      root.append(validation);
    };
    render();
  });
}

function openInformation(app: App) {
  const m = app.modals.open({ id: "information", title: t("menu.information"), size: "full", closeLabel: t("ui.close") });
  const root = h("div", "info-modal");
  const tabs = h("div", "tabs");
  const body = h("div", "stack info-body");
  type InfoTab = "overview" | "allies" | "enemies" | "inventory";
  let active: InfoTab = "overview";
  const tabDefs: Array<{ id: InfoTab; key: MsgKey }> = [
    { id: "overview", key: "info.overview" },
    { id: "allies", key: "info.allies" },
    { id: "enemies", key: "info.enemies" },
    { id: "inventory", key: "info.inventory" },
  ];
  const tabButtons = tabDefs.map((tab) => {
    const button = kitButton({ skin: "blue", label: t(tab.key), onClick: () => { active = tab.id; render(); } });
    tabs.append(button.el);
    return { ...tab, button };
  });

  const unitStrength = (units: Array<{ baseId: string; star: number }>) => {
    const rows = units.map((entry) => {
      const unit = getUnit(entry.baseId);
      const scale = STAR_STAT[entry.star] ?? 1;
      const hp = unit.stats.hp * scale;
      return {
        hp, maxHp: hp, shield: 0,
        atk: unit.stats.atk * scale,
        matk: unit.stats.matk * scale,
        def: unit.stats.def * scale,
        mdef: unit.stats.mdef * scale,
        star: entry.star,
        tier: unit.tier,
        alive: true,
      };
    });
    return {
      power: teamStrength(rows).power,
      hp: rows.reduce((sum, row) => sum + row.maxHp, 0),
    };
  };

  const unitList = (entries: Array<{ uid: string; baseId: string; star: number; equips?: string[] }>, empty: string, detailId: (entry: { uid: string }) => string) => {
    if (!entries.length) {
      body.append(h("div", "slot", empty));
      return;
    }
    for (const entry of entries) {
      const unit = getUnit(entry.baseId);
      const row = h("div", "slot info-unit");
      const copy = h("div", "grow");
      copy.append(
        h("strong", "", `${unit.nameVi} ★${entry.star}`),
        h("div", "", `${t(`role.${unit.role}` as MsgKey)} · ${t(`element.${unit.element}` as MsgKey)} · ${t(`faction.${unit.faction}` as MsgKey)}`),
      );
      if (entry.equips?.length) copy.append(h("small", "", entry.equips.map(itemName).join(" · ")));
      const details = kitButton({ skin: "wood", label: t("planning.details"), onClick: () => app.openPanel("unit-detail", detailId(entry)) });
      row.append(copy, details.el);
      body.append(row);
    }
  };

  const render = () => {
    body.replaceChildren();
    for (const tab of tabButtons) tab.button.setSelected(tab.id === active);
    const run = app.bridge.run();
    if (!run) {
      body.append(h("div", "slot", t("info.noRun")));
      return;
    }
    const preview = app.bridge.prepareEnemyPreview();
    const allies = run.board.filter((unit): unit is NonNullable<typeof unit> => unit !== null);
    const enemies = preview?.units ?? run.enemyPreview;
    if (active === "overview") {
      const friendly = unitStrength(allies);
      const enemy = unitStrength(enemies);
      const summary = h("div", "info-summary");
      const compare = (ally: string | number, enemy: string | number) =>
        `${t("info.allies")}: ${ally} · ${t("info.enemies")}: ${enemy}`;
      const lines = [
        [t("info.health"), compare(Math.round(friendly.hp), Math.round(enemy.hp))],
        [t("info.power"), compare(friendly.power, enemy.power)],
        [t("info.nextWeather"), t(`element.${environmentFor(run.round + 1)}` as MsgKey)],
        [t("info.followingWeather"), t(`element.${environmentFor(run.round + 2)}` as MsgKey)],
      ];
      for (const [label, value] of lines) {
        const row = h("div", "slot info-kv");
        row.append(h("strong", "", label!), h("span", "", value!));
        summary.append(row);
      }
      body.append(summary, h("strong", "", t("info.synergy")));
      const synergies = runView.synergies(run);
      if (!synergies.length) body.append(h("div", "slot", t("planning.empty")));
      for (const line of synergies) {
        const kind = t(line.kind === "class" ? "info.synergyClass" : line.kind === "element" ? "info.synergyElement" : "info.synergyFaction");
        const prefix = line.kind === "class" ? "role" : line.kind;
        const name = t(`${prefix}.${line.key}` as MsgKey);
        body.append(h("div", "slot", `${kind}: ${name} · ${line.count} / ${line.next ?? line.active}`));
      }
      return;
    }
    if (active === "allies") {
      unitList([
        ...allies,
        ...run.bench,
      ], t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
      return;
    }
    if (active === "enemies") {
      unitList(enemies, t("info.noUnits"), (entry) => enemyPanelId(entry.uid));
      return;
    }
    const bag = h("div", "stack");
    bag.append(h("strong", "", t("planning.items")));
    if (!run.itemBag.length) bag.append(h("div", "slot", t("planning.empty")));
    for (const item of run.itemBag) bag.append(h("div", "slot", itemName(item)));
    body.append(bag, h("strong", "", t("planning.boardUnits")));
    unitList(allies, t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
    body.append(h("strong", "", t("planning.benchUnits")));
    unitList(run.bench, t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
  };
  root.append(tabs, body);
  m.body.append(root);
  render();
}

function mountInventoryCraft(app: App, m: ModalHandle) {
  const render = () => {
    const run = app.bridge.run();
    m.body.replaceChildren();
    if (!run) return;
    const staged = app.bridge.craftStaging();
    const root = h("div", "stack");

    const itemsTitle = h("strong");
    itemsTitle.textContent = t("planning.items");
    root.append(itemsTitle);
    const bag = h("div", "row");
    for (const id of run.itemBag) bag.append(h("div", "slot", itemName(id)));
    if (!run.itemBag.length) bag.append(h("div", "slot", t("planning.empty")));
    root.append(bag);

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
      if (staged[index]) {
        const clear = kitButton({
          skin: "wood",
          label: t("planning.empty"),
          onClick: () => { app.bridge.stageCraft(index, null); },
        });
        actions.append(clear.el);
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

    const equipmentBag = [...new Set(run.itemBag.filter((id) => getEquipment(id) !== null))];
    const groups = [
      { title: t("planning.boardUnits"), where: "board" as const, units: run.board },
      { title: t("planning.benchUnits"), where: "bench" as const, units: run.bench },
    ];
    for (const group of groups) {
      root.append(h("strong", "", group.title));
      for (let index = 0; index < group.units.length; index++) {
        const unit = group.units[index];
        if (!unit) continue;
        const slot = h("div", "slot");
        const title = h("div", "", `${index + 1}. ${getUnit(unit.baseId).nameVi} ★${unit.star}`);
        const actions = h("div", "row");
        const sell = kitButton({ skin: "wood", label: t("planning.sell"), onClick: () => { app.bridge.sell(group.where, index); } });
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
    const root = h("div", "augment-list");
    for (const id of run.activeAugmentChoices) {
      const def = AUGMENT_BY_ID.get(id);
      const row = h("div", "slot augment-row");
      const copy = h("div", "augment-copy");
      copy.textContent = def ? id + " · " + def.effect + " " + (def.value >= 0 ? "+" : "") + def.value : id;
      const choose = kitButton({
        skin: "green",
        label: t("planning.choose"),
        cls: "augment-choose fit-btn",
        onClick: () => { if (app.bridge.chooseAugment(id)) m.close(); },
      });
      choose.el.append(h("span", "kit-fit-measure", t("planning.choose")));
      row.append(copy, choose.el);
      root.append(row);
    }
    m.body.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
}

const ownedPanelId = (uid: string) => `owned:${uid}`;
const enemyPanelId = (uid: string) => `enemy:${uid}`;

function locateOwnedUnit(app: App, uid: string) {
  const run = app.bridge.run();
  if (!run) return null;
  const boardIndex = run.board.findIndex((unit) => unit?.uid === uid);
  if (boardIndex >= 0) {
    const unit = run.board[boardIndex];
    if (unit) return { where: "board" as const, index: boardIndex, unit };
  }
  const benchIndex = run.bench.findIndex((unit) => unit.uid === uid);
  if (benchIndex >= 0) return { where: "bench" as const, index: benchIndex, unit: run.bench[benchIndex]! };
  return null;
}

function ownedDiagnostics(app: App, uid: string) {
  const run = app.bridge.run();
  const located = locateOwnedUnit(app, uid);
  if (!run || !located) return null;
  const placement = {
    uid: located.unit.uid,
    baseId: located.unit.baseId,
    star: located.unit.star,
    row: located.where === "board" ? Math.floor(located.index / BOARD_SIZE) : 0,
    col: located.where === "board" ? located.index % BOARD_SIZE : 0,
    equips: [...located.unit.equips],
    traits: [...(located.unit.traits ?? [])],
  };
  const combat = app.bridge.combatSnapshot();
  return {
    located,
    diagnostics: unitDiagnostics(
      placement,
      "L",
      runView.playerSideBonus(run),
      combat?.environment ?? environmentFor(run.round),
      combat?.fighters.find((fighter) => fighter.uid === uid),
      false,
    ),
  };
}

function enemyDiagnostics(app: App, uid: string) {
  const run = app.bridge.run();
  if (!run) return null;
  const preview = app.bridge.prepareEnemyPreview();
  const placement = (preview?.units ?? run.enemyPreview).find((unit) => unit.uid === uid);
  if (!placement) return null;
  const combat = app.bridge.combatSnapshot();
  const source = preview?.source ?? combat?.enemySource ?? "saved";
  return unitDiagnostics(
    {
      ...placement,
      equips: placement.equips ? [...placement.equips] : undefined,
      traits: placement.traits ? [...placement.traits] : undefined,
    },
    "R",
    runView.enemySideBonus(run, source),
    combat?.environment ?? environmentFor(run.round),
    combat?.fighters.find((fighter) => fighter.uid === uid),
    true,
  );
}

const diagnosticStatLine = (stats: UnitStatSnapshot) =>
  `HP ${Math.round(stats.hp)}/${Math.round(stats.maxHp)} · ATK ${Math.round(stats.atk)} · DEF ${Math.round(stats.def)} · MATK ${Math.round(stats.matk)} · MDEF ${Math.round(stats.mdef)}`;

function appendDiagnosticSummary(app: App, root: HTMLElement, diagnostics: UnitDiagnostics) {
  const unitDef = getUnit(diagnostics.baseId);
  const heading = h("strong", "", `${unitDef.nameVi} ★${diagnostics.star}`);
  app.tooltip.bind(heading, () => ({
    title: `${unitDef.nameVi} ★${diagnostics.star}`,
    subtitle: `${unitDef.role} · ${unitDef.element} · ${unitDef.faction}`,
    lines: [
      { text: diagnosticStatLine(diagnostics.live) },
      { text: `Rage ${Math.round(diagnostics.live.rage)}/${Math.round(diagnostics.live.rageMax)} · Shield ${Math.round(diagnostics.live.shield)} · Range ${diagnostics.live.range}` },
    ],
    body: unitDef.pitchVi,
  }));
  root.append(
    heading,
    h("div", "slot", `${unitDef.role} · ${unitDef.element} · ${unitDef.faction}`),
    h("div", "slot", `Gốc · ${diagnosticStatLine(diagnostics.base)}`),
    h("div", "slot", `Suy ra · ${diagnosticStatLine(diagnostics.derived)}`),
    h("div", "slot", `Hiện tại · ${diagnosticStatLine(diagnostics.live)} · Rage ${Math.round(diagnostics.live.rage)}/${Math.round(diagnostics.live.rageMax)} · Shield ${Math.round(diagnostics.live.shield)}`),
    h("div", "slot", `CRIT ${Math.round(diagnostics.live.crit * 100)}% · ACC ${Math.round(diagnostics.live.accuracy * 100)}% · EVA ${Math.round(diagnostics.live.evade * 100)}% · LS ${Math.round(diagnostics.live.lifesteal * 100)}%`),
    h("div", "slot", `${t("library.basic")}: ${unitDef.basic.textVi} · ${t("library.target")}: ${diagnostics.derived.range}`),
    h("div", "slot", `${t("library.skill")}: ${unitDef.skill.nameVi} (${t("unit.rage", { cost: diagnostics.derived.rageMax })})`),
    h("div", "slot", unitDef.skill.starDetailVi[diagnostics.star - 1] ?? unitDef.skill.detailVi),
  );
  if (unitDef.skill.targetVi) root.append(h("div", "slot", `${t("library.target")}: ${unitDef.skill.targetVi}`));
  if (unitDef.skill.shapeVi) root.append(h("div", "slot", `${t("library.shape")}: ${unitDef.skill.shapeVi}`));
  if (diagnostics.effects.length) {
    root.append(h("strong", "", "Hiệu ứng"));
    for (const effect of diagnostics.effects) {
      const value = effect.pct ? `${effect.value}%` : String(effect.value);
      root.append(h("div", "slot", `${effect.kind} · ${effect.key} · ${value} · ${effect.turns}T${effect.detail ? ` · ${effect.detail}` : ""}`));
    }
  }
}

function openOwnedUnitDetail(app: App, uid: string) {
  const initial = ownedDiagnostics(app, uid);
  if (!initial) return;
  const title = getUnit(initial.located.unit.baseId).nameVi;
  openPanelModal(app, { id: "owned-unit-detail", title, size: "lg" }, (m) => {
    const render = () => {
      const current = ownedDiagnostics(app, uid);
      if (!current) {
        m.close();
        return;
      }
      const { located, diagnostics } = current;
      const capacity = slotCap(located.unit.baseId, located.unit.star);
      const root = h("div", "stack owned-unit-detail");
      appendDiagnosticSummary(app, root, diagnostics);
      root.append(h("strong", "", `${t("planning.items")} · ${located.unit.equips.length}/${capacity}`));
      if (!located.unit.equips.length) root.append(h("div", "slot", t("planning.empty")));
      located.unit.equips.forEach((itemId, equippedIndex) => {
        const row = h("div", "slot");
        const item = getEquipment(itemId);
        if (item) app.tooltip.bind(row, () => ({
          title: itemName(itemId),
          subtitle: t("library.tier", { tier: item.tier }),
          lines: [{ text: item.id }],
        }));
        const unequip = kitButton({
          skin: "plum",
          label: `${t("planning.unequip")} ${itemName(itemId)}`,
          onClick: () => { app.bridge.unequip(located.where, located.index, equippedIndex); },
        });
        row.append(h("span", "grow", itemName(itemId)), unequip.el);
        root.append(row);
      });
      const equipmentBag = [...new Set(app.bridge.run()?.itemBag.filter((id) => getEquipment(id) !== null) ?? [])];
      if (equipmentBag.length) {
        const equipActions = h("div", "row");
        for (const itemId of equipmentBag) {
          const item = getEquipment(itemId);
          if (!item) continue;
          const equip = kitButton({
            skin: "green",
            label: `${t("planning.equip")} ${itemName(itemId)}`,
            onClick: () => { app.bridge.equip(itemId, located.where, located.index); },
          });
          app.tooltip.bind(equip.el, () => ({
            title: itemName(itemId),
            subtitle: t("library.tier", { tier: item.tier }),
            lines: [{ text: item.id }],
          }));
          equip.setDisabled(item.tier > located.unit.star || located.unit.equips.length >= capacity);
          equipActions.append(equip.el);
        }
        root.append(equipActions);
      }
      const sell = kitButton({
        skin: "wood",
        label: t("planning.sell"),
        onClick: () => { if (app.bridge.sell(located.where, located.index)) m.close(); },
      });
      root.append(sell.el);
      m.body.replaceChildren(root);
    };
    const off = app.bridge.onChange(render);
    render();
    return { dispose: off };
  });
}

function openEnemyUnitDetail(app: App, uid: string) {
  const initial = enemyDiagnostics(app, uid);
  if (!initial) return;
  const title = getUnit(initial.baseId).nameVi;
  openPanelModal(app, { id: "enemy-unit-detail", title, size: "lg" }, (m) => {
    const render = () => {
      const diagnostics = enemyDiagnostics(app, uid);
      if (!diagnostics) {
        m.close();
        return;
      }
      const root = h("div", "stack owned-unit-detail");
      appendDiagnosticSummary(app, root, diagnostics);
      root.append(h("strong", "", `${t("planning.items")} · ${diagnostics.equips.length}`));
      if (!diagnostics.equips.length) root.append(h("div", "slot", t("planning.empty")));
      for (const itemId of diagnostics.equips) root.append(h("div", "slot", itemName(itemId)));
      m.body.replaceChildren(root);
    };
    const off = app.bridge.onChange(render);
    render();
    return { dispose: off };
  });
}

const openLibrary = (app: App, id?: string) =>
  openPanelModal(app, { id: "library", title: t("menu.library"), size: "full" }, (m) => mountLibrary(m, portraits, app.tooltip, id));
registerPanel("library", (app) => openLibrary(app));
registerPanel("unit-detail", (app, id) => {
  if (id?.startsWith("owned:")) {
    openOwnedUnitDetail(app, id.slice("owned:".length));
    return;
  }
  if (id?.startsWith("enemy:")) {
    openEnemyUnitDetail(app, id.slice("enemy:".length));
    return;
  }
  openLibrary(app, id);
});
registerPanel("settings", (app) =>
  openPanelModal(app, {
    id: "settings", title: t("menu.settings"), size: "lg",
    headerAction: { icon: ICONS.home, label: t("settings.home"), onClick: () => openReturnToMenuConfirm(app) },
  }, (m) =>
    mountSettings(m, app.bridge.settings, {
      hasRun: app.bridge.saveSummary().kind !== "none",
      exportRun: () => app.bridge.exportRun(),
      clearRun: () => { app.bridge.clearRun(); m.close(); app.go("menu"); },
    })));
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
  openPanelModal(app, { id: "inventory", title: t("planning.inventory"), size: "lg" }, (m) => mountInventoryCraft(app, m)));
registerPanel("craft", (app) =>
  openPanelModal(app, { id: "craft", title: t("planning.craft"), size: "lg" }, (m) => mountInventoryCraft(app, m)));
registerPanel("recipes", (app) =>
  openPanelModal(app, { id: "recipes", title: t("planning.recipes"), size: "lg" }, mountRecipes));
registerPanel("augment", (app) =>
  openPanelModal(app, { id: "augment", title: t("planning.augment"), size: "lg", dismissible: false }, (m) => mountAugments(app, m)));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx } | null = null;
  let resultFireworks: VictoryFireworks | null = null;
  const drag = createPlanningDragController({
    stage,
    board,
    getRun: () => bridge.run(),
    move: (from, to) => bridge.move(from, to),
    select: (source) => {
      const run = bridge.run();
      const unit = source.kind === "bench" ? run?.bench[source.index] : run?.board[source.index];
      if (!unit) return;
      app.openPanel("unit-detail", ownedPanelId(unit.uid));
      bridge.tutorialEvent("show_attack_preview", "show_attack_preview", {
        source: { where: source.kind, index: source.index },
      });
    },
    preview: (source, anchor) => {
      const run = bridge.run();
      const unit = source.kind === "bench" ? run?.bench[source.index] : run?.board[source.index];
      if (!unit) {
        app.tooltip.hide();
        return;
      }
      const definition = getUnit(unit.baseId);
      app.tooltip.show(anchor, {
        title: `${definition.nameVi} ★${unit.star}`,
        subtitle: [
          t(`role.${definition.role}` as MsgKey),
          t(`element.${definition.element}` as MsgKey),
          t(`faction.${definition.faction}` as MsgKey),
        ].join(" · "),
      });
    },
    previewEnd: () => app.tooltip.hide(),
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
    cortisol: () => {
      if (!combat && bridge.run()?.phase === "PLANNING") board.startLowCortisol();
    },
    pan: (x, y) => stage.setPan(x, y),
  });
  const sync = () => {
    const run = bridge.run();
    if (!run) return;
    const preview = bridge.prepareEnemyPreview();
    const renderRun = preview && preview.units !== run.enemyPreview ? { ...run, enemyPreview: preview.units } : run;
    stage.arena.setEnvironment(environmentFor(run.round));
    stage.arena.setDayNight(dayNightForRound(run.round));
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
    stage.arena.clearHighlights();
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
    app.music.play("combat");
    board.setCombat(true);
    const fx = createCombatFx(stage.scene);
    const speedLevel = run?.speedLevel ?? 0;
    const speedMultiplier = getGameSpeedDisplayMultiplier(speedLevel);
    const combatRound = run?.round ?? 1;
    const showResult = (summary: RoundResultSummary | null) => {
      if (!summary) return false;
      const reserveOrigins: VictoryFireworkOrigin[] = [];
      if (summary.winner === "LEFT") {
        board.forEach((_uid, visual, kind) => {
          if (kind !== "bench") return;
          reserveOrigins.push({ x: visual.root.position.x, y: visual.root.position.y, z: visual.root.position.z });
        });
      }
      endCombat();
      resultFireworks?.dispose();
      resultFireworks = summary.winner === "LEFT" && reserveOrigins.length
        ? createVictoryFireworks(stage.scene, stage.onFrame, reserveOrigins)
        : null;
      app.music.play(summary.winner === "LEFT" ? "victory" : "defeat");
      openResult(app.modals, combatRound, summary, () => {
        resultFireworks?.dispose();
        resultFireworks = null;
        if (summary.gameOver) app.go("menu");
        else { app.music.play("planning"); sync(); }
      });
      return true;
    };
    const chud = createCombatHud(app.layers.hud, {
      speed: () => app.openPanel("tech"),
      finishFast: () => { showResult(session.finishFast()); },
      history: () => app.openPanel("history"),
      information: () => app.openPanel("information"),
      settings: () => app.openPanel("settings"),
    });
    const strength = (list: RosterEntry[]) => teamStrength(list.map((r) => {
      const u = getUnit(r.baseId), k = STAR_STAT[r.star] ?? 1;
      return { hp: r.hp, maxHp: r.maxHp, shield: r.shield, atk: u.stats.atk * k, matk: u.stats.matk * k, def: u.stats.def * k, mdef: u.stats.mdef * k, star: r.star, tier: u.tier, alive: r.hp > 0 };
    }));
    const player = playCombat({
      board, fx, roster: session.roster, events: session.events, onFrame: stage.onFrame,
      onEvent: (event) => {
        if (event.t !== "cast") {
          stage.arena.clearHighlights();
          return;
        }
        const highlights: TacticalHighlightCell[] = [];
        const source = board.slot(event.src);
        if (source && source.row >= 0) highlights.push({ col: source.col, row: source.row, role: "source" });
        event.targets.forEach((uid, index) => {
          const target = board.slot(uid);
          if (target && target.row >= 0) highlights.push({
            col: target.col,
            row: target.row,
            role: index === 0 ? "direct" : "area",
          });
        });
        stage.arena.setHighlights(highlights);
      },
      onTick: (tk) => chud.update({
        round: combatRound, cycle: tk.cycle, speed: speedMultiplier,
        finishFastCost: finishFastCost({ techLevels: run?.techLevels ?? {} }),
        // LOGIC: anti-stall multiplier (A17) belongs to canonical combat; expose it on the session.
        escalation: 1,
        left: strength(tk.all.filter((r) => r.side === "L")), right: strength(tk.all.filter((r) => r.side === "R")),
        queue: tk.queue.map((uid) => { const r = tk.all.find((x) => x.uid === uid); return { name: r ? getUnit(r.baseId).nameVi : uid, side: r?.side ?? "L", icon: r ? ICONS[getUnit(r.baseId).role] : ICONS.sleep }; }),
        log: tk.log,
      }),
    });
    player.setSpeed(speedLevel);
    combat = { player, hud: chud, fx };
    void player.done.then(() => {
      if (!combat || combat.player !== player) return;
      const summary = session.finish();
      if (showResult(summary)) return;
      endCombat();
      app.music.play("planning");
      sync();
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
    const key = normalizeKey(event.code === "ShiftRight" ? "SHIFT_RIGHT" : event.key === " " ? "SPACE" : event.key);
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
    } else if (key === bindings.newRun) {
      event.preventDefault();
      const current = bridge.run();
      if (current) bridge.newRun(current.mode, current.aiMode);
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
  return { dispose() { window.removeEventListener("keydown", onKeyDown); drag.dispose(); resultFireworks?.dispose(); resultFireworks = null; endCombat(); for (const o of offs) o(); hud.dispose(); board.dispose(); } };
});

registerPanel("information", (app) => openInformation(app));
registerUtility("information", (app) => openInformation(app));
registerUtility("mods", (app) => openMods(app));
registerUtility("donate", (app) => openDonate(app));
registerUtility("tribute", (app) => openUndeveloped(app, "tribute"));
registerUtility("social", (app) => openUndeveloped(app, "social"));

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
