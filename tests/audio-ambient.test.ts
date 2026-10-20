import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "../src/core/settings";
import { createForestAmbience, type ForestAmbienceEventTarget } from "../src/audio/ForestAmbience";

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

type AmbientEvent = "pointerdown" | "keydown" | "visibilitychange";

function makeTarget() {
  const listeners = new Map<AmbientEvent, Set<() => void>>();
  const target: ForestAmbienceEventTarget & { hidden: boolean; emit: (type: AmbientEvent) => void; count: (type: AmbientEvent) => number } = {
    hidden: false,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
    count(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
  return target;
}

function makeContext() {
  const oscillators: Array<{
    onended: (() => void) | null;
    stop: () => void;
    disconnect: () => void;
  }> = [];
  const breezeSources: Array<{ stop: () => void; disconnect: () => void }> = [];
  const audioParam = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const context = {
    state: "suspended",
    currentTime: 2,
    sampleRate: 8,
    destination: {},
    resume: vi.fn(async () => { context.state = "running"; }),
    suspend: vi.fn(async () => { context.state = "suspended"; }),
    close: vi.fn(async () => { context.state = "closed"; }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createGain: vi.fn(() => ({ gain: audioParam(), connect: vi.fn(), disconnect: vi.fn() })),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(12) })),
    createOscillator: vi.fn(() => {
      const node = {
        onended: null as (() => void) | null,
        type: "sine" as OscillatorType,
        frequency: audioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => {
      const node = {
        onended: null as (() => void) | null,
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      breezeSources.push(node);
      return node;
    }),
    createBiquadFilter: vi.fn(() => ({
      type: "bandpass",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  };
  return { context, oscillators, breezeSources };
}

afterEach(() => vi.useRealTimers());

describe("procedural forest ambience", () => {
  it("allocates only on a gesture and skips late resume while muted", async () => {
    vi.useFakeTimers();
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const { context, oscillators } = makeContext();
    let completeResume = () => {};
    context.resume = vi.fn(() => new Promise<void>((resolve) => {
      completeResume = () => { context.state = "running"; resolve(); };
    }));
    const createAudioContext = vi.fn(() => context as unknown as AudioContext);
    const ambient = createForestAmbience({ settings, eventTarget: target, createAudioContext, random: () => 0.5 });
    ambient.setActive(true);
    expect(createAudioContext).not.toHaveBeenCalled();
    expect(target.count("pointerdown")).toBe(1);

    target.emit("pointerdown");
    expect(createAudioContext).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
    settings.save({ audioMuted: true });
    completeResume();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(20000);
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();

    settings.save({ audioMuted: false });
    expect(context.resume).toHaveBeenCalledTimes(2);
    completeResume();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(1);
    ambient.setActive(false);
    expect(oscillators[0]!.stop).toHaveBeenCalledTimes(2);
    expect(oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    ambient.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    expect(target.count("pointerdown")).toBe(0);
    expect(target.count("visibilitychange")).toBe(0);
  });

  it("suspends while hidden and resumes scheduling on visibility return", async () => {
    vi.useFakeTimers();
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const { context, oscillators } = makeContext();
    const ambient = createForestAmbience({
      settings,
      eventTarget: target,
      createAudioContext: () => context as unknown as AudioContext,
      random: () => 0.5,
    });
    ambient.setActive(true);
    target.emit("keydown");
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(1);

    target.hidden = true;
    target.emit("visibilitychange");
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(30000);
    expect(oscillators).toHaveLength(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    target.hidden = false;
    target.emit("visibilitychange");
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(2);
    ambient.dispose();
    expect(oscillators[1]!.disconnect).toHaveBeenCalledOnce();
  });

  it("retries after rejected audio unlock on a subsequent gesture", async () => {
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const { context } = makeContext();
    context.resume = vi.fn()
      .mockRejectedValueOnce(new Error("autoplay policy"))
      .mockImplementationOnce(async () => { context.state = "running"; });
    const ambient = createForestAmbience({
      settings,
      eventTarget: target,
      createAudioContext: () => context as unknown as AudioContext,
    });
    ambient.setActive(true);
    target.emit("pointerdown");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(target.count("pointerdown")).toBe(1);
    target.emit("keydown");
    await Promise.resolve();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(target.count("pointerdown")).toBe(0);
    ambient.dispose();
  });

  it("replaces an externally closed ambient context after a new gesture", async () => {
    vi.useFakeTimers();
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const first = makeContext();
    const second = makeContext();
    const createAudioContext = vi.fn()
      .mockReturnValueOnce(first.context as unknown as AudioContext)
      .mockReturnValueOnce(second.context as unknown as AudioContext);
    const ambient = createForestAmbience({
      settings,
      eventTarget: target,
      createAudioContext,
      random: () => 0.5,
    });

    ambient.setActive(true);
    target.emit("pointerdown");
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(first.oscillators).toHaveLength(1);

    await first.context.close();
    target.emit("visibilitychange");
    expect(target.count("pointerdown")).toBe(1);
    target.emit("pointerdown");
    await Promise.resolve();
    vi.advanceTimersByTime(4800);

    expect(createAudioContext).toHaveBeenCalledTimes(2);
    expect(second.oscillators).toHaveLength(1);
    expect(first.oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    ambient.dispose();
    expect(second.context.close).toHaveBeenCalledOnce();
  });

  it("ignores stale suspend settlement after replacing a closed context", async () => {
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const first = makeContext();
    const second = makeContext();
    let finishFirstSuspend = () => {};
    first.context.suspend = vi.fn(() => new Promise<void>((resolve) => {
      finishFirstSuspend = resolve;
    }));
    second.context.suspend = vi.fn(() => new Promise<void>(() => {}));
    const createAudioContext = vi.fn()
      .mockReturnValueOnce(first.context as unknown as AudioContext)
      .mockReturnValueOnce(second.context as unknown as AudioContext);
    const ambient = createForestAmbience({ settings, eventTarget: target, createAudioContext });

    ambient.setActive(true);
    target.emit("pointerdown");
    await Promise.resolve();
    ambient.setActive(false);
    expect(first.context.suspend).toHaveBeenCalledOnce();

    first.context.state = "closed";
    ambient.setActive(true);
    target.emit("pointerdown");
    await Promise.resolve();
    ambient.setActive(false);
    expect(second.context.suspend).toHaveBeenCalledOnce();

    finishFirstSuspend();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    target.emit("visibilitychange");
    expect(second.context.suspend).toHaveBeenCalledOnce();

    ambient.dispose();
  });

  it("does nothing in nonbrowser mode and tolerates missing audio contexts", () => {
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const ambient = createForestAmbience({
      settings,
      eventTarget: target,
      createAudioContext: () => null,
    });
    ambient.setActive(true);
    expect(() => target.emit("pointerdown")).not.toThrow();
    ambient.dispose();
    const headless = createForestAmbience({
      settings,
      eventTarget: null,
      createAudioContext: () => { throw new Error("should never allocate"); },
    });
    expect(() => headless.setActive(true)).not.toThrow();
    headless.dispose();
  });
  it("mutes ambient independently, stops live voices, and resumes after re-enabling", async () => {
    vi.useFakeTimers();
    const settings = createSettingsStore(memoryStorage());
    const target = makeTarget();
    const { context, oscillators } = makeContext();
    const createAudioContext = vi.fn(() => context as unknown as AudioContext);
    const ambient = createForestAmbience({ settings, eventTarget: target, createAudioContext, random: () => 0.5 });
    ambient.setActive(true);
    settings.save({ ambientEnabled: false });
    target.emit("pointerdown");
    expect(createAudioContext).not.toHaveBeenCalled();
    expect(target.count("pointerdown")).toBe(0);

    settings.save({ ambientEnabled: true, musicEnabled: false, uiSfxEnabled: false });
    target.emit("pointerdown");
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(1);
    settings.save({ ambientEnabled: false });
    expect(oscillators[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.suspend).toHaveBeenCalledOnce();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(1);

    settings.save({ ambientEnabled: true });
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(4800);
    expect(oscillators).toHaveLength(2);
    expect(settings.get().musicEnabled).toBe(false);
    ambient.dispose();
  });
});
