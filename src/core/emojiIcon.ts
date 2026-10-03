import * as THREE from "three";

// A61. Emoji/icon authority and fallback behavior
// Semantic icon names map to canonical Unicode characters and optional emoji-api slugs.
export const SEMANTIC_EMOJIS: Record<string, { char: string; slug?: string }> = {
  empty: { char: "▫️", slug: "white-small-square" },
  heart: { char: "❤️", slug: "red-heart" },
  gold: { char: "🪙", slug: "coin" },
  trophy: { char: "🏆", slug: "trophy" },
  star: { char: "⭐", slug: "star" },
  swords: { char: "⚔️", slug: "crossed-swords" },
  shield: { char: "🛡️", slug: "shield" },
  gear: { char: "⚙️", slug: "gear" },
  book: { char: "📖", slug: "open-book" },
  crown: { char: "👑", slug: "crown" },
  sparkles: { char: "✨", slug: "sparkles" },
  dice: { char: "🎲", slug: "game-die" },
  hourglass: { char: "⏳", slug: "hourglass-done" },
  lock: { char: "🔒", slug: "locked" },
  unlock: { char: "🔓", slug: "unlocked" },
  refresh: { char: "🔄", slug: "counterclockwise-arrows-button" },
  skull: { char: "💀", slug: "skull" },
  fire: { char: "🔥", slug: "fire" },
  droplet: { char: "💧", slug: "droplet" },
  leaf: { char: "🍃", slug: "leaf-fluttering-in-wind" },
  rock: { char: "🪨", slug: "rock" },
  wind: { char: "💨", slug: "dashing-away" },
  moon: { char: "🌙", slug: "crescent-moon" },
  bug: { char: "🐛", slug: "bug" },
  sparkle: { char: "❇️", slug: "sparkle" },
  zap: { char: "⚡", slug: "high-voltage" },
  bow: { char: "🏹", slug: "bow-and-arrow" },
  potion: { char: "🧪", slug: "test-tube" },
  hammer: { char: "🔨", slug: "hammer" },
  map: { char: "🗺️", slug: "world-map" },
  speaker: { char: "🔊", slug: "speaker-high-volume" },
  mute: { char: "🔇", slug: "muted-speaker" },
  check: { char: "✅", slug: "check-mark-button" },
  cross: { char: "❌", slug: "cross-mark" },
  info: { char: "ℹ️", slug: "information" },
  question: { char: "❔", slug: "white-question-mark" },
};

// Inverted lookup map for glyph aliases -> semantic name
const GLYPH_TO_SEMANTIC: Record<string, string> = {};
for (const [name, def] of Object.entries(SEMANTIC_EMOJIS)) {
  const stripped = stripVariationSelectors(def.char);
  GLYPH_TO_SEMANTIC[def.char] = name;
  GLYPH_TO_SEMANTIC[stripped] = name;
}

export function stripVariationSelectors(str: string): string {
  return str.replace(/[\uFE0E\uFE0F]/g, "");
}

export function toCodepointKey(str: string): string {
  const clean = stripVariationSelectors(str);
  const cps: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const cp = clean.codePointAt(i);
    if (cp !== undefined) {
      cps.push(cp.toString(16));
      if (cp > 0xffff) i++;
    }
  }
  return cps.join("_");
}

export function normalizeIconInput(val: unknown): string {
  if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
    return "empty";
  }
  const str = String(val).trim();
  if (SEMANTIC_EMOJIS[str]) return str;
  const stripped = stripVariationSelectors(str);
  if (GLYPH_TO_SEMANTIC[str]) return GLYPH_TO_SEMANTIC[str]!;
  if (GLYPH_TO_SEMANTIC[stripped]) return GLYPH_TO_SEMANTIC[stripped]!;

  // Extended pictographic check
  try {
    if (/\p{Extended_Pictographic}/u.test(str)) {
      return str;
    }
  } catch {
    // regex fallback
  }
  return "question";
}

export function resolveEmojiChar(nameOrInput: string): string {
  const norm = normalizeIconInput(nameOrInput);
  if (SEMANTIC_EMOJIS[norm]) return SEMANTIC_EMOJIS[norm]!.char;
  if (norm === "question") return "❔";
  return norm; // direct pictographic value
}

// In-memory cache for emoji-api lookups
const API_CACHE = new Map<string, string | null>();

export async function fetchEmojiMetadata(semanticName: string): Promise<string | null> {
  const norm = normalizeIconInput(semanticName);
  if (API_CACHE.has(norm)) return API_CACHE.get(norm)!;

  const apiKey = typeof import.meta !== "undefined" && import.meta.env ? (import.meta.env.VITE_EMOJI_API_KEY as string | undefined) : undefined;
  const entry = SEMANTIC_EMOJIS[norm];
  if (!apiKey || !entry?.slug) {
    API_CACHE.set(norm, null);
    return null;
  }

  try {
    const url = `https://emoji-api.com/emojis/${encodeURIComponent(entry.slug)}?access_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[emojiIcon] lookup failure for ${norm} (${res.status})`);
      API_CACHE.set(norm, null);
      return null;
    }
    const data = await res.json();
    const char = data?.character || null;
    API_CACHE.set(norm, char);
    return char;
  } catch (err) {
    console.warn(`[emojiIcon] network error for ${norm}:`, err);
    API_CACHE.set(norm, null);
    return null;
  }
}

// --- 3D Texture Management ---
const TEXTURE_CACHE = new Map<string, THREE.CanvasTexture | THREE.Texture>();
let isAtlasReady = false;

export function getEmojiTextureKey(charOrName: string): string {
  const char = resolveEmojiChar(charOrName);
  return `emoji_${toCodepointKey(char)}`;
}

export function getOrCreateEmojiTexture(charOrName: string): THREE.Texture {
  const char = resolveEmojiChar(charOrName);
  const key = getEmojiTextureKey(char);

  const cached = TEXTURE_CACHE.get(key);
  if (cached) return cached;

  if (typeof document === "undefined" || !document.createElement) {
    // Headless / SSR safe empty fallback
    const fallback = new THREE.Texture();
    fallback.name = key;
    TEXTURE_CACHE.set(key, fallback);
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 96, 96);
    ctx.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char, 48, 52);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.name = key;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  TEXTURE_CACHE.set(key, tex);
  return tex;
}

export function queueEmojiAssets(namesOrChars: string[]): void {
  for (const item of namesOrChars) {
    getOrCreateEmojiTexture(item);
  }
  isAtlasReady = true;
}

export function isEmojiAtlasReady(): boolean {
  return isAtlasReady;
}

export function disposeEmojiAtlas(): void {
  for (const tex of TEXTURE_CACHE.values()) {
    tex.dispose();
  }
  TEXTURE_CACHE.clear();
  isAtlasReady = false;
}
