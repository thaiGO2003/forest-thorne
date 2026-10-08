// Quạ Phi Tiêu (crow_storm) — airborne crow archer with layered flight feathers and chromatic darts.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  black: 0x23252b, blackL: 0x3b4050, blackD: 0x121419, beak: 0x696154, eye: 0xd9f5ff,
  claw: 0x6b6253, red: 0xe24d4d, blue: 0x4fa5e8, gold: 0xe0b84d, storm: 0x8fd8ff,
};

interface CrowParts {
  body: Part; chest: Part; head: Part; beak: Part; wings: Part[]; tail: Part[];
  talons: Part[]; dartRack: Part; dartHand: Part;
}

export default defineUnit<CrowParts>({
  id: "crow_storm",
  motion: "fly",
  height: 10,
  durations: { idle: 3.8, attack: 0.78, skill: 1.45, hit: 0.46, move: 0.62 },
  impact: { attack: 0.55, skill: 0.63 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 6.0, -0.6]);
    body.box([0, 0, 0], [3.7, 4.1, 4.3], C.black)
      .box([0, -0.65, 1.1], [2.8, 2.2, 2.1], C.blackL);

    const chest = k.part("chest", body, [0, 0.45, 1.55]);
    chest.box([0, 0, 0.3], [3.4, 3.4, 2.7], C.blackL)
      .box([0, -0.35, 1.1], [2.2, 1.6, 1.2], C.black);

    const head = k.part("head", chest, [0, 1.65, 1.35]);
    head.box([0, 0, 0.2], [2.9, 2.8, 2.9], C.black)
      .pair([0.83, 0.35, 1.48], [0.34, 0.42, 0.18], C.eye, { mat: "glow" });

    const beak = k.part("beak", head, [0, -0.2, 1.55]);
    beak.box([0, 0, 0.85], [1.35, 0.85, 1.9], C.beak)
      .box([0, -0.26, 1.6], [0.9, 0.25, 0.65], C.blackD);

    const wings: Part[] = [];
    for (const side of [-1, 1] as const) {
      const w = k.part(`wing${side}`, body, [side * 1.75, 0.45, 0.1]);
      w.box([side * 1.15, 0, 0], [2.8, 0.8, 4.2], C.blackL, { rot: [0, 0, side * 0.12] })
        .box([side * 2.5, -0.1, -0.55], [2.1, 0.55, 4.9], C.black, { rot: [0.05, 0, side * 0.18] })
        .box([side * 3.45, -0.25, -1.2], [1.5, 0.38, 4.4], C.blackD, { rot: [0.08, 0, side * 0.22] });
      wings.push(w);
    }

    const tail: Part[] = [];
    for (const [i, x] of [[0, -0.8], [1, 0], [2, 0.8]] as const) {
      const t = k.part(`tail${i}`, body, [x, -0.3, -2.3]);
      t.box([x * 0.35, -0.2, -1.75], [1.0, 0.48, 3.8], i === 1 ? C.blackD : C.blackL, { rot: [0.15, 0, x * 0.16] });
      tail.push(t);
    }

    const talons: Part[] = [];
    for (const side of [-1, 1] as const) {
      const leg = k.part(`talon${side}`, body, [side * 0.9, -1.9, 0.5]);
      leg.box([0, -0.55, 0], [0.45, 1.25, 0.45], C.claw)
        .box([0, -1.05, 0.55], [1.05, 0.25, 1.2], C.claw);
      talons.push(leg);
    }

    const dartRack = k.part("dartRack", body, [-1.55, 0.4, -0.2]);
    dartRack.box([0, 0, 0], [0.55, 2.8, 1.8], C.blackD)
      .box([-0.1, 0.65, 0.55], [0.22, 0.22, 2.1], C.red, { rot: [0.65, 0.2, 0] })
      .box([0.05, 0, 0.55], [0.22, 0.22, 2.1], C.blue, { rot: [0.65, -0.1, 0] })
      .box([-0.05, -0.65, 0.55], [0.22, 0.22, 2.1], C.gold, { rot: [0.65, 0.12, 0] });

    const dartHand = k.part("dartHand", wings[1]!, [2.65, 0, 0.3]);
    dartHand.box([0, 0, 0.9], [0.26, 0.26, 2.35], C.red, { rot: [0.1, 0, 0] })
      .box([0, 0, 2.0], [0.75, 0.18, 0.55], C.gold);

    if (star >= 2) {
      wings[0]!.box([-3.1, 0.25, -0.5], [1.4, 0.18, 2.9], C.blue, { mat: "glow" });
      wings[1]!.box([3.1, 0.25, -0.5], [1.4, 0.18, 2.9], C.red, { mat: "glow" });
      chest.box([0, 1.55, 0.2], [2.2, 0.28, 1.8], C.gold);
    }
    if (star >= 3) {
      const storm = k.part("stormCrown", head, [0, 1.7, 0]);
      storm.pair([1.2, 0.4, 0], [0.35, 1.3, 0.35], C.storm, { rot: [0, 0, 0.35], mat: "glow" })
        .box([0, 0.9, 0], [0.4, 1.8, 0.4], C.storm, { mat: "glow" });
      tail.forEach((t, i) => t.box([0, 0.25, -2.7], [0.35, 0.18, 1.2], [C.red, C.blue, C.gold][i]!, { mat: "glow" }));
    }

    return { body, chest, head, beak, wings, tail, talons, dartRack, dartHand };
  },

  pose(r, c) {
    const flap = (a: number, rate = 1) => r.wings.forEach((w, i) => {
      w.group.rotation.z = (i ? -1 : 1) * Math.sin(c.time * 4.5 * rate) * a;
    });
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 2.1) * 0.22;
        r.head.group.rotation.y = Math.sin(c.time * 1.4) * (c.combat ? 0.08 : 0.22);
        flap(c.combat ? 0.18 : 0.28);
        r.tail.forEach((t, i) => t.group.rotation.y = Math.sin(c.time * 1.8 + i) * 0.06);
        break;
      case "move":
        r.body.group.position.y += Math.sin(c.p * Math.PI * 2) * 0.35;
        r.body.group.rotation.x = -0.18;
        flap(0.65, 1.35);
        r.talons.forEach((t) => t.group.rotation.x = 0.35);
        break;
      case "attack": {
        const s = strike(c.p, 0.55);
        r.body.group.position.z += Math.max(0, s) * 0.6;
        r.wings[1]!.group.rotation.z = -bell(c.p, 0.28, 0.7) * 0.9;
        r.dartHand.group.rotation.x = -bell(c.p, 0.34, 0.72) * 0.8;
        r.head.group.rotation.x = -s * 0.12;
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.25) * (1 - ramp(c.p, 0.88, 1));
        const chain = Math.sin(c.time * 24) * cast;
        r.body.group.rotation.z = chain * 0.06;
        r.wings[0]!.group.rotation.z = 0.65 * cast;
        r.wings[1]!.group.rotation.z = -1.0 * cast - chain * 0.08;
        r.dartRack.group.rotation.y = chain * 0.16;
        r.dartHand.group.position.z += bell(c.p, 0.32, 0.78) * 0.9;
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.65;
        r.body.group.rotation.z = h * 0.18;
        r.head.group.rotation.x = h * 0.3;
        r.wings.forEach((w, i) => w.group.rotation.z = (i ? 1 : -1) * h * 0.65);
        break;
      }
    }
  },
});
