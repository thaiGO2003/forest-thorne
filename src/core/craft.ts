// Crafting (spec A7). Staging is non-destructive: `staged` only references bag items; craft() is atomic.
export interface Recipe {
  id: string;
  /** Footprint side: 1, 2 or 3. */
  size: 1 | 2 | 3;
  /** Row-major size×size pattern; null = must be empty. */
  pattern: (string | null)[];
}

export const BASE_MATERIALS = ["bark", "feather", "belt", "claw", "tear", "crystal"] as const;

// ponytail: spec cites 506 authored recipes but ships no recipe table; only the tutorial recipe is authored (A21 round 6).
// Load the full table here when recipe data is supplied.
export const RECIPES: Recipe[] = [{ id: "blue_buff", size: 1, pattern: ["tear"] }];

/** Active square per craftTableLevel: [rowOffset, colOffset, side]. */
const ACTIVE: Record<number, [number, number, number]> = { 1: [1, 1, 1], 2: [0, 0, 2], 3: [0, 0, 3] };

export function activeIndices(level: number): number[] {
  const a = ACTIVE[level];
  if (!a) return [];
  const [r0, c0, n] = a;
  const out: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push((r0 + r) * 3 + c0 + c);
  return out;
}

/** Slide each recipe across the active square; every staged cell outside the footprint must be empty. */
export function matchRecipe(staged: (string | null)[], level: number, recipes = RECIPES): Recipe | null {
  const a = ACTIVE[level];
  if (!a || staged.every((x) => !x)) return null;
  const [r0, c0, n] = a;
  for (const rec of recipes) {
    for (let dr = 0; dr + rec.size <= n; dr++) {
      for (let dc = 0; dc + rec.size <= n; dc++) {
        let ok = true;
        for (let i = 0; i < 9 && ok; i++) {
          const r = Math.floor(i / 3) - r0 - dr;
          const c = (i % 3) - c0 - dc;
          const want = r >= 0 && c >= 0 && r < rec.size && c < rec.size ? rec.pattern[r * rec.size + c] ?? null : null;
          ok = (staged[i] ?? null) === want;
        }
        if (ok) return rec;
      }
    }
  }
  return null;
}

/** Staged multiset must be covered by the bag. */
function bagCovers(bag: string[], staged: (string | null)[]): boolean {
  const need: Record<string, number> = {};
  for (const x of staged) if (x) need[x] = (need[x] ?? 0) + 1;
  return Object.entries(need).every(([id, k]) => bag.filter((b) => b === id).length >= k);
}

export interface CraftState {
  itemBag: string[];
  craftTableLevel: number;
  craftHistory: string[];
}

/** Staging may only use active cells; returns a new staged array or null (bag untouched either way). */
export function stage(staged: (string | null)[], index: number, item: string | null, level: number): (string | null)[] | null {
  if (!activeIndices(level).includes(index)) return null;
  const next = staged.slice();
  next[index] = item;
  return next;
}

/** A7 atomic commit. Returns crafted id, or null with state unchanged. Caller clears staged on success. */
export function craft(s: CraftState, staged: (string | null)[], recipes = RECIPES): string | null {
  const rec = matchRecipe(staged, s.craftTableLevel, recipes);
  if (!rec || !bagCovers(s.itemBag, staged)) return null;
  const bag = s.itemBag.slice();
  for (const x of staged) if (x) bag.splice(bag.indexOf(x), 1);
  const out = `eq_${rec.id}`;
  bag.push(out);
  s.itemBag = bag;
  s.craftHistory.push(rec.id);
  return out;
}
