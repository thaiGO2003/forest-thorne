import type Phaser from "phaser";
import { createPlanningLowerDockPanelChrome } from "./planningLowerDockPanelChrome.js";
import { buildPlanningLowerDockPanelLayoutKey } from "./planningLowerDockPanelLayout.js";

type LowerDockScene = Phaser.Scene & {
  layout?: Record<string, unknown> | null;
  lowerDockPanels?: Array<{ destroy?: () => void } | null | undefined>;
  lowerDockPanelLayoutKey?: string | null;
  [key: string]: unknown;
};

export function destroyPlanningLowerDockPanels(scene: LowerDockScene): void {
    scene.lowerDockPanels?.forEach((panel) => panel?.destroy?.());
    scene.lowerDockPanels = [];
    scene.lowerDockPanelLayoutKey = null;
}

export function ensurePlanningLowerDockPanels(scene: LowerDockScene): void {
    const l = scene.layout;
    if (!l) return;
    const layoutKey = buildPlanningLowerDockPanelLayoutKey(l);
    if (scene.lowerDockPanelLayoutKey === layoutKey && Array.isArray(scene.lowerDockPanels) && scene.lowerDockPanels.length) {
      return;
    }
    destroyPlanningLowerDockPanels(scene);
    const chrome = createPlanningLowerDockPanelChrome(scene as unknown as Parameters<typeof createPlanningLowerDockPanelChrome>[0], l);
    scene.lowerDockPanels = chrome.nodes;
    scene.lowerDockPanelLayoutKey = layoutKey;
}
