// Wind sway for decorative foliage. Injected into a normal `MeshStandardMaterial` so leaves
// and grass tufts keep the arena's lighting, shadows and fog; only the vertex position moves.
//
// The sway is a pure function of world position + time, so instanced foliage is desynchronised
// for free and no per-frame CPU work or matrix upload is needed.
import * as THREE from "three";

export interface FoliageUniforms {
  /** Shared scene clock in seconds; the water surface uses the same uniform object. */
  uTime: { value: number };
  /** Global multiplier; 0 freezes the foliage. */
  uSway: { value: number };
}

export function createFoliageUniforms(time: { value: number }): FoliageUniforms {
  return { uTime: time, uSway: { value: 1 } };
}

const PARS = /* glsl */ `
uniform float uTime;
uniform float uSway;
`;

const SWAY = /* glsl */ `
{
  // Per-instance phase from the instance origin (falls back to the vertex position when the
  // mesh is not instanced) keeps neighbouring trees from swaying in lockstep.
  #ifdef USE_INSTANCING
    vec3 ftAnchor = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #else
    vec3 ftAnchor = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  #endif
  float ftPhase = ftAnchor.x * 0.73 + ftAnchor.z * 0.91;
  // Only the upper part of each foliage block moves, so trunks and roots stay planted.
  float ftGain = clamp( transformed.y + 0.35, 0.0, 2.5 );
  float ftWobble = sin( uTime * 1.25 + ftPhase ) * 0.65 + sin( uTime * 0.62 + ftPhase * 1.7 ) * 0.35;
  float ftCross = cos( uTime * 0.95 + ftPhase * 1.3 );
  transformed.x += ftWobble * ftGain * 0.055 * uSway;
  transformed.z += ftCross * ftGain * 0.035 * uSway;
}
`;

/**
 * Add wind sway to a foliage material. The amplitude is deliberately small (a few percent of a
 * block) so voxel silhouettes stay readable and the tactical grid is never distorted.
 */
export function patchFoliageSway(material: THREE.MeshStandardMaterial, uniforms: FoliageUniforms, amplitude = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSway = uniforms.uSway;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${SWAY.replace("0.055", (0.055 * amplitude).toFixed(4)).replace("0.035", (0.035 * amplitude).toFixed(4))}`,
      );
  };
  material.customProgramCacheKey = () => `ft-foliage-sway-${amplitude}`;
  material.needsUpdate = true;
}
