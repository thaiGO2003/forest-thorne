// Gà Trống Rapper (crane_blessing) — rooster support with microphone, layered tail plumes and rhythmic wing gestures.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  feather: 0xd66a2d, featherL: 0xf2a84a, featherD: 0x8f3f24, cream: 0xf2e2be,
  red: 0xd83b38, beak: 0xf1bd45, eye: 0x1b1713, leg: 0xc99649,
  mic: 0x4f5960, micD: 0x252b2f, gold: 0xf0c95c, note: 0x7bd6ff, violet: 0x9f65d6,
};

interface RoosterParts {
  body: Part; neck: Part; head: Part; beak: Part; comb: Part; wattle: Part;
  wings: Part[]; tail: Part[]; legs: Part[]; mic: Part;
}

export default defineUnit<RoosterParts>({
  id: "crane_blessing",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.92, skill: 1.65, hit: 0.5, move: 0.68 },
  impact: { attack: 0.57, skill: 0.62 },

  build(k, { star }) {
    const body = k.part("body", null, [0, 5.0, -0.5]);
    body.box([0, 0, -0.3], [4.4, 4.2, 4.6], C.feather)
      .box([0, -1.05, 1.0], [3.3, 2.1, 2.7], C.cream)
      .box([0, 1.5, -0.8], [3.7, 0.55, 3.2], C.featherL);

    const neck = k.part("neck", body, [0, 1.45, 1.45]);
    neck.box([0, 1.0, 0.5], [2.5, 3.0, 2.6], C.featherL)
      .box([0, 1.9, 0.75], [2.3, 0.55, 2.2], C.featherD);

    const head = k.part("head", neck, [0, 2.5, 0.8]);
    head.box([0, 0, 0.45], [2.8, 2.3, 2.7], C.featherL)
      .pair([0.78, 0.35, 1.75], [0.42, 0.5, 0.18], C.eye);

    const beak = k.part("beak", head, [0, -0.15, 1.7]);
    beak.box([0, 0, 0.75], [1.5, 0.8, 1.7], C.beak)
      .box([0, -0.3, 1.35], [1.1, 0.25, 0.7], C.featherD);

    const comb = k.part("comb", head, [0, 1.15, -0.3]);
    comb.box([0, 0.7, -0.65], [0.55, 1.5, 0.7], C.red)
      .box([0, 1.0, 0.05], [0.65, 1.8, 0.75], C.red)
      .box([0, 0.75, 0.75], [0.55, 1.45, 0.7], C.red);

    const wattle = k.part("wattle", head, [0, -1.0, 1.0]);
    wattle.pair([0.45, -0.55, 0.3], [0.65, 1.4, 0.7], C.red);

    const wings: Part[] = [];
    for (const side of [-1, 1] as const) {
      const w = k.part(`wing${side}`, body, [side * 2.0, 0.45, 0.1]);
      w.box([side * 0.75, -0.15, 0], [1.9, 3.6, 2.8], C.featherD, { rot: [0, 0, side * 0.16] })
        .box([side * 1.35, -0.8, 0.4], [1.25, 2.7, 2.0], C.featherL, { rot: [0, 0, side * 0.2] })
        .box([side * 1.65, -1.7, 0.75], [0.7, 1.6, 1.2], C.cream);
      wings.push(w);
    }

    const tail: Part[] = [];
    for (const [i, side] of [[0, -1], [1, 0], [2, 1]] as const) {
      const t = k.part(`tail${i}`, body, [side * 0.85, 1.2, -2.65]);
      t.box([side * 0.7, 0.8, -1.8], [1.25, 1.3, 4.2], i === 1 ? C.featherD : C.featherL, { rot: [-0.35, 0, side * 0.2] });
      tail.push(t);
    }

    const legs: Part[] = [];
    for (const side of [-1, 1] as const) {
      const l = k.part(`leg${side}`, body, [side * 1.2, -2.0, 0.2]);
      l.box([0, -1.15, 0], [0.6, 2.7, 0.6], C.leg)
        .box([0, -2.45, 0.65], [1.2, 0.35, 1.7], C.leg);
      for (const x of [-0.45, 0, 0.45]) l.box([x, -2.45, 1.55], [0.25, 0.25, 0.9], C.leg);
      legs.push(l);
    }

    const mic = k.part("microphone", wings[1]!, [1.8, -0.6, 1.0]);
    mic.box([0, 0, 0], [0.45, 2.3, 0.45], C.micD, { rot: [0.8, 0, 0.15] })
      .box([0, 0.9, 0.8], [0.85, 0.85, 0.85], C.mic);

    if (star >= 2) {
      neck.box([0, -0.2, 1.45], [2.8, 0.35, 0.35], C.gold)
        .box([0, -0.65, 1.5], [0.8, 0.8, 0.25], C.violet, { mat: "glow" });
      wings.forEach((w, i) => w.box([(i ? 1 : -1) * 1.65, 0.4, 0.7], [0.55, 1.8, 1.0], C.gold));
    }
    if (star >= 3) {
      head.box([0, 1.65, 0.4], [2.0, 0.35, 1.5], C.gold)
        .box([0, 2.0, 0.15], [0.65, 0.9, 0.65], C.note, { mat: "glow" });
      tail.forEach((t, i) => t.box([0, 1.55, -1.7], [0.45, 0.45, 1.8], i % 2 ? C.note : C.violet, { mat: "glow" }));
    }

    return { body, neck, head, beak, comb, wattle, wings, tail, legs, mic };
  },

  pose(r, c) {
    const tails = (a: number) => r.tail.forEach((t, i) => {
      t.group.rotation.z = Math.sin(c.time * 2.1 + i) * a;
      t.group.rotation.x = Math.cos(c.time * 1.6 + i) * a * 0.4;
    });
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 2.4) * 0.1;
        r.head.group.rotation.y = Math.sin(c.time * 1.3) * (c.combat ? 0.08 : 0.22);
        r.comb.group.rotation.z = Math.sin(c.time * 3.4) * 0.05;
        r.wattle.group.rotation.x = Math.sin(c.time * 2.8) * 0.07;
        r.wings[1]!.group.rotation.z = Math.sin(c.time * 1.7) * 0.08;
        tails(0.1);
        break;
      case "move": {
        const w = c.p * Math.PI * 2;
        r.legs.forEach((l, i) => l.group.rotation.x = Math.sin(w + i * Math.PI) * 0.65);
        r.body.group.position.y += Math.abs(Math.sin(w)) * 0.28;
        r.neck.group.rotation.x = -Math.sin(w) * 0.08;
        r.wings.forEach((x, i) => x.group.rotation.z = (i ? -1 : 1) * 0.12 * Math.sin(w));
        tails(0.14);
        break;
      }
      case "attack": {
        const s = strike(c.p, 0.57);
        r.body.group.position.z += Math.max(0, s) * 0.55;
        r.neck.group.rotation.x = -s * 0.25;
        r.beak.group.rotation.x = bell(c.p, 0.4, 0.75) * 0.35;
        r.wings[1]!.group.rotation.z = -bell(c.p, 0.28, 0.68) * 0.75;
        r.mic.group.rotation.x = -bell(c.p, 0.35, 0.72) * 0.45;
        tails(0.18);
        break;
      }
      case "skill": {
        const hype = ramp(c.p, 0, 0.35) * (1 - ramp(c.p, 0.82, 1));
        const beat = Math.sin(c.time * 18) * hype;
        r.body.group.position.y += Math.abs(beat) * 0.24;
        r.head.group.rotation.z = beat * 0.1;
        r.beak.group.rotation.x = Math.max(0, beat) * 0.32;
        r.wings[0]!.group.rotation.z = 0.45 * hype + beat * 0.08;
        r.wings[1]!.group.rotation.z = -0.95 * hype - beat * 0.1;
        r.mic.group.rotation.z = -0.18 * hype;
        r.comb.group.scale.y = 1 + bell(c.p, 0.35, 0.8) * 0.12;
        tails(0.25);
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.body.group.position.z -= h * 0.6;
        r.body.group.rotation.z = -h * 0.12;
        r.neck.group.rotation.x = h * 0.3;
        r.wings.forEach((w, i) => w.group.rotation.z = (i ? 1 : -1) * h * 0.4);
        r.comb.group.rotation.z = h * 0.25;
        tails(0.25 * h);
        break;
      }
    }
  },
});
