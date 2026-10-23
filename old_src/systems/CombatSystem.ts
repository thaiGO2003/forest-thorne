import {
  executeAction,
  executeSkill,
  getNextActor,
  initializeCombat
} from "./combat/combatTurnRuntime.js";
import { applyDamage, calculateDamage } from "./combat/combatDamageRuntime.js";
import { applyStatusEffect, tickStatusEffects } from "./combat/combatStatusRuntime.js";
import { checkCombatEnd } from "./combat/combatResolutionRuntime.js";

export interface CombatSystemApi {
  initializeCombat: typeof initializeCombat;
  getNextActor: typeof getNextActor;
  executeAction: typeof executeAction;
  executeSkill: typeof executeSkill;
  calculateDamage: typeof calculateDamage;
  applyDamage: typeof applyDamage;
  applyStatusEffect: typeof applyStatusEffect;
  tickStatusEffects: typeof tickStatusEffects;
  checkCombatEnd: typeof checkCombatEnd;
}

export {
  initializeCombat,
  getNextActor,
  executeAction,
  executeSkill,
  calculateDamage,
  applyDamage,
  applyStatusEffect,
  tickStatusEffects,
  checkCombatEnd
};

export const CombatSystem: CombatSystemApi = {
  initializeCombat,
  getNextActor,
  executeAction,
  executeSkill,
  calculateDamage,
  applyDamage,
  applyStatusEffect,
  tickStatusEffects,
  checkCombatEnd
};

export default CombatSystem;
