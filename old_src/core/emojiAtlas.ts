/**
 * emojiAtlas.ts
 *
 * Centralized Twemoji SVG atlas loader and sprite helpers.
 */

import type Phaser from "phaser";
import { EMOJI_SVG_FRAME_SIZE } from "./assetFrameSpecs.js";

const EMOJI_ASSET_ROOT = "assets/emoji/twemoji";

// Prefix for texture keys to avoid collisions
const EMOJI_TEX_PREFIX = "emoji_";

interface EmojiSpriteOptions {
    size?: number;
    depth?: number;
    alpha?: number;
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
        // Skip variation selector U+FE0F (but keep U+200D ZWJ for compound emojis)
        if (cp === 0xfe0f) continue;
        // Skip variation selector U+FE0E (text presentation)
        if (cp === 0xfe0e) continue;
        codepoints.push(cp.toString(16));
    }
    return codepoints.join("-");
}

/**
 * Get the Phaser texture key for an emoji string.
 */
export function getEmojiTextureKey(emoji: string): string {
    return `${EMOJI_TEX_PREFIX}${emojiToCodepoints(emoji)}`;
}

/**
 * Check if an emoji texture has been loaded.
 */
export function hasEmojiTexture(scene: Phaser.Scene, emoji: string): boolean {
    return scene.textures.exists(getEmojiTextureKey(emoji));
}

/**
 * All unique emojis used in the game, collected statically.
 * This avoids runtime scanning of data modules.
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

/**
 * Deduplicate and filter emoji list.
 */
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

function getEmojiAssetBasePath(baseUrl: string = import.meta.env?.BASE_URL ?? "/"): string {
    const normalizedBaseUrl = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : "/";
    return normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`;
}

interface GetEmojiAssetUrlOptions {
    baseUrl?: string;
    locationHref?: string;
}

export function getEmojiAssetUrl(emoji: string, {
    baseUrl = import.meta.env?.BASE_URL ?? "/",
    locationHref = globalThis?.window?.location?.href ?? "https://localhost/"
}: GetEmojiAssetUrlOptions = {}): string {
    const codepoints = emojiToCodepoints(emoji);
    if (!codepoints) return "";
    return new URL(`${getEmojiAssetBasePath(baseUrl)}${EMOJI_ASSET_ROOT}/${codepoints}.svg`, locationHref).toString();
}

const _loadedKeys: Set<string> = new Set();

let _preloadComplete = false;

/**
 * Queue all emoji SVGs for loading in the given scene's loader.
 * Call this from a preload() method (e.g. LoadingScene).
 */
export interface EmojiSceneLike {
    textures: { exists(key: string): boolean };
    load: {
        svg(key: string, url: string, size?: { width: number; height: number }): void;
        on(event: string, fn: (...args: unknown[]) => void): void;
        once(event: string, fn: (...args: unknown[]) => void): void;
    };
}
export function queueEmojiAssets(scene: Phaser.Scene | EmojiSceneLike): number {
    const emojis = UNIQUE_GAME_EMOJIS;
    let queued = 0;

    for (const emoji of emojis) {
        const key = getEmojiTextureKey(emoji);
        if (scene.textures.exists(key)) {
            _loadedKeys.add(key);
            continue;
        }
        const url = getEmojiAssetUrl(emoji);
        if (!url) continue;

        scene.load.svg(key, url, { width: EMOJI_SVG_FRAME_SIZE, height: EMOJI_SVG_FRAME_SIZE });
        queued += 1;
    }

    // Track completion
    scene.load.on("filecomplete", (fileKey: unknown) => {
        if (typeof fileKey === "string" && fileKey.startsWith(EMOJI_TEX_PREFIX)) {
            _loadedKeys.add(fileKey);
        }
    });

    scene.load.on("loaderror", (file: unknown) => {
        const fileObj = file as { key?: unknown } | null;
        const fileKey = fileObj?.key;
        if (typeof fileKey === "string" && fileKey.startsWith(EMOJI_TEX_PREFIX)) {
            console.warn(`[EmojiAtlas] Failed to load: ${fileKey}`);
        }
    });

    scene.load.once("complete", () => {
        _preloadComplete = true;
    });

    return queued;
}

/**
 * Whether emoji atlas preloading is complete.
 */
export function isEmojiAtlasReady(): boolean {
    return _preloadComplete;
}

interface EmojiGameObject extends Phaser.GameObjects.GameObject {
    _isEmojiSprite?: boolean;
    _emojiString?: string;
}

interface EmojiImage extends Phaser.GameObjects.Image, EmojiGameObject {
    setTexture: (key: string) => this;
}

/**
 * Create a Phaser Image from an emoji texture.
 * Falls back to a Text object if the emoji texture isn't loaded.
 */
export function createEmojiSprite(
    scene: Phaser.Scene,
    x: number,
    y: number,
    emoji: string,
    options: EmojiSpriteOptions = {}
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const { size = 32, depth, alpha = 1 } = options;
    const key = getEmojiTextureKey(emoji);

    if (_loadedKeys.has(key) && scene.textures.exists(key)) {
        const img = scene.add.image(x, y, key) as EmojiImage;
        const scale = size / EMOJI_SVG_FRAME_SIZE;
        img.setScale(scale);
        img.setOrigin(0.5);
        if (depth !== undefined) img.setDepth(depth);
        img.setAlpha(alpha);
        img._isEmojiSprite = true;
        img._emojiString = emoji;
        return img;
    }

    // Fallback: native text
    const txt = scene.add.text(x, y, emoji, {
        fontSize: `${size}px`,
        fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif"
    }).setOrigin(0.5) as EmojiGameObject & Phaser.GameObjects.Text;
    if (depth !== undefined) txt.setDepth(depth);
    txt.setAlpha(alpha);
    txt._isEmojiSprite = false;
    txt._emojiString = emoji;
    return txt;
}

/**
 * Replace an existing text object's emoji content with a sprite image.
 * Returns the replacement object (Image or original Text).
 */
export function replaceTextWithEmoji(
    scene: Phaser.Scene,
    textObj: Phaser.GameObjects.Text,
    emoji: string,
    size: number = 32
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    if (!textObj || !emoji) return textObj;

    const key = getEmojiTextureKey(emoji);
    if (!_loadedKeys.has(key) || !scene.textures.exists(key)) {
        // Can't replace - just update text
        textObj.setText(emoji);
        return textObj;
    }

    const x = textObj.x;
    const y = textObj.y;
    const depth = textObj.depth;
    const alpha = textObj.alpha;
    const visible = textObj.visible;
    const originX = textObj.originX;
    const originY = textObj.originY;

    textObj.destroy();

    const img = scene.add.image(x, y, key) as EmojiImage;
    const scale = size / 72;
    img.setScale(scale);
    img.setOrigin(originX, originY);
    img.setDepth(depth);
    img.setAlpha(alpha);
    img.setVisible(visible);
    img._isEmojiSprite = true;
    img._emojiString = emoji;

    return img;
}

/**
 * Update an emoji game object (Image or Text) with a new emoji.
 * Efficiently swaps texture if it's already an emoji sprite image.
 */
export function updateEmojiObject(
    scene: Phaser.Scene,
    obj: EmojiGameObject & (Phaser.GameObjects.Image | Phaser.GameObjects.Text),
    emoji: string,
    size: number = 32
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    if (!obj || !emoji) return obj;

    const key = getEmojiTextureKey(emoji);

    // If already an emoji sprite, just swap texture
    if (obj._isEmojiSprite && "setTexture" in obj && typeof (obj as EmojiImage).setTexture === "function" && _loadedKeys.has(key)) {
        (obj as EmojiImage).setTexture(key);
        const scale = size / 72;
        (obj as Phaser.GameObjects.Image).setScale(scale);
        obj._emojiString = emoji;
        return obj;
    }

    // If it's a text object, update text (either with sprite or native)
    if ("setText" in obj && typeof (obj as Phaser.GameObjects.Text).setText === "function") {
        const textObj = obj as Phaser.GameObjects.Text & EmojiGameObject;
        if (_loadedKeys.has(key) && scene.textures.exists(key)) {
            // Convert text to image
            return replaceTextWithEmoji(scene, textObj, emoji, size);
        }
        textObj.setText(emoji);
        textObj._emojiString = emoji;
        return textObj;
    }

    return obj;
}

/**
 * Create an emoji sprite inside a Phaser Container at local coordinates.
 */
export function createEmojiInContainer(
    scene: Phaser.Scene,
    localX: number,
    localY: number,
    emoji: string,
    size: number = 32
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const key = getEmojiTextureKey(emoji);

    if (_loadedKeys.has(key) && scene.textures.exists(key)) {
        const img = scene.add.image(localX, localY, key) as EmojiImage;
        const scale = size / 72;
        img.setScale(scale);
        img.setOrigin(0.5);
        img._isEmojiSprite = true;
        img._emojiString = emoji;
        return img;
    }

    // Fallback
    const txt = scene.add.text(localX, localY, emoji, {
        fontSize: `${size}px`,
        fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif"
    }).setOrigin(0.5) as EmojiGameObject & Phaser.GameObjects.Text;
    txt._isEmojiSprite = false;
    txt._emojiString = emoji;
    return txt;
}
