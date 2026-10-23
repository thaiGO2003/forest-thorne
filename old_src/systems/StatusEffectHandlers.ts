/** Mutable combat unit shape used by status handlers. */
export interface StatusValues {
  [key: string]: unknown;
  freeze?: number;
  stun?: number;
  sleep?: number;
  silence?: number;
  burnTurns?: number;
  burnDamage?: number;
  fireVulnerabilityTurns?: number;
  fireVulnerabilityMultiplier?: number;
  poisonTurns?: number;
  poisonDamage?: number;
  bleedTurns?: number;
  bleedDamage?: number;
  diseaseTurns?: number;
  diseaseDamage?: number;
  berserkTurns?: number;
  berserkLifestealPct?: number;
  berserkNextBasicMultiplier?: number;
  berserkKillRageGain?: number;
  berserkKillExtendTurns?: number;
  berserkKillChainBasic?: number;
  healBlockTurns?: number;
  healBlockSourceId?: string | number | null;
  healReductionTurns?: number;
  healReductionPct?: number;
  shieldLockTurns?: number;
  shieldLockSourceId?: string | number | null;
  scavengeMarkTurns?: number;
  scavengeMarkDamageMultiplier?: number;
  scavengeMarkRageDrain?: number;
  scavengeMarkEvadeDebuffTurns?: number;
  scavengeMarkEvadeDebuffValue?: number;
  armorBreakTurns?: number;
  armorBreakValue?: number;
  atkBuffTurns?: number;
  atkBuffValue?: number;
  matkBuffTurns?: number;
  matkBuffValue?: number;
  offenseDebuffTurns?: number;
  offenseDebuffValue?: number;
  offenseDebuffMode?: string;
  atkDebuffTurns?: number;
  atkDebuffValue?: number;
  defBuffTurns?: number;
  defBuffValue?: number;
  mdefBuffTurns?: number;
  mdefBuffValue?: number;
  evadeBuffTurns?: number;
  evadeBuffValue?: number;
  evadeBuffDodgeHeal?: number;
  evadeBuffDodgeShield?: number;
  evadeBuffDodgeRage?: number;
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  tauntTurns?: number;
  tauntTargetId?: string | number | null;
  reflectTurns?: number;
  reflectPct?: number;
  disarmTurns?: number;
  immuneTurns?: number;
  physReflectTurns?: number;
  physReflectPct?: number;
  onHitOffenseDebuffTurns?: number;
  onHitOffenseDebuffValue?: number;
  onHitOffenseDebuffMode?: string;
  counterTurns?: number;
  isProtecting?: number;
  hotTurns?: number;
  hotAmount?: number;
  bloodHuntTurns?: number;
  bloodHuntStacks?: number;
  bloodHuntAntiHeal?: number;
  soulLinkTurns?: number;
  soulLinkId?: string | number | null;
  soulLinkHealMultiplier?: number;
  soulLinkShieldPct?: number;
  soulLinkCleanseCount?: number;
  soulLinkRageGain?: number;
  pangolinShieldTurns?: number;
  pangolinShieldExpireHealPct?: number;
  pangolinShieldExpireDamageReductionPct?: number;
  pangolinShieldExpireDamageReductionTurns?: number;
  pangolinShieldExpireCleanseCount?: number;
  guardianTurns?: number;
  guardianId?: string | number | null;
  guardianAbsorb?: number;
  guardianRedirectCharges?: number;
  guardianCounterOffenseDebuffTurns?: number;
  guardianCounterOffenseDebuffValue?: number;
  guardianCounterOffenseDebuffMode?: string;
  damageReductionTurns?: number;
  damageReductionPct?: number;
  magicDamageReductionTurns?: number;
  magicDamageReductionPct?: number;
  fortifyReduceTurns?: number;
  fortifyReducePct?: number;
  resilientShieldTurns?: number;
  resilientShieldHealPct?: number;
  resilientShieldHotTurns?: number;
  resilientShieldHotPct?: number;
}

type NumericStatusKey =
  | "freeze" | "stun" | "sleep" | "silence" | "burnTurns" | "burnDamage"
  | "fireVulnerabilityTurns" | "fireVulnerabilityMultiplier" | "poisonTurns" | "poisonDamage"
  | "bleedTurns" | "bleedDamage" | "diseaseTurns" | "diseaseDamage" | "berserkTurns"
  | "berserkLifestealPct" | "berserkNextBasicMultiplier" | "berserkKillRageGain"
  | "berserkKillExtendTurns" | "berserkKillChainBasic" | "healBlockTurns" | "healReductionTurns"
  | "healReductionPct" | "shieldLockTurns" | "scavengeMarkTurns" | "scavengeMarkDamageMultiplier"
  | "scavengeMarkRageDrain" | "scavengeMarkEvadeDebuffTurns" | "scavengeMarkEvadeDebuffValue"
  | "armorBreakTurns" | "armorBreakValue" | "atkBuffTurns" | "atkBuffValue" | "matkBuffTurns"
  | "matkBuffValue" | "offenseDebuffTurns" | "offenseDebuffValue" | "atkDebuffTurns" | "atkDebuffValue"
  | "defBuffTurns" | "defBuffValue" | "mdefBuffTurns" | "mdefBuffValue" | "evadeBuffTurns"
  | "evadeBuffValue" | "evadeBuffDodgeHeal" | "evadeBuffDodgeShield" | "evadeBuffDodgeRage"
  | "evadeDebuffTurns" | "evadeDebuffValue" | "tauntTurns" | "reflectTurns" | "reflectPct"
  | "disarmTurns" | "immuneTurns" | "physReflectTurns" | "physReflectPct" | "counterTurns"
  | "isProtecting" | "hotTurns" | "hotAmount" | "bloodHuntTurns" | "bloodHuntStacks"
  | "bloodHuntAntiHeal" | "soulLinkTurns" | "soulLinkHealMultiplier" | "soulLinkShieldPct"
  | "soulLinkCleanseCount" | "soulLinkRageGain" | "pangolinShieldTurns" | "pangolinShieldExpireHealPct"
  | "pangolinShieldExpireDamageReductionPct" | "pangolinShieldExpireDamageReductionTurns"
  | "pangolinShieldExpireCleanseCount" | "guardianTurns" | "guardianAbsorb" | "guardianRedirectCharges"
  | "guardianCounterOffenseDebuffTurns" | "guardianCounterOffenseDebuffValue" | "damageReductionTurns"
  | "damageReductionPct" | "magicDamageReductionTurns" | "magicDamageReductionPct" | "fortifyReduceTurns"
  | "fortifyReducePct" | "resilientShieldTurns" | "resilientShieldHealPct" | "resilientShieldHotTurns"
  | "resilientShieldHotPct";

export type MutableStatuses = Omit<StatusValues, NumericStatusKey> & { [K in NumericStatusKey]: number };

export interface StatusUnit {
  statuses: MutableStatuses;
  alive?: boolean;
  maxHp?: number;
  shield?: number;
  name?: string;
  uid?: string | number;
  [key: string]: unknown;
}

export interface StatusEffect {
  type: string;
  duration?: number;
  value?: number;
  sourceId?: string | number | null;
  mode?: string;
  stat?: string;
  targetId?: string | number | null;
  guardianId?: string | number | null;
  damageMultiplier?: number;
  rageDrain?: number;
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  lifestealPct?: number;
  firstBasicMultiplier?: number;
  rageGainOnKill?: number;
  extendTurnsOnKill?: number;
  chainBasicOnKill?: number;
  stacks?: number;
  antiHeal?: boolean;
  healMultiplier?: number;
  shieldPct?: number;
  cleanseCount?: number;
  rageGain?: number;
  healPct?: number;
  damageReductionPct?: number;
  damageReductionTurns?: number;
  hotTurns?: number;
  hotPct?: number;
  [key: string]: unknown;
}

export interface StatusTickResult {
  damage?: number;
  healed?: number;
  expired?: boolean;
}

export type ApplyStatusHandler = (unit: StatusUnit, effect: StatusEffect) => void;
export type TickStatusHandler = (unit: StatusUnit) => StatusTickResult;

/**
 * Status Effect Handlers
 * 
 * Provides a lookup table of handler functions for different status effect types.
 * Each handler is responsible for applying or ticking a specific status effect.
 * 
 * This module reduces cyclomatic complexity in CombatSystem by replacing large
 * switch statements with a simple lookup pattern.
 */

/**
 * Apply handlers - called when a status effect is first applied to a unit
 */
import { applyOffenseDebuffStatus, clearOffenseDebuffStatus } from "../core/offenseDebuff.js";

function cleanseOrderedDebuffs(unit: StatusUnit, maxCount: unknown): number {
  const debuffs = [
    "freeze",
    "stun",
    "sleep",
    "silence",
    "burnTurns",
    "poisonTurns",
    "bleedTurns",
    "diseaseTurns",
    "healBlockTurns",
    "healReductionTurns"
  ];
  const limit = Number.isFinite(Number(maxCount))
    ? Math.max(0, Math.round(Number(maxCount)))
    : Number.POSITIVE_INFINITY;
  let cleansed = 0;
  debuffs.forEach((key) => {
    if (cleansed >= limit) return;
    const statusValue = unit.statuses[key];
    if (typeof statusValue !== "number" || statusValue <= 0) return;
    unit.statuses[key] = 0;
    if (key === "healBlockTurns") unit.statuses.healBlockSourceId = null;
    if (key === "healReductionTurns") unit.statuses.healReductionPct = 0;
    cleansed += 1;
  });
  return cleansed;
}
export const APPLY_HANDLERS: Record<string, ApplyStatusHandler> = {
  // Control effects (hard CC)
  freeze: (unit, effect) => {
    unit.statuses.freeze = Math.max(unit.statuses.freeze ?? 0, effect.duration ?? 1);
  },

  stun: (unit, effect) => {
    unit.statuses.stun = Math.max(unit.statuses.stun ?? 0, effect.duration ?? 1);
  },

  sleep: (unit, effect) => {
    unit.statuses.sleep = Math.max(unit.statuses.sleep ?? 0, effect.duration ?? 1);
  },

  silence: (unit, effect) => {
    unit.statuses.silence = Math.max(unit.statuses.silence ?? 0, effect.duration ?? 1);
  },

  // Damage over time effects
  burn: (unit, effect) => {
    unit.statuses.burnTurns = Math.max(unit.statuses.burnTurns ?? 0, effect.duration ?? 1);
    unit.statuses.burnDamage = effect.value ?? 0;
  },

  fireVulnerability: (unit, effect) => {
    unit.statuses.fireVulnerabilityTurns = Math.max(unit.statuses.fireVulnerabilityTurns ?? 0, effect.duration ?? 1);
    unit.statuses.fireVulnerabilityMultiplier = Math.max(unit.statuses.fireVulnerabilityMultiplier ?? 1, effect.value ?? 1);
  },

  poison: (unit, effect) => {
    unit.statuses.poisonTurns = Math.max(unit.statuses.poisonTurns ?? 0, effect.duration ?? 1);
    unit.statuses.poisonDamage = effect.value ?? 0;
  },

  bleed: (unit, effect) => {
    unit.statuses.bleedTurns = Math.max(unit.statuses.bleedTurns ?? 0, effect.duration ?? 1);
    unit.statuses.bleedDamage = effect.value ?? 0;
  },

  disease: (unit, effect) => {
    unit.statuses.diseaseTurns = Math.max(unit.statuses.diseaseTurns ?? 0, effect.duration ?? 1);
    unit.statuses.diseaseDamage = effect.value ?? 0;
  },

  berserk: (unit, effect) => {
    unit.statuses.berserkTurns = Math.max(unit.statuses.berserkTurns ?? 0, effect.duration ?? 1);
    unit.statuses.berserkLifestealPct = Math.max(unit.statuses.berserkLifestealPct ?? 0, effect.lifestealPct ?? 0);
    unit.statuses.berserkNextBasicMultiplier = Math.max(unit.statuses.berserkNextBasicMultiplier ?? 0, effect.firstBasicMultiplier ?? 0);
    unit.statuses.berserkKillRageGain = Math.max(unit.statuses.berserkKillRageGain ?? 0, effect.rageGainOnKill ?? 0);
    unit.statuses.berserkKillExtendTurns = Math.max(unit.statuses.berserkKillExtendTurns ?? 0, effect.extendTurnsOnKill ?? 0);
    unit.statuses.berserkKillChainBasic = Math.max(unit.statuses.berserkKillChainBasic ?? 0, effect.chainBasicOnKill ?? 0);
  },

  healBlock: (unit, effect) => {
    unit.statuses.healBlockTurns = Math.max(unit.statuses.healBlockTurns ?? 0, effect.duration ?? 1);
    unit.statuses.healBlockSourceId = effect.sourceId ?? unit.statuses.healBlockSourceId ?? null;
  },

  healReduction: (unit, effect) => {
    unit.statuses.healReductionTurns = Math.max(unit.statuses.healReductionTurns ?? 0, effect.duration ?? 1);
    unit.statuses.healReductionPct = Math.max(unit.statuses.healReductionPct ?? 0, effect.value ?? 0);
  },

  shieldLock: (unit, effect) => {
    unit.statuses.shieldLockTurns = Math.max(unit.statuses.shieldLockTurns ?? 0, effect.duration ?? 1);
    unit.statuses.shieldLockSourceId = effect.sourceId ?? unit.statuses.shieldLockSourceId ?? null;
  },

  scavengeMark: (unit, effect) => {
    unit.statuses.scavengeMarkTurns = Math.max(unit.statuses.scavengeMarkTurns ?? 0, effect.duration ?? 1);
    unit.statuses.scavengeMarkDamageMultiplier = Math.max(unit.statuses.scavengeMarkDamageMultiplier ?? 0, effect.damageMultiplier ?? 0);
    unit.statuses.scavengeMarkRageDrain = Math.max(unit.statuses.scavengeMarkRageDrain ?? 0, effect.rageDrain ?? 0);
    unit.statuses.scavengeMarkEvadeDebuffTurns = Math.max(unit.statuses.scavengeMarkEvadeDebuffTurns ?? 0, effect.evadeDebuffTurns ?? 0);
    unit.statuses.scavengeMarkEvadeDebuffValue = Math.max(unit.statuses.scavengeMarkEvadeDebuffValue ?? 0, effect.evadeDebuffValue ?? 0);
  },

  // Stat modifiers
  armorBreak: (unit, effect) => {
    unit.statuses.armorBreakTurns = Math.max(unit.statuses.armorBreakTurns ?? 0, effect.duration ?? 1);
    unit.statuses.armorBreakValue = effect.value ?? 0;
  },

  atkBuff: (unit, effect) => {
    unit.statuses.atkBuffTurns = Math.max(unit.statuses.atkBuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.atkBuffValue = effect.value ?? 0;
  },

  matkBuff: (unit, effect) => {
    unit.statuses.matkBuffTurns = Math.max(unit.statuses.matkBuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.matkBuffValue = effect.value ?? 0;
  },

  offenseDebuff: (unit, effect) => {
    applyOffenseDebuffStatus(unit, {
      turns: effect.duration ?? 1,
      value: effect.value ?? 0,
      mode: effect.mode ?? effect.stat ?? "autoByRole"
    });
  },

  atkDebuff: (unit, effect) => {
    applyOffenseDebuffStatus(unit, {
      turns: effect.duration ?? 1,
      value: effect.value ?? 0,
      mode: effect.stat ?? "atk"
    });
  },

  defBuff: (unit, effect) => {
    unit.statuses.defBuffTurns = Math.max(unit.statuses.defBuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.defBuffValue = effect.value ?? 0;
  },

  mdefBuff: (unit, effect) => {
    unit.statuses.mdefBuffTurns = Math.max(unit.statuses.mdefBuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.mdefBuffValue = effect.value ?? 0;
  },

  evadeBuff: (unit, effect) => {
    unit.statuses.evadeBuffTurns = Math.max(unit.statuses.evadeBuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.evadeBuffValue = effect.value ?? 0;
  },

  evadeDebuff: (unit, effect) => {
    unit.statuses.evadeDebuffTurns = Math.max(unit.statuses.evadeDebuffTurns ?? 0, effect.duration ?? 1);
    unit.statuses.evadeDebuffValue = effect.value ?? 0;
  },

  // Special effects
  taunt: (unit, effect) => {
    unit.statuses.tauntTurns = Math.max(unit.statuses.tauntTurns ?? 0, effect.duration ?? 1);
    unit.statuses.tauntTargetId = effect.targetId ?? null;
  },

  reflect: (unit, effect) => {
    unit.statuses.reflectTurns = Math.max(unit.statuses.reflectTurns ?? 0, effect.duration ?? 1);
    unit.statuses.reflectPct = effect.value ?? 0;
  },

  disarm: (unit, effect) => {
    unit.statuses.disarmTurns = Math.max(unit.statuses.disarmTurns ?? 0, effect.duration ?? 1);
  },

  immune: (unit, effect) => {
    unit.statuses.immuneTurns = Math.max(unit.statuses.immuneTurns ?? 0, effect.duration ?? 1);
  },

  physReflect: (unit, effect) => {
    unit.statuses.physReflectTurns = Math.max(unit.statuses.physReflectTurns ?? 0, effect.duration ?? 1);
    unit.statuses.physReflectPct = Math.max(unit.statuses.physReflectPct ?? 0, effect.value ?? 1);
  },

  counter: (unit, effect) => {
    unit.statuses.counterTurns = Math.max(unit.statuses.counterTurns ?? 0, effect.duration ?? 1);
  },

  protecting: (unit, effect) => {
    unit.statuses.isProtecting = effect.duration ?? 1;
  },

  // Heal over time
  hot: (unit, effect) => {
    unit.statuses.hotTurns = Math.max(unit.statuses.hotTurns ?? 0, effect.duration ?? 1);
    unit.statuses.hotAmount = Math.max(unit.statuses.hotAmount ?? 0, effect.value ?? 0);
  },

  bloodHunt: (unit, effect) => {
    unit.statuses.bloodHuntTurns = Math.max(unit.statuses.bloodHuntTurns ?? 0, effect.duration ?? 1);
    unit.statuses.bloodHuntStacks = Math.max(unit.statuses.bloodHuntStacks ?? 0, effect.stacks ?? effect.value ?? 1);
    unit.statuses.bloodHuntAntiHeal = effect.antiHeal ? 1 : Math.max(unit.statuses.bloodHuntAntiHeal ?? 0, 0);
  },

  soulLink: (unit, effect) => {
    unit.statuses.soulLinkId = effect.sourceId ?? unit.statuses.soulLinkId ?? null;
    unit.statuses.soulLinkTurns = Math.max(unit.statuses.soulLinkTurns ?? 0, effect.duration ?? 1);
    unit.statuses.soulLinkHealMultiplier = Math.max(unit.statuses.soulLinkHealMultiplier ?? 0, effect.healMultiplier ?? 1);
    unit.statuses.soulLinkShieldPct = Math.max(unit.statuses.soulLinkShieldPct ?? 0, effect.shieldPct ?? 0);
    unit.statuses.soulLinkCleanseCount = Math.max(unit.statuses.soulLinkCleanseCount ?? 0, effect.cleanseCount ?? 0);
    unit.statuses.soulLinkRageGain = Math.max(unit.statuses.soulLinkRageGain ?? 0, effect.rageGain ?? 0);
  },

  pangolinShield: (unit, effect) => {
    unit.statuses.pangolinShieldTurns = Math.max(unit.statuses.pangolinShieldTurns ?? 0, effect.duration ?? 1);
    unit.statuses.pangolinShieldExpireHealPct = Math.max(unit.statuses.pangolinShieldExpireHealPct ?? 0, effect.healPct ?? 0);
    unit.statuses.pangolinShieldExpireDamageReductionPct = Math.max(
      unit.statuses.pangolinShieldExpireDamageReductionPct ?? 0,
      effect.damageReductionPct ?? 0
    );
    unit.statuses.pangolinShieldExpireDamageReductionTurns = Math.max(
      unit.statuses.pangolinShieldExpireDamageReductionTurns ?? 0,
      effect.damageReductionTurns ?? 0
    );
    unit.statuses.pangolinShieldExpireCleanseCount = Math.max(
      unit.statuses.pangolinShieldExpireCleanseCount ?? 0,
      effect.cleanseCount ?? 0
    );
  },

  guardian: (unit, effect) => {
    unit.statuses.guardianTurns = Math.max(unit.statuses.guardianTurns ?? 0, effect.duration ?? 1);
    unit.statuses.guardianId = effect.guardianId ?? unit.statuses.guardianId ?? null;
    unit.statuses.guardianAbsorb = Math.max(unit.statuses.guardianAbsorb ?? 0, effect.value ?? 0);
  },

  damageReduction: (unit, effect) => {
    unit.statuses.damageReductionTurns = Math.max(unit.statuses.damageReductionTurns ?? 0, effect.duration ?? 1);
    unit.statuses.damageReductionPct = Math.max(unit.statuses.damageReductionPct ?? 0, effect.value ?? 0);
  },

  magicDamageReduction: (unit, effect) => {
    unit.statuses.magicDamageReductionTurns = Math.max(unit.statuses.magicDamageReductionTurns ?? 0, effect.duration ?? 1);
    unit.statuses.magicDamageReductionPct = Math.max(unit.statuses.magicDamageReductionPct ?? 0, effect.value ?? 0);
  },

  fortifyReduction: (unit, effect) => {
    unit.statuses.fortifyReduceTurns = Math.max(unit.statuses.fortifyReduceTurns ?? 0, effect.duration ?? 1);
    unit.statuses.fortifyReducePct = Math.max(unit.statuses.fortifyReducePct ?? 0, effect.value ?? 0);
  },

  resilientShield: (unit, effect) => {
    unit.statuses.resilientShieldTurns = Math.max(unit.statuses.resilientShieldTurns ?? 0, effect.duration ?? 1);
    unit.statuses.resilientShieldHealPct = Math.max(unit.statuses.resilientShieldHealPct ?? 0, effect.healPct ?? 0);
    unit.statuses.resilientShieldHotTurns = Math.max(unit.statuses.resilientShieldHotTurns ?? 0, effect.hotTurns ?? 0);
    unit.statuses.resilientShieldHotPct = Math.max(unit.statuses.resilientShieldHotPct ?? 0, effect.hotPct ?? 0);
  }
};

/**
 * Tick handlers - called each turn to process ongoing status effects
 * Returns { damage, healed, expired } for effects that trigger
 */
export const TICK_HANDLERS: Record<string, TickStatusHandler> = {
  // Control effects - just decrement
  freeze: (unit) => {
    if (unit.statuses.freeze > 0) {
      unit.statuses.freeze--;
      return { expired: unit.statuses.freeze === 0 };
    }
    return {};
  },

  stun: (unit) => {
    if (unit.statuses.stun > 0) {
      unit.statuses.stun--;
      return { expired: unit.statuses.stun === 0 };
    }
    return {};
  },

  sleep: (unit) => {
    if (unit.statuses.sleep > 0) {
      unit.statuses.sleep--;
      return { expired: unit.statuses.sleep === 0 };
    }
    return {};
  },

  silence: (unit) => {
    if (unit.statuses.silence > 0) {
      unit.statuses.silence--;
      return { expired: unit.statuses.silence === 0 };
    }
    return {};
  },

  // Damage over time effects
  burn: (unit) => {
    if (unit.statuses.burnTurns > 0) {
      const fireVulnerabilityMult = (unit.statuses.fireVulnerabilityTurns ?? 0) > 0
        ? Math.max(1, Number(unit.statuses.fireVulnerabilityMultiplier ?? 1) || 1)
        : 1;
      const damage = Math.round((unit.statuses.burnDamage ?? 0) * fireVulnerabilityMult);
      unit.statuses.burnTurns--;
      const expired = unit.statuses.burnTurns === 0;
      if (expired) {
        unit.statuses.burnDamage = 0;
      }
      return { damage, expired };
    }
    return {};
  },

  fireVulnerability: (unit) => {
    if ((unit.statuses.fireVulnerabilityTurns ?? 0) > 0) {
      unit.statuses.fireVulnerabilityTurns--;
      const expired = unit.statuses.fireVulnerabilityTurns === 0;
      if (expired) {
        unit.statuses.fireVulnerabilityMultiplier = 1;
      }
      return { expired };
    }
    return {};
  },

  poison: (unit) => {
    if (unit.statuses.poisonTurns > 0) {
      const damage = unit.statuses.poisonDamage ?? 0;
      unit.statuses.poisonTurns--;
      const expired = unit.statuses.poisonTurns === 0;
      if (expired) {
        unit.statuses.poisonDamage = 0;
      }
      return { damage, expired };
    }
    return {};
  },

  bleed: (unit) => {
    if (unit.statuses.bleedTurns > 0) {
      const damage = unit.statuses.bleedDamage ?? 0;
      unit.statuses.bleedTurns--;
      const expired = unit.statuses.bleedTurns === 0;
      if (expired) {
        unit.statuses.bleedDamage = 0;
      }
      return { damage, expired };
    }
    return {};
  },

  disease: (unit) => {
    if (unit.statuses.diseaseTurns > 0) {
      const damage = unit.statuses.diseaseDamage ?? 0;
      unit.statuses.diseaseTurns--;
      const expired = unit.statuses.diseaseTurns === 0;
      if (expired) {
        unit.statuses.diseaseDamage = 0;
      }
      return { damage, expired };
    }
    return {};
  },

  healBlock: (unit) => {
    if ((unit.statuses.healBlockTurns ?? 0) > 0) {
      unit.statuses.healBlockTurns--;
      const expired = unit.statuses.healBlockTurns === 0;
      if (expired) {
        unit.statuses.healBlockSourceId = null;
      }
      return { expired };
    }
    return {};
  },

  healReduction: (unit) => {
    if ((unit.statuses.healReductionTurns ?? 0) > 0) {
      unit.statuses.healReductionTurns--;
      const expired = unit.statuses.healReductionTurns === 0;
      if (expired) {
        unit.statuses.healReductionPct = 0;
      }
      return { expired };
    }
    return {};
  },

  shieldLock: (unit) => {
    if ((unit.statuses.shieldLockTurns ?? 0) > 0) {
      unit.statuses.shieldLockTurns--;
      const expired = unit.statuses.shieldLockTurns === 0;
      if (expired) {
        unit.statuses.shieldLockSourceId = null;
      }
      return { expired };
    }
    return {};
  },

  scavengeMark: (unit) => {
    if ((unit.statuses.scavengeMarkTurns ?? 0) > 0) {
      unit.statuses.scavengeMarkTurns--;
      const expired = unit.statuses.scavengeMarkTurns === 0;
      if (expired) {
        unit.statuses.scavengeMarkDamageMultiplier = 0;
        unit.statuses.scavengeMarkRageDrain = 0;
        unit.statuses.scavengeMarkEvadeDebuffTurns = 0;
        unit.statuses.scavengeMarkEvadeDebuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  // Stat modifiers - just decrement
  armorBreak: (unit) => {
    if (unit.statuses.armorBreakTurns > 0) {
      unit.statuses.armorBreakTurns--;
      const expired = unit.statuses.armorBreakTurns === 0;
      if (expired) {
        unit.statuses.armorBreakValue = 0;
      }
      return { expired };
    }
    return {};
  },

  atkBuff: (unit) => {
    if (unit.statuses.atkBuffTurns > 0) {
      unit.statuses.atkBuffTurns--;
      const expired = unit.statuses.atkBuffTurns === 0;
      if (expired) {
        unit.statuses.atkBuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  matkBuff: (unit) => {
    if (unit.statuses.matkBuffTurns > 0) {
      unit.statuses.matkBuffTurns--;
      const expired = unit.statuses.matkBuffTurns === 0;
      if (expired) {
        unit.statuses.matkBuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  offenseDebuff: (unit) => {
    if ((unit.statuses.offenseDebuffTurns ?? 0) > 0) {
      unit.statuses.offenseDebuffTurns--;
      const expired = unit.statuses.offenseDebuffTurns === 0;
      if (expired) {
        clearOffenseDebuffStatus(unit);
      }
      return { expired };
    }
    if ((unit.statuses.atkDebuffTurns ?? 0) > 0) {
      unit.statuses.atkDebuffTurns--;
      const expired = unit.statuses.atkDebuffTurns === 0;
      if (expired) {
        unit.statuses.atkDebuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  atkDebuff: (unit) => {
    return TICK_HANDLERS.offenseDebuff(unit);
  },

  defBuff: (unit) => {
    if (unit.statuses.defBuffTurns > 0) {
      unit.statuses.defBuffTurns--;
      const expired = unit.statuses.defBuffTurns === 0;
      if (expired) {
        unit.statuses.defBuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  mdefBuff: (unit) => {
    if (unit.statuses.mdefBuffTurns > 0) {
      unit.statuses.mdefBuffTurns--;
      const expired = unit.statuses.mdefBuffTurns === 0;
      if (expired) {
        unit.statuses.mdefBuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  evadeBuff: (unit) => {
    if (unit.statuses.evadeBuffTurns > 0) {
      unit.statuses.evadeBuffTurns--;
      const expired = unit.statuses.evadeBuffTurns === 0;
      if (expired) {
        unit.statuses.evadeBuffValue = 0;
        unit.statuses.evadeBuffDodgeHeal = 0;
        unit.statuses.evadeBuffDodgeShield = 0;
        unit.statuses.evadeBuffDodgeRage = 0;
      }
      return { expired };
    }
    return {};
  },

  evadeDebuff: (unit) => {
    if (unit.statuses.evadeDebuffTurns > 0) {
      unit.statuses.evadeDebuffTurns--;
      const expired = unit.statuses.evadeDebuffTurns === 0;
      if (expired) {
        unit.statuses.evadeDebuffValue = 0;
      }
      return { expired };
    }
    return {};
  },

  // Special effects
  taunt: (unit) => {
    if (unit.statuses.tauntTurns > 0) {
      unit.statuses.tauntTurns--;
      const expired = unit.statuses.tauntTurns === 0;
      if (expired) {
        unit.statuses.tauntTargetId = null;
      }
      return { expired };
    }
    return {};
  },

  reflect: (unit) => {
    if (unit.statuses.reflectTurns > 0) {
      unit.statuses.reflectTurns--;
      const expired = unit.statuses.reflectTurns === 0;
      if (expired) {
        unit.statuses.reflectPct = 0;
      }
      return { expired };
    }
    return {};
  },

  disarm: (unit) => {
    if (unit.statuses.disarmTurns > 0) {
      unit.statuses.disarmTurns--;
      return { expired: unit.statuses.disarmTurns === 0 };
    }
    return {};
  },

  immune: (unit) => {
    if (unit.statuses.immuneTurns > 0) {
      unit.statuses.immuneTurns--;
      return { expired: unit.statuses.immuneTurns === 0 };
    }
    return {};
  },

  physReflect: (unit) => {
    if (unit.statuses.physReflectTurns > 0) {
      unit.statuses.physReflectTurns--;
      const expired = unit.statuses.physReflectTurns === 0;
      if (expired) {
        unit.statuses.physReflectPct = 0;
        unit.statuses.onHitOffenseDebuffTurns = 0;
        unit.statuses.onHitOffenseDebuffValue = 0;
        unit.statuses.onHitOffenseDebuffMode = "";
      }
      return { expired };
    }
    return {};
  },

  counter: (unit) => {
    if (unit.statuses.counterTurns > 0) {
      unit.statuses.counterTurns--;
      return { expired: unit.statuses.counterTurns === 0 };
    }
    return {};
  },

  protecting: (unit) => {
    if (unit.statuses.isProtecting > 0) {
      unit.statuses.isProtecting--;
      return { expired: unit.statuses.isProtecting === 0 };
    }
    return {};
  },

  // Heal over time
  hot: (unit) => {
    if ((unit.statuses.hotTurns ?? 0) > 0) {
      const healed = unit.statuses.hotAmount ?? 0;
      unit.statuses.hotTurns--;
      const expired = unit.statuses.hotTurns === 0;
      if (expired) {
        unit.statuses.hotAmount = 0;
      }
      return { healed, expired };
    }
    return {};
  },

  bloodHunt: (unit) => {
    if ((unit.statuses.bloodHuntTurns ?? 0) > 0) {
      unit.statuses.bloodHuntTurns--;
      const expired = unit.statuses.bloodHuntTurns === 0;
      if (expired) {
        unit.statuses.bloodHuntStacks = 0;
        unit.statuses.bloodHuntAntiHeal = 0;
      }
      return { expired };
    }
    return {};
  },

  berserk: (unit) => {
    if ((unit.statuses.berserkTurns ?? 0) > 0) {
      unit.statuses.berserkTurns--;
      const expired = unit.statuses.berserkTurns === 0;
      if (expired) {
        unit.statuses.berserkLifestealPct = 0;
        unit.statuses.berserkNextBasicMultiplier = 0;
        unit.statuses.berserkKillRageGain = 0;
        unit.statuses.berserkKillExtendTurns = 0;
        unit.statuses.berserkKillChainBasic = 0;
      }
      return { expired };
    }
    return {};
  },

  soulLink: (unit) => {
    if ((unit.statuses.soulLinkTurns ?? 0) > 0) {
      unit.statuses.soulLinkTurns--;
      const expired = unit.statuses.soulLinkTurns === 0;
      if (expired) {
        unit.statuses.soulLinkId = null;
        unit.statuses.soulLinkHealMultiplier = 0;
        unit.statuses.soulLinkShieldPct = 0;
        unit.statuses.soulLinkCleanseCount = 0;
        unit.statuses.soulLinkRageGain = 0;
      }
      return { expired };
    }
    return {};
  },

  pangolinShield: (unit) => {
    if ((unit.statuses.pangolinShieldTurns ?? 0) > 0) {
      unit.statuses.pangolinShieldTurns--;
      const expired = unit.statuses.pangolinShieldTurns === 0;
      if (expired) {
        const shieldStillUp = Number(unit.shield ?? 0) > 0;
        const healPct = Math.max(0, Number(unit.statuses.pangolinShieldExpireHealPct ?? 0) || 0);
        const damageReductionPct = Math.max(0, Number(unit.statuses.pangolinShieldExpireDamageReductionPct ?? 0) || 0);
        const damageReductionTurns = Math.max(0, Number(unit.statuses.pangolinShieldExpireDamageReductionTurns ?? 0) || 0);
        const cleanseCount = Math.max(0, Number(unit.statuses.pangolinShieldExpireCleanseCount ?? 0) || 0);
        if (shieldStillUp && damageReductionPct > 0 && damageReductionTurns > 0) {
          unit.statuses.damageReductionTurns = Math.max(unit.statuses.damageReductionTurns ?? 0, damageReductionTurns);
          unit.statuses.damageReductionPct = Math.max(unit.statuses.damageReductionPct ?? 0, damageReductionPct);
        }
        if (shieldStillUp && cleanseCount > 0) {
          cleanseOrderedDebuffs(unit, cleanseCount);
        }
        unit.statuses.pangolinShieldExpireHealPct = 0;
        unit.statuses.pangolinShieldExpireDamageReductionPct = 0;
        unit.statuses.pangolinShieldExpireDamageReductionTurns = 0;
        unit.statuses.pangolinShieldExpireCleanseCount = 0;
        if (shieldStillUp && healPct > 0) {
          return { expired, healed: Math.round((Number(unit.maxHp ?? 0) || 0) * healPct) };
        }
      }
      return { expired };
    }
    return {};
  },

  guardian: (unit) => {
    if ((unit.statuses.guardianTurns ?? 0) > 0) {
      unit.statuses.guardianTurns--;
      const expired = unit.statuses.guardianTurns === 0;
      if (expired) {
        unit.statuses.guardianId = null;
        unit.statuses.guardianAbsorb = 0;
        unit.statuses.guardianRedirectCharges = 0;
        unit.statuses.guardianCounterOffenseDebuffTurns = 0;
        unit.statuses.guardianCounterOffenseDebuffValue = 0;
        unit.statuses.guardianCounterOffenseDebuffMode = "";
      }
      return { expired };
    }
    return {};
  },

  damageReduction: (unit) => {
    if ((unit.statuses.damageReductionTurns ?? 0) > 0) {
      unit.statuses.damageReductionTurns--;
      const expired = unit.statuses.damageReductionTurns === 0;
      if (expired) unit.statuses.damageReductionPct = 0;
      return { expired };
    }
    return {};
  },

  magicDamageReduction: (unit) => {
    if ((unit.statuses.magicDamageReductionTurns ?? 0) > 0) {
      unit.statuses.magicDamageReductionTurns--;
      const expired = unit.statuses.magicDamageReductionTurns === 0;
      if (expired) unit.statuses.magicDamageReductionPct = 0;
      return { expired };
    }
    return {};
  },

  fortifyReduction: (unit) => {
    if ((unit.statuses.fortifyReduceTurns ?? 0) > 0) {
      unit.statuses.fortifyReduceTurns--;
      const expired = unit.statuses.fortifyReduceTurns === 0;
      if (expired) unit.statuses.fortifyReducePct = 0;
      return { expired };
    }
    return {};
  },

  resilientShield: (unit) => {
    if ((unit.statuses.resilientShieldTurns ?? 0) > 0) {
      unit.statuses.resilientShieldTurns--;
      const expired = unit.statuses.resilientShieldTurns === 0;
      let healed = 0;
      if (expired) {
        if ((unit.shield ?? 0) > 0 && (unit.statuses.resilientShieldHealPct ?? 0) > 0) {
          healed = Math.round((unit.maxHp ?? 0) * unit.statuses.resilientShieldHealPct);
        }
        if ((unit.statuses.resilientShieldHotTurns ?? 0) > 0 && (unit.statuses.resilientShieldHotPct ?? 0) > 0) {
          unit.statuses.hotTurns = Math.max(unit.statuses.hotTurns ?? 0, unit.statuses.resilientShieldHotTurns);
          unit.statuses.hotAmount = Math.max(unit.statuses.hotAmount ?? 0, Math.round((unit.maxHp ?? 0) * unit.statuses.resilientShieldHotPct));
        }
        unit.statuses.resilientShieldHealPct = 0;
        unit.statuses.resilientShieldHotTurns = 0;
        unit.statuses.resilientShieldHotPct = 0;
      }
      return { expired, healed };
    }
    return {};
  }
};

/**
 * Get all supported status effect types
 */
export function getSupportedStatusTypes(): string[] {
  return Object.keys(APPLY_HANDLERS);
}

export function isStatusTypeSupported(type: unknown): type is string {
  return typeof type === "string" && type in APPLY_HANDLERS;
}
