// Cáo Lửa (fox_flame) — lean fox with articulated ears, jaws, paws and a multi-lobed flame tail.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  fur: 0xc75c2e, furL: 0xef8a45, furD: 0x74331f, cream: 0xf1d3a0, eye: 0x241914,
  fang: 0xf5ead7, paw: 0x5b2c20, flame: 0xff9a36, flameHot: 0xffe06a, ember: 0xff5a2e,
  gold: 0xe9bd5c,
};

interface FoxParts {
  body: Part; chest: Part; head: Part; muzzle: Part; ears: Part[];
  legs: { leg: Part; paw: Part; side: 1 | -1; front: boolean }[];
  tail: Part[]; flameTail: Part;
}

export default defineUnit<FoxParts>({
  id: "fox_flame",
  motion: "ground",
  height: 8,
  durations: { idle: 4.1, attack: 0.82, skill: 1.25, hit: 0.46, move: 0.62 },
  impact: { attack: 0.52, skill: 0.58 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 4.2, -0.7]);
    body.box([0, 0, -0.2], [4.0, 3.6, 5.2], C.fur)
      .box([0, 1.1, -0.1], [3.4, 0.5, 4.5], C.furL);

    const chest = k.part("chest", body, [0, 0.2, 2.0]);
    chest.box([0, 0, 0.25], [3.9, 3.8, 2.8], C.furL)
      .box([0, -0.7, 1.2], [2.4, 2.0, 1.2], C.cream);

    const head = k.part("head", chest, [0, 1.35, 1.85]);
    head.box([0, 0, 0.35], [3.2, 2.7, 3.0], C.fur)
      .pair([0.95, 0.35, 1.6], [0.34, 0.42, 0.18], C.eye);

    const muzzle = k.part("muzzle", head, [0, -0.55, 1.65]);
    muzzle.box([0, 0, 0.75], [2.3, 1.35, 1.9], C.cream)
      .box([0, 0.25, 1.75], [0.85, 0.65, 0.55], C.paw)
      .pair([0.55, -0.55, 1.45], [0.3, 0.6, 0.32], C.fang);

    const ears: Part[] = [];
    for (const side of [-1, 1] as const) {
      const e = k.part(`ear${side}`, head, [side * 1.0, 1.45, 0.1]);
      e.box([side * 0.2, 0.9, 0], [1.0, 2.1, 0.9], C.fur, { rot: [0, 0, side * 0.18] })
        .box([side * 0.2, 0.85, 0.5], [0.48, 1.2, 0.16], C.furD);
      ears.push(e);
    }

    const legs: FoxParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 1.45, -1.45, front ? 0.85 : -1.75]);
      leg.box([0, -0.95, 0], [1.1, 2.2, 1.25], front ? C.furL : C.fur);
      const paw = k.part(`${front ? "front" : "hind"}Paw${side}`, leg, [0, -1.85, 0.45]);
      paw.box([0, -0.25, 0.45], [1.25, 0.65, 1.45], C.paw);
      legs.push({ leg, paw, side, front });
    }

    const tail: Part[] = [];
    let parent = body;
    for (let i = 0; i < 3; i++) {
      const t = k.part(`tail${i}`, parent, i === 0 ? [0, 0.5, -2.7] : [0, 0.2, -1.75]);
      t.box([0, 0.25, -0.9], [2.0 - i * 0.25, 1.9 - i * 0.2, 2.2], i === 2 ? C.cream : C.furL);
      tail.push(t);
      parent = t;
    }

    const flameTail = k.part("flameTail", tail[2]!, [0, 0.3, -1.7]);
    flameTail.box([0, 0.4, -0.8], [1.55, 2.0, 1.8], C.flame, { mat: "glow" })
      .box([0, 1.25, -1.2], [0.9, 1.6, 1.0], C.flameHot, { rot: [0.2, 0, 0.15], mat: "glow" });

    if (star >= 2) {
      chest.box([0, 1.85, 0.3], [2.8, 0.3, 2.0], C.gold);
      body.pair([1.95, 0.85, -0.2], [0.35, 1.3, 2.2], C.gold);
      flameTail.pair([0.8, 0.2, -0.7], [0.5, 1.2, 1.0], C.ember, { mat: "glow" });
    }
    if (star >= 3) {
      const crown = k.part("emberCrown", head, [0, 1.65, -0.1]);
      crown.pair([0.75, 0.5, 0], [0.45, 1.25, 0.45], C.flame, { rot: [0, 0, 0.3], mat: "glow" })
        .box([0, 0.9, 0], [0.5, 1.55, 0.5], C.flameHot, { mat: "glow" });
      tail[1]!.pair([0.8, 0.5, -0.9], [0.4, 0.8, 0.8], C.ember, { mat: "glow" });
    }

    return { body, chest, head, muzzle, ears, legs, tail, flameTail };
  },

  pose(r, c) {
    const tails = (a: number) => r.tail.forEach((t, i) => {
      t.group.rotation.y = Math.sin(c.time * 2.8 - i * 0.55) * a;
      t.group.rotation.x = Math.cos(c.time * 2.0 - i * 0.4) * a * 0.25;
    });
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 2) * 0.08 - (c.combat ? 0.2 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 1.1) * (c.combat ? 0.08 : 0.18);
        r.ears.forEach((e, i) => e.group.rotation.z = Math.sin(c.time * 3.1 + i) * 0.05);
        r.flameTail.group.scale.y = 1 + Math.sin(c.time * 5) * 0.08;
        tails(c.combat ? 0.08 : 0.16);
        break;
      case "move": {
        const w = c.p * Math.PI * 2;
        r.legs.forEach((l) => {
          const ph = w + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.4 : 0);
          l.leg.group.rotation.x = Math.sin(ph) * 0.7;
          l.paw.group.rotation.x = Math.max(0, -Math.cos(ph)) * -0.35;
        });
        r.body.group.position.y += Math.abs(Math.sin(w)) * 0.22;
        tails(0.2);
        break;
      }
      case "attack": {
        const s = strike(c.p, 0.52);
        r.body.group.position.z += Math.max(0, s) * 1.25;
        r.chest.group.rotation.x = -Math.max(0, s) * 0.18;
        r.muzzle.group.rotation.x = bell(c.p, 0.32, 0.68) * 0.45;
        r.legs[0]!.leg.group.rotation.x = -bell(c.p, 0.28, 0.68) * 0.9;
        tails(0.24);
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.25) * (1 - ramp(c.p, 0.84, 1));
        const pulse = bell(c.p, 0.3, 0.82);
        r.body.group.position.y -= cast * 0.25;
        r.chest.group.rotation.x = -cast * 0.18;
        r.flameTail.group.scale.set(1 + pulse * 0.35, 1 + pulse * 0.55, 1 + pulse * 0.35);
        r.tail.forEach((t, i) => t.group.rotation.y = Math.sin(c.time * 10 - i * 0.7) * cast * 0.28);
        r.muzzle.group.rotation.x = -cast * 0.18;
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.6;
        r.body.group.rotation.z = h * 0.12;
        r.head.group.rotation.x = h * 0.3;
        r.ears.forEach((e, i) => e.group.rotation.z = (i ? 1 : -1) * h * 0.18);
        tails(0.3 * h);
        break;
      }
    }
  },
});
