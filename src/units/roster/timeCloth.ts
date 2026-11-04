// Ma Vải Thời Gian (catalog id wisp_light, kept for save compatibility) — bespoke rig from the "Ma Vải
// Thời Gian" sheet. A floating spirit woven from cream cloth: tattered hooded cloak over a deep-blue
// robe, a dark face with two glowing blue eyes, an hourglass emblem on the chest, purple time ribbons
// trailing behind, a wooden staff topped by an hourglass inside a golden clock gear, and a small lantern.
// Idle: hover → ribbons drift → sand swirl (gear turns) · Combat idle: alert / gather power / spin the
// time ring · Move: glide → drift → speed up · Attack: fling sand shard → time ring → beam (impact) ·
// Skill: activate → weave the clock ring → slow enemies (impact) → rewind → sustain · Hit: struck → drift
// back → steady · Death: loses cohesion → unravels → turns to sand. 2★ clock numerals and a third
// ribbon; 3★ glowing outer gear ring and gold hood trim.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  cloth: 0xeadcc0, clothD: 0xb8a684, robe: 0x2a3a8a, robeD: 0x1a2458, face: 0x0e1020, eye: 0x6ad8ff, gold: 0xf0b838,
  goldD: 0xb07a20, wood: 0x7a4a24, sand: 0x8ae0ff, ribbon: 0x9a6ae0, ribbonD: 0x6a42b8, lamp: 0xffd070,
};
const FLOAT_Y = 1.3;

interface Parts { body: Part; head: Part; lids: Part; armR: Part; armL: Part; staff: Part; gear: Part; lantern: Part; ribbons: Part[] }

export default defineUnit<Parts>({
  id: "wisp_light",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.85, skill: 1.9, hit: 0.5, move: 0.6 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, FLOAT_Y, 0]);
    body.box([0, 0.8, 0], [3.0, 1.6, 2.6], C.cloth).box([0, 2.2, 0], [2.6, 1.4, 2.2], C.cloth).box([0, 3.3, 0], [2.2, 1.0, 1.9], C.cloth)
      .box([0, 1.6, 1.12], [1.4, 2.8, 0.12], C.robe).box([0, 0.4, 1.0], [1.8, 0.7, 0.7], C.robeD)
      .pair([1.2, -0.15, 0.7], [0.6, 0.5, 0.4], C.clothD).pair([0.5, -0.3, -0.9], [0.6, 0.6, 0.5], C.clothD).box([0, -0.2, 1.05], [0.6, 0.5, 0.3], C.clothD)
      .box([0, 2.4, 1.2], [0.6, 0.12, 0.08], C.gold).box([0, 1.9, 1.2], [0.6, 0.12, 0.08], C.gold).box([0, 2.15, 1.22], [0.3, 0.4, 0.06], C.sand, { mat: "glow" });
    const head = k.part("head", body, [0, 3.7, 0.1]);
    head.box([0, 0.9, 0], [2.6, 2.0, 2.4], C.cloth).box([0, 0.75, 1.15], [1.7, 1.3, 0.1], C.face).box([0, 0.75, 0.9], [1.5, 1.2, 0.5], C.face)
      .box([0.3, 2.1, -0.4], [1.2, 0.8, 1.2], C.cloth, { rot: [-0.4, 0, -0.3] }).box([0.6, 2.5, -0.9], [0.6, 0.5, 0.6], C.clothD, { rot: [-0.6, 0, -0.5] })
      .pair([0.42, 0.85, 1.22], [0.36, 0.36, 0.05], C.eye, { mat: "glow" });
    if (star >= 3) head.box([0, 1.55, 1.22], [2.0, 0.15, 0.08], C.gold).pair([0.95, 0.8, 1.22], [0.12, 1.3, 0.08], C.gold);
    const lids = k.part("lids", head, [0, 0.85, 1.26]);
    lids.pair([0.42, 0, 0], [0.42, 0.42, 0.05], C.face);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", body, [side * 1.35, 3.1, 0.1]);
      p.box([side * 0.25, -0.7, 0], [0.9, 1.5, 0.9], C.cloth).box([side * 0.3, -1.4, 0], [1.0, 0.3, 1.0], C.clothD).box([side * 0.25, -1.65, 0.1], [0.45, 0.4, 0.45], C.face);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const staff = k.part("staff", armR, [0.25, -1.65, 0.35]);
    staff.box([0, 0.4, 0], [0.25, 4.0, 0.25], C.wood).box([0, 2.45, 0], [0.7, 0.15, 0.7], C.gold).box([0, 3.55, 0], [0.7, 0.15, 0.7], C.gold)
      .box([0, 2.75, 0], [0.45, 0.45, 0.45], C.sand, { mat: "glow" }).box([0, 3.25, 0], [0.45, 0.45, 0.45], C.sand, { mat: "glow" }).pair([0.32, 3.0, 0], [0.08, 1.1, 0.08], C.goldD);
    const gear = k.part("gear", staff, [0, 3.0, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      gear.box([Math.cos(a) * 1.0, Math.sin(a) * 1.0, -0.05], [0.55, 0.22, 0.14], C.gold, { rot: [0, 0, a + Math.PI / 2] });
      if (star >= 2 && i % 2 === 0) gear.box([Math.cos(a) * 0.78, Math.sin(a) * 0.78, -0.02], [0.12, 0.2, 0.06], C.goldD, { rot: [0, 0, a] });
    }
    if (star >= 3) for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      gear.box([Math.cos(a) * 1.35, Math.sin(a) * 1.35, -0.1], [0.5, 0.12, 0.1], C.sand, { mat: "glow", rot: [0, 0, a + Math.PI / 2] });
    }
    const lantern = k.part("lantern", armL, [-0.25, -1.85, 0.15]);
    lantern.box([0, -0.25, 0], [0.08, 0.5, 0.08], C.goldD).box([0, -0.85, 0], [0.6, 0.12, 0.6], C.gold).box([0, -1.15, 0], [0.45, 0.5, 0.45], C.lamp, { mat: "glow" })
      .box([0, -1.45, 0], [0.6, 0.12, 0.6], C.gold);
    const ribbons: Part[] = [];
    const ribbonSpots: [number, number][] = star >= 2 ? [[1, 2.8], [-1, 2.5], [0.2, 1.6]] : [[1, 2.8], [-1, 2.5]];
    for (const [side, y] of ribbonSpots) {
      const p = k.part(`ribbon${ribbons.length}`, body, [side * 0.9, y, -1.0]);
      for (let i = 0; i < 5; i++) p.box([side * 0.25 * i, Math.sin(i * 1.3) * 0.3, -0.7 * i - 0.3], [0.5, 0.12, 0.8], i % 2 ? C.ribbonD : C.ribbon, { mat: "glow" });
      ribbons.push(p);
    }
    return { body, head, lids, armR, armL, staff, gear, lantern, ribbons };
  },

  pose(r, c) {
    const { body, head, lids, armR, armL, staff, gear, lantern, ribbons } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let spin = 0.6;
    body.group.position.y += 0.15 + Math.sin(T * 1.7 + c.sig * 4) * 0.15;
    ribbons.forEach((rb, i) => { rb.group.rotation.x = Math.sin(T * 2.2 + i * 1.7) * 0.25; rb.group.rotation.y = Math.sin(T * 1.5 + i) * 0.2; });
    armR.group.rotation.x = -0.35;
    staff.group.rotation.x = 0.35;
    lantern.group.rotation.x = Math.sin(T * 1.9) * 0.15;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, gather, ring] = beats(T, c.sig, 0x71ce);
          head.group.rotation.y = Math.sin(T * 0.8 + c.sig * 3) * 0.3 * alert;
          armL.group.rotation.x = -0.6 * gather;
          body.group.position.y += 0.2 * gather;
          spin += 4 * ring;
          lid = Math.max(lid, 0.3 * gather);
        } else {
          // hover (0–.35) → ribbons drift (.35–.65) → sand swirl (.65–1).
          const ph = c.p % 1;
          const drift = win(ph, 0.35, 0.65, 0.05), swirl = win(ph, 0.65, 1, 0.05);
          body.group.rotation.y = Math.sin(c.t * 2) * 0.15 * drift;
          for (const rb of ribbons) rb.group.rotation.x += Math.sin(c.t * 6) * 0.2 * drift;
          armR.group.rotation.x = -0.35 - 0.4 * swirl;
          spin += 3 * swirl;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        body.group.rotation.x = 0.15 + 0.15 * g;
        for (const rb of ribbons) rb.group.rotation.x = 0.25 + 0.15 * g + Math.sin(T * 8) * 0.1;
        body.group.position.y += Math.sin(T * 6) * 0.08;
        armL.group.rotation.x = 0.3 * g;
        break;
      }
      case "attack": {
        // sand shard (0–.35) → time ring (.3–.55) → beam (impact .55).
        const p = c.p;
        const raise = ramp(p, 0, 0.4) * (1 - ramp(p, 0.75, 1));
        const thrust = ramp(p, 0.45, 0.56) * (1 - ramp(p, 0.75, 1));
        armR.group.rotation.x = -0.35 - 0.9 * raise - 0.4 * thrust;
        staff.group.rotation.x = 0.35 + 0.3 * raise;
        spin += 6 * raise;
        body.group.position.z += 0.4 * thrust;
        head.group.rotation.x = -0.1 * thrust;
        break;
      }
      case "skill": {
        // activate (0–.2) → weave the clock (.15–.5) → slow (impact .6) → rewind (.65–.85) → sustain.
        const p = c.p;
        const lift = win(p, 0, 0.92, 0.1), weave = win(p, 0.15, 0.6, 0.05), slow = win(p, 0.55, 0.7, 0.03), rewind = win(p, 0.65, 0.88, 0.04);
        armR.group.rotation.x = -0.35 - 2.3 * lift;
        armL.group.rotation.z = -0.9 * lift;
        staff.group.rotation.x = 0.35 - 0.2 * lift;
        body.group.position.y += 0.5 * lift;
        gear.group.scale.setScalar(1 + 0.6 * weave + 0.3 * slow);
        spin += 10 * weave - 14 * rewind;
        for (const rb of ribbons) rb.group.rotation.y += 0.5 * weave;
        lid = Math.max(lid, 0.5 * slow);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.6 * k;
        body.group.rotation.x = -0.2 * k;
        body.group.rotation.z = shake * 0.06;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    gear.group.rotation.z = (c.state === "move" ? T : c.t) * spin;
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Mất liên kết: arms drop, staff tips (0–.35) → tan rã: cloak sags into a heap (.2–.6) → hóa cát (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, armR, armL, gear, ribbons } = r;
      const p = c.p;
      const slack = ramp(p, 0, 0.35), sag = ramp(p, 0.2, 0.6);
      body.group.position.y += -0.6 * sag + bell(p, 0, 0.2) * 0.2;
      body.group.scale.set(1 + 0.15 * sag, 1 - 0.4 * sag, 1 + 0.15 * sag);
      armR.group.rotation.z = 0.7 * slack;
      armL.group.rotation.z = -0.7 * slack;
      head.group.rotation.x = 0.4 * sag;
      gear.group.rotation.z = p * 4;
      for (const rb of ribbons) rb.group.rotation.x = -0.4 * slack;
      lids.group.scale.y = 0.05 + 0.95 * ramp(p, 0.1, 0.35);
    },
  },
});
