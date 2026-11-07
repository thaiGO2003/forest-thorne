// Renderer-neutral combat action staging (A119). Simulation stays authoritative; consumers apply hit events at impact.
import { LOGICAL_COLS } from "../board/geometry";
import { getUnit } from "../content/catalog";
import type { CombatEvent, Placement } from "./combat";
import { scaleCombatPresentationMs } from "./gameSpeed";

export const MELEE_STAGE_BASE_MS = {
  approach: 140,
  preImpact: 35,
  postImpact: 45,
  retreat: 140,
} as const;

export type CombatActionPattern = "RANGED_STATIC" | "MELEE_FRONT" | "ASSASSIN_BACK";
export interface CombatContactCell { col: number; row: number }

/** Canonical logical contact cell. Logical coordinates never contain the visual river lane. */
export function basicContactCell(
  pattern: CombatActionPattern,
  actor: { side: "L" | "R" },
  target: { col: number; row: number },
): CombatContactCell {
  if (pattern === "RANGED_STATIC") return { col: target.col, row: target.row };
  const forward = actor.side === "L" ? 1 : -1;
  const offset = pattern === "ASSASSIN_BACK" ? forward : -forward;
  return {
    col: Math.max(0, Math.min(LOGICAL_COLS - 1, target.col + offset)),
    row: target.row,
  };
}

/**
 * Old_src `runSharedActionPattern`: a melee front attacker that strikes the defender's front line
 * dashes onto the river seam between logical columns 4 and 5 instead of parking on a grass tile.
 * The seam has no logical column; renderers resolve it as the midpoint of columns 4 and 5.
 */
export function meleeContactUsesRiverSeam(
  pattern: CombatActionPattern,
  actorSide: "L" | "R",
  target: { col: number },
): boolean {
  if (pattern !== "MELEE_FRONT") return false;
  return target.col === (actorSide === "L" ? 5 : 4);
}

/**
 * Old_src backline assassin contact: when the victim already stands on the defender's
 * backline, a logical-cell clamp would park the assassin on that victim's own tile. The
 * renderer instead resolves one visual block away from the river, onto the dark-brown ring
 * exactly like the river-seam contact used by front-line melee.
 */
export function assassinBackContactUsesRing(
  pattern: CombatActionPattern,
  actorSide: "L" | "R",
  target: { col: number },
): boolean {
  if (pattern !== "ASSASSIN_BACK") return false;
  return target.col === (actorSide === "L" ? LOGICAL_COLS - 1 : 0);
}
type DamageCombatEvent = Extract<CombatEvent, { t: "basic" | "skill" }>;
export type BasicCombatEvent =
  | (Omit<DamageCombatEvent, "t"> & { t: "basic" })
  | Extract<CombatEvent, { t: "miss" }>;

export interface CombatActionTiming {
  approachMs: number;
  preImpactMs: number;
  postImpactMs: number;
  retreatMs: number;
  impactOffsetMs: number;
  totalMs: number;
}

export interface StagedBasicEvent {
  eventIndex: number;
  event: BasicCombatEvent;
  pattern: CombatActionPattern;
  startAtMs: number;
  impactAtMs: number;
  /** Damage-bearing basic events transition HP exactly here; misses carry no damage transition. */
  damageAtMs: number | null;
  endAtMs: number;
  timing: CombatActionTiming;
}

/** Canonical A119 basic-action pattern from authored delivery + role. */
export function basicActionPattern(actor: Pick<Placement, "baseId">): CombatActionPattern {
  const unit = getUnit(actor.baseId);
  if (unit.basic.delivery !== "melee") return "RANGED_STATIC";
  return unit.role === "ASSASSIN" ? "ASSASSIN_BACK" : "MELEE_FRONT";
}

/**
 * Movement/contact timing only. Turn-scan cadence remains a separate A56 concern.
 * Ranged delivery has no melee movement delay in this contract.
 */
export function combatActionTiming(pattern: CombatActionPattern, speedLevel: number): CombatActionTiming {
  if (pattern === "RANGED_STATIC") {
    return { approachMs: 0, preImpactMs: 0, postImpactMs: 0, retreatMs: 0, impactOffsetMs: 0, totalMs: 0 };
  }
  const approachMs = scaleCombatPresentationMs(MELEE_STAGE_BASE_MS.approach, speedLevel);
  const preImpactMs = scaleCombatPresentationMs(MELEE_STAGE_BASE_MS.preImpact, speedLevel);
  const postImpactMs = scaleCombatPresentationMs(MELEE_STAGE_BASE_MS.postImpact, speedLevel);
  const retreatMs = scaleCombatPresentationMs(MELEE_STAGE_BASE_MS.retreat, speedLevel);
  return {
    approachMs,
    preImpactMs,
    postImpactMs,
    retreatMs,
    impactOffsetMs: approachMs + preImpactMs,
    totalMs: approachMs + preImpactMs + postImpactMs + retreatMs,
  };
}
function asBasicCombatEvent(event: CombatEvent): BasicCombatEvent | null {
  if (event.t === "basic") return { ...event, t: "basic" };
  if (event.t === "miss") return event;
  return null;
}


/**
 * Stage one authoritative basic/miss event without mutating simulation or board coordinates.
 * Presentation must not apply a basic event's HP transition before `damageAtMs`.
 */
export function stageBasicCombatEvent(
  event: BasicCombatEvent,
  actor: Pick<Placement, "uid" | "baseId">,
  speedLevel: number,
  startAtMs = 0,
  eventIndex = 0,
): StagedBasicEvent {
  if (event.src !== actor.uid) throw new Error(`combat staging actor mismatch: ${actor.uid} !== ${event.src}`);
  const pattern = basicActionPattern(actor);
  const timing = combatActionTiming(pattern, speedLevel);
  const impactAtMs = startAtMs + timing.impactOffsetMs;
  return {
    eventIndex,
    event,
    pattern,
    startAtMs,
    impactAtMs,
    damageAtMs: event.t === "basic" ? impactAtMs : null,
    endAtMs: startAtMs + timing.totalMs,
    timing,
  };
}

/**
 * Build a sequential movement timeline for basic/miss events in authoritative event order.
 * Non-basic events retain their existing event ordering and are intentionally not assigned movement time here.
 */
export function stageBasicCombatEvents(
  events: readonly CombatEvent[],
  placements: readonly Placement[],
  speedLevel: number,
): StagedBasicEvent[] {
  const byUid = new Map(placements.map((p) => [p.uid, p] as const));
  const staged: StagedBasicEvent[] = [];
  let cursorMs = 0;
  for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
    const event = asBasicCombatEvent(events[eventIndex]!);
    if (!event) continue;
    const actor = byUid.get(event.src);
    if (!actor) throw new Error(`combat staging source not found: ${event.src}`);
    const entry = stageBasicCombatEvent(event, actor, speedLevel, cursorMs, eventIndex);
    staged.push(entry);
    cursorMs = entry.endAtMs;
  }
  return staged;
}
