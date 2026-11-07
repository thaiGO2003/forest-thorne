import {
  PVP_FORTRESS_SESSION_TYPE,
  PVP_FORTRESS_SNAPSHOT_INTERVAL_MS,
  buildPvpFortressCombatStartPayload,
  clonePvpPlayersForSnapshot,
  isPvpFortressStartPayload,
  normalizePvpFortressState,
  type PvpFortressState
} from "../../network/pvpFortress.js";
import {
  getCoopSession,
  isCoopSessionActive,
  updateCoopSession
} from "../../network/coopSession.js";
import { getCoopPlayerSlots } from "../../core/aiModes.js";
import { isPvpGameMode } from "../../core/gameModeRuntime.js";

import { refreshPlanningHeader } from "./planningRefreshUiRuntime.js";
import { destroyPlanningTutorialOverlay } from "./planningTutorialRuntime.js";

import { getRequiredPlayerCapacityForGameMode } from "../../core/gameModeRuntime.js";
import { hydrateRunState, serializeRunState } from "../../core/runState.js";
import { COOP_MESSAGE_TYPES } from "../../network/coopConfig.js";
import { startManagedScene } from "../../scenes/sceneLazyRouting.js";

interface PvpPlayerLike {
  hp?: number;
  round?: number;
  gameMode?: string;
  [key: string]: unknown;
}

type CoopClientLike = {
  send: (message: { type: string; payload: unknown }) => void;
};

type PlanningPvpSession = Phaser.Scene & {
  coopLocalSlot?: string;
  gameMode: string;
  aiMode: string;
  gameModeConfig?: { startingHP?: number } | null;
  player: PvpPlayerLike;
  audioFx?: { enabled: boolean };
  _pvpSessionSyncTimer: Phaser.Time.TimerEvent | null;
  _pvpCombatReady: boolean;
  _pvpCombatStartRequested: boolean;
  _lastPvpPlanningIntent: string;
  time: Phaser.Time.Clock;
};

function getSessionClient(session: ReturnType<typeof getCoopSession>): CoopClientLike | null {
  if (!session || !session.client) return null;
  return session.client as unknown as CoopClientLike;
}

export function getPlanningSessionLocalSlot(scene: PlanningPvpSession): string {
    return getCoopSession()?.localSlot ?? scene.coopLocalSlot ?? "P1";
}

export function isPlanningSessionHost(scene: PlanningPvpSession): boolean {
    const session = getCoopSession();
    return !!session && (session.hostSlot ?? "P1") === getPlanningSessionLocalSlot(scene);
}

export function getPlanningPvpSessionSlots(scene: PlanningPvpSession): string[] {
    const capacity = getCoopSession()?.playerCapacity
      ?? getRequiredPlayerCapacityForGameMode(scene.gameMode, scene.aiMode)
      ?? 4;
    return getCoopPlayerSlots(capacity >= 4 ? "COOP4_MEDIUM" : "COOP_MEDIUM");
}

export function isPlanningPvpRoomMode(scene: PlanningPvpSession): boolean {
    return isPvpGameMode(scene.player?.gameMode ?? scene.gameMode) && isCoopSessionActive();
}

export function getPlanningPvpState(scene: PlanningPvpSession): PvpFortressState {
    const session = getCoopSession();
    const slots = getPlanningPvpSessionSlots(scene);
    return normalizePvpFortressState(session?.pvpState as unknown as PvpFortressState | null | undefined, {
      slots,
      startingHp: scene.gameModeConfig?.startingHP ?? 100
    });
}

export function stopPlanningPvpSessionSyncTimer(scene: PlanningPvpSession): void {
    if (!scene._pvpSessionSyncTimer) return;
    scene._pvpSessionSyncTimer.remove(false);
    scene._pvpSessionSyncTimer = null;
}

export function startPlanningPvpSessionSyncTimer(scene: PlanningPvpSession): void {
    stopPlanningPvpSessionSyncTimer(scene);
    if (!isPlanningPvpRoomMode(scene) || !scene.time) return;
    scene._pvpSessionSyncTimer = scene.time.addEvent({
      delay: PVP_FORTRESS_SNAPSHOT_INTERVAL_MS,
      loop: true,
      callback: () => {
        syncPlanningPvpSessionState(scene, true, { combatReady: scene._pvpCombatReady });
        if (isPlanningSessionHost(scene)) {
          broadcastPlanningPvpAuthoritativeSnapshot(scene, "interval");
        }
      }
    });
}

export function broadcastPlanningPvpAuthoritativeSnapshot(scene: PlanningPvpSession, reason: string = "manual"): void {
    if (!isPlanningPvpRoomMode(scene) || !isPlanningSessionHost(scene)) return;
    const session = getCoopSession();
    const pvpState = getPlanningPvpState(scene);
    const payload = {
      kind: "pvp_fortress_snapshot",
      reason,
      selectedMode: scene.gameMode,
      players: clonePvpPlayersForSnapshot(session?.players ?? {}, getPlanningPvpSessionSlots(scene)),
      pvpState
    };
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      selectedMode: scene.gameMode,
      pvpState,
      players: payload.players
    });
    const client = getSessionClient(session);
    try {
      client?.send({
        type: COOP_MESSAGE_TYPES.AUTHORITATIVE_SNAPSHOT,
        payload
      });
    } catch (error) {
      console.warn("[PlanningScene] Failed to broadcast pvp authoritative snapshot.", error);
    }
}

interface SyncOverrides {
  combatReady?: boolean;
}

export function syncPlanningPvpSessionState(scene: PlanningPvpSession, force: boolean = false, overrides: SyncOverrides = {}): void {
    if (!isPlanningPvpRoomMode(scene)) return;
    const session = getCoopSession();
    const localSlot = getPlanningSessionLocalSlot(scene);
    const pvpState = getPlanningPvpState(scene);
    const combatReady = overrides.combatReady ?? scene._pvpCombatReady;
    const nextPvpState: PvpFortressState = {
      ...pvpState,
      readyBySlot: {
        ...(pvpState.readyBySlot ?? {}),
        [localSlot]: combatReady
      },
      castleHpBySlot: {
        ...(pvpState.castleHpBySlot ?? {}),
        [localSlot]: Number.isFinite(scene.player?.hp) ? Math.max(0, Math.floor(scene.player.hp as number)) : (pvpState.castleHpBySlot?.[localSlot] ?? 0)
      }
    };
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      aiMode: scene.aiMode,
      selectedMode: scene.gameMode,
      players: {
        [localSlot]: scene.player
      },
      pvpState: nextPvpState
    });

    const payload = {
      kind: "pvp_fortress_planning",
      slot: localSlot,
      combatReady,
      round: scene.player?.round ?? 1,
      player: serializeRunState({
        aiMode: scene.aiMode,
        audioEnabled: scene.audioFx?.enabled !== false,
        player: scene.player
      }).player
    };
    const payloadHash = JSON.stringify(payload);
    if (!force && payloadHash === scene._lastPvpPlanningIntent) return;
    scene._lastPvpPlanningIntent = payloadHash;
    const client = getSessionClient(session);
    try {
      client?.send({
        type: COOP_MESSAGE_TYPES.PLANNING_INTENT,
        payload
      });
    } catch (error) {
      console.warn("[PlanningScene] Failed to sync pvp planning intent.", error);
    }
}

interface PvpPlanningIntentPayload {
  kind?: string;
  slot?: string;
  combatReady?: boolean;
  player?: unknown;
  [key: string]: unknown;
}

export function handlePlanningIncomingPvpPlanningIntent(scene: PlanningPvpSession, payload: unknown): void {
    if (!isPlanningPvpRoomMode(scene)) return;
    const intent = payload as PvpPlanningIntentPayload;
    if (intent?.kind !== "pvp_fortress_planning") return;
    const slot = typeof intent?.slot === "string" ? intent.slot : null;
    if (!slot || slot === getPlanningSessionLocalSlot(scene)) return;
    const remoteState = hydrateRunState({
      aiMode: scene.aiMode,
      audioEnabled: scene.audioFx?.enabled !== false,
      player: intent?.player
    })?.player as PvpPlayerLike | undefined;
    if (!remoteState) return;
    const pvpState = getPlanningPvpState(scene);
    const nextPvpState: PvpFortressState = {
      ...pvpState,
      readyBySlot: {
        ...(pvpState.readyBySlot ?? {}),
        [slot]: intent?.combatReady === true
      },
      castleHpBySlot: {
        ...(pvpState.castleHpBySlot ?? {}),
        [slot]: Number.isFinite(remoteState.hp) ? Math.max(0, Math.floor(remoteState.hp as number)) : (pvpState.castleHpBySlot?.[slot] ?? 0)
      }
    };
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      players: {
        [slot]: remoteState
      },
      pvpState: nextPvpState
    });
    if (isPlanningSessionHost(scene)) {
      maybePlanningStartPvpCombat(scene);
    }
}

interface PvpAuthoritativeSnapshotPayload {
  kind?: string;
  pvpState?: PvpFortressState;
  players?: Record<string, unknown>;
  [key: string]: unknown;
}

export function handlePlanningIncomingPvpAuthoritativeSnapshot(scene: PlanningPvpSession, payload: unknown): void {
    if (!isPlanningPvpRoomMode(scene)) return;
    const snap = payload as PvpAuthoritativeSnapshotPayload;
    if (snap?.kind !== "pvp_fortress_snapshot") return;
    const nextState = normalizePvpFortressState(snap?.pvpState, {
      slots: getPlanningPvpSessionSlots(scene),
      startingHp: scene.gameModeConfig?.startingHP ?? 100
    });
    const players = snap?.players && typeof snap.players === "object"
      ? snap.players
      : {};
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      selectedMode: scene.gameMode,
      players,
      pvpState: nextState
    });
    const localHp = nextState.castleHpBySlot?.[getPlanningSessionLocalSlot(scene)];
    if (Number.isFinite(localHp) && scene.player) {
      scene.player.hp = Math.max(0, Math.floor(localHp as number));
      refreshPlanningHeader(scene as unknown as Parameters<typeof refreshPlanningHeader>[0]);
    }
}

export function maybePlanningStartPvpCombat(scene: PlanningPvpSession): boolean {
    if (!isPlanningPvpRoomMode(scene) || !isPlanningSessionHost(scene) || scene._pvpCombatStartRequested) return false;
    const session = getCoopSession();
    const pvpState = getPlanningPvpState(scene);
    const activeSlots = pvpState.aliveSlots.filter((slot) => session?.players?.[slot]);
    if (activeSlots.length <= 1) return false;
    const everyoneReady = activeSlots.every((slot) => pvpState.readyBySlot?.[slot] === true);
    if (!everyoneReady) return false;
    const startPayload = buildPvpFortressCombatStartPayload({
      players: session?.players ?? {},
      pvpState,
      audioEnabled: scene.audioFx?.enabled !== false,
      aiMode: scene.aiMode
    });
    scene._pvpCombatStartRequested = true;
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      currentCombatPayload: startPayload,
      pvpState: startPayload.pvpState
    });
    const client = getSessionClient(session);
    try {
      client?.send({
        type: COOP_MESSAGE_TYPES.COMBAT_START,
        payload: startPayload
      });
    } catch (error) {
      console.warn("[PlanningScene] Failed to broadcast pvp combat start.", error);
    }
    handlePlanningIncomingPvpCombatStart(scene, startPayload, { force: true });
    return true;
}

interface PvpCombatStartOptions {
  force?: boolean;
}

export function handlePlanningIncomingPvpCombatStart(scene: PlanningPvpSession, payload: unknown, options: PvpCombatStartOptions = {}): void {
    if (!isPlanningPvpRoomMode(scene) || !isPvpFortressStartPayload(payload)) return;
    if (!options.force && scene._pvpCombatStartRequested) return;
    const localSlot = getPlanningSessionLocalSlot(scene);
    const startPayload = payload as { payloadsBySlot?: Record<string, { runState?: unknown; roomCombatMeta?: unknown }>; pvpState?: unknown };
    const localPayload = startPayload?.payloadsBySlot?.[localSlot];
    if (!localPayload?.runState) return;
    scene._pvpCombatStartRequested = true;
    scene._pvpCombatReady = false;
    updateCoopSession({
      sessionType: PVP_FORTRESS_SESSION_TYPE,
      currentCombatPayload: payload,
      pvpState: startPayload?.pvpState
    });
    destroyPlanningTutorialOverlay(scene as unknown as Parameters<typeof destroyPlanningTutorialOverlay>[0]);
    startManagedScene(scene as unknown as Parameters<typeof startManagedScene>[0], "CombatScene", {
      runState: localPayload.runState,
      roomCombatMeta: localPayload.roomCombatMeta
    });
}
