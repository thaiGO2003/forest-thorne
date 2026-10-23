import Phaser from "phaser";
import { t } from "../../i18n/index.js";

import {
  BOARD_FILES,
  COLS,
  PLAYER_COLS,
  RIGHT_COL_END,
  RIGHT_COL_START,
  RIVER_LAYER_DEPTH
} from "../../core/boardConstants.js";
import { gridKey } from "../../core/gameUtils.js";
import { getForestBackgroundKeyByRound } from "../../data/forestBackgrounds.js";
import {
  drawBattlefieldEnvironment,
  drawCoopOwnershipOverlay,
  drawDiamond as drawDiamondImpl,
  getGrassTileStyle as getGrassTileStyleImpl,
  getRoleTheme as getRoleThemeImpl,
  paintGrassTile3D,
  paintRiverTile3D
} from "../../ui/BoardRenderer.js";
import { applyCoverTextureToImage } from "../../ui/backgroundCover.js";
import { UI_FONT, UI_COLORS } from "../../core/uiTheme.js";
import {
  getPlanningBoardProfileId,
  getPlanningBoardRowCount,
  getPlanningCoopLocalSlot,
  isPlanningCoopMode
} from "./planningCoopSessionRuntime.js";
import {
  getPlanningTileSize,
  gridToPlanningBoardScreen,
  toPlanningVisualCol
} from "./planningBoardMetricsRuntime.js";

export { toPlanningVisualCol };

interface BoardChromeLayout {
  boardPanelX: number;
  boardPanelY: number;
  boardPanelW: number;
  boardPanelH: number;
  boardOriginX: number;
  boardOriginY: number;
}

interface BoardChromeSceneFields {
  layout: BoardChromeLayout | null;
  player?: { round?: number; [key: string]: unknown };
  roundBackgroundKey: string | null;
  roundBackgroundImage: Phaser.GameObjects.Image | null;
  roundBackgroundMask: unknown;
  tileLookup: Map<string, { tile: Phaser.GameObjects.Graphics; center: { x: number; y: number } }>;
  gapMarkers: Phaser.GameObjects.Graphics[];
  boardEdgeLabels: Array<{ label: Phaser.GameObjects.Text; col: number; row: number; anchor: string }>;
  originX: number;
  originY: number;
  boardZoom: number;
  boardPanX: number;
  boardPanY: number;
  decorationSprites: Phaser.GameObjects.GameObject[];
  battlefieldBackdrop: Phaser.GameObjects.Graphics | null;
  battlefieldFx: Phaser.GameObjects.Graphics | null;
  highlightLayer: Phaser.GameObjects.Graphics;
  turnIndicatorLayer: Phaser.GameObjects.Graphics;
  attackPreviewLayer: Phaser.GameObjects.Graphics;
  attackPreviewSword: Phaser.GameObjects.Graphics;
  gridToScreen?: (col: number, row: number) => { x: number; y: number };
  getTileSize?: () => { tileW: number; tileH: number };
  coopOwnershipLabels: Phaser.GameObjects.Text[];
  gameModeConfig?: { fortressMode?: boolean; renderStrongholds?: boolean } | null;
}

type BoardChromeSceneLike = Phaser.Scene & BoardChromeSceneFields;

export function toPlanningChessCoord(scene: BoardChromeSceneLike, row: number, col: number): string {
  const file = BOARD_FILES[toPlanningVisualCol(scene, col)] ?? "?";
  const rank = row;
  return `${file}${rank}`;
}

export function createPlanningBoardBackground(scene: BoardChromeSceneLike): void {
  const l = scene.layout;
  if (!l) return;
  const startRound = scene.player?.round ?? 1;
  const key = getForestBackgroundKeyByRound(startRound);
  if (!scene.textures?.exists(key)) return;
  scene.roundBackgroundKey = key;
  const add = scene.add as NonNullable<BoardChromeSceneLike["add"]>;
  scene.roundBackgroundImage = add
    .image(l.boardPanelX + l.boardPanelW / 2, l.boardPanelY + l.boardPanelH / 2, key)
    .setAlpha(0.5)
    .setDepth(-20);
  applyCoverTextureToImage(scene as unknown as Parameters<typeof applyCoverTextureToImage>[0], scene.roundBackgroundImage, key, {
    x: l.boardPanelX,
    y: l.boardPanelY,
    w: l.boardPanelW,
    h: l.boardPanelH
  });

  const maskGfx = add.graphics();
  maskGfx.fillStyle(0xffffff, 1);
  maskGfx.fillRect(l.boardPanelX, l.boardPanelY, l.boardPanelW, l.boardPanelH);
  scene.roundBackgroundImage.enableFilters();
  scene.roundBackgroundMask = scene.roundBackgroundImage.filters?.external?.addMask(maskGfx);
  scene.children?.remove(maskGfx);
}

export function refreshPlanningRoundBackground(scene: BoardChromeSceneLike): void {
  if (!scene.roundBackgroundImage) return;
  const nextKey = getForestBackgroundKeyByRound(scene.player?.round ?? 1);
  if (!scene.textures?.exists(nextKey)) return;
  if (nextKey === scene.roundBackgroundKey) return;
  scene.roundBackgroundKey = nextKey;
  const layout = scene.layout;
  if (!layout) return;
  applyCoverTextureToImage(scene as unknown as Parameters<typeof applyCoverTextureToImage>[0], scene.roundBackgroundImage, nextKey, {
    x: layout.boardPanelX,
    y: layout.boardPanelY,
    w: layout.boardPanelW,
    h: layout.boardPanelH
  });
}

export function drawPlanningBoard(scene: BoardChromeSceneLike): void {
  if (!scene.layout) {
    throw new Error("PlanningScene.drawBoard requires scene.layout");
  }
  if (!scene.tileLookup) {
    scene.tileLookup = new Map();
  }
  if (!Array.isArray(scene.gapMarkers)) {
    scene.gapMarkers = [];
  }
  if (!Array.isArray(scene.boardEdgeLabels)) {
    scene.boardEdgeLabels = [];
  }

  if (!Number.isFinite(scene.boardZoom)) scene.boardZoom = 1;
  if (!Number.isFinite(scene.boardPanX)) scene.boardPanX = 0;
  if (!Number.isFinite(scene.boardPanY)) scene.boardPanY = 0;

  scene.originX = scene.layout.boardOriginX;
  scene.originY = scene.layout.boardOriginY;
  createPlanningBoardBackground(scene);

  const add = scene.add as NonNullable<BoardChromeSceneLike["add"]>;
  scene.battlefieldBackdrop = add.graphics().setDepth(-11);
  scene.battlefieldFx = add.graphics().setDepth(3);
  if (!Array.isArray(scene.decorationSprites)) {
    scene.decorationSprites = [];
  }
  scene.decorationSprites.push(scene.battlefieldBackdrop, scene.battlefieldFx);
  refreshPlanningBattlefieldDecorations(scene);

  const rowCount = getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]);
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const center = gridToPlanningBoardScreen(scene, col, row);
      const tile = add.graphics();
      paintPlanningGrassTile(scene, tile, center.x, center.y, row, col);
      scene.tileLookup.set(gridKey(row, col), { tile, center });
    }
  }
  createPlanningBoardEdgeLabels(scene);

  for (let row = 0; row < rowCount; row += 1) {
    const a = gridToPlanningBoardScreen(scene, 4, row);
    const b = gridToPlanningBoardScreen(scene, 5, row);
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const token = add.graphics();
    paintPlanningRiverTile(scene, token, mx, my - 2, row);
    token.setDepth(RIVER_LAYER_DEPTH);
    scene.gapMarkers.push(token);
  }

  add.text(scene.layout.boardPanelX + 14, scene.layout.boardPanelY + scene.layout.boardPanelH - 24, "PHE TA", {
    fontFamily: UI_FONT,
    fontSize: "14px",
    color: UI_COLORS.textSecondary
  }).setDepth(2100);

  add.text(scene.layout.boardPanelX + scene.layout.boardPanelW - 14, scene.layout.boardPanelY + scene.layout.boardPanelH - 24, t("planning.combat.enemySide"), {
    fontFamily: UI_FONT,
    fontSize: "14px",
    color: UI_COLORS.textSecondary
  }).setOrigin(1, 0).setDepth(2100);

  scene.highlightLayer = add.graphics();
  scene.highlightLayer.setDepth(999);
  scene.turnIndicatorLayer = add.graphics();
  scene.turnIndicatorLayer.setDepth(998);
  scene.attackPreviewLayer = add.graphics();
  scene.attackPreviewLayer.setDepth(1000);
  scene.attackPreviewSword = add.graphics();
  scene.attackPreviewSword.setDepth(1001);
  scene.attackPreviewSword.setVisible(false);
}

export function refreshPlanningBattlefieldDecorations(scene: BoardChromeSceneLike): void {
  const restoreGridToScreen = scene.gridToScreen;
  const restoreGetTileSize = scene.getTileSize;
  scene.gridToScreen = (col: number, row: number) => gridToPlanningBoardScreen(scene, col, row);
  scene.getTileSize = () => getPlanningTileSize(scene);

  try {
    drawBattlefieldEnvironment(scene as unknown as Parameters<typeof drawBattlefieldEnvironment>[0], {
      backdrop: scene.battlefieldBackdrop,
      fx: scene.battlefieldFx
    });
    refreshPlanningCoopOwnershipDecorations(scene);
  } finally {
    if (restoreGridToScreen === undefined) {
      delete scene.gridToScreen;
    } else {
      scene.gridToScreen = restoreGridToScreen;
    }
    if (restoreGetTileSize === undefined) {
      delete scene.getTileSize;
    } else {
      scene.getTileSize = restoreGetTileSize;
    }
  }
}

export function refreshPlanningCoopOwnershipDecorations(scene: BoardChromeSceneLike): void {
  scene.coopOwnershipLabels?.forEach((label) => label.destroy());
  scene.coopOwnershipLabels = [];
  if (!isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])) return;

  const markers = drawCoopOwnershipOverlay(
    scene as unknown as Parameters<typeof drawCoopOwnershipOverlay>[0],
    scene.battlefieldFx as Phaser.GameObjects.Graphics,
    getPlanningCoopLocalSlot(scene as unknown as Parameters<typeof getPlanningCoopLocalSlot>[0]),
    getPlanningBoardProfileId(scene as unknown as Parameters<typeof getPlanningBoardProfileId>[0])
  );
  const add = scene.add as NonNullable<BoardChromeSceneLike["add"]>;
  markers.forEach((marker) => {
    const label = add.text(marker.boardBounds.left - 2, marker.boardBounds.top - 4, marker.label, {
      fontFamily: UI_FONT,
      fontSize: "11px",
      color: marker.isLocal ? "#d9f4ff" : "#c7ffdd",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(2100);
    scene.coopOwnershipLabels.push(label);
  });
}

export function createPlanningBoardEdgeLabels(scene: BoardChromeSceneLike): void {
  scene.boardEdgeLabels.forEach((x) => x.label.destroy());
  scene.boardEdgeLabels = [];
  const style: Record<string, unknown> = {
    fontFamily: UI_FONT,
    fontSize: "13px",
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  };
  const rowCount = getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]);
  const add = scene.add as NonNullable<BoardChromeSceneLike["add"]>;
  const addLabel = (text: string, col: number, row: number, anchor: string) => {
    const label = add.text(0, 0, text, style).setOrigin(0.5).setDepth(2100);
    scene.boardEdgeLabels.push({ label, col, row, anchor });
  };
  for (let col = 0; col < PLAYER_COLS; col += 1) {
    addLabel(BOARD_FILES[toPlanningVisualCol(scene, col)] ?? "?", col, rowCount - 1, "bottom");
  }
  for (let row = 0; row < rowCount; row += 1) {
    addLabel(String(row), 0, row, "left");
  }
  for (let col = RIGHT_COL_START; col <= RIGHT_COL_END; col += 1) {
    addLabel(BOARD_FILES[toPlanningVisualCol(scene, col)] ?? "?", col, 0, "top");
  }
  for (let row = 0; row < rowCount; row += 1) {
    addLabel(String(row), RIGHT_COL_END, row, "right");
  }
  refreshPlanningBoardEdgeLabels(scene);
}

export function refreshPlanningBoardEdgeLabels(scene: BoardChromeSceneLike): void {
  const { tileW, tileH } = getPlanningTileSize(scene);
  scene.boardEdgeLabels.forEach((entry) => {
    const p = gridToPlanningBoardScreen(scene, entry.col, entry.row);
    let dx = 0;
    let dy = 0;
    if (entry.anchor === "bottom") {
      dx = tileW * 0.3;
      dy = tileH * 0.6;
    } else if (entry.anchor === "top") {
      dx = -tileW * 0.3;
      dy = -tileH * 0.6;
    } else if (entry.anchor === "left") {
      dx = -tileW * 0.3;
      dy = tileH * 0.6;
    } else if (entry.anchor === "right") {
      dx = tileW * 0.3;
      dy = -tileH * 0.6;
    }
    entry.label.setPosition(p.x + dx, p.y + dy);
    entry.label.setDepth(2101);
  });
}

export function getPlanningGrassTileStyle(_scene: BoardChromeSceneLike, row: number, col: number) {
  return getGrassTileStyleImpl(row, col);
}

export function paintPlanningGrassTile(
  scene: BoardChromeSceneLike,
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number,
  col: number
): void {
  const { tileW, tileH } = getPlanningTileSize(scene);
  paintGrassTile3D(graphics, x, y, row, col, tileW, tileH);
}

export function paintPlanningRiverTile(
  scene: BoardChromeSceneLike,
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  row: number
): void {
  const { tileW, tileH } = getPlanningTileSize(scene);
  paintRiverTile3D(graphics, x, y, row, tileW, tileH);
}

export function drawPlanningDiamond(
  scene: BoardChromeSceneLike,
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  fill: boolean = true
): void {
  const { tileW, tileH } = getPlanningTileSize(scene);
  drawDiamondImpl(graphics, x, y, tileW, tileH, fill);
}

export function getPlanningRoleTheme(_scene: BoardChromeSceneLike, classType: string) {
  return getRoleThemeImpl(classType);
}
