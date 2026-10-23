import { buildCommonSkillEffectContext } from "./sceneCommonSkillEffectUtils.js";
import { applySharedCommonCombatSkillEffect } from "./sceneCommonSkillCombatEffects.js";
import { applySharedCommonDefenseSkillEffect } from "./sceneCommonSkillDefenseEffects.js";
import { applySharedCommonUtilitySkillEffect } from "./sceneCommonSkillUtilityEffects.js";

type SkillEffectContext = Record<string, unknown>;

export async function applySharedCommonSkillEffect(scene: unknown, context: SkillEffectContext): Promise<boolean> {
  const runtimeContext = buildCommonSkillEffectContext(scene as Parameters<typeof buildCommonSkillEffectContext>[0], context as unknown as Parameters<typeof buildCommonSkillEffectContext>[1]);
  if (!runtimeContext.attacker || !runtimeContext.skill) return false;

  if (await applySharedCommonCombatSkillEffect(scene as Parameters<typeof applySharedCommonCombatSkillEffect>[0], runtimeContext as unknown as Parameters<typeof applySharedCommonCombatSkillEffect>[1])) return true;
  if (await applySharedCommonDefenseSkillEffect(scene as Parameters<typeof applySharedCommonDefenseSkillEffect>[0], runtimeContext as unknown as Parameters<typeof applySharedCommonDefenseSkillEffect>[1])) return true;
  if (await applySharedCommonUtilitySkillEffect(scene as Parameters<typeof applySharedCommonUtilitySkillEffect>[0], runtimeContext as unknown as Parameters<typeof applySharedCommonUtilitySkillEffect>[1])) return true;
  return false;
}
