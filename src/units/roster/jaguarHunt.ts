// Báo Đốm Săn (jaguar_hunt) — bespoke rig from the approved concept sheet.
// Lean tan feline with dark rosette spots, white muzzle, boxy brown ears, brown paws with white claws,
// long segmented tail with dark tip. Body → neck → head is one connected chain (A24, A90.2).
// Idle: watch → sniff → head dip → tail flick, with blinks, independent ear twitches and rib breathing.
// Combat idle: alert / weight shift / snarl, picked per beat by a deterministic hash (never a fixed loop).
// Move: walk (4-beat lateral sequence) blending into a rotary gallop. Attack: hind load → lunge + bite
// at impact + diagonal paw rake → overshoot settle. Skill (Săn Mồi): deep crouch → arcing leap →
// slash → impact hold → squash landing. Hit: head shake → braced recoil → inhale. Death: buckle →
// roll onto the flank → last breath → vanish. 2★ dark dorsal mane; 3★ shoulder guards + fang charm.
//
// Feet never sink: every state that lowers or pitches the body re-bends the legs through `ground`,
// a two-link knee solve that keeps the sole on y=0 (verified by tests/jaguar-hunt-rig.test.ts).
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  tan: 0xe2b26a, tanL: 0xf0c987, tanD: 0xc8954e, spot: 0x3a2414, brown: 0x6b3f22, brownD: 0x4a2a16,
  white: 0xf6f1e6, nose: 0x3b2414, eye: 0x1e120a, claw: 0xffffff, mouth: 0xb23a2e, tongue: 0xe0707a,
  fang: 0xfff6e6, mane: 0x5a3418, guard: 0x7a4a26, charm: 0xd8433a,
};

/** Torso pivot height: front and hind soles rest on y≈0 (was 5.6, which sank the soles 0.2–0.3 voxel). */
const TORSO_Y = 5.95;
/** Hip pivot → sole bottom (3.0 upper limb + 2.0 paw), voxels. */
const LEG = 5;
/** Hip z relative to the torso pivot (front hips ride the chest at z 1.2 + 1.6). */
const FRONT_Z = 2.8, HIND_Z = -3.0, CHEST_Z = 1.6, HIP_X = 1.45;
/** Seconds of follow-through lag per tail segment. */
const TAIL_LAG = 0.07;
/** Lid scale when open: the lid folds up under the brow. */
const LID_OPEN = 0.06;

interface Leg { hip: Part; paw: Part; front: boolean; side: 1 | -1 }
interface JaguarParts {
  torso: Part; belly: Part; chest: Part; ribs: Part; neck: Part; head: Part; jaw: Part; lids: Part;
  earL: Part; earR: Part;
  legs: Leg[];
  tail: Part[];
}

// ---------- allocation-free pose helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
/** Upper limb (hip → paw pivot) and lower limb (paw pivot → sole) lengths, voxels. */
const UPPER = 3, LOWER = 2;
/** Two-link IK scratch (no allocation): hip angle and paw angle relative to the hip. */
let ikHip = 0, ikPaw = 0;
/**
 * Exact planted-foot solve: shorten the leg's vertical reach by `drop` while the sole stays directly
 * under the hip (zero horizontal slide). Elbow/hock fold backward, as on a feline.
 */
function solveKnee(drop: number) {
  if (drop <= 0) { ikHip = 0; ikPaw = 0; return; }
  // Pass 1 solves the limb line; pass 2 shortens it by how far the tilted paw block's heel corner
  // dips below that line (≈0.6·|sin φ|), so the whole paw stays above the ground.
  let phi = 0, a = 0;
  for (let pass = 0; pass < 2; pass++) {
    const h = Math.max(1.2, LEG - drop - 0.05 - (pass ? 0.62 * Math.abs(Math.sin(phi)) : 0));
    a = Math.acos(Math.min(1, (UPPER * UPPER + h * h - LOWER * LOWER) / (2 * UPPER * h)));
    phi = -Math.asin(Math.min(1, (UPPER / LOWER) * Math.sin(a)));
  }
  ikHip = a; ikPaw = phi - a;
}

/** Bend one leg so its sole stays planted when its hip sinks by `drop` (or lift a swinging paw). */
function bend(l: Leg, drop: number) {
  solveKnee(drop);
  l.hip.group.rotation.x += ikHip;
  l.paw.group.rotation.x += ikPaw;
}

/**
 * Keep every planted leg on the ground after the torso moved by `dy` (≤0 lowers), pitched by `pitch`,
 * rolled by `roll` and the chest pitched by `chestPitch`. `dz`/`dx` lean the legs so planted soles do
 * not slide when the body shifts over them; planted legs also counter-rotate the body pitch/roll so
 * they stay vertical in world space. `plant` (0..1) fades that lean out for airborne poses.
 * `skip` = index of a leg that is lifted on purpose (or -1).
 */
function ground(legs: readonly Leg[], dy: number, pitch: number, chestPitch: number, roll: number, dz: number, dx: number, skip = -1, plant = 1) {
  const sp = Math.sin(pitch), sc = Math.sin(chestPitch), sr = Math.sin(roll);
  const lz = Math.asin(Math.max(-0.6, Math.min(0.6, dz / LEG))), lx = Math.asin(Math.max(-0.6, Math.min(0.6, dx / LEG)));
  for (let i = 0; i < legs.length; i++) {
    if (i === skip) continue;
    const l = legs[i]!;
    l.hip.group.rotation.x += (lz - pitch - (l.front ? chestPitch : 0)) * plant;
    l.hip.group.rotation.z -= (lx + roll) * plant;
    const drop = -dy + (l.front ? FRONT_Z * sp + CHEST_Z * sc : HIND_Z * sp) - l.side * HIP_X * sr + 5.9 * (1 - Math.cos(roll));
    bend(l, drop);
  }
}

/** Tail wave with per-segment time lag (follow-through). `lift` raises the root, `curl` each joint. */
function tailWave(tail: readonly Part[], time: number, amp: number, speed: number, lift: number, curl: number) {
  for (let i = 0; i < tail.length; i++) {
    const g = tail[i]!.group, tt = time - i * TAIL_LAG;
    g.rotation.y += Math.sin(tt * speed) * amp * (0.35 + i * 0.16);
    g.rotation.x += (i === 0 ? lift : curl) + Math.sin(tt * speed * 0.63 + 1.1) * amp * 0.16;
  }
}

/** 0 open → 1 shut. ~3.7 s cadence, an occasional double blink, offset per unit. */
function blinkAt(time: number, sig: number): number {
  const u = time + sig * 7.3, a = u % 3.7;
  const second = u % 11.1 < 3.7 ? bell(a, 0.24, 0.38) : 0;
  return Math.max(bell(a, 0, 0.15), second);
}

/** Ear flick pulse with a small rebound; each ear gets its own period/seed so they never sync. */
const twitch = (time: number, period: number, seed: number) => {
  const u = (time + seed) % period;
  return bell(u, 0, 0.12) - bell(u, 0.12, 0.3) * 0.35;
};

/** Breathing driven into the ribcage (and a lagged belly), never by scaling the whole torso. */
function breathe(r: JaguarParts, time: number, rate: number, amp: number) {
  const b = Math.sin(time * rate), lag = Math.sin(time * rate - 0.6);
  r.ribs.group.scale.set(1 + b * 0.025 * amp, 1 + b * 0.035 * amp, 1 + b * 0.012 * amp);
  r.belly.group.position.y += -lag * 0.07 * amp;
  r.belly.group.scale.x = 1 + lag * 0.03 * amp;
}

/** Deterministic beat pick for combat idle: 0 alert · 1 weight shift · 2 snarl. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

/** Freeze progress at `a` over [a, b] (impact hold), compressing the remainder so the end stays at 1. */
const hold = (p: number, a: number, b: number) => (p < a ? p : p < b ? a : a + ((p - b) * (1 - a)) / (1 - b));

// Skill trajectory as pure functions of (held) progress so the tail can sample it lagged (inertia).
const SK_AIR0 = 0.24, SK_AIR1 = 0.58;
function skillY(q: number): number {
  const prep = ramp(q, 0, 0.2) * (1 - ramp(q, 0.2, 0.28));
  const x = clamp01((q - SK_AIR0) / (SK_AIR1 - SK_AIR0));
  const arc = q > SK_AIR0 && q < SK_AIR1 ? 4 * x * (1 - x) : 0;
  return -1.7 * prep + 5 * arc - 1.25 * bell(q, 0.58, 0.86) + 0.7 * bell(q, 0.84, 1);
}
function skillPitch(q: number): number {
  const air = win(q, SK_AIR0, SK_AIR1 + 0.04, 0.06);
  const x = clamp01((q - SK_AIR0) / (SK_AIR1 - SK_AIR0));
  return 0.08 * win(q, 0, 0.26, 0.08) + air * (x - 0.42) * 0.75 + 0.22 * win(q, 0.55, 0.72, 0.05) + 0.06 * bell(q, 0.7, 0.9);
}

export default defineUnit<JaguarParts>({
  id: "jaguar_hunt",
  motion: "ground",
  height: 10,
  durations: { idle: 5, attack: 0.85, skill: 1.6, hit: 0.55, move: 0.6 },
  impact: { attack: 0.5, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    // Torso pivot at mid-back; chest is a (mesh-less at 1★) child so the front can lift independently.
    const torso = k.part("torso", null, [0, TORSO_Y, -0.6]);
    torso.box([0, 0, -1.4], [3.8, 3.2, 5.2], C.tan)
      .spots([0, 0, -1.4], [3.8, 3.2, 5.2], C.spot, 18, 101, 0.75);
    const belly = k.part("belly", torso, [0, -1.5, -1.4]);
    belly.box([0, 0, 0], [3.2, 0.4, 4.6], C.tanL); // pale belly, sways with the breath

    const chest = k.part("chest", torso, [0, 0.1, 1.2]);
    // Ribcage carries the chest mass so breathing scales it without moving the neck or front legs.
    const ribs = k.part("ribs", chest, [0, 0, 1.0]);
    ribs.box([0, 0, 0], [4.0, 3.4, 3.2], C.tan)
      .box([0, -1.2, 0.6], [2.6, 1.0, 2.2], C.tanL)
      .spots([0, 0, 0], [4.0, 3.4, 3.2], C.spot, 10, 113, 0.7);

    // Neck overlaps both chest and head so no gap opens in any pose.
    const neck = k.part("neck", chest, [0, 0.6, 2.4]);
    neck.box([0, 0.5, 0.6], [2.8, 2.8, 2.4], C.tan)
      .spots([0, 0.5, 0.6], [2.8, 2.8, 2.4], C.spot, 5, 127, 0.6);

    const head = k.part("head", neck, [0, 1.4, 1.6]);
    head.box([0, 0.3, 0.6], [3.6, 3.0, 3.0], C.tan) // broad feline skull
      .box([0, -0.4, 2.5], [2.6, 1.8, 1.6], C.white) // muzzle block
      .box([0, 0.25, 3.35], [1.0, 0.6, 0.2], C.nose)
      .pair([0.95, 0.9, 2.12], [0.6, 0.6, 0.14], C.eye)
      .pair([1.0, 1.25, 2.1], [0.9, 0.25, 0.2], C.tanD) // brow
      .pair([1.82, 0.0, 0.8], [0.12, 1.6, 1.8], C.tanD) // cheeks
      .spots([0, 1.0, 0.2], [3.6, 1.6, 2.0], C.spot, 5, 131, 0.55)
      // Mouth interior: palate + upper fangs sit inside the closed jaw, visible only when it opens.
      .box([0, -1.33, 2.3], [2.0, 0.1, 1.6], C.mouth)
      .pair([0.65, -1.5, 3.0], [0.25, 0.45, 0.25], C.fang);

    // Eyelids hinge under the brow: scale.y LID_OPEN = open, 1 = shut (blink / squint).
    const lids = k.part("lids", head, [0, 1.2, 2.22]);
    lids.pair([0.95, -0.32, 0], [0.72, 0.66, 0.1], C.tan);

    // Each ear is its own pivot at its base so twitches and pins are independent.
    const ear = (side: 1 | -1) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.3, 1.9, 0.2]);
      e.box([0, 0.6, 0], [1.0, 1.3, 0.8], C.brown)
        .box([0, 0.45, 0.42], [0.5, 0.7, 0.06], C.brownD);
      if (star >= 2) e.box([0, 1.35, 0], [0.5, 0.4, 0.4], C.brownD); // 2★ ear tufts
      return e;
    };
    const earR = ear(1), earL = ear(-1);

    const jaw = k.part("jaw", head, [0, -1.25, 1.5]);
    jaw.box([0, -0.25, 1.0], [2.4, 0.6, 1.6], C.white)
      .box([0, 0.08, 0.9], [1.8, 0.12, 1.2], C.mouth)
      .box([0, 0.2, 0.75], [1.0, 0.16, 1.0], C.tongue) // tongue shows when roaring
      .pair([0.65, 0.3, 1.65], [0.25, 0.5, 0.25], C.fang);

    // Legs: hip pivot carries the upper limb; paw is its own joint (brown sock + white claws).
    const legs = ([[1, true], [-1, true], [1, false], [-1, false]] as const).map(([side, front]): Leg => {
      const at: [number, number, number] = front ? [side * HIP_X, -1.0, CHEST_Z] : [side * HIP_X, -0.8, -3.0];
      const hip = k.part(`${front ? "f" : "h"}leg${side}`, front ? chest : torso, at);
      hip.box([0, -1.4, 0], [1.3, 3.0, 1.4], C.tan)
        .box([side * 0.66, -1.2, 0.1], [0.1, 0.6, 0.6], C.spot);
      if (!front) hip.box([0, 0.1, -0.2], [1.6, 1.4, 2.0], C.tan); // haunch mass
      const paw = k.part(`${front ? "f" : "h"}paw${side}`, hip, [0, -3.0, 0]);
      paw.box([0, -0.9, 0.1], [1.25, 1.9, 1.35], C.brown)
        .box([0, -1.75, 0.45], [1.45, 0.5, 1.8], C.brownD);
      for (const dx of [-0.42, 0, 0.42]) paw.box([dx, -1.85, 1.45], [0.3, 0.35, 0.35], C.claw);
      return { hip, paw, front, side };
    });

    // Tail: 6 chained segments, last two dark-tipped and chunky like the sheet.
    const tail: Part[] = [];
    let parent = torso;
    for (let i = 0; i < 6; i++) {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 0.9, -4.0] : [0, 0, -1.3]);
      const tip = i >= 4, w = tip ? 1.3 : 1.0 - i * 0.04;
      seg.box([0, 0, -0.65], [w, w, 1.45], tip ? C.brown : C.tan);
      if (!tip && i % 2 === 1) seg.box([0, w / 2 + 0.05, -0.6], [0.5, 0.12, 0.5], C.spot);
      tail.push(seg);
      parent = seg;
    }

    if (star >= 2) {
      // Dark dorsal mane running neck → back.
      neck.box([0, 2.05, 0.4], [1.2, 0.6, 2.4], C.mane);
      chest.box([0, 1.85, 0.9], [1.4, 0.5, 3.0], C.mane);
      torso.box([0, 1.75, -1.2], [1.2, 0.45, 4.6], C.mane);
    }
    if (star >= 3) {
      // Leather shoulder guards + fang charm on the throat; claws glow faintly red.
      chest.pair([2.05, 0.7, 1.2], [0.4, 2.0, 2.6], C.guard).pair([2.25, 1.4, 1.2], [0.2, 0.5, 2.2], C.brownD);
      neck.box([0, -0.7, 1.8], [2.6, 0.3, 0.3], C.brownD)
        .box([0, -1.15, 1.95], [0.4, 0.7, 0.3], C.fang)
        .box([0, -1.55, 1.95], [0.3, 0.3, 0.3], C.charm, { mat: "glow" });
      for (const l of legs) if (l.front) l.paw.box([0, -1.85, 1.65], [1.2, 0.12, 0.12], C.charm, { mat: "glow" });
    }

    return { torso, belly, chest, ribs, neck, head, jaw, lids, earL, earR, legs, tail };
  },

  pose(r, c) {
    const { torso, chest, neck, head, jaw, lids, earL, earR, legs, tail } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    // Independent ear life in every state; states add pins/flattening on top.
    earL.group.rotation.z = twitch(T, 3.1, c.sig * 4) * 0.3;
    earR.group.rotation.z = -twitch(T, 4.3, 1.7 + c.sig * 2) * 0.3;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: crouched stance + breathing bob, beats cross-fade alert / shift / snarl.
          const s = T * 0.38 + c.sig * 3.1, n = Math.floor(s), f = s - n, m = ramp(f, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const alert = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const shift = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const snarl = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          const br = Math.sin(T * 2.6);
          breathe(r, T, 2.6, 1.4);
          const dy = -0.7 + br * 0.1 - snarl * 0.2;
          const dx = Math.sin(T * 1.7) * 0.4 * shift;
          torso.group.position.y += dy;
          torso.group.position.x += dx;
          torso.group.rotation.z = -dx * 0.12;
          chest.group.rotation.x = 0.1 + snarl * 0.06;
          neck.group.rotation.x = -0.05 * alert + 0.12 * snarl;
          head.group.rotation.x = -0.05 + br * 0.02 - 0.12 * snarl;
          // Head scans left/right; two incommensurate sines so the sweep never looks looped.
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 6) * 0.32 + Math.sin(T * 2.3 + 1) * 0.07) * (1 - 0.6 * snarl);
          const pin = -0.35 - 0.2 * snarl + 0.15 * alert;
          earL.group.rotation.x = pin; earR.group.rotation.x = pin;
          jaw.group.rotation.x = snarl * (0.55 + Math.sin(T * 31) * 0.04) + Math.max(0, Math.sin(T * 1.3)) ** 6 * 0.2 * alert;
          lid = Math.max(lid, snarl * 0.35);
          ground(legs, dy, 0, chest.group.rotation.x, torso.group.rotation.z, 0, dx);
          // Light kneading step on the leading paw during the shift beat (lifts only, never sinks).
          const knead = bell((T * 0.85) % 1, 0, 0.45) * shift;
          legs[0]!.hip.group.rotation.x -= knead * 0.35;
          legs[0]!.paw.group.rotation.x -= knead * 0.3;
          tailWave(tail, T, 0.3 + snarl * 0.15, 4.2 + snarl * 3, -0.2, 0.05);
        } else {
          // Inspection idle: watch (0–.3) → sniff (.3–.52) → head dip (.52–.76) → tail flick (.76–1).
          // p settles at 1 (≡ watch) so the held idle is the same pose the cycle starts and ends on.
          const ph = c.p % 1;
          const watch = 1 - ramp(ph, 0.24, 0.32), sniff = win(ph, 0.28, 0.54, 0.06);
          const dip = win(ph, 0.5, 0.78, 0.08), flick = win(ph, 0.74, 1, 0.06);
          breathe(r, T, 1.9 + c.sig * 0.4, 1);
          const scan = Math.sin(clamp01(ph / 0.3) * Math.PI * 2) * 0.38 * watch;
          head.group.rotation.y = scan + Math.sin(T * 0.7) * 0.06 - flick * 0.22; // glance back at the tail
          neck.group.rotation.x = sniff * 0.2 + dip * 0.62;
          head.group.rotation.x = -sniff * 0.14 + Math.sin(T * 24) * 0.035 * sniff + dip * 0.28;
          chest.group.rotation.x = dip * 0.07; // shoulders settle as the head goes down
          jaw.group.rotation.x = sniff * (0.03 + Math.max(0, Math.sin(T * 12)) * 0.03);
          const perk = sniff * 0.18 - dip * 0.1;
          earL.group.rotation.x = perk; earR.group.rotation.x = perk;
          earL.group.rotation.z -= dip * 0.12; earR.group.rotation.z += dip * 0.12;
          ground(legs, 0, 0, chest.group.rotation.x, 0, 0, 0);
          // Tail held up in a curve; the flick is enveloped per segment so it ripples root → tip.
          tailWave(tail, T, 0.14, 2.2, 0.35, 0.09);
          for (let i = 0; i < tail.length; i++) {
            const e = win(ph - i * 0.014, 0.74, 1, 0.05);
            tail[i]!.group.rotation.y += Math.sin((c.t - i * TAIL_LAG) * 11) * e * (0.14 + i * 0.07);
            tail[i]!.group.rotation.x += e * (i === 0 ? 0.12 : 0.04);
          }
        }
        break;
      }
      case "move": {
        // No velocity reaches PoseCtx (callers only play("move")), so gait is a deterministic blend:
        // combat movement is always a dash (run); out of combat the cat walks (Bước 1/2) and breaks
        // into the gallop (Chạy nhanh) after ~0.5–1.1 s of sustained movement (c.p 0.8 → 1.8 cycles).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2, ww = w * 0.5; // walk cycle is half the gallop rate
        for (let i = 0; i < legs.length; i++) {
          const l = legs[i]!;
          // Walk: lateral sequence LH → LF → RH → RF; stance 65 %, swing lifts the paw.
          const u = (ww / (Math.PI * 2) + (l.front ? 0.25 : 0) + (l.side > 0 ? 0.5 : 0)) % 1;
          const stance = u < 0.65, sw = stance ? 0 : (u - 0.65) / 0.35;
          const walkHip = stance ? -0.32 + (u / 0.65) * 0.64 : 0.32 - 0.64 * ramp(sw, 0, 1);
          const walkLift = stance ? 0 : Math.sin(sw * Math.PI) * 1.3;
          // Run: rotary gallop, fronts/hinds out of phase, long reach, paws tuck on recovery.
          const phase = w + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.35 : 0);
          const runHip = Math.sin(phase) * 0.85;
          const runLift = Math.max(0, -Math.cos(phase)) * 2.2;
          l.hip.group.rotation.x = walkHip * wk + runHip * g;
          // Planted walking paws stay level (toes would dig in as the hip swings back); swing frees them.
          const flat = stance ? 1 : 1 - Math.sin(sw * Math.PI);
          l.paw.group.rotation.x = -walkHip * flat * wk;
          // Swing paws fold through the knee solve, which only ever shortens the leg (lifts the sole).
          bend(l, walkLift * wk + runLift * g);
        }
        // Spine: walk sways the shoulders; gallop flexes/extends (chest vs torso counter-pitch).
        const bob = wk * Math.abs(Math.sin(ww * 2)) * 0.12 + g * (0.3 + Math.abs(Math.sin(w)) * 0.55);
        torso.group.position.y += bob;
        torso.group.rotation.x = g * Math.sin(w + 0.4) * 0.06;
        torso.group.rotation.z = wk * Math.sin(ww) * 0.03;
        chest.group.rotation.x = g * Math.sin(w) * 0.1;
        // Walking stance legs stay vertical under the sway; the gallop is airborne so it keeps its lean.
        ground(legs, bob, torso.group.rotation.x, chest.group.rotation.x, torso.group.rotation.z, 0, 0, -1, wk);
        chest.group.rotation.y = wk * Math.sin(ww + 0.5) * 0.05;
        neck.group.rotation.x = -g * Math.sin(w) * 0.12 + wk * (0.08 + Math.sin(ww * 2) * 0.03) + g * 0.12;
        head.group.rotation.x = -g * 0.1 + wk * Math.sin(ww * 2 + 0.6) * 0.03; // head steadied
        head.group.rotation.y = wk * Math.sin(ww * 0.5) * 0.12;
        const pin = -0.08 * wk - 0.5 * g;
        earL.group.rotation.x = pin; earR.group.rotation.x = pin;
        breathe(r, T, 2 + g * 4, 0.6 + g);
        // Tail: relaxed sway when walking, straight and stiff behind the gallop.
        tailWave(tail, T, 0.16 * wk + 0.05 * g, 3 + g * 6, 0.2 * wk + 0.06 * g, 0.03 * wk);
        break;
      }
      case "attack": {
        // Lao tới → Cắn/Quật → Hoàn tất (impact 0.5).
        const p = c.p;
        const load = ramp(p, 0, 0.3) * (1 - ramp(p, 0.3, 0.4)); // weight sinks onto the hind legs
        const reach = ramp(p, 0.3, 0.5) * (1 - ramp(p, 0.62, 0.9)); // lunge out and back
        const settle = bell(p, 0.82, 1); // overshoot past rest, then settle
        const dy = -0.75 * load + 0.25 * bell(p, 0.3, 0.55) - 0.2 * settle;
        const dz = -0.7 * load + 2.6 * reach - 0.35 * settle;
        const pitch = -0.1 * load + 0.12 * reach - 0.04 * settle;
        torso.group.position.y += dy;
        torso.group.position.z += dz;
        torso.group.rotation.x = pitch;
        chest.group.rotation.x = -0.2 * reach;
        chest.group.rotation.z = 0.06 * reach;
        neck.group.rotation.x = 0.15 * load - 0.32 * reach + 0.05 * settle;
        head.group.rotation.x = 0.16 * reach;
        // Jaw: small snarl while loading, wide open exactly through the impact frame.
        jaw.group.rotation.x = 0.15 * load + 0.95 * ramp(p, 0.36, 0.5) * (1 - ramp(p, 0.58, 0.8));
        const pin = -0.55 * Math.min(1, load + reach);
        earL.group.rotation.x = pin; earR.group.rotation.x = pin;
        lid = Math.max(lid, 0.3 * bell(p, 0.42, 0.65));
        breathe(r, T, 4, 0.8);
        // Lead paw rakes diagonally: up and out, then across under the chin (never through the head).
        const sw = legs[0]!;
        const up = ramp(p, 0.32, 0.46) * (1 - ramp(p, 0.6, 0.86));
        sw.hip.group.rotation.x = -1.25 * up;
        sw.hip.group.rotation.z = (0.55 * ramp(p, 0.3, 0.44) - 0.72 * ramp(p, 0.46, 0.6)) * (1 - ramp(p, 0.62, 0.9));
        sw.paw.group.rotation.x = 0.5 * ramp(p, 0.3, 0.44) * (1 - ramp(p, 0.46, 0.55)) - 0.35 * bell(p, 0.46, 0.7);
        // Support front paw steps forward with the lunge; hinds extend behind as they push off.
        legs[1]!.hip.group.rotation.x -= 0.4 * reach;
        const push = bell(p, 0.32, 0.64);
        legs[2]!.hip.group.rotation.x += 0.55 * push;
        legs[3]!.hip.group.rotation.x += 0.5 * push;
        // Soles stay planted while loading back; the lunge itself is a step, so only the load leans.
        ground(legs, dy, pitch, chest.group.rotation.x, 0, -0.7 * load, 0);
        // Tail counterbalances: lifts with the lunge and whips with lagged follow-through.
        tailWave(tail, T, 0.22 + 0.2 * reach, 8, 0.1 + 0.3 * reach - 0.2 * load, 0.02);
        break;
      }
      case "skill": {
        // Săn Mồi: Chuẩn bị (0–.24) → Lao vọt (.24–.5) → Tấn công mạnh (.5–.6) → Gây sát thương
        // (impact .62, frozen .60–.65 ≈ 80 ms at 1.6 s) → Hạ cánh (.65–.86 squash) → recover hop.
        const q = hold(c.p, 0.6, 0.65);
        const prep = win(q, 0, 0.27, 0.12);
        const air = win(q, SK_AIR0, 0.62, 0.05);
        const strikeP = win(q, 0.48, 0.66, 0.06);
        const dy = skillY(q), pitch = skillPitch(q);
        const dz = 3.6 * ramp(q, SK_AIR0, SK_AIR1) - 3.6 * ramp(q, 0.8, 1) - 0.4 * prep;
        torso.group.position.y += dy;
        torso.group.position.z += dz;
        torso.group.rotation.x = pitch;
        chest.group.rotation.x = 0.1 * prep - 0.12 * air * (1 - strikeP);
        // Air pose: fronts fully stretched forward, hinds trailing; fronts rake down into the strike.
        for (let i = 0; i < legs.length; i++) {
          const l = legs[i]!;
          if (l.front) {
            l.hip.group.rotation.x = air * (-1.4 + strikeP * 0.7);
            l.paw.group.rotation.x = air * (-0.3 + strikeP * 0.5);
          } else {
            l.hip.group.rotation.x = air * 1.05;
            l.paw.group.rotation.x = -air * 0.35;
          }
        }
        ground(legs, dy, pitch, chest.group.rotation.x, 0, 0, 0);
        neck.group.rotation.x = 0.2 * prep - 0.22 * air + 0.12 * strikeP;
        head.group.rotation.x = -0.1 * prep + 0.15 * strikeP;
        jaw.group.rotation.x = 0.2 * prep + 0.95 * win(q, 0.46, 0.72, 0.06);
        const pin = -0.55 * Math.min(1, prep + air);
        earL.group.rotation.x = pin; earR.group.rotation.x = pin;
        lid = Math.max(lid, 0.35 * prep + 0.3 * strikeP);
        breathe(r, T, 5, 0.7 + prep);
        // Tail draws an arc from inertia: each joint bends by how far the body's pitch/height moved
        // between two lagged samples, so it trails the leap and whips on landing.
        for (let i = 0; i < tail.length; i++) {
          const a = q - i * 0.03, b = q - (i + 1) * 0.03;
          const g = tail[i]!.group;
          g.rotation.x = (i === 0 ? -0.15 * prep + 0.1 : 0.02) - (skillPitch(b) - skillPitch(a)) * 2.2 + (skillY(b) - skillY(a)) * 0.12;
          g.rotation.y = Math.sin((T - i * TAIL_LAG) * 7) * (0.05 + 0.04 * i) * (1 - air * 0.6);
        }
        break;
      }
      case "hit": {
        // Bị đánh trúng (head shake, squint, ears pinned) → Lùi lại (braced) → Phục hồi (inhale).
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70); // ~2 swings over the first frames
        const inhale = bell(p, 0.7, 1);
        const dz = -1.0 * k, roll = 0.1 * k, pitch = -0.08 * k;
        torso.group.position.z += dz;
        torso.group.rotation.z = roll;
        torso.group.rotation.x = pitch;
        neck.group.rotation.x = 0.32 * k - 0.06 * inhale;
        head.group.rotation.y = -0.2 * k + shake * 0.14;
        head.group.rotation.z = shake * 0.07;
        head.group.rotation.x = -0.08 * inhale;
        jaw.group.rotation.x = 0.25 * k;
        const pin = -0.65 * k;
        earL.group.rotation.x = pin; earR.group.rotation.x = pin;
        earL.group.rotation.z = 0.3 * k; earR.group.rotation.z = -0.3 * k; // ears fold down and out
        lid = Math.max(lid, 0.6 * k + (p < 0.08 ? 1 : 0));
        // Front paws brace forward against the recoil.
        legs[0]!.hip.group.rotation.x -= 0.22 * k;
        legs[1]!.hip.group.rotation.x -= 0.22 * k;
        ground(legs, 0, pitch, 0, roll, dz, 0);
        breathe(r, T, 6, 0.6);
        r.ribs.group.scale.y += inhale * 0.06;
        r.ribs.group.scale.x += inhale * 0.04;
        tailWave(tail, T, 0.4 * k + 0.08, 14, 0.25 * k - 0.05, 0.02);
        break;
      }
    }
    lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * clamp01(lid);
  },

  death: {
    // Gục xuống (0–.32) → nghiêng nằm (.18–.45) → nằm yên + last breath (.45–.78) → biến mất (.78–1).
    seconds: 1.3,
    vanishAt: 0.78,
    pose(r: JaguarParts, c: DeathCtx) {
      const { torso, chest, neck, head, jaw, lids, earL, earR, legs, tail } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.32), roll = ramp(p, 0.18, 0.45), last = bell(p, 0.5, 0.7);
      const phi = roll * Math.PI / 2;
      // Legs buckle under the falling body (planted IK), then relax half-folded once it lies on its flank.
      const pitch = 0.06 * fall * (1 - roll), chestPitch = 0.05 * fall;
      const fold = 1 - 0.5 * roll, drop = 2.2 * fall;
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i]!;
        solveKnee(drop + (l.front ? FRONT_Z * Math.sin(pitch) + CHEST_Z * Math.sin(chestPitch) : HIND_Z * Math.sin(pitch)));
        l.hip.group.rotation.x = ikHip * fold - (pitch + (l.front ? chestPitch : 0)) * (1 - roll) + (l.front ? -0.25 : 0.25) * roll;
        l.paw.group.rotation.x = ikPaw * fold;
      }
      // Torso height keeps the low flank, the folded low legs and 3★ guards above y=0 through the roll:
      // flank = rotated torso half-extents, legs = hip offset + folded vertical reach (+ paw half-width).
      const reach = 0.9 + LEG - drop * fold;
      const clear = Math.max(2.4 * Math.sin(phi) + 1.75 * Math.cos(phi), HIP_X * Math.sin(phi) + reach * Math.cos(phi) + 0.8 * Math.sin(phi));
      const buckled = TORSO_Y - 2.2 * fall;
      // Mid-roll the folded paw blocks turn their depth downward; sin(2φ) adds that margin, 0 at rest/flank.
      torso.group.position.y = roll > 0 ? Math.max(clear + 0.1 + 0.45 * Math.sin(2 * phi), buckled - 3 * roll) : buckled;
      torso.group.rotation.z = phi;
      torso.group.rotation.x = pitch;
      // Head droops toward the ground (local -x is world down once rolled), lifts on the last breath.
      neck.group.rotation.x = 0.35 * fall * (1 - roll);
      neck.group.rotation.y = -0.12 * roll + 0.05 * last;
      head.group.rotation.x = 0.2 * fall - 0.05 * last;
      chest.group.rotation.x = chestPitch;
      jaw.group.rotation.x = 0.22 * roll + 0.08 * last;
      earL.group.rotation.x = earR.group.rotation.x = -0.5 * fall;
      lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.1));
      r.ribs.group.scale.set(1 + last * 0.06, 1 + last * 0.09, 1);
      r.belly.group.position.y -= last * 0.1;
      // Tail falls joint by joint (lagged), settling onto the ground with a small rebound.
      for (let i = 0; i < tail.length; i++) {
        const fallI = ramp(p, 0.15 + i * 0.04, 0.5 + i * 0.04);
        tail[i]!.group.rotation.y = 0.055 * fallI - 0.012 * bell(p, 0.5 + i * 0.04, 0.7 + i * 0.04);
        tail[i]!.group.rotation.x = (i === 0 ? -0.15 : -0.03) * fall * (1 - roll);
      }
    },
  },
});
