import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createWaterUniforms,
  patchWaterfallSheet,
  patchWaterMaterial,
  tuneWater,
} from "../src/world/water";

/** Run the material's injection against three's real standard shader source. */
function compile(material: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

describe("water surface shader", () => {
  it("ships finite defaults for every tuning knob", () => {
    const u = createWaterUniforms();
    for (const [name, entry] of Object.entries(u)) {
      const value = entry.value;
      if (typeof value === "number") expect(Number.isFinite(value), name).toBe(true);
      else expect(value, name).toBeInstanceOf(THREE.Color);
    }
    expect(u.uWaveStrength.value).toBeGreaterThan(0);
    expect(u.uSheetTop.value).toBeGreaterThan(0);
  });

  it("injects ripple normals, crest tint and fresnel into the standard shader", () => {
    const uniforms = createWaterUniforms();
    const material = new THREE.MeshStandardMaterial();
    patchWaterMaterial(material, uniforms);

    const shader = compile(material);

    // Anchors matched, so the wave helpers and per-fragment terms really landed.
    expect(shader.vertexShader).toContain("vFtWorld");
    expect(shader.vertexShader).toContain("instanceMatrix");
    expect(shader.fragmentShader).toContain("float ftSwell(");
    expect(shader.fragmentShader).toContain("float ftRipple(");
    expect(shader.fragmentShader).toContain("viewMatrix * vec4( wn, 0.0 )");
    expect(shader.fragmentShader).toContain("mix( uDeep, vec3( 1.0 ), crest )");
    expect(shader.fragmentShader).toMatch(/dot\(\s*normal,\s*normalize\(\s*vViewPosition\s*\)\s*\)/);
    // The fog/lighting includes must survive the rewrite.
    expect(shader.fragmentShader).toContain("#include <lights_fragment_begin>");
    expect(shader.fragmentShader).toContain("#include <fog_fragment>");
  });

  it("shares live uniform objects between the material and the caller", () => {
    const uniforms = createWaterUniforms();
    const material = new THREE.MeshStandardMaterial();
    patchWaterMaterial(material, uniforms);

    const shader = compile(material);
    expect(shader.uniforms.uTime).toBe(uniforms.uTime);
    expect(shader.uniforms.uDeep).toBe(uniforms.uDeep);

    // Mutating the shared object is what the arena's per-frame update relies on.
    uniforms.uTime.value = 12.5;
    expect(shader.uniforms.uTime.value).toBe(12.5);
  });

  it("scopes the program cache key so patched and vanilla materials never collide", () => {
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    patchWaterMaterial(a, createWaterUniforms());
    patchWaterfallSheet(b, createWaterUniforms());
    expect(a.customProgramCacheKey()).toBe("ft-water-surface");
    expect(b.customProgramCacheKey()).toBe("ft-waterfall-sheet");
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it("retunes deep tint, glint, sky, foam and strength together", () => {
    const u = createWaterUniforms();
    tuneWater(u, { deepRgb: [0.2, 0.3, 0.4], glint: 0x112233, sky: 0x445566, foam: 0.1, strength: 0.25 });
    expect(u.uDeep.value.r).toBeCloseTo(0.2, 5);
    expect(u.uDeep.value.g).toBeCloseTo(0.3, 5);
    expect(u.uDeep.value.b).toBeCloseTo(0.4, 5);
    expect(u.uFoam.value).toBe(0.1);
    expect(u.uWaveStrength.value).toBe(0.25);
    // Untouched knobs must survive a partial tune.
    tuneWater(u, { foam: 0.9 });
    expect(u.uWaveStrength.value).toBe(0.25);
    expect(u.uFoam.value).toBe(0.9);
  });
});

describe("waterfall sheet shader", () => {
  it("injects falling bands and a lateral alpha falloff", () => {
    const uniforms = createWaterUniforms();
    const material = new THREE.MeshStandardMaterial({ transparent: true });
    patchWaterfallSheet(material, uniforms);

    const shader = compile(material);
    expect(shader.fragmentShader).toContain("uniform float uSheetTop;");
    expect(shader.fragmentShader).toContain("float fall = clamp(");
    expect(shader.fragmentShader).toContain("diffuseColor.a *= mix( 0.5, 1.0, streak )");
    expect(shader.uniforms.uSheetFall).toBe(uniforms.uSheetFall);
    expect(shader.uniforms.uSheetCenter).toBe(uniforms.uSheetCenter);
  });
});
