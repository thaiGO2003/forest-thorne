import Phaser from "phaser";
import { getRenderDevicePixelRatio } from "./renderConfig.js";

interface ViewportLike {
    visualViewport?: { width?: unknown; height?: unknown };
    innerWidth?: unknown;
    innerHeight?: unknown;
    screen?: { width?: unknown; height?: unknown };
    devicePixelRatio?: unknown;
    navigator?: { userAgent?: unknown };
}

export const BASE_GAME_WIDTH = 1600;
export const BASE_GAME_HEIGHT = 900;

/** Phaser Scale Manager is the single source of truth for viewport scaling. */
export const GAME_SCALE_CONFIG = {
  mode: Phaser.Scale.EXPAND,
  autoCenter: Phaser.Scale.CENTER_BOTH
};

export const GAME_RENDER_CONFIG = {
  antialias: true,
  antialiasGL: true,
  roundPixels: false,
  pixelArt: false,
  powerPreference: "high-performance"
};

export function createPhaserGameConfig({
  parent = "app",
  backgroundColor = "#11141b",
  scenes,
  windowRef = typeof window !== "undefined" ? window as unknown as ViewportLike : null
}: {
  parent?: string;
  backgroundColor?: string;
  scenes?: Phaser.Types.Scenes.SceneType | Phaser.Types.Scenes.SceneType[];
  windowRef?: ViewportLike | null;
}) {
  return {
    type: Phaser.AUTO,
    parent,
    width: BASE_GAME_WIDTH,
    height: BASE_GAME_HEIGHT,
    resolution: getRenderDevicePixelRatio(windowRef),
    autoRound: false,
    backgroundColor,
    disableVisibilityChange: true,
    scene: scenes,
    render: { ...GAME_RENDER_CONFIG },
    scale: { ...GAME_SCALE_CONFIG }
  };
}
