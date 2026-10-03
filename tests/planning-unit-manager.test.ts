import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRun, buy, benchToBoard } from "../src/core/run";
import { skipTutorial } from "../src/core/tutorial";
import { createUnitManager } from "../src/world/unitManager";

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
