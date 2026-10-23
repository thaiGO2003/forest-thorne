import { t } from "../i18n/index.js";

function normalizeRange(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return numeric;
}

export function isRangedRange(value: unknown): boolean {
  return normalizeRange(value) >= 2;
}

export function formatRangeLabel(value: unknown): string {
  return isRangedRange(value) ? t("stats.rangeRanged") : t("stats.rangeMelee");
}
