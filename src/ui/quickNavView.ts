// Quick Navigate board (#26). Asset-first: the panel and buttons are 9-sliced PNG chrome drawn by
// the UI kit; CSS only positions the host inside the modal body.
import { t } from "../core/i18n";
import { h, kitButton, panelEl } from "./kit";
import { QUICK_NAV_TARGETS, type QuickNavPanel } from "./quickNav";

export interface QuickNavView {
  el: HTMLElement;
  dispose(): void;
}

export function mountQuickNav(options: { open: (id: QuickNavPanel) => void }): QuickNavView {
  const root = h("div", "quick-nav");
  const panel = panelEl("panel_wood", "quick-nav-panel");
  // The modal title already names the board, so the panel only carries the hint.
  panel.append(h("p", "quick-nav-hint", t("quickNav.hint")));
  const buttons: Array<{ dispose(): void }> = [];
  const list = h("div", "quick-nav-list");
  for (const target of QUICK_NAV_TARGETS) {
    const name = t(target.key);
    const button = kitButton({
      skin: "wood",
      icon: target.icon,
      label: name,
      aria: t("quickNav.open", { name }),
      cls: "quick-nav-item",
      onClick: () => options.open(target.id),
    });
    button.el.dataset.quickNav = target.id;
    buttons.push(button);
    list.append(button.el);
  }
  panel.append(list);
  root.append(panel);
  return {
    el: root,
    dispose() { for (const button of buttons) button.dispose(); },
  };
}
