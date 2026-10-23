import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import { ITEM_BY_ID, getItemSellPrice, getUnequipCost } from "../../data/items.js";
import { getUnitVisual } from "../../data/unitVisuals.js";
import { PHASE } from "../../core/boardConstants.js";
import { UI_COLORS } from "../../core/uiTheme.js";
import { gainGoldWithCreative } from "../../core/creativeMode.js";
import { installSharedBoardViewInput } from "./sceneBoardInputController.js";

import { getVisiblePlanningBenchSlotByIndex, refreshPlanningBenchUi } from "./planningBenchRuntime.js";
import { findPlanningPlayerBoardCellFromPoint, getPlanningDropTarget, getPlanningUnitAt, pointPlanningInBoardPanel } from "./planningBoardInteractionRuntime.js";
import { getPlanningCraftActiveIndices } from "./planningCraftRuntime.js";
import { findPlanningCreativeSandboxUnit } from "./planningCreativeSandboxRuntime.js";
import { addPlanningItemToCraftGridAt, equipPlanningItemToUnit, getPlanningUnitSalePrice, movePlanningUnit, sellPlanningInventoryItem, sellPlanningUnit, unequipPlanningAll } from "./planningFormationRuntime.js";
import { getPlanningPointerWorldPosition } from "./planningInputRuntime.js";
import { refreshPlanningStorageUi } from "./planningInventoryRuntime.js";
import { planningConsumeItem } from "./planningItemHelpersRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { pointInPlanningRightPanel, scrollPlanningRightPanel } from "./planningRightPanelRuntime.js";
import { persistPlanningProgress } from "./planningRunStateRuntime.js";
import { onPlanningHistoryWheel } from "./planningSettingsRuntime.js";
import { buildPlanningTutorialSellContext, buildPlanningTutorialUnequipContext } from "./planningTutorialRuntime.js";

import { mapPlanningVisualBoardRowToLocalRow } from "./planningCoopSessionRuntime.js";
import {
  guardPlanningTutorialAction,
  isPlanningTutorialCampaignActive,
  isPlanningTutorialPointerAllowed,
  showPlanningTutorialBlockedHint
} from "./planningTutorialRuntime.js";
import { onPlanningUnitInfoPanelWheel, pointPlanningInUnitInfoPanel } from "./planningUnitInfoRuntime.js";

interface PointerLike {
  x: number;
  y: number;
  leftButtonDown: () => boolean;
  leftButtonReleased: () => boolean;
  rightButtonDown?: () => boolean;
  [key: string]: unknown;
}

interface DragUnit {
  uid: string;
  baseId: string;
  star?: number;
  base: { classType: string; name: string; tier: number; [key: string]: unknown };
  equips?: string[];
  sprite?: { setVisible: (visible: boolean) => void };
  [key: string]: unknown;
}

interface DragOrigin {
  region: "BOARD" | "BENCH" | "DUMMY" | "SANDBOX_BOARD";
  row?: number;
  col?: number;
  index?: number;
  unit?: DragUnit;
  [key: string]: unknown;
}

interface ShapeLike {
  visible: boolean;
  setStrokeStyle: (width: number, color: number, alpha: number) => unknown;
  setFillStyle: (color: number, alpha: number) => unknown;
  getBounds: () => { x: number; y: number; width: number; height: number };
}

interface ButtonLike {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: ShapeLike;
  text: { setText: (text: string) => unknown };
  setEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
}

interface BenchSlotLike {
  x: number;
  y: number;
  slotW: number;
  slotH: number;
  benchIndex: number | null;
  bg: ShapeLike;
  icon?: { setVisible: (visible: boolean) => void };
  _visualModel?: { setVisible?: (visible: boolean) => void } | null;
}

type ItemDropTarget =
  | { type: "CRAFT_SLOT"; slotIndex: number }
  | { type: "UNIT"; unit: DragUnit; region: "BENCH"; index: number }
  | { type: "UNIT"; unit: DragUnit; region: "BOARD"; row: number; col: number }
  | { type: "SELL" };

interface ItemCellLike { itemId?: string | null; index: number; [key: string]: unknown }
interface CraftSlotLike { index: number; bg: ShapeLike }

interface PlanningDragScene extends Phaser.Scene {
  buttons: { sell?: ButtonLike | null; unequip?: ButtonLike | null };
  player: { board: Array<Array<DragUnit | null>>; bench: Array<DragUnit | null>; unequipDiscount?: number; gold: number; itemBag?: string[]; [key: string]: unknown };
  aiMode: string;
  collectionProfile: unknown;
  phase: string;
  settingsVisible: boolean;
  historyModalVisible: boolean;
  versionInfoVisible: boolean;
  resultModalVisible: boolean;
  libraryModal?: { isOpen: () => boolean; scrollBy: (dy: number) => void } | null;
  activeResultModalScrollController?: { onWheel: (pointer: PointerLike, dy: number) => void } | null;
  isBoardDragging: boolean;
  isUnitDragging: boolean;
  isItemDragging: boolean;
  boardDragConsumed: boolean;
  itemDragConsumed: boolean;
  lastDragPoint: unknown;
  boardPointerDown: unknown;
  itemPointerDown: { x: number; y: number; cell: ItemCellLike } | null;
  dragUnit: DragUnit | null;
  dragOrigin: DragOrigin | null;
  dragClone: Phaser.GameObjects.Container | null;
  dragItemClone: Phaser.GameObjects.Container | null;
  dragItemId: string | null;
  dragItemOriginCell: ItemCellLike | null;
  selectedBenchIndex: number | null;
  benchSlots: BenchSlotLike[];
  craftInputSlots?: CraftSlotLike[] | null;
  craftGridItems: Array<string | null>;
  audioFx: { play: (key: string) => void };
  [key: string]: unknown;
}

type BoardInputInstaller = (scene: Phaser.Scene, options: {
  handleWheel?: (pointer: PointerLike, dy: number) => boolean;
  handlePointerDown?: (pointer: PointerLike) => boolean;
  handlePointerMove?: (pointer: PointerLike) => boolean;
  handlePointerRelease?: (pointer: PointerLike) => boolean;
  allowBoardPanStart?: (pointer: PointerLike) => boolean;
  getFinishPanOptions?: (pointer: PointerLike) => { clearHighlightsOnTap?: boolean } | undefined;
}) => void;
function resetPlanningSellButton(scene: PlanningDragScene): void {
  if (!scene.buttons.sell) return;
  scene.buttons.sell.bg.setStrokeStyle(1, 0x3a4a5c, 0.85);
  scene.buttons.sell.bg.setFillStyle(0x162433, 0.94);
  scene.buttons.sell.text.setText(scene.isItemDragging ? t("planning.ui.sell") : t("planning.ui.sellUnit"));
}

function resetPlanningUnequipButton(scene: PlanningDragScene): void {
  if (!scene.buttons.unequip) return;
  scene.buttons.unequip.bg.setStrokeStyle(1, 0x3a4a5c, 0.85);
  scene.buttons.unequip.bg.setFillStyle(0x162433, 0.94);
  scene.buttons.unequip.text.setText(t("planning.ui.unequip"));
  scene.buttons.unequip.setEnabled(false);
}

function getVisibleBenchSlot(scene: PlanningDragScene, benchIndex: number): BenchSlotLike | null {
  if (!Number.isInteger(benchIndex)) return null;
  return getVisiblePlanningBenchSlotByIndex(scene as unknown as Parameters<typeof getVisiblePlanningBenchSlotByIndex>[0], benchIndex) as unknown as BenchSlotLike | null;
}

function shouldBlockPlanningTutorialPointer(scene: PlanningDragScene, pointer: PointerLike): boolean {
  if (!isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0])) return false;
  if (scene.settingsVisible || scene.libraryModal?.isOpen?.() || scene.historyModalVisible || scene.versionInfoVisible) {
    return false;
  }
  if (scene.phase !== PHASE.PLANNING) return false;
  const inManagedArea = pointPlanningInBoardPanel(scene as unknown as Parameters<typeof pointPlanningInBoardPanel>[0], pointer?.x, pointer?.y)
    || pointInPlanningRightPanel(scene as unknown as Parameters<typeof pointInPlanningRightPanel>[0], pointer?.x, pointer?.y);
  if (!inManagedArea) return false;
  return isPlanningTutorialPointerAllowed(scene as unknown as Parameters<typeof isPlanningTutorialPointerAllowed>[0], pointer) === false;
}

export function getPlanningUnitUnequipCost(scene: PlanningDragScene, unit: DragUnit | null | undefined): number {
  if (!unit || !Array.isArray(unit.equips)) return 0;
  const discount = scene.player?.unequipDiscount ?? 0;
  return unit.equips.reduce((sum: number, id: string) => {
    const base = getUnequipCost(id);
    if (base <= 0) return sum;
    return sum + Math.max(1, base - discount);
  }, 0);
}

export function startPlanningUnitDrag(scene: PlanningDragScene, dragData: DragOrigin & { unit: DragUnit }, pointer: PointerLike): false | void {
  if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "start_unit_drag", {
    from: dragData,
    index: dragData?.index,
    row: dragData?.row,
    col: dragData?.col,
    unit: dragData?.unit
  }, { roles: ["source"] }) === false) {
    return false;
  }
  const dragPos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);

  scene.isBoardDragging = false;
  scene.lastDragPoint = null;
  scene.boardPointerDown = null;
  scene.isUnitDragging = true;
  scene.dragUnit = dragData.unit;
  scene.dragOrigin = dragData;

  const visual = getUnitVisual(dragData.unit.baseId, dragData.unit.base.classType, dragData.unit.star ?? 1, {
    side: "LEFT",
    ownerKind: dragData.region === "DUMMY" ? "PLAYER" : "PLAYER",
    collectionProfile: scene.collectionProfile
  });
  const clone = scene.add.container(dragPos.x, dragPos.y);
  const bg = scene.add.circle(0, 0, 24, 0x365675, 0.8);
  bg.setStrokeStyle(2, 0xbdcf47, 1);
  const txt = scene.add.text(0, 0, visual.icon || "🐾", { fontSize: "32px" }).setOrigin(0.5);
  clone.add([bg, txt]);
  clone.setDepth(4000);
  scene.dragClone = clone;

  if (dragData.unit.sprite) dragData.unit.sprite.setVisible(false);
  if (dragData.region === "BENCH" && dragData.index != null) {
    const slot = getVisibleBenchSlot(scene, dragData.index);
    if (slot?.icon) slot.icon.setVisible(false);
    slot?._visualModel?.setVisible?.(false);
  }

  scene.audioFx.play("click");

  if (scene.buttons.sell) {
    const price = getPlanningUnitSalePrice(scene as unknown as Parameters<typeof getPlanningUnitSalePrice>[0], dragData.unit as unknown as Parameters<typeof getPlanningUnitSalePrice>[1]);
    scene.buttons.sell.setEnabled(true);
    scene.buttons.sell.setLabel(t("planning.ui.sellWithPrice", { price }));
  }
  if (scene.buttons.unequip) {
    const cost = getPlanningUnitUnequipCost(scene, dragData.unit);
    scene.buttons.unequip.setEnabled(true);
    scene.buttons.unequip.setLabel(cost > 0 ? t("planning.ui.unequipCost", { cost }) : t("planning.ui.noItems"));
  }
}

export function updatePlanningUnitDrag(scene: PlanningDragScene, pointer: PointerLike): void {
  if (!scene.dragClone) return;
  const dragPos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
  scene.dragClone.setPosition(dragPos.x, dragPos.y);

  const sell = scene.buttons.sell;
  const unequip = scene.buttons.unequip;

  let overSell = false;
  if (sell && sell.bg.visible) {
    overSell = dragPos.x >= sell.x && dragPos.x <= sell.x + sell.w &&
      dragPos.y >= sell.y && dragPos.y <= sell.y + sell.h;
    if (overSell) {
      sell.bg.setStrokeStyle(2.5, 0xff4444, 1);
      sell.bg.setFillStyle(0x4a1111, 0.95);
      if (scene.dragUnit) {
        const price = getPlanningUnitSalePrice(scene as unknown as Parameters<typeof getPlanningUnitSalePrice>[0], scene.dragUnit as unknown as Parameters<typeof getPlanningUnitSalePrice>[1]);
        sell.text.setText(t("planning.ui.sellIconWithPrice", { price }));
      }
    } else {
      sell.bg.setStrokeStyle(1, 0x3a4a5c, 0.85);
      sell.bg.setFillStyle(0x162433, 0.94);
      sell.text.setText(t("planning.ui.sellUnit"));
    }
  }

  if (unequip && unequip.bg.visible && !overSell) {
    const overUnequip = dragPos.x >= unequip.x && dragPos.x <= unequip.x + unequip.w &&
      dragPos.y >= unequip.y && dragPos.y <= unequip.y + unequip.h;
    if (overUnequip) {
      unequip.bg.setStrokeStyle(2.5, 0xefb844, 1);
      unequip.bg.setFillStyle(0x4a3b11, 0.95);
      if (scene.dragUnit) {
        const cost = getPlanningUnitUnequipCost(scene, scene.dragUnit);
        if (cost > 0) {
          unequip.text.setText(t("planning.ui.unequipCost", { cost }));
        } else {
          unequip.text.setText(t("planning.ui.noItems"));
          unequip.bg.setStrokeStyle(2.5, 0x555555, 1);
          unequip.bg.setFillStyle(0x222222, 0.95);
        }
      }
    } else {
      resetPlanningUnequipButton(scene);
    }
  }
}

export function endPlanningUnitDrag(scene: PlanningDragScene, pointer: PointerLike): void {
  const cleanupDragState = () => {
    scene.dragUnit = null;
    scene.dragOrigin = null;
    scene.isBoardDragging = false;
    scene.lastDragPoint = null;
    scene.boardPointerDown = null;
  };

  scene.isUnitDragging = false;
  if (scene.dragClone) {
    scene.dragClone.destroy();
    scene.dragClone = null;
  }

  resetPlanningSellButton(scene);
  if (scene.buttons.sell) {
    scene.buttons.sell.setEnabled(scene.selectedBenchIndex != null && !!scene.player?.bench?.[scene.selectedBenchIndex]);
  }
  resetPlanningUnequipButton(scene);

  if (scene.dragUnit?.sprite) scene.dragUnit.sprite.setVisible(true);
  if (scene.dragOrigin?.region === "BENCH" || scene.dragOrigin?.region === "DUMMY") {
    refreshPlanningBenchUi(scene as unknown as Parameters<typeof refreshPlanningBenchUi>[0]);
  }

  const dragPos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
  const target = getPlanningDropTarget(scene as unknown as Parameters<typeof getPlanningDropTarget>[0], dragPos.x, dragPos.y);
  if (!target) {
    cleanupDragState();
    return;
  }

  scene.boardDragConsumed = true;
  scene.time.delayedCall(0, () => {
    scene.boardDragConsumed = false;
  });

  if (target.type === "SELL") {
    const tutorialSellContext = buildPlanningTutorialSellContext(scene as unknown as Parameters<typeof buildPlanningTutorialSellContext>[0], scene.dragOrigin as unknown as Parameters<typeof buildPlanningTutorialSellContext>[1], { uid: scene.dragUnit?.uid });
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "sell_unit", tutorialSellContext, { roles: ["source", "destination"] }) === false) {
      cleanupDragState();
      return;
    }
    if (scene.dragUnit?.uid) {
      sellPlanningUnit(scene as unknown as Parameters<typeof sellPlanningUnit>[0], scene.dragUnit.uid, {
        skipTutorialGuard: true,
        tutorialContext: tutorialSellContext
      });
    }
    cleanupDragState();
    return;
  }

  if (target.type === "UNEQUIP") {
    const tutorialUnequipContext = buildPlanningTutorialUnequipContext(
      scene as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[0],
      (scene.dragUnit ?? scene.dragOrigin?.unit ?? null) as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[1],
      scene.dragOrigin as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[2]
    );
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "unequip_item", tutorialUnequipContext, { roles: ["source", "destination"] }) === false) {
      cleanupDragState();
      return;
    }
    const origin = scene.dragOrigin;
    if (scene.dragUnit?.uid && origin) {
      const unitNode = origin.region === "BOARD" && origin.row != null && origin.col != null
        ? scene.player.board[origin.row]?.[origin.col]
        : origin.region === "SANDBOX_BOARD"
          ? findPlanningCreativeSandboxUnit(scene as unknown as Parameters<typeof findPlanningCreativeSandboxUnit>[0], scene.dragUnit.uid)
          : origin.index != null ? scene.player.bench[origin.index] : null;
      if (unitNode) {
        unequipPlanningAll(scene as unknown as Parameters<typeof unequipPlanningAll>[0], unitNode as unknown as Parameters<typeof unequipPlanningAll>[1], {
          skipTutorialGuard: true,
          tutorialContext: tutorialUnequipContext
        });
      }
    }
    cleanupDragState();
    return;
  }

  const from = scene.dragOrigin;
  const to = target.type === "BOARD" ? { region: "BOARD", row: target.r, col: target.c }
    : target.type === "BENCH" ? { region: "BENCH", index: target.index }
      : null;

  if (from && to) {
    if (from.region === to.region) {
      if (from.region === "BOARD" && from.row === to.row && from.col === to.col) {
        cleanupDragState();
        return;
      }
      if (from.region === "BENCH" && from.index === to.index) {
        cleanupDragState();
        return;
      }
    }

    const moved = movePlanningUnit(
      scene as unknown as Parameters<typeof movePlanningUnit>[0],
      from as unknown as Parameters<typeof movePlanningUnit>[1],
      to as unknown as Parameters<typeof movePlanningUnit>[2],
      true
    );
    if (moved) scene.audioFx.play("click");
  }
  cleanupDragState();
}

export function startPlanningItemDrag(scene: PlanningDragScene, cell: ItemCellLike | null | undefined, pointer: PointerLike): false | void {
  const itemId = cell?.itemId;
  const index = cell?.index;
  if (!itemId || index == null || !cell) return;
  if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "start_item_drag", {
    item: { itemId, index }, itemId, index
  }, { roles: ["item"] }) === false) {
    return false;
  }
  const item = ITEM_BY_ID[itemId];
  if (!item) return;

  scene.isItemDragging = true;
  scene.dragItemId = itemId;
  scene.dragItemOriginCell = cell;
  scene.itemPointerDown = null;

  const pos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
  const clone = scene.add.container(pos.x, pos.y);
  const bg = scene.add.circle(0, 0, 20, 0x2a4563, 0.9);
  bg.setStrokeStyle(2, 0xbdcf47, 1);
  const txt = scene.add.text(0, 0, item.icon ?? "❔", { fontSize: "24px" }).setOrigin(0.5);
  clone.add([bg, txt]);
  clone.setDepth(5000);
  scene.dragItemClone = clone;

  scene.audioFx.play("click");

  if (scene.buttons.sell) {
    const price = getItemSellPrice(scene.dragItemId);
    scene.buttons.sell.setEnabled(true);
    scene.buttons.sell.setLabel(t("planning.ui.sellWithPrice", { price }));
  }
}

export function updatePlanningItemDrag(scene: PlanningDragScene, pointer: PointerLike): void {
  if (!scene.dragItemClone) return;
  const pos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
  scene.dragItemClone.setPosition(pos.x, pos.y);

  if (scene.craftInputSlots) {
    const activeCraftSlots = new Set(getPlanningCraftActiveIndices(scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0]));
    scene.craftInputSlots.forEach((slot: CraftSlotLike) => {
      const bounds = slot.bg.getBounds();
      const over = activeCraftSlots.has(slot.index) &&
        pos.x >= bounds.x && pos.x <= bounds.x + bounds.width &&
        pos.y >= bounds.y && pos.y <= bounds.y + bounds.height;
      if (over && !scene.craftGridItems[slot.index]) {
        slot.bg.setStrokeStyle(2, 0xbdcf47, 1);
      } else {
        const enabled = activeCraftSlots.has(slot.index);
        slot.bg.setStrokeStyle(1, enabled ? UI_COLORS.panelEdgeSoft : 0x2a3b4d, enabled ? 0.78 : 0.55);
      }
    });
  }

  const sell = scene.buttons.sell;
  if (sell && sell.bg.visible) {
    const overSell = pos.x >= sell.x && pos.x <= sell.x + sell.w &&
      pos.y >= sell.y && pos.y <= sell.y + sell.h;
    if (overSell) {
      sell.bg.setStrokeStyle(2.5, 0xff4444, 1);
      sell.bg.setFillStyle(0x4a1111, 0.95);
      if (scene.dragItemId) {
        const price = getItemSellPrice(scene.dragItemId);
        sell.text.setText(t("planning.ui.sellIconWithPrice", { price }));
      }
    } else {
      resetPlanningSellButton(scene);
    }
  }
}

export function sellPlanningItem(scene: PlanningDragScene, itemId: string | null | undefined): boolean {
  if (!itemId) return false;
  const price = getItemSellPrice(itemId);

  if (planningConsumeItem(scene as unknown as Parameters<typeof planningConsumeItem>[0], itemId, 1)) {
    gainGoldWithCreative(scene.player, scene.aiMode, price, { allowCreativeMutation: false });
    const item = ITEM_BY_ID[itemId];
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.sellItem", { icon: item?.icon ?? "📦", name: item?.name ?? itemId, price }));
    scene.audioFx.play("buy");
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    return true;
  }
  return false;
}

export function getPlanningItemDropTarget(scene: PlanningDragScene, x: number, y: number): ItemDropTarget | null {
  if (scene.craftInputSlots) {
    const activeCraftSlots = new Set(getPlanningCraftActiveIndices(scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0]));
    for (const slot of scene.craftInputSlots) {
      if (!activeCraftSlots.has(slot.index)) continue;
      const bounds = slot.bg.getBounds();
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
        y >= bounds.y && y <= bounds.y + bounds.height) {
        return { type: "CRAFT_SLOT", slotIndex: slot.index };
      }
    }
  }

  for (let i = 0; i < scene.benchSlots.length; i += 1) {
    const slot = scene.benchSlots[i];
    if (!slot.bg.visible) continue;
    if (x >= slot.x && x <= slot.x + slot.slotW && y >= slot.y && y <= slot.y + slot.slotH) {
      const benchIndex = slot.benchIndex;
      const unit = benchIndex != null && Number.isInteger(benchIndex) ? scene.player?.bench?.[benchIndex] : null;
      if (unit && benchIndex != null) return { type: "UNIT", unit, region: "BENCH", index: benchIndex };
    }
  }

  const hit = findPlanningPlayerBoardCellFromPoint(scene as unknown as Parameters<typeof findPlanningPlayerBoardCellFromPoint>[0], x, y, true);
  if (hit) {
    const localRow = mapPlanningVisualBoardRowToLocalRow(scene as unknown as Parameters<typeof mapPlanningVisualBoardRowToLocalRow>[0], hit.row) ?? hit.row;
    const unit = localRow == null
      ? null
      : scene.player?.board?.[localRow]?.[hit.col];
    if (unit) return { type: "UNIT", unit, region: "BOARD", row: localRow, col: hit.col };
  }

  const sell = scene.buttons.sell;
  if (sell && sell.bg.visible) {
    if (x >= sell.x && x <= sell.x + sell.w && y >= sell.y && y <= sell.y + sell.h) {
      return { type: "SELL" };
    }
  }

  return null;
}

export function endPlanningItemDrag(scene: PlanningDragScene, pointer: PointerLike): void {
  scene.isItemDragging = false;

  scene.itemDragConsumed = true;
  scene.time.delayedCall(0, () => {
    scene.itemDragConsumed = false;
  });

  const itemId = scene.dragItemId;

  if (scene.dragItemClone) {
    scene.dragItemClone.destroy();
    scene.dragItemClone = null;
  }

  if (!itemId) {
    scene.dragItemId = null;
    scene.dragItemOriginCell = null;
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
    return;
  }

  resetPlanningSellButton(scene);

  const pos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
  const target = getPlanningItemDropTarget(scene, pos.x, pos.y);

  if (target) {
    if (target.type === "CRAFT_SLOT") {
      if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "add_craft_item", {
        item: { itemId, index: scene.dragItemOriginCell?.index ?? target.slotIndex },
        itemId,
        slotIndex: target.slotIndex,
        to: { slotIndex: target.slotIndex }
      }, { roles: ["item", "destination"] }) === false) {
        scene.dragItemId = null;
        scene.dragItemOriginCell = null;
        refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
        return;
      }
      addPlanningItemToCraftGridAt(scene as unknown as Parameters<typeof addPlanningItemToCraftGridAt>[0], itemId, target.slotIndex);
    } else if (target.type === "UNIT") {
      equipPlanningItemToUnit(
        scene as unknown as Parameters<typeof equipPlanningItemToUnit>[0],
        itemId,
        target.unit as unknown as Parameters<typeof equipPlanningItemToUnit>[2],
        target
      );
    } else if (target.type === "SELL") {
      if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "sell_item", { itemId, targetType: "SELL" }) === false) {
        scene.dragItemId = null;
        scene.dragItemOriginCell = null;
        refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
        return;
      }
      sellPlanningInventoryItem(scene as unknown as Parameters<typeof sellPlanningInventoryItem>[0], itemId);
    }
  }

  scene.dragItemId = null;
  scene.dragItemOriginCell = null;
  refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
}

export function installPlanningBoardInteraction(scene: PlanningDragScene, installBoardInput: BoardInputInstaller = installSharedBoardViewInput as unknown as BoardInputInstaller): void {
  installBoardInput(scene, {
    handleWheel: (pointer, dy) => {
      if (scene.activeResultModalScrollController) {
        scene.activeResultModalScrollController.onWheel(pointer, dy);
        return true;
      }
      if (scene.versionInfoVisible) return true;
      if (scene.libraryModal?.isOpen()) {
        scene.libraryModal.scrollBy(dy);
        return true;
      }
      if (scene.historyModalVisible) {
        onPlanningHistoryWheel(scene as unknown as Parameters<typeof onPlanningHistoryWheel>[0], dy);
        return true;
      }
      if (pointPlanningInUnitInfoPanel(scene as unknown as Parameters<typeof pointPlanningInUnitInfoPanel>[0], pointer.x, pointer.y)) {
        onPlanningUnitInfoPanelWheel(scene as unknown as Parameters<typeof onPlanningUnitInfoPanelWheel>[0], dy);
        return true;
      }
      if (pointInPlanningRightPanel(scene as unknown as Parameters<typeof pointInPlanningRightPanel>[0], pointer.x, pointer.y)) {
        scrollPlanningRightPanel(scene as unknown as Parameters<typeof scrollPlanningRightPanel>[0], dy);
        return true;
      }
      return false;
    },
    handlePointerDown: (pointer) => {
      if (scene.libraryModal?.isOpen() || scene.versionInfoVisible || scene.resultModalVisible) return true;
      if (pointer?.rightButtonDown?.()) return true;
      if (shouldBlockPlanningTutorialPointer(scene, pointer)) {
        showPlanningTutorialBlockedHint(scene as unknown as Parameters<typeof showPlanningTutorialBlockedHint>[0]);
        return true;
      }

      if (
        pointer.leftButtonDown() &&
        !scene.isItemDragging &&
        !scene.itemPointerDown &&
        scene.phase === PHASE.PLANNING &&
        !scene.libraryModal?.isOpen() &&
        !scene.historyModalVisible &&
        !scene.settingsVisible &&
        !scene.versionInfoVisible
      ) {
        const pos = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
        const unit = getPlanningUnitAt(scene as unknown as Parameters<typeof getPlanningUnitAt>[0], pos.x, pos.y);
        if (unit) {
          startPlanningUnitDrag(scene, unit as unknown as DragOrigin & { unit: DragUnit }, pointer);
          return true;
        }
      }
      return !pointPlanningInBoardPanel(scene as unknown as Parameters<typeof pointPlanningInBoardPanel>[0], pointer.x, pointer.y);
    },
    handlePointerMove: (pointer) => {
      if (scene.libraryModal?.isOpen() || scene.versionInfoVisible) return true;
      if (scene.isItemDragging) {
        updatePlanningItemDrag(scene, pointer);
        return true;
      }
      if (scene.itemPointerDown && !scene.isItemDragging) {
        const dx0 = pointer.x - scene.itemPointerDown.x;
        const dy0 = pointer.y - scene.itemPointerDown.y;
        if (Math.hypot(dx0, dy0) > 6) {
          startPlanningItemDrag(scene, scene.itemPointerDown.cell, pointer);
        }
        return true;
      }
      if (scene.isUnitDragging) {
        updatePlanningUnitDrag(scene, pointer);
        return true;
      }
      return false;
    },
    handlePointerRelease: (pointer) => {
      scene.itemPointerDown = null;
      if (scene.isItemDragging) {
        endPlanningItemDrag(scene, pointer);
        return true;
      }
      if (scene.isUnitDragging) {
        endPlanningUnitDrag(scene, pointer);
        return true;
      }
      return false;
    },
    allowBoardPanStart: (pointer) => pointPlanningInBoardPanel(scene as unknown as Parameters<typeof pointPlanningInBoardPanel>[0], pointer.x, pointer.y),
    getFinishPanOptions: () => ({ clearHighlightsOnTap: false })
  });
}

