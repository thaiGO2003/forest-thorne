// Rồng Komodo Cắn Độc (komodo_bite) — heavy monitor lizard with deep jaw, claws and toxin glands.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  scale: 0x626b43, scaleL: 0x7f8b56, scaleD: 0x3b432d, belly: 0xb0a77a, eye: 0xe0c462,
  claw: 0xd8d0b2, mouth: 0x7b3c38, fang: 0xf1ead1, toxin: 0x8bcf58, armor: 0x92724b,
};

interface KomodoParts {
  body: Part; chest: Part; head: Part; jaw: Part; tongue: Part;
  legs: { leg: Part; foot: Part; side: 1 | -1; front: boolean }[];
  tail: Part[]; glands: Part;
}

export default defineUnit<KomodoParts>({
  id: "komodo_bite",
  motion: "ground",
  height: 7,
  durations: { idle: 4.6, attack: 0.9, skill: 1.35, hit: 0.5, move: 0.72 },
  impact: { attack: 0.55, skill: 0.62 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 3.7, -1.0]);
    body.box([0, 0, -0.4], [5.0, 3.0, 6.6], C.scale)
      .box([0, -1.05, 0.15], [4.1, 0.85, 5.2], C.belly)
      .spots([0, 1.0, -0.4], [4.4, 0.5, 5.8], C.scaleL, 10, 41, 0.5);

    const chest = k.part("chest", body, [0, 0.1, 2.45]);
    chest.box([0, 0, 0.35], [4.9, 3.1, 3.0], C.scaleL)
      .box([0, -1.05, 0.7], [3.8, 0.8, 2.1], C.belly);

    const head = k.part("head", chest, [0, 0.6, 2.4]);
    head.box([0, 0, 0.8], [4.2, 2.6, 4.0], C.scale)
      .pair([1.15, 0.55, 2.6], [0.38, 0.48, 0.18], C.eye)
      .pair([1.55, -0.35, 2.5], [0.42, 0.35, 0.35], C.scaleD);

    const jaw = k.part("jaw", head, [0, -0.85, 1.85]);
    jaw.box([0, -0.2, 1.0], [3.5, 1.0, 2.8], C.mouth)
      .pair([1.1, 0.35, 1.9], [0.32, 0.65, 0.4], C.fang)
      .pair([0.45, 0.35, 2.2], [0.28, 0.7, 0.35], C.fang);

    const tongue = k.part("tongue", jaw, [0, 0.1, 2.25]);
    tongue.box([0, 0, 0.7], [0.35, 0.18, 1.6], C.mouth)
      .pair([0.24, 0, 1.45], [0.18, 0.16, 0.8], C.mouth, { rot: [0, 0.18, 0] });

    const legs: KomodoParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 2.0, -0.8, front ? 0.8 : -2.0]);
      leg.box([side * 0.8, -0.5, 0], [2.0, 0.9, 1.4], C.scaleD, { rot: [0, 0, side * 0.3] });
      const foot = k.part(`${front ? "front" : "hind"}Foot${side}`, leg, [side * 1.5, -0.75, 0.5]);
      foot.box([0, -0.25, 0.7], [1.4, 0.55, 1.8], C.scale);
      for (const x of [-0.45, 0, 0.45]) foot.box([x, -0.25, 1.75], [0.18, 0.22, 0.75], C.claw);
      legs.push({ leg, foot, side, front });
    }

    const tail: Part[] = [];
    let p = body;
    for (let i = 0; i < 3; i++) {
      const t = k.part(`tail${i}`, p, i === 0 ? [0, 0, -3.55] : [0, 0, -2.1]);
      t.box([0, 0, -1.05], [3.1 - i * 0.65, 2.0 - i * 0.35, 2.7], C.scaleD);
      tail.push(t); p = t;
    }

    const glands = k.part("toxinGlands", head, [0, 0.9, 0.4]);
    glands.pair([1.8, 0, 0.8], [0.55, 1.2, 1.3], C.toxin, { mat: "glow" });

    if (star >= 2) {
      body.pair([2.35, 1.0, -0.6], [0.45, 1.1, 3.7], C.armor);
      chest.box([0, 1.55, 0.4], [3.0, 0.35, 1.8], C.armor);
      glands.pair([2.1, 0.25, 0.6], [0.25, 0.8, 0.9], C.toxin, { mat: "glow" });
    }
    if (star >= 3) {
      for (let i = 0; i < 4; i++) body.box([0, 1.75, 1.2 - i * 1.5], [0.65, 1.25, 0.65], C.scaleD, { rot: [0.2, 0, 0] });
      tail[0]!.box([0, 1.1, -1.1], [0.5, 1.1, 0.5], C.toxin, { mat: "glow" });
    }

    return { body, chest, head, jaw, tongue, legs, tail, glands };
  },

  pose(r, c) {
    const tail = (a: number) => r.tail.forEach((t, i) => t.group.rotation.y = Math.sin(c.time * 1.8 - i * 0.55) * a);
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.6) * 0.05;
        r.head.group.rotation.y = Math.sin(c.time * 0.8) * (c.combat ? 0.05 : 0.14);
        r.tongue.group.scale.z = 1 + Math.max(0, Math.sin(c.time * 1.9)) ** 10 * 0.8;
        tail(0.08);
        break;
      case "move": {
        const w = c.p * Math.PI * 2;
        r.legs.forEach((l) => {
          const ph = w + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.45 : 0);
          l.leg.group.rotation.x = Math.sin(ph) * 0.42;
          l.foot.group.rotation.x = Math.max(0, -Math.cos(ph)) * -0.25;
        });
        r.body.group.rotation.y = Math.sin(w) * 0.05;
        tail(0.16);
        break;
      }
      case "attack": {
        const s = strike(c.p, 0.55);
        r.body.group.position.z += Math.max(0, s) * 1.2;
        r.head.group.rotation.x = -Math.max(0, s) * 0.18;
        r.jaw.group.rotation.x = bell(c.p, 0.28, 0.68) * 0.62;
        r.tongue.group.position.z += bell(c.p, 0.2, 0.45) * 0.5;
        tail(0.22);
        break;
      }
      case "skill": {
        const brace = ramp(c.p, 0, 0.28) * (1 - ramp(c.p, 0.82, 1));
        const bite = bell(c.p, 0.35, 0.8);
        r.body.group.position.y -= brace * 0.22;
        r.head.group.position.z += brace * 0.55;
        r.jaw.group.rotation.x = bite * 0.75;
        r.glands.group.scale.setScalar(1 + bite * 0.28);
        r.tongue.group.scale.z = 1 + bite * 0.6;
        tail(0.18);
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.5;
        r.body.group.rotation.z = h * 0.07;
        r.head.group.rotation.x = h * 0.28;
        r.jaw.group.rotation.x = h * 0.22;
        tail(0.25 * h);
        break;
      }
    }
  },
});
