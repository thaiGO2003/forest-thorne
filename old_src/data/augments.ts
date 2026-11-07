export type AugmentGroup = "ECONOMY" | "FORMATION" | "COMBAT" | "SYNERGY" | string;
export type AugmentScalar = string | number | boolean | null;

export interface AugmentEffect {
  type: string;
  value?: AugmentScalar;
  [key: string]: AugmentScalar | undefined;
}

export interface AugmentDefinition {
  id: string;
  name: string;
  group: AugmentGroup;
  description: string;
  effect: AugmentEffect;
  [key: string]: unknown;
}

interface GeneratedAugmentTemplate {
  key: string;
  title: string;
  group: AugmentGroup;
  effectType: string;
  values: readonly number[];
  describe: (value: number) => string;
}

export const AUGMENT_ROUNDS: number[] = [3, 5, 7];

const BASE_AUGMENT_LIBRARY: AugmentDefinition[] = [
  {
    id: "gold_cache",
    name: "Kho Vàng Rừng",
    group: "ECONOMY",
    description: "+8 vàng ngay lập tức.",
    effect: { type: "gold_flat", value: 8 }
  },
  {
    id: "banking_roots",
    name: "Rễ Giữ Vàng",
    group: "ECONOMY",
    description: "+1 trần lãi.",
    effect: { type: "interest_cap", value: 1 }
  },
  {
    id: "cheap_reroll",
    name: "Đổi Tướng Tiết Kiệm",
    group: "ECONOMY",
    description: "Đổi tướng giảm 1 vàng (tối thiểu còn 1).",
    effect: { type: "roll_cost_delta", value: -1 }
  },
  {
    id: "wild_command",
    name: "Hiệu Lệnh Hoang Dã",
    group: "FORMATION",
    description: "+1 giới hạn triển khai.",
    effect: { type: "deploy_cap_bonus", value: 1 }
  },
  {
    id: "deep_bench",
    name: "Kho Dự Bị Sâu",
    group: "FORMATION",
    description: "+2 ô dự bị.",
    effect: { type: "bench_bonus", value: 2 }
  },
  {
    id: "opening_fury",
    name: "Nộ Khí Khai Trận",
    group: "COMBAT",
    description: "Đồng minh bắt đầu giao tranh với +1 nộ.",
    effect: { type: "starting_rage", value: 1 }
  },
  {
    id: "battle_hunger",
    name: "Khát Chiến",
    group: "COMBAT",
    description: "Toàn đội +12% công vật lý.",
    effect: { type: "team_atk_pct", value: 0.12 }
  },
  {
    id: "iron_canopy",
    name: "Tán Sắt",
    group: "COMBAT",
    description: "Toàn đội +12% máu.",
    effect: { type: "team_hp_pct", value: 0.12 }
  },
  {
    id: "aegis_seed",
    name: "Mầm Khiên Cổ",
    group: "COMBAT",
    description: "Mỗi tướng có +35 khiên đầu giao tranh.",
    effect: { type: "starting_shield", value: 35 }
  },
  {
    id: "arcane_sap",
    name: "Nhựa Pháp Lực",
    group: "COMBAT",
    description: "Toàn đội +15% công phép.",
    effect: { type: "team_matk_pct", value: 0.15 }
  },
  {
    id: "forest_blessing",
    name: "Phước Lành Đại Ngàn",
    group: "SYNERGY",
    description: "Tăng +1 mốc cộng hưởng Nghề cao nhất (tối đa +1 mốc).",
    effect: { type: "extra_class_count", value: 1 }
  },
  {
    id: "tribe_echo",
    name: "Vọng Âm Tộc Loài",
    group: "SYNERGY",
    description: "Tăng +1 mốc cộng hưởng Tộc cao nhất (tối đa +1 mốc).",
    effect: { type: "extra_tribe_count", value: 1 }
  },
  {
    id: "vampiric_vine",
    name: "Dây Leo Hút Sinh",
    group: "COMBAT",
    description: "Đơn vị vật lý hồi 8% sát thương gây ra.",
    effect: { type: "lifesteal_pct", value: 0.08 }
  },
  {
    id: "wisdom_grove",
    name: "Rừng Tri Thức",
    group: "ECONOMY",
    description: "Nhận +12 XP ngay lập tức.",
    effect: { type: "xp_flat", value: 12 }
  },
  {
    id: "fortune_hunter",
    name: "Thợ Săn Vận May",
    group: "ECONOMY",
    description: "+2 vàng sau mỗi vòng thắng.",
    effect: { type: "win_gold_bonus", value: 2 }
  },
  {
    id: "compound_interest",
    name: "Lãi Kép",
    group: "ECONOMY",
    description: "Lãi suất tăng từ 10% lên 12%.",
    effect: { type: "interest_rate_bonus", value: 0.02 }
  },
  {
    id: "budget_recruitment",
    name: "Tuyển Dụng Giá Rẻ",
    group: "ECONOMY",
    description: "Chi phí đổi cửa hàng giảm 1 vàng.",
    effect: { type: "roll_cost_delta", value: -1 }
  },
  {
    id: "scholar",
    name: "Học Giả",
    group: "ECONOMY",
    description: "Chi phí mua XP giảm 1 vàng.",
    effect: { type: "xp_cost_delta", value: -1 }
  },
  {
    id: "iron_hide",
    name: "Da Sắt",
    group: "COMBAT",
    description: "Toàn đội +12% giáp.",
    effect: { type: "team_def_pct", value: 0.12 }
  },
  {
    id: "mystic_ward",
    name: "Lá Chắn Tâm Linh",
    group: "COMBAT",
    description: "Toàn đội +12% kháng phép.",
    effect: { type: "team_mdef_pct", value: 0.12 }
  },
  {
    id: "frenzy_spores",
    name: "Bào Tử Cuồng Nộ",
    group: "COMBAT",
    description: "Đồng minh bắt đầu giao tranh với +1 nộ.",
    effect: { type: "starting_rage", value: 1 }
  },
  {
    id: "pack_mule",
    name: "Dã Thú Chở Đồ",
    group: "FORMATION",
    description: "+1 ô túi đồ (inventory bonus).",
    effect: { type: "inventory_bonus", value: 1 }
  }
];

const GENERATED_VARIANT_PREFIXES: Record<string, string[]> = Object.freeze({
  ECONOMY: ["Mầm", "Lộc", "Rương", "Ngân", "Vượng"],
  COMBAT: ["Vuốt", "Nanh", "Giáp", "Cuồng", "Thép"],
  FORMATION: ["Đàn", "Bầy", "Ổ", "Kho", "Lệnh"],
  SYNERGY: ["Âm", "Mạch", "Vọng", "Ấn", "Hợp"]
});

const GENERATED_AUGMENT_TEMPLATES: readonly GeneratedAugmentTemplate[] = Object.freeze([
  {
    key: "gold_cache",
    title: "Kim Khố",
    group: "ECONOMY",
    effectType: "gold_flat",
    values: [4, 6, 8, 10, 12],
    describe: (value) => `Nhận +${value} vàng ngay lập tức.`
  },
  {
    key: "reroll_bargain",
    title: "Đổi Dịch",
    group: "ECONOMY",
    effectType: "roll_cost_delta",
    values: [-1, -1, -1, -1, -2],
    describe: (value) => `Đổi tướng giảm ${Math.abs(value)} vàng (tối thiểu còn 1).`
  },
  {
    key: "xp_sprout",
    title: "Tri Thức",
    group: "ECONOMY",
    effectType: "xp_flat",
    values: [6, 8, 10, 12, 14],
    describe: (value) => `Nhận +${value} XP ngay lập tức.`
  },
  {
    key: "xp_discount",
    title: "Học Lộ",
    group: "ECONOMY",
    effectType: "xp_cost_delta",
    values: [-1, -1, -1, -1, -2],
    describe: (value) => `Chi phí mua XP giảm ${Math.abs(value)} vàng.`
  },
  {
    key: "victory_gold",
    title: "Chiến Công",
    group: "ECONOMY",
    effectType: "win_gold_bonus",
    values: [1, 1, 2, 2, 3],
    describe: (value) => `Nhận +${value} vàng sau mỗi vòng thắng.`
  },
  {
    key: "interest_flow",
    title: "Dòng Lãi",
    group: "ECONOMY",
    effectType: "interest_rate_bonus",
    values: [0.01, 0.01, 0.02, 0.02, 0.03],
    describe: (value) => `Lãi suất tăng thêm ${Math.round(value * 100)}%.`
  },
  {
    key: "battle_claw",
    title: "Chiến Trảo",
    group: "COMBAT",
    effectType: "team_atk_pct",
    values: [0.05, 0.07, 0.09, 0.11, 0.13],
    describe: (value) => `Toàn đội +${Math.round(value * 100)}% công vật lý.`
  },
  {
    key: "iron_bark",
    title: "Thân Thiết",
    group: "COMBAT",
    effectType: "team_def_pct",
    values: [0.05, 0.07, 0.09, 0.11, 0.13],
    describe: (value) => `Toàn đội +${Math.round(value * 100)}% giáp.`
  },
  {
    key: "wild_vigor",
    title: "Sinh Lực",
    group: "COMBAT",
    effectType: "team_hp_pct",
    values: [0.05, 0.07, 0.09, 0.11, 0.13],
    describe: (value) => `Toàn đội +${Math.round(value * 100)}% máu.`
  },
  {
    key: "arcane_resin",
    title: "Pháp Nhựa",
    group: "COMBAT",
    effectType: "team_matk_pct",
    values: [0.05, 0.07, 0.09, 0.11, 0.13],
    describe: (value) => `Toàn đội +${Math.round(value * 100)}% công phép.`
  },
  {
    key: "mystic_shell",
    title: "Tâm Giáp",
    group: "COMBAT",
    effectType: "team_mdef_pct",
    values: [0.05, 0.07, 0.09, 0.11, 0.13],
    describe: (value) => `Toàn đội +${Math.round(value * 100)}% kháng phép.`
  },
  {
    key: "opening_beat",
    title: "Khai Nộ",
    group: "COMBAT",
    effectType: "starting_rage",
    values: [1, 1, 1, 2, 2],
    describe: (value) => `Đồng minh bắt đầu giao tranh với +${value} nộ.`
  },
  {
    key: "shield_seed",
    title: "Khiên Mầm",
    group: "COMBAT",
    effectType: "starting_shield",
    values: [18, 24, 30, 36, 42],
    describe: (value) => `Mỗi tướng có +${value} khiên đầu giao tranh.`
  },
  {
    key: "bloodvine",
    title: "Huyết Đằng",
    group: "COMBAT",
    effectType: "lifesteal_pct",
    values: [0.04, 0.05, 0.06, 0.08, 0.1],
    describe: (value) => `Đơn vị vật lý hồi ${Math.round(value * 100)}% sát thương gây ra.`
  },
  {
    key: "savings_root",
    title: "Trần Lãi",
    group: "ECONOMY",
    effectType: "interest_cap",
    values: [1, 1, 1, 2, 2],
    describe: (value) => `+${value} trần lãi.`
  },
  {
    key: "march_order",
    title: "Triển Quân",
    group: "FORMATION",
    effectType: "deploy_cap_bonus",
    values: [1, 1, 1, 1, 1],
    describe: (value) => `+${value} giới hạn triển khai.`
  },
  {
    key: "bench_expansion",
    title: "Dự Bị",
    group: "FORMATION",
    effectType: "bench_bonus",
    values: [1, 1, 2, 2, 3],
    describe: (value) => `+${value} ô dự bị.`
  },
  {
    key: "pack_growth",
    title: "Túi Rừng",
    group: "FORMATION",
    effectType: "inventory_bonus",
    values: [1, 1, 2, 2, 3],
    describe: (value) => `+${value} ô túi đồ.`
  },
  {
    key: "class_echo",
    title: "Nghề Cộng Hưởng",
    group: "SYNERGY",
    effectType: "extra_class_count",
    values: [1, 1, 1, 1, 1],
    describe: (value) => `Tăng +${value} mốc cộng hưởng Nghề cao nhất (tối đa +1 mốc).`
  },
  {
    key: "tribe_echo",
    title: "Tộc Cộng Hưởng",
    group: "SYNERGY",
    effectType: "extra_tribe_count",
    values: [1, 1, 1, 1, 1],
    describe: (value) => `Tăng +${value} mốc cộng hưởng Tộc cao nhất (tối đa +1 mốc).`
  }
]);

function buildGeneratedAugmentName(group: AugmentGroup, title: string, index: number): string {
  const prefixes = GENERATED_VARIANT_PREFIXES[group] ?? GENERATED_VARIANT_PREFIXES.COMBAT;
  return `${prefixes[index] ?? prefixes[prefixes.length - 1]} ${title}`;
}

function buildGeneratedAugments(): AugmentDefinition[] {
  const generated: AugmentDefinition[] = [];
  const usedIds = new Set<string>(BASE_AUGMENT_LIBRARY.map((entry) => entry.id));
  const usedNames = new Set<string>(BASE_AUGMENT_LIBRARY.map((entry) => entry.name));

  GENERATED_AUGMENT_TEMPLATES.forEach((template) => {
    template.values.forEach((value, index) => {
      const id = `generated_${template.key}_${index + 1}`;
      const name = buildGeneratedAugmentName(template.group, template.title, index);
      if (usedIds.has(id)) throw new Error(`Duplicate augment id generated: ${id}`);
      if (usedNames.has(name)) throw new Error(`Duplicate augment name generated: ${name}`);
      usedIds.add(id);
      usedNames.add(name);
      generated.push({
        id,
        name,
        group: template.group,
        description: template.describe(value),
        effect: { type: template.effectType, value }
      });
    });
  });

  if (generated.length !== 100) {
    throw new Error(`Expected 100 generated augments, received ${generated.length}`);
  }

  return generated;
}

export const AUGMENT_LIBRARY: readonly AugmentDefinition[] = Object.freeze([
  ...BASE_AUGMENT_LIBRARY,
  ...buildGeneratedAugments()
]);
