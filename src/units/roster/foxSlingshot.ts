// Cáo Ná Thun (catalog id fox_flame, kept for save compatibility) — bespoke rig from the "Cáo Ná Thun"
// sheet. Chibi orange fox scout with a white muzzle and chest, amber eyes, brown aviator goggles, a leaf
// sprig on its head, a green scarf, a brown leather vest with straps, a pebble pouch, a big orange tail
// with a white tip and a wooden slingshot with a yellow band.
// Idle: stand guard → spin the slingshot → check the pouch → toss a pebble · Combat idle: ready to
// shoot / aim / hold position · Move: step → run → sprint · Attack: aim → shoot (impact) → follow-up
// shot · Skill: prepare → pull the band → rapid volley (impact) → pebble rain → reset · Hit: struck →
// slide back → steady · Death: falls → lies down → blows away in leaves. 2★ better gear (gold buckles,
// second pouch); 3★ explorer cloak, glowing band and leaf crown.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0xf07a20, furD: 0xc05a14, white: 0xfaf4ea, eye: 0xf0a020, pupil: 0x201008, leather: 0x6a4428, leatherD: 0x44301c,
  lens: 0x7ad0e0, leaf: 0x6ac040, leafD: 0x3e8a2a, scarf: 0x5aa040, wood: 0x8a5a2a, band: 0xffd84a, stone: 0x9a9aa0, gold: 0xe8b83a,
};
const HIP_Y = 2.4;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; tail: Part; armR: Part; armL: Part; sling: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "fox_flame",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 1.7, hit: 0.5, move: 0.55 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.0, 0.8, 1.4], C.leatherD).pair([1.1, -0.1, 0.3], [0.5, 0.8, 0.8], C.leather).pair([1.36, -0.1, 0.3], [0.06, 0.4, 0.4], C.stone);
    if (star >= 2) hips.pair([1.1, -0.1, -0.5], [0.5, 0.7, 0.6], C.leather).box([0, 0.1, 0.72], [0.5, 0.45, 0.08], C.gold);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.65, 0, 0]);
      part.box([0, -1.0, 0], [0.9, 1.8, 0.9], C.leather).box([0, -2.05, 0.2], [1.0, 0.5, 1.3], C.leatherD).box([0, -1.4, 0], [0.95, 0.5, 0.95], C.fur);
      return { part, side };
    });
    const tail = k.part("tail", hips, [0, 0.2, -0.8]);
    tail.box([0, 0.8, -1.0], [1.8, 2.0, 2.0], C.fur).box([0, 2.0, -1.5], [1.6, 1.4, 1.4], C.fur).box([0, 2.9, -1.6], [1.2, 0.8, 1.0], C.white);
    const torso = k.part("torso", hips, [0, 0.3, 0]);
    torso.box([0, 1.1, 0], [2.2, 2.2, 1.5], C.leather).box([0, 1.1, 0.76], [0.9, 2.0, 0.08], C.white)
      .box([0, 1.1, 0.8], [2.2, 0.25, 0.06], C.leatherD, { rot: [0, 0, 0.6] }).box([0, 0.15, 0], [2.3, 0.35, 1.6], C.leatherD);
    if (star >= 3) torso.box([0, 1.2, -0.85], [2.6, 2.4, 0.2], C.leafD).pair([1.2, 2.2, -0.6], [0.5, 0.4, 0.8], C.leafD);
    const scarf = k.part("scarf", torso, [0, 2.1, 0]);
    scarf.box([0, 0, 0], [2.1, 0.45, 1.6], C.scarf).box([0.5, -0.5, 0.75], [0.6, 0.7, 0.2], C.scarf);
    const head = k.part("head", torso, [0, 2.3, 0]);
    head.box([0, 1.3, 0], [3.0, 2.6, 2.6], C.fur).box([0, 0.75, 1.32], [1.8, 1.2, 0.1], C.white).box([0, 0.6, 1.6], [0.9, 0.7, 0.6], C.white)
      .box([0, 0.85, 1.92], [0.35, 0.25, 0.06], C.pupil).pair([0.6, 1.35, 1.38], [0.6, 0.6, 0.06], C.eye).pair([0.6, 1.3, 1.42], [0.28, 0.42, 0.04], C.pupil)
      .pair([0.65, 1.75, 1.4], [0.7, 0.15, 0.06], C.furD).pair([1.0, 3.0, -0.1], [0.9, 1.4, 0.5], C.fur).pair([1.0, 2.9, 0.05], [0.45, 0.8, 0.4], C.white)
      .pair([1.0, 3.6, -0.1], [0.5, 0.4, 0.5], C.leatherD).box([0, 2.25, 0.2], [3.1, 0.3, 2.7], C.leatherD).pair([0.65, 2.3, 1.3], [0.8, 0.6, 0.2], C.lens)
      .box([0.2, 2.8, -0.2], [1.2, 0.2, 0.6], C.leaf, { rot: [0, 0.4, 0.3] }).box([-0.4, 2.85, 0.1], [0.9, 0.2, 0.5], C.leafD, { rot: [0, -0.5, -0.3] });
    if (star >= 3) for (const x of [-0.9, 0, 0.9]) head.box([x, 2.65, 0.9], [0.5, 0.5, 0.2], C.leaf, { mat: "glow" });
    const lids = k.part("lids", head, [0, 1.65, 1.36]);
    lids.pair([0.6, -0.3, 0], [0.65, 0.6, 0.06], C.fur);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.3, 1.9, 0]);
      p.box([side * 0.2, -0.8, 0], [0.7, 1.6, 0.7], C.fur).box([side * 0.2, -1.15, 0], [0.75, 0.3, 0.75], C.leatherD).box([side * 0.2, -1.75, 0.1], [0.7, 0.6, 0.7], C.leather);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const sling = k.part("sling", armL, [-0.2, -1.75, 0.4]);
    sling.box([0, 0.3, 0], [0.3, 1.0, 0.3], C.wood).pair([0.4, 1.1, 0], [0.25, 0.8, 0.25], C.wood, { rot: [0, 0, -0.3] })
      .box([0, 1.35, -0.2], [0.9, 0.12, 0.12], C.band, { mat: star >= 3 ? "glow" : "solid" }).box([0, 1.35, -0.5], [0.35, 0.35, 0.35], C.stone);
    return { hips, torso, head, lids, tail, armR, armL, sling, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, tail, armR, armL, sling, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    // Aim: left arm holds the slingshot forward, right arm pulls the band back to the cheek.
    const aim = (k: number, pull: number) => {
      armL.group.rotation.x = -0.3 - 1.2 * k;
      armR.group.rotation.x = -0.3 - 1.1 * k + 0.5 * pull;
      armR.group.rotation.y = 0.4 * pull;
      sling.group.rotation.x = 1.2 * k;
    };
    tail.group.rotation.z = Math.sin(T * 1.6) * 0.15;
    aim(0, 0);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [ready, sight, hold] = beats(T, c.sig, 0xf0c5);
          aim(0.5 * ready + 1.0 * sight, 0.4 * sight);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * hold;
          hips.group.position.y += Math.abs(Math.sin(T * 3)) * 0.1 * hold;
          lid = Math.max(lid, 0.35 * sight);
        } else {
          // stand guard (0–.25) → spin slingshot (.25–.5) → check pouch (.5–.75) → toss a pebble (.75–1).
          const ph = c.p % 1;
          const spin = win(ph, 0.25, 0.5, 0.05), pouch = win(ph, 0.5, 0.76, 0.05), toss = win(ph, 0.74, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          armL.group.rotation.x = -0.3 - 0.6 * spin;
          sling.group.rotation.y = c.t * 12 * spin;
          armR.group.rotation.x = -0.3 + 0.2 * pouch - 1.2 * toss * Math.abs(Math.sin(c.t * 5));
          head.group.rotation.x = 0.25 * pouch - 0.2 * toss;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (10 + 5 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.15 + 0.2 * g;
        armL.group.rotation.x = Math.sin(w) * 0.5;
        armR.group.rotation.x = -Math.sin(w) * 0.5;
        tail.group.rotation.x = -0.2 * g;
        break;
      }
      case "attack": {
        // aim (0–.4) → shoot (impact .55) → follow-up.
        const p = c.p;
        const draw = ramp(p, 0, 0.45) * (1 - ramp(p, 0.75, 1));
        const pull = ramp(p, 0.1, 0.45) * (1 - ramp(p, 0.5, 0.56));
        aim(draw, pull);
        torso.group.rotation.x = -0.1 * bell(p, 0.5, 0.7);
        lid = Math.max(lid, 0.4 * pull);
        break;
      }
      case "skill": {
        // prepare (0–.2) → pull (.15–.4) → rapid volley (impact .6, three snaps) → pebble rain → reset.
        const p = c.p;
        const prep = win(p, 0, 0.85, 0.08), pull = win(p, 0.15, 0.45, 0.05);
        const volley = win(p, 0.45, 0.8, 0.03), reset = win(p, 0.82, 1, 0.06);
        const snap = volley * (0.5 + 0.5 * Math.sin(c.t * 40));
        aim(prep, 0.9 * pull + 0.6 * snap);
        torso.group.rotation.x = -0.15 * pull - 0.08 * snap;
        hips.group.position.y += -0.2 * pull;
        head.group.rotation.x = -0.1 * reset;
        lid = Math.max(lid, 0.5 * pull);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.6 * k;
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
    // Ngã xuống (0–.4) → gục: lies on its back (.3–.6) → tan biến theo lá bay (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, armR, armL } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.5 * fall + bell(p, 0.4, 0.5) * 0.15;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      torso.group.rotation.x = -1.2 * lie;
      armR.group.rotation.z = 0.6 * lie;
      armL.group.rotation.z = -0.6 * lie;
      head.group.rotation.x = 0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
