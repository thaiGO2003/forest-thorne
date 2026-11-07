import { UI_SPACING } from "../../core/uiTheme.js";

import { getPlanningBenchCap } from "./planningFormationRuntime.js";

export function computePlanningLayout(scene: { scale: { width: number; height: number }; [key: string]: unknown }) {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const compactHud = h <= 720;
  const margin = Math.max(UI_SPACING.SM, Math.floor(w * 0.015));
  const gridCols = 12;
  const colGap = UI_SPACING.SM;
  const gridW = w - margin * 2;
  const colW = Math.floor((gridW - colGap * (gridCols - 1)) / gridCols);

  const boardCols = gridCols;
  const contentW = boardCols * colW + (boardCols - 1) * colGap;

  const topPanelY = margin;
  const topPanelH = compactHud ? 92 : 108;
  const boardPanelX = margin;
  const boardPanelY = topPanelY + topPanelH + UI_SPACING.SM;

  const sidePanelW = colW * 2.5;
  const leftSidePanelX = boardPanelX + 10;
  const sidePanelX = w - margin - sidePanelW - 10;
  const sidePanelY = boardPanelY + 10;
  let sidePanelH = compactHud ? 132 : 160;

  const actionsH = compactHud ? 44 : 52;
  const lowerSplitGap = UI_SPACING.LG;

  const shopRegionW = Math.floor(contentW * 0.42);
  const benchRegionW = contentW - shopRegionW - lowerSplitGap;
  const shopRegionX = boardPanelX;
  const benchRegionX = shopRegionX + shopRegionW + lowerSplitGap;
  const benchRegionInnerGap = compactHud ? UI_SPACING.SM : UI_SPACING.MD;

  const benchSlotsRegionX = benchRegionX;
  const craftRegionW = Math.max(340, Math.floor(benchRegionW * 0.44));
  const benchSlotsRegionW = Math.max(220, benchRegionW - craftRegionW - benchRegionInnerGap);
  const craftRegionX = benchRegionX + benchSlotsRegionW + benchRegionInnerGap;
  const craftInnerPad = compactHud ? 12 : 14;

  const shopCardH = compactHud ? 126 : 154;
  const shopInnerPad = compactHud ? 14 : 18;
  const benchRows = 2;
  const benchCap = getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0]);
  const maxVisibleBenchCols = compactHud ? 5 : 6;
  const benchCols = Math.min(maxVisibleBenchCols, Math.max(4, Math.ceil(benchCap / benchRows)));
  const compactBench = benchCols > 4;
  const benchSlotH = compactHud
    ? (compactBench ? 108 : 116)
    : (compactBench ? 116 : 124);
  const benchRowGap = UI_SPACING.XS;

  const lowerPanelH = compactHud ? 292 : 324;
  const lowerBottomY = h - margin;
  const lowerTopY = lowerBottomY - lowerPanelH;
  const lowerInnerPad = compactHud ? 12 : 14;

  const invCellSize = compactHud ? 34 : 38;
  const invY = lowerTopY + lowerInnerPad;

  const benchBlockH = benchRows * benchSlotH + (benchRows - 1) * benchRowGap;
  const benchY = lowerBottomY - lowerInnerPad - benchBlockH;
  const shopY = lowerBottomY - lowerInnerPad - shopCardH;

  const controlsY = lowerTopY - (compactHud ? 8 : 12);
  const actionsY = controlsY - actionsH - (compactHud ? 4 : 6);
  const boardPanelH = Math.max(250, actionsY - UI_SPACING.SM - boardPanelY);
  const floatingPanelGap = compactHud ? 1 : 1;
  const floatingPanelBottomPad = 34;
  const floatingPanelAvailableH = Math.max(
    compactHud ? 194 : 236,
    boardPanelH - 10 - floatingPanelGap - floatingPanelBottomPad
  );
  sidePanelH = Math.max(compactHud ? 88 : 104, Math.min(sidePanelH, Math.floor(floatingPanelAvailableH * 0.42)));
  const leftUnitInfoPanelY = sidePanelY + sidePanelH + floatingPanelGap;
  const leftUnitInfoPanelH = Math.max(compactHud ? 82 : 108, floatingPanelAvailableH - sidePanelH);

  const shopGap = UI_SPACING.SM;
  const shopCardsX = shopRegionX + shopInnerPad;
  const shopCardsW = Math.max(120, shopRegionW - shopInnerPad * 2);
  const shopCardW = Math.floor((shopCardsW - shopGap * 4) / 5);
  const benchGap = compactBench ? 5 : UI_SPACING.XS;
  const benchInnerPad = 8;
  const benchSlotWRaw = Math.floor((benchSlotsRegionW - benchInnerPad * 2 - benchGap * (benchCols - 1)) / benchCols);
  const benchSlotW = compactBench
    ? Math.max(24, benchSlotWRaw)
    : Math.max(44, benchSlotWRaw);

  const boardNudgeX = -36;
  const boardNudgeY = -46;

  return {
    width: w,
    height: h,
    compactHud,
    margin,
    colW,
    colGap,
    gridCols,
    contentW,
    topPanelY,
    topPanelH,
    boardOriginX: boardPanelX + Math.floor(contentW * 0.35) + boardNudgeX,
    boardOriginY: boardPanelY + Math.floor(boardPanelH * 0.75) + boardNudgeY,
    boardPanelX,
    boardPanelY,
    boardPanelW: contentW,
    boardPanelH,
    leftSidePanelX,
    leftUnitInfoPanelY,
    leftUnitInfoPanelH,
    sidePanelX,
    sidePanelY,
    sidePanelW,
    sidePanelH,
    benchRegionX,
    benchRegionW,
    benchSlotsRegionX,
    benchSlotsRegionW,
    craftRegionX,
    craftRegionW,
    craftInnerPad,
    shopRegionX,
    shopRegionW,
    shopInnerPad,
    shopCardsX,
    shopCardsW,
    actionsY,
    controlsY,
    shopY,
    benchY,
    benchRows,
    benchCols,
    benchVisibleSlots: benchCols * benchRows,
    benchRowGap,
    shopCardW,
    shopCardH,
    shopGap,
    lowerPanelH,
    lowerTopY,
    lowerBottomY,
    benchSlotW,
    benchSlotH,
    benchGap,
    invY,
    invCellSize
  };
}
