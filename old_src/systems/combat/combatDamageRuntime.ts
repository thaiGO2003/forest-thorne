import { getEffectiveDef, getEffectiveMdef } from "../../core/combatCalc.js";
import { calculateActionBaseDamage, resolveDamageAmount } from "../../core/damageResolver.js";

export interface DamageUnit {
  uid?: string | number;
  name?: string;
  side?: string;
  hp: number;
  shield: number;
  alive?: boolean;
  isDead?: boolean;
  [key: string]: unknown;
}

export interface DamageSkill {
  damageType?: string;
  [key: string]: unknown;
}

export interface DamageState {
  critPolicy?: null;
  turnOrder?: DamageUnit[];
  combatLog?: Record<string, unknown>[];
  globalDamageMult?: number;
  [key: string]: unknown;
}

export interface DamageBreakdown {
  rawDamage?: number;
  rawAfterElement?: number;
  rawAfterCrit?: number;
  elementalMult?: number;
  finalDamage?: number;
  critSource?: string | null;
}

export interface CalculateDamageResult {
  success: boolean;
  error?: string;
  damage: number;
  damageType?: string;
  isCrit?: boolean;
  breakdown: DamageBreakdown;
}

export interface ApplyDamageResult {
  success: boolean;
  error?: string;
  unit?: DamageUnit;
  died?: boolean;
  shieldAbsorbed?: number;
  hpLost?: number;
  totalDamage?: number;
}

export function calculateDamage(attacker: DamageUnit | null | undefined, defender: DamageUnit | null | undefined, skill: DamageSkill | null | undefined, state?: DamageState | null): CalculateDamageResult {
  if (!attacker || !defender) return { success: false, error: "Invalid attacker or defender", damage: 0, breakdown: {} };
  const actionDamage = calculateActionBaseDamage(
    attacker as Parameters<typeof calculateActionBaseDamage>[0],
    skill as Parameters<typeof calculateActionBaseDamage>[1],
    state as Parameters<typeof calculateActionBaseDamage>[2]
  );
  const rawDamage = typeof actionDamage.rawDamage === "number" ? actionDamage.rawDamage : 0;
  const damageType = typeof actionDamage.damageType === "string" ? actionDamage.damageType : "physical";
  const damageResult = resolveDamageAmount({
    attacker: attacker as Parameters<typeof resolveDamageAmount>[0]["attacker"],
    defender: defender as Parameters<typeof resolveDamageAmount>[0]["defender"],
    rawDamage,
    damageType: damageType as Parameters<typeof resolveDamageAmount>[0]["damageType"],
    attackKind: skill ? "skill" : "basic",
    critPolicy: state?.critPolicy,
    globalDamageMult: state?.globalDamageMult ?? 1,
    getEffectiveDefFn: (target) => getEffectiveDef(target as Parameters<typeof getEffectiveDef>[0]),
    getEffectiveMdefFn: (target) => getEffectiveMdef(target as Parameters<typeof getEffectiveMdef>[0])
  });
  return { success: true, damage: damageResult.finalDamage, damageType: damageResult.damageType, isCrit: damageResult.isCrit, breakdown: { rawDamage: damageResult.rawDamage, rawAfterElement: damageResult.rawAfterElement, rawAfterCrit: damageResult.rawAfterCrit, elementalMult: damageResult.elementalMult, critSource: damageResult.critSource, finalDamage: damageResult.finalDamage } };
}

export function applyDamage(unit: DamageUnit | null | undefined, damage: unknown, state?: DamageState | null): ApplyDamageResult {
  if (!unit) return { success: false, error: "Invalid unit" };
  if (typeof damage !== "number" || !Number.isFinite(damage) || damage < 0) return { success: false, error: "Invalid damage value" };
  if (unit.isDead || unit.alive === false) return { success: false, error: "Unit is already dead" };
  let damageLeft = Math.round(damage);
  let shieldAbsorbed = 0;
  let hpLost = 0;
  if (unit.shield > 0) {
    shieldAbsorbed = Math.min(unit.shield, damageLeft);
    unit.shield -= shieldAbsorbed;
    damageLeft -= shieldAbsorbed;
  }
  if (damageLeft > 0) {
    const oldHP = unit.hp;
    unit.hp = Math.max(0, unit.hp - damageLeft);
    hpLost = oldHP - unit.hp;
  }
  const died = unit.hp <= 0;
  if (died) {
    unit.hp = 0;
    unit.shield = 0;
    unit.isDead = true;
    unit.alive = false;
    if (state?.turnOrder) state.turnOrder = state.turnOrder.filter((entry) => entry.uid !== unit.uid);
    state?.combatLog?.push({ type: "UNIT_DEATH", unitName: unit.name, uid: unit.uid, side: unit.side });
  }
  return { success: true, unit, died, shieldAbsorbed, hpLost, totalDamage: shieldAbsorbed + hpLost };
}
