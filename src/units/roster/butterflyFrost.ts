// Sương Điệp (catalog id ice_mage, kept for save compatibility) — bespoke rig from the approved
// "Sương Điệp" sheet. Round white-and-lilac frost butterfly with big ice-blue eyes, curled antennae,
// four blue-violet wings with snowflake marks, a crystal gem on the chest and a crystal tail. Hovers.
// Idle: breathe → wing ripple → head tilt → frost aura · Combat idle: watch / glide / gather frost
// (deterministic beats) · Move: glide → glide → dash · Attack: gather frost → shard throw on impact →
// trail · Skill: charge → wings flare → sweeping frost band → ice burst (impact) → settle · Hit: struck
// → wobble → recover · Death: falls → lies flat → shatters. 2★ crystal antenna tips + wing crystals;
// 3★ ice crown and glowing wing edges.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, VOXEL, type DeathCtx } from "../rig";

const C = {
  white: 0xf4f6ff, lilac: 0xc8c0f0, blue: 0x7ea8f0, blueD: 0x4a6cc8, violet: 0x9a7ce0, ice: 0xbfefff,
  eye: 0x4ad0ff, pupil: 0x10203a, crystal: 0xb48cff, glowIce: 0xd8f6ff,
};

/** Kit-space ground for a "fly" unit (rest height 0.42 blocks). */
export const FROST_GROUND_Y = -0.42 / VOXEL;
const BODY_Y = 3.0;

interface Wing { upper: Part; lower: Part; side: 1 | -1 }
interface Parts { body: Part; head: Part; lids: Part; antL: Part; antR: Part; tail: Part; wings: Wing[] }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const win = (p: number, a: number, b: number, e: number) => ramp(p, a, a + e) * (1 - ramp(p, b - e, b));
const blinkAt = (time: number, sig: number) => bell((time + sig * 5.9) % 3.3, 0, 0.14);
function pick(n: number, sig: number, salt: number) {
  let h = Math.imul(n ^ salt, 0x85ebca6b) ^ Math.floor(sig * 7919);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) % 3;
}
const W = [0, 0, 0];
function beats(time: number, sig: number, salt: number) {
  const s = time * 0.38 + sig * 3.1, n = Math.floor(s), m = ramp(s - n, 0.72, 1);
  const a = pick(n, sig, salt), b = pick(n + 1, sig, salt);
  for (let i = 0; i < 3; i++) W[i] = (a === i ? 1 - m : 0) + (b === i ? m : 0);
}
/** Flap: upper wings lead, lower wings trail by 0.06 s; `open` spreads them flat (+) or folds up (−). */
function flap(r: Parts, time: number, rate: number, amp: number, open: number) {
  const a = Math.sin(time * rate), b = Math.sin((time - 0.06) * rate);
  for (const w of r.wings) {
    w.upper.group.rotation.y += -w.side * (0.35 - 0.3 * open + a * amp);
    w.lower.group.rotation.y += -w.side * (0.3 - 0.25 * open + b * amp * 0.8);
  }
}

export default defineUnit<Parts>({
  id: "ice_mage",
  motion: "fly",
  height: 10,
  durations: { idle: 4.5, attack: 0.85, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [1.8, 2.4, 1.8], C.white).box([0, -0.2, 0.92], [1.2, 1.6, 0.1], C.lilac)
      .box([0, 0.4, 0.98], [0.5, 0.6, 0.12], C.crystal, { mat: "glow" });
    const tail = k.part("tail", body, [0, -1.2, -0.2]);
    tail.box([0, -0.6, 0], [1.2, 1.2, 1.2], C.lilac).box([0, -1.5, 0], [0.7, 0.9, 0.7], C.violet)
      .box([0, -2.2, 0], [0.4, 0.6, 0.4], C.crystal, { mat: "glow" });
    const head = k.part("head", body, [0, 1.3, 0.2]);
    head.box([0, 1.1, 0], [2.8, 2.4, 2.4], C.white).box([0, 0.3, -0.2], [3.0, 0.8, 2.2], C.lilac)
      .pair([0.75, 1.1, 1.22], [0.9, 1.0, 0.1], C.eye).pair([0.75, 1.0, 1.28], [0.45, 0.55, 0.06], C.pupil)
      .pair([0.6, 1.35, 1.32], [0.22, 0.22, 0.04], C.white).box([0, 0.5, 1.22], [0.4, 0.15, 0.08], C.blueD);
    const lids = k.part("lids", head, [0, 1.6, 1.25]);
    lids.pair([0.75, -0.45, 0], [0.95, 1.0, 0.06], C.white);
    const ant = (side: 1 | -1) => {
      const a = k.part(side > 0 ? "antR" : "antL", head, [side * 0.6, 2.3, 0.2]);
      a.box([side * 0.2, 0.9, 0.2], [0.2, 1.8, 0.2], C.blueD, { rot: [0.3, 0, -side * 0.2] })
        .box([side * 0.55, 1.9, 0.6], [0.6, 0.6, 0.3], C.blue);
      if (star >= 2) a.box([side * 0.55, 1.9, 0.75], [0.35, 0.35, 0.1], C.crystal, { mat: "glow" });
      return a;
    };
    const antR = ant(1), antL = ant(-1);
    const wings: Wing[] = ([1, -1] as const).map((side) => {
      const upper = k.part(side > 0 ? "wingRUp" : "wingLUp", body, [side * 0.9, 0.6, -0.3]);
      upper.box([side * 2.0, 1.4, 0], [3.8, 3.4, 0.2], C.blue).box([side * 2.0, 1.4, 0.1], [2.6, 2.4, 0.06], C.lilac)
        .box([side * 2.2, 1.6, 0.14], [1.0, 1.0, 0.04], C.white).box([side * 3.6, 2.8, 0], [1.0, 1.0, 0.2], C.violet);
      const lower = k.part(side > 0 ? "wingRLo" : "wingLLo", body, [side * 0.9, -0.4, -0.3]);
      lower.box([side * 1.4, -0.9, 0], [2.6, 2.2, 0.2], C.violet).box([side * 1.4, -0.9, 0.1], [1.6, 1.4, 0.06], C.blue)
        .box([side * 2.2, -2.0, 0], [0.6, 0.8, 0.2], C.crystal);
      if (star >= 2) upper.box([side * 3.0, 0.2, 0.14], [0.5, 0.5, 0.06], C.crystal, { mat: "glow" });
      if (star >= 3) {
        upper.box([side * 2.0, 3.15, 0.12], [3.6, 0.2, 0.06], C.glowIce, { mat: "glow" });
        lower.box([side * 1.4, -2.0, 0.12], [2.4, 0.18, 0.06], C.glowIce, { mat: "glow" });
      }
      return { upper, lower, side };
    });
    if (star >= 3) {
      for (const x of [-0.7, 0, 0.7]) head.box([x, 2.55 + (x === 0 ? 0.25 : 0), 0.3], [0.35, 0.6 + (x === 0 ? 0.4 : 0), 0.35], C.ice, { mat: "glow" });
    }
    return { body, head, lids, antL, antR, tail, wings };
  },

  pose(r, c) {
    const { body, head, lids, antL, antR, tail } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const ant = (tilt: number) => {
      antL.group.rotation.z = Math.sin((T - 0.08) * 2.3) * 0.08 + tilt;
      antR.group.rotation.z = -Math.sin((T - 0.08) * 2.7 + 1) * 0.08 - tilt;
    };
    tail.group.rotation.x = Math.sin((T - 0.1) * 1.8) * 0.12;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          beats(T, c.sig, 0x2f3d);
          const watch = W[0]!, glide = W[1]!, gather = W[2]!;
          flap(r, T, 5 + 2 * glide, 0.35, 0.2 + 0.3 * gather);
          body.group.position.y += Math.cos(T * (5 + 2 * glide)) * 0.25 + 0.5 * glide;
          body.group.rotation.z = Math.sin(T * 1.2) * 0.12 * glide;
          body.group.rotation.x = 0.1 * gather;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * watch;
          head.group.scale.setScalar(1);
          ant(0.15 * gather);
          lid = Math.max(lid, 0.25 * gather);
        } else {
          // breathe (0–.25) → wing ripple (.25–.5) → head tilt (.5–.75) → frost aura (.75–1).
          const ph = c.p % 1;
          const ripple = win(ph, 0.25, 0.5, 0.05), tilt = win(ph, 0.5, 0.76, 0.05), aura = win(ph, 0.74, 1, 0.06);
          flap(r, T, 4 + 6 * ripple, 0.25 + 0.15 * ripple, 0.2 + 0.4 * aura);
          body.group.position.y += Math.cos(T * 4) * 0.25;
          body.group.scale.set(1 + Math.sin(T * 1.8) * 0.02, 1 + Math.sin(T * 1.8) * 0.03, 1);
          head.group.rotation.z = 0.3 * tilt;
          ant(0.3 * tilt);
          body.group.rotation.y = Math.sin(T * 0.5) * 0.1 + 0.4 * aura * Math.sin(c.t * 2);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const rate = 6 + 8 * g;
        flap(r, T, rate, 0.35 + 0.15 * g, 0.1 - 0.3 * g);
        body.group.position.y += Math.cos(T * rate) * 0.25;
        body.group.rotation.x = 0.15 + 0.35 * g;
        head.group.rotation.x = -0.3 * g;
        ant(-0.2 * g);
        break;
      }
      case "attack": {
        // gather frost (0–.4) → throw shards (impact .5) → trail.
        const p = c.p;
        const gather = ramp(p, 0, 0.4) * (1 - ramp(p, 0.4, 0.5));
        const throwK = ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.62, 0.9));
        flap(r, T, 6 + 6 * gather, 0.3, 0.3 * throwK - 0.2 * gather);
        body.group.position.y += 0.4 * gather;
        body.group.position.z += -0.4 * gather + 0.8 * throwK;
        body.group.rotation.x = -0.15 * gather + 0.25 * throwK;
        ant(0.2 * gather);
        lid = Math.max(lid, 0.25 * gather);
        break;
      }
      case "skill": {
        // charge (0–.25) → wings flare (.2–.4) → frost band sweep (.38–.6) → ice burst (impact .6) → settle.
        const p = c.p;
        const charge = win(p, 0, 0.3, 0.06), flare = win(p, 0.2, 0.62, 0.05);
        const sweep = win(p, 0.38, 0.62, 0.04), burst = win(p, 0.56, 0.78, 0.03);
        flap(r, T, 6 + 8 * charge, 0.25 * (1 - flare), 0.2 + 0.9 * flare);
        body.group.position.y += 1.0 * charge + 0.8 * flare;
        body.group.rotation.y = Math.sin(clamp01((p - 0.38) / 0.24) * Math.PI) * 0.8 * sweep - 0.4 * sweep;
        body.group.rotation.x = 0.15 * charge - 0.2 * burst;
        head.group.rotation.x = -0.2 * burst;
        ant(0.3 * flare);
        lid = Math.max(lid, 0.4 * charge);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        flap(r, T, 14, 0.25, -0.3 * k);
        body.group.position.y += -0.5 * k;
        body.group.position.z += -0.7 * k;
        body.group.rotation.z = 0.25 * k + shake * 0.1;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        ant(-0.3 * k);
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Rơi xuống (0–.35) → nằm yên: wings lie flat (.3–.55) → tan thành hạt băng (.7–1, rig shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, wings, tail } = r;
      const p = c.p;
      const t = clamp01(p / 0.35), fall = t * t, flat = ramp(p, 0.05, 0.32);
      // Lying: the body tips back onto the folded-flat wings; tail and wings stay above the ground.
      const restY = FROST_GROUND_Y + 1.4;
      const clear = restY + 4.0 * (1 - flat); // the hanging tail reaches ~3.7 below the body until it swings flat
      body.group.position.y = Math.max(BODY_Y + (restY - BODY_Y) * fall, Math.min(BODY_Y, clear)) + bell(p, 0.35, 0.45) * 0.3;
      body.group.rotation.x = -(Math.PI / 2) * flat;
      // Tipped onto its back the tail already lies along the ground; curl it slightly up, not down.
      tail.group.rotation.x = -0.3 * flat;
      for (const w of wings) {
        w.upper.group.rotation.y = -w.side * (0.4 - 0.4 * flat);
        w.lower.group.rotation.y = -w.side * (0.35 - 0.35 * flat);
      }
      head.group.rotation.x = 0.6 * flat;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
