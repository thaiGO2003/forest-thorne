import { BOARD_SIZE, benchToBench, benchToBoard, boardToBench, boardToBoard, sell, type OwnedUnit } from "../core/run";
import {
  COOP_SLOTS as COOP_SAVE_SLOTS,
  coopSummary,
  createEnvelope,
  migrate,
  saveCoopSlot,
  selectCoopSlot,
  type CoopEntry,
  type CoopSlot as CoopSaveSlot,
  type RunPayload,
} from "../core/save";
import { resolveEnemyPreview, type EnemyPreviewResult } from "../core/preview";
import type { KV } from "../core/settings";
import { localRowToSharedRow, sharedRowToLocalRow, type Profile } from "../board/geometry";
import {
  coopSlotIndex,
  coopSlotsForCapacity,
  type CoopSlot,
} from "./coopConfig";
import {
  CoopSessionStore,
  coopSessionStore,
  type CoopSessionState,
} from "./coopSession";

export type CoopPlanningLocation =
  | { where: "bench"; index: number }
  | { where: "board"; sharedRow: number; col: number };

export type CoopPlanningIntent =
  | { kind: "move"; from: CoopPlanningLocation; to: CoopPlanningLocation; allowSwap?: boolean }
  | { kind: "replace"; from: CoopPlanningLocation; to: CoopPlanningLocation }
  | { kind: "sell"; from: CoopPlanningLocation };

export type CoopPlanningRejectReason =
  | "no_session"
  | "unsupported_capacity"
  | "missing_payload"
  | "missing_player"
  | "invalid_intent"
  | "remote_cell"
  | "mutation_rejected"
  | "invalid_save_slot"
  | "not_host"
  | "sender_not_connected"
  | "duplicate_local_replica";

export type CoopPlanningMutationResult =
  | { applied: true; actorSlot: CoopSlot; payload: RunPayload; entry: CoopEntry }
  | { applied: false; actorSlot: CoopSlot | null; reason: CoopPlanningRejectReason };

export interface SharedCoopBoardPlacement {
  slot: CoopSlot;
  localRow: number;
  sharedRow: number;
  col: number;
  unit: OwnedUnit;
}

type ResolvedLocation = { where: "bench" | "board"; index: number };


const finiteIndex = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

function profileForSession(session: Pick<CoopSessionState, "playerCapacity">): Profile | null {
  if (session.playerCapacity === 2) return "coop2";
  if (session.playerCapacity === 4) return "coop4";
  return null;
}

function isAllowedSlot(session: Pick<CoopSessionState, "playerCapacity">, slot: CoopSlot): boolean {
  return coopSlotsForCapacity(session.playerCapacity).includes(slot);
}

function normalizeLocation(value: unknown): CoopPlanningLocation | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { where?: unknown; index?: unknown; sharedRow?: unknown; col?: unknown };
  if (raw.where === "bench") {
    const index = finiteIndex(raw.index);
    return index === null ? null : { where: "bench", index };
  }
  if (raw.where === "board") {
    const sharedRow = finiteIndex(raw.sharedRow);
    const col = finiteIndex(raw.col);
    if (sharedRow === null || col === null || col >= BOARD_SIZE) return null;
    return { where: "board", sharedRow, col };
  }
  return null;
}

export function normalizeCoopPlanningIntent(value: unknown): CoopPlanningIntent | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { kind?: unknown; from?: unknown; to?: unknown; allowSwap?: unknown };
  const from = normalizeLocation(raw.from);
  if (!from) return null;
  if (raw.kind === "sell") return { kind: "sell", from };
  if (raw.kind !== "move" && raw.kind !== "replace") return null;
  const to = normalizeLocation(raw.to);
  if (!to) return null;
  if (raw.kind === "replace") return { kind: "replace", from, to };
  return { kind: "move", from, to, allowSwap: raw.allowSwap !== false };
}

export function sharedBoardLocationToLocalIndex(
  session: Pick<CoopSessionState, "playerCapacity">,
  actorSlot: CoopSlot,
  location: CoopPlanningLocation,
): ResolvedLocation | null {
  if (location.where === "bench") return { where: "bench", index: location.index };
  const profile = profileForSession(session);
  if (!profile || !isAllowedSlot(session, actorSlot)) return null;
  const localRow = sharedRowToLocalRow(coopSlotIndex(actorSlot), location.sharedRow, profile);
  if (localRow === null) return null;
  return { where: "board", index: localRow * BOARD_SIZE + location.col };
}

export function composeCoopSharedBoard(
  payload: RunPayload,
  session: Pick<CoopSessionState, "playerCapacity">,
): SharedCoopBoardPlacement[] {
  const profile = profileForSession(session);
  if (!profile) return [];
  const out: SharedCoopBoardPlacement[] = [];
  for (const slot of coopSlotsForCapacity(session.playerCapacity)) {
    const player = payload.players?.[slot];
    if (!player) continue;
    const slotIndex = coopSlotIndex(slot);
    for (let index = 0; index < player.board.length; index++) {
      const unit = player.board[index];
      if (!unit) continue;
      const localRow = Math.floor(index / BOARD_SIZE);
      const col = index % BOARD_SIZE;
      if (localRow >= BOARD_SIZE) continue;
      const sharedRow = localRowToSharedRow(slotIndex, localRow, profile);
      if (sharedRow === null) continue;
      out.push({ slot, localRow, sharedRow, col, unit });
    }
  }
  return out;
}

function isCoopSaveSlot(value: string): value is CoopSaveSlot {
  return (COOP_SAVE_SLOTS as readonly string[]).includes(value);
}

function canonicalPayload(value: unknown): RunPayload | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { player?: unknown; players?: unknown };
  if (raw.player === undefined && raw.players === undefined) return null;
  const migrated = migrate(createEnvelope(value as RunPayload));
  return migrated?.envelope.payload ?? null;
}

function syncSessionMetadata(payload: RunPayload, session: CoopSessionState): RunPayload {
  payload.localSlot = session.localSlot;
  payload.hostSlot = session.hostSlot;
  payload.roomCode = session.roomCode;
  payload.playerCapacity = session.playerCapacity;
  payload.aiMode = session.aiMode;
  payload.selectedMode = session.selectedMode;
  return payload;
}

function mutatePlayer(
  player: NonNullable<RunPayload["players"]>[string],
  session: CoopSessionState,
  actorSlot: CoopSlot,
  intent: CoopPlanningIntent,
): CoopPlanningRejectReason | null {
  const from = sharedBoardLocationToLocalIndex(session, actorSlot, intent.from);
  if (!from) return "remote_cell";
  if (intent.kind === "sell") return sell(player, from.where, from.index) ? null : "mutation_rejected";

  const to = sharedBoardLocationToLocalIndex(session, actorSlot, intent.to);
  if (!to) return "remote_cell";
  const allowSwap = intent.kind === "replace" || intent.allowSwap !== false;

  if (from.where === "bench" && to.where === "bench") {
    return benchToBench(player, from.index, to.index, allowSwap) ? null : "mutation_rejected";
  }
  if (from.where === "bench" && to.where === "board") {
    return benchToBoard(player, from.index, to.index, allowSwap) ? null : "mutation_rejected";
  }
  if (from.where === "board" && to.where === "bench") {
    return boardToBench(player, from.index, to.index, allowSwap) ? null : "mutation_rejected";
  }
  if (!allowSwap && player.board[to.index]) return "mutation_rejected";
  return boardToBoard(player, from.index, to.index) ? null : "mutation_rejected";
}

export class CoopPlanningRuntime {
  constructor(
    private readonly store: KV,
    private readonly sessionStore: CoopSessionStore = coopSessionStore,
  ) {}

  attachPayload(payload: RunPayload): RunPayload | null {
    const session = this.sessionStore.get();
    if (!session || !profileForSession(session)) return null;
    const normalized = canonicalPayload(payload);
    if (!normalized?.players?.[session.localSlot]) return null;
    syncSessionMetadata(normalized, session);
    this.sessionStore.update({ resumeState: normalized });
    return normalized;
  }

  restoreActiveSave(): RunPayload | null {
    const session = this.sessionStore.get();
    if (!session || !isCoopSaveSlot(session.activeSaveSlotId)) return null;
    const selected = selectCoopSlot(this.store, session.activeSaveSlotId);
    if (selected.mode !== "resume") return null;
    return this.attachPayload(selected.payload);
  }

  resolveHostEnemyPreview(): EnemyPreviewResult | null {
    const session = this.sessionStore.get();
    if (!session || session.localSlot !== session.hostSlot || !profileForSession(session)) return null;
    if (!isCoopSaveSlot(session.activeSaveSlotId)) return null;
    if (session.resumeState === null || typeof session.resumeState !== "object" || Array.isArray(session.resumeState)) return null;
    const next = structuredClone(session.resumeState as RunPayload);
    const host = next.players?.[session.hostSlot];
    if (!host) return null;

    const result = resolveEnemyPreview(host, { players: session.playerCapacity as 2 | 4 });
    if (!result) return null;
    next.shared = {
      ...(next.shared ?? {}),
      round: host.round,
      phase: host.phase,
      enemyPreview: structuredClone(host.enemyPreview),
      enemyPreviewRound: host.enemyPreviewRound,
      enemyBudget: host.enemyBudget,
    };
    syncSessionMetadata(next, session);
    const entry = saveCoopSlot(this.store, session.activeSaveSlotId, next);
    const canonical = entry.envelope.payload;
    this.sessionStore.update({
      resumeState: canonical,
      resumeSummary: coopSummary(entry),
    });
    return result;
  }

  resolveGuestEnemyPreview(): EnemyPreviewResult | null {
    const session = this.sessionStore.get();
    if (!session || session.localSlot === session.hostSlot || !profileForSession(session)) return null;
    const current = canonicalPayload(session.resumeState);
    const local = current?.players?.[session.localSlot];
    const shared = current?.shared;
    if (!current || !local || !shared) return null;
    const result = resolveEnemyPreview(local, {
      isHost: false,
      sharedPreview: shared.enemyPreview,
      sharedPreviewRound: shared.enemyPreviewRound,
      sharedEnemyBudget: shared.enemyBudget,
      players: session.playerCapacity as 2 | 4,
    });
    if (!result) return null;
    this.sessionStore.update({ resumeState: current });
    return result;
  }

  applyLocalIntent(value: unknown): CoopPlanningMutationResult {
    const session = this.sessionStore.get();
    if (!session) return { applied: false, actorSlot: null, reason: "no_session" };
    return this.applyForActor(session.localSlot, value);
  }

  applyRemoteIntent(senderSlot: CoopSlot, value: unknown): CoopPlanningMutationResult {
    const session = this.sessionStore.get();
    if (!session) return { applied: false, actorSlot: null, reason: "no_session" };
    if (session.localSlot !== session.hostSlot) {
      return { applied: false, actorSlot: senderSlot, reason: "not_host" };
    }
    if (!isAllowedSlot(session, senderSlot) || session.players[senderSlot]?.connected !== true) {
      return { applied: false, actorSlot: senderSlot, reason: "sender_not_connected" };
    }
    return this.applyForActor(senderSlot, value);
  }

  applyReplicatedIntent(senderSlot: CoopSlot, value: unknown): CoopPlanningMutationResult {
    const session = this.sessionStore.get();
    if (!session) return { applied: false, actorSlot: null, reason: "no_session" };
    if (senderSlot === session.localSlot) {
      return { applied: false, actorSlot: senderSlot, reason: "duplicate_local_replica" };
    }
    return this.applyForActor(senderSlot, value);
  }

  private applyForActor(actorSlot: CoopSlot, value: unknown): CoopPlanningMutationResult {
    const session = this.sessionStore.get();
    if (!session) return { applied: false, actorSlot: null, reason: "no_session" };
    if (!profileForSession(session)) {
      return { applied: false, actorSlot, reason: "unsupported_capacity" };
    }
    if (!isAllowedSlot(session, actorSlot)) {
      return { applied: false, actorSlot, reason: "missing_player" };
    }
    const intent = normalizeCoopPlanningIntent(value);
    if (!intent) return { applied: false, actorSlot, reason: "invalid_intent" };

    const current = canonicalPayload(session.resumeState);
    if (!current?.players) return { applied: false, actorSlot, reason: "missing_payload" };
    const next = structuredClone(current);
    const player = next.players?.[actorSlot];
    if (!player) return { applied: false, actorSlot, reason: "missing_player" };

    const rejected = mutatePlayer(player, session, actorSlot, intent);
    if (rejected) return { applied: false, actorSlot, reason: rejected };
    if (!isCoopSaveSlot(session.activeSaveSlotId)) {
      return { applied: false, actorSlot, reason: "invalid_save_slot" };
    }

    syncSessionMetadata(next, session);
    const entry = saveCoopSlot(this.store, session.activeSaveSlotId, next);
    const canonical = entry.envelope.payload;
    this.sessionStore.update({
      resumeState: canonical,
      resumeSummary: coopSummary(entry),
    });
    return { applied: true, actorSlot, payload: canonical, entry };
  }
}

export function createBrowserCoopPlanningRuntime(
  sessionStore: CoopSessionStore = coopSessionStore,
): CoopPlanningRuntime | null {
  if (typeof localStorage === "undefined") return null;
  return new CoopPlanningRuntime(localStorage, sessionStore);
}
