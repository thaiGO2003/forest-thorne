// Cừu Sừng Xung Kích (ram_charge) — compact ram with curled horns, planted hooves and a battering stance.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = { wool: 0xd9d1bb, light: 0xf0e7d2, dark: 0xa99f89, face: 0x6c5945, eye: 0x1b1713, horn: 0xc8aa72, hornD: 0x8d714b, hoof: 0x39312b, bronze: 0xc58c46, rune: 0xf1d570 };

interface RamParts {
  body: Part; chest: Part; head: Part; muzzle: Part; horns: Part[];
  legs: { leg: Part; hoof: Part; side: 1 | -1; front: boolean }[]; shoulder: Part;
}

export default defineUnit<RamParts>({
  id: "ram_charge", motion: "ground", height: 8,
  durations: { idle: 4.4, attack: 0.82, skill: 1.2, hit: 0.5, move: 0.66 },
  impact: { attack: 0.52, skill: 0.58 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 4.4, -0.8]);
    body.box([0, 0, -0.3], [5, 4.2, 5.5], C.wool).spots([0, 1.5, -0.2], [4.6, 0.5, 4.8], C.light, 12, 29, 0.55);
    const chest = k.part("chest", body, [0, 0.1, 2]);
    chest.box([0, 0, 0.3], [5.1, 4.4, 3], C.light).box([0, -1.2, 1], [3.7, 1.5, 1.2], C.dark);
    const head = k.part("head", chest, [0, 1, 2.1]);
    head.box([0, 0, 0.4], [3.4, 3, 3.1], C.face).pair([0.95, 0.45, 1.65], [0.34, 0.42, 0.18], C.eye);
    const muzzle = k.part("muzzle", head, [0, -0.55, 1.65]);
    muzzle.box([0, 0, 0.65], [2.4, 1.3, 1.8], C.dark).box([0, 0.15, 1.55], [1, 0.55, 0.45], C.face);
    const horns: Part[] = [];
    for (const side of [-1, 1] as const) {
      const horn = k.part(`horn${side}`, head, [side * 1.55, 0.8, 0.1]);
      horn.box([side * 0.65, 0.55, -0.1], [1.6, 0.8, 1], C.horn, { rot: [0.1, 0, side * 0.5] })
        .box([side * 1.2, -0.05, 0.15], [0.85, 1.6, 0.85], C.hornD, { rot: [0.25, 0, -side * 0.32] });
      horns.push(horn);
    }
    const legs: RamParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 1.65, -1.65, front ? 0.75 : -1.6]);
      leg.box([0, -0.95, 0], [1.2, 2.3, 1.25], C.face);
      const hoof = k.part(`hoof${front}${side}`, leg, [0, -1.9, 0.45]);
      hoof.box([0, -0.3, 0.5], [1.35, 0.7, 1.45], C.hoof);
      legs.push({ leg, hoof, side, front });
    }
    const shoulder = k.part("shoulderGuard", chest, [0, 1.65, 0.1]);
    shoulder.pair([2.2, 0, 0], [0.6, 1.6, 2.3], C.dark);
    if (star >= 2) {
      shoulder.pair([2.35, 0.2, 0.15], [0.35, 1.3, 2], C.bronze);
      horns.forEach((horn) => horn.box([0, 0.5, 0], [0.2, 0.9, 0.8], C.bronze));
    }
    if (star >= 3) {
      const crest = k.part("chargeCrest", head, [0, 1.75, 0]);
      crest.box([0, 0.65, 0], [0.45, 1.6, 0.45], C.rune, { mat: "glow" })
        .pair([0.8, 0.2, 0], [0.3, 1, 0.3], C.bronze, { rot: [0, 0, 0.35] });
    }
    return { body, chest, head, muzzle, horns, legs, shoulder };
  },
  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.7) * 0.07 - (c.combat ? 0.28 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.9) * (c.combat ? 0.05 : 0.12);
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        for (const leg of r.legs) {
          const phase = walk + (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0.25 : 0);
          leg.leg.group.rotation.x = Math.sin(phase) * 0.58;
          leg.hoof.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.28;
        }
        r.body.group.position.y += Math.abs(Math.sin(walk)) * 0.2;
        break;
      }
      case "attack": {
        const lunge = strike(c.p, 0.52);
        r.body.group.position.z += Math.max(0, lunge);
        r.head.group.rotation.x = -Math.max(0, lunge) * 0.28;
        r.horns.forEach((horn, i) => { horn.group.rotation.z = (i ? -1 : 1) * bell(c.p, 0.28, 0.68) * 0.08; });
        break;
      }
      case "skill": {
        const charge = ramp(c.p, 0, 0.22) * (1 - ramp(c.p, 0.9, 1));
        r.body.group.position.y -= charge * 0.35;
        r.body.group.position.z += charge * 0.7;
        r.head.group.rotation.x = -charge * 0.48;
        r.chest.group.rotation.x = -charge * 0.15;
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.55;
        r.body.group.rotation.z = recoil * 0.09;
        r.head.group.rotation.x = recoil * 0.32;
        break;
      }
    }
  },
});
