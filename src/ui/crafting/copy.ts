// Shared copy/tooltip helpers for the crafting workbench, item sheet and recipe library.
import { BASE_MATERIALS, getEquipment, type Recipe } from "../../core/itemRegistry";
import {
  equipmentBonusCopy, itemDisplayName, itemIconChar,
} from "../../core/itemPresentation";
import { isRecipeCraftable, missingIngredients, recipeIngredients, recipesUsing } from "../../core/recipeGraph";
import { equipmentLogicSummary, readTrigger } from "../../core/equipmentLogic";
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
  missingIngredients(recipe, bag).map((ingredient) => itemDisplayName(ingredient.id));

export const recipeCraftable = (recipe: Recipe, bag: Readonly<Record<string, number>>): boolean =>
  isRecipeCraftable(recipe, bag);

/**
 * Authored `logic` note (issue #31): list the effects combat actually executes for this item, and
 * keep an explicit warning only when the payload carries triggers/fields without an equivalent yet.
 */
export const specialLogicNote = (id: string): string | null => {
  const logic = getEquipment(id)?.logic;
  if (!logic || !Object.keys(logic).length) return null;
  const active = equipmentLogicSummary([id]);
  const trigger = readTrigger(logic);
  const executed = trigger === "passive" || trigger === "onHit" || trigger === "onSkillUse" || trigger === "combatStart";
  if (!active.length) return "Hiệu ứng kích hoạt của bản classic chưa có cơ chế tương đương trong bản dựng này.";
  return executed
    ? active.join(" · ")
    : `${active.join(" · ")} (một phần hiệu ứng gốc chưa được mô phỏng)`;
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
