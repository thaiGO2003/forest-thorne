// Planning HUD (§14.1, §14.5, §50.2, A22): one command table around the board.
// Top: stats + battle controls. Right: contextual actions and a portrait-only shop toggle.
// Shop shows 8 offers on wide screens or 4 on compact screens, with paging.
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { refreshCost, xpBuyCost, xpToNext } from "../core/economy";
import type { RunState } from "../core/run";
import type { SynergyLine } from "../core/synergy";
import type { TutorialStep } from "../core/tutorial";
import { createCard, type CardView, type PortraitProvider } from "./card";
import { drawFit, h, kitButton, label, nineSlice, panelEl, SLICE, surface, threeSlice, type KitButton } from "./kit";
import type { Tooltip } from "./tooltip";

export type PlanningAction = "library" | "tech" | "craft" | "recipes" | "inventory" | "history" | "information" | "settings";
const ACTIONS: { id: PlanningAction; icon: string; key: MsgKey }[] = [
  { id: "library", icon: ICONS.library, key: "menu.library" },
  { id: "tech", icon: ICONS.tech, key: "planning.tech" },
  { id: "craft", icon: ICONS.craft, key: "planning.craft" },
  { id: "history", icon: ICONS.history, key: "planning.history" },
  { id: "information", icon: ICONS.info, key: "menu.information" },
  { id: "settings", icon: ICONS.settings, key: "menu.settings" },
];

export interface PlanningIntents {
  buy(slot: number): void;
  details(baseId: string): void;
  reroll(): void;
  buyXp(): void;
  toggleLock(): void;
  start(): void;
  action(id: PlanningAction): void;
  tutorialDismiss(stepId: string): void;
  tutorialSkip(): void;
  cortisol(): void;
  /** Camera pan vector in [-1,1]², (0,0) when released. */
  pan(x: number, y: number): void;
}

export interface PlanningModel {
  run: RunState;
  synergies: SynergyLine[];
  benchCap: number;
  deployLimit: number;
  deployed: number;
  /** Interactions locked by modal/tutorial/phase (A88). */
  locked: boolean;
  tutorial: TutorialStep | null;
}

export interface PlanningView { el: HTMLElement; update(m: PlanningModel): void; refreshCopy(): void; dispose(): void }

const SHOP_PAGE_WIDE = 8;
const SHOP_PAGE_COMPACT = 4;

export function createPlanningHud(host: HTMLElement, tip: Tooltip, portraits: PortraitProvider, it: PlanningIntents): PlanningView {
  let m: PlanningModel | null = null, page = 0;
  const compactShop = matchMedia("(max-width: 760px)");
  const portraitPlanning = matchMedia("(max-width: 760px) and (orientation: portrait)");
  const portraitShop = matchMedia("(max-width: 760px) and (orientation: portrait)");
  let shopOpen = false;
  const shopPageSize = () => compactShop.matches ? SHOP_PAGE_COMPACT : SHOP_PAGE_WIDE;
  const root = h("div", "planning");
  root.dataset.screen = "planning";

  // ---- compact planning summary, kept immediately left of the Start controls ----
  const stats = h("div", "pl-stats");
  const statsS = surface(stats, (g, w, hh) => {
    nineSlice(g, "panel_wood", SLICE.panel_wood, 0, 0, w, hh);
    if (!m) return;
    const r = m.run;
    const cells = [
      `${ICONS.round} ${r.round}`,
      `${ICONS.heart} ${r.hp}`,
      `${ICONS.gold} ${r.gold}`,
      `${ICONS.level} ${r.level}`,
      `${ICONS.start} ${m.deployed}/${m.deployLimit}`,
    ];
    const drawChips = (values: string[], y: number, height: number) => {
      const gap = 4, width = (w - 16 - gap * (values.length - 1)) / values.length;
      values.forEach((value, i) => {
        const x = 8 + i * (width + gap);
        nineSlice(g, "slot_well", SLICE.slot_well, x, y, width, height);
        label(g, value, x + width / 2, y + height / 2, {
          size: Math.min(15, Math.max(10, width / 5)), maxW: width - 6, fill: "#17120e", stroke: null,
        });
      });
    };
    const portrait = portraitPlanning.matches;
    if (portrait) {
      drawChips(cells.slice(0, 3), 7, 26);
      drawChips(cells.slice(3), 38, 26);
    } else drawChips(cells, 6, 28);
    // XP progress bar under the stats (dynamic fill inside authored frame).
    const need = xpToNext(r.level), pct = need > 0 ? Math.min(1, r.xp / need) : 1;
    const bx = 14, bw = w - 28, by = portrait ? hh - 16 : hh - 16, bh = portrait ? 8 : 10;
    nineSlice(g, "bar_trough", 1, bx + 2, by + 2, bw - 4, bh - 4);
    g.fillStyle = "#7fc8ff";
    g.fillRect(bx + 2, by + 2, Math.round((bw - 4) * pct), bh - 4);
    threeSlice(g, "frame_bar", 3, bx, by, bw, bh);
  });

  // ---- top battle controls: summary on the left, Start/actions on the right ----
  const battle = panelEl("panel_wood", "pl-battle");
  const battleActions = h("div", "pl-battle-actions");
  const reroll = kitButton({ skin: "blue", icon: ICONS.reroll, cls: "pl-reroll", onClick: () => it.reroll() });
  const start = kitButton({ skin: "green", icon: ICONS.start, cls: "pl-start fit-btn", onClick: () => it.start() });
  const startMeasure = h("span", "kit-fit-measure");
  start.el.append(startMeasure);
  const xp = kitButton({ skin: "plum", icon: ICONS.xp, onClick: () => it.buyXp() });
  const lock = kitButton({ skin: "icon", icon: ICONS.unlock, aria: t("planning.lock"), cls: "pl-lock", onClick: () => it.toggleLock() });
  const cortisol = kitButton({ skin: "plum", icon: ICONS.cortisol, cls: "pl-cortisol", onClick: () => it.cortisol() });
  battleActions.append(start.el, xp.el, cortisol.el);
  battle.append(stats, battleActions);
  const syncPlanningComposition = () => statsS.paint();
  portraitPlanning.addEventListener("change", syncPlanningComposition);
  syncPlanningComposition();
  tip.bind(lock.el, () => ({ title: t("planning.lock") }));
  tip.bind(cortisol.el, () => ({ title: t("planning.cortisol") }));

  // ---- right action stack ----
  const rail = panelEl("panel_wood", "pl-actions");
  const actionBtns = ACTIONS.map((a) => {
    const b = kitButton({ skin: "icon", icon: a.icon, aria: t(a.key), onClick: () => it.action(a.id) });
    const copy = h("span", "pl-action-label", t(a.key));
    const item = h("div", "pl-action-item");
    tip.bind(b.el, () => ({ title: t(a.key) }));
    item.append(copy, b.el);
    rail.append(item);
    return { a, b, copy };
  });
  const shopToggle = kitButton({ skin: "icon", icon: ICONS.shopfront, cls: "pl-shop-toggle",
    aria: t("planning.shop"), onClick: () => { shopOpen = !shopOpen; syncShopVisibility(); } });
  tip.bind(shopToggle.el, () => ({ title: t("planning.shop") }));
  rail.append(shopToggle.el);

  // ---- camera joystick (A91.1: 44 px radius, left side of the board) ----
  const joy = h("div", "pl-joystick");
  joy.setAttribute("aria-hidden", "true");
  let knob = { x: 0, y: 0 }, joyId = -1;
  const JOY_R = 44;
  const joyS = surface(joy, (g, w, hh) => {
    const base = (JOY_R + 10) * 2;
    drawFit(g, "joy_base", w / 2 - base / 2, hh / 2 - base / 2, base, base);
    drawFit(g, "joy_knob", w / 2 + knob.x * JOY_R - 20, hh / 2 + knob.y * JOY_R - 20, 40, 40);
  });
  const moveJoy = (e: PointerEvent) => {
    if (e.pointerId !== joyId) return;
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / JOY_R, y = (e.clientY - r.top - r.height / 2) / JOY_R;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    knob = { x, y };
    it.pan(x, y);
    joyS.paint();
  };
  const endJoy = (e: PointerEvent) => {
    if (e.pointerId !== joyId) return;
    joyId = -1; knob = { x: 0, y: 0 }; it.pan(0, 0); joyS.paint();
  };
  joy.addEventListener("pointerdown", (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moveJoy(e); });
  joy.addEventListener("pointermove", moveJoy);
  joy.addEventListener("pointerup", endJoy);
  joy.addEventListener("pointercancel", endJoy);

  // ---- authored tutorial guidance ----
  const tutorial = panelEl("panel_parchment", "pl-tutorial");
  tutorial.setAttribute("role", "status");
  tutorial.setAttribute("aria-live", "polite");
  const tutorialCopy = h("div", "pl-tutorial-copy");
  const tutorialActions = h("div", "pl-tutorial-actions");
  const tutorialNext = kitButton({ skin: "green", label: t("tutorial.continue"), onClick: () => {
    const step = m?.tutorial;
    if (step?.trigger === "dismiss") it.tutorialDismiss(step.id);
  } });
  const tutorialSkip = kitButton({ skin: "wood", label: t("tutorial.skip"), onClick: () => it.tutorialSkip() });
  tutorialActions.append(tutorialNext.el, tutorialSkip.el);
  tutorial.append(tutorialCopy, tutorialActions);

  function renderTutorial() {
    const step = m?.tutorial;
    tutorial.hidden = !step;
    if (!step || !m) return;
    const copy = t(step.copyKey as MsgKey);
    const text = `${t("tutorial.title")} — ${copy}`;
    tutorialCopy.textContent = text;
    tutorial.setAttribute("aria-label", text);
    tutorial.dataset.placement = step.panelPlacement;
    tutorialNext.el.hidden = step.trigger !== "dismiss";
    tutorialNext.setDisabled(m.locked || step.trigger !== "dismiss");
    tutorialSkip.setDisabled(m.locked || !step.allowSkip);
  }

  // ---- bottom shop dock ----
  const dock = panelEl("panel_wood", "pl-shop");
  const dockHead = h("div", "pl-shop-head");
  const headS = surface(dockHead, (g, w, hh) => {
    if (!m) return;
    label(g, `${t("planning.shop")} · ${t("planning.bench", { current: m.run.bench.length, max: m.benchCap })}`, 10, hh / 2, { size: 13, align: "left", fill: "#17120e", stroke: null });
  });
  const prev = kitButton({ skin: "wood", label: "‹", cls: "pl-page", onClick: () => { page = Math.max(0, page - 1); renderShop(); } });
  const next = kitButton({ skin: "wood", label: "›", cls: "pl-page", onClick: () => { page++; renderShop(); } });
  dockHead.append(reroll.el, lock.el, prev.el, next.el);
  const grid = h("div", "pl-shop-grid");
  dock.append(dockHead, grid);
  function syncShopVisibility() {
    const shown = !portraitShop.matches || shopOpen;
    dock.hidden = !shown;
    root.dataset.shopOpen = String(shown);
    shopToggle.setSelected(portraitShop.matches && shown);
    shopToggle.el.setAttribute("aria-expanded", String(shown));
    shopToggle.el.setAttribute("aria-controls", "planning-creature-shop");
  }
  dock.id = "planning-creature-shop";
  const onShopViewportChange = () => { shopOpen = false; syncShopVisibility(); };
  portraitShop.addEventListener("change", onShopViewportChange);

  interface Slot { card: CardView; buy: KitButton; info: KitButton; wrap: HTMLElement; index: number; buyText: string; buyCost: string; drawnText: string }
  const slots: Slot[] = Array.from({ length: SHOP_PAGE_WIDE }, () => {
    const wrap = h("div", "pl-offer");
    const card = createCard(portraits, "pl-offer-card");
    const row = h("div", "pl-offer-actions");
    const slot: Slot = { card, wrap, index: -1, buyText: "", buyCost: "", drawnText: "",
      buy: kitButton({ skin: "green", icon: ICONS.gold, cls: "pl-buy", onClick: () => slot.index >= 0 && it.buy(slot.index) }),
      info: kitButton({ skin: "icon", icon: ICONS.info, aria: t("menu.information"), onClick: () => { const id = m?.run.shop[slot.index]; if (id) it.details(id); } }),
    };
    row.append(slot.info.el, slot.buy.el);
    wrap.append(card.el, row);
    grid.append(wrap);
    return slot;
  });
  let rerollText = "", rerollCostText = "", rerollDrawn = "";
  const syncResponsiveLabels = () => {
    const rerollVisible = reroll.el.clientWidth >= 112 ? rerollText : rerollCostText;
    if (rerollVisible !== rerollDrawn) { rerollDrawn = rerollVisible; reroll.setLabel(rerollVisible); }
    for (const slot of slots) {
      const visible = slot.buy.el.clientWidth >= 100 ? slot.buyText : slot.buyCost;
      if (visible !== slot.drawnText) { slot.drawnText = visible; slot.buy.setLabel(visible); }
    }
  };
  const shopButtonResize = new ResizeObserver(syncResponsiveLabels);
  shopButtonResize.observe(reroll.el);
  for (const slot of slots) shopButtonResize.observe(slot.buy.el);

  function renderShop() {
    if (!m) return;
    const shop = m.run.shop, pageSize = shopPageSize(), pages = Math.max(1, Math.ceil(shop.length / pageSize));
    page = Math.min(page, pages - 1);
    prev.el.hidden = next.el.hidden = pages <= 1;
    prev.setDisabled(page === 0);
    next.setDisabled(page >= pages - 1);
    slots.forEach((s, i) => {
      const idx = page * pageSize + i, id = i < pageSize && idx < shop.length ? shop[idx] : undefined;
      s.index = idx;
      s.wrap.hidden = i >= pageSize || idx >= shop.length;
      if (!id) {
        s.card.set(null); s.buyText = ""; s.buyCost = ""; s.buy.setAria(t("planning.buy"));
        s.buy.setDisabled(true); s.info.setDisabled(true); return;
      }
      const u = getUnit(id), afford = m!.run.gold >= u.tier;
      s.card.set({ unit: u, star: 1, cost: u.tier, detail: "planning", affordable: afford });
      s.buyText = `${t("planning.buy")} (${u.tier} ${ICONS.gold})`;
      s.buyCost = String(u.tier);
      s.buy.setAria(`${s.buyText} ${u.nameVi}`);
      s.buy.setDisabled(m!.locked || !afford);
      s.info.setAria(`${t("menu.information")} ${u.nameVi}`);
      s.info.setDisabled(false);
    });
    headS.paint();
    syncResponsiveLabels();
  }
  const onShopLayoutChange = () => { page = 0; renderShop(); };
  compactShop.addEventListener("change", onShopLayoutChange);
  syncShopVisibility();

  root.append(battle, rail, joy, tutorial, dock);
  host.append(root);

  function refreshCopy() {
    for (const { a, b, copy } of actionBtns) {
      const text = t(a.key);
      b.setAria(text);
      copy.textContent = text;
    }
    shopToggle.setAria(t("planning.shop"));
    tutorialNext.setLabel(t("tutorial.continue"));
    tutorialSkip.setLabel(t("tutorial.skip"));
    lock.setAria(t("planning.lock"));
    if (m) update(m);
  }

  function update(nm: PlanningModel) {
    m = nm;
    const r = nm.run;
    const rerollCost = refreshCost(r.level, r.rollCostDelta);
    const buyXpCost = xpBuyCost(r.xpCostDelta);
    const rerollLabel = t("planning.reroll", { cost: `${rerollCost} ${ICONS.gold}` });
    const xpLabel = t("planning.buyXp", { cost: `${buyXpCost} ${ICONS.gold}` });
    rerollText = rerollLabel;
    rerollCostText = `${rerollCost} ${ICONS.gold}`;
    xp.setLabel(xpLabel);
    const startText = `${t("planning.start")} (-1 ${ICONS.heart})`;
    start.setLabel(startText);
    startMeasure.textContent = startText;
    reroll.setAria(rerollLabel);
    xp.setAria(xpLabel);
    stats.setAttribute("role", "status");
    stats.setAttribute("aria-label", `${t("combat.round", { round: r.round })}, ${r.hp} ${ICONS.heart}, ${r.gold} ${ICONS.gold}, ${t("planning.level", { level: r.level })}, ${t("planning.deploy", { current: nm.deployed, max: nm.deployLimit })}`);
    lock.setIcon(r.shopLocked ? ICONS.lock : ICONS.unlock);
    lock.setSelected(r.shopLocked);
    for (const b of [reroll, xp, start, lock]) b.setDisabled(nm.locked);
    reroll.setDisabled(nm.locked || r.shopLocked || r.gold < rerollCost);
    xp.setDisabled(nm.locked || r.gold < buyXpCost);
    renderTutorial();
    statsS.paint();
    renderShop();
  }

  return {
    el: root, update, refreshCopy,
    dispose() {
      compactShop.removeEventListener("change", onShopLayoutChange);
      portraitPlanning.removeEventListener("change", syncPlanningComposition);
      shopButtonResize.disconnect();
      portraitShop.removeEventListener("change", onShopViewportChange);
      it.pan(0, 0);
      for (const s of slots) s.card.dispose();
      root.remove();
    },
  };
}
