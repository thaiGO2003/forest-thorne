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
    settings.save({ musicEnabled: false });
    expect(await manager.play("hit")).toBe("sample");
    expect(play).toHaveBeenCalledTimes(2);
    settings.save({ audioMuted: true });
    expect(await manager.play("hit")).toBe("none");
    expect(play).toHaveBeenCalledTimes(2);
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
  it("recovers when AudioContext becomes available after an initial failure", async () => {
    const settings = createSettingsStore(memoryStorage());
    const oscillator = { type: "sine" as OscillatorType, frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const context: SfxAudioContextLike = {
      currentTime: 0,
      destination: {},
      state: "running",
      createOscillator: () => oscillator,
      createGain: () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
    };
    const createAudioContext = vi.fn().mockReturnValueOnce(null).mockReturnValue(context);
    const manager = createSemanticSfxManager({ settings, createAudioContext });
    expect(await manager.play("hit")).toBe("none");
    expect(await manager.play("hit")).toBe("oscillator");
    expect(createAudioContext).toHaveBeenCalledTimes(2);
    expect(oscillator.start).toHaveBeenCalledOnce();
    manager.dispose();
  });
  it("replaces an externally closed AudioContext on the next event", async () => {
    const settings = createSettingsStore(memoryStorage());
    const firstOscillatorStart = vi.fn();
    const nextOscillatorStart = vi.fn();
    let state: AudioContextState = "running";
    const makeContext = (start: () => void, getState: () => AudioContextState): SfxAudioContextLike => ({
      currentTime: 0,
      destination: {},
      get state() { return getState(); },
      createOscillator: () => ({
        type: "sine", frequency: { value: 0 }, connect: vi.fn(),
        start, stop: vi.fn(),
      }),
      createGain: () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
    });
    const replacement = makeContext(nextOscillatorStart, () => "running");
    const initial = makeContext(firstOscillatorStart, () => state);
    const factory = vi.fn().mockReturnValueOnce(initial).mockReturnValue(replacement);
    const manager = createSemanticSfxManager({ settings, createAudioContext: factory });
    expect(await manager.play("hit")).toBe("oscillator");
    state = "closed";
    expect(await manager.play("hit")).toBe("oscillator");
    expect(factory).toHaveBeenCalledTimes(2);
    expect(firstOscillatorStart).toHaveBeenCalledOnce();
    expect(nextOscillatorStart).toHaveBeenCalledOnce();
    manager.dispose();
  });

  it("ignores asynchronous resume when muted or disposed before it settles", async () => {
    const settings = createSettingsStore(memoryStorage());
    let resolveResume = () => {};
    const oscillator = vi.fn();
    const createContext = (): SfxAudioContextLike => ({
      currentTime: 0,
      destination: {},
      state: "suspended",
      resume: () => new Promise<void>((resolve) => { resolveResume = () => resolve(); }),
      createOscillator: () => { oscillator(); throw new Error("must not create a voice"); },
      createGain: () => { throw new Error("must not allocate gain"); },
      close: vi.fn(),
    });
    const manager = createSemanticSfxManager({ settings, createAudioContext: createContext });
    const pendingMuted = manager.play("click");
    settings.save({ audioMuted: true });
    resolveResume();
    await expect(pendingMuted).resolves.toBe("none");
    expect(oscillator).not.toHaveBeenCalled();
    manager.dispose();

    settings.save({ audioMuted: false });
    const disposedManager = createSemanticSfxManager({ settings, createAudioContext: createContext });
    const pendingDisposed = disposedManager.play("click");
    disposedManager.dispose();
    resolveResume();
    await expect(pendingDisposed).resolves.toBe("none");
    expect(oscillator).not.toHaveBeenCalled();
  });

  it("caps concurrent procedural voices and disconnects completed or muted nodes", async () => {
    const settings = createSettingsStore(memoryStorage());
    const oscillators: Array<{
      onended: (() => void) | null;
      stop: () => void;
      disconnect: () => void;
    }> = [];
    const gainNodes: Array<{ disconnect: () => void }> = [];
    const context: SfxAudioContextLike = {
      currentTime: 0,
      destination: {},
      state: "running",
      createOscillator: () => {
        const node = {
          type: "sine" as OscillatorType,
          frequency: { value: 0 },
          onended: null as (() => void) | null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(node);
        return node;
      },
      createGain: () => {
        const node = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        gainNodes.push(node);
        return node;
      },
    };
    const manager = createSemanticSfxManager({ settings, createAudioContext: () => context });
    for (let i = 0; i < 12; i++) expect(await manager.play("hit")).toBe("oscillator");
    expect(await manager.play("hit")).toBe("none");
    expect(oscillators).toHaveLength(12);
    oscillators[0]!.onended?.();
    expect(oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    expect(gainNodes[0]!.disconnect).toHaveBeenCalledOnce();
    expect(await manager.play("hit")).toBe("oscillator");
    settings.save({ audioMuted: true });
    expect(oscillators[12]!.stop).toHaveBeenCalledTimes(2); // scheduled stop, then forced cleanup
    expect(oscillators[12]!.disconnect).toHaveBeenCalledOnce();
    manager.dispose();
  });

  it("uses its oscillator fallback if a sample lookup throws", async () => {
    const settings = createSettingsStore(memoryStorage());
    const context: SfxAudioContextLike = {
      currentTime: 0,
      destination: {},
      createOscillator: () => ({ type: "sine", frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
      createGain: () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
    };
    const manager = createSemanticSfxManager({
      settings,
      samples: { has: () => { throw new Error("unavailable"); }, play: vi.fn() },
      eventSamples: { hit: "missing" },
      createAudioContext: () => context,
    });
    await expect(manager.play("hit")).resolves.toBe("oscillator");
    manager.dispose();
  });

});
