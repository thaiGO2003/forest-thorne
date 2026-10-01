// Tactical camera framing + pan math (spec A91.1). Pure; the Three.js layer applies results.
import { totalRows, VISUAL_COLS, type Profile } from "../board/geometry";

export const FOV = 45;
export const NEAR = 0.1;
export const FAR = 1000;
export const MIN_DISTANCE = 6;
export const BASE_MAX_DISTANCE = 50;
export const DOLLY_HEADROOM = 5;
export const MAX_POLAR = Math.PI / 2.05;
const MIN_ASPECT = 0.55;
const MARGIN = 1.18;
/** Bench perimeter sits 2 blocks outside the battlefield on every side. */
const OUTER = 2;

export const PAN = { speed: 9, clamp: 24, maxDt: 0.05, deadzone: 0.02, joystickRadius: 44 } as const;

/** Distance needed to show battlefield + river + bench perimeter for this profile and aspect. */
export function framingDistance(p: Profile, aspect: number): number {
  const width = VISUAL_COLS + OUTER * 2;
  const depth = totalRows(p) + OUTER * 2;
  const span = Math.max(depth, width / Math.max(aspect, MIN_ASPECT)) * MARGIN;
  return span / 2 / Math.tan((FOV * Math.PI) / 360);
}

/** Dolly ceiling always reaches framing distance + headroom (never cropped by a solo constant). */
export const maxDistance = (p: Profile, aspect: number) =>
  Math.max(BASE_MAX_DISTANCE, framingDistance(p, aspect) + DOLLY_HEADROOM);

/** Smoothstep p²(3-2p) used for profile reframing; p clamped to 0..1. */
export const smoothstep = (p: number) => { const t = Math.min(1, Math.max(0, p)); return t * t * (3 - 2 * t); };

/** One pan update: normalized diagonal, deadzone, dt cap, target clamp. Returns new target x/z. */
export function panStep(x: number, z: number, ix: number, iz: number, dt: number): { x: number; z: number } {
  const mag = Math.hypot(ix, iz);
  if (mag < PAN.deadzone || dt <= 0) return { x, z };
  const k = (PAN.speed * Math.min(dt, PAN.maxDt)) / Math.max(1, mag);
  const c = (v: number) => Math.min(PAN.clamp, Math.max(-PAN.clamp, v));
  return { x: c(x + ix * k), z: c(z + iz * k) };
}
