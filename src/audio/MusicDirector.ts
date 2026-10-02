import type { KV, SettingsStore } from "../core/settings";
import { normalizedMasterVolume } from "./SoundEffects";
import {
  MUSIC_PLAYLISTS,
  MUSIC_TRACKS,
  type MusicContext,
  type MusicPlaylist,
  type MusicTrack,
} from "../data/musicPlaylists";

export const MUSIC_GLOBAL_SCALE = 0.45;
export const MUSIC_CROSSFADE_MS = 900;
export const MUSIC_SESSION_KEY = "forest-throne.music-session.v1";

export interface MusicContinuityEntry {
  signature: string;
  order: string[];
  currentIndex: number;
  currentTrack: string | null;
  seek: number;
}

export interface MusicContinuityState {
  version: 1;
  seeks: Record<string, number>;
  playlists: Record<string, MusicContinuityEntry>;
}

export interface ManagedAudio {
  src: string;
  volume: number;
  currentTime: number;
  loop: boolean;
  onended: (() => void) | null;
  play(): Promise<void> | void;
  pause(): void;
  removeAttribute?(name: string): void;
  load?(): void;
}

export interface MusicDirectorOptions {
  settings: Pick<SettingsStore, "get" | "subscribe">;
  store?: Pick<KV, "getItem" | "setItem"> | null;
  playlists?: Readonly<Record<MusicContext, MusicPlaylist>>;
  tracks?: Readonly<Record<string, MusicTrack>>;
  random?: () => number;
  createAudio?: (source: string) => ManagedAudio | null;
  gestureTarget?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

interface ActiveTrack {
  context: MusicContext | null;
  playlistId: string | null;
  key: string;
  audio: ManagedAudio;
}

const emptyContinuity = (): MusicContinuityState => ({
  version: 1,
  seeks: {},
  playlists: {},
});

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim());
}

function finiteNonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function normalizeMusicContinuity(value: unknown): MusicContinuityState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyContinuity();
  const raw = value as Record<string, unknown>;
  const seeks: Record<string, number> = {};
  if (raw.seeks && typeof raw.seeks === "object" && !Array.isArray(raw.seeks)) {
    for (const [key, seek] of Object.entries(raw.seeks as Record<string, unknown>)) {
      const normalized = finiteNonNegative(seek);
      if (normalized > 0) seeks[key] = normalized;
    }
  }
  const playlists: Record<string, MusicContinuityEntry> = {};
  if (raw.playlists && typeof raw.playlists === "object" && !Array.isArray(raw.playlists)) {
    for (const [id, entryValue] of Object.entries(raw.playlists as Record<string, unknown>)) {
      if (!entryValue || typeof entryValue !== "object" || Array.isArray(entryValue)) continue;
      const entry = entryValue as Record<string, unknown>;
      playlists[id] = {
        signature: typeof entry.signature === "string" ? entry.signature : "",
        order: stringList(entry.order),
        currentIndex: Math.max(0, Math.round(Number(entry.currentIndex) || 0)),
        currentTrack: typeof entry.currentTrack === "string" && entry.currentTrack.trim()
          ? entry.currentTrack.trim()
          : null,
        seek: finiteNonNegative(entry.seek),
      };
    }
  }
  return { version: 1, seeks, playlists };
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function playlistSignature(playlist: MusicPlaylist): string {
  return `${playlist.id}:${playlist.shuffle ? "shuffle" : "ordered"}:${playlist.tracks.join("|")}`;
}

export function shuffledTracks(
  tracks: readonly string[],
  random: () => number,
  avoidFirst?: string | null,
): string[] {
  const order = [...tracks];
  for (let index = order.length - 1; index > 0; index--) {
    const target = Math.floor(Math.min(0.999999999, Math.max(0, random())) * (index + 1));
    [order[index], order[target]] = [order[target]!, order[index]!];
  }
  if (avoidFirst && order.length > 1 && order[0] === avoidFirst) {
    const swapIndex = order.findIndex((key) => key !== avoidFirst);
    if (swapIndex > 0) [order[0], order[swapIndex]] = [order[swapIndex]!, order[0]!];
  }
  return order;
}

export function restorePlaylistOrder(
  playlist: MusicPlaylist,
  saved: MusicContinuityEntry | null | undefined,
  random: () => number,
  avoidFirst?: string | null,
): { order: string[]; index: number } {
  const valid = dedupe(playlist.tracks);
  if (valid.length === 0) return { order: [], index: 0 };
  if (!saved) {
    return {
      order: playlist.shuffle ? shuffledTracks(valid, random, avoidFirst) : valid,
      index: 0,
    };
  }
  const validSet = new Set(valid);
  const order = dedupe(saved.order.filter((key) => validSet.has(key)));
  for (const key of valid) if (!order.includes(key)) order.push(key);
  if (order.length === 0) {
    return {
      order: playlist.shuffle ? shuffledTracks(valid, random, avoidFirst) : valid,
      index: 0,
    };
  }
  const currentTrackIndex = saved.currentTrack ? order.indexOf(saved.currentTrack) : -1;
  const index = currentTrackIndex >= 0
    ? currentTrackIndex
    : Math.min(order.length - 1, Math.max(0, saved.currentIndex));
  return { order, index };
}

export function pickWeightedTrack(
  weights: Readonly<Record<string, number>>,
  availableKeys: readonly string[],
  random: () => number,
): string | null {
  const available = new Set(availableKeys);
  const entries = Object.entries(weights)
    .map(([key, weight]) => [key, Number(weight)] as const)
    .filter(([key, weight]) => available.has(key) && Number.isFinite(weight) && weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let cursor = Math.min(0.999999999, Math.max(0, random())) * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return key;
  }
  return entries.at(-1)?.[0] ?? null;
}

function defaultCreateAudio(source: string): ManagedAudio | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(source);
  return audio as unknown as ManagedAudio;
}

export class MusicDirector {
  private readonly settings: Pick<SettingsStore, "get" | "subscribe">;
  private readonly store: Pick<KV, "getItem" | "setItem"> | null;
  private readonly playlists: Readonly<Record<MusicContext, MusicPlaylist>>;
  private readonly tracks: Readonly<Record<string, MusicTrack>>;
  private readonly random: () => number;
  private readonly createAudio: (source: string) => ManagedAudio | null;
  private readonly gestureTarget: MusicDirectorOptions["gestureTarget"];
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly warmed = new Set<string>();
  private readonly continuity: MusicContinuityState;
  private readonly unsubscribe: () => void;
  private current: ActiveTrack | null = null;
  private outgoing: ActiveTrack | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private desiredContext: MusicContext | null = null;
  private lastPlayedKey: string | null = null;
  private playlistOrder: string[] = [];
  private playlistIndex = 0;
  private weighted: { id: string; weights: Readonly<Record<string, number>> } | null = null;
  private gestureInstalled = false;
  private disposed = false;

  private readonly onGesture = (): void => {
    this.removeGestureResume();
    if (this.disposed) return;
    if (this.current && this.current.context === this.desiredContext) {
      this.tryPlay(this.current);
      return;
    }
    if (this.desiredContext) this.play(this.desiredContext, true);
  };

  constructor(options: MusicDirectorOptions) {
    this.settings = options.settings;
    this.store = options.store ?? null;
    this.playlists = options.playlists ?? MUSIC_PLAYLISTS;
    this.tracks = options.tracks ?? MUSIC_TRACKS;
    this.random = options.random ?? Math.random;
    this.createAudio = options.createAudio ?? defaultCreateAudio;
    this.gestureTarget = options.gestureTarget ?? (typeof window !== "undefined" ? window : null);
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.continuity = this.loadContinuity();
    this.unsubscribe = this.settings.subscribe(() => this.applySettings());
  }

  play(context: MusicContext, force = false): boolean {
    if (this.disposed) return false;
    if (!force && this.desiredContext === context && this.current?.context === context) return false;
    this.weighted = null;
    this.desiredContext = context;
    const playlist = this.playlists[context];
    if (!playlist || playlist.tracks.length === 0) {
      this.stopCurrent(true);
      this.playlistOrder = [];
      this.playlistIndex = 0;
      return false;
    }
    const saved = this.continuity.playlists[playlist.id];
    const restored = restorePlaylistOrder(playlist, saved, this.random, this.lastPlayedKey);
    this.playlistOrder = restored.order;
    this.playlistIndex = restored.index;
    const key = this.pickColdAwareTrack(playlist, this.playlistOrder[this.playlistIndex] ?? null);
    if (!key) return false;
    const actualIndex = this.playlistOrder.indexOf(key);
    if (actualIndex >= 0) this.playlistIndex = actualIndex;
    return this.startTrack(key, context, playlist.id, playlist.tracks.length === 1);
  }

  playWeighted(id: string, weights: Readonly<Record<string, number>>): boolean {
    if (this.disposed) return false;
    this.desiredContext = null;
    this.weighted = { id, weights: { ...weights } };
    const key = pickWeightedTrack(weights, this.availableTrackKeys(), this.random);
    if (!key) {
      this.stopCurrent(true);
      return false;
    }
    this.stopCurrent(true);
    return this.startTrack(key, null, id, false);
  }

  warmTrack(key: string): void {
    if (this.tracks[key]) this.warmed.add(key);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.saveCurrentContinuity();
    this.clearFade();
    this.releaseTrack(this.current);
    this.releaseTrack(this.outgoing);
    this.current = null;
    this.outgoing = null;
    this.removeGestureResume();
    this.unsubscribe();
  }

  private pickColdAwareTrack(playlist: MusicPlaylist, preferred: string | null): string | null {
    if (!preferred) return null;
    const track = this.tracks[preferred];
    if (!track?.longPlay || this.warmed.has(preferred)) return preferred;
    const alternative = this.playlistOrder.find((key) => {
      const candidate = this.tracks[key];
      return candidate && (!candidate.longPlay || this.warmed.has(key));
    });
    if (!alternative) return preferred;
    if (playlist.shuffle && alternative === this.lastPlayedKey) {
      return this.playlistOrder.find((key) => key !== this.lastPlayedKey && key !== preferred) ?? alternative;
    }
    return alternative;
  }

  private startTrack(
    key: string,
    context: MusicContext | null,
    playlistId: string | null,
    loop: boolean,
  ): boolean {
    const track = this.tracks[key];
    const source = track?.sources.find(Boolean);
    if (!track || !source) return false;
    const audio = this.createAudio(source);
    if (!audio) return false;
    this.saveCurrentContinuity();
    this.clearFade();
    if (this.outgoing) this.releaseTrack(this.outgoing);
    this.outgoing = this.current;
    const active: ActiveTrack = { context, playlistId, key, audio };
    this.current = active;
    audio.loop = loop;
    audio.volume = this.outgoing ? 0 : this.targetVolume();
    const savedSeek = this.resolveSeek(key, playlistId);
    if (savedSeek > 0) {
      try { audio.currentTime = savedSeek; } catch { /* seek support is optional */ }
    }
    audio.onended = loop ? null : () => this.onTrackEnded(active);
    this.lastPlayedKey = key;
    this.warmed.add(key);
    this.tryPlay(active);
    if (this.outgoing) this.beginCrossfade();
    this.saveCurrentContinuity();
    return true;
  }

  private onTrackEnded(active: ActiveTrack): void {
    if (this.current !== active || this.disposed) return;
    this.continuity.seeks[active.key] = 0;
    if (this.weighted && active.playlistId === this.weighted.id) {
      const key = pickWeightedTrack(this.weighted.weights, this.availableTrackKeys(), this.random);
      if (key) this.startTrack(key, null, this.weighted.id, false);
      return;
    }
    if (!active.context) return;
    const playlist = this.playlists[active.context];
    if (!playlist || playlist.tracks.length <= 1) return;
    this.playlistIndex++;
    if (this.playlistIndex >= this.playlistOrder.length) {
      this.playlistOrder = playlist.shuffle
        ? shuffledTracks(playlist.tracks, this.random, active.key)
        : dedupe(playlist.tracks);
      this.playlistIndex = 0;
    }
    const key = this.playlistOrder[this.playlistIndex];
    if (key) this.startTrack(key, active.context, playlist.id, false);
  }

  private beginCrossfade(): void {
    const outgoing = this.outgoing;
    const incoming = this.current;
    if (!outgoing || !incoming) return;
    const startedAt = Date.now();
    const target = this.targetVolume();
    this.fadeTimer = this.setIntervalFn(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / MUSIC_CROSSFADE_MS);
      incoming.audio.volume = target * progress;
      outgoing.audio.volume = target * (1 - progress);
      if (progress >= 1) {
        this.clearFade();
        this.releaseTrack(outgoing);
        if (this.outgoing === outgoing) this.outgoing = null;
      }
    }, 40);
  }

  private applySettings(): void {
    const target = this.targetVolume();
    if (this.current) this.current.audio.volume = target;
    if (this.outgoing && !this.fadeTimer) this.outgoing.audio.volume = target;
    if (target <= 0) {
      this.current?.audio.pause();
      this.outgoing?.audio.pause();
      return;
    }
    if (this.current) this.tryPlay(this.current);
  }

  private targetVolume(): number {
    return normalizedMasterVolume(this.settings.get()) * MUSIC_GLOBAL_SCALE;
  }

  private tryPlay(active: ActiveTrack): void {
    if (this.targetVolume() <= 0) return;
    try {
      const result = active.audio.play();
      if (result && typeof result.then === "function") {
        void result.catch(() => {
          if (this.current === active && !this.disposed) this.installGestureResume();
        });
      }
    } catch {
      this.installGestureResume();
    }
  }

  private installGestureResume(): void {
    if (this.gestureInstalled || !this.gestureTarget) return;
    this.gestureInstalled = true;
    for (const type of ["pointerdown", "keydown", "touchstart"] as const) {
      this.gestureTarget.addEventListener(type, this.onGesture, { once: true });
    }
  }

  private removeGestureResume(): void {
    if (!this.gestureInstalled || !this.gestureTarget) return;
    this.gestureInstalled = false;
    for (const type of ["pointerdown", "keydown", "touchstart"] as const) {
      this.gestureTarget.removeEventListener(type, this.onGesture);
    }
  }

  private stopCurrent(persist: boolean): void {
    if (persist) this.saveCurrentContinuity();
    this.clearFade();
    this.releaseTrack(this.outgoing);
    this.outgoing = null;
    this.releaseTrack(this.current);
    this.current = null;
  }

  private clearFade(): void {
    if (this.fadeTimer === null) return;
    this.clearIntervalFn(this.fadeTimer);
    this.fadeTimer = null;
  }

  private releaseTrack(active: ActiveTrack | null): void {
    if (!active) return;
    active.audio.onended = null;
    active.audio.pause();
    try { active.audio.removeAttribute?.("src"); } catch { /* best effort */ }
    active.audio.src = "";
    try { active.audio.load?.(); } catch { /* best effort */ }
  }

  private resolveSeek(key: string, playlistId: string | null): number {
    if (playlistId) {
      const saved = this.continuity.playlists[playlistId];
      if (saved?.currentTrack === key && saved.seek > 0) return saved.seek;
    }
    return this.continuity.seeks[key] ?? 0;
  }

  private saveCurrentContinuity(): void {
    const active = this.current;
    if (!active) return;
    const seek = finiteNonNegative(active.audio.currentTime);
    this.continuity.seeks[active.key] = seek;
    if (active.playlistId && active.context) {
      const playlist = this.playlists[active.context];
      this.continuity.playlists[active.playlistId] = {
        signature: playlistSignature(playlist),
        order: [...this.playlistOrder],
        currentIndex: this.playlistIndex,
        currentTrack: active.key,
        seek,
      };
    }
    this.persistContinuity();
  }

  private loadContinuity(): MusicContinuityState {
    if (!this.store) return emptyContinuity();
    try {
      return normalizeMusicContinuity(JSON.parse(this.store.getItem(MUSIC_SESSION_KEY) ?? "null"));
    } catch {
      return emptyContinuity();
    }
  }

  private persistContinuity(): void {
    if (!this.store) return;
    try {
      this.store.setItem(MUSIC_SESSION_KEY, JSON.stringify(this.continuity));
    } catch {
      // Continuity is optional session preference state.
    }
  }

  private availableTrackKeys(): string[] {
    return Object.values(this.tracks).filter((track) => track.sources.some(Boolean)).map((track) => track.key);
  }
}
