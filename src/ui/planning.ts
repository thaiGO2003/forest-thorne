// Planning HUD (§14.1, §14.5, §50.2, A22): one command table around the board.
// Top: stats bar + centred battle controls (Start in the middle). Right: 7 action icons.
// Left: synergy rail + camera joystick. Bottom: shop dock (2×4 visible, paged). Pure view.
import { getUnit } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { refreshCost, xpBuyCost, xpToNext } from "../core/economy";
import type { RunState } from "../core/run";
import type { SynergyLine } from "../core/synergy";
import { createCard, type CardView, type PortraitProvider } from "./card";
import { drawFit, h, kitButton, label, nineSlice, panelEl, SLICE, surface, threeSlice, type KitButton } from "./kit";
import type { Tooltip } from "./tooltip";

export type PlanningAction = "library" | "tech" | "craft" | "recipes" | "inventory" | "history" | "settings";
const ACTIONS: { id: PlanningAction; icon: string; key: MsgKey }[] = [
  { id: "library", icon: ICONS.library, key: "menu.library" },
  { id: "tech", icon: ICONS.tech, key: "planning.tech" },
  { id: "craft", icon: ICONS.craft, key: "planning.craft" },
  { id: "recipes", icon: ICONS.recipe, key: "planning.recipes" },
  { id: "inventory", icon: ICONS.inventory, key: "planning.inventory" },
  { id: "history", icon: ICONS.history, key: "planning.history" },
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
}

export interface PlanningView { el: HTMLElement; update(m: PlanningModel): void; refreshCopy(): void; dispose(): void }

const SHOP_PAGE = 8;
const SYN_PREFIX: Record<SynergyLine["kind"], string> = { class: "role", faction: "faction", element: "element" };
/** Localized synergy name (shared by rail + tooltip so both read identically). */
const synName = (l: SynergyLine) => t(`${SYN_PREFIX[l.kind]}.${l.key}` as MsgKey);

export function createPlanningHud(host: HTMLElement, tip: Tooltip, portraits: PortraitProvider, it: PlanningIntents): PlanningView {
  let m: PlanningModel | null = null, page = 0;
  const root = h("div", "planning");
  root.dataset.screen = "planning";

  // ---- top stats bar ----
  const stats = h("div", "pl-stats");
  const statsS = surface(stats, (g, w, hh) => {
    nineSlice(g, "panel_wood", SLICE.panel_wood, 0, 0, w, hh);
    if (!m) return;
    const r = m.run, cells = [
      `${ICONS.round} ${t("combat.round", { round: r.round })}`,
      `${ICONS.heart} ${r.hp}`,
      `${ICONS.gold} ${r.gold}`,
      `${ICONS.level} ${t("planning.level", { level: r.level })}`,
      `${ICONS.start} ${t("planning.deploy", { current: m.deployed, max: m.deployLimit })}`,
    ];
    const cw = (w - 16) / cells.length;
    cells.forEach((c, i) => label(g, c, 8 + cw * (i + 0.5), hh * 0.42, { size: Math.min(15, cw / 7), maxW: cw - 6 }));
    // XP progress bar under the stats (dynamic fill inside authored frame).
    const need = xpToNext(r.level), pct = need > 0 ? Math.min(1, r.xp / need) : 1;
    const bx = 14, bw = w - 28, by = hh - 16, bh = 10;
    nineSlice(g, "bar_trough", 1, bx + 2, by + 2, bw - 4, bh - 4);
    g.fillStyle = "#7fc8ff";
    g.fillRect(bx + 2, by + 2, Math.round((bw - 4) * pct), bh - 4);
    threeSlice(g, "frame_bar", 3, bx, by, bw, bh);
  });

  // ---- top battle controls: reroll · START · xp, lock beside ----
  const battle = panelEl("panel_wood", "pl-battle");
  const reroll = kitButton({ skin: "blue", icon: ICONS.reroll, onClick: () => it.reroll() });
  const start = kitButton({ skin: "green", icon: ICONS.start, cls: "pl-start", onClick: () => it.start() });
  const xp = kitButton({ skin: "plum", icon: ICONS.xp, onClick: () => it.buyXp() });
  const lock = kitButton({ skin: "icon", icon: ICONS.unlock, cls: "pl-lock", onClick: () => it.toggleLock() });
  battle.append(reroll.el, start.el, xp.el, lock.el);
  tip.bind(lock.el, () => ({ title: t("planning.lock") }));

  // ---- right action stack ----
  const rail = panelEl("panel_wood", "pl-actions");
  const actionBtns = ACTIONS.map((a) => {
    const b = kitButton({ skin: "icon", icon: a.icon, onClick: () => it.action(a.id) });
    tip.bind(b.el, () => ({ title: t(a.key) }));
    rail.append(b.el);
    return { a, b };
  });

  // ---- left synergy rail ----
  const syn = h("div", "pl-synergy");
  syn.setAttribute("aria-label", t("planning.synergy"));
  const synS = surface(syn, (g, w, hh) => {
    const lines = (m?.synergies ?? []).filter((l) => l.count > 0).sort((a, b) => b.active - a.active || b.count - a.count);
    const rowH = 30, shown = Math.min(lines.length, Math.floor((hh - 34) / rowH));
    const ph = Math.max(48, 34 + shown * rowH);
    nineSlice(g, "panel_wood", SLICE.panel_wood, 0, 0, w, ph);
    label(g, `${ICONS.synergy} ${t("planning.synergy")}`, w / 2, 18, { size: 13 });
    for (let i = 0; i < shown; i++) {
      const l = lines[i]!, y = 34 + i * rowH;
      nineSlice(g, l.active ? "tile_status" : "slot_well", SLICE.tile_status, 8, y, w - 16, rowH - 4);
      const ic = ICONS[l.key as keyof typeof ICONS] ?? "❔";
      label(g, ic, 24, y + rowH / 2 - 2, { size: 15, stroke: null });
      const tier = l.next ? `${l.count}/${l.next}` : `${l.count} ★`;
      label(g, tier, w - 14, y + rowH / 2 - 2, { size: 13, align: "right", fill: l.active ? "#ffe08a" : "#3b2414", stroke: l.active ? undefined : null });
      label(g, synName(l), 40, y + rowH / 2 - 2, { size: 11, align: "left", fill: l.active ? "#fff8ec" : "#3b2414", stroke: l.active ? undefined : null, maxW: w - 90 });
    }
  });
  tip.bind(syn, () => ({ title: t("planning.synergy"), lines: (m?.synergies ?? []).filter((l) => l.count).map((l) => ({ icon: ICONS[l.key as keyof typeof ICONS], text: `${synName(l)} ${l.count}${l.next ? `/${l.next}` : ""}`, tone: l.active ? "good" : "muted" })) }));

  // ---- camera joystick (A91.1: 44 px radius, left side, below synergy) ----
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

  // ---- bottom shop dock ----
  const dock = panelEl("panel_wood", "pl-shop");
  const dockHead = h("div", "pl-shop-head");
  const headS = surface(dockHead, (g, w, hh) => {
    if (!m) return;
    label(g, `${t("planning.shop")} · ${t("planning.bench", { current: m.run.bench.length, max: m.benchCap })}`, 10, hh / 2, { size: 13, align: "left" });
  });
  const prev = kitButton({ skin: "wood", label: "‹", cls: "pl-page", onClick: () => { page = Math.max(0, page - 1); renderShop(); } });
  const next = kitButton({ skin: "wood", label: "›", cls: "pl-page", onClick: () => { page++; renderShop(); } });
  const cortisol = kitButton({ skin: "plum", icon: ICONS.cortisol, cls: "pl-cortisol", onClick: () => it.cortisol() });
  tip.bind(cortisol.el, () => ({ title: t("planning.cortisol") }));
  dockHead.append(prev.el, next.el, cortisol.el);
  const grid = h("div", "pl-shop-grid");
  dock.append(dockHead, grid);

  interface Slot { card: CardView; buy: KitButton; info: KitButton; wrap: HTMLElement; index: number }
  const slots: Slot[] = Array.from({ length: SHOP_PAGE }, () => {
    const wrap = h("div", "pl-offer");
    const card = createCard(portraits, "pl-offer-card");
    const row = h("div", "pl-offer-actions");
    const slot: Slot = { card, wrap, index: -1,
      buy: kitButton({ skin: "green", onClick: () => slot.index >= 0 && it.buy(slot.index) }),
      info: kitButton({ skin: "icon", icon: ICONS.info, onClick: () => { const id = m?.run.shop[slot.index]; if (id) it.details(id); } }),
    };
    row.append(slot.buy.el, slot.info.el);
    wrap.append(card.el, row);
    grid.append(wrap);
    return slot;
  });

  function renderShop() {
    if (!m) return;
    const shop = m.run.shop, pages = Math.max(1, Math.ceil(shop.length / SHOP_PAGE));
    page = Math.min(page, pages - 1);
    prev.el.hidden = next.el.hidden = pages <= 1;
    prev.setDisabled(page === 0);
    next.setDisabled(page >= pages - 1);
    slots.forEach((s, i) => {
      const idx = page * SHOP_PAGE + i, id = idx < shop.length ? shop[idx] : undefined;
      s.index = idx;
      s.wrap.hidden = idx >= shop.length;
      if (!id) { s.card.set(null); s.buy.setDisabled(true); s.info.setDisabled(true); return; }
      const u = getUnit(id), afford = m!.run.gold >= u.tier;
      s.card.set({ unit: u, star: 1, cost: u.tier, detail: "planning", affordable: afford });
      s.buy.setLabel(`${t("planning.buy")} ${u.tier}`);
      s.buy.setDisabled(m!.locked || !afford);
      s.info.setDisabled(false);
    });
    headS.paint();
  }

  root.append(stats, battle, rail, syn, joy, dock);
  host.append(root);

  function refreshCopy() {
    for (const { a, b } of actionBtns) b.el.setAttribute("aria-label", t(a.key));
    if (m) update(m);
  }

  function update(nm: PlanningModel) {
    m = nm;
    const r = nm.run;
    reroll.setLabel(`${refreshCost(r.level, r.rollCostDelta)}`);
    xp.setLabel(`${xpBuyCost(r.xpCostDelta)}`);
    start.setLabel(t("planning.start"));
    reroll.el.setAttribute("aria-label", t("planning.reroll", { cost: refreshCost(r.level, r.rollCostDelta) }));
    xp.el.setAttribute("aria-label", t("planning.buyXp", { cost: xpBuyCost(r.xpCostDelta) }));
    lock.setIcon(r.shopLocked ? ICONS.lock : ICONS.unlock);
    lock.setSelected(r.shopLocked);
    for (const b of [reroll, xp, start, lock]) b.setDisabled(nm.locked);
    reroll.setDisabled(nm.locked || r.shopLocked || r.gold < refreshCost(r.level, r.rollCostDelta));
    xp.setDisabled(nm.locked || r.gold < xpBuyCost(r.xpCostDelta));
    statsS.paint(); synS.paint();
    renderShop();
  }

  return {
    el: root, update, refreshCopy,
    dispose() { it.pan(0, 0); for (const s of slots) s.card.dispose(); root.remove(); },
  };
}
