import { PHASE } from "../../core/boardConstants.js";
import { watchKeyboardBindings } from "../../core/keyboardBindings.js";
import type { KeyboardScene } from "../../core/keyboardBindings.js";
import { installSharedBoardViewInput } from "./sceneBoardInputController.js";
import type { SharedBoardInputInstaller, SharedBoardInputOptions } from "./sceneBoardInputController.js";

type LibraryModalLike = { isOpen: () => boolean; hide: () => void; scrollBy: (dy: number) => void };

interface CombatInputScene extends KeyboardScene {
  settingsVisible?: boolean;
  historyModalVisible?: boolean;
  libraryModal?: LibraryModalLike | null;
  phase: string;
  _settingsIsShortcutsOpen?: () => boolean;
  _settingsCloseShortcutsView?: () => void;
  stepCombat: () => void;
  toggleSettingsOverlay: (force?: boolean) => void;
  toggleAudio: () => void;
  toggleHistoryModal: (force?: boolean) => void;
  onHistoryWheel: (dy: number) => void;
  pointInBoardPanel: (x: number, y: number) => boolean;
}

export function installCombatInputRuntime(
  scene: CombatInputScene,
  installBoardInput: SharedBoardInputInstaller = installSharedBoardViewInput
): void {
  watchKeyboardBindings(scene, "combat", {
    stepCombat: () => {
      if (!scene.settingsVisible && scene.phase === PHASE.COMBAT) scene.stepCombat();
    },
    settings: () => {
      if (scene._settingsIsShortcutsOpen?.()) {
        scene._settingsCloseShortcutsView?.();
        return;
      }
      if (scene.libraryModal?.isOpen()) {
        scene.libraryModal.hide();
        return;
      }
      if (scene.historyModalVisible) {
        scene.toggleHistoryModal(false);
        return;
      }
      scene.toggleSettingsOverlay();
    },
    toggleAudio: () => {
      if (scene.settingsVisible || scene.historyModalVisible || scene.libraryModal?.isOpen()) return;
      scene.toggleAudio();
    }
  });

  const boardOptions: SharedBoardInputOptions = {
    handleWheel: (_pointer: unknown, dy: number) => {
      if (scene.historyModalVisible) {
        scene.onHistoryWheel(dy);
        return true;
      }
      if (scene.libraryModal?.isOpen()) {
        scene.libraryModal.scrollBy(dy);
        return true;
      }
      return Boolean(scene.settingsVisible);
    },
    handlePointerDown: (pointer: { x: number; y: number }) => {
      if (scene.settingsVisible || scene.historyModalVisible || scene.libraryModal?.isOpen()) return true;
      return !scene.pointInBoardPanel(pointer.x, pointer.y);
    },
    handlePointerMove: () => Boolean(scene.settingsVisible || scene.historyModalVisible || scene.libraryModal?.isOpen()),
    allowBoardPanStart: (pointer: { x: number; y: number }) => scene.pointInBoardPanel(pointer.x, pointer.y)
  };
  installBoardInput(scene, boardOptions);
}
