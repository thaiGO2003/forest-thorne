// Asset-first UI kit runtime (spec 2.3, A22, A92). All static chrome is PNG art from
// public/assets/ui/generated (built by scripts/gen-ui-kit.mjs) drawn via 9/3-slice on canvas.
// CSS only positions/sizes hosts; colour, chrome and button text live in the art + canvas.

export type ButtonSkin = "green" | "red" | "blue" | "wood" | "plum";
export type ButtonState = "normal" | "hover" | "pressed" | "disabled" | "selected";

/** Source slice (art px) per sliceable asset; must match scripts/gen-ui-kit.mjs geometry. */
export const SLICE = {
  panel_parchment: 8, panel_wood: 8, panel_tooltip: 5, slot_well: 5,
  shell_billboard: 7, tile_status: 7, frame_bar: 3, frame_rage_cell: 2,
  card: 8, btn: 6, btn_icon: 10, ribbon: 16,
} as const;

/** Art-pixel → CSS-pixel factor. Integer keeps pixel art crisp. */
export const ART_SCALE = 2;
export const FONT = `"Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
export const INK = "#1e120a";
export const LABEL = "#fff8ec";

const KIT_DIR = `${import.meta.env.BASE_URL}assets/ui/generated`;
const images = new Map<string, HTMLImageElement>();
const repaint = new Set<() => void>();
let ready: Promise<void> | null = null;

/**
 * Load every kit PNG once (A115: duplicate requests reuse data). Progress reports 0..1.
 * A failed image is skipped; widgets draw nothing for it instead of blanking the app (§37).
 */
export function loadKit(onProgress?: (p: number) => void): Promise<void> {
  if (ready) return ready;
  const attempt = (async () => {
    const res = await fetch(`${KIT_DIR}/manifest.json`);
    const names = (await res.json()) as string[];
    let done = 0;
    await Promise.all(names.map(async (n) => {
      const { promise, resolve } = Promise.withResolvers<void>();
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { images.set(n, img); resolve(); };
      img.onerror = () => resolve();
      img.src = `${KIT_DIR}/${n}.png`;
      await promise;
      onProgress?.(++done / names.length);
    }));
    for (const fn of repaint) fn();
  })();
  let wrapped: Promise<void>;
  wrapped = attempt.catch((error: unknown) => {
    if (ready === wrapped) ready = null;
    throw error;
  });
  ready = wrapped;
  return wrapped;
}

export const kitImage = (name: string) => images.get(name);

/** Redraw hook for non-DOM canvases (3D billboards/bubbles) when kit art finishes loading (A92). */
export function onKitReady(fn: () => void): () => void {
  repaint.add(fn);
  return () => repaint.delete(fn);
}

/** 9-slice draw; corners keep `slice*scale` px, edges/centre stretch. Never distorts borders. */
export function nineSlice(
  g: CanvasRenderingContext2D, name: string, slice: number,
  x: number, y: number, w: number, h: number, scale = ART_SCALE,
) {
  const img = images.get(name);
  if (!img || w <= 0 || h <= 0) return;
  const s = slice, d = Math.min(s * scale, w / 2, h / 2), iw = img.width, ih = img.height;
  const sx = [0, s, iw - s, iw], sy = [0, s, ih - s, ih];
  const dx = [x, x + d, x + w - d, x + w], dy = [y, y + d, y + h - d, y + h];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const sw = sx[i + 1]! - sx[i]!, sh = sy[j + 1]! - sy[j]!, ow = dx[i + 1]! - dx[i]!, oh = dy[j + 1]! - dy[j]!;
    if (sw > 0 && sh > 0 && ow > 0 && oh > 0) g.drawImage(img, sx[i]!, sy[j]!, sw, sh, dx[i]!, dy[j]!, ow, oh);
  }
}

/** Horizontal 3-slice: height scales uniformly, only the middle stretches in x. */
export function threeSlice(g: CanvasRenderingContext2D, name: string, slice: number, x: number, y: number, w: number, h: number) {
  const img = images.get(name);
  if (!img || w <= 0 || h <= 0) return;
  const k = h / img.height, d = Math.min(slice * k, w / 2), s = slice;
  g.drawImage(img, 0, 0, s, img.height, x, y, d, h);
  g.drawImage(img, s, 0, img.width - 2 * s, img.height, x + d, y, w - 2 * d, h);
  g.drawImage(img, img.width - s, 0, s, img.height, x + w - d, y, d, h);
}

/** Whole image stretched into the box (discs, stars, close glyph — authored for uniform scale). */
export function drawFit(g: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number) {
  const img = images.get(name);
  if (img) g.drawImage(img, x, y, w, h);
}

/** Outlined label text (white on dark chrome). `stroke: null` disables the outline (emoji glyphs). */
export function label(
  g: CanvasRenderingContext2D, text: string, x: number, y: number,
  o: { size: number; align?: CanvasTextAlign; fill?: string; stroke?: string | null; weight?: number; maxW?: number },
) {
  g.font = `${o.weight ?? 700} ${o.size}px ${FONT}`;
  g.textAlign = o.align ?? "center";
  g.textBaseline = "middle";
  if (o.stroke !== null) {
    g.lineJoin = "round";
    g.lineWidth = Math.max(2, o.size / 5);
    g.strokeStyle = o.stroke ?? INK;
    g.strokeText(text, x, y, o.maxW);
  }
  g.fillStyle = o.fill ?? LABEL;
  g.fillText(text, x, y, o.maxW);
}

export type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * Canvas surface filling its host element. Redraws on resize, kit load, or `paint()`.
 * Host keeps its own layout (CSS); the canvas sits absolutely behind host children.
 */
export interface Surface { el: HTMLElement; canvas: HTMLCanvasElement; paint(): void; setPainter(p: Painter): void; dispose(): void }

export function surface(el: HTMLElement, painter: Painter): Surface {
  const canvas = document.createElement("canvas");
  canvas.className = "kit-canvas";
  canvas.setAttribute("aria-hidden", "true");
  el.prepend(canvas);
  let p = painter;
  const paint = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    p(g, w, h);
  };
  const ro = new ResizeObserver(paint);
  ro.observe(el);
  repaint.add(paint);
  paint();
  return {
    el, canvas, paint,
    setPainter(np) { p = np; paint(); },
    dispose() { ro.disconnect(); repaint.delete(paint); canvas.remove(); },
  };
}

export type PanelSkin = "panel_parchment" | "panel_wood" | "panel_tooltip" | "slot_well" | "shell_billboard";

/** Panel host: element whose background chrome is a 9-sliced kit image. */
export function panelEl(skin: PanelSkin, cls = ""): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `kit-panel ${cls}`.trim();
  el.dataset.skin = skin;
  surface(el, (g, w, hh) => nineSlice(g, skin, SLICE[skin], 0, 0, w, hh));
  return el;
}

export interface KitButton {
  el: HTMLButtonElement;
  setLabel(text: string): void;
  setIcon(glyph: string | null): void;
  /** Accessible name for icon-only buttons; wins over label/icon when set. */
  setAria(name: string): void;
  setDisabled(v: boolean): void;
  setSelected(v: boolean): void;
}

/**
 * Asset button with all five interaction states (§51). Label/icon render on canvas; the same
 * text goes to aria-label so assistive tech reads the control.
 */
export function kitButton(o: {
  skin?: ButtonSkin | "icon"; label?: string; icon?: string; aria?: string; size?: number; cls?: string;
  onClick?: (e: MouseEvent) => void;
}): KitButton {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `kit-btn ${o.cls ?? ""}`.trim();
  let text = o.label ?? "", icon = o.icon ?? null, aria = o.aria ?? "", disabled = false, selected = false, hover = false, pressed = false;
  const skin = o.skin ?? "wood";
  const s = surface(el, (g, w, hh) => {
    const st: ButtonState = disabled ? "disabled" : pressed ? "pressed" : selected ? "selected" : hover ? "hover" : "normal";
    if (skin === "icon") nineSlice(g, `btn_icon_${st}`, SLICE.btn_icon, 0, 0, w, hh);
    else nineSlice(g, `btn_${skin}_${st}`, SLICE.btn, 0, 0, w, hh);
    const dy = st === "pressed" ? 1 : -1;
    const fill = st === "disabled" ? "#d8d0c4" : LABEL;
    const size = o.size ?? Math.max(12, Math.min(22, hh * 0.42));
    if (icon && text) {
      label(g, icon, hh * 0.5, hh / 2 + dy, { size: size * 1.1, stroke: null });
      label(g, text, (w + hh * 0.6) / 2, hh / 2 + dy, { size, fill, maxW: w - hh - 8 });
    } else if (icon) label(g, icon, w / 2, hh / 2 + dy, { size: Math.min(w, hh) * 0.5, stroke: null });
    else label(g, text, w / 2, hh / 2 + dy, { size, fill, maxW: w - 12 });
  });
  const sync = () => { el.setAttribute("aria-label", aria || text || icon || ""); s.paint(); };
  const flag = (k: "hover" | "pressed", v: boolean) => () => {
    if (k === "hover") { hover = v; if (!v) pressed = false; } else pressed = v;
    s.paint();
  };
  el.addEventListener("pointerenter", flag("hover", true));
  el.addEventListener("pointerleave", flag("hover", false));
  el.addEventListener("focus", flag("hover", true));
  el.addEventListener("blur", flag("hover", false));
  el.addEventListener("pointerdown", flag("pressed", true));
  el.addEventListener("pointerup", flag("pressed", false));
  if (o.onClick) el.addEventListener("click", (e) => { if (!disabled) o.onClick!(e); });
  sync();
  return {
    el,
    setLabel(t) { text = t; sync(); },
    setIcon(gl) { icon = gl; sync(); },
    setAria(n) { aria = n; sync(); },
    setDisabled(v) { disabled = v; el.disabled = v; el.setAttribute("aria-disabled", String(v)); s.paint(); },
    setSelected(v) { selected = v; el.setAttribute("aria-pressed", String(v)); s.paint(); },
  };
}

/** Minus-motif close control (A22: never an X). */
export function closeButton(onClose: () => void, aria: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "kit-btn kit-close";
  el.setAttribute("aria-label", aria);
  let st: "normal" | "hover" | "pressed" = "normal";
  const s = surface(el, (g, w, hh) => drawFit(g, `btn_close_${st}`, 0, 0, w, hh));
  const to = (v: typeof st) => () => { st = v; s.paint(); };
  el.addEventListener("pointerenter", to("hover"));
  el.addEventListener("focus", to("hover"));
  el.addEventListener("pointerleave", to("normal"));
  el.addEventListener("blur", to("normal"));
  el.addEventListener("pointerdown", to("pressed"));
  el.addEventListener("pointerup", to("hover"));
  el.addEventListener("click", onClose);
  return el;
}

/** DOM element factory used by every UI module (3+ call sites, one shape). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
