/**
 * SettingsPanel.ts
 *
 * Shared settings panel component used by both MainMenuScene and PlanningScene.
 * Builds a grouped, sectioned settings UI with dividers, icons, and auto-layout.
 */

import { UI_FONT, UI_COLORS } from "../core/uiTheme.js";
import { normalizeTooltipMode, resolveResolution } from "../core/uiSettings.js";
import { loadProgress } from "../core/persistence.js";
import { getLoseConditionLabel } from "../core/gameRules.js";
import {
    getMinTouchTarget,
    getUiViewportProfile,
    scaleFontPx,
    scaleUiSize
} from "../core/uiResponsive.js";
import { getLocaleLabel, t } from "../i18n/index.js";
import {
    isDisplayObjectAlive,
    isRenderableText,
    safeSetText
} from "./displayObjectGuards.js";
import {
    buildSettingsStepperRow,
    getSettingsStepperMetrics
} from "./SettingsStepperControls.js";
import {
    buildKeyboardShortcutsSubview,
    computeKeyboardShortcutsPanelHeight
} from "./KeyboardShortcutsSubview.js";
import type { BindingContext } from "../core/keyboardBindings.js";

type PhaserScene = Phaser.Scene;
type Rectangle = Phaser.GameObjects.Rectangle;
type Text = Phaser.GameObjects.Text;
type Container = Phaser.GameObjects.Container;
type DisplayObject = Phaser.GameObjects.GameObject;
type RenderableText = Phaser.GameObjects.Text;
type UiSceneArg = Parameters<typeof getUiViewportProfile>[0];

interface MenuButton {
  bg: Rectangle;
  text: Text;
  shadow?: Rectangle;
  enabled: boolean;
  setLabel(value: string): MenuButton;
  setEnabled(enabled: boolean): MenuButton;
  setVisible(value: boolean): MenuButton;
}

interface StepperButtonLike {
  bg: Rectangle;
  text: Text;
}

interface StepperResult {
  down: StepperButtonLike;
  center: StepperButtonLike;
  up: StepperButtonLike;
}

interface PanelMetrics {
  profile: string;
  gap: number;
  sectionGap: number;
  btnH: number;
  stepSide: number;
  panelW: number;
  btnW: number;
  btnSm: number;
  stepMid: number;
  stackFooter: boolean;
  sectionLabelOffset: number;
  titleFontSize: string;
  sectionFontSize: string;
  buttonFontSize: string;
  shortcutsContentW: number;
  shortcutsPanelW: number;
}

interface SettingsCallbacks {
  toggleAudio?: () => void;
  changeVolume?: (delta: number) => void;
  changeLanguage?: () => void;
  changeResolution?: (delta: number) => void;
  changeTooltip?: (delta: number) => void;
  changeSubtitle?: () => void;
  exportJson?: () => void;
  importJson?: () => void;
  clear?: () => void;
  exitPlanning?: () => void;
  goMainMenu?: () => void;
  close?: () => void;
}

interface BuildSettingsOpts {
  context: "menu" | "ingame";
  createButton?: CreateButtonFn;
  callbacks?: SettingsCallbacks;
  hideProgress?: boolean;
  shortcutContext?: BindingContext;
}

interface CreateButtonOpts {
  variant?: string;
  fontSize?: string | number;
  textRole?: string;
}

type CreateButtonFn = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts?: CreateButtonOpts
) => MenuButton;

type MakeStepperButton = (x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts?: Record<string, unknown>) => unknown;

interface ShortcutsEntryArgs {
  scene: PhaserScene;
  cx: number;
  cy: number;
  curY: number;
  BTN_W: number;
  BTN_H: number;
  metrics: PanelMetrics;
  overlay: DisplayObject[];
  container: Container | null;
  shortcutContext?: BindingContext;
  depth?: number;
  panelHalfH?: number;
  panelResize?: { panel: Rectangle; panelOuter: Rectangle; defaultW: number; defaultH: number } | null;
  makeButton?: (x: number, y: number, w: number, h: number, label: string, onClick: () => void) => MenuButton;
  makeSubviewButton?: (x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts?: CreateButtonOpts) => MenuButton;
  wrapMenuButton?: typeof wrapMenuButton;
  mainVisibilityTargets: Array<DisplayObject | MenuButton | Text | Rectangle | null>;
  onBindingsChanged?: () => void;
}

interface ShortcutsSubview {
  show?: () => void;
  hide?: () => void;
  refresh?: (settings: unknown) => void;
  getPanelHeight?: () => number;
}

interface ShortcutsEntryResult {
  curY: number;
  sectionLabel: Text;
  divider: Rectangle;
  openButton: MenuButton;
  shortcutsSubview: ShortcutsSubview | null;
  getShortcutsSubview: () => ShortcutsSubview | null;
  finalizeShortcutsSubview: (panelHalfH?: number) => void;
  openShortcutsView: () => void;
  closeShortcutsView: () => void;
  isShortcutsOpen: () => boolean;
}

export interface BuildSettingsResult {
  buttons: Record<string, MenuButton>;
  container?: Container;
  overlay?: DisplayObject[];
  refresh: (settings?: unknown, audioFx?: unknown) => void;
  closeShortcutsView: () => void;
  isShortcutsViewOpen: () => boolean;
}

/* ─── Layout constants ────────────────────────────────────────────────── */
const PANEL_W_MAX = 680;
const PANEL_W_MIN = 360;
const BTN_W_MAX = 500;
const BTN_W_MIN = 280;
const BTN_SM_MIN = 132;
const BTN_H = 40;
const GAP = 8;
const SECTION_GAP = 16;

function getPanelMetrics(scene: PhaserScene): PanelMetrics {
    const uiScene = scene as unknown as UiSceneArg;
    const viewportWidth = Math.max(360, scene?.scale?.width ?? PANEL_W_MAX);
    const profile = getUiViewportProfile(uiScene);
    const gap = scaleUiSize(uiScene, GAP, "spacing");
    const sectionGap = scaleUiSize(uiScene, SECTION_GAP, "spacing");
    const btnH = Math.max(getMinTouchTarget(uiScene), scaleUiSize(uiScene, BTN_H, "control"));
    const panelW = Math.max(
        scaleUiSize(uiScene, PANEL_W_MIN, "control"),
        Math.min(scaleUiSize(uiScene, PANEL_W_MAX, "control"), viewportWidth - scaleUiSize(uiScene, 48, "spacing"))
    );
    const btnW = Math.max(
        scaleUiSize(uiScene, BTN_W_MIN, "control"),
        Math.min(scaleUiSize(uiScene, BTN_W_MAX, "control"), panelW - scaleUiSize(uiScene, 96, "spacing"))
    );
    const btnSm = profile === "mobile"
        ? btnW
        : Math.max(scaleUiSize(uiScene, BTN_SM_MIN, "control"), Math.floor((btnW - gap - 4) / 2));
    const stepper = getSettingsStepperMetrics(uiScene, btnW, btnH, gap);
    const stackFooter = profile === "mobile" || btnSm * 2 + gap > btnW;
    return {
        profile,
        gap,
        sectionGap,
        btnH,
        stepSide: stepper.sideWidth,
        panelW,
        btnW,
        btnSm,
        stepMid: stepper.centerWidth,
        stackFooter,
        sectionLabelOffset: scaleUiSize(uiScene, 18, "spacing"),
        titleFontSize: scaleFontPx(uiScene, 22, "title"),
        sectionFontSize: scaleFontPx(uiScene, 11, "label"),
        buttonFontSize: scaleFontPx(uiScene, 14, "button"),
        shortcutsContentW: scaleUiSize(uiScene, 300, "control"),
        shortcutsPanelW: scaleUiSize(uiScene, 400, "control")
    };
}

/* ─── Internal helpers ─────────────────────────────────────────────────── */

function addDivider(
    scene: PhaserScene,
    cx: number,
    y: number,
    w: number,
    depth: number,
    container?: Container | null
): Rectangle {
    const line = scene.add.rectangle(cx, y, w, 1, UI_COLORS.panelEdgeSoft, 0.35);
    line.setDepth(depth);
    if (container) { line.setVisible(true); container.add(line); }
    else line.setVisible(false);
    return line;
}

function addSectionLabel(
    scene: PhaserScene,
    cx: number,
    y: number,
    text: string,
    depth: number,
    container?: Container | null,
    fontSize?: string | number
): Text {
    const label = scene.add.text(cx, y, text, {
        fontFamily: UI_FONT,
        fontSize: fontSize ?? scaleFontPx(scene as unknown as UiSceneArg, 11, "label"),
        color: "#6b8da6",
        fontStyle: "bold"
    });
    label.setOrigin(0.5);
    label.setDepth(depth);
    if (container) { label.setVisible(true); container.add(label); }
    else label.setVisible(false);
    return label;
}

function getTooltipModeLabel(mode: string, legacyExpandedTooltip: boolean = false): string {
    const normalized = normalizeTooltipMode(mode, legacyExpandedTooltip);
    return t(`settings.tooltipModeValue.${normalized}`);
}

function getTooltipModeButtonLabel(mode: string, legacyExpandedTooltip: boolean = false): string {
    return t("settings.tooltipMode", { mode: getTooltipModeLabel(mode, legacyExpandedTooltip) });
}

function computeIngameSettingsPanelHeight(
    scene: PhaserScene,
    metrics: PanelMetrics,
    options: {
        hideProgress?: boolean;
        exitPlanning?: boolean;
        stackFooter?: boolean;
        btnH: number;
        gap: number;
        sectionGap: number;
        sectionLabelOffset: number;
    }
): number {
    const uiScene = scene as unknown as UiSceneArg;
    const topInset = 60;
    const bottomPad = scaleUiSize(uiScene, 24, "spacing");
    const sectionHeader = options.sectionGap + options.sectionLabelOffset + options.gap + 4;
    const itemBlock = (count: number) => count * (options.btnH + options.gap);
    let extent = topInset;

    if (!options.hideProgress) {
        extent += sectionHeader + itemBlock(3);
    }
    extent += sectionHeader + itemBlock(2);
    extent += sectionHeader + itemBlock(4);
    extent += options.sectionGap + options.sectionLabelOffset + options.gap + 4 + options.btnH + options.gap;
    extent += options.sectionGap + options.gap + 6;
    if (options.exitPlanning) {
        extent += options.btnH + options.gap;
    }
    extent += options.stackFooter ? itemBlock(2) : options.btnH;
    extent += bottomPad;
    return extent + options.btnH;
}

function resizeIngameSettingsPanel(
    panel: Rectangle | null,
    panelOuter: Rectangle | null,
    panelW: number,
    panelH: number
): void {
    if (panel?.setSize) {
        panel.setSize(panelW, panelH);
    } else if (panel) {
        panel.width = panelW;
        panel.height = panelH;
    }
    if (panelOuter?.setSize) {
        panelOuter.setSize(panelW + 4, panelH + 4);
    } else if (panelOuter) {
        panelOuter.width = panelW + 4;
        panelOuter.height = panelH + 4;
    }
}

function setSettingsTargetsVisible(targets: Array<DisplayObject | MenuButton | Text | Rectangle | null>, visible: boolean): void {
    targets.forEach((entry) => {
        if (!entry) return;
        const setter = entry as unknown as { setVisible?: (v: boolean) => void };
        if (typeof setter.setVisible === "function") {
            setter.setVisible(visible);
            return;
        }
        const composite = entry as { shadow?: { setVisible?: (v: boolean) => void }; bg?: { setVisible?: (v: boolean) => void }; text?: { setVisible?: (v: boolean) => void } };
        composite.shadow?.setVisible?.(visible);
        composite.bg?.setVisible?.(visible);
        composite.text?.setVisible?.(visible);
    });
}

function appendShortcutsEntry({
    scene,
    cx,
    cy,
    curY,
    BTN_W,
    BTN_H,
    metrics,
    overlay,
    container,
    shortcutContext = "planning",
    depth = 5002,
    panelHalfH: _panelHalfH,
    panelResize,
    makeButton,
    makeSubviewButton,
    wrapMenuButton: wrapMenuButtonFn,
    mainVisibilityTargets,
    onBindingsChanged
}: ShortcutsEntryArgs): ShortcutsEntryResult {
    const GAP_ACTUAL = metrics.gap;
    const SECTION_GAP_ACTUAL = metrics.sectionGap;
    let y = curY + SECTION_GAP_ACTUAL;
    const sectionLabel = addSectionLabel(
        scene,
        container ? 0 : cx,
        container ? y : cy + y,
        t("settings.shortcutsSection"),
        container ? 5 : depth,
        container,
        metrics.sectionFontSize
    );
    y += metrics.sectionLabelOffset;
    const divider = addDivider(scene, container ? 0 : cx, container ? y : cy + y, BTN_W, container ? 5 : depth, container);
    y += GAP_ACTUAL + 4;

    const makeOpenButton = (label: string, onClick: () => void): MenuButton => {
        if (makeButton) {
            const btn = makeButton(0, y, BTN_W, BTN_H, label, onClick);
            btn.setVisible(false);
            if (btn.shadow) overlay.push(btn.shadow);
            if (btn.bg) overlay.push(btn.bg);
            if (btn.text) overlay.push(btn.text);
            return btn;
        }
        if (!wrapMenuButtonFn) {
            throw new Error("appendShortcutsEntry requires either makeButton or wrapMenuButton");
        }
        return wrapMenuButtonFn(scene, 0, y, BTN_W, BTN_H, label, onClick, container, {
            fontSize: metrics.buttonFontSize
        });
    };

    let shortcutsOpen = false;
    let shortcutsSubview: ShortcutsSubview | null = null;
    const restorePanelSize = () => {
        if (!panelResize) return;
        resizeIngameSettingsPanel(
            panelResize.panel,
            panelResize.panelOuter,
            panelResize.defaultW,
            panelResize.defaultH
        );
    };
    const shrinkPanelForShortcuts = () => {
        if (!panelResize) return;
        const shortcutsH = shortcutsSubview?.getPanelHeight?.()
            ?? computeKeyboardShortcutsPanelHeight(scene as unknown as Parameters<typeof computeKeyboardShortcutsPanelHeight>[0], {
                shortcutContext,
                metrics,
                btnH: BTN_H,
                gap: GAP_ACTUAL
            });
        resizeIngameSettingsPanel(
            panelResize.panel,
            panelResize.panelOuter,
            metrics.shortcutsPanelW,
            shortcutsH
        );
    };
    const closeShortcutsView = () => {
        shortcutsOpen = false;
        shortcutsSubview?.hide?.();
        restorePanelSize();
        setSettingsTargetsVisible(mainVisibilityTargets, true);
    };
    const openShortcutsView = () => {
        shortcutsOpen = true;
        setSettingsTargetsVisible(mainVisibilityTargets, false);
        shrinkPanelForShortcuts();
        shortcutsSubview?.show?.();
    };
    const finalizeShortcutsSubview = (halfH?: number) => {
        const shortcutsPanelH = computeKeyboardShortcutsPanelHeight(scene as unknown as Parameters<typeof computeKeyboardShortcutsPanelHeight>[0], {
            shortcutContext,
            metrics,
            btnH: BTN_H,
            gap: GAP_ACTUAL
        });
        shortcutsSubview = buildKeyboardShortcutsSubview(scene as unknown as Parameters<typeof buildKeyboardShortcutsSubview>[0], {
            shortcutContext,
            metrics: { ...metrics, panelHalfH: shortcutsPanelH / 2 },
            cx,
            cy,
            btnW: BTN_W,
            btnH: BTN_H,
            gap: GAP_ACTUAL,
            sectionGap: SECTION_GAP_ACTUAL,
            depth,
            container,
            makeSubviewButton,
            wrapMenuButton: wrapMenuButtonFn,
            onBindingsChanged,
            onBack: closeShortcutsView,
            panelHalfH: halfH
        } as unknown as Parameters<typeof buildKeyboardShortcutsSubview>[1]) as unknown as ShortcutsSubview;
        shortcutsSubview?.hide?.();
    };

    const openButton = makeOpenButton(t("settings.shortcutsOpen"), openShortcutsView);
    if (!container) {
        overlay.push(divider, sectionLabel);
    }
    mainVisibilityTargets.push(sectionLabel, divider, openButton);

    y += BTN_H + GAP_ACTUAL;
    return {
        curY: y,
        sectionLabel,
        divider,
        openButton,
        shortcutsSubview: null,
        getShortcutsSubview: () => shortcutsSubview,
        finalizeShortcutsSubview,
        openShortcutsView,
        closeShortcutsView,
        isShortcutsOpen: () => shortcutsOpen
    };
}

/* ─── Button wrapper for MainMenu (different API) ──────────────────────── */

function wrapMenuButton(
    scene: PhaserScene,
    bx: number,
    by: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    container: Container | null,
    opts: { fontSize?: string | number } = {}
): MenuButton {
    const fill = 0x162433;
    const edge = UI_COLORS.panelEdgeSoft;
    const hover = 0x21354c;

    const bg = scene.add.rectangle(bx, by, w, h, fill, 0.94);
    bg.setStrokeStyle(1, edge, 0.95);
    bg.setDepth(2);
    bg.setInteractive({ useHandCursor: true });

    const text = scene.add.text(bx, by, label, {
        fontFamily: UI_FONT,
        fontSize: opts.fontSize ?? scaleFontPx(scene as unknown as UiSceneArg, 14, "button"),
        color: UI_COLORS.textSecondary
    });
    text.setOrigin(0.5);
    text.setDepth(3);

    const btn: MenuButton = {
        bg, text,
        enabled: true,
        setLabel: (v: string) => {
            safeSetText(text, v);
            return btn;
        },
        setEnabled: (enabled: boolean) => {
            btn.enabled = enabled;
            if (isDisplayObjectAlive(bg)) {
                bg.setFillStyle(enabled ? fill : 0x323943, enabled ? 0.94 : 0.7);
                bg.setStrokeStyle(1, enabled ? edge : 0x5b6572, 0.85);
            }
            if (isRenderableText(text as RenderableText)) {
                text.setColor(enabled ? UI_COLORS.textSecondary : "#8d98a6");
            }
            return btn;
        },
        setVisible: (v: boolean) => {
            if (isDisplayObjectAlive(bg)) bg.setVisible(v);
            if (isDisplayObjectAlive(text)) text.setVisible(v);
            return btn;
        }
    };

    bg.on("pointerover", () => { if (btn.enabled && isDisplayObjectAlive(bg)) bg.setFillStyle(hover, 0.96); });
    bg.on("pointerout", () => { if (btn.enabled && isDisplayObjectAlive(bg)) bg.setFillStyle(fill, 0.94); });
    bg.on("pointerdown", () => {
        if (!btn.enabled) return;
        if (isDisplayObjectAlive(bg)) bg.setScale(0.95);
        scene.time.delayedCall(30, () => { if (isDisplayObjectAlive(bg)) bg.setFillStyle(hover, 0.96); });
        scene.tweens.add({ targets: bg, scaleX: 1, scaleY: 1, duration: 80, ease: "Back.easeOut" });
        onClick();
    });

    if (container) { container.add(bg); container.add(text); }
    return btn;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  PUBLIC API                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

/**
 * Build a settings panel.
 */
export function buildSettingsPanel(scene: PhaserScene, opts: BuildSettingsOpts): BuildSettingsResult {
    const { context, createButton, callbacks = {}, hideProgress, shortcutContext = "planning" } = opts;
    const isMenu = context === "menu";

    if (isMenu) {
        return buildMenuPanel(scene, callbacks, shortcutContext);
    } else {
        if (!createButton) {
            throw new Error("buildSettingsPanel: createButton is required for ingame context");
        }
        return buildIngameOverlay(scene, createButton, callbacks, hideProgress, shortcutContext);
    }
}

/* ─── Menu version (container-based) ───────────────────────────────────── */

function buildMenuPanel(scene: PhaserScene, cb: SettingsCallbacks, shortcutContext: BindingContext = "menu"): BuildSettingsResult {
    const uiScene = scene as unknown as UiSceneArg;
    const metrics = getPanelMetrics(scene);
    const PANEL_W = metrics.panelW;
    const BTN_W = metrics.btnW;
    const BTN_SM = metrics.btnSm;
    const STEP_MID = metrics.stepMid;
    const BTN_H_ACTUAL = metrics.btnH;
    const STEP_SIDE_ACTUAL = metrics.stepSide;
    const GAP_ACTUAL = metrics.gap;
    const SECTION_GAP_ACTUAL = metrics.sectionGap;
    const container = scene.add.container(0, 0);
    container.setDepth(100);

    const maxPanelH = Math.max(1, (scene?.scale?.height ?? 720) - scaleUiSize(uiScene, 24, "spacing"));
    const PANEL_H = Math.min(Math.max(scaleUiSize(uiScene, 700, "control"), 580), maxPanelH);
    const halfW = PANEL_W / 2;
    let halfH = PANEL_H / 2;

    // Panel BG with double border
    const bgOuter = scene.add.rectangle(0, 0, PANEL_W + 4, PANEL_H + 4, 0x000000, 0);
    bgOuter.setStrokeStyle(2, UI_COLORS.panelEdge, 0.25);
    container.add(bgOuter);

    const bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x0b1624, 0.97);
    bg.setStrokeStyle(1.5, UI_COLORS.panelEdge, 0.7);
    container.add(bg);

    // Title
    const titleY = -halfH + 32;
    const titleBar = scene.add.rectangle(0, titleY + 16, PANEL_W - 40, 2, UI_COLORS.panelEdge, 0.2);
    container.add(titleBar);

    const title = scene.add.text(0, titleY, t("settings.title"), {
        fontFamily: UI_FONT,
        fontSize: metrics.titleFontSize,
        color: "#ffeab0",
        fontStyle: "bold"
    });
    title.setOrigin(0.5);
    container.add(title);

    // Button factory (relative to container 0,0)
    const makeBtn = (dx: number, dy: number, w: number, h: number, label: string, onClick: () => void) => {
        return wrapMenuButton(scene, dx, dy, w, h, label, onClick, container, { fontSize: metrics.buttonFontSize });
    };
    const makeStepperBtn: MakeStepperButton = (dx, dy, w, h, label, onClick) => {
        return makeBtn(dx, dy, w, h, label, onClick);
    };

    const buttons: Record<string, MenuButton> = {};
    const mainVisibilityTargets: Array<DisplayObject | MenuButton | Text | Rectangle | null> = [titleBar, title];
    let curY = -halfH + 60;

    // ━━━ SECTION: Âm thanh ━━━
    curY += SECTION_GAP_ACTUAL;
    const audioSectionLabel = addSectionLabel(scene, 0, curY, t("settings.audioSection"), 5, container, metrics.sectionFontSize);
    mainVisibilityTargets.push(audioSectionLabel);
    curY += metrics.sectionLabelOffset;
    addDivider(scene, 0, curY, BTN_W, 5, container);
    curY += GAP_ACTUAL + 4;

    buttons.audio = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.audioToggle", { icon: "🔊", state: t("settings.on") }), () => cb.toggleAudio?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    // Volume row
    const volumeRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: t("settings.volumeLevel", { value: 10 }),
        onDecrement: () => cb.changeVolume?.(-1),
        onIncrement: () => cb.changeVolume?.(1)
    }) as unknown as StepperResult;
    buttons.volumeDown = volumeRow.down as unknown as MenuButton;
    buttons.volume = volumeRow.center as unknown as MenuButton;
    buttons.volumeUp = volumeRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    // ━━━ SECTION: Gameplay ━━━
    curY += SECTION_GAP_ACTUAL;
    const gameplaySectionLabel = addSectionLabel(scene, 0, curY, t("settings.gameplaySection"), 5, container, metrics.sectionFontSize);
    mainVisibilityTargets.push(gameplaySectionLabel);
    curY += metrics.sectionLabelOffset;
    addDivider(scene, 0, curY, BTN_W, 5, container);
    curY += GAP_ACTUAL + 4;

    buttons.language = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.languageLabel", { label: getLocaleLabel("vi") }), () => cb.changeLanguage?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    // ━━━ SECTION: Hiển thị ━━━
    curY += SECTION_GAP_ACTUAL;
    const displaySectionLabel = addSectionLabel(scene, 0, curY, t("settings.displaySection"), 5, container, metrics.sectionFontSize);
    mainVisibilityTargets.push(displaySectionLabel);
    curY += metrics.sectionLabelOffset;
    addDivider(scene, 0, curY, BTN_W, 5, container);
    curY += GAP_ACTUAL + 4;

    const resolutionRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: t("settings.resolution"),
        onDecrement: () => cb.changeResolution?.(-1),
        onIncrement: () => cb.changeResolution?.(1),
        onCenterClick: () => cb.changeResolution?.(1)
    }) as unknown as StepperResult;
    buttons.resolutionDown = resolutionRow.down as unknown as MenuButton;
    buttons.resolution = resolutionRow.center as unknown as MenuButton;
    buttons.resolutionUp = resolutionRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    const tooltipRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: getTooltipModeButtonLabel("summary"),
        onDecrement: () => cb.changeTooltip?.(-1),
        onIncrement: () => cb.changeTooltip?.(1),
        decrementLabel: "<",
        incrementLabel: ">"
    }) as unknown as StepperResult;
    buttons.tooltipModeDown = tooltipRow.down as unknown as MenuButton;
    buttons.tooltipMode = tooltipRow.center as unknown as MenuButton;
    buttons.tooltipModeUp = tooltipRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    buttons.subtitle = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.subtitleToggle", { state: t("settings.on") }), () => cb.changeSubtitle?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    let shortcutsBlock: ShortcutsEntryResult | null = null;
    const shortcutsPanelResize = { panel: bg, panelOuter: bgOuter, defaultW: PANEL_W, defaultH: PANEL_H };
    shortcutsBlock = appendShortcutsEntry({
        scene,
        cx: 0,
        cy: 0,
        curY,
        BTN_W,
        BTN_H: BTN_H_ACTUAL,
        metrics,
        overlay: [],
        container,
        shortcutContext,
        depth: 5,
        panelHalfH: halfH,
        panelResize: shortcutsPanelResize,
        wrapMenuButton,
        mainVisibilityTargets,
        onBindingsChanged: () => shortcutsBlock?.getShortcutsSubview()?.refresh?.({})
    });
    curY = shortcutsBlock.curY;
    buttons.shortcutsOpen = shortcutsBlock.openButton;

    // ━━━ Bottom ━━━
    curY += SECTION_GAP_ACTUAL;
    const bottomDivider = addDivider(scene, 0, curY, BTN_W, 5, container);
    mainVisibilityTargets.push(bottomDivider);
    curY += GAP_ACTUAL + 6;

    buttons.close = makeBtn(0, curY, BTN_SM, BTN_H_ACTUAL, t("settings.close"), () => {
        shortcutsBlock?.closeShortcutsView();
        cb.close?.();
    });
    const menuBottomPad = scaleUiSize(uiScene, 24, "spacing");
    const menuRequiredHalfH = curY + BTN_H_ACTUAL + menuBottomPad;
    if (menuRequiredHalfH > halfH) {
        const nextPanelH = Math.min(maxPanelH, menuRequiredHalfH * 2);
        halfH = nextPanelH / 2;
        bg.setSize(PANEL_W, nextPanelH);
        bgOuter.setSize(PANEL_W + 4, nextPanelH + 4);
        shortcutsPanelResize.defaultH = nextPanelH;
    }
    shortcutsBlock.finalizeShortcutsSubview(halfH);
    mainVisibilityTargets.push(
        buttons.audio,
        buttons.volumeDown,
        buttons.volume,
        buttons.volumeUp,
        buttons.language,
        buttons.resolutionDown,
        buttons.resolution,
        buttons.resolutionUp,
        buttons.tooltipModeDown,
        buttons.tooltipMode,
        buttons.tooltipModeUp,
        buttons.subtitle,
        buttons.close
    );

    // Refresh helper
    const refresh = (settings?: { audioEnabled?: boolean; volumeLevel?: number; language?: string; resolutionKey?: string; tooltipMode?: string; expandedTooltip?: boolean; subtitleEnabled?: boolean; loseCondition?: string }) => {
        if (!settings) return;
        safeSetText(title, t("settings.title"));
        safeSetText(audioSectionLabel, t("settings.audioSection"));
        safeSetText(gameplaySectionLabel, t("settings.gameplaySection"));
        safeSetText(displaySectionLabel, t("settings.displaySection"));
        safeSetText(shortcutsBlock?.sectionLabel, t("settings.shortcutsSection"));
        shortcutsBlock?.getShortcutsSubview()?.refresh?.(settings);
        buttons.shortcutsOpen?.setLabel?.(t("settings.shortcutsOpen"));
        const audioOn = settings.audioEnabled !== false;
        buttons.audio?.setLabel(t("settings.audioToggle", { icon: audioOn ? "🔊" : "🔇", state: audioOn ? t("settings.on") : t("settings.off") }));
        buttons.volume?.setLabel(t("settings.volumeLevel", { value: settings.volumeLevel ?? 10 }));
        buttons.language?.setLabel(t("settings.languageLabel", { label: getLocaleLabel(settings.language ?? "vi") }));

        const res = resolveResolution(settings.resolutionKey);
        buttons.resolution?.setLabel(`${res?.label ?? `${res.width}x${res.height}`}`);
        buttons.tooltipMode?.setLabel(getTooltipModeButtonLabel(settings.tooltipMode ?? "summary", settings.expandedTooltip === true));
        const subtitleOn = settings.subtitleEnabled !== false;
        buttons.subtitle?.setLabel(t("settings.subtitleToggle", { state: subtitleOn ? t("settings.on") : t("settings.off") }));
        buttons.close?.setLabel(t("settings.close"));
    };

    return {
        buttons,
        container,
        refresh: refresh as BuildSettingsResult["refresh"],
        closeShortcutsView: () => shortcutsBlock?.closeShortcutsView(),
        isShortcutsViewOpen: () => shortcutsBlock?.isShortcutsOpen() ?? false
    };
}

/* ─── In-game version (overlay-based, flat depth) ──────────────────────── */

function buildIngameOverlay(
    scene: PhaserScene,
    createButton: CreateButtonFn,
    cb: SettingsCallbacks,
    hideProgress: boolean = false,
    shortcutContext: BindingContext = "planning"
): BuildSettingsResult {
    const uiScene = scene as unknown as UiSceneArg;
    const metrics = getPanelMetrics(scene);
    const PANEL_W = metrics.panelW;
    const BTN_W = metrics.btnW;
    const BTN_SM = metrics.btnSm;
    const STEP_MID = metrics.stepMid;
    const BTN_H_ACTUAL = metrics.btnH;
    const STEP_SIDE_ACTUAL = metrics.stepSide;
    const GAP_ACTUAL = metrics.gap;
    const SECTION_GAP_ACTUAL = metrics.sectionGap;
    const cx = scene.scale.width * 0.5;
    const cy = scene.scale.height * 0.5;
    const overlay: DisplayObject[] = [];
    const footerExtra = metrics.stackFooter ? BTN_H_ACTUAL + GAP_ACTUAL : 0;
    const maxPanelH = Math.max(1, (scene?.scale?.height ?? 720) - scaleUiSize(uiScene, 28, "spacing"));
    const estimatedPanelH = computeIngameSettingsPanelHeight(scene, metrics, {
        hideProgress,
        exitPlanning: Boolean(cb.exitPlanning),
        stackFooter: metrics.stackFooter,
        btnH: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        sectionGap: SECTION_GAP_ACTUAL,
        sectionLabelOffset: metrics.sectionLabelOffset
    }) + footerExtra;
    let PANEL_H = Math.min(Math.max(estimatedPanelH, 480), maxPanelH);

    // Backdrop
    const shade = scene.add.rectangle(cx, cy, scene.scale.width, scene.scale.height, 0x030810, 0.72);
    shade.setDepth(5000); shade.setVisible(false); shade.setInteractive();
    overlay.push(shade);

    // Double border panel
    const panelOuter = scene.add.rectangle(cx, cy, PANEL_W + 4, PANEL_H + 4, 0x000000, 0);
    panelOuter.setStrokeStyle(2, UI_COLORS.panelEdge, 0.25);
    panelOuter.setDepth(5001); panelOuter.setVisible(false);
    overlay.push(panelOuter);

    const panel = scene.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0x0b1624, 0.97);
    panel.setStrokeStyle(1.5, UI_COLORS.panelEdge, 0.7);
    panel.setDepth(5001); panel.setVisible(false);
    overlay.push(panel);

    // Title
    const titleBarY = cy - PANEL_H / 2 + 32;
    const titleBar = scene.add.rectangle(cx, titleBarY + 16, PANEL_W - 40, 2, UI_COLORS.panelEdge, 0.2);
    titleBar.setDepth(5002); titleBar.setVisible(false);
    overlay.push(titleBar);

    const titleText = scene.add.text(cx, titleBarY, t("settings.title"), {
        fontFamily: UI_FONT, fontSize: metrics.titleFontSize, color: "#ffeab0", fontStyle: "bold"
    });
    titleText.setOrigin(0.5); titleText.setDepth(5002); titleText.setVisible(false);
    overlay.push(titleText);

    // Button factory
    const makeBtn = (dx: number, dy: number, w: number, h: number, label: string, onClick: () => void, opts: CreateButtonOpts = {}): MenuButton => {
        const btn = createButton(cx + dx - w / 2, cy + dy - h / 2, w, h, label, onClick, {
            variant: "ghost",
            fontSize: metrics.buttonFontSize,
            textRole: "button",
            ...opts
        });
        if (btn.shadow) btn.shadow.setDepth(5002);
        btn.bg.setDepth(5003);
        btn.text.setDepth(5004);
        btn.setVisible(false);
        if (btn.shadow) overlay.push(btn.shadow);
        overlay.push(btn.bg);
        overlay.push(btn.text);
        return btn;
    };
    const makeSubviewBtn = (dx: number, dy: number, w: number, h: number, label: string, onClick: () => void, opts: CreateButtonOpts = {}): MenuButton => {
        const btn = createButton(cx + dx - w / 2, cy + dy - h / 2, w, h, label, onClick, {
            variant: "ghost",
            fontSize: metrics.buttonFontSize,
            textRole: "button",
            ...opts
        });
        if (btn.shadow) btn.shadow.setDepth(5002);
        btn.bg.setDepth(5003);
        btn.text.setDepth(5004);
        btn.setVisible(false);
        return btn;
    };
    const makeStepperBtn: MakeStepperButton = (dx, dy, w, h, label, onClick) => {
        return makeBtn(dx, dy, w, h, label, onClick);
    };

    const buttons: Record<string, MenuButton> = {};
    const mainVisibilityTargets: Array<DisplayObject | MenuButton | Text | Rectangle | null> = [titleBar, titleText];
    let curY = -PANEL_H / 2 + 60;
    let progressSectionLabel: Text | null = null;

    if (!hideProgress) {
        // ━━━ SECTION: Tiến trình ━━━
        curY += SECTION_GAP_ACTUAL;
        progressSectionLabel = addSectionLabel(scene, cx, cy + curY, t("settings.progressSection"), 5002, null, metrics.sectionFontSize);
        overlay.push(progressSectionLabel);
        mainVisibilityTargets.push(progressSectionLabel);
        curY += metrics.sectionLabelOffset;
        overlay.push(addDivider(scene, cx, cy + curY, BTN_W, 5002));
        curY += GAP_ACTUAL + 4;

        buttons.exportJson = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.exportJson"), () => cb.exportJson?.());
        curY += BTN_H_ACTUAL + GAP_ACTUAL;

        buttons.importJson = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.importJson"), () => cb.importJson?.());
        curY += BTN_H_ACTUAL + GAP_ACTUAL;

        let confirmClearTimeout: ReturnType<typeof setTimeout> | undefined;
        buttons.clear = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.clearProgress"), () => {
            if (buttons.clear.text.text.includes("Xác nhận")) {
                cb.clear?.();
                buttons.clear.setLabel(t("settings.clearProgress"));
                if (confirmClearTimeout) clearTimeout(confirmClearTimeout);
            } else {
                buttons.clear.setLabel(t("settings.clearProgressConfirm"));
                confirmClearTimeout = setTimeout(() => {
                    if (!buttons.clear.text.scene) return;
                    if (buttons.clear.text.text.includes("Xác nhận") || buttons.clear.text.text.includes("Confirm")) {
                        buttons.clear.setLabel(t("settings.clearProgress"));
                    }
                }, 3000);
            }
        });
        curY += BTN_H_ACTUAL + GAP_ACTUAL;
    }

    // ━━━ SECTION: Âm thanh ━━━
    curY += SECTION_GAP_ACTUAL;
    const audioSectionLabel = addSectionLabel(scene, cx, cy + curY, t("settings.audioSection"), 5002, null, metrics.sectionFontSize);
    overlay.push(audioSectionLabel);
    mainVisibilityTargets.push(audioSectionLabel);
    curY += metrics.sectionLabelOffset;
    overlay.push(addDivider(scene, cx, cy + curY, BTN_W, 5002));
    curY += GAP_ACTUAL + 4;

    buttons.audio = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.audioToggle", { icon: "🔊", state: t("settings.on") }), () => cb.toggleAudio?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    const volumeRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: t("settings.volumeLevel", { value: 10 }),
        onDecrement: () => cb.changeVolume?.(-1),
        onIncrement: () => cb.changeVolume?.(1)
    }) as unknown as StepperResult;
    buttons.volumeDown = volumeRow.down as unknown as MenuButton;
    buttons.volume = volumeRow.center as unknown as MenuButton;
    buttons.volumeUp = volumeRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    // ━━━ SECTION: Hiển thị ━━━
    curY += SECTION_GAP_ACTUAL;
    const displaySectionLabel = addSectionLabel(scene, cx, cy + curY, t("settings.displaySection"), 5002, null, metrics.sectionFontSize);
    overlay.push(displaySectionLabel);
    mainVisibilityTargets.push(displaySectionLabel);
    curY += metrics.sectionLabelOffset;
    overlay.push(addDivider(scene, cx, cy + curY, BTN_W, 5002));
    curY += GAP_ACTUAL + 4;

    const resolutionRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: t("settings.resolution"),
        onDecrement: () => cb.changeResolution?.(-1),
        onIncrement: () => cb.changeResolution?.(1),
        onCenterClick: () => cb.changeResolution?.(1)
    }) as unknown as StepperResult;
    buttons.resolutionDown = resolutionRow.down as unknown as MenuButton;
    buttons.resolution = resolutionRow.center as unknown as MenuButton;
    buttons.resolutionUp = resolutionRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    const tooltipRow = buildSettingsStepperRow({
        y: curY,
        makeButton: makeStepperBtn as unknown as Parameters<typeof buildSettingsStepperRow>[0]["makeButton"],
        centerWidth: STEP_MID,
        sideWidth: STEP_SIDE_ACTUAL,
        height: BTN_H_ACTUAL,
        gap: GAP_ACTUAL,
        centerLabel: getTooltipModeButtonLabel("summary"),
        onDecrement: () => cb.changeTooltip?.(-1),
        onIncrement: () => cb.changeTooltip?.(1),
        decrementLabel: "<",
        incrementLabel: ">"
    }) as unknown as StepperResult;
    buttons.tooltipModeDown = tooltipRow.down as unknown as MenuButton;
    buttons.tooltipMode = tooltipRow.center as unknown as MenuButton;
    buttons.tooltipModeUp = tooltipRow.up as unknown as MenuButton;
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    buttons.language = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.languageLabel", { label: getLocaleLabel("vi") }), () => cb.changeLanguage?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    buttons.subtitle = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.subtitleToggle", { state: t("settings.on") }), () => cb.changeSubtitle?.());
    curY += BTN_H_ACTUAL + GAP_ACTUAL;

    let shortcutsBlock: ShortcutsEntryResult | null = null;
    const shortcutsPanelResize = { panel, panelOuter, defaultW: PANEL_W, defaultH: PANEL_H };
    shortcutsBlock = appendShortcutsEntry({
        scene,
        cx,
        cy,
        curY,
        BTN_W,
        BTN_H: BTN_H_ACTUAL,
        metrics,
        overlay,
        container: null,
        shortcutContext,
        depth: 5002,
        panelHalfH: PANEL_H / 2,
        panelResize: shortcutsPanelResize,
        makeButton: makeBtn,
        makeSubviewButton: makeSubviewBtn,
        mainVisibilityTargets,
        onBindingsChanged: () => shortcutsBlock?.getShortcutsSubview()?.refresh?.({})
    });
    curY = shortcutsBlock.curY;
    buttons.shortcutsOpen = shortcutsBlock.openButton;

    // ━━━ Bottom ━━━
    curY += SECTION_GAP_ACTUAL;
    const bottomDivider = addDivider(scene, cx, cy + curY, BTN_W, 5002);
    overlay.push(bottomDivider);
    mainVisibilityTargets.push(bottomDivider);
    curY += GAP_ACTUAL + 6;

    if (cb.exitPlanning) {
        buttons.exitPlanning = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, `🚩  ${t("settings.exitPlanning")}`, () => cb.exitPlanning?.(), { variant: "primary" });
        curY += BTN_H_ACTUAL + GAP_ACTUAL;
    }

    const btnGap = GAP_ACTUAL + 4;
    if (metrics.stackFooter) {
        buttons.menu = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.home"), () => cb.goMainMenu?.());
        curY += BTN_H_ACTUAL + GAP_ACTUAL;
        buttons.close = makeBtn(0, curY, BTN_W, BTN_H_ACTUAL, t("settings.close"), () => {
            shortcutsBlock?.closeShortcutsView();
            cb.close?.();
        });
    } else {
        buttons.menu = makeBtn(-(BTN_SM / 2 + btnGap / 2), curY, BTN_SM, BTN_H_ACTUAL, t("settings.home"), () => cb.goMainMenu?.());
        buttons.close = makeBtn(BTN_SM / 2 + btnGap / 2, curY, BTN_SM, BTN_H_ACTUAL, t("settings.close"), () => {
            shortcutsBlock?.closeShortcutsView();
            cb.close?.();
        });
    }
    mainVisibilityTargets.push(
        buttons.exportJson,
        buttons.importJson,
        buttons.clear,
        buttons.audio,
        buttons.volumeDown,
        buttons.volume,
        buttons.volumeUp,
        buttons.resolutionDown,
        buttons.resolution,
        buttons.resolutionUp,
        buttons.tooltipModeDown,
        buttons.tooltipMode,
        buttons.tooltipModeUp,
        buttons.language,
        buttons.subtitle,
        buttons.exitPlanning,
        buttons.menu,
        buttons.close
    );

    const bottomPad = scaleUiSize(uiScene, 24, "spacing");
    const requiredHalfH = curY + BTN_H_ACTUAL + bottomPad;
    const requiredPanelH = Math.min(maxPanelH, Math.max(PANEL_H, requiredHalfH * 2));
    if (requiredPanelH !== PANEL_H) {
        PANEL_H = requiredPanelH;
        resizeIngameSettingsPanel(panel, panelOuter, PANEL_W, PANEL_H);
        shortcutsPanelResize.defaultH = PANEL_H;
    }
    shortcutsBlock.finalizeShortcutsSubview(PANEL_H / 2);

    // Refresh helper
    const refresh = (
        settings?: { tooltipMode?: string; expandedTooltip?: boolean; subtitleEnabled?: boolean; language?: string; resolutionKey?: string; loseCondition?: string },
        audioFx?: { enabled: boolean; getVolumeLevel: () => number }
    ) => {
        safeSetText(titleText, t("settings.title"));
        safeSetText(progressSectionLabel, t("settings.progressSection"));
        safeSetText(audioSectionLabel, t("settings.audioSection"));
        safeSetText(displaySectionLabel, t("settings.displaySection"));
        safeSetText(shortcutsBlock?.sectionLabel, t("settings.shortcutsSection"));
        shortcutsBlock?.getShortcutsSubview()?.refresh?.(settings);
        buttons.shortcutsOpen?.setLabel?.(t("settings.shortcutsOpen"));
        buttons.exportJson?.setLabel(t("settings.exportJson"));
        buttons.importJson?.setLabel(t("settings.importJson"));
        buttons.clear?.setLabel(t("settings.clearProgress"));
        if (buttons.audio && audioFx) {
            const on = audioFx.enabled;
            buttons.audio.setLabel(t("settings.audioToggle", { icon: on ? "🔊" : "🔇", state: on ? t("settings.on") : t("settings.off") }));
        }
        if (buttons.volume && audioFx) {
            buttons.volume.setLabel(t("settings.volumeLevel", { value: audioFx.getVolumeLevel() / 1 }));
        }
        if (buttons.resolution && settings) {
            const res = resolveResolution(settings.resolutionKey);
            buttons.resolution.setLabel(`${res?.label ?? `${res.width}x${res.height}`}`);
        }
        if (buttons.tooltipMode && settings) {
            buttons.tooltipMode.setLabel(getTooltipModeButtonLabel(settings.tooltipMode ?? "summary", settings.expandedTooltip === true));
        }
        if (buttons.subtitle && settings) {
            const subtitleOn = settings.subtitleEnabled !== false;
            buttons.subtitle.setLabel(t("settings.subtitleToggle", { state: subtitleOn ? t("settings.on") : t("settings.off") }));
        }
        if (buttons.language && settings) {
            buttons.language.setLabel(t("settings.languageLabel", { label: getLocaleLabel(settings.language ?? "vi") }));
        }
        if (buttons.exportJson) {
            try {
                buttons.exportJson.setEnabled(true);
                buttons.importJson?.setEnabled(true);
            } catch { /* button canvas not ready yet */ }
        }
        if (buttons.clear) {
            const hasSave = !!loadProgress();
            try {
                buttons.clear?.setEnabled(hasSave);
            } catch { /* button canvas not ready yet */ }
        }
        if (buttons.loseMode && settings) {
            buttons.loseMode.setLabel(`Điều kiện thua: ${getLoseConditionLabel(settings.loseCondition)}`);
        }
        buttons.menu?.setLabel(t("settings.home"));
        buttons.close?.setLabel(t("settings.close"));
        if (buttons.exitPlanning) {
            buttons.exitPlanning.setLabel(`🚩  ${t("settings.exitPlanning")}`);
        }
    };

    return {
        buttons,
        overlay,
        refresh: refresh as BuildSettingsResult["refresh"],
        closeShortcutsView: () => shortcutsBlock?.closeShortcutsView(),
        isShortcutsViewOpen: () => shortcutsBlock?.isShortcutsOpen() ?? false
    };
}
