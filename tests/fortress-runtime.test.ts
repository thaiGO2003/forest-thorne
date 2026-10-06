import { describe, expect, it, vi } from "vitest";
import {
  completeAndPersistFortressNode,
  enterFortressRun,
  fortressRuntimeRoute,
  recruitAndPersistFortressBeast,
  resolveAndPersistFortressPharmacy,
  selectAndPersistFortressNode,
} from "../src/core/fortressRuntime";
import { createModeRun, createRun } from "../src/core/run";
import { inspectSave, PROGRESS_KEY, saveRun } from "../src/core/save";

function mem() {
  const m: Record<string, string> = {};
  return {
    m,
    getItem: (key: string) => (key in m ? m[key]! : null),
    setItem: vi.fn((key: string, value: string) => { m[key] = value; }),
    removeItem: vi.fn((key: string) => { delete m[key]; }),
  };
}

describe("Fortress production persistence owner", () => {
  it("replaces a wrong-mode save with configured deterministic Fortress state and persists before map routing", () => {
    const store = mem();
    saveRun(store, { player: createRun(3) });
    store.setItem.mockClear();
    store.removeItem.mockClear();

    const entry = enterFortressRun(store, { seed: 41 });
    const expected = createModeRun(41, "EndlessPvEFortress");

    expect(entry.route).toBe("map");
    expect([
      entry.run.mode,
      entry.run.phase,
      entry.run.hp,
      entry.run.gold,
      entry.run.lossCondition,
      entry.run.aiMode,
    ]).toEqual(["EndlessPvEFortress", "PLANNING", 100, 10, "NO_HEARTS", "MEDIUM"]);
    expect(entry.run.fortress.graph).toEqual(expected.fortress.graph);
    expect(store.removeItem).toHaveBeenCalledWith(PROGRESS_KEY);
    expect(store.setItem).toHaveBeenCalledTimes(1);

    const saved = inspectSave(store);
    expect(saved.status).toBe("valid");
    if (saved.status !== "valid") throw new Error(saved.status);
    expect(saved.envelope.payload.player?.mode).toBe("EndlessPvEFortress");
    expect(saved.envelope.payload.player?.fortress.graph).toEqual(expected.fortress.graph);
  });

  it("resumes an already-pending node in Planning and rejects a second selection without another write", () => {
    const store = mem();
    const first = enterFortressRun(store, { seed: 57 });
    const chosen = first.run.fortress.graph.layers[0]!.find((node) => node.type === "beast_den")!;
    expect(selectAndPersistFortressNode(store, first.run, chosen.id)).toBe(true);

    first.run.phase = "COMBAT";
    saveRun(store, { player: first.run });

    const resumed = enterFortressRun(store, { seed: 999 });
    expect(resumed.route).toBe("planning");
    expect(resumed.run.phase).toBe("PLANNING");
    expect(resumed.run.fortress.pendingNode?.nodeId).toBe(chosen.id);

    const writes = store.setItem.mock.calls.length;
    const other = resumed.run.fortress.graph.layers[0]!.find((node) => node.id !== chosen.id)!;
    expect(selectAndPersistFortressNode(store, resumed.run, other.id)).toBe(false);
    expect(store.setItem).toHaveBeenCalledTimes(writes);
  });

  it("persists a one-shot Beast Den result, survives reload, and gates completion until service resolution", () => {
    const store = mem();
    const entry = enterFortressRun(store, { seed: 71 });
    const beast = entry.run.fortress.graph.layers[0]!.find((node) => node.type === "beast_den")!;
    expect(selectAndPersistFortressNode(store, entry.run, beast.id)).toBe(true);

    let writes = store.setItem.mock.calls.length;
    expect(completeAndPersistFortressNode(store, entry.run)).toBe(false);
    expect(store.setItem).toHaveBeenCalledTimes(writes);

    const offer = entry.run.fortress.pendingNode!.serviceOffers![0]!;
    expect(recruitAndPersistFortressBeast(store, entry.run, offer)).toBe(true);
    expect(entry.run.bench.some((unit) => unit.baseId === offer)).toBe(true);

    writes = store.setItem.mock.calls.length;
    expect(recruitAndPersistFortressBeast(store, entry.run, offer)).toBe(false);
    expect(store.setItem).toHaveBeenCalledTimes(writes);

    const resumed = enterFortressRun(store, { seed: 999 });
    expect(resumed.run.fortress.pendingNode?.serviceResult).toMatchObject({
      kind: "beast_den",
      baseId: offer,
    });
    expect(resumed.run.bench.some((unit) => unit.baseId === offer)).toBe(true);

    expect(completeAndPersistFortressNode(store, resumed.run)).toBe(true);
    expect(resumed.run.fortress.pendingNode).toBeNull();
    expect(fortressRuntimeRoute(resumed.run)).toBe("map");

    writes = store.setItem.mock.calls.length;
    expect(completeAndPersistFortressNode(store, resumed.run)).toBe(false);
    expect(store.setItem).toHaveBeenCalledTimes(writes);
  });

  it("persists Pharmacy service metadata before allowing route completion", () => {
    const store = mem();
    const entry = enterFortressRun(store, { seed: 83 });
    const firstBattle = entry.run.fortress.graph.layers[0]!.find((node) => node.type === "battle")!;
    expect(selectAndPersistFortressNode(store, entry.run, firstBattle.id)).toBe(true);
    expect(completeAndPersistFortressNode(store, entry.run)).toBe(true);

    const pharmacy = entry.run.fortress.graph.layers[1]!.find((node) => node.type === "pharmacy")!;
    expect(selectAndPersistFortressNode(store, entry.run, pharmacy.id)).toBe(true);
    expect(completeAndPersistFortressNode(store, entry.run)).toBe(false);

    const result = resolveAndPersistFortressPharmacy(store, entry.run, "skip");
    expect(result).toEqual({
      kind: "pharmacy",
      optionId: "skip",
      hpDelta: 0,
      goldDelta: 0,
      xpDelta: 0,
      levelsGained: 0,
    });

    const saved = inspectSave(store);
    expect(saved.status).toBe("valid");
    if (saved.status !== "valid") throw new Error(saved.status);
    expect(saved.envelope.payload.player?.fortress.pendingNode?.serviceResult).toEqual(result);

    expect(completeAndPersistFortressNode(store, entry.run)).toBe(true);
    expect(entry.run.fortress.stepIndex).toBe(2);
  });
});
