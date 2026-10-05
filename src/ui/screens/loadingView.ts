// Loading screen with interactive bubble minigame (spec §4.1, A55.1).
// Canvas-rendered loading bar and floating bubbles.
import { attachChrome, drawPanel } from "../chrome";

export interface LoadingViewOptions {
  onReady: () => void;
}

export function createLoadingView(options: LoadingViewOptions): {
  element: HTMLElement;
  setProgress: (p: number) => void;
  dispose(): void;
} {
  const root = document.createElement("div");
  root.className = "ft-loading-overlay";
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.justifyContent = "center";
  root.style.alignItems = "center";
  root.style.zIndex = "100";
  root.style.userSelect = "none";
  root.style.fontFamily = "sans-serif";
  root.style.pointerEvents = "auto";

  // Background bubble canvas (minigame)
  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.style.position = "absolute";
  bubbleCanvas.style.inset = "0";
  bubbleCanvas.style.width = "100%";
  bubbleCanvas.style.height = "100%";
  root.appendChild(bubbleCanvas);

  interface Bubble {
    x: number;
    y: number;
    r: number;
    vy: number;
    vx: number;
    color: string;
  }
  const bubbles: Bubble[] = [];
  let animId = 0;
  let complete = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { complete = true; cancelAnimationFrame(animId); clearTimeout(timer); window.removeEventListener("resize", resizeBubbles); };

  function resizeBubbles() {
    bubbleCanvas.width = window.innerWidth;
    bubbleCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeBubbles);
  resizeBubbles();

  for (let i = 0; i < 20; i++) {
    bubbles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 12 + Math.random() * 20,
      vy: -(0.5 + Math.random() * 1.5),
      vx: (Math.random() - 0.5) * 0.8,
      color: ["#4fc3f7", "#81c784", "#ffd54f", "#ba68c8"][Math.floor(Math.random() * 4)]!,
    });
  }

  // Click bubble minigame
  bubbleCanvas.addEventListener("pointerdown", (e) => {
    const rect = bubbleCanvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]!;
      const dist = Math.hypot(b.x - px, b.y - py);
      if (dist <= b.r) {
        // Pop! Respawn at bottom
        b.y = window.innerHeight + b.r;
        b.x = Math.random() * window.innerWidth;
        break;
      }
    }
  });

  const ctx = bubbleCanvas.getContext("2d");
  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);

    for (const b of bubbles) {
      b.y += b.vy;
      b.x += b.vx;
      if (b.y < -b.r) {
        b.y = bubbleCanvas.height + b.r;
        b.x = Math.random() * bubbleCanvas.width;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color + "33";
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Highlight
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff99";
      ctx.fill();
      ctx.restore();
    }
    animId = requestAnimationFrame(tick);
  }
  animId = requestAnimationFrame(tick);

  // Center loading box
  const box = document.createElement("div");
  box.style.position = "relative";
  box.style.zIndex = "1";
  box.style.width = "min(380px, 86vw)";
  box.style.padding = "24px";
  box.style.boxSizing = "border-box";
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.alignItems = "center";
  box.style.gap = "14px";
  attachChrome(box, (cvs) => drawPanel(cvs, "stone"));

  const title = document.createElement("h2");
  title.style.margin = "0";
  title.style.color = "#ffd700";
  title.style.fontSize = "20px";
  title.style.letterSpacing = "1px";
  title.textContent = "Đang tải dữ liệu...";
  box.appendChild(title);

  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.color = "#a89b88";
  hint.textContent = "Bấm vào các bong bóng để giải trí!";
  box.appendChild(hint);

  // Canvas progress bar
  const barCanvas = document.createElement("canvas");
  barCanvas.width = 300;
  barCanvas.height = 18;
  barCanvas.style.width = "100%";
  barCanvas.style.height = "18px";
  box.appendChild(barCanvas);

  const bctx = barCanvas.getContext("2d");
  function drawProgress(pct: number) {
    if (!bctx) return;
    const w = barCanvas.width;
    const h = barCanvas.height;
    bctx.clearRect(0, 0, w, h);

    // Frame
    bctx.fillStyle = "#1b140e";
    bctx.fillRect(0, 0, w, h);
    bctx.strokeStyle = "#4a3525";
    bctx.lineWidth = 2;
    bctx.strokeRect(1, 1, w - 2, h - 2);

    // Fill
    const fillW = Math.max(0, Math.min(w - 4, (w - 4) * pct));
    bctx.fillStyle = "#4a8505";
    bctx.fillRect(2, 2, fillW, h - 4);
    bctx.fillStyle = "#8fb347";
    bctx.fillRect(2, 2, fillW, 2);
  }
  drawProgress(0);

  root.appendChild(box);

  const setProgress = (pct: number) => {
    if (complete) return;
    drawProgress(pct);
    if (pct >= 1) {
      complete = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeBubbles);
      timer = setTimeout(options.onReady, 200);
    }
  };

  return { element: root, setProgress, dispose };
}
