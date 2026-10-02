import { describe, expect, it } from "vitest";
import {
  GamepadController,
  type GamepadSemanticAction,
} from "../src/round/GamepadController";

function button(pressed: boolean): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function gamepad(index: number, pressedIndices: readonly number[] = []): Gamepad {
  const buttons = Array.from({ length: 16 }, (_, buttonIndex) =>
    button(pressedIndices.includes(buttonIndex)));
  return {
    axes: [],
    buttons,
    connected: true,
    hapticActuators: [],
    id: `pad-${index}`,
    index,
    mapping: "standard",
    timestamp: 1,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

function eventTargetHarness(): {
  target: Pick<Window, "addEventListener" | "removeEventListener">;
  added: string[];
  removed: string[];
  dispatch(type: string, pad: Gamepad): void;
} {
  const listeners = new Map<string, EventListenerOrEventListenerObject>();
  const added: string[] = [];
  const removed: string[] = [];
  const target = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.set(type, listener);
      added.push(type);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (listeners.get(type) === listener) listeners.delete(type);
      removed.push(type);
    },
  } as unknown as Pick<Window, "addEventListener" | "removeEventListener">;
  return {
    target,
    added,
    removed,
    dispatch(type, pad) {
      const listener = listeners.get(type);
      if (!listener) return;
      const event = { gamepad: pad } as GamepadEvent;
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    },
  };
}

describe("GamepadController", () => {
  it("dispatches held buttons only on the press edge", () => {
    const actions: GamepadSemanticAction[] = [];
    let pad = gamepad(0, [0]);
    const controller = new GamepadController({
      onAction: (action) => actions.push(action),
      getGamepads: () => [pad],
      eventTarget: null,
    });
    expect(controller.poll()).toBe(1);
    expect(controller.poll()).toBe(0);
    pad = gamepad(0, []);
    controller.poll();
    pad = gamepad(0, [0]);
    expect(controller.poll()).toBe(1);
    expect(actions).toEqual(["confirm", "confirm"]);
  });

  it("keeps blocked held input latched until release", () => {
    const actions: GamepadSemanticAction[] = [];
    let blocked = true;
    let pad = gamepad(0, [0]);
    const controller = new GamepadController({
      onAction: (action) => actions.push(action),
      isBlocked: () => blocked,
      getGamepads: () => [pad],
      eventTarget: null,
    });
    expect(controller.poll()).toBe(0);
    blocked = false;
    expect(controller.poll()).toBe(0);
    pad = gamepad(0, []);
    controller.poll();
    pad = gamepad(0, [0]);
    expect(controller.poll()).toBe(1);
    expect(actions).toEqual(["confirm"]);
  });

  it("supports explicit repeatable bindings", () => {
    const actions: GamepadSemanticAction[] = [];
    const controller = new GamepadController({
      bindings: [{ action: "down", buttonIndex: 13, repeatable: true }],
      onAction: (action) => actions.push(action),
      getGamepads: () => [gamepad(0, [13])],
      eventTarget: null,
    });
    expect(controller.poll()).toBe(1);
    expect(controller.poll()).toBe(1);
    expect(actions).toEqual(["down", "down"]);
  });

  it("resets on disconnect and removes global listeners exactly once", () => {
    const harness = eventTargetHarness();
    const disconnected: (number | null)[] = [];
    let pads: readonly (Gamepad | null)[] = [gamepad(2, [0])];
    const controller = new GamepadController({
      onAction: () => undefined,
      onDisconnected: (pad) => disconnected.push(pad?.index ?? null),
      getGamepads: () => pads,
      eventTarget: harness.target,
    });
    expect(harness.added).toEqual(["gamepadconnected", "gamepaddisconnected"]);
    expect(controller.poll()).toBe(1);
    pads = [];
    expect(controller.poll()).toBe(0);
    expect(disconnected).toEqual([null]);

    harness.dispatch("gamepadconnected", gamepad(3));
    harness.dispatch("gamepaddisconnected", gamepad(3));
    expect(disconnected).toEqual([null, 3]);

    controller.destroy();
    controller.destroy();
    expect(harness.removed).toEqual(["gamepadconnected", "gamepaddisconnected"]);
    expect(controller.poll()).toBe(0);
  });
});
