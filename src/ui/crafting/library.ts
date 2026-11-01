// Recipe library: category rail + tier columns + relationship detail, matching the classic
// "Thư viện công thức" layout. Works as a full modal, a nested crafting overlay, or embedded
// inside the main Library modal.
import type { App } from "../../app/app";
import { RECIPES } from "../../core/craft";
import { equipmentCategory, getEquipment, type EquipmentCategory } from "../../core/equipment";
import { ICONS } from "../../core/emojiIcon";
import { itemDisplayName } from "../../core/itemPresentation";
import {
  baseIngredients, outputIdForRecipe, recipeForOutput, recipeIngredients, recipeTree, recipesUsing,
} from "../../core/recipeGraph";
import { disposeSurfaceTree, h, kitButton, nineSlice, panelEl, SLICE, surface } from "../kit";
import type { Tooltip } from "../tooltip";
import { itemArt } from "./art";
import { itemBonusLines, itemTooltipContent } from "./copy";
import { buildItemSheet, buildMiniRecipe } from "./itemSheet";
import { openCraftOverlay } from "./overlay";

export interface CraftLibraryContext {
  tip: Tooltip;
}

export interface CraftLibraryOptions {
  showInfoButton?: boolean;
  onOpenItem?: (itemId: string) => void;
}

export interface CraftLibraryView {
  el: HTMLElement;
  dispose(): void;
}

const TIERS = [1, 2, 3] as const;
const CATEGORY_META: Record<EquipmentCategory, { label: string; icon: string }> = {
  offense: { label: "Tấn Công", icon: ICONS.start },
  defense: { label: "Phòng Thủ", icon: ICONS.shield },
  magic: { label: "Pháp Thuật", icon: ICONS.matk },
};

const categoryOf = (outputId: string): EquipmentCategory => {
  const item = getEquipment(outputId);
  return item ? equipmentCategory(item) : "offense";
};

export function createCraftLibrary(ctx: CraftLibraryContext, options: CraftLibraryOptions = {}): CraftLibraryView {
  let activeCategory: EquipmentCategory = "offense";
  let query = "";
  let selected: string | null = null;
  const root = h("div", "craft-library");
  const head = h("div", "craft-library-head");
  const searchWrap = panelEl("slot_well", "craft-library-search");
  const search = h("input", "lib-input");
  search.type = "search";
  search.placeholder = "Tìm công thức hoặc nguyên liệu";
  search.setAttribute("aria-label", "Tìm công thức hoặc nguyên liệu");
  searchWrap.append(search);
  const headNote = h("span", "craft-library-note", `Cấp 1–3 · ${RECIPES.length} công thức`);
  head.append(searchWrap, headNote);
  const graph = h("div", "craft-graph");
  const rail = h("div", "craft-graph-rail");
  const columns = h("div", "craft-graph-columns");
  const detail = h("div", "craft-graph-detail");
  graph.append(rail, columns, detail);
  root.append(head, graph);

  const matchesQuery = (recipe: (typeof RECIPES)[number]) => {
    if (!query) return true;
    const output = outputIdForRecipe(recipe);
    return itemDisplayName(output).toLowerCase().includes(query)
      || recipe.id.includes(query)
      || recipeIngredients(recipe).some((ingredient) => itemDisplayName(ingredient.id).toLowerCase().includes(query));
  };

  const visibleRecipes = () => RECIPES.filter((recipe) => categoryOf(outputIdForRecipe(recipe)) === activeCategory && matchesQuery(recipe));

  const select = (itemId: string | null) => {
    selected = itemId;
    renderColumns();
    renderDetail();
  };

  const renderRail = () => {
    disposeSurfaceTree(rail);
    rail.replaceChildren();
    (Object.keys(CATEGORY_META) as EquipmentCategory[]).forEach((category) => {
      const meta = CATEGORY_META[category];
      const button = h("button", "craft-graph-rail-button");
      button.type = "button";
      button.dataset.category = category;
      button.dataset.selected = String(activeCategory === category);
      button.style.color = "#fff8ec";
      surface(button, (g, w, hh) => nineSlice(
        g,
        activeCategory === category ? "btn_blue_selected" : "panel_wood",
        activeCategory === category ? SLICE.btn : SLICE.panel_wood,
        0, 0, w, hh,
      ));
      const icon = h("span", "craft-graph-rail-icon", meta.icon);
      icon.setAttribute("aria-hidden", "true");
      button.append(icon, h("span", "craft-graph-rail-label", meta.label));
      button.setAttribute("aria-label", meta.label);
      button.addEventListener("click", () => {
        activeCategory = category;
        selected = null;
        renderRail();
        renderColumns();
        renderDetail();
      });
      rail.append(button);
    });
  };

  const renderColumns = () => {
    disposeSurfaceTree(columns);
    columns.replaceChildren();
    const recipes = visibleRecipes();
    for (const tier of TIERS) {
      const tierRecipes = recipes.filter((recipe) => recipe.size === tier);
      const column = panelEl("panel_parchment", "craft-graph-column");
      column.dataset.tier = String(tier);
      column.setAttribute("aria-label", `Cấp ${tier}`);
      const header = h("div", "craft-graph-column-head");
      header.append(h("strong", "", `Cấp ${tier}`), h("span", "", String(tierRecipes.length)));
      const scroll = h("div", "craft-graph-scroll");
      if (!tierRecipes.length) scroll.append(h("p", "craft-graph-empty", "Không có công thức"));
      for (const recipe of tierRecipes) {
        const output = outputIdForRecipe(recipe);
        const isSelected = selected === output;
        const card = h("button", "craft-graph-card");
        card.type = "button";
        card.dataset.output = output;
        card.dataset.selected = String(isSelected);
        card.style.color = isSelected ? "#fff8ec" : "#3b2414";
        surface(card, (g, w, hh) => nineSlice(
          g,
          isSelected ? "btn_blue_selected" : `card_t${tier}`,
          isSelected ? SLICE.btn : SLICE.card,
          0, 0, w, hh,
          1.2,
        ));
        card.append(itemArt(output, "craft-graph-card-icon"));
        const copy = h("div", "craft-graph-card-copy");
        copy.append(h("strong", "", itemDisplayName(output)));
        copy.append(h("small", "", itemBonusLines(output).join(" · ") || "Chưa có chỉ số"));
        card.append(copy);
        card.setAttribute("aria-label", `${itemDisplayName(output)}, Cấp ${tier}`);
        card.addEventListener("click", () => select(output));
        ctx.tip.bind(card, () => itemTooltipContent(output));
        scroll.append(card);
      }
      column.append(header, scroll);
      columns.append(column);
    }
  };

  const renderDetail = () => {
    disposeSurfaceTree(detail);
    detail.replaceChildren();
    if (!selected) {
      const empty = panelEl("panel_parchment", "craft-graph-detail-empty");
      const icon = h("span", "craft-graph-empty-icon", "📜");
      icon.setAttribute("aria-hidden", "true");
      empty.append(icon, h("p", "", "Chọn một công thức để xem chi tiết."));
      detail.append(empty);
      return;
    }

    const recipe = recipeForOutput(selected);
    const hero = panelEl("panel_wood", "craft-library-hero");
    const portrait = panelEl("slot_well", "craft-library-portrait");
    portrait.append(itemArt(selected, "craft-library-portrait-icon"));
    const heroCopy = h("div", "craft-library-hero-copy");
    heroCopy.append(
      h("span", "crafting-eyebrow", recipe ? `CẤP ${recipe.size} · ${CATEGORY_META[categoryOf(selected)].label.toUpperCase()}` : "NGUYÊN LIỆU GỐC"),
      h("h3", "", itemDisplayName(selected)),
      h("p", "", recipe ? itemBonusLines(selected).join(" · ") || "Chưa có chỉ số cộng." : "Nguyên liệu nền của mọi công thức."),
    );
    hero.append(portrait, heroCopy);
    if (options.showInfoButton !== false && options.onOpenItem) {
      const info = kitButton({ skin: "wood", label: "Thông tin vật phẩm", cls: "craft-library-info", onClick: () => options.onOpenItem?.(selected!) });
      hero.append(info.el);
    }
    detail.append(hero);

    if (recipe) {
      const stats = panelEl("panel_parchment", "craft-library-sec");
      stats.append(h("h4", "", "Chỉ số"));
      for (const line of itemBonusLines(selected).length ? itemBonusLines(selected) : ["Chưa có chỉ số cộng."]) {
        stats.append(h("p", "craft-sheet-line", line));
      }
      detail.append(stats);

      const recipeSec = panelEl("panel_parchment", "craft-library-sec");
      recipeSec.append(h("h4", "", "Công thức"), buildMiniRecipe(recipe));
      const ingredients = h("div", "craft-sheet-lines");
      for (const ingredient of recipeIngredients(recipe)) {
        const row = h("button", "craft-relation-row");
        row.type = "button";
        row.append(itemArt(ingredient.id, "craft-relation-icon"));
        row.append(h("span", "craft-relation-name", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
        row.addEventListener("click", () => select(ingredient.id));
        ctx.tip.bind(row, () => itemTooltipContent(ingredient.id));
        ingredients.append(row);
      }
      recipeSec.append(ingredients);
      detail.append(recipeSec);

      const base = baseIngredients(selected);
      if (base.length) {
        const baseSec = panelEl("panel_parchment", "craft-library-sec");
        baseSec.append(h("h4", "", "Nguyên liệu gốc"));
        const list = h("div", "craft-sheet-lines");
        for (const ingredient of base) {
          const row = h("div", "craft-base-row");
          row.append(itemArt(ingredient.id, "craft-relation-icon"));
          row.append(h("span", "", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
          list.append(row);
        }
        baseSec.append(list);
        detail.append(baseSec);
      }

      const tree = recipeTree(selected, 4);
      if (tree && tree.children.length) {
        const treeSec = panelEl("panel_parchment", "craft-library-sec");
        treeSec.append(h("h4", "", "Chuỗi chế tạo"));
        const treeHost = h("div", "craft-tree");
        const walk = (node: NonNullable<typeof tree>, depth: number) => {
          const row = h("button", "craft-tree-row");
          row.type = "button";
          row.dataset.depth = String(Math.min(4, depth));
          row.append(itemArt(node.id, "craft-tree-icon"));
          row.append(h("span", "craft-tree-name", itemDisplayName(node.id)));
          row.append(h("span", "craft-tree-count", `×${node.count}`));
          row.addEventListener("click", () => select(node.id));
          treeHost.append(row);
          for (const child of node.children) walk(child, depth + 1);
        };
        walk(tree, 0);
        treeSec.append(treeHost);
        detail.append(treeSec);
      }
    }

    const usedBy = recipesUsing(selected);
    if (usedBy.length) {
      const usedSec = panelEl("panel_parchment", "craft-library-sec");
      usedSec.append(h("h4", "", `Dùng trong ${usedBy.length} công thức`));
      const usedList = h("div", "craft-sheet-lines");
      for (const target of usedBy.slice(0, 8)) {
        const output = outputIdForRecipe(target);
        const row = h("button", "craft-relation-row");
        row.type = "button";
        row.append(itemArt(output, "craft-relation-icon"));
        row.append(h("span", "craft-relation-name", itemDisplayName(output)));
        row.append(h("span", "craft-relation-meta", `Cấp ${target.size}`));
        row.addEventListener("click", () => select(output));
        usedList.append(row);
      }
      if (usedBy.length > 8) usedList.append(h("p", "craft-library-empty", `… và ${usedBy.length - 8} công thức khác. Dùng ô tìm kiếm để thu hẹp.`));
      usedSec.append(usedList);
      detail.append(usedSec);
    }
  };

  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    renderColumns();
    renderDetail();
  });

  renderRail();
  renderColumns();
  renderDetail();
  return {
    el: root,
    dispose() {
      disposeSurfaceTree(root);
      root.remove();
    },
  };
}

export function openCraftLibraryModal(app: App): void {
  const modal = app.modals.open({ id: "craft-library", title: "Thư viện chế tạo", size: "full", closeLabel: "Đóng" });
  const view = createCraftLibrary({
    tip: app.tooltip,
  }, {
    onOpenItem: (itemId) => openItemInfoModal(app, itemId),
  });
  const wrap = h("div", "craft-library-modal");
  wrap.append(view.el);
  modal.body.append(wrap);
  const off = app.modals.onChange((active) => {
    if (active === "craft-library") return;
    off();
    view.dispose();
  });
}

export function openItemInfoModal(app: App, itemId: string): void {
  const modal = app.modals.open({ id: "craft-item-info", title: itemDisplayName(itemId), size: "sm", closeLabel: "Đóng" });
  buildItemSheet(modal.body, itemId, {
    onOpenLibrary: () => { modal.close(); openCraftLibraryModal(app); },
    onSelect: (next) => { modal.close(); openItemInfoModal(app, next); },
  });
}

export function openItemSheetOverlay(
  app: App,
  host: HTMLElement,
  itemId: string,
  actions: { onPlace?: () => void; onRemove?: () => void } = {},
  navigate: { onOpenLibrary?: () => void; onSelect?: (itemId: string) => void } = {},
): { close(): void } {
  return openCraftOverlay(host, {
    title: "Thông tin vật phẩm",
    closeLabel: "Đóng",
    className: "is-item",
    build: (body, close) => buildItemSheet(body, itemId, {
      onOpenLibrary: navigate.onOpenLibrary ?? (() => { close(); openCraftLibraryOverlay(app, host); }),
      onSelect: navigate.onSelect ?? ((next) => { close(); openItemSheetOverlay(app, host, next, actions); }),
      onPlace: actions.onPlace,
      onRemove: actions.onRemove,
    }),
  });
}

export function openCraftLibraryOverlay(
  app: App,
  host: HTMLElement,
  navigate: { onOpenItem?: (itemId: string) => void } = {},
): { close(): void } {
  let view: CraftLibraryView | null = null;
  let overlay: { close(): void } | null = null;
  overlay = openCraftOverlay(host, {
    title: "Thư viện chế tạo",
    closeLabel: "Đóng",
    className: "is-library",
    onClose: () => view?.dispose(),
    build: (body) => {
      view = createCraftLibrary({
        tip: app.tooltip,
      }, {
        onOpenItem: navigate.onOpenItem ?? ((itemId) => { overlay?.close(); openItemSheetOverlay(app, host, itemId); }),
      });
      body.append(view.el);
    },
  });
  return overlay;
}
