import Phaser from "phaser";
import { getStarDotDamage, getStarTurns, manhattan } from "../../core/gameUtils.js";
import { applyOffenseDebuffStatus } from "../../core/offenseDebuff.js";
import {
  findSharedKnockbackPosition,
  showCommonSkillText,
  syncCommonSkillLabels,
  updateCommonSkillUnit
} from "./sceneCommonSkillEffectUtils.js";
import {
  buildSkillSelectionOptions,
  collectUnitsInForwardCone,
  collectUnitsBySelector,
  collectUnitsInAoeSquare,
  collectUnitsInSameRow,
  type SkillTargetUnit
} from "./sceneSkillTargeting.js";

interface SkillOpts {
  isSplash?: boolean;
  armorPen?: number;
  [key: string]: unknown;
}
interface CombatUnit {
  uid?: string | number;
  side?: "LEFT" | "RIGHT";
  alive?: boolean;
  hp?: number;
  maxHp?: number;
  shield?: number;
  rage?: number;
  rageMax?: number;
  atk?: number;
  matk?: number;
  def?: number;
  classType?: string;
  row: number;
  col: number;
  homeCol?: number;
  range?: number;
  sprite?: { x: number; y: number };
  statuses: {
    stun?: number;
    freeze?: number;
    sleep?: number;
    silence?: number;
    poisonTurns?: number;
    poisonDamage?: number;
    bleedTurns?: number;
    bleedDamage?: number;
    burnTurns?: number;
    burnDamage?: number;
    diseaseTurns?: number;
    diseaseDamage?: number;
    armorBreakTurns?: number;
    armorBreakValue?: number;
    shieldLockTurns?: number;
    shieldLockSourceId?: string | number;
    atkBuffTurns?: number;
    atkBuffValue?: number;
    healReductionTurns?: number;
    healReductionPct?: number;
    healBlockTurns?: number;
    disarmTurns?: number;
    offenseDebuffTurns?: number;
    offenseDebuffValue?: number;
    [key: string]: number | string | undefined;
  };
  mods?: { accuracyPct?: number; evadePct?: number; [key: string]: number | undefined };
  [key: string]: unknown;
}

interface CombatSkill {
  effect: string;
  name?: string;
  damageType?: string;
  damageScope?: string;
  targetSelector?: string;
  stunSelector?: string;
  debuffTargetSelector?: string;
  freezeTargetSelector?: string;
  freezeBonusTargetSelector?: string;
  spreadTargetSelector?: string;
  stunChance?: number;
  stunTurns?: number;
  stunMaxTargets?: number;
  debuffMaxTargets?: number;
  freezeChance?: number;
  freezeTurns?: number;
  freezeBaseTargets?: number;
  freezeMaxTargets?: number;
  freezeBonusIfRangedCount?: number;
  sleepChance?: number;
  sleepTurns?: number;
  silenceChance?: number;
  silenceTurns?: number;
  accuracyDebuffPct?: number;
  accuracyDebuffTurns?: number;
  offenseDebuffValue?: number;
  atkDebuffValue?: number;
  offenseDebuffPct?: number;
  offenseDebuffMode?: string;
  offenseDebuffTurns?: number;
  bleedTurns?: number;
  turns?: number;
  bleedDamage?: number;
  bleedSplashCount?: number;
  bleedSplashDamageMultiplier?: number;
  bleedSplashTurns?: number;
  bleedSplashDamage?: number;
  bleedBonusPctVsTankOrShielded?: number;
  tankShieldBleedBonusPct?: number;
  shieldLockTurns?: number;
  aoeRadius?: number;
  poisonTurns?: number;
  poisonPerTurn?: number;
  poisonSplashCount?: number;
  poisonSplashDamageMultiplier?: number;
  poisonSplashTurns?: number;
  poisonSplashDamage?: number;
  poisonSplashTriggerHpPct?: number;
  rageDrainOnHit?: number;
  rageDrain?: number;
  rageDrainPreferred?: number;
  rageGainOnKill?: number;
  rageGainOnSpreadTrigger?: number;
  armorBreakTurns?: number;
  armorBreak?: number;
  armorBreakValue?: number;
  armorPenVsTankOrShielded?: number;
  knockbackDistance?: number;
  knockbackBonusPct?: number;
  piercePct?: number;
  pierceLabel?: string;
  splashCount?: number;
  splashDamageMultiplier?: number;
  splashNearestCount?: number;
  splashArmorBreakValue?: number;
  splashArmorBreakTurns?: number;
  splashSameRowOnly?: boolean;
  splashBehindCount?: number;
  maxTargets?: number;
  rowLeadDamageMultiplier?: number;
  applyArmorBreakToRow?: boolean;
  burnChance?: number;
  burnTurns?: number;
  burnPerTurn?: number;
  diseaseTurns?: number;
  diseaseDamage?: number;
  spreadDiseaseCount?: number;
  spreadDiseaseDamage?: number;
  spreadDiseaseTurns?: number;
  spreadIfTargetHpPctBelow?: number;
  healReductionTurns?: number;
  healReductionPct?: number;
  healBlockTurns?: number;
  lifesteal?: number;
  bonusVsClasses?: string[];
  bonusDamageMultiplier?: number;
  antiShieldBonusTurns?: number;
  disableStarTurnScaling?: boolean;
  disableChanceScaling?: boolean;
  disableGoldScaling?: boolean;
  runtimeShapeVersion?: number;
  allyRowAtkBuff?: number;
  preferClasses?: string[];
  targetClasses?: string[];
  excludeTargetClasses?: string[];
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  requireDebuffed?: boolean;
  requireShielded?: boolean;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferDebuffed?: boolean;
  preferShielded?: boolean;
  preferHighRage?: boolean;
  evadeDebuffPct?: number;
  healTargetSelector?: string;
  healPctMaxHp?: number;
  [key: string]: unknown;
}

interface CommonSkillSceneLike extends Phaser.Scene {
  rollChance?: (chance: number) => boolean;
  pickRandom?: <T>(list: T[]) => T;
  random?: () => number;
  distanceToFrontline: (unit: CombatUnit) => number;
  resolveDamage: (
    attacker: CombatUnit,
    target: CombatUnit,
    amount: number,
    damageType: string,
    label: string,
    opts?: SkillOpts
  ) => number;
  getCombatUnits: (side: "LEFT" | "RIGHT") => CombatUnit[];
  getEffectiveAtk: (unit: SkillTargetUnit) => number;
  getEffectiveDef: (unit: SkillTargetUnit) => number;
  getEffectiveMatk: (unit: SkillTargetUnit) => number;
  gridToScreen: (col: number, row: number) => { x: number; y: number };
  tweenCombatUnit: (unit: CombatUnit, x: number, y: number, duration: number) => Promise<void>;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  healUnit: (healer: CombatUnit, target: CombatUnit, amount: number, label: string) => void;
  getStarSkillMultiplier: (star: number) => number;
  updateCombatUnitUi: (unit: unknown) => void;
  [key: string]: unknown;
}

interface CombatSkillContext {
  attacker: CombatUnit;
  target: CombatUnit;
  skill: CombatSkill;
  rawSkill: number;
  skillOpts?: SkillOpts;
  enemies: CombatUnit[];
  star: number;
  starScale: number;
  goldMultiplier: number;
  starChanceMult?: number;
  areaBonus?: number;
  targetBonus?: number;
}

function selectCombatTargets(
  scene: CommonSkillSceneLike,
  attacker: CombatUnit,
  target: CombatUnit,
  skill: CombatSkill,
  enemies: CombatUnit[],
  count: number,
  selector: string | null = null
): CombatUnit[] {
  return collectUnitsBySelector(
    enemies,
    selector || skill?.debuffTargetSelector || skill?.stunSelector || skill?.targetSelector || "random",
    count,
    buildSkillSelectionOptions(scene, attacker, target, skill)
  ) as CombatUnit[];
}

function rollChance(scene: CommonSkillSceneLike | null | undefined, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function pickRandom<T extends CombatUnit>(scene: CommonSkillSceneLike | null | undefined, list: T[] = []): T | null {
  return scene?.pickRandom?.(list) ?? list[Math.floor((scene?.random?.bind(scene) ?? Math.random)() * list.length)] ?? null;
}

function resolveChanceMultiplier(skill: CombatSkill | null | undefined, starChanceMult: number = 1, goldMultiplier: number = 1): number {
  let multiplier = 1;
  if (!skill?.disableChanceScaling) multiplier *= starChanceMult;
  if (!skill?.disableGoldScaling) multiplier *= goldMultiplier;
  return multiplier;
}

function resolveScaledChance(skill: CombatSkill | null | undefined, baseChance: number | undefined, starChanceMult: number = 1, goldMultiplier: number = 1): number {
  const numericChance = Number(baseChance ?? 0) || 0;
  return Math.min(1, numericChance * resolveChanceMultiplier(skill, starChanceMult, goldMultiplier));
}

function resolveCombatOffenseDebuffAmount(scene: CommonSkillSceneLike, enemy: CombatUnit, skill: CombatSkill): number {
  const flatValue = Math.max(0, Math.round(Number(skill?.offenseDebuffValue ?? skill?.atkDebuffValue ?? 0) || 0));
  if (flatValue > 0) return flatValue;
  const debuffPct = Number(skill?.offenseDebuffPct ?? 0) || 0;
  if (debuffPct <= 0) return 0;
  const mode = String(skill?.offenseDebuffMode ?? "autoByRole").trim().toLowerCase();
  const useMatk = mode === "matk"
    || (mode !== "atk" && ["MAGE", "SUPPORT"].includes(String(enemy?.classType ?? "").trim().toUpperCase()));
  const basis = useMatk
    ? (scene.getEffectiveMatk?.(enemy) ?? enemy?.matk ?? 0)
    : (scene.getEffectiveAtk?.(enemy) ?? enemy?.atk ?? 0);
  return Math.max(0, Math.round((Number(basis) || 0) * debuffPct));
}

export async function applySharedCommonCombatSkillEffect(scene: CommonSkillSceneLike, context: CombatSkillContext): Promise<boolean> {
  const {
    attacker,
    target,
    skill,
    rawSkill,
    skillOpts,
    enemies,
    star,
    starScale,
    goldMultiplier,
    starChanceMult = 1,
    areaBonus = 0,
    targetBonus = 0
  } = context;

  switch (skill.effect) {
    case "global_stun": {
      const damageTargets = skill.damageScope === "frontline"
        ? enemies.filter((enemy) => enemy.alive && scene.distanceToFrontline(enemy) <= 1)
        : enemies;
      damageTargets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      });
      const stunTargets = skill.stunSelector || skill.stunMaxTargets
        ? selectCombatTargets(scene, attacker, target, skill, enemies.filter((enemy) => enemy.alive), skill.stunMaxTargets || enemies.length, skill.stunSelector || "highest_rage")
        : damageTargets.filter((enemy) => enemy.alive);
      const effectiveStunChance = resolveScaledChance(skill, skill.stunChance || 0, starChanceMult, goldMultiplier);
      stunTargets.forEach((enemy) => {
        if (enemy.alive && rollChance(scene, effectiveStunChance)) {
          enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, skill.stunTurns || 1);
          showCommonSkillText(scene, enemy, "CHOÁNG", "#ffd97b");
          updateCommonSkillUnit(scene, enemy);
        }
      });
      if ((skill.allyRowAtkBuff || 0) > 0) {
        scene.getCombatUnits(attacker.side as "LEFT" | "RIGHT")
          .filter((ally) => ally.alive && ally.row === attacker.row)
          .forEach((ally) => {
            ally.statuses.atkBuffTurns = Math.max(ally.statuses.atkBuffTurns || 0, skill.turns || 2);
            ally.statuses.atkBuffValue = Math.max(ally.statuses.atkBuffValue || 0, skill.allyRowAtkBuff as number);
            updateCommonSkillUnit(scene, ally);
          });
      }
      return true;
    }
    case "single_poison_slow": {
      const poisonTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.poisonTurns ?? skill.turns ?? 2) || 2))
        : getStarTurns(star, skill.poisonTurns as number);
      const poisonDamage = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.poisonPerTurn ?? 18) || 18))
        : getStarDotDamage(star, skill.poisonPerTurn as number);
      const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
      const offenseDebuffPct = Math.max(0, Number(skill.offenseDebuffPct ?? 0) || 0);
      const rageDrainOnHit = Math.max(0, Math.round(Number(skill.rageDrainOnHit ?? 0) || 0));
      const armorBreakTurns = Math.max(0, Math.round(Number(skill.armorBreakTurns ?? 0) || 0));
      const armorBreakValue = Math.max(0, Math.round(Number(skill.armorBreakValue ?? 0) || 0));
      const poisonSplashCount = Math.max(0, Math.round(Number(skill.poisonSplashCount ?? 0) || 0));
      const poisonSplashDamageMultiplier = Math.max(0, Number(skill.poisonSplashDamageMultiplier ?? 0) || 0);
      const poisonSplashTurns = Math.max(1, Math.round(Number(skill.poisonSplashTurns ?? poisonTurns) || poisonTurns));
      const poisonSplashDamage = Math.max(1, Math.round(Number(skill.poisonSplashDamage ?? 0) || 0));
      const poisonSplashTriggerHpPct = Math.max(0, Number(skill.poisonSplashTriggerHpPct ?? 0) || 0);
      const isTankOrShielded = target?.classType === "TANKER" || Number(target?.shield ?? 0) > 0;
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive) {
        const targetHpRatio = (target?.maxHp ?? 0) > 0 ? (target.hp ?? 0) / (target.maxHp as number) : 0;
        target.statuses.poisonTurns = Math.max(target.statuses.poisonTurns || 0, poisonTurns);
        target.statuses.poisonDamage = Math.max(target.statuses.poisonDamage || 0, poisonDamage);
        if (isTankOrShielded && offenseDebuffTurns > 0 && offenseDebuffPct > 0) {
          applyOffenseDebuffStatus(target, {
            turns: offenseDebuffTurns,
            value: resolveCombatOffenseDebuffAmount(scene, target, skill) || Math.max(1, Math.round((scene.getEffectiveAtk(target) ?? target?.atk ?? 0) * offenseDebuffPct)),
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          if (rageDrainOnHit > 0) {
            target.rage = Math.max(0, (target.rage || 0) - rageDrainOnHit);
            showCommonSkillText(scene, target, `-${rageDrainOnHit} NỘ`, "#b8f5ff");
          }
        }
        if (armorBreakTurns > 0 && armorBreakValue > 0) {
          target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, armorBreakTurns);
          target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, armorBreakValue);
        }
        updateCommonSkillUnit(scene, target);
        if (target.alive && poisonSplashCount > 0 && poisonSplashDamageMultiplier > 0 && (isTankOrShielded || targetHpRatio <= poisonSplashTriggerHpPct)) {
          const splashTargets = (collectUnitsInAoeSquare(
            enemies,
            target,
            1,
            (enemy: SkillTargetUnit) => enemy.uid !== target.uid
          ) as CombatUnit[])
            .sort((a: CombatUnit, b: CombatUnit) => manhattan(target, a) - manhattan(target, b) || a.row - b.row || a.col - b.col)
            .slice(0, poisonSplashCount);
          splashTargets.forEach((enemy: CombatUnit) => {
            scene.resolveDamage(
              attacker,
              enemy,
              Math.max(1, Math.round(rawSkill * poisonSplashDamageMultiplier)),
              skill.damageType as string,
              skill.name as string,
              { ...skillOpts, isSplash: true }
            );
            if (enemy.alive) {
              enemy.statuses.poisonTurns = Math.max(enemy.statuses.poisonTurns || 0, poisonSplashTurns);
              enemy.statuses.poisonDamage = Math.max(enemy.statuses.poisonDamage || 0, poisonSplashDamage);
              updateCommonSkillUnit(scene, enemy);
            }
          });
        }
      }
      return true;
    }
    case "single_poison_stack": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive) {
        target.statuses.poisonTurns = Math.max(target.statuses.poisonTurns ?? 0, getStarTurns(star, skill.poisonTurns ?? 3));
        target.statuses.poisonDamage =
          (target.statuses.poisonDamage || 0) + getStarDotDamage(star, skill.poisonPerTurn || 15);
        showCommonSkillText(scene, target, "ĐỘC +", "#880088");
        updateCommonSkillUnit(scene, target);
      }
      return true;
    }
    case "aoe_circle_stun": {
      const expandAoe = 1 + areaBonus;
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const aoeCenter: CombatUnit = target?.alive
        ? target
        : aliveEnemies.length > 0
          ? (pickRandom(scene, aliveEnemies) ?? target)
          : target;
      const impacted = enemies
        .filter((enemy) => Math.abs((enemy.row ?? 0) - (aoeCenter.row ?? 0)) <= expandAoe && Math.abs((enemy.col ?? 0) - (aoeCenter.col ?? 0)) <= expandAoe);
      impacted.forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        });
      const stunTargets = Number.isFinite(Number(skill.stunMaxTargets))
        ? impacted.filter((enemy) => enemy.alive).slice(0, skill.stunMaxTargets as number)
        : impacted.filter((enemy) => enemy.alive);
      const effectiveStunChance = resolveScaledChance(skill, skill.stunChance, starChanceMult, goldMultiplier);
      stunTargets.forEach((enemy) => {
        if (rollChance(scene, effectiveStunChance)) {
          enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, skill.stunTurns || 1);
          showCommonSkillText(scene, enemy, "CHOÁNG", "#ffd97b");
          updateCommonSkillUnit(scene, enemy);
        }
      });
      return true;
    }
    case "single_bleed": {
      const bleedTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.bleedTurns ?? skill.turns ?? 3) || 3))
        : getStarTurns(star, skill.turns || 3);
      const baseBleedDamage = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.bleedDamage ?? 0) || 0))
        : Math.round(scene.getEffectiveAtk(attacker) * 0.3 * starScale);
      const bleedBonusPctVsTankOrShielded = Math.max(0, Number(skill.bleedBonusPctVsTankOrShielded ?? skill.tankShieldBleedBonusPct ?? 0) || 0);
      const shieldLockTurns = Math.max(0, Math.round(Number(skill.shieldLockTurns ?? 0) || 0));
      const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
      const offenseDebuffPct = Math.max(0, Number(skill.offenseDebuffPct ?? 0) || 0);
      const splashCount = Math.max(0, Math.round(Number(skill.bleedSplashCount ?? 0) || 0));
      const splashDamageMultiplier = Math.max(0, Number(skill.bleedSplashDamageMultiplier ?? 0) || 0);
      const splashBleedTurns = Math.max(1, Math.round(Number(skill.bleedSplashTurns ?? bleedTurns) || bleedTurns));
      const splashBleedDamage = Math.max(1, Math.round(Number(skill.bleedSplashDamage ?? 0) || 0));
      const isTankOrShielded = target?.classType === "TANKER" || Number(target?.shield ?? 0) > 0;
      const resolvedBleedDamage = isTankOrShielded && bleedBonusPctVsTankOrShielded > 0
        ? Math.max(1, Math.round(baseBleedDamage * (1 + bleedBonusPctVsTankOrShielded)))
        : baseBleedDamage;
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive) {
        target.statuses.bleedTurns = Math.max(target.statuses.bleedTurns || 0, bleedTurns);
        target.statuses.bleedDamage = Math.max(target.statuses.bleedDamage || 0, resolvedBleedDamage);
        if (isTankOrShielded && shieldLockTurns > 0) {
          target.statuses.shieldLockTurns = Math.max(target.statuses.shieldLockTurns || 0, shieldLockTurns);
          target.statuses.shieldLockSourceId = attacker.uid;
        }
        if (offenseDebuffTurns > 0 && offenseDebuffPct > 0) {
          const debuffValue = Math.max(1, Math.round((scene.getEffectiveDef(target) ?? target?.def ?? 0) * offenseDebuffPct));
          target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, offenseDebuffTurns);
          target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, debuffValue);
        }
        showCommonSkillText(scene, target, "CHẢY MÁU", "#ff4444");
        updateCommonSkillUnit(scene, target);
        if (target.alive && splashCount > 0 && splashDamageMultiplier > 0) {
          const splashTargets = (collectUnitsInSameRow(
            enemies,
            target.row as number,
            (enemy: SkillTargetUnit) => enemy.uid !== target.uid
          ) as CombatUnit[])
            .sort((a: CombatUnit, b: CombatUnit) => manhattan(target, a) - manhattan(target, b) || a.col - b.col)
            .slice(0, splashCount);
          splashTargets.forEach((enemy: CombatUnit) => {
            scene.resolveDamage(
              attacker,
              enemy,
              Math.max(1, Math.round(rawSkill * splashDamageMultiplier)),
              skill.damageType as string,
              skill.name as string,
              { ...skillOpts, isSplash: true }
            );
            if (enemy.alive) {
              enemy.statuses.bleedTurns = Math.max(enemy.statuses.bleedTurns || 0, splashBleedTurns);
              enemy.statuses.bleedDamage = Math.max(enemy.statuses.bleedDamage || 0, splashBleedDamage);
              showCommonSkillText(scene, enemy, "CHẢY MÁU", "#ff4444");
              updateCommonSkillUnit(scene, enemy);
            }
          });
        }
      }
      return true;
    }
    case "global_debuff_atk": {
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      aliveEnemies.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      });
      const targets = skill.debuffTargetSelector || skill.debuffMaxTargets || (skill.accuracyDebuffPct || 0) > 0 || (skill.silenceChance || 0) > 0
        ? selectCombatTargets(scene, attacker, target, skill, aliveEnemies, skill.debuffMaxTargets || aliveEnemies.length, skill.debuffTargetSelector || "highest_atk")
        : aliveEnemies;
      targets.forEach((enemy) => {
        if (!enemy.alive) return;
        const accuracyDebuffPct = Math.max(0, Number(skill.accuracyDebuffPct ?? 0) || 0);
        const accuracyDebuffTurns = Math.max(0, Math.round(Number(skill.accuracyDebuffTurns ?? skill.turns ?? 0) || 0));
        const offenseDebuffAmount = resolveCombatOffenseDebuffAmount(scene, enemy, skill);
        const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? skill.turns ?? 0) || 0));
        if (accuracyDebuffPct > 0 && accuracyDebuffTurns > 0) {
          enemy.mods = enemy.mods || {};
          enemy.mods.accuracyPct = Math.min(Number(enemy.mods.accuracyPct ?? 0) || 0, -accuracyDebuffPct);
          showCommonSkillText(scene, enemy, "MẤT CHÍNH XÁC", "#c7d2fe");
        }
        if (offenseDebuffAmount > 0 && offenseDebuffTurns > 0) {
          applyOffenseDebuffStatus(enemy, {
            turns: offenseDebuffTurns,
            value: offenseDebuffAmount,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          showCommonSkillText(scene, enemy, "YẾU ỚT", "#ffaaaa");
        }
        if ((skill.silenceChance || 0) > 0 && (skill.silenceTurns || 0) > 0 && rollChance(scene, skill.silenceChance ?? 0)) {
          enemy.statuses.silence = Math.max(enemy.statuses.silence || 0, skill.silenceTurns || 1);
          showCommonSkillText(scene, enemy, "IM LẶNG", "#9dffba");
        }
        if (enemy.alive) {
          updateCommonSkillUnit(scene, enemy);
        }
      });
      return true;
    }
    case "knockback_charge": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (!target?.alive) return true;

      const pushDirection = attacker.side === "LEFT" ? 1 : -1;
      const targetPosition = findSharedKnockbackPosition(target, pushDirection, enemies);
      if (targetPosition === target.col) {
        showCommonSkillText(scene, target, "KHÓA VỊ TRÍ", "#c8d5e6");
        return true;
      }

      const knockbackDmgPct = skill.runtimeShapeVersion === 3
        ? Math.max(0, (skill.knockbackBonusPct as number) || 0.6)
        : (star >= 3 ? 1.0 : star === 2 ? 0.8 : 0.6);
      const knockbackDmg = Math.round(rawSkill * knockbackDmgPct);
      scene.resolveDamage(attacker, target, knockbackDmg, skill.damageType as string, "ĐẨY LÙI", { isSplash: true });
      target.col = targetPosition;
      target.homeCol = targetPosition;
      const screen = scene.gridToScreen(target.col as number, target.row as number);
      await scene.tweenCombatUnit(target, screen.x, screen.y - 10, 220);
      syncCommonSkillLabels(scene, target);
      scene.showFloatingText(screen.x, screen.y - 45, `ĐẨY LÙI +${Math.round(knockbackDmgPct * 100)}%`, "#ffa944");
      updateCommonSkillUnit(scene, target);

      if (target.alive && (skill.runtimeShapeVersion === 3 ? (skill.stunChance || 0) > 0 : star >= 2)) {
        const stunChance = skill.runtimeShapeVersion === 3 ? (skill.stunChance || 0) : (star >= 3 ? 0.5 : 0.3);
        if (rollChance(scene, stunChance)) {
          target.statuses.stun = Math.max(target.statuses.stun || 0, skill.stunTurns || 1);
          scene.showFloatingText(screen.x, screen.y - 65, "CHOÁNG!", "#ffd97b");
          updateCommonSkillUnit(scene, target);
        }
      }
      return true;
    }
    case "cleave_armor_break": {
      const aoeRadius = Number.isFinite(Number(skill.aoeRadius))
        ? Math.max(0, Math.round(Number(skill.aoeRadius)))
        : 1;
      enemies
        .filter((enemy) => Math.abs((enemy.row ?? 0) - (target.row ?? 0)) <= aoeRadius && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) <= aoeRadius)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
          if (enemy.alive) {
            enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, skill.turns || 0);
            enemy.statuses.armorBreakValue = Math.max(enemy.statuses.armorBreakValue || 0, skill.armorBreak || 0);
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "single_strong_poison": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive) {
        const bonusPoisonTurns = (skill.antiShieldBonusTurns || 0) > 0 && ((target.shield || 0) > 0 || target.classType === "TANKER")
          ? skill.antiShieldBonusTurns as number
          : 0;
        const basePoisonTurns = (skill.poisonTurns || 5) + bonusPoisonTurns;
        const poisonTurns = skill.runtimeShapeVersion === 3 || skill.disableStarTurnScaling
          ? basePoisonTurns
          : getStarTurns(star, basePoisonTurns);
        const poisonDamage = Number.isFinite(Number(skill.poisonPerTurn))
          ? Math.max(1, Math.round(Number(skill.poisonPerTurn)))
          : Math.max(1, Math.round(rawSkill * 0.5));
        target.statuses.poisonTurns = Math.max(target.statuses.poisonTurns || 0, poisonTurns);
        target.statuses.poisonDamage = Math.max(target.statuses.poisonDamage || 0, poisonDamage);
        if ((skill.diseaseTurns || 0) > 0) {
          target.statuses.diseaseTurns = Math.max(target.statuses.diseaseTurns || 0, skill.diseaseTurns as number);
          target.statuses.diseaseDamage = Math.max(target.statuses.diseaseDamage || 0, skill.diseaseDamage || 0);
        }
        updateCommonSkillUnit(scene, target);
      }
      return true;
    }
    case "global_fire": {
      const burnTurns = skill.disableStarTurnScaling
        ? Math.max(0, Math.round(Number(skill.burnTurns || 3) || 0))
        : getStarTurns(star, skill.burnTurns || 3);
      const burnDamage = Math.max(0, Math.round(Number(skill.burnPerTurn || (rawSkill * 0.2)) || 0));
      const diseaseTurns = Math.max(0, Math.round(Number(skill.diseaseTurns || 0) || 0));
      const diseaseDamage = Math.max(0, Math.round(Number(skill.diseaseDamage || 0) || 0));
      enemies.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, "magic", skill.name as string, skillOpts);
        if (enemy.alive) {
          if (burnTurns > 0 && burnDamage > 0) {
            enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, burnTurns);
            enemy.statuses.burnDamage = Math.max(enemy.statuses.burnDamage || 0, burnDamage);
          }
          if (diseaseTurns > 0 && diseaseDamage > 0) {
            enemy.statuses.diseaseTurns = Math.max(enemy.statuses.diseaseTurns || 0, diseaseTurns);
            enemy.statuses.diseaseDamage = Math.max(enemy.statuses.diseaseDamage || 0, diseaseDamage);
          }
          updateCommonSkillUnit(scene, enemy);
        }
      });
      return true;
    }
    case "global_knockback": {
      enemies.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType || "magic", skill.name as string, skillOpts);
        if ((skill.evadeDebuffPct || 0) > 0) {
          enemy.mods = enemy.mods || {};
          enemy.mods.evadePct = Math.min(enemy.mods.evadePct || 0, -Math.abs(skill.evadeDebuffPct as number));
        }
      });
      const push = attacker.side === "LEFT" ? 1 : -1;
      const knockbackDistance = Math.max(1, Math.round(Number(skill.knockbackDistance || 1) || 1));
      const frontliners = enemies
        .filter((enemy) => enemy.alive && scene.distanceToFrontline(enemy) === 0)
        .sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
      for (const enemy of frontliners) {
        const furthestCol = findSharedKnockbackPosition(enemy, push, enemies.filter((unit) => unit.uid !== enemy.uid));
        const desiredCol = (enemy.col ?? 0) + (push * knockbackDistance);
        const newCol = push > 0
          ? Math.min(desiredCol, furthestCol)
          : Math.max(desiredCol, furthestCol);
        if (newCol === enemy.col) continue;
        enemy.col = newCol;
        enemy.homeCol = newCol;
        const screen = scene.gridToScreen(enemy.col as number, enemy.row as number);
        await scene.tweenCombatUnit(enemy, screen.x, screen.y - 10, 180);
        syncCommonSkillLabels(scene, enemy);
        scene.showFloatingText(screen.x, screen.y - 45, "ĐẨY LÙI", "#ffffff");
        if ((skill.stunChance || 0) > 0 && rollChance(scene, skill.stunChance ?? 0)) {
          enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, skill.stunTurns || 1);
          showCommonSkillText(scene, enemy, "CHOÁNG", "#ffd97b");
        }
        updateCommonSkillUnit(scene, enemy);
      }
      return true;
    }
    case "global_poison_team": {
      enemies.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType || "magic", skill.name as string, skillOpts);
        if (enemy.alive) {
          enemy.statuses.poisonTurns = Math.max(enemy.statuses.poisonTurns || 0, skill.poisonTurns as number);
          enemy.statuses.poisonDamage = Math.max(enemy.statuses.poisonDamage || 0, skill.poisonPerTurn as number);
          updateCommonSkillUnit(scene, enemy);
        }
      });
      return true;
    }
    case "true_execute": {
      const bonus = (target.hp ?? 0) < (target.maxHp ?? 0) * 0.4 ? rawSkill * 2 : rawSkill;
      scene.resolveDamage(attacker, target, bonus, "true", skill.name as string, skillOpts);
      return true;
    }
    case "global_slow":
      return true;
    case "multi_disarm": {
      enemies
        .slice()
        .sort((a, b) => (b.atk ?? 0) - (a.atk ?? 0))
        .slice(0, 3)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill * 0.5, "magic", skill.name as string, skillOpts);
          if (enemy.alive) {
            enemy.statuses.disarmTurns = Math.max(enemy.statuses.disarmTurns || 0, 2);
            showCommonSkillText(scene, enemy, "TƯỚC KHÍ", "#ffffff");
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "random_lightning": {
      for (let i = 0; i < 5; i += 1) {
        const enemy = pickRandom(scene, enemies);
        if (enemy) scene.resolveDamage(attacker, enemy, rawSkill, "magic", "LÔI PHẠT", skillOpts);
      }
      return true;
    }
    case "damage_stun": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      const effectiveStunChance = resolveScaledChance(skill, skill.stunChance, starChanceMult, goldMultiplier);
      if (target?.alive && rollChance(scene, effectiveStunChance)) {
        target.statuses.stun = Math.max(target.statuses.stun || 0, skill.stunTurns || 1);
        showCommonSkillText(scene, target, "CHOÁNG", "#ffd97b");
        if ((skill.armorBreak || 0) > 0) {
          target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, skill.armorBreakTurns || 2);
          target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, skill.armorBreak || 0);
        }
        updateCommonSkillUnit(scene, target);
      }
        if ((skill.splashBehindCount || 0) > 0) {
          enemies
            .filter((enemy) => {
              if (!enemy.alive || enemy.uid === target.uid) return false;
              if (attacker?.side === "LEFT") return (enemy.col ?? 0) > (target.col ?? 0);
              if (attacker?.side === "RIGHT") return (enemy.col ?? 0) < (target.col ?? 0);
              return false;
            })
            .sort((a, b) => {
              const sameRowDelta = Number(b.row === target.row) - Number(a.row === target.row);
              if (sameRowDelta !== 0) return sameRowDelta;
              return manhattan(target, a) - manhattan(target, b);
            })
            .slice(0, skill.splashBehindCount as number)
            .forEach((enemy) => {
              scene.resolveDamage(attacker, enemy, Math.round(rawSkill * 0.55), skill.damageType as string, "DƯ CHẤN", { ...skillOpts, isSplash: true });
            });
        }
      return true;
    }
    case "single_armor_break": {
      const targetIsTankOrShielded = target?.classType === "TANKER" || Number(target?.shield ?? 0) > 0;
      const armorPenVsTankOrShielded = Math.max(0, Number(skill.armorPenVsTankOrShielded ?? 0) || 0);
      const rageDrainOnHit = Math.max(0, Math.round(Number(skill.rageDrainOnHit ?? 0) || 0));
      const hitOpts = targetIsTankOrShielded && armorPenVsTankOrShielded > 0
        ? { ...skillOpts, armorPen: armorPenVsTankOrShielded }
        : skillOpts;
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, hitOpts);
      if (target?.alive && targetIsTankOrShielded && rageDrainOnHit > 0) {
        target.rage = Math.max(0, (target.rage || 0) - rageDrainOnHit);
        showCommonSkillText(scene, target, `-${rageDrainOnHit} NỘ`, "#b8f5ff");
      }
      target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, skill.turns || 0);
      target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, skill.armorBreak || 0);
      if ((skill.splashNearestCount || 0) > 0) {
        const splashDamageMultiplier = Math.max(0, Number(skill.splashDamageMultiplier ?? 0) || 0);
        const splashArmorBreakValue = Math.max(0, Math.round(Number(skill.splashArmorBreakValue ?? Math.round((skill.armorBreak || 0) * 0.75)) || 0));
        const splashArmorBreakTurns = Math.max(0, Math.round(Number(skill.splashArmorBreakTurns ?? skill.turns ?? 2) || 0));
        const splashSameRowOnly = Boolean(skill.splashSameRowOnly);
        enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .filter((enemy) => !splashSameRowOnly || enemy.row === target.row)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.splashNearestCount as number)
          .forEach((enemy) => {
            if (splashDamageMultiplier > 0) {
              scene.resolveDamage(
                attacker,
                enemy,
                Math.max(1, Math.round(rawSkill * splashDamageMultiplier)),
                skill.damageType as string,
                `${skill.name as string} MẢNH`,
                { ...skillOpts, isSplash: true }
              );
            }
            enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, splashArmorBreakTurns || (skill.turns || 0));
            enemy.statuses.armorBreakValue = Math.max(enemy.statuses.armorBreakValue || 0, splashArmorBreakValue);
            if ((skill.burnChance || 0) > 0) {
              enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, skill.burnTurns || 2);
              enemy.statuses.burnDamage = Math.max(enemy.statuses.burnDamage || 0, skill.burnPerTurn || 10);
            }
            updateCommonSkillUnit(scene, enemy);
          });
      }
      updateCommonSkillUnit(scene, target);
      return true;
    }
    case "ram_charge_pierce": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive && (skill.armorBreak || 0) > 0 && (skill.armorBreakTurns || 0) > 0) {
        target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, skill.armorBreakTurns as number);
        target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, skill.armorBreak || 0);
        updateCommonSkillUnit(scene, target);
      }
      const pushDirection = attacker?.side === "RIGHT" ? -1 : 1;
      const behindTarget = enemies.find((enemy) => (
        enemy.alive
        && enemy.uid !== target?.uid
        && enemy.row === target?.row
        && enemy.col === ((target?.col ?? 0) + pushDirection)
      ));
      if (behindTarget) {
        scene.resolveDamage(
          attacker,
          behindTarget,
          Math.round(rawSkill * Math.max(0, Number(skill.piercePct ?? 0.6) || 0.6)),
          skill.damageType as string,
          skill.pierceLabel || "HÚC XUYÊN",
          { ...skillOpts, isSplash: true }
        );
      }
      return true;
    }
    case "column_freeze": {
      const expandCol = areaBonus;
      const impacted = enemies
        .filter((enemy) => enemy.alive && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) <= expandCol);
      impacted.forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        });
      const effectiveFreezeChance = resolveScaledChance(skill, skill.freezeChance, starChanceMult, goldMultiplier);
      const freezeBaseTargets = Math.max(0, Math.round(Number(skill.freezeBaseTargets ?? skill.freezeMaxTargets ?? 0) || 0));
      const selected: CombatUnit[] = [];
      const primaryTargets = freezeBaseTargets > 0
        ? selectCombatTargets(
            scene,
            attacker,
            target,
            skill,
            impacted,
            freezeBaseTargets,
            skill.freezeTargetSelector || "highest_atk"
          )
        : [];
      primaryTargets.forEach((enemy) => {
        if (enemy && !selected.some((picked) => picked.uid === enemy.uid)) selected.push(enemy);
      });
      const bonusRangedThreshold = Math.max(0, Math.round(Number(skill.freezeBonusIfRangedCount || 0) || 0));
      const maxFreezeTargets = Math.max(selected.length, Math.round(Number(skill.freezeMaxTargets ?? selected.length) || selected.length));
      if (bonusRangedThreshold > 0) {
        const rangedTargets = impacted.filter((enemy) => (enemy.range ?? 0) >= 2);
        if (rangedTargets.length >= bonusRangedThreshold && selected.length < maxFreezeTargets) {
          const bonusTargets = collectUnitsBySelector(
            rangedTargets.filter((enemy) => !selected.some((picked) => picked.uid === enemy.uid)),
            skill.freezeBonusTargetSelector || "highest_atk",
            maxFreezeTargets - selected.length,
            buildSkillSelectionOptions(scene, attacker, target, skill)
          ) as CombatUnit[];
          bonusTargets.forEach((enemy) => {
            if (enemy && !selected.some((picked) => picked.uid === enemy.uid)) selected.push(enemy);
          });
        }
      }
      selected.forEach((enemy) => {
        if (!enemy.alive || !rollChance(scene, effectiveFreezeChance)) return;
        enemy.statuses.freeze = Math.max(enemy.statuses.freeze || 0, skill.freezeTurns || 1);
        showCommonSkillText(scene, enemy, "ĐÓNG BĂNG", "#83e5ff");
        updateCommonSkillUnit(scene, enemy);
      });
      return true;
    }
    case "aoe_circle": {
      const expandAoe = 1 + areaBonus;
      enemies
        .filter((enemy) => Math.abs((enemy.row ?? 0) - (target.row ?? 0)) <= expandAoe && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) <= expandAoe)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        });
      return true;
    }
    case "column_plus_splash": {
      const splashMax = ((skill.splashCount as number) ?? 2) + targetBonus;
      const splashDamageMultiplier = Math.max(0, Number(skill.splashDamageMultiplier ?? 1) || 1);
      enemies.filter((enemy) => enemy.col === target.col).forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      });
      enemies
        .filter((enemy) => enemy.col !== target.col)
        .sort((a, b) => manhattan(target, a) - manhattan(target, b))
        .slice(0, splashMax)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, Math.round(rawSkill * splashDamageMultiplier), skill.damageType as string, "LAN", skillOpts);
        });
      return true;
    }
    case "column_bleed": {
      enemies
        .filter((enemy) => enemy.col === target.col)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
          if (enemy.alive) {
            const bleedTurns = skill.runtimeShapeVersion === 3
              ? Math.max(1, Math.round(Number(skill.bleedTurns ?? skill.turns ?? 2) || 2))
              : (skill.turns || 3);
            const bleedDamage = skill.runtimeShapeVersion === 3
              ? Math.max(1, Math.round(Number(skill.bleedDamage ?? 10) || 10))
              : Math.round(scene.getEffectiveAtk(attacker) * 0.25 * starScale);
            enemy.statuses.bleedTurns = Math.max(enemy.statuses.bleedTurns || 0, bleedTurns);
            enemy.statuses.bleedDamage = Math.max(enemy.statuses.bleedDamage || 0, bleedDamage);
            showCommonSkillText(scene, enemy, "CHẢY MÁU", "#ff4444");
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "aoe_poison": {
      const expandPoison = Number.isFinite(Number(skill.aoeRadius))
        ? Math.max(0, Math.round(Number(skill.aoeRadius)))
        : 1 + areaBonus;
      enemies
        .filter((enemy) => Math.abs((enemy.row ?? 0) - (target.row ?? 0)) <= expandPoison && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) <= expandPoison)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
          if (enemy.alive) {
            enemy.statuses.poisonTurns = Math.max(enemy.statuses.poisonTurns || 0, skill.poisonTurns as number);
            enemy.statuses.poisonDamage = Math.max(enemy.statuses.poisonDamage || 0, skill.poisonPerTurn as number);
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "row_cleave": {
      enemies
        .filter((enemy) => enemy.row === target.row)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
          enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, skill.turns || 0);
          enemy.statuses.armorBreakValue = Math.max(enemy.statuses.armorBreakValue || 0, skill.armorBreak || 0);
          updateCommonSkillUnit(scene, enemy);
        });
      return true;
    }
    case "single_sleep": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      const effectiveSleepChance = resolveScaledChance(skill, skill.sleepChance, starChanceMult, goldMultiplier);
      const maxSleepTargets = Math.min(3, Math.max(1, Math.round(skill.maxTargets || star)));
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const selected: CombatUnit[] = [];
      if (target?.alive) selected.push(target);
      if (selected.length < maxSleepTargets) {
        const extras = collectUnitsBySelector(
          aliveEnemies.filter((enemy) => enemy.uid !== target?.uid),
          skill.targetSelector || "highest_rage",
          maxSleepTargets - selected.length,
          buildSkillSelectionOptions(scene, attacker, target, skill)
        ) as CombatUnit[];
        extras.forEach((enemy) => {
          if (enemy && !selected.some((entry) => entry.uid === enemy.uid)) selected.push(enemy);
        });
      }
      selected.forEach((enemy) => {
        if (!enemy.alive || !rollChance(scene, effectiveSleepChance)) return;
        if (!enemy.statuses) enemy.statuses = {} as CombatUnit["statuses"];
        enemy.statuses.sleep = Math.max(enemy.statuses.sleep || 0, skill.sleepTurns as number);
        if (Array.isArray(skill.bonusVsClasses) && skill.bonusVsClasses.includes(enemy.classType as string)) {
          scene.resolveDamage(attacker, enemy, Math.round(rawSkill * ((skill.bonusDamageMultiplier as number) || 1) - rawSkill), skill.damageType as string, "SĂN MỒI", { ...skillOpts, isSplash: true });
        }
        showCommonSkillText(scene, enemy, "NGỦ", "#d4bcff");
        updateCommonSkillUnit(scene, enemy);
      });
      return true;
    }
    case "lifesteal_disease": {
      const dealt = scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (dealt > 0 && skill.lifesteal) scene.healUnit(attacker, attacker, Math.round(dealt * skill.lifesteal), "HÚT MÁU");
      const preferredClasses = Array.isArray(skill.preferClasses) ? skill.preferClasses : [];
      const isPreferredTarget = !preferredClasses.length || preferredClasses.includes(target?.classType as string);
      if (target?.alive) {
        target.statuses.diseaseTurns = Math.max(target.statuses.diseaseTurns || 0, skill.diseaseTurns as number);
        target.statuses.diseaseDamage = Math.max(target.statuses.diseaseDamage || 0, skill.diseaseDamage || 0);
        if ((skill.rageDrainPreferred || 0) > 0 && isPreferredTarget) {
          target.rage = Math.max(0, (target.rage || 0) - (skill.rageDrainPreferred as number));
        }
        if ((skill.healReductionTurns || 0) > 0 && (skill.healReductionPct || 0) > 0) {
          target.statuses.healReductionTurns = Math.max(target.statuses.healReductionTurns || 0, skill.healReductionTurns as number);
          target.statuses.healReductionPct = Math.max(target.statuses.healReductionPct || 0, skill.healReductionPct as number);
        }
        if ((skill.healBlockTurns || 0) > 0) {
          target.statuses.healBlockTurns = Math.max(target.statuses.healBlockTurns || 0, skill.healBlockTurns as number);
        }
        showCommonSkillText(scene, target, "DỊCH BỆNH", "#880088");
        updateCommonSkillUnit(scene, target);
      }
      const shouldSpread =
        (skill.spreadDiseaseCount || 0) > 0
        && (
          !target?.alive
          || ((target?.hp ?? 0) / Math.max(1, target?.maxHp ?? 1)) <= Number(skill.spreadIfTargetHpPctBelow ?? 0)
        );
      if (shouldSpread) {
        const spreadTargets = collectUnitsBySelector(
          enemies.filter((enemy) => enemy.alive && enemy.uid !== target?.uid),
          skill.spreadTargetSelector || skill.targetSelector || "backline_caster",
          skill.spreadDiseaseCount as number,
          buildSkillSelectionOptions(scene, attacker, target, skill)
        ) as CombatUnit[];
        const spreadDamage = Math.max(0, Math.round(Number(skill.spreadDiseaseDamage ?? skill.diseaseDamage ?? 0) || 0));
        const spreadTurns = Math.max(0, Math.round(Number(skill.spreadDiseaseTurns ?? skill.diseaseTurns ?? 0) || 0));
        spreadTargets.forEach((enemy) => {
          enemy.statuses.diseaseTurns = Math.max(enemy.statuses.diseaseTurns || 0, spreadTurns);
          enemy.statuses.diseaseDamage = Math.max(enemy.statuses.diseaseDamage || 0, spreadDamage);
          showCommonSkillText(scene, enemy, "LAN BỆNH", "#880088");
          updateCommonSkillUnit(scene, enemy);
        });
        if ((skill.rageGainOnSpreadTrigger || 0) > 0) {
          attacker.rage = Math.min(attacker.rageMax ?? 100, (attacker.rage || 0) + (skill.rageGainOnSpreadTrigger as number));
          updateCommonSkillUnit(scene, attacker);
        }
      } else if ((skill.rageGainOnKill || 0) > 0 && !target?.alive) {
        attacker.rage = Math.min(attacker.rageMax ?? 100, (attacker.rage || 0) + (skill.rageGainOnKill as number));
        updateCommonSkillUnit(scene, attacker);
      }
      return true;
    }
    case "lifesteal_disease_maxhp": {
      const dealt = scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (dealt > 0) {
        scene.healUnit(attacker, attacker, Math.round(dealt * 0.6), "HÚT MÁU");
        const maxHpIncrease = Math.round(dealt * 0.15);
        attacker.maxHp = (attacker.maxHp ?? 0) + maxHpIncrease;
        attacker.hp = (attacker.hp ?? 0) + maxHpIncrease;
        scene.showFloatingText(attacker.sprite?.x ?? 0, attacker.sprite?.y ?? 0 - 55, `+${maxHpIncrease} HP TỐI ĐA`, "#00ff88");
        updateCommonSkillUnit(scene, attacker);
        enemies
          .filter((enemy) => Math.abs((enemy.row ?? 0) - (target.row ?? 0)) <= 1 && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) <= 1 && enemy.uid !== target.uid)
          .forEach((enemy) => {
            enemy.statuses.diseaseTurns = Math.max(enemy.statuses.diseaseTurns || 0, 3);
            enemy.statuses.diseaseDamage = Math.max(enemy.statuses.diseaseDamage || 0, 10);
            updateCommonSkillUnit(scene, enemy);
          });
      }
      return true;
    }
    case "cone_smash": {
      (collectUnitsInForwardCone(enemies, target, (unit: SkillTargetUnit) => unit.alive === true) as CombatUnit[])
        .forEach((enemy: CombatUnit) => {
          const bonus = Array.isArray(skill.bonusVsClasses) && skill.bonusVsClasses.includes(enemy.classType as string)
            ? (skill.bonusDamageMultiplier as number) || 1
            : 1;
          scene.resolveDamage(attacker, enemy, Math.round(rawSkill * bonus), skill.damageType || "physical", skill.name as string, skillOpts);
          if ((skill.rageDrain || 0) > 0) {
            enemy.rage = Math.max(0, (enemy.rage || 0) - (skill.rageDrain as number));
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "row_charge": {
      const rowTargets = enemies
        .filter((enemy) => enemy.alive && enemy.row === target.row)
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b));
      enemies
        .filter((enemy) => enemy.alive && enemy.row === target.row)
        .forEach((enemy) => {
          const bonus = rowTargets[0]?.uid === enemy.uid && (skill.rowLeadDamageMultiplier || 0) > 0
            ? (skill.rowLeadDamageMultiplier as number) || 1
            : 1;
          scene.resolveDamage(attacker, enemy, Math.round(rawSkill * bonus), skill.damageType || "physical", "PHI NƯỚC ĐẠI", skillOpts);
          if ((skill.applyArmorBreakToRow || false) || star >= 3) {
            const debuffValue = Math.max(1, Math.round(Number(skill.armorBreak || 15) || 15));
            enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, Math.max(1, Math.round(Number(skill.armorBreakTurns || 2) || 2)));
            enemy.statuses.armorBreakValue = Math.max(enemy.statuses.armorBreakValue || 0, debuffValue);
            showCommonSkillText(scene, enemy, "-GIÁP", "#ff8855");
            updateCommonSkillUnit(scene, enemy);
          }
        });
      return true;
    }
    case "root_snare_debuff":
    case "root_snare": {
      const targets = skill.runtimeShapeVersion === 3
        ? collectUnitsBySelector(
            enemies.filter((enemy) => enemy.alive),
            skill.targetSelector || "highest_matk",
            Math.max(1, Math.round(skill.maxTargets || 1)),
            buildSkillSelectionOptions(scene, attacker, target, skill)
          ) as CombatUnit[]
        : [target].filter(Boolean) as CombatUnit[];
      targets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, "magic", "RỄ CÂY", skillOpts);
        if (enemy?.alive) {
          if (!enemy.statuses) enemy.statuses = {} as CombatUnit["statuses"];
          enemy.statuses.silence = Math.max(enemy.statuses.silence || 0, getStarTurns(star, skill.turns || 1));
          showCommonSkillText(scene, enemy, "IM LẶNG", "#9dffba");
          updateCommonSkillUnit(scene, enemy);
        }
      });
      const selfHeal = skill.runtimeShapeVersion === 3
        ? Math.round((attacker.maxHp ?? 0) * ((skill.healPctMaxHp as number) || 0.1))
        : Math.round((attacker.maxHp ?? 0) * 0.10 * starScale);
      const healTarget = skill.healTargetSelector
        ? scene.getCombatUnits(attacker.side as "LEFT" | "RIGHT")
            .filter((ally) => ally.alive)
            .sort((a, b) => ((a.hp ?? 0) / Math.max(1, a.maxHp ?? 1)) - ((b.hp ?? 0) / Math.max(1, b.maxHp ?? 1)))[0] || attacker
        : attacker;
      scene.healUnit(attacker, healTarget, selfHeal, "RỄ CÂY");
      return true;
    }
    default:
      return false;
  }
}
