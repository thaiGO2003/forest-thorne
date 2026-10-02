// Deterministic combat engine (spec A11–A18, A73, A74). Pure: no rendering, timers or audio.
// Presentation replays `events` in order; HP/status changes are already resolved per event.
import { getUnit, type Element, type Role } from "../content/catalog";
import { STAR_SKILL, STAR_STAT } from "./economy";
import { skillSpec, type BuffStat, type SkillSelector, type SkillSpec, type Stat } from "./skills";
import { CLASS_COUNTER, COUNTER_BONUS, ELEMENT_COUNTER } from "./synergy";
import { environmentMods, type EnvironmentId, type EnvMods } from "./environment";
import { slotCapForUnit, sumEquipmentBonuses } from "./equipment";
import { sumVariantBonuses, type VariantTraitRef } from "./variants";

export type Side = "L" | "R";
export const COLS = 10;
export const ROWS = 5;
const CYCLE_CAP = 20;
const ROLE_EVADE: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.08, ASSASSIN: 0.15, ARCHER: 0.1, MAGE: 0.05, SUPPORT: 0.07 };
const ROLE_CRIT: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.05, ASSASSIN: 0.25, ARCHER: 0.2, MAGE: 0.1, SUPPORT: 0.05 };
const STAR_DOT = [0, 1, 1.3, 1.6];
const CONTROL_PRIORITY = ["freeze", "stun", "sleep"] as const;
const CONTROL_STATUS = ["freeze", "stun", "sleep", "silence", "disarm", "taunt"] as const;
const DOTS = ["burn", "poison", "bleed", "disease"] as const;
const CLEANSE_ORDER = [
  "freeze", "stun", "sleep", "silence", "disarm", "taunt",
  "burn", "poison", "bleed", "disease", "fireVulnerability", "healBlock", "healReduction", "shieldLock",
  "armorBreak", "offenseDebuff", "accuracyDebuff", "evadeDebuff",
] as const;

interface Mod { stat: BuffStat; value: number; pct: boolean; turns: number; source?: string }

export interface CombatStatus {
  turns: number;
  value: number;
  sourceUid?: string;
  linkUid?: string;
  charges?: number;
  percent?: boolean;
  healMult?: number;
  shieldPct?: number;
  cleanseCount?: number;
  rageGain?: number;
  lifestealPct?: number;
  firstBasicMult?: number;
  firstBasicReady?: boolean;
  onKillRage?: number;
  extendOnKill?: number;
  chainBasics?: number;
  stacks?: number;
  maxStacks?: number;
  antiHeal?: boolean;
  healFlat?: number;
  shieldFlat?: number;
  healPctMaxHp?: number;
  followupReductionPct?: number;
  followupReductionTurns?: number;
  followupHotPctMaxHp?: number;
  followupHotTurns?: number;
  offenseDebuffValue?: number;
  offenseDebuffTurns?: number;
}

export interface Fighter {
  uid: string; baseId: string; star: number; side: Side; row: number; col: number;
  role: Role; element: Element;
  maxHp: number; hp: number; atk: number; def: number; matk: number; mdef: number;
  range: number; rageMax: number; rage: number; shield: number; alive: boolean;
  crit: number; critDmg: number; accuracy: number; evade: number; lifesteal: number; rageGainPct: number; healPct: number;
  onHitBurn: number; onHitPoison: number;
  /** Canonical timed gameplay statuses and their mechanic-specific payloads (A73). */
  status: Record<string, CombatStatus>;
  mods: Mod[];
  /** Uid of the unit that taunted this fighter while `status.taunt` is active. */
  tauntBy: string | null;
  /** Re-entrancy guard: TANKER auto-cast cannot recurse inside its own skill. */
  casting: boolean;
  /** Phoenix-style lethal recovery is a once-per-unit combat resource (A74). */
  revivePct: number;
  reviveUsed: boolean;
  /** A32 environment mods read at the owning event (vulnerability, heal received, accuracy, aura). */
  env: EnvMods;
}

/** Flat/percent start-of-combat bonuses from synergy, tech and augments (summed by caller). */
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
  | { t: "miss"; src: string; dst: string }
  | { t: "cast"; src: string; targets: string[] }
  | { t: "dot"; dst: string; kind: string; dmg: number }
  | { t: "heal"; src: string; dst: string; amount: number }
  | { t: "shield"; src: string; dst: string; amount: number }
  | { t: "status"; dst: string; kind: string; turns: number }
  | { t: "cleanse"; dst: string; kind: string }
  | { t: "redirect"; src: string; from: string; dst: string; dmg: number; absorbed: number }
  | { t: "reflect"; src: string; dst: string; dmg: number }
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
}

export interface CombatOptions {
  seed: number;
  /** Owner gold per side for the A13 gold-reserve skill multiplier. */
  gold?: Partial<Record<Side, number>>;
  bonus?: Partial<Record<Side, SideBonus>>;
  /** Basic-hit attacker rage per side; AI difficulty sets R (A74). */
  rageGain?: Partial<Record<Side, number>>;
  /** A32 active battlefield environment for this round. */
  environment?: EnvironmentId;
}

/** A13: 1.0 at ≤10 gold; +1% per 2 gold above 10; capped at 2.0. */
export function goldMultiplier(gold: number): number {
  if (!(gold > 10)) return 1;
  return Math.min(2, 1 + (gold - 10) / 2 / 100);
}

/** A74 incidental tier stun hook for effects that explicitly opt into tier-based stun. */
export function tierStunChance(tier: number): number {
  return tier >= 5 ? 0.3 : tier === 4 ? 0.2 : 0;
}

export function makeFighter(p: Placement, side: Side, b: SideBonus = {}, environment?: EnvironmentId): Fighter {
  const u = getUnit(p.baseId);
  const env = environmentMods(environment, u.element);
  const m = STAR_STAT[p.star] ?? 1;
  const st = u.stats;
  const equipment = sumEquipmentBonuses(p.equips ?? [], p.star, slotCapForUnit(u, p.star));
  const traits = sumVariantBonuses(u.role, p.traits ?? []);
  const hpPct = (b.hpPct ?? 0) + (equipment.hpPct ?? 0) + (traits.hpPct ?? 0);
  const atkPct = (b.atkPct ?? 0) + (equipment.atkPct ?? 0) + (traits.atkPct ?? 0);
  const matkPct = (b.matkPct ?? 0) + (equipment.matkPct ?? 0) + (traits.matkPct ?? 0);
  const maxHp = Math.round(st.hp * m * (1 + hpPct / 100));
  // Scaled base-stat evasion: +5pp at 2★, +10pp at 3★, capped 60% (A12).
  const evadePct = (b.evadePct ?? 0) + (equipment.evadePct ?? 0) + (traits.evadePct ?? 0);
  const evade = Math.min(0.6, ROLE_EVADE[u.role] + (st.evade ?? 0) + (p.star - 1) * 0.05) + evadePct / 100 + env.evade;
  const rageMax = Math.max(1, u.skill.rageCost[p.star - 1] ?? st.rageMax);
  const equipmentRage = Math.min(4, Math.max(0, Math.round(equipment.startingRage ?? 0)));
  const pendingRage = Math.min(4, Math.max(0, Math.round((b.startRage ?? 0) + (traits.startingRage ?? 0) + env.startRage)));
  return {
    uid: p.uid, baseId: p.baseId, star: p.star, side, row: p.row, col: p.col, role: u.role, element: u.element,
    maxHp, hp: maxHp,
    atk: Math.max(1, Math.round(st.atk * m * (1 + atkPct / 100) * (1 + env.atkPct))),
    def: Math.round(st.def * m * (1 + (b.defPct ?? 0) / 100) + (b.def ?? 0) + (equipment.def ?? 0) + (traits.def ?? 0) + env.def),
    matk: Math.max(1, Math.round(st.matk * m * (1 + matkPct / 100) * (1 + env.matkPct))),
    mdef: Math.round(st.mdef * m * (1 + (b.mdefPct ?? 0) / 100) + (b.mdef ?? 0) + (equipment.mdef ?? 0) + (traits.mdef ?? 0) + env.mdef),
    range: st.range, rageMax,
    rage: Math.min(rageMax, equipmentRage + pendingRage),
    shield: (b.startShield ?? 0) + (equipment.startingShield ?? 0) + (traits.startingShield ?? 0) + env.startShield, alive: true,
    crit: ROLE_CRIT[u.role] + (st.crit ?? 0) + ((b.critPct ?? 0) + (equipment.critPct ?? 0) + (traits.critPct ?? 0)) / 100 + env.critPct,
    critDmg: st.critDmg ?? 1.5,
    accuracy: st.accuracy ?? 0.95,
    evade, lifesteal: Math.max(0, ((b.lifestealPct ?? 0) + (equipment.lifestealPct ?? 0) + (traits.lifestealPct ?? 0)) / 100 + env.lifesteal),
    rageGainPct: (b.rageGainPct ?? 0) / 100 + env.rageGainPct,
    healPct: ((b.healPct ?? 0) + (equipment.healPct ?? 0) + (traits.healPct ?? 0)) / 100 + env.healPct,
    onHitBurn: (b.burn ?? 0) + (equipment.burnOnHit ?? 0) + env.burnOnHit,
    onHitPoison: (b.poison ?? 0) + (equipment.poisonOnHit ?? 0) + env.poisonOnHit,
    status: {}, mods: [], tauntBy: null, casting: false, revivePct: 0, reviveUsed: false, env,
  };
}

const dist = (a: Fighter, b: Fighter) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
/** A11 row sweep: same row, above, below, two above, two below. */
const rowRank = (from: number, to: number) => {
  const d = to - from;
  return d === 0 ? 0 : d < 0 ? -2 * d - 1 : 2 * d;
};
/** Column distance from the front line of the defender's side (front = col 4 for L, 5 for R). */
const depth = (f: Fighter) => (f.side === "L" ? 4 - f.col : f.col - 5);

function stat(f: Fighter, s: BuffStat): number {
  const base = s === "evade" ? f.evade : f[s];
  let flat = 0;
  let pct = 0;
  for (const m of f.mods) if (m.stat === s) m.pct ? (pct += m.value) : (flat += m.value);
  const offense = f.status.offenseDebuff;
  if (offense?.turns) {
    const offenseStat = f.role === "MAGE" || f.role === "SUPPORT" ? "matk" : "atk";
    if (s === offenseStat) offense.percent ? (pct -= offense.value) : (flat -= offense.value);
  }
  let v = base * (1 + pct / 100) + (s === "evade" ? flat / 100 : flat);
  // FIGHTER: +1% ATK per 1% missing HP (A14).
  if (s === "atk" && f.role === "FIGHTER") {
    const missingPct = Math.min(1, Math.max(0, (f.maxHp - f.hp) / f.maxHp));
    v = Math.round(v * (1 + missingPct));
  }
  if (s === "evade") return Math.min(0.75, Math.max(0, v));
  return s === "atk" || s === "matk" ? Math.max(1, v) : Math.max(0, v);
}

interface Ctx {
  all: Fighter[];
  rng: () => number;
  events: CombatEvent[];
  globalMult: number;
  gold: Record<Side, number>;
  rageGain: Record<Side, number>;
  bounty: Record<Side, number>;
  bountyKills: Record<Side, number>;
}

const foes = (c: Ctx, f: Fighter) => c.all.filter((x) => x.alive && x.side !== f.side);
const friends = (c: Ctx, f: Fighter) => c.all.filter((x) => x.alive && x.side === f.side);
const hpRatio = (f: Fighter) => f.hp / f.maxHp;
const addRage = (f: Fighter, n: number) => { f.rage = Math.min(f.rageMax, Math.max(0, f.rage + n)); };

/** A11 basic target: taunt first; then row sweep; melee front-first, assassin back-first, ranged in-range first. */
function basicTarget(c: Ctx, f: Fighter): Fighter | null {
  const list = foes(c, f);
  const taunter = f.status.taunt?.turns ? list.find((x) => x.uid === f.tauntBy) : undefined;
  if (taunter) return taunter;
  const back = f.role === "ASSASSIN" ? -1 : 1;
  // ponytail: no movement on the battlefield; ranged out of range falls back to the same order so combat never stalls.
  const inRange = (x: Fighter) => (f.range >= 2 && dist(f, x) > f.range ? 1 : 0);
  list.sort((a, b) => inRange(a) - inRange(b) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
    || back * (depth(a) - depth(b)) || a.uid.localeCompare(b.uid));
  return list[0] ?? null;
}

function hasStatus(f: Fighter, kind: string): boolean {
  return (f.status[kind]?.turns ?? 0) > 0;
}

function applyStatus(c: Ctx, dst: Fighter, kind: string, turns: number, value = 0, payload: Partial<CombatStatus> = {}) {
  if (!dst.alive || turns <= 0) return false;
  if ((CONTROL_STATUS as readonly string[]).includes(kind) && kind !== "taunt" && hasStatus(dst, "immunity")) return false;
  const cur = dst.status[kind];
  // Never shorten; keep the stronger payload (A73).
  const useNewPayload = !cur || value >= cur.value || turns > cur.turns;
  dst.status[kind] = {
    ...(cur ?? { turns: 0, value: 0 }),
    ...(useNewPayload ? payload : {}),
    turns: Math.max(turns, cur?.turns ?? 0),
    value: Math.max(value, cur?.value ?? 0),
  };
  c.events.push({ t: "status", dst: dst.uid, kind, turns: dst.status[kind]!.turns });
  return true;
}

function cleanse(c: Ctx, dst: Fighter, count: number): number {
  let removed = 0;
  for (const kind of CLEANSE_ORDER) {
    if (removed >= count) break;
    if (!hasStatus(dst, kind)) continue;
    delete dst.status[kind];
    if (kind === "taunt") dst.tauntBy = null;
    c.events.push({ t: "cleanse", dst: dst.uid, kind });
    removed++;
  }
  return removed;
}

function healReduction(c: Ctx, dst: Fighter): number {
  const block = dst.status.healBlock;
  if (block?.turns && block.sourceUid && !c.all.some((x) => x.alive && x.uid === block.sourceUid)) delete dst.status.healBlock;
  if (hasStatus(dst, "healBlock")) return 1;
  return Math.min(1, Math.max(0, (dst.status.healReduction?.value ?? 0) / 100));
}

function grantShield(c: Ctx, src: Fighter, dst: Fighter, raw: number): number {
  if (!dst.alive || hasStatus(dst, "shieldLock")) return 0;
  const amount = Math.max(1, Math.round(raw));
  dst.shield += amount;
  c.events.push({ t: "shield", src: src.uid, dst: dst.uid, amount });
  return amount;
}

function heal(c: Ctx, src: Fighter, dst: Fighter, raw: number, redirected = false, prescaled = false): number {
  if (!dst.alive || raw <= 0) return 0;
  const beforeRatio = dst.hp / dst.maxHp;
  const scaled = prescaled ? raw : raw * (1 + src.healPct) * (1 + dst.env.healRecvPct);
  const amount = Math.min(dst.maxHp - dst.hp, Math.max(0, Math.round(scaled * (1 - healReduction(c, dst)))));
  if (amount <= 0) return 0;
  if (!redirected) {
    const linked = c.all.filter((x) => x.alive && x.uid !== dst.uid && x.status.soulLink?.turns && x.status.soulLink.sourceUid === dst.uid)
      .sort((a, b) => ((b.status.soulLink?.rageGain ?? 0) + (b.status.soulLink?.cleanseCount ?? 0))
        - ((a.status.soulLink?.rageGain ?? 0) + (a.status.soulLink?.cleanseCount ?? 0))
        || (b.status.soulLink?.healMult ?? 1) - (a.status.soulLink?.healMult ?? 1)
        || a.uid.localeCompare(b.uid));
    if (linked.length) {
      for (let i = 0; i < linked.length; i++) {
        const recipient = linked[i]!;
        const link = recipient.status.soulLink!;
        heal(c, src, recipient, amount * (link.healMult ?? 1), true, true);
        if (beforeRatio > 0.5 && (link.shieldPct ?? 0) > 0) grantShield(c, dst, recipient, recipient.maxHp * link.shieldPct!);
        if (i === 0 && beforeRatio > 0.5) {
          if ((link.cleanseCount ?? 0) > 0) cleanse(c, recipient, link.cleanseCount!);
          if ((link.rageGain ?? 0) > 0) addRage(recipient, link.rageGain!);
        }
      }
      return 0;
    }
  }
  dst.hp += amount;
  c.events.push({ t: "heal", src: src.uid, dst: dst.uid, amount });
  return amount;
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

function resolveLethal(c: Ctx, f: Fighter, killer: Fighter | null): "alive" | "revived" | "dead" {
  if (f.hp > 0) return "alive";
  if (!f.reviveUsed && f.revivePct > 0) {
    f.reviveUsed = true;
    f.alive = true;
    f.shield = 0;
    f.hp = Math.max(1, Math.round(f.maxHp * Math.min(1, Math.max(0.01, f.revivePct))));
    c.events.push({ t: "revive", src: f.uid, dst: f.uid, hp: f.hp });
    return "revived";
  }
  kill(c, f, killer);
  return "dead";
}

/** Shield first, then HP. Emits the hit event before any resulting death so replay order is cause → effect. */
function applyDamage(c: Ctx, dst: Fighter, dmg: number, killer: Fighter | null, event: (absorbed: number) => CombatEvent) {
  const absorbed = Math.min(dst.shield, dmg);
  dst.shield -= absorbed;
  const toHp = Math.min(dst.hp, dmg - absorbed);
  dst.hp -= toHp;
  c.events.push(event(absorbed));
  return { hp: toHp, absorbed, lethal: dst.hp <= 0 && dst.alive, total: toHp + absorbed };
}

interface StrikeOptions {
  forcedHit?: boolean;
  allowReflect?: boolean;
  allowCounter?: boolean;
  allowGuardian?: boolean;
  splash?: boolean;
  chainDepth?: number;
}

function reduceIncoming(dst: Fighter, damage: number, type: "physical" | "magic" | "true"): number {
  let out = Math.max(1, Math.round(damage));
  for (const kind of ["damageReduction", "magicReduction", "fortifyReduction"] as const) {
    if (kind === "magicReduction" && type !== "magic") continue;
    const s = dst.status[kind];
    if (!s?.turns || s.value <= 0) continue;
    const pct = Math.min(0.95, Math.max(0, s.value / 100));
    out = Math.max(1, Math.round(out * (1 - pct)));
  }
  return out;
}

function consumeGuardian(c: Ctx, src: Fighter, dst: Fighter, damage: number, type: "physical" | "magic" | "true"): number {
  const s = dst.status.guardian;
  if (!s?.turns || !s.sourceUid) return damage;
  const guardian = c.all.find((x) => x.alive && x.uid === s.sourceUid && x.side === dst.side && x.uid !== dst.uid);
  if (!guardian) {
    delete dst.status.guardian;
    return damage;
  }
  const pct = Math.min(0.95, Math.max(0, s.value / 100));
  const redirected = Math.min(damage, Math.max(0, Math.round(damage * pct)));
  if (redirected <= 0) return damage;
  const redirectedDamage = reduceIncoming(guardian, redirected, type);
  const hit = applyDamage(c, guardian, redirectedDamage, src,
    (absorbed) => ({ t: "redirect", src: src.uid, from: dst.uid, dst: guardian.uid, dmg: redirectedDamage, absorbed }));
  if ((s.offenseDebuffValue ?? 0) > 0 && src.alive && src.hp > 0) {
    applyStatus(c, src, "offenseDebuff", s.offenseDebuffTurns ?? 1, s.offenseDebuffValue!, { sourceUid: guardian.uid });
  }
  if (hit.lethal) resolveLethal(c, guardian, src);
  if (s.charges !== undefined) {
    s.charges = Math.max(0, s.charges - 1);
    if (s.charges === 0) delete dst.status.guardian;
  }
  return Math.max(0, damage - redirected);
}

function redirectSplashProtection(c: Ctx, src: Fighter, dst: Fighter, raw: number, type: "physical" | "magic" | "true", skill: boolean): boolean {
  const s = dst.status.protecting;
  if (!s?.turns || !s.sourceUid) return false;
  const protector = c.all.find((x) => x.alive && x.uid === s.sourceUid && x.side === dst.side && x.uid !== dst.uid
    && Math.abs(x.row - dst.row) <= 1 && Math.abs(x.col - dst.col) <= 1);
  if (!protector) {
    delete dst.status.protecting;
    return false;
  }
  const forced = reduceIncoming(protector, Math.max(1, Math.round(raw * 0.75)), type);
  const hit = applyDamage(c, protector, forced, src,
    (absorbed) => ({ t: "redirect", src: src.uid, from: dst.uid, dst: protector.uid, dmg: forced, absorbed }));
  if (hit.lethal) resolveLethal(c, protector, src);
  return true;
}

function applyReflect(c: Ctx, src: Fighter, dst: Fighter, incoming: number, type: "physical" | "magic" | "true"): void {
  if (!src.alive || src.hp <= 0 || !dst.alive || dst.hp <= 0 || incoming <= 0) return;
  const reflectors: CombatStatus[] = [];
  if (hasStatus(dst, "reflect")) reflectors.push(dst.status.reflect!);
  if (type === "physical" && hasStatus(dst, "physicalReflect")) reflectors.push(dst.status.physicalReflect!);
  if (type === "magic" && hasStatus(dst, "magicReflect")) reflectors.push(dst.status.magicReflect!);
  for (const s of reflectors) {
    if (!src.alive || src.hp <= 0) break;
    const pct = s.value > 0 ? s.value / 100 : 1;
    const reflected = Math.max(1, Math.round(incoming * pct));
    const hit = applyDamage(c, src, reflected, dst, () => ({ t: "reflect", src: dst.uid, dst: src.uid, dmg: reflected }));
    if ((s.offenseDebuffValue ?? 0) > 0 && src.hp > 0) {
      applyStatus(c, src, "offenseDebuff", s.offenseDebuffTurns ?? 1, s.offenseDebuffValue!, { sourceUid: dst.uid });
    }
    if (hit.lethal) resolveLethal(c, src, dst);
  }
}

function applyEvadeRewards(c: Ctx, src: Fighter, dst: Fighter): void {
  const s = dst.status.evadeBuff;
  if (!s?.turns) return;
  if ((s.healFlat ?? 0) > 0) heal(c, dst, dst, s.healFlat!, false, true);
  if ((s.shieldFlat ?? 0) > 0) grantShield(c, dst, dst, s.shieldFlat!);
  if ((s.rageGain ?? 0) > 0) addRage(dst, s.rageGain!);
}

function tryAutoCast(c: Ctx, f: Fighter, reason: "tanker_response" | "support_basic", preferred?: Fighter): void {
  if (!f.alive || f.hp <= 0 || f.casting || hasStatus(f, "silence")) return;
  if (!Number.isFinite(f.rage) || !Number.isFinite(f.rageMax) || f.rage < f.rageMax) return;
  if (reason === "tanker_response" && f.role !== "TANKER") return;
  if (reason === "support_basic" && f.role !== "SUPPORT") return;
  castSkill(c, f, preferred);
}

function onBasicKill(c: Ctx, src: Fighter, chainDepth: number): void {
  const berserk = src.status.berserk;
  if (!src.alive || !berserk?.turns) return;
  if ((berserk.onKillRage ?? 0) > 0) addRage(src, berserk.onKillRage!);
  if ((berserk.extendOnKill ?? 0) > 0) {
    berserk.turns += berserk.extendOnKill!;
    for (const m of src.mods) if (m.source === "berserk" && m.stat === "atk") m.turns += berserk.extendOnKill!;
  }
  const maxChains = berserk.chainBasics ?? 0;
  if (chainDepth >= maxChains) return;
  const next = foes(c, src).sort((a, b) => dist(src, a) - dist(src, b) || a.uid.localeCompare(b.uid))[0];
  if (next) strike(c, src, next, stat(src, "atk"), "physical", false, { chainDepth: chainDepth + 1 });
}

/** A12/A13 pipeline + A73/A74 aftermath. Returns resolved HP/shield damage. */
function strike(c: Ctx, src: Fighter, dst: Fighter, raw: number, type: "physical" | "magic" | "true", skill: boolean, options: StrikeOptions = {}) {
  let crit = src.crit;
  let critMult = src.critDmg;
  let hit = src.accuracy + src.env.accuracy - (src.status.accuracyDebuff?.value ?? 0) / 100 - stat(dst, "evade");
  if (src.role === "ARCHER") {
    const d = dist(src, dst);
    hit -= 0.05 * d; crit += 0.05 * d; critMult += 0.05 * d;
  }
  const berserk = !skill ? src.status.berserk : undefined;
  if (berserk?.turns && berserk.firstBasicReady && (berserk.firstBasicMult ?? 0) > 1) {
    raw *= berserk.firstBasicMult!;
    berserk.firstBasicReady = false;
  }
  if (!options.forcedHit && !skill && type === "physical" && c.rng() >= Math.min(1, Math.max(0.1, hit))) {
    c.events.push({ t: "miss", src: src.uid, dst: dst.uid });
    afterDefender(c, dst, src);
    applyEvadeRewards(c, src, dst);
    tryAutoCast(c, dst, "tanker_response", src);
    return { hp: 0, absorbed: 0, killed: false, landed: false };
  }
  if (options.splash && redirectSplashProtection(c, src, dst, raw, type, skill)) {
    afterDefender(c, dst, src);
    tryAutoCast(c, dst, "tanker_response", src);
    return { hp: 0, absorbed: 0, killed: false, landed: true };
  }
  let dmg = Math.max(1, raw);
  if (ELEMENT_COUNTER[src.element] === dst.element) dmg *= dst.role === "TANKER" ? 0.5 : src.role === "TANKER" ? 1 : 1 + COUNTER_BONUS;
  if (src.element === "FIRE") dmg *= dst.env.fireVuln;
  if (CLASS_COUNTER[src.role]?.includes(dst.role)) dmg *= 1 + COUNTER_BONUS;
  const isCrit = type !== "true" && c.rng() < crit;
  if (isCrit) dmg *= critMult;
  else if (type === "physical") dmg = (dmg * 100) / (100 + stat(dst, "def"));
  else if (type === "magic") dmg = (dmg * 100) / (100 + stat(dst, "mdef"));
  dmg = Math.max(1, Math.round(dmg * c.globalMult));
  if (options.allowGuardian !== false) dmg = consumeGuardian(c, src, dst, dmg, type);
  dmg = reduceIncoming(dst, Math.max(1, dmg), type);
  const resolved = applyDamage(c, dst, dmg, src,
    (absorbed) => ({ t: skill ? "skill" : "basic", src: src.uid, dst: dst.uid, dmg, absorbed, crit: isCrit }));
  afterDefender(c, dst, src);
  if (resolved.hp > 0) {
    if (!skill) addRage(src, Math.round(c.rageGain[src.side] * (1 + src.rageGainPct)));
    if (dst.hp > 0 && src.onHitBurn > 0) applyStatus(c, dst, "burn", 2, src.onHitBurn);
    if (dst.hp > 0 && src.onHitPoison > 0) applyStatus(c, dst, "poison", 2, src.onHitPoison);
    const hunt = !skill ? src.status.bloodHunt : undefined;
    if (dst.hp > 0 && hunt?.turns && (hunt.stacks ?? 0) > 0) {
      const blood = Math.max(1, Math.round(resolved.hp * 0.1 * hunt.stacks!));
      applyStatus(c, dst, "bleed", 2, blood, { sourceUid: src.uid });
      heal(c, src, src, blood, false, true);
      if (hunt.antiHeal) applyStatus(c, dst, "healBlock", 2, 0, { sourceUid: src.uid });
    }
  }
  if (options.allowReflect !== false) applyReflect(c, src, dst, resolved.total, type);
  if (options.allowCounter !== false && dst.hp > 0 && src.alive && src.hp > 0 && hasStatus(dst, "counter") && src.range <= 1) {
    strike(c, dst, src, stat(dst, "atk"), "physical", false, { forcedHit: true, allowCounter: false });
  }
  const life = src.lifesteal + (src.status.berserk?.turns ? src.status.berserk.lifestealPct ?? 0 : 0);
  if (resolved.hp > 0 && src.alive && src.hp > 0 && life > 0) heal(c, src, src, resolved.hp * life);
  const outcome = resolved.lethal ? resolveLethal(c, dst, src) : "alive";
  const killed = outcome === "dead";
  if (killed && !skill) onBasicKill(c, src, options.chainDepth ?? 0);
  tryAutoCast(c, dst, "tanker_response", src);
  return { hp: resolved.hp, absorbed: resolved.absorbed, killed, landed: true };
}

/** Defender +1 rage; TANKER auto-cast is rechecked after the full aftermath (A74). */
function afterDefender(c: Ctx, dst: Fighter, attacker: Fighter) {
  if (!dst.alive) return;
  addRage(dst, 1);
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
      const p = basicTarget(c, f);
      return p ? [p] : take(stable);
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
function skillTargets(c: Ctx, f: Fighter, sp: SkillSpec, preferred?: Fighter): Fighter[] {
  if (sp.side === "self") return [f];
  const pool = sp.side === "ally" ? friends(c, f) : foes(c, f);
  if (sp.area === "all") return pool;
  const ordered = selectorTargets(c, f, pool, sp.selector, sp.count, preferred);
  const p = ordered[0];
  if (!p) return [];
  if (sp.area === "row") return pool.filter((x) => x.row === p.row);
  if (sp.area === "column") return pool.filter((x) => x.col === p.col);
  if (sp.area === "square") return pool.filter((x) => Math.abs(x.row - p.row) <= 1 && Math.abs(x.col - p.col) <= 1);
  if (sp.area === "cross") return pool.filter((x) => Math.abs(x.row - p.row) + Math.abs(x.col - p.col) <= 1);
  if (sp.area === "cone") {
    const dir = f.side === "L" ? 1 : -1;
    return pool.filter((x) => {
      const forward = (x.col - f.col) * dir;
      return forward > 0 && Math.abs(x.row - f.row) <= forward;
    }).sort((a, b) => dist(p, a) - dist(p, b) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
      || depth(a) - depth(b) || a.uid.localeCompare(b.uid)).slice(0, 5);
  }
  return ordered;
}

const byLowHp = (a: Fighter, b: Fighter) => hpRatio(a) - hpRatio(b) || a.uid.localeCompare(b.uid);
const byNear = (from: Fighter) => (a: Fighter, b: Fighter) => dist(from, a) - dist(from, b) || a.uid.localeCompare(b.uid);

function formulaAmount(f: Fighter, formula: NonNullable<SkillSpec["shield"]>, scale: number): number {
  return Math.max(1, Math.round((formula.base + statValue(f, formula.stat) * formula.scale) * scale));
}

function skillRawDamage(c: Ctx, f: Fighter, damage: NonNullable<SkillSpec["damage"]>, multiplier = 1): number {
  return Math.max(1, Math.round((damage.base + statValue(f, damage.stat) * damage.scale)
    * (STAR_SKILL[f.star] ?? 1) * goldMultiplier(c.gold[f.side]) * multiplier));
}

function skillHealRaw(f: Fighter, healSpec: NonNullable<SkillSpec["heal"]>, target: Fighter): number {
  if (healSpec.formula) {
    return (healSpec.formula.base + statValue(f, healSpec.formula.stat) * healSpec.formula.scale) * (STAR_SKILL[f.star] ?? 1);
  }
  return target.maxHp * healSpec.pctMaxHp;
}

function applyOffenseStatus(c: Ctx, src: Fighter, dst: Fighter, payload: SkillSpec["offenseDebuff"]): void {
  if (!payload || !dst.alive) return;
  applyStatus(c, dst, "offenseDebuff", payload.turns, payload.value, { sourceUid: src.uid, percent: payload.pct });
}

function resolveFullFamilySkill(
  c: Ctx,
  f: Fighter,
  family: string,
  sp: SkillSpec,
  preferred: Fighter | undefined,
  announce: (targets: Fighter[]) => void,
): boolean {
  const others = friends(c, f).filter((x) => x.uid !== f.uid);
  if (family === "revive_or_heal" && !getUnit(f.baseId).boss) {
    const dead = c.all.filter((x) => !x.alive && x.side === f.side).sort((a, b) => a.uid.localeCompare(b.uid));
    const reviveCount = f.star >= 3 ? 2 : 1;
    if (dead.length) {
      const targets = dead.slice(0, reviveCount);
      announce(targets);
      for (const target of targets) {
        target.alive = true;
        target.hp = Math.max(1, Math.round(target.maxHp * (sp.revivePct || 0.4)));
        target.shield = 0;
        target.rage = 0;
        target.status = {};
        target.mods = [];
        target.tauntBy = null;
        c.events.push({ t: "revive", src: f.uid, dst: target.uid, hp: target.hp });
      }
      return true;
    }
    const healCount = f.star === 1 ? 3 : 4;
    const targets = [...others].sort(byLowHp).slice(0, healCount);
    announce(targets);
    if (sp.heal) for (const target of targets) heal(c, f, target, skillHealRaw(f, sp.heal, target));
    return true;
  }
  if (family === "self_regen_team_heal" && !getUnit(f.baseId).boss) {
    let count = Math.max(1, sp.count);
    const selfRaw = f.maxHp * sp.selfHealPctMaxHp;
    const selfPossible = Math.max(0, Math.round(selfRaw * (1 + f.healPct) * (1 + f.env.healRecvPct) * (1 - healReduction(c, f))));
    const afterSelfRatio = Math.min(f.maxHp, f.hp + selfPossible) / f.maxHp;
    if (f.star >= 3 && afterSelfRatio >= 0.6) count = Math.max(count, 4);
    const targets = [...others].sort(byLowHp).slice(0, count);
    announce([f, ...targets]);
    if (sp.selfHealPctMaxHp > 0) heal(c, f, f, selfRaw);
    if (sp.heal) for (const target of targets) heal(c, f, target, skillHealRaw(f, sp.heal, target));
    return true;
  }
  if (family === "team_shield" && !getUnit(f.baseId).boss) {
    const targets = stableTargets(f, friends(c, f));
    announce(targets);
    if (sp.shield) {
      const amount = formulaAmount(f, sp.shield, STAR_SKILL[f.star] ?? 1);
      for (const target of targets) grantShield(c, f, target, target.uid === f.uid ? amount * 2 : amount);
    }
    return true;
  }
  if (family === "team_rage" && !getUnit(f.baseId).boss) {
    const pool = friends(c, f);
    const targets = selectorTargets(c, f, pool, "lowest_rage_ally", Math.max(1, sp.count));
    announce(targets);
    for (const target of targets) addRage(target, sp.rageGrant);
    return true;
  }
  if (family === "row_random_rage_buff" && !getUnit(f.baseId).boss) {
    const row = others.filter((x) => x.row === f.row);
    const dir = f.side === "L" ? 1 : -1;
    const forward = row.filter((x) => (x.col - f.col) * dir > 0);
    const pool = f.star === 1 && forward.length ? forward : row;
    const bag = [...pool];
    const targets: Fighter[] = [];
    while (bag.length && targets.length < Math.max(1, sp.count)) targets.push(bag.splice(Math.floor(c.rng() * bag.length), 1)[0]!);
    announce(targets);
    for (const target of targets) {
      addRage(target, sp.rageGrant);
      for (const mod of sp.buffs) target.mods.push({ ...mod, source: family });
    }
    if (f.star >= 3 && targets.length && c.rng() < 0.3) {
      const lucky = targets[Math.floor(c.rng() * targets.length)]!;
      addRage(lucky, 1);
      lucky.mods = lucky.mods.filter((m) => m.source !== family || m.stat !== "atk");
      lucky.mods.push({ stat: "atk", value: 20, pct: true, turns: 2, source: family });
    }
    return true;
  }
  if (family === "double_hit") {
    const primary = skillTargets(c, f, sp, preferred)[0] ?? basicTarget(c, f);
    announce(primary ? [primary] : []);
    if (!primary) return true;
    const firstFormula = sp.damageHits[0] ?? sp.damage;
    const secondFormula = sp.damageHits[1] ?? firstFormula;
    if (!firstFormula || !secondFormula) return true;
    const hitTargets: Fighter[] = [];
    strike(c, f, primary, skillRawDamage(c, f, firstFormula), firstFormula.type, true);
    hitTargets.push(primary);
    let second: Fighter | undefined = primary.alive ? primary : undefined;
    if (f.baseId === "kangaroo_kick" && f.star >= 2) {
      second = selectorTargets(c, f, foes(c, f), "highest_rage", 1)[0] ?? second;
    } else if (!primary.alive && f.baseId === "wraith_shadow") {
      const back = extremeColumn(stableTargets(f, foes(c, f)), true)
        .sort((a, b) => b.rage - a.rage || a.uid.localeCompare(b.uid));
      second = back[0];
    }
    if (second?.alive) {
      strike(c, f, second, skillRawDamage(c, f, secondFormula), secondFormula.type, true);
      hitTargets.push(second);
    }
    if (sp.offenseDebuff) for (const target of [...new Set(hitTargets)]) applyOffenseStatus(c, f, target, sp.offenseDebuff);
    return true;
  }
  if (family === "single_delayed_echo") {
    const primary = skillTargets(c, f, sp, preferred)[0] ?? basicTarget(c, f);
    announce(primary ? [primary] : []);
    if (!primary) return true;
    const firstFormula = sp.damageHits[0] ?? sp.damage;
    const echoFormula = sp.damageHits[1];
    if (!firstFormula) return true;
    strike(c, f, primary, skillRawDamage(c, f, firstFormula), firstFormula.type, true);
    let echoTarget: Fighter | undefined = primary.alive ? primary : undefined;
    if (!echoTarget && f.baseId === "lynx_echo" && f.star >= 3) {
      echoTarget = selectorTargets(c, f, foes(c, f), "backline_caster", 1)[0];
    }
    if (echoTarget?.alive && echoFormula) {
      const afflicted = CLEANSE_ORDER.some((kind) => hasStatus(echoTarget!, kind)) || echoTarget.mods.some((m) => m.value < 0);
      const bonus = f.baseId === "lynx_echo" && f.star >= 2 && afflicted ? 1.25 : 1;
      strike(c, f, echoTarget, skillRawDamage(c, f, echoFormula, bonus), echoFormula.type, true);
      if (f.baseId === "otter_river" && f.star >= 3) applyStatus(c, echoTarget, "bleed", 2, 12, { sourceUid: f.uid });
    }
    for (const m of sp.debuffs) if (primary.alive) primary.mods.push({ ...m, value: -m.value, source: family });
    return true;
  }
  if (family === "plague_spread") {
    const pool = stableTargets(f, foes(c, f));
    const clusterSize = (x: Fighter) => pool.filter((y) => Math.abs(y.row - x.row) <= 1 && Math.abs(y.col - x.col) <= 1).length;
    const center = [...pool].sort((a, b) => clusterSize(b) - clusterSize(a)
      || rowRank(f.row, a.row) - rowRank(f.row, b.row) || depth(a) - depth(b) || a.uid.localeCompare(b.uid))[0];
    if (!center) {
      announce([]);
      return true;
    }
    const localCap = f.star === 1 ? 3 : 4;
    const local = pool.filter((x) => Math.abs(x.row - center.row) <= 1 && Math.abs(x.col - center.col) <= 1)
      .sort((a, b) => dist(center, a) - dist(center, b) || a.uid.localeCompare(b.uid)).slice(0, localCap);
    const outside = f.star >= 3 ? pool.filter((x) => !local.includes(x) && (Math.abs(x.row - center.row) > 1 || Math.abs(x.col - center.col) > 1))
      .sort((a, b) => dist(center, a) - dist(center, b) || a.uid.localeCompare(b.uid)).slice(0, 2) : [];
    announce([...local, ...outside]);
    const disease = sp.dots.find((d) => d.kind === "disease");
    const hitIds = new Set<string>();
    if (sp.damage) {
      const hit = strike(c, f, center, skillRawDamage(c, f, sp.damage), sp.damage.type, true);
      if (hit.hp > 0 || hit.absorbed > 0) hitIds.add(center.uid);
    }
    if (disease) for (const target of local) if (target.alive) applyStatus(c, target, "disease", disease.turns, disease.value, { sourceUid: f.uid });
    if (f.star >= 2 && clusterSize(center) >= 4 && center.alive) {
      applyStatus(c, center, "offenseDebuff", 2, 15, { sourceUid: f.uid, percent: true });
      center.rage = Math.max(0, center.rage - 1);
    }
    if (f.star >= 3 && sp.damage) {
      for (const target of outside) if (target.alive) {
        const hit = strike(c, f, target, skillRawDamage(c, f, sp.damage, 0.7), sp.damage.type, true);
        if (hit.hp > 0 || hit.absorbed > 0) hitIds.add(target.uid);
        if (target.alive) applyStatus(c, target, "disease", 2, 10, { sourceUid: f.uid });
      }
    }
    if (f.role === "MAGE") addRage(f, hitIds.size);
    return true;
  }
  if (family === "chain_shock" && !getUnit(f.baseId).boss) {
    const pool = foes(c, f);
    const targets = selectorTargets(c, f, pool, "highest_rage", Math.max(1, sp.count));
    announce(targets);
    if (!sp.damage || !targets.length) return true;
    const hitIds = new Set<string>();
    const raw = skillRawDamage(c, f, sp.damage);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      if (!target.alive) continue;
      const hit = strike(c, f, target, Math.max(1, Math.round(raw * 0.8 ** i)), sp.damage.type, true);
      if (hit.hp > 0 || hit.absorbed > 0) hitIds.add(target.uid);
    }
    if (f.star === 2) for (const target of targets.slice(0, 2)) target.rage = Math.max(0, target.rage - 1);
    if (f.star >= 3) {
      for (const target of targets) target.rage = Math.max(0, target.rage - 1);
      if (targets.length >= 3) {
        const last = targets.at(-1)!;
        if (last.alive) applyStatus(c, last, "silence", 1, 0, { sourceUid: f.uid });
        const first = targets[0]!;
        if (first.alive) {
          const bounce = strike(c, f, first, Math.max(1, Math.round(raw * 0.8 ** (targets.length - 1) * 0.6)), sp.damage.type, true);
          if (bounce.hp > 0 || bounce.absorbed > 0) hitIds.add(first.uid);
        }
      }
    }
    if (f.role === "MAGE") addRage(f, hitIds.size);
    return true;
  }
  if (family === "global_stun" && !getUnit(f.baseId).boss) {
    const enemies = stableTargets(f, foes(c, f));
    announce(enemies);
    const hitIds = new Set<string>();
    if (sp.damage) {
      const raw = skillRawDamage(c, f, sp.damage);
      for (const enemy of enemies) if (enemy.alive) {
        const hit = strike(c, f, enemy, raw, sp.damage.type, true);
        if (hit.hp > 0 || hit.absorbed > 0) hitIds.add(enemy.uid);
      }
    }
    const stun = sp.controls.find((control) => control.kind === "stun");
    if (stun) {
      const riders = selectorTargets(c, f, foes(c, f), "highest_rage", Math.max(1, sp.count));
      for (const target of riders) if (c.rng() <= stun.chance) applyStatus(c, target, "stun", stun.turns, 0, { sourceUid: f.uid });
    }
    if (f.baseId === "lion_general") {
      for (const ally of friends(c, f).filter((x) => x.row === f.row)) for (const mod of sp.buffs) ally.mods.push({ ...mod, source: family });
    }
    if (f.role === "MAGE") addRage(f, hitIds.size);
    return true;
  }
  if ((family === "flash_blind" || family === "global_debuff_atk") && !getUnit(f.baseId).boss) {
    const enemies = stableTargets(f, foes(c, f));
    announce(enemies);
    const hitIds = new Set<string>();
    if (sp.damage) {
      const raw = skillRawDamage(c, f, sp.damage);
      for (const enemy of enemies) if (enemy.alive) {
        const hit = strike(c, f, enemy, raw, sp.damage.type, true);
        if (hit.hp > 0 || hit.absorbed > 0) hitIds.add(enemy.uid);
      }
    }
    let riders = [...foes(c, f)];
    const backDepth = riders.length ? Math.max(...riders.map(depth)) : -1;
    if (family === "flash_blind" && f.star >= 3) {
      riders.sort((a, b) => Number(!(b.range > 1 && depth(b) === backDepth)) - Number(!(a.range > 1 && depth(a) === backDepth))
        || stat(b, "atk") - stat(a, "atk") || a.uid.localeCompare(b.uid));
    } else if (family === "global_debuff_atk" && f.star >= 3) {
      riders.sort((a, b) => Number(!((b.role === "MAGE" || b.role === "SUPPORT") && depth(b) === backDepth))
        - Number(!((a.role === "MAGE" || a.role === "SUPPORT") && depth(a) === backDepth))
        || stat(b, "atk") - stat(a, "atk") || a.uid.localeCompare(b.uid));
    } else riders.sort((a, b) => stat(b, "atk") - stat(a, "atk") || a.uid.localeCompare(b.uid));
    riders = riders.slice(0, Math.max(1, sp.count));
    for (const target of riders) {
      applyOffenseStatus(c, f, target, sp.offenseDebuff);
      if (sp.accuracyReduction) applyStatus(c, target, "accuracyDebuff", sp.accuracyReduction.turns, sp.accuracyReduction.pct, { sourceUid: f.uid, percent: true });
      for (const control of sp.controls) if (c.rng() <= control.chance) applyStatus(c, target, control.kind, control.turns, 0, { sourceUid: f.uid });
    }
    if (f.role === "MAGE") addRage(f, hitIds.size);
    return true;
  }
  if (family === "ally_row_def_buff") {
    const duration = f.star >= 3 ? 3 : 2;
    const def = [22, 30, 38][f.star - 1] ?? 22;
    const mdef = [14, 20, 26][f.star - 1] ?? 14;
    const shield = [10, 16, 22][f.star - 1] ?? 10;
    const ally = others.filter((x) => x.row === f.row).sort(byLowHp)[0];
    const targets = ally ? [f, ally] : [f];
    announce(targets);
    for (const target of targets) {
      target.mods.push({ stat: "def", value: def, pct: false, turns: duration, source: family });
      target.mods.push({ stat: "mdef", value: mdef, pct: false, turns: duration, source: family });
      grantShield(c, f, target, shield);
    }
    if (ally && f.star >= 2) {
      applyStatus(c, ally, "guardian", duration, 35, {
        sourceUid: f.uid,
        charges: 1,
        offenseDebuffValue: f.star >= 3 ? 20 : 0,
        offenseDebuffTurns: f.star >= 3 ? 2 : 0,
      });
    }
    return true;
  }
  if (family === "mirror_reflect") {
    const duration = [2, 2, 3][f.star - 1] ?? 2;
    const reflectPct = [25, 35, 45][f.star - 1] ?? 25;
    const sharePct = [0.3, 0.35, 0.4][f.star - 1] ?? 0.3;
    const shareCount = f.star >= 3 ? 2 : 1;
    let recipients = [...others];
    if (f.star === 1) recipients.sort(byNear(f));
    else if (f.star === 2) recipients.sort(byLowHp);
    else recipients = recipients.filter((x) => x.row === f.row).sort(byLowHp);
    recipients = recipients.slice(0, shareCount);
    announce([f, ...recipients]);
    const shield = sp.shield ? formulaAmount(f, sp.shield, STAR_SKILL[f.star] ?? 1) : 0;
    if (shield > 0) grantShield(c, f, f, shield);
    applyStatus(c, f, "magicReflect", duration, reflectPct, { sourceUid: f.uid });
    for (const ally of recipients) if (shield > 0) grantShield(c, f, ally, shield * sharePct);
    return true;
  }
  if (family === "guardian_pact") {
    const count = f.star >= 3 ? 2 : 1;
    const duration = [2, 2, 3][f.star - 1] ?? 2;
    const redirectPct = [30, 46, 68][f.star - 1] ?? 30;
    const defBuff = [15, 20, 25][f.star - 1] ?? 15;
    const targets = [...others].sort(byLowHp).slice(0, count);
    announce(targets);
    for (const ally of targets) {
      applyStatus(c, ally, "guardian", duration, redirectPct, { sourceUid: f.uid });
      if (f.star >= 2) cleanse(c, ally, 1);
    }
    f.mods.push({ stat: "def", value: defBuff, pct: false, turns: duration, source: family });
    return true;
  }
  if (family === "phoenix_rebirth") {
    const revivePct = [0.3, 0.4, 0.5][f.star - 1] ?? 0.3;
    const healPct = [0.4, 0.45, 0.3][f.star - 1] ?? 0.4;
    const count = f.star >= 3 ? others.length : f.star;
    const targets = [...others].sort(byLowHp).slice(0, count);
    announce([f, ...targets]);
    f.revivePct = Math.max(f.revivePct, revivePct);
    for (const ally of targets) heal(c, f, ally, ally.maxHp * healPct);
    return true;
  }
  if (family === "soul_link_heal") {
    const count = f.star >= 3 ? 2 : 1;
    const duration = f.star >= 3 ? 3 : 2;
    const targets = [...others].sort(byLowHp).slice(0, count);
    announce(targets);
    for (let i = 0; i < targets.length; i++) {
      const ally = targets[i]!;
      const healMult = f.star === 1 ? 1 : f.star === 2 ? 1.2 : i === 0 ? 1.5 : 0.9;
      applyStatus(c, ally, "soulLink", duration, 0, {
        sourceUid: f.uid,
        healMult,
        cleanseCount: f.star >= 2 && i === 0 ? 1 : 0,
        rageGain: f.star >= 3 && i === 0 ? 1 : 0,
      });
    }
    return true;
  }
  if (family === "self_blood_hunt") {
    const costPct = [0.1, 0.3, 0.4][f.star - 1] ?? 0.1;
    const turns = f.star >= 3 ? 3 : 2;
    const maxStacks = [2, 3, 4][f.star - 1] ?? 2;
    let target = preferred?.alive && preferred.side !== f.side ? preferred : basicTarget(c, f);
    announce(target ? [f, target] : [f]);
    f.hp = Math.max(1, f.hp - Math.round(f.maxHp * costPct));
    const cur = f.status.bloodHunt;
    applyStatus(c, f, "bloodHunt", turns, 0, {
      stacks: Math.min(maxStacks, (cur?.stacks ?? 0) + 1),
      maxStacks,
      antiHeal: f.star >= 3,
      sourceUid: f.uid,
    });
    const maxAttacks = f.star === 1 ? 1 : f.star === 2 ? 2 : 3;
    const extraChance = f.star === 2 ? 0.2 : f.star >= 3 ? 0.5 : 0;
    for (let i = 0; i < maxAttacks && target; i++) {
      strike(c, f, target, stat(f, "atk"), "physical", false);
      if (i + 1 >= maxAttacks || c.rng() >= extraChance) break;
      target = target.alive ? target : basicTarget(c, f);
    }
    return true;
  }
  return false;
}

function applySupplementalFamilyState(c: Ctx, f: Fighter, family: string, sp: SkillSpec): void {
  if (family === "self_armor_reflect") {
    const duration = f.star === 1 ? 2 : 3;
    const pct = f.star === 1 ? 25 : 35;
    applyStatus(c, f, "physicalReflect", duration, pct, {
      sourceUid: f.uid,
      offenseDebuffValue: f.star >= 3 ? 20 : 0,
      offenseDebuffTurns: f.star >= 3 ? 2 : 0,
    });
    if (f.star >= 2) {
      const target = [...foes(c, f)].sort((a, b) => stat(b, "atk") - stat(a, "atk") || a.uid.localeCompare(b.uid))[0];
      if (target && applyStatus(c, target, "taunt", 1, 0, { sourceUid: f.uid })) target.tauntBy = f.uid;
    }
  } else if (family === "rhino_counter") {
    applyStatus(c, f, "counter", [3, 4, 5][f.star - 1] ?? 3, 0, { sourceUid: f.uid });
  } else if (family === "self_shield_immune") {
    applyStatus(c, f, "immunity", f.star >= 3 ? 3 : 2, 0, { sourceUid: f.uid });
    if (f.star >= 3 && sp.shield) {
      const amount = formulaAmount(f, sp.shield, STAR_SKILL[f.star] ?? 1);
      for (const ally of friends(c, f).filter((x) => x.uid !== f.uid && x.row === f.row)) grantShield(c, f, ally, amount * 0.25);
    }
  } else if (family === "self_bersek") {
    applyStatus(c, f, "berserk", 3, 0, {
      sourceUid: f.uid,
      lifestealPct: f.star >= 2 ? 0.15 : 0,
      firstBasicMult: f.star === 2 ? 1.4 : f.star >= 3 ? 1.5 : 1,
      firstBasicReady: f.star >= 2,
      onKillRage: f.star >= 3 ? 1 : 0,
      extendOnKill: f.star >= 3 ? 1 : 0,
      chainBasics: f.star >= 3 ? 1 : 0,
    });
  } else if (family === "pangolin_reflect") {
    const turns = f.star >= 3 ? 4 : 3;
    applyStatus(c, f, "physicalReflect", turns, [80, 115, 135][f.star - 1] ?? 80, { sourceUid: f.uid });
    if (f.star >= 3) applyStatus(c, f, "magicReflect", turns, 60, { sourceUid: f.uid });
    applyStatus(c, f, "pangolinShield", turns, 0, {
      sourceUid: f.uid,
      healPctMaxHp: f.star >= 2 ? (f.star >= 3 ? 0.25 : 0.2) : 0,
      followupReductionPct: f.star >= 3 ? 15 : 0,
      followupReductionTurns: f.star >= 3 ? 1 : 0,
    });
  } else if (family === "resilient_shield" && sp.shield) {
    const shield = formulaAmount(f, sp.shield, STAR_SKILL[f.star] ?? 1);
    for (const enemy of foes(c, f)) if (applyStatus(c, enemy, "taunt", 2, 0, { sourceUid: f.uid })) enemy.tauntBy = f.uid;
    if (f.star >= 2) {
      const ally = friends(c, f).filter((x) => x.uid !== f.uid).sort(byNear(f))[0];
      if (ally) {
        grantShield(c, f, ally, shield * (f.star >= 3 ? 0.5 : 0.35));
        if (f.star === 2) addRage(ally, 1);
        if (f.star >= 3) applyStatus(c, ally, "resilientShield", 2, 0, {
          sourceUid: f.uid,
          cleanseCount: 1,
          followupReductionPct: 20,
          followupReductionTurns: 1,
        });
      }
    }
  }
}

function castSkill(c: Ctx, f: Fighter, preferred?: Fighter) {
  const sp = skillSpec(f.baseId, f.star);
  const family = getUnit(f.baseId).skill.family;
  f.casting = true;
  f.rage = 0;
  const resolvedFullFamily = resolveFullFamilySkill(c, f, family, sp, preferred,
    (targets) => c.events.push({ t: "cast", src: f.uid, targets: targets.map((x) => x.uid) }));
  if (resolvedFullFamily) {
    f.casting = false;
    return;
  }
  const targets = skillTargets(c, f, sp, preferred);
  c.events.push({ t: "cast", src: f.uid, targets: targets.map((x) => x.uid) });
  const starSkill = STAR_SKILL[f.star] ?? 1;
  const enemyHit = new Set<string>();
  const enemies = sp.side === "enemy" ? targets : [];
  const allies = sp.side === "enemy" ? [f] : targets;
  const preShield = new Map(enemies.map((target) => [target.uid, target.shield]));

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
  for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex++) {
    const t = enemies[enemyIndex]!;
    if (!t.alive) continue;
    const crocodileGuarded = family === "single_bleed" && (t.role === "TANKER" || (preShield.get(t.uid) ?? 0) > 0);
    for (const d of sp.dots) {
      const conditional = crocodileGuarded && f.star === 2 && d.kind === "bleed" ? 1.35 : 1;
      applyStatus(c, t, d.kind, d.turns, Math.round(d.value * dotMult * conditional), { sourceUid: f.uid });
    }
    for (const k of sp.controls) {
      if (c.rng() > k.chance) continue;
      if (applyStatus(c, t, k.kind, k.turns) && k.kind === "taunt") t.tauntBy = f.uid;
    }
    for (const m of sp.debuffs) t.mods.push({ ...m, value: -m.value, source: family });
    applyOffenseStatus(c, f, t, sp.offenseDebuff);
    if (sp.accuracyReduction) applyStatus(c, t, "accuracyDebuff", sp.accuracyReduction.turns, sp.accuracyReduction.pct, { sourceUid: f.uid, percent: true });
    if (sp.healReduction && (family !== "lifesteal_disease" || t.role === "MAGE" || t.role === "SUPPORT")
      && (family !== "cone_shot" || enemyIndex === 0)) {
      applyStatus(c, t, "healReduction", sp.healReduction.turns, sp.healReduction.pct, { sourceUid: f.uid, percent: true });
    }
    if (sp.shieldLockTurns > 0 && (family !== "single_bleed" || crocodileGuarded)) {
      applyStatus(c, t, "shieldLock", sp.shieldLockTurns, 0, { sourceUid: f.uid });
    }
    if (family === "single_bleed" && f.star >= 3 && hasStatus(t, "bleed")) {
      t.mods.push({ stat: "def", value: -20, pct: false, turns: 2, source: family });
    }
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
  for (const a of allies) {
    if (!a.alive) continue;
    if (sp.heal) {
      if (sp.healOverTimeTurns > 0 && sp.heal.pctMaxHp > 0) {
        applyStatus(c, a, "healOverTime", sp.healOverTimeTurns, 0, { sourceUid: f.uid, healPctMaxHp: sp.heal.pctMaxHp });
      } else heal(c, f, a, skillHealRaw(f, sp.heal, a));
    }
    if (sp.shield) grantShield(c, f, a, formulaAmount(f, sp.shield, starSkill));
    for (const m of sp.buffs) a.mods.push({ ...m, source: family === "self_bersek" ? "berserk" : family });
    if (sp.damageReduction) applyStatus(c, a, "damageReduction", sp.damageReduction.turns, sp.damageReduction.pct, { sourceUid: f.uid, percent: true });
    if (sp.cleanseCount > 0) cleanse(c, a, sp.cleanseCount);
    if (sp.rageGrant && a !== f) addRage(a, sp.rageGrant);
  }
  if (sp.selfHealPctMaxHp) heal(c, f, f, f.maxHp * sp.selfHealPctMaxHp);
  applySupplementalFamilyState(c, f, family, sp);
  if (f.role === "MAGE") addRage(f, enemyHit.size);
  f.casting = false;
}

interface TurnGate {
  canAct: boolean;
  silenced: boolean;
  disarmed: boolean;
}

function expireStatus(c: Ctx, f: Fighter, kind: string, s: CombatStatus): void {
  delete f.status[kind];
  if (kind === "taunt") f.tauntBy = null;
  if ((kind === "pangolinShield" || kind === "resilientShield") && f.alive && f.shield > 0) {
    if ((s.healPctMaxHp ?? 0) > 0) heal(c, f, f, f.maxHp * s.healPctMaxHp!);
    if ((s.cleanseCount ?? 0) > 0) cleanse(c, f, s.cleanseCount!);
    if ((s.followupReductionPct ?? 0) > 0 && (s.followupReductionTurns ?? 0) > 0) {
      applyStatus(c, f, "damageReduction", s.followupReductionTurns!, s.followupReductionPct!, { sourceUid: s.sourceUid });
    }
    if ((s.followupHotPctMaxHp ?? 0) > 0 && (s.followupHotTurns ?? 0) > 0) {
      const current = f.status.healOverTime;
      const turns = Math.max(s.followupHotTurns!, current?.turns ?? 0);
      const pct = Math.max(s.followupHotPctMaxHp!, current?.healPctMaxHp ?? 0);
      applyStatus(c, f, "healOverTime", turns, 0, { sourceUid: s.sourceUid, healPctMaxHp: pct });
    }
  }
}

/** A79: capture control state first, then resolve timed triggers and one canonical duration tick. */
function startTurn(c: Ctx, f: Fighter): TurnGate {
  const skip = CONTROL_PRIORITY.find((k) => (f.status[k]?.turns ?? 0) > 0) ?? null;
  const silenced = (f.status.silence?.turns ?? 0) > 0;
  const disarmed = (f.status.disarm?.turns ?? 0) > 0;
  for (const k of DOTS) {
    const s = f.status[k];
    if (!s?.turns) continue;
    const fireVulnerability = k === "burn"
      ? f.env.fireVuln * ((f.status.fireVulnerability?.turns ?? 0) > 0 ? Math.max(1, f.status.fireVulnerability!.value) : 1)
      : 1;
    const dmg = Math.max(1, Math.round(s.value * fireVulnerability * c.globalMult));
    const hit = applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: k, dmg }));
    if (k === "disease" && dmg > 0) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const neighbor = c.all.find((x) => x.alive && x.side === f.side && x.row === f.row + dr && x.col === f.col + dc);
        if (neighbor && !((neighbor.status.disease?.turns ?? 0) > 0)) applyStatus(c, neighbor, "disease", 2, dmg);
      }
    }
    if (--s.turns <= 0) expireStatus(c, f, k, s);
    if (hit.lethal && resolveLethal(c, f, null) === "dead") return { canAct: false, silenced, disarmed };
  }
  const hot = f.status.healOverTime;
  if (hot?.turns && f.alive) {
    const amount = (hot.healPctMaxHp ?? 0) > 0 ? f.maxHp * hot.healPctMaxHp! : hot.value;
    if (amount > 0) heal(c, f, f, amount);
    if (--hot.turns <= 0) expireStatus(c, f, "healOverTime", hot);
  }
  // A32 SWARM aura: non-matching units take 4 true damage per turn.
  if (f.env.poisonAura > 0) {
    const dmg = f.env.poisonAura;
    const hit = applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: "poisonAura", dmg }));
    if (hit.lethal && resolveLethal(c, f, null) === "dead") return { canAct: false, silenced, disarmed };
  }
  f.mods = f.mods.filter((m) => --m.turns > 0);
  for (const [k, s] of Object.entries(f.status)) {
    if (DOTS.includes(k as (typeof DOTS)[number]) || k === "healOverTime") continue;
    if (CONTROL_PRIORITY.includes(k as (typeof CONTROL_PRIORITY)[number]) && k !== skip) continue;
    if (--s.turns <= 0) {
      expireStatus(c, f, k, s);
    }
  }
  if (skip) c.events.push({ t: "skip", src: f.uid, reason: skip });
  return { canAct: !skip, silenced, disarmed };
}

function act(c: Ctx, f: Fighter) {
  if (!f.alive) return;
  const gate = startTurn(c, f);
  if (!gate.canAct) return;
  if (f.rage >= f.rageMax && !gate.silenced) castSkill(c, f);
  else if (!gate.disarmed) {
    const t = basicTarget(c, f);
    if (t) {
      const u = getUnit(f.baseId);
      const magic = f.role === "MAGE" || f.role === "SUPPORT" || u.basic.damageType === "magic";
      strike(c, f, t, stat(f, magic ? "matk" : "atk"), magic ? "magic" : "physical", false);
      // SUPPORT: basic attack that fills rage auto-casts (A14).
      if (f.alive && !gate.silenced) tryAutoCast(c, f, "support_basic");
    }
  }
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
 * Run a full combat. LEFT placements use cols 0..4, RIGHT 5..9 (caller maps board → battlefield).
 * Deterministic for identical inputs + seed.
 */
export function simulate(left: Placement[], right: Placement[], o: CombatOptions): CombatResult {
  const all = [
    ...left.map((p) => makeFighter(p, "L", o.bonus?.L, o.environment)),
    ...right.map((p) => makeFighter(p, "R", o.bonus?.R, o.environment)),
  ];
  const c: Ctx = {
    all, rng: mulberry(o.seed), events: [], globalMult: 1,
    gold: { L: o.gold?.L ?? 0, R: o.gold?.R ?? 0 },
    rageGain: { L: o.rageGain?.L ?? 1, R: o.rageGain?.R ?? 1 },
    bounty: { L: 0, R: 0 },
    bountyKills: { L: 0, R: 0 },
  };
  const count = (side: Side) => all.filter((f) => f.side === side && f.alive).length;
  let actions = 0;
  outer: for (let cycle = 0; cycle < CYCLE_CAP; cycle++) {
    for (const f of turnOrder(all)) {
      if (!count("L") || !count("R")) break outer;
      if (!f.alive) continue;
      act(c, f);
      actions++;
      // A17 anti-stall: after action 100, every 5th action +0.2 global damage.
      if (actions > 100 && actions % 5 === 0) c.globalMult += 0.2;
    }
  }
  const alive = { L: count("L"), R: count("R") };
  return {
    winner: alive.L && !alive.R ? "L" : alive.R && !alive.L ? "R" : null,
    alive, total: { L: left.length, R: right.length }, bounty: c.bounty, bountyKills: c.bountyKills, actions, events: c.events,
    survivors: all.filter((f) => f.alive),
  };
}
