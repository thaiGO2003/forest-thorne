import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createScenery } from "../src/world/scenery";

describe("scenery presentation", () => {
  it("keeps the decorative river outside the tactical slab while allowing it to meander", () => {
    const root = new THREE.Group();
    const owned: { dispose(): void }[] = [];
    const water = new THREE.MeshStandardMaterial();
    const scenery = createScenery(
      root,
      "solo",
      (resource) => {
        owned.push(resource);
        return resource;
      },
      ({ x, z }) => ({ x, z }),
      water,
    );

    const river = root.getObjectByName("scenery-river-meanders") as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const xPositions: Record<string, true> = {};

    for (let i = 0; i < river.count; i++) {
      river.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(position.z < -2 || position.z > 6).toBe(true);
      xPositions[String(Math.round(position.x * 2) / 2)] = true;
    }
    expect(Object.keys(xPositions).length).toBeGreaterThan(1);

    scenery.update(1 / 60);
    for (const resource of owned.reverse()) resource.dispose();
    water.dispose();
  });

  it("uses four bounded lamp lights and raises their intensity at night", () => {
    const root = new THREE.Group();
    const owned: { dispose(): void }[] = [];
    const water = new THREE.MeshStandardMaterial();
    const scenery = createScenery(
      root,
      "solo",
      (resource) => {
        owned.push(resource);
        return resource;
      },
      ({ x, z }) => ({ x, z }),
      water,
    );

    const lights = root.children.filter((child): child is THREE.PointLight => child instanceof THREE.PointLight);
    expect(lights).toHaveLength(4);

    scenery.setDayNight("night");
    for (const light of lights) expect(light.intensity).toBe(7);
    scenery.setDayNight("day");
    for (const light of lights) expect(light.intensity).toBe(0.3);

    for (const resource of owned.reverse()) resource.dispose();
    water.dispose();
  });
});
