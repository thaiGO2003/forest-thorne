// Shared unit card (§14.6, §25.2, A22): asset-framed Shop and Library portraits with
// identity, HP/attack values and tier-based gold price displayed in both contexts.
import type { UnitDef } from "../content/catalog";
import { ICONS } from "../core/emojiIcon";
import { t, type MsgKey } from "../core/i18n";
import { drawFit, h, INK, label, nineSlice, SLICE, surface, type Surface } from "./kit";
import type { TooltipContent } from "./tooltip";

/** 3D portrait source; null until the unit render is ready (card repaints via `onReady`). */
export interface PortraitProvider {
  get(baseId: string, star: number): CanvasImageSource | null;
  onReady(fn: () => void): () => void;
}

export interface CardData {
  unit: UnitDef;
  star: 1 | 2 | 3;
  /** Gold purchase price (not available for boss encounters). */
  cost?: number;
  affordable?: boolean;
  owned?: number;
}

export interface CardView { el: HTMLElement; set(d: CardData | null): void; paint(): void; dispose(): void }

const TEXT = "#3b2414";

/** One catalog-backed summary for both card types and all tooltip display modes. */
export function unitCardTooltip(unit: UnitDef): TooltipContent {
  const magicBasic = unit.basic.damageType === "magic";
  return {
    title: unit.nameVi,
    subtitle: `${t(`role.${unit.role}` as MsgKey)} · ${t(`faction.${unit.faction}` as MsgKey)} · ${t(`element.${unit.element}` as MsgKey)}`,
    lines: [
      { icon: ICONS.hp, text: `${unit.stats.hp} HP` },
      { icon: magicBasic ? ICONS.matk : ICONS.atk, text: `${magicBasic ? unit.stats.matk : unit.stats.atk} · ${unit.basic.textVi}` },
      { icon: ICONS.range, text: `${t("library.target")}: ${unit.stats.range}` },
      { icon: ICONS.rage, text: `${unit.skill.nameVi} (${t("unit.rage", { cost: unit.skill.rageCost[0] })})` },
      ...(!unit.boss ? [{ icon: ICONS.gold, text: `${unit.tier}` }] : []),
    ],
    body: [unit.pitchVi, unit.skill.starDetailVi[0] ?? unit.skill.detailVi].filter(Boolean).join("\n"),
  };
}

export function createCard(portraits: PortraitProvider, cls = ""): CardView {
  const el = h("div", `unit-card ${cls}`.trim());
  const art = h("div", "unit-card-art");
  el.append(art);
  let data: CardData | null = null;

  const s: Surface = surface(art, (g, w, hh) => {
    if (!data) { nineSlice(g, "slot_well", SLICE.slot_well, 0, 0, w, hh); return; }
    const { unit, star } = data;
    nineSlice(g, `card_t${Math.min(6, unit.tier)}`, SLICE.card, 0, 0, w, hh);

    // Keep four distinct bands below the portrait: name, identity, price/range, HP/attack.
    const pad = Math.max(6, Math.round(w * 0.09)), inner = hh - pad * 2;
    const pw = w - pad * 2;
    const ph = Math.max(0, Math.min(Math.round(inner * 0.47), inner - 4 * Math.min(9, inner / 4)));
    const band = (inner - ph) / 4, fs = Math.max(8, Math.min(15, band * 0.75, w / 8));
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

    // Clip each half-band; keep numbers independent of emoji image scaling.
    const field = (icon: string, value: number, right: boolean, y: number, fill = TEXT) => {
      const left = right ? w / 2 + 2 : pad + 2;
      const width = right ? w - pad - 2 - left : w / 2 - 2 - left;
      if (width <= 0) return;
      const iconSize = Math.min(17, band * 0.75);
      const numberSize = Math.min(18, band * 0.87);
      g.save();
      g.beginPath();
      g.rect(left, y - band / 2, width, band);
      g.clip();
      label(g, icon, left + iconSize / 2, y, { size: iconSize, stroke: null });
      label(g, String(value), left + iconSize + 3, y, {
        size: numberSize, align: "left", fill, stroke: null, weight: 900,
        maxW: Math.max(0, width - iconSize - 4),
      });
      g.restore();
    };
    const priceY = iy + band, statsY = priceY + band;
    if (data.cost !== undefined) {
      field(ICONS.gold, data.cost, false, priceY, data.affordable === false ? "#b23a2e" : TEXT);
    }
    field(ICONS.range, unit.stats.range, true, priceY);
    const magicBasic = unit.basic.damageType === "magic";
    field(ICONS.hp, unit.stats.hp, false, statsY);
    field(magicBasic ? ICONS.matk : ICONS.atk, magicBasic ? unit.stats.matk : unit.stats.atk, true, statsY);
    if (data.owned) label(g, `×${data.owned}`, w / 2, priceY, { size: fs * 0.9, fill: INK, stroke: null });
  });

  const off = portraits.onReady(() => s.paint());
  return {
    el,
    set(d) {
      data = d;
      el.dataset.empty = String(!d);
      el.setAttribute("aria-label", d ? [
        `${d.unit.nameVi} ${d.star}★`,
        `${d.unit.stats.hp} HP`,
        `${d.unit.basic.damageType === "magic" ? d.unit.stats.matk : d.unit.stats.atk} attack`,
        `${d.unit.stats.range} range`,
        ...(d.cost === undefined ? [] : [`${d.cost} gold`]),
      ].join(", ") : "");
      s.paint();
    },
    paint: s.paint,
    dispose() { off(); s.dispose(); el.remove(); },
  };
}
