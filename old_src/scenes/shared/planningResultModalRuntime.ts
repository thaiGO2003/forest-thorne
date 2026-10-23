import Phaser from "phaser";
import { ITEM_BY_ID } from "../../data/items.js";
import { clamp } from "../../core/gameUtils.js";
import { UI_FONT } from "../../core/uiTheme.js";
import { getMinTouchTarget, scaleFontPx, scaleUiSize } from "../../core/uiResponsive.js";
import { t } from "../../i18n/index.js";
import { getLootSourceLabel } from "./lootDropText.js";

import { isPlanningCreativeMode } from "./planningCreativeSandboxRuntime.js";

type UnknownRecord = Record<string, unknown>;
type LootDropDetailLike = { itemId?: string } & UnknownRecord;
type ResultLike = {
  lootDrops?: string[];
  lootDropDetails?: Array<LootDropDetailLike | null | undefined>;
  winnerSide?: string;
  round?: number;
  damage?: number;
  goldBase?: number;
  goldEarned?: number;
  goldDelta?: number;
  goldStarBonus?: number;
  assassinBountyGold?: number;
  creativeMode?: boolean;
  creativeIgnoreDefeat?: boolean;
  creativePassiveXpSuppressed?: boolean;
  [k: string]: unknown;
};
type GroupedLootEntry = { count: number; sources: Map<string, number> };
type PlanningSceneLike = Phaser.Scene & {
  layout: { boardPanelX: number; boardPanelY: number; boardPanelW: number; [k: string]: unknown };
  player: {
    round?: number; gold?: number; hp?: number | string; level?: number;
    winStreak?: number; loseStreak?: number;
    interestCapBonus?: number; interestRateBonus?: number;
    fixedIncome?: number; winGoldBonus?: number;
    [k: string]: unknown;
  };
  aiMode: string;
  gameModeConfig?: { goldScaling?: (round: number) => number } | null;
  resultModalVisible?: boolean;
  activeResultModalScrollController?: { onWheel: (pointer: { x: number; y: number } | null, dy: number) => void; destroy: () => void } | null;
  isBoardDragging?: boolean;
  boardPointerDown?: unknown;
  lastDragPoint?: unknown;
  boardDragConsumed?: boolean;
  [k: string]: unknown;
};
type ContentContainerLike = Phaser.GameObjects.Container & { filters: Phaser.Types.GameObjects.FiltersInternalExternal };

export function buildLootLines(result: ResultLike): string[] {
  const rightLines: string[] = [];
  const lootDrops: string[] = result.lootDrops ?? [];
  const lootDropDetails: Array<{ itemId?: string; [k: string]: unknown } | null | undefined> = Array.isArray(result.lootDropDetails) ? result.lootDropDetails : [];

  if (lootDrops.length > 0) {
    rightLines.push("");
    rightLines.push(t("planning.result.lootDropsHeader"));

    const grouped = new Map<string, GroupedLootEntry>();
    lootDrops.forEach((id: string) => {
      if (!grouped.has(id)) {
        grouped.set(id, { count: 0, sources: new Map<string, number>() });
      }
      grouped.get(id)!.count += 1;
    });

    lootDropDetails.forEach((detail: LootDropDetailLike | null | undefined) => {
      const id = detail?.itemId;
      if (!id || !grouped.has(id)) return;
      const sourceLabel = getLootSourceLabel(detail);
      const entry = grouped.get(id);
      if (!entry) return;
      const sourceMap = entry.sources;
      sourceMap.set(sourceLabel, (sourceMap.get(sourceLabel) ?? 0) + 1);
    });

    grouped.forEach((entry: GroupedLootEntry, id: string) => {
      const item = ITEM_BY_ID[id];
      rightLines.push(`  ${item?.icon ?? "❔"} ${item?.name ?? id} x${entry.count}`);
      if (entry.sources.size > 0) {
        const sourceList = Array.from(entry.sources.entries())
          .sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
        const preview = sourceList
          .slice(0, 2)
          .map(([label, amount]: [string, number]) => amount > 1 ? `${label} x${amount}` : label)
          .join("; ");
        const extra = sourceList.length > 2 ? t("planning.result.moreSources", { count: sourceList.length - 2 }) : "";
        rightLines.push(t("planning.result.sourceLine", { preview, extra }));
      }
    });
  } else {
    rightLines.push("");
    rightLines.push(t("planning.result.noLootDrops"));
  }

  return rightLines;
}

function buildIncomePreviewLines(scene: PlanningSceneLike): string[] {
  if (isPlanningCreativeMode(scene as unknown as Parameters<typeof isPlanningCreativeMode>[0])) {
    return [
      "",
      t("planning.result.incomeCreativeIgnored"),
      t("planning.result.passiveXpZero")
    ];
  }
  const player = scene.player ?? {};
  const nextRound = (player.round ?? 0) + 1;
  const base = scene.gameModeConfig?.goldScaling?.(nextRound) ?? 5;
  const interestCap = 5 + (player.interestCapBonus ?? 0);
  const rate = 0.1 + (player.interestRateBonus ?? 0);
  const interest = Math.min(interestCap, Math.floor((player.gold ?? 0) * rate));
  const winStreakBonus = (player.winStreak ?? 0) >= 2 ? Math.min(3, Math.floor((player.winStreak ?? 0) / 2)) : 0;
  const loseStreakBonus = (player.loseStreak ?? 0) >= 2 ? Math.min(3, Math.floor((player.loseStreak ?? 0) / 2)) : 0;
  const streak = Math.max(winStreakBonus, loseStreakBonus);
  const fixedIncome = player.fixedIncome ?? 0;
  const total = base + interest + streak + fixedIncome;
  return [
    "",
    t("planning.result.incomeEstimated", { total }),
    t("planning.result.incomeBase", { base }),
    t("planning.result.incomeInterest", { interest, pct: Math.round(rate * 100) }),
    t("planning.result.incomeStreak", { streak }),
    t("planning.result.incomeTech", { fixedIncome })
  ];
}

function buildCombatResultColumns(scene: PlanningSceneLike, result: ResultLike): { leftLines: string[]; rightLines: string[] } {
  const won = result.winnerSide === "LEFT";
  const draw = result.winnerSide === "DRAW";
  const resultLabel = won ? t("planning.result.win") : draw ? t("planning.result.draw") : t("planning.result.loss");
  const playerHearts = scene.player.hp ?? "inf";
  const battleBaseGold = Math.max(0, result.goldBase ?? (result.goldEarned ?? result.goldDelta ?? 0));
  const battleStarGold = Math.max(0, result.goldStarBonus ?? 0);
  const assassinBountyGold = Math.max(0, result.assassinBountyGold ?? 0);
  const extraWinGold = won ? Math.max(0, scene.player.winGoldBonus ?? 0) : 0;
  const immediateGold = won
    ? (result.goldEarned ?? result.goldDelta ?? (battleBaseGold + battleStarGold + assassinBountyGold)) + extraWinGold
    : Math.max(0, result.goldDelta ?? assassinBountyGold);

  const leftLines = [
    t("planning.result.roundLine", { round: result.round ?? "?" }),
    t("planning.result.resultLine", { result: resultLabel })
  ];
  if (won) leftLines.push(t("planning.result.winStreak", { count: scene.player.winStreak ?? 0 }));
  if (!won && !draw) leftLines.push(t("planning.result.loseStreak", { count: scene.player.loseStreak ?? 0 }));
  if ((result.damage ?? 0) > 0 && !won) leftLines.push(t("planning.result.damageTaken", { damage: result.damage }));
  leftLines.push(t("planning.result.heartsRemaining", { hearts: playerHearts }));
  leftLines.push(t("planning.result.playerLevel", { level: Math.floor(scene.player.level ?? 1) }));
  leftLines.push(t("planning.result.goldRemaining", { gold: result.creativeMode ? "∞" : (scene.player.gold ?? 0) }));
  if (result.creativeIgnoreDefeat) leftLines.push(t("result.creativeDefeatIgnored"));

  const rightLines = [];
  if (immediateGold > 0) {
    rightLines.push(t("planning.result.immediateGold", { gold: immediateGold }));
    if (won) {
      rightLines.push(t("planning.result.enemyUnitGold", { gold: battleBaseGold }));
      rightLines.push(t("planning.result.enemyStarGold", { gold: battleStarGold }));
      if (assassinBountyGold > 0) rightLines.push(t("planning.result.assassinBountyBranch", { gold: assassinBountyGold }));
      rightLines.push(t("planning.result.extraWinGold", { gold: extraWinGold }));
    } else {
      rightLines.push(t("planning.result.assassinBountyLast", { gold: assassinBountyGold }));
    }
    rightLines.push(t("planning.result.goldTotal", { gold: result.creativeMode ? "∞" : (scene.player.gold ?? 0) }));
    if (won) rightLines.push(t("planning.result.xpEarned", { xp: result.creativePassiveXpSuppressed ? 0 : 2 }));
  } else {
    rightLines.push(t("planning.result.noGoldReward"));
  }

  rightLines.push(...buildLootLines(result));
  rightLines.push(...buildIncomePreviewLines(scene));

  return { leftLines, rightLines };
}

export function showPlanningRoundResultBanner(scene: PlanningSceneLike, text: string, isWin: boolean = true, holdMs: number = 1100, onDone: (() => void) | null = null): void {
  const cx = scene.layout.boardPanelX + scene.layout.boardPanelW * 0.5;
  const cy = scene.layout.boardPanelY + 54;
  const fill = isWin ? 0x21482a : 0x4b1f29;
  const edge = isWin ? 0x9df7b3 : 0xffb3bf;
  const fg = isWin ? "#d7ffe0" : "#ffe0e6";
  const width = Math.max(300, Math.min(520, scene.layout.boardPanelW * 0.45));
  const bg = scene.add.rectangle(cx, cy, width, 54, fill, 0.94);
  bg.setStrokeStyle(2, edge, 0.98);
  bg.setDepth(4600);
  const label = scene.add.text(cx, cy, text, {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 24, "title"),
    color: fg,
    fontStyle: "bold"
  }).setOrigin(0.5);
  label.setDepth(4601);

  scene.tweens.add({
    targets: [bg, label],
    alpha: 0,
    delay: holdMs,
    duration: 280,
    ease: "Cubic.easeIn",
    onComplete: () => {
      bg.destroy();
      label.destroy();
      onDone?.();
    }
  });
}

export function clearPlanningResultModalScrollController(scene: PlanningSceneLike): void {
  scene.resultModalVisible = false;
  if (scene.activeResultModalScrollController?.destroy) {
    scene.activeResultModalScrollController.destroy();
  }
  scene.activeResultModalScrollController = null;
}

export function attachPlanningResultModalScrollController(
  scene: PlanningSceneLike,
  parts: Phaser.GameObjects.GameObject[],
  options: {
    viewportX: number;
    viewportY: number;
    viewportW: number;
    viewportH: number;
    contentContainer: ContentContainerLike;
    contentHeight: number;
    depth: number;
  }
): void {
  const { viewportX, viewportY, viewportW, viewportH, contentContainer, contentHeight, depth } = options;
  const maskShape = scene.add.graphics();
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(viewportX, viewportY, viewportW, viewportH);
  maskShape.setVisible(false);
  maskShape.setDepth(depth);
  parts.push(maskShape);
  contentContainer.enableFilters();
  contentContainer.filters.external.addMask(maskShape);

  const overflow = Math.max(0, Math.ceil(contentHeight - viewportH));
  const trackX = viewportX + viewportW - 5;
  const scrollbarTrack = scene.add.rectangle(trackX, viewportY + viewportH * 0.5, 4, viewportH, 0x27415d, overflow > 0 ? 0.72 : 0.22)
    .setOrigin(0.5);
  scrollbarTrack.setDepth(depth + 1);
  parts.push(scrollbarTrack);

  const scrollbarThumbHeight = overflow > 0
    ? Math.max(28, Math.floor((viewportH / contentHeight) * viewportH))
    : viewportH;
  const scrollbarThumb = scene.add.rectangle(trackX, viewportY, 4, scrollbarThumbHeight, 0x92d8ff, overflow > 0 ? 0.95 : 0)
    .setOrigin(0.5, 0);
  scrollbarThumb.setDepth(depth + 2);
  parts.push(scrollbarThumb);

  const scrollHint = scene.add.text(trackX - 10, viewportY + viewportH - 4, t("planning.ui.scroll"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 10, "caption"),
    color: "#86cfff",
    fontStyle: "bold"
  }).setOrigin(1, 1);
  scrollHint.setDepth(depth + 2);
  scrollHint.setVisible(overflow > 0);
  parts.push(scrollHint);

  let scrollOffset = 0;
  const updateScroll = () => {
    contentContainer.y = viewportY - scrollOffset;
    if (overflow <= 0) {
      scrollbarThumb.y = viewportY;
      return;
    }
    const thumbTravel = Math.max(0, viewportH - scrollbarThumbHeight);
    const progress = overflow > 0 ? scrollOffset / overflow : 0;
    scrollbarThumb.y = viewportY + thumbTravel * progress;
    scrollHint.setAlpha(scrollOffset >= overflow - 1 ? 0.45 : 1);
  };

  updateScroll();
  scene.resultModalVisible = true;
  scene.activeResultModalScrollController = {
    onWheel: (pointer: { x: number; y: number } | null, dy: number) => {
      if (!pointer) return;
      const insideViewport = pointer.x >= viewportX
        && pointer.x <= viewportX + viewportW
        && pointer.y >= viewportY
        && pointer.y <= viewportY + viewportH;
      if (!insideViewport || overflow <= 0) return;
      scrollOffset = clamp(scrollOffset + dy * 0.55, 0, overflow);
      updateScroll();
    },
    destroy: () => {
      contentContainer.clearMask?.(false);
    }
  };
}

export function showPlanningCombatResultModal(scene: PlanningSceneLike, result: ResultLike | null | undefined, onClose: (() => void) | null = null): void {
  if (!result) {
    onClose?.();
    return;
  }

  clearPlanningResultModalScrollController(scene);
  scene.isBoardDragging = false;
  scene.boardPointerDown = null;
  scene.lastDragPoint = null;
  scene.boardDragConsumed = false;

  const w = scene.scale.width;
  const h = scene.scale.height;
  const modalW = Math.min(scaleUiSize(scene, 600, "control"), Math.floor(w * 0.76));
  const modalH = Math.min(scaleUiSize(scene, 400, "control"), Math.floor(h * 0.68));
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const x0 = cx - modalW * 0.5;
  const y0 = cy - modalH * 0.5;
  const depth = 5500;

  const won = result.winnerSide === "LEFT";
  const draw = result.winnerSide === "DRAW";
  const resultLabel = won ? t("planning.result.win") : draw ? t("planning.result.draw") : t("planning.result.loss");
  const titleColor = won ? "#79df7b" : draw ? "#f3d66b" : "#f44336";

  const parts: Phaser.GameObjects.GameObject[] = [];
  const dimmer = scene.add.rectangle(cx, cy, w, h, 0x020509, 0.75);
  dimmer.setDepth(depth);
  dimmer.setInteractive();
  parts.push(dimmer);

  const panel = scene.add.rectangle(cx, cy, modalW, modalH, 0x0f1a29, 0.98);
  panel.setStrokeStyle(2, won ? 0x79df7b : draw ? 0xf3d66b : 0xf44336, 0.9);
  panel.setDepth(depth + 1);
  parts.push(panel);

  const title = scene.add.text(cx, y0 + 22, t("planning.result.modalHeader", { result: resultLabel, round: result.round ?? "?" }), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 20, "title"),
    color: titleColor,
    fontStyle: "bold"
  }).setOrigin(0.5, 0);
  title.setDepth(depth + 2);
  parts.push(title);

  const divY = y0 + 54;
  const divider = scene.add.rectangle(cx, divY, modalW - 40, 1, 0x3a5a7a, 0.7);
  divider.setDepth(depth + 2);
  parts.push(divider);

  const btnW = scaleUiSize(scene, 140, "control");
  const btnH = Math.max(getMinTouchTarget(scene), scaleUiSize(scene, 38, "control"));
  const btnX = cx;
  const btnY = y0 + modalH - 32;

  const contentViewportX = x0 + 18;
  const contentViewportY = divY + 14;
  const contentViewportW = modalW - 36;
  const contentViewportBottom = btnY - btnH * 0.5 - 14;
  const contentViewportH = Math.max(90, Math.floor(contentViewportBottom - contentViewportY));
  const contentContainer = scene.add.container(contentViewportX, contentViewportY) as unknown as ContentContainerLike;
  contentContainer.setDepth(depth + 2);
  parts.push(contentContainer);

  const innerPadX = 6;
  const innerGap = 16;
  const colW = Math.floor((contentViewportW - innerPadX * 2 - innerGap - 10) / 2);
  const leftX = innerPadX;
  const rightX = leftX + colW + innerGap;

  const leftTitle = scene.add.text(leftX, 0, t("planning.result.roundInfoTitle"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 15, "label"),
    color: "#ffeab0",
    fontStyle: "bold"
  });
  contentContainer.add(leftTitle);

  const rightTitle = scene.add.text(rightX, 0, t("planning.result.rewardsTitle"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 15, "label"),
    color: "#ffeab0",
    fontStyle: "bold"
  });
  contentContainer.add(rightTitle);

  const { leftLines, rightLines } = buildCombatResultColumns(scene, result);
  const leftBody = scene.add.text(leftX, 24, leftLines.join("\n"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 13, "body"),
    color: "#c0ddf5",
    lineSpacing: scaleUiSize(scene, 6, "spacing"),
    wordWrap: { width: colW }
  });
  contentContainer.add(leftBody);

  const rightBody = scene.add.text(rightX, 24, rightLines.join("\n"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 13, "body"),
    color: "#c0ddf5",
    lineSpacing: scaleUiSize(scene, 6, "spacing"),
    wordWrap: { width: colW }
  });
  contentContainer.add(rightBody);

  const contentHeight = Math.max(
    leftTitle.height,
    rightTitle.height,
    leftBody.y + leftBody.height,
    rightBody.y + rightBody.height
  ) + 12;

  const vDiv = scene.add.rectangle(leftX + colW + innerGap * 0.5 - 2, 6, 1, contentHeight, 0x3a5a7a, 0.6)
    .setOrigin(0.5, 0);
  contentContainer.add(vDiv);

  attachPlanningResultModalScrollController(scene, parts, {
    viewportX: contentViewportX,
    viewportY: contentViewportY,
    viewportW: contentViewportW,
    viewportH: contentViewportH,
    contentContainer,
    contentHeight,
    depth: depth + 2
  });

  const btnBg = scene.add.rectangle(btnX, btnY, btnW, btnH, won ? 0x1b4a2a : 0x2a3040, 0.95);
  btnBg.setStrokeStyle(1.5, won ? 0x79df7b : 0x7ab8f5, 0.9);
  btnBg.setDepth(depth + 3);
  btnBg.setInteractive({ useHandCursor: true });
  parts.push(btnBg);

  const btnLabel = scene.add.text(btnX, btnY, t("planning.result.continueBtn"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 15, "button"),
    color: won ? "#d7ffe0" : "#e9f5ff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  btnLabel.setDepth(depth + 4);
  parts.push(btnLabel);

  btnBg.on("pointerover", () => btnBg.setFillStyle(won ? 0x265a37 : 0x3a4a5c, 0.98));
  btnBg.on("pointerout", () => btnBg.setFillStyle(won ? 0x1b4a2a : 0x2a3040, 0.95));
  btnBg.on("pointerdown", () => {
    clearPlanningResultModalScrollController(scene);
    parts.forEach((part) => part?.destroy?.());
    onClose?.();
  });
}

