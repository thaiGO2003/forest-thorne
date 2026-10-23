import Phaser from "phaser";
import { t } from "../../i18n/index.js";
import { clamp } from "../../core/gameUtils.js";
import { EMOJI_FONT, UI_COLORS, UI_FONT, UI_SPACING } from "../../core/uiTheme.js";
import { scaleFontPx, scaleUiSize } from "../../core/uiResponsive.js";

import {
  computePlanningTopHeaderMetrics,
  layoutPlanningHeaderMeta
} from "./planningTopHeaderLayout.js";
import { createPlanningStorageSpace } from "./planningStorageUiRuntime.js";

import { getPlanningSynergyTooltip } from "./planningTooltipRuntime.js";

interface StatDef {
  key: string;
  icon: string;
  label: string;
  hasBar?: boolean;
  barColor?: number;
}

function getPlanningStatDefs(): StatDef[] {
  return [
    { key: "round", icon: "🔔", label: t("planning.hud.round") },
    { key: "hp", icon: "❤", label: t("planning.hud.hp"), hasBar: true, barColor: 0xe85d5d },
    { key: "gold", icon: "🪙", label: t("planning.hud.gold"), hasBar: true, barColor: 0xd4a017 },
    { key: "level", icon: "⭐", label: t("planning.hud.level"), hasBar: true, barColor: 0x9c27b0 },
    { key: "xp", icon: "✪", label: "XP", hasBar: true, barColor: 0x3a8fd4 },
    { key: "deploy", icon: "⚒", label: t("planning.hud.deploy"), hasBar: true, barColor: 0x4caf50 }
  ];
}

interface PlanningHudLayout {
  width: number;
  height: number;
  boardPanelX: number;
  boardPanelW: number;
  boardPanelH: number;
  boardPanelY: number;
  topPanelY: number;
  topPanelH: number;
  sidePanelX?: number;
  sidePanelW: number;
  sidePanelH: number;
  sidePanelY: number;
  leftSidePanelX: number;
  leftUnitInfoPanelY: number;
  leftUnitInfoPanelH: number;
  compactHud?: boolean;
  [key: string]: unknown;
}

interface PlanningHudChip {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics | null;
  barBg: Phaser.GameObjects.Rectangle | null;
  chipX: number;
  chipW: number;
}

interface UnitInfoBadge {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  chipX: number;
  chipW: number;
  centerY: number;
}

interface BadgeRowDef {
  key: string;
  color: string | number;
}

interface UnitInfoBadgeRowsArgs {
  startX: number;
  rowY: number;
  rowW: number;
  rowH: number;
  rowGap: number;
  compact: boolean;
  gap: number;
  rows: BadgeRowDef[][];
}

interface UnitInfoMetricBarArgs {
  x: number;
  centerY: number;
  w: number;
  h: number;
  compact: boolean;
  tag: string;
  colors?: {
    tagText?: string | number;
    barBg?: number;
    barEdge?: number;
    fill?: number;
    valueText?: string | number;
  };
}

interface UnitInfoMetricBar {
  bg: Phaser.GameObjects.Rectangle;
  tagText: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  barW: number;
  barFillH: number;
  centerY: number;
}

interface TeamStatusMetricRowArgs {
  x: number;
  centerY: number;
  w: number;
  compact: boolean;
  tag: string;
  colors?: {
    tagText?: string;
    barBg?: number;
    barEdge?: number;
    fill?: number;
    valueText?: string;
  };
}

interface TeamStatusMetricRow {
  tagText: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  barW: number;
  barFillH: number;
  centerY: number;
}

interface TeamStatusSideColors {
  edge?: number;
  powerText?: string;
  powerBarBg?: number;
  powerEdge?: number;
  powerFill?: number;
  hpText?: string;
  hpBarBg?: number;
  hpEdge?: number;
  hpFill?: number;
  barBg?: number;
  fill?: number;
  textStroke?: string | number;
}

interface TeamStatusSideHud {
  card: Phaser.GameObjects.Rectangle;
  labelText: Phaser.GameObjects.Text;
  powerRow: TeamStatusMetricRow;
  hpRow: TeamStatusMetricRow;
  powerText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  powerBarBg: Phaser.GameObjects.Rectangle;
  powerBarFill: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  elements: Phaser.GameObjects.GameObject[];
  barW: number;
  groupY: number;
  groupH: number;
}

interface TeamStatusHud {
  bg: Phaser.GameObjects.Rectangle;
  titleText: Phaser.GameObjects.Text;
  left: TeamStatusSideHud;
  right: TeamStatusSideHud;
  elements: Phaser.GameObjects.GameObject[];
  panelX: number;
  panelY: number;
  panelW: number;
  panelH: number;
}

interface SuggestionScrollItem {
  item: Phaser.GameObjects.GameObject;
  baseY: number;
}

interface UnitInfoPanel {
  bg: Phaser.GameObjects.Rectangle;
  titleText: Phaser.GameObjects.Text;
  portraitBg: Phaser.GameObjects.Rectangle;
  portraitText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  hpBar: UnitInfoMetricBar;
  rageBar: UnitInfoMetricBar;
  hpBarW: number;
  statusBadges: Record<string, UnitInfoBadge>;
  t3Title: Phaser.GameObjects.Text;
  t3Text: Phaser.GameObjects.Text;
  t4Title: Phaser.GameObjects.Text;
  t4Text: Phaser.GameObjects.Text;
  suggestionMaskShape: Phaser.GameObjects.GameObject;
  suggestionMask: unknown[];
  suggestionViewport: { x: number; y: number; w: number; h: number };
  suggestionScrollItems: SuggestionScrollItem[];
  suggestionScrollOffset: number;
  suggestionMaxScroll: number;
  emptyText: Phaser.GameObjects.Text;
  portraitAnchor: { x: number; y: number };
  portraitScale: number;
  suggestionLineLimit: number;
}

interface PlanningHudSceneLike extends Phaser.Scene {
  layout: PlanningHudLayout;
  titleText: Phaser.GameObjects.Text;
  ruleText: Phaser.GameObjects.Text | null;
  headerMetaText: Phaser.GameObjects.Text;
  relayoutTopHeaderMeta: (() => void) | null;
  headerStatChips: Record<string, PlanningHudChip>;
  planningTeamStatusHud: TeamStatusHud;
  synergyTitleText: Phaser.GameObjects.Text;
  synergyText: Phaser.GameObjects.Text;
  tooltip: { attach: (target: Phaser.GameObjects.GameObject, getter: () => unknown) => void };
  unitInfoPanel: UnitInfoPanel;
  [key: string]: unknown;
}

function resolveFontPixelValue(fontSize: unknown, fallback: number = 12): number {
  if (typeof fontSize === "number" && Number.isFinite(fontSize)) return fontSize;
  const parsed = Number.parseFloat(String(fontSize ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createPlanningStatChips(scene: PlanningHudSceneLike, layout: PlanningHudLayout): void {
  const compact = layout.compactHud === true;
  const headerMetrics = computePlanningTopHeaderMetrics(layout);
  const chipGap = scaleUiSize(scene, compact ? 8 : 10, "spacing");
  const chipY = headerMetrics.chipY;
  const totalChipW = layout.boardPanelW - UI_SPACING.SM * 2;
  const statDefs = getPlanningStatDefs();
  const chipW = clamp(Math.floor((totalChipW - chipGap * (statDefs.length - 1)) / statDefs.length), 92, 190);
  const chipStartX = layout.boardPanelX + UI_SPACING.SM;
  const chipH = scaleUiSize(scene, headerMetrics.chipH, "control");
  const iconFontSize = scaleFontPx(scene, compact ? 14 : 16, "label");
  const labelFontSize = scaleFontPx(scene, compact ? 10 : 11, "caption");
  const valueFontSize = scaleFontPx(scene, compact ? 13 : 14, "body");
  const barY = headerMetrics.chipBarY;
  scene.headerStatChips = {};

  statDefs.forEach((def, idx) => {
    const x = chipStartX + idx * (chipW + chipGap);
    const bg = scene.add.rectangle(x + chipW / 2, chipY + chipH / 2, chipW, chipH, 0x13273d, 0.94);
    bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.82);
    bg.setDepth(2000);

    const icon = scene.add.text(x + 16, chipY + chipH / 2, def.icon, {
      fontFamily: EMOJI_FONT,
      fontSize: iconFontSize,
      color: "#d8eeff"
    }).setOrigin(0, 0.5).setDepth(2001);

    const label = scene.add.text(x + (compact ? 36 : 42), chipY + (compact ? 7 : 11), def.label, {
      fontFamily: UI_FONT,
      fontSize: labelFontSize,
      color: UI_COLORS.textMuted
    }).setDepth(2001);

    const value = scene.add.text(x + chipW - 10, chipY + (compact ? 18 : 21), "-", {
      fontFamily: UI_FONT,
      fontSize: valueFontSize,
      color: UI_COLORS.textPrimary,
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setDepth(2001);

    let bar: Phaser.GameObjects.Graphics | null = null;
    let barBg: Phaser.GameObjects.Rectangle | null = null;
    if (def.hasBar) {
      barBg = scene.add.rectangle(x + chipW / 2, barY, chipW - 4, 3, 0x0a1520, 0.9);
      barBg.setDepth(2001);
      bar = scene.add.graphics();
      bar.setDepth(2002);
      (bar as Phaser.GameObjects.Graphics & { _chipX: number; _chipW: number; _chipY: number; _barY: number; _barColor: number })._chipX = x;
      (bar as Phaser.GameObjects.Graphics & { _chipX: number; _chipW: number; _chipY: number; _barY: number; _barColor: number })._chipW = chipW;
      (bar as Phaser.GameObjects.Graphics & { _chipX: number; _chipW: number; _chipY: number; _barY: number; _barColor: number })._chipY = chipY;
      (bar as Phaser.GameObjects.Graphics & { _chipX: number; _chipW: number; _chipY: number; _barY: number; _barColor: number })._barY = barY;
      (bar as Phaser.GameObjects.Graphics & { _chipX: number; _chipW: number; _chipY: number; _barY: number; _barColor: number })._barColor = def.barColor ?? 0xffffff;
    }

    scene.headerStatChips[def.key] = { bg, icon, label, value, bar, barBg, chipX: x, chipW };
  });
}

const UNIT_INFO_BADGE_ROWS: BadgeRowDef[][] = [
  [
    { key: "class", color: UI_COLORS.textSecondary },
    { key: "tribe", color: UI_COLORS.textSecondary },
    { key: "star", color: UI_COLORS.textPrimary },
    { key: "tier", color: UI_COLORS.textSecondary },
    { key: "price", color: "#d4a017" }
  ]
];

function createPlanningUnitInfoMetricBar(scene: PlanningHudSceneLike, { x, centerY, w, h, compact, tag, colors = {} }: UnitInfoMetricBarArgs): UnitInfoMetricBar {
  const edgePad = compact ? 4 : 5;
  const tagW = compact ? 22 : 26;
  const valueReserve = compact ? 44 : 50;
  const valueGap = compact ? 3 : 4;
  const barH = compact ? 5 : 6;
  const barFillH = compact ? 4 : 5;
  const fontSize = scaleFontPx(scene, compact ? 8 : 9, "caption");
  const barX = x + edgePad + tagW + 2;
  const barRightX = x + w - edgePad - valueReserve - valueGap;
  const barW = Math.max(20, barRightX - barX);

  const bg = scene.add.rectangle(x + w / 2, centerY, w, h, 0x0b1520, 0.92);
  bg.setStrokeStyle(1, 0x1f3244, 0.9);
  bg.setDepth(2000);

  const tagText = scene.add.text(x + edgePad, centerY, tag, {
    fontFamily: UI_FONT,
    fontSize,
    color: String(colors.tagText ?? UI_COLORS.textSecondary),
    fontStyle: "bold"
  }).setOrigin(0, 0.5).setDepth(2001);

  const barBg = scene.add.rectangle(barX + barW / 2, centerY, barW, barH, colors.barBg ?? 0x081018, 0.95);
  barBg.setStrokeStyle(1, colors.barEdge ?? 0x1a2a38, 0.85);
  barBg.setDepth(2000);

  const barFill = scene.add.rectangle(barX, centerY, barW, barFillH, colors.fill ?? 0x63d47b, 0.96)
    .setOrigin(0, 0.5)
    .setDepth(2001);

  const valueText = scene.add.text(x + w - edgePad, centerY, "", {
    fontFamily: UI_FONT,
    fontSize,
    color: String(colors.valueText ?? UI_COLORS.textPrimary),
    fontStyle: "bold"
  }).setOrigin(1, 0.5).setDepth(2001);

  return { bg, tagText, barBg, barFill, valueText, barW, barFillH, centerY };
}

function createPlanningUnitInfoBadgeRows(scene: PlanningHudSceneLike, { startX, rowY, rowW, rowH, rowGap, compact, gap, rows }: UnitInfoBadgeRowsArgs): Record<string, UnitInfoBadge> {
  const fontSize = scaleFontPx(scene, compact ? 8 : 9, "caption");
  const badges: Record<string, UnitInfoBadge> = {};
  let y = rowY;

  rows.forEach((rowDefs) => {
    const chipGap = gap;
    const chipCount = rowDefs.length;
    const chipW = Math.max(24, Math.floor((rowW - chipGap * (chipCount - 1)) / chipCount));
    rowDefs.forEach((def, idx) => {
      const chipX = startX + idx * (chipW + chipGap);
      const centerX = chipX + chipW / 2;
      const centerY = y + rowH / 2;
      const bg = scene.add.rectangle(centerX, centerY, chipW, rowH, 0x13273d, 0.94);
      bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.82);
      bg.setDepth(2000);
      const text = scene.add.text(centerX, centerY, "", {
        fontFamily: UI_FONT,
        fontSize,
        color: String(def.color),
        fontStyle: "bold"
      }).setOrigin(0.5).setDepth(2001);
      badges[def.key] = { bg, text, chipX, chipW, centerY };
    });
    y += rowH + rowGap;
  });

  return badges;
}

function createPlanningTeamStatusMetricRow(scene: PlanningHudSceneLike, { x, centerY, w, compact, tag, colors = {} }: TeamStatusMetricRowArgs): TeamStatusMetricRow {
  const edgePad = compact ? 3 : 4;
  const tagW = compact ? 18 : 22;
  const valueReserve = compact ? 50 : 58;
  const valueGap = compact ? 2 : 3;
  const barH = compact ? 4 : 5;
  const barFillH = compact ? 3 : 4;
  const fontSize = scaleFontPx(scene, compact ? 6 : 7, "caption");
  const barX = x + edgePad + tagW + 2;
  const barRightX = x + w - edgePad - valueReserve - valueGap;
  const barW = Math.max(18, barRightX - barX);

  const tagText = scene.add.text(x + edgePad, centerY, tag, {
    fontFamily: UI_FONT,
    fontSize,
    color: colors.tagText ?? UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setOrigin(0, 0.5).setDepth(2002);

  const barBg = scene.add.rectangle(barX + barW / 2, centerY, barW, barH, colors.barBg ?? 0x112615, 0.96);
  barBg.setStrokeStyle(1, colors.barEdge ?? UI_COLORS.panelEdgeSoft, 0.88);
  barBg.setDepth(2001);

  const barFill = scene.add.rectangle(barX, centerY, barW, barFillH, colors.fill ?? UI_COLORS.accent, 0.98)
    .setOrigin(0, 0.5)
    .setDepth(2002);

  const valueText = scene.add.text(x + w - edgePad, centerY, "0 / 0", {
    fontFamily: UI_FONT,
    fontSize,
    color: colors.valueText ?? UI_COLORS.textPrimary,
    fontStyle: "bold"
  }).setOrigin(1, 0.5).setDepth(2002);

  return { tagText, barBg, barFill, valueText, barW, barFillH, centerY };
}

function createPlanningTeamStatusSideHud(
  scene: PlanningHudSceneLike,
  x: number,
  y: number,
  groupW: number,
  groupH: number,
  compact: boolean,
  sideLabel: string,
  colors: TeamStatusSideColors = {}
): TeamStatusSideHud {
  const safeGroupW = Math.max(140, groupW);
  const safeGroupH = Math.max(compact ? 28 : 32, groupH);
  const marginX = compact ? 2 : 2;
  const rowGap = compact ? 2 : 3;
  const rowH = compact ? 12 : 14;
  const sideLabelFontSize = scaleFontPx(scene, compact ? 4 : 5, "caption");
  const sideLabelRowH = Math.max(compact ? 6 : 8, Math.ceil(resolveFontPixelValue(sideLabelFontSize, compact ? 4 : 5) * 1.55));
  const innerW = Math.max(100, safeGroupW - marginX * 2);
  const card = scene.add.rectangle(x + safeGroupW / 2, y + safeGroupH / 2, safeGroupW, safeGroupH, 0x0b1724, 0.48);
  card.setStrokeStyle(1, colors.edge ?? UI_COLORS.panelEdgeSoft, 0.78);
  card.setDepth(2000);

  const labelY = y + (compact ? 2 : 3);
  const sideTag = scene.add.text(x + marginX, labelY, sideLabel, {
    fontFamily: UI_FONT,
    fontSize: sideLabelFontSize,
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2001);

  const rowStartY = labelY + sideLabelRowH + 1;
  const powerCenterY = rowStartY + rowH / 2;
  const hpCenterY = powerCenterY + rowH + rowGap;
  const powerRow = createPlanningTeamStatusMetricRow(scene, {
    x: x + marginX,
    centerY: powerCenterY,
    w: innerW,
    compact,
    tag: "LC",
    colors: {
      tagText: colors.powerText ?? "#ffd3d3",
      barBg: colors.powerBarBg ?? colors.barBg ?? 0x2a1113,
      barEdge: colors.powerEdge ?? colors.edge ?? UI_COLORS.panelEdgeSoft,
      fill: colors.powerFill ?? colors.fill ?? UI_COLORS.accent,
      valueText: colors.powerText ?? "#ffd3d3"
    }
  });
  const hpRow = createPlanningTeamStatusMetricRow(scene, {
    x: x + marginX,
    centerY: hpCenterY,
    w: innerW,
    compact,
    tag: "HP",
    colors: {
      tagText: colors.hpText ?? "#d9ffe2",
      barBg: colors.hpBarBg ?? 0x112615,
      barEdge: colors.hpEdge ?? colors.edge ?? UI_COLORS.panelEdgeSoft,
      fill: colors.hpFill ?? UI_COLORS.accent,
      valueText: colors.hpText ?? "#d9ffe2"
    }
  });

  return {
    card,
    labelText: sideTag,
    powerRow,
    hpRow,
    powerText: powerRow.valueText,
    hpText: hpRow.valueText,
    powerBarBg: powerRow.barBg,
    powerBarFill: powerRow.barFill,
    hpBarBg: hpRow.barBg,
    hpBarFill: hpRow.barFill,
    elements: [
      card,
      sideTag,
      powerRow.tagText,
      powerRow.barBg,
      powerRow.barFill,
      powerRow.valueText,
      hpRow.tagText,
      hpRow.barBg,
      hpRow.barFill,
      hpRow.valueText
    ],
    barW: powerRow.barW,
    groupY: y,
    groupH: safeGroupH
  };
}

function createPlanningTeamStatusStrip(scene: PlanningHudSceneLike, layout: PlanningHudLayout): void {
  const compact = layout.compactHud === true;
  const panelDepth = 2110;
  const textDepth = 2120;
  const barDepth = 2121;
  const panelX = Number.isFinite(layout.sidePanelX) ? layout.sidePanelX as number : layout.leftSidePanelX;
  const panelY = Number.isFinite(layout.leftUnitInfoPanelY) ? layout.leftUnitInfoPanelY : layout.sidePanelY;
  const panelW = Number.isFinite(layout.sidePanelW) ? layout.sidePanelW : 220;
  const panelH = Number.isFinite(layout.leftUnitInfoPanelH) ? layout.leftUnitInfoPanelH : layout.sidePanelH;
  const pad = compact ? 3 : 3;
  const contentX = panelX + pad;
  const contentW = Math.max(120, panelW - pad * 2);
  const titleY = panelY + 2;
  const contentTop = panelY + (compact ? 10 : 11);
  const groupGap = 1;
  const availableH = Math.max(72, panelY + panelH - pad - contentTop);
  const groupH = Math.max(compact ? 28 : 32, Math.floor((availableH - groupGap) / 2));
  const sharedColors: TeamStatusSideColors = {
    edge: 0x4f667f,
    powerBarBg: 0x2a1113,
    powerEdge: 0xa74747,
    powerText: "#ffd9d9",
    powerFill: 0xe25151,
    hpBarBg: 0x112615,
    hpEdge: 0x47975b,
    hpText: "#ddffdf",
    hpFill: 0x4fd16b,
    textStroke: "#101820"
  };
  const bg = scene.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x0e1828, 0.88);
  bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.66);
  bg.setDepth(panelDepth);
  const titleText = scene.add.text(contentX, titleY, t("planning.hud.combatPowerHp"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 6 : 7, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(textDepth);
  const leftHud = createPlanningTeamStatusSideHud(
    scene,
    contentX,
    contentTop,
    contentW,
    groupH,
    compact,
    "PHE TA",
    sharedColors
  );
  const rightHud = createPlanningTeamStatusSideHud(
    scene,
    contentX,
    contentTop + groupH + groupGap,
    contentW,
    groupH,
    compact,
    t("planning.combat.enemySide"),
    sharedColors
  );

  scene.planningTeamStatusHud = {
    bg,
    titleText,
    left: leftHud,
    right: rightHud,
    elements: [
      bg,
      titleText,
      ...leftHud.elements,
      ...rightHud.elements
    ],
    panelX,
    panelY,
    panelW,
    panelH
  };

  [leftHud, rightHud].forEach((sideHud) => {
    (sideHud.card as Phaser.GameObjects.Rectangle & { setDepth?: (v: number) => unknown }).setDepth?.(textDepth - 1);
    (sideHud.labelText as Phaser.GameObjects.Text & { setDepth?: (v: number) => unknown }).setDepth?.(textDepth);
    [sideHud.powerRow, sideHud.hpRow].forEach((row) => {
      (row.tagText as Phaser.GameObjects.Text & { setDepth?: (v: number) => unknown }).setDepth?.(textDepth);
      (row.valueText as Phaser.GameObjects.Text & { setDepth?: (v: number) => unknown }).setDepth?.(textDepth);
      (row.barBg as Phaser.GameObjects.Rectangle & { setDepth?: (v: number) => unknown }).setDepth?.(textDepth);
      (row.barFill as Phaser.GameObjects.Rectangle & { setDepth?: (v: number) => unknown }).setDepth?.(barDepth);
    });
  });
}

function createPlanningSynergyPanel(scene: PlanningHudSceneLike, layout: PlanningHudLayout): void {
  const sideW = layout.sidePanelW;
  const sideH = layout.sidePanelH;
  const sideX = layout.leftSidePanelX;
  const sideY = layout.sidePanelY;

  const synergyBg = scene.add.rectangle(sideX + sideW / 2, sideY + sideH / 2, sideW, sideH, 0x0e1828, 0.85);
  synergyBg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.6);
  synergyBg.setDepth(1800);

  scene.synergyTitleText = scene.add.text(sideX + 12, sideY + 10, t("planning.hud.activeSynergy"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 12, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2000);
  scene.synergyText = scene.add.text(sideX + 12, sideY + 34, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, 12, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene, 4, "spacing"),
    wordWrap: { width: sideW - 24 }
  }).setDepth(2000);
  scene.synergyText.setFixedSize(sideW - 24, sideH - 44);
  scene.synergyText.setInteractive({ useHandCursor: true });
  scene.tooltip.attach(scene.synergyText, () => getPlanningSynergyTooltip(scene));
}

function createPlanningUnitInfoPanel(scene: PlanningHudSceneLike, layout: PlanningHudLayout): void {
  const panelX = layout.leftSidePanelX;
  const panelY = layout.leftUnitInfoPanelY;
  const panelW = layout.sidePanelW;
  const panelH = layout.leftUnitInfoPanelH;
  const compact = layout.compactHud === true;
  const pad = compact ? 10 : 12;
  const bodyX = panelX + pad;
  const footerReserve = compact ? 20 : 24;
  const headerY = panelY + (compact ? 8 : 10);
  const titleBlockH = compact ? 14 : 16;
  const portraitY = headerY + titleBlockH + (compact ? 4 : 6);
  const badgeRowH = compact ? 16 : 18;
  const badgeRowGap = compact ? 3 : 4;
  const badgeGap = compact ? 3 : 4;
  const portraitGapBelow = compact ? 4 : 5;
  const portraitMax = compact ? 44 : 52;
  const portraitFloor = compact ? 32 : 36;
  const metricBarH = compact ? 16 : 18;
  const metricBarGap = compact ? 3 : 4;
  const metricBlockH = metricBarH * 2 + metricBarGap;
  const badgeBlockH = badgeRowH * UNIT_INFO_BADGE_ROWS.length + badgeRowGap * (UNIT_INFO_BADGE_ROWS.length - 1);
  const belowPortraitNeed = metricBlockH + portraitGapBelow + badgeBlockH + 4;
  const nameLineH = compact ? 16 : 18;
  const portraitBudget = panelH - (portraitY - panelY) - belowPortraitNeed - footerReserve;
  const portraitSize = Math.min(portraitMax, Math.max(portraitFloor, nameLineH + 4, portraitBudget));
  const contentRight = panelX + panelW - pad;
  const textX = bodyX + portraitSize + (compact ? 8 : 10);
  const textW = Math.max(72, contentRight - textX);
  const nameY = portraitY + Math.max(0, Math.floor((portraitSize - nameLineH) / 2));
  const metricRowW = panelW - pad * 2;
  const heroBottom = portraitY + portraitSize;
  const hpBarCenterY = heroBottom + metricBarGap + metricBarH / 2;
  const rageBarCenterY = hpBarCenterY + metricBarH / 2 + metricBarGap + metricBarH / 2;
  const badgeRowY = rageBarCenterY + metricBarH / 2 + portraitGapBelow;
  const badgeRowW = metricRowW;
  const suggestGapBelowBadge = compact ? 6 : 8;
  const suggestY = badgeRowY + badgeBlockH + suggestGapBelowBadge;
  const footerY = panelY + panelH - (compact ? 16 : 18);
  const contentViewportY = portraitY;
  const contentViewportBottom = panelY + panelH - footerReserve;
  const contentViewportH = Math.max(0, contentViewportBottom - contentViewportY);
  const suggestAreaTop = suggestY + (compact ? 14 : 16);
  const suggestAreaBottom = contentViewportBottom;
  const suggestAreaH = Math.max(compact ? 24 : 40, suggestAreaBottom - suggestAreaTop);
  const sectionGap = compact ? 12 : 14;
  const sectionTitleH = compact ? 14 : 16;
  const perSectionH = Math.max(16, Math.floor((suggestAreaH - sectionGap - sectionTitleH * 2) / 2));

  const bg = scene.add.rectangle(panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x0e1828, 0.88);
  bg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.66);
  bg.setDepth(1800);

  const titleText = scene.add.text(bodyX, headerY, t("planning.hud.unitInfo"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 11 : 12, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2000);

  const portraitBg = scene.add.rectangle(
    bodyX + portraitSize / 2,
    portraitY + portraitSize / 2,
    portraitSize,
    portraitSize,
    0x1b2940,
    0.92
  ).setDepth(2000);
  portraitBg.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.72);

  const portraitText = scene.add.text(bodyX + portraitSize / 2, portraitY + portraitSize / 2 - 2, "?", {
    fontFamily: EMOJI_FONT,
    fontSize: scaleFontPx(scene, compact ? 24 : 30, "title"),
    color: UI_COLORS.textPrimary
  }).setOrigin(0.5).setDepth(2001);

  const nameText = scene.add.text(textX, nameY, t("planning.ui.noBeastSelected"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 13 : 15, "body"),
    color: UI_COLORS.textPrimary,
    fontStyle: "bold",
    wordWrap: { width: textW }
  }).setDepth(2000);
  nameText.setFixedSize(textW, nameLineH);

  const hpBar = createPlanningUnitInfoMetricBar(scene, {
    x: bodyX,
    centerY: hpBarCenterY,
    w: metricRowW,
    h: metricBarH,
    compact,
    tag: t("planning.hud.hp"),
    colors: {
      tagText: "#e85d5d",
      barBg: 0x081018,
      fill: 0x63d47b,
      valueText: UI_COLORS.textPrimary
    }
  });
  const rageBar = createPlanningUnitInfoMetricBar(scene, {
    x: bodyX,
    centerY: rageBarCenterY,
    w: metricRowW,
    h: metricBarH,
    compact,
    tag: t("planning.hud.rage"),
    colors: {
      tagText: "#f0c36e",
      barBg: 0x1a1408,
      fill: 0xf0c36e,
      valueText: "#f0c36e"
    }
  });
  [hpBar, rageBar].forEach((bar) => {
    bar.bg.setVisible(false);
    bar.tagText.setVisible(false);
    bar.barBg.setVisible(false);
    bar.barFill.setVisible(false);
    bar.valueText.setVisible(false);
  });

  const statusBadges = createPlanningUnitInfoBadgeRows(scene, {
    startX: bodyX,
    rowY: badgeRowY,
    rowW: badgeRowW,
    rowH: badgeRowH,
    rowGap: badgeRowGap,
    compact,
    gap: badgeGap,
    rows: UNIT_INFO_BADGE_ROWS
  });
  Object.values(statusBadges).forEach((badge) => {
    badge.bg.setVisible(false);
    badge.text.setVisible(false);
  });

  const t3Title = scene.add.text(bodyX, suggestY, t("planning.hud.t3Suggestions"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 10 : 11, "caption"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2000);
  const t3Text = scene.add.text(bodyX, suggestAreaTop, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 10 : 11, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene, compact ? 2 : 3, "spacing"),
    wordWrap: { width: panelW - pad * 2 }
  }).setDepth(2000);
  t3Text.setFixedSize(panelW - pad * 2, perSectionH);

  const t4Title = scene.add.text(bodyX, suggestAreaTop + perSectionH + sectionGap, t("planning.hud.t4Suggestions"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 10 : 11, "caption"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  }).setDepth(2000);
  const t4Text = scene.add.text(bodyX, suggestAreaTop + perSectionH + sectionGap + sectionTitleH, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 10 : 11, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene, compact ? 2 : 3, "spacing"),
    wordWrap: { width: panelW - pad * 2 }
  }).setDepth(2000);
  t4Text.setFixedSize(panelW - pad * 2, perSectionH);

  const suggestionMaskShape = scene.add.graphics();
  suggestionMaskShape.fillStyle(0xffffff, 1);
  suggestionMaskShape.fillRect(bodyX, contentViewportY, panelW - pad * 2, contentViewportH);
  scene.children.remove(suggestionMaskShape);
  const maskedSuggestionItems: SuggestionScrollItem["item"][] = [
    portraitBg,
    portraitText,
    nameText,
    hpBar.bg,
    hpBar.tagText,
    hpBar.barBg,
    hpBar.barFill,
    hpBar.valueText,
    rageBar.bg,
    rageBar.tagText,
    rageBar.barBg,
    rageBar.barFill,
    rageBar.valueText,
    ...Object.values(statusBadges).flatMap((badge) => [badge.bg, badge.text]),
    t3Title,
    t3Text,
    t4Title,
    t4Text
  ];
  const suggestionMask = maskedSuggestionItems.map((item) => {
    (item as SuggestionScrollItem["item"]).enableFilters?.();
    return (item as SuggestionScrollItem["item"]).filters?.external?.addMask(suggestionMaskShape);
  });

  const emptyText = scene.add.text(bodyX, footerY, t("planning.hud.pinHint"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 9 : 10, "caption"),
    color: UI_COLORS.textMuted,
    wordWrap: { width: panelW - pad * 2 }
  }).setOrigin(0, 1).setDepth(2000);

  scene.unitInfoPanel = {
    bg,
    titleText,
    portraitBg,
    portraitText,
    nameText,
    hpBar,
    rageBar,
    hpBarW: hpBar.barW,
    statusBadges,
    t3Title,
    t3Text,
    t4Title,
    t4Text,
    suggestionMaskShape,
    suggestionMask,
    suggestionViewport: {
      x: bodyX,
      y: contentViewportY,
      w: panelW - pad * 2,
      h: contentViewportH
    },
    suggestionScrollItems: [
      { item: portraitBg, baseY: portraitY + portraitSize / 2 },
      { item: portraitText, baseY: portraitY + portraitSize / 2 - 2 },
      { item: nameText, baseY: nameY },
      { item: hpBar.bg, baseY: hpBar.centerY },
      { item: hpBar.tagText, baseY: hpBar.centerY },
      { item: hpBar.barBg, baseY: hpBar.centerY },
      { item: hpBar.barFill, baseY: hpBar.centerY },
      { item: hpBar.valueText, baseY: hpBar.centerY },
      { item: rageBar.bg, baseY: rageBar.centerY },
      { item: rageBar.tagText, baseY: rageBar.centerY },
      { item: rageBar.barBg, baseY: rageBar.centerY },
      { item: rageBar.barFill, baseY: rageBar.centerY },
      { item: rageBar.valueText, baseY: rageBar.centerY },
      ...Object.values(statusBadges).flatMap((badge) => [
        { item: badge.bg, baseY: badge.centerY },
        { item: badge.text, baseY: badge.centerY }
      ]),
      { item: t3Title, baseY: suggestY },
      { item: t3Text, baseY: suggestAreaTop },
      { item: t4Title, baseY: suggestAreaTop + perSectionH + sectionGap },
      { item: t4Text, baseY: suggestAreaTop + perSectionH + sectionGap + sectionTitleH }
    ],
    suggestionScrollOffset: 0,
    suggestionMaxScroll: 0,
    emptyText,
    portraitAnchor: {
      x: bodyX + portraitSize / 2,
      y: portraitY + portraitSize / 2 + 4
    },
    portraitScale: compact ? 0.56 : 0.68,
    suggestionLineLimit: compact ? 1 : 2
  };
}

export function createPlanningHud(scene: PlanningHudSceneLike): void {
  const layout = scene.layout;
  const compact = layout.compactHud === true;
  const topHeaderMetrics = computePlanningTopHeaderMetrics(layout);
  const screenOverlay = scene.add.rectangle(layout.width / 2, layout.height / 2, layout.width, layout.height, UI_COLORS.screenOverlay, 0.36);
  screenOverlay.setDepth(-30);

  const topPanel = scene.add.rectangle(
    layout.boardPanelX + layout.boardPanelW / 2,
    layout.topPanelY + layout.topPanelH / 2,
    layout.boardPanelW,
    layout.topPanelH,
    UI_COLORS.panelSoft,
    0.88
  );
  topPanel.setStrokeStyle(1, UI_COLORS.panelEdge, 0.75);
  topPanel.setDepth(1800);

  const boardPanel = scene.add.rectangle(
    layout.boardPanelX + layout.boardPanelW / 2,
    layout.boardPanelY + layout.boardPanelH / 2,
    layout.boardPanelW,
    layout.boardPanelH,
    UI_COLORS.panel,
    0.5
  );
  boardPanel.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.75);
  boardPanel.setDepth(-12);

  scene.titleText = scene.add.text(topHeaderMetrics.titleX, topHeaderMetrics.titleY, t("planning.hud.title"), {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 21 : 24, "title"),
    color: UI_COLORS.textPrimary,
    fontStyle: "bold"
  }).setDepth(2000);

  scene.ruleText = null;

  scene.headerMetaText = scene.add.text(topHeaderMetrics.titleX, topHeaderMetrics.titleY, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene, compact ? 12 : 13, "body"),
    color: UI_COLORS.textMuted,
    align: "left"
  }).setOrigin(0, 0).setDepth(2000);
  scene.relayoutTopHeaderMeta = () => layoutPlanningHeaderMeta(scene.titleText, scene.headerMetaText, scene.layout);
  scene.relayoutTopHeaderMeta();

  createPlanningStatChips(scene, layout);
  createPlanningTeamStatusStrip(scene, layout);
  createPlanningSynergyPanel(scene, layout);
  createPlanningUnitInfoPanel(scene, layout);
  createPlanningStorageSpace(scene as unknown as Parameters<typeof createPlanningStorageSpace>[0]);
}
