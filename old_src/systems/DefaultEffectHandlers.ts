import { getStarTurns, getStarDotDamage } from "../core/gameUtils.js";

export interface EffectUnit {
  alive?: boolean;
  hp: number;
  maxHp: number;
  statuses: Record<string, number> & Record<string, unknown>;
  sprite?: { x: number; y: number };
  [key: string]: unknown;
}

export interface EffectSkill {
  name: string;
  damageType?: string;
  stunChance?: number;
  stunTurns?: number;
  turns?: number;
  [key: string]: unknown;
}

export interface EffectScene {
  resolveDamage: (attacker: EffectUnit, target: EffectUnit, rawSkill: number, damageType?: string, skillName?: string, skillOpts?: Record<string, unknown>) => void;
  resolveHeal: (attacker: EffectUnit, target: EffectUnit, healValue: number, skillName?: string, skillOpts?: Record<string, unknown>) => void;
  rollChance?: (chance: number) => boolean;
  showFloatingText: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi: (unit: EffectUnit) => void;
}

export interface EffectContext {
  scene: EffectScene;
  attacker: EffectUnit;
  target: EffectUnit;
  allies: EffectUnit[];
  enemies: EffectUnit[];
  rawSkill: number;
  skill: EffectSkill;
  skillOpts?: Record<string, unknown>;
  starBonuses: { chanceMult: number };
}

export type EffectHandler = (context: EffectContext) => Promise<void>;

export const defaultEffectHandlers: Record<string, EffectHandler> = {
  single_damage: async (context) => {
    const { scene, attacker, target, rawSkill, skill, skillOpts } = context;
    scene.resolveDamage(attacker, target, rawSkill, skill.damageType, skill.name, skillOpts);
  },

  global_damage: async (context) => {
    const { scene, attacker, enemies, rawSkill, skill, skillOpts } = context;
    enemies.forEach((enemy) => {
      scene.resolveDamage(attacker, enemy, rawSkill, skill.damageType, skill.name, skillOpts);
    });
  },

  single_heal: async (context) => {
    const { scene, attacker, allies, rawSkill, skill, skillOpts } = context;
    const healVal = Math.floor(rawSkill);
    const validAllies = allies.filter((ally) => ally.alive && ally.hp < ally.maxHp);
    if (validAllies.length > 0) {
      validAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
      scene.resolveHeal(attacker, validAllies[0], healVal, skill.name, skillOpts);
    }
  },

  global_heal: async (context) => {
    const { scene, attacker, allies, rawSkill, skill, skillOpts } = context;
    const healVal = Math.floor(rawSkill);
    allies.forEach((ally) => {
      if (ally.alive) scene.resolveHeal(attacker, ally, healVal, skill.name, skillOpts);
    });
  },

  single_stun: async (context) => {
    const { scene, attacker, target, rawSkill, skill, skillOpts, starBonuses } = context;
    scene.resolveDamage(attacker, target, rawSkill, skill.damageType, skill.name, skillOpts);
    const effectiveStunChance = Math.min(1, (skill.stunChance || 1) * starBonuses.chanceMult);
    const rollChance = scene.rollChance ?? ((chance: number) => Math.random() < chance);
    if (target.alive && rollChance(effectiveStunChance)) {
      target.statuses.stun = Math.max(target.statuses.stun ?? 0, skill.stunTurns || 1);
      if (target.sprite) scene.showFloatingText(target.sprite.x, target.sprite.y - 45, "CHOÁNG", "#ffd97b");
      scene.updateCombatUnitUi(target);
    }
  },

  team_buff_def: async (context) => {
    const { scene, allies, skill } = context;
    allies.forEach((ally) => {
      if (ally.alive) {
        ally.statuses.defBuffTurns = Math.max(ally.statuses.defBuffTurns ?? 0, skill.turns || 3);
        ally.statuses.defBuffValue = Math.max(ally.statuses.defBuffValue ?? 0, 15);
        scene.updateCombatUnitUi(ally);
      }
    });
  },

  global_slow: async (_context) => {
    // Removed: slow mechanic replaced by evasion system
  }
};
