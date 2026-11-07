import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const kitMocks = vi.hoisted(() => ({
  label: vi.fn(),
}));

vi.mock("../src/ui/kit", () => ({
  LABEL: "#fff8ec",
  INK: "#27231f",
  SLICE: { shell_billboard: 1, tile_status: 1 },
  drawFit: vi.fn(),
  kitImage: vi.fn(() => ({})),
  label: kitMocks.label,
  nineSlice: vi.fn(),
  onKitReady: vi.fn(() => () => {}),
  threeSlice: vi.fn(),
}));

import { createBillboard } from "../src/units/billboard";

describe("billboard presentation", () => {
  let context: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    kitMocks.label.mockClear();
    context = {
      setTransform() {},
      clearRect() {},
      measureText: vi.fn(() => ({ width: 120 })),
      strokeText: vi.fn(),
      fillText: vi.fn(),
      fillRect() {},
      imageSmoothingEnabled: true,
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("document", {
      createElement: vi.fn((tag: string) => {
        expect(tag).toBe("canvas");
        return canvas;
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps HP above rage for both teams at rest and after a redraw", () => {
    for (const side of ["L", "R"] as const) {
      const anchor = new THREE.Object3D();
      const billboard = createBillboard(anchor);
      const base = {
        name: "Unit",
        star: 2,
        hp: 25,
        maxHp: 100,
        rage: 3,
        rageMax: 4,
        side,
        statuses: [],
      };
      billboard.set(base);
      for (const state of [base, { ...base, statuses: [{ key: "burn", positive: false }] }]) {
        billboard.set(state);
        const heartCall = kitMocks.label.mock.calls.find((call) => String(call[1]).includes("25%"));
        const rageCall = kitMocks.label.mock.calls.find((call) => String(call[1]) === "⚡ 3/4");
        expect(heartCall).toBeDefined();
        expect(rageCall).toBeDefined();
        expect(heartCall![3]).toBeLessThan(rageCall![3]);
        kitMocks.label.mockClear();
      }
      billboard.dispose();
    }
  });

  it("raises and restores sprite render order without replacing the billboard", () => {
    const anchor = new THREE.Object3D();
    const billboard = createBillboard(anchor);

    expect(billboard.sprite.renderOrder).toBe(10);
    billboard.setPriority(true);
    expect(billboard.sprite.renderOrder).toBe(20);
    billboard.setPriority(false);
    expect(billboard.sprite.renderOrder).toBe(10);

    billboard.dispose();
  });
});
