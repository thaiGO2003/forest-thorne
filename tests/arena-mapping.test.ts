import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { toVisual } from "../src/board/geometry";
vi.mock("../src/world/scenery", () => ({
  createScenery: () => ({ setEnvironment() {}, setDayNight() {}, update() {} }),
}));
vi.mock("../src/world/sky", () => ({
  createSky: () => ({ setEnvironment() {}, setDayNight() {}, update() {} }),
}));
import { cellToWorld, createArena, worldToLogical } from "../src/world/arena";

describe("arena world mapping (A91.2)", () => {
  it("round-trips every logical cell through world space", () => {
    for (const p of ["solo", "coop2", "coop4"] as const) {
      const rows = { solo: 5, coop2: 10, coop4: 20 }[p];
      for (let col = 0; col < 10; col++) for (let row = 0; row < rows; row++) {
        const w = cellToWorld(toVisual(col, row), p);
        expect(worldToLogical(w.x, w.z, p)).toEqual({ col, row });
      }
    }
  });

  it("river is centred at x=0 and its interior never resolves to a cell", () => {
    expect(cellToWorld({ x: 5, z: 2 }, "solo").x).toBe(0);
    for (const x of [-0.49, 0, 0.3, 0.49]) expect(worldToLogical(x, 0, "solo")).toBeNull();
    expect(worldToLogical(0.6, 0, "solo")).toEqual({ col: 5, row: 2 });
    expect(worldToLogical(-0.6, 0, "solo")).toEqual({ col: 4, row: 2 });
  });

  it("off-board points resolve to null", () => {
    expect(worldToLogical(9, 0, "solo")).toBeNull();
    expect(worldToLogical(1, 4, "solo")).toBeNull();
  });

  it("applies semantic highlights only to playable tiles and restores the exact checker color", () => {
    const scene = new THREE.Scene();
    const arena = createArena(scene, "solo");
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const color = new THREE.Color();
    const tileIndex = (col: number, row: number) => {
      const expected = cellToWorld(toVisual(col, row), "solo");
      for (let i = 0; i < arena.tiles.count; i++) {
        arena.tiles.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        if (Math.abs(position.x - expected.x) < 1e-6 && Math.abs(position.z - expected.z) < 1e-6) return i;
      }
      return -1;
    };
    const directIndex = tileIndex(2, 1);
    const areaIndex = tileIndex(3, 1);
    expect(directIndex).toBeGreaterThanOrEqual(0);
    expect(areaIndex).toBeGreaterThanOrEqual(0);
    arena.tiles.getColorAt(directIndex, color);
    const checker = color.getHex();

    arena.setHighlights([
      { col: 2, row: 1, role: "direct" },
      { col: 3, row: 1, role: "area" },
      { col: 99, row: 99, role: "invalid" },
      { col: -1, row: 2, role: "hover" },
    ]);
    arena.tiles.getColorAt(directIndex, color);
    expect(color.getHex()).toBe(0xff3b30);
    arena.tiles.getColorAt(areaIndex, color);
    expect(color.getHex()).toBe(0xffd43b);
    expect(arena.tiles.count).toBe(50);
    for (let i = 0; i < arena.tiles.count; i++) {
      arena.tiles.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(Math.abs(position.x)).toBeGreaterThanOrEqual(0.5);
    }

    arena.clearHighlights();
    arena.tiles.getColorAt(directIndex, color);
    expect(color.getHex()).toBe(checker);
    arena.dispose();
  });

  it("scales warm sun rays and the single shadow pass with graphics quality", () => {
    const scene = new THREE.Scene();
    const arena = createArena(scene, "solo");
    const rays = arena.root.getObjectByName("sun-rays") as THREE.Group;
    const ray = rays.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const material = ray.material;
    let shadowLights = arena.root.children
      .filter((child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight && child.castShadow);

    expect(rays.children).toHaveLength(2);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    arena.setShadowQuality("high");
    expect(rays.visible).toBe(true);
    expect(shadowLights).toHaveLength(1);
    expect(shadowLights[0]!.shadow.mapSize.x).toBe(2048);
    const highStrength = material.uniforms.strength!.value as number;
    const startTime = material.uniforms.time!.value as number;
    arena.update(0.5);
    expect(material.uniforms.time!.value).toBeCloseTo(startTime + 0.5);

    arena.setDayNight("night");
    const nightStrength = material.uniforms.strength!.value as number;
    expect(nightStrength).toBeLessThan(highStrength);
    arena.setEnvironment("NIGHT");
    expect(material.uniforms.strength!.value as number).toBeCloseTo(nightStrength * 0.45);
    arena.setDayNight("day");
    expect(material.uniforms.strength!.value as number).toBeGreaterThan(nightStrength);

    arena.setShadowQuality("medium");
    shadowLights = arena.root.children
      .filter((child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight && child.castShadow);
    expect(shadowLights[0]!.shadow.mapSize.x).toBe(1024);
    expect(material.uniforms.strength!.value as number).toBeLessThan(highStrength);

    arena.setShadowQuality("low");
    expect(rays.visible).toBe(false);
    shadowLights = arena.root.children
      .filter((child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight && child.castShadow);
    expect(shadowLights).toHaveLength(0);
    arena.dispose();
  });

  it("keeps the largest playable board inside the primary shadow camera", () => {
    const scene = new THREE.Scene();
    const arena = createArena(scene, "coop4");
    arena.setShadowQuality("high");
    const sun = arena.root.children.find(
      (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight && child.castShadow,
    );
    expect(sun).toBeDefined();
    sun!.updateMatrixWorld(true);
    sun!.target.updateMatrixWorld(true);
    sun!.shadow.updateMatrices(sun!);

    for (let col = 0; col < 10; col++) for (let row = 0; row < 20; row++) {
      const world = cellToWorld(toVisual(col, row), "coop4");
      const projected = new THREE.Vector3(world.x, 0.12, world.z).project(sun!.shadow.camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(1);
    }
    arena.dispose();
  });
});
