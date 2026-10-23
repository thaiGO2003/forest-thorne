/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import type Phaser from "phaser";
import {
  getSharedTileSize as getThreeSharedTileSize,
  pointInSharedBoardPanel as pointInThreeSharedBoardPanel,
  gridToSharedBoardScreen as gridToThreeSharedBoardScreen,
  refreshSharedBoardGeometry as refreshThreeSharedBoardGeometry,
  zoomSharedBoardView as zoomThreeSharedBoardView,
  beginSharedBoardPan as beginThreeSharedBoardPan,
  updateSharedBoardPan as updateThreeSharedBoardPan,
  endSharedBoardPan as endThreeSharedBoardPan
} from "../../three/ThreeBoardViewport.js";
import type {
  ThreeBoardViewportHost,
  Point2D,
  GeometryOptions as ThreeGeometryOptions,
  ZoomOptions,
  PanOptions
} from "../../three/ThreeBoardViewport.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

type CellZoneEntry = { setPosition: (x: number, y: number) => void; setSize: (w: number, h: number) => void; active?: boolean };
type CellZone = { zone?: CellZoneEntry; row?: number; col?: number };
type BoardTile = { center: { x: number; y: number }; tile: { clear: () => void; active?: boolean; [key: string]: unknown } };
type GapToken = { clear: () => void; setDepth?: (d: number) => void };

export type Pointer = { x: number; y: number };

export type BoardViewportScene = Phaser.Scene & ThreeBoardViewportHost & {
  playerCellZones: CellZone[];
  tileLookup: Map<string, BoardTile>;
  gridToScreen: (col: number, row: number) => { x: number; y: number };
  toVisualCol: (col: number) => number;
  getTileSize: () => { tileW: number; tileH: number };
  originX: number;
  originY: number;
  boardPanX: number;
  boardPanY: number;
  boardZoom: number;
  boardPointerDown: Pointer | null;
  lastDragPoint: Pointer | null;
  isBoardDragging: boolean;
  boardDragConsumed: boolean;
  gapMarkers: GapToken[];
  refreshBoardEdgeLabels?: () => void;
  previewHoverUnit?: unknown;
  showAttackPreviewForUnit?: (u: unknown) => void;
  clearHighlights?: () => void;
  pointInBoardPanel?: (x: number, y: number) => boolean;
  refreshBoardGeometry?: () => void;
  time: { delayedCall: (ms: number, cb: () => void) => Phaser.Time.TimerEvent };
  [key: string]: unknown;
};

type PaintRiver = (scene: Phaser.Scene, token: GapToken, x: number, y: number, row: number) => void;
type PaintTile = (scene: Phaser.Scene, tile: Phaser.GameObjects.GameObject, x: number, y: number, row: number, col: number) => void;

export type GeometryOptions = {
  rows: number;
  cols: number;
  riverLayerDepth?: number;
  paintTile?: PaintTile;
  paintRiver?: PaintRiver;
  onRefreshBoardUi?: (scene: BoardViewportScene) => void;
  onRefreshCombatUnits?: (scene: BoardViewportScene) => void;
  onAfterRefresh?: (scene: BoardViewportScene) => void;
};

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

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

export function getSharedTileSize(scene: BoardViewportScene, tileW: number, tileH: number): { tileW: number; tileH: number } {
  return getThreeSharedTileSize(scene, tileW, tileH);
}

export function pointInSharedBoardPanel(scene: BoardViewportScene, x: number, y: number): boolean {
  return pointInThreeSharedBoardPanel(scene, x, y);
}

export function gridToSharedBoardScreen(scene: BoardViewportScene, col: number, row: number): { x: number; y: number } {
  return gridToThreeSharedBoardScreen(scene, col, row);
}

export function refreshSharedBoardGeometry(scene: BoardViewportScene, options: GeometryOptions): void {
  refreshThreeSharedBoardGeometry(scene, options as unknown as ThreeGeometryOptions);
}

export function zoomSharedBoardView(
  scene: BoardViewportScene,
  pointer: Pointer,
  dy: number,
  options: ZoomOptions = {}
): boolean {
  return zoomThreeSharedBoardView(scene, pointer, dy, options);
}

export function beginSharedBoardPan(
  scene: BoardViewportScene,
  pointer: Pointer,
  options: PanOptions = {}
): boolean {
  return beginThreeSharedBoardPan(scene, pointer, options);
}

export function updateSharedBoardPan(
  scene: BoardViewportScene,
  pointer: Pointer,
  options: PanOptions = {}
): boolean {
  return updateThreeSharedBoardPan(scene, pointer, options);
}

export function endSharedBoardPan(scene: BoardViewportScene, _options?: PanOptions): boolean {
  return endThreeSharedBoardPan(scene);
}

export const finishSharedBoardPan = endSharedBoardPan;
