/**
 * unitDescriptionTranslations — Translation helpers + species/accuracy tables
 *
 * Extracted từ unitDescriptionHelper.js để giữ file chính dưới 500 dòng.
 */

type AugmentGroup = "ECONOMY" | "FORMATION" | "COMBAT" | "SYNERGY";

interface AugmentLike {
    group?: AugmentGroup | string;
    icon?: string;
}

interface SkillLike {
    effectLabel?: string;
    id?: string;
}

// ─── Translation helpers ────────────────────────────────────────────────

/** Translate augment group key to Vietnamese */
export function translateAugmentGroup(group: string): string {
    const map: Record<AugmentGroup, string> = {
        ECONOMY: "Kinh tế",
        FORMATION: "Đội hình",
        COMBAT: "Giao tranh",
        SYNERGY: "Cộng hưởng"
    };
    return map[group as AugmentGroup] ?? group;
}

/** Get icon emoji for an augment */
export function getAugmentIcon(augment: AugmentLike | null | undefined): string {
    if (augment?.icon) return augment.icon;
    const map: Record<AugmentGroup, string> = {
        ECONOMY: "💰",
        FORMATION: "🧩",
        COMBAT: "⚔️",
        SYNERGY: "✨"
    };
    return map[augment?.group as AugmentGroup] ?? "🌲";
}

/** Translate a skill effect key to Vietnamese label */
export function translateSkillEffect(effect: string, skill: SkillLike | null = null): string {
    if (skill?.effectLabel) return skill.effectLabel;
    console.warn(`[Missing metadata] skill "${skill?.id || effect}" has no effectLabel`);
    return effect;
}

/** Format a bonus object as a human-readable string */
export function formatBonusSet(bonus: Record<string, unknown> | null | undefined): string {
    if (!bonus) return "chưa có hiệu ứng";
    return Object.entries(bonus)
        .map(([k, v]) => `${k}:${typeof v === "number" && v < 1 ? `${Math.round(v * 100)}%` : v}`)
        .join(", ");
}

// ─── Species-based evasion (from CSV species field) ─────────────────────

const FAST_SPECIES = ["ho", "bao", "soi", "cao", "doi", "khi", "chon", "tho"];
const SLOW_SPECIES = ["voi", "rua", "trau", "gau", "te-giac", "ha-ma"];

/**
 * Get base evasion percentage based on unit species.
 */
export function getSpeciesEvasion(species: unknown): number {
    const s = String(species ?? "").toLowerCase().trim();
    if (FAST_SPECIES.includes(s)) return 25;
    if (SLOW_SPECIES.includes(s)) return 5;
    return 12;
}

/**
 * Get base accuracy percentage based on unit class and tier.
 */
export function getClassAccuracy(classType: string, tier: number = 1): number {
    const map: Record<string, number> = {
        TANKER: 90, FIGHTER: 105, ASSASSIN: 115,
        ARCHER: 105, MAGE: 100, SUPPORT: 95
    };
    const base = map[classType] ?? 95;
    const tierBonus = (Math.max(1, tier || 1) - 1) * 2;
    return base + tierBonus;
}
