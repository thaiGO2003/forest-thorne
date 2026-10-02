// Combat HUD + result overlay (§16.16, §16.17, §40, §50.3, A95, A121). Observes canonical combat
// state only: repainting, density changes or opening History never step combat or apply rewards.
import { ICONS } from "../core/emojiIcon";
import { t } from "../core/i18n";
import type { TeamStrength } from "../core/inspection";
import type { RoundResultSummary } from "../core/run";
import { h, kitButton, label, nineSlice, panelEl, SLICE, surface, threeSlice } from "./kit";
import type { ModalHost } from "./modal";

export interface QueueEntry { name: string; side: "L" | "R"; icon: string }

export interface CombatHudModel {
  round: number;
  cycle: number;
  speed: number;
  /** Anti-stall global damage multiplier (A17); shown only when > 1. */
  escalation: number;
  left: TeamStrength;
  right: TeamStrength;
  queue: QueueEntry[];
  log: string[];
}

export interface CombatHudIntents { speed(): void; history(): void }
export interface CombatHudView { update(m: CombatHudModel): void; dispose(): void }

/** A95 density: normal 8 queue / 4 log, compact 3 / 3 below this panel width. */
const COMPACT_W = 320;

function teamBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, ratio: number, fill: string, flip: boolean) {
  nineSlice(g, "bar_trough", 1, x + 3, y + 3, w - 6, hh - 6);
  const fw = Math.round((w - 6) * Math.max(0, Math.min(1, ratio)));
  g.fillStyle = fill;
  g.fillRect(flip ? x + w - 3 - fw : x + 3, y + 3, fw, hh - 6);
  threeSlice(g, "frame_bar", 3, x, y, w, hh);
}

export function createCombatHud(host: HTMLElement, it: CombatHudIntents): CombatHudView {
  let m: CombatHudModel | null = null;
  const root = h("div", "combat");
  root.dataset.screen = "combat";

  // Top: round · cycle · escalation, with LEFT-vs-RIGHT team strength underneath.
  const top = h("div", "cb-top");
  const topS = surface(top, (g, w, hh) => {
    nineSlice(g, "panel_wood", SLICE.panel_wood, 0, 0, w, hh);
    if (!m) return;
    const head = `${ICONS.round} ${t("combat.round", { round: m.round })}  ·  ${t("combat.cycle", { cycle: m.cycle })}`;
    label(g, head, w / 2, 20, { size: 15 });
    if (m.escalation > 1) label(g, `☠️ ${t("combat.escalation", { mult: m.escalation.toFixed(1) })}`, w - 16, 20, { size: 13, align: "right", fill: "#ffb38a" });
    const bw = (w - 60) / 2, by = 38;
    teamBar(g, 14, by, bw, 18, m.left.hpRatio, "#5fd04a", false);
    teamBar(g, w - 14 - bw, by, bw, 18, m.right.hpRatio, "#e0503a", true);
    label(g, "⚔️", w / 2, by + 9, { size: 16, stroke: null });
    label(g, `${m.left.units} · ${ICONS.atk}${m.left.power}`, 18, by + 30, { size: 12, align: "left" });
    label(g, `${ICONS.atk}${m.right.power} · ${m.right.units}`, w - 18, by + 30, { size: 12, align: "right" });
  });

  // Right rail: turn-order queue + short log with History access.
  const side = panelEl("panel_wood", "cb-side");
  const sideHead = h("div", "cb-side-head");
  const speed = kitButton({ skin: "plum", icon: "⏩", cls: "cb-speed", onClick: () => it.speed() });
  const hist = kitButton({ skin: "icon", icon: ICONS.history, cls: "cb-hist", onClick: () => it.history() });
  sideHead.append(speed.el, hist.el);
  const info = h("div", "cb-info");
  const infoS = surface(info, (g, w, hh) => {
    if (!m) return;
    const compact = w < COMPACT_W;
    const q = m.queue.slice(0, compact ? 3 : 8), log = m.log.slice(-(compact ? 3 : 4));
    label(g, t("combat.queue"), 6, 12, { size: 12, align: "left" });
    const rowH = 24;
    q.forEach((e, i) => {
      const y = 24 + i * (rowH + 2);
      nineSlice(g, e.side === "L" ? "tile_status" : "slot_well", SLICE.tile_status, 0, y, w, rowH, 1.5);
      label(g, e.icon, 14, y + rowH / 2, { size: 13, stroke: null });
      label(g, e.name, 30, y + rowH / 2, { size: 12, align: "left", maxW: w - 36, fill: e.side === "L" ? "#fff8ec" : "#3b2414", stroke: e.side === "L" ? undefined : null });
    });
    const ly = 24 + q.length * (rowH + 2) + 12;
    label(g, t("combat.log"), 6, ly, { size: 12, align: "left" });
    log.forEach((line, i) => label(g, line, 6, ly + 18 + i * 17, { size: 11, align: "left", maxW: w - 8, weight: 600 }));
    void hh;
  });
  side.append(sideHead, info);
  root.append(top, side);
  host.append(root);

  return {
    update(nm) {
      m = nm;
      speed.setLabel(`×${nm.speed}`);
      speed.el.setAttribute("aria-label", t("combat.speed", { speed: nm.speed }));
      hist.el.setAttribute("aria-label", t("planning.history"));
      topS.paint(); infoS.paint();
    },
    dispose() { root.remove(); },
  };
}

/**
 * Result overlay (A87, A121): non-dismissible until the player continues; shows the already-applied
 * normalized summary. It never applies rewards itself.
 */
export function openResult(modals: ModalHost, round: number, r: RoundResultSummary, onContinue: () => void) {
  const title = r.winner === "LEFT" ? t("combat.victory") : r.winner === "RIGHT" ? t("combat.defeat") : t("combat.draw");
  const m = modals.open({ id: "combat-result", title, size: "sm", dismissible: false });
  const body = h("div", "stack cb-result");
  const banner = h("div", "cb-banner");
  surface(banner, (g, w, hh) => {
    nineSlice(g, "ribbon", SLICE.ribbon, 0, 4, w, hh - 8, 2);
    label(g, t("combat.result", { round }), w / 2, hh / 2 - 2, { size: 16 });
  });
  const row = (icon: string, k: string, v: string) => {
    const p = panelEl("slot_well", "cb-row");
    p.append(h("span", "cb-k", `${icon} ${k}`), h("span", "cb-v", v));
    return p;
  };
  body.append(banner,
    row(ICONS.gold, t("combat.gold"), `+${r.goldEarned + r.incomeEarned}`),
    row(ICONS.xp, t("combat.xp"), `+${r.xpEarned}`),
    row(ICONS.heart, t("combat.damage"), r.damageTaken ? `-${r.damageTaken} → ${r.hpAfter}` : "0"));
  if (r.acceptedDrops.length) body.append(row("🎁", t("combat.loot"), `${r.acceptedDrops.length}`));
  const next = kitButton({ skin: r.gameOver ? "red" : "green", label: r.gameOver ? t("combat.toMenu") : t("combat.next"), cls: "cb-next", onClick: () => { m.close(); onContinue(); } });
  body.append(next.el);
  m.body.append(body);
  next.el.focus();
}
