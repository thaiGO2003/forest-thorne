// Gõ Kiến Mỏ Cứng (catalog id woodpecker_drill, kept for save compatibility) — bespoke rig from the
// approved "Gõ Kiến Mỏ Cứng" sheet. Stout black-and-white woodpecker with a tall red crest, a long steel
// beak, thin grey legs and a round log shield on the left wing.
// Idle: stand → look → light peck → alert · Combat idle: brace / guard / ready (deterministic beats) ·
// Move: steps blending into a run · Attack: rear back → peck on impact → recover · Skill: wings
// launch into the air → single descending beak impact at p=.55 → stun hold → shield brace.
// Hit: shield block → pushed back → steady · Death: legs fold → slump → vanish.
// 2★ gold shield rim + chest band; 3★ gold helm, glowing amber shield core and wing plates.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  red: 0xd8262e, redD: 0x9e1820, black: 0x2a2226, white: 0xf2ece2, cream: 0xe8d8b8, brown: 0x6e4422,
  brownD: 0x4a2c16, beak: 0x7a767e, beakD: 0x4c4a52, eye: 0x1a1214, leg: 0x5a4e58,
  wood: 0xc89858, woodL: 0xe0b878, woodD: 0x8a5a2c, gold: 0xe8b23a, amber: 0xffb02a,
};

const BODY_Y = 4.0, LEG_LEN = 3.9;
/** Foot reach ahead of / behind the leg axis, used by plant() to stop toes digging in. */
const TOE = 1.5;
const LEG_AT: readonly [number, number, number] = [0.8, 0, 0.2];

interface Parts {
  body: Part; chest: Part; head: Part; crest: Part; beak: Part; lids: Part;
  wingL: Part; wingR: Part; shield: Part; legs: Part[]; tail: Part;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Plateau envelope: eases in over [a, a+e], holds, eases out over [b-e, b]. */
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
const blinkAt = (time: number, sig: number) => bell((time + sig * 5.3) % 3.5, 0, 0.14);
function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}
/** Combat-idle beat weights for three poses, cross-faded on a deterministic per-unit schedule. */
const W = [0, 0, 0];
function beats(time: number, sig: number, salt: number) {
  const s = time * 0.38 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  for (let i = 0; i < 3; i++) W[i] = (a === i ? 1 - m : 0) + (b === i ? m : 0);
}
/**
 * Keep a straight hanging leg (pivot `at` in its parent, length `len`) planted after the parent dropped
 * `dy` (≤0 lowers) and pitched `th`. `dz` (forward shift) swings it back; `swing`/`lift` step it.
 */
function plant(leg: Part, at: readonly [number, number, number], len: number, dy: number, th: number, dz = 0, swing = 0, lift = 0) {
  const drop = dy + at[1] * (Math.cos(th) - 1) - at[2] * Math.sin(th);
  const rot = swing + Math.asin(Math.max(-0.7, Math.min(0.7, dz / len))) - th;
  leg.group.rotation.x += rot;
  // A rotated foot box dips its toe (forward) or heel (back) by about TOE·|sin|: shorten to compensate.
  leg.group.scale.y = Math.max(0.2, Math.min(1, (len + drop - lift - TOE * Math.abs(Math.sin(rot))) / len));
}

/** Swing the left wing so the log shield covers the front. */
function guard(r: Parts, k: number) {
  r.wingL.group.rotation.y += 0.9 * k;
  r.wingL.group.rotation.z -= 0.25 * k;
}

export default defineUnit<Parts>({
  id: "woodpecker_drill",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.85, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 1.2, -0.3], [3.4, 3.2, 3.6], C.brown)
      .box([0, 2.1, -0.6], [3.2, 1.4, 3.0], C.black)
      .spots([0, 2.1, -0.6], [3.2, 1.4, 3.0], C.white, 6, 61, 0.6);
    const chest = k.part("chest", body, [0, 1.1, 1.0]);
    chest.box([0, 0, 0.3], [2.6, 2.6, 1.2], C.white).box([0, -0.6, 0.95], [1.6, 1.0, 0.12], C.cream);
    const tail = k.part("tail", body, [0, 0.5, -2.0]);
    tail.box([0, -0.2, -0.9], [1.6, 0.4, 2.0], C.black, { rot: [0.5, 0, 0] })
      .box([0, -0.3, -1.6], [1.2, 0.3, 1.0], C.white, { rot: [0.5, 0, 0] });

    const head = k.part("head", body, [0, 2.9, 0.7]);
    head.box([0, 0.8, 0.3], [2.6, 2.4, 2.6], C.black)
      .pair([1.31, 0.6, 0.5], [0.08, 1.2, 1.8], C.white) // cheek stripe
      .pair([1.32, 1.0, 0.9], [0.1, 0.5, 0.5], C.eye)
      .pair([1.36, 1.1, 1.0], [0.06, 0.18, 0.18], C.white)
      .box([0, 0.1, 1.5], [1.8, 0.8, 0.4], C.white);
    const lids = k.part("lids", head, [0, 1.25, 0.9]);
    lids.pair([1.38, -0.25, 0], [0.06, 0.55, 0.55], C.black);
    const crest = k.part("crest", head, [0, 2.0, 0.1]);
    crest.box([0, 0.4, 0], [1.6, 0.8, 2.2], C.red)
      .box([0, 0.9, -0.6], [1.2, 1.0, 1.6], C.red, { rot: [-0.4, 0, 0] })
      .box([0, 1.3, -1.2], [0.8, 0.9, 1.0], C.redD, { rot: [-0.7, 0, 0] });
    const beak = k.part("beak", head, [0, 0.7, 1.6]);
    beak.box([0, 0, 1.2], [0.8, 0.7, 2.4], C.beak).box([0, -0.05, 2.7], [0.5, 0.45, 0.8], C.beakD);

    const wing = (side: 1 | -1) => {
      const w = k.part(side > 0 ? "wingR" : "wingL", body, [side * 1.75, 2.2, -0.3]);
      w.box([side * 0.25, -1.2, -0.2], [0.5, 2.8, 3.0], C.black)
        .box([side * 0.3, -0.6, 0.6], [0.4, 1.2, 1.4], C.white)
        .box([side * 0.3, -2.3, -0.8], [0.4, 0.8, 2.0], C.brownD);
      return w;
    };
    const wingR = wing(1), wingL = wing(-1);
    const shield = k.part("shield", wingL, [-0.6, -1.3, 0.4]);
    shield.box([-0.25, 0, 0], [0.5, 3.0, 2.2], C.wood).box([-0.25, 0, 0], [0.5, 2.2, 3.0], C.wood)
      .box([-0.52, 0, 0], [0.06, 2.0, 2.0], C.woodL).box([-0.56, 0, 0], [0.06, 1.2, 1.2], C.woodD)
      .box([-0.6, 0, 0], [0.06, 0.5, 0.5], C.woodL);

    const legs = ([1, -1] as const).map((side) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * LEG_AT[0], LEG_AT[1], LEG_AT[2]]);
      l.box([0, -1.7, 0], [0.5, 3.4, 0.5], C.leg).box([0, -3.7, 0.4], [1.3, 0.4, 1.6], C.leg);
      for (const dx of [-0.4, 0.4]) l.box([dx, -3.75, 1.3], [0.3, 0.3, 0.4], C.beakD);
      return l;
    });

    if (star >= 2) {
      shield.box([-0.3, 0, 0], [0.3, 3.2, 0.3], C.gold).box([-0.3, 0, 0], [0.3, 0.3, 3.2], C.gold);
      chest.box([0, 0.5, 0.92], [2.7, 0.3, 0.1], C.gold);
    }
    if (star >= 3) {
      head.box([0, 2.05, 0.4], [2.7, 0.35, 2.4], C.gold).box([0, 1.6, 1.55], [0.6, 0.6, 0.12], C.amber, { mat: "glow" });
      shield.box([-0.64, 0, 0], [0.06, 0.4, 0.4], C.amber, { mat: "glow" });
      wingR.box([0.35, 0.1, 0], [0.6, 0.5, 1.8], C.gold);
      wingL.box([-0.35, 0.1, 0], [0.6, 0.5, 1.8], C.gold);
    }
    return { body, chest, head, crest, beak, lids, wingL, wingR, shield, legs, tail };
  },

  pose(r, c) {
    const { body, chest, head, crest, lids, wingL, wingR, legs, tail } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let dy = 0, th = 0, dz = 0, sw0 = 0, sw1 = 0, lf0 = 0, lf1 = 0;
    chest.group.scale.set(1 + Math.sin(T * 1.9) * 0.02, 1 + Math.sin(T * 1.9) * 0.03, 1);
    tail.group.rotation.x = Math.sin(T * 1.7) * 0.08;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x7a11);
          const brace = W[0]!, shieldUp = W[1]!, ready = W[2]!;
          dy = -0.4 - 0.15 * brace + Math.sin(T * 2.5) * 0.05;
          th = 0.04 + 0.04 * ready;
          guard(r, 0.4 + 0.6 * shieldUp);
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 4) * 0.25 + Math.sin(T * 2.2) * 0.05) * (1 - 0.6 * ready);
          head.group.rotation.x = 0.1 * brace - 0.1 * ready;
          crest.group.rotation.x = -0.35 * ready;
          wingR.group.rotation.z = 0.15 * ready;
          lid = Math.max(lid, 0.25 * ready);
        } else {
          // stand (0–.25) → look (.25–.5) → light peck (.5–.75) → alert (.75–1).
          const ph = c.p % 1;
          const look = win(ph, 0.25, 0.5, 0.05), peck = win(ph, 0.5, 0.76, 0.05), alert = win(ph, 0.74, 1, 0.06);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.08 + look * Math.sin((ph - 0.25) / 0.25 * Math.PI * 2) * 0.5;
          head.group.rotation.x = peck * (0.2 + Math.max(0, Math.sin(c.t * 18)) * 0.2) - 0.08 * alert;
          crest.group.rotation.x = -0.4 * alert;
          wingL.group.rotation.z = -0.15 * alert;
          wingR.group.rotation.z = 0.15 * alert;
        }
        break;
      }
      case "move": {
        // No velocity in PoseCtx: combat always runs; out of combat steps blend into a run (c.p 0.8 → 1.8).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        sw0 = Math.sin(w) * (0.35 * wk + 0.5 * g);
        sw1 = -sw0;
        lf0 = Math.max(0, Math.cos(w)) * (0.5 * wk + 0.9 * g);
        lf1 = Math.max(0, -Math.cos(w)) * (0.5 * wk + 0.9 * g);
        dy = Math.abs(Math.sin(w)) * 0.1 * wk - 0.2 * g;
        th = 0.15 * g;
        head.group.rotation.x = -0.12 * g + Math.sin(w * 2) * 0.04;
        wingL.group.rotation.z = -Math.sin(T * 14) * 0.15 * g;
        wingR.group.rotation.z = Math.sin(T * 14) * 0.15 * g;
        crest.group.rotation.x = 0.3 * g;
        break;
      }
      case "attack": {
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.48));
        const lunge = ramp(p, 0.4, 0.5) * (1 - ramp(p, 0.62, 0.92));
        const settle = bell(p, 0.82, 1);
        dy = -0.2 * (wind + lunge);
        dz = -0.3 * wind + 0.8 * lunge - 0.1 * settle;
        th = -0.06 * wind + 0.12 * lunge;
        head.group.rotation.x = -0.45 * wind + 0.6 * lunge + 0.05 * settle;
        crest.group.rotation.x = -0.3 * wind + 0.3 * lunge;
        guard(r, 0.4);
        break;
      }
      case "skill": {
        // Lift through p=.38, dive to contact at p=.55, hold the beak planted, then recover.
        const p = c.p;
        const lift = ramp(p, 0.08, 0.32) * (1 - ramp(p, 0.38, 0.55));
        const dive = ramp(p, 0.38, 0.55) * (1 - ramp(p, 0.65, 0.86));
        const hold = win(p, 0.55, 0.84, 0.04);
        dy = 2.1 * lift;
        dz = -0.25 * lift + 1.5 * dive;
        th = -0.28 * lift + 0.5 * dive;
        guard(r, c.star === 3 ? 0.85 * hold : 0.2 * hold);
        head.group.rotation.x = -0.4 * lift + 0.85 * dive;
        crest.group.rotation.x = -0.25 * lift + 0.4 * dive;
        wingL.group.rotation.z = -0.7 * lift;
        wingR.group.rotation.z = 0.7 * lift;
        wingL.group.rotation.x = 0.45 * lift;
        wingR.group.rotation.x = 0.45 * lift;
        lid = Math.max(lid, 0.45 * dive);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        dz = -0.6 * k;
        th = -0.1 * k;
        guard(r, 0.8 * k);
        head.group.rotation.y = shake * 0.15;
        head.group.rotation.x = 0.1 * k;
        crest.group.rotation.x = 0.3 * k;
        lid = Math.max(lid, 0.8 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    plant(legs[0]!, [LEG_AT[0], LEG_AT[1], LEG_AT[2]], LEG_LEN, dy, th, dz, sw0, lf0);
    plant(legs[1]!, [-LEG_AT[0], LEG_AT[1], LEG_AT[2]], LEG_LEN, dy, th, dz, sw1, lf1);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Legs fold (0–.35) → slump forward, wings droop (.25–.55) → vanish (.7–1, rig shrink-out).
    seconds: 1.1,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, crest, lids, wingL, wingR, legs } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.35), slump = ramp(p, 0.25, 0.55);
      const dy = -LEG_LEN * 0.75 * fold, th = 0.15 * slump;
      body.group.position.y += dy;
      body.group.rotation.x = th;
      plant(legs[0]!, [LEG_AT[0], LEG_AT[1], LEG_AT[2]], LEG_LEN, dy, th);
      plant(legs[1]!, [-LEG_AT[0], LEG_AT[1], LEG_AT[2]], LEG_LEN, dy, th);
      head.group.rotation.x = 0.5 * slump;
      crest.group.rotation.x = 0.4 * slump;
      wingL.group.rotation.z = -0.35 * slump;
      wingR.group.rotation.z = 0.35 * slump;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.08));
    },
  },
});
