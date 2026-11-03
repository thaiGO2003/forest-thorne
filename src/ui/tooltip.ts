// Shared tooltip surface (§26, A23, A96). One element for the whole app; viewport-safe placement
// that prefers above the anchor and never covers it. Content is structured, not raw HTML.
// Rich content mirrors old_src's TooltipController: avatar + header meta + badge/status chips +
// HP/rage meters, then a mode-specific body (compact lines, summary blocks, expanded columns).
import { h, disposeSurfaceTree, nineSlice, SLICE, surface, threeSlice } from "./kit";
import { decorateDescription, inferRichTone } from "./richText";

export type TooltipTone = "gold" | "star" | "tier" | "class" | "tribe" | "rage" | "status" | "stat" | "default";

export interface TooltipChip {
  text: string;
  icon?: string;
  tone?: TooltipTone;
  /** Identity metadata hidden in compact mode (the subtitle already carries it). */
  secondary?: boolean;
}

export interface TooltipMeter {
  key: string;
  label: string;
  icon?: string;
  kind?: "bar" | "pips";
  value: number;
  max: number;
  shield?: number;
}

export interface TooltipSection {
  title?: string;
  lines: string[];
}

export interface TooltipLine {
  icon?: string;
  text: string;
  tone?: "good" | "bad" | "muted";
}

export interface TooltipContent {
  title: string;
  subtitle?: string;
  /** Emoji fallback shown in the avatar well when no portrait snapshot is ready. */
  icon?: string;
  /** Live portrait snapshot from the shared portrait renderer. */
  portrait?: CanvasImageSource | null;
  /** Short flavor/description line under the header. */
  description?: string;
  /** Condensed stat rows used by compact mode (and as a fallback for the other modes). */
  lines?: TooltipLine[];
  /** Free-form paragraph appended to the expanded surface. */
  body?: string;
  badges?: TooltipChip[];
  statuses?: TooltipChip[];
  meters?: TooltipMeter[];
  /** Curated blocks for summary mode. */
  sections?: TooltipSection[];
  /** Full multi-column blocks for expanded mode. */
  columns?: TooltipSection[][];
}

export type TooltipMode = "off" | "compact" | "summary" | "expanded";

export interface Tooltip {
  show(anchor: DOMRect | HTMLElement, c: TooltipContent): void;
  hide(): void;
  /** Wire hover/focus/long-press on `el`; `get` is called lazily so content is always current. */
  bind(el: HTMLElement, get: () => TooltipContent | null): () => void;
  setMode(m: TooltipMode): void;
}

const GAP = 10;
const LONG_PRESS_MS = 420;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Bar colour by meter kind, matching the billboard/HP conventions. */
function meterFill(m: TooltipMeter): string {
  const ratio = m.max > 0 ? clamp01(m.value / m.max) : 0;
  if (m.key === "hp") return ratio > 0.5 ? "#5fd04a" : ratio > 0.25 ? "#e8c23a" : "#e0503a";
  if (m.key === "rage") return "#ffcf3a";
  if (m.key === "power") return "#67c5ff";
  return "#7bd3ff";
}

function paintMeter(g: CanvasRenderingContext2D, w: number, hh: number, m: TooltipMeter) {
  const fill = meterFill(m);
  if (m.kind === "pips") {
    const cells = Math.max(1, Math.min(12, Math.round(m.max)));
    const filled = Math.max(0, Math.min(cells, Math.round(clamp01(m.value / Math.max(1, m.max)) * cells)));
    const gap = 3, cw = Math.max(4, (w - gap * (cells - 1)) / cells);
    for (let i = 0; i < cells; i++) {
      const x = i * (cw + gap);
      nineSlice(g, "bar_trough", 1, x + 1, 4, Math.max(2, cw - 2), Math.max(2, hh - 8), 1);
      if (i < filled) {
        g.fillStyle = fill;
        g.fillRect(x + 2, 5, Math.max(1, cw - 4), Math.max(1, hh - 10));
      }
      threeSlice(g, "frame_rage_cell", 2, x, 2, cw, Math.max(4, hh - 4));
    }
    return;
  }

  nineSlice(g, "bar_trough", 1, 3, 3, Math.max(0, w - 6), Math.max(0, hh - 6));
  const fw = Math.round(Math.max(0, w - 6) * clamp01(m.value / Math.max(1, m.max)));
  g.fillStyle = fill;
  g.fillRect(3, 3, fw, Math.max(0, hh - 6));
  g.fillStyle = "rgba(255,255,255,0.32)";
  g.fillRect(3, 3, fw, Math.max(1, Math.round((hh - 6) * 0.24)));
  const shieldW = Math.round(Math.max(0, w - 6) * clamp01((m.shield ?? 0) / Math.max(1, m.max)));
  if (shieldW > 0) {
    g.fillStyle = "#7bd3ff";
    g.fillRect(3 + fw, 3, Math.min(shieldW, w - 6 - fw), Math.max(0, hh - 6));
  }
  threeSlice(g, "frame_bar", 3, 0, 0, w, hh);
}

export function createTooltip(layer: HTMLElement): Tooltip {
  const el = h("div", "tooltip");
  el.setAttribute("role", "tooltip");
  el.dataset.open = "false";
  surface(el, (g, w, hh) => nineSlice(g, "panel_tooltip", SLICE.panel_tooltip, 0, 0, w, hh));
  const inner = h("div", "tooltip-inner");
  el.append(inner);
  layer.append(el);
  let mode: TooltipMode = "summary";
  let current: TooltipContent | null = null;
  let anchor: DOMRect | null = null;

  const chip = (c: TooltipChip) => {
    const node = h("span", "kit-panel tt-chip");
    node.dataset.tone = c.tone ?? "default";
    if (c.icon) {
      const icon = h("span", "tt-chip-icon", c.icon);
      icon.setAttribute("aria-hidden", "true");
      node.append(icon);
    }
    node.append(h("span", "tt-chip-text", c.text));
    surface(node, (g, w, hh) => nineSlice(g, "tile_status", SLICE.tile_status, 0, 0, w, hh, 1));
    return node;
  };

  const chipRow = (chips: TooltipChip[], cls: string) => {
    const row = h("div", cls);
    for (const c of chips) if (!(mode === "compact" && c.secondary)) row.append(chip(c));
    return row;
  };

  const meterRow = (m: TooltipMeter) => {
    const row = h("div", "tt-meter");
    row.setAttribute("role", "meter");
    row.setAttribute("aria-label", `${m.label}: ${Math.round(m.value)}/${Math.round(m.max)}`);
    row.setAttribute("aria-valuemin", "0");
    row.setAttribute("aria-valuemax", String(Math.max(1, Math.round(m.max))));
    row.setAttribute("aria-valuenow", String(Math.max(0, Math.round(m.value))));
    const label = h("span", "tt-meter-label");
    if (m.icon) {
      const icon = h("span", "tt-meter-icon", m.icon);
      icon.setAttribute("aria-hidden", "true");
      label.append(icon);
    }
    label.append(h("span", "", m.label));
    const track = h("div", "kit-panel tt-meter-track");
    surface(track, (g, w, hh) => paintMeter(g, w, hh, m));
    const value = h("span", "tt-meter-value", `${Math.round(m.value)}/${Math.round(m.max)}${m.shield ? ` +${Math.round(m.shield)}` : ""}`);
    row.append(label, track, value);
    return row;
  };

  const sectionBlock = (s: TooltipSection) => {
    const block = h("section", "tt-sec");
    if (s.title) block.append(h("h4", "tt-sec-title", `🔹 ${s.title}`));
    for (const line of s.lines) if (line.trim()) {
      const row = h("p", "tt-sec-line");
      row.append(decorateDescription(line, inferRichTone(line)));
      block.append(row);
    }
    return block;
  };

  const renderHeader = (c: TooltipContent) => {
    const head = h("div", "tt-head");
    if (c.portrait || c.icon) {
      const avatar = h("div", "kit-panel tt-avatar");
      avatar.dataset.portrait = String(Boolean(c.portrait));
      const icon = h("span", "tt-avatar-icon", c.icon ?? "🐾");
      icon.setAttribute("aria-hidden", "true");
      avatar.append(icon);
      surface(avatar, (g, w, hh) => {
        nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh);
        if (!c.portrait) return;
        const pad = Math.max(3, Math.round(Math.min(w, hh) * 0.055));
        const box = Math.max(1, Math.min(w, hh) - pad * 2);
        const zoom = 1.45, draw = box * zoom;
        g.save();
        g.beginPath();
        g.rect(pad, pad, box, box);
        g.clip();
        g.imageSmoothingEnabled = true;
        g.drawImage(c.portrait, pad - (draw - box) / 2, pad - (draw - box) / 2, draw, draw);
        g.restore();
      });
      head.append(avatar);
    }
    const copy = h("div", "tt-copy");
    copy.append(h("div", "tt-title", c.title));
    if (c.subtitle) copy.append(h("div", "tt-sub", c.subtitle));
    if (c.badges?.length) copy.append(chipRow(c.badges, "tt-badges"));
    if (c.meters?.length) {
      const meters = h("div", "tt-meters");
      for (const m of c.meters) meters.append(meterRow(m));
      copy.append(meters);
    }
    if (c.statuses?.length) copy.append(chipRow(c.statuses, "tt-statuses"));
    head.append(copy);
    inner.append(head);
  };

  const renderLines = (lines: TooltipLine[]) => {
    const box = h("div", "tt-lines");
    for (const l of lines) {
      const row = h("div", `tt-line ${l.tone ? `tt-${l.tone}` : ""}`.trim());
      if (l.icon) { const i = h("span", "tt-icon", l.icon); i.setAttribute("aria-hidden", "true"); row.append(i); }
      const text = h("span");
      text.append(decorateDescription(l.text, inferRichTone(l.text)));
      row.append(text);
      box.append(row);
    }
    inner.append(box);
  };

  const renderSections = (sections: TooltipSection[], cls = "tt-body") => {
    const body = h("div", cls);
    for (const s of sections) body.append(sectionBlock(s));
    inner.append(body);
  };

  const renderColumns = (columns: TooltipSection[][]) => {
    const body = h("div", "tt-body");
    const grid = h("div", "tt-columns");
    grid.dataset.count = String(columns.length);
    columns.forEach((blocks, index) => {
      const col = h("div", "kit-panel tt-col");
      col.dataset.first = String(index === 0);
      surface(col, (g, _w, hh) => {
        if (index === 0) return;
        const gridTop = grid.getBoundingClientRect().top;
        if (col.getBoundingClientRect().top - gridTop > 4) return; // stacked row: no splitter
        g.fillStyle = "rgba(59,36,20,0.24)";
        g.fillRect(0, 6, 2, Math.max(0, hh - 12));
      });
      for (const b of blocks) col.append(sectionBlock(b));
      grid.append(col);
    });
    body.append(grid);
    inner.append(body);
  };

  const render = (c: TooltipContent) => {
    disposeSurfaceTree(inner);
    inner.replaceChildren();
    const rich = Boolean(
      c.portrait || c.icon || c.badges?.length || c.statuses?.length || c.meters?.length
      || c.sections?.length || c.columns?.length || c.description,
    );
    el.dataset.mode = mode;
    el.dataset.rich = String(rich);
    renderHeader(c);
    if (c.description && mode !== "compact") {
      const desc = h("p", "tt-desc");
      desc.append(decorateDescription(c.description, inferRichTone(c.description)));
      inner.append(desc);
    }
    if (mode === "expanded") {
      // The four-column surface needs the wide breakpoint; narrower windows use the summary blocks
      // instead of stacking a 1,500px-tall column grid over the board.
      if (c.columns?.length && innerWidth >= 1100) renderColumns(c.columns);
      else if (c.sections?.length) renderSections(c.sections);
      else if (c.columns?.length) renderColumns(c.columns);
      else if (c.lines?.length) renderLines(c.lines);
      if (c.body) {
        const body = h("div", "tt-body");
        body.append(decorateDescription(c.body, inferRichTone(c.body)));
        inner.append(body);
      }
      return;
    }
    if (mode === "compact") {
      if (c.lines?.length) renderLines(c.lines);
      else if (c.sections?.length) renderSections(c.sections);
      return;
    }
    if (c.sections?.length) renderSections(c.sections);
    else if (c.lines?.length) renderLines(c.lines);
    if (c.body && !c.sections?.length && !c.lines?.length) {
      const body = h("div", "tt-body");
      body.append(decorateDescription(c.body, inferRichTone(c.body)));
      inner.append(body);
    }
  };

  const place = (r: DOMRect) => {
    const vw = innerWidth, vh = innerHeight, tw = el.offsetWidth, th = el.offsetHeight;
    const clampX = (x: number) => Math.max(8, Math.min(vw - tw - 8, x));
    const clampY = (y: number) => Math.max(8, Math.min(vh - th - 8, y));
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - GAP;
    if (y < 8) y = r.bottom + GAP; // flip below
    if (y + th > vh - 8) {
      // Tall surface: try beside the anchor before clamping over it.
      const besideY = clampY(r.top + r.height / 2 - th / 2);
      const rightX = r.right + GAP, leftX = r.left - tw - GAP;
      if (rightX + tw <= vw - 8) { x = rightX; y = besideY; }
      else if (leftX >= 8) { x = leftX; y = besideY; }
    }
    el.style.left = `${Math.round(clampX(x))}px`;
    el.style.top = `${Math.round(clampY(y))}px`;
  };

  const api: Tooltip = {
    show(a, c) {
      if (mode === "off") return;
      current = c;
      anchor = a instanceof HTMLElement ? a.getBoundingClientRect() : a;
      render(c);
      el.dataset.open = "true";
      place(anchor);
    },
    hide() { el.dataset.open = "false"; },
    bind(target, get) {
      let timer = 0;
      let longPressOpened = false;
      const open = () => {
        const c = get();
        if (c && mode !== "off") { api.show(target, c); return true; }
        return false;
      };
      const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") open(); };
      const down = (e: PointerEvent) => {
        if (e.pointerType === "mouse") return;
        clearTimeout(timer);
        longPressOpened = false;
        timer = window.setTimeout(() => { longPressOpened = open(); }, LONG_PRESS_MS);
      };
      const up = () => clearTimeout(timer);
      const leave = () => { clearTimeout(timer); api.hide(); };
      const cancel = () => { longPressOpened = false; leave(); };
      const click = (e: MouseEvent) => {
        if (!longPressOpened || e.detail === 0) return;
        longPressOpened = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        api.hide();
      };
      target.addEventListener("click", click, true);
      target.addEventListener("pointerenter", enter);
      target.addEventListener("pointerdown", down);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointerleave", leave);
      target.addEventListener("pointercancel", cancel);
      target.addEventListener("focus", open);
      target.addEventListener("blur", leave);
      return () => {
        cancel();
        target.removeEventListener("click", click, true);
        target.removeEventListener("pointerenter", enter);
        target.removeEventListener("pointerdown", down);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointerleave", leave);
        target.removeEventListener("pointercancel", cancel);
        target.removeEventListener("focus", open);
        target.removeEventListener("blur", leave);
      };
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      if (m === "off") { api.hide(); return; }
      if (el.dataset.open === "true" && current && anchor) {
        render(current);
        place(anchor);
      }
    },
  };
  return api;
}
