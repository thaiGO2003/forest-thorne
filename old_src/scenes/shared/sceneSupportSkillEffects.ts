import { getStarTurns, manhattan, sampleWithoutReplacement } from "../../core/gameUtils.js";
import {
  buildSkillSelectionOptions,
  collectUnitsBySelector,
  collectHighestEffectiveAtkUnits,
  collectLowestHpRatioUnits,
  collectUnitsInSameRow,
  findHighestEffectiveAtkUnit,
  findLowestHpRatioUnit
} from "./sceneSkillTargeting.js";
import type { SkillTargetUnit, BuildSkillSelectionScene } from "./sceneSkillTargeting.js";
type GridPosition = { row: number; col: number };
interface SupportSkillScene {
  showFloatingText: (x: number, y: number, text: string, color: string | number) => void;
  updateCombatUnitUi: (unit: SupportSkillUnit) => void;
  getEffectiveAtk: (unit: SupportSkillUnit) => number;
  getEffectiveDef: (unit: SupportSkillUnit) => number;
  getEffectiveMdef: (unit: SupportSkillUnit) => number;
  getEffectiveMatk: (unit: SupportSkillUnit) => number;
  getStarSkillMultiplier: (star: number) => number;
  addShield: (unit: SupportSkillUnit, amount: number) => void;
  healUnit: (attacker: SupportSkillUnit | null, target: SupportSkillUnit, amount: number, label: string) => void;
  resolveDamage?: (attacker: SupportSkillUnit | null, target: SupportSkillUnit, amount: number, type: string, name: string, options: unknown) => void;
  getCombatUnits: (side: string) => SupportSkillUnit[];
  rollChance: (chance: number) => boolean;
  random?: () => number;
  [key: string]: unknown;
}

interface SupportSkillUnit {
  uid?: string | number;
  alive?: boolean;
  classType?: string;
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  range?: number;
  hp: number;
  maxHp: number;
  shield?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  rage: number;
  rageMax: number;
  star?: number;
  statuses: Record<string, unknown>;
  mods: Record<string, unknown>;
  sprite?: { x: number; y: number; active?: boolean; scaleX?: number };
  [key: string]: unknown;
}

interface SupportSkillAbilityDef {
  id?: string;
  target?: { shape?: { type?: string; count?: number } };
  riders?: unknown[];
  [key: string]: unknown;
}

interface SupportSkillShape {
  type?: string;
  count?: number;
  [key: string]: unknown;
}

interface SupportSkill {
  resolvedAbilityDef?: SupportSkillAbilityDef;
  abilityDef?: SupportSkillAbilityDef;
  target?: SupportSkillShape;
  maxTargets?: number;
  turns?: number;
  star?: number;
  name?: string;
  key?: string;
  damage?: number;
  multiplier?: number;
  burnDmg?: number;
  burnTurns?: number;
  freezeChance?: number;
  stunChance?: number;
  silenceChance?: number;
  shieldAmount?: number;
  shieldPct?: number;
  healAmount?: number;
  healPct?: number;
  rageGain?: number;
  rageCost?: number;
  buffAtk?: number;
  buffDef?: number;
  buffMatk?: number;
  buffMdef?: number;
  buffSpeed?: number;
  buffDuration?: number;
  debuffAtk?: number;
  debuffDef?: number;
  debuffMatk?: number;
  debuffMdef?: number;
  debuffDuration?: number;
  targetSelector?: string;
  fallbackTargetSelector?: string;
  targetClasses?: string[];
  excludeTargetClasses?: string[];
  requireFrontline?: boolean;
  requireBackline?: boolean;
  requireRanged?: boolean;
  preferFrontline?: boolean;
  preferBackline?: boolean;
  preferRanged?: boolean;
  runtimeShapeVersion?: number;
  disableStarTurnScaling?: boolean;
  preferDebuffed?: boolean;
  requireDebuffed?: boolean;
  preferShielded?: boolean;
  requireShielded?: boolean;
  preferHighRage?: boolean;
  preferClasses?: string[];
  // Support skill effect fields
  effect?: string;
  allySelector?: string;
  armorBuff?: number;
  physReflectPct?: number;
  reflectPct?: number;
  physReflectTurns?: number;
  onHitOffenseDebuffValue?: number;
  onHitOffenseDebuffTurns?: number;
  onHitOffenseDebuffMode?: string;
  tauntTurns?: number;
  tauntTargetSelector?: string;
  includeSelf?: boolean;
  shieldBase?: number;
  shieldScale?: number;
  shieldScaleStat?: string;
  shieldSharePct?: number;
  maxHpBuffPct?: number;
  maxHpBuffFlat?: number;
  healPctMaxHp?: number;
  mdefBuff?: number;
  damageReductionPct?: number;
  shareBehindDamageReductionPct?: number;
  // Additional properties accessed in effect code
  allyBuffPct?: number;
  allyBuffTurns?: number;
  allyHealPctMaxHp?: number;
  allyRageGain?: number;
  atkBuffTurns?: number;
  atkBuffPct?: number;
  atkBuffValue?: number;
  cleanseCount?: number;
  cleanseCountToWeakest?: number;
  cleanseWeakestHpBelowPct?: number;
  defBuffTurns?: number;
  defBuffValue?: number;
  bonusHealToPrimary?: number;
  bonusShieldBase?: number;
  bonusShieldSelector?: string;
  bonusTargetBuffPct?: number;
  bonusTargetBuffTurns?: number;
  bonusTargetProcChance?: number;
  bonusTargetRageGain?: number;
  cleanseBelowHpCount?: number;
  damageBase?: number;
  damageScale?: number;
  damageScaleStat?: string;
  damageTargetSelector?: string;
  damageType?: string;
  evadeBuff?: number;
  evadeBuffTurns?: number;
  evadeBuffStartRage?: number;
  evadeBuffWeakestRage?: number;
  evadeBuffDodgeHeal?: number;
  evadeBuffDodgeShield?: number;
  evadeBuffDodgeRage?: number;
  expandedMaxTargets?: number;
  guardianAbsorbPct?: number;
  healBase?: number;
  healScale?: number;
  hotPctMaxHp?: number;
  hotTurns?: number;
  includeSelfBuff?: boolean;
  magicDamageReductionPct?: number;
  magicDamageReductionTurns?: number;
  nameVi?: string;
  primaryCarryBuffPct?: number;
  primaryCarryBuffTurns?: number;
  primaryCarryRageGain?: number;
  primaryTargetDamageReductionPct?: number;
  rageGainBelowHpPct?: number;
  rageGrantHpBelowPct?: number;
  rageGrantToWeakest?: number;
  reflectTurns?: number;
  selfFallbackRageGain?: number;
  selfHealPctMaxHp?: number;
  shieldBelowHpPct?: number;
  shieldBelowHpValue?: number;
  shieldPctMaxHp?: number;
  shieldSharePctToNearest?: number;
  shareTargetCount?: number;
  shareTargetRageGain?: number;
  soulLinkCleanseCount?: number;
  soulLinkHealMultiplier?: number;
  soulLinkHealMultipliers?: number[];
  soulLinkRageGain?: number;
  soulLinkShieldPct?: number;
  soulLinkTargetCount?: number;
  [key: string]: unknown;
}

type SupportPredicate = (unit: SupportSkillUnit) => boolean;


function showText(scene: SupportSkillScene, unit: SupportSkillUnit, text: string, color: string | number): void {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText(unit.sprite.x, unit.sprite.y - 45, text, color);
}

function updateUnit(scene: SupportSkillScene, unit: SupportSkillUnit): void {
  scene.updateCombatUnitUi(unit);
}

function clearCommonDebuffs(unit: SupportSkillUnit): void {
  unit.statuses.freeze = 0;
  unit.statuses.stun = 0;
  unit.statuses.sleep = 0;
  unit.statuses.silence = 0;
  unit.statuses.burnTurns = 0;
  unit.statuses.fireVulnerabilityTurns = 0;
  unit.statuses.fireVulnerabilityMultiplier = 1;
  unit.statuses.poisonTurns = 0;
  unit.statuses.healBlockTurns = 0;
  unit.statuses.healBlockSourceId = null;
  unit.statuses.healReductionTurns = 0;
  unit.statuses.healReductionPct = 0;
}

function getResolvedAbility(skill: SupportSkill | null | undefined): SupportSkillAbilityDef | null {
  return skill?.resolvedAbilityDef ?? skill?.abilityDef ?? null;
}

function getResolvedRiders(skill: SupportSkill | null | undefined): unknown[] {
  const ability = getResolvedAbility(skill);
  return Array.isArray(ability?.riders) ? ability.riders : [];
}

function findResolvedRider(skill: SupportSkill | null | undefined, predicate: (rider: unknown) => boolean): unknown {
  return getResolvedRiders(skill).find((rider) => predicate(rider));
}

function getResolvedTargetCount(skill: SupportSkill | null | undefined, fallback: number = 1): number {
  const explicitCount = Number(skill?.maxTargets);
  if (Number.isFinite(explicitCount) && explicitCount > 0) return explicitCount;
  const ability = getResolvedAbility(skill);
  const shape = ability?.target?.shape ?? null;
  if (shape?.type === "all_allies" || shape?.type === "all_enemies") return Number.POSITIVE_INFINITY;
  const count = Number(shape?.count ?? skill?.maxTargets);
  return Number.isFinite(count) && count > 0 ? count : fallback;
}

function resolveTurnDuration(skill: SupportSkill | null | undefined, star: number, fallback: number = 1, explicitTurns: number | null = null): number {
  const rawTurns = explicitTurns ?? skill?.turns;
  const baseTurns = Number.isFinite(Number(rawTurns)) && Number(rawTurns) > 0
    ? Math.max(1, Math.round(Number(rawTurns)))
    : fallback;
  if (skill?.runtimeShapeVersion === 3 || skill?.disableStarTurnScaling) return baseTurns;
  return getStarTurns(star, baseTurns);
}

function collectLimitedLowestHpUnits(units: SupportSkillUnit[], count: number, filterFn: SupportPredicate | null = null): SupportSkillUnit[] {
  const pool = units.filter((unit) => unit.alive && (!filterFn || filterFn(unit)));
  if (!pool.length) return [];
  if (!Number.isFinite(count)) {
    return pool.sort((a, b) => (Number(a?.hp ?? 0) / Math.max(1, Number(a?.maxHp ?? 1))) - (Number(b?.hp ?? 0) / Math.max(1, Number(b?.maxHp ?? 1))));
  }
  return collectLowestHpRatioUnits(pool, Math.max(1, count)) as unknown as SupportSkillUnit[];
}

function getEffectiveStat(scene: SupportSkillScene, unit: SupportSkillUnit, stat: string): number {
  if (stat === "matk") return scene.getEffectiveMatk(unit);
  if (stat === "def") return scene.getEffectiveDef(unit);
  if (stat === "mdef") return scene.getEffectiveMdef(unit);
  if (stat === "hp") return unit?.maxHp ?? unit?.hp ?? 0;
  return scene.getEffectiveAtk(unit);
}

function calcScaledValue(scene: SupportSkillScene, unit: SupportSkillUnit, base: unknown, ratio: unknown, stat: string): number {
  return Math.round((Number(base ?? 0) || 0) + (getEffectiveStat(scene, unit, stat) * (Number(ratio ?? 0) || 0)));
}

function cleanseUnit(unit: SupportSkillUnit, count: number = 1): number {
  const debuffs = ["freeze", "stun", "sleep", "silence", "burnTurns", "fireVulnerabilityTurns", "poisonTurns", "bleedTurns", "diseaseTurns", "healBlockTurns", "healReductionTurns"];
  const active = debuffs.filter((key) => Number(unit.statuses[key] ?? 0) > 0);
  if (!active.length) return 0;
  if (!Number.isFinite(count) || count >= active.length) {
    clearCommonDebuffs(unit);
    unit.statuses.bleedTurns = 0;
    unit.statuses.diseaseTurns = 0;
    unit.statuses.healBlockTurns = 0;
    unit.statuses.healBlockSourceId = null;
    unit.statuses.healReductionTurns = 0;
    unit.statuses.healReductionPct = 0;
    return active.length;
  }
  active.slice(0, Math.max(1, count)).forEach((key) => {
    unit.statuses[key] = 0;
    if (key === "fireVulnerabilityTurns") unit.statuses.fireVulnerabilityMultiplier = 1;
    if (key === "healReductionTurns") unit.statuses.healReductionPct = 0;
  });
  if ((Number(unit.statuses.healBlockTurns ?? 0)) <= 0) {
    unit.statuses.healBlockSourceId = null;
  }
  return Math.min(active.length, Math.max(1, count));
}

function findNearestAliveAlly(attacker: SupportSkillUnit | null | undefined, allies: SupportSkillUnit[]): SupportSkillUnit | null {
  if (!attacker) return null;
  return allies
    .filter((ally) => ally.alive && ally.uid !== attacker?.uid)
    .sort((a, b) => manhattan(attacker as unknown as GridPosition, a as unknown as GridPosition) - manhattan(attacker as unknown as GridPosition, b as unknown as GridPosition))[0] ?? null;
}

function selectSupportTargets(scene: SupportSkillScene, attacker: SupportSkillUnit | null, target: SupportSkillUnit | null, skill: SupportSkill | null | undefined, allies: SupportSkillUnit[], count: number, selector: string | null = null): SupportSkillUnit[] {
  return collectUnitsBySelector(
    allies,
    selector || skill?.allySelector || "lowest_hp_pct",
    count,
    {
      ...buildSkillSelectionOptions(scene as unknown as BuildSkillSelectionScene, attacker, target, skill),
      excludeUid: skill?.includeSelf ? null : attacker?.uid
    }
  ) as unknown as SupportSkillUnit[];
}

export function applySharedSupportSkillEffect(scene: SupportSkillScene, context: { attacker: SupportSkillUnit | null; skill: SupportSkill; rawSkill?: unknown; allies: SupportSkillUnit[]; enemies: SupportSkillUnit[]; targetBonus?: number }): boolean {
  const {
    attacker,
    skill,
    rawSkill,
    allies,
    enemies,
    targetBonus = 0
  } = context;

  const star = attacker?.star ?? 1;
  const starScale = scene.getStarSkillMultiplier(star);
  if (!attacker) return skill.effect === "team_rage" ? true : false;

  switch (skill.effect) {
    case "team_rage": {
      const rageGain = Math.max(0, Math.round(Number(skill.rageGain || 0) || 0));
      const targets = selectSupportTargets(
        scene,
        attacker,
        null,
        skill,
        allies,
        Math.max(1, Math.round(Number(skill.maxTargets || 1) || 1)),
        skill.allySelector || "lowest_rage_ally"
      );
      targets.forEach((ally) => {
        if (!ally?.alive) return;
        if (rageGain > 0) {
          ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + rageGain);
        }
        showText(scene, ally, `+${rageGain || 0} NỘ`, "#b8f5ff");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "self_armor_reflect": {
      const turns = resolveTurnDuration(skill, star, 3);
      const defBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(skill.armorBuff || 25))
        : Math.max(1, Math.round((skill.armorBuff || 25) * starScale));
      const reflectPct = skill.runtimeShapeVersion === 3
        ? Math.max(0, skill.physReflectPct || skill.reflectPct || 1)
        : Math.max(0, skill.reflectPct || 1);
      attacker.statuses.defBuffTurns = Math.max(Number(attacker.statuses.defBuffTurns ?? 0), turns);
      attacker.statuses.defBuffValue = Math.max(Number(attacker.statuses.defBuffValue ?? 0), defBuff);
      attacker.statuses.physReflectTurns = Math.max(Number(attacker.statuses.physReflectTurns ?? 0), turns);
      attacker.statuses.physReflectPct = Math.max(Number(attacker.statuses.physReflectPct ?? 0) || 0, reflectPct);
      if ((skill.onHitOffenseDebuffValue || 0) > 0 && (skill.onHitOffenseDebuffTurns || 0) > 0) {
        attacker.statuses.onHitOffenseDebuffTurns = Math.max(
          Number(attacker.statuses.onHitOffenseDebuffTurns ?? 0) || 0,
          Math.max(1, Math.round(Number(skill.onHitOffenseDebuffTurns ?? 0)))
        );
        attacker.statuses.onHitOffenseDebuffValue = Math.max(
          Number(attacker.statuses.onHitOffenseDebuffValue ?? 0) || 0,
          Math.max(1, Math.round(Number(skill.onHitOffenseDebuffValue ?? 0)))
        );
        attacker.statuses.onHitOffenseDebuffMode = skill.onHitOffenseDebuffMode || "autoByRole";
      }
      if ((skill.tauntTurns || 0) > 0) {
        const tauntTargets = skill.tauntTargetSelector
          ? (collectUnitsBySelector(
              scene.getCombatUnits(attacker.side === "LEFT" ? "RIGHT" : "LEFT") as SupportSkillUnit[],
              skill.tauntTargetSelector,
              1,
              buildSkillSelectionOptions(scene as unknown as BuildSkillSelectionScene, attacker, null, skill)
            ) as unknown as SupportSkillUnit[])
          : [];
        tauntTargets.forEach((enemy) => {
          enemy.statuses.tauntTargetId = attacker.uid;
          enemy.statuses.tauntTurns = Math.max(Number(enemy.statuses.tauntTurns ?? 0) || 0, Number(skill.tauntTurns || 0));
          updateUnit(scene, enemy);
        });
      }
      showText(scene, attacker, "GAI ĐÁ", "#ffa944");
      updateUnit(scene, attacker);
      return true;
    }
    case "self_shield_immune": {
      const turns = resolveTurnDuration(skill, star, 2);
      const shieldAmt = skill.runtimeShapeVersion === 3
        ? calcScaledValue(scene, attacker, skill.shieldBase || 50, skill.shieldScale || 0.4, skill.shieldScaleStat || "def")
        : Math.round(((skill.shieldBase || 50) + scene.getEffectiveDef(attacker) * (skill.shieldScale || 0.40)) * starScale);
      scene.addShield(attacker, shieldAmt);
      if (skill.runtimeShapeVersion === 3 && (skill.shieldSharePct || 0) > 0) {
        (collectUnitsInSameRow(allies, attacker.row ?? 0, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit[]).forEach((ally) => {
          const shareAmount = Math.max(1, Math.round(shieldAmt * (skill.shieldSharePct || 0)));
          scene.addShield(ally, shareAmount);
          showText(scene, ally, `+${shareAmount} KHIÊN`, "#83e5ff");
          updateUnit(scene, ally);
        });
      }
      attacker.statuses.immuneTurns = Math.max(Number(attacker.statuses.immuneTurns ?? 0), turns);
      showText(scene, attacker, "PHÁO ĐÀI", "#83e5ff");
      updateUnit(scene, attacker);
      return true;
    }
    case "guardian_pact": {
      const targetCount = skill.runtimeShapeVersion === 3 ? getResolvedTargetCount(skill, 1) : 1;
      const weakestUnits = skill.runtimeShapeVersion === 3
        ? (skill.allySelector
            ? selectSupportTargets(scene, attacker, null, skill, allies, targetCount, skill.allySelector)
            : collectLimitedLowestHpUnits(allies, targetCount, (ally) => ally.uid !== attacker.uid))
        : [findLowestHpRatioUnit(allies, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit | null].filter(Boolean) as unknown as SupportSkillUnit[];
      const guardianTurns = resolveTurnDuration(skill, star, 3);
      const guardianAbsorb = skill.runtimeShapeVersion === 3
        ? Math.max(0, skill.guardianAbsorbPct || 0.3)
        : Math.min(0.5, 0.30 * starScale);
      weakestUnits.forEach((weakest) => {
        weakest.statuses.guardianId = attacker.uid;
        weakest.statuses.guardianTurns = Math.max(Number(weakest.statuses.guardianTurns ?? 0) || 0, guardianTurns);
        weakest.statuses.guardianAbsorb = Math.max(Number(weakest.statuses.guardianAbsorb ?? 0) || 0, guardianAbsorb);
        if ((Number(skill.cleanseCount || 0)) > 0) cleanseUnit(weakest, Number(skill.cleanseCount || 0));
        showText(scene, weakest, "ĐƯỢC BẢO VỆ", "#9dffba");
        updateUnit(scene, weakest);
      });
      if (weakestUnits.length) showText(scene, attacker, "KẸP BẢO VỆ", "#9dffba");
      const defBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(skill.armorBuff || 15))
        : Math.max(1, Math.round(15 * starScale));
      attacker.statuses.defBuffTurns = Math.max(Number(attacker.statuses.defBuffTurns ?? 0), guardianTurns);
      attacker.statuses.defBuffValue = Math.max(Number(attacker.statuses.defBuffValue ?? 0), defBuff);
      updateUnit(scene, attacker);
      return true;
    }
    case "self_maxhp_boost": {
      const boostPct = skill.runtimeShapeVersion === 3
        ? Math.max(0, skill.maxHpBuffPct || 0)
        : (0.15 * starScale);
      const increase = Math.round(Number(attacker.maxHp ?? 0) * (boostPct)) + Math.round(skill.runtimeShapeVersion === 3 ? (skill.maxHpBuffFlat || 0) : 0);
      const healPct = skill.runtimeShapeVersion === 3
        ? Math.max(0, skill.healPctMaxHp || 0)
        : boostPct;
      attacker.maxHp += increase;
      attacker.hp = Math.min(Number(attacker.maxHp ?? 0), attacker.hp + Math.round(Number(attacker.maxHp ?? 0) * healPct));
      if (skill.runtimeShapeVersion === 3 && (skill.armorBuff || 0) > 0) {
        attacker.def = (Number(attacker.def ?? 0)) + Math.round(Number(skill.armorBuff));
      }
      showText(scene, attacker, `+${increase} HP`, "#00ff88");
      updateUnit(scene, attacker);
      return true;
    }
    case "self_def_fortify": {
      const turns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.turns || 2) || 2))
        : getStarTurns(star, skill.turns || 2);
      const defBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(skill.armorBuff || 30))
        : Math.max(1, Math.round((skill.armorBuff || 30) * starScale));
      const mdefBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(skill.mdefBuff || 30))
        : Math.max(1, Math.round((skill.mdefBuff || 30) * starScale));
      attacker.statuses.defBuffTurns = Math.max(Number(attacker.statuses.defBuffTurns ?? 0), turns);
      attacker.statuses.defBuffValue = Math.max(Number(attacker.statuses.defBuffValue ?? 0), defBuff);
      attacker.statuses.mdefBuffTurns = Math.max(Number(attacker.statuses.mdefBuffTurns ?? 0), turns);
      attacker.statuses.mdefBuffValue = Math.max(Number(attacker.statuses.mdefBuffValue ?? 0), mdefBuff);
      attacker.statuses.fortifyReducePct = Math.max(
        Number(attacker.statuses.fortifyReducePct ?? 0) || 0,
        skill.runtimeShapeVersion === 3 ? (skill.damageReductionPct || 0.5) : 0.5
      );
      attacker.statuses.fortifyReduceTurns = Math.max(Number(attacker.statuses.fortifyReduceTurns ?? 0) || 0, 1);
      if ((skill.shareBehindDamageReductionPct || 0) > 0) {
        allies
          .filter((ally) => ally.alive && ally.uid !== attacker.uid && ally.row === attacker.row)
          .sort((a, b) => Math.abs(attacker.col - a.col) - Math.abs(attacker.col - b.col))
          .slice(0, 1)
          .forEach((ally) => {
            ally.statuses.damageReductionTurns = Math.max(Number(ally.statuses.damageReductionTurns ?? 0) || 0, 1);
            ally.statuses.damageReductionPct = Math.max(Number(ally.statuses.damageReductionPct ?? 0) || 0, Number(skill.shareBehindDamageReductionPct || 0));
            updateUnit(scene, ally);
          });
      }
      if ((skill.tauntTurns || 0) > 0) {
        (scene.getCombatUnits(attacker.side === "LEFT" ? "RIGHT" : "LEFT") as SupportSkillUnit[]).forEach((enemy) => {
          enemy.statuses.tauntTargetId = attacker.uid;
          enemy.statuses.tauntTurns = Math.max(Number(enemy.statuses.tauntTurns ?? 0) || 0, Number(skill.tauntTurns || 0));
          updateUnit(scene, enemy);
        });
      }
      showText(scene, attacker, "CUỘN TRÒN", "#ffd97b");
      updateUnit(scene, attacker);
      return true;
    }
    case "resilient_shield": {
      const shieldAmt = skill.runtimeShapeVersion === 3
        ? calcScaledValue(scene, attacker, skill.shieldBase || 80, skill.shieldScale || 0.5, skill.shieldScaleStat || "def")
        : Math.round(((skill.shieldBase || 80) + scene.getEffectiveDef(attacker) * (skill.shieldScale || 0.50)) * starScale);
      if (skill.runtimeShapeVersion === 3 && ((skill.damageBase || 0) > 0 || (skill.damageScale || 0) > 0)) {
        const enemyPool = Array.isArray(enemies)
          ? enemies
          : (scene.getCombatUnits?.(attacker?.side === "LEFT" ? "RIGHT" : "LEFT") ?? []) as unknown as SupportSkillUnit[];
        const strikeTarget = (collectUnitsBySelector(
          enemyPool,
          skill.damageTargetSelector || skill.targetSelector || "front",
          1,
          buildSkillSelectionOptions(scene as unknown as BuildSkillSelectionScene, attacker, null, skill)
        ) as unknown as SupportSkillUnit[])[0];
        if (strikeTarget) {
          const damageAmount = calcScaledValue(
            scene,
            attacker,
            skill.damageBase || 0,
            skill.damageScale || 0,
            skill.damageScaleStat || "def"
          );
          scene.resolveDamage?.(
            attacker,
            strikeTarget,
            Math.max(1, damageAmount),
            skill.damageType || "physical",
            skill.nameVi || skill.name || "Mai thần",
            { isSkill: true }
          );
          updateUnit(scene, strikeTarget);
        }
      }
      scene.addShield(attacker, shieldAmt);
      const shieldTurns = Math.max(1, Math.round(Number(skill.turns || 2) || 2));
      attacker.statuses.resilientShieldTurns = shieldTurns;
      attacker.statuses.resilientShieldHealPct = skill.runtimeShapeVersion === 3 ? (skill.healPctMaxHp || 0) : 0.20;
      attacker.statuses.resilientShieldHotPct = skill.runtimeShapeVersion === 3 ? (skill.hotPctMaxHp || 0) : 0;
      attacker.statuses.resilientShieldHotTurns = skill.runtimeShapeVersion === 3 ? (skill.hotTurns || 0) : 0;
      if (skill.runtimeShapeVersion === 3 && (skill.tauntTurns || 0) > 0) {
        const tauntTargets = (Array.isArray(enemies)
          ? enemies
          : (scene.getCombatUnits?.(attacker?.side === "LEFT" ? "RIGHT" : "LEFT") ?? []) as unknown as SupportSkillUnit[])
          .filter((enemy) => enemy?.alive);
        tauntTargets.forEach((enemy) => {
          enemy.statuses.tauntTargetId = attacker.uid;
          enemy.statuses.tauntTurns = Math.max(Number(enemy.statuses.tauntTurns ?? 0) || 0, Math.max(1, Math.round(Number(skill.tauntTurns || 0))));
          updateUnit(scene, enemy);
        });
      }
      if (skill.runtimeShapeVersion === 3 && (skill.shieldSharePctToNearest || 0) > 0) {
        const shareTarget = findNearestAliveAlly(attacker, allies);
        if (shareTarget) {
          const shareAmount = Math.max(1, Math.round(shieldAmt * Number(skill.shieldSharePctToNearest || 0)));
          scene.addShield(shareTarget, shareAmount);
          shareTarget.statuses.pangolinShieldTurns = Math.max(
            Number(shareTarget.statuses.pangolinShieldTurns ?? 0) || 0,
            Math.max(1, Math.round(Number(skill.shareShieldTurns || shieldTurns) || shieldTurns))
          );
          shareTarget.statuses.pangolinShieldExpireDamageReductionPct = Math.max(
            Number(shareTarget.statuses.pangolinShieldExpireDamageReductionPct ?? 0) || 0,
            Math.max(0, Number(skill.shareShieldExpireDamageReductionPct || 0) || 0)
          );
          shareTarget.statuses.pangolinShieldExpireDamageReductionTurns = Math.max(
            Number(shareTarget.statuses.pangolinShieldExpireDamageReductionTurns ?? 0) || 0,
            Math.max(0, Math.round(Number(skill.shareShieldExpireDamageReductionTurns || 0) || 0))
          );
          shareTarget.statuses.pangolinShieldExpireCleanseCount = Math.max(
            Number(shareTarget.statuses.pangolinShieldExpireCleanseCount ?? 0) || 0,
            Math.max(0, Math.round(Number(skill.shareShieldExpireCleanseCount || 0) || 0))
          );
          if ((skill.shareTargetRageGain || 0) > 0) {
            shareTarget.rage = Math.min(
              shareTarget.rageMax || 5,
              (shareTarget.rage ?? 0) + Math.max(1, Math.round(Number(skill.shareTargetRageGain || 0) || 0))
            );
          }
          showText(scene, shareTarget, `+${shareAmount} KHIÊN`, "#9dffba");
          updateUnit(scene, shareTarget);
        }
      }
      showText(scene, attacker, "MAI THẦN", "#9dffba");
      updateUnit(scene, attacker);
      return true;
    }
    case "frost_aura_buff": {
      const turns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.turns || 3) || 3))
        : getStarTurns(star, skill.turns || 3);
      const defBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.armorBuff || 20) || 20))
        : Math.max(1, Math.round((skill.armorBuff || 20) * starScale));
      const mdefBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.mdefBuff || 15) || 15))
        : Math.max(1, Math.round((skill.mdefBuff || 15) * starScale));
      const maxTargets = skill.runtimeShapeVersion === 3
        ? getResolvedTargetCount(skill, skill.maxTargets || 2)
        : ((skill.maxTargets || 2) + targetBonus);
      const nearby = skill.runtimeShapeVersion === 3 && skill.allySelector
        ? selectSupportTargets(scene, attacker, null, skill, allies, maxTargets, skill.allySelector)
        : allies
            .filter((ally) => ally.alive && ally.uid !== attacker.uid)
            .sort((a, b) => manhattan(attacker as unknown as GridPosition, a as unknown as GridPosition) - manhattan(attacker as unknown as GridPosition, b as unknown as GridPosition))
            .slice(0, maxTargets);
      nearby.forEach((ally) => {
        ally.statuses.defBuffTurns = Math.max(Number(ally.statuses.defBuffTurns ?? 0), turns);
        ally.statuses.defBuffValue = Math.max(Number(ally.statuses.defBuffValue ?? 0), defBuff);
        ally.statuses.mdefBuffTurns = Math.max(Number(ally.statuses.mdefBuffTurns ?? 0), turns);
        ally.statuses.mdefBuffValue = Math.max(Number(ally.statuses.mdefBuffValue ?? 0), mdefBuff);
        if (skill.runtimeShapeVersion === 3 && (Number(skill.cleanseCount || 0)) > 0) {
          cleanseUnit(ally, Number(skill.cleanseCount || 0));
        }
        if (skill.runtimeShapeVersion === 3 && (skill.evadeBuff || 0) > 0) {
          ally.statuses.evadeBuffTurns = Math.max(
            Number(ally.statuses.evadeBuffTurns ?? 0) || 0,
            Math.max(1, Math.round(Number(skill.evadeBuffTurns || turns) || turns))
          );
          ally.statuses.evadeBuffValue = Math.max(Number(ally.statuses.evadeBuffValue ?? 0) || 0, Number(skill.evadeBuff || 0) || 0);
        }
        if (
          skill.runtimeShapeVersion === 3
          && (skill.rageGainBelowHpPct || 0) > 0
          && ((Number(ally.hp ?? 0)) / Math.max(1, Number(ally.maxHp ?? 0))) <= Number(skill.rageGainBelowHpPct || 0)
          && (skill.rageGain || 0) > 0
        ) {
          ally.rage = Math.min(ally.rageMax || 5, (ally.rage ?? 0) + Math.max(1, Math.round(Number(skill.rageGain || 0) || 0)));
        }
        showText(scene, ally, "BĂNG HỘ", "#83e5ff");
        updateUnit(scene, ally);
      });
      if (skill.runtimeShapeVersion !== 3 || skill.includeSelfBuff) {
        attacker.statuses.defBuffTurns = Math.max(Number(attacker.statuses.defBuffTurns ?? 0), turns);
        attacker.statuses.defBuffValue = Math.max(Number(attacker.statuses.defBuffValue ?? 0), defBuff);
        showText(scene, attacker, "HÀO QUANG BĂNG", "#83e5ff");
        updateUnit(scene, attacker);
      }
      return true;
    }
    case "team_rage_self_heal": {
      const rageGain = skill.rageGain || 3;
      allies.forEach((ally) => {
        if (ally.uid === attacker.uid) return;
        ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + rageGain);
        showText(scene, ally, `+${rageGain} NỘ`, "#b8f5ff");
        updateUnit(scene, ally);
      });
      const selfHealPctMaxHp = Number.isFinite(Number(skill.selfHealPctMaxHp))
        ? Number(skill.selfHealPctMaxHp)
        : (0.15 * starScale);
      const selfHeal = Math.round(Number(attacker.maxHp ?? 0) * selfHealPctMaxHp);
      scene.healUnit(attacker, attacker, selfHeal, "BẦY ĐÀN");
      if ((Number(skill.allyHealPctMaxHp || 0)) > 0) {
        allies
          .filter((ally) => ally.alive && ally.uid !== attacker.uid)
          .forEach((ally) => {
            const allyHeal = Math.round(ally.maxHp * (skill.allyHealPctMaxHp || 0));
            if (allyHeal > 0) scene.healUnit(attacker, ally, allyHeal, "BẦY ĐÀN");
          });
      }
      return true;
    }
    case "warcry_atk_def": {
      const atkBuffTurns = Math.max(1, Math.round(skill.atkBuffTurns || 2));
      const atkBuffPct = Number(skill.atkBuffPct || 0);
      const atkBuffFlat = Number(skill.atkBuffValue || 0);
      const defBuff = Number.isFinite(Number(skill.defBuffValue))
        ? Math.max(1, Math.round(Number(skill.defBuffValue)))
        : Math.max(1, Math.round((skill.armorBuff || 25) * starScale));
      const defBuffTurns = Math.max(1, Math.round(skill.defBuffTurns || skill.turns || 3));
      allies.forEach((ally) => {
        const atkBuff = atkBuffPct > 0
          ? Math.max(1, Math.round(scene.getEffectiveAtk(ally) * atkBuffPct))
          : Math.max(1, Math.round(Number(atkBuffFlat || 20 * starScale)));
        ally.statuses.atkBuffTurns = Math.max(Number(ally.statuses.atkBuffTurns ?? 0), atkBuffTurns);
        ally.statuses.atkBuffValue = Math.max(Number(ally.statuses.atkBuffValue ?? 0), atkBuff);
        if ((skill.rageGain || 0) > 0) {
          ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + Number(skill.rageGain || 0));
        }
        showText(scene, ally, "+SỨC MẠNH", "#ffa944");
        updateUnit(scene, ally);
      });
      attacker.statuses.defBuffTurns = Math.max(Number(attacker.statuses.defBuffTurns ?? 0), defBuffTurns);
      attacker.statuses.defBuffValue = Math.max(Number(attacker.statuses.defBuffValue ?? 0), defBuff);
      showText(scene, attacker, "THÉT CHIẾN", "#ff4444");
      updateUnit(scene, attacker);
      return true;
    }
    case "team_evade_buff": {
      const evadeBuff = skill.runtimeShapeVersion === 3
        ? Math.max(0, Number(skill.evadeBuff || 0) || 0)
        : (skill.evadeBuff || (0.20 * starScale));
      const targets = Number.isFinite(Number(skill.maxTargets))
        ? selectSupportTargets(scene, attacker, null, skill, allies, Number(skill.maxTargets || 0), skill.allySelector || "lowest_hp_pct_ally")
        : allies;
      const shieldBelowHpPct = Math.max(0, Number(skill.shieldBelowHpPct ?? 0) || 0);
      const shieldBelowHpValue = Math.max(0, Math.round(Number(skill.shieldBelowHpValue ?? 0) || 0));
      const cleanseBelowHpCount = Math.max(0, Math.round(Number(skill.cleanseBelowHpCount ?? 0) || 0));
      const weakestRageGain = Math.max(0, Math.round(Number(skill.evadeBuffStartRage ?? skill.evadeBuffWeakestRage ?? 0) || 0));
      const evadeBoonHeal = Math.max(0, Math.round(Number(skill.evadeBuffDodgeHeal ?? 0) || 0));
      const evadeBoonShield = Math.max(0, Math.round(Number(skill.evadeBuffDodgeShield ?? 0) || 0));
      const evadeBoonRage = Math.max(0, Math.round(Number(skill.evadeBuffDodgeRage ?? 0) || 0));
      targets.forEach((ally, index) => {
        ally.mods.evadePct = Math.max(Number(ally.mods.evadePct || 0), Number(evadeBuff || 0));
        if (index === 0 && weakestRageGain > 0) {
          ally.rage = Math.min(ally.rageMax || 5, (ally.rage ?? 0) + weakestRageGain);
          showText(scene, ally, `+${weakestRageGain} NỘ`, "#b8f5ff");
        }
        if (shieldBelowHpPct > 0 && ((Number(ally.hp ?? 0)) / Math.max(1, Number(ally.maxHp ?? 0))) <= shieldBelowHpPct) {
          if (shieldBelowHpValue > 0) {
            scene.addShield(ally, shieldBelowHpValue);
          }
          if (cleanseBelowHpCount > 0) {
            cleanseUnit(ally, cleanseBelowHpCount);
          }
        }
        if (evadeBoonHeal > 0 || evadeBoonShield > 0 || evadeBoonRage > 0) {
          ally.statuses.evadeBuffDodgeHeal = Math.max(Number(ally.statuses.evadeBuffDodgeHeal ?? 0) || 0, evadeBoonHeal);
          ally.statuses.evadeBuffDodgeShield = Math.max(Number(ally.statuses.evadeBuffDodgeShield ?? 0) || 0, evadeBoonShield);
          ally.statuses.evadeBuffDodgeRage = Math.max(Number(ally.statuses.evadeBuffDodgeRage ?? 0) || 0, evadeBoonRage);
        }
        showText(scene, ally, "SƯƠNG MÙ", "#d4bcff");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "self_regen_team_heal": {
      const selfHealPct = Number.isFinite(Number(skill.selfHealPctMaxHp))
        ? Number(skill.selfHealPctMaxHp)
        : (0.08 * starScale);
      const allyHealPct = Number.isFinite(Number(skill.allyHealPctMaxHp))
        ? Number(skill.allyHealPctMaxHp)
        : (0.05 * starScale);
      const selfHeal = Math.round(Number(attacker.maxHp ?? 0) * (selfHealPct));
      scene.healUnit(attacker, attacker, selfHeal, "TÁI SINH");
      const shouldExpand = (Number(skill.expandIfSelfHpPctAtLeast || 0)) <= 0
        || ((Number(attacker.hp ?? 0)) / Math.max(1, Number(attacker.maxHp ?? 0))) >= Number(skill.expandIfSelfHpPctAtLeast || 0);
      const targetCount = shouldExpand
        ? Math.max(1, Math.max(skill.maxTargets || 2, skill.expandedMaxTargets || skill.maxTargets || 2))
        : Math.min(2, Math.max(1, skill.maxTargets || 2));
      const weakest = collectLowestHpRatioUnits(allies, targetCount, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit[];
      weakest.forEach((ally) => {
        const heal = Math.round(Number(ally.maxHp ?? 0) * (allyHealPct));
        scene.healUnit(attacker, ally, heal, "ĐA ĐẦU");
      });
      return true;
    }
    case "team_shield": {
      const baseShield = Math.round(((skill.shieldBase || 40) + scene.getEffectiveDef(attacker) * (skill.shieldScale || 0.20)) * starScale);
      allies.forEach((ally) => {
        const amount = ally.uid === attacker.uid ? baseShield * 2 : baseShield;
        scene.addShield(ally, amount);
        showText(scene, ally, `+${amount} KHIÊN`, "#ffd97b");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "heal_over_time": {
      const targetCount = skill.runtimeShapeVersion === 3
        ? getResolvedTargetCount(skill, skill.maxTargets || 3)
        : ((skill.maxTargets || 3) + targetBonus);
      const targets = skill.runtimeShapeVersion === 3 && skill.allySelector
        ? selectSupportTargets(scene, attacker, null, skill, allies, targetCount, skill.allySelector)
        : collectLimitedLowestHpUnits(allies, targetCount);
      const orderedTargets = [...targets].sort((a, b) => (a.hp / Math.max(1, a.maxHp)) - (b.hp / Math.max(1, b.maxHp)));
      orderedTargets.forEach((ally, index) => {
        const hotAmount = skill.runtimeShapeVersion === 3
          ? Math.round(ally.maxHp * (skill.hotPctMaxHp || 0.05))
          : Math.round(ally.maxHp * 0.05 * starScale);
        ally.statuses.hotTurns = Math.max(Number(ally.statuses.hotTurns ?? 0) || 0, resolveTurnDuration(skill, star, 3));
        ally.statuses.hotAmount = Math.max(Number(ally.statuses.hotAmount ?? 0) || 0, hotAmount);
        const hpRatio = (Number(ally.hp ?? 0)) / Math.max(1, Number(ally.maxHp ?? 0));
        if (index === 0 && (skill.rageGrantToWeakest || 0) > 0 && hpRatio <= (skill.rageGrantHpBelowPct || 1)) {
          ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + Number(skill.rageGrantToWeakest || 0));
        }
        if (index === 0 && (skill.cleanseCountToWeakest || 0) > 0 && hpRatio <= (skill.cleanseWeakestHpBelowPct || 1)) {
          cleanseUnit(ally, skill.cleanseCountToWeakest);
        }
        showText(scene, ally, "HỒI DẦN", "#9dffba");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "spring_aoe_heal": {
      const healAmt = skill.runtimeShapeVersion === 3 ? Math.round(Number(rawSkill)) : Math.round(Number(rawSkill) * starScale);
      allies.filter((ally) => ally.alive).forEach((ally) => {
        scene.healUnit(attacker, ally, healAmt, "SUỐI NGUỒN");
        if (skill.runtimeShapeVersion === 3 && (Number(skill.cleanseCount || 0)) > 0) {
          cleanseUnit(ally, Number(skill.cleanseCount || 0));
        }
        if (skill.runtimeShapeVersion === 3 && ((skill.shieldBase || 0) > 0 || (skill.shieldPctMaxHp || 0) > 0)) {
          const shieldAmount = (skill.shieldPctMaxHp || 0) > 0
            ? Math.round(ally.maxHp * (skill.shieldPctMaxHp || 0))
            : Math.round(skill.shieldBase || 0);
          if (shieldAmount > 0) scene.addShield(ally, shieldAmount);
        }
      });
      return true;
    }
    case "soul_link_heal": {
      const linkCount = Math.max(1, Math.min(2, Number(skill.soulLinkTargetCount ?? (star >= 3 ? 2 : 1)) || (star >= 3 ? 2 : 1)));
      const linkedUnits = (collectLowestHpRatioUnits(
        allies.filter((ally) => ally.alive && ally.uid !== attacker.uid),
        linkCount
      ) as unknown as SupportSkillUnit[]);
      const duration = getStarTurns(star, skill.turns || 2);
      const shieldPct = Math.max(0, Number(skill.soulLinkShieldPct ?? 0.1) || 0.1);
      const cleanseCount = Math.max(0, Math.round(Number(skill.soulLinkCleanseCount ?? (star >= 3 ? 1 : 0)) || 0));
      const rageGain = Math.max(0, Math.round(Number(skill.soulLinkRageGain ?? (star >= 3 ? 1 : 0)) || 0));
      const healMultipliers = Array.isArray(skill.soulLinkHealMultipliers)
        ? skill.soulLinkHealMultipliers
        : [skill.soulLinkHealMultiplier ?? 1];

      allies.forEach((ally) => {
        if (ally.uid === attacker.uid) return;
        if (ally.statuses.soulLinkId !== attacker.uid) return;
        ally.statuses.soulLinkId = null;
        ally.statuses.soulLinkTurns = 0;
        ally.statuses.soulLinkHealMultiplier = 0;
        ally.statuses.soulLinkShieldPct = 0;
        ally.statuses.soulLinkCleanseCount = 0;
        ally.statuses.soulLinkRageGain = 0;
        updateUnit(scene, ally);
      });

      linkedUnits.forEach((ally, index) => {
        ally.statuses.soulLinkId = attacker.uid;
        ally.statuses.soulLinkTurns = duration;
        ally.statuses.soulLinkHealMultiplier = Math.max(0.1, Number(healMultipliers[index] ?? healMultipliers[0] ?? 1) || 1);
        ally.statuses.soulLinkShieldPct = shieldPct;
        ally.statuses.soulLinkCleanseCount = index === 0 ? cleanseCount : 0;
        ally.statuses.soulLinkRageGain = index === 0 ? rageGain : 0;
        showText(scene, ally, "HỘ MỆNH", "#ffff00");
        updateUnit(scene, ally);
      });
      if (linkedUnits.length) {
        showText(scene, attacker, linkedUnits.length > 1 ? "LIÊN KẾT 2 HỒN" : "LIÊN KẾT", "#ffff00");
      }
      return true;
    }
    case "light_purify": {
      const targetCount = skill.runtimeShapeVersion === 3
        ? getResolvedTargetCount(skill, skill.maxTargets || 2)
        : ((skill.maxTargets || 2) + targetBonus);
      const targets = collectLimitedLowestHpUnits(allies, targetCount);
      targets.forEach((ally) => {
        cleanseUnit(ally, skill.runtimeShapeVersion === 3 ? (skill.cleanseCount || 1) : 1);
        showText(scene, ally, "THANH TẨY", "#ffff00");
        const healAmount = skill.runtimeShapeVersion === 3
          ? (Number.isFinite(Number(skill.healBase)) || Number.isFinite(Number(skill.healScale))
              ? Math.round(Number(rawSkill))
              : Math.round((ally.maxHp ?? 0) * (skill.healPctMaxHp || 0)))
          : Math.round(20 * starScale);
        if (healAmount > 0) scene.healUnit(attacker, ally, healAmount, "ÁNH SÁNG");
        if (skill.runtimeShapeVersion === 3 && ((skill.shieldBase || 0) > 0 || (skill.shieldPctMaxHp || 0) > 0)) {
          const shieldAmount = (skill.shieldPctMaxHp || 0) > 0
            ? Math.round(ally.maxHp * (skill.shieldPctMaxHp || 0))
            : Math.round(skill.shieldBase || 0);
          if (shieldAmount > 0) scene.addShield(ally, shieldAmount);
        }
        updateUnit(scene, ally);
      });
      return true;
    }
    case "unicorn_atk_buff": {
      const strongestTargets = skill.runtimeShapeVersion === 3
        ? (collectHighestEffectiveAtkUnits(
            allies,
            getResolvedTargetCount(skill, 1),
            scene.getEffectiveAtk.bind(scene) as unknown as (unit: import('./sceneSkillTargeting.js').SkillTargetUnit) => number,
            (ally) => ally.uid !== attacker.uid
          ) as unknown as SupportSkillUnit[])
        : [findHighestEffectiveAtkUnit(allies, scene.getEffectiveAtk.bind(scene) as unknown as (unit: import('./sceneSkillTargeting.js').SkillTargetUnit) => number, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit | null].filter(Boolean);
      strongestTargets.forEach((strongest) => {
        if (!strongest) return;
        const buff = skill.runtimeShapeVersion === 3 && Number.isFinite(Number(skill.atkBuffPct))
          ? Math.round(scene.getEffectiveAtk(strongest) * Number(skill.atkBuffPct || 0))
          : Math.round(scene.getEffectiveAtk(strongest) * 0.25 * starScale);
        strongest.statuses.atkBuffTurns = Math.max(
          Number(strongest.statuses.atkBuffTurns ?? 0),
          resolveTurnDuration(skill, star, 3)
        );
        strongest.statuses.atkBuffValue = Math.max(Number(strongest.statuses.atkBuffValue ?? 0), buff);
        showText(scene, strongest, "+SỨC MẠNH", "#ffa944");
        updateUnit(scene, strongest);
      });
      return true;
    }
    case "wind_shield_ally": {
      const shieldAmt = skill.runtimeShapeVersion === 3
        ? calcScaledValue(scene, attacker, skill.shieldBase || 40, skill.shieldScale || 0.3, skill.shieldScaleStat || "matk")
        : Math.round(((skill.shieldBase || 40) + scene.getEffectiveMatk(attacker) * (skill.shieldScale || 0.3)) * starScale);
      const targets = skill.runtimeShapeVersion === 3
        ? selectSupportTargets(
            scene,
            attacker,
            null,
            skill,
            allies,
            getResolvedTargetCount(skill, skill.maxTargets || 2),
            skill.allySelector || "lowest_hp_pct_ally"
          )
        : (collectLowestHpRatioUnits(allies, (skill.maxTargets || 2) + targetBonus) as unknown as SupportSkillUnit[]);
      targets.forEach((ally, index) => {
        scene.addShield(ally, shieldAmt);
        if (skill.runtimeShapeVersion === 3 && (Number(skill.cleanseCount || 0)) > 0) {
          cleanseUnit(ally, Number(skill.cleanseCount || 0));
        }
        if (
          skill.runtimeShapeVersion === 3
          && (skill.rageGainBelowHpPct || 0) > 0
          && ((Number(ally.hp ?? 0)) / Math.max(1, Number(ally.maxHp ?? 0))) <= Number(skill.rageGainBelowHpPct || 0)
          && (skill.rageGain || 0) > 0
        ) {
          ally.rage = Math.min(ally.rageMax || 5, (ally.rage ?? 0) + Math.max(1, Math.round(Number(skill.rageGain || 0) || 0)));
        }
        if (skill.runtimeShapeVersion === 3 && (skill.evadeBuff || 0) > 0) {
          ally.statuses.evadeBuffTurns = Math.max(
            Number(ally.statuses.evadeBuffTurns ?? 0) || 0,
            resolveTurnDuration(skill, star, 2, skill.evadeBuffTurns || skill.turns || 2)
          );
          ally.statuses.evadeBuffValue = Math.max(
            Number(ally.statuses.evadeBuffValue ?? 0) || 0,
            Number(skill.evadeBuff || 0)
          );
        }
        if (skill.runtimeShapeVersion === 3 && index === 0 && (skill.bonusHealToPrimary || 0) > 0) {
          scene.healUnit(attacker, ally, Math.max(1, Math.round(Number(skill.bonusHealToPrimary || 0) || 0)), "BĂNG HỘ");
        }
        showText(scene, ally, `+${shieldAmt} KHIÊN`, "#ffd97b");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "bless_rain_mdef": {
      const mdefBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(skill.mdefBuff || 20))
        : Math.max(1, Math.round(20 * starScale));
      allies.forEach((ally) => {
        ally.statuses.mdefBuffTurns = Math.max(Number(ally.statuses.mdefBuffTurns ?? 0), getStarTurns(star, skill.turns || 2));
        ally.statuses.mdefBuffValue = Math.max(Number(ally.statuses.mdefBuffValue ?? 0), mdefBuff);
        if (skill.runtimeShapeVersion === 3 && (skill.magicDamageReductionPct || 0) > 0) {
          ally.statuses.magicDamageReductionTurns = Math.max(Number(ally.statuses.magicDamageReductionTurns ?? 0) || 0, getStarTurns(star, skill.magicDamageReductionTurns || skill.turns || 2));
          ally.statuses.magicDamageReductionPct = Math.max(Number(ally.statuses.magicDamageReductionPct ?? 0) || 0, skill.magicDamageReductionPct ?? 0);
        }
        updateUnit(scene, ally);
      });
      if ((skill.bonusShieldBase || 0) > 0) {
        const priorityTarget = selectSupportTargets(scene, attacker, null, skill, allies, 1, skill.bonusShieldSelector || "lowest_hp_pct")[0];
        if (priorityTarget) {
          scene.addShield(priorityTarget, skill.bonusShieldBase ?? 0);
          if ((skill.cleanseCount || 0) > 0) cleanseUnit(priorityTarget, skill.cleanseCount);
          updateUnit(scene, priorityTarget);
        }
      }
      showText(scene, attacker, "PHƯỚC LÀNH", "#9dffba");
      return true;
    }
    case "mirror_reflect": {
      const shieldAmount = skill.runtimeShapeVersion === 3
        ? calcScaledValue(scene, attacker, skill.shieldBase || 50, skill.shieldScale || 0.3, skill.shieldScaleStat || "def")
        : Math.round(((skill.shieldBase || 50) + scene.getEffectiveDef(attacker) * 0.3) * starScale);
      scene.addShield(attacker, shieldAmount);
      if (skill.runtimeShapeVersion === 3 && ((skill.shieldSharePct || 0) > 0 || (skill.shieldSharePctToNearest || 0) > 0)) {
        const shareTargets = (skill.shieldSharePctToNearest || 0) > 0
          ? allies
              .filter((ally) => ally.alive && ally.uid !== attacker.uid)
              .sort((a, b) => manhattan(attacker as unknown as GridPosition, a as unknown as GridPosition) - manhattan(attacker as unknown as GridPosition, b as unknown as GridPosition))
              .slice(0, 1)
          : skill.shareSelector === "lowest_hp_pct"
            ? selectSupportTargets(scene, attacker, null, skill, allies, skill.shareTargetCount || 1, "lowest_hp_pct")
            : (collectUnitsInSameRow(allies, attacker.row ?? 0, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit[]).slice(0, skill.shareTargetCount || Number.POSITIVE_INFINITY);
        shareTargets.forEach((ally) => {
          const pct = skill.shieldSharePctToNearest || skill.shieldSharePct;
          const resolvedShareAmount = Math.max(1, Math.round(shieldAmount * (pct ?? 0)));
          scene.addShield(ally, resolvedShareAmount);
          updateUnit(scene, ally);
        });
      }
      attacker.statuses.reflectTurns = Math.max(
        Number(attacker.statuses.reflectTurns ?? 0) || 0,
        skill.runtimeShapeVersion === 3
          ? Math.max(1, Math.round(skill.reflectTurns || 2))
          : getStarTurns(star, skill.reflectTurns || 2)
      );
      attacker.statuses.reflectPct = Math.max(Number(attacker.statuses.reflectPct ?? 0), skill.reflectPct || 0.25);
      showText(scene, attacker, "VẢY GƯƠNG", "#83e5ff");
      updateUnit(scene, attacker);
      return true;
    }
    case "mass_cleanse": {
      const massTargetCount = skill.runtimeShapeVersion === 3
        ? getResolvedTargetCount(skill, skill.maxTargets || 1)
        : (skill.maxTargets || (1 + targetBonus));
      const worstList = skill.allySelector
        ? selectSupportTargets(scene, attacker, null, skill, allies, massTargetCount, skill.allySelector)
        : (collectLowestHpRatioUnits(
            allies,
            massTargetCount,
            (ally) => skill?.includeSelf ? true : ally.uid !== attacker?.uid
          ) as unknown as SupportSkillUnit[]);
      worstList.forEach((worst) => {
        cleanseUnit(
          worst,
          skill.runtimeShapeVersion === 3
            ? (skill.cleanseCount || Number.POSITIVE_INFINITY)
            : Number.POSITIVE_INFINITY
        );
        worst.statuses.bleedTurns = 0;
        worst.statuses.diseaseTurns = 0;
        const heal = skill.runtimeShapeVersion === 3
          ? Math.round(worst.maxHp * (skill.healPctMaxHp || 0.15))
          : Math.round(Number(worst.maxHp ?? 0) * 0.15 * starScale);
        scene.healUnit(attacker, worst, heal, "THANH TẨY");
        if (worst.uid === worstList[0]?.uid && (skill.primaryTargetDamageReductionPct || 0) > 0) {
          worst.statuses.damageReductionTurns = Math.max(Number(worst.statuses.damageReductionTurns ?? 0) || 0, skill.turns || 1);
          worst.statuses.damageReductionPct = Math.max(Number(worst.statuses.damageReductionPct ?? 0) || 0, skill.primaryTargetDamageReductionPct ?? 0);
        }
        updateUnit(scene, worst);
      });
      return true;
    }
    case "scout_buff_ally": {
      const atkBase = star >= 3 ? 20 : star === 2 ? 15 : 10;
      const rageGain = star >= 3 ? 3 : star === 2 ? 2 : 1;
      const rowAlly = (collectUnitsInSameRow(allies, attacker.row ?? 0, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit[])[0];
      if (rowAlly) {
        rowAlly.statuses.atkBuffTurns = Math.max(Number(rowAlly.statuses.atkBuffTurns ?? 0), 3);
        rowAlly.statuses.atkBuffValue = Math.max(Number(rowAlly.statuses.atkBuffValue ?? 0), atkBase);
        rowAlly.rage = Math.min(Number(rowAlly.rageMax ?? 0), rowAlly.rage + rageGain);
        showText(scene, rowAlly, `DẪN ĐƯỜNG +${atkBase}ATK +${rageGain}NỘ`, "#ffa944");
        updateUnit(scene, rowAlly);
      }
      return true;
    }
    case "pack_howl_rage": {
      const rageGain = skill.rageGain || 2;
      const targets = skill.allySelector
        ? selectSupportTargets(scene, attacker, null, skill, allies, skill.maxTargets || 2, skill.allySelector)
        : (collectUnitsInSameRow(allies, attacker.row ?? 0, (ally) => ally.uid !== attacker.uid) as unknown as SupportSkillUnit[]);
      targets.forEach((ally) => {
        ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + rageGain);
        showText(scene, ally, `+${rageGain} NỘ`, "#b8f5ff");
        updateUnit(scene, ally);
      });
      return true;
    }
    case "row_carry_rage_buff": {
      const targets = selectSupportTargets(
        scene,
        attacker,
        null,
        skill,
        allies,
        getResolvedTargetCount(skill, skill.maxTargets || 2),
        skill.allySelector || "same_row_carry"
      );

      if (!targets.length) {
        const selfRageGain = Math.max(1, Math.round(skill.selfFallbackRageGain || 1));
        attacker.rage = Math.min(attacker.rageMax ?? 5, (attacker.rage ?? 0) + selfRageGain);
        showText(scene, attacker, `TỰ LẤY NHỊP +${selfRageGain} NỘ`, "#ff9bf2");
        updateUnit(scene, attacker);
        return true;
      }

      targets.forEach((ally, index) => {
        const isPrimaryCarry = index === 0;
        const rageGain = Math.max(
          1,
          Math.round(
            isPrimaryCarry && Number.isFinite(Number(skill.primaryCarryRageGain))
              ? skill.primaryCarryRageGain ?? 0
              : (skill.allyRageGain || 1)
          )
        );
        const buffPct = isPrimaryCarry && Number.isFinite(Number(skill.primaryCarryBuffPct))
          ? Number(skill.primaryCarryBuffPct)
          : Number(skill.allyBuffPct || 0);
        const buffTurns = Math.max(
          1,
          Math.round(
            isPrimaryCarry && Number.isFinite(Number(skill.primaryCarryBuffTurns))
              ? skill.primaryCarryBuffTurns ?? 0
              : (skill.allyBuffTurns || skill.turns || 1)
          )
        );
        const effectiveAtk = scene.getEffectiveAtk(ally);
        const effectiveMatk = scene.getEffectiveMatk(ally);
        const prefersMatk = effectiveMatk > effectiveAtk;
        const buffValue = buffPct > 0
          ? Math.max(1, Math.round((prefersMatk ? effectiveMatk : effectiveAtk) * buffPct))
          : 0;

        ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + rageGain);
        if (buffValue > 0) {
          if (prefersMatk) {
            ally.statuses.matkBuffTurns = Math.max(Number(ally.statuses.matkBuffTurns ?? 0) || 0, buffTurns);
            ally.statuses.matkBuffValue = Math.max(Number(ally.statuses.matkBuffValue ?? 0) || 0, buffValue);
          } else {
            ally.statuses.atkBuffTurns = Math.max(Number(ally.statuses.atkBuffTurns ?? 0) || 0, buffTurns);
            ally.statuses.atkBuffValue = Math.max(Number(ally.statuses.atkBuffValue ?? 0) || 0, buffValue);
          }
        }
        showText(scene, ally, `+${rageGain} NỘ${buffValue > 0 ? " +NHỊP" : ""}`, "#ff9bf2");
        updateUnit(scene, ally);
      });

      showText(scene, attacker, "BƠM NHỊP", "#ff9bf2");
      updateUnit(scene, attacker);
      return true;
    }
    case "row_random_rage_buff": {
      const randomFn: () => number = typeof scene?.random === "function" ? scene.random.bind(scene) : Math.random;
      const rollChance: (chance: number) => boolean = typeof scene?.rollChance === "function" ? scene.rollChance.bind(scene) : (chance) => randomFn() < chance;
      const sameRowAllies = allies.filter((ally) => ally.alive && ally.uid !== attacker.uid && ally.row === attacker.row);
      const forwardAllies = sameRowAllies.filter((ally) => (
        attacker.side === "LEFT" ? ally.col > attacker.col : ally.col < attacker.col
      ));
      const maxTargets = Math.max(1, getResolvedTargetCount(skill, 2));
      const preferredPool = star === 1 ? forwardAllies : sameRowAllies;
      let targets = sampleWithoutReplacement(preferredPool, Math.min(maxTargets, preferredPool.length), randomFn);
      if (star !== 1 && targets.length < maxTargets && preferredPool.length < sameRowAllies.length) {
        const usedIds = new Set(targets.map((ally) => ally.uid));
        const overflowPool = sameRowAllies.filter((ally) => !usedIds.has(ally.uid));
        targets = [
          ...targets,
          ...sampleWithoutReplacement(overflowPool, Math.min(maxTargets - targets.length, overflowPool.length), randomFn)
        ];
      }

      if (!targets.length) {
        showText(scene, attacker, star === 1 ? "KHÔNG CÓ AI PHÍA TRƯỚC" : "KHÔNG CÓ AI CÙNG HÀNG", "#ff9bf2");
        updateUnit(scene, attacker);
        return true;
      }

      const baseAtkBuffPct = Number(skill.allyBuffPct || 0);
      const baseTurns = Math.max(1, Math.round(skill.allyBuffTurns || skill.turns || 1));
      const baseRageGain = Math.max(1, Math.round(skill.allyRageGain || 1));
      targets.forEach((ally) => {
        ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + baseRageGain);
        const atkBuffValue = Math.max(1, Math.round(scene.getEffectiveAtk(ally) * baseAtkBuffPct));
        ally.statuses.atkBuffTurns = Math.max(Number(ally.statuses.atkBuffTurns ?? 0) || 0, baseTurns);
        ally.statuses.atkBuffValue = Math.max(Number(ally.statuses.atkBuffValue ?? 0) || 0, atkBuffValue);
        showText(scene, ally, `+${baseRageGain} NỘ`, "#ff9bf2");
        updateUnit(scene, ally);
      });

      if (star >= 3 && targets.length > 0 && rollChance(skill.bonusTargetProcChance || 0.3)) {
        const bonusTarget = targets[Math.floor(randomFn() * targets.length)] ?? targets[0];
        const bonusRageGain = Math.max(1, Math.round(skill.bonusTargetRageGain || 1));
        const bonusTurns = Math.max(1, Math.round(skill.bonusTargetBuffTurns || 2));
        const bonusAtkBuffValue = Math.max(1, Math.round(scene.getEffectiveAtk(bonusTarget) * Number(skill.bonusTargetBuffPct || 0.2)));
        bonusTarget.rage = Math.min(bonusTarget.rageMax ?? 5, (bonusTarget.rage ?? 0) + bonusRageGain);
        bonusTarget.statuses.atkBuffTurns = Math.max(Number(bonusTarget.statuses.atkBuffTurns ?? 0) || 0, bonusTurns);
        bonusTarget.statuses.atkBuffValue = Math.max(Number(bonusTarget.statuses.atkBuffValue ?? 0) || 0, bonusAtkBuffValue);
        showText(scene, bonusTarget, `+${bonusRageGain} NỘ`, "#ffc8ff");
        updateUnit(scene, bonusTarget);
      }

      showText(scene, attacker, "BƠM NHỊP", "#ff9bf2");
      updateUnit(scene, attacker);
      return true;
    }
    case "peace_heal_reduce_dmg":
    case "peace_heal_reduce": {
      const targets = skill.runtimeShapeVersion === 3
        ? collectLimitedLowestHpUnits(allies, getResolvedTargetCount(skill, 1))
        : [findLowestHpRatioUnit(allies) as unknown as SupportSkillUnit | null].filter(Boolean) as SupportSkillUnit[];
      targets.forEach((ally) => {
        const healAmount = skill.runtimeShapeVersion === 3 ? Math.round(Number(rawSkill)) : Math.round(Number(rawSkill) * starScale);
        scene.healUnit(attacker, ally, healAmount, "BÌNH AN");
        if (skill.runtimeShapeVersion === 3 && (skill.damageReductionPct || 0) > 0) {
          ally.statuses.damageReductionTurns = Math.max(
            Number(ally.statuses.damageReductionTurns ?? 0) || 0,
            Math.max(1, Math.round(skill.turns || 1))
          );
          ally.statuses.damageReductionPct = Math.max(Number(ally.statuses.damageReductionPct ?? 0) || 0, skill.damageReductionPct ?? 0);
        } else {
          ally.statuses.defBuffTurns = Math.max(Number(ally.statuses.defBuffTurns ?? 0), 1);
          ally.statuses.defBuffValue = Math.max(Number(ally.statuses.defBuffValue ?? 0), Math.round(20 * starScale));
        }
        if (skill.runtimeShapeVersion === 3 && (skill.cleanseCount || 0) > 0) {
          const cleansed = cleanseUnit(ally, skill.cleanseCount);
          if (cleansed > 0) showText(scene, ally, "THANH TẨY", "#d9ffd6");
        }
        if (skill.runtimeShapeVersion === 3 && (skill.shieldBase || 0) > 0) {
          scene.addShield?.(ally, Math.max(1, Math.round(Number(skill.shieldBase || 0) || 0)));
        }
        updateUnit(scene, ally);
      });
      return true;
    }
    case "mimic_rage_buff": {
      const rageGain = skill.rageGain || 3;
      allies
        .filter((ally) => ally.alive && ally.uid !== attacker.uid)
        .sort((a, b) => a.rage - b.rage)
        .slice(0, 1 + targetBonus)
        .forEach((ally) => {
          ally.rage = Math.min(ally.rageMax ?? 5, (ally.rage ?? 0) + rageGain);
          showText(scene, ally, `+${rageGain} NỘ`, "#b8f5ff");
          updateUnit(scene, ally);
        });
      return true;
    }
    default:
      return false;
  }
}
