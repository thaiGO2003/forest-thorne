import { PHASE } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { BoardSystem, type Board, type Bench } from "../../systems/BoardSystem.js";
import { ShopSystem, type ShopPlayer as SystemShopPlayer } from "../../systems/ShopSystem.js";
import { getDeployCapByLevel, getXpToLevelUp } from "../../core/gameUtils.js";
import {
  getSpeedUpgradeCost,
  isMaxSpeedLevel
} from "../../core/gameSpeed.js";
import { spendGoldWithCreative } from "../../core/creativeMode.js";
import { noteEndlessShopRefresh, noteEndlessUnitBought, noteEndlessXpPurchase } from "../../core/endlessAchievements.js";

import { getPlanningCreativeSandboxUnits, isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";
import { getPlanningBenchCap } from "./planningFormationRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { refreshPlanningUi } from "./planningRefreshUiRuntime.js";
import { createPlanningOwnedUnit, getPlanningEndlessAchievementSnapshot, persistPlanningProgress, planningUpdateEndlessAchievementProfile, syncPlanningEndlessAchievementSnapshot } from "./planningRunStateRuntime.js";
import { planningShouldShowShopInPlanning } from "./planningTechRuntime.js";
import { getPlanningTutorialShopOffers, isPlanningTutorialCampaignActive } from "./planningTutorialRuntime.js";
import { setPlanningUnitInfoSelectionFromShopOffer } from "./planningUnitInfoRuntime.js";

import { canAffordWithCreative } from "../../core/creativeMode.js";
import { noteEndlessMerge } from "../../core/endlessAchievements.js";
import { MAX_SPEED_LEVEL, getSpeedDisplayLabel } from "../../core/gameSpeed.js";
import { ITEM_BY_ID } from "../../data/items.js";
import { UpgradeSystem } from "../../systems/UpgradeSystem.js";
import { guardPlanningTutorialAction, recordPlanningTutorialEvent } from "./planningTutorialRuntime.js";

type ShopPlayerLocal = SystemShopPlayer & {
  xp: number;
  xpCostDelta: number;
  speedLevel: number;
  deployCapBonus: number;
  itemBag: string[];
  board: Board;
};

type PlanningShopScene = Phaser.Scene & {
  settingsVisible: boolean;
  phase: string;
  aiMode: string;
  player: ShopPlayerLocal;
  buttons: { speed?: { setLabel: (label: string) => void } };
  audioFx: { play: (key: string) => void; enabled?: boolean };
  tutorialOverlay?: { handleTrigger: (event: string) => void } | null;
  createOwnedUnit: (...args: unknown[]) => unknown;
};

export function rollPlanningShop(scene: PlanningShopScene): void {
    if (scene.settingsVisible) return;
    if (scene.phase !== PHASE.PLANNING) return;
    if (!planningShouldShowShopInPlanning(scene as unknown as Parameters<typeof planningShouldShowShopInPlanning>[0])) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.shopDisabled"));
      return;
    }
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "roll_shop", { buttonKey: "roll" }) === false) return;
    const cost = ShopSystem.calculateRefreshCost(scene.player.level, scene.player.rollCostDelta ?? 0);
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.rollNoGold"));
      return;
    }
    if (isPlanningTutorialCampaignActive(scene as unknown as Parameters<typeof isPlanningTutorialCampaignActive>[0])) {
      spendGoldWithCreative(scene.player, scene.aiMode, cost);
      refreshPlanningShop(scene, true);
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "roll_shop");
      scene.tutorialOverlay?.handleTrigger("roll_shop");
      return;
    }
    if (isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) {
      refreshPlanningShop(scene, true);
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "roll_shop");
      scene.tutorialOverlay?.handleTrigger("roll_shop");
      return;
    }

    // Use ShopSystem to refresh shop
    const result = ShopSystem.refreshShop(scene.player, cost);

    if (result.success) {
      scene.player = result.player as ShopPlayerLocal;
      planningUpdateEndlessAchievementProfile(scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0], ((profile: Parameters<typeof planningUpdateEndlessAchievementProfile>[1] extends (p: infer P) => unknown ? P : never) => noteEndlessShopRefresh(
        profile as unknown as Parameters<typeof noteEndlessShopRefresh>[0],
        1,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "roll_shop");
      scene.tutorialOverlay?.handleTrigger("roll_shop");
    } else {
      // Display error message for insufficient gold or other errors
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], result.error || t("planning.shop.cannotRoll"));
    }
}

export function refreshPlanningShop(scene: PlanningShopScene, forceRoll: boolean = false): void {
    if (!planningShouldShowShopInPlanning(scene as unknown as Parameters<typeof planningShouldShowShopInPlanning>[0])) {
      scene.player.shop = [];
      return;
    }
    // Only generate new offers if shop is not locked (or forceRoll is true)
    if (scene.player.shopLocked && !forceRoll) return;

    const tutorialOffers = getPlanningTutorialShopOffers(scene as unknown as Parameters<typeof getPlanningTutorialShopOffers>[0], forceRoll);
    if (tutorialOffers) {
      scene.player.shop = tutorialOffers as SystemShopPlayer["shop"];
      return;
    }

    // Use ShopSystem to generate shop offers (no cost, just generation)
    const offers = ShopSystem.generateShopOffers(scene.player.level);
    scene.player.shop = offers as unknown as SystemShopPlayer["shop"];
}

export function buyPlanningFromShop(scene: PlanningShopScene, index: number): void {
    if (scene.settingsVisible) return;
    if (scene.phase !== PHASE.PLANNING) return;
    setPlanningUnitInfoSelectionFromShopOffer(scene as unknown as Parameters<typeof setPlanningUnitInfoSelectionFromShopOffer>[0], index);
    if (!planningShouldShowShopInPlanning(scene as unknown as Parameters<typeof planningShouldShowShopInPlanning>[0])) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("fortress.shopDisabled"));
      return;
    }
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "buy_unit", { index }) === false) return;
    if (isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) {
      const offer = scene.player.shop?.[index];
      const baseRaw = offer ? UNIT_BY_ID[offer.baseId] : null;
      const base = baseRaw as { id: string; name: string; tier: number } | undefined;
      if (!base) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.cannotBuy"));
        return;
      }
      if (scene.player.bench.length >= getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0])) {
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.benchFull"));
        return;
      }
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.boughtUnitCreative", { name: base.name, tier: base.tier }));
      scene.player.bench.push(createPlanningOwnedUnit(scene as unknown as Parameters<typeof createPlanningOwnedUnit>[0], base.id, 1) as SystemShopPlayer["bench"][number]);
      scene.player.shop[index] = null;
      tryPlanningAutoMerge(scene);
      planningUpdateEndlessAchievementProfile((scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0]), ((profile: Parameters<typeof planningUpdateEndlessAchievementProfile>[1] extends (p: infer P) => unknown ? P : never) => noteEndlessUnitBought(
        profile as unknown as Parameters<typeof noteEndlessUnitBought>[0],
        1,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "buy_unit");
      scene.tutorialOverlay?.handleTrigger("buy_unit");
      return;
    }

    // Use ShopSystem to buy unit
    const result = ShopSystem.buyUnit(
      scene.player,
      index,
      scene.createOwnedUnit.bind(scene) as unknown as Parameters<typeof ShopSystem.buyUnit>[2],
      getPlanningBenchCap(scene as unknown as Parameters<typeof getPlanningBenchCap>[0])
    );

    if (result.success) {
      scene.player = result.player as ShopPlayerLocal;
      tryPlanningAutoMerge(scene);
      planningUpdateEndlessAchievementProfile((scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0]), ((profile: Parameters<typeof planningUpdateEndlessAchievementProfile>[1] extends (p: infer P) => unknown ? P : never) => noteEndlessUnitBought(
        profile as unknown as Parameters<typeof noteEndlessUnitBought>[0],
        1,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
      recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "buy_unit");
      scene.tutorialOverlay?.handleTrigger("buy_unit");
    } else {
      // Display error message for insufficient gold, full bench, or other errors
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], result.error || t("planning.shop.cannotBuy"));
    }
}

export function buyPlanningXp(scene: PlanningShopScene): void {
    if (scene.settingsVisible) return;
    if (scene.phase !== PHASE.PLANNING) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "buy_xp", { buttonKey: "xp" }) === false) return;
    const cost = Math.max(1, 4 + (scene.player.xpCostDelta || 0));
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.buyXpNoGold"));
      return;
    }
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    gainPlanningXp(scene, 4);
    planningUpdateEndlessAchievementProfile((scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0]), ((profile: Parameters<typeof planningUpdateEndlessAchievementProfile>[1] extends (p: infer P) => unknown ? P : never) => noteEndlessXpPurchase(
      profile as unknown as Parameters<typeof noteEndlessXpPurchase>[0],
      1,
      getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
    )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    recordPlanningTutorialEvent(scene as unknown as Parameters<typeof recordPlanningTutorialEvent>[0], "buy_xp");
}

export function gainPlanningXp(scene: PlanningShopScene, value: number): void {
    const initialLevel = scene.player.level;
    let amount = value;
    while (amount > 0 && scene.player.level < 25) {
      const need = getXpToLevelUp(scene.player.level) - scene.player.xp;
      if (amount >= need) {
        amount -= need;
        scene.player.level += 1;
        scene.player.xp = 0;
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.levelUp", { level: scene.player.level }));
      } else {
        scene.player.xp += amount;
        amount = 0;
      }
    }
    if (scene.player.level !== initialLevel) {
      syncPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof syncPlanningEndlessAchievementSnapshot>[0]);
    }
}

export function togglePlanningLock(scene: PlanningShopScene): void {
    if (scene.settingsVisible) return;
    if (scene.phase !== PHASE.PLANNING) return;
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "toggle_lock", { buttonKey: "lock" }) === false) return;

    // Use ShopSystem to lock/unlock shop
    const result = scene.player.shopLocked
      ? ShopSystem.unlockShop(scene.player)
      : ShopSystem.lockShop(scene.player);

    if (result.success) {
      scene.player = result.player as ShopPlayerLocal;
      refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    } else {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], result.error || t("planning.shop.cannotToggleLock"));
    }
}

export function tryPlanningAutoMerge(scene: PlanningShopScene): void {
    // Use UpgradeSystem for auto-merge logic
    const result = UpgradeSystem.tryAutoMerge(
      scene.player.board,
      scene.player.bench as unknown as Bench,
      ITEM_BY_ID,
      UNIT_BY_ID,
      scene.createOwnedUnit.bind(scene) as unknown as Parameters<typeof UpgradeSystem.tryAutoMerge>[4],
    );

    // Handle merge results
    if (result.mergeCount > 0) {
      // Process each merge log entry
      result.log.forEach((entry) => {
        // Get unit label for logging
        const unit = UNIT_BY_ID[entry.baseId] as { name?: string } | undefined;
        const label = unit?.name || entry.baseId;

        // Log the merge
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.starUp", { label, star: entry.toStar }));

        // Handle overflow equipment by returning to item bag
        if (entry.overflowItems && entry.overflowItems.length > 0) {
          scene.player.itemBag.push(...entry.overflowItems);
          addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.overflowEquipReturned", { count: entry.overflowItems.length }));
        }
      });
      planningUpdateEndlessAchievementProfile((scene as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[0]), ((profile: Parameters<typeof planningUpdateEndlessAchievementProfile>[1] extends (p: infer P) => unknown ? P : never) => noteEndlessMerge(
        profile as unknown as Parameters<typeof noteEndlessMerge>[0],
        result.mergeCount,
        getPlanningEndlessAchievementSnapshot(scene as unknown as Parameters<typeof getPlanningEndlessAchievementSnapshot>[0])
      )) as unknown as Parameters<typeof planningUpdateEndlessAchievementProfile>[1]);
    }
}

export function buyPlanningSpeed(scene: PlanningShopScene): void {
    if (scene.settingsVisible || scene.phase !== PHASE.PLANNING) return;
    const level = scene.player.speedLevel ?? 0;
    if (isMaxSpeedLevel(level)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.speedMaxLevel", { label: getSpeedDisplayLabel(MAX_SPEED_LEVEL) }));
      return;
    }
    const cost = getSpeedUpgradeCost(level);
    if (!canAffordWithCreative(scene.aiMode, scene.player.gold, cost)) {
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.speedNoGold", { cost }));
      return;
    }
    spendGoldWithCreative(scene.player, scene.aiMode, cost);
    scene.player.speedLevel = level + 1;
    const speedLabel = getSpeedDisplayLabel(scene.player.speedLevel);
    addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.shop.speedUpgraded", { label: speedLabel }));
    scene.audioFx.play("buy");
    refreshPlanningSpeedButton(scene);
    refreshPlanningUi(scene as unknown as Parameters<typeof refreshPlanningUi>[0]);
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
}

export function refreshPlanningSpeedButton(scene: PlanningShopScene): void {
    if (!scene.buttons.speed) return;
    const level = scene.player?.speedLevel ?? 0;
    if (isMaxSpeedLevel(level)) {
      scene.buttons.speed.setLabel(t("planning.shop.speedMaxBtn"));
      return;
    }
    const cost = getSpeedUpgradeCost(level);
    const label = getSpeedDisplayLabel(level);
    scene.buttons.speed.setLabel(t("planning.shop.speedBtnWithCost", { label, cost }));
}

export function getPlanningDeployCap(scene: PlanningShopScene): number {
    const level = Number.isFinite(scene.player?.level) ? Math.floor(scene.player.level) : 1;
    const bonus = Number.isFinite(scene.player?.deployCapBonus) ? Math.floor(scene.player.deployCapBonus) : 0;
    return getDeployCapByLevel(level) + bonus;
}

export function getPlanningDeployCount(scene: PlanningShopScene): number {
    return BoardSystem.getDeployCount(scene.player.board);
}

export function getPlanningActiveLeftUnitCount(scene: PlanningShopScene): number {
    return getPlanningDeployCount(scene) + getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT").length;
}
