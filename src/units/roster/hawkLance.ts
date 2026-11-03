// Thương Ưng (catalog id hawk_hunter, kept for save compatibility) — bespoke rig from the approved
// "Thương Ưng" sheet. Upright brown eagle knight with a white head, gold beak, big wings with gold trim,
// a blue and gold tabard with a fleur emblem, yellow talons and a gold-and-steel lance.
// Idle: perch → preen → scan → wing flap · Combat idle: hover / hold / ready (deterministic beats) ·
// Move: step → run → take off · Attack: raise lance → horizontal slash on impact → recover ·
// Skill: soar up → circle → lock on → dive → pierce (impact) → shockwave · Hit: flinch → pushed back →
// steady · Death: falls → lies down → feathers vanish. 2★ gold pauldrons + plume; 3★ crown and
// glowing spear head + wing gems.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  brown: 0x6a4a34, brownD: 0x45301f, brownL: 0x8c6a4c, white: 0xf4f2ec, grey: 0xc8c4bc,
  beak: 0xf0b030, beakD: 0xc08018, eye: 0x1c1410, talon: 0xe8b83a, claw: 0x2a2622,
  blue: 0x2c4c9c, blueD: 0x1c3070, gold: 0xe8b23a, goldD: 0xb07c1c, steel: 0xd8e4f0, glow: 0x9fd8ff,
};

const BODY_Y = 4.3, LEG_LEN = 4.0;
/** Foot reach ahead of / behind the leg axis, used by plant() to stop toes digging in. */
const TOE = 1.4;
const LEG_AT: readonly [number, number, number] = [0.8, 0, 0];

interface Parts {
  body: Part; head: Part; lids: Part; wingL: Part; wingR: Part; wingLTip: Part; wingRTip: Part;
  tail: Part; lance: Part; tabard: Part; legs: Part[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
const blinkAt = (time: number, sig: number) => bell((time + sig * 4.1) % 3.6, 0, 0.14);
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
/** Keep a straight hanging leg planted after the parent dropped `dy` and pitched `th` (shortens only). */
function plant(leg: Part, at: readonly [number, number, number], len: number, dy: number, th: number, dz = 0, swing = 0, lift = 0) {
  const drop = dy + at[1] * (Math.cos(th) - 1) - at[2] * Math.sin(th);
  const rot = swing + Math.asin(Math.max(-0.7, Math.min(0.7, dz / len))) - th;
  leg.group.rotation.x += rot;
  // A rotated foot box dips its toe (forward) or heel (back) by about TOE·|sin|: shorten to compensate.
  leg.group.scale.y = Math.max(0.2, Math.min(1, (len + drop - lift - TOE * Math.abs(Math.sin(rot))) / len));
}
/** Wings: `spread` opens them (0 folded), `beat` flaps, the tip trails by 0.07 s. */
function wings(r: Parts, time: number, spread: number, rate: number, amp: number) {
  const a = Math.sin(time * rate), b = Math.sin((time - 0.07) * rate);
  for (const [w, tip, s] of [[r.wingR, r.wingRTip, 1], [r.wingL, r.wingLTip, -1]] as const) {
    w.group.rotation.z += s * (1.25 * spread + a * amp);
    w.group.rotation.y += -s * 0.3 * spread;
    tip.group.rotation.z += s * (b * amp * 0.8 - 0.4 * (1 - spread));
  }
}

export default defineUnit<Parts>({
  id: "hawk_hunter",
  motion: "ground",
  height: 12,
  durations: { idle: 4.5, attack: 0.85, skill: 1.8, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 1.4, 0], [2.8, 3.6, 2.4], C.brown).box([0, 1.4, 1.1], [2.0, 2.8, 0.4], C.brownL);
    const tabard = k.part("tabard", body, [0, 2.4, 1.3]);
    tabard.box([0, -1.2, 0.05], [2.2, 2.6, 0.2], C.blue).box([0, -1.2, 0.17], [0.7, 0.9, 0.06], C.gold)
      .box([0, -0.1, 0.18], [2.2, 0.3, 0.1], C.gold);
    const head = k.part("head", body, [0, 3.3, 0.3]);
    head.box([0, 0.9, 0.2], [2.4, 2.2, 2.4], C.white).box([0, 0.2, -0.4], [2.6, 1.0, 1.8], C.grey)
      .pair([0.9, 1.15, 1.1], [0.5, 0.4, 0.4], C.eye).pair([1.0, 1.4, 1.1], [0.7, 0.2, 0.5], C.white)
      .box([0, 0.8, 1.6], [0.8, 0.8, 1.0], C.beak).box([0, 0.45, 2.2], [0.5, 0.5, 0.5], C.beakD);
    const lids = k.part("lids", head, [0, 1.35, 1.3]);
    lids.pair([0.9, -0.2, 0], [0.55, 0.45, 0.1], C.white);
    const wing = (side: 1 | -1) => {
      const w = k.part(side > 0 ? "wingR" : "wingL", body, [side * 1.5, 2.8, -0.2]);
      w.box([side * 0.3, -1.2, -0.2], [0.5, 2.8, 2.4], C.brown).box([side * 0.35, -0.2, 0.3], [0.45, 1.0, 1.6], C.gold);
      const tip = k.part(side > 0 ? "wingRTip" : "wingLTip", w, [side * 0.3, -2.4, -0.4]);
      tip.box([0, -0.8, -0.4], [0.4, 1.8, 2.2], C.brownD).box([0, -1.6, -0.6], [0.35, 0.6, 1.6], C.white);
      return { w, tip };
    };
    const wr = wing(1), wl = wing(-1);
    const tail = k.part("tail", body, [0, 0.2, -1.2]);
    tail.box([0, -0.4, -0.8], [1.8, 0.4, 1.8], C.white, { rot: [0.6, 0, 0] });
    // Lance held across the right side, point forward.
    const lance = k.part("lance", body, [1.6, 1.5, 0.6]);
    lance.box([0, 0, 0.6], [0.3, 0.3, 6.4], C.goldD).box([0, 0, 4.1], [0.2, 0.7, 1.2], C.steel)
      .box([0, 0, 3.4], [0.5, 0.5, 0.4], C.gold).box([0, 0, -2.7], [0.4, 0.4, 0.4], C.gold);
    const legs = ([1, -1] as const).map((side) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * LEG_AT[0], LEG_AT[1], LEG_AT[2]]);
      l.box([0, -0.6, 0], [0.9, 1.2, 0.9], C.brownL).box([0, -2.4, 0], [0.5, 2.6, 0.5], C.talon)
        .box([0, -3.8, 0.35], [1.2, 0.4, 1.4], C.talon).box([0, -3.85, 1.15], [0.9, 0.3, 0.3], C.claw);
      return l;
    });
    if (star >= 2) {
      body.pair([1.5, 3.0, 0], [0.8, 0.6, 1.6], C.gold);
      head.box([0, 2.1, -0.2], [0.4, 0.8, 1.2], C.blue);
    }
    if (star >= 3) {
      head.box([0, 2.1, 0.3], [2.0, 0.4, 1.8], C.gold).box([0, 2.5, 0.8], [0.4, 0.5, 0.2], C.glow, { mat: "glow" });
      lance.box([0, 0, 4.1], [0.24, 0.4, 0.9], C.glow, { mat: "glow" });
      wr.w.box([0.6, -0.2, 0.4], [0.1, 0.4, 0.4], C.glow, { mat: "glow" });
      wl.w.box([-0.6, -0.2, 0.4], [0.1, 0.4, 0.4], C.glow, { mat: "glow" });
    }
    return { body, head, lids, wingL: wl.w, wingR: wr.w, wingLTip: wl.tip, wingRTip: wr.tip, tail, lance, tabard, legs };
  },

  pose(r, c) {
    const { body, head, lids, lance, tabard, legs, tail } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let dy = 0, th = 0, dz = 0, sw0 = 0, sw1 = 0, lf0 = 0, lf1 = 0;
    body.group.scale.set(1 + Math.sin(T * 1.8) * 0.015, 1 + Math.sin(T * 1.8) * 0.02, 1);
    tail.group.rotation.x = Math.sin(T * 1.6) * 0.06;
    tabard.group.rotation.x = Math.sin(T * 2.1) * 0.04;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x31a5);
          const hover = W[0]!, hold = W[1]!, ready = W[2]!;
          dy = -0.3 - 0.15 * ready + hover * (0.6 + Math.sin(T * 6) * 0.2);
          th = 0.08 + 0.06 * ready;
          wings(r, T, 0.25 + 0.6 * hover, 6, 0.25 * hover);
          lance.group.rotation.x = -0.15 * hold - 0.3 * ready;
          head.group.rotation.y = (Math.sin(T * 0.9 + c.sig * 4) * 0.3) * (1 - 0.6 * ready);
          lid = Math.max(lid, 0.2 * ready);
        } else {
          // perch (0–.25) → preen (.25–.5) → scan (.5–.75) → wing flap (.75–1).
          const ph = c.p % 1;
          const preen = win(ph, 0.25, 0.5, 0.05), scan = win(ph, 0.5, 0.76, 0.05), flap = win(ph, 0.74, 1, 0.06);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.08 - 1.0 * preen + scan * Math.sin((ph - 0.5) / 0.26 * Math.PI * 2) * 0.55;
          head.group.rotation.x = 0.35 * preen + Math.sin(c.t * 14) * 0.05 * preen;
          wings(r, T, 0.15 * preen + 0.9 * flap, 7, 0.35 * flap);
          dy = -0.1 + flap * 0.15;
        }
        break;
      }
      case "move": {
        // No velocity in PoseCtx: combat takes off; out of combat steps blend into a run (c.p 0.8 → 1.8).
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        sw0 = Math.sin(w) * 0.35 * wk; sw1 = -sw0;
        lf0 = Math.max(0, Math.cos(w)) * 0.5 * wk;
        lf1 = Math.max(0, -Math.cos(w)) * 0.5 * wk;
        dy = Math.abs(Math.sin(w)) * 0.1 * wk + 1.4 * g + Math.sin(T * 12) * 0.2 * g;
        th = 0.1 * wk + 0.45 * g;
        wings(r, T, 0.2 * wk + g, 12, 0.45 * g);
        head.group.rotation.x = -0.35 * g;
        lance.group.rotation.x = -0.3 * g;
        break;
      }
      case "attack": {
        // raise lance (0–.4) → horizontal slash (impact .5) → recover.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.48));
        const slash = ramp(p, 0.4, 0.56), recover = ramp(p, 0.62, 0.95);
        const lunge = ramp(p, 0.38, 0.5) * (1 - recover);
        dz = -0.3 * wind + 0.9 * lunge;
        th = 0.15 * lunge;
        lance.group.rotation.y = (0.9 * wind - 1.6 * slash) * (1 - recover);
        lance.group.rotation.x = -0.25 * wind * (1 - slash);
        body.group.rotation.y = (0.3 * wind - 0.4 * slash) * (1 - recover);
        wings(r, T, 0.3 * wind + 0.5 * lunge, 8, 0.1);
        head.group.rotation.x = 0.1 * lunge;
        break;
      }
      case "skill": {
        // Kích Thương Thiên Giáng: soar (0–.25) → circle (.2–.4) → lock (.38–.5) → dive (.48–.6, impact .6)
        // → pierce hold (.6–.72) → shockwave settle (.7–1).
        const p = c.p;
        const up = ramp(p, 0, 0.25) * (1 - ramp(p, 0.48, 0.6));
        const circle = win(p, 0.2, 0.42, 0.05), lock = win(p, 0.36, 0.52, 0.04);
        const dive = win(p, 0.48, 0.74, 0.04), wave = bell(p, 0.7, 1);
        dy = 5 * up + 1.0 * dive - 0.3 * wave;
        dz = 1.6 * dive;
        th = -0.2 * up + 0.5 * ramp(p, 0.46, 0.58) * (1 - ramp(p, 0.72, 0.9));
        body.group.rotation.y = Math.sin(clamp01((p - 0.2) / 0.22) * Math.PI * 2) * 0.6 * circle;
        wings(r, T, Math.max(up, wave) * (1 - 0.7 * dive), 10, 0.35 * (up + circle) * (1 - lock));
        lance.group.rotation.x = 0.5 * dive - 0.3 * lock;
        head.group.rotation.x = 0.3 * lock - 0.2 * up;
        lid = Math.max(lid, 0.35 * lock);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        dz = -0.6 * k;
        th = -0.15 * k;
        wings(r, T, 0.4 * k, 16, 0.15 * k);
        head.group.rotation.y = shake * 0.15;
        lid = Math.max(lid, 0.8 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    plant(legs[0]!, LEG_AT, LEG_LEN, dy, th, dz, sw0, lf0);
    plant(legs[1]!, LEG_AT, LEG_LEN, dy, th, dz, sw1, lf1);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống: legs fold (0–.35) → gục: tips onto its side, wings sprawl (.25–.55) → feathers vanish.
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, lance, legs } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.35), lie = ramp(p, 0.25, 0.55);
      const dy = -3.0 * fold;
      body.group.position.y += dy;
      body.group.rotation.x = 0.3 * lie;
      body.group.rotation.z = 0.15 * lie;
      plant(legs[0]!, LEG_AT, LEG_LEN, dy, 0.3 * lie);
      plant(legs[1]!, LEG_AT, LEG_LEN, dy, 0.3 * lie);
      wings(r, c.time, 0.75 * fold, 0, 0); // spread wings keep the long feathers off the ground
      lance.group.rotation.z = -0.4 * lie;
      head.group.rotation.x = 0.4 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.08));
    },
  },
});
