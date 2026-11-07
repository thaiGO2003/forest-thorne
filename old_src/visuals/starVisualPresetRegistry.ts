import type { StarVisualIdentity, VisualLayerSpec, SurfaceVisualPolicy } from "./starVisualTypes.js";

interface PresetDefinition {
  motifFamily: string;
  surfacePolicy?: {
    planning?: SurfaceVisualPolicy;
    combat?: SurfaceVisualPolicy;
    tooltip?: SurfaceVisualPolicy;
    library?: SurfaceVisualPolicy;
    shop?: SurfaceVisualPolicy;
  };
  layersByStar: { 1: VisualLayerSpec[]; 2: VisualLayerSpec[]; 3: VisualLayerSpec[] };
}

const PRESETS = Object.freeze({
  music_base: Object.freeze({
    motifFamily: "music",
    surfacePolicy: {
      planning: { densityScale: 1, motionScale: 1, allowAnimatedParticles: true, allowTextGlyphs: true, allowOrbitingLayers: true },
      combat: { densityScale: 0.8, motionScale: 0.75, allowAnimatedParticles: true, allowTextGlyphs: true, allowOrbitingLayers: false },
      tooltip: { densityScale: 0.45, motionScale: 0.25, allowAnimatedParticles: false, allowTextGlyphs: true, allowOrbitingLayers: false },
      library: { densityScale: 0.7, motionScale: 0.5, allowAnimatedParticles: true, allowTextGlyphs: true, allowOrbitingLayers: false },
      shop: { densityScale: 0.4, motionScale: 0.2, allowAnimatedParticles: false, allowTextGlyphs: true, allowOrbitingLayers: false }
    },
    layersByStar: {
      1: [
        { type: "note_cluster", anchor: "head", color: 0xffd36b, accentColor: 0xffae42, count: 2, scale: 1, alpha: 0.92, motion: "idle_float", spread: 14, glyphSet: ["♪", "♫"] },
        { type: "aura_ring", anchor: "base", color: 0xffd36b, accentColor: 0xfff0c5, alpha: 0.12, radiusX: 18, radiusY: 9, motion: "pulse" }
      ],
      2: [
        { type: "note_cluster", anchor: "head", color: 0xffd36b, accentColor: 0xffae42, count: 3, scale: 1.05, alpha: 0.96, motion: "idle_float", spread: 18, glyphSet: ["♪", "♫", "♬"] },
        { type: "aura_ring", anchor: "base", color: 0xffd36b, accentColor: 0xfff0c5, alpha: 0.16, radiusX: 22, radiusY: 11, motion: "pulse" }
      ],
      3: [
        { type: "note_cluster", anchor: "head", color: 0xffd36b, accentColor: 0xffae42, count: 4, scale: 1.12, alpha: 1, motion: "idle_float", spread: 22, glyphSet: ["♪", "♫", "♬"] },
        { type: "aura_ring", anchor: "base", color: 0xffd36b, accentColor: 0xfff0c5, alpha: 0.2, radiusX: 24, radiusY: 12, motion: "pulse" },
        { type: "side_ornament", anchor: "back", color: 0xfff2b8, accentColor: 0xffd36b, count: 2, scale: 1.08, alpha: 0.85, motion: "flicker" }
      ]
    }
  }),
  fire_ember_core: Object.freeze({
    motifFamily: "fire",
    layersByStar: {
      1: [
        { type: "ember_stream", anchor: "back", color: 0xff8b4f, accentColor: 0xff4f35, count: 3, scale: 0.95, alpha: 0.88, motion: "rise_fade", spread: 12 },
        { type: "aura_ring", anchor: "base", color: 0xff6c45, accentColor: 0xffb47d, alpha: 0.12, radiusX: 17, radiusY: 8, motion: "pulse" }
      ],
      2: [
        { type: "ember_stream", anchor: "back", color: 0xff8b4f, accentColor: 0xff4f35, count: 5, scale: 1.04, alpha: 0.92, motion: "rise_fade", spread: 16 },
        { type: "aura_ring", anchor: "base", color: 0xff6c45, accentColor: 0xffb47d, alpha: 0.16, radiusX: 20, radiusY: 10, motion: "pulse" }
      ],
      3: [
        { type: "ember_stream", anchor: "back", color: 0xff8b4f, accentColor: 0xff4f35, count: 7, scale: 1.12, alpha: 0.95, motion: "rise_fade", spread: 20 },
        { type: "aura_ring", anchor: "base", color: 0xff6c45, accentColor: 0xffb47d, alpha: 0.2, radiusX: 24, radiusY: 12, motion: "pulse" },
        { type: "ground_sigils", anchor: "base", color: 0xff9f68, accentColor: 0xfff0b0, count: 1, scale: 1.12, alpha: 0.8, motion: "flicker" }
      ]
    }
  }),
  sleep_moon_glyphs: Object.freeze({
    motifFamily: "sleep",
    layersByStar: {
      1: [
        { type: "sleep_glyphs", anchor: "head", color: 0xb59cff, accentColor: 0xe8dcff, count: 2, scale: 0.92, alpha: 0.9, motion: "idle_float", spread: 10, glyphSet: ["Z", "z"] }
      ],
      2: [
        { type: "sleep_glyphs", anchor: "head", color: 0xb59cff, accentColor: 0xe8dcff, count: 3, scale: 1, alpha: 0.94, motion: "orbit", spread: 14, glyphSet: ["Z", "z", "☾"] }
      ],
      3: [
        { type: "sleep_glyphs", anchor: "head", color: 0xb59cff, accentColor: 0xe8dcff, count: 4, scale: 1.08, alpha: 0.98, motion: "orbit", spread: 18, glyphSet: ["Z", "z", "☾"] },
        { type: "side_ornament", anchor: "back", color: 0xd7c9ff, accentColor: 0xffffff, count: 1, scale: 1.04, alpha: 0.84, motion: "flicker" }
      ]
    }
  }),
  electric_rebound: Object.freeze({
    motifFamily: "electric",
    layersByStar: {
      1: [
        { type: "electric_arc", anchor: "side", color: 0xc798ff, accentColor: 0x9963ff, count: 2, scale: 0.95, alpha: 0.9, motion: "arc_crackle", spread: 12 }
      ],
      2: [
        { type: "electric_arc", anchor: "side", color: 0xc798ff, accentColor: 0x9963ff, count: 3, scale: 1.02, alpha: 0.94, motion: "arc_crackle", spread: 16 },
        { type: "bubble_cluster", anchor: "base", color: 0xb0e7ff, accentColor: 0xe7fbff, count: 2, scale: 0.8, alpha: 0.52, motion: "idle_float", spread: 10 }
      ],
      3: [
        { type: "electric_arc", anchor: "side", color: 0xc798ff, accentColor: 0x9963ff, count: 4, scale: 1.08, alpha: 0.98, motion: "arc_crackle", spread: 20 },
        { type: "bubble_cluster", anchor: "base", color: 0xb0e7ff, accentColor: 0xe7fbff, count: 3, scale: 0.88, alpha: 0.58, motion: "idle_float", spread: 14 }
      ]
    }
  }),
  forest_sanctuary: Object.freeze({
    motifFamily: "forest",
    layersByStar: {
      1: [
        { type: "leaf_swirl", anchor: "head", color: 0x8edb89, accentColor: 0xcff7bd, count: 2, scale: 0.92, alpha: 0.84, motion: "idle_float", spread: 10 },
        { type: "holy_mote", anchor: "base", color: 0xdef8c5, accentColor: 0xffffff, count: 1, scale: 0.78, alpha: 0.58, motion: "pulse", spread: 8 }
      ],
      2: [
        { type: "leaf_swirl", anchor: "head", color: 0x8edb89, accentColor: 0xcff7bd, count: 3, scale: 1, alpha: 0.9, motion: "orbit", spread: 14 },
        { type: "aura_ring", anchor: "base", color: 0xcff7bd, accentColor: 0xffffff, alpha: 0.16, radiusX: 22, radiusY: 11, motion: "pulse" }
      ],
      3: [
        { type: "leaf_swirl", anchor: "head", color: 0x8edb89, accentColor: 0xcff7bd, count: 4, scale: 1.08, alpha: 0.94, motion: "orbit", spread: 18 },
        { type: "aura_ring", anchor: "base", color: 0xcff7bd, accentColor: 0xffffff, alpha: 0.22, radiusX: 24, radiusY: 12, motion: "pulse" },
        { type: "ground_sigils", anchor: "base", color: 0xbff090, accentColor: 0xecffd6, count: 1, scale: 1.05, alpha: 0.8, motion: "flicker" }
      ]
    }
  }),
  dragon_ember_wake: Object.freeze({
    motifFamily: "dragon_fire",
    layersByStar: {
      1: [
        { type: "ember_stream", anchor: "head", color: 0xff6a3a, accentColor: 0xffb87a, count: 3, scale: 1.02, alpha: 0.9, motion: "rise_fade", spread: 10 }
      ],
      2: [
        { type: "ember_stream", anchor: "head", color: 0xff6a3a, accentColor: 0xffb87a, count: 5, scale: 1.1, alpha: 0.94, motion: "rise_fade", spread: 16 },
        { type: "side_ornament", anchor: "back", color: 0xffb87a, accentColor: 0xfff1c5, count: 1, scale: 1.02, alpha: 0.76, motion: "flicker" }
      ],
      3: [
        { type: "ember_stream", anchor: "head", color: 0xff6a3a, accentColor: 0xffb87a, count: 7, scale: 1.18, alpha: 0.98, motion: "rise_fade", spread: 20 },
        { type: "ground_sigils", anchor: "base", color: 0xff874c, accentColor: 0xffd69f, count: 1, scale: 1.1, alpha: 0.82, motion: "flicker" },
        { type: "side_ornament", anchor: "back", color: 0xffb87a, accentColor: 0xfff1c5, count: 2, scale: 1.08, alpha: 0.82, motion: "flicker" }
      ]
    }
  })
}) as Readonly<Record<string, Readonly<PresetDefinition>>>;

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, clone(nested)])) as unknown as T;
  }
  return value;
}

export function getPreset(presetKey: string | null | undefined): StarVisualIdentity | null {
  if (!presetKey) return null;
  const preset = PRESETS[presetKey];
  if (!preset) return null;
  const cloned: StarVisualIdentity = {
    presetKey,
    fallbackFamily: preset.motifFamily,
    surfacePolicy: preset.surfacePolicy,
    layersByStar: clone(preset.layersByStar)
  };
  return cloned;
}

export function listPresets(): string[] {
  return Object.keys(PRESETS);
}

export default {
  getPreset,
  listPresets
};
