import Phaser from "phaser";
import { initPlanningSceneFields } from "./shared/planningSceneConstructorRuntime.js";
import { bindPlanningSceneDelegates } from "./shared/planningSceneDelegateBindings.js";

export class PlanningScene extends Phaser.Scene {
  constructor() {
    super("PlanningScene");
    initPlanningSceneFields(this as unknown as Parameters<typeof initPlanningSceneFields>[0]);
  }
}

bindPlanningSceneDelegates(PlanningScene as unknown as { prototype: Record<string, unknown> });

if (import.meta.hot) {
  import.meta.hot.accept("./shared/planningSceneDelegateBindings.js", (mod) => {
    mod!.bindPlanningSceneDelegates(PlanningScene);
  });
}
