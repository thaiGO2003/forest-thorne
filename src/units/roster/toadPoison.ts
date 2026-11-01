// Cóc Độc (toad_poison) — bespoke rig distilled from the approved concept sheet.
// Squat moss-green toad: wide flat body, pale cream belly, pink chin/throat, heavy brow with yellow
// slit eyes, dark moss tufts, big purple poison sacs on both flanks, stubby limbs with cream toes.
// Idle: settle → blink → throat puff → sac wobble, with a crouched combat idle. Move: waddle → hop.
// Attack: inhale → spit at impact → recover. Skill (Sương Độc): sacs pump → throat swells → sweeping
// mist spray → settle. Hit: jolt → recoil → recover. Death: collapse flat → last breath → vanish.
// 2★ adds a leather harness + satchel; 3★ adds a leaf crown and glowing toxin on every sac.
//
// Grounding: the torso pivot sits at TORSO_Y; every pose that lowers it counter-translates the limbs
// so the soles stay on y≈0 (verified by tests/toad-poison-rig.test.ts).
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike, type DeathCtx } from "../rig";

const C = {
  green: 0x8fbf3f, greenL: 0xa9d855, greenD: 0x5f7f28, moss: 0x3f4f1c, mossD: 0x2e3a14,
  cream: 0xf1e6c6, creamD: 0xdccfae, pink: 0xe98fb0, pinkD: 0xc96e93, mouth: 0xb84f74,
  purple: 0x8e2fbe, purpleL: 0xc05cf0, purpleD: 0x5c1a80,
  eye: 0xffe14d, ink: 0x1a1408, toe: 0xf3eddc,
  leather: 0x6b4226, leatherD: 0x3f2413, leaf: 0x4c9a2f, leafL: 0x82c94a, toxin: 0xb6ff4a, wood: 0x8a5a30,
};

/** Torso pivot height in voxels; feet rest on y≈0 when the body is here. */
const TORSO_Y = 2.6;
/** Lid scale when open: the lid folds up under the brow. */
const LID_OPEN = 0.06;
/** Sac rest positions in body space, in build order, so the skill can push them without floats. */
const SAC_REST: readonly { x: number; y: number; z: number }[] = [
  { x: -4.7, y: 0.3, z: -0.9 }, { x: 4.8, y: 0.45, z: -0.8 }, { x: 0.2, y: 1.2, z: -3.5 },
  { x: -3.4, y: 1.9, z: -2.7 }, { x: 3.5, y: 2.0, z: -2.8 }, { x: 0.6, y: 2.7, z: -2.2 },
];

interface ToadParts {
  body: Part; belly: Part; head: Part; jaw: Part; lids: Part; throat: Part;
  armL: Part; armR: Part; legL: Part; legR: Part;
  sacs: Part[];
  pouch: Part | null;
  crown: Part | null;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
/** Freeze progress at `a` over [a, b] (impact hold), compressing the remainder so the end stays at 1. */
const hold = (p: number, a: number, b: number) => (p < a ? p : p < b ? a : a + ((p - b) * (1 - a)) / (1 - b));

/** 0 open → 1 shut. ~3.7 s cadence with an occasional double blink, offset per unit. */
function blinkAt(time: number, sig: number): number {
  const u = time + sig * 6.1, a = u % 3.7;
  const second = u % 11.3 < 3.7 ? bell(a, 0.22, 0.36) : 0;
  return Math.max(bell(a, 0, 0.14), second);
}

/** Deterministic beat pick for the combat idle: 0 watch · 1 throat pulse · 2 sac wobble. */
function beat(n: number, sig: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}

/** Rounded voxel poison sac: core cube + cross slabs + gloss so it reads as a swollen blister. */
function sac(p: Part, r: number) {
  p.box([0, 0, 0], [r * 2, r * 2, r * 2], C.purple)
    .box([0, 0, 0], [r * 2.4, r * 1.5, r * 1.5], C.purple)
    .box([0, 0, 0], [r * 1.5, r * 2.4, r * 1.5], C.purpleD)
    .box([0, 0, 0], [r * 1.5, r * 1.5, r * 2.4], C.purple)
    .box([-r * 0.3, r * 0.8, r * 0.5], [r * 0.7, r * 0.5, r * 0.7], C.purpleL);
}

export default defineUnit<ToadParts>({
  id: "toad_poison",
  motion: "ground",
  height: 8,
  durations: { idle: 4.6, attack: 0.95, skill: 1.7, hit: 0.55, move: 0.75 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.12,

  build(k, { star }) {
    // Wide, low body. The pivot sits at mid-back so breathing/crouch scale around the spine.
    const body = k.part("body", null, [0, TORSO_Y, -0.2]);
    body.box([0, 0.5, -0.2], [9.0, 4.2, 7.2], C.green)
      .box([0, -1.2, 0.2], [8.2, 1.6, 6.4], C.greenD)
      .box([0, 2.35, -0.7], [7.6, 1.7, 6.0], C.green) // domed, mossy back
      .box([0, 3.05, -0.9], [6.6, 0.5, 5.0], C.greenL)
      .spots([0, 1.6, -0.4], [8.6, 2.4, 6.6], C.moss, 26, 211, 1.15)
      .spots([0, 2.7, -0.7], [7.4, 1.2, 5.8], C.mossD, 12, 223, 0.9);

    // Big pale belly pushed forward and rounded on every edge, like the sheet's cream mass.
    const belly = k.part("belly", body, [0, -0.6, 2.65]);
    belly.box([0, 0, 0], [6.0, 3.0, 1.9], C.cream)
      .box([0, 1.25, -0.05], [4.8, 0.8, 1.7], C.cream)
      .box([0, -1.25, -0.05], [4.8, 0.8, 1.7], C.creamD)
      .box([0, 0.15, 0.95], [4.6, 1.9, 0.5], C.cream);

    // Pink lower lip tucked under the cream chin: a narrow patch, not a full mouth stripe.
    const throat = k.part("throat", body, [0, 0.5, 3.35]);
    throat.box([0, 0, 0], [3.4, 1.0, 1.1], C.pink)
      .box([0, -0.4, 0.1], [2.8, 0.4, 1.0], C.pinkD)
      .box([0, 0.5, 0.2], [2.4, 0.35, 0.8], C.cream);

    // Broad flat skull with a heavy mossy brow; eyes bulge above the silhouette.
    const head = k.part("head", body, [0, 2.3, 2.5]);
    head.box([0, 0.45, 0.35], [7.6, 2.3, 3.9], C.green)
      .box([0, 1.6, 0.75], [7.2, 0.7, 3.3], C.greenD) // brow ridge
      .box([0, 1.95, -0.5], [6.4, 0.5, 2.8], C.greenL)
      .box([0, -0.8, 1.95], [6.4, 0.35, 0.5], C.pinkD) // lip line
      .pair([0.9, 0.8, 2.45], [0.3, 0.28, 0.22], C.ink) // nostrils
      .pair([3.55, 0.5, 0.9], [0.5, 0.6, 0.6], C.moss) // cheek warts
      .spots([0, 1.85, 0.1], [7.0, 0.8, 3.5], C.moss, 14, 229, 0.95)
      .spots([0, 0.45, 0.35], [7.2, 1.7, 3.7], C.mossD, 8, 233, 0.8);

    // Eyes: yellow sclera with a vertical slit pupil, set into the top corners of the skull.
    for (const side of [1, -1]) {
      head.box([side * 2.35, 1.6, 1.9], [1.7, 1.6, 1.4], C.eye)
        .box([side * 2.35, 1.6, 2.63], [0.48, 1.15, 0.12], C.ink)
        .box([side * 2.35, 2.45, 1.9], [1.9, 0.35, 1.6], C.greenD);
    }
    // Eyelids hinge at the eye tops; scale.y collapses them for blinks/squints.
    const lids = k.part("lids", head, [0, 2.5, 1.9]);
    lids.pair([2.35, -0.88, 0.05], [1.9, 1.8, 1.6], C.greenD);

    const jaw = k.part("jaw", head, [0, -0.55, 1.55]);
    jaw.box([0, -0.35, 1.1], [6.2, 1.0, 2.7], C.cream)
      .box([0, 0.22, 1.2], [5.2, 0.3, 2.1], C.mouth)
      .box([0, 0.32, 0.8], [2.1, 0.3, 1.3], C.pink);

    // Front arms: short and planted forward, three cream toes each.
    const arm = (side: 1 | -1) => {
      const a = k.part(side > 0 ? "armR" : "armL", body, [side * 3.5, -1.4, 2.7]);
      a.box([0, 0, 0], [1.5, 2.4, 1.4], C.green)
        .spots([0, 0, 0], [1.5, 2.4, 1.4], C.moss, 3, side > 0 ? 241 : 251, 0.6)
        .box([side * 0.1, -0.8, 0.55], [2.1, 0.7, 2.2], C.greenD);
      for (const dx of [-0.65, 0, 0.65]) a.box([side * 0.1 + dx, -0.88, 1.6], [0.45, 0.45, 0.55], C.toe);
      return a;
    };
    // Hind legs: heavy folded haunches, wide webbed feet with cream toes.
    const leg = (side: 1 | -1) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * 4.0, -1.1, -1.7]);
      l.box([0, 0.1, 0], [2.4, 3.0, 3.8], C.green)
        .spots([0, 0.1, 0], [2.4, 3.0, 3.8], C.moss, 6, side > 0 ? 257 : 263, 0.8)
        .box([side * 0.2, -1.15, 1.2], [2.8, 0.7, 3.0], C.greenD);
      for (const dx of [-0.8, 0, 0.8]) l.box([side * 0.2 + dx, -1.2, 2.75], [0.5, 0.45, 0.55], C.toe);
      return l;
    };

    // Poison sacs: most visible pair on the flanks, then rear/top blisters as stars rise.
    const SAC_SPOTS: [number, number, number, number][] = [
      [-4.7, 0.3, -0.9, 1.45], [4.8, 0.45, -0.8, 1.4], [0.2, 1.2, -3.5, 1.0],
      [-3.4, 1.9, -2.7, 0.85], [3.5, 2.0, -2.8, 0.85], [0.6, 2.7, -2.2, 0.7],
    ];
    const sacCount = star === 1 ? 3 : star === 2 ? 5 : 6;
    const sacs = SAC_SPOTS.slice(0, sacCount).map(([x, y, z, r], i) => {
      const s = k.part(`sac${i}`, body, [x, y, z]);
      sac(s, r);
      if (star >= 3) s.box([0, 0.2, 0], [0.5, 0.5, 0.5], C.toxin, { mat: "glow" });
      return s;
    });

    // Moss tufts: chunky blocks that break the silhouette like the concept's clumps.
    for (const [x, y, z, w, h, rz] of [
      [-2.6, 3.4, 0.6, 1.1, 0.7, 0.2], [-0.6, 3.5, -0.4, 1.3, 0.8, -0.1],
      [1.9, 3.4, 0.3, 1.0, 0.6, 0.15], [3.6, 2.9, -1.2, 0.9, 0.5, -0.2],
    ] as const) {
      head.box([x, y, z], [w, h, w * 0.8], C.moss, { rot: [0, 0, rz] });
    }
    body.box([-1.2, 3.0, -2.4], [1.4, 0.7, 1.1], C.moss)
      .box([2.6, 2.9, -2.6], [1.1, 0.6, 1.0], C.mossD);

    let pouch: Part | null = null;
    if (star >= 2) {
      // Leather harness across the back + satchel on the left flank.
      body.box([0, 2.2, -0.2], [9.4, 0.65, 1.3], C.leather, { rot: [0, 0.12, 0] })
        .box([0, 1.9, -0.2], [9.4, 0.3, 1.5], C.leatherD, { rot: [0, 0.12, 0] });
      pouch = k.part("pouch", body, [-4.6, 0.7, 0.9]);
      pouch.box([0, 0, 0], [1.5, 2.0, 2.0], C.leather)
        .box([0, 0.55, 0.1], [1.6, 0.5, 1.6], C.leatherD)
        .box([0, -0.2, 1.05], [0.8, 0.6, 0.2], C.wood);
    }

    let crown: Part | null = null;
    if (star >= 3) {
      // Leaf crown around the brow with a pair of glowing toxin beads.
      crown = k.part("crown", head, [0, 2.5, 0.9]);
      for (const [x, z, h, rz] of [[-2.1, 1.1, 1.3, 0.5], [-0.8, 1.5, 1.7, 0.2], [0.8, 1.5, 1.7, -0.2], [2.1, 1.1, 1.3, -0.5]] as const) {
        crown.box([x, h / 2, z], [0.85, h, 0.45], C.leaf, { rot: [0, 0, rz] })
          .box([x + Math.sin(rz) * -0.3, h, z], [0.5, 0.45, 0.4], C.leafL);
      }
      crown.box([-1.2, 0.55, 1.4], [0.4, 0.4, 0.4], C.toxin, { mat: "glow" })
        .box([1.3, 0.5, 1.4], [0.35, 0.35, 0.35], C.toxin, { mat: "glow" });
    }

    return {
      body, belly, head, jaw, lids, throat,
      armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1),
      sacs, pouch, crown,
    };
  },

  pose(r, c) {
    const { body, belly, head, jaw, lids, throat, sacs } = r;
    const T = c.time;
    /** Vertical body offset for this frame; limbs are counter-translated to keep soles planted. */
    let dy = 0;
    let jawOpen = 0;
    let lid = blinkAt(T, c.sig);
    const sacWobble = (amp: number, speed: number) => sacs.forEach((s, i) => {
      const w = Math.sin(T * speed + i * 1.7);
      s.group.scale.setScalar(1 + w * amp);
      s.group.rotation.z = w * amp * 0.8;
    });
    const breathe = (rate: number, amp: number) => {
      body.group.scale.y = 1 + Math.sin(T * rate) * 0.02 * amp;
      belly.group.scale.x = 1 + Math.sin(T * rate - 0.5) * 0.02 * amp;
    };

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Combat idle: low ready crouch, slow throat pulse and alternating sac wobble.
          const s = T * 0.33 + c.sig * 2.7, n = Math.floor(s), f = s - n, m = ramp(f, 0.74, 1);
          const a = beat(n, c.sig), b = beat(n + 1, c.sig);
          const pulse = (a === 1 ? 1 - m : 0) + (b === 1 ? m : 0);
          const wobble = (a === 2 ? 1 - m : 0) + (b === 2 ? m : 0);
          dy = -0.35;
          breathe(2.6, 1.2);
          throat.group.scale.set(1 + pulse * 0.22, 1 + pulse * 0.42, 1 + pulse * 0.3);
          head.group.rotation.x = 0.08;
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 5) * 0.22 + Math.sin(T * 2.1 + 1) * 0.05;
          jaw.group.rotation.x = 0.05 + Math.max(0, Math.sin(T * 2.2)) * 0.05;
          sacWobble(0.05 + wobble * 0.06, 6 + wobble * 3);
          lid = Math.max(lid, 0.15 + pulse * 0.1);
        } else {
          // Inspection idle: settle (0–.3) → blink (.22–.36) → throat puff (.3–.64) → sac wobble (.62–1).
          // p settles at 1 as the resting pose, the same pose the cycle starts from.
          const ph = clamp01(c.p);
          const puff = win(ph, 0.3, 0.64, 0.12);
          const wobble = win(ph, 0.6, 1, 0.08);
          breathe(1.7 + c.sig * 0.3, 1);
          throat.group.scale.set(1 + puff * 0.35, 1 + puff * 0.6, 1 + puff * 0.5);
          head.group.rotation.x = Math.sin(T * 0.6) * 0.03 + puff * -0.06;
          head.group.rotation.y = Math.sin(T * 0.55 + c.sig * 3) * 0.1;
          jaw.group.rotation.x = puff * 0.08;
          sacWobble(0.025 + wobble * 0.05, 3.2);
        }
        break;
      }
      case "move": {
        // Two squat hops per loop: hind legs drive, front arms reach, body pitches then lands.
        const hop = (c.p * 2) % 1, air = bell(hop, 0.12, 0.78);
        const land = bell(hop, 0.78, 1);
        dy = air * 2.1 - land * 0.18;
        body.group.rotation.x = -air * 0.2 + land * 0.1;
        body.group.scale.y = 1 + air * 0.04 - land * 0.1;
        r.legL.group.rotation.x = r.legR.group.rotation.x = -air * 0.7;
        r.legL.group.position.z = r.legR.group.position.z = -1.7 - air * 0.9;
        r.armL.group.rotation.x = r.armR.group.rotation.x = -air * 0.5;
        head.group.rotation.x = air * 0.1;
        throat.group.scale.set(1 + air * 0.08, 1 + air * 0.12, 1 + air * 0.1);
        sacWobble(0.07 + land * 0.08, 9);
        break;
      }
      case "attack": {
        // Inhale → spit on the impact frame → recover. The projectile itself is presentation FX.
        const p = c.p, s = strike(p, 0.5);
        const fill = ramp(p, 0, 0.42) * (1 - ramp(p, 0.5, 0.72));
        dy = -0.25 * Math.max(0, -s) + 0.16 * Math.max(0, s);
        body.group.rotation.x = s * 0.05;
        head.group.rotation.x = -0.28 * Math.max(0, -s) + 0.16 * Math.max(0, s);
        head.group.position.z = Math.max(0, s) * 0.9;
        jawOpen = Math.max(0, s) * 0.85;
        throat.group.scale.set(1 + fill * 0.5, 1 + fill * 0.9, 1 + fill * 0.7);
        sacs.forEach((sc, i) => {
          const pump = Math.sin(T * 12 + i) * 0.06 * fill;
          sc.group.scale.setScalar(1 + pump);
        });
        break;
      }
      case "skill": {
        // Sương Độc: sacs pump → throat swells huge → sweeping spray → settle. Impact sits at .55.
        const q = hold(c.p, 0.55, 0.62);
        const gather = win(q, 0, 0.42, 0.1);
        const swell = ramp(q, 0.18, 0.5) * (1 - ramp(q, 0.62, 0.78));
        const spray = win(q, 0.5, 0.92, 0.08);
        dy = -0.3 * gather + 0.1 * spray;
        body.group.scale.y = 1 + swell * 0.06 - spray * 0.02;
        head.group.rotation.x = -0.2 * swell + 0.2 * spray;
        head.group.rotation.y = Math.sin(q * 20) * 0.28 * spray;
        jawOpen = spray * 0.9;
        throat.group.scale.set(1 + swell * 0.55, 1 + swell * 1.35, 1 + swell * 1.15);
        sacs.forEach((s, i) => {
          const pump = Math.sin(T * 15 + i * 1.2) * 0.12 * gather - swell * 0.16 + spray * 0.04;
          s.group.scale.setScalar(1 + pump);
          s.group.position.z = SAC_REST[i]!.z + spray * 0.15;
        });
        lid = Math.max(lid, 0.35 * swell);
        break;
      }
      case "hit": {
        // Trúng đòn → lùi lại → phục hồi: squash recoil with a short head shake.
        const p = c.p, k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.9));
        const shake = (1 - ramp(p, 0, 0.25)) * Math.sin(c.t * 62);
        const recover = bell(p, 0.7, 1);
        dy = -0.2 * k;
        body.group.position.z = -0.85 * k;
        body.group.rotation.z = 0.02 * k;
        body.group.rotation.x = -0.04 * k;
        body.group.scale.set(1 + k * 0.07, 1 - k * 0.1, 1);
        head.group.rotation.y = shake * 0.14 - 0.12 * k;
        head.group.rotation.z = shake * 0.06;
        head.group.rotation.x = 0.12 * k - 0.05 * recover;
        jawOpen = 0.3 * k;
        throat.group.scale.set(1 + recover * 0.1, 1 + recover * 0.16, 1 + recover * 0.12);
        sacWobble(0.12 * k, 16);
        lid = Math.max(lid, 0.55 * k);
        break;
      }
    }

    jaw.group.rotation.x = jawOpen;
    lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * clamp01(lid);
    body.group.position.y += dy;
    // Keep planted soles on the ground when the body crouches (limbs are body children).
    if (dy < 0) for (const limb of [r.armL, r.armR, r.legL, r.legR]) limb.group.position.y -= dy;
    // A taller breathing/throat swell moves children down around the pivot; lift the planted limbs.
    const grow = Math.max(0, body.group.scale.y - 1);
    if (grow > 0) for (const limb of [r.armL, r.armR, r.legL, r.legR]) limb.group.position.y += 2.6 * grow;
    // The belly follows breathing and lifts with the crouch so its lower slab never clips the ground.
    belly.group.position.y = -0.6 - dy * 0.6 - grow * 2.4;
  },

  death: {
    // Gục xuống (0–.3) → bẹp xuống + chân duỗi (.2–.55) → hơi thở cuối (.5–.72) → tan biến (.8–1).
    seconds: 1.35,
    vanishAt: 0.8,
    pose(r: ToadParts, c: DeathCtx) {
      const { body, belly, head, jaw, lids, throat, sacs } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.3), flatten = ramp(p, 0.2, 0.58);
      const last = bell(p, 0.52, 0.74);
      const lid = Math.max(ramp(p, 0.3, 0.55), last * 0.4);
      // Squash toward the ground; the pivot follows the shrink so the lowest voxel keeps a small
      // ground clearance instead of either floating or sinking.
      const sy = 1 - 0.42 * flatten;
      body.group.scale.set(1 + 0.08 * flatten, sy, 1 + 0.06 * flatten);
      body.group.rotation.x = 0.02 * flatten;
      body.group.position.y = 2.6 * sy - 0.04 * fall + 0.08 * Math.sin(Math.PI * flatten);
      // Head droops onto the ground; the throat deflates, then one last shallow breath.
      head.group.rotation.x = 0.32 * fall - 0.06 * last;
      head.group.rotation.z = 0.06 * fall;
      head.group.position.z = 0.25 * fall;
      jaw.group.rotation.x = 0.3 * flatten * (1 - 0.6 * last);
      throat.group.scale.set(1 - 0.25 * flatten + last * 0.2, 1 - 0.3 * flatten + last * 0.28, 1 - 0.25 * flatten + last * 0.2);
      // Limbs splay outward and relax; feet are children of the squashed body, so they ride up.
      r.armL.group.rotation.z = 0.2 * flatten;
      r.armR.group.rotation.z = -0.2 * flatten;
      r.armL.group.rotation.x = r.armR.group.rotation.x = 0.15 * flatten;
      r.legL.group.rotation.z = 0.15 * flatten;
      r.legR.group.rotation.z = -0.15 * flatten;
      r.legL.group.rotation.x = r.legR.group.rotation.x = -0.15 * flatten;
      // Splayed limbs lift slightly as the body shrinks so their corners never clip the ground.
      const lift = 0.55 * flatten;
      r.armL.group.position.y += lift;
      r.armR.group.position.y += lift;
      r.legL.group.position.y += lift * 0.5;
      r.legR.group.position.y += lift * 0.5;
      // Sacs deflate one by one with a lagged settle.
      sacs.forEach((s, i) => {
        const d = ramp(p, 0.18 + i * 0.03, 0.55 + i * 0.03);
        s.group.scale.setScalar(1 - 0.18 * d);
        s.group.rotation.z = 0.15 * d * (i % 2 === 0 ? 1 : -1);
      });
      belly.group.position.y = -0.6 - 0.1 * flatten;
      lids.group.scale.y = LID_OPEN + (1 - LID_OPEN) * clamp01(lid);
    },
  },
});
