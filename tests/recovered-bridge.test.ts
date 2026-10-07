import { describe, expect, it } from "vitest";
import { createBridge } from "../src/app/bridge";
import { inspectSave, saveRun, PROGRESS_KEY } from "../src/core/save";
import { buy, benchToBoard } from "../src/core/run";
import type { KV } from "../src/core/settings";

function storage(): KV {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
function deployed() {
  const store = storage(), bridge = createBridge(store);
  const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
  expect(buy(run, 0)).toBe(true);
  expect(benchToBoard(run, 0, 12)).toBe(true);
  bridge.checkpoint("SHOP", "Mua và triển khai tướng");
  return { store, bridge, run };
}

describe("recovered application bridge", () => {
  it("drops the active in-memory run without overwriting newly imported progress", () => {
    const { store, bridge } = deployed();
    const imported = createBridge(storage());
    const replacement = imported.newRun("EndlessPvEClassic", "EASY");
    saveRun(store, { player: replacement });
    const before = store.getItem(PROGRESS_KEY);
    bridge.forgetRun();
    bridge.checkpoint("EVENT", "Đóng cài đặt");
    expect(bridge.run()).toBeNull();
    expect(store.getItem(PROGRESS_KEY)).toBe(before);
    expect(replacement.aiMode).toBe("EASY");
  });
  it("persists newer HUD mutations and structured history through one checkpoint", () => {
    const { store, bridge, run } = deployed();
    const inspection = inspectSave(store);
    expect(inspection.status).toBe("valid");
    if (inspection.status !== "valid") throw new Error("save missing");
    expect(inspection.envelope.payload.player?.board[12]?.uid).toBe(run.board[12]?.uid);
    expect(bridge.history().entries.at(-1)?.category).toBe("SHOP");
    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.board[12]?.uid).toBe(run.board[12]?.uid);
  });

  it("replays an interrupted combat without paying its rewards twice", () => {
    const { store, bridge } = deployed();
    const original = bridge.startCombat();
    expect(original).not.toBeNull();
    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.phase).toBe("PLANNING");
    const replay = resumed.startCombat();
    expect(replay?.events).toEqual(original?.events);
    expect(replay?.finish()).not.toBeNull();
    const after = JSON.stringify(resumed.run());
    expect(replay?.finish()).toBeNull();
    expect(JSON.stringify(resumed.run())).toBe(after);
    expect(resumed.run()?.round).toBe(2);
  });

  it("does not publish a completed session after the player starts a different run", () => {
    const { bridge } = deployed();
    const session = bridge.startCombat();
    const replacement = bridge.newRun("EndlessPvEClassic", "EASY");
    const before = JSON.stringify(replacement);
    expect(session?.finish()).toBeNull();
    expect(JSON.stringify(bridge.run())).toBe(before);
  });

  it("prepares and persists the enemy preview while still in Planning", () => {
    const store = storage();
    const bridge = createBridge(store);
    const run = bridge.newRun("EndlessPvEClassic", "MEDIUM");
    expect(run.enemyPreview).toEqual([]);

    const preview = bridge.prepareEnemyPreview();
    expect(preview?.units.length).toBeGreaterThan(0);
    expect(run.phase).toBe("PLANNING");
    expect(run.enemyPreview).toEqual(preview?.units);

    const resumed = createBridge(store);
    expect(resumed.continueRun()).toBe(true);
    expect(resumed.run()?.enemyPreview).toEqual(preview?.units);
    expect(resumed.prepareEnemyPreview()?.source).toBe("saved");
  });

  it("rejects combat on an empty board without mutating the run", () => {
    const bridge = createBridge(storage());
    bridge.newRun("EndlessPvEClassic", "MEDIUM");
    const before = JSON.stringify(bridge.run());
    expect(bridge.startCombat()).toBeNull();
    expect(JSON.stringify(bridge.run())).toBe(before);
  });
});
