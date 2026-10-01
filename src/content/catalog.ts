// Typed access to the generated unit catalog (A41/A42/A83/A84).
// units.json is generated from the spec manifest; do not hand-edit entries.
import raw from "./units.json";

export type Role = "TANKER" | "ASSASSIN" | "ARCHER" | "MAGE" | "SUPPORT" | "FIGHTER";
export type Faction = "BEAST" | "AVIAN" | "INSECT" | "REPTILE" | "AQUATIC" | "MYTHICAL";
export type Element = "STONE" | "WIND" | "FIRE" | "TIDE" | "NIGHT" | "SPIRIT" | "SWARM" | "WOOD";

export interface UnitStats {
  hp: number; atk: number; def: number; matk: number; mdef: number;
  range: number; rageMax: number;
  crit?: number; critDmg?: number; evade?: number; accuracy?: number;
}

export interface UnitSkill {
  nameVi: string;
  family: string;
  rageCost: [number, number, number];
  targetVi?: string; shapeVi?: string; selectionVi?: string; countVi?: string; durationVi?: string;
  detailVi?: string;
  starDetailVi: string[];
}

export interface UnitDef {
  id: string;
  species: string;
  nameVi: string;
  tier: number;
  role: Role;
  faction: Faction;
  element: Element;
  boss: boolean;
  stats: UnitStats;
  pitchVi: string;
  basic: { delivery: "melee" | "projectile"; damageType: "physical" | "magic"; textVi: string };
  skill: UnitSkill;
  skin?: { id: string; unlock: string; stagesVi: string[] };
}

export const UNITS = raw as unknown as UnitDef[];
export const UNIT_BY_ID: ReadonlyMap<string, UnitDef> = new Map(UNITS.map((u) => [u.id, u]));
export const NORMAL_UNITS = UNITS.filter((u) => !u.boss);
export const BOSSES = UNITS.filter((u) => u.boss);

export function getUnit(id: string): UnitDef {
  const u = UNIT_BY_ID.get(id);
  if (!u) throw new Error(`unknown unit id: ${id}`);
  return u;
}
