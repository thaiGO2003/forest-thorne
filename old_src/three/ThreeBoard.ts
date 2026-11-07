/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */

import * as THREE from "three";
import {
  BATTLEFIELD_COLS,
  BATTLEFIELD_ROWS,
  BENCH_DEFAULT_CAP,
  BENCH_MAX_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  COLOR_PALETTE,
  PLAYER_COLS,
  TILE_SIZE,
  TILE_SPACING,
  type BoardTileData
} from "./types.js";

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

/**
 * Board mode profile:
 * - "planning": 5x5 player tactical placement grid (Source: src/systems/BoardSystem.ts:74-76)
 * - "combat": 5x10 full battlefield arena with Left Ally (0..4) and Right Enemy (5..9)
 *   (Source: src/core/boardConstants.ts:19-24)
 */
export type BoardProfileKind = "planning" | "combat";

/**
 * Options for board construction
 */
export interface BoardBuildOptions {
  profile?: BoardProfileKind;
  tileData?: BoardTileData[][];
  benchCap?: number;
}

/**
 * Result handles for board interaction (tiles, highlights, bench capacity)
 */
export interface BuiltBoard {
  group: THREE.Group;
  tiles: THREE.Mesh[][];
  benchTiles: THREE.Mesh[];
  ground: THREE.Mesh;
  profile: BoardProfileKind;
  getBenchCap: () => number;
  setBenchCap: (cap: number) => void;
  clearAllHighlights: () => void;
  dispose: () => void;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 */

const TILE_HEIGHT = 0.5;
const TILE_TOP_OFFSET = TILE_HEIGHT / 2;
const GROUND_SIZE = 60;
const EDGE_LENGTH = 1;

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * Resolve tile ownership type according to board profile:
 * - In planning mode: all tiles belong to the player.
 * - In combat mode: columns 0..4 are player/ally; columns 5..9 are enemy.
 * Source: src/core/boardConstants.ts:19-24, src/ui/BoardRenderer.ts:45-60
 */
function defaultTileType(row: number, col: number, profile: BoardProfileKind): "player" | "enemy" {
  if (profile === "planning") return "player";
  return col < PLAYER_COLS ? "player" : "enemy";
}

/**
 * Checkerboard tile color styling.
 * Alternating grass pattern: (row + col) % 2 === 0
 * Source: src/ui/BoardRenderer.ts:180-186
 */
function tileColorFor(type: string, row: number, col: number): number {
  const isEven = (row + col) % 2 === 0;
  if (type === "player") {
    return isEven ? COLOR_PALETTE.grassA : COLOR_PALETTE.boardLeft;
  }
  if (type === "enemy") {
    return isEven ? COLOR_PALETTE.grassB : COLOR_PALETTE.boardRight;
  }
  return isEven ? COLOR_PALETTE.grassA : COLOR_PALETTE.grassB;
}

/**
 * Wood beam frame enclosing the active board profile dimensions.
 */
function addBorderFrame(group: THREE.Group, cols: number, rows: number): void {
  const step = TILE_SIZE + TILE_SPACING;
  const width = cols * step + TILE_SPACING;
  const depth = rows * step + TILE_SPACING;
  const beamMaterial = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.woodBorder,
    flatShading: true,
    roughness: 1
  });
  const beamHeight = 0.7;

  const makeBeam = (w: number, d: number, x: number, z: number): void => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, beamHeight, d), beamMaterial);
    beam.position.set(x, beamHeight / 2 - 0.05, z);
    beam.castShadow = true;
    beam.receiveShadow = true;
    group.add(beam);
  };

  makeBeam(width + EDGE_LENGTH * 2, EDGE_LENGTH, 0, -depth / 2 - EDGE_LENGTH / 2);
  makeBeam(width + EDGE_LENGTH * 2, EDGE_LENGTH, 0, depth / 2 + EDGE_LENGTH / 2);
  makeBeam(EDGE_LENGTH, depth, -width / 2 - EDGE_LENGTH / 2, 0);
  makeBeam(EDGE_LENGTH, depth, width / 2 + EDGE_LENGTH / 2, 0);
}

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Convert grid (row, col) to world XZ position centered at origin.
 *
 * @param row - Grid row (0..4)
 * @param col - Grid column (0..4 for planning, 0..9 for combat)
 * @param profile - Target board profile (default "combat")
 * @returns World position Vector3 with tile top as Y
 */
export function gridToWorld(
  row: number,
  col: number,
  profile: BoardProfileKind = "combat"
): THREE.Vector3 {
  const cols = profile === "planning" ? BOARD_COLS : BATTLEFIELD_COLS;
  const rows = profile === "planning" ? BOARD_ROWS : BATTLEFIELD_ROWS;
  const step = TILE_SIZE + TILE_SPACING;
  const x = (col - (cols - 1) / 2) * step;
  const z = (row - (rows - 1) / 2) * step;
  return new THREE.Vector3(x, TILE_TOP_OFFSET, z);
}

/**
 * Convert bench slot index to world position (front row, player side).
 * Positions are aligned according to the 12-slot visual layout.
 *
 * @param index - Bench slot index (0..11)
 * @param profile - Board profile to calculate relative front offset (default "combat")
 * @returns World position Vector3 with tile top as Y
 */
export function benchToWorld(
  index: number,
  profile: BoardProfileKind = "combat"
): THREE.Vector3 {
  const rows = profile === "planning" ? BOARD_ROWS : BATTLEFIELD_ROWS;
  const step = TILE_SIZE + TILE_SPACING;
  const boardDepth = rows * step;
  const x = (index - (BENCH_MAX_SLOTS - 1) / 2) * step;
  const z = boardDepth / 2 + TILE_SIZE;
  return new THREE.Vector3(x, TILE_TOP_OFFSET, z);
}

/**
 * Build the full low-poly arena: ground, board tiles, 12 visual bench slots, and border.
 *
 * @param optionsOrTileData - Optional configuration options or legacy 2D tile data array
 * @returns Built board handles and lifecycle functions
 */
export function buildBoard(optionsOrTileData?: BoardBuildOptions | BoardTileData[][]): BuiltBoard {
  const options: BoardBuildOptions = Array.isArray(optionsOrTileData)
    ? { tileData: optionsOrTileData }
    : (optionsOrTileData ?? {});

  const profile = options.profile ?? "combat";
  const rows = profile === "planning" ? BOARD_ROWS : BATTLEFIELD_ROWS;
  const cols = profile === "planning" ? BOARD_COLS : BATTLEFIELD_COLS;
  let activeBenchCap = Math.min(BENCH_MAX_SLOTS, Math.max(0, options.benchCap ?? BENCH_DEFAULT_CAP));

  const group = new THREE.Group();
  group.name = `forest-arena-${profile}`;

  // 1. Ground plane (dark forest floor)
  const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: COLOR_PALETTE.forestGrassDark,
    flatShading: true,
    roughness: 1
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.name = "arena-ground";
  group.add(ground);

  // 2. Shared geometries
  const tileGeometry = new THREE.BoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE);
  const edgeGeometry = new THREE.EdgesGeometry(tileGeometry);

  // 3. Board tiles (5x5 for planning, 5x10 for combat)
  const tiles: THREE.Mesh[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const tileRow: THREE.Mesh[] = [];
    for (let col = 0; col < cols; col += 1) {
      const override = options.tileData?.[row]?.[col];
      const type = override?.type ?? defaultTileType(row, col, profile);
      const material = new THREE.MeshStandardMaterial({
        color: tileColorFor(type, row, col),
        flatShading: true,
        roughness: 0.85
      });
      const tile = new THREE.Mesh(tileGeometry, material);
      const pos = gridToWorld(row, col, profile);
      tile.position.copy(pos);
      tile.castShadow = true;
      tile.receiveShadow = true;
      tile.name = `tile-${row}-${col}`;
      tile.userData = { row, col, type, profile };

      const edgeColor = type === "player" ? COLOR_PALETTE.boardLeftEdge : COLOR_PALETTE.boardRightEdge;
      const edge = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({ color: edgeColor })
      );
      edge.scale.setScalar(1.001);
      tile.add(edge);

      if (override?.highlighted) applyHighlight(tile, override.highlightColor);
      group.add(tile);
      tileRow.push(tile);
    }
    tiles.push(tileRow);
  }

  // 4. Bench row: Always instantiate 12 visual slots, hide/disable slots beyond active capacity
  // Source: src/scenes/CombatScene.ts:3146-3166, :4169-4193
  const benchTiles: THREE.Mesh[] = [];
  for (let index = 0; index < BENCH_MAX_SLOTS; index += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: COLOR_PALETTE.benchTile,
      flatShading: true,
      roughness: 0.9
    });
    const tile = new THREE.Mesh(tileGeometry, material);
    tile.position.copy(benchToWorld(index, profile));
    tile.castShadow = true;
    tile.receiveShadow = true;
    tile.name = `bench-${index}`;
    const isActive = index < activeBenchCap;
    tile.visible = isActive;
    tile.userData = { benchIndex: index, type: "bench", active: isActive };
    group.add(tile);
    benchTiles.push(tile);
  }

  // 5. Wood border frame around board
  addBorderFrame(group, cols, rows);

  const setBenchCap = (cap: number): void => {
    activeBenchCap = Math.min(BENCH_MAX_SLOTS, Math.max(0, cap));
    for (let i = 0; i < benchTiles.length; i += 1) {
      const active = i < activeBenchCap;
      benchTiles[i].visible = active;
      benchTiles[i].userData.active = active;
    }
  };

  const getBenchCap = (): number => activeBenchCap;

  const clearAllHighlights = (): void => {
    for (let r = 0; r < tiles.length; r += 1) {
      for (let c = 0; c < tiles[r].length; c += 1) {
        clearHighlight(tiles[r][c]);
      }
    }
    for (let i = 0; i < benchTiles.length; i += 1) {
      clearHighlight(benchTiles[i]);
    }
  };

  const dispose = (): void => {
    groundGeometry.dispose();
    groundMaterial.dispose();
    tileGeometry.dispose();
    edgeGeometry.dispose();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh || (obj as THREE.LineSegments).isLineSegments) {
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
  };

  return {
    group,
    tiles,
    benchTiles,
    ground,
    profile,
    getBenchCap,
    setBenchCap,
    clearAllHighlights,
    dispose
  };
}

/**
 * Highlight tile with emissive selection color.
 *
 * @param tile - Target tile mesh
 * @param color - Highlight hex color (default move cyan)
 */
export function applyHighlight(tile: THREE.Mesh, color: number = COLOR_PALETTE.highlightMove): void {
  const material = tile.material as THREE.MeshStandardMaterial;
  if (!material.emissive) return;
  material.emissive.setHex(color);
  material.emissiveIntensity = 0.55;
  tile.userData.highlighted = true;
}

/**
 * Remove highlight emissive from tile.
 *
 * @param tile - Target tile mesh
 */
export function clearHighlight(tile: THREE.Mesh): void {
  const material = tile.material as THREE.MeshStandardMaterial;
  if (!material.emissive) return;
  material.emissive.setHex(0x000000);
  material.emissiveIntensity = 0;
  tile.userData.highlighted = false;
}

/**
 * Clear highlights from all tiles in a board.
 */
export function clearAllHighlights(board: BuiltBoard): void {
  board.clearAllHighlights();
}

export default {
  buildBoard,
  gridToWorld,
  benchToWorld,
  applyHighlight,
  clearHighlight,
  clearAllHighlights
};
