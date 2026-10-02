// Shared unit card (§14.6, §25.2, A22): one visual system for Shop and Library.
// Avatar large/high/centred; tribe + element explicit; compact stats in corners; rage requirement;
// cost bottom-left (no duplicate top-right coin). Static chrome = tier card PNG; text on canvas.
import type { UnitDef } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { drawFit, h, INK, label, nineSlice, SLICE, surface, type Surface } from "./kit";

/** 3D portrait source; null until the unit render is ready (card repaints via `onReady`). */
export interface PortraitProvider {
  get(baseId: string, star: number): CanvasImageSource | null;
  onReady(fn: () => void): () => void;
}

export interface CardData {
  unit: UnitDef;
  star: 1 | 2 | 3;
  /** Shop price; omitted in Library. */
  cost?: number;
  /** Library shows full stats; Planning hides HP/ATK for a cleaner tactical card. */
  detail: "planning" | "library";
  affordable?: boolean;
  owned?: number;
}

export interface CardView { el: HTMLElement; set(d: CardData | null): void; paint(): void; dispose(): void }

const TEXT = "#3b2414";

export function createCard(portraits: PortraitProvider, cls = ""): CardView {
  const el = h("div", `unit-card ${cls}`.trim());
  const art = h("div", "unit-card-art");
  el.append(art);
  let data: CardData | null = null;

  const s: Surface = surface(art, (g, w, hh) => {
    if (!data) { nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh); return; }
    const { unit, star } = data;
    nineSlice(g, `card_t${Math.min(6, unit.tier)}`, SLICE.card, 0, 0, w, hh);

    // Layout bands derived from the card box (2.2): portrait 58%, name 14%, identity 14%, corners 14%.
    const pad = Math.max(6, Math.round(w * 0.08)), inner = hh - pad * 2;
    const pw = w - pad * 2, ph = Math.round(inner * 0.58);
    const band = (inner - ph) / 3, fs = Math.max(9, Math.min(15, band * 0.62, w / 8));
    nineSlice(g, "slot_well", SLICE.slot_well, pad, pad, pw, ph);
    const p = portraits.get(unit.id, star);
    if (p) {
      g.imageSmoothingEnabled = true;
      g.drawImage(p, pad + 3, pad + 3, pw - 6, ph - 6);
      g.imageSmoothingEnabled = false;
    }

    // Stars top-left and rage cost top-right inside the portrait window.
    const ss = Math.max(9, Math.min(14, pw / 6));
    for (let i = 0; i < star; i++) drawFit(g, "star", pad + 4 + i * (ss + 1), pad + 4, ss, ss);
    const rage = unit.skill.rageCost[star - 1] ?? unit.skill.rageCost[0];
    label(g, `${ICONS.rage}${rage}`, pad + pw - 4, pad + 4 + ss / 2, { size: fs, align: "right", weight: 800 });

    // Name band.
    const ny = pad + ph + band * 0.5;
    label(g, unit.nameVi, w / 2, ny, { size: fs, fill: TEXT, stroke: null, weight: 800, maxW: w - pad * 2 });

    // Identity band: role · faction · element (explicit tribe/element per A22).
    const iy = ny + band, icons = [ICONS[unit.role], ICONS[unit.faction], ICONS[unit.element]];
    icons.forEach((ic, i) => label(g, ic, w / 2 + (i - 1) * (pw / 3), iy, { size: fs * 1.05, stroke: null }));

    // Corner band: cost bottom-left, compact stat bottom-right.
    const by = iy + band;
    if (data.cost !== undefined) {
      label(g, `${ICONS.gold}${data.cost}`, pad, by, { size: fs, align: "left", fill: data.affordable === false ? "#b23a2e" : TEXT, stroke: null, weight: 900 });
    }
    const stat = data.detail === "library"
      ? `${ICONS.hp}${unit.stats.hp} ${ICONS.atk}${Math.max(unit.stats.atk, unit.stats.matk)}`
      : `${ICONS.range}${unit.stats.range}`;
    label(g, stat, w - pad, by, { size: fs * 0.9, align: "right", fill: TEXT, stroke: null, maxW: data.cost !== undefined ? pw * 0.6 : pw });
    if (data.owned) label(g, `×${data.owned}`, w / 2, by, { size: fs * 0.9, fill: INK, stroke: null });
  });

  const off = portraits.onReady(() => s.paint());
  return {
    el,
    set(d) {
      data = d;
      el.dataset.empty = String(!d);
      el.setAttribute("aria-label", d ? `${d.unit.nameVi} ${d.star}★` : "");
      s.paint();
    },
    paint: s.paint,
    dispose() { off(); s.dispose(); el.remove(); },
  };
}
