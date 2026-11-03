// Tượng Đại Thủy (catalog id elephant_guard, kept for save compatibility) — bespoke rig from the approved
// "Tượng Đại Thủy" sheet. Big pale-grey elephant in blue and gold water-swirl armour, with a gold crown
// plate, large blue-lined ears, long ivory tusks, a three-segment trunk and a glassy water mantle.
// Idle: stand → breathe → trunk wave → water ripple · Combat idle: alert / guard allies / hold shield
// (deterministic beats) · Move: step → run → sprint · Attack: tusk thrust → trunk sweep makes a wave on
// impact → push · Skill (Đại Xoáy Thanh Tẩy): gather → call whirlpool (trunk raised) → whirl around allies
// (impact) → cleanse → wave spreads → hold the guard bubble · Hit: struck → back step → steady ·
// Death: falls → lies down → dissolves. 2★ gold forehead gem + leg bands; 3★ glowing water crest.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  grey: 0xd8dce4, greyD: 0xa8b0bc, blue: 0x3c78d8, blueD: 0x23509c, blueL: 0x7fb4ff, gold: 0xe8b23a,
  goldD: 0xb07c1c, tusk: 0xf6f0e0, eye: 0x1a2030, water: 0x8fd0ff, foam: 0xe8f6ff,
};

const LEG_LEN = 4.4, BODY_Y = LEG_LEN + 0.6 + 0.05;
/** Foot reach ahead of / behind the leg axis, used by plant() to stop toes digging in. */
const TOE = 0.95;
const LEGS: readonly (readonly [number, number, number])[] = [[1.6, -0.6, 1.8], [-1.6, -0.6, 1.8], [1.6, -0.6, -1.8], [-1.6, -0.6, -1.8]];
const TRUNK_LAG = 0.08;

interface Parts { body: Part; head: Part; lids: Part; earL: Part; earR: Part; trunk: Part[]; tail: Part; legs: Part[]; mantle: Part }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
const blinkAt = (time: number, sig: number) => bell((time + sig * 6.3) % 4.0, 0, 0.16);
function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}
const W = [0, 0, 0];
function beats(time: number, sig: number, salt: number) {
  const s = time * 0.36 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  for (let i = 0; i < 3; i++) W[i] = (a === i ? 1 - m : 0) + (b === i ? m : 0);
}
function plant(leg: Part, at: readonly [number, number, number], dy: number, th: number, dz = 0, swing = 0, lift = 0) {
  const drop = dy + at[1] * (Math.cos(th) - 1) - at[2] * Math.sin(th);
  const rot = swing + Math.asin(Math.max(-0.7, Math.min(0.7, dz / LEG_LEN))) - th;
  leg.group.rotation.x += rot;
  // A rotated foot box dips its toe (forward) or heel (back) by about TOE·|sin|: shorten to compensate.
  leg.group.scale.y = Math.max(0.2, Math.min(1, (LEG_LEN + drop - lift - TOE * Math.abs(Math.sin(rot))) / LEG_LEN));
}
/** Trunk curl: `raise` lifts it forward/up (−x), each segment trails the previous by TRUNK_LAG. */
function curl(trunk: readonly Part[], time: number, raise: number, sway: number, rate: number) {
  for (let i = 0; i < trunk.length; i++) {
    const tt = time - i * TRUNK_LAG;
    trunk[i]!.group.rotation.x += -raise * (0.5 + 0.25 * i);
    trunk[i]!.group.rotation.z += Math.sin(tt * rate) * sway * (0.4 + 0.3 * i);
  }
}
/** Water mantle (glass shell): hidden and collapsed when 0, so portrait framing ignores it. */
function mantle(m: Part, k: number, wobble = 0) {
  m.group.visible = k > 0.02;
  if (!m.group.visible) { m.group.scale.setScalar(0.001); return; }
  m.group.scale.set(0.85 + 0.15 * k + wobble, k + wobble, 0.85 + 0.15 * k + wobble);
}

export default defineUnit<Parts>({
  id: "elephant_guard",
  motion: "ground",
  height: 12,
  durations: { idle: 5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.7 },
  impact: { attack: 0.5, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0.9, 0], [4.4, 3.6, 5.4], C.grey).box([0, 2.0, 0], [4.6, 1.6, 4.8], C.blue)
      .box([0, 2.85, 0], [3.6, 0.3, 4.0], C.gold).pair([2.32, 1.6, 0], [0.12, 1.2, 3.4], C.gold)
      .pair([2.38, 1.6, 0.6], [0.06, 0.8, 0.8], C.foam).box([0, -0.85, 0], [3.8, 0.3, 4.6], C.greyD);
    const head = k.part("head", body, [0, 1.6, 2.6]);
    head.box([0, 0.6, 0.9], [3.4, 3.0, 2.4], C.grey).box([0, 2.0, 0.9], [3.0, 0.6, 2.2], C.gold)
      .box([0, 2.6, 1.0], [1.4, 0.8, 0.4], C.blue).pair([1.1, 0.9, 2.12], [0.4, 0.4, 0.08], C.eye)
      .pair([1.0, 1.25, 2.1], [0.7, 0.2, 0.1], C.greyD);
    const lids = k.part("lids", head, [0, 1.05, 2.15]);
    lids.pair([1.1, -0.15, 0], [0.45, 0.45, 0.05], C.grey);
    const ear = (side: 1 | -1) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.7, 1.2, 0.6]);
      e.box([side * 0.9, -0.4, -0.2], [1.8, 2.8, 0.3], C.grey).box([side * 0.9, -0.4, -0.05], [1.3, 2.2, 0.08], C.blueL)
        .box([side * 1.6, 0.6, -0.2], [0.3, 0.6, 0.35], C.gold);
      return e;
    };
    const earR = ear(1), earL = ear(-1);
    head.pair([0.9, -0.4, 2.1], [0.5, 0.5, 1.6], C.tusk, { rot: [0.6, 0, 0] })
      .pair([0.9, 0.1, 3.0], [0.45, 0.45, 1.0], C.tusk, { rot: [-0.3, 0, 0] });
    // Trunk: three chained segments hanging forward/down; the tip rests well above the ground.
    const trunk: Part[] = [];
    let parent = head;
    for (let i = 0; i < 3; i++) {
      const seg = k.part(`trunk${i}`, parent, i === 0 ? [0, -0.2, 2.0] : [0, -1.2, 0.15]);
      seg.box([0, -0.6, 0], [1.1 - i * 0.2, 1.3, 1.1 - i * 0.2], C.grey).box([0, -0.6, 0.5 - i * 0.1], [0.8 - i * 0.15, 0.2, 0.1], C.greyD);
      trunk.push(seg);
      parent = seg;
    }
    trunk[0]!.group.rotation.x = 0.25;
    const tail = k.part("tail", body, [0, 1.4, -2.8]);
    tail.box([0, -0.8, -0.2], [0.35, 1.8, 0.35], C.greyD).box([0, -1.8, -0.2], [0.6, 0.6, 0.6], C.blue);
    const legs = LEGS.map((at, i) => {
      const l = k.part(`leg${i}`, body, [at[0], at[1], at[2]]);
      l.box([0, -LEG_LEN / 2, 0], [1.5, LEG_LEN, 1.5], C.grey).box([0, -LEG_LEN + 0.25, 0.1], [1.7, 0.5, 1.7], C.greyD)
        .box([0, -1.0, 0], [1.6, 0.5, 1.6], C.blueD);
      if (star >= 2) l.box([0, -1.0, 0], [1.65, 0.2, 1.65], C.gold);
      return l;
    });
    const mantle = k.part("mantle", null, [0, 0, 0.3]);
    mantle.box([0, 1.6, 0], [10.5, 3.2, 12.0], C.water, { mat: "glass" })
      .box([0, 4.5, 0], [9.0, 2.6, 10.4], C.water, { mat: "glass" })
      .box([0, 6.8, 0], [7.0, 2.0, 8.0], C.water, { mat: "glass" })
      .box([0, 8.4, 0], [4.6, 1.2, 5.2], C.water, { mat: "glass" });
    if (star >= 2) head.box([0, 2.6, 1.22], [0.6, 0.6, 0.1], C.water, { mat: "glow" });
    if (star >= 3) {
      for (const x of [-1.0, 0, 1.0]) head.box([x, 3.2 + (x === 0 ? 0.3 : 0), 0.9], [0.5, 0.9 + (x === 0 ? 0.5 : 0), 0.5], C.water, { mat: "glow" });
    }
    return { body, head, lids, earL, earR, trunk, tail, legs, mantle };
  },

  pose(r, c) {
    const { body, head, lids, earL, earR, trunk, tail, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let dy = 0, th = 0, dz = 0;
    const sw = [0, 0, 0, 0], lf = [0, 0, 0, 0];
    mantle(r.mantle, 0);
    earL.group.rotation.y = Math.sin(T * 1.6) * 0.12;
    earR.group.rotation.y = -Math.sin(T * 1.6 + 0.8) * 0.12;
    tail.group.rotation.z = Math.sin(T * 1.9) * 0.2;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x6e21);
          const alert = W[0]!, guard = W[1]!, hold = W[2]!;
          dy = -0.3 - 0.15 * alert + Math.sin(T * 2.2) * 0.05;
          th = 0.04;
          curl(trunk, T, 0.4 * alert + 0.8 * guard, 0.12, 2.2);
          earL.group.rotation.y += 0.4 * alert;
          earR.group.rotation.y -= 0.4 * alert;
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 3) * 0.2 * (1 - hold);
          mantle(r.mantle, 0.8 * hold, Math.sin(T * 3) * 0.02 * hold);
        } else {
          // stand (0–.25) → breathe (.25–.5) → trunk wave (.5–.75) → water ripple (.75–1).
          const ph = c.p % 1;
          const breathe = win(ph, 0.25, 0.5, 0.05), wave = win(ph, 0.5, 0.76, 0.05), ripple = win(ph, 0.74, 1, 0.06);
          body.group.scale.set(1 + 0.03 * breathe + Math.sin(T * 1.6) * 0.01, 1, 1 + 0.02 * breathe); // y stays 1: legs hang off the body
          curl(trunk, T, 0.8 * wave, 0.12 + 0.3 * wave, 2 + 4 * wave);
          head.group.rotation.x = -0.12 * wave;
          earL.group.rotation.y += 0.4 * ripple * Math.sin(c.t * 8);
          earR.group.rotation.y -= 0.4 * ripple * Math.sin(c.t * 8);
          dy = -0.05 - 0.05 * Math.sin(T * 1.6);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        for (let i = 0; i < 4; i++) {
          const ph = w + (i === 0 || i === 3 ? 0 : Math.PI);
          sw[i] = Math.sin(ph) * (0.25 * wk + 0.4 * g);
          lf[i] = Math.max(0, Math.cos(ph)) * (0.6 * wk + 1.0 * g);
        }
        dy = Math.abs(Math.sin(w)) * (0.1 + 0.2 * g) - 0.15 * g;
        th = 0.05 * g;
        curl(trunk, T, 0.2 + 0.4 * g, 0.2, 5);
        earL.group.rotation.y += 0.4 * g;
        earR.group.rotation.y -= 0.4 * g;
        break;
      }
      case "attack": {
        // tusk thrust (0–.45) → trunk sweep makes a wave (impact .5) → push the wave.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.5));
        const thrust = ramp(p, 0.4, 0.5) * (1 - ramp(p, 0.62, 0.92));
        const sweep = win(p, 0.44, 0.75, 0.05);
        dz = -0.4 * wind + 1.0 * thrust;
        th = -0.05 * wind + 0.06 * thrust;
        head.group.rotation.x = -0.25 * wind + 0.2 * thrust;
        curl(trunk, T, 0.9 * wind - 0.2 * thrust, 0, 0);
        for (let i = 0; i < trunk.length; i++) trunk[i]!.group.rotation.y += Math.sin((p - 0.44) / 0.31 * Math.PI) * 0.6 * sweep;
        break;
      }
      case "skill": {
        // gather (0–.2) → call whirlpool, trunk up (.15–.4) → whirl round allies (impact .55) → cleanse →
        // wave spreads (.6–.8) → hold the guard bubble (.75–1).
        const p = c.p;
        const gather = win(p, 0, 0.42, 0.08), call = win(p, 0.15, 0.62, 0.06);
        const whirl = win(p, 0.45, 0.7, 0.04), spread = win(p, 0.6, 0.82, 0.04), hold = ramp(p, 0.72, 0.85) * (1 - ramp(p, 0.94, 1));
        dy = -0.4 * gather + 0.2 * call;
        th = -0.08 * call + 0.05 * spread;
        head.group.rotation.x = -0.35 * call + 0.1 * spread;
        curl(trunk, T, 1.4 * call + 0.3 * spread, 0.3 * whirl, 9);
        earL.group.rotation.y += 0.6 * (call + whirl);
        earR.group.rotation.y -= 0.6 * (call + whirl);
        lf[0] = Math.max(0, Math.sin(c.t * 14)) * 0.6 * gather; // stamp to gather the tide
        mantle(r.mantle, Math.max(ramp(p, 0.4, 0.58) * (1 - ramp(p, 0.62, 0.7)) * 0.6, hold), Math.sin(c.t * 9) * 0.02 * whirl);
        lid = Math.max(lid, 0.3 * gather);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        dz = -0.6 * k;
        th = -0.06 * k;
        head.group.rotation.y = shake * 0.1;
        head.group.rotation.x = -0.15 * k;
        curl(trunk, T, 0.6 * k, 0.2 * k, 16);
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
    // Ngã xuống: legs fold (0–.35) → gục: head and trunk drop, rolls slightly (.3–.6) → tan biến.
    seconds: 1.3,
    vanishAt: 0.72,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, earL, earR, trunk, legs } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.35), lie = ramp(p, 0.3, 0.6);
      const dy = -LEG_LEN * 0.6 * fold;
      body.group.position.y += dy;
      mantle(r.mantle, 0);
      for (let i = 0; i < 4; i++) plant(legs[i]!, LEGS[i]!, dy, 0);
      // The trunk curls up and back as the head sinks, so it never digs into the ground.
      head.group.rotation.x = 0.15 * lie;
      curl(trunk, c.time, 1.0 * lie, 0, 0);
      earL.group.rotation.y = 0.3 * lie;
      earR.group.rotation.y = -0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.08));
    },
  },
});
