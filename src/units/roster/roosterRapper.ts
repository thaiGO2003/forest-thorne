// Gà Trống Rapper (rooster_rapper) — bespoke voxel rig from the approved concept sheet.
// Cream rooster in a black stage vest with gold chain, red comb/tail, sunglasses and a microphone.
// Idle: head-bob to the beat, mic taps. Move: stage strut. Attack: mic throw. Skill: raise mic,
// glowing notes orbit. 2★ adds a gold chain stack and shoulder studs; 3★ adds a crown and notes.
import type { Part } from "../kit";
import { bell, defineUnit, ramp } from "../rig";

const C = {
  cream: 0xf7e6c3, creamD: 0xd9c096, creamL: 0xfff3d8,
  red: 0xd33227, redD: 0x8f1d17, orange: 0xe8862b, orangeD: 0xb35d14,
  black: 0x241b17, blackL: 0x3d2d25,
  gold: 0xf0c14e, goldD: 0xa87a24,
  beak: 0xf2a72e, beakD: 0xc47b17,
  leg: 0xd98528, legD: 0x9c5a16,
  mic: 0x2b2b33, micD: 0x121216, glass: 0x9fd8ff,
  note: 0xffd84a, white: 0xffffff,
};

interface RoosterParts {
  body: Part; torso: Part; head: Part; comb: Part; beak: Part; wattle: Part;
  wingL: Part; wingR: Part; legL: Part; legR: Part; tail: Part; mic: Part;
  chain: Part; crown: Part | null; notes: Part[];
}

export default defineUnit<RoosterParts>({
  id: "crane_blessing",
  motion: "ground",
  height: 10,
  durations: { idle: 4, attack: 0.85, skill: 1.7, hit: 0.5, move: 0.8 },
  impact: { attack: 0.52, skill: 0.6 },

  build(k, { star }) {
    const body = k.part("body");

    // Plump cream body with a dark stage vest and gold trim.
    const torso = k.part("torso", body, [0, 2.4, 0]);
    torso.box([0, 1.0, 0], [4.2, 2.2, 3.2], C.creamD)
      .box([0, 3.3, 0], [4.7, 3.6, 3.4], C.cream)
      .box([0, 4.9, 0.1], [4.4, 0.8, 3.2], C.creamD)
      .box([0, 3.3, -1.55], [4.9, 3.3, 0.6], C.black)
      .pair([2.25, 3.4, 0.35], [0.5, 3.0, 2.4], C.black)
      .pair([1.9, 3.1, 1.55], [0.5, 2.5, 0.35], C.gold)
      .box([0, 2.2, 1.6], [3.2, 0.5, 0.35], C.gold);

    // Wing/arms: cream with red primaries and a gold cuff.
    const wing = (side: 1 | -1) => {
      const w = k.part(side > 0 ? "wingR" : "wingL", torso, [side * 2.5, 3.6, 0]);
      w.box([0, -0.7, 0], [1.0, 2.2, 2.0], C.cream)
        .box([0, -2.0, -0.4], [0.9, 1.6, 1.5], C.creamD)
        .box([0, -2.9, -0.9], [1.0, 1.2, 1.2], C.red, { rot: [0.5, 0, side * 0.2] })
        .box([0, -1.9, 0.2], [1.08, 0.4, 2.06], C.gold);
      return w;
    };
    const wingR = wing(1), wingL = wing(-1);

    // Legs with three-toe stage boots.
    const leg = (side: 1 | -1) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * 1.1, 1.0, 0]);
      l.box([0, -0.8, 0], [0.6, 2.0, 0.6], C.leg)
        .box([0, -1.8, 0.3], [0.8, 0.35, 1.1], C.legD);
      for (const dx of [-0.35, 0, 0.35]) l.box([dx, -1.85, 0.95], [0.25, 0.28, 0.7], C.leg);
      return l;
    };

    // Head: cream cube, red comb, orange beak, wattle, black sunglasses.
    const head = k.part("head", torso, [0, 5.0, 0.2]);
    head.box([0, 0.5, 0], [3.4, 2.6, 3.2], C.cream)
      .box([0, 1.9, -0.2], [3.5, 0.5, 3.0], C.creamD)
      .box([0, 0.9, 1.75], [2.9, 0.7, 0.25], C.black) // sunglasses bar
      .pair([1.65, 0.9, 1.55], [0.3, 0.7, 1.2], C.black) // temples
      .pair([0.95, 0.9, 1.95], [0.7, 0.5, 0.1], C.glass) // lens glints
      .box([0, 2.55, 0], [3.0, 0.5, 2.6], C.redD);

    const comb = k.part("comb", head, [0, 2.9, 0]);
    comb.box([0, 0, 0.2], [0.9, 1.5, 2.6], C.red)
      .box([-0.95, -0.2, 0.1], [0.8, 1.1, 2.2], C.red)
      .box([0.95, -0.2, 0.1], [0.8, 1.1, 2.2], C.red)
      .box([0, -0.9, 2.2], [1.0, 0.9, 0.9], C.redD);

    const beak = k.part("beak", head, [0, 0.15, 1.9]);
    beak.box([0, 0, 0], [1.3, 0.55, 1.0], C.beak)
      .box([0, -0.45, 0.1], [1.0, 0.3, 0.7], C.beakD);

    const wattle = k.part("wattle", head, [0, -0.75, 1.85]);
    wattle.box([0, 0, 0], [0.9, 1.1, 0.5], C.red)
      .box([0, -0.7, 0.05], [0.6, 0.7, 0.4], C.redD);

    // Tail: three fanned red/orange feathers.
    const tail = k.part("tail", torso, [0, 3.2, -2.0]);
    tail.box([0, 0.9, -0.7], [1.1, 3.2, 0.7], C.red, { rot: [-0.5, 0, 0] })
      .pair([1.0, 0.4, -0.5], [0.9, 2.6, 0.6], C.orange, { rot: [-0.6, 0, 0.4] })
      .box([0, 1.8, -1.1], [0.8, 1.6, 0.6], C.redD, { rot: [-0.7, 0, 0] });

    // Microphone in the right wing: black body, gold grille band, cream highlight.
    const mic = k.part("mic", wingR, [0, -3.2, 1.3]);
    mic.box([0, 0, 0], [0.85, 1.6, 0.85], C.mic)
      .box([0, 0.95, 0], [1.05, 0.65, 1.05], C.micD)
      .box([0, 0.5, 0], [0.95, 0.22, 0.95], C.gold)
      .box([0.28, 0.95, 0.42], [0.18, 0.3, 0.18], C.white);

    // Base bling: gold chain across the vest (all stars).
    const chain = k.part("chain", torso, [0, 4.4, 1.65]);
    for (let i = -2; i <= 2; i++) {
      chain.box([i * 0.65, -Math.abs(i) * 0.22, 0], [0.5, 0.45, 0.3], i % 2 ? C.goldD : C.gold);
    }
    chain.box([0, -0.7, 0.05], [1.1, 0.75, 0.3], C.gold);

    // 2★: shoulder studs + second chain and gold wing trim.
    if (star >= 2) {
      torso.pair([2.35, 4.6, 0.4], [0.55, 0.5, 0.55], C.gold)
        .pair([2.3, 4.1, 0.6], [0.5, 0.4, 0.5], C.goldD);
      chain.box([0, -1.2, 0.1], [2.0, 0.4, 0.35], C.goldD);
      wingL.box([0, -1.0, 0], [1.1, 0.3, 2.1], C.goldD);
    }

    // 3★: gold crown + orbiting glowing notes.
    let crown: Part | null = null;
    if (star >= 3) {
      crown = k.part("crown", head, [0, 2.6, 0]);
      crown.box([0, 0, 0], [3.0, 0.5, 3.0], C.gold)
        .pair([1.4, 0.5, 1.4], [0.6, 0.9, 0.6], C.gold)
        .box([0, 0.5, -1.4], [0.6, 0.9, 0.6], C.gold)
        .box([0, 0.35, 0.3], [0.5, 0.5, 0.5], C.red);
    }
    const notes: Part[] = star >= 3
      ? [0, 1, 2].map((i) => {
        const n = k.part(`note${i}`, torso, [0, 5.5, 0]);
        n.box([0, 0, 0], [0.45, 0.45, 0.2], C.note, { mat: "glow" })
          .box([0.32, -0.35, 0], [0.16, 0.55, 0.18], C.note, { mat: "glow" });
        return n;
      })
      : [];

    return {
      body, torso, head, comb, beak, wattle, wingL, wingR,
      legL: leg(-1), legR: leg(1), tail, mic, chain, crown, notes,
    };
  },

  pose(r, c) {
    const beat = c.time * (2.4 + c.sig * 0.4);
    const bounce = Math.sin(beat) * 0.06;
    r.notes.forEach((n, i) => {
      const a = c.time * (c.state === "skill" ? 7 : 1.8) + i * 2.09;
      n.group.position.set(Math.cos(a) * 3.4, 5.4 + Math.sin(a * 1.4) * 0.7, Math.sin(a) * 1.6);
      n.group.rotation.y = a;
      n.group.scale.setScalar(c.state === "skill" ? 1.25 : 1);
    });
    if (r.crown) r.crown.group.rotation.y = c.time * 0.4;

    switch (c.state) {
      case "idle": {
        r.body.group.position.y = bounce;
        r.torso.group.rotation.z = Math.sin(beat * 0.5) * 0.03;
        r.head.group.rotation.x = Math.sin(beat + 0.6) * 0.08 - (c.combat ? 0.05 : 0);
        r.head.group.rotation.y = c.combat ? 0.14 : Math.sin(beat * 0.5) * 0.12;
        r.comb.group.rotation.z = Math.sin(beat * 1.1) * 0.08;
        r.tail.group.rotation.z = Math.sin(beat * 0.7) * 0.12;
        r.mic.group.rotation.x = Math.sin(beat * 1.2) * 0.12;
        r.wingR.group.rotation.x = c.combat ? -0.35 : -0.1 + Math.sin(beat) * 0.05;
        r.wingL.group.rotation.x = c.combat ? -0.1 : 0.05;
        break;
      }
      case "move": {
        const step = c.p * 2 % 1;
        const lift = bell(step, 0.05, 0.85);
        r.body.group.position.y = lift * 1.1;
        r.body.group.rotation.x = -0.08 + Math.sin(c.p * Math.PI * 4) * 0.05;
        r.legL.group.rotation.x = Math.sin(c.p * Math.PI * 4) * 0.8;
        r.legR.group.rotation.x = -Math.sin(c.p * Math.PI * 4) * 0.8;
        r.wingL.group.rotation.z = 0.2 + Math.sin(c.p * Math.PI * 4) * 0.15;
        r.wingR.group.rotation.z = -0.2 - Math.sin(c.p * Math.PI * 4) * 0.15;
        r.tail.group.rotation.z = Math.sin(c.p * Math.PI * 4) * 0.2;
        r.head.group.rotation.y = Math.sin(c.p * Math.PI * 2) * 0.15;
        break;
      }
      case "attack": {
        // Wind the mic behind the shoulder, then hurl it forward at impact.
        const wind = ramp(c.p, 0, 0.45);
        const throwP = ramp(c.p, 0.45, 0.7);
        r.body.group.rotation.y = -wind * 0.35 + throwP * 0.55;
        r.wingR.group.rotation.x = 0.7 * wind - 2.3 * throwP;
        r.wingR.group.rotation.z = -0.3 * throwP;
        r.mic.group.rotation.x = -wind * 0.6 + throwP * 1.4;
        r.head.group.rotation.y = -0.2 * wind + 0.3 * throwP;
        r.tail.group.rotation.z = 0.25 * throwP;
        r.legL.group.rotation.x = -0.25 * throwP;
        break;
      }
      case "skill": {
        // Raise the mic, lean back, let the notes orbit and pulse.
        const raise = ramp(c.p, 0, 0.35);
        const hold = ramp(c.p, 0.35, 0.85);
        r.body.group.rotation.x = -0.15 * raise;
        r.body.group.position.y = 0.3 * raise + Math.sin(c.time * 6) * 0.05 * hold;
        r.wingR.group.rotation.x = -2.5 * raise;
        r.wingR.group.rotation.z = -0.4 * raise;
        r.mic.group.rotation.x = 0.6 * raise;
        r.head.group.rotation.x = -0.25 * raise;
        r.comb.group.rotation.z = Math.sin(c.time * 9) * 0.15 * hold;
        r.tail.group.rotation.z = Math.sin(c.time * 7) * 0.25 * hold;
        break;
      }
      case "hit": {
        const kick = ramp(c.p, 0, 0.25);
        r.body.group.rotation.x = 0.35 * kick * (1 - ramp(c.p, 0.3, 1));
        r.head.group.rotation.x = -0.3 * kick;
        r.wingL.group.rotation.z = 0.6 * kick;
        r.wingR.group.rotation.z = -0.6 * kick;
        break;
      }
    }
  },
});
