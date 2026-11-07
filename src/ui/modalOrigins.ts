import type { Faction, Role } from "../content/catalog";
import type { SettingsNavigationState } from "./settings";

export interface UnitInventoryNavigationState {
  modalScrollTop: number;
  focusIndex: number;
  focusLibrary: boolean;
  planningFocus?: HTMLElement | null;
}

export interface LibraryBrowseNavigationState {
  tab: "units" | "materials" | "equipment" | "recipes" | "augments" | "odds";
  query: string;
  role: Role | null;
  faction: Faction | null;
  tier: number | null;
  page: number;
  catalogTier: number;
  catalogPage: number;
  modalScrollTop: number;
  gridScrollTop: number;
  focusedCardId: string | null;
}

/** Navigation parents belong to transitions; ModalHost never stores a global history stack. */
export type ModalOrigin =
  | { kind: "settings-confirm"; state: SettingsNavigationState }
  | { kind: "library-browse"; state: LibraryBrowseNavigationState }
  | { kind: "owned-inventory"; uid: string; state: UnitInventoryNavigationState; route: "planning" }
  | { kind: "enemy-detail"; uid: string; route: "planning"; focus: HTMLElement | null; restorePreview(valid: boolean): void };
