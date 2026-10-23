import { UNIT_BY_ID, resolveUnitSkillForStar } from "../../data/unitCatalog.js";
import { SKILL_LIBRARY } from "../../data/skills.js";
import { createEnvironmentMods } from "../../data/battlefieldEnvironments.js";
import { getBasicAttackProfile } from "../../core/damageResolver.js";
import {
  getBaseCritRate,
  getBaseEvasion,
  getEffectiveSkillId,
  scaledBaseStats
} from "../../core/gameUtils.js";

const DEFAULT_MODS = Object.freeze({
  atkPct: 0,
  matkPct: 0,
  healPct: 0,
  lifestealPct: 0,
  rageGainPct: 0,
  critPct: 0,
  evadePct: 0,
  accuracyPct: 0,
  burnOnHit: 0,
  poisonOnHit: 0,
  shieldStart: 0,
  startingRage: 0,
  healReceivedPct: 0,
  fireVulnerabilityMultiplier: 1,
  poisonAuraDamage: 0,
  basicAttackType: "physical",
  basicAttackScaleStat: "atk",
  basicAttackDelivery: "melee"
});

const DEFAULT_STATUSES = Object.freeze({
  freeze: 0,
  stun: 0,
  sleep: 0,
  silence: 0,
  tauntTurns: 0,
  tauntTargetId: null,
  burnTurns: 0,
  burnDamage: 0,
  fireVulnerabilityTurns: 0,
  fireVulnerabilityMultiplier: 1,
  poisonTurns: 0,
  poisonDamage: 0,
  armorBreakTurns: 0,
  armorBreakValue: 0,
  reflectTurns: 0,
  reflectPct: 0,
  atkBuffTurns: 0,
  atkBuffValue: 0,
  matkBuffTurns: 0,
  matkBuffValue: 0,
  defBuffTurns: 0,
  defBuffValue: 0,
  mdefBuffTurns: 0,
  mdefBuffValue: 0,
  evadeBuffTurns: 0,
  evadeBuffValue: 0,
  evadeDebuffTurns: 0,
  evadeDebuffValue: 0,
  disarmTurns: 0,
  immuneTurns: 0,
  physReflectTurns: 0,
  physReflectPct: 0,
  counterTurns: 0,
  isProtecting: 0,
  bleedTurns: 0,
  bleedDamage: 0,
  diseaseTurns: 0,
  diseaseDamage: 0,
  healBlockTurns: 0,
  healBlockSourceId: null,
  healReductionTurns: 0,
  healReductionPct: 0,
  shieldLockTurns: 0,
  shieldLockSourceId: null,
  scavengeMarkTurns: 0,
  scavengeMarkDamageMultiplier: 0,
  scavengeMarkRageDrain: 0,
  scavengeMarkEvadeDebuffTurns: 0,
  scavengeMarkEvadeDebuffValue: 0,
  evadeBuffDodgeHeal: 0,
  evadeBuffDodgeShield: 0,
  evadeBuffDodgeRage: 0,
  offenseDebuffTurns: 0,
  offenseDebuffValue: 0,
  offenseDebuffMode: "",
  offenseDebuffStat: "",
  atkDebuffTurns: 0,
  atkDebuffValue: 0,
  slowTurns: 0,
  hasteTurns: 0,
  hotTurns: 0,
  hotAmount: 0,
  guardianTurns: 0,
  guardianId: null,
  guardianAbsorb: 0,
  guardianRedirectCharges: 0,
  guardianCounterOffenseDebuffTurns: 0,
  guardianCounterOffenseDebuffValue: 0,
  guardianCounterOffenseDebuffMode: "",
  damageReductionTurns: 0,
  damageReductionPct: 0,
  magicDamageReductionTurns: 0,
  magicDamageReductionPct: 0,
  fortifyReduceTurns: 0,
  fortifyReducePct: 0,
  soulLinkTurns: 0,
  soulLinkId: null,
  bloodHuntTurns: 0,
  bloodHuntStacks: 0,
  bloodHuntAntiHeal: 0,
  chromaticDartRedBonus: 0,
  chromaticDartYellowBonus: 0,
  chromaticDartLastCast: null,
  berserkTurns: 0,
  berserkLifestealPct: 0,
  berserkNextBasicMultiplier: 0,
  berserkKillRageGain: 0,
  berserkKillExtendTurns: 0,
  berserkKillChainBasic: 0,
  onHitOffenseDebuffTurns: 0,
  onHitOffenseDebuffValue: 0,
  onHitOffenseDebuffMode: "",
  resilientShieldTurns: 0,
  resilientShieldHealPct: 0,
  resilientShieldHotTurns: 0,
  resilientShieldHotPct: 0,
  pangolinShieldTurns: 0,
  pangolinShieldExpireHealPct: 0,
  pangolinShieldExpireDamageReductionPct: 0,
  pangolinShieldExpireDamageReductionTurns: 0,
  pangolinShieldExpireCleanseCount: 0,
  phoenixRevive: false,
  phoenixUsed: false
});

function getConfiguredEnemyScaleFactor(enemyScaling: ((round: number) => number) | null | undefined, round: number): number | null {
  if (typeof enemyScaling !== "function") return null;
  const scaleFactor = enemyScaling(round);
  return Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : null;
}

function applyLegacyEnemyScaling(baseValue: number, scaleFactor: number): number {
  return Number.isFinite(scaleFactor) && scaleFactor > 0
    ? Math.round(baseValue * scaleFactor)
    : baseValue;
}



interface OwnedUnitLike {
  uid?: string;
  baseId?: string;
  star?: number;
  base?: { stats?: Record<string, number>; classType?: string };
  sandbox?: boolean;
  sourceUid?: string | null;
  equips?: unknown[];
  [key: string]: unknown;
}

export function createCombatUnitDescriptor(owned: OwnedUnitLike | null | undefined) {
  const base = owned?.base ?? UNIT_BY_ID[owned?.baseId as string];
  if (!owned || !base?.stats) return null;

  const star = Math.max(1, owned.star ?? 1);
  return {
    owned,
    base,
    star,
    baseStats: scaledBaseStats(base.stats, star, base.classType),
    skillCost: Number((resolveUnitSkillForStar(base, star) as { cost?: number } | null)?.cost ?? base?.stats?.rageMax ?? 3),
    basicAttackProfile: getBasicAttackProfile(base)
  };
}

interface CombatUnitDescriptorLike {
  owned: OwnedUnitLike;
  base: { stats: Record<string, number>; classType?: string; [key: string]: unknown };
  star: number;
  baseStats: Record<string, number>;
  skillCost?: number;
  basicAttackProfile: { damageType: string; scaleStat: string; delivery: string };
}

interface AiSettings {
  hpMult?: number;
  atkMult?: number;
  matkMult?: number;
  difficulty?: string | null;
  [key: string]: unknown;
}

interface PlayerAugments {
  teamHpPct?: number;
  teamAtkPct?: number;
  teamMatkPct?: number;
  teamDefPct?: number;
  teamMdefPct?: number;
  lifestealPct?: number;
  rageGainPct?: number;
  teamCritPct?: number;
  startingRage?: number;
  startingShield?: number;
  [key: string]: unknown;
}

export function computeCombatUnitStatLine({
  descriptor,
  side,
  player,
  aiSettings,
  round,
  gameMode,
  enemyScaling,
  includeDefenseAugments = true
}: {
  descriptor: CombatUnitDescriptorLike | null;
  side: "LEFT" | "RIGHT";
  player: PlayerAugments | null | undefined;
  aiSettings?: AiSettings | null;
  round: number;
  gameMode?: string | null;
  enemyScaling?: ((round: number) => number) | null;
  includeDefenseAugments?: boolean;
}) {
  if (!descriptor?.baseStats) return null;

  const { baseStats } = descriptor;
  const ai = aiSettings ?? { hpMult: 1, atkMult: 1, matkMult: 1, difficulty: null };
  let hpBase = side === "RIGHT" ? Math.round(baseStats.hp * (ai.hpMult ?? 1)) : baseStats.hp;
  let atkBase = side === "RIGHT" ? Math.round(baseStats.atk * (ai.atkMult ?? 1)) : baseStats.atk;
  let matkBase = side === "RIGHT" ? Math.round(baseStats.matk * (ai.matkMult ?? 1)) : baseStats.matk;
  const skipEnemyScaling = descriptor?.owned?.sandbox === true;

  if (side === "RIGHT" && !skipEnemyScaling) {
    const configuredScaleFactor = getConfiguredEnemyScaleFactor(enemyScaling, round);
    if (configuredScaleFactor !== null) {
      hpBase = applyLegacyEnemyScaling(hpBase, configuredScaleFactor);
      atkBase = applyLegacyEnemyScaling(atkBase, configuredScaleFactor);
      matkBase = applyLegacyEnemyScaling(matkBase, configuredScaleFactor);
    } else {
      if (gameMode === "EndlessPvEClassic" && round > 30) {
        const scaleFactor = 1 + (round - 30) * 0.05;
        hpBase = applyLegacyEnemyScaling(hpBase, scaleFactor);
        atkBase = applyLegacyEnemyScaling(atkBase, scaleFactor);
        matkBase = applyLegacyEnemyScaling(matkBase, scaleFactor);
      }

      if (ai.difficulty === "EASY" && round > 30) {
        const scaleFactor = 1 + (round - 30) * 0.05;
        hpBase = applyLegacyEnemyScaling(hpBase, scaleFactor);
        atkBase = applyLegacyEnemyScaling(atkBase, scaleFactor);
        matkBase = applyLegacyEnemyScaling(matkBase, scaleFactor);
      }
    }

    if (ai.difficulty === "TUTORIAL" && round <= 8) {
      hpBase = Math.max(1, Math.round(hpBase * 0.5));
    }
  }

  const teamHpPct = player?.teamHpPct || 0;
  const teamAtkPct = player?.teamAtkPct || 0;
  const teamMatkPct = player?.teamMatkPct || 0;
  const teamDefPct = player?.teamDefPct || 0;
  const teamMdefPct = player?.teamMdefPct || 0;

  return {
    maxHp: side === "LEFT" ? Math.round(hpBase * (1 + teamHpPct)) : hpBase,
    atk: side === "LEFT" ? Math.round(atkBase * (1 + teamAtkPct)) : atkBase,
    matk: side === "LEFT" ? Math.round(matkBase * (1 + teamMatkPct)) : matkBase,
    def: side === "LEFT" && includeDefenseAugments
      ? Math.round(baseStats.def * (1 + teamDefPct))
      : baseStats.def,
    mdef: side === "LEFT" && includeDefenseAugments
      ? Math.round(baseStats.mdef * (1 + teamMdefPct))
      : baseStats.mdef
  };
}

function createCombatUnitMods({ descriptor, side, player }: { descriptor: CombatUnitDescriptorLike; side: "LEFT" | "RIGHT"; player: PlayerAugments | null | undefined }) {
  const { base, baseStats, basicAttackProfile } = descriptor;
  return {
    ...DEFAULT_MODS,
    lifestealPct: side === "LEFT" ? player?.lifestealPct || 0 : 0,
    rageGainPct: side === "LEFT" ? player?.rageGainPct || 0 : 0,
    critPct: (baseStats.critRate ?? getBaseCritRate(base.classType as string)) + (side === 'LEFT' ? player?.teamCritPct || 0 : 0),
    evadePct: baseStats.evasion ?? getBaseEvasion(base.classType as string),
    basicAttackType: basicAttackProfile.damageType,
    basicAttackScaleStat: basicAttackProfile.scaleStat,
    basicAttackDelivery: basicAttackProfile.delivery
  };
}


function createCombatUnitStatuses() {
  return { ...DEFAULT_STATUSES };
}

export function createCombatUnitRecord({
  descriptor,
  side,
  row,
  col,
  player,
  statLine,
  name,
  uiRefs = {}
}: {
  descriptor: CombatUnitDescriptorLike;
  side: "LEFT" | "RIGHT";
  row: number;
  col: number;
  player: PlayerAugments | null | undefined;
  statLine: { maxHp: number; atk: number; matk: number; def: number; mdef: number } | null;
  name?: string;
  uiRefs?: Record<string, unknown>;
}) {
  if (!descriptor?.base || !statLine) return null;

  const { owned, base, star, baseStats, skillCost } = descriptor;
  const unitName = name || base.name;
  return {
    uid: owned.uid,
    baseId: owned.baseId ?? base.id,
    name: unitName,
    star,
    side,
    row,
    col,
    homeRow: row,
    homeCol: col,
    sandbox: owned?.sandbox === true,
    sourceUid: owned?.sourceUid ?? null,
    classType: base.classType,
    element: base.element ?? base.tribe,
    faction: base.faction ?? null,
    tribe: base.element ?? base.tribe,
    species: base.species,
    tier: base.tier ?? 1,
    skillId: getEffectiveSkillId(base.skillId as string, base.classType as string, star, SKILL_LIBRARY),
    equips: Array.isArray(owned.equips) ? [...owned.equips] : [],
    maxHp: statLine.maxHp,
    hp: statLine.maxHp,
    atk: statLine.atk,
    def: statLine.def,
    matk: statLine.matk,
    mdef: statLine.mdef,
    range: baseStats.range,
    rageMax: skillCost ?? baseStats.rageMax,
    rage: side === "LEFT" ? player?.startingRage || 0 : 0,
    shield: side === "LEFT" ? player?.startingShield || 0 : 0,
    alive: true,
    ...uiRefs,
    mods: createCombatUnitMods({ descriptor, side, player }),
    environmentMods: createEnvironmentMods(),
    statuses: createCombatUnitStatuses(),
    statusSources: {}
  };
}

interface VariantTrait {
  id: string;
  name: string;
  bonus?: unknown;
}

export function applyOwnedVariantTraitsToCombatUnit(
  unit: (Record<string, unknown> & { variantTraits?: string[]; variantTraitCount?: number; skillVariant?: string }) | null,
  owned: OwnedUnitLike | null | undefined,
  handlers: {
    getUnitVariantTraits?: (owned: OwnedUnitLike | null | undefined) => Array<VariantTrait | null | undefined>;
    applyBonusToUnit?: (unit: Record<string, unknown>, bonus: unknown) => void;
  } = {}
) {
  if (!unit) return [];

  const getUnitVariantTraits = handlers.getUnitVariantTraits;
  const applyBonusToUnit = handlers.applyBonusToUnit;
  const variantTraits: VariantTrait[] = typeof getUnitVariantTraits === "function"
    ? getUnitVariantTraits(owned).filter((trait): trait is VariantTrait => Boolean(trait))
    : [];

  unit.variantTraits = variantTraits.map((trait) => trait.id);
  unit.variantTraitCount = variantTraits.length;

  if (variantTraits.length > 0) {
    unit.skillVariant = variantTraits[0].name;
    variantTraits.forEach((trait) => {
      if (trait.bonus && typeof applyBonusToUnit === "function") {
        applyBonusToUnit(unit, trait.bonus);
      }
    });
  }

  return variantTraits;
}
