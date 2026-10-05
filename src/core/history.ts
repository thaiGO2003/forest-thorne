// Structured Planning/Combat history retention (spec A38, A106, A107.1, A123). Pure state only.
export const RECENT_LOG_CAP = 6;
export const PLANNING_HISTORY_CAP = 300;
export const COMBAT_HISTORY_CAP = 240;

export const HISTORY_CATEGORIES = ["COMBAT", "SHOP", "CRAFT", "EVENT"] as const;
export type HistoryCategory = (typeof HISTORY_CATEGORIES)[number];
export const HISTORY_FILTERS = ["ALL", ...HISTORY_CATEGORIES] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export type HistoryDetailValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly HistoryDetailValue[];

export interface HistoryEntry {
  id?: string;
  round?: number;
  phase?: string;
  category: HistoryCategory;
  title?: string;
  summary?: string;
  details?: string[];
  icon?: string;
  tone?: string;
  meta?: Readonly<Record<string, unknown>>;
  message: string;
  previewText?: string;
  timestamp: number;
}

export interface HistoryEntryInput extends Omit<HistoryEntry, "category" | "details"> {
  category?: unknown;
  details?: HistoryDetailValue;
}

export interface PlanningHistoryState {
  recent: string[];
  entries: HistoryEntry[];
}

export const createPlanningHistory = (): PlanningHistoryState => ({ recent: [], entries: [] });

const trimTail = <T>(items: T[], cap: number): void => {
  const extra = items.length - cap;
  if (extra > 0) items.splice(0, extra);
};

function foldHistoryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsVocabulary(text: string, vocabulary: readonly string[]): boolean {
  if (!text) return false;
  const padded = ` ${text} `;
  return vocabulary.some((term) => padded.includes(` ${term} `));
}

const HISTORY_VOCABULARY: Readonly<Record<Exclude<HistoryCategory, "EVENT">, readonly string[]>> = {
  COMBAT: [
    "combat", "battle", "attack", "damage", "crit", "miss", "skill", "heal", "shield", "death",
    "chien dau", "tan cong", "sat thuong", "chi mang", "ky nang", "hoi mau", "khien", "ha guc",
    "win", "draw", "lose", "thang", "thua", "hoa",
  ],
  SHOP: ["shop", "buy", "sell", "reroll", "refresh", "lock", "cua hang", "mua", "ban"],
  CRAFT: ["craft", "recipe", "material", "ghep", "che tao", "cong thuc", "nguyen lieu"],
};

export function normalizeHistoryDetails(value: HistoryDetailValue): string[] | undefined {
  const out: string[] = [];
  const visit = (item: HistoryDetailValue): void => {
    if (Array.isArray(item)) {
      for (const nested of item) visit(nested);
      return;
    }
    if (item == null) return;
    const line = String(item).trim();
    if (line) out.push(line);
  };
  visit(value);
  return out.length ? out : undefined;
}

export function inferHistoryCategory(entry: Pick<HistoryEntryInput, "message" | "title" | "summary" | "previewText" | "details">): HistoryCategory {
  const details = normalizeHistoryDetails(entry.details)?.join(" ") ?? "";
  const text = foldHistoryText([entry.message, entry.title, entry.summary, entry.previewText, details].filter(Boolean).join(" "));
  if (containsVocabulary(text, HISTORY_VOCABULARY.CRAFT)) return "CRAFT";
  if (containsVocabulary(text, HISTORY_VOCABULARY.SHOP)) return "SHOP";
  if (containsVocabulary(text, HISTORY_VOCABULARY.COMBAT)) return "COMBAT";
  return "EVENT";
}

export function normalizeHistoryCategory(category: unknown, fallbackEntry?: Pick<HistoryEntryInput, "message" | "title" | "summary" | "previewText" | "details">): HistoryCategory {
  if (category == null) return fallbackEntry ? inferHistoryCategory(fallbackEntry) : "EVENT";
  if (typeof category !== "string") return "EVENT";
  const normalized = category.trim().toUpperCase();
  return (HISTORY_CATEGORIES as readonly string[]).includes(normalized) ? normalized as HistoryCategory : "EVENT";
}

export function normalizeHistoryEntry(entry: HistoryEntryInput): HistoryEntry {
  const { category, details: rawDetails, ...rest } = entry;
  const normalized: HistoryEntry = {
    ...rest,
    category: normalizeHistoryCategory(category, entry),
    message: entry.message.trim(),
    timestamp: entry.timestamp,
  };
  const details = normalizeHistoryDetails(rawDetails);
  if (details) normalized.details = details;
  return normalized;
}

export function pushPlanningHistory(state: PlanningHistoryState, input: HistoryEntryInput): void {
  const entry = normalizeHistoryEntry(input);
  state.entries.push(entry);
  trimTail(state.entries, PLANNING_HISTORY_CAP);
  state.recent.push(entry.previewText?.trim() || entry.message);
  trimTail(state.recent, RECENT_LOG_CAP);
}

export function filterPlanningHistory(state: PlanningHistoryState, filter: HistoryFilter): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (let i = state.entries.length - 1; i >= 0; i--) {
    const entry = state.entries[i]!;
    if (filter === "ALL" || entry.category === filter) out.push(entry);
  }
  return out;
}

export interface CombatHistoryState { entries: string[] }
export const createCombatHistory = (): CombatHistoryState => ({ entries: [] });
export function pushCombatHistory(state: CombatHistoryState, message: string): void {
  state.entries.push(message);
  trimTail(state.entries, COMBAT_HISTORY_CAP);
}
