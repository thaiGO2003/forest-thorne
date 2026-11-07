/**
 * ============================================================================
 * ThreeGamepadController — mobile-first gamepad and touch controller
 * ============================================================================
 * Counterpart of src/core/GamepadController.ts.
 * This module intentionally has no Phaser dependency; host scenes satisfy the
 * structural interfaces below and Three.js canvases can bind touch events.
 */

import { clamp, gridKey } from "../core/gameUtils.js";
import { PLAYER_COLS, ROWS } from "../core/boardConstants.js";
import { getMinTouchTarget, type ThreeUiSceneLike } from "./ThreeUiResponsive.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

/** Minimal structural scene interface; no Phaser.Scene dependency. */
export interface GamepadSceneLike extends ThreeUiSceneLike {
    addLog?: (message: string) => void;
    getBenchCap?: () => number;
    benchSlots?: Array<{ bg: { x: number; y: number }; slotW: number; slotH: number }>;
    layout?: { benchCols?: number };
    player?: { board: unknown[] };
    selectedBenchIndex?: number | null;
    settingsVisible?: boolean;
    historyModalVisible?: boolean;
    versionInfoVisible?: boolean;
    libraryModal?: { isOpen(): boolean } | null;
    shopCards?: Array<{ bg: { x: number; y: number; width: number; height: number } }>;
    tileLookup?: { get(key: string): { center: { x: number; y: number } } | undefined };
    drawDiamond?: (layer: unknown, x: number, y: number) => void;
    input?: {
        on?: (event: string, handler: (...args: unknown[]) => void) => unknown;
        off?: (event: string, handler: (...args: unknown[]) => void) => unknown;
        gamepad?: {
            on(event: string, handler: (...args: unknown[]) => void): unknown;
            off(event: string, handler: (...args: unknown[]) => void): unknown;
            getAll?: () => Array<GamepadPadLike>;
        };
    };
    time?: { now: number };
}

/** Callbacks shared by gamepad confirm/cancel and touch taps. */
export interface GamepadCallbacks {
    buyFromShop?: (index: number) => void;
    onBenchClick?: (index: number) => void;
    onPlayerCellClick?: (row: number, col: number) => void;
    onCancelSelection?: () => void;
    onCloseModal?: () => void;
    onSettingsToggle?: () => void;
    onCombatStart?: () => void;
}

/** Controller timing, visual, and touch gesture configuration. */
export interface GamepadControllerConfig {
    debounceMs?: number;
    repeatMs?: number;
    cursorColor?: number;
    cursorAlpha?: number;
    touchSwipeThreshold?: number;
}

/** Normalized screen-space touch/pointer coordinate. */
export interface TouchPoint {
    x: number;
    y: number;
}

/** Minimal DOM-like target used by Three.js canvas touch bindings. */
export interface TouchInputTarget {
    addEventListener: (event: string, handler: (event: unknown) => void, options?: unknown) => void;
    removeEventListener: (event: string, handler: (event: unknown) => void, options?: unknown) => void;
}

/** Structural gamepad shape used by browser and test adapters. */
export type GamepadPadLike = {
    connected?: boolean;
    buttons?: Array<{ pressed?: boolean }>;
    axes?: Array<{ getValue?: () => number }>;
};

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const DEFAULT_TOUCH_SWIPE_THRESHOLD = 32;
const TOUCH_TAP_MAX_DISTANCE = 18;
const TOUCH_TARGET_FALLBACK = 48;

/**
 * ============================================================================
 * 3. CLASS / CONSTRUCTOR / LIFECYCLE
 * ============================================================================
 */

/**
 * Gamepad navigation controller with explicit mobile touch gesture support.
 *
 * The original gamepad navigation state machine is preserved. Rendering is
 * delegated to the host, so this class never creates Phaser graphics objects.
 */
export class GamepadController {
    scene: GamepadSceneLike;
    debounceMs: number;
    repeatMs: number;
    cursorColor: number;
    cursorAlpha: number;
    currentRegion: string;
    cursorRow: number;
    cursorCol: number;
    shopIndex: number;
    benchIndex: number;
    buttonLatch: Record<string, boolean>;
    lastMoveTime: number;
    lastDirection: { x: number; y: number };
    active: boolean;
    onGamepadConnected: () => void;
    onGamepadDisconnected: () => void;

    private touchSwipeThreshold: number;
    private touchStartPoint: TouchPoint | null = null;
    private touchLastPoint: TouchPoint | null = null;
    private touchTarget: TouchInputTarget | null = null;
    private touchCallbacks: GamepadCallbacks = {};
    private readonly boundTouchStart = (event: unknown): void => {
        this.preventTouchDefault(event);
        this.handleTouchStart(event);
    };
    private readonly boundTouchMove = (event: unknown): void => {
        this.preventTouchDefault(event);
        this.handleTouchMove(event);
    };
    private readonly boundTouchEnd = (event: unknown): void => {
        this.preventTouchDefault(event);
        this.handleTouchEnd(event);
    };

    /**
     * Initialize navigation state and register gamepad lifecycle listeners.
     *
     * @param scene - Structural host scene
     * @param config - Controller configuration
     */
    constructor(scene: GamepadSceneLike, config: GamepadControllerConfig = {}) {
        this.scene = scene;
        this.debounceMs = config.debounceMs ?? 170;
        this.repeatMs = config.repeatMs ?? 120;
        this.cursorColor = config.cursorColor ?? 0xfff3a1;
        this.cursorAlpha = config.cursorAlpha ?? 0.95;
        this.touchSwipeThreshold = Math.max(16, config.touchSwipeThreshold ?? DEFAULT_TOUCH_SWIPE_THRESHOLD);
        this.currentRegion = "BOARD";
        this.cursorRow = ROWS - 1;
        this.cursorCol = 0;
        this.shopIndex = 0;
        this.benchIndex = 0;
        this.buttonLatch = {};
        this.lastMoveTime = 0;
        this.lastDirection = { x: 0, y: 0 };
        this.active = false;

        this.onGamepadConnected = () => {
            this.active = true;
            if (typeof this.scene.addLog === "function") this.scene.addLog("Đã kết nối tay cầm.");
        };
        this.onGamepadDisconnected = () => {
            const hasPad = this.getPadsSome((pad: GamepadPadLike): boolean => pad?.connected === true);
            this.active = hasPad;
            if (!hasPad) this.currentRegion = "BOARD";
            if (typeof this.scene.addLog === "function") this.scene.addLog("Tay cầm đã ngắt kết nối.");
        };

        this.enable();
    }

    /**
     * ========================================================================
     * 4. PUBLIC METHODS — GAMEPAD NAVIGATION
     * ========================================================================
     */

    /** Return the first connected browser gamepad. */
    public getActivePad(): GamepadPadLike | null {
        const pads = this.scene.input?.gamepad?.getAll?.() ?? [];
        return pads.find((pad: GamepadPadLike) => pad?.connected === true) ?? null;
    }

    /** Consume a button only on its rising edge. */
    public consumePadButton(pad: GamepadPadLike, index: number): boolean {
        const pressed = !!pad?.buttons?.[index]?.pressed;
        const key = String(index);
        const wasPressed = !!this.buttonLatch[key];
        if (pressed && !wasPressed) {
            this.buttonLatch[key] = true;
            return true;
        }
        if (!pressed && wasPressed) this.buttonLatch[key] = false;
        return false;
    }

    /** Read D-pad and analog-stick direction as a normalized grid vector. */
    public readPadDirection(pad: GamepadPadLike): { dx: number; dy: number } {
        const dpadLeft = !!pad?.buttons?.[14]?.pressed;
        const dpadRight = !!pad?.buttons?.[15]?.pressed;
        const dpadUp = !!pad?.buttons?.[12]?.pressed;
        const dpadDown = !!pad?.buttons?.[13]?.pressed;
        const axisX = Number.isFinite(pad?.axes?.[0]?.getValue?.()) ? (pad?.axes?.[0]?.getValue?.() ?? 0) : 0;
        const axisY = Number.isFinite(pad?.axes?.[1]?.getValue?.()) ? (pad?.axes?.[1]?.getValue?.() ?? 0) : 0;
        const left = dpadLeft || axisX < -0.55;
        const right = dpadRight || axisX > 0.55;
        const up = dpadUp || axisY < -0.55;
        const down = dpadDown || axisY > 0.55;
        return {
            dx: left === right ? 0 : left ? -1 : 1,
            dy: up === down ? 0 : up ? -1 : 1
        };
    }

    /** Return navigation bounds for the active region. */
    public getBounds(): { maxX: number; maxY: number } {
        if (this.currentRegion === "SHOP") {
            return { maxX: 4, maxY: 0 };
        }
        if (this.currentRegion === "BENCH") {
            const cap = Math.max(1, typeof this.scene.getBenchCap === "function" ? this.scene.getBenchCap() : (this.scene.benchSlots?.length ?? 8));
            const cols = Math.max(1, this.scene.layout?.benchCols ?? 5);
            return { maxX: cols - 1, maxY: Math.floor((cap - 1) / cols) };
        }
        const localBoardRows = Math.max(1, Array.isArray(this.scene.player?.board) ? this.scene.player.board.length : ROWS);
        return { maxX: PLAYER_COLS - 1, maxY: localBoardRows - 1 };
    }

    /** Move navigation state using the original region transition rules. */
    public handleMove(dx: number, dy: number): void {
        if (this.currentRegion === "SHOP") {
            this.shopIndex = clamp(this.shopIndex + dx, 0, 4);
            if (dy < 0) this.currentRegion = "BOARD";
            if (dy > 0) this.currentRegion = "BENCH";
            return;
        }
        if (this.currentRegion === "BENCH") {
            const cap = Math.max(1, typeof this.scene.getBenchCap === "function" ? this.scene.getBenchCap() : (this.scene.benchSlots?.length ?? 8));
            const cols = Math.max(1, this.scene.layout?.benchCols ?? 5);
            const index = this.benchIndex;
            const col = index % cols;
            const row = Math.floor(index / cols);
            const maxRow = Math.floor((cap - 1) / cols);
            this.benchIndex = clamp(clamp(row + dy, 0, maxRow) * cols + clamp(col + dx, 0, cols - 1), 0, cap - 1);
            if (dy < 0 && row === 0) this.currentRegion = "SHOP";
            return;
        }
        const { maxY } = this.getBounds();
        this.currentRegion = "BOARD";
        this.cursorCol = clamp(this.cursorCol + dx, 0, PLAYER_COLS - 1);
        this.cursorRow = clamp(this.cursorRow + dy, 0, maxY);
        if (dy > 0 && this.cursorRow >= maxY) this.currentRegion = "BENCH";
    }

    /** Dispatch confirm action for the active navigation region. */
    public handleConfirm(callbacks: GamepadCallbacks): void {
        if (this.currentRegion === "SHOP") {
            callbacks.buyFromShop?.(this.shopIndex);
        } else if (this.currentRegion === "BENCH") {
            callbacks.onBenchClick?.(this.benchIndex);
            if (this.scene.selectedBenchIndex != null) this.currentRegion = "BOARD";
        } else {
            callbacks.onPlayerCellClick?.(this.cursorRow, this.cursorCol);
        }
    }

    /** Dispatch cancel action or return to board selection. */
    public handleCancel(callbacks: GamepadCallbacks): void {
        if (this.scene.selectedBenchIndex != null) {
            callbacks.onCancelSelection?.();
            return;
        }
        this.currentRegion = "BOARD";
    }

    /** Return whether a blocking modal is currently open. */
    public isModalOpen(): boolean {
        return !!(this.scene.settingsVisible || this.scene.historyModalVisible || this.scene.versionInfoVisible || this.scene.libraryModal?.isOpen());
    }

    /** Let the Three.js host render the cursor; no Phaser graphics are created. */
    public refreshCursorVisual(_layer?: unknown): void {
        if (!this.active || this.isModalOpen()) return;
    }

    /** Poll gamepad state once; call from the host render/update loop. */
    public update(callbacks: GamepadCallbacks = {}): void {
        const pad = this.getActivePad();
        this.active = !!pad;
        if (!pad) {
            this.refreshCursorVisual();
            return;
        }

        const now = this.scene.time?.now ?? Date.now();
        const { dx, dy } = this.readPadDirection(pad);
        if (dx !== 0 || dy !== 0) {
            const dirChanged = dx !== this.lastDirection.x || dy !== this.lastDirection.y;
            if (dirChanged || now >= this.lastMoveTime) {
                if (!this.isModalOpen()) this.handleMove(dx, dy);
                this.lastMoveTime = now + (dirChanged ? this.debounceMs : this.repeatMs);
                this.lastDirection = { x: dx, y: dy };
            }
        } else {
            this.lastDirection = { x: 0, y: 0 };
            this.lastMoveTime = 0;
        }

        const confirmPressed = this.consumePadButton(pad, 0);
        const cancelPressed = this.consumePadButton(pad, 1);
        if (this.isModalOpen()) {
            if (confirmPressed || cancelPressed) callbacks.onCloseModal?.();
            return;
        }
        if (confirmPressed) this.handleConfirm(callbacks);
        if (cancelPressed) this.handleCancel(callbacks);
        if (this.consumePadButton(pad, 2)) this.currentRegion = "SHOP";
        if (this.consumePadButton(pad, 3)) this.currentRegion = "BOARD";
        if (this.consumePadButton(pad, 4)) this.currentRegion = "BENCH";
        if (this.consumePadButton(pad, 5)) this.currentRegion = "SHOP";
        if (this.consumePadButton(pad, 8)) callbacks.onSettingsToggle?.();
        if (this.consumePadButton(pad, 9)) callbacks.onCombatStart?.();
        this.refreshCursorVisual();
    }

    /**
     * ========================================================================
     * 5. PUBLIC METHODS — TOUCH INPUT
     * ========================================================================
     */

    /** Return the responsive minimum touch target for the host viewport. */
    public getTouchTargetSize(): number {
        return Math.max(TOUCH_TARGET_FALLBACK, getMinTouchTarget(this.scene));
    }

    /** Begin a touch gesture from a normalized point or DOM-like event. */
    public handleTouchStart(input: unknown): boolean {
        const point = toTouchPoint(input);
        if (!point) return false;
        this.touchStartPoint = point;
        this.touchLastPoint = point;
        this.active = true;
        return true;
    }

    /** Convert a touch movement into one or more grid steps. */
    public handleTouchMove(input: unknown, callbacks: GamepadCallbacks = this.touchCallbacks): boolean {
        const point = toTouchPoint(input);
        if (!point || !this.touchStartPoint || this.isModalOpen()) return false;
        const previous = this.touchLastPoint ?? this.touchStartPoint;
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.touchSwipeThreshold) return false;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        this.handleMove(horizontal ? (dx > 0 ? 1 : -1) : 0, horizontal ? 0 : (dy > 0 ? 1 : -1));
        this.touchLastPoint = point;
        this.refreshCursorVisual();
        return true;
    }

    /** Treat a short touch as confirm; finish longer swipes without duplicate taps. */
    public handleTouchEnd(input: unknown, callbacks: GamepadCallbacks = this.touchCallbacks): boolean {
        const point = toTouchPoint(input) ?? this.touchLastPoint;
        if (!point || !this.touchStartPoint) return false;
        const distance = Math.hypot(point.x - this.touchStartPoint.x, point.y - this.touchStartPoint.y);
        const handled = distance <= TOUCH_TAP_MAX_DISTANCE;
        if (handled) {
            if (this.isModalOpen()) callbacks.onCloseModal?.();
            else this.handleConfirm(callbacks);
        }
        this.touchStartPoint = null;
        this.touchLastPoint = null;
        return handled;
    }

    /** Bind touchstart/move/end listeners to a Three.js canvas-like target. */
    public bindTouchInput(target: TouchInputTarget, callbacks: GamepadCallbacks = {}): () => void {
        this.unbindTouchInput();
        this.touchTarget = target;
        this.touchCallbacks = callbacks;
        target.addEventListener("touchstart", this.boundTouchStart, { passive: false });
        target.addEventListener("touchmove", this.boundTouchMove, { passive: false });
        target.addEventListener("touchend", this.boundTouchEnd, { passive: false });
        return () => this.unbindTouchInput();
    }

    /** Remove touch listeners and clear the active gesture. */
    public unbindTouchInput(): void {
        if (this.touchTarget) {
            this.touchTarget.removeEventListener("touchstart", this.boundTouchStart);
            this.touchTarget.removeEventListener("touchmove", this.boundTouchMove);
            this.touchTarget.removeEventListener("touchend", this.boundTouchEnd);
        }
        this.touchTarget = null;
        this.touchStartPoint = null;
        this.touchLastPoint = null;
        this.touchCallbacks = {};
    }

    /**
     * ========================================================================
     * 6. PUBLIC METHODS — LIFECYCLE
     * ========================================================================
     */

    /** Register gamepad connection listeners. */
    public enable(): void {
        const gp = this.scene.input?.gamepad;
        if (!gp) return;
        gp.on("connected", this.onGamepadConnected);
        gp.on("disconnected", this.onGamepadDisconnected);
    }

    /** Remove gamepad connection listeners. */
    public disable(): void {
        const gp = this.scene.input?.gamepad;
        if (!gp) return;
        gp.off("connected", this.onGamepadConnected);
        gp.off("disconnected", this.onGamepadDisconnected);
    }

    /** Release gamepad and touch listeners. */
    public destroy(): void {
        this.disable();
        this.unbindTouchInput();
    }

    /**
     * ========================================================================
     * 7. PRIVATE METHODS
     * ========================================================================
     */

    private getPadsSome(check: (pad: GamepadPadLike) => boolean): boolean {
        const pads = (this.scene.input?.gamepad?.getAll?.() ?? []) as GamepadPadLike[];
        return pads.some(check);
    }

    private preventTouchDefault(input: unknown): void {
        if (typeof input !== "object" || input === null) return;
        const preventDefault = (input as { preventDefault?: unknown }).preventDefault;
        if (typeof preventDefault === "function") preventDefault.call(input);
    }
}

/**
 * ============================================================================
 * 8. PRIVATE FUNCTIONS
 * ============================================================================
 */

function toTouchPoint(input: unknown): TouchPoint | null {
    if (!input || typeof input !== "object") return null;
    const value = input as {
        x?: unknown;
        y?: unknown;
        clientX?: unknown;
        clientY?: unknown;
        touches?: ArrayLike<{ clientX?: unknown; clientY?: unknown }>;
        changedTouches?: ArrayLike<{ clientX?: unknown; clientY?: unknown }>;
    };
    const touch = value.touches?.[0] ?? value.changedTouches?.[0] ?? value;
    const x = Number(value.x ?? touch?.clientX);
    const y = Number(value.y ?? touch?.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

/**
 * ============================================================================
 * 9. EXPORTS
 * ============================================================================
 */

export default GamepadController;
