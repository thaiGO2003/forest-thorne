// Tam Giác Long Xung Phong (triceratops_charge) — heavy horned charger with a broad frill and planted feet.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = { hide: 0x6b7152, light: 0x92986d, belly: 0xb3ae82, dark: 0x3e4435, horn: 0xe2d7b7, hoof: 0x393b31, bronze: 0xb98542, rune: 0xf0c95c };
interface TriceratopsParts {
  body: Part; chest: Part; head: Part; frill: Part; horns: Part[];
  legs: { leg: Part; foot: Part; side: 1 | -1; front: boolean }[]; tail: Part[];
}

export default defineUnit<TriceratopsParts>({
  id: "triceratops_charge", motion: "ground", height: 9,
  durations: { idle: 4.8, attack: 0.82, skill: 1.26, hit: 0.5, move: 0.7 },
  impact: { attack: 0.54, skill: 0.6 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 4.5, -1]);
    body.box([0, 0, -0.4], [6.2, 4.2, 7], C.hide).box([0, -1.35, 0], [4.8, 1.1, 5.4], C.belly);
    const chest = k.part("chest", body, [0, 0.15, 2.7]);
    chest.box([0, 0, 0.5], [6.4, 4.4, 3.5], C.light).box([0, 1.5, 0.2], [5.2, 0.55, 2.5], C.dark);

    const head = k.part("head", chest, [0, 0.65, 2.5]);
    head.box([0, 0, 0.65], [4.8, 3.4, 3.8], C.light).box([0, -0.7, 2], [3.2, 1.35, 1.2], C.belly);
    const frill = k.part("frill", head, [0, 1.15, -0.5]);
    frill.box([0, 0.6, -0.15], [6.8, 4.2, 0.8], C.hide)
      .pair([2.55, 1.1, -0.2], [1.05, 1.8, 0.9], C.dark, { rot: [0, 0, 0.3] });

    const horns: Part[] = [];
    for (const side of [-1, 1] as const) {
      const browHorn = k.part(`browHorn${side}`, head, [side * 1.35, 1.05, 1.55]);
      browHorn.box([0, 0.25, 1.2], [0.62, 0.62, 2.8], C.horn, { rot: [-0.45, 0, side * 0.04] });
      horns.push(browHorn);
    }
    const noseHorn = k.part("noseHorn", head, [0, 0.05, 2.25]);
    noseHorn.box([0, 0.15, 0.95], [0.55, 0.55, 2.1], C.horn, { rot: [-0.35, 0, 0] });
    horns.push(noseHorn);

    const legs: TriceratopsParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 2.05, -1.55, front ? 0.65 : -1.95]);
      leg.box([0, -1.05, 0], [1.7, 2.8, 1.9], front ? C.light : C.hide);
      const foot = k.part(`foot${front}${side}`, leg, [0, -2.1, 0.5]);
      foot.box([0, -0.35, 0.55], [1.9, 0.8, 1.8], C.hoof);
      legs.push({ leg, foot, side, front });
    }

    const tail: Part[] = [];
    let tailParent = body;
    for (let i = 0; i < 3; i++) {
      const segment = k.part(`tail${i}`, tailParent, i === 0 ? [0, 0.15, -3.7] : [0, -0.1, -1.6]);
      segment.box([0, 0, -0.8], [1.8 - i * 0.35, 1.55 - i * 0.25, 2], C.hide);
      tail.push(segment);
      tailParent = segment;
    }

    if (star >= 2) {
      frill.pair([2.4, 1.25, 0], [0.45, 1.7, 0.95], C.bronze, { rot: [0, 0, 0.28] });
      horns.forEach((horn) => horn.box([0, 0.15, 0.45], [0.72, 0.72, 0.55], C.bronze));
      chest.pair([2.65, 0.8, 0.6], [0.45, 1.15, 2.1], C.bronze);
    }
    if (star >= 3) {
      const crest = k.part("chargeRune", frill, [0, 2.05, 0]);
      crest.box([0, 0.65, 0], [0.48, 1.55, 0.48], C.rune, { mat: "glow" })
        .pair([1.05, 0.25, 0], [0.38, 1, 0.38], C.bronze, { rot: [0, 0, 0.35] });
      tail[1]!.pair([0.65, 0.55, -0.9], [0.35, 0.9, 0.7], C.rune, { mat: "glow" });
    }
    return { body, chest, head, frill, horns, legs, tail };
  },


  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.45) * 0.06 - (c.combat ? 0.22 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.72) * (c.combat ? 0.04 : 0.1);
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(c.time * 1.1 - i * 0.5) * 0.08; });
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        for (const leg of r.legs) {
          const phase = walk + (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0.3 : 0);
          leg.leg.group.rotation.x = Math.sin(phase) * 0.48;
          leg.foot.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.24;
        }
        r.body.group.position.y += Math.abs(Math.sin(walk)) * 0.16;
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(walk - i * 0.6) * 0.12; });
        break;
      }
      case "attack": {
        const drive = strike(c.p, 0.54);
        r.body.group.position.z += Math.max(0, drive) * 0.75;
        r.head.group.rotation.x = -Math.max(0, drive) * 0.32;
        r.frill.group.rotation.x = -Math.max(0, drive) * 0.08;
        break;
      }
      case "skill": {
        const brace = ramp(c.p, 0, 0.24) * (1 - ramp(c.p, 0.91, 1));
        const impact = bell(c.p, 0.34, 0.7);
        r.body.group.position.y -= brace * 0.32;
        r.body.group.position.z += brace * 0.6 + impact * 0.5;
        r.chest.group.rotation.x = -brace * 0.14;
        r.head.group.rotation.x = -brace * 0.46 + impact * 0.18;
        r.horns.forEach((horn, i) => { horn.group.rotation.z = (i === 0 ? 1 : i === 1 ? -1 : 0) * impact * 0.06; });
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.48;
        r.body.group.rotation.z = recoil * 0.08;
        r.head.group.rotation.x = recoil * 0.26;
        r.tail.forEach((segment, i) => { segment.group.rotation.y = recoil * (i % 2 ? -0.12 : 0.12); });
        break;
      }
    }
  },
});
