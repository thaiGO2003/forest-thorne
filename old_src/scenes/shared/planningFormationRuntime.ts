import Phaser from "phaser";
import { PHASE, ROWS, PLAYER_COLS, RIGHT_COL_START } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";

import { ITEM_BY_ID, getItemSellPrice, canEquipItemByStarLevel } from "../../data/items.js";
import { BoardSystem, type Board, type Bench, type BoardUnit } from "../../systems/BoardSystem.js";

import {
  canAffordWithCreative,
  createCreativeSandboxClone,
  gainGoldWithCreative,
  spendGoldWithCreative
} from "../../core/creativeMode.js";
import { sellPlanningItem as sellPlanningDragItem } from "./planningDragRuntime.js";

import { createPlanningBenchSlots, refreshPlanningBenchUi } from "./planningBenchRuntime.js";
import { getPlanningCraftActiveIndices, getPlanningCraftReservedCounts } from "./planningCraftRuntime.js";
import { canPlanningOccupyCreativeSandboxCell, findPlanningCreativeSandboxUnit, isPlanningCreativeMode, planningRemoveCreativeSandboxUnitByUid, tryPlanningAutoMergeCreativeSandbox } from "./planningCreativeSandboxRuntime.js";
import { getPlanningUnitUnequipCost } from "./planningDragRuntime.js";
import { refreshPlanningStorageUi } from "./planningInventoryRuntime.js";
import { getPlanningEquipmentNameKey, getPlanningItemCount, isPlanningEquipmentItem, planningConsumeItem, planningNormalizeEquipIds } from "./planningItemHelpersRuntime.js";
import { computePlanningLayout } from "./planningLayoutRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { persistPlanningProgress } from "./planningRunStateRuntime.js";
import { getPlanningDeployCap, getPlanningDeployCount, tryPlanningAutoMerge } from "./planningShopActionsRuntime.js";
import { buildPlanningTutorialSellContext, buildPlanningTutorialUnequipContext } from "./planningTutorialRuntime.js";
import { setPlanningUnitInfoSelectionFromOwnedUnit } from "./planningUnitInfoRuntime.js";

import { getEquipmentTier } from "../../data/items.js";
import { resolveUnitEquipmentSlotCap } from "../../data/unitCatalog.js";
import { ShopSystem, type ShopPlayer } from "../../systems/ShopSystem.js";
import { guardPlanningTutorialAction, recordPlanningTutorialEvent } from "./planningTutorialRuntime.js";

type MoveRegion = "BOARD" | "BENCH" | "DUMMY" | "SANDBOX_BOARD";
type MoveTargetRegion = "BOARD" | "BENCH";

interface MoveFrom {
  region: MoveRegion;
  row?: number;
  col?: number;
  index?: number | null;
  unit?: { uid?: string };
  uid?: string;
}

interface MoveTo {
  region: MoveTargetRegion;
  row?: number;
  col?: number;
  index?: number;
}

interface MoveArgs {
  from: MoveFrom;
  to: MoveTo;
}

interface FormationUnit extends BoardUnit {
  uid: string;
  base: { name: string; tier: number; [key: string]: unknown };
  side?: "LEFT" | "RIGHT";
  row?: number;
  col?: number;
  [key: string]: unknown;
}

interface PlanningPlayer {
  board: Board;
  bench: Bench;
  gold: number;
  benchUpgradeLevel?: number;
  benchBonus?: number;
  itemBag?: string[];
  creativeSandboxUnits?: FormationUnit[];
  [key: string]: unknown;
}

interface PlanningSceneLike extends Phaser.Scene {
  isUnitDragging: boolean;
  settingsVisible: boolean;
  phase: string;
  overlaySprites: Phaser.GameObjects.GameObject[];
  player: PlanningPlayer;
  selectedBenchIndex: number | null;
  selectedInventoryItemId: string | null;
  aiMode: string;
  layout: unknown;
  dragUnit?: { uid?: string } | null;
  tryEquipSelectedItem?: (unit: FormationUnit) => void;
  createOwnedUnit: (...args: unknown[]) => FormationUnit;
  audioFx: { play: (key: string) => void };
  benchUpgradeLevel: number;
  craftGridItems: (string | null)[];
  tutorialOverlay?: { handleTrigger: (event: string) => void } | null;
  [key: string]: unknown;
}

interface SellOptions {
  tutorialContext?: unknown;
  tutorialGuardOptions?: unknown;
  skipTutorialGuard?: boolean;
  source?: string;
}

export function onPlanningPlayerCellClick(scene: PlanningSceneLike, row: number, col: number): void {
    if (scene.isUnitDragging) return;
    if (scene.settingsVisible) return;
    if (!canPlanningInteractFormation(scene)) {
      if (scene.phase === PHASE.AUGMENT) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.chooseAugmentFirst"), "EVENT");
      return;
    }
    if (scene.overlaySprites.length) return;

    const occupant = BoardSystem.getUnitAt(scene.player.board, row, col) as FormationUnit | null;
    const selected = scene.selectedBenchIndex != null ? scene.player.bench[scene.selectedBenchIndex] as FormationUnit | null : null;

    if (selected) {
      setPlanningUnitInfoSelectionFromOwnedUnit((scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[0]), selected as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[1], {
        source: "bench",
        benchIndex: scene.selectedBenchIndex ?? -1
      });
      if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "move_unit", {
        from: { region: "BENCH", index: scene.selectedBenchIndex, unit: selected },
        to: { region: "BOARD", row, col }
      }) === false) {
        return;
      }
      const result = BoardSystem.placeBenchUnitOnBoard(
        scene.player.board,
        scene.player.bench,
        (scene.selectedBenchIndex ?? -1),
        row,
        col,
        getPlanningDeployCap((scene as unknown as Parameters<typeof getPlanningDeployCap>[0])),
        true
      );

      if (!result.success) {
        if (result.error === 'Deploy limit reached') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]),
            t("planning.formation.deployLimitReached", { current: getPlanningDeployCount((scene as unknown as Parameters<typeof getPlanningDeployCount>[0])), max: getPlanningDeployCap((scene as unknown as Parameters<typeof getPlanningDeployCap>[0])) }),
            "EVENT"
          );
        } else if (result.error === 'Duplicate unit on board') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.duplicateOnBoard"), "EVENT");
        } else if (result.error) {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), result.error, "EVENT");
        }
        return;
      }

      scene.selectedBenchIndex = null;
      const placedUnit = BoardSystem.getUnitAt(scene.player.board, row, col) as FormationUnit | null;
      if (placedUnit) {
        setPlanningUnitInfoSelectionFromOwnedUnit((scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[0]), placedUnit as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[1], {
          source: "board",
          row,
          col
        });
      }
      tryPlanningAutoMerge((scene as unknown as Parameters<typeof tryPlanningAutoMerge>[0]));
      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "place_board");
      scene.tutorialOverlay?.handleTrigger("place_board");
      return;
    }

    if (occupant) {
      setPlanningUnitInfoSelectionFromOwnedUnit((scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[0]), occupant as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[1], {
        source: "board",
        row,
        col
      });
      if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "move_unit", {
        from: { region: "BOARD", row, col, unit: occupant },
        to: { region: "BENCH", index: scene.player.bench.length }
      }) === false) {
        return;
      }
      const result = BoardSystem.moveBoardUnitToBench(
        scene.player.board,
        scene.player.bench,
        row,
        col,
        scene.player.bench.length,
        getPlanningBenchCap(scene),
        false
      );

      if (!result.success) {
        if (result.error === 'Bench is full') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.benchFull"), "EVENT");
        } else if (result.error) {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), result.error, "EVENT");
        }
        return;
      }

      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "move_board_to_bench");
    }
}

export function onPlanningBenchClick(scene: PlanningSceneLike, index: number): void {
    if (scene.settingsVisible) return;
    if (!canPlanningInteractFormation(scene)) {
      if (scene.phase === PHASE.AUGMENT) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.chooseAugmentFirst"), "EVENT");
      return;
    }
    if (scene.overlaySprites.length) return;
    if (index >= getPlanningBenchCap(scene)) return;
    const unit = scene.player.bench[index] as FormationUnit | null;
    if (unit && scene.selectedInventoryItemId) {
      const unitTarget = { region: "BENCH", index, unit };
      setPlanningUnitInfoSelectionFromOwnedUnit((scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[0]), unit as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[1], { source: "bench", benchIndex: index });
      if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "equip_item", {
        itemId: scene.selectedInventoryItemId,
        unit: unitTarget,
        item: { itemId: scene.selectedInventoryItemId, index: 0 },
        to: unitTarget
      }, { roles: ["item", "unit"] }) === false) {
        return;
      }
      scene.tryEquipSelectedItem?.(unit);
      return;
    }
    if (unit && guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "select_bench", { index, unit, from: { region: "BENCH", index, unit } }, { roles: ["source"] }) === false) {
      return;
    }
    if (unit) setPlanningUnitInfoSelectionFromOwnedUnit((scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[0]), unit as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromOwnedUnit>[1], { source: "bench", benchIndex: index });
    if (index >= scene.player.bench.length) {
      scene.selectedBenchIndex = null;
      refreshPlanningBenchUi((scene as unknown as Parameters<typeof refreshPlanningBenchUi>[0]));
      return;
    }

    scene.selectedBenchIndex = scene.selectedBenchIndex === index ? null : index;
    refreshPlanningBenchUi((scene as unknown as Parameters<typeof refreshPlanningBenchUi>[0]));
}

export function movePlanningUnit(scene: PlanningSceneLike, from: MoveFrom | null, to: MoveTo | null, allowSwap: boolean = true): boolean {
    if (!from || !to) return false;
    if (scene.settingsVisible || !canPlanningInteractFormation(scene) || scene.overlaySprites.length) return false;
    if (!["BOARD", "BENCH", "DUMMY", "SANDBOX_BOARD"].includes(from.region) || !["BOARD", "BENCH"].includes(to.region)) return false;
    if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "move_unit", { from, to } as unknown as Parameters<typeof guardPlanningTutorialAction>[2]) === false) return false;

    const board = scene.player.board;
    const bench = scene.player.bench;
    let result: { success: boolean; error?: string } | null = null;
    const tutorialBenchToBoard = from.region === "BENCH" && to.region === "BOARD";
    const tutorialBoardReposition = from.region === "BOARD" && to.region === "BOARD";
    const targetRow = to.row ?? 0;
    const targetCol = to.col ?? 0;
    const targetSide: "LEFT" | "RIGHT" = to.region === "BOARD" && targetCol >= RIGHT_COL_START ? "RIGHT" : "LEFT";

    if (from.region === "DUMMY") {
      if (to.region !== "BOARD") return false;
      const selectedUnit = from.index != null ? (scene.player?.bench?.[from.index] as FormationUnit | null | undefined) ?? null : null;
      if (!selectedUnit) {
        addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("log.dummySlotInactive"), "EVENT");
        return false;
      }
      if (!isPlanningCreativeMode((scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]))) return false;
      if (!canPlanningOccupyCreativeSandboxCell((scene as unknown as Parameters<typeof canPlanningOccupyCreativeSandboxCell>[0]), targetRow, targetCol, targetSide)) {
        addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.cellOccupiedByOtherSandbox"), "EVENT");
        return false;
      }
      const clone = createCreativeSandboxClone(selectedUnit, scene.createOwnedUnit.bind(scene), {
        side: targetSide,
        row: targetRow,
        col: targetCol
      });
      if (!clone) return false;
      scene.player.creativeSandboxUnits = scene.player.creativeSandboxUnits ?? [];
      scene.player.creativeSandboxUnits.push(clone as unknown as FormationUnit);
      tryPlanningAutoMergeCreativeSandbox((scene as unknown as Parameters<typeof tryPlanningAutoMergeCreativeSandbox>[0]), targetSide);
      if (targetSide === "RIGHT") addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("log.enemySandboxOverride"), "EVENT");
      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      return true;
    }

    if (from.region === "SANDBOX_BOARD") {
      const sandboxUnit = findPlanningCreativeSandboxUnit((scene as unknown as Parameters<typeof findPlanningCreativeSandboxUnit>[0]), from.unit?.uid ?? from.uid ?? scene.dragUnit?.uid ?? null);
      if (!sandboxUnit) return false;
      if (to.region === "BOARD") {
        if (!canPlanningOccupyCreativeSandboxCell((scene as unknown as Parameters<typeof canPlanningOccupyCreativeSandboxCell>[0]), targetRow, targetCol, targetSide, sandboxUnit.uid)) {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.cellOccupied"), "EVENT");
          return false;
        }
        sandboxUnit.row = targetRow;
        sandboxUnit.col = targetCol;
        sandboxUnit.side = targetSide;
        tryPlanningAutoMergeCreativeSandbox((scene as unknown as Parameters<typeof tryPlanningAutoMergeCreativeSandbox>[0]), targetSide);
        refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
        persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
        return true;
      }
      return false;
    }

    if (to.region === "BOARD" && targetCol >= RIGHT_COL_START) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.cannotPlaceOnEnemyHalf"), "EVENT");
      return false;
    }

    const fromRow = from.row ?? 0;
    const fromCol = from.col ?? 0;
    if (from.region === "BOARD" && to.region === "BOARD") {
      result = BoardSystem.moveUnit(board, fromRow, fromCol, targetRow, targetCol, allowSwap);
    } else if (from.region === "BENCH" && to.region === "BOARD") {
      result = BoardSystem.placeBenchUnitOnBoard(
        board,
        bench,
        from.index ?? 0,
        targetRow,
        targetCol,
        getPlanningDeployCap((scene as unknown as Parameters<typeof getPlanningDeployCap>[0])),
        allowSwap
      );
    } else if (from.region === "BOARD" && to.region === "BENCH") {
      result = BoardSystem.moveBoardUnitToBench(
        board,
        bench,
        fromRow,
        fromCol,
        to.index ?? 0,
        getPlanningBenchCap(scene),
        allowSwap
      );
    } else if (from.region === "BENCH" && to.region === "BENCH") {
      result = BoardSystem.moveBenchUnit(bench, from.index ?? 0, to.index ?? 0, allowSwap);
    }

    if (!result || !result.success) {
      if (result?.error) {
        if (result.error === 'Deploy limit reached') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]),
            t("planning.formation.deployLimitReached", { current: getPlanningDeployCount((scene as unknown as Parameters<typeof getPlanningDeployCount>[0])), max: getPlanningDeployCap((scene as unknown as Parameters<typeof getPlanningDeployCap>[0])) }),
            "EVENT"
          );
        } else if (result.error === 'Duplicate unit on board') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.duplicateOnBoard"), "EVENT");
        } else if (result.error === 'Bench is full') {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.benchFull"), "EVENT");
        }
      }
      return false;
    }

    scene.selectedBenchIndex = null;
    tryPlanningAutoMerge((scene as unknown as Parameters<typeof tryPlanningAutoMerge>[0]));
    refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
    persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
    if (tutorialBenchToBoard) {
      recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "place_board");
      scene.tutorialOverlay?.handleTrigger("place_board");
    } else if (tutorialBoardReposition) {
      recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "move_board_unit");
      scene.tutorialOverlay?.handleTrigger("move_board_unit");
    }
    return true;
}

export function sellPlanningUnit(scene: PlanningSceneLike, uid: string, options: SellOptions = {}): boolean {
    if (!uid) return false;
    const tutorialContext = options?.tutorialContext ?? { uid };
    const tutorialGuardOptions = options?.tutorialGuardOptions;
    if (options?.skipTutorialGuard !== true && guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "sell_unit", tutorialContext as unknown as Parameters<typeof guardPlanningTutorialAction>[2], (tutorialGuardOptions as unknown as Parameters<typeof guardPlanningTutorialAction>[3])) === false) {
      return false;
    }

    const creativeUnit = findPlanningCreativeSandboxUnit((scene as unknown as Parameters<typeof findPlanningCreativeSandboxUnit>[0]), uid);
    if (creativeUnit) {
      const totalValue = getPlanningUnitSalePrice(scene, creativeUnit as unknown as FormationUnit);
      planningRemoveCreativeSandboxUnitByUid((scene as unknown as Parameters<typeof planningRemoveCreativeSandboxUnitByUid>[0]), uid);
      gainGoldWithCreative(scene.player, scene.aiMode, totalValue, { allowCreativeMutation: false });
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellCreativeUnit", { name: creativeUnit.base?.name ?? t("planning.ui.beastFallback"), star: creativeUnit.star, gold: totalValue }), "EVENT");
      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      return true;
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = BoardSystem.getUnitAt(scene.player.board, row, col) as FormationUnit | null;
        if (!unit || unit.uid !== uid) continue;

        const hasEquips = !!unit.equips && unit.equips.length > 0;
        const equipValue = hasEquips ? unit.equips!.reduce((sum: number, id) => sum + getItemSellPrice(id), 0) : 0;
        if (isPlanningCreativeMode((scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]))) {
          const totalValue = getPlanningUnitSalePrice(scene, unit);
          BoardSystem.removeUnit(scene.player.board, row, col);
          scene.selectedBenchIndex = null;
          gainGoldWithCreative(scene.player, scene.aiMode, totalValue, { allowCreativeMutation: false });
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellUnitLog", { name: unit.base.name, star: unit.star, gold: totalValue }), "EVENT");
          if (equipValue > 0) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellWithEquipsInfinite", { count: unit.equips!.length }), "EVENT");
          refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
          persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
          return true;
        }

        const shopPlayer = scene.player as unknown as ShopPlayer;
        const result = ShopSystem.sellUnit(shopPlayer, unit);

        if (result.success) {
          scene.player = result.player as unknown as PlanningPlayer;
          const totalValue = result.sellValue + equipValue;

          gainGoldWithCreative(scene.player, scene.aiMode, equipValue, { allowCreativeMutation: false });

          BoardSystem.removeUnit(scene.player.board, row, col);
          scene.selectedBenchIndex = null;
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellUnitLog", { name: unit.base.name, star: unit.star, gold: totalValue }), "EVENT");
          if (equipValue > 0) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellWithEquips", { count: unit.equips!.length }), "EVENT");
          refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
          persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
          recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "sell_unit");
          scene.tutorialOverlay?.handleTrigger("sell_unit");
          return true;
        } else {
          addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), result.error || t("planning.formation.cannotSell"), "EVENT");
          return false;
        }
      }
    }

    const benchIndex = scene.player?.bench?.findIndex((unit) => unit?.uid === uid) ?? -1;
    if (benchIndex >= 0) return sellPlanningBenchIndex(scene, benchIndex, options);
    return false;
}

export function sellPlanningBenchIndex(scene: PlanningSceneLike, index: number, options: SellOptions = {}): boolean {
    const unit = scene.player?.bench?.[index] as FormationUnit | null;
    if (!unit) return false;
    const tutorialContext = options?.tutorialContext ?? { from: { region: "BENCH", index, unit } };
    const tutorialGuardOptions = options?.tutorialGuardOptions ?? { roles: ["source"] };
    if (options?.skipTutorialGuard !== true && guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "sell_unit", tutorialContext as unknown as Parameters<typeof guardPlanningTutorialAction>[2], (tutorialGuardOptions as unknown as Parameters<typeof guardPlanningTutorialAction>[3])) === false) {
      return false;
    }

    const hasEquips = !!unit.equips && unit.equips.length > 0;
    const equipValue = hasEquips ? unit.equips!.reduce((sum: number, id) => sum + getItemSellPrice(id), 0) : 0;
    if (isPlanningCreativeMode((scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]))) {
      const totalValue = getPlanningUnitSalePrice(scene, unit);
      scene.player.bench.splice(index, 1);
      if (scene.selectedBenchIndex === index) scene.selectedBenchIndex = null;
      if (scene.selectedBenchIndex != null && scene.selectedBenchIndex > index) scene.selectedBenchIndex -= 1;
      gainGoldWithCreative(scene.player, scene.aiMode, totalValue, { allowCreativeMutation: false });
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellUnitLog", { name: unit.base.name, star: unit.star, gold: totalValue }), "EVENT");
      if (equipValue > 0) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellWithEquipsInfinite", { count: unit.equips!.length }), "EVENT");
      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      return true;
    }

    const shopPlayer = scene.player as unknown as ShopPlayer;
    const result = ShopSystem.sellUnit(shopPlayer, unit);

    if (result.success) {
      scene.player = result.player as unknown as PlanningPlayer;
      const totalValue = result.sellValue + equipValue;

      gainGoldWithCreative(scene.player, scene.aiMode, equipValue, { allowCreativeMutation: false });

      scene.player.bench.splice(index, 1);
      if (scene.selectedBenchIndex === index) scene.selectedBenchIndex = null;
      if (scene.selectedBenchIndex != null && scene.selectedBenchIndex > index) scene.selectedBenchIndex -= 1;
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellUnitLog", { name: unit.base.name, star: unit.star, gold: totalValue }), "EVENT");
      if (equipValue > 0) addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.sellWithEquips", { count: unit.equips!.length }), "EVENT");
      refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
      persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
      recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "sell_unit");
      scene.tutorialOverlay?.handleTrigger("sell_unit");
      return true;
    } else {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), result.error || t("planning.formation.cannotSell"), "EVENT");
      return false;
    }
}

export function unequipPlanningAll(scene: PlanningSceneLike, unit: FormationUnit, options: SellOptions = {}): boolean {
    if (!unit || !unit.equips || unit.equips.length === 0) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.noEquipsToUnequip", { name: unit?.base?.name || t("planning.ui.beastFallback") }), "EVENT");
      return false;
    }
    const tutorialContext = options?.tutorialContext ?? buildPlanningTutorialUnequipContext((scene as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[0]), unit as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[1], options?.source as unknown as Parameters<typeof buildPlanningTutorialUnequipContext>[2]);
    const tutorialGuardOptions = options?.tutorialGuardOptions ?? { roles: ["source", "destination"] };
    if (options?.skipTutorialGuard !== true
      && guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "unequip_item", tutorialContext as unknown as Parameters<typeof guardPlanningTutorialAction>[2], (tutorialGuardOptions as unknown as Parameters<typeof guardPlanningTutorialAction>[3])) === false) {
      return false;
    }

    const cost = getPlanningUnitUnequipCost((scene as unknown as Parameters<typeof getPlanningUnitUnequipCost>[0]), unit as unknown as Parameters<typeof getPlanningUnitUnequipCost>[1]);
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold || 0, cost)) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.unequipNoGold", { cost, name: unit.base.name }), "EVENT");
      scene.audioFx.play("error");
      return false;
    }

    spendGoldWithCreative(scene.player, scene.aiMode, cost);

    const equips = [...unit.equips];
    scene.player.itemBag = [...(scene.player.itemBag || []), ...equips];
    unit.equips = [];

    addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.unequipSuccess", { count: equips.length, name: unit.base.name, cost }), "EVENT");
    scene.audioFx.play("equip");
    refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
    persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
    recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "unequip_item");
    scene.tutorialOverlay?.handleTrigger("unequip_item");
    return true;
}

export function sellPlanningSelectedUnit(scene: PlanningSceneLike): void {
    if (scene.selectedBenchIndex == null) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.selectBenchUnitToSell"), "EVENT");
      return;
    }
    const unit = scene.player?.bench?.[scene.selectedBenchIndex] as FormationUnit | null | undefined ?? null;
    const tutorialContext = buildPlanningTutorialSellContext((scene as unknown as Parameters<typeof buildPlanningTutorialSellContext>[0]), {
      region: "BENCH",
      index: scene.selectedBenchIndex,
      unit
    } as unknown as Parameters<typeof buildPlanningTutorialSellContext>[1]);
    if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "sell_selected_unit", tutorialContext, { roles: ["source", "destination"] }) === false) return;
    if (!sellPlanningBenchIndex(scene, scene.selectedBenchIndex, {
      skipTutorialGuard: true,
      tutorialContext
    })) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.noValidUnitToSell"), "EVENT");
    }
}

export function equipPlanningItemToUnit(scene: PlanningSceneLike, itemId: string, unit: FormationUnit, target: unknown = null): boolean {
    if (!itemId || !unit) return false;
    const unitTarget = target ?? { unit };
    if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "equip_item", {
      itemId,
      unit: unitTarget,
      to: unitTarget
    } as unknown as Parameters<typeof guardPlanningTutorialAction>[2], { roles: ["item", "unit"] }) === false) {
      return false;
    }
    if (!isPlanningEquipmentItem((scene as unknown as unknown), itemId)) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.onlyEquipmentAllowed"), "EVENT");
      return false;
    }
    const item = ITEM_BY_ID[itemId];
    const unitStar = Number.isFinite(unit?.star) ? Math.max(1, Math.floor(unit.star)) : 1;
    if (!canEquipItemByStarLevel(unitStar, itemId)) {
      const equipTier = getEquipmentTier(itemId);
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]),
        t("planning.formation.cannotEquipTier", { name: unit.base.name, star: unitStar, icon: item?.icon ?? "✨", itemName: item?.name ?? itemId, tier: equipTier }),
        "EVENT"
      );
      return false;
    }
    const equipmentSlotCap = resolveUnitEquipmentSlotCap(unit, unitStar as unknown as null);
    const equips = planningNormalizeEquipIds((scene as unknown as unknown), unit.equips ?? [], unit);
    unit.equips = equips;
    const selectedEquipKey = getPlanningEquipmentNameKey((scene as unknown as unknown), itemId);
    const hasSameName = equips.some((existingId) => getPlanningEquipmentNameKey((scene as unknown as unknown), existingId) === selectedEquipKey);
    if (hasSameName) {
      const selectedItem = ITEM_BY_ID[itemId];
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.alreadyHasEquip", { name: unit.base.name, icon: selectedItem?.icon ?? "✨", itemName: selectedItem?.name ?? itemId }), "EVENT");
      return false;
    }
    if (equips.length >= equipmentSlotCap) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.maxEquipSlots", { name: unit.base.name, cap: equipmentSlotCap }), "EVENT");
      return false;
    }
    if (!planningConsumeItem((scene as unknown as Parameters<typeof planningConsumeItem>[0]), itemId, 1)) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.notEnoughItemsToEquip"), "EVENT");
      return false;
    }
    unit.equips = [...equips, itemId];
    scene.audioFx.play("buy");
    addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.equipSuccess", { icon: item?.icon ?? "✨", itemName: item?.name ?? itemId, unitName: unit.base.name }), "EVENT");
    refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
    persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
    recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "equip_item");
    scene.tutorialOverlay?.handleTrigger("equip_item");
    return true;
}

export function addPlanningItemToCraftGridAt(scene: PlanningSceneLike, itemId: string, slotIndex: number): boolean {
    if (!itemId) return false;
    if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "add_craft_item", {
      itemId,
      slotIndex,
      to: { slotIndex }
    } as unknown as Parameters<typeof guardPlanningTutorialAction>[2], { roles: ["item", "destination"] }) === false) {
      return false;
    }
    const item = ITEM_BY_ID[itemId];
    if (!item || (item.kind !== "base" && item.kind !== "equipment")) return false;
    const active = new Set(getPlanningCraftActiveIndices((scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0])));
    if (!active.has(slotIndex)) return false;
    if (scene.craftGridItems[slotIndex]) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.craftCellOccupied"), "EVENT");
      return false;
    }
    const totalOwned = getPlanningItemCount((scene as unknown as Parameters<typeof getPlanningItemCount>[0]), itemId);
    const reserved = getPlanningCraftReservedCounts((scene as unknown as Parameters<typeof getPlanningCraftReservedCounts>[0]))[itemId] ?? 0;
    if (reserved >= totalOwned) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.craft.itemNotInBag", { icon: item.icon, name: item.name }), "EVENT");
      return false;
    }
    scene.craftGridItems[slotIndex] = itemId;
    scene.audioFx.play("click");
    refreshPlanningStorageUi((scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]));
    recordPlanningTutorialEvent((scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0]), "add_craft_item");
    scene.tutorialOverlay?.handleTrigger("add_craft_item");
    return true;
}

export function checkPlanningDuplicateUnit(scene: PlanningSceneLike, baseId: string, ignoreRow: number = -1, ignoreCol: number = -1): boolean {
    return BoardSystem.checkDuplicateUnit(scene.player.board, baseId, ignoreRow, ignoreCol);
}

export function getPlanningUnitSalePrice(scene: PlanningSceneLike, unit: FormationUnit): number {
    if (!unit?.base) return 1;
    let price = Math.max(1, Math.floor(unit.base.tier * (unit.star === 3 ? 5 : unit.star === 2 ? 3 : 1)));

    if (Array.isArray(unit.equips)) {
      unit.equips.forEach(itemId => {
        price += getItemSellPrice(itemId);
      });
    }
    return price;
}

export function sellPlanningInventoryItem(scene: PlanningSceneLike, itemId: string): boolean {
    if (guardPlanningTutorialAction((scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0]), "sell_item", { itemId }) === false) return false;
    return sellPlanningDragItem((scene as unknown as Parameters<typeof sellPlanningDragItem>[0]), itemId);
}

export function getPlanningBenchCap(scene: PlanningSceneLike): number {
    const level = Number.isFinite(scene.player?.benchUpgradeLevel)
      ? Math.floor(scene.player.benchUpgradeLevel as number)
      : (scene.benchUpgradeLevel as number);
    const bonus = Number.isFinite(scene.player?.benchBonus) ? Math.floor(scene.player.benchBonus as number) : 0;
    const baseCap = (level > 0 ? 14 : 8) + bonus;
    return isPlanningCreativeMode((scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) ? Math.max(1, baseCap - 1) : baseCap;
}

export function upgradePlanningBench(scene: PlanningSceneLike): void {
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
    if (scene.benchUpgradeLevel > 0) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.benchMaxLevel"), "EVENT");
      return;
    }
    const cost = 10;
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.benchUpgradeNoGold"), "EVENT");
      return;
    }
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    scene.benchUpgradeLevel = 1;
    scene.player.benchUpgradeLevel = 1;
    addPlanningLog((scene as unknown as Parameters<typeof addPlanningLog>[0]), t("planning.formation.benchUpgraded14"), "EVENT");
    scene.audioFx.play("buy");

    scene.layout = computePlanningLayout((scene as unknown as Parameters<typeof computePlanningLayout>[0]));
    createPlanningBenchSlots((scene as unknown as Parameters<typeof createPlanningBenchSlots>[0]));
    refreshPlanningUi((scene as unknown as Parameters<typeof refreshPlanningUi>[0]));
    persistPlanningProgress((scene as unknown as Parameters<typeof persistPlanningProgress>[0]));
}

export function canPlanningInteractFormation(scene: PlanningSceneLike): boolean {
    if (scene.phase === PHASE.PLANNING) return true;
    if (scene.phase === PHASE.AUGMENT && !scene.overlaySprites.length) return true;
    return false;
}
