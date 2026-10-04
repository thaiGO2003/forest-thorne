// Renderer-neutral combat action staging (A119). Simulation stays authoritative; consumers apply hit events at impact.
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
