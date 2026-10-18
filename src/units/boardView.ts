// Board presentation (§11, §14.2, A2, A90.3, A91.2): keeps 3D unit rigs in sync with canonical run
// state. Reads board/bench/enemyPreview only; never mutates the run. Visuals are keyed by uid so a
// unit moving between cells keeps its rig, and are rebuilt only when identity or star changes.
import * as THREE from "three";
import { benchSlots, toVisual, type Profile } from "../board/geometry";
import { getUnit } from "../content/catalog";
import { STAR_STAT } from "../core/economy";
import type { RunState } from "../core/run";
import type { CombatTargetPreview } from "../core/combat";
import { BLOCK, cellToWorld } from "../world/arena";
import type { Stage } from "../world/stage";
import { createBillboard, type Billboard, type BillboardState } from "./billboard";
import { createUnit } from "./registry";
import type { Star, UnitVisual } from "./rig";

/** Tile top: units stand on the thin tactical tiles. */
const TILE_TOP = 0.12;
const BOARD = 5;
export const LOW_CORTISOL_DURATION_MS = 120_000;


interface Slot { v: UnitVisual; bb: Billboard; key: string; kind: "board" | "bench" | "enemy"; col: number; row: number; x: number; z: number; base: BillboardState }
interface MoveTween {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  elapsed: number;
  duration: number;
}
export interface BoardSlotLocation {
  kind: Slot["kind"];
  col: number;
  row: number;
}

export interface BoardView {
  sync(run: RunState): void;
  /** Lookup for picking/billboards/combat staging. */
  visual(uid: string): UnitVisual | undefined;
  slot(uid: string): BoardSlotLocation | undefined;
  cellCenter(col: number, row: number): { x: number; z: number };
  forEach(fn: (uid: string, v: UnitVisual, kind: Slot["kind"]) => void): void;
  /** Combat pushes live HP/rage/statuses; also drives star multiplicity (A90.3). */
  setLive(uid: string, live: Partial<Pick<BillboardState, "hp" | "maxHp" | "rage" | "rageMax" | "statuses">>): void;
  setCombat(v: boolean): void;
  startLowCortisol(): void;
  stopLowCortisol(): void;
  setSelected?(uid: string | null): void;
  setHovered(uid: string | null): void;
  /** Combat and preview use the same tile colors: purple scan, red direct, yellow splash. */
  flashCell?(col: number, row: number, kind: "scan" | "direct" | "splash"): void;
  flashTile?(uid: string, kind: "scan" | "direct" | "splash"): void;
  flashSkill?(uid: string): void;
  /** Persistent Planning hover projection; null clears it without disturbing transient combat flashes. */
  setTargetPreview?(preview: CombatTargetPreview | null): void;
  dispose(): void;
}

export function createBoardView(stage: Stage, profile: Profile = "solo"): BoardView {
  const slots = new Map<string, Slot>();
  const cortisolBase = new Map<string, { y: number; yaw: number; phase: number }>();
  let combat = false;
  let cortisolRemainingMs = 0;
  let cortisolElapsedMs = 0;
  const moveTweens = new Map<string, MoveTween>();
  const MOVE_DURATION_S = 0.22;
  let selected: string | null = null;
  let hovered: string | null = null;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .66, 40), new THREE.MeshBasicMaterial({ color: 0xffd36b, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  stage.scene.add(ring);
  const tileGeometry = new THREE.PlaneGeometry(BLOCK * .94, BLOCK * .94);
  const tileMaterials = {
    scan: new THREE.MeshBasicMaterial({ color: 0x984cf5, transparent: true, opacity: .52, side: THREE.DoubleSide, depthWrite: false }),
    direct: new THREE.MeshBasicMaterial({ color: 0xff4d58, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false }),
    splash: new THREE.MeshBasicMaterial({ color: 0xffd24e, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }),
  };
  const tilePriority = { scan: 1, splash: 2, direct: 3 };
  type TileKind = keyof typeof tileMaterials;
  const tileEffects = new Map<number, { mesh: THREE.Mesh; time: number; kind: TileKind | null }>();
  const previewCells = new Map<number, TileKind>();
  const rainbowMaterial = new THREE.MeshBasicMaterial({ color: 0xff568c, side: THREE.DoubleSide, depthWrite: false });
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(.71, .83, 48), rainbowMaterial);
  rainbow.rotation.x = -Math.PI / 2;
  rainbow.visible = false;
  stage.scene.add(rainbow);
  let skillUid: string | null = null;
  let skillTime = 0;
  let previewSkillUid: string | null = null;
  let rainbowHue = 0;

  const restoreCortisolUnit = (uid: string, s: Slot) => {
    const base = cortisolBase.get(uid);
    if (!base) return;
    s.v.root.position.y = base.y;
    s.v.root.rotation.y = base.yaw;
    cortisolBase.delete(uid);
  };
  const stopLowCortisol = () => {
    for (const [uid, s] of slots) restoreCortisolUnit(uid, s);
    cortisolRemainingMs = 0;
    cortisolElapsedMs = 0;
  };
  const updateCortisol = (dt: number) => {
    if (cortisolRemainingMs <= 0) return;
    const elapsedMs = Math.max(0, dt) * 1000;
    cortisolElapsedMs += elapsedMs;
    cortisolRemainingMs = Math.max(0, cortisolRemainingMs - elapsedMs);
    for (const [uid, base] of cortisolBase) {
      const s = slots.get(uid);
      if (!s || s.kind === "enemy") continue;
      const wave = cortisolElapsedMs * 0.009 + base.phase;
      s.v.root.position.y = Math.max(base.y, base.y + Math.sin(wave) * 0.08);
      s.v.root.rotation.y = base.yaw + Math.sin(wave * 0.72) * 0.12;
    }
    if (cortisolRemainingMs === 0) stopLowCortisol();
  };
  const setHovered = (uid: string | null) => {
    if (hovered) slots.get(hovered)?.bb.setPriority(false);
    hovered = uid && slots.has(uid) ? uid : null;
    if (hovered) slots.get(hovered)?.bb.setPriority(true);
  };
  const renderTileEffect = (key: number, effect: { mesh: THREE.Mesh; time: number; kind: TileKind | null }) => {
    const previewKind = previewCells.get(key);
    const transientKind = effect.time > 0 ? effect.kind : null;
    const visibleKind = transientKind && (!previewKind || tilePriority[transientKind] >= tilePriority[previewKind])
      ? transientKind
      : previewKind ?? null;
    effect.mesh.visible = Boolean(visibleKind);
    if (visibleKind) effect.mesh.material = tileMaterials[visibleKind];
  };
  const ensureTileEffect = (col: number, row: number) => {
    const key = row * BOARD * 2 + col;
    let effect = tileEffects.get(key);
    if (!effect) {
      const mesh = new THREE.Mesh(tileGeometry, tileMaterials.scan);
      mesh.rotation.x = -Math.PI / 2;
      mesh.raycast = () => {};
      const center = cellToWorld(toVisual(col, row), profile);
      mesh.position.set(center.x, TILE_TOP + .045, center.z);
      mesh.visible = false;
      stage.scene.add(mesh);
      effect = { mesh, time: 0, kind: null };
      tileEffects.set(key, effect);
    }
    return { key, effect };
  };
  const flashCell = (col: number, row: number, kind: TileKind) => {
    if (row < 0 || row >= BOARD || col < 0 || col >= BOARD * 2) return;
    const { key, effect } = ensureTileEffect(col, row);
    if (effect.time <= 0 || !effect.kind || tilePriority[kind] >= tilePriority[effect.kind]) effect.kind = kind;
    effect.time = Math.max(effect.time, kind === "scan" ? .25 : .65);
    renderTileEffect(key, effect);
  };
  const flashTile = (uid: string, kind: TileKind) => {
    const slot = slots.get(uid);
    if (!slot || slot.row < 0) return;
    flashCell(slot.col, slot.row, kind);
  };
  const setTargetPreview = (preview: CombatTargetPreview | null) => {
    previewCells.clear();
    previewSkillUid = preview?.skillCasterUid ?? null;
    const addCell = (col: number, row: number, kind: TileKind) => {
      if (row < 0 || row >= BOARD || col < 0 || col >= BOARD * 2) return;
      const key = row * BOARD * 2 + col;
      const existing = previewCells.get(key);
      if (!existing || tilePriority[kind] >= tilePriority[existing]) previewCells.set(key, kind);
      ensureTileEffect(col, row);
    };
    if (preview) {
      for (const cell of preview.scanCells) addCell(cell.col, cell.row, "scan");
      for (const uid of preview.splashUids) {
        const slot = slots.get(uid);
        if (slot && slot.row >= 0) addCell(slot.col, slot.row, "splash");
      }
      for (const uid of preview.directUids) {
        const slot = slots.get(uid);
        if (slot && slot.row >= 0) addCell(slot.col, slot.row, "direct");
      }
    }
    for (const [key, effect] of tileEffects) renderTileEffect(key, effect);
  };
  const off = stage.onFrame((dt) => {
    for (const [uid, move] of moveTweens) {
      const s = slots.get(uid);
      if (!s) { moveTweens.delete(uid); continue; }
      move.elapsed += Math.max(0, dt);
      const p = Math.min(1, move.elapsed / move.duration);
      const eased = p * p * (3 - 2 * p);
      s.v.root.position.x = move.fromX + (move.toX - move.fromX) * eased;
      s.v.root.position.z = move.fromZ + (move.toZ - move.fromZ) * eased;
      s.v.root.position.y = Math.max(TILE_TOP, s.v.root.position.y);
      if (p >= 1) {
        moveTweens.delete(uid);
        s.v.play("idle");
      }
    }
    for (const s of slots.values()) s.v.update(dt);
    updateCortisol(dt);
    const visual = selected ? slots.get(selected)?.v : undefined;
    ring.visible = Boolean(visual);
    if (visual) ring.position.set(visual.root.position.x, TILE_TOP + .015, visual.root.position.z);
    for (const [key, effect] of tileEffects) {
      if (effect.time > 0) {
        effect.time = Math.max(0, effect.time - dt);
        if (effect.time === 0) effect.kind = null;
      }
      renderTileEffect(key, effect);
    }
    skillTime = Math.max(0, skillTime - dt);
    const activeSkillUid = skillTime > 0 ? skillUid : previewSkillUid;
    const caster = activeSkillUid ? slots.get(activeSkillUid) : undefined;
    rainbow.visible = Boolean(caster && (skillTime > 0 || previewSkillUid));
    if (rainbow.visible && caster) {
      rainbow.position.set(caster.x, TILE_TOP + .055, caster.z);
      rainbowHue = (rainbowHue + dt * 1.25) % 1;
      rainbowMaterial.color.setHSL(rainbowHue, 1, .6);
    }
  });

  const place = (uid: string, baseId: string, star: number, kind: Slot["kind"], col: number, row: number, x: number, z: number) => {
    const st = Math.min(3, Math.max(1, Math.round(star))) as Star;
    const key = `${baseId}@${st}`;
    let s = slots.get(uid);
    if (s && s.key !== key) {
      restoreCortisolUnit(uid, s);
      moveTweens.delete(uid);
      s.v.dispose();
      s.bb.dispose();
      slots.delete(uid);
      s = undefined;
    }
    if (!s) {
      const v = createUnit(baseId, st);
      v.root.userData.uid = uid;
      stage.scene.add(v.root);
      const u = getUnit(baseId), maxHp = Math.round(u.stats.hp * (STAR_STAT[st] ?? 1));
      const base: BillboardState = { name: u.nameVi, star: st, hp: maxHp, maxHp, rage: 0, rageMax: u.stats.rageMax, side: kind === "enemy" ? "R" : "L", statuses: [] };
      const bb = createBillboard(v.anchor);
      bb.set(base);
      if (uid === hovered) bb.setPriority(true);
      s = { v, bb, key, kind, col, row, x, z, base };
      slots.set(uid, s);
      s.v.root.position.set(x, TILE_TOP, z);
    } else {
      const boardCellMove = !combat && s.kind === "board" && kind === "board" && (s.col !== col || s.row !== row);
      if (boardCellMove) {
        const existing = moveTweens.get(uid);
        if (!existing || existing.toX !== x || existing.toZ !== z) {
          moveTweens.set(uid, {
            fromX: s.v.root.position.x,
            fromZ: s.v.root.position.z,
            toX: x,
            toZ: z,
            elapsed: 0,
            duration: MOVE_DURATION_S,
          });
          s.v.play("move");
        }
      } else if (!moveTweens.has(uid)) {
        s.v.root.position.set(x, TILE_TOP, z);
      }
    }
    s.kind = kind;
    s.col = col;
    s.row = row;
    s.x = x;
    s.z = z;
    s.v.root.position.y = Math.max(TILE_TOP, s.v.root.position.y);
    s.v.setFacing(kind === "bench" ? Math.atan2(-x, -z) : kind === "enemy" ? "R" : "L");
    const cortisol = cortisolBase.get(uid);
    if (cortisol) {
      cortisol.y = Math.max(TILE_TOP, s.v.root.position.y);
      cortisol.yaw = s.v.root.rotation.y;
    }
    s.v.setCombat(combat);
    // Bench units stay compact: billboard only for deployed/enemy units (A23 "where relevant").
    s.bb.setVisible(kind !== "bench");
  };

  return {
    sync(run) {
      const seen = new Set<string>();
      const arena = stage.arena;
      // Clear occupancy, then mark deployed cells so only grass tufts hide under units.
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

      for (const [uid, s] of slots) if (!seen.has(uid)) {
        restoreCortisolUnit(uid, s);
        if (uid === hovered) hovered = null;
        moveTweens.delete(uid);
        s.v.dispose();
        s.bb.dispose();
        slots.delete(uid);
      }
    },
    visual: (uid) => slots.get(uid)?.v,
    slot(uid) {
      const s = slots.get(uid);
      return s ? { kind: s.kind, col: s.col, row: s.row } : undefined;
    },
    cellCenter: (col, row) => cellToWorld(toVisual(col, row), profile),
    forEach(fn) { for (const [uid, s] of slots) fn(uid, s.v, s.kind); },
    flashCell,
    flashTile,
    flashSkill(uid) { if (!slots.has(uid)) return; skillUid = uid; skillTime = .8; },
    setTargetPreview,
    setLive(uid, live) {
      const s = slots.get(uid);
      if (!s) return;
      s.base = { ...s.base, ...live };
      s.bb.set(s.base);
      s.v.setHpRatio(s.base.hp / Math.max(1, s.base.maxHp));
    },
    setHovered,
    startLowCortisol() {
      stopLowCortisol();
      let phase = 0;
      for (const [uid, s] of slots) {
        if (s.kind === "enemy") continue;
        cortisolBase.set(uid, { y: s.v.root.position.y, yaw: s.v.root.rotation.y, phase });
        phase += 1.37;
      }
      cortisolRemainingMs = LOW_CORTISOL_DURATION_MS;
    },
    stopLowCortisol,
    setCombat(v) {
      const entering = !combat && v;
      const leaving = combat && !v;
      if (entering || leaving) stopLowCortisol();
      if (entering) setTargetPreview(null);
      combat = v;
      if (leaving) {
        moveTweens.clear();
        // A77: temporary combat state (HP, deaths, staging offsets) is discarded; next sync rebuilds fresh rigs.
        for (const s of slots.values()) { s.v.dispose(); s.bb.dispose(); }
        slots.clear();
        hovered = null;
        for (const effect of tileEffects.values()) effect.mesh.removeFromParent();
        tileEffects.clear();
        skillUid = null; skillTime = 0; previewSkillUid = null; previewCells.clear(); rainbow.visible = false;
        return;
      }
      for (const s of slots.values()) s.v.setCombat(v);
    },
    setSelected(uid) { selected = uid; },
    dispose() {
      stopLowCortisol();
      moveTweens.clear();
      off();
      rainbow.removeFromParent(); rainbow.geometry.dispose(); rainbowMaterial.dispose();
      for (const effect of tileEffects.values()) effect.mesh.removeFromParent();
      tileEffects.clear();
      tileGeometry.dispose();
      for (const material of Object.values(tileMaterials)) material.dispose();
      ring.removeFromParent(); ring.geometry.dispose(); ring.material.dispose();
      for (const s of slots.values()) { s.v.dispose(); s.bb.dispose(); }
      hovered = null;
      slots.clear();
    },
  };
}
