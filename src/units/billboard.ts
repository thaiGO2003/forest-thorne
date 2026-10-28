// Unit status billboard (§24, A23, A92): one coherent panel above each unit — name + star, HP bar,
// segmented rage, ≤3 positive statuses (left) and ≤3 negative (right). Static chrome is kit art
// (9/3-slice); only fills and text are dynamic. One canvas + texture per unit, redrawn on change.
import * as THREE from "three";
import { ICONS } from "../core/emojiIcon";
import { drawFit, kitImage, LABEL, label, nineSlice, onKitReady, SLICE, threeSlice } from "../ui/kit";

export interface BillboardStatus { key: string; positive: boolean }

export interface BillboardState {
  name: string;
  star: number;
  hp: number;
  maxHp: number;
  rage: number;
  rageMax: number;
  side: "L" | "R";
  statuses: BillboardStatus[];
}

/** A92 logical surface. */
export const BILLBOARD_W = 512, BILLBOARD_H = 164;
const MAX_PER_SIDE = 3, MAX_SEGMENTS = 10;
const WORLD_W = 1.85;
const BASE_RENDER_ORDER = 10;
const HOVER_RENDER_ORDER = 20;

export interface Normalized extends BillboardState { segments: number; filled: number; pos: string[]; neg: string[] }

/** A92 normalization: non-negative rounded values, maxHp ≥ 1, star 1..3, dedup statuses, cap per side. */
export function normalizeBillboard(s: BillboardState): Normalized {
  const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
  const maxHp = Math.max(1, Math.round(fin(s.maxHp, 1)));
  const hp = Math.min(maxHp, Math.max(0, Math.round(fin(s.hp))));
  const rageMax = Math.max(0, Math.round(fin(s.rageMax)));
  const rage = Math.min(rageMax, Math.max(0, Math.round(fin(s.rage))));
  const segments = Math.min(MAX_SEGMENTS, Math.max(1, rageMax || 1));
  const filled = rageMax <= MAX_SEGMENTS
    ? Math.min(segments, rage)
    : Math.round(segments * Math.min(1, Math.max(0, rage / rageMax)));
  const seen = new Set<string>(), pos: string[] = [], neg: string[] = [];
  for (const st of s.statuses) {
    const key = st.key.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const list = st.positive ? pos : neg;
    if (list.length < MAX_PER_SIDE) list.push(key);
  }
  return { ...s, star: Math.min(3, Math.max(1, Math.round(fin(s.star, 1)))), hp, maxHp, rage, rageMax, segments, filled, pos, neg };
}

export interface Billboard {
  sprite: THREE.Sprite;
  set(s: BillboardState): void;
  setVisible(v: boolean): void;
  setPriority(v: boolean): void;
  dispose(): void;
}

export function createBillboard(anchor: THREE.Object3D): Billboard {
  const dpr = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)));
  const canvas = document.createElement("canvas");
  canvas.width = BILLBOARD_W * dpr;
  canvas.height = BILLBOARD_H * dpr;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(WORLD_W, (WORLD_W * BILLBOARD_H) / BILLBOARD_W, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = BASE_RENDER_ORDER;
  sprite.raycast = () => {};
  anchor.add(sprite); // follows the unit through movement/staging automatically
  let state: Normalized | null = null;

  const draw = () => {
    const g = canvas.getContext("2d");
    if (!g || !state) return;
    const s = state;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, BILLBOARD_W, BILLBOARD_H);
    if (!kitImage("shell_billboard")) return; // redrawn by onKitReady once art arrives

    // Status row (top): positive group from the left, negative from the right.
    const tile = 40, ty = 2;
    s.pos.forEach((k, i) => {
      const x = 8 + i * (tile + 4);
      nineSlice(g, "tile_status", SLICE.tile_status, x, ty, tile, tile, 2);
      label(g, ICONS[k as keyof typeof ICONS] ?? ICONS.question, x + tile / 2, ty + tile / 2 + 1, { size: 30, stroke: null });
    });
    s.neg.forEach((k, i) => {
      const x = BILLBOARD_W - 8 - s.neg.length * tile - (s.neg.length - 1) * 4 + i * (tile + 4);
      nineSlice(g, "tile_status", SLICE.tile_status, x, ty, tile, tile, 2);
      label(g, ICONS[k as keyof typeof ICONS] ?? ICONS.question, x + tile / 2, ty + tile / 2 + 1, { size: 30, stroke: null });
    });

    // Shell.
    const sy = 48, sh = BILLBOARD_H - sy - 2;
    nineSlice(g, "shell_billboard", SLICE.shell_billboard, 0, sy, BILLBOARD_W, sh, 3);

    // Name + stars.
    const ally = s.side === "L";
    for (let i = 0; i < s.star; i++) drawFit(g, "star", 18 + i * 26, sy + 12, 24, 24);
    label(g, s.name, 308, sy + 24, { size: 38, weight: 800, maxW: 390, fill: LABEL });

    // HP bar with the heart and lightning readouts adjacent (no gutter between bar and readouts).
    const bx = 14, readoutW = 72, readoutGap = 6;
    const bw = BILLBOARD_W - bx * 2 - readoutW - readoutGap;
    const readoutX = bx + bw + readoutGap;
    const by = sy + 40, bh = 34;
    nineSlice(g, "bar_trough", 1, bx + 6, by + 6, bw - 12, bh - 12);
    const pct = s.hp / s.maxHp, fw = Math.round((bw - 12) * pct);
    g.fillStyle = ally ? (pct > 0.5 ? "#5fd04a" : pct > 0.25 ? "#e8c23a" : "#e0503a") : "#e0503a";
    g.fillRect(bx + 6, by + 6, fw, bh - 12);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(bx + 6, by + 6, fw, 5);
    threeSlice(g, "frame_bar", 3, bx, by, bw, bh);
    label(g, `${s.hp}/${s.maxHp}`, bx + bw / 2, by + bh / 2, { size: 27 });
    label(g, `${ICONS.heart} ${Math.round(pct * 100)}%`, readoutX + readoutW / 2, by + bh / 2, { size: 23, align: "center", fill: LABEL });

    // Rage: segmented cells aligned under HP, with the lightning readout beside them.
    const ry = by + bh + 2, rh = 24, gap = 4;
    const cw = (bw - gap * (s.segments - 1)) / s.segments;
    for (let i = 0; i < s.segments; i++) {
      const x = bx + i * (cw + gap);
      nineSlice(g, "bar_trough", 1, x + 3, ry + 3, cw - 6, rh - 6);
      if (i < s.filled) { g.fillStyle = "#ffcf3a"; g.fillRect(x + 3, ry + 3, cw - 6, rh - 6); }
      threeSlice(g, "frame_rage_cell", 2, x, ry, cw, rh);
    }
    label(g, `${ICONS.rage} ${s.rage}/${s.rageMax}`, readoutX + readoutW / 2, ry + rh / 2, { size: 23, align: "center", fill: LABEL });
    tex.needsUpdate = true;
  };

  const offKit = onKitReady(draw);
  return {
    sprite,
    set(next) {
      const n = normalizeBillboard(next);
      if (state && JSON.stringify(n) === JSON.stringify(state)) return; // no redraw without change
      state = n;
      draw();
    },
    setVisible(v) { sprite.visible = v; },
    setPriority(v) { sprite.renderOrder = v ? HOVER_RENDER_ORDER : BASE_RENDER_ORDER; },
    dispose() { offKit(); sprite.removeFromParent(); tex.dispose(); mat.dispose(); state = null; },
  };
}
