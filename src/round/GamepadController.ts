// Disposable gamepad polling/controller semantics (mega prompt A49.2).

export type GamepadSemanticAction =
  | "confirm"
  | "cancel"
  | "up"
  | "down"
  | "left"
  | "right"
  | "primary"
  | "secondary";

export interface GamepadActionBinding {
  action: GamepadSemanticAction;
  buttonIndex: number;
  repeatable?: boolean;
}

export interface GamepadControllerOptions {
  bindings?: readonly GamepadActionBinding[];
  deadzone?: number;
  onAction(action: GamepadSemanticAction): void;
  isBlocked?: () => boolean;
  onConnected?: (gamepad: Gamepad) => void;
  onDisconnected?: (gamepad: Gamepad | null) => void;
  getGamepads?: () => readonly (Gamepad | null)[];
  eventTarget?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
}

const DEFAULT_BINDINGS: readonly GamepadActionBinding[] = [
  { action: "confirm", buttonIndex: 0 },
  { action: "cancel", buttonIndex: 1 },
  { action: "primary", buttonIndex: 2 },
  { action: "secondary", buttonIndex: 3 },
  { action: "up", buttonIndex: 12 },
  { action: "down", buttonIndex: 13 },
  { action: "left", buttonIndex: 14 },
  { action: "right", buttonIndex: 15 },
];

export class GamepadController {
  private readonly options: GamepadControllerOptions;
  private readonly bindings: readonly GamepadActionBinding[];
  private readonly latched = new Map<number, boolean>();
  private readonly eventTarget: GamepadControllerOptions["eventTarget"];
  private connectedIndex: number | null = null;
  private destroyed = false;

  private readonly onConnectEvent = (event: Event): void => {
    const gamepad = (event as GamepadEvent).gamepad;
    this.connectedIndex = gamepad.index;
    this.latched.clear();
    this.options.onConnected?.(gamepad);
  };

  private readonly onDisconnectEvent = (event: Event): void => {
    const gamepad = (event as GamepadEvent).gamepad;
    if (this.connectedIndex === gamepad.index) {
      this.connectedIndex = null;
      this.latched.clear();
      this.options.onDisconnected?.(gamepad);
    }
  };

  constructor(options: GamepadControllerOptions) {
    this.options = options;
    this.bindings = options.bindings ?? DEFAULT_BINDINGS;
    this.eventTarget = options.eventTarget
      ?? (typeof window !== "undefined" ? window : null);
    this.eventTarget?.addEventListener("gamepadconnected", this.onConnectEvent);
    this.eventTarget?.addEventListener("gamepaddisconnected", this.onDisconnectEvent);
  }

  private gamepads(): readonly (Gamepad | null)[] {
    if (this.options.getGamepads) return this.options.getGamepads();
    if (typeof navigator !== "undefined" && typeof navigator.getGamepads === "function") {
      return navigator.getGamepads();
    }
    return [];
  }

  private firstConnected(): Gamepad | null {
    const pads = this.gamepads();
    if (this.connectedIndex !== null) {
      const preferred = pads.find((pad) => pad?.index === this.connectedIndex) ?? null;
      if (preferred?.connected !== false) return preferred;
    }
    const first = pads.find((pad): pad is Gamepad => !!pad && pad.connected !== false) ?? null;
    if (first && this.connectedIndex !== first.index) {
      this.connectedIndex = first.index;
      this.latched.clear();
      this.options.onConnected?.(first);
    }
    return first;
  }

  poll(): number {
    if (this.destroyed) return 0;
    const gamepad = this.firstConnected();
    if (!gamepad) {
      if (this.connectedIndex !== null) {
        this.connectedIndex = null;
        this.latched.clear();
        this.options.onDisconnected?.(null);
      }
      return 0;
    }
    const blocked = this.options.isBlocked?.() === true;
    let dispatched = 0;
    for (const binding of this.bindings) {
      const pressed = gamepad.buttons[binding.buttonIndex]?.pressed === true;
      const wasPressed = this.latched.get(binding.buttonIndex) === true;
      if (pressed && (binding.repeatable === true || !wasPressed) && !blocked) {
        this.options.onAction(binding.action);
        dispatched++;
      }
      this.latched.set(binding.buttonIndex, pressed);
    }
    return dispatched;
  }

  reset(): void {
    this.latched.clear();
    this.connectedIndex = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.eventTarget?.removeEventListener("gamepadconnected", this.onConnectEvent);
    this.eventTarget?.removeEventListener("gamepaddisconnected", this.onDisconnectEvent);
    this.reset();
  }
}
