import Phaser from "phaser";
import { CRAFT_RECIPES, ITEM_BY_ID, RECIPE_BY_ID, type CraftRecipe } from "../../data/items.js";
import { PHASE } from "../../core/boardConstants.js";
import { noteEndlessCraft } from "../../core/endlessAchievements.js";
import { t } from "../../i18n/index.js";

import { refreshPlanningStorageUi } from "./planningInventoryRuntime.js";
import { getPlanningItemCount } from "./planningItemHelpersRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { getPlanningEndlessAchievementSnapshot, persistPlanningProgress, planningUpdateEndlessAchievementProfile } from "./planningRunStateRuntime.js";

import { planningShouldShowCraftingInPlanning } from "./planningTechRuntime.js";
import { guardPlanningTutorialAction, recordPlanningTutorialEvent } from "./planningTutorialRuntime.js";

interface PlanningCraftPlayer {
  craftTableLevel?: number;
  itemBag: string[];
  craftedItems?: string[];
  bench?: unknown[];
  board?: unknown;
  [key: string]: unknown;
}

interface PlanningCraftSceneLike extends Phaser.Scene {
  player: PlanningCraftPlayer;
  craftGridItems: Array<string | null>;
  settingsVisible?: boolean;
  phase?: unknown;
  audioFx?: { play?: (key: string) => void };
  tutorialOverlay?: { handleTrigger?: (key: string) => void };
  [key: string]: unknown;
}

export function getPlanningCraftGridSize(scene: PlanningCraftSceneLike): number {
    const level = scene.player?.craftTableLevel ?? 0;
    if (level >= 3) return 3;
    if (level >= 2) return 2;
    if (level >= 1) return 1;
    return 0;
}

export function getPlanningCraftActiveIndices(scene: PlanningCraftSceneLike): number[] {
    const size = getPlanningCraftGridSize(scene);
    if (size >= 3) return [0, 1, 2, 3, 4, 5, 6, 7, 8];
    if (size >= 2) return [0, 1, 3, 4];
    if (size >= 1) return [4];
    return [];
}

export function getPlanningRecipeGridSize(_scene: PlanningCraftSceneLike, recipe: CraftRecipe | null | undefined): number {
    const sizeRaw = Number.isFinite(recipe?.gridSize) ? Math.floor(Number(recipe?.gridSize)) : null;
    if (sizeRaw !== null && sizeRaw >= 1 && sizeRaw <= 3) return sizeRaw;
    return Array.isArray(recipe?.pattern) && (recipe.pattern as unknown[]).length >= 9 ? 3 : 2;
}

export function getPlanningRecipePattern(scene: PlanningCraftSceneLike, recipe: CraftRecipe | null | undefined): Array<string | null> {
    const size = getPlanningRecipeGridSize(scene, recipe);
    const out: Array<string | null> = Array.from({ length: size * size }, () => null);
    if (!recipe || typeof recipe !== "object") return out;
    if (Array.isArray(recipe.pattern) && recipe.pattern.length) {
      for (let i = 0; i < out.length; i += 1) out[i] = recipe.pattern[i] ?? null;
      return out;
    }
    const req = Array.isArray(recipe.requires) ? recipe.requires : [];
    for (let i = 0; i < Math.min(out.length, req.length); i += 1) out[i] = req[i] ?? null;
    return out;
}

export function getPlanningRecipeRequiredList(scene: PlanningCraftSceneLike, recipe: CraftRecipe | null | undefined): string[] {
    return getPlanningRecipePattern(scene, recipe).filter((entry): entry is string => Boolean(entry));
}

export function getPlanningCraftGridState(scene: PlanningCraftSceneLike, tableSize: number = getPlanningCraftGridSize(scene)): Array<string | null> {
    const grid: Array<string | null> = Array.from({ length: tableSize * tableSize }, () => null);
    if (tableSize <= 1) {
      grid[0] = scene.craftGridItems[4] ?? null;
      return grid;
    }
    if (tableSize <= 2) {
      const src = [0, 1, 3, 4];
      src.forEach((sourceIdx, i) => {
        grid[i] = scene.craftGridItems[sourceIdx] ?? null;
      });
      return grid;
    }
    for (let i = 0; i < 9; i += 1) grid[i] = scene.craftGridItems[i] ?? null;
    return grid;
}

export function matchPlanningPatternInGrid(
  grid: Array<string | null>,
  gridSize: number,
  pattern: Array<string | null>,
  patternSize: number
): boolean {
    if (gridSize === patternSize) {
      for (let i = 0; i < grid.length; i += 1) {
        if ((grid[i] ?? null) !== (pattern[i] ?? null)) return false;
      }
      return true;
    }
    if (gridSize < patternSize) return false;
    const maxOff = gridSize - patternSize;
    for (let offRow = 0; offRow <= maxOff; offRow += 1) {
      for (let offCol = 0; offCol <= maxOff; offCol += 1) {
        let ok = true;
        for (let r = 0; r < gridSize && ok; r += 1) {
          for (let c = 0; c < gridSize; c += 1) {
            const gIdx = r * gridSize + c;
            const localR = r - offRow;
            const localC = c - offCol;
            const inPattern = localR >= 0 && localR < patternSize && localC >= 0 && localC < patternSize;
            const expected = inPattern ? pattern[localR * patternSize + localC] ?? null : null;
            if ((grid[gIdx] ?? null) !== expected) {
              ok = false;
              break;
            }
          }
        }
        if (ok) return true;
      }
    }
    return false;
}

export function getPlanningCraftReservedCounts(scene: PlanningCraftSceneLike): Record<string, number> {
    const counts: Record<string, number> = {};
    getPlanningCraftActiveIndices(scene).forEach((idx) => {
      const id = scene.craftGridItems[idx];
      if (!id) return;
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
}

export function getPlanningCraftResultRecipeId(scene: PlanningCraftSceneLike): string | null {
    const tableSize = getPlanningCraftGridSize(scene);
    const grid = getPlanningCraftGridState(scene, tableSize);
    if (!grid.some(Boolean)) return null;
    for (let i = 0; i < CRAFT_RECIPES.length; i += 1) {
      const recipe = CRAFT_RECIPES[i];
      const recipeSize = getPlanningRecipeGridSize(scene, recipe);
      if (recipeSize > tableSize) continue;
      const pattern = getPlanningRecipePattern(scene, recipe);
      if (matchPlanningPatternInGrid(grid, tableSize, pattern, recipeSize)) return recipe.id;
    }
    return null;
}

export function clearPlanningCraftGridSlot(scene: PlanningCraftSceneLike, index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= 9) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "clear_craft_item", { slotIndex: index }) === false) return;
    const active = new Set(getPlanningCraftActiveIndices(scene));
    if (!active.has(index)) return;
    if (!scene.craftGridItems[index]) return;
    scene.craftGridItems[index] = null;
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
}

export function clearPlanningCraftGrid(scene: PlanningCraftSceneLike): void {
    scene.craftGridItems = Array.from({ length: 9 }, () => null);
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
}

export function addItemToPlanningCraftGrid(scene: PlanningCraftSceneLike, itemId: string): boolean {
    if (!itemId) return false;
    const item = ITEM_BY_ID[itemId];
    if (!item || (item.kind !== "base" && item.kind !== "equipment")) return false;
    const active = getPlanningCraftActiveIndices(scene);
    const slotIndex = active.find((idx) => !scene.craftGridItems[idx]);
    if (slotIndex == null) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.gridFull", { size: `${getPlanningCraftGridSize(scene)}x${getPlanningCraftGridSize(scene)}` }));
      return false;
    }
    const totalOwned = getPlanningItemCount(scene as unknown as Parameters<typeof getPlanningItemCount>[0], itemId);
    const reserved = getPlanningCraftReservedCounts(scene)[itemId] ?? 0;
    if (reserved >= totalOwned) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.itemNotInBag", { icon: item.icon, name: item.name }));
      return false;
    }
    scene.craftGridItems[slotIndex] = itemId;
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
    return true;
}

export function populatePlanningCraftGridFromRecipe(scene: PlanningCraftSceneLike, recipeId: string): boolean {
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return false;
    if ((planningShouldShowCraftingInPlanning(scene as unknown as Parameters<typeof planningShouldShowCraftingInPlanning>[0]) ?? true) === false) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.blacksmithDisabled"));
      return false;
    }
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "populate_craft_recipe", { recipeId }) === false) return false;
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) return false;

    const tableSize = getPlanningCraftGridSize(scene);
    if (tableSize <= 0) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.tableNotUnlocked"));
      return false;
    }

    const recipeSize = getPlanningRecipeGridSize(scene, recipe);
    if (recipeSize > tableSize) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0],
        t("planning.craft.tableTooSmall", { tableSize: `${tableSize}x${tableSize}`, recipeSize: `${recipeSize}x${recipeSize}`, icon: recipe.icon ?? "✨", name: recipe.name ?? recipeId })
      );
      return false;
    }

    const pattern = getPlanningRecipePattern(scene, recipe);
    const availableCounts: Record<string, number> = {};
    scene.player?.itemBag?.forEach((itemId: string) => {
      availableCounts[itemId] = (availableCounts[itemId] ?? 0) + 1;
    });

    const nextGridItems: Array<string | null> = Array.from({ length: 9 }, () => null);
    for (let index = 0; index < pattern.length; index += 1) {
      const itemId = pattern[index];
      if (!itemId) continue;

      const item = ITEM_BY_ID[itemId];
      if (!item || (item.kind !== "base" && item.kind !== "equipment")) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.invalidIngredient", { icon: recipe.icon ?? "✨", name: recipe.name ?? recipeId, itemId }));
        return false;
      }

      if ((availableCounts[itemId] ?? 0) <= 0) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.missingIngredientForRecipe", { itemIcon: item.icon ?? "❔", itemName: item.name ?? itemId, recipeIcon: recipe.icon ?? "✨", recipeName: recipe.name ?? recipeId }));
        return false;
      }

      availableCounts[itemId] -= 1;
      const row = Math.floor(index / recipeSize);
      const col = index % recipeSize;
      const craftIndex = tableSize <= 1 ? 4 : row * 3 + col;
      nextGridItems[craftIndex] = itemId;
    }

    scene.craftGridItems = nextGridItems;
    scene.audioFx?.play?.("click");
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.ingredientsPlaced", { icon: recipe.icon ?? "✨", name: recipe.name ?? recipeId }));
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
    return true;
}

export function craftFromPlanningGrid(scene: PlanningCraftSceneLike): boolean {
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return false;
    if ((planningShouldShowCraftingInPlanning(scene as unknown as Parameters<typeof planningShouldShowCraftingInPlanning>[0]) ?? true) === false) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.blacksmithDisabled"));
      return false;
    }
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "craft_item", { targetType: "CRAFT_OUTPUT" }) === false) return false;
    const recipeId = getPlanningCraftResultRecipeId(scene);
    if (!recipeId) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.noRecipeMatch", { size: `${getPlanningCraftGridSize(scene)}x${getPlanningCraftGridSize(scene)}` }));
      return false;
    }
    const recipe = RECIPE_BY_ID[recipeId];
    if (!recipe) return false;
    const equipmentId = `eq_${recipe.id}`;
    const equipment = ITEM_BY_ID[equipmentId];
    if (!equipment) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.missingEquipmentData", { name: recipe.name }));
      return false;
    }

    const required = getPlanningRecipeRequiredList(scene, recipe);
    const bagCopy = [...(scene.player?.itemBag ?? [])];
    for (let i = 0; i < required.length; i += 1) {
      const idx = bagCopy.indexOf(required[i] as string);
      if (idx < 0) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.missingItems", { name: recipe.name }));
        return false;
      }
      bagCopy.splice(idx, 1);
    }

    bagCopy.push(equipmentId);
    scene.player.itemBag = bagCopy;
    scene.player.craftedItems?.push(recipe.id);
    clearPlanningCraftGrid(scene);
    scene.audioFx?.play?.("buy");
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.craft.craftedSuccess", { icon: recipe.icon, name: recipe.name }));
    planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: unknown) => noteEndlessCraft(
      profile as unknown as Parameters<typeof noteEndlessCraft>[0],
      1,
      getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
    )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "craft_item");
    scene.tutorialOverlay?.handleTrigger?.("craft_item");
    return true;
}
