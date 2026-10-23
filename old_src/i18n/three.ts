/**
 * ============================================================================
 * 1. IMPORTS & DEPENDENCIES
 * ============================================================================
 */

/**
 * ============================================================================
 * 2. INTERFACES & STRUCTURAL TYPES
 * ============================================================================
 */

export interface ThreeI18nDictionary {
  [key: string]: string;
}

/**
 * ============================================================================
 * 3. CONSTANTS, ENUMS & MODULE STATE
 * ============================================================================
 * Rationale:
 * Strict 3-level key hierarchy: three.<area>.<group>.<key>
 * 1:1 parity between VI and EN dictionaries to avoid missing translation warnings.
 * All UI labels, HUD overlays, tooltips, and status messages for the Three.js
 * engine MUST use these keys via t() instead of hardcoded strings.
 */

export const THREE_I18N_VI: ThreeI18nDictionary = {
  // Camera controls & presets
  "three.camera.preset.isometric": "Góc nhìn Đẳng cự (45°)",
  "three.camera.preset.topdown": "Góc nhìn Chiến thuật (Trên xuống)",
  "three.camera.preset.free": "Camera Tự do (Xoay 360°)",
  "three.camera.preset.cinematic": "Góc nhìn Điện ảnh",
  "three.camera.control.reset": "Đặt lại Camera",
  "three.camera.control.hint": "Giữ chuột trái/Chạm để xoay • Cuộn/Chụm 2 ngón để phóng to • Chuột phải để di chuyển",

  // Graphics settings
  "three.graphics.quality.high": "Chất lượng 3D: Cao (Bóng mềm)",
  "three.graphics.quality.medium": "Chất lượng 3D: Vừa",
  "three.graphics.quality.low": "Chất lượng 3D: Tiết kiệm pin",

  // Board states & labels
  "three.board.state.loading": "Đang khởi tạo đấu trường 3D...",
  "three.board.state.empty": "Ô trống",
  "three.board.state.blocked": "Vị trí không thể đặt",
  "three.board.cell.ally": "Khu vực Đồng minh",
  "three.board.cell.enemy": "Khu vực Đối thủ",
  "three.board.cell.river": "Dòng sông Trung tâm",

  // Unit stats & badges
  "three.unit.badge.star": "Sao cấp {star}",
  "three.unit.stat.hp": "Máu: {current}/{max}",
  "three.unit.stat.mana": "Năng lượng: {current}/{max}",
  "three.unit.stat.atk": "Công vật lý: {val}",
  "three.unit.stat.def": "Thủ vật lý: {val}",
  "three.unit.stat.mdef": "Kháng phép: {val}",
  "three.unit.stat.range": "Tầm đánh: {val}",
  "three.unit.stat.speed": "Tốc đánh: {val}",

  // Combat phases & notifications
  "three.combat.phase.planning": "GIAI ĐOẠN CHUẨN BỊ",
  "three.combat.phase.action": "GIAI ĐOẠN GIAO TRANH",
  "three.combat.result.victory": "CHIẾN THẮNG!",
  "three.combat.result.defeat": "THẤT BẠI!",
  "three.combat.result.draw": "HÒA TRẬN!",
  "three.combat.hud.round": "Vòng {round}",
  "three.combat.hud.cycle": "Lượt {cycle}/20",
  "three.combat.action.step": "Tiếp tục",
  "three.combat.action.speed": "Tốc độ: {speed}x",
  "three.combat.action.retreat": "Đầu hàng",

  // Planning & Shop
  "three.shop.action.reroll": "Đổi lại ({cost} vàng)",
  "three.shop.action.lock": "Khóa cửa hàng",
  "three.shop.action.unlock": "Mở khóa cửa hàng",
  "three.shop.action.buy": "Mua ({cost} vàng)",
  "three.shop.state.empty": "Hết tướng trong lượt này",
  "three.shop.warning.nogold": "Không đủ vàng để mua!",
  "three.bench.warning.full": "Hàng chờ đã đầy!",
  "three.bench.action.sell": "Bán tướng (+{gold} vàng)",
  "three.planning.action.start": "Bắt đầu Chiến đấu",
  "three.planning.action.auto": "Tự động sắp xếp",
  "three.planning.deploy.limit": "Đã đạt giới hạn ra trận ({current}/{max})",

  // Tooltips & Modals
  "three.tooltip.touch.hint": "Chạm để ghim thông tin chi tiết",
  "three.tooltip.stat.synergy": "Kích hoạt Hệ Tộc:",
  "three.modal.button.confirm": "Xác nhận",
  "three.modal.button.cancel": "Hủy bỏ",
  "three.modal.button.close": "Đóng",

  // Main Menu
  "three.menu.label.title": "FOREST THRONE",
  "three.menu.label.subtitle": "Chiến Thuật Rừng Thiêng 3D",
  "three.menu.action.library": "Thư Viện",
  "three.menu.action.settings": "Cài Đặt",
  "three.menu.action.language": "Ngôn ngữ",
  "three.menu.action.newGame": "Trò chơi mới",
  "three.hud.accessibility.label": "Giao diện đấu trường 3D",
  "three.hud.label.camera": "Camera",
  "three.planning.status.ready": "Sẵn sàng triển khai đội hình",
  "three.planning.status.deployed": "Đã triển khai {count}/{limit}"
};

export const THREE_I18N_EN: ThreeI18nDictionary = {
  // Camera controls & presets
  "three.camera.preset.isometric": "Isometric View (45°)",
  "three.camera.preset.topdown": "Tactical View (Top-Down)",
  "three.camera.preset.free": "Free Camera (360° Orbit)",
  "three.camera.preset.cinematic": "Cinematic View",
  "three.camera.control.reset": "Reset Camera",
  "three.camera.control.hint": "Left Click/Touch to Orbit • Scroll/Pinch to Zoom • Right Click to Pan",

  // Graphics settings
  "three.graphics.quality.high": "3D Quality: High (Soft Shadows)",
  "three.graphics.quality.medium": "3D Quality: Medium",
  "three.graphics.quality.low": "3D Quality: Battery Saver",

  // Board states & labels
  "three.board.state.loading": "Initializing 3D arena...",
  "three.board.state.empty": "Empty Cell",
  "three.board.state.blocked": "Invalid Placement",
  "three.board.cell.ally": "Ally Territory",
  "three.board.cell.enemy": "Enemy Territory",
  "three.board.cell.river": "Central River",

  // Unit stats & badges
  "three.unit.badge.star": "Star Tier {star}",
  "three.unit.stat.hp": "HP: {current}/{max}",
  "three.unit.stat.mana": "Mana: {current}/{max}",
  "three.unit.stat.atk": "ATK: {val}",
  "three.unit.stat.def": "DEF: {val}",
  "three.unit.stat.mdef": "MDEF: {val}",
  "three.unit.stat.range": "Range: {val}",
  "three.unit.stat.speed": "Speed: {val}",

  // Combat phases & notifications
  "three.combat.phase.planning": "PLANNING PHASE",
  "three.combat.phase.action": "COMBAT PHASE",
  "three.combat.result.victory": "VICTORY!",
  "three.combat.result.defeat": "DEFEAT!",
  "three.combat.result.draw": "DRAW!",
  "three.combat.hud.round": "Round {round}",
  "three.combat.hud.cycle": "Turn {cycle}/20",
  "three.combat.action.step": "Next Step",
  "three.combat.action.speed": "Speed: {speed}x",
  "three.combat.action.retreat": "Surrender",

  // Planning & Shop
  "three.shop.action.reroll": "Reroll ({cost} Gold)",
  "three.shop.action.lock": "Lock Shop",
  "three.shop.action.unlock": "Unlock Shop",
  "three.shop.action.buy": "Buy ({cost} Gold)",
  "three.shop.state.empty": "No units available",
  "three.shop.warning.nogold": "Not enough gold!",
  "three.bench.warning.full": "Bench is full!",
  "three.bench.action.sell": "Sell Unit (+{gold} Gold)",
  "three.planning.action.start": "Start Combat",
  "three.planning.action.auto": "Auto Deploy",
  "three.planning.deploy.limit": "Deployment limit reached ({current}/{max})",

  // Tooltips & Modals
  "three.tooltip.touch.hint": "Tap to pin detailed stats",
  "three.tooltip.stat.synergy": "Synergies Active:",
  "three.modal.button.confirm": "Confirm",
  "three.modal.button.cancel": "Cancel",
  "three.modal.button.close": "Close",

  // Main Menu
  "three.menu.label.title": "FOREST THRONE",
  "three.menu.label.subtitle": "3D Forest Tactical Auto-Battler",
  "three.menu.action.library": "Library",
  "three.menu.action.settings": "Settings",
  "three.menu.action.language": "Language",
  "three.menu.action.newGame": "New Game",
  "three.hud.accessibility.label": "3D arena interface",
  "three.hud.label.camera": "Camera",
  "three.planning.status.ready": "Ready to deploy your formation",
  "three.planning.status.deployed": "Deployed {count}/{limit}"
};

/**
 * ============================================================================
 * 4. PRIVATE HELPERS & TYPE GUARDS
 * ============================================================================
 */

/**
 * ============================================================================
 * 5. PUBLIC EXPORTS & LIFECYCLE METHODS
 * ============================================================================
 */

/**
 * Merge Three.js i18n keys into base dictionary
 *
 * @param baseDict - Target dictionary
 * @param locale - Locale code ("vi" or "en")
 * @returns Combined dictionary
 */
export function mergeThreeTranslations(baseDict: Record<string, string>, locale: string): Record<string, string> {
  const threeDict = locale === "en" ? THREE_I18N_EN : THREE_I18N_VI;
  return {
    ...baseDict,
    ...threeDict
  };
}

export default {
  vi: THREE_I18N_VI,
  en: THREE_I18N_EN,
  mergeThreeTranslations
};
