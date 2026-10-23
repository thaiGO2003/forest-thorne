import type Phaser from "phaser";
import { t } from "../../i18n/index.js";
import type { SceneButton } from "../../ui/SceneButton.js";
import { UI_COLORS, UI_SPACING } from "../../core/uiTheme.js";
import { computePlanningTopHeaderMetrics } from "./planningTopHeaderLayout.js";
import {
  getHistoryButtonLabel,
  getPlanningCortisolButtonLabel,
  getResetRunButtonLabel,
  getUtilityLibraryButtonLabel,
  getUtilitySettingsButtonLabel
} from "../../ui/buttonEmojiLabels.js";

import { createSceneButton } from "../../ui/SceneButton.js";
import { beginPlanningCombat } from "./planningCombatTransitionRuntime.js";
import { activatePlanningCortisolMode } from "./planningCortisolRuntime.js";
import { sellPlanningSelectedUnit } from "./planningFormationRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { startPlanningNewRun } from "./planningRunStateRuntime.js";
import { togglePlanningHistoryModal, togglePlanningLibraryModal, togglePlanningSettingsOverlay, togglePlanningVersionInfoModal } from "./planningSettingsRuntime.js";
import { buyPlanningXp, rollPlanningShop, togglePlanningLock } from "./planningShopActionsRuntime.js";
import {
  openPlanningTechTree,
  planningShouldShowShopInPlanning,
  planningShouldShowTechTreeInPlanning
} from "./planningTechRuntime.js";

type PlanningLayout = {
  compactHud?: boolean;
  boardPanelX: number;
  boardPanelW: number;
  actionsY: number;
  topPanelY: number;
  topPanelH: number;
};

type PlanningButtons = Record<string, SceneButton | null>;

type ActionButtonScene = Phaser.Scene & {
  layout: PlanningLayout;
  buttons: PlanningButtons;
  gameModeConfig?: { enabledSystems?: { shop?: boolean } } | null;
  [key: string]: unknown;
};

type StartButtonOptions = {
  isPvpRoomMode?: boolean;
  pvpReady?: boolean;
  isCoopMode?: boolean;
  isCoopHost?: boolean;
  coopPinged?: boolean;
};

export function getPlanningActionButtonWidths(compact: boolean = false): { techTree: number; roll: number; lock: number; xp: number; cta: number } {
  return {
    techTree: compact ? 182 : 198,
    roll: compact ? 136 : 148,
    lock: compact ? 118 : 130,
    xp: compact ? 130 : 142,
    cta: compact ? 264 : 282
  };
}

export function getPlanningTechTreeButtonLabel(): string {
  return t("planning.ui.techTree");
}

export function getPlanningRollButtonLabel(cost: number = 2): string {
  return t("planning.ui.roll", { cost });
}

export function getPlanningLockButtonLabel(locked: boolean = false): string {
  return t("planning.ui.lock", { icon: locked ? "🔒" : "🔓", state: locked ? t("planning.ui.on") : t("planning.ui.off") });
}

export function getPlanningXpButtonLabel(cost: number = 4): string {
  return `⭐ Mua XP (${cost}🪙)`;
}

export function getPlanningStartButtonLabel(options: StartButtonOptions = {}): string {
  if (options.isPvpRoomMode === true) {
    return options.pvpReady === true ? t("planning.ui.readyAlready") : t("planning.ui.readyCombat");
  }
  if (options.isCoopMode === true && options.isCoopHost === false) {
    return options.coopPinged === true ? t("planning.ui.pingReady") : t("planning.ui.pingHost");
  }
  return t("planning.ui.startCombat");
}

export function createPlanningButtons(scene: ActionButtonScene): void {
  const layout = scene.layout;
  const compact = layout.compactHud === true;
  const buttonWidths = getPlanningActionButtonWidths(compact);
  const topHeaderMetrics = computePlanningTopHeaderMetrics(layout);
  const x = layout.boardPanelX;
  const y1 = layout.actionsY;
  const stripH = compact ? 46 : 52;
  const btnH = compact ? 40 : 44;
  const topBtnH = compact ? 30 : 32;
  const topBtnY = topHeaderMetrics.topBtnY;
  const strip = scene.add.rectangle(layout.boardPanelX + layout.boardPanelW / 2, y1 + btnH / 2, layout.boardPanelW, stripH, 0x101f31, 0.52);
  strip.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.7);
  strip.setDepth(1888);

  const gap = UI_SPACING.SM;
  const ctaW = buttonWidths.cta;

  let curX = x;
  const techBtnW = buttonWidths.techTree;
  if (planningShouldShowTechTreeInPlanning(scene as unknown as Parameters<typeof planningShouldShowTechTreeInPlanning>[0]) !== false) {
    scene.buttons.techTree = createSceneButton(scene, curX, y1, techBtnW, btnH, getPlanningTechTreeButtonLabel(), () => openPlanningTechTree(scene as unknown as Parameters<typeof openPlanningTechTree>[0]));
    curX += techBtnW + gap;
  } else {
    scene.buttons.techTree = null;
  }

  if (planningShouldShowShopInPlanning(scene as unknown as Parameters<typeof planningShouldShowShopInPlanning>[0]) !== false && scene.gameModeConfig?.enabledSystems?.shop !== false) {
    const rollW = buttonWidths.roll;
    const lockW = buttonWidths.lock;
    scene.buttons.roll = createSceneButton(scene, curX, y1, rollW, btnH, getPlanningRollButtonLabel(2), () => rollPlanningShop(scene as unknown as Parameters<typeof rollPlanningShop>[0]));
    curX += rollW + gap;

    scene.buttons.lock = createSceneButton(scene, curX, y1, lockW, btnH, getPlanningLockButtonLabel(false), () => togglePlanningLock(scene as unknown as Parameters<typeof togglePlanningLock>[0]));
  } else {
    scene.buttons.roll = null;
    scene.buttons.lock = null;
  }

  const startX = layout.boardPanelX + layout.boardPanelW - ctaW;
  let actionX = startX;
  actionX -= buttonWidths.xp + gap;
  scene.buttons.xp = createSceneButton(scene, actionX, y1, buttonWidths.xp, btnH, getPlanningXpButtonLabel(4), () => buyPlanningXp(scene as unknown as Parameters<typeof buyPlanningXp>[0]));

  const sellW = 185;
  const unequipW = 145;
  actionX -= sellW + gap;
  scene.buttons.sell = createSceneButton(scene, actionX, y1, sellW, btnH, t("planning.ui.sellUnit"), () => sellPlanningSelectedUnit(scene as unknown as Parameters<typeof sellPlanningSelectedUnit>[0]), { variant: "ghost" });
  actionX -= unequipW + gap;
  scene.buttons.unequip = createSceneButton(scene, actionX, y1, unequipW, btnH, t("planning.ui.unequip"), () => addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.log.unequipHint")), { variant: "ghost" });

  scene.buttons.start = createSceneButton(scene,
    startX,
    compact ? y1 - 1 : y1 - 2,
    ctaW,
    compact ? 44 : 48,
    getPlanningStartButtonLabel(),
    () => beginPlanningCombat(scene as unknown as Parameters<typeof beginPlanningCombat>[0]),
    { variant: "cta", fontSize: compact ? 15 : 16, bold: true }
  );
  const startBg = scene.buttons.start.bg;
  if (startBg && typeof startBg === "object" && "setStrokeStyle" in startBg && typeof startBg.setStrokeStyle === "function") {
    startBg.setStrokeStyle(1.4, UI_COLORS.ctaEdge, 0.98);
  }

  const topBtnWidths = topHeaderMetrics.buttonWidths;

  let topBtnX = topHeaderMetrics.topButtonsLeftX;
  scene.buttons.cortisol = createSceneButton(scene,
    topBtnX,
    topBtnY,
    topBtnWidths.cortisol,
    topBtnH,
    getPlanningCortisolButtonLabel(),
    () => activatePlanningCortisolMode(scene as unknown as Parameters<typeof activatePlanningCortisolMode>[0]),
    { variant: "ghost", fontSize: compact ? 11 : 12 }
  );

  scene.buttons.versionInfo = null;

  topBtnX += topBtnWidths.cortisol + gap;
  scene.buttons.reset = createSceneButton(scene,
    topBtnX,
    topBtnY,
    topBtnWidths.reset,
    topBtnH,
    getResetRunButtonLabel(),
    () => startPlanningNewRun(scene as unknown as Parameters<typeof startPlanningNewRun>[0]),
    { variant: "ghost", fontSize: compact ? 11 : 12 }
  );

  topBtnX += topBtnWidths.reset + gap;
  scene.buttons.history = createSceneButton(scene,
    topBtnX,
    topBtnY,
    topBtnWidths.history,
    topBtnH,
    getHistoryButtonLabel(),
    () => togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], true as unknown as Parameters<typeof togglePlanningHistoryModal>[1]),
    { variant: "ghost", fontSize: compact ? 11 : 12 }
  );

  topBtnX += topBtnWidths.history + gap;
  scene.buttons.wiki = createSceneButton(scene,
    topBtnX,
    topBtnY,
    topBtnWidths.wiki,
    topBtnH,
    getUtilityLibraryButtonLabel(),
    () => {
      togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0], false as unknown as Parameters<typeof togglePlanningSettingsOverlay>[1]);
      togglePlanningHistoryModal(scene as unknown as Parameters<typeof togglePlanningHistoryModal>[0], false as unknown as Parameters<typeof togglePlanningHistoryModal>[1]);
      togglePlanningVersionInfoModal(scene as unknown as Parameters<typeof togglePlanningVersionInfoModal>[0], false as unknown as Parameters<typeof togglePlanningVersionInfoModal>[1]);
      togglePlanningLibraryModal(scene as unknown as Parameters<typeof togglePlanningLibraryModal>[0]);
    },
    { variant: "ghost", fontSize: compact ? 11 : 12 }
  );

  topBtnX += topBtnWidths.wiki + gap;
  scene.buttons.settings = createSceneButton(scene,
    topBtnX,
    topBtnY,
    topBtnWidths.settings,
    topBtnH,
    getUtilitySettingsButtonLabel(),
    () => togglePlanningSettingsOverlay(scene as unknown as Parameters<typeof togglePlanningSettingsOverlay>[0]),
    { variant: "ghost", fontSize: compact ? 11 : 12 }
  );
}
