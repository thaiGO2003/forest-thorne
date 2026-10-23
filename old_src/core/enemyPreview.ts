import { RIGHT_COL_END, RIGHT_COL_START } from "./boardConstants.js";
import { clamp } from "./gameUtils.js";

interface EnemyPreviewEntry {
    baseId?: unknown;
    row?: unknown;
    col?: unknown;
    star?: unknown;
    uid?: unknown;
    equips?: unknown;
}

interface EnemyPreviewOptions {
    rowCount?: unknown;
    index?: unknown;
}

export function buildStableEnemyPreviewUid(entry: EnemyPreviewEntry = {}, index: number = 0): string {
  const baseId = typeof entry?.baseId === "string" && entry.baseId ? entry.baseId : "enemy";
  const row = Number.isFinite(entry?.row) ? Math.round(entry.row as number) : 0;
  const col = Number.isFinite(entry?.col) ? Math.round(entry.col as number) : RIGHT_COL_START;
  return `enemy_${baseId}_${row}_${col}_${index}`;
}

export function normalizeEnemyPreviewEntry(entry: EnemyPreviewEntry, options: EnemyPreviewOptions = {}): Record<string, unknown> | null {
  if (!entry || typeof entry !== "object" || typeof entry.baseId !== "string" || !entry.baseId) return null;
  const maxRow = Number.isFinite(options?.rowCount)
    ? Math.max(0, Math.floor(options.rowCount as number) - 1)
    : Math.max(0, Math.round(Number(entry.row) || 0));
  const starRaw = Number.isFinite(entry.star) ? Math.round(entry.star as number) : 1;
  const rowRaw = Number.isFinite(entry.row) ? Math.round(entry.row as number) : 0;
  const colRaw = Number.isFinite(entry.col) ? Math.round(entry.col as number) : RIGHT_COL_START;
  return {
    ...entry,
    uid: typeof entry.uid === "string" && entry.uid ? entry.uid : buildStableEnemyPreviewUid(entry, Number(options?.index) || 0),
    baseId: entry.baseId,
    side: "RIGHT",
    star: clamp(starRaw, 1, 3),
    row: clamp(rowRaw, 0, maxRow),
    col: clamp(colRaw, RIGHT_COL_START, RIGHT_COL_END),
    equips: Array.isArray(entry.equips) ? entry.equips.filter((equipId): equipId is string => typeof equipId === "string") : []
  };
}

export function stampEnemyPreviewEntries(entries: unknown[] = [], options: EnemyPreviewOptions = {}): Array<Record<string, unknown>> {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, index) => normalizeEnemyPreviewEntry(entry as EnemyPreviewEntry, { ...options, index }))
    .filter((e): e is Record<string, unknown> => e !== null);
}
