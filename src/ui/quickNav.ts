// Quick Navigate (#26): the old three-tab workshop bar (Kho đồ / Chế tạo / Thư viện công thức) is
// gone, so one control opens this board and each surface keeps its own dedicated modal.
// Targets stay data-only so the panel, the HUD action and the tests share one source.
import { ICONS } from "../core/emojiIcon";
import type { MsgKey } from "../core/i18n";

export type QuickNavPanel = "inventory" | "craft" | "recipes";

export interface QuickNavTarget {
  id: QuickNavPanel;
  icon: string;
  key: MsgKey;
}

export const QUICK_NAV_TARGETS: readonly QuickNavTarget[] = [
  { id: "inventory", icon: ICONS.inventory, key: "planning.inventory" },
  { id: "craft", icon: ICONS.craft, key: "planning.craft" },
  { id: "recipes", icon: ICONS.recipe, key: "planning.recipes" },
];

export const isQuickNavPanel = (id: string): id is QuickNavPanel =>
  QUICK_NAV_TARGETS.some((target) => target.id === id);
