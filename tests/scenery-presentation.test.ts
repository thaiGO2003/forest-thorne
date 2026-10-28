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

    const river = root.getObjectByName("scenery-river") as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const xPositions: Record<string, true> = {};
    let nearWidth = Number.POSITIVE_INFINITY;
    let farWidth = 0;

    for (let i = 0; i < river.count; i++) {
      river.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      expect(position.z < -2 || position.z > 6).toBe(true);
      expect(scale.x).toBeGreaterThanOrEqual(2);
      expect(quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-6);
      xPositions[String(Math.round(position.x * 2) / 2)] = true;
      const distance = position.z < -2 ? -2 - position.z : position.z - 6;
      if (distance <= 2) nearWidth = Math.min(nearWidth, scale.x);
      if (distance >= 30) farWidth = Math.max(farWidth, scale.x);
    }
    expect(Object.keys(xPositions).length).toBeGreaterThan(1);
    expect(nearWidth).toBeGreaterThan(1);
    expect(farWidth).toBeGreaterThan(nearWidth + 2);

    scenery.update(1 / 60);
    for (const resource of owned.reverse()) resource.dispose();
    water.dispose();
  });

  it("keeps natural forest scenery while removing wooden arena-side lamp structures", () => {
    const root = new THREE.Group();
    const owned: { dispose(): void }[] = [];
    const water = new THREE.MeshStandardMaterial();
    const scenery = createScenery(root, "solo", (resource) => {
      owned.push(resource);
      return resource;
    }, ({ x, z }) => ({ x, z }), water);

    expect(root.getObjectByName("scenery-trunks")).toBeInstanceOf(THREE.InstancedMesh);
    expect(root.getObjectByName("scenery-leaves")).toBeInstanceOf(THREE.InstancedMesh);
    expect(root.getObjectByName("scenery-lamp-posts")).toBeUndefined();
    expect(root.getObjectByName("scenery-lamp-branches")).toBeUndefined();
    expect(root.getObjectByName("scenery-lamp-bulbs")).toBeUndefined();
    expect(root.children.some((child) => child instanceof THREE.PointLight)).toBe(false);

    scenery.update(1 / 60);
    for (const resource of owned.reverse()) resource.dispose();
    water.dispose();
  });
});
