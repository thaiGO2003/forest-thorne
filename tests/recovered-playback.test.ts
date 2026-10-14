import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { NORMAL_UNITS } from "../src/content/catalog";
import { stageBasicCombatEvent } from "../src/core/combatStaging";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function playback(events: CombatEvent[]) {
  const melee = NORMAL_UNITS.find((unit) => unit.basic.delivery === "melee")!;
  const roster: RosterEntry[] = ["a", "b"].map((uid) => ({ uid, baseId: melee.id, star: 1, side: uid === "a" ? "L" : "R", hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield: 0 }));
  const live = new Map<string, number>();
  const impacts = new Map<string, () => void>();
  const visuals = new Map(roster.map((unit) => [unit.uid, {
    id: unit.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
    play: vi.fn((state: string, opts?: { onImpact?: () => void }) => {
      if (state === "attack" && opts?.onImpact) impacts.set(unit.uid, opts.onImpact);
    }),
    state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), revive: vi.fn(), die: vi.fn(), update: vi.fn(), dispose: vi.fn(),
  } as UnitVisual]));
  const board: BoardView = {
    sync() {},
    visual: (uid) => visuals.get(uid),
    slot: (uid) => uid === "a"
      ? { kind: "board", col: 3, row: 2 }
      : uid === "b" ? { kind: "enemy", col: 5, row: 2 } : undefined,
    cellCenter: (col, row) => ({ x: col * 2, z: row * 2 }),
    forEach() {},
    setLive: (uid, state) => { if (state.hp !== undefined) live.set(uid, state.hp); },
    setCombat() {},
    startLowCortisol() {},
    stopLowCortisol() {},
    dispose() {},
  };
  const fx: CombatFx = { float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  const cycles: number[] = [];
  let frame: (dt: number) => void = () => {};
  const off = vi.fn();
  const player = playCombat({ board, fx, roster, events, onFrame: (callback) => { frame = callback; return off; }, onTick: (tick) => { cycles.push(tick.cycle); } });
  const advance = (milliseconds: number) => { for (let left = milliseconds; left > 0; left -= 5) frame(Math.min(5, left) / 1000); };
  frame(0);
  return { player, live, advance, off, actor: roster[0], impact: (uid: string) => impacts.get(uid), cycles };
}

describe("recovered combat presentation", () => {
  it("applies melee HP only at the authored rig impact, then consumes reflect damage", async () => {
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, advance, actor, impact } = playback([event, { t: "reflect", src: "b", dst: "a", dmg: 7, absorbed: 0 }]);
    const timing = stageBasicCombatEvent(event, actor, 0).timing;
    advance(timing.approachMs);
    expect(live.has("b")).toBe(false);
    const onImpact = impact("a");
    expect(onImpact).toBeTypeOf("function");
    onImpact!();
    expect(live.get("b")).toBe(80);
    onImpact!();
    expect(live.get("b")).toBe(80);
    advance(timing.totalMs + 1000);
    await player.done;
    expect(live.get("a")).toBe(93);
    player.dispose();
  });

  it("cancels pending authored impact callbacks and removes the frame hook on teardown", async () => {
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, advance, off, actor, impact } = playback([event]);
    advance(stageBasicCombatEvent(event, actor, 0).timing.approachMs);
    const staleImpact = impact("a");
    expect(staleImpact).toBeTypeOf("function");
    player.dispose(); player.dispose();
    staleImpact!();
    advance(5000);
    await player.done;
    expect(live.size).toBe(0);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("reports simulator-authored combat cycles instead of a hardcoded HUD cycle", () => {
    const { player, cycles } = playback([{ t: "cycle", cycle: 3 }]);
    expect(cycles.at(-1)).toBe(3);
    player.dispose();
  });
});
