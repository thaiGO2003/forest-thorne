// Cóc Độc (toad_poison) — bespoke rig from the approved reference sheet (art/drafts/coc-doc.jxl).
// Squat lime toad, dark blotches + warts, cream/pink throat sac, angry yellow eyes, purple poison sacs.
// Idle: sit low → blink → throat puff → sac shiver, with blinks and breathing through the throat.
// Combat idle: watch / poison breath / alert, picked per beat by a deterministic hash (never a fixed loop).
// Move: shuffle steps (Bước 1/2) blending into fast hops. Attack: rear back → spit orb at impact → settle.
// Skill (Sương Độc): gather toxin → throat swells → three sweeping sprays (one per pool) → mist spreads →
// settle. Hit: flinch → recoil → inhale. Death: slump → lie flat with a last breath → dissolve.
// 2★ adds a leather strap + pouch and more sacs; 3★ adds a leaf crown, glowing toxin drops and a twig.
//
// The body pivot sits on the ground, so scale-based squash never sinks the feet; translations and pitch
// are compensated per limb by `plant` (verified by tests/toad-poison-rig.test.ts).
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  green: 0x8cc63f, greenD: 0x5f8f2a, greenL: 0xa8d65a, spot: 0x3a3524, wart: 0x5c5045,
  cream: 0xf2e6cf, pink: 0xe9a7bf, mouth: 0xc65a7a,
  purple: 0x9b40d6, purpleL: 0xcf8cff, purpleD: 0x6a2a9a,
  yellow: 0xffd43b, ink: 0x1e120a, claw: 0xf4f1ea, leather: 0x6b4226, leatherD: 0x3b2414,
  leaf: 0x4caf50, leafL: 0x7fd65a, toxin: 0xb6ff4a, twig: 0x8f5b32,
};

/** Limb rest pivots (body space): arms forward, legs at the hips. */
const ARM_AT: readonly [number, number, number] = [2.8, 1.4, 2.2];
const LEG_AT: readonly [number, number, number] = [3.4, 1.2, -1.5];
/** Lid scale when open: the lid folds up under the brow. */
const LID_OPEN = 0.05;
/** Seconds of follow-through lag between consecutive poison sacs. */
const SAC_LAG = 0.06;

interface ToadParts {
  body: Part; head: Part; jaw: Part; lids: Part; throat: Part;
  armL: Part; armR: Part; legL: Part; legR: Part; sacs: Part[];
}

/** Rounded voxel blob for a poison sac: core cube + three cross slabs + highlight. */
function sac(p: Part, r: number) {
  p.box([0, 0, 0], [r * 2, r * 2, r * 2], C.purple)
    .box([0, 0, 0], [r * 2.4, r * 1.5, r * 1.5], C.purple)
    .box([0, 0, 0], [r * 1.5, r * 2.4, r * 1.5], C.purpleD)
    .box([0, 0, 0], [r * 1.5, r * 1.5, r * 2.4], C.purple)
    .box([-r * 0.35, r * 0.75, r * 0.55], [r * 0.6, r * 0.5, r * 0.6], C.purpleL);
}

// ---------- allocation-free pose helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/**
 * Keep a limb's foot on the ground after the body moved by `dy` (≤0 lowers) and pitched by `pitch`
 * (+ = nose down) about its ground pivot: shift the limb up/down by the drop at its pivot and
 * counter-rotate it so the sole stays level.
 */
function plantLimb(limb: Part, at: readonly [number, number, number], dy: number, pitch: number, sy: number, sz: number) {
  const s = Math.sin(pitch), co = Math.cos(pitch);
  // World height change of the (scaled) limb pivot when the body rotates by `pitch` about the ground origin.
  const y = at[1] * sy, z = at[2] * sz;
  const pivotDrop = y - (y * co - z * s);
  // Offsets are authored in body space, which the body scale stretches: divide it back out.
  limb.group.position.y += (-dy + pivotDrop) / sy;
  limb.group.rotation.x -= pitch;
}
/** Call after the body's scale for this frame is set. */
function plant(r: ToadParts, dy: number, pitch: number) {
  const sy = r.body.group.scale.y, sz = r.body.group.scale.z;
  plantLimb(r.armL, ARM_AT, dy, pitch, sy, sz); plantLimb(r.armR, ARM_AT, dy, pitch, sy, sz);
  plantLimb(r.legL, LEG_AT, dy, pitch, sy, sz); plantLimb(r.legR, LEG_AT, dy, pitch, sy, sz);
}

/**
 * Body lift that keeps the belly/throat corners above ground when the body pitches about its ground
 * pivot: nose-up drops the rump corner (z ≈ -3.5), nose-down drops the throat corner (z ≈ 3.9, y ≈ 0.3).
 */
const pitchLift = (pitch: number) => pitch < 0 ? 3.6 * Math.sin(-pitch) : Math.max(0, 3.9 * Math.sin(pitch) - 0.3);

/**
 * Pitch the body about its ground pivot and lift it just clear of the ground, re-planting every foot.
 * `airborne` adds a jump height that the feet travel with (they are not re-planted for it).
 */
function pitchBody(r: ToadParts, pitch: number, airborne = 0) {
  const lift = pitchLift(pitch);
  r.body.group.rotation.x = pitch;
  r.body.group.position.y += lift + airborne;
  plant(r, lift, pitch);
}

/** Shuffle step lift for the limb whose slot starts at `offset` in the 4-beat cycle. */
const stepAt = (cycle: number, offset: number) => bell((cycle + offset) % 1, 0, 0.25);

/** 0 open → 1 shut. ~3.4 s cadence with an occasional double blink, offset per unit. */
function blinkAt(time: number, sig: number): number {
  const u = time + sig * 7, a = u % 3.4;
  const second = u % 10.2 < 3.4 ? bell(a, 0.22, 0.36) : 0;
  return Math.max(bell(a, 0, 0.14), second);
}

/** Sac jiggle with per-sac time lag so a shiver ripples across the back instead of pulsing in sync. */
function sacWobble(sacs: readonly Part[], time: number, amp: number, speed: number, base = 0) {
  for (let i = 0; i < sacs.length; i++) {
    const g = sacs[i]!.group, w = Math.sin((time - i * SAC_LAG) * speed + i * 1.7);
    g.scale.setScalar(1 + base + w * amp);
    g.rotation.z = w * amp * 0.8;
  }
}

/** Throat half-height (cream box) below its pivot: the bottom sits at y ≈ 0.3 at rest. */
const THROAT_HALF = 1.3;
/** Throat sac puff: 0 = rest, 1 ≈ the big idle inflation. The bottom is anchored, so it bulges up/out. */
function puffThroat(throat: Part, k: number) {
  const sy = 1 + Math.max(-0.3, k) * 0.7;
  throat.group.scale.set(1 + k * 0.35, sy, 1 + k * 0.9);
  throat.group.position.y += THROAT_HALF * (sy - 1);
}

/** Deterministic beat pick for combat idle: 0 watch · 1 poison breath · 2 alert. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.floor(sig * 6151);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

export default defineUnit<ToadParts>({
  id: "toad_poison",
  motion: "ground",
  height: 7,
  durations: { idle: 4, attack: 0.95, skill: 1.7, hit: 0.5, move: 0.7 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body");
    // Torso: squat pear, low to the ground, slightly wider at the hips.
    body.box([0, 2.6, -0.3], [7.2, 4.2, 6.4], C.green)
      .box([0, 0.9, 0.4], [6.0, 1.4, 5.6], C.greenD)
      .box([0, 4.9, -0.8], [5.4, 0.6, 4.6], C.green)
      .spots([0, 2.6, -0.3], [7.2, 4.2, 6.4], C.spot, 22, 11, 1.1)
      .spots([0, 4.9, -0.8], [5.4, 0.6, 4.6], C.wart, 9, 5, 0.8);

    const head = k.part("head", body, [0, 3.6, 2.2]);
    head.box([0, 0.6, 0.8], [6.6, 2.6, 3.6], C.green)
      .box([0, -0.62, 2.58], [6.0, 0.25, 0.2], C.ink) // mouth line
      .pair([0.6, 1.0, 2.64], [0.3, 0.25, 0.12], C.ink) // nostrils
      .pair([2.0, 2.0, 1.6], [1.5, 1.4, 1.4], C.yellow) // bulging eyes on top
      .pair([1.75, 1.9, 2.33], [0.8, 0.8, 0.12], C.ink) // pupils
      .pair([2.1, 2.85, 1.8], [1.9, 0.6, 1.3], C.greenD, { rot: [0, 0, 0.35] }) // angry brows
      .spots([0, 0.6, 0.6], [6.6, 2.6, 3.2], C.spot, 8, 23, 0.9);

    const lids = k.part("lids", head, [0, 2.75, 1.6]);
    lids.pair([2.0, -0.75, 0.05], [1.6, 1.5, 1.5], C.greenD);

    const jaw = k.part("jaw", head, [0, -0.5, -0.4]);
    jaw.box([0, -0.4, 1.3], [6.2, 0.9, 3.4], C.green)
      .box([0, 0.1, 1.4], [5.2, 0.2, 2.8], C.mouth)
      .box([0, 0.25, 1.0], [2.0, 0.3, 1.8], C.pink); // tongue

    const throat = k.part("throat", body, [0, 1.6, 3.0]);
    throat.box([0, 0, 0.2], [4.6, 2.6, 1.4], C.cream)
      .box([0, -0.5, 0.55], [3.6, 1.4, 1.0], C.pink);

    // Front arms: planted forward, three white toe claws each.
    const arm = (side: 1 | -1) => {
      const a = k.part(side > 0 ? "armR" : "armL", body, [side * ARM_AT[0], ARM_AT[1], ARM_AT[2]]);
      a.box([0, -0.25, 0], [1.4, 2.3, 1.4], C.green) // bottom flush with the foot (was 0.1 under the ground)
        .box([side * 0.2, -1.1, 0.6], [1.9, 0.6, 2.0], C.greenD);
      for (const dx of [-0.6, 0, 0.6]) a.box([side * 0.2 + dx, -1.2, 1.75], [0.35, 0.4, 0.4], C.claw);
      return a;
    };
    // Hind legs: big folded thighs at the hips, wide webbed feet.
    const leg = (side: 1 | -1) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * LEG_AT[0], LEG_AT[1], LEG_AT[2]]);
      l.box([0, 0.3, 0], [2.2, 2.6, 3.4], C.green)
        .spots([0, 0.3, 0], [2.2, 2.6, 3.4], C.spot, 5, side > 0 ? 31 : 37, 0.9)
        .box([side * 0.2, -0.9, 1.3], [2.4, 0.6, 2.6], C.greenD);
      for (const dx of [-0.7, 0, 0.7]) l.box([side * 0.2 + dx, -1.0, 2.7], [0.4, 0.4, 0.45], C.claw);
      return l;
    };

    // Poison sacs: count grows with star (3 → 5 → 6), each its own pivot for wobble.
    const SAC_SPOTS: [number, number, number, number][] = [
      [-3.5, 3.5, -1.0, 1.05], [3.6, 2.9, -0.2, 1.15], [1.3, 5.2, -2.2, 0.95],
      [-1.6, 5.0, -2.8, 0.85], [3.2, 4.4, -2.6, 0.8], [-3.0, 2.2, -3.0, 0.75],
    ];
    const sacs = SAC_SPOTS.slice(0, star === 1 ? 3 : star === 2 ? 5 : 6).map(([x, y, z, r], i) => {
      const s = k.part(`sac${i}`, body, [x, y, z]);
      sac(s, r);
      return s;
    });

    if (star >= 2) {
      // Leather strap across the back + side pouch.
      body.box([0, 4.4, -0.3], [7.6, 0.6, 1.0], C.leather, { rot: [0, 0.5, 0] })
        .box([-3.7, 2.6, 0.8], [0.6, 1.6, 1.6], C.leather)
        .box([-3.95, 3.0, 0.8], [0.15, 0.4, 1.2], C.leatherD);
    }
    if (star >= 3) {
      // Leaf crown with glowing toxin drops + twig strapped on the back.
      for (const [x, z, h, rz] of [[-1.6, 0.9, 1.6, 0.4], [0, 0.6, 2.1, 0], [1.6, 0.9, 1.6, -0.4]] as const) {
        head.box([x, 2.6 + h / 2, z], [0.9, h, 0.5], C.leaf, { rot: [0, 0, rz] })
          .box([x, 2.7 + h, z], [0.5, 0.5, 0.5], C.leafL);
      }
      head.box([-0.9, 3.4, 0.2], [0.4, 0.4, 0.4], C.toxin, { mat: "glow" })
        .box([1.0, 3.6, 0.3], [0.35, 0.35, 0.35], C.toxin, { mat: "glow" });
      body.box([1.0, 5.6, -1.6], [0.6, 0.6, 6.0], C.twig, { rot: [0.35, 0.2, 0] });
      for (const s of sacs) s.box([0, 0, 0], [0.5, 0.5, 0.5], C.toxin, { mat: "glow" });
    }

    return { body, head, jaw, lids, throat, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), sacs };
  },

  pose(r, c) {
    const { body, head, jaw, lids, throat, armL, armR, legL, legR, sacs } = r;
    const T = c.time;
    // Signature: this toad breathes slow and deep through the throat.
    const slow = T * (0.9 + c.sig * 0.2);
    let lid = blinkAt(T, c.sig);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: crouched, feet planted; beats cross-fade watch / poison breath / alert.
          const s = T * 0.36 + c.sig * 2.7, n = Math.floor(s), f = s - n, m = ramp(f, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const watch = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const breath = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const alert = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          // Crouch is a squash anchored at the ground pivot (a translation would sink the belly).
          body.group.scale.y = 0.92 - 0.04 * alert + Math.sin(T * 2.4) * 0.015;
          body.group.scale.x = 1.03 + 0.02 * alert;
          pitchBody(r, 0.04 + 0.03 * alert);
          head.group.rotation.x = 0.04 - 0.08 * alert;
          // Watch: slow scan with two incommensurate sines; alert locks forward.
          head.group.rotation.y = (Math.sin(T * 0.8 + c.sig * 5) * 0.22 + Math.sin(T * 2.1 + 1) * 0.05) * (1 - 0.7 * alert);
          const puff = 0.12 + Math.sin(T * 3) * 0.05 + breath * (0.25 + Math.sin(T * 4.2) * 0.12);
          puffThroat(throat, puff);
          jaw.group.rotation.x = 0.05 + breath * (0.16 + Math.max(0, Math.sin(T * 4.2)) * 0.1) + Math.max(0, Math.sin(T * 2.2)) * 0.05 * watch;
          lid = Math.max(lid, 0.3 * alert + 0.15 * watch);
          sacWobble(sacs, T, 0.05 + 0.04 * breath, 6 + 3 * alert, 0.04 * breath);
        } else {
          // Inspection idle: sit low (0–.25) → blink (.25–.45) → throat puff (.45–.75) → sac shiver (.75–1).
          // p settles at 1 (≡ sit) so the held idle matches where the cycle starts and ends.
          const ph = c.p % 1;
          const blinkBeat = win(ph, 0.25, 0.45, 0.04), puffBeat = win(ph, 0.45, 0.76, 0.08), shiver = win(ph, 0.74, 1, 0.05);
          const settle = Math.sin(slow * 2) * 0.02;
          body.group.scale.y = 1 + settle + puffBeat * 0.03;
          body.group.scale.x = 1 - puffBeat * 0.01 + shiver * Math.sin(c.t * 30) * 0.008;
          head.group.rotation.x = Math.sin(slow * 0.7) * 0.04 - puffBeat * 0.08;
          head.group.rotation.z = blinkBeat * Math.sin(ph * Math.PI * 5) * 0.06; // curious head tilt
          lid = Math.max(lid, blinkBeat * Math.max(bell(ph, 0.28, 0.34), bell(ph, 0.36, 0.42)));
          puffThroat(throat, Math.max(0.06 + Math.sin(slow * 2) * 0.04, puffBeat * (0.55 + Math.sin(c.t * 9) * 0.05)));
          jaw.group.rotation.x = shiver * 0.04;
          // Sac shiver: lagged per sac so it ripples; quiet wobble otherwise.
          sacWobble(sacs, T, 0.03 + shiver * 0.1, 3.5 + shiver * 20);
        }
        break;
      }
      case "move": {
        // No velocity reaches PoseCtx (callers only play("move")), so gait is a deterministic blend:
        // combat movement is always a hop dash; out of combat the toad shuffles (Bước 1/2) and breaks
        // into fast hops after ~0.55–1.25 s of sustained movement (c.p 0.8 → 1.8 cycles).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        // Hop: two low hops per cycle; hind legs drive, arms reach, body pitches up then lands.
        const hop = (c.p * 2) % 1, air = bell(hop, 0.1, 0.8), land = bell(hop, 0.78, 1);
        // Shuffle: one limb lifts at a time (LH → LF → RH → RF) over a slower cycle; weight shifts via a
        // ground-anchored squash and the head, never a roll (a roll would dip the low-side foot).
        const sh = (c.p * 0.5) % 1;
        const sway = Math.sin(sh * Math.PI * 4);
        body.group.scale.y = 1 - g * land * 0.12 + g * air * 0.05 - wk * Math.abs(sway) * 0.02;
        body.group.scale.x = 1 + wk * Math.abs(sway) * 0.015;
        pitchBody(r, g * (-air * 0.25 + land * 0.08), g * air * 2.6);
        legL.group.rotation.x -= g * air * 0.9;
        legR.group.rotation.x -= g * air * 0.9;
        legL.group.position.z += -g * air * 1.2;
        legR.group.position.z += -g * air * 1.2;
        armL.group.rotation.x -= g * air * 0.6;
        armR.group.rotation.x -= g * air * 0.6;
        // Shuffle lifts (raise only, so the planted feet never dip).
        legL.group.position.y += wk * stepAt(sh, 0) * 0.7;
        armL.group.position.y += wk * stepAt(sh, 0.25) * 0.6;
        legR.group.position.y += wk * stepAt(sh, 0.5) * 0.7;
        armR.group.position.y += wk * stepAt(sh, 0.75) * 0.6;
        armL.group.rotation.x -= wk * stepAt(sh, 0.25) * 0.3;
        armR.group.rotation.x -= wk * stepAt(sh, 0.75) * 0.3;
        head.group.rotation.x = wk * Math.sin(sh * Math.PI * 4 + 0.6) * 0.04 + g * air * 0.1;
        head.group.rotation.y = wk * Math.sin(sh * Math.PI * 2) * 0.1;
        head.group.rotation.z = wk * sway * 0.05;
        puffThroat(throat, 0.08 + g * air * 0.2);
        sacWobble(sacs, T, 0.04 + g * 0.08, 6 + g * 5);
        break;
      }
      case "attack": {
        // Chuẩn bị (0–.42) → Phóng độc cầu (impact .5) → Hoàn tất (overshoot settle).
        const p = c.p;
        const wind = ramp(p, 0, 0.42) * (1 - ramp(p, 0.42, 0.5));
        const spit = ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.6, 0.88));
        const settle = bell(p, 0.8, 1);
        body.group.scale.y = 1 + 0.05 * wind - 0.05 * spit;
        pitchBody(r, -0.1 * wind + 0.08 * spit - 0.03 * settle);
        head.group.rotation.x = -0.32 * wind + 0.12 * spit + 0.05 * settle;
        head.group.position.z += 0.8 * spit;
        // Jaw clenched while loading, wide open exactly through the impact frame.
        jaw.group.rotation.x = 0.03 * wind + 0.75 * ramp(p, 0.44, 0.5) * (1 - ramp(p, 0.58, 0.8));
        puffThroat(throat, 0.75 * wind + 0.1 * (1 - ramp(p, 0.5, 0.65)) * spit);
        lid = Math.max(lid, 0.35 * wind);
        sacWobble(sacs, T, 0.05 + 0.06 * spit, 9, 0.06 * wind - 0.05 * spit);
        break;
      }
      case "skill": {
        // Sương Độc: Tụ độc (0–.22) → Phình họng (.2–.45) → Phun sương (.45–.62, impact .55, three
        // sweeps = three pools) → Lan độc (.62–.82) → Kết thúc (.82–1).
        const p = c.p;
        const gather = win(p, 0, 0.47, 0.08);
        const swell = ramp(p, 0.18, 0.45) * (1 - ramp(p, 0.47, 0.62));
        const spray = win(p, 0.45, 0.84, 0.05);
        const spread = win(p, 0.6, 0.86, 0.06);
        const end = bell(p, 0.82, 1);
        body.group.scale.y = 1 + swell * 0.08 - spray * 0.03;
        body.group.scale.x = 1 + swell * 0.04;
        pitchBody(r, -0.08 * swell + 0.07 * spray - 0.03 * end);
        puffThroat(throat, swell * 1.5 + spray * 0.15 * (1 - spread));
        // Head tips up to throw the mist outward; a wide jaw on a lowered head would scrape the ground.
        head.group.rotation.x = -swell * 0.25 - spray * 0.1;
        // Three sweeps across the field during the spray, widening as the mist spreads.
        const sweep = clamp01((p - 0.45) / 0.37);
        head.group.rotation.y = Math.sin(sweep * Math.PI * 3) * spray * (0.18 + 0.12 * spread);
        jaw.group.rotation.x = spray * (0.8 + Math.sin(c.t * 26) * 0.05) + 0.04 * gather;
        lid = Math.max(lid, 0.3 * swell + 0.2 * spray);
        // Sacs pump while gathering (lagged ripple), squeeze empty as the mist leaves.
        for (let i = 0; i < sacs.length; i++) {
          const g = sacs[i]!.group, tt = T - i * SAC_LAG;
          g.scale.setScalar(1 + Math.sin(tt * 14 + i) * 0.12 * gather + 0.08 * gather - 0.16 * spray + 0.1 * end);
          g.rotation.z = Math.sin(tt * 11) * 0.1 * gather;
        }
        break;
      }
      case "hit": {
        // Trúng đòn (flinch, eyes shut, head shake) → Lùi lại (recoil back) → Phục hồi (inhale).
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        const inhale = bell(p, 0.7, 1);
        body.group.position.z += -0.9 * k;
        body.group.scale.set(1 + k * 0.08, 1 - k * 0.12, 1);
        pitchBody(r, -0.22 * k);
        // Front arms brace forward against the recoil (hind thighs would dig their back corner in).
        const lean = Math.asin(Math.min(0.5, (0.9 * k) / 2.4));
        armL.group.rotation.x -= lean; armR.group.rotation.x -= lean;
        head.group.rotation.y = shake * 0.12;
        head.group.rotation.z = shake * 0.025; // a wide jaw rolls its corner into the ground beyond this
        head.group.rotation.x = 0.1 * k - 0.06 * inhale;
        jaw.group.rotation.x = k * 0.35;
        lid = Math.max(lid, 0.8 * k + (p < 0.08 ? 1 : 0));
        puffThroat(throat, inhale * 0.45);
        sacWobble(sacs, T, 0.14 * k + 0.02, 16);
        break;
      }
    }
    lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * clamp01(lid);
  },

  death: {
    // Gục xuống (0–.3) → Nằm yên with a last throat breath (.3–.7) → Tan độc (.7–1, rig shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: ToadParts, c: DeathCtx) {
      const { body, head, jaw, lids, throat, armL, armR, legL, legR, sacs } = r;
      const p = c.p;
      const slump = ramp(p, 0, 0.3), flat = ramp(p, 0.2, 0.5), last = bell(p, 0.42, 0.6), melt = ramp(p, 0.68, 1);
      // Squash is anchored at the ground pivot, so the flattening body never sinks the feet.
      body.group.scale.set(1 + 0.12 * flat, 1 - 0.18 * slump - 0.12 * flat - 0.15 * melt, 1 + 0.08 * flat);
      // Legs splay out sideways as it flattens (rotation about the hip only lifts the feet).
      armL.group.rotation.z = -0.35 * flat; armR.group.rotation.z = 0.35 * flat;
      legL.group.rotation.z = -0.45 * flat; legR.group.rotation.z = 0.45 * flat;
      armL.group.position.y += 0.4 * flat; armR.group.position.y += 0.4 * flat;
      legL.group.position.y += 0.5 * flat; legR.group.position.y += 0.5 * flat;
      // Head slumps forward onto the ground, lifts slightly on the last breath.
      head.group.rotation.x = 0.22 * slump - 0.05 * last;
      jaw.group.rotation.x = 0.18 * slump + 0.08 * last;
      lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * Math.max(ramp(p, 0.15, 0.32), bell(p, 0, 0.1));
      puffThroat(throat, 0.5 * last - 0.25 * flat);
      // Sacs deflate one after another, then dissolve with the body.
      for (let i = 0; i < sacs.length; i++) {
        const d = ramp(p, 0.1 + i * 0.05, 0.45 + i * 0.05);
        sacs[i]!.group.scale.setScalar(Math.max(0.05, 1 - 0.4 * d - 0.5 * melt));
      }
    },
  },
});
