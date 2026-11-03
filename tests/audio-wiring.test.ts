import { describe, expect, it, vi } from "vitest";
import { combatEventSfx, combatFeedback, shopFeedback } from "../src/audio/combatFeedback";
import { normalizedSfxVolume } from "../src/audio/SoundEffects";
import { registerAppTeardown, TEARDOWN_EVENTS } from "../src/app/teardown";

const settings = (patch: Record<string, unknown> = {}) => ({
  audioEnabled: true, audioMuted: false, volumeLevel: 10, sfxVolume: 10, ...patch,
});

describe("combat outcome audio (#12)", () => {
  it("keeps music and SFX on the same decision for win and loss", () => {
    expect(combatFeedback("LEFT")).toEqual({ music: "victory", sfx: "victory" });
    expect(combatFeedback("RIGHT")).toEqual({ music: "defeat", sfx: "defeat" });
  });

  it("never claims a win or a defeat theme for a draw", () => {
    const draw = combatFeedback("DRAW");
    expect(draw.sfx).toBe("draw");
    expect(draw.music).toBe("ambient");
    expect(draw.music).not.toBe("victory");
    expect(draw.music).not.toBe("defeat");
  });

  it("maps combat events to the SFX keys used by the player", () => {
    expect(combatEventSfx("basic")).toBe("hit");
    expect(combatEventSfx("skill")).toBe("skill");
    expect(combatEventSfx("heal")).toBe("heal");
    expect(combatEventSfx("death")).toBe("ko");
    expect(combatEventSfx("status")).toBeNull();
    expect(combatEventSfx("")).toBeNull();
  });

  it("stays silent when a shop action fails", () => {
    expect(shopFeedback("buy", false)).toBeNull();
    expect(shopFeedback("reroll", false)).toBeNull();
    expect(shopFeedback("xp", false)).toBeNull();
    expect(shopFeedback("buy", true)).toBe("buy");
    expect(shopFeedback("xp", true)).toBe("buy");
    expect(shopFeedback("reroll", true)).toBe("reroll");
  });
});

describe("independent SFX volume (#12)", () => {
  it("scales master volume by the sfxVolume knob", () => {
    expect(normalizedSfxVolume(settings())).toBeCloseTo(1);
    expect(normalizedSfxVolume(settings({ sfxVolume: 5 }))).toBeCloseTo(0.5);
    expect(normalizedSfxVolume(settings({ volumeLevel: 5, sfxVolume: 5 }))).toBeCloseTo(0.25);
    expect(normalizedSfxVolume(settings({ sfxVolume: 0 }))).toBe(0);
  });

  it("respects the global mute flags and unknown knob values", () => {
    expect(normalizedSfxVolume(settings({ audioMuted: true }))).toBe(0);
    expect(normalizedSfxVolume(settings({ audioEnabled: false }))).toBe(0);
    expect(normalizedSfxVolume({ audioEnabled: true, audioMuted: false, volumeLevel: 10 })).toBeCloseTo(1);
    expect(normalizedSfxVolume(settings({ sfxVolume: 99 }))).toBeCloseTo(1);
    expect(normalizedSfxVolume(settings({ sfxVolume: Number.NaN }))).toBeCloseTo(1);
  });
});

describe("app teardown registration (#12)", () => {
  const fakeTarget = () => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      listeners,
      addEventListener(type: string, fn: () => void) {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      removeEventListener(type: string, fn: () => void) { listeners.get(type)?.delete(fn); },
      fire(type: string) { for (const fn of [...(listeners.get(type) ?? [])]) fn(); },
    };
  };

  it("subscribes to the page lifecycle events production needs", () => {
    const target = fakeTarget();
    const dispose = vi.fn();
    const registration = registerAppTeardown(target, dispose);
    expect(registration.events).toEqual([...TEARDOWN_EVENTS]);
    expect([...target.listeners.keys()].sort()).toEqual(["beforeunload", "pagehide"]);
    target.fire("pagehide");
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes once even when pagehide and beforeunload both fire", () => {
    const target = fakeTarget();
    const dispose = vi.fn();
    registerAppTeardown(target, dispose);
    target.fire("pagehide");
    target.fire("beforeunload");
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("hooks HMR disposal and can unregister the window listeners", () => {
    const target = fakeTarget();
    const dispose = vi.fn();
    let hotDispose: (() => void) | null = null;
    const registration = registerAppTeardown(target, dispose, { dispose: (cb) => { hotDispose = cb; } });
    expect(hotDispose).not.toBeNull();
    registration.unregister();
    target.fire("pagehide");
    expect(dispose).not.toHaveBeenCalled();
    hotDispose!();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("survives a throwing teardown and a missing window", () => {
    const target = fakeTarget();
    expect(() => {
      registerAppTeardown(target, () => { throw new Error("boom"); });
      target.fire("pagehide");
    }).not.toThrow();
    expect(() => registerAppTeardown(null, () => {})).not.toThrow();
  });
});
