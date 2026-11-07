// Planning HUD (§14.1, §14.5, §50.2, A22): one command table around the board.
// Top: stats + battle controls. Right: contextual actions and a collapsible shop on constrained viewports.
// Shop shows 8 offers on wide screens or 4 on compact screens, with paging.
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { refreshCost, xpBuyCost, xpToNext } from "../core/economy";
import type { RunState } from "../core/run";
import type { SynergyLine } from "../core/synergy";
import type { TutorialStep } from "../core/tutorial";
import { createCard, unitCardTooltip, type CardView, type PortraitProvider } from "./card";
import { h, kitButton, label, LABEL, nineSlice, panelEl, SLICE, surface, threeSlice, type KitButton } from "./kit";
import { uiFont } from "./fontScale";
import type { Tooltip, TooltipContent } from "./tooltip";

export type PlanningAction = "library" | "tech" | "craft" | "recipes" | "inventory" | "quick-nav" | "history" | "information" | "settings";
const ACTIONS: { id: PlanningAction; icon: string; key: MsgKey }[] = [
  { id: "library", icon: ICONS.library, key: "menu.library" },
  { id: "tech", icon: ICONS.tech, key: "planning.tech" },
  { id: "craft", icon: ICONS.craft, key: "planning.craft" },
  { id: "quick-nav", icon: ICONS.explore, key: "planning.quickNav" },
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
  const smallLandscapeShop = matchMedia("(max-width: 960px) and (max-height: 560px) and (orientation: landscape)");
  let shopOpen = false;
  const shopPageSize = () => portraitShop.matches ? 2 : compactShop.matches || smallLandscapeShop.matches ? SHOP_PAGE_COMPACT : SHOP_PAGE_WIDE;
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

  // ---- chip tooltips: every summary chip explains itself on hover ----
  const chipContent = (index: number): TooltipContent | null => {
    if (!m) return null;
    const r = m.run;
    switch (index) {
      case 0: return { title: t("hud.round", { round: r.round }), body: t("hud.roundHint") };
      case 1: return { title: t("hud.hearts", { hearts: r.hp }), body: t("hud.heartsHint") };
      case 2: return { title: t("hud.gold", { gold: r.gold }), body: t("hud.goldHint") };
      case 3: return { title: t("hud.level", { level: r.level }), body: t("hud.levelHint") };
      case 4: return { title: t("hud.deploy", { current: m.deployed, max: m.deployLimit }), body: t("hud.deployHint") };
      default: return null;
    }
  };
  const chipIndexAt = (event: PointerEvent): number => {
    const rect = stats.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top, gap = 4;
    const rows: [number, number, number, number][] = portraitPlanning.matches
      ? [[0, 3, 7, 26], [3, 5, 38, 26]]
      : [[0, 5, 6, 28]];
    for (const [start, end, top, height] of rows) {
      if (y < top || y > top + height) continue;
      const count = end - start;
      const width = (rect.width - 16 - gap * (count - 1)) / count;
      const index = Math.floor((x - 8) / (width + gap));
      if (index >= 0 && index < count) return start + index;
    }
    return -1;
  };
  let hoveredChip = -1;
  stats.addEventListener("pointermove", (event) => {
    const index = chipIndexAt(event);
    if (index === hoveredChip) return;
    hoveredChip = index;
    const content = index >= 0 ? chipContent(index) : null;
    if (content) tip.show(new DOMRect(event.clientX - 1, event.clientY - 1, 2, 2), content);
    else tip.hide();
  });
  stats.addEventListener("pointerleave", () => { hoveredChip = -1; tip.hide(); });

  // ---- top battle controls: summary on the left, Start/actions on the right ----
  const battle = panelEl("panel_wood", "pl-battle");
  const battleActions = h("div", "pl-battle-actions");
  const reroll = kitButton({ skin: "icon", icon: ICONS.reroll, aria: t("planning.reroll", { cost: `${refreshCost(1)} ${ICONS.gold}` }), cls: "pl-reroll", onClick: () => it.reroll() });
  const rerollControl = h("div", "pl-reroll-control");
  const rerollCostLabel = h("span", "pl-reroll-cost");
  rerollCostLabel.setAttribute("aria-hidden", "true");
  let rerollCostText = "";
  const rerollCostSurface = surface(rerollCostLabel, (g, w, hh) => {
    if (rerollCostText) label(g, rerollCostText, w / 2, hh / 2, { size: uiFont(13), fill: LABEL, stroke: null });
  });
  rerollControl.append(reroll.el, rerollCostLabel);
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
  const rerollTooltip = () => {
    if (!m) return null;
    const cost = refreshCost(m.run.level, m.run.rollCostDelta);
    return { title: t("planning.reroll", { cost: `${cost} ${ICONS.gold}` }) };
  };
  const unbindRerollTip = tip.bind(rerollControl, rerollTooltip);
  const showRerollFocusTip = () => { const content = rerollTooltip(); if (content) tip.show(reroll.el, content); };
  const hideRerollFocusTip = () => tip.hide();
  reroll.el.addEventListener("focus", showRerollFocusTip);
  reroll.el.addEventListener("blur", hideRerollFocusTip);
  tip.bind(cortisol.el, () => ({ title: t("planning.cortisol") }));
  tip.bind(xp.el, () => ({ title: t("hud.xp"), body: t("hud.xpHint") }));
  tip.bind(start.el, () => ({ title: t("planning.start"), body: t("hud.startHint") }));

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
    label(g, `${t("planning.shop")} · ${t("planning.bench", { current: m.run.bench.length, max: m.benchCap })}`, 10, hh / 2, { size: uiFont(13), align: "left", fill: LABEL, stroke: null });
  });
  const prev = kitButton({ skin: "wood", label: "‹", cls: "pl-page", onClick: () => { page = Math.max(0, page - 1); renderShop(); } });
  const next = kitButton({ skin: "wood", label: "›", cls: "pl-page", onClick: () => { page++; renderShop(); } });
  dockHead.append(rerollControl, lock.el, prev.el, next.el);
  const grid = h("div", "pl-shop-grid");
  dock.append(dockHead, grid);
  function syncShopVisibility() {
    const collapsible = portraitShop.matches || smallLandscapeShop.matches;
    const shown = !collapsible || shopOpen;
    dock.hidden = !shown;
    root.dataset.shopOpen = String(shown);
    shopToggle.setSelected(collapsible && shown);
    shopToggle.el.setAttribute("aria-expanded", String(shown));
    shopToggle.el.setAttribute("aria-controls", "planning-creature-shop");
  }
  dock.id = "planning-creature-shop";
  const onShopViewportChange = () => { shopOpen = false; page = 0; syncShopVisibility(); renderShop(); };
  portraitShop.addEventListener("change", onShopViewportChange);
  smallLandscapeShop.addEventListener("change", onShopViewportChange);

  interface Slot { card: CardView; buy: KitButton; wrap: HTMLElement; index: number; buyText: string; buyCost: string; drawnText: string; offerId?: string | null; unbindTip?: () => void }
  const slots: Slot[] = Array.from({ length: SHOP_PAGE_WIDE }, () => {
    const wrap = h("div", "pl-offer");
    const card = createCard(portraits, "pl-offer-card");
    const row = h("div", "pl-offer-actions");
    const slot: Slot = { card, wrap, index: -1, buyText: "", buyCost: "", drawnText: "",
      // The full label fits wide buttons; compact controls show only the price.
      buy: kitButton({ skin: "green", cls: "pl-buy", onClick: () => slot.index >= 0 && it.buy(slot.index) }),
    };
    const activeId = () => {
      if (!m || slot.wrap.hidden || slot.index < 0) return undefined;
      return m.run.shop[slot.index];
    };
    const openDetail = () => { const id = activeId(); if (id) { tip.hide(); it.details(id); } };
    card.el.setAttribute("role", "button");
    card.el.tabIndex = -1;
    card.el.addEventListener("click", openDetail);
    card.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(); }
    });
    slot.unbindTip = tip.bind(card.el, () => { const id = activeId(); return id ? unitCardTooltip(getUnit(id), { portrait: portraits.get(id, 1) }) : null; });
    row.append(slot.buy.el);
    wrap.append(card.el, row);
    grid.append(wrap);
    return slot;
  });
  const syncResponsiveLabels = () => {
    for (const slot of slots) {
      const visible = slot.buy.el.clientWidth >= 100 ? slot.buyText : slot.buyCost;
      if (visible !== slot.drawnText) { slot.drawnText = visible; slot.buy.setLabel(visible); }
    }
  };
  const shopButtonResize = new ResizeObserver(syncResponsiveLabels);
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
      if (s.offerId !== id) { tip.hide(); s.offerId = id; }
      s.index = idx;
      s.wrap.hidden = i >= pageSize || idx >= shop.length;
      if (!id) {
        s.card.set(null); s.card.el.tabIndex = -1;
        s.buyText = ""; s.buyCost = ""; s.buy.setAria(t("planning.buy"));
        s.buy.setDisabled(true); return;
      }
      const u = getUnit(id), afford = m!.run.gold >= u.tier;
      s.card.set({ unit: u, star: 1, cost: u.tier, affordable: afford });
      s.card.el.tabIndex = 0;
      s.buyText = `${t("planning.buy")} ${u.tier} ${ICONS.gold}`;
      s.buyCost = `${u.tier} ${ICONS.gold}`;
      s.buy.setAria(`${t("planning.buy")} ${u.nameVi} (${u.tier} ${ICONS.gold})`);
      s.buy.setDisabled(m!.locked || !afford);
    });
    headS.paint();
    syncResponsiveLabels();
  }
  const onShopLayoutChange = () => { page = 0; renderShop(); };
  compactShop.addEventListener("change", onShopLayoutChange);
  smallLandscapeShop.addEventListener("change", onShopLayoutChange);
  syncShopVisibility();

  root.append(battle, rail, tutorial, dock);
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
    rerollCostText = `${rerollCost} ${ICONS.gold}`;
    rerollCostSurface.paint();
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
      smallLandscapeShop.removeEventListener("change", onShopLayoutChange);
      portraitPlanning.removeEventListener("change", syncPlanningComposition);
      shopButtonResize.disconnect();
      portraitShop.removeEventListener("change", onShopViewportChange);
      smallLandscapeShop.removeEventListener("change", onShopViewportChange);
      for (const s of slots) { s.unbindTip?.(); s.card.dispose(); }
      unbindRerollTip();
      reroll.el.removeEventListener("focus", showRerollFocusTip);
      reroll.el.removeEventListener("blur", hideRerollFocusTip);
      rerollCostSurface.dispose();
      tip.hide();
      root.remove();
    },
  };
}
