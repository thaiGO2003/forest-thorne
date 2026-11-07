export interface ForestBackgroundAsset {
  key: string;
  path: string;
  label: string;
}

export const FOREST_BACKGROUND_ASSETS: readonly ForestBackgroundAsset[] = [
  { key: "forest_bg_01", path: "assets/backgrounds/forest_round_01.jpg", label: "Sương mù rừng sâu" },
  { key: "forest_bg_02", path: "assets/backgrounds/forest_round_02.jpg", label: "Rừng tối cổ thụ" },
  { key: "forest_bg_03", path: "assets/backgrounds/forest_round_03.jpg", label: "Hồ rừng tĩnh lặng" },
  { key: "forest_bg_04", path: "assets/backgrounds/forest_round_04.jpg", label: "Thung lũng linh mộc" },
  { key: "forest_bg_05", path: "assets/backgrounds/forest_round_05.jpg", label: "Lá đỏ mùa thu" },
  { key: "forest_bg_06", path: "assets/backgrounds/forest_round_06.jpg", label: "Đường mòn sương sớm" },
  { key: "forest_bg_07", path: "assets/backgrounds/forest_round_07.jpg", label: "Thác rừng nguyên sinh" },
  { key: "forest_bg_08", path: "assets/backgrounds/forest_round_08.jpg", label: "Tán cây cổ thụ" },
  { key: "forest_bg_09", path: "assets/backgrounds/forest_round_09.jpg", label: "Con đường hoang dã" },
  { key: "forest_bg_10", path: "assets/backgrounds/forest_round_10.jpg", label: "Bình minh trong rừng" },
  { key: "forest_bg_11", path: "assets/backgrounds/forest_round_11.jpg", label: "Lối đi bí ẩn" },
  { key: "forest_bg_12", path: "assets/backgrounds/forest_round_12.jpg", label: "Rừng đêm tịch mịch" }
];

export function getForestBackgroundAssetByRound(round?: number | null): ForestBackgroundAsset {
  const safeRound = typeof round === "number" && Number.isFinite(round) ? Math.max(1, Math.floor(round)) : 1;
  const idx = (safeRound - 1) % FOREST_BACKGROUND_ASSETS.length;
  return FOREST_BACKGROUND_ASSETS[idx];
}

export function getForestBackgroundKeyByRound(round?: number | null): string {
  return getForestBackgroundAssetByRound(round).key;
}
