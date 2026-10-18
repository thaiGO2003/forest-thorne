// History modal (§14.18, A38, A123): category-filtered Planning history, newest first. Read-only
// view over PlanningHistoryState; filtering uses the canonical filterPlanningHistory.
import { filterPlanningHistory, HISTORY_CATEGORIES, type HistoryFilter, type PlanningHistoryState } from "../core/history";
import { t, type MsgKey } from "../core/i18n";
import { ICONS } from "../core/emojiIcon";
import { h, kitButton, panelEl, type KitButton } from "./kit";
import type { ModalHandle } from "./modal";

const FILTERS: HistoryFilter[] = ["ALL", ...HISTORY_CATEGORIES];
const ICON: Record<HistoryFilter, string> = { ALL: ICONS.info, COMBAT: ICONS.start, SHOP: ICONS.shop, CRAFT: ICONS.craft, EVENT: ICONS.event };

export function mountHistoryView(host: HTMLElement, history: PlanningHistoryState): { dispose(): void } {
  let filter: HistoryFilter = "ALL";
  const root = h("div", "stack history");
  const tabs = h("div", "tabs");
  const btns: [HistoryFilter, KitButton][] = FILTERS.map((f) => {
    const b = kitButton({ skin: "wood", icon: ICON[f], label: t(`history.${f}` as MsgKey), onClick: () => { filter = f; render(); } });
    tabs.append(b.el);
    return [f, b];
  });
  const list = h("div", "history-list");
  list.setAttribute("role", "list");
  root.append(tabs, list);
  host.append(root);

  function render() {
    for (const [f, b] of btns) b.setSelected(f === filter);
    list.replaceChildren();
    const entries = filterPlanningHistory(history, filter).slice().reverse();
    if (!entries.length) { list.append(h("div", "lib-empty", t("history.empty"))); return; }
    for (const e of entries) {
      const row = panelEl("panel_tooltip", "history-row");
      row.setAttribute("role", "listitem");
      const head = h("div", "history-head");
      const when = new Date(e.timestamp);
      const time = h("time", "history-time", when.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }));
      time.dateTime = when.toISOString();
      head.append(h("span", "history-icon", ICON[e.category]), h("span", "history-msg", e.title ?? e.message));
      if (e.round !== undefined) head.append(h("span", "history-round", t("combat.round", { round: e.round })));
      head.append(time);
      row.append(head);
      if (e.title && e.message !== e.title) row.append(h("p", "lib-p", e.message));
      for (const d of e.details ?? []) row.append(h("p", "lib-p", `• ${d}`));
      list.append(row);
    }
  }
  render();
  return { dispose() { for (const [, button] of btns) button.dispose(); root.remove(); } };
}

export function mountHistory(modal: ModalHandle, history: PlanningHistoryState): { dispose(): void } {
  return mountHistoryView(modal.body, history);
}
