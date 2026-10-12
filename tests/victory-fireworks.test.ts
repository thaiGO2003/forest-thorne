import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createVictoryFireworks } from "../src/world/victoryFireworks";

describe("victory fireworks", () => {
  it("creates one distinct-hue firework per reserve origin and self-cleans after the burst", () => {
    const scene = new THREE.Scene();
    let frame: (dt: number) => void = () => {};
    const unsubscribe = vi.fn();
    const fireworks = createVictoryFireworks(
      scene,
      (callback) => {
        frame = callback;
        return unsubscribe;
      },
      [
        { x: -2, y: 0.12, z: 3 },
        { x: 1.5, y: 0.12, z: 3.5 },
      ],
    );

    const group = scene.getObjectByName("victory-fireworks") as THREE.Group;
    expect(group).toBeDefined();
    expect(group.children).toHaveLength(4);

    const first = group.getObjectByName("victory-firework-rocket-0") as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    const second = group.getObjectByName("victory-firework-rocket-1") as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    expect(first.material.color.getHex()).not.toBe(second.material.color.getHex());

    for (let i = 0; i < 30; i++) frame(0.1);
    expect(scene.getObjectByName("victory-fireworks")).toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    fireworks.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when there are no reserve origins", () => {
    const scene = new THREE.Scene();
    const subscribe = vi.fn(() => vi.fn());
    const fireworks = createVictoryFireworks(scene, subscribe, []);

    expect(subscribe).not.toHaveBeenCalled();
    expect(scene.getObjectByName("victory-fireworks")).toBeUndefined();
    fireworks.dispose();
  });
});
