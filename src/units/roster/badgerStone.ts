// Lửng Đá (badger_stone) — low, broad badger with a white head stripe, digging claws and stone armor.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  fur: 0x4c4540, furL: 0x766d64, dark: 0x252220, stripe: 0xe7dfcf, eye: 0x171311,
  claw: 0xe9dfcf, rock: 0x737777, rockD: 0x4e5354, rune: 0x80d4cf, amber: 0xd7a14c,
};

interface BadgerParts {
  body: Part; chest: Part; head: Part; muzzle: Part; ears: Part;
  legs: { leg: Part; paw: Part; front: boolean; side: 1 | -1 }[];
  tail: Part[]; armor: Part;
}

export default defineUnit<BadgerParts>({
  id: "badger_stone",
  motion: "ground",
  height: 8,
  durations: { idle: 4.8, attack: 0.9, skill: 1.5, hit: 0.55, move: 0.72 },
  impact: { attack: 0.53, skill: 0.6 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 4.2, -0.7]);
    body.box([0, 0, -0.5], [5.2, 3.6, 6.4], C.fur)
      .box([0, 1.5, -0.6], [4.5, 0.5, 5.5], C.furL);

    const chest = k.part("chest", body, [0, 0.15, 2.3]);
    chest.box([0, 0, 0.3], [5.4, 3.9, 3.2], C.furL)
      .box([0, -1.45, 0.6], [4.2, 0.8, 2.5], C.dark);

    const head = k.part("head", chest, [0, 0.75, 2.35]);
    head.box([0, 0, 0.55], [4.3, 3.2, 3.5], C.dark)
      .box([0, 0.65, 1.05], [2.2, 2.25, 3.0], C.stripe)
      .pair([1.4, 0.6, 2.2], [0.42, 0.5, 0.18], C.eye);

    const muzzle = k.part("muzzle", head, [0, -0.55, 2.05]);
    muzzle.box([0, 0, 0.7], [2.8, 1.4, 2.0], C.furL)
      .box([0, 0.25, 1.8], [1.25, 0.8, 0.55], C.dark)
      .box([0, -0.5, 1.3], [2.0, 0.3, 1.0], C.dark);

    const ears = k.part("ears", head, [0, 1.75, 0.2]);
    ears.pair([1.45, 0.35, 0], [1.05, 1.1, 0.75], C.dark)
      .pair([1.45, 0.35, 0.38], [0.55, 0.55, 0.15], C.furL);

    const legs: BadgerParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const parent = front ? chest : body;
      const leg = k.part(`${front ? "front" : "hind"}Leg${side}`, parent, [side * 1.95, -1.15, front ? 1.1 : -2.15]);
      leg.box([0, -1.0, 0], [1.5, 2.5, 1.8], C.fur);
      if (!front) leg.box([0, 0.1, -0.3], [2.0, 1.6, 2.4], C.furL);
      const paw = k.part(`${front ? "front" : "hind"}Paw${side}`, leg, [0, -2.15, 0.45]);
      paw.box([0, -0.35, 0.65], [1.7, 0.8, 2.2], C.dark);
      for (const x of [-0.55, 0, 0.55]) paw.box([x, -0.35, 1.85], [0.25, 0.28, 0.85], C.claw, { rot: [0.08, 0, 0] });
      legs.push({ leg, paw, front, side });
    }

    const tail: Part[] = [];
    let p = body;
    for (let i = 0; i < 2; i++) {
      const t = k.part(`tail${i}`, p, i ? [0, 0, -1.25] : [0, 0.2, -3.45]);
      t.box([0, 0, -0.65], [1.4 - i * 0.25, 1.2 - i * 0.2, 1.6], i ? C.dark : C.furL);
      tail.push(t); p = t;
    }

    const armor = k.part("stoneArmor", body, [0, 1.75, -0.45]);
    armor.box([0, 0.2, 0], [4.8, 0.55, 5.0], C.rock)
      .pair([2.3, -0.35, 0.3], [0.55, 1.5, 3.8], C.rockD)
      .box([0, 0.55, -1.45], [1.2, 0.8, 1.4], C.rockD);

    if (star >= 2) {
      armor.pair([1.5, 1.0, -0.8], [1.0, 1.4, 1.2], C.rockD, { rot: [0.2, 0, 0.2] })
        .pair([1.65, 0.75, 1.15], [0.8, 1.2, 1.0], C.rock, { rot: [-0.15, 0, -0.15] });
      head.box([0, 1.9, -0.1], [1.4, 0.35, 2.5], C.amber);
    }
    if (star >= 3) {
      armor.box([0, 1.35, 0.4], [1.5, 1.6, 1.5], C.rockD)
        .box([0, 1.45, 1.2], [0.8, 0.7, 0.25], C.rune, { mat: "glow" });
      chest.pair([2.65, 0.75, 0.2], [0.4, 2.0, 2.3], C.rock)
        .pair([2.7, 0.9, 0.9], [0.18, 0.8, 0.4], C.rune, { mat: "glow" });
    }

    return { body, chest, head, muzzle, ears, legs, tail, armor };
  },

  pose(r, c) {
    const tail = (a: number) => r.tail.forEach((t, i) => {
      t.group.rotation.y = Math.sin(c.time * 2.1 - i * 0.7) * a;
    });
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.7) * 0.08 - (c.combat ? 0.25 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.8) * (c.combat ? 0.06 : 0.14);
        r.muzzle.group.rotation.x = Math.max(0, Math.sin(c.time * 1.2)) ** 8 * 0.12;
        r.ears.group.rotation.z = Math.sin(c.time * 2.7) * 0.05;
        tail(0.08);
        break;
      case "move": {
        const w = c.p * Math.PI * 2;
        r.legs.forEach((l) => {
          const ph = w + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.35 : 0);
          l.leg.group.rotation.x = Math.sin(ph) * 0.55;
          l.paw.group.rotation.x = Math.max(0, -Math.cos(ph)) * -0.45;
        });
        r.body.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        r.head.group.rotation.x = -Math.sin(w) * 0.04;
        tail(0.06);
        break;
      }
      case "attack": {
        const s = strike(c.p, 0.53);
        r.body.group.position.z += Math.max(0, s) * 1.1;
        r.chest.group.rotation.x = -Math.max(0, s) * 0.15;
        const swipe = r.legs[0]!;
        swipe.leg.group.rotation.x = -bell(c.p, 0.3, 0.72) * 1.1;
        swipe.paw.group.rotation.z = bell(c.p, 0.4, 0.68) * 0.45;
        r.head.group.rotation.x = -s * 0.12;
        tail(0.12);
        break;
      }
      case "skill": {
        const brace = ramp(c.p, 0, 0.35) * (1 - ramp(c.p, 0.82, 1));
        const spike = bell(c.p, 0.35, 0.82);
        r.body.group.position.y -= brace * 0.35;
        r.armor.group.scale.set(1 + spike * 0.08, 1 + spike * 0.22, 1 + spike * 0.08);
        r.armor.group.rotation.y = Math.sin(c.time * 8) * spike * 0.04;
        r.head.group.rotation.x = brace * 0.22;
        r.legs.forEach((l) => { l.leg.group.rotation.z = -l.side * brace * 0.1; });
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.55;
        r.body.group.rotation.z = h * 0.08;
        r.armor.group.rotation.x = -h * 0.12;
        r.head.group.rotation.x = h * 0.3;
        tail(0.18 * h);
        break;
      }
    }
  },
});
