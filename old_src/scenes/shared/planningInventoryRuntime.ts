import { CRAFT_RECIPES, ITEM_BY_ID, RECIPE_BY_ID } from "../../data/items.js";
import { PHASE } from "../../core/boardConstants.js";
import { UI_COLORS } from "../../core/uiTheme.js";
import { noteEndlessCraft } from "../../core/endlessAchievements.js";
import { t } from "../../i18n/index.js";

import { getPlanningCraftActiveIndices, getPlanningCraftGridSize, getPlanningCraftReservedCounts, getPlanningCraftResultRecipeId, getPlanningRecipeRequiredList } from "./planningCraftRuntime.js";
import { getPlanningBenchCap } from "./planningFormationRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningRightPanelScrollMetrics } from "./planningRightPanelRuntime.js";
import { persistPlanningProgress } from "./planningRunStateRuntime.js";

import { getPlanningEndlessAchievementSnapshot, planningUpdateEndlessAchievementProfile } from "./planningRunStateRuntime.js";
import { planningShouldShowCraftingInPlanning } from "./planningTechRuntime.js";

interface EndlessProfileLike { version: number; lastUpdatedAt: number; stats: Record<string, unknown>; [key: string]: unknown; }

interface FillStylable {
  setFillStyle(color: number, alpha?: number): unknown;
  setStrokeStyle(lineWidth: number, color: number, alpha?: number): unknown;
}

interface CellBg extends FillStylable {
  destroy(): void;
}

interface InventoryCell {
  bg: CellBg;
  icon: { setText(value: string): unknown; setColor(value: string): unknown; destroy(): void };
  count: { setText(value: string): unknown; destroy(): void };
  itemId: string | null;
  amount: number;
  index?: number;
}

interface CraftSlot {
  bg: CellBg;
  icon: { setText(value: string): unknown; setColor(value: string): unknown; destroy(): void };
  index: number;
}

interface RecipeSlot {
  bg: CellBg;
  icon: { setText(value: string): unknown; setColor(value: string): unknown; destroy(): void };
  countText: { setText(value: string): unknown; setColor(value: string): unknown; destroy(): void };
  recipeId: string | null;
}

interface PlanningInventoryPlayer {
  itemBag: string[];
  craftedItems: string[];
  bench: { length: number } & unknown[];
}

interface PlanningInventoryScene extends Phaser.Scene {
  storageSummaryText: { setText(value: string): unknown } | null | undefined;
  player: PlanningInventoryPlayer;
  inventoryPage: number | null | undefined;
  invPageMax: number | null | undefined;
  inventoryCells: InventoryCell[];
  craftInputSlots: CraftSlot[];
  craftGridItems: Array<string | null> | null | undefined;
  craftOutputSlot: {
    bg: FillStylable;
    icon: { setText(value: string): unknown; setColor(value: string): unknown };
  } | null | undefined;
  inventoryDockHeader: { relayout(opts: { infoText?: string; infoVisible?: boolean }): unknown } | null | undefined;
  storageCraftText: { setText(value: string): unknown; setFixedSize?(w: number, h: number): unknown } | null | undefined;
  craftTitleText: { setText(value: string): unknown } | null | undefined;
  craftHintText: { setText(value: string): unknown } | null | undefined;
  invPrevBtn: { setEnabled(enabled: boolean): unknown } | null | undefined;
  invNextBtn: { setEnabled(enabled: boolean): unknown } | null | undefined;
  recipeSuggestionSlots: RecipeSlot[] | null | undefined;
  recipeSuggestionHeader: { relayout(opts: { infoText?: string; infoVisible?: boolean }): unknown } | null | undefined;
  recipeSuggestionPageMax: number;
  recipeSuggestionPage: number | null | undefined;
  recipeSuggestPrevBtn: { setEnabled(enabled: boolean): unknown } | null | undefined;
  recipeSuggestNextBtn: { setEnabled(enabled: boolean): unknown } | null | undefined;
  phase: string;
  settingsVisible: boolean;
  audioFx: { play: (key: string) => void };
  [key: string]: unknown;
}

export function refreshPlanningStorageUi(scene: PlanningInventoryScene): void {
  if (!scene.storageSummaryText) return;

  const bagCountsRaw: Record<string, number> = {};
  scene.player.itemBag.forEach((id) => {
    bagCountsRaw[id] = (bagCountsRaw[id] ?? 0) + 1;
  });
  const reservedCounts = getPlanningCraftReservedCounts(scene as unknown as Parameters<typeof getPlanningCraftReservedCounts>[0]);
  const bagCounts: Record<string, number> = {};
  Object.keys(bagCountsRaw).forEach((id) => {
    const available = (bagCountsRaw[id] ?? 0) - (reservedCounts[id] ?? 0);
    if (available > 0) bagCounts[id] = available;
  });

  const craftedText = scene.player.craftedItems
    .slice(-3)
    .map((id) => {
      const recipe = RECIPE_BY_ID[id];
      return `${recipe?.icon ?? "✨"} ${recipe?.name ?? id}`;
    })
    .join(", ");

  const tableSize = getPlanningCraftGridSize(scene as unknown as Parameters<typeof getPlanningCraftGridSize>[0]);
  const activeCraftSlots = new Set(getPlanningCraftActiveIndices(scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0]));
  const maxPage = scene.invPageMax || 0;

  const storageSummary = t("planning.inventory.summary", { benchCount: scene.player.bench.length, benchCap: getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0]), bagCount: scene.player.itemBag.length, page: maxPage > 0 ? t("planning.inventory.page", { current: (scene.inventoryPage || 0) + 1, total: maxPage + 1 }) : "" });
  if (scene.inventoryDockHeader) {
    scene.inventoryDockHeader.relayout({
      infoText: storageSummary,
      infoVisible: true
    });
  } else {
    scene.storageSummaryText.setText(storageSummary);
  }

  scene.invPrevBtn?.setEnabled((scene.inventoryPage || 0) > 0);
  scene.invNextBtn?.setEnabled((scene.inventoryPage || 0) < maxPage);

  if (planningShouldShowCraftingInPlanning(scene as unknown as Parameters<typeof planningShouldShowCraftingInPlanning>[0]) === false) {
    scene.storageCraftText?.setText(`• ${t("fortress.blacksmithInlineLocked")}`);
  } else {
    scene.storageCraftText?.setText(t("planning.inventory.craftedList", { items: craftedText || t("planning.ui.none") }));
  }
  scene.craftTitleText?.setText(t("planning.craft.titleWithSize", { size: `${tableSize}x${tableSize}` }));

  const bagEntries = Object.entries(bagCounts).sort((a, b) => b[1] - a[1]);
  const pageOffset = (scene.inventoryPage || 0) * scene.inventoryCells.length;
  scene.inventoryCells.forEach((cell, idx) => {
    const pair = bagEntries[pageOffset + idx];
    if (!pair) {
      cell.itemId = null;
      cell.amount = 0;
      cell.bg.setFillStyle(0x162639, 0.95);
      cell.bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.78);
      cell.icon.setText("+");
      cell.icon.setColor(UI_COLORS.textMuted);
      cell.count.setText("");
      return;
    }
    const [itemId, amount] = pair as [string, number];
    const item = ITEM_BY_ID[itemId];
    cell.itemId = itemId;
    cell.amount = amount;
    cell.bg.setFillStyle(0x203450, 0.96);
    cell.bg.setStrokeStyle(1, UI_COLORS.panelEdge, 0.85);
    cell.icon.setText(item?.icon ?? "❔");
    cell.icon.setColor("#ffffff");
    cell.count.setText(`x${amount}`);
  });

  scene.craftInputSlots.forEach((slot) => {
    const enabled = activeCraftSlots.has(slot.index);
    if (!enabled) {
      slot.bg.setFillStyle(0x0f1b2a, 0.65);
      slot.bg.setStrokeStyle(1, 0x2a3b4d, 0.55);
      slot.icon.setText("🔒");
      slot.icon.setColor("#5d7084");
      return;
    }
    const itemId = scene.craftGridItems?.[slot.index] ?? null;
    if (!itemId) {
      slot.bg.setFillStyle(0x162639, 0.96);
      slot.bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.78);
      slot.icon.setText("·");
      slot.icon.setColor(UI_COLORS.textMuted);
      return;
    }
    const item = ITEM_BY_ID[itemId];
    slot.bg.setFillStyle(0x203450, 0.96);
    slot.bg.setStrokeStyle(1, UI_COLORS.panelEdge, 0.85);
    slot.icon.setText(item?.icon ?? "❔");
    slot.icon.setColor("#ffffff");
  });

  const resultRecipeId = getPlanningCraftResultRecipeId(scene as unknown as Parameters<typeof getPlanningCraftResultRecipeId>[0]);
  if (scene.craftOutputSlot?.bg && scene.craftOutputSlot?.icon) {
    if (resultRecipeId) {
      const recipe = RECIPE_BY_ID[resultRecipeId];
      scene.craftOutputSlot.bg.setFillStyle(0x2a4563, 0.96);
      scene.craftOutputSlot.bg.setStrokeStyle(1, UI_COLORS.accent, 0.95);
      scene.craftOutputSlot.icon.setText(recipe?.icon ?? "✨");
      scene.craftOutputSlot.icon.setColor("#ffffff");
      scene.craftHintText?.setText(t("planning.craft.matchHint", { name: recipe?.name ?? resultRecipeId }));
    } else {
      scene.craftOutputSlot.bg.setFillStyle(0x1e2f42, 0.95);
      scene.craftOutputSlot.bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.8);
      scene.craftOutputSlot.icon.setText("?");
      scene.craftOutputSlot.icon.setColor(UI_COLORS.textMuted);
      const lockedCount = tableSize >= 3 ? 0 : tableSize >= 2 ? 5 : 8;
      scene.craftHintText?.setText(
        lockedCount > 0
          ? t("planning.craft.dragHintLocked", { size: `${tableSize}x${tableSize}`, count: lockedCount })
          : t("planning.craft.dragHint", { size: `${tableSize}x${tableSize}` })
      );
    }
  }

  refreshPlanningRightPanelScrollMetrics(scene as unknown as Parameters<typeof refreshPlanningRightPanelScrollMetrics>[0]);

  if (scene.recipeSuggestionSlots?.length) {
    const bagCountsFull: Record<string, number> = {};
    scene.player.itemBag.forEach((id) => {
      bagCountsFull[id] = (bagCountsFull[id] ?? 0) + 1;
    });

    type ScoredRecipe = { recipe: typeof CRAFT_RECIPES[number]; haveCount: number; total: number; ratio: number };
    const scored = CRAFT_RECIPES.map<ScoredRecipe | null>((recipe) => {
      const requires = recipe.requires ?? [];
      if (!requires.length) return null;
      const needMap: Record<string, number> = {};
      requires.forEach((id) => {
        needMap[id] = (needMap[id] ?? 0) + 1;
      });
      let haveCount = 0;
      Object.entries(needMap).forEach(([id, needed]) => {
        haveCount += Math.min(bagCountsFull[id] ?? 0, needed);
      });
      const ratio = haveCount / requires.length;
      return { recipe, haveCount, total: requires.length, ratio };
    }).filter((entry): entry is ScoredRecipe => entry !== null && entry.ratio > 0);

    scored.sort((a, b) => {
      const aCraftable = a.ratio >= 1 ? 1 : 0;
      const bCraftable = b.ratio >= 1 ? 1 : 0;
      if (bCraftable !== aCraftable) return bCraftable - aCraftable;
      const tierDiff = (b.recipe.tier ?? 1) - (a.recipe.tier ?? 1);
      if (tierDiff !== 0) return tierDiff;
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      if (b.haveCount !== a.haveCount) return b.haveCount - a.haveCount;
      return String(a.recipe.name ?? "").localeCompare(String(b.recipe.name ?? ""));
    });

    const suggestPageSize = scene.recipeSuggestionSlots.length;
    const suggestMaxPage = Math.max(0, Math.ceil(scored.length / suggestPageSize) - 1);
    scene.recipeSuggestionPageMax = suggestMaxPage;
    if ((scene.recipeSuggestionPage || 0) > suggestMaxPage) scene.recipeSuggestionPage = suggestMaxPage;
    const suggestPage = scene.recipeSuggestionPage || 0;
    const suggestOffset = suggestPage * suggestPageSize;

    const recipeSuggestionInfo = suggestMaxPage > 0 ? `Trang ${suggestPage + 1}/${suggestMaxPage + 1}` : "";
    if (scene.recipeSuggestionHeader) {
      scene.recipeSuggestionHeader.relayout({
        infoText: recipeSuggestionInfo,
        infoVisible: suggestMaxPage > 0
      });
    }
    scene.recipeSuggestPrevBtn?.setEnabled(suggestPage > 0);
    scene.recipeSuggestNextBtn?.setEnabled(suggestPage < suggestMaxPage);

    scene.recipeSuggestionSlots.forEach((slot, idx) => {
      const entry = scored[suggestOffset + idx];
      if (!entry) {
        slot.recipeId = null;
        slot.bg.setFillStyle(0x162639, 0.6);
        slot.bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.4);
        slot.icon.setText("");
        slot.countText.setText("");
        return;
      }
      slot.recipeId = entry.recipe.id;
      slot.icon.setText(entry.recipe.icon ?? "✨");
      slot.icon.setColor("#ffffff");
      slot.countText.setText(`${entry.haveCount}/${entry.total}`);

      if (entry.ratio >= 1) {
        slot.bg.setFillStyle(0x1a3a2a, 0.95);
        slot.bg.setStrokeStyle(1, 0x4caf50, 0.95);
        slot.countText.setColor("#8bffd7");
      } else if (entry.ratio >= 0.5) {
        slot.bg.setFillStyle(0x2a2a1a, 0.95);
        slot.bg.setStrokeStyle(1, 0xd4a017, 0.85);
        slot.countText.setColor("#ffe599");
      } else {
        slot.bg.setFillStyle(0x1a2233, 0.9);
        slot.bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.65);
        slot.countText.setColor(UI_COLORS.textSecondary);
      }
    });
  }
}

export function craftPlanningItem(scene: PlanningInventoryScene, recipeId: string): void {
  if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return;
  const equipmentId = `eq_${recipe.id}`;
  const equipment = ITEM_BY_ID[equipmentId];
  if (!equipment) {
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.missingEquipmentData", { name: recipe.name }));
    return;
  }

  const bagCopy = [...scene.player.itemBag];
  const required = getPlanningRecipeRequiredList(scene as unknown as Parameters<typeof getPlanningRecipeRequiredList>[0], recipe);
  for (let index = 0; index < required.length; index += 1) {
    const matchIndex = bagCopy.indexOf(required[index]);
    if (matchIndex < 0) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.missingItems", { name: recipe.name }));
      return;
    }
    bagCopy.splice(matchIndex, 1);
  }

  bagCopy.push(equipmentId);
  scene.player.itemBag = bagCopy;
  scene.player.craftedItems.push(recipe.id);
  scene.audioFx.play("buy");
  addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.craftedSuccess", { icon: recipe.icon, name: recipe.name }));
  planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], (profile) => noteEndlessCraft(
    profile as unknown as Parameters<typeof noteEndlessCraft>[0],
    1,
    getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
  ) as unknown as EndlessProfileLike);

  refreshPlanningStorageUi(scene);
  persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}
