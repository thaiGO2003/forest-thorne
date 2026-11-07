// Ngọn Núi Đầu Bò (catalog id ox_mountain, kept for save compatibility) — bespoke rig from the
// "Ngọn Núi Đầu Bò" sheet. Huge stone-bodied bull: dark rock hide, cream horns, glowing orange eyes, a
// gold nose ring, a pale beard, a mossy mountain with a snowy peak, pine trees and a waterfall on its
// back, and a glowing orange rune on each shoulder.
// Idle: heavy breath → look around → small tremor · Combat idle: alert / brace / guardian aura ·
// Move: step → run → charge · Attack: lower horns → headbutt (impact) → shock stomp · Skill: summon ice
// → raise the ice wall → trap the enemy (impact) → hold → shatter · Hit: struck → slide back → steady ·
// Death: collapses → lies down → crumbles away. 2★ ice crystals on the back; 3★ glowing ice horns,
// rune glow and taller crystals.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  rock: 0x5a4a40, rockD: 0x3c302a, rockL: 0x7a6a5a, horn: 0xeee0c0, hornD: 0xc0a880, eye: 0xff8a20, gold: 0xf0b030,
  beard: 0xd8d0c0, moss: 0x5a9a3a, mossD: 0x3a7a2a, snow: 0xf4f8ff, pine: 0x2a6a3a, trunk: 0x5a3a20, water: 0x6ac8ff,
  rune: 0xffa030, ice: 0x8ad8ff,
};
const BODY_Y = 3.6;

interface Leg { part: Part; side: 1 | -1; front: boolean }
interface Parts { body: Part; head: Part; lids: Part; back: Part; legs: Leg[] }

export default defineUnit<Parts>({
  id: "ox_mountain",
  motion: "ground",
  height: 12,
  durations: { idle: 4.5, attack: 0.95, skill: 1.8, hit: 0.5, move: 0.8 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [4.4, 3.4, 5.6], C.rock).box([0, -1.2, 0.2], [3.8, 1.0, 5.0], C.rockD)
      .pair([2.22, 0.2, 1.6], [0.12, 1.6, 1.6], C.rockL).pair([2.3, 0.2, 1.6], [0.1, 0.9, 0.9], C.rune, { mat: "glow" })
      .box([0, 1.0, -1.0], [4.5, 0.5, 3.4], C.moss).box([1.6, 0.4, -0.6], [1.4, 0.6, 2.2], C.mossD);
    const back = k.part("back", body, [0, 1.7, -0.6]);
    back.box([0, 0.8, 0], [3.2, 1.6, 3.2], C.rockL).box([0, 2.0, 0.1], [2.0, 1.4, 2.0], C.rock).box([0, 3.0, 0.2], [1.0, 0.8, 1.0], C.snow)
      .box([0, 2.45, 0.15], [1.8, 0.3, 1.8], C.snow).box([0.8, 1.3, 1.62], [0.6, 2.4, 0.12], C.water, { mat: "glow" })
      .box([0.8, -0.2, 1.7], [1.0, 0.3, 0.3], C.water, { mat: "glow" });
    for (const [x, z] of [[-1.4, 1.0], [1.5, -1.2], [-1.2, -1.4]] as const) {
      back.box([x, 1.0, z], [0.3, 0.6, 0.3], C.trunk).box([x, 1.6, z], [0.9, 0.8, 0.9], C.pine).box([x, 2.2, z], [0.5, 0.6, 0.5], C.pine);
    }
    if (star >= 2) for (const [x, z] of [[-1.0, -0.2], [1.2, 0.6], [0.2, -1.4]] as const) back.box([x, 1.8, z], [0.4, 1.2 + (star >= 3 ? 0.8 : 0), 0.4], C.ice, { mat: "glow", rot: [0.2, 0, x * 0.15] });
    const head = k.part("head", body, [0, 0.4, 2.9]);
    head.box([0, 0, 1.1], [3.2, 2.6, 2.2], C.rock).box([0, -0.6, 2.25], [2.2, 1.4, 0.3], C.rockL)
      .pair([0.9, 0.5, 2.22], [0.6, 0.45, 0.08], C.eye, { mat: "glow" }).pair([0.5, -0.7, 2.42], [0.3, 0.3, 0.06], C.rockD)
      .box([0, -1.15, 2.44], [1.0, 0.18, 0.18], C.gold).pair([0.5, -1.4, 2.44], [0.18, 0.6, 0.18], C.gold).box([0, -1.65, 2.44], [1.0, 0.18, 0.18], C.gold)
      .box([0, -1.7, 1.6], [1.6, 0.8, 1.0], C.beard).box([0, 1.45, 1.0], [2.4, 0.4, 1.6], C.mossD);
    const hornColor = star >= 3 ? C.ice : C.horn;
    head.pair([2.0, 1.0, 1.0], [1.4, 0.8, 0.8], C.hornD).pair([2.9, 1.7, 1.2], [0.7, 1.4, 0.7], hornColor, { mat: star >= 3 ? "glow" : "solid" })
      .pair([3.1, 2.6, 1.6], [0.45, 0.8, 0.45], hornColor, { mat: star >= 3 ? "glow" : "solid" });
    if (star >= 3) body.pair([2.32, 0.2, -1.6], [0.1, 0.9, 0.9], C.rune, { mat: "glow" }).box([0, 0.2, -2.82], [1.2, 1.2, 0.1], C.ice, { mat: "glow" });
    const lids = k.part("lids", head, [0, 0.75, 2.26]);
    lids.pair([0.9, -0.25, 0], [0.65, 0.5, 0.06], C.rockD);
    const legs: Leg[] = [];
    for (const front of [true, false]) for (const side of [1, -1] as const) {
      const part = k.part(`leg${side > 0 ? "R" : "L"}${front ? "F" : "B"}`, body, [side * 1.5, -1.5, front ? 1.8 : -1.8]);
      part.box([0, -0.85, 0], [1.4, 1.7, 1.4], C.rock).box([0, -1.6, 0.05], [1.5, 0.5, 1.5], C.rockD).box([0, -0.3, 0.72], [0.8, 0.6, 0.08], C.rockL);
      legs.push({ part, side, front });
    }
    return { body, head, lids, back, legs };
  },

  pose(r, c) {
    const { body, head, lids, back, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const gait = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + ((l.side > 0) === l.front ? 0 : Math.PI)) * amp; };

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, brace, aura] = beats(T, c.sig, 0x0b55);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * alert;
          head.group.rotation.x = 0.2 * brace;
          body.group.position.y += 0.15 * aura + Math.abs(Math.sin(T * 2)) * 0.05;
          body.group.scale.set(1 + 0.04 * aura, 1, 1 + 0.04 * aura);
          lid = Math.max(lid, 0.3 * brace);
        } else {
          // heavy breath (0–.4) → look around (.4–.7) → small tremor (.7–1).
          const ph = c.p % 1;
          const look = win(ph, 0.4, 0.7, 0.05), tremor = win(ph, 0.68, 1, 0.05);
          body.group.scale.set(1 + Math.sin(T * 1.4) * 0.025, 1 + Math.sin(T * 1.4) * 0.03, 1);
          head.group.rotation.y = Math.sin(c.t * 1.8) * 0.35 * look;
          head.group.rotation.x = Math.sin(T * 1.4) * 0.05;
          body.group.position.y += Math.abs(Math.sin(c.t * 40)) * 0.06 * tremor;
          back.group.rotation.z = Math.sin(c.t * 40) * 0.01 * tremor;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (6 + 4 * g);
        gait(w, 0.35 + 0.1 * g);
        body.group.position.y += Math.abs(Math.sin(w)) * 0.18;
        head.group.rotation.x = 0.1 + 0.15 * g;
        break;
      }
      case "attack": {
        // lower horns (0–.4) → headbutt (impact .55) → shock stomp.
        const p = c.p;
        const lower = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const butt = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.72, 1));
        head.group.rotation.x = 0.35 * lower - 0.15 * butt;
        body.group.position.z += -0.4 * lower + 1.0 * butt;
        body.group.position.y += 0.2 * lower;
        break;
      }
      case "skill": {
        // summon ice (0–.3) → raise the wall: rear up (.25–.5) → stomp + trap (impact .6) → hold → shatter.
        const p = c.p;
        const summon = win(p, 0, 0.3, 0.06), rear = win(p, 0.25, 0.58, 0.05), hold = win(p, 0.6, 0.85, 0.05), crack = win(p, 0.82, 1, 0.04);
        body.group.position.y += 0.9 * rear + Math.abs(Math.sin(c.t * 35)) * 0.08 * crack;
        head.group.rotation.x = -0.4 * rear + 0.2 * hold;
        for (const l of legs) if (l.front) l.part.group.rotation.x = -0.6 * rear;
        back.group.scale.setScalar(1 + 0.06 * summon);
        lid = Math.max(lid, 0.35 * summon);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.5 * k;
        head.group.rotation.x = -0.2 * k;
        head.group.rotation.z = shake * 0.06;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống: legs splay (0–.3) → gục: belly settles on the tile (.12–.45) → tan biến (.7–1).
    seconds: 1.3,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, legs } = r;
      const p = c.p;
      const splay = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.45);
      for (const l of legs) l.part.group.rotation.z = l.side * 1.3 * splay;
      body.group.position.y += -1.0 * drop + bell(p, 0.45, 0.55) * 0.12;
      head.group.rotation.x = 0.35 * drop;
      head.group.rotation.z = 0.15 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.45), bell(p, 0, 0.08));
    },
  },
});
