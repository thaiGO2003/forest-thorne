import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createFoliageUniforms, patchFoliageSway } from "../src/world/foliage";

function compile(material: THREE.MeshStandardMaterial) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

describe("foliage sway shader", () => {
  it("shares the caller's clock so one update drives every animated material", () => {
    const clock = { value: 0 };
    const uniforms = createFoliageUniforms(clock);
    expect(uniforms.uTime).toBe(clock);
    expect(uniforms.uSway.value).toBe(1);
  });

  it("injects a per-instance phase offset into the vertex shader only", () => {
    const uniforms = createFoliageUniforms({ value: 0 });
    const material = new THREE.MeshStandardMaterial();
    const before = THREE.ShaderLib.standard.fragmentShader;
    patchFoliageSway(material, uniforms);

    const shader = compile(material);
    expect(shader.fragmentShader).toBe(before);
    expect(shader.vertexShader).toContain("ftAnchor");
    expect(shader.vertexShader).toContain("ftPhase");
    expect(shader.vertexShader).toContain("instanceMatrix");
    expect(shader.vertexShader).toContain("transformed.x +=");
    expect(shader.uniforms.uTime).toBe(uniforms.uTime);
  });

  it("keeps the sway amplitude proportional to the requested weight", () => {
    const small = new THREE.MeshStandardMaterial();
    const large = new THREE.MeshStandardMaterial();
    patchFoliageSway(small, createFoliageUniforms({ value: 0 }), 0.5);
    patchFoliageSway(large, createFoliageUniforms({ value: 0 }), 1);

    expect(compile(small).vertexShader).toContain("0.0275");
    expect(compile(large).vertexShader).toContain("0.0550");
    expect(small.customProgramCacheKey()).not.toBe(large.customProgramCacheKey());
  });
});
