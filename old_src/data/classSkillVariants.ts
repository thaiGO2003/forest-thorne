/**
 * classSkillVariants.js
 *
 * Variant trait pools per class.
 * Each trait needs a stable id so saves and merge ancestry survive balance changes.
 */

export interface VariantBonus {
    [key: string]: number;
}

export interface ClassSkillVariant {
    id: string;
    name: string;
    bonus: VariantBonus;
    weight?: number;
    classType?: string;
}

export type ClassSkillVariantMap = Readonly<Record<string, readonly ClassSkillVariant[]>>;

const RAW_CLASS_SKILL_VARIANTS: ClassSkillVariantMap = {
    TANKER: [
        { id: "tanker_thick_armor", name: "Giáp Dày", bonus: { defFlat: 6, hpPct: 0.04 } },
        { id: "tanker_rebound", name: "Phản Chấn", bonus: { shieldStart: 18 } },
        { id: "tanker_bulwark", name: "Thành Lũy", bonus: { mdefFlat: 6, hpPct: 0.03 } },
        { id: "tanker_iron_will", name: "Ý Chí Sắt", bonus: { defFlat: 4, mdefFlat: 4 } },
        { id: "tanker_guard_core", name: "Hộ Tâm", bonus: { shieldStart: 12, hpPct: 0.02 } }
    ],
    ASSASSIN: [
        { id: "assassin_killing_intent", name: "Sát Ý", bonus: { atkPct: 0.09 } },
        { id: "assassin_death_mark", name: "Đoạt Mệnh", bonus: { critPct: 0.10 } },
        { id: "assassin_shadow_dash", name: "Lướt Ảnh", bonus: { startingRage: 1 } },
        { id: "assassin_venom_edge", name: "Lưỡi Độc", bonus: { atkPct: 0.05, critPct: 0.04 } },
        { id: "assassin_phantom_step", name: "Ảo Bộ", bonus: { evadePct: 0.05 } }
    ],
    ARCHER: [
        { id: "archer_heart_pierce", name: "Xuyên Tâm", bonus: { atkPct: 0.07 } },
        { id: "archer_rapid_volley", name: "Liên Xạ", bonus: { startingRage: 1 } },
        { id: "archer_hawk_eye", name: "Ưng Nhãn", bonus: { critPct: 0.08 } },
        { id: "archer_sharp_feather", name: "Lông Sắc", bonus: { atkPct: 0.04, critPct: 0.04 } },
        { id: "archer_far_sight", name: "Viễn Nhãn", bonus: { atkPct: 0.05 } }
    ],
    MAGE: [
        { id: "mage_focus_spell", name: "Cường Chú", bonus: { matkPct: 0.10 } },
        { id: "mage_charge_up", name: "Tụ Lực", bonus: { startingRage: 1 } },
        { id: "mage_diffusion", name: "Khuếch Tán", bonus: { matkPct: 0.06, mdefFlat: 5 } },
        { id: "mage_frost_core", name: "Băng Tâm", bonus: { mdefFlat: 8 } },
        { id: "mage_mana_tide", name: "Triều Mana", bonus: { matkPct: 0.05, startingRage: 1 } }
    ],
    SUPPORT: [
        { id: "support_divine_guard", name: "Thần Hộ", bonus: { shieldStart: 16 } },
        { id: "support_healing_touch", name: "Trị Liệu", bonus: { healPct: 0.08 } },
        { id: "support_inspire", name: "Cổ Vũ", bonus: { startingRage: 1 } },
        { id: "support_sanctuary", name: "Thánh Vực", bonus: { shieldStart: 10, mdefFlat: 5 } },
        { id: "support_harmony", name: "Hòa Âm", bonus: { healPct: 0.05, hpPct: 0.03 } }
    ],
    FIGHTER: [
        { id: "fighter_berserk", name: "Cuồng Nộ", bonus: { atkPct: 0.08 } },
        { id: "fighter_endurance", name: "Bền Bỉ", bonus: { hpPct: 0.05 } },
        { id: "fighter_battle_spirit", name: "Chiến Ý", bonus: { critPct: 0.06, atkPct: 0.04 } },
        { id: "fighter_crushing_guard", name: "Phá Thế", bonus: { atkPct: 0.05, defFlat: 4 } },
        { id: "fighter_relentless", name: "Dồn Ép", bonus: { startingRage: 1 } }
    ]
};

function normalizeTrait(classType: string, trait: ClassSkillVariant): ClassSkillVariant {
    const weight = trait.weight;
    return {
        id: String(trait.id).trim(),
        name: String(trait.name).trim(),
        bonus: { ...(trait.bonus ?? {}) },
        weight: typeof weight === "number" && Number.isFinite(weight) && weight > 0 ? weight : 1,
        classType
    };
}

export const CLASS_SKILL_VARIANTS: ClassSkillVariantMap = Object.fromEntries(
    Object.entries(RAW_CLASS_SKILL_VARIANTS).map(([classType, traits]) => [
        classType,
        traits.map((trait) => Object.freeze(normalizeTrait(classType, trait)))
    ])
);

export const VARIANT_TRAIT_BY_ID: Record<string, ClassSkillVariant> = Object.freeze(Object.fromEntries(
    Object.values(CLASS_SKILL_VARIANTS)
        .flat()
        .map((trait) => [trait.id, trait])
));

export const VARIANT_TRAIT_BY_NAME: Record<string, ClassSkillVariant> = Object.freeze(Object.fromEntries(
    Object.values(CLASS_SKILL_VARIANTS)
        .flat()
        .map((trait) => [trait.name, trait])
));
