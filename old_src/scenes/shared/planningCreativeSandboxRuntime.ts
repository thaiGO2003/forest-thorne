import type Phaser from "phaser";
import { COLS } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import {
  getCreativeSandboxUnits as getCreativeSandboxUnitsForPlayer,
  getDisplayedGold as getDisplayedGoldForPlayer,
  hasManualEnemySandboxUnits as hasCreativeEnemySandboxUnits,
  isCreativeMode as isCreativeAiMode,
  removeCreativeSandboxUnit
} from "../../core/creativeMode.js";
import { BoardSystem } from "../../systems/BoardSystem.js";
import type { Board } from "../../systems/BoardSystem.js";
import { getPlanningBoardRowCount } from "./planningCoopSessionRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { UpgradeSystem } from "../../systems/UpgradeSystem.js";

type Side = "LEFT" | "RIGHT";
type SandboxUnit = Record<string, unknown> & {
  uid: string; baseId: string; star: number; side: Side; row: number; col: number;
  sourceUid?: string | null; base?: { name?: string };
};
type CreativePlayer = { gold?: number; round?: number; board: Board; creativeSandboxUnits: Array<{ side?: string } & Record<string, unknown>> };
type CreativeScene = Phaser.Scene & { aiMode: string; player: CreativePlayer; [key: string]: unknown };
type CombatResultLike = { round?: number };

function isSandboxUnit(value: unknown): value is SandboxUnit {
  if (!value || typeof value !== "object") return false;
  const unit = value as Partial<SandboxUnit>;
  return typeof unit.uid === "string" && typeof unit.baseId === "string"
    && typeof unit.star === "number" && (unit.side === "LEFT" || unit.side === "RIGHT")
    && typeof unit.row === "number" && typeof unit.col === "number";
}

export function isPlanningCreativeMode(scene: CreativeScene): boolean { return isCreativeAiMode(scene.aiMode); }
export function planningShouldSkipPostCombatStatsModal(scene: CreativeScene, result: CombatResultLike | null): boolean {
  return scene.aiMode === "TUTORIAL" && Number(result?.round ?? scene.player.round ?? 0) === 1;
}
export function getPlanningDisplayedGold(scene: CreativeScene): number | string { return getDisplayedGoldForPlayer(scene.aiMode, scene.player?.gold ?? 0); }
export function getPlanningCreativeSandboxUnits(scene: CreativeScene, side: string | null = null): SandboxUnit[] {
  return getCreativeSandboxUnitsForPlayer(scene.player, side).filter(isSandboxUnit);
}
export function hasPlanningManualEnemySandboxUnits(scene: CreativeScene): boolean { return hasCreativeEnemySandboxUnits(scene.player); }
export function findPlanningCreativeSandboxUnit(scene: CreativeScene, uid: string | null): SandboxUnit | null {
  if (!uid) return null;
  return getPlanningCreativeSandboxUnits(scene).find((unit) => unit.uid === uid) ?? null;
}
export function findPlanningCreativeSandboxUnitAt(scene: CreativeScene, row: number, col: number, side: string | null = null): SandboxUnit | null {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return getPlanningCreativeSandboxUnits(scene, side).find((unit) => unit.row === row && unit.col === col) ?? null;
}
export function planningRemoveCreativeSandboxUnitByUid(scene: CreativeScene, uid: string): boolean {
  const hadManualEnemy = hasPlanningManualEnemySandboxUnits(scene);
  const removed = removeCreativeSandboxUnit(scene.player, uid);
  if (!removed) return false;
  if (hadManualEnemy && !hasPlanningManualEnemySandboxUnits(scene)) addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("log.enemySandboxFallback"), "EVENT" as Parameters<typeof addPlanningLog>[2]);
  return true;
}
export function canPlanningOccupyCreativeSandboxCell(scene: CreativeScene, row: number, col: number, side: Side, ignoreUid: string | null = null): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (row < 0 || row >= getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]) || col < 0 || col >= COLS) return false;
  if (side === "LEFT" && BoardSystem.getUnitAt(scene.player.board, row, col)) return false;
  const occupiedSandbox = findPlanningCreativeSandboxUnitAt(scene, row, col, side);
  return !(occupiedSandbox && occupiedSandbox.uid !== ignoreUid);
}
export function tryPlanningAutoMergeCreativeSandbox(scene: CreativeScene, side: string | null = null): boolean {
  const units = getPlanningCreativeSandboxUnits(scene, side);
  const groups = new Map<string, SandboxUnit[]>();
  units.forEach((unit) => {
    if (unit.star >= 3) return;
    const key = `${unit.side}:${unit.baseId}:${unit.star}`;
    const group = groups.get(key) ?? [];
    if (!groups.has(key)) groups.set(key, group);
    group.push(unit);
  });
  let merged = false;
  groups.forEach((group) => {
    while (group.length >= 3) {
      const refs = group.splice(0, 3);
      const combine = UpgradeSystem.combineUnits(refs);
      if (!combine?.success || !combine.unit) break;
      refs.forEach((unit) => planningRemoveCreativeSandboxUnitByUid(scene, unit.uid));
      const mergedUnit = { ...combine.unit, sandbox: true, sourceUid: refs[0]?.sourceUid ?? refs[0]?.uid ?? null,
        side: refs[0]?.side === "RIGHT" ? "RIGHT" as const : "LEFT" as const, row: refs[0]?.row ?? 0, col: refs[0]?.col ?? 0 };
      if (!isSandboxUnit(mergedUnit)) break;
      scene.player.creativeSandboxUnits.push(mergedUnit);
      group.push(mergedUnit);
      merged = true;
      const label = mergedUnit.base?.name ?? mergedUnit.baseId;
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.creativeStarUp", { label, star: mergedUnit.star }));
    }
  });
  return merged;
}
