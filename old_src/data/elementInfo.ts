/**
 * Element / Tribe effect information table.
 *
 * Each tribe key maps to its emoji, Vietnamese name, primary effect label,
 * a short description, and per-star effect descriptions used in tooltips.
 */
import { getLocale } from "../i18n/index.js";

export interface ElementItemInfo {
    emoji: string;
    nameVi: string;
    nameEn: string;
    effect: string;
    desc: string;
    starEffects: string[];
}

export const ELEMENT_INFO: Record<string, ElementItemInfo> = {
    FIRE: {
        emoji: "🔥", nameVi: "Hỏa", nameEn: "Fire",
        effect: "Cháy", desc: "tỷ lệ gây cháy lan",
        starEffects: [
            "15% tỷ lệ gây cháy lan",
            "25% tỷ lệ gây cháy lan",
            "35% tỷ lệ gây cháy lan"
        ]
    },
    TIDE: {
        emoji: "💧", nameVi: "Thủy", nameEn: "Tide",
        effect: "Giảm né tránh", desc: "giảm né tránh",
        starEffects: [
            "15% giảm né tránh mục tiêu",
            "25% giảm né tránh mục tiêu",
            "35% giảm né tránh mục tiêu"
        ]
    },
    WIND: {
        emoji: "🌪️", nameVi: "Phong", nameEn: "Wind",
        effect: "Giảm chính xác", desc: "giảm chính xác",
        starEffects: [
            "15% giảm chính xác mục tiêu",
            "25% giảm chính xác mục tiêu",
            "35% giảm chính xác mục tiêu"
        ]
    },
    STONE: {
        emoji: "🪨", nameVi: "Nham", nameEn: "Stone",
        effect: "Khiên đầu giao tranh", desc: "nhận khiên đầu giao tranh",
        starEffects: [
            "+18 khiên đầu giao tranh",
            "+40 khiên đầu giao tranh",
            "+72 khiên đầu giao tranh"
        ]
    },
    NIGHT: {
        emoji: "🌙", nameVi: "Dạ", nameEn: "Night",
        effect: "Chảy máu", desc: "+ giảm 25% hồi máu",
        starEffects: [
            "Chảy máu + giảm 25% hồi máu",
            "Chảy máu mạnh + giảm 25% hồi máu",
            "Chảy máu nghiêm trọng + giảm 25% hồi máu"
        ]
    },
    SWARM: {
        emoji: "🐝", nameVi: "Trùng", nameEn: "Swarm",
        effect: "Nhiễm độc", desc: "mỗi đồng minh Trùng",
        starEffects: [
            "+5% mỗi đồng minh Trùng",
            "+8% mỗi đồng minh Trùng",
            "+10% mỗi đồng minh Trùng"
        ]
    },
    SPIRIT: {
        emoji: "👻", nameVi: "Linh", nameEn: "Spirit",
        effect: "Thanh tẩy", desc: "đặc biệt",
        starEffects: [
            "Buff đặc biệt",
            "Buff mạnh đặc biệt",
            "Buff cực mạnh đặc biệt"
        ]
    },
    WOOD: {
        emoji: "🌳", nameVi: "Mộc", nameEn: "Wood",
        effect: "Hút máu", desc: "tự nhiên",
        starEffects: [
            "Sinh mệnh tự nhiên",
            "Sinh mệnh mạnh tự nhiên",
            "Sinh mệnh cực mạnh tự nhiên"
        ]
    }
};

/**
 * Look up element info for a given tribe key (e.g. "FIRE").
 * Returns null if the key is not found.
 */
export function getElementInfo(tribeKey: string | null | undefined): ElementItemInfo | null {
    if (!tribeKey) return null;
    return ELEMENT_INFO[tribeKey] ?? null;
}

/**
 * Build a short element label like "🔥 Hỏa" for display.
 */
export function getElementLabel(tribeKey: string | null | undefined): string {
    if (!tribeKey) return "";
    const info = ELEMENT_INFO[tribeKey];
    if (!info) return "";
    const locale = getLocale();
    return `${info.emoji} ${locale === "en" ? info.nameEn ?? info.nameVi : info.nameVi}`;
}

/**
 * Get the element effect description for a specific star level (1-3).
 * Returns empty string if not found.
 */
export function getStarElementEffect(tribeKey: string | null | undefined, star?: number | null): string {
    if (!tribeKey) return "";
    const info = ELEMENT_INFO[tribeKey];
    if (!info?.starEffects) return "";
    const idx = Math.max(0, Math.min(2, (star || 1) - 1));
    return info.starEffects[idx] ?? "";
}
