// Hổ Nanh (tiger_fang) — bespoke rig from the "Hổ Nanh" concept sheet (Đấu sĩ · Thú · Lửa).
// Stocky orange tiger with black stripes, white muzzle/chest/belly, yellow eyes, big fangs, white
// claws and a thick banded tail. Idle: watch → lick paw → soft roar → tail flick · Combat idle:
// watch / low growl / claw flex · Move: walk → run · Attack: ready → claw swipe (impact) → recover ·
// Skill (Vuốt Hổ Xé Thịt): crouch → leap → double claw rake with fire slashes (impact) → land ·
// Hit: struck → step back → recover · Death: collapse → lie on the flank → vanish.
// 2★ extra stripes + white ruff; 3★ glowing fire on paws, shoulders and tail tip.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, chainWave, clamp01, hold, plantLeg, vfx, win, type Leg } from "./stance";

const C = {
  orange: 0xf08a24, orangeL: 0xf7a948, orangeD: 0xc86a14, stripe: 0x2a1a12, white: 0xf6f0e4,
  eye: 0xffd23a, pupil: 0x1a1008, nose: 0x3a2020, mouth: 0xa8282a, tongue: 0xe06a72, fang: 0xfff8ea,
  claw: 0xffffff, fire: 0xff7a1a, fireL: 0xffd04a,
};

const BODY_Y = 5.6;
const W3 = [0, 0, 0];

interface Parts {
  body: Part; head: Part; jaw: Part; lids: Part; earL: Part; earR: Part;
  legs: Leg[]; tail: Part[]; slash: Part;
}

export default defineUnit<Parts>({
  id: "tiger_fang",
  motion: "ground",
  height: 11,
  durations: { idle: 5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [4.2, 3.4, 7.2], C.orange)
      .box([0, -1.6, 0.2], [3.4, 0.3, 6.2], C.white) // belly
      .box([0, -0.2, 3.5], [3.4, 2.6, 0.6], C.white) // chest
      .box([0, 1.0, -3.0], [3.6, 1.8, 1.4], C.orangeD); // haunch
    const stripes = star >= 2 ? [-3, -2.2, -1.4, -0.6, 0.2, 1, 1.8, 2.6] : [-2.8, -1.6, -0.4, 0.8, 2.0];
    for (const z of stripes) {
      body.box([0, 1.72, z], [3.0, 0.12, 0.38], C.stripe)
        .pair([2.12, 0.5, z + 0.15], [0.12, 1.8, 0.36], C.stripe, { rot: [0.25, 0, 0] });
    }

    const head = k.part("head", body, [0, 1.7, 3.9]);
    head.box([0, 0.4, 0.6], [3.9, 3.2, 3.2], C.orange)
      .box([0, -0.5, 2.5], [2.6, 1.6, 1.4], C.white) // muzzle
      .box([0, 0.25, 3.25], [0.9, 0.5, 0.2], C.nose)
      .pair([1.95, -0.3, 1.0], [0.4, 1.6, 1.8], C.white) // cheek fur
      .pair([0.95, 1.0, 2.22], [0.7, 0.5, 0.1], C.eye)
      .pair([0.95, 1.0, 2.28], [0.25, 0.45, 0.06], C.pupil)
      .pair([0.95, 1.45, 2.2], [0.9, 0.2, 0.15], C.stripe) // brow
      .box([0, 1.95, 1.2], [0.4, 0.12, 1.6], C.stripe)
      .pair([0.7, 1.95, 1.0], [0.3, 0.12, 1.4], C.stripe, { rot: [0, 0.4, 0] })
      .pair([1.97, 0.8, 0.0], [0.1, 0.3, 1.2], C.stripe)
      .box([0, -1.33, 2.3], [2.0, 0.1, 1.6], C.mouth)
      .pair([0.65, -1.55, 2.95], [0.3, 0.7, 0.3], C.fang); // upper fangs
    const lids = k.part("lids", head, [0, 1.25, 2.3]);
    lids.pair([0.95, -0.25, 0], [0.8, 0.6, 0.1], C.orange);
    const ear = (side: 1 | -1) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.4, 2.0, 0.2]);
      e.box([0, 0.45, 0], [1.0, 0.9, 0.6], C.orange).box([0, 0.4, 0.32], [0.55, 0.55, 0.06], C.white)
        .box([0, 0.5, -0.32], [0.8, 0.7, 0.06], C.stripe);
      return e;
    };
    const earR = ear(1), earL = ear(-1);
    const jaw = k.part("jaw", head, [0, -1.25, 1.6]);
    jaw.box([0, -0.25, 0.85], [2.4, 0.5, 1.6], C.white)
      .box([0, 0.06, 0.8], [1.9, 0.1, 1.3], C.mouth)
      .box([0, 0.14, 0.6], [1.0, 0.12, 0.9], C.tongue)
      .pair([0.65, 0.3, 1.45], [0.25, 0.5, 0.25], C.fang);

    const legs: Leg[] = ([[1, 2.4], [-1, 2.4], [1, -2.6], [-1, -2.6]] as const).map(([side, z]) => {
      const front = z > 0, at = [side * 1.45, -1.2, z] as const, len = BODY_Y - 1.2;
      const part = k.part(`leg${front ? "F" : "H"}${side}`, body, at);
      part.box([0, -(len - 0.9) / 2, 0], [1.4, len - 0.9, 1.5], front ? C.orange : C.orangeD)
        .box([side * 0.71, -1.2, 0], [0.1, 0.35, 1.2], C.stripe)
        .box([side * 0.71, -2.2, 0], [0.1, 0.35, 1.2], C.stripe)
        .box([0, -len + 0.45, 0.25], [1.6, 0.9, 1.9], C.white);
      for (const dx of [-0.45, 0, 0.45]) part.box([dx, -len + 0.2, 1.3], [0.3, 0.4, 0.3], C.claw);
      if (star >= 3) part.box([0, -len + 0.95, 0.4], [1.7, 0.3, 1.6], C.fire, { mat: "glow" });
      return { part, at, len, toe: 1.45, heel: 0.75 };
    });

    const tail: Part[] = [];
    let parent = body;
    for (let i = 0; i < 6; i++) {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 1.1, -3.6] : [0, 0, -1.2]);
      const w = 1.1 - i * 0.06;
      seg.box([0, 0, -0.6], [w, w, 1.3], i % 2 ? C.stripe : C.orange);
      if (i === 5) seg.box([0, 0, -1.2], [w, w, 0.4], C.stripe);
      if (star >= 3 && i === 5) seg.box([0, 0.2, -1.5], [0.7, 0.9, 0.6], C.fireL, { mat: "glow" });
      tail.push(seg);
      parent = seg;
    }

    // Claw-slash VFX: three fire arcs in front of the face, shown only around the swipe/rake.
    const slash = k.part("slash", body, [0, 1.6, 6.2]);
    for (const [dx, i] of [[-0.9, 0], [0, 1], [0.9, 2]] as const) {
      slash.box([dx, 0, 0], [0.25, 3.4 - i * 0.2, 0.25], i === 1 ? C.fireL : C.fire, { mat: "glow", rot: [0, 0, 0.5] });
    }

    if (star >= 2) {
      head.pair([1.8, -0.9, 0.6], [0.7, 1.0, 1.4], C.white); // ruff
      body.box([0, 0.3, 3.75], [3.0, 1.6, 0.3], C.white);
    }
    if (star >= 3) {
      body.pair([2.2, 1.2, 2.2], [0.3, 1.2, 1.4], C.fire, { mat: "glow" }).pair([2.3, 1.7, 2.2], [0.2, 0.7, 0.8], C.fireL, { mat: "glow" });
      head.box([0, 2.1, 0.6], [1.2, 0.3, 0.6], C.fireL, { mat: "glow" });
    }
    return { body, head, jaw, lids, earL, earR, legs, tail, slash };
  },

  pose(r, c) {
    const { body, head, jaw, lids, earL, earR, legs, tail, slash } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig), dy = 0, th = 0, roll = 0, dz = 0, slashK = 0;
    const sw = [0, 0, 0, 0], lf = [0, 0, 0, 0];
    earL.group.rotation.z = bell((T + c.sig * 3) % 3.3, 0, 0.12) * 0.3;
    earR.group.rotation.z = -bell((T + 1.4) % 4.1, 0, 0.12) * 0.3;
    body.group.scale.set(1 + Math.sin(T * 2) * 0.012, 1 + Math.sin(T * 2) * 0.018, 1);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(W3, T, c.sig, 0x7193);
          const watch = W3[0]!, growl = W3[1]!, flex = W3[2]!;
          dy = -0.5 - 0.25 * growl;
          th = 0.04 + 0.05 * growl;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 5) * 0.3 * watch;
          head.group.rotation.x = -0.1 * growl;
          jaw.group.rotation.x = growl * (0.45 + Math.sin(T * 30) * 0.04);
          earL.group.rotation.x = earR.group.rotation.x = -0.4 * growl;
          const kn = bell((T * 0.9) % 1, 0, 0.5) * flex;
          sw[0] = -0.5 * kn; lf[0] = 0.8 * kn;
          lid = Math.max(lid, 0.3 * growl);
          chainWave(tail, T, 0.25 + 0.15 * growl, 4.5, 0.25, 0.05);
        } else {
          // watch (0–.3) → lick paw (.3–.55) → soft roar (.55–.78) → tail flick (.78–1).
          const ph = c.p % 1;
          const watch = 1 - ramp(ph, 0.25, 0.32), lick = win(ph, 0.3, 0.56, 0.06);
          const roar = win(ph, 0.55, 0.8, 0.06), flick = win(ph, 0.78, 1, 0.05);
          head.group.rotation.y = Math.sin(clamp01(ph / 0.3) * Math.PI * 2) * 0.35 * watch - 0.2 * flick;
          sw[0] = -0.9 * lick; lf[0] = 1.2 * lick;
          head.group.rotation.x = 0.35 * lick - 0.25 * roar;
          jaw.group.rotation.x = lick * (0.15 + Math.max(0, Math.sin(c.t * 14)) * 0.15) + 0.7 * roar;
          head.group.rotation.y += 0.25 * lick;
          lid = Math.max(lid, 0.5 * lick + 0.4 * roar);
          chainWave(tail, T, 0.15 + 0.35 * flick, 2.4 + 6 * flick, 0.35, 0.07);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.6 * wk + g);
        for (let i = 0; i < 4; i++) {
          const ph = w + (i === 0 || i === 3 ? 0 : Math.PI) + (g > 0.5 && i >= 2 ? 0.6 : 0);
          sw[i] = Math.sin(ph) * (0.35 * wk + 0.6 * g);
          lf[i] = Math.max(0, Math.cos(ph)) * (0.9 * wk + 1.6 * g);
        }
        dy = Math.abs(Math.sin(w)) * (0.1 * wk + 0.5 * g);
        th = Math.sin(w) * 0.05 * g;
        head.group.rotation.x = 0.05 * wk - 0.08 * g;
        earL.group.rotation.x = earR.group.rotation.x = -0.4 * g;
        chainWave(tail, T, 0.15 * wk + 0.06 * g, 3 + 6 * g, 0.15, 0.03);
        break;
      }
      case "attack": {
        // ready (0–.35) → claw swipe (impact .5) → recover (.65–1).
        const p = c.p;
        const ready = ramp(p, 0, 0.35) * (1 - ramp(p, 0.4, 0.5));
        const swipe = win(p, 0.4, 0.66, 0.08), recover = ramp(p, 0.65, 1);
        dy = -0.6 * ready + 0.2 * swipe;
        dz = -0.5 * ready + 1.2 * swipe * (1 - recover);
        th = -0.08 * ready + 0.06 * swipe;
        sw[0] = -1.2 * ready - 0.6 * swipe + 0.9 * ramp(p, 0.45, 0.58) * (1 - recover);
        lf[0] = 1.8 * Math.max(ready, swipe);
        jaw.group.rotation.x = 0.2 * ready + 0.8 * swipe;
        head.group.rotation.x = 0.12 * swipe;
        earL.group.rotation.x = earR.group.rotation.x = -0.5 * (ready + swipe);
        slashK = bell(p, 0.42, 0.72);
        lid = Math.max(lid, 0.3 * swipe);
        chainWave(tail, T, 0.3, 8, 0.2 + 0.2 * swipe, 0.03);
        break;
      }
      case "skill": {
        // Vuốt Hổ Xé Thịt: crouch (0–.22) → leap (.22–.55) → rake + fire slashes (impact .6, held
        // .58–.64) → tear (.64–.8) → land and settle (.8–1).
        const q = hold(c.p, 0.58, 0.64);
        const crouch = win(q, 0, 0.26, 0.1), x = clamp01((q - 0.22) / 0.36);
        const air = q > 0.22 && q < 0.58 ? 4 * x * (1 - x) : 0;
        const rake = win(q, 0.5, 0.82, 0.05), land = bell(q, 0.78, 1);
        dy = -1.2 * crouch + 4.2 * air - 0.6 * land;
        dz = 3.2 * ramp(q, 0.22, 0.58) * (1 - ramp(q, 0.82, 1)) - 0.5 * crouch;
        th = 0.08 * crouch - 0.25 * air + 0.18 * rake;
        for (let i = 0; i < 4; i++) {
          sw[i] = i < 2 ? -1.1 * air - 0.6 * rake + (i ? 0.4 : 0) * rake * Math.sin(c.t * 30) : 0.8 * air;
          lf[i] = i < 2 ? 2.2 * (air + rake) : 1.5 * air;
        }
        jaw.group.rotation.x = 0.3 * crouch + 0.9 * rake;
        head.group.rotation.x = -0.1 * air + 0.15 * rake;
        earL.group.rotation.x = earR.group.rotation.x = -0.55 * Math.min(1, crouch + air + rake);
        slashK = win(q, 0.52, 0.86, 0.06);
        lid = Math.max(lid, 0.35 * crouch);
        chainWave(tail, T, 0.2, 7, 0.1 - 0.4 * air + 0.3 * land, 0.02);
        break;
      }
      case "hit": {
        const p = c.p;
        const kk = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.9));
        const shake = (1 - ramp(p, 0, 0.25)) * Math.sin(c.t * 70);
        dz = -0.9 * kk; roll = 0.08 * kk; th = -0.06 * kk;
        head.group.rotation.y = -0.2 * kk + shake * 0.15;
        head.group.rotation.x = -0.15 * kk;
        jaw.group.rotation.x = 0.3 * kk;
        earL.group.rotation.x = earR.group.rotation.x = -0.6 * kk;
        lid = Math.max(lid, 0.7 * kk + (p < 0.08 ? 1 : 0));
        chainWave(tail, T, 0.35 * kk + 0.08, 14, 0.1, 0.02);
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    body.group.rotation.z = roll;
    for (let i = 0; i < 4; i++) plantLeg(legs[i]!, BODY_Y + dy, th, roll, dz, sw[i], lf[i]);
    vfx(slash, slashK);
    lids.group.scale.y = 0.06 + 0.94 * clamp01(lid);
  },

  death: {
    // collapse (0–.3) → lie on the flank (.2–.5) → still (.5–.75) → vanish.
    seconds: 1.3,
    vanishAt: 0.75,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, jaw, lids, legs, tail, slash } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.3), lie = ramp(p, 0.2, 0.5);
      const roll = 0.45 * lie;
      // Belly and flank (half 1.7 × 2.1) stay above the tile while rolled.
      const y = (1 - fall) * BODY_Y + fall * (1.75 * Math.cos(roll) + 2.1 * Math.sin(roll) + 0.4);
      body.group.position.y = y;
      body.group.rotation.z = roll;
      for (const l of legs) plantLeg(l, y, 0, roll, 0, 0, 0, 0.02);
      head.group.rotation.x = 0.25 * fall;
      head.group.rotation.z = 0.2 * lie;
      jaw.group.rotation.x = 0.25 * lie;
      for (let i = 0; i < tail.length; i++) tail[i]!.group.rotation.y = 0.12 * ramp(p, 0.2 + i * 0.04, 0.5 + i * 0.04);
      vfx(slash, 0);
      lids.group.scale.y = 0.06 + 0.94 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.1));
    },
  },
});
