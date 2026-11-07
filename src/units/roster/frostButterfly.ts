// Sương Điệp (catalog id moth_dust, kept for save compatibility) — bespoke rig from the "Sương Điệp"
// sheet. A floating frost butterfly mage: white-and-lilac voxel body, round head with big cyan eyes and
// curled antennae, a glowing ice crystal on the chest, four lilac-to-blue wings with snowflake marks and
// small purple ice shards hanging under the abdomen.
// Idle: breathe → flutter → tilt head → release frost · Combat idle: watch / glide / gather cold ·
// Move: glide → glide → dash · Attack: gather cold → fire ice shard (impact) → follow-through ·
// Skill: gather mana → spread ice wings → sweep the frost band → blizzard burst (impact) → settle ·
// Hit: struck → wobble → recover · Death: falls → lies still → shatters into ice. 2★ wing edge crystals
// and extra shards; 3★ glowing snowflake crown and outer wing tips.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  body: 0xf2f0ff, bodyD: 0xc8c0ec, lilac: 0xb49af0, wing: 0x8ab4ff, wingD: 0x5a6ae0, edge: 0xe8f4ff, eye: 0x40e0ff,
  pupil: 0x10184a, ice: 0x9ae8ff, shard: 0xb070f0, crest: 0xffffff,
};
const FLOAT_Y = 2.6;

interface Wing { part: Part; side: 1 | -1; low: boolean }
interface Parts { body: Part; head: Part; lids: Part; antR: Part; antL: Part; tail: Part; wings: Wing[] }

export default defineUnit<Parts>({
  id: "moth_dust",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 1.9, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.65 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, FLOAT_Y, 0]);
    body.box([0, 0.6, 0], [1.4, 1.6, 1.2], C.body).box([0, 0.6, 0.62], [0.6, 0.7, 0.1], C.ice, { mat: "glow" })
      .box([0, 1.4, 0], [1.6, 0.4, 1.3], C.edge).pair([0.55, -0.1, 0.3], [0.2, 0.7, 0.2], C.bodyD);
    const tail = k.part("tail", body, [0, -0.1, -0.2]);
    tail.box([0, -0.5, -0.3], [1.0, 1.0, 1.0], C.lilac).box([0, -1.2, -0.6], [0.7, 0.8, 0.7], C.bodyD).box([0, -1.7, -0.8], [0.35, 0.5, 0.35], C.shard, { mat: "glow" });
    if (star >= 2) tail.pair([0.4, -1.3, -0.3], [0.2, 0.5, 0.2], C.shard, { mat: "glow" });
    const head = k.part("head", body, [0, 1.6, 0.2]);
    head.box([0, 0.8, 0], [2.0, 1.7, 1.7], C.body).box([0, 1.6, -0.1], [1.8, 0.4, 1.5], C.edge).box([0, 0.3, 0.86], [0.5, 0.2, 0.05], C.bodyD)
      .pair([0.48, 0.85, 0.86], [0.5, 0.55, 0.06], C.eye, { mat: "glow" }).pair([0.48, 0.8, 0.9], [0.2, 0.25, 0.04], C.pupil);
    if (star >= 3) for (let i = -2; i <= 2; i++) head.box([i * 0.35, 2.0 + (2 - Math.abs(i)) * 0.12, -0.1], [0.18, 0.5, 0.18], C.crest, { mat: "glow" });
    const lids = k.part("lids", head, [0, 0.85, 0.92]);
    lids.pair([0.48, 0, 0], [0.52, 0.58, 0.05], C.body);
    const ant = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "antR" : "antL", head, [side * 0.45, 1.7, 0.2]);
      p.box([side * 0.15, 0.6, 0.1], [0.12, 1.2, 0.12], C.lilac, { rot: [0.2, 0, -side * 0.3] }).box([side * 0.5, 1.25, 0.25], [0.35, 0.35, 0.35], C.ice, { mat: "glow" });
      return p;
    };
    const antR = ant(1), antL = ant(-1);
    const wings: Wing[] = [];
    for (const low of [false, true]) for (const side of [1, -1] as const) {
      const part = k.part(`wing${wings.length}`, body, [side * 0.6, low ? 0.4 : 1.1, -0.3]);
      const w = low ? 1.6 : 2.4, h = low ? 1.4 : 2.0, y = low ? -0.6 : 0.6;
      part.box([side * w * 0.5, y, 0], [w, h, 0.12], C.wing).box([side * w * 0.55, y + (low ? -0.1 : 0.2), 0.02], [w * 0.55, h * 0.5, 0.1], C.lilac)
        .box([side * w * 0.5, y, 0.05], [0.5, 0.12, 0.06], C.edge, { mat: "glow" }).box([side * w * 0.5, y, 0.05], [0.12, 0.5, 0.06], C.edge, { mat: "glow" })
        .box([side * (w - 0.1), y + (low ? -0.5 : 0.8), 0], [0.4, 0.4, 0.1], C.wingD);
      if (star >= 2) part.box([side * (w + 0.1), y, 0], [0.25, 0.6, 0.1], C.ice, { mat: "glow" });
      if (star >= 3 && !low) part.box([side * (w + 0.2), y + 1.1, 0], [0.3, 0.7, 0.1], C.edge, { mat: "glow", rot: [0, 0, -side * 0.4] });
      wings.push({ part, side, low });
    }
    return { body, head, lids, antR, antL, tail, wings };
  },

  pose(r, c) {
    const { body, head, lids, antR, antL, tail, wings } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let flap = 0.25, rate = 5, spread = 0;
    body.group.position.y += Math.sin(T * 1.8 + c.sig * 4) * 0.15;
    antR.group.rotation.z = Math.sin(T * 2.3) * 0.1;
    antL.group.rotation.z = -Math.sin(T * 2.3 + 0.6) * 0.1;
    tail.group.rotation.x = Math.sin(T * 1.6) * 0.1;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, glide, gather] = beats(T, c.sig, 0x5e7d);
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 3) * 0.3 * watch;
          body.group.position.x += Math.sin(T * 1.2) * 0.3 * glide;
          flap += 0.15 * gather;
          spread = 0.3 * gather;
          lid = Math.max(lid, 0.3 * gather);
        } else {
          // breathe (0–.25) → flutter (.25–.5) → tilt head (.5–.75) → release frost (.75–1).
          const ph = c.p % 1;
          const flutter = win(ph, 0.25, 0.5, 0.05), tilt = win(ph, 0.5, 0.75, 0.05), frost = win(ph, 0.75, 1, 0.05);
          body.group.scale.y = 1 + Math.sin(T * 1.5) * 0.03;
          rate += 6 * flutter;
          head.group.rotation.z = 0.25 * tilt;
          spread = 0.4 * frost;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        body.group.rotation.x = 0.2 + 0.25 * g;
        rate = 9 + 5 * g;
        flap = 0.35;
        break;
      }
      case "attack": {
        // gather cold (0–.4) → fire ice shard (impact .5) → recover.
        const p = c.p;
        const gather = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const fire = ramp(p, 0.42, 0.52) * (1 - ramp(p, 0.7, 1));
        body.group.position.z += -0.3 * gather + 0.5 * fire;
        body.group.rotation.x = -0.15 * gather + 0.25 * fire;
        spread = 0.5 * gather - 0.3 * fire;
        rate = 6 + 8 * fire;
        break;
      }
      case "skill": {
        // gather (0–.2) → spread ice wings (.15–.45) → sweep (.4–.6) → blizzard burst (impact .65) → settle.
        const p = c.p;
        const lift = win(p, 0, 0.92, 0.1), wide = win(p, 0.15, 0.75, 0.05), sweep = win(p, 0.4, 0.62, 0.04), burst = win(p, 0.6, 0.75, 0.03);
        body.group.position.y += 0.6 * lift;
        spread = 0.7 * wide + 0.3 * burst;
        body.group.rotation.y = Math.sin((p - 0.4) * Math.PI * 4) * 0.5 * sweep;
        rate = 4 + 10 * burst;
        head.group.rotation.x = -0.25 * burst;
        lid = Math.max(lid, 0.4 * burst);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.6 * k;
        body.group.rotation.z = shake * 0.1 + 0.25 * k * Math.sin(c.t * 12);
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    const beat = Math.sin((c.state === "idle" && !c.combat ? c.t : T) * rate);
    for (const w of wings) {
      w.part.group.rotation.y = w.side * (-0.35 + 0.15 * spread + beat * flap * (w.low ? 0.7 : 1));
      w.part.group.rotation.z = w.side * spread * (w.low ? -0.15 : 0.25);
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Rơi xuống (0–.4) → nằm yên with wings flat (.3–.6) → tan thành hạt băng (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, wings } = r;
      const p = c.p;
      const fall = ramp(p, 0, 0.4), flat = ramp(p, 0.3, 0.6);
      body.group.position.y += -0.55 * fall + bell(p, 0.4, 0.5) * 0.12;
      body.group.rotation.z = 0.1 * fall;
      head.group.rotation.x = 0.35 * flat;
      for (const w of wings) { w.part.group.rotation.y = w.side * -0.3 * (1 - flat); w.part.group.rotation.x = -0.9 * flat; }
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
