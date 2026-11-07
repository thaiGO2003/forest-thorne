// Shared copy/tooltip helpers for the crafting workbench, item sheet and recipe library.
import { BASE_MATERIALS, getEquipment, type Recipe } from "../../core/itemRegistry";
import {
  equipmentBonusCopy, itemDisplayName, itemIconChar,
} from "../../core/itemPresentation";
import { recipeIngredients, recipesUsing } from "../../core/recipeGraph";
import type { TooltipContent, TooltipSection } from "../tooltip";

export const itemTypeLabel = (id: string): string =>
  (BASE_MATERIALS as readonly string[]).includes(id) ? "Nguyên liệu gốc" : "Trang bị";

export const itemBonusLines = (id: string): string[] => {
  const copy = equipmentBonusCopy(getEquipment(id)?.bonuses ?? {});
  return copy ? copy.split(" · ").filter(Boolean) : [];
};

export const usedByNames = (itemId: string): string[] =>
  recipesUsing(itemId).map((recipe) => itemDisplayName(`eq_${recipe.id}`));

export const recipeIngredientLines = (recipe: Recipe): string[] =>
  recipeIngredients(recipe).map((ingredient) => `${ingredient.count} × ${itemDisplayName(ingredient.id)}`);

export const recipeMissing = (recipe: Recipe, bag: Readonly<Record<string, number>>): string[] =>
  recipeIngredients(recipe)
    .filter((ingredient) => (bag[ingredient.id] ?? 0) < ingredient.count)
    .map((ingredient) => itemDisplayName(ingredient.id));

export const recipeCraftable = (recipe: Recipe, bag: Readonly<Record<string, number>>): boolean =>
  recipeMissing(recipe, bag).length === 0;

export const specialLogicNote = (id: string): string | null => {
  const logic = getEquipment(id)?.logic;
  return logic && Object.keys(logic).length
    ? "Hiệu ứng kích hoạt đặc biệt của bản classic chưa được mô phỏng trong bản dựng này."
    : null;
};

export function itemTooltipContent(itemId: string): TooltipContent {
  const equipment = getEquipment(itemId);
  const usedBy = usedByNames(itemId);
  const bonus = itemBonusLines(itemId);
  const sections: TooltipSection[] = [];
  if (equipment) {
    sections.push({ title: "Chỉ số", lines: bonus.length ? bonus : ["Chưa có chỉ số cộng."] });
  } else {
    sections.push({ title: "Nguyên liệu gốc", lines: ["Dùng để ghép thành trang bị trên bàn chế tạo."] });
  }
  if (usedBy.length) sections.push({ title: "Dùng trong", lines: usedBy.slice(0, 8) });
  return {
    title: itemDisplayName(itemId),
    subtitle: equipment ? `Bậc ${equipment.tier} · ${itemTypeLabel(itemId)}` : itemTypeLabel(itemId),
    icon: itemIconChar(itemId),
    description: equipment
      ? (specialLogicNote(itemId) ?? "Trang bị chế tạo từ công thức cổ.")
      : "Nguyên liệu nền của mọi công thức chế tạo.",
    lines: bonus.map((text) => ({ text })),
    sections,
  };
}
