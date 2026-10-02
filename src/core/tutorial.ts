// Tutorial state machine and semantic action gates (A94, A108). No rendering/UI ownership lives here.
import { getUnit, type Role } from "../content/catalog";
import type { OwnedUnit, RunState } from "./run";
import { modeConfig } from "./modes";

export const TUTORIAL_END_ROUND = 8;

export type TutorialMarker = string | number | boolean;
export interface TutorialState {
  completed: boolean;
  currentRound: number;
  shopVariant: number;
  preparedRounds: number[];
  roundEventCounts: Record<string, number>;
  markers: Record<string, TutorialMarker>;
}

export type TutorialAction =
  | "*"
  | "dismiss"
  | "buy_unit"
  | "select_bench"
  | "start_unit_drag"
  | "move_unit"
  | "sell_unit"
  | "sell_selected_unit"
  | "roll_shop"
  | "toggle_history"
  | "open_settings"
  | "close_settings"
  | "toggle_settings"
  | "show_attack_preview"
  | "start_item_drag"
  | "equip_item"
  | "unequip_item"
  | "add_craft_item"
  | "craft_item"
  | "choose_augment"
  | "begin_combat"
  | "skip_tutorial"
  | `settings_${string}`
  | string;

export type TutorialTarget =
  | { kind: "screen"; key: string }
  | { kind: "shopFirstAvailable" }
  | { kind: "shopSlot"; slot: number }
  | { kind: "benchFirstOccupied" }
  | { kind: "benchAnyOccupied" }
  | { kind: "benchSlot"; slot: number }
  | { kind: "synergyPanel" }
  | { kind: "button"; key: string }
  | { kind: "setting"; key: string }
  | { kind: "stat"; key: string }
  | { kind: "boardCell"; cell: number }
  | { kind: "boardFirstOccupied" }
  | { kind: "boardAnyOccupied" }
  | { kind: "boardAnyEquipped" }
  | { kind: "boardAnyEmpty" }
  | { kind: "boardRecommendedDeploy" }
  | { kind: "boardSuggestedReposition" }
  | { kind: "inventoryFirstOccupied" }
  | { kind: "inventoryItem"; itemId: string }
  | { kind: "craftSlot"; slot: number }
  | { kind: "craftOutput" }
  | { kind: "sellAction" }
  | { kind: "unequipAction" }
  | { kind: "historyClose" }
  | { kind: "any" };

export type TutorialCompletionRule =
  | { kind: "boardUnitsAtLeast"; count: number }
  | { kind: "benchUnitsAtLeast"; count: number }
  | { kind: "totalOwnedUnitsAtLeast"; count: number }
  | { kind: "eventAtLeast"; key: string; count?: number }
  | { kind: "itemInBag"; itemId: string; count?: number }
  | { kind: "unitHasEquip"; itemId: string }
  | { kind: "craftSlotMatches"; slotIndex: number; itemId: string }
  | { kind: "settingsVisible"; value?: boolean }
  | { kind: "historyVisible"; value?: boolean }
  | { kind: "tutorialCompleted" }
  | { kind: "markerEquals"; key: string; value: TutorialMarker }
  | { kind: "markerTruthy"; key: string }
  | { kind: "custom"; predicate: (inspection: TutorialInspection) => boolean };

export interface TutorialStep {
  id: string;
  round: number;
  copyKey: string;
  target: TutorialTarget;
  trigger: "dismiss" | "action";
  delayMs: number;
  panelPlacement: "auto" | "center";
  layoutFocus: "target" | "allowedTargets" | "center";
  indicator: "auto" | "none";
  allowedActions: readonly TutorialAction[];
  allowedTargets: readonly TutorialTarget[];
  completion: TutorialCompletionRule;
  allowSettings: boolean;
  allowSkip: boolean;
  blockedHintKey: string;
}

export interface TutorialInspectionContext {
  craftGrid?: readonly (string | null)[];
  settingsVisible?: boolean;
  historyVisible?: boolean;
}

export interface TutorialInspection {
  boardUnits: number;
  benchUnits: number;
  totalOwnedUnits: number;
  itemBag: readonly string[];
  units: readonly OwnedUnit[];
  craftGrid: readonly (string | null)[];
  augmentCount: number;
  currentRound: number;
  completed: boolean;
  settingsVisible: boolean;
  historyVisible: boolean;
  markers: Readonly<Record<string, TutorialMarker>>;
  events: Readonly<Record<string, number>>;
}

export interface TutorialActionContext {
  shopSlot?: number;
  source?: { where: "bench" | "board" | "inventory"; index: number; itemId?: string };
  destination?: { where: "bench" | "board" | "craft"; index: number };
  unitUid?: string;
  itemId?: string;
  inspection?: TutorialInspectionContext;
}

const FIXED_SHOPS: Readonly<Record<number, Readonly<Record<number, readonly string[]>>>> = {
  1: { 0: ["ant_guard", "deer_song", "falcon_dive", "cat_goldbow", "ram_charge"] },
  2: {
    0: ["ram_charge", "fox_flame", "cat_goldbow", "deer_song", "ant_guard"],
    1: ["eagle_marksman", "owl_nightshot", "deer_song", "ant_guard", "ram_charge"],
  },
  3: { 0: ["deer_song", "ant_guard", "cat_goldbow", "fox_flame", "ram_charge"] },
  4: { 0: ["owl_nightshot", "deer_song", "ant_guard", "ram_charge", "fox_flame"] },
  5: { 0: ["ant_guard", "deer_song", "eagle_marksman", "fox_flame", "ram_charge"] },
  6: { 0: ["deer_song", "owl_nightshot", "ant_guard", "fox_flame", "ram_charge"] },
  7: { 0: ["eagle_marksman", "deer_song", "ant_guard", "fox_flame", "ram_charge"] },
  8: { 0: ["owl_nightshot", "deer_song", "ant_guard", "fox_flame", "ram_charge"] },
};

export const TUTORIAL_AUGMENT_IDS = ["gold_cache", "wild_command", "opening_fury"] as const;

const dismissRule = (id: string): TutorialCompletionRule => ({ kind: "markerTruthy", key: `dismissed:${id}` });
const target = (kind: TutorialTarget["kind"], extra: Record<string, unknown> = {}): TutorialTarget =>
  ({ kind, ...extra } as TutorialTarget);

function step(
  round: number,
  id: string,
  options: Partial<Omit<TutorialStep, "id" | "round" | "copyKey">> = {},
): TutorialStep {
  const trigger = options.trigger ?? "dismiss";
  return {
    id,
    round,
    copyKey: `tutorial.${id}`,
    target: options.target ?? target("screen", { key: "center" }),
    trigger,
    delayMs: options.delayMs ?? 180,
    panelPlacement: options.panelPlacement ?? (trigger === "dismiss" ? "center" : "auto"),
    layoutFocus: options.layoutFocus ?? (trigger === "dismiss" ? "center" : "target"),
    indicator: options.indicator ?? (trigger === "dismiss" ? "none" : "auto"),
    allowedActions: options.allowedActions ?? (trigger === "dismiss" ? ["dismiss"] : []),
    allowedTargets: options.allowedTargets ?? [],
    completion: options.completion ?? dismissRule(id),
    allowSettings: options.allowSettings ?? true,
    allowSkip: options.allowSkip ?? true,
    blockedHintKey: options.blockedHintKey ?? "tutorial.action_blocked",
  };
}

const actionStep = (
  round: number,
  id: string,
  primaryTarget: TutorialTarget,
  actions: readonly TutorialAction[],
  completion: TutorialCompletionRule,
  allowedTargets: readonly TutorialTarget[] = [],
  extra: Partial<Omit<TutorialStep, "id" | "round" | "copyKey" | "target" | "allowedActions" | "completion" | "allowedTargets">> = {},
): TutorialStep => step(round, id, {
  target: primaryTarget, trigger: "action", panelPlacement: "auto", layoutFocus: "target", indicator: "auto",
  allowedActions: actions, allowedTargets, completion, ...extra,
});

const infoStep = (round: number, id: string, t: TutorialTarget = target("screen", { key: "center" })): TutorialStep =>
  step(round, id, { target: t });

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  infoStep(1, "welcome"),
  actionStep(1, "buy_unit", target("shopFirstAvailable"), ["buy_unit"], { kind: "totalOwnedUnitsAtLeast", count: 1 }),
  actionStep(1, "deploy_first_unit", target("benchFirstOccupied"), ["select_bench", "start_unit_drag", "move_unit"],
    { kind: "boardUnitsAtLeast", count: 1 }, [target("benchFirstOccupied"), target("boardRecommendedDeploy")], { layoutFocus: "allowedTargets" }),
  infoStep(1, "explain_synergy", target("synergyPanel")),
  actionStep(1, "buy_more", target("shopFirstAvailable"), ["buy_unit"], { kind: "totalOwnedUnitsAtLeast", count: 2 }),
  actionStep(1, "deploy_second_unit", target("benchFirstOccupied"), ["select_bench", "start_unit_drag", "move_unit"],
    { kind: "boardUnitsAtLeast", count: 2 }, [target("benchFirstOccupied"), target("boardRecommendedDeploy")], { layoutFocus: "allowedTargets" }),
  actionStep(1, "start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(2, "round2_intro"),
  infoStep(2, "explain_gold", target("stat", { key: "gold" })),
  infoStep(2, "explain_xp", target("stat", { key: "xp" })),
  infoStep(2, "explain_deploy_cap", target("stat", { key: "deploy_cap" })),
  actionStep(2, "explain_roll", target("button", { key: "reroll" }), ["roll_shop"], { kind: "eventAtLeast", key: "roll_shop" }),
  actionStep(2, "round2_buy_unit", target("shopFirstAvailable"), ["buy_unit"], { kind: "totalOwnedUnitsAtLeast", count: 3 }),
  actionStep(2, "round2_deploy_unit", target("benchFirstOccupied"), ["select_bench", "start_unit_drag", "move_unit"],
    { kind: "boardUnitsAtLeast", count: 3 }, [target("benchFirstOccupied"), target("boardRecommendedDeploy")]),
  actionStep(2, "round2_buy_unit_second", target("shopFirstAvailable"), ["buy_unit"], { kind: "totalOwnedUnitsAtLeast", count: 4 }),
  actionStep(2, "round2_deploy_unit_second", target("benchFirstOccupied"), ["select_bench", "start_unit_drag", "move_unit"],
    { kind: "boardUnitsAtLeast", count: 4 }, [target("benchFirstOccupied"), target("boardRecommendedDeploy")]),
  actionStep(2, "round2_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(3, "round3_intro"),
  actionStep(3, "round3_move_unit", target("boardAnyOccupied"), ["start_unit_drag", "move_unit"],
    { kind: "eventAtLeast", key: "move_board_unit" }, [target("boardAnyOccupied"), target("boardAnyEmpty")]),
  actionStep(3, "round3_sell_unit", target("benchAnyOccupied"), ["start_unit_drag", "sell_unit", "sell_selected_unit"],
    { kind: "eventAtLeast", key: "sell_unit" }, [target("benchAnyOccupied"), target("sellAction")]),
  actionStep(3, "round3_open_history", target("button", { key: "history" }), ["toggle_history"], { kind: "eventAtLeast", key: "open_history" }),
  actionStep(3, "round3_close_history", target("historyClose"), ["toggle_history"], { kind: "eventAtLeast", key: "close_history" }),
  actionStep(3, "round3_open_settings", target("button", { key: "settings" }), ["open_settings", "toggle_settings"], { kind: "eventAtLeast", key: "open_settings" }),
  actionStep(3, "round3_close_settings", target("setting", { key: "close" }), ["close_settings", "toggle_settings"], { kind: "eventAtLeast", key: "close_settings" }),
  actionStep(3, "round3_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(4, "round4_intro"),
  actionStep(4, "round4_hover_preview", target("boardFirstOccupied"), ["show_attack_preview"],
    { kind: "eventAtLeast", key: "show_attack_preview" }, [target("boardAnyOccupied")]),
  actionStep(4, "round4_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(5, "round5_intro"),
  actionStep(5, "round5_equip_item", target("inventoryItem", { itemId: "eq_warmog_armor" }), ["start_item_drag", "equip_item"],
    { kind: "unitHasEquip", itemId: "eq_warmog_armor" }, [target("inventoryItem", { itemId: "eq_warmog_armor" }), target("boardAnyOccupied")]),
  actionStep(5, "round5_unequip_item", target("boardAnyEquipped"), ["start_unit_drag", "unequip_item"],
    { kind: "eventAtLeast", key: "unequip_item" }, [target("boardAnyEquipped"), target("unequipAction")]),
  actionStep(5, "round5_re_equip_item", target("inventoryItem", { itemId: "eq_warmog_armor" }), ["start_item_drag", "equip_item"],
    { kind: "eventAtLeast", key: "equip_item", count: 2 }, [target("inventoryItem", { itemId: "eq_warmog_armor" }), target("boardAnyOccupied")]),
  actionStep(5, "round5_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(6, "round6_intro"),
  actionStep(6, "round6_place_craft_item", target("inventoryItem", { itemId: "tear" }), ["start_item_drag", "add_craft_item"],
    { kind: "craftSlotMatches", slotIndex: 4, itemId: "tear" }, [target("inventoryItem", { itemId: "tear" }), target("craftSlot", { slot: 4 })]),
  actionStep(6, "round6_craft_item", target("craftOutput"), ["craft_item"], { kind: "itemInBag", itemId: "eq_blue_buff" }),
  actionStep(6, "round6_equip_crafted_item", target("inventoryItem", { itemId: "eq_blue_buff" }), ["start_item_drag", "equip_item"],
    { kind: "unitHasEquip", itemId: "eq_blue_buff" }, [target("inventoryItem", { itemId: "eq_blue_buff" }), target("boardAnyOccupied")]),
  actionStep(6, "round6_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  actionStep(7, "round7_choose_augment", target("screen", { key: "center" }), ["choose_augment"],
    { kind: "eventAtLeast", key: "choose_augment" }, [], { delayMs: 140, panelPlacement: "center", layoutFocus: "center", indicator: "none" }),
  infoStep(7, "round7_augment_summary"),
  actionStep(7, "round7_start_combat", target("button", { key: "start" }), ["begin_combat"], { kind: "eventAtLeast", key: "begin_combat" }),

  infoStep(8, "round8_intro"),
  actionStep(8, "round8_free_play", target("button", { key: "start" }), ["*"], { kind: "eventAtLeast", key: "begin_combat" }, [target("any")]),
];

const STEPS_BY_ROUND = new Map<number, readonly TutorialStep[]>(
  Array.from({ length: TUTORIAL_END_ROUND }, (_, i) => i + 1).map((round) => [round, TUTORIAL_STEPS.filter((s) => s.round === round)]),
);

export function createTutorialState(round = 1): TutorialState {
  return { completed: false, currentRound: round, shopVariant: 0, preparedRounds: [], roundEventCounts: {}, markers: {} };
}

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function normalizeTutorialState(value: unknown, round = 1): TutorialState {
  const raw = object(value);
  const prepared = Array.isArray(raw?.preparedRounds)
    ? [...new Set(raw.preparedRounds.flatMap((v) => Number.isInteger(Number(v)) && Number(v) > 0 ? [Number(v)] : []))]
    : [];
  const eventsRaw = object(raw?.roundEventCounts);
  const events: Record<string, number> = {};
  for (const [key, value] of Object.entries(eventsRaw ?? {})) {
    const count = Math.floor(Number(value));
    if (Number.isFinite(count) && count > 0) events[key] = count;
  }
  const markersRaw = object(raw?.markers);
  const markers: Record<string, TutorialMarker> = {};
  for (const [key, value] of Object.entries(markersRaw ?? {})) {
    if (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) markers[key] = value;
  }
  const currentRound = Math.max(1, Math.round(Number(raw?.currentRound) || round));
  return {
    completed: raw?.completed === true,
    currentRound,
    shopVariant: Math.max(0, Math.round(Number(raw?.shopVariant) || 0)),
    preparedRounds: prepared,
    roundEventCounts: events,
    markers,
  };
}

export function isTutorialActive(s: Pick<RunState, "aiMode" | "round" | "tutorialSkipped" | "tutorial">): boolean {
  return s.aiMode === "TUTORIAL" && s.tutorialSkipped !== true && !s.tutorial.completed && s.round >= 1 && s.round <= TUTORIAL_END_ROUND;
}

/** Round changes reset only round-local progress; persisted dismiss markers remain. */
export function syncTutorialRound(s: Pick<RunState, "round" | "tutorial">): void {
  if (s.tutorial.currentRound === s.round) return;
  s.tutorial.currentRound = s.round;
  s.tutorial.shopVariant = 0;
  s.tutorial.roundEventCounts = {};
}

export function tutorialShop(round: number, variant: number, slots = 5): (string | null)[] | null {
  const variants = FIXED_SHOPS[round];
  if (!variants) return null;
  const authored = variants[variant] ?? variants[0];
  if (!authored) return null;
  const out = authored.slice(0, Math.max(5, slots)) as (string | null)[];
  while (out.length < Math.max(5, slots)) out.push(null);
  return out.slice(0, Math.max(5, slots));
}

export function incrementTutorialShopVariant(s: Pick<RunState, "tutorial">): void {
  s.tutorial.shopVariant++;
}

export function inspectTutorial(s: Pick<RunState, "board" | "bench" | "itemBag" | "augments" | "round" | "tutorial">, context: TutorialInspectionContext = {}): TutorialInspection {
  const board = s.board.filter((unit): unit is OwnedUnit => !!unit);
  const units = [...s.bench, ...board];
  return {
    boardUnits: board.length,
    benchUnits: s.bench.length,
    totalOwnedUnits: board.length + s.bench.length,
    itemBag: s.itemBag,
    units,
    craftGrid: context.craftGrid ?? Array(9).fill(null),
    augmentCount: s.augments.length,
    currentRound: s.round,
    completed: s.tutorial.completed,
    settingsVisible: context.settingsVisible === true,
    historyVisible: context.historyVisible === true,
    markers: s.tutorial.markers,
    events: s.tutorial.roundEventCounts,
  };
}

export function tutorialRuleSatisfied(rule: TutorialCompletionRule, inspection: TutorialInspection): boolean {
  switch (rule.kind) {
    case "boardUnitsAtLeast": return inspection.boardUnits >= rule.count;
    case "benchUnitsAtLeast": return inspection.benchUnits >= rule.count;
    case "totalOwnedUnitsAtLeast": return inspection.totalOwnedUnits >= rule.count;
    case "eventAtLeast": return (inspection.events[rule.key] ?? 0) >= (rule.count ?? 1);
    case "itemInBag": return inspection.itemBag.filter((id) => id === rule.itemId).length >= (rule.count ?? 1);
    case "unitHasEquip": return inspection.units.some((unit) => unit.equips.includes(rule.itemId));
    case "craftSlotMatches": return (inspection.craftGrid[rule.slotIndex] ?? null) === rule.itemId;
    case "settingsVisible": return inspection.settingsVisible === (rule.value ?? true);
    case "historyVisible": return inspection.historyVisible === (rule.value ?? true);
    case "tutorialCompleted": return inspection.completed;
    case "markerEquals": return inspection.markers[rule.key] === rule.value;
    case "markerTruthy": return !!inspection.markers[rule.key];
    case "custom": return rule.predicate(inspection);
  }
}

const COMPAT_WORLD_STEPS = new Set([
  "buy_unit", "deploy_first_unit", "buy_more", "deploy_second_unit",
  "round2_buy_unit", "round2_deploy_unit", "round2_buy_unit_second", "round2_deploy_unit_second",
]);

export function currentTutorialStep(s: RunState, context: TutorialInspectionContext = {}): TutorialStep | null {
  if (!isTutorialActive(s)) return null;
  syncTutorialRound(s);
  const inspection = inspectTutorial(s, context);
  for (const candidate of STEPS_BY_ROUND.get(s.round) ?? []) {
    if (tutorialRuleSatisfied(candidate.completion, inspection)) continue;
    if (COMPAT_WORLD_STEPS.has(candidate.id) && tutorialRuleSatisfied(candidate.completion, inspection)) continue;
    return candidate;
  }
  return null;
}

export function recordTutorialEvent(s: RunState, key: string, marker?: readonly [string, TutorialMarker]): void {
  if (s.tutorialSkipped || s.tutorial.completed || s.aiMode !== "TUTORIAL") return;
  syncTutorialRound(s);
  s.tutorial.roundEventCounts[key] = (s.tutorial.roundEventCounts[key] ?? 0) + 1;
  if (marker) s.tutorial.markers[marker[0]] = marker[1];
}

export function dismissTutorialStep(s: RunState, stepId: string): boolean {
  const current = currentTutorialStep(s);
  if (!current || current.id !== stepId || current.trigger !== "dismiss") return false;
  s.tutorial.markers[`dismissed:${stepId}`] = true;
  return true;
}

export function skipTutorial(s: RunState): boolean {
  if (s.tutorialSkipped || s.tutorial.completed || s.aiMode !== "TUTORIAL") return false;
  recordTutorialEvent(s, "skip_tutorial");
  s.tutorialSkipped = true;
  const allowed = modeConfig(s.mode).ai.allowed;
  s.aiMode = allowed.includes("EASY") ? "EASY" : allowed.includes("CREATIVE") ? "CREATIVE" : modeConfig(s.mode).ai.def;
  return true;
}

const FRONT_ROLES = new Set<Role>(["TANKER", "FIGHTER"]);
const FRONTLINE = [[2, 4], [1, 4], [3, 4], [2, 3], [0, 4], [4, 4], [1, 3], [3, 3], [2, 2]] as const;
const BACKLINE = [[2, 1], [1, 1], [3, 1], [2, 0], [0, 1], [4, 1], [1, 0], [3, 0], [2, 2]] as const;

export function recommendedTutorialDeployCell(s: Pick<RunState, "board">, unit: OwnedUnit): number | null {
  const role = getUnit(unit.baseId).role;
  const ordering = FRONT_ROLES.has(role) ? FRONTLINE : BACKLINE;
  for (const [row, col] of ordering) {
    const cell = row * 5 + col;
    if (!s.board[cell]) return cell;
  }
  return s.board.findIndex((candidate) => !candidate);
}

function targetMatches(s: RunState, descriptor: TutorialTarget, context: TutorialActionContext): boolean {
  switch (descriptor.kind) {
    case "any": return true;
    case "shopFirstAvailable": return context.shopSlot === s.shop.findIndex(Boolean);
    case "shopSlot": return context.shopSlot === descriptor.slot;
    case "benchFirstOccupied": return context.source?.where === "bench" && context.source.index === 0 && !!s.bench[0];
    case "benchAnyOccupied": return context.source?.where === "bench" && !!s.bench[context.source.index];
    case "benchSlot": return context.source?.where === "bench" && context.source.index === descriptor.slot;
    case "boardCell": return context.destination?.where === "board" && context.destination.index === descriptor.cell;
    case "boardFirstOccupied": {
      const first = s.board.findIndex(Boolean);
      return context.source?.where === "board" && context.source.index === first && first >= 0;
    }
    case "boardAnyOccupied": {
      if (context.source?.where === "board" && !!s.board[context.source.index]) return true;
      return context.destination?.where === "board" && !!s.board[context.destination.index];
    }
    case "boardAnyEquipped": return context.source?.where === "board" && !!s.board[context.source.index]?.equips.length;
    case "boardAnyEmpty": return context.destination?.where === "board" && !s.board[context.destination.index];
    case "boardRecommendedDeploy": {
      if (context.source?.where !== "bench" || context.destination?.where !== "board") return false;
      const unit = s.bench[context.source.index];
      return !!unit && recommendedTutorialDeployCell(s, unit) === context.destination.index;
    }
    case "inventoryFirstOccupied": return context.source?.where === "inventory" && context.source.index === 0 && s.itemBag.length > 0;
    case "inventoryItem": return context.itemId === descriptor.itemId || context.source?.itemId === descriptor.itemId;
    case "craftSlot": return context.destination?.where === "craft" && context.destination.index === descriptor.slot;
    case "sellAction": return true;
    case "unequipAction": return true;
    case "boardSuggestedReposition": return context.destination?.where === "board" && !s.board[context.destination.index];
    case "screen":
    case "synergyPanel":
    case "button":
    case "setting":
    case "stat":
    case "craftOutput":
    case "historyClose":
      return true;
  }
}

export function tutorialActionAllowed(s: RunState, action: TutorialAction, context: TutorialActionContext = {}): boolean {
  const current = currentTutorialStep(s, context.inspection);
  if (!current) return true;
  if (action === "skip_tutorial") return current.allowSkip;
  if (current.allowSettings && (action.startsWith("settings_") || action === "open_settings" || action === "close_settings" || action === "toggle_settings")) return true;
  if (!current.allowedActions.includes("*") && !current.allowedActions.includes(action)) return false;
  const effectiveTargets = current.allowedTargets.length ? current.allowedTargets : [current.target];
  if (effectiveTargets.some((descriptor) => descriptor.kind === "any")) return true;
  if (["move_unit", "sell_unit", "sell_selected_unit", "equip_item", "unequip_item", "add_craft_item"].includes(action)) {
    return effectiveTargets.every((descriptor) => targetMatches(s, descriptor, context));
  }
  return effectiveTargets.some((descriptor) => targetMatches(s, descriptor, context));
}

export interface TutorialPreparationPlan {
  round: number;
  grantBenchBaseId?: string;
  grantItemId?: string;
  ensureMaterialId?: string;
  minCraftTableLevel?: number;
  clearCraftStaging: boolean;
  reopenAugmentRound?: number;
}

export function tutorialPreparationPlan(s: RunState): TutorialPreparationPlan | null {
  if (!isTutorialActive(s)) return null;
  syncTutorialRound(s);
  if (s.tutorial.preparedRounds.includes(s.round)) return null;
  const hasEquipmentAnywhere = (itemId: string) =>
    s.itemBag.includes(itemId) || [...s.bench, ...s.board.filter((u): u is OwnedUnit => !!u)].some((unit) => unit.equips.includes(itemId));
  const base: TutorialPreparationPlan = { round: s.round, clearCraftStaging: false };
  if (s.round === 3 && s.bench.length === 0) base.grantBenchBaseId = "falcon_dive";
  if (s.round === 5 && !hasEquipmentAnywhere("eq_warmog_armor")) base.grantItemId = "eq_warmog_armor";
  if (s.round === 6) {
    base.minCraftTableLevel = 1;
    if (!s.itemBag.includes("tear")) base.ensureMaterialId = "tear";
    base.clearCraftStaging = true;
  }
  if (s.round === 7) base.reopenAugmentRound = 7;
  return base;
}

export function markTutorialPrepared(s: RunState, plan: TutorialPreparationPlan): void {
  if (!s.tutorial.preparedRounds.includes(plan.round)) s.tutorial.preparedRounds.push(plan.round);
  if (plan.clearCraftStaging) s.tutorial.markers.clearCraftStaging = true;
}

/** Completion handoff happens after the final tutorial combat advances beyond round 8. */
export function finishTutorialIfPastEnd(s: RunState): boolean {
  if (s.aiMode !== "TUTORIAL" || s.tutorialSkipped || s.round <= TUTORIAL_END_ROUND) return false;
  s.tutorial.completed = true;
  const allowed = modeConfig(s.mode).ai.allowed;
  s.aiMode = allowed.includes("EASY") ? "EASY" : allowed.includes("CREATIVE") ? "CREATIVE" : modeConfig(s.mode).ai.def;
  return true;
}
