import {
  BOARD_GAP_COLS,
  COLS,
  RIGHT_COL_START,
  ROWS,
  TILE_H,
  TILE_W
} from "../../core/boardConstants.js";
import { getSharedTileSize } from "./sceneBoardViewport.js";
import { getPlanningBoardRowCount } from "./planningCoopSessionRuntime.js";

type PlanningBoardScene = {
  boardZoom?: number;
  boardPanX?: number;
  boardPanY?: number;
  originX: number;
  originY: number;
};

export function toPlanningVisualCol(_scene: unknown, col: number): number {
  return col >= RIGHT_COL_START ? col + BOARD_GAP_COLS : col;
}

export function getPlanningTileSize(scene: PlanningBoardScene): { tileW: number; tileH: number } {
  const base = getSharedTileSize(scene as Parameters<typeof getSharedTileSize>[0], TILE_W, TILE_H);
  const rowScale = Math.min(1, (ROWS + COLS) / (getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]) + COLS));
  return {
    tileW: base.tileW * rowScale,
    tileH: base.tileH * rowScale
  };
}

export function gridToPlanningBoardScreen(
  scene: PlanningBoardScene,
  col: number,
  row: number
): { x: number; y: number } {
  const visualCol = toPlanningVisualCol(scene, col);
  const { tileW, tileH } = getPlanningTileSize(scene);
  const panX = scene.boardPanX ?? 0;
  const panY = scene.boardPanY ?? 0;
  const x = scene.originX + panX + (visualCol + row) * (tileW / 2);
  const y = scene.originY + panY + (row - visualCol) * (tileH / 2);
  return { x, y };
}
