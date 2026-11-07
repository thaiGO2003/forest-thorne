// Bọ Hung Nhấm Nháp (catalog id beetle_mystic, kept for save compatibility) — bespoke rig from the
// "Bọ Hung Nhấm Nháp" sheet. Stocky dark-purple forest beetle with cream branching horns, yellow eyes,
// four clawed legs, two glowing purple sickle claws and an acorn with leaves on its back.
// Idle: watch → sniff → nibble → twitch · Combat idle: alert / hold / stalk · Move: step → step → run ·
// Attack: lunge → slash (impact) → pull back · Skill: fade (crouch) → dash → rending slash (impact) →
// nibble to heal · Hit: struck → slide back → steady · Death: collapses, legs curl → shatters.
// 2★ gold shell trim + horn tips; 3★ glowing shell runes and claw edges.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  shell: 0x4a2a6a, shellD: 0x2c1840, shellL: 0x6a4a8a, horn: 0xe8d8b0, hornD: 0xb8a070, eye: 0xffd040,
  blade: 0xb060ff, bladeL: 0xe0b0ff, claw: 0xe8d8b0, acorn: 0xb07a3a, cup: 0x6a4a2a, leaf: 0x5ab040,
  gold: 0xe8b83a, rune: 0xc080ff,
};
const BODY_Y = 2.8;

interface Arm { part: Part; side: 1 | -1 }
interface Leg { part: Part; side: 1 | -1; phase: number }
interface Parts { body: Part; head: Part; lids: Part; acorn: Part; arms: Arm[]; legs: Leg[] }

export default defineUnit<Parts>({
  id: "beetle_mystic",
  motion: "ground",
  height: 7,
  durations: { idle: 4.5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, -0.3], [3.6, 2.4, 4.0], C.shell).box([0, 1.25, -0.3], [3.0, 0.2, 3.6], C.shellL)
      .box([0, 0.5, -0.3], [0.12, 1.6, 4.06], C.shellD).box([0, -1.0, 0.2], [2.8, 0.4, 3.2], C.shellD);
    const head = k.part("head", body, [0, 0.1, 1.8]);
    head.box([0, 0, 0.6], [2.4, 1.8, 1.4], C.shellD).pair([0.6, 0.25, 1.32], [0.55, 0.45, 0.1], C.eye, { mat: "glow" })
      .pair([0.45, -0.75, 1.35], [0.3, 0.5, 0.3], C.claw).box([0, -0.3, 1.32], [0.7, 0.2, 0.08], C.shell);
    for (const s of [1, -1] as const) {
      head.box([s * 0.75, 1.5, 0.4], [0.4, 1.6, 0.4], C.horn, { rot: [0, 0, -s * 0.3] })
        .box([s * 1.25, 2.1, 0.4], [0.9, 0.3, 0.3], C.horn).box([s * 0.6, 2.4, 0.4], [0.3, 0.8, 0.3], C.hornD);
      if (star >= 2) head.box([s * 1.75, 2.35, 0.4], [0.3, 0.6, 0.3], C.gold);
    }
    const lids = k.part("lids", head, [0, 0.55, 1.36]);
    lids.pair([0.6, -0.25, 0], [0.6, 0.5, 0.06], C.shellD);
    const acorn = k.part("acorn", body, [0, 1.3, -1.0]);
    acorn.box([0, 0.75, 0], [1.3, 1.1, 1.3], C.acorn).box([0, 0.25, 0], [1.5, 0.5, 1.5], C.cup).box([0, 1.45, 0], [0.2, 0.4, 0.2], C.cup)
      .pair([0.7, 0.4, 0.5], [1.0, 0.12, 0.6], C.leaf, { rot: [0, 0.4, 0.3] }).box([0, 0.5, -0.9], [0.8, 0.12, 1.0], C.leaf);
    if (star >= 2) body.box([0, 1.0, 1.72], [3.4, 0.25, 0.1], C.gold).pair([1.82, 0.3, -0.3], [0.1, 0.25, 3.6], C.gold);
    if (star >= 3) for (const z of [-1.4, -0.2, 0.9]) body.pair([0.9, 0.9, z], [0.4, 0.4, 0.1], C.rune, { mat: "glow", rot: [-0.6, 0, 0] });
    const arms: Arm[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "armR" : "armL", body, [side * 1.5, -0.3, 1.4]);
      part.box([side * 0.3, -0.2, 0.7], [0.6, 0.6, 1.5], C.shellL).box([side * 0.35, 0.3, 1.6], [0.3, 1.4, 0.5], C.blade, { mat: "glow", rot: [-0.4, 0, 0] })
        .box([side * 0.35, 0.95, 2.15], [0.25, 0.4, 0.8], C.blade, { mat: "glow", rot: [-1.0, 0, 0] });
      if (star >= 3) part.box([side * 0.35, 0.3, 1.9], [0.12, 1.2, 0.12], C.bladeL, { mat: "glow", rot: [-0.4, 0, 0] });
      return { part, side };
    });
    const legs: Leg[] = [];
    for (const [z, phase] of [[0.4, 0], [-1.3, Math.PI]] as const) {
      for (const side of [1, -1] as const) {
        const part = k.part(`leg${side > 0 ? "R" : "L"}${z > 0 ? "F" : "B"}`, body, [side * 1.6, -0.8, z]);
        part.box([side * 0.5, -0.8, 0], [0.5, 1.8, 0.5], C.shellD).box([side * 0.6, -1.6, 0.2], [0.5, 0.3, 0.8], C.claw);
        legs.push({ part, side, phase: phase + (side > 0 ? 0 : Math.PI) });
      }
    }
    return { body, head, lids, acorn, arms, legs };
  },

  pose(r, c) {
    const { body, head, lids, acorn, arms, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const arm = (x: number, spread = 0) => { for (const a of arms) { a.part.group.rotation.x = x; a.part.group.rotation.y = a.side * spread; } };
    const walk = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + l.phase) * amp; };
    acorn.group.rotation.z = Math.sin(T * 1.4) * 0.05;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, hold, stalk] = beats(T, c.sig, 0xbee7);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * alert;
          arm(-0.3 * hold - 0.2 * stalk, 0.2 * hold);
          body.group.position.y += Math.abs(Math.sin(T * 3)) * 0.1 * stalk;
          body.group.rotation.x = 0.08 * stalk;
          walk(T * 3, 0.15 * stalk);
          lid = Math.max(lid, 0.3 * stalk);
        } else {
          // watch (0–.25) → sniff (.25–.5) → nibble (.5–.75) → twitch (.75–1).
          const ph = c.p % 1;
          const sniff = win(ph, 0.25, 0.5, 0.05), nibble = win(ph, 0.5, 0.76, 0.05), twitch = win(ph, 0.74, 1, 0.05);
          head.group.rotation.y = Math.sin(T * 0.7) * 0.25 * (1 - nibble);
          head.group.rotation.x = Math.sin(T * 8) * 0.06 * sniff + 0.25 * nibble;
          arm(-0.5 * nibble + Math.sin(T * 10) * 0.1 * nibble, -0.2 * nibble);
          body.group.scale.set(1, 1 + Math.sin(T * 1.8) * 0.03, 1);
          acorn.group.rotation.x = Math.sin(T * 12) * 0.08 * twitch;
          lid = Math.max(lid, 0.4 * nibble);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (8 + 6 * g);
        walk(w, 0.35 + 0.15 * g);
        body.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        body.group.rotation.x = 0.06 + 0.1 * g;
        body.group.rotation.z = Math.sin(w) * 0.04;
        arm(-0.2 - 0.2 * g, 0.1);
        break;
      }
      case "attack": {
        // lunge (0–.4) → slash (impact .5) → pull back.
        const p = c.p;
        const wind = ramp(p, 0, 0.4) * (1 - ramp(p, 0.42, 0.5));
        const slash = ramp(p, 0.42, 0.5) * (1 - ramp(p, 0.65, 0.95));
        body.group.position.z += 1.0 * wind + 0.6 * slash;
        body.group.rotation.x = 0.1 * slash;
        arm(-0.9 * wind + 0.5 * slash, 0.3 * wind - 0.2 * slash);
        walk(p * 20, 0.2 * wind);
        lid = Math.max(lid, 0.3 * wind);
        break;
      }
      case "skill": {
        // fade/crouch (0–.25) → dash (.2–.45) → rending slash (impact .6) → nibble to heal (.7–1).
        const p = c.p;
        const fade = win(p, 0, 0.3, 0.06), dash = win(p, 0.2, 0.62, 0.05);
        const slash = win(p, 0.5, 0.72, 0.03), nibble = win(p, 0.7, 1, 0.06);
        body.group.position.y += -0.2 * fade;
        body.group.scale.setScalar(1 - 0.08 * fade);
        body.group.position.z += 2.2 * dash;
        walk(p * 30, 0.4 * dash);
        arm(-1.0 * dash + 1.2 * slash - 0.5 * nibble, 0.4 * dash - 0.3 * slash);
        head.group.rotation.x = 0.3 * nibble + Math.sin(c.t * 18) * 0.05 * nibble;
        lid = Math.max(lid, 0.6 * fade);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.6 * k;
        body.group.rotation.x = -0.12 * k;
        body.group.rotation.z = shake * 0.06;
        arm(-0.4 * k, 0.3 * k);
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Gục xuống: legs give way (0–.35) → co giật: legs curl and twitch (.3–.6) → tan biến (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, head, lids, arms, legs } = r;
      const p = c.p;
      const curl = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.42);
      body.group.position.y += -1.2 * drop + bell(p, 0.35, 0.45) * 0.15;
      for (const l of legs) l.part.group.rotation.z = l.side * (1.35 * curl + Math.sin(c.t * 40) * 0.08 * bell(p, 0.35, 0.65));
      for (const a of arms) { a.part.group.rotation.x = -0.5 * curl; a.part.group.rotation.y = a.side * 0.5 * curl; }
      head.group.rotation.x = 0.25 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.4), bell(p, 0, 0.08));
    },
  },
});
