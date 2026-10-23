import { clamp, gridKey } from "./gameUtils.js";
import { PLAYER_COLS, ROWS } from "./boardConstants.js";

interface GamepadCallbacks {
    buyFromShop?: (index: number) => void;
    onBenchClick?: (index: number) => void;
    onPlayerCellClick?: (row: number, col: number) => void;
    onCancelSelection?: () => void;
    onCloseModal?: () => void;
    onSettingsToggle?: () => void;
    onCombatStart?: () => void;
}

interface GamepadControllerConfig {
    debounceMs?: number;
    repeatMs?: number;
    cursorColor?: number;
    cursorAlpha?: number;
}

interface GamepadSceneMembers {
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
    drawDiamond?: (layer: Phaser.GameObjects.Graphics, x: number, y: number) => void;
}

type GamepadScene = Phaser.Scene & GamepadSceneMembers;

/**
 * Controller xử lý input từ gamepad, quản lý con tróc và tương tác màn hình
 */
export class GamepadController {
    scene: GamepadScene;
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
    cursorLayer: Phaser.GameObjects.Graphics | null;
    onGamepadConnected: () => void;
    onGamepadDisconnected: () => void;

    /**
     * Khởi tạo GamepadController
     * @param {Phaser.Scene} scene - Scene sử dụng gamepad
     * @param {Object} [config] - Tùy chọn cấu hình
     */
    constructor(scene: GamepadScene, config: GamepadControllerConfig = {}) {
        this.scene = scene;

        // Config mặc định
        this.debounceMs = config.debounceMs ?? 170;
        this.repeatMs = config.repeatMs ?? 120;
        this.cursorColor = config.cursorColor ?? 0xfff3a1;
        this.cursorAlpha = config.cursorAlpha ?? 0.95;

        // Local state
        this.currentRegion = "BOARD";
        this.cursorRow = ROWS - 1;
        this.cursorCol = 0;
        this.shopIndex = 0;
        this.benchIndex = 0;
        this.buttonLatch = {};
        this.lastMoveTime = 0;
        this.lastDirection = { x: 0, y: 0 };
        this.active = false;

        // Renderer
        this.cursorLayer = this.scene.add.graphics();
        this.cursorLayer.setDepth(3600);

        this.onGamepadConnected = () => {
            this.active = true;
            if (typeof this.scene.addLog === 'function') {
                this.scene.addLog("Đã kết nối tay cầm.");
            }
        };

        this.onGamepadDisconnected = () => {
            const hasPad = this.scene.input.gamepad?.getAll()?.some((pad: Phaser.Input.Gamepad.Gamepad) => pad?.connected);
            this.active = !!hasPad;
            if (!hasPad) {
                this.currentRegion = "BOARD";
                this.cursorLayer?.clear();
            }
            if (typeof this.scene.addLog === 'function') {
                this.scene.addLog("Tay cầm đã ngắt kết nối.");
            }
        };

        this.enable();
    }

    /**
     * Lấy gamepad hiện dang kích hoạt
     * @returns {Phaser.Input.Gamepad.Gamepad|null}
     */
    getActivePad(): Phaser.Input.Gamepad.Gamepad | null {
        const pads = this.scene.input.gamepad?.getAll?.() ?? [];
        return pads.find((pad: Phaser.Input.Gamepad.Gamepad) => pad?.connected) ?? null;
    }

    /**
     * Theo dõi trạng thái nút (nảy/giữ)
     * @param {Phaser.Input.Gamepad.Gamepad} pad
     * @param {number} index
     * @returns {boolean} true nếu mới được nhấn
     */
    consumePadButton(pad: Phaser.Input.Gamepad.Gamepad, index: number) {
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

    /**
     * Đọc vector di chuyển từ D-pad và Joystick
     * @param {Phaser.Input.Gamepad.Gamepad} pad
     * @returns {{dx: number, dy: number}}
     */
    readPadDirection(pad: Phaser.Input.Gamepad.Gamepad) {
        const dpadLeft = !!pad?.buttons?.[14]?.pressed;
        const dpadRight = !!pad?.buttons?.[15]?.pressed;
        const dpadUp = !!pad?.buttons?.[12]?.pressed;
        const dpadDown = !!pad?.buttons?.[13]?.pressed;
        const axisX = Number.isFinite(pad?.axes?.[0]?.getValue?.()) ? pad.axes[0].getValue() : 0;
        const axisY = Number.isFinite(pad?.axes?.[1]?.getValue?.()) ? pad.axes[1].getValue() : 0;
        const left = dpadLeft || axisX < -0.55;
        const right = dpadRight || axisX > 0.55;
        const up = dpadUp || axisY < -0.55;
        const down = dpadDown || axisY > 0.55;
        const dx = left === right ? 0 : left ? -1 : 1;
        const dy = up === down ? 0 : up ? -1 : 1;
        return { dx, dy };
    }

    /**
     * Lấy giới hạn cho region hiện tại
     * @returns {{maxX: number, maxY: number}}
     */
    getBounds() {
        if (this.currentRegion === 'SHOP') {
            return { maxX: 4, maxY: 0 };
        } else if (this.currentRegion === 'BENCH') {
            const cap = Math.max(1, typeof this.scene.getBenchCap === 'function' ? this.scene.getBenchCap() : (this.scene.benchSlots?.length ?? 8));
            const cols = Math.max(1, this.scene.layout?.benchCols ?? 5);
            return { maxX: cols - 1, maxY: Math.floor((cap - 1) / cols) };
        }
        const localBoardRows = Math.max(
            1,
            Array.isArray(this.scene?.player?.board) ? this.scene.player.board.length : ROWS
        );
        return { maxX: PLAYER_COLS - 1, maxY: localBoardRows - 1 };
    }

    /**
     * Xử lý di chuyển với debouncing timeout
     * @param {number} dx
     * @param {number} dy
     */
    handleMove(dx: number, dy: number) {
        if (this.currentRegion === "SHOP") {
            this.shopIndex = clamp(this.shopIndex + dx, 0, 4);
            if (dy < 0) this.currentRegion = "BOARD";
            if (dy > 0) this.currentRegion = "BENCH";
        } else if (this.currentRegion === "BENCH") {
            const cap = Math.max(1, typeof this.scene.getBenchCap === 'function' ? this.scene.getBenchCap() : (this.scene.benchSlots?.length ?? 8));
            const cols = Math.max(1, this.scene.layout?.benchCols ?? 5);
            const index = this.benchIndex;
            const col = index % cols;
            const row = Math.floor(index / cols);
            const maxRow = Math.floor((cap - 1) / cols);
            const nextCol = clamp(col + dx, 0, cols - 1);
            const nextRow = clamp(row + dy, 0, maxRow);
            this.benchIndex = clamp(nextRow * cols + nextCol, 0, cap - 1);
            if (dy < 0 && row === 0) this.currentRegion = "SHOP";
        } else {
            const { maxY } = this.getBounds();
            this.currentRegion = "BOARD";
            this.cursorCol = clamp(this.cursorCol + dx, 0, PLAYER_COLS - 1);
            this.cursorRow = clamp(this.cursorRow + dy, 0, maxY);
            if (dy > 0 && this.cursorRow >= maxY) this.currentRegion = "BENCH";
        }
    }

    /**
     * Xử lý xác nhận/chọn
     * @param {Object} callbacks
     */
    handleConfirm(callbacks: GamepadCallbacks) {
        if (this.currentRegion === "SHOP") {
            if (callbacks.buyFromShop) callbacks.buyFromShop(this.shopIndex);
        } else if (this.currentRegion === "BENCH") {
            if (callbacks.onBenchClick) callbacks.onBenchClick(this.benchIndex);
            if (this.scene.selectedBenchIndex != null) this.currentRegion = "BOARD";
        } else {
            if (callbacks.onPlayerCellClick) callbacks.onPlayerCellClick(this.cursorRow, this.cursorCol);
        }
    }

    /**
     * Xử lý hỷy
     * @param {Object} callbacks
     */
    handleCancel(callbacks: GamepadCallbacks) {
        if (this.scene.selectedBenchIndex != null) {
            if (callbacks.onCancelSelection) callbacks.onCancelSelection();
            return;
        }
        this.currentRegion = "BOARD";
    }

    /**
     * Kiểm tra Modal mở
     */
    isModalOpen() {
        return this.scene.settingsVisible || this.scene.historyModalVisible || this.scene.versionInfoVisible || this.scene.libraryModal?.isOpen();
    }

    /**
     * Vẽ UI con tróc
     */
    refreshCursorVisual() {
        if (!this.cursorLayer) return;
        this.cursorLayer.clear();
        if (!this.active || this.isModalOpen()) return;

        if (this.currentRegion === "SHOP") {
            const card = this.scene.shopCards?.[this.shopIndex];
            if (!card?.bg) return;
            this.cursorLayer.lineStyle(2, this.cursorColor, this.cursorAlpha);
            this.cursorLayer.strokeRect(card.bg.x - card.bg.width / 2, card.bg.y - card.bg.height / 2, card.bg.width, card.bg.height);
        } else if (this.currentRegion === "BENCH") {
            const slot = this.scene.benchSlots?.[this.benchIndex];
            if (!slot?.bg) return;
            this.cursorLayer.lineStyle(2, this.cursorColor, this.cursorAlpha);
            this.cursorLayer.strokeRect(slot.bg.x - slot.slotW / 2, slot.bg.y - slot.slotH / 2, slot.slotW, slot.slotH);
        } else {
            if (!this.scene.tileLookup) return;
            const tile = this.scene.tileLookup.get(gridKey(this.cursorRow, this.cursorCol));
            if (!tile) return;
            this.cursorLayer.lineStyle(3, this.cursorColor, this.cursorAlpha);
            this.cursorLayer.fillStyle(0xffe99b, 0.12);
            if (typeof this.scene.drawDiamond === 'function') {
                this.scene.drawDiamond(this.cursorLayer, tile.center.x, tile.center.y);
            }
        }
    }

    /**
     * Update logic điều khiển, gọi mỗi frame
     * @param {Object} callbacks
     */
    update(callbacks: GamepadCallbacks = {}) {
        const pad = this.getActivePad();
        this.active = !!pad;
        if (!pad) {
            this.cursorLayer?.clear();
            return;
        }

        const now = this.scene.time.now;
        const { dx, dy } = this.readPadDirection(pad);
        const moved = dx !== 0 || dy !== 0;

        if (moved) {
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
            if (confirmPressed || cancelPressed) {
                if (callbacks.onCloseModal) callbacks.onCloseModal();
            }
            return;
        }

        if (confirmPressed) this.handleConfirm(callbacks);
        if (cancelPressed) this.handleCancel(callbacks);

        if (this.consumePadButton(pad, 2)) this.currentRegion = "SHOP";
        if (this.consumePadButton(pad, 3)) this.currentRegion = "BOARD";
        if (this.consumePadButton(pad, 4)) this.currentRegion = "BENCH";
        if (this.consumePadButton(pad, 5)) this.currentRegion = "SHOP";

        if (this.consumePadButton(pad, 8) && callbacks.onSettingsToggle) {
            callbacks.onSettingsToggle();
        }
        if (this.consumePadButton(pad, 9) && callbacks.onCombatStart) {
            callbacks.onCombatStart();
        }

        this.refreshCursorVisual();
    }

    /**
     * Bật gamepad
     */
    enable() {
        this.scene.input.gamepad?.on("connected", this.onGamepadConnected);
        this.scene.input.gamepad?.on("disconnected", this.onGamepadDisconnected);
    }

    /**
     * Tắt gamepad
     */
    disable() {
        this.scene.input.gamepad?.off("connected", this.onGamepadConnected);
        this.scene.input.gamepad?.off("disconnected", this.onGamepadDisconnected);
    }

    /**
     * Dọn dẹp
     */
    destroy() {
        this.disable();
        if (this.cursorLayer) {
            this.cursorLayer.destroy();
            this.cursorLayer = null;
        }
    }
}