// Bọ Cạp Bóng Tối (scorpion_shadow) — armored scorpion with twin pincers, eight legs and a segmented venom stinger.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = { shell: 0x40364d, light: 0x67527d, dark: 0x231f2b, joint: 0x302839, eye: 0xd86cff, claw: 0x80649a, venom: 0x9a65ff, shadow: 0x5a4a79, silver: 0xaab0bd };
interface ScorpionParts {
  body: Part; head: Part; pincers: Part[]; legs: { leg: Part; side: 1 | -1; row: number }[]; tail: Part[]; stinger: Part;
}

export default defineUnit<ScorpionParts>({
  id: "scorpion_shadow", motion: "ground", height: 7,
  durations: { idle: 4.1, attack: 0.8, skill: 1.35, hit: 0.46, move: 0.62 },
  impact: { attack: 0.52, skill: 0.63 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 3.2, -0.7]);
    body.box([0, 0, -0.2], [4.8, 2.1, 5.2], C.shell).box([0, 0.75, -0.35], [4, 0.55, 4.2], C.light);
    const head = k.part("head", body, [0, 0.15, 2.45]);
    head.box([0, 0, 0.45], [3.9, 1.9, 2.7], C.light).pair([1.05, 0.35, 1.5], [0.34, 0.42, 0.2], C.eye, { mat: "glow" });
    const pincers: Part[] = [];
    for (const side of [-1, 1] as const) {
      const pincer = k.part(`pincer${side}`, head, [side * 1.65, -0.1, 1.5]);
      pincer.box([side * 1, 0, 0.6], [2.4, 0.75, 1], C.claw, { rot: [0, side * 0.12, 0] })
        .pair([side * 0.9, 0.2, 1.5], [0.45, 0.7, 1.35], C.dark);
      pincers.push(pincer);
    }
    const legs: ScorpionParts["legs"] = [];
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < 4; row++) {
        const leg = k.part(`leg${side}_${row}`, body, [side * 2.15, -0.5, 1.35 - row * 1.15]);
        leg.box([side * 1.15, -0.15, 0], [2.65, 0.42, 0.58], C.joint, { rot: [0, 0, side * (0.18 + row * 0.035)] })
          .box([side * 2.25, -0.65, 0.1], [1.25, 0.38, 0.5], C.dark, { rot: [0, 0, -side * 0.26] });
        legs.push({ leg, side, row });
      }
    }

    const tail: Part[] = [];
    let tailParent = body;
    const tailOffsets: [number, number, number][] = [
      [0, 0.7, -2.75],
      [0, 1.05, -1.35],
      [0, 1.3, -1.05],
      [0, 1.15, -0.55],
    ];
    for (let i = 0; i < tailOffsets.length; i++) {
      const segment = k.part(`tail${i}`, tailParent, tailOffsets[i]!);
      segment.box([0, 0.35, -0.45], [1.45 - i * 0.18, 1.25 - i * 0.12, 1.75 - i * 0.18], i % 2 ? C.light : C.shell);
      tail.push(segment);
      tailParent = segment;
    }
    const stinger = k.part("stinger", tailParent, [0, 1.15, -0.25]);
    stinger.box([0, 0.45, 0], [0.8, 1.35, 0.8], C.venom, { rot: [0.35, 0, 0], mat: "glow" })
      .box([0, 1.05, 0.28], [0.38, 0.75, 0.38], C.dark, { rot: [0.6, 0, 0] });

    if (star >= 2) {
      body.pair([1.8, 0.95, -0.35], [0.4, 0.55, 3.2], C.silver);
      pincers.forEach((pincer) => pincer.box([0, 0.65, 0.7], [0.42, 0.5, 1.4], C.venom, { mat: "glow" }));
      tail[1]!.box([0, 1.05, -0.45], [0.5, 0.65, 0.85], C.venom, { mat: "glow" });
    }
    if (star >= 3) {
      const crown = k.part("shadowCrown", head, [0, 1.2, 0.15]);
      crown.pair([0.85, 0.55, 0], [0.4, 1.35, 0.45], C.shadow, { rot: [0, 0, 0.35] })
        .box([0, 0.9, 0], [0.48, 1.5, 0.48], C.venom, { mat: "glow" });
      tail[2]!.pair([0.55, 0.85, -0.35], [0.34, 0.9, 0.55], C.shadow, { rot: [0, 0, 0.25] });
    }

    return { body, head, pincers, legs, tail, stinger };
  },

  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.7) * 0.05 - (c.combat ? 0.12 : 0);
        r.pincers.forEach((pincer, i) => { pincer.group.rotation.y = Math.sin(c.time * 1.2 + i * Math.PI) * 0.08; });
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(c.time * 1.35 - i * 0.45) * 0.05; });
        r.stinger.group.rotation.x = Math.sin(c.time * 1.8) * 0.05;
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        for (const leg of r.legs) {
          leg.leg.group.rotation.z = Math.sin(walk + leg.row * 0.9 + (leg.side > 0 ? Math.PI : 0)) * 0.26 * leg.side;
          leg.leg.group.rotation.x = Math.cos(walk + leg.row * 0.9) * 0.12;
        }
        r.body.group.position.y += Math.abs(Math.sin(walk * 2)) * 0.08;
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(walk - i * 0.5) * 0.08; });
        break;
      }
      case "attack": {
        const snap = strike(c.p, 0.52);
        r.body.group.position.z += Math.max(0, snap) * 0.4;
        r.pincers.forEach((pincer, i) => {
          const side = i === 0 ? -1 : 1;
          pincer.group.rotation.y = side * bell(c.p, 0.24, 0.62) * 0.42;
          pincer.group.rotation.x = -Math.max(0, snap) * 0.12;
        });
        break;
      }
      case "skill": {
        const coil = ramp(c.p, 0, 0.32) * (1 - ramp(c.p, 0.84, 1));
        const jab = bell(c.p, 0.38, 0.72);
        r.body.group.position.y -= coil * 0.18;
        r.tail.forEach((segment, i) => {
          segment.group.rotation.x = -coil * (0.18 + i * 0.07) + jab * (i >= 2 ? 0.22 : 0.08);
          segment.group.rotation.y = (i % 2 ? -1 : 1) * coil * 0.08;
        });
        r.stinger.group.rotation.x = -coil * 0.45 + jab * 0.72;
        r.stinger.group.scale.setScalar(1 + jab * 0.18);
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.48;
        r.body.group.rotation.z = recoil * 0.11;
        r.pincers.forEach((pincer, i) => { pincer.group.rotation.y = (i ? -1 : 1) * recoil * 0.18; });
        r.tail.forEach((segment, i) => { segment.group.rotation.x = recoil * (0.12 + i * 0.04); });
        break;
      }
    }
  },
});
