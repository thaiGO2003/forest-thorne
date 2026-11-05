import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";

const hit = (dst: string, dmg: number): CombatEvent => ({
  t: "skill", src: "snail", dst, dmg, absorbed: 0, crit: false, kind: "cannon",
});

function replay(aftermath: CombatEvent[] = []) {
  const roster: RosterEntry[] = [
    { uid: "snail", baseId: "snail_fortress", star: 3, side: "L", hp: 200, maxHp: 200, rage: 5, rageMax: 5, shield: 0 },
    ...["primary", "above", "below"].map((uid) => ({
      uid, baseId: "titan_earth", star: 1, side: "R" as const, hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield: 0,
    })),
  ];
  const events: CombatEvent[] = [
    { t: "cast", src: "snail", targets: ["primary", "above", "below"] },
    hit("primary", 21), ...aftermath, hit("above", 14), hit("below", 14),
    { t: "cycle", cycle: 2 },
  ];
  const skillCallbacks: { onImpact?: () => void; onDone?: () => void }[] = [];
  const visuals = new Map(roster.map((unit, index) => {
    const anchor = new THREE.Group();
    anchor.position.set(index * 2, 1, index);
    anchor.updateMatrixWorld(true);
    return [unit.uid, {
      anchor, root: anchor,
      play: vi.fn((state: string, callbacks?: { onImpact?: () => void; onDone?: () => void }) => {
        if (state === "skill" && callbacks) skillCallbacks.push(callbacks);
      }),
      die: vi.fn(), revive: vi.fn(),
    }] as const;
  }));
  const updates: { uid: string; hp: number }[] = [];
  const board = {
    visual: (uid: string) => visuals.get(uid),
    setLive: (uid: string, value: { hp: number }) => { updates.push({ uid, hp: value.hp }); },
    flashTile: vi.fn(), setTurnIndicator() {}, setActorHighlight() {}, setCombatBorder() {},
  } as unknown as BoardView;
  const shots: { from: THREE.Vector3; to: THREE.Vector3; arrive: () => void }[] = [];
  const fx = {
    shot: (from: THREE.Vector3, to: THREE.Vector3, _color: number, _seconds: number, arrive: () => void) => {
      shots.push({ from: from.clone(), to: to.clone(), arrive });
    },
    float: vi.fn(), burst: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn(),
  } as unknown as CombatFx;
  const seen: CombatEvent[] = [];
  let frame: (dt: number) => void = () => {};
  const player = playCombat({
    board, fx, roster, events, onEvent: (event) => seen.push(event),
    onFrame: (cb) => { frame = cb; return () => {}; }, onTick() {},
  });
  const advance = (ms: number) => { for (let i = 0; i < ms; i += 5) frame(0.005); };
  return { advance, seen, updates, shots, skillCallbacks, board, player };
}

describe("Pháo Thân projectile replay impact timing", () => {
  it("fires one shell from caster toward primary; all independent damage events land at its arrival once", () => {
    const h = replay();
    h.advance(400);
    expect(h.skillCallbacks).toHaveLength(1);
    expect(h.seen.filter((event) => event.t === "skill")).toEqual([]);
    h.skillCallbacks[0]!.onImpact?.();
    h.skillCallbacks[0]!.onImpact?.();
    expect(h.shots).toHaveLength(1);
    expect(h.shots[0]!.from.y).toBeGreaterThan(1);
    expect(h.shots[0]!.to.x).toBe(2);
    expect(h.updates).toEqual([]);
    expect(h.seen.filter((event) => event.t === "skill")).toEqual([]);
    expect(h.seen.some((event) => event.t === "cycle")).toBe(false);

    h.shots[0]!.arrive();
    expect(h.seen.filter((event) => event.t === "skill").map((event) => "dst" in event ? event.dst : ""))
      .toEqual(["primary", "above", "below"]);
    expect(h.updates).toEqual([
      { uid: "primary", hp: 79 }, { uid: "above", hp: 86 }, { uid: "below", hp: 86 },
    ]);
    expect(vi.mocked(h.board.flashTile)).toHaveBeenCalledWith("primary", "direct");
    expect(vi.mocked(h.board.flashTile)).toHaveBeenCalledWith("above", "splash");
    expect(vi.mocked(h.board.flashTile)).toHaveBeenCalledWith("below", "splash");
    h.shots[0]!.arrive();
    expect(h.updates).toHaveLength(3);
    h.skillCallbacks[0]!.onDone?.();
    h.advance(300);
    expect(h.seen.some((event) => event.t === "cycle")).toBe(true);
    h.player.dispose();
  });

  it("keeps reflect, status, heal and death after the primary hit at the same projectile arrival", () => {
    const h = replay([
      { t: "reflect", src: "primary", dst: "snail", dmg: 5, absorbed: 0 },
      { t: "status", dst: "primary", kind: "burn", turns: 2 },
      { t: "heal", src: "snail", dst: "snail", amount: 3 },
      { t: "death", dst: "primary" },
    ]);
    h.advance(400);
    h.skillCallbacks[0]!.onImpact?.();
    h.skillCallbacks[0]!.onDone?.();
    h.advance(600);
    expect(h.seen.map((event) => event.t)).toEqual(["cast"]);
    expect(h.updates).toEqual([]);
    h.shots[0]!.arrive();
    expect(h.seen.map((event) => event.t)).toEqual([
      "cast", "skill", "reflect", "status", "heal", "death", "skill", "skill",
    ]);
    expect(h.seen.some((event) => event.t === "cycle")).toBe(false);
    expect(h.updates.filter((value) => value.uid === "above")).toEqual([{ uid: "above", hp: 86 }]);
    expect(h.updates.filter((value) => value.uid === "below")).toEqual([{ uid: "below", hp: 86 }]);
    const updateCount = h.updates.length;
    h.shots[0]!.arrive();
    expect(h.updates).toHaveLength(updateCount);
    h.advance(300);
    expect(h.seen.at(-1)?.t).toBe("cycle");
    h.player.dispose();
  });

  it("ignores a late projectile arrival after playback disposal without applying damage", () => {
    const h = replay();
    h.advance(400);
    h.skillCallbacks[0]!.onImpact?.();
    expect(h.shots).toHaveLength(1);
    h.player.dispose();
    h.shots[0]!.arrive();
    expect(h.updates).toEqual([]);
    expect(h.seen.filter((event) => event.t === "skill")).toEqual([]);
  });
});
