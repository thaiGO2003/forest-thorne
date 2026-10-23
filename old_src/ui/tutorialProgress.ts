type TutorialState = {
  completed?: boolean;
  markers?: Record<string, unknown>;
  roundEventCounts?: Record<string, number>;
};

type PlayerLike = {
  board?: unknown[][];
  bench?: Array<{ equips?: string[] } | null | undefined>;
  itemBag?: string[];
  augments?: unknown[];
  round?: number;
  tutorialState?: TutorialState;
};

type SceneWithPlayer = {
  player?: PlayerLike;
  craftGridItems?: string[];
  settingsVisible?: boolean;
  historyModalVisible?: boolean;
};

type UnitLike = { equips?: string[] };

type Board = Array<Array<UnitLike | null | undefined>>;
type Bench = Array<UnitLike | null | undefined>;

function countBoardUnits(board: Board | unknown): number {
  if (!Array.isArray(board)) return 0;
  return board.reduce((total: number, row) => {
    if (!Array.isArray(row)) return total;
    return total + row.filter(Boolean).length;
  }, 0);
}

function countBenchUnits(bench: Bench | unknown): number {
  if (!Array.isArray(bench)) return 0;
  return bench.filter(Boolean).length;
}

function countItemInBag(itemBag: string[] | unknown, itemId: string | null | undefined): number {
  if (!Array.isArray(itemBag) || !itemId) return 0;
  return itemBag.filter((entry) => entry === itemId).length;
}

function boardHasEquip(board: Board | unknown, itemId: string | null | undefined): boolean {
  if (!Array.isArray(board) || !itemId) return false;
  return board.some((row) => Array.isArray(row) && row.some((unit) => unit?.equips?.includes?.(itemId)));
}

function benchHasEquip(bench: Bench | unknown, itemId: string | null | undefined): boolean {
  if (!Array.isArray(bench) || !itemId) return false;
  return bench.some((unit) => unit?.equips?.includes?.(itemId));
}

function getRoundEventCount(tutorialState: TutorialState | undefined, key: string | null | undefined): number {
  if (!key) return 0;
  return Number(tutorialState?.roundEventCounts?.[key] ?? 0);
}

function getTutorialMarker(tutorialState: TutorialState | undefined, key: string | null | undefined): unknown {
  if (!key) return null;
  return tutorialState?.markers?.[key] ?? null;
}

export function getTutorialDismissMarkerKey(stepId: string | null | undefined): string | null {
  if (!stepId) return null;
  return `dismissed:${stepId}`;
}

export interface TutorialProgressState {
  round: number;
  boardUnits: number;
  benchUnits: number;
  totalOwnedUnits: number;
  itemBag: string[];
  craftGridItems: string[];
  augmentCount: number;
  tutorialState: TutorialState;
  settingsVisible: boolean;
  historyModalVisible: boolean;
}

export function getTutorialProgressState(scene: SceneWithPlayer | null | undefined): TutorialProgressState {
  const player = scene?.player ?? {};
  const tutorialState = player?.tutorialState ?? {};
  const boardUnits = countBoardUnits(player.board);
  const benchUnits = countBenchUnits(player.bench);
  return {
    round: Number.isFinite(player.round) ? (player.round as number) : 1,
    boardUnits,
    benchUnits,
    totalOwnedUnits: boardUnits + benchUnits,
    itemBag: Array.isArray(player.itemBag) ? [...player.itemBag] : [],
    craftGridItems: Array.isArray(scene?.craftGridItems) ? [...(scene.craftGridItems as string[])] : [],
    augmentCount: Array.isArray(player.augments) ? player.augments.length : 0,
    tutorialState,
    settingsVisible: scene?.settingsVisible === true,
    historyModalVisible: scene?.historyModalVisible === true
  };
}

export type CompletionRule =
  | { kind: "boardUnitsAtLeast"; count?: number }
  | { kind: "benchUnitsAtLeast"; count?: number }
  | { kind: "totalOwnedUnitsAtLeast"; count?: number }
  | { kind: "eventAtLeast"; key: string; count?: number }
  | { kind: "itemInBag"; itemId: string; count?: number }
  | { kind: "unitHasEquip"; itemId: string }
  | { kind: "craftSlotMatches"; slotIndex: number; itemId: string }
  | { kind: "settingsVisible"; value?: boolean }
  | { kind: "historyVisible"; value?: boolean }
  | { kind: "tutorialCompleted" }
  | { kind: "markerEquals"; key: string; value: unknown }
  | { kind: "markerTruthy"; key: string }
  | ((progress: TutorialProgressState, scene: SceneWithPlayer | null | undefined) => boolean);

function evaluateCompletionRule(
  rule: CompletionRule | null | undefined,
  progress: TutorialProgressState,
  scene: SceneWithPlayer | null | undefined
): boolean {
  if (!rule) return false;
  if (typeof rule === "function") return rule(progress, scene) === true;

  switch (rule.kind) {
    case "boardUnitsAtLeast":
      return progress.boardUnits >= (rule.count ?? 0);
    case "benchUnitsAtLeast":
      return progress.benchUnits >= (rule.count ?? 0);
    case "totalOwnedUnitsAtLeast":
      return progress.totalOwnedUnits >= (rule.count ?? 0);
    case "eventAtLeast":
      return getRoundEventCount(progress.tutorialState, rule.key) >= (rule.count ?? 1);
    case "itemInBag":
      return countItemInBag(progress.itemBag, rule.itemId) >= (rule.count ?? 1);
    case "unitHasEquip":
      return boardHasEquip(scene?.player?.board, rule.itemId) || benchHasEquip(scene?.player?.bench, rule.itemId);
    case "craftSlotMatches":
      return progress.craftGridItems?.[rule.slotIndex] === rule.itemId;
    case "settingsVisible":
      return progress.settingsVisible === (rule.value !== false);
    case "historyVisible":
      return progress.historyModalVisible === (rule.value !== false);
    case "tutorialCompleted":
      return progress.tutorialState?.completed === true;
    case "markerEquals":
      return getTutorialMarker(progress.tutorialState, rule.key) === rule.value;
    case "markerTruthy":
      return Boolean(getTutorialMarker(progress.tutorialState, rule.key));
    default:
      return false;
  }
}

export interface TutorialStep {
  id: string;
  trigger?: string;
  completionRule?: CompletionRule | null;
}

export function isTutorialStepSatisfied(
  scene: SceneWithPlayer | null | undefined,
  step: TutorialStep | null | undefined
): boolean {
  const progress = getTutorialProgressState(scene);
  const dismissMarkerKey = getTutorialDismissMarkerKey(step?.id);
  if (step?.trigger === "dismiss" && dismissMarkerKey && getTutorialMarker(progress.tutorialState, dismissMarkerKey) === true) {
    return true;
  }
  if (evaluateCompletionRule(step?.completionRule, progress, scene)) return true;

  switch (step?.id) {
    case "buy_unit":
      return progress.totalOwnedUnits >= 1;
    case "deploy_first_unit":
      return progress.boardUnits >= 1;
    case "buy_more":
      return progress.totalOwnedUnits >= 2;
    case "deploy_second_unit":
      return progress.boardUnits >= 2;
    case "round2_buy_unit":
      return progress.totalOwnedUnits >= 3;
    case "round2_deploy_unit":
      return progress.boardUnits >= 3;
    case "round2_buy_unit_second":
      return progress.totalOwnedUnits >= 4;
    case "round2_deploy_unit_second":
      return progress.boardUnits >= 4;
    default:
      return false;
  }
}
