// Loot generation (A40) + combat result application (A18). Pure; RNG injected.
import { getUnit, type UnitDef } from "../content/catalog";

export type Rng = () => number;

/** Authored equipment by tier. ponytail: spec names only these two ids; tiers inferred
 * (blue_buff = 1×1 recipe → T1, warmog = tutorial "completed" item → T2). Load full table when data ships. */
export const EQUIPMENT_BY_TIER: Record<number, string[]> = { 1: ["eq_blue_buff"], 2: ["eq_warmog_armor"], 3: [] };

const SPECIES_MATERIAL: [string, RegExp][] = [
  ["feather", /eagle|crow|owl|parrot|peacock|swan|phoenix|wasp|butterfly|dragonfly|falcon|hawk|heron|dove|bird/],
  ["bark", /turtle|pangolin|rhino|crocodile|snake|dinosaur|chameleon|scorpion|toad|snail|tatu|armadillo|lizard|trex/],
  ["belt", /bear|buffalo|elephant|tiger|wolf|deer|boar|lion|hippo|primate|monkey|ape|sheep|goat|horse|rabbit|dog|weasel|jaguar|lynx|fox|yak|ox|badger/],
  ["claw", /wasp|ant|beetle|scorpion|mantis|spider|mosquito|worm|dragonfly|butterfly|cockroach|termite|centipede/],
  ["tear", /fish|dolphin|octopus|starfish|seal|squid|snail|crab|jelly/],
  ["crystal", /phoenix|qilin|dragon|butterfly|dragonfly/],
];
const FALLBACK: Record<string, string> = { STONE: "bark", WIND: "feather", FIRE: "claw", TIDE: "tear", NIGHT: "claw", SPIRIT: "crystal", SWARM: "claw" };
/** Chance for candidate #2 / #3 by enemy tier 1..5. */
const EXTRA_CHANCE: [number, number][] = [[0.18, 0.04], [0.28, 0.08], [0.4, 0.14], [0.52, 0.2], [0.66, 0.28]];
export const EQUIP_DROP_CHANCE = 0.05;

export function materialCandidates(u: UnitDef): string[] {
  const out: string[] = [];
  const add = (m: string) => { if (!out.includes(m)) out.push(m); };
  for (const [m, re] of SPECIES_MATERIAL) if (re.test(u.species)) add(m);
  if (u.element === "TIDE") add("tear");
  if (u.element === "SPIRIT" || u.element === "NIGHT" || u.role === "MAGE") add("crystal");
  if (!out.length) add(FALLBACK[u.element] ?? "claw");
  return out;
}

export interface Drop { item: string; source: string; rule: "material" | "equipment" }

export function rollLoot(baseId: string, star: number, rng: Rng, equipment = EQUIPMENT_BY_TIER): Drop[] {
  const u = getUnit(baseId);
  const tier = Math.min(5, Math.max(1, u.tier));
  const cands = materialCandidates(u);
  const [c2, c3] = EXTRA_CHANCE[tier - 1]!;
  const drops: Drop[] = [{ item: cands[0]!, source: baseId, rule: "material" }];
  if (cands[1] && rng() < c2) drops.push({ item: cands[1], source: baseId, rule: "material" });
  if (cands[2] && rng() < c3) drops.push({ item: cands[2], source: baseId, rule: "material" });
  if (rng() < EQUIP_DROP_CHANCE) {
    const pool = equipment[Math.min(3, Math.max(1, star))] ?? [];
    if (pool.length) drops.push({ item: pool[Math.floor(rng() * pool.length)]!, source: baseId, rule: "equipment" });
  }
  return drops;
}

export type DamageRule = "onePerLoss" | "survivorCount" | "clamped";

export function lossDamage(rule: DamageRule, enemySurvivors: number): number {
  if (enemySurvivors <= 0) return 0;
  if (rule === "onePerLoss") return 1;
  if (rule === "survivorCount") return enemySurvivors;
  return Math.min(4, Math.max(1, enemySurvivors));
}

export interface CombatOutcome {
  /** Unique per combat; application is idempotent on this id. */
  combatId: string;
  won: boolean;
  enemySurvivors: number;
  enemyStars: number[];
  bounty: number;
  drops: Drop[];
}

export interface RewardTarget {
  gold: number; hp: number; xpGain: number; itemBag: string[];
  winStreak: number; loseStreak: number; winGoldBonus: number;
  appliedCombats: string[];
}

/** A18: apply once. Drops accepted only up to inventory capacity; overflow is dropped, never inserted. */
export function applyOutcome(t: RewardTarget, o: CombatOutcome, capacity: number, rule: DamageRule, creative = false):
  { gold: number; damage: number; accepted: Drop[]; rejected: Drop[] } | null {
  if (t.appliedCombats.includes(o.combatId)) return null;
  t.appliedCombats.push(o.combatId);
  let gold = o.bounty;
  let damage = 0;
  if (o.won) {
    gold += o.enemyStars.length + o.enemyStars.reduce((a, s) => a + Math.max(0, s - 1), 0) + t.winGoldBonus;
    if (!creative) t.xpGain += 2;
    t.winStreak++; t.loseStreak = 0;
  } else {
    damage = lossDamage(rule, o.enemySurvivors);
    t.hp = Math.max(0, t.hp - damage);
    t.loseStreak++; t.winStreak = 0;
  }
  t.gold += gold;
  const room = Math.max(0, capacity - t.itemBag.length);
  const accepted = o.drops.slice(0, room);
  for (const d of accepted) t.itemBag.push(d.item);
  return { gold, damage, accepted, rejected: o.drops.slice(room) };
}
