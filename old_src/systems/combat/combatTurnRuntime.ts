export interface CombatUnit {
  side?: string;
  alive?: boolean;
  isDead?: boolean;
  name?: string;
  uid?: string | number;
  rage?: number;
  rageMax?: number;
  statuses?: Record<string, unknown>;
  mods?: Record<string, unknown>;
  environmentMods?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CombatSkill {
  name?: string;
  effect?: unknown;
  damageType?: string;
  actionPattern?: string;
  [key: string]: unknown;
}

export interface CombatState {
  playerUnits: CombatUnit[];
  enemyUnits: CombatUnit[];
  turnOrder: CombatUnit[];
  currentTurn: number;
  combatLog: Record<string, unknown>[];
  isFinished: boolean;
  winner: string | null;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  actionType?: string;
  useSkill?: boolean;
  resetRage?: boolean;
  rageChange?: number;
  message?: string;
}

export interface SkillResult {
  success: boolean;
  error?: string;
  skillName?: string;
  skillEffect?: unknown;
  caster?: CombatUnit;
  targets?: CombatUnit[];
  damageType?: string;
  actionPattern?: string;
  message?: string;
}

function calculateTurnOrder(allUnits: CombatUnit[]): CombatUnit[] {
  const playerUnits = allUnits.filter((unit) => unit.side === "LEFT");
  const enemyUnits = allUnits.filter((unit) => unit.side === "RIGHT");
  const turnOrder: CombatUnit[] = [];
  const maxLen = Math.max(playerUnits.length, enemyUnits.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (i < playerUnits.length) turnOrder.push(playerUnits[i]);
    if (i < enemyUnits.length) turnOrder.push(enemyUnits[i]);
  }
  return turnOrder;
}

export function initializeCombat(playerUnits: CombatUnit[], enemyUnits: CombatUnit[]): CombatState {
  const allUnits = [...playerUnits, ...enemyUnits];
  return { playerUnits: [...playerUnits], enemyUnits: [...enemyUnits], turnOrder: calculateTurnOrder(allUnits), currentTurn: 0, combatLog: [], isFinished: false, winner: null };
}

export function getNextActor(state: CombatState | null | undefined): CombatUnit | null {
  if (!state?.turnOrder?.length) return null;
  while (state.currentTurn < state.turnOrder.length) {
    const actor = state.turnOrder[state.currentTurn];
    state.currentTurn += 1;
    if (actor && actor.alive !== false && !actor.isDead) return actor;
  }
  return null;
}

export function executeAction(state: CombatState | null | undefined, actor: CombatUnit | null | undefined): ActionResult {
  if (!actor || !state) return { success: false, error: "Invalid actor or state" };
  if (actor.alive === false || actor.isDead) return { success: false, error: "Actor is dead" };
  const rageMax = actor.rageMax ?? 100;
  const currentRage = actor.rage ?? 0;
  const shouldUseSkill = currentRage >= rageMax;
  const statuses = actor.statuses ?? {};
  const isSilenced = (typeof statuses.silence === "number" ? statuses.silence : 0) > 0;
  const isDisarmed = (typeof statuses.disarmTurns === "number" ? statuses.disarmTurns : 0) > 0;
  if (shouldUseSkill && !isSilenced) return { success: true, actionType: "SKILL", useSkill: true, resetRage: true, rageChange: -currentRage, message: `${actor.name} uses skill` };
  if (isDisarmed) return { success: true, actionType: "DISARMED", useSkill: false, rageChange: 0, message: `${actor.name} is disarmed` };
  const mods = actor.mods ?? {};
  const environmentMods = actor.environmentMods ?? {};
  const rageGainRate = 1 + (typeof mods.rageGainPct === "number" ? mods.rageGainPct : 0) + (typeof environmentMods.rageGainPct === "number" ? environmentMods.rageGainPct : 0);
  return { success: true, actionType: "BASIC_ATTACK", useSkill: false, rageChange: Math.round(20 * rageGainRate), message: `${actor.name} uses basic attack` };
}

export function executeSkill(caster: CombatUnit | null | undefined, skill: CombatSkill | null | undefined, targets: CombatUnit | CombatUnit[] | null | undefined, state: CombatState | null | undefined): SkillResult {
  if (!caster || !skill || !targets || !state) return { success: false, error: "Invalid parameters" };
  if (!skill.name || !skill.effect) return { success: false, error: "Invalid skill definition" };
  const silence = caster.statuses?.silence;
  if (typeof silence === "number" && silence > 0) return { success: false, error: "Caster is silenced" };
  const targetArray = Array.isArray(targets) ? targets : [targets];
  const validTargets = targetArray.filter((target) => target && target.alive !== false && !target.isDead);
  if (!validTargets.length) return { success: false, error: "No valid targets" };
  return { success: true, skillName: skill.name, skillEffect: skill.effect, caster, targets: validTargets, damageType: skill.damageType ?? "physical", actionPattern: skill.actionPattern ?? "MELEE_FRONT", message: `${caster.name} casts ${skill.name}` };
}
