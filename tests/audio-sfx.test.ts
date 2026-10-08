import { describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "../src/core/settings";
import {
  createSemanticSfxManager,
  normalizeSemanticSfxEvent,
  normalizedMasterVolume,
  type SfxAudioContextLike,
} from "../src/audio/SoundEffects";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

describe("semantic SFX A45", () => {
  it("normalizes authored events and legacy aliases", () => {
    expect(normalizeSemanticSfxEvent("attack")).toBe("hit");
    expect(normalizeSemanticSfxEvent("shop_buy")).toBe("buy");
    expect(normalizeSemanticSfxEvent("buy_unit")).toBe("buy");
    expect(normalizeSemanticSfxEvent("shop_reroll")).toBe("reroll");
    expect(normalizeSemanticSfxEvent("win")).toBe("victory");
    expect(normalizeSemanticSfxEvent("loss")).toBe("defeat");
    expect(normalizeSemanticSfxEvent("heal")).toBe("heal");
    expect(normalizeSemanticSfxEvent("unknown")).toBeNull();
  });

  it("derives master volume from canonical settings", () => {
    expect(normalizedMasterVolume({ audioEnabled: true, audioMuted: false, volumeLevel: 7 })).toBe(0.7);
    expect(normalizedMasterVolume({ audioEnabled: false, audioMuted: false, volumeLevel: 7 })).toBe(0);
    expect(normalizedMasterVolume({ audioEnabled: true, audioMuted: true, volumeLevel: 7 })).toBe(0);
  });

  it("prefers a loaded sample and reacts to settings changes", async () => {
    const settings = createSettingsStore(memoryStorage());
    settings.save({ volumeLevel: 8 });
    const play = vi.fn();
    const manager = createSemanticSfxManager({
      settings,
      samples: { has: (key) => key === "impact", play },
      eventSamples: { hit: "impact" },
      createAudioContext: () => { throw new Error("sample path should win"); },
    });

    expect(await manager.play("attack")).toBe("sample");
    expect(play).toHaveBeenCalledWith("impact", 0.48);
    settings.save({ audioMuted: true });
    expect(await manager.play("hit")).toBe("none");
    expect(play).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it("falls back to a short oscillator and resumes a suspended context", async () => {
    const settings = createSettingsStore(memoryStorage());
    const resume = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const frequency = { value: 0 };
    const gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    const context: SfxAudioContextLike = {
      currentTime: 3,
      destination: {},
      state: "suspended",
      resume,
      createOscillator: () => ({ type: "sine", frequency, connect: vi.fn(), start, stop }),
      createGain: () => ({ gain, connect: vi.fn() }),
    };
    const manager = createSemanticSfxManager({ settings, createAudioContext: () => context });

    expect(await manager.play("heal", { waveform: "triangle", pitchMultiplier: 2 })).toBe("oscillator");
    expect(resume).toHaveBeenCalledOnce();
    expect(frequency.value).toBe(1080);
    expect(start).toHaveBeenCalledWith(3);
    expect(stop).toHaveBeenCalledWith(3.08);
    manager.dispose();
  });

  it("is a safe no-op when neither sample nor Web Audio is available", async () => {
    const settings = createSettingsStore(memoryStorage());
    const manager = createSemanticSfxManager({ settings, createAudioContext: () => null });
    await expect(manager.play("victory")).resolves.toBe("none");
    manager.dispose();
  });
});
