// Deterministic combat engine (spec A11–A18, A73, A74, A120). Pure: no rendering, timers or audio.
// Presentation replays `events` in order; HP/status changes are already resolved per event.
import { getUnit, type Element, type Faction, type Role } from "../content/catalog";
import { STAR_EFFECT_CHANCE, STAR_SKILL, STAR_STAT } from "./economy";
import { skillSpec, type BuffStat, type DamageType, type SkillSelector, type SkillSpec, type Stat, type StatMod } from "./skills";
import { CLASS_COUNTER, COUNTER_BONUS, ELEMENT_COUNTER } from "./synergy";
import { environmentMods, type EnvironmentId, type EnvMods } from "./environment";
import { slotCapForUnit, sumEquipmentBonuses, type EquipmentBonuses } from "./equipment";
import { sumVariantBonuses, type VariantBonuses, type VariantTraitRef } from "./variants";

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
const CONTROL_PRIORITY = ["freeze", "stun", "sleep"] as const;
const DOTS = ["burn", "poison", "bleed", "disease"] as const;

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
  source?: SkillStatusSource;
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
  /** A32 environment mods read at the owning event (vulnerability, heal received, accuracy, aura). */
  env: EnvMods;
}

/** Staged start-of-combat bonuses from persistent state or final-formation synergy. */
export type SideBonus = Partial<Record<
  "def" | "mdef" | "atkPct" | "matkPct" | "hpPct" | "defPct" | "mdefPct" | "healPct" | "startShield" | "startRage"
  | "burn" | "poison" | "critPct" | "evadePct" | "lifestealPct" | "rageGainPct", number>>;

export interface Placement {
  uid: string; baseId: string; star: number; row: number; col: number;
  equips?: string[];
  traits?: VariantTraitRef[];
}

export type CombatEvent =
  | { t: "basic" | "skill"; src: string; dst: string; dmg: number; absorbed: number; crit: boolean }
  | { t: "reflect"; src: string; dst: string; dmg: number; absorbed: number }
  | { t: "miss"; src: string; dst: string }
  | { t: "cast"; src: string; targets: string[]; trigger?: "TANKER" | "SUPPORT" }
  | { t: "dot"; dst: string; kind: string; dmg: number }
  | { t: "heal"; src: string; dst: string; amount: number }
  | { t: "shield"; src: string; dst: string; amount: number }
  | { t: "status"; dst: string; kind: string; turns: number; source?: SkillStatusSource }
  | { t: "revive"; src: string; dst: string; hp: number }
  | { t: "skip"; src: string; reason: string }
  | { t: "death"; dst: string };

export interface CombatResult {
  winner: Side | null;
  alive: Record<Side, number>;
  total: Record<Side, number>;
  /** Assassin last-hit bounty, paid even on loss (A14/A18). */
  bounty: Record<Side, number>;
  bountyKills: Record<Side, number>;
  actions: number;
  events: CombatEvent[];
  survivors: Fighter[];
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

export interface CombatOptions {
  seed: number;
  captureInspection?: boolean;
  /** Owner gold per side for the A13 gold-reserve skill multiplier. */
  gold?: Partial<Record<Side, number>>;
  /** Basic-hit attacker rage per side; AI difficulty sets R (A74). */
  rageGain?: Partial<Record<Side, number>>;
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
    reflect: null, counterTurns: 0, phoenix: { armed: false, used: false, revivePct: 0.3 }, berserk: null,
    env: environmentMods(undefined, u.element),
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

function stat(f: Fighter, s: BuffStat): number {
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
    uid: f.uid, hp: f.hp, maxHp: f.maxHp, atk: stat(f, "atk"), matk: stat(f, "matk"),
    atkBeforePassive: modifiedStat(f, "atk"),
    def: stat(f, "def"), mdef: stat(f, "mdef"), range: f.range,
    rage: f.rage, rageMax: f.rageMax, shield: f.shield, evade: stat(f, "evade"),
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
) {
  if (!dst.alive || turns <= 0) return;
  const cur = dst.status[kind];
  const nextTurns = Math.max(turns, cur?.turns ?? 0);
  const nextValue = Math.max(value, cur?.value ?? 0);
  const changed = !cur || cur.turns !== nextTurns || cur.value !== nextValue;
  // Never shorten; keep the stronger payload (A73). A89 source changes only when the merged state changes.
  if (!cur) {
    dst.status[kind] = source
      ? { turns: nextTurns, value: nextValue, source: { ...source, turns: nextTurns, value: nextValue } }
      : { turns: nextTurns, value: nextValue };
  } else if (changed) {
    cur.turns = nextTurns;
    cur.value = nextValue;
    if (source) cur.source = { ...source, turns: nextTurns, value: nextValue };
    else delete cur.source;
  }
  const event: Extract<CombatEvent, { t: "status" }> = { t: "status", dst: dst.uid, kind, turns: nextTurns };
  if (dst.status[kind]?.source) event.source = dst.status[kind]!.source;
  c.events.push(event);
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

/** Shield first, then HP. Attack callers may defer lethal resolution until A120 aftermath completes. */
function applyDamage(
  c: Ctx,
  dst: Fighter,
  dmg: number,
  killer: Fighter | null,
  event: (absorbed: number) => CombatEvent,
  deferDeath = false,
) {
  const absorbed = Math.min(dst.shield, dmg);
  dst.shield -= absorbed;
  const toHp = Math.min(dst.hp, dmg - absorbed);
  dst.hp -= toHp;
  c.events.push(event(absorbed));
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
    (absorbed) => ({ t: "reflect", src: defender.uid, dst: attacker.uid, dmg, absorbed }), true);
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
}

function basicAttack(c: Ctx, src: Fighter, dst: Fighter, options: StrikeOptions = {}) {
  const magic = src.role === "MAGE" || src.role === "SUPPORT" || src.basicDamageType === "magic";
  return strike(c, src, dst, stat(src, magic ? "matk" : "atk"), magic ? "magic" : "physical", false, options);
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
  let hit = src.accuracy + src.env.accuracy - stat(dst, "evade");
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
  const isCrit = type !== "true" && c.rng() < crit;
  if (isCrit) dmg *= critMult;
  else if (type === "physical") dmg = (dmg * 100) / (100 + stat(dst, "def"));
  else if (type === "magic") dmg = (dmg * 100) / (100 + stat(dst, "mdef"));
  dmg = Math.max(1, Math.round(dmg * c.globalMult));
  const resolved = applyDamage(c, dst, dmg, src,
    (absorbed) => ({ t: skill ? "skill" : "basic", src: src.uid, dst: dst.uid, dmg, absorbed, crit: isCrit }), true);

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
    const lifesteal = src.lifesteal + (activeBerserk(src)?.lifestealPct ?? 0);
    if (src.hp > 0 && lifesteal > 0) heal(c, src, src, resolved.hp * lifesteal);
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
  return s === "hp" ? f.maxHp : stat(f, s);
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
    case "self": return [f];
    case "lowest_hp_pct":
    case "lowest_hp_pct_ally":
      return take([...stable].sort((a, b) => hpRatio(a) - hpRatio(b) || stableIndex(a) - stableIndex(b)));
    case "highest_rage":
      return take([...stable].sort((a, b) => b.rage - a.rage || stableIndex(a) - stableIndex(b)));
    case "lowest_rage_ally":
      return take([...stable].sort((a, b) => a.rage - b.rage || stableIndex(a) - stableIndex(b)));
    case "highest_matk":
      return take([...stable].sort((a, b) => stat(b, "matk") - stat(a, "matk") || stableIndex(a) - stableIndex(b)));
    case "highest_atk":
      return take([...stable].sort((a, b) => stat(b, "atk") - stat(a, "atk") || stableIndex(a) - stableIndex(b)));
    case "highest_max_hp_front":
      return take(extremeColumn(stable, false).sort((a, b) => b.maxHp - a.maxHp || stableIndex(a) - stableIndex(b)));
    case "lowest_def_front":
      return take(extremeColumn(stable, false).sort((a, b) => stat(a, "def") - stat(b, "def") || stableIndex(a) - stableIndex(b)));
    case "lowest_mdef_backline":
      return take(extremeColumn(stable, true).sort((a, b) => stat(a, "mdef") - stat(b, "mdef") || stableIndex(a) - stableIndex(b)));
    case "highest_atk_backline":
      return take(extremeColumn(stable, true).sort((a, b) => stat(b, "atk") - stat(a, "atk") || stableIndex(a) - stableIndex(b)));
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
      return take(clustered(stable, "row", (xs) => xs.reduce((n, x) => n + stat(x, "atk"), 0)));
    case "highest_total_atk_col":
      return take(clustered(stable, "col", (xs) => xs.reduce((n, x) => n + stat(x, "atk"), 0)));
    case "random_unique": {
      const bag = [...pool];
      const out: Fighter[] = [];
      while (bag.length && out.length < max) out.push(bag.splice(Math.floor(c.rng() * bag.length), 1)[0]!);
      return out;
    }
    case "random":
      return Array.from({ length: max }, () => pool[Math.floor(c.rng() * pool.length)]!);
    case "same_row":
    case "same_row_carry": {
      const row = stable.filter((x) => x.row === f.row);
      if (selector === "same_row_carry") {
        row.sort((a, b) => Math.max(stat(b, "atk"), stat(b, "matk")) - Math.max(stat(a, "atk"), stat(a, "matk"))
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
  if (sp.area === "column") return pool.filter((x) => x.col === p.col);
  if (sp.area === "square") return pool.filter((x) => Math.abs(x.row - p.row) <= 1 && Math.abs(x.col - p.col) <= 1);
  return ordered;
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
        dead.status = {}; dead.mods = []; dead.rage = 0;
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
      applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: k, dmg }));
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
    applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: "poisonAura", dmg }));
  }
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
    if (k === "hot") continue;
    if (CONTROL_PRIORITY.includes(k as (typeof CONTROL_PRIORITY)[number]) && k !== skip) continue;
    if (--s.turns <= 0) {
      delete f.status[k];
      if (k === "taunt") f.tauntBy = null;
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
  // SUPPORT auto-cast is scheduled from positive basic-hit aftermath inside strike() (A74/A120).
}

/** A11 queue: per side scan order, then interleave L0,R0,L1,R1… (empty cells only affect presentation timing). */
export function turnOrder(all: Fighter[]): Fighter[] {
  const scan = (side: Side) => all.filter((f) => f.side === side && f.alive)
    .sort((a, b) => (side === "L" ? b.col - a.col : a.col - b.col) || a.row - b.row);
  const l = scan("L");
  const r = scan("R");
  const out: Fighter[] = [];
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    if (l[i]) out.push(l[i]!);
    if (r[i]) out.push(r[i]!);
  }
  return out;
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
  };
  const count = (side: Side) => all.filter((f) => f.side === side && f.alive).length;
  let actions = 0;
  outer: for (let cycle = 0; cycle < CYCLE_CAP; cycle++) {
    // One shared start-of-cycle boundary for both sides, regardless of turn order.
    startCycle(c);
    inspectionFrames?.push({ eventIndex: c.events.length, cycle: cycle + 1, units: all.map(snapshotFighter) });
    if (!count("L") || !count("R")) break;
    for (const f of turnOrder(all)) {
      if (!count("L") || !count("R")) break outer;
      if (!f.alive) continue;
      act(c, f);
      flushDeferredAutoCasts(c);
      inspectionFrames?.push({ eventIndex: c.events.length, cycle: cycle + 1, units: all.map(snapshotFighter) });
      actions++;
      // A17 anti-stall: after action 100, every 5th action +0.2 global damage.
      if (actions > 100 && actions % 5 === 0) c.globalMult += 0.2;
    }
  }
  const alive = { L: count("L"), R: count("R") };
  return {
    winner: alive.L && !alive.R ? "L" : alive.R && !alive.L ? "R" : null,
    alive, total, bounty: c.bounty, bountyKills: c.bountyKills, actions, events: c.events,
    survivors: all.filter((f) => f.alive),
    ...(inspectionFrames ? { inspectionFrames } : {}),
  };
}
