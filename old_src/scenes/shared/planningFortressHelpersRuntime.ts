import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import { AI_DIFFICULTY_ORDER } from "../../core/aiModes.js";
import { AI_SETTINGS } from "../../systems/AISystem.js";
import { DEFAULT_LOSE_CONDITION, normalizeLoseCondition, type LoseConditionType } from "../../core/gameRules.js";
import { ensureFortressGraph, isEndlessFortressMode as isEndlessFortressModeCore } from "../../core/fortressMode.js";
import { startManagedScene } from "../sceneLazyRouting.js";
import { isPlanningCoopMode } from "./planningCoopSessionRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { isPlanningPvpRoomMode } from "./planningPvpSessionRuntime.js";
import { refreshPlanningHeader } from "./planningRefreshUiRuntime.js";
import { exportPlanningRunState, persistPlanningProgress } from "./planningRunStateRuntime.js";
import { togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { getLoseConditionLabel } from "../../core/gameRules.js";
import { saveUiSettings } from "../../core/uiSettings.js";

type DifficultyKey = keyof typeof AI_SETTINGS;

type FortressFortMeta = {
  actIndex: number;
  stepIndex: number;
  mapSeed: number;
  graph: Record<string, unknown> | null;
  currentNodeId: string | null;
  visitedNodeIds: string[];
  pendingNodeType: string | null;
  pendingNodePayload: Record<string, unknown> | null;
};
type FortressPlayer = {
  fortressMeta?: FortressFortMeta | Record<string, unknown> | null;
  round?: number;
  gameMode?: string;
  hp?: number;
  loseCondition?: LoseConditionType;
  [key: string]: unknown;
};

type FortressGameModeConfig = {
  loseCondition?: LoseConditionType;
  startingHP?: number;
  id?: string;
  [key: string]: unknown;
};

type FortressScene = Phaser.Scene & {
  aiMode: string;
  audioFx: { play: (key: string) => void };
  runtimeSettings: { loseCondition?: LoseConditionType; [key: string]: unknown };
  gameModeConfig?: FortressGameModeConfig | null;
  gameMode: string;
  player: FortressPlayer;
  modalButtons?: { loseMode?: { setLabel: (v: string) => void } };
};

type LoseFallback = LoseConditionType | number | null;

export function setPlanningAIMode(scene: FortressScene, mode: string): void {
  if (!(AI_SETTINGS as Record<string, unknown>)[mode]) return;
  scene.audioFx.play("click");
  addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("difficulty.lockedInRun"));
  refreshPlanningHeader(scene as unknown as Parameters<typeof refreshPlanningHeader>[0]);
}

export function planningCycleAiMode(scene: FortressScene): void {
  const idx = AI_DIFFICULTY_ORDER.indexOf((scene.aiMode ?? "EASY") as DifficultyKey);
  const next = AI_DIFFICULTY_ORDER[(idx + 1) % AI_DIFFICULTY_ORDER.length] as DifficultyKey;
  setPlanningAIMode(scene, next);
  togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], true);
}

export function getPlanningConfiguredLoseCondition(scene: FortressScene, fallback: LoseFallback = null): LoseConditionType {
  const normalizedFallback = normalizeLoseCondition((fallback ?? scene.player?.loseCondition ?? scene.runtimeSettings?.loseCondition ?? DEFAULT_LOSE_CONDITION) as LoseConditionType);
  if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) && !isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) return normalizedFallback;
  if (typeof scene.gameModeConfig?.loseCondition === "string") return normalizeLoseCondition(scene.gameModeConfig.loseCondition);
  return normalizedFallback;
}

export function getPlanningConfiguredStartingHp(scene: FortressScene, fallback: number | null = null): number {
  const startingHpValue = scene.gameModeConfig?.startingHP;
  const startingHp = Number.isFinite(startingHpValue) ? Math.max(1, Math.floor(startingHpValue as number)) : null;
  if (startingHp != null) return startingHp;
  if (Number.isFinite(fallback) && (fallback as number) > 0) return Math.max(1, Math.floor(fallback as number));
  return getPlanningConfiguredLoseCondition(scene) === "NO_HEARTS" ? 3 : 1;
}

export function isPlanningEndlessFortressMode(scene: FortressScene): boolean {
  return isEndlessFortressModeCore((scene.player?.gameMode ?? scene.gameModeConfig?.id ?? scene.gameMode) as string);
}
export function ensurePlanningFortressMeta(scene: FortressScene): FortressFortMeta | null {
  if (!scene.player) return null;
  const meta = ensureFortressGraph(scene.player.fortressMeta as Record<string, unknown> | null | undefined, { round: scene.player.round }) as FortressFortMeta;
  scene.player.fortressMeta = meta;
  return meta;
}

export function startPlanningFortressMapScene(scene: FortressScene, options: { restoredState?: unknown; forceNewRun?: boolean } = {}): void {
  persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
  startManagedScene(scene as unknown as Parameters<typeof startManagedScene>[0], "FortressMapScene", {
    settings: scene.runtimeSettings,
    mode: scene.player?.gameMode ?? scene.gameMode,
    restoredState: options.restoredState ?? exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]),
    forceNewRun: options.forceNewRun === true
  });
}

export function getPlanningLoseCondition(scene: FortressScene): LoseConditionType {
  return getPlanningConfiguredLoseCondition(scene, (scene.player?.loseCondition ?? scene.runtimeSettings?.loseCondition ?? DEFAULT_LOSE_CONDITION) as LoseConditionType);
}

export function setPlanningLoseCondition(scene: FortressScene, nextMode: LoseConditionType | string): void {
  const mode = normalizeLoseCondition(nextMode as LoseConditionType);
  if (getPlanningLoseCondition(scene) === mode) return;
  scene.runtimeSettings.loseCondition = mode;
  if (scene.player) {
    scene.player.loseCondition = mode;
    if (mode === "NO_HEARTS" && scene.player.hp && scene.player.hp <= 0) scene.player.hp = getPlanningConfiguredStartingHp(scene, 3);
    if (mode === "NO_UNITS") scene.player.hp = Math.max(1, scene.player.hp ?? 1);
  }
  saveUiSettings(scene.runtimeSettings as Parameters<typeof saveUiSettings>[0]);
  scene.modalButtons?.loseMode?.setLabel(t("planning.fortress.loseConditionLabel", { mode: getLoseConditionLabel(mode) }));
  addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.changedLoseCondition", { mode: getLoseConditionLabel(mode) }));
  refreshPlanningHeader(scene as unknown as Parameters<typeof refreshPlanningHeader>[0]);
  persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function togglePlanningLoseCondition(_scene: FortressScene): void { /* Only NO_UNITS mode - no toggle needed */ }
