/**
 * BoardRenderer.ts
 *
 * Shared board rendering helpers for the isometric chess-like board.
 * The battlefield keeps the original grass/river base, while neon decor
 * and environmental tile overlays are layered on top.
 */

import { COLS, PLAYER_COLS, ROWS } from "../core/boardConstants.js";
import {
  getBattlefieldRowCount,
  getBoardPlayerSlots,
  getBoardProfile,
  getPlayerRowBounds,
  normalizePlayerSlot
} from "../core/boardProfiles.js";
import { UI_COLORS, ROLE_THEME } from "../core/uiTheme.js";
import type { ClassType } from "../core/uiTheme.js";

type BoardProfile = {
  id: string;
  playerCount: number;
  rowsPerPlayer: number;
  rows: number;
  logicalCols: number;
  visualCols: number;
  playerCols: number;
  enemyCols: number;
  riverGapCols: number;
  enemyColStart: number;
  enemyColEnd: number;
  playerRowSpans: Record<string, { offset: number; rowCount: number }>;
};
interface RoleThemeEntry {
  fill: number;
  glow: number;
  stroke: number;
  card: number;
  cardHover: number;
  bench: number;
}

const ROLE_THEME_MAP = ROLE_THEME as unknown as Record<string, RoleThemeEntry>;

const NEON = {
  ally: 0x45f0a0,
  allySoft: 0xa4ffd5,
  allyLocal: 0x8fd8ff,
  allyLocalSoft: 0xd9f4ff,
  enemy: 0xff627f,
  enemySoft: 0xffbed0,
  river: 0x5fdcff,
  riverSoft: 0xe0fbff,
  magenta: 0xff72d2,
  ember: 0xff9d52,
  violet: 0xc87cff,
  skylineBlue: 0x44a7ff,
  skylinePink: 0xff4db4,
  pole: 0x2a394b
} as const;

type NeonKey = keyof typeof NEON;

interface EnvironmentCellStyle {
  kind: string;
  glow: number;
  accent: number;
}

const ENVIRONMENT_CELLS = new Map<string, EnvironmentCellStyle>([
  ["4,0", { kind: "rune", glow: NEON.violet, accent: 0xf7e6ff }],
  ["3,1", { kind: "grass", glow: NEON.ally, accent: 0xe7fff3 }],
  ["1,2", { kind: "grass", glow: NEON.ally, accent: 0xe7fff3 }],
  ["4,3", { kind: "lotus", glow: NEON.magenta, accent: 0xffeef9 }],
  ["2,4", { kind: "water", glow: NEON.river, accent: NEON.riverSoft }],
  ["2,5", { kind: "water", glow: NEON.river, accent: NEON.riverSoft }],
  ["1,7", { kind: "sigil", glow: NEON.enemy, accent: 0xffebf0 }],
  ["3,8", { kind: "embers", glow: NEON.ember, accent: 0xfff1dd }],
  ["4,9", { kind: "sigil", glow: NEON.enemy, accent: 0xffebf0 }]
]);

interface Point {
  x: number;
  y: number;
}

interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BoundsRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BattlefieldMetrics {
  panel: PanelRect;
  boardBounds: BoundsRect;
  allyBounds: BoundsRect;
  enemyBounds: BoundsRect;
  seamPoints: Point[];
  tileW: number;
  tileH: number;
}

export interface CoopOwnershipMarker {
  slot: string;
  bounds: { startRow: number; endRow: number };
  boardBounds: BoundsRect;
  isLocal: boolean;
  label: string;
  accent: number;
  accentSoft: number;
}

export interface BoardEnvironmentLayers {
  backdrop?: Phaser.GameObjects.Graphics | null;
  fx?: Phaser.GameObjects.Graphics | null;
}

interface BoardSceneLayout {
  boardPanelX?: number;
  boardPanelY?: number;
  boardPanelW?: number;
  boardPanelH?: number;
}

interface BoardSceneGameModeConfig {
  fortressMode?: boolean;
  renderStrongholds?: boolean;
}

export interface BoardScene {
  layout?: BoardSceneLayout | null;
  gameModeConfig?: BoardSceneGameModeConfig | null;
  gridToScreen: (col: number, row: number) => Point;
  getTileSize?: () => { tileW: number; tileH: number };
  getBoardProfileId?: () => string;
  getBoardRowCount?: () => number;
}

function strokePolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: Point[],
  width: number,
  color: number,
  alpha: number = 1
): void {
  if (!Array.isArray(points) || points.length < 2) return;
  graphics.lineStyle(width, color, alpha);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    graphics.lineTo(points[i].x, points[i].y);
  }
  graphics.strokePath();
}

function drawMiniDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  scale: number = 0.3,
  fillAlpha: number = 0.15,
  strokeColor: number = 0xffffff,
  strokeAlpha: number = 0.5
): void {
  graphics.fillStyle(strokeColor, fillAlpha);
  graphics.lineStyle(1, strokeColor, strokeAlpha);
  drawDiamond(graphics, x, y, tileW * scale, tileH * scale, true);
}

export function getGrassTileStyle(row: number, col: number): { fill: number; stroke: number } {
  const even = (row + col) % 2 === 0;
  if (even) {
    return { fill: UI_COLORS.grassA, stroke: UI_COLORS.grassEdgeA };
  }
  return { fill: UI_COLORS.grassB, stroke: UI_COLORS.grassEdgeB };
}

export function getEnvironmentCellStyle(row: number, col: number): EnvironmentCellStyle | null {
  return ENVIRONMENT_CELLS.get(`${row},${col}`) ?? null;
}

export function getBattlefieldTileStyle(
  row: number,
  col: number
): {
  fill: number;
  stroke: number;
  side: "ally" | "enemy";
  edgeGlow: number;
  environment: EnvironmentCellStyle | null;
} {
  return {
    ...getGrassTileStyle(row, col),
    side: col < PLAYER_COLS ? "ally" : "enemy",
    edgeGlow: col < PLAYER_COLS ? NEON.ally : NEON.enemy,
    environment: getEnvironmentCellStyle(row, col)
  };
}

export function drawDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tileW: number,
  tileH: number,
  fill: boolean = true
): void {
  graphics.beginPath();
  graphics.moveTo(x, y - tileH / 2);
  graphics.lineTo(x + tileW / 2, y);
  graphics.lineTo(x, y + tileH / 2);
  graphics.lineTo(x - tileW / 2, y);
  graphics.closePath();
  if (fill) graphics.fillPath();
  graphics.strokePath();
}

function drawEnvironmentCellOverlay(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  col: number,
  tileW: number,
  tileH: number
): void {
  const env = getEnvironmentCellStyle(row, col);
  if (!env) return;

  const cx = x;
  const cy = y + tileH * 0.04;

  graphics.fillStyle(env.glow, 0.08);
  graphics.fillEllipse(cx, cy, tileW * 0.44, tileH * 0.28);

  if (env.kind === "rune") {
    drawMiniDiamond(graphics, cx, cy, tileW, tileH, 0.32, 0.12, env.glow, 0.65);
    graphics.lineStyle(1.3, env.accent, 0.7);
    graphics.strokeCircle(cx, cy, tileH * 0.16);
    graphics.fillStyle(env.accent, 0.65);
    graphics.fillCircle(cx, cy, 2.6);
    return;
  }

  if (env.kind === "lotus") {
    for (let i = 0; i < 4; i += 1) {
      const ox = (i === 0 ? 0 : i === 1 ? 8 : i === 2 ? 0 : -8);
      const oy = (i === 0 ? -5 : i === 1 ? 0 : i === 2 ? 5 : 0);
      drawMiniDiamond(graphics, cx + ox, cy + oy, tileW, tileH, 0.14, 0.2, env.glow, 0.45);
    }
    graphics.fillStyle(env.accent, 0.75);
    graphics.fillCircle(cx, cy, 2.4);
    return;
  }

  if (env.kind === "water") {
    graphics.lineStyle(1.2, env.glow, 0.65);
    graphics.beginPath();
    graphics.moveTo(cx - tileW * 0.12, cy);
    graphics.lineTo(cx - tileW * 0.03, cy - tileH * 0.07);
    graphics.lineTo(cx + tileW * 0.1, cy - tileH * 0.01);
    graphics.strokePath();
    graphics.fillStyle(0x7fcf7f, 0.4);
    graphics.fillEllipse(cx - 3, cy + 2, tileW * 0.12, tileH * 0.08);
    graphics.fillStyle(env.accent, 0.52);
    graphics.fillCircle(cx + tileW * 0.08, cy - 1, 1.9);
    return;
  }

  if (env.kind === "sigil") {
    graphics.lineStyle(1.3, env.glow, 0.68);
    graphics.strokeCircle(cx, cy, tileH * 0.16);
    graphics.beginPath();
    graphics.moveTo(cx, cy - tileH * 0.13);
    graphics.lineTo(cx, cy + tileH * 0.13);
    graphics.moveTo(cx - tileW * 0.09, cy);
    graphics.lineTo(cx + tileW * 0.09, cy);
    graphics.strokePath();
    graphics.fillStyle(env.accent, 0.55);
    graphics.fillCircle(cx, cy, 1.8);
    return;
  }

  if (env.kind === "embers") {
    graphics.lineStyle(1.1, env.glow, 0.65);
    graphics.beginPath();
    graphics.moveTo(cx - tileW * 0.1, cy + tileH * 0.04);
    graphics.lineTo(cx - 2, cy - tileH * 0.05);
    graphics.lineTo(cx + tileW * 0.08, cy + tileH * 0.02);
    graphics.strokePath();
    graphics.fillStyle(env.accent, 0.68);
    graphics.fillCircle(cx - 6, cy - 3, 1.6);
    graphics.fillCircle(cx + 5, cy - 1, 1.5);
    return;
  }

  if (env.kind === "grass") {
    graphics.lineStyle(1.3, env.glow, 0.55);
    for (let i = 0; i < 3; i += 1) {
      const ox = (i - 1) * 4;
      graphics.beginPath();
      graphics.moveTo(cx + ox, cy + 4);
      graphics.lineTo(cx + ox - 1, cy - 5);
      graphics.strokePath();
    }
    graphics.fillStyle(env.accent, 0.45);
    graphics.fillCircle(cx + 5, cy - 1, 1.6);
  }
}

export function paintGrassTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  col: number,
  tileW: number,
  tileH: number
): void {
  const { fill, stroke } = getGrassTileStyle(row, col);
  graphics.fillStyle(fill, 0.72);
  graphics.lineStyle(1, stroke, 0.92);
  drawDiamond(graphics, x, y, tileW, tileH);

  graphics.lineStyle(1, UI_COLORS.grassHighlight, 0.2);
  graphics.beginPath();
  graphics.moveTo(x - tileW / 2 + 4, y);
  graphics.lineTo(x, y - tileH / 2 + 2);
  graphics.lineTo(x + tileW / 2 - 4, y);
  graphics.strokePath();

  drawEnvironmentCellOverlay(graphics, x, y, row, col, tileW, tileH);
}

export function paintRiverTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  tileW: number,
  tileH: number
): void {
  const w = tileW;
  const h = tileH;
  const even = row % 2 === 0;
  const fill = even ? UI_COLORS.riverA : UI_COLORS.riverB;
  const edge = even ? UI_COLORS.riverEdgeA : UI_COLORS.riverEdgeB;
  graphics.fillStyle(fill, 0.94);
  graphics.lineStyle(1, edge, 0.92);
  graphics.beginPath();
  graphics.moveTo(x, y - h / 2);
  graphics.lineTo(x + w / 2, y);
  graphics.lineTo(x, y + h / 2);
  graphics.lineTo(x - w / 2, y);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  graphics.lineStyle(1, UI_COLORS.riverHighlight, 0.26);
  graphics.beginPath();
  graphics.moveTo(x - w / 2 + 3, y);
  graphics.lineTo(x, y - h / 2 + 2);
  graphics.lineTo(x + w / 2 - 3, y);
  graphics.strokePath();
}

export function getRoleTheme(classType: ClassType | string): RoleThemeEntry {
  return (ROLE_THEME as Record<string, RoleThemeEntry>)[classType] ?? ROLE_THEME.FIGHTER;
}

export function paintGrassTile3D(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  col: number,
  tileW: number,
  tileH: number
): void {
  const { fill, stroke } = getGrassTileStyle(row, col);
  const even = (row + col) % 2 === 0;

  const depth = 6;
  const darkFill = even ? 0x3d6d2a : 0x336625;
  graphics.fillStyle(darkFill, 0.85);
  graphics.beginPath();
  graphics.moveTo(x, y + tileH / 2);
  graphics.lineTo(x + tileW / 2, y);
  graphics.lineTo(x + tileW / 2, y + depth);
  graphics.lineTo(x, y + tileH / 2 + depth);
  graphics.closePath();
  graphics.fillPath();

  const shadowFill = even ? 0x325a22 : 0x2d5320;
  graphics.fillStyle(shadowFill, 0.7);
  graphics.beginPath();
  graphics.moveTo(x, y + tileH / 2);
  graphics.lineTo(x - tileW / 2, y);
  graphics.lineTo(x - tileW / 2, y + depth);
  graphics.lineTo(x, y + tileH / 2 + depth);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(fill, 0.85);
  graphics.lineStyle(1.5, stroke, 0.95);
  drawDiamond(graphics, x, y, tileW, tileH);

  graphics.lineStyle(2, UI_COLORS.grassHighlight, 0.35);
  graphics.beginPath();
  graphics.moveTo(x - tileW / 2 + 3, y);
  graphics.lineTo(x, y - tileH / 2 + 2);
  graphics.strokePath();

  graphics.lineStyle(1, 0x2a4d1a, 0.3);
  graphics.beginPath();
  graphics.moveTo(x + tileW / 2 - 3, y);
  graphics.lineTo(x, y + tileH / 2 - 2);
  graphics.strokePath();

  const grassColor = even ? 0x8fcf6a : 0x7bc05a;
  graphics.lineStyle(1, grassColor, 0.25);
  const seed = (row * 7 + col * 13) % 5;
  for (let i = 0; i < 3; i += 1) {
    const ox = ((seed + i * 11) % 7 - 3) * tileW * 0.06;
    const oy = ((seed + i * 7) % 5 - 2) * tileH * 0.08;
    graphics.beginPath();
    graphics.moveTo(x + ox, y + oy);
    graphics.lineTo(x + ox - 2, y + oy - 5);
    graphics.strokePath();
  }

  const seamGlow = col <= PLAYER_COLS ? NEON.ally : NEON.enemy;
  if (col === PLAYER_COLS - 1 || col === PLAYER_COLS) {
    graphics.lineStyle(1.3, col < PLAYER_COLS ? NEON.ally : NEON.enemy, 0.28);
    graphics.beginPath();
    graphics.moveTo(x, y - tileH / 2);
    graphics.lineTo(col < PLAYER_COLS ? x + tileW / 2 : x - tileW / 2, y);
    graphics.lineTo(x, y + tileH / 2);
    graphics.strokePath();
  } else if (col === 0 || col === COLS - 1) {
    graphics.lineStyle(1.1, seamGlow, 0.16);
    graphics.beginPath();
    graphics.moveTo(x, y - tileH / 2);
    graphics.lineTo(col === 0 ? x - tileW / 2 : x + tileW / 2, y);
    graphics.strokePath();
  }

  drawEnvironmentCellOverlay(graphics, x, y, row, col, tileW, tileH);
}

export function paintRiverTile3D(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  tileW: number,
  tileH: number
): void {
  const even = row % 2 === 0;
  const fill = even ? UI_COLORS.riverA : UI_COLORS.riverB;
  const edge = even ? UI_COLORS.riverEdgeA : UI_COLORS.riverEdgeB;

  const depth = 6;
  graphics.fillStyle(0x0a3d6d, 0.8);
  graphics.beginPath();
  graphics.moveTo(x, y + tileH / 2);
  graphics.lineTo(x + tileW / 2, y);
  graphics.lineTo(x + tileW / 2, y + depth);
  graphics.lineTo(x, y + tileH / 2 + depth);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(0x083050, 0.7);
  graphics.beginPath();
  graphics.moveTo(x, y + tileH / 2);
  graphics.lineTo(x - tileW / 2, y);
  graphics.lineTo(x - tileW / 2, y + depth);
  graphics.lineTo(x, y + tileH / 2 + depth);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(fill, 0.92);
  graphics.lineStyle(1.5, edge, 0.95);
  drawDiamond(graphics, x, y, tileW, tileH);

  graphics.lineStyle(1, UI_COLORS.riverHighlight, 0.35);
  graphics.beginPath();
  graphics.moveTo(x - tileW * 0.25, y - tileH * 0.05);
  graphics.lineTo(x + tileW * 0.15, y - tileH * 0.12);
  graphics.strokePath();

  graphics.lineStyle(1, 0xffffff, 0.2);
  graphics.beginPath();
  graphics.moveTo(x - tileW * 0.1, y + tileH * 0.08);
  graphics.lineTo(x + tileW * 0.2, y + tileH * 0.02);
  graphics.strokePath();

  graphics.lineStyle(1.4, NEON.river, 0.28);
  graphics.beginPath();
  graphics.moveTo(x - tileW * 0.14, y - tileH * 0.02);
  graphics.lineTo(x + tileW * 0.04, y - tileH * 0.09);
  graphics.lineTo(x + tileW * 0.19, y - tileH * 0.02);
  graphics.strokePath();
}

function resolveSceneBoardProfile(
  scene: BoardScene | null | undefined,
  boardProfile: string | BoardProfile = "solo"
): BoardProfile {
  const activeProfile = typeof scene?.getBoardProfileId === "function"
    ? scene.getBoardProfileId()
    : boardProfile;
  return getBoardProfile(activeProfile as string) as unknown as BoardProfile;
}

function collectBounds(
  scene: BoardScene,
  tileW: number,
  tileH: number,
  fromCol: number,
  toCol: number,
  fromRow: number = 0,
  toRow: number = ROWS - 1
): BoundsRect {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      const point = scene.gridToScreen(col, row);
      minX = Math.min(minX, point.x - tileW / 2);
      maxX = Math.max(maxX, point.x + tileW / 2);
      minY = Math.min(minY, point.y - tileH / 2);
      maxY = Math.max(maxY, point.y + tileH / 2);
    }
  }

  return { left: minX, right: maxX, top: minY, bottom: maxY };
}

export function computeBattlefieldMetrics(
  scene: BoardScene,
  tileW: number,
  tileH: number,
  boardProfile: string | BoardProfile = "solo"
): BattlefieldMetrics {
  const profile = resolveSceneBoardProfile(scene, boardProfile);
  const rowCount = typeof scene?.getBoardRowCount === "function"
    ? scene.getBoardRowCount()
    : getBattlefieldRowCount(profile);
  const logicalCols = profile.logicalCols ?? COLS;
  const panel: PanelRect = {
    x: scene.layout?.boardPanelX ?? 0,
    y: scene.layout?.boardPanelY ?? 0,
    w: scene.layout?.boardPanelW ?? 0,
    h: scene.layout?.boardPanelH ?? 0
  };
  const boardBounds = collectBounds(scene, tileW, tileH, 0, logicalCols - 1, 0, rowCount - 1);
  const allyBounds = collectBounds(scene, tileW, tileH, 0, PLAYER_COLS - 1, 0, rowCount - 1);
  const enemyBounds = collectBounds(
    scene,
    tileW,
    tileH,
    profile.enemyColStart ?? PLAYER_COLS,
    profile.enemyColEnd ?? (logicalCols - 1),
    0,
    rowCount - 1
  );
  const seamPoints: Point[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const a = scene.gridToScreen(PLAYER_COLS - 1, row);
    const b = scene.gridToScreen(profile.enemyColStart ?? PLAYER_COLS, row);
    seamPoints.push({
      x: (a.x + b.x) * 0.5,
      y: (a.y + b.y) * 0.5 - tileH * 0.04
    });
  }

  return { panel, boardBounds, allyBounds, enemyBounds, seamPoints, tileW, tileH };
}

export function computeCoopOwnershipMarkers(
  scene: BoardScene,
  tileW: number,
  tileH: number,
  localSlot: string = "P1",
  boardProfile: string | BoardProfile = "coop"
): CoopOwnershipMarker[] {
  const resolvedLocalSlot = normalizePlayerSlot(localSlot);
  const profile = resolveSceneBoardProfile(scene, boardProfile);
  const slots = getBoardPlayerSlots(profile);
  return slots.map((slot) => {
    const bounds = getPlayerRowBounds(profile, slot);
    const halfBounds = collectBounds(scene, tileW, tileH, 0, PLAYER_COLS - 1, bounds.startRow, bounds.endRow);
    const isLocal = slot === resolvedLocalSlot;
    return {
      slot,
      bounds,
      boardBounds: halfBounds,
      isLocal,
      label: isLocal ? `${slot} • BAN` : `${slot} • DONG DOI`,
      accent: isLocal ? NEON.allyLocal : NEON.ally,
      accentSoft: isLocal ? NEON.allyLocalSoft : NEON.allySoft
    };
  });
}

export function drawCoopOwnershipOverlay(
  scene: BoardScene,
  graphics: Phaser.GameObjects.Graphics,
  localSlot: string = "P1",
  boardProfile: string | BoardProfile = "coop"
): CoopOwnershipMarker[] {
  if (!graphics || typeof scene?.getTileSize !== "function") return [];
  const { tileW, tileH } = scene.getTileSize();
  const markers = computeCoopOwnershipMarkers(scene, tileW, tileH, localSlot, boardProfile);

  markers.forEach((marker) => {
    const { boardBounds, isLocal, accent, accentSoft } = marker;
    const padX = tileW * 0.18;
    const padY = tileH * 0.34;
    const width = boardBounds.right - boardBounds.left + padX * 2;
    const height = boardBounds.bottom - boardBounds.top + padY * 1.8;
    const x = boardBounds.left - padX;
    const y = boardBounds.top - padY;

    graphics.fillStyle(accent, isLocal ? 0.12 : 0.05);
    graphics.fillRoundedRect(x, y, width, height, 18);
    graphics.lineStyle(isLocal ? 2.4 : 1.5, accent, isLocal ? 0.7 : 0.38);
    graphics.strokeRoundedRect(x, y, width, height, 18);

    graphics.lineStyle(1.2, accentSoft, isLocal ? 0.48 : 0.24);
    graphics.strokeRoundedRect(x + 5, y + 5, width - 10, height - 10, 14);

    const chipW = isLocal ? 108 : 132;
    const chipH = 22;
    const chipX = x + 10;
    const chipY = y + 10;
    graphics.fillStyle(0x05111b, isLocal ? 0.86 : 0.72);
    graphics.fillRoundedRect(chipX, chipY, chipW, chipH, 10);
    graphics.lineStyle(1.4, accentSoft, isLocal ? 0.72 : 0.36);
    graphics.strokeRoundedRect(chipX, chipY, chipW, chipH, 10);
  });

  return markers;
}

export function shouldDrawFortressStrongholds(scene: BoardScene | null | undefined): boolean {
  return scene?.gameModeConfig?.fortressMode === true && scene?.gameModeConfig?.renderStrongholds !== false;
}

function drawFortressStronghold(
  backdrop: Phaser.GameObjects.Graphics | null | undefined,
  fx: Phaser.GameObjects.Graphics | null | undefined,
  anchorX: number,
  anchorY: number,
  side: "ally" | "enemy" = "ally",
  scale: number = 1
): void {
  const dir = side === "ally" ? 1 : -1;
  const s = Math.max(0.78, Math.min(1.28, scale));
  const palette = side === "ally"
    ? {
        wall: 0x274e62,
        wallLight: 0x4f93b3,
        tower: 0x163344,
        roof: 0x2b6f58,
        roofLight: 0x68d6a1,
        gate: 0x0c1722,
        glow: NEON.allyLocal,
        glowSoft: NEON.allySoft,
        banner: 0x8fd8ff
      }
    : {
        wall: 0x5b2634,
        wallLight: 0xaa566d,
        tower: 0x34131d,
        roof: 0x7b3927,
        roofLight: 0xff9d52,
        gate: 0x17090e,
        glow: NEON.enemy,
        glowSoft: NEON.enemySoft,
        banner: 0xff7d9c
      };

  if (backdrop) {
    backdrop.fillStyle(0x03070c, 0.22);
    backdrop.fillEllipse(anchorX, anchorY + 28 * s, 82 * s, 24 * s);

    backdrop.fillStyle(palette.tower, 0.92);
    backdrop.fillRoundedRect(anchorX - 36 * s, anchorY - 22 * s, 18 * s, 46 * s, 6 * s);
    backdrop.fillRoundedRect(anchorX + 18 * s, anchorY - 22 * s, 18 * s, 46 * s, 6 * s);

    backdrop.fillStyle(palette.wall, 0.96);
    backdrop.fillRoundedRect(anchorX - 24 * s, anchorY - 8 * s, 48 * s, 28 * s, 8 * s);
    backdrop.fillStyle(palette.wallLight, 0.5);
    backdrop.fillRoundedRect(anchorX - 18 * s, anchorY - 3 * s, 36 * s, 10 * s, 5 * s);

    backdrop.fillStyle(palette.gate, 0.96);
    backdrop.fillRoundedRect(anchorX - 8 * s, anchorY + 2 * s, 16 * s, 18 * s, 5 * s);

    backdrop.fillStyle(palette.roof, 0.96);
    backdrop.beginPath();
    backdrop.moveTo(anchorX - 12 * s, anchorY - 8 * s);
    backdrop.lineTo(anchorX, anchorY - 23 * s);
    backdrop.lineTo(anchorX + 12 * s, anchorY - 8 * s);
    backdrop.closePath();
    backdrop.fillPath();

    backdrop.fillStyle(palette.roofLight, 0.82);
    backdrop.beginPath();
    backdrop.moveTo(anchorX - 3 * s, anchorY - 20 * s);
    backdrop.lineTo(anchorX, anchorY - 23 * s);
    backdrop.lineTo(anchorX + 9 * s, anchorY - 10 * s);
    backdrop.lineTo(anchorX + 1 * s, anchorY - 12 * s);
    backdrop.closePath();
    backdrop.fillPath();

    backdrop.fillStyle(palette.roof, 0.95);
    backdrop.beginPath();
    backdrop.moveTo(anchorX - 39 * s, anchorY - 22 * s);
    backdrop.lineTo(anchorX - 27 * s, anchorY - 35 * s);
    backdrop.lineTo(anchorX - 15 * s, anchorY - 22 * s);
    backdrop.closePath();
    backdrop.fillPath();
    backdrop.beginPath();
    backdrop.moveTo(anchorX + 15 * s, anchorY - 22 * s);
    backdrop.lineTo(anchorX + 27 * s, anchorY - 35 * s);
    backdrop.lineTo(anchorX + 39 * s, anchorY - 22 * s);
    backdrop.closePath();
    backdrop.fillPath();

    backdrop.fillStyle(palette.roofLight, 0.72);
    backdrop.beginPath();
    backdrop.moveTo(anchorX - 31 * s, anchorY - 31 * s);
    backdrop.lineTo(anchorX - 27 * s, anchorY - 35 * s);
    backdrop.lineTo(anchorX - 20 * s, anchorY - 24 * s);
    backdrop.closePath();
    backdrop.fillPath();
    backdrop.beginPath();
    backdrop.moveTo(anchorX + 23 * s, anchorY - 24 * s);
    backdrop.lineTo(anchorX + 27 * s, anchorY - 35 * s);
    backdrop.lineTo(anchorX + 31 * s, anchorY - 31 * s);
    backdrop.closePath();
    backdrop.fillPath();

    backdrop.fillStyle(palette.banner, 0.82);
    backdrop.fillRect(anchorX - 2 * s, anchorY - 32 * s, 4 * s, 12 * s);
    backdrop.beginPath();
    backdrop.moveTo(anchorX + 2 * s, anchorY - 31 * s);
    backdrop.lineTo(anchorX + dir * 14 * s, anchorY - 27 * s);
    backdrop.lineTo(anchorX + dir * 8 * s, anchorY - 19 * s);
    backdrop.lineTo(anchorX + 2 * s, anchorY - 21 * s);
    backdrop.closePath();
    backdrop.fillPath();

    backdrop.fillStyle(palette.glowSoft, 0.55);
    backdrop.fillRect(anchorX - 15 * s, anchorY + 4 * s, 4 * s, 6 * s);
    backdrop.fillRect(anchorX + 11 * s, anchorY + 4 * s, 4 * s, 6 * s);
    backdrop.fillCircle(anchorX - 28 * s, anchorY - 4 * s, 2.1 * s);
    backdrop.fillCircle(anchorX + 28 * s, anchorY - 4 * s, 2.1 * s);

    for (let i = -1; i <= 1; i += 1) {
      backdrop.fillStyle(palette.wallLight, 0.9);
      backdrop.fillRect(anchorX + (i * 10 - 3) * s, anchorY - 15 * s, 6 * s, 5 * s);
    }
  }

  if (fx) {
    fx.fillStyle(palette.glow, 0.1);
    fx.fillEllipse(anchorX, anchorY + 24 * s, 108 * s, 34 * s);
    fx.lineStyle(2.2, palette.glow, 0.35);
    fx.strokeRoundedRect(anchorX - 27 * s, anchorY - 11 * s, 54 * s, 31 * s, 10 * s);
    fx.lineStyle(1.6, palette.glowSoft, 0.42);
    fx.beginPath();
    fx.moveTo(anchorX + dir * 20 * s, anchorY + 20 * s);
    fx.lineTo(anchorX + dir * 46 * s, anchorY + 26 * s);
    fx.lineTo(anchorX + dir * 68 * s, anchorY + 16 * s);
    fx.strokePath();
    fx.fillStyle(palette.glowSoft, 0.42);
    fx.fillCircle(anchorX + dir * 48 * s, anchorY + 25 * s, 2.1 * s);
    fx.fillCircle(anchorX + dir * 68 * s, anchorY + 16 * s, 1.7 * s);
  }
}

function drawFortressStrongholds(
  scene: BoardScene,
  metrics: BattlefieldMetrics,
  layers: BoardEnvironmentLayers = {},
  boardProfile: string | BoardProfile = "solo"
): void {
  if (!shouldDrawFortressStrongholds(scene)) return;
  const profile = resolveSceneBoardProfile(scene, boardProfile);
  const { tileW, tileH } = metrics;
  const centerRow = Math.floor((getBattlefieldRowCount(profile) - 1) / 2);
  const allyBase = scene.gridToScreen(0, centerRow);
  const enemyBase = scene.gridToScreen((profile.logicalCols ?? COLS) - 1, centerRow);
  const scale = tileW / 96;

  drawFortressStronghold(
    layers.backdrop ?? null,
    layers.fx ?? null,
    allyBase.x - tileW * 0.78,
    allyBase.y - tileH * 0.48,
    "ally",
    scale
  );
  drawFortressStronghold(
    layers.backdrop ?? null,
    layers.fx ?? null,
    enemyBase.x + tileW * 0.78,
    enemyBase.y - tileH * 0.48,
    "enemy",
    scale
  );
}

function drawBanner(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  glow: number,
  flip: boolean = false
): void {
  const dir = flip ? -1 : 1;
  graphics.lineStyle(3, NEON.pole, 0.9);
  graphics.beginPath();
  graphics.moveTo(x, y);
  graphics.lineTo(x, y - 78);
  graphics.lineTo(x + dir * 28, y - 78);
  graphics.strokePath();

  graphics.fillStyle(color, 0.18);
  graphics.lineStyle(2, glow, 0.7);
  graphics.beginPath();
  graphics.moveTo(x, y - 64);
  graphics.lineTo(x + dir * 25, y - 58);
  graphics.lineTo(x + dir * 21, y - 16);
  graphics.lineTo(x + dir * 14, y - 10);
  graphics.lineTo(x, y - 14);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  graphics.fillStyle(glow, 0.35);
  graphics.fillCircle(x + dir * 6, y - 58, 2);
  graphics.fillCircle(x + dir * 14, y - 52, 2);
}

function drawSkyline(graphics: Phaser.GameObjects.Graphics, panel: PanelRect): void {
  const baseY = panel.y + panel.h * 0.23;
  for (let i = 0; i < 10; i += 1) {
    const width = 22 + (i % 3) * 10;
    const height = 34 + (i % 4) * 14;
    const x = panel.x + panel.w * 0.28 + i * (width - 2);
    const y = baseY - height;
    graphics.fillStyle(0x08111d, 0.5);
    graphics.fillRect(x, y, width, height);
    const light = i % 2 === 0 ? NEON.skylineBlue : NEON.skylinePink;
    graphics.fillStyle(light, 0.18);
    graphics.fillRect(x + 4, y + 8, 4, 3);
    graphics.fillRect(x + width - 9, y + 14, 3, 3);
  }
}

function drawBoardAura(
  graphics: Phaser.GameObjects.Graphics,
  bounds: BoundsRect,
  tileW: number,
  tileH: number,
  color: number
): void {
  graphics.fillStyle(color, 0.06);
  graphics.fillEllipse(
    (bounds.left + bounds.right) * 0.5,
    (bounds.top + bounds.bottom) * 0.5 + tileH * 0.3,
    bounds.right - bounds.left + tileW * 0.6,
    bounds.bottom - bounds.top + tileH * 0.9
  );

  graphics.lineStyle(2, color, 0.18);
  graphics.strokeEllipse(
    (bounds.left + bounds.right) * 0.5,
    (bounds.top + bounds.bottom) * 0.5 + tileH * 0.3,
    bounds.right - bounds.left + tileW * 0.28,
    bounds.bottom - bounds.top + tileH * 0.54
  );
}

function drawRiverAura(
  graphics: Phaser.GameObjects.Graphics,
  seamPoints: Point[],
  tileW: number,
  tileH: number
): void {
  const flow: Point[] = seamPoints.map((point, index) => ({
    x: point.x + (index % 2 === 0 ? tileW * 0.05 : -tileW * 0.04),
    y: point.y + (index - 2) * tileH * 0.05
  }));
  strokePolyline(graphics, flow, Math.max(12, tileH * 0.5), NEON.river, 0.18);
  strokePolyline(graphics, flow, Math.max(4, tileH * 0.16), NEON.riverSoft, 0.42);
}

function drawAmbientProps(graphics: Phaser.GameObjects.Graphics, panel: PanelRect): void {
  drawForestTree(graphics, panel.x + 70, panel.y + panel.h * 0.58, 1.2, 1);
  drawForestTree(graphics, panel.x + 108, panel.y + panel.h * 0.52, 0.9, 0);
  drawBattlefieldRock(graphics, panel.x + 58, panel.y + panel.h * 0.84, 1.05);
  drawGlowingMushroom(graphics, panel.x + 112, panel.y + panel.h * 0.81, 1.1);
  drawGrassCluster(graphics, panel.x + 134, panel.y + panel.h * 0.87, 1.2);

  drawBattlefieldRock(graphics, panel.x + panel.w - 84, panel.y + panel.h * 0.78, 1.15);
  drawBattlefieldRock(graphics, panel.x + panel.w - 124, panel.y + panel.h * 0.87, 0.95);
  drawGlowingMushroom(graphics, panel.x + panel.w - 102, panel.y + panel.h * 0.9, 0.95);
}

function drawAtmosphericFx(
  graphics: Phaser.GameObjects.Graphics,
  panel: PanelRect,
  seamPoints: Point[]
): void {
  for (let i = 0; i < 14; i += 1) {
    const x = panel.x + 26 + ((i * 67) % Math.max(40, Math.floor(panel.w - 52)));
    const y = panel.y + 10 + ((i * 89) % Math.max(40, Math.floor(panel.h * 0.56)));
    graphics.lineStyle(1, 0xcfe2ff, 0.08 + (i % 3) * 0.04);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x - 8, y + 18);
    graphics.strokePath();
  }

  for (let i = 0; i < 16; i += 1) {
    const x = panel.x + panel.w * (0.08 + (i / 16) * 0.84);
    const y = panel.y + panel.h * (0.36 + ((i * 3) % 7) * 0.05);
    const color: number = i % 3 === 0 ? NEON.magenta : i % 3 === 1 ? NEON.ember : NEON.river;
    graphics.fillStyle(color, 0.18 + (i % 4) * 0.05);
    graphics.fillCircle(x, y, 1.9 + (i % 2) * 0.5);
  }

  seamPoints.forEach((point, index) => {
    graphics.fillStyle(NEON.riverSoft, 0.16);
    graphics.fillCircle(
      point.x + (index % 2 === 0 ? 10 : -8),
      point.y + 10 + index,
      2.1
    );
  });
}

export function drawBattlefieldEnvironment(
  scene: BoardScene,
  layers: BoardEnvironmentLayers = {},
  boardProfile: string | BoardProfile = "solo"
): BattlefieldMetrics | null {
  const { backdrop, fx } = layers;
  if (!scene?.layout || typeof scene.gridToScreen !== "function" || typeof scene.getTileSize !== "function") {
    return null;
  }

  const { tileW, tileH } = scene.getTileSize();
  const metrics = computeBattlefieldMetrics(scene, tileW, tileH, boardProfile);
  backdrop?.clear();
  fx?.clear();

  if (backdrop) {
    drawBoardAura(backdrop, metrics.allyBounds, tileW, tileH, NEON.ally);
    drawBoardAura(backdrop, metrics.enemyBounds, tileW, tileH, NEON.enemy);
    drawRiverAura(backdrop, metrics.seamPoints, tileW, tileH);
  }

  return metrics;
}

export function drawForestTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number = 1,
  variant: number = 0
): void {
  const s = size;

  g.fillStyle(0x4a2f1a, 0.9);
  g.fillRect(x - 3 * s, y - 2 * s, 6 * s, 14 * s);
  g.fillStyle(0x5c3c22, 0.5);
  g.fillRect(x - 1 * s, y - 2 * s, 3 * s, 14 * s);

  if (variant === 0 || variant === 2) {
    const layers = variant === 2 ? 4 : 3;
    for (let i = 0; i < layers; i += 1) {
      const ly = y - (6 + i * 9) * s;
      const lw = (16 - i * 2.5) * s;
      const lh = 12 * s;

      g.fillStyle(0x1a5c2a, 0.85);
      g.beginPath();
      g.moveTo(x, ly - lh);
      g.lineTo(x + lw / 2, ly);
      g.lineTo(x - lw / 2, ly);
      g.closePath();
      g.fillPath();

      g.fillStyle(0x2d8c42, 0.8);
      g.beginPath();
      g.moveTo(x, ly - lh);
      g.lineTo(x + lw / 2 - 2 * s, ly - 1 * s);
      g.lineTo(x - 2 * s, ly);
      g.closePath();
      g.fillPath();
    }
  } else {
    const canopyY = y - 12 * s;
    const canopyR = 14 * s;
    g.fillStyle(0x1a5c2a, 0.85);
    g.fillCircle(x + 1, canopyY + 1, canopyR);
    g.fillStyle(0x3d9e55, 0.8);
    g.fillCircle(x, canopyY, canopyR);
    g.fillStyle(0x6ec47e, 0.4);
    g.fillCircle(x - 4 * s, canopyY - 4 * s, canopyR * 0.5);
  }
}

export function drawBattlefieldRock(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number = 1
): void {
  const s = size;
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(x + 2, y + 6 * s, 16 * s, 6 * s);

  g.fillStyle(0x5a5f6b, 0.9);
  g.beginPath();
  g.moveTo(x - 8 * s, y + 4 * s);
  g.lineTo(x - 6 * s, y - 6 * s);
  g.lineTo(x + 2 * s, y - 8 * s);
  g.lineTo(x + 8 * s, y - 4 * s);
  g.lineTo(x + 9 * s, y + 3 * s);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x7d8491, 0.6);
  g.beginPath();
  g.moveTo(x - 6 * s, y - 6 * s);
  g.lineTo(x + 2 * s, y - 8 * s);
  g.lineTo(x + 4 * s, y - 2 * s);
  g.lineTo(x - 3 * s, y - 1 * s);
  g.closePath();
  g.fillPath();

  g.fillStyle(0x5a8c3a, 0.35);
  g.fillCircle(x - 2 * s, y - 3 * s, 3 * s);
}

export function drawGlowingMushroom(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number = 1
): void {
  const s = size;
  g.fillStyle(0xd4c4a8, 0.8);
  g.fillRect(x - 2 * s, y, 4 * s, 8 * s);
  g.fillStyle(0x3d2a5c, 0.7);
  g.fillEllipse(x, y, 10 * s, 6 * s);
  g.fillStyle(0x6b4fa0, 0.6);
  g.fillEllipse(x, y - 1 * s, 8 * s, 4 * s);
  g.fillStyle(0x88ddff, 0.5);
  g.fillCircle(x - 2 * s, y - 1 * s, 1.5 * s);
  g.fillCircle(x + 2 * s, y, 1 * s);
}

export function drawGrassCluster(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number = 1
): void {
  const s = size;
  g.lineStyle(1.5, 0x6eaf4d, 0.3);

  for (let i = 0; i < 3; i += 1) {
    const ox = (i - 1) * 4 * s;
    g.beginPath();
    g.moveTo(x + ox, y);
    g.lineTo(x + ox - 1 * s, y - 8 * s);
    g.strokePath();
  }
}

// Keep NeonKey exported for downstream consumers that may need it
export type { NeonKey };
