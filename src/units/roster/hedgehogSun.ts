// Nhím Mặt Trời (catalog id cat_goldbow, kept for save compatibility) — bespoke rig from the "Nhím Mặt
// Trời" sheet. Round hedgehog with a cream face, big brown eyes, pink cheeks, a gold sun crown with an
// orange gem and a back of long yellow, white and brown quills that store sunlight.
// Idle: stand firm → breathe → glow · Combat idle: alert / lock on / ready to shoot · Move: step → run →
// dash · Attack: ready → fire a quill (impact) → quills glow · Skill: charge → flare → quill rain
// (impact) → pierce → light burst · Hit: struck → slide back → steady · Death: falls → fades out →
// melts into light. 2★ extra quill row and crown rays; 3★ glowing quill tips and a sun halo.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  face: 0xfaf0dc, faceD: 0xe8d4b0, eye: 0x5a3010, pupil: 0x1a0c04, blush: 0xff9aa0, nose: 0x3a2010, leg: 0x8a5a30,
  quillY: 0xf8c820, quillW: 0xfaf4e0, quillB: 0xb07a3a, gold: 0xf0b030, gem: 0xff8a20, glow: 0xffe060,
};
const BODY_Y = 1.7;

interface Leg { part: Part; side: 1 | -1; front: boolean }
interface Parts { body: Part; head: Part; lids: Part; quills: Part; halo: Part | null; legs: Leg[] }

export default defineUnit<Parts>({
  id: "cat_goldbow",
  motion: "ground",
  height: 7,
  durations: { idle: 4.5, attack: 0.75, skill: 1.7, hit: 0.5, move: 0.5 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [2.6, 2.0, 3.0], C.faceD).box([0, -0.5, 0.3], [2.2, 1.0, 2.4], C.face);
    const legs: Leg[] = [];
    for (const front of [true, false]) for (const side of [1, -1] as const) {
      const part = k.part(`leg${side > 0 ? "R" : "L"}${front ? "F" : "B"}`, body, [side * 0.85, -0.8, front ? 0.9 : -0.9]);
      part.box([0, -0.38, 0.05], [0.6, 0.76, 0.7], C.leg);
      legs.push({ part, side, front });
    }
    const quills = k.part("quills", body, [0, 0.2, -0.2]);
    const rows = star >= 2 ? 5 : 4;
    const colors = [C.quillY, C.quillW, C.quillB, C.quillY];
    for (let i = 0; i < rows; i++) for (let j = 0; j < 7; j++) {
      const el = 0.15 + (i / (rows - 1)) * 1.15; // elevation above the horizon
      const az = -1.25 + (j / 6) * 2.5; // spread around the back
      const nx = Math.sin(az) * Math.cos(el), ny = Math.sin(el), nz = -Math.cos(az) * Math.cos(el) * 0.9 - 0.1;
      const len = 1.5 + ((i + j) % 3) * 0.3;
      quills.box([nx * (1.3 + len * 0.5), ny * (1.0 + len * 0.5), nz * (1.4 + len * 0.5)], [0.4, len, 0.4], colors[(i + j) % 4], { rot: [Math.atan2(nz, ny), 0, -Math.asin(Math.max(-1, Math.min(1, nx)))] });
      if (star >= 3 && (i + j) % 2 === 0) quills.box([nx * (1.3 + len), ny * (1.0 + len), nz * (1.4 + len)], [0.3, 0.3, 0.3], C.glow, { mat: "glow" });
    }
    const head = k.part("head", body, [0, 0.2, 1.4]);
    head.box([0, 0.2, 0.6], [2.4, 2.0, 1.4], C.face).box([0, -0.1, 1.45], [0.9, 0.7, 0.5], C.face).box([0, 0.1, 1.72], [0.35, 0.25, 0.06], C.nose)
      .pair([0.55, 0.45, 1.32], [0.5, 0.6, 0.06], C.eye).pair([0.55, 0.42, 1.36], [0.25, 0.35, 0.04], C.pupil).pair([0.95, -0.1, 1.32], [0.45, 0.25, 0.06], C.blush)
      .pair([0.95, 1.2, 0.3], [0.45, 0.45, 0.3], C.faceD)
      .box([0, 1.35, 0.6], [1.8, 0.45, 0.5], C.gold).box([0, 1.4, 0.88], [0.45, 0.45, 0.12], C.gem, { mat: "glow" })
      .box([0, 1.9, 0.6], [0.3, 0.7, 0.2], C.gold).pair([0.6, 1.75, 0.6], [0.25, 0.55, 0.2], C.gold, { rot: [0, 0, -0.5] });
    if (star >= 2) head.pair([1.0, 1.5, 0.6], [0.2, 0.45, 0.2], C.gold, { rot: [0, 0, -1.0] }).box([0, 1.35, 0.88], [1.9, 0.12, 0.06], C.gem);
    const lids = k.part("lids", head, [0, 0.75, 1.36]);
    lids.pair([0.55, -0.3, 0], [0.55, 0.65, 0.06], C.face);
    let halo: Part | null = null;
    if (star >= 3) {
      halo = k.part("halo", body, [0, 2.4, -1.0]);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        halo.box([Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0], [0.6, 0.18, 0.12], C.glow, { mat: "glow", rot: [0, 0, a + Math.PI / 2] });
      }
    }
    return { body, head, lids, quills, halo, legs };
  },

  pose(r, c) {
    const { body, head, lids, quills, halo, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let puff = 0;
    const gait = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + ((l.side > 0) === l.front ? 0 : Math.PI)) * amp; };
    if (halo) halo.group.rotation.z = T * 0.6;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, lock, ready] = beats(T, c.sig, 0x5a11);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * alert;
          head.group.rotation.x = -0.1 * lock;
          lid = Math.max(lid, 0.4 * lock);
          puff = 0.15 * ready;
          body.group.position.y += Math.abs(Math.sin(T * 4)) * 0.08 * ready;
        } else {
          // stand firm (0–.35) → breathe (.35–.65) → glow, quills fan out (.65–1).
          const ph = c.p % 1;
          const breathe = win(ph, 0.35, 0.65, 0.05), glow = win(ph, 0.65, 1, 0.05);
          body.group.scale.set(1 + 0.04 * breathe * Math.sin(c.t * 4), 1 + 0.04 * breathe * Math.sin(c.t * 4), 1);
          puff = 0.12 * glow;
          head.group.rotation.x = -0.12 * glow;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (12 + 6 * g);
        gait(w, 0.5 + 0.1 * g);
        body.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        quills.group.rotation.x = -0.1 * g;
        break;
      }
      case "attack": {
        // ready (0–.4) → fire quill (impact .55) → quills glow.
        const p = c.p;
        const ready = ramp(p, 0, 0.4) * (1 - ramp(p, 0.5, 0.56));
        const kick = bell(p, 0.5, 0.75);
        body.group.position.z += -0.3 * ready + 0.3 * kick;
        head.group.rotation.x = 0.15 * ready - 0.1 * kick;
        puff = 0.25 * ready + 0.1 * kick;
        quills.group.rotation.x = -0.25 * kick;
        break;
      }
      case "skill": {
        // charge (0–.25) → flare (.2–.5) → quill rain (impact .6) → pierce → light burst (.8–1).
        const p = c.p;
        const charge = win(p, 0, 0.6, 0.06), flare = win(p, 0.2, 0.6, 0.05), rain = win(p, 0.55, 0.85, 0.03), burst = win(p, 0.8, 1, 0.05);
        body.group.position.y += 0.2 * flare + 0.25 * burst;
        head.group.rotation.x = -0.3 * flare;
        puff = 0.2 * charge + 0.25 * flare + 0.15 * Math.sin(c.t * 40) * rain + 0.2 * burst;
        quills.group.rotation.x = -0.2 * rain;
        lid = Math.max(lid, 0.5 * rain);
        if (halo) halo.group.scale.setScalar(1 + 0.4 * flare + 0.3 * burst);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.5 * k;
        head.group.rotation.x = -0.2 * k;
        body.group.rotation.z = shake * 0.06;
        puff = 0.15 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    quills.group.scale.setScalar(1 + puff);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống: legs splay (0–.3) → mờ dần: body settles, quills fold (.12–.45) → tan vào ánh sáng (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, quills, legs } = r;
      const p = c.p;
      const splay = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.45);
      for (const l of legs) l.part.group.rotation.z = l.side * 1.3 * splay;
      body.group.position.y += -0.5 * drop + bell(p, 0.45, 0.55) * 0.08;
      quills.group.scale.setScalar(1 - 0.2 * drop);
      head.group.rotation.x = 0.3 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.45), bell(p, 0, 0.08));
    },
  },
});
