export const STAR_VISUAL_LAYER_TYPES = Object.freeze([
  "aura_ring",
  "note_cluster",
  "ember_stream",
  "feather_drift",
  "sleep_glyphs",
  "electric_arc",
  "poison_droplet",
  "bubble_cluster",
  "leaf_swirl",
  "stone_dust",
  "shadow_wisp",
  "holy_mote",
  "void_shard",
  "crest",
  "side_ornament",
  "ground_sigils"
] as const);

export type StarVisualLayerType = (typeof STAR_VISUAL_LAYER_TYPES)[number];

export const STAR_VISUAL_ANCHORS = Object.freeze([
  "head",
  "side",
  "back",
  "base",
  "orbit"
] as const);

export type StarVisualAnchor = (typeof STAR_VISUAL_ANCHORS)[number];

export const STAR_VISUAL_MOTIONS = Object.freeze([
  "idle_float",
  "pulse",
  "orbit",
  "rise_fade",
  "flicker",
  "arc_crackle"
] as const);

export type StarVisualMotion = (typeof STAR_VISUAL_MOTIONS)[number];

export const STAR_VISUAL_SURFACES = Object.freeze([
  "planning",
  "combat",
  "tooltip",
  "library",
  "shop"
] as const);

export type StarVisualSurface = (typeof STAR_VISUAL_SURFACES)[number];

export interface SurfaceVisualPolicy {
  densityScale?: number;
  motionScale?: number;
  allowAnimatedParticles?: boolean;
  allowTextGlyphs?: boolean;
  allowOrbitingLayers?: boolean;
}

export interface VisualLayerSpec {
  type: string;
  anchor?: StarVisualAnchor;
  color?: number;
  accentColor?: number;
  count?: number;
  scale?: number;
  alpha?: number;
  motion?: StarVisualMotion;
  radiusX?: number;
  radiusY?: number;
  spread?: number;
  glyphSet?: string[];
  extra?: Record<string, number | string | boolean>;
}

export interface StarVisualIdentity {
  presetKey?: string;
  fallbackFamily?: string;
  surfacePolicy?: {
    planning?: SurfaceVisualPolicy;
    combat?: SurfaceVisualPolicy;
    tooltip?: SurfaceVisualPolicy;
    library?: SurfaceVisualPolicy;
    shop?: SurfaceVisualPolicy;
  };
  layersByStar?: { 1?: VisualLayerSpec[]; 2?: VisualLayerSpec[]; 3?: VisualLayerSpec[] };
}

export interface ResolvedStarVisualIdentity {
  baseId: string;
  star: 1 | 2 | 3;
  surface: StarVisualSurface;
  motifFamily: string | null;
  layers: VisualLayerSpec[];
  surfacePolicy: SurfaceVisualPolicy;
  usesGenericFallback: boolean;
  isMigrated: boolean;
  handledByVisualModule: boolean;
  meta: Record<string, unknown>;
}
