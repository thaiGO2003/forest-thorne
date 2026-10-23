import Phaser from "phaser";
import { getGoldReserveScaling, getStarTurns, manhattan } from "../../core/gameUtils.js";
import { applyOffenseDebuffStatus } from "../../core/offenseDebuff.js";
import {
  buildSkillSelectionOptions,
  collectUnitsBySelector,
  collectRandomAliveUnits,
  collectUnitsInAoeSquare,
  collectUnitsInSameColumn,
  collectUnitsInSameRow,
  findLowestHpRatioUnit,
  type SkillTargetUnit
} from "./sceneSkillTargeting.js";

interface RangedUnit {
  uid?: string;
  star?: number;
  side?: "LEFT" | "RIGHT";
  classType?: string;
  alive?: boolean;
  hp?: number;
  maxHp?: number;
  shield?: number;
  rage?: number;
  rageMax?: number;
  atk?: number;
  matk?: number;
  row: number;
  col: number;
  range?: number;
  name?: string;
  sprite?: { x: number; y: number; active?: boolean };
  statuses: {
    burnTurns?: number;
    burnDamage?: number;
    offenseDebuffTurns?: number;
    offenseDebuffValue?: number;
    fireVulnerabilityTurns?: number;
    fireVulnerabilityMultiplier?: number;
    chromaticDartRedBonus?: number;
    chromaticDartYellowBonus?: number;
    chromaticDartLastCast?: { redChance: number; yellowChance: number; redThrown: boolean; yellowThrown: boolean };
    bleedTurns?: number;
    bleedDamage?: number;
    stun?: number;
    poisonTurns?: number;
    poisonDamage?: number;
    evadeDebuffTurns?: number;
    evadeDebuffValue?: number;
    armorBreakTurns?: number;
    armorBreakValue?: number;
    disarmTurns?: number;
    [key: string]: number | string | { redChance: number; yellowChance: number; redThrown: boolean; yellowThrown: boolean } | undefined;
  };
  mods?: { [key: string]: unknown };
  [key: string]: unknown;
}

interface RangedSkill {
  effect: string;
  name?: string;
  damageType?: string;
  multiTargetSelector?: string;
  targetSelector?: string;
  fallbackTargetSelector?: string;
  finalTargetSelector?: string;
  uniqueTargets?: boolean;
  allowBonusRetargetMarked?: boolean;
  bonusTargetSelector?: string;
  bonusTargetAllowMarked?: boolean;
  bonusTargetCount?: number;
  bonusTargetDamageMultiplier?: number;
  markedTargetDamageMultiplier?: number;
  lockedTargetMultiplier?: number;
  bonusTargetExtraRageDrain?: number;
  bonusTargetClasses?: string[];
  bonusExcludeClasses?: string[];
  bonusTargetRequireFrontline?: boolean;
  bonusTargetRequireBackline?: boolean;
  bonusTargetRequireRanged?: boolean;
  bonusTargetRequireDebuffed?: boolean;
  bonusTargetRequireShielded?: boolean;
  bonusTargetPreferClasses?: string[];
  bonusTargetPreferFrontline?: boolean;
  bonusTargetPreferBackline?: boolean;
  bonusTargetPreferRanged?: boolean;
  bonusTargetPreferDebuffed?: boolean;
  bonusTargetPreferShielded?: boolean;
  bonusTargetPreferHighRage?: boolean;
  targetClasses?: string[];
  excludeTargetClasses?: string[];
  requireBackline?: boolean;
  requireRanged?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  preferHighRage?: boolean;
  finalTargetPreferBackline?: boolean;
  finalTargetPreferRanged?: boolean;
  finalTargetPreferHighRage?: boolean;
  burnChance?: number;
  burnTurns?: number;
  burnPerTurn?: number;
  offenseDebuffTurns?: number;
  offenseDebuffValue?: number;
  offenseDebuffPct?: number;
  offenseDebuffMode?: string;
  atkDebuffValue?: number;
  atkDebuffTurns?: number;
  fireVulnerabilityHitThreshold?: number;
  fireVulnerabilityTurns?: number;
  fireVulnerabilityMultiplier?: number;
  maxTargets?: number;
  damageFalloff?: number;
  maxHits?: number;
  evadeDebuffTurns?: number;
  evadeDebuffValue?: number;
  evadeDebuffPct?: number;
  rageDrainPerTarget?: number;
  rageDrainAmongHits?: number;
  stunChance?: number;
  stunTurns?: number;
  crowdHitMinTargets?: number;
  guaranteedCenterStunTurns?: number;
  rageDrainOnCrowdHit?: number;
  bleedDamage?: number;
  bleedTurns?: number;
  turns?: number;
  executeHpPct?: number;
  executeMultiplier?: number;
  armorPen?: number;
  armorBreak?: number;
  disableStarTurnScaling?: boolean;
  disableChanceScaling?: boolean;
  disableGoldScaling?: boolean;
  splashSameRowCount?: number;
  splashDamageMultiplier?: number;
  splashStunChance?: number;
  splashStunTurns?: number;
  requireTargetAliveForSplash?: boolean;
  disarmTurns?: number;
  splashNearestCount?: number;
  killSplashBurnDamage?: number;
  killSplashBurnTurns?: number;
  killSplashMaxTargets?: number;
  killRageGain?: number;
  hit3DamageMultiplier?: number;
  hit3ArmorPenPct?: number;
  hit2ArmorBreak?: number;
  hit2ArmorBreakTurns?: number;
  hit4SplashNearestCount?: number;
  hit4SplashDamageMultiplier?: number;
  hit4SplashArmorBreak?: number;
  hit4SplashArmorBreakTurns?: number;
  hit5SplitNearestCount?: number;
  hit5SplitDamageMultiplier?: number;
  hit5PreferUntouched?: boolean;
  retargetOnKill?: boolean;
  retargetPreferUntouched?: boolean;
  redChanceIncrement?: number;
  yellowChanceIncrement?: number;
  redBaseChance?: number;
  yellowBaseChance?: number;
  redUnlockStar?: number;
  redCrossDamageMultiplier?: number;
  yellowUnlockStar?: number;
  yellowStunTurns?: number;
  blueLifestealPct?: number;
  repeatMarkedTargetShots?: number;
  finalTargetMinDifferentTargets?: number;
  markFirstTarget?: boolean;
  markedTargetRageDrain?: number;
  finalTargetRageDrain?: number;
  finalTargetDamageMultiplier?: number;
  finalTargetOffenseDebuffPct?: number;
  finalTargetOffenseDebuffTurns?: number;
  finalTargetOffenseDebuffMode?: string;
  poisonTurns?: number;
  poisonPerTurn?: number;
  bonusDamageMultiplier?: number;
  extendPoisonTurnsOnPoisonedHit?: number;
  rageDrainOnPoisonedHit?: number;
  rageDrainIfPoisoned?: number;
  poisonBurstNearestCount?: number;
  poisonBurstDamageMultiplier?: number;
  poisonBurstTurns?: number;
  poisonBurstPerTurn?: number;
  retargetPoisonedOnKill?: boolean;
  [key: string]: unknown;
}

interface RangedSceneLike extends Phaser.Scene {
  random?: () => number;
  pickRandom?: <T>(list: T[]) => T;
  rollChance?: (chance: number) => boolean;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi?: (unit: RangedUnit) => void;
  resolveDamage: (
    attacker: RangedUnit,
    target: RangedUnit,
    amount: number,
    damageType: string,
    label: string,
    opts?: Record<string, unknown>
  ) => number;
  getEffectiveAtk: (unit: RangedUnit) => number;
  getEffectiveMatk?: (unit: RangedUnit) => number;
  healUnit: (healer: RangedUnit, target: RangedUnit, amount: number, label: string) => void;
  getStarSkillMultiplier: (star: number) => number;
  player: { gold?: number; [key: string]: unknown };
  aiMode?: string;
  [key: string]: unknown;
}

interface RangedSkillOpts {
  isSplash?: boolean;
  armorPen?: number;
  [key: string]: unknown;
}

interface RangedSkillContext {
  attacker: RangedUnit;
  target: RangedUnit;
  skill: RangedSkill;
  rawSkill: number;
  skillOpts?: RangedSkillOpts;
  enemies: RangedUnit[];
  starChanceMult?: number;
  areaBonus?: number;
  targetBonus?: number;
}

function showText(scene: RangedSceneLike, unit: RangedUnit | null | undefined, text: string, color: string): void {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText?.(unit.sprite.x, unit.sprite.y - 45, text, color);
}

function updateUnit(scene: RangedSceneLike, unit: RangedUnit): void {
  scene.updateCombatUnitUi?.(unit);
}

function rollChance(scene: RangedSceneLike | null | undefined, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function resolveScaledChance(skill: RangedSkill, baseChance: number, starChanceMult = 1, goldMult = 1): number {
  let multiplier = 1;
  if (!skill?.disableChanceScaling) multiplier *= starChanceMult;
  if (!skill?.disableGoldScaling) multiplier *= goldMult;
  return Math.min(1, Math.max(0, (Number(baseChance) || 0) * multiplier));
}

function pickRandom<T>(scene: RangedSceneLike | null | undefined, list: T[] = []): T | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const randomFn = scene?.random?.bind(scene) ?? Math.random;
  return scene?.pickRandom?.(list) ?? list[Math.floor(randomFn() * list.length)] ?? null;
}

function collectConfiguredTargets(
  scene: RangedSceneLike,
  attacker: RangedUnit,
  target: RangedUnit,
  skill: RangedSkill,
  enemies: RangedUnit[],
  count: number,
  selector: string | null = null,
  overrides: Record<string, unknown> = {}
): RangedUnit[] {
  const resolvedCount = Math.max(1, Math.floor(count || 1));
  const resolvedSelector = selector || skill?.multiTargetSelector || skill?.targetSelector || "random";
  return collectUnitsBySelector(
    enemies as unknown as SkillTargetUnit[],
    resolvedSelector,
    resolvedCount,
    {
      ...(buildSkillSelectionOptions(scene as unknown as Parameters<typeof buildSkillSelectionOptions>[0], attacker, target, skill, overrides) as Record<string, unknown>),
      allowRepeatTargets: Boolean(overrides.allowRepeatTargets)
    }
  ) as unknown as RangedUnit[];
}

function resolveOffenseDebuffAmount(scene: RangedSceneLike, enemy: RangedUnit, skill: RangedSkill): number {
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

export function applySharedOffensiveRangedEffect(scene: RangedSceneLike, context: RangedSkillContext): boolean {
  const { attacker, target, skill, rawSkill, skillOpts, enemies, starChanceMult = 1, areaBonus = 0, targetBonus = 0 } = context;
  if (!attacker || !skill) return false;

  const star = attacker?.star ?? 1;
  const starScale = scene.getStarSkillMultiplier(star);
  const goldMult = getGoldReserveScaling(scene?.player?.gold ?? 0);

  switch (skill.effect) {
    case "piercing_shot": {
      if (!target) return true;
      const burnChance = Number(skill.burnChance ?? 0) || 0;
      const burnTurns = Number(skill.burnTurns ?? 0) || 0;
      const burnDamage = Number(skill.burnPerTurn ?? 0) || 0;
      const offenseDebuffTurns = Number(skill.offenseDebuffTurns ?? skill.atkDebuffTurns ?? 0) || 0;
      const offenseDebuffValue = Number(skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 0) || 0;
      const fireVulnerabilityHitThreshold = Number(skill.fireVulnerabilityHitThreshold ?? 0) || 0;
      const fireVulnerabilityTurns = Number(skill.fireVulnerabilityTurns ?? 0) || 0;
      const fireVulnerabilityMultiplier = Math.max(1, Number(skill.fireVulnerabilityMultiplier ?? 1) || 1);
      const maxTargets = Number.isFinite(Number(skill.maxTargets)) ? Math.max(1, Math.round(skill.maxTargets as number)) : Number.POSITIVE_INFINITY;
      const damageFalloff = Number(skill.damageFalloff ?? 0.8) || 0.8;
      let damage = rawSkill;
      const piercedEnemies = (collectUnitsInSameRow(enemies, target.row) as RangedUnit[])
        .sort((a, b) => manhattan(attacker, a) - manhattan(attacker, b))
        .slice(0, maxTargets);
      piercedEnemies.forEach((enemy) => {
          scene.resolveDamage(attacker, enemy, damage, "physical", "XUYÊN", skillOpts);
          if (enemy.alive && burnChance > 0 && burnTurns > 0 && burnDamage > 0 && rollChance(scene, Math.min(1, burnChance))) {
            enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, burnTurns);
            enemy.statuses.burnDamage = Math.max((enemy.statuses.burnDamage || 0) as number, burnDamage);
            showText(scene, enemy, "ĐỐT CHÁY", "#ff8a2a");
            updateUnit(scene, enemy);
          }
          if (enemy.alive && offenseDebuffTurns > 0 && offenseDebuffValue > 0) {
            applyOffenseDebuffStatus(enemy as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
              turns: offenseDebuffTurns,
              value: offenseDebuffValue,
              mode: skill.offenseDebuffMode ?? "autoByRole"
            });
            showText(scene, enemy, "SUY YẾU", "#c7d2fe");
            updateUnit(scene, enemy);
          }
          damage *= damageFalloff;
        });
      if (fireVulnerabilityHitThreshold > 0 && fireVulnerabilityTurns > 0 && piercedEnemies.length >= fireVulnerabilityHitThreshold) {
        piercedEnemies.forEach((enemy) => {
          if (!enemy.alive) return;
          enemy.statuses.fireVulnerabilityTurns = Math.max(enemy.statuses.fireVulnerabilityTurns || 0, fireVulnerabilityTurns);
          enemy.statuses.fireVulnerabilityMultiplier = Math.max((enemy.statuses.fireVulnerabilityMultiplier || 1) as number, fireVulnerabilityMultiplier);
          showText(scene, enemy, "YẾU HỎA", "#ffb347");
          updateUnit(scene, enemy);
        });
      }
      return true;
    }
    case "arrow_rain": {
      const maxHits = ((skill.maxHits as number) || 4) + targetBonus;
      const evadeDebuffTurns = Math.max(0, Math.round(Number(skill.evadeDebuffTurns ?? 0) || 0));
      const evadeDebuffValue = Math.max(0, Number(skill.evadeDebuffValue ?? 0) || 0);
      const rageDrainPerTarget = Math.max(0, Math.round(Number(skill.rageDrainPerTarget ?? 0) || 0));
      const rageDrainAmongHits = Math.max(0, Math.round(Number(skill.rageDrainAmongHits ?? 0) || 0));
      const targets: RangedUnit[] = skill.uniqueTargets || skill.multiTargetSelector
        ? collectConfiguredTargets(scene, attacker, target, skill, enemies, maxHits, skill.multiTargetSelector || "random", { allowRepeatTargets: false })
        : [];
      const primaryHits: RangedUnit[] = [];
      const applyArrowHit = (enemy: RangedUnit | null | undefined, damage: number, label: string, opts: RangedSkillOpts = skillOpts as RangedSkillOpts): void => {
        if (!enemy?.alive) return;
        scene.resolveDamage(attacker, enemy, damage, "physical", label, opts);
        if (!primaryHits.some((picked) => picked.uid === enemy.uid)) primaryHits.push(enemy);
        if (!enemy.alive) return;
        if (evadeDebuffTurns > 0 && evadeDebuffValue > 0) {
          enemy.statuses.evadeDebuffTurns = Math.max(enemy.statuses.evadeDebuffTurns || 0, evadeDebuffTurns);
          enemy.statuses.evadeDebuffValue = Math.max((enemy.statuses.evadeDebuffValue || 0) as number, evadeDebuffValue);
          showText(scene, enemy, "GHIM CÁNH", "#d8f3ff");
        }
        if (rageDrainPerTarget > 0) {
          enemy.rage = Math.max(0, (enemy.rage || 0) - rageDrainPerTarget);
          showText(scene, enemy, `-${rageDrainPerTarget} NỘ`, "#b8f5ff");
        }
        updateUnit(scene, enemy);
      };
      if (targets.length > 0) {
        targets.forEach((enemy) => {
          applyArrowHit(enemy, rawSkill, "MƯA TÊN");
        });
      } else {
        for (let i = 0; i < maxHits; i += 1) {
          const pool = enemies.filter((enemy) => enemy.alive);
          if (!pool.length) break;
          applyArrowHit(pickRandom(scene, pool), rawSkill, "MƯA TÊN");
        }
      }
      if (rageDrainAmongHits > 0) {
        const highestRageHit = [...primaryHits]
          .filter((enemy) => enemy?.alive)
          .sort((a, b) => (Number(b?.rage ?? 0) || 0) - (Number(a?.rage ?? 0) || 0))[0];
        if (highestRageHit) {
          highestRageHit.rage = Math.max(0, (highestRageHit.rage || 0) - rageDrainAmongHits);
          showText(scene, highestRageHit, `-${rageDrainAmongHits} NỘ`, "#b8f5ff");
          updateUnit(scene, highestRageHit);
        }
      }
      if (skill.bonusTargetSelector) {
        const bonusCount = Math.max(1, Math.round(Number(skill.bonusTargetCount ?? 1) || 1));
        const bonusDamageMultiplier = Math.max(0, Number(skill.bonusTargetDamageMultiplier ?? 1) || 1);
        const markedTargetDamageMultiplier = Math.max(
          0,
          Number(skill.markedTargetDamageMultiplier ?? skill.lockedTargetMultiplier ?? bonusDamageMultiplier) || bonusDamageMultiplier
        );
        const bonusAllowMarked = Boolean(skill.bonusTargetAllowMarked || skill.allowBonusRetargetMarked);
        const bonusTargets = collectConfiguredTargets(
          scene,
          attacker,
          target,
          skill,
          enemies,
          bonusCount,
          skill.bonusTargetSelector,
          {
            allowRepeatTargets: false,
            targetClasses: skill.bonusTargetClasses ?? [],
            excludeClasses: skill.bonusExcludeClasses ?? [],
            requireFrontline: skill.bonusTargetRequireFrontline ?? false,
            requireBackline: skill.bonusTargetRequireBackline ?? false,
            requireRanged: skill.bonusTargetRequireRanged ?? false,
            requireDebuffed: skill.bonusTargetRequireDebuffed ?? false,
            requireShielded: skill.bonusTargetRequireShielded ?? false,
            preferClasses: skill.bonusTargetPreferClasses ?? [],
            preferFrontline: skill.bonusTargetPreferFrontline ?? false,
            preferBackline: skill.bonusTargetPreferBackline ?? false,
            preferRanged: skill.bonusTargetPreferRanged ?? false,
            preferDebuffed: skill.bonusTargetPreferDebuffed ?? false,
            preferShielded: skill.bonusTargetPreferShielded ?? false,
            preferHighRage: skill.bonusTargetPreferHighRage ?? false
          }
        ).filter((enemy) => bonusAllowMarked || !targets.some((picked) => picked.uid === enemy.uid));
        bonusTargets.forEach((bonus) => {
          if (!bonus?.alive) return;
          const wasMarked = primaryHits.some((picked) => picked.uid === bonus.uid);
          applyArrowHit(
            bonus,
            Math.max(0, Math.round(rawSkill * (wasMarked ? markedTargetDamageMultiplier : bonusDamageMultiplier))),
            wasMarked ? "MŨI KHÓA" : "MŨI PHỤ",
            skillOpts as RangedSkillOpts
          );
          if ((skill.bonusTargetExtraRageDrain || 0) > 0 && bonus.alive) {
            bonus.rage = Math.max(0, (bonus.rage || 0) - (skill.bonusTargetExtraRageDrain as number));
            showText(scene, bonus, `-${skill.bonusTargetExtraRageDrain} NỘ`, "#b8f5ff");
            updateUnit(scene, bonus);
          }
        });
      }
      return true;
    }
    case "fish_bomb_aoe": {
      if (!target) return true;
      const areaTargets = collectUnitsInAoeSquare(enemies, target, 1 + areaBonus, null) as RangedUnit[];
      const crowdHit = areaTargets.length >= Math.max(1, Math.round(Number(skill.crowdHitMinTargets ?? 3) || 3));

      areaTargets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, "physical", "BOM CÁ", skillOpts);
        if (!enemy.alive) return;
        const evadeDebuffTurns = Math.max(0, Math.round(Number(skill.evadeDebuffTurns ?? 0) || 0));
        const evadeDebuffValue = Math.max(0, Number(skill.evadeDebuffValue ?? skill.evadeDebuffPct ?? 0) || 0);
        if (evadeDebuffTurns > 0 && evadeDebuffValue > 0) {
          enemy.statuses.evadeDebuffTurns = Math.max(enemy.statuses.evadeDebuffTurns || 0, evadeDebuffTurns);
          enemy.statuses.evadeDebuffValue = Math.max((enemy.statuses.evadeDebuffValue || 0) as number, evadeDebuffValue);
          showText(scene, enemy, "GIẢM NÉ", "#d8f3ff");
        }
        if (rollChance(scene, resolveScaledChance(skill, skill.stunChance || 0.30, starChanceMult, goldMult))) {
          enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, skill.stunTurns || 1);
          showText(scene, enemy, "CHOÁNG", "#ffd97b");
        }
        updateUnit(scene, enemy);
      });

      if (!crowdHit) return true;

      if (target.alive) {
        const centerStunTurns = Math.max(0, Math.round(Number(skill.guaranteedCenterStunTurns ?? 1) || 0));
        if (centerStunTurns > 0) {
          target.statuses.stun = Math.max(target.statuses.stun || 0, centerStunTurns);
          showText(scene, target, "CHOÁNG", "#ffd97b");
          updateUnit(scene, target);
        }
      }

      areaTargets
        .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
        .forEach((enemy) => {
          const rageDrain = Math.max(0, Math.round(Number(skill.rageDrainOnCrowdHit ?? 0) || 0));
          if (rageDrain > 0) {
            enemy.rage = Math.max(0, (enemy.rage || 0) - rageDrain);
            showText(scene, enemy, `-${rageDrain} NỘ`, "#9fe8ff");
          }
          const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
          const offenseDebuffValue = resolveOffenseDebuffAmount(scene, enemy, skill);
          if (offenseDebuffTurns > 0 && offenseDebuffValue > 0) {
            applyOffenseDebuffStatus(enemy as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
              turns: offenseDebuffTurns,
              value: offenseDebuffValue,
              mode: skill.offenseDebuffMode ?? "autoByRole"
            });
            showText(scene, enemy, "GIẢM CÔNG", "#ff9999");
          }
          updateUnit(scene, enemy);
        });

      return true;
    }
    case "feather_bleed": {
      const randomFn = scene?.random?.bind(scene) ?? Math.random;
      const hitCount = Math.max(1, Math.round(Number(skill.maxHits || 3) || 3)) + targetBonus;
      const bleedTurns = Math.max(0, Math.round(Number(skill.bleedTurns ?? skill.turns ?? 0) || 0));
      const bleedDamage = Math.max(0, Math.round(Number(skill.bleedDamage ?? 0) || 0));
      const pickedTargets: RangedUnit[] = skill.uniqueTargets || skill.multiTargetSelector
        ? collectConfiguredTargets(scene, attacker, target, skill, enemies, hitCount, skill.multiTargetSelector || "random")
        : collectRandomAliveUnits(enemies, hitCount, null, randomFn) as RangedUnit[];
      pickedTargets.forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, "physical", "LÔNG VŨ", skillOpts);
        if (enemy.alive && bleedTurns > 0 && bleedDamage > 0) {
          enemy.statuses.bleedTurns = Math.max(enemy.statuses.bleedTurns || 0, bleedTurns);
          enemy.statuses.bleedDamage = Math.max((enemy.statuses.bleedDamage || 0) as number, bleedDamage);
          showText(scene, enemy, "CHẢY MÁU", "#ff4444");
          updateUnit(scene, enemy);
        }
      });
      if (skill.bonusTargetSelector) {
        const bonusTarget = collectConfiguredTargets(scene, attacker, target, skill, enemies, 1, skill.bonusTargetSelector)
          .find((enemy) => !pickedTargets.some((picked) => picked.uid === enemy.uid));
        if (bonusTarget) {
          scene.resolveDamage(attacker, bonusTarget, rawSkill, "physical", "LÔNG KHÓA", skillOpts);
          if (bonusTarget.alive && bleedTurns > 0 && bleedDamage > 0) {
            bonusTarget.statuses.bleedTurns = Math.max(bonusTarget.statuses.bleedTurns || 0, bleedTurns);
            bonusTarget.statuses.bleedDamage = Math.max((bonusTarget.statuses.bleedDamage || 0) as number, bleedDamage);
            showText(scene, bonusTarget, "CHẢY MÁU", "#ff4444");
            updateUnit(scene, bonusTarget);
          }
        }
      }
      return true;
    }
    case "rock_throw_stun": {
      if (!target) return true;
      scene.resolveDamage(attacker, target, rawSkill, "physical", skill.name as string, skillOpts);
      const stunChance = Number(skill.stunChance || 0.40) || 0.40;
      if (target.alive && rollChance(scene, resolveScaledChance(skill, stunChance, starChanceMult, goldMult))) {
        target.statuses.stun = Math.max(target.statuses.stun || 0, skill.stunTurns || 1);
        showText(scene, target, "CHOÁNG", "#ffd97b");
      }
      if (target.alive && Number(skill.rageDrain ?? 0) > 0) {
        target.rage = Math.max(0, (target.rage || 0) - (skill.rageDrain as number));
        showText(scene, target, `-${skill.rageDrain} NỘ`, "#b8f5ff");
      }
      const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
      const offenseDebuffValue = resolveOffenseDebuffAmount(scene, target, skill);
      if (target.alive && offenseDebuffTurns > 0 && offenseDebuffValue > 0) {
        applyOffenseDebuffStatus(target as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
          turns: offenseDebuffTurns,
          value: offenseDebuffValue,
          mode: skill.offenseDebuffMode ?? "autoByRole"
        });
        showText(scene, target, "RÚT CÔNG", "#b7c6ff");
      }
      updateUnit(scene, target);
      if (
        target.alive
        && (skill.splashSameRowCount || 0) > 0
        && (!skill.requireTargetAliveForSplash || target.alive)
      ) {
        enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid && enemy.row === target.row)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.splashSameRowCount as number)
          .forEach((enemy) => {
            const splashDamage = Math.max(0, Math.round(rawSkill * Number(skill.splashDamageMultiplier ?? 0.6)));
            scene.resolveDamage(attacker, enemy, splashDamage, "physical", "MẢNH ĐÁ", { ...(skillOpts as RangedSkillOpts), isSplash: true });
            if (enemy.alive && (skill.splashStunChance || 0) > 0 && (skill.splashStunTurns || 0) > 0 && rollChance(scene, skill.splashStunChance as number)) {
              enemy.statuses.stun = Math.max(enemy.statuses.stun || 0, skill.splashStunTurns as number);
              showText(scene, enemy, "CHOÁNG", "#ffd97b");
            }
            updateUnit(scene, enemy);
          });
      }
      return true;
    }
    case "snipe_execute": {
      if (!target) return true;
      const executeHpPct = Math.max(0, Math.min(1, Number(skill.executeHpPct ?? 0.3) || 0.3));
      const executeMultiplier = Math.max(1, Number(skill.executeMultiplier ?? 2) || 2);
      const armorPen = Math.max(0, Number(skill.armorPen ?? 0) || 0);
      const damage = (target.hp ?? 0) < (target.maxHp ?? 0) * executeHpPct ? Math.round(rawSkill * executeMultiplier) : rawSkill;
      scene.resolveDamage(attacker, target, damage, "physical", skill.name as string, { ...(skillOpts as RangedSkillOpts), armorPen });
      return true;
    }
    case "sniper_crit": {
      if (!target) return true;
      scene.resolveDamage(attacker, target, rawSkill, "physical", skill.name as string, { ...(skillOpts as RangedSkillOpts), armorPen: skill.armorPen || 0.5 });
      if (target.alive) {
        const evadeDebuffTurns = Math.max(0, Math.round(Number(skill.evadeDebuffTurns ?? 0) || 0));
        const evadeDebuffValue = Math.max(0, Number(skill.evadeDebuffValue ?? 0) || 0);
        if (evadeDebuffTurns > 0 && evadeDebuffValue > 0) {
          target.statuses.evadeDebuffTurns = Math.max(target.statuses.evadeDebuffTurns || 0, evadeDebuffTurns);
          target.statuses.evadeDebuffValue = Math.max((target.statuses.evadeDebuffValue || 0) as number, evadeDebuffValue);
          showText(scene, target, "GIẢM NÉ", "#d8f3ff");
          updateUnit(scene, target);
        }
        const offenseDebuffTurns = Math.max(0, Math.round(Number(skill.offenseDebuffTurns ?? 0) || 0));
        const offenseDebuffValue = resolveOffenseDebuffAmount(scene, target, skill);
        if (offenseDebuffTurns > 0 && offenseDebuffValue > 0) {
          applyOffenseDebuffStatus(target as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
            turns: offenseDebuffTurns,
            value: offenseDebuffValue,
            mode: skill.offenseDebuffMode ?? "atk"
          });
          showText(scene, target, "RÚT CÔNG", "#b7c6ff");
          updateUnit(scene, target);
        }
      }
      return true;
    }
    case "dive_bomb": {
      if (!target) return true;
      (collectUnitsInSameColumn(enemies, target.col) as RangedUnit[]).forEach((enemy) => {
        scene.resolveDamage(attacker, enemy, rawSkill, "physical", "BỔ NHÀO", skillOpts);
        if (enemy.alive) {
          enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, skill.turns || 2);
          enemy.statuses.armorBreakValue = Math.max((enemy.statuses.armorBreakValue || 0) as number, skill.armorBreak || 15);
          updateUnit(scene, enemy);
        }
      });
      return true;
    }
    case "beak_disarm": {
      if (!target) return true;
      scene.resolveDamage(attacker, target, rawSkill, "physical", skill.name as string, skillOpts);
      if (target.alive) {
        const disarmTurns = skill.disableStarTurnScaling
          ? Math.max(1, Math.round(Number(skill.disarmTurns || 1) || 1))
          : getStarTurns(star, skill.disarmTurns || 1);
        target.statuses.disarmTurns = Math.max(target.statuses.disarmTurns || 0, disarmTurns);
        showText(scene, target, "TƯỚC KHÍ", "#ffffff");
        updateUnit(scene, target);
      }
      if (skill.splashNearestCount && (skill.splashNearestCount as number) > 0) {
        enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.splashNearestCount as number)
          .forEach((enemy) => {
            scene.resolveDamage(attacker, enemy, Math.round(rawSkill * 0.7), "physical", "LAN", { ...(skillOpts as RangedSkillOpts), isSplash: true });
          });
      }
      return true;
    }
    case "fire_arrow_burn": {
      if (!target) return true;
      const burnTurns = Math.max(0, Math.round(Number(skill.burnTurns ?? 0) || 0));
      const burnDamage = Math.max(0, Math.round(Number(skill.burnPerTurn ?? 0) || 0));
      const impacted: RangedUnit[] = [target];
      if (skill.splashSameRowCount && (skill.splashSameRowCount as number) > 0) {
        impacted.push(...enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid && enemy.row === target.row)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.splashSameRowCount as number));
      }
      impacted.forEach((enemy, index) => {
        const damage = index === 0 ? rawSkill : Math.round(rawSkill * 0.75);
        scene.resolveDamage(attacker, enemy, damage, "physical", index === 0 ? "TÊN LỬA" : "LAN LỬA", { ...(skillOpts as RangedSkillOpts), isSplash: index > 0 });
        if (enemy.alive && burnTurns > 0 && burnDamage > 0) {
          enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, burnTurns);
          enemy.statuses.burnDamage = Math.max((enemy.statuses.burnDamage || 0) as number, burnDamage);
          showText(scene, enemy, "ĐỐT CHÁY", "#ff6600");
          updateUnit(scene, enemy);
        }
      });
      if (!target.alive && (skill.killSplashBurnDamage as number) > 0) {
        enemies
          .filter((enemy) => enemy.alive && enemy.uid !== target.uid)
          .sort((a, b) => manhattan(target, a) - manhattan(target, b))
          .slice(0, skill.killSplashMaxTargets as number || 1)
          .forEach((enemy) => {
            enemy.statuses.burnTurns = Math.max(enemy.statuses.burnTurns || 0, skill.killSplashBurnTurns || 2);
            enemy.statuses.burnDamage = Math.max(Number(enemy.statuses.burnDamage ?? 0), Number(skill.killSplashBurnDamage ?? 0));
            showText(scene, enemy, "LỬA LAN", "#ff8a2a");
            updateUnit(scene, enemy);
          });
      }
      return true;
    }
    case "heat_seek": {
      const weakest: RangedUnit | null = skill.targetSelector || skill.fallbackTargetSelector
        ? (target ?? (findLowestHpRatioUnit(enemies, null) as RangedUnit | null))
        : (findLowestHpRatioUnit(enemies, null) as RangedUnit | null);
      const executeHpPct = Number(skill.executeHpPct ?? 0.5) || 0.5;
      const executeMultiplier = Number(skill.executeMultiplier ?? 2) || 2;
      if (weakest) {
        const targetWasAlive = weakest.alive;
        scene.resolveDamage(attacker, weakest, (weakest.hp ?? 0) < (weakest.maxHp ?? 0) * executeHpPct ? rawSkill * executeMultiplier : rawSkill, "physical", "TẦM NHIỆT", skillOpts);
        if (targetWasAlive && !weakest.alive && (skill.killRageGain || 0) > 0) {
          attacker.rage = Math.min(attacker.rageMax ?? 100, (attacker.rage || 0) + (skill.killRageGain as number));
          showText(scene, attacker, `+${skill.killRageGain} NỘ`, "#ff8dc7");
          updateUnit(scene, attacker);
        }
      }
      return true;
    }
    case "rapid_fire": {
      if (!target) return true;
      const maxHits = Number.isFinite(Number(skill.maxHits))
        ? Math.max(1, Math.round(Number(skill.maxHits)))
        : 3 + targetBonus;
      let currentTarget: RangedUnit | null = target;
      let lastReference: RangedUnit | null = target;
      const touchedTargets = new Set<string | undefined>(target?.uid ? [target.uid] : []);
      const pickNearestRetarget = (origin: RangedUnit | null, preferUntouched = false): RangedUnit | null => {
        if (!origin) return null;
        const pool = enemies
          .filter((enemy) => enemy.alive && enemy.uid !== origin.uid && (!preferUntouched || !touchedTargets.has(enemy.uid)))
          .sort((a, b) => manhattan(origin, a) - manhattan(origin, b));
        return pool[0] ?? null;
      };
      for (let i = 1; i <= maxHits; i += 1) {
        if (!currentTarget?.alive) {
          if (!skill.retargetOnKill) break;
          currentTarget = pickNearestRetarget(lastReference || target, Boolean(skill.retargetPreferUntouched));
          if (!currentTarget) break;
        }
        const referenceTarget: RangedUnit = currentTarget;
        if (referenceTarget.uid) touchedTargets.add(referenceTarget.uid);
        let hitDamage = rawSkill;
        let hitOpts: RangedSkillOpts = { ...(skillOpts as RangedSkillOpts) };
        if (i === 3 && Number(skill.hit3DamageMultiplier ?? 1) !== 1) {
          hitDamage = Math.max(0, Math.round(rawSkill * Number(skill.hit3DamageMultiplier ?? 1)));
        }
        if (i === 3 && (skill.hit3ArmorPenPct || 0) > 0) {
          hitOpts.armorPen = Math.max(hitOpts.armorPen || 0, skill.hit3ArmorPenPct as number);
        }
        scene.resolveDamage(attacker, currentTarget, hitDamage, "physical", `KHOAN ${i}`, hitOpts);
        if (i === 2 && currentTarget.alive && (skill.hit2ArmorBreak || 0) > 0) {
          currentTarget.statuses.armorBreakTurns = Math.max(currentTarget.statuses.armorBreakTurns || 0, skill.hit2ArmorBreakTurns || 2);
          currentTarget.statuses.armorBreakValue = Math.max((currentTarget.statuses.armorBreakValue || 0) as number, skill.hit2ArmorBreak as number);
          showText(scene, currentTarget, "RẠN GIÁP", "#d8f3ff");
          updateUnit(scene, currentTarget);
        }
        if (i === 4 && (skill.hit4SplashNearestCount || 0) > 0) {
          enemies
            .filter((enemy) => enemy.alive && enemy.uid !== referenceTarget.uid)
            .sort((a, b) => manhattan(referenceTarget, a) - manhattan(referenceTarget, b))
            .slice(0, skill.hit4SplashNearestCount as number)
            .forEach((enemy) => {
              const splashDamage = Math.max(0, Math.round(rawSkill * Number(skill.hit4SplashDamageMultiplier ?? 0.5)));
              scene.resolveDamage(attacker, enemy, splashDamage, "physical", "MẢNH GIÁP", { ...(skillOpts as RangedSkillOpts), isSplash: true });
              if (enemy.alive && (skill.hit4SplashArmorBreak || 0) > 0) {
                enemy.statuses.armorBreakTurns = Math.max(enemy.statuses.armorBreakTurns || 0, skill.hit4SplashArmorBreakTurns || 2);
                enemy.statuses.armorBreakValue = Math.max((enemy.statuses.armorBreakValue || 0) as number, skill.hit4SplashArmorBreak as number);
                showText(scene, enemy, "RẠN GIÁP", "#d8f3ff");
              }
              updateUnit(scene, enemy);
            });
        }
        if (i === 5 && (skill.hit5SplitNearestCount || 0) > 0) {
          enemies
            .filter((enemy) => enemy.alive && enemy.uid !== referenceTarget.uid && (!skill.hit5PreferUntouched || !touchedTargets.has(enemy.uid)))
            .sort((a, b) => manhattan(referenceTarget, a) - manhattan(referenceTarget, b))
            .slice(0, skill.hit5SplitNearestCount as number)
            .forEach((enemy) => {
              const splitDamage = Math.max(0, Math.round(rawSkill * Number(skill.hit5SplitDamageMultiplier ?? 1)));
              scene.resolveDamage(attacker, enemy, splitDamage, "physical", "TÁN KHOAN", { ...(skillOpts as RangedSkillOpts), isSplash: true });
              updateUnit(scene, enemy);
              if (enemy.uid) touchedTargets.add(enemy.uid);
            });
        }
        lastReference = referenceTarget;
        if (!currentTarget.alive && skill.retargetOnKill) {
          currentTarget = pickNearestRetarget(referenceTarget, Boolean(skill.retargetPreferUntouched));
        }
      }
      return true;
    }
    case "chromatic_dart_chain": {
      if (!target?.alive) return true;
      const chanceIncrementRed = Math.max(0, Number(skill.redChanceIncrement ?? 0.05) || 0);
      const chanceIncrementYellow = Math.max(0, Number(skill.yellowChanceIncrement ?? 0.01) || 0);
      const redChance = Math.min(1, Math.max(0, (Number(skill.redBaseChance ?? 0.5) || 0) + (Number(attacker.statuses.chromaticDartRedBonus) || 0)));
      const yellowChance = Math.min(1, Math.max(0, (Number(skill.yellowBaseChance ?? 0.25) || 0) + (Number(attacker.statuses.chromaticDartYellowBonus) || 0)));
      const addCastBonus = () => {
        attacker.statuses.chromaticDartRedBonus = Math.min(1, (Number(attacker.statuses.chromaticDartRedBonus) || 0) + chanceIncrementRed);
        attacker.statuses.chromaticDartYellowBonus = Math.min(1, (Number(attacker.statuses.chromaticDartYellowBonus) || 0) + chanceIncrementYellow);
      };
      const dealDart = (label: string, color: string): number => {
        const dealt = scene.resolveDamage(attacker, target, rawSkill, skill.damageType || "physical", label, skillOpts);
        showText(scene, target, label, color);
        addCastBonus();
        return Math.max(0, Number(dealt) || 0);
      };

      const blueDamage = dealDart("PHI TIÊU XANH", "#60c8ff");
      const blueLifesteal = Math.max(0, Number(skill.blueLifestealPct ?? 0.5) || 0);
      if (blueDamage > 0 && blueLifesteal > 0) {
        scene.healUnit(attacker, attacker, Math.round(blueDamage * blueLifesteal), "PHI TIÊU XANH");
      }

      const redUnlocked = star >= Math.max(2, Number(skill.redUnlockStar ?? 2) || 2);
      const redThrown = redUnlocked && target.alive && rollChance(scene, redChance);
      if (redThrown) {
        const redDamage = dealDart("PHI TIÊU ĐỎ", "#ff5c63");
        const splashDamage = Math.max(0, Math.round(redDamage * Math.max(0, Number(skill.redCrossDamageMultiplier ?? 0.5) || 0)));
        if (splashDamage > 0) {
          const crossTargets = enemies.filter((enemy) => enemy.alive && enemy.uid !== target.uid && (
            (enemy.row === target.row && Math.abs((enemy.col ?? 0) - (target.col ?? 0)) === 1)
            || (enemy.col === target.col && Math.abs((enemy.row ?? 0) - (target.row ?? 0)) === 1)
          ));
          crossTargets.forEach((enemy) => {
            scene.resolveDamage(attacker, enemy, splashDamage, skill.damageType || "physical", "NỔ ĐỎ", { ...(skillOpts as RangedSkillOpts), isSplash: true });
            updateUnit(scene, enemy);
          });
        }
      }

      const yellowUnlocked = star >= Math.max(3, Number(skill.yellowUnlockStar ?? 3) || 3);
      const yellowThrown = yellowUnlocked && redThrown && target.alive && rollChance(scene, yellowChance);
      if (yellowThrown) {
        dealDart("PHI TIÊU VÀNG", "#ffd84d");
        if (target.alive) {
          target.statuses.stun = Math.max(target.statuses.stun || 0, Math.max(1, Math.round(Number(skill.yellowStunTurns ?? 2) || 2)));
          showText(scene, target, "CHOÁNG", "#ffd84d");
          updateUnit(scene, target);
        }
      }

      attacker.statuses.chromaticDartLastCast = { redChance, yellowChance, redThrown, yellowThrown };
      updateUnit(scene, attacker);
      return true;
    }
    case "dark_feather_debuff": {
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const maxHits = Number.isFinite(Number(skill.maxHits))
        ? Math.max(1, Math.round(Number(skill.maxHits)))
        : Math.max(1, (Number(skill.maxTargets || 3) || 3) + targetBonus);
      const initialTargets = collectConfiguredTargets(
        scene,
        attacker,
        target,
        skill,
        aliveEnemies,
        maxHits,
        skill.multiTargetSelector || skill.targetSelector || "backline_caster",
        {
          allowRepeatTargets: false,
          targetClasses: skill.targetClasses ?? ["MAGE", "SUPPORT", "ARCHER"],
          excludeClasses: skill.excludeTargetClasses ?? [],
          requireBackline: skill.requireBackline ?? false,
          requireRanged: skill.requireRanged ?? false,
          preferBackline: skill.preferBackline ?? true,
          preferRanged: skill.preferRanged ?? true,
          preferHighRage: skill.preferHighRage ?? true
        }
      );
      const differentTargetsHit = new Set<string | undefined>();
      let markedTarget: RangedUnit | null = null;
      let repeatMarkedShots = Math.max(0, Math.round(Number(skill.repeatMarkedTargetShots ?? 0) || 0));
      const finalTargetThreshold = Math.max(1, Math.round(Number(skill.finalTargetMinDifferentTargets ?? 3) || 3));

      for (let i = 0; i < maxHits; i += 1) {
        let enemy: RangedUnit | null = null;
        const useFinalFeather = i === maxHits - 1 && differentTargetsHit.size >= finalTargetThreshold && skill.finalTargetSelector;
        if (useFinalFeather) {
          enemy = collectConfiguredTargets(
            scene,
            attacker,
            target,
            skill,
            aliveEnemies,
            1,
            skill.finalTargetSelector,
            {
              allowRepeatTargets: true,
              preferBackline: skill.finalTargetPreferBackline ?? true,
              preferRanged: skill.finalTargetPreferRanged ?? true,
              preferHighRage: skill.finalTargetPreferHighRage ?? true
            }
          )[0] ?? null;
        }
        if (!enemy && repeatMarkedShots > 0 && markedTarget?.alive) {
          enemy = markedTarget;
          repeatMarkedShots -= 1;
        }
        if (!enemy) {
          enemy = initialTargets[i] ?? initialTargets[0] ?? null;
        }
        if (!enemy?.alive) {
          enemy = collectConfiguredTargets(
            scene,
            attacker,
            target,
            skill,
            aliveEnemies.filter((candidate) => candidate.uid !== markedTarget?.uid),
            1,
            skill.multiTargetSelector || skill.targetSelector || "backline_caster",
            {
              allowRepeatTargets: false,
              targetClasses: skill.targetClasses ?? ["MAGE", "SUPPORT", "ARCHER"],
              excludeClasses: skill.excludeTargetClasses ?? [],
              requireBackline: skill.requireBackline ?? false,
              requireRanged: skill.requireRanged ?? false,
              preferBackline: skill.preferBackline ?? true,
              preferRanged: skill.preferRanged ?? true,
              preferHighRage: skill.preferHighRage ?? true
            }
          )[0] ?? null;
        }
        if (!enemy) break;

        const isMarkedTarget = markedTarget?.uid != null && enemy.uid === markedTarget.uid;
        let featherDamage = rawSkill;
        if (isMarkedTarget && (skill.markedTargetDamageMultiplier || 0) > 0) {
          featherDamage = Math.max(0, Math.round(featherDamage * Number(skill.markedTargetDamageMultiplier || 1)));
        }
        if (useFinalFeather && (skill.finalTargetDamageMultiplier || 0) > 0) {
          featherDamage = Math.max(0, Math.round(rawSkill * Number(skill.finalTargetDamageMultiplier || 1)));
        }

        scene.resolveDamage(attacker, enemy, featherDamage, "physical", useFinalFeather ? "LÔNG CHỐT" : "LÔNG ĐEN", skillOpts);
        if (!markedTarget && skill.markFirstTarget !== false) markedTarget = enemy;
        if (enemy.alive) {
          const offenseDebuffValue = resolveOffenseDebuffAmount(scene, enemy, skill);
          const resolvedDebuffValue = offenseDebuffValue > 0
            ? offenseDebuffValue
            : Math.round((skill.offenseDebuffValue ?? skill.atkDebuffValue ?? 8) * starScale);
          applyOffenseDebuffStatus(enemy as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
            turns: (skill.offenseDebuffTurns ?? skill.turns ?? 2) as number,
            value: resolvedDebuffValue,
            mode: skill.offenseDebuffMode ?? "autoByRole"
          });
          const shouldDrainMarkedTarget = isMarkedTarget
            && (!(useFinalFeather && enemy.uid === markedTarget?.uid) || (skill.finalTargetRageDrain || 0) <= 0);
          if (shouldDrainMarkedTarget && (skill.markedTargetRageDrain || 0) > 0) {
            const drainAmount = Math.max(1, Math.round(Number(skill.markedTargetRageDrain || 0) || 0));
            enemy.rage = Math.max(0, (enemy.rage || 0) - drainAmount);
            showText(scene, enemy, `-${drainAmount} NỘ`, "#b8f5ff");
          }
          if (useFinalFeather && (skill.finalTargetRageDrain || 0) > 0) {
            const drainAmount = Math.max(1, Math.round(Number(skill.finalTargetRageDrain || 0) || 0));
            enemy.rage = Math.max(0, (enemy.rage || 0) - drainAmount);
            showText(scene, enemy, `-${drainAmount} NỘ`, "#b8f5ff");
          }
          if (useFinalFeather && (skill.finalTargetOffenseDebuffPct || 0) > 0 && (skill.finalTargetOffenseDebuffTurns || 0) > 0) {
            applyOffenseDebuffStatus(enemy as unknown as Parameters<typeof applyOffenseDebuffStatus>[0], {
              turns: skill.finalTargetOffenseDebuffTurns as number,
              value: Math.max(1, Math.round((scene.getEffectiveAtk?.(enemy) ?? enemy?.atk ?? 0) * (skill.finalTargetOffenseDebuffPct as number))),
              mode: skill.finalTargetOffenseDebuffMode ?? "autoByRole"
            });
          }
          updateUnit(scene, enemy);
        }
        if (enemy.uid) differentTargetsHit.add(enemy.uid);
      }
      return true;
    }
    case "multi_sting_poison": {
      const randomFn = scene?.random?.bind(scene) ?? Math.random;
      const maxHits = Math.max(1, Math.round(Number(skill.maxHits ?? skill.maxTargets ?? 2) || 2));
      const poisonTurns = Math.max(0, Math.round(Number(skill.poisonTurns ?? 0) || 0));
      const poisonPerTurn = Math.max(0, Math.round(Number(skill.poisonPerTurn ?? 0) || 0));
      const bonusDamageMultiplier = Math.max(0, Number(skill.bonusDamageMultiplier ?? 1) || 1);
      const extendPoisonTurnsOnPoisonedHit = Math.max(0, Math.round(Number(skill.extendPoisonTurnsOnPoisonedHit ?? 0) || 0));
      const rageDrainOnPoisonedHit = Math.max(
        0,
        Math.round(Number(skill.rageDrainOnPoisonedHit ?? skill.rageDrainIfPoisoned ?? 0) || 0)
      );
      const poisonBurstNearestCount = Math.max(0, Math.round(Number(skill.poisonBurstNearestCount ?? 0) || 0));
      const poisonBurstDamageMultiplier = Math.max(0, Number(skill.poisonBurstDamageMultiplier ?? 0.6) || 0.6);
      const poisonBurstTurns = Math.max(0, Math.round(Number(skill.poisonBurstTurns ?? poisonTurns) || 0));
      const poisonBurstPerTurn = Math.max(0, Math.round(Number(skill.poisonBurstPerTurn ?? poisonPerTurn) || 0));
      const aliveEnemies = enemies.filter((enemy) => enemy.alive);
      const initialTargets: RangedUnit[] = skill.uniqueTargets || skill.multiTargetSelector || skill.targetSelector
        ? collectConfiguredTargets(
            scene,
            attacker,
            target,
            skill,
            aliveEnemies,
            maxHits,
            skill.multiTargetSelector || skill.targetSelector || "random",
            { allowRepeatTargets: false }
          )
        : collectRandomAliveUnits(aliveEnemies, maxHits, null, randomFn) as RangedUnit[];
      const queue: (RangedUnit | null | undefined)[] = [...initialTargets];
      let shotsLeft = maxHits;
      while (shotsLeft > 0) {
        let enemy: RangedUnit | null | undefined = queue.shift();
        if (!enemy || !enemy.alive) {
          enemy = aliveEnemies.find((candidate) => candidate.alive) ?? null;
          if (!enemy) break;
        }
        const hadPoison = (enemy.statuses?.poisonTurns || 0) > 0;
        const hitDamage = hadPoison && bonusDamageMultiplier > 0
          ? Math.max(1, Math.round(rawSkill * bonusDamageMultiplier))
          : rawSkill;
        scene.resolveDamage(attacker, enemy, hitDamage, skill.damageType || "physical", "CHÂM", skillOpts);
        shotsLeft -= 1;
        const appliedPoisonTurns = hadPoison ? poisonTurns + extendPoisonTurnsOnPoisonedHit : poisonTurns;
        if (enemy.alive && appliedPoisonTurns > 0 && poisonPerTurn > 0) {
          enemy.statuses.poisonTurns = Math.max(enemy.statuses.poisonTurns || 0, appliedPoisonTurns);
          enemy.statuses.poisonDamage = Math.max((enemy.statuses.poisonDamage || 0) as number, poisonPerTurn);
          showText(scene, enemy, "NHIỄM ĐỘC", "#9b59b6");
        }
        if (enemy.alive && hadPoison && rageDrainOnPoisonedHit > 0) {
          enemy.rage = Math.max(0, (enemy.rage || 0) - rageDrainOnPoisonedHit);
          showText(scene, enemy, `-${rageDrainOnPoisonedHit} NỘ`, "#b8f5ff");
        }
        if (hadPoison && poisonBurstNearestCount > 0) {
          const burstDamage = Math.max(0, Math.round(rawSkill * poisonBurstDamageMultiplier));
          enemies
            .filter((other) => other.alive && other.uid !== enemy.uid)
            .sort((a, b) => manhattan(enemy as RangedUnit, a) - manhattan(enemy as RangedUnit, b))
            .slice(0, poisonBurstNearestCount)
            .forEach((other) => {
              scene.resolveDamage(attacker, other, burstDamage, skill.damageType || "physical", "NỔ ĐỘC", { ...(skillOpts as RangedSkillOpts), isSplash: true });
              if (other.alive && poisonBurstTurns > 0 && poisonBurstPerTurn > 0) {
                other.statuses.poisonTurns = Math.max(other.statuses.poisonTurns || 0, poisonBurstTurns);
                other.statuses.poisonDamage = Math.max((other.statuses.poisonDamage || 0) as number, poisonBurstPerTurn);
                showText(scene, other, "LAN ĐỘC", "#9b59b6");
              }
              updateUnit(scene, other);
            });
        }
        if (!enemy.alive && hadPoison && shotsLeft > 0 && skill.retargetPoisonedOnKill) {
          const retarget = enemies
            .filter((other) => other.alive && other.uid !== enemy.uid && (other.statuses?.poisonTurns || 0) > 0)
            .sort((a, b) => manhattan(enemy as RangedUnit, a) - manhattan(enemy as RangedUnit, b))[0];
          if (retarget) queue.unshift(retarget);
        }
        if (enemy.alive) {
          updateUnit(scene, enemy);
        }
      }
      return true;
    }
    default:
      return false;
  }
}
