// Deterministic combat engine (spec A11–A18, A73, A74). Pure: no rendering, timers or audio.
// Presentation replays `events` in order; HP/status changes are already resolved per event.
// ponytail: status families with bespoke payloads (soul link, berserk, guardian, reflect...) are not modeled;
// add them as SkillSpec grows per-family handlers.
import { getUnit, type Element, type Role } from "../content/catalog";
import { STAR_SKILL, STAR_STAT } from "./economy";
import { skillSpec, type BuffStat, type SkillSpec, type Stat } from "./skills";
import { CLASS_COUNTER, COUNTER_BONUS, ELEMENT_COUNTER } from "./synergy";

export type Side = "L" | "R";
export const COLS = 10;
export const ROWS = 5;
const CYCLE_CAP = 20;
const ROLE_EVADE: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.08, ASSASSIN: 0.15, ARCHER: 0.1, MAGE: 0.05, SUPPORT: 0.07 };
const ROLE_CRIT: Record<Role, number> = { TANKER: 0.05, FIGHTER: 0.05, ASSASSIN: 0.25, ARCHER: 0.2, MAGE: 0.1, SUPPORT: 0.05 };
const STAR_DOT = [0, 1, 1.3, 1.6];
const CONTROL_SKIP: Record<string, true> = { stun: true, freeze: true, sleep: true };
const DOTS = ["bleed", "burn", "poison", "disease"] as const;

interface Mod { stat: BuffStat; value: number; pct: boolean; turns: number }

export interface Fighter {
  uid: string; baseId: string; star: number; side: Side; row: number; col: number;
  role: Role; element: Element;
  maxHp: number; hp: number; atk: number; def: number; matk: number; mdef: number;
  range: number; rageMax: number; rage: number; shield: number; alive: boolean;
  crit: number; evade: number; lifesteal: number; rageGainPct: number; healPct: number;
  onHitBurn: number; onHitPoison: number;
  /** Timed statuses: control kinds + DoT kinds; DoTs carry per-tick value. */
  status: Record<string, { turns: number; value: number }>;
  mods: Mod[];
  /** Uid of the unit that taunted this fighter while `status.taunt` is active. */
  tauntBy: string | null;
  /** Re-entrancy guard: TANKER auto-cast cannot recurse inside its own skill. */
  casting: boolean;
}

/** Flat/percent start-of-combat bonuses from synergy, tech and augments (summed by caller). */
export type SideBonus = Partial<Record<
  "def" | "mdef" | "atkPct" | "matkPct" | "hpPct" | "defPct" | "mdefPct" | "healPct" | "startShield" | "startRage"
  | "burn" | "poison" | "critPct" | "evadePct" | "lifestealPct" | "rageGainPct", number>>;

export interface Placement { uid: string; baseId: string; star: number; row: number; col: number }

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
}

/** A13: 1.0 at ≤10 gold; +1% per 2 gold above 10; capped at 2.0. */
export function goldMultiplier(gold: number): number {
  if (!(gold > 10)) return 1;
  return Math.min(2, 1 + (gold - 10) / 2 / 100);
}

export function makeFighter(p: Placement, side: Side, b: SideBonus = {}): Fighter {
  const u = getUnit(p.baseId);
  const m = STAR_STAT[p.star] ?? 1;
  const st = u.stats;
  const maxHp = Math.round(st.hp * m * (1 + (b.hpPct ?? 0) / 100));
  // Scaled base-stat evasion: +5pp at 2★, +10pp at 3★, capped 60% (A12).
  const evade = Math.min(0.6, ROLE_EVADE[u.role] + (st.evade ?? 0) + (p.star - 1) * 0.05) + (b.evadePct ?? 0) / 100;
  return {
    uid: p.uid, baseId: p.baseId, star: p.star, side, row: p.row, col: p.col, role: u.role, element: u.element,
    maxHp, hp: maxHp,
    atk: Math.round(st.atk * m * (1 + (b.atkPct ?? 0) / 100)),
    def: Math.round(st.def * m * (1 + (b.defPct ?? 0) / 100) + (b.def ?? 0)),
    matk: Math.round(st.matk * m * (1 + (b.matkPct ?? 0) / 100)),
    mdef: Math.round(st.mdef * m * (1 + (b.mdefPct ?? 0) / 100) + (b.mdef ?? 0)),
    range: st.range, rageMax: Math.max(1, u.skill.rageCost[p.star - 1] ?? st.rageMax),
    rage: 0, shield: b.startShield ?? 0, alive: true,
    crit: ROLE_CRIT[u.role] + (st.crit ?? 0) + (b.critPct ?? 0) / 100,
    evade, lifesteal: (b.lifestealPct ?? 0) / 100, rageGainPct: (b.rageGainPct ?? 0) / 100,
    healPct: (b.healPct ?? 0) / 100, onHitBurn: b.burn ?? 0, onHitPoison: b.poison ?? 0,
    status: {}, mods: [], tauntBy: null, casting: false,
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
  if (s === "atk" && f.role === "FIGHTER") v *= 1 + (1 - f.hp / f.maxHp);
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
  const amount = Math.min(dst.maxHp - dst.hp, Math.round(raw * (1 + src.healPct)));
  if (amount <= 0) return;
  dst.hp += amount;
  c.events.push({ t: "heal", src: src.uid, dst: dst.uid, amount });
}

function kill(c: Ctx, f: Fighter, killer: Fighter | null) {
  f.alive = false;
  f.shield = 0;
  f.hp = 0;
  c.events.push({ t: "death", dst: f.uid });
  if (killer?.role === "ASSASSIN") c.bounty[killer.side] += killer.star;
}

/** Shield first, then HP. Emits the hit event before any resulting death so replay order is cause → effect. */
function applyDamage(c: Ctx, dst: Fighter, dmg: number, killer: Fighter | null, event: (absorbed: number) => CombatEvent) {
  const absorbed = Math.min(dst.shield, dmg);
  dst.shield -= absorbed;
  const toHp = Math.min(dst.hp, dmg - absorbed);
  dst.hp -= toHp;
  c.events.push(event(absorbed));
  if (dst.hp <= 0 && dst.alive) kill(c, dst, killer);
  return toHp;
}

/** A12/A13 pipeline + A74 aftermath. Returns HP damage dealt (0 on miss). */
function strike(c: Ctx, src: Fighter, dst: Fighter, raw: number, type: "physical" | "magic" | "true", skill: boolean): number {
  let crit = src.crit;
  let critMult = 1.5;
  let hit = 0.95 - stat(dst, "evade");
  if (src.role === "ARCHER") {
    const d = dist(src, dst);
    hit -= 0.05 * d; crit += 0.05 * d; critMult += 0.05 * d;
  }
  if (!skill && type === "physical" && c.rng() >= Math.min(1, Math.max(0.1, hit))) {
    c.events.push({ t: "miss", src: src.uid, dst: dst.uid });
    afterDefender(c, dst);
    return 0;
  }
  let dmg = Math.max(1, raw);
  if (ELEMENT_COUNTER[src.element] === dst.element) dmg *= dst.role === "TANKER" ? 0.5 : src.role === "TANKER" ? 1 : 1 + COUNTER_BONUS;
  if (CLASS_COUNTER[src.role]?.includes(dst.role)) dmg *= 1 + COUNTER_BONUS;
  const isCrit = type !== "true" && c.rng() < crit;
  if (isCrit) dmg *= critMult;
  else if (type === "physical") dmg = (dmg * 100) / (100 + stat(dst, "def"));
  else if (type === "magic") dmg = (dmg * 100) / (100 + stat(dst, "mdef"));
  dmg = Math.max(1, Math.round(dmg * c.globalMult));
  const toHp = applyDamage(c, dst, dmg, src,
    (absorbed) => ({ t: skill ? "skill" : "basic", src: src.uid, dst: dst.uid, dmg, absorbed, crit: isCrit }));
  if (toHp > 0) {
    if (!skill) addRage(src, Math.round(c.rageGain[src.side] * (1 + src.rageGainPct)));
    if (src.lifesteal > 0) heal(c, src, src, toHp * src.lifesteal);
    if (dst.alive && src.onHitBurn > 0) applyStatus(c, dst, "burn", 2, src.onHitBurn);
    if (dst.alive && src.onHitPoison > 0) applyStatus(c, dst, "poison", 2, src.onHitPoison);
  }
  afterDefender(c, dst);
  return toHp;
}

/** Defender +1 rage; TANKER full rage when attacked auto-casts (A14/A74). */
function afterDefender(c: Ctx, dst: Fighter) {
  if (!dst.alive) return;
  addRage(dst, 1);
  if (dst.role === "TANKER" && dst.rage >= dst.rageMax && !dst.status.silence?.turns && !dst.casting) castSkill(c, dst);
}

function statValue(f: Fighter, s: Stat): number {
  return s === "hp" ? f.maxHp : stat(f, s);
}

/** Resolve skill target set from the parsed spec (A11 deterministic selectors). */
function skillTargets(c: Ctx, f: Fighter, sp: SkillSpec): Fighter[] {
  if (sp.side === "self") return [f];
  const pool = sp.side === "ally" ? friends(c, f) : foes(c, f);
  if (sp.area === "all") return pool;
  const primary = sp.side === "enemy" && !sp.pickLowestHp ? basicTarget(c, f) : null;
  const ordered = [...pool].sort((a, b) => (sp.pickLowestHp ? hpRatio(a) - hpRatio(b) : 0)
    || (primary ? dist(primary, a) - dist(primary, b) : 0) || rowRank(f.row, a.row) - rowRank(f.row, b.row)
    || a.uid.localeCompare(b.uid));
  const p = primary ?? ordered[0];
  if (!p) return [];
  if (sp.area === "row") return pool.filter((x) => x.row === p.row);
  if (sp.area === "column") return pool.filter((x) => x.col === p.col);
  if (sp.area === "square") return pool.filter((x) => Math.abs(x.row - p.row) <= 1 && Math.abs(x.col - p.col) <= 1);
  return ordered.slice(0, Math.max(1, sp.count));
}

function castSkill(c: Ctx, f: Fighter) {
  const sp = skillSpec(f.baseId, f.star);
  f.casting = true;
  f.rage = 0;
  const targets = skillTargets(c, f, sp);
  c.events.push({ t: "cast", src: f.uid, targets: targets.map((x) => x.uid) });
  const starSkill = STAR_SKILL[f.star] ?? 1;
  const enemyHit = new Set<string>();
  const enemies = sp.side === "enemy" ? targets : [];
  const allies = sp.side === "enemy" ? [f] : targets;

  if (sp.damage) {
    const d = sp.damage;
    const raw = Math.round((d.base + statValue(f, d.stat) * d.scale) * starSkill * goldMultiplier(c.gold[f.side]));
    let drained = 0;
    for (const t of enemies) if (t.alive) { drained += strike(c, f, t, raw, d.type, true); enemyHit.add(t.uid); }
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

/** Start-of-turn: DoT ticks (true damage, no rage), mod expiry, control check. Returns false when the turn is lost. */
function startTurn(c: Ctx, f: Fighter): boolean {
  for (const k of DOTS) {
    const s = f.status[k];
    if (!s?.turns) continue;
    const dmg = Math.max(1, Math.round(s.value * c.globalMult));
    applyDamage(c, f, dmg, null, () => ({ t: "dot", dst: f.uid, kind: k, dmg }));
    if (--s.turns <= 0) delete f.status[k];
    if (!f.alive) return false;
  }
  f.mods = f.mods.filter((m) => --m.turns > 0);
  let skip: string | null = null;
  for (const [k, s] of Object.entries(f.status)) {
    if (DOTS.includes(k as (typeof DOTS)[number])) continue;
    if (CONTROL_SKIP[k] && s.turns > 0) skip ??= k;
  }
  if (skip) {
    c.events.push({ t: "skip", src: f.uid, reason: skip });
    tickControls(f);
  }
  return !skip;
}

function tickControls(f: Fighter) {
  for (const [k, s] of Object.entries(f.status)) {
    if (DOTS.includes(k as (typeof DOTS)[number])) continue;
    if (--s.turns <= 0) {
      delete f.status[k];
      if (k === "taunt") f.tauntBy = null;
    }
  }
}

function act(c: Ctx, f: Fighter) {
  if (!f.alive) return;
  if (!startTurn(c, f)) return;
  if (f.rage >= f.rageMax && !f.status.silence) castSkill(c, f);
  else if (!f.status.disarm) {
    const t = basicTarget(c, f);
    if (t) {
      const u = getUnit(f.baseId);
      const magic = f.role === "MAGE" || f.role === "SUPPORT" || u.basic.damageType === "magic";
      strike(c, f, t, stat(f, magic ? "matk" : "atk"), magic ? "magic" : "physical", false);
      // SUPPORT: basic attack that fills rage auto-casts (A14).
      if (f.alive && f.role === "SUPPORT" && f.rage >= f.rageMax && !f.status.silence) castSkill(c, f);
    }
  }
  tickControls(f);
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
    ...left.map((p) => makeFighter(p, "L", o.bonus?.L)),
    ...right.map((p) => makeFighter(p, "R", o.bonus?.R)),
  ];
  for (const f of all) f.rage = Math.min(f.rageMax, o.bonus?.[f.side]?.startRage ?? 0);
  const c: Ctx = {
    all, rng: mulberry(o.seed), events: [], globalMult: 1,
    gold: { L: o.gold?.L ?? 0, R: o.gold?.R ?? 0 },
    rageGain: { L: o.rageGain?.L ?? 1, R: o.rageGain?.R ?? 1 },
    bounty: { L: 0, R: 0 },
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
    alive, total: { L: left.length, R: right.length }, bounty: c.bounty, actions, events: c.events,
    survivors: all.filter((f) => f.alive),
  };
}
