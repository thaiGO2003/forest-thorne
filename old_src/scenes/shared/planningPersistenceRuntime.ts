
import {
  clearProgress,
  downloadProgressAsJson,
  importProgressFromJsonFile
} from "../../core/persistence.js";
import type Phaser from "phaser";
import type { AudioFx } from "../../core/audioFx.js";
import type { UiSettings } from "../../core/uiSettings.js";

import {
  saveUiSettings,
  stepTooltipMode,
  normalizeTooltipMode
} from "../../core/uiSettings.js";
import { hydrateRunState } from "../../core/runState.js";
import { getAvailableLocales, t } from "../../i18n/index.js";

import { preparePlanningEnemyPreview } from "./planningCombatTransitionRuntime.js";
import { isPlanningCoopMode } from "./planningCoopSessionRuntime.js";
import { getPlanningLoseCondition } from "./planningFortressHelpersRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningUi, showPlanningToast } from "./planningRefreshUiRuntime.js";
import { applyPlanningRunState, exportPlanningRunState, persistPlanningProgress } from "./planningRunStateRuntime.js";
import { refreshPlanningHistoryModal, togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { destroyPlanningTutorialOverlay } from "./planningTutorialRuntime.js";

import { ResolutionManager } from "../../core/resolutionManager.js";
import { clearCoopSession, getCoopSession } from "../../network/coopSession.js";
import { cleanupPlanningCoopBindings, getPlanningCoopMainMenuData, persistPlanningActiveCoopSave } from "./planningCoopSessionRuntime.js";
import { guardPlanningTutorialAction } from "./planningTutorialRuntime.js";

interface PersistenceScene extends Phaser.Scene {
  audioFx: Pick<AudioFx, "enabled" | "play" | "setEnabled" | "setVolumeLevel" | "getVolumeLevel">;
  runtimeSettings: UiSettings;
  aiMode: string;
  modalButtons?: {
    clear?: { setEnabled: (enabled: boolean) => unknown };
    audio?: { setLabel: (label: string) => unknown };
    volume?: { setLabel: (label: string) => unknown };
  };
  libraryModal?: { refreshLocale?: () => unknown };
  _settingsRefresh?: (settings: UiSettings, audioFx: PersistenceScene["audioFx"]) => unknown;
  [key: string]: unknown;
}

interface MainMenuOptions {
  openSettingsPanel?: boolean;
}

export function onPlanningExportJsonClick(scene: PersistenceScene): void {
    const result = downloadProgressAsJson(exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]));
    const ok = result?.ok === true;
    scene.audioFx.play("click");
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t(ok ? "settings.exportJsonSuccessLog" : "settings.exportJsonFailureLog"));
    showPlanningToast(scene as unknown as Parameters<typeof showPlanningToast>[0], t(ok ? "settings.exportJsonSuccessToast" : "settings.exportJsonFailureToast"), ok);
}

export async function onPlanningImportJsonClick(scene: PersistenceScene): Promise<void> {
    scene.audioFx.play("click");
    const input = createPlanningProgressImportInput(scene);
    if (!input) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("settings.importJsonFailureLog"));
      showPlanningToast(scene as unknown as Parameters<typeof showPlanningToast>[0], t("settings.importJsonFailureToast"), false);
      return;
    }

    const loaded = await new Promise<unknown>((resolve) => {
      const cleanup = () => {
        input.onchange = null;
        input.onerror = null;
      };

      input.onchange = async () => {
        const [file] = Array.from(input.files ?? []);
        cleanup();
        if (!file) {
          resolve(undefined);
          return;
        }
        const payload = await importProgressFromJsonFile(file, { persist: true });
        resolve(payload ?? null);
      };
      input.onerror = () => {
        cleanup();
        resolve(null);
      };

      try {
        input.click();
      } catch (_err) {
        cleanup();
        resolve(null);
      }
    });

    if (loaded === undefined) return;

    const hydrated = hydrateRunState(loaded);
    if (!hydrated) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("settings.importJsonFailureLog"));
      showPlanningToast(scene as unknown as Parameters<typeof showPlanningToast>[0], t("settings.importJsonFailureToast"), false);
      return;
    }

    applyPlanningRunState(scene as unknown as Parameters<typeof applyPlanningRunState>[0], hydrated);
    scene.audioFx.setEnabled(hydrated.audioEnabled !== false);
    scene.runtimeSettings.audioEnabled = scene.audioFx.enabled;
    scene.runtimeSettings.aiMode = scene.aiMode;
    scene.runtimeSettings.loseCondition = getPlanningLoseCondition(scene as unknown as Parameters<typeof getPlanningLoseCondition>[0]);
    scene.runtimeSettings.volumeLevel = scene.audioFx.getVolumeLevel();
    saveUiSettings(scene.runtimeSettings);
    scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
    preparePlanningEnemyPreview(scene as unknown as Parameters<typeof preparePlanningEnemyPreview>[0]);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("settings.importJsonSuccessLog"));
    showPlanningToast(scene as unknown as Parameters<typeof showPlanningToast>[0], t("settings.importJsonSuccessToast"), true);
}

export function onPlanningClearClick(scene: PersistenceScene): void {
    const ok = clearProgress();
    scene.audioFx.play("click");
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], ok ? t("planning.log.clearedSave") : t("planning.log.clearSaveFailed"));
    if (ok) {
      scene.modalButtons?.clear?.setEnabled(false);
    }
}

export function createPlanningProgressImportInput(_scene: PersistenceScene): HTMLInputElement | null {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    const input = document.createElement("input");
    if (!input) return null;
    input.type = "file";
    input.accept = ".json,application/json";
    return input;
}

export function changePlanningLanguage(scene: PersistenceScene): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_change_language") === false) return;
    const locales = getAvailableLocales();
    const idx = locales.indexOf(scene.runtimeSettings.language ?? "vi");
    scene.runtimeSettings.language = locales[(idx + 1) % locales.length];
    saveUiSettings(scene.runtimeSettings);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    scene.libraryModal?.refreshLocale?.();
    refreshPlanningHistoryModal(scene as unknown as Parameters<typeof refreshPlanningHistoryModal>[0]);
    scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
}

export function togglePlanningAudio(scene: PersistenceScene): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_toggle_audio") === false) return;
    scene.audioFx.setEnabled(!scene.audioFx.enabled);
    scene.runtimeSettings.audioEnabled = scene.audioFx.enabled;
    scene.runtimeSettings.volumeLevel = scene.audioFx.getVolumeLevel();
    saveUiSettings(scene.runtimeSettings);
    scene.modalButtons?.audio?.setLabel(t("planning.settings.audioLabel", { state: scene.audioFx.enabled ? t("planning.ui.on") : t("planning.ui.off") }));
    scene.modalButtons?.volume?.setLabel(t("planning.settings.volumeLabel", { value: scene.audioFx.getVolumeLevel() }));
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.audioToggled", { state: scene.audioFx.enabled ? t("planning.ui.on") : t("planning.ui.off") }));
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function changePlanningTooltipMode(scene: PersistenceScene, delta: number = 1): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_toggle_tooltip") === false) return;
    const nextMode = stepTooltipMode(scene.runtimeSettings.tooltipMode, delta);
    scene.runtimeSettings.tooltipMode = nextMode;
    scene.runtimeSettings.expandedTooltip = nextMode === "expanded";
    saveUiSettings(scene.runtimeSettings);
    const label = t(`settings.tooltipModeValue.${normalizeTooltipMode(nextMode)}`);
    scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.tooltipMode", { label }));
}

export function togglePlanningExpandedTooltip(scene: PersistenceScene): void {
    const modes = ["compact", "summary", "expanded"];
    const currentMode = normalizeTooltipMode(scene.runtimeSettings.tooltipMode, scene.runtimeSettings.expandedTooltip === true, "compact");
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1 + modes.length) % modes.length];
    scene.runtimeSettings.tooltipMode = nextMode;
    scene.runtimeSettings.expandedTooltip = nextMode === "expanded";
    saveUiSettings(scene.runtimeSettings);
    scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.tooltipMode", { label: t(`settings.tooltipModeValue.${normalizeTooltipMode(nextMode)}`) }));
}

export function changePlanningVolumeLevel(scene: PersistenceScene, step: number = 1): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_change_volume") === false) return;
    const current = scene.audioFx.getVolumeLevel();
    const next = Math.min(10, Math.max(1, current + step));
    if (next === current) return;
    scene.audioFx.setVolumeLevel(next);
    scene.runtimeSettings.volumeLevel = next;
    saveUiSettings(scene.runtimeSettings);
    scene.modalButtons?.volume?.setLabel(t("planning.settings.volumeLabel", { value: next }));
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.volumeChanged", { value: next }));
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function changePlanningResolution(scene: PersistenceScene, delta: number = 1): void {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "settings_change_resolution") === false) return;
    const next = ResolutionManager.changeResolution(scene.runtimeSettings?.resolutionKey, delta);
    if (!next?.key || next.key === scene.runtimeSettings?.resolutionKey) return;
    if (!confirmPlanningResolutionReturnToMenu(scene, next)) return;
    scene.runtimeSettings.resolutionKey = next.key;
    saveUiSettings(scene.runtimeSettings);
    goPlanningMainMenu(scene, { openSettingsPanel: true });
}

export function confirmPlanningResolutionReturnToMenu(scene: PersistenceScene, next: ReturnType<typeof ResolutionManager.changeResolution>): boolean {
    const message = t("settings.resolutionReturnToMenuConfirm", {
      resolution: next?.label ?? next?.key ?? scene.runtimeSettings?.resolutionKey
    });
    if (typeof globalThis.confirm === "function") {
      return globalThis.confirm(message);
    }
    return true;
}

export function goPlanningMainMenu(scene: PersistenceScene, options: MainMenuOptions = {}): void {
    const sceneData = options?.openSettingsPanel ? { openSettingsPanel: true } : undefined;
    togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      persistPlanningActiveCoopSave(scene as unknown as Parameters<typeof persistPlanningActiveCoopSave>[0], exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]));
      cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
      const coopClient = getCoopSession()?.client;
      if (coopClient && typeof coopClient === "object" && "close" in coopClient && typeof coopClient.close === "function") {
        coopClient.close(1000, "Leaving coop planning");
      }
      clearCoopSession();
      scene.scene.start("MainMenuScene", {
        ...getPlanningCoopMainMenuData(scene as unknown as Parameters<typeof getPlanningCoopMainMenuData>[0]),
        ...(sceneData ?? {})
      });
      return;
    } else {
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    }
    if (sceneData) {
      scene.scene.start("MainMenuScene", sceneData);
      return;
    }
    scene.scene.start("MainMenuScene");
}

