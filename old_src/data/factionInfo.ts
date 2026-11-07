/**
 * Faction information — species-based tribe grouping.
 *
 * 6 factions: BEAST, AVIAN, INSECT, REPTILE, AQUATIC, MYTHICAL
 * Each unit is assigned a faction based on its `species` key.
 */
import { getLocale } from "../i18n/index.js";

// ─── Faction metadata ──────────────────────────────────────────────
export interface FactionItemInfo {
  emoji: string;
  nameVi: string;
  nameEn: string;
  desc: string;
}

export const FACTION_INFO: Record<string, FactionItemInfo> = {
  BEAST: {
    emoji: "🐾", nameVi: "Thú", nameEn: "Beast",
    desc: "Các loài thú có vú — bền bỉ và mạnh mẽ"
  },
  AVIAN: {
    emoji: "🦅", nameVi: "Chim", nameEn: "Avian",
    desc: "Các loài chim — nhanh nhẹn và linh hoạt"
  },
  INSECT: {
    emoji: "🐛", nameVi: "Côn trùng", nameEn: "Insect",
    desc: "Côn trùng và nhện — đông đảo và dai dẳng"
  },
  REPTILE: {
    emoji: "🦎", nameVi: "Bò sát", nameEn: "Reptile",
    desc: "Bò sát và lưỡng cư — cứng rắn và nguy hiểm"
  },
  AQUATIC: {
    emoji: "🌊", nameVi: "Thủy sinh", nameEn: "Aquatic",
    desc: "Sinh vật nước — bí ẩn và trường tồn"
  },
  MYTHICAL: {
    emoji: "✨", nameVi: "Huyền thoại", nameEn: "Mythical",
    desc: "Sinh vật huyền thoại — quyền năng siêu nhiên"
  }
};

// ─── Species → Faction mapping ─────────────────────────────────────
// Covers all 112 unique species across active + archived units.
export const SPECIES_TO_FACTION: Record<string, string> = {
  // ── BEAST (mammals) ──
  "gau": "BEAST",           // Gấu
  "cao": "BEAST",           // Cáo
  "soi": "BEAST",           // Sói
  "ho": "BEAST",            // Hổ
  "bao": "BEAST",           // Báo
  "bao-dom": "BEAST",       // Báo Đốm
  "su-tu": "BEAST",         // Sư Tử
  "voi": "BEAST",           // Voi
  "voi-long": "BEAST",      // Voi Ma Mút
  "khi": "BEAST",           // Khỉ
  "nai": "BEAST",           // Nai
  "cuu": "BEAST",           // Cừu
  "trau": "BEAST",          // Trâu
  "bo": "BEAST",            // Bò
  "bo-rung": "BEAST",       // Bò Rừng
  "bison": "BEAST",         // Bò Rừng (alias)
  "ha-ma": "BEAST",         // Hà Mã
  "lung": "BEAST",          // Lửng Đá
  "chon": "BEAST",          // Chồn
  "chon-huong": "BEAST",    // Chồn Hương
  "chon-soi": "BEAST",      // Chồn Sói
  "mink": "BEAST",          // Chồn Mink
  "linh-cau": "BEAST",      // Linh Cẩu
  "kangaroo": "BEAST",      // Kangaroo
  "vuon": "BEAST",          // Đười Ươi
  "doi": "BEAST",           // Dơi
  "yak": "BEAST",           // Bò Tây Tạng
  "ngua": "BEAST",          // Ngựa
  "te-giac": "BEAST",       // Tê Giác
  "rai-ca": "BEAST",        // Rái Cá (sống nước nhưng là thú)

  // ── AVIAN (birds) ──
  "dai-bang": "AVIAN",      // Đại Bàng
  "dai-bang-huyen": "AVIAN",// Đại Bàng Huyền Thoại
  "cu": "AVIAN",            // Cú
  "cong": "AVIAN",          // Khổng Tước (Công)
  "qua": "AVIAN",           // Quạ
  "qua-tu": "AVIAN",        // Quạ Tử Thần
  "thien-nga": "AVIAN",     // Thiên Nga
  "dieu-hau": "AVIAN",      // Diều Hâu
  "dieu-khong-lo": "AVIAN", // Diều Hâu Khổng Lồ
  "cat-lao": "AVIAN",       // Cắt Lao
  "chim-mo-to": "AVIAN",    // Chim Mỏ To
  "diec": "AVIAN",          // Diệc
  "go-kien": "AVIAN",       // Gõ Kiến
  "bo-nong": "AVIAN",       // Bồ Nông
  "co": "AVIAN",            // Cò
  "hong-hac": "AVIAN",      // Hồng Hạc
  "hai-au": "AVIAN",        // Hải Âu
  "bo-cau": "AVIAN",        // Bồ Câu
  "ga-trong": "AVIAN",      // Hạc (Crane) — mapped from ga-trong
  "chim-sam": "AVIAN",      // Chim Sấm
  // Vẹt (vet) nếu có

  // ── INSECT (insects & arachnids) ──
  "kien": "INSECT",         // Kiến
  "bo-ngua": "INSECT",      // Bọ Ngựa / Châu Chấu
  "ong": "INSECT",          // Ong
  "ong-sat": "INSECT",      // Ong Bắp Cày Sát
  "ong-phep": "INSECT",     // Ong Phép
  "buom": "INSECT",         // Bướm
  "buom-dem": "INSECT",     // Bướm Đêm
  "nhen": "INSECT",         // Nhện
  "nhen-doc": "INSECT",     // Nhện Độc
  "bo-cap": "INSECT",       // Bọ Cạp
  "bo-cap-bong": "INSECT",  // Bọ Cạp Bóng
  "dom-dom": "INSECT",      // Đom Đóm
  "dom-chua": "INSECT",     // Đom Đóm Chữa
  "bo-huyen": "INSECT",     // Bọ Huyền
  "sau": "INSECT",          // Sâu
  "muoi": "INSECT",         // Muỗi
  "chuon-chuon": "INSECT",  // Chuồn Chuồn

  // ── REPTILE (reptiles & amphibians) ──
  "ran": "REPTILE",         // Rắn
  "ran-luc": "REPTILE",     // Rắn Lục
  "ca-sau": "REPTILE",      // Cá Sấu
  "tac-ke": "REPTILE",      // Tắc Kè / Rồng Đất Cổ
  "ky-da": "REPTILE",       // Kỳ Đà
  "rua": "REPTILE",         // Rùa
  "te-te": "REPTILE",       // Tê Tê
  "tatu": "REPTILE",        // Tatu
  "coc": "REPTILE",         // Cóc
  "coc-doc": "REPTILE",     // Cóc Độc
  "ky-nhong": "REPTILE",    // Kỳ Nhông
  "ky-giong": "REPTILE",    // Kỳ Giông
  "rong-dat": "REPTILE",    // Rồng Đất
  "khung-long": "REPTILE",  // Khủng Long (T-Rex)

  // ── AQUATIC (water creatures) ──
  "ca-map": "AQUATIC",      // Cá Mập
  "ca-voi": "AQUATIC",      // Cá Voi
  "muc": "AQUATIC",         // Mực
  "muc-muc": "AQUATIC",     // Mực (alias)
  "bach-tuoc": "AQUATIC",   // Bạch Tuộc
  "bach-tuoc-tam": "AQUATIC",// Bạch Tuộc Tâm
  "sua": "AQUATIC",         // Sứa
  "oc": "AQUATIC",          // Ốc Sên
  "cua": "AQUATIC",         // Cua
  "hai-ma": "AQUATIC",      // Hải Mã
  "snail": "AQUATIC",       // Ốc (alias)

  // ── MYTHICAL (legendary/magical creatures) ──
  "long": "MYTHICAL",       // Rồng
  "ky-lan": "MYTHICAL",     // Kỳ Lân
  "ky-lan-sang": "MYTHICAL", // Kỳ Lân Sáng
  "phuong": "MYTHICAL",     // Phượng Hoàng
  "phuong-ten": "MYTHICAL", // Phượng Hoàng Tên
  "hydra": "MYTHICAL",      // Hydra
  "chimera": "MYTHICAL",    // Chimera
  "titan": "MYTHICAL",      // Titan
  "golem": "MYTHICAL",      // Golem
  "garuda": "MYTHICAL",     // Garuda
  "seraphim": "MYTHICAL",   // Seraphim
  "thien-than": "MYTHICAL", // Thiên Thần
  "tien": "MYTHICAL",       // Tiên
  "tien-nuoc": "MYTHICAL",  // Tiên Nước
  "tien-tri": "MYTHICAL",   // Tiên Tri
  "yeu-tinh": "MYTHICAL",   // Yêu Tinh Cây
  "yeu-tinh-gio": "MYTHICAL",// Yêu Tinh Gió
  "hon-ma": "MYTHICAL",     // Hồn Ma
  "ma": "MYTHICAL",         // Ma Bóng Tối
  "tu-than": "MYTHICAL",    // Tử Thần
  "lich": "MYTHICAL"        // Lich
};

// ─── Faction label / icon lookups ──────────────────────────────────

const FACTION_LABELS_VI = Object.fromEntries(
  Object.entries(FACTION_INFO).map(([k, v]) => [k, v.nameVi])
);

const FACTION_LABELS_EN = Object.fromEntries(
  Object.entries(FACTION_INFO).map(([k, v]) => [k, v.nameEn])
);

const FACTION_ICONS = Object.fromEntries(
  Object.entries(FACTION_INFO).map(([k, v]) => [k, v.emoji])
);

/**
 * Resolve a faction key from a species string.
 * Falls back to "BEAST" if the species is not mapped.
 */
export function getFactionForSpecies(species?: string | null): string {
  if (!species) return "BEAST";
  return SPECIES_TO_FACTION[species] ?? "BEAST";
}

/**
 * Get localised faction label, e.g. "Thú" or "Beast".
 */
export function getFactionLabel(code?: string | null, locale = getLocale()): string {
  const normalized = typeof code === "string" ? code.trim() : code;
  if (!normalized) return "";
  return (locale === "en" ? FACTION_LABELS_EN : FACTION_LABELS_VI)[normalized] ?? code;
}

/**
 * Get faction emoji icon.
 */
export function getFactionIcon(code?: string | null): string {
  const normalized = typeof code === "string" ? code.trim() : code;
  if (!normalized) return "◎";
  return FACTION_ICONS[normalized] ?? "◎";
}

/**
 * Vietnamese shorthand.
 */
export function getFactionLabelVi(code?: string | null): string {
  return getFactionLabel(code, "vi");
}

/**
 * Get full faction info object.
 */
export function getFactionInfo(factionKey?: string | null): FactionItemInfo | null {
  if (!factionKey) return null;
  return FACTION_INFO[factionKey] ?? null;
}
