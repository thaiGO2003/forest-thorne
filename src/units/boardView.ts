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
import { BILLBOARD_H, BILLBOARD_W, createBillboard, type Billboard, type BillboardState } from "./billboard";
import { createUnit } from "./registry";
import type { Star, UnitVisual } from "./rig";

/** Tile top: units stand on the thin tactical tiles. */
const TILE_TOP = 0.12;
const BOARD = 5;
export const LOW_CORTISOL_DURATION_MS = 120_000;


interface Slot { v: UnitVisual; bb: Billboard; key: string; kind: "board" | "bench" | "enemy"; col: number; row: number; x: number; z: number; base: BillboardState; modelBounds: THREE.Box3 | null }
interface LabelRect { left: number; top: number; right: number; bottom: number }
interface LabelCandidate extends LabelRect { uid: string; depth: number; modelArea: number; priority: number; anchorX: number; anchorY: number; width: number; height: number; worldWidth: number }
interface BeamPosition extends LabelRect {
  lane: number;
  center: number;
  score: number;
  coverage: Float64Array;
}
interface BeamState {
  score: number;
  positions: Int16Array;
  coverage: Float64Array;
}
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
  // One reusable projection/candidate pool for the Stage's existing frame callback.
  // HUD chrome is DOM; tactical labels are Three.js sprites above the board.
  const projected = new THREE.Vector3();
  const eyePoint = new THREE.Vector3();
  const modelPoint = new THREE.Vector3();
  const modelRects: LabelRect[] = [];
  let modelCount = 0;
  // Authored geometry is static. Cache local bounds once per rig, then project
  // eight corners per frame; never traverse meshes in the render loop.
  const modelBoundsFor = (root: THREE.Group): THREE.Box3 | null => {
    root.updateMatrixWorld(true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const localMatrix = new THREE.Matrix4();
    const meshBox = new THREE.Box3();
    const bounds = new THREE.Box3();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      localMatrix.multiplyMatrices(inverseRoot, object.matrixWorld);
      meshBox.copy(geometry.boundingBox).applyMatrix4(localMatrix);
      bounds.union(meshBox);
    });
    return bounds.isEmpty() ? null : bounds.expandByScalar(0.2);
  };
  const projectModel = (root: THREE.Group, bounds: THREE.Box3, view: DOMRect) => {
    root.updateWorldMatrix(true, false);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let corner = 0; corner < 8; corner++) {
      modelPoint.set(
        corner & 1 ? bounds.max.x : bounds.min.x,
        corner & 2 ? bounds.max.y : bounds.min.y,
        corner & 4 ? bounds.max.z : bounds.min.z,
      ).applyMatrix4(root.matrixWorld).project(camera);
      const x = view.left + (modelPoint.x + 1) * view.width * .5;
      const y = view.top + (1 - modelPoint.y) * view.height * .5;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const rect = modelRects[modelCount] ?? (modelRects[modelCount] = { left: 0, top: 0, right: 0, bottom: 0 });
    rect.left = left; rect.top = top; rect.right = right; rect.bottom = bottom;
    modelCount++;
    return Math.max(0, (right - left) * (bottom - top));
  };
  const candidates: LabelCandidate[] = [];
  const candidatePool: LabelCandidate[] = [];
  const hudRects: LabelRect[] = [];
  const labelCenters = [0.5, 0.25, 0.75, 0, 1, -0.25, 1.25, -0.5, 1.5] as const;
  const expandedCenters = [0.5, 0, 1, -0.5, 1.5, -1, 2, -1.5, 2.5] as const;
  const labelLanes = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7, -8, 8, -9, 9] as const;
  // Precompute bounded candidates once, never during a Stage frame. Compact
  // landscape uses lateral room; desktop keeps cards above the model heads.
  const positionsFor = (centers: readonly number[]) => labelLanes.flatMap(lane =>
    centers.map(center => ({
      lane, center,
      cost: (center - 0.5) ** 2 + ((lane + 0.5) * BILLBOARD_H / BILLBOARD_W) ** 2,
    })),
  ).sort((a, b) => a.cost - b.cost);
  const labelPositions = positionsFor(labelCenters);
  const expandedPositions = positionsFor(expandedCenters);
  const abovePositions = expandedPositions.filter(({ lane }) => lane >= 0);
  const placedLabels: LabelCandidate[] = [];
  let candidateCount = 0, hudCount = 0;
  const canvas = stage.renderer.domElement;
  const camera = stage.camera;
  // HUD roots survive panel updates; walk live child collections instead of
  // allocating a querySelectorAll NodeList on every Stage render frame.
  let hudLayer: HTMLElement | null = null;
  let tooltipLayer: HTMLElement | null = null;
  let modalLayer: HTMLElement | null = null;
  const includeOccluder = (el: HTMLElement) => {
    if (el.hidden || el.dataset.open === "false") return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const h = hudRects[hudCount] ?? (hudRects[hudCount] = { left: 0, top: 0, right: 0, bottom: 0 });
    h.left = r.left; h.top = r.top; h.right = r.right; h.bottom = r.bottom;
    hudCount++;
  };
  const labelOverlap = (a: LabelRect, b: LabelRect, margin = 0) =>
    a.left < b.right + margin && a.right + margin > b.left &&
    a.top < b.bottom + margin && a.bottom + margin > b.top;
  // Compact boards benefit from evaluating a few complete arrangements rather
  // than irrevocably reserving a good slot for the first label. Pools persist
  // across frames; invalid layouts fall back to the established greedy path.
  const BEAM_WIDTH = 4;
  const BEAM_CHOICES = 6;
  const beamRows: BeamPosition[][] = [];
  const beamBuffers: BeamState[][] = [[], []];
  const beamState = (buffer: BeamState[], index: number, count: number) => {
    let state = buffer[index];
    if (!state || state.positions.length < count) {
      state = { score: 0, positions: new Int16Array(count), coverage: new Float64Array(count) };
      buffer[index] = state;
    }
    return state;
  };
  const placeCompactLabels = (positions: readonly { lane: number; center: number; cost: number }[], view: DOMRect) => {
    for (let index = 0; index < candidateCount; index++) {
      const c = candidates[index]!;
      const row = beamRows[index] ?? (beamRows[index] = []);
      let count = 0;
      for (const { lane, center, cost } of positions) {
        const bottom = c.anchorY - lane * c.height;
        const top = bottom - c.height;
        const left = c.anchorX - c.width * center;
        const right = left + c.width;
        if (top < view.top + 6 || bottom > view.bottom - 6 ||
          left < view.left + 6 || right > view.right - 6) continue;
        const bounds = { left, top, right, bottom };
        let blocked = false;
        for (let i = 0; i < hudCount; i++) {
          if (labelOverlap(bounds, hudRects[i]!, 3)) { blocked = true; break; }
        }
        if (blocked) continue;
        let p = row[count];
        if (!p || p.coverage.length < modelCount) {
          p = { left, top, right, bottom, lane, center, score: 0, coverage: new Float64Array(modelCount) };
          row[count] = p;
        }
        p.left = left; p.top = top; p.right = right; p.bottom = bottom;
        p.lane = lane; p.center = center;
        let score = cost * (c.priority > 0 ? 2 : 1);
        for (let i = 0; i < modelCount; i++) {
          const m = modelRects[i]!;
          const w = Math.max(0, Math.min(right, m.right) - Math.max(left, m.left));
          const h = Math.max(0, Math.min(bottom, m.bottom) - Math.max(top, m.top));
          const covered = w * h / Math.max(1, (m.right - m.left) * (m.bottom - m.top));
          p.coverage[i] = covered;
          score += 3 * covered;
        }
        p.score = score;
        count++;
      }
      row.length = count;
      if (!count) return false;
      row.sort((a, b) => a.score - b.score);
    }
    let current = beamBuffers[0]!;
    let next = beamBuffers[1]!;
    let currentCount = 1;
    const first = beamState(current, 0, candidateCount);
    first.score = 0;
    first.coverage.fill(0, 0, modelCount);
    for (let index = 0; index < candidateCount; index++) {
      let nextCount = 0;
      const row = beamRows[index]!;
      for (let j = 0; j < currentCount; j++) {
        const parent = current[j]!;
        let explored = 0;
        for (let k = 0; k < row.length; k++) {
          const p = row[k]!;
          let collides = false;
          for (let earlier = 0; earlier < index; earlier++) {
            if (labelOverlap(p, beamRows[earlier]![parent.positions[earlier]!]!, 3)) {
              collides = true;
              break;
            }
          }
          if (collides) continue;
          let score = parent.score + p.score;
          for (let m = 0; m < modelCount; m++) {
            const prev = parent.coverage[m]!;
            const cover = prev + p.coverage[m]!;
            // Penalize hiding a substantial part of *any* creature, not just
            // the label's owner. Prevents shifting obstruction to a neighbor.
            score += 80 * (Math.max(0, cover - .12) ** 2 - Math.max(0, prev - .12) ** 2);
          }
          if (nextCount < BEAM_WIDTH || score < next[nextCount - 1]!.score) {
            let slot = Math.min(nextCount, BEAM_WIDTH - 1);
            while (slot > 0 && next[slot - 1]!.score > score) slot--;
            const last = nextCount < BEAM_WIDTH ? nextCount++ : BEAM_WIDTH - 1;
            const state = beamState(next, last, candidateCount);
            for (let n = last; n > slot; n--) {
              const prior = next[n - 1]!;
              const target = next[n]!;
              target.score = prior.score;
              target.positions.set(prior.positions);
              target.coverage.set(prior.coverage);
            }
            const chosen = next[slot]!;
            chosen.score = score;
            for (let n = 0; n < index; n++) chosen.positions[n] = parent.positions[n]!;
            chosen.positions[index] = k;
            for (let m = 0; m < modelCount; m++) {
              chosen.coverage[m] = parent.coverage[m]! + p.coverage[m]!;
            }
          }
          if (++explored === BEAM_CHOICES) break;
        }
      }
      if (!nextCount) return false;
      const swap = current; current = next; next = swap;
      currentCount = nextCount;
    }
    const best = current[0]!;
    for (let index = 0; index < candidateCount; index++) {
      const c = candidates[index]!;
      const p = beamRows[index]![best.positions[index]!]!;
      const bb = slots.get(c.uid)?.bb;
      if (!bb) continue;
      bb.setPriority(c.priority > 0);
      bb.sprite.center.set(p.center, -p.lane);
      bb.sprite.scale.set(c.worldWidth, c.worldWidth * (BILLBOARD_H / BILLBOARD_W), 1);
      bb.setVisible(true);
    }
    return true;
  };
  const layoutLabels = () => {
    if (!slots.size) return;
    const view = canvas.getBoundingClientRect();
    if (!view.width || !view.height) {
      for (const s of slots.values()) s.bb.setVisible(false);
      return;
    }
    // Use the painted planning/combat panels rather than their transparent
    // full-screen overlay parents. The modal root deliberately blocks all labels.
    hudLayer ??= document.querySelector<HTMLElement>(".layer-hud");
    tooltipLayer ??= document.querySelector<HTMLElement>(".layer-tooltip");
    modalLayer ??= document.querySelector<HTMLElement>(".layer-modal");
    hudCount = 0;
    if (hudLayer) for (let i = 0; i < hudLayer.children.length; i++) {
      const root = hudLayer.children.item(i) as HTMLElement | null;
      if (!root || root.hidden) continue;
      for (let j = 0; j < root.children.length; j++) {
        const panel = root.children.item(j) as HTMLElement | null;
        if (panel) includeOccluder(panel);
      }
    }
    if (tooltipLayer) for (let i = 0; i < tooltipLayer.children.length; i++) {
      const tooltip = tooltipLayer.children.item(i) as HTMLElement | null;
      if (tooltip) includeOccluder(tooltip);
    }
    if (modalLayer?.dataset.open === "true") for (let i = 0; i < modalLayer.children.length; i++) {
      const modal = modalLayer.children.item(i) as HTMLElement | null;
      if (modal) includeOccluder(modal);
    }
    camera.updateMatrixWorld();
    const worldPerPixelAtDepth = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / view.height;
    // Dense landscape needs small lateral labels; desktop labels stay above
    // creature heads, leaving the playable model silhouettes unobscured.
    const compactLabels = view.width > view.height && view.height <= 560;
    const portraitLabels = view.width <= 560 && view.height > view.width;
    const labelWidth = compactLabels
      ? Math.min(125, Math.max(110, view.width * .15))
      : portraitLabels
        ? Math.min(154, Math.max(130, view.width / 3))
        : Math.min(160, Math.max(120, view.width * .11));
    const positions = compactLabels ? expandedPositions : portraitLabels ? labelPositions : abovePositions;
    candidateCount = 0;
    modelCount = 0;
    for (const [uid, s] of slots) {
      if (s.kind === "bench" || !s.v.root.visible || !s.v.anchor.visible) {
        s.bb.setVisible(false);
        continue;
      }
      const priority = uid === selected ? 2 : uid === hovered ? 1 : 0;
      s.bb.setDetailed(priority > 0);
      const modelArea = s.modelBounds ? projectModel(s.v.root, s.modelBounds, view) : 0;
      // The rig's head anchor is directly above its root; avoid updating all
      // creature matrices just to project fifty labels each frame.
      projected.set(s.v.root.position.x, s.v.root.position.y + s.v.anchor.position.y * s.v.root.scale.y, s.v.root.position.z);
      eyePoint.copy(projected).applyMatrix4(camera.matrixWorldInverse);
      const depth = -eyePoint.z;
      if (depth <= camera.near || depth >= camera.far) { s.bb.setVisible(false); continue; }
      projected.project(camera);
      if (Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1 || projected.z < -1 || projected.z > 1) {
        s.bb.setVisible(false);
        continue;
      }
      const worldPerPixel = worldPerPixelAtDepth * depth;
      // Camera-depth scaling makes glyphs legible on portrait, landscape and desktop
      // without changing the shared billboard/world dimensions or the arena.
      const worldWidth = labelWidth * worldPerPixel;
      const width = labelWidth;
      const x = view.left + (projected.x + 1) * view.width * .5;
      const y = view.top + (1 - projected.y) * view.height * .5;
      const rect = candidatePool[candidateCount] ?? (candidatePool[candidateCount] = {
        uid, left: 0, top: 0, right: 0, bottom: 0, priority: 0, depth: 0, modelArea: 0,
        anchorX: 0, anchorY: 0, width: 0, height: 0, worldWidth: 0,
      });
      candidates[candidateCount] = rect;
      rect.uid = uid;
      rect.priority = priority;
      rect.depth = depth;
      rect.modelArea = modelArea;
      rect.anchorX = x;
      rect.anchorY = y;
      rect.width = width;
      rect.height = width * (BILLBOARD_H / BILLBOARD_W);
      rect.worldWidth = worldWidth;
      rect.left = x - width / 2; rect.right = x + width / 2;
      rect.top = y - rect.height; rect.bottom = y;
      candidateCount++;
      s.bb.setVisible(false);
    }
    // In crowded compact layouts, place smaller projected creatures first so
    // their labels do not reserve the space needed to reveal larger models.
    // Desktop keeps the established near-to-far ordering.
    candidates.length = candidateCount;
    candidates.sort((a, b) => b.priority - a.priority ||
      (compactLabels || portraitLabels ? a.modelArea - b.modelArea : 0) || a.depth - b.depth);
    if (compactLabels && candidateCount > 6 && placeCompactLabels(positions, view)) return;
    let placedCount = 0;
    for (const c of candidates) {
      const bb = slots.get(c.uid)?.bb;
      if (!bb) continue;
      let bestLane = 0, bestCenter = 0.5, bestLeft = 0, bestTop = 0;
      let bestScore = Infinity;
      for (const { lane, center, cost } of positions) {
        c.bottom = c.anchorY - lane * c.height;
        c.top = c.bottom - c.height;
        if (c.top < view.top + 6 || c.bottom > view.bottom - 6) continue;
        c.left = c.anchorX - c.width * center;
        c.right = c.left + c.width;
        if (c.left < view.left + 6 || c.right > view.right - 6) continue;
        let blocked = false;
        for (let i = 0; i < hudCount; i++) {
          if (labelOverlap(c, hudRects[i]!, 3)) { blocked = true; break; }
        }
        if (blocked) continue;
        for (let i = 0; i < placedCount; i++) {
          if (labelOverlap(c, placedLabels[i]!, 3)) { blocked = true; break; }
        }
        if (blocked) continue;
        let score = cost;
        for (let i = 0; i < modelCount; i++) {
          const model = modelRects[i]!;
          const width = Math.min(c.right, model.right) - Math.max(c.left, model.left);
          const height = Math.min(c.bottom, model.bottom) - Math.max(c.top, model.top);
          if (width > 0 && height > 0) {
            score += 3 * width * height / Math.max(1, (model.right - model.left) * (model.bottom - model.top));
          }
        }
        if (score < bestScore) {
          bestScore = score;
          bestLane = lane;
          bestCenter = center;
          bestLeft = c.left;
          bestTop = c.top;
          if (score === 0) break;
        }
      }
      if (bestScore === Infinity) continue;
      c.left = bestLeft; c.top = bestTop;
      c.right = bestLeft + c.width; c.bottom = bestTop + c.height;
      bb.setPriority(c.priority > 0);
      bb.sprite.center.set(bestCenter, -bestLane);
      bb.sprite.scale.set(c.worldWidth, c.worldWidth * (BILLBOARD_H / BILLBOARD_W), 1);
      placedLabels[placedCount++] = c;
      bb.setVisible(true);
      }
  };
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
  const setHovered = (uid: string | null) => { hovered = uid && slots.has(uid) ? uid : null; };
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
      const center = cellToWorld(toVisual(col, row, profile), profile);
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
    layoutLabels();
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
      bb.setDetailed(uid === hovered || uid === selected);
      bb.set(base);
      bb.setPriority(uid === hovered || uid === selected);
      s = { v, bb, key, kind, col, row, x, z, base, modelBounds: modelBoundsFor(v.root) };
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
        const row = Math.floor(i / BOARD), col = i % BOARD, w = cellToWorld(toVisual(col, row, profile), profile);
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
        const w = cellToWorld(toVisual(e.col, e.row, profile), profile);
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
    cellCenter: (col, row) => cellToWorld(toVisual(col, row, profile), profile),
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
