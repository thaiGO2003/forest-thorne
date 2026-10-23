import {
  buildSkillSelectionOptions,
  collectLowestHpRatioUnits,
  collectUnitsBySelector,
  findLowestHpRatioUnit,
  selectRowGuardUnits,
  type BuildSkillSelectionScene,
  type SkillTargetUnit,
  type SkillTargetingSkill
} from "./sceneSkillTargeting.js";
import { manhattan } from "../../core/gameUtils.js";
import { showCommonSkillText, syncCommonSkillLabels, updateCommonSkillUnit } from "./sceneCommonSkillEffectUtils.js";

interface DefenseUnit {
  uid?: string | number;
  alive?: boolean;
  side?: "LEFT" | "RIGHT";
  row: number;
  col: number;
  classType?: string;
  range?: number;
  homeCol?: number;
  hp?: number;
  maxHp?: number;
  shield?: number;
  rage?: number;
  rageMax?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  sprite?: { active?: boolean; x: number; y: number; setFillStyle?: (color: number, alpha?: number) => void; setStrokeStyle?: (width?: number, color?: number, alpha?: number) => void; };
  tag?: { setColor?: (color: string) => void; setText?: (text: string) => void };
  icon?: { setText?: (text: string) => void };
  name?: string;
  tribe?: string;
  mods?: { basicAttackType?: string; basicAttackScaleStat?: string; [key: string]: unknown };
  statuses: {
    stun?: number; freeze?: number; sleep?: number; silence?: number;
    poisonTurns?: number; poisonDamage?: number; bleedTurns?: number; bleedDamage?: number;
    burnTurns?: number; burnDamage?: number; diseaseTurns?: number; diseaseDamage?: number;
    healBlockTurns?: number; healReductionTurns?: number; healReductionPct?: number;
    tauntTurns?: number; tauntTargetId?: string; armorBreakTurns?: number; armorBreakValue?: number;
    atkBuffTurns?: number; atkBuffValue?: number; defBuffTurns?: number; defBuffValue?: number;
    mdefBuffTurns?: number; mdefBuffValue?: number; evadeBuffTurns?: number; evadeBuffValue?: number;
    reflectTurns?: number; reflectPct?: number; physReflectTurns?: number; physReflectPct?: number;
    immuneTurns?: number; berserkTurns?: number; berserkLifestealPct?: number;
    berserkNextBasicMultiplier?: number; berserkKillRageGain?: number; berserkKillExtendTurns?: number;
    berserkKillChainBasic?: number; guardianId?: string; guardianTurns?: number; guardianAbsorb?: number;
    guardianRedirectCharges?: number; damageReductionTurns?: number; damageReductionPct?: number;
    counterTurns?: number; isProtecting?: number; pangolinShieldTurns?: number;
    pangolinShieldExpireHealPct?: number; pangolinShieldExpireDamageReductionPct?: number;
    pangolinShieldExpireDamageReductionTurns?: number;
    [key: string]: number | string | undefined;
  };
  [key: string]: unknown;
}

interface DefenseSceneLike extends BuildSkillSelectionScene {
  getStarSkillMultiplier: (star: number) => number;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi: (unit: unknown) => void;
  syncCombatLabels?: (unit: unknown) => void;
  player?: { gold?: number };
  rollChance?: (chance: number) => boolean;
  resolveDamage: (attacker: DefenseUnit, target: DefenseUnit, amount: number, damageType: string, label: string, opts?: unknown) => number;
  healUnit: (healer: DefenseUnit, target: DefenseUnit, amount: number, label: string) => void;
  addShield: (unit: DefenseUnit, amount: number) => void;
  combatUnits?: DefenseUnit[];
  getRoleTheme?: (classType: string | undefined) => { fill?: number; stroke?: number } | null | undefined;
  vfx?: { pulseAt?: (x: number, y: number, color: number, count: number, duration: number) => void };
  audioFx?: { play?: (name: string) => void };
  [key: string]: unknown;
}

interface DefenseSkill extends SkillTargetingSkill {
  effect: string;
  name?: string;
  damageType?: string;
  turns?: number;
  maxTargets?: number;
  allySelector?: string;
  reviveCount?: number;
  reviveChance?: number;
  healAllies?: boolean;
  healTargetCount?: number;
  shieldBase?: number;
  shieldScale?: number;
  shieldScaleStat?: string;
  atkBuff?: number;
  atkBuffValue?: number;
  atkBuffPct?: number;
  mdefBuff?: number;
  armorBuff?: number;
  evadeBuff?: number;
  reflectPct?: number;
  reflectTurns?: number;
  physReflectPct?: number;
  tauntTurns?: number;
  bonusShieldBase?: number;
  healAmount?: number;
  healPctMaxHp?: number;
  cleanseCount?: number;
  shieldSharePctToNearest?: number;
  star?: number;
  runtimeShapeVersion?: number;
  selfMatkBuffPct?: number;
  selfMatkBuffTurns?: number;
  teamEvadeBuffPct?: number;
  teamEvadeBuffTurns?: number;
  counterTurns?: number;
  lifestealPct?: number;
  firstBasicAttackMultiplier?: number;
  rageGainOnKill?: number;
  berserkExtendOnKillTurns?: number;
  chainBasicOnKill?: number;
  transformNameVi?: string;
  transformTribe?: string;
  basicAttackScaleStat?: string;
  buffStats?: { matk?: number };
  primaryTargetDamageReductionPct?: number;
  rowGuardIncludeSelf?: boolean;
  rowGuardMaxAllies?: number;
  rowGuardShieldBase?: number;
  rowShieldMinUnits?: number;
  rowGuardGuardianAbsorbPct?: number;
  rowGuardGuardianTurns?: number;
  rowGuardGuardianRedirectCharges?: number;
  rowGuardCounterOffenseDebuffTurns?: number;
  rowGuardCounterOffenseDebuffValue?: number;
  rowGuardCounterOffenseDebuffMode?: string;
  rageGain?: number;
  adjacentColumnAtkBuff?: number;
  adjacentColumnEvadeBuff?: number;
  adjacentColumnTurns?: number;
  expireHealPct?: number;
  expireDamageReductionPct?: number;
  expireDamageReductionTurns?: number;
  [key: string]: unknown;
}

interface DefenseSkillContext {
  attacker: DefenseUnit;
  target: DefenseUnit;
  skill: DefenseSkill;
  rawSkill: number;
  skillOpts?: unknown;
  enemies: DefenseUnit[];
  allies: DefenseUnit[];
  star: number;
  starScale: number;
  goldMultiplier: number;
}


function selectDefenseTargets(scene: DefenseSceneLike, attacker: DefenseUnit | null | undefined, target: DefenseUnit | null | undefined, skill: DefenseSkill | null | undefined, allies: SkillTargetUnit[] | null | undefined, count: number, selector: string | null = null): DefenseUnit[] {
  return collectUnitsBySelector(
    allies as unknown as SkillTargetUnit[],
    selector || skill?.allySelector || "lowest_hp_pct",
    count,
    {
      ...buildSkillSelectionOptions(scene, attacker, target, skill),
      excludeUid: skill?.includeSelf ? null : attacker?.uid
    }
  ) as unknown as DefenseUnit[];
}

function updateMetamorphosisDisplay(scene: DefenseSceneLike, attacker: DefenseUnit) {
  if (!attacker) return;
  if (attacker.icon && typeof attacker.icon.setText === "function") {
    attacker.icon.setText("🦋");
  }
  if (attacker.tag && typeof attacker.tag.setText === "function") {
    attacker.tag.setText(attacker.name || "Bướm Gió");
  }
  syncCommonSkillLabels(scene, attacker);
}

function resolveShieldScaleBasis(scene: DefenseSceneLike, attacker: DefenseUnit, scaleStat: string = "def") {
  const resolvedStat = String(scaleStat || "def").trim().toLowerCase();
  switch (resolvedStat) {
    case "atk":
      return Number(scene.getEffectiveAtk?.(attacker) ?? attacker?.atk ?? 0) || 0;
    case "matk":
      return Number(scene.getEffectiveMatk?.(attacker) ?? attacker?.matk ?? 0) || 0;
    case "mdef":
      return Number(attacker?.mdef ?? 0) || 0;
    case "def":
    default:
      return Number(scene.getEffectiveDef?.(attacker) ?? attacker?.def ?? 0) || 0;
  }
}

function rollChance(scene: DefenseSceneLike | null | undefined, chance: number): boolean {
  return scene?.rollChance?.(chance) ?? Math.random() < chance;
}

function cleanseOrderedDebuffs(unit: DefenseUnit | null | undefined, maxCount: number | null): number {
  const remaining = Math.max(0, Math.round(Number(maxCount || 0) || 0));
  if (!unit?.statuses || remaining <= 0) return 0;
  const orderedKeys = [
    "freeze",
    "stun",
    "sleep",
    "silence",
    "burnTurns",
    "poisonTurns",
    "bleedTurns",
    "diseaseTurns",
    "healBlockTurns"
  ];
  let cleansed = 0;
  orderedKeys.forEach((key) => {
    if (cleansed >= remaining) return;
    if ((Number(unit.statuses[key] ?? 0) || 0) <= 0) return;
    unit.statuses[key] = 0;
    if (key === "burnTurns") unit.statuses.burnDamage = 0;
    if (key === "poisonTurns") unit.statuses.poisonDamage = 0;
    if (key === "bleedTurns") unit.statuses.bleedDamage = 0;
    if (key === "diseaseTurns") unit.statuses.diseaseDamage = 0;
    cleansed += 1;
  });
  return cleansed;
}

export async function applySharedCommonDefenseSkillEffect(scene: DefenseSceneLike, context: DefenseSkillContext): Promise<boolean> {
  const { attacker, target, skill, rawSkill, skillOpts, enemies, allies, star, starScale } = context;

  switch (skill.effect) {
    case "shield_immune": {
      allies.forEach((ally: DefenseUnit) => {
        scene.addShield(ally, rawSkill);
        ally.statuses.immuneTurns = Math.max(Number(ally.statuses.immuneTurns || 0), Number(skill.turns || 2));
        showCommonSkillText(scene, ally, "MIỄN NHIỄM", "#ffffff");
        updateCommonSkillUnit(scene, ally);
      });
      return true;
    }
    case "self_bersek": {
      const berserkTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.turns || 3) || 3))
        : 5;
      const exactAtkBuffValue = Number.isFinite(Number(skill.atkBuffValue))
        ? Math.max(1, Math.round(Number(skill.atkBuffValue) || 0))
        : Math.max(
          1,
          Math.round(
            (Number(scene.getEffectiveAtk?.(attacker) ?? attacker?.atk ?? 0) || 0)
            * Math.max(0, Number(skill.atkBuffPct || 0.5) || 0.5)
          )
        );
      const berserkAtkBuff = skill.runtimeShapeVersion === 3
        ? exactAtkBuffValue
        : Math.round((Number(attacker.atk) || 0) * 0.5 * starScale);
      attacker.statuses.atkBuffTurns = Math.max(Number(attacker.statuses.atkBuffTurns || 0), Number(berserkTurns));
      attacker.statuses.atkBuffValue = Math.max(Number(attacker.statuses.atkBuffValue || 0), Number(berserkAtkBuff));
      attacker.statuses.berserkTurns = Math.max(Number(attacker.statuses.berserkTurns || 0), Number(berserkTurns));
      attacker.statuses.berserkLifestealPct = Math.max(
        attacker.statuses.berserkLifestealPct || 0,
        Math.max(0, Number(skill.lifestealPct || 0) || 0)
      );
      attacker.statuses.berserkNextBasicMultiplier = Math.max(
        attacker.statuses.berserkNextBasicMultiplier || 0,
        Math.max(0, Number(skill.firstBasicAttackMultiplier || 0) || 0)
      );
      attacker.statuses.berserkKillRageGain = Math.max(
        attacker.statuses.berserkKillRageGain || 0,
        Math.max(0, Math.round(Number(skill.rageGainOnKill || 0) || 0))
      );
      attacker.statuses.berserkKillExtendTurns = Math.max(
        attacker.statuses.berserkKillExtendTurns || 0,
        Math.max(0, Math.round(Number(skill.berserkExtendOnKillTurns || 0) || 0))
      );
      attacker.statuses.berserkKillChainBasic = Math.max(
        attacker.statuses.berserkKillChainBasic || 0,
        Math.max(0, Math.round(Number(skill.chainBasicOnKill || 0) || 0))
      );
      showCommonSkillText(scene, attacker, "CUỒNG NỘ", "#ff0000");
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "execute_heal": {
      scene.resolveDamage(attacker, target, Number(rawSkill), String(skill.damageType ?? ""), String(skill.name ?? ""), skillOpts);
      if (!target?.alive) {
        scene.healUnit(attacker, attacker, Math.round(Number(attacker.maxHp || 0) * 0.2), "HẤP THỤ");
        attacker.rage = Math.min(Number(attacker.rageMax || 0), (Number(attacker.rage) || 0) + 2);
      }
      return true;
    }
    case "revive_or_heal": {
      const deadUnits = (scene.combatUnits ?? []).filter((unit: DefenseUnit) => unit.side === attacker.side && !unit.alive);
      const reviveTargets = deadUnits.slice(0, skill.reviveCount || 1);
      if (reviveTargets.length && rollChance(scene, Number(skill.reviveChance || 0.5))) {
        reviveTargets.forEach((dead: DefenseUnit) => {
          dead.alive = true;
          dead.hp = Math.round(Number(dead.maxHp || 0) * 0.4 * starScale);
          const revivedTheme = scene.getRoleTheme?.(dead.classType);
          dead.sprite?.setFillStyle?.(Number(revivedTheme?.fill ?? 0xffffff), 0.98);
          dead.sprite?.setStrokeStyle?.(3, Number(revivedTheme?.stroke ?? 0xffffff), 1);
          dead.tag?.setColor?.("#ffffff");
          showCommonSkillText(scene, dead, "HỒI SINH", "#ffff00");
          updateCommonSkillUnit(scene, dead);
        });
      } else {
        const healTargets = skill.healAllies
          ? selectDefenseTargets(scene, attacker, target, skill, allies, Number(skill.healTargetCount || allies.length))
          : allies as DefenseUnit[];
        healTargets.forEach((ally: DefenseUnit) => {
          scene.healUnit(attacker, ally, Math.round(Number(rawSkill) * starScale), "CỨU RỖI");
        });
      }
      return true;
    }
    case "global_tide_evade": {
      let healedAny = false;
      allies.forEach((ally: DefenseUnit) => {
        if (!ally?.alive) return;
        const missingHp = Math.max(0, (ally.maxHp ?? 0) - (ally.hp ?? 0));
        if (missingHp <= 0) return;
        healedAny = true;
        ally.hp = ally.maxHp;
        scene.vfx?.pulseAt?.((ally.sprite?.x ?? 0), (ally.sprite?.y ?? 0) - 10, 0x9dffba, 14, 180);
        showCommonSkillText(scene, ally, `+${missingHp}`, "#9dffba");
        updateCommonSkillUnit(scene, ally);
      });
      if (healedAny) scene.audioFx?.play?.("heal");
      scene.showFloatingText(attacker.sprite?.x ?? 0, (attacker.sprite?.y ?? 0) - 37, healedAny ? "THỦY TRIỀU" : "ĐẦY MÁU", "#c9ffde");
      return true;
    }
    case "team_def_buff":
    case "team_buff_def": {
      const turns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.turns || 3) || 3))
        : (Number.isFinite(skill.turns) ? Math.max(1, Math.round(Number(skill.turns || 0))) : 3);
      const defBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.armorBuff || 20) || 20))
        : Math.max(1, Math.round((skill.armorBuff || 20) * starScale));
      const mdefBase = Math.max(skill.mdefBuff || 0, skill.armorBuff || 0, 20);
      const mdefBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(mdefBase) || 20))
        : Math.max(1, Math.round(mdefBase * starScale));
      allies.forEach((ally: DefenseUnit) => {
        ally.statuses.defBuffTurns = Math.max(Number(ally.statuses.defBuffTurns || 0), Number(turns || 0));
        ally.statuses.defBuffValue = Math.max(Number(ally.statuses.defBuffValue || 0), Number(defBuff));
        ally.statuses.mdefBuffTurns = Math.max(Number(ally.statuses.mdefBuffTurns || 0), Number(turns || 0));
        ally.statuses.mdefBuffValue = Math.max(Number(ally.statuses.mdefBuffValue || 0), Number(mdefBuff));
        updateCommonSkillUnit(scene, ally);
      });
      const healTargets = (
        skill.runtimeShapeVersion === 3
          ? collectLowestHpRatioUnits(allies as unknown as SkillTargetUnit[], Math.max(1, Math.round(Number(skill.healTargetCount || 1) || 1)))
          : [findLowestHpRatioUnit(allies as unknown as SkillTargetUnit[])].filter(Boolean)
      ) as unknown as DefenseUnit[];
      const primaryHealTarget = healTargets[0] ?? null;
      healTargets.forEach((ally: DefenseUnit) => {
        const healAmount = skill.runtimeShapeVersion === 3
          ? Math.max(1, Math.round(Number(skill.healAmount || 50) || 50))
          : Math.max(1, Math.round(50 * starScale));
        scene.healUnit(attacker, ally, healAmount, "PHÚC LÀNH");
        if ((Number(skill.bonusShieldBase || 0)) > 0) {
          scene.addShield(ally, Number(skill.bonusShieldBase || 0));
        }
      });
      if ((Number(skill.bonusShieldBase || 0)) > 0 && !skill.runtimeShapeVersion && primaryHealTarget) {
        scene.addShield(primaryHealTarget, Number(skill.bonusShieldBase || 0));
      }
      if ((skill.primaryTargetDamageReductionPct || 0) > 0 && primaryHealTarget) {
        primaryHealTarget.statuses.damageReductionTurns = Math.max(Number(primaryHealTarget.statuses.damageReductionTurns || 0), Number(skill.turns || 1));
        primaryHealTarget.statuses.damageReductionPct = Math.max(Number(primaryHealTarget.statuses.damageReductionPct || 0), Number(skill.primaryTargetDamageReductionPct || 0));
        updateCommonSkillUnit(scene, primaryHealTarget);
      }
      showCommonSkillText(scene, attacker, "BẢO VỆ", "#00ff00");
      return true;
    }
    case "damage_shield_taunt": {
      scene.resolveDamage(attacker, target, Number(rawSkill), String(skill.damageType ?? ""), String(skill.name ?? ""), skillOpts);
      const shieldAmount = Math.round(
        (Number(skill.shieldBase || 0) || 0)
        + (resolveShieldScaleBasis(scene, attacker, skill.shieldScaleStat || "def") * (Number(skill.shieldScale || 0) || 0))
      );
      scene.addShield(attacker, shieldAmount);
      enemies.forEach((enemy: DefenseUnit) => {
        enemy.statuses.tauntTargetId = String(attacker.uid ?? "");
        enemy.statuses.tauntTurns = Math.max(
          Number(enemy.statuses.tauntTurns || 0) || 0,
          Math.max(1, Math.round(Number(skill.tauntTurns || 2) || 2))
        );
        updateCommonSkillUnit(scene, enemy);
      });
      if ((skill.shieldSharePctToNearest || 0) > 0) {
        const nearbyAlly = allies
          .filter((ally: DefenseUnit) => ally.alive && ally.uid !== attacker.uid)
          .sort((a: DefenseUnit, b: DefenseUnit) => Math.abs(attacker.row - a.row) + Math.abs(attacker.col - a.col) - (Math.abs(attacker.row - b.row) + Math.abs(attacker.col - b.col)))[0];
        if (nearbyAlly) {
          scene.addShield(nearbyAlly, Math.round(shieldAmount * Number(skill.shieldSharePctToNearest || 0)));
          updateCommonSkillUnit(scene, nearbyAlly);
        }
      }
      return true;
    }
    case "metamorphosis": {
      attacker.name = skill.transformNameVi || attacker.name || "Bướm Gió";
      attacker.tribe = skill.transformTribe || attacker.tribe || "WIND";
      updateMetamorphosisDisplay(scene, attacker);
      const selfMatkBuffPct = Math.max(
        0,
        Number(skill.selfMatkBuffPct ?? ((Number(skill.buffStats?.matk ?? 1.5) || 1.5) - 1)) || 0
      );
      const selfMatkBuffTurns = Math.max(1, Math.round(Number(skill.selfMatkBuffTurns ?? 99) || 99));
      attacker.statuses.matkBuffTurns = Math.max(Number(attacker.statuses.matkBuffTurns || 0), Number(selfMatkBuffTurns));
      attacker.statuses.matkBuffValue = Math.max(
        Number(attacker.statuses.matkBuffValue || 0),
        Math.max(1, Math.round((Number(attacker.matk ?? 0) || 0) * selfMatkBuffPct))
      );
      if (!attacker.mods) attacker.mods = {};
      attacker.mods.basicAttackType = "magic";
      attacker.mods.basicAttackScaleStat = skill.basicAttackScaleStat || "matk";
      attacker.rage = 0;
      const teamEvadeBuffPct = Math.max(0, Number(skill.teamEvadeBuffPct ?? 0) || 0);
      if (teamEvadeBuffPct > 0) {
        const teamEvadeBuffTurns = Math.max(1, Math.round(Number(skill.teamEvadeBuffTurns ?? 99) || 99));
        allies.forEach((ally: DefenseUnit) => {
          ally.statuses.evadeBuffTurns = Math.max(ally.statuses.evadeBuffTurns || 0, teamEvadeBuffTurns);
          ally.statuses.evadeBuffValue = Math.max(ally.statuses.evadeBuffValue || 0, teamEvadeBuffPct);
          updateCommonSkillUnit(scene, ally);
          scene.showFloatingText((ally.sprite?.x ?? 0), (ally.sprite?.y ?? 0) - 56, "NHANH NHẸN", "#9fe8ff");
        });
      }
      scene.showFloatingText((attacker.sprite?.x ?? 0), (attacker.sprite?.y ?? 0) - 60, "BIẾN HÌNH!", "#ff00ff");
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "turtle_protection": {
      attacker.statuses.isProtecting = Number(skill.turns || 3);
      showCommonSkillText(scene, attacker, "HÀO QUANG VỆ QUÂN", "#9dffba");
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "rhino_counter": {
      const counterTurns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.counterTurns ?? skill.turns ?? 3) || 3))
        : Number(skill.turns || 3) + (star >= 2 ? 1 : 0);
      attacker.statuses.counterTurns = Math.max(attacker.statuses.counterTurns || 0, counterTurns);
      showCommonSkillText(scene, attacker, "TẬP TRUNG PHẢN ĐÒN", "#ffd97b");
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "pangolin_reflect": {
      const shieldTurns = Math.max(1, Math.round(Number(skill.turns || 3) || 3));
      const shieldAmount = Math.max(
        1,
        Math.round(
          (Number(skill.shieldBase || 0) || 0)
          + (resolveShieldScaleBasis(scene, attacker, skill.shieldScaleStat || "def") * (Number(skill.shieldScale || 0) || 0))
        )
      );
      scene.addShield(attacker, shieldAmount);
      attacker.statuses.physReflectTurns = Number(shieldTurns);
      attacker.statuses.physReflectPct = Math.max(Number(attacker.statuses.physReflectPct || 0), Number(skill.physReflectPct || 0) || Number(skill.reflectPct || 0) || 1);
      if (Number(skill.reflectPct || 0) > 0) {
        attacker.statuses.reflectTurns = Math.max(Number(attacker.statuses.reflectTurns || 0), Number(skill.reflectTurns || shieldTurns || 0));
        attacker.statuses.reflectPct = Math.max(Number(attacker.statuses.reflectPct || 0), Number(skill.reflectPct || 0));
      }
      attacker.statuses.pangolinShieldTurns = Math.max(Number(attacker.statuses.pangolinShieldTurns || 0), Number(shieldTurns));
      attacker.statuses.pangolinShieldExpireHealPct = Math.max(
        Number(attacker.statuses.pangolinShieldExpireHealPct || 0),
        Number(skill.expireHealPct || 0));
      attacker.statuses.pangolinShieldExpireDamageReductionPct = Math.max(
        attacker.statuses.pangolinShieldExpireDamageReductionPct || 0,
        skill.expireDamageReductionPct || 0
      );
      attacker.statuses.pangolinShieldExpireDamageReductionTurns = Math.max(
        attacker.statuses.pangolinShieldExpireDamageReductionTurns || 0,
        skill.expireDamageReductionTurns || 0
      );
      if ((skill.shieldSharePctToNearest || 0) > 0) {
        const shareTarget = allies
          .filter((ally: DefenseUnit) => ally.alive && ally.uid !== attacker.uid)
          .sort((a: DefenseUnit, b: DefenseUnit) => manhattan(attacker, a) - manhattan(attacker, b))[0];
        if (shareTarget) {
          const shareAmount = Math.max(1, Math.round(shieldAmount * Number(skill.shieldSharePctToNearest || 0)));
          scene.addShield(shareTarget, shareAmount);
          shareTarget.statuses.pangolinShieldTurns = Math.max(shareTarget.statuses.pangolinShieldTurns || 0, shieldTurns);
          shareTarget.statuses.pangolinShieldExpireHealPct = Math.max(
          Number(shareTarget.statuses.pangolinShieldExpireHealPct || 0),
          Number(skill.expireHealPct || 0));
          shareTarget.statuses.pangolinShieldExpireDamageReductionPct = Math.max(
            shareTarget.statuses.pangolinShieldExpireDamageReductionPct || 0,
            skill.expireDamageReductionPct || 0
          );
          shareTarget.statuses.pangolinShieldExpireDamageReductionTurns = Math.max(
            shareTarget.statuses.pangolinShieldExpireDamageReductionTurns || 0,
            skill.expireDamageReductionTurns || 0
          );
          showCommonSkillText(scene, shareTarget, `+${shareAmount} KHIÊN`, "#ff9b9b");
          updateCommonSkillUnit(scene, shareTarget);
        }
      }
      showCommonSkillText(scene, attacker, "GIÁP VẢY SẮC", "#ff9b9b");
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "damage_shield_reflect": {
      scene.resolveDamage(attacker, target, Number(rawSkill), String(skill.damageType ?? ""), String(skill.name ?? ""), skillOpts);
      scene.addShield(attacker, Math.round(Number(skill.shieldBase || 0) + Number(scene.getEffectiveDef?.(attacker) || 0) * 0.5));
      attacker.statuses.reflectTurns = Math.max(Number(attacker.statuses.reflectTurns || 0), Number(skill.reflectTurns || 0));
      attacker.statuses.reflectPct = Math.max(Number(attacker.statuses.reflectPct || 0), Number(skill.reflectPct || 0));
      updateCommonSkillUnit(scene, attacker);
      return true;
    }
    case "ally_row_def_buff": {
      const scaledArmor = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.armorBuff || 15)))
        : Math.max(1, Math.round(Number(skill.armorBuff || 15) * starScale));
      const scaledMdef = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.mdefBuff || 10)))
        : Math.max(1, Math.round(Number(skill.mdefBuff || 10) * starScale));
      const useRowGuardTargeting = skill.rowGuardIncludeSelf != null || skill.rowGuardMaxAllies != null;
      if (useRowGuardTargeting) {
        const rowGuardTargets = selectRowGuardUnits(
          allies as unknown as SkillTargetUnit[],
          attacker as unknown as SkillTargetUnit,
          { includeSelf: skill.rowGuardIncludeSelf !== false, maxAllies: skill.rowGuardMaxAllies ?? 0 }
        ) as unknown as DefenseUnit[];
        const rowShieldValue = Math.max(0, Math.round(Number(skill.rowGuardShieldBase || 0)));
        const guardedAlly = rowGuardTargets.find((ally: DefenseUnit) => ally.uid !== attacker.uid) || null;
        rowGuardTargets.forEach((ally: DefenseUnit) => {
          ally.statuses.defBuffTurns = Math.max(Number(ally.statuses.defBuffTurns || 0), Number(skill.turns || 0));
          ally.statuses.defBuffValue = Math.max(Number(ally.statuses.defBuffValue), Number(scaledArmor));
          ally.statuses.mdefBuffTurns = Math.max(Number(ally.statuses.mdefBuffTurns || 0), Number(skill.turns || 0));
          ally.statuses.mdefBuffValue = Math.max(Number(ally.statuses.mdefBuffValue), Number(scaledMdef));
          if (Number(rowShieldValue) > 0) scene.addShield(ally, rowShieldValue);
          updateCommonSkillUnit(scene, ally);
          showCommonSkillText(scene, ally, "HỘ VỆ", "#a9ebff");
        });
        if (guardedAlly && (skill.rowGuardGuardianAbsorbPct || 0) > 0) {
          guardedAlly.statuses.guardianId = String(attacker.uid ?? "");
          guardedAlly.statuses.guardianTurns = Math.max(
            guardedAlly.statuses.guardianTurns || 0,
            Math.max(1, Math.round(Number(skill.rowGuardGuardianTurns || skill.turns || 1) || 1))
          );
          guardedAlly.statuses.guardianAbsorb = Math.max(
            guardedAlly.statuses.guardianAbsorb || 0,
            Math.max(0, Number(skill.rowGuardGuardianAbsorbPct || 0) || 0)
          );
          guardedAlly.statuses.guardianRedirectCharges = Math.max(
            guardedAlly.statuses.guardianRedirectCharges || 0,
            Math.max(0, Math.round(Number(skill.rowGuardGuardianRedirectCharges || 0) || 0))
          );
          guardedAlly.statuses.guardianCounterOffenseDebuffTurns = Math.max(
            Number(guardedAlly.statuses.guardianCounterOffenseDebuffTurns || 0),
            Math.max(0, Math.round(Number(skill.rowGuardCounterOffenseDebuffTurns || 0) || 0))
          );
          guardedAlly.statuses.guardianCounterOffenseDebuffValue = Math.max(
            Number(guardedAlly.statuses.guardianCounterOffenseDebuffValue || 0),
            Math.max(0, Math.round(Number(skill.rowGuardCounterOffenseDebuffValue || 0) || 0))
          );
          guardedAlly.statuses.guardianCounterOffenseDebuffMode = skill.rowGuardCounterOffenseDebuffMode || "autoByRole";
          updateCommonSkillUnit(scene, guardedAlly);
        }
        return true;
      }
      const rowAllies = allies.filter((ally: DefenseUnit) => ally.row === attacker.row);
      const aliveRowAllies = rowAllies.filter((ally: DefenseUnit) => ally.alive);
      const rowShieldMinUnits = Math.max(0, Math.round(Number(skill.rowShieldMinUnits || 0)));
      const rowShieldValue = Math.max(1, Math.round(Number(skill.rowGuardShieldBase || 12)));
      const shouldShieldEntireRow = rowShieldMinUnits > 0 && aliveRowAllies.length >= rowShieldMinUnits;
      const weakestRowAlly = shouldShieldEntireRow ? null : findLowestHpRatioUnit(aliveRowAllies);
      rowAllies.forEach((ally: DefenseUnit) => {
          ally.statuses.defBuffTurns = Math.max(Number(ally.statuses.defBuffTurns || 0), Number(skill.turns || 0));
          ally.statuses.defBuffValue = Math.max(Number(ally.statuses.defBuffValue), Number(scaledArmor));
          ally.statuses.mdefBuffTurns = Math.max(Number(ally.statuses.mdefBuffTurns || 0), Number(skill.turns || 0));
          ally.statuses.mdefBuffValue = Math.max(Number(ally.statuses.mdefBuffValue), Number(scaledMdef));
          if (shouldShieldEntireRow) {
            scene.addShield(ally, rowShieldValue);
          } else if ((skill.rowGuardShieldBase || 0) > 0 && ally.uid === weakestRowAlly?.uid) {
            scene.addShield(ally, rowShieldValue);
          }
          updateCommonSkillUnit(scene, ally);
          showCommonSkillText(scene, ally, "HỘ VỆ", "#a9ebff");
        });
      return true;
    }
    case "dual_heal": {
      const healTargets = collectLowestHpRatioUnits(
        allies as unknown as SkillTargetUnit[],
        skill.runtimeShapeVersion === 3
          ? Math.max(1, Math.round(Number(skill.maxTargets || 2) || 2))
          : 2
      ) as unknown as DefenseUnit[];
      healTargets.forEach((ally: DefenseUnit) => {
        const healAmount = skill.runtimeShapeVersion === 3
          ? Math.max(1, Math.round(Number(rawSkill) || 0))
          : Math.round(Number(rawSkill) * starScale);
        scene.healUnit(attacker, ally, healAmount, String(skill.name ?? ""));
        if (skill.runtimeShapeVersion === 3 && (skill.cleanseCount || 0) > 0) {
          ally.statuses.freeze = 0;
          ally.statuses.stun = 0;
          ally.statuses.sleep = 0;
          ally.statuses.silence = 0;
          ally.statuses.burnTurns = 0;
          ally.statuses.poisonTurns = 0;
          ally.statuses.bleedTurns = 0;
          ally.statuses.diseaseTurns = 0;
          updateCommonSkillUnit(scene, ally);
        }
      });
      return true;
    }
    case "shield_cleanse": {
      const maxTargets = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(Number(skill.maxTargets || 1)) || 1))
        : 1;
      const cleanseCount = skill.runtimeShapeVersion === 3
        ? Math.max(0, Math.round(Number(skill.cleanseCount || 1) || 1))
        : Number.POSITIVE_INFINITY;
      const shieldAmount = skill.runtimeShapeVersion === 3
        ? Math.round((Number(skill.shieldBase || 0) || 0) + (Number(scene.getEffectiveMatk?.(attacker) || 0) * Number(skill.shieldScale || 0)))
        : Math.round((Number(skill.shieldBase || 0) + Number(scene.getEffectiveMatk?.(attacker) || 0) * Number(skill.shieldScale || 0)) * starScale);
      const targets = collectLowestHpRatioUnits(allies as unknown as SkillTargetUnit[], maxTargets) as unknown as DefenseUnit[];
      if (!targets.length) return true;
      targets.forEach((ally: DefenseUnit) => {
        scene.addShield(ally, shieldAmount);
        cleanseOrderedDebuffs(ally, cleanseCount);
        updateCommonSkillUnit(scene, ally);
      });
      return true;
    }
    case "team_rage": {
      selectDefenseTargets(scene, attacker, target, skill, allies, Number(skill.maxTargets || 1), skill.allySelector || "lowest_rage_ally")
        .forEach((ally: DefenseUnit) => {
          ally.rage = Math.min(Number(ally.rageMax || 0), (Number(ally.rage) || 0) + Number(skill.rageGain || 0));
          updateCommonSkillUnit(scene, ally);
          showCommonSkillText(scene, ally, "+NỘ", "#b8f5ff");
        });
      return true;
    }
    case "column_bless": {
      const turns = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.turns || 2) || 2))
        : Math.max(1, Math.round(Number(skill.turns || 2) || 2));
      const atkBuff = skill.runtimeShapeVersion === 3
        ? Math.max(1, Math.round(Number(skill.atkBuff || 15) || 15))
        : Math.max(1, Math.round(Number(skill.atkBuff || 15) * starScale));
      const evadeBuff = skill.runtimeShapeVersion === 3
        ? Math.max(0, Number(skill.evadeBuff || 0) || 0)
        : Math.min(0.5, Number(skill.evadeBuff || 0.1) * starScale);
      allies
        .filter((ally: DefenseUnit) => ally.col === attacker.col)
        .forEach((ally: DefenseUnit) => {
          ally.statuses.atkBuffTurns = Math.max(Number(ally.statuses.atkBuffTurns || 0), turns);
          ally.statuses.atkBuffValue = Math.max(Number(ally.statuses.atkBuffValue || 0), atkBuff);
          if (evadeBuff > 0) {
            ally.statuses.evadeBuffTurns = Math.max(ally.statuses.evadeBuffTurns || 0, turns);
            ally.statuses.evadeBuffValue = Math.max(ally.statuses.evadeBuffValue || 0, evadeBuff);
          }
          updateCommonSkillUnit(scene, ally);
        });
      if (skill.runtimeShapeVersion === 3 && ((skill.adjacentColumnAtkBuff || 0) > 0 || (skill.adjacentColumnEvadeBuff || 0) > 0)) {
        const splashTurns = Math.max(1, Math.round(Number(skill.adjacentColumnTurns ?? turns) || turns));
        const splashAtkBuff = Math.max(0, Math.round(Number(skill.adjacentColumnAtkBuff || 0) || 0));
        const splashEvadeBuff = Math.max(0, Number(skill.adjacentColumnEvadeBuff || 0) || 0);
        allies
          .filter((ally: DefenseUnit) => ally.col === attacker.col - 1 || ally.col === attacker.col + 1)
          .forEach((ally: DefenseUnit) => {
            if (splashAtkBuff > 0) {
              ally.statuses.atkBuffTurns = Math.max(Number(ally.statuses.atkBuffTurns || 0), splashTurns);
              ally.statuses.atkBuffValue = Math.max(Number(ally.statuses.atkBuffValue || 0), splashAtkBuff);
            }
            if (splashEvadeBuff > 0) {
              ally.statuses.evadeBuffTurns = Math.max(ally.statuses.evadeBuffTurns || 0, splashTurns);
              ally.statuses.evadeBuffValue = Math.max(ally.statuses.evadeBuffValue || 0, splashEvadeBuff);
            }
            updateCommonSkillUnit(scene, ally);
          });
      }
      return true;
    }
    default:
      return false;
  }
}
