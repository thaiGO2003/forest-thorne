// Pháo Dừa (catalog id pelican_bomb, kept for save compatibility) — bespoke rig from the "Pháo Dừa"
// sheet. A small brown monkey gunner standing on two legs: a big spiky green palm-leaf crown, a gold
// diamond headband, tan face with a fanged grin, a leaf skirt and gold belt, a curled tail, and a huge
// coconut-shell cannon with gold bands and a glowing muzzle carried on both arms.
// Idle: stand guard → swing the cannon → toss a coconut → reload · Combat idle: alert / track target /
// hold aim · Move: step → run → dodge-slide · Attack: aim → fire coconut (impact) → shell bursts ·
// Skill: brace → charge energy → rapid fire (impact) → shards bounce → blast zone → finish · Hit:
// struck → step back → steady · Death: falls → coconut armor cracks → fades to light. 2★ gold-banded
// barrel and shoulder pad; 3★ twin glowing muzzles and a gold leaf crown.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x7a4a2a, furD: 0x52301a, face: 0xe8b88a, leaf: 0x5ac83a, leafD: 0x2e8a2a, gold: 0xf0b830, goldD: 0xb07a1a,
  shell: 0x6a3e1e, shellD: 0x40240e, meat: 0xf6efe0, eye: 0x2a1a10, white: 0xffffff, glow: 0xffd84a, tooth: 0xfaf6ee,
};
const HIP_Y = 2.3;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; crown: Part; armR: Part; armL: Part; cannon: Part; tail: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "pelican_bomb",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 2.0, hit: 0.5, move: 0.55 },
  impact: { attack: 0.45, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [1.8, 0.8, 1.3], C.furD).box([0, 0.3, 0], [1.9, 0.3, 1.4], C.gold);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hips.box([Math.sin(a) * 0.8, -0.5, Math.cos(a) * 0.6], [0.5, 0.8, 0.12], i % 2 ? C.leafD : C.leaf, { rot: [0, a, 0] });
    }
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.5, -0.3, 0]);
      part.box([0, -0.7, 0], [0.7, 1.2, 0.7], C.fur).box([0, -1.3, 0.05], [0.8, 0.3, 0.8], C.gold).box([0, -1.75, 0.2], [0.8, 0.5, 1.1], C.face);
      return { part, side };
    });
    const tail = k.part("tail", hips, [0, 0, -0.7]);
    tail.box([0, 0, -0.5], [0.3, 0.3, 1.0], C.fur).box([0, 0.5, -1.0], [0.3, 1.0, 0.3], C.fur).box([0, 1.0, -0.7], [0.3, 0.3, 0.6], C.fur).box([0, 0.8, -0.35], [0.3, 0.5, 0.3], C.furD);
    const torso = k.part("torso", hips, [0, 0.4, 0]);
    torso.box([0, 0.9, 0], [1.8, 1.8, 1.3], C.fur).box([0, 0.8, 0.66], [1.1, 1.3, 0.08], C.face).box([0, 1.6, 0.1], [1.9, 0.25, 1.4], C.leafD, { rot: [0, 0, 0.5] });
    if (star >= 2) torso.box([-0.9, 1.7, 0], [0.8, 0.4, 1.1], C.gold).box([-0.9, 1.95, 0], [0.5, 0.15, 0.7], C.leaf);
    const head = k.part("head", torso, [0, 1.8, 0.1]);
    head.box([0, 0.9, 0], [2.2, 1.9, 1.8], C.fur).box([0, 0.75, 0.88], [1.6, 1.3, 0.1], C.face).box([0, 0.35, 1.0], [1.0, 0.6, 0.4], C.face)
      .pair([0.42, 0.95, 0.95], [0.38, 0.42, 0.05], C.white).pair([0.42, 0.92, 0.98], [0.2, 0.28, 0.04], C.eye).pair([0.42, 1.25, 0.96], [0.5, 0.12, 0.05], C.furD)
      .box([0, 0.2, 1.21], [0.6, 0.15, 0.04], C.eye).pair([0.18, 0.08, 1.22], [0.1, 0.18, 0.04], C.tooth)
      .pair([1.2, 0.95, 0], [0.4, 0.6, 0.4], C.face).box([0, 1.6, 0.85], [2.2, 0.3, 0.2], C.gold).box([0, 1.6, 0.97], [0.45, 0.45, 0.06], C.leaf, { rot: [0, 0, Math.PI / 4] });
    const lids = k.part("lids", head, [0, 0.95, 1.0]);
    lids.pair([0.42, 0, 0], [0.42, 0.46, 0.05], C.fur);
    const crown = k.part("crown", head, [0, 1.85, -0.1]);
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + (i / 6) * 2.4;
      crown.box([Math.sin(a) * 0.6, 0.6, -0.2 + Math.cos(a) * 0.2], [0.45, 1.6, 0.15], i % 2 ? C.leafD : C.leaf, { rot: [-0.3, 0, -a * 0.7] });
    }
    crown.box([0, 0.3, -0.7], [0.5, 1.2, 0.15], C.leafD, { rot: [-0.9, 0, 0] });
    if (star >= 3) crown.box([0, 1.4, 0.1], [0.4, 0.5, 0.15], C.gold, { mat: "glow" });
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.1, 1.5, 0]);
      p.box([side * 0.15, -0.6, 0], [0.6, 1.3, 0.6], C.fur).box([side * 0.15, -1.1, 0], [0.7, 0.25, 0.7], C.gold).box([side * 0.15, -1.45, 0.1], [0.6, 0.5, 0.6], C.face);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const cannon = k.part("cannon", armR, [0.2, -1.4, 0.3]);
    cannon.box([0, 0.3, 0.5], [1.6, 1.6, 2.6], C.shell).box([0, 0.3, 1.9], [1.9, 1.9, 0.4], C.gold).box([0, 0.3, 0.0], [1.7, 1.7, 0.3], C.goldD)
      .box([0, 0.3, 2.15], [1.0, 1.0, 0.1], C.shellD).box([0, 0.3, 2.2], [0.6, 0.6, 0.06], C.glow, { mat: "glow" }).box([0, 0.3, -0.9], [1.2, 1.2, 0.6], C.shellD)
      .box([0, 1.15, 0.8], [0.3, 0.3, 0.6], C.leaf);
    if (star >= 2) cannon.box([0, 0.3, 1.0], [1.75, 1.75, 0.25], C.gold);
    if (star >= 3) cannon.box([0.9, 1.0, 1.1], [0.5, 0.5, 1.6], C.shell).box([0.9, 1.0, 1.95], [0.35, 0.35, 0.06], C.glow, { mat: "glow" });
    return { hips, torso, head, lids, crown, armR, armL, cannon, tail, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, crown, armR, armL, cannon, tail, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    tail.group.rotation.y = Math.sin(T * 1.8) * 0.25;
    crown.group.rotation.z = Math.sin(T * 2.2) * 0.05;
    armR.group.rotation.x = -0.9;
    armL.group.rotation.x = -0.9;
    armL.group.rotation.z = 0.5;
    cannon.group.rotation.x = 0.9;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, track, hold] = beats(T, c.sig, 0xc0c0);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * alert;
          torso.group.rotation.y = Math.sin(T * 0.7) * 0.3 * track;
          hips.group.position.y += -0.12 * hold;
          lid = Math.max(lid, 0.3 * hold);
        } else {
          // stand guard (0–.25) → swing cannon (.25–.5) → toss coconut (.5–.75) → reload (.75–1).
          const ph = c.p % 1;
          const swing = win(ph, 0.25, 0.5, 0.05), toss = win(ph, 0.5, 0.75, 0.05), reload = win(ph, 0.75, 1, 0.05);
          torso.group.rotation.y = Math.sin(c.t * 4) * 0.35 * swing;
          armL.group.rotation.x = -0.9 - 1.2 * toss * Math.abs(Math.sin(c.t * 6));
          head.group.rotation.x = -0.25 * toss;
          cannon.group.rotation.x = 0.9 - 0.4 * reload;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (9 + 4 * g);
        stride(w, 0.5 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        torso.group.rotation.x = 0.1 + 0.15 * g;
        tail.group.rotation.x = 0.3 * g;
        break;
      }
      case "attack": {
        // aim (0–.35) → fire (impact .45) → recoil → recover.
        const p = c.p;
        const aim = ramp(p, 0, 0.35) * (1 - ramp(p, 0.75, 1));
        const kick = bell(p, 0.42, 0.7);
        cannon.group.rotation.x = 0.9 - 0.15 * aim - 0.25 * kick;
        torso.group.rotation.x = -0.25 * kick;
        hips.group.position.z += -0.4 * kick;
        head.group.rotation.x = 0.1 * aim;
        lid = Math.max(lid, 0.4 * aim);
        break;
      }
      case "skill": {
        // brace (0–.15) → charge (.1–.35) → rapid fire (impact .55, .35–.75) → bounce → blast → finish.
        const p = c.p;
        const brace = win(p, 0, 0.92, 0.08), charge = win(p, 0.1, 0.38, 0.04), burst = win(p, 0.35, 0.78, 0.03);
        hips.group.position.y += -0.1 * brace;
        cannon.group.scale.setScalar(1 + 0.1 * charge);
        cannon.group.rotation.x = 0.9 - 0.2 * burst - Math.abs(Math.sin(c.t * 40)) * 0.15 * burst;
        torso.group.rotation.x = -0.12 * burst;
        torso.group.rotation.y = Math.sin(c.t * 6) * 0.25 * burst;
        crown.group.scale.setScalar(1 + 0.1 * charge);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.5 * k;
        torso.group.rotation.x = -0.2 * k;
        torso.group.rotation.z = shake * 0.06;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống (0–.4) → vỡ giáp dừa: cannon rolls away (.3–.6) → tan sáng (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, armR, armL, cannon } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.0 * fall + bell(p, 0.4, 0.5) * 0.12;
      for (const l of legs) l.part.group.rotation.x = -1.3 * fold;
      torso.group.rotation.x = -0.9 * lie;
      armR.group.rotation.x = -0.9 * (1 - lie);
      armL.group.rotation.x = -0.9 * (1 - lie);
      cannon.group.rotation.x = 0.9 * (1 - lie);
      head.group.rotation.x = 0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
