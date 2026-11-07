import Phaser from "phaser";
import { t } from "../../i18n/index.js";

import { PHASE, COLS, PLAYER_COLS, RIGHT_COL_START, RIVER_LAYER_DEPTH } from "../../core/boardConstants.js";

import { gridKey } from "../../core/gameUtils.js";
import { pointInSharedBoardPanel, refreshSharedBoardGeometry } from "./sceneBoardViewport.js";
import { getPlanningTileSize } from "./planningBoardMetricsRuntime.js";
import { toPlanningChessCoord } from "./planningBoardChromeRuntime.js";
import {
  getPlanningBoardRowCount,
  getPlanningBoardUnit,
  isPlanningOwnedPlanningRow,
  mapPlanningVisualBoardRowToLocalRow
} from "./planningCoopSessionRuntime.js";

import { clearPlanningAttackPreview } from "./planningAttackPreviewRuntime.js";
import { paintPlanningGrassTile, paintPlanningRiverTile, refreshPlanningBattlefieldDecorations } from "./planningBoardChromeRuntime.js";
import { refreshPlanningBoardUi } from "./planningBoardUiRuntime.js";
import { findPlanningCreativeSandboxUnitAt, isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";
import { onPlanningPlayerCellClick } from "./planningFormationRuntime.js";
import { isPlanningPanPointer } from "./planningInputRuntime.js";

export { getPlanningTileSize };

type PlanningBoardUnit = NonNullable<ReturnType<typeof getPlanningBoardUnit>>;
type PlanningSandboxUnit = NonNullable<ReturnType<typeof findPlanningCreativeSandboxUnitAt>>;

interface PlanningPoint {
  x: number;
  y: number;
}

interface PlanningBoardTile {
  center?: PlanningPoint | null;
}

interface PlanningBenchSlot {
  bg: {
    visible: boolean;
  };
  x: number;
  y: number;
  slotW: number;
  slotH: number;
  isCreativeDummy: boolean;
  benchIndex: number;
}

interface PlanningButton {
  bg: {
    visible: boolean;
  };
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PlanningButtons {
  sell?: PlanningButton | null;
  unequip?: PlanningButton | null;
}

interface PlanningPlayer {
  bench?: Array<PlanningBoardUnit | null | undefined>;
  board?: Array<Array<PlanningBoardUnit | null | undefined> | null | undefined>;
}

interface PlanningDragOrigin {
  region: string;
}

interface PlanningTooltipContent {
  title: string;
  body: string;
}

interface PlanningTooltipController {
  attach(
    target: Phaser.GameObjects.GameObject,
    provider: () => PlanningTooltipContent | null
  ): void;
}

interface PlanningPlayerCellZone {
  row: number;
  col: number;
  zone: Phaser.GameObjects.Zone;
}

interface PlanningSceneLike extends Phaser.Scene {
  benchSlots: PlanningBenchSlot[];
  selectedBenchIndex: number | null;
  player?: PlanningPlayer | null;
  tileLookup: Map<string, PlanningBoardTile>;
  buttons: PlanningButtons;
  dragOrigin: PlanningDragOrigin;
  playerCellZones: PlanningPlayerCellZone[];
  tooltip: PlanningTooltipController;
  isUnitDragging: boolean;
  isItemDragging: boolean;
  itemDragConsumed: boolean;
  boardDragConsumed: boolean;
  phase: unknown;
}

interface PlanningBenchUnitHit {
  unit: PlanningBoardUnit;
  region: "BENCH";
  index: number;
}

interface PlanningDummyUnitHit {
  unit: PlanningBoardUnit;
  region: "DUMMY";
  index: number;
}

interface PlanningSandboxBoardUnitHit {
  unit: PlanningSandboxUnit;
  region: "SANDBOX_BOARD";
  row: number;
  col: number;
  r: number;
  c: number;
  side: "LEFT" | "RIGHT";
}

interface PlanningBoardUnitHit {
  unit: PlanningBoardUnit;
  region: "BOARD";
  row: number;
  col: number;
  r: number;
  c: number;
}

type PlanningUnitHit =
  | PlanningBenchUnitHit
  | PlanningDummyUnitHit
  | PlanningSandboxBoardUnitHit
  | PlanningBoardUnitHit;

interface PlanningBoardCellHit {
  row: number;
  col: number;
  center: PlanningPoint;
}

interface PlanningBenchDropTarget {
  type: "BENCH";
  index: number;
  center: PlanningPoint;
}

interface PlanningBoardDropTarget {
  type: "BOARD";
  r: number;
  c: number;
  center: PlanningPoint;
}

interface PlanningSellDropTarget {
  type: "SELL";
}

interface PlanningUnequipDropTarget {
  type: "UNEQUIP";
}

type PlanningDropTarget =
  | PlanningBenchDropTarget
  | PlanningBoardDropTarget
  | PlanningSellDropTarget
  | PlanningUnequipDropTarget;

export function getPlanningUnitAt(
  scene: PlanningSceneLike,
  x: number,
  y: number
): PlanningUnitHit | null {
  // Check Bench – use stored slot position (DPR-safe) instead of getBounds()
  for (let i = 0; i < scene.benchSlots.length; i++) {
    const slot = scene.benchSlots[i];
    if (!slot.bg.visible) continue;
    const manualHit = x >= slot.x && x <= slot.x + slot.slotW && y >= slot.y && y <= slot.y + slot.slotH;
    if (manualHit) {
      if (slot.isCreativeDummy) {
        const selectedUnit = scene.selectedBenchIndex != null ? scene.player?.bench?.[scene.selectedBenchIndex] : null;
        const selectedIndex = scene.selectedBenchIndex ?? -1;
        return selectedUnit ? { unit: selectedUnit, region: "DUMMY", index: selectedIndex } : null;
      }
      const benchIndex = slot.benchIndex;
      const unit = Number.isInteger(benchIndex) ? scene.player?.bench?.[benchIndex] : null;
      return unit ? { unit, region: "BENCH", index: benchIndex } : null;
    }
  }
  // Check Board (zoom-aware hit)
  const hit = findPlanningPlayerBoardCellFromPoint(
    scene,
    x,
    y,
    true,
    isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])
  );
  if (hit) {
    const { row: r, col: c } = hit;
    const side: "LEFT" | "RIGHT" = c >= RIGHT_COL_START ? "RIGHT" : "LEFT";
    const sandboxUnit = findPlanningCreativeSandboxUnitAt(
      scene as unknown as Parameters<typeof findPlanningCreativeSandboxUnitAt>[0],
      r,
      c,
      side
    );
    if (sandboxUnit) {
      return { unit: sandboxUnit, region: "SANDBOX_BOARD", row: r, col: c, r, c, side };
    }
    const unit = side === "LEFT"
      ? getPlanningBoardUnit(
        scene as unknown as Parameters<typeof getPlanningBoardUnit>[0],
        r,
        c,
        { ownedOnly: true }
      )
      : scene.player?.board?.[r]?.[c];
    // Keep both row/col and r/c for compatibility with old callers.
    if (!unit) return null;
    const row = side === "LEFT"
      ? mapPlanningVisualBoardRowToLocalRow(
        scene as unknown as Parameters<typeof mapPlanningVisualBoardRowToLocalRow>[0],
        r
      )
      : r;
    return row == null ? null : { unit, region: "BOARD", row, col: c, r: row, c };
  }
  return null;
}

export function getPlanningDropTarget(
  scene: PlanningSceneLike,
  x: number,
  y: number
): PlanningDropTarget | null {
  // Check Bench first (UI overlay) – use stored slot position (DPR-safe)
  for (let i = 0; i < scene.benchSlots.length; i++) {
    const slot = scene.benchSlots[i];
    if (!slot.bg.visible) continue;
    if (x >= slot.x && x <= slot.x + slot.slotW && y >= slot.y && y <= slot.y + slot.slotH) {
      if (slot.isCreativeDummy) return null;
      return {
        type: "BENCH",
        index: slot.benchIndex,
        center: { x: slot.x + slot.slotW / 2, y: slot.y + slot.slotH / 2 }
      };
    }
  }
  // Check Board (zoom-aware hit)
  const allowEnemyBoard = isPlanningCreativeMode(
    scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]
  ) && ["DUMMY", "SANDBOX_BOARD"].includes(scene.dragOrigin?.region);
  const hit = findPlanningPlayerBoardCellFromPoint(scene, x, y, true, allowEnemyBoard);
  if (hit) {
    const { row: r, col: c, center } = hit;
    if (c < RIGHT_COL_START) {
      const localRow = mapPlanningVisualBoardRowToLocalRow(
        scene as unknown as Parameters<typeof mapPlanningVisualBoardRowToLocalRow>[0],
        r
      );
      if (localRow == null) return null;
      return { type: "BOARD", r: localRow, c, center };
    }
    return { type: "BOARD", r, c, center };
  }
  // Check Sell Button – use stored position (DPR-safe)
  const sell = scene.buttons.sell;
  if (sell && sell.bg.visible) {
    if (x >= sell.x && x <= sell.x + sell.w && y >= sell.y && y <= sell.y + sell.h) {
      return { type: "SELL" };
    }
  }

  // Check Unequip Button
  const unequip = scene.buttons.unequip;
  if (unequip && unequip.bg.visible) {
    if (x >= unequip.x && x <= unequip.x + unequip.w && y >= unequip.y && y <= unequip.y + unequip.h) {
      return { type: "UNEQUIP" };
    }
  }

  return null;
}

export function findPlanningPlayerBoardCellFromPoint(
  scene: PlanningSceneLike,
  x: number,
  y: number,
  allowNear: boolean = true,
  includeEnemySide: boolean = false
): PlanningBoardCellHit | null {
  const { tileW, tileH } = getPlanningTileSize(
    scene as unknown as Parameters<typeof getPlanningTileSize>[0]
  );
  const halfW = Math.max(1, tileW * 0.5);
  const halfH = Math.max(1, tileH * 0.5);
  const nearThreshold = Math.max(40, Math.min(180, Math.hypot(halfW, halfH) + 8));
  let bestInside: PlanningBoardCellHit | null = null;
  let bestInsideDist: number = Number.POSITIVE_INFINITY;
  let bestNear: PlanningBoardCellHit | null = null;
  let bestNearDist: number = Number.POSITIVE_INFINITY;

  const startCol: number = 0;
  const endCol: number = includeEnemySide ? COLS : PLAYER_COLS;
  const rowCount = getPlanningBoardRowCount(
    scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]
  );
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      const tile = scene.tileLookup.get(gridKey(row, col));
      if (!tile?.center) continue;
      const dx = Math.abs(x - tile.center.x);
      const dy = Math.abs(y - tile.center.y);
      const dist = Phaser.Math.Distance.Between(x, y, tile.center.x, tile.center.y);
      const diamond = dx / halfW + dy / halfH;
      if (diamond <= 1.08 && dist < bestInsideDist) {
        bestInsideDist = dist;
        bestInside = { row, col, center: tile.center };
      }
      if (allowNear && dist < nearThreshold && dist < bestNearDist) {
        bestNearDist = dist;
        bestNear = { row, col, center: tile.center };
      }
    }
  }

  const result: PlanningBoardCellHit | null = bestInside ?? bestNear;
  return result;
}

export function createPlanningPlayerCellZones(scene: PlanningSceneLike): void {
  if (!Array.isArray(scene.playerCellZones)) {
    scene.playerCellZones = [];
  }
  const { tileW, tileH } = getPlanningTileSize(
    scene as unknown as Parameters<typeof getPlanningTileSize>[0]
  );
  const rowCount = getPlanningBoardRowCount(
    scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]
  );
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < PLAYER_COLS; col += 1) {
      const tile = scene.tileLookup.get(gridKey(row, col));
      if (!tile?.center) continue;
      const zone = scene.add.zone(tile.center.x, tile.center.y, tileW - 10, tileH - 10);
      zone.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, tileW - 10, tileH - 10),
        Phaser.Geom.Rectangle.Contains
      );
      zone.input!.dropZone = true;
      scene.tooltip.attach(zone, (): PlanningTooltipContent | null => {
        const unit = getPlanningBoardUnit(
          scene as unknown as Parameters<typeof getPlanningBoardUnit>[0],
          row,
          col
        );
        if (unit) return null;
        return {
          title: t("planning.board.tileCoord", {
            coord: toPlanningChessCoord(
              scene as unknown as Parameters<typeof toPlanningChessCoord>[0],
              row,
              col
            )
          }),
          body: isPlanningOwnedPlanningRow(
            scene as unknown as Parameters<typeof isPlanningOwnedPlanningRow>[0],
            row
          ) ? t("planning.ui.emptySlotWithPeriod") : t("planning.board.teammateArea")
        };
      });
      zone.on("pointerover", (): void => {
        const unit = getPlanningBoardUnit(
          scene as unknown as Parameters<typeof getPlanningBoardUnit>[0],
          row,
          col
        );
        if (unit) return;
      });
      zone.on("pointerout", (): void => {
        const unit = getPlanningBoardUnit(
          scene as unknown as Parameters<typeof getPlanningBoardUnit>[0],
          row,
          col
        );
        if (unit) return;
        clearPlanningAttackPreview(
          scene as unknown as Parameters<typeof clearPlanningAttackPreview>[0]
        );
      });
      zone.on("pointerup", (pointer: Phaser.Input.Pointer): void => {
        if (scene.isUnitDragging || scene.isItemDragging || scene.itemDragConsumed) return;
        if (scene.boardDragConsumed) return;
        if (isPlanningPanPointer(
          scene as unknown as Parameters<typeof isPlanningPanPointer>[0],
          pointer as unknown as Parameters<typeof isPlanningPanPointer>[1]
        )) return;
        if (!isPlanningOwnedPlanningRow(
          scene as unknown as Parameters<typeof isPlanningOwnedPlanningRow>[0],
          row
        )) return;
        const occupant = getPlanningBoardUnit(
          scene as unknown as Parameters<typeof getPlanningBoardUnit>[0],
          row,
          col,
          { ownedOnly: true }
        );
        if (occupant) return;
        const localRow = mapPlanningVisualBoardRowToLocalRow(
          scene as unknown as Parameters<typeof mapPlanningVisualBoardRowToLocalRow>[0],
          row
        );
        if (localRow == null) return;
        onPlanningPlayerCellClick(
          scene as unknown as Parameters<typeof onPlanningPlayerCellClick>[0],
          localRow,
          col
        );
      });
      zone.setDepth(20);
      scene.playerCellZones.push({ row, col, zone });
    }
  }
}

export function refreshPlanningBoardGeometry(scene: PlanningSceneLike): void {
  refreshSharedBoardGeometry(
    scene as unknown as Parameters<typeof refreshSharedBoardGeometry>[0],
    {
      rows: getPlanningBoardRowCount(
        scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]
      ),
      cols: COLS,
      riverLayerDepth: RIVER_LAYER_DEPTH,
      paintTile: (
        callbackScene: Parameters<typeof paintPlanningGrassTile>[0],
        tile: Parameters<typeof paintPlanningGrassTile>[1],
        x: number,
        y: number,
        row: number,
        col: number
      ): ReturnType<typeof paintPlanningGrassTile> => paintPlanningGrassTile(
        callbackScene,
        tile,
        x,
        y,
        row,
        col
      ),
      paintRiver: (
        callbackScene: Parameters<typeof paintPlanningRiverTile>[0],
        tile: Parameters<typeof paintPlanningRiverTile>[1],
        x: number,
        y: number,
        row: number
      ): ReturnType<typeof paintPlanningRiverTile> => paintPlanningRiverTile(
        callbackScene,
        tile,
        x,
        y,
        row
      ),
      onRefreshBoardUi: (
        callbackScene: Parameters<typeof refreshPlanningBoardUi>[0]
      ): void => {
        const planningScene = callbackScene as unknown as PlanningSceneLike;
        if (planningScene.phase === PHASE.PLANNING || planningScene.phase === PHASE.AUGMENT) {
          refreshPlanningBoardUi(callbackScene);
        }
      },
      onAfterRefresh: (
        callbackScene: Parameters<typeof refreshPlanningBattlefieldDecorations>[0]
      ): void => {
        refreshPlanningBattlefieldDecorations(callbackScene);
      }
    } as unknown as Parameters<typeof refreshSharedBoardGeometry>[1]
  );
}

export function pointPlanningInBoardPanel(
  scene: PlanningSceneLike,
  x: number,
  y: number
): boolean {
  return pointInSharedBoardPanel(
    scene as unknown as Parameters<typeof pointInSharedBoardPanel>[0],
    x,
    y
  );
}