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
  paw: { char: "🐾", slug: "paw-prints" },
  mushroom: { char: "🍄", slug: "mushroom" },
  chestnut: { char: "🌰", slug: "chestnut" },
  bubbles: { char: "🫧", slug: "bubbles" },
  fastForward: { char: "⏩", slug: "fast-forward-button" },
  palette: { char: "🎨", slug: "artist-palette" },
  sprout: { char: "🌱", slug: "seedling" },
  shopfront: { char: "🏪", slug: "convenience-store" },
  emptyBox: { char: "⬜", slug: "white-large-square" },
  tree: { char: "🌳", slug: "deciduous-tree" },
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

// Pinned image source for DOM/canvas/Three.js emoji rendering.
// Twemoji graphics are licensed CC BY 4.0:
// https://github.com/jdecked/twemoji/blob/v16.0.1/LICENSE-GRAPHICS
export const EMOJI_IMAGE_SOURCE = {
  name: "Twemoji",
  version: "16.0.1",
  license: "CC BY 4.0",
  baseUrl: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72",
} as const;

export const EMOJI_LOCAL_FALLBACK_IMAGE_URL =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect x="10" y="10" width="52" height="52" rx="12" fill="#f3e5c7" stroke="#3f2d1f" stroke-width="6"/><path d="M20 50 32 37l8 8 8-10 7 8" fill="none" stroke="#3f2d1f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="26" r="5" fill="#3f2d1f"/></svg>',
  )}`;

const IMAGE_CACHE = new Map<string, HTMLImageElement | null>();
const IMAGE_PENDING = new Map<string, Promise<HTMLImageElement | null>>();
const IMAGE_LISTENERS = new Set<() => void>();
const EMOJI_SEQUENCE = /\p{Extended_Pictographic}(?:[\uFE0E\uFE0F])?(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F])?)*/gu;

export interface EmojiTextPart { kind: "text" | "emoji"; value: string }

export function splitEmojiText(text: string): EmojiTextPart[] {
  const parts: EmojiTextPart[] = [];
  let at = 0;
  EMOJI_SEQUENCE.lastIndex = 0;
  for (const match of text.matchAll(EMOJI_SEQUENCE)) {
    const index = match.index ?? 0;
    if (index > at) parts.push({ kind: "text", value: text.slice(at, index) });
    parts.push({ kind: "emoji", value: match[0] });
    at = index + match[0].length;
  }
  if (at < text.length) parts.push({ kind: "text", value: text.slice(at) });
  return parts.length ? parts : [{ kind: "text", value: text }];
}

export function getEmojiImageUrl(nameOrInput: string): string {
  const char = resolveEmojiChar(nameOrInput);
  return `${EMOJI_IMAGE_SOURCE.baseUrl}/${toCodepointKey(char).replaceAll("_", "-")}.png`;
}

const FALLBACK_IMAGE_URL = `${EMOJI_IMAGE_SOURCE.baseUrl}/${toCodepointKey(SEMANTIC_EMOJIS.question.char).replaceAll("_", "-")}.png`;

function loadImageUrl(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  const { promise, resolve } = Promise.withResolvers<HTMLImageElement | null>();
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = url;
  return promise;
}

export function preloadEmojiImage(nameOrInput: string): Promise<HTMLImageElement | null> {
  const key = getEmojiTextureKey(nameOrInput);
  if (IMAGE_CACHE.has(key)) return Promise.resolve(IMAGE_CACHE.get(key)!);
  const pending = IMAGE_PENDING.get(key);
  if (pending) return pending;
  const primary = getEmojiImageUrl(nameOrInput);
  const promise = (async () => {
    const image = await loadImageUrl(primary)
      ?? (primary === FALLBACK_IMAGE_URL ? null : await loadImageUrl(FALLBACK_IMAGE_URL))
      ?? await loadImageUrl(EMOJI_LOCAL_FALLBACK_IMAGE_URL);
    IMAGE_CACHE.set(key, image);
    IMAGE_PENDING.delete(key);
    for (const listener of IMAGE_LISTENERS) listener();
    return image;
  })();
  IMAGE_PENDING.set(key, promise);
  return promise;
}

export function getCachedEmojiImage(nameOrInput: string): HTMLImageElement | null {
  const key = getEmojiTextureKey(nameOrInput);
  if (IMAGE_CACHE.has(key)) return IMAGE_CACHE.get(key)!;
  void preloadEmojiImage(nameOrInput);
  return null;
}

export function onEmojiAssetReady(listener: () => void): () => void {
  IMAGE_LISTENERS.add(listener);
  return () => IMAGE_LISTENERS.delete(listener);
}

export function setEmojiRichText(el: HTMLElement, text: string): void {
  const parts = splitEmojiText(text);
  if (!parts.some((part) => part.kind === "emoji")) {
    el.textContent = text;
    return;
  }
  el.replaceChildren();
  for (const part of parts) {
    if (part.kind === "text") {
      el.append(document.createTextNode(part.value));
      continue;
    }
    const img = document.createElement("img");
    img.className = "emoji-inline";
    img.alt = part.value;
    img.decoding = "async";
    img.draggable = false;
    img.src = EMOJI_LOCAL_FALLBACK_IMAGE_URL;
    void preloadEmojiImage(part.value).then((image) => {
      if (image) img.src = image.src;
    });
    el.append(img);
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
    const fallback = new THREE.Texture();
    fallback.name = key;
    TEXTURE_CACHE.set(key, fallback);
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.name = key;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  TEXTURE_CACHE.set(key, tex);

  void preloadEmojiImage(char).then((image) => {
    if (!image || TEXTURE_CACHE.get(key) !== tex) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 96, 96);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, 8, 8, 80, 80);
    tex.needsUpdate = true;
  });

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
  IMAGE_CACHE.clear();
  IMAGE_PENDING.clear();
  isAtlasReady = false;
}

// Shared semantic glyphs complement the current emoji atlas.
export const ICONS = {
  empty: "",
  gold: "🪙", xp: "✨", heart: "❤️", level: "⬆️", round: "🗓️", streakWin: "🔥", streakLoss: "🥶",
  star: SEMANTIC_EMOJIS.star.char, crown: SEMANTIC_EMOJIS.crown.char, skull: SEMANTIC_EMOJIS.skull.char,
  hourglass: SEMANTIC_EMOJIS.hourglass.char, fastForward: SEMANTIC_EMOJIS.fastForward.char,
  palette: SEMANTIC_EMOJIS.palette.char, sprout: SEMANTIC_EMOJIS.sprout.char, shopfront: SEMANTIC_EMOJIS.shopfront.char,
  check: SEMANTIC_EMOJIS.check.char, emptyBox: SEMANTIC_EMOJIS.emptyBox.char,
  mushroom: SEMANTIC_EMOJIS.mushroom.char, chestnut: SEMANTIC_EMOJIS.chestnut.char,
  bubbles: SEMANTIC_EMOJIS.bubbles.char, leaf: SEMANTIC_EMOJIS.leaf.char,
  reroll: "🔄", lock: "🔒", unlock: "🔓", start: "⚔️", sell: "💰", info: "📜", question: SEMANTIC_EMOJIS.question.char,
  library: "📖", tech: SEMANTIC_EMOJIS.tree.char, craft: "⚒️", recipe: "📕", inventory: "🎒", history: "🕰️", settings: "⚙️", home: "🏠",
  shop: "🛒", event: "✨", vet: "🩺", explore: "🧭",
  synergy: "🔗", augment: "💎", language: "🌐", achievements: "🏆", mods: "🧩", tribute: "🎖️",
  social: "💬", donate: "💝", cortisol: "🧘",
  rage: "⚡", hp: "❤️", atk: "🗡️", def: "🛡️", matk: "🔮", mdef: "🧿", range: "🎯", crit: "💥", evade: "💨",
  // Roles
  TANKER: "🛡️", ASSASSIN: "🗡️", ARCHER: "🏹", MAGE: "🔮", SUPPORT: "💚", FIGHTER: "⚔️",
  // Factions
  BEAST: SEMANTIC_EMOJIS.paw.char, AVIAN: "🪶", INSECT: "🐞", REPTILE: "🦎", AQUATIC: "🐟", MYTHICAL: "🐉",
  // Elements
  STONE: "🪨", WIND: "🌪️", FIRE: SEMANTIC_EMOJIS.fire.char, TIDE: "🌊", NIGHT: "🌙", SPIRIT: "👻", SWARM: "🐝", WOOD: "🌿",
  // Statuses
  burn: "🔥", poison: "☠️", bleed: "🩸", freeze: "❄️", stun: "💫", sleep: "💤", silence: "🤐",
  shield: "🛡️", taunt: "📣", healBlock: "🚫", atkUp: "💪", atkDown: "🥀", defUp: "🧱", defDown: "🪓",
  regen: "🌱", reflect: "🪞", immune: "✳️", disease: "🦠", slow: "🐌", haste: "⚡",
} as const;
