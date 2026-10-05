import { disposeTree, ownCleanup } from "./lifecycle";
// Shared tooltip surface (§26, A23, A96). One element for the whole app; viewport-safe placement
// that prefers above the anchor and never covers it. Content is structured, not raw HTML.
import { h, nineSlice, SLICE, surface } from "./kit";

export interface TooltipContent {
  title: string;
  subtitle?: string;
  lines?: { icon?: string; text: string; tone?: "good" | "bad" | "muted" }[];
  body?: string;
}

export type TooltipMode = "off" | "compact" | "summary" | "expanded";

export interface Tooltip {
  show(anchor: DOMRect | HTMLElement, c: TooltipContent): void;
  hide(): void;
  dispose(): void;
  /** Wire hover/focus/long-press on `el`; `get` is called lazily so content is always current. */
  bind(el: HTMLElement, get: () => TooltipContent | null): () => void;
  setMode(m: TooltipMode): void;
}

const GAP = 10;
const LONG_PRESS_MS = 420;

export function createTooltip(layer: HTMLElement): Tooltip {
  const el = h("div", "tooltip");
  el.setAttribute("role", "tooltip");
  el.dataset.open = "false";
  surface(el, (g, w, hh) => nineSlice(g, "panel_tooltip", SLICE.panel_tooltip, 0, 0, w, hh));
  const inner = h("div", "tooltip-inner");
  el.append(inner);
  layer.append(el);
  let mode: TooltipMode = "summary";

  const render = (c: TooltipContent) => {
    inner.replaceChildren();
    inner.append(h("div", "tt-title", c.title));
    if (c.subtitle) inner.append(h("div", "tt-sub", c.subtitle));
    if (mode !== "compact") for (const l of c.lines ?? []) {
      const row = h("div", `tt-line ${l.tone ? `tt-${l.tone}` : ""}`.trim());
      if (l.icon) { const i = h("span", "tt-icon", l.icon); i.setAttribute("aria-hidden", "true"); row.append(i); }
      row.append(h("span", "", l.text));
      inner.append(row);
    }
    if (c.body && mode === "expanded") inner.append(h("div", "tt-body", c.body));
  };

  const place = (r: DOMRect) => {
    const vw = innerWidth, vh = innerHeight, tw = el.offsetWidth, th = el.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - GAP;
    if (y < 8) y = r.bottom + GAP; // flip below
    if (y + th > vh - 8) { y = Math.max(8, r.top + r.height / 2 - th / 2); x = r.right + GAP; if (x + tw > vw - 8) x = r.left - tw - GAP; }
    el.style.left = `${Math.round(Math.max(8, Math.min(vw - tw - 8, x)))}px`;
    el.style.top = `${Math.round(Math.max(8, Math.min(vh - th - 8, y)))}px`;
  };

  const api: Tooltip = {
    show(anchor, c) {
      if (mode === "off") return;
      render(c);
      el.dataset.open = "true";
      place(anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor);
    },
    hide() { el.dataset.open = "false"; },
    dispose() { api.hide(); disposeTree(el); el.remove(); },
    bind(target, get) {
      let timer = 0;
      const open = () => { if (!target.isConnected) return; const c = get(); if (c) api.show(target, c); };
      const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") open(); };
      const down = (e: PointerEvent) => { if (e.pointerType !== "mouse") timer = window.setTimeout(open, LONG_PRESS_MS); };
      const cancel = () => { clearTimeout(timer); api.hide(); };
      target.addEventListener("pointerenter", enter);
      target.addEventListener("pointerdown", down);
      target.addEventListener("pointerleave", cancel);
      target.addEventListener("pointercancel", cancel);
      target.addEventListener("focus", open);
      target.addEventListener("blur", cancel);
      return ownCleanup(target, () => {
        clearTimeout(timer);
        target.removeEventListener("pointerenter", enter);
        target.removeEventListener("pointerdown", down);
        target.removeEventListener("pointerleave", cancel);
        target.removeEventListener("pointercancel", cancel);
        target.removeEventListener("focus", open);
        target.removeEventListener("blur", cancel);
      });
    },
    setMode(m) { mode = m; if (m === "off") api.hide(); },
  };
  return api;
}
