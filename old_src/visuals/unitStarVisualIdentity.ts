import { UNIT_BY_ID } from "../data/unitCatalog.js";
import { getPreset } from "./starVisualPresetRegistry.js";
import type {
  StarVisualSurface,
  SurfaceVisualPolicy,
  VisualLayerSpec,
  StarVisualMotion,
  StarVisualAnchor,
  StarVisualIdentity,
  ResolvedStarVisualIdentity
} from "./starVisualTypes.js";

type AnyObj = Record<string, unknown>;

interface AppearanceLike {
  skinId?: string | null;
  handlesStarEvolution?: boolean | null;
  visual?: { handlesStarEvolution?: boolean | null } | null;
  starVisualIdentityOverride?: {
    presetKey?: string | null;
    fallbackFamily?: string | null;
    surfacePolicy?: AnyObj;
    layersByStar?: { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] };
  } | null;
}

interface UnitCoreLike {
  classType?: string | null;
  tribe?: string | null;
  starVisualIdentity?: {
    presetKey?: string | null;
    fallbackFamily?: string | null;
    surfacePolicy?: AnyObj;
    layersByStar?: { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] };
  } | null;
}

const SURFACE_DEFAULTS: Record<StarVisualSurface, SurfaceVisualPolicy> = Object.freeze({
  planning: Object.freeze({
    densityScale: 1,
    motionScale: 1,
    allowAnimatedParticles: true,
    allowTextGlyphs: true,
    allowOrbitingLayers: true
  }),
  combat: Object.freeze({
    densityScale: 0.82,
    motionScale: 0.72,
    allowAnimatedParticles: true,
    allowTextGlyphs: true,
    allowOrbitingLayers: false
  }),
  tooltip: Object.freeze({
    densityScale: 0.45,
    motionScale: 0.2,
    allowAnimatedParticles: false,
    allowTextGlyphs: true,
    allowOrbitingLayers: false
  }),
  library: Object.freeze({
    densityScale: 0.7,
    motionScale: 0.45,
    allowAnimatedParticles: true,
    allowTextGlyphs: true,
    allowOrbitingLayers: false
  }),
  shop: Object.freeze({
    densityScale: 0.4,
    motionScale: 0.16,
    allowAnimatedParticles: false,
    allowTextGlyphs: true,
    allowOrbitingLayers: false
  })
});

const GENERIC_THEME = Object.freeze({
  TANKER: { color: 0x8fc6ff, accentColor: 0xd8f0ff, motifFamily: "generic_tank" },
  FIGHTER: { color: 0xffb36b, accentColor: 0xffe0ae, motifFamily: "generic_fighter" },
  ASSASSIN: { color: 0xe190ff, accentColor: 0xf2c8ff, motifFamily: "generic_assassin" },
  MAGE: { color: 0x86d8ff, accentColor: 0xd7f4ff, motifFamily: "generic_mage" },
  SUPPORT: { color: 0x88f0c2, accentColor: 0xe0ffe9, motifFamily: "generic_support" },
  ARCHER: { color: 0xa7eb8c, accentColor: 0xe8ffd8, motifFamily: "generic_archer" }
}) as Record<string, { color: number; accentColor: number; motifFamily: string }>;

const TRIBE_ACCENTS = Object.freeze({
  STONE: 0xd9c8a4,
  WIND: 0xb9f0b1,
  FIRE: 0xffb47d,
  TIDE: 0x91d8ff,
  NIGHT: 0xd0a2ff,
  SPIRIT: 0xa8ffe1,
  SWARM: 0xd2f27d,
  WOOD: 0x8edb89
}) as Record<string, number>;

const PARTICLE_ENABLED_BASE_ID = "crane_blessing";
const PARTICLE_ENABLED_SKIN_ID = "crane_blessing.ga_trum_chuong";

type SanitizedLayer = Omit<VisualLayerSpec, "motion"> & { motion: StarVisualMotion | null };

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, clone(nested)])
    ) as unknown as T;
  }
  return value;
}

function clampStar(star: 1 | 2 | 3 | number | null | undefined): 1 | 2 | 3 {
  const parsed = Math.round(Number(star) || 1);
  return Math.max(1, Math.min(3, parsed)) as 1 | 2 | 3;
}

function normalizeSurface(surface: StarVisualSurface | string | null | undefined): StarVisualSurface {
  const candidate = String(surface || "planning").toLowerCase();
  return SURFACE_DEFAULTS[candidate as StarVisualSurface] ? (candidate as StarVisualSurface) : "planning";
}

function mergePolicy(
  surface: StarVisualSurface,
  authoredPolicy: AnyObj | null = null
): SurfaceVisualPolicy {
  return {
    ...SURFACE_DEFAULTS[surface],
    ...(authoredPolicy?.[surface] ?? {})
  };
}

function sanitizeLayer(layer: unknown): SanitizedLayer | null {
  if (!layer || typeof layer !== "object") return null;
  const src = layer as Record<string, unknown>;
  return {
    type: String(src.type ?? ""),
    anchor: src.anchor ? String(src.anchor) as StarVisualAnchor : "base",
    color: src.color as number | undefined,
    accentColor: src.accentColor as number | undefined,
    count: src.count as number | undefined,
    scale: src.scale as number | undefined,
    alpha: src.alpha as number | undefined,
    motion: src.motion ? String(src.motion) as StarVisualMotion : null,
    radiusX: src.radiusX as number | undefined,
    radiusY: src.radiusY as number | undefined,
    spread: src.spread as number | undefined,
    glyphSet: Array.isArray(src.glyphSet) ? [...(src.glyphSet as string[])] : undefined,
    extra: src.extra ? { ...(src.extra as Record<string, number | string | boolean>) } : undefined
  };
}

function mergeLayers(...groups: unknown[][]): SanitizedLayer[] {
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map((layer) => sanitizeLayer(layer))
    .filter((layer): layer is SanitizedLayer => layer !== null);
}

function getLayersForStar(
  layersByStar: { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] } | null | undefined,
  star: 1 | 2 | 3 | number
): VisualLayerSpec[] {
  const starKey = clampStar(star);
  const layers = layersByStar?.[starKey] ?? layersByStar?.[1] ?? [];
  return clone(layers) as VisualLayerSpec[];
}

interface AuthoredIdentity {
  presetKey: string | null;
  fallbackFamily: string | null;
  surfacePolicy: AnyObj | null;
  layersByStar: { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] };
}

function normalizeAuthoredIdentity(
  identity: AnyObj | null = null
): AuthoredIdentity | null {
  if (!identity || typeof identity !== "object") return null;
  return {
    presetKey: String(identity.presetKey ?? null) || null,
    fallbackFamily: String(identity.fallbackFamily ?? null) || null,
    surfacePolicy: identity.surfacePolicy ? { ...(identity.surfacePolicy as AnyObj) } : null,
    layersByStar: identity.layersByStar ? (identity.layersByStar as { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] }) : {}
  };
}

interface IsSharedStarVisualEnabledOptions {
  baseId?: string | null;
  star?: number | null;
  appearance?: AppearanceLike | null;
}

function isSharedStarVisualEnabled({ baseId, star = 1, appearance = null }: IsSharedStarVisualEnabledOptions = {}): boolean {
  const normalizedStar = clampStar(star ?? 1);
  if (normalizedStar <= 1) return false;
  const skinId = (appearance as AppearanceLike | null)?.skinId ?? null;
  if (skinId) return skinId === PARTICLE_ENABLED_SKIN_ID;
  if (appearance) return false;
  return baseId === PARTICLE_ENABLED_BASE_ID;
}

export function applySurfacePolicy(
  layers: SanitizedLayer[] = [],
  surface: StarVisualSurface = "planning",
  policy: SurfaceVisualPolicy = {}
): SanitizedLayer[] {
  const densityScale = Math.max(0.1, Number(policy.densityScale) || 1);
  const motionScale = Math.max(0, Number(policy.motionScale) || 0);
  const allowAnimatedParticles = policy.allowAnimatedParticles !== false;
  const allowTextGlyphs = policy.allowTextGlyphs !== false;
  const allowOrbitingLayers = policy.allowOrbitingLayers !== false;

  return layers.map((layer) => {
    const next: SanitizedLayer = {
      ...layer,
      extra: {
        ...(layer.extra ?? {}),
        densityScale,
        motionScale
      }
    };

    if (typeof next.count === "number") {
      next.count = Math.max(1, Math.round(next.count * densityScale));
    }
    if (typeof next.alpha === "number") {
      next.alpha = Math.max(0.08, Math.min(1, next.alpha * (surface === "planning" ? 1 : 0.92)));
    }
    if (typeof next.scale === "number") {
      next.scale = Math.max(0.35, next.scale * (0.8 + densityScale * 0.2));
    }
    if (typeof next.spread === "number") {
      next.spread = Math.max(4, Math.round(next.spread * Math.min(1, densityScale + 0.2)));
    }
    if (!allowAnimatedParticles) {
      next.motion = null;
    } else if (next.motion) {
      (next.extra as Record<string, number | string | boolean>).motionScale = motionScale;
    }
    if (!allowOrbitingLayers && (next.anchor === "orbit" || next.motion === "orbit")) {
      next.anchor = next.anchor === "orbit" ? "head" : next.anchor;
      next.motion = next.motion === "orbit" ? "idle_float" : next.motion;
    }
    if (!allowTextGlyphs && Array.isArray(next.glyphSet) && next.glyphSet.length) {
      next.glyphSet = [next.glyphSet[0]];
      next.count = 1;
      next.motion = next.motion === "orbit" ? "idle_float" : next.motion;
    }
    return next;
  });
}

interface GenericFallbackResult {
  motifFamily: string;
  layers: VisualLayerSpec[];
}

export function buildGenericFallbackLayers(
  classType: string | null | undefined,
  tribe: string | null | undefined,
  star: 1 | 2 | 3 | number
): GenericFallbackResult {
  const normalizedStar = clampStar(star);
  const theme = GENERIC_THEME[classType ?? "FIGHTER"] ?? GENERIC_THEME.FIGHTER;
  const accentColor = TRIBE_ACCENTS[tribe ?? ""] ?? theme.accentColor;
  const layers: VisualLayerSpec[] = [
    {
      type: "aura_ring",
      anchor: "base",
      color: theme.color,
      accentColor,
      alpha: normalizedStar === 1 ? 0.09 : normalizedStar === 2 ? 0.13 : 0.18,
      radiusX: normalizedStar === 1 ? 16 : normalizedStar === 2 ? 19 : 22,
      radiusY: normalizedStar === 1 ? 8 : normalizedStar === 2 ? 9 : 11,
      motion: "pulse"
    }
  ];
  if (normalizedStar >= 2) {
    layers.push({
      type: "crest",
      anchor: "head",
      color: theme.accentColor,
      accentColor,
      count: 1,
      scale: normalizedStar === 2 ? 0.92 : 1,
      alpha: 0.88,
      motion: normalizedStar >= 3 ? "flicker" : "idle_float"
    });
  }
  if (normalizedStar >= 3) {
    layers.push({
      type: "side_ornament",
      anchor: "side",
      color: accentColor,
      accentColor: theme.accentColor,
      count: 2,
      scale: 0.92,
      alpha: 0.76,
      motion: "idle_float"
    });
  }
  return {
    motifFamily: theme.motifFamily,
    layers
  };
}

interface ResolveUnitStarVisualIdentityOptions {
  baseId?: string | null;
  star?: number | null;
  surface?: StarVisualSurface | string | null;
  appearance?: AppearanceLike | null;
  classType?: string | null;
  tribe?: string | null;
  unitCore?: UnitCoreLike | null;
  visualModule?: { handlesStarEvolution?: boolean | null } | null;
}

export function resolveUnitStarVisualIdentity({
  baseId = null,
  star = 1,
  surface = "planning",
  appearance = null,
  classType = null,
  tribe = null,
  unitCore = null,
  visualModule = null
}: ResolveUnitStarVisualIdentityOptions = {}): ResolvedStarVisualIdentity {
  const normalizedStar = clampStar(star ?? 1);
  const normalizedSurface = normalizeSurface(surface ?? "planning");
  const ownedAppearance = (appearance ?? null) as AppearanceLike | null;
  const effectiveVisualModule = (visualModule ?? ownedAppearance?.visual ?? null) as
    | { handlesStarEvolution?: boolean | null }
    | null;
  const handledByVisualModule = effectiveVisualModule?.handlesStarEvolution === true
    || ownedAppearance?.handlesStarEvolution === true;
  const resolvedUnit: UnitCoreLike | null = unitCore ?? (UNIT_BY_ID[baseId ?? ""] as UnitCoreLike | undefined) ?? null;
  const effectiveClassType = classType ?? resolvedUnit?.classType ?? "FIGHTER";
  const effectiveTribe = tribe ?? resolvedUnit?.tribe ?? "WOOD";

  if (handledByVisualModule) {
    return {
      baseId: baseId ?? "",
      star: normalizedStar,
      surface: normalizedSurface,
      motifFamily: null,
      layers: [],
      surfacePolicy: mergePolicy(normalizedSurface),
      usesGenericFallback: false,
      isMigrated: true,
      handledByVisualModule: true,
      meta: { source: "visual-module", skippedSharedDecoration: true }
    };
  }

  if (!isSharedStarVisualEnabled({
    baseId,
    star: normalizedStar,
    appearance: ownedAppearance
  })) {
    return {
      baseId: baseId ?? "",
      star: normalizedStar,
      surface: normalizedSurface,
      motifFamily: null,
      layers: [],
      surfacePolicy: mergePolicy(normalizedSurface),
      usesGenericFallback: false,
      isMigrated: false,
      handledByVisualModule: false,
      meta: {
        source: "disabled",
        reason: normalizedStar <= 1 ? "star-1-disabled" : "unit-disabled"
      }
    };
  }

  const overrideIdentity = normalizeAuthoredIdentity(ownedAppearance?.starVisualIdentityOverride ?? null);
  const authoredIdentity = overrideIdentity ?? normalizeAuthoredIdentity(resolvedUnit?.starVisualIdentity ?? null);
  const preset = getPreset(authoredIdentity?.presetKey ?? null);
  const presetLayers = preset ? getLayersForStar(preset.layersByStar ?? null, normalizedStar) : [];
  const authoredLayers = authoredIdentity ? getLayersForStar(authoredIdentity.layersByStar ?? {}, normalizedStar) : [];
  const baseLayers = mergeLayers(presetLayers, authoredLayers);
  const usesGenericFallback = baseLayers.length === 0;
  const fallback = usesGenericFallback
    ? buildGenericFallbackLayers(effectiveClassType, effectiveTribe, normalizedStar)
    : null;
  const surfacePolicy = mergePolicy(
    normalizedSurface,
    (authoredIdentity?.surfacePolicy as AnyObj | null) ?? ((preset as AnyObj | null)?.surfacePolicy as AnyObj | null) ?? null
  );
  const sanitizedBase = baseLayers as SanitizedLayer[];
  const layers = applySurfacePolicy(
    usesGenericFallback ? (fallback!.layers as SanitizedLayer[]) : sanitizedBase,
    normalizedSurface,
    surfacePolicy
  );

  return {
    baseId: baseId ?? "",
    star: normalizedStar,
    surface: normalizedSurface,
    motifFamily: usesGenericFallback
      ? fallback!.motifFamily
      : authoredIdentity?.fallbackFamily ?? (preset as StarVisualIdentity | null)?.fallbackFamily ?? null,
    layers: layers as VisualLayerSpec[],
    surfacePolicy,
    usesGenericFallback,
    handledByVisualModule: false,
    isMigrated: !usesGenericFallback,
    meta: {
      source: usesGenericFallback
        ? "generic-fallback"
        : overrideIdentity
          ? "appearance-override"
          : authoredIdentity?.presetKey
            ? "preset+unit"
            : "unit",
      presetKey: authoredIdentity?.presetKey ?? null,
      classType: effectiveClassType,
      tribe: effectiveTribe
    }
  };
}

export default {
  applySurfacePolicy,
  buildGenericFallbackLayers,
  resolveUnitStarVisualIdentity
};
