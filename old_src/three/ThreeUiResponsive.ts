/**
 * Responsive UI helpers for the Three.js backend (Forest Throne).
 *
 * Parity port of `src/core/uiResponsive.ts` WITHOUT any Phaser dependency.
 * Logic, thresholds, tables and exported names are identical; the only
 * difference is the scene parameter type: instead of `Phaser.Scene` this
 * module accepts any object with an optional canvas and optional scale size
 * (`ThreeUiSceneLike`), which both Phaser scenes (structural) and Three.js
 * hosts can satisfy.
 *
 * Migration rule: do NOT delete `src/core/uiResponsive.ts` until it has zero
 * importers left (see docs/phaser-three-migration-rule.md).
 */

interface NavigatorData {
  readonly mobile?: boolean;
  readonly tablet?: boolean;
  readonly desktop?: boolean;
}

interface WindowLike {
  readonly navigator: Navigator;
  readonly matchMedia: (query: string) => MediaQueryList | null;
  readonly visualViewport: VisualViewport | null;
  readonly ontouchstart: unknown;
}

interface NavigatorLike {
  readonly userAgent: string;
  readonly userAgentData?: NavigatorData | null;
  readonly maxTouchPoints: number;
}

/** Minimal structural view of a render host. Phaser scenes satisfy this
 * structurally via `sys.game.canvas` / `scale`; Three.js hosts pass
 * `{ game: { canvas } }` and/or `{ scale: { width, height } }`. */
export interface ThreeUiSceneLike {
  readonly sys?: {
    readonly game?: {
      readonly canvas?: {
        readonly getBoundingClientRect?: () => { readonly width?: number; readonly height?: number } | null;
      } | null;
    } | null;
  } | null;
  readonly game?: {
    readonly canvas?: {
      readonly getBoundingClientRect?: () => { readonly width?: number; readonly height?: number } | null;
    } | null;
  } | null;
  readonly scale?: { readonly width?: number; readonly height?: number } | null;
}

type UiScene = ThreeUiSceneLike;

function isWindowLike(value: unknown): value is WindowLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "navigator" in value &&
    "visualViewport" in value
  );
}

function hasNavigatorData(
  nav: NavigatorLike | null
): nav is NavigatorLike & { userAgentData: NavigatorData } {
  return (
    nav != null &&
    typeof nav === "object" &&
    "userAgentData" in nav &&
    nav.userAgentData != null &&
    typeof nav.userAgentData === "object"
  );
}

function hasMatchMedia(
  win: WindowLike | null
): win is WindowLike & { matchMedia: (q: string) => MediaQueryList } {
  return win != null && typeof win.matchMedia === "function";
}

function readCanvasRect(scene: UiScene | null | undefined) {
  const canvas = scene?.sys?.game?.canvas ?? scene?.game?.canvas ?? null;
  return canvas?.getBoundingClientRect?.() ?? null;
}

function readMatchMediaFlag(query: string) {
  const win = typeof window !== "undefined" && isWindowLike(window) ? window : null;
  const mediaWindow = win != null ? win : null;
  if (mediaWindow == null || !hasMatchMedia(mediaWindow)) return false;
  try {
    return Boolean(mediaWindow.matchMedia(query)?.matches);
  } catch {
    return false;
  }
}

function readNavigatorState() {
  const nav: NavigatorLike | null =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { userAgentData?: unknown })
      : typeof window !== "undefined" && isWindowLike(window)
        ? window.navigator
        : null;

  const userAgent = `${nav?.userAgent ?? ""}`;
  const maxTouchPoints = Number.isFinite(nav?.maxTouchPoints) ? nav!.maxTouchPoints : 0;
  const coarsePointer =
    readMatchMediaFlag("(pointer: coarse)") || readMatchMediaFlag("(any-pointer: coarse)");
  const hoverNone =
    readMatchMediaFlag("(hover: none)") || readMatchMediaFlag("(any-hover: none)");
  const hasTouchEvents =
    typeof window !== "undefined" && isWindowLike(window) && "ontouchstart" in window;
  const uaMobile =
    (hasNavigatorData(nav) && nav.userAgentData.mobile === true) ||
    /Android.+Mobile|iPhone|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent);
  const uaTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
  return {
    maxTouchPoints,
    coarsePointer,
    hoverNone,
    hasTouchEvents,
    uaMobile,
    uaTablet
  };
}

function readViewportSize(scene: UiScene | null | undefined) {
  const rect = readCanvasRect(scene);
  const win = typeof window !== "undefined" && isWindowLike(window) ? window : null;
  const viewport: VisualViewport | null = win ? win.visualViewport ?? null : null;
  const rectWidth = Number.isFinite(rect?.width) && (rect?.width ?? 0) > 0 ? rect!.width : null;
  const rectHeight =
    Number.isFinite(rect?.height) && (rect?.height ?? 0) > 0 ? rect!.height : null;
  const viewportWidth =
    Number.isFinite(viewport?.width) && (viewport?.width ?? 0) > 0 ? viewport!.width : null;
  const viewportHeight =
    Number.isFinite(viewport?.height) && (viewport?.height ?? 0) > 0
      ? viewport!.height
      : null;
  const scaleWidth =
    Number.isFinite(scene?.scale?.width) && (scene?.scale?.width ?? 0) > 0
      ? (scene?.scale?.width as number)
      : null;
  const scaleHeight =
    Number.isFinite(scene?.scale?.height) && (scene?.scale?.height ?? 0) > 0
      ? (scene?.scale?.height as number)
      : null;

  return {
    width: rectWidth ?? viewportWidth ?? scaleWidth ?? 1600,
    height: rectHeight ?? viewportHeight ?? scaleHeight ?? 900
  };
}

function asPxNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

type ProfileKey = "desktop" | "narrow" | "mobile";
type RoleKey = "title" | "body" | "label" | "button" | "caption" | "tooltipTitle" | "tooltipBody";

const ROLE_MIN_FONT: Record<ProfileKey, Record<RoleKey, number>> = {
  desktop: {
    title: 18,
    body: 12,
    label: 11,
    button: 14,
    caption: 10,
    tooltipTitle: 14,
    tooltipBody: 12
  },
  narrow: {
    title: 20,
    body: 13,
    label: 12,
    button: 15,
    caption: 11,
    tooltipTitle: 16,
    tooltipBody: 13
  },
  mobile: {
    title: 22,
    body: 14,
    label: 13,
    button: 16,
    caption: 12,
    tooltipTitle: 18,
    tooltipBody: 15
  }
};

function getRoleMinFont(profile: ProfileKey, role: RoleKey) {
  const table = ROLE_MIN_FONT[profile] ?? ROLE_MIN_FONT.desktop;
  return table[role] ?? table.body;
}

function getDampenedFontScale(basePx: number, textScale: number) {
  if (!Number.isFinite(basePx) || basePx <= 0) return textScale;
  if (basePx <= 14) return textScale;
  if (basePx <= 20) return 1 + (textScale - 1) * 0.72;
  return 1 + (textScale - 1) * 0.45;
}

export function getUiViewportMetrics(scene: UiScene | null | undefined) {
  const { width, height } = readViewportSize(scene);
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

export function getUiDeviceContext(scene: UiScene | null | undefined) {
  const { width, height } = getUiViewportMetrics(scene);
  const navState = readNavigatorState();
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const isPortrait = height >= width;
  const isTouchDevice =
    navState.maxTouchPoints > 0 ||
    navState.coarsePointer ||
    (navState.hasTouchEvents && (navState.uaMobile || navState.uaTablet || navState.hoverNone));
  const handheldByViewport = isTouchDevice && shortSide <= 540 && longSide <= 1280;
  const portraitTouchHandheld = isTouchDevice && isPortrait && width <= 820;
  const handheld = navState.uaMobile || handheldByViewport || portraitTouchHandheld;
  const tabletByViewport =
    isTouchDevice &&
    !handheld &&
    (navState.coarsePointer || navState.uaTablet) &&
    shortSide <= 900 &&
    longSide <= 1400;
  const tablet = navState.uaTablet || tabletByViewport;
  return {
    width,
    height,
    shortSide,
    longSide,
    isPortrait,
    isTouchDevice,
    hasCoarsePointer: navState.coarsePointer,
    hoverNone: navState.hoverNone,
    handheld,
    tablet
  };
}

export function getUiViewportProfile(scene: UiScene | null | undefined) {
  const { width, height, handheld, tablet, isPortrait, isTouchDevice } = getUiDeviceContext(scene);
  if (width <= 600) return "mobile";
  if (handheld && isPortrait) return "mobile";
  if (isTouchDevice && isPortrait && width <= 820) return "mobile";
  if (width <= 960 || height <= 500) return "narrow";
  if (handheld || tablet) return "narrow";
  if (isTouchDevice && width <= 1180) return "narrow";
  return "desktop";
}

function getUiScaleTokens(scene: UiScene | null | undefined) {
  const profile = getUiViewportProfile(scene);
  const { handheld, tablet, isTouchDevice } = getUiDeviceContext(scene);
  if (profile === "mobile") {
    return {
      profile,
      textScale: handheld ? 1.34 : 1.28,
      controlScale: handheld ? 1.22 : 1.18,
      spacingScale: handheld ? 1.2 : 1.18,
      tooltipPaddingScale: handheld ? 1.22 : 1.18,
      minTouchTarget: handheld ? 50 : 48
    };
  }
  if (profile === "narrow") {
    const touchBoost = handheld || tablet || isTouchDevice;
    return {
      profile,
      textScale: touchBoost ? 1.2 : 1.15,
      controlScale: touchBoost ? 1.14 : 1.1,
      spacingScale: touchBoost ? 1.12 : 1.1,
      tooltipPaddingScale: touchBoost ? 1.14 : 1.1,
      minTouchTarget: touchBoost ? 46 : 44
    };
  }
  return {
    profile,
    textScale: 1,
    controlScale: 1,
    spacingScale: 1,
    tooltipPaddingScale: 1,
    minTouchTarget: 40
  };
}

export { getUiScaleTokens };

export function scaleUiSize(
  scene: UiScene | null | undefined,
  basePx: number | string | null | undefined,
  kind: "control" | "spacing" | "tooltipPadding" = "control"
) {
  const numeric = asPxNumber(basePx, 0);
  const tokens = getUiScaleTokens(scene);
  const factor =
    kind === "spacing"
      ? tokens.spacingScale
      : kind === "tooltipPadding"
        ? tokens.tooltipPaddingScale
        : tokens.controlScale;
  return Math.max(1, Math.round(numeric * factor));
}

export function scaleFontPx(
  scene: UiScene | null | undefined,
  basePx: number | string | null | undefined,
  role: RoleKey = "body"
) {
  const numeric = asPxNumber(basePx, 12);
  const tokens = getUiScaleTokens(scene);
  const scale = getDampenedFontScale(numeric, tokens.textScale);
  const minSize = getRoleMinFont(tokens.profile as ProfileKey, role);
  return `${Math.max(minSize, Math.round(numeric * scale))}px`;
}

export function getMinTouchTarget(scene: UiScene | null | undefined) {
  return getUiScaleTokens(scene).minTouchTarget;
}

export function shouldUsePinnedTooltip(scene: UiScene | null | undefined) {
  return getUiViewportProfile(scene) !== "desktop";
}
