import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { toVisual } from "../src/board/geometry";
import { createRun, buy, benchToBoard } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
import { createUnitManager } from "../src/world/unitManager";
import { cellToWorld } from "../src/world/arena";

describe("Planning UnitManager (spec §14, §22, A24, A90)", () => {
  it("synchronizes 3D models with RunState board and bench", () => {
    const scene = new THREE.Scene();
    const mgr = createUnitManager(scene);

    const s = createRun(42);
    skipTutorial(s);
    // Ensure shop has units and buy one
    const bought = buy(s, 0);
    expect(bought).toBe(true);
    expect(s.bench.length).toBe(1);

    mgr.sync(s);
    expect(mgr.getGroup().children.length).toBeGreaterThanOrEqual(2); // unit + selectRing

    // Deploy bench unit to board cell 12
    const deployed = benchToBoard(s, 0, 12);
    expect(deployed).toBe(true);
    expect(s.bench.length).toBe(0);
    expect(s.board[12]).not.toBeNull();

    mgr.sync(s);
    mgr.update(0.1);

    // Check pick on the board tile
    const raycaster = new THREE.Raycaster();
    // Ray pointing straight down from above cell 12
    const cellWorld = mgr.getGroup().children[0]?.position;
    expect(cellWorld).toBeDefined();

    mgr.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("normalizes screen picks against offset canvas bounds instead of the browser window", () => {
    const scene = new THREE.Scene();
    const mgr = createUnitManager(scene);
    const s = createRun(77);
    skipTutorial(s);
    const rect = {
      left: 160,
      top: 90,
      width: 800,
      height: 600,
      right: 960,
      bottom: 690,
      x: 160,
      y: 90,
    } as unknown as DOMRect;
    const canvas = { getBoundingClientRect: () => rect };
    const camera = new THREE.PerspectiveCamera(48, rect.width / rect.height, 0.1, 100);
    camera.position.set(8, 10, 9);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const world = cellToWorld(toVisual(2, 2), "solo");
    const ndc = new THREE.Vector3(world.x, 0, world.z).project(camera);
    const clientX = rect.left + ((ndc.x + 1) / 2) * rect.width;
    const clientY = rect.top + ((1 - ndc.y) / 2) * rect.height;

    expect(mgr.pickScreen(clientX, clientY, canvas, camera, s)).toEqual({ type: "board", index: 12 });
    expect(mgr.pickScreen(rect.left - 1, clientY, canvas, camera, s)).toBeNull();

    mgr.dispose();
  });

  it("handles selection and selection ring updates", () => {
    const scene = new THREE.Scene();
    const mgr = createUnitManager(scene);
    const s = createRun(123);
    skipTutorial(s);
    buy(s, 0);
    mgr.update(0.016);

    mgr.select(null);
    mgr.update(0.016);

    mgr.dispose();
  });
});
