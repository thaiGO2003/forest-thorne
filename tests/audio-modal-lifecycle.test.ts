import { afterEach, describe, expect, it, vi } from "vitest";
import { createModalHost } from "../src/ui/modal";

afterEach(() => vi.unstubAllGlobals());

describe("modal ownership across app lifetimes", () => {
  it("releases each Escape listener when its host is disposed", () => {
    const keydownListeners = new Set<EventListenerOrEventListenerObject>();
    vi.stubGlobal("addEventListener", vi.fn((name: string, handler: EventListenerOrEventListenerObject) => {
      if (name === "keydown") keydownListeners.add(handler);
    }));
    vi.stubGlobal("removeEventListener", vi.fn((name: string, handler: EventListenerOrEventListenerObject) => {
      if (name === "keydown") keydownListeners.delete(handler);
    }));

    const layer = {} as HTMLElement;
    const previous = createModalHost(layer);
    expect(keydownListeners.size).toBe(1);
    previous.dispose();
    expect(keydownListeners.size).toBe(0);

    const next = createModalHost(layer);
    expect(keydownListeners.size).toBe(1);
    next.dispose();
    expect(keydownListeners.size).toBe(0);
  });
});
