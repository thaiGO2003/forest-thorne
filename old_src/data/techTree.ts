/**
 * techTree.js — Dữ liệu Sơ đồ công nghệ (Tech Tree)
 *
 * Mỗi node có:
 *   id        — mã duy nhất
 *   name      — tên hiển thị
 *   icon      — emoji
 *   branch    — nhánh (ROOT / VET / EXPLORE / ECON / MIL / CRAFT)
 *   requires  — id node cha hoặc mảng id node cha (null = gốc)
 *   costs     — mảng giá cho mỗi lần mua, hoặc { base, perLevel } nếu ♾️
 *   maxBuy    — số lần mua tối đa (Infinity = ♾️)
 *   effects   — mảng hiệu ứng mỗi lần mua [{ type, value }]
 *   desc      — mô tả ngắn
 */
export type TechBranch = "ROOT" | "VET" | "EXPLORE" | "ECON" | "MIL" | "CRAFT";
export type TechEffectType =
  | "team_hp_pct" | "team_atk_pct" | "team_matk_pct" | "team_def_pct" | "team_mdef_pct"
  | "team_crit_pct" | "deploy_cap_bonus" | "bench_bonus" | "bench_upgrade"
  | "inventory_bonus" | "inventory_upgrade" | "starting_rage" | "starting_shield"
  | "unequip_discount" | "interest_cap" | "interest_rate_bonus" | "fixed_income"
  | "win_gold_bonus" | "xp_cost_delta" | "roll_cost_delta" | "lifesteal_pct"
  | "rage_gain_pct" | "craft_table_upgrade" | "speed_upgrade" | "extra_class_count"
  | "extra_tribe_count";

export interface TechEffect {
  type: TechEffectType;
  value: number;
}

export interface TechCostScale {
  base: number;
  perLevel: number;
}

export type TechCosts = readonly number[] | TechCostScale;
export type TechRequirement = string | readonly string[] | null;

export interface TechNode {
  id: string;
  name: string;
  icon: string;
  branch: TechBranch;
  requires: TechRequirement;
  costs: TechCosts;
  maxBuy: number;
  effects: readonly TechEffect[];
  desc: string;
}

export interface TechBranchInfo {
  label: string;
  color: number;
}

interface TechTrack {
  idPrefix: string;
  name: string;
  icon: string;
  branch: TechBranch;
  anchor: string;
  costs: readonly number[];
  stages: readonly (readonly TechEffect[])[];
}

export const TECH_BRANCH_ORDER: readonly Exclude<TechBranch, "ROOT">[] = ["VET", "EXPLORE", "ECON", "MIL", "CRAFT"];

// ── Nhánh & màu ──
export const TECH_BRANCHES: Record<TechBranch, TechBranchInfo> = {
  ROOT: { label: "Đại Ngàn", color: 0x4caf50 },
  VET: { label: "Thú Y", color: 0xef5350 },
  EXPLORE: { label: "Khám Phá", color: 0x42a5f5 },
  ECON: { label: "Kinh Tế", color: 0xffc107 },
  MIL: { label: "Quân Sự", color: 0xff7043 },
  CRAFT: { label: "Thủ Công", color: 0xab47bc }
};

const BASE_TECH_NODES: TechNode[] = [
  // ─── GỐC ───
  {
    id: "root",
    name: "Đại Ngàn",
    icon: "🌳",
    branch: "ROOT",
    requires: null,
    costs: [],
    maxBuy: 0,
    effects: [],
    desc: "Khởi nguồn sức mạnh của khu rừng."
  },

  // ─── NHÁNH THÚ Y ───
  {
    id: "vet",
    name: "Thú Y",
    icon: "🩺",
    branch: "VET",
    requires: "root",
    costs: [4],
    maxBuy: 1,
    effects: [{ type: "team_hp_pct", value: 0.05 }],
    desc: "Toàn đội +5% HP."
  },
  {
    id: "breed",
    name: "Lai Tạo",
    icon: "🧬",
    branch: "VET",
    requires: "vet",
    costs: [8],
    maxBuy: 1,
    effects: [{ type: "deploy_cap_bonus", value: 1 }],
    desc: "+1 giới hạn triển khai."
  },
  {
    id: "fitness",
    name: "Thể Chất",
    icon: "💪",
    branch: "VET",
    requires: "breed",
    costs: [4, 6, 8, 10, 12],
    maxBuy: 5,
    effects: [{ type: "team_hp_pct", value: 0.03 }],
    desc: "+3% HP toàn đội mỗi cấp (max +15%)."
  },
  {
    id: "survive",
    name: "Sinh Tồn",
    icon: "⭐",
    branch: "VET",
    requires: "fitness",
    costs: { base: 10, perLevel: 3 },
    maxBuy: Infinity,
    effects: [{ type: "starting_shield", value: 15 }],
    desc: "+15 khiên đầu giao tranh mỗi cấp."
  },

  // ─── NHÁNH KHÁM PHÁ ───
  {
    id: "explore",
    name: "Khám Phá",
    icon: "🗺️",
    branch: "EXPLORE",
    requires: "root",
    costs: [4],
    maxBuy: 1,
    effects: [{ type: "bench_bonus", value: 2 }],
    desc: "+2 ô dự bị."
  },
  {
    id: "bench_up",
    name: "Dự Bị",
    icon: "🏕️",
    branch: "EXPLORE",
    requires: "explore",
    costs: [10],
    maxBuy: 1,
    effects: [{ type: "bench_upgrade", value: 1 }],
    desc: "Nâng dự bị lên 14 ô."
  },
  {
    id: "inv_up",
    name: "Kho Đồ",
    icon: "🎒",
    branch: "EXPLORE",
    requires: "explore",
    costs: [5],
    maxBuy: 1,
    effects: [{ type: "inventory_upgrade", value: 1 }],
    desc: "Nâng kho đồ lên 16 ô."
  },
  {
    id: "barracks",
    name: "Doanh Trại",
    icon: "🏗️",
    branch: "EXPLORE",
    requires: "bench_up",
    costs: [5, 8, 12],
    maxBuy: 3,
    effects: [{ type: "bench_bonus", value: 2 }],
    desc: "+2 ô dự bị mỗi cấp (max +6)."
  },
  {
    id: "territory",
    name: "Lãnh Thổ",
    icon: "🏴",
    branch: "EXPLORE",
    requires: "barracks",
    costs: { base: 8, perLevel: 2 },
    maxBuy: Infinity,
    effects: [{ type: "inventory_bonus", value: 2 }],
    desc: "+2 ô kho đồ mỗi cấp."
  },

  // ─── NHÁNH KINH TẾ ───
  {
    id: "econ",
    name: "Kinh Tế",
    icon: "💰",
    branch: "ECON",
    requires: "root",
    costs: [3],
    maxBuy: 1,
    effects: [{ type: "interest_cap", value: 1 }],
    desc: "+1 trần lãi (5→6)."
  },
  {
    id: "trade",
    name: "Thương Mại",
    icon: "🤝",
    branch: "ECON",
    requires: "econ",
    costs: [5],
    maxBuy: 1,
    effects: [{ type: "xp_cost_delta", value: -1 }],
    desc: "Chi phí mua XP -1🪙 (4→3, min 1)."
  },
  {
    id: "invest",
    name: "Đầu Tư",
    icon: "📈",
    branch: "ECON",
    requires: "trade",
    costs: [4, 6, 8, 10],
    maxBuy: 4,
    effects: [{ type: "interest_cap", value: 1 }],
    desc: "+1 trần lãi mỗi cấp (max +4)."
  },
  {
    id: "tycoon",
    name: "Tài Phiệt",
    icon: "🏦",
    branch: "ECON",
    requires: "invest",
    costs: { base: 8, perLevel: 3 },
    maxBuy: Infinity,
    effects: [{ type: "fixed_income", value: 1 }],
    desc: "+1🪙 thu nhập vàng cố định mỗi cấp."
  },

  // ─── NHÁNH QUÂN SỰ ───
  {
    id: "mil",
    name: "Quân Sự",
    icon: "⚔️",
    branch: "MIL",
    requires: "root",
    costs: [4],
    maxBuy: 1,
    effects: [{ type: "team_atk_pct", value: 0.08 }],
    desc: "Toàn đội +8% ATK."
  },
  {
    id: "train",
    name: "Rèn Luyện",
    icon: "🏋️",
    branch: "MIL",
    requires: "mil",
    costs: [7],
    maxBuy: 1,
    effects: [{ type: "starting_rage", value: 1 }],
    desc: "+1 nộ đầu giao tranh cho mỗi unit."
  },
  {
    id: "beast",
    name: "Mãnh Thú",
    icon: "🔥",
    branch: "MIL",
    requires: "train",
    costs: [4, 6, 8, 10, 12],
    maxBuy: 5,
    effects: [
      { type: "team_atk_pct", value: 0.02 },
      { type: "team_crit_pct", value: 0.01 }
    ],
    desc: "+2% ATK + 1% crit mỗi cấp."
  },
  {
    id: "warlord",
    name: "Chiến Thần",
    icon: "🎯",
    branch: "MIL",
    requires: "beast",
    costs: { base: 10, perLevel: 3 },
    maxBuy: Infinity,
    effects: [{ type: "team_atk_pct", value: 0.03 }],
    desc: "+3% ATK toàn đội mỗi cấp."
  },

  // ─── NHÁNH THỦ CÔNG ───
  {
    id: "craft_t",
    name: "Thủ Công",
    icon: "🔨",
    branch: "CRAFT",
    requires: "root",
    costs: [5, 10, 15],
    maxBuy: 3,
    effects: [{ type: "craft_table_upgrade", value: 1 }],
    desc: "Nâng bàn chế tạo: 1x1→2x2→3x3."
  },
  {
    id: "speed",
    name: "Tốc Độ",
    icon: "⚡",
    branch: "CRAFT",
    requires: "root",
    costs: [3],
    maxBuy: 10,
    effects: [{ type: "speed_upgrade", value: 1 }],
    desc: "Mỗi cấp tăng thêm 0.5x tốc độ game, tối đa cấp 10."
  },
  {
    id: "metal",
    name: "Luyện Kim",
    icon: "⚙️",
    branch: "CRAFT",
    requires: "craft_t",
    costs: [4, 7, 10],
    maxBuy: 3,
    effects: [{ type: "unequip_discount", value: 1 }],
    desc: "Tháo đồ giảm 1🪙/cấp (tối thiểu 1🪙)."
  },
  {
    id: "arcane",
    name: "Huyền Bí",
    icon: "🔮",
    branch: "CRAFT",
    requires: "metal",
    costs: [6, 10],
    maxBuy: 2,
    effects: [
      { type: "team_matk_pct", value: 0.08 },
      { type: "team_mdef_pct", value: 0.08 }
    ],
    desc: "Lần 1: +8% MATK. Lần 2: thêm +8% MDEF."
  }
];

const ROMAN: readonly string[] = ["I", "II", "III", "IV"];

type EffectFormatter = (value: number) => string;
const EFFECT_DESCRIPTIONS: Partial<Record<TechEffectType, EffectFormatter>> = {
  team_hp_pct: (value: number) => `+${Math.round(value * 100)}% HP toàn đội`,
  team_atk_pct: (value: number) => `+${Math.round(value * 100)}% công vật lý`,
  team_matk_pct: (value: number) => `+${Math.round(value * 100)}% công phép`,
  team_def_pct: (value: number) => `+${Math.round(value * 100)}% giáp toàn đội`,
  team_mdef_pct: (value: number) => `+${Math.round(value * 100)}% kháng phép`,
  team_crit_pct: (value: number) => `+${Math.round(value * 100)}% chí mạng`,
  deploy_cap_bonus: (value: number) => `+${value} giới hạn triển khai`,
  bench_bonus: (value: number) => `+${value} ô dự bị`,
  inventory_bonus: (value: number) => `+${value} ô kho đồ`,
  starting_rage: (value: number) => `+${value} nộ đầu giao tranh`,
  starting_shield: (value: number) => `+${value} khiên đầu giao tranh`,
  unequip_discount: (value: number) => `Tháo đồ giảm ${Math.abs(value)}🪙`,
  interest_cap: (value: number) => `+${value} trần lãi`,
  interest_rate_bonus: (value: number) => `+${Math.round(value * 100)}% lãi suất`,
  fixed_income: (value: number) => `+${value}🪙 thu nhập cố định`,
  win_gold_bonus: (value: number) => `+${value}🪙 sau trận thắng`,
  xp_cost_delta: (value: number) => `Mua XP ${value}🪙`,
  roll_cost_delta: (value: number) => `Đổi shop ${value}🪙`,
  lifesteal_pct: (value: number) => `+${Math.round(value * 100)}% hút máu`,
  rage_gain_pct: (value: number) => `+${Math.round(value * 100)}% tốc độ hồi nộ`,
  craft_table_upgrade: (value: number) => `+${value} cấp bàn chế tạo`,
  speed_upgrade: (value: number) => `+${value} cấp tốc độ`,
  extra_class_count: (value: number) => `+${value} mốc nghề cao nhất`,
  extra_tribe_count: (value: number) => `+${value} mốc tộc cao nhất`
};

function linearEffectStages(type: TechEffectType, values: readonly number[]): TechEffect[][] {
  return values.map((value) => [{ type, value }]);
}

function describeEffects(effects: readonly TechEffect[]): string {
  return effects
    .map((effect) => {
      const formatter = EFFECT_DESCRIPTIONS[effect.type];
      return formatter ? formatter(effect.value) : `${effect.type}: ${effect.value}`;
    })
    .join(" + ") + ".";
}

function createTrackNodes(track: TechTrack): TechNode[] {
  let parentId = track.anchor;
  return track.stages.map((effects, index) => {
    const node: TechNode = {
      id: `${track.idPrefix}_${index + 1}`,
      name: `${track.name} ${ROMAN[index]}`,
      icon: track.icon,
      branch: track.branch,
      requires: parentId,
      costs: [track.costs[index]],
      maxBuy: 1,
      effects,
      desc: describeEffects(effects)
    };
    parentId = node.id;
    return node;
  });
}

const EXTRA_TECH_TRACKS: TechTrack[] = [
  // ─── THÚ Y: +20 node ───
  {
    idPrefix: "herb_lore",
    name: "Dược Liệu",
    icon: "🌿",
    branch: "VET",
    anchor: "breed",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("team_hp_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "bark_guard",
    name: "Giáp Vỏ",
    icon: "🛡️",
    branch: "VET",
    anchor: "fitness",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("starting_shield", [6, 10, 14, 18])
  },
  {
    idPrefix: "soothing_mist",
    name: "Sương Lành",
    icon: "💧",
    branch: "VET",
    anchor: "survive",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("team_mdef_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "wild_fang",
    name: "Nanh Sống",
    icon: "🐾",
    branch: "VET",
    anchor: "fitness",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("lifesteal_pct", [0.02, 0.03, 0.04, 0.05])
  },
  {
    idPrefix: "stone_hide",
    name: "Da Cứng",
    icon: "🐢",
    branch: "VET",
    anchor: "survive",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("team_def_pct", [0.01, 0.015, 0.02, 0.025])
  },

  // ─── KHÁM PHÁ: +20 node ───
  {
    idPrefix: "trail_pack",
    name: "Đường Mòn",
    icon: "🧭",
    branch: "EXPLORE",
    anchor: "explore",
    costs: [5, 7, 9, 11],
    stages: linearEffectStages("bench_bonus", [1, 1, 2, 2])
  },
  {
    idPrefix: "field_cache",
    name: "Tiền Trạm",
    icon: "🎒",
    branch: "EXPLORE",
    anchor: "bench_up",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("inventory_bonus", [1, 1, 1, 2])
  },
  {
    idPrefix: "ranger_banner",
    name: "Cột Mốc",
    icon: "🚩",
    branch: "EXPLORE",
    anchor: "inv_up",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("deploy_cap_bonus", [1, 1, 1, 1])
  },
  {
    idPrefix: "scout_bounty",
    name: "Chiến Lợi",
    icon: "🪙",
    branch: "EXPLORE",
    anchor: "barracks",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("win_gold_bonus", [1, 1, 1, 2])
  },
  {
    idPrefix: "map_rewrite",
    name: "Bản Đồ",
    icon: "📜",
    branch: "EXPLORE",
    anchor: "territory",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("roll_cost_delta", [-1, -1, -1, -1])
  },

  // ─── KINH TẾ: +20 node ───
  {
    idPrefix: "bank_roots",
    name: "Ngân Quỹ",
    icon: "🏦",
    branch: "ECON",
    anchor: "econ",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("interest_cap", [1, 1, 1, 1])
  },
  {
    idPrefix: "coin_flow",
    name: "Dòng Tiền",
    icon: "💸",
    branch: "ECON",
    anchor: "trade",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("fixed_income", [1, 1, 1, 1])
  },
  {
    idPrefix: "compound_seed",
    name: "Lãi Kép",
    icon: "📈",
    branch: "ECON",
    anchor: "invest",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("interest_rate_bonus", [0.01, 0.01, 0.02, 0.02])
  },
  {
    idPrefix: "guild_trade",
    name: "Hội Chợ",
    icon: "🤝",
    branch: "ECON",
    anchor: "tycoon",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("win_gold_bonus", [1, 1, 1, 2])
  },
  {
    idPrefix: "scholar_fund",
    name: "Quỹ Học",
    icon: "📚",
    branch: "ECON",
    anchor: "invest",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("xp_cost_delta", [-1, -1, -1, -1])
  },

  // ─── QUÂN SỰ: +20 node ───
  {
    idPrefix: "war_drum",
    name: "Chiến Ca",
    icon: "🥁",
    branch: "MIL",
    anchor: "mil",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("team_atk_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "iron_wall",
    name: "Thiết Bích",
    icon: "🧱",
    branch: "MIL",
    anchor: "train",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("team_def_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "eagle_eye",
    name: "Ưng Nhãn",
    icon: "🎯",
    branch: "MIL",
    anchor: "beast",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("team_crit_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "blood_oath",
    name: "Huyết Lệnh",
    icon: "🩸",
    branch: "MIL",
    anchor: "warlord",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("starting_rage", [1, 1, 1, 1])
  },
  {
    idPrefix: "battle_tempo",
    name: "Chiến Tốc",
    icon: "⚡",
    branch: "MIL",
    anchor: "beast",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("rage_gain_pct", [0.05, 0.08, 0.1, 0.12])
  },

  // ─── THỦ CÔNG: +20 node ───
  {
    idPrefix: "arc_weld",
    name: "Hồ Quang",
    icon: "🔥",
    branch: "CRAFT",
    anchor: "craft_t",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("team_matk_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "ward_forge",
    name: "Pháp Ấn",
    icon: "🔷",
    branch: "CRAFT",
    anchor: "metal",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("team_mdef_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "steel_lattice",
    name: "Giàn Thép",
    icon: "⛓️",
    branch: "CRAFT",
    anchor: "metal",
    costs: [7, 9, 11, 13],
    stages: linearEffectStages("team_def_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "quick_hands",
    name: "Tinh Xảo",
    icon: "🧰",
    branch: "CRAFT",
    anchor: "speed",
    costs: [6, 8, 10, 12],
    stages: linearEffectStages("unequip_discount", [1, 1, 1, 1])
  },
  {
    idPrefix: "alchemy_pulse",
    name: "Luyện Dược",
    icon: "⚗️",
    branch: "CRAFT",
    anchor: "arcane",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("lifesteal_pct", [0.01, 0.015, 0.02, 0.025])
  }
];
const NEW_EXPANSION_TECH_TRACKS: TechTrack[] = [
  {
    idPrefix: "moon_ward",
    name: "Nguyệt Hộ",
    icon: "🌙",
    branch: "VET",
    anchor: "survive",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("team_mdef_pct", [0.01, 0.015, 0.02, 0.025])
  },
  {
    idPrefix: "supply_line",
    name: "Tuyến Tiếp Tế",
    icon: "📦",
    branch: "EXPLORE",
    anchor: "territory",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("inventory_bonus", [1, 1, 1, 2])
  },
  {
    idPrefix: "ledger_root",
    name: "Sổ Gốc",
    icon: "🧾",
    branch: "ECON",
    anchor: "tycoon",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("fixed_income", [1, 1, 1, 1])
  },
  {
    idPrefix: "blood_banner",
    name: "Huyết Kỳ",
    icon: "🚩",
    branch: "MIL",
    anchor: "warlord",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("rage_gain_pct", [0.04, 0.06, 0.08, 0.1])
  },
  {
    idPrefix: "runic_forge",
    name: "Lò Phù Văn",
    icon: "✨",
    branch: "CRAFT",
    anchor: "arcane",
    costs: [8, 10, 12, 14],
    stages: linearEffectStages("team_matk_pct", [0.01, 0.015, 0.02, 0.025])
  }
];

const DUAL_PREREQ_CAPSTONES: TechNode[] = [
  {
    id: "alpha_doctrine",
    name: "Học Thuyết Alpha",
    icon: "🐺",
    branch: "VET",
    requires: ["survive", "beast"],
    costs: [18],
    maxBuy: 1,
    effects: [
      { type: "team_hp_pct", value: 0.05 },
      { type: "lifesteal_pct", value: 0.03 }
    ],
    desc: describeEffects([
      { type: "team_hp_pct", value: 0.05 },
      { type: "lifesteal_pct", value: 0.03 }
    ])
  },
  {
    id: "frontier_exchange",
    name: "Mậu Dịch Biên Cương",
    icon: "🛣️",
    branch: "EXPLORE",
    requires: ["territory", "tycoon"],
    costs: [18],
    maxBuy: 1,
    effects: [
      { type: "inventory_bonus", value: 2 },
      { type: "fixed_income", value: 1 }
    ],
    desc: describeEffects([
      { type: "inventory_bonus", value: 2 },
      { type: "fixed_income", value: 1 }
    ])
  },
  {
    id: "war_tax",
    name: "Thuế Chiến Tranh",
    icon: "💹",
    branch: "ECON",
    requires: ["invest", "train"],
    costs: [16],
    maxBuy: 1,
    effects: [
      { type: "win_gold_bonus", value: 2 },
      { type: "interest_cap", value: 1 }
    ],
    desc: describeEffects([
      { type: "win_gold_bonus", value: 2 },
      { type: "interest_cap", value: 1 }
    ])
  },
  {
    id: "siege_ritual",
    name: "Nghi Lễ Công Thành",
    icon: "🪓",
    branch: "MIL",
    requires: ["warlord", "arcane"],
    costs: [20],
    maxBuy: 1,
    effects: [
      { type: "team_atk_pct", value: 0.05 },
      { type: "team_matk_pct", value: 0.05 }
    ],
    desc: describeEffects([
      { type: "team_atk_pct", value: 0.05 },
      { type: "team_matk_pct", value: 0.05 }
    ])
  },
  {
    id: "beast_foundry",
    name: "Lò Rèn Dã Thú",
    icon: "🏭",
    branch: "CRAFT",
    requires: ["survive", "metal"],
    costs: [18],
    maxBuy: 1,
    effects: [
      { type: "starting_shield", value: 20 },
      { type: "team_def_pct", value: 0.05 }
    ],
    desc: describeEffects([
      { type: "starting_shield", value: 20 },
      { type: "team_def_pct", value: 0.05 }
    ])
  }
];

export const TECH_NODES: TechNode[] = [
  ...BASE_TECH_NODES,
  ...EXTRA_TECH_TRACKS.flatMap(createTrackNodes),
  ...NEW_EXPANSION_TECH_TRACKS.flatMap(createTrackNodes),
  ...DUAL_PREREQ_CAPSTONES
];

// ── Lookup nhanh ──
export const TECH_BY_ID: Record<string, TechNode> = {};
TECH_NODES.forEach((node) => {
  TECH_BY_ID[node.id] = node;
});

function normalizeTechRequirementIds(requires: TechRequirement | undefined): string[] {
  if (Array.isArray(requires)) {
    return requires.filter((requirement): requirement is string => typeof requirement === "string" && requirement.length > 0);
  }
  return typeof requires === "string" && requires.length > 0 ? [requires] : [];
}

export function getTechRequirementIds(
  nodeOrId: TechNode | string | null | undefined,
  lookup: Record<string, TechNode> = TECH_BY_ID
): string[] {
  const node = typeof nodeOrId === "string" ? (lookup[nodeOrId] ?? TECH_BY_ID[nodeOrId]) : nodeOrId;
  return normalizeTechRequirementIds(node?.requires);
}

export function getTechLayoutParentId(
  nodeOrId: TechNode | string | null | undefined,
  lookup: Record<string, TechNode> = TECH_BY_ID
): string | null {
  const node = typeof nodeOrId === "string" ? (lookup[nodeOrId] ?? TECH_BY_ID[nodeOrId]) : nodeOrId;
  if (!node) return null;
  const requirementIds = getTechRequirementIds(node, lookup);
  const sameBranchRequirement = requirementIds.find((requirementId) => (lookup[requirementId] ?? TECH_BY_ID[requirementId])?.branch === node.branch);
  return sameBranchRequirement ?? requirementIds[0] ?? null;
}

export type TechLevels = Record<string, number>;
export function areTechRequirementsMet(nodeOrId: TechNode | string | null | undefined, techLevels: TechLevels): boolean {
  const requirementIds = getTechRequirementIds(nodeOrId);
  if (!requirementIds.length) return true;
  return requirementIds.every((requirementId) => {
    const parent = TECH_BY_ID[requirementId];
    if (!parent) return false;
    if (parent.maxBuy === 0) return true;
    return (techLevels[requirementId] ?? 0) > 0;
  });
}

/**
 * Lấy chi phí mua tech ở lần thứ `currentLevel` (0-based).
 * Trả về Infinity nếu đã max.
 */
export function getTechCost(techId: string, currentLevel: number): number {
  const node = TECH_BY_ID[techId];
  if (!node) return Infinity;
  if (currentLevel >= node.maxBuy) return Infinity;

  if (Array.isArray(node.costs)) {
    return node.costs[currentLevel] ?? node.costs[node.costs.length - 1] ?? Infinity;
  }
  if ("base" in node.costs) {
    return node.costs.base + node.costs.perLevel * currentLevel;
  }
  return Infinity;
}

/** Kiểm tra xem có thể nghiên cứu tech này không. */
export function canResearch(techId: string, techLevels: TechLevels, gold: number): boolean {
  const node = TECH_BY_ID[techId];
  if (!node) return false;

  const currentLevel = techLevels[techId] ?? 0;
  if (currentLevel >= node.maxBuy) return false;
  if (!areTechRequirementsMet(node, techLevels)) return false;

  const cost = getTechCost(techId, currentLevel);
  return gold >= cost;
}

/** Kiểm tra node đã mở khóa (có thể nhìn thấy, dù chưa đủ tiền). */
export function isUnlocked(techId: string, techLevels: TechLevels): boolean {
  const node = TECH_BY_ID[techId];
  if (!node) return false;
  return areTechRequirementsMet(node, techLevels);
}

/** Tính tổng hiệu ứng tech đã nghiên cứu. */
export function computeTechBonuses(techLevels: TechLevels): Partial<Record<TechEffectType, number>> {
  const bonuses: Partial<Record<TechEffectType, number>> = {};
  for (const node of TECH_NODES) {
    const level = techLevels[node.id] ?? 0;
    if (level <= 0) continue;

    for (const effect of node.effects) {
      if (node.id === "arcane") {
        bonuses.team_matk_pct = (bonuses.team_matk_pct ?? 0) + 0.08;
        if (level >= 2) {
          bonuses.team_mdef_pct = (bonuses.team_mdef_pct ?? 0) + 0.08;
        }
        break;
      }

      bonuses[effect.type] = (bonuses[effect.type] ?? 0) + effect.value * level;
    }
  }
  return bonuses;
}
