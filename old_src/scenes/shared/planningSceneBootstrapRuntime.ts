import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import GameModeRegistry from "../../gameModes/GameModeRegistry.js";
import { TooltipController } from "../../core/tooltip.js";
import { AudioFx } from "../../core/audioFx.js";
import { loadUiSettings, type UiSettings } from "../../core/uiSettings.js";
import { loadProgress } from "../../core/persistence.js";
import { hydrateRunState, type RunState } from "../../core/runState.js";
import { loadEndlessAchievementProfile } from "../../core/endlessAchievements.js";
import { prewarmLazyScene } from "../sceneLazyRouting.js";
import { createPlanningButtons } from "./planningActionButtonsRuntime.js";
import { createPlanningBenchSlots } from "./planningBenchRuntime.js";
import { createPlanningPlayerCellZones } from "./planningBoardInteractionRuntime.js";
import { drawPlanningBoard } from "./planningBoardChromeRuntime.js";
import { bindPlanningCoopSessionTransport, cleanupPlanningCoopBindings } from "./planningCoopSessionRuntime.js";
import { applyPlanningCombatResult, preparePlanningEnemyPreview } from "./planningCombatTransitionRuntime.js";
import { startPlanningMusic, planningEndCortisolDanceMode } from "./planningCortisolRuntime.js";
import { ensurePlanningFortressMeta, isPlanningEndlessFortressMode, startPlanningFortressMapScene } from "./planningFortressHelpersRuntime.js";
import { createPlanningHud } from "./planningHudRuntime.js";
import { setPlanningupGamepadInput, setPlanningupInput } from "./planningInputRuntime.js";
import { computePlanningLayout } from "./planningLayoutRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { applyPlanningDisplaySettings, applyPlanningRuntimeSettings } from "./planningSceneLifecycleRuntime.js";
import { applyPlanningRunState, exportPlanningRunState, startPlanningNewRun, syncPlanningEndlessAchievementSnapshot } from "./planningRunStateRuntime.js";
import { cancelPlanningDeferredUiPrewarm, schedulePlanningDeferredUiPrewarm, togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { getPlanningFortressPendingNode, planningAnnounceFortressServiceResult } from "./planningTechRuntime.js";
import { destroyPlanningTechTreeModal } from "./planningTechTreeModalRuntime.js";
import { destroyPlanningTutorialOverlay } from "./planningTutorialRuntime.js";
import { installPlanningBoardInteraction } from "./planningDragRuntime.js";

type IncomingData = {
  settings?: UiSettings;
  mode?: string;
  forceNewRun?: boolean;
  restoredState?: unknown;
  combatResult?: unknown;
  openSettings?: boolean;
  [key: string]: unknown;
};
type BootstrapScene = Phaser.Scene & {
  cameras: Phaser.Scene["cameras"]; input: Phaser.Input.InputPlugin;
  incomingData: IncomingData | null; runtimeSettings: UiSettings; layout: ReturnType<typeof computePlanningLayout>;
  gameMode: string; gameModeConfig: ReturnType<typeof GameModeRegistry.get>; tooltip: TooltipController;
  audioFx: AudioFx; endlessAchievementProfile: ReturnType<typeof loadEndlessAchievementProfile>;
  events: Phaser.Events.EventEmitter;
};

export function create(scene: BootstrapScene): void {
  scene.cameras.main.setBackgroundColor("#10141b");
  scene.input.mouse?.disableContextMenu();
  scene.input.keyboard?.removeAllListeners();
  scene.input.removeAllListeners();
  scene.runtimeSettings = scene.incomingData?.settings ?? loadUiSettings();
  applyPlanningDisplaySettings(scene as unknown as Parameters<typeof applyPlanningDisplaySettings>[0], scene.runtimeSettings as unknown as Parameters<typeof applyPlanningDisplaySettings>[1], false);
  scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
  scene.gameMode = scene.incomingData?.mode ?? scene.gameMode;

  scene.gameModeConfig = GameModeRegistry.get(scene.gameMode);
  if (!scene.gameModeConfig) {
    console.warn(`Game mode "${scene.gameMode}" not found, falling back to EndlessPvEClassic`);
    scene.gameMode = "EndlessPvEClassic";
    scene.gameModeConfig = GameModeRegistry.get(scene.gameMode);
  }

  scene.tooltip = new TooltipController(scene as unknown as ConstructorParameters<typeof TooltipController>[0]);
  scene.audioFx = new AudioFx(scene as unknown as ConstructorParameters<typeof AudioFx>[0]);
  scene.audioFx.setEnabled(scene.runtimeSettings.audioEnabled !== false);
  scene.audioFx.setVolumeLevel(scene.runtimeSettings.volumeLevel ?? 10);
  scene.endlessAchievementProfile = loadEndlessAchievementProfile();
  startPlanningMusic(scene as unknown as Parameters<typeof startPlanningMusic>[0]);
  drawPlanningBoard(scene as unknown as Parameters<typeof drawPlanningBoard>[0]);
  createPlanningHud(scene as unknown as Parameters<typeof createPlanningHud>[0]);
  createPlanningButtons(scene as unknown as Parameters<typeof createPlanningButtons>[0]);
  createPlanningPlayerCellZones(scene as unknown as Parameters<typeof createPlanningPlayerCellZones>[0]);
  createPlanningBenchSlots(scene as unknown as Parameters<typeof createPlanningBenchSlots>[0]);
  installPlanningBoardInteraction(scene as unknown as Parameters<typeof installPlanningBoardInteraction>[0]);
  setPlanningupInput(scene as unknown as Parameters<typeof setPlanningupInput>[0]);
  setPlanningupGamepadInput(scene as unknown as Parameters<typeof setPlanningupGamepadInput>[0]);

  const forceNewRun = scene.incomingData?.forceNewRun === true;
  if (forceNewRun) {
    startPlanningNewRun(scene as unknown as Parameters<typeof startPlanningNewRun>[0]);
  } else {
    const loaded: RunState | null = scene.incomingData?.restoredState
      ? hydrateRunState(scene.incomingData.restoredState as Parameters<typeof hydrateRunState>[0])
      : hydrateRunState(loadProgress() as Parameters<typeof hydrateRunState>[0]);
    if (loaded) {
      applyPlanningRunState(scene as unknown as Parameters<typeof applyPlanningRunState>[0], loaded);
      ensurePlanningFortressMeta(scene as unknown as Parameters<typeof ensurePlanningFortressMeta>[0]);
      if (isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0]) && !scene.incomingData?.combatResult && !getPlanningFortressPendingNode(scene as unknown as Parameters<typeof getPlanningFortressPendingNode>[0])) {
        startPlanningFortressMapScene(scene as unknown as Parameters<typeof startPlanningFortressMapScene>[0], { restoredState: exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]) });
        return;
      }
      preparePlanningEnemyPreview(scene as unknown as Parameters<typeof preparePlanningEnemyPreview>[0]);
      planningAnnounceFortressServiceResult(scene as unknown as Parameters<typeof planningAnnounceFortressServiceResult>[0]);
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.restored"));
      syncPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof syncPlanningEndlessAchievementSnapshot>[0]);
    } else {
      startPlanningNewRun(scene as unknown as Parameters<typeof startPlanningNewRun>[0]);
    }
  }

  applyPlanningRuntimeSettings(scene as unknown as Parameters<typeof applyPlanningRuntimeSettings>[0], scene.runtimeSettings as unknown as Parameters<typeof applyPlanningRuntimeSettings>[1]);

  if (scene.incomingData?.combatResult) {
    applyPlanningCombatResult(scene as unknown as Parameters<typeof applyPlanningCombatResult>[0], scene.incomingData.combatResult as Parameters<typeof applyPlanningCombatResult>[1]);
  }

  bindPlanningCoopSessionTransport(scene as unknown as Parameters<typeof bindPlanningCoopSessionTransport>[0]);
  scene.events.once("shutdown", () => {
    cancelPlanningDeferredUiPrewarm(scene as unknown as Parameters<typeof cancelPlanningDeferredUiPrewarm>[0]);
    planningEndCortisolDanceMode(scene as unknown as Parameters<typeof planningEndCortisolDanceMode>[0], { clearWindow: true });
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
    destroyPlanningTechTreeModal(scene as unknown as Parameters<typeof destroyPlanningTechTreeModal>[0]);
  });
  scene.events.once("destroy", () => {
    cancelPlanningDeferredUiPrewarm(scene as unknown as Parameters<typeof cancelPlanningDeferredUiPrewarm>[0]);
    planningEndCortisolDanceMode(scene as unknown as Parameters<typeof planningEndCortisolDanceMode>[0], { clearWindow: true });
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
    destroyPlanningTechTreeModal(scene as unknown as Parameters<typeof destroyPlanningTechTreeModal>[0]);
  });
  prewarmLazyScene("CombatScene");
  schedulePlanningDeferredUiPrewarm(scene as unknown as Parameters<typeof schedulePlanningDeferredUiPrewarm>[0]);
  if (scene.incomingData?.openSettings) {
    togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], true as unknown as Parameters<typeof togglePlanningSettingsOverlay>[1]);
  }
}
