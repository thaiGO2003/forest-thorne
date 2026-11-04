// Deterministic combat engine (spec A11–A18, A73, A74, A120). Pure: no rendering, timers or audio.
// Presentation replays `events` in order; HP/status changes are already resolved per event.
import { getUnit, type Element, type Faction, type Role } from "../content/catalog";
import { STAR_EFFECT_CHANCE, STAR_SKILL, STAR_STAT } from "./economy";
import { BLOOD_SWORD_OATH_FAMILY, ELEPHANT_TIDE_FAMILY, FROST_STORM_FAMILY, GRASS_STORM_FAMILY, HARD_BEAK_DIVE_FAMILY, KIRIN_HORNS_FAMILY, LOVE_KISS_FAMILY, SPIDER_SOUL_FAMILY, SPORE_FAMILY, skillSpec, type BuffStat, type DamageType, type SkillSelector, type SkillSpec, type Stat, type StatMod } from "./skills";
import { CLASS_COUNTER, COUNTER_BONUS, ELEMENT_COUNTER } from "./synergy";
import { environmentMods, type EnvironmentId, type EnvMods } from "./environment";
import { slotCapForUnit, sumEquipmentBonuses } from "./equipment";
import {
  EMPTY_EQUIPMENT_LOGIC, logicDamageMultiplier, resolveEquipmentLogic, rollSkillProc, type ResolvedEquipmentLogic,
} from "./equipmentLogic";
import type { EquipmentBonuses } from "./itemRegistry";
import { sumVariantBonuses, type VariantBonuses, type VariantTraitRef } from "./variants";
import type { WeatherBlessingId } from "./blessings";

export type Side = "L" | "R";
export const COLS = 10;
export const ROWS = 5;
const CYCLE_CAP = 20;
const ROLE_EVADE: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.08, ASSASSIN: 0.15, ARCHER: 0.1, MAGE: 0.05, SUPPORT: 0.07 };
const ROLE_CRIT: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.05, ASSASSIN: 0.25, ARCHER: 0.2, MAGE: 0.1, SUPPORT: 0.05 };
const REFLECT_OFFENSE_STAT: Record<Role, BuffStat> = {
  TANKER: "atk", ASSASSIN: "atk", ARCHER: "atk", MAGE: "matk", SUPPORT: "matk", FIGHTER: "atk",
};

export function reflectOffenseStat(role: Role): BuffStat {
  return REFLECT_OFFENSE_STAT[role];
}
const STAR_DOT = [0, 1, 1.3, 1.6];
const CONTROL_PRIORITY = ["freeze", "stun", "sleep", "paralyze"] as const;
const DOTS = ["burn", "poison", "bleed", "disease"] as const;
const CLEANSEABLE_STATUSES = new Set<string>([
  ...DOTS, ...CONTROL_PRIORITY, "silence", "disarm", "taunt", "fireVulnerability", "healBlock", "slow",
]);
const TIDE_SHIELD_PREFIX = "elephantTideShield:";

interface Mod extends StatMod { stackKey?: string }

export interface SkillStatusSource {
  skillId: string;
  unitUid: string;
  unitBaseId: string;
  unitStar: number;
  turns: number;
  value: number;
}

export interface TimedStatus {
  turns: number;
  value: number;
  /** Damage-triggered thaw, not turn expiry (Sương Điệp 3★ only). */
  permanent?: boolean;
  source?: SkillStatusSource;
  /** Next shared cycle that removes a one-round Elephant Tide shield. */
  expiresCycle?: number;
}

export interface ReflectReactionState {
  pctByDamageType: Partial<Record<DamageType, number>>;
  turns: number;
  offenseDebuff?: { value: number; turns: number; mode: "autoByRole" };
}

export interface PhoenixReactionState {
  armed: boolean;
  used: boolean;
  revivePct: number;
}

export interface BerserkReactionState {
  turns: number;
  lifestealPct: number;
  firstBasicMultiplier: number;
  firstBasicPending: boolean;
  rageOnKill: number;
  extendTurnsOnKill: number;
  chainedBasicsOnKill: number;
  atkBuffStackKey: string;
}

type SkillStatusOrigin = Omit<SkillStatusSource, "turns" | "value">;

export interface Fighter {
  uid: string; baseId: string; star: number; side: Side; row: number; col: number;
  role: Role; element: Element; faction: Faction; species: string;
  basicDamageType: "physical" | "magic";
  skillFamily: string;
  skill: SkillSpec;
  maxHp: number; hp: number; atk: number; def: number; matk: number; mdef: number;
  range: number; rageMax: number; rage: number; shield: number; alive: boolean;
  crit: number; critDmg: number; accuracy: number; evade: number; lifesteal: number; rageGainPct: number; healPct: number;
  onHitBurn: number; onHitPoison: number;
  /** Timed statuses: control kinds + DoT kinds; DoTs carry per-tick value and optional skill provenance. */
  status: Record<string, TimedStatus>;
  mods: Mod[];
  /** Uid of the unit that taunted this fighter while `status.taunt` is active. */
  tauntBy: string | null;
  /** Re-entrancy guard: TANKER auto-cast cannot recurse inside its own skill. */
  casting: boolean;
  reflect: ReflectReactionState | null;
  counterTurns: number;
  phoenix: PhoenixReactionState;
  berserk: BerserkReactionState | null;
  /** Oath resolves at the next shared cycle, not at cast impact. */
  oath: { cycle: number; star: number } | null;
  /** Wind hook effects are scoped to the current shared combat cycle. */
  hookOffense?: { cycle: number; multiplier: number };
  hookGuardCycle?: number;
  /** A32 environment mods read at the owning event (vulnerability, heal received, accuracy, aura). */
  env: EnvMods;
  /** Authored equipment logic resolved from the equipped item ids (issue #31). */
  logic: ResolvedEquipmentLogic;
}

/** Snapshot the one-round recovery contract when cloning fighters. */
export function cloneFighter(fighter: Fighter): Fighter {
  return {
    ...fighter,
    status: Object.fromEntries(Object.entries(fighter.status).map(([key, status]) => [
      key,
      { ...status, source: status.source ? { ...status.source } : undefined },
    ])),
    mods: fighter.mods.map((mod) => ({ ...mod })),
    reflect: fighter.reflect ? {
      ...fighter.reflect,
      pctByDamageType: { ...fighter.reflect.pctByDamageType },
      offenseDebuff: fighter.reflect.offenseDebuff ? { ...fighter.reflect.offenseDebuff } : undefined,
    } : null,
    phoenix: { ...fighter.phoenix },
    berserk: fighter.berserk ? { ...fighter.berserk } : null,
    oath: fighter.oath ? { ...fighter.oath } : null,
    env: { ...fighter.env },
    logic: { ...fighter.logic },
  };
}


/** Staged start-of-combat bonuses from persistent state or final-formation synergy. */
export type SideBonus = Partial<Record<
  "def" | "mdef" | "atkPct" | "matkPct" | "hpPct" | "defPct" | "mdefPct" | "healPct" | "startShield" | "startRage"
  | "burn" | "poison" | "critPct" | "evadePct" | "lifestealPct" | "rageGainPct", number>>;

export function sumSideBonuses(...parts: readonly SideBonus[]): SideBonus {
  const out: SideBonus = {};
  for (const part of parts) {
    for (const [rawKey, rawValue] of Object.entries(part)) {
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) continue;
      const key = rawKey as keyof SideBonus;
      out[key] = (out[key] ?? 0) + rawValue;
    }
  }
  return out;
}

export interface Placement {
  uid: string; baseId: string; star: number; row: number; col: number;
  equips?: string[];
  traits?: VariantTraitRef[];
}

export type CombatEvent =
  | { t: "cycle"; cycle: number }
  | { t: "empty"; side: Side; row: number; col: number }
  | { t: "basic" | "skill"; src: string; dst: string; dmg: number; absorbed: number; crit: boolean; kind?: "kiss" | "batling" | "grass" | "soul" | "horn" }
  | { t: "reflect"; src: string; dst: string; dmg: number; absorbed: number }
  | { t: "miss"; src: string; dst: string }
  | { t: "cast"; src: string; targets: string[]; trigger?: "TANKER" | "SUPPORT" }
  | { t: "hookPull"; src: string; dst: string; row: number; col: number }
  | { t: "dot"; dst: string; kind: string; dmg: number }
  | { t: "heal"; src: string; dst: string; amount: number }
  | { t: "shield"; src: string; dst: string; amount: number }
  /** Elephant Tide shield replacement and one-time cleanse resolve together at visual impact. */
  | { t: "tideGuard"; src: string; dst: string; delta: number; active: boolean; removed: string[] }
  | { t: "status"; dst: string; kind: string; turns: number; permanent?: boolean; source?: SkillStatusSource }
  | { t: "revive"; src: string; dst: string; hp: number }
  | { t: "skip"; src: string; reason: string }
  | { t: "death"; dst: string }
  /** Sword oath: transient debuff suppression begins/ends within one cast animation. */
  | { t: "oath"; dst: string; suppressed: string[]; active: boolean }
  /** Spore mist cast: pools land on these enemy-half cells (presented at the skill impact). */
  | { t: "sporeThrow"; src: string; cells: SporeCell[]; cycles: number }
  /** Cycle start: an enemy standing on owner's pool gave it a point; points is the new total. */
  | { t: "sporePoint"; owner: string; dst: string; row: number; col: number; points: number }
  /** Cycle end: owner detonated points; its pools on cells are consumed. Damage follows as skill events. */
  | { t: "sporeBurst"; owner: string; cells: SporeCell[]; points: number }
  /** Pools that reached the end of their lifetime without detonating. */
  | { t: "sporeExpire"; owner: string; cells: SporeCell[] };

export interface SporeCell { row: number; col: number }

export interface CombatResult {
  winner: Side | null;
  alive: Record<Side, number>;
  total: Record<Side, number>;
  /** Assassin last-hit bounty, paid even on loss (A14/A18). */
  bounty: Record<Side, number>;
  bountyKills: Record<Side, number>;
  actions: number;
  events: CombatEvent[];
  /** Immutable-by-convention snapshots of every resolved combatant, including dead units. */
  fighters: Fighter[];
  survivors: Fighter[];
  /** Ordered weather blessings consumed at surviving-cycle boundaries. */
  consumedBlessings: WeatherBlessingId[];
  /** Optional read-only action boundaries for presentation; never saved as run state. */
  inspectionFrames?: CombatInspectionFrame[];
}

export interface CombatUnitSnapshot {
  uid: string;
  hp: number; maxHp: number; atk: number; matk: number; def: number; mdef: number;
  atkBeforePassive: number;
  rage: number; rageMax: number; shield: number; range: number;
  evade: number; crit: number; accuracy: number; alive: boolean;
  lifesteal: number; healPct: number; rageGainPct: number; onHitBurn: number; onHitPoison: number;
  status: Record<string, TimedStatus>;
  mods: StatMod[];
  reflect: ReflectReactionState | null;
  counterTurns: number;
  phoenix: PhoenixReactionState;
  berserk: BerserkReactionState | null;
}

export interface CombatInspectionFrame {
  /** Exclusive event boundary: publish only after these events have finished animating. */
  eventIndex: number;
  cycle: number;
  units: CombatUnitSnapshot[];
}

export type CombatPreviewEffect = "damage" | "heal" | "shield" | "buff" | "debuff" | "control";
export interface CombatPreviewTag {
  uid: string;
  effect: CombatPreviewEffect;
  kind: "basic" | "skill";
  /** Primary target of the current action; secondary tags are area/secondary targets. */
  primary: boolean;
}

export interface CombatTargetPreview {
  /** Candidate cells inspected by basic/skill targeting; target colors render above these scan cells. */
  scanCells: Array<{ col: number; row: number }>;
  /** Direct target(s) for the single action the fighter would currently perform. */
  directUids: string[];
  /** Area/secondary targets for that same action, excluding the primary direct target. */
  splashUids: string[];
  /** Present only when the fighter would currently cast its authored skill. */
  skillCasterUid: string | null;
  /** Per-target semantic effect for hover preview colours/icons. */
  tags?: CombatPreviewTag[];
  /** Acting unit's role, used to pick the fist/basic and role-authored skill badges without owning presentation data. */
  actorRole?: Role;
  /** Cell-based skill area (may include empty cells), e.g. Sương Độc covering the whole enemy half. */
  areaCells?: Array<{ col: number; row: number; effect: CombatPreviewEffect }>;
}

export interface CombatOptions {
  seed: number;
  captureInspection?: boolean;
  /** Owner gold per side for the A13 gold-reserve skill multiplier. */
  gold?: Partial<Record<Side, number>>;
  /** Basic-hit attacker rage per side; AI difficulty sets R (A74). */
  rageGain?: Partial<Record<Side, number>>;
  /** A32 active battlefield environment for this round. */
  environment?: EnvironmentId;
  /** Immutable snapshot of the player's ordered weather blessing queue. */
  orderedBlessings?: readonly WeatherBlessingId[];
  /** A102 RIGHT-side AI random-target pressure; caller supplies the normalized profile chance. */
  rightRandomTargetChance?: number;
  /** A102 deterministic targeting disables RIGHT-side random-target pressure without disabling combat RNG. */
  deterministicTargeting?: boolean;
}

export interface RightMaterializationScale {
  hp: number;
  atk: number;
  matk: number;
}

export interface CombatMaterializationOptions {
  /** A77 stage 2. AI multipliers are applied before mode scaling. */
  rightAi?: RightMaterializationScale;
  /** A77 stage 2. Caller passes 1 for Creative/manual formations. */
  rightModeScale?: number;
  /** A77 stage 2. Tutorial rounds 1..8 halve already-resolved RIGHT HP. */
  tutorialRightHpHalving?: boolean;
  /** A77 stage 3. Persistent run/augment/technology state, LEFT only. */
  leftPersistent?: SideBonus;
  /** A77 stage 7. One environment identity shared by the formation. */
  environment?: EnvironmentId;
  /** A77 stage 8. Final-formation synergy, kept separate from persistent state. */
  synergy?: Partial<Record<Side, SideBonus>>;
}

/** A13: 1.0 at ≤10 gold; +1% per 2 gold above 10; capped at 2.0. */
export function goldMultiplier(gold: number): number {
  if (!(gold > 10)) return 1;
  return Math.min(2, 1 + (gold - 10) / 2 / 100);
}

interface OpeningResources { rage: number; shield: number }

const finite = (value: number | undefined, fallback = 0) => Number.isFinite(value) ? value! : fallback;
const scalePct = (value: number, pct: number | undefined) => Math.round(value * (1 + finite(pct) / 100));

function freshFighter(p: Placement, side: Side): Fighter {
  const u = getUnit(p.baseId);
  const star = Math.max(1, Math.min(3, Math.round(Number.isFinite(p.star) ? p.star : 1)));
  const m = STAR_STAT[star] ?? 1;
  const st = u.stats;
  const resolvedSkill = skillSpec(p.baseId, star);
  const authoredCost = u.skill.rageCost[star - 1];
  const rageMax = Number.isFinite(authoredCost) ? Math.max(1, authoredCost!) : Number.isFinite(st.rageMax) ? Math.max(1, st.rageMax!) : 3;
  const maxHp = Math.max(1, Math.round(st.hp * m));
  return {
    uid: p.uid, baseId: p.baseId, star, side, row: p.row, col: p.col,
    role: u.role, element: u.element, faction: u.faction, species: u.species,
    basicDamageType: u.basic.damageType, skillFamily: u.skill.family, skill: resolvedSkill,
    maxHp, hp: maxHp,
    atk: Math.max(1, Math.round(st.atk * m)),
    def: Math.round(st.def * m),
    matk: Math.max(1, Math.round(st.matk * m)),
    mdef: Math.round(st.mdef * m),
    range: st.range, rageMax, rage: 0, shield: 0, alive: true,
    crit: ROLE_CRIT[u.role] + (st.crit ?? 0),
    critDmg: st.critDmg ?? 1.5,
    accuracy: st.accuracy ?? 0.95,
    evade: Math.min(0.6, ROLE_EVADE[u.role] + (st.evade ?? 0) + (star - 1) * 0.05),
    lifesteal: 0, rageGainPct: 0, healPct: 0, onHitBurn: 0, onHitPoison: 0,
    status: {}, mods: [], tauntBy: null, casting: false,
    reflect: null, counterTurns: 0, phoenix: { armed: false, used: false, revivePct: 0.3 }, berserk: null, oath: null,
    env: environmentMods(undefined, u.element),
    logic: { ...EMPTY_EQUIPMENT_LOGIC },
  };
}

function applyStatBonus(f: Fighter, b: SideBonus | undefined) {
  if (!b) return;
  f.maxHp = Math.max(1, scalePct(f.maxHp, b.hpPct)); f.hp = f.maxHp;
  f.atk = Math.max(1, scalePct(f.atk, b.atkPct));
  f.matk = Math.max(1, scalePct(f.matk, b.matkPct));
  f.def = scalePct(f.def, b.defPct) + finite(b.def);
  f.mdef = scalePct(f.mdef, b.mdefPct) + finite(b.mdef);
  f.healPct += finite(b.healPct) / 100;
  f.crit += finite(b.critPct) / 100;
  f.evade += finite(b.evadePct) / 100;
  f.lifesteal = Math.max(0, f.lifesteal + finite(b.lifestealPct) / 100);
  f.rageGainPct += finite(b.rageGainPct) / 100;
  f.onHitBurn += finite(b.burn);
  f.onHitPoison += finite(b.poison);
}

function applyPersistentBonus(f: Fighter, b: SideBonus | undefined) {
  applyStatBonus(f, b);
  f.rage = Math.min(f.rageMax, Math.max(0, Math.round(finite(b?.startRage))));
  f.shield = Math.max(0, finite(b?.startShield));
}

function queueOpening(b: SideBonus | undefined, opening: OpeningResources) {
  opening.rage += finite(b?.startRage);
  opening.shield += finite(b?.startShield);
}

function applyEquipment(f: Fighter, b: EquipmentBonuses, opening: OpeningResources) {
  f.maxHp = Math.max(1, scalePct(f.maxHp, b.hpPct)); f.hp = f.maxHp;
  f.atk = Math.max(1, scalePct(f.atk, b.atkPct));
  f.matk = Math.max(1, scalePct(f.matk, b.matkPct));
  f.def += finite(b.def); f.mdef += finite(b.mdef);
  f.healPct += finite(b.healPct) / 100;
  f.crit += finite(b.critPct) / 100; f.evade += finite(b.evadePct) / 100;
  f.lifesteal = Math.max(0, f.lifesteal + finite(b.lifestealPct) / 100);
  f.onHitBurn += finite(b.burnOnHit); f.onHitPoison += finite(b.poisonOnHit);
  const equipmentRage = Math.min(4, Math.max(0, Math.round(finite(b.startingRage))));
  f.rage = Math.min(f.rageMax, f.rage + equipmentRage);
  opening.shield += Math.max(0, finite(b.startingShield));
}

/** Issue #31: authored `logic` payloads are resolved from the equipped ids, so removing an item
 * removes its effect and nothing is carried over between combats. */
function applyEquipmentLogic(f: Fighter, equips: readonly string[], opening: OpeningResources) {
  f.logic = resolveEquipmentLogic(equips);
  opening.shield += f.logic.startShield;
}

function applyVariants(f: Fighter, b: VariantBonuses, opening: OpeningResources) {
  f.maxHp = Math.max(1, scalePct(f.maxHp, b.hpPct)); f.hp = f.maxHp;
  f.atk = Math.max(1, scalePct(f.atk, b.atkPct));
  f.matk = Math.max(1, scalePct(f.matk, b.matkPct));
  f.def += finite(b.def); f.mdef += finite(b.mdef);
  f.healPct += finite(b.healPct) / 100;
  f.crit += finite(b.critPct) / 100; f.evade += finite(b.evadePct) / 100;
  f.lifesteal = Math.max(0, f.lifesteal + finite(b.lifestealPct) / 100);
  opening.rage += finite(b.startingRage);
  opening.shield += finite(b.startingShield);
}

function applyEnvironment(f: Fighter, environment: EnvironmentId | undefined, opening: OpeningResources) {
  const env = environmentMods(environment, f.element);
  f.env = env;
  f.atk = Math.max(1, Math.round(f.atk * (1 + env.atkPct)));
  f.matk = Math.max(1, Math.round(f.matk * (1 + env.matkPct)));
  f.def += env.def; f.mdef += env.mdef; f.evade += env.evade; f.crit += env.critPct;
  f.healPct += env.healPct; f.lifesteal = Math.max(0, f.lifesteal + env.lifesteal); f.rageGainPct += env.rageGainPct;
  f.onHitBurn += env.burnOnHit; f.onHitPoison += env.poisonOnHit;
  opening.rage += env.startRage; opening.shield += env.startShield;
}

interface MaterializationEntry {
  fighter: Fighter;
  placement: Placement;
  opening: OpeningResources;
}

/**
 * A77 authoritative battle-start materialization. Each persistent placement creates one Fighter; all later combat
 * systems mutate those exact records rather than rebuilding them from Planning state.
 */
export function materializeCombat(left: Placement[], right: Placement[], o: CombatMaterializationOptions = {}): Fighter[] {
  const entries: MaterializationEntry[] = [
    ...left.map((placement) => ({ fighter: freshFighter(placement, "L"), placement, opening: { rage: 0, shield: 0 } })),
    ...right.map((placement) => ({ fighter: freshFighter(placement, "R"), placement, opening: { rage: 0, shield: 0 } })),
  ];
  const ai = o.rightAi ?? { hp: 1, atk: 1, matk: 1 };
  const aiHp = Number.isFinite(ai.hp) && ai.hp > 0 ? ai.hp : 1;
  const aiAtk = Number.isFinite(ai.atk) && ai.atk > 0 ? ai.atk : 1;
  const aiMatk = Number.isFinite(ai.matk) && ai.matk > 0 ? ai.matk : 1;
  const modeScale = Number.isFinite(o.rightModeScale) && o.rightModeScale! > 0 ? o.rightModeScale! : 1;

  for (const { fighter: f } of entries) {
    if (f.side === "R") {
      f.maxHp = Math.max(1, Math.round(f.maxHp * aiHp));
      f.atk = Math.max(1, Math.round(f.atk * aiAtk));
      f.matk = Math.max(1, Math.round(f.matk * aiMatk));
      f.maxHp = Math.max(1, Math.round(f.maxHp * modeScale));
      f.atk = Math.max(1, Math.round(f.atk * modeScale));
      f.matk = Math.max(1, Math.round(f.matk * modeScale));
      if (o.tutorialRightHpHalving) f.maxHp = Math.max(1, Math.round(f.maxHp / 2));
      f.hp = f.maxHp;
    } else {
      applyPersistentBonus(f, o.leftPersistent);
    }
  }

  for (const { fighter: f, placement, opening } of entries) {
    const u = getUnit(f.baseId);
    applyEquipment(f, sumEquipmentBonuses(placement.equips ?? [], f.star, slotCapForUnit(u, f.star)), opening);
    applyEquipmentLogic(f, placement.equips ?? [], opening);
    applyVariants(f, sumVariantBonuses(f.role, placement.traits ?? []), opening);
  }
  for (const { fighter, opening } of entries) applyEnvironment(fighter, o.environment, opening);
  for (const { fighter, opening } of entries) {
    applyStatBonus(fighter, o.synergy?.[fighter.side]);
    queueOpening(o.synergy?.[fighter.side], opening);
  }
  for (const { fighter: f, opening } of entries) {
    const openingRage = Math.min(4, Math.max(0, Math.round(opening.rage)));
    f.rage = Math.min(f.rageMax, f.rage + openingRage);
    f.shield += Math.max(0, opening.shield);
  }
  return entries.map(({ fighter }) => fighter);
}

/** Isolated canonical materialization for planning/unit diagnostics. */
export function makeFighter(placement: Placement, side: Side, bonus: SideBonus = {}, environment?: EnvironmentId): Fighter {
  return materializeCombat(
    side === "L" ? [placement] : [],
    side === "R" ? [placement] : [],
    { environment, synergy: { [side]: bonus } },
  )[0]!;
}

const dist = (a: Fighter, b: Fighter) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
/** A11 row sweep: same row, above, below, two above, two below. */
const rowRank = (from: number, to: number) => {
  const d = to - from;
  return d === 0 ? 0 : d < 0 ? -2 * d - 1 : 2 * d;
};
/** Column distance from the front line of the defender's side (front = col 4 for L, 5 for R). */
const depth = (f: Fighter) => (f.side === "L" ? 4 - f.col : f.col - 5);

function modifiedStat(f: Fighter, s: BuffStat): number {
  const base = s === "evade" ? f.evade : f[s];
  let flat = 0;
  let pct = 0;
  for (const m of f.mods) if (m.stat === s) m.pct ? (pct += m.value) : (flat += m.value);
  return base * (1 + pct / 100) + (s === "evade" ? flat / 100 : flat);
}

function fighterHealthAttack(atk: number, maxHp: number, hp: number): number {
  const missingPct = Math.min(1, Math.max(0, (maxHp - hp) / Math.max(1, maxHp)));
  return Math.round(atk * (1 + missingPct));
}

export function combatStat(f: Fighter, s: BuffStat): number {
  let v = modifiedStat(f, s);
  // FIGHTER: +1% ATK per 1% missing HP (A14).
  if (s === "atk" && f.role === "FIGHTER") {
    v = fighterHealthAttack(v, f.maxHp, f.hp);
  }
  if (s === "evade") return Math.min(0.75, Math.max(0, v));
  return s === "atk" || s === "matk" ? Math.max(1, v) : Math.max(0, v);
}

/** Copy the actual resolved stats, including temporary modifiers and missing-HP passives. */
export function snapshotFighter(f: Fighter): CombatUnitSnapshot {
  return {
    uid: f.uid, hp: f.hp, maxHp: f.maxHp, atk: combatStat(f, "atk"), matk: combatStat(f, "matk"),
    atkBeforePassive: modifiedStat(f, "atk"),
    def: combatStat(f, "def"), mdef: combatStat(f, "mdef"), range: f.range,
    rage: f.rage, rageMax: f.rageMax, shield: f.shield, evade: combatStat(f, "evade"),
    crit: f.crit, accuracy: Math.max(0, f.accuracy + f.env.accuracy), alive: f.alive,
    lifesteal: f.lifesteal, healPct: f.healPct, rageGainPct: f.rageGainPct, onHitBurn: f.onHitBurn, onHitPoison: f.onHitPoison,
    status: structuredClone(f.status), mods: f.mods.map((mod) => ({ ...mod })),
    reflect: f.reflect ? structuredClone(f.reflect) : null, counterTurns: f.counterTurns,
    phoenix: { ...f.phoenix }, berserk: f.berserk ? { ...f.berserk } : null,
  };
}

/** Resource changes land during animations; keep health-dependent stats correct at that same impact. */
export function snapshotWithResources(snapshot: CombatUnitSnapshot, resources: Pick<CombatUnitSnapshot, "hp" | "maxHp" | "rage" | "rageMax" | "shield">, role: Role): CombatUnitSnapshot {
  const { hp, maxHp, rage, rageMax, shield } = resources;
  return {
    ...snapshot, hp, maxHp, rage, rageMax, shield,
    atk: role === "FIGHTER" ? Math.max(1, fighterHealthAttack(snapshot.atkBeforePassive, maxHp, hp)) : snapshot.atk,
    alive: hp > 0,
  };
}

type AutoCastRole = "TANKER" | "SUPPORT";

interface DeferredAutoCast {
  fighter: Fighter;
  role: AutoCastRole;
  preferred?: Fighter;
}

interface Ctx {
  all: Fighter[];
  rng: () => number;
  events: CombatEvent[];
  globalMult: number;
  gold: Record<Side, number>;
  rageGain: Record<Side, number>;
  rightRandomTargetChance: number;
  deterministicTargeting: boolean;
  bounty: Record<Side, number>;
  bountyKills: Record<Side, number>;
  deferredAutoCasts: DeferredAutoCast[];
  autoCastInFlight: Set<Fighter>;
  /** 1-based cycle currently resolving (0 before the first cycle, e.g. in previews). */
  cycle: number;
  spores: SporeState;
  /** Kiss counts are per caster and victim for this simulation only; batlings never update them. */
  kissHits: Map<string, Map<string, number>>;
  /** 3★ soul count is fixed before any round-start damage, per caster. */
  spiderRowCounts: Map<string, number>;
}

// ---------- Sương Độc spore pools (toad_spore_mist) ----------

/** Pools thrown per cast. */
export const SPORE_THROWS = 3;
/** Cycle-start ticks a pool lives for after the cycle it was thrown in. */
export const SPORE_CYCLES = 2;
/** Points needed for the end-of-cycle detonation. */
export const SPORE_BURST_POINTS = 5;
/** Damage per point: 10 + 0.25 × MATK (magic), before mitigation. */
export const SPORE_POINT_BASE = 10, SPORE_POINT_MATK = 0.25;
/** Self-heal as a fraction of the actual HP damage the detonation dealt. */
export const SPORE_HEAL_PCT = 0.5;
/** Per-throw chance (by star) to aim at an occupied cell instead of a uniformly random one. */
export const SPORE_OCCUPIED_BIAS: readonly number[] = [0, 0, 0.2, 0.4];

interface SporePool { owner: string; row: number; col: number; lastCycle: number }
interface SporePoint { victim: string; row: number; col: number }
interface SporeState { pools: SporePool[]; points: Map<string, SporePoint[]> }
const newSporeState = (): SporeState => ({ pools: [], points: new Map() });

const cellKey = (row: number, col: number) => row * COLS + col;

/** Every cell of the half opposite `side`. Sized from COLS/ROWS so a larger combat grid widens it. */
export function enemyHalfCells(side: Side): SporeCell[] {
  const half = Math.floor(COLS / 2);
  const from = side === "L" ? half : 0, to = side === "L" ? COLS : half;
  const cells: SporeCell[] = [];
  for (let col = from; col < to; col++) for (let row = 0; row < ROWS; row++) cells.push({ row, col });
  return cells;
}

const sporeOccupant = (c: Ctx, owner: Fighter, row: number, col: number) =>
  c.all.find((x) => x.alive && x.side !== owner.side && x.row === row && x.col === col);

/** Pick up to SPORE_THROWS distinct cells on the enemy half that hold none of the owner's active pools. */
function pickSporeCells(c: Ctx, f: Fighter): SporeCell[] {
  const taken = new Set(c.spores.pools.filter((p) => p.owner === f.uid).map((p) => cellKey(p.row, p.col)));
  const free = enemyHalfCells(f.side).filter((cell) => !taken.has(cellKey(cell.row, cell.col)));
  const bias = SPORE_OCCUPIED_BIAS[f.star] ?? 0;
  const chosen: SporeCell[] = [];
  for (let i = 0; i < SPORE_THROWS && free.length; i++) {
    const occupied = bias > 0 ? free.filter((cell) => sporeOccupant(c, f, cell.row, cell.col)) : [];
    const pool = occupied.length && c.rng() < bias ? occupied : free;
    const cell = pool[Math.floor(c.rng() * pool.length)]!;
    free.splice(free.indexOf(cell), 1);
    chosen.push(cell);
  }
  return chosen;
}

function castSporePools(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const cells = pickSporeCells(c, f);
  const targets = cells.flatMap((cell) => sporeOccupant(c, f, cell.row, cell.col)?.uid ?? []);
  const castEvent: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets };
  if (trigger) castEvent.trigger = trigger;
  c.events.push(castEvent);
  for (const cell of cells) c.spores.pools.push({ owner: f.uid, row: cell.row, col: cell.col, lastCycle: c.cycle + SPORE_CYCLES });
  c.events.push({ t: "sporeThrow", src: f.uid, cells, cycles: SPORE_CYCLES });
}

/** Cycle start: each enemy standing on a live owner's pool adds one point; then spent pools expire. */
function tickSporePools(c: Ctx) {
  const { pools, points } = c.spores;
  if (!pools.length) return;
  for (const pool of pools) {
    const owner = c.all.find((x) => x.uid === pool.owner);
    if (!owner?.alive) continue;
    const victim = sporeOccupant(c, owner, pool.row, pool.col);
    if (!victim) continue;
    const list = points.get(owner.uid) ?? [];
    points.set(owner.uid, list);
    list.push({ victim: victim.uid, row: pool.row, col: pool.col });
    c.events.push({ t: "sporePoint", owner: owner.uid, dst: victim.uid, row: pool.row, col: pool.col, points: list.length });
  }
  const expired = new Map<string, SporeCell[]>();
  c.spores.pools = pools.filter((pool) => {
    if (pool.lastCycle > c.cycle) return true;
    const cells = expired.get(pool.owner) ?? [];
    expired.set(pool.owner, cells);
    cells.push({ row: pool.row, col: pool.col });
    return false;
  });
  for (const [owner, cells] of expired) c.events.push({ t: "sporeExpire", owner, cells });
}

/**
 * Cycle end: every living owner with ≥ SPORE_BURST_POINTS detonates all its points. Each point deals
 * (10 + 0.25 × MATK) magic damage to the enemy that earned it (points of one victim resolve as one
 * hit); the owner heals 50% of the actual HP damage. Pools that produced a point are consumed, so those
 * cells stay clean until a later cast lands there again. Returns whether anything detonated.
 */
function burstSporePools(c: Ctx): boolean {
  let any = false;
  for (const f of c.all) {
    const list = c.spores.points.get(f.uid);
    if (!f.alive || !list || list.length < SPORE_BURST_POINTS) continue;
    any = true;
    c.spores.points.delete(f.uid);
    const consumed = new Set(list.map((pt) => cellKey(pt.row, pt.col)));
    const cells: SporeCell[] = [];
    c.spores.pools = c.spores.pools.filter((pool) => {
      if (pool.owner !== f.uid || !consumed.has(cellKey(pool.row, pool.col))) return true;
      cells.push({ row: pool.row, col: pool.col });
      return false;
    });
    c.events.push({ t: "sporeBurst", owner: f.uid, cells, points: list.length });
    const perVictim = new Map<string, number>();
    for (const pt of list) perVictim.set(pt.victim, (perVictim.get(pt.victim) ?? 0) + 1);
    const perPoint = (SPORE_POINT_BASE + combatStat(f, "matk") * SPORE_POINT_MATK) * goldMultiplier(c.gold[f.side]);
    let drained = 0;
    for (const [uid, n] of perVictim) {
      const victim = c.all.find((x) => x.uid === uid);
      if (!f.alive || !victim?.alive) continue;
      drained += strike(c, f, victim, Math.round(perPoint * n), "magic", true).hp;
    }
    if (drained > 0) heal(c, f, f, drained * SPORE_HEAL_PCT);
  }
  return any;
}

const foes = (c: Ctx, f: Fighter) => c.all.filter((x) => x.alive && x.side !== f.side);
const friends = (c: Ctx, f: Fighter) => c.all.filter((x) => x.alive && x.side === f.side);
const hpRatio = (f: Fighter) => f.hp / f.maxHp;
const addRage = (f: Fighter, n: number) => { f.rage = Math.min(f.rageMax, Math.max(0, f.rage + n)); };

const AI_CLASS_PRIORITY: Record<Role, number> = {
  MAGE: 0, ARCHER: 1, SUPPORT: 2, FIGHTER: 3, TANKER: 4, ASSASSIN: 5,
};

/** A102 basic target: taunt first; RIGHT uses authored melee/ranged/Assassin scoring. */
function basicTarget(c: Ctx, f: Fighter): Fighter | null {
  const list = foes(c, f);
  const taunter = f.status.taunt?.turns ? list.find((x) => x.uid === f.tauntBy) : undefined;
  if (taunter) return taunter;
  if (!list.length) return null;

  if (f.side === "R") {
    const nonFrontRanged = f.role !== "ASSASSIN" && f.role !== "TANKER" && f.role !== "FIGHTER" && f.range >= 2;
    if (nonFrontRanged && !c.deterministicTargeting && c.rightRandomTargetChance > 0
      && c.rng() < c.rightRandomTargetChance) {
      return list[Math.floor(c.rng() * list.length)] ?? null;
    }
    const columnDistance = (x: Fighter) => Math.abs(f.col - x.col);
    const sameRow = (x: Fighter) => x.row === f.row ? 0 : 1;
    if (f.role === "ASSASSIN") {
      list.sort((a, b) => depth(b) - depth(a)
        || sameRow(a) - sameRow(b)
        || a.row - b.row
        || AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
        || a.uid.localeCompare(b.uid));
    } else if (f.range >= 2) {
      list.sort((a, b) => sameRow(a) - sameRow(b)
        || a.row - b.row
        || columnDistance(a) - columnDistance(b)
        || a.uid.localeCompare(b.uid));
    } else {
      list.sort((a, b) => columnDistance(a) - columnDistance(b)
        || sameRow(a) - sameRow(b)
        || a.row - b.row
        || a.uid.localeCompare(b.uid));
    }
    return list[0] ?? null;
  }

  const back = f.role === "ASSASSIN" ? -1 : 1;
  // LEFT retains the canonical A11 ordering; no movement means out-of-range falls back rather than stalling.
  const inRange = (x: Fighter) => (f.range >= 2 && dist(f, x) > f.range ? 1 : 0);
  list.sort((a, b) => inRange(a) - inRange(b) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
    || back * (depth(a) - depth(b)) || a.uid.localeCompare(b.uid));
  return list[0] ?? null;
}

function applyStatus(
  c: Ctx,
  dst: Fighter,
  kind: string,
  turns: number,
  value = 0,
  source?: SkillStatusOrigin,
  permanent = false,
) {
  if (!dst.alive || turns <= 0) return;
  const cur = dst.status[kind];
  const nextTurns = Math.max(turns, cur?.turns ?? 0);
  const nextValue = Math.max(value, cur?.value ?? 0);
  const nextPermanent = permanent || (cur?.permanent ?? false);
  const changed = !cur || cur.turns !== nextTurns || cur.value !== nextValue || (!!cur.permanent !== nextPermanent);
  // Never shorten; keep the stronger payload (A73). A89 source changes only when the merged state changes.
  if (!cur) {
    dst.status[kind] = source
      ? { turns: nextTurns, value: nextValue, ...(nextPermanent ? { permanent: true } : {}), source: { ...source, turns: nextTurns, value: nextValue } }
      : { turns: nextTurns, value: nextValue, ...(nextPermanent ? { permanent: true } : {}) };
  } else if (changed) {
    cur.turns = nextTurns;
    cur.value = nextValue;
    if (nextPermanent) cur.permanent = true;
    if (source) cur.source = { ...source, turns: nextTurns, value: nextValue };
    else delete cur.source;
  }
  const event: Extract<CombatEvent, { t: "status" }> = { t: "status", dst: dst.uid, kind, turns: nextTurns };
  if (nextPermanent) event.permanent = true;
  if (dst.status[kind]?.source) event.source = dst.status[kind]!.source;
  c.events.push(event);
}

function cleanseRandomDebuffs(c: Ctx, fighter: Fighter, count: number) {
  for (let removed = 0; removed < count; removed++) {
    const candidates: Array<{ kind: "status"; key: string } | { kind: "mod"; index: number; icon: string }> = [];
    for (const [key, status] of Object.entries(fighter.status)) {
      if (status.turns > 0 && CLEANSEABLE_STATUSES.has(key)) candidates.push({ kind: "status", key });
    }
    fighter.mods.forEach((mod, index) => {
      if (mod.turns > 0 && mod.value < 0) candidates.push({ kind: "mod", index, icon: `${mod.stat}Down` });
    });
    if (candidates.length === 0) break;
    const chosen = candidates[Math.floor(c.rng() * candidates.length)]!;
    if (chosen.kind === "status") {
      delete fighter.status[chosen.key];
      if (chosen.key === "taunt") fighter.tauntBy = null;
      c.events.push({ t: "status", dst: fighter.uid, kind: chosen.key, turns: 0 });
      continue;
    }
    fighter.mods.splice(chosen.index, 1);
    c.events.push({ t: "status", dst: fighter.uid, kind: chosen.icon, turns: 0 });
  }
}

/** Full cleanse is deterministic and consumes no RNG; positive effects never qualify. */
function cleanseTideDebuffs(dst: Fighter): string[] {
  const removed: string[] = [];
  for (const [kind, status] of Object.entries(dst.status)) {
    if (status.turns <= 0 || !CLEANSEABLE_STATUSES.has(kind)) continue;
    delete dst.status[kind];
    if (kind === "taunt") dst.tauntBy = null;
    removed.push(kind);
  }
  dst.mods = dst.mods.filter((mod) => {
    if (mod.turns <= 0 || mod.value >= 0) return true;
    removed.push(`${mod.stat}Down`);
    return false;
  });
  return removed;
}

/** Reconcile tracked Tide shield after normal mitigation, preserving unrelated shield sources. */
function consumeTideShield(dst: Fighter, absorbed: number, preShield: number) {
  let tideBalance = 0;
  for (const kind in dst.status) {
    if (kind.startsWith(TIDE_SHIELD_PREFIX)) tideBalance += Math.max(0, dst.status[kind]!.value);
  }
  let remaining = Math.max(0, absorbed - Math.max(0, preShield - tideBalance));
  if (remaining === 0) return;
  for (const kind in dst.status) {
    if (!kind.startsWith(TIDE_SHIELD_PREFIX)) continue;
    const status = dst.status[kind]!;
    const consumed = Math.min(remaining, Math.max(0, status.value));
    status.value -= consumed;
    remaining -= consumed;
    if (remaining === 0) break;
  }
}

function applyMod(dst: Fighter, mod: StatMod, stackKey?: string) {
  if (!stackKey) {
    dst.mods.push({ ...mod });
    return;
  }
  const cur = dst.mods.find((m) => m.stackKey === stackKey && m.stat === mod.stat && m.pct === mod.pct);
  if (!cur) {
    dst.mods.push({ ...mod, stackKey });
    return;
  }
  cur.value = Math.max(cur.value, mod.value);
  cur.turns = Math.max(cur.turns, mod.turns);
}

function heal(c: Ctx, src: Fighter, dst: Fighter, raw: number) {
  if (!dst.alive) return;
  const amount = Math.min(dst.maxHp - dst.hp, Math.round(raw * (1 + src.healPct) * (1 + dst.env.healRecvPct)));
  if (amount <= 0) return;
  dst.hp += amount;
  c.events.push({ t: "heal", src: src.uid, dst: dst.uid, amount });
}

function kill(c: Ctx, f: Fighter, killer: Fighter | null) {
  f.alive = false;
  f.shield = 0;
  f.hp = 0;
  c.events.push({ t: "death", dst: f.uid });
  if (killer?.role === "ASSASSIN" && killer.alive && killer.side !== f.side) {
    c.bounty[killer.side] += killer.star;
    c.bountyKills[killer.side] += 1;
  }
}

/** Mitigate before shield/HP; attack callers may defer lethal resolution until A120 aftermath completes. */
function applyDamage(
  c: Ctx,
  dst: Fighter,
  dmg: number,
  killer: Fighter | null,
  event: (absorbed: number, appliedDamage: number) => CombatEvent,
  deferDeath = false,
) {
  const reduction = dst.status.damageReduction?.turns > 0
    ? Math.min(0.9, Math.max(0, dst.status.damageReduction.value))
    : 0;
  // Hard-beak vulnerability multiplies incoming damage after mitigation; the wind
  // sickle hook guard then absorbs a flat 10 from the same hit this cycle.
  const vulnerability = dst.status.hardBeakVulnerability?.value ?? 0;
  const guarding = dst.hookGuardCycle === c.cycle;
  const mitigated = Math.round(dmg * (1 - reduction) * (1 + vulnerability));
  const appliedDamage = Math.max(guarding ? 0 : 1, mitigated - (guarding ? 10 : 0));
  const absorbed = Math.min(dst.shield, appliedDamage);
  const preShield = dst.shield;
  dst.shield -= absorbed;
  if (absorbed > 0) consumeTideShield(dst, absorbed, preShield);
  const toHp = Math.min(dst.hp, appliedDamage - absorbed);
  dst.hp -= toHp;
  c.events.push(event(absorbed, appliedDamage));
  // Frost from 3★ Sương Điệp persists through turns but thaws on actual HP damage.
  // Centralize here so basics, skills, DoTs and reflected damage all follow one rule.
  if (toHp > 0 && dst.status.freeze?.permanent) {
    delete dst.status.freeze;
    c.events.push({ t: "status", dst: dst.uid, kind: "freeze", turns: 0 });
  }
  const lethal = dst.hp <= 0 && dst.alive;
  let killed = false;
  if (lethal && !deferDeath) {
    kill(c, dst, killer);
    killed = true;
  }
  return { hp: toHp, absorbed, lethal, killed };
}

function resolveLethal(c: Ctx, f: Fighter, killer: Fighter | null): boolean {
  if (!f.alive || f.hp > 0) return false;
  if (f.phoenix.armed && !f.phoenix.used) {
    const pct = Math.min(1, Math.max(0.01, Number.isFinite(f.phoenix.revivePct) ? f.phoenix.revivePct : 0.3));
    f.phoenix.armed = false;
    f.phoenix.used = true;
    f.shield = 0;
    f.hp = Math.max(1, Math.round(f.maxHp * pct));
    c.events.push({ t: "revive", src: f.uid, dst: f.uid, hp: f.hp });
    return false;
  }
  kill(c, f, killer);
  return true;
}

function activeBerserk(f: Fighter): BerserkReactionState | null {
  return f.berserk?.turns && f.berserk.turns > 0 ? f.berserk : null;
}

function applyReflect(c: Ctx, defender: Fighter, attacker: Fighter, incomingType: DamageType, actualHpDamage: number): boolean {
  const reflect = defender.reflect;
  if (!reflect || reflect.turns <= 0 || actualHpDamage <= 0) return false;
  const pct = reflect.pctByDamageType[incomingType] ?? 0;
  if (!(pct > 0)) return false;
  const dmg = Math.max(1, Math.round(actualHpDamage * pct));
  applyDamage(c, attacker, dmg, defender,
    (absorbed, appliedDamage) => ({ t: "reflect", src: defender.uid, dst: attacker.uid, dmg: appliedDamage, absorbed }), true);
  return true;
}

function applyReflectOffenseDebuff(defender: Fighter, attacker: Fighter, actualHpDamage: number) {
  const payload = defender.reflect?.offenseDebuff;
  if (!payload || actualHpDamage <= 0 || attacker.hp <= 0) return;
  const stat = reflectOffenseStat(attacker.role);
  applyMod(attacker, { stat, value: -Math.abs(payload.value), pct: false, turns: payload.turns });
}

interface StrikeOptions {
  allowCounter?: boolean;
  /** Distinct presentation for authored skill impact families. */
  kind?: "kiss" | "batling" | "grass" | "soul" | "horn";
  canCrit?: boolean;
}

function basicAttack(c: Ctx, src: Fighter, dst: Fighter, options: StrikeOptions = {}) {
  const magic = src.role === "MAGE" || src.role === "SUPPORT" || src.basicDamageType === "magic";
  return strike(c, src, dst, combatStat(src, magic ? "matk" : "atk"), magic ? "magic" : "physical", false, options);
}

function resolveCounter(c: Ctx, defender: Fighter, attacker: Fighter) {
  if (defender.counterTurns <= 0 || defender.hp <= 0 || attacker.hp <= 0 || attacker.range > 1) return;
  basicAttack(c, defender, attacker, { allowCounter: false });
}

function nearestFoe(c: Ctx, src: Fighter): Fighter | null {
  const stable = stableTargets(src, foes(c, src));
  stable.sort((a, b) => dist(src, a) - dist(src, b) || a.uid.localeCompare(b.uid));
  return stable[0] ?? null;
}

function resolveBerserkKill(c: Ctx, src: Fighter) {
  const berserk = activeBerserk(src);
  if (!berserk) return;
  if (berserk.rageOnKill > 0) addRage(src, berserk.rageOnKill);
  if (berserk.extendTurnsOnKill > 0) {
    berserk.turns += berserk.extendTurnsOnKill;
    const atkBuff = src.mods.find((m) => m.stackKey === berserk.atkBuffStackKey);
    if (atkBuff) atkBuff.turns = Math.max(atkBuff.turns, berserk.turns);
  }
  for (let i = 0; i < berserk.chainedBasicsOnKill && src.alive; i++) {
    const target = nearestFoe(c, src);
    if (!target) break;
    basicAttack(c, src, target);
  }
}

/** Issue #31: authored on-hit / on-skill effects, applied only after damage has landed. */
function applyEquipmentOnHit(c: Ctx, src: Fighter, skill: boolean) {
  const logic = src.logic;
  if (skill) {
    if (logic.rageOnSkill > 0) addRage(src, logic.rageOnSkill);
    const procRage = rollSkillProc(logic, c.rng);
    if (procRage > 0) addRage(src, procRage);
    return;
  }
  const stack = (stat: "atk" | "matk", pct: number, max: number) => {
    if (pct <= 0 || max <= 0) return;
    const key = `logic:${stat}:${src.uid}`;
    const applied = src.mods.filter((m) => m.stackKey === key).length;
    if (applied >= max) return;
    applyMod(src, { stat, value: pct / 100, pct: true, turns: 0 }, key);
  };
  stack("atk", logic.atkStackPct, logic.atkStackMax);
  stack("matk", logic.matkStackPct, logic.matkStackMax);
}

/** A12/A13 pipeline + A74/A120 aftermath. Returns HP damage dealt (0 on miss). */
function strike(
  c: Ctx,
  src: Fighter,
  dst: Fighter,
  raw: number,
  type: "physical" | "magic" | "true",
  skill: boolean,
  options: StrikeOptions = {},
) {
  let adjustedRaw = raw;
  const berserk = !skill ? activeBerserk(src) : null;
  if (berserk?.firstBasicPending) {
    adjustedRaw *= berserk.firstBasicMultiplier;
    berserk.firstBasicPending = false;
  }
  let crit = src.crit;
  let critMult = src.critDmg;
  let hit = src.accuracy + src.env.accuracy - combatStat(dst, "evade");
  if (src.role === "ARCHER") {
    const d = dist(src, dst);
    hit -= 0.05 * d; crit += 0.05 * d; critMult += 0.05 * d;
  }
  if (!skill && type === "physical" && c.rng() >= Math.min(1, Math.max(0.1, hit))) {
    c.events.push({ t: "miss", src: src.uid, dst: dst.uid });
    afterDefender(c, dst, src);
    return { hp: 0, absorbed: 0, killed: false, landed: false };
  }
  let dmg = Math.max(1, adjustedRaw);
  if (ELEMENT_COUNTER[src.element] === dst.element) dmg *= dst.role === "TANKER" ? 0.5 : src.role === "TANKER" ? 1 : 1 + COUNTER_BONUS;
  if (src.element === "FIRE") dmg *= dst.env.fireVuln;
  if (CLASS_COUNTER[src.role]?.includes(dst.role)) dmg *= 1 + COUNTER_BONUS;
  const isCrit = (options.canCrit ?? true) && type !== "true" && c.rng() < crit;
  if (isCrit) dmg *= critMult;
  else if (type === "physical") dmg = (dmg * 100) / (100 + combatStat(dst, "def"));
  else if (type === "magic") dmg = (dmg * 100) / (100 + combatStat(dst, "mdef"));
  // Authored on-hit logic (issue #31): low/high-HP bonuses and capped stack scaling.
  dmg *= logicDamageMultiplier(src.logic, dst.maxHp > 0 ? dst.hp / dst.maxHp : 1);
  dmg = Math.max(1, Math.round(dmg * c.globalMult * (src.hookOffense?.cycle === c.cycle ? src.hookOffense.multiplier : 1)));
  const resolved = applyDamage(c, dst, dmg, src,
    (absorbed, appliedDamage) => ({ t: skill ? "skill" : "basic", src: src.uid, dst: dst.uid, dmg: appliedDamage, absorbed, crit: isCrit,
      ...(options.kind ? { kind: options.kind } : {}) }), true);

  if (resolved.hp > 0 && !skill) {
    addRage(src, Math.round(c.rageGain[src.side] * (1 + src.rageGainPct)));
    if (src.role === "SUPPORT") scheduleAutoCast(c, src, "SUPPORT", dst);
  }
  afterDefender(c, dst, src);
  if (resolved.hp > 0) {
    if (src.onHitBurn > 0) applyStatus(c, dst, "burn", 2, src.onHitBurn);
    if (src.onHitPoison > 0) applyStatus(c, dst, "poison", 2, src.onHitPoison);
    const reflected = applyReflect(c, dst, src, type, resolved.hp);
    if (reflected && src.hp > 0) applyReflectOffenseDebuff(dst, src, resolved.hp);
    if (src.hp > 0 && dst.hp > 0 && (options.allowCounter ?? true)) resolveCounter(c, dst, src);
    // The oath restores HP only from actual HP damage during the next entire cycle.
    if (src.hp > 0 && src.oath?.cycle === c.cycle) {
      heal(c, src, src, resolved.hp * (src.oath.star === 1 ? 0.5 : src.oath.star === 2 ? 1 : 2));
    }
    const lifesteal = src.lifesteal + (activeBerserk(src)?.lifestealPct ?? 0);
    if (src.hp > 0 && lifesteal > 0) heal(c, src, src, resolved.hp * lifesteal);
    if (src.hp > 0 && src.logic.healOnDmgPct > 0) heal(c, src, src, resolved.hp * src.logic.healOnDmgPct);
    if (src.hp > 0) applyEquipmentOnHit(c, src, skill);
  }

  resolveLethal(c, src, dst);
  const killed = resolveLethal(c, dst, src);
  if (!skill && killed && src.alive) resolveBerserkKill(c, src);
  return { hp: resolved.hp, absorbed: resolved.absorbed, killed, landed: true };
}

/** Defender +1 rage; TANKER full rage when attacked schedules the deferred A74/A120 response. */
function afterDefender(c: Ctx, dst: Fighter, attacker: Fighter) {
  if (!dst.alive) return;
  addRage(dst, 1);
  if (dst.role === "TANKER") scheduleAutoCast(c, dst, "TANKER", attacker);
}

function autoCastReady(c: Ctx, f: Fighter, role: AutoCastRole): boolean {
  if (!f.alive || f.role !== role || (f.status.silence?.turns ?? 0) > 0) return false;
  if (!Number.isFinite(f.rage) || !Number.isFinite(f.rageMax) || f.rage < f.rageMax) return false;
  if (!f.skillFamily) return false;
  return role === "SUPPORT" || f.skill.side !== "enemy" || foes(c, f).length > 0;
}

function scheduleAutoCast(c: Ctx, f: Fighter, role: AutoCastRole, preferred?: Fighter) {
  if (c.autoCastInFlight.has(f) || !autoCastReady(c, f, role)) return;
  c.autoCastInFlight.add(f);
  c.deferredAutoCasts.push({ fighter: f, role, preferred });
}

function flushDeferredAutoCasts(c: Ctx) {
  for (let i = 0; i < c.deferredAutoCasts.length; i++) {
    const job = c.deferredAutoCasts[i]!;
    try {
      if (!autoCastReady(c, job.fighter, job.role)) continue;
      job.fighter.rage = 0;
      castSkill(c, job.fighter, job.preferred, { consumeRage: false, trigger: job.role });
    } finally {
      c.autoCastInFlight.delete(job.fighter);
    }
  }
  c.deferredAutoCasts.length = 0;
}

function statValue(f: Fighter, s: Stat): number {
  return s === "hp" ? f.maxHp : combatStat(f, s);
}

function stableTargets(f: Fighter, pool: Fighter[]): Fighter[] {
  return [...pool].sort((a, b) => rowRank(f.row, a.row) - rowRank(f.row, b.row)
    || depth(a) - depth(b) || a.uid.localeCompare(b.uid));
}

function extremeColumn(pool: Fighter[], backline: boolean): Fighter[] {
  if (!pool.length) return [];
  const targetDepth = backline ? Math.max(...pool.map(depth)) : Math.min(...pool.map(depth));
  return pool.filter((x) => depth(x) === targetDepth);
}

function clustered(pool: Fighter[], axis: "row" | "col", score: (xs: Fighter[]) => number): Fighter[] {
  const groups = new Map<number, Fighter[]>();
  for (const x of pool) {
    const key = axis === "row" ? x.row : x.col;
    const g = groups.get(key) ?? [];
    g.push(x);
    groups.set(key, g);
  }
  let best: Fighter[] = [];
  let bestScore = -Infinity;
  for (const g of groups.values()) {
    const s = score(g);
    if (s > bestScore) {
      best = g;
      bestScore = s;
    }
  }
  return best;
}

function selectorTargets(c: Ctx, f: Fighter, pool: Fighter[], selector: SkillSelector, count: number, preferred?: Fighter): Fighter[] {
  if (!pool.length) return [];
  const stable = stableTargets(f, pool);
  const max = Math.max(1, count);
  const take = (xs: Fighter[]) => xs.slice(0, max);
  if (preferred?.alive && pool.includes(preferred) && (selector === "frontline_default" || selector === "primary_target")) {
    return [preferred, ...stable.filter((x) => x !== preferred)].slice(0, max);
  }
  const stableIndex = (x: Fighter) => stable.indexOf(x);
  switch (selector) {
    case "frost_role_column": {
      // Select the strongest role represented in each column first; only columns
      // with equal role priority compete by total ATK (stable column fallback).
      const columns = [...new Set(stable.map((target) => target.col))].map((col) => {
        const members = stable.filter((target) => target.col === col);
        return {
          col,
          priority: Math.min(...members.map((target) => AI_CLASS_PRIORITY[target.role])),
          totalAtk: members.reduce((sum, target) => sum + combatStat(target, "atk"), 0),
        };
      });
      columns.sort((a, b) => a.priority - b.priority || b.totalAtk - a.totalAtk || a.col - b.col);
      return take(stable.filter((target) => target.col === columns[0]!.col)
        .sort((a, b) => AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
          || dist(f, a) - dist(f, b) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
          || a.uid.localeCompare(b.uid)));
    }
    case "role_priority":
      return take([...stable].sort((a, b) => AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
        || dist(f, a) - dist(f, b) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
        || a.uid.localeCompare(b.uid)));
    case "highest_current_hp_role":
      return take([...stable].sort((a, b) => AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
        || b.hp - a.hp || stableIndex(a) - stableIndex(b)));
    case "self": return [f];
    case "lowest_hp_pct":
    case "lowest_hp_pct_ally":
      return take([...stable].sort((a, b) => hpRatio(a) - hpRatio(b) || stableIndex(a) - stableIndex(b)));
    case "highest_rage":
      return take([...stable].sort((a, b) => b.rage - a.rage || stableIndex(a) - stableIndex(b)));
    case "lowest_rage_ally":
      return take([...stable].sort((a, b) => a.rage - b.rage || stableIndex(a) - stableIndex(b)));
    case "highest_matk":
      return take([...stable].sort((a, b) => combatStat(b, "matk") - combatStat(a, "matk") || stableIndex(a) - stableIndex(b)));
    case "highest_atk":
      return take([...stable].sort((a, b) => combatStat(b, "atk") - combatStat(a, "atk") || stableIndex(a) - stableIndex(b)));
    case "highest_max_hp_front":
      return take(extremeColumn(stable, false).sort((a, b) => b.maxHp - a.maxHp || stableIndex(a) - stableIndex(b)));
    case "lowest_def_front":
      return take(extremeColumn(stable, false).sort((a, b) => combatStat(a, "def") - combatStat(b, "def") || stableIndex(a) - stableIndex(b)));
    case "lowest_mdef_backline":
      return take(extremeColumn(stable, true).sort((a, b) => combatStat(a, "mdef") - combatStat(b, "mdef") || stableIndex(a) - stableIndex(b)));
    case "highest_atk_backline":
      return take(extremeColumn(stable, true).sort((a, b) => combatStat(b, "atk") - combatStat(a, "atk") || stableIndex(a) - stableIndex(b)));
    case "isolated_backline": {
      const back = extremeColumn(stable, true);
      const nearby = (x: Fighter) => pool.filter((y) => y !== x && Math.abs(y.row - x.row) <= 1 && Math.abs(y.col - x.col) <= 1).length;
      return take([...back].sort((a, b) => nearby(a) - nearby(b) || stableIndex(a) - stableIndex(b)));
    }
    case "backline_caster": {
      const back = extremeColumn(stable, true);
      const casters = back.filter((x) => x.role === "MAGE" || x.role === "SUPPORT");
      return take(casters.length ? casters : back);
    }
    case "most_clustered_row":
      return take(clustered(stable, "row", (xs) => xs.length));
    case "most_clustered_col":
      return take(clustered(stable, "col", (xs) => xs.length));
    case "highest_total_atk_row":
      return take(clustered(stable, "row", (xs) => xs.reduce((n, x) => n + combatStat(x, "atk"), 0)));
    case "highest_total_atk_col":
      return take(clustered(stable, "col", (xs) => xs.reduce((n, x) => n + combatStat(x, "atk"), 0)));
    case "random_unique": {
      const bag = [...pool];
      const out: Fighter[] = [];
      while (bag.length && out.length < max) out.push(bag.splice(Math.floor(c.rng() * bag.length), 1)[0]!);
      return out;
    }
    case "random":
      return Array.from({ length: max }, () => pool[Math.floor(c.rng() * pool.length)]!);
    case "grass_row":
      return take([...pool].filter((x) => x.row === f.row)
        .sort((a, b) => AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
          || dist(f, a) - dist(f, b) || a.uid.localeCompare(b.uid)));
    case "same_row":
    case "same_row_carry": {
      const row = stable.filter((x) => x.row === f.row);
      if (selector === "same_row_carry") {
        row.sort((a, b) => Math.max(combatStat(b, "atk"), combatStat(b, "matk")) - Math.max(combatStat(a, "atk"), combatStat(a, "matk"))
          || stableIndex(a) - stableIndex(b));
      }
      return take(row.length ? row : stable);
    }
    case "same_column": {
      const p = basicTarget(c, f) ?? stable[0]!;
      const column = stable.filter((x) => x.col === p.col);
      return take(column.length ? column : stable);
    }
    case "front_cone": {
      const dir = f.side === "L" ? 1 : -1;
      const cone = stable.filter((x) => {
        const forward = (x.col - f.col) * dir;
        return forward > 0 && Math.abs(x.row - f.row) <= forward;
      });
      return (cone.length ? cone : stable).slice(0, Math.max(3, max));
    }
    case "backline_jump":
      return take(extremeColumn(stable, true));
    case "primary_target":
    case "frontline_default":
    default: {
      const p = basicTarget(c, f);
      return p ? [p, ...stable.filter((x) => x !== p)].slice(0, max) : take(stable);
    }
  }
}

/** Resolve skill target set from the star-materialized spec (A76 deterministic selectors). */
function skillTargets(c: Ctx, f: Fighter, sp: SkillSpec, preferred?: Fighter, supportSelfFallback = false): Fighter[] {
  if (sp.side === "self") return [f];
  const pool = sp.side === "ally" ? friends(c, f) : foes(c, f);
  if (sp.area === "all") return pool.length || !supportSelfFallback ? pool : [f];
  const ordered = selectorTargets(c, f, pool, sp.selector, sp.count, preferred);
  const p = ordered[0];
  if (!p) return supportSelfFallback ? [f] : [];
  if (sp.area === "row") return pool.filter((x) => x.row === p.row);
  if (sp.area === "column") {
    const column = pool.filter((x) => x.col === p.col);
    return sp.selector === "frost_role_column" ? [p, ...column.filter((x) => x !== p)] : column;
  }
  if (sp.area === "square") return pool.filter((x) => Math.abs(x.row - p.row) <= 1 && Math.abs(x.col - p.col) <= 1);
  return ordered;
}

/** Role priority applies within each positional zone; 2★ uniformly samples the adjacent column. */
function elephantTideTargets(c: Ctx, caster: Fighter): Fighter[] {
  const ally = friends(c, caster).filter((f) => f !== caster);
  const priority = (f: Fighter) => f.role === "SUPPORT" || f.role === "TANKER" ? 0 : 1;
  const ordered = (xs: Fighter[]) => xs.sort((a, b) => priority(a) - priority(b)
    || dist(caster, a) - dist(caster, b) || a.row - b.row || a.col - b.col || a.uid.localeCompare(b.uid));
  const behind = ordered(ally.filter((f) => caster.side === "L" ? f.col < caster.col : f.col > caster.col));
  if (caster.star === 1) return behind;
  const selected = new Set(behind.map((f) => f.uid));
  const neighbors = ally.filter((f) => Math.abs(f.col - caster.col) === 1 && !selected.has(f.uid));
  const extra: Fighter[] = [];
  for (const tier of [0, 1]) {
    const candidates = ordered(neighbors.filter((f) => priority(f) === tier));
    for (let i = 0; i < candidates.length && extra.length < 2; i++) {
      const j = i + Math.floor(c.rng() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
      extra.push(candidates[i]!);
    }
    if (extra.length === 2) break;
  }
  for (const f of extra) selected.add(f.uid);
  if (caster.star === 2) return [...behind, ...extra];
  const adjacent = ordered(ally.filter((f) => !selected.has(f.uid)
    && Math.abs(f.row - caster.row) <= 1 && Math.abs(f.col - caster.col) <= 1));
  return [...behind, ...extra, ...adjacent];
}

/** Non-damaging cast: shields live through this shared cycle, then expire before next-cycle DoTs. */
function castElephantTide(c: Ctx, caster: Fighter, trigger?: AutoCastRole) {
  const targets = elephantTideTargets(c, caster);
  c.events.push({ t: "cast", src: caster.uid, targets: targets.map((f) => f.uid), ...(trigger ? { trigger } : {}) });
  const formula = caster.skill.shield;
  if (!formula) throw new Error("Elephant Tide requires an authored shield formula");
  const amount = Math.max(1, Math.round(formula.base + statValue(caster, formula.stat) * formula.scale));
  const key = `${TIDE_SHIELD_PREFIX}${caster.uid}`;
  for (const ally of targets) {
    const removed = cleanseTideDebuffs(ally);
    const previous = ally.status[key]?.value ?? 0;
    const delta = amount - previous;
    ally.shield += delta;
    ally.status[key] = { turns: 1, value: amount, expiresCycle: c.cycle + 1,
      source: { skillId: ELEPHANT_TIDE_FAMILY, unitUid: caster.uid,
        unitBaseId: caster.baseId, unitStar: caster.star, turns: 1, value: amount } };
    c.events.push({ t: "tideGuard", src: caster.uid, dst: ally.uid, delta, removed, active: true });
  }
}

function previewSeed(all: readonly Fighter[], sourceUid: string): number {
  let hash = 0x811c9dc5;
  const mixText = (value: string) => {
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193);
  };
  mixText(sourceUid);
  for (const fighter of all) {
    mixText(fighter.uid);
    mixText(fighter.baseId);
    hash = Math.imul(hash ^ fighter.star, 0x01000193);
    hash = Math.imul(hash ^ fighter.row, 0x01000193);
    hash = Math.imul(hash ^ fighter.col, 0x01000193);
    hash = Math.imul(hash ^ Math.round(fighter.hp), 0x01000193);
    hash = Math.imul(hash ^ Math.round(fighter.rage), 0x01000193);
  }
  return hash | 0;
}

/** Candidate splash victims are adjacent to the chosen role-priority target, not to the caster.
 * Return all living eligible neighbors; casting samples exactly one via gameplay RNG. */
function kirinAdjacentTargets(c: Ctx, f: Fighter, primary: Fighter): Fighter[] {
  return stableTargets(f, foes(c, f).filter((target) => target !== primary
    && Math.max(Math.abs(target.row - primary.row), Math.abs(target.col - primary.col)) === 1));
}

export interface CombatTargetPreviewOptions {
  /** Planning hover shows the unit's full kit (basic + authored skill) regardless of current rage. */
  kitPreview?: boolean;
}

/**
 * Read-only Planning/Library target projection. It deliberately uses the live basicTarget/skillTargets
 * rules, but owns a deterministic RNG so random selectors never advance the simulator RNG.
 */
export function combatTargetPreview(
  all: readonly Fighter[],
  sourceUid: string,
  options: CombatTargetPreviewOptions = {},
): CombatTargetPreview | null {
  const source = all.find((fighter) => fighter.uid === sourceUid && fighter.alive);
  if (!source) return null;
  const fighters = [...all];
  const c: Ctx = {
    all: fighters,
    rng: mulberry(previewSeed(fighters, sourceUid)),
    events: [],
    globalMult: 1,
    gold: { L: 0, R: 0 },
    rageGain: { L: 1, R: 1 },
    rightRandomTargetChance: 0,
    deterministicTargeting: true,
    bounty: { L: 0, R: 0 },
    bountyKills: { L: 0, R: 0 },
    deferredAutoCasts: [],
    autoCastInFlight: new Set(),
    cycle: 0,
    spores: newSporeState(),
    kissHits: new Map(),
    spiderRowCounts: new Map(),
  };
  const basic = basicTarget(c, source);
  if (!basic) return { scanCells: [], directUids: [], splashUids: [], skillCasterUid: null, tags: [], actorRole: source.role };

  const skillPool = source.skill.side === "self"
    ? [source]
    : source.skill.side === "ally"
      ? friends(c, source)
      : foes(c, source);
  const scanned = [...foes(c, source), ...skillPool];
  const scanCells: Array<{ col: number; row: number }> = [];
  const scanKeys = new Set<number>();
  for (const fighter of scanned) {
    const key = fighter.row * COLS + fighter.col;
    if (scanKeys.has(key)) continue;
    scanKeys.add(key);
    scanCells.push({ col: fighter.col, row: fighter.row });
  }

  const hardControlled = CONTROL_PRIORITY.some((kind) => (source.status[kind]?.turns ?? 0) > 0);
  const silenced = (source.status.silence?.turns ?? 0) > 0;
  const disarmed = (source.status.disarm?.turns ?? 0) > 0;
  const willCastSkill = options.kitPreview
    ? Boolean(source.skillFamily)
    : !hardControlled
      && source.rage >= source.rageMax
      && !silenced
      && Boolean(source.skillFamily);

  if (!options.kitPreview && (hardControlled || (!willCastSkill && disarmed))) {
    return { scanCells, directUids: [], splashUids: [], skillCasterUid: null, tags: [], actorRole: source.role };
  }

  if (!willCastSkill) {
    return {
      scanCells,
      directUids: [basic.uid],
      splashUids: [],
      skillCasterUid: null,
      tags: [{ uid: basic.uid, effect: "damage", kind: "basic", primary: true }],
      actorRole: source.role,
    };
  }

  if (source.skillFamily === SPORE_FAMILY) {
    // Sương Độc lands on random cells anywhere on the enemy half, so the whole half is the area and
    // every enemy there is a possible (secondary) target. No single primary target exists.
    const cells = enemyHalfCells(source.side);
    const exposed = stableTargets(source, foes(c, source));
    const sporeTags: CombatPreviewTag[] = exposed.map((fighter) => ({ uid: fighter.uid, effect: "damage", kind: "skill", primary: false }));
    return {
      scanCells: cells.map(({ col, row }) => ({ col, row })),
      directUids: [],
      splashUids: exposed.map((fighter) => fighter.uid),
      skillCasterUid: source.uid,
      tags: options.kitPreview ? [...sporeTags, { uid: basic.uid, effect: "damage", kind: "basic", primary: true }] : sporeTags,
      actorRole: source.role,
      areaCells: cells.map(({ col, row }) => ({ col, row, effect: "damage" })),
    };
  }
  if (source.skillFamily === ELEPHANT_TIDE_FAMILY) {
    const targets = elephantTideTargets(c, source);
    const tags: CombatPreviewTag[] = targets.map((fighter, i) =>
      ({ uid: fighter.uid, effect: "shield", kind: "skill", primary: i === 0 }));
    if (options.kitPreview) tags.push({ uid: basic.uid, effect: "damage", kind: "basic", primary: false });
    return { scanCells, directUids: targets.slice(0, 1).map((f) => f.uid),
      splashUids: targets.slice(1).map((f) => f.uid), skillCasterUid: source.uid,
      tags, actorRole: source.role };
  }

if (source.skillFamily === SPIDER_SOUL_FAMILY) {
    const row = foes(c, source).filter((target) => target.row === source.row)
      .sort((a, b) => AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
        || dist(source, a) - dist(source, b) || a.uid.localeCompare(b.uid));
    const first = row[0];
    const tags: CombatPreviewTag[] = row.map((target, index) => ({
      uid: target.uid, effect: "damage", kind: "skill", primary: index === 0,
    }));
    return {
      scanCells, directUids: first ? [first.uid] : [],
      splashUids: row.slice(1).map((target) => target.uid),
      skillCasterUid: source.uid, actorRole: source.role,
      tags: options.kitPreview ? [...tags, { uid: basic.uid, effect: "damage", kind: "basic", primary: false }] : tags,
    };
  }
if (source.skillFamily === KIRIN_HORNS_FAMILY) {
    const [primary] = skillTargets(c, source, source.skill);
    const adjacent = primary ? kirinAdjacentTargets(c, source, primary) : [];
    const effect = skillPreviewEffect(source.skill);
    const tags: CombatPreviewTag[] = [
      ...(primary ? [{ uid: primary.uid, effect, kind: "skill" as const, primary: true }] : []),
      ...adjacent.map((target) => ({ uid: target.uid, effect, kind: "skill" as const, primary: false })),
    ];
    if (options.kitPreview) tags.push({ uid: basic.uid, effect: "damage", kind: "basic", primary: false });
    return {
      scanCells,
      directUids: primary ? [primary.uid] : [],
      splashUids: adjacent.map((target) => target.uid),
      skillCasterUid: source.uid,
      tags,
      actorRole: source.role,
    };
  }

  const skillTargetsResolved = skillTargets(c, source, source.skill, basic);
  const skillPrimary = skillTargetsResolved[0];
  const directUids = skillPrimary ? [skillPrimary.uid] : [];
  const splashUids = skillTargetsResolved.slice(1)
    .map((fighter) => fighter.uid)
    .filter((uid, index, allUids) => uid !== skillPrimary?.uid && allUids.indexOf(uid) === index);
  const effect = skillPreviewEffect(source.skill);
  const skillTags: CombatPreviewTag[] = skillTargetsResolved.map((fighter, index) => ({
    uid: fighter.uid,
    effect,
    kind: "skill",
    primary: index === 0,
  }));
  // The kit preview projects the unit's whole kit, so a target can legitimately carry both the
  // basic-attack marker and the skill marker; one badge stack per target renders both.
  const tags = options.kitPreview
    ? [...skillTags, { uid: basic.uid, effect: "damage" as const, kind: "basic" as const, primary: false }]
    : skillTags;
  return {
    scanCells,
    directUids,
    splashUids,
    skillCasterUid: source.uid,
    tags,
    actorRole: source.role,
  };
}

/** Semantic preview family for hover colours/icons (heal > shield > control > damage > buff > debuff). */
export function skillPreviewEffect(sp: SkillSpec): CombatPreviewEffect {
  if (sp.heal || sp.hot || sp.revivePct > 0 || sp.selfHealPctMaxHp > 0) return "heal";
  if (sp.shield) return "shield";
  if (sp.controls.length) return "control";
  if (sp.damage || sp.dots.length) return "damage";
  if (sp.buffs.length) return "buff";
  if (sp.debuffs.length) return "debuff";
  return "buff";
}

function standardHealTargets(c: Ctx, f: Fighter, sp: SkillSpec): Fighter[] {
  if (!sp.heal) return [];
  if (sp.side === "self") return f.hp < f.maxHp ? [f] : [];
  const living = friends(c, f);
  if (sp.area === "all" && !sp.pickLowestHp) return living;
  const injured = stableTargets(f, living.filter((a) => a.hp < a.maxHp));
  injured.sort((a, b) => hpRatio(a) - hpRatio(b) || a.uid.localeCompare(b.uid));
  return injured.slice(0, Math.max(1, sp.count));
}

interface CastSkillOptions {
  consumeRage?: boolean;
  trigger?: AutoCastRole;
}

// ---------- Giơ Kiếm Lên Trời (blood_sword_oath) ----------

/** Every debuff remains stored with its original duration during this action-only suppression. */
function withOathDebuffsSuppressed(c: Ctx, f: Fighter, action: () => void) {
  const candidates: Array<{ kind: "status"; key: string; status: TimedStatus }
    | { kind: "mod"; mod: Mod }> = [];
  for (const [key, status] of Object.entries(f.status)) {
    if (status.turns > 0 && CLEANSEABLE_STATUSES.has(key)) candidates.push({ kind: "status", key, status });
  }
  for (const mod of f.mods) {
    if (mod.turns > 0 && mod.value < 0) candidates.push({ kind: "mod", mod });
  }
  const suppressed = f.star === 1 && candidates.length
    ? [candidates[Math.floor(c.rng() * candidates.length)]!]
    : candidates;
  const removedMods = new Set<Mod>();
  const previousTaunt = f.tauntBy;
  const labels: string[] = [];
  for (const effect of suppressed) {
    if (effect.kind === "status") {
      delete f.status[effect.key];
      if (effect.key === "taunt") f.tauntBy = null;
      labels.push(effect.key);
    } else {
      removedMods.add(effect.mod);
      labels.push(`${effect.mod.stat}Down`);
    }
  }
  if (removedMods.size) f.mods = f.mods.filter((mod) => !removedMods.has(mod));
  c.events.push({ t: "oath", dst: f.uid, suppressed: labels, active: true });
  try {
    action();
  } finally {
    for (const effect of suppressed) {
      if (effect.kind !== "status") continue;
      const now = f.status[effect.key];
      if (!now) f.status[effect.key] = effect.status;
      else {
        now.turns = Math.max(now.turns, effect.status.turns);
        now.value = Math.max(now.value, effect.status.value);
      }
    }
    if (removedMods.size) f.mods.push(...removedMods);
    if (suppressed.some((effect) => effect.kind === "status" && effect.key === "taunt")
      && f.status.taunt?.turns && !f.tauntBy) f.tauntBy = previousTaunt;
    c.events.push({ t: "oath", dst: f.uid, suppressed: labels, active: false });
  }
}

/** Physical burst is unchanged; suppression surrounds impact and recovery starts next cycle. */
function castBloodSwordOath(c: Ctx, f: Fighter, preferred: Fighter | undefined, trigger?: AutoCastRole) {
  const target = preferred?.alive && preferred.side !== f.side ? preferred : basicTarget(c, f);
  const castEvent: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: target ? [target.uid] : [] };
  if (trigger) castEvent.trigger = trigger;
  c.events.push(castEvent);
  withOathDebuffsSuppressed(c, f, () => {
    const d = f.skill.damage;
    if (!target || !d) return;
    const raw = Math.round((d.base + statValue(f, d.stat) * d.scale)
      * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
    strike(c, f, target, raw, d.type, true);
  });
  if (f.alive) f.oath = { cycle: c.cycle + 1, star: f.star };
}

/** One kiss per selected foe; the second landed kiss on a given foe spawns unique batlings at that impact. */
function castLoveKiss(c: Ctx, f: Fighter, preferred?: Fighter, trigger?: AutoCastRole) {
  const sp = f.skill;
  const targets = skillTargets(c, f, sp, preferred);
  const event: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: targets.map((t) => t.uid) };
  if (trigger) event.trigger = trigger;
  c.events.push(event);
  if (!sp.damage) return;
  const d = sp.damage;
  const raw = Math.round((d.base + statValue(f, d.stat) * d.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
  let counts = c.kissHits.get(f.uid);
  if (!counts) { counts = new Map(); c.kissHits.set(f.uid, counts); }
  let landed = 0;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;
    if (!target.alive) continue;
    const kissRaw = i === 0 ? raw : Math.round(raw * (i === 1 ? 1 / 2 : 2 / 3));
    const hit = strike(c, f, target, kissRaw, d.type, true, { kind: "kiss" });
    if (!hit.landed) continue;
    landed++;
    if (target.alive) applyStatus(c, target, "stun", 1, 0, {
      skillId: LOVE_KISS_FAMILY, unitUid: f.uid, unitBaseId: f.baseId, unitStar: f.star,
    });
    const next = (counts.get(target.uid) ?? 0) + 1;
    counts.set(target.uid, next);
    if (next !== 2) continue;
    // Uniform sampling without replacement; never kiss-count, stun, or recursively spawn from a batling.
    const available = foes(c, f).filter((other) => other !== target);
    const batRaw = Math.round(raw / 3);
    for (let n = 0; n < 5 && available.length; n++) {
      const index = Math.floor(c.rng() * available.length);
      const batTarget = available.splice(index, 1)[0]!;
      if (batTarget.alive) strike(c, f, batTarget, batRaw, d.type, true, { kind: "batling" });
    }
  }
  if (f.role === "MAGE") addRage(f, landed);
}

function castGrassStorm(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const sp = f.skill;
  const targets = skillTargets(c, f, sp);
  const cast: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: targets.map((x) => x.uid) };
  if (trigger) cast.trigger = trigger;
  c.events.push(cast);
  const damage = sp.damage;
  if (!damage) return;
  const raw = (damage.base + statValue(f, damage.stat) * damage.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]);
  for (let i = 0; i < targets.length; i++) {
    const dst = targets[i]!;
    if (!dst.alive || !f.alive) continue;
    const multiplier = f.star === 3 ? Math.max(0.25, 1 - 0.15 * i)
      : [1, 0.8, 0.6, 0.4][i] ?? 0.4;
    const chance = sp.fourthTargetBonusChance;
    const bonus = f.star === 2 && i === 3 && chance != null && chance > 0
      && c.rng() < Math.min(1, Math.max(0, chance)) ? 0.2 : 0;
    strike(c, f, dst, Math.round(raw * (multiplier + bonus)), "magic", true, { kind: "grass" });
  }
}

function castSpiderSouls(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const rowAtCast = foes(c, f).filter((enemy) => enemy.row === f.row).length;
  const count = f.star === 3 ? 2 * (c.spiderRowCounts.get(f.uid) ?? rowAtCast) : rowAtCast;
  const cast: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: [] };
  if (trigger) cast.trigger = trigger;
  c.events.push(cast);
  const damage = f.skill.damage;
  if (!damage || count === 0) return;
  const raw = Math.round((damage.base + statValue(f, damage.stat) * damage.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
  const paralyze = f.skill.controls.find((effect) => effect.kind === "paralyze");
  const paralyzed = new Set<Fighter>();
  const source: SkillStatusOrigin = {
    skillId: SPIDER_SOUL_FAMILY, unitUid: f.uid, unitBaseId: f.baseId, unitStar: f.star,
  };
  let previous: Fighter | null = null;
  let hitCount = 0;
  for (let i = 0; i < count; i++) {
    const enemies = foes(c, f);
    // The volley count is fixed; surviving off-row targets keep snapshots from becoming fake shots.
    const row = enemies.filter((enemy) => enemy.row === f.row);
    const eligible = row.length ? row : enemies;
    if (!eligible.length) break;
    const priority = Math.min(...eligible.map((enemy) => AI_CLASS_PRIORITY[enemy.role]));
    const ranked = eligible.filter((enemy) => AI_CLASS_PRIORITY[enemy.role] === priority);
    const adjacent: Fighter[] = previous
      ? ranked.filter((enemy) => Math.abs(enemy.row - previous!.row) <= 1 && Math.abs(enemy.col - previous!.col) <= 1)
      : [];
    const candidates: Fighter[] = adjacent.length ? adjacent : ranked;
    const target: Fighter = i === 0 ? stableTargets(f, candidates)[0]! : candidates[Math.floor(c.rng() * candidates.length)]!;
    previous = target;
    cast.targets.push(target.uid);
    const hit = strike(c, f, target, raw, "magic", true, { kind: "soul", canCrit: f.star >= 2 });
    if (hit.landed) {
      hitCount++;
      if (target.alive && paralyze && c.rng() < paralyze.chance) paralyzed.add(target);
    }
  }
  for (const target of paralyzed) if (target.alive) applyStatus(c, target, "paralyze", paralyze!.turns, 0, source);
  if (f.role === "MAGE") addRage(f, hitCount);
}

function castKirinHorns(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const sp = f.skill;
  const primary = skillTargets(c, f, sp)[0];
  const neighbors = primary ? kirinAdjacentTargets(c, f, primary) : [];
  const neighbor = neighbors.length ? neighbors[Math.floor(c.rng() * neighbors.length)]! : null;
  const event: Extract<CombatEvent, { t: "cast" }> = {
    t: "cast", src: f.uid, targets: primary ? [primary.uid, ...(neighbor ? [neighbor.uid] : [])] : [],
  };
  if (trigger) event.trigger = trigger;
  c.events.push(event);
  if (!primary || !sp.damage || !sp.hitCount) return;
  const d = sp.damage;
  const total = Math.round((d.base + statValue(f, d.stat) * d.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
  const base = Math.floor(total / sp.hitCount);
  const remainder = total % sp.hitCount;
  const chance = sp.controls.find((control) => control.kind === "paralyze")?.chance ?? 0;
  const source: SkillStatusOrigin = {
    skillId: KIRIN_HORNS_FAMILY, unitUid: f.uid, unitBaseId: f.baseId, unitStar: f.star,
  };
  for (let i = 0; i < sp.hitCount && f.alive; i++) {
    // If the intended opponent died on an earlier impact, keep attacking a living enemy.
    const intended = i % 2 ? neighbor : primary;
    const dst = intended?.alive ? intended : primary.alive ? primary
      : neighbor?.alive ? neighbor : skillTargets(c, f, sp)[0];
    if (!dst) break;
    const hit = strike(c, f, dst, base + Number(i < remainder), d.type, true,
      { kind: "horn", allowCounter: false });
    if (hit.landed && dst.alive && chance > 0 && c.rng() < chance) {
      applyStatus(c, dst, "paralyze", 1, 0, source);
    }
  }
}

function castHardBeakDive(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const targets = foes(c, f).sort((a, b) =>
    AI_CLASS_PRIORITY[a.role] - AI_CLASS_PRIORITY[b.role]
    || dist(f, a) - dist(f, b)
    || rowRank(f.row, a.row) - rowRank(f.row, b.row)
    || a.uid.localeCompare(b.uid));
  const target = targets[0];
  const event: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: target ? [target.uid] : [] };
  if (trigger) event.trigger = trigger;
  c.events.push(event);
  if (!target) return;
  const damage = f.skill.damage!;
  const raw = Math.round((damage.base + statValue(f, damage.stat) * damage.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
  strike(c, f, target, raw, damage.type, true, { allowCounter: false });
  if (target.alive) {
    const source: SkillStatusOrigin = {
      skillId: HARD_BEAK_DIVE_FAMILY, unitUid: f.uid, unitBaseId: f.baseId, unitStar: f.star,
    };
    applyStatus(c, target, "stun", 1, 0, source);
    applyStatus(c, target, "hardBeakVulnerability", f.star === 1 ? 1 : 999999,
      f.star === 1 ? 1 / 3 : 2 / 3, source);
  }
  if (f.star === 3 && f.alive) {
    // Reuse this skill's catalog damage formula and canonical star multiplier for absorption.
    const amount = Math.max(1, Math.round((damage.base + statValue(f, damage.stat) * damage.scale)
      * (STAR_SKILL[f.star] ?? 1)));
    f.shield += amount;
    c.events.push({ t: "shield", src: f.uid, dst: f.uid, amount });
  }
}

/** Hook impacts once before moving a living target; enemy-half occupancy is never overwritten. */
function castWindSickleHook(c: Ctx, f: Fighter, trigger?: AutoCastRole) {
  const target = selectorTargets(c, f, foes(c, f), "highest_current_hp_role", 1)[0];
  const castEvent: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: target ? [target.uid] : [] };
  if (trigger) castEvent.trigger = trigger;
  c.events.push(castEvent);
  if (target && f.skill.damage) {
    const d = f.skill.damage;
    const raw = Math.round((d.base + statValue(f, d.stat) * d.scale)
      * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]));
    strike(c, f, target, raw, d.type, true);
    if (target.alive) {
      const first = f.side === "L" ? COLS / 2 : COLS / 2 - 1;
      const step = f.side === "L" ? 1 : -1;
      for (let col = first; col >= 0 && col < COLS; col += step) {
        if (c.all.some((other) => other !== target && other.alive && other.side === target.side && other.row === f.row && other.col === col)) continue;
        target.row = f.row;
        target.col = col;
        c.events.push({ t: "hookPull", src: f.uid, dst: target.uid, row: f.row, col });
        break;
      }
    }
  }
  if (f.star >= 2) {
    const multiplier = f.star === 2 ? 2 / 3 : 1 / 2;
    for (const enemy of foes(c, f)) {
      if (enemy.row !== f.row) continue;
      const previous = enemy.hookOffense?.cycle === c.cycle ? enemy.hookOffense.multiplier : 1;
      enemy.hookOffense = { cycle: c.cycle, multiplier: Math.min(previous, multiplier) };
    }
  }
  if (f.star === 3) f.hookGuardCycle = c.cycle;
}

function castSkill(c: Ctx, f: Fighter, preferred?: Fighter, options: CastSkillOptions = {}) {
  const sp = f.skill;
  const family = f.skillFamily;
  const statusSource: SkillStatusOrigin = {
    skillId: family,
    unitUid: f.uid,
    unitBaseId: f.baseId,
    unitStar: f.star,
  };
  const teamDefBuff = family === "team_def_buff";
  f.casting = true;
  if (options.consumeRage ?? true) f.rage = 0;
  try {
    if (family === "wind_sickle_hook") {
      castWindSickleHook(c, f, options.trigger);
      return;
    }
    if (family === ELEPHANT_TIDE_FAMILY) {
      castElephantTide(c, f, options.trigger);
      return;
    }
    if (family === BLOOD_SWORD_OATH_FAMILY) {
      castBloodSwordOath(c, f, preferred, options.trigger);
      return;
    }
    if (family === SPORE_FAMILY) {
      castSporePools(c, f, options.trigger);
      return;
    }
    if (family === LOVE_KISS_FAMILY) {
      castLoveKiss(c, f, preferred, options.trigger);
      return;
    }
    if (family === GRASS_STORM_FAMILY) {
      castGrassStorm(c, f, options.trigger);
      return;
    }
    if (family === SPIDER_SOUL_FAMILY) {
      castSpiderSouls(c, f, options.trigger);
      return;
    }
    if (family === HARD_BEAK_DIVE_FAMILY) {
      castHardBeakDive(c, f, options.trigger);
      return;
    }
    if (family === KIRIN_HORNS_FAMILY) {
      castKirinHorns(c, f, options.trigger);
      return;
    }
    const supportSelfFallback = options.trigger === "SUPPORT" && sp.side === "enemy";
    const targets = skillTargets(c, f, sp, preferred, supportSelfFallback);
    const fallbackSelfTarget = supportSelfFallback && targets.length === 1 && targets[0] === f;
    const castEvent: Extract<CombatEvent, { t: "cast" }> = { t: "cast", src: f.uid, targets: targets.map((x) => x.uid) };
    if (options.trigger) castEvent.trigger = options.trigger;
    c.events.push(castEvent);
    if (sp.reaction.reflect) f.reflect = {
      ...sp.reaction.reflect,
      pctByDamageType: { ...sp.reaction.reflect.pctByDamageType },
    };
    if (sp.reaction.counter) f.counterTurns = sp.reaction.counter.turns;
    if (sp.reaction.phoenix && !f.phoenix.used) {
      f.phoenix.armed = true;
      f.phoenix.revivePct = sp.reaction.phoenix.revivePct;
    }
    if (sp.reaction.berserk) {
      const r = sp.reaction.berserk;
      f.berserk = {
        ...r,
        firstBasicPending: true,
        atkBuffStackKey: `${family}:atk:pct`,
      };
    }
    const starSkill = STAR_SKILL[f.star] ?? 1;
    const starChance = STAR_EFFECT_CHANCE[f.star] ?? 1;
    const enemyHit = new Set<string>();
    // Consume exactly one seeded freeze roll for every unique cast victim, even if
    // the corresponding impact is lethal. Crit rolls are separate strike RNG.
    const frostRolls = family === FROST_STORM_FAMILY
      ? new Map<string, number>([...new Set(targets.map((target) => target.uid))].map((uid): [string, number] => [uid, c.rng()]))
      : null;
    const enemies = sp.side === "enemy" && !fallbackSelfTarget ? targets : [];
    const allies = sp.side === "enemy" ? [f] : targets;
    if (sp.damage) {
      const d = sp.damage;
      const raw = Math.round((d.base + statValue(f, d.stat) * d.scale) * starSkill * goldMultiplier(c.gold[f.side]));
      let drained = 0;
      for (const t of enemies) if (t.alive) {
        const hit = strike(c, f, t, raw, d.type, true);
        drained += hit.hp;
        if (hit.hp > 0 || hit.absorbed > 0) enemyHit.add(t.uid);
      }
      if (sp.lifestealPct && drained > 0) heal(c, f, f, drained * sp.lifestealPct);
    }
    const dotMult = STAR_DOT[f.star] ?? 1;
    for (const t of enemies) {
      if (!t.alive) continue;
      for (const d of sp.dots) applyStatus(c, t, d.kind, d.turns, Math.round(d.value * dotMult), statusSource);
      for (const k of sp.controls) {
        if (family === FROST_STORM_FAMILY && k.kind === "freeze") {
          if ((frostRolls?.get(t.uid) ?? 1) >= k.chance) continue;
          applyStatus(c, t, "freeze", 1, 0, statusSource, f.star === 3);
          continue;
        }
        if (k.kind === "stun" && c.rng() >= Math.min(1, k.chance * starChance)) continue;
        applyStatus(c, t, k.kind, k.turns, 0, statusSource);
        if (k.kind === "taunt") t.tauntBy = f.uid;
      }
      for (const m of sp.debuffs) t.mods.push({ ...m, value: -m.value });
    }
    if (sp.revivePct > 0) {
      const dead = c.all.find((x) => !x.alive && x.side === f.side);
      if (dead) {
        dead.alive = true;
        dead.hp = Math.max(1, Math.round(dead.maxHp * sp.revivePct));
        dead.status = {}; dead.mods = []; dead.rage = 0; dead.oath = null;
        c.events.push({ t: "revive", src: f.uid, dst: dead.uid, hp: dead.hp });
      }
    }
    const healTargets = standardHealTargets(c, f, sp);
    for (const a of healTargets) {
      const raw = sp.heal!.formula
        ? (sp.heal!.formula.base + statValue(f, sp.heal!.formula.stat) * sp.heal!.formula.scale) * starSkill
        : a.maxHp * sp.heal!.pctMaxHp;
      heal(c, f, a, Math.floor(raw));
    }
    if (sp.hot && sp.hot.turns > 0 && sp.hot.totalPctMaxHp > 0) {
      const perTurnPct = sp.hot.totalPctMaxHp / sp.hot.turns;
      for (const a of allies) if (a.alive) applyStatus(c, a, "hot", sp.hot.turns, perTurnPct, statusSource);
    }
    for (const a of allies) {
      if (!a.alive) continue;
      if (sp.shield) {
        const amount = Math.max(1, Math.round((sp.shield.base + statValue(f, sp.shield.stat) * sp.shield.scale) * starSkill));
        a.shield += amount;
        c.events.push({ t: "shield", src: f.uid, dst: a.uid, amount });
      }
      if (!teamDefBuff) for (const m of sp.buffs) {
        const stackKey = a === f && m.stat === "atk" && sp.reaction.berserk ? f.berserk?.atkBuffStackKey : undefined;
        applyMod(a, m, stackKey);
      }
      if (sp.rageGrant && a !== f) addRage(a, sp.rageGrant);
    }
    if (teamDefBuff) {
      for (const a of friends(c, f)) {
        for (const m of sp.buffs) applyMod(a, m, `${family}:${m.stat}:${m.pct ? "pct" : "flat"}`);
      }
    }
    if (sp.selfHealPctMaxHp) heal(c, f, f, f.maxHp * sp.selfHealPctMaxHp);
    if (sp.damageReductionPct > 0 && sp.damageReductionTurns > 0) {
      applyStatus(c, f, "damageReduction", sp.damageReductionTurns, sp.damageReductionPct, statusSource);
    }
    if (sp.cleanseCount > 0) cleanseRandomDebuffs(c, f, sp.cleanseCount);
    if (f.role === "MAGE") addRage(f, enemyHit.size);
  } finally {
    f.casting = false;
  }
}

interface TurnGate {
  canAct: boolean;
  silenced: boolean;
  disarmed: boolean;
}

/** All ongoing damage resolves once at the beginning of a cycle, before either side acts.
 * New statuses applied during that cycle cannot tick until the next boundary. */
function startCycle(c: Ctx) {
  // One-cycle guard expires before any next-round DoT consumes a stale shield.
  for (const f of c.all) for (const [kind, status] of Object.entries(f.status)) {
    if (!kind.startsWith(TIDE_SHIELD_PREFIX) || (status.expiresCycle ?? Infinity) > c.cycle) continue;
    const remaining = Math.max(0, status.value);
    f.shield = Math.max(0, f.shield - remaining);
    delete f.status[kind];
    c.events.push({ t: "tideGuard", src: kind.slice(TIDE_SHIELD_PREFIX.length), dst: f.uid,
      delta: -remaining, removed: [], active: false });
  }
  c.spiderRowCounts.clear();
  for (const f of c.all) {
    if (f.alive && f.skillFamily === SPIDER_SOUL_FAMILY && f.star === 3) {
      c.spiderRowCounts.set(f.uid, c.all.filter((enemy) => enemy.alive && enemy.side !== f.side && enemy.row === f.row).length);
    }
  }
  // The 3★ immediate heal happens before DoTs at the start of the following cycle.
  for (const f of c.all) {
    if (f.alive && f.oath?.cycle === c.cycle && f.oath.star === 3) {
      heal(c, f, f, combatStat(f, "atk"));
    }
  }
  // Snapshot active effects before any disease spread applies new ones to other fighters.
  const activeDots = c.all.map((f) => DOTS.map((kind) => f.status[kind] ?? null));
  for (let i = 0; i < c.all.length; i++) {
    const f = c.all[i]!;
    if (!f.alive) continue;
    for (let j = 0; j < DOTS.length; j++) {
      const k = DOTS[j]!;
      const s = activeDots[i]![j];
      if (!s?.turns) continue;
      const fireVulnerability = k === "burn"
        ? f.env.fireVuln * ((f.status.fireVulnerability?.turns ?? 0) > 0 ? Math.max(1, f.status.fireVulnerability!.value) : 1)
        : 1;
      const dmg = Math.max(1, Math.round(s.value * fireVulnerability * c.globalMult));
      applyDamage(c, f, dmg, null, (_absorbed, appliedDamage) => ({ t: "dot", dst: f.uid, kind: k, dmg: appliedDamage }));
      if (k === "disease" && dmg > 0) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const neighbor = c.all.find((x) => x.alive && x.side === f.side && x.row === f.row + dr && x.col === f.col + dc);
          if (neighbor && !((neighbor.status.disease?.turns ?? 0) > 0)) applyStatus(c, neighbor, "disease", 2, dmg);
        }
      }
      if (--s.turns <= 0) delete f.status[k];
      if (!f.alive) break;
    }
    if (!f.alive || f.env.poisonAura <= 0) continue;
    const dmg = f.env.poisonAura;
    applyDamage(c, f, dmg, null, (_absorbed, appliedDamage) => ({ t: "dot", dst: f.uid, kind: "poisonAura", dmg: appliedDamage }));
  }
  // Spore pools score after DoTs, so an enemy killed by a DoT this boundary gives no point.
  tickSporePools(c);
}

/** A79: capture control state first, then resolve timed triggers and one canonical duration tick. */
function startTurn(c: Ctx, f: Fighter): TurnGate {
  const skip = CONTROL_PRIORITY.find((k) => (f.status[k]?.turns ?? 0) > 0) ?? null;
  const silenced = (f.status.silence?.turns ?? 0) > 0;
  const disarmed = (f.status.disarm?.turns ?? 0) > 0;
  // DOT damage and DOT duration expiry are owned by startCycle, never by this action.
  const hot = f.status.hot;
  if (hot?.turns && f.alive) {
    const healer = hot.source
      ? c.all.find((candidate) => candidate.uid === hot.source!.unitUid) ?? f
      : f;
    heal(c, healer, f, f.maxHp * hot.value);
    if (--hot.turns <= 0) delete f.status.hot;
  }
  // Environment aura damage shares the cycle boundary with DOTs.
  f.mods = f.mods.filter((m) => --m.turns > 0);
  if (f.reflect && --f.reflect.turns <= 0) f.reflect = null;
  if (f.counterTurns > 0) f.counterTurns -= 1;
  if (f.berserk && --f.berserk.turns <= 0) f.berserk = null;
  for (const [k, s] of Object.entries(f.status)) {
    if (DOTS.includes(k as (typeof DOTS)[number])) continue;
    if (k === "hardBeakVulnerability") continue;
    if (k.startsWith(TIDE_SHIELD_PREFIX)) continue;
    if (k === "hot" || s.permanent) continue;
    if (CONTROL_PRIORITY.includes(k as (typeof CONTROL_PRIORITY)[number]) && k !== skip) continue;
    if (--s.turns <= 0) {
      delete f.status[k];
      if (k === "taunt") f.tauntBy = null;
      if (k === "paralyze") c.events.push({ t: "status", dst: f.uid, kind: k, turns: 0 });
    }
  }
  if (skip) c.events.push({ t: "skip", src: f.uid, reason: skip });
  return { canAct: !skip, silenced, disarmed };
}

function act(c: Ctx, f: Fighter) {
  if (!f.alive) return;
  const gate = startTurn(c, f);
  if (!gate.canAct) return;
  const target = basicTarget(c, f);
  if (!target) {
    c.events.push({ t: "skip", src: f.uid, reason: "no-target" });
    return;
  }
  if (f.rage >= f.rageMax && !gate.silenced && f.skillFamily) {
    castSkill(c, f, target);
    return;
  }
  if (gate.disarmed) {
    c.events.push({ t: "skip", src: f.uid, reason: "disarm" });
    return;
  }
  basicAttack(c, f, target);
  // Oath recovery is cycle-scoped, independent of the number of actions or hits.
  // SUPPORT auto-cast is scheduled from positive basic-hit aftermath inside strike() (A74/A120).
}

/** Reject malformed placements and ambiguous event identities once per public combat call. */
function validateCombatRoster(all: readonly Fighter[]): void {
  const seen = new Set<string>();
  for (const fighter of all) {
    const validSide = fighter.side === "L" || fighter.side === "R";
    const minCol = fighter.side === "L" ? 0 : COLS / 2;
    const maxCol = fighter.side === "L" ? COLS / 2 : COLS;
    if (!validSide || !Number.isInteger(fighter.row) || fighter.row < 0 || fighter.row >= ROWS
      || !Number.isInteger(fighter.col) || fighter.col < minCol || fighter.col >= maxCol) {
      throw new RangeError(`Invalid combat position: ${fighter.uid} (${fighter.side}, ${fighter.col}, ${fighter.row})`);
    }
    if (seen.has(fighter.uid)) throw new Error(`Duplicate combat UID: ${fighter.uid}`);
    seen.add(fighter.uid);
  }
}

/** A11 queue: per side scan order, then interleave L0,R0,L1,R1… (empty cells only affect presentation timing). */
export function turnOrder(all: Fighter[]): Fighter[] {
  validateCombatRoster(all);
  const order: Fighter[] = [];
  for (const entry of turnTimeline(all)) {
    if (entry.kind === "unit") order.push(entry.fighter);
  }
  return order;
}

type TurnTimelineEntry =
  | { kind: "empty"; side: Side; row: number; col: number }
  | { kind: "unit"; fighter: Fighter };

function turnChunks(all: Fighter[], side: Side): TurnTimelineEntry[][] {
  const occupants = new Map<number, Fighter[]>();
  for (const fighter of all) {
    if (!fighter.alive || fighter.side !== side) continue;
    const key = fighter.col * ROWS + fighter.row;
    const cell = occupants.get(key);
    if (cell) cell.push(fighter);
    else occupants.set(key, [fighter]);
  }
  for (const cell of occupants.values()) {
    cell.sort((a, b) => a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);
  }

  const chunks: TurnTimelineEntry[][] = [];
  let chunk: TurnTimelineEntry[] = [];
  const firstCol = side === "L" ? 4 : 5;
  const endCol = side === "L" ? -1 : 10;
  const step = side === "L" ? -1 : 1;
  for (let col = firstCol; col !== endCol; col += step) {
    for (let row = 0; row < ROWS; row++) {
      const cell = occupants.get(col * ROWS + row);
      if (!cell) {
        chunk.push({ kind: "empty", side, row, col });
        continue;
      }
      for (const fighter of cell) {
        chunk.push({ kind: "unit", fighter });
        chunks.push(chunk);
        chunk = [];
      }
    }
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

function turnTimeline(all: Fighter[]): TurnTimelineEntry[] {
  const left = turnChunks(all, "L");
  const right = turnChunks(all, "R");
  const timeline: TurnTimelineEntry[] = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) timeline.push(...left[i]!);
    if (right[i]) timeline.push(...right[i]!);
  }
  return timeline;
}

function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run a full combat from already-materialized authoritative Fighters.
 * Deterministic for identical freshly-materialized input + seed.
 */
export function simulate(all: Fighter[], o: CombatOptions): CombatResult {
  validateCombatRoster(all);
  const inspectionFrames: CombatInspectionFrame[] | undefined = o.captureInspection
    ? [{ eventIndex: 0, cycle: 1, units: all.map(snapshotFighter) }] : undefined;
  const total = {
    L: all.filter((f) => f.side === "L").length,
    R: all.filter((f) => f.side === "R").length,
  };
  const c: Ctx = {
    all, rng: mulberry(o.seed), events: [], globalMult: 1,
    gold: { L: o.gold?.L ?? 0, R: o.gold?.R ?? 0 },
    rageGain: { L: o.rageGain?.L ?? 1, R: o.rageGain?.R ?? 1 },
    rightRandomTargetChance: Math.min(1, Math.max(0, o.rightRandomTargetChance ?? 0)),
    deterministicTargeting: o.deterministicTargeting ?? false,
    bounty: { L: 0, R: 0 },
    bountyKills: { L: 0, R: 0 },
    deferredAutoCasts: [],
    autoCastInFlight: new Set<Fighter>(),
    cycle: 0,
    spores: newSporeState(),
    kissHits: new Map(),
    spiderRowCounts: new Map(),
  };
  const count = (side: Side) => all.filter((f) => f.side === side && f.alive).length;
  let actions = 0;
  const consumedBlessings: WeatherBlessingId[] = [];
  outer: for (let cycle = 0; cycle < CYCLE_CAP; cycle++) {
    if (!count("L") || !count("R")) break outer;
    const blessing = o.orderedBlessings?.[consumedBlessings.length];
    if (blessing) consumedBlessings.push(blessing);
    c.events.push({ t: "cycle", cycle: cycle + 1 });
    c.cycle = cycle + 1;
    // DOTs resolve at one shared boundary before either side acts.
    startCycle(c);
    inspectionFrames?.push({ eventIndex: c.events.length, cycle: cycle + 1, units: all.map(snapshotFighter) });
    if (!count("L") || !count("R")) break outer;
    for (const entry of turnTimeline(all)) {
      if (!count("L") || !count("R")) break outer;
      if (entry.kind === "empty" || !entry.fighter.alive) {
        c.events.push(entry.kind === "empty"
          ? { t: "empty", side: entry.side, row: entry.row, col: entry.col }
          : { t: "empty", side: entry.fighter.side, row: entry.fighter.row, col: entry.fighter.col });
        continue;
      }
      act(c, entry.fighter);
      flushDeferredAutoCasts(c);
      inspectionFrames?.push({ eventIndex: c.events.length, cycle: cycle + 1, units: all.map(snapshotFighter) });
      actions++;
      // A17 anti-stall: after action 100, every 5th action +0.2 global damage.
      if (actions > 100 && actions % 5 === 0) c.globalMult += 0.2;
    }
    // Cycle end: Sương Độc detonations resolve once both sides have acted.
    if (burstSporePools(c)) {
      flushDeferredAutoCasts(c);
      inspectionFrames?.push({ eventIndex: c.events.length, cycle: cycle + 1, units: all.map(snapshotFighter) });
    }
    // Oath expires at this exact round boundary; 3★ cleanses one uniformly chosen debuff.
    for (const f of all) {
      if (f.oath?.cycle !== c.cycle) continue;
      if (f.alive && f.oath.star === 3) cleanseRandomDebuffs(c, f, 1);
      f.oath = null;
    }
    // 1★ vulnerability lasts through the current shared round, not the target's action.
    for (const f of all) {
      if ((f.status.hardBeakVulnerability?.value ?? 0) <= 1 / 3) delete f.status.hardBeakVulnerability;
    }
  }
  const alive = { L: count("L"), R: count("R") };
  return {
    winner: alive.L && !alive.R ? "L" : alive.R && !alive.L ? "R" : null,
    alive, total, bounty: c.bounty, bountyKills: c.bountyKills, actions, events: c.events,
    consumedBlessings,
    fighters: all.map(cloneFighter),
    survivors: all.filter((f) => f.alive).map(cloneFighter),
    ...(inspectionFrames ? { inspectionFrames } : {}),
  };
}
