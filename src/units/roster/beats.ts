// Small timing helpers shared by the November 2026 roster reworks (snake, beetle, monkey, pumpkin,
// deer, squirrel). Older rigs keep their own local copies; these are the same curves.
import { bell, ramp } from "../rig";

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 1 inside [a, b] with `e`-wide smooth edges. */
export const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
/** Deterministic blink pulse (0..1) every ~3.3 s, phase-shifted by the unit signature. */
export const blinkAt = (time: number, sig: number) => bell((time + sig * 5.9) % 3.3, 0, 0.14);

function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

/** Combat idle: three deterministic beats cross-faded over time. Returns weights [a, b, c] summing to 1. */
export function beats(time: number, sig: number, salt: number): [number, number, number] {
  const s = time * 0.38 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  const w: [number, number, number] = [0, 0, 0];
  w[a] += 1 - m;
  w[b] += m;
  return w;
}
