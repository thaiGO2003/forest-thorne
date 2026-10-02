// Stateful Planning selection + unit inspection semantics (spec A85).
// Pure/core only: presentation owns menus, scrolling, tooltips and feedback rendering.
import { getUnit, type Element, type Faction, type Role } from "../content/catalog";
import { materializeCombatFormation } from "./combat";
import { slotCapForUnit, sumEquipmentBonuses } from "./equipment";
import { recommendEquipment, type RecommendationRecipe } from "./recommendations";
import {
  benchCap, boardToBench, playerCombatBonus, sell, type OwnedUnit, type RunState,
} from "./run";
import { skillSpec, type SkillSpec } from "./skills";
import { sumVariantBonuses } from "./variants";

export type OwnedPlanningSelection =
  | { source: "BENCH"; uid: string; baseId: string; star: 1 | 2 | 3; index: number }
  | { source: "BOARD"; uid: string; baseId: string; star: 1 | 2 | 3; row: number; col: number };

export type PlanningSelection = OwnedPlanningSelection
  | { source: "SHOP"; baseId: string; star: 1 | 2 | 3; index: number };

export type ResolvedPlanningSelection =
  | { selection: Extract<PlanningSelection, { source: "BENCH" }>; unit: OwnedUnit; index: number }
  | { selection: Extract<PlanningSelection, { source: "BOARD" }>; unit: OwnedUnit; index: number }
  | { selection: Extract<PlanningSelection, { source: "SHOP" }>; unit: null; index: number };

export interface LiveUnitResources {
  hp?: number;
  maxHp?: number;
  rage?: number;
  rageMax?: number;
  shield?: number;
}

export interface PlanningInspectionOptions {
  /** Optional battle-local resources keyed by owned uid. RunState intentionally does not persist these. */
  liveResources?: Readonly<Record<string, LiveUnitResources | undefined>>;
  /** Co-op board rows may belong to another player profile. Local run is the default owner. */
  ownerForBoardRow?: (row: number) => RunState | undefined;
  /** Authored recipe metadata, when available, for A85 tier-3/tier-4 recommendations. */
  recommendationRecipes?: readonly RecommendationRecipe[];
}

export interface PlanningUnitInspection {
  source: PlanningSelection["source"];
  uid: string | null;
  baseId: string;
  star: 1 | 2 | 3;
  tier: number;
  buyPrice: number;
  species: string;
  role: Role;
  faction: Faction;
  element: Element;
  stats: {
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    matk: number;
    mdef: number;
    range: number;
    crit: number;
    evade: number;
  };
  resources: {
    rage: number;
    rageMax: number;
    shield: number;
    ownerStartingRage: number;
    ownerStartingShield: number;
    unitStartingRage: number;
    unitStartingShield: number;
  };
  skill: {
    nameVi: string;
    family: string;
    rageCost: number;
    detailVi: string;
    spec: SkillSpec;
  };
  recommendations: {
    tier3: RecommendationRecipe[];
    tier4: RecommendationRecipe[];
  };
}

export type PlanningContextAction = "DETAILS" | "RECALL" | "SELL";
export type PlanningContextFeedback = "bench_full" | "action_unavailable" | "mutation_rejected";

export interface PlanningContextResult {
  ok: boolean;
  mutated: boolean;
  selection: PlanningSelection | null;
  feedback?: PlanningContextFeedback;
}

const clampStar = (star: number): 1 | 2 | 3 =>
  Math.max(1, Math.min(3, Math.round(Number.isFinite(star) ? star : 1))) as 1 | 2 | 3;

const finite = (value: number | undefined, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const roundedNonNegative = (value: number | undefined): number => Math.max(0, Math.round(finite(value)));

const boardIndex = (row: number, col: number): number => row * 5 + col;

const boardCoordinates = (index: number): { row: number; col: number } => ({
  row: Math.floor(index / 5), col: index % 5,
});

export function selectBenchUnit(s: RunState, index: number): PlanningSelection | null {
  const unit = s.bench[index];
  return unit ? { source: "BENCH", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), index } : null;
}

export function selectBoardUnit(s: RunState, row: number, col: number): PlanningSelection | null {
  if (row < 0 || row >= 5 || col < 0 || col >= 5) return null;
  const unit = s.board[boardIndex(row, col)];
  return unit ? { source: "BOARD", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), row, col } : null;
}

export function selectShopOffer(s: RunState, index: number): PlanningSelection | null {
  const baseId = s.shop[index];
  return baseId ? { source: "SHOP", baseId, star: 1, index } : null;
}

function ownedByUid(s: RunState, uid: string): ResolvedPlanningSelection | null {
  const benchIndex = s.bench.findIndex((unit) => unit.uid === uid);
  if (benchIndex >= 0) {
    const unit = s.bench[benchIndex]!;
    return {
      selection: { source: "BENCH", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), index: benchIndex },
      unit, index: benchIndex,
    };
  }
  const cell = s.board.findIndex((unit) => unit?.uid === uid);
  if (cell >= 0) {
    const unit = s.board[cell]!;
    const { row, col } = boardCoordinates(cell);
    return {
      selection: { source: "BOARD", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), row, col },
      unit, index: cell,
    };
  }
  return null;
}

function resolveExplicitSelection(s: RunState, selection: PlanningSelection): ResolvedPlanningSelection | null {
  if (selection.source === "SHOP") {
    const baseId = s.shop[selection.index];
    if (!baseId) return null;
    return {
      selection: { source: "SHOP", baseId, star: 1, index: selection.index },
      unit: null, index: selection.index,
    };
  }

  const byUid = ownedByUid(s, selection.uid);
  if (byUid) return byUid;

  if (selection.source === "BENCH") {
    const unit = s.bench[selection.index];
    if (!unit || unit.baseId !== selection.baseId) return null;
    return {
      selection: { source: "BENCH", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), index: selection.index },
      unit, index: selection.index,
    };
  }

  if (selection.row < 0 || selection.row >= 5 || selection.col < 0 || selection.col >= 5) return null;
  const cell = boardIndex(selection.row, selection.col);
  const unit = s.board[cell];
  if (!unit || unit.baseId !== selection.baseId) return null;
  return {
    selection: {
      source: "BOARD", uid: unit.uid, baseId: unit.baseId, star: clampStar(unit.star), row: selection.row, col: selection.col,
    },
    unit, index: cell,
  };
}

/**
 * Resolves a stateful selection after moves/rerolls. With no explicit selection the fallback order is exact A85 order.
 */
export function resolvePlanningSelection(
  s: RunState, selection: PlanningSelection | null = null, selectedBenchIndex: number | null = null,
): ResolvedPlanningSelection | null {
  if (selection) return resolveExplicitSelection(s, selection);

  if (selectedBenchIndex != null) {
    const selected = selectBenchUnit(s, selectedBenchIndex);
    if (selected) return resolveExplicitSelection(s, selected);
  }
  if (s.bench.length) return resolveExplicitSelection(s, selectBenchUnit(s, 0)!);
  const boardCell = s.board.findIndex(Boolean);
  if (boardCell >= 0) {
    const { row, col } = boardCoordinates(boardCell);
    return resolveExplicitSelection(s, selectBoardUnit(s, row, col)!);
  }
  const shopIndex = s.shop.findIndex(Boolean);
  return shopIndex >= 0 ? resolveExplicitSelection(s, selectShopOffer(s, shopIndex)!) : null;
}

function ownerForSelection(
  s: RunState, resolved: ResolvedPlanningSelection, options: PlanningInspectionOptions,
): RunState {
  if (resolved.selection.source !== "BOARD") return s;
  return options.ownerForBoardRow?.(resolved.selection.row) ?? s;
}

export function inspectPlanningSelection(
  s: RunState, resolved: ResolvedPlanningSelection, options: PlanningInspectionOptions = {},
): PlanningUnitInspection {
  const selection = resolved.selection;
  const unit = getUnit(selection.baseId);
  const star = clampStar(selection.star);
  const owned = resolved.unit;
  const row = selection.source === "BOARD" ? selection.row : 0;
  const col = selection.source === "BOARD" ? selection.col : 0;
  const fighter = materializeCombatFormation([{
    uid: owned?.uid ?? `preview:${selection.source}:${resolved.index}`,
    baseId: unit.id,
    star,
    row,
    col,
    equips: owned?.equips ?? [],
    traits: owned?.traits ?? [],
  }], [])[0]!;

  const live = owned ? options.liveResources?.[owned.uid] : undefined;
  const explicitMaxHp = live && Number.isFinite(live.maxHp) ? Math.max(0, Math.round(live.maxHp!)) : null;
  const maxHp = explicitMaxHp ?? fighter.maxHp;
  const hp = live && Number.isFinite(live.hp) ? Math.min(maxHp, Math.max(0, Math.round(live.hp!))) : maxHp;

  const authoredCost = unit.skill.rageCost[star - 1];
  const explicitRageMax = live && Number.isFinite(live.rageMax) ? Math.max(0, Math.round(live.rageMax!)) : null;
  const rageMax = explicitRageMax ?? Math.max(0, Math.round(finite(authoredCost, unit.stats.rageMax)));

  const owner = ownerForSelection(s, resolved, options);
  const ownerBonus = playerCombatBonus(owner);
  const equipment = sumEquipmentBonuses(owned?.equips ?? [], star, slotCapForUnit(unit, star));
  const traits = sumVariantBonuses(unit.role, owned?.traits ?? []);
  const ownerStartingRage = roundedNonNegative(ownerBonus.startRage);
  const ownerStartingShield = roundedNonNegative(ownerBonus.startShield);
  const unitStartingRage = Math.min(4, roundedNonNegative(finite(equipment.startingRage) + finite(traits.startingRage)));
  const unitStartingShield = roundedNonNegative(finite(equipment.startingShield) + finite(traits.startingShield));
  const currentRage = roundedNonNegative(live?.rage);
  const currentShield = roundedNonNegative(live?.shield);
  const rage = Math.min(rageMax, Math.max(currentRage, ownerStartingRage + unitStartingRage));
  const shield = Math.max(currentShield, ownerStartingShield + unitStartingShield);

  const parsedSkill = skillSpec(unit.id, star);
  const recipes = options.recommendationRecipes ?? [];
  const recommendationUnit = { role: unit.role, skillDamageType: parsedSkill.damage?.type ?? unit.basic.damageType };
  const detailVi = unit.skill.starDetailVi[star - 1] ?? unit.skill.detailVi ?? "";

  return {
    source: selection.source,
    uid: owned?.uid ?? null,
    baseId: unit.id,
    star,
    tier: unit.tier,
    buyPrice: unit.tier,
    species: unit.species,
    role: unit.role,
    faction: unit.faction,
    element: unit.element,
    stats: {
      hp,
      maxHp,
      atk: fighter.atk,
      def: fighter.def,
      matk: fighter.matk,
      mdef: fighter.mdef,
      range: fighter.range,
      crit: fighter.crit,
      evade: fighter.evade,
    },
    resources: {
      rage,
      rageMax,
      shield,
      ownerStartingRage,
      ownerStartingShield,
      unitStartingRage,
      unitStartingShield,
    },
    skill: {
      nameVi: unit.skill.nameVi,
      family: unit.skill.family,
      rageCost: Math.max(0, Math.round(finite(authoredCost, unit.stats.rageMax))),
      detailVi,
      spec: parsedSkill,
    },
    recommendations: {
      tier3: recommendEquipment(recommendationUnit, recipes, 3, 3),
      tier4: recommendEquipment(recommendationUnit, recipes, 4, 3),
    },
  };
}

export function contextActionsFor(source: PlanningSelection["source"]): PlanningContextAction[] {
  if (source === "BENCH") return ["DETAILS", "SELL"];
  if (source === "BOARD") return ["DETAILS", "RECALL", "SELL"];
  return ["DETAILS"];
}

export function executePlanningContextAction(
  s: RunState, resolved: ResolvedPlanningSelection, action: PlanningContextAction,
): PlanningContextResult {
  if (!contextActionsFor(resolved.selection.source).includes(action)) {
    return { ok: false, mutated: false, selection: resolved.selection, feedback: "action_unavailable" };
  }
  if (action === "DETAILS") return { ok: true, mutated: false, selection: resolved.selection };

  if (action === "SELL") {
    if (resolved.selection.source === "SHOP") {
      return { ok: false, mutated: false, selection: resolved.selection, feedback: "action_unavailable" };
    }
    const where = resolved.selection.source === "BENCH" ? "bench" : "board";
    if (!sell(s, where, resolved.index)) {
      return { ok: false, mutated: false, selection: resolved.selection, feedback: "mutation_rejected" };
    }
    return { ok: true, mutated: true, selection: null };
  }

  if (resolved.selection.source !== "BOARD") {
    return { ok: false, mutated: false, selection: resolved.selection, feedback: "action_unavailable" };
  }
  if (s.bench.length >= benchCap(s)) {
    return { ok: false, mutated: false, selection: resolved.selection, feedback: "bench_full" };
  }
  const prior = resolved.selection;
  if (!boardToBench(s, resolved.index, s.bench.length, false)) {
    return { ok: false, mutated: false, selection: prior, feedback: "mutation_rejected" };
  }
  const next = resolvePlanningSelection(s, prior);
  return { ok: true, mutated: true, selection: next?.selection ?? null };
}
