// Vietnamese evolution names for the unit detail selector (ported from old_src).
// Base catalog ids/names stay canonical; these names are presentation-only and derived
// deterministically from star, element (old "tribe") and role (old "class").
import type { UnitDef } from "./catalog";

type EvolutionNameMap = Record<string, Record<number, string>>;

export const VI_STAR_NAME_OVERRIDES: EvolutionNameMap = {
  deer_song: {
    1: "Nai Thần Ca",
    2: "Nai Hòa Điệu",
    3: "Lộc Linh Thánh Ca",
  },
};

export const TRIBE_PREFIXES: EvolutionNameMap = {
  STONE: { 2: "Thạch", 3: "Sơn" },
  WIND: { 2: "Phong", 3: "Thiên" },
  FIRE: { 2: "Viêm", 3: "Xích" },
  TIDE: { 2: "Triều", 3: "Hải" },
  NIGHT: { 2: "Ảnh", 3: "U Minh" },
  SPIRIT: { 2: "Linh", 3: "Thánh" },
  SWARM: { 2: "Độc", 3: "Chúa" },
  WOOD: { 2: "Mộc", 3: "Cổ" },
};

export const CLASS_SUFFIXES: EvolutionNameMap = {
  TANKER: { 2: "Giáp", 3: "Thành" },
  ASSASSIN: { 2: "Ảnh", 3: "Sát" },
  ARCHER: { 2: "Tiễn", 3: "Xạ" },
  MAGE: { 2: "Chú", 3: "Pháp" },
  SUPPORT: { 2: "Ca", 3: "Phúc" },
  FIGHTER: { 2: "Kích", 3: "Chiến" },
};

export function normalizeEvolutionStar(star: unknown): number {
  const value = Number(star);
  return Math.max(1, Math.min(3, Number.isFinite(value) ? value : 1));
}

function cleanNamePart(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function startsWithWord(name: unknown, word: unknown): boolean {
  return cleanNamePart(name).toLowerCase().startsWith(`${cleanNamePart(word).toLowerCase()} `);
}

function endsWithWord(name: unknown, word: unknown): boolean {
  return cleanNamePart(name).toLowerCase().endsWith(` ${cleanNamePart(word).toLowerCase()}`);
}

/** Port of old_src `resolveVietnameseEvolutionName` with the same override/generated fallback. */
export function resolveVietnameseEvolutionName(
  baseId: string,
  baseName: string,
  classType: string,
  tribe: string,
  star: unknown,
): string {
  const normalizedStar = normalizeEvolutionStar(star);
  const override = VI_STAR_NAME_OVERRIDES[baseId]?.[normalizedStar];
  if (override) return override;

  const rootName = cleanNamePart(baseName) || "Linh thú";
  if (normalizedStar === 1) return rootName;

  const tribePrefix = TRIBE_PREFIXES[tribe]?.[normalizedStar] ?? (normalizedStar === 2 ? "Linh" : "Thánh");
  const classSuffix = CLASS_SUFFIXES[classType]?.[normalizedStar] ?? (normalizedStar === 2 ? "Kích" : "Chiến");
  const usePrefix = rootName.length >= 16 || normalizedStar === 3;

  if (usePrefix && !startsWithWord(rootName, tribePrefix)) {
    return cleanNamePart(`${tribePrefix} ${rootName}`);
  }
  if (!endsWithWord(rootName, classSuffix)) {
    return cleanNamePart(`${rootName} ${classSuffix}`);
  }
  return cleanNamePart(`${tribePrefix} ${rootName}`);
}

/** Presentation name for one star stage of a catalog unit. */
export function unitEvolutionName(unit: Pick<UnitDef, "id" | "nameVi" | "role" | "element">, star: unknown): string {
  return resolveVietnameseEvolutionName(unit.id, unit.nameVi, unit.role, unit.element, star);
}
