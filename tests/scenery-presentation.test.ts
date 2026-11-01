import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createScenery } from "../src/world/scenery";
import { totalRows } from "../src/board/geometry";

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

  it("does not overlay out-of-arena terrain with decorative path tiles", () => {
    for (const profile of ["solo", "coop2", "coop4"] as const) {
      const root = new THREE.Group();
      const owned: { dispose(): void }[] = [];
      const water = new THREE.MeshStandardMaterial();
      createScenery(root, profile, (resource) => {
        owned.push(resource);
        return resource;
      }, ({ x, z }) => ({ x, z }), water);

      expect(root.getObjectByName("scenery-path-meanders")).toBeUndefined();
      const terrain = root.getObjectByName("scenery-caps") as THREE.InstancedMesh;
      const bodies = root.getObjectByName("scenery-terrain") as THREE.InstancedMesh;
      expect(terrain).toBeInstanceOf(THREE.InstancedMesh);
      expect(bodies).toBeInstanceOf(THREE.InstancedMesh);
      expect(bodies.count).toBeGreaterThan(terrain.count);

      // Former path overlays sat on these exterior columns; removing the overlay
      // must not excavate the landscape underneath or affect the gameplay slab.
      const matrix = new THREE.Matrix4();
      const hasCapAt = (x: number, z: number) => {
        for (let i = 0; i < terrain.count; i++) {
          terrain.getMatrixAt(i, matrix);
          if (matrix.elements[12] === x && matrix.elements[14] === z) return true;
        }
        return false;
      };
      expect(hasCapAt(1, -5)).toBe(true);
      expect(hasCapAt(11, totalRows(profile) + 4)).toBe(true);
      expect(root.getObjectByName("scenery-river")).toBeInstanceOf(THREE.InstancedMesh);
      expect((root.getObjectByName("scenery-lamp-posts") as THREE.InstancedMesh).count).toBe(4);

      for (const resource of owned.reverse()) resource.dispose();
      water.dispose();
    }
  });

  it("adds an owned, animated mountain waterfall at the river source", () => {
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

    const group = root.getObjectByName("scenery-waterfall") as THREE.Group;
    expect(group).toBeInstanceOf(THREE.Group);
    const mountain = group.getObjectByName("scenery-waterfall-mountain") as THREE.InstancedMesh;
    const sheet = group.getObjectByName("scenery-waterfall-sheet") as THREE.Mesh;
    const foam = group.getObjectByName("scenery-waterfall-foam") as THREE.InstancedMesh;
    const mist = group.getObjectByName("scenery-waterfall-mist") as THREE.InstancedMesh;
    const pool = group.getObjectByName("scenery-waterfall-pool") as THREE.Mesh;
    expect(mountain).toBeInstanceOf(THREE.InstancedMesh);
    expect(mountain.count).toBeGreaterThan(0);
    expect(sheet).toBeInstanceOf(THREE.Mesh);
    expect(sheet.position.z).toBeLessThan(-2);
    expect(foam.count).toBe(10);
    expect(mist.count).toBe(5);
    expect(pool).toBeInstanceOf(THREE.Mesh);

    const before = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    foam.getMatrixAt(0, before);
    scenery.update(0.6);
    foam.getMatrixAt(0, after);
    expect(after.elements).not.toEqual(before.elements);

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
