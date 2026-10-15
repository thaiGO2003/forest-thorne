// Read-only owned-unit inspection. Every stat stage uses the combat materializer.
import { getUnit } from "../content/catalog";
import { materializeCombat, snapshotFighter, type CombatUnitSnapshot, type Placement, type SideBonus } from "./combat";
import { environmentFor, environmentMods, type EnvironmentId, type EnvMods } from "./environment";
import { playerCombatBonus, runSynergies, type OwnedUnit, type RunState } from "./run";

export interface OwnedUnitLocation { where: "board" | "bench"; index: number; unit: OwnedUnit }

export function findOwnedUnit(run: RunState, uid: string): OwnedUnitLocation | null {
  const boardIndex = run.board.findIndex((unit) => unit?.uid === uid);
  if (boardIndex >= 0) return { where: "board", index: boardIndex, unit: run.board[boardIndex]! };
  const benchIndex = run.bench.findIndex((unit) => unit.uid === uid);
  return benchIndex >= 0 ? { where: "bench", index: benchIndex, unit: run.bench[benchIndex]! } : null;
}

export function leftSynergyBonus(run: RunState): SideBonus {
  const out: SideBonus = {};
  for (const line of runSynergies(run)) for (const [rawKey, value] of Object.entries(line.bonus)) {
    const key = rawKey as keyof SideBonus;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = (out[key] ?? 0) + value;
  }
  return out;
}

export type InspectionSourceKind = "persistent" | "equipment" | "variant" | "environment" | "synergy";
export interface InspectionSource {
  kind: InspectionSourceKind;
  before: CombatUnitSnapshot;
  after: CombatUnitSnapshot;
}
export interface OwnedUnitInspection extends OwnedUnitLocation {
  base: CombatUnitSnapshot;
  boosted: CombatUnitSnapshot;
  sources: InspectionSource[];
  environment: EnvironmentId;
  envMods: EnvMods;
}

/** No checkpoint, RNG, run mutation or reward payout occurs while inspecting a creature. */
export function inspectOwnedUnit(run: RunState, uid: string): OwnedUnitInspection | null {
  const found = findOwnedUnit(run, uid);
  if (!found) return null;
  const { unit, where, index } = found;
  const placement: Placement = {
    uid, baseId: unit.baseId, star: unit.star,
    row: where === "board" ? Math.floor(index / 5) : 0, col: where === "board" ? index % 5 : 0,
  };
  const resolve = (equips: string[] = [], traits = unit.traits ?? [], persistent = false, environment?: EnvironmentId, synergy = false) =>
    snapshotFighter(materializeCombat([{ ...placement, equips, traits }], [], {
      leftPersistent: persistent ? playerCombatBonus(run) : undefined, environment,
      synergy: synergy ? { L: leftSynergyBonus(run) } : undefined,
    })[0]!);
  const environment = environmentFor(run.round);
  const base = resolve([], []);
  const stages: [InspectionSourceKind, CombatUnitSnapshot][] = [
    ["persistent", resolve([], [], true)],
    ["equipment", resolve(unit.equips, [], true)],
    ["variant", resolve(unit.equips, unit.traits ?? [], true)],
    ["environment", resolve(unit.equips, unit.traits ?? [], true, environment)],
    ["synergy", resolve(unit.equips, unit.traits ?? [], true, environment, where === "board")],
  ];
  let before = base;
  const sources = stages.map(([kind, after]) => { const source = { kind, before, after }; before = after; return source; });
  return { ...found, base, boosted: before, sources, environment, envMods: environmentMods(environment, getUnit(unit.baseId).element) };
}
