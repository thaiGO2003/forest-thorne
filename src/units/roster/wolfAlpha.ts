// Sói Thủ Lĩnh (wolf_alpha) — bespoke rig from the "Sói Thủ Lĩnh" concept sheet (Đấu sĩ · Thú).
// Shaggy dark-brown pack leader with a cream chest ruff and muzzle, amber eyes, tan stone plates on
// the shoulders and flank, and a big bushy tail. Idle: watch → sniff the wind → soft growl → howl ·
// Combat idle: lock on / bare fangs / alert · Move: walk → run · Attack: crouch → lunge → bite
// (impact) → recover · Skill (Tiếng Tru Đầu Đàn): howl with sound rings → lock → pounce → finishing
// strike with a stone burst (impact) · Hit: struck → slip → steady · Death: knees buckle → lie down
// → vanish. 2★ thicker mane + more stone plates; 3★ glowing amber stones and crest.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, chainWave, clamp01, hold, plantLeg, vfx, win, type Leg } from "./stance";

const C = {
  fur: 0x5a4636, furD: 0x3e2f24, furL: 0x7a6450, cream: 0xe8d8b8, creamD: 0xc8b494,
  stone: 0xc49a62, stoneD: 0x8a6a42, eye: 0xffb020, pupil: 0x1a1008, nose: 0x1e1612,
  mouth: 0x9a2a2a, fang: 0xfff6e6, claw: 0xf4ecdc, ring: 0xffd27a, amber: 0xffb54a,
};

const BODY_Y = 5.4;
const W3 = [0, 0, 0];

interface Parts {
  body: Part; neck: Part; head: Part; jaw: Part; lids: Part; earL: Part; earR: Part;
  legs: Leg[]; tail: Part[]; rings: Part; burst: Part;
}

export default defineUnit<Parts>({
  id: "wolf_alpha",
  motion: "ground",
  height: 12,
  durations: { idle: 5.2, attack: 0.8, skill: 2.0, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.72 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [3.8, 3.2, 7.0], C.fur)
      .box([0, 1.7, 0.6], [3.0, 0.5, 5.2], C.furD) // dark saddle
      .box([0, -1.5, 0.4], [3.0, 0.3, 5.6], C.creamD)
      .spots([0, 0, 0], [3.8, 3.2, 7.0], C.furL, 14, 211, 0.8)
      .pair([1.95, 0.6, -1.2], [0.3, 1.6, 2.0], C.stone).pair([2.05, 0.3, -1.0], [0.15, 0.8, 1.0], C.stoneD);
    // Shaggy shoulder mane + cream chest ruff.
    const neck = k.part("neck", body, [0, 0.8, 3.2]);
    neck.box([0, 0.5, 0.4], [4.2, 3.6, 2.6], C.fur)
      .box([0, -0.6, 1.4], [3.2, 2.4, 0.8], C.cream)
      .box([0, -1.6, 1.2], [2.2, 1.0, 0.8], C.cream)
      .box([0, 2.3, -0.2], [2.4, 0.8, 2.4], C.furD)
      .pair([2.1, 1.1, 0.0], [0.4, 1.4, 1.8], C.stone).pair([2.2, 1.5, 0.3], [0.2, 0.6, 0.8], C.stoneD);

    const head = k.part("head", neck, [0, 1.3, 1.8]);
    head.box([0, 0.4, 0.4], [3.2, 2.8, 2.6], C.fur)
      .box([0, -0.3, 2.3], [1.9, 1.3, 1.8], C.cream) // muzzle
      .box([0, 0.15, 3.25], [0.8, 0.5, 0.2], C.nose)
      .pair([1.65, -0.2, 0.6], [0.4, 1.6, 1.6], C.cream) // cheek fluff
      .pair([0.8, 0.95, 1.72], [0.6, 0.4, 0.1], C.eye)
      .pair([0.8, 0.95, 1.78], [0.22, 0.36, 0.06], C.pupil)
      .pair([0.8, 1.3, 1.7], [0.8, 0.22, 0.2], C.furD) // stern brow
      .box([0, -0.96, 2.4], [1.5, 0.1, 1.4], C.mouth)
      .pair([0.5, -1.1, 2.9], [0.22, 0.4, 0.22], C.fang);
    const lids = k.part("lids", head, [0, 1.15, 1.82]);
    lids.pair([0.8, -0.2, 0], [0.7, 0.5, 0.1], C.fur);
    const ear = (side: 1 | -1) => {
      const e = k.part(side > 0 ? "earR" : "earL", head, [side * 1.05, 1.8, -0.1]);
      e.box([0, 0.75, 0], [0.9, 1.5, 0.7], C.furD).box([0, 0.6, 0.36], [0.45, 0.9, 0.06], C.creamD);
      return e;
    };
    const earR = ear(1), earL = ear(-1);
    const jaw = k.part("jaw", head, [0, -0.95, 1.6]);
    jaw.box([0, -0.2, 0.9], [1.7, 0.4, 1.6], C.cream)
      .box([0, 0.05, 0.9], [1.3, 0.1, 1.3], C.mouth)
      .pair([0.5, 0.2, 1.5], [0.2, 0.35, 0.2], C.fang);

    const legs: Leg[] = ([[1, 2.4], [-1, 2.4], [1, -2.5], [-1, -2.5]] as const).map(([side, z]) => {
      const front = z > 0, at = [side * 1.3, -1.1, z] as const, len = BODY_Y - 1.1;
      const part = k.part(`leg${front ? "F" : "H"}${side}`, body, at);
      part.box([0, -(len - 0.8) / 2, 0], [1.2, len - 0.8, 1.3], front ? C.fur : C.furD)
        .box([0, -0.4, front ? 0.1 : -0.2], [1.4, 1.2, 1.6], C.furL) // shaggy upper leg
        .box([0, -len + 0.4, 0.2], [1.3, 0.8, 1.7], C.cream);
      for (const dx of [-0.38, 0, 0.38]) part.box([dx, -len + 0.18, 1.15], [0.26, 0.36, 0.3], C.claw);
      return { part, at, len, toe: 1.3, heel: 0.7 };
    });

    // Bushy tail: chunky tufts that widen toward the middle and end in a cream tip.
    const tail: Part[] = [];
    let parent = body;
    for (let i = 0; i < 5; i++) {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 1.1, -3.5] : [0, 0, -1.3]);
      const w = [1.2, 1.9, 2.2, 1.9, 1.4][i]!;
      seg.box([0, 0, -0.65], [w, w, 1.5], i % 2 ? C.furL : C.fur);
      if (i === 4) seg.box([0, 0, -1.4], [1.0, 1.0, 0.6], C.cream);
      tail.push(seg);
      parent = seg;
    }

    // Howl rings (skill) in front of the muzzle and a stone burst at the strike point.
    const rings = k.part("rings", head, [0, 0.6, 4.2]);
    for (const [s, d] of [[1, 0], [1.6, 0.9], [2.2, 1.8]] as const) {
      rings.box([0, s, d], [2 * s, 0.2, 0.2], C.ring, { mat: "glow" }).box([0, -s, d], [2 * s, 0.2, 0.2], C.ring, { mat: "glow" })
        .pair([s, 0, d], [0.2, 2 * s, 0.2], C.ring, { mat: "glow" });
    }
    const burst = k.part("burst", null, [0, 1.2, 6.5]);
    for (const [x, y, z, s] of [[0, 0, 0, 1.2], [1.2, 0.4, -0.3, 0.8], [-1.1, 0.2, 0.4, 0.9], [0.4, 1.4, 0.3, 0.6], [-0.6, 1.1, -0.5, 0.5]] as const) {
      burst.box([x, y, z], [s, s, s], C.stone, { rot: [0.4, 0.6, 0.2] });
    }
    burst.box([0, 0.2, 0], [2.6, 0.3, 2.6], C.ring, { mat: "glow" });

    if (star >= 2) {
      neck.box([0, 1.0, -0.6], [4.6, 3.0, 1.2], C.furL).pair([2.3, -0.2, 0.6], [0.4, 1.6, 1.4], C.fur);
      body.pair([1.95, 1.1, 1.4], [0.3, 1.0, 1.4], C.stone).box([0, 1.95, -1.6], [1.2, 0.3, 1.2], C.stoneD);
    }
    if (star >= 3) {
      neck.pair([2.32, 1.1, 0.0], [0.1, 0.6, 0.8], C.amber, { mat: "glow" });
      body.pair([2.12, 0.6, -1.2], [0.1, 0.8, 0.9], C.amber, { mat: "glow" });
      head.box([0, 2.0, 0.2], [0.5, 0.6, 1.6], C.amber, { mat: "glow" });
    }
    return { body, neck, head, jaw, lids, earL, earR, legs, tail, rings, burst };
  },

  pose(r, c) {
    const { body, neck, head, jaw, lids, earL, earR, legs, tail, rings, burst } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig), dy = 0, th = 0, roll = 0, dz = 0, ringK = 0, burstK = 0;
    const sw = [0, 0, 0, 0], lf = [0, 0, 0, 0];
    earL.group.rotation.z = bell((T + c.sig * 3) % 3.5, 0, 0.12) * 0.25;
    earR.group.rotation.z = -bell((T + 2.1) % 4.4, 0, 0.12) * 0.25;
    body.group.scale.set(1 + Math.sin(T * 1.9) * 0.012, 1 + Math.sin(T * 1.9) * 0.018, 1);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(W3, T, c.sig, 0x51f7);
          const lock = W3[0]!, bare = W3[1]!, alert = W3[2]!;
          dy = -0.45 - 0.2 * bare;
          th = 0.05 * lock;
          neck.group.rotation.x = 0.15 * lock + 0.1 * bare - 0.12 * alert;
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 6) * 0.3 * alert;
          jaw.group.rotation.x = bare * (0.35 + Math.sin(T * 28) * 0.04);
          earL.group.rotation.x = earR.group.rotation.x = -0.35 * bare + 0.1 * alert;
          lid = Math.max(lid, 0.3 * lock);
          chainWave(tail, T, 0.2, 3.8, 0.15 + 0.2 * alert, 0.06);
        } else {
          // watch (0–.25) → sniff the wind (.25–.5) → soft growl (.5–.7) → howl (.7–1).
          const ph = c.p % 1;
          const watch = 1 - ramp(ph, 0.2, 0.27), sniff = win(ph, 0.25, 0.5, 0.05);
          const growl = win(ph, 0.5, 0.72, 0.05), howl = win(ph, 0.7, 1, 0.07);
          head.group.rotation.y = Math.sin(clamp01(ph / 0.25) * Math.PI * 2) * 0.3 * watch;
          neck.group.rotation.x = -0.25 * sniff - 0.6 * howl + 0.1 * growl;
          head.group.rotation.x = -0.15 * sniff + Math.sin(T * 22) * 0.03 * sniff - 0.4 * howl;
          jaw.group.rotation.x = 0.3 * growl + 0.6 * howl;
          lid = Math.max(lid, 0.5 * howl);
          ringK = 0.6 * howl;
          chainWave(tail, T, 0.14, 2.2, 0.15 + 0.2 * howl, 0.08);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.6 * wk + g);
        for (let i = 0; i < 4; i++) {
          const ph = w + (i === 0 || i === 3 ? 0 : Math.PI);
          sw[i] = Math.sin(ph) * (0.35 * wk + 0.6 * g);
          lf[i] = Math.max(0, Math.cos(ph)) * (0.9 * wk + 1.6 * g);
        }
        dy = Math.abs(Math.sin(w)) * (0.1 * wk + 0.45 * g);
        th = Math.sin(w) * 0.05 * g;
        neck.group.rotation.x = 0.08 * wk + 0.2 * g;
        earL.group.rotation.x = earR.group.rotation.x = -0.45 * g;
        chainWave(tail, T, 0.12 * wk + 0.05 * g, 3 + 5 * g, 0.1 * wk - 0.1 * g, 0.03);
        break;
      }
      case "attack": {
        // crouch (0–.35) → lunge → bite (impact .5) → recover (.65–1).
        const p = c.p;
        const crouch = ramp(p, 0, 0.35) * (1 - ramp(p, 0.38, 0.48));
        const lunge = win(p, 0.38, 0.68, 0.08), recover = ramp(p, 0.65, 1);
        dy = -0.7 * crouch + 0.2 * lunge;
        dz = -0.5 * crouch + 1.5 * lunge * (1 - recover);
        th = -0.06 * crouch + 0.08 * lunge;
        neck.group.rotation.x = 0.2 * crouch - 0.2 * lunge;
        jaw.group.rotation.x = 0.2 * crouch + 0.85 * ramp(p, 0.38, 0.5) * (1 - ramp(p, 0.56, 0.75));
        sw[0] = sw[1] = -0.3 * lunge;
        lf[0] = lf[1] = 0.6 * lunge;
        earL.group.rotation.x = earR.group.rotation.x = -0.5 * (crouch + lunge);
        lid = Math.max(lid, 0.3 * lunge);
        chainWave(tail, T, 0.25, 8, 0.1 + 0.2 * lunge, 0.03);
        break;
      }
      case "skill": {
        // Tiếng Tru Đầu Đàn: howl + sound rings (0–.35) → lock on (.35–.48) → pounce (.48–.7) →
        // finishing strike with stone burst (impact .72, held .7–.76) → recover (.85–1).
        const q = hold(c.p, 0.7, 0.76);
        const howl = win(q, 0, 0.36, 0.06), lock = win(q, 0.34, 0.5, 0.04);
        const x = clamp01((q - 0.48) / 0.24), air = q > 0.48 && q < 0.72 ? 4 * x * (1 - x) : 0;
        const strike = win(q, 0.68, 0.86, 0.04), land = bell(q, 0.76, 1);
        dy = -0.6 * lock + 3.4 * air - 0.7 * strike - 0.3 * land;
        dz = 3 * ramp(q, 0.48, 0.72) * (1 - ramp(q, 0.86, 1)) - 0.4 * lock;
        th = -0.12 * howl + 0.06 * lock - 0.2 * air + 0.18 * strike;
        neck.group.rotation.x = -0.85 * howl + 0.25 * lock - 0.1 * air + 0.2 * strike;
        head.group.rotation.x = -0.35 * howl;
        jaw.group.rotation.x = 0.8 * howl + 0.9 * strike;
        for (let i = 0; i < 4; i++) {
          sw[i] = i < 2 ? -1.0 * air - 0.4 * strike : 0.7 * air;
          lf[i] = (i < 2 ? 2.2 : 1.4) * air + (i < 2 ? 1.2 : 0) * strike;
        }
        earL.group.rotation.x = earR.group.rotation.x = 0.15 * howl - 0.5 * (lock + air);
        ringK = howl * (0.7 + 0.3 * Math.sin(c.t * 18));
        burstK = win(q, 0.7, 0.95, 0.05);
        lid = Math.max(lid, 0.5 * howl + 0.35 * lock);
        chainWave(tail, T, 0.2, 6, 0.3 * howl - 0.3 * air, 0.03);
        break;
      }
      case "hit": {
        const p = c.p;
        const kk = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.9));
        const shake = (1 - ramp(p, 0, 0.25)) * Math.sin(c.t * 70);
        dz = -0.9 * kk; roll = -0.08 * kk; th = -0.06 * kk;
        neck.group.rotation.x = 0.25 * kk;
        head.group.rotation.y = 0.2 * kk + shake * 0.15;
        jaw.group.rotation.x = 0.25 * kk;
        earL.group.rotation.x = earR.group.rotation.x = -0.6 * kk;
        lid = Math.max(lid, 0.7 * kk + (p < 0.08 ? 1 : 0));
        chainWave(tail, T, 0.3 * kk + 0.08, 12, -0.2 * kk, 0.02);
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    body.group.rotation.z = roll;
    for (let i = 0; i < 4; i++) plantLeg(legs[i]!, BODY_Y + dy, th, roll, dz, sw[i], lf[i]);
    vfx(rings, ringK);
    vfx(burst, burstK);
    burst.group.position.z += dz;
    lids.group.scale.y = 0.06 + 0.94 * clamp01(lid);
  },

  death: {
    // knees buckle (0–.3) → lie down on the side (.2–.5) → still (.5–.75) → vanish.
    seconds: 1.3,
    vanishAt: 0.75,
    pose(r: Parts, c: DeathCtx) {
      const { body, neck, head, jaw, lids, legs, tail, rings, burst } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.3), lie = ramp(p, 0.2, 0.5);
      const roll = -0.4 * lie;
      // Belly and flank (half 1.6 × 2.1 incl. stone plates) stay above the tile while rolled.
      const y = (1 - fall) * BODY_Y + fall * (1.65 * Math.cos(roll) + 2.3 * Math.sin(-roll) + 0.4);
      body.group.position.y = y;
      body.group.rotation.z = roll;
      for (const l of legs) plantLeg(l, y, 0, roll, 0, 0, 0, 0.02);
      neck.group.rotation.x = 0.3 * fall;
      head.group.rotation.z = -0.15 * lie;
      jaw.group.rotation.x = 0.2 * lie;
      for (let i = 0; i < tail.length; i++) tail[i]!.group.rotation.y = -0.1 * ramp(p, 0.2 + i * 0.04, 0.5 + i * 0.04);
      vfx(rings, 0);
      vfx(burst, 0);
      lids.group.scale.y = 0.06 + 0.94 * Math.max(ramp(p, 0.3, 0.5), bell(p, 0, 0.1));
    },
  },
});
