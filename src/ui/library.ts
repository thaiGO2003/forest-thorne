// Library / collection browser (§25, §50.4, A109): filters + paged card grid → detail with the live
// 3D rig, five action-preview buttons, star selector, star milestone table and skill clarity.
// Pure view over catalog + core inspection; owns no gameplay state.
import { UNITS, type Element, type Faction, type Role, type UnitDef } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { starStatMilestones } from "../core/inspection";
import { createCard, type CardView } from "./card";
import { h, kitButton, panelEl, type KitButton } from "./kit";
import type { ModalHandle } from "./modal";
import type { Tooltip } from "./tooltip";
import type { PortraitViewer, Portraits } from "../units/portraits";
import { hasRig } from "../units/registry";
import { ACTION_STATES, type ActionState, type Star } from "../units/rig";

const ROLES: Role[] = ["TANKER", "FIGHTER", "ASSASSIN", "ARCHER", "MAGE", "SUPPORT"];
const FACTIONS: Faction[] = ["BEAST", "AVIAN", "INSECT", "REPTILE", "AQUATIC", "MYTHICAL"];
const TIERS = [1, 2, 3, 4, 5, 6];
const STATE_KEY: Record<ActionState, MsgKey> = { idle: "unit.idle", attack: "unit.attack", skill: "unit.skill", hit: "unit.hit", move: "unit.move" };

interface Filter { q: string; role: Role | null; faction: Faction | null; tier: number | null }

/** Pure filter so Library order stays catalog-canonical (tier, then id). */
export function filterUnits(units: readonly UnitDef[], f: Filter): UnitDef[] {
  const q = f.q.trim().toLowerCase();
  return units
    .filter((u) => (!f.role || u.role === f.role) && (!f.faction || u.faction === f.faction) && (!f.tier || u.tier === f.tier)
      && (!q || u.nameVi.toLowerCase().includes(q) || u.id.includes(q)))
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
}

export interface LibraryView { showDetail(id: string): void; dispose(): void }

export function mountLibrary(modal: ModalHandle, portraits: Portraits, tip: Tooltip, startId?: string): LibraryView {
  const f: Filter = { q: "", role: null, faction: null, tier: null };
  let page = 0, cards: CardView[] = [], viewer: PortraitViewer | null = null;
  const root = h("div", "lib");
  modal.body.append(root);

  const chipRow = <T>(values: T[], icon: (v: T) => string, name: (v: T) => string, get: () => T | null, set: (v: T | null) => void) => {
    const row = h("div", "lib-chips");
    const btns: [T, KitButton][] = values.map((v) => {
      const b = kitButton({ skin: "icon", icon: icon(v), aria: name(v), cls: "lib-chip", onClick: () => { set(get() === v ? null : v); page = 0; renderGrid(); } });
      tip.bind(b.el, () => ({ title: name(v) }));
      row.append(b.el);
      return [v, b];
    });
    return { row, sync: () => { for (const [v, b] of btns) b.setSelected(get() === v); } };
  };

  function renderBrowse() {
    viewer?.dispose(); viewer = null;
    for (const c of cards) c.dispose();
    root.replaceChildren();
    modal.setTitle(t("menu.library"));
    const bar = h("div", "lib-filters");
    const search = panelEl("slot_well", "lib-search");
    const input = h("input", "lib-input");
    input.type = "search";
    input.placeholder = t("library.search");
    input.setAttribute("aria-label", t("library.search"));
    input.value = f.q;
    input.addEventListener("input", () => { f.q = input.value; page = 0; renderGrid(); });
    search.append(input);
    const roles = chipRow(ROLES, (r) => ICONS[r], (r) => t(`role.${r}` as MsgKey), () => f.role, (v) => { f.role = v; });
    const facs = chipRow(FACTIONS, (x) => ICONS[x], (x) => t(`faction.${x}` as MsgKey), () => f.faction, (v) => { f.faction = v; });
    const tiers = chipRow(TIERS, (n) => (n === 6 ? "👑" : `${n}`), (n) => (n === 6 ? t("library.boss") : t("library.tier", { tier: n })), () => f.tier, (v) => { f.tier = v; });
    const reset = kitButton({ skin: "wood", label: t("library.reset"), cls: "lib-reset", onClick: () => { Object.assign(f, { q: "", role: null, faction: null, tier: null }); page = 0; renderBrowse(); } });
    bar.append(search, roles.row, facs.row, tiers.row, reset.el);
    const grid = h("div", "lib-grid");
    const foot = h("div", "lib-foot");
    root.append(bar, grid, foot);
    syncChips = () => { roles.sync(); facs.sync(); tiers.sync(); };
    gridEl = grid; footEl = foot;
    // Page size depends on the grid's laid-out box; re-render only when the fitted count changes.
    gridRo?.disconnect();
    gridRo = new ResizeObserver(() => { if (gridEl && pageSize(gridEl) !== lastPer) renderGrid(); });
    gridRo.observe(grid);
    renderGrid();
  }
  let gridRo: ResizeObserver | null = null, lastPer = 0;

  /** Resolved auto-fill track count × rows that fit at card aspect 5/7, from the grid's own box (2.2). */
  function pageSize(grid: HTMLElement): number {
    const cs = getComputedStyle(grid), gw = grid.clientWidth || 800, gh = grid.clientHeight || 500;
    const colGap = parseFloat(cs.columnGap) || 0, rowGap = parseFloat(cs.rowGap) || 0;
    const cols = Math.max(1, cs.gridTemplateColumns.split(" ").filter(Boolean).length);
    const cardH = ((gw - colGap * (cols - 1)) / cols) * 1.4;
    return cols * Math.max(1, Math.floor((gh + rowGap) / (cardH + rowGap)));
  }
  let syncChips = () => {}, gridEl: HTMLElement | null = null, footEl: HTMLElement | null = null;

  function renderGrid() {
    if (!gridEl || !footEl) return;
    syncChips();
    for (const c of cards) c.dispose();
    cards = [];
    gridEl.replaceChildren();
    const list = filterUnits(UNITS, f);
    const per = (lastPer = pageSize(gridEl));
    const pages = Math.max(1, Math.ceil(list.length / per));
    page = Math.min(page, pages - 1);
    if (!list.length) gridEl.append(h("div", "lib-empty", t("library.empty")));
    for (const u of list.slice(page * per, page * per + per)) {
      const c = createCard(portraits, "lib-card");
      c.set({ unit: u, star: 1, detail: "library" });
      c.el.tabIndex = 0;
      c.el.setAttribute("role", "button");
      const open = () => showDetail(u.id);
      c.el.addEventListener("click", open);
      c.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      gridEl.append(c.el);
      cards.push(c);
    }
    footEl.replaceChildren();
    const prev = kitButton({ skin: "wood", label: "‹", cls: "lib-page", onClick: () => { page--; renderGrid(); } });
    const next = kitButton({ skin: "wood", label: "›", cls: "lib-page", onClick: () => { page++; renderGrid(); } });
    prev.setDisabled(page === 0); next.setDisabled(page >= pages - 1);
    footEl.append(prev.el, h("span", "lib-count", `${t("library.count", { shown: list.length, total: UNITS.length })} · ${t("library.page", { page: page + 1, pages })}`), next.el);
  }

  function showDetail(id: string) {
    const found = UNITS.find((x) => x.id === id);
    if (!found) return;
    const u: UnitDef = found; // non-optional binding: nested renderInfo keeps the narrowed type
    for (const c of cards) c.dispose();
    cards = []; gridEl = footEl = null;
    gridRo?.disconnect(); gridRo = null;
    root.replaceChildren();
    modal.setTitle(u.nameVi);
    let star: Star = 1;
    const wrap = h("div", "lib-detail");
    const stagePanel = panelEl("slot_well", "lib-stage");
    const view = h("div", "lib-view");
    stagePanel.append(view);
    viewer?.dispose();
    viewer = portraits.createViewer(view);
    viewer.setUnit(u.id, star);
    if (!hasRig(u.id)) stagePanel.append(h("div", "lib-pending", t("library.artPending")));

    const actions = h("div", "lib-actions");
    const stateBtns = ACTION_STATES.map((s) => {
      const b = kitButton({ skin: s === "idle" ? "green" : "wood", label: t(STATE_KEY[s]), onClick: () => { viewer?.play(s); for (const x of stateBtns) x.setSelected(x === b); } });
      actions.append(b.el);
      return b;
    });
    const stars = h("div", "lib-stars");
    const starBtns = ([1, 2, 3] as const).map((n) => {
      const b = kitButton({ skin: "plum", label: "★".repeat(n), onClick: () => { star = n; viewer?.setUnit(u.id, n); for (const [k, x] of starBtns.entries()) x.setSelected(k + 1 === n); renderInfo(); } });
      stars.append(b.el);
      return b;
    });
    starBtns[0]!.setSelected(true);

    const info = h("div", "lib-info");
    const back = kitButton({ skin: "wood", label: t("library.back"), cls: "lib-back", onClick: () => renderBrowse() });
    const left = h("div", "lib-left");
    left.append(stagePanel, actions, stars);
    wrap.append(left, info);
    root.append(back.el, wrap);

    function renderInfo() {
      info.replaceChildren();
      const sec = (title: string, ...rows: (string | undefined)[]) => {
        const p = panelEl("panel_tooltip", "lib-sec");
        p.append(h("h3", "lib-h", title));
        for (const r of rows) if (r) p.append(h("p", "lib-p", r));
        info.append(p);
      };
      sec(`${ICONS[u.role]} ${t(`role.${u.role}` as MsgKey)} · ${ICONS[u.faction]} ${t(`faction.${u.faction}` as MsgKey)} · ${ICONS[u.element as Element]} ${t(`element.${u.element}` as MsgKey)} · ${t("library.tier", { tier: u.tier })}`, u.pitchVi);
      const ms = starStatMilestones(u);
      const table = h("table", "lib-table");
      const head = h("tr");
      for (const c of ["★", ICONS.hp, ICONS.atk, ICONS.def, ICONS.matk, ICONS.mdef, ICONS.range, ICONS.rage]) head.append(h("th", "", c));
      table.append(head);
      for (const m of ms) {
        const tr = h("tr", m.star === star ? "lib-row-on" : "");
        for (const v of [`${m.star}★`, m.hp, m.atk, m.def, m.matk, m.mdef, m.range, m.rageCost]) tr.append(h("td", "", String(v)));
        table.append(tr);
      }
      const statSec = panelEl("panel_tooltip", "lib-sec");
      statSec.append(h("h3", "lib-h", t("library.stars")), table);
      info.append(statSec);
      sec(`${ICONS.atk} ${t("library.basic")}`, u.basic.textVi);
      const s = u.skill;
      sec(`${ICONS.rage} ${t("library.skill")}: ${s.nameVi} (${t("unit.rage", { cost: s.rageCost[star - 1] ?? s.rageCost[0] })})`,
        s.starDetailVi[star - 1] ?? s.detailVi,
        s.targetVi && `${ICONS.range} ${t("library.target")}: ${s.targetVi}`,
        s.shapeVi && `▦ ${t("library.shape")}: ${s.shapeVi}`,
        s.countVi && `# ${t("library.targets")}: ${s.countVi}`,
        s.durationVi && `⏳ ${t("library.duration")}: ${s.durationVi}`);
      if (u.skin) sec(`🎨 ${t("library.skins")}`, ...u.skin.stagesVi);
    }
    renderInfo();
  }

  if (startId) showDetail(startId); else renderBrowse();
  return { showDetail, dispose() { gridRo?.disconnect(); viewer?.dispose(); for (const c of cards) c.dispose(); root.remove(); } };
}
