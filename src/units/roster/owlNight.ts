// Cú Đêm (owl_nightshot) — bespoke rig from the "Cú Đêm" concept sheet (Xạ thủ · Chim · Đêm).
// Round night owl: deep purple plumage, cream face disc and chevron belly, huge amber eyes, lavender
// ear tufts and wing feathers, short feathered legs with brown talons. Idle: watch → head tilt →
// blink → feather ruffle · Combat idle: watch / tilt / half-open wings · Move: hop-step → glide ·
// Attack: aim → shoot a glowing feather (impact) → fold wing · Skill (Mũi Tên Ngủ): lock on with
// glowing eyes → gather dream light → fire the sleep arrow (impact) → moon + Z marks → settle ·
// Hit: struck → dazed → recover · Death: wings go limp → lie down → vanish.
// 2★ larger tufts and lavender wing trim; 3★ crescent-moon crown and glowing feather tips.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, plantLeg, vfx, win, type Leg } from "./stance";

const C = {
  purple: 0x4e3768, purpleD: 0x34244a, purpleL: 0x6a4f8c, lav: 0xa894f0, lavL: 0xc8bcff,
  cream: 0xf0e2c0, creamD: 0xd8c49c, chevron: 0x7a5a3a, eye: 0xffa21a, eyeL: 0xffd060,
  pupil: 0x150c1a, beak: 0x6a5a7a, talon: 0x7a5236, claw: 0x2a1e18,
  arrow: 0x9ab0ff, arrowL: 0xe0e8ff, glare: 0x4aa8ff, moon: 0xfff2b0,
};

const BODY_Y = 3.0;
const W3 = [0, 0, 0];

interface Parts {
  body: Part; head: Part; lids: Part; tuftL: Part; tuftR: Part;
  wingL: Part; wingR: Part; tipL: Part; tipR: Part; tail: Part; legs: Leg[];
  arrow: Part; glare: Part; dream: Part;
}

export default defineUnit<Parts>({
  id: "owl_nightshot",
  motion: "ground",
  height: 11,
  durations: { idle: 5, attack: 0.85, skill: 1.9, hit: 0.5, move: 0.65 },
  impact: { attack: 0.55, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 1.9, 0], [4.2, 3.8, 3.6], C.purple)
      .box([0, 1.6, 1.82], [3.0, 3.0, 0.12], C.cream)
      .box([0, 0.2, 1.2], [3.4, 0.6, 1.4], C.creamD);
    for (const [y, w] of [[2.6, 1.6], [1.9, 2.2], [1.2, 2.0], [0.6, 1.4]] as const) {
      body.pair([w / 4, y, 1.9], [w / 2, 0.18, 0.06], C.chevron, { rot: [0, 0, 0.35] });
    }

    const head = k.part("head", body, [0, 3.8, 0.1]);
    head.box([0, 1.4, 0], [4.4, 3.0, 3.6], C.purple)
      .box([0, 2.85, -0.2], [3.6, 0.3, 3.0], C.purpleD)
      .box([0, 1.25, 1.82], [3.8, 2.6, 0.08], C.purpleD) // dark disc rim
      .box([0, 1.25, 1.86], [3.4, 2.3, 0.08], C.cream) // face disc
      .pair([0.9, 1.5, 1.94], [1.2, 1.2, 0.08], C.eye)
      .pair([0.9, 1.5, 1.99], [0.7, 0.8, 0.04], C.eyeL)
      .pair([0.9, 1.45, 2.02], [0.45, 0.6, 0.04], C.pupil)
      .pair([1.05, 1.75, 2.05], [0.18, 0.18, 0.03], C.cream)
      .box([0, 0.75, 2.1], [0.5, 0.75, 0.5], C.beak)
      .box([0, 0.35, 2.15], [0.3, 0.3, 0.3], C.purpleD);
    const lids = k.part("lids", head, [0, 2.15, 1.98]);
    lids.pair([0.9, -0.6, 0], [1.25, 1.25, 0.06], C.purpleL);
    const tuftH = star >= 2 ? 1.8 : 1.3;
    const tuft = (side: 1 | -1) => {
      const t = k.part(side > 0 ? "tuftR" : "tuftL", head, [side * 1.6, 2.8, 0]);
      t.box([0, tuftH / 2, 0], [0.8, tuftH, 0.7], C.purpleL, { rot: [0, 0, -side * 0.3] })
        .box([side * 0.35, tuftH * 0.85, 0], [0.4, tuftH * 0.6, 0.5], C.lav, { rot: [0, 0, -side * 0.45] });
      return t;
    };
    const tuftR = tuft(1), tuftL = tuft(-1);

    const wing = (side: 1 | -1) => {
      const w = k.part(side > 0 ? "wingR" : "wingL", body, [side * 2.1, 3.3, -0.2]);
      w.box([side * 0.3, -1.3, -0.2], [0.6, 2.8, 2.8], C.purple)
        .box([side * 0.36, -0.6, 0.6], [0.5, 1.2, 1.2], C.purpleL);
      if (star >= 2) w.box([side * 0.62, -2.0, -0.2], [0.1, 0.6, 2.6], C.lav);
      const tip = k.part(side > 0 ? "tipR" : "tipL", w, [side * 0.3, -2.6, -0.3]);
      tip.box([0, -0.5, -0.2], [0.5, 1.2, 2.6], C.lav).box([0, -1.2, -0.5], [0.4, 0.6, 1.8], C.lavL);
      if (star >= 3) tip.box([0, -1.55, -0.5], [0.42, 0.2, 1.6], C.arrowL, { mat: "glow" });
      return { w, tip };
    };
    const wr = wing(1), wl = wing(-1);
    const tail = k.part("tail", body, [0, 0.8, -1.8]);
    tail.box([0, -0.2, -0.6], [2.2, 0.4, 1.4], C.lav, { rot: [0.5, 0, 0] });

    const legs: Leg[] = ([1, -1] as const).map((side) => {
      const at = [side * 0.9, 0.2, 0.3] as const, len = BODY_Y + 0.2;
      const part = k.part(side > 0 ? "legR" : "legL", body, at);
      part.box([0, -0.8, 0], [1.0, 1.6, 1.0], C.cream)
        .box([0, -2.2, 0], [0.45, 1.2, 0.45], C.talon)
        .box([0, -len + 0.15, 0.4], [1.2, 0.3, 1.4], C.talon);
      for (const dx of [-0.4, 0, 0.4]) part.box([dx, -len + 0.12, 1.15], [0.2, 0.24, 0.24], C.claw);
      return { part, at, len, toe: 1.25, heel: 0.4 };
    });

    // Feather arrow (attack / sleep arrow) flies out from the chest; dream light gathers on the head.
    const arrow = k.part("arrow", null, [0, BODY_Y + 2.6, 2.4]);
    arrow.box([0, 0, 0.8], [0.25, 0.25, 2.6], C.arrow, { mat: "glow" })
      .box([0, 0, 2.2], [0.5, 0.5, 0.6], C.arrowL, { mat: "glow" })
      .pair([0.3, 0, -0.3], [0.3, 0.12, 0.9], C.lav, { mat: "glow" });
    const glare = k.part("glare", head, [0, 1.5, 2.06]);
    glare.pair([0.9, 0, 0], [1.0, 1.0, 0.04], C.glare, { mat: "glow" });
    const dream = k.part("dream", head, [0, 4.4, 0]);
    dream.box([-0.6, 0.6, 0], [0.4, 1.6, 0.3], C.moon, { mat: "glow" }).box([-0.2, 1.3, 0], [0.6, 0.4, 0.3], C.moon, { mat: "glow" })
      .box([-0.2, -0.1, 0], [0.6, 0.4, 0.3], C.moon, { mat: "glow" })
      .box([1.2, 0.6, 0], [0.9, 0.2, 0.2], C.lavL, { mat: "glow" }).box([1.2, 0.6, 0], [0.2, 0.9, 0.2], C.lavL, { mat: "glow", rot: [0, 0, 0.8] })
      .box([1.2, 1.1, 0], [0.9, 0.2, 0.2], C.lavL, { mat: "glow" });

    if (star >= 3) {
      head.box([0, 3.05, 0.6], [0.5, 0.7, 0.3], C.moon, { mat: "glow" }).pair([0.45, 3.4, 0.6], [0.4, 0.3, 0.3], C.moon, { mat: "glow" });
    }
    return { body, head, lids, tuftL, tuftR, wingL: wl.w, wingR: wr.w, tipL: wl.tip, tipR: wr.tip, tail, legs, arrow, glare, dream };
  },

  pose(r, c) {
    const { body, head, lids, tuftL, tuftR, tail, legs, arrow, glare, dream } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig), dy = 0, th = 0, roll = 0, dz = 0, arrowK = 0, glareK = 0, dreamK = 0;
    const sw = [0, 0], lf = [0, 0];
    body.group.scale.set(1 + Math.sin(T * 1.7) * 0.015, 1 + Math.sin(T * 1.7) * 0.02, 1);
    tail.group.rotation.x = Math.sin(T * 1.5) * 0.05;
    tuftL.group.rotation.z = Math.sin(T * 2.3 + 1) * 0.06;
    tuftR.group.rotation.z = -Math.sin(T * 2.7) * 0.06;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(W3, T, c.sig, 0x6d21);
          const watch = W3[0]!, tilt = W3[1]!, open = W3[2]!;
          dy = -0.2;
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 4) * 0.45 * watch;
          head.group.rotation.z = 0.3 * tilt * Math.sin(T * 0.6 + 1);
          wings(r, T, 0.45 * open, 5, 0.1 * open);
          lid = Math.max(lid, 0.25 * watch);
        } else {
          // watch (0–.3) → head tilt (.3–.55) → slow blink (.55–.7) → feather ruffle (.7–1).
          const ph = c.p % 1;
          const watch = 1 - ramp(ph, 0.25, 0.32), tilt = win(ph, 0.3, 0.56, 0.06);
          const ruffle = win(ph, 0.7, 1, 0.06);
          head.group.rotation.y = Math.sin(clamp01(ph / 0.3) * Math.PI * 2) * 0.6 * watch;
          head.group.rotation.z = 0.35 * tilt;
          lid = Math.max(lid, bell(ph, 0.55, 0.7) * 0.9);
          wings(r, T, 0.6 * ruffle, 14, 0.15 * ruffle);
          body.group.scale.x += 0.05 * ruffle * Math.abs(Math.sin(c.t * 20));
          dy = 0.1 * ruffle;
        }
        break;
      }
      case "move": {
        // Hop-steps out of combat; in combat it glides low with spread wings.
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2;
        sw[0] = Math.sin(w) * 0.35 * wk; sw[1] = -sw[0];
        lf[0] = Math.max(0, Math.cos(w)) * 0.6 * wk;
        lf[1] = Math.max(0, -Math.cos(w)) * 0.6 * wk;
        dy = Math.abs(Math.sin(w)) * 0.3 * wk + (1.6 + Math.sin(T * 10) * 0.2) * g;
        th = 0.08 * wk + 0.35 * g;
        lf[0] += 0.8 * g; lf[1] += 0.8 * g;
        wings(r, T, 0.2 * wk + g, 11, 0.4 * g);
        head.group.rotation.x = -0.3 * g;
        break;
      }
      case "attack": {
        // aim (0–.4) → shoot feather (impact .55) → fold wing (.7–1).
        const p = c.p;
        const aim = win(p, 0, 0.58, 0.15), rel = ramp(p, 0.45, 0.58), fold = ramp(p, 0.7, 1);
        head.group.rotation.x = 0.08 * aim;
        body.group.rotation.y = -0.2 * aim * (1 - rel);
        r.wingR.group.rotation.x = -1.2 * aim + 0.6 * rel * (1 - fold);
        r.wingR.group.rotation.z = 0.6 * aim * (1 - fold);
        dz = -0.3 * bell(p, 0.5, 0.8);
        lid = Math.max(lid, 0.3 * aim);
        arrowK = win(p, 0.4, 0.75, 0.03);
        arrow.group.position.z += 7 * ramp(p, 0.5, 0.75);
        break;
      }
      case "skill": {
        // Mũi Tên Ngủ: lock on (0–.22, eyes glow) → gather dream light (.2–.5) → fire (impact .62)
        // → moon + Z marks (.62–.85) → settle.
        const p = c.p;
        const lock = win(p, 0, 0.6, 0.06), gather = win(p, 0.2, 0.6, 0.06);
        const fire = ramp(p, 0.55, 0.62), mark = win(p, 0.6, 0.92, 0.05);
        dy = 0.5 * gather - 0.2 * bell(p, 0.6, 0.8);
        th = -0.1 * gather + 0.12 * bell(p, 0.56, 0.75);
        head.group.rotation.x = 0.1 * lock;
        wings(r, T, 0.9 * gather * (1 - fire) + 0.3 * mark, 8, 0.12 * gather);
        glareK = lock;
        dreamK = mark * (0.85 + 0.15 * Math.sin(c.t * 8));
        dream.group.position.y += 0.6 * mark;
        arrowK = win(p, 0.48, 0.8, 0.03) * 1.3;
        arrow.group.position.z += 8 * ramp(p, 0.56, 0.8);
        break;
      }
      case "hit": {
        const p = c.p;
        const kk = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.9));
        const shake = (1 - ramp(p, 0, 0.25)) * Math.sin(c.t * 70);
        dz = -0.6 * kk; th = -0.12 * kk;
        head.group.rotation.y = shake * 0.2;
        head.group.rotation.z = 0.2 * kk;
        wings(r, T, 0.5 * kk, 16, 0.15 * kk);
        lid = Math.max(lid, 0.8 * kk + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    body.group.position.y += dy;
    body.group.position.z += dz;
    body.group.rotation.x = th;
    body.group.rotation.z = roll;
    for (let i = 0; i < 2; i++) plantLeg(legs[i]!, BODY_Y + dy, th, roll, dz, sw[i], lf[i], 0.2);
    vfx(arrow, arrowK);
    vfx(glare, glareK);
    vfx(dream, dreamK);
    lids.group.scale.y = 0.04 + 0.96 * clamp01(lid);
  },

  death: {
    // wings go limp (0–.3) → slump forward and lie down (.2–.55) → still → vanish.
    seconds: 1.2,
    vanishAt: 0.72,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, legs, arrow, glare, dream } = r;
      const p = c.p;
      const sag = ramp(p, 0, 0.3), lie = ramp(p, 0.2, 0.55);
      const th = 0.5 * lie;
      // Body box front-bottom corner (z 1.8, y 0) stays above the tile as it tips forward.
      const y = BODY_Y - sag * BODY_Y + lie * (1.8 * Math.sin(th) + 0.3) + 0.25 * sag;
      body.group.position.y = y;
      body.group.rotation.x = th;
      for (const l of legs) plantLeg(l, y, th, 0, 0, 0, 0, 0.02);
      wings(r, c.time, 0.7 * sag, 0, 0);
      head.group.rotation.x = 0.2 * lie;
      vfx(arrow, 0); vfx(glare, 0); vfx(dream, 0);
      lids.group.scale.y = 0.04 + 0.96 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.1));
    },
  },
});

/** Wings: `spread` opens them, `amp` flaps at `rate`, tips trail by 0.07 s. */
function wings(r: Parts, time: number, spread: number, rate: number, amp: number) {
  const a = Math.sin(time * rate), b = Math.sin((time - 0.07) * rate);
  for (const [w, tip, s] of [[r.wingR, r.tipR, 1], [r.wingL, r.tipL, -1]] as const) {
    w.group.rotation.z += s * (1.2 * spread + a * amp);
    w.group.rotation.y += -s * 0.25 * spread;
    tip.group.rotation.z += s * (b * amp * 0.8 - 0.3 * (1 - spread));
  }
}
