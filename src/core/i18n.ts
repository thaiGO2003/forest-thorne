// Localization (spec §7 language, A35 language, A125.2 key parity). vi is canonical; en must match key-for-key.
// Unit/skill prose stays in the catalog (Vietnamese authored); UI copy lives here.
export type Locale = "vi" | "en";
export const LOCALES: readonly Locale[] = ["vi", "en"];

const vi = {
  "menu.continue": "Tiếp tục",
  "menu.newGame": "Trò chơi mới",
  "menu.settings": "Cài đặt",
  "menu.library": "Thư viện",
  "menu.language": "Ngôn ngữ",
  "menu.saveSummary": "Vòng {round} · {hearts} tim · {gold} vàng",
  "planning.reroll": "Đổi tướng ({cost})",
  "planning.buyXp": "Mua XP ({cost})",
  "planning.start": "Bắt đầu",
  "planning.deploy": "Ra trận {current}/{max}",
  "planning.notEnoughGold": "Không đủ vàng",
  "planning.benchFull": "Hàng chờ đã đầy",
  "planning.deployFull": "Đã đạt giới hạn ra trận ({limit})",
  "combat.round": "Vòng {round}",
  "combat.cycle": "Chu kỳ {cycle}",
  "combat.speed": "Tốc độ x{speed}",
  "combat.victory": "Chiến thắng",
  "combat.defeat": "Thất bại",
  "unit.star": "{star}★",
  "save.malformed": "Dữ liệu lưu bị hỏng",
  "save.invalid": "Dữ liệu lưu không hợp lệ",
  "settings.title": "Cài đặt",
  "settings.audio": "Âm thanh",
  "settings.display": "Hiển thị",
  "settings.gameplay": "Lối chơi",
  "settings.shortcuts": "Phím tắt",
  "settings.data": "Dữ liệu",
  "settings.audioEnabled": "Bật âm thanh",
  "settings.audioMuted": "Tắt tiếng",
  "settings.volume": "Âm lượng ({val}/10)",
  "settings.quality": "Chất lượng đồ họa",
  "settings.renderScale": "Tỉ lệ dựng hình ({val})",
  "settings.batterySaver": "Tiết kiệm pin",
  "settings.aiMode": "Độ khó AI",
  "settings.tooltipMode": "Chế độ chú giải",
  "settings.subtitles": "Phụ đề",
  "settings.resetKeys": "Đặt lại phím tắt",
  "settings.exportSave": "Xuất dữ liệu lưu",
  "settings.importSave": "Nhập dữ liệu lưu",
  "settings.clearRun": "Xóa tiến trình lượt chơi",
  "settings.clearAll": "Xóa toàn bộ dữ liệu",
  "settings.close": "Đóng",
  "common.confirm": "Xác nhận",
  "common.cancel": "Hủy",
} as const;

export type MsgKey = keyof typeof vi;

const en: Record<MsgKey, string> = {
  "menu.continue": "Continue",
  "menu.newGame": "New Game",
  "menu.settings": "Settings",
  "menu.library": "Library",
  "menu.language": "Language",
  "menu.saveSummary": "Round {round} · {hearts} hearts · {gold} gold",
  "planning.reroll": "Reroll ({cost})",
  "planning.buyXp": "Buy XP ({cost})",
  "planning.start": "Start",
  "planning.deploy": "Deployed {current}/{max}",
  "planning.notEnoughGold": "Not enough gold",
  "planning.benchFull": "Bench is full",
  "planning.deployFull": "Deploy limit reached ({limit})",
  "combat.round": "Round {round}",
  "combat.cycle": "Cycle {cycle}",
  "combat.speed": "Speed x{speed}",
  "combat.victory": "Victory",
  "combat.defeat": "Defeat",
  "unit.star": "{star}★",
  "save.malformed": "Save data is corrupted",
  "save.invalid": "Save data is invalid",
  "settings.title": "Settings",
  "settings.audio": "Audio",
  "settings.display": "Display",
  "settings.gameplay": "Gameplay",
  "settings.shortcuts": "Shortcuts",
  "settings.data": "Data",
  "settings.audioEnabled": "Enable Audio",
  "settings.audioMuted": "Mute Audio",
  "settings.volume": "Volume ({val}/10)",
  "settings.quality": "Graphics Quality",
  "settings.renderScale": "Render Scale ({val})",
  "settings.batterySaver": "Battery Saver",
  "settings.aiMode": "AI Difficulty",
  "settings.tooltipMode": "Tooltip Mode",
  "settings.subtitles": "Subtitles",
  "settings.resetKeys": "Reset Shortcuts",
  "settings.exportSave": "Export Save",
  "settings.importSave": "Import Save",
  "settings.clearRun": "Clear Run Progress",
  "settings.clearAll": "Clear All Data",
  "settings.close": "Close",
  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
};

export const DICTS: Record<Locale, Record<MsgKey, string>> = { vi, en };

let current: Locale = "vi";
const listeners: ((l: Locale) => void)[] = [];

export const getLocale = () => current;

/** Switch locale and notify mounted UI so visible copy refreshes immediately. */
export function setLocale(l: Locale) {
  if (l === current) return;
  current = l;
  for (const fn of listeners) fn(l);
}

export function onLocaleChange(fn: (l: Locale) => void): () => void {
  listeners.push(fn);
  return () => { listeners.splice(listeners.indexOf(fn), 1); };
}

/** Translate with `{param}` substitution; unknown params stay visible so missing data is noticed. */
export function t(key: MsgKey, params: Record<string, string | number> = {}, locale = current): string {
  return (DICTS[locale][key] ?? vi[key]).replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
}
