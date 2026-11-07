// ═══════════════════════════════════════════════════════════════
// tributeCredits.js - Tự động quét ảnh trong /assets/tribute/gallery/
// Chỉ cần bỏ file ảnh vào folder → panel tri ân tự cập nhật.
// (Dùng generate script ở predev/prebuild vì Vite không cho import trực tiếp từ public/)
// ═══════════════════════════════════════════════════════════════

import { TRIBUTE_GALLERY_FILES } from "../generated/tributeGallery.temp.js";

interface TributePalette {
  fill: number;
  accent: number;
  text: string;
}

export interface TributeCredit {
  id: string;
  assetKey: string;
  assetPath: string;
  name: string;
  blurred: boolean;
  initials: string;
  fill: number;
  accent: number;
  text: string;
}

const PALETTE: readonly TributePalette[] = [
  { fill: 0x5d1620, accent: 0xf5d84e, text: "#fff2f2" },
  { fill: 0x23356d, accent: 0xffc645, text: "#eff5ff" },
  { fill: 0x5e245f, accent: 0xff8be2, text: "#fff0ff" },
  { fill: 0x173f8e, accent: 0x8bc8ff, text: "#eef6ff" },
  { fill: 0x282828, accent: 0xf04b52, text: "#f7f7f7" },
  { fill: 0x1a4a3a, accent: 0x6bf5a0, text: "#efffee" },
  { fill: 0x4a2a0a, accent: 0xffaa55, text: "#fff5e0" },
  { fill: 0x2d1b4e, accent: 0xc59dff, text: "#f3eeff" },
  { fill: 0x0e3d5c, accent: 0x4dd9f7, text: "#e8faff" }
];

/**
 * Trích tên hiển thị từ filename.
 * "MixiGaming.jpg" → "MixiGaming"
 * "Chơi Game Mạnh Thích.jpg" → "Chơi Game Mạnh Thích"
 */
function nameFromPath(filePath: string): string {
  const base = filePath.split("/").pop() || "";
  return base.replace(/\.[^.]+$/, "");
}

function normalizeVietnameseText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function stripBlurPrefix(name: string): string {
  const prefix = "lam mo";
  let normalizedPrefix = "";
  let sourceIndex = 0;

  while (sourceIndex < name.length && normalizedPrefix.length < prefix.length) {
    sourceIndex += 1;
    normalizedPrefix = normalizeVietnameseText(name.slice(0, sourceIndex));
  }

  if (!normalizedPrefix.startsWith(prefix)) {
    return name.trimStart();
  }

  return name.slice(sourceIndex).replace(/^\s+/, "");
}

/**
 * Tạo id an toàn từ filename.
 * "Chơi Game Mạnh Thích.jpg" → "choi_game_manh_thich"
 */
function idFromName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// Build danh sách từ file generated (chạy trước khi start dev/build)
export const TRIBUTE_CREDITS: TributeCredit[] = TRIBUTE_GALLERY_FILES.map((filename: string, index: number): TributeCredit => {
  const originalName = nameFromPath(filename);
  const id = idFromName(originalName);
  const blurred = normalizeVietnameseText(originalName).startsWith("lam mo");
  const name = blurred ? stripBlurPrefix(originalName) : originalName;
  const colors = PALETTE[index % PALETTE.length] ?? PALETTE[0];
  const initials = name.slice(0, 2).toUpperCase();

  const assetPath = `assets/tribute/gallery/${filename}`;

  return {
    id,
    assetKey: `tribute_${id}`,
    assetPath,
    name,
    blurred,
    initials,
    ...colors
  };
});
