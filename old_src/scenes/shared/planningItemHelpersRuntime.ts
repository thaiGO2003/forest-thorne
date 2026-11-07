import { ROWS, PLAYER_COLS } from "../../core/boardConstants.js";

import { ITEM_BY_ID } from "../../data/items.js";

import { BoardSystem, type Bench, type Board } from "../../systems/BoardSystem.js";
import { getEquipmentNameKey, normalizeEquipIds } from "./sceneEquipmentRuntime.js";

interface PlanningItemPlayer {
  itemBag: string[];
  board?: Board | null;
  bench?: Bench;
}

interface PlanningItemScene {
  player: PlanningItemPlayer;
}

export function planningConsumeItem(scene: PlanningItemScene, itemId: string, amount: number = 1): boolean {
    if (!itemId || amount <= 0) return false;
    let remain = amount;
    const next: string[] = [];
    for (let i = 0; i < scene.player.itemBag.length; i += 1) {
      const id = scene.player.itemBag[i];
      if (id === itemId && remain > 0) {
        remain -= 1;
        continue;
      }
      next.push(id);
    }
    if (remain > 0) return false;
    scene.player.itemBag = next;
    return true;
}

export function isPlanningEquipmentItem(_scene: unknown, itemId: string): boolean {
    return ITEM_BY_ID[itemId]?.kind === "equipment";
}

export function getPlanningEquipmentNameKey(_scene: unknown, itemId: string): string | null {
    return getEquipmentNameKey(itemId);
}

export function planningNormalizeEquipIds(_scene: unknown, equips: string[], unit: unknown = null): string[] {
    return normalizeEquipIds(equips, unit);
}

export function getPlanningItemCount(scene: PlanningItemScene, itemId: string): number {
    if (!itemId) return 0;
    return scene.player.itemBag.reduce((sum, id) => sum + (id === itemId ? 1 : 0), 0);
}

export function planningCountUnitCopies(scene: PlanningItemScene, baseId: string): number {
    let count = 0;
    // Check board (player side only)
    if (scene.player.board) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < PLAYER_COLS; c++) {
          const u = BoardSystem.getUnitAt(scene.player.board, r, c);
          if (u && u.baseId === baseId) count++;
        }
      }
    }
    // Check bench
    if (scene.player.bench) {
      scene.player.bench.forEach((u) => {
        if (u && u.baseId === baseId) count++;
      });
    }
    return count;
}
