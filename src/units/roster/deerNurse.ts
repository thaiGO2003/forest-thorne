// Nai Y Tá (catalog id deer_song, kept for save compatibility) — bespoke rig from the "Nai Y Tá"
// sheet. Gentle deer-centaur healer: spotted fawn body with pink-and-white socks, a white nurse dress
// with a red cross, brown braided hair, a nurse cap, pink deer ears, gold antlers, a first-aid bag and
// a gold staff topped with a glowing green cross.
// Idle: relax → soft smile → pat the first-aid bag · Combat idle: watch allies / check status / hold
// the healing aura · Move: walk → trot → glide · Attack: focus → heal beam (impact) → follow-through ·
// Skill: raise staff → gather forest light → healing ring (impact) → mend → revive · Hit: startled →
// stagger → recover · Death: tires → kneels → fades into light. 2★ hair flowers + bag charm;
// 3★ glowing leaf wings and a halo.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fawn: 0xc8946a, fawnD: 0x9a6a46, spot: 0xf6eee0, belly: 0xf2e2cc, sock: 0xf4f0f0, pink: 0xf0a0b8, hoof: 0x5a3a2a,
  dress: 0xf8f6f2, cross: 0xe03a48, skin: 0xf8dcc8, hair: 0x8a5a3a, hairD: 0x6a4028, eye: 0xd04a7a, gold: 0xe8c050,
  heal: 0x7aff8a, leaf: 0x9aff9a, flower: 0xffa0c8, bag: 0xe8506a,
};
const BARREL_Y = 3.5;

interface Leg { part: Part; side: 1 | -1; front: boolean }
interface Parts { barrel: Part; torso: Part; head: Part; lids: Part; tail: Part; armR: Part; armL: Part; staff: Part; legs: Leg[] }

export default defineUnit<Parts>({
  id: "deer_song",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.7 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const barrel = k.part("barrel", null, [0, BARREL_Y, -0.4]);
    barrel.box([0, 0, 0], [2.2, 1.8, 3.6], C.fawn).box([0, -0.85, 0], [1.8, 0.2, 3.2], C.belly)
      .pair([1.12, 0.3, -0.6], [0.06, 0.4, 0.4], C.spot).pair([1.12, 0.1, 0.6], [0.06, 0.35, 0.35], C.spot).box([0, 0.92, -1.0], [0.4, 0.06, 0.4], C.spot)
      .pair([1.15, -0.1, 0.1], [0.3, 0.9, 1.0], C.bag).pair([1.32, 0, 0.1], [0.06, 0.4, 0.15], C.dress).pair([1.32, 0, 0.1], [0.06, 0.15, 0.4], C.dress);
    if (star >= 2) barrel.pair([1.35, 0.5, 0.5], [0.12, 0.3, 0.3], C.flower);
    const tail = k.part("tail", barrel, [0, 0.6, -1.85]);
    tail.box([0, 0.1, -0.2], [0.6, 0.7, 0.4], C.fawnD).box([0, -0.1, -0.35], [0.4, 0.4, 0.2], C.spot);
    const legs: Leg[] = [];
    for (const front of [true, false]) for (const side of [1, -1] as const) {
      const part = k.part(`leg${side > 0 ? "R" : "L"}${front ? "F" : "B"}`, barrel, [side * 0.75, -0.8, front ? 1.3 : -1.3]);
      part.box([0, -1.1, 0], [0.6, 2.2, 0.6], C.fawn).box([0, -1.9, 0], [0.7, 0.5, 0.7], C.sock).box([0, -1.65, 0], [0.72, 0.12, 0.72], C.pink)
        .box([0, -2.35, 0.05], [0.7, 0.3, 0.8], C.hoof);
      legs.push({ part, side, front });
    }
    const torso = k.part("torso", barrel, [0, 0.7, 1.4]);
    torso.box([0, 1.0, 0], [1.8, 2.0, 1.3], C.dress).box([0, 1.2, 0.66], [0.2, 0.7, 0.06], C.cross).box([0, 1.2, 0.66], [0.7, 0.2, 0.06], C.cross)
      .box([0, 0.15, 0], [2.0, 0.3, 1.4], C.pink).box([0, 2.0, 0], [1.9, 0.25, 1.4], C.pink);
    if (star >= 3) {
      for (const s of [1, -1]) torso.box([s * 1.4, 1.6, -0.9], [1.8, 1.2, 0.12], C.leaf, { mat: "glow", rot: [0, 0, -s * 0.5] }).box([s * 1.9, 2.4, -1.0], [1.2, 0.8, 0.12], C.leaf, { mat: "glow", rot: [0, 0, -s * 0.7] });
    }
    const head = k.part("head", torso, [0, 2.1, 0.1]);
    head.box([0, 1.0, 0], [2.2, 2.0, 2.0], C.skin).box([0, 1.4, -0.3], [2.4, 1.6, 1.8], C.hair).box([0, 2.05, 0], [2.3, 0.4, 2.1], C.hair)
      .pair([1.15, 0.6, 0.2], [0.3, 1.4, 1.2], C.hair).pair([1.1, -0.3, -0.1], [0.4, 1.2, 0.4], C.hairD)
      .pair([0.5, 0.95, 1.02], [0.45, 0.55, 0.06], C.eye).pair([0.45, 1.1, 1.06], [0.15, 0.15, 0.04], C.dress).pair([0.75, 0.55, 1.02], [0.3, 0.15, 0.04], C.pink)
      .box([0, 0.45, 1.02], [0.4, 0.1, 0.04], C.cross);
    head.box([0, 2.45, 0.2], [1.8, 0.6, 1.4], C.dress).box([0, 2.5, 0.92], [0.15, 0.45, 0.04], C.cross).box([0, 2.5, 0.92], [0.45, 0.15, 0.04], C.cross)
      .pair([1.4, 1.8, -0.1], [0.9, 0.4, 0.5], C.pink, { rot: [0, 0, -0.4] })
      .pair([0.75, 3.0, -0.2], [0.25, 1.1, 0.25], C.gold, { rot: [0, 0, -0.3] }).pair([1.1, 3.4, -0.2], [0.6, 0.22, 0.22], C.gold).pair([0.55, 3.55, -0.2], [0.2, 0.5, 0.2], C.gold);
    if (star >= 2) head.pair([1.0, 2.2, 0.8], [0.35, 0.35, 0.2], C.flower);
    if (star >= 3) head.box([0, 4.1, -0.2], [2.0, 0.15, 0.15], C.heal, { mat: "glow" }).pair([1.0, 4.1, -0.2], [0.15, 0.15, 1.2], C.heal, { mat: "glow" });
    const lids = k.part("lids", head, [0, 1.25, 1.04]);
    lids.pair([0.5, -0.3, 0], [0.5, 0.6, 0.06], C.skin);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.05, 1.8, 0]);
      p.box([side * 0.15, -0.7, 0], [0.5, 1.4, 0.5], C.dress).box([side * 0.15, -1.55, 0.1], [0.5, 0.4, 0.5], C.skin);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const staff = k.part("staff", armR, [0.15, -1.55, 0.3]);
    staff.box([0, 0.6, 0], [0.25, 4.6, 0.25], C.gold).box([0, 3.2, 0], [1.0, 1.0, 0.25], C.gold)
      .box([0, 3.2, 0.05], [0.25, 0.8, 0.2], C.heal, { mat: "glow" }).box([0, 3.2, 0.05], [0.8, 0.25, 0.2], C.heal, { mat: "glow" })
      .pair([0.7, 3.4, 0], [0.5, 0.2, 0.15], C.dress);
    return { barrel, torso, head, lids, tail, armR, armL, staff, legs };
  },

  pose(r, c) {
    const { barrel, torso, head, lids, tail, armR, armL, staff, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const gait = (w: number, amp: number) => {
      for (const l of legs) l.part.group.rotation.x = Math.sin(w + ((l.side > 0) === l.front ? 0 : Math.PI)) * amp;
    };
    tail.group.rotation.x = -0.2 + Math.sin(T * 3) * 0.15;
    armR.group.rotation.x = -0.35;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, check, aura] = beats(T, c.sig, 0xdee7);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.4 * watch;
          torso.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.15 * watch;
          armL.group.rotation.x = -0.9 * check;
          head.group.rotation.x = 0.2 * check;
          armR.group.rotation.x = -0.35 - 0.5 * aura;
          staff.group.rotation.x = 0.3 * aura;
          barrel.group.position.y += Math.abs(Math.sin(T * 2.5)) * 0.06;
        } else {
          // relax (0–.35) → soft smile (.35–.65) → pat the first-aid bag (.65–1).
          const ph = c.p % 1;
          const smile = win(ph, 0.35, 0.65, 0.05), pat = win(ph, 0.65, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          head.group.rotation.z = 0.2 * smile;
          lid = Math.max(lid, 0.6 * smile);
          armL.group.rotation.x = -0.3 * pat;
          armL.group.rotation.z = -0.5 * pat + Math.sin(c.t * 10) * 0.08 * pat;
          head.group.rotation.x = 0.2 * pat;
          tail.group.rotation.x = -0.2 + Math.sin(T * 9) * 0.25 * smile;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (8 + 4 * g);
        gait(w, 0.4 + 0.15 * g);
        barrel.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        barrel.group.rotation.x = Math.sin(w * 2) * 0.03;
        torso.group.rotation.x = 0.1 * g;
        armL.group.rotation.x = Math.sin(w) * 0.3;
        break;
      }
      case "attack": {
        // focus (0–.4) → heal beam (impact .55) → follow-through.
        const p = c.p;
        const focus = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const cast = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.7, 1));
        armR.group.rotation.x = -0.35 - 0.5 * focus - 0.9 * cast;
        staff.group.rotation.x = 0.2 * focus + 0.9 * cast;
        torso.group.rotation.x = -0.1 * focus + 0.15 * cast;
        lid = Math.max(lid, 0.4 * focus);
        break;
      }
      case "skill": {
        // raise staff (0–.25) → gather light (.2–.45) → healing ring (impact .6) → mend → revive (.8–1).
        const p = c.p;
        const raise = win(p, 0, 0.75, 0.1), gather = win(p, 0.2, 0.5, 0.05);
        const ring = win(p, 0.5, 0.75, 0.04), revive = win(p, 0.78, 1, 0.06);
        armR.group.rotation.x = -0.35 - 1.6 * raise;
        armL.group.rotation.x = -1.2 * gather - 0.8 * revive;
        armL.group.rotation.z = -0.4 * ring;
        staff.group.rotation.x = 0.4 * raise;
        torso.group.rotation.x = -0.15 * raise + 0.1 * revive;
        barrel.group.position.y += 0.3 * ring;
        head.group.rotation.x = -0.25 * gather;
        lid = Math.max(lid, 0.5 * gather);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        barrel.group.position.z += -0.5 * k;
        torso.group.rotation.x = -0.25 * k;
        torso.group.rotation.z = shake * 0.06;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Mất sức (0–.3) → quỵ xuống: legs fold under (.2–.55) → tan vào ánh sáng (.7–1, shrink-out).
    seconds: 1.3,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { barrel, torso, head, lids, armR, legs } = r;
      const p = c.p;
      const tire = ramp(p, 0, 0.3), fold = ramp(p, 0.1, 0.4), kneel = ramp(p, 0.22, 0.55);
      barrel.group.position.y += -1.8 * kneel + bell(p, 0.55, 0.65) * 0.1;
      for (const l of legs) l.part.group.rotation.x = (l.front ? -1.4 : 1.4) * fold;
      torso.group.rotation.x = 0.15 * tire + 0.3 * kneel;
      torso.group.rotation.z = 0.25 * kneel;
      armR.group.rotation.x = -0.35 - 0.4 * kneel;
      head.group.rotation.x = 0.4 * kneel;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.15, 0.4), bell(p, 0, 0.08));
    },
  },
});
