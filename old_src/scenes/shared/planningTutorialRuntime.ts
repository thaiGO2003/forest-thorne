import { UNIT_BY_ID } from "../../data/unitCatalog.js";
import { t } from "../../i18n/index.js";

import { findPlanningCreativeSandboxUnit } from "./planningCreativeSandboxRuntime.js";
import { getPlanningPointerWorldPosition } from "./planningInputRuntime.js";
import { addPlanningLog } from "./planningLogRuntime.js";
import { createPlanningOwnedUnit, persistPlanningProgress } from "./planningRunStateRuntime.js";
import { createDefaultTutorialState } from "../../core/runState.js";
import { TutorialOverlay } from "../../ui/TutorialOverlay.js";
import { isPointInTutorialGate, matchesTutorialTarget, resolveTutorialGate } from "../../ui/tutorialTargetResolver.js";

export const TUTORIAL_END_ROUND = 8;
export const TUTORIAL_AUGMENT_CHOICES: string[] = ["gold_cache", "wild_command", "opening_fury"];
const TUTORIAL_SHOP_TABLE: Record<number, Record<number, string[]>> = {
  1: { 0: ["ant_guard", "deer_song", "falcon_dive", "cat_goldbow", "ram_charge"] },
  2: {
    0: ["ram_charge", "fox_flame", "cat_goldbow", "deer_song", "ant_guard"],
    1: ["eagle_marksman", "owl_nightshot", "deer_song", "ant_guard", "ram_charge"]
  },
  3: { 0: ["deer_song", "ant_guard", "cat_goldbow", "fox_flame", "ram_charge"] },
  4: { 0: ["owl_nightshot", "deer_song", "ant_guard", "ram_charge", "fox_flame"] },
  5: { 0: ["ant_guard", "deer_song", "eagle_marksman", "fox_flame", "ram_charge"] },
  6: { 0: ["deer_song", "owl_nightshot", "ant_guard", "fox_flame", "ram_charge"] },
  7: { 0: ["eagle_marksman", "deer_song", "ant_guard", "fox_flame", "ram_charge"] },
  8: { 0: ["owl_nightshot", "deer_song", "ant_guard", "fox_flame", "ram_charge"] }
};

interface TutorialStateEx {
  completed: boolean;
  currentRound: number;
  shopVariant: number;
  preparedRounds: number[];
  roundEventCounts: Record<string, unknown>;
  markers: Record<string, unknown>;
  [key: string]: unknown;
}

interface OwnedUnitEx {
  uid: string;
  baseId: string;
  star: number;
  base: { id: string; [key: string]: unknown };
  equips: string[];
  variantTraits: string[];
  variantSeeds: number[];
  [key: string]: unknown;
}

interface PlanningTutorialPlayer {
  round: number;
  bench: Array<OwnedUnitEx | null | undefined | 0 | false>;
  itemBag: string[];
  craftTableLevel: number;
  augmentRoundsTaken: number[];
  tutorialState?: TutorialStateEx | null;
  tutorialSkipped?: boolean;
  [key: string]: unknown;
}

interface PlanningTutorialScene {
  aiMode: string;
  player: PlanningTutorialPlayer;
  craftGridItems?: (string | null)[];
  settingsVisible?: boolean;
  time?: { delayedCall: (delay: number, callback: () => void) => Phaser.Time.TimerEvent };
  [key: string]: unknown;
}

interface CompletionRule {
  kind?: string;
  key?: string;
  count?: number;
  [key: string]: unknown;
}

interface TutorialStepView {
  completionRule?: CompletionRule | null;
  blockedHint?: string;
  allowSkip?: boolean;
  allowSettings?: boolean;
  allowedActions?: string[] | null;
  allowedTargets?: Array<{ role?: string; [key: string]: unknown }> | null;
  trigger?: string;
  target?: unknown;
  layoutFocus?: string;
  [key: string]: unknown;
}

interface TutorialOverlayLike {
  start: () => void;
  destroy: () => void;
  getCurrentStep?: () => TutorialStepView | null;
  getCurrentGate?: () => unknown;
  showBlockedHint?: (message: string) => void;
  handleTrigger?: (trigger: string) => boolean;
}

interface PlanningTutorialSceneEx extends PlanningTutorialScene {
  tutorialOverlay?: TutorialOverlayLike | null;
}

export function getPlanningTutorialState(scene: PlanningTutorialSceneEx): TutorialStateEx {
    if (!scene.player) return createDefaultTutorialState() as unknown as TutorialStateEx;
    if (!scene.player.tutorialState || typeof scene.player.tutorialState !== "object") {
      scene.player.tutorialState = createDefaultTutorialState() as unknown as TutorialStateEx;
    }
    return scene.player.tutorialState;
}

export function getPlanningTutorialMarker(scene: PlanningTutorialSceneEx, key: string): unknown {
    return getPlanningTutorialState(scene)?.markers?.[key] ?? null;
}

export function setPlanningTutorialMarker(scene: PlanningTutorialSceneEx, key: string, value: unknown): void {
    if (!key) return;
    const tutorialState = getPlanningTutorialState(scene);
    tutorialState.markers[key] = value;
}

export function recordPlanningTutorialEvent(scene: PlanningTutorialSceneEx, key: string, amount: number = 1): void {
    if (!key) return;
    const tutorialState = getPlanningTutorialState(scene);
    const round = Number.isInteger(scene.player?.round) ? scene.player.round : 1;
    if (tutorialState.currentRound !== round) {
      tutorialState.currentRound = round;
      tutorialState.roundEventCounts = {};
      tutorialState.shopVariant = 0;
    }
    const previousCount = (tutorialState.roundEventCounts[key] as number | undefined) ?? 0;
    const nextCount = previousCount + amount;
    tutorialState.roundEventCounts[key] = nextCount;
    const completionRule = scene.tutorialOverlay?.getCurrentStep?.()?.completionRule ?? null;
    const completedCurrentEventStep = completionRule?.kind === "eventAtLeast"
      && completionRule?.key === key
      && nextCount >= (completionRule?.count ?? 1);
    if (nextCount > previousCount && (nextCount === 1 || completedCurrentEventStep)) {
      persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    }
}

export function isPlanningTutorialRound(scene: PlanningTutorialSceneEx, round: number = scene.player?.round ?? 1): boolean {
    return scene.aiMode === "TUTORIAL"
      && scene.player?.tutorialSkipped !== true
      && Number.isInteger(round)
      && round >= 1
      && round <= TUTORIAL_END_ROUND;
}

export function isPlanningTutorialCampaignActive(scene: PlanningTutorialSceneEx): boolean {
    return isPlanningTutorialRound(scene)
      && getPlanningTutorialState(scene).completed !== true;
}

export function finalizePlanningTutorialCampaignIfNeeded(scene: PlanningTutorialSceneEx): void {
    if (scene.aiMode !== "TUTORIAL") return;
    const tutorialState = getPlanningTutorialState(scene);
    if (tutorialState.completed === true || (scene.player?.round ?? 1) > TUTORIAL_END_ROUND) {
      tutorialState.completed = true;
      scene.aiMode = "EASY";
    }
}

interface SellContext {
  region?: string;
  row?: number;
  col?: number;
  index?: number;
  unit?: OwnedUnitEx | null;
  uid?: string | null;
  targetType?: string;
  [key: string]: unknown;
}

interface UnitSourceResult {
  region: string;
  row?: number;
  col?: number;
  index?: number;
  unit?: OwnedUnitEx;
  uid?: string | null;
  [key: string]: unknown;
}

export function ensurePlanningTutorialRoundSetup(scene: PlanningTutorialSceneEx): void {
    if (!isPlanningTutorialCampaignActive(scene)) return;
    const tutorialState = getPlanningTutorialState(scene);
    const round = scene.player?.round ?? 1;
    if (tutorialState.currentRound !== round) {
      tutorialState.currentRound = round;
      tutorialState.roundEventCounts = {};
      tutorialState.shopVariant = 0;
    }
    if (tutorialState.preparedRounds.includes(round)) return;

    if (round === 3 && scene.player.bench.filter(Boolean).length === 0) {
      const bonusUnit = createPlanningOwnedUnit(scene as unknown as Parameters<typeof createPlanningOwnedUnit>[0], "falcon_dive", 1) as OwnedUnitEx | null;
      if (bonusUnit) {
        scene.player.bench.push(bonusUnit);
        addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tutorial.benchReward"));
      }
    }

    if (round === 5 && !scene.player.itemBag.includes("eq_warmog_armor")) {
      scene.player.itemBag.push("eq_warmog_armor");
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tutorial.armorReward"));
    }

    if (round === 6) {
      scene.player.craftTableLevel = Math.max(1, scene.player.craftTableLevel ?? 0);
      if (!scene.player.itemBag.includes("tear")) {
        scene.player.itemBag.push("tear");
      }
      if (scene.craftGridItems?.some(Boolean)) {
        scene.craftGridItems = Array.from({ length: 9 }, () => null);
      }
      addPlanningLog(scene as unknown as Parameters<typeof addPlanningLog>[0], t("planning.tutorial.dewReward"));
    }

    if (round === 7 && Array.isArray(scene.player.augmentRoundsTaken)) {
      scene.player.augmentRoundsTaken = scene.player.augmentRoundsTaken.filter((takenRound: number) => takenRound !== 7);
    }

    tutorialState.preparedRounds.push(round);
}

interface ShopOfferLike {
  slot: number;
  baseId: string;
}

export function getPlanningTutorialShopOffers(scene: PlanningTutorialSceneEx, forceRoll: boolean = false): ShopOfferLike[] | null {
    if (!isPlanningTutorialCampaignActive(scene)) return null;
    const tutorialState = getPlanningTutorialState(scene);
    const round = scene.player?.round ?? 1;
    const variants = TUTORIAL_SHOP_TABLE[round];
    if (!variants) return null;
    if (forceRoll) {
      tutorialState.shopVariant = Math.max(0, tutorialState.shopVariant + 1);
    }
    const offerIds = variants[tutorialState.shopVariant] ?? variants[0] ?? null;
    if (!Array.isArray(offerIds)) return null;
    return offerIds.map((baseId, index) => (UNIT_BY_ID[baseId] ? { slot: index, baseId } : null)).filter((offer): offer is ShopOfferLike => offer !== null);
}

export function resolvePlanningTutorialGate(scene: PlanningTutorialSceneEx, step: TutorialStepView | null | undefined): unknown {
    return resolveTutorialGate(scene as unknown as Parameters<typeof resolveTutorialGate>[0], step as unknown as Parameters<typeof resolveTutorialGate>[1]);
}

export function buildPlanningTutorialSellContext(scene: PlanningTutorialSceneEx, source: SellContext | null = null, extra: SellContext = {}): SellContext {
    const normalizedSource = source && typeof source === "object" ? source : null;
    const unit = extra?.unit ?? normalizedSource?.unit ?? null;
    return {
      ...extra,
      uid: (extra?.uid as string | null | undefined) ?? unit?.uid ?? normalizedSource?.uid ?? null,
      unit,
      from: normalizedSource,
      to: { region: "SELL", targetType: "SELL" },
      targetType: "SELL"
    };
}

export function resolvePlanningTutorialUnitSource(scene: PlanningTutorialSceneEx, unit: OwnedUnitEx | null | undefined, fallback: UnitSourceResult | null = null): UnitSourceResult | null {
    const normalizedFallback: UnitSourceResult | null = fallback && typeof fallback === "object"
      ? { ...fallback }
      : null;
    const normalizedUnit: OwnedUnitEx | null = normalizedFallback?.unit ?? unit ?? null;
    if (!normalizedUnit) return normalizedFallback;

    if (normalizedFallback && normalizedFallback.unit == null) {
      normalizedFallback.unit = normalizedUnit;
    }

    if (normalizedFallback?.region === "BOARD"
      && Number.isInteger(normalizedFallback.row)
      && Number.isInteger(normalizedFallback.col)) {
      return normalizedFallback;
    }

    const board = Array.isArray(scene.player?.board) ? scene.player.board : [];
    for (let row = 0; row < board.length; row += 1) {
      const currentRow = Array.isArray(board[row]) ? board[row] : [];
      for (let col = 0; col < currentRow.length; col += 1) {
        const boardUnit = currentRow[col] as OwnedUnitEx | null;
        if (!boardUnit) continue;
        if (boardUnit === normalizedUnit || (normalizedUnit.uid && boardUnit.uid === normalizedUnit.uid)) {
          return { region: "BOARD", row, col, unit: boardUnit };
        }
      }
    }

    const bench = Array.isArray(scene.player?.bench) ? scene.player.bench : [];
    for (let index = 0; index < bench.length; index += 1) {
      const benchUnit = bench[index] as OwnedUnitEx | null;
      if (!benchUnit) continue;
      if (benchUnit === normalizedUnit || (normalizedUnit.uid && benchUnit.uid === normalizedUnit.uid)) {
        return { region: "BENCH", index, unit: benchUnit };
      }
    }

    if (normalizedUnit.uid) {
      const sandboxUnit = findPlanningCreativeSandboxUnit(scene as unknown as Parameters<typeof findPlanningCreativeSandboxUnit>[0], normalizedUnit.uid);
      if (sandboxUnit) {
        return {
          region: "SANDBOX_BOARD",
          row: sandboxUnit.row,
          col: sandboxUnit.col,
          unit: sandboxUnit as unknown as OwnedUnitEx
        };
      }
    }

    return normalizedFallback ?? { region: "UNKNOWN", unit: normalizedUnit };
}

export function buildPlanningTutorialUnequipContext(scene: PlanningTutorialSceneEx, unit: OwnedUnitEx | null | undefined, source: UnitSourceResult | null = null, extra: SellContext = {}): SellContext {
    const resolvedSource = resolvePlanningTutorialUnitSource(scene, unit, source);
    const resolvedUnit = extra?.unit ?? resolvedSource?.unit ?? unit ?? null;
    return {
      ...extra,
      uid: (extra?.uid as string | null | undefined) ?? resolvedUnit?.uid ?? resolvedSource?.uid ?? null,
      unit: resolvedUnit,
      from: resolvedSource,
      to: { region: "UNEQUIP", targetType: "UNEQUIP" },
      targetType: "UNEQUIP"
    };
}

export function showPlanningTutorialBlockedHint(scene: PlanningTutorialSceneEx, message: string | null = null): void {
    const fallback = scene.tutorialOverlay?.getCurrentStep?.()?.blockedHint
      ?? t("planning.tutorial.blockedHint");
    scene.tutorialOverlay?.showBlockedHint?.(message ?? fallback);
}

interface ActionContext {
  item?: { itemId: string; index: number };
  itemId?: string;
  index?: number;
  buttonKey?: string;
  targetType?: string;
  [key: string]: unknown;
}

interface ActionOptions {
  roles?: string[];
  blockedHint?: string;
  [key: string]: unknown;
}

const SETTINGS_ACTIONS: Record<string, true> = {
  open_settings: true,
  close_settings: true,
  toggle_settings: true,
  settings_toggle_audio: true,
  settings_change_volume: true,
  settings_change_language: true,
  settings_toggle_tooltip: true,
  settings_change_resolution: true,
  skip_tutorial: true
};

export function isPlanningTutorialActionAllowed(scene: PlanningTutorialSceneEx, action: string, context: ActionContext = {}, options: ActionOptions = {}): boolean {
    if (!isPlanningTutorialCampaignActive(scene)) return true;
    const step = scene.tutorialOverlay?.getCurrentStep?.();
    if (!step) return true;

    if (action in SETTINGS_ACTIONS) {
      if (action === "skip_tutorial") return step.allowSkip !== false;
      return step.allowSettings !== false;
    }

    if (scene.settingsVisible && String(action).startsWith("settings_")) {
      return true;
    }

    const allowedActions = Array.isArray(step.allowedActions) ? step.allowedActions : [];
    if (!allowedActions.includes("*") && !allowedActions.includes(action)) {
      return false;
    }

    const allowedTargets = Array.isArray(step.allowedTargets) ? step.allowedTargets : [];
    if (!allowedTargets.length) return true;

    const roles = Array.isArray(options.roles) ? options.roles : null;
    const scopedTargets = roles
      ? allowedTargets.filter((target) => !target?.role || roles.includes(target.role))
      : allowedTargets;
    if (!scopedTargets.length) return true;

    const roleTargets = scopedTargets.filter((target) => Boolean(target?.role));
    if (roleTargets.length) {
      return roleTargets.every((target) => matchesTutorialTarget(scene as unknown as Parameters<typeof matchesTutorialTarget>[0], target, context as unknown as Parameters<typeof matchesTutorialTarget>[2]));
    }
    return scopedTargets.some((target) => matchesTutorialTarget(scene as unknown as Parameters<typeof matchesTutorialTarget>[0], target, context as unknown as Parameters<typeof matchesTutorialTarget>[2]));
}

export function guardPlanningTutorialAction(scene: PlanningTutorialSceneEx, action: string, context: ActionContext = {}, options: ActionOptions = {}): boolean {
    const allowed = isPlanningTutorialActionAllowed(scene, action, context, options);
    if (!allowed) {
      showPlanningTutorialBlockedHint(scene, options?.blockedHint ?? null);
    }
    return allowed;
}

export function isPlanningTutorialPointerAllowed(scene: PlanningTutorialSceneEx, pointer: { x: number; y: number }): boolean {
    if (!isPlanningTutorialCampaignActive(scene)) return true;
    const step = scene.tutorialOverlay?.getCurrentStep?.();
    if (!step || step.trigger === "dismiss") return false;
    const gate = scene.tutorialOverlay?.getCurrentGate?.() ?? resolvePlanningTutorialGate(scene, step);
    const world = getPlanningPointerWorldPosition(scene as unknown as Parameters<typeof getPlanningPointerWorldPosition>[0], pointer as unknown as Parameters<typeof getPlanningPointerWorldPosition>[1]);
    return isPointInTutorialGate(gate as Parameters<typeof isPointInTutorialGate>[0], world?.x, world?.y);
}

export function refreshPlanningTutorialOverlay(scene: PlanningTutorialSceneEx): void {
    const shouldShow = isPlanningTutorialCampaignActive(scene);
    if (!shouldShow) {
      destroyPlanningTutorialOverlay(scene);
      return;
    }

    destroyPlanningTutorialOverlay(scene);
    scene.tutorialOverlay = new TutorialOverlay(scene as unknown as Phaser.Scene) as unknown as TutorialOverlayLike;
    scene.tutorialOverlay.start();
}

export function skipPlanningTutorialOverlay(scene: PlanningTutorialSceneEx): void {
    if (scene.player) scene.player.tutorialSkipped = true;
    recordPlanningTutorialEvent(scene, "skip_tutorial");
    persistPlanningProgress(scene as unknown as Parameters<typeof persistPlanningProgress>[0]);
    destroyPlanningTutorialOverlay(scene);
}

export function destroyPlanningTutorialOverlay(scene: PlanningTutorialSceneEx): void {
    if (!scene.tutorialOverlay) return;
    scene.tutorialOverlay.destroy();
    scene.tutorialOverlay = null;
}

