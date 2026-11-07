import Phaser from "phaser";
import { getClassLabel, getTribeLabel } from "../data/unitVisuals.js";
import { getLocale, t } from "../i18n/index.js";
import { normalizeTooltipSide } from "../scenes/shared/unitTooltipRuntimeShared.js";
import {
  getUiViewportProfile,
  getUiScaleTokens,
  getMinTouchTarget,
  scaleFontPx,
  scaleUiSize,
  shouldUsePinnedTooltip
} from "./uiResponsive.js";
import {
  hasTooltipHighlightMarkup,
  parseTooltipHighlightSegments,
  stripTooltipHighlightMarkup
} from "./tooltipInlineMarkup.js";
import { attachUnitAvatarStarIdentity } from "../ui/unitAvatarRenderer.js";

interface AvatarData extends Record<string, unknown> {
  visual?: VisualModule | { visual?: VisualModule; previewIcon?: unknown; icon?: unknown; portraitKey?: unknown };
  star?: number;
  baseId?: string;
  surface?: string;
  appearance?: unknown;
  classType?: string;
  tribe?: string;
  unitCore?: unknown;
  ownerKind?: string;
  collectionProfile?: unknown;
}

interface SpeechLayoutOptions {
  avatarLeft: number;
  avatarTop: number;
  avatarSize: number;
  compact: boolean;
  theme: TooltipTheme;
  label: string;
  lang: string;
}

interface TextLineOptions { fontSize?: number | string; color?: string; lineSpacing?: number; }
interface SectionLayoutOptions extends TextLineOptions { blockGap?: number; }
interface ChipWidthOptions { minWidth?: number; basePadX?: number; extraEmojiPad?: number; }
interface VisualModule extends Record<string, unknown> {
  createModel(scene: Phaser.Scene, options: Record<string, unknown>): unknown;
}

interface RichContent extends Record<string, unknown> {
  avatar?: AvatarData;
  theme?: TooltipTheme;
  title?: unknown;
  layoutMode?: unknown;
  sectionColumns?: SectionBlock[][];
  sectionBlocks?: SectionBlock[];
  badgeRows?: ChipItem[];
  statusIcons?: ChipItem[];
  meterRows?: MeterItem[];
  speechLabel?: string;
  speechLang?: string;
}

interface ChipItem extends Record<string, unknown> {
  tone?: string;
  text?: unknown;
  icon?: unknown;
  label?: unknown;
  badgeText?: unknown;
  fill?: number;
  textColor?: string;
}

interface MeterItem extends Record<string, unknown> {
  key?: string;
  label?: unknown;
  kind?: string;
  value: number;
  max: number;
  shield: number;
  color?: number;
  emptyColor?: number;
  shieldColor?: number;
  labelColor?: string;
}

interface AttachOptions extends Record<string, unknown> {
  triggerMode?: string;
  pinKey?: unknown;
  showContent?: (pointer: Phaser.Input.Pointer | null | undefined, content: TooltipRecord, controller: TooltipController) => boolean | void;
  onShow?: (meta: TooltipRecord) => void;
  onHide?: (meta: TooltipRecord) => void;
}

import {
  canUseBrowserSpeechSynthesis,
  resolveBrowserSpeechLang,
  speakWithBrowserVoice
} from "./browserSpeech.js";
import { EMOJI_FONT, UI_FONT } from "./uiTheme.js";

interface TooltipGameObjectLike {
  active?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  originX?: number;
  originY?: number;
  alpha?: number;
  canvas?: { getContext?(kind: string): CanvasRenderingContext2D | null } | null;
  context?: CanvasRenderingContext2D | null;
  style?: Record<string, unknown>;
  getBounds?(): Phaser.Geom.Rectangle;
  setFontSize?(size: number | string): unknown;
  setText?(value: string | string[]): unknown;
  setWordWrapWidth?(width: number, advanced?: boolean): unknown;
  setColor?(color: string): unknown;
  setStyle?(style: Record<string, unknown>): unknown;
  setPosition?(x: number, y: number): unknown;
  setSize?(width: number, height: number): unknown;
  setVisible?(visible: boolean): unknown;
  setAlpha?(alpha: number): unknown;
  setDepth?(depth: number): unknown;
  setInteractive?(config?: Record<string, unknown>): unknown;
  on?(eventName: string, handler: (...args: unknown[]) => void): unknown;
  clear?(): unknown;
  fillStyle?(color: number, alpha?: number): unknown;
  lineStyle?(width: number, color: number, alpha?: number): unknown;
  beginPath?(): unknown;
  moveTo?(x: number, y: number): unknown;
  lineTo?(x: number, y: number): unknown;
  closePath?(): unknown;
  fillPath?(): unknown;
  strokePath?(): unknown;
  destroy?(): unknown;
}

interface TooltipTheme {
  panelFill?: number;
  panelStroke?: number;
  titleColor?: string;
  subtitleColor?: string;
  bodyColor?: string;
  mutedColor?: string;
  badgeText?: string;
  avatarFill?: number;
  avatarInner?: number;
  avatarStroke?: number;
  avatarIconColor?: string;
  chipFill?: number;
  chipStroke?: number;
  headerFill?: number;
  bodyFill?: number;
  railFill?: number;
  bench?: number;
  railStroke?: number;
  dividerColor?: number;
}

type TooltipRecord = Record<string, unknown>;
interface ChamferedBoxOptions {
  fillColor?: number | null;
  fillAlpha?: number;
  strokeColor?: number | null;
  strokeAlpha?: number;
  strokeWidth?: number;
}

interface SectionBlock {
  title: string;
  lines: string[];
}

type TooltipScene = Phaser.Scene & Record<string, unknown> & {
  getRoleTheme?: (classType: string | null) => TooltipTheme;
};

function asTooltipObject(value: unknown): TooltipGameObjectLike | null {
  return value && typeof value === "object" ? value as TooltipGameObjectLike : null;
}


const RICH_BADGE_TONES = {
  gold: { fill: 0x4d3b15, text: "#ffd98a" },
  star: { fill: 0x4f3f18, text: "#ffd98a" },
  tier: { fill: 0x3f2b1a, text: "#ffd6a2" },
  class: { fill: 0x183452, text: "#d8efff" },
  tribe: { fill: 0x173f30, text: "#c6ffe0" },
  rage: { fill: 0x42202f, text: "#ffbfce" },
  status: { fill: 0x223246, text: "#edf7ff" },
  stat: { fill: 0x182737, text: "#e6f4ff" },
  default: { fill: 0x1c2736, text: "#edf7ff" }
};

const DEFAULT_METER_PALETTES = {
  hp: { color: 0x69df7b, emptyColor: 0x223246, shieldColor: 0x7bd3ff, labelColor: "#b7d2e8" },
  power: { color: 0x67c5ff, emptyColor: 0x18273a, shieldColor: 0xaee4ff, labelColor: "#c6ebff" },
  rage: { color: 0xffbf4f, emptyColor: 0x32261a, shieldColor: 0xffd98a, labelColor: "#ffdca6" },
  default: { color: 0x7bd3ff, emptyColor: 0x223246, shieldColor: 0xaee4ff, labelColor: "#d7e9f6" }
};

const ACTIVE_TOOLTIP_TEXT_COLOR = "#94ef8a";

function toBounds(value: unknown): Phaser.Geom.Rectangle | null {
  const target = asTooltipObject(value);
  if (!target) return null;
  if (typeof target.getBounds === "function") {
    const bounds = target.getBounds();
    if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      return bounds;
    }
  }

  const width = Number.isFinite(target.displayWidth) ? Number(target.displayWidth) : Number(target.width);
  const height = Number.isFinite(target.displayHeight) ? Number(target.displayHeight) : Number(target.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const originX = Number.isFinite(target.originX) ? Number(target.originX) : 0.5;
  const originY = Number.isFinite(target.originY) ? Number(target.originY) : 0.5;
  const x = Number(target.x ?? 0) - width * originX;
  const y = Number(target.y ?? 0) - height * originY;
  return new Phaser.Geom.Rectangle(x, y, width, height);
}

function pointInBounds(bounds: Phaser.Geom.Rectangle | null | undefined, x: number, y: number): boolean {
  return Boolean(Number.isFinite(x)
    && Number.isFinite(y)
    && bounds
    && Phaser.Geom.Rectangle.Contains(bounds, x, y));
}

function canMutateTextObject(value: unknown): boolean {
  const textObj = asTooltipObject(value);
  if (!textObj || textObj.active === false) return false;
  const hasTextApi = typeof textObj.setText === "function"
    || typeof textObj.setFontSize === "function"
    || typeof textObj.setWordWrapWidth === "function"
    || typeof textObj.setColor === "function";
  if (!hasTextApi) return true;
  const canvas = textObj.canvas;
  const context = textObj.context;
  if ("canvas" in textObj && !canvas) return false;
  if ("context" in textObj && !context) return false;
  if (canvas && typeof canvas.getContext === "function") {
    try {
      const liveContext = context ?? canvas.getContext("2d");
      if (!liveContext || typeof liveContext.drawImage !== "function") return false;
    } catch {
      return false;
    }
  }
  return true;
}

function applyTextStyle(value: unknown, fontSize: number | string, wrapWidth?: number): boolean {
  const textObj = asTooltipObject(value);
  if (!textObj || !canMutateTextObject(textObj)) return false;
  try {
    if (typeof textObj.setFontSize === "function") {
      textObj.setFontSize(fontSize);
    } else if (typeof textObj.setStyle === "function") {
      textObj.setStyle({ fontSize });
    } else if (textObj.style) {
      textObj.style.fontSize = fontSize;
    }
    if (Number.isFinite(wrapWidth) && typeof textObj.setWordWrapWidth === "function") {
      textObj.setWordWrapWidth(wrapWidth ?? 0, true);
    }
    return true;
  } catch {
    return false;
  }
}

function setVisibleSafe(value: unknown, visible: boolean): void {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setVisible !== "function" || obj.active === false) return;
  try {
    obj.setVisible(visible);
  } catch {
    void 0;
  }
}

function setTextSafe(value: unknown, text: unknown): boolean {
  const obj = asTooltipObject(value);
  if (!obj || !canMutateTextObject(obj) || typeof obj.setText !== "function") return false;
  try {
    obj.setText(typeof text === "string" || Array.isArray(text) ? text as string | string[] : String(text ?? ""));
    return true;
  } catch {
    return false;
  }
}

function setColorSafe(value: unknown, color: string): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setColor !== "function" || obj.active === false) return false;
  try {
    obj.setColor(color);
    return true;
  } catch {
    return false;
  }
}

function setStyleSafe(value: unknown, style: Record<string, unknown>): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setStyle !== "function" || obj.active === false) return false;
  try {
    obj.setStyle(style);
    return true;
  } catch {
    return false;
  }
}

function setPositionSafe(value: unknown, x: number, y: number): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setPosition !== "function" || obj.active === false) return false;
  try {
    obj.setPosition(x, y);
    return true;
  } catch {
    return false;
  }
}

function setSizeSafe(value: unknown, width: number, height: number): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setSize !== "function" || obj.active === false) return false;
  try {
    obj.setSize(width, height);
    return true;
  } catch {
    return false;
  }
}

function setInteractiveSafe(value: unknown, config: Record<string, unknown> = {}): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.setInteractive !== "function" || obj.active === false) return false;
  try {
    obj.setInteractive(config);
    return true;
  } catch {
    return false;
  }
}

function registerInputSafe(value: unknown, eventName: string, handler: (...args: unknown[]) => void): boolean {
  const obj = asTooltipObject(value);
  if (!obj || typeof obj.on !== "function" || obj.active === false) return false;
  try {
    obj.on(eventName, handler);
    return true;
  } catch {
    return false;
  }
}

function drawChamferedBox(value: unknown, x: number, y: number, width: number, height: number, cut: number, options: ChamferedBoxOptions = {}): void {
  const graphics = asTooltipObject(value);
  if (!graphics || graphics.active === false) return;
  const safeWidth = Math.max(12, Number(width) || 0);
  const safeHeight = Math.max(12, Number(height) || 0);
  const maxCut = Math.max(2, Math.floor(Math.min(safeWidth, safeHeight) * 0.5) - 1);
  const safeCut = Math.max(2, Math.min(Math.floor(cut) || 0, maxCut));
  const {
    fillColor = null,
    fillAlpha = 1,
    strokeColor = null,
    strokeAlpha = 1,
    strokeWidth = 0
  } = options;
  graphics.clear?.();
  if (fillColor !== null) {
    graphics.fillStyle?.(fillColor, fillAlpha);
  }
  if (strokeColor !== null && strokeWidth > 0) {
    graphics.lineStyle?.(strokeWidth, strokeColor, strokeAlpha);
  }
  graphics.beginPath?.();
  graphics.moveTo?.(x + safeCut, y);
  graphics.lineTo?.(x + safeWidth - safeCut, y);
  graphics.lineTo?.(x + safeWidth, y + safeCut);
  graphics.lineTo?.(x + safeWidth, y + safeHeight - safeCut);
  graphics.lineTo?.(x + safeWidth - safeCut, y + safeHeight);
  graphics.lineTo?.(x + safeCut, y + safeHeight);
  graphics.lineTo?.(x, y + safeHeight - safeCut);
  graphics.lineTo?.(x, y + safeCut);
  graphics.closePath?.();
  if (fillColor !== null) {
    graphics.fillPath?.();
  }
  if (strokeColor !== null && strokeWidth > 0) {
    graphics.strokePath?.();
  }
}

function normalizeTextLines(value: unknown): string[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function normalizeBadgeRow(row: unknown, theme: TooltipTheme = {}) {
  if (!row) return null;
  if (typeof row === "string") {
    return { text: row, tone: "default" };
  }
  if (typeof row !== "object") return null;
  const rowData = row as TooltipRecord;
  const text = String(rowData.text ?? rowData.label ?? rowData.title ?? "").trim();
  if (!text) return null;
  const tone = String(rowData.tone ?? "default");
  const palette = (RICH_BADGE_TONES as Record<string, { fill: number; text: string }>)[tone] ?? RICH_BADGE_TONES.default;
  return {
    text,
    tone,
    fill: rowData.fill ?? palette.fill ?? theme.chipFill ?? RICH_BADGE_TONES.default.fill,
    textColor: rowData.textColor ?? palette.text ?? theme.badgeText ?? "#edf7ff"
  };
}

function normalizeStatusIconRow(row: unknown, theme: TooltipTheme = {}) {
  if (!row) return null;
  if (typeof row === "string") {
    const text = row.trim();
    return text ? { icon: text, label: "", badgeText: "", tone: "status" } : null;
  }
  if (typeof row !== "object") return null;
  const rowData = row as TooltipRecord;
  const icon = String(rowData.icon ?? rowData.emoji ?? "").trim();
  const label = String(rowData.label ?? rowData.text ?? "").trim();
  const badgeText = String(rowData.badgeText ?? rowData.badge ?? "").trim();
  if (!icon && !label && !badgeText) return null;
  const tone = String(rowData.tone ?? "status");
  const palette = (RICH_BADGE_TONES as Record<string, { fill: number; text: string }>)[tone] ?? RICH_BADGE_TONES.status;
  return {
    icon,
    label,
    badgeText,
    tone,
    fill: rowData.fill ?? palette.fill ?? theme.chipFill ?? RICH_BADGE_TONES.status.fill,
    textColor: rowData.textColor ?? palette.text ?? theme.badgeText ?? "#edf7ff"
  };
}

function clampRatio(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeMeterRow(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const rowData = row as TooltipRecord;
  const kind = rowData.kind === "pips" ? "pips" : "bar";
  const value = Number.isFinite(Number(rowData.value)) ? Number(rowData.value) : 0;
  const max = Math.max(1, Number.isFinite(Number(rowData.max)) ? Number(rowData.max) : 1);
  const palette = (DEFAULT_METER_PALETTES as Record<string, { color: number; emptyColor: number; shieldColor: number; labelColor: string }>)[String(rowData.key ?? "default")] ?? DEFAULT_METER_PALETTES.default;
  return {
    key: String(rowData.key ?? "meter"),
    label: String(rowData.label ?? rowData.key ?? "").trim(),
    kind,
    value: Math.max(0, value),
    max,
    shield: Math.max(0, Number.isFinite(Number(rowData.shield)) ? Number(rowData.shield) : 0),
    color: rowData.color ?? palette.color,
    emptyColor: rowData.emptyColor ?? palette.emptyColor,
    shieldColor: rowData.shieldColor ?? palette.shieldColor,
    labelColor: rowData.labelColor ?? palette.labelColor
  };
}

function normalizeSectionBlock(block: unknown): SectionBlock | null {
  if (!block) return null;
  if (typeof block === "string") {
    const lines = normalizeTextLines(block);
    if (!lines.length) return null;
    return { title: "", lines };
  }
  if (typeof block !== "object") return null;
  const blockData = block as TooltipRecord;
  const title = String(blockData.title ?? blockData.label ?? "").trim();
  const rawLines = Array.isArray(blockData.lines)
    ? blockData.lines
    : normalizeTextLines(blockData.body ?? blockData.text ?? "");
  const lines = rawLines.map((line: unknown) => String(line ?? "").trimEnd()).filter((line: string) => line.trim().length > 0);
  if (!title && !lines.length) return null;
  return { title, lines };
}

function composeSectionText(blocks: SectionBlock[] = []): string {
  const lines: string[] = [];
  blocks.forEach((block) => {
    if (!block) return;
    if (block.title) {
      lines.push(`🔹 ${stripTooltipHighlightMarkup(block.title)}`);
    }
    (block.lines ?? []).forEach((line: string) => {
      lines.push(stripTooltipHighlightMarkup(String(line ?? "").trimEnd()));
    });
    if (block.lines?.length) {
      lines.push("");
    }
  });
  while (lines.length && !String(lines[lines.length - 1]).trim()) {
    lines.pop();
  }
  return lines.join("\n");
}

function columnBlocksContainHighlightMarkup(blocks: SectionBlock[] = []): boolean {
  return blocks.some((block) => {
    if (!block) return false;
    if (block.title && hasTooltipHighlightMarkup(block.title)) return true;
    return block.lines.some((line: string) => hasTooltipHighlightMarkup(String(line ?? "")));
  });
}

function estimateOverlayLineHeight(fontSize: unknown): number {
  const base = Number(fontSize) || 12;
  return Math.max(base + 5, Math.round(base * 1.35));
}

function normalizeSectionColumns(columns: unknown = []): SectionBlock[][] {
  if (!Array.isArray(columns)) return [];
  return columns
    .map((column: unknown) => Array.isArray(column)
      ? column.map((block: unknown) => normalizeSectionBlock(block)).filter((block): block is SectionBlock => Boolean(block))
      : [])
    .filter((column: SectionBlock[]) => column.length > 0);
}

function extractFontPx(value: unknown): number {
  const textObj = asTooltipObject(value);
  const raw = textObj?.style?.fontSize;
  const numeric = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 12;
}

function estimateEmojiAwareTextWidth(text: unknown, textObj: unknown, measuredWidth = 0): number {
  const fontPx = extractFontPx(textObj);
  let weightedUnits = 0;
  for (const char of Array.from(String(text ?? ""))) {
    if (/\p{Extended_Pictographic}/u.test(char)) {
      weightedUnits += 1.25;
    } else if (/[A-Z0-9À-Ỹ]/u.test(char)) {
      weightedUnits += 0.72;
    } else if (/[ilI1.,:;|\s]/u.test(char)) {
      weightedUnits += 0.35;
    } else {
      weightedUnits += 0.58;
    }
  }
  return Math.max(measuredWidth, Math.ceil(weightedUnits * fontPx));
}

function defaultRichTheme(scene: TooltipScene, side = "LEFT", classType: string | null = null): TooltipTheme {
  const roleTheme = scene.getRoleTheme?.(classType) ?? null;
  return {
    panelFill: 0x0f1827,
    panelStroke: 0xd0d5dd,
    titleColor: side === "RIGHT" ? "#ffdca6" : "#94ef8a",
    subtitleColor: "#bcc8d6",
    bodyColor: "#e7eef9",
    mutedColor: "#9fb0c2",
    badgeText: "#eff8ff",
    avatarFill: 0x243248,
    avatarInner: 0x1a283e,
    avatarStroke: 0xd3d8df,
    avatarIconColor: "#bba7ff",
    chipFill: roleTheme?.bench ?? 0x1f2e42,
    chipStroke: 0x5d728a,
    headerFill: 0x152033,
    bodyFill: 0x101a2a,
    railFill: 0x2e2418,
    railStroke: 0x4f637a,
    dividerColor: 0x52657c
  };
}

function isRichTooltipContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const value = content as TooltipRecord;
  return Boolean(value.avatar || value.badgeRows || value.statusIcons || value.meterRows || value.sectionBlocks || value.statRows || value.subtitle || value.theme);
}

export class TooltipController {
  scene: TooltipScene;
  root: Phaser.GameObjects.Container;
  width: number;
  height: number;
  richHeaderPad: number;
  richHeaderHeight: number;
  padX: number;
  padY: number;
  gapY: number;
  margin: number;
  viewportProfile: string;
  pinnedState: TooltipRecord | null;
  lastContent: TooltipRecord | null;
  lastRenderMode: string;
  currentSpeechLabel: string;
  currentSpeechLang: string;
  shadowBg: Phaser.GameObjects.Rectangle;
  richShadowShape: Phaser.GameObjects.Graphics;
  richPanelGlowShape: Phaser.GameObjects.Graphics;
  richPanelShape: Phaser.GameObjects.Graphics;
  richPanelFrameShape: Phaser.GameObjects.Graphics;
  richPanelInnerFrameShape: Phaser.GameObjects.Graphics;
  richHeaderPlateShape: Phaser.GameObjects.Graphics;
  panelGlow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  panelFrame: Phaser.GameObjects.Rectangle;
  panelInnerFrame: Phaser.GameObjects.Rectangle;
  headerPlate: Phaser.GameObjects.Rectangle;
  avatarGlow: Phaser.GameObjects.Rectangle;
  avatarFrame: Phaser.GameObjects.Rectangle;
  avatarInner: Phaser.GameObjects.Rectangle;
  avatarIcon: Phaser.GameObjects.Text;
  headerDivider: Phaser.GameObjects.Rectangle;
  speechButtonBg: Phaser.GameObjects.Rectangle;
  speechButtonText: Phaser.GameObjects.Text;
  avatarModel: Phaser.GameObjects.Container | null;
  avatarSprite?: Phaser.GameObjects.Image;
  subtitleText: Phaser.GameObjects.Text;
  headerMetaText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  headerDescriptionText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  rightText: Phaser.GameObjects.Text;
  divider: Phaser.GameObjects.Rectangle;
  divider2: Phaser.GameObjects.Rectangle;
  divider3: Phaser.GameObjects.Rectangle;
  col3Text: Phaser.GameObjects.Text;
  col4Text: Phaser.GameObjects.Text;
  badgeSlots: Array<{ bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>;
  statusSlots: Array<{ bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>;
  meterSlots: Array<{ label: Phaser.GameObjects.Text; valueText: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; shield: Phaser.GameObjects.Rectangle; pips: Phaser.GameObjects.Rectangle[] }>;
  richLineTextPool: Array<{ text: Phaser.GameObjects.Text; inUse: boolean }>;
  _scenePointerDownHandler: (pointer: Phaser.Input.Pointer) => void;
  _resizeHandler: () => void;

  constructor(scene: TooltipScene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0);
    this.root.setDepth(9000);
    this.root.setVisible(false);
    this.width = 320;
    this.height = 120;
    this.richHeaderPad = 0;
    this.richHeaderHeight = 0;
    this.padX = 12;
    this.padY = 10;
    this.gapY = 6;
    this.margin = 14;
    this.viewportProfile = getUiViewportProfile(scene);
    this.pinnedState = null;
    this.lastContent = null;
    this.lastRenderMode = "legacy";
    this.currentSpeechLabel = "";
    this.currentSpeechLang = resolveBrowserSpeechLang(getLocale());

    this.shadowBg = scene.add.rectangle(2, 2, this.width, this.height, 0x000000, 0.32);
    this.shadowBg.setOrigin(0, 0);
    this.richShadowShape = scene.add.graphics();
    this.richShadowShape.setVisible(false);
    this.richPanelGlowShape = scene.add.graphics();
    this.richPanelGlowShape.setVisible(false);
    this.richPanelShape = scene.add.graphics();
    this.richPanelShape.setVisible(false);
    this.richPanelFrameShape = scene.add.graphics();
    this.richPanelFrameShape.setVisible(false);
    this.richPanelInnerFrameShape = scene.add.graphics();
    this.richPanelInnerFrameShape.setVisible(false);
    this.richHeaderPlateShape = scene.add.graphics();
    this.richHeaderPlateShape.setVisible(false);
    this.panelGlow = scene.add.rectangle(3, 3, this.width + 2, this.height + 2, 0xb18b49, 0.08);
    this.panelGlow.setOrigin(0, 0);
    this.panelGlow.setVisible(false);
    this.bg = scene.add.rectangle(0, 0, this.width, this.height, 0x0f1624, 0.97);
    this.bg.setOrigin(0, 0);
    this.bg.setStrokeStyle(2, 0x8ec6ff, 1);
    this.panelFrame = scene.add.rectangle(0, 0, this.width, this.height, 0x000000, 0);
    this.panelFrame.setOrigin(0, 0);
    this.panelFrame.setStrokeStyle(3, 0xb18b49, 0.48);
    this.panelFrame.setVisible(false);
    this.panelInnerFrame = scene.add.rectangle(2, 2, this.width - 4, this.height - 4, 0x000000, 0);
    this.panelInnerFrame.setOrigin(0, 0);
    this.panelInnerFrame.setStrokeStyle(1, 0xe9f3ff, 0.1);
    this.panelInnerFrame.setVisible(false);
    this.headerPlate = scene.add.rectangle(0, 0, this.width, 10, 0x121d2d, 0.88);
    this.headerPlate.setOrigin(0, 0);
    this.headerPlate.setVisible(false);
    this.avatarGlow = scene.add.rectangle(0, 0, 76, 76, 0xb18b49, 0.14);
    this.avatarGlow.setOrigin(0, 0);
    this.avatarGlow.setVisible(false);
    this.avatarFrame = scene.add.rectangle(0, 0, 76, 76, 0x182737, 0.98);
    this.avatarFrame.setOrigin(0, 0);
    this.avatarFrame.setStrokeStyle(2, 0xb18b49, 1);
    this.avatarInner = scene.add.rectangle(0, 0, 68, 68, 0x223246, 0.96);
    this.avatarInner.setOrigin(0, 0);
    this.avatarInner.setStrokeStyle(1, 0x40607d, 0.8);
    this.avatarIcon = scene.add.text(0, 0, "", {
      fontFamily: EMOJI_FONT,
      fontSize: "30px",
      color: "#ffffff"
    }).setOrigin(0.5);
    this.avatarIcon.setVisible(false);
    this.headerDivider = scene.add.rectangle(0, 0, this.width - 24, 1, 0x40607d, 0.72);
    this.headerDivider.setOrigin(0, 0.5);
    this.headerDivider.setVisible(false);
    this.speechButtonBg = scene.add.rectangle(0, 0, 28, 28, 0x18324c, 0.96);
    this.speechButtonBg.setOrigin(0.5, 0.5);
    this.speechButtonBg.setStrokeStyle(1, 0x82d2ff, 0.85);
    this.speechButtonBg.setVisible(false);
    this.speechButtonText = scene.add.text(0, 0, "🔊", {
      fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
      fontSize: "12px",
      color: "#edf7ff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.speechButtonText.setVisible(false);
    setInteractiveSafe(this.speechButtonBg, { useHandCursor: true });
    registerInputSafe(this.speechButtonBg, "pointerdown", (_pointer, _localX, _localY, event) => {
      (event as { stopPropagation?: () => void } | undefined)?.stopPropagation?.();
      this.speakCurrentTooltipLabel();
    });
    this.avatarModel = null;
    this.subtitleText = scene.add.text(this.padX, this.padY, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#d4c37a",
      fontStyle: "bold",
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.headerMetaText = scene.add.text(this.width - this.padX, this.padY, "", {
      fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
      fontSize: "12px",
      color: "#f1d08a",
      fontStyle: "bold",
      align: "right"
    }).setOrigin(1, 0);
    this.headerMetaText.setVisible(false);
    this.titleText = scene.add.text(this.padX, this.padY, "", {
      fontFamily: UI_FONT,
      fontSize: "14px",
      color: "#fff1b8",
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.headerDescriptionText = scene.add.text(this.padX, this.padY, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#d9ecff",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.headerDescriptionText.setVisible(false);
    this.bodyText = scene.add.text(this.padX, 34, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#d9ecff",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.rightText = scene.add.text(this.padX, 34, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#cde8ff",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.divider = scene.add.rectangle(0, 0, 1, 12, 0x5a86aa, 0.85);
    this.divider.setOrigin(0, 0);
    this.divider.setVisible(false);
    this.rightText.setVisible(false);

    this.col3Text = scene.add.text(this.padX, 34, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#b8e0c8",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.col4Text = scene.add.text(this.padX, 34, "", {
      fontFamily: UI_FONT,
      fontSize: "12px",
      color: "#ffdcb1",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    this.divider2 = scene.add.rectangle(0, 0, 1, 12, 0x5a86aa, 0.85);
    this.divider2.setOrigin(0, 0);
    this.divider2.setVisible(false);
    this.divider3 = scene.add.rectangle(0, 0, 1, 12, 0x5a86aa, 0.85);
    this.divider3.setOrigin(0, 0);
    this.divider3.setVisible(false);
    this.col3Text.setVisible(false);
    this.col4Text.setVisible(false);
    this.badgeSlots = Array.from({ length: 8 }, () => {
      const bg = scene.add.rectangle(0, 0, 10, 10, 0x1b2637, 0.96);
      bg.setOrigin(0, 0);
      bg.setStrokeStyle(1, 0x2f455f, 0.85);
      bg.setVisible(false);
      const text = scene.add.text(0, 0, "", {
        fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
        fontSize: "10px",
        color: "#edf7ff",
        fontStyle: "bold"
      }).setOrigin(0.5);
      text.setVisible(false);
      return { bg, text };
    });
    this.statusSlots = Array.from({ length: 10 }, () => {
      const bg = scene.add.rectangle(0, 0, 10, 10, 0x223246, 0.94);
      bg.setOrigin(0, 0);
      bg.setStrokeStyle(1, 0x40607d, 0.78);
      bg.setVisible(false);
      const text = scene.add.text(0, 0, "", {
        fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
        fontSize: "10px",
        color: "#edf7ff",
        fontStyle: "bold"
      }).setOrigin(0.5);
      text.setVisible(false);
      return { bg, text };
    });
    this.meterSlots = Array.from({ length: 3 }, () => {
      const label = scene.add.text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: "10px",
        color: "#d7e9f6",
        fontStyle: "bold"
      }).setOrigin(0, 0.5);
      label.setVisible(false);
      const valueText = scene.add.text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: "10px",
        color: "#edf7ff"
      }).setOrigin(1, 0.5);
      valueText.setVisible(false);
      const bg = scene.add.rectangle(0, 0, 10, 8, 0x223246, 0.92);
      bg.setOrigin(0, 0.5);
      bg.setVisible(false);
      const fill = scene.add.rectangle(0, 0, 10, 8, 0x69df7b, 0.96);
      fill.setOrigin(0, 0.5);
      fill.setVisible(false);
      const shield = scene.add.rectangle(0, 0, 0, 2, 0x7bd3ff, 0.96);
      shield.setOrigin(0, 0.5);
      shield.setVisible(false);
      const pips = Array.from({ length: 12 }, () => {
        const pip = scene.add.rectangle(0, 0, 8, 8, 0x223246, 0.9);
        pip.setOrigin(0.5, 0.5);
        pip.setVisible(false);
        return pip;
      });
      return { label, valueText, bg, fill, shield, pips };
    });
    this.richLineTextPool = [];

    this.root.add([
      this.shadowBg,
      this.richShadowShape,
      this.richPanelGlowShape,
      this.richPanelShape,
      this.richPanelFrameShape,
      this.richPanelInnerFrameShape,
      this.richHeaderPlateShape,
      this.panelGlow,
      this.bg,
      this.panelFrame,
      this.panelInnerFrame,
      this.headerPlate,
      this.avatarGlow,
      this.avatarFrame,
      this.avatarInner,
      this.avatarIcon,
      this.speechButtonBg,
      this.speechButtonText,
      this.headerDivider,
      this.subtitleText,
      this.headerMetaText,
      this.titleText,
      this.headerDescriptionText,
      ...this.badgeSlots.flatMap(({ bg, text }) => [bg, text]),
      ...this.statusSlots.flatMap(({ bg, text }) => [bg, text]),
      ...this.meterSlots.flatMap(({ label, valueText, bg, fill, shield, pips }) => [label, valueText, bg, fill, shield, ...pips]),
      this.bodyText,
      this.divider,
      this.rightText,
      this.divider2,
      this.col3Text,
      this.divider3,
      this.col4Text
    ]);

    this._scenePointerDownHandler = (pointer) => this.handleScenePointerDown(pointer);
    this.scene.input?.on?.("pointerdown", this._scenePointerDownHandler);
    this._resizeHandler = () => this.refreshLayout();
    this.scene.scale?.on?.("resize", this._resizeHandler);
    this.scene.events?.once?.("shutdown", () => this.destroy());
    this.scene.events?.once?.("destroy", () => this.destroy());

    this.applyResponsiveLayout();
  }

  applyResponsiveLayout() {
    this.viewportProfile = getUiViewportProfile(this.scene);
    this.padX = scaleUiSize(this.scene, 12, "tooltipPadding");
    this.padY = scaleUiSize(this.scene, 10, "tooltipPadding");
    this.gapY = scaleUiSize(this.scene, 6, "tooltipPadding");
    this.margin = scaleUiSize(this.scene, 14, "spacing");
    const titleSize = scaleFontPx(this.scene, 17, "tooltipTitle");
    const subtitleSize = scaleFontPx(this.scene, 12, "tooltipBody");
    const metaSize = scaleFontPx(this.scene, 11, "caption");
    const bodySize = scaleFontPx(this.scene, 13, "tooltipBody");
    const badgeSize = scaleFontPx(this.scene, 11, "caption");
    const avatarSize = scaleFontPx(this.scene, 30, "title");

    applyTextStyle(this.titleText, titleSize, this.width - this.padX * 2);
    applyTextStyle(this.headerDescriptionText, bodySize, this.width - this.padX * 2);
    applyTextStyle(this.subtitleText, subtitleSize, this.width - this.padX * 2);
    applyTextStyle(this.headerMetaText, metaSize, this.width - this.padX * 2);
    applyTextStyle(this.bodyText, bodySize, this.width - this.padX * 2);
    applyTextStyle(this.rightText, bodySize, this.width - this.padX * 2);
    applyTextStyle(this.col3Text, bodySize, this.width - this.padX * 2);
    applyTextStyle(this.col4Text, bodySize, this.width - this.padX * 2);
    applyTextStyle(this.avatarIcon, avatarSize);
    applyTextStyle(this.speechButtonText, scaleFontPx(this.scene, 13, "caption"), undefined);
    this.badgeSlots.forEach(({ text }) => applyTextStyle(text, badgeSize, undefined));
    this.statusSlots.forEach(({ text }) => applyTextStyle(text, badgeSize, undefined));
    this.meterSlots.forEach(({ label, valueText }) => {
      applyTextStyle(label, badgeSize, undefined);
      applyTextStyle(valueText, badgeSize, undefined);
    });
  }

  refreshLayout() {
    if (!this.scene?.sys?.game?.canvas || this.root?.active === false) return;
    try {
      this.applyResponsiveLayout();
      if (this.pinnedState) {
        this.refreshPinnedTooltip();
        return;
      }
      if (!this.root.visible || !this.lastContent) return;
      if (this.lastRenderMode === "rich" && !this.canRenderRichTooltip()) return;
      if (this.lastRenderMode !== "rich" && !this.canRenderLegacyTooltip()) return;
      if (this.root.visible && this.lastContent) {
        this.showResolvedContent(this.scene.input?.activePointer, this.lastContent, {});
      }
    } catch {
      this.root.setVisible(false);
    }
  }

  destroy() {
    this.scene.input?.off?.("pointerdown", this._scenePointerDownHandler);
    this.scene.scale?.off?.("resize", this._resizeHandler);
    this.avatarModel?.destroy?.();
    this.avatarModel = null;
    this.richLineTextPool.forEach((entry) => entry.text?.destroy?.());
    this.richLineTextPool = [];
  }

  destroyAvatarModel() {
    this.avatarModel?.destroy?.();
    this.avatarModel = null;
  }

  syncAvatarModel(avatar: AvatarData = {}, avatarCenterX: number, avatarCenterY: number, avatarSize: number, hp: number | null = null, maxHp: number | null = null) {
    this.destroyAvatarModel();
    const rawVisual = avatar.visual;
    const nestedVisual = rawVisual && "visual" in rawVisual && typeof rawVisual.visual === "object" ? rawVisual.visual : null;
    const visualModule = (rawVisual && "createModel" in rawVisual && typeof rawVisual.createModel === "function" ? rawVisual : nestedVisual ?? rawVisual) as VisualModule | null;
    if (!visualModule) return false;
    const modelCount = Math.max(1, Math.min(3, Number(avatar?.star) || 1));
    const baseScale = Math.max(0.44, Math.min(0.76, avatarSize / 118));
    const hpValue = Number(hp);
    const maxHpValue = Number(maxHp);
    const hpRatio = maxHpValue > 0
      ? clampRatio(hpValue / maxHpValue)
      : 1;
    const placements = modelCount === 1
      ? [{ dx: 0, dy: Math.round(avatarSize * 0.08), scale: 1 }]
      : modelCount === 2
        ? [
            { dx: -Math.round(avatarSize * 0.22), dy: Math.round(avatarSize * 0.12), scale: 0.84 },
            { dx: Math.round(avatarSize * 0.22), dy: Math.round(avatarSize * 0.12), scale: 0.84 }
          ]
        : [
            { dx: 0, dy: -Math.round(avatarSize * 0.08), scale: 0.78 },
            { dx: -Math.round(avatarSize * 0.27), dy: Math.round(avatarSize * 0.2), scale: 0.62 },
            { dx: Math.round(avatarSize * 0.27), dy: Math.round(avatarSize * 0.2), scale: 0.62 }
          ];
    try {
      const modelRoot = this.scene.add.container(0, 0);
      attachUnitAvatarStarIdentity(this.scene, modelRoot, {
        baseId: null,
        star: avatar.star ?? 1,
        surface: "tooltip",
        appearance: null,
        classType: null,
        tribe: null,
        unitCore: null,
        visualModule: null,
        context: {
          ownerKind: avatar.ownerKind ?? "COMBAT",
          collectionProfile: avatar.collectionProfile ?? null,
          baseDepth: 8998
        }
      });
      let renderedCount = 0;
      placements.forEach((placement, index) => {
        const model = visualModule.createModel(this.scene, {
          x: avatarCenterX + placement.dx,
          y: avatarCenterY + placement.dy,
          scale: baseScale * placement.scale,
          baseId: avatar.baseId ?? null,
          star: avatar.star ?? 1,
          surface: avatar.surface ?? "tooltip",
          appearance: avatar.appearance ?? null,
          classType: avatar.classType ?? null,
          tribe: avatar.tribe ?? null,
          unitCore: avatar.unitCore ?? null,
          ownerKind: avatar.ownerKind ?? "COMBAT",
          collectionProfile: avatar.collectionProfile ?? null
        });
        const modelObject = asTooltipObject(model);
        if (!modelObject) return;
        const vitality = clampRatio(hpRatio * modelCount - index);
        const visible = vitality > 0.08;
        const alpha = visible ? Math.max(0.26, 0.36 + vitality * 0.64) : 0;
        modelObject.setVisible?.(visible);
        modelObject.setAlpha?.(alpha);
        modelObject.alpha = alpha;
        modelObject.setDepth?.(9001);
        modelRoot.add(model as Phaser.GameObjects.GameObject);
        renderedCount += 1;
      });
      if (!renderedCount) {
        modelRoot.destroy?.();
        return false;
      }
      this.root.add?.(modelRoot);
      setVisibleSafe(modelRoot, true);
      this.avatarModel = modelRoot;
      return true;
    } catch {
      this.destroyAvatarModel();
      return false;
    }
  }

  measureWrappedWidth(lines: unknown[], textObj: Phaser.GameObjects.Text) {
    if (!Array.isArray(lines) || !lines.length) return 0;
    const ctx = this.scene?.sys?.game?.canvas?.getContext?.("2d");
    if (!ctx) return 0;
    const style = textObj.style ?? {};
    const fontFamily = Array.isArray(style.fontFamily) ? style.fontFamily.join(",") : style.fontFamily ?? "Consolas";
    const fontSize = typeof style.fontSize === "number" ? `${style.fontSize}px` : style.fontSize ?? "12px";
    const fontStyle = style.fontStyle ? `${style.fontStyle} ` : "";
    ctx.save();
    ctx.font = `${fontStyle}${fontSize} ${fontFamily}`;
    let max = 0;
    lines.forEach((line) => {
      const w = ctx.measureText(String(line ?? "")).width;
      if (w > max) max = w;
    });
    ctx.restore();
    return max;
  }

  resolveTriggerMode(mode: string = "auto") {
    if (mode === "hover" || mode === "pin") return mode;
    return shouldUsePinnedTooltip(this.scene) ? "pin" : "hover";
  }

  resolveAnchorPointer(target: unknown) {
    const bounds = toBounds(target);
    if (bounds) {
      return {
        x: bounds.centerX,
        y: bounds.centerY
      };
    }
    return this.scene.input?.activePointer ?? { x: this.scene.scale.width * 0.5, y: this.scene.scale.height * 0.5 };
  }

  setRichNodesVisible(visible: boolean) {
    this.setRichChromeVisible(visible);
    setVisibleSafe(this.avatarGlow, visible);
    setVisibleSafe(this.avatarFrame, visible);
    setVisibleSafe(this.avatarInner, visible);
    setVisibleSafe(this.avatarIcon, visible);
    setVisibleSafe(this.speechButtonBg, visible);
    setVisibleSafe(this.speechButtonText, visible);
    setVisibleSafe(this.headerDivider, visible);
    setVisibleSafe(this.headerDescriptionText, visible);
    setVisibleSafe(this.subtitleText, visible);
    setVisibleSafe(this.headerMetaText, visible);
    this.badgeSlots.forEach(({ bg, text }) => {
      setVisibleSafe(bg, visible);
      setVisibleSafe(text, visible);
    });
    this.statusSlots.forEach(({ bg, text }) => {
      setVisibleSafe(bg, visible);
      setVisibleSafe(text, visible);
    });
    this.meterSlots.forEach(({ label, valueText, bg, fill, shield, pips }) => {
      setVisibleSafe(label, visible);
      setVisibleSafe(valueText, visible);
      setVisibleSafe(bg, visible);
      setVisibleSafe(fill, visible);
      setVisibleSafe(shield, visible);
      pips.forEach((pip) => setVisibleSafe(pip, visible));
    });
    if (this.avatarSprite) {
      setVisibleSafe(this.avatarSprite, visible);
    }
    if (this.avatarModel) {
      setVisibleSafe(this.avatarModel, visible);
    }
  }

  resetRichTransientNodes() {
    this.resetRichLineTextPool();
    setVisibleSafe(this.headerDivider, false);
    setVisibleSafe(this.avatarIcon, false);
    setVisibleSafe(this.speechButtonBg, false);
    setVisibleSafe(this.speechButtonText, false);
    setVisibleSafe(this.headerDescriptionText, false);
    if (this.avatarSprite) {
      setVisibleSafe(this.avatarSprite, false);
    }
    if (this.avatarModel) {
      setVisibleSafe(this.avatarModel, false);
    }
    this.badgeSlots.forEach(({ bg, text }) => {
      setVisibleSafe(bg, false);
      setVisibleSafe(text, false);
    });
    this.statusSlots.forEach(({ bg, text }) => {
      setVisibleSafe(bg, false);
      setVisibleSafe(text, false);
    });
    this.meterSlots.forEach(({ label, valueText, bg, fill, shield, pips }) => {
      setVisibleSafe(label, false);
      setVisibleSafe(valueText, false);
      setVisibleSafe(bg, false);
      setVisibleSafe(fill, false);
      setVisibleSafe(shield, false);
      setSizeSafe(bg, 0.0001, 0.0001);
      setSizeSafe(fill, 0.0001, 0.0001);
      setSizeSafe(shield, 0.0001, 0.0001);
      setPositionSafe(bg, 0, 0);
      setPositionSafe(fill, 0, 0);
      setPositionSafe(shield, 0, 0);
      pips.forEach((pip) => {
        setVisibleSafe(pip, false);
        setPositionSafe(pip, 0, 0);
      });
    });
    this.richHeaderPad = 0;
    this.richHeaderHeight = 0;
    this.currentSpeechLabel = "";
    this.currentSpeechLang = resolveBrowserSpeechLang(getLocale());
  }

  syncLegacyChromeLayout() {
    setSizeSafe(this.bg, this.width, this.height);
    setPositionSafe(this.bg, 0, 0);
    setSizeSafe(this.panelFrame, this.width, this.height);
    setPositionSafe(this.panelFrame, 0, 0);
    setSizeSafe(this.panelInnerFrame, this.width - 4, this.height - 4);
    setPositionSafe(this.panelInnerFrame, 2, 2);
    setSizeSafe(this.panelGlow, this.width + 2, this.height + 2);
    setPositionSafe(this.panelGlow, -1, -1);
    setSizeSafe(this.shadowBg, this.width, this.height);
    setPositionSafe(this.shadowBg, 3, 3);
    const headerHeight = Math.max(10, scaleUiSize(this.scene, 12, "control"));
    setSizeSafe(this.headerPlate, this.width, headerHeight);
    setPositionSafe(this.headerPlate, 0, 0);
  }

  setLegacyChromeVisible(visible: boolean) {
    setVisibleSafe(this.shadowBg, visible);
    setVisibleSafe(this.panelGlow, visible);
    setVisibleSafe(this.bg, visible);
    setVisibleSafe(this.panelFrame, visible);
    setVisibleSafe(this.panelInnerFrame, visible);
    setVisibleSafe(this.headerPlate, visible);
  }

  setRichChromeVisible(visible: boolean) {
    setVisibleSafe(this.richShadowShape, visible);
    setVisibleSafe(this.richPanelGlowShape, visible);
    setVisibleSafe(this.richPanelShape, visible);
    setVisibleSafe(this.richPanelFrameShape, visible);
    setVisibleSafe(this.richPanelInnerFrameShape, visible);
    setVisibleSafe(this.richHeaderPlateShape, visible);
  }

  redrawRichPanelChrome(theme: TooltipTheme, width: number, height: number, pad: number, headerHeight: number) {
    const outerCut = Math.max(scaleUiSize(this.scene, 12, "spacing"), Math.round(Math.min(width, height) * 0.06));
    const glowCut = outerCut + scaleUiSize(this.scene, 2, "spacing");
    const innerInset = 3;
    const innerCut = Math.max(4, outerCut - innerInset);
    const headerCut = Math.max(8, outerCut - scaleUiSize(this.scene, 4, "spacing"));
    drawChamferedBox(this.richShadowShape, 4, 4, width, height, outerCut, {
      fillColor: 0x000000,
      fillAlpha: 0.34
    });
    drawChamferedBox(this.richPanelGlowShape, 2, 2, width, height, glowCut, {
      strokeColor: theme.panelStroke ?? 0xb18b49,
      strokeAlpha: 0.2,
      strokeWidth: 6
    });
    drawChamferedBox(this.richPanelShape, 0, 0, width, height, outerCut, {
      fillColor: theme.bodyFill ?? theme.panelFill ?? 0x0f1624,
      fillAlpha: 0.97
    });
    drawChamferedBox(this.richPanelFrameShape, 0, 0, width, height, outerCut, {
      strokeColor: theme.panelStroke ?? 0xb18b49,
      strokeAlpha: 0.95,
      strokeWidth: 2
    });
    drawChamferedBox(this.richPanelInnerFrameShape, innerInset, innerInset, Math.max(8, width - innerInset * 2), Math.max(8, height - innerInset * 2), innerCut, {
      strokeColor: 0xe9f3ff,
      strokeAlpha: 0.12,
      strokeWidth: 1
    });
    drawChamferedBox(this.richHeaderPlateShape, pad, pad, Math.max(10, width - pad * 2), headerHeight, headerCut, {
      fillColor: theme.headerFill ?? 0x121d2d,
      fillAlpha: 0.9,
      strokeColor: theme.chipStroke ?? 0x40607d,
      strokeAlpha: 0.55,
      strokeWidth: 1
    });
  }

  setLegacyNodesVisible(visible: boolean) {
    setVisibleSafe(this.rightText, visible);
    setVisibleSafe(this.divider, visible);
    setVisibleSafe(this.col3Text, visible);
    setVisibleSafe(this.divider2, visible);
    setVisibleSafe(this.col4Text, visible);
    setVisibleSafe(this.divider3, visible);
  }

  speakCurrentTooltipLabel() {
    return speakWithBrowserVoice(this.currentSpeechLabel, {
      lang: this.currentSpeechLang
    });
  }

  layoutSpeechButton({
    avatarLeft,
    avatarTop,
    avatarSize,
    compact,
    theme,
    label,
    lang
  }: SpeechLayoutOptions) {
    const speechLabel = String(label ?? "").trim();
    const speechLang = String(lang ?? "").trim() || resolveBrowserSpeechLang(getLocale());
    const canSpeak = Boolean(speechLabel) && canUseBrowserSpeechSynthesis();
    this.currentSpeechLabel = speechLabel;
    this.currentSpeechLang = speechLang;
    setVisibleSafe(this.speechButtonBg, canSpeak);
    setVisibleSafe(this.speechButtonText, canSpeak);
    if (!canSpeak) return false;

    const buttonSize = Math.max(compact ? 28 : 30, Math.min(36, Math.round(avatarSize * 0.3)));
    const buttonCenterX = avatarLeft + avatarSize - Math.round(buttonSize * 0.45);
    const buttonCenterY = avatarTop + avatarSize - Math.round(buttonSize * 0.45);
    setSizeSafe(this.speechButtonBg, buttonSize, buttonSize);
    setPositionSafe(this.speechButtonBg, buttonCenterX, buttonCenterY);
    setPositionSafe(this.speechButtonText, buttonCenterX, buttonCenterY + 1);
    this.speechButtonBg.setFillStyle(theme.chipFill ?? 0x1f2e42, 0.96);
    this.speechButtonBg.setStrokeStyle(1, theme.avatarStroke ?? 0xb18b49, 0.9);
    setColorSafe(this.speechButtonText, theme.badgeText ?? "#edf7ff");
    this.speechButtonText.setFontStyle?.("bold");
    return true;
  }

  measureLineWidth(textObj: Phaser.GameObjects.Text, value: unknown) {
    return this.measureWrappedWidth([String(value ?? "")], textObj);
  }

  computeChipWidth(textObj: Phaser.GameObjects.Text, text: unknown, rowHeight: number, {
    minWidth = 0,
    basePadX = 0,
    extraEmojiPad = 0
  }: ChipWidthOptions = {}) {
    const measuredWidth = this.measureLineWidth(textObj, text);
    const contentWidth = estimateEmojiAwareTextWidth(text, textObj, measuredWidth);
    const emojiBonus = /\p{Extended_Pictographic}/u.test(String(text ?? "")) ? extraEmojiPad : 0;
    return Math.max(minWidth, Math.ceil(contentWidth + basePadX * 2 + emojiBonus));
  }

  acquireRichLineText() {
    const reusable = this.richLineTextPool.find((entry) => !entry.inUse && canMutateTextObject(entry.text));
    if (reusable) {
      reusable.inUse = true;
      return reusable.text;
    }
    const text = this.scene.add.text(0, 0, "", {
      fontFamily: `${EMOJI_FONT}, ${UI_FONT}`,
      fontSize: "12px",
      color: "#d9ecff",
      lineSpacing: 3,
      wordWrap: { width: this.width - 24, useAdvancedWrap: true }
    });
    text.setVisible(false);
    text.setDepth(9001);
    this.root.add(text);
    this.richLineTextPool.push({
      text,
      inUse: true
    });
    return text;
  }

  resetRichLineTextPool() {
    this.richLineTextPool.forEach((entry) => {
      entry.inUse = false;
      setVisibleSafe(entry.text, false);
      setTextSafe(entry.text, "");
      setPositionSafe(entry.text, 0, 0);
    });
  }

  layoutRichTextLine(rawLine: unknown, x: number, y: number, width: number, {
    fontSize = 12,
    color = "#ffffff",
    lineSpacing = 0
  }: TextLineOptions = {}) {
    const safeLine = String(rawLine ?? "").trimEnd();
    if (!safeLine.trim()) return 0;
    const hasMarkup = hasTooltipHighlightMarkup(safeLine);
    if (!hasMarkup) {
      const textObj = this.acquireRichLineText();
      applyTextStyle(textObj, fontSize, width);
      if (typeof textObj.setLineSpacing === "function") {
        textObj.setLineSpacing(lineSpacing);
      }
      setColorSafe(textObj, color);
      textObj.setFontStyle?.("");
      setTextSafe(textObj, safeLine);
      setPositionSafe(textObj, x, y);
      setVisibleSafe(textObj, true);
      return textObj.height || fontSize;
    }

    const segments = parseTooltipHighlightSegments(safeLine);
    let cursorX = x;
    let maxHeight = fontSize;
    segments.forEach((segment) => {
      const textObj = this.acquireRichLineText();
      applyTextStyle(textObj, fontSize, undefined);
      if (typeof textObj.setWordWrapWidth === "function") {
        try {
          textObj.setWordWrapWidth(Math.max(4096, this.width * 2), false);
        } catch {
          void 0;
        }
      }
      if (typeof textObj.setLineSpacing === "function") {
        textObj.setLineSpacing(0);
      }
      setColorSafe(textObj, segment.active ? ACTIVE_TOOLTIP_TEXT_COLOR : color);
      textObj.setFontStyle?.(segment.active ? "bold" : "");
      setTextSafe(textObj, segment.text);
      setPositionSafe(textObj, cursorX, y);
      setVisibleSafe(textObj, true);
      cursorX += textObj.width || 0;
      const numericFontSize = Number(fontSize) || 12;
      const measuredHeight = Number.isFinite(textObj.height)
        ? Math.min(textObj.height, Math.max(numericFontSize + 6, Math.round(numericFontSize * 1.35)))
        : numericFontSize;
      maxHeight = Math.max(Number(maxHeight) || 0, measuredHeight);
    });
    return maxHeight;
  }

  layoutSectionColumnBlocks(blocks: SectionBlock[], x: number, y: number, width: number, {
    fontSize = 12,
    color = "#ffffff",
    lineSpacing = 0,
    blockGap = 0
  }: SectionLayoutOptions = {}) {
    let cursorY = y;
    (blocks ?? []).forEach((block, blockIndex) => {
      if (block?.title) {
        const titleHeight = this.layoutRichTextLine(`🔹 ${block.title}`, x, cursorY, width, {
          fontSize,
          color,
          lineSpacing
        });
        cursorY += Number(titleHeight) + lineSpacing;
      }
      (block?.lines ?? []).forEach((line) => {
        const lineHeight = this.layoutRichTextLine(line, x, cursorY, width, {
          fontSize,
          color,
          lineSpacing
        });
        cursorY += Number(lineHeight) + lineSpacing;
      });
      if (blockIndex < (blocks?.length ?? 0) - 1) {
        cursorY += blockGap;
      }
    });
    return Math.max(0, cursorY - y);
  }

  canRenderLegacyTooltip() {
    return [this.titleText, this.bodyText, this.rightText, this.col3Text, this.col4Text].every((obj) => canMutateTextObject(obj));
  }

  canRenderRichTooltip() {
    return [
      this.titleText,
      this.headerDescriptionText,
      this.subtitleText,
      this.headerMetaText,
      this.bodyText,
      this.rightText,
      this.col3Text,
      this.col4Text,
      this.avatarIcon,
      ...this.badgeSlots.map(({ text }) => text),
      ...this.statusSlots.map(({ text }) => text),
      ...this.meterSlots.flatMap(({ label, valueText }) => [label, valueText])
    ].every((obj) => canMutateTextObject(obj));
  }

  layoutBadgeChips(items: ChipItem[], startX: number, startY: number, maxWidth: number, rowHeight: number, gap: number, theme: TooltipTheme) {
    let cursorX = startX;
    let cursorY = startY;
    let bottomY = startY;
    const availableRight = startX + maxWidth;
    const slots = this.badgeSlots;

    slots.forEach((slot, index) => {
      const item = items[index];
      if (!item) {
        setVisibleSafe(slot.bg, false);
        setVisibleSafe(slot.text, false);
        return;
      }
      const palette = (RICH_BADGE_TONES as Record<string, { fill: number; text: string }>)[item.tone ?? "default"] ?? RICH_BADGE_TONES.default;
      const text = String(item.text ?? "").trim();
      const chipW = this.computeChipWidth(slot.text, text, rowHeight, {
        minWidth: Math.max(scaleUiSize(this.scene, 104, "control"), Math.ceil(rowHeight * 2.9)),
        basePadX: Math.max(scaleUiSize(this.scene, 18, "spacing"), Math.ceil(rowHeight * 0.58)),
        extraEmojiPad: scaleUiSize(this.scene, 6, "spacing")
      });
      if (cursorX > startX && cursorX + chipW > availableRight) {
        cursorX = startX;
        cursorY += rowHeight + gap;
      }
      setVisibleSafe(slot.bg, true);
      setVisibleSafe(slot.text, true);
      slot.bg.setFillStyle(item.fill ?? palette.fill ?? theme.chipFill, 0.95);
      slot.bg.setStrokeStyle(1, item.fill ?? theme.chipStroke ?? 0x2f455f, 0.82);
      setSizeSafe(slot.bg, chipW, rowHeight);
      setPositionSafe(slot.bg, cursorX, cursorY);
      setTextSafe(slot.text, text);
      setColorSafe(slot.text, item.textColor ?? palette.text ?? theme.badgeText ?? "#edf7ff");
      setPositionSafe(slot.text, cursorX + chipW / 2, cursorY + rowHeight / 2);
      cursorX += chipW + gap;
      bottomY = Math.max(bottomY, cursorY + rowHeight);
    });

    return bottomY;
  }

  layoutStatusChips(items: ChipItem[], startX: number, startY: number, maxWidth: number, rowHeight: number, gap: number, theme: TooltipTheme) {
    let cursorX = startX;
    let cursorY = startY;
    let bottomY = startY;
    const availableRight = startX + maxWidth;

    this.statusSlots.forEach((slot, index) => {
      const item = items[index];
      if (!item) {
        setVisibleSafe(slot.bg, false);
        setVisibleSafe(slot.text, false);
        return;
      }
      const displayText = [
        [item.icon, item.label].filter(Boolean).join(" ").trim(),
        item.badgeText ? `[${item.badgeText}]` : ""
      ].filter(Boolean).join(" ").trim();
      const chipW = this.computeChipWidth(slot.text, displayText, rowHeight, {
        minWidth: Math.max(scaleUiSize(this.scene, 52, "control"), Math.ceil(rowHeight * 1.85)),
        basePadX: Math.max(scaleUiSize(this.scene, 10, "spacing"), Math.ceil(rowHeight * 0.38)),
        extraEmojiPad: scaleUiSize(this.scene, 4, "spacing")
      });
      if (cursorX > startX && cursorX + chipW > availableRight) {
        cursorX = startX;
        cursorY += rowHeight + gap;
      }
      setVisibleSafe(slot.bg, true);
      setVisibleSafe(slot.text, true);
      slot.bg.setFillStyle(item.fill ?? theme.chipFill ?? 0x223246, 0.94);
      slot.bg.setStrokeStyle(1, item.fill ?? theme.chipStroke ?? 0x40607d, 0.76);
      setSizeSafe(slot.bg, chipW, rowHeight);
      setPositionSafe(slot.bg, cursorX, cursorY);
      setTextSafe(slot.text, displayText);
      setColorSafe(slot.text, item.textColor ?? theme.badgeText ?? "#edf7ff");
      setPositionSafe(slot.text, cursorX + chipW / 2, cursorY + rowHeight / 2);
      cursorX += chipW + gap;
      bottomY = Math.max(bottomY, cursorY + rowHeight);
    });

    return bottomY;
  }

  layoutMeterRows(rows: MeterItem[], startX: number, startY: number, maxWidth: number, rowHeight: number, gap: number) {
    let cursorY = startY;
    let bottomY = startY;
    this.meterSlots.forEach((slot, index) => {
      const row = rows[index];
      if (!row) {
        setVisibleSafe(slot.label, false);
        setVisibleSafe(slot.valueText, false);
        setVisibleSafe(slot.bg, false);
        setVisibleSafe(slot.fill, false);
        setVisibleSafe(slot.shield, false);
        slot.pips.forEach((pip) => setVisibleSafe(pip, false));
        return;
      }

      const labelText = row.label || "";
      const valueText = `${Math.round(row.value)}/${Math.round(row.max)}`;
      const rightInset = scaleUiSize(this.scene, 14, "spacing");
      const labelWidth = Math.min(Math.max(50, this.measureLineWidth(slot.label, labelText) + 8), Math.floor(maxWidth * 0.32));
      const valueWidth = Math.min(Math.max(40, this.measureLineWidth(slot.valueText, valueText) + 8), Math.floor(maxWidth * 0.22));
      const meterX = startX + labelWidth + scaleUiSize(this.scene, 8, "spacing");
      const meterWidth = Math.max(88, maxWidth - labelWidth - valueWidth - scaleUiSize(this.scene, 20, "spacing") - rightInset);
      const meterCenterY = cursorY + rowHeight * 0.5;

      setVisibleSafe(slot.label, true);
      setVisibleSafe(slot.valueText, true);
      setTextSafe(slot.label, labelText);
      setTextSafe(slot.valueText, valueText);
      setColorSafe(slot.label, row.labelColor ?? "#d7e9f6");
      setColorSafe(slot.valueText, "#edf7ff");
      setPositionSafe(slot.label, startX, meterCenterY);
      setPositionSafe(slot.valueText, startX + maxWidth - rightInset, meterCenterY);

      if (row.kind === "pips") {
        setVisibleSafe(slot.bg, false);
        setVisibleSafe(slot.fill, false);
        setVisibleSafe(slot.shield, false);
        const pipCount = Math.max(1, Math.min(slot.pips.length, Math.round(row.max)));
        const rageDiamonds = row.key === "rage";
        const desiredGap = scaleUiSize(this.scene, rageDiamonds ? 14 : 4, "spacing");
        const minGap = scaleUiSize(this.scene, rageDiamonds ? 7 : 2, "spacing");
        let pipSize = rageDiamonds
          ? Math.max(10, Math.min(scaleUiSize(this.scene, 14, "control"), rowHeight - 1))
          : Math.max(6, rowHeight - 6);
        let pipGap = desiredGap;
        const maxTotalWidth = Math.max(32, meterWidth);
        let totalPipWidth = pipCount * pipSize + Math.max(0, pipCount - 1) * pipGap;
        if (totalPipWidth > maxTotalWidth) {
          pipGap = Math.max(minGap, Math.floor((maxTotalWidth - pipCount * pipSize) / Math.max(1, pipCount - 1)));
          totalPipWidth = pipCount * pipSize + Math.max(0, pipCount - 1) * pipGap;
        }
        if (totalPipWidth > maxTotalWidth) {
          pipGap = minGap;
          pipSize = Math.max(rageDiamonds ? 6 : 5, Math.floor((maxTotalWidth - Math.max(0, pipCount - 1) * pipGap) / pipCount));
          totalPipWidth = pipCount * pipSize + Math.max(0, pipCount - 1) * pipGap;
        }
        const pipStartX = meterX + Math.max(0, Math.floor((maxTotalWidth - totalPipWidth) * 0.5)) + pipSize * 0.5;
        for (let pipIndex = 0; pipIndex < slot.pips.length; pipIndex += 1) {
          const pip = slot.pips[pipIndex];
          if (pipIndex >= pipCount) {
            setVisibleSafe(pip, false);
            continue;
          }
          const filled = pipIndex < Math.round(Math.max(0, Math.min(row.max, row.value)));
          setVisibleSafe(pip, true);
          pip.setFillStyle(filled ? row.color : row.emptyColor, filled ? 0.95 : 0.82);
          pip.setStrokeStyle?.(
            1,
            filled
              ? (row.shieldColor ?? DEFAULT_METER_PALETTES.default.shieldColor)
              : 0x4d3a24,
            filled ? 0.7 : 0.35
          );
          setSizeSafe(pip, pipSize, pipSize);
          pip.setAngle?.(rageDiamonds ? 45 : 0);
          setPositionSafe(pip, pipStartX + pipIndex * (pipSize + pipGap), meterCenterY);
        }
      } else {
        slot.pips.forEach((pip) => setVisibleSafe(pip, false));
        const barWidth = Math.max(100, meterWidth);
        const fillWidth = Math.max(0, Math.round(barWidth * clampRatio(row.value / row.max)));
        const shieldRatio = row.max > 0 ? clampRatio(row.shield / row.max) : 0;
        const shieldWidth = Math.max(0, Math.round(barWidth * shieldRatio));
        const barHeight = Math.max(10, rowHeight - 6);
        setVisibleSafe(slot.bg, true);
        setVisibleSafe(slot.fill, true);
        slot.bg.setFillStyle(row.emptyColor, 0.95);
        slot.fill.setFillStyle(row.color, 0.98);
        slot.bg.setStrokeStyle?.(1, row.emptyColor, 0.18);
        setSizeSafe(slot.bg, barWidth, barHeight);
        setSizeSafe(slot.fill, Math.max(0.0001, fillWidth), barHeight);
        setPositionSafe(slot.bg, meterX, meterCenterY);
        setPositionSafe(slot.fill, meterX, meterCenterY);
        if (shieldWidth > 0) {
          setVisibleSafe(slot.shield, true);
          slot.shield.setFillStyle(row.shieldColor ?? DEFAULT_METER_PALETTES.default.shieldColor, 0.96);
          setSizeSafe(slot.shield, shieldWidth, 3);
          setPositionSafe(slot.shield, meterX, meterCenterY - Math.max(2, rowHeight * 0.25));
        } else {
          setVisibleSafe(slot.shield, false);
        }
      }

      cursorY += rowHeight + gap;
      bottomY = cursorY - gap;
    });
    return bottomY;
  }

  normalizeRichTooltipContent(content: RichContent = {}, unit: RichContent | null = null): RichContent {
    const avatarSource: AvatarData = content.avatar ?? {};
    const theme: TooltipTheme = {
      ...defaultRichTheme(this.scene, String(avatarSource.side ?? content.side ?? unit?.side ?? "LEFT"), String(avatarSource.classType ?? content.classType ?? unit?.classType ?? "") || null),
      ...(content.theme ?? {})
    };

    const avatarPreviewIcon = avatarSource.previewIcon ?? content.previewIcon ?? avatarSource.icon ?? content.icon ?? "🐾";
    const avatar = {
      icon: avatarPreviewIcon,
      previewIcon: avatarPreviewIcon,
      portraitKey: avatarSource.portraitKey ?? content.portraitKey ?? null,
      visual: avatarSource.visual ?? content.visual ?? (unit?.visual as { visual?: unknown } | undefined)?.visual ?? unit?.visual ?? null,
      star: avatarSource.star ?? content.star ?? unit?.star ?? 1,
      hp: avatarSource.hp ?? content.hp ?? unit?.hp ?? null,
      maxHp: avatarSource.maxHp ?? content.maxHp ?? unit?.maxHp ?? null,
      label: avatarSource.label ?? content.title ?? "",
      side: avatarSource.side ?? content.side ?? unit?.side ?? "LEFT",
      classType: avatarSource.classType ?? content.classType ?? unit?.classType ?? null
    };

    const badgeRows = Array.isArray(content.badgeRows)
      ? content.badgeRows.map((row) => normalizeBadgeRow(row, theme)).filter(Boolean)
      : [];
    const statusIcons = Array.isArray(content.statusIcons)
      ? content.statusIcons.map((row) => normalizeStatusIconRow(row, theme)).filter(Boolean)
      : [];
    const statRows = Array.isArray(content.statRows)
      ? content.statRows.map((row) => {
          if (!row) return null;
          if (typeof row === "string") {
            const text = row.trim();
            return text ? { text, tone: "stat" } : null;
          }
          if (typeof row !== "object") return null;
          const label = String(row.label ?? row.name ?? row.title ?? "").trim();
          const value = String(row.value ?? row.text ?? "").trim();
          const text = String(row.text ?? "").trim() || [label, value].filter(Boolean).join(": ");
          return text ? { text, tone: row.tone ?? "stat", fill: row.fill, textColor: row.textColor } : null;
        }).filter(Boolean)
      : [];
    const meterRows = Array.isArray(content.meterRows)
      ? content.meterRows.map((row) => normalizeMeterRow(row)).filter(Boolean)
      : [];
    const explicitSectionColumns = normalizeSectionColumns(content.sectionColumns);

    const sectionBlocks: SectionBlock[] = [];
    if (statRows.length) {
      sectionBlocks.push({
        title: "Chỉ số",
        lines: statRows.filter(Boolean).map((row) => String(row?.text ?? "").trim()).filter(Boolean)
      });
    }
    if (Array.isArray(content.sectionBlocks) && content.sectionBlocks.length) {
      content.sectionBlocks.map((block) => normalizeSectionBlock(block)).filter((block): block is SectionBlock => Boolean(block)).forEach((block) => sectionBlocks.push(block));
    } else {
      const fallbackBlocks = [];
      if (content.body) fallbackBlocks.push({ title: content.bodyTitle ?? "", lines: normalizeTextLines(content.body) });
      if (content.rightBody) fallbackBlocks.push({ title: content.rightBodyTitle ?? "", lines: normalizeTextLines(content.rightBody) });
      if (content.col3Body) fallbackBlocks.push({ title: content.col3BodyTitle ?? "", lines: normalizeTextLines(content.col3Body) });
      fallbackBlocks.filter((block) => block.lines.length).forEach((block) => sectionBlocks.push({ title: String(block.title), lines: block.lines }));
    }

    const sectionColumns = explicitSectionColumns.length
      ? explicitSectionColumns
      : sectionBlocks.length
        ? [sectionBlocks]
        : [];

    return {
      ...content,
      avatar,
      theme,
      headerMeta: String(content.headerMeta ?? content.levelText ?? "").trim(),
      headerDescription: String(content.headerDescription ?? "").trim(),
      speechLabel: String(content.speechLabel ?? "").trim(),
      speechLang: String(content.speechLang ?? "").trim() || resolveBrowserSpeechLang(getLocale()),
      badgeRows,
      statusIcons,
      statRows,
      meterRows,
      sectionColumns,
      sectionBlocks,
      subtitle: String(content.subtitle ?? "").trim()
    } as unknown as RichContent;
  }

  resolveDisplayedSectionColumns(rich: TooltipRecord, maxColumns: number) {
    const columns = Array.isArray(rich?.sectionColumns) && rich.sectionColumns.length
      ? rich.sectionColumns.map((column) => Array.isArray(column) ? [...column] : []).filter((column) => column.length)
      : (Array.isArray(rich?.sectionBlocks) && rich.sectionBlocks.length ? [[...rich.sectionBlocks]] : []);
    if (!columns.length) return [];
    const safeMaxColumns = Math.max(1, Math.min(4, Math.floor(maxColumns || 1)));
    if (columns.length <= safeMaxColumns) return columns;
    const visibleColumns = columns.slice(0, safeMaxColumns - 1);
    const mergedLastColumn = columns.slice(safeMaxColumns - 1).flat();
    visibleColumns.push(mergedLastColumn);
    return visibleColumns;
  }

  buildLegacyFallbackFromRichContent(content: RichContent = {}) {
    const rich = this.normalizeRichTooltipContent(content);
    const displayedColumns = this.resolveDisplayedSectionColumns(rich, 4);
    const bodies = displayedColumns.map((columnBlocks) => composeSectionText(columnBlocks)).filter(Boolean);
    return {
      title: String(rich.title ?? "").trim(),
      body: bodies[0] ?? "",
      rightBody: bodies[1] ?? "",
      col3Body: bodies.slice(2).filter(Boolean).join("\n\n")
    };
  }

  showRich(pointer: Phaser.Input.Pointer | { x: number; y: number } | null | undefined, content: RichContent = {}, unit: RichContent | null = null) {
    const rich = this.normalizeRichTooltipContent(content, unit);
    try {
      this.applyResponsiveLayout();
      if (!this.canRenderRichTooltip()) return false;
      this.resetRichLineTextPool();
      this.lastContent = rich;
      this.lastRenderMode = "rich";
      this.setLegacyNodesVisible(false);
      this.setRichNodesVisible(true);
      this.setLegacyChromeVisible(false);
      this.setRichChromeVisible(true);

      const scaleTokens = getUiScaleTokens(this.scene);
      const compact = scaleTokens.profile !== "desktop";
      const expandedLayout = rich.layoutMode === "expanded";
      const requestedColumnCount = Array.isArray(rich.sectionColumns) ? rich.sectionColumns.length : 0;
      const wantsFourColumns = expandedLayout && requestedColumnCount > 3;
      const theme = rich.theme ?? defaultRichTheme(this.scene, String(rich.avatar?.side ?? "LEFT"), rich.avatar?.classType ?? null);
      const avatarSize = compact ? Math.max(92, getMinTouchTarget(this.scene) + 14) : 118;
      const pad = this.padX + scaleUiSize(this.scene, compact ? 4 : 8, "spacing");
      const headerInset = scaleUiSize(this.scene, compact ? 10 : 12, "spacing");
      const stackLayout = compact;
      const contentGapX = scaleUiSize(this.scene, compact ? 12 : 16, "spacing");
      const width = Math.floor(Math.min(
        compact ? (expandedLayout ? (wantsFourColumns ? 920 : 820) : 680) : (expandedLayout ? (wantsFourColumns ? 1320 : 1060) : 720),
        Math.max(
          compact ? 420 : (expandedLayout ? (wantsFourColumns ? 1040 : 820) : 520),
          (this.scene.scale?.width ?? 1280) * (compact ? 0.94 : (expandedLayout ? 0.82 : 0.54))
        )
      ));
      this.width = width;
      const contentX = stackLayout ? pad + headerInset : pad + headerInset + avatarSize + contentGapX;
      const contentW = stackLayout
        ? Math.max(220, width - (pad + headerInset) * 2)
        : Math.max(220, width - contentX - pad - headerInset);
      const titleFont = scaleFontPx(this.scene, compact ? 21 : 24, "title");
      const subtitleFont = scaleFontPx(this.scene, compact ? 12 : 13, "caption");
      const metaFont = scaleFontPx(this.scene, compact ? 11 : 12, "caption");
      const bodyFont = scaleFontPx(this.scene, compact ? 12 : 13, "body");
      const avatarFont = `${Math.max(26, Math.round(avatarSize * 0.5))}px`;
      const chipHeight = Math.max(getMinTouchTarget(this.scene) - (compact ? 18 : 16), compact ? 28 : 32);
      const chipGap = scaleUiSize(this.scene, 6, "spacing");
      const meterRowHeight = Math.max(18, scaleUiSize(this.scene, compact ? 17 : 19, "control"));
      setVisibleSafe(this.avatarGlow, true);
      setPositionSafe(this.avatarGlow, pad + (stackLayout ? Math.floor((width - avatarSize) / 2) - 2 : -2), this.padY - 2);
      this.avatarGlow.setFillStyle(theme.avatarStroke ?? 0xb18b49, 0.14);
      this.avatarGlow.setStrokeStyle(1, theme.avatarStroke ?? 0xb18b49, 0.34);

      this.avatarFrame.setFillStyle(theme.avatarFill ?? 0x182737, 0.98);
      this.avatarFrame.setStrokeStyle(2, theme.avatarStroke ?? 0xb18b49, 1);
      this.avatarInner.setFillStyle(theme.avatarInner ?? 0x223246, 0.96);
      this.avatarInner.setStrokeStyle(1, theme.chipStroke ?? 0x40607d, 0.8);
      applyTextStyle(this.titleText, titleFont, contentW);
      applyTextStyle(this.headerDescriptionText, bodyFont, contentW);
      applyTextStyle(this.subtitleText, subtitleFont, contentW);
      applyTextStyle(this.headerMetaText, metaFont, Math.max(120, width - contentX - pad));
      applyTextStyle(this.bodyText, bodyFont, contentW);
      applyTextStyle(this.rightText, bodyFont, contentW);
      applyTextStyle(this.col3Text, bodyFont, contentW);
      applyTextStyle(this.col4Text, bodyFont, contentW);
      applyTextStyle(this.avatarIcon, avatarFont, avatarSize);
      this.badgeSlots.forEach(({ text }) => applyTextStyle(text, scaleFontPx(this.scene, compact ? 12 : 13, "caption")));
      this.statusSlots.forEach(({ text }) => applyTextStyle(text, scaleFontPx(this.scene, compact ? 11 : 12, "caption")));
      this.meterSlots.forEach(({ label, valueText }) => {
        applyTextStyle(label, scaleFontPx(this.scene, compact ? 11 : 12, "caption"));
        applyTextStyle(valueText, scaleFontPx(this.scene, compact ? 11 : 12, "caption"));
      });

      const title = String(rich.title ?? "").trim() || "Linh thú";
      const subtitle = expandedLayout ? "" : String(rich.subtitle ?? "").trim();
      const headerMeta = expandedLayout ? "" : String(rich.headerMeta ?? "").trim();
      const headerDescription = String(rich.headerDescription ?? "").trim();
      setTextSafe(this.titleText, title);
      setTextSafe(this.headerDescriptionText, headerDescription);
      setTextSafe(this.subtitleText, subtitle);
      setTextSafe(this.headerMetaText, headerMeta);
      setColorSafe(this.titleText, theme.titleColor ?? "#8ff58f");
      setColorSafe(this.headerDescriptionText, theme.bodyColor ?? "#e8f4ff");
      setColorSafe(this.subtitleText, theme.subtitleColor ?? "#d4c37a");
      setColorSafe(this.headerMetaText, "#f1d08a");
      setStyleSafe(this.titleText, {
        stroke: "#08111a",
        strokeThickness: compact ? 3 : 4,
        shadow: { offsetX: 0, offsetY: 1, blur: 2, color: "#000000", fill: true }
      });
      setStyleSafe(this.subtitleText, {
        stroke: "#08111a",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 1, blur: 1, color: "#000000", fill: true }
      });
      setStyleSafe(this.headerDescriptionText, {
        stroke: "#08111a",
        strokeThickness: 1,
        shadow: { offsetX: 0, offsetY: 1, blur: 1, color: "#000000", fill: true }
      });
      setStyleSafe(this.headerMetaText, {
        stroke: "#08111a",
        strokeThickness: 2,
        shadow: { offsetX: 0, offsetY: 1, blur: 1, color: "#000000", fill: true }
      });
      this.titleText.setFontStyle?.("bold");
      this.subtitleText.setFontStyle?.("bold");
      setVisibleSafe(this.subtitleText, Boolean(subtitle));
      setVisibleSafe(this.headerMetaText, Boolean(headerMeta));
      setVisibleSafe(this.headerDescriptionText, Boolean(headerDescription));
      setVisibleSafe(this.titleText, true);

      const avatarLeft = stackLayout ? Math.floor((width - avatarSize) / 2) : pad + headerInset;
      let avatarTop = pad + headerInset;
      
      // For summary mode with side-by-side layout, calculate finalAvatarTop first
      const summaryLayout = rich.layoutMode === "summary";
      let finalAvatarTop = avatarTop;
      if (summaryLayout && !stackLayout) {
        const minHeaderHeight = avatarSize + headerInset * 2;
        // Estimate header content height to determine avatar centering
        const estimatedTitleHeight = this.titleText.height || scaleUiSize(this.scene, 24, "control");
        const estimatedSubtitleHeight = subtitle ? (this.subtitleText.height || scaleUiSize(this.scene, 13, "control")) : 0;
        const estimatedContentHeight = estimatedTitleHeight + estimatedSubtitleHeight + scaleUiSize(this.scene, 20, "spacing");
        const estimatedHeaderHeight = Math.max(minHeaderHeight, estimatedContentHeight);
        finalAvatarTop = pad + Math.round((estimatedHeaderHeight - avatarSize) * 0.5);
        avatarTop = finalAvatarTop;
      }
      
      const titleY = stackLayout
        ? avatarTop + avatarSize + scaleUiSize(this.scene, 8, "spacing")
        : avatarTop + scaleUiSize(this.scene, 2, "spacing");
      setPositionSafe(this.titleText, contentX, titleY);
      let headerTextBottomY = titleY + this.titleText.height;
      let badgeEndY = headerTextBottomY;
      let meterEndY = headerTextBottomY;
      let statusEndY = headerTextBottomY;
      let descriptionEndY = headerTextBottomY;
      if (expandedLayout) {
        const badgeStartY = headerTextBottomY + scaleUiSize(this.scene, 4, "spacing");
        badgeEndY = this.layoutBadgeChips(
          rich.badgeRows ?? [],
          contentX,
          badgeStartY,
          contentW,
          chipHeight,
          chipGap,
          theme
        );
        const meterStartY = badgeEndY + scaleUiSize(this.scene, 5, "spacing");
        meterEndY = this.layoutMeterRows(
          rich.meterRows ?? [],
          contentX,
          meterStartY,
          contentW,
          meterRowHeight,
          scaleUiSize(this.scene, 4, "spacing")
        );
        const hasStatusChips = Array.isArray(rich.statusIcons) && rich.statusIcons.length > 0;
        const statusStartY = hasStatusChips
          ? meterEndY + scaleUiSize(this.scene, 4, "spacing")
          : meterEndY;
        statusEndY = this.layoutStatusChips(
          rich.statusIcons ?? [],
          contentX,
          statusStartY,
          contentW,
          chipHeight,
          chipGap,
          theme
        );
        if (headerDescription) {
          this.headerDescriptionText.setWordWrapWidth(contentW, true);
          setPositionSafe(
            this.headerDescriptionText,
            contentX,
            (hasStatusChips ? statusEndY : meterEndY) + scaleUiSize(this.scene, 6, "spacing")
          );
          descriptionEndY = this.headerDescriptionText.y + this.headerDescriptionText.height;
        } else {
          descriptionEndY = hasStatusChips ? statusEndY : meterEndY;
        }
      } else {
        const subtitleY = titleY + this.titleText.height + scaleUiSize(this.scene, 2, "spacing");
        const metaY = titleY + scaleUiSize(this.scene, 2, "spacing");
        setPositionSafe(this.subtitleText, contentX, subtitleY);
        setPositionSafe(this.headerMetaText, width - pad - headerInset, metaY);
        headerTextBottomY = subtitle
          ? subtitleY + this.subtitleText.height
          : titleY + this.titleText.height;
        const meterStartY = headerTextBottomY + scaleUiSize(this.scene, 2, "spacing");
        meterEndY = this.layoutMeterRows(
          rich.meterRows ?? [],
          contentX,
          meterStartY,
          contentW,
          meterRowHeight,
          scaleUiSize(this.scene, 4, "spacing")
        );
        const badgeStartY = meterEndY + scaleUiSize(this.scene, 5, "spacing");
        badgeEndY = this.layoutBadgeChips(
          rich.badgeRows ?? [],
          contentX,
          badgeStartY,
          contentW,
          chipHeight,
          chipGap,
          theme
        );
        const statusStartY = badgeEndY + scaleUiSize(this.scene, 4, "spacing");
        statusEndY = this.layoutStatusChips(
          rich.statusIcons ?? [],
          contentX,
          statusStartY,
          contentW,
          chipHeight,
          chipGap,
          theme
        );
        if (headerDescription) {
          this.headerDescriptionText.setWordWrapWidth(contentW, true);
          setPositionSafe(this.headerDescriptionText, contentX, statusEndY + scaleUiSize(this.scene, 6, "spacing"));
          descriptionEndY = this.headerDescriptionText.y + this.headerDescriptionText.height;
        } else {
          descriptionEndY = statusEndY;
        }
      }

      const bodyLines = composeSectionText(rich.sectionBlocks);
      const infoBottom = Math.max(
        meterEndY,
        badgeEndY,
        statusEndY,
        descriptionEndY,
        stackLayout ? avatarTop + avatarSize : headerTextBottomY
      );
      const finalAvatarBottom = avatarTop + avatarSize;
      const headerContentBottom = summaryLayout
        ? Math.max(infoBottom, finalAvatarBottom)
        : infoBottom;
      const dividerY = headerContentBottom + scaleUiSize(this.scene, 4, "spacing");
      setVisibleSafe(this.headerDivider, false);
      const bodyTop = summaryLayout
        ? headerContentBottom + scaleUiSize(this.scene, 8, "spacing")
        : dividerY + scaleUiSize(this.scene, 8, "spacing");
      const bodyContentX = pad + scaleUiSize(this.scene, compact ? 2 : 4, "spacing");
      const bodyContentW = Math.max(
        240,
        width - bodyContentX - pad - scaleUiSize(this.scene, compact ? 2 : 4, "spacing")
      );
      const minHeaderHeight = avatarSize + headerInset * 2;
      const initialHeaderSectionBottom = summaryLayout ? headerContentBottom : dividerY;
      const headerHeight = Math.max(minHeaderHeight, initialHeaderSectionBottom - pad + scaleUiSize(this.scene, 2, "spacing"));
      this.richHeaderPad = pad;
      this.richHeaderHeight = headerHeight;
      const headerSectionBottom = summaryLayout
        ? Math.max(headerContentBottom, finalAvatarBottom)
        : dividerY;
      const avatarCenterX = avatarLeft + avatarSize * 0.5;
      const avatarCenterY = avatarTop + avatarSize * 0.5;
      setPositionSafe(this.avatarGlow, avatarLeft - 2, avatarTop - 2);
      setPositionSafe(this.avatarFrame, avatarLeft, avatarTop);
      setPositionSafe(this.avatarInner, avatarLeft + 4, avatarTop + 4);
      this.avatarFrame.setSize(avatarSize, avatarSize);
      this.avatarInner.setSize(avatarSize - 8, avatarSize - 8);
      this.avatarGlow.setSize(avatarSize + 4, avatarSize + 4);
      setPositionSafe(this.avatarIcon, avatarCenterX, avatarCenterY + 1);

      const portraitKey = typeof rich.avatar?.portraitKey === "string" ? rich.avatar.portraitKey : "";
      const canUsePortrait = Boolean(portraitKey && this.scene.textures.exists(portraitKey));
      const hasAvatarModel = this.syncAvatarModel(
        rich.avatar,
        avatarCenterX,
        avatarCenterY,
        avatarSize,
        Number(rich.avatar?.hp ?? 0),
        Number(rich.avatar?.maxHp ?? 0)
      );
      if (hasAvatarModel) {
        if (this.avatarSprite) {
          setVisibleSafe(this.avatarSprite, false);
        }
        this.avatarIcon.setVisible(false);
      } else if (canUsePortrait && typeof this.scene.add?.image === "function") {
        if (!this.avatarSprite || this.avatarSprite.active === false) {
          this.avatarSprite?.destroy?.();
          this.avatarSprite = this.scene.add.image(0, 0, portraitKey);
          this.avatarSprite.setOrigin(0.5);
          this.avatarSprite.setDepth(9001);
          this.root.add(this.avatarSprite);
        } else {
          this.avatarSprite.setTexture(portraitKey);
        }
        this.avatarSprite.setVisible(true);
        this.avatarSprite.setPosition(avatarCenterX, avatarCenterY);
        this.avatarSprite.setDisplaySize(avatarSize - 10, avatarSize - 10);
        this.avatarIcon.setVisible(false);
      } else {
        if (this.avatarSprite) {
          setVisibleSafe(this.avatarSprite, false);
        }
        setTextSafe(this.avatarIcon, rich.avatar?.previewIcon ?? rich.avatar?.icon ?? "🐾");
        this.avatarIcon.setVisible(true);
      }
      const hasSpeechButton = this.layoutSpeechButton({
        avatarLeft,
        avatarTop,
        avatarSize,
        compact,
        theme,
        label: String(rich.speechLabel ?? ""),
        lang: String(rich.speechLang ?? "")
      });
      if (hasSpeechButton) {
        this.root.bringToTop?.(this.speechButtonBg);
        this.root.bringToTop?.(this.speechButtonText);
      }
      const columnTextObjects = [this.bodyText, this.rightText, this.col3Text, this.col4Text];
      const columnDividers = [this.divider, this.divider2, this.divider3];
      let bodyHeight = scaleUiSize(this.scene, 60, "control");
      const resolvedBodyTop = summaryLayout
        ? headerSectionBottom + scaleUiSize(this.scene, 8, "spacing")
        : bodyTop;

      const sectionLineSpacing = rich.layoutMode === "summary"
        ? scaleUiSize(this.scene, 2, "spacing")
        : scaleUiSize(this.scene, 3, "spacing");
      columnTextObjects.forEach((textObj) => {
        setVisibleSafe(textObj, false);
        setColorSafe(textObj, theme.bodyColor ?? "#e8f4ff");
        if (typeof textObj.setLineSpacing === "function") {
          textObj.setLineSpacing(sectionLineSpacing);
        }
      });
      columnDividers.forEach((divider) => setVisibleSafe(divider, false));

      if (expandedLayout) {
        const displayedColumns = this.resolveDisplayedSectionColumns(rich, compact ? 2 : 4);
        const visibleColumnCount = Math.max(1, displayedColumns.length);
        const columnGap = scaleUiSize(this.scene, compact ? 14 : 18, "spacing");
        const totalGapWidth = columnGap * Math.max(0, visibleColumnCount - 1);
        const columnWidth = Math.max(160, Math.floor((bodyContentW - totalGapWidth) / visibleColumnCount));
      const columnHeights: number[] = [];

        displayedColumns.forEach((columnBlocks, index) => {
          const textObj = columnTextObjects[index];
          if (!textObj) return;
          const columnText = composeSectionText(columnBlocks);
          textObj.setWordWrapWidth(columnWidth, true);
          setTextSafe(textObj, columnText);
          setPositionSafe(textObj, bodyContentX + index * (columnWidth + columnGap), resolvedBodyTop);
          setVisibleSafe(textObj, true);
          columnHeights.push(textObj.height || scaleUiSize(this.scene, 60, "control"));
        });

        bodyHeight = columnHeights.length
          ? Math.max(...columnHeights)
          : scaleUiSize(this.scene, 60, "control");
        columnDividers.forEach((divider, index) => {
          if (index >= visibleColumnCount - 1) return;
          const dividerX = bodyContentX + (index + 1) * columnWidth + index * columnGap + Math.floor(columnGap * 0.5);
          setPositionSafe(divider, dividerX, resolvedBodyTop);
          setSizeSafe(divider, 1, bodyHeight);
          divider.setFillStyle?.(theme.chipStroke ?? 0x5a86aa, 0.7);
          setVisibleSafe(divider, true);
        });
      } else {
        this.bodyText.setWordWrapWidth(bodyContentW, true);
        setTextSafe(this.bodyText, bodyLines);
        setPositionSafe(this.bodyText, bodyContentX, resolvedBodyTop);
        setVisibleSafe(this.bodyText, true);
        bodyHeight = this.bodyText.height || scaleUiSize(this.scene, 60, "control");
      }

      const finalHeaderBottomY = Math.max(
        avatarTop + avatarSize,
        infoBottom,
        titleY + this.titleText.height
      );
      const totalHeight = Math.ceil(Math.max(finalHeaderBottomY, resolvedBodyTop + bodyHeight) + scaleUiSize(this.scene, 8, "spacing"));
      this.height = Math.max(scaleUiSize(this.scene, 138, "control"), totalHeight);
      this.redrawRichPanelChrome(
        theme,
        this.width,
        this.height,
        pad,
        headerHeight
      );
      this.move(pointer && "worldX" in pointer ? pointer : undefined, { force: true });
      this.root.setVisible(true);
      return true;
    } catch {
      this.root.setVisible(false);
      return false;
    }
  }

  showResolvedContent(pointer: Phaser.Input.Pointer | null | undefined, content: RichContent = {}, options: AttachOptions = {}) {
    if (!content) return false;
    if (typeof options.showContent === "function") {
      return options.showContent(pointer, content, this) !== false;
    }
    if (isRichTooltipContent(content)) {
      const shown = this.showRich(pointer, content);
      if (shown) return true;
      const fallback = this.buildLegacyFallbackFromRichContent(content);
      return this.show(pointer, fallback.title, fallback.body, fallback.rightBody, fallback.col3Body);
    }
    return this.show(pointer, content.title ?? "", content.body ?? "", content.rightBody ?? "", content.col3Body ?? "");
  }

  attach(target: Phaser.GameObjects.GameObject, getContentFn: () => RichContent | null, options: AttachOptions = {}) {
    const triggerMode = this.resolveTriggerMode(options.triggerMode);
    const pinKey = options.pinKey ?? null;
    const pointerStillInsideTarget = (pointer: Phaser.Input.Pointer | null | undefined) => {
      const safePointer = pointer ?? this.scene.input?.activePointer ?? null;
      const bounds = toBounds(target);
      return pointInBounds(bounds, safePointer?.x, safePointer?.y);
    };

    const showTooltip = (pointer: Phaser.Input.Pointer, meta: { triggerMode?: string; pinned?: boolean } = {}) => {
      const content = getContentFn?.();
      if (!content) return false;
      const shown = this.showResolvedContent(pointer, content, options);
      if (!shown) return false;
      options.onShow?.({
        pointer,
        content,
        triggerMode: meta.triggerMode ?? triggerMode,
        pinned: meta.pinned === true
      });
      return true;
    };

    const hideTooltip = (reason: string, meta: { clearPinned?: boolean; triggerMode?: string; pinned?: boolean } = {}) => {
      if (meta.clearPinned !== false) {
        this.hide(reason, { emitPinnedCallback: false });
      } else {
        this.root.setVisible(false);
      }
      options.onHide?.({
        reason,
        triggerMode: meta.triggerMode ?? triggerMode,
        pinned: meta.pinned === true
      });
    };

    if (triggerMode === "hover") {
      target.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        showTooltip(pointer, { triggerMode, pinned: false });
      });
      target.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        if (this.pinnedState) return;
        if (!this.root.visible) {
          showTooltip(pointer, { triggerMode, pinned: false });
          return;
        }
        this.move(pointer);
      });
      target.on("pointerout", (pointer: Phaser.Input.Pointer) => {
        if (this.pinnedState) return;
        if (pointerStillInsideTarget(pointer)) return;
        hideTooltip("pointerout", { triggerMode, pinned: false });
      });
      return;
    }

    target.on("pointerdown", (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event?.stopPropagation?.();
      const isSamePin = this.pinnedState
        && (this.pinnedState.target === target || (pinKey != null && this.pinnedState.pinKey === pinKey));
      if (isSamePin) {
        hideTooltip("toggle_pin_off", { triggerMode, pinned: true });
        return;
      }
      const shown = showTooltip(pointer, { triggerMode, pinned: true });
      if (!shown) return;
      this.pinnedState = { target, getContentFn, options, pinKey };
    });
  }

  handleScenePointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.pinnedState) return;
    const pinnedState = this.pinnedState;
    const px = pointer?.worldX ?? pointer?.x;
    const py = pointer?.worldY ?? pointer?.y;
    const tooltipBounds = new Phaser.Geom.Rectangle(this.root.x, this.root.y, this.width, this.height);
    if (pointInBounds(tooltipBounds, px, py)) return;
    if (pointInBounds(toBounds(pinnedState.target), px, py)) return;
    this.hide("outside_pointer");
  }

  refreshPinnedTooltip() {
    if (!this.pinnedState) return;
    const content = (this.pinnedState.getContentFn as (() => RichContent | null) | undefined)?.();
    if (!content) {
      this.hide("pinned_content_missing");
      return;
    }
    const pointer = this.resolveAnchorPointer(this.pinnedState.target);
    this.showResolvedContent(pointer && "worldX" in pointer ? pointer : undefined, content, this.pinnedState.options as AttachOptions | undefined);
  }

  showCombatUnitTooltip(pointer: Phaser.Input.Pointer | null | undefined, content: RichContent = {}, unit: RichContent | null = null) {
    if (!content && !unit) {
      this.hide();
      return;
    }

    const safeContent = content ?? {};
    const normalizedSide = normalizeTooltipSide(unit?.side ?? safeContent?.side ?? "LEFT");
    const role = unit?.classType ?? safeContent.classType ?? "FIGHTER";
    const element = unit?.tribe ?? safeContent.tribe ?? "SPIRIT";
    const title = String(safeContent.title ?? unit?.name ?? "Linh thú").trim() || "Linh thú";
    const unitVisual = unit?.visual as { previewIcon?: unknown; icon?: unknown; portraitKey?: unknown; visual?: unknown } | undefined;
    const avatarPreviewIcon = safeContent.avatar?.previewIcon
      ?? safeContent.previewIcon
      ?? safeContent.avatar?.icon
      ?? safeContent.icon
      ?? unitVisual?.previewIcon
      ?? unitVisual?.icon
      ?? "🐾";
    const fallbackStatRows = unit
      ? [
          { text: `HP: ${unit.hp ?? 0}/${unit.maxHp ?? 0}`, tone: "stat" },
          { text: `ATK: ${unit.atk ?? 0}`, tone: "stat" },
          { text: `DEF: ${unit.def ?? 0}`, tone: "stat" },
          { text: `MATK: ${unit.matk ?? 0}`, tone: "stat" },
          { text: `MDEF: ${unit.mdef ?? 0}`, tone: "stat" }
        ]
      : [];
    const fallbackBadges = unit
      ? [
          { text: `🪙 ${Math.max(1, Math.round(Number(unit.tier ?? safeContent.tier ?? 1) || 1))}`, tone: "gold" },
          { text: getClassLabel(role), tone: "class" },
          { text: getTribeLabel(element), tone: "tribe" },
          {
            text: t("combat.teamBadge", {
              team: normalizedSide === "RIGHT" ? t("combat.teamEnemy") : t("combat.teamAlly")
            }),
            tone: "status"
          },
          ...((Number(unit.rageMax) || 0) > 0 ? [{ text: `Nộ khí ${unit.rage ?? 0}/${unit.rageMax ?? 0}`, tone: "rage" }] : [])
        ]
      : [];
    const bodyLines = normalizeTextLines(safeContent.body);
    const rightBodyLines = normalizeTextLines(safeContent.rightBody);
    const col3BodyLines = normalizeTextLines(safeContent.col3Body);
    const fallbackSectionBlocks = [];
    if (bodyLines.length) {
      fallbackSectionBlocks.push({ title: t("combat.battleState"), lines: bodyLines });
    }
    if (rightBodyLines.length) {
      fallbackSectionBlocks.push({ title: t("combat.skillLabel"), lines: rightBodyLines });
    }
    if (col3BodyLines.length) {
      fallbackSectionBlocks.push({ title: t("library.equipment"), lines: col3BodyLines });
    }

    return this.showRich(pointer, {
      ...safeContent,
      title,
      subtitle: String(safeContent.subtitle ?? [getClassLabel(role), getTribeLabel(element)].filter(Boolean).join(" • ")).trim(),
      avatar: {
        ...(safeContent.avatar ?? {}),
        icon: avatarPreviewIcon,
        previewIcon: avatarPreviewIcon,
        baseId: String(safeContent.avatar?.baseId ?? unit?.id ?? safeContent.baseId ?? "") || undefined,
        portraitKey: safeContent.avatar?.portraitKey ?? safeContent.portraitKey ?? unitVisual?.portraitKey ?? null,
        visual: (safeContent.avatar?.visual ?? safeContent.visual ?? unitVisual?.visual ?? unit?.visual ?? undefined) as AvatarData["visual"],
        star: Number(safeContent.avatar?.star ?? safeContent.star ?? unit?.star ?? 1),
        hp: Number(safeContent.avatar?.hp ?? safeContent.hp ?? unit?.hp ?? 0),
        maxHp: Number(safeContent.avatar?.maxHp ?? safeContent.maxHp ?? unit?.maxHp ?? 0),
        tribe: String(safeContent.avatar?.tribe ?? element),
        unitCore: safeContent.avatar?.unitCore ?? unit ?? null,
        surface: String(safeContent.avatar?.surface ?? "tooltip"),
        side: normalizedSide,
        classType: String(safeContent.avatar?.classType ?? role),
        label: title
      },
      theme: {
        ...defaultRichTheme(this.scene, normalizedSide, String(role)),
        ...(safeContent.theme ?? {})
      },
      headerMeta: String(
        safeContent.headerMeta
        ?? `⭐ ${Math.max(1, Math.round(Number(safeContent?.avatar?.star ?? safeContent?.star ?? unit?.star ?? 1) || 1))}`
      ).trim(),
      badgeRows: Array.isArray(safeContent.badgeRows) && safeContent.badgeRows.length ? safeContent.badgeRows : fallbackBadges,
      statRows: Array.isArray(safeContent.statRows) && safeContent.statRows.length ? safeContent.statRows : fallbackStatRows,
      sectionBlocks: Array.isArray(safeContent.sectionBlocks) && safeContent.sectionBlocks.length
        ? safeContent.sectionBlocks
        : fallbackSectionBlocks
    }, unit);
  }

  show(pointer: Phaser.Input.Pointer | null | undefined, title: unknown, body: unknown, rightBody: unknown = "", col3Body: unknown = "") {
    this.applyResponsiveLayout();
    if (!this.canRenderLegacyTooltip()) return false;
    this.lastRenderMode = "legacy";
    this.lastContent = { title, body, rightBody, col3Body };
    this.setRichNodesVisible(false);
    this.setRichChromeVisible(false);
    this.resetRichTransientNodes();
    this.setLegacyChromeVisible(true);
    const hasRightColumn = Boolean(String(rightBody ?? "").trim());
    const hasCol3 = Boolean(String(col3Body ?? "").trim());
    const stackColumns = hasRightColumn && this.viewportProfile !== "desktop";

    if (stackColumns) {
      const mergedBody = [
        body,
        String(rightBody ?? "").trim(),
        String(col3Body ?? "").trim()
      ].filter(Boolean).join("\n\n");
      this.rightText.setVisible(false);
      this.divider.setVisible(false);
      this.col3Text.setVisible(false);
      this.divider2.setVisible(false);
      this.col4Text.setVisible(false);
      this.divider3.setVisible(false);
      const maxWidth = Math.max(300, Math.min(560, Math.floor(this.scene.scale.width * 0.62)));
      const minWidth = 280;
      const wrapWidth = maxWidth - this.padX * 2;
      this.titleText.setWordWrapWidth(wrapWidth, true);
      this.bodyText.setWordWrapWidth(wrapWidth, true);
      this.titleText.setText(String(title ?? ""));
      this.bodyText.setText(String(mergedBody ?? ""));
      this.width = Phaser.Math.Clamp(Math.ceil(Math.max(
        this.measureWrappedWidth(this.titleText.getWrappedText(String(title ?? "")), this.titleText),
        this.measureWrappedWidth(this.bodyText.getWrappedText(String(mergedBody ?? "")), this.bodyText)
      ) + this.padX * 2 + 2), minWidth, maxWidth);
      this.titleText.setWordWrapWidth(this.width - this.padX * 2, true);
      this.bodyText.setWordWrapWidth(this.width - this.padX * 2, true);
      this.titleText.setPosition(this.padX, this.padY);
      this.bodyText.setPosition(this.padX, this.padY + this.titleText.height + this.gapY);
      this.height = Math.max(scaleUiSize(this.scene, 110, "control"), Math.ceil(this.bodyText.y + this.bodyText.height + this.padY));
      this.syncLegacyChromeLayout();
      setVisibleSafe(this.shadowBg, true);
      this.move(pointer, { force: true });
      this.root.setVisible(true);
      return true;
    }

    if (hasRightColumn) {
      const minWidth = hasCol3 ? 660 : 460;
      const maxWidth = Math.max(minWidth, Math.min(hasCol3 ? 780 : 580, Math.floor(this.scene.scale.width * (hasCol3 ? 0.62 : 0.52))));
      this.width = Phaser.Math.Clamp(Math.floor(this.scene.scale.width * (hasCol3 ? 0.56 : 0.46)), minWidth, maxWidth);
      const splitGap = scaleUiSize(this.scene, 16, "spacing");
      const contentW = this.width - this.padX * 2;

      let leftW;
      let rightW;
      let col3W;
      if (hasCol3) {
        const totalGaps = splitGap * 2;
        const usable = contentW - totalGaps;
        leftW = Math.max(scaleUiSize(this.scene, 180, "control"), Math.floor(usable * 0.36));
        rightW = Math.max(scaleUiSize(this.scene, 180, "control"), Math.floor(usable * 0.36));
        col3W = Math.max(scaleUiSize(this.scene, 140, "control"), usable - leftW - rightW);
      } else {
        leftW = Math.max(scaleUiSize(this.scene, 210, "control"), Math.floor((contentW - splitGap) * 0.46));
        rightW = Math.max(scaleUiSize(this.scene, 220, "control"), contentW - splitGap - leftW);
        col3W = 0;
      }

      this.titleText.setWordWrapWidth(contentW, true);
      this.bodyText.setWordWrapWidth(leftW, true);
      this.rightText.setWordWrapWidth(rightW, true);

      this.titleText.setText(String(title ?? ""));
      this.bodyText.setText(String(body ?? ""));
      this.rightText.setText(String(rightBody ?? ""));

      this.titleText.setPosition(this.padX, this.padY);
      const bodyY = this.padY + this.titleText.height + this.gapY + 1;
      this.bodyText.setPosition(this.padX, bodyY);
      this.rightText.setPosition(this.padX + leftW + splitGap, bodyY);
      this.divider.setPosition(this.padX + leftW + Math.floor(splitGap / 2), bodyY - 1);

      let maxColHeight = Math.max(this.bodyText.height, this.rightText.height);

      if (hasCol3) {
        const col3X = this.padX + leftW + splitGap + rightW + splitGap;
        this.col3Text.setWordWrapWidth(col3W, true);
        this.col3Text.setText(String(col3Body ?? ""));
        this.col3Text.setPosition(col3X, bodyY);
        this.col3Text.setVisible(true);
        this.divider2.setPosition(col3X - Math.floor(splitGap / 2), bodyY - 1);
        this.divider2.setVisible(true);
        maxColHeight = Math.max(maxColHeight, this.col3Text.height);
        this.divider2.setSize(1, maxColHeight + 2);
      } else {
        this.col3Text.setVisible(false);
        this.divider2.setVisible(false);
      }
      this.col4Text.setVisible(false);
      this.divider3.setVisible(false);

      this.divider.setSize(1, maxColHeight + 2);
      this.rightText.setVisible(true);
      this.divider.setVisible(true);
      this.height = Math.max(scaleUiSize(this.scene, 90, "control"), Math.ceil(bodyY + maxColHeight + this.padY));
      this.syncLegacyChromeLayout();
      setVisibleSafe(this.shadowBg, true);
      this.move(pointer, { force: true });
      this.root.setVisible(true);
      return true;
    }

    this.rightText.setVisible(false);
    this.divider.setVisible(false);
    this.col3Text.setVisible(false);
    this.divider2.setVisible(false);
    this.col4Text.setVisible(false);
    this.divider3.setVisible(false);
    const maxWidth = Math.max(260, Math.min(460, Math.floor(this.scene.scale.width * 0.34)));
    const minWidth = 240;
    const measureWrap = maxWidth - this.padX * 2;
    this.titleText.setWordWrapWidth(measureWrap, true);
    this.bodyText.setWordWrapWidth(measureWrap, true);

    const titleLines = this.titleText.getWrappedText(String(title ?? ""));
    const bodyLines = this.bodyText.getWrappedText(String(body ?? ""));
    const measuredTitleW = this.measureWrappedWidth(titleLines, this.titleText);
    const measuredBodyW = this.measureWrappedWidth(bodyLines, this.bodyText);
    const measuredW = Math.ceil(Math.max(measuredTitleW, measuredBodyW) + this.padX * 2 + 2);
    this.width = Phaser.Math.Clamp(measuredW, minWidth, maxWidth);

    this.titleText.setWordWrapWidth(this.width - this.padX * 2, true);
    this.bodyText.setWordWrapWidth(this.width - this.padX * 2, true);
    this.titleText.setText(String(title ?? ""));
    this.bodyText.setText(String(body ?? ""));

    this.titleText.setPosition(this.padX, this.padY);
    this.bodyText.setPosition(this.padX, this.padY + this.titleText.height + this.gapY);
    this.height = Math.max(scaleUiSize(this.scene, 82, "control"), Math.ceil(this.bodyText.y + this.bodyText.height + this.padY));
    this.syncLegacyChromeLayout();
    setVisibleSafe(this.shadowBg, true);
    this.move(pointer, { force: true });
    this.root.setVisible(true);
    return true;
  }

  move(pointer: Phaser.Input.Pointer | null | undefined, options: { force?: boolean } = {}) {
    if (this.pinnedState && options.force !== true) return;
    const px = pointer?.x ?? this.scene.input?.activePointer?.x ?? this.scene.scale.width * 0.5;
    const py = pointer?.y ?? this.scene.input?.activePointer?.y ?? this.scene.scale.height * 0.5;
    const pad = this.margin;
    const maxX = this.scene.scale.width - this.width - pad;
    const maxY = this.scene.scale.height - this.height - pad;
    const x = Phaser.Math.Clamp(px + scaleUiSize(this.scene, 18, "spacing"), pad, maxX);
    const y = Phaser.Math.Clamp(py + scaleUiSize(this.scene, 18, "spacing"), pad, maxY);
    this.root.setPosition(x, y);
  }

  hide(reason = "manual", { emitPinnedCallback = true }: { emitPinnedCallback?: boolean } = {}) {
    const pinnedState = this.pinnedState;
    this.root.setVisible(false);
    this.resetRichTransientNodes();
    this.pinnedState = null;
    if (emitPinnedCallback) {
      (pinnedState?.options as AttachOptions | undefined)?.onHide?.({
        reason,
        triggerMode: "pin",
        pinned: true
      });
    }
  }
}
