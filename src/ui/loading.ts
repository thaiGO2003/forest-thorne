// Loading scene (§4.1, A55.1, A97). Progress is driven one-way by the real loader.
import { h, kitButton, label, nineSlice, SLICE, surface, threeSlice } from "./kit";

export interface LoadingView {
  el: HTMLElement;
  /** Normalized 0..1 from the real loader. */
  setProgress(p: number, detail?: string): void;
  setCopy(c: { title?: string; hint?: string }): void;
  /** Shows retry/continue-anyway actions; the loader owns what they do. */
  fail(message: string, actions: { retry: () => void; retryLabel: string }): void;
  dispose(): void;
}

export function createLoading(host: HTMLElement, o: { title: string; hint: string }): LoadingView {
  const root = h("div", "loading");
  root.dataset.screen = "loading";
  const titleEl = h("div", "loading-title");
  const barEl = h("div", "loading-bar");
  barEl.setAttribute("role", "progressbar");
  barEl.setAttribute("aria-valuemin", "0");
  barEl.setAttribute("aria-valuemax", "100");
  const actions = h("div", "loading-actions");
  root.append(titleEl, barEl, actions);
  host.append(root);

  let title = o.title, hint = o.hint, progress = 0, detail = "", failed: string | null = null;

  const titleS = surface(titleEl, (g, w, hh) => {
    nineSlice(g, "ribbon", SLICE.ribbon, 0, hh * 0.12, w, hh * 0.62, 2.5);
    label(g, title, w / 2, hh * 0.4, { size: Math.min(40, w / 14), maxW: w - 90, weight: 800 });
    label(g, failed ?? hint, w / 2, hh * 0.9, { size: 14, maxW: w - 20 });
  });
  const barS = surface(barEl, (g, w, hh) => {
    const by = 4, bh = hh - 20;
    nineSlice(g, "bar_trough", 1, 6, by + 4, w - 12, bh - 8);
    // Dynamic fill (gameplay-style live amount) inside the authored frame.
    const fw = Math.round((w - 12) * progress);
    if (fw > 0) {
      g.fillStyle = failed ? "#b23a2e" : "#6fd14f";
      g.fillRect(6, by + 4, fw, bh - 8);
      g.fillStyle = failed ? "#d86a5a" : "#a8ef7c";
      g.fillRect(6, by + 4, fw, 3);
    }
    threeSlice(g, "frame_bar", 3, 0, by, w, bh);
    label(g, detail, w / 2, hh - 7, { size: 12, maxW: w });
  });

  return {
    el: root,
    setProgress(p, d) {
      progress = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
      if (d !== undefined) detail = d;
      barEl.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      barS.paint();
    },
    setCopy(c) { if (c.title) title = c.title; if (c.hint) hint = c.hint; titleS.paint(); },
    fail(message, a) {
      failed = message;
      titleS.paint(); barS.paint();
      actions.replaceChildren(kitButton({ skin: "green", label: a.retryLabel, onClick: () => { failed = null; actions.replaceChildren(); titleS.paint(); a.retry(); } }).el);
    },
    dispose() { root.remove(); },
  };
}
