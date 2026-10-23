import { getLocale, t, translateForLocale } from "../i18n/index.js";
import { prettyIdLabel, resolveLocaleName } from "../i18n/localeText.js";
import { UNIT_BY_ID } from "./unitCatalog.js";
import { resolveVietnameseEvolutionName } from "./unitEvolutionNames.js";
import { resolveOwnedUnitAppearance } from "./unitSkins.js";
interface UnitVisualDefinition {
  getDisplayName?: (star: number, locale: string) => string | null | undefined;
}

interface UnitCatalogVisual {
  icon?: string;
  name?: string;
  nameVi?: string;
  nameEn?: string;
  classType?: string;
  tribe?: string;
  visual?: UnitVisualDefinition;
}

interface AppearanceOverride {
  displayNameVi?: string;
  displayNameEn?: string;
  icon?: string;
  previewIcon?: string;
  portraitKey?: unknown;
  visual?: unknown;
  skinId?: unknown;
}

interface UnitVisualOptions {
  appearance?: AppearanceOverride | null;
  side?: unknown;
  ownerKind?: unknown;
  collectionProfile?: unknown;
}


const CLASS_LABELS_VI: Record<string, string> = {
  TANKER: "Đỡ đòn",
  ASSASSIN: "Sát thủ",
  ARCHER: "Xạ thủ",
  MAGE: "Pháp sư",
  SUPPORT: "Hỗ trợ",
  FIGHTER: "Đấu sĩ"
};

const CLASS_LABELS_EN: Record<string, string> = {
  TANKER: "Tank",
  ASSASSIN: "Assassin",
  ARCHER: "Archer",
  MAGE: "Mage",
  SUPPORT: "Support",
  FIGHTER: "Fighter"
};

const CLASS_ICONS: Record<string, string> = {
  TANKER: "🛡️",
  ASSASSIN: "🗡️",
  ARCHER: "🏹",
  MAGE: "🔮",
  SUPPORT: "💚",
  FIGHTER: "⚔️"
};

const TRIBE_LABELS_VI: Record<string, string> = {
  STONE: "Nham",
  WIND: "Phong",
  FIRE: "Hỏa",
  TIDE: "Thủy",
  NIGHT: "Dạ",
  SPIRIT: "Linh",
  SWARM: "Trùng",
  WOOD: "Mộc"
};

const TRIBE_LABELS_EN: Record<string, string> = {
  STONE: "Stone",
  WIND: "Wind",
  FIRE: "Fire",
  TIDE: "Tide",
  NIGHT: "Night",
  SPIRIT: "Spirit",
  SWARM: "Swarm",
  WOOD: "Wood"
};

const TRIBE_ICONS: Record<string, string> = {
  FIRE: "🔥",
  SPIRIT: "👻",
  TIDE: "🌊",
  STONE: "🪨",
  WIND: "💨",
  NIGHT: "🌙",
  SWARM: "🐝",
  WOOD: "🌲"
};

const TRIBE_TITLE_POOL: Record<string, string[]> = {
  STONE: ["Nham", "Thạch", "Kiên", "Sơn"],
  WIND: ["Phong", "Lốc", "Vân", "Gió"],
  FIRE: ["Hỏa", "Viêm", "Diệm", "Xích"],
  TIDE: ["Thủy", "Triều", "Lam", "Hải"],
  NIGHT: ["Dạ", "U", "Nguyệt", "Hắc"],
  SPIRIT: ["Linh", "Thánh", "Tinh", "Phúc"],
  SWARM: ["Trùng", "Độc", "Bào", "Gai"],
  WOOD: ["Mộc", "Lâm", "Diệp", "Thảo"]
};

const CLASS_TITLE_POOL: Record<string, string[]> = {
  TANKER: ["Hộ Vệ", "Kiên Giáp", "Tiên Phong", "Thành Trì"],
  ASSASSIN: ["Ám Kích", "Đoạt Mệnh", "Ảnh Sát", "Kết Liễu"],
  ARCHER: ["Xạ Kích", "Bách Phát", "Truy Kích", "Liên Tiễn"],
  MAGE: ["Pháp Ấn", "Tinh Thuật", "Bùa Chú", "Linh Chú"],
  SUPPORT: ["Hộ Trợ", "Chúc Phúc", "Bảo Hộ", "Dưỡng Sinh"],
  FIGHTER: ["Chiến Binh", "Đột Kích", "Cuồng Kích", "Nộ Trảm"]
};

function hashString(text: unknown): number {
  const input = String(text ?? "");
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickBySeed(list: readonly string[] | undefined, seed: number): string {
  if (!list?.length) return "";
  return list[Math.abs(seed) % list.length];
}

function prettyNameFromId(baseId: string): string {
  return prettyIdLabel(baseId);
}

function looksGenericName(name: unknown): boolean {
  if (!name) return true;
  const text = String(name).trim();
  if (!text) return true;
  return /\d/.test(text) || /^beast\b/i.test(text) || /^unit\b/i.test(text);
}

function buildFlavorName(baseId: string, classType: string, tribe: string, seed: number): string {
  const root = prettyNameFromId(baseId) || "Linh thú";
  const tribeTitle = pickBySeed(TRIBE_TITLE_POOL[tribe], seed * 3 + 11);
  const classTitle = pickBySeed(CLASS_TITLE_POOL[classType], seed * 5 + 19);
  const shortName = `${root} ${tribeTitle}`.replace(/\s+/g, " ").trim();
  return shortName.length <= 20 ? shortName : `${root} ${classTitle}`.replace(/\s+/g, " ").trim();
}

function normalizeStar(star: unknown): number {
  const normalizedStar = Number(star);
  return Math.max(1, Math.min(3, Number.isFinite(normalizedStar) ? normalizedStar : 1));
}

export function getUnitVisual(baseId: string, classType: string | null = null, star: unknown = 1, options: UnitVisualOptions = {}) {
  const unit = UNIT_BY_ID[baseId] as UnitCatalogVisual | undefined;
  if (!unit) {
    return {
      name: t("label.beast"),
      nameVi: translateForLocale("vi", "label.beast"),
      nameEn: translateForLocale("en", "label.beast"),
      icon: "🐾",
      visual: null,
      skinId: null
    };
  }
  
  // Use icon from CSV if available, otherwise fallback to "🐾"
  const icon = unit.icon || "🐾";
  const normalizedStar = normalizeStar(star);
  const displayNameHook = typeof unit.visual?.getDisplayName === "function" ? unit.visual.getDisplayName.bind(unit.visual) : null;
  
  const catalogNameVi = unit.nameVi ?? unit.name;
  const catalogNameEn = unit.nameEn;
  const fallbackVi = looksGenericName(catalogNameVi)
    ? buildFlavorName(baseId, classType ?? unit.classType ?? "FIGHTER", unit.tribe ?? "SPIRIT", hashString(baseId))
    : catalogNameVi || buildFlavorName(baseId, classType ?? unit.classType ?? "FIGHTER", unit.tribe ?? "SPIRIT", hashString(baseId)) || translateForLocale("vi", "label.beast");
  const fallbackEn = resolveLocaleName(unit, {
    locale: "en",
    allowBase: false,
    allowCrossLocale: false,
    fallbackId: baseId,
    fallback: catalogNameEn || prettyIdLabel(baseId, "Beast")
  });
  const generatedVi = displayNameHook?.(normalizedStar, "vi")
    || resolveVietnameseEvolutionName(baseId, fallbackVi, classType ?? unit.classType ?? "FIGHTER", unit.tribe ?? "SPIRIT", normalizedStar);
  const generatedEn = displayNameHook?.(normalizedStar, "en") || fallbackEn;
  const ownedAppearance = resolveOwnedUnitAppearance({
    unitId: baseId,
    star: normalizedStar,
    side: options.side,
    ownerKind: options.ownerKind,
    collectionProfile: options.collectionProfile
  });
  const appearance = options.appearance ?? (ownedAppearance as AppearanceOverride | null);
  const nameVi = appearance?.displayNameVi ?? generatedVi;
  const nameEn = appearance?.displayNameEn ?? generatedEn;
  const name = getLocale() === "en" ? nameEn : nameVi;
  const finalIcon = appearance?.icon ?? icon;

  return {
    name,
    nameVi,
    nameEn,
    icon: finalIcon,
    previewIcon: appearance?.previewIcon ?? finalIcon,
    portraitKey: appearance?.portraitKey ?? null,
    visual: appearance?.visual ?? unit.visual ?? null,
    skinId: appearance?.skinId ?? null
  };
}

export function getClassLabel(code: unknown, locale = getLocale()): string {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") return t("label.unknown", {}, locale);
  return (locale === "en" ? CLASS_LABELS_EN : CLASS_LABELS_VI)[normalized] ?? t(`class.${normalized}`);
}

export function getTribeLabel(code: unknown, locale = getLocale()): string {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") return t("label.unknown", {}, locale);
  return (locale === "en" ? TRIBE_LABELS_EN : TRIBE_LABELS_VI)[normalized] ?? t(`tribe.${normalized}`);
}

export function getClassIcon(code: unknown): string {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") return "◎";
  return CLASS_ICONS[normalized] ?? "◎";
}

export function getTribeIcon(code: unknown): string {
  const normalized = typeof code === "string" ? code.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null") return "◎";
  return TRIBE_ICONS[normalized] ?? "◎";
}

export function getClassLabelVi(code: unknown): string {
  return getClassLabel(code, "vi");
}

export function getTribeLabelVi(code: unknown): string {
  return getTribeLabel(code, "vi");
}
