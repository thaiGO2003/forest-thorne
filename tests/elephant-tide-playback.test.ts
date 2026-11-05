import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function stageTideGuard(star: 1 | 2 | 3) {
  const targetUids = ["back", "column", "adjacent"].slice(0, star);
  const roster: RosterEntry[] = [
    { uid: "elephant", baseId: "elephant_guard", side: "L", star, hp: 500, maxHp: 500, rage: 0, rageMax: 5, shield: 0 },
    ...targetUids.map((uid) => ({
      uid, baseId: "ant_guard", side: "L" as const, star: 1, hp: 200, maxHp: 200, rage: 0, rageMax: 3, shield: 0,
    })),
  ];
  const events: CombatEvent[] = [
    { t: "cast", src: "elephant", targets: targetUids },
    ...targetUids.map((uid) => ({
      t: "tideGuard" as const, src: "elephant", dst: uid, delta: 60, active: true, removed: uid === "back" ? ["burn"] : [],
    })),
    { t: "cycle", cycle: 2 },
    ...targetUids.map((uid) => ({
      t: "tideGuard" as const, src: "elephant", dst: uid, delta: -60, active: false, removed: [],
    })),
  ];
  const skillWindows: Array<{ onImpact?: () => void; onDone?: () => void }> = [];
  const visuals = new Map(roster.map((unit) => {
    const visual: UnitVisual = {
      id: unit.baseId, star: unit.star as 1 | 2 | 3, root: new THREE.Group(), anchor: new THREE.Object3D(),
      play: vi.fn((state, options?: { onImpact?: () => void; onDone?: () => void }) => {
        if (state === "skill" && options) skillWindows.push(options);
      }),
      state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(),
      revive: vi.fn(), die: vi.fn(), update() {}, dispose: vi.fn(),
    };
    return [unit.uid, visual] as const;
  }));
  const live = new Map<string, Array<{ statuses: Array<{ key: string; positive: boolean }> }>>();
  const board: BoardView = {
    sync() {}, visual: (uid) => visuals.get(uid), slot: () => undefined,
    cellCenter: (col, row) => ({ x: col, z: row }), forEach() {},
    setLive: (uid, state) => {
      const frames = live.get(uid) ?? [];
      frames.push({ statuses: (state.statuses ?? []).map((status) => ({ key: status.key, positive: status.positive })) });
      live.set(uid, frames);
    },
    setCombat() {}, startLowCortisol() {}, stopLowCortisol() {}, setHovered() {}, dispose() {},
    flashTile: vi.fn(), flashSkill: vi.fn(),
  };
  const fx: CombatFx = {
    float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn(),
  };
  const seen: CombatEvent[] = [];
  let frame: (seconds: number) => void = () => {};
  const player = playCombat({
    board, fx, roster, events,
    onEvent: (event) => seen.push(event),
    onFrame: (cb) => { frame = cb; return () => {}; }, onTick() {},
  });
  return {
    player, frame, seen, fx, board, live, targetUids, skillWindows,
    advance: (ms: number) => { for (let t = 0; t < ms; t += 5) frame(0.005); },
  };
}

describe("Issue #110 — tide shield impact playback", () => {
  for (const star of [1, 2, 3] as const) {
    it(`${star}★ applies all allied shield and cleanse events at the trunk/whirlpool impact only once`, () => {
      const h = stageTideGuard(star);
      try {
        h.frame(0);
        expect(h.skillWindows).toHaveLength(1);
        expect(h.seen.filter((event) => event.t === "tideGuard")).toHaveLength(0);
        expect(h.fx.burst).not.toHaveBeenCalled();
        expect(h.live.get("back")).toBeUndefined();

        h.skillWindows[0]!.onImpact?.();
        const guards = h.seen.filter((event) => event.t === "tideGuard");
        expect(guards).toHaveLength(star);
        expect(guards.every((event) => event.active)).toBe(true);
        expect(h.fx.burst).toHaveBeenCalledTimes(star);
        expect(vi.mocked(h.fx.burst).mock.calls.every(([, color]) => color === 0x7ccff5)).toBe(true);
        for (const uid of h.targetUids) {
          const frames = h.live.get(uid)!;
          expect(frames.at(-1)!.statuses).toContainEqual({
            key: "elephantTideShield:elephant", positive: true,
          });
        }
        expect(vi.mocked(h.fx.float).mock.calls.some(([, label]) => label === "Thanh tẩy")).toBe(true);

        h.skillWindows[0]!.onImpact?.();
        expect(h.seen.filter((event) => event.t === "tideGuard")).toHaveLength(star);
        expect(h.fx.burst).toHaveBeenCalledTimes(star);

        h.skillWindows[0]!.onDone?.();
        h.advance(1400);
        const expired = h.seen.filter((event) => event.t === "tideGuard" && !event.active);
        expect(expired).toHaveLength(star);
        for (const uid of h.targetUids) {
          expect(h.live.get(uid)!.at(-1)!.statuses).not.toContainEqual({
            key: "elephantTideShield:elephant", positive: true,
          });
        }
        expect(h.fx.burst).toHaveBeenCalledTimes(star);
      } finally {
        h.player.dispose();
      }
    });
  }
});
