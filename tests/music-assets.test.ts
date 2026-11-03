import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MUSIC_TRACKS } from "../src/data/musicPlaylists";

const ROOT = process.cwd();
const AUDIO_EXT = /\.(mp3|ogg|wav|m4a)$/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("music assets stay single-sourced and loadable", () => {
  it("ships no stray audio file at the repository root", () => {
    const stray = readdirSync(ROOT).filter((name) => AUDIO_EXT.test(name));
    expect(stray).toEqual([]);
  });

  it("resolves every local music source to a real asset under public/", () => {
    const missing: string[] = [];
    const tiny: string[] = [];
    for (const track of Object.values(MUSIC_TRACKS)) {
      if (track.source !== "local") continue;
      for (const source of track.sources) {
        const path = join(ROOT, "public", source.replace(/^\//, ""));
        const size = statSync(path, { throwIfNoEntry: false })?.size ?? 0;
        if (size === 0) missing.push(`${track.key} -> ${source}`);
        else if (size < 10_000) tiny.push(`${track.key} -> ${source} (${size} bytes)`);
      }
    }
    expect(missing).toEqual([]);
    expect(tiny).toEqual([]);
  });

  it("keeps exactly one blob per shipped audio asset", () => {
    const hashes = new Map<string, string[]>();
    for (const file of walk(join(ROOT, "public", "assets", "audio"))) {
      if (!AUDIO_EXT.test(file)) continue;
      const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
      hashes.set(hash, [...(hashes.get(hash) ?? []), file]);
    }
    const duplicates = [...hashes.values()].filter((files) => files.length > 1);
    expect(duplicates).toEqual([]);
  });
});
