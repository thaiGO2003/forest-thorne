// Cá Sấu Đầm (crocodile_bite) — bespoke rig from the "Cá Sấu Đầm" concept sheet (Đấu sĩ · Bò sát · Thủy).
// Long, low swamp crocodile: mossy green hide with dark scute ridges, cream belly, raised yellow
// eyes, a long toothy snout with a red mouth, short splayed legs and a heavy ridged tail.
// Idle: lie in wait → blink → gape → tail sweep · Combat idle: watch / tail lash / warning gape ·
// Move: step → fast scuttle · Attack: ready → snap (impact) → recover · Skill (Cá Sấu Tử Cuộn):
// lock on → clamp → death roll inside a water swirl (impact) → tear → settle · Hit: struck → slide
// back → recover · Death: slump → lie flat → vanish. 2★ taller back scutes; 3★ golden scutes.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, chainWave, clamp01, plantLeg, vfx, win, type Leg } from "./stance";

const C = {
  green: 0x6f8a2a, greenL: 0x8ea63c, greenD: 0x4a5e1c, scute: 0x33401a, belly: 0xd9c77a,
  eye: 0xffc21a, pupil: 0x1a1408, mouth: 0xb03030, tongue: 0xd85a5a, tooth: 0xfaf4e0,
  claw: 0xf0ead8, water: 0x6ab8ff, foam: 0xe4f4ff, gold: 0xe8c040,
};

const BODY_Y = 2.6;
const W3 = [0, 0, 0];

interface Parts {
  body: Part; head: Part; jaw: Part; lids: Part; legs: Leg[]; tail: Part[]; swirl: Part;
}

export default defineUnit<Parts>({
  id: "crocodile_bite",
  motion: "ground",
  height: 6,
  durations: { idle: 5.5, attack: 0.75, skill: 2.0, hit: 0.5, move: 0.7 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const scute = star >= 3 ? C.gold : C.scute, ridge = star >= 2 ? 0.75 : 0.45;
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [4.6, 2.2, 7.0], C.green)
      .box([0, -1.0, 0.2], [3.8, 0.3, 6.4], C.belly)
      .spots([0, 0, 0], [4.6, 2.2, 7.0], C.greenL, 16, 307, 0.7)
      .pair([2.35, -0.1, 0], [0.12, 0.9, 6.4], C.greenD);
    for (let z = -3; z <= 3; z += 1) {
      body.box([0, 1.1 + ridge / 2, z], [0.6, ridge, 0.6], scute)
        .pair([1.2, 1.1 + ridge / 3, z + 0.5], [0.5, ridge * 0.66, 0.5], scute);
    }

    const head = k.part("head", body, [0, 0.2, 3.5]);
    head.box([0, 0.3, 1.2], [3.2, 1.6, 2.6], C.green)
      .box([0, 0.15, 3.9], [2.4, 0.9, 2.8], C.green) // upper snout
      .box([0, 0.62, 3.9], [1.6, 0.1, 2.4], C.greenD)
      .pair([0.5, 0.7, 5.15], [0.3, 0.2, 0.3], C.scute) // nostrils
      .pair([0.9, 1.35, 1.0], [0.8, 0.6, 0.8], C.green) // raised eye bumps
      .pair([0.9, 1.4, 1.42], [0.5, 0.4, 0.06], C.eye)
      .pair([0.9, 1.4, 1.46], [0.14, 0.36, 0.04], C.pupil)
      .box([0, -0.32, 3.6], [2.2, 0.1, 3.4], C.mouth);
    for (let z = 2.6; z <= 5.2; z += 0.65) head.pair([1.05, -0.45, z], [0.22, 0.4, 0.22], C.tooth);
    const lids = k.part("lids", head, [0, 1.65, 1.42]);
    lids.pair([0.9, -0.2, 0], [0.6, 0.5, 0.08], C.greenD);
    const jaw = k.part("jaw", head, [0, -0.45, 1.0]);
    jaw.box([0, -0.3, 2.3], [2.6, 0.6, 4.6], C.green)
      .box([0, -0.55, 2.3], [2.2, 0.12, 4.2], C.belly)
      .box([0, 0.02, 2.3], [2.1, 0.1, 4.2], C.mouth)
      .box([0, 0.1, 1.6], [1.2, 0.12, 2.0], C.tongue);
    for (let z = 1.4; z <= 4.2; z += 0.7) jaw.pair([1.0, 0.25, z], [0.22, 0.4, 0.22], C.tooth);

    const legs: Leg[] = ([[1, 2.3], [-1, 2.3], [1, -2.4], [-1, -2.4]] as const).map(([side, z]) => {
      const at = [side * 2.1, -0.6, z] as const, len = BODY_Y - 0.6;
      const part = k.part(`leg${z > 0 ? "F" : "H"}${side}`, body, at);
      part.box([0, -0.7, 0], [1.2, 1.4, 1.3], C.green)
        .box([0, -len + 0.25, 0.35], [1.6, 0.5, 1.8], C.greenD);
      for (const dx of [-0.5, 0, 0.5]) part.box([dx, -len + 0.15, 1.35], [0.24, 0.3, 0.3], C.claw);
      return { part, at, len, toe: 1.5, heel: 0.6 };
    });

    const tail: Part[] = [];
    let parent = body;
    for (let i = 0; i < 6; i++) {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 0.1, -3.5] : [0, 0, -1.3]);
      const w = 3.4 - i * 0.5, h = 1.8 - i * 0.22;
      seg.box([0, 0, -0.65], [w, h, 1.4], i % 2 ? C.greenD : C.green)
        .box([0, h / 2 + ridge / 2, -0.65], [0.4, ridge, 0.5], scute);
      if (i < 3) seg.pair([w / 3, h / 2 + ridge / 3, -0.3], [0.35, ridge * 0.6, 0.4], scute);
      tail.push(seg);
      parent = seg;
    }

    // Water swirl (skill): flat ring of water and foam around the body, independent of the roll.
    const swirl = k.part("swirl", null, [0, 1.2, 0.6]);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, rr = 4.6 + (i % 2) * 0.5;
      swirl.box([Math.cos(a) * rr, (i % 3) * 0.3, Math.sin(a) * rr], [1.4, 0.3, 0.6], i % 3 ? C.water : C.foam, { mat: "glow", rot: [0, -a, 0] });
    }

    if (star >= 2) body.box([0, 1.15, 0], [3.4, 0.12, 6.4], C.greenD);
    if (star >= 3) head.pair([0.9, 1.75, 0.8], [0.3, 0.3, 0.3], C.gold, { mat: "glow" });
    return { body, head, jaw, lids, legs, tail, swirl };
  },

  pose(r, c) {
    const { body, head, jaw, lids, legs, tail, swirl } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig), dy = 0, th = 0, roll = 0, dz = 0, swirlK = 0;
    const sw = [0, 0, 0, 0], lf = [0, 0, 0, 0];
    body.group.scale.set(1 + Math.sin(T * 1.4) * 0.01, 1 + Math.sin(T * 1.4) * 0.02, 1);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(W3, T, c.sig, 0x2c4b);
          const watch = W3[0]!, lash = W3[1]!, gape = W3[2]!;
          dy = -0.1;
          head.group.rotation.y = Math.sin(T * 0.7 + c.sig * 5) * 0.18 * watch;
          head.group.rotation.x = -0.4 * gape;
          jaw.group.rotation.x = 0.3 * gape;
          chainWave(tail, T, 0.12 + 0.3 * lash, 3 + 4 * lash, 0, 0);
        } else {
          // lie in wait (0–.3) → blink (.3–.45) → gape (.45–.72) → tail sweep (.72–1).
          const ph = c.p % 1;
          const gape = win(ph, 0.45, 0.74, 0.07), sweep = win(ph, 0.72, 1, 0.06);
          lid = Math.max(lid, bell(ph, 0.3, 0.42));
          head.group.rotation.x = -0.4 * gape;
          head.group.rotation.y = Math.sin(T * 0.4) * 0.05;
          jaw.group.rotation.x = 0.32 * gape;
          chainWave(tail, T, 0.08 + 0.35 * sweep, 1.6 + 3 * sweep, 0, 0);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.6 * wk + g);
        for (let i = 0; i < 4; i++) {
          const ph = w + (i === 0 || i === 3 ? 0 : Math.PI);
          sw[i] = Math.sin(ph) * (0.4 * wk + 0.55 * g);
          lf[i] = Math.max(0, Math.cos(ph)) * (0.5 * wk + 0.8 * g);
        }
        dy = 0.1 * g;
        // Reptile gait: body and tail snake side to side against the legs.
        body.group.rotation.y = Math.sin(w) * 0.08;
        head.group.rotation.y = -Math.sin(w) * 0.1;
        chainWave(tail, T, 0, 0, 0, 0);
        for (let i = 0; i < tail.length; i++) tail[i]!.group.rotation.y += Math.sin(w - 0.6 - i * 0.5) * 0.12;
        break;
      }
      case "attack": {
        // ready (0–.35) → lunge + snap (impact .5) → recover.
        const p = c.p;
        const ready = ramp(p, 0, 0.35) * (1 - ramp(p, 0.4, 0.5));
        const lunge = win(p, 0.38, 0.66, 0.08);
        dz = -0.4 * ready + 1.4 * lunge;
        dy = 0.25 * lunge;
        th = -0.08 * ready;
        head.group.rotation.x = -0.4 * ready * (1 - ramp(p, 0.44, 0.5)) + 0.08 * lunge;
        jaw.group.rotation.x = 0.35 * ready * (1 - ramp(p, 0.44, 0.5)) + 0.1 * bell(p, 0.55, 0.8);
        chainWave(tail, T, 0.2, 6, 0, 0);
        tail[0]!.group.rotation.y += 0.3 * lunge;
        break;
      }
      case "skill": {
        // Cá Sấu Tử Cuộn: lock on (0–.2) → clamp (.2–.32) → death roll in a water swirl (.32–.78,
        // impact .6) → tear (.72–.88) → settle (.88–1).
        const p = c.p;
        const lock = win(p, 0, 0.24, 0.06), clamp = win(p, 0.18, 0.34, 0.04);
        const spin = ramp(p, 0.32, 0.78), spinning = win(p, 0.3, 0.8, 0.05);
        const tear = bell(p, 0.72, 0.9);
        dz = 1.4 * Math.max(clamp, spinning) - 0.3 * lock;
        dy = 0.15 * spinning;
        roll = spin * Math.PI * 4;
        head.group.rotation.x = -0.4 * lock * (1 - ramp(p, 0.2, 0.26)) + 0.05 * tear;
        jaw.group.rotation.x = 0.35 * lock * (1 - ramp(p, 0.2, 0.26));
        head.group.rotation.y = Math.sin(c.t * 24) * 0.25 * tear;
        // Legs tuck in against the belly while the body spins.
        for (let i = 0; i < 4; i++) lf[i] = 1.6 * spinning;
        swirlK = spinning;
        swirl.group.rotation.y = -c.t * 9;
        lid = Math.max(lid, 0.4 * lock);
        chainWave(tail, T, 0.15 * (1 - spinning), 5, 0, 0);
        break;
      }
      case "hit": {
        const p = c.p;
        const kk = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.9));
        const shake = (1 - ramp(p, 0, 0.25)) * Math.sin(c.t * 70);
        dz = -0.8 * kk; roll = 0.06 * kk;
        head.group.rotation.y = shake * 0.12 - 0.15 * kk;
        jaw.group.rotation.x = 0.15 * kk;
        lid = Math.max(lid, 0.8 * kk + (p < 0.08 ? 1 : 0));
        chainWave(tail, T, 0.3 * kk + 0.05, 12, 0, 0);
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    body.group.rotation.z = roll;
    for (let i = 0; i < 4; i++) plantLeg(legs[i]!, BODY_Y + dy, th, roll, dz, sw[i], lf[i], 0.05);
    vfx(swirl, swirlK);
    swirl.group.position.z += dz;
    lids.group.scale.y = 0.08 + 0.92 * clamp01(lid);
  },

  death: {
    // slump (0–.3) → lie flat, jaw slack (.2–.5) → still (.5–.75) → vanish.
    seconds: 1.2,
    vanishAt: 0.75,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, jaw, lids, legs, tail, swirl } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.3), lie = ramp(p, 0.2, 0.5);
      const roll = 0.25 * lie;
      const y = BODY_Y - fall * (BODY_Y - (1.15 * Math.cos(roll) + 2.4 * Math.sin(roll) + 0.6));
      body.group.position.y = y;
      body.group.rotation.z = roll;
      for (const l of legs) plantLeg(l, y, 0, roll, 0, 0, 0, 0.02);
      head.group.rotation.z = 0.1 * lie;
      jaw.group.rotation.x = 0.1 * lie;
      for (let i = 0; i < tail.length; i++) tail[i]!.group.rotation.y = 0.08 * ramp(p, 0.2 + i * 0.04, 0.5 + i * 0.04);
      vfx(swirl, 0);
      lids.group.scale.y = 0.08 + 0.92 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.1));
    },
  },
});
