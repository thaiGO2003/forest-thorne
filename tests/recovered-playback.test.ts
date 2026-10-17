import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { NORMAL_UNITS } from "../src/content/catalog";
import { stageBasicCombatEvent } from "../src/core/combatStaging";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import { materializeCombat, snapshotFighter, type CombatEvent, type CombatInspectionFrame } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function playback(events: CombatEvent[], inspectionFrames?: CombatInspectionFrame[], shield = 0, baseId?: string) {
  const melee = NORMAL_UNITS.find((unit) => unit.basic.delivery === "melee")!;
  const roster: RosterEntry[] = ["a", "b"].map((uid) => ({ uid, baseId: baseId ?? melee.id, star: 1, side: uid === "a" ? "L" : "R", hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield }));
  const live = new Map<string, number>();
  const impacts = new Map<string, () => void>();
  const visuals = new Map(roster.map((unit) => {
    let action: { elapsed: number; duration: number; impacted: boolean; onImpact?: () => void; onDone?: () => void } | null = null;
    const visual: UnitVisual = {
      id: unit.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
      play: vi.fn((state, options) => {
        if ((state === "attack" || state === "skill") && options?.onImpact) impacts.set(unit.uid, options.onImpact);
        action = (state === "attack" || state === "skill") && options?.duration !== undefined
          ? { elapsed: 0, duration: options.duration, impacted: false, onImpact: options.onImpact, onDone: options.onDone }
          : null;
      }),
      state: () => action ? "attack" : "idle",
      setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), revive: vi.fn(), die: vi.fn(),
      update(dt) {
        const current = action;
        if (!current) return;
        current.elapsed += dt;
        if (!current.impacted && current.elapsed >= current.duration * 0.55) {
          current.impacted = true;
          current.onImpact?.();
        }
        if (current.elapsed >= current.duration && action === current) {
          action = null;
          current.onDone?.();
        }
      },
      dispose: vi.fn(),
    };
    return [unit.uid, visual] as const;
  }));
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
  let currentRoster: RosterEntry[] = [];
  const player = playCombat({
    board,
    fx,
    roster,
    events,
    inspectionFrames,
    onFrame: (callback) => { frame = callback; return off; },
    onTick(tick) {
      cycles.push(tick.cycle);
      currentRoster = tick.all;
    },
  });
  const advance = (milliseconds: number) => {
    for (let left = milliseconds; left > 0; left -= 5) {
      const dt = Math.min(5, left) / 1000;
      for (const visual of visuals.values()) visual.update(dt);
      frame(dt);
    }
  };
  frame(0);
  return { player, live, advance, off, fx, actor: roster[0], impact: (uid: string) => impacts.get(uid), cycles, current: () => currentRoster };
}

describe("recovered combat presentation", () => {
  it("applies melee HP only at the authored rig impact, then consumes reflect damage", async () => {
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, advance, actor, impact } = playback([event, { t: "reflect", src: "b", dst: "a", dmg: 7, absorbed: 0 }]);
    const timing = stageBasicCombatEvent(event, actor, 0).timing;
    const attackImpactMs = timing.approachMs + (timing.preImpactMs + timing.postImpactMs) * 0.55;
    advance(attackImpactMs - 5);
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

  it("keeps ranged projectile presentation-only and lands HP at the authored rig impact", () => {
    const ranged = NORMAL_UNITS.find((unit) => unit.basic.delivery !== "melee")!;
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, fx, impact } = playback([event], undefined, 0, ranged.id);
    const shot = vi.mocked(fx.shot);
    expect(shot).toHaveBeenCalledTimes(1);
    const onArrive = shot.mock.calls[0]![4];
    onArrive();
    expect(live.has("b")).toBe(false);
    const onImpact = impact("a");
    expect(onImpact).toBeTypeOf("function");
    onImpact!();
    expect(live.get("b")).toBe(80);
    onImpact!();
    expect(live.get("b")).toBe(80);
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

  it("publishes authoritative resources and modifier expiry only after their replay boundary", async () => {
    const melee = NORMAL_UNITS.find((unit) => unit.basic.delivery === "melee")!;
    const fighter = materializeCombat([{ uid: "a", baseId: melee.id, star: 1, row: 0, col: 4 }], [])[0]!;
    const initial = { ...snapshotFighter(fighter), hp: 100, maxHp: 100, rage: 0, rageMax: 3 };
    const after = { ...initial, hp: 80, rage: 2, def: initial.def + 8, mods: [{ stat: "def" as const, value: 8, pct: false, turns: 2 }] };
    const event = { t: "basic", src: "b", dst: "a", dmg: 20, absorbed: 0, crit: false } as const;
    const frames = [{ eventIndex: 0, cycle: 1, units: [initial] }, { eventIndex: 1, cycle: 2, units: [after] }];
    const { player, advance, current } = playback([event], frames);
    expect(current()[0].inspection?.mods).toEqual([]);
    expect(current()[0].rage).toBe(0);
    advance(5000);
    await player.done;
    expect(current()[0].hp).toBe(80);
    expect(current()[0].rage).toBe(2);
    expect(current()[0].inspection?.mods).toEqual(after.mods);
    expect(current()[0].inspection?.def).toBe(after.def);
    player.dispose();
  });

  it("subtracts absorbed damage from shield before HP, including damage over time", async () => {
    const { player, advance, current } = playback([
      { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 10, crit: false },
      { t: "dot", dst: "a", kind: "poison", dmg: 6 },
    ], undefined, 10);
    advance(5000);
    await player.done;
    expect(current().find((unit) => unit.uid === "b")).toMatchObject({ hp: 90, shield: 0 });
    expect(current().find((unit) => unit.uid === "a")).toMatchObject({ hp: 100, shield: 4 });
    player.dispose();
  });
});
