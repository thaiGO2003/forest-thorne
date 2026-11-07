import { PHASE } from "../../core/boardConstants.js";

import { GamepadController } from "../../core/GamepadController.js";
import { PLAYER_COLS as _PC } from "../../core/boardConstants.js";

import { refreshPlanningBenchUi } from "./planningBenchRuntime.js";
import { findPlanningPlayerBoardCellFromPoint } from "./planningBoardInteractionRuntime.js";
import { beginPlanningCombat } from "./planningCombatTransitionRuntime.js";
import { showPlanningContextMenu } from "./planningContextMenuRuntime.js";
import { endPlanningItemDrag, endPlanningUnitDrag } from "./planningDragRuntime.js";
import { onPlanningBenchClick, onPlanningPlayerCellClick, sellPlanningSelectedUnit } from "./planningFormationRuntime.js";
import { onPlanningExportJsonClick, togglePlanningAudio } from "./planningPersistenceRuntime.js";
import { startPlanningNewRun } from "./planningRunStateRuntime.js";
import { togglePlanningHistoryModal, togglePlanningSettingsOverlay, togglePlanningVersionInfoModal } from "./planningSettingsRuntime.js";
import { buyPlanningFromShop } from "./planningShopActionsRuntime.js";

import { BoardSystem } from "../../systems/BoardSystem.js";
import { onPlanningImportJsonClick } from "./planningPersistenceRuntime.js";
import { guardPlanningTutorialAction } from "./planningTutorialRuntime.js";
import { isSharedPanPointer } from "./sceneBoardInputController.js";
import { watchKeyboardBindings, type KeyboardActionHandler } from "../../core/keyboardBindings.js";

interface ContextMenuUnitLocal {
  baseId: string;
  uid?: string;
}

interface PlanningKeyboardEventLike {
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
}

interface PlanningPointerLike {
  x: number;
  y: number;
  worldX?: number;
  worldY?: number;
  isDown: boolean;
  rightButtonDown?: () => boolean;
  [key: string]: unknown;
}

interface PlanningBenchSlotLike {
  bg: {
    visible: boolean;
    getBounds: () => { contains: (x: number, y: number) => boolean };
  };
  benchIndex: number | null;
}

type PlanningSceneInput = Phaser.Scene & {
  settingsVisible: boolean;
  versionInfoVisible: boolean;
  historyModalVisible: boolean;
  libraryModal?: { isOpen: () => boolean; hide: () => void } | null;
  phase: string;
  _settingsIsShortcutsOpen?: () => boolean;
  _settingsCloseShortcutsView?: () => void;
  input: {
    keyboard: {
      on: (event: string, handler: (event: PlanningKeyboardEventLike) => void) => void;
    };
    on: (event: string, handler: (pointer: PlanningPointerLike) => void) => void;
    mouse?: { disableContextMenu: () => void };
    activePointer?: PlanningPointerLike | null;
  };
  benchSlots: PlanningBenchSlotLike[];
  player: { bench: (ContextMenuUnitLocal | null)[]; board: unknown };
  isBoardDragging: boolean;
  isUnitDragging: boolean;
  isItemDragging: boolean;
  lastDragPoint: { x: number; y: number } | null;
  boardPointerDown: { x: number; y: number } | null;
  boardDragConsumed: boolean;
  selectedBenchIndex: number | null;
  gamepadController?: { update: (handlers: Record<string, KeyboardActionHandler>) => void; destroy: () => void };
  buttons?: Record<string, unknown>;
  audioFx?: { play: (key: string) => void };
};

function isPlanningShortcutBlocked(scene: PlanningSceneInput): boolean {
  return scene.settingsVisible
    || scene.versionInfoVisible
    || scene.historyModalVisible
    || !!scene.libraryModal?.isOpen()
    || scene.phase !== PHASE.PLANNING;
}

function handlePlanningSettingsKey(scene: PlanningSceneInput): void {
  if (scene._settingsIsShortcutsOpen?.()) {
    scene._settingsCloseShortcutsView?.();
    return;
  }
  if (scene.versionInfoVisible) {
    togglePlanningVersionInfoModal(scene as unknown as Parameters<typeof togglePlanningVersionInfoModal>[0], false);
    return;
  }
  if (scene.libraryModal?.isOpen()) {
    scene.libraryModal.hide();
    return;
  }
  if (scene.historyModalVisible) {
    togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
    return;
  }
  togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0]);
}

export function setPlanningupInput(scene: PlanningSceneInput): void {
    const planningHandlers: Record<string, KeyboardActionHandler> = {
      startCombat: () => {
        if (!scene.settingsVisible && !scene.versionInfoVisible && !scene.historyModalVisible && !scene.libraryModal?.isOpen() && scene.phase === PHASE.PLANNING) {
          if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "begin_combat", { buttonKey: "start" }) === false) return;
          beginPlanningCombat(scene as unknown as Parameters<typeof beginPlanningCombat>[0]);
        }
      },
      sellUnit: (event: unknown) => {
        const ev = event as PlanningKeyboardEventLike;
        if (isPlanningShortcutBlocked(scene)) return;
        if (ev?.ctrlKey || ev?.metaKey) return;
        if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "sell_selected_unit") === false) return;
        sellPlanningSelectedUnit(scene as unknown as Parameters<typeof sellPlanningSelectedUnit>[0]);
      },
      newRun: () => startPlanningNewRun(scene as unknown as Parameters<typeof startPlanningNewRun>[0]),
      toggleAudio: () => {
        if (isPlanningShortcutBlocked(scene)) return;
        if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_toggle_audio") === false) return;
        togglePlanningAudio(scene as unknown as Parameters<typeof togglePlanningAudio>[0]);
      },
      settings: () => handlePlanningSettingsKey(scene)
    };
    watchKeyboardBindings(scene as unknown as Parameters<typeof watchKeyboardBindings>[0], "planning", planningHandlers);

    scene.input.keyboard.on("keydown-S", (event: PlanningKeyboardEventLike) => {
      if (isPlanningShortcutBlocked(scene)) return;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault?.();
        onPlanningExportJsonClick(scene as unknown as Parameters<typeof onPlanningExportJsonClick>[0]);
      }
    });
    scene.input.keyboard.on("keydown-O", (event: PlanningKeyboardEventLike) => {
      if (isPlanningShortcutBlocked(scene)) return;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault?.();
        void onPlanningImportJsonClick(scene as unknown as Parameters<typeof onPlanningImportJsonClick>[0]);
      }
    });
    scene.input.keyboard.on("keydown-DELETE", () => {
      if (!scene.settingsVisible && !scene.versionInfoVisible && !scene.historyModalVisible && !scene.libraryModal?.isOpen() && scene.phase === PHASE.PLANNING) {
        if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "sell_selected_unit") === false) return;
        sellPlanningSelectedUnit(scene as unknown as Parameters<typeof sellPlanningSelectedUnit>[0]);
      }
    });

    scene.input.on("pointerdown", (pointer: PlanningPointerLike) => {
      if (pointer.rightButtonDown?.()) {
        handlePlanningRightClick(scene, pointer);
      }
    });

    scene.input.mouse?.disableContextMenu();
}

export function setPlanningupGamepadInput(scene: PlanningSceneInput): void {
    if (scene.gamepadController) scene.gamepadController.destroy();
    scene.gamepadController = new GamepadController(scene as unknown as Phaser.Scene);
}

export function handlePlanningRightClick(scene: PlanningSceneInput, pointer: PlanningPointerLike): void {
    if (scene.phase !== PHASE.PLANNING) return;
    if (scene.settingsVisible || scene.libraryModal?.isOpen() || scene.historyModalVisible || scene.versionInfoVisible) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "context_menu") === false) return;
    if (scene.isBoardDragging) {
      scene.isBoardDragging = false;
      scene.lastDragPoint = null;
      scene.boardPointerDown = null;
      scene.boardDragConsumed = false;
    }

    // Check Bench
    for (let i = 0; i < scene.benchSlots.length; i++) {
      const slot = scene.benchSlots[i];
      if (slot.bg.visible && slot.bg.getBounds().contains(pointer.x, pointer.y)) {
        const benchIndex = slot.benchIndex;
        const unit = Number.isInteger(benchIndex) ? scene.player.bench[benchIndex as number] : null;
        if (unit) {
          // Show Menu instead of direct sell
          showPlanningContextMenu(
            scene as unknown as Parameters<typeof showPlanningContextMenu>[0],
            unit as unknown as Parameters<typeof showPlanningContextMenu>[1],
            "BENCH",
            benchIndex as number,
            0,
            pointer.x,
            pointer.y
          );
          return;
        }
      }
    }

    // Check Board
    const hit = findPlanningPlayerBoardCellFromPoint(scene as unknown as Parameters<typeof findPlanningPlayerBoardCellFromPoint>[0], pointer.x, pointer.y, true);
    if (hit) {
      const hitResult = hit as { row: number; col: number };
      const r = hitResult.row;
      const c = hitResult.col;
      const unit = BoardSystem.getUnitAt(scene.player.board as Parameters<typeof BoardSystem.getUnitAt>[0], r, c);
      if (unit) {
        showPlanningContextMenu(
          scene as unknown as Parameters<typeof showPlanningContextMenu>[0],
          unit as unknown as Parameters<typeof showPlanningContextMenu>[1],
          "BOARD",
          r,
          c,
          pointer.x,
          pointer.y
        );
        return;
      }
    }
}

export function getPlanningPointerWorldPosition(scene: PlanningSceneInput, pointer: PlanningPointerLike | null | undefined): { x: number; y: number } {
    if (!pointer) return { x: 0, y: 0 };
    // Prefer pointer.x / pointer.y which are already in game coords (Scale.FIT).
    // pointer.worldX can be offset when resolution/DPR > 1.
    if (Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
      return { x: pointer.x, y: pointer.y };
    }
    const worldX = Number(pointer.worldX);
    const worldY = Number(pointer.worldY);
    if (Number.isFinite(worldX) && Number.isFinite(worldY)) {
      return { x: worldX, y: worldY };
    }
    return { x: 0, y: 0 };
}

export function isPlanningPanPointer(scene: PlanningSceneInput, pointer: PlanningPointerLike): boolean {
    return isSharedPanPointer(pointer as unknown as Parameters<typeof isSharedPanPointer>[0]);
}

export function planningUpdate(scene: PlanningSceneInput, _time: number, _delta: number): void {
    const pointer = scene.input?.activePointer;
    if (scene.isUnitDragging && pointer && !pointer.isDown) {
      endPlanningUnitDrag(scene as unknown as Parameters<typeof endPlanningUnitDrag>[0], pointer as unknown as Parameters<typeof endPlanningUnitDrag>[1]);
    }
    // Auto-release item drag when pointer is no longer down
    if (scene.isItemDragging && pointer && !pointer.isDown) {
      endPlanningItemDrag(scene as unknown as Parameters<typeof endPlanningItemDrag>[0], pointer as unknown as Parameters<typeof endPlanningItemDrag>[1]);
    }

    if (scene.gamepadController) {
      scene.gamepadController.update({
        buyFromShop: (...args: unknown[]) => {
          const index = args[0] as number;
          buyPlanningFromShop(scene as unknown as Parameters<typeof buyPlanningFromShop>[0], index);
        },
        onBenchClick: (...args: unknown[]) => {
          const index = args[0] as number;
          onPlanningBenchClick(scene as unknown as Parameters<typeof onPlanningBenchClick>[0], index);
        },
        onPlayerCellClick: (...args: unknown[]) => {
          const row = args[0] as number;
          const col = args[1] as number;
          if (scene.phase === PHASE.PLANNING) onPlanningPlayerCellClick(scene as unknown as Parameters<typeof onPlanningPlayerCellClick>[0], row, col);
        },
        onCancelSelection: () => {
          if (scene.selectedBenchIndex != null) {
            scene.selectedBenchIndex = null;
            refreshPlanningBenchUi(scene as unknown as Parameters<typeof refreshPlanningBenchUi>[0]);
          }
        },
        onCloseModal: () => {
          if (scene.versionInfoVisible) {
            togglePlanningVersionInfoModal(scene as unknown as Parameters<typeof togglePlanningVersionInfoModal>[0], false);
          } else if (scene.libraryModal?.isOpen()) {
            scene.libraryModal.hide();
          } else if (scene.historyModalVisible) {
            togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
          } else if (scene.settingsVisible) {
            togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
          }
        },
        onSettingsToggle: () => togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0]),
        onCombatStart: () => {
          if (scene.phase === PHASE.PLANNING && !scene.settingsVisible) beginPlanningCombat(scene as unknown as Parameters<typeof beginPlanningCombat>[0]);
        }
      });
    }
}
