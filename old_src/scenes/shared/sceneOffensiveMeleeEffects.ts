import { getStarDotDamage, getStarTurns, manhattan } from "../../core/gameUtils.js";
import { applyOffenseDebuffStatus, getOffenseDebuffState } from "../../core/offenseDebuff.js";
import {
  buildSkillSelectionOptions,
  collectUnitsBySelector,
  type SkillTargetUnit
} from "./sceneSkillTargeting.js";
import type Phaser from "phaser";

interface SkillOpts {
  isSplash?: boolean;
  armorPen?: number;
  [key: string]: unknown;
}

interface CombatUnitMods {
  accuracyPct?: number;
  evadePct?: number;
  [key: string]: number | undefined;
}

interface CombatUnitStatuses {
  stun?: number;
  sleep?: number;
  silence?: number;
  freeze?: number;
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
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  silenceTurns?: number;
  tauntTurns?: number;
  tauntTargetId?: string;
  scavengeMarkTurns?: number;
  scavengeMarkDamageMultiplier?: number;
  scavengeMarkRageDrain?: number;
  scavengeMarkEvadeDebuffTurns?: number;
  scavengeMarkEvadeDebuffValue?: number;
  damageReductionTurns?: number;
  healReductionTurns?: number;
  offenseDebuffTurns?: number;
  offenseDebuffValue?: number;
  offenseDebuffMode?: string;
  offenseDebuffStat?: string;
  atkDebuffTurns?: number;
  atkDebuffValue?: number;
  [key: string]: unknown;
}

interface CombatUnit extends SkillTargetUnit {
  sprite?: { x: number; y: number; active?: boolean };
  rageMax: number;
  rage: number;
  row: number;
  col: number;
  homeCol?: number;
  side?: "LEFT" | "RIGHT";
  range?: number;
  mods?: CombatUnitMods;
  tribe?: string;
  statuses: CombatUnitStatuses;
  star?: number;
}

interface CombatSkill {
  effect: string;
  name?: string;
  damageType?: string;
  damageScope?: string;
  targetSelector?: string;
  debuffTargetSelector?: string;
  stunSelector?: string;
  stunChance?: number;
  stunTurns?: number;
  stunMaxTargets?: number;
  debuffMaxTargets?: number;
  freezeChance?: number;
  freezeTurns?: number;
  freezeBaseTargets?: number;
  freezeMaxTargets?: number;
  freezeBonusTargetSelector?: string;
  spreadTargetSelector?: string;
  silenceChance?: number;
  silenceTurns?: number;
  silenceMaxTargets?: number;
  sleepChance?: number;
  sleepTurns?: number;
  sleepBonusTurnsIfDebuffed?: number;
  accuracyDebuffPct?: number;
  accuracyDebuffTurns?: number;
  offenseDebuffValue?: number;
  atkDebuffValue?: number;
  offenseDebuffPct?: number;
  offenseDebuffMode?: string;
  offenseDebuffTurns?: number;
  burnTurns?: number;
  burnPerTurn?: number;
  poisonTurns?: number;
  poisonPerTurn?: number;
  bleedTurns?: number;
  bleedDamage?: number;
  bleedSplashCount?: number;
  bleedSplashDamageMultiplier?: number;
  bleedSplashTurns?: number;
  bleedSplashDamage?: number;
  healBlockTurns?: number;
  rageDrainOnHit?: number;
  rageDrain?: number;
  rageGain?: number;
  rageDrainStrongestDebuffed?: number;
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
  diseaseTurns?: number;
  diseaseDamage?: number;
  spreadDiseaseCount?: number;
  spreadDiseaseDamage?: number;
  spreadDiseaseTurns?: number;
  spreadIfTargetHpPctBelow?: number;
  healReductionTurns?: number;
  healReductionPct?: number;
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
  maxHp?: number;
  turns?: number;
  atk?: number;
  def?: number;
  matk?: number;
  mdef?: number;
  range?: number;
  col?: number;
  row?: number;
  uid?: string | number;
  maxHits?: number;
  bounceSelector?: string;
  uniqueTargets?: boolean;
  damageFalloff?: number;
  rageDrainPerHit?: number;
  rageDrainFirstTarget?: number;
  rageDrainBounceCount?: number;
  silenceLastHitTurns?: number;
  silenceIfHitsAtLeast?: number;
  reboundIfHitsAtLeast?: number;
  reboundDamageMultiplier?: number;
  healPct?: number;
  healPctDamage?: number;
  selfShieldValue?: number;
  tauntTurns?: number;
  followUpDamageMultiplier?: number;
  hitCount?: number;
  highRageThreshold?: number;
  stunChanceHighRageBonus?: number;
  rageGainOnHit?: number;
  rageGainOnKill?: number;
  rageGainOnSpreadTrigger?: number;
  scavengeMarkTurns?: number;
  scavengeMarkDamageMultiplier?: number;
  scavengeMarkRageDrain?: number;
  scavengeMarkEvadeDebuffTurns?: number;
  scavengeMarkEvadeDebuffValue?: number;
  markHpThreshold?: number;
  killTransferCount?: number;
  killTransferDamageMultiplier?: number;
  deathMarkLostHpRatio?: number;
  spreadMarkOnKill?: boolean;
  isolatedArmorPenPct?: number;
  isolatedRageDrain?: number;
  evadeBuff?: number;
  evadePct?: number;
  retargetOnKill?: boolean;
  retargetDamageMultiplier?: number;
  retargetBleedTurns?: number;
  retargetBleedDamage?: number;
  bonusRageDrain?: number;
  bonusRageDrainHpBelowPct?: number;
  armorPen?: number;
  killSplashBurnDamage?: number;
  killSplashBurnTurns?: number;
  killSplashMaxTargets?: number;
  swarmBonusPctPerAlly?: number;
  [key: string]: unknown;
}

interface CombatSceneLike extends Phaser.Scene {
  rollChance?: (chance: number) => boolean;
  pickRandom?: <T>(list: T[]) => T;
  random?: () => number;
  player?: { gold?: number };
  getStarSkillMultiplier: (star: number) => number;
  getEffectiveAtk: (unit: SkillTargetUnit) => number;
  getEffectiveMatk: (unit: SkillTargetUnit) => number;
  resolveDamage: (
    attacker: CombatUnit,
    target: CombatUnit,
    amount: number,
    damageType: string,
    label: string,
    skillOpts?: SkillOpts
  ) => number;
  healUnit: (healer: CombatUnit, target: CombatUnit, amount: number, label: string) => void;
  updateCombatUnitUi: (unit: CombatUnit) => void;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  addShield?: (unit: CombatUnit, value: number) => void;
  [key: string]: unknown;
}

interface CombatSkillContext {
  attacker?: CombatUnit;
  target?: CombatUnit;
  skill: CombatSkill;
  rawSkill: number;
  skillOpts?: SkillOpts;
  enemies: CombatUnit[];
  allies?: CombatUnit[];
  starChanceMult?: number;
  areaBonus?: number;
  targetBonus?: number;
  [key: string]: unknown;
}

function showText(scene: CombatSceneLike, unit: CombatUnit, text: string, color: string) {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText(unit.sprite.x, unit.sprite.y - 45, text, color);
}

function updateUnit(scene: CombatSceneLike, unit: CombatUnit) {
  scene.updateCombatUnitUi(unit);
}

function rollChance(scene: CombatSceneLike, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function resolveOffenseDebuffAmount(scene: CombatSceneLike, enemy: CombatUnit, skill: CombatSkill): number {
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

function hasAnyDebuff(unit: CombatUnit | null | undefined): boolean {
  if (!unit) return false;
  const statuses = unit.statuses ?? {};
  return [
    "stun",
    "sleep",
    "silence",
    "freeze",
    "burnTurns",
    "poisonTurns",
    "bleedTurns",
    "diseaseTurns",
    "armorBreakTurns",
    "healReductionTurns",
    "damageReductionTurns"
  ].some((key) => Number(statuses[key] ?? 0) > 0) || getOffenseDebuffState(statuses, unit).turns > 0;
}

export function applySharedOffensiveMeleeEffect(scene: unknown, context: Record<string, unknown>): boolean {
  const s = scene as CombatSceneLike;
  const ctx = context as unknown as CombatSkillContext;
  const { attacker, target, skill, rawSkill, skillOpts, enemies, allies = [] } = ctx;
  if (!attacker || !skill) return false;

  const star: number = Number(attacker?.star ?? 1) || 1;
  const starScale = s.getStarSkillMultiplier(star);

  switch (skill.effect) {
    case "roar_debuff_heal": {
      const isV3 = skill.runtimeShapeVersion === 3;
      const maxTargets = isV3
        ? Math.max(1, Math.round(skill.maxTargets || 1))
        : Math.min(3, Math.max(1, star));
      const debuffValue = isV3
        ? Math.max(1, Math.round(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 20))
        : Math.max(1, Math.round(20 * starScale));
      const affectedEnemies = enemies
        .filter((enemy) => enemy.alive)
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))
        .slice(0, maxTargets);
      affectedEnemies.forEach((enemy) => {
          applyOffenseDebuffStatus(enemy, {
            turns: isV3
              ? Math.max(1, Math.round(skill.offenseDebuffTurns ?? skill.turns ?? 3))
              : getStarTurns(star, skill.offenseDebuffTurns ?? skill.turns ?? 3),
            value: debuffValue,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          showText(s, enemy, "SỢ HÃI", "#ffaaaa");
          updateUnit(s, enemy);
        });
      if ((skill.rageDrainStrongestDebuffed || 0) > 0) {
        const strongest = [...affectedEnemies]
          .filter((enemy) => enemy?.alive)
          .sort((a, b) => {
            const aUsesMatk = ["MAGE", "SUPPORT"].includes(String(a?.classType ?? "").trim().toUpperCase());
            const bUsesMatk = ["MAGE", "SUPPORT"].includes(String(b?.classType ?? "").trim().toUpperCase());
            const aPower = aUsesMatk ? (s.getEffectiveMatk?.(a) ?? a?.matk ?? 0) : (s.getEffectiveAtk?.(a) ?? a?.atk ?? 0);
            const bPower = bUsesMatk ? (s.getEffectiveMatk?.(b) ?? b?.matk ?? 0) : (s.getEffectiveAtk?.(b) ?? b?.atk ?? 0);
            return bPower - aPower;
          })[0];
        if (strongest) {
          strongest.rage = Math.max(0, (strongest.rage || 0) - (skill.rageDrainStrongestDebuffed ?? 0));
          showText(s, strongest, `-${skill.rageDrainStrongestDebuffed ?? 0} NỘ`, "#b8f5ff");
          updateUnit(s, strongest);
        }
      }
      const selfHeal = isV3
        ? Math.round((attacker.maxHp ?? 0) * (skill.healPctMaxHp || 0.1))
        : Math.round((attacker.maxHp ?? 0) * 0.1 * starScale);
      s.healUnit(attacker, attacker, selfHeal, "GẦM GỪ");
      if ((skill.selfShieldValue || 0) > 0) {
        s.addShield?.(attacker, Math.max(1, Math.round(Number(skill.selfShieldValue || 0))));
        showText(s, attacker, `+${Math.max(1, Math.round(Number(skill.selfShieldValue || 0)))} KHIÊN`, "#83e5ff");
      }
      if ((skill.tauntTurns || 0) > 0) {
        enemies
          .filter((enemy) => enemy.alive)
          .forEach((enemy) => {
            enemy.statuses.tauntTargetId = String(attacker.uid ?? "");
            enemy.statuses.tauntTurns = Math.max(enemy.statuses.tauntTurns || 0, skill.tauntTurns ?? 0);
            updateUnit(s, enemy);
          });
        showText(s, attacker, "KHIÊU KHÍCH", "#ffd97b");
      }
      return true;
    }
    case "single_silence_lock": {
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const maxTargets = Math.max(1, Math.round(Number(skill.maxTargets ?? 1) || 1));
      const targets: CombatUnit[] = skill.runtimeShapeVersion === 3
        ? (collectUnitsBySelector(
            aliveEnemies,
            skill.targetSelector || "front",
            maxTargets,
            {
              ...buildSkillSelectionOptions(s, attacker, target, skill),
              targetClasses: skill.targetClasses
            }
          ) as CombatUnit[])
        : (target ? [target] : []);
      const silenceTurns = Math.max(1, Math.round(Number(skill.turns || 2) || 2));
      const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? silenceTurns) || 0));
      targets.forEach((enemy) => {
        s.resolveDamage(attacker, enemy, rawSkill, skill.damageType || "physical", skill.name ?? "", skillOpts);
        if (!enemy.alive) return;
        enemy.statuses.silence = Math.max(enemy.statuses.silence || 0, silenceTurns);
        const offenseDebuffAmount = resolveOffenseDebuffAmount(s, enemy, skill);
        if (offenseDebuffAmount > 0 && offenseDebuffTurns > 0) {
          applyOffenseDebuffStatus(enemy, {
            turns: offenseDebuffTurns,
            value: offenseDebuffAmount,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
        }
        showText(s, enemy, "KHÓA SKILL", "#ff6b9d");
        updateUnit(s, enemy);
      });
      return true;
    }
    case "backstab_crit": {
      if (!target) return true;
      const behind = (attacker.side === "LEFT" && attacker.col > target.col) || (attacker.side === "RIGHT" && attacker.col < target.col);
      const firstHit = behind ? rawSkill * 1.5 : rawSkill;
      s.resolveDamage(attacker, target, firstHit, "physical", behind ? "CẮN GÁY!" : (skill.name ?? ""), { ...skillOpts, armorPen: skill.armorPen || 0 });
      if (target.alive && (skill.followUpDamageMultiplier || 0) > 0) {
        s.resolveDamage(attacker, target, Math.round(rawSkill * (skill.followUpDamageMultiplier ?? 0)), "physical", "BÓNG CHÉM", { ...skillOpts, isSplash: true, armorPen: skill.armorPen || 0 });
      }
      return true;
    }
    case "scavenge_heal": {
      if (!target) return true;
      const markTurns = Math.max(1, Math.round(Number(skill.scavengeMarkTurns ?? 2) || 2));
      const markDamageMultiplier = Math.max(1, Number(skill.scavengeMarkDamageMultiplier ?? 1.3) || 1.3);
      const markRageDrain = Math.max(0, Math.round(Number(skill.scavengeMarkRageDrain ?? 1) || 1));
      const markEvadeDebuffTurns = Math.max(0, Math.round(Number(skill.scavengeMarkEvadeDebuffTurns ?? 0) || 0));
      const markEvadeDebuffValue = Math.max(0, Number(skill.scavengeMarkEvadeDebuffValue ?? skill.scavengeMarkEvadeDebuffPct ?? 0) || 0);
      const killTransferCount = Math.max(0, Math.round(Number(skill.killTransferCount ?? 0) || 0));
      const killTransferDamageMultiplier = Math.max(0, Number(skill.killTransferDamageMultiplier ?? 0) || 0);
      const healPctDamage = Math.max(0, Number(skill.healPctDamage ?? 0.2) || 0.2);
      const wasMarked = (target.statuses?.scavengeMarkTurns ?? 0) > 0;
      const wasAlive = target.alive;
      const resolvedDamage = wasMarked ? Math.max(1, Math.round(rawSkill * markDamageMultiplier)) : rawSkill;
      s.resolveDamage(attacker, target, resolvedDamage, "physical", skill.name ?? "", skillOpts);
      if (wasMarked && markRageDrain > 0) {
        target.rage = Math.max(0, (target.rage || 0) - markRageDrain);
        showText(s, target, `-${markRageDrain} NỘ`, "#b8f5ff");
        updateUnit(s, target);
      }
      if (wasAlive && !target.alive) {
        s.healUnit(attacker, attacker, Math.round(resolvedDamage * healPctDamage), "XÉ XÁC");
        if (killTransferCount > 0 && killTransferDamageMultiplier > 0) {
          const transferTargets = (collectUnitsBySelector(
            enemies.filter((enemy) => enemy.alive && enemy.uid !== target.uid),
            "nearest",
            killTransferCount,
            buildSkillSelectionOptions(s, attacker, target, skill, {
              requireBackline: true,
              preferBackline: true,
              preferRanged: true
            })
          ) as CombatUnit[]).filter((enemy) => enemy?.alive);
          transferTargets.forEach((enemy) => {
            s.resolveDamage(
              attacker,
              enemy,
              Math.max(1, Math.round(rawSkill * killTransferDamageMultiplier)),
              "physical",
              "MỔ VỌT",
              { ...skillOpts, isSplash: true }
            );
            updateUnit(s, enemy);
          });
        }
      } else if (target.alive) {
        const markHpThreshold = Math.max(0, Number(skill.markHpThreshold ?? 0.5) || 0.5);
        if ((target.hp ?? 0) <= Math.max(1, (target.maxHp ?? 0) * markHpThreshold)) {
          target.statuses.scavengeMarkTurns = Math.max(target.statuses.scavengeMarkTurns || 0, markTurns);
          target.statuses.scavengeMarkDamageMultiplier = Math.max(target.statuses.scavengeMarkDamageMultiplier || 0, markDamageMultiplier);
          target.statuses.scavengeMarkRageDrain = Math.max(target.statuses.scavengeMarkRageDrain || 0, markRageDrain);
          if (markEvadeDebuffTurns > 0 && markEvadeDebuffValue > 0) {
            target.statuses.evadeDebuffTurns = Math.max(target.statuses.evadeDebuffTurns || 0, markEvadeDebuffTurns);
            target.statuses.evadeDebuffValue = Math.max(target.statuses.evadeDebuffValue || 0, markEvadeDebuffValue);
          }
          showText(s, target, "ĐÁNH DẤU", "#d7c4ff");
          updateUnit(s, target);
        } else if (wasMarked) {
          target.statuses.scavengeMarkTurns = 0;
          target.statuses.scavengeMarkDamageMultiplier = 0;
          target.statuses.scavengeMarkRageDrain = 0;
          target.statuses.scavengeMarkEvadeDebuffTurns = 0;
          target.statuses.scavengeMarkEvadeDebuffValue = 0;
        }
      }
      return true;
    }
    case "death_mark": {
      if (!target) return true;
      s.resolveDamage(attacker, target, rawSkill, skill.damageType || "physical", skill.name ?? "", skillOpts);
      if (target.alive) {
        const markDamage = Math.round(Math.max(0, (target.maxHp || 0) - (target.hp || 0)) * (skill.deathMarkLostHpRatio || 0.25));
        target.statuses.diseaseTurns = Math.max(target.statuses.diseaseTurns || 0, skill.turns || 2);
        target.statuses.diseaseDamage = Math.max(target.statuses.diseaseDamage || 0, markDamage);
        showText(s, target, "TỬ THẦN", "#ff0000");
        updateUnit(s, target);
      } else if (skill.spreadMarkOnKill) {
        const spreadTarget = enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid && (
            getOffenseDebuffState(enemy.statuses, enemy).turns > 0 ||
            (enemy.statuses.armorBreakTurns ?? 0) > 0 ||
            (enemy.statuses.poisonTurns ?? 0) > 0 ||
            (enemy.statuses.burnTurns ?? 0) > 0 ||
            (enemy.statuses.diseaseTurns ?? 0) > 0
          ))
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))[0];
        if (spreadTarget) {
          const spreadDamage = Math.round(Math.max(0, (spreadTarget.maxHp || 0) - (spreadTarget.hp || 0)) * (skill.deathMarkLostHpRatio || 0.25));
          spreadTarget.statuses.diseaseTurns = Math.max(spreadTarget.statuses.diseaseTurns || 0, skill.turns || 2);
          spreadTarget.statuses.diseaseDamage = Math.max(spreadTarget.statuses.diseaseDamage || 0, spreadDamage);
          updateUnit(s, spreadTarget);
        }
      }
      return true;
    }
    case "quick_strike_rage": {
      if (!target) return true;
      s.resolveDamage(attacker, target, rawSkill, "physical", "ĐÂM NHANH", skillOpts);
      if (target.alive) {
        const accuracyDebuffPct = Math.max(0, Number(skill.accuracyDebuffPct ?? 0) || 0);
        const accuracyDebuffTurns = Math.max(0, Math.round(Number(skill.accuracyDebuffTurns ?? 0) || 0));
        if (accuracyDebuffPct > 0 && accuracyDebuffTurns > 0) {
          target.mods = target.mods ?? {}; target.mods.accuracyPct = Math.min(Number(target.mods.accuracyPct ?? 0) || 0, -accuracyDebuffPct);
          showText(s, target, "MẤT CHÍNH XÁC", "#d7c4ff");
          updateUnit(s, target);
        }
        if (
          (skill.bonusRageDrain ?? 0) > 0
          && Number(target.hp ?? 0) <= Math.max(1, Number(target.maxHp ?? 0) * Number(skill.bonusRageDrainHpBelowPct ?? 0))
        ) {
          target.rage = Math.max(0, (target.rage || 0) - (skill.bonusRageDrain ?? 0));
          showText(s, target, `-${skill.bonusRageDrain ?? 0} NỘ`, "#b8f5ff");
          updateUnit(s, target);
        }
      }
      const rageGain = skill.rageGain || 5;
      attacker.rage = Math.min(attacker.rageMax, attacker.rage + rageGain);
      showText(s, attacker, `+${rageGain} NỘ`, "#b8f5ff");
      updateUnit(s, attacker);
      if (!target.alive && (skill.retargetOnKill || false) && (skill.retargetDamageMultiplier || 0) > 0) {
        const followTarget = enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .sort((a, b) => {
            const aBacklineBias = attacker.side === "LEFT" ? b.col - a.col : a.col - b.col;
            if (aBacklineBias !== 0) return aBacklineBias;
            return manhattan(target, a) - manhattan(target, b);
          })[0];
        if (followTarget) {
          s.resolveDamage(
            attacker,
            followTarget,
            Math.max(1, Math.round(rawSkill * Number(skill.retargetDamageMultiplier || 0))),
            "physical",
            "TRUY KÍCH",
            { ...skillOpts, isSplash: true }
          );
          updateUnit(s, followTarget);
        }
      }
      return true;
    }
    case "stealth_strike": {
      if (!target) return true;
      const isIsolated = !enemies.some((enemy) => enemy.alive && enemy.uid !== target.uid && manhattan(enemy, target) <= 1);
      const armorPen = isIsolated ? Math.max(0, Number(skill.isolatedArmorPenPct ?? 0) || 0) : 0;
      s.resolveDamage(attacker, target, rawSkill, "physical", "ẨN ĐÁNH", armorPen > 0 ? { ...skillOpts, armorPen } : skillOpts);
      if (target.alive && isIsolated && (skill.isolatedRageDrain ?? 0) > 0) {
        target.rage = Math.max(0, (target.rage || 0) - (skill.isolatedRageDrain ?? 0));
        showText(s, target, `-${skill.isolatedRageDrain ?? 0} NỘ`, "#b8f5ff");
        updateUnit(s, target);
      }
      const evadePct = Math.max(0, Math.min(0.6, skill.evadePct ?? skill.evadeBuff ?? 0.25));
      attacker.mods = attacker.mods ?? {}; attacker.mods.evadePct = Math.max(attacker.mods.evadePct || 0, evadePct);
      showText(s, attacker, "ẨN MÌNH", "#d4bcff");
      updateUnit(s, attacker);
      if (!target.alive && (skill.followUpDamageMultiplier || 0) > 0) {
        const followTarget = enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .sort((a, b) => {
            const aBacklineBias = attacker.side === "LEFT" ? b.col - a.col : a.col - b.col;
            if (aBacklineBias !== 0) return aBacklineBias;
            return manhattan(target, a) - manhattan(target, b);
          })[0];
        if (followTarget) {
          s.resolveDamage(
            attacker,
            followTarget,
            Math.max(1, Math.round(rawSkill * Number(skill.followUpDamageMultiplier || 0))),
            "physical",
            "TRUY SÁT",
            { ...skillOpts, isSplash: true }
          );
          updateUnit(s, followTarget);
        }
      }
      return true;
    }
    case "sting_paralyze": {
      if (!target) return true;
      s.resolveDamage(attacker, target, rawSkill, "physical", "CHÍCH", skillOpts);
      const rageBonus = (skill.highRageThreshold ?? 0) > 0 && (target.rage || 0) >= (skill.highRageThreshold ?? 0)
        ? (skill.stunChanceHighRageBonus || 0)
        : 0;
      if (target.alive && rollChance(s, Math.min(1, (skill.stunChance || 0.40) + rageBonus))) {
        target.statuses.stun = Math.max(target.statuses.stun || 0, skill.stunTurns || 1);
        if ((skill.rageDrain ?? 0) > 0) {
          target.rage = Math.max(0, (target.rage || 0) - (skill.rageDrain ?? 0));
        }
        showText(s, target, "TÊ LIỆT", "#ffd97b");
        updateUnit(s, target);
      }
      return true;
    }
    case "double_poison_hit": {
      if (!target) return true;
      const hitCount = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.hitCount || 2) || 2))
        : 2;
      const poisonTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.poisonTurns ?? 2) || 2))
        : getStarTurns(star, 3);
      const poisonDamage = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.poisonPerTurn ?? 8) || 8))
        : getStarDotDamage(star, 10);
      for (let i = 0; i < hitCount; i += 1) {
        if (!target.alive) break;
        s.resolveDamage(attacker, target, rawSkill, "physical", `ĐỘC ${i + 1}`, skillOpts);
        if (target.alive) {
          target.statuses.poisonTurns = Math.max(target.statuses.poisonTurns || 0, poisonTurns);
          if (skill.runtimeShapeVersion === 3) {
            target.statuses.poisonDamage = Math.max(target.statuses.poisonDamage || 0, poisonDamage);
          } else {
            target.statuses.poisonDamage = (target.statuses.poisonDamage || 0) + poisonDamage;
          }
          updateUnit(s, target);
        }
      }
      return true;
    }
    case "flame_combo":
    case "flame_combo_assassin": {
      if (!target) return true;
      const burnTurns = Math.max(0, Math.round(Number(skill.burnTurns ?? skill.poisonTurns ?? 2) || 0));
      const burnPerTurn = Math.max(0, Math.round(Number(skill.burnPerTurn ?? skill.poisonPerTurn ?? 15) || 0));
      s.resolveDamage(attacker, target, rawSkill, "physical", "LỬA CÁO", skillOpts);
      if (target.alive && burnTurns > 0 && burnPerTurn > 0) {
        target.statuses.burnTurns = Math.max(target.statuses.burnTurns || 0, burnTurns);
        target.statuses.burnDamage = Math.max(target.statuses.burnDamage || 0, burnPerTurn);
        showText(s, target, "ĐỐT CHÁY", "#ff6600");
        updateUnit(s, target);
      } else if ((skill.killSplashBurnDamage || 0) > 0) {
        enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.killSplashMaxTargets || 1)
          .forEach((enemy) => {
            enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, skill.killSplashBurnTurns || 2);
            enemy.statuses.burnDamage = Math.max(enemy.statuses.burnDamage || 0, skill.killSplashBurnDamage ?? 0);
            showText(s, enemy, "LỬA LAN", "#ff8a2a");
            updateUnit(s, enemy);
          });
      }
      return true;
    }
    case "x_slash_bleed": {
      if (!target) return true;
      const isExactRuntime = skill.runtimeShapeVersion === 3;
      const liveSwarmCount = allies.filter((ally) => ally.alive && ally.tribe === "SWARM").length;
      const swarmBonusPctPerAlly = Math.max(0, Number(skill.swarmBonusPctPerAlly || 0) || 0);
      const exactDamage = isExactRuntime
        ? Math.round(rawSkill * (1 + (liveSwarmCount * swarmBonusPctPerAlly)))
        : rawSkill;
      s.resolveDamage(attacker, target, exactDamage, "physical", "KIẾM X", skillOpts);
      if (target.alive) {
        const bleedTurns = isExactRuntime
          ? Math.max(1, Math.round(Number(skill.bleedTurns ?? skill.poisonTurns ?? skill.turns ?? 3) || 3))
          : getStarTurns(star, skill.turns || 3);
        const bleedDamage = isExactRuntime
          ? Math.max(1, Math.round(Number(skill.bleedDamage ?? skill.poisonPerTurn ?? 12) || 12))
          : Math.round(s.getEffectiveAtk(attacker) * 0.35 * starScale);
        target.statuses.bleedTurns = Math.max(target.statuses.bleedTurns || 0, bleedTurns);
        target.statuses.bleedDamage = Math.max(target.statuses.bleedDamage || 0, bleedDamage);
        if (star >= 2 && liveSwarmCount >= 2) {
          target.statuses.armorBreakTurns = Math.max(target.statuses.armorBreakTurns || 0, Math.max(1, Math.round(Number(skill.armorBreakTurns ?? 2) || 2)));
          target.statuses.armorBreakValue = Math.max(target.statuses.armorBreakValue || 0, Math.max(1, Math.round(Number(skill.armorBreakValue ?? 15) || 15)));
          target.rage = Math.max(0, (target.rage || 0) - Math.max(1, Math.round(Number(skill.rageDrain ?? 1) || 1)));
          showText(s, target, "-1 NỘ", "#9fe8ff");
        }
        showText(s, target, "CHẢY MÁU", "#ff4444");
        updateUnit(s, target);
      }
      const shouldChain = star >= 3 && (!target.alive || liveSwarmCount >= 3);
      if (!shouldChain) return true;
      const chainTarget = enemies
        .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
        .sort((a, b) => {
          const aBacklineBias = attacker.side === "LEFT" ? b.col - a.col : a.col - b.col;
          if (aBacklineBias !== 0) return aBacklineBias;
          const aDist = Math.abs((target.row ?? attacker.row ?? 0) - a.row) + Math.abs((target.col ?? attacker.col ?? 0) - a.col);
          const bDist = Math.abs((target.row ?? attacker.row ?? 0) - b.row) + Math.abs((target.col ?? attacker.col ?? 0) - b.col);
          return aDist - bDist;
        })[0] ?? null;
      if (chainTarget) {
        const chainDamage = Math.max(1, Math.round(rawSkill * Number(skill.retargetDamageMultiplier ?? 0.8)));
        s.resolveDamage(attacker, chainTarget, chainDamage, "physical", "TRUY CHÉM", { ...skillOpts, isSplash: true });
        if (chainTarget.alive) {
          chainTarget.statuses.bleedTurns = Math.max(chainTarget.statuses.bleedTurns || 0, Math.max(1, Math.round(Number(skill.retargetBleedTurns ?? 2) || 2)));
          chainTarget.statuses.bleedDamage = Math.max(chainTarget.statuses.bleedDamage || 0, Math.max(1, Math.round(Number(skill.retargetBleedDamage ?? 16) || 16)));
          showText(s, chainTarget, "CHẢY MÁU", "#ff4444");
          updateUnit(s, chainTarget);
        }
      }
      return true;
    }
    case "web_trap_slow": {
      if (!target) return true;
      s.resolveDamage(attacker, target, rawSkill, "physical", "MẠNG TƠ", skillOpts);
      if (target.alive) {
        applyOffenseDebuffStatus(target, {
          turns: getStarTurns(star, skill.offenseDebuffTurns ?? skill.turns ?? 2),
          value: Math.round((skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 20) * starScale),
          mode: skill.offenseDebuffMode ?? "autoByRole"
        });
        showText(s, target, "MẮC BẪY", "#ffffff");
        updateUnit(s, target);
      }
      return true;
    }
    case "silent_kill_stealth": {
      if (!target) return true;
      const wasAlive = target.alive;
      const targetHasDebuff = hasAnyDebuff(target);
      const armorPen = targetHasDebuff && star >= 2 ? (star >= 3 ? 0.35 : 0.25) : 0;
      s.resolveDamage(attacker, target, rawSkill, "physical", "ÁM SÁT", armorPen > 0 ? { ...skillOpts, armorPen } : skillOpts);
      if (target.alive) {
        const accuracyDebuffPct = Math.max(0, Number(skill.accuracyDebuffPct ?? 0) || 0);
        const accuracyDebuffTurns = Math.max(0, Math.round(Number(skill.accuracyDebuffTurns ?? 0) || 0));
        if (accuracyDebuffPct > 0 && accuracyDebuffTurns > 0) {
          target.mods = target.mods ?? {}; target.mods.accuracyPct = Math.min(Number(target.mods.accuracyPct ?? 0) || 0, -accuracyDebuffPct);
          showText(s, target, "MẤT CHÍNH XÁC", "#d7c4ff");
          updateUnit(s, target);
        }
        if (targetHasDebuff && star >= 2) {
          target.statuses.silence = Math.max(target.statuses.silence || 0, Math.max(1, Math.round(Number(skill.silenceTurns ?? 1) || 1)));
          showText(s, target, "IM LẶNG", "#9dffba");
          updateUnit(s, target);
        }
      }
      if (wasAlive && !target.alive) {
        attacker.mods = attacker.mods ?? {}; attacker.mods.evadePct = Math.max(attacker.mods.evadePct || 0, 0.3);
        attacker.rage = Math.min(attacker.rageMax || 0, (attacker.rage || 0) + 1);
        showText(s, attacker, "+1 NỘ", "#b8f5ff");
        showText(s, attacker, "TÀNG HÌNH", "#d4bcff");
        updateUnit(s, attacker);
      }
      const shouldDash = star >= 3 && (wasAlive && (!target.alive || Number(target.hp ?? 0) <= Math.max(1, Number(target.maxHp ?? 0) * 0.4)));
      if (!shouldDash) return true;
      const followTarget = enemies
        .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
        .sort((a, b) => {
          const aBacklineBias = attacker.side === "LEFT" ? b.col - a.col : a.col - b.col;
          if (aBacklineBias !== 0) return aBacklineBias;
          const aDist = Math.abs((target.row ?? attacker.row ?? 0) - a.row) + Math.abs((target.col ?? attacker.col ?? 0) - a.col);
          const bDist = Math.abs((target.row ?? attacker.row ?? 0) - b.row) + Math.abs((target.col ?? attacker.col ?? 0) - b.col);
          return aDist - bDist;
        })[0] ?? null;
      if (followTarget) {
        s.resolveDamage(attacker, followTarget, Math.max(1, Math.round(rawSkill * 0.7)), skill.damageType ?? "physical", "TRUY BÁM", { ...skillOpts, isSplash: true });
        if (followTarget.alive) {
          followTarget.rage = Math.max(0, (followTarget.rage || 0) - 1);
          showText(s, followTarget, "-1 NỘ", "#9fe8ff");
          updateUnit(s, followTarget);
        }
      }
      return true;
    }
    default:
      return false;
  }
}
