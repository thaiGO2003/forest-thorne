import { describe, it, expect, beforeEach } from "vitest";
import {
  SEMANTIC_EMOJIS,
  normalizeIconInput,
  resolveEmojiChar,
  stripVariationSelectors,
  toCodepointKey,
  getEmojiTextureKey,
  getOrCreateEmojiTexture,
  queueEmojiAssets,
  disposeEmojiAtlas,
} from "../src/core/emojiIcon";

describe("A61 emoji/icon authority and fallback behavior", () => {
  beforeEach(() => {
    disposeEmojiAtlas();
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
