import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { NORMAL_UNITS } from "../src/content/catalog";
import { stageBasicCombatEvent } from "../src/core/combatStaging";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import { materializeCombat, snapshotFighter, type CombatEvent, type CombatInspectionFrame } from "../src/core/combat";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";

function playback(events: CombatEvent[], inspectionFrames?: CombatInspectionFrame[], shield = 0, baseId?: string, onEvent?: (event: CombatEvent) => void) {
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
  const flashCell = vi.fn();
  const flashTile = vi.fn();
  const flashSkill = vi.fn();
  const board: BoardView = {
    sync() {},
    visual: (uid) => visuals.get(uid),
    slot: (uid) => uid === "a"
      ? { kind: "board", col: 3, row: 2 }
      : uid === "b" ? { kind: "enemy", col: 5, row: 2 } : undefined,
    cellCenter: (col, row) => ({ x: col * 2, z: row * 2 }),
    forEach() {},
    flashCell,
    flashTile,
    flashSkill,
    setLive: (uid, state) => { if (state.hp !== undefined) live.set(uid, state.hp); },
    setCombat() {},
    startLowCortisol() {},
    stopLowCortisol() {},
    setHovered() {},
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
    onEvent,
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
  return {
    player, live, advance, off, fx, actor: roster[0]!,
    impact: (uid: string) => impacts.get(uid),
    visual: (uid: string) => visuals.get(uid),
    flashCell, flashTile, flashSkill,
    cycles,
    current: () => currentRoster,
  };
}

describe("recovered combat presentation", () => {
  it("drives purple scan feedback from sparse empty-cell playback entries", () => {
    const { player, flashCell } = playback([{ t: "empty", side: "R", row: 4, col: 9 }]);
    expect(flashCell).toHaveBeenCalledWith(9, 4, "scan");
    player.dispose();
  });

  it("uses the same red direct feedback for both team directions at authored basic impact", () => {
    const left = playback([{ t: "basic", src: "a", dst: "b", dmg: 5, absorbed: 0, crit: false }]);
    left.advance(2000);
    expect(left.flashTile).toHaveBeenCalledWith("b", "direct");
    left.player.dispose();

    const right = playback([{ t: "basic", src: "b", dst: "a", dmg: 5, absorbed: 0, crit: false }]);
    right.advance(2000);
    expect(right.flashTile).toHaveBeenCalledWith("a", "direct");
    right.player.dispose();
  });

  it("drives rainbow caster plus red direct and yellow splash feedback from cast targets", () => {
    const { player, flashSkill, flashTile } = playback([{ t: "cast", src: "a", targets: ["b", "splash-target"] }]);
    expect(flashSkill).toHaveBeenCalledWith("a");
    expect(flashTile).toHaveBeenCalledWith("b", "direct");
    expect(flashTile).toHaveBeenCalledWith("splash-target", "splash");
    player.dispose();
  });
  it("finishes melee approach before attack and applies HP at the authored rig impact", async () => {
    const event = { t: "basic", src: "a", dst: "b", dmg: 20, absorbed: 0, crit: false } as const;
    const { player, live, advance, actor, impact, visual } = playback([event, { t: "reflect", src: "b", dst: "a", dmg: 7, absorbed: 0 }]);
    const timing = stageBasicCombatEvent(event, actor, 0).timing;
    const actorVisual = visual("a")!;
    const play = vi.mocked(actorVisual.play);

    expect(play.mock.calls.map(([state]) => state)).toEqual(["move"]);
    advance(timing.approachMs - 5);
    expect(play.mock.calls.map(([state]) => state)).toEqual(["move"]);
    expect(actorVisual.root.position.x).toBeLessThan(8);

    advance(5);
    expect(actorVisual.root.position.x).toBeCloseTo(8);
    expect(actorVisual.root.position.z).toBeCloseTo(4);
    expect(play.mock.calls.map(([state]) => state)).toEqual(["move", "attack"]);

    const attackImpactMs = (timing.preImpactMs + timing.postImpactMs) * 0.55;
    advance(attackImpactMs - 5);
    expect(live.has("b")).toBe(false);
    advance(5);
    expect(live.get("b")).toBe(80);

    const onImpact = impact("a");
    expect(onImpact).toBeTypeOf("function");
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

  it("lands skill HP exactly from the authored skill impact callback", () => {
    const events: CombatEvent[] = [
      { t: "cast", src: "a", targets: ["b"] },
      { t: "skill", src: "a", dst: "b", dmg: 24, absorbed: 0, crit: false },
    ];
    const { player, live, advance, impact } = playback(events);
    advance(350);
    expect(live.has("b")).toBe(false);
    const onImpact = impact("a");
    expect(onImpact).toBeTypeOf("function");
    onImpact!();
    expect(live.get("b")).toBe(76);
    onImpact!();
    expect(live.get("b")).toBe(76);
    player.dispose();
  });

  it("emits basic and multi-target skill SFX events only at animation impact", () => {
    const basicEvent = { t: "basic", src: "a", dst: "b", dmg: 12, absorbed: 0, crit: false } as const;
    const basicEvents: CombatEvent[] = [];
    const basic = playback([basicEvent], undefined, 0, undefined, (event) => basicEvents.push(event));
    const approach = stageBasicCombatEvent(basicEvent, basic.actor, 0).timing.approachMs;
    basic.advance(approach);
    expect(basicEvents).toEqual([]);
    basic.impact("a")!();
    basic.impact("a")!();
    expect(basicEvents).toEqual([basicEvent]);
    basic.player.dispose();

    const skillEvents: CombatEvent[] = [
      { t: "cast", src: "a", targets: ["a", "b"] },
      { t: "skill", src: "a", dst: "a", dmg: 6, absorbed: 0, crit: false },
      { t: "skill", src: "a", dst: "b", dmg: 16, absorbed: 0, crit: false },
    ];
    const observed: CombatEvent[] = [];
    const skill = playback(skillEvents, undefined, 0, undefined, (event) => observed.push(event));
    skill.advance(350);
    expect(observed).toEqual([skillEvents[0]]);
    skill.impact("a")!();
    skill.impact("a")!();
    expect(observed).toEqual(skillEvents);
    skill.player.dispose();
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
