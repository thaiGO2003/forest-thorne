import { describe, expect, it } from "vitest";
import { createMusicContinuityStore, MUSIC_CONTINUITY_KEY } from "../src/audio/MusicContinuity";
import type { MusicPlaylistDefinition } from "../src/audio/MusicDirector";

function memoryStorage(initial?: string): Storage {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(MUSIC_CONTINUITY_KEY, initial);
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const original: MusicPlaylistDefinition = {
  id: "menu",
  shuffle: false,
  tracks: [
    { key: "a", src: "/a.mp3" },
    { key: "b", src: "/b.mp3" },
    { key: "c", src: "/c.mp3" },
  ],
};

describe("music continuity A71", () => {
  it("persists order, current identity, index and seek", () => {
    const storage = memoryStorage();
    const first = createMusicContinuityStore(storage);
    first.save(original, [original.tracks[2]!, original.tracks[0]!, original.tracks[1]!], 1, "a", 42.5);

    const restored = createMusicContinuityStore(storage).restore(original);
    expect(restored.order.map((track) => track.key)).toEqual(["c", "a", "b"]);
    expect(restored.index).toBe(1);
    expect(restored.seek).toBe(42.5);
  });

  it("reconciles changed authored tracks and trusts current-track identity over stale index", () => {
    const storage = memoryStorage();
    const first = createMusicContinuityStore(storage);
    first.save(original, [original.tracks[2]!, original.tracks[1]!, original.tracks[0]!], 0, "b", 9);
    const changed: MusicPlaylistDefinition = {
      id: "menu",
      shuffle: false,
      tracks: [
        { key: "b", src: "/b2.mp3" },
        { key: "c", src: "/c.mp3" },
        { key: "d", src: "/d.mp3" },
      ],
    };

    const restored = createMusicContinuityStore(storage).restore(changed);
    expect(restored.order.map((track) => track.key)).toEqual(["c", "b", "d"]);
    expect(restored.index).toBe(1);
    expect(restored.seek).toBe(9);
  });

  it("creates a fresh shuffled order when no saved entries remain valid", () => {
    const storage = memoryStorage();
    const first = createMusicContinuityStore(storage);
    first.save(original, original.tracks, 2, "c", 5);
    const replacement: MusicPlaylistDefinition = {
      id: "menu",
      shuffle: true,
      tracks: [{ key: "x", src: "/x.mp3" }, { key: "y", src: "/y.mp3" }],
    };
    const restored = createMusicContinuityStore(storage, () => 0).restore(replacement);
    expect(restored.fresh).toBe(true);
    expect(restored.order.map((track) => track.key)).toEqual(["y", "x"]);
    expect(restored.index).toBe(0);
  });

  it("silently falls back when stored JSON is corrupt", () => {
    const restored = createMusicContinuityStore(memoryStorage("{bad json"), () => 0.5).restore(original);
    expect(restored.order.map((track) => track.key)).toEqual(["a", "b", "c"]);
    expect(restored.seek).toBe(0);
  });
});
