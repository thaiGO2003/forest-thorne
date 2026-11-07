type PhaserEventHandler = (...args: unknown[]) => void;
import { t } from "../../i18n/index.js";
import { ITEM_BY_ID, RECIPE_BY_ID } from "../../data/items.js";
import { PHASE } from "../../core/boardConstants.js";
import { EMOJI_FONT, UI_COLORS, UI_FONT, UI_SPACING } from "../../core/uiTheme.js";
import { scaleFontPx, scaleUiSize } from "../../core/uiResponsive.js";
import { createPlanningDockHeader, computePlanningDockHeaderLayout } from "./planningDockHeaderLayout.js";
import { computePlanningLowerDockPanelLayout } from "./planningLowerDockPanelLayout.js";
import { computePlanningStorageCraftLayout } from "./planningStorageCraftLayout.js";

import { clearPlanningCraftGridSlot, craftFromPlanningGrid, getPlanningCraftActiveIndices, getPlanningCraftResultRecipeId, populatePlanningCraftGridFromRecipe } from "./planningCraftRuntime.js";
import { changePlanningInvPage, changePlanningRecipeSuggestionPage } from "./planningRefreshUiRuntime.js";
import { openPlanningLibraryRecipeDetail } from "./planningSettingsRuntime.js";

import { addItemToPlanningCraftGrid } from "./planningCraftRuntime.js";
import { ensurePlanningLowerDockPanels } from "./planningLowerDockRuntime.js";
import { planningShouldShowCraftingInPlanning } from "./planningTechRuntime.js";
import { guardPlanningTutorialAction } from "./planningTutorialRuntime.js";

interface InventoryCell {
  bg: { destroy: () => void; setStrokeStyle?: (...args: unknown[]) => unknown; setDepth?: (v: number) => unknown; setInteractive?: (...args: unknown[]) => unknown; on?: (event: string, listener: PhaserEventHandler) => unknown };
  icon: { destroy: () => void; setDepth?: (v: number) => unknown };
  count: { destroy: () => void; setDepth?: (v: number) => unknown; setOrigin?: (x: number, y?: number) => unknown };
  itemId: string | null;
  amount: number;
  index: number;
}

interface CraftSlot {
  bg: { destroy: () => void; setStrokeStyle?: (...args: unknown[]) => unknown; setDepth?: (v: number) => unknown; setInteractive?: (...args: unknown[]) => unknown; on?: (event: string, listener: PhaserEventHandler) => unknown };
  icon: { destroy: () => void; setDepth?: (v: number) => unknown; setOrigin?: (x: number, y?: number) => unknown };
  index: number;
}

interface RecipeSlot {
  bg: { destroy: () => void; setStrokeStyle?: (...args: unknown[]) => unknown; setDepth?: (v: number) => unknown; setInteractive?: (...args: unknown[]) => unknown; on?: (event: string, listener: PhaserEventHandler) => unknown };
  icon: { destroy: () => void; setDepth?: (v: number) => unknown; setOrigin?: (x: number, y?: number) => unknown };
  countText: { destroy: () => void; setDepth?: (v: number) => unknown; setOrigin?: (x: number, y?: number) => unknown };
  recipeId: string | null;
}

interface StoragePointerLike {
  rightButtonDown?: () => boolean;
  leftButtonDown?: () => boolean;
  button?: number;
  event?: { button?: number; stopPropagation?: () => void } | null;
  x: number;
  y: number;
}

interface StorageLayoutEx {
  compactHud?: boolean;
  invCellSize: number;
  craftInnerPad?: number;
  sidePanelW: number;
  sidePanelH: number;
  sidePanelX: number;
  sidePanelY: number;
  [key: string]: unknown;
}

interface PlanningStorageScene extends Phaser.Scene {
  layout: StorageLayoutEx;
  add: Phaser.GameObjects.GameObjectFactory;
  player: { inventoryUpgradeLevel?: number; inventoryBonus?: number; bench: unknown[]; [key: string]: unknown };
  inventoryPage: number;
  invPageMax: number;
  inventoryCells: InventoryCell[];
  craftInputSlots: CraftSlot[];
  recipeSuggestionSlots: RecipeSlot[];
  craftOutputSlot: { bg: { destroy: () => void }; icon: { destroy: () => void } } | null;
  inventoryDockHeader: { destroy: () => void; titleText: unknown; infoText: unknown; prevBtn: unknown; nextBtn: unknown } | null;
  storageLeftBg: { destroy: () => void } | null;
  storageRightBg: { destroy: () => void } | null;
  storageTitleText: unknown;
  storageSummaryText: unknown;
  invPrevBtn: unknown;
  invNextBtn: unknown;
  craftTitleText: { destroy: () => void } | null;
  craftHintText: { destroy: () => void } | null;
  recipeSuggestionHeader: { destroy: () => void } | null;
  recipeSuggestionTitle: unknown;
  recipeSuggestionInfoText: unknown;
  recipeSuggestPrevBtn: unknown;
  recipeSuggestNextBtn: unknown;
  recipeSuggestionPageMax: number;
  recipeSuggestionPage: number;
  logOverlayBg: { destroy: () => void; setStrokeStyle?: (...args: unknown[]) => unknown } | null;
  logHistoryIcon: { destroy: () => void } | null;
  logText: { destroy: () => void; setFixedSize: (w: number, h: number) => unknown; setFontFace?: (...args: unknown[]) => unknown } | null;
  storageCraftText: { destroy: () => void; setFixedSize: (w: number, h: number) => unknown; setFontFace?: (...args: unknown[]) => unknown } | null;
  historyModalVisible: boolean;
  versionInfoVisible: boolean;
  libraryModal?: { isOpen: () => boolean } | null;
  settingsVisible: boolean;
  phase: string;
  itemPointerDown: { cell: InventoryCell; x: number; y: number } | null;
  craftGridItems: (string | null)[];
  tooltip: { attach: (target: unknown, getter: () => unknown) => void };
  [key: string]: unknown;
}
function isRightClickPointer(pointer: StoragePointerLike): boolean {
  return Boolean(pointer?.rightButtonDown?.() || pointer?.button === 2 || pointer?.event?.button === 2);
}

function destroyInventoryCells(scene: PlanningStorageScene): void {
  if (!scene.inventoryCells) return;
  scene.inventoryCells.forEach((cell: InventoryCell) => {
    cell.bg.destroy();
    cell.icon.destroy();
    cell.count.destroy();
  });
}

function destroyCraftSlots(scene: PlanningStorageScene): void {
  if (!scene.craftInputSlots) return;
  scene.craftInputSlots.forEach((slot: CraftSlot) => {
    slot.bg.destroy();
    slot.icon.destroy();
  });
}

function destroyRecipeSuggestionSlots(scene: PlanningStorageScene): void {
  if (!scene.recipeSuggestionSlots) return;
  scene.recipeSuggestionSlots.forEach((slot: RecipeSlot) => {
    slot.bg.destroy();
    slot.icon.destroy();
    slot.countText.destroy();
  });
}

function destroyPlanningStorageSpace(scene: PlanningStorageScene): void {
  scene.storageLeftBg?.destroy();
  scene.storageRightBg?.destroy();
  scene.storageLeftBg = null;
  scene.storageRightBg = null;
  scene.inventoryDockHeader?.destroy?.();
  scene.inventoryDockHeader = null;
  scene.storageTitleText = null;
  scene.storageSummaryText = null;
  scene.invPrevBtn = null;
  scene.invNextBtn = null;
  destroyInventoryCells(scene);
  scene.craftTitleText?.destroy();
  scene.craftHintText?.destroy();
  destroyCraftSlots(scene);
  if (scene.craftOutputSlot) {
    scene.craftOutputSlot.bg.destroy();
    scene.craftOutputSlot.icon.destroy();
  }
  destroyRecipeSuggestionSlots(scene);
  scene.recipeSuggestionHeader?.destroy?.();
  scene.recipeSuggestionHeader = null;
  scene.recipeSuggestionTitle = null;
  scene.recipeSuggestionInfoText = null;
  scene.recipeSuggestPrevBtn = null;
  scene.recipeSuggestNextBtn = null;
  scene.logOverlayBg?.destroy();
  scene.logHistoryIcon?.destroy();
  scene.logText?.destroy();
  scene.storageCraftText?.destroy();
}

function createInventoryCells(scene: PlanningStorageScene, invX: number, invY: number, invCols: number, invRows: number, invCell: number, invGap: number): void {
    scene.inventoryCells = [];
    for (let row = 0; row < invRows; row += 1) {
      for (let col = 0; col < invCols; col += 1) {
        const x = invX + col * (invCell + invGap);
        const yy = invY + row * (invCell + invGap);
        const bg = scene.add.rectangle(x + invCell / 2, yy + invCell / 2, invCell, invCell, 0x162639, 0.95) as InventoryCell["bg"];
        bg.setStrokeStyle?.(1, UI_COLORS.panelEdgeSoft, 0.78);
        bg.setDepth?.(2000);
        bg.setInteractive?.({ useHandCursor: true });
        const icon = scene.add.text(x + 6, yy + 4, "+", {
          fontFamily: EMOJI_FONT,
          fontSize: scaleFontPx(scene, 18, "body"),
          color: UI_COLORS.textMuted
        }).setDepth(2001) as InventoryCell["icon"];
        const count = scene.add.text(x + invCell - 4, yy + invCell - 4, "", {
          fontFamily: UI_FONT,
          fontSize: scaleFontPx(scene, 9, "caption"),
          color: UI_COLORS.textSecondary
        }).setOrigin(1, 1).setDepth(2001) as InventoryCell["count"];

        const cell: InventoryCell = { bg, icon, count, itemId: null, amount: 0, index: row * invCols + col };
        bg.on?.("pointerdown", ((pointer: StoragePointerLike, _localX: number, _localY: number, event: { stopPropagation?: () => void } | null) => {
          if (!cell.itemId) return;
          if (scene.phase !== PHASE.PLANNING) return;
          if (scene.settingsVisible || scene.libraryModal?.isOpen() || scene.historyModalVisible || scene.versionInfoVisible) return;
          if (isRightClickPointer(pointer)) {
            event?.stopPropagation?.();
            scene.itemPointerDown = null;
            addItemToPlanningCraftGrid(scene as unknown as Parameters<typeof addItemToPlanningCraftGrid>[0], cell.itemId);
            return;
          }
          if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "start_item_drag", {
            item: { itemId: cell.itemId, index: cell.index },
            itemId: cell.itemId,
            index: cell.index
          }, { roles: ["item"] }) === false) {
            return;
          }
          scene.itemPointerDown = { cell, x: pointer.x, y: pointer.y };
        }) as unknown as PhaserEventHandler);
        scene.tooltip.attach(bg, () => {
          if (!cell.itemId) return { title: t("planning.storage.itemCell"), body: t("planning.storage.empty") };
          const item = ITEM_BY_ID[cell.itemId];
          const itemType = item?.kind === "equipment" ? t("planning.storage.equipment") : t("planning.storage.material");
          let extra = "";
          if (item?.kind === "equipment") {
            const recipe = RECIPE_BY_ID[(item as { fromRecipe?: string }).fromRecipe as string];
            if (recipe?.description) extra = `\n\n◆ ${t("planning.storage.effectPrefix")} ${recipe.description}`;
            extra += `\n◆ ${t("planning.storage.dragToEquipHint")}`;
            extra += `\n◆ ${t("planning.storage.dragToCraftHint")}`;
            extra += `\n◆ ${t("planning.storage.rightClickCraftHint")}`;
          } else {
            extra = `\n◆ ${t("planning.storage.dragToCraftMaterialHint")}`;
            extra += `\n◆ ${t("planning.storage.rightClickCraftHint")}`;
          }
          return {
            title: `${item?.icon ?? "❔"} ${item?.name ?? cell.itemId}`,
            body: t("planning.storage.itemDetailBody", { type: itemType, amount: cell.amount, extra })
          };
        });
        scene.inventoryCells.push(cell);
      }
    }
}

interface CraftLayout {
  compact: boolean;
  craftX: number;
  craftY: number;
  craftCell: number;
  craftCellGap: number;
  craftGridW: number;
  craftGridH: number;
  craftArrowGap: number;
  gridX0: number;
  gridY0: number;
  outputX: number;
  outputY: number;
  craftColumnW: number;
  craftHintY: number;
  suggestion: { areaX: number; areaY: number; areaW: number; rowY: number; cols: number; slotsX: number; slotsY: number; cellSize: number; gap: number };
}

function createCraftSlots(scene: PlanningStorageScene, craftLayout: CraftLayout): CraftLayout {
    const compact = craftLayout.compact;
    const {
      craftX,
      craftY,
      craftCell,
      craftCellGap,
      craftGridW,
      craftGridH,
      craftArrowGap,
      gridX0,
      gridY0,
      outputX,
      outputY,
      craftColumnW,
      craftHintY
    } = craftLayout;

    scene.craftTitleText = scene.add.text(craftX, craftY - 2, t("planning.craft.title"), {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene, compact ? 12 : 13, "label"),
      color: UI_COLORS.textSecondary,
      fontStyle: "bold"
    }).setDepth(2000) as PlanningStorageScene["craftTitleText"];

    scene.craftInputSlots = [];
    for (let idx = 0; idx < 9; idx += 1) {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = gridX0 + col * (craftCell + craftCellGap);
      const y = gridY0 + row * (craftCell + craftCellGap);
      const bg = scene.add.rectangle(x + craftCell / 2, y + craftCell / 2, craftCell, craftCell, 0x162639, 0.96) as CraftSlot["bg"];
      bg.setStrokeStyle?.(1, UI_COLORS.panelEdgeSoft, 0.78);
      bg.setDepth?.(2000);
      bg.setInteractive?.({ useHandCursor: true });
      const icon = scene.add.text(x + craftCell / 2, y + craftCell / 2, "·", {
        fontFamily: UI_FONT,
        fontSize: scaleFontPx(scene, 16, "body"),
        color: UI_COLORS.textMuted
      }).setOrigin(0.5).setDepth(2001) as CraftSlot["icon"];
      const slot: CraftSlot = { index: idx, bg, icon };
      bg.on?.("pointerdown", ((pointer: StoragePointerLike | null) => {
        if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "clear_craft_item", { slotIndex: idx }) === false) return;
        if (pointer?.rightButtonDown?.() || pointer?.leftButtonDown?.()) clearPlanningCraftGridSlot(scene as unknown as Parameters<typeof clearPlanningCraftGridSlot>[0], idx);
      }) as unknown as PhaserEventHandler);
      scene.tooltip.attach(bg, () => {
        const active = getPlanningCraftActiveIndices(scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0]).includes(idx);
        if (!active) {
          return {
            title: t("planning.craft.lockedSlotTitle"),
            body: t("planning.craft.lockedSlotBody")
          };
        }
        const itemId = scene.craftGridItems[idx];
        if (!itemId) return { title: t("planning.craft.slotTitle"), body: t("planning.craft.emptySlotBody") };
        const item = ITEM_BY_ID[itemId];
        return { title: `${item?.icon ?? "❔"} ${item?.name ?? itemId}`, body: t("planning.craft.clickToRemoveMaterial") };
      });
      scene.craftInputSlots.push(slot);
    }

    const arrowX = gridX0 + craftGridW + Math.floor(craftArrowGap * 0.5);
    const arrowY = gridY0 + Math.floor(craftGridH * 0.5);
    scene.add.text(arrowX, arrowY, "→", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene, 22, "button"),
      color: "#9ec6ea",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(2001);

    const outBg = scene.add.rectangle(outputX + craftCell / 2, outputY + craftCell / 2, craftCell, craftCell, 0x1e2f42, 0.95) as CraftSlot["bg"];
    outBg.setStrokeStyle?.(1, UI_COLORS.panelEdgeSoft, 0.8);
    outBg.setDepth?.(2000);
    outBg.setInteractive?.({ useHandCursor: true });
    const outIcon = scene.add.text(outputX + craftCell / 2, outputY + craftCell / 2, "?", {
      fontFamily: EMOJI_FONT,
      fontSize: scaleFontPx(scene, 18, "body"),
      color: UI_COLORS.textMuted
    }).setOrigin(0.5).setDepth(2001) as CraftSlot["icon"];
    outBg.on?.("pointerdown", () => {
      if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "craft_item", { targetType: "CRAFT_OUTPUT" }) === false) return;
      craftFromPlanningGrid(scene as unknown as Parameters<typeof craftFromPlanningGrid>[0]);
    });
    scene.craftOutputSlot = { bg: outBg as { destroy: () => void }, icon: outIcon as { destroy: () => void } };
    scene.tooltip.attach(outBg, () => {
      const recipeId = getPlanningCraftResultRecipeId(scene as unknown as Parameters<typeof getPlanningCraftResultRecipeId>[0]);
      if (!recipeId) return { title: t("planning.craft.outputTitle"), body: t("planning.craft.noMatchBody") };
      const recipe = RECIPE_BY_ID[recipeId];
      return {
        title: `${recipe?.icon ?? "✨"} ${recipe?.name ?? recipeId}`,
        body: t("planning.craft.outputReadyBody", { desc: recipe?.description ?? t("planning.craft.craftedEquipmentFallback") })
      };
    });
    scene.craftHintText = scene.add.text(craftX, craftHintY, t("planning.craft.dragFromStorageHint"), {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene, compact ? 9 : 10, "caption"),
      color: UI_COLORS.textMuted,
      wordWrap: { width: Math.max(96, craftColumnW) }
    }).setDepth(2000) as PlanningStorageScene["craftHintText"];

    return craftLayout;
}

function createRecipeSuggestionSlots(scene: PlanningStorageScene, craftLayout: CraftLayout): void {
    const compact = craftLayout.compact;
    const suggestLayout = craftLayout.suggestion;
    const suggestHeader = createPlanningDockHeader(scene, {
      areaX: suggestLayout.areaX,
      areaY: suggestLayout.areaY,
      areaW: suggestLayout.areaW,
      rowY: suggestLayout.rowY,
      compact,
      leftPad: 0,
      rightPad: 0,
      title: t("planning.craft.recipeSuggestionsTitle"),
      infoText: "",
      reservedInfoWidth: Math.max(46, Math.min(64, Math.floor(suggestLayout.areaW * 0.2))),
      titleFontSize: compact ? 12 : 13,
      infoFontSize: compact ? 9 : 10,
      infoColor: UI_COLORS.textPrimary,
      buttonW: compact ? 26 : 28,
      buttonGap: 6,
      titleMinScale: 0.62,
      onPrev: () => changePlanningRecipeSuggestionPage(scene as unknown as Parameters<typeof changePlanningRecipeSuggestionPage>[0], -1),
      onNext: () => changePlanningRecipeSuggestionPage(scene as unknown as Parameters<typeof changePlanningRecipeSuggestionPage>[0], 1)
    });
    scene.recipeSuggestionHeader = suggestHeader;
    scene.recipeSuggestionTitle = suggestHeader.titleText;
    scene.recipeSuggestionInfoText = suggestHeader.infoText;
    scene.recipeSuggestionPageMax = 0;
    scene.recipeSuggestionPage = 0;
    scene.recipeSuggestPrevBtn = suggestHeader.prevBtn;
    scene.recipeSuggestNextBtn = suggestHeader.nextBtn;

    scene.recipeSuggestionSlots = [];
    for (let i = 0; i < 9; i += 1) {
      const col = i % suggestLayout.cols;
      const row = Math.floor(i / suggestLayout.cols);
      const sx = suggestLayout.slotsX + col * (suggestLayout.cellSize + suggestLayout.gap);
      const sy = suggestLayout.slotsY + row * (suggestLayout.cellSize + suggestLayout.gap);
      const bg = scene.add.rectangle(
        sx + suggestLayout.cellSize / 2,
        sy + suggestLayout.cellSize / 2,
        suggestLayout.cellSize,
        suggestLayout.cellSize,
        0x162639,
        0.9
      ) as RecipeSlot["bg"];
      bg.setStrokeStyle?.(1, UI_COLORS.panelEdgeSoft, 0.6);
      bg.setDepth?.(2000);
      bg.setInteractive?.({ useHandCursor: true });
      const icon = scene.add.text(sx + suggestLayout.cellSize / 2, sy + suggestLayout.cellSize / 2 - 3, "", {
        fontFamily: EMOJI_FONT,
        fontSize: scaleFontPx(scene, 16, "body"),
        color: UI_COLORS.textMuted
      }).setOrigin(0.5).setDepth(2001) as RecipeSlot["icon"];
      const countText = scene.add.text(sx + suggestLayout.cellSize - 2, sy + suggestLayout.cellSize - 2, "", {
        fontFamily: UI_FONT,
        fontSize: scaleFontPx(scene, 8, "caption"),
        color: UI_COLORS.textSecondary
      }).setOrigin(1, 1).setDepth(2001) as RecipeSlot["countText"];

      const slot: RecipeSlot = { bg, icon, countText, recipeId: null };
      bg.on?.("pointerdown", ((pointer: StoragePointerLike, _localX: number, _localY: number, event: { stopPropagation?: () => void } | null) => {
        if (!slot.recipeId) return;
        if (event?.stopPropagation) event.stopPropagation();
        if (isRightClickPointer(pointer)) {
          openPlanningLibraryRecipeDetail(scene as unknown as Parameters<typeof openPlanningLibraryRecipeDetail>[0], slot.recipeId);
          return;
        }
        populatePlanningCraftGridFromRecipe(scene as unknown as Parameters<typeof populatePlanningCraftGridFromRecipe>[0], slot.recipeId);
      }) as unknown as PhaserEventHandler);
      scene.tooltip.attach(bg, () => {
        if (!slot.recipeId) return { title: t("planning.craft.suggestionTitle"), body: t("planning.craft.noMatchingRecipe") };
        const recipe = RECIPE_BY_ID[slot.recipeId];
        if (!recipe) return null;
        const reqLabel = (recipe.requires ?? []).map((id: string) => {
          const item = ITEM_BY_ID[id];
          return `${item?.icon ?? "?"} ${item?.name ?? id}`;
        }).join(" + ");
        return {
          title: `${recipe.icon ?? "✨"} ${recipe.name ?? slot.recipeId}`,
          body: t("planning.craft.suggestionDetailBody", { desc: recipe.description ?? t("planning.craft.craftedEquipmentFallback"), tier: recipe.tier, reqs: reqLabel })
        };
      });
      scene.recipeSuggestionSlots.push(slot);
    }
}

function createPlanningLogOverlay(scene: PlanningStorageScene, layout: StorageLayoutEx): void {
  const cardW = layout.sidePanelW;
  const compact = layout.compactHud === true;
  const cardH = layout.sidePanelH;
  const cardX = layout.sidePanelX;
  const cardY = layout.sidePanelY;
  const contentX = cardX + (compact ? 10 : 12);
  const contentW = cardW - 24;
  scene.logOverlayBg = scene.add.rectangle(
    cardX + cardW * 0.5,
    cardY + cardH * 0.5,
    cardW,
    cardH,
    0x0e1828,
    0.86
  ).setDepth(1998) as PlanningStorageScene["logOverlayBg"];
  scene.logOverlayBg?.setStrokeStyle?.(1, UI_COLORS.panelEdgeSoft, 0.72);

  scene.logHistoryIcon = scene.add.text(contentX, cardY + (compact ? 8 : 10), t("planning.log.recentHistoryTitle"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 11 : 12, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2000) as PlanningStorageScene["logHistoryIcon"];

  scene.logText = scene.add.text(contentX, cardY + (compact ? 28 : 34), "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 10 : 11, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene, compact ? 2 : 3, "spacing"),
    wordWrap: { width: contentW }
  }).setDepth(2000) as PlanningStorageScene["logText"];
  scene.logText?.setFixedSize(contentW, Math.max(30, cardH - (compact ? 64 : 72)));

  scene.storageCraftText = scene.add.text(contentX, cardY + cardH - (compact ? 24 : 28), "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 9 : 10, "caption"),
    color: UI_COLORS.textMuted,
    lineSpacing: scaleUiSize(scene, compact ? 1 : 2, "spacing"),
    wordWrap: { width: contentW }
  }).setDepth(2000) as PlanningStorageScene["storageCraftText"];
  scene.storageCraftText?.setFixedSize(contentW, compact ? 16 : 20);
}

export function createPlanningStorageSpace(scene: PlanningStorageScene): void {
  ensurePlanningLowerDockPanels(scene as unknown as Parameters<typeof ensurePlanningLowerDockPanels>[0]);
  const layout = scene.layout;
  const compact = layout.compactHud === true;
  const dockPanels = computePlanningLowerDockPanelLayout(layout as Parameters<typeof computePlanningLowerDockPanelLayout>[0]);
  const storageArea = dockPanels.storage;
  const storageHeaderArea = dockPanels.headerArea.storage;
  destroyPlanningStorageSpace(scene);

  const invGap = UI_SPACING.XS;
  const invUpgrades = (scene.player?.inventoryUpgradeLevel ?? 0) + (scene.player?.inventoryBonus ?? 0);
  const invCols = 8;
  const invRows = 1;
  const craftInnerPad = layout.craftInnerPad ?? (compact ? 12 : 14);
  const craftContentX = storageArea.x + craftInnerPad;
  const craftContentW = Math.max(120, storageArea.w - craftInnerPad * 2);

  const titlePad = dockPanels.titlePadX;
  const invX = storageArea.x + titlePad;
  const invCell = layout.invCellSize;
  const inventoryHeaderLayout = computePlanningDockHeaderLayout({
    areaX: storageHeaderArea.areaX,
    areaY: storageHeaderArea.areaY,
    areaW: storageHeaderArea.areaW,
    compact,
    leftPad: titlePad,
    rightPad: storageHeaderArea.rightPad,
    reservedInfoWidth: Math.max(152, Math.floor(craftContentW * 0.48))
  }) as { rowY: number; [key: string]: unknown };
  const invY = Math.max(dockPanels.contentCeilingY, inventoryHeaderLayout.rowY + 24);

  scene.invPageMax = invUpgrades;
  if (scene.inventoryPage > scene.invPageMax) scene.inventoryPage = scene.invPageMax;

  scene.inventoryDockHeader = createPlanningDockHeader(scene, {
    areaX: storageHeaderArea.areaX,
    areaY: storageHeaderArea.areaY,
    areaW: storageHeaderArea.areaW,
    compact,
    leftPad: titlePad,
    rightPad: storageHeaderArea.rightPad,
    title: t("planning.storage.bagTitle"),
    infoText: "",
    reservedInfoWidth: Math.max(152, Math.floor(craftContentW * 0.48)),
    infoFontSize: compact ? 10 : 11,
    infoColor: UI_COLORS.textPrimary,
    infoMinScale: 0.72,
    onPrev: () => changePlanningInvPage(scene as unknown as Parameters<typeof changePlanningInvPage>[0], -1),
    onNext: () => changePlanningInvPage(scene as unknown as Parameters<typeof changePlanningInvPage>[0], 1)
  });
  scene.storageTitleText = scene.inventoryDockHeader.titleText;
  scene.storageSummaryText = scene.inventoryDockHeader.infoText;
  scene.invPrevBtn = scene.inventoryDockHeader.prevBtn;
  scene.invNextBtn = scene.inventoryDockHeader.nextBtn;
  createInventoryCells(scene, invX, invY, invCols, invRows, invCell, invGap);

  createPlanningLogOverlay(scene, layout);
  if (planningShouldShowCraftingInPlanning(scene as unknown as Parameters<typeof planningShouldShowCraftingInPlanning>[0]) === false) {
    return;
  }

  const craftX = craftContentX;
  const craftY = invY + invCell + (compact ? 12 : 16); // Stack strictly below the Inventory rendering bounds
  const craftW = craftContentW;
  const craftLayout = computePlanningStorageCraftLayout({
    compact,
    craftX,
    craftY,
    craftW,
    suggestCount: 9
  }) as unknown as CraftLayout;
  createCraftSlots(scene, craftLayout);
  createRecipeSuggestionSlots(scene, craftLayout);
}
