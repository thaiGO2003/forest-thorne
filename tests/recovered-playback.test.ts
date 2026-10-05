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
  const visuals = new Map(roster.map((unit) => [unit.uid, {
    id: unit.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
    play: vi.fn(), state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), die: vi.fn(), update: vi.fn(), dispose: vi.fn(),
  } as UnitVisual]));
  const board: BoardView = { sync() {}, visual: (uid) => visuals.get(uid), forEach() {},
    setLive: (uid, state) => { if (state.hp !== undefined) live.set(uid, state.hp); }, setCombat() {}, dispose() {} };
  const fx: CombatFx = { float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  let frame: (dt: number) => void = () => {};
  const off = vi.fn();
  const player = playCombat({ board, fx, roster, events, onFrame: (callback) => { frame = callback; return off; }, onTick() {} });
  const advance = (milliseconds: number) => { for (let left = milliseconds; left > 0; left -= 5) frame(Math.min(5, left) / 1000); };
  frame(0);
  return { player, live, advance, off, actor: roster[0] };
}

describe("recovered combat presentation", () => {
  it("applies melee HP only at the current staging impact, then consumes reflect damage", async () => {
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, advance, actor } = playback([event, { t: "reflect", src: "b", dst: "a", dmg: 7, absorbed: 0 }]);
    const timing = stageBasicCombatEvent(event, actor, 0).timing;
    advance(timing.impactOffsetMs - 5);
    expect(live.has("b")).toBe(false);
    advance(10);
    expect(live.get("b")).toBe(80);
    advance(timing.totalMs + 1000);
    await player.done;
    expect(live.get("a")).toBe(93);
    player.dispose();
  });

  it("cancels pending impact callbacks and removes the frame hook on teardown", async () => {
    const { player, live, advance, off } = playback([{ t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false }]);
    player.dispose(); player.dispose();
    advance(5000);
    await player.done;
    expect(live.size).toBe(0);
    expect(off).toHaveBeenCalledTimes(1);
  });
});
