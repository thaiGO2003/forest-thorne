import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function setup(events: CombatEvent[]) {
  const roster: RosterEntry[] = [
    { uid: "duck", baseId: "swan_grace", side: "L", star: 3, hp: 500, maxHp: 500, rage: 0, rageMax: 4, shield: 0 },
    { uid: "target", baseId: "ant_guard", side: "R", star: 1, hp: 500, maxHp: 500, rage: 0, rageMax: 3, shield: 0 },
    { uid: "splash", baseId: "ant_guard", side: "R", star: 1, hp: 500, maxHp: 500, rage: 0, rageMax: 3, shield: 0 },
  ];
  const skills: Array<{ onImpact?: () => void; onDone?: () => void }> = [];
  const positions = new Map([["duck", 1], ["target", 4], ["splash", 5]]);
  const visuals = new Map(roster.map((unit) => {
    const root = new THREE.Group();
    root.position.set(positions.get(unit.uid)!, 0, 0);
    const anchor = new THREE.Object3D();
    root.add(anchor);
    const visual: UnitVisual = {
      id: unit.baseId, star: unit.star as 1 | 2 | 3, root, anchor,
      play: vi.fn((state, options?: { onImpact?: () => void; onDone?: () => void }) => {
        if (state === "skill" && options) skills.push(options);
      }),
      state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(),
      revive: vi.fn(), die: vi.fn(), update() {}, dispose: vi.fn(),
    };
    return [unit.uid, visual] as const;
  }));
  const board: BoardView = {
    sync() {}, visual: (uid) => visuals.get(uid), slot: () => undefined,
    cellCenter: (col, row) => ({ x: col, z: row }), forEach() {},
    setLive: vi.fn(), setCombat() {}, startLowCortisol() {}, stopLowCortisol() {},
    setHovered() {}, dispose() {}, flashTile: vi.fn(), flashSkill: vi.fn(),
  };
  const shots: Array<{ from: THREE.Vector3; to: THREE.Vector3; arrive: () => void }> = [];
  const fx: CombatFx = {
    float: vi.fn(), burst: vi.fn(),
    shot: vi.fn((from: THREE.Vector3, to: THREE.Vector3, _color: number, _duration: number, arrive: () => void) => {
      shots.push({ from: from.clone(), to: to.clone(), arrive });
    }),
    jolt: vi.fn(), update: vi.fn(), dispose: vi.fn(),
  };
  const seen: CombatEvent[] = [];
  let frame: (dt: number) => void = () => {};
  const player = playCombat({
    board, fx, roster, events,
    onEvent: (event) => seen.push(event),
    onFrame: (callback) => { frame = callback; return () => {}; },
    onTick() {},
  });
  const advance = (ms: number) => {
    for (let n = 0; n < ms; n += 5) frame(0.005);
  };
  return { advance, skills, shots, seen, fx, board, player };
}

describe("Golden Duck projectile impact playback", () => {
  it("replays 2★ primary, adjacent damage and stun only when the gold projectile arrives", () => {
    const cast: CombatEvent = { t: "cast", src: "duck", targets: ["target", "splash"] };
    const primary: CombatEvent = { t: "skill", src: "duck", dst: "target", dmg: 30, absorbed: 0, crit: false, kind: "gold" };
    const splash: CombatEvent = { t: "skill", src: "duck", dst: "splash", dmg: 30, absorbed: 0, crit: false, kind: "gold" };
    const stun: CombatEvent = { t: "status", dst: "target", kind: "stun", turns: 1 };
    const h = setup([cast, primary, splash, stun, { t: "cycle", cycle: 2 }]);
    h.advance(400);
    expect(h.skills).toHaveLength(1);
    expect(h.seen).toEqual([cast]);
    h.skills[0]!.onImpact?.();
    expect(h.shots).toHaveLength(1);
    expect(h.shots[0]!.from.x).toBe(1);
    expect(h.shots[0]!.to.x).toBe(4);
    expect(h.seen).toEqual([cast]);
    expect(h.fx.float).not.toHaveBeenCalled();
    h.shots[0]!.arrive();
    expect(h.seen).toEqual([cast, primary, splash, stun]);
    expect(h.fx.float).toHaveBeenCalledTimes(2);
    h.shots[0]!.arrive();
    expect(h.fx.float).toHaveBeenCalledTimes(2);
    h.skills[0]!.onDone?.();
    h.advance(300);
    expect(h.seen.at(-1)).toMatchObject({ t: "cycle", cycle: 2 });
    h.player.dispose();
  });

  it("3★ launches a separate projectile for each throw and never reveals the second before the first lands", () => {
    const first: CombatEvent[] = [
      { t: "cast", src: "duck", targets: ["target"] },
      { t: "skill", src: "duck", dst: "target", dmg: 30, absorbed: 0, crit: false, kind: "gold" },
      { t: "status", dst: "target", kind: "stun", turns: 1 },
    ];
    const second: CombatEvent[] = [
      { t: "cast", src: "duck", targets: ["target"] },
      { t: "skill", src: "duck", dst: "target", dmg: 25, absorbed: 0, crit: false, kind: "gold" },
      { t: "status", dst: "target", kind: "stun", turns: 1 },
    ];
    const h = setup([...first, ...second, { t: "cycle", cycle: 2 }]);
    h.advance(400);
    h.skills[0]!.onImpact?.();
    expect(h.shots).toHaveLength(1);
    expect(h.seen).toEqual([first[0]]);
    h.advance(300);
    expect(h.skills).toHaveLength(1);
    h.shots[0]!.arrive();
    expect(h.seen).toEqual(first);
    h.skills[0]!.onDone?.();
    h.advance(400);
    expect(h.skills).toHaveLength(2);
    expect(h.seen).toEqual([...first, second[0]]);
    h.skills[1]!.onImpact?.();
    expect(h.shots).toHaveLength(2);
    expect(h.seen).toEqual([...first, second[0]]);
    h.shots[1]!.arrive();
    expect(h.seen).toEqual([...first, ...second]);
    expect(h.fx.float).toHaveBeenCalledTimes(2);
    h.skills[1]!.onDone?.();
    h.advance(400);
    expect(h.seen.at(-1)).toMatchObject({ t: "cycle", cycle: 2 });
    h.player.dispose();
  });
});
