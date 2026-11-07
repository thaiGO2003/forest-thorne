// Nhện Linh (catalog id spider_venom, kept for save compatibility) — bespoke rig from the approved
// "Nhện Linh" sheet. Hooded purple spider sorcerer: glowing eyes under a gold-trimmed hood, a robe body,
// four planted spider legs and four arms holding a spell book, a skull lantern, a gold chalice and a
// glass goblet with blue spirit fire.
// Idle: read → look around → hold chalice → hold goblet · Combat idle: read / sip / ready (deterministic
// beats) · Move: scuttle steps blending into a fast scuttle · Attack: chant → raise chalice → goblet
// flash on impact → recover · Skill: open book → call spirits → spirits rise (impact) → spirits strike →
// settle · Hit: struck → brace → recoil → recover · Death: collapses → spirit leaves → vanish.
// 2★ gold crown on the hood; 3★ glowing ghost wisps orbiting.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";

const C = {
  purple: 0x4a2a6a, purpleD: 0x2e1a46, purpleL: 0x6c44a0, gold: 0xe8b23a, goldD: 0xb07c1c,
  eye: 0xb46cff, skin: 0x2a1a36, bone: 0xf0ead8, boneD: 0x9a9080, book: 0x6a3cb0, page: 0xf2e6c8,
  glass: 0xbfe0ff, fire: 0x6cc8ff, ghost: 0xd8d0ff, leg: 0x3a2450,
};

const BODY_Y = 3.6;
/** Spider legs splay outward by LEG_A and reach the ground at length LEG_LEN. */
const LEG_A = 0.55, LEG_LEN = 3.25 / Math.cos(0.55); // 3.6 hip height − corner dip margin

interface Arm { arm: Part; hand: Part }
interface Parts {
  body: Part; robe: Part; head: Part; eyes: Part; arms: Arm[]; legs: Part[];
  book: Part; skull: Part; chalice: Part; goblet: Part; wisps: Part[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
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
/** Splayed legs: shorten along their own axis so the foot stays down when the body sinks `dy`. */
function plantLegs(legs: readonly Part[], dy: number, lift: readonly number[] = [0, 0, 0, 0]) {
  for (let i = 0; i < legs.length; i++) {
    legs[i]!.group.scale.y = Math.max(0.25, Math.min(1, (LEG_LEN + dy / Math.cos(LEG_A) - (lift[i] ?? 0)) / LEG_LEN));
  }
}
function poseArm(a: Arm, raise: number, out: number, bend: number) {
  a.arm.group.rotation.x += raise;
  a.arm.group.rotation.z += out;
  a.hand.group.rotation.x += -bend;
}

export default defineUnit<Parts>({
  id: "spider_venom",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.7, hit: 0.5, move: 0.6 },
  impact: { attack: 0.55, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0.6, -0.6], [3.4, 2.6, 3.6], C.purpleD).spots([0, 0.6, -0.6], [3.4, 2.6, 3.6], C.purpleL, 8, 71, 0.7);
    const robe = k.part("robe", body, [0, 1.6, 0.6]);
    robe.box([0, 0.8, 0], [2.6, 2.8, 2.0], C.purple).box([0, 0.8, 1.02], [0.5, 2.6, 0.06], C.gold)
      .box([0, -0.4, 0], [2.8, 0.4, 2.2], C.goldD);
    const head = k.part("head", robe, [0, 2.6, 0.1]);
    head.box([0, 0.9, 0], [2.8, 2.6, 2.6], C.purple) // hood
      .box([0, 0.7, 1.15], [2.0, 1.8, 0.4], C.skin) // face shadow
      .box([0, 2.1, 0], [2.0, 0.6, 2.0], C.purple).box([0, 0.1, 1.32], [2.6, 0.25, 0.1], C.gold);
    const eyes = k.part("eyes", head, [0, 0.9, 1.4]);
    eyes.pair([0.45, 0, 0], [0.35, 0.3, 0.06], C.eye, { mat: "glow" }).pair([0.3, 0.45, 0], [0.18, 0.18, 0.06], C.eye, { mat: "glow" });

    const arms: Arm[] = [[1, 2.0], [-1, 2.0], [1, 1.0], [-1, 1.0]].map(([side, y], i) => {
      const arm = k.part(`arm${i}`, robe, [side! * 1.4, y!, 0.3]);
      arm.box([side! * 0.5, -0.1, 0.3], [1.2, 0.5, 0.5], C.purple, { rot: [0, 0, side! * -0.4] });
      const hand = k.part(`hand${i}`, arm, [side! * 1.1, -0.4, 0.6]);
      hand.box([0, -0.4, 0], [0.5, 0.9, 0.5], C.leg);
      return { arm, hand };
    });
    const book = k.part("book", arms[0]!.hand, [0, -0.9, 0.6]);
    book.box([0, 0, 0], [1.6, 1.2, 0.3], C.book).box([0, 0, 0.17], [1.4, 1.0, 0.04], C.page).box([0, 0, 0.2], [0.4, 0.4, 0.04], C.eye, { mat: "glow" });
    const skull = k.part("skull", arms[1]!.hand, [0, -1.0, 0.3]);
    skull.box([0, 0, 0], [0.9, 0.9, 0.9], C.bone).pair([0.2, 0.05, 0.46], [0.25, 0.25, 0.04], C.purpleD)
      .box([0, 0.65, 0], [0.4, 0.4, 0.4], C.fire, { mat: "glow" });
    const chalice = k.part("chalice", arms[2]!.hand, [0, -0.9, 0.3]);
    chalice.box([0, 0.2, 0], [0.8, 0.5, 0.8], C.gold).box([0, -0.2, 0], [0.25, 0.5, 0.25], C.gold)
      .box([0, -0.45, 0], [0.6, 0.12, 0.6], C.goldD).box([0, 0.45, 0], [0.6, 0.1, 0.6], C.eye, { mat: "glow" });
    const goblet = k.part("goblet", arms[3]!.hand, [0, -0.9, 0.3]);
    goblet.box([0, 0.2, 0], [0.7, 0.7, 0.7], C.glass, { mat: "glass" }).box([0, 0.15, 0], [0.5, 0.45, 0.5], C.fire, { mat: "glow" })
      .box([0, -0.3, 0], [0.2, 0.4, 0.2], C.glass, { mat: "glass" });

    // Four spider legs, splayed and planted (front pair forward, back pair behind).
    const legs = [[1, 0.6], [-1, 0.6], [1, -1.6], [-1, -1.6]].map(([side, z], i) => {
      const l = k.part(`leg${i}`, body, [side! * 1.3, 0, z!]);
      l.group.rotation.z = side! * LEG_A;
      l.box([0, -LEG_LEN / 2, 0], [0.55, LEG_LEN, 0.55], C.leg).box([0, -LEG_LEN * 0.3, 0], [0.75, 0.6, 0.75], C.purpleL)
        .box([0, -LEG_LEN + 0.15, 0], [0.7, 0.3, 0.7], C.gold);
      return l;
    });

    const wisps: Part[] = [];
    if (star >= 2) head.box([0, 2.55, 0.2], [1.8, 0.35, 1.8], C.gold).box([0, 2.9, 0.8], [0.4, 0.5, 0.2], C.gold);
    if (star >= 3) {
      for (let i = 0; i < 3; i++) {
        const w = k.part(`wisp${i}`, body, [0, 3.5, 0]);
        w.box([0, 0, 0], [0.6, 0.8, 0.6], C.ghost, { mat: "glow" }).box([0, -0.5, 0], [0.3, 0.4, 0.3], C.ghost, { mat: "glow" });
        wisps.push(w);
      }
    }
    return { body, robe, head, eyes, arms, legs, book, skull, chalice, goblet, wisps };
  },

  pose(r, c) {
    const { body, robe, head, eyes, arms, legs, book, chalice, goblet, wisps } = r;
    const T = c.time;
    const [a0, a1, a2, a3] = arms as [Arm, Arm, Arm, Arm];
    let dy = 0;
    const lift = [0, 0, 0, 0];
    robe.group.scale.set(1 + Math.sin(T * 1.8) * 0.015, 1 + Math.sin(T * 1.8) * 0.02, 1);
    eyes.group.scale.setScalar(1 + Math.sin(T * 3) * 0.08);
    wisps.forEach((w, i) => {
      const a = T * (c.state === "skill" ? 4 : 1.2) + i * 2.09;
      w.group.position.set(Math.cos(a) * 3, 3.5 + Math.sin(a * 1.3) * 0.5, Math.sin(a) * 2.5);
    });

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x5a9d);
          const read = W[0]!, sip = W[1]!, ready = W[2]!;
          dy = -0.4 - 0.15 * ready + Math.sin(T * 2.4) * 0.05;
          poseArm(a0, -0.6 - 0.3 * read, 0, 0.5);
          poseArm(a1, -0.3 - 0.6 * ready, 0, 0.3);
          poseArm(a3, -0.3 - 1.1 * sip, -0.3 * sip, 0.4 + 0.6 * sip);
          poseArm(a2, -0.4 - 0.4 * ready, 0, 0.3);
          head.group.rotation.x = 0.25 * read - 0.1 * ready - 0.15 * sip;
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 3) * 0.2 * (1 - read);
          eyes.group.scale.multiplyScalar(1 + 0.3 * ready);
        } else {
          // read (0–.25) → look around (.25–.5) → hold chalice (.5–.75) → hold goblet (.75–1).
          const ph = c.p % 1;
          const look = win(ph, 0.25, 0.5, 0.05), chal = win(ph, 0.5, 0.76, 0.05), gob = win(ph, 0.74, 1, 0.06);
          const read = 1 - Math.max(look, chal, gob);
          poseArm(a0, -0.7 * read - 0.3, 0, 0.6);
          poseArm(a2, -0.3 - 0.9 * chal, 0, 0.3 + 0.5 * chal);
          poseArm(a3, -0.3 - 0.9 * gob, 0, 0.3 + 0.5 * gob);
          poseArm(a1, -0.3, 0, 0.3);
          head.group.rotation.x = 0.25 * read;
          head.group.rotation.y = look * Math.sin((ph - 0.25) / 0.25 * Math.PI * 2) * 0.5 + 0.3 * chal - 0.3 * gob;
          book.group.rotation.y = Math.sin(c.t * 3) * 0.1 * read;
          dy = -0.1 - Math.sin(T * 1.8) * 0.05;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8), wk = 1 - g;
        const w = c.p * Math.PI * 2 * (0.5 * wk + g);
        // Alternating diagonal pairs lift (0 & 3, then 1 & 2), the body bobs low.
        const s = Math.sin(w);
        lift[0] = lift[3] = Math.max(0, s) * (0.6 + 0.4 * g);
        lift[1] = lift[2] = Math.max(0, -s) * (0.6 + 0.4 * g);
        dy = -0.2 - 0.3 * g + Math.abs(s) * 0.1;
        for (let i = 0; i < legs.length; i++) legs[i]!.group.rotation.x += (i % 2 ? -s : s) * (0.25 + 0.15 * g);
        body.group.rotation.x = 0.08 * g;
        poseArm(a0, -0.6, 0, 0.5); poseArm(a1, -0.4, 0, 0.3); poseArm(a2, -0.4, 0, 0.3); poseArm(a3, -0.4, 0, 0.3);
        robe.group.rotation.z = Math.sin(w * 2) * 0.04;
        break;
      }
      case "attack": {
        // chant (0–.3) → raise chalice (.25–.45) → goblet flash at impact .55 → recover.
        const p = c.p;
        const chant = win(p, 0, 0.4, 0.06), raise = win(p, 0.25, 0.7, 0.06), cast = win(p, 0.46, 0.72, 0.04);
        poseArm(a0, -0.8, 0, 0.6);
        poseArm(a2, -0.4 - 1.4 * raise, 0, 0.4);
        poseArm(a3, -0.4 - 1.2 * cast, 0.3 * cast, 0.2);
        goblet.group.scale.setScalar(1 + 0.4 * cast);
        chalice.group.rotation.z = 0.4 * raise;
        head.group.rotation.x = 0.2 * chant - 0.15 * cast;
        eyes.group.scale.multiplyScalar(1 + 0.6 * cast);
        robe.group.rotation.x = -0.08 * cast;
        dy = -0.2 * cast;
        break;
      }
      case "skill": {
        // open book (0–.25) → call spirits (.2–.45) → spirits appear (impact .55) → spirits strike → settle.
        const p = c.p;
        const open = win(p, 0, 0.85, 0.1), call = win(p, 0.2, 0.62, 0.06), strike = win(p, 0.5, 0.8, 0.04);
        poseArm(a0, -1.4 * open, 0, 0.2);
        poseArm(a1, -1.2 * call, 0.5 * call, 0.2);
        poseArm(a2, -1.2 * call, -0.5 * call, 0.2);
        poseArm(a3, -0.6 - 0.8 * strike, 0.4 * strike, 0.3);
        book.group.scale.setScalar(1 + 0.3 * open);
        book.group.rotation.x = -0.4 * open;
        head.group.rotation.x = -0.25 * call + 0.1 * strike;
        eyes.group.scale.multiplyScalar(1 + 0.9 * call);
        robe.group.rotation.x = -0.12 * call + 0.06 * strike;
        dy = -0.3 * open + 0.3 * call;
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        dy = -0.35 * k;
        robe.group.rotation.x = -0.25 * k;
        poseArm(a0, -1.2 * k, 0, 0.8 * k);
        poseArm(a1, -1.2 * k, 0, 0.8 * k);
        head.group.rotation.y = shake * 0.15;
        eyes.group.scale.multiplyScalar(1 - 0.6 * k);
        break;
      }
    }
    body.group.position.y += dy;
    plantLegs(legs, dy, lift);
  },

  death: {
    // Ngã xuống: legs give way (0–.35) → linh hồn rời đi: robe slumps, eyes fade (.3–.65) → tan biến.
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, robe, head, eyes, arms, legs } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.35), slump = ramp(p, 0.3, 0.6);
      const dy = -2.3 * fall;
      body.group.position.y += dy;
      plantLegs(legs, dy);
      robe.group.rotation.x = 0.6 * slump;
      head.group.rotation.x = 0.5 * slump;
      for (const a of arms) poseArm(a, 0.3 * slump, 0, 0.2 * slump);
      eyes.group.scale.setScalar(Math.max(0.05, 1 - ramp(p, 0.35, 0.65)));
    },
  },
});
