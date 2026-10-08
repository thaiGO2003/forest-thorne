import { describe, expect, it } from "vitest";
import { PerformanceProfiler, vfxBudgetMultiplier } from "../src/app/PerformanceProfiler";

describe("PerformanceProfiler", () => {
  it("degrades after sustained slow samples and reports the canonical budget", () => {
    const degraded: string[] = [];
    const profiler = new PerformanceProfiler({
      onDegrade: (quality) => degraded.push(quality),
    });
    let timestamp = 0;
    profiler.sample(timestamp);
    for (let i = 0; i < 30; i++) {
      timestamp += 40;
      profiler.sample(timestamp);
    }
    expect(profiler.getSnapshot()).toMatchObject({ quality: "medium", isThrottled: true });
    expect(degraded).toEqual(["medium"]);

    for (let i = 0; i < 30; i++) {
      timestamp += 40;
      profiler.sample(timestamp);
    }
    expect(profiler.getSnapshot().quality).toBe("low");
    expect(profiler.getVfxBudgetMultiplier()).toBeCloseTo(0.35);
    expect(vfxBudgetMultiplier("low", true)).toBeCloseTo(0.35);
  });

  it("clears throttling after 60 fast frames and recovers after 180", () => {
    const recovered: string[] = [];
    const profiler = new PerformanceProfiler({ quality: "low", onRecover: (quality) => recovered.push(quality) });
    let timestamp = 0;
    profiler.sample(timestamp, { drawCalls: 51 });
    timestamp += 16;
    profiler.sample(timestamp, { drawCalls: 51 });
    expect(profiler.getSnapshot().isThrottled).toBe(true);

    for (let i = 0; i < 180; i++) {
      timestamp += 10;
      profiler.sample(timestamp, { drawCalls: 0 });
    }
    expect(profiler.getSnapshot()).toMatchObject({ quality: "medium", isThrottled: false });
    expect(recovered).toEqual(["medium"]);
  });

  it("caps fps, clamps frame delta, resets counters on explicit quality and stops callbacks after dispose", () => {
    let degraded = 0;
    const profiler = new PerformanceProfiler({ onDegrade: () => { degraded++; } });
    profiler.sample(1);
    profiler.sample(1);
    expect(profiler.getSnapshot().fps).toBe(120);
    expect(profiler.getSnapshot().frameTimeMs).toBeGreaterThanOrEqual(0.1);

    for (let i = 0; i < 29; i++) profiler.sample(1 + (i + 1) * 100, { drawCalls: 99 });
    profiler.setQuality("high");
    profiler.dispose();
    for (let i = 0; i < 40; i++) profiler.sample(10_000 + i * 100, { drawCalls: 99 });
    expect(degraded).toBe(0);
  });
});
