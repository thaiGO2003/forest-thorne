import type { Settings, SettingsStore } from "../core/settings";
import { normalizedMasterVolume } from "./SoundEffects";

export const MUSIC_CONTEXTS = ["menu", "planning", "combat", "victory", "defeat", "ambient"] as const;
export type MusicContext = (typeof MUSIC_CONTEXTS)[number];

export const MUSIC_CROSSFADE_MS = 900;

export interface MusicTrack {
  key: string;
  src: string;
  longPlay?: boolean;
}

export interface MusicPlaylistDefinition {
  id: string;
  tracks: readonly MusicTrack[];
  shuffle?: boolean;
}

export type MusicPlaylists = Readonly<Partial<Record<MusicContext, MusicPlaylistDefinition>>>;

export interface MusicAudioElement {
  src: string;
  currentTime: number;
  volume: number;
  loop: boolean;
  onended: (() => void) | null;
  play(): void | Promise<void>;
  pause(): void;
  removeAttribute?(name: string): void;
  load?(): void;
}

export interface MusicGestureTarget {
  addEventListener(type: "pointerdown" | "keydown", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "pointerdown" | "keydown", listener: () => void): void;
}

export interface MusicDirectorOptions {
  settings: SettingsStore;
  playlists: MusicPlaylists;
  createAudioElement?: () => MusicAudioElement | null;
  gestureTarget?: MusicGestureTarget | null;
  random?: () => number;
  setTimeoutFn?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

export interface MusicDirector {
  play(context: MusicContext): void;
  dispose(): void;
}

interface ActiveTrack {
  context: MusicContext;
  track: MusicTrack;
  audio: MusicAudioElement;
}

function musicVolume(settings: Settings): number {
  return 0.45 * normalizedMasterVolume(settings);
}

function defaultCreateAudioElement(): MusicAudioElement | null {
  const root = globalThis as typeof globalThis & { Audio?: new () => HTMLAudioElement };
  return root.Audio ? new root.Audio() as unknown as MusicAudioElement : null;
}

function defaultGestureTarget(): MusicGestureTarget | null {
  if (typeof document === "undefined") return null;
  return document as unknown as MusicGestureTarget;
}

function pickIndex(length: number, random: () => number): number {
  if (length <= 1) return 0;
  const raw = Math.floor(random() * length);
  return Math.max(0, Math.min(length - 1, raw));
}

export function createMusicDirector(options: MusicDirectorOptions): MusicDirector {
  const createAudio = options.createAudioElement ?? defaultCreateAudioElement;
  const gestureTarget = options.gestureTarget === undefined ? defaultGestureTarget() : options.gestureTarget;
  const random = options.random ?? Math.random;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  let settings = options.settings.get();
  let desiredContext: MusicContext | null = null;
  let active: ActiveTrack | null = null;
  let outgoing: ActiveTrack | null = null;
  let lastTrackKey: string | null = null;
  let disposed = false;
  let fadeTimers: ReturnType<typeof setTimeout>[] = [];
  let gestureInstalled = false;

  const release = (entry: ActiveTrack | null) => {
    if (!entry) return;
    entry.audio.onended = null;
    try { entry.audio.pause(); } catch { /* no-op */ }
    try {
      entry.audio.removeAttribute?.("src");
      entry.audio.src = "";
      entry.audio.load?.();
    } catch { /* no-op */ }
  };

  const clearFadeTimers = () => {
    for (const timer of fadeTimers) clearTimeoutFn(timer);
    fadeTimers = [];
  };

  const removeGestureResume = () => {
    if (!gestureInstalled || !gestureTarget) return;
    gestureTarget.removeEventListener("pointerdown", resumeFromGesture);
    gestureTarget.removeEventListener("keydown", resumeFromGesture);
    gestureInstalled = false;
  };

  const installGestureResume = () => {
    if (gestureInstalled || !gestureTarget || disposed) return;
    gestureInstalled = true;
    gestureTarget.addEventListener("pointerdown", resumeFromGesture, { once: true });
    gestureTarget.addEventListener("keydown", resumeFromGesture, { once: true });
  };

  const stopOwnedPlayback = () => {
    clearFadeTimers();
    release(active);
    release(outgoing);
    active = null;
    outgoing = null;
  };

  const updateVolumes = () => {
    const target = musicVolume(settings);
    if (active && !outgoing) active.audio.volume = target;
    if (active && outgoing && target === 0) active.audio.volume = 0;
    if (outgoing && target === 0) outgoing.audio.volume = 0;
  };

  const chooseInitialTrack = (playlist: MusicPlaylistDefinition): MusicTrack | null => {
    if (playlist.tracks.length === 0) return null;
    if (!playlist.shuffle || playlist.tracks.length === 1) return playlist.tracks[0] ?? null;
    let eligible = playlist.tracks.filter((track) => !track.longPlay);
    if (eligible.length === 0) eligible = [...playlist.tracks];
    if (eligible.length > 1 && lastTrackKey) {
      const withoutLast = eligible.filter((track) => track.key !== lastTrackKey);
      if (withoutLast.length > 0) eligible = withoutLast;
    }
    return eligible[pickIndex(eligible.length, random)] ?? null;
  };

  const chooseNextTrack = (playlist: MusicPlaylistDefinition, currentKey: string): MusicTrack | null => {
    if (playlist.tracks.length === 0) return null;
    if (playlist.tracks.length === 1) return playlist.tracks[0] ?? null;
    if (!playlist.shuffle) {
      const index = playlist.tracks.findIndex((track) => track.key === currentKey);
      return playlist.tracks[(Math.max(0, index) + 1) % playlist.tracks.length] ?? playlist.tracks[0] ?? null;
    }
    const eligible = playlist.tracks.filter((track) => track.key !== currentKey);
    return eligible[pickIndex(eligible.length, random)] ?? playlist.tracks[0] ?? null;
  };

  const crossfade = (next: ActiveTrack, previous: ActiveTrack | null) => {
    clearFadeTimers();
    const target = musicVolume(settings);
    if (!previous) {
      next.audio.volume = target;
      return;
    }
    outgoing = previous;
    next.audio.volume = 0;
    const steps = 6;
    for (let step = 1; step <= steps; step++) {
      const timer = setTimeoutFn(() => {
        if (disposed || active !== next) return;
        const progress = step / steps;
        const currentTarget = musicVolume(settings);
        next.audio.volume = currentTarget * progress;
        previous.audio.volume = currentTarget * (1 - progress);
        if (step === steps) {
          release(previous);
          if (outgoing === previous) outgoing = null;
        }
      }, Math.round(MUSIC_CROSSFADE_MS * step / steps));
      fadeTimers.push(timer);
    }
  };

  const startTrack = (context: MusicContext, track: MusicTrack, previous: ActiveTrack | null) => {
    if (outgoing && outgoing !== previous) {
      clearFadeTimers();
      release(outgoing);
      outgoing = null;
    }
    const audio = createAudio();
    if (!audio) {
      release(previous);
      if (active === previous) active = null;
      return;
    }
    audio.src = track.src;
    audio.loop = (options.playlists[context]?.tracks.length ?? 0) === 1;
    audio.volume = previous ? 0 : musicVolume(settings);
    const entry: ActiveTrack = { context, track, audio };
    audio.onended = () => {
      if (disposed || active !== entry || audio.loop) return;
      const playlist = options.playlists[entry.context];
      if (!playlist) return;
      const nextTrack = chooseNextTrack(playlist, entry.track.key);
      if (!nextTrack) return;
      lastTrackKey = entry.track.key;
      startTrack(entry.context, nextTrack, entry);
    };

    let playResult: void | Promise<void>;
    try { playResult = audio.play(); }
    catch {
      release(entry);
      release(previous);
      if (active === previous) active = null;
      installGestureResume();
      return;
    }
    active = entry;
    removeGestureResume();
    crossfade(entry, previous);
    if (playResult && typeof playResult.then === "function") {
      void playResult.catch(() => {
        if (disposed || active !== entry) return;
        stopOwnedPlayback();
        installGestureResume();
      });
    }
  };

  function resumeFromGesture() {
    removeGestureResume();
    if (disposed || !desiredContext) return;
    const context = desiredContext;
    desiredContext = null;
    director.play(context);
  }

  const unsubscribe = options.settings.subscribe((next) => {
    settings = next;
    updateVolumes();
  });

  const director: MusicDirector = {
    play(context) {
      if (disposed) return;
      if (desiredContext === context) return;
      desiredContext = context;
      const playlist = options.playlists[context];
      if (!playlist || playlist.tracks.length === 0) {
        stopOwnedPlayback();
        return;
      }
      const track = chooseInitialTrack(playlist);
      if (!track) {
        stopOwnedPlayback();
        return;
      }
      const previous = active;
      if (previous) lastTrackKey = previous.track.key;
      startTrack(context, track, previous);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      removeGestureResume();
      stopOwnedPlayback();
      desiredContext = null;
    },
  };
  return director;
}
