// Crafting library: browse every recipe and inspect ingredient relationships.
// Used both as a full modal (Planning → Công thức) and as a nested overlay inside the workbench.
import type { App } from "../../app/app";
import { RECIPES } from "../../core/craft";
import { itemDisplayName } from "../../core/itemPresentation";
import {
  baseIngredients, outputIdForRecipe, recipeForOutput, recipeIngredients, recipeTree, recipesUsing,
} from "../../core/recipeGraph";
import { disposeSurfaceTree, h, kitButton, nineSlice, panelEl, SLICE, surface, type KitButton } from "../kit";
import type { Tooltip } from "../tooltip";
import { itemArt } from "./art";
import { itemBonusLines, itemTooltipContent, recipeCraftable, recipeMissing } from "./copy";
import { buildItemSheet, buildMiniRecipe } from "./itemSheet";
import { openCraftOverlay } from "./overlay";

export interface CraftLibraryOptions {
  tip: Tooltip;
  onOpenItem?: (itemId: string) => void;
}

export interface CraftLibraryView {
  el: HTMLElement;
  dispose(): void;
}

const countBag = (bag: readonly string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of bag) out[id] = (out[id] ?? 0) + 1;
  return out;
};

export function createCraftLibrary(app: App, options: CraftLibraryOptions): CraftLibraryView {
  let query = "";
  let tier = 0;
  let selected = outputIdForRecipe(RECIPES[0]!);
  let controls: KitButton[] = [];
  const root = h("div", "craft-library");
  const head = h("div", "craft-library-head");
  const searchWrap = panelEl("slot_well", "craft-library-search");
  const search = h("input", "lib-input");
  search.type = "search";
  search.placeholder = "Tìm công thức hoặc nguyên liệu";
  search.setAttribute("aria-label", "Tìm công thức hoặc nguyên liệu");
  searchWrap.append(search);
  const chips = h("div", "craft-filter-chips");
  const list = h("div", "craft-library-list");
  const detail = h("div", "craft-library-detail");
  const grid = h("div", "craft-library-grid");
  grid.append(list, detail);
  head.append(searchWrap, chips);
  root.append(head, grid);
  let listScroll = 0;

  const setQuery = () => {
    query = search.value.trim().toLowerCase();
    listScroll = 0;
    renderList();
  };
  search.addEventListener("input", setQuery);

  const filteredRecipes = () => {
    const bag = countBag(app.bridge.run()?.itemBag ?? []);
    return RECIPES.filter((recipe) => {
      if (tier && recipe.size !== tier) return false;
      if (!query) return true;
      const output = itemDisplayName(outputIdForRecipe(recipe)).toLowerCase();
      return output.includes(query)
        || recipeIngredients(recipe).some((ingredient) => itemDisplayName(ingredient.id).toLowerCase().includes(query))
        || recipe.id.includes(query);
    }).map((recipe) => ({ recipe, bag }));
  };
  const select = (outputId: string) => {
    selected = outputId;
    listScroll = list.scrollTop;
    renderList();
  };

  const renderList = () => {
    disposeSurfaceTree(list);
    list.replaceChildren();
    const rows = filteredRecipes();
    if (!rows.length) {
      list.append(h("p", "craft-library-empty", "Không có công thức phù hợp bộ lọc."));
      renderDetail();
      return;
    }
    if (!rows.some(({ recipe }) => outputIdForRecipe(recipe) === selected) && selected.startsWith("eq_")) {
      selected = outputIdForRecipe(rows[0]!.recipe);
    }
    for (const { recipe, bag } of rows) {
      const output = outputIdForRecipe(recipe);
      const active = output === selected;
      const row = h("button", "craft-library-row");
      row.type = "button";
      row.dataset.output = output;
      row.dataset.selected = String(active);
      row.style.color = "#fff8ec";
      surface(row, (g, w, hh) => nineSlice(g, active ? "btn_blue_selected" : "slot_well", active ? SLICE.btn : SLICE.slot_well, 0, 0, w, hh));
      row.append(itemArt(output, "craft-library-row-icon"));
      const copy = h("div", "craft-library-row-copy");
      copy.append(
        h("strong", "", itemDisplayName(output)),
        h("small", "", `Bậc ${recipe.size} · ${recipeCraftable(recipe, bag) ? "Đủ nguyên liệu" : `Thiếu ${recipeMissing(recipe, bag).length}`}`),
      );
      row.append(copy);
      row.append(h("span", "craft-library-row-tier", `B${recipe.size}`));
      row.addEventListener("click", () => select(output));
      options.tip.bind(row, () => itemTooltipContent(output));
      list.append(row);
    }
    list.scrollTop = listScroll;
    renderDetail();
  };

  const renderDetail = () => {
    disposeSurfaceTree(detail);
    detail.replaceChildren();
    const recipe = recipeForOutput(selected);
    const hero = panelEl("panel_wood", "craft-library-hero");
    const portrait = panelEl("slot_well", "craft-library-portrait");
    portrait.append(itemArt(selected, "craft-library-portrait-icon"));
    const heroCopy = h("div", "craft-library-hero-copy");
    heroCopy.append(
      h("span", "crafting-eyebrow", recipe ? `CÔNG THỨC BẬC ${recipe.size}` : "NGUYÊN LIỆU GỐC"),
      h("h3", "", itemDisplayName(selected)),
      h("p", "", recipe ? itemBonusLines(selected).join(" · ") || "Chưa có chỉ số cộng." : "Nguyên liệu nền của mọi công thức."),
    );
    hero.append(portrait, heroCopy);
    const info = kitButton({ skin: "wood", label: "Thông tin vật phẩm", cls: "craft-library-info", onClick: () => options.onOpenItem?.(selected) });
    hero.append(info.el);
    detail.append(hero);

    if (recipe) {
      const recipeSec = panelEl("panel_parchment", "craft-library-sec");
      recipeSec.append(h("h4", "", "Công thức"), buildMiniRecipe(recipe));
      const ingredients = h("div", "craft-sheet-lines");
      for (const ingredient of recipeIngredients(recipe)) {
        const row = h("button", "craft-relation-row");
        row.type = "button";
        row.append(itemArt(ingredient.id, "craft-relation-icon"));
        row.append(h("span", "craft-relation-name", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
        row.addEventListener("click", () => select(ingredient.id));
        options.tip.bind(row, () => itemTooltipContent(ingredient.id));
        ingredients.append(row);
      }
      recipeSec.append(ingredients);
      detail.append(recipeSec);

      const base = baseIngredients(selected);
      if (base.length) {
        const baseSec = panelEl("panel_parchment", "craft-library-sec");
        baseSec.append(h("h4", "", "Nguyên liệu gốc"));
        const baseList = h("div", "craft-sheet-lines");
        for (const ingredient of base) {
          const row = h("div", "craft-base-row");
          row.append(itemArt(ingredient.id, "craft-relation-icon"));
          row.append(h("span", "", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
          baseList.append(row);
        }
        baseSec.append(baseList);
        detail.append(baseSec);
      }
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

    const usedBy = recipesUsing(selected);
    if (usedBy.length) {
      const usedSec = panelEl("panel_parchment", "craft-library-sec");
      usedSec.append(h("h4", "", `Dùng trong ${usedBy.length} công thức`));
      const usedList = h("div", "craft-sheet-lines");
      for (const target of usedBy.slice(0, 40)) {
        const output = outputIdForRecipe(target);
        const row = h("button", "craft-relation-row");
        row.type = "button";
        row.append(itemArt(output, "craft-relation-icon"));
        row.append(h("span", "craft-relation-name", itemDisplayName(output)));
        row.append(h("span", "craft-relation-meta", `B${target.size}`));
        row.addEventListener("click", () => select(output));
        usedList.append(row);
      }
      if (usedBy.length > 40) usedList.append(h("p", "craft-library-empty", `… và ${usedBy.length - 40} công thức khác. Dùng ô tìm kiếm để thu hẹp.`));
      usedSec.append(usedList);
      detail.append(usedSec);
    }
  };

  const addTier = (value: number, label: string) => {
    const b = kitButton({ skin: "wood", label, cls: "craft-filter-chip", onClick: () => {
      tier = value;
      for (const button of controls) button.setSelected(button === b);
      listScroll = 0;
      renderList();
    } });
    controls.push(b);
    b.setSelected(tier === value);
    chips.append(b.el);
  };
  addTier(0, "Tất cả");
  for (const size of [1, 2, 3] as const) addTier(size, `Bậc ${size}`);
  renderList();

  return {
    el: root,
    dispose() {
      for (const button of controls) button.dispose();
      controls = [];
      disposeSurfaceTree(root);
      root.remove();
    },
  };
}

export function openCraftLibraryModal(app: App): void {
  const modal = app.modals.open({ id: "craft-library", title: "Thư viện chế tạo", size: "full", closeLabel: "Đóng" });
  const view = createCraftLibrary(app, {
    tip: app.tooltip,
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
      view = createCraftLibrary(app, {
        tip: app.tooltip,
        onOpenItem: navigate.onOpenItem ?? ((itemId) => { overlay?.close(); openItemSheetOverlay(app, host, itemId); }),
      });
      body.append(view.el);
    },
  });
  return overlay;
}
