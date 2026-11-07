// Elf Lùn Cừu (catalog id dryad_tree, kept for save compatibility) — bespoke rig from the "Elf Lùn Cừu"
// sheet. A tiny smiling elf with white braids, pointed ears and a green hood with a white flower, a
// moss-green cloak and a log-roll backpack, riding a fluffy white sheep with curled brown horns and a
// gold bell on a green bow. The elf holds a wooden staff with a glowing green spiral.
// Idle: sway → pet the sheep → yawn · Combat idle: alert / cheer allies / keep the blessing · Move:
// step → run → speed up · Attack: wave the staff → leaf wave → healing spark (impact) · Skill: call
// the sheep → heal allies → leaf shield (impact) → regen → nature blessing · Hit: struck → slide back →
// steady · Death: falls → lies sadly → fades in light. 2★ more flowers and a leaf scarf; 3★ glowing
// leaf crown and butterflies.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  wool: 0xfaf6ee, woolD: 0xe6dccc, face: 0xf4e0d0, hoof: 0x5a3a24, horn: 0xa87440, hornD: 0x7a5028, bell: 0xf0b838, bow: 0x4aa040,
  skin: 0xfae0cc, hair: 0xf4f0ec, hood: 0x3e8a3a, hoodD: 0x2a6028, flower: 0xfffaf0, pollen: 0xf8d040, wood: 0x8a5a2a, spiral: 0x8aff6a,
  pack: 0xa07040, eye: 0x3a2010, blush: 0xff9aa0, leaf: 0x6ac040,
};
const BODY_Y = 2.3;

interface Leg { part: Part; side: 1 | -1; front: boolean }
interface Parts { body: Part; sheepHead: Part; elf: Part; elfHead: Part; lids: Part; armR: Part; armL: Part; staff: Part; legs: Leg[] }

export default defineUnit<Parts>({
  id: "dryad_tree",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 1.9, hit: 0.5, move: 0.6 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const body = k.part("body", null, [0, BODY_Y, 0]);
    body.box([0, 0, 0], [3.0, 2.2, 3.6], C.wool).box([0, 0.9, 0], [2.6, 0.8, 3.2], C.woolD).pair([1.4, 0.1, 0.8], [0.6, 1.4, 1.2], C.woolD)
      .pair([1.4, 0.2, -0.9], [0.6, 1.4, 1.2], C.wool).box([0, 0.3, -1.95], [1.2, 1.0, 0.5], C.wool);
    const legs: Leg[] = [];
    for (const front of [true, false]) for (const side of [1, -1] as const) {
      const part = k.part(`leg${side > 0 ? "R" : "L"}${front ? "F" : "B"}`, body, [side * 0.9, -1.0, front ? 1.2 : -1.2]);
      part.box([0, -0.45, 0], [0.6, 0.9, 0.6], C.woolD).box([0, -1.0, 0.05], [0.65, 0.35, 0.7], C.hoof);
      legs.push({ part, side, front });
    }
    const sheepHead = k.part("sheepHead", body, [0, 0.5, 1.8]);
    sheepHead.box([0, 0.2, 0.6], [1.8, 1.6, 1.4], C.face).box([0, 1.0, 0.4], [2.0, 0.7, 1.4], C.wool)
      .pair([0.45, 0.35, 1.32], [0.35, 0.12, 0.06], C.eye).pair([0.7, -0.05, 1.32], [0.35, 0.2, 0.06], C.blush).box([0, -0.2, 1.32], [0.4, 0.15, 0.06], C.eye)
      .pair([1.15, 0.6, 0.2], [0.5, 1.0, 1.0], C.horn).pair([1.25, 0.1, 0.65], [0.45, 0.5, 0.5], C.hornD).pair([1.0, 0.25, 0.8], [0.3, 0.3, 0.3], C.horn)
      .box([0, -0.8, 0.3], [0.5, 0.5, 0.5], C.bell).box([0, -0.45, 0.2], [1.6, 0.25, 1.2], C.bow).pair([0.35, -0.45, 0.85], [0.4, 0.3, 0.1], C.bow);
    const elf = k.part("elf", body, [0, 1.3, -0.2]);
    elf.box([0, 0.7, 0], [1.6, 1.4, 1.2], C.hood).box([0, 0.05, 0], [2.0, 0.5, 1.6], C.hoodD).box([0, 0.7, 0.62], [0.5, 1.0, 0.06], C.flower)
      .box([0, 0.9, -0.95], [1.4, 1.4, 0.7], C.pack).box([0, 1.7, -0.95], [1.6, 0.6, 0.6], C.wood).pair([0.8, 1.7, -0.95], [0.08, 0.5, 0.5], C.hornD);
    if (star >= 2) elf.box([0, 1.4, 0.1], [1.7, 0.35, 1.3], C.leaf).box([0.5, 1.2, 0.68], [0.4, 0.5, 0.1], C.leaf);
    const elfHead = k.part("elfHead", elf, [0, 1.5, 0.1]);
    elfHead.box([0, 0.85, 0], [1.9, 1.7, 1.7], C.skin).pair([1.15, 0.85, -0.1], [0.6, 0.3, 0.3], C.skin, { rot: [0, 0, 0.4] })
      .pair([0.5, 0.75, 0.86], [0.35, 0.12, 0.06], C.eye).pair([0.6, 0.45, 0.86], [0.3, 0.18, 0.06], C.blush).box([0, 0.3, 0.86], [0.4, 0.15, 0.06], C.eye)
      .box([0, 1.55, -0.2], [2.0, 0.6, 1.6], C.hair).pair([0.85, 0.3, -0.3], [0.4, 1.2, 0.4], C.hair).box([0, 0.8, -0.85], [1.7, 1.4, 0.3], C.hair)
      .box([0, 1.9, -0.1], [2.1, 0.7, 1.9], C.hood).box([0, 2.45, -0.5], [1.2, 0.6, 1.0], C.hood).box([0.2, 2.9, -0.9], [0.6, 0.5, 0.6], C.hoodD, { rot: [-0.4, 0, 0] })
      .box([0.75, 2.1, 0.6], [0.6, 0.6, 0.15], C.flower).box([0.75, 2.1, 0.7], [0.2, 0.2, 0.06], C.pollen);
    if (star >= 2) elfHead.box([-0.7, 2.15, 0.62], [0.45, 0.45, 0.12], C.flower).box([0.75, 0.3, -0.3], [0.3, 0.3, 0.3], C.flower);
    if (star >= 3) for (const x of [-0.7, 0, 0.7]) elfHead.box([x, 2.45, 0.7], [0.4, 0.4, 0.15], C.leaf, { mat: "glow" });
    const lids = k.part("lids", elfHead, [0, 0.82, 0.88]);
    lids.pair([0.5, 0, 0], [0.4, 0.25, 0.06], C.skin);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", elf, [side * 0.95, 1.2, 0]);
      p.box([side * 0.1, -0.5, 0.1], [0.5, 1.0, 0.5], C.hood).box([side * 0.1, -1.1, 0.2], [0.45, 0.4, 0.45], C.skin);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const staff = k.part("staff", armR, [0.1, -1.1, 0.3]);
    staff.box([0, 0.5, 0], [0.22, 3.2, 0.22], C.wood).box([0, 2.4, 0], [0.9, 0.9, 0.3], C.wood).box([0, 2.4, 0.18], [0.5, 0.5, 0.06], C.spiral, { mat: "glow" })
      .box([0.35, 2.1, 0], [0.4, 0.2, 0.2], C.leaf);
    if (star >= 3) for (const [x, y] of [[1.3, 1.8], [-1.2, 2.6], [0.9, 3.3]] as const) staff.box([x, y, 0], [0.45, 0.3, 0.08], C.pollen, { mat: "glow" });
    return { body, sheepHead, elf, elfHead, lids, armR, armL, staff, legs };
  },

  pose(r, c) {
    const { body, sheepHead, elf, elfHead, lids, armR, armL, staff, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const gait = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + ((l.side > 0) === l.front ? 0 : Math.PI)) * amp; };
    armR.group.rotation.x = -0.6;
    staff.group.rotation.x = 0.6;
    elf.group.rotation.z = Math.sin(T * 1.4) * 0.05;
    sheepHead.group.rotation.x = Math.sin(T * 1.2) * 0.04;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [alert, cheer, bless] = beats(T, c.sig, 0xe1f5);
          elfHead.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * alert;
          armL.group.rotation.x = -2.2 * cheer + Math.sin(T * 9) * 0.2 * cheer;
          armR.group.rotation.x = -0.6 - 0.8 * bless;
          elf.group.position.y += 0.1 * cheer * Math.abs(Math.sin(T * 6));
          lid = Math.max(lid, 0.3 * bless);
        } else {
          // sway (0–.35) → pet the sheep (.35–.65) → yawn (.65–1).
          const ph = c.p % 1;
          const pet = win(ph, 0.35, 0.65, 0.05), yawn = win(ph, 0.65, 1, 0.05);
          elf.group.rotation.z = Math.sin(T * 1.4) * 0.08;
          elf.group.rotation.x = 0.25 * pet;
          armL.group.rotation.x = -0.9 * pet + Math.sin(c.t * 6) * 0.15 * pet;
          sheepHead.group.rotation.x = -0.1 * pet;
          elfHead.group.rotation.x = -0.2 * yawn;
          armL.group.rotation.x += -1.6 * yawn;
          lid = Math.max(lid, 0.8 * yawn);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (10 + 4 * g);
        gait(w, 0.45 + 0.1 * g);
        body.group.position.y += Math.abs(Math.sin(w)) * 0.15;
        elf.group.position.y += Math.abs(Math.sin(w + 0.5)) * 0.12;
        elf.group.rotation.x = 0.15 * g;
        sheepHead.group.rotation.x = 0.1 * g;
        break;
      }
      case "attack": {
        // wave staff (0–.4) → leaf wave → healing spark (impact .55).
        const p = c.p;
        const up = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.56));
        const swing = ramp(p, 0.45, 0.56) * (1 - ramp(p, 0.75, 1));
        armR.group.rotation.x = -0.6 - 1.4 * up - 0.4 * swing;
        armR.group.rotation.z = 0.4 * up - 0.3 * swing;
        elf.group.rotation.y = 0.25 * up - 0.2 * swing;
        break;
      }
      case "skill": {
        // call the sheep (0–.2) → heal (.15–.5) → leaf shield (impact .6) → regen → blessing (.8–1).
        const p = c.p;
        const call = win(p, 0, 0.3, 0.06), lift = win(p, 0.15, 0.95, 0.08), shield = win(p, 0.55, 0.8, 0.04), bless = win(p, 0.78, 1, 0.06);
        sheepHead.group.rotation.x = -0.35 * call;
        body.group.position.y += 0.2 * call;
        armR.group.rotation.x = -0.6 - 2.0 * lift;
        staff.group.rotation.x = 0.6 - 0.5 * lift;
        armL.group.rotation.z = -1.0 * shield - 0.6 * bless;
        elf.group.position.y += 0.15 * shield;
        elfHead.group.rotation.x = -0.2 * bless;
        lid = Math.max(lid, 0.8 * bless);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.position.z += -0.5 * k;
        elf.group.rotation.x = -0.25 * k;
        elf.group.rotation.z = shake * 0.08;
        sheepHead.group.rotation.x = -0.15 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống: sheep folds its legs (0–.3) → nằm buồn: lies down, elf slumps (.12–.45) → tan biến (.7–1).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { body, sheepHead, elf, lids, legs, armR } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), drop = ramp(p, 0.12, 0.45);
      for (const l of legs) l.part.group.rotation.x = (l.front ? -1.4 : 1.4) * fold;
      body.group.position.y += -0.85 * drop + bell(p, 0.45, 0.55) * 0.08;
      sheepHead.group.rotation.x = 0.35 * drop;
      elf.group.rotation.x = 0.5 * drop;
      armR.group.rotation.z = 0.6 * drop;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.45), bell(p, 0, 0.08));
    },
  },
});
