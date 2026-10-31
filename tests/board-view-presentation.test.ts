import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import * as THREE from "three";
import { NORMAL_UNITS } from "../src/content/catalog";
import type { RunState } from "../src/core/run";
import { createBoardView, LOW_CORTISOL_DURATION_MS } from "../src/units/boardView";

vi.mock("../src/units/registry", () => ({
  createUnit: vi.fn((id: string, star: number) => {
    const root = new THREE.Group();
    const anchor = new THREE.Object3D();
    anchor.position.y = 1.8;
    root.add(anchor);
    return {
      id,
      star,
      root,
      anchor,
      play: vi.fn(),
      state: () => "idle",
      setCombat: vi.fn(),
      setFacing: vi.fn((side: "L" | "R" | number) => {
        root.rotation.y = typeof side === "number" ? side : side === "L" ? Math.PI / 2 : -Math.PI / 2;
      }),
      setHpRatio: vi.fn(),
      die: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    };
  }),
}));

const billboardMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    sprite: THREE.Sprite;
    set: Mock;
    setVisible: Mock;
    setPriority: Mock;
    dispose: Mock;
  }>,
}));

vi.mock("../src/units/billboard", async (importOriginal) => ({
  ...await importOriginal(),
  createBillboard: () => {
    const instance = {
      sprite: new THREE.Sprite(),
      set: vi.fn(),
      setVisible: vi.fn(),
      setPriority: vi.fn(),
      dispose: vi.fn(),
    };
    billboardMocks.instances.push(instance);
    return instance;
  },
}));

function runWithBench(uid = "bench-1"): RunState {
  const board = Array.from({ length: 25 }, () => null);
  return {
    board,
    bench: [{ uid, baseId: NORMAL_UNITS[0]!.id, star: 1 }],
    enemyPreview: [],
  } as unknown as RunState;
}

function runWithBoard(uid = "board-1", index = 0): RunState {
  const board = Array.from({ length: 25 }, () => null) as RunState["board"];
  board[index] = { uid, baseId: NORMAL_UNITS[0]!.id, star: 1, equips: [] };
  return { board, bench: [], enemyPreview: [] } as unknown as RunState;
}

function stageHarness() {
  let frame: (dt: number) => void = () => {};
  const sceneAdd = vi.fn();
  const camera = new THREE.PerspectiveCamera(45, 1280 / 720, 0.1, 1000);
  camera.position.set(0, 12, 22);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const stage = {
    scene: { add: sceneAdd },
    camera,
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }),
      },
    },
    arena: { setOccupied: vi.fn() },
    onFrame(callback: (dt: number) => void) {
      frame = callback;
      return vi.fn();
    },
  };
  vi.stubGlobal("document", { querySelector: () => null });
  return { stage: stage as never, sceneAdd, advance: (seconds: number) => frame(seconds) };
}

beforeEach(() => {
  billboardMocks.instances.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("BoardView presentation", () => {
  it("faces bench animals toward the tactical center", () => {
    const { stage } = stageHarness();
    const board = createBoardView(stage);
    const run = runWithBench();
    board.sync(run);

    const visual = board.visual("bench-1")!;
    expect(visual.root.rotation.y).toBeCloseTo(Math.atan2(-visual.root.position.x, -visual.root.position.z), 12);

    board.dispose();
  });

  it("runs Low Cortisol for exactly 120 seconds and restores base transforms without drift", () => {
    const { stage, advance } = stageHarness();
    const board = createBoardView(stage);
    const run = runWithBench();
    board.sync(run);

    const visual = board.visual("bench-1")!;
    const baseY = visual.root.position.y;
    const baseYaw = visual.root.rotation.y;

    board.startLowCortisol();
    advance(1 / 60);
    expect(visual.root.position.y).toBeGreaterThanOrEqual(baseY);
    expect(visual.root.rotation.y).not.toBe(baseYaw);

    advance(LOW_CORTISOL_DURATION_MS / 1000 - 1 / 60);
    expect(visual.root.position.y).toBe(baseY);
    expect(visual.root.rotation.y).toBe(baseYaw);

    board.startLowCortisol();
    advance(1);
    board.startLowCortisol();
    expect(visual.root.position.y).toBe(baseY);
    expect(visual.root.rotation.y).toBe(baseYaw);
    advance(LOW_CORTISOL_DURATION_MS / 1000);
    expect(visual.root.position.y).toBe(baseY);
    expect(visual.root.rotation.y).toBe(baseYaw);

    board.dispose();
  });

  it("animates a committed board-cell move instead of teleporting the rendered rig", () => {
    const { stage, advance } = stageHarness();
    const board = createBoardView(stage);
    const source = runWithBoard();
    board.sync(source);

    const visual = board.visual("board-1")!;
    const start = { x: visual.root.position.x, z: visual.root.position.z };
    const moved = runWithBoard("board-1", 1);
    const target = board.cellCenter(1, 0);
    board.sync(moved);

    expect({ x: visual.root.position.x, z: visual.root.position.z }).toEqual(start);
    expect(visual.root.position.x).not.toBe(target.x);
    advance(0.11);
    expect(visual.root.position.x).toBeGreaterThan(Math.min(start.x, target.x));
    expect(visual.root.position.x).toBeLessThan(Math.max(start.x, target.x));
    advance(0.11);
    expect(visual.root.position.x).toBeCloseTo(target.x, 12);
    expect(visual.root.position.z).toBeCloseTo(target.z, 12);
    expect(visual.root.position.y).toBeGreaterThanOrEqual(0.12);

    board.dispose();
  });

  it("lands a dropped rig on its committed tile instead of replaying a flight from the old cell", () => {
    const { stage, advance } = stageHarness();
    const board = createBoardView(stage);
    board.sync(runWithBoard("board-1", 0));
    const visual = board.visual("board-1")!;
    const target = board.cellCenter(1, 0);
    // The drag already moved the rig under the pointer; sync may start a move tween.
    visual.root.position.set(target.x, 0.3, target.z);
    board.sync(runWithBoard("board-1", 1));
    board.landUnit!("board-1");

    expect(visual.root.position.x).toBeCloseTo(target.x, 12);
    expect(visual.root.position.z).toBeCloseTo(target.z, 12);
    expect(visual.root.position.y).toBeCloseTo(0.12, 12);
    expect(vi.mocked(visual.play)).toHaveBeenLastCalledWith("idle");

    advance(0.05);
    expect(visual.root.position.y).toBeCloseTo(0.12, 12);
    expect(visual.root.scale.y).toBeLessThan(1);
    expect(visual.root.scale.x).toBeGreaterThan(1);
    advance(0.5);
    expect(visual.root.position.y).toBeCloseTo(0.12, 12);
    expect(visual.root.scale.x).toBeCloseTo(1, 12);
    expect(visual.root.scale.y).toBeCloseTo(1, 12);
    board.dispose();
  });

  it("marks the acting tile with the old_src turn marker and stepped rainbow skill border", () => {
    const { stage, sceneAdd, advance } = stageHarness();
    const board = createBoardView(stage);
    board.sync(runWithBoard());
    const rainbow = sceneAdd.mock.calls[1]![0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> & { visible: boolean };
    const turnFill = sceneAdd.mock.calls[2]![0] as THREE.Mesh & { visible: boolean };
    const turnBorder = sceneAdd.mock.calls[3]![0] as THREE.Mesh & { visible: boolean };
    const actorBorder = sceneAdd.mock.calls[4]![0] as THREE.Mesh & { visible: boolean };
    const center = board.cellCenter(0, 0);

    board.setTurnIndicator!("board-1");
    board.setActorHighlight!("board-1");
    board.setCombatBorder!("board-1", "skill");
    advance(0);
    expect(turnFill.visible).toBe(true);
    expect(turnBorder.visible).toBe(true);
    expect(actorBorder.visible).toBe(false);
    expect(turnFill.position.x).toBeCloseTo(center.x, 12);
    expect(turnFill.position.z).toBeCloseTo(center.z, 12);
    expect(rainbow.visible).toBe(true);
    expect(rainbow.position.x).toBeCloseTo(center.x, 12);

    const hsl = { h: 0, s: 0, l: 0 };
    rainbow.material.color.getHSL(hsl);
    expect(hsl.h).toBeCloseTo(0, 5);
    advance(0.05);
    rainbow.material.color.getHSL(hsl);
    expect(hsl.h).toBeCloseTo(0, 5);
    advance(0.06);
    rainbow.material.color.getHSL(hsl);
    expect(hsl.h).toBeCloseTo(60 / 360, 5);
    expect(hsl.l).toBeCloseTo(0.55, 5);

    board.setCombatBorder!(null);
    board.setTurnIndicator!(null);
    advance(0);
    expect(rainbow.visible).toBe(false);
    expect(turnFill.visible).toBe(false);
    board.dispose();
  });

  it("restores Low Cortisol before entering combat", () => {
    const { stage, advance } = stageHarness();
    const board = createBoardView(stage);
    const run = runWithBench();
    board.sync(run);

    const visual = board.visual("bench-1")!;
    const baseY = visual.root.position.y;
    const baseYaw = visual.root.rotation.y;
    board.startLowCortisol();
    advance(0.5);
    expect(visual.root.position.y).toBeGreaterThanOrEqual(baseY);
    expect(visual.root.rotation.y).not.toBe(baseYaw);
    board.setCombat(true);
    expect(visual.root.position.y).toBe(baseY);
    expect(visual.root.rotation.y).toBe(baseYaw);

    board.dispose();
  });

  it("keeps direct tile feedback above overlapping splash and scan feedback", () => {
    const { stage, sceneAdd } = stageHarness();
    const board = createBoardView(stage);
    board.sync(runWithBoard());

    board.flashTile!("board-1", "scan");
    const tile = sceneAdd.mock.calls.at(-1)![0] as { material: { color: { getHex(): number } } };
    expect(tile.material.color.getHex()).toBe(0x984cf5);

    board.flashTile!("board-1", "splash");
    expect(tile.material.color.getHex()).toBe(0xffd24e);

    board.flashTile!("board-1", "direct");
    expect(tile.material.color.getHex()).toBe(0xff4d58);

    board.flashTile!("board-1", "splash");
    board.flashTile!("board-1", "scan");
    expect(tile.material.color.getHex()).toBe(0xff4d58);

    board.dispose();
  });

  it("keeps Planning target preview persistent, prioritized, and clearable", () => {
    const { stage, sceneAdd, advance } = stageHarness();
    const board = createBoardView(stage);
    const run = runWithBoard();
    run.board[1] = { uid: "board-2", baseId: NORMAL_UNITS[1]!.id, star: 1, equips: [] };
    board.sync(run);
    const rainbow = sceneAdd.mock.calls[1]![0] as { visible: boolean };

    board.setTargetPreview?.({
      scanCells: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      directUids: ["board-1"],
      splashUids: ["board-2"],
      skillCasterUid: "board-1",
    });
    const direct = sceneAdd.mock.calls.at(-2)![0] as { material: { color: { getHex(): number } }; visible: boolean };
    const splash = sceneAdd.mock.calls.at(-1)![0] as { material: { color: { getHex(): number } }; visible: boolean };
    expect(direct.visible).toBe(true);
    expect(direct.material.color.getHex()).toBe(0xff4d58);
    expect(splash.visible).toBe(true);
    expect(splash.material.color.getHex()).toBe(0xffd24e);

    advance(1);
    expect(direct.visible).toBe(true);
    expect(direct.material.color.getHex()).toBe(0xff4d58);
    expect(splash.visible).toBe(true);
    expect(rainbow.visible).toBe(true);

    board.setTargetPreview?.(null);
    advance(0);
    expect(direct.visible).toBe(false);
    expect(splash.visible).toBe(false);
    expect(rainbow.visible).toBe(false);
    board.dispose();
  });

  it("flashes sparse scan cells without requiring a unit and expires the overlay", () => {
    const { stage, sceneAdd, advance } = stageHarness();
    const board = createBoardView(stage);
    const center = board.cellCenter(9, 4);

    board.flashCell!(9, 4, "scan");
    const tile = sceneAdd.mock.calls.at(-1)![0] as {
      material: { color: { getHex(): number } };
      position: { x: number; z: number };
      visible: boolean;
    };
    expect(tile.material.color.getHex()).toBe(0x984cf5);
    expect(tile.position.x).toBeCloseTo(center.x, 12);
    expect(tile.position.z).toBeCloseTo(center.z, 12);
    expect(tile.visible).toBe(true);

    advance(0.26);
    expect(tile.visible).toBe(false);
    board.dispose();
  });

  it("shows and expires rainbow feedback on the skill caster", () => {
    const { stage, sceneAdd, advance } = stageHarness();
    const board = createBoardView(stage);
    const rainbow = sceneAdd.mock.calls[1]![0] as {
      material: { color: { getHex(): number } };
      visible: boolean;
    };
    board.sync(runWithBoard());
    const initialColor = rainbow.material.color.getHex();

    board.flashSkill!("board-1");
    advance(0.05);
    expect(rainbow.visible).toBe(true);
    expect(rainbow.material.color.getHex()).not.toBe(initialColor);

    advance(0.8);
    expect(rainbow.visible).toBe(false);
    board.dispose();
  });
  it("raises the hovered billboard above peers and restores normal priority", () => {
    const { stage, advance } = stageHarness();
    const board = createBoardView(stage);
    const run = runWithBoard();
    run.board[24] = { uid: "board-2", baseId: NORMAL_UNITS[1]!.id, star: 1, equips: [] };
    board.sync(run);
    advance(1 / 60);
    const first = billboardMocks.instances[0]!;
    const second = billboardMocks.instances[1]!;
    board.setHovered("board-1");
    advance(1 / 60);
    expect(first.setPriority).toHaveBeenLastCalledWith(true);

    board.setHovered("board-2");
    advance(1 / 60);
    expect(second.setPriority).toHaveBeenLastCalledWith(true);

    board.setHovered(null);
    advance(1 / 60);
    expect(second.setPriority).toHaveBeenLastCalledWith(false);
    board.dispose();
  });

  it("pushes live HP and rage updates into the billboard and unit HP ratio", () => {
    const { stage } = stageHarness();
    const board = createBoardView(stage);
    board.sync(runWithBoard());
    const billboard = billboardMocks.instances[0]!;
    const visual = board.visual("board-1")!;
    billboard.set.mockClear();

    board.setLive("board-1", { hp: 25, maxHp: 100, rage: 3, rageMax: 4 });

    expect(billboard.set).toHaveBeenCalledWith(expect.objectContaining({
      hp: 25,
      maxHp: 100,
      rage: 3,
      rageMax: 4,
    }));
    expect(visual.setHpRatio).toHaveBeenCalledWith(0.25);
    board.dispose();
  });
});
