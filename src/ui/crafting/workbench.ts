import type { App } from "../../app/app";
import { activeIndices, BASE_MATERIALS, matchRecipe, RECIPES, type Recipe } from "../../core/craft";
import { getLocale } from "../../core/i18n";
import { itemDisplayName } from "../../core/itemPresentation";
import { ICONS } from "../../core/emojiIcon";
import { disposeSurfaceTree, h, kitButton, nineSlice, panelEl, SLICE, surface, type KitButton } from "../kit";

const ITEM_ASSETS = new Set<string>([...BASE_MATERIALS, "eq_blue_buff", "eq_warmog_armor"]);

function itemArt(id: string, cls: string): HTMLElement {
  if (!ITEM_ASSETS.has(id)) return h("span", cls, ICONS.question);
  const image = h("img", cls);
  image.src = `${import.meta.env.BASE_URL}assets/items/${id}.svg`;
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  return image;
}

function countItems(items: readonly (string | null)[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) if (item) result.set(item, (result.get(item) ?? 0) + 1);
  return result;
}

function recipeStaging(recipe: Recipe, level: number): (string | null)[] | null {
  const active = activeIndices(level);
  const side = Math.round(Math.sqrt(active.length));
  if (recipe.size > side || !side) return null;
  const result: (string | null)[] = Array(9).fill(null);
  for (let row = 0; row < recipe.size; row++) {
    for (let col = 0; col < recipe.size; col++) {
      const cell = active[row * side + col];
      if (cell !== undefined) result[cell] = recipe.pattern[row * recipe.size + col] ?? null;
    }
  }
  return result;
}

export function mountCraftWorkbench(app: App, host: HTMLElement): { dispose(): void } {
  const root = h("div", "crafting-workbench");
  host.append(root);
  let selected: string | null = null;
  let feedback = "";
  let controls: KitButton[] = [];
  let disposed = false;
  const copy = (vi: string, en: string) => getLocale() === "vi" ? vi : en;

  const button = (skin: "green" | "red" | "blue" | "wood" | "plum", label: string, action: () => void, cls: string, disabled = false) => {
    const b = kitButton({ skin, label, cls, onClick: action });
    b.setDisabled(disabled);
    controls.push(b);
    return b.el;
  };

  const report = (message: string) => {
    feedback = message;
    render();
  };

  const clear = () => {
    const staged = app.bridge.craftStaging();
    let failed = false;
    for (let i = 0; i < staged.length; i++) {
      if (staged[i] && !app.bridge.stageCraft(i, null)) failed = true;
    }
    report(failed
      ? copy("Một số ô chưa được dọn. Hãy kiểm tra bước hướng dẫn.", "Some slots could not be cleared. Check the tutorial step.")
      : copy("Đã dọn bàn ghép.", "Workbench cleared."));
  };

  const placeRecipe = (recipe: Recipe) => {
    const run = app.bridge.run();
    if (!run) return;
    const target = recipeStaging(recipe, run.craftTableLevel);
    if (!target) {
      report(copy("Cần nâng cấp bàn ghép để dùng công thức này.", "Upgrade the workbench to use this recipe."));
      return;
    }
    const bagCounts = countItems(run.itemBag);
    const needs = countItems(target);
    if ([...needs].some(([id, quantity]) => (bagCounts.get(id) ?? 0) < quantity)) {
      report(copy("Chưa đủ nguyên liệu cho công thức.", "Not enough ingredients for this recipe."));
      return;
    }
    const current = app.bridge.craftStaging();
    for (let i = 0; i < 9; i++) {
      if (current[i] && current[i] !== target[i] && !app.bridge.stageCraft(i, null)) {
        report(copy("Không thể dọn ô lúc này. Kiểm tra hướng dẫn.", "Cannot clear this slot during the current tutorial step."));
        return;
      }
    }
    for (let i = 0; i < 9; i++) {
      if (target[i] && app.bridge.craftStaging()[i] !== target[i] && !app.bridge.stageCraft(i, target[i])) {
        report(copy("Chưa thể đặt đủ nguyên liệu. Kiểm tra hướng dẫn.", "Cannot place all ingredients during this tutorial step."));
        return;
      }
    }
    selected = null;
    report(copy("Đã xếp nguyên liệu theo công thức.", "Ingredients placed using the recipe."));
  };

  const useCell = (index: number) => {
    const run = app.bridge.run();
    if (!run || run.phase !== "PLANNING") return;
    const staged = app.bridge.craftStaging();
    const previous = staged[index];
    const desired = previous && (!selected || selected === previous) ? null : selected;
    if (!desired && !previous) {
      report(copy("Chọn nguyên liệu từ túi bên phải trước.", "Choose an ingredient from the bag first."));
      return;
    }
    if (desired) {
      const remaining = (countItems(run.itemBag).get(desired) ?? 0) - (countItems(staged).get(desired) ?? 0) + (previous === desired ? 1 : 0);
      if (remaining <= 0) {
        report(copy("Nguyên liệu này đã được dùng hết trên bàn.", "All copies of this ingredient are already staged."));
        return;
      }
    }
    if (!app.bridge.stageCraft(index, desired)) {
      report(copy("Không thể thao tác ô này ở bước hiện tại.", "This slot is unavailable in the current step."));
      return;
    }
    feedback = desired
      ? copy(`Đã đặt ${itemDisplayName(desired)}.`, `Placed ${itemDisplayName(desired)}.`)
      : copy("Đã lấy nguyên liệu về túi.", "Ingredient returned to the bag.");
    render();
  };

  const render = () => {
    if (disposed) return;
    for (const b of controls) b.dispose();
    controls = [];
    disposeSurfaceTree(root);
    root.replaceChildren();
    const run = app.bridge.run();
    if (!run) {
      const empty = panelEl("panel_parchment", "crafting-empty");
      empty.append(h("h2", "", copy("Chưa có lượt chơi", "No active run")), h("p", "", copy("Vào trận để mở bàn chế tạo.", "Enter a run to open the workbench.")));
      root.append(empty);
      return;
    }

    const level = run.craftTableLevel;
    const active = new Set(activeIndices(level));
    const staged = app.bridge.craftStaging();
    const stagedCounts = countItems(staged);
    const bagCounts = countItems(run.itemBag);
    const matched = matchRecipe([...staged], level);
    const planning = run.phase === "PLANNING";
    const matchesOwned = [...stagedCounts].every(([id, count]) => (bagCounts.get(id) ?? 0) >= count);
    const ready = planning && !!matched && matchesOwned;

    const hero = panelEl("panel_wood", "crafting-hero");
    const heading = h("div", "crafting-hero-heading");
    heading.append(h("span", "crafting-eyebrow", copy("XƯỞNG RÈN · CÔNG THỨC CỔ", "FORGE · ANCIENT RECIPES")), h("h2", "", copy("Bàn chế tạo", "Crafting workbench")));
    const rank = panelEl("shell_billboard", "crafting-rank");
    rank.append(h("span", "", copy("CẤP BÀN", "TABLE LEVEL")), h("strong", "", level ? `${level} / 3` : copy("CHƯA MỞ", "LOCKED")));
    hero.append(heading, rank);
    root.append(hero);

    const columns = h("div", "crafting-columns");
    const left = panelEl("panel_wood", "crafting-bench");
    const benchHeading = h("div", "crafting-section-heading");
    const benchTitle = h("div", "");
    benchTitle.append(h("span", "crafting-eyebrow", copy("KHU VỰC CHẾ TẠO", "CRAFTING AREA")), h("h3", "", copy("Bàn ghép nguyên liệu", "Ingredient grid")));
    benchHeading.append(benchTitle, h("span", "crafting-counter", `${active.size} / 9 ${copy("ô mở", "unlocked")}`));
    left.append(benchHeading);

    const board = panelEl("panel_parchment", "crafting-board");
    const boardGrid = h("div", "crafting-grid");
    for (let index = 0; index < 9; index++) {
      const unlocked = active.has(index);
      const id = staged[index];
      const cell = h("button", "crafting-cell");
      cell.type = "button";
      cell.dataset.cell = String(index);
      cell.dataset.locked = String(!unlocked);
      cell.disabled = !unlocked || !planning;
      cell.setAttribute("aria-label", !unlocked
        ? copy(`Ô ${index + 1} bị khóa`, `Slot ${index + 1} locked`)
        : id
          ? copy(`Ô ${index + 1}: ${itemDisplayName(id)}. Nhấn để thay hoặc lấy ra`, `Slot ${index + 1}: ${itemDisplayName(id)}. Activate to replace or remove`)
          : copy(`Ô ${index + 1} trống. Nhấn để đặt nguyên liệu`, `Slot ${index + 1} empty. Activate to place an ingredient`));
      surface(cell, (g, w, height) => nineSlice(g, !unlocked ? "btn_wood_disabled" : id ? "btn_blue_selected" : "slot_well", !unlocked || id ? SLICE.btn : SLICE.slot_well, 0, 0, w, height));
      if (id) cell.append(itemArt(id, "crafting-cell-icon"));
      else if (!unlocked) {
        const lock = h("span", "crafting-lock", ICONS.lock);
        lock.setAttribute("aria-hidden", "true");
        cell.append(lock);
      } else cell.append(h("span", "crafting-cell-plus", "+"));
      if (unlocked) {
        const slotNumber = h("span", "crafting-slot-number", String(index + 1));
        slotNumber.setAttribute("aria-hidden", "true");
        cell.append(slotNumber);
        cell.addEventListener("click", () => useCell(index));
      }
      boardGrid.append(cell);
    }
    board.append(boardGrid);
    left.append(board);
    left.append(h("p", "crafting-hint", level === 0
      ? copy("Bàn chế tạo chưa được mở. Nâng cấp công nghệ để bắt đầu.", "Unlock the crafting table through research to begin.")
      : copy("Chọn nguyên liệu ở túi rồi chạm vào ô. Chạm lại ô đã đặt để lấy ra.", "Select an ingredient, then tap a slot. Tap a filled slot to take it back.")));
    const benchActions = h("div", "crafting-bench-actions");
    benchActions.append(button("wood", copy("Dọn bàn", "Clear grid"), clear, "crafting-clear", !planning || !staged.some(Boolean)));
    left.append(benchActions);

    const right = h("div", "crafting-side");
    const inventory = panelEl("panel_parchment", "crafting-inventory");
    const invHead = h("div", "crafting-section-heading");
    const invTitle = h("div", "");
    invTitle.append(h("span", "crafting-eyebrow", copy("CHỌN NGUYÊN LIỆU", "SELECT INGREDIENTS")), h("h3", "", copy("Túi nguyên liệu", "Ingredient bag")));
    invHead.append(invTitle, h("span", "crafting-counter", `${run.itemBag.length} ${copy("vật phẩm", "items")}`));
    inventory.append(invHead);
    const items = h("div", "crafting-items");
    const distinctIds = [...bagCounts.keys()].sort((a, b) => {
      const ai = BASE_MATERIALS.indexOf(a as typeof BASE_MATERIALS[number]);
      const bi = BASE_MATERIALS.indexOf(b as typeof BASE_MATERIALS[number]);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
    });
    for (const id of distinctIds) {
      const remaining = (bagCounts.get(id) ?? 0) - (stagedCounts.get(id) ?? 0);
      const item = h("button", "crafting-item");
      item.type = "button";
      item.dataset.item = id;
      item.disabled = !planning || remaining <= 0;
      item.setAttribute("aria-pressed", String(selected === id));
      item.setAttribute("aria-label", `${itemDisplayName(id)}, ${remaining} ${copy("còn lại", "available")}`);
      surface(item, (g, w, height) => nineSlice(g, selected === id ? "btn_blue_selected" : "slot_well", selected === id ? SLICE.btn : SLICE.slot_well, 0, 0, w, height));
      item.append(itemArt(id, "crafting-item-icon"), h("strong", "crafting-item-name", itemDisplayName(id)), h("span", "crafting-item-count", `×${remaining}`));
      item.addEventListener("click", () => {
        selected = selected === id ? null : id;
        feedback = selected
          ? copy(`Đã chọn ${itemDisplayName(id)}. Chạm vào ô để đặt.`, `Selected ${itemDisplayName(id)}. Tap a slot to place it.`)
          : copy("Đã bỏ chọn nguyên liệu.", "Ingredient deselected.");
        render();
      });
      items.append(item);
    }
    if (!distinctIds.length) items.append(h("p", "crafting-muted", copy("Túi đang trống. Thu thập nguyên liệu trong trận.", "Your bag is empty. Collect ingredients during the run.")));
    inventory.append(items);
    const selectedLine = h("p", "crafting-selection", selected
      ? copy(`Đang cầm: ${itemDisplayName(selected)}`, `Holding: ${itemDisplayName(selected)}`)
      : copy("Chọn một vật phẩm để bắt đầu ghép.", "Choose an item to start crafting."));
    inventory.append(selectedLine);
    right.append(inventory);

    const recipes = panelEl("panel_parchment", "crafting-recipes");
    recipes.append(h("span", "crafting-eyebrow", copy("SỔ TAY CHẾ TẠO", "RECIPE JOURNAL")), h("h3", "", copy("Công thức đã biết", "Known recipes")));
    for (const recipe of RECIPES) {
      const outcome = `eq_${recipe.id}`;
      const target = recipeStaging(recipe, level);
      const requirement = countItems(recipe.pattern);
      const hasEnough = [...requirement].every(([id, n]) => (bagCounts.get(id) ?? 0) >= n);
      const recipeRow = h("div", "crafting-recipe-row");
      recipeRow.append(itemArt(outcome, "crafting-recipe-icon"));
      const recipeInfo = h("div", "crafting-recipe-copy");
      recipeInfo.append(h("strong", "", itemDisplayName(outcome)));
      const materials = [...requirement].map(([id, n]) => `${n} × ${itemDisplayName(id)}`).join(" + ");
      recipeInfo.append(h("small", "", materials || copy("Công thức trống", "Empty recipe")));
      recipeRow.append(recipeInfo, button("blue", copy("Xếp nhanh", "Auto-fill"), () => placeRecipe(recipe), "crafting-autofill", !planning || !target || !hasEnough));
      recipes.append(recipeRow);
    }
    if (!RECIPES.length) recipes.append(h("p", "", copy("Chưa có công thức được mở.", "No recipes unlocked yet.")));
    right.append(recipes);

    const bottom = panelEl("panel_wood", "crafting-result");
    const resultPreview = panelEl("slot_well", "crafting-result-icon");
    if (matched) resultPreview.append(itemArt(`eq_${matched.id}`, "crafting-result-image"));
    else resultPreview.append(h("span", "crafting-result-placeholder", ICONS.question));
    const resultInfo = h("div", "crafting-result-info");
    resultInfo.append(h("span", "crafting-eyebrow", copy("VẬT PHẨM SẼ NHẬN", "CRAFTED OUTPUT")));
    resultInfo.append(h("h3", "", matched ? itemDisplayName(`eq_${matched.id}`) : copy("Chưa tìm thấy công thức", "No matching recipe")));
    resultInfo.append(h("p", "", matched
      ? copy("Công thức hợp lệ. Sẵn sàng chế tạo!", "Recipe matched. Ready to craft!")
      : copy("Xếp nguyên liệu đúng công thức để xem thành phẩm.", "Arrange ingredients into a valid recipe to preview the result.")));
    const resultAction = button("green", copy("Chế tạo", "Craft"), () => {
      const crafted = app.bridge.craft();
      if (crafted) {
        selected = null;
        report(copy(`Đã chế tạo ${itemDisplayName(crafted)}!`, `Crafted ${itemDisplayName(crafted)}!`));
      } else report(copy("Chưa thể chế tạo. Hãy kiểm tra công thức và bước hướng dẫn.", "Crafting unavailable. Check the recipe and tutorial step."));
    }, "crafting-submit", !ready);
    bottom.append(resultPreview, resultInfo, resultAction);
    const announcement = h("p", "crafting-feedback", feedback || (planning
      ? copy("Nguyên liệu chỉ tiêu hao khi chế tạo thành công.", "Ingredients are consumed only after a successful craft.")
      : copy("Chỉ có thể chế tạo trong giai đoạn chuẩn bị.", "Crafting is available during planning only.")));
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", "polite");
    right.append(bottom, announcement);
    columns.append(left, right);
    root.append(columns);
  };

  const off = app.bridge.onChange(render);
  render();
  return {
    dispose() {
      disposed = true;
      off();
      for (const b of controls) b.dispose();
      controls = [];
      disposeSurfaceTree(root);
      root.remove();
    },
  };
}
