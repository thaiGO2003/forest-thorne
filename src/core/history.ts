// Structured Planning/Combat history retention (spec A38, A106, A123). Pure state only.
export const RECENT_LOG_CAP = 6;
export const PLANNING_HISTORY_CAP = 300;
export const COMBAT_HISTORY_CAP = 240;

export const HISTORY_CATEGORIES = ["COMBAT", "SHOP", "CRAFT", "EVENT"] as const;
export type HistoryCategory = (typeof HISTORY_CATEGORIES)[number];
export type HistoryFilter = "ALL" | HistoryCategory;

export interface HistoryEntry {
  message: string;
  category: HistoryCategory;
  timestamp: number;
  round?: number;
  title?: string;
  details?: string[];
}

export interface PlanningHistoryState {
  recent: string[];
  entries: HistoryEntry[];
}

export const createPlanningHistory = (): PlanningHistoryState => ({ recent: [], entries: [] });

const trimTail = <T>(items: readonly T[], cap: number): T[] => items.slice(Math.max(0, items.length - cap));

export function pushPlanningHistory(state: PlanningHistoryState, entry: HistoryEntry): void {
  state.entries = trimTail([...state.entries, { ...entry, details: entry.details ? [...entry.details] : undefined }], PLANNING_HISTORY_CAP);
  state.recent = trimTail([...state.recent, entry.message], RECENT_LOG_CAP);
}

export function filterPlanningHistory(state: PlanningHistoryState, filter: HistoryFilter): HistoryEntry[] {
  return filter === "ALL" ? [...state.entries] : state.entries.filter((entry) => entry.category === filter);
}

export interface CombatHistoryState { entries: string[] }
export const createCombatHistory = (): CombatHistoryState => ({ entries: [] });
export function pushCombatHistory(state: CombatHistoryState, message: string): void {
  state.entries = trimTail([...state.entries, message], COMBAT_HISTORY_CAP);
}
