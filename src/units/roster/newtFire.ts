// Sa Giông Lửa (newt_fire) — squat fire newt with splayed toes, dorsal glands and a casting tail.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  skin: 0x2f3b35, skinL: 0x536452, belly: 0x9d8b63, eye: 0xf0c84e, toe: 0xc6b785,
  gland: 0xf56a37, flame: 0xff9b3d, hot: 0xffe878, ember: 0xc9462d, gold: 0xd6b65b,
};

interface NewtParts {
  body: Part;
  head: Part;
  jaw: Part;
  legs: { hip: Part; foot: Part; side: 1 | -1; front: boolean }[];
  tail: Part[];
  glands: Part[];
}

export default defineUnit<NewtParts>({
  id: "newt_fire",
  motion: "ground",
  height: 6,
  durations: { idle: 4.2, attack: 0.8, skill: 1.35, hit: 0.46, move: 0.64 },
  impact: { attack: 0.52, skill: 0.62 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 3.2, -0.6]);
    body.box([0, 0, -0.3], [4.2, 2.5, 5.0], C.skin)
      .box([0, -0.8, 0.3], [3.4, 0.8, 3.9], C.belly)
      .spots([0, 0.9, -0.2], [3.6, 0.4, 4.2], C.skinL, 8, 17, 0.45);

    const head = k.part("head", body, [0, 0.35, 2.4]);
    head.box([0, 0, 0.6], [4.0, 2.4, 3.2], C.skinL)
      .pair([1.2, 0.55, 1.8], [0.42, 0.5, 0.2], C.eye, { mat: "glow" });

    const jaw = k.part("jaw", head, [0, -0.75, 1.45]);
    jaw.box([0, 0, 0.7], [3.1, 0.75, 2.0], C.belly)
      .box([0, -0.2, 1.55], [2.3, 0.2, 0.65], C.ember);

    const legs: NewtParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const hip = k.part(`${front ? "front" : "hind"}Hip${side}`, body, [side * 1.7, -0.45, front ? 1.25 : -1.6]);
      hip.box([side * 0.7, -0.5, 0], [1.8, 0.7, 1.2], C.skinL, { rot: [0, 0, side * 0.34] });
      const foot = k.part(`${front ? "front" : "hind"}Foot${side}`, hip, [side * 1.35, -0.75, 0.5]);
      foot.box([0, -0.18, 0.6], [1.25, 0.42, 1.55], C.skin);
      for (const x of [-0.45, 0, 0.45]) foot.box([x, -0.18, 1.45], [0.2, 0.18, 0.65], C.toe);
      legs.push({ hip, foot, side, front });
    }

    const tail: Part[] = [];
    let tailParent = body;
    for (let i = 0; i < 3; i++) {
      const segment = k.part(`tail${i}`, tailParent, i === 0 ? [0, 0.15, -2.8] : [0, 0, -1.65]);
      segment.box([0, 0, -0.85], [2.5 - i * 0.45, 1.5 - i * 0.25, 2.1], i === 2 ? C.skinL : C.skin);
      tail.push(segment);
      tailParent = segment;
    }

    const glands: Part[] = [];
    for (let i = 0; i < 4; i++) {
      const gland = k.part(`fireGland${i}`, body, [0, 1.2, 1.2 - i * 1.15]);
      gland.box([0, 0.35, 0], [0.8, 0.9, 0.8], C.gland, { mat: "glow" })
        .box([0, 0.85, 0], [0.45, 0.8, 0.45], C.flame, { mat: "glow" });
      glands.push(gland);
    }

    if (star >= 2) {
      body.pair([1.95, 0.85, -0.5], [0.35, 0.95, 2.7], C.gold);
      glands.forEach((gland, i) => gland.box([0, 1.2, 0], [0.3, 0.7 + i * 0.08, 0.3], C.hot, { mat: "glow" }));
    }
    if (star >= 3) {
      const crown = k.part("emberCrest", head, [0, 1.35, 0.3]);
      crown.pair([0.75, 0.45, 0], [0.4, 1.15, 0.4], C.flame, { rot: [0, 0, 0.28], mat: "glow" })
        .box([0, 0.85, 0], [0.45, 1.4, 0.45], C.hot, { mat: "glow" });
      tail[1]!.pair([0.75, 0.4, -0.9], [0.35, 0.8, 0.75], C.gland, { mat: "glow" });
    }

    return { body, head, jaw, legs, tail, glands };
  },

  pose(r, c) {
    const waveTail = (amount: number) => {
      r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(c.time * 2.4 - i * 0.65) * amount; });
    };

    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.8) * 0.06 - (c.combat ? 0.18 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.9) * (c.combat ? 0.06 : 0.15);
        r.glands.forEach((gland, i) => { gland.group.scale.y = 1 + Math.sin(c.time * 3.5 + i) * 0.06; });
        waveTail(0.1);
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        r.body.group.position.y += Math.abs(Math.sin(walk)) * 0.14;
        for (const leg of r.legs) {
          const phase = walk + (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0.4 : 0);
          leg.hip.group.rotation.x = Math.sin(phase) * 0.5;
          leg.foot.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.35;
        }
        waveTail(0.2);
        break;
      }
      case "attack": {
        const lunge = strike(c.p, 0.52);
        r.body.group.position.z += Math.max(0, lunge) * 0.8;
        r.head.group.rotation.x = -Math.max(0, lunge) * 0.18;
        r.jaw.group.rotation.x = bell(c.p, 0.3, 0.7) * 0.42;
        waveTail(0.22);
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.28) * (1 - ramp(c.p, 0.84, 1));
        const pulse = bell(c.p, 0.32, 0.82);
        r.body.group.position.y -= cast * 0.22;
        r.head.group.rotation.x = -cast * 0.22;
        r.glands.forEach((gland, i) => {
          gland.group.scale.setScalar(1 + pulse * (0.18 + i * 0.03));
          gland.group.rotation.y = Math.sin(c.time * 10 + i) * cast * 0.12;
        });
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(c.time * 7 - i * 0.75) * cast * 0.3; });
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.5;
        r.body.group.rotation.z = recoil * 0.1;
        r.head.group.rotation.x = recoil * 0.28;
        waveTail(0.3 * recoil);
        break;
      }
    }
  },
});
