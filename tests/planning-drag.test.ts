import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { benchPerimeter, toVisual } from "../src/board/geometry";
import { createBridge } from "../src/app/bridge";
import { createPlanningDragController } from "../src/app/planningDrag";
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
    };

    const setHighlights = vi.fn();
    const clearHighlights = vi.fn();
    const setBenchHighlights = vi.fn();
    const clearBenchHighlights = vi.fn();
    const stage = {
      renderer: { domElement: canvas },
      camera,
      arena: { tiles, setHighlights, clearHighlights, setBenchHighlights, clearBenchHighlights },
      scene,
    };

    const moves: Array<{ from: { kind: "bench" | "board"; index: number }; to: { kind: "bench" | "board"; index: number } }> = [];
    const selections: Array<{ kind: "bench" | "board"; index: number }> = [];
    const controller = createPlanningDragController({
      stage: stage as never,
      board: boardView as never,
      getRun: () => bridge.run(),
      move: (from, to) => {
        moves.push({ from, to });
        return bridge.move(from, to);
      },
      select: (source) => { selections.push(source); },
      enabled: () => true,
    });

    const drag = (from: THREE.Vector3, to: THREE.Vector3, pointerId: number, pointerType = "mouse") => {
      const start = clientPointForWorld(from, camera, rect);
      const end = clientPointForWorld(to, camera, rect);
      canvas.dispatchPointer("pointerdown", start.clientX, start.clientY, pointerId, pointerType);
      canvas.dispatchPointer("pointermove", end.clientX, end.clientY, pointerId, pointerType);
      canvas.dispatchPointer("pointerup", end.clientX, end.clientY, pointerId, pointerType);
    };
    const click = (point: THREE.Vector3, pointerId: number) => {
      const target = clientPointForWorld(point, camera, rect);
      canvas.dispatchPointer("pointerdown", target.clientX, target.clientY, pointerId);
      canvas.dispatchPointer("pointerup", target.clientX, target.clientY, pointerId);
    };

    const boardA = { col: 1, row: 1 };
    const boardAWorld = cellToWorld(toVisual(boardA.col, boardA.row), "solo");
    drag(
      new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z),
      new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z),
      1,
      "touch",
    );
    const boardAIndex = boardA.row * 5 + boardA.col;
    expect(run.board[boardAIndex]?.uid).toBe(playerUid);
    expect(setHighlights.mock.calls.at(-1)?.[0]).toEqual([{
      col: boardA.col,
      row: boardA.row,
      role: "valid",
    }]);
    expect(selections).toEqual([]);
    expect(run.bench[0]?.uid).toBe(otherUid);

    placeRoot(playerRoot, boardAWorld.x, boardAWorld.z, scene);
    click(new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z), 6);
    expect(selections).toEqual([{ kind: "board", index: boardAIndex }]);
    const boardB = { col: 3, row: 1 };
    const boardBWorld = cellToWorld(toVisual(boardB.col, boardB.row), "solo");
    drag(
      new THREE.Vector3(boardAWorld.x, TILE_HEIGHT, boardAWorld.z),
      new THREE.Vector3(boardBWorld.x, TILE_HEIGHT, boardBWorld.z),
      2,
    );
    const boardBIndex = boardB.row * 5 + boardB.col;
    expect(run.board[boardAIndex]).toBeNull();
    expect(run.board[boardBIndex]?.uid).toBe(playerUid);
    expect(selections).toHaveLength(1);

    placeRoot(playerRoot, boardBWorld.x, boardBWorld.z, scene);
    drag(
      new THREE.Vector3(boardBWorld.x, TILE_HEIGHT, boardBWorld.z),
      new THREE.Vector3(bench[1]!.x, TILE_HEIGHT, bench[1]!.z),
      3,
    );
    expect(run.board[boardBIndex]).toBeNull();
    expect(run.bench[1]?.uid).toBe(playerUid);

    placeRoot(playerRoot, bench[1]!.x, bench[1]!.z, scene);
    click(new THREE.Vector3(bench[1]!.x, TILE_HEIGHT, bench[1]!.z), 7);
    expect(selections).toEqual([
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
    click(enemyPoint, 8);
    expect(selections).toHaveLength(2);
    expect(moves.map(({ from, to }) => `${from.kind}->${to.kind}`)).toEqual([
      "bench->board",
      "board->board",
      "board->bench",
      "bench->bench",
    ]);

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
    };
    const setHighlights = vi.fn();
    const clearHighlights = vi.fn();
    const setBenchHighlights = vi.fn();
    const clearBenchHighlights = vi.fn();
    const stage = {
      renderer: { domElement: canvas },
      camera,
      arena: { tiles, setHighlights, clearHighlights, setBenchHighlights, clearBenchHighlights },
      scene,
    };
    const preview = vi.fn();
    const previewEnd = vi.fn();
    const move = vi.fn(() => false);
    const controller = createPlanningDragController({
      stage: stage as never,
      board: boardView as never,
      getRun: () => run,
      move,
      preview,
      previewEnd,
      enabled: () => true,
    });

    const benchPoint = clientPointForWorld(new THREE.Vector3(bench[0]!.x, TILE_HEIGHT, bench[0]!.z), camera, rect);
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(preview).toHaveBeenCalledWith({ kind: "bench", index: 0 }, expect.anything());
    expect(setBenchHighlights.mock.calls.at(-1)?.[0]).toEqual([{ index: 0, role: "hover" }]);
    canvas.dispatchPointer("pointerleave", benchPoint.clientX, benchPoint.clientY);
    expect(previewEnd).toHaveBeenCalledTimes(1);
    expect(clearBenchHighlights).toHaveBeenCalled();

    canvas.dispatchPointer("pointerdown", benchPoint.clientX, benchPoint.clientY, 7, "touch");
    vi.advanceTimersByTime(420);
    expect(preview).toHaveBeenCalledTimes(2);
    const target = { col: 2, row: 1 };
    const targetWorld = cellToWorld(toVisual(target.col, target.row), "solo");
    const targetPoint = clientPointForWorld(new THREE.Vector3(targetWorld.x, TILE_HEIGHT, targetWorld.z), camera, rect);
    canvas.dispatchPointer("pointermove", targetPoint.clientX, targetPoint.clientY, 7, "touch");
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

    placeRoot(root, bench[0]!.x, bench[0]!.z, scene);
    canvas.dispatchPointer("pointermove", benchPoint.clientX, benchPoint.clientY);
    expect(preview).toHaveBeenCalledTimes(3);
    for (const listener of windowListeners.get("blur") ?? []) listener(new Event("blur"));
    expect(previewEnd).toHaveBeenCalledTimes(3);
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
});
