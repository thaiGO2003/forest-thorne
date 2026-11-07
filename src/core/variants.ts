// Deterministic owned-unit variant traits and merge ancestry (spec A43, A77, A81).
import type { Role } from "../content/catalog";

export interface VariantBonuses {
  hpPct?: number;
  atkPct?: number;
  matkPct?: number;
  def?: number;
  mdef?: number;
  healPct?: number;
  critPct?: number;
  evadePct?: number;
  lifestealPct?: number;
  startingShield?: number;
  startingRage?: number;
}

export interface VariantTraitDef {
  id: string;
  /** Player-facing Vietnamese name, ported from old-src classSkillVariants. */
  nameVi: string;
  role: Role;
  weight: number;
  bonuses: VariantBonuses;
}

export interface VariantTraitRef {
  id: string;
  seed: number;
}

export const MAX_VARIANT_TRAITS = 9;

const defs = (role: Role, rows: readonly [string, string, VariantBonuses][]): VariantTraitDef[] =>
  rows.map(([id, nameVi, bonuses]) => ({ id, nameVi, role, weight: 1, bonuses }));

export const VARIANT_TRAITS: readonly VariantTraitDef[] = [
  ...defs("TANKER", [
    ["tanker_thick_armor", "Giáp Dày", { def: 6, hpPct: 4 }], ["tanker_rebound", "Phản Chấn", { startingShield: 18 }],
    ["tanker_bulwark", "Thành Lũy", { mdef: 6, hpPct: 3 }], ["tanker_iron_will", "Ý Chí Sắt", { def: 4, mdef: 4 }],
    ["tanker_guard_core", "Hộ Tâm", { startingShield: 12, hpPct: 2 }],
  ]),
  ...defs("ASSASSIN", [
    ["assassin_killing_intent", "Sát Ý", { atkPct: 9 }], ["assassin_death_mark", "Đoạt Mệnh", { critPct: 10 }],
    ["assassin_shadow_dash", "Lướt Ảnh", { startingRage: 1 }], ["assassin_venom_edge", "Lưỡi Độc", { atkPct: 5, critPct: 4 }],
    ["assassin_phantom_step", "Ảo Bộ", { evadePct: 5 }],
  ]),
  ...defs("ARCHER", [
    ["archer_heart_pierce", "Xuyên Tâm", { atkPct: 7 }], ["archer_rapid_volley", "Liên Xạ", { startingRage: 1 }],
    ["archer_hawk_eye", "Ưng Nhãn", { critPct: 8 }], ["archer_sharp_feather", "Lông Sắc", { atkPct: 4, critPct: 4 }],
    ["archer_far_sight", "Viễn Nhãn", { atkPct: 5 }],
  ]),
  ...defs("MAGE", [
    ["mage_focus_spell", "Cường Chú", { matkPct: 10 }], ["mage_charge_up", "Tụ Lực", { startingRage: 1 }],
    ["mage_diffusion", "Khuếch Tán", { matkPct: 6, mdef: 5 }], ["mage_frost_core", "Băng Tâm", { mdef: 8 }],
    ["mage_mana_tide", "Triều Mana", { matkPct: 5, startingRage: 1 }],
  ]),
  ...defs("SUPPORT", [
    ["support_divine_guard", "Thần Hộ", { startingShield: 16 }], ["support_healing_touch", "Trị Liệu", { healPct: 8 }],
    ["support_inspire", "Cổ Vũ", { startingRage: 1 }], ["support_sanctuary", "Thánh Vực", { startingShield: 10, mdef: 5 }],
    ["support_harmony", "Hòa Âm", { healPct: 5, hpPct: 3 }],
  ]),
  ...defs("FIGHTER", [
    ["fighter_berserk", "Cuồng Nộ", { atkPct: 8 }], ["fighter_endurance", "Bền Bỉ", { hpPct: 5 }],
    ["fighter_battle_spirit", "Chiến Ý", { critPct: 6, atkPct: 4 }], ["fighter_crushing_guard", "Phá Thế", { atkPct: 5, def: 4 }],
    ["fighter_relentless", "Dồn Ép", { startingRage: 1 }],
  ]),
];

export const VARIANT_BY_ID: ReadonlyMap<string, VariantTraitDef> = new Map(VARIANT_TRAITS.map((t) => [t.id, t]));
export const VARIANTS_BY_ROLE: Readonly<Record<Role, readonly VariantTraitDef[]>> = {
  TANKER: VARIANT_TRAITS.filter((t) => t.role === "TANKER"),
  ASSASSIN: VARIANT_TRAITS.filter((t) => t.role === "ASSASSIN"),
  ARCHER: VARIANT_TRAITS.filter((t) => t.role === "ARCHER"),
  MAGE: VARIANT_TRAITS.filter((t) => t.role === "MAGE"),
  SUPPORT: VARIANT_TRAITS.filter((t) => t.role === "SUPPORT"),
  FIGHTER: VARIANT_TRAITS.filter((t) => t.role === "FIGHTER"),
};

const stableHash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

const mix32 = (seed: number): number => {
  let x = seed >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};

export function rollVariantTrait(role: Role, seed: number): VariantTraitRef {
  const pool = VARIANTS_BY_ROLE[role];
  const total = pool.reduce((n, trait) => n + trait.weight, 0);
  let roll = (mix32(seed) / 4294967296) * total;
  for (const trait of pool) {
    roll -= trait.weight;
    if (roll < 0) return { id: trait.id, seed: seed >>> 0 };
  }
  return { id: pool[pool.length - 1]!.id, seed: seed >>> 0 };
}

/** Invalid ids are discarded; a missing/invalid seed is reconstructed deterministically. */
export function normalizeVariantTraits(role: Role, refs: readonly VariantTraitRef[]): VariantTraitRef[] {
  const out: VariantTraitRef[] = [];
  for (let i = 0; i < refs.length && out.length < MAX_VARIANT_TRAITS; i++) {
    const ref = refs[i]!;
    const def = VARIANT_BY_ID.get(ref.id);
    if (!def || def.role !== role) continue;
    const seed = Number.isFinite(ref.seed) && ref.seed >= 0 ? Math.round(ref.seed) >>> 0 : stableHash(`${role}:${ref.id}:${i}`);
    out.push({ id: ref.id, seed });
  }
  return out;
}

export function sumVariantBonuses(role: Role, refs: readonly VariantTraitRef[]): VariantBonuses {
  const out: VariantBonuses = {};
  const keys: (keyof VariantBonuses)[] = [
    "hpPct", "atkPct", "matkPct", "def", "mdef", "healPct", "critPct", "evadePct", "lifestealPct",
    "startingShield", "startingRage",
  ];
  for (const ref of normalizeVariantTraits(role, refs)) {
    const bonuses = VARIANT_BY_ID.get(ref.id)!.bonuses;
    for (const key of keys) {
      const value = bonuses[key];
      if (typeof value === "number" && Number.isFinite(value)) out[key] = (out[key] ?? 0) + value;
    }
  }
  return out;
}
