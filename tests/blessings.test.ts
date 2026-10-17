import { describe, expect, it } from "vitest";
import { materializeCombat, simulate, type Placement } from "../src/core/combat";
import { restoreHeartBlessing } from "../src/core/blessings";
import { migrate } from "../src/core/save";
import {
  consumeWeatherBlessings,
  createRun,
  enqueueWeatherBlessing,
  reorderWeatherBlessing,
} from "../src/core/run";

describe("ordered blessings", () => {
  it("keeps player order and consumes only the committed prefix", () => {
    const run = createRun(71);
    expect(enqueueWeatherBlessing(run, "weather_tide")).toBe(true);
    expect(enqueueWeatherBlessing(run, "weather_fire")).toBe(true);
    expect(enqueueWeatherBlessing(run, "weather_wind")).toBe(true);
    expect(reorderWeatherBlessing(run, 2, 0)).toBe(true);
    expect(run.blessingQueue).toEqual(["weather_wind", "weather_tide", "weather_fire"]);

    expect(consumeWeatherBlessings(run, ["weather_wind", "weather_tide"])).toBe(true);
    expect(run.blessingQueue).toEqual(["weather_fire"]);
    expect(consumeWeatherBlessings(run, ["weather_tide"])).toBe(false);
    expect(run.blessingQueue).toEqual(["weather_fire"]);
  });

  it("consumes exactly one queued weather blessing per surviving combat cycle", () => {
    const left: Placement[] = [{ uid: "left", baseId: "titan_earth", star: 1, row: 0, col: 4 }];
    const right: Placement[] = [{ uid: "right", baseId: "titan_earth", star: 1, row: 0, col: 5 }];
    const queue = ["weather_fire", "weather_tide", "weather_wind"] as const;
    const result = simulate(materializeCombat(left, right), { seed: 17, orderedBlessings: queue });
    const cycles = result.events.filter((event) => event.t === "cycle").length;

    expect(cycles).toBeGreaterThan(1);
    expect(result.consumedBlessings).toEqual(queue.slice(0, Math.min(queue.length, cycles)));
    expect(result.consumedBlessings[0]).toBe("weather_fire");
    expect(result.consumedBlessings[1]).toBe("weather_tide");
  });

  it("stops consuming once a first-cycle combat has ended", () => {
    const result = simulate(
      materializeCombat(
        [{ uid: "left", baseId: "bison_stampede", star: 3, row: 0, col: 4 }],
        [{ uid: "right", baseId: "salamander_flame", star: 1, row: 0, col: 5 }],
        { leftPersistent: { atkPct: 10000, matkPct: 10000, startRage: 5 } },
      ),
      { seed: 2, orderedBlessings: ["weather_stone", "weather_night"] },
    );
    const cycles = result.events.filter((event) => event.t === "cycle").length;

    expect(cycles).toBe(1);
    expect(result.consumedBlessings).toEqual(["weather_stone"]);
  });

  it("normalizes legacy and malformed persisted queues without reordering valid entries", () => {
    const withInvalid = createRun(72) as unknown as Record<string, unknown>;
    withInvalid.blessingQueue = ["weather_wind", "unknown_weather", 7, "weather_fire"];
    const migrated = migrate({ version: 4, payload: { player: withInvalid } });
    expect(migrated?.envelope.payload.player?.blessingQueue).toEqual(["weather_wind", "weather_fire"]);

    const { blessingQueue: _omitted, ...legacy } = createRun(73);
    const legacyMigrated = migrate({ version: 4, payload: { player: legacy } });
    expect(legacyMigrated?.envelope.payload.player?.blessingQueue).toEqual([]);
  });

  it("restores hearts up to mode maximum without touching combat escrow", () => {
    const run = createRun(74);
    const max = run.hp;
    run.hp = Math.max(0, max - 2);
    run.heartEscrow = 1;

    expect(restoreHeartBlessing(run, 1)).toBe(1);
    expect(run.hp).toBe(max - 1);
    expect(run.heartEscrow).toBe(1);
    expect(restoreHeartBlessing(run, 5)).toBe(1);
    expect(run.hp).toBe(max);
    expect(run.heartEscrow).toBe(1);
    expect(restoreHeartBlessing(run, 1)).toBe(0);
  });
});
