/**
 * ThreeCombatHudRuntime.ts
 *
 * Combat HUD layout, team status calculations, top-right utility buttons,
 * and popup card bounds for Three.js.
 */

import { getMinTouchTarget, scaleFontPx, scaleUiSize } from "./ThreeUiResponsive.js";
import { UI_COLORS, UI_FONT, UI_SPACING } from "../core/uiTheme.js";
import {
  getCombatBubbleButtonLabel,
  getUtilityLibraryButtonLabel,
  getUtilitySettingsButtonLabel
} from "../ui/buttonEmojiLabels.js";

type AnyObj = Record<string, unknown>;

export interface CombatHudLayout {
  width: number;
  height: number;
  boardPanelX: number;
  boardPanelY: number;
  boardPanelW: number;
  boardPanelH: number;
  topPanelY: number;
  topPanelH: number;
  rightPanelX: number;
  sidePanelY: number;
  sidePanelW: number;
  sidePanelH: number;
  [key: string]: unknown;
}

export type CombatSide = "LEFT" | "RIGHT";

export interface CombatUnitLike {
  side?: CombatSide | string;
  alive?: boolean;
  hp?: number;
  maxHp?: number;
  shield?: number;
  atk?: number;
  matk?: number;
  def?: number;
  mdef?: number;
  star?: number;
  tier?: number;
  powerValue?: number;
  [key: string]: unknown;
}

export type PowerResolver = (unit: CombatUnitLike) => number;

export interface BuildTeamStatusOptions {
  resolveUnitPower?: PowerResolver;
  resolveUnitPowerMax?: PowerResolver;
}

export interface TeamStatusResult {
  unitCount: number;
  hpCurrent: number;
  hpMax: number;
  hpRatio: number;
  power: number;
  powerMax: number;
  powerRatio: number;
}

export interface MetricRowColors {
  tagText?: string;
  barBg?: number;
  barEdge?: number;
  fill?: number;
  valueText?: string;
  textStroke?: string;
}

export interface MetricRowArgs {
  x: number;
  centerY: number;
  w: number;
  tag: string;
  barH: number;
  colors?: MetricRowColors;
}

export interface MetricRowResult {
  tagText: AnyObj;
  barBg: AnyObj;
  barFill: AnyObj;
  valueText: AnyObj;
  barW: number;
  barFillH: number;
  centerY: number;
}

export interface TeamHudColors {
  edge?: number;
  barBg?: number;
  fill?: number;
  powerText?: string;
  powerBarBg?: number;
  powerEdge?: number;
  powerFill?: number;
  hpText?: string;
  hpBarBg?: number;
  hpEdge?: number;
  hpFill?: number;
  textStroke?: string;
}

export interface TeamStatusHudResult {
  panel: AnyObj;
  powerRow: MetricRowResult;
  hpRow: MetricRowResult;
  powerText: AnyObj;
  hpText: AnyObj;
  powerBarBg: AnyObj;
  powerBarFill: AnyObj;
  hpBarBg: AnyObj;
  hpBarFill: AnyObj;
  elements: AnyObj[];
  barW: number;
  cardH: number;
}

export interface CombinedTeamStatusHudResult extends TeamStatusHudResult {
  badgeBg: AnyObj;
  badgeText: AnyObj;
  left: TeamStatusHudResult;
  right: TeamStatusHudResult;
}

export interface HudCardLayout {
  compact: boolean;
  showRemoteMatchCard: boolean;
  startY: number;
  cardGap: number;
  phaseCardH: number;
  synergyCardH: number;
  enemyCardH: number;
  remoteMatchCardH: number;
  logCardH: number;
  logPreviewMaxLines: number;
  queuePreviewLimit: number;
}

export interface TopRightButtonSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fontSize: number;
}

export interface TopRightButtonLayout {
  compact: boolean;
  gap: number;
  totalWidth: number;
  buttons: {
    bubbles: TopRightButtonSpec;
    wiki: TopRightButtonSpec;
    settings: TopRightButtonSpec;
  };
}

export interface BubblePopupBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
  right: number;
  bottom: number;
}

export interface HudCardOptions {
  includeRemoteMatch?: boolean;
}

export interface CombatSceneLike {
  layout: CombatHudLayout;
  gameModeConfig?: { id?: string };
  combatHudConfig?: HudCardLayout;
  compactCombatSideHud?: boolean;
  logPreviewMaxLines?: number;
  queuePreviewLimit?: number;
  remoteMatchHudElements?: AnyObj[];
  remoteMatchCard?: AnyObj | null;
  remoteMatchTitleText?: AnyObj | null;
  remoteMatchPairText?: AnyObj | null;
  remoteMatchSideAText?: AnyObj | null;
  remoteMatchSideBText?: AnyObj | null;
  remoteMatchProgressText?: AnyObj | null;
  remoteMatchFreshnessText?: AnyObj | null;
  teamStatusHud?: CombinedTeamStatusHudResult | null;
  rightPanelArea?: { x: number; y: number; w: number; h: number };
  titleText?: AnyObj | null;
  ruleText?: AnyObj | null;
  headerText?: AnyObj | null;
  combatRoundLabel?: AnyObj | null;
  phaseTitleText?: AnyObj | null;
  phaseText?: AnyObj | null;
  synergyTitleText?: AnyObj | null;
  synergyText?: AnyObj | null;
  enemyTitleText?: AnyObj | null;
  queueText?: AnyObj | null;
  logTitleText?: AnyObj | null;
  logText?: AnyObj | null;
  historyButtonRect?: { x: number; y: number; w: number; h: number };
  tooltip?: { attach: (target: unknown, fn: () => unknown) => unknown };
  getSynergyTooltip?: () => unknown;
  add: {
    rectangle: (x: number, y: number, w: number, h: number, color?: number, alpha?: number) => AnyObj;
    text: (x: number, y: number, text: string, style?: AnyObj) => AnyObj;
    container?: (x?: number, y?: number) => AnyObj;
  };
  [key: string]: unknown;
}

function createSideCard(
  scene: CombatSceneLike,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number = UI_COLORS.panelEdgeSoft
): AnyObj {
  const card = scene.add.rectangle(x + w / 2, y + h / 2, w, h, UI_COLORS.panel, 0.72);
  if (typeof card.setStrokeStyle === "function") card.setStrokeStyle(1, accent, 0.58);
  if (typeof card.setDepth === "function") card.setDepth(1890);
  return card;
}

function readNumericStat(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function defaultCombatPowerResolver(unit: CombatUnitLike): number {
  if (!unit?.alive) return 0;
  if (Number.isFinite(Number(unit.powerValue))) return Number(unit.powerValue);
  const hp = Math.max(0, readNumericStat(unit.hp));
  const shield = Math.max(0, readNumericStat(unit.shield));
  const atk = Math.max(0, readNumericStat(unit.atk));
  const matk = Math.max(0, readNumericStat(unit.matk));
  const def = Math.max(0, readNumericStat(unit.def));
  const mdef = Math.max(0, readNumericStat(unit.mdef));
  const star = Math.max(1, readNumericStat(unit.star) || 1);
  const tier = Math.max(1, readNumericStat(unit.tier) || 1);
  return Math.max(0, Math.round(
    hp * 0.45
    + shield * 0.2
    + atk * 6
    + matk * 6
    + def * 4
    + mdef * 4
    + star * 90
    + tier * 40
  ));
}

function defaultCombatPowerMaxResolver(unit: CombatUnitLike | null | undefined): number {
  if (!unit) return 0;
  if (Number.isFinite(Number(unit.powerValue))) return Number(unit.powerValue);
  const hp = Math.max(0, readNumericStat(unit.maxHp ?? unit.hp));
  const atk = Math.max(0, readNumericStat(unit.atk));
  const matk = Math.max(0, readNumericStat(unit.matk));
  const def = Math.max(0, readNumericStat(unit.def));
  const mdef = Math.max(0, readNumericStat(unit.mdef));
  const star = Math.max(1, readNumericStat(unit.star) || 1);
  const tier = Math.max(1, readNumericStat(unit.tier) || 1);
  return Math.max(0, Math.round(
    hp * 0.45
    + atk * 6
    + matk * 6
    + def * 4
    + mdef * 4
    + star * 90
    + tier * 40
  ));
}

function buildTeamStatusForSide(
  combatUnits: CombatUnitLike[],
  side: CombatSide,
  resolveUnitPower: PowerResolver,
  resolveUnitPowerMax: PowerResolver
): TeamStatusResult {
  const sideUnits = combatUnits.filter((unit) => unit?.side === side);
  const hpCurrent = sideUnits.reduce((total: number, unit) => total + Math.max(0, readNumericStat(unit?.alive ? unit.hp : 0)), 0);
  const hpMax = sideUnits.reduce((total: number, unit) => total + Math.max(0, readNumericStat(unit?.maxHp)), 0);
  const power = sideUnits.reduce((total: number, unit) => total + Math.max(0, readNumericStat(resolveUnitPower(unit))), 0);
  const powerMax = sideUnits.reduce((total: number, unit) => total + Math.max(0, readNumericStat(resolveUnitPowerMax(unit))), 0);
  return {
    unitCount: sideUnits.length,
    hpCurrent: Math.max(0, Math.round(hpCurrent)),
    hpMax: Math.max(0, Math.round(hpMax)),
    hpRatio: hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0,
    power: Math.max(0, Math.round(power)),
    powerMax: Math.max(0, Math.round(powerMax)),
    powerRatio: powerMax > 0 ? Math.max(0, Math.min(1, power / powerMax)) : 0
  };
}

export function buildCombatTeamStatusModel(
  combatUnits: CombatUnitLike[] = [],
  options: BuildTeamStatusOptions = {}
): { left: TeamStatusResult; right: TeamStatusResult } {
  const units = Array.isArray(combatUnits) ? combatUnits : [];
  const resolveUnitPower: PowerResolver = typeof options.resolveUnitPower === "function"
    ? options.resolveUnitPower
    : defaultCombatPowerResolver;
  const resolveUnitPowerMax: PowerResolver = typeof options.resolveUnitPowerMax === "function"
    ? options.resolveUnitPowerMax
    : (typeof options.resolveUnitPower === "function" ? resolveUnitPower : defaultCombatPowerMaxResolver);
  return {
    left: buildTeamStatusForSide(units, "LEFT", resolveUnitPower, resolveUnitPowerMax),
    right: buildTeamStatusForSide(units, "RIGHT", resolveUnitPower, resolveUnitPowerMax)
  };
}

function createCombatTeamStatusMetricRow(
  scene: CombatSceneLike,
  { x, centerY, w, tag, barH, colors = {} }: MetricRowArgs
): MetricRowResult {
  const edgePad = 8;
  const tagW = 26;
  const valueReserve = 58;
  const valueGap = 4;
  const barFillH = Math.max(4, barH - 4);
  const fontSize = scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 11, "caption");
  const barX = x + edgePad + tagW + 4;
  const barRightX = x + w - edgePad - valueReserve - valueGap;
  const barW = Math.max(24, barRightX - barX);

  const tagText = scene.add.text(x + edgePad, centerY, tag, {
    fontFamily: UI_FONT,
    fontSize,
    color: colors.tagText ?? UI_COLORS.textSecondary,
    fontStyle: "bold"
  });
  if (typeof tagText.setOrigin === "function") tagText.setOrigin(0, 0.5);
  if (typeof tagText.setDepth === "function") tagText.setDepth(2000);
  if (typeof (tagText as { setStroke?: (c: string, t: number) => unknown }).setStroke === "function") {
    (tagText as { setStroke: (c: string, t: number) => unknown }).setStroke(colors.textStroke ?? "#08121d", 3);
  }

  const barBg = scene.add.rectangle(barX + barW / 2, centerY, barW, barH, colors.barBg ?? 0x112615, 0.96);
  if (typeof barBg.setDepth === "function") barBg.setDepth(1995);
  if (typeof barBg.setStrokeStyle === "function") barBg.setStrokeStyle(1, colors.barEdge ?? UI_COLORS.panelEdgeSoft, 0.88);

  const barFill = scene.add.rectangle(barX, centerY, barW, barFillH, colors.fill ?? UI_COLORS.accent, 0.98);
  if (typeof barFill.setOrigin === "function") barFill.setOrigin(0, 0.5);
  if (typeof barFill.setDepth === "function") barFill.setDepth(1996);

  const valueText = scene.add.text(x + w - edgePad, centerY, "0 / 0", {
    fontFamily: UI_FONT,
    fontSize,
    color: colors.valueText ?? UI_COLORS.textPrimary,
    fontStyle: "bold"
  });
  if (typeof valueText.setOrigin === "function") valueText.setOrigin(1, 0.5);
  if (typeof valueText.setDepth === "function") valueText.setDepth(2000);
  if (typeof (valueText as { setStroke?: (c: string, t: number) => unknown }).setStroke === "function") {
    (valueText as { setStroke: (c: string, t: number) => unknown }).setStroke(colors.textStroke ?? "#08121d", 3);
  }

  return { tagText, barBg, barFill, valueText, barW, barFillH, centerY };
}

function createTeamStatusHud(
  scene: CombatSceneLike,
  x: number,
  y: number,
  groupW: number,
  barH: number,
  colors: TeamHudColors = {}
): TeamStatusHudResult {
  const safeGroupW = Math.max(120, groupW);
  const marginX = 10;
  const rowGap = 8;
  const rowH = Math.max(16, barH + 2);
  const innerW = safeGroupW - marginX * 2;
  const powerCenterY = y + rowH / 2;
  const hpCenterY = powerCenterY + rowH + rowGap;
  const cardH = Math.max(40, rowH * 2 + rowGap + 14);
  const panel = scene.add.rectangle(x + safeGroupW / 2, y + cardH / 2, safeGroupW, cardH, 0x0b1724, 0.48);
  if (typeof panel.setStrokeStyle === "function") panel.setStrokeStyle(1, colors.edge ?? UI_COLORS.panelEdgeSoft, 0.78);
  if (typeof panel.setDepth === "function") panel.setDepth(1990);

  const powerRow = createCombatTeamStatusMetricRow(scene, {
    x: x + marginX,
    centerY: powerCenterY,
    w: innerW,
    tag: "LC",
    barH,
    colors: {
      tagText: colors.powerText ?? "#ffd3d3",
      barBg: colors.powerBarBg ?? colors.barBg ?? 0x2a1113,
      barEdge: colors.powerEdge ?? colors.edge ?? UI_COLORS.panelEdgeSoft,
      fill: colors.powerFill ?? colors.fill ?? UI_COLORS.accent,
      valueText: colors.powerText ?? "#ffd3d3",
      textStroke: colors.textStroke
    }
  });

  const hpRow = createCombatTeamStatusMetricRow(scene, {
    x: x + marginX,
    centerY: hpCenterY,
    w: innerW,
    tag: "HP",
    barH,
    colors: {
      tagText: colors.hpText ?? "#d9ffe2",
      barBg: colors.hpBarBg ?? 0x112615,
      barEdge: colors.hpEdge ?? colors.edge ?? UI_COLORS.panelEdgeSoft,
      fill: colors.hpFill ?? UI_COLORS.accent,
      valueText: colors.hpText ?? "#d9ffe2",
      textStroke: colors.textStroke
    }
  });

  return {
    panel,
    powerRow,
    hpRow,
    powerText: powerRow.valueText,
    hpText: hpRow.valueText,
    powerBarBg: powerRow.barBg,
    powerBarFill: powerRow.barFill,
    hpBarBg: hpRow.barBg,
    hpBarFill: hpRow.barFill,
    elements: [
      panel,
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
    cardH
  };
}

export function getCombatHudCardLayout(
  layout: CombatHudLayout,
  { includeRemoteMatch = false }: HudCardOptions = {}
): HudCardLayout {
  const panelBottom = (layout.sidePanelY as number) + (layout.sidePanelH as number) - UI_SPACING.SM;
  if (!includeRemoteMatch) {
    const startY = (layout.sidePanelY as number) + UI_SPACING.SM + 42;
    const cardGap = UI_SPACING.SM;
    const phaseCardH = 108;
    const synergyCardH = 160;
    const enemyCardH = 134;
    const logCardH = Math.max(190, panelBottom - (startY + phaseCardH + synergyCardH + enemyCardH + cardGap * 3));
    return {
      compact: false,
      showRemoteMatchCard: false,
      startY,
      cardGap,
      phaseCardH,
      synergyCardH,
      enemyCardH,
      remoteMatchCardH: 0,
      logCardH,
      logPreviewMaxLines: 4,
      queuePreviewLimit: 8
    };
  }

  const compact = (layout.height as number) <= 840 || (layout.sidePanelH as number) <= 640;
  const startY = compact
    ? (layout.sidePanelY as number) + UI_SPACING.SM
    : (layout.sidePanelY as number) + UI_SPACING.SM + 18;
  const cardGap = compact ? 12 : UI_SPACING.SM;
  const phaseCardH = compact ? 82 : 96;
  const synergyCardH = compact ? 92 : 132;
  const enemyCardH = compact ? 84 : 108;
  const remoteMatchCardH = compact ? 104 : 120;
  const logCardH = Math.max(
    compact ? 112 : 148,
    panelBottom - (startY + phaseCardH + synergyCardH + enemyCardH + remoteMatchCardH + cardGap * 4)
  );
  return {
    compact,
    showRemoteMatchCard: true,
    startY,
    cardGap,
    phaseCardH,
    synergyCardH,
    enemyCardH,
    remoteMatchCardH,
    logCardH,
    logPreviewMaxLines: compact ? 3 : 4,
    queuePreviewLimit: compact ? 3 : 8
  };
}

export function getCombatTopRightButtonLayout(layout: CombatHudLayout, scene?: unknown): TopRightButtonLayout {
  const panelW = layout.sidePanelW as number;
  const compact = panelW <= 320;
  const isNarrow = panelW < 270;
  const gap = isNarrow ? 4 : (compact ? 6 : 8);
  const top = (layout.topPanelY as number) + 8;
  const rightPad = isNarrow ? 4 : 16;
  const leftPad = isNarrow ? 4 : 0;
  const right = (layout.rightPanelX as number) + panelW - rightPad;
  const targetScene = scene ?? { scale: { width: layout.width, height: layout.height } };
  const minTarget = getMinTouchTarget(targetScene as Parameters<typeof getMinTouchTarget>[0]);
  let btnBubblesW = compact ? 88 : 116;
  let btnWikiW = compact ? 80 : 104;
  let btnSettingsW = compact ? 86 : 108;
  let buttonHeight = isNarrow ? minTarget : 34;
  let fontSize = compact ? 12 : 14;

  const defaultTotalWidth = btnBubblesW + btnWikiW + btnSettingsW + gap * 2;
  const availableWidth = panelW - rightPad - leftPad;
  const stacked = isNarrow || (compact && availableWidth < (minTarget * 3 + gap * 2));

  if (stacked) {
    const buttonWidth = Math.max(minTarget, availableWidth);
    btnBubblesW = buttonWidth;
    btnWikiW = buttonWidth;
    btnSettingsW = buttonWidth;
    buttonHeight = minTarget;
    fontSize = 12;
  }
  const buttons = [
    {
      key: "bubbles",
      label: getCombatBubbleButtonLabel(),
      width: btnBubblesW,
      fontSize
    },
    {
      key: "wiki",
      label: getUtilityLibraryButtonLabel(),
      width: btnWikiW,
      fontSize
    },
    {
      key: "settings",
      label: getUtilitySettingsButtonLabel(),
      width: btnSettingsW,
      fontSize
    }
  ];
  const totalWidth = stacked
    ? Math.max(...buttons.map((button) => button.width))
    : buttons.reduce((sum, button) => sum + button.width, 0) + gap * (buttons.length - 1);
  let cursorX = stacked
    ? (layout.rightPanelX as number) + leftPad + Math.max(0, (availableWidth - totalWidth) / 2)
    : right - totalWidth;
  if (cursorX < (layout.rightPanelX as number) + leftPad) {
    cursorX = (layout.rightPanelX as number) + leftPad;
  }
  const byKey: Record<string, TopRightButtonSpec> = {};

  buttons.forEach((button, index) => {
    byKey[button.key] = {
      x: cursorX,
      y: top + (stacked ? index * (buttonHeight + gap) : 0),
      w: button.width,
      h: buttonHeight,
      label: button.label,
      fontSize: button.fontSize
    };
    if (!stacked) cursorX += button.width + gap;
  });

  return {
    compact,
    gap,
    totalWidth,
    buttons: {
      bubbles: byKey.bubbles,
      wiki: byKey.wiki,
      settings: byKey.settings
    }
  };
}

export function getCombatBubblePopupBounds(layout: CombatHudLayout): BubblePopupBounds {
  const w = (layout.sidePanelW as number) - 24;
  const h = Math.min(340, (layout.sidePanelH as number) - 40);
  const x = (layout.rightPanelX as number) + 12;
  const y = (layout.sidePanelY as number) + 16;

  return {
    x,
    y,
    w,
    h,
    centerX: x + w / 2,
    centerY: y + h / 2,
    right: x + w,
    bottom: y + h
  };
}

export function createCombatHud(scene: CombatSceneLike): void {
  const layout = scene.layout;
  const showRemoteMatchCard = scene.gameModeConfig?.id === "PVP4Fortress";
  const hudLayout = getCombatHudCardLayout(layout, { includeRemoteMatch: showRemoteMatchCard });
  scene.combatHudConfig = hudLayout;
  scene.compactCombatSideHud = hudLayout.compact;
  scene.logPreviewMaxLines = hudLayout.logPreviewMaxLines;
  scene.queuePreviewLimit = hudLayout.queuePreviewLimit;
  scene.remoteMatchHudElements = [];
  scene.remoteMatchCard = null;
  scene.remoteMatchTitleText = null;
  scene.remoteMatchPairText = null;
  scene.remoteMatchSideAText = null;
  scene.remoteMatchSideBText = null;
  scene.remoteMatchProgressText = null;
  scene.remoteMatchFreshnessText = null;
  scene.teamStatusHud = null;

  const screenOverlay = scene.add.rectangle(
    layout.width / 2,
    layout.height / 2,
    layout.width,
    layout.height,
    UI_COLORS.screenOverlay,
    0.36
  );
  if (typeof screenOverlay.setDepth === "function") screenOverlay.setDepth(-30);

  const topPanel = scene.add.rectangle(
    (layout.boardPanelX as number) + (layout.boardPanelW as number) / 2,
    (layout.topPanelY as number) + (layout.topPanelH as number) / 2,
    layout.boardPanelW as number,
    layout.topPanelH as number,
    UI_COLORS.panelSoft,
    0.88
  );
  if (typeof topPanel.setStrokeStyle === "function") topPanel.setStrokeStyle(1, UI_COLORS.panelEdge, 0.75);
  if (typeof topPanel.setDepth === "function") topPanel.setDepth(1800);

  const boardPanel = scene.add.rectangle(
    (layout.boardPanelX as number) + (layout.boardPanelW as number) / 2,
    (layout.boardPanelY as number) + (layout.boardPanelH as number) / 2,
    layout.boardPanelW as number,
    layout.boardPanelH as number,
    UI_COLORS.panel,
    0.5
  );
  if (typeof boardPanel.setStrokeStyle === "function") boardPanel.setStrokeStyle(1, UI_COLORS.panelEdgeSoft, 0.75);
  if (typeof boardPanel.setDepth === "function") boardPanel.setDepth(-12);

  const rightPanel = scene.add.rectangle(
    (layout.rightPanelX as number) + (layout.sidePanelW as number) / 2,
    (layout.sidePanelY as number) + (layout.sidePanelH as number) / 2,
    layout.sidePanelW as number,
    layout.sidePanelH as number,
    UI_COLORS.panelSoft,
    0.9
  );
  if (typeof rightPanel.setStrokeStyle === "function") rightPanel.setStrokeStyle(1, UI_COLORS.panelEdge, 0.72);
  if (typeof rightPanel.setDepth === "function") rightPanel.setDepth(1800);

  scene.rightPanelArea = {
    x: layout.rightPanelX as number,
    y: layout.sidePanelY as number,
    w: layout.sidePanelW as number,
    h: layout.sidePanelH as number
  };

  scene.titleText = scene.add.text(
    (layout.boardPanelX as number) + UI_SPACING.SM,
    (layout.topPanelY as number) + UI_SPACING.SM - 2,
    "BÁ CHỦ KHU RỪNG",
    {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 24, "title"),
      color: UI_COLORS.textPrimary,
      fontStyle: "bold"
    }
  );
  if (typeof scene.titleText?.setDepth === "function") scene.titleText.setDepth(2000);

  const titleReserveW = Math.max(170, Math.round(((scene.titleText as { width?: number })?.width ?? 160) + 28));
  const badgeW = Math.max(42, scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 54, "control"));
  const badgeH = Math.max(26, scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 34, "control"));
  const badgeGap = 14;
  const groupW = Math.max(
    132,
    Math.min(
      210,
      Math.floor(((layout.boardPanelW as number) - titleReserveW - badgeW - badgeGap * 2 - UI_SPACING.SM * 2) / 2)
    )
  );
  const statusY = (layout.topPanelY as number) + 12;
  const statusRightEdge = (layout.boardPanelX as number) + (layout.boardPanelW as number) - Math.max(10, Math.round(UI_SPACING.SM * 0.65));
  const statusGroupW = groupW * 2 + badgeW + badgeGap * 2;
  const statusStartX = Math.max((layout.boardPanelX as number) + titleReserveW + UI_SPACING.SM, statusRightEdge - statusGroupW);
  const leftGroupX = statusStartX;
  const badgeCenterX = statusStartX + groupW + badgeGap + badgeW / 2;
  const rightGroupX = statusStartX + groupW + badgeGap * 2 + badgeW;
  const textStartX = (layout.boardPanelX as number) + UI_SPACING.SM;
  const textMaxW = Math.max(260, statusStartX - textStartX - 24);
  const barH = Math.max(12, scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 14, "control"));

  const leftHud = createTeamStatusHud(scene, leftGroupX, statusY, groupW, barH, {
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
  });

  const rightHud = createTeamStatusHud(scene, rightGroupX, statusY, groupW, barH, {
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
  });

  const badgeCenterY = statusY + leftHud.cardH / 2;
  const badgeBg = scene.add.rectangle(badgeCenterX, badgeCenterY, badgeW, badgeH, 0x233447, 0.96);
  if (typeof badgeBg.setDepth === "function") badgeBg.setDepth(1994);
  if (typeof badgeBg.setStrokeStyle === "function") badgeBg.setStrokeStyle(2, 0x6a7e92, 0.84);

  const badgeText = scene.add.text(badgeCenterX, badgeCenterY, "VS", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 14, "body"),
    color: "#ffd97b",
    fontStyle: "bold"
  });
  if (typeof badgeText.setOrigin === "function") badgeText.setOrigin(0.5, 0.5);
  if (typeof badgeText.setDepth === "function") badgeText.setDepth(2000);
  if (typeof (badgeText as { setStroke?: (c: string, t: number) => unknown }).setStroke === "function") {
    (badgeText as { setStroke: (c: string, t: number) => unknown }).setStroke("#152334", 3);
  }

  const statusHud: CombinedTeamStatusHudResult = {
    panel: leftHud.panel,
    powerRow: leftHud.powerRow,
    hpRow: leftHud.hpRow,
    powerText: leftHud.powerText,
    hpText: leftHud.hpText,
    powerBarBg: leftHud.powerBarBg,
    powerBarFill: leftHud.powerBarFill,
    hpBarBg: leftHud.hpBarBg,
    hpBarFill: leftHud.hpBarFill,
    barW: leftHud.barW,
    cardH: leftHud.cardH,
    badgeBg,
    badgeText,
    left: leftHud,
    right: rightHud,
    elements: [
      ...leftHud.elements,
      ...rightHud.elements,
      badgeBg,
      badgeText
    ]
  };
  scene.teamStatusHud = statusHud;

  scene.ruleText = scene.add.text(
    textStartX,
    (layout.topPanelY as number) + UI_SPACING.SM + 30,
    "Luật quét: Ta (E→A, mỗi cột 5→1) | Địch (G→K, mỗi cột 5→1)",
    {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "caption"),
      color: UI_COLORS.textSecondary,
      wordWrap: { width: textMaxW }
    }
  );
  if (typeof scene.ruleText?.setDepth === "function") scene.ruleText.setDepth(2000);
  if (typeof (scene.ruleText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.ruleText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(
      textMaxW,
      scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 18, "control")
    );
  }

  scene.headerText = scene.add.text(
    textStartX,
    (layout.topPanelY as number) + UI_SPACING.SM + 52,
    "",
    {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 14, "body"),
      color: UI_COLORS.textPrimary,
      wordWrap: { width: textMaxW }
    }
  );
  if (typeof scene.headerText?.setDepth === "function") scene.headerText.setDepth(2000);
  if (typeof (scene.headerText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.headerText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(
      textMaxW,
      scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 22, "control")
    );
  }

  scene.combatRoundLabel = scene.add.text(
    (layout.boardPanelX as number) + UI_SPACING.SM,
    (layout.sidePanelY as number) + UI_SPACING.SM,
    "MÔI TRƯỜNG",
    {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 28, "title"),
      fontStyle: "bold",
      color: "#ffd97b",
      stroke: "#1a1a2e",
      strokeThickness: 4
    }
  );
  if (typeof scene.combatRoundLabel?.setDepth === "function") scene.combatRoundLabel.setDepth(2000);

  const rightX = (layout.rightPanelX as number) + UI_SPACING.SM;
  const rightW = (layout.sidePanelW as number) - UI_SPACING.SM * 2;
  const cardPadX = 14;
  const cardContentW = rightW - cardPadX * 2;
  let y = hudLayout.startY;
  const cardGap = hudLayout.cardGap;

  const phaseCardH = hudLayout.phaseCardH;
  createSideCard(scene, rightX, y, rightW, phaseCardH, 0x7a8cc8);
  scene.phaseTitleText = scene.add.text(rightX + cardPadX, y + 10, "◉ PHA", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  });
  if (typeof scene.phaseTitleText?.setDepth === "function") scene.phaseTitleText.setDepth(2000);

  scene.phaseText = scene.add.text(rightX + cardPadX, y + 34, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 14, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 4, "spacing"),
    wordWrap: { width: cardContentW }
  });
  if (typeof scene.phaseText?.setDepth === "function") scene.phaseText.setDepth(2000);
  if (typeof (scene.phaseText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.phaseText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(cardContentW, phaseCardH - 46);
  }
  y += phaseCardH + cardGap;

  const synergyCardH = hudLayout.synergyCardH;
  createSideCard(scene, rightX, y, rightW, synergyCardH, 0x88b58f);
  scene.synergyTitleText = scene.add.text(rightX + cardPadX, y + 10, "◎ CỘNG HƯỞNG", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  });
  if (typeof scene.synergyTitleText?.setDepth === "function") scene.synergyTitleText.setDepth(2000);

  scene.synergyText = scene.add.text(rightX + cardPadX, y + 34, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 5, "spacing"),
    wordWrap: { width: cardContentW }
  });
  if (typeof scene.synergyText?.setDepth === "function") scene.synergyText.setDepth(2000);
  if (typeof (scene.synergyText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.synergyText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(cardContentW, synergyCardH - 48);
  }
  if (typeof (scene.synergyText as { setInteractive?: (opt: unknown) => unknown })?.setInteractive === "function") {
    (scene.synergyText as { setInteractive: (opt: unknown) => unknown }).setInteractive({ useHandCursor: true });
  }
  scene.tooltip?.attach(scene.synergyText, () => scene.getSynergyTooltip?.());
  y += synergyCardH + cardGap;

  const enemyCardH = hudLayout.enemyCardH;
  createSideCard(scene, rightX, y, rightW, enemyCardH, 0x7e8aa8);
  scene.enemyTitleText = scene.add.text(rightX + cardPadX, y + 10, "◈ THÔNG TIN ĐỊCH", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  });
  if (typeof scene.enemyTitleText?.setDepth === "function") scene.enemyTitleText.setDepth(2000);

  scene.queueText = scene.add.text(rightX + cardPadX, y + 34, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 4, "spacing"),
    wordWrap: { width: cardContentW }
  });
  if (typeof scene.queueText?.setDepth === "function") scene.queueText.setDepth(2000);
  if (typeof (scene.queueText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.queueText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(cardContentW, enemyCardH - 48);
  }
  y += enemyCardH + cardGap;

  if (showRemoteMatchCard) {
    const remoteCardH = hudLayout.remoteMatchCardH;
    const compactRemote = hudLayout.compact;
    scene.remoteMatchCard = createSideCard(scene, rightX, y, rightW, remoteCardH, 0x6f95c8);
    scene.remoteMatchTitleText = scene.add.text(rightX + cardPadX, y + 10, "◆ CẶP ĐẤU KHÁC", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "label"),
      color: UI_COLORS.textSecondary,
      fontStyle: "bold"
    });
    if (typeof scene.remoteMatchTitleText?.setDepth === "function") scene.remoteMatchTitleText.setDepth(2000);

    scene.remoteMatchPairText = scene.add.text(rightX + cardPadX, y + (compactRemote ? 30 : 32), "", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], compactRemote ? 13 : 14, "body"),
      color: UI_COLORS.textPrimary,
      fontStyle: "bold",
      wordWrap: { width: cardContentW }
    });
    if (typeof scene.remoteMatchPairText?.setDepth === "function") scene.remoteMatchPairText.setDepth(2000);

    scene.remoteMatchSideAText = scene.add.text(rightX + cardPadX, y + (compactRemote ? 48 : 54), "", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 12, "body"),
      color: UI_COLORS.textPrimary,
      wordWrap: { width: cardContentW }
    });
    if (typeof scene.remoteMatchSideAText?.setDepth === "function") scene.remoteMatchSideAText.setDepth(2000);

    scene.remoteMatchSideBText = scene.add.text(rightX + cardPadX, y + (compactRemote ? 64 : 72), "", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 12, "body"),
      color: UI_COLORS.textPrimary,
      wordWrap: { width: cardContentW }
    });
    if (typeof scene.remoteMatchSideBText?.setDepth === "function") scene.remoteMatchSideBText.setDepth(2000);

    scene.remoteMatchProgressText = scene.add.text(rightX + cardPadX, y + (compactRemote ? 80 : 90), "", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], compactRemote ? 11 : 12, "caption"),
      color: UI_COLORS.textSecondary,
      wordWrap: { width: cardContentW }
    });
    if (typeof scene.remoteMatchProgressText?.setDepth === "function") scene.remoteMatchProgressText.setDepth(2000);

    scene.remoteMatchFreshnessText = scene.add.text(rightX + cardPadX, y + (compactRemote ? 92 : 104), "", {
      fontFamily: UI_FONT,
      fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], compactRemote ? 11 : 12, "caption"),
      color: UI_COLORS.textMuted,
      wordWrap: { width: cardContentW }
    });
    if (typeof scene.remoteMatchFreshnessText?.setDepth === "function") scene.remoteMatchFreshnessText.setDepth(2000);

    scene.remoteMatchHudElements = [
      scene.remoteMatchCard,
      scene.remoteMatchTitleText,
      scene.remoteMatchPairText,
      scene.remoteMatchSideAText,
      scene.remoteMatchSideBText,
      scene.remoteMatchProgressText,
      scene.remoteMatchFreshnessText
    ];
    scene.remoteMatchHudElements?.forEach((element) => {
      if (typeof (element as { setVisible?: (v: boolean) => unknown })?.setVisible === "function") {
        (element as { setVisible: (v: boolean) => unknown }).setVisible(false);
      }
    });
    y += remoteCardH + cardGap;
  }

  const logCardH = hudLayout.logCardH;
  createSideCard(scene, rightX, y, rightW, logCardH, 0x5f87af);
  scene.logTitleText = scene.add.text(rightX + cardPadX, y + 10, "• NHẬT KÝ", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "label"),
    color: UI_COLORS.textSecondary,
    fontStyle: "bold"
  });
  if (typeof scene.logTitleText?.setDepth === "function") scene.logTitleText.setDepth(2000);

  scene.logText = scene.add.text(rightX + cardPadX, y + 42, "", {
    fontFamily: UI_FONT,
    fontSize: scaleFontPx(scene as unknown as Parameters<typeof scaleFontPx>[0], 13, "body"),
    color: UI_COLORS.textPrimary,
    lineSpacing: scaleUiSize(scene as unknown as Parameters<typeof scaleUiSize>[0], 5, "spacing"),
    wordWrap: { width: cardContentW }
  });
  if (typeof scene.logText?.setDepth === "function") scene.logText.setDepth(2000);
  if (typeof (scene.logText as { setFixedSize?: (w: number, h: number) => unknown })?.setFixedSize === "function") {
    (scene.logText as { setFixedSize: (w: number, h: number) => unknown }).setFixedSize(cardContentW, logCardH - 56);
  }

  scene.historyButtonRect = {
    x: rightX + rightW - 142,
    y: y + 8,
    w: 128,
    h: 28
  };
}

export default {
  buildCombatTeamStatusModel,
  getCombatHudCardLayout,
  getCombatTopRightButtonLayout,
  getCombatBubblePopupBounds,
  createCombatHud
};
