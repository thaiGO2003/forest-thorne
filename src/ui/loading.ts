// Loading scene (§4.1, A55.1, A97). Progress is driven one-way by the real loader; the bubble
// shooter is presentation-only and never gates, speeds or mutates loading/gameplay.
import { ICONS } from "../core/emojiIcon";
import { drawFit, h, HEADING_FONT, kitButton, label, nineSlice, SLICE, surface, threeSlice } from "./kit";

const AMMO = [ICONS.BEAST, ICONS.mushroom, ICONS.chestnut, ICONS.star, ICONS.FIRE, ICONS.leaf];
const FIRST_SPAWN_MS = 180, SPAWN_MS = 280, SHOT_SPEED = 620, SHOT_R = 16, MAX_DT = 0.1;

// Title color advances only when the actual asset loader reports progress.
const RAINBOW = ["#ff7068", "#ffae58", "#f6de62", "#7bdd76", "#63c9f1", "#958cff", "#dd86e9"] as const;

export function drawLoadingTitle(g: CanvasRenderingContext2D, title: string, progress: number, w: number, hh: number): void {
  // NFC preserves Vietnamese glyphs composed with combining accents as single characters.
  const lines = title.split(/\r?\n/).map((line) => Array.from(line.normalize("NFC")));
  const letterCount = lines.reduce((sum, line) => sum + line.filter((ch) => ch.trim() !== "").length, 0);
  const revealed = Math.floor(Math.max(0, Math.min(1, progress)) * letterCount);
  const size = Math.min(40, w / 14);
  g.save();
  g.font = `800 ${size}px ${HEADING_FONT}`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = Math.max(2, size / 5);
  g.strokeStyle = "#1e120a";
  let ordinal = 0;
  lines.forEach((glyphs, row) => {
    const advances = glyphs.map((glyph) => g.measureText(glyph).width);
    const lineWidth = advances.reduce((sum, advance) => sum + advance, 0);
    const scale = Math.min(1, (w - 90) / Math.max(1, lineWidth));
    g.save();
    g.translate((w - lineWidth * scale) / 2, hh * 0.4 + (row - (lines.length - 1) / 2) * size * 1.1);
    g.scale(scale, 1);
    let x = 0;
    glyphs.forEach((glyph, index) => {
      if (glyph.trim()) {
        g.fillStyle = ordinal < revealed ? RAINBOW[ordinal % RAINBOW.length]! : "#ffffff";
        ordinal++;
      } else {
        g.fillStyle = "#ffffff";
      }
      g.strokeText(glyph, x, 0);
      g.fillText(glyph, x, 0);
      x += advances[index]!;
    });
    g.restore();
  });
  g.restore();
}

interface Bubble { x: number; y: number; r: number; vx: number; vy: number; amp: number; phase: number; t: number }
interface Shot { x: number; y: number; vx: number; vy: number; glyph: string }

export interface LoadingView {
  el: HTMLElement;
  /** Normalized 0..1 from the real loader. */
  setProgress(p: number, detail?: string): void;
  setCopy(c: { title?: string; hint?: string }): void;
  /** Shows retry/continue-anyway actions; the loader owns what they do. */
  fail(message: string, actions: { retry: () => void; retryLabel: string }): void;
  dispose(): void;
}

export function createLoading(host: HTMLElement, o: { title: string; hint: string; tips?: string[]; rng?: () => number; onScore?: (n: number) => void }): LoadingView {
  const rng = o.rng ?? Math.random;
  const root = h("div", "loading");
  root.dataset.screen = "loading";
  const play = h("canvas", "loading-play") as HTMLCanvasElement;
  play.setAttribute("aria-hidden", "true");
  const titleEl = h("div", "loading-title");
  const barEl = h("div", "loading-bar");
  barEl.setAttribute("role", "progressbar");
  barEl.setAttribute("aria-valuemin", "0");
  barEl.setAttribute("aria-valuemax", "100");
  const actions = h("div", "loading-actions");
  root.append(play, titleEl, barEl, actions);
  host.append(root);

  let title = o.title, hint = o.hint, progress = 0, detail = "", score = 0, failed: string | null = null;
  const tips = (o.tips ?? []).filter((tip) => tip.length > 0);
  let tipIndex = 0;

  const titleS = surface(titleEl, (g, w, hh) => {
    nineSlice(g, "ribbon", SLICE.ribbon, 0, hh * 0.12, w, hh * 0.62, 2.5);
    drawLoadingTitle(g, title, progress, w, hh);
    label(g, failed ?? (tips.length ? tips[tipIndex % tips.length]! : hint), w / 2, hh * 0.9, { size: 14, maxW: w - 20 });
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
    label(g, detail + (score ? `   ${ICONS.bubbles} ${score}` : ""), w / 2, hh - 7, { size: 12, maxW: w });
  });
  const tipTimer = tips.length > 1
    ? globalThis.setInterval(() => { tipIndex = (tipIndex + 1) % tips.length; titleS.paint(); }, 2800)
    : 0;

  // Presentation-only bubble shooter: neither progress nor asset loading depends on score.
  const bubbles: Bubble[] = [], shots: Shot[] = [];
  let spawnIn = FIRST_SPAWN_MS / 1000, ammo = 0, last = performance.now(), raf = 0;
  const g2 = play.getContext("2d");
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    play.width = root.clientWidth * dpr;
    play.height = root.clientHeight * dpr;
    g2?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(size);
  ro.observe(root);
  size();

  const fire = (e: PointerEvent) => {
    if (e.target !== play) return;
    const r = play.getBoundingClientRect();
    const sx = r.width / 2, sy = r.height - 40;
    const dx = e.clientX - r.left - sx, dy = e.clientY - r.top - sy, d = Math.hypot(dx, dy) || 1;
    shots.push({ x: sx, y: sy, vx: (dx / d) * SHOT_SPEED, vy: (dy / d) * SHOT_SPEED, glyph: AMMO[ammo++ % AMMO.length]! });
  };
  play.addEventListener("pointerdown", fire);

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
    last = now;
    const w = root.clientWidth, height = root.clientHeight;
    if ((spawnIn -= dt) <= 0 && w > 0 && height > 0) {
      spawnIn = SPAWN_MS / 1000;
      const r = 18 + rng() * 12;
      bubbles.push({ x: r + rng() * Math.max(0, w - 2 * r), y: height + r, r, vx: -24 + rng() * 48, vy: -92 + rng() * 38, amp: 8 + rng() * 8, phase: rng() * 6.28, t: 0 });
    }
    for (const b of bubbles) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const s of shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]!;
      const hit = bubbles.findIndex((b) => Math.hypot(b.x + Math.sin(b.t * 3 + b.phase) * b.amp - s.x, b.y - s.y) <= SHOT_R + b.r);
      if (hit >= 0) { bubbles.splice(hit, 1); shots.splice(i, 1); o.onScore?.(++score); barS.paint(); }
      else if (s.x < -40 || s.x > w + 40 || s.y < -40 || s.y > height + 40) shots.splice(i, 1);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i]!.y < -bubbles[i]!.r * 2) bubbles.splice(i, 1);
    if (!g2) return;
    g2.clearRect(0, 0, w, height);
    for (const b of bubbles) {
      const x = b.x + Math.sin(b.t * 3 + b.phase) * b.amp;
      drawFit(g2, "bubble", x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    g2.font = String(SHOT_R * 1.7) + "px system-ui, sans-serif";
    g2.textAlign = "center";
    g2.textBaseline = "middle";
    for (const s of shots) g2.fillText(s.glyph, s.x, s.y);
    drawFit(g2, "joy_knob", w / 2 - 18, height - 58, 36, 36);
    g2.fillText(AMMO[ammo % AMMO.length]!, w / 2, height - 40);
  };
  raf = requestAnimationFrame(tick);

  return {
    el: root,
    setProgress(p, d) {
      progress = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
      if (d !== undefined) detail = d;
      barEl.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      titleS.paint(); barS.paint();
    },
    setCopy(c) { if (c.title) title = c.title; if (c.hint) hint = c.hint; titleS.paint(); },
    fail(message, a) {
      failed = message;
      titleS.paint(); barS.paint();
      actions.replaceChildren(kitButton({ skin: "green", label: a.retryLabel, onClick: () => { failed = null; actions.replaceChildren(); titleS.paint(); a.retry(); } }).el);
    },
    dispose() {
      if (tipTimer) globalThis.clearInterval(tipTimer);
      cancelAnimationFrame(raf);
      titleS.dispose();
      barS.dispose();
      ro.disconnect();
      play.removeEventListener("pointerdown", fire);
      bubbles.length = shots.length = 0;
      root.remove();
    },
  };
}
