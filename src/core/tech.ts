// Technology tree (spec A8). Data + atomic research; effects are summed from levels.
export type Branch = "ROOT" | "VET" | "EXPLORE" | "ECON" | "MIL" | "CRAFT";
export const TECH_ROOT_ID = "root" as const;
export const TECH_BRANCH_ORDER = ["VET", "EXPLORE", "ECON", "MIL", "CRAFT"] as const satisfies readonly Exclude<Branch, "ROOT">[];
export type TechStat =
  | "hpPct" | "atkPct" | "defPct" | "matkPct" | "mdefPct" | "critPct" | "lifestealPct" | "rageGainPct"
  | "startShield" | "startRage" | "deployCap" | "bench" | "benchUpgrade" | "interestCap" | "interestRate"
  | "fixedIncome" | "winGold" | "xpCost" | "rerollCost" | "unequipDiscount" | "craftTable" | "speed";
type Effect = Partial<Record<TechStat, number>>;

export interface TechNode {
  id: string;
  branch: Branch;
  requires: string[];
  /** Finite cost per level; length = max level. */
  costs?: number[];
  /** Infinite node: cost = base + perLevel × currentLevel. */
  infinite?: { base: number; perLevel: number };
  /** Effect granted by purchasing level i (index = level-1); last entry repeats for infinite nodes. */
  effects: Effect[];
}

const n = (id: string, branch: Branch, requires: string[], costs: number[] | [number, number, "inf"], effects: Effect[]): TechNode =>
  costs[2] === "inf"
    ? { id, branch, requires, infinite: { base: costs[0] as number, perLevel: costs[1] as number }, effects }
    : { id, branch, requires, costs: costs as number[], effects };
const rep = (e: Effect, k: number) => Array<Effect>(k).fill(e);

const CORE: TechNode[] = [
  n("vet", "VET", [], [4], [{ hpPct: 5 }]),
  n("breed", "VET", ["vet"], [8], [{ deployCap: 1 }]),
  n("fitness", "VET", ["breed"], [4, 6, 8, 10, 12], rep({ hpPct: 3 }, 5)),
  n("survive", "VET", ["fitness"], [10, 3, "inf"], [{ startShield: 15 }]),
  n("explore", "EXPLORE", [], [4], [{ bench: 2 }]),
  n("bench_up", "EXPLORE", ["explore"], [10, 14, 18, 22], rep({ benchUpgrade: 1 }, 4)),
  n("barracks", "EXPLORE", ["bench_up"], [5, 8, 12, 16, 20], rep({ bench: 2 }, 5)),
  n("territory", "EXPLORE", ["barracks"], [8, 2, "inf"], [{ bench: 1 }]),
  n("econ", "ECON", [], [3], [{ interestCap: 1 }]),
  n("trade", "ECON", ["econ"], [5], [{ xpCost: -1 }]),
  n("invest", "ECON", ["trade"], [4, 6, 8, 10], rep({ interestCap: 1 }, 4)),
  n("tycoon", "ECON", ["invest"], [8, 3, "inf"], [{ fixedIncome: 1 }]),
  n("mil", "MIL", [], [4], [{ atkPct: 8 }]),
  n("train", "MIL", ["mil"], [7], [{ startRage: 1 }]),
  n("beast", "MIL", ["train"], [4, 6, 8, 10, 12], rep({ atkPct: 2, critPct: 1 }, 5)),
  n("warlord", "MIL", ["beast"], [10, 3, "inf"], [{ atkPct: 3 }]),
  n("craft_t", "CRAFT", [], [5, 10, 15], rep({ craftTable: 1 }, 3)),
  n("speed", "CRAFT", [], rep({}, 10).map(() => 3), rep({ speed: 1 }, 10)),
  n("metal", "CRAFT", ["craft_t"], [4, 7, 10], rep({ unequipDiscount: 1 }, 3)),
  n("arcane", "CRAFT", ["metal"], [6, 10], [{ matkPct: 8 }, { mdefPct: 8 }]),
  n("alpha_doctrine", "VET", ["survive", "beast"], [18], [{ hpPct: 5, lifestealPct: 3 }]),
  n("frontier_exchange", "ECON", ["territory", "tycoon"], [18], [{ fixedIncome: 1 }]),
  n("war_tax", "ECON", ["invest", "train"], [16], [{ winGold: 2, interestCap: 1 }]),
  n("siege_ritual", "MIL", ["warlord", "arcane"], [20], [{ atkPct: 5, matkPct: 5 }]),
  n("beast_foundry", "CRAFT", ["survive", "metal"], [18], [{ startShield: 20, defPct: 5 }]),
];

// Four-stage tracks: [id, stat, costs, values].
type Track = [string, TechStat, number[], number[]];
const P1 = [1, 1.5, 2, 2.5];
const TRACKS: Record<Exclude<Branch, "ROOT">, [string, Track[]]> = {
  VET: ["vet", [
    ["herb_lore", "hpPct", [6, 8, 10, 12], P1], ["bark_guard", "startShield", [7, 9, 11, 13], [6, 10, 14, 18]],
    ["soothing_mist", "mdefPct", [8, 10, 12, 14], P1], ["wild_fang", "lifestealPct", [8, 10, 12, 14], [2, 3, 4, 5]],
    ["stone_hide", "defPct", [8, 10, 12, 14], P1], ["moon_ward", "mdefPct", [8, 10, 12, 14], P1]]],
  EXPLORE: ["explore", [
    ["trail_pack", "bench", [5, 7, 9, 11], [1, 1, 2, 2]], ["field_cache", "bench", [6, 8, 10, 12], [1, 1, 1, 2]],
    ["ranger_banner", "deployCap", [8, 10, 12, 14], [1, 1, 1, 1]], ["scout_bounty", "winGold", [7, 9, 11, 13], [1, 1, 1, 2]],
    ["map_rewrite", "rerollCost", [8, 10, 12, 14], [-1, -1, -1, -1]], ["supply_line", "bench", [8, 10, 12, 14], [1, 1, 1, 2]]]],
  ECON: ["econ", [
    ["bank_roots", "interestCap", [6, 8, 10, 12], [1, 1, 1, 1]], ["coin_flow", "fixedIncome", [7, 9, 11, 13], [1, 1, 1, 1]],
    ["compound_seed", "interestRate", [8, 10, 12, 14], [1, 1, 2, 2]], ["guild_trade", "winGold", [8, 10, 12, 14], [1, 1, 1, 2]],
    ["scholar_fund", "xpCost", [7, 9, 11, 13], [-1, -1, -1, -1]], ["ledger_root", "fixedIncome", [8, 10, 12, 14], [1, 1, 1, 1]]]],
  MIL: ["mil", [
    ["war_drum", "atkPct", [6, 8, 10, 12], P1], ["iron_wall", "defPct", [7, 9, 11, 13], P1],
    ["eagle_eye", "critPct", [7, 9, 11, 13], P1], ["blood_oath", "startRage", [8, 10, 12, 14], [1, 1, 1, 1]],
    ["battle_tempo", "rageGainPct", [8, 10, 12, 14], [5, 8, 10, 12]], ["blood_banner", "rageGainPct", [8, 10, 12, 14], [4, 6, 8, 10]]]],
  CRAFT: ["craft_t", [
    ["arc_weld", "matkPct", [6, 8, 10, 12], P1], ["ward_forge", "mdefPct", [7, 9, 11, 13], P1],
    ["steel_lattice", "defPct", [7, 9, 11, 13], P1], ["quick_hands", "unequipDiscount", [6, 8, 10, 12], [1, 1, 1, 1]],
    ["alchemy_pulse", "lifestealPct", [8, 10, 12, 14], P1], ["runic_forge", "matkPct", [8, 10, 12, 14], P1]]],
};

// ponytail: stage 1 chains from the branch head (spec names no explicit parent); change if authored data differs.
const STAGES: TechNode[] = Object.entries(TRACKS).flatMap(([branch, [head, tracks]]) =>
  tracks.flatMap(([id, stat, costs, values]) =>
    costs.map((cost, i): TechNode => ({
      id: `${id}_${i + 1}`, branch: branch as Branch, requires: [i === 0 ? head : `${id}_${i}`],
      costs: [cost], effects: [{ [stat]: values[i]! }],
    }))));

export const TECH_NODES: TechNode[] = [...CORE, ...STAGES];
export const TECH_BY_ID: ReadonlyMap<string, TechNode> = new Map(TECH_NODES.map((t) => [t.id, t]));

export const maxLevel = (t: TechNode) => (t.infinite ? Infinity : t.costs!.length);

export function researchCost(t: TechNode, level: number): number {
  return t.infinite ? t.infinite.base + t.infinite.perLevel * level : t.costs![level]!;
}

/** Root is an always-satisfied virtual prerequisite for branch heads. */
export function techRequirements(t: TechNode): readonly string[] {
  return t.requires.length ? t.requires : [TECH_ROOT_ID];
}

export function techPrerequisiteMet(levels: Readonly<Record<string, number>>, id: string): boolean {
  return id === TECH_ROOT_ID || Math.max(0, Math.floor(Number(levels[id]) || 0)) >= 1;
}

/** A8 gate: node exists, every prerequisite ≥1 (root implicit), below max, affordable. */
export function canResearch(levels: Record<string, number>, id: string, gold: number): boolean {
  const t = TECH_BY_ID.get(id);
  if (!t) return false;
  const lvl = levels[id] ?? 0;
  return techRequirements(t).every((r) => techPrerequisiteMet(levels, r))
    && lvl < maxLevel(t)
    && gold >= researchCost(t, lvl);
}

export type TechAvailability = "root" | "maxed" | "affordable" | "unaffordable" | "locked";

export interface TechPrerequisiteState {
  id: string;
  met: boolean;
}

export interface TechEffectEntry {
  stat: TechStat;
  value: number;
}

export interface TechNodeState {
  id: string;
  branch: Branch;
  level: number;
  maxLevel: number;
  purchased: boolean;
  maxed: boolean;
  unlocked: boolean;
  affordable: boolean;
  researchable: boolean;
  availability: TechAvailability;
  nextCost: number | null;
  prerequisites: TechPrerequisiteState[];
  nextEffects: TechEffectEntry[];
}

export function techEffectEntries(effect: Effect | undefined): TechEffectEntry[] {
  if (!effect) return [];
  return Object.entries(effect).flatMap(([stat, raw]) => {
    const value = Number(raw);
    return Number.isFinite(value) ? [{ stat: stat as TechStat, value }] : [];
  });
}

/** A111 non-visual node-state source of truth for info panels, graph state and research affordance. */
export function techNodeState(
  levels: Readonly<Record<string, number>>,
  id: string,
  gold: number,
): TechNodeState | null {
  if (id === TECH_ROOT_ID) {
    return {
      id, branch: "ROOT", level: 1, maxLevel: 1, purchased: true, maxed: true,
      unlocked: true, affordable: false, researchable: false, availability: "root",
      nextCost: null, prerequisites: [], nextEffects: [],
    };
  }
  const node = TECH_BY_ID.get(id);
  if (!node) return null;
  const max = maxLevel(node);
  const level = Math.min(max, Math.max(0, Math.floor(Number(levels[id]) || 0)));
  const prerequisites = techRequirements(node).map((requirement) => ({
    id: requirement,
    met: techPrerequisiteMet(levels, requirement),
  }));
  const unlocked = prerequisites.every((requirement) => requirement.met);
  const maxed = level >= max;
  const nextCost = maxed ? null : researchCost(node, level);
  const affordable = !maxed && Number.isFinite(gold) && gold >= (nextCost ?? Infinity);
  const researchable = unlocked && affordable && !maxed;
  const availability: TechAvailability = maxed
    ? "maxed"
    : !unlocked
      ? "locked"
      : affordable
        ? "affordable"
        : "unaffordable";
  return {
    id: node.id,
    branch: node.branch,
    level,
    maxLevel: max,
    purchased: level > 0,
    maxed,
    unlocked,
    affordable,
    researchable,
    availability,
    nextCost,
    prerequisites,
    nextEffects: maxed ? [] : techEffectEntries(node.effects[Math.min(level, node.effects.length - 1)]),
  };
}

/** Sum of every purchased level's effects. */
export function techModifiers(levels: Record<string, number>): Effect {
  const out: Effect = {};
  for (const [id, lvl] of Object.entries(levels)) {
    const t = TECH_BY_ID.get(id);
    if (!t) continue;
    const count = Math.max(0, Math.floor(Number(lvl) || 0));
    if (t.infinite && t.effects.length === 1 && count > 0) {
      for (const [k, v] of Object.entries(t.effects[0]!)) {
        out[k as TechStat] = (out[k as TechStat] ?? 0) + v * count;
      }
      continue;
    }
    for (let i = 0; i < Math.min(count, maxLevel(t)); i++) {
      for (const [k, v] of Object.entries(t.effects[Math.min(i, t.effects.length - 1)]!)) {
        out[k as TechStat] = (out[k as TechStat] ?? 0) + v;
      }
    }
  }
  return out;
}
