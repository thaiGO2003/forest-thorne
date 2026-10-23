import type { Skill } from "../../core/unitDescriptionHelper.js";
import { starAreaBonus, starTargetBonus, sampleWithoutReplacement } from "../../core/gameUtils.js";
import { collectSharedSkillPreviewCells } from "./sceneSkillPreviewCells.js";
import { collectHighestEffectiveAtkUnits, collectLowestHpRatioUnits, isAliveUnit, resolveSkillPrimaryTarget } from "./sceneSkillTargeting.js";

type Unit = Record<string, unknown> & { uid: string; alive?: boolean; row: number; col: number; star?: number; hp?: number; maxHp?: number; sprite?: { active?: boolean } };
type Cell = { row: number; col: number };
type StatFn = (unit: Unit) => number;
type VisualPlanInput = { attacker: Unit; target: Unit | null; skill: Skill & { effect?: string; aoeRadius?: number }; allyUnits: Unit[]; enemyUnits: Unit[];
  getEffectiveAtk: StatFn; getEffectiveDef: StatFn; getEffectiveMdef: StatFn; getEffectiveMatk: StatFn };
type VisualPlan = { actionTarget: Unit; resolvedSkillTarget: Unit | null | undefined; visualUnits: Unit[] };

function hasActiveSprite(unit: Unit | null | undefined): boolean { return Boolean(unit?.sprite?.active); }
function dedupeUnits(units: Unit[]): Unit[] {
  const seen = new Set<string>(); const result: Unit[] = [];
  units.forEach((unit) => { if (!unit?.uid || seen.has(unit.uid)) return; seen.add(unit.uid); result.push(unit); });
  return result;
}
function mapCellsToActiveUnits(cells: Cell[], units: Unit[]): Unit[] {
  return dedupeUnits(cells.map((cell) => units.find((candidate) => isAliveUnit(candidate) && hasActiveSprite(candidate) && candidate.row === cell.row && candidate.col === cell.col)).filter((unit): unit is Unit => Boolean(unit)));
}
function collectUnicornTargets(attacker: Unit, allyUnits: Unit[], getEffectiveAtk: StatFn, countOverride: number | null = null): Unit[] {
  return collectHighestEffectiveAtkUnits(allyUnits, Number.isFinite(countOverride) ? countOverride as number : ((attacker.star ?? 1) >= 3 ? 2 : 1), getEffectiveAtk as unknown as Parameters<typeof collectHighestEffectiveAtkUnits>[2], ((unit: Unit) => unit.uid !== attacker.uid) as unknown as Parameters<typeof collectHighestEffectiveAtkUnits>[3]) as Unit[];
}

export function resolveSharedSkillVisualPlan({ attacker, target, skill, allyUnits, enemyUnits, getEffectiveAtk, getEffectiveDef, getEffectiveMdef, getEffectiveMatk }: VisualPlanInput): VisualPlan {
  const castTargetBonus = starTargetBonus(attacker.star ?? 1); const castAreaBonus = starAreaBonus(attacker.star ?? 1);
  const resolvedPrimaryTarget = resolveSkillPrimaryTarget({ attacker, target, skill, allies: allyUnits, enemies: enemyUnits, getEffectiveAtk, getEffectiveDef, getEffectiveMdef, getEffectiveMatk } as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]) as Unit | null ?? target;
  const weakestEnemy = collectLowestHpRatioUnits(enemyUnits, 1, undefined)[0] as Unit | undefined;
  const weakestAlly = collectLowestHpRatioUnits(allyUnits, 1, undefined)[0] as Unit | undefined;
  const peaceTargets = collectLowestHpRatioUnits(allyUnits, Math.max(1, Number(skill.maxTargets) || 1), undefined) as Unit[];
  const hotTargets = collectLowestHpRatioUnits(allyUnits, (Number(skill.maxTargets) || 3) + castTargetBonus, undefined) as Unit[];
  const purifyTargets = collectLowestHpRatioUnits(allyUnits, (Number(skill.maxTargets) || 2) + castTargetBonus, undefined) as Unit[];
  const rowAllyTargets = allyUnits.filter((unit) => isAliveUnit(unit) && unit.row === attacker.row);
  const multiPool = enemyUnits.filter((unit) => isAliveUnit(unit));
  const maxHits = Math.max(1, Math.round(Number(skill.maxHits ?? skill.maxTargets ?? 2) || 2));
  const multiStingTargets = sampleWithoutReplacement(multiPool, Math.min(maxHits, multiPool.length));
  const primary = resolvedPrimaryTarget?.alive ? [resolvedPrimaryTarget] : [];
  const chainPool = enemyUnits.filter((unit) => isAliveUnit(unit) && unit.uid !== resolvedPrimaryTarget?.uid);
  const chainCount = Math.max(0, Math.min(3 + castTargetBonus, enemyUnits.filter((unit) => isAliveUnit(unit)).length) - primary.length);
  const chainShockTargets = [...primary, ...sampleWithoutReplacement(chainPool, chainCount)];
  const radius = Number.isFinite(Number(skill.aoeRadius)) ? Math.max(0, Math.round(Number(skill.aoeRadius))) : 1 + castAreaBonus;
  const fireballTargets = enemyUnits.filter((unit) => isAliveUnit(unit) && Math.abs(unit.row - (resolvedPrimaryTarget?.row ?? attacker.row)) <= radius && Math.abs(unit.col - (resolvedPrimaryTarget?.col ?? attacker.col)) <= radius);
  const guardianTargets = collectLowestHpRatioUnits(allyUnits.filter((unit) => unit.uid !== attacker.uid), Math.max(1, Number(skill.maxTargets) || 1), undefined) as Unit[];
  const unicornTargets = collectUnicornTargets(attacker, allyUnits, getEffectiveAtk, Number(skill.maxTargets) || null);
  const flags = { peace: skill.effect === "peace_heal_reduce_dmg" || skill.effect === "peace_heal_reduce", blessRain: skill.effect === "bless_rain_mdef", hot: skill.effect === "heal_over_time", purify: skill.effect === "light_purify", rowGuard: skill.effect === "ally_row_def_buff", columnBleed: skill.effect === "column_bleed", chainShock: skill.effect === "chain_shock", fireball: skill.effect === "fireball_burn", guardianPact: skill.effect === "guardian_pact", selfShieldImmune: skill.effect === "self_shield_immune", springHeal: skill.effect === "spring_aoe_heal", unicornBuff: skill.effect === "unicorn_atk_buff", mirrorReflect: skill.effect === "mirror_reflect", frostStorm: skill.effect === "frost_storm", inkColumn: skill.effect === "ink_blast_debuff", inkBomb: skill.effect === "ink_bomb_blind" };
  const inkBombRadius = (attacker.star ?? 1) >= 3 ? 2 : (attacker.star ?? 1) >= 2 ? 1 : 0;
  let resolvedSkillTarget: Unit | null | undefined = resolvedPrimaryTarget;
  if (skill.effect === "heat_seek") resolvedSkillTarget = weakestEnemy; else if (flags.peace) resolvedSkillTarget = peaceTargets[0] ?? weakestAlly; else if (flags.hot) resolvedSkillTarget = hotTargets[0]; else if (flags.purify) resolvedSkillTarget = purifyTargets[0]; else if (skill.effect === "multi_sting_poison") resolvedSkillTarget = multiStingTargets[0]; else if (flags.rowGuard) resolvedSkillTarget = rowAllyTargets[0] || attacker; else if (flags.guardianPact) resolvedSkillTarget = guardianTargets[0] || weakestAlly || attacker; else if (flags.selfShieldImmune || flags.springHeal || flags.mirrorReflect) resolvedSkillTarget = attacker; else if (flags.unicornBuff) resolvedSkillTarget = unicornTargets[0] || attacker;
  const actionTarget = resolvedSkillTarget || target || attacker; const allUnits = [...allyUnits, ...enemyUnits];
  const previewVisualUnits = mapCellsToActiveUnits(collectSharedSkillPreviewCells({ attacker, target: actionTarget, skill: skill as unknown as Parameters<typeof collectSharedSkillPreviewCells>[0]["skill"], allies: allyUnits, enemies: enemyUnits }) as Cell[], allUnits);
  const frostStormTargets = enemyUnits.filter((unit) => isAliveUnit(unit) && unit.col === (actionTarget?.col ?? target?.col));
  const inkColumnTargets = enemyUnits.filter((unit) => isAliveUnit(unit) && unit.col === (actionTarget?.col ?? target?.col));
  const inkBombTargets = enemyUnits.filter((unit) => isAliveUnit(unit) && Math.abs(unit.row - (actionTarget?.row ?? target?.row ?? attacker.row)) <= inkBombRadius && Math.abs(unit.col - (actionTarget?.col ?? target?.col ?? attacker.col)) <= inkBombRadius);
  let visualUnits: Unit[] = [];
  if (skill.effect === "heat_seek" || flags.selfShieldImmune) visualUnits = resolvedSkillTarget && hasActiveSprite(resolvedSkillTarget) ? [resolvedSkillTarget] : [];
  else if (flags.peace) visualUnits = peaceTargets.filter(hasActiveSprite); else if (flags.guardianPact) visualUnits = guardianTargets.filter(hasActiveSprite); else if (flags.mirrorReflect) visualUnits = hasActiveSprite(attacker) ? [attacker] : []; else if (flags.springHeal || flags.blessRain) visualUnits = allyUnits.filter((unit) => isAliveUnit(unit) && hasActiveSprite(unit)); else if (flags.unicornBuff) visualUnits = unicornTargets.filter(hasActiveSprite); else if (flags.frostStorm) visualUnits = frostStormTargets.filter(hasActiveSprite); else if (flags.inkColumn) visualUnits = inkColumnTargets.filter(hasActiveSprite); else if (flags.inkBomb) visualUnits = inkBombTargets.filter(hasActiveSprite); else if (flags.hot) visualUnits = hotTargets.filter(hasActiveSprite); else if (flags.purify) visualUnits = purifyTargets.filter(hasActiveSprite); else if (skill.effect === "multi_sting_poison") visualUnits = multiStingTargets.filter(hasActiveSprite); else if (flags.chainShock) visualUnits = chainShockTargets.filter(hasActiveSprite); else if (flags.fireball) visualUnits = fireballTargets.filter(hasActiveSprite); else if (flags.rowGuard) visualUnits = rowAllyTargets.filter(hasActiveSprite); else if (flags.columnBleed) visualUnits = enemyUnits.filter((unit) => isAliveUnit(unit) && unit.col === actionTarget.col && hasActiveSprite(unit)); else visualUnits = previewVisualUnits.length ? previewVisualUnits : enemyUnits.filter((unit) => isAliveUnit(unit) && unit.row === actionTarget.row && hasActiveSprite(unit));
  return { actionTarget, resolvedSkillTarget, visualUnits: dedupeUnits(visualUnits) };
}
