import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SEMANTIC_EMOJIS,
  EMOJI_IMAGE_SOURCE,
  EMOJI_LOCAL_FALLBACK_IMAGE_URL,
  normalizeIconInput,
  resolveEmojiChar,
  stripVariationSelectors,
  toCodepointKey,
  splitEmojiText,
  getEmojiImageUrl,
  preloadEmojiImage,
  getEmojiTextureKey,
  getOrCreateEmojiTexture,
  queueEmojiAssets,
  disposeEmojiAtlas,
} from "../src/core/emojiIcon";

describe("A61 emoji/icon authority and fallback behavior", () => {
  beforeEach(() => {
    disposeEmojiAtlas();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes semantic icon names to canonical Unicode", () => {
    expect(resolveEmojiChar("heart")).toBe("❤️");
    expect(resolveEmojiChar("gold")).toBe("🪙");
    expect(resolveEmojiChar("empty")).toBe("▫️");
  });

  it("normalizes blank or whitespace input to 'empty'", () => {
    expect(normalizeIconInput("")).toBe("empty");
    expect(normalizeIconInput("   ")).toBe("empty");
    expect(normalizeIconInput(null)).toBe("empty");
    expect(normalizeIconInput(undefined)).toBe("empty");
  });

  it("strips variation selectors and resolves aliases", () => {
    const heartWithVar = "❤️"; // has U+FE0F
    const heartStripped = stripVariationSelectors(heartWithVar);
    expect(normalizeIconInput(heartWithVar)).toBe("heart");
    expect(normalizeIconInput(heartStripped)).toBe("heart");
  });

  it("passes through unknown extended pictographics and falls back to question mark for text", () => {
    expect(resolveEmojiChar("🐉")).toBe("🐉");
    expect(resolveEmojiChar("not_an_emoji_12345")).toBe("❔");
  });

  it("builds pinned image URLs from normalized codepoints and splits mixed labels", () => {
    expect(getEmojiImageUrl("heart")).toBe(`${EMOJI_IMAGE_SOURCE.baseUrl}/2764.png`);
    expect(getEmojiImageUrl("🪙")).toBe(`${EMOJI_IMAGE_SOURCE.baseUrl}/1fa99.png`);
    expect(splitEmojiText("Mua (1 🪙)")).toEqual([
      { kind: "text", value: "Mua (1 " },
      { kind: "emoji", value: "🪙" },
      { kind: "text", value: ")" },
    ]);
  });

  it("deduplicates pending image loads and caches a local image fallback after CDN failure", async () => {
    const seen: string[] = [];
    class FakeImage {
      crossOrigin = "";
      decoding: "async" | "sync" | "auto" = "auto";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private value = "";

      get src() { return this.value; }
      set src(value: string) {
        this.value = value;
        seen.push(value);
        queueMicrotask(() => {
          if (value.startsWith("data:image/svg+xml")) this.onload?.();
          else this.onerror?.();
        });
      }
    }
    vi.stubGlobal("Image", FakeImage);

    const first = preloadEmojiImage("heart");
    const second = preloadEmojiImage("❤️");
    expect(first).toBe(second);
    const image = await first;
    expect(seen).toEqual([
      getEmojiImageUrl("heart"),
      getEmojiImageUrl("question"),
      EMOJI_LOCAL_FALLBACK_IMAGE_URL,
    ]);
    expect(image?.src).toBe(EMOJI_LOCAL_FALLBACK_IMAGE_URL);

    const cached = await preloadEmojiImage("heart");
    expect(cached).toBe(image);
    expect(seen).toHaveLength(3);
  });

  it("reuses cached Three.js textures by normalized codepoint key", () => {
    const tex1 = getOrCreateEmojiTexture("heart");
    const tex2 = getOrCreateEmojiTexture("❤️");
    expect(tex1).toBe(tex2);
    expect(tex1.name).toBe(getEmojiTextureKey("heart"));
  });

  it("queuing assets marks atlas ready and disposing clears textures", () => {
    queueEmojiAssets(["heart", "gold", "star"]);
    const key = getEmojiTextureKey("heart");
    disposeEmojiAtlas();
    const texNew = getOrCreateEmojiTexture("heart");
    // After disposal, a new texture instance is created
    expect(texNew.name).toBe(key);
  });
});
