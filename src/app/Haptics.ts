// Optional tactile feedback helpers (mega prompt A49.1). Safe in unsupported/headless environments.
import type { KV } from "../core/settings";

export const HAPTICS_KEY = "forest-throne.haptics-enabled";

export const HAPTIC_PATTERNS = {
  buy: 15,
  tap: 10,
  starUpgrade: [30, 20, 50],
  victory: [50, 30, 80],
  defeat: [80, 50, 80],
} as const;

export type HapticPreset = keyof typeof HAPTIC_PATTERNS;
export type HapticPattern = number | readonly number[];

export function loadHapticsEnabled(store?: Pick<KV, "getItem"> | null): boolean {
  if (!store) return true;
  try {
    const raw = store.getItem(HAPTICS_KEY);
    if (raw === null) return true;
    if (raw === "false" || raw === "0") return false;
    if (raw === "true" || raw === "1") return true;
    const parsed = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : true;
  } catch {
    return true;
  }
}

export function saveHapticsEnabled(enabled: boolean, store?: Pick<KV, "setItem"> | null): boolean {
  if (!store) return false;
  try {
    store.setItem(HAPTICS_KEY, JSON.stringify(enabled));
    return true;
  } catch {
    return false;
  }
}

function normalizePattern(pattern: HapticPattern): number | number[] {
  if (typeof pattern === "number") {
    return Number.isFinite(pattern) ? Math.max(0, Math.round(pattern)) : 0;
  }
  return pattern.map((value) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0);
}

export function triggerHaptic(
  presetOrPattern: HapticPreset | HapticPattern,
  options: {
    enabled?: boolean;
    vibrate?: ((pattern: number | number[]) => boolean) | null;
  } = {},
): boolean {
  if (options.enabled === false) return false;
  const vibrate = options.vibrate
    ?? (typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
      ? navigator.vibrate.bind(navigator)
      : null);
  if (!vibrate) return false;
  const pattern = typeof presetOrPattern === "string"
    ? HAPTIC_PATTERNS[presetOrPattern]
    : presetOrPattern;
  try {
    return vibrate(normalizePattern(pattern));
  } catch {
    return false;
  }
}
