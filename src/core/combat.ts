// Deterministic combat engine (spec A11–A18, A73, A74). Pure: no rendering, timers or audio.
// Presentation replays `events` in order; HP/status changes are already resolved per event.
// ponytail: status families with bespoke payloads (soul link, berserk, guardian, reflect...) are not modeled;
// add them as SkillSpec grows per-family handlers.
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
const DOTS = ["burn", "poison", "bleed", "disease"] as const;

interface Mod { stat: BuffStat; value: number; pct: boolean; turns: number }

export interface Fighter {
  uid: string; baseId: string; star: number; side: Side; row: number; col: number;
  role: Role; element: Element;
  maxHp: number; hp: number; atk: number; def: number; matk: number; mdef: number;
  range: number; rageMax: number; rage: number; shield: number; alive: boolean;
  crit: number; critDmg: number; accuracy: number; evade: number; lifesteal: number; rageGainPct: number; healPct: number;
  onHitBurn: number; onHitPoison: number;
  /** Timed statuses: control kinds + DoT kinds; DoTs carry per-tick value. */
  status: Record<string, { turns: number; value: number }>;
  mods: Mod[];
  /** Uid of the unit that taunted this fighter while `status.taunt` is active. */
  tauntBy: string | null;
  /** Re-entrancy guard: TANKER auto-cast cannot recurse inside its own skill. */
  casting: boolean;
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
    status: {}, mods: [], tauntBy: null, casting: false, env,
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

function applyStatus(c: Ctx, dst: Fighter, kind: string, turns: number, value = 0) {
  if (!dst.alive || turns <= 0) return;
  const cur = dst.status[kind];
  // Never shorten; keep the stronger payload (A73).
  dst.status[kind] = { turns: Math.max(turns, cur?.turns ?? 0), value: Math.max(value, cur?.value ?? 0) };
  c.events.push({ t: "status", dst: dst.uid, kind, turns: dst.status[kind]!.turns });
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

/** Shield first, then HP. Emits the hit event before any resulting death so replay order is cause → effect. */
function applyDamage(c: Ctx, dst: Fighter, dmg: number, killer: Fighter | null, event: (absorbed: number) => CombatEvent) {
  const absorbed = Math.min(dst.shield, dmg);
  dst.shield -= absorbed;
  const toHp = Math.min(dst.hp, dmg - absorbed);
  dst.hp -= toHp;
  c.events.push(event(absorbed));
  const killed = dst.hp <= 0 && dst.alive;
  if (killed) kill(c, dst, killer);
  return { hp: toHp, absorbed, killed };
}

/** A12/A13 pipeline + A74 aftermath. Returns HP damage dealt (0 on miss). */
function strike(c: Ctx, src: Fighter, dst: Fighter, raw: number, type: "physical" | "magic" | "true", skill: boolean) {
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
  let dmg = Math.max(1, raw);
  if (ELEMENT_COUNTER[src.element] === dst.element) dmg *= dst.role === "TANKER" ? 0.5 : src.role === "TANKER" ? 1 : 1 + COUNTER_BONUS;
  if (src.element === "FIRE") dmg *= dst.env.fireVuln;
  if (CLASS_COUNTER[src.role]?.includes(dst.role)) dmg *= 1 + COUNTER_BONUS;
  const isCrit = type !== "true" && c.rng() < crit;
  if (isCrit) dmg *= critMult;
  else if (type === "physical") dmg = (dmg * 100) / (100 + stat(dst, "def"));
  else if (type === "magic") dmg = (dmg * 100) / (100 + stat(dst, "mdef"));
  dmg = Math.max(1, Math.round(dmg * c.globalMult));
  const resolved = applyDamage(c, dst, dmg, src,
    (absorbed) => ({ t: skill ? "skill" : "basic", src: src.uid, dst: dst.uid, dmg, absorbed, crit: isCrit }));
  if (resolved.hp > 0) {
    if (!skill) addRage(src, Math.round(c.rageGain[src.side] * (1 + src.rageGainPct)));
    if (src.lifesteal > 0) heal(c, src, src, resolved.hp * src.lifesteal);
    if (dst.alive && src.onHitBurn > 0) applyStatus(c, dst, "burn", 2, src.onHitBurn);
    if (dst.alive && src.onHitPoison > 0) applyStatus(c, dst, "poison", 2, src.onHitPoison);
  }
  afterDefender(c, dst, src);
  return { ...resolved, landed: true };
}

/** Defender +1 rage; TANKER full rage when attacked auto-casts (A14/A74). */
function afterDefender(c: Ctx, dst: Fighter, attacker: Fighter) {
  if (!dst.alive) return;
  addRage(dst, 1);
  if (dst.role === "TANKER" && dst.rage >= dst.rageMax && !dst.status.silence?.turns && !dst.casting) castSkill(c, dst, attacker);
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
  return ordered;
}

function castSkill(c: Ctx, f: Fighter, preferred?: Fighter) {
  const sp = skillSpec(f.baseId, f.star);
  f.casting = true;
  f.rage = 0;
  const targets = skillTargets(c, f, sp, preferred);
  c.events.push({ t: "cast", src: f.uid, targets: targets.map((x) => x.uid) });
  const starSkill = STAR_SKILL[f.star] ?? 1;
  const enemyHit = new Set<string>();
  const enemies = sp.side === "enemy" ? targets : [];
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
    for (const d of sp.dots) applyStatus(c, t, d.kind, d.turns, Math.round(d.value * dotMult));
    for (const k of sp.controls) {
      applyStatus(c, t, k.kind, k.turns);
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
  for (const a of allies) {
    if (!a.alive) continue;
    if (sp.heal) heal(c, f, a, sp.heal.formula ? (sp.heal.formula.base + statValue(f, sp.heal.formula.stat) * sp.heal.formula.scale) * starSkill : a.maxHp * sp.heal.pctMaxHp);
    if (sp.shield) {
      const amount = Math.max(1, Math.round((sp.shield.base + statValue(f, sp.shield.stat) * sp.shield.scale) * starSkill));
      a.shield += amount;
      c.events.push({ t: "shield", src: f.uid, dst: a.uid, amount });
    }
    for (const m of sp.buffs) a.mods.push({ ...m });
    if (sp.rageGrant && a !== f) addRage(a, sp.rageGrant);
  }
  if (sp.selfHealPctMaxHp) heal(c, f, f, f.maxHp * sp.selfHealPctMaxHp);
  if (f.role === "MAGE") addRage(f, enemyHit.size);
  f.casting = false;
}

interface TurnGate {
  canAct: boolean;
  silenced: boolean;
  disarmed: boolean;
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
    applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: k, dmg }));
    if (k === "disease" && dmg > 0) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const neighbor = c.all.find((x) => x.alive && x.side === f.side && x.row === f.row + dr && x.col === f.col + dc);
        if (neighbor && !((neighbor.status.disease?.turns ?? 0) > 0)) applyStatus(c, neighbor, "disease", 2, dmg);
      }
    }
    if (--s.turns <= 0) delete f.status[k];
    if (!f.alive) return { canAct: false, silenced, disarmed };
  }
  // A32 SWARM aura: non-matching units take 4 true damage per turn.
  if (f.env.poisonAura > 0) {
    const dmg = f.env.poisonAura;
    applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: "poisonAura", dmg }));
    if (!f.alive) return { canAct: false, silenced, disarmed };
  }
  f.mods = f.mods.filter((m) => --m.turns > 0);
  for (const [k, s] of Object.entries(f.status)) {
    if (DOTS.includes(k as (typeof DOTS)[number])) continue;
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
  if (f.rage >= f.rageMax && !gate.silenced) castSkill(c, f);
  else if (!gate.disarmed) {
    const t = basicTarget(c, f);
    if (t) {
      const u = getUnit(f.baseId);
      const magic = f.role === "MAGE" || f.role === "SUPPORT" || u.basic.damageType === "magic";
      strike(c, f, t, stat(f, magic ? "matk" : "atk"), magic ? "magic" : "physical", false);
      // SUPPORT: basic attack that fills rage auto-casts (A14).
      if (f.alive && f.role === "SUPPORT" && f.rage >= f.rageMax && !gate.silenced) castSkill(c, f);
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
