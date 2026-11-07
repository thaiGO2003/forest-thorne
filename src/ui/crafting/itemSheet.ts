// Item sheet shown from the crafting workbench. Read-only, keeps the workbench staged items intact.
import { BASE_MATERIALS, getEquipment } from "../../core/itemRegistry";
import { itemDisplayName } from "../../core/itemPresentation";
import { baseIngredients, recipeForOutput, recipeIngredients, recipesUsing } from "../../core/recipeGraph";
import { h, kitButton, panelEl } from "../kit";
import { itemArt } from "./art";
import { itemBonusLines, itemTypeLabel, specialLogicNote } from "./copy";

export interface ItemSheetOptions {
  onOpenLibrary: () => void;
  onSelect: (itemId: string) => void;
  onPlace?: () => void;
  onRemove?: () => void;
}

export function buildItemSheet(body: HTMLElement, itemId: string, options: ItemSheetOptions): void {
  const equipment = getEquipment(itemId);
  const recipe = recipeForOutput(itemId);
  const usedBy = recipesUsing(itemId);
  const hero = panelEl("panel_wood", "craft-item-hero");
  const portrait = panelEl("slot_well", "craft-item-portrait");
  portrait.append(itemArt(itemId, "craft-item-portrait-icon"));
  const copy = h("div", "craft-item-hero-copy");
  copy.append(
    h("span", "crafting-eyebrow", itemTypeLabel(itemId)),
    h("h3", "craft-item-hero-name", itemDisplayName(itemId)),
    h("p", "craft-item-hero-meta", equipment ? `Bậc ${equipment.tier} · ${itemBonusLines(itemId).join(" · ") || "Chưa có chỉ số"}` : "Nguyên liệu nền"),
  );
  hero.append(portrait, copy);
  body.append(hero);

  const actions = h("div", "craft-sheet-actions");
  if (options.onPlace) {
    const place = kitButton({ skin: "green", label: "Đặt vào bàn", cls: "craft-sheet-action", onClick: options.onPlace });
    actions.append(place.el);
  }
  if (options.onRemove) {
    const remove = kitButton({ skin: "red", label: "Lấy ra khỏi bàn", cls: "craft-sheet-action", onClick: options.onRemove });
    actions.append(remove.el);
  }
  const library = kitButton({ skin: "wood", label: "Thư viện chế tạo", cls: "craft-sheet-library", onClick: options.onOpenLibrary });
  actions.append(library.el);

  if (equipment) {
    const stats = panelEl("panel_parchment", "craft-sheet-sec");
    stats.append(h("h4", "", "Chỉ số cộng"));
    const bonus = itemBonusLines(itemId);
    for (const line of bonus.length ? bonus : ["Chưa có chỉ số cộng."]) stats.append(h("p", "craft-sheet-line", line));
    body.append(stats);
  }
  body.append(actions);

  if (recipe) {
    const recipeSec = panelEl("panel_parchment", "craft-sheet-sec");
    recipeSec.append(h("h4", "", "Công thức chế tạo"));
    recipeSec.append(buildMiniRecipe(recipe));
    const ingredients = h("div", "craft-sheet-lines");
    for (const ingredient of recipeIngredients(recipe)) {
      const row = h("button", "craft-relation-row");
      row.type = "button";
      row.append(itemArt(ingredient.id, "craft-relation-icon"));
      row.append(h("span", "craft-relation-name", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
      row.addEventListener("click", () => options.onSelect(ingredient.id));
      ingredients.append(row);
    }
    recipeSec.append(ingredients);
    body.append(recipeSec);

    const base = baseIngredients(itemId);
    if (base.length) {
      const baseSec = panelEl("panel_parchment", "craft-sheet-sec");
      baseSec.append(h("h4", "", "Nguyên liệu gốc"));
      const list = h("div", "craft-sheet-lines");
      for (const ingredient of base) {
        const row = h("div", "craft-base-row");
        row.append(itemArt(ingredient.id, "craft-relation-icon"));
        row.append(h("span", "", `${ingredient.count} × ${itemDisplayName(ingredient.id)}`));
        list.append(row);
      }
      baseSec.append(list);
      body.append(baseSec);
    }
  } else if ((BASE_MATERIALS as readonly string[]).includes(itemId)) {
    const baseSec = panelEl("panel_parchment", "craft-sheet-sec");
    baseSec.append(h("h4", "", "Nguyên liệu gốc"), h("p", "craft-sheet-line", "Nguyên liệu nền dùng để ghép thành trang bị trên bàn chế tạo."));
    body.append(baseSec);
  }

  if (usedBy.length) {
    const usedSec = panelEl("panel_parchment", "craft-sheet-sec");
    usedSec.append(h("h4", "", `Dùng trong ${usedBy.length} công thức`));
    const list = h("div", "craft-sheet-lines");
    for (const target of usedBy.slice(0, 12)) {
      const output = `eq_${target.id}`;
      const row = h("button", "craft-relation-row");
      row.type = "button";
      row.append(itemArt(output, "craft-relation-icon"));
      row.append(h("span", "craft-relation-name", itemDisplayName(output)));
      row.append(h("span", "craft-relation-meta", `Bậc ${target.size}`));
      row.addEventListener("click", () => options.onSelect(output));
      list.append(row);
    }
    if (usedBy.length > 12) list.append(h("p", "craft-sheet-line", `… và ${usedBy.length - 12} công thức khác. Mở Thư viện chế tạo để xem tất cả.`));
    usedSec.append(list);
    body.append(usedSec);
  }

  const logicNote = specialLogicNote(itemId);
  if (logicNote) {
    const note = panelEl("panel_parchment", "craft-sheet-sec craft-sheet-note");
    note.append(h("p", "craft-sheet-line", logicNote));
    body.append(note);
  }
}

export function buildMiniRecipe(recipe: ReturnType<typeof recipeForOutput>): HTMLElement {
  const wrap = h("div", "craft-mini-wrap");
  const grid = h("div", "craft-mini-grid");
  const pattern = recipe?.pattern ?? [];
  for (let index = 0; index < 9; index++) {
    const cell = panelEl("slot_well", "craft-mini-cell");
    const itemId = pattern[index] ?? null;
    if (itemId) cell.append(itemArt(itemId, "craft-mini-icon"));
    grid.append(cell);
  }
  wrap.append(grid);
  return wrap;
}
