// Battlefield environments (A32). Canonical round rule; fresh per-fighter mods, catalog never mutated.
import type { Element } from "../content/catalog";

export const ROUND_ENVIRONMENT_CYCLE = ["FIRE", "TIDE", "WIND", "STONE", "NIGHT", "SWARM", "SPIRIT", "WOOD"] as const;
export type EnvironmentId = (typeof ROUND_ENVIRONMENT_CYCLE)[number];

export const environmentFor = (round: number): EnvironmentId =>
  ROUND_ENVIRONMENT_CYCLE[(Math.max(1, Math.floor(round)) - 1) % 8]!;

/** Mods the combat copy reads. Flat stats/percent ATK are applied once at construction; the rest at the owning event. */
export interface EnvMods {
  burnOnHit: number; poisonOnHit: number; fireVuln: number; healPct: number; healRecvPct: number;
  mdef: number; def: number; evade: number; accuracy: number; atkPct: number; matkPct: number;
  startShield: number; startRage: number; critPct: number; poisonAura: number; rageGainPct: number; lifesteal: number;
}

const ZERO: EnvMods = {
  burnOnHit: 0, poisonOnHit: 0, fireVuln: 1, healPct: 0, healRecvPct: 0, mdef: 0, def: 0, evade: 0, accuracy: 0,
  atkPct: 0, matkPct: 0, startShield: 0, startRage: 0, critPct: 0, poisonAura: 0, rageGainPct: 0, lifesteal: 0,
};

const RULES: Record<EnvironmentId, [Partial<EnvMods>, Partial<EnvMods>]> = {
  FIRE: [{ burnOnHit: 6 }, { fireVuln: 1.25 }],
  TIDE: [{ healPct: 0.06, mdef: 6 }, { evade: -0.1 }],
  WIND: [{ atkPct: 0.06, matkPct: 0.06 }, { accuracy: -0.1 }],
  STONE: [{ startShield: 18 }, { def: -6, mdef: -4 }],
  NIGHT: [{ critPct: 0.08 }, { healRecvPct: -0.25 }],
  SWARM: [{ poisonOnHit: 8 }, { poisonAura: 4 }],
  SPIRIT: [{ startRage: 1 }, { rageGainPct: -0.2 }],
  WOOD: [{ lifesteal: 0.05, evade: 0.05 }, { lifesteal: -0.05, healPct: -0.1 }],
};

export function environmentMods(env: EnvironmentId | null | undefined, element: Element): EnvMods {
  if (!env) return { ...ZERO };
  return { ...ZERO, ...RULES[env][element === env ? 0 : 1] };
}
