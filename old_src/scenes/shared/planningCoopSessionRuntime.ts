import { ROWS } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import { getDeployCapByLevel } from "../../core/gameUtils.js";
import { slotIndexToKey } from "../../network/coopConfig.js";
import {
  getCoopBoardProfileId,
  getCoopPlayerSlots,
  isCoopAiMode,
  normalizeAiMode
} from "../../core/aiModes.js";
import {
  getCoopRemoteSlot,
  getCoopRemoteSlots,
  mapLocalRowToVisualRow,
  mapVisualRowToLocalRow
} from "../../core/coopBoardState.js";
import {
  getBoardProfile,
  getPlayerSlotForRow,
  isRowOwnedByPlayer
} from "../../core/boardProfiles.js";
import { COOP_MESSAGE_TYPES } from "../../network/coopConfig.js";
import {
  clearCoopSession,
  getCoopSession,
  isCoopSessionActive,
  updateCoopSession,
  type CoopSessionInput
} from "../../network/coopSession.js";
import { saveCoopSaveSlot, clearCoopSaveSlot } from "../../core/coopSaveSlots.js";
import { isPvpGameMode } from "../../core/gameModeRuntime.js";

import { addPlanningLog } from "./planningLogRuntime.js";
import { broadcastPlanningPvpAuthoritativeSnapshot, handlePlanningIncomingPvpAuthoritativeSnapshot, handlePlanningIncomingPvpCombatStart, handlePlanningIncomingPvpPlanningIntent, isPlanningPvpRoomMode, isPlanningSessionHost, maybePlanningStartPvpCombat, startPlanningPvpSessionSyncTimer, stopPlanningPvpSessionSyncTimer, syncPlanningPvpSessionState } from "./planningPvpSessionRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { exportPlanningRunState } from "./planningRunStateRuntime.js";
import { togglePlanningHistoryModal, togglePlanningSettingsOverlay } from "./planningSettingsRuntime.js";
import { getPlanningActiveLeftUnitCount, getPlanningDeployCap } from "./planningShopActionsRuntime.js";
import { destroyPlanningTutorialOverlay } from "./planningTutorialRuntime.js";

import { stampEnemyPreviewEntries } from "../../core/enemyPreview.js";
import { hydrateRunState, serializeRunState, type CoopRunState, type PlayerState } from "../../core/runState.js";
import { startManagedScene } from "../../scenes/sceneLazyRouting.js";


type UnknownRecord = Record<string, unknown>;
type CoopSessionPatch = CoopSessionInput & { shared?: unknown };

interface CoopClientLike {
  on(type: string, listener: (payload: UnknownRecord) => void): () => void;
  send(message: UnknownRecord): void;
  close(code?: number, reason?: string): void;
}

interface PlanningIncomingData {
  aiMode?: unknown;
  coopSession?: boolean;
  mode?: unknown;
  restoredState?: {
    aiMode?: unknown;
    coopDifficulty?: unknown;
    player?: { gameMode?: unknown };
    players?: unknown;
  };
}

interface PlanningCoopSceneLike extends Phaser.Scene {
  phase: string;
  player: PlayerState;
  gameMode: string;
  aiMode: string;
  gameModeConfig?: { id?: string; startingHP?: number } | null;
  incomingData?: PlanningIncomingData;
  runtimeSettings?: { aiMode?: unknown };
  coopRunState?: CoopRunState | null;
  coopLocalSlot?: string;
  audioFx?: { enabled?: boolean };
  _coopClientUnsubscribeFns?: Array<() => void>;
  _coopCombatStartRequested?: boolean;
  _coopPlanningPingBySlot?: Record<string, number>;
  _lastCoopPlanningIntent?: string;
  _coopDisconnectHandled?: boolean;
  _coopDisconnectReason?: string;
  _pvpCombatReady?: unknown;
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getCoopClient(): CoopClientLike | null {
  const client = getCoopSession()?.client;
  if (!isUnknownRecord(client)) return null;
  if (typeof client.on !== "function" || typeof client.send !== "function" || typeof client.close !== "function") return null;
  return client as unknown as CoopClientLike;
}

function getPlayerState(value: unknown): PlayerState | null {
  return isUnknownRecord(value) ? value as PlayerState : null;
}

function cloneUnknownRecord(value: unknown): UnknownRecord {
  return isUnknownRecord(value) ? { ...value } : {};
}


function countBoardUnits(board: unknown): number {
  if (!Array.isArray(board)) return 0;
  let total = 0;
  for (let row = 0; row < board.length; row += 1) {
    const cols = board[row];
    if (!Array.isArray(cols)) continue;
    for (let col = 0; col < cols.length; col += 1) {
      if (cols[col]) total += 1;
    }
  }
  return total;
}

export function isPlanningCoopMode(scene: PlanningCoopSceneLike): boolean {
    const modeId = scene.player?.gameMode
      ?? scene.incomingData?.restoredState?.player?.gameMode
      ?? scene.incomingData?.mode
      ?? scene.gameMode;
    if (isPvpGameMode(modeId)) return false;
    if (scene.coopRunState?.players) return true;
    const requestedAiModeValue = scene.incomingData?.aiMode
      ?? scene.incomingData?.restoredState?.coopDifficulty
      ?? scene.incomingData?.restoredState?.aiMode
      ?? scene.runtimeSettings?.aiMode
      ?? scene.aiMode;
    const requestedAiMode = normalizeAiMode(
      typeof requestedAiModeValue === "string" ? requestedAiModeValue : "EASY",
      "EASY"
    );
    return scene.incomingData?.coopSession === true
      || !!scene.incomingData?.restoredState?.players
      || (isCoopSessionActive() && isCoopAiMode(requestedAiMode));
}

export function getPlanningCoopLocalSlot(scene: PlanningCoopSceneLike): string {
    const sessionSlot = getCoopSession()?.localSlot;
    const resolved = scene.coopLocalSlot ?? sessionSlot ?? "P1";
    return getCoopPlayerSlots(scene.aiMode).includes(resolved) ? resolved : "P1";
}

export function getPlanningCoopRemoteSlot(scene: PlanningCoopSceneLike) {
    return getCoopRemoteSlot(getPlanningCoopLocalSlot(scene), {
      aiMode: scene.aiMode,
      boardProfile: getPlanningBoardProfileId(scene)
    });
}

export function getPlanningCoopRemoteSlots(scene: PlanningCoopSceneLike) {
    return getCoopRemoteSlots(getPlanningCoopLocalSlot(scene), {
      aiMode: scene.aiMode,
      boardProfile: getPlanningBoardProfileId(scene)
    });
}

export function isPlanningCoopHost(scene: PlanningCoopSceneLike): boolean {
    return isPlanningCoopMode(scene) && (scene.coopRunState?.hostSlot ?? "P1") === getPlanningCoopLocalSlot(scene);
}

export function getPlanningBoardProfileId(scene: PlanningCoopSceneLike): string {
    if (!isPlanningCoopMode(scene)) return "solo";
    return getCoopBoardProfileId(
      normalizeAiMode(
        scene.coopRunState?.coopDifficulty
          ?? scene.coopRunState?.aiMode
          ?? scene.aiMode
          ?? scene.incomingData?.aiMode,
        "COOP_MEDIUM"
      )
    );
}

export function getPlanningBoardRowCount(scene: PlanningCoopSceneLike): number {
    return getBoardProfile(getPlanningBoardProfileId(scene)).rows;
}

export function isPlanningOwnedPlanningRow(scene: PlanningCoopSceneLike, row: number): boolean {
    if (!isPlanningCoopMode(scene)) return Number.isInteger(row) && row >= 0 && row < ROWS;
    return isRowOwnedByPlayer(getPlanningBoardProfileId(scene), row, getPlanningCoopLocalSlot(scene));
}

export function mapPlanningLocalBoardRowToVisualRow(scene: PlanningCoopSceneLike, localRow: number, slot: string = getPlanningCoopLocalSlot(scene)) {
    if (!isPlanningCoopMode(scene)) return localRow;
    return mapLocalRowToVisualRow(localRow, slot, getPlanningBoardProfileId(scene));
}

export function mapPlanningVisualBoardRowToLocalRow(scene: PlanningCoopSceneLike, visualRow: number, slot: string = getPlanningCoopLocalSlot(scene)) {
    if (!isPlanningCoopMode(scene)) return visualRow;
    return mapVisualRowToLocalRow(visualRow, slot, getPlanningBoardProfileId(scene));
}

export function getPlanningCoopPlayerState(scene: PlanningCoopSceneLike, slot: string): PlayerState | null {
    if (!isPlanningCoopMode(scene)) return scene.player;
    return getPlayerState(scene.coopRunState?.players?.[slot] ?? getCoopSession()?.players?.[slot]);
}

export function getPlanningBoardOwnerSlot(scene: PlanningCoopSceneLike, visualRow: number): string {
    if (!isPlanningCoopMode(scene)) return getPlanningCoopLocalSlot(scene);
    return getPlayerSlotForRow(getPlanningBoardProfileId(scene), visualRow, getPlanningCoopLocalSlot(scene));
}

export function getPlanningBoardUnit(scene: PlanningCoopSceneLike, visualRow: number, col: number, { ownedOnly = false }: { ownedOnly?: boolean } = {}) {
    if (!Number.isInteger(visualRow) || !Number.isInteger(col)) return null;
    if (!isPlanningCoopMode(scene)) return scene.player?.board?.[visualRow]?.[col] ?? null;
    const slot = getPlanningBoardOwnerSlot(scene, visualRow);
    if (ownedOnly && slot !== getPlanningCoopLocalSlot(scene)) return null;
    const localRow = mapPlanningVisualBoardRowToLocalRow(scene, visualRow, slot);
    if (localRow == null) return null;
    return getPlanningCoopPlayerState(scene, slot)?.board?.[localRow]?.[col] ?? null;
}

export function getPlanningCoopTotalDeployCount(scene: PlanningCoopSceneLike): number {
    if (!isPlanningCoopMode(scene)) return getPlanningActiveLeftUnitCount(scene as unknown as Parameters<typeof getPlanningActiveLeftUnitCount>[0]);
    return getCoopPlayerSlots(scene.aiMode)
      .reduce((total, slot) => total + countBoardUnits(getPlanningCoopPlayerState(scene, slot)?.board), 0);
}

export function getPlanningCoopConnectedPlayerSlots(scene: PlanningCoopSceneLike): string[] {
    if (!isPlanningCoopMode(scene)) return [getPlanningCoopLocalSlot(scene)];
    const allowedSlots = getCoopPlayerSlots(scene.aiMode);
    const session = getCoopSession();
    const roomPlayers = Array.isArray(session?.roomPlayers) ? session.roomPlayers : [];
    const connectedSlots = roomPlayers
      .map((player: UnknownRecord) => {
        const slotIndex = player.slotIndex;
        if (!Number.isInteger(slotIndex)) return null;
        const slot = slotIndexToKey(slotIndex as number);
        return allowedSlots.includes(slot) ? slot : null;
      })
      .filter((slot, index, slots): slot is string => typeof slot === "string" && slots.indexOf(slot) === index);
    if (connectedSlots.length > 0) return connectedSlots;
    const localSlot = getPlanningCoopLocalSlot(scene);
    return allowedSlots.includes(localSlot) ? [localSlot] : [allowedSlots[0] ?? "P1"];
}

export function getPlanningCoopSlotsMissingDeployment(scene: PlanningCoopSceneLike): string[] {
    if (!isPlanningCoopMode(scene)) return [];
    const connectedSlots = getPlanningCoopConnectedPlayerSlots(scene);
    const resolvePlayerState = (slot: string) => getPlanningCoopPlayerState(scene, slot);
    return connectedSlots
      .filter((slot: string) => countBoardUnits(resolvePlayerState(slot)?.board) <= 0);
}

export function getPlanningCoopTotalDeployCap(scene: PlanningCoopSceneLike): number {
    if (!isPlanningCoopMode(scene)) return getPlanningDeployCap(scene as unknown as Parameters<typeof getPlanningDeployCap>[0]);
    const capFor = (player: unknown) => {
      const state = getPlayerState(player);
      const level = state && Number.isFinite(state.level) ? Math.floor(state.level) : 1;
      const bonus = state && Number.isFinite(state.deployCapBonus) ? Math.floor(state.deployCapBonus) : 0;
      return getDeployCapByLevel(level) + bonus;
    };
    return getCoopPlayerSlots(scene.aiMode)
      .reduce((total, slot) => total + capFor(getPlanningCoopPlayerState(scene, slot)), 0);
}

export function cleanupPlanningCoopBindings(scene: PlanningCoopSceneLike): void {
    stopPlanningPvpSessionSyncTimer(scene as unknown as Parameters<typeof stopPlanningPvpSessionSyncTimer>[0]);
    if (!Array.isArray(scene._coopClientUnsubscribeFns)) {
      scene._coopClientUnsubscribeFns = [];
      return;
    }
    scene._coopClientUnsubscribeFns.forEach((unsubscribe: () => void) => unsubscribe?.());
    scene._coopClientUnsubscribeFns = [];
}

export function bindPlanningCoopSessionTransport(scene: PlanningCoopSceneLike): void {
    cleanupPlanningCoopBindings(scene);
    if (!isPlanningCoopMode(scene) && !isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) return;
    const client = getCoopClient();
    if (!client) return;
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])) {
      scene._coopClientUnsubscribeFns = [
        client.on(COOP_MESSAGE_TYPES.ROOM_STATE, (payload: Record<string, unknown>) => handlePlanningIncomingRoomState(scene, payload)),
        client.on(COOP_MESSAGE_TYPES.PLANNING_INTENT, (payload: Record<string, unknown>) => handlePlanningIncomingPvpPlanningIntent(scene as unknown as Parameters<typeof handlePlanningIncomingPvpPlanningIntent>[0], payload)),
        client.on(COOP_MESSAGE_TYPES.AUTHORITATIVE_SNAPSHOT, (payload: Record<string, unknown>) => handlePlanningIncomingPvpAuthoritativeSnapshot(scene as unknown as Parameters<typeof handlePlanningIncomingPvpAuthoritativeSnapshot>[0], payload)),
        client.on(COOP_MESSAGE_TYPES.COMBAT_START, (payload: Record<string, unknown>) => handlePlanningIncomingPvpCombatStart(scene as unknown as Parameters<typeof handlePlanningIncomingPvpCombatStart>[0], payload)),
        client.on(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, () => {
          addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.playerLeft"));
        })
      ];
      startPlanningPvpSessionSyncTimer(scene as unknown as Parameters<typeof startPlanningPvpSessionSyncTimer>[0]);
      syncPlanningPvpSessionState(scene as unknown as Parameters<typeof syncPlanningPvpSessionState>[0], true, { combatReady: scene._pvpCombatReady === true });
      if (isPlanningSessionHost(scene as unknown as Parameters<typeof isPlanningSessionHost>[0])) {
        broadcastPlanningPvpAuthoritativeSnapshot(scene as unknown as Parameters<typeof broadcastPlanningPvpAuthoritativeSnapshot>[0], "bind");
      }
      return;
    }
    scene._coopClientUnsubscribeFns = [
      client.on(COOP_MESSAGE_TYPES.ROOM_STATE, (payload: Record<string, unknown>) => handlePlanningIncomingRoomState(scene, payload)),
      client.on(COOP_MESSAGE_TYPES.PLANNING_INTENT, (payload: Record<string, unknown>) => handlePlanningIncomingCoopPlanningIntent(scene, payload)),
      client.on(COOP_MESSAGE_TYPES.PLANNING_READY_PING, (payload: Record<string, unknown>) => handlePlanningIncomingCoopPlanningReadyPing(scene, payload)),
      client.on(COOP_MESSAGE_TYPES.COMBAT_START, (payload: Record<string, unknown>) => handlePlanningIncomingCoopCombatStart(scene, payload)),
      client.on(COOP_MESSAGE_TYPES.PLAYER_DISCONNECTED, () => {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.teammateDisconnected"));
        handlePlanningCoopSessionDisconnected(scene, "player_disconnected");
      }),
      client.on("close", () => {
        handlePlanningCoopSessionDisconnected(scene, "socket_close");
      }),
      client.on("error", () => {
        handlePlanningCoopSessionDisconnected(scene, "socket_error");
      })
    ];
}

export function handlePlanningIncomingRoomState(scene: PlanningCoopSceneLike, payload: unknown): void {
    if (!isUnknownRecord(payload)) return;
    const hostSlotIndex = payload.hostSlotIndex;
    const hostSlot = Number.isInteger(hostSlotIndex) ? `P${(hostSlotIndex as number) + 1}` : null;
    const patch: CoopSessionInput = {
      roomCode: typeof payload.roomCode === "string" ? payload.roomCode : getCoopSession()?.roomCode ?? "",
      roomPlayers: Array.isArray(payload.players) ? payload.players : undefined
    };
    if (hostSlot) patch.hostSlot = hostSlot;
    if (typeof payload.selectedMode === "string" && payload.selectedMode) patch.selectedMode = payload.selectedMode;
    if (typeof payload.aiMode === "string" && payload.aiMode) patch.aiMode = payload.aiMode;
    if (typeof payload.saveSlotId === "string" && payload.saveSlotId) patch.activeSaveSlotId = payload.saveSlotId;
    if (typeof payload.saveMode === "string" && payload.saveMode) patch.saveMode = payload.saveMode;
    if (payload.resumeSummary === null) patch.resumeSummary = null;
    if (payload.resumeSummary && typeof payload.resumeSummary === "object") patch.resumeSummary = payload.resumeSummary;
    updateCoopSession(patch);
    if (isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0]) && isPlanningSessionHost(scene as unknown as Parameters<typeof isPlanningSessionHost>[0])) {
      maybePlanningStartPvpCombat(scene as unknown as Parameters<typeof maybePlanningStartPvpCombat>[0]);
    }
}

export function handlePlanningIncomingCoopPlanningIntent(scene: PlanningCoopSceneLike, payload: unknown): void {
    if (!isPlanningCoopMode(scene) || !isUnknownRecord(payload)) return;
    const allowedSlots = getCoopPlayerSlots(scene.aiMode);
    const slot = typeof payload.slot === "string" && allowedSlots.includes(payload.slot)
      ? payload.slot
      : null;
    if (!slot) return;
    if (slot === getPlanningCoopLocalSlot(scene)) return;
    const remoteState = hydrateRunState({
      aiMode: scene.aiMode,
      audioEnabled: scene.audioFx?.enabled !== false,
      player: payload.player
    })?.player;
    if (!remoteState) return;
    if (scene.coopRunState?.players) {
      scene.coopRunState.players[slot] = remoteState;
    }
    if (isUnknownRecord(payload.shared) && scene.coopRunState?.shared) {
      scene.coopRunState.shared = {
        ...scene.coopRunState.shared,
        ...payload.shared
      };
      if (!isPlanningCoopHost(scene) && Array.isArray(payload.shared.enemyPreview)) {
        scene.player.enemyPreview = stampEnemyPreviewEntries(payload.shared.enemyPreview, {
          rowCount: getPlanningBoardRowCount(scene)
        });
        scene.player.enemyPreviewRound = scene.player.round;
      }
    }
    updateCoopSession({
      players: {
        [slot]: remoteState
      },
      shared: scene.coopRunState?.shared
    } as CoopSessionPatch);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
}

export function handlePlanningIncomingCoopCombatStart(scene: PlanningCoopSceneLike, payload: unknown): void {
    if (!isPlanningCoopMode(scene) || scene._coopCombatStartRequested || !isUnknownRecord(payload)) return;
    const hydrated = hydrateRunState(payload.runState);
    if (!hydrated?.players) return;
    const session = getCoopSession();
    hydrated.localSlot = session?.localSlot ?? hydrated.localSlot;
    hydrated.hostSlot = session?.hostSlot ?? hydrated.hostSlot;
    updateCoopSession({
      roomCode: hydrated.roomCode,
      localSlot: hydrated.localSlot,
      hostSlot: hydrated.hostSlot,
      aiMode: hydrated.coopDifficulty ?? hydrated.aiMode,
      players: hydrated.players,
      shared: hydrated.shared
    } as CoopSessionPatch);
    scene._coopCombatStartRequested = true;
    startManagedScene(scene, "CombatScene", {
      runState: hydrated
    });
}

export function notePlanningCoopPlanningPing(scene: PlanningCoopSceneLike, slot: string, round: number = scene.player.round): void {
    if (!scene._coopPlanningPingBySlot || typeof scene._coopPlanningPingBySlot !== "object") {
      scene._coopPlanningPingBySlot = {};
    }
    scene._coopPlanningPingBySlot[slot] = Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
}

export function hasPlanningPingedCoopHostForCurrentRound(scene: PlanningCoopSceneLike): boolean {
    if (!isPlanningCoopMode(scene) || isPlanningCoopHost(scene)) return false;
    const localSlot = getPlanningCoopLocalSlot(scene);
    const round = Number.isFinite(scene.player?.round) ? Math.max(1, Math.floor(scene.player.round)) : 1;
    return scene._coopPlanningPingBySlot?.[localSlot] === round;
}

export function handlePlanningIncomingCoopPlanningReadyPing(scene: PlanningCoopSceneLike, payload: unknown): void {
    if (!isPlanningCoopMode(scene) || !isPlanningCoopHost(scene) || !isUnknownRecord(payload)) return;
    const allowedSlots = getCoopPlayerSlots(scene.aiMode);
    const slot = typeof payload.slot === "string" && allowedSlots.includes(payload.slot)
      ? payload.slot
      : (typeof payload.sourceSlot === "string" && allowedSlots.includes(payload.sourceSlot) ? payload.sourceSlot : null);
    if (!slot || slot === getPlanningCoopLocalSlot(scene)) return;
    const round = typeof payload.round === "number" && Number.isFinite(payload.round) ? Math.max(1, Math.floor(payload.round)) : Math.max(1, Math.floor(scene.player?.round ?? 1));
    if (scene._coopPlanningPingBySlot?.[slot] === round) return;
    notePlanningCoopPlanningPing(scene, slot, round);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.slotReadyRound", { slot, round }));
}

export function syncPlanningCoopSessionState(scene: PlanningCoopSceneLike, force = false): void {
    if (!isPlanningCoopMode(scene)) return;
    const localSlot = getPlanningCoopLocalSlot(scene);
    if (scene.coopRunState?.players) {
      scene.coopRunState.players[localSlot] = scene.player;
    }
    if (scene.coopRunState?.shared) {
      scene.coopRunState.shared = {
        ...scene.coopRunState.shared,
        round: scene.player.round,
        phase: scene.phase
      };
      if (isPlanningCoopHost(scene) && Array.isArray(scene.player.enemyPreview)) {
        scene.coopRunState.shared.enemyPreview = scene.player.enemyPreview.map(cloneUnknownRecord);
      }
    }

    updateCoopSession({
      roomCode: scene.coopRunState?.roomCode ?? getCoopSession()?.roomCode ?? "",
      localSlot,
      hostSlot: scene.coopRunState?.hostSlot ?? getCoopSession()?.hostSlot ?? "P1",
      aiMode: scene.aiMode,
      selectedMode: scene.gameMode,
      players: {
        [localSlot]: scene.player
      },
      shared: scene.coopRunState?.shared
    } as CoopSessionPatch);

    const client = getCoopClient();
    if (!client) return;
    const payload = {
      slot: localSlot,
      player: serializeRunState({
        aiMode: scene.aiMode,
        audioEnabled: scene.audioFx?.enabled !== false,
        player: scene.player
      }).player,
      shared: isPlanningCoopHost(scene)
        ? {
            round: scene.coopRunState?.shared?.round ?? scene.player.round,
            phase: scene.phase,
            enemyPreview: Array.isArray(scene.coopRunState?.shared?.enemyPreview)
              ? scene.coopRunState.shared.enemyPreview.map(cloneUnknownRecord)
              : []
          }
        : {
            round: scene.coopRunState?.shared?.round ?? scene.player.round,
            phase: scene.phase
          }
    };
    const payloadHash = JSON.stringify(payload);
    if (!force && payloadHash === scene._lastCoopPlanningIntent) return;
    scene._lastCoopPlanningIntent = payloadHash;
    try {
      client.send({
        type: COOP_MESSAGE_TYPES.PLANNING_INTENT,
        payload
      });
    } catch (error) {
      console.warn("[PlanningScene] Failed to sync coop planning intent.", error);
    }
}

export function getPlanningCoopMainMenuData(scene: PlanningCoopSceneLike) {
    return {
      openStartPanel: true,
      selectedMode: getCoopSession()?.selectedMode ?? scene.gameMode
    };
}

export function persistPlanningActiveCoopSave(scene: PlanningCoopSceneLike, runState: unknown = exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0])) {
    if (!isPlanningCoopMode(scene)) return null;
    const session = getCoopSession();
    const slotId = typeof session?.activeSaveSlotId === "string" ? session.activeSaveSlotId : null;
    if (!slotId || !runState) return null;
    const saved = saveCoopSaveSlot(slotId, runState);
    if (!saved) return null;
    updateCoopSession({
      activeSaveSlotId: slotId,
      saveMode: typeof session?.saveMode === "string" ? session.saveMode : "new",
      resumeSummary: saved.summary,
      resumeState: saved.payload
    });
    return saved;
}

export function clearPlanningActiveCoopSave(scene: PlanningCoopSceneLike): boolean {
    if (!isPlanningCoopMode(scene)) return false;
    const session = getCoopSession();
    const slotId = typeof session?.activeSaveSlotId === "string" ? session.activeSaveSlotId : null;
    if (!slotId) return false;
    const cleared = clearCoopSaveSlot(slotId);
    updateCoopSession({
      activeSaveSlotId: slotId,
      resumeSummary: null,
      resumeState: null
    });
    return cleared;
}

export function handlePlanningCoopSessionDisconnected(scene: PlanningCoopSceneLike, reason = "disconnect"): void {
    if (!isPlanningCoopMode(scene) || scene._coopDisconnectHandled) return;
    scene._coopDisconnectHandled = true;
    scene._coopDisconnectReason = reason;
    persistPlanningActiveCoopSave(scene, exportPlanningRunState(scene as unknown as Parameters<typeof exportPlanningRunState>[0]));
    togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false);
    togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false);
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    cleanupPlanningCoopBindings(scene);
    try {
      getCoopClient()?.close(1000, "Coop session disconnected");
    } catch (_error) {
      // Best-effort close only; the local slot save is already written.
    }
    clearCoopSession();
    scene.scene.start("MainMenuScene", getPlanningCoopMainMenuData(scene));
}

