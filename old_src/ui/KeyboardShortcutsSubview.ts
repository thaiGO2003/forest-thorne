import { UI_COLORS, UI_FONT } from "../core/uiTheme.js";
import {
  captureBindingFromKeyboardEvent,
  formatBindingBracket,
  getBindingActionLabel,
  getBindingActions,
  getContextKeyboardBindings,
  getBindingInfoLines,
  getKeyboardShortcutHelpText,
  resetKeyboardBindings,
  setKeyboardBinding
} from "../core/keyboardBindings.js";
import type { BindingAction, BindingContext } from "../core/keyboardBindings.js";
import { loadUiSettings } from "../core/uiSettings.js";
import type { UiSettings } from "../core/uiSettings.js";
import { scaleFontPx, scaleUiSize } from "../core/uiResponsive.js";
import { t } from "../i18n/index.js";
import type { Scene as PhaserScene } from "phaser";
import { safeSetText } from "./displayObjectGuards.js";

const LISTEN_FILL = 0x2a2410;
const LISTEN_EDGE = 0xf0c36e;
const ROW_FILL = 0x101c2a;
const ROW_EDGE = 0x2a3d52;

type ShortcutsScene = PhaserScene & Record<string, unknown>;

interface VisibilityTarget {
  shadow?: VisibilityTarget | null;
  bg?: VisibilityTarget | null;
  text?: VisibilityTarget | null;
  setVisible?: (v: boolean) => void;
  [key: string]: unknown;
}

interface RowButtonLike {
  setLabel?: (v: string) => void;
  text?: {
    setColor?: (v: string) => void;
    setOrigin?: (x: number, y: number) => void;
    setX?: (v: number) => void;
    setY?: (v: number) => void;
  };
  bg?: {
    setFillStyle?: (fill: number, alpha?: number) => void;
    setStrokeStyle?: (width: number, color: number, alpha?: number) => void;
    y?: number;
    x?: number;
  };
  x?: number;
  y?: number;
}

interface LayoutMetrics {
  sectionLabelOffset?: number;
  panelHalfH?: number;
  shortcutsContentW?: number;
}

interface RowButtonStyleOpts {
  listening?: boolean;
}

interface RowButtonLabelOpts {
  contentW: number;
  edgePad: number;
  rowH: number;
}

interface LayoutSizes {
  shortcutContext?: BindingContext;
  metrics?: LayoutMetrics;
  btnH?: number;
  gap?: number;
}

interface LayoutResult {
  rowH: number;
  bottomPad: number;
  topInset: number;
  hintBlock: number;
  bannerReserve: number;
  infoBlock: number;
  sectionLabelOffset: number;
  panelH: number;
  panelHalfH: number;
}

interface SubviewButton {
  setVisible?: (v: boolean) => void;
  setDepth?: (v: number) => void;
  setLabel?: (v: string) => void;
  active?: boolean;
  scene?: unknown;
  destroy?: () => void;
}

interface MakeSubviewButtonOpts {
  fontSize?: number | string;
  variant?: string;
}

interface WrapMenuButtonOpts {
  fontSize?: number | string;
  variant?: string;
}

interface BuildOptions {
  shortcutContext?: BindingContext;
  metrics?: LayoutMetrics;
  cx?: number;
  cy?: number;
  btnW?: number;
  btnH?: number;
  gap?: number;
  sectionGap?: number;
  depth?: number;
  container?: { add: (obj: unknown) => void; setDepth?: (v: number) => void; setVisible?: (v: boolean) => void } | null;
  makeSubviewButton?: (
    x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: MakeSubviewButtonOpts
  ) => SubviewButton;
  wrapMenuButton?: (
    scene: ShortcutsScene, x: number, y: number, w: number, h: number, label: string, onClick: () => void,
    container: unknown, opts: WrapMenuButtonOpts
  ) => SubviewButton;
  onBindingsChanged?: () => void;
  onBack?: () => void;
}

interface KeyboardShortcutsSubview {
  managedObjects: unknown[];
  buttons: {
    back: SubviewButton | null;
    reset: SubviewButton | null;
    rows: Record<string, SubviewButton>;
  };
  show: () => void;
  hide: () => void;
  refresh: (settings?: UiSettings) => void;
  destroy: () => void;
  getHelpText: (settings?: UiSettings) => string;
  getPanelHeight: () => number;
}

function collectVisibilityTargets(entries: unknown[]): VisibilityTarget[] {
  const targets: VisibilityTarget[] = [];
  entries.forEach((entry) => {
    if (!entry) return;
    const obj = entry as VisibilityTarget;
    if (obj.shadow || obj.bg || obj.text) {
      if (obj.shadow) targets.push(obj.shadow);
      if (obj.bg) targets.push(obj.bg);
      if (obj.text) targets.push(obj.text);
      return;
    }
    targets.push(obj);
  });
  return targets;
}

function setObjectsVisible(objects: unknown[], visible: boolean): void {
  collectVisibilityTargets(objects).forEach((entry) => {
    entry?.setVisible?.(visible);
  });
}

function formatActionRowLabel(actionLabel: string, binding: unknown, opts: { listening?: boolean } = {}): string {
  const keyPart = opts.listening ? t("settings.shortcutsWaitingKey") : formatBindingBracket(binding);
  return `${actionLabel}  ${keyPart}`;
}

function alignRowButtonLabel(btn: RowButtonLike, label: string, opts: RowButtonLabelOpts): void {
  btn?.setLabel?.(label);
  const text = btn?.text;
  if (typeof text?.setOrigin !== "function") return;
  text.setOrigin(0, 0.5);
  if (typeof text?.setX !== "function" || typeof text?.setY !== "function") return;
  const topY = typeof btn.y === "number" ? btn.y : (btn.bg?.y ?? 0) - opts.rowH / 2;
  const leftX = typeof btn.x === "number"
    ? btn.x + opts.edgePad
    : (btn.bg?.x ?? 0) - opts.contentW / 2 + opts.edgePad;
  text.setX(leftX);
  text.setY(topY + opts.rowH / 2);
}

function applyRowButtonStyle(btn: RowButtonLike | null, opts: RowButtonStyleOpts = {}): void {
  if (!btn?.bg) return;
  if (opts.listening) {
    btn.bg.setFillStyle?.(LISTEN_FILL, 0.98);
    btn.bg.setStrokeStyle?.(2, LISTEN_EDGE, 1);
    btn.text?.setColor?.("#ffeab0");
    return;
  }
  btn.bg.setFillStyle?.(ROW_FILL, 0.92);
  btn.bg.setStrokeStyle?.(1, ROW_EDGE, 0.85);
  btn.text?.setColor?.(UI_COLORS.textPrimary);
}

function getShortcutsLayoutSizes(scene: ShortcutsScene, opts: LayoutSizes = {}): LayoutResult {
  const shortcutContext = opts.shortcutContext ?? "planning";
  const metrics = opts.metrics;
  const btnH = opts.btnH ?? 0;
  const gap = opts.gap ?? 0;
  const actionCount = getBindingActions(shortcutContext).length;
  const rowH = scaleUiSize(scene, 36, "control");
  const bottomPad = scaleUiSize(scene, 20, "spacing");
  const topInset = scaleUiSize(scene, 52, "spacing");
  const hintBlock = scaleUiSize(scene, 22, "spacing");
  const bannerReserve = scaleUiSize(scene, 8, "spacing");
  const infoLines = getBindingInfoLines(shortcutContext).length;
  const infoLineH = scaleUiSize(scene, 12, "spacing");
  const infoBlock = Math.max(scaleUiSize(scene, 24, "spacing"), infoLines * infoLineH);
  const sectionLabelOffset = metrics?.sectionLabelOffset ?? scaleUiSize(scene, 18, "spacing");

  let panelH = topInset;
  panelH += sectionLabelOffset;
  panelH += hintBlock;
  panelH += bannerReserve;
  panelH += actionCount * rowH + Math.max(0, actionCount - 1) * gap;
  panelH += gap + infoBlock;
  panelH += gap + btnH;
  panelH += gap + btnH;
  panelH += bottomPad;

  return {
    rowH,
    bottomPad,
    topInset,
    hintBlock,
    bannerReserve,
    infoBlock,
    sectionLabelOffset,
    panelH,
    panelHalfH: panelH / 2
  };
}

export function computeKeyboardShortcutsPanelHeight(scene: ShortcutsScene, opts: LayoutSizes = {}): number {
  return getShortcutsLayoutSizes(scene, opts).panelH;
}

export function buildKeyboardShortcutsSubview(scene: ShortcutsScene, opts: BuildOptions = {}): KeyboardShortcutsSubview {
  const {
    shortcutContext = "planning",
    metrics,
    cx = 0,
    cy = 0,
    btnW = 0,
    btnH = 0,
    gap = 0,
    sectionGap,
    depth = 5002,
    container = null,
    makeSubviewButton,
    wrapMenuButton,
    onBindingsChanged,
    onBack
  } = opts;

  const layout = getShortcutsLayoutSizes(scene, {
    shortcutContext,
    metrics,
    btnH,
    gap
  });
  const panelHalfH = metrics?.panelHalfH ?? layout.panelHalfH;
  const panelH = layout.panelH;
  const contentW = Math.min(
    btnW,
    scaleUiSize(scene, metrics?.shortcutsContentW ?? 300, "control")
  );
  const isContainer = Boolean(container);
  const posX = (dx: number): number => (isContainer ? dx : cx + dx);
  const posY = (dy: number): number => (isContainer ? dy : cy + dy);
  const managedObjects: unknown[] = [];
  const rowEntries: Record<string, SubviewButton> = {};
  let listeningAction: BindingAction | null = null;
  let captureHandler: ((event: unknown) => void) | null = null;

  const register = (entry: unknown): unknown => {
    if (!entry) return entry;
    managedObjects.push(entry);
    if (!isContainer) (entry as { setVisible?: (v: boolean) => void })?.setVisible?.(false);
    if (isContainer && (entry as { setDepth?: (v: number) => void })?.setDepth && container) {
      container.add(entry);
    }
    return entry;
  };

  const makeRowButton = (centerY: number, label: string, onClick: () => void): SubviewButton => {
    const rowH = scaleUiSize(scene, 36, "control");
    if (makeSubviewButton) {
      const btn = makeSubviewButton(0, centerY, contentW, rowH, label, onClick, {
        fontSize: scaleFontPx(scene, 12, "body"),
        variant: "ghost"
      });
      btn?.setVisible?.(false);
      applyRowButtonStyle(btn as unknown as RowButtonLike);
      register(btn);
      return btn;
    }
    const btn = wrapMenuButton!(
      scene,
      posX(0),
      posY(centerY),
      contentW,
      rowH,
      label,
      onClick,
      container,
      { fontSize: scaleFontPx(scene, 12, "body") }
    );
    register(btn);
    applyRowButtonStyle(btn as unknown as RowButtonLike);
    return btn;
  };

  const makeFooterButton = (centerY: number, label: string, onClick: () => void, buttonOpts: WrapMenuButtonOpts = {}): SubviewButton => {
    if (makeSubviewButton) {
      const btn = makeSubviewButton(0, centerY, contentW, btnH, label, onClick, buttonOpts);
      btn?.setVisible?.(false);
      register(btn);
      return btn;
    }
    return wrapMenuButton!(scene, posX(0), posY(centerY), contentW, btnH, label, onClick, container, buttonOpts);
  };

  const {
    rowH,
    bottomPad,
    topInset,
    hintBlock,
    bannerReserve,
    infoBlock,
    sectionLabelOffset
  } = layout;
  const edgePad = scaleUiSize(scene, 10, "spacing");

  let curY = -panelHalfH + topInset;

  const title = register(scene.add.text(posX(0), posY(curY), t("settings.shortcutsModalTitle"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 18, "title"),
    color: "#ffeab0",
    fontStyle: "bold"
  }));
  (title as { setOrigin?: (x?: number, y?: number) => void; setDepth?: (v: number) => void })?.setOrigin?.(0.5);
  (title as { setDepth?: (v: number) => void })?.setDepth?.(isContainer ? 6 : depth);
  curY += sectionLabelOffset;

  const hintText = register(scene.add.text(posX(0), posY(curY), t("settings.shortcutsRebindHint"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 11, "caption"),
    color: UI_COLORS.textMuted,
    align: "center",
    wordWrap: { width: contentW }
  }));
  (hintText as { setOrigin?: (x: number, y: number) => void; setDepth?: (v: number) => void })?.setOrigin?.(0.5, 0);
  (hintText as { setDepth?: (v: number) => void })?.setDepth?.(isContainer ? 6 : depth);
  curY += hintBlock;

  const listeningBanner = register(scene.add.text(posX(0), posY(curY), "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 11, "label"),
    color: "#ffeab0",
    align: "center",
    fontStyle: "bold",
    wordWrap: { width: contentW }
  }));
  (listeningBanner as { setOrigin?: (x: number, y: number) => void; setDepth?: (v: number) => void })?.setOrigin?.(0.5, 0);
  (listeningBanner as { setDepth?: (v: number) => void })?.setDepth?.(isContainer ? 6 : depth);
  (listeningBanner as { setVisible?: (v: boolean) => void })?.setVisible?.(false);
  curY += bannerReserve;

  const actions = getBindingActions(shortcutContext);
  actions.forEach((action) => {
    const bindings = getContextKeyboardBindings(shortcutContext);
    const rowCenterY = curY + rowH / 2;
    const actionLabel = getBindingActionLabel(shortcutContext, action);
    const rowBtn = makeRowButton(
      rowCenterY,
      formatActionRowLabel(actionLabel, bindings[action]),
      () => startListening(action)
    );
    alignRowButtonLabel(rowBtn as unknown as RowButtonLike, formatActionRowLabel(actionLabel, bindings[action]), {
      contentW,
      edgePad,
      rowH
    });

    rowEntries[action] = rowBtn;
    curY += rowH + gap;
  });

  const infoLines = getBindingInfoLines(shortcutContext);
  curY += gap;
  const infoTop = curY;
  const infoText = register(scene.add.text(posX(0), posY(infoTop), infoLines.map((line: string) => `• ${line}`).join("\n"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 10, "caption"),
    color: UI_COLORS.textMuted,
    align: "center",
    lineSpacing: scaleUiSize(scene, 2, "spacing"),
    wordWrap: { width: contentW }
  }));
  (infoText as { setOrigin?: (x: number, y: number) => void; setDepth?: (v: number) => void })?.setOrigin?.(0.5, 0);
  (infoText as { setDepth?: (v: number) => void })?.setDepth?.(isContainer ? 6 : depth);
  curY += infoBlock;

  const resetY = curY + btnH / 2;
  const resetBtn = makeFooterButton(resetY, t("settings.shortcutsReset"), () => {
    resetKeyboardBindings(shortcutContext);
    refreshRows();
    onBindingsChanged?.();
  });
  curY += btnH + gap;

  const backY = curY + btnH / 2;
  const backBtn = makeFooterButton(backY, t("settings.shortcutsBack"), () => {
    stopListening();
    onBack?.();
  }, { variant: "primary" });

  function refreshRows(settings: UiSettings = loadUiSettings()) {
    const bindings = getContextKeyboardBindings(shortcutContext, settings);
    actions.forEach((action) => {
      const listening = listeningAction === action;
      const actionLabel = getBindingActionLabel(shortcutContext, action);
      const rowLabel = formatActionRowLabel(actionLabel, bindings[action], { listening });
      applyRowButtonStyle(rowEntries[action] as unknown as RowButtonLike | null, { listening });

      alignRowButtonLabel(rowEntries[action] as unknown as RowButtonLike, rowLabel, {
        contentW,
        edgePad,
        rowH
      });
    });
    const listeningLabel = listeningAction
      ? getBindingActionLabel(shortcutContext, listeningAction)
      : "";
    safeSetText(
      listeningBanner,
      listeningAction ? t("settings.shortcutsListeningBanner", { action: listeningLabel }) : ""
    );
    (listeningBanner as { setVisible?: (v: boolean) => void })?.setVisible?.(Boolean(listeningAction));
    safeSetText(
      hintText,
      listeningAction ? t("settings.shortcutsListening", { action: listeningLabel }) : t("settings.shortcutsRebindHint")
    );
    safeSetText(infoText, getBindingInfoLines(shortcutContext).map((line: string) => `• ${line}`).join("\n"));
    safeSetText(title, t("settings.shortcutsModalTitle"));
    backBtn?.setLabel?.(t("settings.shortcutsBack"));
    resetBtn?.setLabel?.(t("settings.shortcutsReset"));
  }

  function stopListening() {
    if (captureHandler && scene.input?.keyboard) {
      scene.input.keyboard.off("keydown", captureHandler);
    }
    captureHandler = null;
    listeningAction = null;
    refreshRows();
  }

  function startListening(action: BindingAction) {
    stopListening();
    listeningAction = action;
    refreshRows();
    captureHandler = (event: unknown) => {
      const evt = event as { key?: string; preventDefault?: () => void; stopPropagation?: () => void };
      if (evt?.key === "Escape") {
        evt.preventDefault?.();
        evt.stopPropagation?.();
        stopListening();
        return;
      }
      const binding = captureBindingFromKeyboardEvent(event);
      if (!binding) return;
      evt.preventDefault?.();
      evt.stopPropagation?.();
      setKeyboardBinding(shortcutContext, action, binding);
      stopListening();
      refreshRows();
      onBindingsChanged?.();
    };
    scene.input?.keyboard?.on("keydown", captureHandler);
  }

  const subview: KeyboardShortcutsSubview = {
    managedObjects,
    buttons: {
      back: backBtn,
      reset: resetBtn,
      rows: rowEntries
    },
    show() {
      setObjectsVisible(managedObjects, true);
      refreshRows();
    },
    hide() {
      stopListening();
      setObjectsVisible(managedObjects, false);
    },
    refresh(settings = loadUiSettings()) {
      refreshRows(settings);
    },
    destroy() {
      stopListening();
    },
    getHelpText(settings = loadUiSettings()) {
      return getKeyboardShortcutHelpText(shortcutContext, settings);
    },
    getPanelHeight() {
      return panelH;
    }
  };

  subview.hide();
  return subview;
}
