// Tech tree (§14.13, §50.5, A111): radial forest research map over the canonical TECH_NODES graph.
// Layout is presentation-only (deterministic, derived from topology); prerequisite/cost/research
// decisions all come from core/tech + the bridge. Pan by drag, pointer-centred wheel zoom, Fit.
import { t, type MsgKey } from "../core/i18n";
import { canResearch, maxLevel, researchCost, TECH_BY_ID, TECH_NODES, type Branch, type TechNode } from "../core/tech";
import { ICONS } from "../core/emojiIcon";
import { h, kitButton, label, nineSlice, panelEl, SLICE } from "./kit";
import type { ModalHandle } from "./modal";

const FOCUS_KEY = "forest-throne:planning:last-tech-focus";
const BRANCHES: Exclude<Branch, "ROOT">[] = ["VET", "EXPLORE", "ECON", "MIL", "CRAFT"];
const BRANCH_ICON: Record<Exclude<Branch, "ROOT">, string> = { VET: "🩺", EXPLORE: "🧭", ECON: ICONS.gold, MIL: ICONS.atk, CRAFT: ICONS.craft };
const RING = 120, NODE_R = 26;
const ZOOM = { focus: 1.08, focusMin: 0.7, focusMax: 1.35, fitMin: 0.35, fitMax: 1.25, wheelMin: 0.35, wheelMax: 1.8 };

interface Pos { x: number; y: number; depth: number }

/** Deterministic radial layout: one sector per branch, children spread by leaf count, radius by depth. */
export function layoutTech(nodes: readonly TechNode[]): Map<string, Pos> {
  const kids = new Map<string, string[]>();
  const parentOf = (n: TechNode) => n.requires[0] ?? "root";
  for (const n of nodes) { const p = parentOf(n); kids.set(p, [...(kids.get(p) ?? []), n.id]); }
  const leaves = (id: string): number => { const c = kids.get(id); return c?.length ? c.reduce((s, k) => s + leaves(k), 0) : 1; };
  const out = new Map<string, Pos>([["root", { x: 0, y: 0, depth: 0 }]]);
  const place = (id: string, a0: number, a1: number, depth: number) => {
    const a = (a0 + a1) / 2;
    if (!out.has(id)) out.set(id, { x: Math.cos(a) * RING * depth, y: Math.sin(a) * RING * depth, depth });
    const c = kids.get(id) ?? [], total = c.reduce((s, k) => s + leaves(k), 0) || 1;
    let at = a0;
    for (const k of c) { const span = ((a1 - a0) * leaves(k)) / total; place(k, at, at + span, depth + 1); at += span; }
  };
  const heads = nodes.filter((n) => n.requires.length === 0);
  BRANCHES.forEach((b, i) => {
    const sector = (Math.PI * 2) / BRANCHES.length, a0 = -Math.PI / 2 + i * sector;
    const bh = heads.filter((n) => n.branch === b), span = sector / Math.max(1, bh.length);
    bh.forEach((n, j) => place(n.id, a0 + j * span, a0 + (j + 1) * span, 1));
  });
  return out;
}

export interface TechModel { levels: Record<string, number>; gold: number }
export interface TechView { update(m: TechModel): void; dispose(): void }

export function mountTechTree(modal: ModalHandle, model: TechModel, research: (id: string) => void): TechView {
  let m = model, sel = "root";
  const pos = layoutTech(TECH_NODES);
  const root = h("div", "tech");
  const map = panelEl("slot_well", "tech-map");
  const canvas = h("canvas", "tech-canvas") as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  map.append(canvas);
  const side = h("div", "tech-side");
  const fit = kitButton({ skin: "wood", label: t("tech.fit"), cls: "tech-fit", onClick: () => fitAll() });
  const info = h("div", "tech-info");
  side.append(fit.el, info);
  root.append(map, side);
  modal.body.append(root);

  const view = { x: 0, y: 0, z: ZOOM.focus };
  const lvl = (id: string) => (id === "root" ? 1 : m.levels[id] ?? 0);
  const state = (n: TechNode) => {
    const l = lvl(n.id);
    if (l >= maxLevel(n)) return "maxed";
    if (!n.requires.every((r) => lvl(r) >= 1)) return "locked";
    return canResearch(m.levels, n.id, m.gold) ? "affordable" : l > 0 ? "owned" : "unaffordable";
  };
  const name = (id: string) => (id === "root" ? t("tech.root") : id.replace(/_/g, " "));

  const draw = () => {
    const w = map.clientWidth, hh = map.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (!w || !hh) return;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hh * dpr; }
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    g.save();
    g.translate(w / 2 + view.x, hh / 2 + view.y);
    g.scale(view.z, view.z);
    // Edges: every requirement relation (A111.2), coloured by progression.
    for (const n of TECH_NODES) {
      const b = pos.get(n.id)!, reqs = n.requires.length ? n.requires : ["root"];
      for (const r of reqs) {
        const a = pos.get(r);
        if (!a) continue;
        const done = lvl(r) >= 1 && lvl(n.id) >= 1, open = lvl(r) >= 1;
        g.strokeStyle = done ? "#e0b04a" : open ? "#8f5b32" : "#6b5a48";
        g.lineWidth = done ? 5 : 3;
        g.setLineDash(open ? [] : [6, 6]);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    g.setLineDash([]);
    g.imageSmoothingEnabled = false;
    const nodeAt = (id: string, skin: string, glyph: string, lvText: string) => {
      const p = pos.get(id)!, r = id === "root" ? NODE_R * 1.4 : NODE_R;
      nineSlice(g, skin, SLICE.btn_icon, p.x - r, p.y - r, r * 2, r * 2, 1.5);
      if (id === sel) { g.strokeStyle = "#ffe08a"; g.lineWidth = 3; g.strokeRect(p.x - r - 4, p.y - r - 4, r * 2 + 8, r * 2 + 8); }
      label(g, glyph, p.x, p.y - 2, { size: r * 0.8, stroke: null });
      label(g, lvText, p.x, p.y + r + 10, { size: 12 });
    };
    nodeAt("root", "btn_icon_selected", "🌳", t("tech.root"));
    for (const n of TECH_NODES) {
      const st = state(n);
      const skin = st === "maxed" ? "btn_icon_selected" : st === "locked" ? "btn_icon_disabled" : st === "affordable" ? "btn_icon_hover" : "btn_icon_normal";
      const max = maxLevel(n);
      nodeAt(n.id, skin, st === "locked" ? ICONS.lock : BRANCH_ICON[n.branch as Exclude<Branch, "ROOT">] ?? "❔", `${lvl(n.id)}/${max === Infinity ? "∞" : max}`);
    }
    g.restore();
  };

  const focus = (id: string) => {
    const p = pos.get(id);
    if (!p) return;
    view.z = Math.min(ZOOM.focusMax, Math.max(ZOOM.focusMin, ZOOM.focus));
    view.x = -p.x * view.z; view.y = -p.y * view.z;
  };
  function fitAll() {
    let r = 0;
    for (const p of pos.values()) r = Math.max(r, Math.hypot(p.x, p.y) + NODE_R * 2);
    const s = (Math.min(map.clientWidth, map.clientHeight) * 0.94) / (r * 2);
    view.z = Math.min(ZOOM.fitMax, Math.max(ZOOM.fitMin, s)); view.x = 0; view.y = 0;
    draw();
  }

  function renderInfo() {
    info.replaceChildren();
    const n = TECH_BY_ID.get(sel), p = panelEl("panel_tooltip", "lib-sec");
    if (!n) {
      p.append(h("h3", "lib-h", `🌳 ${t("tech.root")}`));
      info.append(p);
      modal.setTitle(t("planning.tech"));
      return;
    }
    const l = lvl(n.id), max = maxLevel(n), st = state(n);
    p.append(h("h3", "lib-h", `${BRANCH_ICON[n.branch as Exclude<Branch, "ROOT">] ?? ""} ${name(n.id)}`));
    p.append(h("p", "lib-p", t(`branch.${n.branch}` as MsgKey)));
    p.append(h("p", "lib-p", t("tech.level", { level: l, max: max === Infinity ? "∞" : max })));
    const eff = n.effects[Math.min(l, n.effects.length - 1)] ?? {};
    // LOGIC: replace raw stat keys with the canonical effect formatter (A111.5) once it exists.
    p.append(h("p", "lib-p", Object.entries(eff).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(" · ")));
    const reqs = h("div", "lib-p", `${t("tech.requires")}: `);
    for (const r of n.requires) reqs.append(h("span", lvl(r) >= 1 ? "req-ok" : "req-no", ` ${lvl(r) >= 1 ? "✅" : "⬜"} ${name(r)}`));
    if (n.requires.length) p.append(reqs);
    info.append(p);
    const cost = l < max ? researchCost(n, l) : 0;
    const b = kitButton({ skin: st === "maxed" ? "wood" : "green", cls: "wide-btn",
      label: st === "maxed" ? t("tech.maxed") : st === "locked" ? t("tech.locked") : `${ICONS.gold} ${t("tech.research", { cost })}`,
      onClick: () => research(n.id) });
    b.setDisabled(st !== "affordable");
    info.append(b.el);
  }

  const select = (id: string) => {
    sel = id;
    if (id === "root" || TECH_BY_ID.has(id)) { try { localStorage.setItem(FOCUS_KEY, id); } catch { /* storage optional */ } }
    renderInfo(); draw();
  };

  // Pointer: drag pans without changing selection; tap selects the node under the pointer.
  let drag: { x: number; y: number; moved: boolean } | null = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true; view.x += dx; view.y += dy; drag.x = e.clientX; drag.y = e.clientY; draw();
  });
  canvas.addEventListener("pointerup", (e) => {
    const wasDrag = drag?.moved; drag = null;
    if (wasDrag) return;
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left - r.width / 2 - view.x) / view.z, wy = (e.clientY - r.top - r.height / 2 - view.y) / view.z;
    for (const [id, p] of pos) if (Math.hypot(p.x - wx, p.y - wy) <= NODE_R * 1.3) { select(id); return; }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left - r.width / 2, py = e.clientY - r.top - r.height / 2;
    const nz = Math.min(ZOOM.wheelMax, Math.max(ZOOM.wheelMin, view.z * (e.deltaY > 0 ? 0.9 : 1.1)));
    view.x = px - ((px - view.x) * nz) / view.z; view.y = py - ((py - view.y) * nz) / view.z; view.z = nz;
    draw();
  }, { passive: false });
  const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "f" && !(e.target instanceof HTMLInputElement)) fitAll(); };
  addEventListener("keydown", onKey);
  const ro = new ResizeObserver(draw);
  ro.observe(map);

  // Opening focus (A111.3): stored → latest researched → root.
  let stored: string | null = null;
  try { stored = localStorage.getItem(FOCUS_KEY); } catch { stored = null; }
  const researched = Object.keys(m.levels).filter((id) => (m.levels[id] ?? 0) > 0);
  sel = stored && pos.has(stored) ? stored : researched.at(-1) ?? "root";
  requestAnimationFrame(() => { focus(sel); renderInfo(); draw(); });

  return {
    update(nm) { m = nm; renderInfo(); draw(); },
    dispose() { ro.disconnect(); removeEventListener("keydown", onKey); root.remove(); },
  };
}
