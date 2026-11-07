import Phaser from "phaser";
import { PHASE } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import { TECH_BY_ID, getTechCost, canResearch, type TechLevels } from "../../data/techTree.js";
import {
  getFortressNodeI18nKey,
  getFortressPendingNode,
  isFortressBlacksmithNode,
  isFortressShopNode
} from "../../core/fortressMode.js";

import { createPlanningBenchSlots } from "./planningBenchRuntime.js";
import { isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";
import { isPlanningEndlessFortressMode } from "./planningFortressHelpersRuntime.js";
import { computePlanningLayout } from "./planningLayoutRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { persistPlanningProgress } from "./planningRunStateRuntime.js";
import { ensurePlanningTechTreeModalLoaded } from "./planningSettingsRuntime.js";
import { refreshPlanningSpeedButton } from "./planningShopActionsRuntime.js";
import { createPlanningStorageSpace } from "./planningStorageUiRuntime.js";
import { canAffordWithCreative, spendGoldWithCreative } from "../../core/creativeMode.js";
import { MAX_SPEED_LEVEL } from "../../core/gameSpeed.js";
import type { EnabledSystems } from "../../gameModes/GameModeConfig.js";

interface GameModeConfigLite {
  enabledSystems?: Partial<EnabledSystems> | null;
  [key: string]: unknown;
}
interface FortressServiceResult {
  consumed?: boolean;
  messageKey?: string;
  messageArgs?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PlanningFortressPendingNode {
  type: string;
  payload?: {
    serviceResult?: FortressServiceResult;
    enemyBudgetMult?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}


interface TechPlayer {
  techLevels: TechLevels;
  gold: number;
  teamHpPct?: number;
  teamAtkPct?: number;
  teamMatkPct?: number;
  teamMdefPct?: number;
  teamDefPct?: number;
  teamCritPct?: number;
  deployCapBonus?: number;
  benchBonus?: number;
  benchUpgradeLevel?: number;
  inventoryUpgradeLevel?: number;
  inventoryBonus?: number;
  craftTableLevel?: number;
  speedLevel?: number;
  interestCapBonus?: number;
  interestRateBonus?: number;
  xpCostDelta?: number;
  rollCostDelta?: number;
  startingRage?: number;
  startingShield?: number;
  lifestealPct?: number;
  rageGainPct?: number;
  unequipDiscount?: number;
  fixedIncome?: number;
  winGoldBonus?: number;
  fortressMeta?: { pendingNodePayload?: { serviceResult?: { consumed?: boolean; messageKey?: string; messageArgs?: Record<string, unknown>; [key: string]: unknown } } };
  gameMode?: string;
  [key: string]: unknown;
}

interface TechTreeModalLike {
  show(): void;
  refreshFromPlayer?(player: TechPlayer): void;
}

interface TechSceneLike extends Phaser.Scene {
  settingsVisible?: boolean;
  phase: string;
  player: TechPlayer;
  aiMode: string;
  benchUpgradeLevel?: number;
  layout?: unknown;
  audioFx: { play: (key: string) => void };
  techTreeModal?: TechTreeModalLike;
  gameModeConfig?: GameModeConfigLite | null;
  [key: string]: unknown;
}

export function openPlanningTechTree(scene: TechSceneLike): void {
    if (!planningShouldShowTechTreeInPlanning(scene)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.techDisabled"));
      return;
    }
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
    const modalPromise = ensurePlanningTechTreeModalLoaded(scene as unknown as Parameters<typeof ensurePlanningTechTreeModalLoaded>[0]) as unknown as Promise<TechTreeModalLike>;
    void modalPromise.then((modal) => { modal.show(); });
}

export function researchPlanningTech(scene: TechSceneLike, techId: string): void {
    if (scene.phase !== PHASE.PLANNING) return;
    const techLevels = scene.player.techLevels;
    if (!canResearch(techId, techLevels, isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]) ? Number.MAX_SAFE_INTEGER : scene.player.gold)) return;

    const node = TECH_BY_ID[techId];
    if (!node) return;

    const currentLevel = techLevels[techId] ?? 0;
    const cost = getTechCost(techId, currentLevel);
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    techLevels[techId] = currentLevel + 1;
    const newLevel = techLevels[techId];

    // Áp dụng hiệu ứng theo type
    for (const eff of node.effects) {
      switch (eff.type) {
        case "team_hp_pct":
          scene.player.teamHpPct = (scene.player.teamHpPct || 0) + eff.value;
          break;
        case "team_atk_pct":
          scene.player.teamAtkPct = (scene.player.teamAtkPct || 0) + eff.value;
          break;
        case "team_matk_pct":
          // arcane: lần 1 chỉ MATK, lần 2 thêm MDEF
          if (techId === "arcane") {
            if (newLevel === 1) {
              scene.player.teamMatkPct = (scene.player.teamMatkPct || 0) + 0.08;
            } else if (newLevel === 2) {
              scene.player.teamMdefPct = (scene.player.teamMdefPct || 0) + 0.08;
            }
            continue; // Bỏ qua xử lý mặc định
          }
          scene.player.teamMatkPct = (scene.player.teamMatkPct || 0) + eff.value;
          break;
        case "team_def_pct":
          scene.player.teamDefPct = (scene.player.teamDefPct || 0) + eff.value;
          break;
        case "team_mdef_pct":
          scene.player.teamMdefPct = (scene.player.teamMdefPct || 0) + eff.value;
          break;
        case "team_crit_pct":
          scene.player.teamCritPct = (scene.player.teamCritPct || 0) + eff.value;
          break;
        case "deploy_cap_bonus":
          scene.player.deployCapBonus = (scene.player.deployCapBonus || 0) + eff.value;
          break;
        case "bench_bonus":
          scene.player.benchBonus = (scene.player.benchBonus || 0) + eff.value;
          break;
        case "bench_upgrade":
          // Giống upgradeBench() hiện tại
          scene.benchUpgradeLevel = 1;
          scene.player.benchUpgradeLevel = 1;
          scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
          createPlanningBenchSlots(scene as unknown as Parameters<typeof createPlanningBenchSlots>[0]);
          break;
        case "inventory_upgrade":
          // Giống upgradeInventory() hiện tại
          scene.player.inventoryUpgradeLevel = 1;
          scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
          createPlanningStorageSpace(scene as unknown as Parameters<typeof createPlanningStorageSpace>[0]);
          break;
        case "inventory_bonus":
          scene.player.inventoryBonus = (scene.player.inventoryBonus || 0) + eff.value;
          scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
          createPlanningStorageSpace(scene as unknown as Parameters<typeof createPlanningStorageSpace>[0]);
          break;
        case "craft_table_upgrade":
          // Giống upgradeCraftTable() hiện tại
          scene.player.craftTableLevel = Math.min(3, (scene.player.craftTableLevel || 0) + 1);
          break;
        case "speed_upgrade":
          // Giống buySpeed() hiện tại
          scene.player.speedLevel = Math.min(MAX_SPEED_LEVEL, (scene.player.speedLevel || 0) + 1);
          break;
        case "interest_cap":
          scene.player.interestCapBonus = (scene.player.interestCapBonus || 0) + eff.value;
          break;
        case "interest_rate_bonus":
          scene.player.interestRateBonus = (scene.player.interestRateBonus || 0) + eff.value;
          break;
        case "xp_cost_delta":
          scene.player.xpCostDelta = (scene.player.xpCostDelta || 0) + eff.value;
          break;
        case "roll_cost_delta":
          scene.player.rollCostDelta = (scene.player.rollCostDelta || 0) + eff.value;
          break;
        case "starting_rage":
          scene.player.startingRage = (scene.player.startingRage || 0) + eff.value;
          break;
        case "starting_shield":
          scene.player.startingShield = (scene.player.startingShield || 0) + eff.value;
          break;
        case "lifesteal_pct":
          scene.player.lifestealPct = (scene.player.lifestealPct || 0) + eff.value;
          break;
        case "rage_gain_pct":
          scene.player.rageGainPct = (scene.player.rageGainPct || 0) + eff.value;
          break;
        case "unequip_discount":
          scene.player.unequipDiscount = (scene.player.unequipDiscount || 0) + eff.value;
          break;
        case "fixed_income":
          scene.player.fixedIncome = (scene.player.fixedIncome || 0) + eff.value;
          break;
        case "win_gold_bonus":
          scene.player.winGoldBonus = (scene.player.winGoldBonus || 0) + eff.value;
          break;
      }
    }

    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.researched", { icon: node.icon, name: node.name, level: newLevel, cost }));
    scene.audioFx.play("buy");
    scene.techTreeModal?.refreshFromPlayer?.(scene.player);
    refreshPlanningSpeedButton(scene as unknown as Parameters<typeof refreshPlanningSpeedButton>[0]);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function upgradePlanningInventory(scene: TechSceneLike): void {
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
    if ((scene.player?.inventoryUpgradeLevel ?? 0) > 0) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.inventoryMax"));
      return;
    }
    const cost = 5;
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.inventoryNoGold"));
      return;
    }
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    scene.player.inventoryUpgradeLevel = 1;
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.inventoryUpgraded"));
    scene.audioFx.play("buy");

    // Refresh layout and UI
    scene.layout = computePlanningLayout(scene as unknown as Parameters<typeof computePlanningLayout>[0]);
    createPlanningStorageSpace(scene as unknown as Parameters<typeof createPlanningStorageSpace>[0]); // recreate storage UI
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function upgradePlanningCraftTable(scene: TechSceneLike): void {
    if ((planningShouldShowCraftingInPlanning(scene) ?? true) === false) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.blacksmithDisabled"));
      return;
    }
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
    const level = scene.player?.craftTableLevel ?? 0;
    if (level >= 3) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.craftTableMax"));
      return;
    }
    const costs = [5, 10, 15];
    const cost = costs[level] ?? 15;
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.craftTableNoGold"));
      return;
    }
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    scene.player.craftTableLevel = level + 1;
    const sizeLabels = ["1x1", "2x2", "3x3"];
    const sizeLabel = sizeLabels[level] ?? "3x3";
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tech.craftTableUpgraded", { size: sizeLabel }));
    scene.audioFx.play("buy");
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function planningShouldShowTechTreeInPlanning(scene: TechSceneLike): boolean {
    return !isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0]);
}

export function planningShouldShowShopInPlanning(scene: TechSceneLike): boolean {
    if (isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0])) return isFortressShopNode(scene.player);
    return scene.gameModeConfig?.enabledSystems?.shop !== false;
}

export function planningShouldShowCraftingInPlanning(scene: TechSceneLike): boolean {
    if (isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0])) return isFortressBlacksmithNode(scene.player);
    return scene.gameModeConfig?.enabledSystems?.crafting !== false;
}

export function getPlanningFortressPendingNode(scene: TechSceneLike): PlanningFortressPendingNode | null {
    if (!isPlanningEndlessFortressMode(scene as unknown as Parameters<typeof isPlanningEndlessFortressMode>[0])) {
      return null;
    }
    return getFortressPendingNode(scene.player) as unknown as PlanningFortressPendingNode | null;
}

export function getPlanningFortressPendingNodeLabel(scene: TechSceneLike): string | null {
    const pending = getPlanningFortressPendingNode(scene);
    if (!pending?.type) return null;
    return t(getFortressNodeI18nKey(pending.type));
}

export function planningAnnounceFortressServiceResult(scene: TechSceneLike): void {
    const pending = getPlanningFortressPendingNode(scene);
    const result = pending?.payload?.serviceResult;
    if (!result || result.consumed === true) return;
    if (typeof result.messageKey === "string" && result.messageKey.trim()) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t(result.messageKey, result.messageArgs ?? {}), "EVENT");
    }
    if (scene.player?.fortressMeta?.pendingNodePayload) {
      scene.player.fortressMeta.pendingNodePayload = {
        ...scene.player.fortressMeta.pendingNodePayload,
        serviceResult: {
          ...result,
          consumed: true
        }
      };
    }
}
