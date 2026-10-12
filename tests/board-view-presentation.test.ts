import { describe, expect, it, vi } from "vitest";
import { NORMAL_UNITS } from "../src/content/catalog";
import type { RunState } from "../src/core/run";
import { createBoardView, LOW_CORTISOL_DURATION_MS } from "../src/units/boardView";

vi.mock("../src/units/registry", () => ({
  createUnit: vi.fn((id: string, star: number) => {
    const root = {
      userData: {} as Record<string, unknown>,
      position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
      rotation: { y: 0 },
    };
    return {
      id,
      star,
      root,
      anchor: {},
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

vi.mock("../src/units/billboard", () => ({
  createBillboard: () => ({
    set: vi.fn(),
    setVisible: vi.fn(),
    dispose: vi.fn(),
  }),
}));

function runWithBench(uid = "bench-1"): RunState {
  const board = Array.from({ length: 25 }, () => null);
  return {
    board,
    bench: [{ uid, baseId: NORMAL_UNITS[0]!.id, star: 1 }],
    enemyPreview: [],
  } as unknown as RunState;
}

function stageHarness() {
  let frame: (dt: number) => void = () => {};
  const stage = {
    scene: { add: vi.fn() },
    arena: { setOccupied: vi.fn() },
    onFrame(callback: (dt: number) => void) {
      frame = callback;
      return vi.fn();
    },
  };
  return { stage: stage as never, advance: (seconds: number) => frame(seconds) };
}

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
    expect(visual.root.position.y).not.toBe(baseY);
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
    expect(visual.root.position.y).not.toBe(baseY);

    board.setCombat(true);
    expect(visual.root.position.y).toBe(baseY);
    expect(visual.root.rotation.y).toBe(baseYaw);

    board.dispose();
  });
});
