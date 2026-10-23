import { applySharedOffensiveMageEffect } from "./sceneOffensiveMageEffects.js";
import { applySharedOffensiveMeleeEffect } from "./sceneOffensiveMeleeEffects.js";
import { applySharedOffensiveRangedEffect } from "./sceneOffensiveRangedEffects.js";

type SkillEffectContext = Record<string, unknown>;

export function applySharedOffensiveSkillEffect(scene: unknown, context: SkillEffectContext): boolean {
  if (applySharedOffensiveMageEffect(scene, context)) return true;
  if (applySharedOffensiveRangedEffect(scene as Parameters<typeof applySharedOffensiveRangedEffect>[0], context as unknown as Parameters<typeof applySharedOffensiveRangedEffect>[1])) return true;
  if (applySharedOffensiveMeleeEffect(scene, context)) return true;
  return false;
}
