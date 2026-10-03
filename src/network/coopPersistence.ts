// A114: restore player ownership into the live session, and route subsequent saves to that session's active slot.
import { modeConfig } from "../core/modes";
import {
  COOP_SLOTS as SAVE_SLOTS, normalizeCoopRunPayload, persistPlanningProgress, selectCoopSlot,
  type CoopSelectId, type CoopSlot as CoopSaveSlot, type CoopSummary, type PlanningPersistenceResult, type RunPayload,
} from "../core/save";
import type { RunState } from "../core/run";
import type { KV } from "../core/settings";
import { normalizeCoopSlot } from "./coopConfig";
import { createCoopSession, CoopSessionStore, type CoopSessionPatch } from "./coopSession";

function runMirrorPatch(payload: RunPayload, activeSlot: CoopSaveSlot): CoopSessionPatch {
  return {
    roomCode: payload.roomCode,
    localSlot: normalizeCoopSlot(payload.localSlot),
    hostSlot: normalizeCoopSlot(payload.hostSlot),
    playerCapacity: payload.playerCapacity,
    aiMode: payload.aiMode,
    selectedMode: payload.selectedMode,
    activeSaveSlotId: activeSlot,
    resumeState: payload,
  };
}

export type CoopRestoreResult =
  | { kind: "new"; activeSlot: CoopSaveSlot }
  | { kind: "restored"; activeSlot: CoopSaveSlot; payload: RunPayload; localPlayer: RunState; summary: CoopSummary };

/** Continue enters the room/session flow first. Missing slots stay a New Game selection without altering the live session. */
export function restoreCoopProgress(store: KV, id: CoopSelectId, sessions: CoopSessionStore): CoopRestoreResult {
  const selection = selectCoopSlot(store, id);
  if (selection.mode === "new") return { kind: "new", activeSlot: selection.activeSlot };
  const payload = normalizeCoopRunPayload(structuredClone(selection.payload));
  // Saved ready flags/replay buffers belong to the old connection/combat and cannot be reused after Continue.
  const readyBySlot = Object.fromEntries(Object.keys(payload.players!).map((slot) => [slot, false]));
  sessions.set(createCoopSession({
    ...runMirrorPatch(payload, selection.activeSlot),
    saveMode: "resume",
    resumeSummary: selection.summary,
    readyBySlot,
    currentCombatPayload: null,
    coopCombatSnapshot: null,
    coopCombatDelta: null,
    coopCombatHeartbeat: null,
    combatSnapshotsBySlot: {},
  }));
  return {
    kind: "restored", activeSlot: selection.activeSlot, payload,
    localPlayer: payload.players![payload.localSlot!]!, summary: selection.summary,
  };
}

/** Use the session's active slot and identity. A room authoritative for PvP must never fall through to a co-op/solo save. */
export function persistCoopPlanningProgress(
  store: KV, payload: RunPayload, sessions: CoopSessionStore,
): PlanningPersistenceResult {
  const session = sessions.get();
  if (!session || session.sessionType === "pvp_fortress") return "failed";
  if (!(SAVE_SLOTS as readonly string[]).includes(session.activeSaveSlotId)) return "failed";
  if (!payload.players || Object.keys(payload.players).length === 0) return "failed";
  if (!payload.players[session.localSlot]) return "failed";
  const activeSlot = session.activeSaveSlotId as CoopSaveSlot;
  const normalized = normalizeCoopRunPayload(structuredClone({
    ...payload,
    roomCode: session.roomCode,
    localSlot: session.localSlot,
    hostSlot: session.hostSlot,
    aiMode: session.aiMode,
    selectedMode: session.selectedMode,
  }));
  // Normalization may repair metadata, but must not silently switch the active player's ownership.
  if (normalized.localSlot !== session.localSlot || normalized.hostSlot !== session.hostSlot) return "failed";
  if (modeConfig(normalized.players![normalized.localSlot!]!.mode).pvp) return "failed";
  return persistPlanningProgress({
    authority: "coop", store, payload: normalized, activeSlot,
    syncCoop: (snapshot) => { sessions.update(runMirrorPatch(snapshot, activeSlot)); },
  });
}
