// Shared unit card (§14.6, §25.2, A22): asset-framed Shop and Library portraits with
// identity, HP/attack values and tier-based gold price displayed in both contexts.
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
  /** Shop purchase price; Library uses the unit's tier when omitted. */
  cost?: number;
  /** Shared statistics and price layout for both card contexts. */
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

    // Four rows below the portrait keep identity, combat stats and purchase price separate.
    const pad = Math.max(6, Math.round(w * 0.08)), inner = hh - pad * 2;
    const pw = w - pad * 2, ph = Math.round(inner * (hh < w * 1.1 ? 0.42 : 0.5));
    const band = (inner - ph) / 4, fs = Math.max(8, Math.min(15, band * 0.85, w / 8));
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

    // Health and physical/magical attack use inset anchors to avoid clipped edge icons.
    const magicBasic = unit.role === "MAGE" || unit.role === "SUPPORT" || unit.basic.damageType === "magic";
    const statsY = iy + band;
    const left = pad + 6, right = w - pad - 6;
    label(g, `${ICONS.hp}${unit.stats.hp}`, left, statsY, { size: fs * 0.92, align: "left", fill: TEXT, stroke: null, maxW: pw * 0.46 });
    label(g, `${magicBasic ? ICONS.matk : ICONS.atk}${magicBasic ? unit.stats.matk : unit.stats.atk}`, right, statsY,
      { size: fs * 0.92, align: "right", fill: TEXT, stroke: null, maxW: pw * 0.46 });
    // Library and Shop prices share the canonical tier cost; range remains on the right.
    const by = statsY + band;
    const price = data.cost ?? unit.tier;
    label(g, `${ICONS.gold}${price}`, left, by, {
      size: fs * 0.92, align: "left", fill: data.affordable === false ? "#b23a2e" : TEXT,
      stroke: null, weight: 900, maxW: pw * 0.46,
    });
    label(g, `${ICONS.range}${unit.stats.range}`, right, by, { size: fs * 0.92, align: "right", fill: TEXT, stroke: null, maxW: pw * 0.46 });
    if (data.owned) label(g, `×${data.owned}`, w / 2, by, { size: fs * 0.9, fill: INK, stroke: null });
  });

  const off = portraits.onReady(() => s.paint());
  return {
    el,
    set(d) {
      data = d;
      el.dataset.empty = String(!d);
      el.setAttribute("aria-label", d ? `${d.unit.nameVi} ${d.star}★, ${d.unit.stats.hp} HP, ${d.unit.stats.atk} attack, ${d.cost ?? d.unit.tier} gold` : "");
      s.paint();
    },
    paint: s.paint,
    dispose() { off(); s.dispose(); el.remove(); },
  };
}
