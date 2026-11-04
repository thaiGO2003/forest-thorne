// Huyết Thố (rabbit_blood) — bespoke rig from the approved "Huyết Thố" reference sheet.
// Bipedal crimson brawler rabbit: very long pink-lined ears (two segments each), glowing red eyes,
// fangs, heart mark on the chest, leather belt, gauntlets with claws, big hind feet, a three-segment
// red scarf that trails with inertia, and a white tail puff.
// Idle: knee bounce → fist clench → ear shake → small growl · Combat idle: watch / light step / ready.
// Attack: claw sweep · Skill: draw a crimson sword and hold it aloft at the impact beat.
// Recovery, death and scarf follow-through stay grounded for every star level.
// 2★ adds glowing ear tips and a blood-moon aura ring; 3★ adds a horned crown and shoulder guards.
//
// Legs use a planted two-link solve with a level foot, so a lowered or shifted pelvis never sinks or
// slides the feet (verified by tests/rabbit-blood-rig.test.ts).
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  fur: 0x8a1c3a, furD: 0x5e1028, furL: 0xb02a4e, pink: 0xff8fb0, pinkD: 0xd9567e,
  eye: 0xff2a3a, pupil: 0x2a0508, fang: 0xfff4f0, scarf: 0xd81e34, scarfD: 0x9e1224,
  leather: 0x5a3216, leatherD: 0x3a1e0c, buckle: 0xd8a83a, claw: 0xfff0e8, heart: 0xff3048,
  tail: 0xf6e8ec, gold: 0xe8b23a, steel: 0x8a8f98,
};

/** Pelvis pivot height: soles rest on y ≈ 0.05. */
const HIPS_Y = 4.75;
/** Leg chain: hip → knee (thigh), knee → ankle (shin), ankle → sole (level foot). */
const THIGH = 2.2, SHIN = 2.0, FOOT_H = 0.5, LEG = THIGH + SHIN + FOOT_H;
const HIP_X = 0.95;
/** Seconds of follow-through lag per scarf segment / from ear base to ear tip. */
const SCARF_LAG = 0.08, EAR_LAG = 0.09;

interface Leg { thigh: Part; knee: Part; foot: Part; side: 1 | -1 }
interface Arm { shoulder: Part; elbow: Part; side: 1 | -1 }
interface Ear { base: Part; tip: Part; side: 1 | -1 }
interface RabbitParts {
  hips: Part; torso: Part; head: Part; jaw: Part; eyes: Part; tail: Part;
  ears: Ear[]; arms: Arm[]; legs: Leg[]; scarf: Part[]; aura: Part | null; sword: Part;
}

// ---------- allocation-free pose helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/** Two-link scratch (no allocation): thigh angle forward and shin angle back, radians. */
let ikThigh = 0, ikShin = 0;
/** Shorten the hip → ankle distance by `drop` with the ankle straight under the hip (knee forward). */
function solveLeg(drop: number) {
  if (drop <= 0) { ikThigh = 0; ikShin = 0; return; }
  const h = Math.max(0.6, THIGH + SHIN - drop);
  ikThigh = Math.acos(Math.min(1, (THIGH * THIGH + h * h - SHIN * SHIN) / (2 * THIGH * h)));
  ikShin = Math.asin(Math.min(1, (THIGH / SHIN) * Math.sin(ikThigh)));
}

/**
 * Pose one leg: `drop` bends the knee so the ankle sinks by that much, `swing` rotates the whole leg
 * forward (−) / back (+) about the hip, `lift` raises the foot for a stride. The foot always stays
 * level in world space (it counter-rotates the body `pitch` too).
 */
function poseLeg(l: Leg, drop: number, swing: number, lift: number, pitch: number) {
  solveLeg(drop + lift);
  l.thigh.group.rotation.x += -ikThigh + swing - pitch;
  l.knee.group.rotation.x += ikThigh + ikShin;
  l.foot.group.rotation.x += -ikShin - swing + (lift > 0 ? -0.25 * clamp01(lift) : 0);
}

/**
 * Keep both feet planted after the pelvis moved by `dy` (≤0 lowers) and forward by `dz`, pitched by
 * `pitch` (+ = lean forward). The forward shift becomes a backward leg swing so the soles do not slide.
 */
function plantLegs(legs: readonly Leg[], dy: number, dz: number, pitch: number, skip = -1) {
  const swing = Math.asin(Math.max(-0.6, Math.min(0.6, dz / LEG)));
  // A shifted pelvis also lengthens the hip → foot line; bend a little more so the sole stays down.
  const extra = LEG * (1 - Math.cos(swing));
  for (let i = 0; i < legs.length; i++) if (i !== skip) poseLeg(legs[i]!, -dy + extra, swing, 0, pitch);
}

/** Ears: two segments with tip lag; `pin` sweeps them back, `perk` stands them up, `flop` droops tips. */
function poseEars(r: RabbitParts, time: number, sig: number, pin: number, perk: number, flop: number, shake = 0) {
  for (let i = 0; i < r.ears.length; i++) {
    const e = r.ears[i]!;
    const tw = (time + sig * 3 + i * 1.7) % (3.4 + i * 0.9);
    const twitch = bell(tw, 0, 0.12) - bell(tw, 0.12, 0.3) * 0.35;
    e.base.group.rotation.x += pin - perk * 0.15 + Math.sin(time * 1.3 + i) * 0.03;
    e.base.group.rotation.z += -e.side * (0.12 + twitch * 0.22 + shake * Math.sin(time * 26 + i));
    const tt = time - EAR_LAG;
    e.tip.group.rotation.x += 0.18 + flop + pin * 0.5 + Math.sin(tt * 1.3 + i) * 0.05;
    e.tip.group.rotation.z += -e.side * (shake * Math.sin(tt * 26 + i) * 0.8 + twitch * 0.1);
  }
}

/** Scarf trails behind the neck with per-segment lag; `wind` streams it back, `flutter` its speed. */
function poseScarf(scarf: readonly Part[], time: number, wind: number, flutter: number, lift = 0) {
  for (let i = 0; i < scarf.length; i++) {
    const g = scarf[i]!.group, tt = time - i * SCARF_LAG;
    g.rotation.x += (i === 0 ? 0.25 - 0.9 * wind - lift : 0.15 - 0.25 * wind) + Math.sin(tt * flutter) * (0.06 + 0.06 * i) * (0.4 + wind);
    g.rotation.y += Math.sin(tt * flutter * 0.7 + i) * (0.05 + 0.05 * i) * (0.5 + wind);
  }
}

/** Arm pose: `raise` lifts forward (−) / back (+), `out` opens sideways, `bend` folds the elbow. */
function poseArm(a: Arm, raise: number, out: number, bend: number) {
  a.shoulder.group.rotation.x += raise;
  a.shoulder.group.rotation.z += a.side * out;
  a.elbow.group.rotation.x += -bend;
}

/** Fist clench: the gauntlet (elbow part) shortens slightly as the fist closes. */
const clench = (a: Arm, k: number) => { a.elbow.group.scale.set(1 + 0.08 * k, 1 - 0.08 * k, 1 + 0.08 * k); };

/** 0 open → 1 shut, ~3.6 s cadence; red eyes narrow instead of fully closing when angry. */
function blinkAt(time: number, sig: number): number {
  const a = (time + sig * 5.3) % 3.6;
  return bell(a, 0, 0.14);
}

/** Deterministic beat pick for combat idle: 0 watch · 1 light step · 2 ready. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x2545f491, 0x85ebca6b) ^ Math.floor(sig * 7177);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

export default defineUnit<RabbitParts>({
  id: "rabbit_blood",
  motion: "ground",
  height: 14,
  durations: { idle: 4.5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.5 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIPS_Y, 0]);
    hips.box([0, 0.3, 0], [2.6, 1.2, 2.0], C.fur)
      .box([0, 0.55, 0], [2.8, 0.45, 2.2], C.leather) // belt
      .box([0, 0.55, 1.12], [0.7, 0.55, 0.12], C.buckle);

    const tail = k.part("tail", hips, [0, 0.3, -1.1]);
    tail.box([0, 0, -0.4], [1.1, 1.1, 0.9], C.tail);

    const torso = k.part("torso", hips, [0, 0.8, 0]);
    torso.box([0, 1.3, 0], [3.0, 2.6, 2.2], C.fur)
      .box([0, 1.1, 1.12], [2.0, 2.0, 0.12], C.furL) // chest fur
      .pair([0.28, 1.5, 1.2], [0.5, 0.5, 0.1], C.heart, { mat: "glow" }) // heart lobes
      .box([0, 1.2, 1.2], [0.55, 0.55, 0.1], C.heart, { mat: "glow", rot: [0, 0, Math.PI / 4] })
      .box([1.1, 1.3, 0], [0.25, 2.6, 2.3], C.leatherD, { rot: [0, 0, 0.5] }); // strap

    const head = k.part("head", torso, [0, 2.7, 0.15]);
    head.box([0, 1.0, 0], [3.0, 2.4, 2.6], C.fur)
      .box([0, 0.5, 1.35], [1.6, 1.0, 0.2], C.furL) // muzzle
      .box([0, 0.85, 1.48], [0.5, 0.35, 0.12], C.pinkD) // nose
      .pair([0.75, 1.35, 1.32], [0.75, 0.6, 0.1], C.pupil) // eye sockets
      .pair([1.15, 1.7, 1.25], [0.9, 0.25, 0.25], C.furD, { rot: [0, 0, -0.35] }); // angry brows
    // Glowing red eyes on their own pivot: "đỏ mắt" scales them up during the skill.
    const eyes = k.part("eyes", head, [0, 1.35, 1.38]);
    eyes.pair([0.75, 0, 0], [0.5, 0.42, 0.06], C.eye, { mat: "glow" });

    const jaw = k.part("jaw", head, [0, 0.1, 1.1]);
    jaw.box([0, -0.1, 0.1], [1.4, 0.4, 0.4], C.furL)
      .box([0, 0.08, 0.15], [1.0, 0.12, 0.3], C.pinkD)
      .pair([0.3, 0.2, 0.3], [0.2, 0.32, 0.12], C.fang);

    const ears: Ear[] = ([1, -1] as const).map((side) => {
      const base = k.part(side > 0 ? "earR" : "earL", head, [side * 0.75, 2.1, -0.2]);
      base.box([0, 1.1, 0], [0.95, 2.4, 0.5], C.fur)
        .box([0, 1.1, 0.27], [0.55, 2.0, 0.06], C.pink);
      const tip = k.part(side > 0 ? "earRTip" : "earLTip", base, [0, 2.3, 0]);
      tip.box([0, 1.0, 0], [0.85, 2.1, 0.45], C.fur)
        .box([0, 0.9, 0.24], [0.45, 1.6, 0.06], C.pink);
      if (star >= 2) tip.box([0, 2.05, 0], [0.6, 0.4, 0.5], C.scarf, { mat: "glow" }); // glowing tips
      return { base, tip, side };
    });

    // Arms: shoulder (upper arm) → elbow (forearm + gauntlet + claws).
    const arms: Arm[] = ([1, -1] as const).map((side) => {
      const shoulder = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.75, 2.2, 0]);
      shoulder.box([0, -0.8, 0], [0.9, 1.8, 0.9], C.fur);
      const elbow = k.part(side > 0 ? "foreR" : "foreL", shoulder, [0, -1.6, 0]);
      elbow.box([0, -0.6, 0], [0.85, 1.3, 0.85], C.fur)
        .box([0, -1.05, 0], [1.15, 0.8, 1.15], C.leather) // gauntlet
        .box([0, -0.75, 0], [1.2, 0.18, 1.2], C.buckle);
      for (const dz of [-0.3, 0, 0.3]) elbow.box([side * 0.1, -1.6, 0.25 + dz], [0.22, 0.45, 0.22], C.claw);
      return { shoulder, elbow, side };
    });
    // Sword follows the gauntlet: the oath raises its ruby-glowing blade overhead.
    const sword = k.part("bloodSword", arms[0]!.elbow, [0, -1.7, 0.3]);
    sword.box([0, -0.1, 0], [0.36, 0.9, 0.34], C.leather)
      .box([0, -0.5, 0], [1.4, 0.24, 0.4], C.gold)
      .box([0, -1.75, 0], [0.65, 2.3, 0.22], C.steel)
      .box([0, -1.75, 0.13], [0.25, 2.2, 0.07], C.heart, { mat: "glow" })
      .box([0, -3.08, 0], [0.42, 0.5, 0.16], C.scarf, { mat: "glow" });

    // Legs: thigh → knee (shin) → foot (big rabbit foot, kept level by the solver).
    const legs: Leg[] = ([1, -1] as const).map((side) => {
      const thigh = k.part(side > 0 ? "thighR" : "thighL", hips, [side * HIP_X, 0, 0]);
      thigh.box([0, -1.0, 0.05], [1.25, 2.3, 1.35], C.fur);
      const knee = k.part(side > 0 ? "shinR" : "shinL", thigh, [0, -THIGH, 0]);
      knee.box([0, -0.95, 0], [0.9, 2.0, 0.95], C.furD);
      const foot = k.part(side > 0 ? "footR" : "footL", knee, [0, -SHIN, 0]);
      foot.box([0, -FOOT_H / 2, 0.55], [1.2, FOOT_H, 2.3], C.fur)
        .box([0, -FOOT_H / 2 + 0.05, 1.75], [1.0, 0.35, 0.2], C.pinkD);
      return { thigh, knee, foot, side };
    });

    // Scarf: knot at the neck, two trailing tails; chained so each segment inherits the one before.
    const scarf: Part[] = [];
    let parent = torso;
    for (let i = 0; i < 3; i++) {
      const seg = k.part(`scarf${i}`, parent, i === 0 ? [0, 2.5, -0.9] : [0, 0, -1.4]);
      if (i === 0) seg.box([0, 0.15, 0.9], [3.2, 0.55, 2.4], C.scarf); // wrap around the neck
      seg.box([0.2, 0, -0.7], [1.3 - i * 0.15, 0.25, 1.5], i % 2 ? C.scarfD : C.scarf)
        .box([-0.5, -0.1, -0.6], [0.8 - i * 0.1, 0.22, 1.3], C.scarfD);
      scarf.push(seg);
      parent = seg;
    }

    let aura: Part | null = null;
    if (star >= 2) {
      // Blood-moon aura: a thin glowing ring at the feet that pulses (grounded VFX, never below y=0).
      aura = k.part("aura", null, [0, 0.06, 0]);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        aura.box([Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], [1.5, 0.1, 0.35], C.scarf, { mat: "glow", rot: [0, -a + Math.PI / 2, 0] });
      }
    }
    if (star >= 3) {
      // Horned crown and steel shoulder guards with gold rims.
      head.box([0, 2.3, 0.1], [2.4, 0.4, 2.0], C.gold)
        .pair([0.8, 2.75, 0.3], [0.35, 0.8, 0.35], C.gold, { rot: [0, 0, -0.3] })
        .box([0, 2.85, 0.75], [0.45, 0.45, 0.2], C.heart, { mat: "glow" });
      for (const a of arms) a.shoulder.box([0, 0.05, 0], [1.3, 0.6, 1.3], C.steel).box([0, -0.3, 0], [1.4, 0.15, 1.4], C.gold);
    }

    return { hips, torso, head, jaw, eyes, tail, ears, arms, legs, scarf, aura, sword };
  },

  pose(r, c) {
    const { hips, torso, head, jaw, eyes, tail, arms, legs, scarf, aura } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    if (aura) {
      aura.group.rotation.y = T * 0.6;
      aura.group.scale.set(1 + Math.sin(T * 2.4) * 0.05, 1, 1 + Math.sin(T * 2.4) * 0.05);
    }
    const armR = arms[0]!, armL = arms[1]!;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: boxer stance with a breathing bounce; beats cross-fade watch / light step / ready.
          const s = T * 0.38 + c.sig * 2.9, n = Math.floor(s), f = s - n, m = ramp(f, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const watch = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const step = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const ready = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          const bounce = Math.abs(Math.sin(T * 3.2)) * (0.12 + 0.18 * step);
          const dy = -0.55 - 0.25 * ready + bounce;
          const pitch = 0.1 + 0.08 * ready;
          hips.group.position.y += dy;
          torso.group.rotation.x = pitch;
          plantLegs(legs, dy, 0, 0);
          // Light step: feet trade weight (raise only), never slide.
          const shift = Math.sin(T * 3.2) * step;
          if (shift > 0) poseLeg(legs[0]!, 0, -0.1 * shift, 0.5 * shift, 0); else poseLeg(legs[1]!, 0, 0.1 * shift, -0.5 * shift, 0);
          poseArm(armR, -0.9 - 0.2 * ready, 0.15, 1.3 + 0.2 * ready);
          poseArm(armL, -0.7 - 0.2 * ready, 0.2, 1.4);
          clench(armR, 0.6 + 0.4 * ready); clench(armL, 0.6 + 0.4 * ready);
          head.group.rotation.x = -0.06 - 0.06 * ready;
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 4) * 0.25 + Math.sin(T * 2.2 + 1) * 0.06) * (1 - 0.6 * ready);
          jaw.group.rotation.x = 0.05 + 0.2 * ready * Math.max(0, Math.sin(T * 5));
          poseEars(r, T, c.sig, -0.2 - 0.3 * ready, 0.3 * watch, 0.1, 0);
          poseScarf(scarf, T, 0.15 + 0.1 * step, 3 + 2 * step);
          eyes.group.scale.setScalar(1 + 0.25 * ready);
          lid = Math.max(lid, 0.25 * ready);
        } else {
          // Inspection idle: knee bounce (0–.25) → fist clench (.25–.5) → ear shake (.5–.75) →
          // small growl (.75–1). p settles at 1 (≡ knee bounce) so the held idle matches the cycle start.
          const ph = c.p % 1;
          const bounceBeat = 1 - ramp(ph, 0.2, 0.28), fist = win(ph, 0.25, 0.5, 0.06);
          const shake = win(ph, 0.5, 0.76, 0.05), growl = win(ph, 0.74, 1, 0.06);
          const dy = -Math.abs(Math.sin(c.t * 4.5)) * 0.3 * bounceBeat - 0.12 - Math.sin(T * 1.8) * 0.04;
          hips.group.position.y += dy;
          torso.group.rotation.x = 0.04 + 0.06 * growl;
          torso.group.scale.set(1 + Math.sin(T * 1.8) * 0.012, 1 + Math.sin(T * 1.8) * 0.02, 1); // breathing chest
          plantLegs(legs, dy, 0, 0);
          poseArm(armR, -0.25 - 0.55 * fist, 0.12, 0.3 + 1.1 * fist);
          poseArm(armL, -0.15 - 0.35 * fist, 0.12, 0.2 + 0.9 * fist);
          clench(armR, fist * (0.7 + Math.sin(c.t * 14) * 0.3)); clench(armL, fist * 0.6);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.12 + shake * Math.sin(c.t * 18) * 0.12;
          head.group.rotation.x = -0.1 * growl + Math.sin(T * 0.8) * 0.02;
          jaw.group.rotation.x = growl * (0.25 + Math.max(0, Math.sin(c.t * 9)) * 0.1);
          poseEars(r, T, c.sig, 0.1 * growl, 0.6 * (1 - shake), 0.15 + 0.2 * shake, 0.25 * shake);
          poseScarf(scarf, T, 0.05, 2.2);
          eyes.group.scale.setScalar(1 + 0.15 * growl);
          lid = Math.max(lid, 0.3 * growl);
          tail.group.rotation.x = Math.sin(T * 2.3) * 0.08;
        }
        break;
      }
      case "move": {
        // No velocity reaches PoseCtx (callers only play("move")), so gait is a deterministic blend:
        // combat movement is always a dash; out of combat the rabbit takes heavy steps and breaks into
        // the dash with bounding hops after ~0.5–1.1 s of sustained movement (c.p 0.8 → 1.8 cycles).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + 1 * g);
        const lean = 0.08 * wk + 0.35 * g;
        const hop = Math.max(0, Math.sin(w * 2)) * 1.1 * g; // bounding: both feet leave the ground
        const dy = -0.2 * wk + Math.abs(Math.sin(w)) * 0.12 * wk - 0.35 * g + hop;
        hips.group.position.y += dy;
        torso.group.rotation.x = lean;
        for (let i = 0; i < legs.length; i++) {
          const l = legs[i]!, ph = w + (i === 0 ? 0 : Math.PI);
          const stride = Math.sin(ph) * (0.35 * wk + 0.6 * g);
          const lift = Math.max(0, Math.cos(ph)) * (0.9 * wk + 1.4 * g);
          poseLeg(l, Math.max(0, -dy + hop), stride, lift, 0);
        }
        poseArm(armR, Math.sin(w + Math.PI) * (0.4 * wk) - 0.6 * g, 0.1, 0.6 + 0.6 * g);
        poseArm(armL, Math.sin(w) * (0.4 * wk) + 0.7 * g, 0.15, 0.5 + 0.3 * g);
        clench(armR, 0.6); clench(armL, 0.6);
        head.group.rotation.x = -lean * 0.6;
        poseEars(r, T, c.sig, -0.2 * wk - 0.9 * g, 0, 0.1 + 0.3 * g, 0);
        poseScarf(scarf, T, 0.4 * wk + 1 * g, 5 + 6 * g, 0.2 * g);
        tail.group.rotation.x = Math.sin(w * 2) * 0.12;
        break;
      }
      case "attack": {
        // Vung móng vuốt (wind up, 0–.42) → chém vòng cung (crescent swipe, impact .5) → hoàn tất.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.5));
        const swipe = ramp(p, 0.4, 0.58);
        const recover = ramp(p, 0.62, 0.95);
        const lunge = ramp(p, 0.38, 0.5) * (1 - recover);
        const dy = -0.4 * wind - 0.5 * lunge + 0.15 * bell(p, 0.85, 1);
        const dz = -0.4 * wind + 1.2 * lunge;
        hips.group.position.y += dy;
        hips.group.position.z += dz;
        hips.group.rotation.y = 0.5 * wind - 0.6 * swipe * (1 - recover);
        torso.group.rotation.x = -0.05 * wind + 0.22 * lunge;
        torso.group.rotation.y = 0.35 * wind - 0.55 * swipe * (1 - recover);
        plantLegs(legs, dy, -0.4 * wind, 0);
        // Right claw: back and high, then a wide horizontal crescent across the front, then back down.
        poseArm(armR, (-0.4 - 1.0 * wind + 0.2 * swipe) * (1 - recover), (0.9 * wind + 0.6 * swipe) * (1 - recover), 0.9 * wind * (1 - swipe));
        armR.shoulder.group.rotation.y += (-1.4 * swipe + 0.6 * wind) * (1 - recover);
        poseArm(armL, -0.7 + 0.4 * swipe, 0.2, 1.3);
        clench(armL, 0.8);
        head.group.rotation.x = -0.1 * wind + 0.08 * lunge;
        jaw.group.rotation.x = 0.35 * ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.6, 0.8));
        poseEars(r, T, c.sig, -0.6 * (wind + lunge), 0, 0.2, 0);
        poseScarf(scarf, T, 0.3 + 0.6 * lunge, 7, 0);
        eyes.group.scale.setScalar(1 + 0.2 * lunge);
        break;
      }
      case "skill": {
        // Giơ Kiếm Lên Trời: plant feet, raise the sword above the head, swear the oath at impact .5.
        // Crimson sword core + bright eyes + star aura read as debuff protection during the action.
        const p = c.p;
        const raise = ramp(p, 0.07, 0.42) * (1 - ramp(p, 0.72, 0.95));
        const oath = win(p, 0.35, 0.78, 0.04);
        const brace = ramp(p, 0.12, 0.38) * (1 - ramp(p, 0.7, 0.95));
        const dy = -0.35 * brace + 0.12 * bell(p, 0.7, 1);
        hips.group.position.y += dy;
        plantLegs(legs, dy, 0, 0);
        torso.group.rotation.x = 0.1 * brace - 0.16 * oath;
        poseArm(armR, -0.6 - 2.3 * raise, 0.22 * oath, 0.15 * raise);
        poseArm(armL, -0.8 * brace, 0.35 * brace, 1.1 * brace);
        clench(armR, 0.8 + 0.2 * oath);
        clench(armL, 0.4 + 0.6 * brace);
        head.group.rotation.x = -0.18 * raise;
        jaw.group.rotation.x = 0.24 * oath;
        eyes.group.scale.setScalar(1 + 0.75 * oath);
        lid = Math.max(lid * (1 - oath), 0.15 * brace * (1 - oath));
        poseEars(r, T, c.sig, -0.4 * raise, 0.15 * oath, 0.12, 0.2 * oath);
        poseScarf(scarf, T, 0.2 + 0.55 * oath, 5 + 7 * oath, 0.2 * oath);
        if (aura) aura.group.scale.multiplyScalar(1 + 0.22 * oath);
        tail.group.rotation.x = 0.15 * oath;
        break;
      }
      case "hit": {
        // Trúng đòn (eyes shut, ears flinch) → lùi lại (stagger back, guard up) → phục hồi.
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        const dy = -0.35 * k, dz = -0.8 * k;
        hips.group.position.y += dy;
        hips.group.position.z += dz;
        torso.group.rotation.x = -0.25 * k;
        torso.group.rotation.z = 0.1 * k;
        plantLegs(legs, dy, dz, 0);
        poseArm(armR, -1.2 * k, 0.3 * k, 1.6 * k);
        poseArm(armL, -1.0 * k, 0.4 * k, 1.5 * k);
        head.group.rotation.y = shake * 0.15;
        head.group.rotation.x = 0.15 * k - 0.05 * bell(p, 0.7, 1);
        jaw.group.rotation.x = 0.3 * k;
        lid = Math.max(lid, 0.9 * k + (p < 0.08 ? 1 : 0));
        poseEars(r, T, c.sig, 0.7 * k, 0, 0.4 * k, 0.3 * (1 - ramp(p, 0, 0.3)));
        poseScarf(scarf, T, 0.5 * k, 12, 0);
        break;
      }
    }
    // Eyelids are folded into the eye pivot: narrowing squashes the glowing eyes vertically.
    eyes.group.scale.y *= 1 - 0.9 * clamp01(lid);
  },

  death: {
    // Gục xuống: knees buckle (0–.3) → falls forward face down (.2–.5) → nằm yên with a last ear twitch
    // (.5–.7) → tan biến (.7–1, rig shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: RabbitParts, c: DeathCtx) {
      const { hips, torso, head, jaw, eyes, legs, arms, scarf, sword } = r;
      const p = c.p;
      const kneel = ramp(p, 0, 0.3), fall = ramp(p, 0.2, 0.5), twitch = bell(p, 0.5, 0.62);
      const pitch = (Math.PI / 2) * fall; // the whole body tips forward onto its face
      // World leg angles (0 = straight down, + = swung back): the thigh leans slightly forward while
      // kneeling, then lies straight back; the shin folds back flat; the foot always stays level.
      const thighW = -0.15 * kneel * (1 - fall) + (Math.PI / 2) * fall;
      const shinW = (Math.PI / 2) * kneel;
      // Pelvis height = the highest of: sole on the ground through the whole chain, knee joint resting on
      // the ground, and (once tipped) the chest/belly lying on the ground.
      const soleY = 0.05 + FOOT_H + THIGH * Math.cos(thighW) + SHIN * Math.cos(shinW);
      const kneeY = 0.55 + THIGH * Math.cos(thighW);
      // Torso half-depth 1.1 + belt/scarf thickness, plus room for the turned head and the arms that
      // lie stretched on the ground ahead of it.
      const chestY = 1.78 * Math.sin(pitch);
      hips.group.position.y = Math.max(soleY, kneeY, chestY);
      hips.group.position.z += 1.6 * fall;
      hips.group.rotation.x = pitch;
      torso.group.rotation.x = 0.1 * kneel * (1 - fall);
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i]!;
        // Local angles are world angles minus the parent's: thigh under the pitched pelvis, shin under
        // the thigh, foot under the shin (level foot ⇒ foot = −shin world angle).
        l.thigh.group.rotation.x = thighW - pitch;
        l.knee.group.rotation.x = shinW - thighW;
        l.foot.group.rotation.x = -shinW;
      }
      // Face down, "down" in body space is +z: arms reach overhead (they end up stretched forward along
      // the ground) and ears/tips curl toward −z (up in world) so nothing digs into the tile.
      for (let i = 0; i < arms.length; i++) poseArm(arms[i]!, -2.7 * fall, 0.35 * fall, 0.1 * fall);
      // The oath blade dissolves as the rabbit collapses; it cannot clip below the board.
      sword.group.scale.multiplyScalar(1 - ramp(p, 0.1, 0.21));
      head.group.rotation.x = 0.2 * kneel - 0.6 * fall;
      head.group.rotation.y = 0.25 * fall;
      jaw.group.rotation.x = 0.15 * fall;
      eyes.group.scale.set(1, 1 - 0.9 * ramp(p, 0.3, 0.5), 1);
      poseEars(r, c.time, c.sig, -0.5 * fall, 0, -0.45 * fall, 0.2 * twitch);
      poseScarf(scarf, c.time, 0.1, 2, -0.6 * fall);
    },
  },
});
