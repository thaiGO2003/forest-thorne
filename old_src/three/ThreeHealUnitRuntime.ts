/**
 * ThreeHealUnitRuntime.ts
 *
 * Combat unit healing runtime for Three.js engine.
 * Handles direct healing, soul link distribution, heal block verification,
 * modifiers, cleanse and rage buffs, audio triggers, and floating text integration.
 */

import { isHealBlockActive } from "../scenes/shared/sceneHealBlockRuntime.js";

/**
 * ============================================================================
 * 1. LOCAL TYPES
 * ============================================================================
 */

type Unit = {
  uid: string;
  alive?: boolean;
  hp: number;
  maxHp: number;
  sprite?: { x?: number; y?: number; active?: boolean };
  rage?: number;
  rageMax?: number;
  shield?: number;
  statuses?: Record<string, number | string | null | undefined>;
  mods?: Record<string, number>;
  environmentMods?: Record<string, number>;
  side?: string;
  row?: number;
  col?: number;
  [key: string]: unknown;
};

type HealScene = {
  getCombatUnits: (side: string) => Unit[];
  isHealBlockActive?: (scene: HealScene, target: Unit) => boolean;
  showFloatingText?: (x: number, y: number, text: string, color: string) => void;
  updateCombatUnitUi?: (target: Unit) => void;
  audioFx?: { play?: (key: string) => void };
  vfx?: { pulseAt?: (x: number, y: number, color: number, size: number, duration: number) => void };
  addShield?: (target: Unit, amount: number) => void;
  [key: string]: unknown;
};

type HealOptions = {
  playAudio?: boolean;
  pulseVfx?: boolean;
  skipSoulLink?: boolean;
};

const CLEANSABLE_DEBUFFS: readonly string[] = [
  "freeze",
  "stun",
  "sleep",
  "silence",
  "burnTurns",
  "poisonTurns",
  "bleedTurns",
  "diseaseTurns",
  "healBlockTurns",
  "healReductionTurns"
];

/**
 * ============================================================================
 * 2. HELPER FUNCTIONS
 * ============================================================================
 */

function collectSoulLinkRecipients(scene: HealScene, source: Unit): Unit[] {
  if (!scene || !source?.uid || typeof scene.getCombatUnits !== "function") {
    return [];
  }

  const recipients: Unit[] = [];
  for (const side of ["LEFT", "RIGHT"] as const) {
    (scene.getCombatUnits(side) ?? []).forEach((unit) => {
      if (!unit?.alive || unit.uid === source.uid) return;
      if (unit.statuses?.soulLinkId !== source.uid) return;
      if ((Number(unit.statuses?.soulLinkTurns ?? 0) || 0) <= 0) return;
      recipients.push(unit);
    });
  }

  return recipients.sort((a, b) => {
    const aPriority = (Number(a.statuses?.soulLinkRageGain ?? 0) || 0) + (Number(a.statuses?.soulLinkCleanseCount ?? 0) || 0);
    const bPriority = (Number(b.statuses?.soulLinkRageGain ?? 0) || 0) + (Number(b.statuses?.soulLinkCleanseCount ?? 0) || 0);
    if (bPriority !== aPriority) return bPriority - aPriority;
    return (Number(b.statuses?.soulLinkHealMultiplier ?? 0) || 0) - (Number(a.statuses?.soulLinkHealMultiplier ?? 0) || 0);
  });
}

function applyDirectHeal(
  scene: HealScene,
  caster: Unit | null,
  target: Unit,
  amount: number,
  reason: string | null,
  options: HealOptions = {}
): number {
  if (!target || !target.alive) {
    return 0;
  }

  let normalizedAmount = amount;
  if (typeof normalizedAmount !== "number" || !Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    normalizedAmount = 0;
  }

  const healBonus = caster ? 1 + (Number(caster.mods?.healPct) || 0) + (Number(caster.environmentMods?.healPct) || 0) : 1;
  const healReceivedBonus = 1 + (Number(target.mods?.healReceivedPct) || 0) + (Number(target.environmentMods?.healReceivedPct) || 0);
  const healReductionMultiplier = 1 - Math.max(0, Number(target.statuses?.healReductionPct ?? 0) || 0);
  const healRaw = Math.max(1, Math.round(normalizedAmount * healBonus * Math.max(0, healReceivedBonus) * Math.max(0, healReductionMultiplier)));

  if (isHealBlockActive(scene, target)) {
    scene.showFloatingText?.(target.sprite?.x ?? 0, (target.sprite?.y ?? 0) - 45, "CẤM HỒI", "#ff6b6b");
    scene.updateCombatUnitUi?.(target);
    return 0;
  }

  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + healRaw);
  const applied = target.hp - before;

  if (applied <= 0) {
    return 0;
  }

  if (options.playAudio) {
    scene.audioFx?.play?.("heal");
  }

  if (options.pulseVfx) {
    scene.vfx?.pulseAt?.(target.sprite?.x ?? 0, (target.sprite?.y ?? 0) - 10, 0x9dffba, 14, 180);
  }

  scene.showFloatingText?.(target.sprite?.x ?? 0, (target.sprite?.y ?? 0) - 45, `+${applied}`, "#9dffba");

  if (caster && reason) {
    scene.showFloatingText?.(caster.sprite?.x ?? 0, (caster.sprite?.y ?? 0) - 37, reason, "#c9ffde");
  }

  scene.updateCombatUnitUi?.(target);
  return applied;
}

/**
 * ============================================================================
 * 3. MAIN EXPORTED RUNTIME FUNCTIONS
 * ============================================================================
 */

/**
 * Apply healing to a combat unit, handling soul links, heal blocks, and status updates.
 *
 * @param scene - Host combat scene implementing HealScene
 * @param caster - Caster unit or null
 * @param target - Target unit receiving the heal
 * @param amount - Base healing value
 * @param reason - Optional text string explaining the source (e.g. skill name)
 * @param options - Audio, VFX, and link control options
 * @returns Total hit points restored across target and linked allies
 */
export function applySceneHealUnit(
  scene: HealScene,
  caster: Unit | null,
  target: Unit,
  amount: number,
  reason: string | null,
  options: HealOptions = {}
): number {
  if (!target || !target.alive) {
    return 0;
  }

  const soulLinkRecipients = options.skipSoulLink ? [] : collectSoulLinkRecipients(scene, target);
  if (!soulLinkRecipients.length) {
    return applyDirectHeal(scene, caster, target, amount, reason, options);
  }

  let normalizedAmount = amount;
  if (typeof normalizedAmount !== "number" || !Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    normalizedAmount = 0;
  }

  const healBonus = caster ? 1 + (Number(caster.mods?.healPct) || 0) + (Number(caster.environmentMods?.healPct) || 0) : 1;
  const healReceivedBonus = 1 + (Number(target.mods?.healReceivedPct) || 0) + (Number(target.environmentMods?.healReceivedPct) || 0);
  const healReductionMultiplier = 1 - Math.max(0, Number(target.statuses?.healReductionPct ?? 0) || 0);
  const healRaw = Math.max(1, Math.round(normalizedAmount * healBonus * Math.max(0, healReceivedBonus) * Math.max(0, healReductionMultiplier)));

  if (isHealBlockActive(scene, target)) {
    scene.showFloatingText?.(target.sprite?.x ?? 0, (target.sprite?.y ?? 0) - 45, "CẤM HỒI", "#ff6b6b");
    scene.updateCombatUnitUi?.(target);
    return 0;
  }

  const sourceHpRatio = Number(target.maxHp ?? 0) > 0 ? Number(target.hp ?? 0) / Number(target.maxHp ?? 0) : 0;
  const sourceAppliedHeal = Math.max(0, Math.min(healRaw, Math.max(0, Number(target.maxHp ?? 0) - Number(target.hp ?? 0))));

  if (sourceAppliedHeal <= 0) {
    return 0;
  }

  let totalApplied = 0;
  soulLinkRecipients.forEach((recipient, index) => {
    const multiplier = Number(recipient.statuses?.soulLinkHealMultiplier ?? 1) || 1;
    const recipientHeal = Math.max(1, Math.round(sourceAppliedHeal * multiplier));
    totalApplied += applyDirectHeal(scene, caster, recipient, recipientHeal, reason, { ...options, skipSoulLink: true });

    if (sourceHpRatio > 0.5 && (Number(recipient.statuses?.soulLinkShieldPct ?? 0) || 0) > 0) {
      const shieldPct = Math.max(0, Number(recipient.statuses?.soulLinkShieldPct ?? 0) || 0);
      const shieldAmount = Math.max(1, Math.round((Number(recipient.maxHp ?? 0) || 0) * shieldPct));
      scene.addShield?.(recipient, shieldAmount);
    }

    if (sourceHpRatio > 0.5 && index === 0) {
      const cleanseCount = Math.max(0, Math.round(Number(recipient.statuses?.soulLinkCleanseCount ?? 0) || 0));
      if (cleanseCount > 0) {
        let cleansed = 0;
        for (const key of CLEANSABLE_DEBUFFS) {
          if (cleansed >= cleanseCount) break;
          if (Number((recipient.statuses as Record<string, number>)[key] ?? 0) <= 0) continue;
          (recipient.statuses as Record<string, number>)[key] = 0;
          cleansed += 1;
        }
      }

      const rageGain = Math.max(0, Math.round(Number(recipient.statuses?.soulLinkRageGain ?? 0) || 0));
      if (rageGain > 0) {
        recipient.rage = Math.min(recipient.rageMax || 5, (recipient.rage || 0) + rageGain);
      }
    }

    scene.updateCombatUnitUi?.(recipient);
  });

  return totalApplied;
}
