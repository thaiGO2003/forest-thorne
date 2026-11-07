/**
 * Canonical frame dimensions for raster assets loaded into Phaser.
 * Measure source files before changing values — see phaser-gamedev skill.
 */
export const EMOJI_SVG_FRAME_SIZE = 72;

interface AssetFrameSpec {
  loader: string;
  frameWidth?: number;
  frameHeight?: number;
  displayScale?: (size: number) => number;
  key?: string;
  path?: string;
  notes?: string;
}

export const ASSET_FRAME_SPECS: Record<string, AssetFrameSpec> = Object.freeze({
  emojiTwemoji: {
    loader: "scene.load.svg",
    frameWidth: EMOJI_SVG_FRAME_SIZE,
    frameHeight: EMOJI_SVG_FRAME_SIZE,
    displayScale: (size: number): number => size / EMOJI_SVG_FRAME_SIZE,
    notes: "Individual SVG emoji textures; not a spritesheet grid."
  },
  menuBackground: {
    loader: "scene.load.image",
    key: "menu_bg",
    path: "assets/backgrounds/menu-bg.png",
    notes: "Single full-frame image; cover math in computeMenuBackgroundCover."
  }
});

interface EmojiFrameMathResult {
  frameWidth: number;
  frameHeight: number;
  displayScale: number;
}

export function verifyEmojiFrameMath(displaySize: number): EmojiFrameMathResult {
  const frame = EMOJI_SVG_FRAME_SIZE;
  const safeDisplay = Number.isFinite(displaySize) && displaySize > 0 ? displaySize : frame;
  return {
    frameWidth: frame,
    frameHeight: frame,
    displayScale: safeDisplay / frame
  };
}
