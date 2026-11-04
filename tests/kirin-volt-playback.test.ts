import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function playback(
  star: 1 | 2 | 3,
  proc: boolean,
  aftermath: (index: number, dst: string) => CombatEvent[] = () => [],
  next: CombatEvent[] = [],
) {
  const roster: RosterEntry[] = [
    { uid: "kirin", baseId: "kirin_thunder", side: "L", star, hp: 500, maxHp: 500, rage: 0, rageMax: 3, shield: 0 },
    { uid: "primary", baseId: "ant_guard", side: "R", star: 1, hp: 500, maxHp: 500, rage: 0, rageMax: 3, shield: 0 },
    { uid: "neighbor", baseId: "ant_guard", side: "R", star: 1, hp: 500, maxHp: 500, rage: 0, rageMax: 3, shield: 0 },
  ];
  const events: CombatEvent[] = [{ t: "cast", src: "kirin", targets: ["primary", "neighbor"] }];
  for (let i = 0; i < star * 2; i++) {
    const dst = i % 2 ? "neighbor" : "primary";
    events.push({ t: "skill", src: "kirin", dst, dmg: 10, absorbed: 0, crit: false, kind: "horn" });
    if (proc && i === 0) events.push({
      t: "status", dst, kind: "paralyze", turns: 1,
      source: { skillId: "kirin_volt_horns", unitUid: "kirin", unitBaseId: "kirin_thunder", unitStar: star, turns: 1, value: 0 },
    });
    events.push(...aftermath(i, dst));
  }
  events.push(...next);
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
  const live: string[][] = [];
  const board: BoardView = {
    sync() {}, visual: (uid) => visuals.get(uid), slot: () => undefined,
    cellCenter: (col, row) => ({ x: col, z: row }), forEach() {},
    setLive: (uid, state) => {
      if (uid === "primary" && state.statuses) live.push(state.statuses.map((s) => s.key));
    },
    setCombat() {}, startLowCortisol() {}, stopLowCortisol() {},
    setHovered() {}, dispose() {}, flashTile: vi.fn(), flashSkill: vi.fn(),
  };
  const fx: CombatFx = { float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  const seen: CombatEvent[] = [];
  let frame: (dt: number) => void = () => {};
  const player = playCombat({
    board, fx, roster, events,
    onEvent: (e) => seen.push(e),
    onFrame: (cb) => { frame = cb; return () => {}; },
    onTick() {},
  });
  const advance = (ms: number) => {
    for (let n = 0; n < ms; n += 5) frame(0.005);
  };
  return { advance, skillWindows, player, seen, fx, live, visuals };
}

describe("Kirin horn visual-event replay", () => {
  for (const star of [1, 2, 3] as const) {
    it(`${star}★ shows each impact at a separate horn beat, with blue electric FX only on a proc`, () => {
      const h = playback(star, star >= 2);
      h.advance(400);
      expect(h.skillWindows).toHaveLength(1);
      expect(h.seen.filter((e) => e.t === "skill")).toHaveLength(0);
      expect(h.fx.burst).not.toHaveBeenCalled();
      h.skillWindows[0]!.onImpact?.();
      expect(h.seen.filter((e) => e.t === "skill")).toHaveLength(1);
      if (star >= 2) {
        expect(h.seen.filter((e) => e.t === "status")).toHaveLength(1);
        expect(h.live.some((keys) => keys.includes("paralyze"))).toBe(true);
      } else expect(h.seen.filter((e) => e.t === "status")).toHaveLength(0);
      const expectedFx = 1 + (star >= 2 ? 1 : 0);
      expect(h.fx.burst).toHaveBeenCalledTimes(expectedFx);
      const totalHits = star * 2;
      for (let i = 1; i < totalHits; i++) {
        const spacing = (1600 * 0.33) / (totalHits - 1);
        h.advance(Math.ceil(spacing) + 10);
        expect(h.seen.filter((e) => e.t === "skill")).toHaveLength(i + 1);
      }
      expect(h.seen.filter((e) => e.t === "skill").map((e) => ("dst" in e ? e.dst : ""))).toEqual(
        Array.from({ length: totalHits }, (_, i) => i % 2 ? "neighbor" : "primary"),
      );
      expect(h.fx.burst).toHaveBeenCalledTimes(totalHits + (star >= 2 ? 1 : 0));
      expect(vi.mocked(h.fx.burst).mock.calls.filter(([, color]) => color === 0x63d6ff)).toHaveLength(star >= 2 ? 1 : 0);
      h.skillWindows[0]!.onDone?.();
      h.advance(300);
      h.player.dispose();
    });
  }
  it("plays on-hit aftermath and intermediate death at their own beats before the next action", () => {
    const h = playback(2, false, (i, dst) => {
      if (i === 0) return [
        { t: "status", dst, kind: "burn", turns: 2 },
        { t: "reflect", src: dst, dst: "kirin", dmg: 5, absorbed: 0 },
      ];
      if (i === 1) return [{ t: "heal", src: "kirin", dst: "kirin", amount: 4 }];
      if (i === 2) return [{ t: "death", dst }];
      return [];
    }, [{ t: "cycle", cycle: 2 }]);
    h.advance(400);
    expect(h.skillWindows).toHaveLength(1);
    h.skillWindows[0]!.onImpact?.();
    expect(h.seen.map((e) => e.t)).toEqual(["cast", "skill", "status", "reflect"]);
    expect(h.live.some((keys) => keys.includes("burn"))).toBe(true);
    expect(h.visuals.get("primary")!.die).not.toHaveBeenCalled();

    // Finishing the animation callback early must not release pending impacts.
    h.skillWindows[0]!.onDone?.();
    h.advance(210);
    expect(h.seen.map((e) => e.t)).toEqual(["cast", "skill", "status", "reflect", "skill", "heal"]);
    expect(h.seen.some((e) => e.t === "cycle")).toBe(false);
    h.advance(190);
    expect(h.seen.map((e) => e.t)).toEqual([
      "cast", "skill", "status", "reflect", "skill", "heal", "skill", "death",
    ]);
    expect(h.visuals.get("primary")!.die).toHaveBeenCalledTimes(1);
    h.advance(600);
    expect(h.seen.map((e) => e.t)).toEqual([
      "cast", "skill", "status", "reflect", "skill", "heal", "skill", "death", "skill", "cycle",
    ]);
    expect(h.fx.burst).toHaveBeenCalledTimes(5); // Four horn hits plus one reflected hit.
    h.player.dispose();
  });
});
