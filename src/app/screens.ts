// Registers every screen and utility modal with the app shell. Import side-effects only.
import { LOCALES, t, getLocale, onLocaleChange, type MsgKey } from "../core/i18n";
import { BOARD_SIZE, boardCount, slotCap, unequipQuote, type RoundResultSummary, type RunState } from "../core/run";
import { getEquipment } from "../core/itemRegistry";
import { itemDisplayName } from "../core/itemPresentation";
import { AUGMENT_BY_ID } from "../core/augments";
import { augmentCopy, augmentGroupLabel, augmentGroupRank } from "../content/augmentText";
import { environmentCopy } from "../content/environmentText";
import { dispatchPlanningShortcut, type PlanningShortcutActions } from "./planningShortcuts";
import { h, kitButton, nineSlice, panelEl, surface, threeSlice } from "../ui/kit";
import { combatEventSfx, combatFeedback, shopFeedback } from "../audio/combatFeedback";
import { openCraftLibraryModal } from "../ui/crafting/library";
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
import { ICONS, setEmojiRichText } from "../core/emojiIcon";
import { openExternalHttpUrl } from "../platform/discordActivity";
import { STAR_STAT } from "../core/economy";
import { teamStrength, unitDiagnostics, type UnitDiagnostics } from "../core/inspection";
import { environmentFor, type EnvironmentId } from "../core/environment";
import { dayNightForRound } from "../core/dayNight";
import { WEATHER_BLESSING_ENVIRONMENT } from "../core/blessings";
import { BLESSING_CHOICES, type BlessingChoiceId } from "../core/blessingChoice";
import { getGameSpeedDisplayMultiplier } from "../core/gameSpeed";
import { finishFastCost } from "../core/combatFast";
import { createModManager, type ModManager, type ModPackageType, type ModSource, type ModValidationIssue } from "../mods/ModRegistry";
import { createCombatHud, openResult, type CombatHudView } from "../ui/combat";
import { unitTooltipContent } from "../ui/unitTooltip";
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

const itemName = itemDisplayName;
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
  const tabs = h("div", "tabs info-tabs");
  const body = h("div", "stack info-body");
  type InfoTab = "overview" | "weather" | "sides" | "formations" | "synergy" | "effects" | "history";
  let active: InfoTab = "overview";
  let mountedHistory: { dispose(): void } | null = null;
  const tabDefs: Array<{ id: InfoTab; key: MsgKey; icon: string }> = [
    { id: "overview", key: "info.overview", icon: ICONS.info },
    { id: "weather", key: "info.weather", icon: ICONS.palette },
    { id: "sides", key: "info.sides", icon: ICONS.start },
    { id: "formations", key: "info.formations", icon: ICONS.inventory },
    { id: "synergy", key: "info.synergy", icon: ICONS.synergy },
    { id: "effects", key: "info.effects", icon: ICONS.augment },
    { id: "history", key: "info.history", icon: ICONS.history },
  ];
  const tabButtons = tabDefs.map((tab) => {
    const button = kitButton({ skin: "blue", icon: tab.icon, label: t(tab.key), onClick: () => { active = tab.id; render(); } });
    tabs.append(button.el);
    return { ...tab, button };
  });
  const go = (id: InfoTab) => { active = id; render(); };
  const iconOf = (key: string, fallback: string) => (ICONS as Record<string, string>)[key] ?? fallback;

  const disposeTabContent = () => {
    mountedHistory?.dispose();
    mountedHistory = null;
    body.replaceChildren();
  };

  /** Slim icon + label pill; chrome comes from the kit, never from CSS. */
  const chip = (text: string, icon?: string, skin: "slot_well" | "panel_wood" = "slot_well") => {
    const el = panelEl(skin, "info-chip");
    if (icon) el.append(h("span", "info-chip-icon", icon));
    el.append(h("span", "info-chip-text", text));
    return el;
  };

  /** Four-layer depth: modal frame → parchment section → oak header bar → slot wells. */
  const section = (title: string, icon: string, cls = "") => {
    const panel = panelEl("panel_parchment", `info-sec ${cls}`.trim());
    const head = panelEl("panel_wood", "info-sec-head");
    head.append(h("span", "info-sec-icon", icon), h("h3", "info-sec-title", title));
    const inner = h("div", "info-sec-body");
    panel.append(head, inner);
    return { panel, inner, head };
  };

  /** Section whose oak header carries a right-aligned action (used by the overview digest). */
  const sectionWithAction = (title: string, icon: string, label: string, onAction: () => void) => {
    const made = section(title, icon);
    const action = kitButton({ skin: "wood", label, cls: "info-sec-action", onClick: onAction });
    made.head.append(action.el);
    return made;
  };

  const emptyState = (icon: string, title: string, hint: string) => {
    const el = h("div", "info-empty");
    el.append(h("span", "info-empty-icon", icon), h("strong", "info-empty-title", title), h("small", "info-empty-hint", hint));
    return el;
  };

  /** Icon + value + label tile; the primary "fact" unit across every tab. */
  const fact = (icon: string, value: string | number, label: string) => {
    const cell = panelEl("slot_well", "info-fact");
    cell.append(
      h("span", "info-fact-icon", icon),
      h("strong", "info-fact-value", String(value)),
      h("span", "info-fact-label", label),
    );
    return cell;
  };

  const factGrid = (host: HTMLElement, items: Array<[string, string | number, string]>) => {
    const grid = h("div", "info-facts");
    for (const [icon, value, label] of items) grid.append(fact(icon, value, label));
    host.append(grid);
    return grid;
  };

  const appendKv = (host: HTMLElement, label: string, value: string | number) => {
    const row = panelEl("slot_well", "info-kv");
    row.append(h("strong", "", label), h("span", "", String(value)));
    host.append(row);
    return row;
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

  const environmentName = (environment: EnvironmentId) => t(`element.${environment}` as MsgKey);

  const heroBand = (run: RunState, friendly: { power: number }) => {
    const band = panelEl("panel_wood", "info-hero");
    const copy = h("div", "info-hero-copy");
    copy.append(
      h("h2", "info-hero-title", t(`mode.${run.mode}` as MsgKey)),
      h("p", "info-hero-sub", `${t("combat.round", { round: run.round })} · ${t(`info.phase.${run.phase}` as MsgKey)} · ${t(`ai.${run.aiMode}` as MsgKey)}`),
    );
    const streaks = h("div", "info-hero-chips");
    streaks.append(
      chip(`${t("info.hearts")} ${run.hp}`, ICONS.heart),
      chip(`${t("info.gold")} ${run.gold}`, ICONS.gold),
      run.winStreak > 0
        ? chip(`${t("info.streakWin")} ${run.winStreak}`, ICONS.streakWin)
        : chip(`${t("info.streakLoss")} ${run.loseStreak}`, ICONS.streakLoss),
    );
    const stats = h("div", "info-hero-stats");
    statTile(stats, ICONS.heart, t("info.hearts"), run.hp);
    statTile(stats, ICONS.gold, t("info.gold"), run.gold);
    statTile(stats, ICONS.level, t("info.level"), run.level);
    statTile(stats, ICONS.atk, t("info.teamPower"), Math.round(friendly.power));
    band.append(copy, streaks, stats);
    return band;
  };

  /** Two-tone bar: asset trough + asset frame, only the fill is a runtime colour. */
  const meter = (side: "ally" | "enemy", label: string, value: number, max: number) => {
    const el = h("div", "info-meter");
    el.setAttribute("role", "meter");
    el.setAttribute("aria-label", `${side === "ally" ? t("info.allies") : t("info.enemies")} · ${label}`);
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", String(Math.round(max)));
    el.setAttribute("aria-valuenow", String(Math.round(value)));
    surface(el, (g, w, hh) => {
      nineSlice(g, "bar_trough", 1, 3, 3, Math.max(0, w - 6), Math.max(0, hh - 6));
      const fw = Math.round(Math.max(0, w - 6) * Math.max(0, Math.min(1, max > 0 ? value / max : 0)));
      g.fillStyle = side === "ally" ? "#55b86a" : "#d85f61";
      g.fillRect(3, 3, fw, Math.max(0, hh - 6));
      threeSlice(g, "frame_bar", 3, 0, 0, w, hh);
    });
    return el;
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
    const side = (which: "ally" | "enemy", value: number) => {
      const cell = h("div", "info-compare-side");
      cell.append(h("small", "info-compare-side-label", which === "ally" ? t("info.allies") : t("info.enemies")));
      cell.append(meter(which, label, value, max));
      return cell;
    };
    bars.append(side("ally", ally), side("enemy", enemy));
    card.append(head, bars);
    host.append(card);
    return card;
  };

  const unitMedal = (icon: string) => {
    const medal = h("span", "info-medal", icon);
    medal.setAttribute("aria-hidden", "true");
    return medal;
  };

  const unitCard = (
    host: HTMLElement,
    entry: { uid: string; baseId: string; star: number; equips?: string[] },
    detailId: (entry: { uid: string }) => string,
  ) => {
    const unit = getUnit(entry.baseId);
    const row = panelEl("slot_well", "info-unit");
    const copy = h("div", "grow info-unit-copy");
    const title = h("div", "info-unit-title");
    title.append(h("strong", "", unit.nameVi), h("span", "info-unit-stars", `${ICONS.star}${entry.star}`));
    copy.append(
      title,
      h("div", "info-unit-meta", `${ICONS[unit.element]} ${t(`element.${unit.element}` as MsgKey)} · ${ICONS[unit.faction]} ${t(`faction.${unit.faction}` as MsgKey)} · ${t(`role.${unit.role}` as MsgKey)}`),
    );
    if (entry.equips?.length) copy.append(h("small", "info-unit-equips", entry.equips.map(itemDisplayName).join(" · ")));
    const details = kitButton({ skin: "wood", label: t("planning.details"), onClick: () => app.openPanel("unit-detail", detailId(entry)) });
    row.append(unitMedal(ICONS[unit.role]), copy, details.el);
    host.append(row);
    return row;
  };

  const unitList = (
    host: HTMLElement,
    entries: Array<{ uid: string; baseId: string; star: number; equips?: string[] }>,
    empty: string,
    detailId: (entry: { uid: string }) => string,
  ) => {
    if (!entries.length) {
      host.append(emptyState(ICONS.emptyBox, empty, t("info.emptyHint")));
      return;
    }
    for (const entry of entries) unitCard(host, entry, detailId);
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

  /** Augment card: never shows the raw id, always the themed name + effect line + value. */
  const augmentCard = (host: HTMLElement, id: string) => {
    const copy = augmentCopy(id);
    const card = panelEl("slot_well", "info-augment");
    const head = h("div", "info-augment-head");
    head.append(unitMedal(copy.icon), h("strong", "info-augment-name", copy.name));
    if (copy.value) head.append(h("span", "info-augment-value", copy.value));
    card.append(head, h("small", "info-augment-summary", copy.summary), chip(augmentGroupLabel(copy.group)));
    host.append(card);
    return card;
  };

  const augmentGrid = (host: HTMLElement, ids: readonly string[], empty: string) => {
    if (!ids.length) {
      host.append(emptyState(ICONS.augment, empty, t("info.emptyHint")));
      return;
    }
    const sorted = [...ids].sort((a, b) => {
      const ca = augmentCopy(a), cb = augmentCopy(b);
      return augmentGroupRank(ca.group) - augmentGroupRank(cb.group) || ca.name.localeCompare(cb.name);
    });
    const grid = h("div", "info-augments");
    for (const id of sorted) augmentCard(grid, id);
    host.append(grid);
  };

  /** Weather hero: element medallion, confirmation chip and the concrete own/other mods. */
  const weatherHero = (host: HTMLElement, environment: EnvironmentId, confirmed: boolean) => {
    const card = panelEl("panel_parchment", "info-weather-hero");
    const art = panelEl("slot_well", "info-weather-art");
    art.append(h("span", "info-weather-icon", ICONS[environment]));
    const copy = h("div", "info-weather-copy");
    copy.append(
      h("small", "info-weather-kicker", t("info.currentWeather")),
      h("h3", "info-weather-name", environmentName(environment)),
      chip(confirmed ? t("info.confirmed") : t("info.forecast"), confirmed ? ICONS.check : ICONS.hourglass),
    );
    const rules = environmentCopy(environment);
    const sides = h("div", "info-weather-rules");
    const ruleColumn = (title: string, icon: string, lines: string[]) => {
      const col = panelEl("slot_well", "info-rule-col");
      const head = h("div", "info-rule-head");
      head.append(h("span", "info-rule-icon", icon), h("strong", "", title));
      const list = h("ul", "info-rule-list");
      for (const line of lines) list.append(h("li", "", line));
      col.append(head, list);
      return col;
    };
    sides.append(
      ruleColumn(t("info.sameElement"), ICONS.check, rules.own.length ? rules.own : [t("info.noMods")]),
      ruleColumn(t("info.otherElement"), ICONS.question, rules.other.length ? rules.other : [t("info.noMods")]),
    );
    card.append(art, copy, sides);
    host.append(card);
    return card;
  };

  /** Round strip: the next eight rounds with their element, current round first. */
  const weatherCycle = (host: HTMLElement, round: number) => {
    const strip = h("div", "info-cycle");
    for (let i = 0; i < 8; i++) {
      const at = round + i;
      const environment = environmentFor(at);
      const pill = panelEl(i === 0 ? "panel_wood" : "slot_well", "info-cycle-pill");
      pill.append(
        h("span", "info-cycle-icon", ICONS[environment]),
        h("small", "info-cycle-round", t("combat.round", { round: at })),
        h("small", "info-cycle-name", environmentName(environment)),
      );
      strip.append(pill);
    }
    host.append(strip);
    return strip;
  };

  /** Ordered weather blessing list with up/down controls; shared by the weather and effects tabs. */
  const blessingOrder = (host: HTMLElement, run: RunState) => {
    if (!run.blessingQueue.length) {
      host.append(emptyState(ICONS.emptyBox, t("info.noBlessings"), t("info.noBlessingsHint")));
      return;
    }
    run.blessingQueue.forEach((id, index) => {
      // Corrupt or retired ids from an older save must not crash the modal.
      const environment = WEATHER_BLESSING_ENVIRONMENT[id] as EnvironmentId | undefined;
      if (!environment) return;
      const row = panelEl("slot_well", "info-order");
      const rank = panelEl("shell_billboard", "info-order-rank");
      rank.append(h("strong", "", `#${index + 1}`));
      const copy = h("div", "grow info-order-copy");
      copy.append(
        h("strong", "", environmentName(environment)),
        h("small", "", `${ICONS[environment]} ${t("info.weatherBlessingShort")}`),
      );
      const actions = h("div", "row info-order-actions");
      const up = kitButton({ skin: "wood", label: t("mods.up"), onClick: () => { if (app.bridge.reorderWeatherBlessing(index, index - 1)) render(); } });
      const down = kitButton({ skin: "wood", label: t("mods.down"), onClick: () => { if (app.bridge.reorderWeatherBlessing(index, index + 1)) render(); } });
      const editable = run.phase === "PLANNING";
      up.setDisabled(!editable || index === 0);
      down.setDisabled(!editable || index === run.blessingQueue.length - 1);
      actions.append(up.el, down.el);
      row.append(rank, copy, actions);
      host.append(row);
    });
  };

  const render = () => {
    disposeTabContent();
    for (const tab of tabButtons) tab.button.setSelected(tab.id === active);
    const run = app.bridge.run();
    if (!run) {
      body.append(emptyState(ICONS.info, t("info.noRun"), t("info.emptyHint")));
      return;
    }
    const preview = app.bridge.prepareEnemyPreview();
    const allies = run.board.filter((unit): unit is NonNullable<typeof unit> => unit !== null);
    const ownedAllies = [...allies, ...run.bench];
    const enemies = preview?.units ?? run.enemyPreview;
    const combat = app.bridge.combatSnapshot();
    const friendly = teamSnapshot(allies, "L");
    const enemyTeam = teamSnapshot(enemies, "R");
    const currentEnvironment = combat?.environment ?? environmentFor(run.round);

    if (active === "overview") {
      body.append(heroBand(run, friendly));
      factGrid(body, [
        [ICONS.round, t("combat.round", { round: run.round }), t("info.missionLabel")],
        [ICONS[currentEnvironment], environmentName(currentEnvironment), t("info.environment")],
        [ICONS.inventory, allies.length, t("info.deployed")],
        [ICONS.synergy, run.bench.length, t("info.bench")],
      ]);

      const dashboard = h("div", "info-dashboard");

      const formation = sectionWithAction(t("info.formations"), ICONS.synergy, t("info.openTab"), () => go("formations"));
      unitList(formation.inner, ownedAllies.slice(0, 4), t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
      if (ownedAllies.length > 4) formation.inner.append(h("small", "info-more", t("info.moreUnits", { count: ownedAllies.length - 4 })));
      dashboard.append(formation.panel);

      const enemiesSection = sectionWithAction(t("info.enemiesPreview"), ICONS.start, t("info.openTab"), () => go("sides"));
      unitList(enemiesSection.inner, enemies.slice(0, 4), t("info.noPreview"), (entry) => enemyPanelId(entry.uid));
      if (enemies.length > 4) enemiesSection.inner.append(h("small", "info-more", t("info.moreUnits", { count: enemies.length - 4 })));
      dashboard.append(enemiesSection.panel);

      const comparison = sectionWithAction(t("info.comparison"), ICONS.atk, t("info.openTab"), () => go("sides"));
      compareMetric(comparison.inner, ICONS.hp, t("info.health"), friendly.hp, enemyTeam.hp);
      compareMetric(comparison.inner, ICONS.atk, t("info.power"), friendly.power, enemyTeam.power);
      dashboard.append(comparison.panel);

      const weather = sectionWithAction(t("info.weatherBlessings"), ICONS[currentEnvironment], t("info.openTab"), () => go("weather"));
      appendKv(weather.inner, t("info.currentWeather"), environmentName(currentEnvironment));
      appendKv(weather.inner, t("info.nextWeather"), environmentName(environmentFor(run.round + 1)));
      appendKv(weather.inner, t("info.weatherOrder"), run.blessingQueue.length ? String(run.blessingQueue.length) : t("info.none"));
      dashboard.append(weather.panel);

      const effects = sectionWithAction(t("info.activeEffects"), ICONS.augment, t("info.openTab"), () => go("effects"));
      appendKv(effects.inner, t("info.mods"), run.augments.length);
      appendKv(effects.inner, t("info.blessingPicked"), run.blessingPicks.length);
      appendKv(effects.inner, t("info.weatherBlessings"), run.blessingQueue.length);
      dashboard.append(effects.panel);

      body.append(dashboard);
      return;
    }

    if (active === "weather") {
      weatherHero(body, currentEnvironment, true);
      weatherCycle(body, run.round);

      const forecast = section(t("info.forecast"), ICONS.hourglass);
      const forecastGrid = h("div", "info-forecast");
      for (const offset of [1, 2]) {
        const at = run.round + offset;
        const environment = environmentFor(at);
        const card = panelEl("slot_well", "info-forecast-card");
        card.append(
          h("span", "info-forecast-icon", ICONS[environment]),
          h("strong", "", environmentName(environment)),
          h("small", "", `${t("combat.round", { round: at })} · ${t("info.forecast")}`),
        );
        forecastGrid.append(card);
      }
      forecast.inner.append(forecastGrid);
      body.append(forecast.panel);

      const manual = section(t("info.weatherOrder"), ICONS.info);
      blessingOrder(manual.inner, run);
      body.append(manual.panel);
      return;
    }

    if (active === "sides") {
      const banners = h("div", "info-sides");
      const sideBanner = (which: "ally" | "enemy", title: string, icon: string, team: typeof friendly, skin: "panel_wood" | "slot_well") => {
        const card = panelEl(skin, "info-side");
        const head = h("div", "info-side-head");
        head.append(h("span", "info-side-icon", icon), h("strong", "info-side-title", title));
        const stats = h("div", "info-side-stats");
        stats.append(
          fact(ICONS.inventory, team.units, t("info.units")),
          fact(ICONS.hp, Math.round(team.hp), t("info.health")),
          fact(ICONS.atk, Math.round(team.power), t("info.power")),
        );
        card.append(head, stats);
        return card;
      };
      banners.append(sideBanner("ally", t("info.allies"), ICONS.leaf, friendly, "panel_wood"));
      banners.append(sideBanner("enemy", t("info.enemies"), ICONS.skull, enemyTeam, "slot_well"));
      body.append(banners);

      const detail = section(t("info.comparison"), ICONS.atk);
      compareMetric(detail.inner, ICONS.hp, t("info.health"), friendly.hp, enemyTeam.hp);
      compareMetric(detail.inner, ICONS.atk, t("info.power"), friendly.power, enemyTeam.power);
      const gap = Math.round(friendly.power - enemyTeam.power);
      factGrid(detail.inner, [
        [ICONS.inventory, friendly.units, t("info.allies")],
        [ICONS.skull, enemyTeam.units, t("info.enemies")],
        [ICONS.crown, gap > 0 ? `+${gap}` : String(gap), t("info.powerGap")],
      ]);
      body.append(detail.panel);

      // Role composition: the quickest read of "what am I actually facing".
      const composition = section(t("info.composition"), ICONS.synergy);
      const columns = h("div", "info-comp");
      const roleColumn = (title: string, entries: Array<{ baseId: string }>) => {
        const col = panelEl("slot_well", "info-comp-col");
        col.append(h("strong", "info-comp-title", title));
        const counts = new Map<string, number>();
        for (const entry of entries) {
          const role = getUnit(entry.baseId).role;
          counts.set(role, (counts.get(role) ?? 0) + 1);
        }
        if (!counts.size) {
          col.append(h("small", "info-comp-empty", t("info.none")));
          return col;
        }
        for (const [role, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
          const row = h("div", "info-comp-row");
          row.append(h("span", "info-comp-role", ICONS[role as keyof typeof ICONS] ?? ICONS.question), h("span", "", t(`role.${role}` as MsgKey)), h("strong", "", String(count)));
          col.append(row);
        }
        return col;
      };
      columns.append(roleColumn(t("info.allies"), allies), roleColumn(t("info.enemies"), enemies));
      composition.inner.append(columns);
      body.append(composition.panel);
      return;
    }

    if (active === "formations") {
      const columns = h("div", "info-formations");
      const alliesSection = section(t("info.allies"), ICONS.leaf);
      unitList(alliesSection.inner, ownedAllies, t("info.noUnits"), (entry) => ownedPanelId(entry.uid));
      const enemiesSection = section(t("info.enemies"), ICONS.skull);
      unitList(enemiesSection.inner, enemies, t("info.noUnits"), (entry) => enemyPanelId(entry.uid));
      columns.append(alliesSection.panel, enemiesSection.panel);
      body.append(columns);
      return;
    }

    if (active === "synergy") {
      const synergies = runView.synergies(run);
      if (!synergies.length) {
        const empty = section(t("info.synergy"), ICONS.synergy);
        empty.inner.append(emptyState(ICONS.synergy, t("info.noSynergy"), t("info.synergyHint")));
        body.append(empty.panel);
        return;
      }
      const kinds: Array<{ kind: "class" | "element" | "faction"; title: MsgKey; icon: string }> = [
        { kind: "class", title: "info.synergyClass", icon: ICONS.synergy },
        { kind: "element", title: "info.synergyElement", icon: ICONS.palette },
        { kind: "faction", title: "info.synergyFaction", icon: ICONS.leaf },
      ];
      const grid = h("div", "info-dashboard");
      for (const group of kinds) {
        const lines = synergies.filter((line) => line.kind === group.kind);
        if (!lines.length) continue;
        const made = section(t(group.title), group.icon);
        for (const line of lines) {
          const prefix = line.kind === "class" ? "role" : line.kind;
          const name = t(`${prefix}.${line.key}` as MsgKey);
          const row = panelEl("slot_well", "info-synergy");
          const head = h("div", "info-synergy-head");
          head.append(unitMedal(iconOf(line.key, group.icon)), h("strong", "", name));
          head.append(h("small", "info-synergy-count", line.next ? `${line.count} / ${line.next}` : `${line.count}`));
          const bar = h("div", "info-meter");
          const target = line.next ?? Math.max(1, line.count);
          bar.setAttribute("role", "progressbar");
          bar.setAttribute("aria-label", name);
          bar.setAttribute("aria-valuemin", "0");
          bar.setAttribute("aria-valuemax", String(target));
          bar.setAttribute("aria-valuenow", String(line.count));
          surface(bar, (g, w, hh) => {
            nineSlice(g, "bar_trough", 1, 3, 3, Math.max(0, w - 6), Math.max(0, hh - 6));
            const fw = Math.round(Math.max(0, w - 6) * Math.min(1, line.count / target));
            g.fillStyle = line.next ? "#5aa9d8" : "#55b86a";
            g.fillRect(3, 3, fw, Math.max(0, hh - 6));
            threeSlice(g, "frame_bar", 3, 0, 0, w, hh);
          });
          row.append(head, bar);
          if (line.active) row.append(h("small", "info-synergy-active", `${ICONS.check} ${t("info.synergyActive")}`));
          made.inner.append(row);
        }
        grid.append(made.panel);
      }
      body.append(grid);
      return;
    }

    if (active === "effects") {
      const activeEffects = section(t("info.activeEffects"), ICONS.augment);
      augmentGrid(activeEffects.inner, run.augments, t("info.noAugments"));
      body.append(activeEffects.panel);

      const bonuses = section(t("info.bonuses"), ICONS.crown);
      const pctText = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`;
      const bonusRows: Array<[string, string | number, string]> = [];
      if (run.teamAtkPct) bonusRows.push([ICONS.atk, pctText(run.teamAtkPct), t("info.bonusAtk")]);
      if (run.teamDefPct) bonusRows.push([ICONS.def, pctText(run.teamDefPct), t("info.bonusDef")]);
      if (run.teamHpPct) bonusRows.push([ICONS.hp, pctText(run.teamHpPct), t("info.bonusHp")]);
      if (run.teamMatkPct) bonusRows.push([ICONS.matk, pctText(run.teamMatkPct), t("info.bonusMatk")]);
      if (run.teamMdefPct) bonusRows.push([ICONS.mdef, pctText(run.teamMdefPct), t("info.bonusMdef")]);
      if (run.lifestealPct) bonusRows.push([ICONS.regen, pctText(run.lifestealPct), t("info.bonusLifesteal")]);
      if (run.startingRage) bonusRows.push([ICONS.rage, `+${run.startingRage}`, t("info.bonusStartingRage")]);
      if (run.startingShield) bonusRows.push([ICONS.shield, `+${run.startingShield}`, t("info.bonusStartingShield")]);
      if (run.deployCapBonus) bonusRows.push([ICONS.inventory, `+${run.deployCapBonus}`, t("info.bonusDeploy")]);
      if (run.benchBonus) bonusRows.push([ICONS.synergy, `+${run.benchBonus}`, t("info.bonusBench")]);
      if (run.inventoryBonus) bonusRows.push([ICONS.inventory, `+${run.inventoryBonus}`, t("info.bonusBag")]);
      if (run.winGoldBonus) bonusRows.push([ICONS.gold, `+${run.winGoldBonus}`, t("info.bonusWinGold")]);
      if (run.interestRateBonus) bonusRows.push([ICONS.gold, pctText(run.interestRateBonus * 100), t("info.bonusInterest")]);
      if (run.xpCostDelta) bonusRows.push([ICONS.xp, String(run.xpCostDelta), t("info.bonusXpCost")]);
      if (run.rollCostDelta) bonusRows.push([ICONS.reroll, String(run.rollCostDelta), t("info.bonusRollCost")]);
      if (!bonusRows.length) bonuses.inner.append(emptyState(ICONS.crown, t("info.noBonuses"), t("info.emptyHint")));
      else factGrid(bonuses.inner, bonusRows);
      body.append(bonuses.panel);

      const picks = section(t("info.blessingPicked"), ICONS.augment);
      if (!run.blessingPicks.length) {
        picks.inner.append(emptyState(ICONS.emptyBox, t("info.noPicked"), t("info.noPickedHint")));
      } else {
        const grid = h("div", "info-augments");
        for (const id of run.blessingPicks) {
          const copy = BLESSING_COPY[id];
          const card = panelEl("slot_well", "info-augment");
          const head = h("div", "info-augment-head");
          head.append(unitMedal(copy.icon), h("strong", "info-augment-name", t(copy.title)));
          card.append(head, h("small", "info-augment-summary", t(copy.effect)), chip(t(copy.group)));
          grid.append(card);
        }
        picks.inner.append(grid);
      }
      body.append(picks.panel);

      const manual = section(t("info.weatherOrder"), ICONS.info);
      blessingOrder(manual.inner, run);
      body.append(manual.panel);

      const status = section(t("info.runStatus"), ICONS.hourglass);
      appendKv(status.inner, t("info.cycle"), app.presentation.combatCycle ?? "—");
      appendKv(status.inner, t("info.pendingBlessing"), run.pendingBlessingChoice ? t("info.yes") : t("info.no"));
      appendKv(status.inner, t("info.pendingRage"), run.pendingCombatRage);
      body.append(status.panel);
      return;
    }

    const history = section(t("info.history"), ICONS.history);
    body.append(history.panel);
    mountedHistory = mountHistoryView(history.inner, app.bridge.history());
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
    for (const id of run.itemBag) bag.append(h("div", "slot", itemDisplayName(id)));
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
              ? `${t("planning.unequip")} ${itemDisplayName(itemId)}`
              : `${t("inventory.unequip", { cost: `${cost} ${ICONS.gold}` })} ${itemDisplayName(itemId)}`,
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
            label: `${t("planning.equip")} ${itemDisplayName(itemId)}`,
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

const BLESSING_COPY: Record<BlessingChoiceId, { group: MsgKey; title: MsgKey; effect: MsgKey; icon: string; frame: "card_t2" | "card_t3" | "card_t4" }> = {
  gold_cache: { group: "blessing.group.economy", title: "blessing.gold.title", effect: "blessing.gold.effect", icon: ICONS.gold, frame: "card_t2" },
  forest_order: { group: "blessing.group.formation", title: "blessing.deploy.title", effect: "blessing.deploy.effect", icon: ICONS.leaf, frame: "card_t3" },
  opening_fury: { group: "blessing.group.combat", title: "blessing.rage.title", effect: "blessing.rage.effect", icon: ICONS.FIRE, frame: "card_t4" },
};

function mountBlessingChoice(app: App, m: ModalHandle) {
  const render = () => {
    m.body.replaceChildren();
    const run = app.bridge.run();
    if (!run || !run.pendingBlessingChoice) {
      m.close();
      return;
    }
    const root = h("div", "blessing-modal");
    const head = h("div", "blessing-head");
    head.append(h("p", "blessing-subtitle", t("blessing.subtitle")));
    const meta = h("div", "blessing-meta");
    const roundChip = panelEl("slot_well", "blessing-chip");
    roundChip.append(h("span", "", t("blessing.round", { round: run.round })));
    const pickChip = panelEl("slot_well", "blessing-chip");
    pickChip.append(h("span", "", t("blessing.pickOne")));
    meta.append(roundChip, pickChip);
    head.append(meta);

    const cards = h("div", "blessing-cards");
    for (const def of BLESSING_CHOICES) {
      const copy = BLESSING_COPY[def.id];
      // Tier-card art already ships green/blue/purple frames with a parchment interior, so the
      // card chrome stays PNG 9-slice; only layout is CSS (asset-first, spec 2.3).
      const card = panelEl(copy.frame, "blessing-card");
      const group = panelEl("panel_wood", "blessing-group");
      group.append(h("span", "", t(copy.group)));
      const slot = panelEl("slot_well", "blessing-slot");
      const star = h("span", "blessing-star");
      star.setAttribute("aria-hidden", "true");
      setEmojiRichText(star, ICONS.star);
      const icon = h("span", "blessing-icon");
      icon.setAttribute("aria-hidden", "true");
      setEmojiRichText(icon, copy.icon);
      slot.append(icon, star);
      const text = h("div", "blessing-copy");
      text.append(
        h("h3", "blessing-title", t(copy.title)),
        h("p", "blessing-effect", t(copy.effect)),
      );
      const rule = h("div", "blessing-rule");
      rule.setAttribute("aria-hidden", "true");
      surface(rule, (g, w, hh) => threeSlice(g, "bar_trough", 1, 0, 0, w, hh));
      const choose = kitButton({
        skin: "green",
        label: t("blessing.choose"),
        cls: "blessing-choose",
        aria: `${t(copy.title)} — ${t(copy.effect)}`,
        onClick: () => { if (app.bridge.chooseBlessing(def.id)) m.close(); },
      });
      card.append(group, slot, text, rule, choose.el);
      cards.append(card);
    }
    const footer = panelEl("panel_parchment", "blessing-footer");
    footer.append(h("strong", "", t("blessing.footer")), h("small", "", t("blessing.noSkip")));
    root.append(head, cards, footer);
    m.body.append(root);
  };
  const off = app.bridge.onChange(render);
  render();
  return { dispose: off };
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


/** Hover summary (A96): rich old_src-style unit card with header, chips, HP/rage meters and the
 *  compact/summary/expanded bodies. Diagnostics supply the live stat, shield, rage and status data;
 *  catalog-only surfaces reuse the same model through `unitCardTooltip`. */
function unitSummaryTooltipContent(diagnostics: UnitDiagnostics): TooltipContent {
  const unitDef = getUnit(diagnostics.baseId);
  return unitTooltipContent(unitDef, {
    star: diagnostics.star as 1 | 2 | 3,
    diagnostics,
    portrait: portraits.get(unitDef.id, diagnostics.star),
  });
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
registerPanel("library", (app, id) => openLibrary(app, id));
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
registerPanel("recipes", (app) => openCraftLibraryModal(app));
registerPanel("craft", (app) =>
  openPanelModal(app, { id: "craft", title: t("planning.craft"), size: "full" }, (m) => mountCraftWorkbench(app, m.body)));
registerPanel("augment", (app) =>
  openPanelModal(app, { id: "augment", title: t("planning.augment"), size: "lg", dismissible: false }, (m) => mountAugments(app, m)));
registerPanel("blessing-choice", (app) =>
  openPanelModal(app, { id: "blessing-choice", title: t("blessing.title"), size: "lg", dismissible: false }, (m) => mountBlessingChoice(app, m)));

registerScreen("planning", (app) => {
  const { bridge, stage } = app;
  const board = createBoardView(stage);
  let combat: { player: CombatPlayer; hud: CombatHudView; fx: CombatFx; lowHpMusic: { dispose(): void } } | null = null;
  let resultFireworks: VictoryFireworks | null = null;
  let planningEnemyPreview: ReturnType<typeof bridge.prepareEnemyPreview> = null;
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
        openLibrary: () => app.openPanel("library", inspection.unit.baseId),
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
    const cue = shopFeedback("buy", bought);
    if (cue) void app.sfx.play(cue);
    return bought;
  };
  const rerollShop = () => {
    const rerolled = bridge.reroll();
    const cue = shopFeedback("reroll", rerolled);
    if (cue) void app.sfx.play(cue);
    return rerolled;
  };
  const purchaseXp = () => {
    const purchased = bridge.buyXp();
    const cue = shopFeedback("xp", purchased);
    if (cue) void app.sfx.play(cue);
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
    else if (!combat && run.phase === "PLANNING" && run.pendingBlessingChoice && !app.modals.blocking()) app.openPanel("blessing-choice");
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
      const feedback = combatFeedback(summary.winner === "LEFT" ? "LEFT" : summary.winner === "RIGHT" ? "RIGHT" : "DRAW");
      void app.sfx.play(feedback.sfx);
      endCombat();
      resultFireworks?.dispose();
      resultFireworks = summary.winner === "LEFT" && reserveOrigins.length
        ? createVictoryFireworks(stage.scene, stage.onFrame, reserveOrigins)
        : null;
      app.music.play(feedback.music);
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
        const cue = combatEventSfx(event.t);
        if (cue) void app.sfx.play(cue);
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
