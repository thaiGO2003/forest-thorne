// Bò Điên Tóc Đỏ (catalog id yak_highland, kept for save compatibility) — bespoke rig from the "Bò Điên
// Tóc Đỏ" sheet. Hulking brown bull warrior on two legs with a blazing red mane, cream horns, glowing red
// eyes, a gold nose ring, white fur cuffs, heavy grey-and-gold spiked pauldrons, a gold bull medallion on
// the belt and a red loincloth.
// Idle: stand firm → snort → shake the mane · Combat idle: alert / guard stance / taunting roar ·
// Move: step → run → charge · Attack: ready → shoulder bash → ground stomp (impact) · Skill: brace →
// rage burst → red armor (impact) → taunt → harden · Hit: struck → slide back → steady · Death: falls →
// lies down → fades in red smoke. 2★ chest plate and gold horn rings; 3★ glowing flame mane and horns.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x6a3e26, furD: 0x4a2a18, muzzle: 0x8a5a3a, mane: 0xd8281e, maneD: 0x9a1a14, horn: 0xf0e4c8, eye: 0xff4030, gold: 0xe8b030,
  armor: 0x5a5a62, armorD: 0x34343a, cuff: 0xf4ece0, cloth: 0xb8201e, belt: 0x3a2418, nostril: 0x2a1408, flame: 0xff6a2a,
};
const HIP_Y = 3.1;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; mane: Part; armR: Part; armL: Part; cloth: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "yak_highland",
  motion: "ground",
  height: 12,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.65 },
  impact: { attack: 0.6, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.8, 1.0, 1.9], C.furD).box([0, 0.35, 0], [3.0, 0.45, 2.0], C.belt).box([0, 0.35, 1.02], [0.8, 0.8, 0.12], C.gold)
      .pair([0.25, 0.5, 1.1], [0.15, 0.3, 0.06], C.horn);
    const cloth = k.part("cloth", hips, [0, 0.1, 1.0]);
    cloth.box([0, -0.7, 0], [1.2, 1.4, 0.12], C.cloth).box([0, -1.35, 0.02], [1.2, 0.15, 0.1], C.gold);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.8, -0.3, 0]);
      part.box([0, -0.9, 0], [1.2, 1.7, 1.2], C.fur).box([0, -1.6, 0], [1.35, 0.5, 1.35], C.cuff).box([0, -2.2, 0.1], [1.2, 0.6, 1.4], C.furD);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.5, 0]);
    torso.box([0, 1.4, 0], [3.4, 2.8, 2.3], C.fur).box([0, 1.2, 1.17], [2.2, 1.8, 0.1], C.muzzle).box([0, 2.8, 0], [3.0, 0.4, 2.1], C.mane);
    if (star >= 2) torso.box([0, 1.5, 1.22], [2.4, 1.6, 0.12], C.armorD).box([0, 1.5, 1.3], [0.8, 0.8, 0.06], C.gold);
    const mane = k.part("mane", torso, [0, 2.9, -0.2]);
    for (const [x, y, z, s] of [[0, 0.4, -0.6, 1.6], [0.9, 0.1, -0.7, 1.1], [-0.9, 0.1, -0.7, 1.1], [0, -0.6, -1.1, 1.3], [0.7, -1.1, -1.2, 0.9], [-0.7, -1.1, -1.2, 0.9]] as const)
      mane.box([x, y, z], [s, s, s * 0.8], y > 0 ? C.mane : C.maneD);
    if (star >= 3) for (const x of [-0.9, 0, 0.9]) mane.box([x, 1.2, -0.3], [0.5, 1.1, 0.5], C.flame, { mat: "glow" });
    const head = k.part("head", torso, [0, 2.9, 0.5]);
    head.box([0, 0.8, 0.3], [2.4, 2.0, 2.0], C.fur).box([0, 0.3, 1.5], [1.6, 1.0, 0.8], C.muzzle).pair([0.4, 0.35, 1.92], [0.3, 0.3, 0.06], C.nostril)
      .box([0, -0.1, 1.95], [0.7, 0.5, 0.12], C.gold).pair([0.6, 1.2, 1.32], [0.5, 0.3, 0.06], C.eye, { mat: "glow" }).pair([0.65, 1.45, 1.34], [0.7, 0.18, 0.06], C.furD)
      .box([0, 2.0, 0.2], [2.0, 0.8, 1.6], C.mane).box([0, 2.3, -0.4], [1.4, 0.8, 1.2], C.maneD)
      .pair([1.5, 1.6, 0.2], [1.2, 0.5, 0.5], C.horn, { rot: [0, 0, 0.3], mat: star >= 3 ? "glow" : "solid" }).pair([2.1, 2.3, 0.2], [0.4, 1.0, 0.4], C.horn, { rot: [0, 0, -0.2], mat: star >= 3 ? "glow" : "solid" })
      .pair([1.4, 1.0, 0.1], [0.6, 0.35, 0.4], C.fur);
    if (star >= 2) head.pair([1.1, 1.55, 0.2], [0.35, 0.65, 0.65], C.gold);
    const lids = k.part("lids", head, [0, 1.35, 1.36]);
    lids.pair([0.6, -0.15, 0], [0.55, 0.35, 0.06], C.fur);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.9, 2.3, 0]);
      p.box([side * 0.3, -0.9, 0], [1.1, 1.9, 1.1], C.fur).box([side * 0.3, -1.6, 0], [1.25, 0.4, 1.25], C.cuff).box([side * 0.3, -2.1, 0.1], [1.2, 0.9, 1.2], C.furD)
        .box([side * 0.35, 0.1, 0], [1.6, 0.9, 1.6], C.armor).box([side * 0.35, 0.6, 0], [1.2, 0.2, 1.2], C.gold)
        .box([side * 0.6, 0.9, 0.3], [0.3, 0.5, 0.3], C.armorD).box([side * 0.6, 0.9, -0.3], [0.3, 0.5, 0.3], C.armorD);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    return { hips, torso, head, lids, mane, armR, armL, cloth, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, mane, armR, armL, cloth, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let rage = 0;
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    mane.group.rotation.x = Math.sin(T * 2.1) * 0.06;
    cloth.group.rotation.x = -Math.abs(Math.sin(T * 1.7)) * 0.1;
    armR.group.rotation.z = 0.15;
    armL.group.rotation.z = -0.15;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, guard, roar] = beats(T, c.sig, 0xb011);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * alert;
          armR.group.rotation.x = -0.9 * guard;
          armL.group.rotation.x = -0.9 * guard;
          hips.group.position.y += -0.2 * guard;
          head.group.rotation.x = -0.25 * roar;
          torso.group.scale.set(1 + 0.05 * roar, 1, 1);
          rage = roar;
        } else {
          // stand firm (0–.35) → snort (.35–.65) → shake the mane (.65–1).
          const ph = c.p % 1;
          const snort = win(ph, 0.35, 0.65, 0.05), shake = win(ph, 0.65, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.6) * 0.02;
          head.group.rotation.x = 0.15 * snort * Math.abs(Math.sin(c.t * 8));
          head.group.rotation.z = Math.sin(c.t * 16) * 0.12 * shake;
          mane.group.rotation.z = Math.sin(c.t * 16) * 0.15 * shake;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (8 + 4 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.15 + 0.25 * g;
        armR.group.rotation.x = -Math.sin(w) * 0.5;
        armL.group.rotation.x = Math.sin(w) * 0.5;
        break;
      }
      case "attack": {
        // ready (0–.35) → shoulder bash (.35–.5) → stomp (impact .6) → recover.
        const p = c.p;
        const ready = ramp(p, 0, 0.35) * (1 - ramp(p, 0.4, 0.5));
        const bash = ramp(p, 0.38, 0.5) * (1 - ramp(p, 0.55, 0.65));
        const stomp = bell(p, 0.5, 0.85);
        torso.group.rotation.y = 0.4 * ready - 0.3 * bash;
        torso.group.rotation.x = 0.1 * ready + 0.35 * bash;
        hips.group.position.z += -0.3 * ready + 0.9 * bash;
        armR.group.rotation.x = -1.6 * stomp;
        armL.group.rotation.x = -1.6 * stomp;
        hips.group.position.y += -0.25 * stomp;
        break;
      }
      case "skill": {
        // brace (0–.2) → rage burst (.15–.5) → red armor (impact .6) → taunt (.65–.85) → harden.
        const p = c.p;
        const brace = win(p, 0, 0.95, 0.08), burst = win(p, 0.15, 0.6, 0.05), armor = win(p, 0.55, 1, 0.05), taunt = win(p, 0.65, 0.88, 0.04);
        hips.group.position.y += -0.25 * brace;
        armR.group.rotation.z = 0.15 + 1.2 * burst;
        armL.group.rotation.z = -0.15 - 1.2 * burst;
        armR.group.rotation.x = -0.6 * armor;
        armL.group.rotation.x = -0.6 * armor;
        head.group.rotation.x = -0.35 * burst + 0.15 * taunt * Math.sin(c.t * 20);
        torso.group.scale.set(1 + 0.08 * burst + 0.04 * armor, 1 + 0.04 * burst, 1 + 0.06 * armor);
        rage = Math.max(burst, 0.6 * armor);
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
    mane.group.scale.setScalar(1 + 0.2 * rage);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống (0–.4) → gục on its back (.3–.6) → tan biến in red smoke (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, armR, armL } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.6 * fall + bell(p, 0.4, 0.5) * 0.15;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      torso.group.rotation.x = -1.1 * lie;
      armR.group.rotation.z = 0.15 + 0.6 * lie;
      armL.group.rotation.z = -0.15 - 0.6 * lie;
      head.group.rotation.x = 0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
