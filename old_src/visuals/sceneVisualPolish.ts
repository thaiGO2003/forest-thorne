import Phaser from "phaser";
import { UI_FONT } from "../core/uiTheme.js";
import type { ResolvedStarVisualIdentity } from "./starVisualTypes.js";

type AnyObj = Record<string, unknown>;
type SceneLike = Phaser.Scene;

interface DisplayLike {
  active?: boolean;
  __sharedFacingScaleSign?: number;
  __sharedStackIndex?: number;
  __sharedStackEntries?: STACK_ENTRY[];
  __sharedStackPrimary?: DisplayLike;
  __sharedIconStack?: STACK_ENTRY[];
  __sharedContainer?: Phaser.GameObjects.Container;
  __sharedDeathPoseCall?: { remove?: () => void } | null;
  x?: number;
  y?: number;
  alpha?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  depth?: number;
  visible?: boolean;
  setPosition?: (x: number, y: number) => unknown;
  setScale?: (x: number, y: number) => unknown;
  setAngle?: (angle: number) => unknown;
  setAlpha?: (alpha: number) => unknown;
  setDepth?: (depth: number) => unknown;
  setVisible?: (value: boolean) => unknown;
  setFlipX?: (value: boolean) => unknown;
  destroy?: () => void;
}

interface STACK_ENTRY {
  target: DisplayLike;
  offsetX: number;
  offsetY: number;
  depthOffset: number;
  scale: number;
  baseAlpha: number;
  currentOffsetX: number;
  currentOffsetY: number;
}

const SHARED_UNIT_BAR_COLORS = Object.freeze({
  hpBg: 0x09111b,
  hpStroke: 0x000000,
  hpFill: 0x79df7b,
  hpFillLow: 0xf3d66b,
  hpFillCritical: 0xf44336,
  hpFillDead: 0x676f77,
  shieldFill: 0x9dffba,
  rageBg: 0x676f77,
  rageStroke: 0x000000,
  rageFill: 0xf3c55d,
  rageFillDead: 0x676f77,
  rageDivider: 0x000000
});

const SHARED_TOKEN_LABEL_LAYOUT = Object.freeze({
  minWidth: 64,
  maxWidth: 126,
  height: 20,
  paddingX: 8,
  edgePadding: 6,
  cornerRadius: 2
});

const SHARED_TOKEN_LABEL_TEXT_STYLE = Object.freeze({
  fontFamily: "'Segoe UI', Tahoma, sans-serif",
  fontSize: "15px",
  fontStyle: "bold"
});

const SHARED_TOKEN_LABEL_MARQUEE = Object.freeze({
  speedPxPerSecond: 24,
  pauseMs: 1200
});

function scaleDuration(scene: SceneLike | null | undefined, ms: number): number {
  const sd = (scene as AnyObj | null | undefined)?.scaleCombatDuration as ((ms: number) => number) | undefined;
  return typeof sd === "function" ? sd(ms) : ms;
}

function pulseAt(
  scene: SceneLike | null | undefined,
  root: Phaser.GameObjects.GameObject | null | undefined,
  x: number,
  y: number,
  color: number,
  radius: number,
  duration: number,
  alpha: number = 0.18,
  stroke: number = 0.8
): Phaser.GameObjects.Arc | null {
  const sAny = scene as AnyObj | null | undefined;
  const pool = sAny?.fxPool as {
    acquireCircle: (x: number, y: number, radius: number, color: number, alpha: number, depth: number) => Phaser.GameObjects.Arc | null;
    tween: (target: Phaser.GameObjects.Arc, config: AnyObj, key: string) => void;
  } | undefined;
  const ring = pool?.acquireCircle(x, y, radius, color, alpha, 8611) ?? scene?.add.circle(x, y, radius, color, alpha);
  if (!ring) return null;
  ring.setStrokeStyle(2, color, stroke);
  if (!pool) ring.setDepth(8611);
  (root as Phaser.GameObjects.Container | null | undefined)?.add?.(ring);
  if (pool) {
    pool.tween(ring, { scale: 1.9, alpha: 0, duration, ease: "Cubic.out" }, "circle");
    return ring;
  }
  scene?.tweens.add({
    targets: ring,
    scale: 1.9,
    alpha: 0,
    duration,
    ease: "Cubic.out",
    onComplete: () => ring.destroy()
  });
  return ring;
}

function setDisplayPosition(target: DisplayLike | null | undefined, x: number, y: number): void {
  if (!target?.active) return;
  if (typeof target.setPosition === "function") {
    target.setPosition(x, y);
  } else {
    target.x = x;
    target.y = y;
  }
}

function getFacingScaleSign(target: DisplayLike | null | undefined): number {
  if (!Number.isFinite(target?.__sharedFacingScaleSign)) return 1;
  return (target!).__sharedFacingScaleSign as number;
}

type FacingScaleValue = number | { from?: number; to?: number; start?: number; value?: number } | null | undefined;

function applyFacingScaleSign(target: DisplayLike | null | undefined, value: FacingScaleValue): FacingScaleValue {
  if (!Number.isFinite(target?.__sharedFacingScaleSign)) return value;
  const sign = getFacingScaleSign(target);
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value) * sign;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const next: { from?: number; to?: number; start?: number; value?: number } = { ...value };
    (["from", "to", "start", "value"] as const).forEach((key) => {
      if (typeof next[key] === "number" && Number.isFinite(next[key])) {
        next[key] = Math.abs(next[key] as number) * sign;
      }
    });
    return next;
  }
  return value;
}

function setDisplayScale(target: DisplayLike | null | undefined, scaleX: FacingScaleValue, scaleY: number): void {
  if (!target?.active) return;
  const nextScaleX = applyFacingScaleSign(target, scaleX);
  if (typeof target.setScale === "function") {
    target.setScale(nextScaleX as number, scaleY);
  } else {
    target.scaleX = nextScaleX as number;
    target.scaleY = scaleY;
  }
}

function setDisplayAngle(target: DisplayLike | null | undefined, angle: number): void {
  if (!target?.active) return;
  if (typeof target.setAngle === "function") {
    target.setAngle(angle);
  } else {
    target.angle = angle;
  }
}

function setDisplayAlpha(target: DisplayLike | null | undefined, alpha: number): void {
  if (!target?.active) return;
  if (typeof target.setAlpha === "function") {
    target.setAlpha(alpha);
  } else {
    target.alpha = alpha;
  }
}

export { SHARED_UNIT_BAR_COLORS, SHARED_TOKEN_LABEL_LAYOUT, SHARED_TOKEN_LABEL_TEXT_STYLE };

function normalizeRageSegmentCount(rageMax: number = 1): number {
  return Math.max(1, Math.min(12, Math.round(Number(rageMax) || 1)));
}

export function getSharedRageDividerPositions(width: number = 0, rageMax: number = 1): number[] {
  const safeWidth = Math.max(0, Number(width) || 0);
  const segmentCount = normalizeRageSegmentCount(rageMax);
  if (safeWidth <= 0 || segmentCount <= 1) return [];
  const positions: number[] = [];
  for (let index = 1; index < segmentCount; index += 1) {
    positions.push(Math.round((safeWidth * index) / segmentCount));
  }
  return positions;
}

interface RageBarOptions {
  width?: number;
  height?: number;
  color?: number;
  alpha?: number;
  dividerWidth?: number;
  rageMax?: number;
  x?: number;
  y?: number;
  depth?: number;
}

type RageBarGrid = Phaser.GameObjects.Graphics;

export function redrawSharedRageBarGrid(
  target: RageBarGrid | null | undefined,
  options: RageBarOptions = {}
): RageBarGrid | null | undefined {
  if (!target?.active || typeof target.clear !== "function") return target;
  const width = Math.max(0, Number(options.width) || 0);
  const height = Math.max(1, Number(options.height) || 0);
  const color = options.color ?? SHARED_UNIT_BAR_COLORS.rageDivider;
  const alpha = options.alpha ?? 0.98;
  const dividerPositions = getSharedRageDividerPositions(width, options.rageMax ?? 1);
  const dividerWidth = Math.max(2, Math.min(4, Number(options.dividerWidth) || Math.round(height * 0.75)));
  target.clear();
  if (!dividerPositions.length) return target;
  target.fillStyle?.(color, alpha);
  dividerPositions.forEach((position) => {
    target.fillRect?.(position - dividerWidth * 0.5, -height * 0.5, dividerWidth, height);
  });
  return target;
}

export function createSharedRageBarGrid(scene: SceneLike, options: RageBarOptions = {}): RageBarGrid {
  const grid = scene.add.graphics();
  grid.setPosition?.(options.x ?? 0, options.y ?? 0);
  redrawSharedRageBarGrid(grid, options);
  grid.setDepth?.(options.depth ?? 0);
  grid.setAlpha?.(options.alpha ?? 1);
  return grid;
}

function getSharedStackLayout(star: number = 1): Array<{
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
  depthOffset: number;
  primary: boolean;
}> {
  if (star >= 3) {
    return [
      { offsetX: 0, offsetY: 4, scale: 1, alpha: 1, depthOffset: 2, primary: true },
      { offsetX: -28, offsetY: -2, scale: 0.84, alpha: 0.8, depthOffset: 0, primary: false },
      { offsetX: 28, offsetY: -2, scale: 0.84, alpha: 0.8, depthOffset: 0, primary: false }
    ];
  }
  if (star === 2) {
    return [
      { offsetX: -22, offsetY: 2, scale: 1, alpha: 1, depthOffset: 2, primary: true },
      { offsetX: 22, offsetY: -1, scale: 0.82, alpha: 0.8, depthOffset: 0, primary: false }
    ];
  }
  return [
    { offsetX: 0, offsetY: 0, scale: 1, alpha: 1, depthOffset: 1, primary: true }
  ];
}

export function getSharedVisibleStackOffsets(visibleCount: number = 1): number[] {
  if (visibleCount >= 3) {
    return [0, -28, 28];
  }
  if (visibleCount === 2) {
    return [-22, 22];
  }
  if (visibleCount === 1) {
    return [0];
  }
  return [];
}

interface BUILD_TOKEN_LABEL_OPTS {
  star?: number;
  name?: string;
  prefix?: string;
  suffix?: string;
  roleIcon?: string;
}

export function buildSharedTokenLabelText({ star = 1, name = "", prefix = "", suffix = "", roleIcon = "" }: BUILD_TOKEN_LABEL_OPTS = {}): string {
  const segments: string[] = [];
  const safePrefix = String(prefix ?? "").trim();
  const safeName = String(name ?? "").trim();
  const safeSuffix = String(suffix ?? "").trim();
  const safeRoleIcon = String(roleIcon ?? "").trim();
  if (safePrefix) segments.push(safePrefix);
  segments.push(`${Math.max(1, Math.round(Number(star) || 1))}★`);
  if (safeRoleIcon) segments.push(safeRoleIcon);
  if (safeName) segments.push(safeName);
  if (safeSuffix) segments.push(safeSuffix);
  return segments.join(" ").trim();
}

type LabelTextStyle = {
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  color: string;
  stroke: string;
  strokeThickness: number;
};

type LabelTextNode = {
  active: boolean;
  x?: number;
  y?: number;
  width?: number;
  displayWidth?: number;
  text?: string;
  style?: LabelTextStyle;
  filters?: { external?: { clear: () => void; addMask: (g: Phaser.GameObjects.Graphics) => unknown } };
  getTextBounds?: () => { local?: { width?: number } } | undefined;
  getBounds?: () => { width?: number } | undefined;
  enableFilters?: () => void;
  setStyle?: (style: LabelTextStyle) => void;
  setPadding?: (left: number, right: number, top: number, bottom: number) => void;
  setResolution?: (resolution: number) => void;
  setOrigin?: (x: number, y: number) => void;
  roundPixels?: boolean;
};

type TokenLabelBackground = {
  active: boolean;
  width?: number;
  height?: number;
  __sharedTokenLabelBackground?: boolean;
  __sharedCornerRadius?: number;
  __sharedFillColor?: number;
  __sharedFillAlpha?: number;
  __sharedStrokeWidth?: number;
  __sharedStrokeColor?: number;
  __sharedStrokeAlpha?: number;
  clear?: () => void;
  fillStyle?: (color: number, alpha?: number) => void;
  fillRoundedRect?: (x: number, y: number, width: number, height: number, radius: number) => void;
  fillRect?: (x: number, y: number, width: number, height: number) => void;
  lineStyle?: (width: number, color: number, alpha?: number) => void;
  strokeRoundedRect?: (x: number, y: number, width: number, height: number, radius: number) => void;
  strokeRect?: (x: number, y: number, width: number, height: number) => void;
  setPosition?: (x: number, y: number) => void;
  setDisplaySize: (width: number, height: number) => TokenLabelBackground;
  setSize: (width: number, height: number) => TokenLabelBackground;
  setFillStyle: (fillColor: number, fillAlpha?: number) => TokenLabelBackground;
  setStrokeStyle: (strokeWidth: number, strokeColor: number, strokeAlpha?: number) => TokenLabelBackground;
};

type TokenLabelTag = LabelTextNode & {
  __sharedTokenLabelTextNode?: LabelTextNode;
  __sharedTokenLabelBaseX?: number;
  __sharedTokenLabelBaseY?: number;
  __sharedTokenLabelOverflow?: number;
  __sharedTokenLabelOffset?: number;
  __sharedTokenLabelTween?: { remove?: () => void } | null;
  __sharedTokenLabelMask?: unknown;
  __sharedTokenLabelMaskGraphics?: Phaser.GameObjects.Graphics | null;
};

function redrawSharedTokenLabelBackground(target: TokenLabelBackground | null | undefined): TokenLabelBackground | null | undefined {
  if (!target?.active || !target.__sharedTokenLabelBackground) return target;
  const width = Math.max(1, Number(target.width) || SHARED_TOKEN_LABEL_LAYOUT.minWidth);
  const height = Math.max(1, Number(target.height) || SHARED_TOKEN_LABEL_LAYOUT.height);
  const radius = Math.max(0, Number(target.__sharedCornerRadius) || SHARED_TOKEN_LABEL_LAYOUT.cornerRadius);
  target.clear?.();
  target.fillStyle?.(target.__sharedFillColor ?? 0x05070c, target.__sharedFillAlpha ?? 0.76);
  if (radius > 0 && typeof target.fillRoundedRect === "function") {
    target.fillRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
  } else {
    target.fillRect?.(-width * 0.5, -height * 0.5, width, height);
  }
  const strokeWidth = Math.max(0, Number(target.__sharedStrokeWidth) || 0);
  if (strokeWidth > 0) {
    target.lineStyle?.(strokeWidth, target.__sharedStrokeColor ?? 0xffffff, target.__sharedStrokeAlpha ?? 1);
    if (radius > 0 && typeof target.strokeRoundedRect === "function") {
      target.strokeRoundedRect(-width * 0.5, -height * 0.5, width, height, radius);
    } else {
      target.strokeRect?.(-width * 0.5, -height * 0.5, width, height);
    }
  }
  return target;
}

interface CreateLabelBgOptions {
  width?: number;
  height?: number;
  cornerRadius?: number;
  fillColor?: number;
  fillAlpha?: number;
  strokeWidth?: number;
  strokeColor?: number;
  strokeAlpha?: number;
}

export function createSharedTokenLabelBackground(
  scene: SceneLike,
  x: number,
  y: number,
  options: CreateLabelBgOptions = {}
): TokenLabelBackground {
  const bg = scene.add.graphics() as unknown as TokenLabelBackground;
  bg.__sharedTokenLabelBackground = true;
  bg.width = Math.max(1, Number(options.width) || SHARED_TOKEN_LABEL_LAYOUT.minWidth);
  bg.height = Math.max(1, Number(options.height) || SHARED_TOKEN_LABEL_LAYOUT.height);
  bg.__sharedCornerRadius = Math.max(0, Number(options.cornerRadius) || SHARED_TOKEN_LABEL_LAYOUT.cornerRadius);
  bg.__sharedFillColor = options.fillColor ?? 0x05070c;
  bg.__sharedFillAlpha = options.fillAlpha ?? 0.76;
  bg.__sharedStrokeWidth = Math.max(0, Number(options.strokeWidth) || 0);
  bg.__sharedStrokeColor = options.strokeColor ?? 0xffffff;
  bg.__sharedStrokeAlpha = options.strokeAlpha ?? 1;
  bg.setPosition?.(x ?? 0, y ?? 0);
  bg.setFillStyle = function setFillStyle(this: TokenLabelBackground, fillColor: number, fillAlpha: number = this.__sharedFillAlpha ?? 1): TokenLabelBackground {
    this.__sharedFillColor = fillColor;
    this.__sharedFillAlpha = fillAlpha;
    redrawSharedTokenLabelBackground(this);
    return this;
  };
  bg.setStrokeStyle = function setStrokeStyle(this: TokenLabelBackground, strokeWidth: number, strokeColor: number, strokeAlpha: number = this.__sharedStrokeAlpha ?? 1): TokenLabelBackground {
    this.__sharedStrokeWidth = Math.max(0, Number(strokeWidth) || 0);
    this.__sharedStrokeColor = strokeColor;
    this.__sharedStrokeAlpha = strokeAlpha;
    redrawSharedTokenLabelBackground(this);
    return this;
  };
  bg.setDisplaySize = function setDisplaySize(this: TokenLabelBackground, width: number, height: number): TokenLabelBackground {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    redrawSharedTokenLabelBackground(this);
    return this;
  };
  bg.setSize = bg.setDisplaySize;
  redrawSharedTokenLabelBackground(bg);
  return bg;
}

function measureSharedTokenLabelTextWidth(
  scene: SceneLike | null | undefined,
  tag: TokenLabelTag | null | undefined
): number {
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode) return 0;
  const localBounds = textNode.getTextBounds?.()?.local;
  const localWidth = localBounds?.width;
  if (Number.isFinite(localWidth) && (localWidth ?? 0) > 0) {
    return Math.ceil(localWidth as number);
  }
  const bounds = textNode.getBounds?.();
  const boundsWidth = bounds?.width;
  if (Number.isFinite(boundsWidth) && (boundsWidth ?? 0) > 0) {
    return Math.ceil(boundsWidth as number);
  }
  const sAny = scene as AnyObj | null | undefined;
  const ctx = (sAny as AnyObj | undefined)?.sys as AnyObj | undefined;
  const canvas = (ctx as AnyObj | undefined)?.game as AnyObj | undefined;
  const renderingCtx = (canvas as { getContext?: (type: string) => unknown } | undefined)?.getContext?.("2d") as CanvasRenderingContext2D | null | undefined;
  const textValue = String(textNode.text ?? "");
  if (renderingCtx && textValue) {
    const style: LabelTextStyle = { ...(textNode.style ?? SHARED_TOKEN_LABEL_TEXT_STYLE) } as LabelTextStyle;
    const fontSize = typeof style.fontSize === "number" ? `${style.fontSize}px` : style.fontSize;
    const fontStyle = style.fontStyle ? `${style.fontStyle} ` : "";
    renderingCtx.save?.();
    try {
      renderingCtx.font = `${fontStyle}${fontSize} ${style.fontFamily}`;
      return Math.ceil(renderingCtx.measureText(textValue).width);
    } finally {
      renderingCtx.restore?.();
    }
  }
  return Math.ceil(Math.max(0, Number(textNode.width) || Number(textNode.displayWidth) || 0));
}

interface ApplyTextStyleOptions {
  fontSize?: number | string;
  fontFamily?: string;
  fontStyle?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
}

export function applySharedTokenLabelTextStyle(tag: TokenLabelTag, options: ApplyTextStyleOptions = {}): TokenLabelTag {
  if (!tag?.active) return tag;
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode) return tag;
  const fontSize = options.fontSize ?? SHARED_TOKEN_LABEL_TEXT_STYLE.fontSize;
  const color = options.color ?? "#f2f7ff";
  const stylePatch: LabelTextStyle = {
    fontFamily: options.fontFamily ?? SHARED_TOKEN_LABEL_TEXT_STYLE.fontFamily,
    fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize,
    fontStyle: options.fontStyle ?? SHARED_TOKEN_LABEL_TEXT_STYLE.fontStyle,
    color,
    stroke: options.stroke ?? "#02050a",
    strokeThickness: options.strokeThickness ?? 2
  };
  textNode.setStyle?.(stylePatch);
  textNode.setPadding?.(2, 0, 2, 1);
  textNode.setResolution?.(2);
  if ("roundPixels" in textNode) {
    textNode.roundPixels = true;
  }
  return tag;
}

function destroySharedTokenLabelMarquee(tag: TokenLabelTag | null | undefined): void {
  tag?.__sharedTokenLabelTween?.remove?.();
  if (tag) {
    tag.__sharedTokenLabelTween = null;
    tag.__sharedTokenLabelOverflow = 0;
    tag.__sharedTokenLabelOffset = 0;
  }
}

function destroySharedTokenLabelMask(tag: TokenLabelTag | null | undefined): void {
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode) return;
  textNode.filters?.external?.clear?.();
  tag?.__sharedTokenLabelMaskGraphics?.destroy?.();
  if (tag) {
    tag.__sharedTokenLabelMask = null;
    tag.__sharedTokenLabelMaskGraphics = null;
  }
}

function applySharedTokenLabelPosition(tag: TokenLabelTag): void {
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode?.active) return;
  const baseX = Number.isFinite(tag?.__sharedTokenLabelBaseX) ? (tag.__sharedTokenLabelBaseX as number) : (Number(textNode.x) || 0);
  const baseY = Number.isFinite(tag?.__sharedTokenLabelBaseY) ? (tag.__sharedTokenLabelBaseY as number) : (Number(textNode.y) || 0);
  const overflow = Math.max(0, Number(tag?.__sharedTokenLabelOverflow) || 0);
  const offset = overflow > 0 ? Phaser.Math.Clamp(Number(tag?.__sharedTokenLabelOffset) || 0, 0, overflow) : 0;
  setDisplayPosition(textNode as unknown as DisplayLike, overflow > 0 ? baseX - offset : baseX, baseY);
}

interface UpdateSharedTokenLabelMaskOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

function updateSharedTokenLabelMask(
  scene: SceneLike | null | undefined,
  tag: TokenLabelTag | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode?.active || !scene?.add) return;
  let graphics = tag?.__sharedTokenLabelMaskGraphics;
  if (!graphics) {
    graphics = scene.add.graphics();
    if (tag) tag.__sharedTokenLabelMaskGraphics = graphics;
    textNode.enableFilters?.();
  }
  if (!graphics?.clear || !textNode.filters?.external) return;
  graphics.clear();
  graphics.fillStyle?.(0xffffff, 1);
  graphics.fillRect?.(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.ceil(width)),
    Math.max(1, Math.ceil(height))
  );
  textNode.filters.external.clear();
  if (tag) tag.__sharedTokenLabelMask = textNode.filters.external.addMask(graphics);
}

function ensureSharedTokenLabelMarquee(
  scene: SceneLike | null | undefined,
  tag: TokenLabelTag | null | undefined,
  overflow: number
): void {
  const safeOverflow = Math.max(0, Math.ceil(overflow));
  if (safeOverflow <= 0) {
    destroySharedTokenLabelMarquee(tag);
    return;
  }
  if (tag?.__sharedTokenLabelTween && Math.abs((tag.__sharedTokenLabelOverflow ?? 0) - safeOverflow) < 0.5) {
    return;
  }
  destroySharedTokenLabelMarquee(tag);
  if (tag) {
    tag.__sharedTokenLabelOverflow = safeOverflow;
    tag.__sharedTokenLabelOffset = 0;
  }
  if (!scene?.tweens?.add) return;
  const duration = Math.max(
    1000,
    Math.round((safeOverflow / SHARED_TOKEN_LABEL_MARQUEE.speedPxPerSecond) * 1000)
  );
  const tweenConfig: AnyObj = {
    targets: tag,
    __sharedTokenLabelOffset: safeOverflow,
    duration,
    ease: "Sine.easeInOut",
    delay: SHARED_TOKEN_LABEL_MARQUEE.pauseMs,
    yoyo: true,
    hold: SHARED_TOKEN_LABEL_MARQUEE.pauseMs,
    repeat: -1,
    repeatDelay: SHARED_TOKEN_LABEL_MARQUEE.pauseMs,
    onUpdate: () => applySharedTokenLabelPosition(tag!),
    onStop: () => {
      if (tag) tag.__sharedTokenLabelTween = null;
    }
  };
  const tween = scene.tweens.add(tweenConfig as unknown as Phaser.Types.Tweens.TweenBuilderConfig) as unknown as { remove?: () => void } | null;
  if (tag && tween) {
    tag.__sharedTokenLabelTween = tween;
  }
}

interface LayoutTokenLabelOptions {
  x?: number;
  y?: number;
  paddingX?: number;
  minWidth?: number;
  edgePadding?: number;
  height?: number;
  maxWidth?: number;
  sceneWidth?: number;
}

export function layoutSharedTokenLabel(
  scene: SceneLike | null | undefined,
  tagBg: TokenLabelBackground | null | undefined,
  tag: TokenLabelTag | null | undefined,
  options: LayoutTokenLabelOptions = {}
): { x: number; width: number } {
  if (!tagBg?.active || !tag?.active) {
    return {
      x: Number(options.x) || 0,
      width: Math.max(0, Number(tagBg?.width) || 0)
    };
  }
  const paddingX = Math.max(0, Number(options.paddingX) || SHARED_TOKEN_LABEL_LAYOUT.paddingX);
  const minWidth = Math.max(0, Number(options.minWidth) || SHARED_TOKEN_LABEL_LAYOUT.minWidth);
  const edgePadding = Math.max(0, Number(options.edgePadding) || SHARED_TOKEN_LABEL_LAYOUT.edgePadding);
  const height = Math.max(1, Number(options.height) || SHARED_TOKEN_LABEL_LAYOUT.height);
  const maxWidth = Math.max(minWidth, Number(options.maxWidth) || SHARED_TOKEN_LABEL_LAYOUT.maxWidth);
  const requestedX = Number.isFinite(options.x) ? (options.x as number) : 0;
  const y = Number.isFinite(options.y) ? (options.y as number) : 0;
  const textWidth = measureSharedTokenLabelTextWidth(scene, tag);
  let width = Math.max(minWidth, textWidth + paddingX * 2);
  width = Math.min(width, maxWidth);
  const sAny = scene as AnyObj | null | undefined;
  const sceneScale = (sAny as AnyObj | undefined)?.scale as { width?: number } | undefined;
  const sceneWidth = Number(options.sceneWidth ?? sceneScale?.width);
  let x = requestedX;
  if (Number.isFinite(sceneWidth) && sceneWidth > 0) {
    const minX = width * 0.5 + edgePadding;
    const maxX = sceneWidth - width * 0.5 - edgePadding;
    x = maxX < minX ? sceneWidth * 0.5 : Math.min(Math.max(requestedX, minX), maxX);
  }
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  tagBg.setPosition?.(roundedX, roundedY);
  if (typeof tagBg.setDisplaySize === "function") {
    tagBg.setDisplaySize(width, height);
  } else if (typeof tagBg.setSize === "function") {
    tagBg.setSize(width, height);
  } else {
    tagBg.width = width;
    tagBg.height = height;
  }
  tagBg.width = width;
  tagBg.height = height;
  const textNode = (tag?.__sharedTokenLabelTextNode?.active ? tag.__sharedTokenLabelTextNode : tag) ?? tag;
  if (!textNode) return { x: roundedX, width };
  const innerWidth = Math.max(1, width - paddingX * 2);
  const overflow = Math.max(0, textWidth - innerWidth);
  const clipX = roundedX - width * 0.5 + paddingX;
  const clipY = roundedY - height * 0.5 + 1;
  const clipH = Math.max(1, height - 2);
  if (overflow > 0) {
    textNode.setOrigin?.(0, 0.5);
    tag.__sharedTokenLabelBaseX = Math.round(clipX);
    tag.__sharedTokenLabelBaseY = roundedY;
    updateSharedTokenLabelMask(scene, tag, clipX, clipY, innerWidth, clipH);
    ensureSharedTokenLabelMarquee(scene, tag, overflow);
  } else {
    textNode.setOrigin?.(0.5, 0.5);
    tag.__sharedTokenLabelBaseX = roundedX;
    tag.__sharedTokenLabelBaseY = roundedY;
    destroySharedTokenLabelMarquee(tag);
    destroySharedTokenLabelMask(tag);
  }
  applySharedTokenLabelPosition(tag);
  return { x: roundedX, width };
}

function getSharedUnitStackEntries(unit: AnyObj | null | undefined): STACK_ENTRY[] {
  if (Array.isArray(unit?.__sharedIconStack) && unit.__sharedIconStack.length) {
    return unit.__sharedIconStack as STACK_ENTRY[];
  }
  if (unit?.icon) {
    return [{
      target: unit.icon as DisplayLike,
      offsetX: 0,
      offsetY: 0,
      depthOffset: 0,
      scale: 1,
      baseAlpha: 1,
      currentOffsetX: 0,
      currentOffsetY: 0
    }];
  }
  return [];
}

function syncSharedFollowerTransforms(entries: STACK_ENTRY[]): void {
  if (!Array.isArray(entries) || entries.length < 2) return;
  const primaryEntry = entries[0];
  const primary = primaryEntry?.target;
  if (!primary?.active) return;
  const primaryX = Number(primary.x) || 0;
  const primaryY = Number(primary.y) || 0;
  const primaryAngle = Number.isFinite(primary.angle) ? (primary.angle as number) : 0;
  const primaryDepth = Number.isFinite(primary.depth) ? (primary.depth as number) : 0;
  const primaryAlpha = Number.isFinite(primary.alpha) ? (primary.alpha as number) : 1;
  const primaryScaleX = Math.max(0.0001, Math.abs(Number(primary.scaleX) || 1));
  const primaryScaleY = Math.max(0.0001, Math.abs(Number(primary.scaleY) || 1));
  const primaryOffsetX = primaryEntry.currentOffsetX ?? primaryEntry.offsetX ?? 0;
  const primaryOffsetY = primaryEntry.currentOffsetY ?? primaryEntry.offsetY ?? 0;
  const primaryLayoutScale = Math.max(0.0001, Number(primaryEntry.scale) || 1);
  const primaryBaseAlpha = Math.max(0.0001, Number(primaryEntry.baseAlpha) || 1);
  entries.slice(1).forEach((entry) => {
    const target = entry?.target;
    if (!target?.active || (target as AnyObj).visible === false) return;
    const offsetX = (entry.currentOffsetX ?? entry.offsetX ?? 0) - primaryOffsetX;
    const offsetY = (entry.currentOffsetY ?? entry.offsetY ?? 0) - primaryOffsetY;
    const scaleFactor = Math.max(0.0001, ((Number(entry.scale) || 1) / primaryLayoutScale));
    const alphaFactor = Math.max(0, ((Number(entry.baseAlpha) || 1) / primaryBaseAlpha));
    setDisplayPosition(target, primaryX + offsetX, primaryY + offsetY);
    setDisplayScale(target, primaryScaleX * scaleFactor, primaryScaleY * scaleFactor);
    setDisplayAngle(target, primaryAngle);
    setDisplayAlpha(target, Math.max(0, Math.min(1, primaryAlpha * alphaFactor)));
    if (typeof target.setDepth === "function") {
      target.setDepth(primaryDepth + ((entry.depthOffset ?? 0) - (primaryEntry.depthOffset ?? 0)));
    }
  });
}

function installSharedStackFollower(scene: SceneLike, entries: STACK_ENTRY[]): (() => void) | null {
  if (!scene || !Array.isArray(entries) || entries.length < 2) {
    return null;
  }
  let detached = false;
  const updateFollowers = () => {
    if (detached) return;
    if (!entries.some((entry) => entry?.target?.active)) {
      detach();
      return;
    }
    syncSharedFollowerTransforms(entries);
  };
  const detach = () => {
    if (detached) return;
    detached = true;
    scene.events?.off?.("postupdate", updateFollowers);
    scene.events?.off?.("shutdown", detach);
    scene.events?.off?.("destroy", detach);
  };
  scene.events?.on?.("postupdate", updateFollowers);
  scene.events?.once?.("shutdown", detach);
  scene.events?.once?.("destroy", detach);
  updateFollowers();
  return detach;
}

type VisualCallback = (target: DisplayLike, index: number, entry: STACK_ENTRY) => void;

export function forEachSharedUnitVisual(unit: AnyObj, callback: VisualCallback): void {
  getSharedUnitStackEntries(unit).forEach((entry, index) => {
    if (entry?.target?.active && (entry.target as AnyObj).visible !== false) {
      callback(entry.target, index, entry);
    }
  });
}

interface CreateVisualStackOptions {
  star?: number;
  side?: string;
  baseX?: number;
  baseY?: number;
  baseDepth?: number;
  baseAlpha?: number;
  createVisual?: (slot: AnyObj) => DisplayLike | null;
}

export function createSharedUnitVisualStack(scene: SceneLike, options: CreateVisualStackOptions = {}): {
  primary: DisplayLike | null;
  copies: DisplayLike[];
  entries: STACK_ENTRY[];
  detachFollowers: (() => void) | null;
  root: Phaser.GameObjects.Container;
  nodes: DisplayLike[];
  tweens: (Phaser.Tweens.Tween | null)[];
  destroy: () => void;
} {
  const {
    star = 1,
    side = "LEFT",
    baseX = 0,
    baseY = 0,
    baseDepth = 0,
    baseAlpha = 1,
    createVisual
  } = options;
  const layout = getSharedStackLayout(star);
  const entries: STACK_ENTRY[] = layout.map((slot, index) => {
    const target = createVisual?.({
      ...slot,
      index,
      x: baseX + slot.offsetX,
      y: baseY + slot.offsetY,
      scale: slot.scale,
      alpha: baseAlpha * slot.alpha,
      depth: baseDepth + slot.depthOffset,
      primary: slot.primary === true
    });
    if (!target) return null;
    applySharedUnitFacing(target as DisplayLike, side);
    setDisplayAlpha(target as DisplayLike, baseAlpha * slot.alpha);
    if (typeof (target as DisplayLike).setDepth === "function") {
      ((target as DisplayLike).setDepth as ((d: number) => unknown) | undefined)?.(baseDepth + slot.depthOffset);
    }
    return {
      target: target as DisplayLike,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      currentOffsetX: slot.offsetX,
      currentOffsetY: slot.offsetY,
      depthOffset: slot.depthOffset,
      scale: slot.scale,
      baseAlpha: baseAlpha * slot.alpha
    };
  }).filter((entry): entry is STACK_ENTRY => entry !== null);

  entries.forEach((entry, index) => {
    if (!entry?.target?.active) return;
    entry.target.__sharedStackIndex = index;
    (entry.target as AnyObj).__sharedIconStack = entries;
    entry.target.__sharedStackPrimary = entries[0]?.target ?? entry.target;
  });
  const detachFollowers = installSharedStackFollower(scene, entries);

  const root = scene.add.container(0, 0);
  return {
    primary: entries[0]?.target ?? null,
    copies: entries.slice(1).map((entry) => entry.target),
    entries,
    detachFollowers,
    root,
    nodes: entries.map((entry) => entry.target),
    tweens: [],
    destroy() {
      detachFollowers?.();
      entries.forEach((entry) => entry.target.destroy?.());
    }
  };
}

export function getSharedUnitVisualCount(star: number = 1, hp: number = 1, maxHp: number = 1, alive: boolean = true): number {
  if (!alive || hp <= 0) return 0;
  const clampedStar = Math.max(1, Math.min(3, Math.round(star ?? 1)));
  const safeMaxHp = Math.max(1, Number(maxHp) || 1);
  const ratio = Math.max(0, Math.min(1, Number(hp) / safeMaxHp));
  if (clampedStar <= 1) return 1;
  if (clampedStar === 2) {
    return ratio > (2 / 3) ? 2 : 1;
  }
  if (ratio > (2 / 3)) return 3;
  if (ratio > (1 / 3)) return 2;
  return 1;
}

interface SyncCountOptions {
  combat?: boolean;
  side?: string;
}

export function syncSharedUnitVisualCount(unit: AnyObj, options: SyncCountOptions = {}): number {
  const entries = getSharedUnitStackEntries(unit);
  if (!entries.length) return 0;
  const visibleCount = options.combat === true
    ? getSharedUnitVisualCount(unit?.star as number, unit?.hp as number, unit?.maxHp as number, unit?.alive !== false)
    : Math.max(1, Math.min(entries.length, Math.round(unit?.star as number ?? entries.length)));
  const visibleOffsets = getSharedVisibleStackOffsets(visibleCount);
  let visibleIndex = 0;
  entries.forEach((entry, index) => {
    const isVisible = index < visibleCount;
    if (isVisible) {
      entry.currentOffsetX = visibleOffsets[visibleIndex] ?? 0;
      entry.currentOffsetY = entry.offsetY ?? 0;
      visibleIndex += 1;
    } else {
      entry.currentOffsetX = entry.offsetX ?? 0;
      entry.currentOffsetY = entry.offsetY ?? 0;
    }
    setVisibleSafe(entry.target, isVisible);
  });
  const sprite = unit.sprite as DisplayLike | undefined;
  if (sprite?.active) {
    syncSharedUnitIconToSprite(unit, {
      side: options.side ?? ((unit as AnyObj).side as string)
    });
  }
  return visibleCount;
}

function setVisibleSafe(target: DisplayLike | null | undefined, visible: boolean): void {
  if (!target?.active || typeof target.setVisible !== "function") return;
  target.setVisible(visible);
}

export function applySharedUnitFacing(icon: DisplayLike | null | undefined, side: string = "LEFT"): void {
  if (!icon?.active) return;
  icon.__sharedFacingScaleSign = side === "RIGHT" ? -1 : 1;
  if (typeof icon.setFlipX === "function") {
    icon.setFlipX(side === "RIGHT");
  } else if (Number.isFinite(icon.scaleX)) {
    const sx = Math.abs(icon.scaleX || 1);
    icon.scaleX = sx * icon.__sharedFacingScaleSign;
  }
}

export function installSharedFacingTweenPatch(scene: SceneLike | null | undefined): void {
  if (!scene?.tweens || ((scene as unknown) as AnyObj).__sharedFacingTweenPatchInstalled) return;
  const originalAdd = scene.tweens.add.bind(scene.tweens);
  (scene.tweens as unknown as AnyObj).add = (config: unknown) => {
    if (!config || typeof config !== "object") {
      return originalAdd(config as Phaser.Types.Tweens.TweenBuilderConfig);
    }
    const c = config as AnyObj;
    const targets = Array.isArray(c.targets) ? c.targets as DisplayLike[] : [c.targets as DisplayLike];
    const mirroredTargets = targets.filter((target) => getFacingScaleSign(target) === -1);
    const canNormalize = mirroredTargets.length > 0 && mirroredTargets.length === targets.length;
    if (!canNormalize) {
      return originalAdd(config as Phaser.Types.Tweens.TweenBuilderConfig);
    }
    const nextConfig: AnyObj = { ...c };
    if (Object.prototype.hasOwnProperty.call(c, "scaleX")) {
      nextConfig.scaleX = applyFacingScaleSign(mirroredTargets[0], c.scaleX as FacingScaleValue);
    }
    if (Object.prototype.hasOwnProperty.call(c, "scale")) {
      nextConfig.scaleX = applyFacingScaleSign(mirroredTargets[0], c.scale as FacingScaleValue);
      nextConfig.scaleY = c.scale;
      delete nextConfig.scale;
    }
    return originalAdd(nextConfig as Phaser.Types.Tweens.TweenBuilderConfig);
  };
  ((scene as unknown) as AnyObj).__sharedFacingTweenPatchInstalled = true;
}

interface SyncIconOptions {
  side?: string;
  offsetX?: number;
  offsetY?: number;
  depthOffset?: number;
}

export function syncSharedUnitIconToSprite(unit: AnyObj, options: SyncIconOptions = {}): void {
  const sprite = unit?.sprite as DisplayLike | undefined;
  if (!sprite?.active) return;
  const stackEntries = getSharedUnitStackEntries(unit);
  if (!stackEntries.length) return;
  stackEntries.forEach((entry) => {
    const icon = entry?.target;
    if (!icon?.active) return;
    const x = (sprite.x ?? 0) + (options.offsetX ?? 0) + (entry.currentOffsetX ?? entry.offsetX ?? 0);
    const y = (sprite.y ?? 0) + (options.offsetY ?? -10) + (entry.currentOffsetY ?? entry.offsetY ?? 0);
    setDisplayPosition(icon, x, y);
    applySharedUnitFacing(icon, options.side ?? ((unit as AnyObj).side as string));
    if (typeof icon.setDepth === "function") {
      icon.setDepth((sprite.y ?? 0) + (options.depthOffset ?? 12) + (entry.depthOffset ?? 0));
    }
  });
}

interface DeathPoseOptions {
  delayMs?: number;
  side?: string;
  fallAngle?: number;
  fallXOffset?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
  depthOffset?: number;
}

export function stabilizeSharedDeathPose(scene: SceneLike | null | undefined, unit: AnyObj, options: DeathPoseOptions = {}): void {
  if (!scene || !unit?.icon || !unit?.sprite) return;
  const uAny = unit as AnyObj;
  const deathPoseCall = uAny.__sharedDeathPoseCall as { remove?: () => void } | null | undefined;
  if (deathPoseCall) deathPoseCall.remove?.();
  const timeObj = (scene as unknown as AnyObj).time as { delayedCall?: (ms: number, cb: () => void) => unknown } | undefined;
  if (!timeObj?.delayedCall) return;
  const delayedHandle = timeObj.delayedCall(scaleDuration(scene, options.delayMs ?? 360), () => {
    uAny.__sharedDeathPoseCall = null;
    const sprite = unit?.sprite as DisplayLike | undefined;
    if (!sprite?.active) return;
    const isRight = (options.side ?? (uAny).side) === "RIGHT";
    const fallAngle = options.fallAngle ?? (isRight ? -90 : 90);
    const baseFallXOffset = options.fallXOffset ?? (isRight ? -5 : 5);
    forEachSharedUnitVisual(unit, (icon, _index, entry) => {
      const y = (sprite.y ?? 0) + (options.offsetY ?? 2) + (entry.currentOffsetY ?? entry.offsetY ?? 0);
      const x = (sprite.x ?? 0) + baseFallXOffset + (entry.currentOffsetX ?? entry.offsetX ?? 0);
      setDisplayPosition(icon, x, y);
      setDisplayScale(icon, (options.scaleX ?? 0.96) * (entry?.scale ?? 1), (options.scaleY ?? 0.8) * (entry?.scale ?? 1));
      applySharedUnitFacing(icon, options.side ?? ((uAny).side as string));
      setDisplayAngle(icon, fallAngle);
      setDisplayAlpha(icon, Math.min(entry?.baseAlpha ?? 0.84, options.alpha ?? 0.84));
      if (typeof icon.setDepth === "function") {
        icon.setDepth((sprite.y ?? 0) + (options.depthOffset ?? 12) + (entry.depthOffset ?? 0));
      }
    });
  });
  uAny.__sharedDeathPoseCall = delayedHandle as { remove?: () => void } | null;
}

interface SkillTheme {
  key: "impact" | "assault" | "control" | "support" | "dot" | "aoe";
  tag: string;
  textColor: string;
  strokeColor: string;
  ringColor: number;
  accentColor: number;
  shakeMs: number;
  shakeIntensity: number;
}

interface SkillLike extends AnyObj {
  effect?: string;
  name?: string;
  effectLabel?: string;
}

const SKILL_THEMES: Record<SkillTheme["key"], SkillTheme> = {
  impact: {
    key: "impact",
    tag: "TUNG CHIÊU",
    textColor: "#ffe9ae",
    strokeColor: "#4a2c0d",
    ringColor: 0xffc95a,
    accentColor: 0xff8d4d,
    shakeMs: 120,
    shakeIntensity: 0.0035
  },
  assault: {
    key: "assault",
    tag: "CÔNG PHÁ",
    textColor: "#ffd8b0",
    strokeColor: "#522311",
    ringColor: 0xff9a5a,
    accentColor: 0xff5d3a,
    shakeMs: 155,
    shakeIntensity: 0.0048
  },
  control: {
    key: "control",
    tag: "KHỐNG CHẾ",
    textColor: "#e6d6ff",
    strokeColor: "#2b1843",
    ringColor: 0xb38dff,
    accentColor: 0x7c5aff,
    shakeMs: 145,
    shakeIntensity: 0.0042
  },
  support: {
    key: "support",
    tag: "HỖ TRỢ",
    textColor: "#d8ffe4",
    strokeColor: "#1b4530",
    ringColor: 0x62d692,
    accentColor: 0x8effb6,
    shakeMs: 95,
    shakeIntensity: 0.0024
  },
  dot: {
    key: "dot",
    tag: "HIỆU ỨNG",
    textColor: "#e7ffa7",
    strokeColor: "#375017",
    ringColor: 0x95d84a,
    accentColor: 0x4f9b2f,
    shakeMs: 125,
    shakeIntensity: 0.0032
  },
  aoe: {
    key: "aoe",
    tag: "DIỆN RỘNG",
    textColor: "#d7f2ff",
    strokeColor: "#123d5f",
    ringColor: 0x67c8ff,
    accentColor: 0x3e8fff,
    shakeMs: 165,
    shakeIntensity: 0.0045
  }
};

const TRIBE_TONES: Record<string, { ringColor: number; accentColor: number }> = {
  FIRE: { ringColor: 0xff8b4f, accentColor: 0xff4f35 },
  WATER: { ringColor: 0x67d9ff, accentColor: 0x3db5f5 },
  TIDE: { ringColor: 0x67d9ff, accentColor: 0x3db5f5 },
  WIND: { ringColor: 0xa3efff, accentColor: 0x7dcfff },
  STONE: { ringColor: 0xd1b48a, accentColor: 0xb08b62 },
  THUNDER: { ringColor: 0xc798ff, accentColor: 0x9963ff },
  WOOD: { ringColor: 0x8bdc82, accentColor: 0x55b85c }
};

export function getSharedSkillCastTheme(skill: SkillLike, attacker: AnyObj): SkillTheme {
  const effect = String(skill?.effect ?? "").toLowerCase();
  const tribe = String(attacker?.tribe ?? "").toUpperCase();
  const has = (keywords: string[]): boolean => keywords.some((k) => effect.includes(k));

  let key: SkillTheme["key"] = "impact";
  if (has(["heal", "shield", "hot", "protect", "guard", "buff", "revive", "cleanse", "rage", "aura"])) {
    key = "support";
  } else if (has(["stun", "freeze", "sleep", "silence", "taunt", "fear", "disarm", "lock", "paraly"])) {
    key = "control";
  } else if (has(["poison", "bleed", "burn", "disease", "toxic", "dot"])) {
    key = "dot";
  } else if (has(["global", "aoe", "row", "column", "cone", "multi"])) {
    key = "aoe";
  } else if (has(["charge", "pierce", "burst", "smash", "quake", "strike", "headbutt"])) {
    key = "assault";
  }

  const base: SkillTheme = { ...SKILL_THEMES[key] };
  const tribeTone = TRIBE_TONES[tribe];
  if (tribeTone) {
    base.ringColor = tribeTone.ringColor;
    base.accentColor = tribeTone.accentColor;
  }
  return base;
}

export function playSharedSkillCastPresentation(
  scene: SceneLike | null | undefined,
  attacker: AnyObj,
  target: AnyObj | null | undefined,
  skill: SkillLike
): void {
  const sAny = scene as AnyObj | null | undefined;
  const tweensObj = (scene as SceneLike | null | undefined)?.tweens as {
    add?: (config: AnyObj) => Phaser.Tweens.Tween | null;
  } | null | undefined;
  const timeObj = sAny?.time as { delayedCall?: (ms: number, cb: () => void) => unknown } | undefined;
  const cameras = sAny?.cameras as { main?: { shake?: (ms: number, intensity: number) => void } } | undefined;

  const attackerSprite = attacker?.sprite as DisplayLike | undefined;
  if (!attackerSprite?.active || !scene?.add) return;
  const sx = (attackerSprite?.x ?? 0);
  const sy = (attackerSprite?.y ?? 0) - 10;
  const targetSprite = target?.sprite as DisplayLike | undefined;
  const tx = targetSprite?.x ?? sx;
  const ty = (targetSprite?.y ?? attackerSprite?.y ?? 0) - 10;
  const theme = getSharedSkillCastTheme(skill, attacker);
  const accentHex = `#${theme.accentColor.toString(16).padStart(6, "0")}`;
  const skillName = String(skill?.name ?? "KỸ NĂNG").toUpperCase();
  const subText = String(skill?.effectLabel ?? theme.tag ?? "").toUpperCase();
  const durationIn = scaleDuration(scene, 130);
  const durationOut = scaleDuration(scene, 240);

  if (cameras?.main?.shake) {
    cameras.main.shake(scaleDuration(scene, theme.shakeMs), theme.shakeIntensity);
  }

  pulseAt(scene, null, sx, sy, theme.ringColor, 18, scaleDuration(scene, 260));
  if (target?.sprite && target !== attacker) {
    pulseAt(scene, null, tx, ty, theme.accentColor, 16, scaleDuration(scene, 220));
  }

  const fxRoot = scene.add.container(0, 0);
  fxRoot.setDepth(8610);
  if (Array.isArray(sAny?.combatSprites)) {
    (sAny!.combatSprites as unknown[]).push(fxRoot);
  }

  const boxW = Phaser.Math.Clamp(120 + skillName.length * 9, 140, 340);
  const bannerBg = scene.add.rectangle(sx, sy - 56, boxW, 26, 0x000000, 0.42);
  bannerBg.setStrokeStyle(2, theme.ringColor, 0.95);
  const mainLabel = scene.add.text(sx, sy - 56, `✦ ${skillName} ✦`, {
    fontFamily: UI_FONT,
    fontSize: "16px",
    fontStyle: "bold",
    color: theme.textColor,
    stroke: theme.strokeColor,
    strokeThickness: 6
  }).setOrigin(0.5).setScale(0.68).setAlpha(0);
  const subLabel = scene.add.text(sx, sy - 34, subText, {
    fontFamily: UI_FONT,
    fontSize: "11px",
    fontStyle: "bold",
    color: accentHex,
    stroke: "#0f172a",
    strokeThickness: 4
  }).setOrigin(0.5).setAlpha(0);
  fxRoot.add([bannerBg, mainLabel, subLabel]);

  tweensObj?.add?.({
    targets: [mainLabel, subLabel, bannerBg],
    alpha: 1,
    duration: durationIn,
    ease: "Sine.out"
  });
  tweensObj?.add?.({
    targets: mainLabel,
    scale: 1.0,
    y: sy - 60,
    duration: durationIn,
    ease: "Back.out"
  });
  tweensObj?.add?.({
    targets: [mainLabel, subLabel, bannerBg],
    alpha: 0,
    y: "-=14",
    delay: scaleDuration(scene, 430),
    duration: durationOut,
    ease: "Cubic.out"
  });

  const spawnBurst = (x: number, y: number, color: number, count: number, radius: number = 46, rise: number = 18): void => {
    const pool = sAny?.fxPool as {
      acquireCircle: (x: number, y: number, radius: number, color: number, alpha: number, depth: number) => Phaser.GameObjects.Arc | null;
      tween: (target: Phaser.GameObjects.Arc, config: AnyObj, key: string) => void;
    } | undefined;
    for (let i = 0; i < count; i += 1) {
      const dotRadius = 2 + Math.random() * 2;
      const dot = pool?.acquireCircle(x, y, dotRadius, color, 0.9, 8612) ?? scene!.add.circle(x, y, dotRadius, color, 0.9);
      if (!pool) dot.setDepth(8612);
      fxRoot.add(dot);
      const ang = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * radius;
      const tweenConfig: AnyObj = {
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist - Math.random() * rise,
        alpha: 0,
        scale: 0.45,
        duration: scaleDuration(scene, 260 + Math.random() * 180),
        ease: "Cubic.out"
      };
      if (pool) {
        pool.tween(dot, tweenConfig, "circle");
      } else {
        tweenConfig.onComplete = () => dot.destroy();
        tweensObj?.add?.({
          targets: dot,
          ...tweenConfig
        });
      }
    }
  };

  spawnBurst(sx, sy - 6, theme.ringColor, 10);
  if (target?.sprite && target !== attacker) spawnBurst(tx, ty - 2, theme.accentColor, 8, 36, 12);

  if (theme.key === "assault") {
    pulseAt(scene, fxRoot, tx, ty, theme.accentColor, 14, scaleDuration(scene, 220), 0.3);
  } else if (theme.key === "control") {
    for (let i = 0; i < 3; i += 1) {
      const ring = scene.add.circle(tx, ty, 14 + i * 7, theme.ringColor, 0.12);
      ring.setStrokeStyle(2, theme.accentColor, 0.85);
      ring.setDepth(8611);
      fxRoot.add(ring);
      tweensObj?.add?.({
        targets: ring,
        angle: 180 * (i % 2 === 0 ? 1 : -1),
        alpha: 0,
        scale: 1.35,
        duration: scaleDuration(scene, 260 + i * 40),
        ease: "Sine.out",
        onComplete: () => ring.destroy()
      });
    }
  } else if (theme.key === "support") {
    for (let i = 0; i < 4; i += 1) {
      const plus = scene.add.text(sx + Phaser.Math.Between(-26, 26), sy + Phaser.Math.Between(-22, 8), "✚", {
        fontFamily: UI_FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: theme.textColor,
        stroke: "#163123",
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(8612).setAlpha(0.9);
      fxRoot.add(plus);
      tweensObj?.add?.({
        targets: plus,
        y: plus.y - Phaser.Math.Between(16, 28),
        alpha: 0,
        scale: 0.6,
        duration: scaleDuration(scene, 300 + i * 40),
        ease: "Sine.out",
        onComplete: () => plus.destroy()
      });
    }
  } else if (theme.key === "dot") {
    for (let i = 0; i < 8; i += 1) {
      const drop = scene.add.circle(tx + Phaser.Math.Between(-20, 20), ty - Phaser.Math.Between(6, 20), 2.5, theme.accentColor, 0.9);
      drop.setDepth(8612);
      fxRoot.add(drop);
      tweensObj?.add?.({
        targets: drop,
        y: drop.y + Phaser.Math.Between(14, 26),
        x: drop.x + Phaser.Math.Between(-6, 6),
        alpha: 0,
        duration: scaleDuration(scene, 260 + i * 20),
        ease: "Cubic.in",
        onComplete: () => drop.destroy()
      });
    }
  } else if (theme.key === "aoe") {
    for (let i = 0; i < 2; i += 1) {
      const ring = scene.add.circle(tx, ty, 24 + i * 12, theme.ringColor, 0.16);
      ring.setStrokeStyle(3, theme.accentColor, 0.75);
      ring.setDepth(8611);
      fxRoot.add(ring);
      tweensObj?.add?.({
        targets: ring,
        scale: 1.9,
        alpha: 0,
        duration: scaleDuration(scene, 280 + i * 80),
        ease: "Cubic.out",
        onComplete: () => ring.destroy()
      });
    }
  }

  timeObj?.delayedCall?.(scaleDuration(scene, 1200), () => {
    if (fxRoot?.active) fxRoot.destroy();
  });
}

// Hit accent + Low HP effects extracted to sceneHitLowHpRuntime.js
export {
  playSharedUnitHitAccent,
  playSharedUnitHitJolt,
  ensureSharedLowHpAccent,
  clearSharedLowHpAccent
} from './sceneHitLowHpRuntime.js';