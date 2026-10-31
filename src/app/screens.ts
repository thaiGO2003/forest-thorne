// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange, type MsgKey } from "../core/i18n";
import { BOARD_SIZE, boardCount, slotCap, unequipQuote, type RoundResultSummary } from "../core/run";
import { RECIPES } from "../core/craft";
import { getEquipment } from "../core/equipment";
import { AUGMENT_BY_ID } from "../core/augments";
import { dispatchPlanningShortcut, type PlanningShortcutActions } from "./planningShortcuts";
import { h, kitButton, nineSlice, panelEl, surface, threeSlice } from "../ui/kit";
import { createPlanningHud } from "../ui/planning";
import { mountLibrary } from "../ui/library";
import { mountAchievements } from "../ui/achievements";
import { mountReadonlyUnitInventory, mountUnitInventory } from "../ui/unitInventory";
import { mountCraftWorkbench } from "../ui/crafting/workbench";
import { findOwnedUnit, inspectOwnedUnit, type OwnedUnitInspection } from "../core/unitInventory";
import { combatTargetPreview, snapshotWithResources } from "../core/combat";
import { mountSettings } from "../ui/settings";
import { mountTechTree } from "../ui/techTree";
import { mountHistory, mountHistoryView } from "../ui/history";
import type { ModalHandle, ModalOptions } from "../ui/modal";
import type { TooltipContent } from "../ui/tooltip";
import { applyLocale, registerPanel, registerScreen, registerUtility, type App } from "./app";
import { runView } from "./bridge";
import { createBoardView } from "../units/boardView";
import { createPortraits } from "../units/portraits";
import { createPlanningDragController } from "./planningDrag";
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { openExternalHttpUrl } from "../platform/discordActivity";
import { STAR_STAT } from "../core/economy";
import { teamStrength, unitDiagnostics, type UnitDiagnostics } from "../core/inspection";
import { basicAttackCopy } from "../core/unitText";
import { environmentFor } from "../core/environment";
import { dayNightForRound } from "../core/dayNight";
import { WEATHER_BLESSING_ENVIRONMENT } from "../core/blessings";
import { getGameSpeedDisplayMultiplier } from "../core/gameSpeed";
import { finishFastCost } from "../core/combatFast";
import { createModManager, type ModManager, type ModPackageType, type ModSource, type ModValidationIssue } from "../mods/ModRegistry";
import { createCombatHud, openResult, type CombatHudView } from "../ui/combat";
import { createCombatFx, type CombatFx } from "../units/fx";
import { createCombatLowHpMusic } from "../audio/CombatLowHpMusic";
import { playCombat, type CombatPlayer, type RosterEntry } from "../units/combatPlayer";
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
function openPanelModal(app: App, o: ModalOptions, mount: (m: ModalHandle) => { dispose(): void } | void) {
  const m = app.modals.open({ closeLabel: t("ui.close"), ...o });
  const view = mount(m);
  const off = app.modals.onChange((active) => { if (active !== o.id) { off(); view?.dispose(); } });
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
const MOD_PACKAGE_TYPE_COPY: Record<ModPackageType, MsgKey> = {
  ".ftunit": "mods.packageType.ftunit",
  ".ftlogic": "mods.packageType.ftlogic",
  ".ftmodpack": "mods.packageType.ftmodpack",
};
const MOD_SOURCE_COPY: Record<ModSource, MsgKey> = {
  bundled: "mods.source.bundled",
  local: "mods.source.local",
  workshop: "mods.source.workshop",
};

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
  let amount: number = 20_000;
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

  const qrWrap = panelEl("slot_well", "donate-qr-wrap");
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
  type ModHubView = "installed" | "enabled" | "local";
  let view: ModHubView = "installed";
  let selectedModId: string | null = null;
  let importStatus = "";
  void modManager().then((manager) => {
    if (app.modals.active() !== "mods") return;
    const render = () => {
      root.replaceChildren();
      const index = manager.getIndex();
      const profile = manager.getProfile();
      const rank = new Map(profile.loadOrder.map((id, position) => [id, position]));
      const allManifests = [...index.mods].sort((a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
      const manifests = allManifests.filter((manifest) =>
        view === "installed" || (view === "enabled" ? manager.isEnabled(manifest.id) : manifest.source === "local"));
      const warnings = manager.getRegistryWarnings();
      const issues = manager.validateEnabled();
      const workshopStatus = index.workshop.status === "available" ? t("mods.workshopAvailable") : t("mods.workshopPlaceholder");
      if (selectedModId && !manifests.some((manifest) => manifest.id === selectedModId)) selectedModId = null;
      selectedModId ??= manifests[0]?.id ?? null;

      const header = h("div", "stack mods-header");
      const summary = h("div", "mods-summary");
      summary.append(
        h("div", "slot", t("mods.summary", { enabled: profile.enabledIds.length, total: allManifests.length })),
        h("div", "slot", t("mods.workshop") + ": " + workshopStatus + (index.workshop.appId ? " · " + index.workshop.appId : "")),
      );
      const nav = h("div", "tabs mods-nav");
      const navItems: Array<{ id: ModHubView; label: MsgKey }> = [
        { id: "installed", label: "mods.installed" },
        { id: "enabled", label: "mods.enabledOnly" },
        { id: "local", label: "mods.localOnly" },
      ];
      for (const item of navItems) {
        const button = kitButton({
          skin: "wood",
          label: t(item.label),
          onClick: () => {
            view = item.id;
            selectedModId = null;
            render();
          },
        });
        button.setSelected(view === item.id);
        nav.append(button.el);
      }
      const importRow = h("div", "row mod-import");
      const importLabel = h("span", "", t("mods.import"));
      const importInput = document.createElement("input");
      importInput.type = "file";
      importInput.accept = ".ftunit,.ftlogic,.ftmodpack";
      importInput.className = "mod-import-input";
      importInput.setAttribute("aria-label", t("mods.import"));
      importInput.addEventListener("change", async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        try {
          const result = manager.importLocalPackage(file.name, await file.text());
          if (result.ok) {
            importStatus = t("mods.importSuccess", { name: result.manifest.name });
            view = "local";
            selectedModId = result.manifest.id;
          } else {
            const key: Record<typeof result.kind, MsgKey> = {
              "unsupported-extension": "mods.importUnsupported",
              "invalid-json": "mods.importInvalidJson",
              "invalid-manifest": "mods.importInvalidManifest",
              "duplicate-id": "mods.importDuplicate",
            };
            importStatus = t(key[result.kind]);
          }
        } catch {
          importStatus = t("mods.importReadFailed");
        }
        if (app.modals.active() === "mods") render();
      });
      importRow.append(importLabel, importInput);
      header.append(summary, nav, importRow);
      if (importStatus) {
        const status = h("div", "slot", importStatus);
        status.setAttribute("role", "status");
        header.append(status);
      }
      root.append(header);

      const layout = h("div", "mods-layout");
      const list = h("div", "stack mods-list");
      if (!allManifests.length) list.append(h("div", "slot", t("mods.empty")));
      else if (!manifests.length) list.append(h("div", "slot", t("mods.filterEmpty")));
      for (const manifest of manifests) {
        const enabled = manager.isEnabled(manifest.id);
        const position = profile.loadOrder.indexOf(manifest.id);
        const card = panelEl("panel_tooltip", "mod-row mod-card");
        card.dataset.selected = String(manifest.id === selectedModId);
        const icon = h("span", "mod-icon", ICONS.mods);
        icon.setAttribute("aria-hidden", "true");
        const copy = h("div", "grow mod-copy");
        copy.append(
          h("strong", "", manifest.name + " · v" + manifest.version),
          h("div", "mod-state", manifest.author + " · " + t(enabled ? "mods.enabled" : "mods.disabled")
            + " · " + t("mods.loadOrder") + ": " + (position >= 0 ? String(position + 1) : "—")),
          h("small", "", t(MOD_PACKAGE_TYPE_COPY[manifest.packageType])),
        );
        const actions = h("div", "row mod-actions");
        const details = kitButton({
          skin: "wood",
          label: t("mods.details"),
          onClick: () => {
            selectedModId = manifest.id;
            render();
          },
        });
        details.setSelected(manifest.id === selectedModId);
        const toggle = kitButton({
          skin: enabled ? "red" : "green",
          label: t(enabled ? "mods.disable" : "mods.enable"),
          onClick: () => {
            if (manager.isEnabled(manifest.id)) manager.disable(manifest.id);
            else manager.enable(manifest.id);
            render();
          },
        });
        actions.append(details.el, toggle.el);
        card.append(icon, copy, actions);
        list.append(card);
      }

      const detail = panelEl("panel_tooltip", "stack mod-detail");
      const selected = allManifests.find((manifest) => manifest.id === selectedModId);
      if (!selected) {
        detail.append(h("div", "slot", allManifests.length ? t("mods.filterEmpty") : t("mods.empty")));
      } else {
        const enabled = manager.isEnabled(selected.id);
        const position = profile.loadOrder.indexOf(selected.id);
        const title = h("div", "mod-detail-title");
        const icon = h("span", "mod-icon", ICONS.mods);
        icon.setAttribute("aria-hidden", "true");
        title.append(icon, h("strong", "", selected.name + " · v" + selected.version));
        detail.append(title, h("div", "", selected.description || t("mods.noDescription")));
        const meta = h("div", "mod-meta");
        meta.append(
          h("small", "", t("mods.packageType") + ": " + t(MOD_PACKAGE_TYPE_COPY[selected.packageType])),
          h("small", "", t("mods.source") + ": " + t(MOD_SOURCE_COPY[selected.source])),
          h("small", "", t("mods.author") + ": " + selected.author),
        );
        const relations = h("div", "mod-relations");
        relations.append(
          h("small", "", t("mods.requires") + ": " + listCopy(selected.requires)),
          h("small", "", t("mods.conflicts") + ": " + listCopy(selected.conflicts)),
          h("small", "", t("mods.tags") + ": " + listCopy(selected.tags)),
        );
        detail.append(meta, relations);
        if (selected.workshopId) detail.append(h("small", "", t("mods.workshop") + ": " + selected.workshopId));
        const packageIssues = issues.filter((issue) => issue.modId === selected.id);
        if (packageIssues.length) {
          const packageValidation = h("div", "mod-package-issues");
          for (const issue of packageIssues) packageValidation.append(h("small", "", issueCopy(issue)));
          detail.append(packageValidation);
        }
        const actions = h("div", "row mod-actions");
        const toggle = kitButton({
          skin: enabled ? "red" : "green",
          label: t(enabled ? "mods.disable" : "mods.enable"),
          onClick: () => {
            if (manager.isEnabled(selected.id)) manager.disable(selected.id);
            else manager.enable(selected.id);
            render();
          },
        });
        const up = kitButton({ skin: "wood", label: t("mods.up"), onClick: () => { manager.move(selected.id, -1); render(); } });
        const down = kitButton({ skin: "wood", label: t("mods.down"), onClick: () => { manager.move(selected.id, 1); render(); } });
        up.setDisabled(!enabled || position <= 0);
        down.setDisabled(!enabled || position < 0 || position >= profile.loadOrder.length - 1);
        actions.append(toggle.el, up.el, down.el);
        if (selected.source === "local") {
          const remove = kitButton({
            skin: "red",
            label: t("mods.remove"),
            onClick: () => {
              if (manager.removeLocal(selected.id)) {
                importStatus = t("mods.removeSuccess", { name: selected.name });
                selectedModId = null;
                render();
              }
            },
          });
          actions.append(remove.el);
        }
        detail.append(actions);
      }
      layout.append(list, detail);
      root.append(layout);

      const validation = h("div", "stack mod-validation");
      validation.append(h("strong", "", t("mods.validation")));
      if (!issues.length && !warnings.length) validation.append(h("div", "slot", t("mods.noIssues")));
      for (const issue of issues) validation.append(h("div", "slot", issueCopy(issue)));
      for (const warning of warnings) {
        const row = h("div", "slot", t("mods.warning") + ": " + warning.message);
        row.setAttribute("role", "alert");
        validation.append(row);
      }
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
  type InfoTab = "overview" | "weather" | "sides" | "formations" | "synergy" | "effects" | "history";
  let active: InfoTab = "overview";
  let mountedHistory: { dispose(): void } | null = null;
  const tabDefs: Array<{ id: InfoTab; key: MsgKey }> = [
    { id: "overview", key: "info.overview" },
    { id: "weather", key: "info.weather" },
    { id: "sides", key: "info.sides" },
    { id: "formations", key: "info.formations" },
    { id: "synergy", key: "info.synergy" },
    { id: "effects", key: "info.effects" },
    { id: "history", key: "info.history" },
  ];
  const tabButtons = tabDefs.map((tab) => {
    const button = kitButton({ skin: "blue", label: t(tab.key), onClick: () => { active = tab.id; render(); } });
    tabs.append(button.el);
    return { ...tab, button };
  });

  const disposeTabContent = () => {
    mountedHistory?.dispose();
    mountedHistory = null;
    body.replaceChildren();
  };

  const appendKv = (host: HTMLElement, label: string, value: string | number, skin: "panel_tooltip" | "slot_well" = "slot_well") => {
    const row = panelEl(skin, "info-kv");
    row.append(h("strong", "", label), h("span", "", String(value)));
    host.append(row);
  };

  const statTile = (host: HTMLElement, icon: string, label: string, value: string | number) => {
    const tile = panelEl("shell_billboard", "info-stat");
    tile.append(
      h("span", "info-stat-icon", icon),
      h("strong", "info-stat-value", String(value)),
      h("span", "info-stat-label", label),
    );
    host.append(tile);
  };

  const section = (title: string, icon: string, cls = "") => {
    const panel = panelEl("panel_parchment", `info-sec ${cls}`.trim());
    const head = h("div", "info-sec-head");
    head.append(h("span", "info-sec-icon", icon), h("h3", "info-sec-title", title));
    const inner = h("div", "info-sec-body");
    panel.append(head, inner);
    return { panel, inner };
  };

  const unitList = (
    host: HTMLElement,
    entries: Array<{ uid: string; baseId: string; star: number; equips?: string[] }>,
    empty: string,
    detailId: (entry: { uid: string }) => string,
  ) => {
    if (!entries.length) {
      host.append(h("div", "info-empty", empty));
      return;
    }
    for (const entry of entries) {
      const unit = getUnit(entry.baseId);
      const row = panelEl("slot_well", "info-unit");
      const medal = h("span", "info-medal", ICONS[unit.role]);
      medal.setAttribute("aria-hidden", "true");
      const copy = h("div", "grow");
      copy.append(
        h("strong", "", `${unit.nameVi} ★${entry.star}`),
        h("div", "info-unit-meta", `${ICONS[unit.element]} ${t(`element.${unit.element}` as MsgKey)} · ${ICONS[unit.faction]} ${t(`faction.${unit.faction}` as MsgKey)} · ${t(`role.${unit.role}` as MsgKey)}`),
      );
      if (entry.equips?.length) copy.append(h("small", "", entry.equips.map(itemName).join(" · ")));
      const details = kitButton({ skin: "wood", label: t("planning.details"), onClick: () => app.openPanel("unit-detail", detailId(entry)) });
      row.append(medal, copy, details.el);
      host.append(row);
    }
  };

  const compareMetric = (host: HTMLElement, icon: string, label: string, ally: number, enemy: number) => {
    const card = panelEl("slot_well", "info-compare");
    const max = Math.max(1, ally, enemy);
    const head = h("div", "info-compare-head");
    const medal = h("span", "info-medal", icon);
    medal.setAttribute("aria-hidden", "true");
    const labelRow = h("div", "info-compare-label");
    labelRow.append(medal, h("strong", "", label));
    head.append(
      labelRow,
      h("span", "info-compare-values", `${t("info.allies")}: ${Math.round(ally)} · ${t("info.enemies")}: ${Math.round(enemy)}`),
    );
    const bars = h("div", "info-compare-bars");
    const meter = (side: "ally" | "enemy", value: number) => {
      const el = h("div", "info-meter");
      el.setAttribute("role", "meter");
      el.setAttribute("aria-label", `${side === "ally" ? t("info.allies") : t("info.enemies")} · ${label}`);
      el.setAttribute("aria-valuemin", "0");
      el.setAttribute("aria-valuemax", String(Math.round(max)));
      el.setAttribute("aria-valuenow", String(Math.round(value)));
      surface(el, (g, w, hh) => {
        nineSlice(g, "bar_trough", 1, 3, 3, Math.max(0, w - 6), Math.max(0, hh - 6));
        const fw = Math.round(Math.max(0, w - 6) * Math.max(0, Math.min(1, value / max)));
        g.fillStyle = side === "ally" ? "#55b86a" : "#d85f61";
        g.fillRect(3, 3, fw, Math.max(0, hh - 6));
        threeSlice(g, "frame_bar", 3, 0, 0, w, hh);
      });
      return el;
    };
    bars.append(meter("ally", ally), meter("enemy", enemy));
    card.append(head, bars);
    host.append(card);
  };

  const teamSnapshot = (entries: Array<{ uid: string }>, side: "L" | "R") => {
    const diagnostics = entries.flatMap((entry) => {
      const diagnostic = side === "L" ? ownedDiagnostics(app, entry.uid)?.diagnostics : enemyDiagnostics(app, entry.uid);
      return diagnostic ? [diagnostic] : [];
    });
    return teamStrength(diagnostics.map((diagnostic) => ({
      ...diagnostic.live,
      star: diagnostic.star,
      tier: getUnit(diagnostic.baseId).tier,
    })));
  };

  const render = () => {
    disposeTabContent();
    for (const tab of tabButtons) tab.button.setSelected(tab.id === active);
    const run = app.bridge.run();
    if (!run) {
      body.append(h("div", "slot", t("info.noRun")));
      return;
    }
    const preview = app.bridge.prepareEnemyPreview();
    const allies = run.board.filter((unit): unit is NonNullable<typeof unit> => unit !== null);
    const ownedAllies = [...allies, ...run.bench];
    const enemies = preview?.units ?? run.enemyPreview;
    const combat = app.bridge.combatSnapshot();

    if (active === "overview") {
      const friendly = teamSnapshot(allies, "L");
      const enemy = teamSnapshot(enemies, "R");
      const currentEnvironment = combat?.environment ?? environmentFor(run.round);

      const hero = panelEl("panel_wood", "info-hero");
      const heroCopy = h("div", "info-hero-copy");
      heroCopy.append(
        h("h2", "info-hero-title", t(`mode.${run.mode}` as MsgKey)),
        h("p", "info-hero-sub", `${t("combat.round", { round: run.round })} · ${t(`info.phase.${run.phase}` as MsgKey)} · ${t(`ai.${run.aiMode}` as MsgKey)}`),
      );
      const heroStats = h("div", "info-hero-stats");
      statTile(heroStats, ICONS.heart, t("info.hearts"), run.hp);
      statTile(heroStats, ICONS.gold, t("info.gold"), run.gold);
      statTile(heroStats, ICONS.level, t("info.level"), run.level);
      statTile(heroStats, ICONS.atk, t("info.teamPower"), Math.round(friendly.power));
      hero.append(heroCopy, heroStats);
      body.append(hero);

      const dashboard = h("div", "info-dashboard");

      const overview = section(t("info.overview"), ICONS.info);
      appendKv(overview.inner, t("combat.round", { round: run.round }), t(`info.phase.${run.phase}` as MsgKey));
      appendKv(overview.inner, t("info.cycle"), app.presentation.combatCycle ?? "—");
      appendKv(overview.inner, t("info.deployed"), allies.length);
      appendKv(overview.inner, t("info.environment"), t(`element.${currentEnvironment}` as MsgKey));
      appendKv(overview.inner, t("info.bench"), run.bench.length);
      dashboard.append(overview.panel);

      const formation = section(t("info.formations"), ICONS.synergy);
      unitList(formation.inner, ownedAllies, t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
      dashboard.append(formation.panel);

      const enemiesSection = section(t("info.enemiesPreview"), ICONS.start);
      unitList(enemiesSection.inner, enemies, t("info.noPreview"), (entry) => enemyPanelId(entry.uid));
      dashboard.append(enemiesSection.panel);

      const weather = section(t("info.weatherBlessings"), ICONS[currentEnvironment]);
      appendKv(weather.inner, t("info.currentWeather"), t(`element.${currentEnvironment}` as MsgKey));
      appendKv(weather.inner, t("info.nextWeather"), t(`element.${environmentFor(run.round + 1)}` as MsgKey));
      if (run.blessingQueue.length) {
        run.blessingQueue.forEach((id, index) => appendKv(weather.inner, `#${index + 1} ${t("info.weatherOrder")}`, t(`element.${WEATHER_BLESSING_ENVIRONMENT[id]}` as MsgKey)));
      } else {
        weather.inner.append(h("div", "info-empty", t("info.noBlessings")));
      }
      dashboard.append(weather.panel);

      const comparison = section(t("info.comparison"), ICONS.atk);
      compareMetric(comparison.inner, ICONS.hp, t("info.health"), friendly.hp, enemy.hp);
      compareMetric(comparison.inner, ICONS.atk, t("info.power"), friendly.power, enemy.power);
      appendKv(comparison.inner, t("info.allies"), friendly.units);
      appendKv(comparison.inner, t("info.enemies"), enemy.units);
      dashboard.append(comparison.panel);

      const mods = section(t("info.mods"), ICONS.synergy);
      if (!run.augments.length) mods.inner.append(h("div", "info-empty", t("info.noAugments")));
      for (const id of run.augments) {
        const def = AUGMENT_BY_ID.get(id);
        appendKv(mods.inner, id, def ? `${def.effect} ${def.value >= 0 ? "+" : ""}${def.value}` : id);
      }
      dashboard.append(mods.panel);

      body.append(dashboard);
      return;
    }

    if (active === "weather") {
      const current = combat?.environment ?? environmentFor(run.round);
      const rows = [
        [t("info.currentWeather"), t(`element.${current}` as MsgKey), t("info.confirmed")],
        [t("info.nextWeather"), t(`element.${environmentFor(run.round + 1)}` as MsgKey), t("info.forecast")],
        [t("info.followingWeather"), t(`element.${environmentFor(run.round + 2)}` as MsgKey), t("info.forecast")],
      ] as const;
      for (const [label, value, certainty] of rows) {
        const card = panelEl("panel_tooltip", "info-weather-card");
        card.append(h("strong", "", label), h("span", "", value), h("small", "", certainty));
        body.append(card);
      }
      return;
    }

    if (active === "sides") {
      const friendly = teamSnapshot(allies, "L");
      const enemy = teamSnapshot(enemies, "R");
      compareMetric(body, ICONS.hp, t("info.health"), friendly.hp, enemy.hp);
      compareMetric(body, ICONS.atk, t("info.power"), friendly.power, enemy.power);
      const counts = h("div", "info-summary");
      appendKv(counts, t("info.allies"), friendly.units);
      appendKv(counts, t("info.enemies"), enemy.units);
      body.append(counts);
      return;
    }

    if (active === "formations") {
      body.append(h("strong", "", t("info.allies")));
      unitList(body, ownedAllies, t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
      body.append(h("strong", "", t("info.enemies")));
      unitList(body, enemies, t("info.noUnits"), (entry) => enemyPanelId(entry.uid));
      return;
    }

    if (active === "synergy") {
      const synergies = runView.synergies(run);
      if (!synergies.length) body.append(h("div", "slot", t("planning.empty")));
      for (const line of synergies) {
        const kind = t(line.kind === "class" ? "info.synergyClass" : line.kind === "element" ? "info.synergyElement" : "info.synergyFaction");
        const prefix = line.kind === "class" ? "role" : line.kind;
        const name = t(`${prefix}.${line.key}` as MsgKey);
        const row = panelEl("panel_tooltip", "info-kv");
        row.append(h("strong", "", `${kind}: ${name}`), h("span", "", `${line.count} / ${line.next ?? line.active}`));
        body.append(row);
      }
      return;
    }

    if (active === "effects") {
      body.append(h("strong", "", t("info.activeEffects")));
      if (!run.augments.length) body.append(h("div", "slot", t("planning.empty")));
      for (const id of run.augments) {
        const def = AUGMENT_BY_ID.get(id);
        const row = panelEl("panel_tooltip", "info-kv");
        row.append(h("strong", "", id), h("span", "", def ? `${def.effect} ${def.value >= 0 ? "+" : ""}${def.value}` : id));
        body.append(row);
      }
      body.append(h("strong", "", t("info.weatherOrder")));
      if (!run.blessingQueue.length) body.append(h("div", "slot", t("planning.empty")));
      run.blessingQueue.forEach((id, index) => {
        const environment = WEATHER_BLESSING_ENVIRONMENT[id];
        const row = panelEl("panel_tooltip", "info-kv");
        const actions = h("div", "row");
        const up = kitButton({
          skin: "wood",
          label: t("mods.up"),
          onClick: () => {
            if (app.bridge.reorderWeatherBlessing(index, index - 1)) render();
          },
        });
        const down = kitButton({
          skin: "wood",
          label: t("mods.down"),
          onClick: () => {
            if (app.bridge.reorderWeatherBlessing(index, index + 1)) render();
          },
        });
        const editable = run.phase === "PLANNING";
        up.setDisabled(!editable || index === 0);
        down.setDisabled(!editable || index === run.blessingQueue.length - 1);
        actions.append(up.el, down.el);
        row.append(h("strong", "", `#${index + 1}`), h("span", "", t(`element.${environment}` as MsgKey)), actions);
        body.append(row);
      });
      return;
    }

    mountedHistory = mountHistoryView(body, app.bridge.history());
  };
  root.append(tabs, body);
  m.body.append(root);
  const off = app.modals.onChange((activeModal) => {
    if (activeModal === "information") return;
    off();
    mountedHistory?.dispose();
    for (const tab of tabButtons) tab.button.dispose();
  });
  render();
}

function mountInventory(app: App, host: HTMLElement) {
  let buttons: ReturnType<typeof kitButton>[] = [];
  const render = () => {
    for (const button of buttons) button.dispose();
    buttons = [];
    const run = app.bridge.run();
    host.replaceChildren();
    if (!run) return;

    const root = h("div", "stack");
    root.append(h("strong", "", t("planning.items")));
    const bag = h("div", "row");
    for (const id of run.itemBag) bag.append(h("div", "slot", itemName(id)));
    if (!run.itemBag.length) bag.append(h("div", "slot", t("planning.empty")));
    root.append(bag);

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
        const capacity = slotCap(unit.baseId, unit.star);
        const title = h("div", "", `${index + 1}. ${getUnit(unit.baseId).nameVi} ★${unit.star} · ${unit.equips.length}/${capacity}`);
        const actions = h("div", "row button-row");
        const sell = kitButton({
          skin: "wood",
          label: t("planning.sell"),
          onClick: () => { app.bridge.sell(group.where, index); },
        });
        buttons.push(sell);
        actions.append(sell.el);
        const unequipCosts = unequipQuote(run, group.where, index);
        unit.equips.forEach((itemId, equippedIndex) => {
          const cost = unequipCosts?.[equippedIndex];
          const unequip = kitButton({
            skin: "plum",
            label: cost == null
              ? `${t("planning.unequip")} ${itemName(itemId)}`
              : `${t("inventory.unequip", { cost: `${cost} ${ICONS.gold}` })} ${itemName(itemId)}`,
            onClick: () => { app.bridge.unequip(group.where, index, equippedIndex); },
          });
          unequip.setDisabled(cost == null || run.gold < cost);
          buttons.push(unequip);
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
          equip.setDisabled(item.tier > unit.star || unit.equips.length >= capacity);
          buttons.push(equip);
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
  return {
    dispose() {
      off();
      for (const button of buttons) button.dispose();
    },
  };
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

function augmentChoiceCopy(id: string): string {
  const def = AUGMENT_BY_ID.get(id);
  if (!def) return id;
  if (def.effect === "heart_recovery") {
    return `Hồi tim tức thì · Hồi ngay ${def.value} ❤️, không vượt mức tim khởi đầu; không kích hoạt khi ván đã kết thúc.`;
  }
  if (def.effect === "heal_hearts_now") {
    return `Phục hồi tim · Hồi ngay ${def.value} ❤️ cho run còn sống ở chế độ dùng tim, không vượt mức tim khởi đầu.`;
  }
  if (def.effect === "heal_hearts_on_win") {
    return `Tim chiến thắng · Sau mỗi chiến thắng thực, hồi ${def.value} ❤️, không vượt mức tim khởi đầu.`;
  }
  if (def.effect === "heal_hearts_on_survived_loss") {
    return `Tim sống sót · Sau một trận thua nhưng chưa kết thúc run, hồi ${def.value} ❤️, không vượt mức tim khởi đầu.`;
  }
  return `${id} · ${def.effect} ${def.value >= 0 ? "+" : ""}${def.value}`;
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
      copy.textContent = augmentChoiceCopy(id);
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


/** Hover summary (A96 summary mode, cf. old-src `buildSummaryUnitSectionBlocks`): traits, headline
 *  combat numbers, active statuses and the star-resolved skill. The current/base/derived numeric
 *  breakdown stays on the diagnostics surface instead of being dumped onto the viewport. */
function unitSummaryTooltipContent(diagnostics: UnitDiagnostics): TooltipContent {
  const unitDef = getUnit(diagnostics.baseId);
  const { live, derived, effects, star } = diagnostics;
  const num = (v: number) => Math.round(v);
  const lines: NonNullable<TooltipContent["lines"]> = [
    { icon: ICONS.hp, text: `HP ${num(live.hp)}/${num(live.maxHp)}` },
    { icon: ICONS.atk, text: `ATK ${num(live.atk)} · DEF ${num(live.def)}` },
    { icon: ICONS.matk, text: `MATK ${num(live.matk)} · MDEF ${num(live.mdef)}` },
    { icon: ICONS.range, text: `Tầm ${num(live.range)} · Nộ ${num(live.rage)}/${num(live.rageMax)}` },
  ];
  for (const effect of effects.slice(0, 3)) {
    const value = effect.pct ? `${effect.value}%` : String(effect.value);
    lines.push({ text: `${effect.key} · ${value} · ${effect.turns}T` });
  }
  lines.push({
    icon: ICONS.star,
    text: `${t("library.skill")}: ${unitDef.skill.nameVi} (${t("unit.rage", { cost: derived.rageMax })})`,
  });
  return {
    title: `${unitDef.nameVi} ★${star}`,
    subtitle: [
      t(`role.${unitDef.role}` as MsgKey),
      t(`element.${unitDef.element}` as MsgKey),
      t(`faction.${unitDef.faction}` as MsgKey),
    ].join(" · "),
    lines,
    body: [
      unitDef.pitchVi,
      `${t("library.basic")}: ${basicAttackCopy(unitDef)}`,
      unitDef.skill.starDetailVi[star - 1] ?? unitDef.skill.detailVi,
    ].filter(Boolean).join("\n"),
  };
}



function openEnemyUnitDetail(app: App, uid: string) {
  const initial = enemyDiagnostics(app, uid);
  if (!initial) return;
  openPanelModal(app, { id: "enemy-unit-detail", title: getUnit(initial.baseId).nameVi, size: "lg" }, (m) => {
    const view = mountReadonlyUnitInventory(m, portraits, () => enemyDiagnostics(app, uid));
    const off = app.bridge.onChange(view.update);
    return { dispose() { off(); view.dispose(); } };
  });
}

const openLibrary = (app: App, id?: string) =>
  openPanelModal(
    app,
    { id: "library", title: t("menu.library"), size: "full" },
    (m) => mountLibrary(m, portraits, app.tooltip, app.bridge, id),
  );
registerPanel("library", (app) => openLibrary(app));
registerPanel("achievements", (app) =>
  openPanelModal(
    app,
    { id: "achievements", title: t("menu.achievements"), size: "full" },
    (m) => mountAchievements(m, app.bridge),
  ));
registerPanel("unit-detail", (app, id) => {
  if (id?.startsWith("owned:")) {
    app.presentation.openOwnedInventory?.(id.slice("owned:".length));
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
  openPanelModal(app, { id: "inventory", title: t("planning.inventory"), size: "full" }, (m) => mountInventory(app, m.body)));
registerPanel("recipes", (app) =>
  openPanelModal(app, { id: "recipes", title: t("planning.recipes"), size: "full" }, (m) => mountRecipes(m.body)));
registerPanel("craft", (app) =>
  openPanelModal(app, { id: "craft", title: t("planning.craft"), size: "full" }, (m) => mountCraftWorkbench(app, m.body)));
registerPanel("augment", (app) =>
  openPanelModal(app, { id: "augment", title: t("planning.augment"), size: "lg", dismissible: false }, (m) => mountAugments(app, m)));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx; lowHpMusic: { dispose(): void } } | null = null;
  let resultFireworks: VictoryFireworks | null = null;
  let planningEnemyPreview: ReturnType<typeof bridge.prepareEnemyPreview> = null;
  let selectedUid: string | null = null;
  let inventoryView: ReturnType<typeof mountUnitInventory> | null = null;
  let inventoryInspection: OwnedUnitInspection | null = null;
  let inventoryUid: string | null = null;
  const liveRoster = app.presentation.liveRoster;
  liveRoster.clear();
  app.presentation.combatCycle = null;
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
  app.presentation.openOwnedInventory = openOwnedInventory;
  const drag = createPlanningDragController({
    stage,
    board,
    getRun: () => bridge.run(),
    move: (from, to) => bridge.move(from, to),
    select: (source) => {
      const run = bridge.run();
      const unit = source.kind === "bench" ? run?.bench[source.index] : run?.board[source.index];
      if (!unit) return;
      openOwnedInventory(unit.uid);
      if (source.kind === "board" && run?.phase === "PLANNING") {
        bridge.tutorialEvent("show_attack_preview", "show_attack_preview", {
          source: { where: "board", index: source.index },
        });
      }
    },
    preview: (source, anchor) => {
      const run = bridge.run();
      const unit = source.kind === "bench" ? run?.bench[source.index] : run?.board[source.index];
      if (!unit) {
        board.setTargetPreview?.(null);
        app.tooltip.hide();
        return;
      }
      const inspection = ownedDiagnostics(app, unit.uid);
      if (!inspection) {
        board.setTargetPreview?.(null);
        app.tooltip.hide();
        return;
      }
      app.tooltip.show(anchor, unitSummaryTooltipContent(inspection.diagnostics));
      if (source.kind !== "board" || run?.phase !== "PLANNING" || !planningEnemyPreview) {
        board.setTargetPreview?.(null);
        return;
      }
      const fighters = bridge.planningCombatProjection(planningEnemyPreview);
      board.setTargetPreview?.(fighters ? combatTargetPreview(fighters, unit.uid, { kitPreview: true }) : null);
    },
    previewEnemy: (uid, anchor) => {
      const inspection = enemyDiagnostics(app, uid);
      if (!inspection) {
        app.tooltip.hide();
        return;
      }
      app.tooltip.show(anchor, unitSummaryTooltipContent(inspection));
      const fighters = planningEnemyPreview ? bridge.planningCombatProjection(planningEnemyPreview) : null;
      board.setTargetPreview?.(fighters ? combatTargetPreview(fighters, uid, { kitPreview: true }) : null);
    },
    previewEnd: () => {
      app.tooltip.hide();
      board.setTargetPreview?.(null);
    },
    inspectEnemy: (uid) => openEnemyUnitDetail(app, uid),
    enabled: () => !app.modals.blocking() && (bridge.run()?.phase === "PLANNING" || Boolean(combat)),
    inspectOnly: () => Boolean(combat),
  });
  const buyUnit = (slot: number) => {
    const bought = bridge.buy(slot);
    if (bought) void app.sfx.play("buy");
    return bought;
  };
  const rerollShop = () => {
    const rerolled = bridge.reroll();
    if (rerolled) void app.sfx.play("reroll");
    return rerolled;
  };
  const purchaseXp = () => {
    const purchased = bridge.buyXp();
    if (purchased) void app.sfx.play("buy");
    return purchased;
  };
  const hud = createPlanningHud(app.layers.hud, app.tooltip, portraits, {
    buy: buyUnit,
    details: (id) => app.openPanel("unit-detail", id),
    reroll: rerollShop,
    buyXp: purchaseXp,
    toggleLock: () => bridge.toggleLock(),
    start: () => runCombat(),
    action: (id) => app.openPanel(id),
    tutorialDismiss: (stepId) => bridge.dismissTutorial(stepId),
    tutorialSkip: () => bridge.skipTutorial(),
    cortisol: () => {
      if (!combat && bridge.run()?.phase === "PLANNING") board.startLowCortisol();
    },
  });
  const sync = () => {
    const run = bridge.run();
    if (!run) return;
    if (selectedUid && !findOwnedUnit(run, selectedUid)) { selectedUid = null; board.setSelected?.(null); }
    if (inventoryUid) { inventoryInspection = inspectOwnedUnit(run, inventoryUid); inventoryView?.update(); }
    const preview = bridge.prepareEnemyPreview();
    planningEnemyPreview = preview;
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
    app.presentation.combatCycle = null;
    liveRoster.clear();
    if (!combat) return;
    combat.player.dispose(); combat.hud.dispose(); combat.fx.dispose(); combat.lowHpMusic.dispose();
    combat = null;
    if (app.modals.active() === "unit-inventory") app.modals.closeActive();
    board.setCombat(false);
    hud.el.hidden = false;
    stage.setPhase("planning");
  };
  function runCombat() {
    if (combat || app.modals.blocking()) return;
    const session = bridge.startCombat();
    if (!session) return;
    app.ambience.setActive(false);
    app.presentation.combatCycle = 1;
    const run = bridge.run();
    hud.el.hidden = true;
    stage.setPhase("combat");
    app.music.play("combat");
    board.setCombat(true);
    const fx = createCombatFx(stage.scene);
    const lowHpMusic = createCombatLowHpMusic({
      settings: bridge.settings,
      allySrc: "/assets/audio/combat/combat_low_ally_01.mp3",
      enemySrc: "/assets/audio/combat/combat_low_enemy_01.mp3",
    });
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
      void app.sfx.play(summary.winner === "LEFT" ? "victory" : summary.winner === "RIGHT" ? "defeat" : "draw");
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
        else { app.music.play("planning"); app.ambience.setActive(true); sync(); }
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
      return { hp: r.hp, maxHp: r.maxHp, shield: r.shield, atk: r.inspection?.atk ?? u.stats.atk * k, matk: r.inspection?.matk ?? u.stats.matk * k, def: r.inspection?.def ?? u.stats.def * k, mdef: r.inspection?.mdef ?? u.stats.mdef * k, star: r.star, tier: u.tier, alive: r.hp > 0 };
    }));
    const player = playCombat({
      board, fx, roster: session.roster, events: session.events,
      inspectionFrames: session.inspectionFrames, onFrame: stage.onFrame,
      onEvent: (event) => {
        switch (event.t) {
          case "basic": void app.sfx.play("hit"); break;
          case "skill": void app.sfx.play("skill"); break;
          case "heal": void app.sfx.play("heal"); break;
          case "death": void app.sfx.play("ko"); break;
        }
      },
      onTick: (tk) => {
        const hpRatio = (side: "L" | "R") => {
          let hp = 0, maxHp = 0;
          for (const r of tk.all) if (r.side === side) { hp += r.hp; maxHp += r.maxHp; }
          return maxHp > 0 ? hp / maxHp : 1;
        };
        lowHpMusic.update(hpRatio("L"), hpRatio("R"));
        app.presentation.combatCycle = tk.cycle;
        for (const entry of tk.all) liveRoster.set(entry.uid, entry);
        inventoryView?.update();
        chud.update({
          round: combatRound, cycle: tk.cycle, speed: speedMultiplier,
          finishFastCost: finishFastCost({ techLevels: run?.techLevels ?? {} }),
        // LOGIC: anti-stall multiplier (A17) belongs to canonical combat; expose it on the session.
        escalation: 1,
        left: strength(tk.all.filter((r) => r.side === "L")), right: strength(tk.all.filter((r) => r.side === "R")),
        queue: tk.queue.map((uid) => { const r = tk.all.find((x) => x.uid === uid); return { name: r ? getUnit(r.baseId).nameVi : uid, side: r?.side ?? "L", icon: r ? ICONS[getUnit(r.baseId).role] : ICONS.sleep }; }),
        log: tk.log,
        });
      },
    });
    player.setSpeed(speedLevel);
    combat = { player, hud: chud, fx, lowHpMusic };
    void player.done.then(() => {
      if (!combat || combat.player !== player) return;
      const summary = session.finish();
      if (showResult(summary)) return;
      endCombat();
      app.music.play("planning");
      app.ambience.setActive(true);
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

  const shortcutActions: PlanningShortcutActions = {
    startCombat: runCombat,
    reroll: rerollShop,
    buyXp: purchaseXp,
    newRun: () => {
      const current = bridge.run();
      if (current) bridge.newRun(current.mode, current.aiMode);
    },
    settings: () => app.openPanel("settings"),
    toggleAudio: () => {
      const current = bridge.settings.get();
      bridge.settings.save({ audioEnabled: true, audioMuted: !current.audioMuted });
    },
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // The modal host may already have consumed Escape and closed its dialog.
    if (event.defaultPrevented || event.repeat || combat || app.modals.blocking()) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
    )) return;
    if (dispatchPlanningShortcut(event, bridge.settings.get().keys.planning, shortcutActions)) event.preventDefault();
  };
  window.addEventListener("keydown", onKeyDown);

  const offs = [bridge.onChange(sync), app.modals.onChange(onModalChange), onLocaleChange(() => hud.refreshCopy())];
  sync();
  return { dispose() {
    window.removeEventListener("keydown", onKeyDown);
    drag.dispose();
    resultFireworks?.dispose();
    resultFireworks = null;
    endCombat();
    if (app.presentation.openOwnedInventory === openOwnedInventory) app.presentation.openOwnedInventory = null;
    for (const o of offs) o();
    hud.dispose();
    board.dispose();
  } };
});

registerPanel("information", (app) => openInformation(app));
registerUtility("mods", (app) => openMods(app));
registerUtility("donate", (app) => openDonate(app));
registerUtility("tribute", (app) => openUndeveloped(app, "tribute"));
registerUtility("social", () => { void openExternalHttpUrl("https://discord.gg/FH9bGFm9G", { window }); });

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
