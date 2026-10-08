// Bồ Câu Hòa Bình (dove_peace) — soft-feather support dove carrying an olive branch.
import type { Part } from "../kit";
import { bell, defineUnit, ramp } from "../rig";

const C = {
  white: 0xe9ece8, pearl: 0xcfd8d6, shadow: 0xaeb8b8, beak: 0xd8a86e, eye: 0x23282c,
  olive: 0x5b8849, oliveL: 0x81aa62, gold: 0xe3c766, aura: 0xa9efd2,
};

interface DoveParts {
  body: Part; neck: Part; head: Part; beak: Part; wings: Part[]; tail: Part[];
  talons: Part[]; branch: Part; halo?: Part;
}

export default defineUnit<DoveParts>({
  id: "dove_peace",
  motion: "fly",
  height: 9,
  durations: { idle: 4.2, attack: 0.82, skill: 1.7, hit: 0.48, move: 0.7 },
  impact: { attack: 0.5, skill: 0.62 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 5.7, -0.6]);
    body.box([0, 0, 0], [4.0, 4.2, 4.5], C.white)
      .box([0, -0.75, 1.15], [3.0, 2.0, 2.1], C.pearl);

    const neck = k.part("neck", body, [0, 1.45, 1.25]);
    neck.box([0, 0.85, 0.45], [2.5, 2.8, 2.4], C.white)
      .box([0, 0.6, 1.55], [2.15, 0.42, 0.6], C.pearl);

    const head = k.part("head", neck, [0, 2.05, 0.75]);
    head.box([0, 0, 0.25], [2.7, 2.5, 2.8], C.white)
      .pair([0.78, 0.35, 1.45], [0.32, 0.42, 0.18], C.eye);

    const beak = k.part("beak", head, [0, -0.15, 1.55]);
    beak.box([0, 0, 0.65], [1.1, 0.65, 1.5], C.beak);

    const wings: Part[] = [];
    for (const side of [-1, 1] as const) {
      const w = k.part(`wing${side}`, body, [side * 1.8, 0.45, 0]);
      w.box([side * 1.0, 0, 0.1], [2.4, 0.7, 4.2], C.white, { rot: [0, 0, side * 0.12] })
        .box([side * 2.1, -0.1, -0.6], [1.7, 0.5, 4.5], C.pearl, { rot: [0, 0, side * 0.18] })
        .box([side * 2.8, -0.2, -1.3], [1.1, 0.32, 3.7], C.shadow, { rot: [0, 0, side * 0.22] });
      wings.push(w);
    }

    const tail: Part[] = [];
    for (const [i, x] of [[0, -0.75], [1, 0], [2, 0.75]] as const) {
      const t = k.part(`tail${i}`, body, [x, -0.25, -2.35]);
      t.box([x * 0.25, 0, -1.65], [0.95, 0.45, 3.6], i === 1 ? C.white : C.pearl, { rot: [0.12, 0, x * 0.12] });
      tail.push(t);
    }

    const talons: Part[] = [];
    for (const side of [-1, 1] as const) {
      const t = k.part(`talon${side}`, body, [side * 0.8, -2.0, 0.4]);
      t.box([0, -0.55, 0], [0.38, 1.15, 0.38], C.beak)
        .box([0, -1.0, 0.45], [0.95, 0.22, 1.0], C.beak);
      talons.push(t);
    }

    const branch = k.part("oliveBranch", beak, [0, -0.1, 1.0]);
    branch.box([0, 0, 1.35], [0.28, 0.28, 2.9], C.olive, { rot: [0, 0.28, 0] })
      .pair([0.55, 0.15, 1.6], [0.75, 0.22, 0.5], C.oliveL, { rot: [0, 0.2, 0.4] })
      .pair([0.45, -0.05, 0.8], [0.65, 0.22, 0.45], C.oliveL, { rot: [0, -0.2, -0.35] });

    if (star >= 2) {
      neck.box([0, 0.3, 1.45], [2.5, 0.26, 0.35], C.gold);
      wings.forEach((w, i) => w.box([(i ? 1 : -1) * 2.85, 0.2, -0.9], [0.45, 0.16, 2.4], C.gold));
    }

    let halo: Part | undefined;
    if (star >= 3) {
      halo = k.part("peaceHalo", head, [0, 1.85, 0]);
      halo.box([0, 0, 0], [3.6, 0.22, 0.35], C.aura, { mat: "glow" })
        .pair([1.65, 0, 0], [0.3, 0.22, 2.2], C.aura, { mat: "glow" });
      tail.forEach((t) => t.box([0, 0.2, -2.4], [0.3, 0.18, 1.2], C.aura, { mat: "glow" }));
    }

    return { body, neck, head, beak, wings, tail, talons, branch, halo };
  },

  pose(r, c) {
    const flap = (a: number, speed = 1) => r.wings.forEach((w, i) => {
      w.group.rotation.z = (i ? -1 : 1) * Math.sin(c.time * 3.6 * speed) * a;
    });
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.9) * 0.24;
        r.head.group.rotation.y = Math.sin(c.time * 1.1) * (c.combat ? 0.06 : 0.18);
        r.branch.group.rotation.z = Math.sin(c.time * 1.7) * 0.05;
        flap(c.combat ? 0.18 : 0.26);
        break;
      case "move":
        r.body.group.rotation.x = -0.12;
        r.body.group.position.y += Math.sin(c.p * Math.PI * 2) * 0.28;
        flap(0.58, 1.4);
        r.tail.forEach((t, i) => t.group.rotation.y = Math.sin(c.p * Math.PI * 2 + i) * 0.08);
        break;
      case "attack": {
        const h = bell(c.p, 0.28, 0.72);
        r.body.group.position.z += h * 0.55;
        r.neck.group.rotation.x = -h * 0.25;
        r.beak.group.rotation.x = h * 0.28;
        r.wings.forEach((w, i) => w.group.rotation.z = (i ? -1 : 1) * h * 0.45);
        break;
      }
      case "skill": {
        const bless = ramp(c.p, 0, 0.32) * (1 - ramp(c.p, 0.84, 1));
        const pulse = bell(c.p, 0.35, 0.82);
        r.body.group.position.y += bless * 0.65;
        r.wings[0]!.group.rotation.z = 0.9 * bless;
        r.wings[1]!.group.rotation.z = -0.9 * bless;
        r.neck.group.rotation.x = -0.12 * bless;
        r.branch.group.rotation.y = Math.sin(c.time * 8) * 0.12 * bless;
        if (r.halo) {
          r.halo.group.rotation.y = c.time * 1.8 * bless;
          r.halo.group.scale.setScalar(1 + pulse * 0.16);
        }
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.55;
        r.body.group.rotation.z = -h * 0.14;
        r.head.group.rotation.x = h * 0.28;
        r.wings.forEach((w, i) => w.group.rotation.z = (i ? 1 : -1) * h * 0.5);
        break;
      }
    }
  },
});
