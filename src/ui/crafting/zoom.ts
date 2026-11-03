// Diagram zoom (issue #35). Pure state math so the wiring in library.ts stays thin and the
// clamp/label behaviour is testable without a DOM.
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.2;
export const ZOOM_DEFAULT = 1;

export type ZoomCommand = "in" | "out" | "reset";

const round = (value: number) => Math.round(value * 100) / 100;

export const clampZoom = (value: number): number => {
  if (!Number.isFinite(value)) return ZOOM_DEFAULT;
  return round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));
};

export function nextZoom(current: number, command: ZoomCommand): number {
  if (command === "reset") return ZOOM_DEFAULT;
  const base = clampZoom(current);
  return clampZoom(command === "in" ? base + ZOOM_STEP : base - ZOOM_STEP);
}

export const zoomPercent = (value: number): number => Math.round(clampZoom(value) * 100);

/** Wheel/keyboard intent → command, so the listeners and the tests share one mapping. */
export function commandFromWheel(deltaY: number): ZoomCommand | null {
  if (!Number.isFinite(deltaY) || deltaY === 0) return null;
  return deltaY < 0 ? "in" : "out";
}

export function commandFromKey(key: string): ZoomCommand | null {
  if (key === "+" || key === "=") return "in";
  if (key === "-" || key === "_") return "out";
  if (key === "0") return "reset";
  return null;
}
