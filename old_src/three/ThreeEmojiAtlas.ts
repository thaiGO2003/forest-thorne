/**
 * ThreeEmojiAtlas.ts
 *
 * Centralized Twemoji SVG atlas loader and 3D sprite helpers for Three.js.
 */

import * as THREE from "three";
import { EMOJI_SVG_FRAME_SIZE } from "../core/assetFrameSpecs.js";

const EMOJI_ASSET_ROOT = "assets/emoji/twemoji";
const EMOJI_TEX_PREFIX = "emoji_";

export interface EmojiSpriteOptions {
  size?: number;
  depth?: number;
  alpha?: number;
}

export interface GetEmojiAssetUrlOptions {
  baseUrl?: string;
  locationHref?: string;
}

export interface EmojiSceneLike {
  textures?: {
    exists?(key: string): boolean;
    get?(key: string): THREE.Texture | undefined;
    add?(key: string, texture: THREE.Texture): void;
  };
  load?: {
    svg?(key: string, url: string, size?: { width: number; height: number }): void;
    on?(event: string, fn: (...args: unknown[]) => void): void;
    once?(event: string, fn: (...args: unknown[]) => void): void;
  };
}

export interface ThreeEmojiSprite extends THREE.Sprite {
  _isEmojiSprite?: boolean;
  _emojiString?: string;
  setTexture?: (key: string) => this;
}

/**
 * Convert an emoji string to its Twemoji SVG filename (dash-separated hex codepoints).
 * Filters out variation selectors (U+FE0E, U+FE0F) for cleaner lookup.
 */
export function emojiToCodepoints(emoji: string): string {
  if (!emoji) return "";
  const codepoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp === undefined || cp === null) continue;
    // Skip variation selector U+FE0F
    if (cp === 0xfe0f) continue;
    // Skip variation selector U+FE0E (text presentation)
    if (cp === 0xfe0e) continue;
    codepoints.push(cp.toString(16));
  }
  return codepoints.join("-");
}

/**
 * Get the texture key for an emoji string.
 */
export function getEmojiTextureKey(emoji: string): string {
  return `${EMOJI_TEX_PREFIX}${emojiToCodepoints(emoji)}`;
}

/**
 * All unique emojis used in the game, collected statically.
 */
export const GAME_EMOJIS: string[] = [
  // Elements / Tribes
  "🔥", "💧", "🌪️", "🪨", "🌙", "🐝", "👻", "🌳",
  // Common UI
  "⚔️", "🛡️", "🔮", "✨", "💠", "🗡️", "🪄", "👊",
  "❤️", "⭐", "🎯", "📐", "📊", "💥", "🧪", "💨",
  "🔥", "❄️", "⚡", "😴", "🩸", "☠️", "🦷", "💚",
  "🔰", "🔻", "🌟", "💫", "🏹", "🦋", "🦠",
  // Items & Crafting
  "⚒", "⚗️", "📦", "🔒", "🔨", "🪵", "🌾", "🍄",
  "🌺", "🪶", "🌲", "🌿", "⚙", "🧤", "🧥", "🧩",
  // UI Icons
  "🎁", "🎉", "🎮", "🎲", "🏆", "🏠", "🏷️",
  "💰", "💵", "🪙", "💾", "🔍", "🔔", "🔊", "🔇",
  "📋", "📚", "📜", "📝", "📄", "📁", "📂",
  "💡", "💬", "🐾", "👹", "💀", "🌀", "🌊",
  "🤖", "🖥️", "🗑️", "🚫", "📉", "🔄",
  // Symbols
  "✅", "❌", "❔", "❗", "⚠️", "✖"
];

function getUniqueEmojis(): string[] {
  const set = new Set<string>();
  const result: string[] = [];
  for (const emoji of GAME_EMOJIS) {
    const key = emojiToCodepoints(emoji);
    if (!key || set.has(key)) continue;
    set.add(key);
    result.push(emoji);
  }
  return result;
}

export const UNIQUE_GAME_EMOJIS: readonly string[] = Object.freeze(getUniqueEmojis());

export function getEmojiAssetUrl(
  emoji: string,
  {
    baseUrl = import.meta.env?.BASE_URL ?? "/",
    locationHref = globalThis?.window?.location?.href ?? "https://localhost/"
  }: GetEmojiAssetUrlOptions = {}
): string {
  const codepoints = emojiToCodepoints(emoji);
  if (!codepoints) return "";
  const normalizedBaseUrl = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : "/";
  const basePath = normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`;
  return new URL(`${basePath}${EMOJI_ASSET_ROOT}/${codepoints}.svg`, locationHref).toString();
}
const _loadedKeys: Set<string> = new Set();
const _textureCache: Map<string, THREE.CanvasTexture> = new Map();
let _preloadComplete = false;

/**
 * Check if an emoji texture has been loaded.
 */
export function hasEmojiTexture(scene: EmojiSceneLike | null | undefined, emoji: string): boolean {
  const key = getEmojiTextureKey(emoji);
  if (_loadedKeys.has(key) || _textureCache.has(key)) return true;
  return !!scene?.textures?.exists?.(key);
}

/**
 * Queue all emoji SVGs for loading.
 */
export function queueEmojiAssets(scene: EmojiSceneLike | null | undefined): number {
  const emojis = UNIQUE_GAME_EMOJIS;
  let queued = 0;

  for (const emoji of emojis) {
    const key = getEmojiTextureKey(emoji);
    if (scene?.textures?.exists?.(key) || _textureCache.has(key)) {
      _loadedKeys.add(key);
      continue;
    }
    const url = getEmojiAssetUrl(emoji);
    if (!url) continue;

    if (typeof scene?.load?.svg === "function") {
      scene.load.svg(key, url, { width: EMOJI_SVG_FRAME_SIZE, height: EMOJI_SVG_FRAME_SIZE });
      queued += 1;
    } else {
      _loadedKeys.add(key);
      queued += 1;
    }
  }

  if (typeof scene?.load?.on === "function") {
    scene.load.on("filecomplete", (fileKey: unknown) => {
      if (typeof fileKey === "string" && fileKey.startsWith(EMOJI_TEX_PREFIX)) {
        _loadedKeys.add(fileKey);
      }
    });
  }

  if (typeof scene?.load?.once === "function") {
    scene.load.once("complete", () => {
      _preloadComplete = true;
    });
  } else {
    _preloadComplete = true;
  }

  return queued;
}

/**
 * Whether emoji atlas preloading is complete.
 */
export function isEmojiAtlasReady(): boolean {
  return _preloadComplete;
}

/**
 * Renders an emoji to a crisp CanvasTexture.
 */
function getOrCreateEmojiCanvasTexture(emoji: string): THREE.CanvasTexture {
  const key = getEmojiTextureKey(emoji);
  const existing = _textureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = "80px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 64, 68);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  _textureCache.set(key, texture);
  _loadedKeys.add(key);
  return texture;
}

/**
 * Create a Three.js Sprite from an emoji.
 */
export function createEmojiSprite(
  scene: EmojiSceneLike | null | undefined,
  x: number,
  y: number,
  emoji: string,
  options: EmojiSpriteOptions = {}
): ThreeEmojiSprite {
  void scene;
  const { size = 32, depth, alpha = 1 } = options;
  const texture = getOrCreateEmojiCanvasTexture(emoji);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: alpha });
  const sprite = new THREE.Sprite(material) as ThreeEmojiSprite;

  sprite.position.set(x, y, depth !== undefined ? depth : 0.05);
  sprite.scale.set(size, size, 1);
  sprite._isEmojiSprite = true;
  sprite._emojiString = emoji;
  sprite.userData.avatarOwnedMaterial = true;
  sprite.userData.avatarOwnedTexture = false; // Cached globally

  sprite.setTexture = (key: string) => {
    const cached = _textureCache.get(key);
    if (cached) {
      sprite.material.map = cached;
      sprite.material.needsUpdate = true;
    }
    return sprite;
  };

  return sprite;
}

/**
 * Replace an existing emoji object with a new emoji sprite.
 */
export function replaceTextWithEmoji(
  scene: EmojiSceneLike | null | undefined,
  textObj: THREE.Object3D,
  emoji: string,
  size: number = 32
): ThreeEmojiSprite {
  const x = textObj?.position?.x ?? 0;
  const y = textObj?.position?.y ?? 0;
  const depth = textObj?.position?.z ?? 0.05;

  if (textObj?.parent) {
    textObj.parent.remove(textObj);
  }

  return createEmojiSprite(scene, x, y, emoji, { size, depth });
}

/**
 * Update an emoji sprite with a new emoji.
 */
export function updateEmojiObject(
  scene: EmojiSceneLike | null | undefined,
  obj: ThreeEmojiSprite,
  emoji: string,
  size: number = 32
): ThreeEmojiSprite {
  if (!obj || !emoji) return obj;

  const texture = getOrCreateEmojiCanvasTexture(emoji);
  if (obj.material) {
    obj.material.map = texture;
    obj.material.needsUpdate = true;
  }
  obj.scale.set(size, size, 1);
  obj._emojiString = emoji;
  return obj;
}

/**
 * Create an emoji sprite inside a container group at local coordinates.
 */
export function createEmojiInContainer(
  scene: EmojiSceneLike | null | undefined,
  localX: number,
  localY: number,
  emoji: string,
  size: number = 32
): ThreeEmojiSprite {
  return createEmojiSprite(scene, localX, localY, emoji, { size, depth: 0.02 });
}

/**
 * Disposes all cached CanvasTextures in the emoji atlas.
 */
export function disposeEmojiAtlas(): void {
  _textureCache.forEach((tex) => tex.dispose());
  _textureCache.clear();
  _loadedKeys.clear();
  _preloadComplete = false;
}

export default {
  emojiToCodepoints,
  getEmojiTextureKey,
  GAME_EMOJIS,
  UNIQUE_GAME_EMOJIS,
  getEmojiAssetUrl,
  hasEmojiTexture,
  queueEmojiAssets,
  isEmojiAtlasReady,
  createEmojiSprite,
  replaceTextWithEmoji,
  updateEmojiObject,
  createEmojiInContainer,
  disposeEmojiAtlas
};
