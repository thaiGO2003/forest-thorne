import { UI_COLORS } from "./uiTheme.js";

export function buildTooltipTheme(scene: Record<string, unknown> | null, classType: string | null = null) {
  const roleTheme = typeof scene?.getRoleTheme === "function" ? scene.getRoleTheme(classType) : null;
  return {
    panelFill: 0x0f1624,
    panelStroke: roleTheme?.glow ?? UI_COLORS.panelEdge,
    titleColor: "#8ff58f",
    subtitleColor: UI_COLORS.textSecondary,
    bodyColor: UI_COLORS.textPrimary,
    mutedColor: UI_COLORS.textMuted,
    badgeText: "#edf7ff",
    avatarFill: roleTheme?.card ?? UI_COLORS.panelSoft,
    avatarInner: 0x223246,
    avatarStroke: roleTheme?.stroke ?? UI_COLORS.accent,
    chipFill: roleTheme?.bench ?? 0x1b2637,
    chipStroke: roleTheme?.stroke ?? UI_COLORS.panelEdgeSoft
  };
}
