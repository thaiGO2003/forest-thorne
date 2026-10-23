import type Phaser from "phaser";
import { PHASE, PLAYER_COLS } from "../../core/boardConstants.js";
import { t } from "../../i18n/index.js";
import { AI_SETTINGS } from "../../systems/AISystem.js";
import { ShopSystem } from "../../systems/ShopSystem.js";

import { getXpToLevelUp } from "../../core/gameUtils.js";
import { getLoseConditionLabel } from "../../core/gameRules.js";
import { resolveRoundEnvironment } from "../../data/battlefieldEnvironments.js";
import { getPlanningCoopSlotsMissingDeployment } from "./planningCoopSessionRuntime.js";
import {
  getPlanningTechTreeButtonLabel,
  getPlanningRollButtonLabel,
  getPlanningXpButtonLabel,
  getPlanningLockButtonLabel,
  getPlanningStartButtonLabel
} from "./planningActionButtonsRuntime.js";
import {
  getHistoryButtonLabel,
  getPlanningCortisolButtonLabel,
  getResetRunButtonLabel,
  getUtilityLibraryButtonLabel,
  getUtilitySettingsButtonLabel
} from "../../ui/buttonEmojiLabels.js";
import { UI_FONT } from "../../core/uiTheme.js";
import { buildPlanningTeamStatusModel } from "./planningAttackPreviewRuntime.js";
import { refreshPlanningBenchUi } from "./planningBenchRuntime.js";
import { refreshPlanningRoundBackground } from "./planningBoardChromeRuntime.js";
import { refreshPlanningBoardUi } from "./planningBoardUiRuntime.js";
import { getPlanningBoardRowCount, getPlanningBoardUnit, getPlanningCoopTotalDeployCap, getPlanningCoopTotalDeployCount, hasPlanningPingedCoopHostForCurrentRound, isPlanningCoopHost, isPlanningCoopMode } from "./planningCoopSessionRuntime.js";
import { getPlanningCreativeSandboxUnits, getPlanningDisplayedGold, hasPlanningManualEnemySandboxUnits, isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";
import { planningComputeSynergyCounts } from "./planningDescriptionRuntime.js";
import { getPlanningUnitSalePrice } from "./planningFormationRuntime.js";
import { getPlanningConfiguredStartingHp, getPlanningLoseCondition } from "./planningFortressHelpersRuntime.js";
import { refreshPlanningStorageUi } from "./planningInventoryRuntime.js";
import { planningUpdateLogText } from "./planningLogRuntime.js";
import { isPlanningPvpRoomMode } from "./planningPvpSessionRuntime.js";
import { refreshPlanningRightPanelScrollMetrics } from "./planningRightPanelRuntime.js";
import { getPlanningActiveLeftUnitCount, getPlanningDeployCap } from "./planningShopActionsRuntime.js";
import { refreshPlanningShopUi } from "./planningShopRuntime.js";
import { refreshPlanningUnitInfoPanel } from "./planningUnitInfoRuntime.js";

import { clamp } from "../../core/gameUtils.js";
import { getClassLabelVi, getTribeLabelVi } from "../../data/unitVisuals.js";
import { getPlanningFortressPendingNodeLabel } from "./planningTechRuntime.js";
import { guardPlanningTutorialAction } from "./planningTutorialRuntime.js";

type PlanningPlayer = {
  level: number;
  xp: number;
  gold: number;
  hp: number;
  round: number;
  gameMode: string;
  shopLocked?: boolean;
  xpCostDelta?: number;
  rollCostDelta?: number;
  augments: unknown[];
  board?: unknown[][];
  bench?: unknown[];
  [key: string]: unknown;
};

type PlanningButtonLike = { setLabel?: (label: string) => void; setEnabled?: (enabled: boolean) => void; [key: string]: unknown };

type TeamStatusSideColors = { high: number; mid: number; low: number; power: number };

interface PlanningRefreshSceneLike extends Phaser.Scene {
  player: PlanningPlayer;
  aiMode: string;
  phase: string;
  buttons: Record<string, PlanningButtonLike>;
  headerStatChips: Record<string, unknown>;
  headerMetaText: { setText: (text: string) => void };
  relayoutTopHeaderMeta: (() => void) | null;
  synergyText: { setText: (text: string) => void };
  logHistory: unknown[];
  selectedBenchIndex: number | null;
  inventoryPage: number;
  invPageMax: number;
  recipeSuggestionPage: number;
  recipeSuggestionPageMax: number;
  [key: string]: unknown;
}

function countBoardUnits(board: unknown) {
  if (!Array.isArray(board)) return 0;
  return board.reduce((sum, row) => sum + (row as unknown[]).filter(Boolean).length, 0);
}

export function refreshPlanningUi(scene: PlanningRefreshSceneLike) {
    (refreshPlanningRoundBackground as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
    refreshPlanningHeader(scene);
    refreshPlanningButtons(scene);
    (refreshPlanningShopUi as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
    (refreshPlanningBenchUi as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
    (refreshPlanningBoardUi as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
    refreshPlanningSynergyPreview(scene);
    (refreshPlanningStorageUi as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
    (refreshPlanningUnitInfoPanel as unknown as (scene: PlanningRefreshSceneLike) => void)(scene);
}

export function refreshPlanningHeader(scene: PlanningRefreshSceneLike) {
    const xpNeed = getXpToLevelUp(scene.player.level);
    const xpText = xpNeed === Number.POSITIVE_INFINITY ? t("planning.ui.max") : `${scene.player.xp}/${xpNeed}`;
    const activeLeftCount = isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) ? getPlanningCoopTotalDeployCount(scene as unknown as Parameters<typeof getPlanningCoopTotalDeployCount>[0]) : getPlanningActiveLeftUnitCount(scene as unknown as Parameters<typeof getPlanningActiveLeftUnitCount>[0]);
    const deployCap = isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]) ? getPlanningCoopTotalDeployCap(scene as unknown as Parameters<typeof getPlanningCoopTotalDeployCap>[0]) : getPlanningDeployCap(scene as unknown as Parameters<typeof getPlanningDeployCap>[0]);
    const deployText = `${activeLeftCount}/${deployCap}`;
    const modeLabel = scene.player.gameMode === "PVE_SANDBOX" ? t("planning.ui.sandbox") : t("planning.ui.endless");
    const loseCondition = getPlanningLoseCondition(scene as unknown as Parameters<typeof getPlanningLoseCondition>[0]);
    const showHpStat = loseCondition === "NO_HEARTS";
    const maxHp = showHpStat ? getPlanningConfiguredStartingHp(scene as unknown as Parameters<typeof getPlanningConfiguredStartingHp>[0], scene.player.hp) : null;
    const loseLabel = showHpStat
      ? `${getLoseConditionLabel(loseCondition)} (${scene.player.hp} ${t("planning.hud.hpCount")})`
      : getLoseConditionLabel(loseCondition);
    const enemySourceLabel = hasPlanningManualEnemySandboxUnits(scene as unknown as Parameters<typeof hasPlanningManualEnemySandboxUnits>[0]) ? ` • ${t("creative.enemySandboxLabel")}` : "";
    const fortressNodeLabel = getPlanningFortressPendingNodeLabel(scene as unknown as Parameters<typeof getPlanningFortressPendingNodeLabel>[0]) ?? "";
    const fortressNodeSuffix = fortressNodeLabel ? ` • ${fortressNodeLabel}` : "";
    const environment = resolveRoundEnvironment(scene.player?.round ?? 1);
    const environmentSuffix = environment ? ` • ${t("planning.hud.environment", { label: environment.shortLabelVi })}` : "";
    setPlanningHeaderStatValue(scene, "round", `${scene.player.round}`);
    setPlanningHeaderStatVisible(scene, "hp", showHpStat);
    if (showHpStat) {
      setPlanningHeaderStatValue(scene, "hp", `${scene.player.hp}`, maxHp, scene.player.hp);
    }
    const isCreative = isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0]);
    setPlanningHeaderStatValue(scene, "gold", getPlanningDisplayedGold(scene as unknown as Parameters<typeof getPlanningDisplayedGold>[0]), isCreative ? null : 50, isCreative ? null : scene.player.gold);
    setPlanningHeaderStatValue(scene, "level", `${scene.player.level}`, 12, scene.player.level);
    setPlanningHeaderStatValue(scene, "xp", xpText, xpNeed === Number.POSITIVE_INFINITY ? null : xpNeed, scene.player.xp);
    setPlanningHeaderStatValue(scene, "deploy", deployText, deployCap, activeLeftCount);
    const aiLabel = (AI_SETTINGS as unknown as Record<string, { label: string }>)[scene.aiMode]?.label ?? "";
    scene.headerMetaText?.setText(`Pha ${getPlanningPhaseLabel(scene, scene.phase)} • AI ${aiLabel} • ${modeLabel} • ${loseLabel}${fortressNodeSuffix}${enemySourceLabel}${environmentSuffix}`);
    scene.relayoutTopHeaderMeta?.();
    refreshPlanningTeamStatusStrip(scene);
    planningUpdateLogText(scene as unknown as Parameters<typeof planningUpdateLogText>[0]);
}

export function refreshPlanningButtons(scene: PlanningRefreshSceneLike) {
    const planning = scene.phase === PHASE.PLANNING;
    const rollCost = ShopSystem.calculateRefreshCost(scene.player.level, scene.player.rollCostDelta ?? 0);
    const localCoopDeployCount = countBoardUnits(scene.player?.board);
    const missingCoopDeploySlots = isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])
      ? getPlanningCoopSlotsMissingDeployment(scene as unknown as Parameters<typeof getPlanningCoopSlotsMissingDeployment>[0])
      : [];
    const canStartCombat = isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0])
      ? getPlanningActiveLeftUnitCount(scene as unknown as Parameters<typeof getPlanningActiveLeftUnitCount>[0]) > 0
      : isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0])
      ? (isPlanningCoopHost(scene as unknown as Parameters<typeof isPlanningCoopHost>[0]) ? missingCoopDeploySlots.length === 0 : localCoopDeployCount > 0)
      : getPlanningActiveLeftUnitCount(scene as unknown as Parameters<typeof getPlanningActiveLeftUnitCount>[0]) > 0;

    scene.buttons.techTree?.setLabel?.(getPlanningTechTreeButtonLabel());
    scene.buttons.roll?.setLabel?.(getPlanningRollButtonLabel(rollCost));
    const xpCost = Math.max(1, 4 + (scene.player.xpCostDelta || 0));
    scene.buttons.xp?.setLabel?.(getPlanningXpButtonLabel(xpCost));
    scene.buttons.lock?.setLabel?.(getPlanningLockButtonLabel(scene.player.shopLocked === true));
    const selectedUnit = scene.selectedBenchIndex != null ? scene.player?.bench?.[scene.selectedBenchIndex] : null;
    if (selectedUnit) {
      const sellPrice = getPlanningUnitSalePrice(scene as unknown as Parameters<typeof getPlanningUnitSalePrice>[0], selectedUnit as Parameters<typeof getPlanningUnitSalePrice>[1]);
      scene.buttons.sell.setLabel?.(t("planning.ui.sellUnitWithPrice", { price: sellPrice }));
    } else {
      scene.buttons.sell.setLabel?.(t("planning.ui.sellUnit"));
    }
    scene.buttons.start.setLabel?.(
      getPlanningStartButtonLabel({
        isPvpRoomMode: isPlanningPvpRoomMode(scene as unknown as Parameters<typeof isPlanningPvpRoomMode>[0]),
        pvpReady: scene._pvpCombatReady === true,
        isCoopMode: isPlanningCoopMode(scene as unknown as Parameters<typeof isPlanningCoopMode>[0]),
        isCoopHost: isPlanningCoopHost(scene as unknown as Parameters<typeof isPlanningCoopHost>[0]),
        coopPinged: hasPlanningPingedCoopHostForCurrentRound(scene as unknown as Parameters<typeof hasPlanningPingedCoopHostForCurrentRound>[0])
      })
    );
    scene.buttons.reset?.setLabel?.(getResetRunButtonLabel());
    scene.buttons.cortisol?.setLabel?.(getPlanningCortisolButtonLabel());
    scene.buttons.wiki?.setLabel?.(getUtilityLibraryButtonLabel());
    scene.buttons.settings.setLabel?.(getUtilitySettingsButtonLabel());
    scene.buttons.history?.setLabel?.(getHistoryButtonLabel(scene.logHistory.length));

    scene.buttons.roll?.setEnabled?.(planning);
    scene.buttons.xp?.setEnabled?.(planning);
    scene.buttons.lock?.setEnabled?.(planning);
    scene.buttons.sell.setEnabled?.(planning && scene.selectedBenchIndex != null && !!scene.player?.bench?.[scene.selectedBenchIndex]);
    scene.buttons.unequip?.setEnabled?.(false);
    scene.buttons.techTree?.setEnabled?.(planning);
    scene.buttons.start.setEnabled?.(planning && canStartCombat);
    scene.buttons.reset.setEnabled?.(true);
    scene.buttons.cortisol?.setEnabled?.(planning);
    scene.buttons.settings.setEnabled?.(true);
    scene.buttons.history?.setEnabled?.(true);
    // Craft buttons removed to fix undefined error
}

export function refreshPlanningTeamStatusStrip(scene: PlanningRefreshSceneLike) {
    const hud = scene.planningTeamStatusHud as unknown as {
      left: TeamStatusSideHudLike;
      right: TeamStatusSideHudLike;
      elements?: unknown[];
    } | null;
    if (!hud?.left || !hud?.right) return;
    const model = buildPlanningTeamStatusModel(scene as unknown as Parameters<typeof buildPlanningTeamStatusModel>[0]) as { left: Record<string, unknown>; right: Record<string, unknown> } | null;
    hud.elements?.forEach((element) => (element as { setVisible?: (v: boolean) => void })?.setVisible?.(true));

    const applySide = (sideHud: TeamStatusSideHudLike, sideModel: Record<string, unknown>, colors: TeamStatusSideColors) => {
      const hpRatio = Math.max(0, Math.min(1, Number(sideModel?.hpRatio) || 0));
      const currentHp = Number(sideModel?.hpCurrent) || 0;
      const maxHp = Math.max(0, Number(sideModel?.hpMax) || 0);
      const powerValue = Math.max(0, Number(sideModel?.power) || 0);
      const powerMax = Math.max(0, Number(sideModel?.powerMax) || 0);
      const hpFillWidth = Math.max(1, (Math.max(1, sideHud.barW - 2)) * hpRatio);
      const powerRatio = powerMax > 0 ? Math.max(0, Math.min(1, powerValue / powerMax)) : 0;
      const powerFillWidth = Math.max(1, (Math.max(1, sideHud.barW - 2)) * powerRatio);
      const hpBarColor = hpRatio >= 0.6
        ? colors.high
        : hpRatio >= 0.3
          ? colors.mid
          : colors.low;
      sideHud.powerBarFill.width = powerFillWidth;
      sideHud.powerBarFill.displayWidth = powerFillWidth;
      sideHud.powerBarFill.setFillStyle(colors.power, powerMax > 0 ? 0.98 : 0.65);
      sideHud.hpBarFill.width = hpFillWidth;
      sideHud.hpBarFill.displayWidth = hpFillWidth;
      sideHud.hpBarFill.setFillStyle(hpBarColor, maxHp > 0 ? 0.98 : 0.65);
      sideHud.powerText?.setText(`${planningFormatCombatTeamStatusValue(scene, sideModel?.power)} / ${planningFormatCombatTeamStatusValue(scene, powerMax)}`);
      sideHud.hpText?.setText(`${planningFormatCombatTeamStatusValue(scene, currentHp)} / ${planningFormatCombatTeamStatusValue(scene, maxHp)}`);
      sideHud.powerText?.setScale?.(1);
      sideHud.hpText?.setScale?.(1);
    };

    applySide(hud.left, (model?.left ?? null) as unknown as Record<string, unknown>, {
      power: 0xe25151,
      high: 0x4fd16b,
      mid: 0x3bb85a,
      low: 0x2f8c45
    });
    applySide(hud.right, (model?.right ?? null) as unknown as Record<string, unknown>, {
      power: 0xe25151,
      high: 0x4fd16b,
      mid: 0x3bb85a,
      low: 0x2f8c45
    });
}

export function refreshPlanningSynergyPreview(scene: PlanningRefreshSceneLike) {
    const deployed: unknown[] = [];
    for (let row = 0; row < getPlanningBoardRowCount(scene as unknown as Parameters<typeof getPlanningBoardRowCount>[0]); row += 1) {
      for (let col = 0; col < PLAYER_COLS; col += 1) {
        const unit = getPlanningBoardUnit(scene as unknown as Parameters<typeof getPlanningBoardUnit>[0], row, col);
        if (unit) deployed.push(unit);
      }
    }
    deployed.push(...getPlanningCreativeSandboxUnits(scene as unknown as Parameters<typeof getPlanningCreativeSandboxUnits>[0], "LEFT"));
    const summary = planningComputeSynergyCounts(
      scene as unknown as Parameters<typeof planningComputeSynergyCounts>[0],
      deployed as unknown as Parameters<typeof planningComputeSynergyCounts>[1],
      "LEFT"
    );
    const classLines = Object.keys(summary.classCounts)
      .sort((a, b) => summary.classCounts[b] - summary.classCounts[a])
      .map((key) => `${getClassLabelVi(key)}: ${summary.classCounts[key]}`);
    const tribeLines = Object.keys(summary.tribeCounts)
      .sort((a, b) => summary.tribeCounts[b] - summary.tribeCounts[a])
      .map((key) => `${getTribeLabelVi(key)}: ${summary.tribeCounts[key]}`);
    const aug = scene.player.augments.length ? scene.player.augments.join(", ") : null;

    const classPreview = classLines.slice(0, 3);
    const tribePreview = tribeLines.slice(0, 3);
    const augPreview = aug ? aug.split(", ").slice(0, 2) : [];
    const classText = classPreview.length ? classPreview.map((line) => `• ${line}`).join("\n") : `• ${t("planning.synergy.noClass")}`;
    const tribeText = tribePreview.length ? tribePreview.map((line) => `• ${line}`).join("\n") : `• ${t("planning.synergy.noTribe")}`;
    const augText = augPreview.length
      ? `${augPreview.map((line) => `• ${line}`).join("\n")}${scene.player.augments.length > 2 ? `\n• ${t("planning.synergy.moreAugments", { count: scene.player.augments.length - 2 })}` : ""}`
      : `• ${t("planning.synergy.noAugment")}`;
    scene.synergyText.setText(`${t("planning.synergy.classTitle")}\n${classText}\n\n${t("planning.synergy.tribeTitle")}\n${tribeText}\n\n${t("planning.synergy.augmentTitle")}\n${augText}`);
    refreshPlanningRightPanelScrollMetrics(scene as unknown as Parameters<typeof refreshPlanningRightPanelScrollMetrics>[0]);
}

export function setPlanningHeaderStatVisible(scene: PlanningRefreshSceneLike, key: string, visible = true) {
    const chip = scene.headerStatChips?.[key] as {
      bg?: { setVisible?: (v: boolean) => void };
      icon?: { setVisible?: (v: boolean) => void };
      label?: { setVisible?: (v: boolean) => void };
      value?: { setVisible?: (v: boolean) => void };
      barBg?: { setVisible?: (v: boolean) => void };
      bar?: { setVisible?: (v: boolean) => void; clear?: () => void };
    } | undefined;
    if (!chip) return;
    chip.bg?.setVisible?.(visible);
    chip.icon?.setVisible?.(visible);
    chip.label?.setVisible?.(visible);
    chip.value?.setVisible?.(visible);
    chip.barBg?.setVisible?.(visible);
    if (chip.bar) {
      chip.bar.setVisible?.(visible);
      if (!visible) chip.bar?.clear?.();
    }
}

export function setPlanningHeaderStatValue(scene: PlanningRefreshSceneLike, key: string, value: unknown, max: number | null = null, currentIndicator: number | null = null) {
    const chip = scene.headerStatChips?.[key] as {
      value?: { setText: (text: string) => void };
      bar?: Phaser.GameObjects.Graphics & { _barColor?: number; _chipX?: number; _chipY?: number; _barY?: number };
      chipW: number;
    } | undefined;
    if (!chip?.value) return;
    chip.value.setText(String(value ?? "-"));
    if (chip.bar && max != null && max > 0) {
      // Use currentIndicator if provided, otherwise fallback to parsing value (historical behavior)
      let cur: number = currentIndicator ?? 0;
      if (currentIndicator == null) {
        const parsed = parseFloat(String(value));
        cur = !Number.isNaN(parsed) ? parsed : 0;
      }

      const pct = Math.min(1, Math.max(0, cur / max));
      const barMaxW = chip.chipW - 4;
      const barW = Math.max(2, Math.floor(barMaxW * pct));
      chip.bar.clear();
      chip.bar.fillStyle(chip.bar._barColor ?? 0x3a8fd4, 0.85);
      chip.bar.fillRoundedRect((chip.bar._chipX ?? 0) + 2, chip.bar._barY ?? (chip.bar._chipY ?? 0 + 36), barW, 3, 1);
    } else if (chip.bar) {
      chip.bar.clear();
    }
}

export function getPlanningPhaseLabel(scene: PlanningRefreshSceneLike, phase: string) {
    if (phase === PHASE.PLANNING) return t("planning.phase.planning");
    if (phase === PHASE.AUGMENT) return t("planning.phase.augment");
    if (phase === PHASE.COMBAT) return t("planning.phase.combat");
    if (phase === PHASE.GAME_OVER) return t("planning.phase.gameOver");
    return phase;
}

export function planningFormatCombatTeamStatusValue(scene: PlanningRefreshSceneLike, value: unknown) {
    const numeric = Math.max(0, Math.round(Number(value) || 0));
    return new Intl.NumberFormat("vi-VN").format(numeric);
}

export function showPlanningToast(scene: PlanningRefreshSceneLike, message: string, success = true) {
    const cx = scene.scale.width * 0.5;
    const y = scene.scale.height - 80;
    const color = success ? "#2ecc71" : "#e74c3c";
    const bg = scene.add.rectangle(cx, y, 340, 36, success ? 0x1e6b3a : 0x6b1e1e, 0.92);
    bg.setStrokeStyle(1, success ? 0x2ecc71 : 0xe74c3c, 0.8);
    bg.setDepth(9990);
    bg.setAlpha(0);
    const text = scene.add.text(cx, y, message, {
      fontFamily: UI_FONT,
      fontSize: "13px",
      color: color,
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(9991).setAlpha(0);
    scene.tweens.add({
      targets: [bg, text],
      alpha: 1,
      duration: 150,
      ease: "Sine.easeOut",
      hold: 1800,
      yoyo: true,
      onComplete: () => { bg.destroy(); text.destroy(); }
    });
}

export function changePlanningInvPage(scene: PlanningRefreshSceneLike, delta: number) {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "change_inventory_page", { delta }) === false) return;
    if (!scene.invPageMax) return;
    scene.inventoryPage = clamp((scene.inventoryPage || 0) + delta, 0, scene.invPageMax);
    if (scene.audioFx) (scene.audioFx as { play: (key: string) => void }).play("click");
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
}

export function changePlanningRecipeSuggestionPage(scene: PlanningRefreshSceneLike, delta: number) {
    if (guardPlanningTutorialAction(scene as unknown as Parameters<typeof guardPlanningTutorialAction>[0], "change_recipe_page", { delta }) === false) return;
    if (!scene.recipeSuggestionPageMax) return;
    scene.recipeSuggestionPage = clamp(
      (scene.recipeSuggestionPage || 0) + delta,
      0,
      scene.recipeSuggestionPageMax
    );
    if (scene.audioFx) (scene.audioFx as { play: (key: string) => void }).play("click");
    refreshPlanningStorageUi(scene as unknown as Parameters<typeof refreshPlanningStorageUi>[0]);
}

type TeamStatusSideHudLike = {
  barW: number;
  powerBarFill: { width: number; displayWidth: number; setFillStyle: (color: number, alpha: number) => void };
  hpBarFill: { width: number; displayWidth: number; setFillStyle: (color: number, alpha: number) => void };
  powerText: { setText: (text: string) => void; setScale?: (s: number) => void } | null;
  hpText: { setText: (text: string) => void; setScale?: (s: number) => void } | null;
};
