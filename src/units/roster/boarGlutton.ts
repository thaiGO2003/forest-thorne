// Lợn Háu Ăn (catalog id bear_ancient, kept for save compatibility) — bespoke rig from the "Lợn Háu
// Ăn" sheet. Huge brown boar with a spiky red mane, a pink snout, a wide open mouth with a lolling
// tongue, cream tusks with gold rings, dark armor plates with spikes and gold studs, a red skull banner
// on the rump and a plate of meat with a bone on its back.
// Idle: stand firm → sniff → lick lips · Combat idle: watch / growl / puff up · Move: step → run → charge ·
// Attack: ready → tusk gore (impact) → bite · Skill: open wide → inhale → swallow (impact, belly swells)
// → harden → recover · Hit: struck → slide back → steady · Death: falls → lies down → fades in pink
// mist. 2★ gold armor trim and bigger meat; 3★ golden aura flames and glowing tusk rings.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x8a4a30, furD: 0x5e2e1c, belly: 0xc08a6a, mane: 0xc8302a, maneD: 0x8a1c18, snout: 0xf0a0a8, nostril: 0x8a3a40,
  mouth: 0x7a1828, tongue: 0xf06a7a, tusk: 0xf4ecd8, gold: 0xf0b030, armor: 0x4a4048, armorD: 0x2e282e, spike: 0xd8d0c8,
  banner: 0xc02a28, bone: 0xf4ecd8, meat: 0xd04a40, plate: 0xb88a3a, eye: 0x2a1408, flame: 0xffc040,
};
const BODY_Y = 3.2;

interface Leg { part: Part; side: 1 | -1; front: boolean }
interface Parts { body: Part; head: Part; jaw: Part; lids: Part; pack: Part; banner: Part; legs: Leg[] }

export default defineUnit<Parts>({
  id: "bear_ancient",
  motion: "ground",
  height: 11,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.7 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [4.0, 3.0, 5.0], C.fur).box([0, -1.2, 0.3], [3.4, 0.6, 4.0], C.belly)
      .box([0, 0.6, 0.4], [4.2, 1.4, 2.6], C.armor).pair([2.12, 0.6, 0.4], [0.1, 1.0, 2.2], C.armorD)
      .box([0, 0.1, 0], [4.15, 0.35, 5.1], star >= 2 ? C.gold : C.furD).pair([2.2, 0.9, 1.2], [0.3, 0.4, 0.3], C.spike).pair([2.2, 0.9, -0.4], [0.3, 0.4, 0.3], C.spike);
    for (const z of [2.0, 1.2, 0.4, -0.4, -1.2]) body.box([0, 1.7 + (z > 0 ? 0.2 : 0), z], [0.8, 0.9, 0.7], z % 0.8 === 0 ? C.mane : C.maneD);
    if (star >= 3) for (const [x, z] of [[1.8, 2.0], [-1.8, 2.0], [1.8, -2.0], [-1.8, -2.0]] as const) body.box([x, 1.8, z], [0.6, 1.2, 0.6], C.flame, { mat: "glow" });
    const pack = k.part("pack", body, [0, 1.6, -1.2]);
    pack.box([0, 0.15, 0], [2.6, 0.3, 2.2], C.plate).box([0, 0.6, 0], [1.6, 0.6, 1.4], C.meat).box([0, 0.92, 0], [1.0, 0.06, 0.9], C.snout)
      .box([0.6, 1.0, 0.4], [1.8, 0.25, 0.25], C.bone, { rot: [0, 0.5, 0.3] });
    if (star >= 2) pack.box([-0.6, 0.65, -0.5], [0.9, 0.5, 0.8], C.meat);
    const banner = k.part("banner", body, [0, 1.0, -2.55]);
    banner.box([0, -0.5, 0], [1.4, 1.8, 0.1], C.banner).box([0, -0.4, -0.06], [0.6, 0.6, 0.04], C.bone).box([0, 0.45, 0], [1.6, 0.15, 0.15], C.gold);
    const head = k.part("head", body, [0, 0.4, 2.5]);
    head.box([0, 0.5, 1.0], [3.4, 2.4, 2.0], C.fur).box([0, 2.0, 0.6], [1.6, 1.0, 1.6], C.mane).box([0, 2.5, 0.2], [1.0, 0.8, 1.0], C.maneD)
      .box([0, 0.9, 2.3], [1.6, 1.0, 0.8], C.snout).pair([0.4, 0.9, 2.72], [0.3, 0.4, 0.06], C.nostril)
      .pair([0.9, 1.4, 2.02], [0.35, 0.4, 0.06], C.eye).pair([0.95, 1.7, 2.02], [0.6, 0.15, 0.06], C.furD)
      .pair([1.6, 1.8, 0.6], [0.5, 0.9, 0.6], C.fur).pair([1.2, 0.4, 2.0], [0.3, 0.3, 0.06], C.mouth)
      .pair([1.3, 0.6, 2.2], [0.35, 1.4, 0.35], C.tusk, { rot: [0.3, 0, -0.25] }).pair([1.35, 0.3, 2.2], [0.45, 0.25, 0.45], C.gold, { mat: star >= 3 ? "glow" : "solid" });
    const jaw = k.part("jaw", head, [0, -0.3, 0.6]);
    jaw.box([0, -0.5, 1.1], [2.6, 0.8, 2.0], C.fur).box([0, -0.05, 1.3], [2.2, 0.2, 1.6], C.mouth).box([0, -0.0, 1.6], [1.2, 0.2, 1.2], C.tongue)
      .box([0, -0.55, 2.2], [1.0, 0.6, 0.3], C.tongue);
    const lids = k.part("lids", head, [0, 1.6, 2.04]);
    lids.pair([0.9, -0.2, 0], [0.4, 0.45, 0.06], C.fur);
    const legs: Leg[] = [];
    for (const front of [true, false]) for (const side of [1, -1] as const) {
      const part = k.part(`leg${side > 0 ? "R" : "L"}${front ? "F" : "B"}`, body, [side * 1.3, -1.2, front ? 1.5 : -1.6]);
      part.box([0, -0.7, 0], [1.2, 1.4, 1.2], C.fur).box([0, -1.5, 0.05], [1.25, 0.4, 1.3], C.furD).box([0, -0.4, 0.62], [0.7, 0.5, 0.08], C.armorD);
      legs.push({ part, side, front });
    }
    return { body, head, jaw, lids, pack, banner, legs };
  },

  pose(r, c) {
    const { body, head, jaw, lids, pack, banner, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const gait = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + ((l.side > 0) === l.front ? 0 : Math.PI)) * amp; };
    jaw.group.rotation.x = 0.25 + Math.sin(T * 1.6) * 0.05;
    banner.group.rotation.x = -Math.abs(Math.sin(T * 1.8)) * 0.15;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, growl, puff] = beats(T, c.sig, 0xb0a7);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * watch;
          jaw.group.rotation.x = 0.25 + 0.2 * growl + Math.sin(c.t * 30) * 0.03 * growl;
          head.group.rotation.x = 0.1 * growl;
          body.group.scale.set(1 + 0.08 * puff, 1 + 0.05 * puff, 1 + 0.04 * puff);
          lid = Math.max(lid, 0.4 * growl);
        } else {
          // stand firm (0–.35) → sniff (.35–.65) → lick lips (.65–1).
          const ph = c.p % 1;
          const sniff = win(ph, 0.35, 0.65, 0.05), lick = win(ph, 0.65, 1, 0.05);
          body.group.scale.set(1 + Math.sin(T * 1.5) * 0.03, 1 + Math.sin(T * 1.5) * 0.03, 1);
          head.group.rotation.x = -0.15 * sniff + Math.sin(c.t * 14) * 0.04 * sniff;
          head.group.rotation.y = Math.sin(c.t * 2) * 0.2 * sniff;
          jaw.group.rotation.x = 0.25 + 0.15 * lick * (0.5 + 0.5 * Math.sin(c.t * 9));
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (8 + 4 * g);
        gait(w, 0.4 + 0.1 * g);
        body.group.position.y += Math.abs(Math.sin(w)) * 0.18;
        head.group.rotation.x = 0.1 + 0.12 * g;
        pack.group.rotation.z = Math.sin(w) * 0.05;
        break;
      }
      case "attack": {
        // ready (0–.4) → gore (impact .55) → bite.
        const p = c.p;
        const ready = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const gore = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.7, 0.85));
        const bite = bell(p, 0.68, 1);
        head.group.rotation.x = 0.3 * ready - 0.35 * gore;
        body.group.position.z += -0.4 * ready + 1.0 * gore;
        jaw.group.rotation.x = 0.25 + 0.3 * gore - 0.25 * bite;
        break;
      }
      case "skill": {
        // open wide (0–.25) → inhale (.2–.5) → swallow (impact .6, belly swells) → harden → recover.
        const p = c.p;
        const open = win(p, 0, 0.55, 0.06), inhale = win(p, 0.2, 0.55, 0.05), gulp = win(p, 0.55, 0.85, 0.04), harden = win(p, 0.75, 1, 0.06);
        jaw.group.rotation.x = 0.25 + 0.6 * open - 0.25 * gulp;
        head.group.rotation.x = -0.25 * open + Math.sin(c.t * 25) * 0.04 * inhale;
        body.group.scale.set(1 + 0.18 * gulp + 0.06 * harden, 1 + 0.12 * gulp, 1 + 0.08 * gulp);
        body.group.position.y += 0.2 * gulp;
        lid = Math.max(lid, 0.6 * gulp);
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
    // Ngã xuống: legs splay (0–.3) → gục: belly on the tile (.12–.45) → tan biến (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, jaw, lids, legs } = r;
      const p = c.p;
      const splay = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.45);
      for (const l of legs) l.part.group.rotation.z = l.side * 1.3 * splay;
      body.group.position.y += -1.0 * drop + bell(p, 0.45, 0.55) * 0.1;
      head.group.rotation.x = 0.3 * drop;
      jaw.group.rotation.x = 0.5 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.45), bell(p, 0, 0.08));
    },
  },
});
