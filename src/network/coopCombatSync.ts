// Co-op Survival combat payload normalization and revision gates (mega prompt A47.7).

export const COOP_COMBAT_SNAPSHOT_KIND = "coop_survival_combat_snapshot" as const;
export const COOP_COMBAT_DELTA_KIND = "coop_survival_combat_delta" as const;
export const COOP_COMBAT_HEARTBEAT_KIND = "coop_survival_combat_heartbeat" as const;
export const COOP_COMBAT_SNAPSHOT_INTERVAL_MS = 500;
export const COOP_COMBAT_HEARTBEAT_INTERVAL_MS = 20;

export type CoopCombatSide = "LEFT" | "RIGHT";
export type CoopCombatDamageType = "physical" | "magic" | "true";
export type CoopCombatOutcome = "hit" | "miss";

export interface CoopCombatUnitState {
  uid: string;
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
  statuses: unknown[];
}

export interface CoopCombatSnapshot {
  kind: typeof COOP_COMBAT_SNAPSHOT_KIND;
  round: number;
  revision: number;
  lastDeltaRevision: number;
  phase: string;
  turnCycleIndex: number;
  combatRound: number;
  actionCount: number;
  turnIndex: number;
  isActing: boolean;
  timestamp: number;
  units: CoopCombatUnitState[];
}

export interface CoopCombatDeltaEvent {
  eventId: string;
  reason: string;
  damageType: CoopCombatDamageType;
  outcome: CoopCombatOutcome;
  amount: number;
  absorbed: number;
  isCrit: boolean;
  attackerUid: string;
  defenderUid: string;
  attackerState: unknown | null;
  defenderState: unknown | null;
}

export interface CoopCombatDelta {
  kind: typeof COOP_COMBAT_DELTA_KIND;
  round: number;
  turnCycleIndex: number;
  combatRound: number;
  turnIndex: number;
  deltaRevision: number;
  lastSnapshotRevision: number;
  timestamp: number;
  events: CoopCombatDeltaEvent[];
}

export interface CoopCombatHeartbeat {
  kind: typeof COOP_COMBAT_HEARTBEAT_KIND;
  round: number;
  turnCycleIndex: number;
  combatRound: number;
  turnIndex: number;
  lastDeltaRevision: number;
  lastSnapshotRevision: number;
  timestamp: number;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonNegativeInt = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
};

const nonNegativeNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

function cycleIndex(raw: Record<string, unknown>): number {
  return nonNegativeInt(raw.turnCycleIndex ?? raw.combatRound);
}

export function normalizeCoopCombatUnit(value: unknown): CoopCombatUnitState | null {
  const raw = record(value);
  if (!raw || typeof raw.uid !== "string" || !raw.uid.trim()) return null;
  const side = raw.side === "RIGHT" || raw.side === "R" ? "RIGHT" : "LEFT";
  return {
    uid: raw.uid,
    side,
    row: nonNegativeInt(raw.row),
    col: nonNegativeInt(raw.col),
    homeRow: nonNegativeInt(raw.homeRow),
    homeCol: nonNegativeInt(raw.homeCol),
    hp: nonNegativeInt(raw.hp),
    maxHp: nonNegativeInt(raw.maxHp),
    shield: nonNegativeInt(raw.shield),
    rage: nonNegativeInt(raw.rage),
    alive: raw.alive !== false,
    statuses: Array.isArray(raw.statuses) ? structuredClone(raw.statuses) : [],
  };
}

export function normalizeCoopCombatSnapshot(value: unknown): CoopCombatSnapshot {
  const raw = record(value) ?? {};
  const turnCycleIndex = cycleIndex(raw);
  return {
    kind: COOP_COMBAT_SNAPSHOT_KIND,
    round: Math.max(1, nonNegativeInt(raw.round) || 1),
    revision: nonNegativeInt(raw.revision),
    lastDeltaRevision: nonNegativeInt(raw.lastDeltaRevision),
    phase: typeof raw.phase === "string" ? raw.phase : "combat",
    turnCycleIndex,
    combatRound: turnCycleIndex,
    actionCount: nonNegativeInt(raw.actionCount),
    turnIndex: nonNegativeInt(raw.turnIndex),
    isActing: raw.isActing === true,
    timestamp: nonNegativeNumber(raw.timestamp),
    units: Array.isArray(raw.units)
      ? raw.units.map(normalizeCoopCombatUnit).filter((unit): unit is CoopCombatUnitState => unit !== null)
      : [],
  };
}

function normalizeDamageType(value: unknown): CoopCombatDamageType {
  return value === "magic" || value === "true" ? value : "physical";
}

function normalizeOutcome(value: unknown): CoopCombatOutcome {
  return value === "miss" ? "miss" : "hit";
}

export function normalizeCoopCombatDeltaEvent(value: unknown): CoopCombatDeltaEvent | null {
  const raw = record(value);
  if (!raw || typeof raw.eventId !== "string" || !raw.eventId.trim()) return null;
  if (typeof raw.attackerUid !== "string" || !raw.attackerUid.trim()) return null;
  if (typeof raw.defenderUid !== "string" || !raw.defenderUid.trim()) return null;
  return {
    eventId: raw.eventId,
    reason: typeof raw.reason === "string" ? raw.reason : "",
    damageType: normalizeDamageType(raw.damageType),
    outcome: normalizeOutcome(raw.outcome),
    amount: nonNegativeInt(raw.amount),
    absorbed: nonNegativeInt(raw.absorbed),
    isCrit: raw.isCrit === true,
    attackerUid: raw.attackerUid,
    defenderUid: raw.defenderUid,
    attackerState: raw.attackerState === undefined ? null : structuredClone(raw.attackerState),
    defenderState: raw.defenderState === undefined ? null : structuredClone(raw.defenderState),
  };
}

export function normalizeCoopCombatDelta(value: unknown): CoopCombatDelta {
  const raw = record(value) ?? {};
  const turnCycleIndex = cycleIndex(raw);
  return {
    kind: COOP_COMBAT_DELTA_KIND,
    round: Math.max(1, nonNegativeInt(raw.round) || 1),
    turnCycleIndex,
    combatRound: turnCycleIndex,
    turnIndex: nonNegativeInt(raw.turnIndex),
    deltaRevision: nonNegativeInt(raw.deltaRevision),
    lastSnapshotRevision: nonNegativeInt(raw.lastSnapshotRevision),
    timestamp: nonNegativeNumber(raw.timestamp),
    events: Array.isArray(raw.events)
      ? raw.events.map(normalizeCoopCombatDeltaEvent).filter((event): event is CoopCombatDeltaEvent => event !== null)
      : [],
  };
}

export function normalizeCoopCombatHeartbeat(value: unknown): CoopCombatHeartbeat {
  const raw = record(value) ?? {};
  const turnCycleIndex = cycleIndex(raw);
  return {
    kind: COOP_COMBAT_HEARTBEAT_KIND,
    round: Math.max(1, nonNegativeInt(raw.round) || 1),
    turnCycleIndex,
    combatRound: turnCycleIndex,
    turnIndex: nonNegativeInt(raw.turnIndex),
    lastDeltaRevision: nonNegativeInt(raw.lastDeltaRevision),
    lastSnapshotRevision: nonNegativeInt(raw.lastSnapshotRevision),
    timestamp: nonNegativeNumber(raw.timestamp),
  };
}

export interface CoopCombatReceiverState {
  snapshot: CoopCombatSnapshot | null;
  lastDelta: CoopCombatDelta | null;
  heartbeat: CoopCombatHeartbeat | null;
  appliedDeltaRevision: number;
  acceptedSnapshotRevision: number;
  remoteLastDeltaRevision: number;
  remoteLastSnapshotRevision: number;
}

export function createCoopCombatReceiverState(): CoopCombatReceiverState {
  return {
    snapshot: null,
    lastDelta: null,
    heartbeat: null,
    appliedDeltaRevision: 0,
    acceptedSnapshotRevision: 0,
    remoteLastDeltaRevision: 0,
    remoteLastSnapshotRevision: 0,
  };
}

export interface CoopCombatAcceptResult<T> {
  accepted: boolean;
  value: T;
  needsResync: boolean;
}

export function acceptCoopCombatSnapshot(
  state: CoopCombatReceiverState,
  input: unknown,
): CoopCombatAcceptResult<CoopCombatSnapshot> {
  const snapshot = normalizeCoopCombatSnapshot(input);
  const staleRevision = snapshot.revision < state.acceptedSnapshotRevision;
  const rollsBackDelta = snapshot.lastDeltaRevision < state.appliedDeltaRevision;
  if (staleRevision || rollsBackDelta) {
    return { accepted: false, value: snapshot, needsResync: state.remoteLastDeltaRevision > state.appliedDeltaRevision };
  }
  state.snapshot = snapshot;
  state.acceptedSnapshotRevision = snapshot.revision;
  state.appliedDeltaRevision = Math.max(state.appliedDeltaRevision, snapshot.lastDeltaRevision);
  state.remoteLastSnapshotRevision = Math.max(state.remoteLastSnapshotRevision, snapshot.revision);
  state.remoteLastDeltaRevision = Math.max(state.remoteLastDeltaRevision, snapshot.lastDeltaRevision);
  return { accepted: true, value: snapshot, needsResync: state.remoteLastDeltaRevision > state.appliedDeltaRevision };
}

export function acceptCoopCombatDelta(
  state: CoopCombatReceiverState,
  input: unknown,
): CoopCombatAcceptResult<CoopCombatDelta> {
  const delta = normalizeCoopCombatDelta(input);
  if (delta.deltaRevision <= state.appliedDeltaRevision) {
    return { accepted: false, value: delta, needsResync: state.remoteLastDeltaRevision > state.appliedDeltaRevision };
  }
  state.lastDelta = delta;
  state.appliedDeltaRevision = delta.deltaRevision;
  state.remoteLastDeltaRevision = Math.max(state.remoteLastDeltaRevision, delta.deltaRevision);
  state.remoteLastSnapshotRevision = Math.max(state.remoteLastSnapshotRevision, delta.lastSnapshotRevision);
  return { accepted: true, value: delta, needsResync: state.remoteLastDeltaRevision > state.appliedDeltaRevision };
}

export function acceptCoopCombatHeartbeat(
  state: CoopCombatReceiverState,
  input: unknown,
): CoopCombatAcceptResult<CoopCombatHeartbeat> {
  const heartbeat = normalizeCoopCombatHeartbeat(input);
  state.heartbeat = heartbeat;
  state.remoteLastDeltaRevision = Math.max(state.remoteLastDeltaRevision, heartbeat.lastDeltaRevision);
  state.remoteLastSnapshotRevision = Math.max(state.remoteLastSnapshotRevision, heartbeat.lastSnapshotRevision);
  return {
    accepted: true,
    value: heartbeat,
    needsResync:
      heartbeat.lastDeltaRevision > state.appliedDeltaRevision
      || heartbeat.lastSnapshotRevision > state.acceptedSnapshotRevision + 1,
  };
}

export class CoopCombatRevisionClock {
  private snapshotRevision = 0;
  private deltaRevision = 0;

  nextSnapshot(): { revision: number; lastDeltaRevision: number } {
    this.snapshotRevision += 1;
    return { revision: this.snapshotRevision, lastDeltaRevision: this.deltaRevision };
  }

  nextDelta(): { deltaRevision: number; lastSnapshotRevision: number } {
    this.deltaRevision += 1;
    return { deltaRevision: this.deltaRevision, lastSnapshotRevision: this.snapshotRevision };
  }

  heartbeat(): { lastDeltaRevision: number; lastSnapshotRevision: number } {
    return { lastDeltaRevision: this.deltaRevision, lastSnapshotRevision: this.snapshotRevision };
  }
}
