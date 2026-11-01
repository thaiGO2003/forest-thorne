// Kiến Hộ Vệ (ant_guard) — bespoke rig from the approved reference sheet (Kiến Hộ Vệ concept board).
// Russet armoured ant: mossy leaf plates on head/thorax/gaster, glowing amber resin seams, big dark
// eyes, cream tusk mandibles, elbowed antennae with moss tips, six legs; the forelegs carry leaf shields.
// Idle: watch → antenna groom → mandible click → gaster pulse · Combat idle: brace / shields up / clack,
// picked per beat by a deterministic hash · Move: alternating tripod walk blending into a fast scuttle ·
// Attack: rear back → lunge + mandible snap at impact → settle · Skill: brace → amber resin dome rises
// (impact) → hold + regen pulse → dome recedes with a cleansing shake-off (Tự vệ / Thanh tẩy panels) ·
// Hit: shields block, head shake, recover · Death: legs buckle and splay, body settles, curls, vanishes.
// 2★ adds amber resin plates and a second leaf on each shield; 3★ adds resin spikes, an amber crown
// and glass resin shoulder guards.
//
// Feet stay planted: every state that lowers, pitches or rolls the thorax re-solves each leg through
// `ground` (femur roll + vertical tibia), verified by tests/ant-guard-rig.test.ts.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  brown: 0x7a4424, brownD: 0x4e2a16, brownL: 0x9a5a30,
  moss: 0x8fb03a, mossD: 0x5f7f22, mossL: 0xb8d65a,
  amber: 0xffa81e, resin: 0xffc04a, eye: 0x1a0f08, glint: 0xfff3c0, tusk: 0xf3ead2,
};

/** Thorax pivot height: feet rest on y ≈ 0.05. */
const THORAX_Y = 4.2;
/** Hip pivots under the thorax (y) and the femur's knee offset (outward, up). */
const HIP_X = 1.4, HIP_Y = -0.6, KNEE_OUT = 2.5, KNEE_UP = 1.0;
/** Knee → sole bottom with a vertical tibia. */
const TIBIA = 4.55;
/** Femur radius and its rest elevation angle (atan(up / out)). */
const FEMUR = Math.hypot(KNEE_OUT, KNEE_UP), FEMUR_A = Math.atan2(KNEE_UP, KNEE_OUT);
/** Horizontal hip → foot radius used to turn a body shift into a leg swing. */
const REACH = KNEE_OUT + 0.3;
/** Leg pair z offsets on the thorax: front, middle, hind. */
const PAIR_Z = [1.1, 0, -1.1] as const;
/** Seconds of follow-through lag from an antenna base to its tip. */
const ANT_LAG = 0.08;

interface Leg { hip: Part; knee: Part; side: 1 | -1; pair: 0 | 1 | 2; tripod: 0 | 1 }
interface AntParts {
  thorax: Part; gaster: Part; head: Part; mandL: Part; mandR: Part;
  antL: Part; antLTip: Part; antR: Part; antRTip: Part;
  legs: Leg[]; dome: Part;
}

// ---------- allocation-free pose helpers ----------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));

/**
 * Raise the knee by `rise` voxels over rest (body sank `rise`, or a swing lift) by rolling the femur
 * up, while the tibia counter-rotates to stay vertical. Clamped to the femur's reach.
 */
function liftLeg(l: Leg, rise: number) {
  const th = Math.asin(Math.max(-1, Math.min(1, (KNEE_UP + rise) / FEMUR))) - FEMUR_A;
  l.hip.group.rotation.z += l.side * th;
  l.knee.group.rotation.z -= l.side * th;
}
/** Swing a leg forward (+) or back (−) about the hip's vertical axis. */
function swingLeg(l: Leg, a: number) {
  l.hip.group.rotation.y += -l.side * a;
}

/**
 * Keep every planted leg's foot on the ground after the thorax moved by `dy` (≤0 lowers), pitched by
 * `pitch` (+ = nose down), rolled by `roll`, and shifted forward by `dz`. Tibias counter-rotate so they
 * stay vertical in world space. `skip` = index of a leg that is lifted on purpose (or -1).
 */
function ground(legs: readonly Leg[], dy: number, pitch: number, roll: number, dz: number, skip = -1) {
  const sp = Math.sin(pitch), sr = Math.sin(roll);
  const slide = Math.asin(Math.max(-0.6, Math.min(0.6, dz / REACH)));
  for (let i = 0; i < legs.length; i++) {
    if (i === skip) continue;
    const l = legs[i]!;
    liftLeg(l, -dy + PAIR_Z[l.pair] * sp - l.side * HIP_X * sr);
    swingLeg(l, -slide);
    l.knee.group.rotation.x -= pitch;
    l.knee.group.rotation.z -= roll;
  }
}

/** Antenna pose with base → tip follow-through: `yaw` sweeps, `lift` raises (−) / folds (+). */
function antenna(base: Part, tip: Part, time: number, yaw: number, lift: number, flick: number, side: 1 | -1) {
  base.group.rotation.y += side * yaw;
  base.group.rotation.x += lift;
  const tt = time - ANT_LAG;
  tip.group.rotation.x += 0.35 + lift * 0.4 + Math.sin(tt * 3.1 + side) * 0.06 + flick;
  tip.group.rotation.y += side * Math.sin(tt * 2.3 + side * 0.7) * 0.08;
}

/** Mandibles open outward symmetrically by `open` radians. */
function mandibles(r: AntParts, open: number) {
  r.mandR.group.rotation.y += open;
  r.mandL.group.rotation.y -= open;
}

/** Gaster breathing: a slow lagged pulse, scaled from its front pivot so it swells backward. */
function breatheGaster(gaster: Part, time: number, rate: number, amp: number) {
  const b = Math.sin(time * rate);
  gaster.group.scale.set(1 + b * 0.025 * amp, 1 + b * 0.035 * amp, 1 + b * 0.02 * amp);
}

/** Deterministic beat pick for combat idle: 0 brace · 1 shields up · 2 mandible clack. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x165667b1, 0x85ebca6b) ^ Math.floor(sig * 4099);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

/** Raise both foreleg leaf shields in front of the head (guard pose). */
function shieldsUp(legs: readonly Leg[], k: number) {
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i]!;
    if (l.pair !== 0 || k <= 0) continue;
    liftLeg(l, 1.0 * k);
    swingLeg(l, 0.45 * k);
    l.knee.group.rotation.y += -l.side * 0.5 * k; // turn the leaf face forward
  }
}

/** Resin dome scale: 0 hides it (the mesh is skipped), 1 = fully formed. Grows up from the ground. */
function setDome(dome: Part, k: number, pulse = 0) {
  const s = Math.max(0, k);
  dome.group.visible = s > 0.02;
  // Hidden: collapse every axis so portrait/card framing (which unions all meshes) ignores the dome.
  if (!dome.group.visible) { dome.group.scale.setScalar(0.001); return; }
  dome.group.scale.set(0.85 + 0.15 * s + pulse, s + pulse, 0.85 + 0.15 * s + pulse);
}

export default defineUnit<AntParts>({
  id: "ant_guard",
  motion: "ground",
  height: 9,
  durations: { idle: 4.5, attack: 0.85, skill: 1.6, hit: 0.5, move: 0.7 },
  impact: { attack: 0.5, skill: 0.5 },
  blend: 0.1,

  build(k, { star }) {
    const thorax = k.part("thorax", null, [0, THORAX_Y, 0.4]);
    thorax.box([0, 0, 0], [3.0, 2.4, 3.4], C.brown)
      .box([0, -1.0, 0], [2.4, 0.6, 3.0], C.brownD) // underside
      .box([0, 1.35, 0.1], [2.8, 0.5, 2.8], C.moss)
      .spots([0, 1.35, 0.1], [2.8, 0.5, 2.8], C.mossL, 5, 41, 0.7)
      .pair([1.52, 0.2, 0], [0.12, 0.3, 2.6], C.amber, { mat: "glow" }) // resin seams on the flanks
      .box([0, 0.2, -1.9], [1.4, 1.2, 1.0], C.brownD); // petiole (waist)

    // Gaster hangs off the waist; its own pivot lets it lift, droop and breathe.
    const gaster = k.part("gaster", thorax, [0, 0.5, -2.4]);
    gaster.box([0, 0.3, -2.5], [4.4, 3.8, 5.0], C.brown)
      .box([0, -1.3, -2.3], [3.6, 1.0, 4.2], C.brownD)
      .box([0, 2.3, -2.4], [3.8, 0.6, 3.8], C.moss)
      .box([0, 2.05, -0.5], [3.0, 0.5, 0.9], C.mossD) // leaf lip
      .spots([0, 2.3, -2.4], [3.8, 0.6, 3.8], C.mossL, 7, 43, 0.9)
      .pair([2.22, 0.6, -2.5], [0.12, 0.3, 3.6], C.amber, { mat: "glow" }) // amber cracks
      .pair([2.22, -0.2, -1.6], [0.12, 1.4, 0.3], C.amber, { mat: "glow" })
      .box([0, 1.0, -5.03], [2.4, 0.3, 0.12], C.amber, { mat: "glow" });

    const head = k.part("head", thorax, [0, 0.5, 1.6]);
    head.box([0, 0.3, 1.4], [3.6, 2.8, 2.8], C.brown)
      .box([0, 1.85, 1.3], [3.2, 0.5, 2.4], C.moss)
      .spots([0, 1.85, 1.3], [3.2, 0.5, 2.4], C.mossL, 4, 47, 0.6)
      .pair([1.15, 0.55, 2.82], [1.0, 1.0, 0.2], C.eye) // big dark eyes
      .pair([1.35, 0.85, 2.94], [0.3, 0.3, 0.06], C.glint)
      .pair([1.2, 1.25, 2.75], [1.1, 0.3, 0.3], C.mossD) // brow ridge
      .box([0, -0.4, 2.85], [1.6, 0.5, 0.15], C.amber, { mat: "glow" }); // resin lip

    // Tusk mandibles: each its own pivot so they open outward and snap shut.
    const mand = (side: 1 | -1) => {
      const m = k.part(side > 0 ? "mandR" : "mandL", head, [side * 0.75, -0.75, 2.6]);
      m.box([0, 0, 0.5], [0.7, 0.7, 1.2], C.tusk)
        .box([-side * 0.25, -0.1, 1.25], [0.5, 0.5, 0.6], C.tusk);
      return m;
    };
    const mandR = mand(1), mandL = mand(-1);

    // Elbowed antennae: scape rises from the head, the flagellum (tip pivot) reaches forward.
    const ant = (side: 1 | -1) => {
      const base = k.part(side > 0 ? "antR" : "antL", head, [side * 0.9, 1.7, 2.3]);
      base.box([0, 1.0, 0.25], [0.4, 2.1, 0.4], C.brown, { rot: [-0.25, 0, 0] });
      const tip = k.part(side > 0 ? "antRTip" : "antLTip", base, [0, 2.0, 0.55]);
      tip.box([0, 0, 1.1], [0.38, 0.38, 2.2], C.brownD)
        .box([0, 0, 2.3], [0.6, 0.6, 0.6], C.mossL);
      return { base, tip };
    };
    const aR = ant(1), aL = ant(-1);

    // Six legs: femur rises outward to the knee, tibia drops to the foot. Tripods: {L1, R2, L3} / {R1, L2, R3}.
    const legs: Leg[] = [];
    for (const pair of [0, 1, 2] as const) for (const side of [-1, 1] as const) {
      const tag = `${pair}${side > 0 ? "R" : "L"}`;
      const hip = k.part(`hip${tag}`, thorax, [side * HIP_X, HIP_Y, PAIR_Z[pair]]);
      hip.box([side * KNEE_OUT / 2, KNEE_UP / 2, 0], [FEMUR + 0.4, 0.75, 0.75], C.brown, { rot: [0, 0, side * FEMUR_A] });
      const knee = k.part(`knee${tag}`, hip, [side * KNEE_OUT, KNEE_UP, 0]);
      knee.box([0, 0, 0], [0.9, 0.9, 0.9], C.mossD) // knee joint
        .box([0, -2.1, 0], [0.7, 4.2, 0.7], C.brownD)
        .box([side * 0.2, -4.3, 0.15], [1.0, 0.5, 1.1], C.brownL); // foot
      if (pair === 0) {
        // Leaf shield on each foreleg, face outward at rest; guard turns it forward.
        knee.box([side * 0.55, -1.9, 0.7], [0.3, 2.8, 2.6], C.moss)
          .box([side * 0.72, -1.9, 0.7], [0.08, 2.4, 0.3], C.mossD)
          .box([side * 0.72, -1.9, 0.7], [0.08, 0.3, 2.2], C.mossD);
        if (star >= 2) knee.box([side * 0.75, -2.6, 1.3], [0.25, 1.8, 1.6], C.mossL); // second leaf
        if (star >= 2) knee.box([side * 0.78, -1.9, 0.7], [0.1, 0.6, 0.6], C.amber, { mat: "glow" });
      }
      const tripod: 0 | 1 = (pair === 1) === (side < 0) ? 1 : 0;
      legs.push({ hip, knee, side, pair, tripod });
    }

    // Amber resin dome (glass), centred on the body; hidden until the skill/guard raises it.
    const dome = k.part("dome", null, [0, 0, -0.6]);
    dome.box([0, 1.6, 0], [10.5, 3.2, 13.6], C.resin, { mat: "glass" })
      .box([0, 4.3, 0], [9.0, 2.2, 11.8], C.resin, { mat: "glass" })
      .box([0, 6.3, 0], [7.0, 1.8, 9.0], C.resin, { mat: "glass" })
      .box([0, 7.7, 0], [4.5, 1.0, 5.6], C.resin, { mat: "glass" });

    if (star >= 2) {
      // Amber resin plates on the thorax and a resin cross on the gaster.
      thorax.box([0, 1.7, 0.1], [1.2, 0.3, 1.6], C.amber, { mat: "glow" });
      gaster.box([0, 2.7, -2.4], [0.6, 0.3, 3.4], C.amber, { mat: "glow" })
        .box([0, 2.7, -2.4], [3.0, 0.3, 0.6], C.amber, { mat: "glow" });
      head.pair([1.0, 2.15, 1.0], [0.5, 0.4, 0.5], C.amber, { mat: "glow" });
    }
    if (star >= 3) {
      // Resin spikes along the gaster, an amber crown, and glass resin shoulder guards.
      for (const [z, h] of [[-1.2, 1.2], [-2.4, 1.6], [-3.6, 1.2]] as const) {
        gaster.box([0, 2.6 + h / 2, z], [0.6, h, 0.6], C.amber, { mat: "glow" });
      }
      head.box([0, 2.3, 1.6], [1.6, 0.4, 0.5], C.amber, { mat: "glow" })
        .box([0, 2.7, 1.6], [0.5, 0.5, 0.5], C.amber, { mat: "glow" });
      thorax.pair([1.7, 0.8, 0.3], [0.6, 1.4, 2.6], C.resin, { mat: "glass" });
    }

    return { thorax, gaster, head, mandL, mandR, antL: aL.base, antLTip: aL.tip, antR: aR.base, antRTip: aR.tip, legs, dome };
  },

  pose(r, c) {
    const { thorax, gaster, head, antL, antLTip, antR, antRTip, legs, dome } = r;
    const T = c.time;
    setDome(dome, 0);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: low wide stance + breathing bob; beats cross-fade brace / shields up / clack.
          const s = T * 0.37 + c.sig * 2.3, n = Math.floor(s), f = s - n, m = ramp(f, 0.72, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const brace = (a === 0 ? 1 - m : 0) + (b === 0 ? m : 0);
          const guard = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const clack = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          const br = Math.sin(T * 2.5);
          const dy = -0.55 + br * 0.08 - 0.15 * brace;
          const pitch = 0.05 + 0.04 * brace;
          thorax.group.position.y += dy;
          thorax.group.rotation.x = pitch;
          ground(legs, dy, pitch, 0, 0);
          shieldsUp(legs, guard);
          head.group.rotation.x = 0.06 + 0.06 * brace - 0.04 * guard;
          head.group.rotation.y = (Math.sin(T * 0.85 + c.sig * 5) * 0.2 + Math.sin(T * 2.2 + 1) * 0.05) * (1 - 0.6 * guard);
          mandibles(r, 0.12 + 0.1 * brace + clack * Math.max(0, Math.sin(T * 13)) * 0.35);
          antenna(antL, antLTip, T, 0.15 + Math.sin(T * 1.7) * 0.08, -0.15 - 0.15 * brace, 0, -1);
          antenna(antR, antRTip, T + 0.4, 0.15 + Math.sin(T * 1.9 + 1) * 0.08, -0.15 - 0.15 * brace, 0, 1);
          gaster.group.rotation.x = -0.05 + br * 0.02;
          breatheGaster(gaster, T, 2.5, 1.3);
        } else {
          // Inspection idle: watch (0–.28) → groom (.28–.52) → mandible click (.52–.76) → gaster pulse (.76–1).
          // p settles at 1 (≡ watch) so the held idle matches where the cycle starts and ends.
          const ph = c.p % 1;
          const watch = 1 - ramp(ph, 0.22, 0.3), groom = win(ph, 0.28, 0.54, 0.07);
          const click = win(ph, 0.52, 0.78, 0.05), pulse = win(ph, 0.74, 1, 0.06);
          breatheGaster(gaster, T, 1.8 + c.sig * 0.4, 1 + 1.5 * pulse);
          const scan = Math.sin(clamp01(ph / 0.28) * Math.PI * 2) * 0.25 * watch;
          head.group.rotation.y = scan + Math.sin(T * 0.6) * 0.05;
          head.group.rotation.z = -groom * 0.18;
          head.group.rotation.x = groom * 0.12 + click * Math.sin(c.t * 9) * 0.03;
          // Groom: left foreleg rises to wipe the bent left antenna; its foot leaves the ground.
          ground(legs, 0, 0, 0, 0, 0);
          liftLeg(legs[0]!, 1.2 * groom);
          swingLeg(legs[0]!, 0.55 * groom + Math.sin(c.t * 10) * 0.08 * groom);
          mandibles(r, 0.05 + click * Math.max(0, Math.sin(c.t * 16)) * 0.3);
          antenna(antL, antLTip, T, Math.sin(T * 1.3) * 0.25 * watch, -0.1 + 0.55 * groom, Math.sin(c.t * 12) * 0.15 * groom, -1);
          antenna(antR, antRTip, T + 0.7, Math.sin(T * 1.1 + 2) * 0.25 * watch, -0.1, 0, 1);
          gaster.group.rotation.x = -0.12 * pulse + Math.sin(T * 1.8) * 0.015;
        }
        break;
      }
      case "move": {
        // No velocity reaches PoseCtx (callers only play("move")), so gait is a deterministic blend:
        // combat movement is always a scuttle; out of combat the ant walks and breaks into the scuttle
        // after ~0.55–1.25 s of sustained movement (c.p 0.8 → 1.8 cycles).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const wp = c.p * (0.5 * wk + 1 * g); // walk cycles at half the scuttle rate
        const amp = 0.32 * wk + 0.5 * g, liftH = 0.6 * wk + 1.0 * g;
        const dy = -0.3 * g + Math.abs(Math.sin(wp * Math.PI * 2)) * 0.1;
        const pitch = 0.06 * g;
        thorax.group.position.y += dy;
        thorax.group.rotation.x = pitch;
        for (let i = 0; i < legs.length; i++) {
          const l = legs[i]!;
          // Tripods alternate; within a tripod the hind leg trails slightly for a ripple.
          const u = (wp + l.tripod * 0.5 + l.pair * 0.04) % 1;
          const stance = u < 0.5, sw = stance ? 0 : (u - 0.5) / 0.5;
          const a = stance ? amp * (1 - 4 * u) : -amp + 2 * amp * ramp(sw, 0, 1);
          swingLeg(l, a);
          liftLeg(l, -dy + PAIR_Z[l.pair] * Math.sin(pitch) + (stance ? 0 : Math.sin(sw * Math.PI) * liftH));
          l.knee.group.rotation.x -= pitch;
        }
        head.group.rotation.x = -0.05 * g + Math.sin(wp * Math.PI * 4) * 0.02;
        head.group.rotation.y = wk * Math.sin(wp * Math.PI * 2) * 0.08;
        mandibles(r, 0.06);
        antenna(antL, antLTip, T, wk * Math.sin(T * 2.2) * 0.2, -0.1 + 0.45 * g, 0, -1);
        antenna(antR, antRTip, T + 0.5, wk * Math.sin(T * 2.4 + 1) * 0.2, -0.1 + 0.45 * g, 0, 1);
        gaster.group.rotation.x = -0.04 + Math.sin(wp * Math.PI * 4 + 0.8) * (0.03 + 0.04 * g);
        breatheGaster(gaster, T, 2.5 + 3 * g, 0.6);
        break;
      }
      case "attack": {
        // Rear back with mandibles spread → lunge, mandibles snap shut at impact (0.5) → settle.
        const p = c.p;
        const load = ramp(p, 0, 0.32) * (1 - ramp(p, 0.32, 0.42));
        const reach = ramp(p, 0.34, 0.5) * (1 - ramp(p, 0.6, 0.88));
        const settle = bell(p, 0.82, 1);
        const dy = -0.35 * load - 0.25 * reach;
        const dz = -0.6 * load + 1.6 * reach - 0.2 * settle;
        const pitch = -0.1 * load + 0.12 * reach - 0.03 * settle;
        thorax.group.position.y += dy;
        thorax.group.position.z += dz;
        thorax.group.rotation.x = pitch;
        ground(legs, dy, pitch, 0, -0.6 * load);
        head.group.rotation.x = -0.22 * load + 0.2 * reach;
        mandibles(r, 0.55 * ramp(p, 0.05, 0.4) * (1 - ramp(p, 0.44, 0.5)) - 0.04 * bell(p, 0.48, 0.6));
        antenna(antL, antLTip, T, 0.1, 0.3 * (load + reach), 0, -1);
        antenna(antR, antRTip, T, 0.1, 0.3 * (load + reach), 0, 1);
        gaster.group.rotation.x = 0.1 * load - 0.08 * reach;
        breatheGaster(gaster, T, 4, 0.8);
        break;
      }
      case "skill": {
        // Brace (0–.2) → resin dome rises (.2–.5, impact .5) → hold + regen pulse (.5–.72) →
        // dome recedes with a cleansing shake-off (.72–1).
        const p = c.p;
        const brace = win(p, 0, 0.8, 0.12);
        const rise = ramp(p, 0.2, 0.5), recede = ramp(p, 0.72, 0.9);
        const hold = win(p, 0.5, 0.74, 0.04);
        const shake = win(p, 0.74, 0.96, 0.04);
        const roll = Math.sin(c.t * 38) * 0.05 * shake;
        const dy = -0.6 * brace;
        thorax.group.position.y += dy;
        thorax.group.rotation.x = 0.06 * brace;
        thorax.group.rotation.z = roll;
        ground(legs, dy, 0.06 * brace, roll, 0);
        shieldsUp(legs, brace * (1 - shake));
        setDome(dome, rise * (1 - recede) + 0.06 * bell(p, 0.46, 0.58), hold * Math.sin(c.t * 9) * 0.02);
        head.group.rotation.x = 0.28 * brace * (1 - shake) - 0.1 * shake;
        head.group.rotation.y = Math.sin(c.t * 34) * 0.08 * shake;
        mandibles(r, 0.04 + 0.2 * shake * Math.max(0, Math.sin(c.t * 20)));
        antenna(antL, antLTip, T, -0.1, 0.5 * brace * (1 - shake), Math.sin(c.t * 30) * 0.3 * shake, -1);
        antenna(antR, antRTip, T, -0.1, 0.5 * brace * (1 - shake), Math.sin(c.t * 30 + 1) * 0.3 * shake, 1);
        gaster.group.rotation.x = 0.06 * brace - 0.08 * hold;
        breatheGaster(gaster, T, 6, 1 + 2.5 * hold);
        break;
      }
      case "hit": {
        // Trúng đòn (shields snap up, head shake) → lùi (recoil back, braced) → phục hồi (settle).
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        const dz = -0.7 * k, pitch = -0.1 * k;
        thorax.group.position.z += dz;
        thorax.group.rotation.x = pitch;
        ground(legs, 0, pitch, 0, dz);
        shieldsUp(legs, 0.8 * k);
        head.group.rotation.x = 0.15 * k;
        head.group.rotation.y = shake * 0.12;
        mandibles(r, 0.25 * k);
        antenna(antL, antLTip, T, -0.2 * k, 0.6 * k, 0, -1);
        antenna(antR, antRTip, T, -0.2 * k, 0.6 * k, 0, 1);
        gaster.group.rotation.x = 0.1 * k - 0.04 * bell(p, 0.7, 1);
        breatheGaster(gaster, T, 6, 0.6);
        break;
      }
    }
  },

  death: {
    // Legs buckle (0–.35) → body settles low, legs splay (.25–.6) → legs curl, antennae droop (.55–.75)
    // → vanish (.7–1, rig shrink-out). Kept under 1 s: tanks drop heavily.
    seconds: 0.9,
    vanishAt: 0.7,
    pose(r: AntParts, c: DeathCtx) {
      const { thorax, gaster, head, antL, antLTip, antR, antRTip, legs } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.35), splay = ramp(p, 0.25, 0.6), curl = ramp(p, 0.55, 0.75);
      // Lower until the underside rests just above the ground (thorax underside is 1.3 below the pivot).
      const drop = 2.6 * fall;
      thorax.group.position.y -= drop;
      thorax.group.rotation.z = 0.08 * splay;
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i]!;
        // Femur rolls up as far as it reaches, then the tibia splays outward so the foot stays above y=0.
        const rise = Math.min(drop, FEMUR - KNEE_UP - 0.05);
        liftLeg(l, rise);
        const kneeY = THORAX_Y - drop + HIP_Y + KNEE_UP + rise - l.side * HIP_X * Math.sin(0.08 * splay);
        const beta = Math.acos(Math.max(0, Math.min(1, (kneeY - 0.35) / TIBIA)));
        l.knee.group.rotation.z += l.side * (beta + 0.25 * splay) + l.side * 0.5 * curl;
      }
      head.group.rotation.x = 0.25 * fall;
      gaster.group.rotation.x = -0.04 * fall;
      antenna(antL, antLTip, c.time, 0.2 * splay, 0.9 * fall, 0.3 * curl, -1);
      antenna(antR, antRTip, c.time, 0.2 * splay, 0.9 * fall, 0.3 * curl, 1);
      mandibles(r, 0.2 * fall);
    },
  },
});
