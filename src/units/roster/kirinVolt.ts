// Điện Linh Dương (catalog id kirin_thunder, kept for save compatibility) — bespoke rig from the approved
// "Điện Linh Dương" sheet. Navy armoured antelope with a white mane and tail, gold plates with a blue
// lightning crest, and tall branching gold antlers wreathed in glowing blue lightning.
// Idle: stand → raise head → spark → breathe in · Combat idle: guard / charge / ready (deterministic
// beats) · Move: step → run → sprint · Attack: head-butt → antler sweep on impact → recover · Skill:
// alternating left/right horn thrusts (2/4/6 at 1★/2★/3★, first contact p=.6), gold hit sparks;
// blue paralysis FX belongs to the combat status event only · Hit: struck → back step → steady ·
// Death: falls → lies down → dissolves. 2★ larger glowing antlers; 3★ crown and anklets.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  navy: 0x24305c, navyD: 0x161e3c, white: 0xf2f0ec, grey: 0xc8c8d0, gold: 0xe8b23a, goldD: 0xb07c1c,
  bolt: 0x6cc8ff, boltL: 0xc8eaff, eye: 0x7fe0ff, hoof: 0x2a2a34, nose: 0x1a1a24,
};

const BODY_Y = 5.4, LEG_LEN = 5.2;
/** Foot reach ahead of / behind the leg axis, used by plant() to stop toes digging in. */
const TOE = 0.6;
/** Leg pivots in body space: front pair forward, hind pair back. */
const LEGS: readonly (readonly [number, number, number])[] = [[1.1, -0.2, 1.8], [-1.1, -0.2, 1.8], [1.1, -0.2, -1.8], [-1.1, -0.2, -1.8]];

interface Parts { body: Part; neck: Part; head: Part; lids: Part; antlers: Part; mane: Part; tail: Part; legs: Part[] }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
const blinkAt = (time: number, sig: number) => bell((time + sig * 3.7) % 3.8, 0, 0.14);
function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}
const W = [0, 0, 0];
function beats(time: number, sig: number, salt: number) {
  const s = time * 0.38 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  for (let i = 0; i < 3; i++) W[i] = (a === i ? 1 - m : 0) + (b === i ? m : 0);
}
/** Straight hanging leg kept planted after the body dropped `dy` and pitched `th` (shortens only). */
function plant(leg: Part, at: readonly [number, number, number], dy: number, th: number, dz = 0, swing = 0, lift = 0) {
  const drop = dy + at[1] * (Math.cos(th) - 1) - at[2] * Math.sin(th);
  const rot = swing + Math.asin(Math.max(-0.7, Math.min(0.7, dz / LEG_LEN))) - th;
  leg.group.rotation.x += rot;
  // A rotated foot box dips its toe (forward) or heel (back) by about TOE·|sin|: shorten to compensate.
  leg.group.scale.y = Math.max(0.2, Math.min(1, (LEG_LEN + drop - lift - TOE * Math.abs(Math.sin(rot))) / LEG_LEN));
}

export default defineUnit<Parts>({
  id: "kirin_thunder",
  motion: "ground",
  height: 13,
  durations: { idle: 4.5, attack: 0.85, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0.6, 0], [2.8, 2.4, 5.2], C.navy).box([0, 1.85, 0], [2.4, 0.3, 4.4], C.gold)
      .pair([1.42, 0.7, 0], [0.1, 1.6, 3.2], C.gold).pair([1.48, 0.7, 0], [0.06, 1.0, 0.5], C.bolt, { mat: "glow" })
      .box([0, -0.6, 0], [2.4, 0.4, 4.6], C.white);
    const mane = k.part("mane", body, [0, 1.6, 2.2]);
    mane.box([0, 0.4, 0], [2.6, 1.6, 1.6], C.white).box([0, -0.4, 0.6], [2.2, 1.4, 1.2], C.white);
    const neck = k.part("neck", body, [0, 1.4, 2.4]);
    neck.box([0, 0.8, 0.4], [1.6, 2.2, 1.6], C.navy);
    const head = k.part("head", neck, [0, 2.0, 0.8]);
    head.box([0, 0.3, 0.6], [1.8, 1.6, 2.4], C.navy).box([0, 0, 1.9], [1.2, 1.0, 0.6], C.grey)
      .box([0, -0.1, 2.25], [0.6, 0.4, 0.1], C.nose).pair([0.75, 0.6, 1.2], [0.3, 0.3, 0.5], C.eye, { mat: "glow" })
      .pair([0.75, 1.1, -0.3], [0.4, 0.8, 0.4], C.white);
    const lids = k.part("lids", head, [0, 0.75, 1.2]);
    lids.pair([0.8, -0.15, 0], [0.2, 0.35, 0.55], C.navy);
    const antlers = k.part("antlers", head, [0, 1.1, 0.4]);
    for (const s of [1, -1]) {
      antlers.box([s * 0.5, 1.2, 0], [0.35, 2.4, 0.35], C.gold, { rot: [0, 0, -s * 0.3] })
        .box([s * 1.2, 2.6, -0.2], [0.3, 1.6, 0.3], C.gold, { rot: [0, 0, -s * 0.6] })
        .box([s * 0.6, 2.9, 0.3], [0.3, 1.2, 0.3], C.gold, { rot: [0.3, 0, 0] })
        .box([s * 1.9, 3.4, -0.3], [0.25, 0.9, 0.25], C.boltL, { mat: "glow", rot: [0, 0, -s * 0.8] })
        .box([s * 0.9, 1.9, 0], [0.6, 0.18, 0.18], C.bolt, { mat: "glow" });
    }
    const tail = k.part("tail", body, [0, 1.0, -2.6]);
    tail.box([0, -0.5, -0.6], [1.0, 1.6, 1.2], C.white, { rot: [0.5, 0, 0] });
    const legs = LEGS.map((at, i) => {
      const l = k.part(`leg${i}`, body, [at[0], at[1], at[2]]);
      l.box([0, -1.4, 0], [0.9, 2.8, 0.9], C.navy).box([0, -1.0, 0.47], [0.6, 1.0, 0.06], C.gold)
        .box([0, -3.8, 0], [0.6, 2.4, 0.6], C.grey).box([0, -LEG_LEN + 0.25, 0.1], [0.8, 0.5, 0.9], C.hoof);
      if (star >= 3) l.box([0, -3.2, 0], [0.75, 0.25, 0.75], C.bolt, { mat: "glow" });
      return l;
    });
    if (star >= 2) {
      for (const s of [1, -1]) antlers.box([s * 2.4, 4.0, 0], [0.25, 1.2, 0.25], C.bolt, { mat: "glow", rot: [0, 0, -s * 0.4] });
    }
    if (star >= 3) head.box([0, 1.0, 1.2], [1.2, 0.3, 1.0], C.gold).box([0, 1.25, 1.6], [0.4, 0.4, 0.1], C.bolt, { mat: "glow" });
    return { body, neck, head, lids, antlers, mane, tail, legs };
  },

  pose(r, c) {
    const { body, neck, head, lids, antlers, mane, tail, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let dy = 0, th = 0, dz = 0;
    const sw = [0, 0, 0, 0], lf = [0, 0, 0, 0];
    antlers.group.scale.setScalar(1 + Math.sin(T * 7) * 0.015);
    tail.group.rotation.y = Math.sin(T * 1.7) * 0.15;
    mane.group.rotation.x = Math.sin(T * 1.9) * 0.04;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x4b77);
          const guard = W[0]!, charge = W[1]!, ready = W[2]!;
          dy = -0.4 - 0.2 * ready + Math.sin(T * 2.4) * 0.05;
          th = 0.04 + 0.1 * ready;
          neck.group.rotation.x = 0.35 * ready + 0.15 * guard;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * (1 - ready);
          antlers.group.scale.setScalar(1 + charge * (0.06 + Math.sin(T * 30) * 0.03));
          lf[0] = Math.max(0, Math.sin(T * 3)) * 0.4 * ready; // hoof scrape
          lid = Math.max(lid, 0.2 * ready);
        } else {
          // stand (0–.25) → raise head (.25–.5) → spark (.5–.75) → breathe in (.75–1).
          const ph = c.p % 1;
          const raise = win(ph, 0.25, 0.5, 0.05), spark = win(ph, 0.5, 0.76, 0.05), breath = win(ph, 0.74, 1, 0.06);
          neck.group.rotation.x = -0.35 * raise + 0.05 * Math.sin(T * 0.7);
          head.group.rotation.x = -0.2 * raise;
          head.group.rotation.y = Math.sin(T * 0.6) * 0.1;
          antlers.group.scale.setScalar(1 + spark * (0.05 + Math.sin(c.t * 40) * 0.03));
          body.group.scale.set(1 + 0.03 * breath, 1, 1 + 0.02 * breath); // y stays 1: legs hang off the body
          dy = -0.05 + 0.1 * breath;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        for (let i = 0; i < 4; i++) {
          const ph = w + (i < 2 ? 0 : Math.PI) + (i % 2 ? Math.PI : 0) * wk;
          sw[i] = Math.sin(ph) * (0.4 * wk + 0.7 * g);
          lf[i] = Math.max(0, Math.cos(ph)) * (0.8 * wk + 1.6 * g);
        }
        dy = Math.abs(Math.sin(w)) * (0.1 * wk + 0.7 * g) - 0.2 * g;
        th = Math.sin(w) * 0.06 * g;
        neck.group.rotation.x = 0.3 * g;
        mane.group.rotation.x = -0.4 * g;
        tail.group.rotation.x = -0.5 * g;
        break;
      }
      case "attack": {
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.48));
        const butt = ramp(p, 0.4, 0.5) * (1 - ramp(p, 0.62, 0.92));
        const sweep = win(p, 0.44, 0.7, 0.04);
        dz = -0.4 * wind + 1.2 * butt;
        dy = -0.2 * wind;
        neck.group.rotation.x = -0.3 * wind + 0.6 * butt;
        head.group.rotation.z = Math.sin((p - 0.44) / 0.26 * Math.PI) * 0.5 * sweep;
        antlers.group.scale.setScalar(1 + 0.15 * butt);
        break;
      }
      case "skill": {
        // A separate thrust at each replayed damage impact: first p=.6, last p=.93.
        // Visual-only horn offsets follow the per-star 2/4/6 hit count.
        const p = c.p;
        const hits = c.star * 2;
        const windup = win(p, 0, 0.59, 0.08);
        const beat = (p - 0.6) / 0.33 * (hits - 1);
        const nearest = Math.max(0, Math.min(hits - 1, Math.round(beat)));
        const thrust = p >= 0.6 && p <= 0.98
          ? Math.max(0, 1 - Math.abs(beat - nearest) * 2.8) * (1 - ramp(p, 0.93, 0.98))
          : 0;
        const side = nearest % 2 === 0 ? 1 : -1;
        dy = -0.4 * windup - 0.16 * thrust;
        dz = 0.65 * thrust;
        th = 0.08 * windup;
        neck.group.rotation.x = 0.46 * windup + 0.32 * thrust;
        neck.group.rotation.z = side * 0.32 * thrust;
        head.group.rotation.z = side * 0.54 * thrust;
        antlers.group.rotation.z = side * 0.22 * thrust;
        antlers.group.scale.setScalar(1 + 0.16 * windup + 0.12 * thrust);
        lf[0] = Math.max(0, Math.sin(c.t * 18)) * 0.4 * windup;
        lid = Math.max(lid, 0.25 * windup);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        dz = -0.7 * k;
        th = -0.08 * k;
        neck.group.rotation.x = -0.3 * k;
        head.group.rotation.y = shake * 0.15;
        lid = Math.max(lid, 0.8 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    for (let i = 0; i < 4; i++) plant(legs[i]!, LEGS[i]!, dy, th, dz, sw[i], lf[i]);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống: legs fold (0–.35) → gục: neck drops, lies down (.3–.6) → tan biến.
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, neck, head, lids, antlers, legs } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.35), lie = ramp(p, 0.3, 0.6);
      const dy = -LEG_LEN * 0.72 * fold;
      body.group.position.y += dy;
      for (let i = 0; i < 4; i++) plant(legs[i]!, LEGS[i]!, dy, 0);
      neck.group.rotation.x = 0.5 * lie;
      head.group.rotation.x = 0.2 * lie;
      head.group.rotation.z = 0.3 * lie;
      antlers.group.scale.setScalar(1 - 0.3 * lie);
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.08));
    },
  },
});
