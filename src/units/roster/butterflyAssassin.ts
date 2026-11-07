// Bướm Sát Thủ (catalog id mosquito_toxic, kept for save compatibility) — bespoke rig from the "Bướm Sát
// Thủ" sheet. A hovering assassin butterfly: dark violet armored body with gold trim, a gold horned helm
// with a magenta gem, glowing magenta eyes, a long glowing green proboscis used as a lance, four purple
// wings with green eye-spots and gold edges, and spiky dark legs tucked under the body.
// Idle: beat wings → curl proboscis → stalk → faint glow · Combat idle: watch the prey / wait to finish
// / circle at range · Move: glide → speed up → cut the wind · Attack: aim → stab (impact) → drain life ·
// Skill: vanish → dash → pierce → heavy drain (impact) → execute → heal 100% · Hit: struck → stunned →
// rebalance · Death: falls → wings crumble → fades to light. 2★ venom spikes on the wings and helm;
// 3★ glowing green wing veins and gold crown blades.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  body: 0x3a1e52, bodyD: 0x24123a, gold: 0xe8b830, goldD: 0xa87a1a, eye: 0xff3ad0, gem: 0xff5ae0, lance: 0x7aff5a, lanceD: 0x3ac03a,
  wing: 0xa02ad0, wingD: 0x5a1a8a, spot: 0x40e070, spotD: 0x1a6a3a, leg: 0x2a1a30,
};
const FLOAT_Y = 2.7;

interface Wing { part: Part; side: 1 | -1; low: boolean }
interface Parts { body: Part; head: Part; lids: Part; lance: Part; legs: Part[]; wings: Wing[] }

export default defineUnit<Parts>({
  id: "mosquito_toxic",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.7, skill: 2.0, hit: 0.5, move: 0.55 },
  impact: { attack: 0.45, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, FLOAT_Y, 0]);
    body.box([0, 0.5, 0], [1.4, 1.4, 1.6], C.body).box([0, 0.5, 0.82], [0.9, 0.9, 0.08], C.gold).box([0, 0.5, 0.88], [0.4, 0.4, 0.05], C.gem, { mat: "glow" })
      .box([0, 0.1, -1.1], [1.1, 1.0, 1.2], C.bodyD).box([0, -0.1, -1.9], [0.7, 0.7, 0.8], C.body).box([0, -0.2, -2.4], [0.3, 0.3, 0.5], C.gold)
      .box([0, 0.65, -1.1], [1.15, 0.15, 1.0], C.goldD);
    const head = k.part("head", body, [0, 1.0, 0.8]);
    head.box([0, 0.5, 0.4], [1.5, 1.3, 1.3], C.bodyD).box([0, 1.2, 0.3], [1.6, 0.4, 1.4], C.gold).box([0, 1.6, 0.1], [0.5, 0.8, 0.5], C.gold, { rot: [-0.4, 0, 0] })
      .box([0, 1.0, 1.06], [0.35, 0.35, 0.06], C.gem, { mat: "glow" }).pair([0.45, 0.55, 1.06], [0.45, 0.25, 0.05], C.eye, { mat: "glow" })
      .pair([0.75, 1.5, 0.1], [0.2, 0.9, 0.2], C.goldD, { rot: [-0.3, 0, -0.5] });
    if (star >= 2) head.pair([0.6, 1.9, -0.2], [0.15, 0.6, 0.15], C.lance, { mat: "glow", rot: [-0.5, 0, -0.3] });
    if (star >= 3) head.pair([1.0, 1.3, 0.3], [0.7, 0.18, 0.18], C.gold, { mat: "glow", rot: [0, 0, 0.6] });
    const lids = k.part("lids", head, [0, 0.55, 1.1]);
    lids.pair([0.45, 0, 0], [0.5, 0.3, 0.04], C.bodyD);
    const lance = k.part("lance", head, [0, 0.2, 1.1]);
    lance.box([0, 0, 0.3], [0.3, 0.3, 0.6], C.goldD).box([0, 0, 1.5], [0.16, 0.16, 2.0], C.lance, { mat: "glow" }).box([0, 0, 2.8], [0.08, 0.08, 0.7], C.lanceD, { mat: "glow" });
    const legs: Part[] = [];
    for (const z of [0.5, 0, -0.5]) for (const side of [1, -1] as const) {
      const p = k.part(`leg${legs.length}`, body, [side * 0.6, -0.1, z]);
      p.box([side * 0.3, -0.3, 0.1], [0.18, 0.7, 0.18], C.leg, { rot: [0, 0, side * 0.5] }).box([side * 0.5, -0.75, 0.25], [0.15, 0.5, 0.15], C.gold, { rot: [0.4, 0, 0] });
      legs.push(p);
    }
    const wings: Wing[] = [];
    for (const low of [false, true]) for (const side of [1, -1] as const) {
      const part = k.part(`wing${wings.length}`, body, [side * 0.6, low ? 0.3 : 0.9, -0.4]);
      const w = low ? 1.7 : 2.5, h = low ? 1.4 : 2.1, y = low ? -0.5 : 0.7;
      part.box([side * w * 0.5, y, 0], [w, h, 0.12], C.wing).box([side * w * 0.5, y + h * 0.5, 0.01], [w, 0.18, 0.12], C.gold)
        .box([side * w * 0.6, y, 0.05], [0.9, 0.9, 0.06], C.spot, { mat: "glow" }).box([side * w * 0.6, y, 0.08], [0.45, 0.45, 0.05], C.spotD)
        .box([side * (w - 0.2), y - h * 0.4, 0], [0.5, 0.4, 0.1], C.wingD);
      if (star >= 2) part.box([side * (w + 0.15), y + h * 0.4, 0], [0.4, 0.2, 0.1], C.gold, { rot: [0, 0, side * 0.5] });
      if (star >= 3) part.box([side * w * 0.3, y + 0.1, 0.06], [w * 0.5, 0.08, 0.05], C.lance, { mat: "glow", rot: [0, 0, side * 0.3] });
      wings.push({ part, side, low });
    }
    return { body, head, lids, lance, legs, wings };
  },

  pose(r, c) {
    const { body, head, lids, lance, legs, wings } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let flap = 0.3, rate = 7, fold = 0;
    body.group.position.y += Math.sin(T * 2.1 + c.sig * 4) * 0.12;
    legs.forEach((l, i) => { l.group.rotation.x = Math.sin(T * 3 + i) * 0.08; });
    lance.group.rotation.x = 0.25;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, wait, circle] = beats(T, c.sig, 0xb077);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * watch;
          lance.group.rotation.x = 0.25 - 0.25 * wait;
          body.group.rotation.x = 0.15 * wait;
          body.group.position.x += Math.sin(T * 1.4) * 0.4 * circle;
          body.group.rotation.z = Math.sin(T * 1.4) * 0.15 * circle;
        } else {
          // beat wings (0–.25) → curl proboscis (.25–.5) → stalk (.5–.75) → glow (.75–1).
          const ph = c.p % 1;
          const curl = win(ph, 0.25, 0.5, 0.05), stalk = win(ph, 0.5, 0.75, 0.05);
          lance.group.rotation.x = 0.25 + 0.6 * curl;
          body.group.rotation.x = 0.12 * stalk;
          head.group.rotation.y = Math.sin(c.t * 3) * 0.25 * stalk;
          fold = 0.4 * stalk;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        body.group.rotation.x = 0.2 + 0.25 * g;
        rate = 11 + 5 * g;
        fold = 0.3 * g;
        break;
      }
      case "attack": {
        // aim (0–.3) → stab (impact .45) → drain (.45–.8) → recover.
        const p = c.p;
        const aim = ramp(p, 0, 0.3) * (1 - ramp(p, 0.35, 0.45));
        const stab = ramp(p, 0.35, 0.45) * (1 - ramp(p, 0.8, 1));
        body.group.position.z += -0.4 * aim + 1.0 * stab;
        lance.group.rotation.x = 0.25 - 0.25 * (aim + stab);
        body.group.rotation.x = 0.1 * stab;
        body.group.scale.setScalar(1 + 0.05 * Math.sin(c.t * 30) * stab);
        fold = 0.5 * stab;
        break;
      }
      case "skill": {
        // vanish (0–.15) → dash (.15–.35) → pierce (.35–.5) → drain (impact .6) → execute (.65–.8) → heal 100% (.8–1).
        const p = c.p;
        const hide = win(p, 0, 0.32, 0.06), dash = win(p, 0.15, 0.55, 0.05), drain = win(p, 0.5, 0.8, 0.04), heal = win(p, 0.8, 1, 0.04);
        body.group.scale.setScalar(1 - 0.35 * hide + 0.12 * heal);
        body.group.position.z += 1.6 * dash;
        lance.group.rotation.x = 0.25 - 0.25 * Math.max(dash, drain);
        fold = 0.8 * dash;
        body.group.rotation.x = 0.25 * dash;
        rate = 7 + 8 * drain;
        flap = 0.3 + 0.2 * heal;
        body.group.position.y += 0.5 * heal;
        lid = Math.max(lid, 0.4 * drain);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.6 * k;
        body.group.rotation.z = shake * 0.1;
        head.group.rotation.z = Math.sin(c.t * 14) * 0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    const beat = Math.sin(T * rate);
    for (const w of wings) w.part.group.rotation.y = w.side * (-0.3 - 0.6 * fold + beat * flap * (w.low ? 0.7 : 1));
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Rơi xuống (0–.4) → tàn cánh: wings droop (.3–.6) → tan sáng (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, lance, legs, wings } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.4), droop = ramp(p, 0.3, 0.6);
      body.group.position.y += -1.0 * fall + bell(p, 0.4, 0.5) * 0.12;
      body.group.rotation.z = -0.1 * fall;
      head.group.rotation.x = 0.2 * droop;
      lance.group.rotation.x = 0.25 - 0.35 * droop;
      for (const l of legs) l.group.rotation.z = 0.5 * droop * Math.sign(l.group.position.x);
      for (const w of wings) { w.part.group.rotation.y = w.side * -0.3 * (1 - droop); w.part.group.rotation.x = -0.9 * droop; }
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
