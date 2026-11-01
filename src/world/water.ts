// Procedural water shading for the decorative river, the pond and the waterfall sheet.
//
// Both materials stay `MeshStandardMaterial` so they keep the arena's real lights, shadows,
// fog and tone mapping; the wave/flow work is injected through `onBeforeCompile` instead of
// replacing the whole shader. That keeps one lighting model for the scene and means the
// material still renders correctly in unit tests where no renderer (and therefore no
// `onBeforeCompile` call) exists.
import * as THREE from "three";

export interface WaterUniforms {
  /** Seconds since the arena was created; drives every wave and streak. */
  uTime: { value: number };
  /** 0 disables ripple normals and glints without rebuilding the material. */
  uWaveStrength: { value: number };
  /** Extra crest foam on the river surface. */
  uFoam: { value: number };
  /** Multiplier on the wave clock; 0 freezes the river. */
  uFlowSpeed: { value: number };
  /** Multiplied into the base colour inside wave troughs (deep-water tint). Working-space RGB. */
  uDeep: { value: THREE.Color };
  uFoamColor: { value: THREE.Color };
  /** Sparse sparkle colour added to the emissive term. */
  uGlint: { value: THREE.Color };
  /** Sky/environment colour blended in at grazing angles (Fresnel reflection). */
  uSky: { value: THREE.Color };
  /** World-space Y of the waterfall sheet top, so streaks scale with its height. */
  uSheetTop: { value: number };
  /** World-space X at the sheet centre, used for the lateral alpha falloff. */
  uSheetCenter: { value: number };
  /** How fast the sheet's falling bands scroll. */
  uSheetFall: { value: number };
}

const DEFAULT_SHEET_TOP = 7.2;
const DEFAULT_SHEET_CENTER = 0;

export function createWaterUniforms(): WaterUniforms {
  return {
    uTime: { value: 0 },
    uWaveStrength: { value: 1 },
    uFoam: { value: 0.55 },
    uFlowSpeed: { value: 1 },
    uDeep: { value: new THREE.Color().setRGB(0.70, 0.84, 1) },
    uFoamColor: { value: new THREE.Color(0xdff4ff) },
    uGlint: { value: new THREE.Color(0xbfe9ff) },
    uSky: { value: new THREE.Color(0x9fd6ff) },
    uSheetTop: { value: DEFAULT_SHEET_TOP },
    uSheetCenter: { value: DEFAULT_SHEET_CENTER },
    uSheetFall: { value: 1.15 },
  };
}

/** Retarget every tuning knob at once; used by the day/night + environment passes. */
export function tuneWater(
  uniforms: WaterUniforms,
  tune: { deepRgb?: [number, number, number]; glint?: number; sky?: number; foam?: number; strength?: number },
) {
  if (tune.deepRgb) uniforms.uDeep.value.setRGB(tune.deepRgb[0], tune.deepRgb[1], tune.deepRgb[2]);
  if (tune.glint !== undefined) uniforms.uGlint.value.setHex(tune.glint);
  if (tune.sky !== undefined) uniforms.uSky.value.setHex(tune.sky);
  if (tune.foam !== undefined) uniforms.uFoam.value = tune.foam;
  if (tune.strength !== undefined) uniforms.uWaveStrength.value = tune.strength;
}

const VERT_PARS = /* glsl */ `
varying vec3 vFtWorld;
`;

const VERT_BODY = /* glsl */ `
#ifdef USE_INSTANCING
  vFtWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#else
  vFtWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif
`;

const WAVE_PARS = /* glsl */ `
uniform float uTime;
uniform float uFlowSpeed;
varying vec3 vFtWorld;

// Two octaves: a broad swell that drives the colour crests, and a finer ripple that only
// bends the normal, so the surface reads as moving water at board scale (1 block = 1 unit).
float ftSwell( vec2 p ) {
  float t = uTime * uFlowSpeed;
  float across = p.x * 1.6;
  float along = p.y * 3.4 - t * 2.10;
  // Warped horizontal bands read as water flowing *along* the river instead of a grid.
  return sin( along + sin( across ) * 0.9 ) * 0.55
       + sin( along * 1.85 + across * 0.7 + t * 0.60 ) * 0.30
       + sin( across * 2.6 - t * 0.80 ) * 0.15;
}

float ftRipple( vec2 p ) {
  float t = uTime * uFlowSpeed;
  float along = p.y * 11.5 - t * 3.40;
  return sin( along + sin( p.x * 5.5 + t * 1.4 ) * 0.8 ) * 0.55
       + sin( p.x * 7.5 + t * 2.60 ) * 0.25
       + sin( ( p.x - p.y ) * 6.9 + t * 1.70 ) * 0.20;
}
`;

const WATER_FRAG_PARS = /* glsl */ `
uniform float uWaveStrength;
uniform float uFoam;
uniform vec3 uDeep;
uniform vec3 uFoamColor;
uniform vec3 uGlint;
uniform vec3 uSky;
${WAVE_PARS}
`;

const SHARED_VERTEX = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
};

/**
 * Ripple normals, crest tint and sparkle for the river/pond surface.
 *
 * The normal is rebuilt in world space and then moved into view space, because three's
 * `normal` variable is view space while the wave gradient is naturally world space. The
 * blend weight is masked by the surface's geometric up-ness so the box sides keep their
 * real normals.
 */
export function patchWaterMaterial(material: THREE.MeshStandardMaterial, uniforms: WaterUniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWaveStrength = uniforms.uWaveStrength;
    shader.uniforms.uFoam = uniforms.uFoam;
    shader.uniforms.uFlowSpeed = uniforms.uFlowSpeed;
    shader.uniforms.uDeep = uniforms.uDeep;
    shader.uniforms.uFoamColor = uniforms.uFoamColor;
    shader.uniforms.uGlint = uniforms.uGlint;
    shader.uniforms.uSky = uniforms.uSky;

    SHARED_VERTEX(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${WATER_FRAG_PARS}`)
      .replace(
        "#include <normal_fragment_begin>",
        /* glsl */ `#include <normal_fragment_begin>
{
  // Fade the fine ripple with camera distance so far water never aliases into moire.
  float distFade = 1.0 - smoothstep( 12.0, 34.0, length( vViewPosition ) );
  vec2 wp = vFtWorld.xz;
  float k = 0.035;
  float h0 = ftRipple( wp );
  float hx = ftRipple( wp + vec2( k, 0.0 ) );
  float hz = ftRipple( wp + vec2( 0.0, k ) );
  vec3 wn = normalize( vec3( -( hx - h0 ) / k * 0.18, 1.5, -( hz - h0 ) / k * 0.18 ) );
  vec3 wnView = normalize( ( viewMatrix * vec4( wn, 0.0 ) ).xyz );
  normal = normalize( mix( normal, wnView, clamp( uWaveStrength, 0.0, 1.0 ) * distFade ) );
}`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
{
  float distFade = 1.0 - smoothstep( 12.0, 34.0, length( vViewPosition ) );
  float crest = smoothstep( 0.10, 0.85, ftSwell( vFtWorld.xz ) );
  crest = mix( 0.5, crest, distFade );
  diffuseColor.rgb *= mix( uDeep, vec3( 1.0 ), crest );
  diffuseColor.rgb += uFoamColor * pow( crest, 3.0 ) * uFoam * 0.18;
}`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
{
  // Fresnel: reflection of the surroundings grows at grazing angles, which is what makes
  // a flat voxel slab read as water rather than painted plastic.
  float fres = pow( 1.0 - clamp( abs( dot( normal, normalize( vViewPosition ) ) ), 0.0, 1.0 ), 3.0 );
  totalEmissiveRadiance += uSky * fres * 0.55;

  vec2 gp = vFtWorld.xz * 3.1 + vec2( 0.0, uTime * uFlowSpeed * 0.6 );
  float s = sin( gp.x ) * sin( gp.y * 0.7 + 1.3 ) * sin( ( gp.x + gp.y ) * 0.55 );
  totalEmissiveRadiance += uGlint * smoothstep( 0.55, 1.0, s ) * 0.16 * clamp( uWaveStrength, 0.0, 1.0 );
}`,
      );
  };
  material.customProgramCacheKey = () => "ft-water-surface";
  material.needsUpdate = true;
}

/**
 * Falling bands + lateral fade for the waterfall sheet so the flat plane reads as moving
 * water instead of a painted quad.
 */
export function patchWaterfallSheet(material: THREE.MeshStandardMaterial, uniforms: WaterUniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uFlowSpeed = uniforms.uFlowSpeed;
    shader.uniforms.uSheetTop = uniforms.uSheetTop;
    shader.uniforms.uSheetCenter = uniforms.uSheetCenter;
    shader.uniforms.uSheetFall = uniforms.uSheetFall;

    SHARED_VERTEX(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform float uTime;
uniform float uFlowSpeed;
uniform float uSheetTop;
uniform float uSheetCenter;
uniform float uSheetFall;
varying vec3 vFtWorld;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
{
  float fall = clamp( ( uSheetTop - vFtWorld.y ) / max( uSheetTop, 1e-3 ), 0.0, 1.0 );
  float band = fract( fall * 5.0 - uTime * uFlowSpeed * uSheetFall );
  float streak = smoothstep( 0.0, 0.35, band ) * ( 1.0 - smoothstep( 0.6, 1.0, band ) );
  float lateral = 1.0 - smoothstep( 0.35, 1.0, abs( vFtWorld.x - uSheetCenter ) / 0.95 );
  float dissolve = 1.0 - smoothstep( 0.72, 1.0, fall );
  diffuseColor.rgb *= mix( 0.70, 1.0, streak ) * mix( 0.55, 1.0, lateral );
  diffuseColor.a *= mix( 0.5, 1.0, streak ) * mix( 0.25, 1.0, lateral ) * dissolve;
}`,
      );
  };
  material.customProgramCacheKey = () => "ft-waterfall-sheet";
  material.needsUpdate = true;
}
