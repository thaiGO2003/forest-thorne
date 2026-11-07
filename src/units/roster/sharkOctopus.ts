// Bạch Tuộc Đầu Cá Mập (catalog id octopus_mind, kept for save compatibility) — bespoke rig from the
// "Bạch Tuộc Đầu Cá Mập" sheet. Sea hybrid: a slate-blue shark head with a huge open jaw full of cream
// teeth, orange eyes, red gill scars and a dorsal fin, sitting on a purple octopus mantle with eight
// thick tentacles lined with pink suckers.
// Idle: watch → heavy breath → look around → wave tentacles · Combat idle: alert / hold / shield
// stance · Move: step → step → scuttle · Attack: swing tentacle → sweep (impact) → recover ·
// Skill: brace → tentacles rise → coil the enemy (impact) → raise the shield → hold · Hit: struck →
// slide back → steady · Death: collapses → tentacles curl → shatters. 2★ extra fin spikes and scars;
// 3★ glowing water fins and a shield crest.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  shark: 0x4a5a9a, sharkD: 0x2e3a6a, belly: 0xe8e0f0, tooth: 0xf4ecd8, gum: 0xc03a5a, mouth: 0x5a1020, eye: 0xffa020,
  pupil: 0x1a0c08, scar: 0xc02a3a, purple: 0x7a4ab0, purpleD: 0x52307a, sucker: 0xf0b0d0, water: 0x5ad0ff, shield: 0x9ae0ff,
};
const BODY_Y = 3.0;
const ARMS = 8;

interface Tentacle { mount: Part; arm: Part; phase: number }
interface Parts { body: Part; head: Part; jaw: Part; lids: Part; tentacles: Tentacle[] }

export default defineUnit<Parts>({
  id: "octopus_mind",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.8 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [3.8, 3.0, 3.8], C.purple).box([0, -1.2, 0], [3.2, 0.6, 3.2], C.purpleD).box([0, 0.3, 1.92], [2.2, 1.6, 0.08], C.purpleD);
    const tentacles: Tentacle[] = [];
    for (let i = 0; i < ARMS; i++) {
      const a = (i / ARMS) * Math.PI * 2 + Math.PI / ARMS;
      const mount = k.part(`tm${i}`, body, [Math.cos(a) * 1.5, -1.3, Math.sin(a) * 1.5]);
      mount.group.rotation.y = -a;
      const arm = k.part(`t${i}`, mount, [0, 0, 0]);
      arm.box([1.0, -0.5, 0], [2.2, 1.0, 1.0], C.purple).box([2.4, -1.15, 0], [1.2, 0.8, 0.8], C.purple).box([2.9, -0.6, 0], [0.55, 1.0, 0.55], C.purpleD)
        .box([1.2, -0.95, 0.52], [1.6, 0.3, 0.1], C.sucker).box([1.2, -0.95, -0.52], [1.6, 0.3, 0.1], C.sucker).box([2.4, -1.45, 0.42], [0.8, 0.25, 0.1], C.sucker);
      tentacles.push({ mount, arm, phase: i * 0.9 });
    }
    const head = k.part("head", body, [0, 1.3, 0.2]);
    head.box([0, 2.4, -0.3], [3.6, 2.4, 3.6], C.shark).box([0, 1.0, 0.6], [3.4, 0.6, 2.8], C.shark).box([0, 3.0, 2.0], [2.6, 1.4, 1.2], C.shark)
      .box([0, 1.9, 1.6], [2.8, 1.6, 0.4], C.mouth).box([0, 2.55, 1.85], [2.8, 0.25, 0.25], C.gum)
      .pair([1.75, 1.8, 0.4], [0.12, 1.6, 2.4], C.belly).pair([1.82, 3.0, -0.6], [0.06, 0.8, 0.2], C.scar).pair([1.82, 3.0, -1.0], [0.06, 0.8, 0.2], C.scar)
      .pair([1.3, 3.4, 1.9], [0.5, 0.45, 0.5], C.eye).pair([1.38, 3.4, 2.1], [0.25, 0.35, 0.2], C.pupil)
      .box([0, 4.4, -0.8], [0.7, 1.6, 1.8], C.sharkD, { rot: [-0.4, 0, 0] });
    for (let i = 0; i < 6; i++) head.box([-1.25 + i * 0.5, 2.25, 1.95], [0.3, 0.55, 0.25], C.tooth);
    const jaw = k.part("jaw", head, [0, 1.0, -0.2]);
    jaw.box([0, -0.3, 0.9], [3.2, 0.7, 2.6], C.belly).box([0, 0.15, 1.5], [2.6, 0.3, 1.4], C.mouth).box([0, 0.15, 0.9], [1.4, 0.3, 1.0], C.gum);
    for (let i = 0; i < 5; i++) jaw.box([-1.0 + i * 0.5, 0.45, 2.05], [0.3, 0.5, 0.25], C.tooth);
    const lids = k.part("lids", head, [0, 3.6, 2.12]);
    lids.pair([1.3, -0.2, 0], [0.55, 0.5, 0.06], C.shark);
    if (star >= 2) head.box([0, 5.2, -1.1], [0.4, 0.7, 0.8], C.sharkD).pair([1.82, 2.2, -0.2], [0.06, 0.6, 0.2], C.scar).pair([1.6, 2.8, -1.6], [0.6, 0.8, 0.3], C.sharkD);
    if (star >= 3) {
      head.pair([2.0, 2.4, -1.2], [0.2, 1.2, 1.4], C.water, { mat: "glow" }).box([0, 5.0, -0.9], [0.2, 1.2, 1.6], C.water, { mat: "glow" });
      body.box([0, 0.3, 1.98], [1.2, 1.4, 0.06], C.shield, { mat: "glow" });
    }
    return { body, head, jaw, lids, tentacles };
  },

  pose(r, c) {
    const { body, head, jaw, lids, tentacles } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    // Tentacles only ever curl upward (positive z in the mount frame) so their tips stay above the tile.
    const curl = (base: number, wave: number, rate: number) => {
      for (const t of tentacles) t.arm.group.rotation.z = base + wave * (0.5 + 0.5 * Math.sin(T * rate + t.phase));
    };
    curl(0, 0.08, 1.6);
    jaw.group.rotation.x = 0.1 + Math.sin(T * 1.4) * 0.04;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, hold, guard] = beats(T, c.sig, 0x5a4c);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * alert;
          jaw.group.rotation.x = 0.1 + 0.25 * hold;
          curl(0.1 * hold + 0.35 * guard, 0.12, 2.2);
          body.group.position.y += 0.2 * guard;
          lid = Math.max(lid, 0.3 * guard);
        } else {
          // watch (0–.25) → heavy breath (.25–.5) → look around (.5–.75) → wave tentacles (.75–1).
          const ph = c.p % 1;
          const breath = win(ph, 0.25, 0.5, 0.05), look = win(ph, 0.5, 0.76, 0.05), wave = win(ph, 0.74, 1, 0.05);
          body.group.scale.set(1 + 0.05 * breath, 1 + 0.04 * breath, 1 + 0.05 * breath);
          jaw.group.rotation.x = 0.1 + 0.3 * breath;
          head.group.rotation.y = Math.sin(c.t * 2) * 0.4 * look;
          curl(0, 0.08 + 0.45 * wave, 3);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const rate = 6 + 4 * g;
        for (const t of tentacles) t.arm.group.rotation.z = 0.3 * Math.max(0, Math.sin(T * rate + t.phase * 2));
        body.group.position.y += 0.15 + Math.abs(Math.sin(T * rate)) * 0.2;
        head.group.rotation.x = 0.1 * g;
        head.group.rotation.z = Math.sin(T * rate * 0.5) * 0.06;
        break;
      }
      case "attack": {
        // swing (0–.4) → sweep (impact .55) → recover.
        const p = c.p;
        const swing = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const sweep = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.72, 1));
        for (const [i, t] of tentacles.entries()) {
          const front = i === 1 || i === 2 ? 1 : 0;
          t.arm.group.rotation.z = front * (1.1 * swing + 0.4 * sweep) + 0.05;
        }
        body.group.rotation.y = 0.3 * swing - 0.5 * sweep;
        jaw.group.rotation.x = 0.1 + 0.4 * swing;
        head.group.rotation.x = 0.15 * sweep;
        break;
      }
      case "skill": {
        // brace (0–.25) → tentacles rise (.2–.45) → coil (impact .6) → shield (.7–1).
        const p = c.p;
        const brace = win(p, 0, 0.3, 0.06), rise = win(p, 0.2, 0.7, 0.05), coil = win(p, 0.5, 0.75, 0.04), shield = win(p, 0.7, 1, 0.06);
        curl(0.9 * rise + 0.3 * shield, 0.15 * coil, 10);
        body.group.position.y += -0.2 * brace + 0.4 * rise;
        body.group.rotation.y = Math.sin(c.t * 8) * 0.4 * coil;
        jaw.group.rotation.x = 0.1 + 0.5 * brace + 0.3 * coil;
        body.group.scale.setScalar(1 + 0.06 * shield);
        lid = Math.max(lid, 0.4 * brace);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.6 * k;
        head.group.rotation.x = -0.2 * k;
        head.group.rotation.z = shake * 0.06;
        curl(0.3 * k, 0.05, 2);
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Gục xuống (0–.4) → co rút: tentacles curl up (.1–.45) → tan biến (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, jaw, lids, tentacles } = r;
      const p = c.p;
      const curl = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.42);
      for (const t of tentacles) t.arm.group.rotation.z = 1.0 * curl + Math.sin(c.t * 30 + t.phase) * 0.05 * bell(p, 0.3, 0.6) + 0.05;
      body.group.position.y += -0.9 * drop;
      head.group.rotation.x = 0.3 * drop;
      jaw.group.rotation.x = 0.4 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.4), bell(p, 0, 0.08));
    },
  },
});
