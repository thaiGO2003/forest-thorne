import { COLS } from "../../core/boardConstants.js";
import {
  starAreaBonus,
  starEffectChanceMultiplier,
  starTargetBonus
} from "../../core/gameUtils.js";
import {
  BASIC_ATTACK_ROLL_MAX,
  BASIC_ATTACK_ROLL_MIN,
  getBasicAttackProfile,
  getExpectedBasicAttackVisualMode,
  isBasicAttackVisualModeCompatible,
  isMeleeAssassinUnit,
  isSkillAttackStyleCompatible,
  resolveSkillAttackStyle
} from "../../core/damageResolver.js";
import {
  getAddBlendMode,
  launchArcProjectile
} from "../../../data/units/shared/arcProjectileFx.js";
import {
  playAssassinAnchoredExtensionFx,
  playAssassinContactComboFx,
  playAssassinShortSprayFx
} from "../../../data/units/shared/meleeAssassinSkillFamilies.js";
import { resolveSharedSkillVisualPlan } from "./sceneSkillPreviewRuntime.js";
import { applySharedCommonSkillEffect } from "./sceneCommonSkillEffects.js";
import { applySharedOffensiveSkillEffect } from "./sceneOffensiveSkillEffects.js";
import { applySharedSupportSkillEffect } from "./sceneSupportSkillEffects.js";
import { resolveSkillPrimaryTarget } from "./sceneSkillTargeting.js";
import {
  recordTooltipStatusChanges,
  snapshotTooltipStatusState
} from "./tooltipStatusRuntime.js";
import { releaseFxNode } from "../../core/fxPool.js";
import type { FxNode, FxPool } from "../../core/fxPool.js";

type DamageType = "physical" | "magic";
type VisualMode = "contact" | "projectile" | "beam";
type ActionPattern = "MELEE_FRONT" | "RANGED_STATIC" | "ASSASSIN_BACK" | "SELF";
type SkillEffectOptions = { isSkill?: boolean; [key: string]: unknown };

interface CombatSkill {
  effect: string;
  name?: string;
  effectLabel?: string;
  damageType?: DamageType;
  actionPattern?: ActionPattern;
  logic?: (ctx: SkillLogicContext) => Promise<void> | void;
  [key: string]: unknown;
}

interface SkillLogicContext {
  scene: SceneLike;
  attacker: UnitLike;
  target: UnitLike;
  rawSkill: number;
  skill: CombatSkill;
  skillOpts: SkillEffectOptions;
  enemies: UnitLike[];
  allies: UnitLike[];
  starChanceMult: number;
  areaBonus: number;
  targetBonus: number;
}

interface UnitLike {
  side?: "LEFT" | "RIGHT";
  homeRow?: number;
  homeCol?: number;
  col: number;
  row: number;
  range?: number;
  star?: number;
  classType?: string;
  tribe?: string;
  uid?: string | number;
  alive?: boolean;
  baseId?: string;
  skillId?: string;
  x?: number;
  y?: number;
  icon?: { x?: number; y?: number; __deadAnimPlaying?: boolean; setText?: (text: string) => void };
  sprite?: { x?: number; y?: number; active?: boolean };
  statuses?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SceneLike {
  add?: {
    circle?: (x: number, y: number, r: number, color: number, alpha: number) => Phaser.GameObjects.Arc;
    rectangle?: (x: number, y: number, w: number, h: number, color: number, alpha: number) => Phaser.GameObjects.Rectangle;
    container?: (x: number, y: number) => { setDepth?: (d: number) => void; destroy?: () => void; add?: (...items: unknown[]) => unknown };
  };
  tweens?: { add?: (cfg: unknown) => unknown };
  time?: { delayedCall?: (ms: number, cb: () => void) => unknown };
  fxPool?: FxPool | null;
  audioFx?: { play?: (key: string) => void };
  distanceToFrontline?: (unit: UnitLike) => number;
  tweenCombatUnit?: (unit: UnitLike, x: number, y: number, ms: number) => Promise<void>;
  wait?: (ms: number) => Promise<void>;
  gridToScreen?: (col: number, row: number) => { x: number; y: number };
  resolveDamage?: (attacker: UnitLike, target: UnitLike, raw: number, type: DamageType, label: string, opts?: SkillEffectOptions) => number;
  healUnit?: (attacker: UnitLike, target: UnitLike, amount: number, reason: string) => void;
  updateCombatUnitUi?: (unit: UnitLike) => void;
  showFloatingText?: (x: number, y: number, text: string, color: string) => void;
  applySkillEffect?: (attacker: UnitLike, target: UnitLike, skill: CombatSkill) => Promise<void>;
  setCombatBorder?: (unit: UnitLike, kind: string) => void;
  clearCombatBorder?: (unit: UnitLike) => void;
  calcSkillRaw?: (unit: UnitLike, skill: CombatSkill) => number;
  getCombatUnits?: (side: "LEFT" | "RIGHT") => UnitLike[];
  getEffectiveAtk?: (unit: UnitLike) => number;
  getEffectiveDef?: (unit: UnitLike) => number;
  getEffectiveMdef?: (unit: UnitLike) => number;
  getEffectiveMatk?: (unit: UnitLike) => number;
  [key: string]: unknown;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === "function";
}

function canDrawBasicFx(scene: SceneLike | null | undefined): boolean {
  return !!(scene?.add?.circle && scene?.tweens?.add);
}

function damageTint(damageType: DamageType | null | undefined): number {
  if (damageType === "magic") return 0x9ed8ff;
  return 0xf8c877;
}

function spawnFallbackImpact(scene: SceneLike, x: number, y: number, damageType: DamageType): void {
  if (!canDrawBasicFx(scene)) return;
  const tint = damageTint(damageType);
  const pool = scene.fxPool;
  const flash = pool?.acquireCircle?.(x, y - 4, 9, tint, 0.32, 8500)
    ?? scene.add?.circle?.(x, y - 4, 9, tint, 0.32);
  const ring = pool?.acquireCircle?.(x, y - 4, 13, tint, 0.14, 8500)
    ?? scene.add?.circle?.(x, y - 4, 13, tint, 0.14);
  ring?.setStrokeStyle?.(2, 0xf7fbff, 0.84);
  const releaseFlash = () => releaseFxNode(pool, flash, "circle");
  const releaseRing = () => releaseFxNode(pool, ring, "circle");
  if (pool) {
    if (flash) pool.tween(flash, { targets: flash, alpha: 0, scale: 1.9, duration: 150, ease: "Cubic.out" }, "circle");
    if (ring) pool.tween(ring, { targets: ring, alpha: 0, scale: 1.7, duration: 190, ease: "Cubic.out" }, "circle");
    return;
  }
  scene.tweens?.add?.({
    targets: flash,
    alpha: 0,
    scale: 1.9,
    duration: 150,
    ease: "Cubic.out",
    onComplete: releaseFlash
  });
  scene.tweens?.add?.({
    targets: ring,
    alpha: 0,
    scale: 1.7,
    duration: 190,
    ease: "Cubic.out",
    onComplete: releaseRing
  });
}

function playFallbackContactBasicAttack(scene: SceneLike, attacker: UnitLike, target: UnitLike, damageType: DamageType): Promise<void> {
  scene.audioFx?.play?.("hit");
  const model = attacker.icon as { x?: number; y?: number; __deadAnimPlaying?: boolean } | undefined;
  const ax = (attacker.sprite as { x?: number } | undefined)?.x ?? attacker.x ?? model?.x ?? 0;
  const tx = (target.sprite as { x?: number } | undefined)?.x ?? target.x ?? ax;
  const ty = (target.sprite as { y?: number } | undefined)?.y ?? target.y ?? 0;
  if (model && !model.__deadAnimPlaying && scene?.tweens?.add) {
    const dir = tx >= ax ? 1 : -1;
    const ox = model.x ?? 0;
    const oy = model.y ?? 0;
    scene.tweens.add({
      targets: model,
      x: ox + dir * 8,
      y: oy - 1,
      angle: dir * 7,
      duration: 80,
      ease: "Expo.out",
      onComplete: () => scene.tweens?.add?.({
        targets: model,
        x: ox,
        y: oy,
        angle: 0,
        duration: 170,
        ease: "Sine.inOut"
      })
    });
  }
  return new Promise((resolve) => {
    const impact = () => {
      spawnFallbackImpact(scene, tx, ty, damageType);
      resolve();
    };
    if (scene?.time?.delayedCall) scene.time.delayedCall(70, impact); else impact();
  });
}

function playFallbackProjectileBasicAttack(scene: SceneLike, attacker: UnitLike, target: UnitLike, damageType: DamageType): Promise<void> {
  scene.audioFx?.play?.("hit");
  const model = attacker.icon as { x?: number; y?: number; __deadAnimPlaying?: boolean } | undefined;
  const ax = (attacker.sprite as { x?: number } | undefined)?.x ?? attacker.x ?? model?.x ?? 0;
  const ay = ((attacker.sprite as { y?: number } | undefined)?.y ?? attacker.y ?? model?.y ?? 0) - 10;
  const tx = (target.sprite as { x?: number } | undefined)?.x ?? target.x ?? ax;
  const ty = ((target.sprite as { y?: number } | undefined)?.y ?? target.y ?? ay) - 6;
  if (model && !model.__deadAnimPlaying && scene?.tweens?.add) {
    scene.tweens.add({
      targets: model,
      angle: -4,
      scaleX: 1.04,
      scaleY: 0.96,
      duration: 80,
      yoyo: true,
      ease: "Sine.inOut"
    });
  }
  if (!canDrawBasicFx(scene)) {
    spawnFallbackImpact(scene, tx, ty + 6, damageType);
    return Promise.resolve();
  }
  const addBlendMode = getAddBlendMode(scene as unknown as Parameters<typeof getAddBlendMode>[0]);
  let lastTrail = -1;
  return launchArcProjectile(scene as unknown as Parameters<typeof launchArcProjectile>[0], {
    startX: ax + (tx >= ax ? 10 : -10),
    startY: ay,
    endX: tx,
    endY: ty,
    travelMs: 190,
    arcStyle: "standard",
    createProjectile: () => {
      const projectile = scene.add?.circle?.(0, 0, 4, damageTint(damageType), 0.96);
      projectile?.setStrokeStyle?.(1.5, 0xf7fbff, 0.86);
      projectile?.setBlendMode?.(addBlendMode);
      return projectile;
    },
    onUpdate: ({ point, projectile, t }: { point: { x: number; y: number }; projectile: { scale?: number }; t: number }) => {
      if (projectile && "scale" in projectile) projectile.scale = 1 + Math.sin(Math.PI * t) * 0.12;
      if (t - lastTrail >= 0.16) {
        lastTrail = t;
        const pool = scene.fxPool;
        const trail = pool?.acquireCircle?.(point.x, point.y, 3.2, damageTint(damageType), 0.26, 8500)
          ?? scene.add?.circle?.(point.x, point.y, 3.2, damageTint(damageType), 0.26);
        trail?.setBlendMode?.(addBlendMode);
        if (pool) {
          if (trail) pool.tween(trail, { targets: trail, alpha: 0, scale: 0.35, duration: 130, ease: "Cubic.out" }, "circle");
        } else {
          scene.tweens?.add?.({
            targets: trail,
            alpha: 0,
            scale: 0.35,
            duration: 130,
            ease: "Cubic.out",
            onComplete: () => trail?.destroy?.()
          });
        }
      }
    },
    onImpact: ({ projectile, x, y }: { projectile: { destroy?: () => void }; x: number; y: number }) => {
      projectile.destroy?.();
      spawnFallbackImpact(scene, x, y + 6, damageType);
    }
  });
}

function playFallbackBeamBasicAttack(scene: SceneLike, attacker: UnitLike, target: UnitLike, damageType: DamageType): Promise<void> {
  scene.audioFx?.play?.("hit");
  const ax = (attacker.sprite as { x?: number } | undefined)?.x ?? attacker.x ?? (attacker.icon as { x?: number } | undefined)?.x ?? 0;
  const ay = ((attacker.sprite as { y?: number } | undefined)?.y ?? attacker.y ?? (attacker.icon as { y?: number } | undefined)?.y ?? 0) - 10;
  const tx = (target.sprite as { x?: number } | undefined)?.x ?? target.x ?? ax;
  const ty = ((target.sprite as { y?: number } | undefined)?.y ?? target.y ?? ay) - 6;
  if (!scene?.add?.rectangle || !scene?.tweens?.add) {
    spawnFallbackImpact(scene, tx, ty + 6, damageType);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const beam = scene.add!.rectangle!(
      (ax + tx) * 0.5,
      (ay + ty) * 0.5,
      Math.max(20, Math.hypot(tx - ax, ty - ay)),
      4,
      damageTint(damageType),
      0.72
    );
    beam?.setAngle?.(Math.atan2(ty - ay, tx - ax) * (180 / Math.PI));
    beam?.setBlendMode?.(getAddBlendMode(scene as unknown as Parameters<typeof getAddBlendMode>[0]));
    scene.tweens!.add!({
      targets: beam,
      alpha: 0,
      scaleX: 1.08,
      duration: 150,
      ease: "Cubic.out",
      onComplete: () => {
        beam?.destroy?.();
        spawnFallbackImpact(scene, tx, ty + 6, damageType);
        resolve();
      }
    });
  });
}

function playFallbackBasicAttackVisual(scene: SceneLike, attacker: UnitLike, target: UnitLike, mode: VisualMode, damageType: DamageType): Promise<void> {
  if (mode === "beam") return playFallbackBeamBasicAttack(scene, attacker, target, damageType);
  if (mode === "projectile") return playFallbackProjectileBasicAttack(scene, attacker, target, damageType);
  return playFallbackContactBasicAttack(scene, attacker, target, damageType);
}

function applyPostBasicAttackStatuses(scene: SceneLike, attacker: UnitLike, target: UnitLike, rawDamage: number): void {
  if (!attacker?.alive || !target?.alive) return;
  const attackerStatuses = attacker.statuses ?? {};
  const targetStatuses = target.statuses ?? {};
  const bloodHuntTurns = Number(attackerStatuses.bloodHuntTurns ?? 0);
  const bloodHuntStacks = Math.max(0, Number(attackerStatuses.bloodHuntStacks ?? 0));
  if (bloodHuntTurns <= 0 || bloodHuntStacks <= 0) return;

  const bleedPctPerStack = 0.1;
  const bleedTurns = Math.max(1, Math.round(Number(attackerStatuses.bloodHuntTurns ?? 1)));
  const bleedDamage = Math.max(1, Math.round((Number(rawDamage) || 0) * bleedPctPerStack * bloodHuntStacks));
  targetStatuses.bleedTurns = Math.max(Number(targetStatuses.bleedTurns ?? 0), bleedTurns);
  targetStatuses.bleedDamage = Math.max(Number(targetStatuses.bleedDamage ?? 0), bleedDamage);
  if (attackerStatuses.bloodHuntAntiHeal) {
    targetStatuses.healBlockTurns = Math.max(Number(targetStatuses.healBlockTurns ?? 0), bleedTurns);
    targetStatuses.healBlockSourceId = attacker.uid;
  }
  scene.healUnit?.(attacker, attacker, bleedDamage, "HẤP HUYẾT");
  scene.updateCombatUnitUi?.(target);
  scene.showFloatingText?.((target.sprite as { x?: number } | undefined)?.x ?? 0, ((target.sprite as { y?: number } | undefined)?.y ?? 0) - 45, "CHẢY MÁU", "#ff6b6b");
}

function getFallbackAssassinColors(skill: CombatSkill | null | undefined): { primary: number; secondary: number; accent: number; core: number; text: string; stroke: string } {
  const physical = skill?.damageType !== "magic";
  if (physical) {
    return {
      primary: 0xffb266,
      secondary: 0xff7a45,
      accent: 0xffe4b8,
      core: 0xffffff,
      text: "#ffe6c8",
      stroke: "#5d3117"
    };
  }
  return {
    primary: 0xa6ef88,
    secondary: 0x6dbb63,
    accent: 0xe4ffcb,
    core: 0xffffff,
    text: "#ecffd9",
    stroke: "#355327"
  };
}

function playFallbackMeleeAssassinSkillVisual(scene: SceneLike, attacker: UnitLike, target: UnitLike, skill: CombatSkill, style: string): Promise<void> {
  const actorX = (attacker.sprite as { x?: number } | undefined)?.x ?? attacker.x ?? (attacker.icon as { x?: number } | undefined)?.x ?? 0;
  const actorY = (attacker.sprite as { y?: number } | undefined)?.y ?? attacker.y ?? (attacker.icon as { y?: number } | undefined)?.y ?? 0;
  const targetX = (target.sprite as { x?: number } | undefined)?.x ?? target.x ?? actorX + 90;
  const targetY = (target.sprite as { y?: number } | undefined)?.y ?? target.y ?? actorY;
  const fxLayer = scene?.add?.container ? scene.add.container(0, 0) : null;
  fxLayer?.setDepth?.(9200);
  const common = {
    actorX,
    actorY,
    targetX,
    targetY,
    impactLabel: "",
    title: "",
    colors: getFallbackAssassinColors(skill),
    playSfxKey: "skill"
  };
  const effectPromise = style === "anchored_extension"
    ? playAssassinAnchoredExtensionFx(scene as unknown as Parameters<typeof playAssassinAnchoredExtensionFx>[0], fxLayer!, common)
    : style === "short_spray"
      ? playAssassinShortSprayFx(scene as unknown as Parameters<typeof playAssassinShortSprayFx>[0], fxLayer!, common)
      : playAssassinContactComboFx(scene as unknown as Parameters<typeof playAssassinContactComboFx>[0], fxLayer!, common);
  return Promise.resolve(effectPromise).finally(() => fxLayer?.destroy?.());
}

export function inferSharedActionPattern(attacker: UnitLike | null | undefined): ActionPattern {
  if (!attacker) return "MELEE_FRONT";
  const basicAttack = getBasicAttackProfile(attacker as unknown as Parameters<typeof getBasicAttackProfile>[0]);
  if (basicAttack.delivery !== "melee") return "RANGED_STATIC";
  if (attacker.classType === "ASSASSIN") return "ASSASSIN_BACK";
  return "MELEE_FRONT";
}

export async function runSharedActionPattern(scene: SceneLike, attacker: UnitLike, target: UnitLike, pattern: ActionPattern, impactFn: () => Promise<void> | void): Promise<void> {
  if (pattern === "SELF" || pattern === "RANGED_STATIC") {
    await impactFn();
    return;
  }

  const back = pattern === "ASSASSIN_BACK";
  const deltaFront = attacker.side === "LEFT" ? -1 : 1;
  const deltaBack = -deltaFront;
  const dashCol = Math.max(0, Math.min(COLS - 1, target.col + (back ? deltaBack : deltaFront)));
  const gridToScreen = scene.gridToScreen ?? ((c: number, r: number) => ({ x: 0, y: 0 }));
  const dashPoint = gridToScreen(dashCol, target.row);
  const isFrontlineTarget = scene.distanceToFrontline?.(target) === 0;
  const isMeleeFront = !back && (attacker.range ?? 0) <= 1;
  let finalDashPoint = dashPoint;
  if (isMeleeFront && isFrontlineTarget) {
    const leftFront = gridToScreen(4, target.row);
    const rightFront = gridToScreen(5, target.row);
    finalDashPoint = {
      x: (leftFront.x + rightFront.x) * 0.5,
      y: (leftFront.y + rightFront.y) * 0.5
    };
  }
  const origin = gridToScreen(attacker.homeCol ?? 0, attacker.homeRow ?? 0);

  await scene.tweenCombatUnit?.(attacker, finalDashPoint.x, finalDashPoint.y - 10, 140);
  await scene.wait?.(35);
  await impactFn();
  await scene.wait?.(45);
  await scene.tweenCombatUnit?.(attacker, origin.x, origin.y - 10, 140);
}

export interface ExecuteBasicAttackOptions {
  getVisualModule?: (baseId: string) => { playBasicAttack?: (scene: SceneLike, attacker: UnitLike, target: UnitLike) => Promise<void> | void } | null;
  randomBetween: (min: number, max: number) => number;
  onBeforeAction?: (ctx: { attacker: UnitLike; target: UnitLike; pattern: ActionPattern }) => void;
  onAfterAction?: (ctx: { attacker: UnitLike; target: UnitLike; pattern: ActionPattern }) => void;
}

export async function executeSharedBasicAttack(scene: SceneLike, attacker: UnitLike, target: UnitLike, options: ExecuteBasicAttackOptions): Promise<void> {
  const {
    getVisualModule,
    randomBetween,
    onBeforeAction,
    onAfterAction
  } = options;
  const pattern = inferSharedActionPattern(attacker);

  onBeforeAction?.({ attacker, target, pattern });
  await runSharedActionPattern(scene, attacker, target, pattern, async () => {
    const basicAttack = getBasicAttackProfile(attacker as unknown as Parameters<typeof getBasicAttackProfile>[0]);
    const expectedVisualMode = getExpectedBasicAttackVisualMode(attacker as unknown as Parameters<typeof getExpectedBasicAttackVisualMode>[0]) as VisualMode;
    const getEffAtk = scene.getEffectiveAtk?.bind(scene) ?? (() => 0);
    const getEffMatk = scene.getEffectiveMatk?.bind(scene) ?? (() => 0);
    const baseStat = basicAttack.scaleStat === "matk" ? getEffMatk(attacker) : getEffAtk(attacker);
    const berserkBonusMultiplier = Math.max(0, Number(attacker?.statuses?.berserkNextBasicMultiplier ?? 0) || 0);
    const shouldUseBerserkMultiplier = (Number(attacker?.statuses?.berserkTurns ?? 0) || 0) > 0 && berserkBonusMultiplier > 0;
    const baseRaw = baseStat + randomBetween(BASIC_ATTACK_ROLL_MIN, BASIC_ATTACK_ROLL_MAX + 1);
    const raw = shouldUseBerserkMultiplier
      ? Math.max(1, Math.round(baseRaw * berserkBonusMultiplier))
      : baseRaw;
    const visualModule = getVisualModule?.((attacker.baseId as string) ?? "");
    const shouldUseCustomVisual = !!visualModule?.playBasicAttack && isBasicAttackVisualModeCompatible(attacker as unknown as Parameters<typeof isBasicAttackVisualModeCompatible>[0], visualModule as unknown as Parameters<typeof isBasicAttackVisualModeCompatible>[1]);

    let impactPromise: Promise<void> | void;
    if (shouldUseCustomVisual && visualModule?.playBasicAttack) {
      impactPromise = visualModule.playBasicAttack(scene, attacker, target);
    } else {
      impactPromise = playFallbackBasicAttackVisual(scene, attacker, target, expectedVisualMode, basicAttack.damageType as DamageType);
    }
    if (isPromiseLike(impactPromise)) await impactPromise;

    const damageApplied = scene.resolveDamage?.(attacker, target, raw, basicAttack.damageType as DamageType, "ĐÁNH THƯỜNG") ?? 0;
    if (shouldUseBerserkMultiplier && damageApplied > 0) {
      attacker.statuses = { ...(attacker.statuses ?? {}), berserkNextBasicMultiplier: 0 };
    }
    applyPostBasicAttackStatuses(scene, attacker, target, raw);
  });
  onAfterAction?.({ attacker, target, pattern });
}

export interface ExecuteSkillCastOptions {
  getSkillById: (skillId: string, unit: UnitLike) => CombatSkill | null | undefined;
  getVisualModule?: (baseId: string) => { playSkillAttack?: (...args: unknown[]) => unknown } | null;
  onMissingSkill?: (ctx: { attacker: UnitLike; target: UnitLike }) => Promise<void> | void;
  onBeforeSkillCast?: (ctx: SkillCastContext) => Promise<void> | void;
  onPatternImpact?: (ctx: SkillCastContext & { effectivePattern: ActionPattern }) => Promise<void> | void;
  onAfterSkillCast?: (ctx: SkillCastContext & { effectivePattern: ActionPattern }) => Promise<void> | void;
}

export interface SkillCastContext {
  attacker: UnitLike;
  target: UnitLike;
  skill: CombatSkill;
  actionTarget: UnitLike;
  visualUnits: UnitLike[];
  visualTargets: { x: number; y: number }[];
  visualModule: { playSkillAttack?: (...args: unknown[]) => unknown } | null;
}

export async function executeSharedSkillCast(scene: SceneLike, attacker: UnitLike, target: UnitLike, options: ExecuteSkillCastOptions): Promise<SkillCastContext | null> {
  const {
    getSkillById,
    getVisualModule,
    onMissingSkill,
    onBeforeSkillCast,
    onPatternImpact,
    onAfterSkillCast
  } = options;
  const skill = getSkillById((attacker.skillId as string) ?? "", attacker);
  if (!skill) {
    await onMissingSkill?.({ attacker, target });
    return null;
  }

  const getEffAtk = scene.getEffectiveAtk?.bind(scene) ?? (() => 0);
  const getEffDef = scene.getEffectiveDef?.bind(scene) ?? (() => 0);
  const getEffMdef = scene.getEffectiveMdef?.bind(scene) ?? (() => 0);
  const getEffMatk = scene.getEffectiveMatk?.bind(scene) ?? (() => 0);
  const enemyUnits = scene.getCombatUnits?.(attacker.side === "LEFT" ? "RIGHT" : "LEFT") ?? [];
  const allyUnits = scene.getCombatUnits?.(attacker.side ?? "LEFT") ?? [];
  const resolvedPrimaryTarget = resolveSkillPrimaryTarget({
    attacker: attacker as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["attacker"],
    target: target as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["target"],
    skill: skill as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["skill"],
    allies: allyUnits as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["allies"],
    enemies: enemyUnits as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["enemies"],
    getEffectiveAtk: getEffAtk as (u: unknown) => number,
    getEffectiveDef: getEffDef as (u: unknown) => number,
    getEffectiveMdef: getEffMdef as (u: unknown) => number,
    getEffectiveMatk: getEffMatk as (u: unknown) => number
  }) ?? target;
  const visualPlanResult = resolveSharedSkillVisualPlan({
    attacker: attacker as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["attacker"],
    target: resolvedPrimaryTarget as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["target"],
    skill: skill as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["skill"],
    allyUnits: allyUnits as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["allyUnits"],
    enemyUnits: enemyUnits as unknown as Parameters<typeof resolveSharedSkillVisualPlan>[0]["enemyUnits"],
    getEffectiveAtk: getEffAtk as (u: unknown) => number,
    getEffectiveDef: getEffDef as (u: unknown) => number,
    getEffectiveMdef: getEffMdef as (u: unknown) => number,
    getEffectiveMatk: getEffMatk as (u: unknown) => number
  });
  const { actionTarget, visualUnits } = visualPlanResult;
  const visualTargets = visualUnits
    .filter((unit) => (unit.sprite as { active?: boolean } | undefined)?.active)
    .map((unit) => ({ x: (unit.sprite as { x?: number } | undefined)?.x ?? 0, y: (unit.sprite as { y?: number } | undefined)?.y ?? 0 }));
  const visualModule = getVisualModule?.((attacker.baseId as string) ?? "") ?? null;
  const deferVisualUntilSkillEffect = skill.effect === "chromatic_dart_chain";
  const castContext: SkillCastContext = {
    attacker,
    target,
    skill,
    actionTarget,
    visualUnits,
    visualTargets,
    visualModule
  };

  await onBeforeSkillCast?.(castContext);
  let skillImpactPromise: Promise<unknown> | null = null;
  let deferredSkillImpact: (() => Promise<void> | void) | null = null;
  const isMeleeAssassin = isMeleeAssassinUnit(attacker as unknown as Parameters<typeof isMeleeAssassinUnit>[0]);
  const isAttackStyleCompatible = visualModule ? isSkillAttackStyleCompatible(attacker as unknown as Parameters<typeof isSkillAttackStyleCompatible>[0], visualModule as unknown as Parameters<typeof isSkillAttackStyleCompatible>[1]) : true;
  if (visualModule?.playSkillAttack && !deferVisualUntilSkillEffect && (!isMeleeAssassin || isAttackStyleCompatible)) {
    const fxLayer = scene.add?.container?.(0, 0);
    fxLayer?.setDepth?.(9200);
    skillImpactPromise = visualModule.playSkillAttack(scene, fxLayer, (attacker.sprite as { x?: number; y?: number } | undefined)?.x ?? 0, (attacker.sprite as { x?: number; y?: number } | undefined)?.y ?? 0, attacker, {
      skillName: skill.name,
      skillEffect: skill.effect,
      skillLabel: skill.effectLabel ?? skill.name ?? "",
      hideSkillTitle: true,
      tribe: attacker.tribe,
      classType: attacker.classType,
      targetX: (actionTarget.sprite as { x?: number } | undefined)?.x ?? (attacker.sprite as { x?: number } | undefined)?.x ?? 0,
      targetY: (actionTarget.sprite as { y?: number } | undefined)?.y ?? (attacker.sprite as { y?: number } | undefined)?.y ?? 0,
      star: attacker.star,
      targets: visualTargets
    }) as Promise<unknown> | null;
  } else if (isMeleeAssassin) {
    const skillStyle = resolveSkillAttackStyle(attacker as unknown as Parameters<typeof resolveSkillAttackStyle>[0], visualModule as unknown as Parameters<typeof resolveSkillAttackStyle>[1]);
    deferredSkillImpact = () => playFallbackMeleeAssassinSkillVisual(scene, attacker, actionTarget, skill, skillStyle ?? "");
  } else if (!deferVisualUntilSkillEffect) {
    scene.audioFx?.play?.("skill");
  }

  scene.setCombatBorder?.(attacker, "skill");
  const effectivePattern = skill.actionPattern || inferSharedActionPattern(attacker);
  await runSharedActionPattern(scene, attacker, actionTarget, effectivePattern, async () => {
    if (!skillImpactPromise && typeof deferredSkillImpact === "function") {
      skillImpactPromise = deferredSkillImpact() as Promise<unknown>;
    }
    if (isPromiseLike(skillImpactPromise)) await skillImpactPromise;
    await onPatternImpact?.({ ...castContext, effectivePattern });
    await scene.applySkillEffect?.(attacker, actionTarget, skill);
    if (deferVisualUntilSkillEffect && visualModule?.playSkillAttack) {
      const dartSequence = attacker.statuses?.chromaticDartLastCast ?? null;
      const fxLayer = scene.add?.container?.(0, 0);
      fxLayer?.setDepth?.(9200);
      skillImpactPromise = visualModule.playSkillAttack(scene, fxLayer, (attacker.sprite as { x?: number; y?: number } | undefined)?.x ?? 0, (attacker.sprite as { x?: number; y?: number } | undefined)?.y ?? 0, attacker, {
        skillName: skill.name,
        skillEffect: skill.effect,
        skillLabel: skill.effectLabel || skill.name,
        hideSkillTitle: true,
        tribe: attacker.tribe,
        classType: attacker.classType,
        targetX: (actionTarget.sprite as { x?: number } | undefined)?.x ?? (attacker.sprite as { x?: number } | undefined)?.x ?? 0,
        targetY: (actionTarget.sprite as { y?: number } | undefined)?.y ?? (attacker.sprite as { y?: number } | undefined)?.y ?? 0,
        star: attacker.star,
        targets: visualTargets,
        dartSequence
      }) as Promise<unknown> | null;
      if (isPromiseLike(skillImpactPromise)) await skillImpactPromise;
    }
  });
  if (effectivePattern === "RANGED_STATIC" || effectivePattern === "SELF") {
    await scene.wait?.(400);
  }
  scene.clearCombatBorder?.(attacker);
  await onAfterSkillCast?.({ ...castContext, effectivePattern });
  return castContext;
}

export interface RunSharedSkillEffectContext {
  attacker: UnitLike;
  target: UnitLike;
  skill: CombatSkill;
  rawSkill: number;
  skillOpts: SkillEffectOptions;
  enemies: UnitLike[];
  allies: UnitLike[];
  starChanceMult: number;
  areaBonus: number;
  targetBonus: number;
}

export interface RunSharedSkillEffectCoreOptions {
  allowCustomSkillLogic?: boolean;
  onUnhandledEffect?: (ctx: RunSharedSkillEffectContext) => Promise<void> | void;
  onSkillLogicError?: (error: unknown, ctx: RunSharedSkillEffectContext) => Promise<void> | void;
}

async function runSharedSkillEffectCore(scene: SceneLike, context: RunSharedSkillEffectContext, options: RunSharedSkillEffectCoreOptions): Promise<boolean> {
  const {
    attacker,
    target,
    skill,
    rawSkill,
    skillOpts,
    enemies,
    allies,
    starChanceMult,
    areaBonus,
    targetBonus
  } = context;
  const {
    allowCustomSkillLogic = false,
    onUnhandledEffect,
    onSkillLogicError
  } = options;

  const commonCtx = {
    attacker,
    target,
    rawSkill,
    skillOpts,
    enemies,
    allies,
    starChanceMult,
    areaBonus,
    targetBonus
  };
  if (await applySharedCommonSkillEffect(scene, { ...commonCtx, skill } as unknown as Parameters<typeof applySharedCommonSkillEffect>[1])) return true;
  if (applySharedOffensiveSkillEffect(scene, { ...commonCtx, skill } as unknown as Parameters<typeof applySharedOffensiveSkillEffect>[1])) return true;
  if (applySharedSupportSkillEffect(scene as unknown as Parameters<typeof applySharedSupportSkillEffect>[0], { ...commonCtx, skill } as unknown as Parameters<typeof applySharedSupportSkillEffect>[1])) return true;

  if (allowCustomSkillLogic && typeof skill.logic === "function") {
    try {
      await skill.logic({
        scene,
        attacker,
        target,
        rawSkill,
        skill,
        skillOpts,
        enemies,
        allies,
        starChanceMult,
        areaBonus,
        targetBonus
      });
    } catch (error) {
      await onSkillLogicError?.(error, context);
    }
    return true;
  }

  if (onUnhandledEffect) {
    await onUnhandledEffect(context);
    return true;
  }

  scene.resolveDamage?.(attacker, target, rawSkill, skill.damageType || "physical", skill.name ?? "", skillOpts);
  return true;
}

export interface ApplySharedSkillEffectRuntimeOptions {
  allowCustomSkillLogic?: boolean;
  onUnhandledEffect?: (ctx: RunSharedSkillEffectContext) => Promise<void> | void;
  onSkillLogicError?: (error: unknown, ctx: RunSharedSkillEffectContext) => Promise<void> | void;
  wrapErrors?: boolean;
  onRuntimeError?: (error: unknown, ctx: RunSharedSkillEffectContext) => Promise<void> | void;
}

export async function applySharedSkillEffectRuntime(scene: SceneLike, attacker: UnitLike, target: UnitLike, skill: CombatSkill, options: ApplySharedSkillEffectRuntimeOptions = {}): Promise<boolean> {
  const enemyUnits = scene.getCombatUnits?.(attacker.side === "LEFT" ? "RIGHT" : "LEFT") ?? [];
  const allyUnits = scene.getCombatUnits?.(attacker.side ?? "LEFT") ?? [];
  const trackedUnits = [attacker, ...allyUnits, ...enemyUnits].filter((u): u is UnitLike => Boolean(u));
  const statusSnapshot = snapshotTooltipStatusState(trackedUnits as unknown as Parameters<typeof snapshotTooltipStatusState>[0]);
  const resolvedTarget = resolveSkillPrimaryTarget({
    attacker: attacker as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["attacker"],
    target: target as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["target"],
    skill: skill as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["skill"],
    allies: allyUnits as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["allies"],
    enemies: enemyUnits as unknown as Parameters<typeof resolveSkillPrimaryTarget>[0]["enemies"],
    getEffectiveAtk: scene.getEffectiveAtk?.bind(scene),
    getEffectiveDef: scene.getEffectiveDef?.bind(scene),
    getEffectiveMdef: scene.getEffectiveMdef?.bind(scene),
    getEffectiveMatk: scene.getEffectiveMatk?.bind(scene)
  }) ?? target;
  const context: RunSharedSkillEffectContext = {
    attacker,
    target: resolvedTarget as UnitLike,
    skill,
    rawSkill: scene.calcSkillRaw?.(attacker, skill) ?? 0,
    skillOpts: { isSkill: true },
    enemies: enemyUnits,
    allies: allyUnits,
    starChanceMult: starEffectChanceMultiplier(attacker.star ?? 0),
    areaBonus: starAreaBonus(attacker.star ?? 0),
    targetBonus: starTargetBonus(attacker.star ?? 0)
  };

  if (!options.wrapErrors) {
    const result = await runSharedSkillEffectCore(scene, context, options);
    recordTooltipStatusChanges(trackedUnits as unknown as Parameters<typeof recordTooltipStatusChanges>[0], statusSnapshot, attacker as unknown as Parameters<typeof recordTooltipStatusChanges>[2], skill as unknown as Parameters<typeof recordTooltipStatusChanges>[3]);
    return result;
  }

  try {
    const result = await runSharedSkillEffectCore(scene, context, options);
    recordTooltipStatusChanges(trackedUnits as unknown as Parameters<typeof recordTooltipStatusChanges>[0], statusSnapshot, attacker as unknown as Parameters<typeof recordTooltipStatusChanges>[2], skill as unknown as Parameters<typeof recordTooltipStatusChanges>[3]);
    return result;
  } catch (error) {
    await options.onRuntimeError?.(error, context);
    return true;
  }
}