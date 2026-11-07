import { COLS } from "../../core/boardConstants.js";
import { getGoldReserveScaling } from "../../core/gameUtils.js";

interface CommonSkillContext {
  attacker: { star?: number; [key: string]: unknown } | null;
  skill?: unknown;
  [key: string]: unknown;
}

interface CommonSkillUnit {
  sprite?: { active?: boolean; x: number; y: number };
}

interface CommonSkillScene {
  getStarSkillMultiplier: (star: number) => number;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi: (unit: unknown) => void;
  syncCombatLabels?: (unit: unknown) => void;
  player?: { gold?: number };
  [key: string]: unknown;
}

interface KnockbackTarget {
  col: number;
  row: number;
  [key: string]: unknown;
}

interface KnockbackEnemy {
  alive?: boolean;
  row?: number;
  col?: number;
  classType?: string;
}

export function buildCommonSkillEffectContext(scene: CommonSkillScene, context: CommonSkillContext): Record<string, unknown> {
  const attacker = context.attacker;
  const star = attacker?.star ?? 1;
  return {
    ...context,
    star,
    starScale: scene.getStarSkillMultiplier(star),
    goldMultiplier: getGoldReserveScaling(scene?.player?.gold ?? 0)
  };
}

export function showCommonSkillText(scene: CommonSkillScene, unit: CommonSkillUnit, text: string, color: string, offsetY: number = 45): void {
  if (!unit?.sprite?.active) return;
  scene.showFloatingText(unit.sprite.x, unit.sprite.y - offsetY, text, color);
}

export function updateCommonSkillUnit(scene: CommonSkillScene, unit: unknown): void {
  scene.updateCombatUnitUi(unit);
}

export function syncCommonSkillLabels(scene: CommonSkillScene, unit: unknown): void {
  scene.syncCombatLabels?.(unit);
}

export function findSharedKnockbackPosition(
  target: KnockbackTarget | null | undefined,
  pushDirection: number,
  enemies: KnockbackEnemy[],
  boardWidth: number = COLS
): number {
  if (!target || !Number.isFinite(target.col) || !Number.isFinite(target.row)) return 0;
  const currentCol = Math.max(0, Math.min(boardWidth - 1, target.col));
  const currentRow = target.row;
  const scanStart = pushDirection > 0 ? currentCol + 1 : currentCol - 1;
  const scanEnd = pushDirection > 0 ? boardWidth - 1 : 0;
  const scanStep = pushDirection > 0 ? 1 : -1;
  let lastEmptyCol = currentCol;

  for (let col = scanStart; pushDirection > 0 ? col <= scanEnd : col >= scanEnd; col += scanStep) {
    const occupant = enemies.find((unit) => unit.alive && unit.row === currentRow && unit.col === col);
    if (!occupant) {
      lastEmptyCol = col;
      continue;
    }
    if (occupant.classType === "TANKER") {
      const stopBeforeTanker = pushDirection > 0 ? col - 1 : col + 1;
      return Math.max(0, Math.min(boardWidth - 1, stopBeforeTanker));
    }
    break;
  }

  return Math.max(0, Math.min(boardWidth - 1, lastEmptyCol));
}
