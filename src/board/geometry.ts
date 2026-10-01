// Board geometry (spec §11.2–11.6, A31.1). Pure math, shared by render, input and tests.
// Logical columns 0..9; visual column 5 is the river lane, so logical col ≥5 shifts +1 visually.
// The river is presentation only: logical indices, targeting, saves and network never see it.
export const LOGICAL_COLS = 10;
export const RIVER_X = 5;
export const VISUAL_COLS = LOGICAL_COLS + 1;
export const ROWS_PER_PLAYER = 5;

export type Profile = "solo" | "coop2" | "coop4";
export const PROFILE_PLAYERS: Record<Profile, number> = { solo: 1, coop2: 2, coop4: 4 };

export interface Cell { x: number; z: number }

export const totalRows = (p: Profile) => PROFILE_PLAYERS[p] * ROWS_PER_PLAYER;

/** Logical (col,row) → visual grid cell. */
export const toVisual = (col: number, row: number): Cell => ({ x: col < RIVER_X ? col : col + 1, z: row });

/** Visual cell → logical (col,row), or null for the river lane / outside the battlefield. */
export function toLogical(x: number, z: number, p: Profile = "solo"): { col: number; row: number } | null {
  if (!Number.isInteger(x) || !Number.isInteger(z) || x === RIVER_X) return null;
  if (x < 0 || x >= VISUAL_COLS || z < 0 || z >= totalRows(p)) return null;
  return { col: x < RIVER_X ? x : x - 1, row: z };
}

/** Rows owned by player slot `slot` (0-based). */
export const ownsRow = (slot: number, row: number) => Math.floor(row / ROWS_PER_PLAYER) === slot;

/**
 * Cells on the rectangle ring `inset` blocks outside the battlefield, clockwise from the
 * top-left corner, each cell exactly once. Deterministic order = stable bench slot positions.
 */
export function ringCells(inset: number, p: Profile = "solo"): Cell[] {
  const minX = -inset, maxX = VISUAL_COLS - 1 + inset, minZ = -inset, maxZ = totalRows(p) - 1 + inset;
  const out: Cell[] = [];
  for (let x = minX; x <= maxX; x++) out.push({ x, z: minZ });
  for (let z = minZ + 1; z <= maxZ; z++) out.push({ x: maxX, z });
  for (let x = maxX - 1; x >= minX; x--) out.push({ x, z: maxZ });
  for (let z = maxZ - 1; z > minZ; z--) out.push({ x: minX, z });
  return out;
}

/**
 * Immediate walkable brown ring (inset 1, x=-1..11, z=-1..5).
 * ponytail: spec §11.4 states "exactly 40 ring cells" but that rectangle has 13×7−11×5 = 36 unique
 * cells; the coordinates are authoritative here. Revisit if the spec owner clarifies the 40.
 */
export const brownRing = (p: Profile = "solo") => ringCells(1, p);

/** Separate bench perimeter (inset 2). Solo: 44 cells = hard bench cap. */
export const benchPerimeter = (p: Profile = "solo") => ringCells(2, p);

/** Visible bench slot positions, capped by capacity; slot i is always the same perimeter cell. */
export const benchSlots = (capacity: number, p: Profile = "solo") => benchPerimeter(p).slice(0, Math.max(0, capacity));

/** River lane cells (one per row). */
export const riverCells = (p: Profile = "solo"): Cell[] => Array.from({ length: totalRows(p) }, (_, z) => ({ x: RIVER_X, z }));
