import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BillboardStatus } from "../src/units/billboard";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";
import { ICONS } from "../src/core/emojiIcon";

/** Minimal board/fx doubles that record billboard statuses and floating texts. */
function harness(events: CombatEvent[]) {
  const roster: RosterEntry[] = [
    { uid: "rabbit", baseId: "rabbit_blood", star: 1, side: "L", hp: 100, maxHp: 100, rage: 0, rageMax: 2, shield: 0 },
    { uid: "foe", baseId: "ant_guard", star: 1, side: "R", hp: 100, maxHp: 100, rage: 0, rageMax: 2, shield: 0 },
  ];
  const visuals = new Map(roster.map((u) => {
    const visual: UnitVisual = {
      id: u.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
      play: vi.fn(), state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), revive: vi.fn(), die: vi.fn(),
      update() {}, dispose: vi.fn(),
    };
    return [u.uid, visual] as const;
  }));
  const statuses: BillboardStatus[][] = [];
  const board: BoardView = {
    sync() {}, visual: (uid) => visuals.get(uid), slot: () => undefined,
    cellCenter: (col, row) => ({ x: col, z: row }), forEach() {},
    setLive: (uid, s) => { if (uid === "rabbit" && s.statuses) statuses.push([...s.statuses]); },
    setCombat() {}, startLowCortisol() {}, stopLowCortisol() {}, setHovered() {}, dispose() {},
  };
  const fx: CombatFx = { float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  let frame: (dt: number) => void = () => {};
  const player = playCombat({ board, fx, roster, events, onFrame: (cb) => { frame = cb; return () => {}; }, onTick() {} });
  frame(0);
  for (let t = 0; t < 6000; t += 5) frame(0.005);
  return { player, statuses, floats: vi.mocked(fx.float).mock.calls.map(([, text]) => text) };
}

describe("Huyết Thố delayed-curse playback", () => {
  it("shows a lock badge while debuffs are held and floats the ones that come back", () => {
    const h = harness([
      { t: "status", dst: "rabbit", kind: "poison", turns: 3 },
      { t: "status", dst: "rabbit", kind: "poison", turns: 0 },
      { t: "curse", dst: "rabbit", locked: 2, released: [] },
      { t: "status", dst: "rabbit", kind: "poison", turns: 2 },
      { t: "curse", dst: "rabbit", locked: 1, released: ["poison"] },
      { t: "curse", dst: "rabbit", locked: 0, released: ["defDown"] },
    ]);
    const keys = h.statuses.map((s) => s.map((x) => x.key).join(","));
    expect(keys).toEqual(["poison", "", "lock", "poison,lock", "poison,lock", "poison"]);
    expect(h.floats).toEqual([`${ICONS.lock}2`, `${ICONS.unlock}${ICONS.poison}`, `${ICONS.unlock}${ICONS.defDown}`]);
    h.player.dispose();
  });
});
