export const COOP_SURVIVAL_COMBAT_SNAPSHOT_KIND = "coop_survival_combat_snapshot";
export const COOP_SURVIVAL_COMBAT_SNAPSHOT_INTERVAL_MS = 500;
export const COOP_SURVIVAL_COMBAT_DELTA_KIND = "coop_survival_combat_delta";
export const COOP_SURVIVAL_COMBAT_HEARTBEAT_KIND = "coop_survival_combat_heartbeat";
export const COOP_SURVIVAL_COMBAT_HEARTBEAT_INTERVAL_MS = 20;

export type CoopCombatSide = "LEFT" | "RIGHT";
export type CoopCombatDamageType = "physical" | "magic" | "true";
export type CoopCombatOutcome = "hit" | "miss";

export interface CoopCombatUnitState {
  uid: string | null;
  side: CoopCombatSide;
  row: number;
  col: number;
  homeRow: number;
  homeCol: number;
  hp: number;
  maxHp: number;
  shield: number;
  rage: number;
  alive: boolean;
  statuses: Record<string, unknown>;
}

export interface CoopCombatDeltaEvent {
  eventId: string;
  reason: string;
  damageType: CoopCombatDamageType;
  outcome: CoopCombatOutcome;
  amount: number;
  absorbed: number;
  isCrit: boolean;
  attackerUid: string | null;
  defenderUid: string | null;
  attackerState: CoopCombatUnitState | null;
  defenderState: CoopCombatUnitState | null;
}

export interface CoopCombatStatusBag {
  [key: string]: unknown;
}

export interface CoopCombatUnitLike {
  uid?: unknown;
  side?: unknown;
  row?: unknown;
  col?: unknown;
  homeRow?: unknown;
  homeCol?: unknown;
  hp?: unknown;
  maxHp?: unknown;
  shield?: unknown;
  rage?: unknown;
  alive?: unknown;
  statuses?: unknown;
}

export interface CoopCombatDeltaEventLike {
  attackerState?: unknown;
  defenderState?: unknown;
  eventId?: unknown;
  reason?: unknown;
  damageType?: unknown;
  outcome?: unknown;
  amount?: unknown;
  absorbed?: unknown;
  isCrit?: unknown;
  attackerUid?: unknown;
  defenderUid?: unknown;
}

export interface CoopSurvivalCombatState {
  turnCycleIndex?: unknown;
  combatRound?: unknown;
  round?: unknown;
  playerRound?: unknown;
  lastDeltaRevision?: unknown;
  lastSnapshotRevision?: unknown;
  phase?: unknown;
  actionCount?: unknown;
  turnIndex?: unknown;
  isActing?: unknown;
  timestamp?: unknown;
  units?: unknown;
  events?: unknown;
}

export interface CoopSurvivalCombatSnapshot {
  kind: typeof COOP_SURVIVAL_COMBAT_SNAPSHOT_KIND;
  round: number;
  revision: number;
  lastDeltaRevision: number;
  phase: unknown;
  turnCycleIndex: number;
  combatRound: number;
  actionCount: number;
  turnIndex: number;
  isActing: boolean;
  timestamp: number;
  units: CoopCombatUnitState[];
}

export interface CoopSurvivalCombatDelta {
  kind: typeof COOP_SURVIVAL_COMBAT_DELTA_KIND;
  round: number;
  turnCycleIndex: number;
  combatRound: number;
  turnIndex: number;
  deltaRevision: number;
  lastSnapshotRevision: number;
  timestamp: number;
  events: CoopCombatDeltaEvent[];
}

export interface CoopSurvivalCombatHeartbeat {
  kind: typeof COOP_SURVIVAL_COMBAT_HEARTBEAT_KIND;
  round: number;
  turnCycleIndex: number;
  combatRound: number;
  turnIndex: number;
  lastDeltaRevision: number;
  lastSnapshotRevision: number;
  timestamp: number;
}

export interface CoopSurvivalCombatSnapshotPayload extends CoopSurvivalCombatSnapshot {}
export interface CoopSurvivalCombatDeltaPayload extends CoopSurvivalCombatDelta {}
export interface CoopSurvivalCombatHeartbeatPayload extends CoopSurvivalCombatHeartbeat {}

function cloneStatuses(statuses: unknown = {}): CoopCombatStatusBag {
  if (statuses && typeof statuses === "object") {
    return { ...(statuses as Record<string, unknown>) };
  }
  return {};
}

function normalizeRound(value: unknown, fallback: unknown = 1): number {
  if (Number.isFinite(value)) return Math.max(1, Math.floor(value as number));
  if (Number.isFinite(fallback)) return Math.max(1, Math.floor(fallback as number));
  return 1;
}

function normalizeCount(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

function normalizeMeter(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
}

function normalizeDamageType(value: unknown): CoopCombatDamageType {
  return value === "magic" || value === "true" ? value : "physical";
}

export function serializeCoopCombatUnitState(unit: unknown): CoopCombatUnitState {
  const source = (unit ?? {}) as CoopCombatUnitLike;
  return {
    uid: typeof source.uid === "string" ? source.uid : null,
    side: source.side === "RIGHT" ? "RIGHT" : "LEFT",
    row: normalizeCount(source.row),
    col: normalizeCount(source.col),
    homeRow: normalizeCount(source.homeRow ?? source.row),
    homeCol: normalizeCount(source.homeCol ?? source.col),
    hp: normalizeMeter(source.hp),
    maxHp: normalizeMeter(source.maxHp),
    shield: normalizeMeter(source.shield),
    rage: normalizeMeter(source.rage),
    alive: source.alive !== false,
    statuses: cloneStatuses(source.statuses)
  };
}

function serializeCoopCombatDeltaEvent(event: CoopCombatDeltaEventLike = {}): CoopCombatDeltaEvent {
  const attackerState = event.attackerState && typeof event.attackerState === "object"
    ? serializeCoopCombatUnitState(event.attackerState)
    : null;
  const defenderState = event.defenderState && typeof event.defenderState === "object"
    ? serializeCoopCombatUnitState(event.defenderState)
    : null;
  return {
    eventId: typeof event.eventId === "string" ? event.eventId : "",
    reason: typeof event.reason === "string" ? event.reason : "",
    damageType: normalizeDamageType(event.damageType),
    outcome: event.outcome === "miss" ? "miss" : "hit",
    amount: normalizeMeter(event.amount),
    absorbed: normalizeMeter(event.absorbed),
    isCrit: event.isCrit === true,
    attackerUid: typeof event.attackerUid === "string" ? event.attackerUid : null,
    defenderUid: typeof event.defenderUid === "string" ? event.defenderUid : null,
    attackerState,
    defenderState
  };
}

export function buildCoopSurvivalCombatSnapshot(
  combatState: CoopSurvivalCombatState = {},
  revision: unknown = 0
): CoopSurvivalCombatSnapshot {
  const turnCycleIndex = normalizeCount(combatState.turnCycleIndex ?? combatState.combatRound);
  const sourceUnits = Array.isArray(combatState.units) ? combatState.units : [];
  const units = (sourceUnits as unknown[])
    .map((unit) => serializeCoopCombatUnitState(unit))
    .filter((unit) => typeof unit.uid === "string" && unit.uid);
  return {
    kind: COOP_SURVIVAL_COMBAT_SNAPSHOT_KIND,
    round: normalizeRound(combatState.round, combatState.playerRound ?? 1),
    revision: normalizeCount(revision),
    lastDeltaRevision: normalizeCount(combatState.lastDeltaRevision),
    phase: combatState.phase ?? "combat",
    turnCycleIndex,
    combatRound: turnCycleIndex,
    actionCount: normalizeCount(combatState.actionCount),
    turnIndex: normalizeCount(combatState.turnIndex),
    isActing: combatState.isActing === true,
    timestamp: Number.isFinite(combatState.timestamp)
      ? Math.max(0, Math.floor(combatState.timestamp as number))
      : Date.now(),
    units
  };
}

export function buildCoopSurvivalCombatDelta(
  combatState: CoopSurvivalCombatState = {},
  deltaRevision: unknown = 0
): CoopSurvivalCombatDelta {
  const turnCycleIndex = normalizeCount(combatState.turnCycleIndex ?? combatState.combatRound);
  const sourceEvents = Array.isArray(combatState.events) ? combatState.events : [];
  const events = (sourceEvents as unknown[])
    .map((event) => serializeCoopCombatDeltaEvent(event as CoopCombatDeltaEventLike))
    .filter((event) => event.attackerUid || event.defenderUid || event.eventId);
  return {
    kind: COOP_SURVIVAL_COMBAT_DELTA_KIND,
    round: normalizeRound(combatState.round, combatState.playerRound ?? 1),
    turnCycleIndex,
    combatRound: turnCycleIndex,
    turnIndex: normalizeCount(combatState.turnIndex),
    deltaRevision: normalizeCount(deltaRevision),
    lastSnapshotRevision: normalizeCount(combatState.lastSnapshotRevision),
    timestamp: Number.isFinite(combatState.timestamp)
      ? Math.max(0, Math.floor(combatState.timestamp as number))
      : Date.now(),
    events
  };
}

export function buildCoopSurvivalCombatHeartbeat(
  heartbeatState: CoopSurvivalCombatState = {}
): CoopSurvivalCombatHeartbeat {
  const turnCycleIndex = normalizeCount(heartbeatState.turnCycleIndex ?? heartbeatState.combatRound);
  return {
    kind: COOP_SURVIVAL_COMBAT_HEARTBEAT_KIND,
    round: normalizeRound(heartbeatState.round, heartbeatState.playerRound ?? 1),
    turnCycleIndex,
    combatRound: turnCycleIndex,
    turnIndex: normalizeCount(heartbeatState.turnIndex),
    lastDeltaRevision: normalizeCount(heartbeatState.lastDeltaRevision),
    lastSnapshotRevision: normalizeCount(heartbeatState.lastSnapshotRevision),
    timestamp: Number.isFinite(heartbeatState.timestamp)
      ? Math.max(0, Math.floor(heartbeatState.timestamp as number))
      : Date.now()
  };
}

export function isCoopSurvivalCombatDeltaPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === COOP_SURVIVAL_COMBAT_DELTA_KIND;
}

export function isCoopSurvivalCombatHeartbeatPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === COOP_SURVIVAL_COMBAT_HEARTBEAT_KIND;
}

export function getCoopCombatSnapshotCoveredDeltaRevision(payload: unknown): number {
  return normalizeCount((payload as { lastDeltaRevision?: unknown } | null)?.lastDeltaRevision);
}

export function getCoopCombatDeltaRevision(payload: unknown): number {
  return normalizeCount((payload as { deltaRevision?: unknown } | null)?.deltaRevision);
}

export function getCoopCombatHeartbeatLastDeltaRevision(payload: unknown): number {
  return normalizeCount((payload as { lastDeltaRevision?: unknown } | null)?.lastDeltaRevision);
}

export function getCoopCombatHeartbeatLastSnapshotRevision(payload: unknown): number {
  return normalizeCount((payload as { lastSnapshotRevision?: unknown } | null)?.lastSnapshotRevision);
}

export function cloneCoopCombatDeltaEvents(payload: unknown): CoopCombatDeltaEvent[] {
  const events = (payload as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events.map((event) => serializeCoopCombatDeltaEvent(event as CoopCombatDeltaEventLike));
}

export function isCoopSurvivalCombatSnapshotPayload(payload: unknown): boolean {
  return (payload as { kind?: unknown } | null)?.kind === COOP_SURVIVAL_COMBAT_SNAPSHOT_KIND;
}
