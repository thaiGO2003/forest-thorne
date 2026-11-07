/**
 * skills.js — Skill data loaded from unit JS module files.
 *
 * Source of truth:
 * - legacy units: raw skill embedded in data/units/*.js
 * - V3 units: abilityDef normalized through unitCatalog
 */

export interface SkillDefinition {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface SkillOwnerLike {
  id?: string;
  baseId?: string;
  skillId?: string;
  skill?: SkillDefinition | null;
  star?: number;
}

export interface SkillLookupOptions {
  baseId?: string | null;
  star?: number;
}

export type SkillLibrary = Record<string, SkillDefinition>;
export type SkillOwnerIndex = Record<string, string>;

import {
  ALL_UNIT_BY_ID,
  UNIT_CATALOG,
  resolveUnitSkillForStar
} from "./unitCatalog.js";

function buildSkillLibrary(): SkillLibrary {
  const library: SkillLibrary = {};

  for (const unit of UNIT_CATALOG as unknown as readonly SkillOwnerLike[]) {
    if (unit?.skill?.id) {
      library[unit.skill.id] = { ...unit.skill };
    }
  }

  return library;
}

function buildSkillOwnerIndex(): SkillOwnerIndex {
  const owners: SkillOwnerIndex = {};
  for (const unit of UNIT_CATALOG as unknown as readonly SkillOwnerLike[]) {
    if (unit?.skillId) owners[unit.skillId] = unit.id ?? "";
  }
  return owners;
}

function normalizeSkillStar(star: unknown): number {
  const raw = Number.parseInt(String(star), 10);
  if (!Number.isFinite(raw) || raw < 1) return 1;
  if (raw > 3) return 3;
  return raw;
}

export const SKILL_LIBRARY: SkillLibrary = buildSkillLibrary();
export const SKILL_OWNER_BY_ID: SkillOwnerIndex = buildSkillOwnerIndex();

export function getResolvedSkillDefinition(
  skillId: string | null | undefined,
  options: SkillLookupOptions = {}
): SkillDefinition | null {
  const { baseId = null, star = 1 } = options;
  const resolvedStar = normalizeSkillStar(star);

  const tryResolveOwnerSkill = (owner: SkillOwnerLike | null): SkillDefinition | null => {
    if (!owner) return null;
    const resolvedSkill = resolveUnitSkillForStar(owner.id ?? "", resolvedStar) as SkillDefinition | null;
    if (!resolvedSkill) return null;
    if (!skillId || resolvedSkill.id === skillId || owner.skillId === skillId) {
      return resolvedSkill;
    }
    return null;
  };

  const unitById = ALL_UNIT_BY_ID as Record<string, SkillOwnerLike>;
  const directOwner = baseId ? unitById[baseId] ?? null : null;
  const indexedOwner = skillId ? unitById[SKILL_OWNER_BY_ID[skillId]] ?? null : null;

  return (
    tryResolveOwnerSkill(directOwner)
    ?? tryResolveOwnerSkill(indexedOwner)
    ?? (skillId ? SKILL_LIBRARY[skillId] ?? null : null)
  );
}

export function getResolvedSkillForUnit(
  unit: SkillOwnerLike | null | undefined,
  fallbackBaseId: string | null = null
): SkillDefinition | null {
  if (!unit) return null;
  const baseId = unit.baseId ?? unit.id ?? fallbackBaseId ?? null;
  return getResolvedSkillDefinition(unit.skillId, {
    baseId,
    star: unit.star ?? 1
  });
}
