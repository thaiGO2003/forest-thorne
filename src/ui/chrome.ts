import { ownCleanup } from "./lifecycle";
// Asset-first canvas chrome renderer (spec §2.3, AGENTS.md).
// CSS is reserved strictly for geometry and layout; chrome is painted to 2D Canvas.

export type ButtonState = "normal" | "hover" | "active" | "disabled";
export type ButtonVariant = "primary" | "secondary" | "danger" | "wood";
export type PanelStyle = "parchment" | "darkwood" | "stone" | "metal";

export function drawPanel(canvas: HTMLCanvasElement, style: PanelStyle = "darkwood"): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pad = 4;

  if (style === "darkwood") {
    ctx.fillStyle = "#1b140e";
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.strokeStyle = "#251b13";
    ctx.lineWidth = 1;
    for (let y = pad + 10; y < h - pad; y += 14) {
      ctx.beginPath();
      ctx.moveTo(pad + 4, y);
      ctx.lineTo(w - pad - 4, y);
      ctx.stroke();
    }
  } else if (style === "parchment") {
    ctx.fillStyle = "#2c2217";
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  } else if (style === "stone") {
    ctx.fillStyle = "#161c24";
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  } else {
    ctx.fillStyle = "#12171f";
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
  }

  // Outer metallic/carved border
  ctx.strokeStyle = style === "metal" ? "#58697f" : "#4a3525";
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

  // Inner highlight border
  ctx.strokeStyle = style === "metal" ? "#38475a" : "#6e5038";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 2, pad + 2, w - pad * 2 - 4, h - pad * 2 - 4);

  // Rivet corners
  const rivets = [
    [pad + 5, pad + 5],
    [w - pad - 5, pad + 5],
    [pad + 5, h - pad - 5],
    [w - pad - 5, h - pad - 5],
  ];
  ctx.fillStyle = "#d4af37";
  for (const [rx, ry] of rivets) {
    if (rx !== undefined && ry !== undefined) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawButton(
  canvas: HTMLCanvasElement,
  state: ButtonState = "normal",
  variant: ButtonVariant = "wood",
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pad = 2;
  const bw = w - pad * 2;
  const bh = h - pad * 2;

  let bg = "#2e2116";
  let border = "#6c4d32";
  let highlight = "#8c6544";
  let shadow = "#18110b";

  if (state === "disabled") {
    bg = "#1f1d1b";
    border = "#3a3633";
    highlight = "#4a4642";
    shadow = "#121110";
  } else if (variant === "primary") {
    bg = state === "hover" ? "#3b4a24" : state === "active" ? "#222c15" : "#2d3b1b";
    border = state === "hover" ? "#8fb347" : "#6a8832";
    highlight = "#a8d254";
    shadow = "#141b0c";
  } else if (variant === "danger") {
    bg = state === "hover" ? "#5a231f" : state === "active" ? "#341412" : "#451a17";
    border = state === "hover" ? "#b84840" : "#8c342e";
    highlight = "#d45850";
    shadow = "#200b09";
  } else {
    bg = state === "hover" ? "#3d2d1f" : state === "active" ? "#221810" : "#2e2116";
    border = state === "hover" ? "#8c6544" : "#6c4d32";
    highlight = "#a67952";
    shadow = "#18110b";
  }

  // Base fill
  ctx.fillStyle = bg;
  ctx.fillRect(pad, pad, bw, bh);

  // Bevel
  ctx.fillStyle = state === "active" ? shadow : highlight;
  ctx.fillRect(pad, pad, bw, 2);
  ctx.fillRect(pad, pad, 2, bh);

  ctx.fillStyle = state === "active" ? highlight : shadow;
  ctx.fillRect(pad, pad + bh - 2, bw, 2);
  ctx.fillRect(pad + bw - 2, pad, 2, bh);

  // Border
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, pad + 0.5, bw - 1, bh - 1);

  if (state !== "disabled") {
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(pad + 1, pad + 1, 2, 2);
    ctx.fillRect(pad + bw - 3, pad + 1, 2, 2);
    ctx.fillRect(pad + 1, pad + bh - 3, 2, 2);
    ctx.fillRect(pad + bw - 3, pad + bh - 3, 2, 2);
  }
}

export function drawBadge(canvas: HTMLCanvasElement, tier = 1): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const colors = ["#8a8a8a", "#4a8505", "#1976d2", "#8e24aa", "#e65100", "#ffd700"];
  const c = colors[tier - 1] ?? colors[0]!;

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Attaches an auto-resizing background canvas to any HTML element.
 * The canvas stays sized to match client dimensions * devicePixelRatio.
 */
export function attachChrome(
  el: HTMLElement,
  draw: (canvas: HTMLCanvasElement) => void,
): () => void {
  const position = getComputedStyle(el).position;
  if (!position || position === "static") el.style.position = "relative";
  const canvas = document.createElement("canvas");
  canvas.className = "ui-chrome-canvas";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  el.style.isolation = "isolate";
  canvas.style.zIndex = "-1";

  el.insertBefore(canvas, el.firstChild);

  const update = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    draw(canvas);
  };

  const observer = new ResizeObserver(update);
  observer.observe(el);
  update();

  return ownCleanup(el, () => {
    observer.disconnect();
    canvas.remove();
  });
}

/**
 * Helper to make a button with reactive canvas chrome state (normal, hover, active, disabled).
 */
const buttonCleanups = new WeakMap<HTMLButtonElement, () => void>();
export function setupButtonChrome(btn: HTMLButtonElement, variant: ButtonVariant = "wood"): () => void {
  buttonCleanups.get(btn)?.();
  btn.style.background = "transparent";
  btn.style.border = "0";
  let state: ButtonState = btn.disabled ? "disabled" : "normal";

  const teardown = attachChrome(btn, (cvs) => drawButton(cvs, state, variant));

  const onEnter = () => { if (!btn.disabled) { state = "hover"; btn.querySelector("canvas") && drawButton(btn.querySelector("canvas")!, state, variant); } };
  const onLeave = () => { if (!btn.disabled) { state = "normal"; btn.querySelector("canvas") && drawButton(btn.querySelector("canvas")!, state, variant); } };
  const onDown = () => { if (!btn.disabled) { state = "active"; btn.querySelector("canvas") && drawButton(btn.querySelector("canvas")!, state, variant); } };
  const onUp = () => { if (!btn.disabled) { state = "hover"; btn.querySelector("canvas") && drawButton(btn.querySelector("canvas")!, state, variant); } };

  btn.addEventListener("pointerenter", onEnter);
  btn.addEventListener("pointerleave", onLeave);
  btn.addEventListener("pointerdown", onDown);
  btn.addEventListener("pointerup", onUp);

  const release = ownCleanup(btn, () => {
    btn.removeEventListener("pointerenter", onEnter);
    btn.removeEventListener("pointerleave", onLeave);
    btn.removeEventListener("pointerdown", onDown);
    btn.removeEventListener("pointerup", onUp);
    teardown();
  });
  buttonCleanups.set(btn, release);
  return release;
}
