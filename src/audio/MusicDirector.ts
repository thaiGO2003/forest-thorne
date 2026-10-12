import type { KV, Settings, SettingsStore } from "../core/settings";
import { createMusicContinuityStore } from "./MusicContinuity";
import { normalizedMasterVolume } from "./SoundEffects";

export const MUSIC_CONTEXTS = ["menu", "planning", "combat", "victory", "defeat", "ambient"] as const;
export type MusicContext = (typeof MUSIC_CONTEXTS)[number];

export const MUSIC_CROSSFADE_MS = 900;

export interface MusicTrack {
  key: string;
  src: string;
  source?: Settings["musicSource"];
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
  continuityStorage?: KV | null;
}

export interface MusicDirector {
  play(context: MusicContext): void;
  playWeighted(id: string, tracks: readonly MusicTrack[], weights: Readonly<Record<string, number>>): void;
  dispose(): void;
}

interface ActiveTrack {
  context: MusicContext | null;
  playlist: MusicPlaylistDefinition;
  track: MusicTrack;
  order: MusicTrack[];
  index: number;
  audio: MusicAudioElement;
  weights?: Readonly<Record<string, number>>;
}

type DesiredRequest =
  | { kind: "context"; context: MusicContext }
  | { kind: "weighted"; id: string; tracks: readonly MusicTrack[]; weights: Readonly<Record<string, number>> }
  | null;

function musicVolume(settings: Settings): number {
  return normalizedMasterVolume(settings) * Math.max(0, Math.min(1, settings.musicVolume / 10));
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
  const continuity = createMusicContinuityStore(options.continuityStorage, random);
  let settings = options.settings.get();
  let desired: DesiredRequest = null;
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

  const remember = (entry: ActiveTrack | null, seekOverride?: number) => {
    if (!entry) return;
    const seek = seekOverride ?? entry.audio.currentTime;
    continuity.save(entry.playlist, entry.order, entry.index, entry.track.key, seek);
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
    remember(active);
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

  const freshRuntimeOrder = (playlist: MusicPlaylistDefinition, avoidFirstKey: string | null = null): MusicTrack[] => {
    const order = [...playlist.tracks];
    if (playlist.shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = pickIndex(i + 1, random);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
    }
    if (order.length > 1) {
      const preferredIndex = order.findIndex((track) => !track.longPlay && track.key !== avoidFirstKey);
      if ((order[0]?.longPlay || order[0]?.key === avoidFirstKey) && preferredIndex > 0) {
        [order[0], order[preferredIndex]] = [order[preferredIndex]!, order[0]!];
      }
    }
    return order;
  };

  const playlistForContext = (context: MusicContext): MusicPlaylistDefinition | undefined => {
    const base = options.playlists[context];
    if (!base) return undefined;
    const hasSourceMetadata = base.tracks.some((track) => track.source !== undefined);
    if (!hasSourceMetadata) return base;
    return { ...base, tracks: base.tracks.filter((track) => track.source === settings.musicSource) };
  };

  const chooseWeightedTrack = (
    tracks: readonly MusicTrack[],
    weights: Readonly<Record<string, number>>,
  ): MusicTrack | null => {
    const eligible = tracks
      .map((track) => ({ track, weight: Number(weights[track.key]) }))
      .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
    const total = eligible.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return null;
    let cursor = random() * total;
    for (const entry of eligible) {
      cursor -= entry.weight;
      if (cursor < 0) return entry.track;
    }
    return eligible.at(-1)?.track ?? null;
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

  const startTrack = (
    context: MusicContext | null,
    playlist: MusicPlaylistDefinition,
    track: MusicTrack,
    order: MusicTrack[],
    index: number,
    seek: number,
    previous: ActiveTrack | null,
    weights?: Readonly<Record<string, number>>,
  ) => {
    if (outgoing && outgoing !== previous) {
      clearFadeTimers();
      release(outgoing);
      outgoing = null;
    }
    remember(previous);
    const audio = createAudio();
    if (!audio) {
      release(previous);
      if (active === previous) active = null;
      return;
    }
    audio.src = track.src;
    if (seek > 0) {
      try { audio.currentTime = seek; } catch { /* seeking is optional */ }
    }
    audio.loop = playlist.tracks.length === 1;
    audio.volume = previous ? 0 : musicVolume(settings);
    const entry: ActiveTrack = { context, playlist, track, order, index, audio, weights };
    audio.onended = () => {
      if (disposed || active !== entry || audio.loop) return;
      if (entry.weights) {
        const weightedTrack = chooseWeightedTrack(entry.playlist.tracks, entry.weights);
        if (!weightedTrack) return;
        const weightedIndex = entry.playlist.tracks.findIndex((candidate) => candidate.key === weightedTrack.key);
        lastTrackKey = entry.track.key;
        startTrack(null, entry.playlist, weightedTrack, [...entry.playlist.tracks], weightedIndex, 0, entry, entry.weights);
        return;
      }
      let nextOrder = entry.order;
      let nextIndex = entry.index + 1;
      if (nextIndex >= nextOrder.length) {
        nextOrder = freshRuntimeOrder(entry.playlist, entry.track.key);
        nextIndex = 0;
      }
      const nextTrack = nextOrder[nextIndex];
      if (!nextTrack) return;
      lastTrackKey = entry.track.key;
      startTrack(entry.context, entry.playlist, nextTrack, nextOrder, nextIndex, 0, entry);
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
    continuity.save(playlist, order, index, track.key, seek);
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

  const playContext = (context: MusicContext, force = false) => {
    if (disposed) return;
    if (!force && desired?.kind === "context" && desired.context === context) return;
    desired = { kind: "context", context };
    const playlist = playlistForContext(context);
    if (!playlist || playlist.tracks.length === 0) {
      stopOwnedPlayback();
      return;
    }
    const selected = playlist.tracks.find((track) => track.key === settings.musicTrack);
    let order: MusicTrack[];
    let index: number;
    let seek: number;
    if (selected) {
      order = [selected, ...playlist.tracks.filter((track) => track.key !== selected.key)];
      index = 0;
      seek = 0;
    } else {
      const restored = continuity.restore(playlist);
      order = restored.fresh ? freshRuntimeOrder(playlist, lastTrackKey) : restored.order;
      index = restored.fresh ? 0 : restored.index;
      seek = restored.fresh ? 0 : restored.seek;
    }
    const track = order[index];
    if (!track) {
      stopOwnedPlayback();
      return;
    }
    const previous = active;
    if (previous) lastTrackKey = previous.track.key;
    startTrack(context, playlist, track, order, index, seek, previous);
  };

  function resumeFromGesture() {
    removeGestureResume();
    if (disposed || !desired) return;
    const request = desired;
    desired = null;
    if (request.kind === "context") playContext(request.context);
    else director.playWeighted(request.id, request.tracks, request.weights);
  }

  const unsubscribe = options.settings.subscribe((next) => {
    const previous = settings;
    settings = next;
    updateVolumes();
    if ((previous.musicSource !== next.musicSource || previous.musicTrack !== next.musicTrack) && desired?.kind === "context") {
      playContext(desired.context, true);
    }
  });

  const director: MusicDirector = {
    play(context) {
      playContext(context);
    },
    playWeighted(id, tracks, weights) {
      if (disposed) return;
      desired = { kind: "weighted", id, tracks, weights };
      stopOwnedPlayback();
      const eligible = tracks.filter((track) => {
        const weight = Number(weights[track.key]);
        return Number.isFinite(weight) && weight > 0;
      });
      const track = chooseWeightedTrack(eligible, weights);
      if (!track) return;
      const playlist: MusicPlaylistDefinition = { id: `weighted:${id}`, tracks: eligible };
      const index = eligible.findIndex((candidate) => candidate.key === track.key);
      startTrack(null, playlist, track, [...eligible], index, 0, null, weights);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      removeGestureResume();
      stopOwnedPlayback();
      desired = null;
    },
  };
  return director;
}
