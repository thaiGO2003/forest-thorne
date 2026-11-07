/**
 * Visual Registry — maps unit baseId to their custom 2.5D visual module.
 *
 * Now auto-detects visual modules from unit data files (data/units/*.js).
 * Units with a `visual` field in their data file will be registered automatically.
 * Fallback: units without a visual will gracefully use the emoji system.
 */

import { UNIT_BY_ID } from "../data/unitCatalog.js";
import { resolveOwnedUnitAppearance } from "../data/unitSkins.js";
import {
  applyUnitStarEvolutionDecoration,
  resolveUnitStarEvolutionSpec
} from "./unitStarEvolution.js";
import type { StarVisualIdentity, StarVisualSurface } from "./starVisualTypes.js";

type AnyObj = Record<string, unknown>;

interface VisualModule {
  handlesStarEvolution?: boolean | null;
  createModel?: (scene: AnyObj | null | undefined, cfg: AnyObj) => AnyObj;
}

interface ResolvedAppearance {
  skinId?: string | null;
  handlesStarEvolution?: boolean | null;
  visual?: VisualModule | null;
  starVisualIdentityOverride?: StarVisualIdentity | null;
}

interface UnitRecord extends AnyObj {
  visual?: VisualModule | null;
  classType?: string;
  tribe?: string;
  starVisualIdentity?: StarVisualIdentity | null;
}

interface GetModuleOptions {
  appearance?: ResolvedAppearance | null;
  star?: number;
  side?: string;
  ownerKind?: string;
  collectionProfile?: AnyObj;
}

interface CreateModelOptions extends GetModuleOptions {
  surface?: StarVisualSurface;
}

function asResolvedAppearance(value: unknown): ResolvedAppearance | null {
  if (!value || typeof value !== "object") return null;
  return value as ResolvedAppearance;
}

/**
 * Get the visual module for a unit by its baseId.
 * Reads directly from the unit's data (no separate visual file needed).
 */
export function getUnitVisualModule(baseId: string, options: GetModuleOptions = {}): VisualModule | null {
  const appearance: ResolvedAppearance | null = options?.appearance ?? asResolvedAppearance(resolveOwnedUnitAppearance({
    unitId: baseId,
    star: options?.star,
    side: options?.side,
    ownerKind: options?.ownerKind,
    collectionProfile: options?.collectionProfile
  }));
  if (appearance?.visual?.createModel) return appearance.visual as VisualModule;
  const unit = UNIT_BY_ID[baseId] as UnitRecord | undefined;
  return (unit && unit.visual) ? unit.visual : null;
}

/**
 * Check if a unit has a custom 2.5D visual module registered.
 */
export function hasCustomVisual(baseId: string): boolean {
  const unit = UNIT_BY_ID[baseId] as UnitRecord | undefined;
  return !!(unit && unit.visual);
}

export function createUnitVisualModel(
  scene: AnyObj | null | undefined,
  baseId: string,
  cfg: CreateModelOptions = {}
): AnyObj | null {
  const appearance: ResolvedAppearance | null = cfg?.appearance ?? asResolvedAppearance(resolveOwnedUnitAppearance({
    unitId: baseId,
    star: cfg?.star,
    side: cfg?.side,
    ownerKind: cfg?.ownerKind,
    collectionProfile: cfg?.collectionProfile
  }));
  const visualModule = getUnitVisualModule(baseId, { ...cfg, appearance });
  if (!visualModule?.createModel) return null;

  const model = visualModule.createModel(scene as AnyObj, { ...cfg, baseId, appearance });
  if (!model) return null;
  const unit = UNIT_BY_ID[baseId] as UnitRecord | undefined;
  const sceneKey = (scene as { scene?: { key?: string } } | null | undefined)?.scene?.key;
  const spec = resolveUnitStarEvolutionSpec({
    baseId,
    classType: unit?.classType,
    tribe: unit?.tribe,
    star: cfg?.star ?? 1,
    visualModule,
    appearance,
    unitCore: (unit as AnyObj) ?? null,
    surface: cfg?.surface ?? (sceneKey === "CombatScene" ? "combat" : "planning")
  });
  if (spec) applyUnitStarEvolutionDecoration(scene, model, spec);
  return model;
}

export default { getUnitVisualModule, hasCustomVisual, createUnitVisualModel };
