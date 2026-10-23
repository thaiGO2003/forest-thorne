/**
 * ThreeGameConfig.ts
 *
 * Viewport dimensions, scale modes, WebGL renderer options, and game setup configs
 * for Three.js. Replaces Phaser GameConfig with pure structural configs.
 */

import { getRenderDevicePixelRatio } from "../core/renderConfig.js";

export interface ViewportLike {
  visualViewport?: { width?: unknown; height?: unknown };
  innerWidth?: unknown;
  innerHeight?: unknown;
  screen?: { width?: unknown; height?: unknown };
  devicePixelRatio?: unknown;
  navigator?: { userAgent?: unknown };
}

export const BASE_GAME_WIDTH = 1600;
export const BASE_GAME_HEIGHT = 900;

export const GAME_SCALE_CONFIG = Object.freeze({
  mode: "EXPAND",
  autoCenter: "CENTER_BOTH"
});

export const GAME_RENDER_CONFIG = Object.freeze({
  antialias: true,
  antialiasGL: true,
  roundPixels: false,
  pixelArt: false,
  powerPreference: "high-performance"
});

export interface ThreeGameConfigOptions {
  parent?: string | HTMLElement;
  backgroundColor?: string | number;
  scenes?: unknown[];
  windowRef?: ViewportLike | null;
  shadowMap?: boolean;
  pixelRatio?: number;
}

export interface ThreeGameConfigResult {
  type: string;
  parent: string | HTMLElement;
  width: number;
  height: number;
  resolution: number;
  autoRound: boolean;
  backgroundColor: string | number;
  disableVisibilityChange: boolean;
  scene?: unknown[];
  render: typeof GAME_RENDER_CONFIG;
  scale: typeof GAME_SCALE_CONFIG;
  shadows: boolean;
}

export function createThreeGameConfig({
  parent = "app",
  backgroundColor = "#11141b",
  scenes = [],
  windowRef = typeof window !== "undefined" ? (window as unknown as ViewportLike) : null,
  shadowMap = true,
  pixelRatio
}: ThreeGameConfigOptions = {}): ThreeGameConfigResult {
  const resolution = typeof pixelRatio === "number" && pixelRatio > 0
    ? pixelRatio
    : getRenderDevicePixelRatio(windowRef);

  return {
    type: "THREE_WEBGL",
    parent,
    width: BASE_GAME_WIDTH,
    height: BASE_GAME_HEIGHT,
    resolution,
    autoRound: false,
    backgroundColor,
    disableVisibilityChange: true,
    scene: scenes,
    render: { ...GAME_RENDER_CONFIG },
    scale: { ...GAME_SCALE_CONFIG },
    shadows: shadowMap
  };
}

/**
 * Parity helper with identical signature to createPhaserGameConfig.
 */
export function createPhaserGameConfig(options: ThreeGameConfigOptions = {}): ThreeGameConfigResult {
  return createThreeGameConfig(options);
}

export default {
  BASE_GAME_WIDTH,
  BASE_GAME_HEIGHT,
  GAME_SCALE_CONFIG,
  GAME_RENDER_CONFIG,
  createThreeGameConfig,
  createPhaserGameConfig
};
