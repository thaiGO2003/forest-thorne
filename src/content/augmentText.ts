// Player-facing copy for augment ("mod") effects. The canonical table in core/augments.ts only
// stores machine ids and numbers, so the Information modal used to print raw ids such as
// `xp_discount_4` and `xp_cost_delta`. This module turns an id into a themed name, a one-line
// explanation and a signed value that matches how the effect is actually applied.
import { AUGMENT_BY_ID, type AugGroup, type Augment } from "../core/augments";
import { ICONS } from "../core/emojiIcon";

export interface AugmentCopy {
  id: string;
  name: string;
  summary: string;
  /** Signed, unit-aware value such as "+4", "−1", "+5%". */
  value: string;
  group: AugGroup;
  icon: string;
}

const GROUP_ICON: Record<AugGroup, string> = {
  ECONOMY: ICONS.gold,
  FORMATION: ICONS.synergy,
  COMBAT: ICONS.start,
  SYNERGY: ICONS.synergy,
};

const GROUP_LABEL: Record<AugGroup, string> = {
  ECONOMY: "Kinh tế",
  FORMATION: "Đội hình",
  COMBAT: "Chiến đấu",
  SYNERGY: "Cộng hưởng",
};

interface EffectCopy {
  name: string;
  summary: string;
  /** "percent" renders value*100 with a % suffix; "flat" renders the integer as-is. */
  unit: "flat" | "percent" | "rate";
}

const EFFECTS: Record<string, EffectCopy> = {
  gold_flat: { name: "Kho vàng", summary: "Nhận vàng ngay khi chọn", unit: "flat" },
  roll_cost_delta: { name: "Mặc cả đổi thú", summary: "Giảm giá đổi thú ở cửa hàng", unit: "flat" },
  xp_flat: { name: "Mầm tri thức", summary: "Nhận XP ngay khi chọn", unit: "flat" },
  xp_cost_delta: { name: "Học phí rừng", summary: "Giảm giá mua XP", unit: "flat" },
  win_gold_bonus: { name: "Chiến lợi phẩm", summary: "Thêm vàng sau mỗi trận thắng", unit: "flat" },
  interest_rate_bonus: { name: "Lãi rừng", summary: "Tăng lãi tiết kiệm mỗi vòng", unit: "rate" },
  heart_recovery: { name: "Nhịp tim", summary: "Hồi tim ngay, không vượt mức khởi đầu", unit: "flat" },

  team_atk_pct: { name: "Nanh vuốt đội", summary: "Cộng tấn công cho toàn đội", unit: "percent" },
  team_def_pct: { name: "Da dày đội", summary: "Cộng phòng thủ cho toàn đội", unit: "percent" },
  team_hp_pct: { name: "Sinh lực đội", summary: "Cộng máu cho toàn đội", unit: "percent" },
  team_matk_pct: { name: "Phép lực đội", summary: "Cộng phép lực cho toàn đội", unit: "percent" },
  team_mdef_pct: { name: "Kháng phép đội", summary: "Cộng kháng phép cho toàn đội", unit: "percent" },

  starting_rage: { name: "Cuồng nộ đầu trận", summary: "Nộ khởi đầu khi vào trận", unit: "flat" },
  starting_shield: { name: "Khiên mở màn", summary: "Khiên đầu trận cho toàn đội", unit: "flat" },
  lifesteal_pct: { name: "Hút máu", summary: "Hồi máu theo sát thương gây ra", unit: "percent" },
  heal_hearts_now: { name: "Suối hồi sinh", summary: "Hồi tim ngay lập tức", unit: "flat" },
  heal_hearts_on_win: { name: "Tim chiến thắng", summary: "Hồi tim sau mỗi chiến thắng", unit: "flat" },
  heal_hearts_on_survived_loss: { name: "Tim sống sót", summary: "Hồi tim khi thua nhưng chưa kết thúc ván", unit: "flat" },

  interest_cap: { name: "Trần lãi", summary: "Nâng trần lãi mỗi vòng", unit: "flat" },
  deploy_cap_bonus: { name: "Lệnh rừng", summary: "Thêm ô triển khai trên sân", unit: "flat" },
  bench_bonus: { name: "Bãi dự bị", summary: "Thêm chỗ dự bị", unit: "flat" },
  inventory_bonus: { name: "Túi rộng", summary: "Thêm ô túi đồ", unit: "flat" },
  extra_class_count: { name: "Tiếng vọng vai trò", summary: "Đếm thêm một vai trò cho cộng hưởng", unit: "flat" },
  extra_tribe_count: { name: "Tiếng vọng phe", summary: "Đếm thêm một phe cho cộng hưởng", unit: "flat" },
};

const FALLBACK: EffectCopy = { name: "Hiệu ứng", summary: "Hiệu ứng chưa có mô tả", unit: "flat" };

/** Format the augment's stored value using the unit its effect is applied with. */
export function augmentValueText(def: Augment): string {
  const copy = EFFECTS[def.effect] ?? FALLBACK;
  const sign = def.value >= 0 ? "+" : "−";
  const magnitude = Math.abs(def.value);
  if (copy.unit === "percent") return `${sign}${Math.round(magnitude * 100)}%`;
  // Rate bonuses are stored as decimals (0.01 = one percentage point of interest).
  if (copy.unit === "rate") return `${sign}${Math.round(magnitude * 100)}%`;
  return `${sign}${Math.round(magnitude)}`;
}

/** Group label used by the Information modal and the augment choice copy. */
export const augmentGroupLabel = (group: AugGroup): string => GROUP_LABEL[group];

export function augmentCopy(id: string): AugmentCopy {
  const def = AUGMENT_BY_ID.get(id);
  if (!def) {
    return { id, name: "Hiệu ứng không xác định", summary: `Mã cũ: ${id}`, value: "", group: "ECONOMY", icon: ICONS.question };
  }
  const copy = EFFECTS[def.effect] ?? FALLBACK;
  return {
    id,
    name: copy.name,
    summary: copy.summary,
    value: augmentValueText(def),
    group: def.group,
    icon: GROUP_ICON[def.group],
  };
}

/** Sort helper: economy → formation → combat → synergy, matching how the game lists them. */
const GROUP_ORDER: Record<AugGroup, number> = { ECONOMY: 0, FORMATION: 1, COMBAT: 2, SYNERGY: 3 };
export const augmentGroupRank = (group: AugGroup): number => GROUP_ORDER[group];
