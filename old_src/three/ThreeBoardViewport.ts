/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */
import { gridKey, clamp } from "../core/gameUtils.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface CellZoneEntryLike {
  setPosition(x: number, y: number): void;
  setSize(w: number, h: number): void;
  active?: boolean;
}

export interface CellZoneLike {
  zone?: CellZoneEntryLike;
  row?: number;
  col?: number;
}

export interface BoardTileLike {
  center: Point2D;
  tile: {
    clear(): void;
    active?: boolean;
    [key: string]: unknown;
  };
}

export interface GapTokenLike {
  clear(): void;
  setDepth?(d: number): void;
}

export interface ThreeBoardViewportHost {
  playerCellZones: CellZoneLike[];
  tileLookup: Map<string, BoardTileLike>;
  gridToScreen(col: number, row: number): Point2D;
  toVisualCol(col: number): number;
  getTileSize(): { tileW: number; tileH: number };
  originX: number;
  originY: number;
  boardPanX: number;
  boardPanY: number;
  boardZoom: number;
  boardPointerDown: Point2D | null;
  lastDragPoint: Point2D | null;
  isBoardDragging: boolean;
  boardDragConsumed: boolean;
  gapMarkers: GapTokenLike[];
  refreshBoardEdgeLabels?(): void;
  previewHoverUnit?: unknown;
  showAttackPreviewForUnit?(u: unknown): void;
  clearHighlights?(): void;
  pointInBoardPanel?(x: number, y: number): boolean;
  refreshBoardGeometry?(): void;
  layout?: {
    boardPanelX: number;
    boardPanelW: number;
    boardPanelY: number;
    boardPanelH: number;
  };
  [key: string]: unknown;
}

export type PaintRiverCallback = (
  host: unknown,
  token: GapTokenLike,
  x: number,
  y: number,
  row: number
) => void;

export type PaintTileCallback = (
  host: unknown,
  tile: unknown,
  x: number,
  y: number,
  row: number,
  col: number
) => void;

export interface GeometryOptions {
  rows: number;
  cols: number;
  riverLayerDepth?: number;
  paintTile?: PaintTileCallback;
  paintRiver?: PaintRiverCallback;
  onRefreshBoardUi?(host: ThreeBoardViewportHost): void;
  onRefreshCombatUnits?(host: ThreeBoardViewportHost): void;
  onAfterRefresh?(host: ThreeBoardViewportHost): void;
}

export interface ZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
}

export interface PanOptions {
  immediate?: boolean;
  threshold?: number;
}

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
 * Synchronize clickable zone dimensions and centers to tile screen positions.
 *
 * Rationale:
 * Source: src/scenes/shared/sceneBoardViewport.ts:24-36
 * Mobile touch targets require invisible hit-boxes aligned to visual tile centers
 * with safe paddings.
 */
function syncPlayerCellZones(
  host: ThreeBoardViewportHost,
  tileW: number,
  tileH: number
): void {
  host.playerCellZones.forEach((entry) => {
    const row = typeof entry?.row === "number" && Number.isInteger(entry.row) ? entry.row : null;
    const col = typeof entry?.col === "number" && Number.isInteger(entry.col) ? entry.col : null;
    if (row == null || col == null) return;
    const tile = host.tileLookup.get(gridKey(row, col));
    if (!tile) return;
    const zone = entry?.zone ?? (entry as unknown as CellZoneEntryLike);
    if (!zone || typeof zone.setPosition !== "function") return;
    zone.setPosition(tile.center.x, tile.center.y);
    zone.setSize(tileW - 10, tileH - 10);
  });
}

/**
 * Refresh river markers dividing the ally and enemy territories.
 *
 * Rationale:
 * Source: src/scenes/shared/sceneBoardViewport.ts:38-49
 * River gap markers sit between column 4 and column 5 across all board rows.
 */
function refreshGapMarkers(
  host: ThreeBoardViewportHost,
  paintRiver: PaintRiverCallback | undefined,
  riverLayerDepth: number | undefined
): void {
  if (!Array.isArray(host.gapMarkers) || typeof paintRiver !== "function") return;
  host.gapMarkers.forEach((token, row) => {
    const a = host.gridToScreen(4, row);
    const b = host.gridToScreen(5, row);
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    token.clear();
    paintRiver(host, token, mx, my - 2, row);
    if (typeof riverLayerDepth === "number" && Number.isFinite(riverLayerDepth)) {
      token.setDepth?.(riverLayerDepth);
    }
  });
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Calculate scaled tile dimensions taking current zoom level into account.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:51-53
 */
export function getSharedTileSize(
  host: ThreeBoardViewportHost,
  tileW: number,
  tileH: number
): { tileW: number; tileH: number } {
  return {
    tileW: tileW * host.boardZoom,
    tileH: tileH * host.boardZoom
  };
}

/**
 * Check whether a screen coordinate falls within the board panel bounding box.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:55-58
 */
export function pointInSharedBoardPanel(
  host: ThreeBoardViewportHost,
  x: number,
  y: number
): boolean {
  const l = host.layout;
  if (!l) return false;
  return (
    x >= l.boardPanelX &&
    x <= l.boardPanelX + l.boardPanelW &&
    y >= l.boardPanelY &&
    y <= l.boardPanelY + l.boardPanelH
  );
}

/**
 * Convert logical board (col, row) coordinates to screen pixel coordinates with pan and zoom.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:60-66
 */
export function gridToSharedBoardScreen(
  host: ThreeBoardViewportHost,
  col: number,
  row: number
): Point2D {
  const visualCol = host.toVisualCol(col);
  const { tileW, tileH } = host.getTileSize();
  const x = host.originX + host.boardPanX + (visualCol + row) * (tileW / 2);
  const y = host.originY + host.boardPanY + (row - visualCol) * (tileH / 2);
  return { x, y };
}

/**
 * Refresh tile centers, river gap tokens, and interactive bounds without triggering recursion.
 *
 * Past Learning Note:
 * Must NOT call viewport resize or camera state listeners inside this function to
 * avoid infinite stack recursion during layout refresh.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:68-88
 */
export function refreshSharedBoardGeometry(
  host: ThreeBoardViewportHost,
  options: GeometryOptions
): void {
  const {
    rows,
    cols,
    riverLayerDepth,
    paintTile,
    paintRiver,
    onRefreshBoardUi,
    onRefreshCombatUnits,
    onAfterRefresh
  } = options;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const data = host.tileLookup.get(gridKey(row, col));
      if (!data) continue;
      const center = host.gridToScreen(col, row);
      data.center = center;
      data.tile.clear();
      if (typeof paintTile === "function") {
        paintTile(host, data.tile, center.x, center.y, row, col);
      }
    }
  }

  if (typeof host.refreshBoardEdgeLabels === "function") {
    host.refreshBoardEdgeLabels();
  }

  const { tileW, tileH } = host.getTileSize();
  syncPlayerCellZones(host, tileW, tileH);
  refreshGapMarkers(host, paintRiver, riverLayerDepth);

  if (typeof onRefreshBoardUi === "function") {
    onRefreshBoardUi(host);
  }
  if (typeof onRefreshCombatUnits === "function") {
    onRefreshCombatUnits(host);
  }
  if (typeof host.refreshBoardEdgeLabels === "function") {
    host.refreshBoardEdgeLabels();
  }
  if (typeof onAfterRefresh === "function") {
    onAfterRefresh(host);
  }
}

/**
 * Zoom board camera/viewport with clamp and change detection.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:90-98
 */
export function zoomSharedBoardView(
  host: ThreeBoardViewportHost,
  pointer: Point2D,
  dy: number,
  options: ZoomOptions = {}
): boolean {
  const { minZoom = 0.65, maxZoom = 1.85, zoomSpeed = 0.0012 } = options;
  if (!host?.pointInBoardPanel?.(pointer.x, pointer.y)) return false;

  const before = host.boardZoom;
  host.boardZoom = clamp(host.boardZoom - dy * zoomSpeed, minZoom, maxZoom);
  if (Math.abs(before - host.boardZoom) < 0.0001) return false;

  host.refreshBoardGeometry?.();
  return true;
}

/**
 * Begin board panning drag gesture.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:100-108
 */
export function beginSharedBoardPan(
  host: ThreeBoardViewportHost,
  pointer: Point2D,
  options: PanOptions = {}
): boolean {
  const { immediate = false } = options;
  if (!host?.pointInBoardPanel?.(pointer.x, pointer.y)) return false;

  host.boardPointerDown = { x: pointer.x, y: pointer.y };
  host.boardDragConsumed = false;
  host.lastDragPoint = { x: pointer.x, y: pointer.y };
  host.isBoardDragging = Boolean(immediate);
  return true;
}

/**
 * Update active pan drag or promote initial pointer down to drag once past threshold.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:110-135
 */
export function updateSharedBoardPan(
  host: ThreeBoardViewportHost,
  pointer: Point2D,
  options: PanOptions = {}
): boolean {
  const { threshold = 6 } = options;

  if (host.isBoardDragging && host.lastDragPoint) {
    const dx = pointer.x - host.lastDragPoint.x;
    const dy = pointer.y - host.lastDragPoint.y;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return false;

    host.boardDragConsumed = true;
    host.boardPanX += dx;
    host.boardPanY += dy;
    host.lastDragPoint = { x: pointer.x, y: pointer.y };
    host.refreshBoardGeometry?.();
    return true;
  }

  if (!host.isBoardDragging && host.boardPointerDown) {
    const dx = pointer.x - host.boardPointerDown.x;
    const dy = pointer.y - host.boardPointerDown.y;
    const distSq = dx * dx + dy * dy;
    if (distSq >= threshold * threshold) {
      host.isBoardDragging = true;
      host.boardDragConsumed = true;
      host.lastDragPoint = { x: pointer.x, y: pointer.y };
      return true;
    }
  }

  return false;
}

/**
 * Complete board drag interaction and reset pointer state.
 *
 * Source: src/scenes/shared/sceneBoardViewport.ts:137-148
 */
export function endSharedBoardPan(host: ThreeBoardViewportHost): boolean {
  const hadDrag = host.isBoardDragging || host.boardDragConsumed;
  host.isBoardDragging = false;
  host.boardPointerDown = null;
  host.lastDragPoint = null;
  return hadDrag;
}
