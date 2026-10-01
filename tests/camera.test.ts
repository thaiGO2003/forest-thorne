import { describe, expect, it } from "vitest";
import { BASE_MAX_DISTANCE, DOLLY_HEADROOM, framingDistance, maxDistance, PAN, panStep, smoothstep } from "../src/world/camera";

describe("tactical camera (A91.1)", () => {
  it("dolly ceiling always covers framing + 5 and never drops below 50", () => {
    for (const p of ["solo", "coop2", "coop4"] as const) for (const a of [0.3, 0.55, 1, 2.2]) {
      expect(maxDistance(p, a)).toBeGreaterThanOrEqual(framingDistance(p, a) + DOLLY_HEADROOM);
      expect(maxDistance(p, a)).toBeGreaterThanOrEqual(BASE_MAX_DISTANCE);
    }
    // co-op needs more room than solo; narrow aspects clamp at 0.55
    expect(framingDistance("coop4", 1)).toBeGreaterThan(framingDistance("solo", 1));
    expect(framingDistance("solo", 0.2)).toBe(framingDistance("solo", 0.55));
  });

  it("smoothstep clamps and hits endpoints", () => {
    expect([smoothstep(-1), smoothstep(0), smoothstep(0.5), smoothstep(1), smoothstep(3)]).toEqual([0, 0, 0.5, 1, 1]);
  });

  it("pan: deadzone, normalized diagonal, dt cap, clamp", () => {
    expect(panStep(0, 0, 0.01, 0.01, 1)).toEqual({ x: 0, z: 0 });
    const d = panStep(0, 0, 1, 1, 0.05);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(PAN.speed * 0.05);
    expect(panStep(0, 0, 1, 0, 10)).toEqual(panStep(0, 0, 1, 0, 0.05));
    expect(panStep(23.9, -23.9, 1, -1, 0.05)).toEqual({ x: 24, z: -24 });
    expect(panStep(1, 1, 1, 0, -0.1)).toEqual({ x: 1, z: 1 });
  });
});
