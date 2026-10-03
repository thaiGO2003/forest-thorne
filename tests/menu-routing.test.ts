import { describe, expect, it } from "vitest";
import { resolveContinueRoute, resolveNewRunRoute } from "../src/core/menuRouting";
import { createModeRun, createRun } from "../src/core/run";

describe("menu routes A116", () => {
  it("gates locked New Game ids and resolves allowed difficulty before routing", () => {
    expect(resolveNewRunRoute("EndlessPvEFortress", "HARD")).toEqual({
      kind: "blocked", reason: "unavailable", mode: "EndlessPvEFortress",
    });
    expect(resolveNewRunRoute("EndlessPvEClassic", "COOP4_HARD")).toMatchObject({
      kind: "route", destination: "planning", mode: "EndlessPvEClassic", aiMode: "TUTORIAL",
      forceNewRun: true, clearPriorRun: true,
    });
    expect(resolveNewRunRoute("unknown", "HARD")).toMatchObject({ mode: "EndlessPvEClassic", aiMode: "HARD" });
    expect(resolveNewRunRoute("EndlessPvEFortress", "HARD", { EndlessPvEFortress: true }))
      .toMatchObject({ destination: "fortress-map", aiMode: "HARD", forceNewRun: true, clearPriorRun: true });
    expect(resolveNewRunRoute("FortressPvP4", "HARD", { FortressPvP4: true }))
      .toMatchObject({ destination: "coop-lobby", aiMode: "COOP4_MEDIUM", requiredPlayerCapacity: 4, clearPriorRun: false });
  });

  it("Continue preserves saved difficulty and splits enabled Fortress routes on pending node", () => {
    const run = createRun(1);
    run.aiMode = "HARD";
    expect(resolveContinueRoute(run)).toMatchObject({ destination: "planning", aiMode: "HARD", forceNewRun: false });
    expect(resolveContinueRoute(null)).toEqual({ kind: "blocked", reason: "missing" });
    const fortress = createModeRun(2, "EndlessPvEFortress");
    const before = JSON.stringify(fortress);
    expect(resolveContinueRoute(fortress)).toMatchObject({ kind: "blocked", reason: "unavailable" });
    expect(JSON.stringify(fortress)).toBe(before);
    expect(resolveContinueRoute(fortress, { EndlessPvEFortress: true })).toMatchObject({ destination: "fortress-map" });
    fortress.fortress.pendingNode = { nodeId: "pending", type: "pharmacy" };
    expect(resolveContinueRoute(fortress, { EndlessPvEFortress: true })).toMatchObject({ destination: "planning" });
    expect(resolveContinueRoute(createModeRun(3, "FortressPvP4"), { FortressPvP4: true }))
      .toMatchObject({ destination: "coop-lobby", requiredPlayerCapacity: 4 });
  });
});
