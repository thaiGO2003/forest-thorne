import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import { lazyLoadAndPlayBgm } from "../../core/sharedAssetLoader.js";
import { CORTISOL_DANCE_DURATION_MS } from "./planningSceneConstants.js";
import { addPlanningLog } from "./planningLogRuntime.js";

type DanceTarget = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & {
  __cortisolDanceEligible?: boolean;
  __hasCortisolDestroyHook?: boolean;
  __cortisolDanceState?: { tween?: Phaser.Tweens.Tween; baseX: number; baseY: number; baseScaleX: number; baseScaleY: number; baseAngle: number };
};
type BenchSlot = { _visualModel?: DanceTarget; icon?: DanceTarget };
type CortisolScene = Phaser.Scene & {
  audioFx: Parameters<typeof lazyLoadAndPlayBgm>[2]; cortisolDanceUntilAt: number;
  cortisolDanceTimer: Phaser.Time.TimerEvent | null; cortisolDanceTargets: Set<DanceTarget>;
  planningSprites?: DanceTarget[]; benchSlots?: BenchSlot[]; logs: unknown[]; logHistory: unknown[];
  logText: { setText: (text: string) => unknown }; buttons: { history?: { setLabel: (label: string) => unknown } };
  historyModalVisible: boolean; [key: string]: unknown;
};
type EndOptions = { clearWindow?: boolean };

export function startPlanningMusic(scene: CortisolScene): void { lazyLoadAndPlayBgm(scene, "planning", scene.audioFx, "bgm_planning", 0.2); }
export function isPlanningCortisolDanceActive(scene: CortisolScene): boolean { return scene.cortisolDanceUntilAt > (scene.time?.now ?? Date.now()); }
export function clearPlanningCortisolDanceTimer(scene: CortisolScene): void {
  if (scene.cortisolDanceTimer?.remove) scene.cortisolDanceTimer.remove(false);
  scene.cortisolDanceTimer = null;
}
export function stopPlanningCortisolDanceForTarget(scene: CortisolScene, target: DanceTarget | null | undefined, skipRestore = false): void {
  if (!target) return;
  const state = target.__cortisolDanceState;
  if (!state) return;
  state.tween?.remove?.();
  if (!skipRestore && target.active) {
    target.x = state.baseX; target.y = state.baseY;
    target.setScale(state.baseScaleX, state.baseScaleY); target.setAngle(state.baseAngle);
  }
  delete target.__cortisolDanceState;
  scene.cortisolDanceTargets?.delete(target);
}
export function stopPlanningAllCortisolDanceTargets(scene: CortisolScene, skipRestore = false): void {
  if (!scene.cortisolDanceTargets) return;
  Array.from(scene.cortisolDanceTargets).forEach((target) => stopPlanningCortisolDanceForTarget(scene, target, skipRestore));
}
export function planningEndCortisolDanceMode(scene: CortisolScene, { clearWindow = true }: EndOptions = {}): void {
  if (clearWindow) scene.cortisolDanceUntilAt = 0;
  clearPlanningCortisolDanceTimer(scene); stopPlanningAllCortisolDanceTargets(scene);
}
export function refreshPlanningCortisolDanceTimer(scene: CortisolScene): void {
  clearPlanningCortisolDanceTimer(scene);
  if (!isPlanningCortisolDanceActive(scene)) { planningEndCortisolDanceMode(scene, { clearWindow: true }); return; }
  const remainingMs = Math.max(0, scene.cortisolDanceUntilAt - (scene.time?.now ?? Date.now()));
  if (!scene.time?.delayedCall) return;
  scene.cortisolDanceTimer = scene.time.delayedCall(remainingMs, () => planningEndCortisolDanceMode(scene, { clearWindow: true }));
}
export function setPlanningCortisolDanceEligibility(scene: CortisolScene, target: DanceTarget | null | undefined, eligible: boolean): void {
  if (!target) return;
  target.__cortisolDanceEligible = eligible === true;
  if (target.__cortisolDanceEligible) { startPlanningCortisolDanceForTarget(scene, target); return; }
  stopPlanningCortisolDanceForTarget(scene, target);
}
export function startPlanningCortisolDanceForTarget(scene: CortisolScene, target: DanceTarget | null | undefined): void {
  if (!target?.active || !target.__cortisolDanceEligible || !isPlanningCortisolDanceActive(scene)) return;
  if (target.__cortisolDanceState?.tween || !scene.tweens?.add) return;
  const baseX = Number.isFinite(target.x) ? target.x : 0;
  const baseY = Number.isFinite(target.y) ? target.y : 0;
  const baseScaleX = Number.isFinite(target.scaleX) ? target.scaleX : 1;
  const baseScaleY = Number.isFinite(target.scaleY) ? target.scaleY : 1;
  const baseAngle = Number.isFinite(target.angle) ? target.angle : 0;
  const tween = scene.tweens.add({ targets: target, y: baseY - 4, angle: baseAngle + 6, scaleX: baseScaleX * 0.94,
    scaleY: baseScaleY * 1.06, duration: 260, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  target.__cortisolDanceState = { tween, baseX, baseY, baseScaleX, baseScaleY, baseAngle };
  if (!scene.cortisolDanceTargets) scene.cortisolDanceTargets = new Set();
  scene.cortisolDanceTargets.add(target);
  if (typeof target.once === "function" && target.__hasCortisolDestroyHook !== true) {
    target.__hasCortisolDestroyHook = true;
    target.once("destroy", () => stopPlanningCortisolDanceForTarget(scene, target, true));
  }
}
export function applyPlanningCortisolDanceToVisibleBeasts(scene: CortisolScene): void {
  if (!isPlanningCortisolDanceActive(scene)) return;
  scene.planningSprites?.forEach((obj) => { if (obj?.__cortisolDanceEligible) startPlanningCortisolDanceForTarget(scene, obj); });
  scene.benchSlots?.forEach((slot) => {
    if (slot?._visualModel?.__cortisolDanceEligible) startPlanningCortisolDanceForTarget(scene, slot._visualModel);
    if (slot?.icon?.__cortisolDanceEligible) startPlanningCortisolDanceForTarget(scene, slot.icon);
  });
}
export function activatePlanningCortisolMode(scene: CortisolScene): void {
  scene.cortisolDanceUntilAt = (scene.time?.now ?? Date.now()) + CORTISOL_DANCE_DURATION_MS;
  refreshPlanningCortisolDanceTimer(scene); lazyLoadAndPlayBgm(scene, "planning", scene.audioFx, "bgm_planning", 0.2);
  applyPlanningCortisolDanceToVisibleBeasts(scene); addPlanningLog(scene, t("planning.log.cortisolDance"));
}
