// Library / collection browser (§25, §50.4, A109): filters + paged card grid → detail with the live
// 3D rig, five action-preview buttons, star selector, star milestone table and skill clarity.
// Pure view over catalog + core inspection; owns no gameplay state.
import { UNITS, type Element, type Faction, type Role, type UnitDef } from "../content/catalog";
import { BASE_MATERIALS, RECIPES } from "../core/craft";
import { shopTierOdds } from "../core/economy";
import { EQUIPMENT } from "../core/equipment";
import { AUGMENTS, type AugGroup } from "../core/augments";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { starStatMilestones } from "../core/inspection";
import { createCard, type CardView } from "./card";
import { disposeSurfaceTree, h, kitButton, panelEl, type KitButton } from "./kit";
import type { ModalHandle } from "./modal";
import type { Tooltip } from "./tooltip";
import type { PortraitViewer, Portraits } from "../units/portraits";
import { hasRig } from "../units/registry";
import { ACTION_STATES, type ActionState, type Star } from "../units/rig";
import type { CollectionProfile } from "../core/achievements";

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
  let page = 0, cards: CardView[] = [], viewer: PortraitViewer | null = null, idleTimer: number | null = null, relaxedIdle = true;
  let tab: LibraryTab = "units";
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
      tip.bind(b.el, () => ({ title: name(v) }));
      row.append(b.el);
      return [v, b];
    });
    return { row, sync: () => { for (const [v, b] of btns) b.setSelected(get() === v); } };
  };

  function renderCatalog() {
    const list = h("div", "lib-info");
    root.append(list);
    const entry = (title: string, ...detail: string[]) => {
      const panel = panelEl("panel_tooltip", "lib-sec");
      panel.append(h("h3", "lib-h", title));
      for (const line of detail) panel.append(h("p", "lib-p", line));
      list.append(panel);
      return panel;
    };
    const iconEntry = (id: string, title: string, ...detail: string[]) => {
      const heading = entry(title, ...detail).querySelector(".lib-h");
      const icon = h("img", "lib-item-icon");
      icon.src = `/assets/items/${encodeURIComponent(id)}.svg`;
      icon.alt = "";
      icon.loading = "lazy";
      heading?.prepend(icon);
    };
    const nameOfEquipment = (id: string) => id === "eq_blue_buff"
      ? t("item.eq_blue_buff")
      : id === "eq_warmog_armor" ? t("item.eq_warmog_armor") : id;
    if (tab === "materials") {
      entry("Danh mục nguyên liệu", "Các nguyên liệu có thể sử dụng trên bàn chế tạo.");
      for (const id of BASE_MATERIALS) iconEntry(id, MATERIAL_NAMES[id] ?? id);
    } else if (tab === "equipment") {
      for (const item of EQUIPMENT) {
        const bonuses = Object.entries(item.bonuses).map(([key, value]) => `${key}: ${value}`);
        iconEntry(item.id, nameOfEquipment(item.id), `Bậc ${item.tier}`, ...bonuses);
      }
    } else if (tab === "recipes") {
      entry("Công thức đã có", "Chỉ hiển thị các công thức được định nghĩa trong trò chơi; không suy đoán công thức còn thiếu.");
      for (const recipe of RECIPES) {
        const lines = [];
        for (let row = 0; row < recipe.size; row++) {
          lines.push(recipe.pattern.slice(row * recipe.size, (row + 1) * recipe.size)
            .map((id) => id ? MATERIAL_NAMES[id] ?? id : "Ô trống").join(" · "));
        }
        iconEntry(`eq_${recipe.id}`, nameOfEquipment(`eq_${recipe.id}`), `Bàn ${recipe.size}×${recipe.size}`, ...lines);
      }
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
    clearIdleTimer();
    viewer?.dispose(); viewer = null;
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
      const btn = kitButton({ skin: "wood", label: item.name, onClick: () => { tab = item.id; renderBrowse(); } });
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
    disposeSurfaceTree(root);
    root.replaceChildren();
    modal.setTitle(u.nameVi);
    const equippedSkinId = collection.equippedSkinByUnitId[u.id];
    let star: Star = 1;
    let skinId: string | null = u.skin?.id === equippedSkinId && collection.unlockedSkinIds.includes(equippedSkinId) ? equippedSkinId : null;
    const wrap = h("div", "lib-detail");
    const stagePanel = panelEl("slot_well", "lib-stage");
    const view = h("div", "lib-view");
    stagePanel.append(view);
    clearIdleTimer();
    viewer?.dispose();
    viewer = portraits.createViewer(view);
    viewer.setUnit(u.id, star, skinId);
    scheduleIdle();
    if (!hasRig(u.id)) stagePanel.append(h("div", "lib-pending", t("library.artPending")));

    const actions = h("div", "lib-actions");
    const stateBtns: KitButton[] = [];
    for (const s of ACTION_STATES) {
      const b = kitButton({ skin: "green", label: t(STATE_KEY[s]), onClick: () => {
        relaxedIdle = s === "idle";
        viewer?.setCombat(false);
        viewer?.play(s);
        for (const x of stateBtns) x.setSelected(x === b);
        scheduleIdle();
      } });
      actions.append(b.el);
      stateBtns.push(b);
      if (s === "idle") {
        const beastForm = kitButton({ skin: "green", label: t("unit.beastForm"), onClick: () => {
          relaxedIdle = false;
          viewer?.setCombat(true);
          viewer?.play("idle");
          for (const x of stateBtns) x.setSelected(false);
          clearIdleTimer();
        } });
        tip.bind(beastForm.el, () => ({ title: t("unit.beastForm") }));
        actions.append(beastForm.el);
      }
    }
    const stars = h("div", "lib-stars");
    const starBtns = ([1, 2, 3] as const).map((n) => {
      const b = kitButton({ skin: "plum", label: "★".repeat(n), onClick: () => { star = n; viewer?.setUnit(u.id, n, skinId); scheduleIdle(); for (const [k, x] of starBtns.entries()) x.setSelected(k + 1 === n); renderInfo(); } });
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
      const identity = panelEl("panel_tooltip", "lib-sec");
      identity.append(
        h("h3", "lib-h", `${ICONS[u.role]} ${t(`role.${u.role}` as MsgKey)} · ${ICONS[u.faction]} ${t(`faction.${u.faction}` as MsgKey)} · ${ICONS[u.element as Element]} ${t(`element.${u.element}` as MsgKey)} · ${t("library.tier", { tier: u.tier })}`),
        h("p", "lib-p lib-story", u.pitchVi),
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
      sec(`${ICONS.atk} ${t("library.basic")}`, u.basic.textVi);
      const s = u.skill;
      sec(`${ICONS.rage} ${t("library.skill")}: ${s.nameVi} (${t("unit.rage", { cost: s.rageCost[star - 1] ?? s.rageCost[0] })})`,
        s.starDetailVi[star - 1] ?? s.detailVi,
        s.targetVi && `${ICONS.range} ${t("library.target")}: ${s.targetVi}`,
        s.shapeVi && `▦ ${t("library.shape")}: ${s.shapeVi}`,
        s.countVi && `# ${t("library.targets")}: ${s.countVi}`,
        s.durationVi && `${ICONS.hourglass} ${t("library.duration")}: ${s.durationVi}`);
      const skin = u.skin;
      if (skin) {
        const skinSec = panelEl("panel_tooltip", "lib-sec");
        skinSec.append(h("h3", "lib-h", `${ICONS.palette} ${t("library.skins")}`));
        const skinActions = h("div", "lib-skin-actions");
        const base = kitButton({ skin: "wood", label: t("library.baseLook"), onClick: () => {
          if (account.equipCollectionSkin(u.id, null)) refreshCollection();
          skinId = null;
          viewer?.setUnit(u.id, star, skinId);
          scheduleIdle();
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
            viewer?.setUnit(u.id, star, skinId);
            scheduleIdle();
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
  return { showDetail, dispose() { clearIdleTimer(); gridRo?.disconnect(); viewer?.dispose(); for (const c of cards) c.dispose(); disposeSurfaceTree(root); root.remove(); } };
}
