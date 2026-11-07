import { clamp } from "../../core/gameUtils.js";

interface StorageCraftLayoutOptions {
  compact?: boolean;
  craftX?: number;
  craftY?: number;
  craftW?: number;
  suggestCount?: number;
  [key: string]: unknown;
}

function toNumber(value: unknown, fallback: number = 0): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function computePlanningStorageCraftLayout(options: StorageCraftLayoutOptions = {}) {
  const compact = options.compact === true;
  const craftX = toNumber(options.craftX);
  const craftY = toNumber(options.craftY);
  const craftW = Math.max(120, toNumber(options.craftW));
  const suggestCount = Math.max(1, Math.floor(toNumber(options.suggestCount, 9)));

  const craftCellGap = compact ? 4 : 5;
  const craftCell = clamp(Math.floor((craftW - 30) / 5), 26, 32);
  const craftGridW = craftCell * 3 + craftCellGap * 2;
  const craftGridH = craftGridW;
  const craftArrowGap = compact ? 14 : 18;
  const gridInsetX = 0;
  const gridInsetY = compact ? 24 : 26;
  const gridX0 = craftX + gridInsetX;
  const gridY0 = craftY + gridInsetY;
  const outputX = gridX0 + craftGridW + craftArrowGap;
  const outputY = gridY0 + Math.floor((craftGridH - craftCell) * 0.5);
  const craftColumnRight = outputX + craftCell;
  const craftColumnW = craftColumnRight - craftX;

  const suggestCellSize = compact ? 34 : 36;
  const suggestGap = 4;
  const sectionGap = compact ? 10 : 12;
  const suggestAreaX = craftColumnRight + sectionGap;
  const suggestAreaW = Math.max(0, craftX + craftW - suggestAreaX);
  const rawSuggestCols = Math.floor((suggestAreaW + suggestGap) / (suggestCellSize + suggestGap));
  const suggestCols = Math.min(3, Math.max(1, rawSuggestCols));
  const suggestRows = Math.max(1, Math.ceil(suggestCount / suggestCols));
  const suggestBlockW = suggestCols * suggestCellSize + Math.max(0, suggestCols - 1) * suggestGap;
  const suggestSlotsX = suggestAreaX;

  return {
    compact,
    craftX,
    craftY,
    craftW,
    craftCell,
    craftCellGap,
    craftGridW,
    craftGridH,
    craftArrowGap,
    gridX0,
    gridY0,
    outputX,
    outputY,
    craftColumnRight,
    craftColumnW,
    craftHintY: gridY0 + craftGridH + (compact ? 10 : 12),
    suggestion: {
      areaX: suggestAreaX,
      areaY: craftY - 2,
      areaW: suggestAreaW,
      rowY: craftY - 2,
      cellSize: suggestCellSize,
      gap: suggestGap,
      cols: suggestCols,
      rows: suggestRows,
      slotsX: suggestSlotsX,
      slotsY: gridY0,
      blockW: suggestBlockW
    }
  };
}
