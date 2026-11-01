import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { benchPerimeter, toVisual } from "../src/board/geometry";
import { createBridge } from "../src/app/bridge";
import { createPlanningDragController, type PlanningDragTargetState } from "../src/app/planningDrag";
import { cellToWorld } from "../src/world/arena";

const TILE_HEIGHT = 0.12;

class FakeCanvas {
  private readonly listeners = new Map<string, Array<{ listener: EventListener; capture: boolean }>>();
  private readonly captured = new Set<number>();

  constructor(private readonly rect: DOMRect) {}

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    if (typeof listener !== "function") return;
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const handlers = this.listeners.get(type) ?? [];
    handlers.push({ listener, capture });
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
    if (typeof listener !== "function") return;
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const handlers = this.listeners.get(type) ?? [];
    this.listeners.set(type, handlers.filter((entry) => entry.listener !== listener || entry.capture !== capture));
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId);
  }

  dispatchPointer(
    type: string,
    clientX: number,
    clientY: number,
    pointerId = 1,
    pointerType = "mouse",
  ): void {
    let stopped = false;
    const event = {
      type,
      clientX,
      clientY,
      pointerId,
      pointerType,
      button: 0,
      isPrimary: true,
      preventDefault() {},
      stopImmediatePropagation() { stopped = true; },
    } as unknown as PointerEvent;

    const handlers = [...(this.listeners.get(type) ?? [])].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const { listener } of handlers) {
      listener(event);
      if (stopped) break;
    }
  }
}

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  } as unknown as DOMRect;
}

function makeCamera(rect: DOMRect): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(48, rect.width / rect.height, 0.1, 100);
  camera.position.set(8.5, 10.5, 9.5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function makeLogicalTiles(): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.96, TILE_HEIGHT, 0.96);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 50);
  const matrix = new THREE.Matrix4();
  let instance = 0;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const world = cellToWorld(toVisual(col, row), "solo");
      mesh.setMatrixAt(instance++, matrix.makeTranslation(world.x, TILE_HEIGHT / 2, world.z));
    }
  }

  mesh.count = instance;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function clientPointForWorld(
  world: THREE.Vector3,
  camera: THREE.Camera,
  rect: DOMRect,
): { clientX: number; clientY: number } {
  const ndc = world.clone().project(camera);
  return {
    clientX: rect.left + ((ndc.x + 1) / 2) * rect.width,
    clientY: rect.top + ((1 - ndc.y) / 2) * rect.height,
  };
}

function placeRoot(root: THREE.Object3D, x: number, z: number, scene: THREE.Scene): void {
  root.position.set(x, TILE_HEIGHT, z);
  scene.updateMatrixWorld(true);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Planning drag controller", () => {
  it("moves player units across bench/board paths and never starts a drag from enemy preview units", () => {
    vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {}, setTimeout: globalThis.setTimeout.bind(globalThis) });

    const bridge = createBridge(storage());
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(bridge.buy(0)).toBe(true);
    expect(bridge.buy(1)).toBe(true);
    expect(run.bench).toHaveLength(2);

    const playerUid = run.bench[0]!.uid;
    const otherUid = run.bench[1]!.uid;
    const rect = makeRect(80, 45, 980, 720);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect);
    const tiles = makeLogicalTiles();
    const scene = new THREE.Scene();

    const playerRoot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.72), new THREE.MeshBasicMaterial());
    playerRoot.userData.uid = playerUid;
    const otherRoot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.72), new THREE.MeshBasicMaterial());
    otherRoot.userData.uid = otherUid;
    const enemyRoot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.72), new THREE.MeshBasicMaterial());
    enemyRoot.userData.uid = "enemy-preview";
    scene.add(playerRoot, otherRoot, enemyRoot);

    const bench = benchPerimeter("solo").map((cell) => cellToWorld(cell, "solo"));
    placeRoot(playerRoot, bench[0]!.x, bench[0]!.z, scene);
    placeRoot(otherRoot, bench[1]!.x, bench[1]!.z, scene);
    const enemyWorld = cellToWorld(toVisual(6, 2), "solo");
    placeRoot(enemyRoot, enemyWorld.x, enemyWorld.z, scene);

    const boardView = {
      forEach(fn: (uid: string, visual: { root: THREE.Object3D }, kind: "board" | "bench" | "enemy") => void) {
        fn(playerUid, { root: playerRoot }, "bench");
        fn(otherUid, { root: otherRoot }, "bench");
        fn("enemy-preview", { root: enemyRoot }, "enemy");
      },
      visual(uid: string) {
        if (uid === playerUid) return { root: playerRoot };
        if (uid === otherUid) return { root: otherRoot };
        if (uid === "enemy-preview") return { root: enemyRoot };
        return undefined;
      },
      setHovered: vi.fn(),
      slot(id: string) {
        if (id === "enemy-preview") return { kind: "enemy", col: 6, row: 2 };
        const index = run.board.findIndex((unit) => unit?.uid === id);
        if (index >= 0) return { kind: "board", col: index % 5, row: Math.floor(index / 5) };
        const benchIndex = run.bench.findIndex((unit) => unit?.uid === id);
        return benchIndex >= 0 ? { kind: "bench", col: benchIndex, row: 0 } : undefined;
      },
    };

    const setHighlights = vi.fn();
    const clearHighlights = vi.fn();
    const setBenchHighlights = vi.fn();
    const clearBenchHighlights = vi.fn();
    let renderFrame: (dt: number) => void = () => {};
    const stage = {
      renderer: { domElement: canvas },
      camera,
      arena: { tiles, setHighlights, clearHighlights, setBenchHighlights, clearBenchHighlights },
      onFrame(callback: (dt: number) => void) { renderFrame = callback; return () => { renderFrame = () => {}; }; },
      scene,
    };

    const moves: Array<{ from: { kind: "bench" | "board"; index: number }; to: { kind: "bench" | "board"; index: number } }> = [];
    const selections: Array<{ kind: "bench" | "board"; index: number }> = [];
    const inspected: string[] = [];
    const targetStates: Array<PlanningDragTargetState | null> = [];
    let inspectOnly = false;
    const controller = createPlanningDragController({
      stage: stage as never,
      board: boardView as never,
      getRun: () => bridge.run(),
      move: (from, to) => {
        moves.push({ from, to });
        return bridge.move(from, to);
      },
      select: (source) => { selections.push(source); },
      inspectEnemy: (uid) => { inspected.push(uid); },
      onTargetState: (state) => { targetStates.push(state); },
      enabled: () => true,
      inspectOnly: () => inspectOnly,
    });

    const drag = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      pointerId: number,
      pointerType = "mouse",
      beforeDrop?: () => void,
    ) => {
      const start = clientPointForWorld(from, camera, rect);
      const end = clientPointForWorld(to, camera, rect);
      canvas.dispatchPointer("pointerdown", start.clientX, start.clientY, pointerId, pointerType);
      canvas.dispatchPointer("pointermove", end.clientX, end.clientY, pointerId, pointerType);
      beforeDrop?.();
      canvas.dispatchPointer("pointerup", end.clientX, end.clientY, pointerId, pointerType);
    };
    const click = (point: THREE.Vector3, pointerId: number) => {
      const target = clientPointForWorld(point, camera, rect);
      canvas.dispatchPointer("pointerdown", target.clientX, target.clientY, pointerId);
      canvas.dispatchPointer("pointerup", target.clientX, target.clientY, pointerId);
    };

    const boardA = { col: 1, row: 1 };
    const boardAWorld = cellToWorld(toVisual(boardA.col, boardA.row), "solo");
    const boardAIndex = boardA.row * 5 + boardA.col;
    const beforePreview = JSON.stringify(run);
    drag(
      new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z),
      new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z),
      1,
      "touch",
      () => {
        expect(controller.targetState()).toEqual({
          source: { kind: "bench", index: 0 },
          target: { kind: "board", index: boardAIndex },
          valid: true,
        });
        expect(JSON.stringify(run)).toBe(beforePreview);
        renderFrame(0.1);
        expect(playerRoot.position.distanceTo(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z))).toBeGreaterThan(0.1);
      },
    );
    expect(controller.targetState()).toBeNull();
    expect(run.board[boardAIndex]?.uid).toBe(playerUid);
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([{
      col: boardA.col,
      row: boardA.row,
      role: "valid",
    }]);
    expect(selections).toEqual([]);
    expect(run.bench[0]?.uid).toBe(otherUid);

    placeRoot(playerRoot, boardAWorld.x, boardAWorld.z, scene);
    // Hidden status/speech surfaces must not intercept a click on a visible creature.
    const hiddenOverlay = new THREE.Group();
    hiddenOverlay.visible = false;
    const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial());
    hiddenOverlay.add(hiddenMesh);
    hiddenOverlay.position.copy(playerRoot.position).sub(enemyRoot.position);
    enemyRoot.add(hiddenOverlay);
    scene.updateMatrixWorld(true);
    click(new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z), 6);
    expect(selections).toEqual([{ kind: "board", index: boardAIndex }]);
    // The tile under a unit is a click target too, even when the ray misses the model silhouette.
    playerRoot.visible = false;
    click(new THREE.Vector3(boardAWorld.x + 0.42, TILE_HEIGHT, boardAWorld.z), 14);
    playerRoot.visible = true;
    expect(selections).toHaveLength(2);
    expect(selections.at(-1)).toEqual({ kind: "board", index: boardAIndex });
    hiddenOverlay.removeFromParent(); hiddenMesh.geometry.dispose(); hiddenMesh.material.dispose();

    const sameCell = clientPointForWorld(new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z), camera, rect);
    canvas.dispatchPointer("pointerdown", sameCell.clientX, sameCell.clientY, 9);
    canvas.dispatchPointer("pointermove", sameCell.clientX + 8, sameCell.clientY, 9);
    expect(controller.targetState()).toEqual({
      source: { kind: "board", index: boardAIndex },
      target: { kind: "board", index: boardAIndex },
      valid: false,
    });
    const invalidMoveCount = moves.length;
    canvas.dispatchPointer("pointerup", sameCell.clientX + 8, sameCell.clientY, 9);
    expect(controller.targetState()).toBeNull();
    expect(moves).toHaveLength(invalidMoveCount);
    expect(targetStates.some((state) => state?.valid === false && state.target?.kind === "board")).toBe(true);
    const boardB = { col: 3, row: 1 };
    const boardBWorld = cellToWorld(toVisual(boardB.col, boardB.row), "solo");
    drag(
      new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z),
      new THREE.Vector3(boardBWorld.x, TILE_HEIGHT, boardBWorld.z),
      2,
      "mouse",
      () => {
        renderFrame(0.1);
        expect(playerRoot.position.distanceTo(new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z))).toBeGreaterThan(0.1);
      },
    );
    const boardBIndex = boardB.row * 5 + boardB.col;
    expect(run.board[boardAIndex]).toBeNull();
    expect(run.board[boardBIndex]?.uid).toBe(playerUid);
    expect(selections).toHaveLength(2);

    placeRoot(playerRoot, boardBWorld.x, boardBWorld.z, scene);
    drag(
      new THREE.Vector3(boardBWorld.x, TILE_HEIGHT, boardBWorld.z),
      new THREE.Vector3(bench[1]!.x, TILE_HEIGHT, bench[1]!.z),
      3,
    );
    expect(run.board[boardBIndex]).toBeNull();
    expect(run.bench[1]?.uid).toBe(playerUid);

    // Do not warm world matrices here: clicks must work before the next renderer frame.
    playerRoot.position.set(bench[1]!.x, TILE_HEIGHT, bench[1]!.z);
    click(new THREE.Vector3(bench[1]!.x, TILE_HEIGHT, bench[1]!.z), 7);
    expect(selections).toEqual([
      { kind: "board", index: boardAIndex },
      { kind: "board", index: boardAIndex },
      { kind: "bench", index: 1 },
    ]);
    drag(
      new THREE.Vector3(bench[1]!.x, TILE_HEIGHT, bench[1]!.z),
      new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z),
      4,
    );
    expect(run.bench[0]?.uid).toBe(playerUid);
    expect(run.bench[1]?.uid).toBe(otherUid);

    const moveCount = moves.length;
    const enemyPoint = new THREE.Vector3(enemyWorld.x, TILE_HEIGHT, enemyWorld.z);
    drag(enemyPoint, new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z), 5);
    expect(moves).toHaveLength(moveCount);
    expect(inspected).toEqual([]);
    click(enemyPoint, 8);
    expect(selections).toHaveLength(3);
    // A tap on an enemy opens its read-only detail, exactly like an ally tap.
    expect(inspected).toEqual(["enemy-preview"]);

    // Combat clicks still inspect owned units, while drags never mutate the formation.
    inspectOnly = true;
    run.phase = "COMBAT";
    placeRoot(playerRoot, bench[0]!.x, bench[0]!.z, scene);
    const combatBefore = JSON.stringify(run);
    click(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z), 10);
    expect(selections.at(-1)).toEqual({ kind: "bench", index: 0 });
    drag(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z), new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z), 11);
    expect(moves).toHaveLength(moveCount);
    expect(selections).toHaveLength(4);
    expect(JSON.stringify(run)).toBe(combatBefore);
    expect(moves.map(({ from, to }) => `${from.kind}->${to.kind}`)).toEqual([
      "bench->board",
      "board->board",
      "board->bench",
      "bench->bench",
    ]);
    // Enemy inspection also works during combat, but a pan gesture is not a tap.
    click(enemyPoint, 12);
    expect(inspected).toEqual(["enemy-preview", "enemy-preview"]);
    const enemyClient = clientPointForWorld(enemyPoint, camera, rect);
    canvas.dispatchPointer("pointerdown", enemyClient.clientX, enemyClient.clientY, 13);
    canvas.dispatchPointer("pointermove", enemyClient.clientX + 8, enemyClient.clientY, 13);
    canvas.dispatchPointer("pointerup", enemyClient.clientX + 8, enemyClient.clientY, 13);
    expect(inspected).toHaveLength(2);

    controller.dispose();
    expect(clearHighlights).toHaveBeenCalled();
    tiles.geometry.dispose();
    (tiles.material as THREE.Material).dispose();
    playerRoot.geometry.dispose();
    (playerRoot.material as THREE.Material).dispose();
    otherRoot.geometry.dispose();
    (otherRoot.material as THREE.Material).dispose();
    enemyRoot.geometry.dispose();
    (enemyRoot.material as THREE.Material).dispose();
  });

  it("clears previews/highlights across pointer lifecycle and paints invalid move feedback from move()", () => {
    vi.useFakeTimers();
    const windowListeners = new Map<string, Set<EventListener>>();
    vi.stubGlobal("window", {
      addEventListener(type: string, listener: EventListener) {
        const listeners = windowListeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        windowListeners.set(type, listeners);
      },
      removeEventListener(type: string, listener: EventListener) {
        windowListeners.get(type)?.delete(listener);
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
    });
    vi.stubGlobal("DOMRect", class {
      left: number; top: number; right: number; bottom: number; width: number; height: number; x: number; y: number;
      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = this.left = x;
        this.y = this.top = y;
        this.width = width;
        this.height = height;
        this.right = x + width;
        this.bottom = y + height;
      }
    });

    const bridge = createBridge(storage());
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(bridge.buy(0)).toBe(true);
    const uid = run.bench[0]!.uid;
    const rect = makeRect(80, 45, 980, 720);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect);
    const tiles = makeLogicalTiles();
    const scene = new THREE.Scene();
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.72), new THREE.MeshBasicMaterial());
    root.userData.uid = uid;
    scene.add(root);
    const bench = benchPerimeter("solo").map((cell) => cellToWorld(cell, "solo"));
    placeRoot(root, bench[0]!.x, bench[0]!.z, scene);
    const boardView = {
      forEach(fn: (id: string, visual: { root: THREE.Object3D }, kind: "board" | "bench" | "enemy") => void) {
        fn(uid, { root }, "bench");
      },
      visual(id: string) {
        return id === uid ? { root } : undefined;
      },
      setHovered: vi.fn(),
      slot(id: string) {
        return id === uid ? { kind: "bench", col: 0, row: 0 } : undefined;
      },
    };
    const setHighlights = vi.fn();
    const clearHighlights = vi.fn();
    const setBenchHighlights = vi.fn();
    const clearBenchHighlights = vi.fn();
    let renderFrame: (dt: number) => void = () => {};
    const stage = {
      renderer: { domElement: canvas },
      camera,
      arena: { tiles, setHighlights, clearHighlights, setBenchHighlights, clearBenchHighlights },
      scene,
      onFrame(callback: (dt: number) => void) { renderFrame = callback; return () => { renderFrame = () => {}; }; },
    };
    const preview = vi.fn();
    const previewEnd = vi.fn();
    const move = vi.fn(() => false);
    let enabled = true;
    const controller = createPlanningDragController({
      stage: stage as never,
      board: boardView as never,
      getRun: () => run,
      move,
      preview,
      previewEnd,
      enabled: () => enabled,
    });
    // Highlights belong to arena tiles, not a second plane that can tint the river.
    const grassWorld = cellToWorld(toVisual(2, 2), "solo");
    const grassPoint = clientPointForWorld(new THREE.Vector3(grassWorld.x, TILE_HEIGHT, grassWorld.z), camera, rect);
    canvas.dispatchPointer("pointermove", grassPoint.clientX, grassPoint.clientY);
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([{ col: 2, row: 2, role: "hover" }]);

    const riverWorld = cellToWorld({ x: 5, z: 2 }, "solo");
    const riverPoint = clientPointForWorld(new THREE.Vector3(riverWorld.x, TILE_HEIGHT, riverWorld.z), camera, rect);
    canvas.dispatchPointer("pointermove", riverPoint.clientX, riverPoint.clientY);
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(setBenchHighlights.mock.calls.at(-1)?.[0]).toEqual([]);

    const benchPoint = clientPointForWorld(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z), camera, rect);
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(preview).toHaveBeenCalledWith({ kind: "bench", index: 0 }, expect.anything());
    expect(boardView.setHovered).toHaveBeenLastCalledWith(uid);
    expect(setBenchHighlights.mock.calls.at(-1)?.[0]).toEqual([{ index: 0, role: "hover" }]);
    canvas.dispatchPointer("pointerleave", benchPoint.clientX, benchPoint.clientY);
    expect(previewEnd).toHaveBeenCalledTimes(1);
    expect(clearBenchHighlights).toHaveBeenCalled();
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(uid);
    enabled = false;
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    enabled = true;
    run.phase = "COMBAT";
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    run.phase = "PLANNING";

    const previewCallsBeforeLongPress = preview.mock.calls.length;
    canvas.dispatchPointer("pointerdown", benchPoint.clientX, benchPoint.clientY, 7, "touch");
    vi.advanceTimersByTime(420);
    expect(preview).toHaveBeenCalledTimes(previewCallsBeforeLongPress + 1);
    const target = { col: 2, row: 1 };
    const targetWorld = cellToWorld(toVisual(target.col, target.row), "solo");
    const targetPoint = clientPointForWorld(new THREE.Vector3(targetWorld.x, TILE_HEIGHT, targetWorld.z), camera, rect);
    canvas.dispatchPointer("pointermove", targetPoint.clientX, targetPoint.clientY, 7, "touch");
    renderFrame(0.1);
    expect(root.position.distanceTo(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z))).toBeGreaterThan(0.1);
    canvas.dispatchPointer("pointerup", targetPoint.clientX, targetPoint.clientY, 7, "touch");
    expect(move).toHaveBeenCalledWith(
      { kind: "bench", index: 0 },
      { kind: "board", index: target.row * 5 + target.col },
    );
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([{
      col: target.col,
      row: target.row,
      role: "invalid",
    }]);
    expect(root.position.distanceTo(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z))).toBeLessThan(1e-6);

    canvas.dispatchPointer("pointerdown", benchPoint.clientX, benchPoint.clientY, 8, "touch");
    canvas.dispatchPointer("pointermove", targetPoint.clientX, targetPoint.clientY, 8, "touch");
    renderFrame(0.1);
    expect(canvas.hasPointerCapture(8)).toBe(true);
    canvas.dispatchPointer("pointercancel", targetPoint.clientX, targetPoint.clientY, 8, "touch");
    expect(controller.targetState()).toBeNull();
    expect(root.position.distanceTo(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z))).toBeLessThan(1e-6);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    expect(canvas.hasPointerCapture(8)).toBe(false);

    canvas.dispatchPointer("pointerdown", benchPoint.clientX, benchPoint.clientY, 9, "touch");
    canvas.dispatchPointer("pointermove", targetPoint.clientX, targetPoint.clientY, 9, "touch");
    renderFrame(0.1);
    expect(canvas.hasPointerCapture(9)).toBe(true);
    canvas.releasePointerCapture(9);
    canvas.dispatchPointer("lostpointercapture", targetPoint.clientX, targetPoint.clientY, 9, "touch");
    expect(controller.targetState()).toBeNull();
    expect(root.position.distanceTo(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z))).toBeLessThan(1e-6);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);

    const previewCallsBeforeBlur = preview.mock.calls.length;
    const previewEndCallsBeforeBlur = previewEnd.mock.calls.length;
    placeRoot(root, bench[0]!.x, bench[0]!.z, scene);
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(preview).toHaveBeenCalledTimes(previewCallsBeforeBlur + 1);
    for (const listener of windowListeners.get("blur") ?? []) listener(new Event("blur"));
    expect(previewEnd).toHaveBeenCalledTimes(previewEndCallsBeforeBlur + 1);
    expect(clearHighlights).toHaveBeenCalled();
    expect(clearBenchHighlights).toHaveBeenCalled();

    const highlightCalls = setHighlights.mock.calls.length;
    controller.dispose();
    vi.advanceTimersByTime(1000);
    expect(setHighlights).toHaveBeenCalledTimes(highlightCalls);
    tiles.geometry.dispose();
    (tiles.material as THREE.Material).dispose();
    root.geometry.dispose();
    (root.material as THREE.Material).dispose();
  });
  it("resolves model and occupied-tile hover to the same UID and canonical highlights without changing game state", () => {
    vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {}, setTimeout: globalThis.setTimeout.bind(globalThis) });
    vi.stubGlobal("DOMRect", class {
      left: number; top: number; right: number; bottom: number; width: number; height: number; x: number; y: number;
      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = this.left = x;
        this.y = this.top = y;
        this.width = width;
        this.height = height;
        this.right = x + width;
        this.bottom = y + height;
      }
    });
    const bridge = createBridge(storage());
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(bridge.buy(0)).toBe(true);
    expect(bridge.buy(1)).toBe(true);
    const allyUid = run.bench[0]!.uid;
    const nextUid = run.bench[1]!.uid;
    expect(bridge.move({ kind: "bench", index: 0 }, { kind: "board", index: 6 })).toBe(true);
    expect(bridge.move({ kind: "bench", index: 0 }, { kind: "board", index: 7 })).toBe(true);
    const rect = makeRect(80, 45, 980, 720);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect);
    const tiles = makeLogicalTiles();
    const scene = new THREE.Scene();
    const roots = [allyUid, nextUid, "rendered-enemy"].map((uid) => {
      const root = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), new THREE.MeshBasicMaterial());
      root.userData.uid = uid;
      scene.add(root);
      return root;
    });
    const [allyRoot, nextRoot, enemyRoot] = roots;
    const allyWorld = cellToWorld(toVisual(1, 1), "solo");
    const nextWorld = cellToWorld(toVisual(2, 1), "solo");
    const enemyWorld = cellToWorld(toVisual(6, 2), "solo");
    placeRoot(allyRoot!, allyWorld.x, allyWorld.z, scene);
    placeRoot(nextRoot!, nextWorld.x, nextWorld.z, scene);
    placeRoot(enemyRoot!, enemyWorld.x, enemyWorld.z, scene);
    const slots = new Map([
      [allyUid, { kind: "board" as const, col: 1, row: 1 }],
      [nextUid, { kind: "board" as const, col: 2, row: 1 }],
      ["rendered-enemy", { kind: "enemy" as const, col: 6, row: 2 }],
    ]);
    const boardView = {
      forEach(fn: (uid: string, visual: { root: THREE.Object3D }, kind: "board" | "bench" | "enemy") => void) {
        roots.forEach((root, i) => fn(root!.userData.uid as string, { root: root! }, i === 2 ? "enemy" : "board"));
      },
      slot: (uid: string) => slots.get(uid),
      visual: (uid: string) => roots.find((root) => root!.userData.uid === uid),
      setHovered: vi.fn(),
    };
    const setHighlights = vi.fn();
    const setBenchHighlights = vi.fn();
    const preview = vi.fn();
    const previewEnd = vi.fn();
    const move = vi.fn();
    const select = vi.fn();
    const stage = {
      renderer: { domElement: canvas },
      camera,
      arena: { tiles, setHighlights, setBenchHighlights, clearHighlights: vi.fn(), clearBenchHighlights: vi.fn() },
      scene,
    };
    const controller = createPlanningDragController({
      stage: stage as never, board: boardView as never, getRun: () => run,
      enabled: () => true, move, select, preview, previewEnd,
    });
    const hover = (col: number, row: number, worldY = TILE_HEIGHT, dx = 0, dz = 0) => {
      const world = cellToWorld(toVisual(col, row), "solo");
      const point = clientPointForWorld(new THREE.Vector3(world.x + dx, worldY, world.z + dz), camera, rect);
      canvas.dispatchPointer("pointermove", point.clientX, point.clientY);
      return point;
    };
    const initial = JSON.stringify(run);
    hover(1, 1, 0.35);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(allyUid);
    expect(preview.mock.lastCall?.[0]).toEqual({ kind: "board", index: 6 });
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 1, row: 1, role: "hover" }]);
    // Move to a tile edge outside the narrow body: occupied-cell fallback matches model hover.
    hover(1, 1, TILE_HEIGHT, 0.32);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(allyUid);
    expect(preview.mock.lastCall?.[0]).toEqual({ kind: "board", index: 6 });
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 1, row: 1, role: "hover" }]);
    hover(2, 1, TILE_HEIGHT, 0.32);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(nextUid);
    expect(preview.mock.lastCall?.[0]).toEqual({ kind: "board", index: 7 });
    hover(6, 2, 0.35);
    expect(boardView.setHovered).toHaveBeenLastCalledWith("rendered-enemy");
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 6, row: 2, role: "hover" }]);
    hover(6, 2, TILE_HEIGHT, 0.32);
    expect(boardView.setHovered).toHaveBeenLastCalledWith("rendered-enemy");
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 6, row: 2, role: "hover" }]);
    // The model ray wins even when the model projects over a different occupied tile.
    placeRoot(allyRoot!, nextWorld.x, nextWorld.z, scene);
    placeRoot(nextRoot!, allyWorld.x - 1, allyWorld.z, scene);
    hover(2, 1, 0.35);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(allyUid);
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 1, row: 1, role: "hover" }]);
    hover(3, 1);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    expect(setHighlights.mock.lastCall?.[0]).toEqual([{ col: 3, row: 1, role: "hover" }]);
    const river = cellToWorld({ x: 5, z: 2 }, "solo");
    const riverPoint = clientPointForWorld(new THREE.Vector3(river.x, TILE_HEIGHT, river.z), camera, rect);
    canvas.dispatchPointer("pointermove", riverPoint.clientX, riverPoint.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    expect(setHighlights.mock.lastCall?.[0]).toEqual([]);
    const exit = hover(1, 1, TILE_HEIGHT, 0.32);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(allyUid);
    canvas.dispatchPointer("pointerleave", exit.clientX, exit.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    expect(previewEnd).toHaveBeenCalled();
    canvas.dispatchPointer("pointermove", exit.clientX, exit.clientY);
    canvas.dispatchPointer("pointercancel", exit.clientX, exit.clientY);
    expect(boardView.setHovered).toHaveBeenLastCalledWith(null);
    expect(JSON.stringify(run)).toBe(initial);
    expect(move).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    controller.dispose();
    tiles.geometry.dispose();
    (tiles.material as THREE.Material).dispose();
    roots.forEach((root) => {
      root!.geometry.dispose();
      (root!.material as THREE.Material).dispose();
    });
  });
});
