import { clamp } from "../../core/gameUtils.js";
import {
  countMageSkillRefundTargets,
  getArcherRangePassiveModifiers,
  getAssassinBountyGoldPerKill
} from "../../core/rolePassives.js";

const DEFAULT_CRIT_MULTIPLIER = 1.5;

interface RolePassiveUnit {
  uid?: string | number;
  side?: string;
  classType?: string;
  star?: number;
  rage?: number;
  rageMax?: number;
  base?: { classType?: string };
  mods?: Record<string, number>;
  alive?: boolean;
  assassinBountyKills?: number;
  assassinBountyGold?: number;
  _rolePassiveSkillCastTracker?: SkillCastTracker | null;
  [key: string]: unknown;
}

interface SkillCastTracker {
  enemyHitIds: Set<unknown>;
  consumeRage: boolean;
}

interface MageRefundHookContext {
  scene: unknown;
  attacker: RolePassiveUnit;
  refunded: number;
  hitCount: number;
}

interface RolePassiveHooks {
  onMageRefund?: (context: MageRefundHookContext) => void;
  onAfterFinalize?: (context: MageRefundHookContext) => void;
}

interface CritPolicy {
  critMultiplier?: number;
  [key: string]: unknown;
}

interface ArcherModifiers {
  distance: number;
  missBonusPct: number;
  critChanceBonusPct: number;
  critDamageBonusPct: number;
}

interface AdjustedCritState {
  adjustedAttacker: RolePassiveUnit;
  adjustedCritPolicy: CritPolicy | null;
  archerModifiers: ArcherModifiers;
}

export function beginSharedSkillRolePassiveCast(
  attacker: RolePassiveUnit | null | undefined,
  options: { consumeRage?: boolean } = {}
): SkillCastTracker | null {
  if (!attacker) return null;
  const consumeRage = options.consumeRage ?? true;
  const tracker: SkillCastTracker = {
    enemyHitIds: new Set(),
    consumeRage
  };
  attacker._rolePassiveSkillCastTracker = tracker;
  if (consumeRage) {
    attacker.rage = 0;
  }
  return tracker;
}

export function finalizeSharedSkillRolePassiveCast(
  scene: unknown,
  attacker: RolePassiveUnit | null | undefined,
  tracker: SkillCastTracker | null | undefined,
  hooks: RolePassiveHooks = {}
): { refunded: number; hitCount: number } {
  if (!attacker || !tracker) return { refunded: 0, hitCount: 0 };
  if (attacker._rolePassiveSkillCastTracker === tracker) {
    attacker._rolePassiveSkillCastTracker = null;
  }

  const hitCount = countMageSkillRefundTargets(tracker.enemyHitIds);
  let refunded = 0;
  if (attacker.classType === "MAGE" && hitCount > 0) {
    const rageMax = Number(attacker.rageMax) || hitCount;
    refunded = Math.min(rageMax, hitCount);
    attacker.rage = Math.min(rageMax, (Number(attacker.rage) || 0) + refunded);
    hooks.onMageRefund?.({ scene, attacker, refunded, hitCount });
  }
  hooks.onAfterFinalize?.({ scene, attacker, refunded, hitCount });
  return { refunded, hitCount };
}

export function recordSharedSkillRolePassiveHit(
  attacker: RolePassiveUnit | null | undefined,
  defender: RolePassiveUnit | null | undefined,
  options: { isSkill?: boolean; damageLeft?: number; absorbed?: number } = {}
): void {
  if (!options.isSkill || !attacker || !defender || defender.side === attacker.side) return;
  const tracker = attacker._rolePassiveSkillCastTracker;
  if (!tracker?.enemyHitIds) return;
  if ((Number(options.damageLeft) > 0 || Number(options.absorbed) > 0) && defender.uid) {
    tracker.enemyHitIds.add(defender.uid);
  }
}

export function getSharedArcherHitChance(
  attacker: RolePassiveUnit | null | undefined,
  defender: RolePassiveUnit | null | undefined,
  baseHitChance: number
): ArcherModifiers & { hitChance: number } {
  const modifiers = getArcherRangePassiveModifiers(attacker, defender);
  return {
    ...modifiers,
    hitChance: clamp((Number(baseHitChance) || 0) - modifiers.missBonusPct, 0.1, 1)
  };
}

export function getSharedPassiveAdjustedCritState(
  attacker: RolePassiveUnit | null | undefined,
  defender: RolePassiveUnit | null | undefined,
  critPolicy: CritPolicy | null = null
): AdjustedCritState {
  const modifiers = getArcherRangePassiveModifiers(attacker, defender);
  if ((attacker?.classType ?? attacker?.base?.classType) !== "ARCHER" || modifiers.distance <= 0) {
    return {
      adjustedAttacker: attacker as RolePassiveUnit,
      adjustedCritPolicy: critPolicy,
      archerModifiers: modifiers
    };
  }

  const baseMods = (attacker?.mods ?? {}) as Record<string, number>;
  const critPct = (baseMods.critPct ?? 0) + modifiers.critChanceBonusPct;

  return {
    adjustedAttacker: {
      ...attacker,
      mods: {
        ...baseMods,
        critPct
      }
    },
    adjustedCritPolicy: {
      ...(critPolicy ?? {}),
      critMultiplier: Number(critPolicy?.critMultiplier ?? DEFAULT_CRIT_MULTIPLIER) + modifiers.critDamageBonusPct
    },
    archerModifiers: modifiers
  };
}

export function addSharedAssassinBountyKill(
  killer: RolePassiveUnit | null | undefined,
  fallen: RolePassiveUnit | null | undefined
): number {
  if (!killer?.alive || !fallen) return 0;
  if (killer.side === fallen.side) return 0;
  if ((killer?.classType ?? killer?.base?.classType) !== "ASSASSIN") return 0;
  const reward = getAssassinBountyGoldPerKill(killer.star ?? 1);
  killer.assassinBountyKills = Math.max(0, Math.floor(Number(killer.assassinBountyKills) || 0)) + 1;
  killer.assassinBountyGold = Math.max(0, Math.floor(Number(killer.assassinBountyGold) || 0)) + reward;
  return reward;
}
