// Authored equipment logic (issue #31). `items.json` carries a classic `logic` payload per item;
// until now it was preserved but never executed (`equipment.ts` only summed static bonuses).
//
// This module executes only the effects whose authored meaning has an exact combat equivalent, and
// reports every other trigger/field so nothing is silently claimed as supported:
//   passive   + bonusDmgVsLowHp / bonusDmgVsHighHp -> damage windows
//   onHit     + healOnDmgPct                       -> heal a fraction of damage dealt
//   onHit     + stackBuff "atk"/"matk" + perStack  -> capped per-hit stacks (maxStacks)
//   onSkillUse+ gainRage (flat) or chance+gainRage -> rage on skill use, seeded when chancy
//   combatStart + shield                          -> opening shield
import { getEquipment, EQUIPMENT } from "./itemRegistry";

/** Every trigger the authored catalog uses; the list is data-derived, not an invented subset. */
export const EQUIPMENT_TRIGGERS = [
  "combatStart", "passive", "onHit", "onSkillUse", "onAllySkill", "onTakeDmg",
  "onKill", "onDeath", "hpThreshold", "periodic", "aura", "timedBomb", "nthAttack",
] as const;

export type EquipmentTrigger = (typeof EQUIPMENT_TRIGGERS)[number];

export interface ResolvedEquipmentLogic {
  /** Additive % damage against targets at or below 35% HP. */
  vsLowHpPct: number;
  /** Additive % damage against targets above 65% HP. */
  vsHighHpPct: number;
  /** Fraction of landed damage healed back to the attacker. */
  healOnDmgPct: number;
  /** Flat rage granted when a skill lands. */
  rageOnSkill: number;
  /** Seeded chance/rage pair for `chance` + `gainRage` skill payloads (0 chance = never rolls). */
  skillProcChance: number;
  skillProcRage: number;
  /** Shield applied at combat start. */
  startShield: number;
  /** Capped per-hit ATK stack (authored stackBuff "atk"). */
  atkStackPct: number;
  atkStackMax: number;
  /** Capped per-hit MATK stack (authored stackBuff "matk"). */
  matkStackPct: number;
  matkStackMax: number;
}

export const EMPTY_EQUIPMENT_LOGIC: ResolvedEquipmentLogic = {
  vsLowHpPct: 0, vsHighHpPct: 0, healOnDmgPct: 0, rageOnSkill: 0,
  skillProcChance: 0, skillProcRage: 0, startShield: 0,
  atkStackPct: 0, atkStackMax: 0, matkStackPct: 0, matkStackMax: 0,
};

export const LOW_HP_THRESHOLD = 0.35;
export const HIGH_HP_THRESHOLD = 0.65;

/** Fields this module executes; everything else is reported as unsupported. */
const EXECUTED_FIELDS = new Set([
  "trigger", "shield", "healOnDmgPct", "bonusDmgVsLowHp", "bonusDmgVsHighHp",
  "gainRage", "chance", "stackBuff", "perStack", "maxStacks",
]);

type AuthoredLogic = Record<string, unknown>;

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const pos = (value: unknown): number => Math.max(0, num(value));
const clampChance = (value: unknown): number => Math.min(1, Math.max(0, num(value)));

export function readTrigger(logic: unknown): EquipmentTrigger | null {
  if (!logic || typeof logic !== "object") return null;
  const raw = (logic as AuthoredLogic).trigger;
  return typeof raw === "string" && (EQUIPMENT_TRIGGERS as readonly string[]).includes(raw)
    ? raw as EquipmentTrigger
    : null;
}

export function itemLogic(id: string): AuthoredLogic | null {
  const logic = getEquipment(id)?.logic;
  return logic && typeof logic === "object" ? logic as AuthoredLogic : null;
}

/**
 * Resolve equipped item ids into one deterministic bundle. Recomputed from the ids alone, so
 * unequipping an item removes its effect and nothing survives between combats.
 */
export function resolveEquipmentLogic(equips: readonly string[]): ResolvedEquipmentLogic {
  const out: ResolvedEquipmentLogic = { ...EMPTY_EQUIPMENT_LOGIC };
  for (const id of equips) {
    const logic = itemLogic(id);
    const trigger = readTrigger(logic);
    if (!logic || !trigger) continue;

    if (trigger === "passive") {
      out.vsLowHpPct += pos(logic.bonusDmgVsLowHp);
      out.vsHighHpPct += pos(logic.bonusDmgVsHighHp);
    }
    if (trigger === "onHit") {
      out.healOnDmgPct += pos(logic.healOnDmgPct);
      const stack = logic.stackBuff;
      const per = pos(logic.perStack);
      const cap = Math.max(0, Math.round(pos(logic.maxStacks)));
      if (per > 0 && cap > 0 && stack === "atk") {
        out.atkStackPct = Math.max(out.atkStackPct, per);
        out.atkStackMax = Math.max(out.atkStackMax, cap);
      }
      if (per > 0 && cap > 0 && stack === "matk") {
        out.matkStackPct = Math.max(out.matkStackPct, per);
        out.matkStackMax = Math.max(out.matkStackMax, cap);
      }
    }
    if (trigger === "onSkillUse") {
      const roll = clampChance(logic.chance);
      const rage = pos(logic.gainRage);
      if (rage > 0 && roll === 0) out.rageOnSkill += rage;
      if (rage > 0 && roll > 0 && roll > out.skillProcChance) {
        out.skillProcChance = roll;
        out.skillProcRage = rage;
      }
    }
    if (trigger === "combatStart") out.startShield += pos(logic.shield);
  }
  return out;
}

/** Damage multiplier for the passive windows only (stacking is applied as stat mods instead). */
export function logicDamageMultiplier(logic: ResolvedEquipmentLogic, dstHpPct: number): number {
  let pct = 0;
  if (dstHpPct <= LOW_HP_THRESHOLD) pct += logic.vsLowHpPct;
  if (dstHpPct > HIGH_HP_THRESHOLD) pct += logic.vsHighHpPct;
  return pct === 0 ? 1 : 1 + pct / 100;
}

/** Seeded skill proc roll; deterministic for a given `rng` sequence (replay-safe). */
export function rollSkillProc(logic: ResolvedEquipmentLogic, rng: () => number): number {
  if (logic.skillProcChance <= 0 || logic.skillProcRage <= 0) return 0;
  return rng() < logic.skillProcChance ? logic.skillProcRage : 0;
}

export interface LogicCoverage {
  /** Triggers whose payload combat executes today. */
  executable: EquipmentTrigger[];
  /** Triggers preserved in data but not executed yet. */
  unmapped: EquipmentTrigger[];
  /** Authored fields no combat capability consumes yet. */
  unsupportedFields: string[];
}

/** Honest coverage report over the authored catalog, asserted by the tests and shown in tooltips. */
export function logicCoverage(): LogicCoverage {
  const executable = new Set<EquipmentTrigger>();
  const unmapped = new Set<EquipmentTrigger>();
  const fields = new Set<string>();
  for (const item of EQUIPMENT) {
    const logic = item.logic as AuthoredLogic | undefined;
    const trigger = readTrigger(logic);
    if (!logic || !trigger) continue;
    (trigger === "passive" || trigger === "onHit" || trigger === "onSkillUse" || trigger === "combatStart"
      ? executable
      : unmapped).add(trigger);
    for (const field of Object.keys(logic)) if (!EXECUTED_FIELDS.has(field)) fields.add(field);
  }
  return {
    executable: EQUIPMENT_TRIGGERS.filter((t) => executable.has(t)),
    unmapped: EQUIPMENT_TRIGGERS.filter((t) => unmapped.has(t)),
    unsupportedFields: [...fields].sort(),
  };
}

/** Copy/tooltip helper: the exact effects currently active for a set of equipped ids. */
export function equipmentLogicSummary(equips: readonly string[]): string[] {
  const logic = resolveEquipmentLogic(equips);
  const lines: string[] = [];
  if (logic.vsLowHpPct > 0) lines.push(`+${logic.vsLowHpPct}% sát thương lên mục tiêu ≤${Math.round(LOW_HP_THRESHOLD * 100)}% máu`);
  if (logic.vsHighHpPct > 0) lines.push(`+${logic.vsHighHpPct}% sát thương lên mục tiêu >${Math.round(HIGH_HP_THRESHOLD * 100)}% máu`);
  if (logic.healOnDmgPct > 0) lines.push(`Hồi ${Math.round(logic.healOnDmgPct * 100)}% sát thương gây ra`);
  if (logic.rageOnSkill > 0) lines.push(`+${logic.rageOnSkill} nộ khi dùng kỹ năng`);
  if (logic.skillProcChance > 0) lines.push(`${Math.round(logic.skillProcChance * 100)}% nhận +${logic.skillProcRage} nộ khi dùng kỹ năng`);
  if (logic.startShield > 0) lines.push(`+${logic.startShield} khiên đầu trận`);
  if (logic.atkStackPct > 0) lines.push(`+${logic.atkStackPct}% công mỗi đòn, tối đa ${logic.atkStackMax} lớp`);
  if (logic.matkStackPct > 0) lines.push(`+${logic.matkStackPct}% phép mỗi đòn, tối đa ${logic.matkStackMax} lớp`);
  return lines;
}
