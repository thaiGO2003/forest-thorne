// Library / collection browser (§25, §50.4, A109): filters + paged card grid → detail with the live
// 3D rig, five action-preview buttons, star selector, star milestone table and skill clarity.
// Pure view over catalog + core inspection; owns no gameplay state.
import { UNITS, type Element, type Faction, type Role, type UnitDef } from "../content/catalog";
import { hasUnitVisual } from "../content/unitVisuals";
import { shopTierOdds } from "../core/economy";
import { BASE_MATERIALS, EQUIPMENT } from "../core/itemRegistry";
import { AUGMENTS, type AugGroup } from "../core/augments";
import { ICONS, SKILL_ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { starStatMilestones } from "../core/inspection";
import { basicAttackCopy } from "../core/unitText";
import { unitEvolutionName } from "../content/unitNames";
import { createCard, unitCardTooltip, type CardView } from "./card";
import { createCraftLibrary, type CraftLibraryView } from "./crafting/library";
import { disposeSurfaceTree, h, kitButton, panelEl, type KitButton } from "./kit";
import { equipmentBonusCopy, hasItemArt, itemDisplayName, itemIconChar } from "../core/itemPresentation";
import type { ModalHandle } from "./modal";
import type { ModalOrigin } from "./modalOrigins";
import type { Tooltip } from "./tooltip";
import type { PortraitViewer, Portraits } from "../units/portraits";
import { mountPortraitControls } from "./portraitControls";
import { decorateDescription, inferRichTone } from "./richText";
import { hasRig } from "../units/registry";
import { ACTION_STATES, type ActionState, type Star } from "../units/rig";
import type { CollectionProfile } from "../core/achievements";

const richParagraph = (cls: string, text: string): HTMLElement => {
  const p = h("p", cls);
  p.append(decorateDescription(text, inferRichTone(text)));
  return p;
};

const ROLES: Role[] = ["TANKER", "FIGHTER", "ASSASSIN", "ARCHER", "MAGE", "SUPPORT"];
const FACTIONS: Faction[] = ["BEAST", "AVIAN", "INSECT", "REPTILE", "AQUATIC", "MYTHICAL"];
const TIERS = [1, 2, 3, 4, 5, 6];
const STATE_KEY: Record<ActionState, MsgKey> = { idle: "unit.idle", attack: "unit.attack", skill: "unit.skill", hit: "unit.hit", move: "unit.move" };

type LibraryTab = "units" | "materials" | "equipment" | "recipes" | "augments" | "odds";
const TABS: readonly { id: LibraryTab; name: string }[] = [
  { id: "units", name: "Thú" },
  { id: "materials", name: "Vật phẩm" },
  { id: "equipment", name: "Trang bị" },
  { id: "recipes", name: "Chế tạo / công thức" },
  { id: "augments", name: "Chúc phúc" },
  { id: "odds", name: "Xác suất cửa hàng" },
];
const MATERIAL_NAMES: Record<string, string> = {
  bark: "Vỏ cây", feather: "Lông vũ", belt: "Đai", claw: "Vuốt", tear: "Nước mắt", crystal: "Pha lê",
};
const AUGMENT_GROUPS: Record<AugGroup, string> = {
  ECONOMY: "Kinh tế", FORMATION: "Đội hình", COMBAT: "Giao tranh", SYNERGY: "Cộng hưởng",
};
const EFFECT_NAMES: Record<string, string> = {
  gold_flat: "Vàng nhận ngay", roll_cost_delta: "Giảm giá làm mới", xp_flat: "Kinh nghiệm nhận ngay",
  xp_cost_delta: "Giảm giá mua kinh nghiệm", win_gold_bonus: "Thưởng vàng khi thắng",
  interest_rate_bonus: "Lãi vàng", interest_cap: "Giới hạn lãi",
  team_atk_pct: "Sát thương vật lý toàn đội", team_matk_pct: "Sát thương phép toàn đội",
  team_def_pct: "Giáp toàn đội", team_mdef_pct: "Kháng phép toàn đội", team_hp_pct: "Máu toàn đội",
  starting_rage: "Nộ khởi đầu", starting_shield: "Khiên khởi đầu",
  lifesteal_pct: "Hút máu", deploy_cap_bonus: "Giới hạn ra trận",
  bench_bonus: "Ô dự bị", inventory_bonus: "Sức chứa kho",
  extra_class_count: "Cộng hưởng vai trò", extra_tribe_count: "Cộng hưởng bộ tộc",
};

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
export interface LibraryCollectionAccess {
  collectionProfile(): CollectionProfile;
  equipCollectionSkin(unitId: string, skinId: string | null): boolean;
}

export function mountLibrary(
  modal: ModalHandle,
  portraits: Portraits,
  tip: Tooltip,
  account: LibraryCollectionAccess,
  startId?: string,
): LibraryView {
  const f: Filter = { q: "", role: null, faction: null, tier: null };
  let collection = account.collectionProfile();
  const refreshCollection = () => { collection = account.collectionProfile(); };
  let page = 0, cards: CardView[] = [], viewer: PortraitViewer | null = null, controlsOff: (() => void) | null = null, idleTimer: number | null = null, relaxedIdle = true;
  let tab: LibraryTab = "units";
  let catalogTier = 0;
  let catalogPage = 0;
  let browseOrigin: Extract<ModalOrigin, { kind: "library-browse" }> | null = null;
  let restoreFrame = 0;
  let craftLibraryView: CraftLibraryView | null = null;
  const cardTips: (() => void)[] = [];
  const clearCardTips = () => {
    for (const unbind of cardTips.splice(0)) unbind();
    tip.hide();
  };
  const viewTips: (() => void)[] = [];
  const clearViewTips = () => {
    for (const unbind of viewTips.splice(0)) unbind();
    tip.hide();
  };
  const root = h("div", "lib");
  modal.body.append(root);
  const clearIdleTimer = () => {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = null;
  };
  const scheduleIdle = () => {
    clearIdleTimer();
    if (!viewer || !relaxedIdle) return;
    const delay = 4_000 + Math.floor(Math.random() * 5_001);
    idleTimer = window.setTimeout(() => {
      if (!relaxedIdle) return;
      viewer?.play("idle");
      scheduleIdle();
    }, delay);
  };

  const chipRow = <T>(values: T[], icon: (v: T) => string, name: (v: T) => string, get: () => T | null, set: (v: T | null) => void) => {
    const row = h("div", "lib-chips");
    const btns: [T, KitButton][] = values.map((v) => {
      const b = kitButton({ skin: "icon", icon: icon(v), aria: name(v), cls: "lib-chip", onClick: () => { set(get() === v ? null : v); page = 0; renderGrid(); } });
      viewTips.push(tip.bind(b.el, () => ({ title: name(v) })));
      row.append(b.el);
      return [v, b];
    });
    return { row, sync: () => { for (const [v, b] of btns) b.setSelected(get() === v); } };
  };

  function renderCatalog() {
    if (tab === "recipes") {
      // The graph library owns its own search, rail, columns and detail; the modal only supplies
      // the tab shell so both the Library tab and the crafting overlay render the same view.
      craftLibraryView?.dispose();
      craftLibraryView = null;
      const embed = h("div", "craft-library-embed");
      craftLibraryView = createCraftLibrary({ tip });
      embed.append(craftLibraryView.el);
      root.append(embed);
      return;
    }
    const list = h("div", "lib-info");
    root.append(list);
    const entry = (title: string, ...detail: string[]) => {
      const panel = panelEl("panel_tooltip", "lib-sec");
      panel.append(h("h3", "lib-h", title));
      for (const line of detail) panel.append(richParagraph("lib-p", line));
      list.append(panel);
      return panel;
    };
    const hostEntry = (host: HTMLElement, title: string, ...detail: string[]) => {
      const panel = panelEl("panel_tooltip", "lib-sec");
      panel.append(h("h3", "lib-h", title));
      for (const line of detail) panel.append(richParagraph("lib-p", line));
      host.append(panel);
      return panel;
    };
    const itemBadge = (heading: globalThis.Element | null, id: string) => {
      const icon = hasItemArt(id) ? h("img", "lib-item-icon") : h("span", "lib-item-icon lib-item-emoji", itemIconChar(id));
      if (icon instanceof HTMLImageElement) {
        icon.src = `/assets/items/${encodeURIComponent(id)}.svg`;
        icon.alt = "";
        icon.loading = "lazy";
      } else icon.setAttribute("aria-hidden", "true");
      heading?.prepend(icon);
    };
    const iconEntry = (id: string, title: string, ...detail: string[]) => {
      itemBadge(entry(title, ...detail).querySelector(".lib-h"), id);
    };
    const hostIconEntry = (host: HTMLElement, id: string, title: string, ...detail: string[]) => {
      itemBadge(hostEntry(host, title, ...detail).querySelector(".lib-h"), id);
    };
    if (tab === "materials") {
      entry("Danh mục nguyên liệu", "Các nguyên liệu có thể sử dụng trên bàn chế tạo.");
      for (const id of BASE_MATERIALS) iconEntry(id, MATERIAL_NAMES[id] ?? itemDisplayName(id));
    } else if (tab === "equipment") {
      const tiers = [...new Set(EQUIPMENT.map((item) => item.tier))].sort((a, b) => a - b);
      entry(
        "Trang bị cổ",
        `${EQUIPMENT.length} trang bị từ bản classic. Chỉ số cộng đã áp dụng; hiệu ứng kích hoạt đặc biệt của old_src chưa được mô phỏng.`,
        "Chọn bậc để lọc; dùng nút chuyển trang ở cuối danh sách.",
      );
      const filters = h("div", "lib-catalog-filters");
      const filterButtons: { value: number; button: KitButton }[] = [];
      const addFilter = (label: string, value: number) => {
        const b = kitButton({ skin: "wood", label, cls: "lib-catalog-filter", onClick: () => {
          catalogTier = value;
          catalogPage = 0;
          for (const entryItem of filterButtons) entryItem.button.setSelected(entryItem.value === value);
          paint();
        } });
        filterButtons.push({ value, button: b });
        b.setSelected(catalogTier === value);
        viewTips.push(tip.bind(b.el, () => ({ title: label })));
        filters.append(b.el);
      };
      addFilter(t("library.all"), 0);
      for (const tier of tiers) addFilter(t("library.tier", { tier }), tier);
      const body = h("div", "lib-catalog-list");
      const foot = h("div", "lib-foot");
      list.append(filters, body, foot);
      const paint = () => {
        const per = 6;
        const equipment = catalogTier ? EQUIPMENT.filter((item) => item.tier === catalogTier) : EQUIPMENT;
        const total = equipment.length;
        const pages = Math.max(1, Math.ceil(total / per));
        catalogPage = Math.min(catalogPage, pages - 1);
        disposeSurfaceTree(body);
        body.replaceChildren();
        for (const item of equipment.slice(catalogPage * per, catalogPage * per + per)) {
          hostIconEntry(body, item.id, itemDisplayName(item.id), t("library.tier", { tier: item.tier }),
            equipmentBonusCopy(item.bonuses) || t("inventory.itemNoBonus"));
        }
        disposeSurfaceTree(foot);
        foot.replaceChildren();
        if (pages > 1) {
          const prev = kitButton({ skin: "wood", label: "‹", cls: "lib-page", onClick: () => { catalogPage = Math.max(0, catalogPage - 1); paint(); } });
          const next = kitButton({ skin: "wood", label: "›", cls: "lib-page", onClick: () => { catalogPage = Math.min(pages - 1, catalogPage + 1); paint(); } });
          prev.setDisabled(catalogPage === 0);
          next.setDisabled(catalogPage >= pages - 1);
          foot.append(prev.el, h("span", "lib-count", `${t("library.page", { page: catalogPage + 1, pages })} · ${total}`), next.el);
        }
      };
      paint();
    } else if (tab === "augments") {
      const picker = h("select", "lib-input");
      picker.setAttribute("aria-label", "Nhóm chúc phúc");
      const option = (value: string, name: string) => {
        const opt = document.createElement("option");
        opt.value = value; opt.textContent = name;
        picker.append(opt);
      };
      option("ALL", "Tất cả nhóm chúc phúc");
      for (const [group, name] of Object.entries(AUGMENT_GROUPS)) option(group, name);
      const filter = () => {
        list.replaceChildren(picker);
        for (const augment of AUGMENTS) {
          if (picker.value !== "ALL" && augment.group !== picker.value) continue;
          entry(EFFECT_NAMES[augment.effect] ?? augment.effect,
            `${AUGMENT_GROUPS[augment.group]} · Mức hiệu ứng: ${augment.value}`, `Mã: ${augment.id}`);
        }
      };
      picker.addEventListener("change", filter);
      filter();
    } else if (tab === "odds") {
      const level = h("select", "lib-input");
      level.setAttribute("aria-label", "Cấp người chơi");
      for (let n = 1; n <= 25; n++) {
        const option = document.createElement("option");
        option.value = String(n);
        option.textContent = `Cấp ${n}`;
        level.append(option);
      }
      level.value = "1";
      const panel = panelEl("panel_tooltip", "lib-sec");
      const table = h("table", "lib-table");
      const update = () => {
        table.replaceChildren();
        const header = h("tr");
        for (const name of ["Bậc thú", "Giá (vàng)", "Xác suất"]) header.append(h("th", "", name));
        table.append(header);
        shopTierOdds(Number(level.value)).forEach((chance, index) => {
          const row = h("tr");
          for (const value of [String(index + 1), String(index + 1), `${(chance * 100).toFixed(2)}%`]) row.append(h("td", "", value));
          table.append(row);
        });
      };
      level.addEventListener("change", update);
      update();
      panel.append(h("h3", "lib-h", "Xác suất theo cấp người chơi"), level,
        h("p", "lib-p", "Giá mua thú bằng bậc thú. Tỉ lệ lấy từ cùng hàm xác suất dùng khi làm mới cửa hàng."), table);
      list.append(panel);
    }
  }

  function renderBrowse() {
    if (restoreFrame) cancelAnimationFrame(restoreFrame);
    restoreFrame = 0;
    clearCardTips();
    clearViewTips();
    clearIdleTimer();
    craftLibraryView?.dispose();
    craftLibraryView = null;
    viewer?.dispose(); viewer = null;
    controlsOff?.(); controlsOff = null;
    for (const c of cards) c.dispose();
    cards = [];
    gridRo?.disconnect(); gridRo = null;
    gridEl = footEl = null;
    disposeSurfaceTree(root);
    root.replaceChildren();
    modal.setTitle(t("menu.library"));
    const tabs = h("div", "lib-tabs");
    tabs.setAttribute("role", "tablist");
    for (const item of TABS) {
      const btn = kitButton({ skin: "wood", label: item.name, onClick: () => { tab = item.id; catalogTier = 0; catalogPage = 0; renderBrowse(); } });
      btn.setSelected(tab === item.id);
      btn.el.setAttribute("role", "tab");
      btn.el.setAttribute("aria-selected", String(tab === item.id));
      tabs.append(btn.el);
    }
    root.append(tabs);
    if (tab !== "units") { renderCatalog(); return; }
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
    const tiers = chipRow(TIERS, (n) => (n === 6 ? ICONS.crown : `${n}`), (n) => (n === 6 ? t("library.boss") : t("library.tier", { tier: n })), () => f.tier, (v) => { f.tier = v; });
    const reset = kitButton({ skin: "wood", label: t("library.reset"), cls: "lib-reset", onClick: () => { Object.assign(f, { q: "", role: null, faction: null, tier: null }); page = 0; renderBrowse(); } });
    bar.append(search, roles.row, facs.row, tiers.row, reset.el);
    const grid = h("div", "lib-grid");
    const foot = h("div", "lib-foot");
    root.append(bar, grid, foot);
    syncChips = () => { roles.sync(); facs.sync(); tiers.sync(); };
    gridEl = grid; footEl = foot;
    // Page size depends on the grid's laid-out box; re-render only when the fitted count changes.
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
    clearCardTips();
    for (const c of cards) c.dispose();
    cards = [];
    gridEl.replaceChildren();
    const list = filterUnits(UNITS.filter((u) => hasUnitVisual(u.id)), f);
    const per = (lastPer = pageSize(gridEl));
    const pages = Math.max(1, Math.ceil(list.length / per));
    page = Math.min(page, pages - 1);
    if (!list.length) gridEl.append(h("div", "lib-empty", t("library.empty")));
    for (const u of list.slice(page * per, page * per + per)) {
      const c = createCard(portraits, "lib-card");
      c.el.dataset.libraryUnit = u.id;
      c.set({ unit: u, star: 1, cost: u.boss ? undefined : u.tier });
      c.el.tabIndex = 0;
      c.el.setAttribute("role", "button");
      const open = () => { tip.hide(); showDetail(u.id); };
      c.el.addEventListener("click", open);
      c.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      cardTips.push(tip.bind(c.el, () => unitCardTooltip(u, { portrait: portraits.get(u.id, 1) })));
      gridEl.append(c.el);
      cards.push(c);
    }
    footEl.replaceChildren();
    const prev = kitButton({ skin: "wood", label: "‹", cls: "lib-page", onClick: () => { page--; renderGrid(); } });
    const next = kitButton({ skin: "wood", label: "›", cls: "lib-page", onClick: () => { page++; renderGrid(); } });
    prev.setDisabled(page === 0); next.setDisabled(page >= pages - 1);
    footEl.append(prev.el, h("span", "lib-count", `${t("library.count", { shown: list.length, total: UNITS.filter((u) => hasUnitVisual(u.id)).length })} · ${t("library.page", { page: page + 1, pages })}`), next.el);
  }

  function showDetail(id: string) {
    if (gridEl) {
      browseOrigin = {
        kind: "library-browse",
        state: {
          tab, query: f.q, role: f.role, faction: f.faction, tier: f.tier,
          page, catalogTier, catalogPage, modalScrollTop: modal.body.scrollTop,
          gridScrollTop: gridEl.scrollTop, focusedCardId: id,
        },
      };
    } else {
      browseOrigin = null; // Direct detail does not invent a parent.
    }
    clearCardTips();
    clearViewTips();
    const found = UNITS.find((x) => x.id === id && hasUnitVisual(x.id));
    if (!found) return;
    const u: UnitDef = found; // non-optional binding: nested renderInfo keeps the narrowed type
    for (const c of cards) c.dispose();
    cards = []; gridEl = footEl = null;
    gridRo?.disconnect(); gridRo = null;
    disposeSurfaceTree(root);
    root.replaceChildren();
    modal.setTitle(unitEvolutionName(u, 1));
    const equippedSkinId = collection.equippedSkinByUnitId[u.id];
    let star: Star = 1;
    relaxedIdle = true;
    let action: ActionState = "idle";
    let beastForm = false;
    let skinId: string | null = u.skin?.id === equippedSkinId && collection.unlockedSkinIds.includes(equippedSkinId) ? equippedSkinId : null;
    const wrap = h("div", "lib-detail");
    const stagePanel = panelEl("slot_well", "lib-stage");
    const view = h("div", "lib-view");
    stagePanel.append(view);
    clearIdleTimer();
    viewer?.dispose();
    controlsOff?.();
    controlsOff = null;
    viewer = portraits.createViewer(view);
    viewer.setUnit(u.id, star, skinId);
    const updateUnit = () => {
      viewer?.setUnit(u.id, star, skinId);
      viewer?.setCombat(beastForm);
      viewer?.play(action);
      scheduleIdle();
    };
    controlsOff = mountPortraitControls(stagePanel, viewer);
    scheduleIdle();
    if (!hasRig(u.id)) stagePanel.append(h("div", "lib-pending", t("library.artPending")));

    const actions = h("div", "lib-actions");
    const stateBtns: KitButton[] = [];
    for (const s of ACTION_STATES) {
      const b = kitButton({ skin: "green", label: t(STATE_KEY[s]), onClick: () => {
        action = s;
        beastForm = false;
        relaxedIdle = s === "idle";
        viewer?.setCombat(false);
        viewer?.play(s);
        for (const x of stateBtns) x.setSelected(x === b);
        scheduleIdle();
      } });
      actions.append(b.el);
      stateBtns.push(b);
      if (s === "idle") b.setSelected(true);
      if (s === "idle") {
        const beastButton = kitButton({ skin: "green", label: t("unit.beastForm"), onClick: () => {
          action = "idle";
          beastForm = true;
          relaxedIdle = false;
          viewer?.setCombat(true);
          viewer?.play("idle");
          for (const x of stateBtns) x.setSelected(false);
          clearIdleTimer();
        } });
        viewTips.push(tip.bind(beastButton.el, () => ({ title: t("unit.beastForm") })));
        actions.append(beastButton.el);
      }
    }
    const stars = h("div", "lib-stars");
    const nameHeading = h("h2", "lib-name", unitEvolutionName(u, star));
    const syncEvolutionName = () => {
      const name = unitEvolutionName(u, star);
      modal.setTitle(name);
      nameHeading.textContent = name;
    };
    const starBtns = ([1, 2, 3] as const).map((n) => {
      const b = kitButton({ skin: "plum", label: "★".repeat(n), onClick: () => { star = n; updateUnit(); syncEvolutionName(); for (const [k, x] of starBtns.entries()) x.setSelected(k + 1 === n); renderInfo(); } });
      stars.append(b.el);
      return b;
    });
    starBtns[0]!.setSelected(true);

    const info = h("div", "lib-info");
    const back = browseOrigin ? kitButton({
      skin: "wood", label: t("library.back"), cls: "lib-back",
      onClick: () => {
        const state = browseOrigin?.state;
        if (!state) return;
        tab = state.tab; Object.assign(f, { q: state.query, role: state.role, faction: state.faction, tier: state.tier });
        page = state.page; catalogTier = state.catalogTier; catalogPage = state.catalogPage;
        renderBrowse();
        restoreFrame = requestAnimationFrame(() => {
          restoreFrame = 0;
          if (!gridEl?.isConnected) return;
          gridEl.scrollTop = state.gridScrollTop;
          modal.body.scrollTop = state.modalScrollTop;
          const focused = Array.from(gridEl.querySelectorAll<HTMLElement>("[data-library-unit]"))
            .find((entry) => entry.dataset.libraryUnit === state.focusedCardId);
          (focused ?? root.querySelector<HTMLElement>(".lib-input") ?? root.querySelector<HTMLElement>("[role=tab]"))?.focus({ preventScroll: true });
        });
      },
    }) : null;
    const left = h("div", "lib-left");
    left.append(nameHeading, stagePanel, actions, stars);
    wrap.append(left, info);
    root.append(...(back ? [back.el] : []), wrap);

    function renderInfo() {
      info.replaceChildren();
      const sec = (title: string, ...rows: (string | undefined)[]) => {
        const p = panelEl("panel_tooltip", "lib-sec");
        p.append(h("h3", "lib-h", title));
        for (const r of rows) if (r) p.append(richParagraph("lib-p", r));
        info.append(p);
      };
      const identity = panelEl("panel_tooltip", "lib-sec");
      identity.append(
        h("h3", "lib-h", `${ICONS[u.role]} ${t(`role.${u.role}` as MsgKey)} · ${ICONS[u.faction]} ${t(`faction.${u.faction}` as MsgKey)} · ${ICONS[u.element as Element]} ${t(`element.${u.element}` as MsgKey)} · ${t("library.tier", { tier: u.tier })}`),
        richParagraph("lib-p lib-story", u.pitchVi),
      );
      info.append(identity);
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
      sec(`${ICONS.fist} ${t("library.basic")}`, basicAttackCopy(u));
      const s = u.skill;
      sec(`${SKILL_ICONS[u.role]} ${t("library.skill")}: ${s.nameVi} (${t("unit.rage", { cost: s.rageCost[star - 1] ?? s.rageCost[0] })})`,
        s.starDetailVi[star - 1] ?? s.detailVi,
        s.targetVi && `${ICONS.range} ${t("library.target")}: ${s.targetVi}`,
        s.shapeVi && `${ICONS.synergy} ${t("library.shape")}: ${s.shapeVi}`,
        s.countVi && `${ICONS.range} ${t("library.targets")}: ${s.countVi}`,
        star === 1 && s.durationVi ? `${ICONS.hourglass} ${t("library.duration")}: ${s.durationVi}` : undefined);
      const next = ms[star];
      if (next) {
        const current = ms[star - 1]!;
        sec(`${t("library.stars")}: ${star}★ → ${next.star}★`,
          `${ICONS.hp} ${current.hp} → ${next.hp}`,
          `${ICONS.atk} ${current.atk} → ${next.atk} · ${ICONS.matk} ${current.matk} → ${next.matk}`,
          `${ICONS.def} ${current.def} → ${next.def} · ${ICONS.mdef} ${current.mdef} → ${next.mdef}`);
        sec(`${SKILL_ICONS[u.role]} ${t("library.skill")}: ${s.nameVi} · ${next.star}★ (${t("unit.rage", { cost: next.rageCost })})`,
          s.starDetailVi[next.star - 1] ?? s.detailVi);
      }
      const skin = u.skin;
      if (skin) {
        const skinSec = panelEl("panel_tooltip", "lib-sec");
        skinSec.append(h("h3", "lib-h", `${ICONS.palette} ${t("library.skins")}`));
        const skinActions = h("div", "lib-skin-actions");
        const base = kitButton({ skin: "wood", label: t("library.baseLook"), onClick: () => {
          if (account.equipCollectionSkin(u.id, null)) refreshCollection();
          skinId = null;
          updateUnit();
          syncEvolutionName();
          renderInfo();
        } });
        base.setSelected(skinId === null);
        skinActions.append(base.el);
        skin.stagesVi.forEach((label, index) => {
          const stage = Math.min(3, index + 1) as Star;
          const owned = collection.unlockedSkinIds.includes(skin.id);
          const b = kitButton({ skin: "wood", label, onClick: () => {
            if (!owned) return;
            if (account.equipCollectionSkin(u.id, skin.id)) refreshCollection();
            star = stage;
            skinId = skin.id;
            updateUnit();
            syncEvolutionName();
            for (const [k, x] of starBtns.entries()) x.setSelected(k + 1 === star);
            renderInfo();
          } });
          b.setDisabled(!owned);
          b.setSelected(skinId === skin.id && star === stage);
          skinActions.append(b.el);
        });
        skinSec.append(skinActions);
        info.append(skinSec);
      }
    }
    renderInfo();
  }

  if (startId) showDetail(startId); else renderBrowse();
  return { showDetail, dispose() { if (restoreFrame) cancelAnimationFrame(restoreFrame); craftLibraryView?.dispose(); craftLibraryView = null; controlsOff?.(); clearIdleTimer(); clearCardTips(); clearViewTips(); gridRo?.disconnect(); viewer?.dispose(); for (const c of cards) c.dispose(); disposeSurfaceTree(root); root.remove(); } };
}
