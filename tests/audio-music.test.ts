import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "../src/core/settings";
import {
  createMusicDirector,
  MUSIC_CROSSFADE_MS,
  type MusicAudioElement,
  type MusicGestureTarget,
  type MusicPlaylists,
} from "../src/audio/MusicDirector";

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

function audioFactory(rejectFirst = false) {
  const created: Array<MusicAudioElement & { paused: boolean }> = [];
  let shouldReject = rejectFirst;
  const factory = () => {
    const audio: MusicAudioElement & { paused: boolean } = {
      src: "",
      currentTime: 0,
      volume: 1,
      loop: false,
      onended: null,
      paused: false,
      play: () => {
        audio.paused = false;
        if (shouldReject) {
          shouldReject = false;
          return Promise.reject(new Error("autoplay blocked"));
        }
      },
      pause: () => { audio.paused = true; },
      removeAttribute: (name) => { if (name === "src") audio.src = ""; },
      load: vi.fn(),
    };
    created.push(audio);
    return audio;
  };
  return { created, factory };
}

function gestureTarget(): MusicGestureTarget & { fire(): void; count(): number } {
  const listeners = new Set<() => void>();
  return {
    addEventListener: (_type, listener) => { listeners.add(listener); },
    removeEventListener: (_type, listener) => { listeners.delete(listener); },
    fire: () => { for (const listener of [...listeners]) listener(); },
    count: () => listeners.size,
  };
}

const playlists: MusicPlaylists = {
  menu: { id: "menu", shuffle: true, tracks: [
    { key: "menu-a", src: "/menu-a.mp3" },
    { key: "menu-b", src: "/menu-b.mp3" },
    { key: "menu-long", src: "/menu-long.mp3", longPlay: true },
  ] },
  planning: { id: "planning", tracks: [{ key: "plan", src: "/plan.mp3" }] },
  combat: { id: "combat", tracks: [{ key: "fight-a", src: "/fight-a.mp3" }, { key: "fight-b", src: "/fight-b.mp3" }] },
  victory: { id: "victory", tracks: [] },
};

describe("music director A45", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs headless as a safe no-op when Audio is unavailable", () => {
    const settings = createSettingsStore(memoryStorage());
    const director = createMusicDirector({ settings, playlists, createAudioElement: () => null });
    expect(() => director.play("menu")).not.toThrow();
    expect(() => director.dispose()).not.toThrow();
  });

  it("treats same context as a no-op and empty playlists as silence", () => {
    const settings = createSettingsStore(memoryStorage());
    const audio = audioFactory();
    const director = createMusicDirector({ settings, playlists, createAudioElement: audio.factory, random: () => 0 });
    director.play("menu");
    director.play("menu");
    expect(audio.created).toHaveLength(1);
    expect(audio.created[0]?.src).toBe("/menu-a.mp3");
    director.play("victory");
    expect(audio.created[0]?.paused).toBe(true);
    expect(audio.created[0]?.src).toBe("");
    director.dispose();
  });

  it("loops a one-track playlist and advances a multi-track playlist", () => {
    const settings = createSettingsStore(memoryStorage());
    const audio = audioFactory();
    const director = createMusicDirector({ settings, playlists, createAudioElement: audio.factory });
    director.play("planning");
    expect(audio.created[0]?.loop).toBe(true);
    director.play("combat");
    expect(audio.created[1]?.loop).toBe(false);
    audio.created[1]?.onended?.();
    expect(audio.created[2]?.src).toBe("/fight-b.mp3");
    director.dispose();
  });

  it("crossfades for 900 ms and releases the outgoing element", () => {
    const settings = createSettingsStore(memoryStorage());
    settings.save({ volumeLevel: 10 });
    const audio = audioFactory();
    const director = createMusicDirector({ settings, playlists, createAudioElement: audio.factory });
    director.play("planning");
    expect(audio.created[0]?.volume).toBe(0.45);
    director.play("combat");
    expect(audio.created).toHaveLength(2);
    expect(audio.created[1]?.volume).toBe(0);
    vi.advanceTimersByTime(MUSIC_CROSSFADE_MS);
    expect(audio.created[1]?.volume).toBeCloseTo(0.45);
    expect(audio.created[0]?.paused).toBe(true);
    expect(audio.created[0]?.src).toBe("");
    director.dispose();
  });

  it("never keeps more than two live elements across rapid transitions", () => {
    const settings = createSettingsStore(memoryStorage());
    const audio = audioFactory();
    const director = createMusicDirector({ settings, playlists, createAudioElement: audio.factory });
    director.play("planning");
    director.play("combat");
    director.play("menu");
    const live = audio.created.filter((entry) => !entry.paused && entry.src !== "");
    expect(live).toHaveLength(2);
    expect(audio.created[0]?.src).toBe("");
    director.dispose();
  });

  it("recovers an autoplay rejection using the currently desired context", async () => {
    const settings = createSettingsStore(memoryStorage());
    const audio = audioFactory(true);
    const gestures = gestureTarget();
    const director = createMusicDirector({ settings, playlists, createAudioElement: audio.factory, gestureTarget: gestures });
    director.play("menu");
    await Promise.resolve();
    expect(gestures.count()).toBeGreaterThan(0);
    director.play("combat");
    gestures.fire();
    expect(audio.created.at(-1)?.src).toBe("/fight-a.mp3");
    director.dispose();
    expect(gestures.count()).toBe(0);
  });
});
