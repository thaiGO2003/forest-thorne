// Main menu presentation (§5, §50.1, A98). Pure view: it renders a model and forwards intents.
// Save inspection, run creation and routing belong to the app/logic layer passed in via `MenuIntents`.
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { GAME_MODES, MODE_CONFIG, type GameMode } from "../core/modes";
import { h, kitButton, label, nineSlice, panelEl, SLICE, surface, type KitButton } from "./kit";
import type { ModalHost } from "./modal";
import type { Tooltip } from "./tooltip";

export type SaveSummary =
  | { kind: "none" }
  | { kind: "corrupt" }
  | { kind: "valid"; mode: GameMode; round: number; level: number; hearts: number; gold: number; playable: boolean };

export interface MenuModel { save: SaveSummary; version: string }

export interface MenuIntents {
  continueRun(): void;
  newRun(mode: GameMode, ai: string): void;
  clearBrokenRun(): void;
  /** Utility surfaces open their own modal through the shared host. */
  openUtility(id: UtilityId): void;
}

export type UtilityId = "settings" | "library" | "language" | "achievements" | "mods" | "tribute" | "social" | "donate" | "version" | "debug";

const UTILITIES: { id: UtilityId; icon: string; key: MsgKey }[] = [
  { id: "settings", icon: ICONS.settings, key: "menu.settings" },
  { id: "library", icon: ICONS.library, key: "menu.library" },
  { id: "achievements", icon: ICONS.achievements, key: "menu.achievements" },
  { id: "mods", icon: ICONS.mods, key: "menu.mods" },
  { id: "language", icon: ICONS.language, key: "menu.language" },
  { id: "tribute", icon: ICONS.tribute, key: "menu.tribute" },
  { id: "social", icon: ICONS.social, key: "menu.social" },
  { id: "donate", icon: ICONS.donate, key: "menu.donate" },
  { id: "version", icon: ICONS.version, key: "menu.version" },
];

export interface MenuView { el: HTMLElement; update(m: MenuModel): void; refreshCopy(): void; dispose(): void }

export function createMenu(host: HTMLElement, modals: ModalHost, tip: Tooltip, intents: MenuIntents, model: MenuModel): MenuView {
  let m = model;
  const root = h("div", "menu");
  root.dataset.screen = "menu";

  const titleEl = h("div", "menu-title");
  titleEl.setAttribute("role", "heading");
  titleEl.setAttribute("aria-level", "1");
  const title = surface(titleEl, (g, w, hh) => {
    nineSlice(g, "ribbon", SLICE.ribbon, 0, hh * 0.18, w, hh * 0.6, 3);
    label(g, t("loading.title"), w / 2, hh * 0.45, { size: Math.min(56, w / 11), weight: 900, maxW: w - 120 });
    label(g, "Forest Throne", w / 2, hh * 0.9, { size: Math.min(20, w / 28), fill: "#ffe08a" });
  });

  const main = panelEl("panel_wood", "menu-main");
  const cont = kitButton({ skin: "green", icon: ICONS.start, onClick: () => intents.continueRun() });
  const saveEl = h("div", "menu-save");
  saveEl.setAttribute("aria-live", "polite");
  const save = surface(saveEl, (g, w, hh) => {
    nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh);
    label(g, saveLine(), w / 2, hh / 2, { size: 13, fill: "#3b2414", stroke: null, maxW: w - 16 });
  });
  const broken = kitButton({ skin: "red", onClick: () => intents.clearBrokenRun() });
  const fresh = kitButton({ skin: "blue", icon: "🌱", onClick: () => openSetup() });
  main.append(cont.el, saveEl, broken.el, fresh.el);

  const util = panelEl("panel_wood", "menu-utility");
  const utilButtons = UTILITIES.map((u) => {
    const b = kitButton({ skin: "icon", icon: u.icon, onClick: () => intents.openUtility(u.id) });
    tip.bind(b.el, () => ({ title: t(u.key) }));
    util.append(b.el);
    return { b, u };
  });

  const verEl = h("div", "menu-version");
  const ver = surface(verEl, (g, w, hh) => label(g, `v${m.version}`, w, hh / 2, { size: 12, align: "right" }));
  root.append(titleEl, main, util, verEl);
  host.append(root);

  function saveLine(): string {
    const s = m.save;
    if (s.kind === "none") return t("menu.noSave");
    if (s.kind === "corrupt") return t("menu.corruptSave");
    const base = `${t(`mode.${s.mode}` as MsgKey)} · ${t("menu.saveSummary", { round: s.round, hearts: s.hearts, gold: s.gold })}`;
    return s.playable ? base : `${base} · ${t("menu.lockedSave")}`;
  }

  /** New Game setup surface: mode list (gated modes visible but disabled) + AI difficulty. */
  function openSetup() {
    const modal = modals.open({ id: "new-game", title: t("menu.modeTitle"), size: "md", closeLabel: t("ui.close") });
    let mode: GameMode = "EndlessPvEClassic";
    let ai = MODE_CONFIG[mode].ai.def as string;
    const modeList = h("div", "choice-list");
    const aiList = h("div", "choice-list");
    const note = h("div", "slot", t("menu.onlyClassic"));
    const modeBtns: [GameMode, KitButton][] = [];
    const play = kitButton({ skin: "green", icon: ICONS.start, label: t("menu.play"), cls: "menu-play", onClick: () => { modal.close(); intents.newRun(mode, ai); } });
    const renderAi = () => {
      aiList.replaceChildren();
      for (const a of MODE_CONFIG[mode].ai.allowed) {
        const b = kitButton({ skin: "wood", label: t(`ai.${a}` as MsgKey), onClick: () => { ai = a; renderAi(); } });
        b.setSelected(a === ai);
        aiList.append(b.el);
      }
    };
    for (const id of GAME_MODES) {
      const cfg = MODE_CONFIG[id];
      const b = kitButton({ skin: cfg.available ? "blue" : "wood", label: t(`mode.${id}` as MsgKey), onClick: () => { mode = id; ai = cfg.ai.def; sync(); } });
      b.setDisabled(!cfg.available);
      tip.bind(b.el, () => ({ title: t(`mode.${id}` as MsgKey), subtitle: cfg.available ? undefined : t("menu.locked") }));
      modeList.append(b.el);
      modeBtns.push([id, b]);
    }
    function sync() { for (const [id, b] of modeBtns) b.setSelected(id === mode); renderAi(); }
    const stack = h("div", "stack");
    stack.append(modeList, note, h("div", "slot", t("menu.difficulty")), aiList, play.el);
    modal.body.append(stack);
    sync();
  }

  function refreshCopy() {
    cont.setLabel(t("menu.continue"));
    fresh.setLabel(t("menu.newGame"));
    broken.setLabel(t("menu.clearBroken"));
    for (const { b, u } of utilButtons) b.setAria(t(u.key));
    title.paint(); save.paint(); ver.paint();
  }

  function update(nm: MenuModel) {
    m = nm;
    const s = m.save;
    cont.setDisabled(!(s.kind === "valid" && s.playable));
    cont.el.hidden = s.kind === "corrupt";
    broken.el.hidden = s.kind !== "corrupt";
    refreshCopy();
  }
  update(m);

  return { el: root, update, refreshCopy, dispose: () => { modals.closeActive(); root.remove(); } };
}
