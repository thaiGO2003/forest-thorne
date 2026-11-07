export type TutorialText = string | ((context: TutorialTextContext) => string);

export interface TutorialRecommendation {
  classType?: string;
  [key: string]: unknown;
}

export interface TutorialAnchorContext {
  recommendation?: TutorialRecommendation;
  [key: string]: unknown;
}

export interface TutorialSceneContext {
  getTutorialMarker?: (key: string) => unknown;
  [key: string]: unknown;
}

export interface TutorialTextContext {
  anchor?: TutorialAnchorContext;
  scene?: TutorialSceneContext;
  [key: string]: unknown;
}

export interface TutorialTarget {
  kind: string;
  [key: string]: unknown;
}

export interface TutorialIndicator {
  type: "arrow" | "none" | string;
  direction?: "auto" | "up" | "down" | "left" | "right" | string;
}

export interface TutorialCompletionProgress {
  [key: string]: unknown;
}

export interface TutorialCompletionRuleObject {
  kind: string;
  count?: number;
  key?: string;
  itemId?: string;
  slotIndex?: number;
  value?: unknown;
  [key: string]: unknown;
}

export type TutorialCompletionRule =
  | TutorialCompletionRuleObject
  | ((progress: TutorialCompletionProgress, scene: unknown) => boolean)
  | null;

export interface TutorialStep {
  id: string;
  text: TutorialText;
  target: TutorialTarget;
  trigger: string;
  delay: number;
  panelPlacement: "auto" | "center" | string;
  layoutFocus: "target" | "allowedTargets" | string;
  indicator: TutorialIndicator;
  allowedActions: string[];
  allowedTargets: TutorialTarget[];
  completionRule: TutorialCompletionRule;
  allowSettings: boolean;
  allowSkip: boolean;
  blockedHint: string;
}

interface TutorialStepOptions {
  id: string;
  text: TutorialText;
  target?: TutorialTarget;
  trigger?: string;
  delay?: number;
  panelPlacement?: TutorialStep["panelPlacement"];
  layoutFocus?: TutorialStep["layoutFocus"];
  indicator?: TutorialIndicator;
  allowedActions?: string[];
  allowedTargets?: TutorialTarget[];
  completionRule?: TutorialCompletionRule;
  allowSettings?: boolean;
  allowSkip?: boolean;
  blockedHint?: string;
}

type TutorialStepExtras = Partial<Omit<TutorialStep, "id" | "text" | "target" | "trigger" | "delay">>;

function createStep({
  id,
  text,
  target = { kind: "screen", key: "center" },
  trigger = "dismiss",
  delay = 180,
  panelPlacement = "auto",
  layoutFocus = "target",
  indicator = { type: "arrow", direction: "auto" },
  allowedActions = [],
  allowedTargets = [],
  completionRule = null,
  allowSettings = true,
  allowSkip = true,
  blockedHint = "Hãy làm đúng bước hướng dẫn đang được tô sáng."
}: TutorialStepOptions): TutorialStep {
  return {
    id,
    text,
    target,
    trigger,
    delay,
    panelPlacement,
    layoutFocus,
    indicator,
    allowedActions,
    allowedTargets,
    completionRule,
    allowSettings,
    allowSkip,
    blockedHint
  };
}

function createCenterDismissStep(
  id: string,
  text: TutorialText,
  delay = 180,
  extras: TutorialStepExtras = {}
): TutorialStep {
  return createStep({
    id,
    text,
    target: { kind: "screen", key: "center" },
    panelPlacement: "center",
    indicator: { type: "none" },
    trigger: "dismiss",
    delay,
    blockedHint: "Nhấn vào khung hướng dẫn để tiếp tục.",
    ...extras
  });
}

function createArrowStep(
  id: string,
  text: TutorialText,
  target: TutorialTarget,
  trigger: string,
  delay = 180,
  extras: TutorialStepExtras = {}
): TutorialStep {
  return createStep({
    id,
    text,
    target,
    trigger,
    delay,
    panelPlacement: "auto",
    indicator: { type: "arrow", direction: "auto" },
    ...extras
  });
}

const CLASS_ROLE_HINTS: Record<string, string> = {
  TANKER: "🛡 Con này là Đỡ đòn, nên đứng tiền tuyến để hứng sát thương cho cả đội.",
  FIGHTER: "⚔️ Con này là Đấu sĩ, nên đứng hàng trước để lao vào giao tranh sớm.",
  ARCHER: "🏹 Con này là Xạ thủ, nên giữ hàng sau để bắn an toàn.",
  MAGE: "✨ Con này là Pháp sư, nên giữ hàng sau để tung kỹ năng an toàn.",
  SUPPORT: "💚 Con này là Hỗ trợ, nên ở hàng sau để buff và hồi máu cho đồng minh.",
  ASSASSIN: "🗡 Con này là Sát thủ, tạm thời cứ giữ ở hàng sau cho an toàn trong tutorial."
};

export function getTutorialDeployRoleHint(recommendation: TutorialRecommendation | null | undefined): string {
  const classType = recommendation?.classType;
  return typeof classType === "string"
    ? (CLASS_ROLE_HINTS[classType] ?? "📍 Ô này được chọn theo vai trò của quân để đội hình gọn và dễ thắng hơn.")
    : "📍 Ô này được chọn theo vai trò của quân để đội hình gọn và dễ thắng hơn.";
}

function getRound1Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "welcome",
      "🎓 Chào mừng đến Bá Chủ Khu Rừng.\nTutorial này sẽ dẫn bạn qua toàn bộ các tính năng cốt lõi của một ván solo."
    ),
    createArrowStep(
      "buy_unit",
      "👆 Nhấn vào thẻ quân đầu tiên trong cửa hàng để mua linh thú.",
      { kind: "shopFirstAvailable" },
      "buy_unit",
      220,
      {
        allowedActions: ["buy_unit"],
        allowedTargets: [{ kind: "shopFirstAvailable" }],
        completionRule: { kind: "totalOwnedUnitsAtLeast", count: 1 },
        blockedHint: "Hãy mua linh thú ở ô cửa hàng đang được tô sáng."
      }
    ),
    createArrowStep(
      "deploy_first_unit",
      ({ anchor }) => [
        "📌 Tốt. Giờ hãy đưa quân vừa mua lên sân.",
        getTutorialDeployRoleHint(anchor?.recommendation)
      ].join("\n"),
      { kind: "boardRecommendedDeploy" },
      "place_board",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["select_bench", "start_unit_drag", "move_unit"],
        allowedTargets: [
          { kind: "benchFirstOccupied", role: "source" },
          { kind: "boardRecommendedDeploy", role: "destination" }
        ],
        completionRule: { kind: "boardUnitsAtLeast", count: 1 },
        blockedHint: "Hãy chọn quân ở hàng chờ và đặt vào ô sân được gợi ý."
      }
    ),
    createArrowStep(
      "explain_synergy",
      "💡 Đây là khu hiệp đồng.\nGhép thêm quân cùng nghề hoặc cùng tộc sẽ mở mốc sức mạnh mới.",
      { kind: "synergyPanel" },
      "dismiss",
      180,
      {
        blockedHint: "Nhấn vào khung hướng dẫn để tiếp tục."
      }
    ),
    createArrowStep(
      "buy_more",
      "🛒 Mua thêm 1 quân nữa để đội hình mạnh hơn.",
      { kind: "shopFirstAvailable" },
      "buy_unit",
      180,
      {
        allowedActions: ["buy_unit"],
        allowedTargets: [{ kind: "shopFirstAvailable" }],
        completionRule: { kind: "totalOwnedUnitsAtLeast", count: 2 },
        blockedHint: "Hãy mua thêm một quân từ cửa hàng."
      }
    ),
    createArrowStep(
      "deploy_second_unit",
      ({ anchor }) => [
        "🧩 Kéo tiếp quân mới mua lên sân.",
        getTutorialDeployRoleHint(anchor?.recommendation)
      ].join("\n"),
      { kind: "boardRecommendedDeploy" },
      "place_board",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["select_bench", "start_unit_drag", "move_unit"],
        allowedTargets: [
          { kind: "benchFirstOccupied", role: "source" },
          { kind: "boardRecommendedDeploy", role: "destination" }
        ],
        completionRule: { kind: "boardUnitsAtLeast", count: 2 },
        blockedHint: "Hãy đưa quân vừa mua lên ô sân được gợi ý."
      }
    ),
    createArrowStep(
      "start_combat",
      "⚔️ Đội hình đã sẵn sàng. Nhấn Bắt đầu giao tranh.",
      { kind: "button", key: "start" },
      "click_combat",
      220,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }],
        blockedHint: "Khi đã xong lượt, hãy nhấn Bắt đầu giao tranh."
      }
    )
  ];
}

function getRound2Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round2_intro",
      "🌿 Vòng 2. Giờ bạn sẽ làm quen với vàng, XP, giới hạn triển khai và reroll cửa hàng."
    ),
    createArrowStep(
      "explain_gold",
      "🪙 Đây là Vàng. Bạn dùng vàng để mua thú, đổi cửa hàng và mua XP.",
      { kind: "statChip", key: "gold" },
      "dismiss",
      160
    ),
    createArrowStep(
      "explain_xp",
      "✪ Đây là XP. Đầy XP sẽ lên cấp và tăng số thú được triển khai.",
      { kind: "statChip", key: "xp" },
      "dismiss",
      160
    ),
    createArrowStep(
      "explain_deploy_cap",
      "⚒ Đây là giới hạn triển khai hiện tại của bạn.",
      { kind: "statChip", key: "deploy" },
      "dismiss",
      160
    ),
    createArrowStep(
      "explain_roll",
      "🎲 Nhấn Đổi tướng một lần để làm mới cửa hàng.",
      { kind: "button", key: "roll" },
      "roll_shop",
      220,
      {
        allowedActions: ["roll_shop"],
        allowedTargets: [{ kind: "button", key: "roll" }],
        completionRule: { kind: "eventAtLeast", key: "roll_shop", count: 1 },
        blockedHint: "Hãy dùng nút Đổi tướng để làm mới cửa hàng."
      }
    ),
    createArrowStep(
      "round2_buy_unit",
      "🛒 Mua thêm 1 quân từ cửa hàng mới.",
      { kind: "shopFirstAvailable" },
      "buy_unit",
      180,
      {
        allowedActions: ["buy_unit"],
        allowedTargets: [{ kind: "shopFirstAvailable" }],
        completionRule: { kind: "totalOwnedUnitsAtLeast", count: 3 },
        blockedHint: "Hãy mua quân từ cửa hàng vừa được làm mới."
      }
    ),
    createArrowStep(
      "round2_deploy_unit",
      ({ anchor }) => [
        "📌 Đưa quân mới mua lên sân.",
        getTutorialDeployRoleHint(anchor?.recommendation)
      ].join("\n"),
      { kind: "boardRecommendedDeploy" },
      "place_board",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["select_bench", "start_unit_drag", "move_unit"],
        allowedTargets: [
          { kind: "benchFirstOccupied", role: "source" },
          { kind: "boardRecommendedDeploy", role: "destination" }
        ],
        completionRule: { kind: "boardUnitsAtLeast", count: 3 },
        blockedHint: "Hãy đưa quân mới mua lên ô được gợi ý."
      }
    ),
    createArrowStep(
      "round2_buy_unit_second",
      "🛒 Mua thêm 1 quân nữa.",
      { kind: "shopFirstAvailable" },
      "buy_unit",
      180,
      {
        allowedActions: ["buy_unit"],
        allowedTargets: [{ kind: "shopFirstAvailable" }],
        completionRule: { kind: "totalOwnedUnitsAtLeast", count: 4 },
        blockedHint: "Hãy mua thêm một quân nữa để đủ đội hình."
      }
    ),
    createArrowStep(
      "round2_deploy_unit_second",
      ({ anchor }) => [
        "📌 Đưa quân cuối cùng của vòng này lên sân.",
        getTutorialDeployRoleHint(anchor?.recommendation)
      ].join("\n"),
      { kind: "boardRecommendedDeploy" },
      "place_board",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["select_bench", "start_unit_drag", "move_unit"],
        allowedTargets: [
          { kind: "benchFirstOccupied", role: "source" },
          { kind: "boardRecommendedDeploy", role: "destination" }
        ],
        completionRule: { kind: "boardUnitsAtLeast", count: 4 },
        blockedHint: "Hãy hoàn tất việc triển khai quân."
      }
    ),
    createArrowStep(
      "round2_start_combat",
      "⚔️ Xong rồi. Bắt đầu giao tranh vòng 2.",
      { kind: "button", key: "start" },
      "click_combat",
      220,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }],
        blockedHint: "Nhấn Bắt đầu giao tranh để sang vòng tiếp theo."
      }
    )
  ];
}

function getRound3Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round3_intro",
      "🧭 Vòng 3 sẽ dạy đổi vị trí, bán quân, xem nhật ký và mở/đóng cài đặt."
    ),
    createArrowStep(
      "round3_move_unit",
      "↔️ Kéo một quân đang đứng trên sân sang ô trống khác để đổi vị trí.",
      { kind: "boardSuggestedReposition", role: "destination" },
      "move_board_unit",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_unit_drag", "move_unit"],
        allowedTargets: [
          { kind: "boardAnyOccupied", role: "source" },
          { kind: "boardAnyEmptyCell", role: "destination" }
        ],
        completionRule: { kind: "eventAtLeast", key: "move_board_unit", count: 1 },
        blockedHint: "Hãy kéo một quân trên sân sang ô trống khác."
      }
    ),
    createArrowStep(
      "round3_sell_unit",
      "🗑 Kéo quân dự bị được phát thêm xuống nút Bán để đổi lấy vàng.",
      { kind: "sellButton" },
      "sell_unit",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_unit_drag", "sell_unit", "sell_selected_unit"],
        allowedTargets: [
          { kind: "benchFirstOccupied", role: "source" },
          { kind: "sellButton", role: "destination" }
        ],
        completionRule: { kind: "eventAtLeast", key: "sell_unit", count: 1 },
        blockedHint: "Hãy kéo quân dự bị xuống nút Bán."
      }
    ),
    createArrowStep(
      "round3_open_history",
      "📋 Mở Nhật ký để xem lại những gì vừa xảy ra.",
      { kind: "button", key: "history" },
      "open_history",
      160,
      {
        allowedActions: ["toggle_history"],
        allowedTargets: [{ kind: "button", key: "history" }],
        completionRule: { kind: "eventAtLeast", key: "open_history", count: 1 },
        blockedHint: "Hãy mở Nhật ký bằng nút đang được tô sáng."
      }
    ),
    createArrowStep(
      "round3_close_history",
      "✖️ Đóng Nhật ký lại để quay về sân đấu.",
      { kind: "historyClose" },
      "close_history",
      120,
      {
        allowedActions: ["toggle_history"],
        allowedTargets: [{ kind: "historyClose" }],
        completionRule: { kind: "eventAtLeast", key: "close_history", count: 1 },
        blockedHint: "Hãy đóng Nhật ký để tiếp tục."
      }
    ),
    createArrowStep(
      "round3_open_settings",
      "⚙️ Giờ mở Cài đặt thử một lần.",
      { kind: "button", key: "settings" },
      "open_settings",
      160,
      {
        allowedActions: ["open_settings", "toggle_settings"],
        allowedTargets: [{ kind: "button", key: "settings" }],
        completionRule: { kind: "eventAtLeast", key: "open_settings", count: 1 },
        blockedHint: "Hãy mở Cài đặt bằng nút góc trên."
      }
    ),
    createArrowStep(
      "round3_close_settings",
      "✖️ Đóng Cài đặt lại để quay về planning.",
      { kind: "settingsControl", key: "close" },
      "close_settings",
      120,
      {
        allowedActions: ["close_settings", "toggle_settings"],
        allowedTargets: [{ kind: "settingsControl", key: "close" }],
        completionRule: { kind: "eventAtLeast", key: "close_settings", count: 1 },
        blockedHint: "Hãy đóng Cài đặt để tiếp tục."
      }
    ),
    createArrowStep(
      "round3_start_combat",
      "⚔️ Xong phần quản lý đội hình. Bắt đầu giao tranh.",
      { kind: "button", key: "start" },
      "click_combat",
      180,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }],
        blockedHint: "Hãy nhấn Bắt đầu giao tranh."
      }
    )
  ];
}

function getRound4Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round4_intro",
      "🔎 Vòng này bạn sẽ học cách rê chuột xem tooltip và preview đòn đánh/kỹ năng."
    ),
    createArrowStep(
      "round4_hover_preview",
      "🖱 Rê chuột lên một quân của bạn trên sân để xem tooltip và preview mục tiêu.",
      { kind: "boardFirstOccupied" },
      "show_attack_preview",
      180,
      {
        allowedActions: ["show_attack_preview"],
        allowedTargets: [{ kind: "boardAnyOccupied" }],
        completionRule: { kind: "eventAtLeast", key: "show_attack_preview", count: 1 },
        blockedHint: "Hãy rê chuột lên một quân đang đứng trên sân."
      }
    ),
    createArrowStep(
      "round4_start_combat",
      "⚔️ Đã nắm cách đọc tooltip. Bắt đầu giao tranh.",
      { kind: "button", key: "start" },
      "click_combat",
      180,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }]
      }
    )
  ];
}

function getRound5Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round5_intro",
      "🎁 Sau combat bạn vừa nhận một trang bị hoàn chỉnh. Giờ hãy học mang đồ cho quân."
    ),
    createArrowStep(
      "round5_equip_item",
      "🧩 Kéo trang bị trong kho vào một quân trên sân để trang bị.",
      { kind: "inventoryItem", itemId: "eq_warmog_armor" },
      "equip_item",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_item_drag", "equip_item"],
        allowedTargets: [
          { kind: "inventoryItem", itemId: "eq_warmog_armor", role: "item" },
          { kind: "boardAnyOccupied", role: "unit" }
        ],
        completionRule: { kind: "unitHasEquip", itemId: "eq_warmog_armor" },
        blockedHint: "Hãy kéo trang bị từ kho vào một quân trên sân."
      }
    ),
    createArrowStep(
      "round5_unequip_item",
      "↩️ Kéo lại con vừa mang đồ xuống nút Tháo đồ để lấy trang bị về túi.",
      { kind: "unequipButton" },
      "unequip_item",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_unit_drag", "unequip_item"],
        allowedTargets: [
          { kind: "boardAnyEquipped", role: "source" },
          { kind: "unequipButton", role: "destination" }
        ],
        completionRule: { kind: "eventAtLeast", key: "unequip_item", count: 1 },
        blockedHint: "Hãy kéo quân đang mang đồ xuống nút Tháo đồ."
      }
    ),
    createArrowStep(
      "round5_re_equip_item",
      "🔁 Trang bị đã quay về kho. Kéo lại nó vào quân để gắn lần nữa.",
      { kind: "inventoryItem", itemId: "eq_warmog_armor" },
      "equip_item",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_item_drag", "equip_item"],
        allowedTargets: [
          { kind: "inventoryItem", itemId: "eq_warmog_armor", role: "item" },
          { kind: "boardAnyOccupied", role: "unit" }
        ],
        completionRule: { kind: "eventAtLeast", key: "equip_item", count: 2 },
        blockedHint: "Hãy gắn lại trang bị vừa tháo ra."
      }
    ),
    createArrowStep(
      "round5_start_combat",
      "⚔️ Vào giao tranh để xem trang bị hỗ trợ đội hình.",
      { kind: "button", key: "start" },
      "click_combat",
      180,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }]
      }
    )
  ];
}

function getRound6Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round6_intro",
      "⚒ Vòng này bạn sẽ ghép đồ bằng bàn chế tạo."
    ),
    createArrowStep(
      "round6_place_craft_item",
      "🧪 Kéo nguyên liệu Giọt Sương vào đúng ô trung tâm của bàn chế tạo.",
      { kind: "craftSlot", index: 4 },
      "add_craft_item",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_item_drag", "add_craft_item"],
        allowedTargets: [
          { kind: "inventoryItem", itemId: "tear", role: "item" },
          { kind: "craftSlot", index: 4, role: "destination" }
        ],
        completionRule: { kind: "craftSlotMatches", slotIndex: 4, itemId: "tear" },
        blockedHint: "Hãy kéo Giọt Sương vào ô giữa bàn chế tạo."
      }
    ),
    createArrowStep(
      "round6_craft_item",
      "✨ Bấm vào ô đầu ra để ghép thành Bùa Xanh.",
      { kind: "craftOutput" },
      "craft_item",
      180,
      {
        allowedActions: ["craft_item"],
        allowedTargets: [{ kind: "craftOutput" }],
        completionRule: { kind: "itemInBag", itemId: "eq_blue_buff", count: 1 },
        blockedHint: "Hãy bấm vào ô đầu ra để hoàn tất ghép đồ."
      }
    ),
    createArrowStep(
      "round6_equip_crafted_item",
      "🪄 Kéo Bùa Xanh vừa ghép vào một quân trên sân.",
      { kind: "inventoryItem", itemId: "eq_blue_buff" },
      "equip_item",
      180,
      {
        layoutFocus: "allowedTargets",
        allowedActions: ["start_item_drag", "equip_item"],
        allowedTargets: [
          { kind: "inventoryItem", itemId: "eq_blue_buff", role: "item" },
          { kind: "boardAnyOccupied", role: "unit" }
        ],
        completionRule: { kind: "unitHasEquip", itemId: "eq_blue_buff" },
        blockedHint: "Hãy trang bị Bùa Xanh vừa ghép cho một quân."
      }
    ),
    createArrowStep(
      "round6_start_combat",
      "⚔️ Hoàn tất chế tạo. Bắt đầu giao tranh.",
      { kind: "button", key: "start" },
      "click_combat",
      180,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }]
      }
    )
  ];
}

function getRound7Steps(): TutorialStep[] {
  return [
    createStep({
      id: "round7_choose_augment",
      text: "🌟 Đây là Pháp ấn. Hãy chọn 1 trong 3 lựa chọn cố định để nhận buff cho cả run.",
      target: { kind: "screen", key: "center" },
      panelPlacement: "center",
      indicator: { type: "none" },
      trigger: "choose_augment",
      delay: 140,
      allowedActions: ["choose_augment"],
      completionRule: { kind: "eventAtLeast", key: "choose_augment", count: 1 },
      blockedHint: "Hãy chọn một Pháp ấn để tiếp tục."
    }),
    createCenterDismissStep(
      "round7_augment_summary",
      ({ scene }: TutorialTextContext) => {
        const chosenNameValue = scene?.getTutorialMarker?.("lastAugmentName");
        const chosenName = typeof chosenNameValue === "string" ? chosenNameValue : "Pháp ấn";
        return `✅ Bạn đã chọn ${chosenName}.\nCác round sau buff này sẽ tiếp tục được áp dụng cho đội hình.`;
      },
      140
    ),
    createArrowStep(
      "round7_start_combat",
      "⚔️ Bắt đầu giao tranh để thử pháp ấn mới.",
      { kind: "button", key: "start" },
      "click_combat",
      180,
      {
        allowedActions: ["begin_combat"],
        allowedTargets: [{ kind: "button", key: "start" }]
      }
    )
  ];
}

function getRound8Steps(): TutorialStep[] {
  return [
    createCenterDismissStep(
      "round8_intro",
      "🧠 Đây là vòng tổng kết. Bạn có thể tự do chỉnh đội hình, xem thông tin và dùng các nút quen thuộc trước khi đánh."
    ),
    createArrowStep(
      "round8_free_play",
      "✅ Bạn đã đi qua đủ tutorial cốt lõi. Tự do thao tác rồi nhấn Bắt đầu giao tranh khi sẵn sàng.",
      { kind: "button", key: "start" },
      "click_combat",
      140,
      {
        allowedActions: ["*"],
        allowedTargets: [{ kind: "any" }],
        blockedHint: "Bạn có thể tự do thao tác trong vòng tổng kết này."
      }
    )
  ];
}

export function getTutorialStepsForRound(round = 1): TutorialStep[] {
  switch (round) {
    case 1:
      return getRound1Steps();
    case 2:
      return getRound2Steps();
    case 3:
      return getRound3Steps();
    case 4:
      return getRound4Steps();
    case 5:
      return getRound5Steps();
    case 6:
      return getRound6Steps();
    case 7:
      return getRound7Steps();
    case 8:
      return getRound8Steps();
    default:
      return [];
  }
}
