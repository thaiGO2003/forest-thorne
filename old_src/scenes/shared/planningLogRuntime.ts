import { refreshPlanningRightPanelScrollMetrics } from "./planningRightPanelRuntime.js";
import { refreshPlanningHistoryModal } from "./planningSettingsRuntime.js";

import { getHistoryButtonLabel } from "../../ui/buttonEmojiLabels.js";
import { formatSharedLogPreview, inferSharedLogCategory, pushSharedSceneLog } from "./sceneLogRuntime.js";

interface PlanningLogScene extends Phaser.Scene {
  logs: unknown[];
  logHistory: unknown[];
  logText: { setText: (text: string) => unknown };
  buttons: { history?: { setLabel: (label: string) => unknown } };
  historyModalVisible: boolean;
  [key: string]: unknown;
}

export function addPlanningLog(scene: PlanningLogScene, message: string, category: unknown = null): void {
    pushSharedSceneLog(scene as unknown as Parameters<typeof pushSharedSceneLog>[0], message, category as Parameters<typeof pushSharedSceneLog>[2], {
      inferCategory: inferSharedLogCategory,
      previewLimit: 6
    });
    planningUpdateLogText(scene);
    if (scene.historyModalVisible) refreshPlanningHistoryModal(scene as unknown as Parameters<typeof refreshPlanningHistoryModal>[0]);
}

export function planningUpdateLogText(scene: PlanningLogScene): void {
    scene.logText.setText(formatSharedLogPreview(scene.logs, { maxLines: 2 }));
    scene.buttons.history?.setLabel(getHistoryButtonLabel(scene.logHistory.length));
    refreshPlanningRightPanelScrollMetrics(scene as unknown as Parameters<typeof refreshPlanningRightPanelScrollMetrics>[0]);
}

export function planningInferLogCategory(_scene: unknown, message: unknown): string {
    return inferSharedLogCategory(message as string);
}
