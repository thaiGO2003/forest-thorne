// Sóc Tu (catalog id fairy_forest, kept for save compatibility) — bespoke rig from the "Sóc Tu" sheet.
// Chibi forest squirrel monk with brown fur, a cream muzzle, amber eyes, tall tufted ears, a huge curled
// tail, a green robe with gold trim, an acorn-bead necklace with a talisman and a string of prayer beads.
// Idle: watch → nod → blink → turn the beads · Combat idle: watch / focus / let the spell flow ·
// Move: step → step → glide · Attack: chant → acorn bolt (impact) → follow-through ·
// Skill: focus → beads rise → seal circle (impact) → beads spread → shield · Hit: struck → stagger →
// regain balance · Death: slumps → lies still → fades into gold motes. 2★ gold talisman + more beads;
// 3★ glowing bead halo and robe runes.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x9a5a3a, furD: 0x6a3a24, cream: 0xf4dcc0, eye: 0xf0a020, pupil: 0x2a1408, robe: 0x5a7a4a, robeD: 0x3e5a34,
  gold: 0xe8c050, bead: 0xa0602a, beadD: 0x6a3a1a, paper: 0xf2e6c4, ink: 0x8a2a20, glow: 0xffe080, leaf: 0x9aff7a,
};
const HIP_Y = 1.9;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; tail: Part; beads: Part; armR: Part; armL: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "fairy_forest",
  motion: "ground",
  height: 9,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.65 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.0, 0.6, 1.6], C.robeD);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.6, 0, 0]);
      part.box([0, -0.8, 0], [0.8, 1.2, 0.8], C.fur).box([0, -1.55, 0.2], [0.9, 0.4, 1.1], C.cream);
      return { part, side };
    });
    const tail = k.part("tail", hips, [0, 0.4, -1.0]);
    tail.box([0, 1.8, -0.6], [2.0, 4.2, 1.6], C.fur).box([0, 4.2, 0.0], [2.2, 1.5, 2.2], C.fur)
      .box([0, 4.3, 1.0], [1.8, 1.0, 0.6], C.cream).box([0, 1.8, -1.42], [1.4, 3.6, 0.1], C.furD);
    const torso = k.part("torso", hips, [0, 0.3, 0]);
    torso.box([0, 1.1, 0], [2.4, 2.2, 1.8], C.robe).box([0, 0.1, 0], [2.6, 0.9, 2.0], C.robe)
      .box([0, 1.2, 0.92], [0.9, 2.0, 0.06], C.cream).box([0, 0.4, 0], [2.65, 0.25, 2.05], C.gold).box([0, 2.15, 0], [2.0, 0.3, 1.6], C.cream);
    if (star >= 3) torso.pair([0.8, 1.2, 0.93], [0.3, 0.3, 0.05], C.glow, { mat: "glow" }).pair([0.8, 0.5, 1.03], [0.3, 0.3, 0.05], C.glow, { mat: "glow" });
    // Necklace: acorn beads around the collar, a gold centre bead and a talisman.
    for (let i = -3; i <= 3; i++) torso.box([i * 0.32, 2.15 - Math.abs(i) * 0.05 - (3 - Math.abs(i)) * 0.12, 0.95 - Math.abs(i) * 0.05], [0.3, 0.3, 0.3], i % 2 ? C.beadD : C.bead);
    torso.box([0, 1.7, 1.0], [0.4, 0.4, 0.3], C.gold).box([0, 1.2, 1.0], [0.5, 0.7, 0.06], star >= 2 ? C.gold : C.paper).box([0, 1.2, 1.04], [0.15, 0.45, 0.04], C.ink);
    const head = k.part("head", torso, [0, 2.4, 0]);
    head.box([0, 1.3, 0], [3.2, 2.8, 2.6], C.fur).box([0, 0.75, 1.32], [1.6, 1.0, 0.1], C.cream).box([0, 1.0, 1.38], [0.35, 0.25, 0.06], C.furD)
      .pair([0.75, 1.55, 1.32], [0.75, 0.85, 0.06], C.eye).pair([0.75, 1.5, 1.36], [0.4, 0.6, 0.04], C.pupil).pair([0.6, 1.75, 1.39], [0.2, 0.2, 0.03], C.cream)
      .pair([1.1, 3.2, -0.2], [0.8, 1.6, 0.6], C.fur).pair([1.1, 3.1, -0.05], [0.4, 1.0, 0.35], C.cream).pair([1.15, 4.1, -0.2], [0.4, 0.5, 0.4], C.furD)
      .pair([1.65, 0.9, 0.3], [0.2, 0.9, 1.4], C.cream);
    const lids = k.part("lids", head, [0, 1.98, 1.36]);
    lids.pair([0.75, -0.42, 0], [0.8, 0.85, 0.06], C.fur);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.3, 1.8, 0]);
      p.box([side * 0.15, -0.7, 0], [0.7, 1.4, 0.7], C.robe).box([side * 0.15, -1.0, 0], [0.75, 0.25, 0.75], C.gold).box([side * 0.15, -1.55, 0.1], [0.6, 0.5, 0.6], C.fur);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const beads = k.part("beads", armR, [0.15, -1.6, 0.5]);
    const n = star >= 2 ? 6 : 4;
    for (let i = 0; i < n; i++) beads.box([0, -0.35 * i, 0.05 * i], [0.32, 0.32, 0.32], i % 2 ? C.beadD : C.bead, { mat: star >= 3 ? "glow" : "solid" });
    if (star >= 3) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        head.box([Math.cos(a) * 2.4, 1.5 + Math.sin(a) * 2.4, -1.6], [0.35, 0.35, 0.2], C.glow, { mat: "glow" });
      }
    }
    return { hips, torso, head, lids, tail, beads, armR, armL, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, tail, beads, armR, armL, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    tail.group.rotation.z = Math.sin(T * 1.3) * 0.1;
    tail.group.rotation.x = Math.sin(T * 1.7) * 0.05;
    armR.group.rotation.x = -0.7;
    beads.group.rotation.x = 0.7 + Math.sin(T * 2) * 0.1;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, focus, flow] = beats(T, c.sig, 0x50c7);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * watch;
          armL.group.rotation.x = -0.8 * focus;
          armL.group.rotation.z = -0.3 * focus;
          lid = Math.max(lid, 0.5 * focus);
          hips.group.position.y += 0.3 * flow + Math.sin(T * 3) * 0.08 * flow;
          beads.group.rotation.z = Math.sin(T * 6) * 0.3 * flow;
        } else {
          // watch (0–.25) → nod (.25–.5) → blink (.5–.75) → turn the beads (.75–1).
          const ph = c.p % 1;
          const nod = win(ph, 0.25, 0.5, 0.05), blink = win(ph, 0.5, 0.76, 0.05), turn = win(ph, 0.74, 1, 0.05);
          head.group.rotation.y = Math.sin(T * 0.6) * 0.2 * (1 - nod);
          head.group.rotation.x = Math.max(0, Math.sin(c.t * 7)) * 0.2 * nod;
          lid = Math.max(lid, bell(blink, 0.2, 0.8));
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          beads.group.rotation.y = c.t * 6 * turn;
          armR.group.rotation.x = -0.7 - 0.2 * turn;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (9 + 4 * g);
        stride(w, 0.45 * (1 - 0.5 * g));
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.15 + 0.3 * g;
        torso.group.rotation.x = 0.1 + 0.1 * g;
        tail.group.rotation.x = -0.15 * g + Math.sin(w) * 0.06;
        armL.group.rotation.x = Math.sin(w) * 0.3;
        break;
      }
      case "attack": {
        // chant (0–.4) → acorn bolt (impact .55) → follow-through.
        const p = c.p;
        const chant = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const cast = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.72, 1));
        armL.group.rotation.x = -0.9 * chant - 1.3 * cast;
        armR.group.rotation.x = -0.7 - 0.3 * chant;
        head.group.rotation.x = 0.15 * chant - 0.1 * cast;
        torso.group.rotation.x = 0.15 * cast;
        lid = Math.max(lid, 0.6 * chant);
        break;
      }
      case "skill": {
        // focus (0–.25) → beads rise (.2–.45) → seal circle (impact .6) → beads spread → shield (.8–1).
        const p = c.p;
        const focus = win(p, 0, 0.3, 0.06), rise = win(p, 0.2, 0.75, 0.05);
        const seal = win(p, 0.5, 0.75, 0.04), shield = win(p, 0.78, 1, 0.06);
        armL.group.rotation.x = -1.0 * focus - 1.6 * rise;
        armR.group.rotation.x = -0.7 - 1.0 * rise;
        beads.group.rotation.y = c.t * 10 * rise;
        hips.group.position.y += 0.5 * seal + 0.2 * shield;
        torso.group.rotation.x = -0.15 * rise;
        tail.group.rotation.x = -0.2 * shield;
        lid = Math.max(lid, 0.8 * focus);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.5 * k;
        torso.group.rotation.x = -0.2 * k;
        torso.group.rotation.z = shake * 0.08;
        head.group.rotation.z = 0.15 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Gục xuống (0–.35) → nằm yên: curls up on its side (.25–.6) → tan biến thành hạt vàng (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, tail, legs, armR, beads } = r;
      const p = c.p;
      // Keep the bead string clutched to the chest so the 3★ string never drags through the tile.
      armR.group.rotation.x = -0.9;
      beads.group.rotation.x = 0.9;
      const fold = ramp(p, 0, 0.25), slump = ramp(p, 0.1, 0.38), curl = ramp(p, 0.25, 0.6);
      hips.group.position.y += -0.9 * slump;
      for (const l of legs) l.part.group.rotation.x = -1.3 * fold;
      torso.group.rotation.z = 0.9 * curl;
      torso.group.position.x += 0.4 * curl;
      head.group.rotation.z = -0.3 * curl;
      tail.group.rotation.z = 0.6 * curl;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.4), bell(p, 0, 0.08));
    },
  },
});
