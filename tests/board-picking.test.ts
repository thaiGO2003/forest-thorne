import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { toVisual, type Profile } from "../src/board/geometry";
import { cellToWorld } from "../src/world/arena";
import { createBoardPickingController } from "../src/world/boardPicking";

const TILE_HEIGHT = 0.12;

class FakeCanvas {
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(private readonly rect: DOMRect) {}

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    let handlers = this.listeners.get(type);
    if (!handlers) {
      handlers = new Set<EventListener>();
      this.listeners.set(type, handlers);
    }
    handlers.add(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener === "function") this.listeners.get(type)?.delete(listener);
  }

  dispatchPointer(type: string, clientX: number, clientY: number, pointerType = "mouse"): void {
    const event = { clientX, clientY, pointerType } as PointerEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
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

function makeCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 100);
  camera.position.set(8.5, 10.5, 9.5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

function makeLogicalTiles(profile: Profile): THREE.InstancedMesh {
  const rows = profile === "solo" ? 5 : profile === "coop2" ? 10 : 20;
  const geometry = new THREE.BoxGeometry(0.96, TILE_HEIGHT, 0.96);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 10 * rows);
  const matrix = new THREE.Matrix4();
  let instance = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 10; col++) {
      const world = cellToWorld(toVisual(col, row), profile);
      mesh.setMatrixAt(instance++, matrix.makeTranslation(world.x, TILE_HEIGHT / 2, world.z));
    }
  }

  mesh.count = instance;
  mesh.updateMatrixWorld(true);
  return mesh;
}

function clientPointForWorld(
  world: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  rect: DOMRect,
): { clientX: number; clientY: number } {
  const ndc = world.clone().project(camera);
  return {
    clientX: rect.left + ((ndc.x + 1) / 2) * rect.width,
    clientY: rect.top + ((1 - ndc.y) / 2) * rect.height,
  };
}

describe("3D board picking controller (WBS-037)", () => {
  it("picks exact edge and centre cells through a rotated, tilted camera with offset canvas bounds", () => {
    const rect = makeRect(137, 83, 820, 610);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect.width / rect.height);
    const tiles = makeLogicalTiles("solo");
    const controller = createBoardPickingController(canvas as unknown as HTMLCanvasElement, camera, tiles, "solo");

    for (const cell of [{ col: 0, row: 0 }, { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 9, row: 4 }]) {
      const world = cellToWorld(toVisual(cell.col, cell.row), "solo");
      const client = clientPointForWorld(new THREE.Vector3(world.x, TILE_HEIGHT, world.z), camera, rect);
      expect(controller.pick(client.clientX, client.clientY)).toEqual({ kind: "cell", cell });
    }

    controller.dispose();
    tiles.geometry.dispose();
    (tiles.material as THREE.Material).dispose();
  });

  it("rejects river geometry after raycasting instead of mapping it to a neighbouring logical cell", () => {
    const rect = makeRect(25, 40, 700, 500);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect.width / rect.height);
    const geometry = new THREE.BoxGeometry(0.96, TILE_HEIGHT, 0.96);
    const material = new THREE.MeshBasicMaterial();
    const river = new THREE.InstancedMesh(geometry, material, 1);
    const rowWorld = cellToWorld({ x: 5, z: 2 }, "solo");
    river.setMatrixAt(0, new THREE.Matrix4().makeTranslation(rowWorld.x, TILE_HEIGHT / 2, rowWorld.z));
    river.updateMatrixWorld(true);

    const controller = createBoardPickingController(canvas as unknown as HTMLCanvasElement, camera, river, "solo");
    const client = clientPointForWorld(new THREE.Vector3(rowWorld.x, TILE_HEIGHT, rowWorld.z), camera, rect);

    expect(controller.pick(client.clientX, client.clientY)).toEqual({ kind: "none", cell: null });

    controller.dispose();
    geometry.dispose();
    material.dispose();
  });

  it("uses PointerEvent client coordinates for touch and removes all listeners on dispose", () => {
    const rect = makeRect(91, 57, 760, 540);
    const canvas = new FakeCanvas(rect);
    const camera = makeCamera(rect.width / rect.height);
    const tiles = makeLogicalTiles("solo");
    const controller = createBoardPickingController(canvas as unknown as HTMLCanvasElement, camera, tiles, "solo");
    const world = cellToWorld(toVisual(3, 1), "solo");
    const client = clientPointForWorld(new THREE.Vector3(world.x, TILE_HEIGHT, world.z), camera, rect);

    canvas.dispatchPointer("pointerdown", client.clientX, client.clientY, "touch");
    expect(controller.state).toEqual({ kind: "cell", cell: { col: 3, row: 1 } });

    canvas.dispatchPointer("pointerleave", client.clientX, client.clientY, "touch");
    expect(controller.state).toEqual({ kind: "none", cell: null });

    expect(canvas.listenerCount("pointermove")).toBe(1);
    expect(canvas.listenerCount("pointerdown")).toBe(1);
    expect(canvas.listenerCount("pointerleave")).toBe(1);
    expect(canvas.listenerCount("pointercancel")).toBe(1);

    controller.dispose();

    expect(canvas.listenerCount("pointermove")).toBe(0);
    expect(canvas.listenerCount("pointerdown")).toBe(0);
    expect(canvas.listenerCount("pointerleave")).toBe(0);
    expect(canvas.listenerCount("pointercancel")).toBe(0);

    tiles.geometry.dispose();
    (tiles.material as THREE.Material).dispose();
  });
});
