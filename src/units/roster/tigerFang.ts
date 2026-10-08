// Hổ Nanh Xé (tiger_fang) — striped feline bruiser with pronounced fangs, paws and a segmented tail.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = { fur: 0xd77b2f, light: 0xf2a54f, belly: 0xecc995, stripe: 0x2a211d, eye: 0xf4d44d, fang: 0xf1eadc, claw: 0xd7c6ae, gold: 0xd9aa48, ember: 0xff8b3a };
interface TigerParts {
  body: Part; chest: Part; head: Part; jaw: Part;
  paws: { leg: Part; paw: Part; side: 1 | -1; front: boolean }[];
  tail: Part[]; fangs: Part[];
}

export default defineUnit<TigerParts>({
  id: "tiger_fang", motion: "ground", height: 8,
  durations: { idle: 4.3, attack: 0.72, skill: 1.18, hit: 0.46, move: 0.6 },
  impact: { attack: 0.48, skill: 0.58 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 4.1, -0.8]);
    body.box([0, 0, -0.3], [4.8, 3.2, 5.8], C.fur).box([0, -1.05, 0.15], [3.4, 0.9, 4.2], C.belly);
    for (let i = 0; i < 4; i++) body.pair([1.9, 0.65, 1.45 - i * 1.05], [0.42, 1.45, 0.6], C.stripe, { rot: [0, 0, i % 2 ? 0.16 : -0.16] });

    const chest = k.part("chest", body, [0, 0.35, 2.25]);
    chest.box([0, 0, 0.55], [4.4, 3.6, 3], C.light).box([0, -1.05, 1], [3.2, 1.1, 1.6], C.belly);
    const head = k.part("head", chest, [0, 1, 2.15]);
    head.box([0, 0, 0.5], [3.6, 3, 3.2], C.light)
      .pair([1.05, 0.5, 1.75], [0.34, 0.42, 0.18], C.eye, { mat: "glow" })
      .pair([1.3, 1.25, 0.1], [0.9, 1.45, 0.5], C.fur, { rot: [0, 0, 0.45] })
      .pair([0.9, 0.95, 0.3], [0.3, 1, 0.45], C.stripe, { rot: [0, 0, 0.3] });
    head.box([0, 1.1, 0.4], [0.42, 1.15, 0.55], C.stripe);

    const jaw = k.part("jaw", head, [0, -0.7, 1.45]);
    jaw.box([0, 0, 0.7], [2.8, 1.05, 1.9], C.belly).box([0, 0.18, 1.55], [1.1, 0.6, 0.65], C.stripe);
    const fangs: Part[] = [];
    for (const side of [-1, 1] as const) {
      const fang = k.part(`fang${side}`, jaw, [side * 0.72, -0.2, 1.35]);
      fang.box([0, -0.48, 0.15], [0.34, 1.15, 0.34], C.fang, { rot: [0.18, 0, side * 0.06] });
      fangs.push(fang);
    }

    const paws: TigerParts["paws"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 1.55, -1.3, front ? 0.7 : -1.7]);
      leg.box([0, -0.9, 0], [1.25, 2.25, 1.35], C.fur);
      const paw = k.part(`paw${front}${side}`, leg, [0, -1.75, 0.55]);
      paw.box([0, -0.25, 0.55], [1.55, 0.65, 1.55], C.light)
        .pair([0.42, -0.35, 1.25], [0.2, 0.18, 0.58], C.claw);
      paws.push({ leg, paw, side, front });
    }

    const tail: Part[] = [];
    let tailParent = body;
    for (let i = 0; i < 4; i++) {
      const segment = k.part(`tail${i}`, tailParent, i === 0 ? [0, 0.25, -3] : [0, 0.05, -1.35]);
      segment.box([0, 0, -0.65], [1.15 - i * 0.14, 1.05 - i * 0.1, 1.65], i % 2 ? C.stripe : C.fur);
      tail.push(segment);
      tailParent = segment;
    }

    if (star >= 2) {
      chest.pair([1.9, 1.05, 0.45], [0.42, 1.1, 1.8], C.gold);
      fangs.forEach((fang) => fang.box([0, -0.95, 0.22], [0.42, 0.45, 0.42], C.gold));
      paws.forEach(({ paw }) => paw.box([0, 0.08, 0.2], [1.3, 0.24, 0.9], C.gold));
    }
    if (star >= 3) {
      const crown = k.part("fangCrown", head, [0, 1.55, 0.2]);
      crown.pair([0.82, 0.65, 0], [0.38, 1.35, 0.38], C.gold, { rot: [0, 0, 0.38] })
        .box([0, 0.95, 0], [0.42, 1.55, 0.42], C.ember, { mat: "glow" });
      tail[3]!.pair([0.48, 0.45, -0.7], [0.3, 0.7, 0.7], C.ember, { mat: "glow" });
    }
    return { body, chest, head, jaw, paws, tail, fangs };
  },

  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.8) * 0.06 - (c.combat ? 0.2 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.85) * (c.combat ? 0.05 : 0.13);
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(c.time * 1.4 - i * 0.55) * 0.12; });
        break;
      case "move": {
        const run = c.p * Math.PI * 2;
        for (const paw of r.paws) {
          const phase = run + (paw.front ? 0 : Math.PI) + (paw.side > 0 ? 0.35 : 0);
          paw.leg.group.rotation.x = Math.sin(phase) * 0.62;
          paw.paw.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.3;
        }
        r.body.group.position.y += Math.abs(Math.sin(run)) * 0.18;
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(run - i * 0.55) * 0.18; });
        break;
      }
      case "attack": {
        const lunge = strike(c.p, 0.48);
        const bite = bell(c.p, 0.22, 0.58);
        r.body.group.position.z += Math.max(0, lunge) * 0.9;
        r.head.group.rotation.x = -Math.max(0, lunge) * 0.22;
        r.jaw.group.rotation.x = bite * 0.5;
        break;
      }
      case "skill": {
        const sweep = ramp(c.p, 0, 0.26) * (1 - ramp(c.p, 0.9, 1));
        const slash = bell(c.p, 0.32, 0.7);
        r.body.group.position.z += sweep * 0.75;
        r.chest.group.rotation.y = -sweep * 0.22 + slash * 0.32;
        r.head.group.rotation.y = sweep * 0.18 - slash * 0.22;
        r.paws.filter((paw) => paw.front).forEach((paw) => {
          paw.leg.group.rotation.x = -sweep * 0.35 - slash * 0.55;
          paw.paw.group.rotation.x = slash * 0.4;
        });
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.55;
        r.body.group.rotation.z = recoil * 0.1;
        r.head.group.rotation.x = recoil * 0.3;
        r.tail.forEach((segment, i) => { segment.group.rotation.y = recoil * (i % 2 ? -0.18 : 0.18); });
        break;
      }
    }
  },
});
