interface LootDropDetail {
  dropKind?: "equipment" | "base" | "recipe" | string;
  sourceStar?: number;
  sourceTier?: number;
  dropTier?: number;
  sourceType?: string;
  sourceHint?: string;
  sourceTribe?: string;
  sourceClassType?: string;
  sourceUnitName?: string;
  [key: string]: unknown;
}

export function getLootSourceTag(detail: LootDropDetail | null | undefined): string {
  if (!detail) return "không rõ";
  if (detail.dropKind === "equipment") {
    const sourceStar = Number.isFinite(detail?.sourceStar)
      ? Math.max(1, Math.floor(detail.sourceStar as number))
      : "?";
    const dropTier = Number.isFinite(detail?.dropTier)
      ? Math.max(1, Math.floor(detail.dropTier as number))
      : "?";
    return `địch ${sourceStar}★ -> trang bị cấp ${dropTier}`;
  }
  const kind = String(detail.sourceType ?? "").toLowerCase();
  if (kind === "species") return "theo loài";
  if (kind === "tribe") return `theo tộc ${detail.sourceHint ?? detail.sourceTribe ?? "?"}`;
  if (kind === "class") return `theo nghề ${detail.sourceHint ?? detail.sourceClassType ?? "?"}`;
  if (kind === "fallback") return `fallback ${detail.sourceHint ?? detail.sourceTribe ?? "?"}`;
  return "không rõ";
}

export function getLootSourceLabel(detail: LootDropDetail | null | undefined, fallbackName = "Quái địch"): string {
  const safeDetail = detail ?? null;
  const sourceName = safeDetail?.sourceUnitName ?? fallbackName;
  if (safeDetail?.dropKind === "equipment") {
    return `${sourceName} (${getLootSourceTag(safeDetail)})`;
  }
  const sourceTier = Number.isFinite(safeDetail?.sourceTier)
    ? `T${Math.max(1, Math.floor(safeDetail?.sourceTier as number))}`
    : "T?";
  return `${sourceName} (${sourceTier}, ${getLootSourceTag(safeDetail)})`;
}
