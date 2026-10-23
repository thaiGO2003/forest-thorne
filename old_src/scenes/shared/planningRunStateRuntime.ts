import { PHASE, ROWS, COLS, PLAYER_COLS } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";

import { UNIT_CATALOG, UNIT_BY_ID } from "../../data/unitCatalog.js";
import { BoardSystem } from "../../systems/BoardSystem.js";
import {
  createDefaultCoopRunState,
  createDefaultRunState,
  createOwnedUnit as createPersistedOwnedUnit,
  serializeRunState,
  type CoopRunState,
  type PlayerState,
  type SoloRunState
} from "../../core/runState.js";
import { clearRunProgress, saveProgress } from "../../core/persistence.js";
import { isEndlessFortressMode } from "../../core/fortressMode.js";
import { isPvpGameMode } from "../../core/gameModeRuntime.js";
import {
  getCoopPlayerSlots,
  isCoopAiMode,
  normalizeAiMode
} from "../../core/aiModes.js";
import {
  getCoopSession,
  isCoopSessionActive,
  updateCoopSession
} from "../../network/coopSession.js";
import {
  normalizePvpFortressState,
  PVP_FORTRESS_SESSION_TYPE
} from "../../network/pvpFortress.js";
import {
  loadEndlessAchievementProfile,
  noteEndlessRunStarted,
  noteEndlessProgressSnapshot,
  saveEndlessAchievementProfile,
  shouldTrackEndlessAchievements as shouldTrackEndlessAchievementsCore,

} from "../../core/endlessAchievements.js";
import { clamp } from "../../core/gameUtils.js";

interface EndlessProfileLike { version: number; lastUpdatedAt: number; stats: Record<string, unknown>; [key: string]: unknown; }

import { createPlanningBenchSlots } from "./planningBenchRuntime.js";
import { refreshPlanningBoardGeometry } from "./planningBoardInteractionRuntime.js";
import { clearPlanningCombatSprites, clearPlanningOverlay, clearPlanningSprites, enterPlanning } from "./planningCombatTransitionRuntime.js";
import { getPlanningBoardRowCount, getPlanningCoopLocalSlot, isPlanningCoopMode, persistPlanningActiveCoopSave, syncPlanningCoopSessionState } from "./planningCoopSessionRuntime.js";
import { planningEndCortisolDanceMode } from "./planningCortisolRuntime.js";
import { getPlanningCraftActiveIndices } from "./planningCraftRuntime.js";
import { getPlanningConfiguredLoseCondition, getPlanningConfiguredStartingHp, startPlanningFortressMapScene } from "./planningFortressHelpersRuntime.js";
import { planningNormalizeEquipIds } from "./planningItemHelpersRuntime.js";
import { computePlanningLayout } from "./planningLayoutRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { getPlanningPvpSessionSlots, getPlanningSessionLocalSlot, isPlanningPvpRoomMode, syncPlanningPvpSessionState } from "./planningPvpSessionRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { applyPlanningRuntimeSettings, planningResetBoardViewTransform } from "./planningSceneLifecycleRuntime.js";
import { togglePlanningHistoryModal, togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { gainPlanningXp } from "./planningShopActionsRuntime.js";

import { normalizeCreativeSandboxUnit } from "../../core/creativeMode.js";
import { ensureFortressGraph } from "../../core/fortressMode.js";
import { DEFAULT_LOSE_CONDITION } from "../../core/gameRules.js";
import { createUnitUid, getXpToLevelUp, sampleWithoutReplacement } from "../../core/gameUtils.js";
import { normalizeOwnedUnitTraits } from "../../core/variantTraits.js";
import { ITEM_BY_ID } from "../../data/items.js";
import { AugmentSystem } from "../../systems/AugmentSystem.js";
import type { GameModeConfig } from "../../gameModes/GameModeConfig.js";

interface CoopSharedStateLike {
  enemyPreview?: unknown[];
  [key: string]: unknown;
}

interface CoopRunStateLike {
  players: Record<string, PlayerState>;
  roomCode?: string;
  hostSlot?: string;
  localSlot?: string;
  coopDifficulty?: string;
  shared?: CoopSharedStateLike;
  playerCapacity?: number;
  [key: string]: unknown;
}

interface PlanningRunStateEx {
  aiMode: string;
  audioFx: { setEnabled: (enabled: boolean) => void; enabled?: boolean };
  incomingData?: { aiMode?: string; coopSession?: boolean; [key: string]: unknown };
  runtimeSettings?: { aiMode?: string; loseCondition?: string; [key: string]: unknown };
  gameMode: string;
  gameModeConfig?: GameModeConfig | null;
  player: PlayerState;
  turnQueue: unknown[];
  turnIndex: number;
  actionCount: number;
  globalDamageMult: number;
  isActing: boolean;
  phase: string;
  logs: unknown[];
  logHistory: unknown[];
  historyScrollOffset: number;
  historyFilter: string;
  craftGridItems: (string | null)[];
  selectedInventoryItemId: string | null;
  selectedInventoryItemType: string | null;
  selectedBenchIndex: number | null;
  augmentSystem: AugmentSystem | null;
  layout: { boardOriginX: number; boardOriginY: number; [key: string]: unknown } | null;
  originX: number;
  originY: number;
  benchUpgradeLevel: number;
  coopLocalSlot: string;
  coopRunState: CoopRunStateLike | null;
  persistEnabled: boolean;
  endlessAchievementProfile: EndlessProfileLike | null;
  _pvpCombatReady?: boolean;
  _pvpCombatStartRequested?: boolean;
  _coopCombatStartRequested?: boolean;
  [key: string]: unknown;
}

export function startPlanningNewRun(scene: PlanningRunStateEx): void {
    planningEndCortisolDanceMode(scene as unknown as Parameters<typeof planningEndCortisolDanceMode>[0], { clearWindow: true });
    const requestedAiMode = normalizeAiMode(
      (scene.incomingData?.aiMode ?? scene.runtimeSettings?.aiMode ?? scene.aiMode) as string,
      "EASY"
    );
    if (isEndlessFortressMode(scene.gameMode) && !isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      clearRunProgress();
      startPlanningFortressMapScene(scene as unknown as Parameters<typeof startPlanningFortressMapScene>[0], { forceNewRun: true });
      return;
    }
    if ((scene.incomingData?.coopSession === true || isCoopSessionActive()) && isPvpGameMode(scene.gameMode)) {
      clearRunProgress();
      togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
      togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
      clearPlanningCombatSprites(scene as unknown as Parameters<typeof clearPlanningCombatSprites>[0]);
      clearPlanningSprites(scene as unknown as Parameters<typeof clearPlanningSprites>[0]);
      clearPlanningOverlay(scene as unknown as Parameters<typeof clearPlanningOverlay>[0]);
      scene.selectedBenchIndex = null;
      scene.turnQueue = [];
      scene.turnIndex = 0;
      scene.actionCount = 0;
      scene.globalDamageMult = 1;
      scene.isActing = false;
      scene.phase = PHASE.PLANNING;
      scene.logs = [];
      scene.logHistory = [];
      scene.historyScrollOffset = 0;
      scene.historyFilter = "ALL";
      planningResetBoardViewTransform(scene as unknown as Parameters<typeof planningResetBoardViewTransform>[0], true);
      scene.craftGridItems = Array.from({ length: 9 }, () => null);
      scene.selectedInventoryItemId = null;
      scene.selectedInventoryItemType = null;
      scene._pvpCombatReady = false;
      scene._pvpCombatStartRequested = false;

      applyPlanningRunState(scene, createDefaultRunState());
      scene.player.gameMode = scene.gameMode;
      scene.player.loseCondition = "NO_HEARTS";
      scene.player.gold = scene.gameModeConfig?.startingGold ?? 10;
      scene.player.hp = scene.gameModeConfig?.startingHP ?? 100;

      const session = getCoopSession();
      const slots = getPlanningPvpSessionSlots(scene as unknown as Parameters<typeof getPlanningPvpSessionSlots>[0]);
      const nextPvpState = normalizePvpFortressState(session?.pvpState as unknown as Parameters<typeof normalizePvpFortressState>[0], {
        slots,
        startingHp: scene.gameModeConfig?.startingHP ?? 100
      });
      const localSlot = getPlanningSessionLocalSlot(scene as unknown as Parameters<typeof getPlanningSessionLocalSlot>[0]);
      const localHp = (nextPvpState.castleHpBySlot as Record<string, number> | undefined)?.[localSlot];
      if (Number.isFinite(localHp)) {
        scene.player.hp = Math.max(0, Math.floor(localHp as number));
      } else {
        (nextPvpState.castleHpBySlot as Record<string, number>)[localSlot] = scene.player.hp;
      }

      updateCoopSession({
        sessionType: PVP_FORTRESS_SESSION_TYPE,
        selectedMode: scene.gameMode,
        aiMode: requestedAiMode,
        players: {
          [localSlot]: scene.player
        },
        pvpState: nextPvpState as unknown as Record<string, unknown>
      } as unknown as Parameters<typeof updateCoopSession>[0]);

      scene.aiMode = requestedAiMode;
      applyPlanningRuntimeSettings(scene as unknown as Parameters<typeof applyPlanningRuntimeSettings>[0], (scene.runtimeSettings ?? {}) as Parameters<typeof applyPlanningRuntimeSettings>[1]);
      enterPlanning(scene as unknown as Parameters<typeof enterPlanning>[0], false);
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.newRunPvp4"));
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      return;
    }
    if ((scene.incomingData?.coopSession === true || isCoopSessionActive()) && isCoopAiMode(requestedAiMode)) {
      togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
      togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
      clearPlanningCombatSprites(scene as unknown as Parameters<typeof clearPlanningCombatSprites>[0]);
      clearPlanningSprites(scene as unknown as Parameters<typeof clearPlanningSprites>[0]);
      clearPlanningOverlay(scene as unknown as Parameters<typeof clearPlanningOverlay>[0]);
      scene.selectedBenchIndex = null;
      scene.turnQueue = [];
      scene.turnIndex = 0;
      scene.actionCount = 0;
      scene.globalDamageMult = 1;
      scene.isActing = false;
      scene.phase = PHASE.PLANNING;
      scene.logs = [];
      scene.logHistory = [];
      scene.historyScrollOffset = 0;
      scene.historyFilter = "ALL";
      planningResetBoardViewTransform(scene as unknown as Parameters<typeof planningResetBoardViewTransform>[0], true);
      scene.craftGridItems = Array.from({ length: 9 }, () => null);
      scene.selectedInventoryItemId = null;
      scene.selectedInventoryItemType = null;
      scene._coopCombatStartRequested = false;

      const session = getCoopSession();
      const state = createDefaultCoopRunState(requestedAiMode);
      const loseCondition = getPlanningConfiguredLoseCondition(scene as unknown as Parameters<typeof getPlanningConfiguredLoseCondition>[0], "NO_HEARTS");
      const startingHp = getPlanningConfiguredStartingHp(scene as unknown as Parameters<typeof getPlanningConfiguredStartingHp>[0], scene.gameModeConfig?.startingHP ?? 3);
      state.roomCode = session?.roomCode ?? "";
      state.localSlot = session?.localSlot ?? "P1";
      state.hostSlot = session?.hostSlot ?? "P1";
      state.shared = {
        ...state.shared,
        round: 1,
        phase: PHASE.PLANNING,
        enemyPreview: [],
        loseRule: "ALLY_TEAM_WIPE"
      };
      getCoopPlayerSlots(requestedAiMode).forEach((slot) => {
        const sourcePlayer = session?.players?.[slot];
        const player = {
          ...state.players[slot],
          ...(sourcePlayer ?? {})
        } as PlayerState;
        player.gameMode = scene.gameMode;
        player.loseCondition = loseCondition as PlayerState["loseCondition"];
        player.round = 1;
        if (scene.gameModeConfig) {
          player.gold = scene.gameModeConfig.startingGold;
        }
        player.hp = startingHp;
        state.players[slot] = player;
      });

      applyPlanningRunState(scene, state);
      applyPlanningRuntimeSettings(scene as unknown as Parameters<typeof applyPlanningRuntimeSettings>[0], (scene.runtimeSettings ?? {}) as Parameters<typeof applyPlanningRuntimeSettings>[1]);
      enterPlanning(scene as unknown as Parameters<typeof enterPlanning>[0], false);
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.newRunCoop", { count: state.playerCapacity }));
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      return;
    }

    clearRunProgress();
    togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
    togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
    clearPlanningCombatSprites(scene as unknown as Parameters<typeof clearPlanningCombatSprites>[0]);
    clearPlanningSprites(scene as unknown as Parameters<typeof clearPlanningSprites>[0]);
    clearPlanningOverlay(scene as unknown as Parameters<typeof clearPlanningOverlay>[0]);
    scene.selectedBenchIndex = null;
    scene.turnQueue = [];
    scene.turnIndex = 0;
    scene.actionCount = 0;
    scene.globalDamageMult = 1;
    scene.isActing = false;
    scene.phase = PHASE.PLANNING;
    scene.logs = [];
    scene.logHistory = [];
    scene.historyScrollOffset = 0;
    scene.historyFilter = "ALL";
    planningResetBoardViewTransform(scene as unknown as Parameters<typeof planningResetBoardViewTransform>[0], true);
    scene.craftGridItems = Array.from({ length: 9 }, () => null);
    scene.selectedInventoryItemId = null;
    scene.selectedInventoryItemType = null;

    applyPlanningRunState(scene, createDefaultRunState());
    scene.player.gameMode = scene.gameMode;
    scene.player.loseCondition = getPlanningConfiguredLoseCondition(
      scene as unknown as Parameters<typeof getPlanningConfiguredLoseCondition>[0],
      ((scene.runtimeSettings?.loseCondition ?? DEFAULT_LOSE_CONDITION) as unknown) as Parameters<typeof getPlanningConfiguredLoseCondition>[1]
    );

    // Apply game mode config starting values
    if (scene.gameModeConfig) {
      scene.player.gold = scene.gameModeConfig.startingGold;
      scene.player.hp = getPlanningConfiguredStartingHp(scene as unknown as Parameters<typeof getPlanningConfiguredStartingHp>[0], scene.gameModeConfig.startingHP);
    } else {
      // Fallback to default values
      scene.player.hp = getPlanningConfiguredStartingHp(scene as unknown as Parameters<typeof getPlanningConfiguredStartingHp>[0]);
    }

    applyPlanningRuntimeSettings(scene as unknown as Parameters<typeof applyPlanningRuntimeSettings>[0], (scene.runtimeSettings ?? {}) as Parameters<typeof applyPlanningRuntimeSettings>[1]);
    enterPlanning(scene as unknown as Parameters<typeof enterPlanning>[0], false);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.newRunSolo"));
    scene.endlessAchievementProfile = loadEndlessAchievementProfile() as unknown as EndlessProfileLike;
    planningUpdateEndlessAchievementProfile(scene, ((profile: EndlessProfileLike): EndlessProfileLike => noteEndlessRunStarted(profile as unknown as Parameters<typeof noteEndlessRunStarted>[0], getPlanningEndlessAchievementSnapshot(scene)) as unknown as EndlessProfileLike));
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function applyPlanningRunState(scene: PlanningRunStateEx, state: SoloRunState | CoopRunState): void {
    const coopState: CoopRunStateLike | null = state?.players && typeof state.players === "object" ? (state as unknown as CoopRunStateLike) : null;
    scene.coopRunState = coopState;
    if (coopState) {
      const session = getCoopSession();
      scene.coopLocalSlot = session?.localSlot ?? coopState.localSlot ?? "P1";
      scene.aiMode = normalizeAiMode((coopState.coopDifficulty ?? coopState.aiMode ?? scene.aiMode ?? scene.runtimeSettings?.aiMode) as string, "COOP_MEDIUM");
      scene.player = coopState.players?.[scene.coopLocalSlot] ?? coopState.players?.[getCoopPlayerSlots(scene.aiMode)[0]];
      scene.persistEnabled = true;
      updateCoopSession({
        roomCode: coopState.roomCode,
        localSlot: scene.coopLocalSlot,
        hostSlot: session?.hostSlot ?? coopState.hostSlot ?? "P1",
        aiMode: scene.aiMode,
        selectedMode: scene.gameMode,
        players: coopState.players as unknown as Record<string, unknown>,
        shared: coopState.shared
      } as unknown as Parameters<typeof updateCoopSession>[0]);
    } else {
      scene.coopLocalSlot = "P1";
      scene.aiMode = normalizeAiMode((state as unknown as { aiMode?: string }).aiMode ?? scene.aiMode ?? (scene.runtimeSettings?.aiMode as string | undefined) ?? "", "EASY");
      scene.player = (state as unknown as { player: PlayerState }).player;
      scene.persistEnabled = true;
    }
    scene.audioFx.setEnabled((state as unknown as { audioEnabled?: boolean }).audioEnabled !== false);
    ensurePlanningPlayerStateFields(scene);

    if (scene.augmentSystem) {
      scene.augmentSystem = null;
    }
    scene.augmentSystem = new AugmentSystem(scene.player as unknown as ConstructorParameters<typeof AugmentSystem>[0], {
      onGainXp: (val: number) => gainPlanningXp(scene as unknown as Parameters<typeof gainPlanningXp>[0], val)
    });

    // Always rebuild layout + bench hitboxes from restored state to avoid stale drag targets after continue.
    scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]) as PlanningRunStateEx["layout"];
    createPlanningBenchSlots(scene as unknown as Parameters<typeof createPlanningBenchSlots>[0]);
    // Sync board origin with new layout so gridToScreen() returns correct coords.
    scene.originX = (scene.layout as { boardOriginX: number }).boardOriginX;
    scene.originY = (scene.layout as { boardOriginY: number }).boardOriginY;
    // Sync tile centers with new layout so board hit detection works after resume.
    refreshPlanningBoardGeometry(scene as unknown as Parameters<typeof refreshPlanningBoardGeometry>[0]);
    if (scene.runtimeSettings) scene.runtimeSettings.loseCondition = getPlanningConfiguredLoseCondition(
      scene as unknown as Parameters<typeof getPlanningConfiguredLoseCondition>[0],
      (scene.player.loseCondition ?? scene.runtimeSettings?.loseCondition ?? DEFAULT_LOSE_CONDITION) as Parameters<typeof getPlanningConfiguredLoseCondition>[1]
    );
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
}

export function exportPlanningRunState(scene: PlanningRunStateEx): unknown {
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      return serializeRunState({
        aiMode: scene.aiMode,
        audioEnabled: scene.audioFx?.enabled !== false,
        player: scene.player
      });
    }
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      const session = getCoopSession();
      const localSlot = getPlanningCoopLocalSlot(scene as unknown as Parameters<typeof getPlanningCoopLocalSlot>[0]);
      const coopSlots = getCoopPlayerSlots(scene.aiMode);
      const players: Record<string, PlayerState> = {};
      coopSlots.forEach((slot) => {
        if (slot === localSlot) {
          players[slot] = scene.player;
          return;
        }
        players[slot] = (session?.players?.[slot] ?? scene.coopRunState?.players?.[slot]) as PlayerState;
      });
      return serializeRunState({
        aiMode: scene.aiMode,
        audioEnabled: scene.audioFx?.enabled !== false,
        roomCode: session?.roomCode ?? scene.coopRunState?.roomCode ?? "",
        localSlot,
        hostSlot: session?.hostSlot ?? scene.coopRunState?.hostSlot ?? "P1",
        coopDifficulty: scene.aiMode,
        shared: {
          ...(scene.coopRunState?.shared ?? {}),
          round: scene.player.round,
          phase: scene.phase,
          loseRule: "ALLY_TEAM_WIPE",
          enemyPreview: Array.isArray(scene.coopRunState?.shared?.enemyPreview)
            ? (scene.coopRunState.shared.enemyPreview as unknown[]).map((unit) => ({ ...unit as object }))
            : (Array.isArray(scene.player.enemyPreview) ? scene.player.enemyPreview.map((unit) => ({ ...unit as object })) : [])
        },
        players: {
          ...(scene.coopRunState?.players ?? {}),
          ...players
        }
      });
    }
    return serializeRunState({
      aiMode: scene.aiMode,
      audioEnabled: scene.audioFx?.enabled !== false,
      player: scene.player
    });
}

interface EnemyPreviewEntry {
  baseId: string;
  [key: string]: unknown;
}

export function ensurePlanningPlayerStateFields(scene: PlanningRunStateEx): void {
    scene.player.board = planningNormalizeBoard(scene, scene.player.board);
    scene.player.bench = (Array.isArray(scene.player.bench) ? scene.player.bench : [])
      .map((unit: unknown) => planningNormalizeOwnedUnit(scene, unit as Parameters<typeof planningNormalizeOwnedUnit>[1]))
      .filter((unit): unit is NonNullable<ReturnType<typeof planningNormalizeOwnedUnit>> => unit !== null);
    scene.player.creativeSandboxUnits = ((Array.isArray(scene.player.creativeSandboxUnits) ? scene.player.creativeSandboxUnits : [])
      .map((unit: unknown) => normalizeCreativeSandboxUnit(unit as unknown as Parameters<typeof normalizeCreativeSandboxUnit>[0], scene.normalizeOwnedUnit as unknown as Parameters<typeof normalizeCreativeSandboxUnit>[1]))
      .filter((unit): unit is NonNullable<ReturnType<typeof normalizeCreativeSandboxUnit>> => unit !== null && unit !== undefined)
      .filter((unit) => Number.isInteger((unit as { row: unknown }).row) && ((unit as { row: number }).row) >= 0 && ((unit as { row: number }).row) < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]))
      .filter((unit) => Number.isInteger((unit as { col: unknown }).col) && ((unit as { col: number }).col) >= 0 && ((unit as { col: number }).col) < COLS)) as unknown as NonNullable<PlayerState["creativeSandboxUnits"]>;
    scene.player.fortressMeta = ensureFortressGraph(scene.player.fortressMeta as unknown as Parameters<typeof ensureFortressGraph>[0], {
      round: scene.player.round
    });

    if (!Array.isArray(scene.player.shop)) scene.player.shop = [];
    scene.player.level = clamp(Number.isFinite(scene.player.level) ? Math.floor(scene.player.level) : 1, 1, 25);
    scene.player.round = Math.max(1, Number.isFinite(scene.player.round) ? Math.floor(scene.player.round) : 1);
    scene.player.hp = Math.max(0, Number.isFinite(scene.player.hp) ? Math.round(scene.player.hp) : 1);
    scene.player.loseCondition = getPlanningConfiguredLoseCondition(
      scene as unknown as Parameters<typeof getPlanningConfiguredLoseCondition>[0],
      scene.player.loseCondition ?? scene.runtimeSettings?.loseCondition ?? DEFAULT_LOSE_CONDITION
    ) as PlayerState["loseCondition"];
    if (scene.player.loseCondition === "NO_HEARTS") {
      if (!Number.isFinite(scene.player.hp) || scene.player.hp <= 0) {
        scene.player.hp = getPlanningConfiguredStartingHp(scene as unknown as Parameters<typeof getPlanningConfiguredStartingHp>[0], 3);
      }
    } else {
      scene.player.hp = Math.max(scene.player.hp, 1);
    }
    scene.player.gold = Math.max(0, Number.isFinite(scene.player.gold) ? Math.floor(scene.player.gold) : 10);
    scene.player.xp = Math.max(0, Number.isFinite(scene.player.xp) ? Math.floor(scene.player.xp) : 0);
    const xpNeed = getXpToLevelUp(scene.player.level);
    if (xpNeed !== Number.POSITIVE_INFINITY) {
      scene.player.xp = Math.min(scene.player.xp, Math.max(0, xpNeed - 1));
    }
    if (!Number.isFinite(scene.player.winStreak)) scene.player.winStreak = 0;
    if (!Number.isFinite(scene.player.loseStreak)) scene.player.loseStreak = 0;
    if (!Number.isFinite(scene.player.deployCapBonus)) scene.player.deployCapBonus = 0;
    if (!Number.isFinite(scene.player.benchBonus)) scene.player.benchBonus = 0;
    if (!Number.isFinite(scene.player.benchUpgradeLevel)) scene.player.benchUpgradeLevel = 0;
    scene.player.benchUpgradeLevel = clamp(Math.floor(scene.player.benchUpgradeLevel), 0, 1);
    scene.benchUpgradeLevel = scene.player.benchUpgradeLevel;
    if (!Number.isFinite(scene.player.interestCapBonus)) scene.player.interestCapBonus = 0;
    if (!Number.isFinite(scene.player.interestRateBonus)) scene.player.interestRateBonus = 0;
    if (!Number.isFinite(scene.player.winGoldBonus)) scene.player.winGoldBonus = 0;
    if (!Number.isFinite(scene.player.xpCostDelta)) scene.player.xpCostDelta = 0;
    if (!Number.isFinite(scene.player.rollCostDelta)) scene.player.rollCostDelta = 0;
    if (!Number.isFinite(scene.player.startingRage)) scene.player.startingRage = 0;
    if (!Number.isFinite(scene.player.startingShield)) scene.player.startingShield = 0;
    if (!Number.isFinite(scene.player.teamAtkPct)) scene.player.teamAtkPct = 0;
    if (!Number.isFinite(scene.player.teamMatkPct)) scene.player.teamMatkPct = 0;
    if (!Number.isFinite(scene.player.teamDefPct)) scene.player.teamDefPct = 0;
    if (!Number.isFinite(scene.player.teamMdefPct)) scene.player.teamMdefPct = 0;
    if (!Number.isFinite(scene.player.teamHpPct)) scene.player.teamHpPct = 0;
    if (!Number.isFinite(scene.player.lifestealPct)) scene.player.lifestealPct = 0;
    if (!Number.isFinite(scene.player.hpLossReduce)) scene.player.hpLossReduce = 0;
    if (!Number.isFinite(scene.player.rageGainPct)) scene.player.rageGainPct = 0;
    if (!Number.isFinite(scene.player.extraClassCount)) scene.player.extraClassCount = 0;
    if (!Number.isFinite(scene.player.extraTribeCount)) scene.player.extraTribeCount = 0;
    if (!Number.isFinite(scene.player.inventoryBonus)) scene.player.inventoryBonus = 0;
    if (!scene.player.augmentBonuses) scene.player.augmentBonuses = {};
    if (!Number.isFinite(scene.player.craftTableLevel)) scene.player.craftTableLevel = 0;
    scene.player.craftTableLevel = clamp(Math.floor(scene.player.craftTableLevel), 0, 3);
    if (typeof scene.player.shopLocked !== "boolean") scene.player.shopLocked = false;
    if (!scene.player.techLevels || typeof scene.player.techLevels !== "object") scene.player.techLevels = {};
    if (!Number.isFinite(scene.player.unequipDiscount)) scene.player.unequipDiscount = 0;
    if (!Number.isFinite(scene.player.fixedIncome)) scene.player.fixedIncome = 0;
    if (!Number.isFinite(scene.player.teamCritPct)) scene.player.teamCritPct = 0;

    if (!Array.isArray(scene.player.itemBag)) scene.player.itemBag = [];
    if (!Array.isArray(scene.player.craftedItems)) scene.player.craftedItems = [];
    if (!Array.isArray(scene.player.enemyPreview)) {
      scene.player.enemyPreview = [];
    } else {
      scene.player.enemyPreview = stampEnemyPreviewEntries(
        scene.player.enemyPreview.filter((entry: unknown): entry is EnemyPreviewEntry => Boolean(entry) && typeof (entry as { baseId?: unknown }).baseId === "string" && Boolean(UNIT_BY_ID[(entry as { baseId: string }).baseId])),
        { rowCount: getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]) }
      );
    }
    if (!Number.isInteger(scene.player.enemyPreviewRound)) scene.player.enemyPreviewRound = 0;
    if (!Number.isFinite(scene.player.enemyBudget)) scene.player.enemyBudget = 0;
    scene.player.tutorialSkipped = scene.player.tutorialSkipped === true;
    if (!scene.player.gameMode) scene.player.gameMode = scene.gameMode;
    if (!Array.isArray(scene.craftGridItems) || scene.craftGridItems.length !== 9) {
      scene.craftGridItems = Array.from({ length: 9 }, (_, idx) => scene.craftGridItems?.[idx] ?? null);
    }
    getPlanningCraftActiveIndices(scene as unknown as Parameters<typeof getPlanningCraftActiveIndices>[0]).forEach((idx: number) => {
      const id = scene.craftGridItems[idx];
      const kind = ITEM_BY_ID[id as string]?.kind;
      if (id && kind !== "base" && kind !== "equipment") scene.craftGridItems[idx] = null;
    });
}

interface OwnedUnitEx {
  uid?: string;
  baseId?: string;
  base?: { id: string; [key: string]: unknown };
  star?: number;
  equips?: unknown;
  [key: string]: unknown;
}

interface PlanningOwnedUnit {
  uid: string;
  baseId: string;
  star: number;
  base: { id: string; [key: string]: unknown };
  equips: string[];
  variantTraits: string[];
  variantSeeds: number[];
  [key: string]: unknown;
}

export function planningNormalizeOwnedUnit(scene: PlanningRunStateEx, raw: OwnedUnitEx | null | undefined): PlanningOwnedUnit | null {
    if (!raw || typeof raw !== "object") return null;
    const baseId = (raw.baseId ?? raw.base?.id) as string | undefined;
    const base = baseId ? UNIT_BY_ID[baseId] : undefined;
    if (!base) return null;
    const starRaw = Number.isFinite(raw.star) ? Math.round(raw.star as number) : 1;
    const traitPayload = normalizeOwnedUnitTraits(raw as unknown as Parameters<typeof normalizeOwnedUnitTraits>[0], base as unknown as Parameters<typeof normalizeOwnedUnitTraits>[1], { rollTrait: false });
    return {
      uid: (raw.uid as string | undefined) ?? createUnitUid(),
      baseId: base.id,
      star: clamp(starRaw, 1, 3),
      base,
      equips: planningNormalizeEquipIds(scene, raw.equips as Parameters<typeof planningNormalizeEquipIds>[1], {
        baseId: base.id,
        base,
        star: clamp(starRaw, 1, 3)
      }),
      variantTraits: (traitPayload as { variantTraits: string[] }).variantTraits,
      variantSeeds: (traitPayload as { variantSeeds: number[] }).variantSeeds
    };
}

export function planningNormalizeBoard(scene: PlanningRunStateEx, rawBoard: unknown): PlanningOwnedUnit[][] {
    const board = BoardSystem.createEmptyBoard();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const r = rawBoard as unknown[][] | undefined;
        const cell = r?.[row]?.[col];
        board[row][col] = planningNormalizeOwnedUnit(scene, cell as OwnedUnitEx | null | undefined) as unknown as Parameters<typeof planningNormalizeOwnedUnit>[0] as unknown as ReturnType<typeof BoardSystem.createEmptyBoard>[number][number];
      }
    }
    return board as unknown as PlanningOwnedUnit[][];
}

export function createPlanningEmptyBoard(_scene: PlanningRunStateEx): PlanningOwnedUnit[][] {
    return BoardSystem.createEmptyBoard() as unknown as PlanningOwnedUnit[][];
}

export function planningSeedStarterUnits(scene: PlanningRunStateEx): void {
    const tierOne = UNIT_CATALOG.filter((u) => u.tier === 1);
    const picks = (sampleWithoutReplacement as <T>(arr: readonly T[], n: number) => T[])(tierOne, 3);
    picks.forEach((base): void => {
      const owned = createPlanningOwnedUnit(scene, String(base.id), 1) as PlanningOwnedUnit | null;
      if (owned) scene.player.bench.push(owned);
    });
}

interface OwnedUnitOptionsLike {
  uid?: string | null;
  [key: string]: unknown;
}

export function createPlanningOwnedUnit(scene: PlanningRunStateEx, baseId: string, star: number = 1, equips: unknown = [], options: OwnedUnitOptionsLike = {}): PlanningOwnedUnit | null {
    return createPersistedOwnedUnit(
      baseId,
      star,
      options?.uid ?? null,
      planningNormalizeEquipIds(scene, equips as Parameters<typeof planningNormalizeEquipIds>[1], { baseId, star }),
      options as unknown as Parameters<typeof createPersistedOwnedUnit>[4]
    ) as unknown as PlanningOwnedUnit | null;
}

export function canPlanningTrackEndlessAchievements(scene: PlanningRunStateEx): boolean {
    return shouldTrackEndlessAchievementsCore({
      gameMode: (scene.player?.gameMode ?? scene.gameMode) as string,
      aiMode: scene.aiMode,
      isCoop: isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])
    });
}

interface EndlessSnapshotOverrides {
  round?: number;
  level?: number;
  gold?: number;
  winStreak?: number;
}

export function getPlanningEndlessAchievementSnapshot(scene: PlanningRunStateEx, overrides: EndlessSnapshotOverrides = {}): { round: number | undefined; level: number | undefined; gold: number | undefined; winStreak: number | undefined } {
    return {
      round: Number.isFinite(overrides.round) ? overrides.round : scene.player?.round,
      level: Number.isFinite(overrides.level) ? overrides.level : scene.player?.level,
      gold: Number.isFinite(overrides.gold) ? overrides.gold : scene.player?.gold,
      winStreak: Number.isFinite(overrides.winStreak) ? overrides.winStreak : scene.player?.winStreak
    };
}

export function planningUpdateEndlessAchievementProfile(scene: PlanningRunStateEx, mutator: ((profile: EndlessProfileLike) => EndlessProfileLike) | null | undefined): EndlessProfileLike | null {
    if (!canPlanningTrackEndlessAchievements(scene)) return scene.endlessAchievementProfile as EndlessProfileLike | null;
    const nextProfile = mutator?.((scene.endlessAchievementProfile ?? loadEndlessAchievementProfile()) as unknown as EndlessProfileLike);
    scene.endlessAchievementProfile = (nextProfile ?? scene.endlessAchievementProfile ?? loadEndlessAchievementProfile()) as unknown as EndlessProfileLike;
    saveEndlessAchievementProfile(scene.endlessAchievementProfile as unknown as Parameters<typeof saveEndlessAchievementProfile>[0]);
    return scene.endlessAchievementProfile as EndlessProfileLike | null;
}

export function syncPlanningEndlessAchievementSnapshot(scene: PlanningRunStateEx, overrides: EndlessSnapshotOverrides = {}): void {
    planningUpdateEndlessAchievementProfile(scene, ((profile: EndlessProfileLike): EndlessProfileLike => noteEndlessProgressSnapshot(profile as unknown as Parameters<typeof noteEndlessProgressSnapshot>[0], getPlanningEndlessAchievementSnapshot(scene, overrides)) as unknown as EndlessProfileLike));
}

export function persistPlanningProgress(scene: PlanningRunStateEx): void {
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      syncPlanningPvpSessionState(scene as unknown as Parameters<typeof syncPlanningPvpSessionState>[0]);
      return;
    }
    if (isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) {
      syncPlanningCoopSessionState(scene as unknown as Parameters<typeof syncPlanningCoopSessionState>[0]);
      persistPlanningActiveCoopSave(scene as unknown as Parameters<typeof persistPlanningActiveCoopSave>[0], exportPlanningRunState(scene));
      return;
    }
    if (!scene.persistEnabled) return;
    saveProgress(exportPlanningRunState(scene));
}

// Stamp enemy preview entries helper imported from core/enemyPreview
function stampEnemyPreviewEntries(entries: EnemyPreviewEntry[], options: { rowCount: number }): EnemyPreviewEntry[] {
  return entries.map((entry) => ({ ...entry }));
}
