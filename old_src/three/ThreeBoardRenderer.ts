/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import * as THREE from "three";
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

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface RoleThemeEntry {
  fill: number;
  glow: number;
  stroke: number;
  card: number;
  cardHover: number;
  bench: number;
}

export interface EnvironmentCellStyle {
  kind: string;
  glow: number;
  accent: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoundsRect {
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
  seamPoints: Point2D[];
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

export interface BoardSceneLayoutLike {
  boardPanelX?: number;
  boardPanelY?: number;
  boardPanelW?: number;
  boardPanelH?: number;
}

export interface BoardSceneGameModeConfigLike {
  fortressMode?: boolean;
  renderStrongholds?: boolean;
}

export interface ThreeBoardSceneLike {
  layout?: BoardSceneLayoutLike | null;
  gameModeConfig?: BoardSceneGameModeConfigLike | null;
  gridToScreen(col: number, row: number): Point2D;
  getTileSize?(): { tileW: number; tileH: number };
  getBoardProfileId?(): string;
  getBoardRowCount?(): number;
  [key: string]: unknown;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 * Sources:
 * - src/ui/uiTheme.ts:38-50 (UI_COLORS palette: boardLeft, boardRight, grassA/B, riverA/B)
 * - src/ui/BoardRenderer.ts:45-80 (NEON palette & ENVIRONMENT_CELLS)
 */

export const NEON = {
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

export type NeonKey = keyof typeof NEON;

export const ENVIRONMENT_CELLS = new Map<string, EnvironmentCellStyle>([
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

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Returns alternating grass tile colors based on row and column parity.
 *
 * Source: src/ui/BoardRenderer.ts:180-186
 */
export function getGrassTileStyle(row: number, col: number): { fill: number; stroke: number } {
  const even = (row + col) % 2 === 0;
  if (even) {
    return { fill: UI_COLORS.grassA, stroke: UI_COLORS.grassEdgeA };
  }
  return { fill: UI_COLORS.grassB, stroke: UI_COLORS.grassEdgeB };
}

/**
 * Get environmental rune/lotus/water decoration for special board coordinates.
 *
 * Source: src/ui/BoardRenderer.ts:188-190
 */
export function getEnvironmentCellStyle(row: number, col: number): EnvironmentCellStyle | null {
  return ENVIRONMENT_CELLS.get(`${row},${col}`) ?? null;
}

/**
 * Resolve full battlefield tile style including faction edge glow and environment.
 *
 * Source: src/ui/BoardRenderer.ts:192-208
 */
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

/**
 * Resolve role theme colors for class types.
 *
 * Source: src/ui/BoardRenderer.ts:377-379
 */
export function getRoleTheme(classType: ClassType | string): RoleThemeEntry {
  const map = ROLE_THEME as Record<string, RoleThemeEntry>;
  return map[classType] ?? ROLE_THEME.FIGHTER;
}

/**
 * Calculate boundary metrics and river seam points for isometric battlefield view.
 *
 * Source: src/ui/BoardRenderer.ts:552-593
 */
export function computeBattlefieldMetrics(
  scene: ThreeBoardSceneLike,
  tileW: number,
  tileH: number,
  rowCount: number = ROWS,
  profileId: string = "solo"
): BattlefieldMetrics {
  const l = scene.layout ?? {};
  const panel: PanelRect = {
    x: l.boardPanelX ?? 0,
    y: l.boardPanelY ?? 0,
    w: l.boardPanelW ?? 1600,
    h: l.boardPanelH ?? 900
  };

  const a0 = scene.gridToScreen(0, 0);
  const aTop = scene.gridToScreen(PLAYER_COLS - 1, 0);
  const aBot = scene.gridToScreen(0, rowCount - 1);
  const aFar = scene.gridToScreen(PLAYER_COLS - 1, rowCount - 1);

  const e0 = scene.gridToScreen(PLAYER_COLS, 0);
  const eTop = scene.gridToScreen(COLS - 1, 0);
  const eBot = scene.gridToScreen(PLAYER_COLS, rowCount - 1);
  const eFar = scene.gridToScreen(COLS - 1, rowCount - 1);

  const allyBounds: BoundsRect = {
    left: Math.min(a0.x, aTop.x, aBot.x, aFar.x) - tileW * 0.5,
    right: Math.max(a0.x, aTop.x, aBot.x, aFar.x) + tileW * 0.5,
    top: Math.min(a0.y, aTop.y, aBot.y, aFar.y) - tileH * 0.5,
    bottom: Math.max(a0.y, aTop.y, aBot.y, aFar.y) + tileH * 0.5
  };

  const enemyBounds: BoundsRect = {
    left: Math.min(e0.x, eTop.x, eBot.x, eFar.x) - tileW * 0.5,
    right: Math.max(e0.x, eTop.x, eBot.x, eFar.x) + tileW * 0.5,
    top: Math.min(e0.y, eTop.y, eBot.y, eFar.y) - tileH * 0.5,
    bottom: Math.max(e0.y, eTop.y, eBot.y, eFar.y) + tileH * 0.5
  };

  const boardBounds: BoundsRect = {
    left: Math.min(allyBounds.left, enemyBounds.left),
    right: Math.max(allyBounds.right, enemyBounds.right),
    top: Math.min(allyBounds.top, enemyBounds.top),
    bottom: Math.max(allyBounds.bottom, enemyBounds.bottom)
  };

  const seamPoints: Point2D[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const leftCell = scene.gridToScreen(PLAYER_COLS - 1, r);
    const rightCell = scene.gridToScreen(PLAYER_COLS, r);
    seamPoints.push({
      x: (leftCell.x + rightCell.x) * 0.5,
      y: (leftCell.y + rightCell.y) * 0.5
    });
  }

  return {
    panel,
    boardBounds,
    allyBounds,
    enemyBounds,
    seamPoints,
    tileW,
    tileH
  };
}

/**
 * Compute coop player lane ownership markers and boundary rectangles.
 *
 * Source: src/ui/BoardRenderer.ts:595-618
 */
export function computeCoopOwnershipMarkers(
  scene: ThreeBoardSceneLike,
  tileW: number,
  tileH: number,
  localSlot: string = "P1",
  boardProfileId: string = "solo"
): CoopOwnershipMarker[] {
  const profile = getBoardProfile(boardProfileId);
  const slots = getBoardPlayerSlots(profile);
  const markers: CoopOwnershipMarker[] = [];

  for (const slot of slots) {
    const bounds = getPlayerRowBounds(profile, slot);
    const isLocal = normalizePlayerSlot(slot) === normalizePlayerSlot(localSlot);

    const topLeft = scene.gridToScreen(0, bounds.startRow);
    const topRight = scene.gridToScreen(PLAYER_COLS - 1, bounds.startRow);
    const botLeft = scene.gridToScreen(0, bounds.endRow - 1);
    const botRight = scene.gridToScreen(PLAYER_COLS - 1, bounds.endRow - 1);

    const boardBounds: BoundsRect = {
      left: Math.min(topLeft.x, topRight.x, botLeft.x, botRight.x) - tileW * 0.5,
      right: Math.max(topLeft.x, topRight.x, botLeft.x, botRight.x) + tileW * 0.5,
      top: Math.min(topLeft.y, topRight.y, botLeft.y, botRight.y) - tileH * 0.5,
      bottom: Math.max(topLeft.y, topRight.y, botLeft.y, botRight.y) + tileH * 0.5
    };

    markers.push({
      slot,
      bounds,
      boardBounds,
      isLocal,
      label: slot,
      accent: isLocal ? NEON.allyLocal : NEON.ally,
      accentSoft: isLocal ? NEON.allyLocalSoft : NEON.allySoft
    });
  }

  return markers;
}

/**
 * Check if fortress mode is active and strongholds should be rendered.
 *
 * Source: src/ui/BoardRenderer.ts:661-663
 */
export function shouldDrawFortressStrongholds(scene: ThreeBoardSceneLike | null | undefined): boolean {
  return scene?.gameModeConfig?.fortressMode === true && scene?.gameModeConfig?.renderStrongholds !== false;
}

/**
 * Creates a low-poly 3D Three.js mesh for a tile with standard lighting materials.
 */
export function create3DTileMesh(
  row: number,
  col: number,
  size: number = 2.0,
  spacing: number = 0.15
): THREE.Mesh {
  const style = getBattlefieldTileStyle(row, col);
  const isEnv = style.environment !== null;

  const width = size;
  const length = size;
  const height = isEnv ? 0.35 : 0.25;

  const geometry = new THREE.BoxGeometry(width, height, length);
  const material = new THREE.MeshStandardMaterial({
    color: style.fill,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Grid coordinates to 3D world positioning
  const offsetX = (COLS * (size + spacing)) / 2 - (size + spacing) / 2;
  const offsetZ = (ROWS * (size + spacing)) / 2 - (size + spacing) / 2;

  mesh.position.set(
    col * (size + spacing) - offsetX,
    height / 2,
    row * (size + spacing) - offsetZ
  );

  mesh.userData = { row, col, style };
  return mesh;
}
