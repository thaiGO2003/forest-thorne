/**
 * SettingsOverlay.js
 *
 * Thin wrapper: delegates to SettingsPanel.js for the in-game overlay.
 * Keeps backward-compatible API for PlanningScene consumption.
 */

import { getAvailableLocales } from "../i18n/index.js";
import { loadUiSettings, saveUiSettings, type UiSettings } from "../core/uiSettings.js";
import { buildSettingsPanel } from "./SettingsPanel.js";
import type { Scene as PhaserScene } from "phaser";

interface AudioFxLike {
  enabled: boolean;
  getVolumeLevel: () => number;
}

type RuntimeSettings = UiSettings;

export interface ModalButton {
  text?: { text: string };
  setLabel: (v: string) => void;
  setVisible?: (v: boolean) => void;
  setEnabled?: (v: boolean) => void;
}
export type SettingsOverlayModalButton = ModalButton;

interface SceneWithSettingsHooks extends PhaserScene {
  onExportJsonClick: () => void;
  onImportJsonClick: () => void;
  onClearClick: () => void;
  toggleAudio: () => void;
  changeVolumeLevel: (delta: number) => void;
  changeResolution: (delta: number) => void;
  changeTooltipMode: (delta: number) => void;
  goMainMenu: () => void;
  toggleSettingsOverlay: (visible: boolean) => void;
  runtimeSettings: RuntimeSettings;
  audioFx: AudioFxLike;
  modalButtons: { audio?: ModalButton; volume?: ModalButton; clear?: ModalButton } | undefined;
  refreshPlanningUi?: () => void;
  libraryModal?: { refreshLocale?: () => void };
  refreshHistoryModal?: () => void;
  _settingsRefresh?: (settings: RuntimeSettings, audioFx: AudioFxLike) => void;
  _settingsCloseShortcutsView?: () => void;
  _settingsIsShortcutsOpen?: () => boolean;
}

export type CreateButtonFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts?: { variant?: string; fontSize?: number | string; bold?: boolean }
) => ModalButton;
export type SettingsOverlayCreateButton = CreateButtonFn;

export interface SettingsPanelIngameResult {
  buttons: { audio?: ModalButton; volume?: ModalButton; clear?: ModalButton };
  overlay: unknown[];
  refresh: (settings: RuntimeSettings, audioFx: AudioFxLike) => void;
  closeShortcutsView: () => void;
  isShortcutsViewOpen: () => boolean;
}

/**
 * Creates the settings overlay UI elements on the given scene.
 */
export function buildSettingsOverlay(
  scene: SceneWithSettingsHooks,
  createButton: CreateButtonFn
): { overlay: unknown[]; modalButtons: SettingsPanelIngameResult["buttons"] } {
  const result = buildSettingsPanel(scene, {
    context: "ingame",
    shortcutContext: "planning",
    createButton: createButton as unknown as Parameters<typeof buildSettingsPanel>[1]["createButton"],
    callbacks: {
      exportJson: () => scene.onExportJsonClick(),
      importJson: () => scene.onImportJsonClick(),
      clear: () => scene.onClearClick(),
      toggleAudio: () => scene.toggleAudio(),
      changeVolume: (delta: number) => scene.changeVolumeLevel(delta),
      changeResolution: (delta: number) => scene.changeResolution(delta),
      changeTooltip: (delta: number) => scene.changeTooltipMode(delta),
      changeSubtitle: () => {
        const current = loadUiSettings();
        saveUiSettings({ ...current, subtitleEnabled: !current.subtitleEnabled });
        scene.runtimeSettings = { ...scene.runtimeSettings, subtitleEnabled: !scene.runtimeSettings.subtitleEnabled };
        scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
      },
      changeLanguage: () => {
        const current = loadUiSettings();
        const locales = getAvailableLocales();
        const idx = locales.indexOf(current.language ?? "vi");
        const nextLanguage = locales[(idx + 1) % locales.length];
        saveUiSettings({ ...current, language: nextLanguage });
        scene.runtimeSettings = { ...scene.runtimeSettings, language: nextLanguage };
        scene.refreshPlanningUi?.();
        scene.libraryModal?.refreshLocale?.();
        scene.refreshHistoryModal?.();
        scene._settingsRefresh?.(scene.runtimeSettings, scene.audioFx);
      },
      goMainMenu: () => scene.goMainMenu(),
      close: () => scene.toggleSettingsOverlay(false)
    }
  }) as unknown as SettingsPanelIngameResult;

  scene._settingsRefresh = result.refresh;
  scene._settingsCloseShortcutsView = result.closeShortcutsView;
  scene._settingsIsShortcutsOpen = result.isShortcutsViewOpen;

  return { overlay: result.overlay ?? [], modalButtons: result.buttons };
}

/**
 * Refreshes settings overlay labels.
 */
export function refreshSettingsOverlayLabels(scene: SceneWithSettingsHooks, next: boolean): void {
  const mb = scene.modalButtons;

  if (!next) {
    scene._settingsCloseShortcutsView?.();
    if (mb?.clear?.text?.text && (mb.clear.text.text.includes("Xác nhận") || mb.clear.text.text.includes("Confirm"))) {
      mb.clear.setLabel("settings.clearProgress");
    }
    return;
  }

  scene._settingsCloseShortcutsView?.();

  if (scene._settingsRefresh) {
    scene._settingsRefresh(scene.runtimeSettings, scene.audioFx);
    return;
  }

  if (!mb) return;

  if (mb.audio && scene.audioFx) {
    const on = scene.audioFx.enabled;
    mb.audio.setLabel(`${on ? "🔊" : "🔇"}  Âm thanh: ${on ? "Bật" : "Tắt"}`);
  }
  if (mb.volume && scene.audioFx) {
    mb.volume.setLabel(`Âm lượng: ${scene.audioFx.getVolumeLevel()}/10`);
  }
}
