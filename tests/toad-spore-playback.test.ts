import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { playCombat, type RosterEntry } from "../src/units/combatPlayer";
import { SPORE_BURST_POINTS, type CombatEvent } from "../src/core/combat";
import { normalizeBillboard, type BillboardState } from "../src/units/billboard";
import type { BoardView } from "../src/units/boardView";
import type { CombatFx } from "../src/units/fx";
import type { UnitVisual } from "../src/units/rig";
import { RIGS } from "../src/units/registry";
import { ICONS } from "../src/core/emojiIcon";

type Cells = ReadonlyArray<{ col: number; row: number }>;

/** Minimal board/fx doubles: records hazard tiles, billboard counters and skill impacts. */
function harness(events: CombatEvent[]) {
  const roster: RosterEntry[] = [
    { uid: "toad", baseId: "toad_poison", star: 1, side: "L", hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield: 0 },
    { uid: "e", baseId: "titan_earth", star: 1, side: "R", hp: 100, maxHp: 100, rage: 0, rageMax: 3, shield: 0 },
  ];
  let impact: (() => void) | undefined;
  const visuals = new Map(roster.map((u) => {
    const visual: UnitVisual = {
      id: u.baseId, star: 1, root: new THREE.Group(), anchor: new THREE.Object3D(),
      play: vi.fn((state, options) => { if (state === "skill") impact = options?.onImpact; }),
      state: () => "idle", setCombat: vi.fn(), setFacing: vi.fn(), setHpRatio: vi.fn(), revive: vi.fn(), die: vi.fn(),
      update() {}, dispose: vi.fn(),
    };
    return [u.uid, visual] as const;
  }));
  const hazards: Cells[] = [];
  const counters = new Map<string, Array<BillboardState["counter"]>>();
  const board: BoardView = {
    sync() {}, visual: (uid) => visuals.get(uid), slot: () => undefined,
    cellCenter: (col, row) => ({ x: col, z: row }), forEach() {},
    setLive: (uid, s) => { if ("counter" in s) counters.set(uid, [...(counters.get(uid) ?? []), s.counter]); },
    setCombat() {}, startLowCortisol() {}, stopLowCortisol() {}, setHovered() {}, dispose() {},
    flashCell: vi.fn(), flashTile: vi.fn(), flashSkill: vi.fn(),
    setHazardCells: (cells) => { hazards.push([...cells]); },
  };
  const fx: CombatFx = { float: vi.fn(), burst: vi.fn(), shot: vi.fn(), jolt: vi.fn(), update: vi.fn(), dispose: vi.fn() };
  let frame: (dt: number) => void = () => {};
  const seen: string[] = [];
  const player = playCombat({ board, fx, roster, events, onEvent: (e) => { seen.push(e.t); }, onFrame: (cb) => { frame = cb; return () => {}; }, onTick() {} });
  frame(0);
  const advance = (ms: number) => { for (let left = ms; left > 0; left -= 5) frame(Math.min(5, left) / 1000); };
  return { player, advance, hazards, counters, fx, seen, fireImpact: () => impact?.() };
}

const cells = [{ row: 0, col: 5 }, { row: 2, col: 7 }, { row: 4, col: 9 }];

describe("Sương Độc playback", () => {
  it("drops pools on the skill impact, counts points on the billboard, then detonates and clears", () => {
    const events: CombatEvent[] = [
      { t: "cast", src: "toad", targets: [] },
      { t: "sporeThrow", src: "toad", cells, cycles: 2 },
      { t: "cycle", cycle: 2 },
      { t: "sporePoint", owner: "toad", dst: "e", row: 2, col: 7, points: 4 },
      { t: "sporePoint", owner: "toad", dst: "e", row: 2, col: 7, points: 5 },
      { t: "sporeBurst", owner: "toad", cells: [{ row: 2, col: 7 }], points: 5 },
      { t: "skill", src: "toad", dst: "e", dmg: 30, absorbed: 0, crit: false },
      { t: "sporeExpire", owner: "toad", cells: [{ row: 0, col: 5 }, { row: 4, col: 9 }] },
    ];
    const h = harness(events);
    h.advance(300);
    expect(h.hazards).toHaveLength(0); // pools wait for the authored skill impact
    h.fireImpact();
    expect(new Set(h.hazards.at(-1)!.map((c) => `${c.row}:${c.col}`))).toEqual(new Set(["0:5", "2:7", "4:9"]));
    expect(h.fx.burst).toHaveBeenCalledTimes(3);

    h.advance(4000); // ≥ 6 events × 300 ms at speed 0
    const shown = (h.counters.get("toad") ?? []).filter((c, i, all) => i === 0 || JSON.stringify(c) !== JSON.stringify(all[i - 1]));
    expect(shown).toEqual([
      { icon: ICONS.poison, value: 4, max: SPORE_BURST_POINTS },
      { icon: ICONS.poison, value: 5, max: SPORE_BURST_POINTS },
      undefined, // reset by the burst
    ]);
    expect(h.hazards.at(-1)).toEqual([]); // detonated cell + expired cells all cleared
    expect(vi.mocked(h.fx.float).mock.calls.some(([, text]) => text === "-30")).toBe(true);
    h.player.dispose();
  });

  it("normalizes the billboard counter badge (hidden at 0, rounded, max ≥ 1)", () => {
    const base: BillboardState = { name: "x", star: 1, hp: 1, maxHp: 1, rage: 0, rageMax: 3, side: "L", statuses: [] };
    expect(normalizeBillboard({ ...base, counter: { icon: "☠", value: 0, max: 5 } }).counter).toBeUndefined();
    expect(normalizeBillboard({ ...base, counter: { icon: "☠", value: 3.4, max: 5 } }).counter).toEqual({ icon: "☠", value: 3, max: 5 });
    expect(normalizeBillboard({ ...base, counter: { icon: "☠", value: 2, max: 0 } }).counter?.max).toBe(1);
    expect(normalizeBillboard(base).counter).toBeUndefined();
  });

  it("keeps the toad skill timing authored by its rig", () => {
    expect(RIGS.toad_poison?.impact?.skill).toBeGreaterThan(0);
  });
});
