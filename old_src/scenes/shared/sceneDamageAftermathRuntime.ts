import Phaser from "phaser";
import {
  clearSharedLowHpAccent,
  forEachSharedUnitVisual,
  stabilizeSharedDeathPose,
  syncSharedUnitVisualCount
} from "../../visuals/sceneVisualPolish.js";
import { applyOffenseDebuffStatus } from "../../core/offenseDebuff.js";

type AnyObj = Record<string, unknown>;

interface AftermathUnitStatuses extends Record<string, unknown> {
  burnTurns?: number;
  burnDamage?: number;
  poisonTurns?: number;
  poisonDamage?: number;
  reflectTurns?: number;
  reflectPct?: number;
  physReflectTurns?: number;
  physReflectPct?: number;
  onHitOffenseDebuffTurns?: number;
  onHitOffenseDebuffValue?: number;
  onHitOffenseDebuffMode?: string;
  counterTurns?: number;
  phoenixRevive?: unknown;
  phoenixUsed?: unknown;
  phoenixReviveHpPct?: number;
  silence?: number;
  berserkTurns?: number;
  berserkLifestealPct?: number;
  berserkKillRageGain?: number;
  berserkKillExtendTurns?: number;
  berserkKillChainBasic?: number;
  atkBuffTurns?: number;
}

interface AftermathUnit extends AnyObj {
  uid?: string | number;
  alive?: boolean;
  baseId?: string;
  classType?: string;
  side?: string;
  row?: number;
  col?: number;
  range?: number;
  rage?: number;
  rageMax?: number;
  skillId?: string;
  hp?: number;
  maxHp?: number;
  shield?: number;
  sprite?: { x?: number; y?: number } | null;
  icon?: (AnyObj & { __stopLowHp?: () => void }) | null;
  statuses?: AftermathUnitStatuses;
  mods?: Record<string, unknown>;
  environmentMods?: Record<string, unknown>;
  _isAutoCastingTankSkill?: boolean;
  _isAutoCastingSupportSkill?: boolean;
}

interface AftermathSkill extends AnyObj {
  id?: string;
  name?: string;
}

interface VisualModuleLike {
  playDeathAnimation?: (scene: AnyObj, icon: unknown, unit: AnyObj) => void;
  playLowHpAnimation?: (scene: AnyObj, icon: unknown) => void;
}

interface AftermathScene extends AnyObj {
  resolveDamage: (
    attacker: AnyObj | null | undefined,
    defender: AnyObj | null | undefined,
    damage: number,
    damageType: string,
    reason: string,
    options?: AnyObj
  ) => unknown;
  showFloatingText?: (x: number, y: number, text: string, color: string) => void;
  getCombatUnits?: (side: string) => AnyObj[] | null | undefined;
  basicAttack?: (attacker: AnyObj, target: AnyObj) => Promise<void> | void;
  time: {
    delayedCall: (delay: number, callback: () => void) => unknown;
  };
}

interface AftermathHooks {
  canAttackerGainRage?: (args: { attacker: AftermathUnit | null | undefined; options: AnyObj; damageLeft: number }) => boolean;
  getAttackerRageGain?: (attacker: AftermathUnit | null | undefined) => number;
  scheduleTankAutoCast?: (defender: AftermathUnit | null | undefined, attacker: AftermathUnit | null | undefined) => unknown;
  scheduleSupportAutoCast?: (attacker: AftermathUnit | null | undefined, defender: AftermathUnit | null | undefined) => unknown;
  onCounterAttack?: (args: { attacker: AftermathUnit | null | undefined; defender: AftermathUnit | null | undefined }) => void;
  onLifestealHeal?: (args: { attacker: AftermathUnit | null | undefined; heal: number }) => void;
  onAfterStateSync?: (args: { attacker: AftermathUnit | null | undefined; defender: AftermathUnit | null | undefined; reason: string }) => void;
  getVisualModule?: (baseId: string | number | undefined) => VisualModuleLike | null | undefined;
  applyDeathPalette?: (defender: AftermathUnit | null | undefined) => void;
  onDefaultDeathEffect?: (defender: AftermathUnit | null | undefined) => void;
  onDeathResolved?: (args: { attacker: AftermathUnit | null | undefined; defender: AftermathUnit | null | undefined }) => void;
  onLowHpResolved?: (defender: AftermathUnit | null | undefined) => void;
  getSkillById?: (skillId: string | undefined, actingUnit: AftermathUnit | null | undefined) => AftermathSkill | null | undefined;
  selectTarget?: (actingUnit: AftermathUnit) => AftermathUnit | null | undefined;
  onBeforeAutoCast?: (args: { tank?: AftermathUnit | null | undefined; support?: AftermathUnit | null | undefined; target: AftermathUnit | null | undefined; skill: AftermathSkill | null | undefined }) => void;
  castSkill?: (actingUnit: AftermathUnit, target: AftermathUnit, options: AnyObj) => Promise<unknown> | unknown;
  onAutoCastError?: (error: unknown) => void;
  onAfterAutoCast?: (actingUnit: AftermathUnit) => void;
}

type AftermathStatusAccessor = (statuses: AftermathUnitStatuses) => unknown;

function readStatusNumber(unit: AftermathUnit, accessor: AftermathStatusAccessor): number {
  if (!unit.statuses) return 0;
  return Number(accessor(unit.statuses)) || 0;
}

function readStatusValue(unit: AftermathUnit, accessor: AftermathStatusAccessor): unknown {
  if (!unit.statuses) return undefined;
  return accessor(unit.statuses);
}

function applySharedDeathState(
  scene: AftermathScene,
  defender: AftermathUnit,
  attacker: AftermathUnit | null | undefined,
  hooks: AftermathHooks
) {
  defender.alive = false;
  defender.hp = 0;
  defender.shield = 0;
  hooks.applyDeathPalette?.(defender);
  defender.icon?.__stopLowHp?.();
  clearSharedLowHpAccent(defender as unknown as Parameters<typeof clearSharedLowHpAccent>[0]);

  const deathVisual = hooks.getVisualModule?.(defender.baseId);
  if (deathVisual?.playDeathAnimation && defender.icon) {
    forEachSharedUnitVisual(defender, (icon) => deathVisual.playDeathAnimation?.(scene, icon, defender));
  } else {
    hooks.onDefaultDeathEffect?.(defender);
  }
  syncSharedUnitVisualCount(defender, { combat: true });
  stabilizeSharedDeathPose(scene as unknown as Phaser.Scene, defender);
  hooks.onDeathResolved?.({ attacker, defender });
}

function applySharedLowHpState(scene: AftermathScene, defender: AftermathUnit, hooks: AftermathHooks) {
  const lowHpVisual = hooks.getVisualModule?.(defender.baseId);
  if (lowHpVisual?.playLowHpAnimation && defender.icon) {
    forEachSharedUnitVisual(defender, (icon) => lowHpVisual.playLowHpAnimation?.(scene, icon));
  }
  syncSharedUnitVisualCount(defender, { combat: true });
  hooks.onLowHpResolved?.(defender);
}

export function applySharedDamageAftermath(
  scene: AftermathScene,
  context: {
    attacker: AftermathUnit | null | undefined;
    defender: AftermathUnit;
    damageLeft: number;
    damageType: string;
    reason: string;
    attackKind?: string;
    options?: AnyObj;
  },
  hooks: AftermathHooks = {}
) {
  const {
    attacker,
    defender,
    damageLeft,
    damageType,
    reason,
    attackKind = "basic",
    options = {}
  } = context;

  const attackerCanGainRage =
    attacker
    && !options.noRage
    && damageLeft > 0
    && (hooks.canAttackerGainRage?.({ attacker, options, damageLeft }) ?? true);
  if (attackerCanGainRage) {
    const gain = hooks.getAttackerRageGain?.(attacker) ?? 1;
    attacker.rage = Math.min(attacker.rageMax || 5, (attacker.rage || 0) + gain);
  }

  if (!options.noRage) {
    defender.rage = Math.min(defender.rageMax || 5, (defender.rage || 0) + 1);
  }

  if (!options.noAutoCast) {
    hooks.scheduleTankAutoCast?.(defender, attacker);
    if (attackKind === "basic") {
      hooks.scheduleSupportAutoCast?.(attacker, defender);
    }
  }

  const attackerBurnOnHit =
    (Number(attacker?.mods?.burnOnHit) || 0)
    + (Number(attacker?.environmentMods?.burnOnHit) || 0);
  const attackerPoisonOnHit =
    (Number(attacker?.mods?.poisonOnHit) || 0)
    + (Number(attacker?.environmentMods?.poisonOnHit) || 0);
  const attackerLifestealPct =
    (Number(attacker?.mods?.lifestealPct) || 0)
    + (Number(attacker?.environmentMods?.lifestealPct) || 0)
    + (((Number(attacker?.statuses?.berserkTurns) || 0) > 0) ? (Number(attacker?.statuses?.berserkLifestealPct) || 0) : 0);

  if (attacker && attackerBurnOnHit > 0 && defender.alive && defender.statuses) {
    defender.statuses.burnTurns = Math.max(defender.statuses.burnTurns ?? 0, 2);
    defender.statuses.burnDamage = Math.max(defender.statuses.burnDamage ?? 0, attackerBurnOnHit);
  }
  if (attacker && attackerPoisonOnHit > 0 && defender.alive && defender.statuses) {
    defender.statuses.poisonTurns = Math.max(defender.statuses.poisonTurns ?? 0, 2);
    defender.statuses.poisonDamage = Math.max(defender.statuses.poisonDamage ?? 0, attackerPoisonOnHit);
  }

  if (attacker && !options.noReflect && attacker.alive && defender.statuses) {
    const reflectTurns = Number(defender.statuses.reflectTurns) || 0;
    const reflectPct = Number(defender.statuses.reflectPct) || 0;
    if (reflectTurns > 0 && reflectPct > 0) {
      const reflected = Math.max(1, Math.round(damageLeft * reflectPct));
      scene.resolveDamage(defender, attacker, reflected, "true", "PHẢN ĐÒN", {
        noReflect: true,
        forceHit: true
      });
    } else if (damageType === "physical") {
      const physTurns = Number(defender.statuses.physReflectTurns) || 0;
      if (physTurns > 0) {
        const physPct = Number(defender.statuses.physReflectPct) || 0;
        const pct = physPct > 0 ? physPct : 1;
        const reflected = Math.max(1, Math.round(damageLeft * pct));
        scene.resolveDamage(defender, attacker, reflected, "true", "VẢY PHẢN", {
          noReflect: true,
          forceHit: true
        });
      }
    }
  }

  if (
    attacker
    && attacker.alive
    && defender.alive
    && damageLeft > 0
    && (Number(defender.statuses?.onHitOffenseDebuffValue ?? 0) || 0) > 0
    && (
      (Number(defender.statuses?.physReflectTurns ?? 0) || 0) > 0
      || (Number(defender.statuses?.reflectTurns ?? 0) || 0) > 0
    )
  ) {
    applyOffenseDebuffStatus(attacker as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
      turns: Number(defender.statuses?.onHitOffenseDebuffTurns ?? 0) || 0,
      value: Number(defender.statuses?.onHitOffenseDebuffValue ?? 0) || 0,
      mode: (typeof defender.statuses?.onHitOffenseDebuffMode === "string" && defender.statuses.onHitOffenseDebuffMode) || "autoByRole"
    });
  }

  if (attacker && !options.noCounter && attacker.alive && defender.alive) {
    const attackerRange = Number(attacker.range) || 0;
    const counterTurns = Number(defender.statuses?.counterTurns) || 0;
    if (attackerRange <= 1 && counterTurns > 0) {
      hooks.onCounterAttack?.({ attacker, defender });
    }
  }

  if (attacker && attackerLifestealPct > 0 && damageLeft > 0) {
    const heal = Math.round(damageLeft * attackerLifestealPct);
    if (heal > 0) hooks.onLifestealHeal?.({ attacker, heal });
  }

  const defenderHp = defender.hp ?? NaN;
  const defenderMaxHp = defender.maxHp ?? NaN;
  if (
    defenderHp <= 0
    && defender.alive
    && defender.statuses?.phoenixRevive
    && !defender.statuses?.phoenixUsed
  ) {
    const reviveHpPct = Math.max(0.01, Math.min(1, Number(defender.statuses?.phoenixReviveHpPct || 0.3) || 0.3));
    defender.hp = Math.max(1, Math.round((Number(defender.maxHp ?? 0) || 0) * reviveHpPct));
    defender.shield = 0;
    defender.statuses.phoenixRevive = false;
    defender.statuses.phoenixUsed = true;
    scene.showFloatingText?.(defender.sprite?.x ?? 0, (defender.sprite?.y ?? 0) - 45, "TÁI SINH", "#ff9a36");
  } else if (defenderHp <= 0) {
    applySharedDeathState(scene, defender, attacker, hooks);
  } else if (defender.alive && defenderHp <= defenderMaxHp * 0.3) {
    applySharedLowHpState(scene, defender, hooks);
  }

  const berserkTurns = Math.max(0, Number(attacker?.statuses?.berserkTurns ?? 0) || 0);
  if (
    attacker
    && attacker.alive
    && attackKind === "basic"
    && berserkTurns > 0
    && !defender.alive
  ) {
    const rageGainOnKill = Math.max(0, Math.round(Number(attacker.statuses?.berserkKillRageGain ?? 0) || 0));
    const extendTurns = Math.max(0, Math.round(Number(attacker.statuses?.berserkKillExtendTurns ?? 0) || 0));
    const chainBasicOnKill = Math.max(0, Math.round(Number(attacker.statuses?.berserkKillChainBasic ?? 0) || 0));

    if (extendTurns > 0 && attacker.statuses) {
      const updatedBerserkTurns = berserkTurns + extendTurns;
      attacker.statuses.berserkTurns = updatedBerserkTurns;
      attacker.statuses.atkBuffTurns = Math.max(
        Number(attacker.statuses?.atkBuffTurns ?? 0) || 0,
        updatedBerserkTurns
      );
    }
    if (rageGainOnKill > 0) {
      attacker.rage = Math.min(attacker.rageMax || 5, (attacker.rage || 0) + rageGainOnKill);
    }
    if ((extendTurns > 0 || rageGainOnKill > 0) && scene?.showFloatingText) {
      const bonuses: string[] = [];
      if (rageGainOnKill > 0) bonuses.push(`+${rageGainOnKill} NỘ`);
      if (extendTurns > 0) bonuses.push(`+${extendTurns} LƯỢT`);
      scene.showFloatingText(attacker.sprite?.x ?? 0, (attacker.sprite?.y ?? 0) - 72, bonuses.join(" • "), "#ffcf8f");
    }
    if (chainBasicOnKill > 0 && typeof scene?.getCombatUnits === "function" && typeof scene?.basicAttack === "function") {
      const enemySide = attacker.side === "LEFT" ? "RIGHT" : "LEFT";
      const followTarget = (scene.getCombatUnits(enemySide) || [])
        .filter((unit): unit is AftermathUnit => Boolean(unit?.alive))
        .sort((a, b) => {
          const aRow = Number(a.row) || 0;
          const aCol = Number(a.col) || 0;
          const bRow = Number(b.row) || 0;
          const bCol = Number(b.col) || 0;
          const attackerRow = Number(attacker.row) || 0;
          const attackerCol = Number(attacker.col) || 0;
          return (Math.abs(attackerRow - aRow) + Math.abs(attackerCol - aCol))
            - (Math.abs(attackerRow - bRow) + Math.abs(attackerCol - bCol));
        })[0];
      if (followTarget) {
        const runFollowup = async () => {
          if (!attacker?.alive || !followTarget?.alive) return;
          await scene.basicAttack?.(attacker, followTarget);
        };
        if (scene?.time?.delayedCall) scene.time.delayedCall(0, runFollowup);
        else void runFollowup();
      }
    }
  }

  hooks.onAfterStateSync?.({ attacker, defender, reason });
  return damageLeft;
}

export function scheduleSharedTankAutoCast(
  scene: AftermathScene,
  tank: AftermathUnit | null | undefined,
  preferredTarget: AftermathUnit | null = null,
  hooks: AftermathHooks = {}
) {
  if (!tank?.alive) return false;
  if (tank.classType !== "TANKER") return false;
  if ((Number(tank.statuses?.silence) || 0) > 0) return false;
  const tankRage = Number(tank.rage);
  const tankRageMax = Number(tank.rageMax);
  if (!Number.isFinite(tankRage) || !Number.isFinite(tankRageMax) || tankRage < tankRageMax) return false;
  if (tank._isAutoCastingTankSkill) return false;

  const skill = hooks.getSkillById?.(tank.skillId, tank);
  if (!skill) return false;

  const selectTarget = hooks.selectTarget ?? (() => null);
  const fallbackTarget = preferredTarget?.alive ? preferredTarget : selectTarget(tank);
  if (!fallbackTarget) return false;

  tank._isAutoCastingTankSkill = true;
  scene.time.delayedCall(0, async () => {
    try {
      if (!tank.alive || (Number(tank.statuses?.silence) || 0) > 0) return;
      const currentRage = Number(tank.rage);
      const currentRageMax = Number(tank.rageMax);
      if (currentRage < currentRageMax) return;
      const target = preferredTarget?.alive ? preferredTarget : selectTarget(tank);
      if (!target) return;

      tank.rage = 0;
      hooks.onBeforeAutoCast?.({ tank, target, skill });
      await hooks.castSkill?.(tank, target || tank, { consumeRage: false, trigger: "tank_auto" });
    } catch (error) {
      hooks.onAutoCastError?.(error);
    } finally {
      tank._isAutoCastingTankSkill = false;
      hooks.onAfterAutoCast?.(tank);
    }
  });
  return true;
}

export function scheduleSharedSupportAutoCast(
  scene: AftermathScene,
  support: AftermathUnit | null | undefined,
  preferredTarget: AftermathUnit | null = null,
  hooks: AftermathHooks = {}
) {
  if (!support?.alive) return false;
  if (support.classType !== "SUPPORT") return false;
  if ((Number(support.statuses?.silence) || 0) > 0) return false;
  const supportRage = Number(support.rage);
  const supportRageMax = Number(support.rageMax);
  if (!Number.isFinite(supportRage) || !Number.isFinite(supportRageMax) || supportRage < supportRageMax) return false;
  if (support._isAutoCastingSupportSkill) return false;

  const skill = hooks.getSkillById?.(support.skillId, support);
  if (!skill) return false;

  const selectTarget = hooks.selectTarget ?? (() => null);
  support._isAutoCastingSupportSkill = true;
  scene.time.delayedCall(0, async () => {
    try {
      if (!support.alive || (Number(support.statuses?.silence) || 0) > 0) return;
      const currentRage = Number(support.rage);
      const currentRageMax = Number(support.rageMax);
      if (currentRage < currentRageMax) return;
      const target = preferredTarget?.alive ? preferredTarget : selectTarget(support) ?? support;
      if (!target) return;

      support.rage = 0;
      hooks.onBeforeAutoCast?.({ support, target, skill });
      await hooks.castSkill?.(support, target, { consumeRage: false, trigger: "support_auto" });
    } catch (error) {
      hooks.onAutoCastError?.(error);
    } finally {
      support._isAutoCastingSupportSkill = false;
      hooks.onAfterAutoCast?.(support);
    }
  });
  return true;
}
