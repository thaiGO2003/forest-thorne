import { t } from "../i18n/index.js";

export function prefixButtonEmoji(emoji: string | null | undefined, label: string | null | undefined): string {
  const normalizedEmoji = String(emoji ?? "").trim();
  const normalizedLabel = String(label ?? "").trim();
  if (!normalizedEmoji) return normalizedLabel;
  if (!normalizedLabel) return normalizedEmoji;
  return normalizedLabel.startsWith(`${normalizedEmoji} `)
    ? normalizedLabel
    : `${normalizedEmoji} ${normalizedLabel}`;
}

export function getPlanningCortisolButtonLabel(): string {
  return "🧘 Lower your Cortisol";
}

export function getHistoryButtonLabel(count: number | null = null): string {
  return count == null
    ? "📋 Nhật ký"
    : `📋 Nhật ký (${Math.max(0, Number(count) || 0)})`;
}

export function getUtilityLibraryButtonLabel(): string {
  return "📚 Thư Viện";
}

export function getUtilitySettingsButtonLabel(): string {
  return "⚙ Cài đặt";
}

export function getResetRunButtonLabel(): string {
  return "🔄 Ván mới";
}

export function getCombatBubbleButtonLabel(): string {
  return "🫧 Bong bóng";
}

export function getMenuContinueButtonLabel(round: number | null = null): string {
  return prefixButtonEmoji(
    "▶",
    round == null ? t("menu.continue") : t("menu.continueRound", { round })
  );
}

export function getMenuNewGameButtonLabel(): string {
  return prefixButtonEmoji("🆕", t("menu.newGame"));
}

export function getMenuSettingsButtonLabel(): string {
  return prefixButtonEmoji("⚙", t("menu.settings"));
}

export function getMenuLibraryButtonLabel(): string {
  return prefixButtonEmoji("📚", t("menu.library"));
}

export function getMenuAchievementsButtonLabel(label: string): string {
  return prefixButtonEmoji("🏆", label);
}

export function getMenuEnterGameButtonLabel(): string {
  return prefixButtonEmoji("🎮", t("ui.enterGame"));
}

export function getMenuCloseButtonLabel(): string {
  return prefixButtonEmoji("✖", t("ui.close"));
}
