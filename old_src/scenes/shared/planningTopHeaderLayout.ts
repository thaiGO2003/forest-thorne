import { UI_SPACING } from "../../core/uiTheme.js";
import { fitDockHeaderText } from "./planningDockHeaderLayout.js";
import type Phaser from "phaser";

type TextLike = Phaser.GameObjects.Text | {
  displayWidth?: number;
  width?: number;
  displayHeight?: number;
  height?: number;
  active?: boolean;
  text?: string;
  setScale?: (n: number) => unknown;
  setVisible?: (v: boolean) => unknown;
  setPosition?: (x: number, y: number) => unknown;
};
type LayoutLike = {
  compactHud?: boolean;
  boardPanelX: number;
  boardPanelY?: number;
  boardPanelW: number;
  topPanelY: number;
  topPanelH: number;
  [key: string]: unknown;
};

const TOP_HEADER_BUTTON_ORDER = ["cortisol", "reset", "history", "wiki", "settings"] as const;
type TopButtonKey = (typeof TOP_HEADER_BUTTON_ORDER)[number];

function measureDisplayWidth(textObject: TextLike | null | undefined): number {
  return Math.max(0, Number(textObject?.displayWidth ?? textObject?.width) || 0);
}

function measureDisplayHeight(textObject: TextLike | null | undefined): number {
  return Math.max(0, Number(textObject?.displayHeight ?? textObject?.height) || 0);
}

export function getPlanningTopButtonWidths(compact = false) {
  return {
    settings: compact ? 96 : 104,
    wiki: compact ? 106 : 114,
    history: compact ? 96 : 104,
    reset: compact ? 88 : 96,
    cortisol: compact ? 170 : 186
  };
}

export function computePlanningTopHeaderMetrics(layout: LayoutLike) {
  const compact = layout?.compactHud === true;
  const gap = UI_SPACING.SM;
  const buttonWidths = getPlanningTopButtonWidths(compact);
  const topButtonsGroupW = TOP_HEADER_BUTTON_ORDER.reduce((total, key: TopButtonKey) => total + (buttonWidths[key] ?? 0), 0)
    + gap * Math.max(0, TOP_HEADER_BUTTON_ORDER.length - 1);
  const titleX = layout.boardPanelX + UI_SPACING.SM;
  const titleY = layout.topPanelY + UI_SPACING.SM - (compact ? 2 : 4);
  const topBtnY = layout.topPanelY + (compact ? 12 : 14);
  const topButtonsRightPad = 12;
  const topButtonsLeftX = layout.boardPanelX + layout.boardPanelW - topButtonsRightPad - topButtonsGroupW;
  const titleRowReserve = compact ? 28 : 32;
  const chipRowGap = compact ? 8 : 10;
  const chipY = titleY + titleRowReserve + chipRowGap;
  const chipH = compact ? 30 : 36;
  const chipBarOffset = compact ? 31 : 38;

  return {
    compact,
    gap,
    titleX,
    titleY,
    topBtnY,
    topButtonsLeftX,
    topButtonsRightPad,
    topButtonsGroupW,
    metaGap: compact ? 12 : 16,
    metaRightX: topButtonsLeftX - gap,
    buttonWidths,
    titleRowReserve,
    chipRowGap,
    chipY,
    chipH,
    chipBarY: chipY + chipBarOffset
  };
}

export function computePlanningTeamStatusStripMetrics(layout: LayoutLike) {
  const compact = layout?.compactHud === true;
  const gap = compact ? 12 : 14;
  const badgeW = compact ? 42 : 48;
  const badgeH = compact ? 26 : 30;
  const rowGap = compact ? 6 : 8;
  const barH = compact ? 9 : 10;
  const cardH = Math.max(compact ? 34 : 40, barH * 2 + rowGap + 14);
  const sidePad = UI_SPACING.SM;
  const bottomPad = compact ? 10 : 12;
  const availableW = Math.max(320, layout.boardPanelW - sidePad * 2);
  const maxGroupW = compact ? 280 : 320;
  const minGroupW = compact ? 220 : 240;
  const groupW = Math.max(
    minGroupW,
    Math.min(maxGroupW, Math.floor((availableW - badgeW - gap * 2) / 2))
  );
  const contentW = groupW * 2 + badgeW + gap * 2;
  const contentX = layout.boardPanelX + Math.max(0, Math.floor((layout.boardPanelW - contentW) / 2));
  const leftX = contentX;
  const rowY = layout.topPanelY + layout.topPanelH - bottomPad - cardH;
  const badgeCenterX = contentX + groupW + gap + badgeW / 2;
  const badgeCenterY = rowY + cardH / 2;
  const rightX = contentX + groupW + gap * 2 + badgeW;
  const rightY = rowY;

  return {
    compact,
    sidePad,
    gap,
    badgeW,
    badgeH,
    availableW,
    groupW,
    leftX,
    leftY: rowY,
    rightX,
    rightY,
    badgeCenterX,
    badgeCenterY,
    rowY,
    barH,
    cardH,
    bottomPad,
    contentW,
    contentX
  };
}

export function layoutPlanningHeaderMeta(titleText: TextLike | null | undefined, metaText: TextLike | null | undefined, layout: LayoutLike | null | undefined) {
  if (!titleText?.active || !metaText?.active || !layout) return null;

  const metrics = computePlanningTopHeaderMetrics(layout);
  const titleWidth = measureDisplayWidth(titleText);
  const metaX = metrics.titleX + titleWidth + metrics.metaGap;
  const metaMaxWidth = Math.max(48, metrics.metaRightX - metaX);
  const hasText = Boolean(String(metaText.text ?? "").trim());

  metaText.setScale?.(1);
  fitDockHeaderText(metaText, metaMaxWidth, 0.72);
  const metaHeight = measureDisplayHeight(metaText);
  const titleHeight = measureDisplayHeight(titleText);
  const metaY = metrics.titleY + Math.max(0, Math.floor((titleHeight - metaHeight) * 0.5));

  metaText.setPosition?.(metaX, metaY);
  metaText.setVisible?.(hasText);

  return {
    ...metrics,
    metaX,
    metaY,
    metaMaxWidth
  };
}
