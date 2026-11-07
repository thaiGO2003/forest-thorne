/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

import type * as THREE from "three";

/**
 * Camera View Presets for Tactical Auto-Battler
 */
export type CameraPreset = "isometric" | "topdown" | "free" | "cinematic";

/**
 * 3D Graphics Quality Preset
 */
export type GraphicsQuality = "high" | "medium" | "low";

/**
 * Configuration options for initializing ThreeEngine
 */
export interface ThreeEngineConfig {
  container: HTMLElement;
  width?: number;
  height?: number;
  pixelRatio?: number;
  quality?: GraphicsQuality;
  showStats?: boolean;
}

/**
 * Camera settings and boundary limits
 */
export interface CameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  initialPosition?: THREE.Vector3;
  target?: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
}

/**
 * Tile visual description for low-poly board
 */
export interface BoardTileData {
  row: number;
  col: number;
  type: "player" | "enemy" | "neutral" | "bench";
  highlighted?: boolean;
  highlightColor?: number;
  elevation?: number;
}

/**
 * 3D Unit representation in Three.js scene
 */
export interface Unit3DConfig {
  id: string;
  baseId: string;
  name: string;
  star: number;
  side: "player" | "enemy";
  gridRow: number;
  gridCol: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  primaryColor?: number;
  secondaryColor?: number;
}

/**
 * Low-poly prop element (tree, rock, water, crystal)
 */
export interface PropConfig {
  type: "tree" | "rock" | "crystal" | "fence" | "flower";
  position: THREE.Vector3;
  rotation?: THREE.Euler;
  scale?: THREE.Vector3;
  color?: number;
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

/**
 * Player board dimensions (5x5 grid = 25 cells)
 * Source: src/systems/BoardSystem.ts:74-76
 */
export const BOARD_ROWS = 5;
export const BOARD_COLS = 5;

/**
 * Battlefield full combat dimensions (5 rows x 10 cols = 50 cells)
 * Source: src/core/boardConstants.ts:19-24
 */
export const BATTLEFIELD_ROWS = 5;
export const BATTLEFIELD_COLS = 10;
export const PLAYER_COLS = 5;
export const RIGHT_COL_START = 5;
export const RIGHT_COL_END = 9;
export const BOARD_GAP_COLS = 1;

/**
 * 3D Tile sizing (world units)
 */
export const TILE_SIZE = 2.0;
export const TILE_SPACING = 0.15;

/**
 * Bench capacity constants:
 * Default capacity is 9 (Source: src/scenes/CombatScene.ts:3239-3241, getBenchCap() = 9 + player.benchBonus)
 * Maximum visual slots rendered is 12 (Source: src/scenes/CombatScene.ts:3146-3166)
 */
export const BENCH_DEFAULT_CAP = 9;
export const BENCH_MAX_SLOTS = 12;

/**
 * Shop offer card count: 5 cards (Source: src/scenes/CombatScene.ts:4111-4116)
 */
export const SHOP_CARD_COUNT = 5;

/**
 * Preset camera viewpoints centered at origin
 */
export const DEFAULT_CAMERA_POSITIONS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: {
    pos: [0, 18, 16],
    target: [0, 0, 0]
  },
  topdown: {
    pos: [0, 24, 2],
    target: [0, 0, 0]
  },
  free: {
    pos: [0, 14, 18],
    target: [0, 0, 0]
  },
  cinematic: {
    pos: [-12, 8, 12],
    target: [0, 1, 0]
  }
};

/**
 * Palette colors extracted directly from Phaser UI theme and BoardRenderer:
 * Source: src/core/uiTheme.ts:38-50, src/ui/BoardRenderer.ts:45-60
 */
export const COLOR_PALETTE = {
  boardLeft: 0x133627,
  boardLeftEdge: 0x4cc99b,
  boardRight: 0x3d2523,
  boardRightEdge: 0xd08a7f,
  grassA: 0x6eaf4d,
  grassB: 0x5a973f,
  grassEdgeA: 0xa2d56f,
  grassEdgeB: 0x84be5a,
  riverA: 0x1f8fe0,
  riverB: 0x176eb7,
  riverEdgeA: 0x8fddff,
  riverEdgeB: 0x6ec7f1,
  ally: 0x45f0a0,
  allySoft: 0xa4ffd5,
  localAlly: 0x8fd8ff,
  localSoft: 0xd9f4ff,
  enemy: 0xff627f,
  enemySoft: 0xffbed0,
  river: 0x5fdcff,
  riverSoft: 0xe0fbff,
  benchTile: 0x223247,
  highlightMove: 0x58c7f3,
  highlightAttack: 0xff4d4d,
  goldCrystal: 0xffd700,
  woodBorder: 0x5c4033,
  ambientLight: 0xd4e6b5,
  sunLight: 0xfffaed,
  fogColor: 0x111625,
  forestGrassLight: 0x6eaf4d,
  forestGrassDark: 0x5a973f,
  playerTile: 0x133627,
  enemyTile: 0x3d2523
};

/**
 * ============================================================================
 * 3. EXPORTS
 * ============================================================================
 */

export default {
  BOARD_ROWS,
  BOARD_COLS,
  BATTLEFIELD_ROWS,
  BATTLEFIELD_COLS,
  PLAYER_COLS,
  RIGHT_COL_START,
  RIGHT_COL_END,
  BOARD_GAP_COLS,
  TILE_SIZE,
  TILE_SPACING,
  BENCH_DEFAULT_CAP,
  BENCH_MAX_SLOTS,
  SHOP_CARD_COUNT,
  DEFAULT_CAMERA_POSITIONS,
  COLOR_PALETTE
};
