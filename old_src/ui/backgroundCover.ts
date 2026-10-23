interface TextureSourceLike {
  naturalWidth?: number;
  naturalHeight?: number;
  width?: number;
  height?: number;
}

interface TextureSourceEntry {
  image?: TextureSourceLike;
  width?: number;
  height?: number;
}

interface TextureFrameLike {
  w: number;
  h: number;
  x: number;
  y: number;
}

interface SceneWithTextures {
  textures?: {
    exists?: (key: string) => boolean;
    get?: (key: string) => {
      getSourceImage?: () => TextureSourceLike | null;
      source?: TextureSourceEntry[];
      frames?: { __BASE?: { width?: number; height?: number } };
    };
  };
}

interface SettableImage {
  setTexture?: (key: string) => void;
  setDisplaySize?: (w: number, h: number) => void;
  setPosition?: (x: number, y: number) => void;
}

export function computeCoverDisplaySize(
  sourceWidth: number | null | undefined,
  sourceHeight: number | null | undefined,
  frameWidth: number | null | undefined,
  frameHeight: number | null | undefined
): { width: number; height: number } {
  const safeFrameWidth = Number.isFinite(frameWidth as number) && (frameWidth as number) > 0 ? (frameWidth as number) : 1;
  const safeFrameHeight = Number.isFinite(frameHeight as number) && (frameHeight as number) > 0 ? (frameHeight as number) : 1;
  const safeSourceWidth = Number.isFinite(sourceWidth as number) && (sourceWidth as number) > 0 ? (sourceWidth as number) : safeFrameWidth;
  const safeSourceHeight = Number.isFinite(sourceHeight as number) && (sourceHeight as number) > 0 ? (sourceHeight as number) : safeFrameHeight;
  const scale = Math.max(safeFrameWidth / safeSourceWidth, safeFrameHeight / safeSourceHeight);
  return {
    width: safeSourceWidth * scale,
    height: safeSourceHeight * scale
  };
}

function resolveTextureSourceSize(scene: SceneWithTextures | null | undefined, key: string): { width: number | null; height: number | null } {
  const texture = scene?.textures?.get?.(key);
  const source = (texture?.getSourceImage?.() ?? texture?.source?.[0]?.image ?? texture?.source?.[0] ?? null) as TextureSourceLike | null;
  const width = source?.naturalWidth ?? source?.width ?? texture?.frames?.__BASE?.width ?? null;
  const height = source?.naturalHeight ?? source?.height ?? texture?.frames?.__BASE?.height ?? null;
  return { width, height };
}

export function applyCoverTextureToImage(
  scene: SceneWithTextures | null | undefined,
  image: SettableImage | null,
  key: string,
  frame: TextureFrameLike
): SettableImage | null {
  if (!scene?.textures?.exists?.(key) || !image) return image;
  const { width: sourceWidth, height: sourceHeight } = resolveTextureSourceSize(scene, key);
  const { width, height } = computeCoverDisplaySize(sourceWidth, sourceHeight, frame.w, frame.h);
  image.setTexture?.(key);
  image.setDisplaySize?.(width, height);
  image.setPosition?.(frame.x + frame.w / 2, frame.y + frame.h / 2);
  return image;
}
