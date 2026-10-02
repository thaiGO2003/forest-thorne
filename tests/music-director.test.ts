import { describe, expect, it } from "vitest";
import {
  MUSIC_SESSION_KEY,
  MusicDirector,
  type ManagedAudio,
} from "../src/audio/MusicDirector";
import type { Settings, SettingsStore } from "../src/core/settings";
import type { MusicContext, MusicPlaylist, MusicTrack } from "../src/data/musicPlaylists";

class MemoryStore {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeSettings {
  private readonly listeners = new Set<(settings: Settings) => void>();
  readonly settings = {
    audioEnabled: true,
    audioMuted: false,
    volumeLevel: 10,
  } as Settings;

  get(): Settings {
    return this.settings;
  }

  subscribe(fn: (settings: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(): void {
    for (const listener of this.listeners) listener(this.settings);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

class FakeAudio implements ManagedAudio {
  src: string;
  volume = 0;
  currentTime = 0;
  loop = false;
  onended: (() => void) | null = null;
  playCount = 0;
  pauseCount = 0;
  removedSource = false;

  constructor(source: string) {
    this.src = source;
  }

  play(): Promise<void> {
    this.playCount++;
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCount++;
  }

  removeAttribute(name: string): void {
    if (name === "src") this.removedSource = true;
  }
}

const tracks: Readonly<Record<string, MusicTrack>> = {
  a: { key: "a", sources: ["/a.ogg"] },
  b: { key: "b", sources: ["/b.ogg"] },
  c: { key: "c", sources: ["/c.ogg"] },
};

const playlists: Readonly<Record<MusicContext, MusicPlaylist>> = {
  menu: { id: "menu", tracks: ["a", "b"], shuffle: false },
  planning: { id: "planning", tracks: ["c"], shuffle: false },
  combat: { id: "combat", tracks: [], shuffle: false },
  victory: { id: "victory", tracks: [], shuffle: false },
  defeat: { id: "defeat", tracks: [], shuffle: false },
  ambient: { id: "ambient", tracks: [], shuffle: false },
};

function createHarness(store = new MemoryStore()): {
  director: MusicDirector;
  audios: FakeAudio[];
  settings: FakeSettings;
  store: MemoryStore;
} {
  const audios: FakeAudio[] = [];
  const settings = new FakeSettings();
  const director = new MusicDirector({
    settings: settings as unknown as Pick<SettingsStore, "get" | "subscribe">,
    store,
    tracks,
    playlists,
    random: () => 0,
    createAudio: (source) => {
      const audio = new FakeAudio(source);
      audios.push(audio);
      return audio;
    },
    gestureTarget: null,
    setIntervalFn: (() => 1) as unknown as typeof setInterval,
    clearIntervalFn: (() => undefined) as typeof clearInterval,
  });
  return { director, audios, settings, store };
}

describe("MusicDirector lifecycle", () => {
  it("treats repeated current context as no-op and keeps at most two live tracks during a transition", () => {
    const { director, audios } = createHarness();
    expect(director.play("menu")).toBe(true);
    expect(director.play("menu")).toBe(false);
    expect(audios).toHaveLength(1);
    expect(audios[0]?.volume).toBe(0.45);

    expect(director.play("planning")).toBe(true);
    expect(audios).toHaveLength(2);
    expect(audios[0]?.pauseCount).toBe(0);

    expect(director.play("menu", true)).toBe(true);
    expect(audios).toHaveLength(3);
    expect(audios[0]?.pauseCount).toBe(1);
    expect(audios.filter((audio) => !audio.removedSource)).toHaveLength(2);
    director.dispose();
  });

  it("stops owned playback for an intentionally silent context", () => {
    const { director, audios } = createHarness();
    director.play("menu");
    expect(director.play("victory")).toBe(false);
    expect(audios[0]?.pauseCount).toBe(1);
    expect(audios[0]?.removedSource).toBe(true);
    director.dispose();
  });

  it("persists seek and restores it only for the matching current track", () => {
    const first = createHarness();
    first.director.play("menu");
    first.audios[0]!.currentTime = 27;
    first.director.dispose();
    const saved = JSON.parse(first.store.values.get(MUSIC_SESSION_KEY) ?? "{}") as {
      playlists?: { menu?: { currentTrack?: string; seek?: number } };
    };
    expect(saved.playlists?.menu).toMatchObject({ currentTrack: "a", seek: 27 });

    const restored = createHarness(first.store);
    restored.director.play("menu");
    expect(restored.audios[0]?.currentTime).toBe(27);
    restored.director.dispose();

    saved.playlists!.menu!.currentTrack = "gone";
    saved.playlists!.menu!.seek = 99;
    first.store.values.set(MUSIC_SESSION_KEY, JSON.stringify(saved));
    const changed = createHarness(first.store);
    changed.director.play("menu");
    expect(changed.audios[0]?.currentTime).toBe(27);
    changed.director.dispose();
  });

  it("reacts to canonical settings and unsubscribes on disposal", () => {
    const { director, audios, settings } = createHarness();
    director.play("menu");
    expect(settings.listenerCount()).toBe(1);
    settings.settings.audioMuted = true;
    settings.notify();
    expect(audios[0]?.pauseCount).toBe(1);
    director.dispose();
    expect(settings.listenerCount()).toBe(0);
  });
});
