/**
 * ThreePlanningDockHeaderLayout.ts
 *
 * Planning dock header and top header layout for Three.js.
 * Calculates responsive geometry for dock titles, subtitle/info text,
 * dynamic text scale fitting, and pagination navigation controls.
 */

import { scaleFontPx } from "./ThreeUiResponsive.js";
import { UI_COLORS, UI_FONT } from "../core/uiTheme.js";
import { createPaginationButtons } from "../ui/PaginationControls.js";

type FontRole = "title" | "body" | "label" | "button" | "caption" | "tooltipTitle" | "tooltipBody";
type AnyObj = Record<string, unknown>;

export type TextObjectLike = {
  active?: boolean;
  displayWidth?: number;
  width?: number;
  setScale?: (scale: number) => void;
  setText?: (text: string) => void;
  setPosition?: (x: number, y: number) => void;
  setVisible?: (visible: boolean) => void;
  setOrigin?: (x: number, y?: number) => void;
  setDepth?: (depth: number) => void;
  destroy?: () => void;
};

export type SceneLike = {
  add: {
    text: (x: number, y: number, text: string, style?: AnyObj) => TextObjectLike;
  };
  createButton?: (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    options?: { variant?: string; fontSize?: number | string; bold?: boolean }
  ) => { setVisible: (v: boolean) => void; setEnabled: (v: boolean) => void; destroy?: () => void };
} & Record<string, unknown>;

export type DockHeaderOptions = {
  compact?: boolean;
  depth?: number;
  title?: string;
  titleFontSize?: string | number;
  titleTextRole?: string;
  titleColor?: string;
  titleFontStyle?: string;
  createInfo?: boolean;
  infoText?: string;
  infoFontSize?: string | number;
  infoTextRole?: string;
  infoColor?: string;
  infoFontStyle?: string;
  onPrev?: () => void;
  onNext?: () => void;
  buttonH?: number;
  infoYOffset?: number;
  titleMinScale?: number;
  infoMinScale?: number;
  infoVisible?: boolean;
  areaX?: number;
  areaY?: number;
  areaW?: number;
  leftPad?: number;
  rightPad?: number;
  rowY?: number;
  buttonCount?: number;
  buttonW?: number;
  buttonGap?: number;
  reservedInfoWidth?: number;
  titleInfoGap?: number;
  infoButtonsGap?: number;
  titleWidth?: number;
};

export type DockHeaderLayout = {
  areaX: number;
  areaY: number;
  areaW: number;
  rowY: number;
  titleX: number;
  titleMaxWidth: number;
  infoX: number;
  infoMaxWidth: number;
  buttonsX: number;
  buttonsY: number;
  rightEdge: number;
  buttonCount: number;
  buttonW: number;
  buttonGap: number;
  buttonGroupW: number;
  reservedInfoWidth: number;
  titleInfoGap: number;
  infoButtonsGap: number;
  contentRightX: number;
  defaultInset: number;
  defaultPad: number;
};

export type DockHeader = {
  titleText: TextObjectLike;
  infoText: TextObjectLike | null;
  prevBtn: unknown;
  nextBtn: unknown;
  _options: DockHeaderOptions & { infoVisible: boolean; title: string; infoText: string };
  _layout: DockHeaderLayout;
  relayout: (overrides?: Partial<DockHeaderOptions>) => DockHeader;
  destroy: () => void;
};

function resolveFontSize(scene: SceneLike, fontSize: string | number, role: FontRole | undefined): string | number {
  if (typeof fontSize === "string") return fontSize;
  return scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], fontSize, role);
}

function measureDisplayWidth(textObject: TextObjectLike | null | undefined): number {
  return Math.max(0, Number(textObject?.displayWidth ?? textObject?.width) || 0);
}

export function fitDockHeaderText(textObject: TextObjectLike | null | undefined, maxWidth: number, minScale = 0.78): void {
  if (!textObject || textObject.active === false) return;
  textObject.setScale?.(1);
  const width = measureDisplayWidth(textObject);
  if (width <= 0 || width <= maxWidth) return;
  const nextScale = Math.max(minScale, Math.min(1, maxWidth / width));
  textObject.setScale?.(nextScale);
}

export function computePlanningDockHeaderLayout(options: DockHeaderOptions = {}): DockHeaderLayout {
  const compact = options.compact === true;
  const defaultInset = compact ? 8 : 10;
  const defaultPad = compact ? 10 : 12;
  const areaX = Number(options.areaX) || 0;
  const areaY = Number(options.areaY) || 0;
  const areaW = Math.max(0, Number(options.areaW) || 0);
  const leftPad = Number.isFinite(options.leftPad) ? (options.leftPad as number) : defaultPad;
  const rightPad = Number.isFinite(options.rightPad) ? (options.rightPad as number) : 12;
  const rowY = Number.isFinite(options.rowY) ? (options.rowY as number) : areaY + defaultInset + defaultPad;
  const titleX = areaX + leftPad;
  const rightEdge = areaX + areaW - rightPad;
  const buttonCount = Math.max(0, Number.isFinite(options.buttonCount) ? Math.floor(options.buttonCount as number) : 2);
  const buttonW = Number.isFinite(options.buttonW) ? (options.buttonW as number) : 30;
  const buttonGap = Number.isFinite(options.buttonGap) ? (options.buttonGap as number) : 8;
  const buttonGroupW = buttonCount > 0 ? buttonW * buttonCount + buttonGap * Math.max(0, buttonCount - 1) : 0;
  const buttonsX = rightEdge - buttonGroupW;
  const reservedInfoWidth = Math.max(0, Number(options.reservedInfoWidth) || 0);
  const titleInfoGap = reservedInfoWidth > 0 ? (Number.isFinite(options.titleInfoGap) ? (options.titleInfoGap as number) : 14) : 0;
  const infoButtonsGap = buttonCount > 0 ? (Number.isFinite(options.infoButtonsGap) ? (options.infoButtonsGap as number) : 14) : 0;
  const contentRightX = buttonCount > 0 ? buttonsX - infoButtonsGap : rightEdge;
  const titleWidth = Math.max(0, Number(options.titleWidth) || 0);
  const titleMaxWidth = Math.max(32, contentRightX - titleX - reservedInfoWidth - titleInfoGap);
  const infoX = titleX + titleWidth + titleInfoGap;
  const infoMaxWidth = Math.max(0, contentRightX - infoX);

  return {
    areaX,
    areaY,
    areaW,
    rowY,
    titleX,
    titleMaxWidth,
    infoX,
    infoMaxWidth,
    buttonsX,
    buttonsY: rowY - 2,
    rightEdge,
    buttonCount,
    buttonW,
    buttonGap,
    buttonGroupW,
    reservedInfoWidth,
    titleInfoGap,
    infoButtonsGap,
    contentRightX,
    defaultInset,
    defaultPad
  };
}

export function createPlanningDockHeader(scene: SceneLike, options: DockHeaderOptions = {}): DockHeader {
  const compact = options.compact === true;
  const depth = Number.isFinite(options.depth) ? (options.depth as number) : 2000;
  const titleText = scene.add.text(0, 0, String(options.title ?? ""), {
    fontFamily: UI_FONT,
    fontSize: resolveFontSize(scene, options.titleFontSize ?? (compact ? 12 : 13), (options.titleTextRole ?? "label") as FontRole),
    color: options.titleColor ?? UI_COLORS.textSecondary,
    fontStyle: options.titleFontStyle ?? "bold"
  });
  if (typeof titleText.setDepth === "function") titleText.setDepth(depth);
  if (typeof titleText.setOrigin === "function") titleText.setOrigin(0, 0);

  const infoText = options.createInfo === false
    ? null
    : scene.add.text(0, 0, String(options.infoText ?? ""), {
      fontFamily: UI_FONT,
      fontSize: resolveFontSize(scene, options.infoFontSize ?? (compact ? 10 : 11), (options.infoTextRole ?? "body") as FontRole),
      color: options.infoColor ?? UI_COLORS.textPrimary,
      fontStyle: options.infoFontStyle ?? "normal"
    });
  if (infoText && typeof infoText.setDepth === "function") infoText.setDepth(depth);
  if (infoText && typeof infoText.setOrigin === "function") infoText.setOrigin(0, 0);

  const buttonCount = options.onPrev || options.onNext ? 2 : 0;
  const baseLayout = computePlanningDockHeaderLayout({ ...options, compact, buttonCount, titleWidth: 0 });
  const pagination = buttonCount > 0 && typeof scene.createButton === "function"
    ? createPaginationButtons(scene as unknown as Parameters<typeof createPaginationButtons>[0], {
      x: baseLayout.buttonsX,
      y: baseLayout.buttonsY,
      btnW: baseLayout.buttonW,
      btnH: Number.isFinite(options.buttonH) ? (options.buttonH as number) : 26,
      gap: baseLayout.buttonGap,
      onPrev: options.onPrev ?? (() => {}),
      onNext: options.onNext ?? (() => {})
    })
    : null;

  const header: DockHeader = {
    titleText,
    infoText,
    prevBtn: pagination?.prevBtn ?? null,
    nextBtn: pagination?.nextBtn ?? null,
    _options: {
      ...options,
      compact,
      buttonCount,
      title: String(options.title ?? ""),
      infoText: String(options.infoText ?? ""),
      infoVisible: options.infoVisible !== false
    },
    _layout: baseLayout,
    relayout(overrides: Partial<DockHeaderOptions> = {}) {
      this._options = { ...this._options, ...overrides };
      if (overrides.title != null) this._options.title = String(overrides.title);
      if (Object.prototype.hasOwnProperty.call(overrides, "infoText")) this._options.infoText = String(overrides.infoText ?? "");
      if (Object.prototype.hasOwnProperty.call(overrides, "infoVisible")) this._options.infoVisible = overrides.infoVisible !== false;
      if (typeof this.titleText.setText === "function") this.titleText.setText(this._options.title);

      let layout = computePlanningDockHeaderLayout({ ...this._options, titleWidth: 0 });
      if (typeof this.titleText.setPosition === "function") this.titleText.setPosition(layout.titleX, layout.rowY);
      fitDockHeaderText(this.titleText, layout.titleMaxWidth, this._options.titleMinScale ?? 0.8);

      layout = computePlanningDockHeaderLayout({ ...this._options, titleWidth: measureDisplayWidth(this.titleText) });
      if (typeof this.titleText.setPosition === "function") this.titleText.setPosition(layout.titleX, layout.rowY);
      this._layout = layout;

      if (this.infoText) {
        if (typeof this.infoText.setText === "function") this.infoText.setText(this._options.infoText);
        if (typeof this.infoText.setPosition === "function") this.infoText.setPosition(layout.infoX, layout.rowY + (this._options.infoYOffset ?? 0));
        fitDockHeaderText(this.infoText, layout.infoMaxWidth, this._options.infoMinScale ?? 0.78);
        const showInfo = this._options.infoVisible && Boolean(String(this._options.infoText ?? "").trim());
        if (typeof this.infoText.setVisible === "function") this.infoText.setVisible(showInfo);
      }
      return this;
    },
    destroy() {
      pagination?.destroy?.();
      this.titleText?.destroy?.();
      this.infoText?.destroy?.();
    }
  };

  return header.relayout();
}

export default {
  fitDockHeaderText,
  computePlanningDockHeaderLayout,
  createPlanningDockHeader
};
