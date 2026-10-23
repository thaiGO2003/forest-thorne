import Phaser from "phaser";
import { manhattan, sampleWithoutReplacement } from "../../core/gameUtils.js";
import { gainGoldWithCreative } from "../../core/creativeMode.js";
import { applyOffenseDebuffStatus, getOffenseDebuffState } from "../../core/offenseDebuff.js";
import { getResolvedSkillForUnit } from "../../data/skills.js";
import {
  buildSkillSelectionOptions,
  collectUnitsBySelector,
  isBacklineUnit,
  collectUnitsInForwardCone,
} from "./sceneSkillTargeting.js";

interface SkillOpts {
  isSplash?: boolean;
  armorPen?: number;
  isAssist?: boolean;
  [key: string]: unknown;
}

interface UtilityUnit {
  uid?: string;
  side?: "LEFT" | "RIGHT";
  alive?: boolean;
  hp?: number;
  maxHp?: number;
  rage?: number;
  rageMax?: number;
  atk?: number;
  baseId?: string;
  id?: string;
  classType?: string;
  row: number;
  col: number;
  range?: number;
  name?: string;
  sprite?: { x: number; y: number; active?: boolean };
  tribe?: string;
  mods?: { basicAttackType?: string; evadePct?: number; [key: string]: unknown };
  statuses: {
    stun?: number;
    freeze?: number;
    sleep?: number;
    silence?: number;
    poisonTurns?: number;
    bleedTurns?: number;
    burnTurns?: number;
    diseaseTurns?: number;
    armorBreakTurns?: number;
    armorBreakValue?: number;
    atkBuffTurns?: number;
    atkBuffValue?: number;
    bloodHuntTurns?: number;
    bloodHuntStacks?: number;
    bloodHuntAntiHeal?: number;
    evadeBuffTurns?: number;
    evadeBuffValue?: number;
    evadeDebuffTurns?: number;
    evadeDebuffValue?: number;
    healReductionTurns?: number;
    healReductionPct?: number;
    offenseDebuffTurns?: number;
    offenseDebuffValue?: number;
    [key: string]: number | string | undefined;
  };
  shield?: number;
  [key: string]: unknown;
}

interface UtilitySkill {
  effect: string;
  name?: string;
  damageType?: string;
  base?: number;
  scale?: number;
  scaleStat?: string;
  hit1?: { base?: number; scaleStat?: string; scale?: number };
  hit2?: { base?: number; scaleStat?: string; scale?: number };
  turns?: number;
  multiTargetSelector?: string;
  targetSelector?: string;
  secondHitTargetSelector?: string;
  secondHitDamageMultiplier?: number;
  shadowBounceCount?: number;
  shadowBounceDamageMultiplier?: number;
  selfEvasionTurns?: number;
  selfEvasionPct?: number;
  selfAtkBuffTurns?: number;
  selfAtkBuffPct?: number;
  selfAtkBuff?: number;
  armorPen?: number;
  poisonedTargetArmorPenBonus?: number;
  poisonedArmorPenBonus?: number;
  poisonedTargetRageDrain?: number;
  poisonedRageDrain?: number;
  followupCount?: number;
  followupDamageMultiplier?: number;
  followupTriggerHpPct?: number;
  swarmBonusPctPerAlly?: number;
  uniqueTargets?: boolean;
  bonusTargetSelector?: string;
  bonusTargetConsumesHit?: boolean;
  bonusVsLowHpPctThreshold?: number;
  bonusVsLowHpMultiplier?: number;
  conditionalHpBelowPct?: number;
  lowHpThreshold?: number;
  conditionalDamageMultiplier?: number;
  lifesteal?: number;
  lifestealBonusVsDebuffedPct?: number;
  conditionalRageDrain?: number;
  conditionalArmorBreakValue?: number;
  conditionalArmorBreakTurns?: number;
  rageGainOnKill?: number;
  evadeDebuffValue?: number;
  evadeDebuffTurns?: number;
  retargetDamageMultiplier?: number;
  retargetOnKill?: boolean;
  retargetHpBelowPct?: number;
  retargetTargetSelector?: string;
  retargetEvadeDebuffValue?: number;
  retargetEvadeDebuffTurns?: number;
  echoBase?: number;
  echoScale?: number;
  echoBonusVsDebuffedMultiplier?: number;
  echoBleedDamage?: number;
  echoBleedTurns?: number;
  retargetEchoOnKill?: boolean;
  echoRetargetSelector?: string;
  expandWithAreaBonus?: boolean;
  stunChance?: number;
  stunTurns?: number;
  centerGuaranteedStun?: boolean;
  rageDrainNearestCount?: number;
  rageDrainValue?: number;
  splashRocCount?: number;
  splashRocDamagePct?: number;
  splashRocStunChance?: number;
  maxHits?: number;
  disableStarTargetScaling?: boolean;
  runtimeShapeVersion?: number;
  burnChance?: number;
  burnTurns?: number;
  burnPerTurn?: number;
  centerCoreDamageBonusPct?: number;
  centerHealReductionPct?: number;
  centerHealReductionTurns?: number;
  centerRageDrain?: number;
  edgeBranchCount?: number;
  edgeBranchDamagePct?: number;
  followupChance?: number;
  archerGuaranteedFollowup?: boolean;
  archerSkillIfFullRage?: boolean;
  supportSkillHpThreshold?: number;
  packThreshold?: number;
  packRageDrain?: number;
  packArmorBreak?: number;
  packArmorBreakTurns?: number;
  retargetFollowupsOnKill?: boolean;
  finisherMultiplier?: number;
  packMarkMinParticipants?: number;
  finalPounceMultiplier?: number;
  guaranteedAssistWithRangedAlly?: boolean;
  assistRate?: number;
  bonusAssistHits?: number;
  bonusAssistThresholdHpPct?: number;
  selfHpCostPct?: number;
  maxStacks?: number;
  applyAntiHeal?: boolean;
  maxTotalBasicHits?: number;
  extraAttackChance?: number;
  bonusVsShieldedMultiplier?: number;
  shieldBreakPctBonus?: number;
  evadePctOnKill?: number;
  slowTurns?: number;
  slowThresholdHpPct?: number;
  slowValue?: number;
  offenseDebuffMode?: string;
  [key: string]: unknown;
}

interface UtilitySceneLike extends Phaser.Scene {
  rollChance?: (chance: number) => boolean;
  pickRandom?: <T>(list: T[]) => T;
  random?: () => number;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi?: (unit: UtilityUnit) => void;
  resolveDamage: (
    attacker: UtilityUnit,
    target: UtilityUnit,
    amount: number,
    damageType: string,
    label: string,
    opts?: SkillOpts
  ) => number;
  getEffectiveAtk: (unit: UtilityUnit) => number;
  healUnit: (healer: UtilityUnit, target: UtilityUnit, amount: number, label: string) => void;
  basicAttack?: (attacker: UtilityUnit, target: UtilityUnit) => Promise<unknown>;
  applySkillEffect?: (attacker: UtilityUnit, target: UtilityUnit, skill: UtilitySkill) => Promise<unknown>;
  getCombatUnits: (side: "LEFT" | "RIGHT") => UtilityUnit[];
  calcSkillRaw?: (unit: UtilityUnit, config: { base?: number; scaleStat?: string; scale?: number }) => number;
  selectTarget?: (unit: UtilityUnit) => UtilityUnit | null;
  addLog?: (text: string) => void;
  wait?: (ms: number) => Promise<void>;
  player: { gold?: number; [key: string]: unknown };
  aiMode: string;
  __rowPackFollowupGuard?: boolean;
  [key: string]: unknown;
}

interface UtilitySkillContext {
  attacker: UtilityUnit;
  target: UtilityUnit;
  skill: UtilitySkill;
  rawSkill: number;
  skillOpts?: SkillOpts;
  enemies: UtilityUnit[];
  allies: UtilityUnit[];
  starChanceMult?: number;
  targetBonus?: number;
  areaBonus?: number;
}

function collectNearestBacklineTargets(
  enemies: UtilityUnit[],
  anchor: UtilityUnit,
  count: number,
  excludeUid: string | null | undefined = null
): UtilityUnit[] {
  const maxCount = Math.max(0, Math.round(Number(count || 0) || 0));
  if (maxCount <= 0) return [];
  return enemies
    .filter((enemy) => enemy?.alive && enemy.uid !== excludeUid && isBacklineUnit(enemy))
    .sort((a, b) => {
      const distDelta = manhattan(anchor, a) - manhattan(anchor, b);
      if (distDelta !== 0) return distDelta;
      const rowDelta = (a.row ?? 0) - (b.row ?? 0);
      if (rowDelta !== 0) return rowDelta;
      return (a.col ?? 0) - (b.col ?? 0);
    })
    .slice(0, maxCount);
}

function selectSkillTargets(
  scene: UtilitySceneLike,
  attacker: UtilityUnit,
  target: UtilityUnit,
  skill: UtilitySkill,
  enemies: UtilityUnit[],
  count: number,
  selector: string | null = null
): UtilityUnit[] {
  return collectUnitsBySelector(
    enemies,
    selector || skill?.multiTargetSelector || skill?.targetSelector || "random",
    count,
    buildSkillSelectionOptions(scene as unknown as Parameters<typeof buildSkillSelectionOptions>[0], attacker, target, skill)
  ) as unknown as UtilityUnit[];
}

function rollChance(scene: UtilitySceneLike | null | undefined, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function showText(scene: UtilitySceneLike, unit: UtilityUnit | null | undefined, text: string, color: string): void {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText?.(unit.sprite.x, unit.sprite.y - 45, text, color);
}

function updateUnit(scene: UtilitySceneLike, unit: UtilityUnit): void {
  scene.updateCombatUnitUi?.(unit);
}

async function performFollowUpBasicAttack(
  scene: UtilitySceneLike,
  ally: UtilityUnit,
  target: UtilityUnit
): Promise<boolean> {
  if (!ally?.alive || !target?.alive) return false;
  if (typeof scene.basicAttack === "function") {
    await scene.basicAttack(ally, target);
    return true;
  }
  const rawDamage = scene?.getEffectiveAtk?.(ally) ?? ally?.atk ?? 0;
  scene.resolveDamage?.(ally, target, rawDamage, ally?.mods?.basicAttackType ?? "physical", "ĐÁNH BỒI", { isAssist: true });
  updateUnit(scene, target);
  return true;
}

async function performFollowUpSkill(
  scene: UtilitySceneLike,
  ally: UtilityUnit,
  target: UtilityUnit
): Promise<boolean> {
  if (!ally?.alive || !target?.alive) return false;
  const allySkill = getResolvedSkillForUnit(ally, ally.baseId ?? ally.id);
  const skillCost = Math.max(1, Math.round(Number(allySkill?.cost ?? ally?.rageMax ?? 1)));
  if (!allySkill || (ally?.rage ?? 0) < skillCost || (ally?.statuses?.silence ?? 0) > 0) return false;
  ally.rage = Math.max(0, (ally.rage ?? 0) - skillCost);
  showText(scene, ally, (allySkill as { name?: string })?.name ?? "PHỤ HỌA", "#ffe08c");
  updateUnit(scene, ally);
  if (typeof scene.applySkillEffect === "function") {
    await scene.applySkillEffect(ally, target, allySkill as UtilitySkill);
    return true;
  }
  return false;
}

function applySelfAtkBuff(scene: UtilitySceneLike, attacker: UtilityUnit, skill: UtilitySkill): void {
  const turns = Math.max(1, Math.round(Number(skill.selfAtkBuffTurns ?? skill.turns ?? 2) || 2));
  const atkPct = Number(skill.selfAtkBuffPct ?? 0);
  const buffValue = atkPct > 0
    ? Math.max(1, Math.round((scene.getEffectiveAtk?.(attacker) ?? attacker?.atk ?? 0) * atkPct))
    : Math.max(0, Math.round(Number(skill.selfAtkBuff ?? 0) || 0));
  if (buffValue > 0) {
    attacker.statuses.atkBuffTurns = Math.max(attacker.statuses.atkBuffTurns || 0, turns);
    attacker.statuses.atkBuffValue = Math.max(attacker.statuses.atkBuffValue || 0, buffValue);
    updateUnit(scene, attacker);
  }
}

function pickNearestEnemy(anchor: UtilityUnit, enemies: UtilityUnit[]): UtilityUnit | null {
  return enemies
    .filter((enemy) => enemy?.alive)
    .sort((a, b) => manhattan(anchor, a) - manhattan(anchor, b))[0] ?? null;
}

function applyPackMark(
  scene: UtilitySceneLike,
  target: UtilityUnit,
  rageDrain: number | undefined,
  armorBreak: number | undefined,
  turns: number | undefined
): void {
  if (!target?.alive) return;
  const resolvedRageDrain = Math.max(0, Math.round(Number(rageDrain || 0) || 0));
  const resolvedArmorBreak = Math.max(0, Math.round(Number(armorBreak || 0) || 0));
  const resolvedTurns = Math.max(1, Math.round(Number(turns || 0) || 0));
  if (resolvedRageDrain > 0) {
    target.rage = Math.max(0, (target.rage || 0) - resolvedRageDrain);
  }
  if (resolvedArmorBreak > 0) {
    target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, resolvedTurns);
    target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, resolvedArmorBreak);
  }
  showText(scene, target, "ĐÁNH DẤU BẦY", "#ffcf82");
  updateUnit(scene, target);
}

export async function applySharedCommonUtilitySkillEffect(scene: UtilitySceneLike, context: UtilitySkillContext): Promise<boolean> {
  const {
    attacker,
    target,
    skill,
    rawSkill,
    skillOpts,
    enemies,
    allies,
    starChanceMult = 1,
    targetBonus = 0
  } = context;

  switch (skill.effect) {
    case "single_burst_armor_pen": {
      const armorPen = Math.max(0, Number(skill.armorPen ?? 0.5) || 0.5);
      const poisonedTargetArmorPenBonus = Math.max(
        0,
        Number(skill.poisonedTargetArmorPenBonus ?? skill.poisonedArmorPenBonus ?? 0) || 0
      );
      const poisonedTargetRageDrain = Math.max(0, Math.round(Number(skill.poisonedTargetRageDrain ?? skill.poisonedRageDrain ?? 0) || 0));
      const followupCount = Math.max(0, Math.round(Number(skill.followupCount ?? 0) || 0));
      const followupDamageMultiplier = Math.max(0, Number(skill.followupDamageMultiplier ?? 0) || 0);
      const followupTriggerHpPct = Math.max(0, Number(skill.followupTriggerHpPct ?? 0) || 0);
      const liveSwarmCount = allies.filter((ally) => ally.alive && ally.tribe === "SWARM").length;
      const swarmBonusPctPerAlly = Math.max(0, Number(skill.swarmBonusPctPerAlly || 0) || 0);
      const resolvedDamage = Math.round(rawSkill * (1 + (liveSwarmCount * swarmBonusPctPerAlly)));
      const isPoisoned = (target?.statuses?.poisonTurns ?? 0) > 0;
      const penOpts = { ...skillOpts, armorPen: armorPen + (isPoisoned ? poisonedTargetArmorPenBonus : 0) };
      scene.resolveDamage(attacker, target, resolvedDamage, skill.damageType as string, skill.name as string, penOpts);
      if (target?.alive && isPoisoned && poisonedTargetRageDrain > 0) {
        target.rage = Math.max(0, (target.rage || 0) - poisonedTargetRageDrain);
        showText(scene, target, `-${poisonedTargetRageDrain} NỘ`, "#b8f5ff");
        updateUnit(scene, target);
      }
      const targetHpRatio = Number(target?.hp ?? 0) / Math.max(1, Number(target?.maxHp ?? 0) || 1);
      if (followupCount > 0 && followupDamageMultiplier > 0 && (!target?.alive || targetHpRatio <= followupTriggerHpPct)) {
        const followupTargets = collectNearestBacklineTargets(enemies, target ?? attacker, followupCount, target?.uid);
        followupTargets.forEach((enemy) => {
          scene.resolveDamage(
            attacker,
            enemy,
            Math.max(1, Math.round(resolvedDamage * followupDamageMultiplier)),
            skill.damageType as string,
            skill.name as string,
            { ...skillOpts, isSplash: true, armorPen: penOpts.armorPen as number }
          );
          updateUnit(scene, enemy);
        });
      }
      return true;
    }
    case "wolf_pack_hunt": {
      if (!target?.alive) return true;

      applySelfAtkBuff(scene, attacker, skill);
      showText(scene, attacker, "TRU BẦY", "#ffd27a");
      await performFollowUpBasicAttack(scene, attacker, target);

      let currentTarget: UtilityUnit | null = target;
      const rowAllies = allies.filter((ally) => ally.alive && ally.uid !== attacker.uid && ally.row === attacker.row);
      const supportAlly = rowAllies.find((ally) => ally.classType === "SUPPORT") ?? null;
      const archerAlly = rowAllies.find((ally) => ally.classType === "ARCHER") ?? null;
      const followupChance = Math.max(0, Math.min(1, Number(skill.followupChance || 0.3)));
      let skillFollowupConsumed = false;
      let joinedAllies = 0;
      let packMarkApplied = false;
      const nestedPackGuardActive = scene.__rowPackFollowupGuard === true;

      for (const ally of rowAllies) {
        if (!currentTarget?.alive && skill.retargetFollowupsOnKill) {
          currentTarget = pickNearestEnemy(currentTarget ?? target, enemies);
        }
        if (!currentTarget?.alive) break;

        let shouldFollow = rollChance(scene, followupChance);
        if (supportAlly && ally.uid === supportAlly.uid) shouldFollow = true;
        if (archerAlly && ally.uid === archerAlly.uid && skill.archerGuaranteedFollowup) shouldFollow = true;
        if (!shouldFollow) continue;

        let usedSkill = false;
        if (!nestedPackGuardActive && !skillFollowupConsumed) {
          const currentTargetHpRatio = (currentTarget.hp ?? 0) / Math.max(1, currentTarget.maxHp ?? 1);
          if (
            supportAlly &&
            ally.uid === supportAlly.uid &&
            currentTargetHpRatio <= Number(skill.supportSkillHpThreshold || 0.6)
          ) {
            scene.__rowPackFollowupGuard = true;
            usedSkill = await performFollowUpSkill(scene, ally, currentTarget);
            scene.__rowPackFollowupGuard = nestedPackGuardActive;
          }
          if (!usedSkill && archerAlly && ally.uid === archerAlly.uid && skill.archerSkillIfFullRage) {
            scene.__rowPackFollowupGuard = true;
            usedSkill = await performFollowUpSkill(scene, ally, currentTarget);
            scene.__rowPackFollowupGuard = nestedPackGuardActive;
          }
          if (usedSkill) skillFollowupConsumed = true;
        }

        if (!usedSkill) {
          await performFollowUpBasicAttack(scene, ally, currentTarget);
        }

        joinedAllies += 1;
        if (
          !packMarkApplied &&
          joinedAllies >= Math.max(1, Math.round(Number(skill.packThreshold || 2) || 2)) &&
          currentTarget?.alive
        ) {
          applyPackMark(
            scene,
            currentTarget,
            skill.packRageDrain,
            skill.packArmorBreak,
            skill.packArmorBreakTurns
          );
          packMarkApplied = true;
        }

        if (!currentTarget?.alive && skill.retargetFollowupsOnKill) {
          currentTarget = pickNearestEnemy(currentTarget ?? target, enemies);
        }
      }

      scene.__rowPackFollowupGuard = nestedPackGuardActive;

      if ((skill.finisherMultiplier || 0) > 0) {
        const finisherTarget = currentTarget?.alive ? currentTarget : pickNearestEnemy(target, enemies);
        if (finisherTarget?.alive) {
          const finisherDamage = Math.max(
            1,
            Math.round((scene.getEffectiveAtk?.(attacker) ?? attacker?.atk ?? 0) * Number(skill.finisherMultiplier || 0))
          );
          scene.resolveDamage(attacker, finisherTarget, finisherDamage, "physical", "VỒ CHỐT", { isAssist: true });
          showText(scene, finisherTarget, "VỒ CHỐT", "#ffb36b");
          updateUnit(scene, finisherTarget);
        }
      }
      return true;
    }
    case "cone_shot": {
      const coneTargets = collectUnitsInForwardCone(enemies, target, ((unit: UtilityUnit) => unit.alive === true) as unknown as Parameters<typeof collectUnitsInForwardCone>[2]).filter((enemy) => (enemy as UtilityUnit)?.alive) as UtilityUnit[];
      const coneTargetSet = new Set(coneTargets.map((enemy: UtilityUnit) => enemy.uid));
      const burnChance = Math.max(0, Number(skill.burnChance ?? 0) || 0);
      const burnTurns = Math.max(0, Math.round(Number(skill.burnTurns ?? 0) || 0));
      const burnDamage = Math.max(0, Math.round(Number(skill.burnPerTurn ?? 0) || 0));
      const centerBonusPct = Math.max(0, Number(skill.centerCoreDamageBonusPct ?? 0) || 0);
      const centerHealReductionPct = Math.max(0, Number(skill.centerHealReductionPct ?? 0) || 0);
      const centerHealReductionTurns = Math.max(1, Math.round(Number(skill.centerHealReductionTurns ?? 2) || 2));
      const centerRageDrain = Math.max(0, Math.round(Number(skill.centerRageDrain ?? 0) || 0));
      const edgeBranchCount = Math.max(0, Math.round(Number(skill.edgeBranchCount ?? 0) || 0));
      const edgeBranchDamagePct = Math.max(0, Number(skill.edgeBranchDamagePct ?? 0) || 0);

      coneTargets.forEach((enemy: UtilityUnit) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        if (enemy.alive && burnChance > 0 && burnTurns > 0 && burnDamage > 0) {
          enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, burnTurns);
          enemy.statuses.burnDamage = Math.max((enemy.statuses.burnDamage || 0) as number, burnDamage);
          scene.updateCombatUnitUi?.(enemy);
        }
      });

      if (target?.alive && target.uid && coneTargetSet.has(target.uid) && centerBonusPct > 0) {
        scene.resolveDamage(
          attacker,
          target,
          Math.max(1, Math.round(rawSkill * centerBonusPct)),
          skill.damageType as string,
          `${skill.name} TÂM`,
          skillOpts
        );
      }
      if (target?.alive && target.uid && coneTargetSet.has(target.uid) && centerHealReductionPct > 0) {
        target.statuses.healReductionTurns = Math.max(target.statuses.healReductionTurns || 0, centerHealReductionTurns);
        target.statuses.healReductionPct = Math.max(target.statuses.healReductionPct || 0, centerHealReductionPct);
        showText(scene, target, "GIẢM HỒI", "#ffb347");
        updateUnit(scene, target);
      }
      if (target?.alive && target.uid && coneTargetSet.has(target.uid) && centerRageDrain > 0) {
        target.rage = Math.max(0, (target.rage || 0) - centerRageDrain);
        showText(scene, target, `-${centerRageDrain} NỘ`, "#b8f5ff");
        updateUnit(scene, target);
      }
      if (coneTargets.length >= 3 && edgeBranchCount > 0 && edgeBranchDamagePct > 0) {
        enemies
          .filter((enemy) => enemy?.alive && enemy.uid && !coneTargetSet.has(enemy.uid))
          .sort((a, b) => {
            const distDelta = manhattan(target, a) - manhattan(target, b);
            if (distDelta !== 0) return distDelta;
            const rowDelta = (a.row ?? 0) - (b.row ?? 0);
            if (rowDelta !== 0) return rowDelta;
            return (a.col ?? 0) - (b.col ?? 0);
          })
          .slice(0, edgeBranchCount)
          .forEach((enemy) => {
            scene.resolveDamage(
              attacker,
              enemy,
              Math.max(1, Math.round(rawSkill * edgeBranchDamagePct)),
              skill.damageType as string,
              `${skill.name} MÉP`,
              { ...skillOpts, isSplash: true }
            );
          });
      }
      return true;
    }
    case "single_burst": {
      const lowHpThreshold = Math.max(0, Number(skill.bonusVsLowHpPctThreshold ?? 0) || 0);
      const lowHpMultiplier = Math.max(0, Number(skill.bonusVsLowHpMultiplier ?? 1) || 1);
      const shouldBonus = lowHpThreshold > 0
        && lowHpMultiplier > 0
        && Number(target?.hp ?? 0) <= Math.max(1, Number(target?.maxHp ?? 0) * lowHpThreshold);
      const resolvedDamage = shouldBonus ? Math.round(rawSkill * lowHpMultiplier) : rawSkill;
      scene.resolveDamage(attacker, target, resolvedDamage, skill.damageType as string, skill.name as string, skillOpts);
      return true;
    }
    case "double_hit": {
      const hit1 = scene.calcSkillRaw?.(attacker, skill.hit1 || { base: skill.base || 0, scaleStat: skill.scaleStat || "atk", scale: skill.scale || 0 }) ?? rawSkill;
      const hit2 = scene.calcSkillRaw?.(attacker, skill.hit2 || { base: skill.base || 0, scaleStat: skill.scaleStat || "atk", scale: skill.scale || 0 }) ?? rawSkill;
      scene.resolveDamage(attacker, target, hit1, skill.damageType || "physical", `${skill.name} 1`, skillOpts);
      const firstHitKilled = Boolean(target && !target.alive);
      const secondTarget = skill.secondHitTargetSelector
        ? selectSkillTargets(scene, attacker, target, skill, enemies, 1, skill.secondHitTargetSelector)[0] ?? target
        : target;
      if (secondTarget?.alive) {
        scene.resolveDamage(attacker, secondTarget, Math.round(hit2 * (skill.secondHitDamageMultiplier || 1)), skill.damageType || "physical", `${skill.name} 2`, skillOpts);
        const secondHitKilled = Boolean(secondTarget && !secondTarget.alive);
        if ((skill.slowTurns ?? 0) > 0 && (target.hp ?? 0) <= (target.maxHp ?? 0) * (skill.slowThresholdHpPct || 1)) {
          applyOffenseDebuffStatus(secondTarget as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
            turns: skill.slowTurns as number,
            value: skill.slowValue || 12,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          scene.updateCombatUnitUi?.(secondTarget);
        }
        const bounceCount = Math.max(0, Math.round(Number(skill.shadowBounceCount ?? 0) || 0));
        const bounceDamageMultiplier = Math.max(0, Number(skill.shadowBounceDamageMultiplier ?? 0) || 0);
        if ((firstHitKilled || secondHitKilled) && bounceCount > 0 && bounceDamageMultiplier > 0) {
          const hitTargets = new Set([target?.uid, secondTarget?.uid].filter(Boolean));
          let bounceAnchor: UtilityUnit = secondTarget;
          for (let i = 0; i < bounceCount; i += 1) {
            const bounceTarget = enemies
              .filter((enemy) => enemy?.alive && enemy.uid && !hitTargets.has(enemy.uid) && isBacklineUnit(enemy))
              .sort((a, b) => {
                const distDelta = manhattan(bounceAnchor ?? secondTarget, a) - manhattan(bounceAnchor ?? secondTarget, b);
                if (distDelta !== 0) return distDelta;
                const rowDelta = (a.row ?? 0) - (b.row ?? 0);
                if (rowDelta !== 0) return rowDelta;
                return (a.col ?? 0) - (b.col ?? 0);
              })[0];
            if (!bounceTarget) break;
            hitTargets.add(bounceTarget.uid as string);
            bounceAnchor = bounceTarget;
            scene.resolveDamage(
              attacker,
              bounceTarget,
              Math.max(1, Math.round(hit2 * bounceDamageMultiplier)),
              skill.damageType || "physical",
              `${skill.name} BÓNG`,
              { ...skillOpts, isSplash: true }
            );
            updateUnit(scene, bounceTarget);
          }
        }
        if ((skill.selfEvasionTurns ?? 0) > 0 && (skill.selfEvasionPct ?? 0) > 0) {
          attacker.statuses.evadeBuffTurns = Math.max(attacker.statuses.evadeBuffTurns || 0, skill.selfEvasionTurns as number);
          attacker.statuses.evadeBuffValue = Math.max(attacker.statuses.evadeBuffValue || 0, skill.selfEvasionPct as number);
          showText(scene, attacker, "NÉ BÓNG", "#d8f3ff");
          updateUnit(scene, attacker);
        }
      }
      return true;
    }
    case "single_burst_lifesteal": {
      const debuffedBeforeHit = Boolean(
        target?.statuses
        && (
          getOffenseDebuffState(target.statuses, target).turns > 0
          || (target.statuses.armorBreakTurns ?? 0) > 0
          || (target.statuses.poisonTurns ?? 0) > 0
          || (target.statuses.burnTurns ?? 0) > 0
          || (target.statuses.diseaseTurns ?? 0) > 0
          || (target.statuses.bleedTurns ?? 0) > 0
          || (target.statuses.stun ?? 0) > 0
          || (target.statuses.sleep ?? 0) > 0
          || (target.statuses.silence ?? 0) > 0
        )
      );
      const targetHpRatioBeforeHit = Math.max(0, Number(target?.hp ?? 0)) / Math.max(1, Number(target?.maxHp ?? 0) || 1);
      const lowHpThreshold = Math.max(0, Number(skill.conditionalHpBelowPct ?? skill.lowHpThreshold ?? 0) || 0);
      const meetsConditionalTrigger = debuffedBeforeHit || (lowHpThreshold > 0 && targetHpRatioBeforeHit <= lowHpThreshold);
      const conditionalDamageMultiplier = meetsConditionalTrigger
        ? Math.max(1, Number(skill.conditionalDamageMultiplier ?? 1) || 1)
        : 1;
      const resolvedDamage = Math.max(1, Math.round(rawSkill * conditionalDamageMultiplier));
      const dealt = scene.resolveDamage(attacker, target, resolvedDamage, skill.damageType as string, skill.name as string, skillOpts);
      const extraLifesteal = debuffedBeforeHit ? Math.max(0, Number(skill.lifestealBonusVsDebuffedPct ?? 0) || 0) : 0;
      if (dealt > 0) scene.healUnit(attacker, attacker, Math.round(dealt * ((Number(skill.lifesteal ?? 0) || 0) + extraLifesteal)), "HÚT MÁU");
      if (target?.alive && meetsConditionalTrigger && (skill.conditionalRageDrain || 0) > 0) {
        const drain = Math.max(1, Math.round(Number(skill.conditionalRageDrain || 0) || 0));
        target.rage = Math.max(0, (target.rage || 0) - drain);
        showText(scene, target, `-${drain} NỘ`, "#b8f5ff");
      }
      if (target?.alive && meetsConditionalTrigger && (skill.conditionalArmorBreakValue || 0) > 0 && (skill.conditionalArmorBreakTurns || 0) > 0) {
        target.statuses.armorBreakTurns = Math.max(
          target.statuses.armorBreakTurns || 0,
          Math.max(1, Math.round(Number(skill.conditionalArmorBreakTurns || 0) || 0))
        );
        target.statuses.armorBreakValue = Math.max(
          target.statuses.armorBreakValue || 0,
          Math.max(1, Math.round(Number(skill.conditionalArmorBreakValue || 0) || 0))
        );
      }
      if (!target?.alive && (skill.rageGainOnKill || 0) > 0) {
        attacker.rage = Math.min(attacker.rageMax ?? 100, (attacker.rage || 0) + (skill.rageGainOnKill as number));
        showText(scene, attacker, `+${skill.rageGainOnKill} NỘ`, "#b8f5ff");
        updateUnit(scene, attacker);
      }
      if (target?.alive && (skill.evadeDebuffValue || 0) > 0 && (skill.evadeDebuffTurns || 0) > 0) {
        target.statuses.evadeDebuffTurns = Math.max(target.statuses.evadeDebuffTurns || 0, skill.evadeDebuffTurns as number);
        target.statuses.evadeDebuffValue = Math.max(target.statuses.evadeDebuffValue || 0, skill.evadeDebuffValue as number);
        scene.updateCombatUnitUi?.(target);
      }
      const targetHpRatioAfterHit = Math.max(0, Number(target?.hp ?? 0)) / Math.max(1, Number(target?.maxHp ?? 0) || 1);
      const shouldRetarget = (Number(skill.retargetDamageMultiplier || 0) || 0) > 0
        && (
          (!(target?.alive) && (skill.retargetOnKill ?? true))
          || (
            target?.alive
            && (Number(skill.retargetHpBelowPct ?? 0) || 0) > 0
            && targetHpRatioAfterHit <= Number(skill.retargetHpBelowPct || 0)
          )
        );
      if (shouldRetarget) {
        const followTarget = selectSkillTargets(
          scene,
          attacker,
          target,
          { ...skill, multiTargetSelector: skill.retargetTargetSelector || skill.targetSelector || "front" },
          enemies.filter((enemy) => enemy.alive && enemy.uid !== target.uid),
          1,
          skill.retargetTargetSelector || skill.targetSelector || "front"
        )[0];
        if (followTarget) {
          const followDamage = Math.max(1, Math.round(rawSkill * Number(skill.retargetDamageMultiplier || 0)));
          scene.resolveDamage(attacker, followTarget, followDamage, skill.damageType as string, "TRUY KÍCH", { ...skillOpts, isSplash: true });
          if (followTarget.alive && (skill.retargetEvadeDebuffValue || 0) > 0 && (skill.retargetEvadeDebuffTurns || 0) > 0) {
            followTarget.statuses.evadeDebuffTurns = Math.max(
              followTarget.statuses.evadeDebuffTurns || 0,
              Math.max(1, Math.round(Number(skill.retargetEvadeDebuffTurns || 0) || 0))
            );
            followTarget.statuses.evadeDebuffValue = Math.max(
              followTarget.statuses.evadeDebuffValue || 0,
              Math.max(0, Number(skill.retargetEvadeDebuffValue || 0) || 0)
            );
          }
          updateUnit(scene, followTarget);
        }
      }
      return true;
    }
    case "single_delayed_echo": {
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (target?.alive) {
        if ((skill.evadeDebuffValue || 0) > 0 && (skill.evadeDebuffTurns || 0) > 0) {
          target.statuses.evadeDebuffTurns = Math.max(target.statuses.evadeDebuffTurns || 0, skill.evadeDebuffTurns as number);
          target.statuses.evadeDebuffValue = Math.max(target.statuses.evadeDebuffValue || 0, skill.evadeDebuffValue as number);
          scene.updateCombatUnitUi?.(target);
        }
        await scene.wait?.(65);
        const debuffed = target.statuses && (
          getOffenseDebuffState(target.statuses, target).turns > 0
          || (target.statuses.armorBreakTurns ?? 0) > 0
          || (target.statuses.poisonTurns ?? 0) > 0
          || (target.statuses.burnTurns ?? 0) > 0
          || (target.statuses.diseaseTurns ?? 0) > 0
        );
        const echo = ((skill.echoBase ?? 0) + scene.getEffectiveAtk(attacker) * (skill.echoScale ?? 0)) * (debuffed ? (skill.echoBonusVsDebuffedMultiplier || 1) : 1);
        scene.resolveDamage(attacker, target, echo, skill.damageType as string, "VỌNG", skillOpts);
        if (target.alive && (skill.echoBleedDamage || 0) > 0 && (skill.echoBleedTurns || 0) > 0) {
          target.statuses.bleedTurns = Math.max(target.statuses.bleedTurns || 0, skill.echoBleedTurns as number);
          target.statuses.bleedDamage = Math.max((target.statuses.bleedDamage || 0) as number, skill.echoBleedDamage as number);
          scene.updateCombatUnitUi?.(target);
        }
      } else if (skill.retargetEchoOnKill) {
        const bounceTarget = selectSkillTargets(scene, attacker, target, skill, enemies, 1, skill.echoRetargetSelector || "backline_caster")[0];
        if (bounceTarget) {
          await scene.wait?.(65);
          const echo = (skill.echoBase ?? 0) + scene.getEffectiveAtk(attacker) * (skill.echoScale ?? 0);
          scene.resolveDamage(attacker, bounceTarget, echo, skill.damageType as string, "VỌNG", skillOpts);
        }
      }
      return true;
    }
    case "cross_5": {
      const points: Array<[number, number]> = [
        [target.row, target.col],
        [target.row - 1, target.col],
        [target.row + 1, target.col],
        [target.row, target.col - 1],
        [target.row, target.col + 1]
      ];
      if (skill.expandWithAreaBonus !== false && (context.areaBonus ?? 0) >= 1) {
        points.push([target.row - 1, target.col - 1], [target.row - 1, target.col + 1]);
        points.push([target.row + 1, target.col - 1], [target.row + 1, target.col + 1]);
      }
      const stunChance = Math.max(0, Number(skill.stunChance ?? 0) || 0);
      const stunTurns = Math.max(0, Math.round(Number(skill.stunTurns ?? 0) || 0));
      const centerGuaranteedStun = Boolean(skill.centerGuaranteedStun);
      const rageDrainNearestCount = Math.max(0, Math.round(Number(skill.rageDrainNearestCount ?? 0) || 0));
      const rageDrainValue = Math.max(0, Math.round(Number(skill.rageDrainValue ?? 0) || 0));
      const splashCount = Math.max(0, Math.round(Number(skill.splashRocCount ?? 0) || 0));
      const splashDamagePct = Math.max(0, Number(skill.splashRocDamagePct ?? 0) || 0);
      const splashStunChance = Math.max(0, Number(skill.splashRocStunChance ?? 0) || 0);
      const hitTargets = enemies
        .filter((enemy) => points.some((point) => point[0] === enemy.row && point[1] === enemy.col))
        .sort((a, b) => {
          const distDelta = manhattan(target, a) - manhattan(target, b);
          if (distDelta !== 0) return distDelta;
          const rowDelta = (a.row ?? 0) - (b.row ?? 0);
          if (rowDelta !== 0) return rowDelta;
          return (a.col ?? 0) - (b.col ?? 0);
        });
      hitTargets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        if (enemy.alive && stunChance > 0 && stunTurns > 0 && rollChance(scene, stunChance)) {
          enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, stunTurns);
          showText(scene, enemy, "CHOÁNG", "#ffd97b");
          updateUnit(scene, enemy);
        }
      });
      if (target?.alive && centerGuaranteedStun && hitTargets.length >= 3) {
        target.statuses.stun = Math.max(target.statuses.stun || 0, stunTurns || 1);
        showText(scene, target, "CHOÁNG", "#ffd97b");
        updateUnit(scene, target);
      }
      if (rageDrainNearestCount > 0 && rageDrainValue > 0 && hitTargets.length >= 3) {
        hitTargets
          .filter((enemy) => enemy.uid !== target.uid)
          .sort((a, b) => {
            const distDelta = manhattan(target, a) - manhattan(target, b);
            if (distDelta !== 0) return distDelta;
            const rowDelta = (a.row ?? 0) - (b.row ?? 0);
            if (rowDelta !== 0) return rowDelta;
            return (a.col ?? 0) - (b.col ?? 0);
          })
          .slice(0, rageDrainNearestCount)
          .forEach((enemy) => {
            enemy.rage = Math.max(0, (enemy.rage || 0) - rageDrainValue);
            showText(scene, enemy, `-${rageDrainValue} NỘ`, "#b8f5ff");
            updateUnit(scene, enemy);
          });
      }
      if ((target.alive === false || hitTargets.length >= 4) && splashCount > 0 && splashDamagePct > 0) {
        enemies
          .filter((enemy) => enemy.alive && enemy.uid && !hitTargets.some((picked) => picked.uid === enemy.uid))
          .sort((a, b) => {
            const distDelta = manhattan(target, a) - manhattan(target, b);
            if (distDelta !== 0) return distDelta;
            const rowDelta = (a.row ?? 0) - (b.row ?? 0);
            if (rowDelta !== 0) return rowDelta;
            return (a.col ?? 0) - (b.col ?? 0);
          })
          .slice(0, splashCount)
          .forEach((enemy) => {
            scene.resolveDamage(
              attacker,
              enemy,
              Math.max(1, Math.round(rawSkill * splashDamagePct)),
              skill.damageType as string,
              `${skill.name} PHỤ`,
              { ...skillOpts, isSplash: true }
            );
            if (enemy.alive && splashStunChance > 0 && stunTurns > 0 && rollChance(scene, splashStunChance)) {
              enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, stunTurns);
              showText(scene, enemy, "CHOÁNG", "#ffd97b");
            }
            updateUnit(scene, enemy);
          });
      }
      return true;
    }
    case "row_multi": {
      const maxHits = Number.isFinite(skill.maxHits) ? Math.max(1, Math.floor(skill.maxHits as number)) : 3;
      enemies
        .filter((enemy) => enemy.row === target.row)
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))
        .slice(0, maxHits)
        .forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        });
      return true;
    }
    case "random_multi": {
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const exactMaxHits = Math.max(1, Math.round(Number(skill.maxHits ?? 3) || 3));
      const maxHits = skill.runtimeShapeVersion === 3 || skill.disableStarTargetScaling
        ? exactMaxHits
        : exactMaxHits + targetBonus;
      const randomFn = scene?.random?.bind(scene) ?? Math.random;
      let pickedTargets: UtilityUnit[] = skill.uniqueTargets || skill.multiTargetSelector
        ? selectSkillTargets(scene, attacker, target, skill, aliveEnemies, Math.min(maxHits, aliveEnemies.length), skill.multiTargetSelector || "random")
        : sampleWithoutReplacement(aliveEnemies, Math.min(maxHits, aliveEnemies.length), randomFn) as UtilityUnit[];
      let bonusTarget: UtilityUnit | null = null;
      if (skill.bonusTargetSelector) {
        const bonus = selectSkillTargets(scene, attacker, target, skill, aliveEnemies, 1, skill.bonusTargetSelector)[0];
        if (bonus && skill.bonusTargetConsumesHit && !pickedTargets.some((picked) => picked.uid === bonus.uid)) {
          if (pickedTargets.length > 0) {
            pickedTargets = [...pickedTargets.slice(0, -1), bonus];
          } else {
            pickedTargets = [bonus];
          }
        } else if (bonus && !pickedTargets.some((picked) => picked.uid === bonus.uid)) {
          bonusTarget = bonus;
        }
      }
      pickedTargets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
        if (enemy.alive && (skill.evadeDebuffValue || 0) > 0 && (skill.evadeDebuffTurns || 0) > 0) {
          enemy.statuses.evadeDebuffTurns = Math.max(enemy.statuses.evadeDebuffTurns || 0, skill.evadeDebuffTurns as number);
          enemy.statuses.evadeDebuffValue = Math.max(enemy.statuses.evadeDebuffValue || 0, skill.evadeDebuffValue as number);
          scene.updateCombatUnitUi?.(enemy);
        }
      });
      if (bonusTarget) {
        scene.resolveDamage(attacker, bonusTarget, rawSkill, skill.damageType as string, `${skill.name} +`, skillOpts);
        if (bonusTarget.alive && (skill.evadeDebuffValue || 0) > 0 && (skill.evadeDebuffTurns || 0) > 0) {
          bonusTarget.statuses.evadeDebuffTurns = Math.max(bonusTarget.statuses.evadeDebuffTurns || 0, skill.evadeDebuffTurns as number);
          bonusTarget.statuses.evadeDebuffValue = Math.max(bonusTarget.statuses.evadeDebuffValue || 0, skill.evadeDebuffValue as number);
          scene.updateCombatUnitUi?.(bonusTarget);
        }
      }
      return true;
    }
    case "self_blood_hunt": {
      const hpCostPct = Math.max(0, Number(skill.selfHpCostPct || 0));
      const turns = Math.max(1, Math.round(Number(skill.turns || 2) || 2));
      const maxStacks = Math.max(1, Math.round(Number(skill.maxStacks || 2) || 2));
      const hpCost = Math.max(0, Math.round((attacker.maxHp ?? 0) * hpCostPct));
      attacker.hp = Math.max(1, (attacker.hp ?? 1) - hpCost);
      attacker.statuses.bloodHuntTurns = Math.max(attacker.statuses.bloodHuntTurns || 0, turns);
      attacker.statuses.bloodHuntStacks = Math.min(maxStacks, Math.max(0, attacker.statuses.bloodHuntStacks || 0) + 1);
      attacker.statuses.bloodHuntAntiHeal = skill.applyAntiHeal ? 1 : Math.max(attacker.statuses.bloodHuntAntiHeal || 0, 0);
      showText(scene, attacker, "SĂN MỒI", "#ff6b6b");
      updateUnit(scene, attacker);

      const maxTotalHits = Math.max(1, Math.round(Number(skill.maxTotalBasicHits || 1) || 1));
      const extraAttackChance = Math.max(0, Math.min(1, Number(skill.extraAttackChance || 0)));
      let totalHits = 0;
      while (target?.alive && totalHits < maxTotalHits) {
        totalHits += 1;
        await performFollowUpBasicAttack(scene, attacker, target);
        if (totalHits >= maxTotalHits || !target?.alive) break;
        if (!rollChance(scene, extraAttackChance)) break;
      }
      return true;
    }
    case "row_pack_followup": {
      applySelfAtkBuff(scene, attacker, skill);
      showText(scene, attacker, "TRU BẦY", "#ffd27a");
      updateUnit(scene, attacker);
      let currentTarget: UtilityUnit | null = target;
      await performFollowUpBasicAttack(scene, attacker, currentTarget);

      const rowAllies = allies.filter((ally) => ally.alive && ally.uid !== attacker.uid && ally.row === attacker.row);
      const supportAlly = rowAllies.find((ally) => ally.classType === "SUPPORT") ?? null;
      const archerAlly = rowAllies.find((ally) => ally.classType === "ARCHER") ?? null;
      const followupChance = Math.max(0, Math.min(1, Number(skill.followupChance || 0.3)));
      let skillFollowupConsumed = false;
      const nestedPackGuardActive = scene.__rowPackFollowupGuard === true;
      let alliedParticipants = 0;
      const pickNearestEnemyLocal = (origin: UtilityUnit | null) => {
        if (!origin) return null;
        return enemies
        .filter((enemy) => enemy.alive && enemy.uid !== origin.uid)
        .sort((a, b) => manhattan(origin, a) - manhattan(origin, b))[0] ?? null;
      };

      for (const ally of rowAllies) {
        if (!currentTarget?.alive && skill.retargetOnKill) {
          currentTarget = pickNearestEnemyLocal(currentTarget || target);
        }
        if (!currentTarget?.alive) break;
        let shouldFollow = rollChance(scene, followupChance);
        if (supportAlly && ally.uid === supportAlly.uid) shouldFollow = true;
        if (archerAlly && ally.uid === archerAlly.uid && skill.archerGuaranteedFollowup) shouldFollow = true;
        if (!shouldFollow) continue;

        let usedSkill = false;
        const targetHpRatio = (currentTarget.hp ?? 0) / Math.max(1, currentTarget.maxHp ?? 1);
        if (!nestedPackGuardActive && !skillFollowupConsumed) {
          if (
            supportAlly
            && ally.uid === supportAlly.uid
            && targetHpRatio <= Number(skill.supportSkillHpThreshold || 0.6)
          ) {
            scene.__rowPackFollowupGuard = true;
            usedSkill = await performFollowUpSkill(scene, ally, currentTarget);
            scene.__rowPackFollowupGuard = nestedPackGuardActive;
          }
          if (!usedSkill && archerAlly && ally.uid === archerAlly.uid && skill.archerSkillIfFullRage) {
            scene.__rowPackFollowupGuard = true;
            usedSkill = await performFollowUpSkill(scene, ally, currentTarget);
            scene.__rowPackFollowupGuard = nestedPackGuardActive;
          }
          if (usedSkill) skillFollowupConsumed = true;
        }

        if (!usedSkill) {
          await performFollowUpBasicAttack(scene, ally, currentTarget);
        }
        alliedParticipants += 1;
        if (!currentTarget?.alive && skill.retargetOnKill) {
          currentTarget = pickNearestEnemyLocal(currentTarget || target);
        }
      }
      if (
        currentTarget?.alive
        && alliedParticipants >= Math.max(1, Math.round(Number(skill.packMarkMinParticipants ?? 0) || 0))
      ) {
        if ((skill.packRageDrain || 0) > 0) {
          currentTarget.rage = Math.max(0, (currentTarget.rage || 0) - (skill.packRageDrain as number));
          showText(scene, currentTarget, `-${skill.packRageDrain} NỘ`, "#b8f5ff");
        }
        if ((skill.packArmorBreak || 0) > 0) {
          currentTarget.statuses.armorBreakTurns = Math.max(currentTarget.statuses.armorBreakTurns || 0, skill.packArmorBreakTurns || 2);
          currentTarget.statuses.armorBreakValue = Math.max(currentTarget.statuses.armorBreakValue || 0, skill.packArmorBreak as number);
          showText(scene, currentTarget, "ĐÁNH DẤU ĐÀN", "#d8f3ff");
        }
        updateUnit(scene, currentTarget);
      }
      if (currentTarget?.alive && (skill.finalPounceMultiplier || 0) > 0) {
        scene.resolveDamage(
          attacker,
          currentTarget,
          Math.max(0, Math.round(rawSkill * Number(skill.finalPounceMultiplier || 0))),
          skill.damageType || "physical",
          "VỒ CHỐT",
          { ...skillOpts, isSplash: true }
        );
      }
      scene.__rowPackFollowupGuard = nestedPackGuardActive;
      return true;
    }
    case "self_atk_and_assist": {
      attacker.statuses.atkBuffTurns = Math.max(attacker.statuses.atkBuffTurns || 0, skill.turns || 0);
      attacker.statuses.atkBuffValue = Math.max(attacker.statuses.atkBuffValue || 0, skill.selfAtkBuff || 0);
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType || "physical", skill.name as string, skillOpts);
      const helperPool = allies.filter((ally) => ally.uid !== attacker.uid && ally.row === attacker.row);
      const helper = skill.guaranteedAssistWithRangedAlly
        ? helperPool.find((ally) => (ally.range ?? 0) >= 2) || helperPool[0]
        : helperPool[0];
      const assistChance = helper && (helper.range ?? 0) >= 2 && skill.guaranteedAssistWithRangedAlly
        ? 1
        : Math.min(1, (skill.assistRate || 0) * starChanceMult);
      if (helper && target?.alive && rollChance(scene, assistChance)) {
        scene.resolveDamage(helper, target, scene.getEffectiveAtk(helper) * 0.8, "physical", "HỖ TRỢ", skillOpts);
        if ((skill.bonusAssistHits || 0) > 0 && (target.hp ?? 0) <= (target.maxHp ?? 0) * (skill.bonusAssistThresholdHpPct || 1)) {
          for (let i = 0; i < (skill.bonusAssistHits as number); i += 1) {
            if (!target.alive) break;
            scene.resolveDamage(helper, target, Math.round(scene.getEffectiveAtk(helper) * 0.55), "physical", "HỖ TRỢ+", { ...skillOpts, isSplash: true });
          }
        }
      }
      return true;
    }
    case "double_hit_gold_reward": {
      const hit1 = scene.calcSkillRaw?.(attacker, skill.hit1 || { base: 26, scaleStat: "atk", scale: 1.45 }) ?? rawSkill;
      const hit2 = scene.calcSkillRaw?.(attacker, skill.hit2 || { base: 22, scaleStat: "atk", scale: 1.25 }) ?? rawSkill;
      scene.resolveDamage(attacker, target, hit1, "physical", "HỎA ẤN 1", skillOpts);
      await scene.wait?.(120);
      const targetAliveAfterHit1 = target.alive;
      scene.resolveDamage(attacker, target, hit2, "physical", "HỎA ẤN 2", skillOpts);
      if (targetAliveAfterHit1 && !target.alive && attacker.side === "LEFT") {
          gainGoldWithCreative(scene.player, scene.aiMode, 1, { allowCreativeMutation: false });
        scene.showFloatingText(attacker.sprite?.x ?? 0, attacker.sprite?.y ?? 0 - 65, "+1 VÀNG", "#ffd700");
        scene.addLog?.(`${attacker.name} kết liễu ${target.name} và nhận 1 vàng!`);
      }
      return true;
    }
    case "assassin_execute_rage_refund": {
      const targetWasAlive = target.alive;
      scene.resolveDamage(attacker, target, rawSkill, skill.damageType as string, skill.name as string, skillOpts);
      if (targetWasAlive && !target.alive) {
        const refund = Math.ceil((attacker.rageMax ?? 0) * 0.5);
        attacker.rage = Math.min(attacker.rageMax ?? 100, (attacker.rage || 0) + refund);
        scene.showFloatingText(attacker.sprite?.x ?? 0, attacker.sprite?.y ?? 0 - 65, `+${refund} NỘ`, "#ff6b9d");
        if ((skill.evadePctOnKill || 0) > 0) {
          attacker.mods = attacker.mods || {};
          (attacker.mods as { evadePct?: number }).evadePct = Math.max((attacker.mods as { evadePct?: number }).evadePct || 0, skill.evadePctOnKill as number);
          scene.updateCombatUnitUi?.(attacker);
        }
        if (attacker.side === "LEFT") {
          gainGoldWithCreative(scene.player, scene.aiMode, 5, { allowCreativeMutation: false });
          scene.showFloatingText(attacker.sprite?.x ?? 0, attacker.sprite?.y ?? 0 - 85, "+5 VÀNG", "#ffd700");
          scene.addLog?.(`${attacker.name} kết liễu ${target.name} và nhận 5 vàng!`);
        }
        const remainingEnemies = scene.getCombatUnits(attacker.side === "LEFT" ? "RIGHT" : "LEFT");
        if (remainingEnemies.length > 0) {
          const newTarget = scene.selectTarget?.(attacker);
          if (newTarget) {
            scene.addLog?.(`${attacker.name} tấn công tiếp!`);
            await scene.basicAttack?.(attacker, newTarget);
          }
        }
      }
      return true;
    }
    case "true_single": {
      const damage = Number(target?.shield ?? 0) > 0 && (skill.bonusVsShieldedMultiplier || 0) > 0
        ? Math.round(rawSkill * (skill.bonusVsShieldedMultiplier as number))
        : rawSkill;
      scene.resolveDamage(attacker, target, damage, "true", skill.name as string, skillOpts);
      if ((skill.shieldBreakPctBonus || 0) > 0 && Number(target?.shield ?? 0) > 0) {
        target.shield = Math.max(0, (target.shield ?? 0) - Math.round((target.shield ?? 0) * (skill.shieldBreakPctBonus as number)));
        scene.updateCombatUnitUi?.(target);
      }
      return true;
    }
    default:
      return false;
  }
}
