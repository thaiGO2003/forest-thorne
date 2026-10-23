import { ELEMENT_COUNTER } from "../data/synergies.js";
import {
  getEffectiveAtk,
  getEffectiveDef,
  getEffectiveMatk,
  getEffectiveMdef
} from "./combatCalc.js";

export interface CritPolicy {
  allowPhysicalCrit: boolean;
  allowMagicCrit: boolean;
  allowTrueCrit: boolean;
  allowEffectCrit: boolean;
  critMultiplier: number;
  ignoreDefOnCrit: boolean;
  ignoreMdefOnCrit: boolean;
}

export const DEFAULT_CRIT_POLICY: CritPolicy = Object.freeze({
  allowPhysicalCrit: true,
  allowMagicCrit: true,
  allowTrueCrit: false,
  allowEffectCrit: false,
  critMultiplier: 1.5,
  ignoreDefOnCrit: true,
  ignoreMdefOnCrit: true
});

type DamageType = "physical" | "magic" | "true";
type BasicAttackVisualMode = "contact" | "projectile" | "beam";
type MeleeAssassinSkillAttackStyle = "contact" | "anchored_extension" | "short_spray";
type DeliveryType = "melee" | "projectile" | "instant";

const VALID_DAMAGE_TYPES: ReadonlySet<string> = new Set(["physical", "magic", "true"]);
const VALID_BASIC_ATTACK_VISUAL_MODES: ReadonlySet<string> = new Set(["contact", "projectile", "beam"]);
const VALID_MELEE_ASSASSIN_SKILL_ATTACK_STYLES: ReadonlySet<string> = new Set(["contact", "anchored_extension", "short_spray"]);
export const BASIC_ATTACK_ROLL_MIN = -5;
export const BASIC_ATTACK_ROLL_MAX = 5;

const BASIC_ATTACK_VISUAL_MODES: Record<DeliveryType, BasicAttackVisualMode> = Object.freeze({
  melee: "contact",
  projectile: "projectile",
  instant: "beam"
});

const MELEE_ASSASSIN_SKILL_ATTACK_STYLES: Record<string, MeleeAssassinSkillAttackStyle> = Object.freeze({
  bat_blood: "contact",
  chameleon_stealth: "contact",
  cobra_venom: "short_spray",
  ferret_shadow: "contact",
  fox_flame: "contact",
  lynx_echo: "contact",
  mantis_blade: "contact",
  mink_silent: "contact",
  mosquito_toxic: "contact",
  panther_void: "contact",
  raven_death: "contact",
  reaper_void: "contact",
  scorpion_shadow: "anchored_extension",
  spider_venom: "contact",
  viper_strike: "contact",
  vulture_scavunge: "contact",
  wasp_assassin: "contact",
  weasel_quick: "contact",
  wolf_alpha: "contact",
  wraith_shadow: "contact"
});

function clampChance(value: unknown): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value as number));
}

function clampMultiplier(value: unknown, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
  return value as number;
}

interface Attacker {
  atk?: number;
  matk?: number;
  star?: number;
  mods?: {
    critPct?: number;
    basicAttackType?: string;
    basicAttackScaleStat?: string;
    basicAttackDelivery?: DeliveryType;
  };
  environmentMods?: {
    critPct?: number;
  };
  classType?: string;
  base?: {
    classType?: string;
    attackDef?: { delivery?: DeliveryType };
    stats?: { range?: number };
  };
  attackDef?: { delivery?: DeliveryType };
  basicAttackDelivery?: DeliveryType;
  visual?: { basicAttackDelivery?: DeliveryType };
  range?: number;
  stats?: { range?: number };
}

function getSourceStat(attacker: Attacker | null, scaleStat: string): number {
  if (scaleStat === "atk") return getEffectiveAtk(attacker as Parameters<typeof getEffectiveAtk>[0]);
  if (scaleStat === "matk") return getEffectiveMatk(attacker as Parameters<typeof getEffectiveMatk>[0]);
  return attacker?.[scaleStat as keyof Attacker] as number ?? 0;
}

export function getCritPolicy(overrides: Partial<CritPolicy> | null = null): CritPolicy {
  return {
    ...DEFAULT_CRIT_POLICY,
    ...(overrides || {})
  };
}

export function mapBasicAttackDeliveryToVisualMode(delivery: string | undefined): BasicAttackVisualMode {
  return BASIC_ATTACK_VISUAL_MODES[delivery as DeliveryType] ?? "contact";
}

interface BasicAttackProfile {
  damageType: DamageType;
  scaleStat: string;
  delivery: DeliveryType;
}

export function getBasicAttackProfile(unit: Attacker | null): BasicAttackProfile {
  const classType = unit?.classType ?? unit?.base?.classType ?? null;
  const prefersMagic = classType === "MAGE" || classType === "SUPPORT";
  const configuredType = unit?.mods?.basicAttackType;
  const configuredScaleStat = unit?.mods?.basicAttackScaleStat;
  const configuredDelivery = unit?.mods?.basicAttackDelivery
    ?? unit?.attackDef?.delivery
    ?? unit?.base?.attackDef?.delivery
    ?? unit?.basicAttackDelivery
    ?? unit?.visual?.basicAttackDelivery;
  const configuredRange = unit?.range ?? unit?.stats?.range ?? unit?.base?.stats?.range ?? 1;

  return {
    damageType: configuredType === "magic" || configuredType === "physical"
      ? configuredType
      : prefersMagic
        ? "magic"
        : "physical",
    scaleStat: configuredScaleStat === "matk" || configuredScaleStat === "atk"
      ? configuredScaleStat
      : prefersMagic
        ? "matk"
        : "atk",
    delivery: configuredDelivery === "projectile" || configuredDelivery === "instant" || configuredDelivery === "melee"
      ? configuredDelivery
      : configuredRange >= 2
        ? "projectile"
        : "melee"
  };
}

export function getExpectedBasicAttackVisualMode(unit: Attacker | null): BasicAttackVisualMode {
  return mapBasicAttackDeliveryToVisualMode(getBasicAttackProfile(unit).delivery);
}

interface Visual {
  basicAttackMode?: BasicAttackVisualMode;
  basicAttackDelivery?: DeliveryType;
  skillAttackStyle?: MeleeAssassinSkillAttackStyle;
}

export function resolveBasicAttackVisualMode(unit: Attacker | null, visual: Visual | null = unit?.visual ?? null): BasicAttackVisualMode {
  const configuredMode = visual?.basicAttackMode;
  if (VALID_BASIC_ATTACK_VISUAL_MODES.has(configuredMode ?? "")) return configuredMode!;

  const configuredDelivery = visual?.basicAttackDelivery;
  if (configuredDelivery && BASIC_ATTACK_VISUAL_MODES[configuredDelivery as DeliveryType]) {
    return BASIC_ATTACK_VISUAL_MODES[configuredDelivery as DeliveryType];
  }

  return getExpectedBasicAttackVisualMode(unit);
}

export function isBasicAttackVisualModeCompatible(unit: Attacker | null, visual: Visual | null = unit?.visual ?? null): boolean {
  return resolveBasicAttackVisualMode(unit, visual) === getExpectedBasicAttackVisualMode(unit);
}

interface UnitWithClassAndRange {
  classType?: string;
  base?: {
    classType?: string;
    stats?: { range?: number };
  };
  range?: number;
  stats?: { range?: number };
  baseId?: string;
  id?: string;
}

export function isMeleeAssassinUnit(unit: UnitWithClassAndRange | null): boolean {
  const classType = unit?.classType ?? unit?.base?.classType ?? null;
  const range = unit?.range ?? unit?.stats?.range ?? unit?.base?.stats?.range ?? 1;
  return classType === "ASSASSIN" && range <= 1;
}

export function getExpectedSkillAttackStyle(unit: UnitWithClassAndRange | null): MeleeAssassinSkillAttackStyle | null {
  if (!isMeleeAssassinUnit(unit)) return null;
  const unitId = unit?.baseId ?? (unit as { id?: string })?.id ?? (unit as { base?: { id?: string } })?.base?.id ?? null;
  return MELEE_ASSASSIN_SKILL_ATTACK_STYLES[unitId ?? ""] ?? "contact";
}

export function resolveSkillAttackStyle(unit: UnitWithClassAndRange | null, visual: Visual | null = (unit as { visual?: Visual })?.visual ?? null): MeleeAssassinSkillAttackStyle | null {
  const configuredStyle = visual?.skillAttackStyle;
  if (VALID_MELEE_ASSASSIN_SKILL_ATTACK_STYLES.has(configuredStyle ?? "")) return configuredStyle!;
  return getExpectedSkillAttackStyle(unit);
}

export function isSkillAttackStyleCompatible(unit: UnitWithClassAndRange | null, visual: Visual | null = (unit as { visual?: Visual })?.visual ?? null): boolean {
  if (!isMeleeAssassinUnit(unit)) return true;
  const configuredStyle = visual?.skillAttackStyle;
  return VALID_MELEE_ASSASSIN_SKILL_ATTACK_STYLES.has(configuredStyle ?? "")
    && configuredStyle === resolveSkillAttackStyle(unit, visual);
}

interface Skill {
  scaleStat?: string;
  base?: number;
  scale?: number;
  damageType?: DamageType;
}

interface GameState {
  player?: {
    gold?: number;
  };
}

interface ActionBaseDamageResult {
  rawDamage: number;
  damageType: DamageType;
  scaleStat: string;
  starSkillMult?: number;
  goldMultiplier?: number;
}

export function calculateActionBaseDamage(attacker: Attacker | null, skill: Skill | null, state: GameState | null): ActionBaseDamageResult {
  if (!attacker) {
    return {
      rawDamage: 0,
      damageType: "physical",
      scaleStat: "atk"
    };
  }

  if (skill) {
    const scaleStat = skill.scaleStat || "atk";
    const sourceStat = getSourceStat(attacker, scaleStat);
    const attackerStar = attacker.star ?? 1;
    const starSkillMult = attackerStar >= 3 ? 1.4 : attackerStar === 2 ? 1.2 : 1;

    let goldMultiplier = 1;
    if (state?.player?.gold !== undefined) {
      const gold = state.player.gold;
      if (gold >= 100) {
        goldMultiplier = 1 + Math.floor((gold - 100) / 10) * 0.01;
      }
    }

    return {
      rawDamage: Math.round(((skill.base ?? 0) + sourceStat * (skill.scale ?? 0)) * starSkillMult * goldMultiplier),
      damageType: skill.damageType || "physical",
      scaleStat,
      starSkillMult,
      goldMultiplier
    };
  }

  const basicAttack = getBasicAttackProfile(attacker);
  return {
    rawDamage: basicAttack.scaleStat === "matk" ? getEffectiveMatk(attacker as Parameters<typeof getEffectiveMatk>[0]) : getEffectiveAtk(attacker as Parameters<typeof getEffectiveAtk>[0]),
    damageType: basicAttack.damageType,
    scaleStat: basicAttack.scaleStat
  };
}

interface Defender {
  classType?: string;
  element?: string;
  tribe?: string;
  statuses?: {
    fireVulnerabilityTurns?: number;
    fireVulnerabilityMultiplier?: number;
    armorBreakTurns?: number;
    armorBreakValue?: number;
  };
  environmentMods?: {
    fireVulnerabilityMultiplier?: number;
  };
}

interface CounterMap {
  [element: string]: string | null;
}

interface ResolveDamageParams {
  attacker: Attacker | null;
  defender: Defender | null;
  rawDamage?: number;
  damageType?: DamageType;
  attackKind?: string;
  critPolicy?: Partial<CritPolicy> | null;
  armorPen?: number;
  globalDamageMult?: number;
  counterMap?: CounterMap;
  getEffectiveDefFn?: (defender: Defender | null) => number;
  getEffectiveMdefFn?: (defender: Defender | null) => number;
  randomFn?: () => number;
}

interface DamageResult {
  damageType: DamageType;
  attackKind: string;
  rawDamage: number;
  rawAfterElement: number;
  rawAfterCrit: number;
  rawAfterFireVulnerability: number;
  elementalMult: number;
  elementalOutcome: string | null;
  isCrit: boolean;
  critSource: string | null;
  defenseIgnored: boolean;
  effectiveDef: number | null;
  effectiveMdef: number | null;
  mitigatedDamage: number;
  globalDamageMult: number;
  finalDamage: number;
}

export function resolveDamageAmount({
  attacker,
  defender,
  rawDamage = 0,
  damageType = "physical",
  attackKind = "basic",
  critPolicy = null,
  armorPen = 0,
  globalDamageMult = 1,
  counterMap = ELEMENT_COUNTER,
  getEffectiveDefFn = (target) => getEffectiveDef(target as Parameters<typeof getEffectiveDef>[0]),
  getEffectiveMdefFn = (target) => getEffectiveMdef(target as Parameters<typeof getEffectiveMdef>[0]),
  randomFn = Math.random
}: ResolveDamageParams): DamageResult {
  const normalizedDamageType: DamageType = VALID_DAMAGE_TYPES.has(damageType) ? damageType : "physical";
  const normalizedRawDamage = Number.isFinite(rawDamage) ? rawDamage : 0;
  const normalizedArmorPen = clampChance(armorPen);
  const normalizedGlobalDamageMult = clampMultiplier(globalDamageMult, 1);
  const policy = getCritPolicy(critPolicy);

  let baseRawDamage = Math.max(1, normalizedRawDamage);
  let elementalMult = 1;
  let elementalOutcome: string | null = null;

  const attackerElement = (attacker as { element?: string; tribe?: string })?.element ?? (attacker as { element?: string; tribe?: string })?.tribe;
  const defenderElement = defender?.element ?? defender?.tribe;
  if (attackerElement && defenderElement && counterMap?.[attackerElement] === defenderElement) {
    if (defender?.classType === "TANKER") {
      elementalMult = 0.5;
      elementalOutcome = "resisted_by_tanker";
    } else if ((attacker as { classType?: string })?.classType !== "TANKER") {
      elementalMult = 1.5;
      elementalOutcome = "advantage";
    }
  }

  const rawAfterElement = Math.max(1, baseRawDamage * elementalMult);

  const allowCritForDamageType =
    normalizedDamageType === "physical" ? policy.allowPhysicalCrit :
    normalizedDamageType === "magic" ? policy.allowMagicCrit :
    policy.allowTrueCrit;
  const allowCritForAttackKind = attackKind !== "effect" || policy.allowEffectCrit;
  const critChance = clampChance(
    (Number(attacker?.mods?.critPct) || 0)
    + (Number(attacker?.environmentMods?.critPct) || 0)
  );
  const canCrit = Boolean(attacker) && critChance > 0 && allowCritForDamageType && allowCritForAttackKind;
  const isCrit = canCrit && randomFn() < critChance;
  const rawAfterCrit = isCrit ? rawAfterElement * policy.critMultiplier : rawAfterElement;
  const statusFireVulnerabilityMult =
    attackerElement === "FIRE" && (defender?.statuses?.fireVulnerabilityTurns ?? 0) > 0
      ? Math.max(1, Number(defender?.statuses?.fireVulnerabilityMultiplier ?? 1) || 1)
      : 1;
  const environmentFireVulnerabilityMult =
    attackerElement === "FIRE"
      ? Math.max(1, Number(defender?.environmentMods?.fireVulnerabilityMultiplier ?? 1) || 1)
      : 1;
  const fireVulnerabilityMult = Math.max(statusFireVulnerabilityMult, environmentFireVulnerabilityMult);
  const rawAfterFireVulnerability = rawAfterCrit * fireVulnerabilityMult;

  let defenseIgnored = false;
  let effectiveDef: number | null = null;
  let effectiveMdef: number | null = null;
  let mitigatedDamage = rawAfterFireVulnerability;

  if (normalizedDamageType === "physical") {
    const armorBreak = defender?.statuses?.armorBreakTurns! > 0 ? (defender?.statuses?.armorBreakValue ?? 0) : 0;
    effectiveDef = Math.max(0, getEffectiveDefFn(defender as Parameters<typeof getEffectiveDefFn>[0]) - armorBreak);
    if (isCrit && policy.ignoreDefOnCrit) {
      defenseIgnored = true;
    } else {
      mitigatedDamage = rawAfterFireVulnerability * (100 / (100 + effectiveDef * (1 - normalizedArmorPen)));
    }
  } else if (normalizedDamageType === "magic") {
    effectiveMdef = Math.max(0, getEffectiveMdefFn(defender as Parameters<typeof getEffectiveMdefFn>[0]));
    if (isCrit && policy.ignoreMdefOnCrit) {
      defenseIgnored = true;
    } else {
      mitigatedDamage = rawAfterFireVulnerability * (100 / (100 + effectiveMdef));
    }
  }

  const finalDamage = Math.max(1, Math.round(mitigatedDamage * normalizedGlobalDamageMult));

  return {
    damageType: normalizedDamageType,
    attackKind,
    rawDamage: baseRawDamage,
    rawAfterElement,
    rawAfterCrit,
    rawAfterFireVulnerability,
    elementalMult,
    elementalOutcome,
    isCrit,
    critSource: isCrit ? attackKind : null,
    defenseIgnored,
    effectiveDef,
    effectiveMdef,
    mitigatedDamage,
    globalDamageMult: normalizedGlobalDamageMult,
    finalDamage
  };
}
