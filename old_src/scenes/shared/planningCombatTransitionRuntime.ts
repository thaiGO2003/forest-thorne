import Phaser from "phaser";
import { PHASE } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";

import { AUGMENT_LIBRARY } from "../../data/augments.js";
import { generateEnemyTeam } from "../../systems/AISystem.js";
import { stampEnemyPreviewEntries } from "../../core/enemyPreview.js";
import { showPlanningRoundResultBanner } from "./planningResultModalRuntime.js";
import {
  noteEndlessLoot,
  noteEndlessRoundLost,
  noteEndlessRoundWon
} from "../../core/endlessAchievements.js";
import { clearFortressPendingNode } from "../../core/fortressMode.js";
import { getPlanningCoopSlotsMissingDeployment } from "./planningCoopSessionRuntime.js";
import { COOP_MESSAGE_TYPES } from "../../network/coopConfig.js";
import { getCoopSession } from "../../network/coopSession.js";
import { sampleWithoutReplacement } from "../../core/gameUtils.js";
import { showSharedAugmentChoiceModal } from "./sceneAugmentChoiceModal.js";
import { TUTORIAL_AUGMENT_CHOICES, TUTORIAL_END_ROUND } from "./planningTutorialRuntime.js";

import { clearPlanningAttackPreview } from "./planningAttackPreviewRuntime.js";
import { createPlanningBenchSlots } from "./planningBenchRuntime.js";
import { cleanupPlanningCoopBindings, clearPlanningActiveCoopSave, getPlanningBoardProfileId, getPlanningBoardRowCount, getPlanningCoopLocalSlot, isPlanningCoopHost, isPlanningCoopMode, notePlanningCoopPlanningPing } from "./planningCoopSessionRuntime.js";
import { getPlanningDisplayedGold, hasPlanningManualEnemySandboxUnits, isPlanningCreativeMode, planningShouldSkipPostCombatStatsModal } from "./planningCreativeSandboxRuntime.js";
import { getPlanningAugmentIcon, planningTranslateAugmentGroup } from "./planningDescriptionRuntime.js";
import { getPlanningLoseCondition, isPlanningEndlessFortressMode, startPlanningFortressMapScene } from "./planningFortressHelpersRuntime.js";
import { computePlanningLayout } from "./planningLayoutRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { getPlanningSessionLocalSlot, isPlanningPvpRoomMode, maybePlanningStartPvpCombat, syncPlanningPvpSessionState } from "./planningPvpSessionRuntime.js";
import { refreshPlanningButtons, refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { showPlanningCombatResultModal } from "./planningResultModalRuntime.js";
import { exportPlanningRunState, getPlanningEndlessAchievementSnapshot, persistPlanningProgress, planningUpdateEndlessAchievementProfile, syncPlanningEndlessAchievementSnapshot } from "./planningRunStateRuntime.js";
import { planningResetBoardViewTransform } from "./planningSceneLifecycleRuntime.js";
import { togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { gainPlanningXp, getPlanningActiveLeftUnitCount, refreshPlanningShop } from "./planningShopActionsRuntime.js";
import { createPlanningStorageSpace } from "./planningStorageUiRuntime.js";
import { getPlanningFortressPendingNode } from "./planningTechRuntime.js";
import { getPlanningAugmentTooltip } from "./planningTooltipRuntime.js";
import { destroyPlanningTutorialOverlay, ensurePlanningTutorialRoundSetup, finalizePlanningTutorialCampaignIfNeeded, getPlanningTutorialState, isPlanningTutorialCampaignActive, refreshPlanningTutorialOverlay } from "./planningTutorialRuntime.js";

import { gainGoldWithCreative } from "../../core/creativeMode.js";
import { noteEndlessAugment } from "../../core/endlessAchievements.js";
import { getEndlessBossEncounter } from "../../core/endlessBosses.js";
import { usesBossRounds } from "../../core/gameModeRuntime.js";
import { clearRunProgress } from "../../core/persistence.js";
import { AUGMENT_ROUNDS } from "../../data/augments.js";
import { ITEM_BY_ID } from "../../data/items.js";
import { clearCoopSession } from "../../network/coopSession.js";
import { startManagedScene } from "../../scenes/sceneLazyRouting.js";
import { getAISettings } from "../../systems/AISystem.js";
import { rollAiEquipmentIds } from "../../systems/AITeamGeneration.js";
import { getLootSourceLabel } from "./lootDropText.js";
import { guardPlanningTutorialAction, recordPlanningTutorialEvent, setPlanningTutorialMarker } from "./planningTutorialRuntime.js";
import { buildSharedLootLog, buildSharedRoundIncomeLog, buildSharedRoundRewardLog } from "./sceneLogRuntime.js";

interface PlanningPlayer {
  round: number;
  gold: number;
  hp: number;
  interestCapBonus?: number;
  interestRateBonus?: number;
  winStreak: number;
  loseStreak: number;
  fixedIncome?: number;
  winGoldBonus?: number;
  enemyPreview: unknown[];
  enemyPreviewRound: number;
  enemyBudget: number;
  augments: string[];
  augmentRoundsTaken: number[];
  itemBag: string[];
  fortressMeta?: unknown;
  gameMode?: string;
  [key: string]: unknown;
}

interface PlanningSceneLike extends Phaser.Scene {
  phase: string;
  aiMode: string;
  highlightLayer: { clear: () => void };
  turnQueue: unknown[];
  turnIndex: number;
  actionCount: number;
  globalDamageMult: number;
  isActing: boolean;
  selectedBenchIndex: number | null;
  settingsVisible: boolean;
  player: PlanningPlayer;
  gameModeConfig: { id?: string; goldScaling?: (round: number) => number; enabledSystems?: { augments?: boolean } } | null;
  gameMode: string;
  layout: unknown;
  overlaySprites: Phaser.GameObjects.GameObject[];
  planningSprites: Phaser.GameObjects.GameObject[];
  combatSprites: Phaser.GameObjects.GameObject[];
  combatUnits: unknown[];
  augments?: unknown[];
  augmentSystem?: { applyAugment: (augment: { id: string; name: string }) => void } | null;
  tooltip?: { hide?: () => void };
  tutorialOverlay?: { handleTrigger: (event: string) => void } | null;
  audioFx: { play: (key: string) => void };
  coopRunState: { shared?: { enemyPreview?: unknown[] } } | null;
  currentAugmentChoices: unknown[] | null;
  _planningRoundIntroDeferred: boolean;
  _pvpCombatReady: boolean;
  _pvpCombatStartRequested: boolean;
  _coopPlanningPingBySlot: Record<string, number> | null;
  _coopCombatStartRequested: boolean;
  dragUnit?: { uid?: string } | null;
  [key: string]: unknown;
}

interface EnterPlanningOptions {
  deferRoundIntroUi?: boolean;
}

interface AugmentChoice {
  id: string;
  name: string;
}

interface CombatResult {
  winnerSide: "LEFT" | "RIGHT" | "DRAW";
  assassinBountyGold?: number;
  round?: number;
  damage?: number;
  goldBase?: number;
  goldStarBonus?: number;
  goldDelta?: number;
  creativePassiveXpSuppressed?: boolean;
  creativeIgnoreDefeat?: boolean;
  fortressHpAfter?: number;
  matchEnded?: boolean;
  winnerSlot?: string;
  lootDrops?: string[];
  lootDropDetails?: Array<{ itemId?: string }>;
  [key: string]: unknown;
}

interface LootDropDetail {
  itemId?: string;
  [key: string]: unknown;
}

export function enterPlanning(scene: PlanningSceneLike, grantIncome: boolean, options: EnterPlanningOptions = {}): void {
    const deferRoundIntroUi = options?.deferRoundIntroUi === true;
    finalizePlanningTutorialCampaignIfNeeded(scene as unknown as Parameters<typeof finalizePlanningTutorialCampaignIfNeeded>[0]);
    scene._planningRoundIntroDeferred = deferRoundIntroUi;
    scene.phase = PHASE.PLANNING;
    togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
    clearPlanningCombatSprites(scene);
    scene.turnQueue = [];
    scene.turnIndex = 0;
    scene.actionCount = 0;
    scene.globalDamageMult = 1;
    scene.isActing = false;
    scene.selectedBenchIndex = null;
    scene.highlightLayer.clear();

    if (grantIncome) grantPlanningRoundIncome(scene);
    ensurePlanningTutorialRoundSetup(scene as unknown as Parameters<typeof ensurePlanningTutorialRoundSetup>[0]);
    preparePlanningEnemyPreview(scene);
    refreshPlanningShop(scene as unknown as Parameters<typeof refreshPlanningShop>[0], false);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    if (deferRoundIntroUi) {
      destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
      return;
    }

    showPlanningRoundIntroUi(scene);
}

export function grantPlanningRoundIncome(scene: PlanningSceneLike): void {
    if (isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.creativeIncomeIgnored"), "EVENT");
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      return;
    }
    const base = scene.gameModeConfig?.goldScaling?.(scene.player.round) ?? 5;
    const interestCap = 5 + (scene.player.interestCapBonus || 0);
    const rate = 0.1 + (scene.player.interestRateBonus || 0);
    const interest = Math.min(interestCap, Math.floor(scene.player.gold * rate));
    const winStreakBonus = scene.player.winStreak >= 2 ? Math.min(3, Math.floor(scene.player.winStreak / 2)) : 0;
    const loseStreakBonus = scene.player.loseStreak >= 2 ? Math.min(3, Math.floor(scene.player.loseStreak / 2)) : 0;
    const streak = Math.max(winStreakBonus, loseStreakBonus);
    const fixedIncome = scene.player.fixedIncome || 0;
    const gain = base + interest + streak + fixedIncome;
    gainGoldWithCreative(scene.player, scene.aiMode, gain);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundIncomeLog({
      round: scene.player.round,
      gain,
      base,
      interest,
      streak,
      fixedIncome,
      goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number
    }) as unknown as string, "EVENT");
    syncPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof syncPlanningEndlessAchievementSnapshot>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function preparePlanningEnemyPreview(scene: PlanningSceneLike, force: boolean = false): void {
    const isCoopMode = isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]);
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      const hadPreview = Array.isArray(scene.player.enemyPreview) && scene.player.enemyPreview.length > 0;
      scene.player.enemyPreview = [];
      scene.player.enemyPreviewRound = scene.player.round;
      scene.player.enemyBudget = 0;
      if (hadPreview) {
        persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      }
      return;
    }
    if (isCoopMode && !isPlanningCoopHost(scene as unknown as Parameters<typeof isPlanningCoopHost>[0])) {
      const sharedPreview = Array.isArray(scene.coopRunState?.shared?.enemyPreview)
        ? stampEnemyPreviewEntries(scene.coopRunState.shared.enemyPreview, {
            rowCount: getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0])
          })
        : [];
      if (sharedPreview.length) {
        scene.player.enemyPreview = sharedPreview;
        scene.player.enemyPreviewRound = scene.player.round;
        scene.player.enemyBudget = sharedPreview.length;
      }
      return;
    }
    const hadManualEnemyPreview = scene.player.enemyPreviewRound === scene.player.round
      && Array.isArray(scene.player.enemyPreview)
      && scene.player.enemyPreview.length === 0
      && scene.player.enemyBudget === 0;
    if (hasPlanningManualEnemySandboxUnits(scene as unknown as Parameters<typeof hasPlanningManualEnemySandboxUnits>[0])) {
      scene.player.enemyPreview = [];
      scene.player.enemyPreviewRound = scene.player.round;
      scene.player.enemyBudget = 0;
      if (force || !hadManualEnemyPreview) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.enemySandboxOverride"), "EVENT");
      }
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      return;
    }
    if (hadManualEnemyPreview) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.enemySandboxFallback"), "EVENT");
    }
    if (!force && scene.player.enemyPreviewRound === scene.player.round && scene.player.enemyPreview.length) return;
    const plan = generatePlanningEnemyPreviewPlan(scene);
    scene.player.enemyPreview = stampEnemyPreviewEntries(plan.units, {
      rowCount: getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0])
    });
    scene.player.enemyPreviewRound = scene.player.round;
    scene.player.enemyBudget = plan.budget;
    if (isCoopMode && scene.coopRunState?.shared) {
      scene.coopRunState.shared.enemyPreview = (scene.player.enemyPreview as unknown[]).map((unit: unknown) => ({ ...unit as Record<string, unknown> }));
    }
    if (plan.bossName) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.enemyScoutBoss", { name: plan.bossName }));
    } else {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.enemyScout", { count: plan.units.length, budget: plan.budget }));
    }
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function generatePlanningEnemyPreviewPlan(scene: PlanningSceneLike): { budget: number; units: unknown[]; bossName?: string } {
    if (usesBossRounds(scene.player?.gameMode ?? scene.gameMode)) {
      const bossEncounter = getEndlessBossEncounter(scene.player.round);
      if (bossEncounter) {
        return {
          budget: bossEncounter.units.length,
          units: stampEnemyPreviewEntries(bossEncounter.units, {
            rowCount: getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0])
          }),
          bossName: bossEncounter.name
        };
      }
    }
    const sandbox = scene.player.gameMode === "PVE_SANDBOX";
    const ai = getAISettings(scene.aiMode);
    const modeFactor = ai.budgetMult ?? 1;
    const fortressPending = getPlanningFortressPendingNode(scene as unknown as Parameters<typeof getPlanningFortressPendingNode>[0]);
    const fortressBudgetMult = Number.isFinite(fortressPending?.payload?.enemyBudgetMult)
      ? fortressPending!.payload!.enemyBudgetMult as number
      : 1;
    const budget = Math.round((8 + scene.player.round * (sandbox ? 2.1 : 2.6)) * modeFactor * fortressBudgetMult);

    const units = generateEnemyTeam(scene.player.round, budget, scene.aiMode, sandbox, {
      boardProfile: getPlanningBoardProfileId(scene as unknown as Parameters<typeof getPlanningBoardProfileId>[0])
    }).map((unit) => {
      const equips = rollAiEquipmentIds(scene.player.round, scene.aiMode, unit);
      return equips.length > 0 ? { ...unit, equips } : { ...unit };
    });

    return {
      budget,
      units: stampEnemyPreviewEntries(units, {
        rowCount: getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0])
      })
    };
}

export function showPlanningAugmentChoices(scene: PlanningSceneLike): void {
    scene.phase = PHASE.AUGMENT;
    scene.tooltip?.hide?.();
    const remaining = AUGMENT_LIBRARY.filter((a: { id: string }) => !scene.player.augments.includes(a.id));
    const tutorialChoices = isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0]) && scene.player.round === 7
      ? TUTORIAL_AUGMENT_CHOICES
          .map((id) => remaining.find((augment: { id: string }) => augment.id === id))
          .filter(Boolean)
      : null;
    const choices = tutorialChoices?.length ? tutorialChoices : sampleWithoutReplacement(remaining, 3);
    scene.currentAugmentChoices = choices;
    showSharedAugmentChoiceModal(scene as unknown as Parameters<typeof showSharedAugmentChoiceModal>[0], {
      choices: choices as unknown as Parameters<typeof showSharedAugmentChoiceModal>[1] extends { choices: infer C } ? C : never,
      onChoose: (choice: unknown) => choosePlanningAugment(scene, choice as unknown as AugmentChoice),
      getAugmentIcon: (augment: unknown) => getPlanningAugmentIcon(scene as unknown as Parameters<typeof getPlanningAugmentIcon>[0], augment as unknown as Parameters<typeof getPlanningAugmentIcon>[1]),
      translateAugmentGroup: (group: string) => planningTranslateAugmentGroup(scene as unknown as Parameters<typeof planningTranslateAugmentGroup>[0], group),
      getAugmentTooltip: (augment: unknown) => getPlanningAugmentTooltip(scene as unknown as Parameters<typeof getPlanningAugmentTooltip>[0], augment as unknown as Parameters<typeof getPlanningAugmentTooltip>[1])
    });
}

export function choosePlanningAugment(scene: PlanningSceneLike, augment: AugmentChoice): void {
    if (!augment) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "choose_augment", { augmentId: augment?.id }) === false) return;
    if (scene.augmentSystem) {
      scene.augmentSystem.applyAugment(augment);
    }
    scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
    createPlanningBenchSlots(scene as unknown as Parameters<typeof createPlanningBenchSlots>[0]);
    createPlanningStorageSpace(scene as unknown as Parameters<typeof createPlanningStorageSpace>[0]);
    scene.player.augmentRoundsTaken.push(scene.player.round);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.augmentSelected", { name: augment.name }));
    setPlanningTutorialMarker(scene as unknown as Parameters<typeof setPlanningTutorialMarker>[0], "lastAugmentId", augment.id);
    setPlanningTutorialMarker(scene as unknown as Parameters<typeof setPlanningTutorialMarker>[0], "lastAugmentName", augment.name);
    planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessAugment(
      profile,
      1,
      getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
    )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "choose_augment");
    clearPlanningOverlay(scene);
    scene.phase = PHASE.PLANNING;
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    scene.tutorialOverlay?.handleTrigger("choose_augment");
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function clearPlanningOverlay(scene: PlanningSceneLike): void {
    scene.overlaySprites.forEach((o: Phaser.GameObjects.GameObject) => o.destroy());
    scene.overlaySprites = [];
    scene.currentAugmentChoices = null;
}

export function beginPlanningCombat(scene: PlanningSceneLike): void {
    if (scene.settingsVisible) return;
    if (scene.phase !== PHASE.PLANNING) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "begin_combat", { buttonKey: "start" }) === false) return;
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) && isPlanningCoopHost(scene as unknown as Parameters<typeof isPlanningCoopHost>[0])) {
      const missingSlots = getPlanningCoopSlotsMissingDeployment(scene as unknown as Parameters<typeof getPlanningCoopSlotsMissingDeployment>[0]);
      if (missingSlots.length > 0) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0],
          missingSlots.length === 1
            ? t("planning.log.missingSlot", { slot: missingSlots[0] })
            : t("planning.log.missingSlots", { slots: missingSlots.join(", ") })
        );
        return;
      }
    } else if (getPlanningActiveLeftUnitCount(scene as unknown as Parameters<typeof getPlanningActiveLeftUnitCount>[0]) <= 0) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.needBeast"));
      return;
    }
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      if (scene._pvpCombatReady) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.pvpWaitingMatch"));
        return;
      }
      scene._pvpCombatReady = true;
      scene._pvpCombatStartRequested = false;
      scene.audioFx.play("skill");
      syncPlanningPvpSessionState(scene as unknown as Parameters<typeof syncPlanningPvpSessionState>[0], true, { combatReady: true });
      if (!maybePlanningStartPvpCombat(scene as unknown as Parameters<typeof maybePlanningStartPvpCombat>[0])) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.readyWaitingPlayers"));
      }
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "click_combat");
      scene.tutorialOverlay?.handleTrigger("click_combat");
      destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
      return;
    }
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) && !isPlanningCoopHost(scene as unknown as Parameters<typeof isPlanningCoopHost>[0])) {
      const localSlot = getPlanningCoopLocalSlot(scene as unknown as Parameters<typeof getPlanningCoopLocalSlot>[0]);
      const round = Number.isFinite(scene.player?.round) ? Math.max(1, Math.floor(scene.player.round)) : 1;
      if (scene._coopPlanningPingBySlot?.[localSlot] === round) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.pingHostReady", { slot: localSlot }));
        return;
      }
      scene.audioFx.play("skill");
      notePlanningCoopPlanningPing(scene as unknown as Parameters<typeof notePlanningCoopPlanningPing>[0], localSlot, round);
      try {
        (getCoopSession()?.client as { send?: (data: unknown) => void; close?: (code?: number, reason?: string) => void } | null | undefined)?.send?.({
          type: COOP_MESSAGE_TYPES.PLANNING_READY_PING,
          payload: {
            slot: localSlot,
            playerId: getCoopSession()?.playerId ?? null,
            round,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.warn("[PlanningScene] Failed to ping coop host readiness.", error);
      }
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.pingHostReady", { slot: localSlot }));
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "click_combat");
      scene.tutorialOverlay?.handleTrigger("click_combat");
      destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
      refreshPlanningButtons(scene as unknown as Parameters<typeof refreshPlanningButtons>[0]);
      return;
    }
    preparePlanningEnemyPreview(scene);
    scene.audioFx.play("skill");
    recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "click_combat");
    if (isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0]) && scene.player.round === TUTORIAL_END_ROUND) {
      getPlanningTutorialState(scene as unknown as Parameters<typeof getPlanningTutorialState>[0]).completed = true;
    }
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    const runState = exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]);
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      scene._coopCombatStartRequested = true;
      try {
        (getCoopSession()?.client as { send?: (data: unknown) => void; close?: (code?: number, reason?: string) => void } | null | undefined)?.send?.({
          type: COOP_MESSAGE_TYPES.COMBAT_START,
          payload: { runState }
        });
      } catch (error) {
        console.warn("[PlanningScene] Failed to broadcast coop combat start.", error);
      }
    }
    scene.tutorialOverlay?.handleTrigger("click_combat");
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    startManagedScene(scene as unknown as Parameters<typeof startManagedScene>[0], "CombatScene", {
      runState
    });
}

export function clearPlanningSprites(scene: PlanningSceneLike): void {
    scene.planningSprites.forEach((s: Phaser.GameObjects.GameObject) => s.destroy());
    scene.planningSprites = [];
}

export function clearPlanningCombatSprites(scene: PlanningSceneLike): void {
    scene.combatSprites.forEach((s: Phaser.GameObjects.GameObject) => s.destroy());
    scene.combatSprites = [];
    scene.combatUnits = [];
    scene.highlightLayer.clear();
    clearPlanningAttackPreview(scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0]);
}

export function showPlanningRoundIntroUi(scene: PlanningSceneLike): void {
    refreshPlanningTutorialOverlay(scene as unknown as Parameters<typeof refreshPlanningTutorialOverlay>[0]);

    const shouldShowTutorialAugment = isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0])
      && scene.player.round === 7
      && !scene.player.augmentRoundsTaken.includes(scene.player.round);
    const shouldShowNormalAugment = !isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0])
      && scene.gameModeConfig?.enabledSystems?.augments !== false
      && AUGMENT_ROUNDS.includes(scene.player.round)
      && !scene.player.augmentRoundsTaken.includes(scene.player.round);
    if (shouldShowTutorialAugment || shouldShowNormalAugment) {
      showPlanningAugmentChoices(scene);
    }
}

export function planningFlushDeferredPlanningRoundIntroUi(scene: PlanningSceneLike): void {
    if (scene._planningRoundIntroDeferred !== true) return;
    scene._planningRoundIntroDeferred = false;
    showPlanningRoundIntroUi(scene);
}

export function applyPlanningCombatResult(scene: PlanningSceneLike, result: CombatResult): void {
    if (!result) return;
    const won = result.winnerSide === "LEFT";
    const assassinBountyGold = Math.max(0, Number(result.assassinBountyGold) || 0);
    const shouldSkipPostCombatStatsModal = planningShouldSkipPostCombatStatsModal(scene as unknown as Parameters<typeof planningShouldSkipPostCombatStatsModal>[0], result);
    const pvpRoomMode = isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0]);
    const localSlot = pvpRoomMode ? getPlanningSessionLocalSlot(scene as unknown as Parameters<typeof getPlanningSessionLocalSlot>[0]) : null;
    const fortressHpAfter = Number.isFinite(result?.fortressHpAfter)
      ? Math.max(0, Math.floor(result.fortressHpAfter as number))
      : null;
    if (result.winnerSide === "DRAW") {
      if (!isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]) && assassinBountyGold > 0) {
        gainGoldWithCreative(scene.player, scene.aiMode, assassinBountyGold, { allowCreativeMutation: false });
      }
      applyPlanningLootDrops(scene, result);
      scene.player.winStreak = 0;
      scene.player.loseStreak = 0;
      if (fortressHpAfter != null) {
        scene.player.hp = fortressHpAfter;
      }
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundRewardLog({
        round: result.round ?? scene.player.round,
        outcome: "DRAW",
        assassinBountyGold,
        goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number,
        playerHearts: scene.player.hp
      }) as unknown as string, "COMBAT");
      scene.player.round = (result.round ?? scene.player.round) + 1;
      scene._pvpCombatReady = false;
      scene._pvpCombatStartRequested = false;
      planningResetBoardViewTransform(scene as unknown as Parameters<typeof planningResetBoardViewTransform>[0], true);
      const resumePlanning = () => resumePlanningAfterCombat(scene, t("planning.result.draw"), true);
      if (shouldSkipPostCombatStatsModal) {
        resumePlanning();
      } else {
        showPlanningCombatResultModal(scene as unknown as Parameters<typeof showPlanningCombatResultModal>[0], result, resumePlanning);
      }
      syncPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof syncPlanningEndlessAchievementSnapshot>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      return;
    }
    if (result.winnerSide === "LEFT") {
      scene.player.winStreak += 1;
      scene.player.loseStreak = 0;
      const baseGold = result.goldBase ?? (result.goldDelta ?? 0);
      const starBonus = result.goldStarBonus ?? Math.max(0, (result.goldDelta ?? 0) - baseGold);
      const extraGold = scene.player.winGoldBonus || 0;
      const awardedGold = Number.isFinite(result.goldDelta) && (result.goldDelta as number) > 0
        ? result.goldDelta
        : (baseGold + starBonus);
      if (!isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) {
        gainGoldWithCreative(scene.player, scene.aiMode, (awardedGold as number) + extraGold, { allowCreativeMutation: false });
      }
      if (!result.creativePassiveXpSuppressed) {
        gainPlanningXp(scene as unknown as Parameters<typeof gainPlanningXp>[0], 2);
      }
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundRewardLog({
        round: result.round ?? scene.player.round,
        outcome: "WIN",
        baseGold,
        starBonus,
        extraGold,
        assassinBountyGold,
        xpEarned: result.creativePassiveXpSuppressed ? 0 : 2,
        playerHearts: scene.player.hp,
        goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number
      }) as unknown as string, "COMBAT");
    } else {
      scene.player.loseStreak += 1;
      scene.player.winStreak = 0;
      if (!isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]) && assassinBountyGold > 0) {
        gainGoldWithCreative(scene.player, scene.aiMode, assassinBountyGold, { allowCreativeMutation: false });
      }
      if (result.creativeIgnoreDefeat) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.creativeDefeatIgnored"), "EVENT");
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundRewardLog({
          round: result.round ?? scene.player.round,
          outcome: "LOSE",
          assassinBountyGold,
          goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number,
          playerHearts: scene.player.hp
        }) as unknown as string, "COMBAT");
      } else if (getPlanningLoseCondition(scene as unknown as Parameters<typeof getPlanningLoseCondition>[0]) === "NO_HEARTS") {
        const damage = Math.max(0, Number.isFinite(result.damage) ? Math.floor(result.damage as number) : 0);
        scene.player.hp = fortressHpAfter != null
          ? fortressHpAfter
          : Math.max(0, scene.player.hp - damage);
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundRewardLog({
          round: result.round ?? scene.player.round,
          outcome: "LOSE",
          damageTaken: damage,
          assassinBountyGold,
          goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number,
          playerHearts: scene.player.hp
        }) as unknown as string, "COMBAT");
        if (scene.player.hp <= 0) {
          handlePlanningTotalDefeat(scene);
          return;
        }
      } else {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedRoundRewardLog({
          round: result.round ?? scene.player.round,
          outcome: "LOSE",
          assassinBountyGold,
          goldAfter: getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]) as unknown as number,
          playerHearts: scene.player.hp
        }) as unknown as string, "COMBAT");
        handlePlanningTotalDefeat(scene);
        return;
      }
    }
    applyPlanningLootDrops(scene, result);

    scene.player.round = (result.round ?? scene.player.round) + 1;
    if (won) {
      planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessRoundWon(
        profile,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    } else {
      planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessRoundLost(
        profile,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    }
    if (isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0])) {
      scene.player.fortressMeta = clearFortressPendingNode(scene.player.fortressMeta as unknown as Record<string, unknown>, {
        round: scene.player.round
      });
      const finishFortressReturn = () => {
        persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
        startPlanningFortressMapScene(scene as unknown as Parameters<typeof startPlanningFortressMapScene>[0], { restoredState: exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]) });
      };
      if (shouldSkipPostCombatStatsModal) {
        finishFortressReturn();
      } else {
        showPlanningCombatResultModal(scene as unknown as Parameters<typeof showPlanningCombatResultModal>[0], result, finishFortressReturn);
      }
      return;
    }
    if (pvpRoomMode && result.matchEnded === true && result.winnerSlot === localSlot) {
      const finishVictory = () => handlePlanningTotalVictory(scene, t("planning.result.pvpChampion"));
      if (shouldSkipPostCombatStatsModal) {
        finishVictory();
      } else {
        showPlanningCombatResultModal(scene as unknown as Parameters<typeof showPlanningCombatResultModal>[0], result, finishVictory);
      }
      return;
    }
    scene._pvpCombatReady = false;
    scene._pvpCombatStartRequested = false;
    planningResetBoardViewTransform(scene as unknown as Parameters<typeof planningResetBoardViewTransform>[0], true);
    const resumePlanning = () => resumePlanningAfterCombat(scene, won ? t("planning.result.win") : t("planning.result.loss"), won);
    if (shouldSkipPostCombatStatsModal) {
      resumePlanning();
    } else {
      showPlanningCombatResultModal(scene as unknown as Parameters<typeof showPlanningCombatResultModal>[0], result, resumePlanning);
    }
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function resumePlanningAfterCombat(scene: PlanningSceneLike, resultLabel: string, isWin: boolean = true): void {
    enterPlanning(scene, true, { deferRoundIntroUi: true });
    showPlanningRoundResultBanner(scene as unknown as Parameters<typeof showPlanningRoundResultBanner>[0], resultLabel, isWin, 1100, () => {
      planningFlushDeferredPlanningRoundIntroUi(scene);
    });
}

export function handlePlanningTotalVictory(scene: PlanningSceneLike, label: string = t("planning.result.totalVictory")): void {
    scene.phase = PHASE.GAME_OVER;
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.totalVictoryReturn"));
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
      (getCoopSession()?.client as { close?: (code?: number, reason?: string) => void } | null | undefined)?.close?.(1000, "Network run ended");
      clearCoopSession();
    } else if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      clearPlanningActiveCoopSave(scene as unknown as Parameters<typeof clearPlanningActiveCoopSave>[0]);
      cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
      (getCoopSession()?.client as { close?: (code?: number, reason?: string) => void } | null | undefined)?.close?.(1000, "Network run ended");
      clearCoopSession();
    } else {
      clearRunProgress();
    }
    showPlanningRoundResultBanner(scene as unknown as Parameters<typeof showPlanningRoundResultBanner>[0],label, true, 1550, () => {
      destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
      scene.scene.start("MainMenuScene");
    });
}

export function handlePlanningTotalDefeat(scene: PlanningSceneLike): void {
    scene.player.hp = 0;
    planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessRoundLost(
      profile,
      getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
    )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    scene.phase = PHASE.GAME_OVER;
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.totalLossReturn"));
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
      (getCoopSession()?.client as { close?: (code?: number, reason?: string) => void } | null | undefined)?.close?.(1000, "Network run ended");
      clearCoopSession();
    } else if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      clearPlanningActiveCoopSave(scene as unknown as Parameters<typeof clearPlanningActiveCoopSave>[0]);
      cleanupPlanningCoopBindings(scene as unknown as Parameters<typeof cleanupPlanningCoopBindings>[0]);
      (getCoopSession()?.client as { close?: (code?: number, reason?: string) => void } | null | undefined)?.close?.(1000, "Network run ended");
      clearCoopSession();
    } else {
      clearRunProgress();
    }
    showPlanningRoundResultBanner(scene as unknown as Parameters<typeof showPlanningRoundResultBanner>[0], t("planning.result.totalLoss"), false, 1450, () => {
      destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
      scene.scene.start("MainMenuScene");
    });
}

export function applyPlanningLootDrops(scene: PlanningSceneLike, result: CombatResult): void {
    const lootDrops = Array.isArray(result?.lootDrops)
      ? (result.lootDrops as string[]).filter((id) => ITEM_BY_ID[id])
      : [];
    if (!lootDrops.length) return;
    scene.player.itemBag.push(...lootDrops);
    const lootCounts: Record<string, number> = {};
    lootDrops.forEach((id) => {
      lootCounts[id] = (lootCounts[id] ?? 0) + 1;
    });
    const lootLabel = Object.entries(lootCounts)
      .map(([id, amount]) => {
        const item = ITEM_BY_ID[id];
        return `${item?.icon ?? "❔"} ${item?.name ?? id} x${amount}`;
      })
      .join(", ");
    const lootSources: LootDropDetail[] = Array.isArray(result?.lootDropDetails) ? result.lootDropDetails as LootDropDetail[] : [];
    const groupedSources = new Map<string, Map<string, number>>();
    lootSources.forEach((detail) => {
      const itemId = detail?.itemId;
      if (!itemId) return;
      if (!groupedSources.has(itemId)) groupedSources.set(itemId, new Map());
      const sourceLabel = getLootSourceLabel(detail);
      const sourceMap = groupedSources.get(itemId);
      if (!sourceMap) return;
      sourceMap.set(sourceLabel, (sourceMap.get(sourceLabel) ?? 0) + 1);
    });
    const sourceLines = Object.keys(lootCounts).flatMap((itemId) => {
      const sourceMap = groupedSources.get(itemId);
      if (!sourceMap?.size) return [];
      const item = ITEM_BY_ID[itemId];
      const sourceText = Array.from(sourceMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, amount]) => amount > 1 ? `${label} x${amount}` : label)
        .join("; ");
      return [t("planning.result.lootSource", { item: item?.name ?? itemId, source: sourceText })];
    });
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], buildSharedLootLog({
      title: t("planning.result.lootTitle"),
      lootLabel,
      sourceLines
    }) as unknown as string, "EVENT");
    planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessLoot(
      profile,
      lootDrops.length,
      getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
    )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
}
