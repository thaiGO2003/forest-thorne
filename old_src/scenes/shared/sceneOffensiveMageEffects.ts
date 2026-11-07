import { getGoldReserveScaling, getStarDotDamage, getStarTurns, manhattan } from "../../core/gameUtils.js";
import { applyOffenseDebuffStatus, getOffenseDebuffState } from "../../core/offenseDebuff.js";
import {
  buildSkillSelectionOptions,
  collectUnitsBySelector,
  collectUnitsInAoeSquare,
  collectUnitsInSameColumn,
  type BuildSkillSelectionScene,
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
  silence?: number;
  freeze?: number;
  sleep?: number;
  stun?: number;
  burnTurns?: number;
  burnDamage?: number;
  diseaseTurns?: number;
  diseaseDamage?: number;
  poisonTurns?: number;
  poisonDamage?: number;
  bleedTurns?: number;
  bleedDamage?: number;
  armorBreakTurns?: number;
  armorBreakValue?: number;
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  atkDebuffTurns?: number;
  atkDebuffValue?: number;
  offenseDebuffTurns?: number;
  offenseDebuffValue?: number;
  [key: string]: number | string | undefined;
}

interface MageUnit {
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
  mdef?: number;
  classType?: string;
  baseId?: string;
  id?: string;
  name?: string;
  star?: number;
  row: number;
  col: number;
  homeCol?: number;
  range?: number;
  sprite?: { x: number; y: number; active?: boolean };
  tribe?: string;
  mods?: CombatUnitMods;
  statuses: CombatUnitStatuses;
  [key: string]: unknown;
}

interface MageSkill {
  effect: string;
  name?: string;
  damageType?: string;
  damageScope?: string;
  maxHits?: number;
  damageFalloff?: number;
  bounceSelector?: string;
  uniqueTargets?: boolean;
  targetSelector?: string;
  debuffTargetSelector?: string;
  rageDrainPerHit?: number;
  rageDrainFirstTarget?: number;
  rageDrainBounceCount?: number;
  silenceLastHitTurns?: number;
  silenceIfHitsAtLeast?: number;
  silenceChance?: number;
  silenceTurns?: number;
  reboundIfHitsAtLeast?: number;
  reboundDamageMultiplier?: number;
  offenseDebuffValue?: number;
  atkDebuffValue?: number;
  offenseDebuffTurns?: number;
  atkDebuffTurns?: number;
  turns?: number;
  disableOffenseDebuffScaling?: boolean;
  disableChanceScaling?: boolean;
  disableGoldScaling?: boolean;
  disableStarTurnScaling?: boolean;
  runtimeShapeVersion?: number;
  offenseDebuffMode?: string;
  freezeIfColumnHasRangedCount?: number;
  freezeIfRowHasRangedCount?: number;
  freezeTurns?: number;
  aoeRadius?: number;
  areaPattern?: string;
  casterOnlyDebuff?: boolean;
  burnTurns?: number;
  burnPerTurn?: number;
  freezeChance?: number;
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  sleepChance?: number;
  sleepBonusTurnsIfDebuffed?: number;
  primaryTargetArmorBreakBonus?: number;
  armorBreak?: number;
  columnRageDrain?: number;
  columnExtraBlind?: boolean;
  accuracyDebuffPct?: number;
  spreadMaxTargets?: number;
  diseaseTurns?: number;
  poisonTurns?: number;
  diseaseDamage?: number;
  poisonPerTurn?: number;
  centerClusterMinTargets?: number;
  centerOffenseDebuffTurns?: number;
  centerOffenseDebuffPct?: number;
  centerRageDrain?: number;
  extraSpreadCount?: number;
  extraSpreadDamageMultiplier?: number;
  extraSpreadDiseaseTurns?: number;
  extraSpreadDiseaseDamage?: number;
  [key: string]: unknown;
}

interface MageSceneLike extends BuildSkillSelectionScene {
  getStarSkillMultiplier: (star: number) => number;
  getEffectiveAtk: (unit: SkillTargetUnit) => number;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi: (unit: unknown) => void;
  resolveDamage: (
    attacker: SkillTargetUnit,
    target: SkillTargetUnit,
    amount: number,
    damageType: string,
    label: string,
    skillOpts?: SkillOpts
  ) => number;
  rollChance?: (chance: number) => boolean;
  pickRandom?: <T>(list: T[]) => T;
  random?: () => number;
  player?: { gold?: number };
  [key: string]: unknown;
}

interface MageSkillContext {
  attacker?: MageUnit;
  target?: MageUnit;
  skill: MageSkill;
  rawSkill: number;
  skillOpts?: SkillOpts;
  enemies: MageUnit[];
  starChanceMult?: number;
  areaBonus?: number;
  targetBonus?: number;
  [key: string]: unknown;
}

function showText(scene: MageSceneLike, unit: MageUnit | null | undefined, text: string, color: string): void {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText?.(unit.sprite.x, unit.sprite.y - 45, text, color);
}

function updateUnit(scene: MageSceneLike, unit: MageUnit): void {
  scene.updateCombatUnitUi(unit);
}

function rollChance(scene: MageSceneLike | null | undefined, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function resolveScaledChance(skill: MageSkill | null | undefined, baseChance: number, starChanceMult = 1, goldMult = 1): number {
  let multiplier = 1;
  if (!skill?.disableChanceScaling) multiplier *= starChanceMult;
  if (!skill?.disableGoldScaling) multiplier *= goldMult;
  return Math.min(1, Math.max(0, (Number(baseChance) || 0) * multiplier));
}

function pickRandom<T>(scene: MageSceneLike | null | undefined, list: T[] = []): T | null {
  return scene?.pickRandom?.(list) ?? list[Math.floor((scene?.random?.bind(scene) ?? Math.random)() * list.length)] ?? null;
}

function collectUnitsInCross(enemies: MageUnit[], target: MageUnit | null | undefined): MageUnit[] {
  if (!target) return [];
  const crossPoints = new Set([
    `${target.row}:${target.col}`,
    `${target.row - 1}:${target.col}`,
    `${target.row + 1}:${target.col}`,
    `${target.row}:${target.col - 1}`,
    `${target.row}:${target.col + 1}`
  ]);
  return enemies.filter((enemy) => crossPoints.has(`${enemy.row}:${enemy.col}`));
}

function selectMageTargets(
  scene: MageSceneLike,
  attacker: MageUnit,
  target: MageUnit | null | undefined,
  skill: MageSkill,
  enemies: MageUnit[],
  count: number,
  selector: string | null = null
): MageUnit[] {
  return collectUnitsBySelector(
    enemies as unknown as SkillTargetUnit[],
    selector || skill?.debuffTargetSelector || skill?.bounceSelector || skill?.targetSelector || "random",
    count,
    buildSkillSelectionOptions(scene, attacker, target, skill)
  ) as unknown as MageUnit[];
}

export function applySharedOffensiveMageEffect(scene: unknown, context: Record<string, unknown>): boolean {
  const s = scene as MageSceneLike;
  const ctx = context as unknown as MageSkillContext;
  const { attacker, target, skill, rawSkill, skillOpts, enemies, starChanceMult = 1, areaBonus = 0, targetBonus = 0 } = ctx;
  if (!attacker || !skill) return false;

  const star: number = Number(attacker?.star ?? 1) || 1;
  const starScale = s.getStarSkillMultiplier(star);
  const goldMult = getGoldReserveScaling(s?.player?.gold ?? 0);
  const resolveTurnDuration = (value: unknown, fallback: number): number => {
    const baseTurns = Number.isFinite(Number(value)) && Number(value) > 0
      ? Math.max(1, Math.round(Number(value)))
      : fallback;
    if (skill?.runtimeShapeVersion === 3 || skill?.disableStarTurnScaling) return baseTurns;
    return getStarTurns(star, baseTurns);
  };

  switch (skill.effect) {
    case "chain_shock": {
      const damageFalloff = Number.isFinite(Number(skill.damageFalloff)) && Number(skill.damageFalloff) > 0
        ? Number(skill.damageFalloff)
        : 0.8;
      const pool = skill.bounceSelector || skill.uniqueTargets
        ? selectMageTargets(s, attacker, target, skill, enemies, skill.maxHits || (3 + targetBonus), skill.bounceSelector || skill.targetSelector || "random")
        : enemies.filter((enemy) => enemy.alive);
      let damage = rawSkill;
      const maxHits = Math.min(skill.maxHits || (3 + targetBonus), pool.length);
      const rageDrainPerHit = Math.max(0, Math.round(Number(skill.rageDrainPerHit ?? skill.rageDrainFirstTarget ?? 0) || 0));
      const rageDrainBounceCount = Math.max(0, Math.round(Number(skill.rageDrainBounceCount ?? (rageDrainPerHit > 0 ? 1 : 0)) || 0));
      const hitTargets: MageUnit[] = [];
      let lastTarget: MageUnit | null = null;
      let lastDamage = 0;
      for (let i = 0; i < maxHits; i += 1) {
        const enemy = pool[i] ?? pickRandom<MageUnit>(s, pool);
        if (enemy) {
          s.resolveDamage(attacker, enemy, damage, "magic", "SÉT LAN", skillOpts);
          hitTargets.push(enemy);
          lastTarget = enemy;
          lastDamage = damage;
        }
        if (enemy?.alive && rageDrainPerHit > 0 && i < rageDrainBounceCount) {
          enemy.rage = Math.max(0, (enemy.rage || 0) - rageDrainPerHit);
          updateUnit(s, enemy);
        }
        damage *= damageFalloff;
      }
      if (lastTarget?.alive && (skill.silenceLastHitTurns || 0) > 0 && hitTargets.length >= Math.max(1, Number(skill.silenceIfHitsAtLeast ?? maxHits))) {
        lastTarget.statuses.silence = Math.max(Number(lastTarget.statuses.silence) || 0, Number(skill.silenceLastHitTurns) || 0);
        showText(s, lastTarget, "IM LẶNG", "#d4bcff");
        updateUnit(s, lastTarget);
      }
      if (
        hitTargets.length >= Math.max(1, Number(skill.reboundIfHitsAtLeast ?? 0))
        && (skill.reboundDamageMultiplier || 0) > 0
      ) {
        const firstTarget = hitTargets[0];
        if (firstTarget?.alive) {
          const reboundDamage = Math.max(0, Math.round(lastDamage * Number(skill.reboundDamageMultiplier || 0)));
          s.resolveDamage(attacker, firstTarget, reboundDamage, "magic", "DỘI NGƯỢC", { ...skillOpts, isSplash: true });
          updateUnit(s, firstTarget);
        }
      }
      return true;
    }
    case "frost_storm": {
      if (!target) return true;
      const columnTargets = collectUnitsInSameColumn(enemies as unknown as SkillTargetUnit[], target.col) as unknown as MageUnit[];
      const offenseDebuffValue = Math.max(
        0,
        Math.round(Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 15) || 0)
      );
      const resolvedOffenseDebuffValue = skill.disableOffenseDebuffScaling
        ? offenseDebuffValue
        : Math.round(offenseDebuffValue * starScale);
      columnTargets.forEach((enemy) => {
        s.resolveDamage(attacker, enemy, rawSkill, "magic", String(skill.name ?? ""), skillOpts);
        if (enemy.alive) {
          applyOffenseDebuffStatus(enemy, {
            turns: resolveTurnDuration(skill.offenseDebuffTurns ?? skill.turns, 3),
            value: resolvedOffenseDebuffValue,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          showText(s, enemy, "GIẢM CÔNG", "#83e5ff");
          updateUnit(s, enemy);
        }
      });
      const freezeIfColumnHasRangedCount = Number(skill.freezeIfColumnHasRangedCount || skill.freezeIfRowHasRangedCount || 0);
      if (freezeIfColumnHasRangedCount > 0) {
        const rangedCount = columnTargets.filter((enemy) => enemy.alive && Number(enemy.range ?? 1) >= 2).length;
        if (rangedCount >= freezeIfColumnHasRangedCount) {
          const freezeTarget = selectMageTargets(s, attacker, target, skill, columnTargets.filter((enemy) => enemy.alive), 1, "highest_atk")[0];
          if (freezeTarget?.alive) {
            freezeTarget.statuses.freeze = Math.max(Number(freezeTarget.statuses.freeze) || 0, skill.freezeTurns || 1);
            showText(s, freezeTarget, "ĐÓNG BĂNG", "#83e5ff");
            updateUnit(s, freezeTarget);
          }
        }
      }
      return true;
    }
    case "pollen_confuse": {
      const silenceChance = Math.max(0, Number(skill.silenceChance ?? 0.4) || 0);
      const silenceTurns = Math.max(1, Math.round(Number(skill.silenceTurns ?? 1) || 1));
      enemies.forEach((enemy) => {
        s.resolveDamage(attacker, enemy, rawSkill, "magic", String(skill.name ?? ""), skillOpts);
        if (enemy.alive && rollChance(s, resolveScaledChance(skill, silenceChance, starChanceMult, goldMult))) {
          enemy.statuses.silence = Math.max(Number(enemy.statuses.silence) || 0, silenceTurns);
          showText(s, enemy, "IM LẶNG", "#d4bcff");
          updateUnit(s, enemy);
        }
      });
      return true;
    }
    case "fire_breath_cone": {
      const dir = attacker.side === "LEFT" ? 1 : -1;
      enemies
        .filter((enemy) => enemy.alive && Math.abs(enemy.row - attacker.row) <= 1
          && enemy.col >= Math.min(attacker.col, attacker.col + dir * 2)
          && enemy.col <= Math.max(attacker.col, attacker.col + dir * 2))
        .forEach((enemy) => {
          s.resolveDamage(attacker, enemy, rawSkill, "magic", "PHUN LỬA", skillOpts);
          if (enemy.alive) {
            enemy.statuses.burnTurns = Math.max(Number(enemy.statuses.burnTurns) || 0, getStarTurns(star, 3));
            enemy.statuses.burnDamage = Math.max(Number(enemy.statuses.burnDamage) || 0, Math.round(12 * starScale));
            updateUnit(s, enemy);
          }
        });
      return true;
    }
    case "flash_blind": {
      const debuffTargets = skill.debuffTargetSelector || skill.debuffMaxTargets
        ? selectMageTargets(s, attacker, target ?? null, skill, enemies, Number(skill.debuffMaxTargets) || enemies.filter((enemy) => enemy.alive).length, String(skill.debuffTargetSelector ?? "highest_atk"))
        : enemies;
      const debuffTargetIds = new Set(debuffTargets.map((enemy) => enemy.uid));
      enemies.filter((enemy) => enemy.alive).forEach((enemy) => {
        s.resolveDamage(attacker, enemy, rawSkill, "magic", "LÓE SÁNG", skillOpts);
        if (enemy.alive && debuffTargetIds.has(enemy.uid)) {
          applyOffenseDebuffStatus(enemy, {
            turns: Number(skill.offenseDebuffTurns ?? skill.atkDebuffTurns ?? 2),
            value: skill.disableOffenseDebuffScaling
              ? Math.round(Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 10))
              : Math.round((Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 10)) * starScale),
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          updateUnit(s, enemy);
        }
      });
      return true;
    }
    case "plague_spread": {
      if (!target) return true;
      s.resolveDamage(attacker, target, rawSkill, "magic", String(skill.name ?? ""), skillOpts);
      const neighbors = collectUnitsInAoeSquare(
        enemies as unknown as SkillTargetUnit[],
        target,
        1,
        (enemy) => enemy.uid !== target.uid
      ) as unknown as MageUnit[];
      const impacted = [target, ...neighbors].slice(0, skill.spreadMaxTargets || Number.POSITIVE_INFINITY);
      const diseaseTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.diseaseTurns ?? skill.poisonTurns ?? 3) || 3))
        : (Number.isFinite(Number(skill.diseaseTurns ?? skill.poisonTurns))
            ? Math.max(1, Math.round(Number(skill.diseaseTurns ?? skill.poisonTurns)))
            : getStarTurns(star, 3));
      const diseaseDamage = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.diseaseDamage ?? skill.poisonPerTurn ?? 12) || 12))
        : (Number.isFinite(Number(skill.diseaseDamage ?? skill.poisonPerTurn))
            ? Math.max(1, Math.round(Number(skill.diseaseDamage ?? skill.poisonPerTurn)))
            : getStarDotDamage(star, 12));
      const centerClusterMinTargets = Math.max(0, Math.round(Number(skill.centerClusterMinTargets ?? 4) || 4));
      const centerOffenseDebuffTurns = Math.max(0, Math.round(Number(skill.centerOffenseDebuffTurns ?? 0) || 0));
      const centerOffenseDebuffPct = Math.max(0, Number(skill.centerOffenseDebuffPct ?? 0) || 0);
      const centerRageDrain = Math.max(0, Math.round(Number(skill.centerRageDrain ?? 0) || 0));
      const extraSpreadCount = Math.max(0, Math.round(Number(skill.extraSpreadCount ?? 0) || 0));
      const extraSpreadDamageMultiplier = Math.max(0, Number(skill.extraSpreadDamageMultiplier ?? 0) || 0);
      const extraSpreadDiseaseTurns = Math.max(1, Math.round(Number(skill.extraSpreadDiseaseTurns ?? diseaseTurns) || diseaseTurns));
      const extraSpreadDiseaseDamage = Math.max(1, Math.round(Number(skill.extraSpreadDiseaseDamage ?? 0) || 0));
      impacted.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.statuses.diseaseTurns = Math.max(Number(enemy.statuses.diseaseTurns) || 0, diseaseTurns);
        enemy.statuses.diseaseDamage = Math.max(Number(enemy.statuses.diseaseDamage) || 0, diseaseDamage);
        showText(s, enemy, "DỊCH BỆNH", "#880088");
        updateUnit(s, enemy);
      });
      if (impacted.length >= centerClusterMinTargets && target?.alive) {
        if (centerOffenseDebuffTurns > 0 && centerOffenseDebuffPct > 0) {
          applyOffenseDebuffStatus(target, {
            turns: centerOffenseDebuffTurns,
            value: Math.max(1, Math.round((s.getEffectiveAtk(target) ?? target?.atk ?? 0) * centerOffenseDebuffPct)),
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
        }
        if (centerRageDrain > 0) {
          target.rage = Math.max(0, (target.rage || 0) - centerRageDrain);
          showText(s, target, `-${centerRageDrain} NỘ`, "#b8f5ff");
        }
        updateUnit(s, target);
      }
      if (impacted.length >= centerClusterMinTargets && extraSpreadCount > 0 && extraSpreadDamageMultiplier > 0) {
        const extraTargets = enemies
          .filter((enemy) => enemy.alive && !impacted.some((hit) => hit.uid === enemy.uid))
          .filter((enemy) => Math.abs(enemy.row - target.row) <= 2 && Math.abs(enemy.col - target.col) <= 2 && manhattan(target, enemy) > 1)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b) || (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0))
          .slice(0, extraSpreadCount);
        extraTargets.forEach((enemy) => {
          s.resolveDamage(
            attacker,
            enemy,
            Math.max(1, Math.round(rawSkill * extraSpreadDamageMultiplier)),
            "magic",
            String(skill.name ?? ""),
            { ...skillOpts, isSplash: true }
          );
          if (enemy.alive) {
            enemy.statuses.diseaseTurns = Math.max(Number(enemy.statuses.diseaseTurns) || 0, extraSpreadDiseaseTurns);
            enemy.statuses.diseaseDamage = Math.max(Number(enemy.statuses.diseaseDamage) || 0, extraSpreadDiseaseDamage);
            showText(s, enemy, "DỊCH BỆNH", "#880088");
            updateUnit(s, enemy);
          }
        });
      }
      return true;
    }
    case "fireball_burn": {
      if (!target) return true;
      const targets = skill.areaPattern === "cross_5"
        ? collectUnitsInCross(enemies, target)
        : collectUnitsInAoeSquare(
            enemies as unknown as SkillTargetUnit[],
            target,
            Number.isFinite(Number(skill.aoeRadius))
              ? Math.max(0, Math.round(Number(skill.aoeRadius)))
              : 1 + areaBonus
          ) as unknown as MageUnit[];
      targets.forEach((enemy) => {
        s.resolveDamage(attacker, enemy, rawSkill, "magic", "CẦU LỬA", skillOpts);
        if (enemy.alive) {
          enemy.statuses.burnTurns = Math.max(Number(enemy.statuses.burnTurns) || 0, skill.burnTurns || 3);
          enemy.statuses.burnDamage = Math.max(Number(enemy.statuses.burnDamage) || 0, skill.burnPerTurn || 15);
          if ((skill.casterOnlyDebuff || false) && (enemy.classType === "MAGE" || enemy.classType === "SUPPORT")) {
            applyOffenseDebuffStatus(enemy, {
              turns: Number(skill.offenseDebuffTurns ?? skill.atkDebuffTurns ?? 2),
              value: Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 10),
              mode: "matk"
            });
          }
          updateUnit(s, enemy);
        }
      });
      return true;
    }
    case "ice_blast_freeze": {
      if (!target) return true;
      const freezeChance = Math.max(0, Number(skill.freezeChance ?? 0.5) || 0);
      const freezeTurns = Math.max(1, Math.round(Number(skill.freezeTurns ?? 1) || 1));
      const evadeDebuffTurns = Math.max(0, Math.round(Number(skill.evadeDebuffTurns ?? 0) || 0));
      const evadeDebuffValue = Math.max(0, Number(skill.evadeDebuffValue ?? 0) || 0);
      s.resolveDamage(attacker, target, rawSkill, "magic", String(skill.name ?? ""), skillOpts);
      if (target.alive) {
        if (freezeChance > 0 && rollChance(s, resolveScaledChance(skill, freezeChance, starChanceMult, goldMult))) {
          target.statuses.freeze = Math.max(Number(target.statuses.freeze) || 0, freezeTurns);
          showText(s, target, "ĐÓNG BĂNG", "#83e5ff");
        }
        if (evadeDebuffTurns > 0 && evadeDebuffValue > 0) {
          target.statuses.evadeDebuffTurns = Math.max(Number(target.statuses.evadeDebuffTurns) || 0, evadeDebuffTurns);
          target.statuses.evadeDebuffValue = Math.max(Number(target.statuses.evadeDebuffValue) || 0, evadeDebuffValue);
          showText(s, target, "GIẢM NÉ", "#d8f3ff");
        }
        updateUnit(s, target);
      }
      return true;
    }
    case "dust_sleep": {
      if (!target) return true;
      collectUnitsInAoeSquare(enemies as unknown as SkillTargetUnit[], target, 1 + areaBonus).forEach((enemy) => {
        s.resolveDamage(attacker, enemy as unknown as SkillTargetUnit, rawSkill, "magic", "BỤI MÊ", skillOpts);
        const mageEnemy = enemy as unknown as MageUnit;
        if (mageEnemy.alive && rollChance(s, resolveScaledChance(skill, skill.sleepChance || 0.35, starChanceMult, goldMult))) {
          const enemyStatuses = mageEnemy.statuses ?? {};
          const debuffActive = (skill.sleepBonusTurnsIfDebuffed || 0) > 0 && (
            getOffenseDebuffState(enemyStatuses, mageEnemy).turns > 0 ||
            Number(enemyStatuses.armorBreakTurns) > 0 ||
            Number(enemyStatuses.poisonTurns) > 0 ||
            Number(enemyStatuses.burnTurns) > 0
          );
          const sleepTurns = 1 + (debuffActive ? Number(skill.sleepBonusTurnsIfDebuffed || 0) : 0);
          mageEnemy.statuses.sleep = Math.max(Number(mageEnemy.statuses.sleep) || 0, sleepTurns);
          showText(s, mageEnemy, "NGỦ", "#d4bcff");
          updateUnit(s, mageEnemy);
        }
      });
      return true;
    }
    case "ink_blast_debuff": {
      if (!target) return true;
      collectUnitsInSameColumn(enemies as unknown as SkillTargetUnit[], target.col).forEach((rawEnemy) => {
        const enemy = rawEnemy as unknown as MageUnit;
        s.resolveDamage(attacker, enemy, rawSkill, "magic", "MỰC PHUN", skillOpts);
        if (enemy.alive) {
          const bonusBreak = enemy.uid === target.uid ? Number(skill.primaryTargetArmorBreakBonus || 0) : 0;
          enemy.statuses.armorBreakTurns = Math.max(Number(enemy.statuses.armorBreakTurns) || 0, Number(skill.turns || 2));
          enemy.statuses.armorBreakValue = Math.max(Number(enemy.statuses.armorBreakValue) || 0, Number(skill.armorBreak || 20) + bonusBreak);
          if ((skill.columnRageDrain || 0) > 0) {
            enemy.rage = Math.max(0, (enemy.rage || 0) - Number(skill.columnRageDrain));
          }
          if (skill.columnExtraBlind && enemy.uid === target.uid) {
            applyOffenseDebuffStatus(enemy, {
              turns: 1,
              value: 16,
              mode: skill.offenseDebuffMode ?? "autoByRole"
            });
          }
          updateUnit(s, enemy);
        }
      });
      return true;
    }
    case "ink_bomb_blind": {
      if (!target) return true;
      const aoeRadius = skill.runtimeShapeVersion === 3
        ? Math.max(0, Math.round(Number(skill.aoeRadius ?? 0) || 0))
        : 1 + areaBonus;
      const accuracyDebuffPct = Math.max(0, Number(skill.accuracyDebuffPct ?? 0) || 0);
      const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
      const offenseDebuffValue = Math.max(0, Math.round(Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 0) || 0));
      collectUnitsInAoeSquare(enemies as unknown as SkillTargetUnit[], target, aoeRadius).forEach((rawEnemy) => {
        const enemy = rawEnemy as unknown as MageUnit;
        s.resolveDamage(attacker, enemy, rawSkill, "magic", "BOM MỰC", skillOpts);
        if (enemy.alive) {
          if (accuracyDebuffPct > 0) {
            if (!enemy.mods) enemy.mods = {};
            enemy.mods.accuracyPct = Math.min(Number(enemy.mods.accuracyPct ?? 0) || 0, -accuracyDebuffPct);
          }
          if (offenseDebuffTurns > 0 && offenseDebuffValue > 0) {
            applyOffenseDebuffStatus(enemy, {
              turns: offenseDebuffTurns,
              value: offenseDebuffValue,
              mode: skill.offenseDebuffMode ?? "autoByRole"
            });
          }
          updateUnit(s, enemy);
        }
      });
      return true;
    }
    default:
      return false;
  }
}
