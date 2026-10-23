import type Phaser from "phaser";
import CombatSystem from "../../systems/CombatSystem.js";

const DOT_LABELS: Record<string, string> = { burn: "CHÁY", poison: "ĐỘC", bleed: "CHẢY MÁU", disease: "DỊCH BỆNH" };
const CONTROL_LABELS: Record<string, string> = { freeze: "freeze", stun: "stun", sleep: "sleep" };
const CONTROL_LOG_LABELS: Record<string, string> = { freeze: "đóng băng", stun: "choáng", sleep: "ngủ" };

type StatusUnit = { side: string; row: number; col: number; alive: boolean; hp: number; maxHp: number; sprite: { x: number; y: number; active: boolean }; name?: string; uid?: string; statuses?: Record<string, unknown>; mods?: Record<string, unknown>; environmentMods?: Record<string, unknown>; [key: string]: unknown };
type StatusEffect = { type: string; damage?: number; healed?: number; spreads?: boolean };
type StatusTickResult = { success: boolean; triggeredEffects?: StatusEffect[]; controlStatus?: string | null };
type CombatState = { combatLog: string[] };
type StatusScene = Phaser.Scene & {
  getCombatUnitAt: (side: string, row: number, col: number) => StatusUnit | null | undefined;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi: (unit: StatusUnit) => void;
  resolveDamage: (attacker: unknown, target: StatusUnit, amount: number, damageType: string, label: string, options?: { noRage?: boolean; noReflect?: boolean }) => void;
  healUnit?: (caster: unknown, target: StatusUnit, amount: number, reason: string) => number;
  addLog: (message: string) => void;
  [key: string]: unknown;
};
type LogHook = (actor: StatusUnit, payload: { type: string; damage?: number; healed?: number; spreads?: boolean }) => void;
type LogSkipHook = (actor: StatusUnit, reason: string) => void;
type ProcessHooks = { logDot: LogHook; logHeal: LogHook; logSkip: LogSkipHook };
type ProcessOptions = { state?: CombatState; logDot?: LogHook; logHeal?: LogHook; logSkip?: LogSkipHook };

function spreadDisease(scene: StatusScene, unit: StatusUnit, damage: number, state: CombatState): void {
  const neighbors = [{ row: unit.row - 1, col: unit.col }, { row: unit.row + 1, col: unit.col },
    { row: unit.row, col: unit.col - 1 }, { row: unit.row, col: unit.col + 1 }];
  neighbors.forEach((pos) => {
    const neighbor = scene.getCombatUnitAt(unit.side, pos.row, pos.col);
    if (!neighbor || !neighbor.alive) return;
    const diseaseTurns = Number((neighbor.statuses as { diseaseTurns?: number } | undefined)?.diseaseTurns ?? 0);
    if (diseaseTurns > 0) return;
    CombatSystem.applyStatusEffect(neighbor as unknown as Parameters<typeof CombatSystem.applyStatusEffect>[0], { type: "disease", duration: 2, value: damage }, state as unknown as Parameters<typeof CombatSystem.applyStatusEffect>[2]);
    if (neighbor.sprite?.active) scene.showFloatingText(neighbor.sprite.x, neighbor.sprite.y - 45, "LÂY BỆNH", "#880088");
    scene.updateCombatUnitUi(neighbor);
  });
}

function applyTriggeredEffect(scene: StatusScene, unit: StatusUnit, effect: StatusEffect, state: CombatState, hooks: ProcessHooks): void {
  if (effect.damage && effect.damage > 0) {
    scene.resolveDamage(null, unit, effect.damage, "true", DOT_LABELS[effect.type] || effect.type.toUpperCase(), { noRage: true, noReflect: true });
    hooks.logDot?.(unit, effect);
    if (effect.spreads && effect.type === "disease") spreadDisease(scene, unit, effect.damage, state);
  }
  if (effect.healed && effect.healed > 0 && unit.alive) {
    let applied = effect.healed;
    if (typeof scene.healUnit === "function") applied = scene.healUnit(null, unit, effect.healed, "HỒI DẦN");
    else { unit.hp = Math.min(unit.maxHp ?? unit.hp, (unit.hp ?? 0) + effect.healed); applied = effect.healed; }
    scene.updateCombatUnitUi(unit);
    if (applied > 0) hooks.logHeal?.(unit, { ...effect, healed: applied });
  }
}

function applyEnvironmentTurnEffects(scene: StatusScene, unit: StatusUnit, hooks: ProcessHooks): void {
  const poisonAuraDamage = (Number(unit?.mods?.poisonAuraDamage) || 0) + (Number(unit?.environmentMods?.poisonAuraDamage) || 0);
  if (poisonAuraDamage <= 0 || !unit?.alive) return;
  scene.resolveDamage(null, unit, poisonAuraDamage, "true", "ĐỘC MÔI TRƯỜNG", { noRage: true, noReflect: true });
  hooks.logDot?.(unit, { type: "poison", damage: poisonAuraDamage });
}

export function processSharedStartTurn(scene: StatusScene, unit: StatusUnit, options: ProcessOptions = {}): string | null {
  const state: CombatState = options.state ?? { combatLog: [] };
  const hooks: ProcessHooks = {
    logDot: options.logDot ?? ((actor, effect) => { scene.addLog(`🔥 ${actor.name} chịu ${effect.damage} sát thương ${DOT_LABELS[effect.type] || effect.type}.`); }),
    logHeal: options.logHeal ?? ((actor, effect) => { scene.addLog(`💚 ${actor.name} hồi ${effect.healed} HP (hồi dần).`); }),
    logSkip: options.logSkip ?? ((actor, reasonKey) => {
      if (reasonKey === "dot") scene.addLog(`💀 ${actor.name} bỏ lượt (sát thương theo lượt).`);
      else if (CONTROL_LOG_LABELS[reasonKey]) scene.addLog(`🚫 ${actor.name} bỏ lượt (${CONTROL_LOG_LABELS[reasonKey]}).`);
    })
  };
  const statusResult: StatusTickResult = CombatSystem.tickStatusEffects(unit as unknown as Parameters<typeof CombatSystem.tickStatusEffects>[0], state as unknown as Parameters<typeof CombatSystem.tickStatusEffects>[1]);
  if (!statusResult?.success) { scene.updateCombatUnitUi(unit); return null; }
  (statusResult.triggeredEffects || []).forEach((effect) => applyTriggeredEffect(scene, unit, effect, state, hooks));
  if (unit.alive) applyEnvironmentTurnEffects(scene, unit, hooks);
  let skipped: string | null = null;
  if (!unit.alive) skipped = "dot";
  else if (statusResult.controlStatus && CONTROL_LABELS[statusResult.controlStatus]) skipped = statusResult.controlStatus;
  scene.updateCombatUnitUi(unit);
  if (skipped) hooks.logSkip(unit, skipped);
  return skipped;
}
