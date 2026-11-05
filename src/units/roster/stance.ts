// Shared pose helpers for the straight-legged concept-sheet rigs (Hổ Nanh, Sói Thủ Lĩnh, Cá Sấu Đầm,
// Cú Đêm). Allocation-free; every helper only adds to the rest pose the runtime resets each frame.
import type { Part, V3 } from "../kit";
import { bell, ramp } from "../rig";

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
export const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/** Freeze progress at `a` over [a, b] (impact hold), compressing the rest so the end stays at 1. */
export const hold = (p: number, a: number, b: number) => (p < a ? p : p < b ? a : a + ((p - b) * (1 - a)) / (1 - b));

/** 0 open → 1 shut, ~3.6 s cadence offset per unit. */
export const blinkAt = (time: number, sig: number) => bell((time + sig * 5.3) % 3.6, 0, 0.14);

/** Deterministic 0..2 beat pick so combat idles never loop the same order. */
function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}
/** Cross-faded weights of three combat-idle beats, written into `out`. */
export function beats(out: number[], time: number, sig: number, salt: number) {
  const s = time * 0.38 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  for (let i = 0; i < 3; i++) out[i] = (a === i ? 1 - m : 0) + (b === i ? m : 0);
}

/**
 * A straight leg hanging from a hip pivot at `at` (body-local) with length `len`; the sole box spans
 * `toe` voxels ahead of and `heel` behind the leg axis.
 */
export interface Leg { part: Part; at: V3; len: number; toe: number; heel: number }

/**
 * Keep a leg's sole on or above y=0 after the body pivot moved to world height `y`, pitched `th`
 * (rotation.x) and rolled `roll` (rotation.z), and slid `dz` forward. The leg is counter-rotated so it
 * stays vertical, leaned so a planted sole does not slide, then shortened (never stretched) to reach.
 * `swing` adds a deliberate forward/back swing, `lift` raises the sole off the ground.
 */
export function plantLeg(l: Leg, y: number, th: number, roll: number, dz: number, swing = 0, lift = 0, minScale = 0.15) {
  const a = swing + Math.asin(clamp(dz / l.len, -0.7, 0.7));
  const hipY = y + (l.at[0] * Math.sin(roll) + l.at[1] * Math.cos(roll)) * Math.cos(th) - l.at[2] * Math.sin(th);
  l.part.group.rotation.x += a - th;
  l.part.group.rotation.z -= roll;
  const dip = (a > 0 ? l.toe : l.heel) * Math.abs(Math.sin(a)) + 0.1;
  l.part.group.scale.y = clamp((hipY - lift - dip) / (l.len * Math.max(0.2, Math.cos(a))), minScale, 1);
}

/** Lagged wave down a chain of segments (tails): `amp` side sway, `lift` root pitch, `curl` per joint. */
export function chainWave(chain: readonly Part[], time: number, amp: number, speed: number, lift: number, curl: number, lag = 0.07) {
  for (let i = 0; i < chain.length; i++) {
    const g = chain[i]!.group, tt = time - i * lag;
    g.rotation.y += Math.sin(tt * speed) * amp * (0.35 + i * 0.15);
    g.rotation.x += (i === 0 ? lift : curl) + Math.sin(tt * speed * 0.63 + 1.1) * amp * 0.15;
  }
}

/** Show a VFX part only while `k` > 0.02, scaled by `k` (never allocates). */
export function vfx(p: Part, k: number, base = 1) {
  const on = k > 0.02;
  p.group.visible = on;
  if (on) p.group.scale.setScalar(base * k);
}
