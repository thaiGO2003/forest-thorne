// Board presentation (§11, §14.2, A2, A90.3, A91.2): keeps 3D unit rigs in sync with canonical run
// state. Reads board/bench/enemyPreview only; never mutates the run. Visuals are keyed by uid so a
// unit moving between cells keeps its rig, and are rebuilt only when identity or star changes.
import { benchSlots, toVisual, type Profile } from "../board/geometry";
import { getUnit } from "../content/catalog";
import { STAR_STAT } from "../core/economy";
import type { RunState } from "../core/run";
import { cellToWorld } from "../world/arena";
import type { Stage } from "../world/stage";
import { createBillboard, type Billboard, type BillboardState } from "./billboard";
import { createUnit } from "./registry";
import type { Star, UnitVisual } from "./rig";

/** Tile top: units stand on the thin tactical tiles. */
const TILE_TOP = 0.12;
const BOARD = 5;

interface Slot { v: UnitVisual; bb: Billboard; key: string; kind: "board" | "bench" | "enemy"; col: number; row: number; base: BillboardState }

export interface BoardView {
  sync(run: RunState): void;
  /** Lookup for picking/billboards/combat staging. */
  visual(uid: string): UnitVisual | undefined;
  forEach(fn: (uid: string, v: UnitVisual, kind: Slot["kind"]) => void): void;
  /** Combat pushes live HP/rage/statuses; also drives star multiplicity (A90.3). */
  setLive(uid: string, live: Partial<Pick<BillboardState, "hp" | "maxHp" | "rage" | "rageMax" | "statuses">>): void;
  setCombat(v: boolean): void;
  dispose(): void;
}

export function createBoardView(stage: Stage, profile: Profile = "solo"): BoardView {
  const slots = new Map<string, Slot>();
  let combat = false;
  const off = stage.onFrame((dt) => { for (const s of slots.values()) s.v.update(dt); });

  const place = (uid: string, baseId: string, star: number, kind: Slot["kind"], col: number, row: number, x: number, z: number) => {
    const st = Math.min(3, Math.max(1, Math.round(star))) as Star;
    const key = `${baseId}@${st}`;
    let s = slots.get(uid);
    if (s && s.key !== key) { s.v.dispose(); s.bb.dispose(); slots.delete(uid); s = undefined; }
    if (!s) {
      const v = createUnit(baseId, st);
      v.root.userData.uid = uid;
      stage.scene.add(v.root);
      const u = getUnit(baseId), maxHp = Math.round(u.stats.hp * (STAR_STAT[st] ?? 1));
      const base: BillboardState = { name: u.nameVi, star: st, hp: maxHp, maxHp, rage: 0, rageMax: u.stats.rageMax, side: kind === "enemy" ? "R" : "L", statuses: [] };
      const bb = createBillboard(v.anchor);
      bb.set(base);
      s = { v, bb, key, kind, col, row, base };
      slots.set(uid, s);
    }
    s.kind = kind; s.col = col; s.row = row;
    s.v.root.position.set(x, TILE_TOP, z);
    s.v.setFacing(kind === "enemy" ? "R" : "L");
    s.v.setCombat(combat);
    // Bench units stay compact: billboard only for deployed/enemy units (A23 "where relevant").
    s.bb.setVisible(kind !== "bench");
  };

  return {
    sync(run) {
      const seen = new Set<string>();
      const arena = stage.arena;
      // Clear tile occupancy for the whole logical board, then mark occupied cells (11.7 no-grass).
      for (let r = 0; r < BOARD; r++) for (let c = 0; c < 10; c++) arena.setOccupied(c, r, false);

      run.board.forEach((u, i) => {
        if (!u) return;
        const row = Math.floor(i / BOARD), col = i % BOARD, w = cellToWorld(toVisual(col, row), profile);
        place(u.uid, u.baseId, u.star, "board", col, row, w.x, w.z);
        arena.setOccupied(col, row, true);
        seen.add(u.uid);
      });

      // Bench: compact list onto stable perimeter slots (11.6); over-cap units stay visible on the
      // remaining perimeter cells so nothing silently disappears.
      const cells = benchSlots(Math.max(run.bench.length, 0), profile);
      run.bench.forEach((u, i) => {
        const cell = cells[i];
        if (!cell) return;
        const w = cellToWorld(cell, profile);
        place(u.uid, u.baseId, u.star, "bench", i, -1, w.x, w.z);
        seen.add(u.uid);
      });

      // Enemy preview occupies logical cols 5..9 on the far side of the river.
      for (const e of run.enemyPreview) {
        const w = cellToWorld(toVisual(e.col, e.row), profile);
        place(e.uid, e.baseId, e.star, "enemy", e.col, e.row, w.x, w.z);
        arena.setOccupied(e.col, e.row, true);
        seen.add(e.uid);
      }

      for (const [uid, s] of slots) if (!seen.has(uid)) { s.v.dispose(); s.bb.dispose(); slots.delete(uid); }
    },
    visual: (uid) => slots.get(uid)?.v,
    forEach(fn) { for (const [uid, s] of slots) fn(uid, s.v, s.kind); },
    setLive(uid, live) {
      const s = slots.get(uid);
      if (!s) return;
      s.base = { ...s.base, ...live };
      s.bb.set(s.base);
      s.v.setHpRatio(s.base.hp / Math.max(1, s.base.maxHp));
    },
    setCombat(v) {
      const leaving = combat && !v;
      combat = v;
      if (leaving) {
        // A77: temporary combat state (HP, deaths, staging offsets) is discarded; next sync rebuilds fresh rigs.
        for (const s of slots.values()) { s.v.dispose(); s.bb.dispose(); }
        slots.clear();
        return;
      }
      for (const s of slots.values()) s.v.setCombat(v);
    },
    dispose() {
      off();
      for (const s of slots.values()) { s.v.dispose(); s.bb.dispose(); }
      slots.clear();
    },
  };
}
