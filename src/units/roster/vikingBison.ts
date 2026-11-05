// Bò Viking (catalog id buffalo_mist, kept for save compatibility) — bespoke rig from the "Bò Viking"
// sheet. A northern bison warrior on two legs: dark-brown fur, a blue-and-gold horned helmet over cream
// horns, braided white beard, a thick white fur mantle, blue pauldrons with a gold knot emblem, a long
// blue cape with the same emblem, gold belt and a huge grey war hammer with a glowing blue rune.
// Idle: stand firm → deep breath → tap the hammer · Combat idle: alert / guard stance / cover allies ·
// Move: step → run → charge · Attack: swing hammer → slam down (impact) → shockwave · Skill: gather
// strength → smash the ground → shockwave (impact) → enemy damage-down → shield dome · Hit: struck →
// slide back → steady · Death: falls → lies still → fades. 2★ chest plate and gold horn bands;
// 3★ glowing runes on hammer, helmet and cape.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x5a3622, furD: 0x3a2214, muzzle: 0x7a5236, horn: 0xf0e4c8, eye: 0x50b8ff, gold: 0xe8b030, blue: 0x2a52b8, blueD: 0x1a3478,
  white: 0xf2f0ea, whiteD: 0xcfcac0, steel: 0x8a929e, steelD: 0x5a606a, wood: 0x6a4024, rune: 0x60c8ff, nostril: 0x1e1008,
};
const HIP_Y = 3.1;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; armR: Part; armL: Part; hammer: Part; cape: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "buffalo_mist",
  motion: "ground",
  height: 12,
  durations: { idle: 4.5, attack: 0.9, skill: 1.9, hit: 0.5, move: 0.65 },
  impact: { attack: 0.55, skill: 0.55 },
  blend: 0.1,

  build(k, { star }) {
    const glow = star >= 3 ? "glow" : "solid";
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.8, 1.0, 1.9], C.furD).box([0, 0.35, 0], [3.0, 0.45, 2.0], C.gold).box([0, 0.35, 1.02], [0.8, 0.7, 0.12], C.blue)
      .box([0, -0.4, 1.0], [1.4, 0.9, 0.12], C.blueD);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.8, -0.3, 0]);
      part.box([0, -0.9, 0], [1.2, 1.7, 1.2], C.fur).box([0, -1.55, 0], [1.4, 0.45, 1.4], C.white).box([0, -1.95, 0.05], [1.3, 0.35, 1.4], C.blue)
        .box([0, -2.3, 0.1], [1.2, 0.4, 1.4], C.furD);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.5, 0]);
    torso.box([0, 1.4, 0], [3.4, 2.8, 2.3], C.fur).box([0, 1.1, 1.17], [2.0, 1.6, 0.1], C.muzzle).box([0, 2.7, 0], [3.8, 0.8, 2.6], C.white)
      .box([0, 2.3, -0.9], [3.4, 0.6, 0.8], C.whiteD);
    if (star >= 2) torso.box([0, 1.5, 1.22], [2.2, 1.5, 0.12], C.steelD).box([0, 1.5, 1.3], [0.7, 0.7, 0.06], C.gold);
    const cape = k.part("cape", torso, [0, 2.6, -1.25]);
    cape.box([0, -1.7, 0], [3.2, 3.6, 0.15], C.blue).box([0, -3.4, 0.02], [3.2, 0.25, 0.14], C.gold).box([0, -1.6, -0.1], [1.2, 1.2, 0.06], C.gold, { mat: glow })
      .box([0, -1.6, -0.12], [0.6, 0.6, 0.06], C.blueD);
    const head = k.part("head", torso, [0, 2.9, 0.5]);
    head.box([0, 0.8, 0.3], [2.4, 2.0, 2.0], C.fur).box([0, 0.3, 1.5], [1.6, 1.0, 0.8], C.muzzle).pair([0.4, 0.35, 1.92], [0.3, 0.3, 0.06], C.nostril)
      .pair([0.6, 1.15, 1.32], [0.45, 0.3, 0.06], C.eye, { mat: "glow" }).pair([0.65, 1.42, 1.34], [0.65, 0.16, 0.06], C.furD)
      .box([0, -0.4, 1.5], [1.4, 0.8, 0.6], C.white).pair([0.45, -1.0, 1.55], [0.35, 0.8, 0.35], C.whiteD).box([0, -1.4, 1.55], [0.15, 0.15, 0.4], C.gold)
      .box([0, 2.0, 0.25], [2.5, 0.9, 2.1], C.blue).box([0, 1.6, 0.25], [2.6, 0.25, 2.2], C.gold).box([0, 2.0, 1.33], [0.25, 0.9, 0.06], C.gold)
      .box([0, 2.0, 1.37], [0.4, 0.4, 0.04], C.rune, { mat: glow })
      .pair([1.6, 1.9, 0.2], [1.2, 0.5, 0.5], C.horn, { rot: [0, 0, 0.3] }).pair([2.2, 2.6, 0.2], [0.4, 1.0, 0.4], C.horn, { rot: [0, 0, -0.2] })
      .pair([1.4, 1.0, 0.1], [0.6, 0.35, 0.4], C.fur);
    if (star >= 2) head.pair([1.2, 1.75, 0.2], [0.35, 0.65, 0.65], C.gold);
    const lids = k.part("lids", head, [0, 1.3, 1.36]);
    lids.pair([0.6, -0.15, 0], [0.5, 0.35, 0.06], C.fur);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.9, 2.3, 0]);
      p.box([side * 0.3, -0.9, 0], [1.1, 1.9, 1.1], C.fur).box([side * 0.3, -1.6, 0], [1.25, 0.45, 1.25], C.blue).box([side * 0.3, -2.1, 0.1], [1.2, 0.9, 1.2], C.furD)
        .box([side * 0.35, 0.1, 0], [1.6, 0.9, 1.6], C.blue).box([side * 0.35, 0.6, 0], [1.3, 0.2, 1.3], C.gold).box([side * 0.6, 0.1, 0.81], [0.5, 0.5, 0.06], C.gold);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const hammer = k.part("hammer", armR, [0.3, -2.3, 0.4]);
    hammer.box([0, 0, 0.6], [0.3, 0.3, 3.2], C.wood).box([0, 0, 0.2], [0.4, 0.4, 0.3], C.gold).box([0, 0, 2.4], [1.6, 1.4, 1.4], C.steel)
      .box([0, 0, 1.65], [1.7, 1.5, 0.15], C.steelD).box([0, 0, 3.15], [1.7, 1.5, 0.15], C.steelD).pair([0.81, 0, 2.4], [0.06, 0.6, 0.6], C.rune, { mat: glow });
    if (star >= 3) {
      cape.pair([1.2, -1.6, -0.1], [0.12, 2.6, 0.05], C.rune, { mat: "glow" });
      hammer.box([0, 0, 3.4], [0.5, 0.5, 0.35], C.rune, { mat: "glow" });
    }
    return { hips, torso, head, lids, armR, armL, hammer, cape, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, armR, armL, hammer, cape, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    cape.group.rotation.x = 0.08 + Math.sin(T * 1.7) * 0.05;
    armR.group.rotation.z = 0.15;
    armL.group.rotation.z = -0.15;
    hammer.group.rotation.x = 0.9;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, guard, cover] = beats(T, c.sig, 0xb1c0);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * alert;
          armR.group.rotation.x = -0.7 * guard;
          hammer.group.rotation.x = 0.9 - 0.6 * guard;
          hips.group.position.y += -0.2 * guard;
          armL.group.rotation.z = -0.15 - 0.9 * cover;
          torso.group.scale.set(1 + 0.04 * cover, 1, 1);
        } else {
          // stand firm (0–.35) → deep breath (.35–.65) → tap the hammer (.65–1).
          const ph = c.p % 1;
          const breath = win(ph, 0.35, 0.65, 0.05), tap = win(ph, 0.65, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.6) * 0.02 + 0.04 * breath;
          head.group.rotation.x = -0.1 * breath;
          armR.group.rotation.x = -0.35 * tap * Math.abs(Math.sin(c.t * 7));
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (8 + 4 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.15 + 0.2 * g;
        cape.group.rotation.x = 0.3 + 0.3 * g;
        armL.group.rotation.x = Math.sin(w) * 0.5;
        break;
      }
      case "attack": {
        // swing back (0–.4) → slam (impact .55) → shockwave hold → recover.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.42, 0.55));
        const slam = ramp(p, 0.42, 0.55) * (1 - ramp(p, 0.75, 1));
        armR.group.rotation.x = -2.6 * wind - 1.1 * slam;
        hammer.group.rotation.x = 0.9 - 0.4 * wind;
        torso.group.rotation.x = -0.15 * wind + 0.3 * slam;
        torso.group.rotation.y = 0.3 * wind;
        hips.group.position.y += -0.15 * slam;
        break;
      }
      case "skill": {
        // gather (0–.3) → smash (impact .55) → shockwave (.55–.7) → debuff → shield dome (.75–1).
        const p = c.p;
        const raise = ramp(p, 0, 0.35) * (1 - ramp(p, 0.42, 0.55)), smash = ramp(p, 0.42, 0.55) * (1 - ramp(p, 0.72, 0.85));
        const shield = win(p, 0.72, 1, 0.06);
        armR.group.rotation.x = -2.8 * raise - 1.2 * smash;
        armL.group.rotation.x = -2.6 * raise - 1.0 * smash;
        torso.group.rotation.x = -0.2 * raise + 0.35 * smash;
        hips.group.position.y += -0.2 * smash;
        armL.group.rotation.z = -0.15 - 1.0 * shield;
        head.group.rotation.x = -0.2 * shield;
        torso.group.scale.set(1 + 0.06 * shield, 1 + 0.03 * shield, 1 + 0.06 * shield);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.5 * k;
        torso.group.rotation.x = -0.2 * k;
        torso.group.rotation.z = shake * 0.05;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống (0–.4) → bất động face-down (.3–.6) → tan biến (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, armR, armL, hammer } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.6 * fall + bell(p, 0.4, 0.5) * 0.15;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      torso.group.rotation.x = -1.1 * lie;
      armR.group.rotation.z = 0.15 + 0.6 * lie;
      armL.group.rotation.z = -0.15 - 0.6 * lie;
      hammer.group.rotation.x = 0.9 + 0.6 * lie;
      head.group.rotation.x = 0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
