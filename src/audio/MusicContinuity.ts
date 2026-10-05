import type { KV } from "../core/settings";
import type { MusicPlaylistDefinition, MusicTrack } from "./MusicDirector";

export const MUSIC_CONTINUITY_KEY = "forest_throne_music_continuity_v1";

export interface MusicContinuityEntry {
  signature: string;
  order: string[];
  index: number;
  currentTrack: string | null;
  seek: number;
}

interface PersistedContinuity {
  playlists: Record<string, MusicContinuityEntry>;
}

export interface RestoredPlaylistContinuity {
  order: MusicTrack[];
  index: number;
  seek: number;
  fresh: boolean;
}

export interface MusicContinuityStore {
  restore(playlist: MusicPlaylistDefinition): RestoredPlaylistContinuity;
  save(playlist: MusicPlaylistDefinition, order: readonly MusicTrack[], index: number, currentTrack: string, seek: number): void;
}

function playlistSignature(playlist: MusicPlaylistDefinition): string {
  return `${playlist.id}:${playlist.tracks.map((track) => `${track.key}@${track.src}`).join("|")}`;
}

function safeSeek(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const raw = Math.floor(random() * (i + 1));
    const j = Math.max(0, Math.min(i, raw));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function freshOrder(playlist: MusicPlaylistDefinition, random: () => number): MusicTrack[] {
  return playlist.shuffle ? shuffled(playlist.tracks, random) : [...playlist.tracks];
}

function parseState(storage: KV | null): PersistedContinuity {
  if (!storage) return { playlists: {} };
  try {
    const raw = JSON.parse(storage.getItem(MUSIC_CONTINUITY_KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return { playlists: {} };
    const playlists = (raw as { playlists?: unknown }).playlists;
    if (!playlists || typeof playlists !== "object") return { playlists: {} };
    return { playlists: playlists as Record<string, MusicContinuityEntry> };
  } catch {
    return { playlists: {} };
  }
}

function defaultStorage(): KV | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

export function createMusicContinuityStore(
  storage: KV | null = defaultStorage(),
  random: () => number = Math.random,
): MusicContinuityStore {
  const persisted = parseState(storage);
  const memory = new Map<string, MusicContinuityEntry>(Object.entries(persisted.playlists));

  const write = () => {
    if (!storage) return;
    try { storage.setItem(MUSIC_CONTINUITY_KEY, JSON.stringify({ playlists: Object.fromEntries(memory) })); }
    catch { /* continuity must never block playback */ }
  };

  return {
    restore(playlist) {
      const saved = memory.get(playlist.id);
      if (!saved) return { order: freshOrder(playlist, random), index: 0, seek: 0, fresh: true };

      const byKey = new Map(playlist.tracks.map((track) => [track.key, track] as const));
      const seen = new Set<string>();
      const survivingKeys: string[] = [];
      for (const key of Array.isArray(saved.order) ? saved.order : []) {
        if (!byKey.has(key) || seen.has(key)) continue;
        seen.add(key);
        survivingKeys.push(key);
      }

      let order: MusicTrack[];
      let fresh = false;
      if (survivingKeys.length === 0) {
        order = freshOrder(playlist, random);
        fresh = true;
      } else {
        for (const track of playlist.tracks) {
          if (!seen.has(track.key)) {
            seen.add(track.key);
            survivingKeys.push(track.key);
          }
        }
        order = survivingKeys.map((key) => byKey.get(key)!).filter(Boolean);
      }

      if (order.length === 0) return { order, index: 0, seek: 0, fresh };
      if (fresh) return { order, index: 0, seek: 0, fresh: true };
      const identityIndex = typeof saved.currentTrack === "string"
        ? order.findIndex((track) => track.key === saved.currentTrack)
        : -1;
      const numericIndex = Number.isFinite(saved.index) ? Math.trunc(saved.index) : 0;
      const index = identityIndex >= 0
        ? identityIndex
        : Math.max(0, Math.min(order.length - 1, numericIndex));
      return { order, index, seek: safeSeek(saved.seek), fresh };
    },
    save(playlist, order, index, currentTrack, seek) {
      const clampedIndex = order.length === 0 ? 0 : Math.max(0, Math.min(order.length - 1, Math.trunc(index)));
      memory.set(playlist.id, {
        signature: playlistSignature(playlist),
        order: order.map((track) => track.key),
        index: clampedIndex,
        currentTrack,
        seek: safeSeek(seek),
      });
      write();
    },
  };
}
