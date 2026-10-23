import { buildUnitStarVisualLayers } from "./starVisualEffectFactory.js";
import { resolveUnitStarVisualIdentity } from "./unitStarVisualIdentity.js";
import type { ResolvedStarVisualIdentity, StarVisualIdentity, StarVisualSurface } from "./starVisualTypes.js";

type AnyObj = Record<string, unknown>;

interface StarEvolutionAppearance {
  skinId?: string | null;
  handlesStarEvolution?: boolean | null;
  visual?: { handlesStarEvolution?: boolean | null } | null;
  starVisualIdentityOverride?: StarVisualIdentity | null;
}
interface StarEvolutionUnitCore {
  classType?: string | null;
  tribe?: string | null;
  starVisualIdentity?: StarVisualIdentity | null;
}

type StarVisualLayerScene = Parameters<typeof buildUnitStarVisualLayers>[0];
type StarVisualLayerOptions = NonNullable<Parameters<typeof buildUnitStarVisualLayers>[3]>;
type StarVisualLayerIdentity = Parameters<typeof buildUnitStarVisualLayers>[2];

function isStarVisualLayerScene(scene: AnyObj): scene is AnyObj & StarVisualLayerScene {
  const add = scene.add as { container?: unknown } | undefined;
  const tweens = scene.tweens as { add?: unknown } | undefined;
  return typeof add?.container === "function" && typeof tweens?.add === "function";
}

interface StarEvolutionOptions {
  baseId: string;
  classType?: string | null;
  tribe?: string | null;
  star: number;
  visualModule?: StarEvolutionAppearance | null;
  appearance?: StarEvolutionAppearance | null;
  surface?: StarVisualSurface;
  unitCore?: StarEvolutionUnitCore | null;
}

function clampStar(star: number | string | null | undefined): 1 | 2 | 3 {
  const value = Number.parseInt(String(star ?? ""), 10);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(3, value)) as 1 | 2 | 3;
}

export function shouldSkipSharedStarEvolution(
  baseId: string,
  visualModule: StarEvolutionAppearance | null = null,
  appearance: StarEvolutionAppearance | null = null
): boolean {
  void baseId;
  return visualModule?.handlesStarEvolution === true
    || appearance?.handlesStarEvolution === true
    || appearance?.visual?.handlesStarEvolution === true;
}

export function resolveUnitStarEvolutionSpec(options: Partial<StarEvolutionOptions> = {}): ResolvedStarVisualIdentity | null {
  const baseId = String(options.baseId ?? "");
  const classType = options.classType ?? null;
  const tribe = options.tribe ?? null;
  const visualModule = options.visualModule ?? null;
  const appearance = options.appearance ?? null;
  const surface = options.surface ?? "planning";
  const unitCore = options.unitCore ?? null;
  const normalizedStar = clampStar(options.star ?? 1);
  const resolved = resolveUnitStarVisualIdentity({
    baseId,
    star: normalizedStar,
    surface,
    appearance,
    classType,
    tribe,
    unitCore,
    visualModule
  });
  if (!resolved) return null;
  if (resolved.handledByVisualModule) return resolved;
  if (!Array.isArray(resolved.layers) || resolved.layers.length === 0) return null;
  return resolved;
}

interface StarEvolutionModel extends AnyObj {
  list?: AnyObj[];
  add?: (child: unknown) => unknown;
  addAt?: (child: unknown, index: number) => unknown;
  __sharedStarEvolutionHandle?: unknown;
  destroy?: () => void;
}

export function removeUnitStarEvolutionDecoration(model: StarEvolutionModel | null | undefined): StarEvolutionModel | null | undefined {
  if (!model) return model;
  const handle = model.__sharedStarEvolutionHandle as { destroy?: () => void } | undefined;
  if (handle) {
    try {
      handle.destroy?.();
    } finally {
      model.__sharedStarEvolutionHandle = null;
    }
  }
  if (!Array.isArray(model.list)) return model;
  const leftovers = model.list.filter((child) => {
    const getData = (child as { getData?: (key: string) => unknown } | null)?.getData;
    if (typeof getData !== "function") return false;
    return getData.call(child, "sharedStarEvolutionDecoration") === true;
  });
  leftovers.forEach((child) => {
    const destroy = (child as { destroy?: () => void } | null)?.destroy;
    if (typeof destroy === "function") destroy.call(child);
  });
  return model;
}

export function applyUnitStarEvolutionDecoration(
  scene: AnyObj | null | undefined,
  model: StarEvolutionModel | null | undefined,
  spec: ResolvedStarVisualIdentity | null | undefined,
  context: StarVisualLayerOptions = {}
): StarEvolutionModel | null | undefined {
  if (!scene || !model || !spec || spec.handledByVisualModule) {
    if (model) removeUnitStarEvolutionDecoration(model);
    return model;
  }
  removeUnitStarEvolutionDecoration(model);
  if (!isStarVisualLayerScene(scene) || !model.add) return model;
  const layerIdentity: StarVisualLayerIdentity = { ...spec };
  const handle = buildUnitStarVisualLayers(scene, model, layerIdentity, context);
  if (handle?.root) {
    if (typeof model.addAt === "function") model.addAt(handle.root, 0);
    else model.add?.(handle.root);
  }
  model.__sharedStarEvolutionHandle = handle;
  return model;
}

export default {
  applyUnitStarEvolutionDecoration,
  removeUnitStarEvolutionDecoration,
  resolveUnitStarEvolutionSpec,
  shouldSkipSharedStarEvolution
};
