import { UI_COLORS } from "../../core/uiTheme.js";

interface RoleTheme {
  card?: number;
  bench?: number;
  stroke?: number;
  glow?: number;
  [key: string]: unknown;
}

interface TooltipThemeScene {
  getRoleTheme?: (classType: string) => RoleTheme | null | undefined;
  [key: string]: unknown;
}

type ClassType = string;

export function buildSharedTooltipTheme(scene: TooltipThemeScene | null | undefined, classType: ClassType) {
  const roleTheme = typeof scene?.getRoleTheme === "function" ? scene.getRoleTheme(classType) : null;
  const cardFill = roleTheme?.card ?? UI_COLORS.panelSoft;
  const benchFill = roleTheme?.bench ?? 0x1b2637;
  const stroke = roleTheme?.stroke ?? UI_COLORS.panelEdge;
  const glow = roleTheme?.glow ?? stroke;
  return {
    panelFill: cardFill,
    panelStroke: glow,
    titleColor: "#8ff58f",
    subtitleColor: "#cad7e6",
    bodyColor: UI_COLORS.textPrimary,
    mutedColor: UI_COLORS.textMuted,
    badgeText: "#edf7ff",
    avatarFill: cardFill,
    avatarInner: benchFill,
    avatarStroke: stroke,
    avatarIconColor: "#a58de8",
    chipFill: benchFill,
    chipStroke: stroke,
    headerFill: benchFill,
    bodyFill: cardFill,
    railFill: benchFill,
    railStroke: stroke,
    dividerColor: stroke
  };
}
