import { APPLY_HANDLERS, TICK_HANDLERS, isStatusTypeSupported, StatusEffect, StatusUnit } from "../StatusEffectHandlers.js";

export interface CombatStatusState {
  combatLog?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface TriggeredStatusEffect {
  type: string;
  damage?: number;
  healed?: number;
  spreads?: boolean;
}

export interface ApplyStatusResult {
  success: boolean;
  error?: string;
  unit?: StatusUnit;
  effectType?: string;
  duration?: number;
  value?: number;
  message?: string;
}

export interface TickStatusResult {
  success: boolean;
  error?: string;
  unit?: StatusUnit;
  triggeredEffects?: TriggeredStatusEffect[];
  controlStatus?: string | null;
  message?: string;
}
export function applyStatusEffect(unit: StatusUnit | null | undefined, effect: StatusEffect | null | undefined, state?: CombatStatusState | null): ApplyStatusResult {
  if (!unit || !effect) {
    return { success: false, error: "Invalid unit or effect" };
  }
  if (unit.isDead || unit.alive === false) {
    return { success: false, error: "Cannot apply status to dead unit" };
  }
  if (!unit.statuses) unit.statuses = {} as StatusUnit["statuses"];

  const effectType = effect.type;
  const duration = effect.duration ?? 1;
  const value = effect.value ?? 0;

  if (!isStatusTypeSupported(effectType)) {
    return { success: false, error: `Unknown status effect type: ${effectType}` };
  }

  const handler = APPLY_HANDLERS[effectType];
  handler(unit, { ...effect, duration, value });

  if (state?.combatLog) {
    state.combatLog.push({
      type: "STATUS_APPLIED",
      unitName: unit.name,
      uid: unit.uid,
      effectType,
      duration,
      value
    });
  }

  return {
    success: true,
    unit,
    effectType,
    duration,
    value,
    message: `Applied ${effectType} to ${unit.name}`
  };
}

export function tickStatusEffects(unit: StatusUnit | null | undefined, state?: CombatStatusState | null): TickStatusResult {
  if (!unit) {
    return { success: false, error: "Invalid unit" };
  }
  if (unit.isDead || unit.alive === false) {
    return { success: false, error: "Cannot tick status on dead unit" };
  }
  if (!unit.statuses) unit.statuses = {} as import("../StatusEffectHandlers.js").MutableStatuses;

  const triggeredEffects: TriggeredStatusEffect[] = [];
  let controlStatus: string | null = null;

  if (unit.statuses.freeze > 0) controlStatus = "freeze";
  else if (unit.statuses.stun > 0) controlStatus = "stun";
  else if (unit.statuses.sleep > 0) controlStatus = "sleep";

  const nonControlStatusTypes = [
    "silence",
    "burn",
    "fireVulnerability",
    "poison",
    "bleed",
    "disease",
    "healBlock",
    "healReduction",
    "shieldLock",
    "scavengeMark",
    "armorBreak",
    "atkBuff",
    "offenseDebuff",
    "defBuff",
    "mdefBuff",
    "evadeBuff",
    "evadeDebuff",
    "taunt",
    "reflect",
    "disarm",
    "immune",
    "physReflect",
    "counter",
    "protecting",
    "hot",
    "bloodHunt",
    "berserk",
    "soulLink",
    "pangolinShield"
  ];

  for (const statusType of nonControlStatusTypes) {
    const handler = TICK_HANDLERS[statusType];
    if (!handler) continue;
    const result = handler(unit);
    if (result.damage) {
      triggeredEffects.push({
        type: statusType,
        damage: result.damage,
        spreads: statusType === "disease"
      });
    }
    if (result.healed) {
      triggeredEffects.push({
        type: statusType,
        healed: result.healed
      });
    }
  }

  if (controlStatus) {
    const handler = TICK_HANDLERS[controlStatus];
    if (handler) handler(unit);
  }

  if (state?.combatLog && (triggeredEffects.length > 0 || controlStatus)) {
    state.combatLog.push({
      type: "STATUS_TICK",
      unitName: unit.name,
      uid: unit.uid,
      triggeredEffects,
      controlStatus
    });
  }

  return {
    success: true,
    unit,
    triggeredEffects,
    controlStatus,
    message: `Ticked status effects for ${unit.name}`
  };
}
