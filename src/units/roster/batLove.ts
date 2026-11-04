// Dơi Tình Yêu (catalog id bat_blood, kept for save compatibility) — bespoke rig from the approved
// "Dơi Tình Yêu" reference sheet. Round plum bat with huge pink-lined ears, pink two-segment wings,
// big pink eyes, tiny fangs, blush cheeks and a gold heart pendant. Hovers (motion "fly").
// Idle: gentle flap → happy wave → playful tilt → lazy hover · Combat idle: watch / rhythm bob / ready,
// picked per beat by a deterministic hash · Move: slow flap blending into a fast swept-wing dash ·
// Attack: charge → heart shot at impact → settle · Skill (Hôn & Dơi Con): draw heart magic into
// the mouth → release 1/2/3 kisses at impact .55 → hold / settle. Combat damage events distinguish
// kisses from second-hit batlings; the same impact launches each projectile. 2★ golden wing bones;
// 3★ heart crown + gold wing edges.
//
// Wings flap with an inner → outer segment lag; the pendant swings as a lagged pendulum. Flying units
// never touch the ground in life; death lands the body on it (verified by tests/bat-love-rig.test.ts).
import type { Part } from "../kit";
import { bell, defineUnit, ramp, VOXEL, type DeathCtx } from "../rig";

const C = {
  plum: 0x5a2a6e, plumD: 0x3e1a4f, plumL: 0x7a3d8f,
  pink: 0xff6fae, pinkL: 0xffa3cb, pinkD: 0xd9467f, blush: 0xff8fc0,
  eye: 0xff4fa0, pupil: 0x2a0a2a, white: 0xffffff, mouth: 0x5a1030,
  gold: 0xffc43a, goldD: 0xd99a1c, heart: 0xff3d8b,
};

/** Kit-space ground: the "fly" rest height lifts the body 0.42 blocks above the tile. */
export const BAT_GROUND_Y = -0.42 / VOXEL;
/** Lid scale when open: the lid folds up under the brow. */
const LID_OPEN = 0.05;
/** Seconds the outer wing segment trails the inner one (follow-through). */
const WING_LAG = 0.07;
/** Pendant pendulum lag behind the body motion, seconds. */
const PENDANT_LAG = 0.15;
/** Ears splay outward at rest. */
const EAR_SPLAY = 0.28;

interface Wing { inner: Part; outer: Part; side: 1 | -1 }
interface BatParts {
  body: Part; head: Part; lids: Part; mouth: Part; earL: Part; earR: Part;
  pendant: Part; feet: Part; wings: Wing[]; kisses: Part[];
}

// ---------- allocation-free pose helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/**
 * Flap both wings: `raise` lifts them, `amp` is the stroke, `fold` bends the outer segment down/in,
 * `sweep` swings them forward (+) / back (−). The outer segment trails by WING_LAG. Returns the
 * stroke phase (sin) so callers can drive the matching hover bob.
 */
function flap(r: BatParts, time: number, rate: number, amp: number, raise: number, fold: number, sweep: number): number {
  const a = Math.sin(time * rate), b = Math.sin((time - WING_LAG) * rate);
  for (let i = 0; i < r.wings.length; i++) {
    const w = r.wings[i]!;
    w.inner.group.rotation.z += w.side * (raise + a * amp);
    w.inner.group.rotation.y += -w.side * sweep;
    w.outer.group.rotation.z += w.side * (b * amp * 0.8 - fold);
  }
  return a;
}

/** Hover bob paired with the stroke: the body lifts on the downstroke. */
const bobFor = (time: number, rate: number, amp: number) => Math.cos(time * rate) * amp;

/** Ear life: independent twitches per ear on top of the rest splay; `pin` sweeps them back. */
function ears(r: BatParts, time: number, sig: number, pin: number, droop = 0) {
  const tw = (period: number, seed: number) => {
    const u = (time + seed) % period;
    return bell(u, 0, 0.12) - bell(u, 0.12, 0.3) * 0.35;
  };
  r.earR.group.rotation.z += -EAR_SPLAY - tw(3.3, sig * 3) * 0.25 - droop;
  r.earL.group.rotation.z += EAR_SPLAY + tw(4.1, 1.3 + sig * 2) * 0.25 + droop;
  r.earR.group.rotation.x += pin;
  r.earL.group.rotation.x += pin;
}

/** Gold heart pendant: a pendulum lagging behind the body's bob and lean. */
function swingPendant(r: BatParts, time: number, rate: number, amp: number, lean: number) {
  const tt = time - PENDANT_LAG;
  r.pendant.group.rotation.x += -lean + Math.sin(tt * rate) * amp;
  r.pendant.group.rotation.z += Math.sin(tt * rate * 0.5 + 1.2) * amp * 0.6;
}

/** 0 open → 1 shut. ~3.2 s cadence with an occasional double blink, offset per unit. */
function blinkAt(time: number, sig: number): number {
  const u = time + sig * 6.1, a = u % 3.2;
  const second = u % 9.6 < 3.2 ? bell(a, 0.22, 0.35) : 0;
  return Math.max(bell(a, 0, 0.14), second);
}

/** Mouth opening: 0 = small smile, 1 = wide open. Scales from the mouth line downward. */
function openMouth(mouth: Part, k: number) {
  mouth.group.scale.y = 1 + Math.max(0, k) * 1.6;
  mouth.group.scale.x = 1 + Math.max(0, k) * 0.2;
}

/** Deterministic beat pick for combat idle: 0 watch · 1 rhythm bob · 2 ready. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x3c6ef372, 0x85ebca6b) ^ Math.floor(sig * 5281);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

export default defineUnit<BatParts>({
  id: "bat_blood",
  motion: "fly",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    // Round plum body; everything hangs off it so the hover bob moves the whole bat.
    const body = k.part("body", null, [0, 3.4, 0]);
    body.box([0, 0, 0], [3.6, 3.4, 3.2], C.plum)
      .box([0, -0.3, 1.45], [2.4, 2.4, 0.4], C.plumL) // soft belly
      .box([0, 1.8, 0], [2.6, 0.4, 2.4], C.plumD); // fur tuft

    const pendant = k.part("pendant", body, [0, 0.9, 1.75]);
    pendant.box([0, 0, 0], [2.0, 0.18, 0.18], C.gold) // chain
      .pair([0.28, -0.55, 0.12], [0.55, 0.55, 0.25], C.gold) // heart lobes
      .box([0, -0.88, 0.12], [0.5, 0.5, 0.25], C.gold, { rot: [0, 0, Math.PI / 4] })
      .box([0, -0.65, 0.26], [0.42, 0.42, 0.08], C.heart, { mat: "glow" });

    const head = k.part("head", body, [0, 2.6, 0.3]);
    head.box([0, 0.4, 0], [4.4, 3.6, 3.6], C.plum)
      .pair([1.0, 0.6, 1.85], [1.1, 1.2, 0.14], C.eye) // big pink eyes
      .pair([1.05, 0.5, 1.93], [0.6, 0.7, 0.06], C.pupil)
      .pair([0.8, 0.9, 1.97], [0.3, 0.3, 0.04], C.white) // glints
      .box([0, -0.1, 1.86], [0.5, 0.3, 0.12], C.pinkD) // nose
      .pair([1.6, -0.4, 1.82], [0.7, 0.4, 0.08], C.blush) // blush cheeks
      .box([0, 2.25, -0.2], [2.6, 0.3, 2.4], C.plumD);

    const lids = k.part("lids", head, [0, 1.25, 1.96]);
    lids.pair([1.0, -0.62, 0], [1.25, 1.3, 0.08], C.plum);

    const mouth = k.part("mouth", head, [0, -0.62, 1.86]);
    mouth.box([0, -0.17, 0], [1.4, 0.35, 0.1], C.mouth)
      .box([0, -0.25, 0.03], [0.7, 0.18, 0.06], C.pink) // tongue
      .pair([0.45, -0.42, 0.05], [0.22, 0.35, 0.1], C.white); // tiny fangs
    // A separate glowing heart for each star's kiss, all anchored at the mouth, never the pendant.
    const kisses: Part[] = [];
    for (let i = 0; i < star; i++) {
      const heart = k.part(`kiss${i + 1}`, mouth, [0, 0, 0.32]);
      heart.pair([0.17, 0.14, 0], [0.32, 0.3, 0.12], C.pinkL, { mat: "glow" })
        .box([0, -0.08, 0], [0.34, 0.34, 0.13], C.heart, { mat: "glow", rot: [0, 0, Math.PI / 4] });
      kisses.push(heart);
    }

    // Ears: pink-lined, each its own pivot so twitches are independent.
    const ear = (side: 1 | -1) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.5, 2.0, -0.2]);
      e.box([0, 1.8, 0], [1.8, 3.6, 0.7], C.plum)
        .box([0, 1.6, 0.36], [1.1, 2.8, 0.08], C.pinkL)
        .box([0, 3.75, 0], [1.0, 0.5, 0.6], star >= 2 ? C.gold : C.plumD);
      return e;
    };
    const earR = ear(1), earL = ear(-1);

    // Wings: inner (arm) and outer (hand) segments, pink membranes with scalloped trailing edges.
    const wings: Wing[] = ([1, -1] as const).map((side) => {
      const x = (v: number) => side * v;
      const inner = k.part(side > 0 ? "wingRIn" : "wingLIn", body, [x(1.7), 0.9, -0.4]);
      inner.box([x(1.6), 0, 0], [3.2, 0.45, 0.45], star >= 2 ? C.gold : C.plumD) // arm bone
        .box([x(1.5), -1.4, 0], [3.0, 2.6, 0.22], C.pink)
        .box([x(1.8), -2.85, 0], [1.6, 0.5, 0.22], C.pink)
        .box([x(1.5), -1.0, 0.12], [2.2, 0.5, 0.06], C.pinkL);
      const outer = k.part(side > 0 ? "wingROut" : "wingLOut", inner, [x(3.2), 0, 0]);
      outer.box([x(1.8), 0.3, 0], [3.6, 0.4, 0.4], star >= 2 ? C.gold : C.plumD, { rot: [0, 0, side * 0.15] })
        .box([x(1.2), -1.3, 0], [0.25, 2.6, 0.3], C.plumD) // finger bone
        .box([x(1.7), -1.3, 0], [3.4, 2.8, 0.22], C.pink)
        .box([x(0.9), -2.95, 0], [1.2, 0.5, 0.22], C.pink)
        .box([x(2.6), -2.6, 0], [1.0, 0.5, 0.22], C.pink)
        .box([x(3.6), 0.6, 0], [0.4, 0.6, 0.4], C.plumD); // thumb claw
      if (star >= 3) {
        outer.box([x(1.7), -2.75, 0.13], [3.2, 0.18, 0.06], C.gold) // gold trailing edge
          .box([x(2.4), -1.2, 0.13], [0.5, 0.5, 0.06], C.heart, { mat: "glow" });
      }
      return { inner, outer, side };
    });

    const feet = k.part("feet", body, [0, -1.7, 0.2]);
    feet.pair([0.7, -0.5, 0], [0.5, 1.0, 0.5], C.plumD)
      .pair([0.7, -1.05, 0.2], [0.7, 0.25, 0.7], C.pinkD);

    if (star >= 2) {
      // Gold heart on the belly + gold brow band.
      body.box([0, -0.2, 1.68], [0.8, 0.7, 0.08], C.gold);
      head.box([0, 1.95, 1.6], [2.4, 0.25, 0.4], C.goldD);
    }
    if (star >= 3) {
      // Heart crown: gold band, three spikes, glowing pink gem.
      head.box([0, 2.55, 0.1], [2.6, 0.45, 2.4], C.gold);
      for (const xs of [-0.9, 0, 0.9]) head.box([xs, 3.05 + (xs === 0 ? 0.25 : 0), 0.1], [0.45, 0.6 + (xs === 0 ? 0.5 : 0), 0.45], C.gold);
      head.box([0, 2.6, 1.32], [0.6, 0.6, 0.12], C.heart, { mat: "glow" });
    }

    return { body, head, lids, mouth, earL, earR, pendant, feet, wings, kisses };
  },

  pose(r, c) {
    const { body, head, lids, mouth, feet } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    // Outside the skill window, projectile meshes never remain visible after a pose transition.
    for (const heart of r.kisses) heart.group.scale.setScalar(0);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: beats cross-fade watch / rhythm bob / ready.
          const s = T * 0.4 + c.sig * 3.3, n = Math.floor(s), f = s - n, m = ramp(f, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const watch = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const rhythm = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const ready = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          const rate = 8 + 2 * rhythm + 3 * ready;
          flap(r, T, rate, 0.4 + 0.1 * rhythm, 0.1 + 0.15 * ready, 0.1, 0.15 * ready);
          body.group.position.y += bobFor(T, rate, 0.25 + 0.25 * rhythm);
          body.group.rotation.x = 0.08 + 0.12 * ready;
          head.group.rotation.x = -0.05 - 0.08 * ready;
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 4) * 0.3 + Math.sin(T * 2.1 + 1) * 0.06) * (1 - 0.7 * ready);
          openMouth(mouth, 0.25 * ready + 0.08 * rhythm);
          ears(r, T, c.sig, -0.15 * ready);
          swingPendant(r, T, rate, 0.1, body.group.rotation.x);
          lid = Math.max(lid, 0.2 * ready);
        } else {
          // Inspection idle: gentle flap (0–.25) → happy wave (.25–.5) → playful tilt (.5–.75) →
          // lazy hover (.75–1). p settles at 1 (≡ gentle flap) so the held idle matches the cycle start.
          const ph = c.p % 1;
          const wave = win(ph, 0.25, 0.5, 0.05), tilt = win(ph, 0.5, 0.76, 0.06), glide = win(ph, 0.74, 1, 0.06);
          const rate = 6 - 2.5 * glide;
          flap(r, T, rate, 0.32 * (1 - 0.6 * glide), 0.05 + 0.2 * glide, 0.08 * (1 - glide), 0);
          // Happy wave: the right wing waves on its own on top of the flap.
          const rw = r.wings[0]!;
          rw.inner.group.rotation.z += wave * (0.45 + Math.sin(c.t * 12) * 0.3);
          rw.outer.group.rotation.z += wave * Math.sin((c.t - WING_LAG) * 12) * 0.35;
          body.group.position.y += bobFor(T, rate, 0.3 - 0.15 * glide);
          body.group.rotation.z = tilt * Math.sin((ph - 0.5) / 0.26 * Math.PI * 2) * 0.22;
          head.group.rotation.z = -body.group.rotation.z * 0.8 + wave * 0.12;
          head.group.rotation.y = Math.sin(T * 0.6) * 0.1;
          head.group.rotation.x = -0.04 * glide;
          openMouth(mouth, 0.35 * wave);
          lid = Math.max(lid, 0.7 * wave); // squinting "^^" happy eyes
          ears(r, T, c.sig, 0, 0.1 * glide);
          swingPendant(r, T, rate, 0.08, 0);
          feet.group.rotation.x = Math.sin(T * 1.7) * 0.12 + glide * 0.3;
        }
        break;
      }
      case "move": {
        // No velocity reaches PoseCtx (callers only play("move")), so the stroke is a deterministic
        // blend: combat movement is always a dash; out of combat the bat flaps along slowly and breaks
        // into the dash after ~0.5–1.1 s of sustained movement (c.p 0.8 → 1.8 cycles).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const rate = 7 + 8 * g;
        flap(r, T, rate, 0.38 + 0.15 * g, 0.05 - 0.05 * g, 0.08 + 0.2 * g, -0.35 * g);
        body.group.position.y += bobFor(T, rate, 0.3 + 0.1 * g);
        body.group.rotation.x = 0.1 * wk + 0.38 * g;
        body.group.rotation.z = wk * Math.sin(c.p * Math.PI) * 0.06;
        head.group.rotation.x = -0.25 * g; // keep eyes level while the body dives forward
        ears(r, T, c.sig, -0.55 * g);
        feet.group.rotation.x = 0.5 * g;
        openMouth(mouth, 0.1 * g);
        swingPendant(r, T, rate, 0.06, body.group.rotation.x);
        break;
      }
      case "attack": {
        // Chuẩn bị (0–.4) → bắn tia tim (impact .5) → trái tim bay (.5–1, overshoot settle).
        const p = c.p;
        const charge = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.5));
        const shoot = ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.62, 0.9));
        const settle = bell(p, 0.82, 1);
        const rate = 8 + 6 * charge;
        flap(r, T, rate, 0.3, 0.45 * charge - 0.1 * shoot, 0.1, 0.5 * shoot);
        body.group.position.y += bobFor(T, rate, 0.2) + 0.4 * charge;
        body.group.position.z += -0.6 * charge + 0.9 * shoot - 0.15 * settle;
        body.group.rotation.x = -0.12 * charge + 0.22 * shoot - 0.05 * settle;
        head.group.rotation.x = -0.15 * charge + 0.1 * shoot;
        openMouth(mouth, 0.2 * charge + ramp(p, 0.44, 0.5) * (1 - ramp(p, 0.6, 0.82)));
        lid = Math.max(lid, 0.25 * charge);
        ears(r, T, c.sig, -0.35 * shoot);
        swingPendant(r, T, rate, 0.1, body.group.rotation.x);
        break;
      }
      case "skill": {
        // Hearts and eventual batlings originate at the mouth; all skill damage lands at p=.55.
        // Gather (0–.3), mouth launch (.35–.55), impact (.55), settle (.75–1).
        const p = c.p;
        const gather = win(p, 0, 0.3, 0.06);
        const beam = win(p, 0.25, 0.47, 0.04);
        const burst = win(p, 0.45, 0.76, 0.04);
        const end = bell(p, 0.75, 1);
        const rate = 7 + 6 * gather + 4 * burst;
        // Gather wraps the wings forward around the chest; the burst flings them wide open.
        flap(r, T, rate, 0.25 * (1 - burst), 0.15 * gather + 0.65 * burst, 0.35 * gather - 0.1 * burst, 0.9 * gather + 0.35 * beam - 0.25 * burst);
        body.group.position.y += bobFor(T, rate, 0.2) + 1.2 * gather + 0.8 * beam + 0.6 * burst;
        body.group.position.z += 0.7 * beam;
        body.group.rotation.x = 0.1 * gather + 0.2 * beam - 0.22 * burst + 0.04 * end;
        body.group.rotation.y = Math.sin(clamp01(p / 0.3) * Math.PI * 2) * 0.25 * gather; // swirl while charging
        head.group.rotation.x = 0.12 * gather - 0.1 * beam + 0.12 * burst;
        openMouth(mouth, 0.15 * gather + 0.8 * beam + 0.6 * burst);
        lid = Math.max(lid, 0.4 * gather);
        ears(r, T, c.sig, -0.3 * beam + 0.15 * burst);
        swingPendant(r, T, rate, 0.12 + 0.1 * burst, body.group.rotation.x);
        feet.group.rotation.x = 0.4 * burst;
        const flight = ramp(p, 0.36, 0.55);
        const visibility = ramp(p, 0.34, 0.43) * (1 - ramp(p, 0.59, 0.76));
        for (let i = 0; i < r.kisses.length; i++) {
          const heart = r.kisses[i]!;
          heart.group.position.x = (i - (r.kisses.length - 1) / 2) * (0.38 + 0.7 * flight);
          heart.group.position.z = 0.32 + 3.4 * flight;
          heart.group.rotation.z = Math.sin(p * 18 + i) * 0.2;
          heart.group.scale.setScalar(visibility * (0.8 + 0.3 * burst));
        }
        break;
      }
      case "hit": {
        // Trúng đòn (eyes shut, ears fold) → lùi lại (recoil, wings flail) → phục hồi (inhale).
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        const inhale = bell(p, 0.7, 1);
        flap(r, T, 16, 0.2 + 0.2 * k, 0.3 * k, 0.3 * k, 0);
        body.group.position.y += bobFor(T, 16, 0.12) - 0.4 * k;
        body.group.position.z += -0.8 * k;
        body.group.rotation.x = -0.25 * k;
        body.group.rotation.z = 0.18 * k;
        head.group.rotation.y = shake * 0.15;
        head.group.rotation.z = shake * 0.08;
        head.group.rotation.x = -0.08 * inhale;
        openMouth(mouth, 0.5 * k);
        lid = Math.max(lid, 0.9 * k + (p < 0.08 ? 1 : 0));
        ears(r, T, c.sig, 0.5 * k, 0.35 * k);
        swingPendant(r, T, 12, 0.2 * k + 0.05, body.group.rotation.x);
        body.group.scale.set(1 + 0.04 * inhale, 1 + 0.06 * inhale, 1);
        break;
      }
    }
    lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * clamp01(lid);
  },

  death: {
    // Gục xuống: drops from the hover to the ground (0–.35) → nằm yên: wings fold flat, face down, a last
    // twitch (.35–.7) → tan biến (.7–1, rig shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: BatParts, c: DeathCtx) {
      const { body, head, lids, mouth, feet, wings } = r;
      const p = c.p;
      // Gravity-like fall (ease-in) with a small bounce on contact.
      const t = clamp01(p / 0.35), fall = t * t, bounce = bell(p, 0.35, 0.45) * 0.4;
      // Wings fold flat while falling, so they are flat by the time the body lands.
      const splay = ramp(p, 0.05, 0.4), twitch = bell(p, 0.5, 0.6);
      // Lying height: body bottom (1.7 below its pivot) rests just above the ground. While the hanging
      // membranes (≈3.3 below the pivot) are still folding, the body is held high enough to clear them.
      // The lying tilt lowers the body box's front-bottom corner (half-depth 1.6, plus the belly patch).
      const tilt = 0.25 * splay;
      const restY = BAT_GROUND_Y + 1.7 * Math.cos(tilt) + 1.85 * Math.sin(tilt) + 0.15;
      const clearance = restY + 3.3 * (1 - splay);
      body.group.position.y = Math.max(3.4 + (restY - 3.4) * fall, Math.min(3.4, clearance)) + bounce;
      body.group.rotation.x = tilt;
      body.group.rotation.z = 0.08 * splay;
      for (let i = 0; i < wings.length; i++) {
        const w = wings[i]!;
        // Fold the membranes flat behind the bone (rotate about the bone axis), wings spread on the ground.
        w.inner.group.rotation.x = (Math.PI / 2) * splay;
        w.inner.group.rotation.z = w.side * (0.4 * (1 - splay) - 0.05 * splay);
        w.outer.group.rotation.z = w.side * (-0.15 * splay + 0.1 * twitch);
      }
      feet.group.rotation.x = (Math.PI / 2) * splay; // tucked back, flat
      head.group.rotation.x = 0.2 * splay;
      r.earR.group.rotation.z = -EAR_SPLAY - 0.5 * splay;
      r.earL.group.rotation.z = EAR_SPLAY + 0.5 * splay;
      r.earR.group.rotation.x = r.earL.group.rotation.x = 0.6 * splay;
      lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * Math.max(ramp(p, 0.1, 0.3), bell(p, 0, 0.08));
      openMouth(mouth, 0.3 * splay);
      r.pendant.group.rotation.x = -0.25 * splay; // lies flat against the chest
    },
  },
});
