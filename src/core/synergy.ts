// Synergy thresholds and counters (spec A9). Pure data + counting; combat reads the bonus records.
import { getUnit, type Element, type Faction, type Role } from "../content/catalog";

export type SynergyStat =
  | "def" | "mdef" | "atkPct" | "matkPct" | "hpPct" | "healPct" | "startShield" | "burn" | "poison"
  | "critPct" | "startRage" | "evadePct" | "lifestealPct";
type Tier = Partial<Record<SynergyStat, number>>;
export const THRESHOLDS = [2, 4, 6] as const;

export const CLASS_SYN: Record<Role, [Tier, Tier, Tier]> = {
  TANKER: [{ def: 8, mdef: 6 }, { def: 16, mdef: 12 }, { def: 28, mdef: 20 }],
  ASSASSIN: [{ atkPct: 8 }, { atkPct: 18 }, { atkPct: 32 }],
  ARCHER: [{ atkPct: 10 }, { atkPct: 22 }, { atkPct: 36 }],
  MAGE: [{ matkPct: 10 }, { matkPct: 22 }, { matkPct: 36 }],
  SUPPORT: [{ healPct: 12 }, { healPct: 25 }, { healPct: 40 }],
  FIGHTER: [{ hpPct: 8, atkPct: 6 }, { hpPct: 16, atkPct: 14 }, { hpPct: 30, atkPct: 24 }],
};

export const ELEMENT_SYN: Record<Element, [Tier, Tier, Tier]> = {
  STONE: [{ startShield: 18 }, { startShield: 40 }, { startShield: 72 }],
  WIND: [{ atkPct: 6, matkPct: 6 }, { atkPct: 14, matkPct: 14 }, { atkPct: 24, matkPct: 24 }],
  FIRE: [{ burn: 6 }, { burn: 12 }, { burn: 20 }],
  TIDE: [{ mdef: 6, healPct: 6 }, { mdef: 14, healPct: 14 }, { mdef: 24, healPct: 24 }],
  NIGHT: [{ critPct: 8 }, { critPct: 18 }, { critPct: 30 }],
  SPIRIT: [{ startRage: 1 }, { startRage: 1, healPct: 12 }, { startRage: 2, healPct: 24 }],
  SWARM: [{ poison: 8 }, { poison: 14 }, { poison: 22 }],
  WOOD: [{ evadePct: 5 }, { evadePct: 10, hpPct: 8 }, { evadePct: 16, hpPct: 16, healPct: 12 }],
};

export const FACTION_SYN: Record<Faction, [Tier, Tier, Tier]> = {
  BEAST: [{ hpPct: 8 }, { hpPct: 16, def: 8 }, { hpPct: 26, def: 16 }],
  AVIAN: [{ atkPct: 6, evadePct: 4 }, { atkPct: 14, evadePct: 8 }, { atkPct: 24, evadePct: 14 }],
  INSECT: [{ poison: 5, lifestealPct: 4 }, { poison: 10, lifestealPct: 8 }, { poison: 16, lifestealPct: 14 }],
  REPTILE: [{ def: 6, mdef: 4 }, { def: 14, mdef: 10 }, { def: 24, mdef: 16 }],
  AQUATIC: [{ healPct: 6, mdef: 4 }, { healPct: 14, mdef: 10 }, { healPct: 24, mdef: 18 }],
  MYTHICAL: [{ startRage: 1, matkPct: 6 }, { startRage: 1, matkPct: 14 }, { startRage: 2, matkPct: 24 }],
};

export const ELEMENT_COUNTER: Record<Element, Element | null> = {
  FIRE: "SPIRIT", SPIRIT: "TIDE", TIDE: "FIRE", STONE: "WIND", WIND: "NIGHT", NIGHT: "STONE", WOOD: "TIDE", SWARM: null,
};
export const CLASS_COUNTER: Partial<Record<Role, Role[]>> = {
  ASSASSIN: ["MAGE", "ARCHER"], ARCHER: ["MAGE"], FIGHTER: ["ASSASSIN"],
};
export const COUNTER_BONUS = 0.5;

/** Damage multiplier: 1 + 0.5 per matching counter edge (element, class). */
export function counterMultiplier(att: string, def: string): number {
  const a = getUnit(att);
  const d = getUnit(def);
  const hits = Number(ELEMENT_COUNTER[a.element] === d.element) + Number(!!CLASS_COUNTER[a.role]?.includes(d.role));
  return 1 + COUNTER_BONUS * hits;
}

export interface SynergyLine {
  kind: "class" | "element" | "faction";
  key: string;
  count: number;
  /** Active threshold (0 = none). */
  active: number;
  /** Next threshold, null when maxed. */
  next: number | null;
  bonus: Tier;
}

export interface VirtualSynergyCounts {
  extraClassCount?: number;
  extraTribeCount?: number;
}

export interface AggregatedVirtualSynergyCounts {
  extraClassCount: number;
  extraTribeCount: number;
}

const normalizedVirtualCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

/** A82 co-op: virtual counts are pooled across every allied player before leader selection. */
export function aggregateVirtualSynergyCounts(
  players: Iterable<VirtualSynergyCounts>,
): AggregatedVirtualSynergyCounts {
  let extraClassCount = 0;
  let extraTribeCount = 0;
  for (const player of players) {
    extraClassCount += normalizedVirtualCount(player.extraClassCount);
    extraTribeCount += normalizedVirtualCount(player.extraTribeCount);
  }
  return { extraClassCount, extraTribeCount };
}

/** Count deployed units and apply each virtual echo to the stable most-numerous identity only (A82). */
export function computeSynergies(baseIds: string[], extraClass = 0, extraTribe = 0): SynergyLine[] {
  const counts: Record<string, Record<string, number>> = { class: {}, element: {}, faction: {} };
  for (const id of baseIds) {
    const u = getUnit(id);
    counts.class![u.role] = (counts.class![u.role] ?? 0) + 1;
    counts.element![u.element] = (counts.element![u.element] ?? 0) + 1;
    counts.faction![u.faction] = (counts.faction![u.faction] ?? 0) + 1;
  }
  const addVirtualToLeader = (kind: "class" | "faction", amount: number) => {
    const entries = Object.entries(counts[kind]!);
    if (!entries.length || !(amount > 0)) return;
    let leader = entries[0]!;
    for (const entry of entries.slice(1)) if (entry[1] > leader[1]) leader = entry;
    counts[kind]![leader[0]] = leader[1] + amount;
  };
  addVirtualToLeader("class", Math.max(0, extraClass));
  addVirtualToLeader("faction", Math.max(0, extraTribe));
  const tables = { class: CLASS_SYN, element: ELEMENT_SYN, faction: FACTION_SYN } as Record<string, Record<string, Tier[]>>;
  return (["class", "element", "faction"] as const).flatMap((kind) =>
    Object.entries(counts[kind]!).flatMap(([key, raw]) => {
      const tiers = tables[kind]![key];
      if (!tiers) return [];
      const count = raw;
      const idx = THRESHOLDS.filter((t) => count >= t).length;
      return [{ kind, key, count, active: idx ? THRESHOLDS[idx - 1]! : 0, next: THRESHOLDS[idx] ?? null, bonus: idx ? tiers[idx - 1]! : {} }];
    }));
}

/** Shared allied formation + pooled player echoes. Bench composition never enters this helper. */
export function computeCoopSynergies(
  deployedBaseIds: string[],
  players: Iterable<VirtualSynergyCounts>,
): SynergyLine[] {
  const totals = aggregateVirtualSynergyCounts(players);
  return computeSynergies(deployedBaseIds, totals.extraClassCount, totals.extraTribeCount);
}
