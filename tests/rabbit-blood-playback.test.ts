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
  const skillWindows: Array<{ onImpact?: () => void; onDone?: () => void }> = [];
  const visuals = new Map(roster.map((u) => {
    const visual: UnitVisual = {
      id: u.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
      play: vi.fn((state, opts?: { onImpact?: () => void; onDone?: () => void }) => {
        if (state === "skill" && opts) skillWindows.push(opts);
      }), state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), revive: vi.fn(), die: vi.fn(),
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
  for (let t = 0; t < 6000; t += 5) {
    frame(0.005);
    if (t === 1100) for (const window of skillWindows) window.onImpact?.();
    if (t === 1600) for (const window of skillWindows) window.onDone?.();
  }
  return { player, statuses, floats: vi.mocked(fx.float).mock.calls.map(([, text]) => text) };
}

describe("Huyết Thố oath playback", () => {
  it.each([
    [["poison"], ["burn", "immune"], 1],
    [["poison", "burn"], ["immune"], 2],
  ] as const)("shows and removes transient debuff suppression (case %i)", (suppressed, activeKeys, count) => {
    const h = harness([
      { t: "status", dst: "rabbit", kind: "poison", turns: 3 },
      { t: "status", dst: "rabbit", kind: "burn", turns: 3 },
      { t: "cast", src: "rabbit", targets: ["foe"] },
      { t: "oath", dst: "rabbit", suppressed: [...suppressed], active: true },
      { t: "skill", src: "rabbit", dst: "foe", dmg: 10, absorbed: 0, crit: false },
      { t: "oath", dst: "rabbit", suppressed: [...suppressed], active: false },
    ]);
    const keys = h.statuses.map((statuses) => statuses.map((status) => status.key).sort().join(","));
    expect(keys).toContain([...activeKeys].sort().join(","));
    expect(keys.at(-1)).toBe("burn,poison");
    expect(h.floats).toContain(`${ICONS.immune}${count}`);
    h.player.dispose();
  });
});
