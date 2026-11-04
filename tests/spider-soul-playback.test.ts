import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CombatEvent } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";

function replay(soulEvents: CombatEvent[]) {
  let frame: (seconds: number) => void = () => {};
  let impact: (() => void) | undefined;
  let done: (() => void) | undefined;
  const visible = new Map(["spider", "foe"].map((uid, index) => {
    const anchor = new THREE.Group();
    anchor.position.set(index * 2, 1, 0);
    anchor.updateMatrixWorld(true);
    return [uid, {
      anchor,
      root: anchor,
      play: (_state: string, opts?: { onImpact?: () => void; onDone?: () => void }) => {
        if (uid === "spider" && opts?.onImpact) {
          impact = opts.onImpact;
          done = opts.onDone;
        }
      },
    }] as const;
  }));
  const live: { uid: string; hp: number }[] = [];
  const board = {
    visual: (uid: string) => visible.get(uid),
    setLive: (uid: string, value: { hp: number }) => { live.push({ uid, hp: value.hp }); },
    setTurnIndicator: () => {},
    setActorHighlight: () => {},
    setCombatBorder: () => {},
  } as unknown as BoardView;
  const shots: { from: THREE.Vector3; to: THREE.Vector3; arrive: () => void }[] = [];
  const fx = {
    shot: (from: THREE.Vector3, to: THREE.Vector3, _color: number, _seconds: number, arrive: () => void) => {
      shots.push({ from: from.clone(), to: to.clone(), arrive });
    },
    float: () => {}, burst: () => {}, jolt: () => {}, update: () => {}, dispose: () => {},
  } as unknown as CombatFx;
  const roster: RosterEntry[] = [
    { uid: "spider", baseId: "spider_venom", star: 3, side: "L", hp: 100, maxHp: 100, rage: 3, rageMax: 3, shield: 0 },
    { uid: "foe", baseId: "titan_earth", star: 1, side: "R", hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield: 0 },
  ];
  const observed: CombatEvent[] = [];
  const player = playCombat({
    board, fx, roster, events: soulEvents,
    onFrame: (fn) => { frame = fn; return () => {}; },
    onTick: () => {},
    onEvent: (event) => { observed.push(event); },
  });
  return { step: () => frame(1), castImpact: () => impact?.(), castDone: () => done?.(), observed, shots, live, player };
}

const cast: CombatEvent = { t: "cast", src: "spider", targets: ["foe", "foe"] };
const soul1: CombatEvent = { t: "skill", src: "spider", dst: "foe", dmg: 11, absorbed: 0, crit: false, kind: "soul" };
const soul2: CombatEvent = { t: "skill", src: "spider", dst: "foe", dmg: 17, absorbed: 0, crit: true, kind: "soul" };

describe("Nhện Linh projectile replay timing", () => {
  it("launches precisely one projectile per contiguous gameplay hit and applies damage at arrival", () => {
    const replayed = replay([cast, soul1, soul2]);
    replayed.step(); // cast animation begins
    replayed.step(); // both hit events are queued, not yet resolved
    expect(replayed.observed.filter((event) => event.t === "skill")).toHaveLength(0);
    replayed.castImpact();
    expect(replayed.shots).toHaveLength(2);
    expect(replayed.shots[0]!.from.y).toBeGreaterThan(1);
    expect(replayed.observed.filter((event) => event.t === "skill")).toHaveLength(0);
    replayed.shots[0]!.arrive();
    expect(replayed.observed.filter((event) => event.t === "skill")).toEqual([soul1]);
    replayed.shots[1]!.arrive();
    replayed.shots[1]!.arrive(); // at-most-once arrival
    expect(replayed.observed.filter((event) => event.t === "skill")).toEqual([soul1, soul2]);
    expect(replayed.live.filter((entry) => entry.uid === "foe").at(-1)?.hp).toBe(72);
    replayed.castDone();
    replayed.player.dispose();
  });

  it("still emits a real soul projectile when a reflect event splits adjacent hits", () => {
    const reflect: CombatEvent = { t: "reflect", src: "foe", dst: "spider", dmg: 1, absorbed: 0 };
    const replayed = replay([cast, soul1, reflect, soul2]);
    replayed.step();
    replayed.step();
    replayed.castImpact();
    expect(replayed.shots).toHaveLength(1);
    replayed.shots[0]!.arrive();
    replayed.step(); // reflect
    for (let i = 0; i < 6; i++) replayed.step();
    expect(replayed.shots).toHaveLength(2);
    expect(replayed.observed.filter((event) => event.t === "skill")).toEqual([soul1]);
    replayed.shots[1]!.arrive();
    expect(replayed.observed.filter((event) => event.t === "skill")).toEqual([soul1, soul2]);
    replayed.castDone();
    replayed.player.dispose();
  });
});
