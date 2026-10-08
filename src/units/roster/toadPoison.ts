// Cóc Độc (toad_poison) — bespoke rig from the approved reference sheet.
// Squat lime toad, dark blotches + warts, cream/pink throat sac, angry yellow eyes, purple poison sacs.
// Idle: sit/blink/throat puff/sac wobble · Move: hop · Attack: spit · Skill: throat swell → mist spray.
// 2★ adds a leather strap + pouch and more sacs; 3★ adds a leaf crown, glowing toxin drops and a twig.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  green: 0x8cc63f, greenD: 0x5f8f2a, greenL: 0xa8d65a, spot: 0x3a3524, wart: 0x5c5045,
  cream: 0xf2e6cf, pink: 0xe9a7bf, mouth: 0xc65a7a,
  purple: 0x9b40d6, purpleL: 0xcf8cff, purpleD: 0x6a2a9a,
  yellow: 0xffd43b, ink: 0x1e120a, claw: 0xf4f1ea, leather: 0x6b4226, leatherD: 0x3b2414,
  leaf: 0x4caf50, leafL: 0x7fd65a, toxin: 0xb6ff4a, twig: 0x8f5b32,
};

interface ToadParts {
  body: Part; head: Part; jaw: Part; lids: Part; throat: Part;
  armL: Part; armR: Part; legL: Part; legR: Part; sacs: Part[];
}

/** Rounded voxel blob for a poison sac: core cube + three cross slabs + highlight. */
function sac(p: Part, r: number) {
  p.box([0, 0, 0], [r * 2, r * 2, r * 2], C.purple)
    .box([0, 0, 0], [r * 2.4, r * 1.5, r * 1.5], C.purple)
    .box([0, 0, 0], [r * 1.5, r * 2.4, r * 1.5], C.purpleD)
    .box([0, 0, 0], [r * 1.5, r * 1.5, r * 2.4], C.purple)
    .box([-r * 0.35, r * 0.75, r * 0.55], [r * 0.6, r * 0.5, r * 0.6], C.purpleL);
}

export default defineUnit<ToadParts>({
  id: "toad_poison",
  motion: "ground",
  height: 7,
  durations: { idle: 4, attack: 0.95, skill: 1.7, hit: 0.5, move: 0.7 },
  impact: { attack: 0.5, skill: 0.55 },

  build(k, { star }) {
    const body = k.part("body");
    // Torso: squat pear, low to the ground, slightly wider at the hips.
    body.box([0, 2.6, -0.3], [7.2, 4.2, 6.4], C.green)
      .box([0, 0.9, 0.4], [6.0, 1.4, 5.6], C.greenD)
      .box([0, 4.9, -0.8], [5.4, 0.6, 4.6], C.green)
      .spots([0, 2.6, -0.3], [7.2, 4.2, 6.4], C.spot, 22, 11, 1.1)
      .spots([0, 4.9, -0.8], [5.4, 0.6, 4.6], C.wart, 9, 5, 0.8);

    const head = k.part("head", body, [0, 3.6, 2.2]);
    head.box([0, 0.6, 0.8], [6.6, 2.6, 3.6], C.green)
      .box([0, -0.62, 2.58], [6.0, 0.25, 0.2], C.ink) // mouth line
      .pair([0.6, 1.0, 2.64], [0.3, 0.25, 0.12], C.ink) // nostrils
      .pair([2.0, 2.0, 1.6], [1.5, 1.4, 1.4], C.yellow) // bulging eyes on top
      .pair([1.75, 1.9, 2.33], [0.8, 0.8, 0.12], C.ink) // pupils
      .pair([2.1, 2.85, 1.8], [1.9, 0.6, 1.3], C.greenD, { rot: [0, 0, 0.35] }) // angry brows
      .spots([0, 0.6, 0.6], [6.6, 2.6, 3.2], C.spot, 8, 23, 0.9);

    const lids = k.part("lids", head, [0, 2.75, 1.6]);
    lids.pair([2.0, -0.75, 0.05], [1.6, 1.5, 1.5], C.greenD);

    const jaw = k.part("jaw", head, [0, -0.5, -0.4]);
    jaw.box([0, -0.4, 1.3], [6.2, 0.9, 3.4], C.green)
      .box([0, 0.1, 1.4], [5.2, 0.2, 2.8], C.mouth)
      .box([0, 0.25, 1.0], [2.0, 0.3, 1.8], C.pink); // tongue

    const throat = k.part("throat", body, [0, 1.6, 3.0]);
    throat.box([0, 0, 0.2], [4.6, 2.6, 1.4], C.cream)
      .box([0, -0.5, 0.55], [3.6, 1.4, 1.0], C.pink);

    // Front arms: planted forward, three white toe claws each.
    const arm = (side: 1 | -1) => {
      const a = k.part(side > 0 ? "armR" : "armL", body, [side * 2.8, 1.4, 2.2]);
      a.box([0, -0.3, 0], [1.4, 2.4, 1.4], C.green)
        .box([side * 0.2, -1.1, 0.6], [1.9, 0.6, 2.0], C.greenD);
      for (const dx of [-0.6, 0, 0.6]) a.box([side * 0.2 + dx, -1.2, 1.75], [0.35, 0.4, 0.4], C.claw);
      return a;
    };
    // Hind legs: big folded thighs at the hips, wide webbed feet.
    const leg = (side: 1 | -1) => {
      const l = k.part(side > 0 ? "legR" : "legL", body, [side * 3.4, 1.2, -1.5]);
      l.box([0, 0.3, 0], [2.2, 2.6, 3.4], C.green)
        .spots([0, 0.3, 0], [2.2, 2.6, 3.4], C.spot, 5, side > 0 ? 31 : 37, 0.9)
        .box([side * 0.2, -0.9, 1.3], [2.4, 0.6, 2.6], C.greenD);
      for (const dx of [-0.7, 0, 0.7]) l.box([side * 0.2 + dx, -1.0, 2.7], [0.4, 0.4, 0.45], C.claw);
      return l;
    };

    // Poison sacs: count grows with star (3 → 5 → 6), each its own pivot for wobble.
    const SAC_SPOTS: [number, number, number, number][] = [
      [-3.5, 3.5, -1.0, 1.05], [3.6, 2.9, -0.2, 1.15], [1.3, 5.2, -2.2, 0.95],
      [-1.6, 5.0, -2.8, 0.85], [3.2, 4.4, -2.6, 0.8], [-3.0, 2.2, -3.0, 0.75],
    ];
    const sacs = SAC_SPOTS.slice(0, star === 1 ? 3 : star === 2 ? 5 : 6).map(([x, y, z, r], i) => {
      const s = k.part(`sac${i}`, body, [x, y, z]);
      sac(s, r);
      return s;
    });

    if (star >= 2) {
      // Leather strap across the back + side pouch.
      body.box([0, 4.4, -0.3], [7.6, 0.6, 1.0], C.leather, { rot: [0, 0.5, 0] })
        .box([-3.7, 2.6, 0.8], [0.6, 1.6, 1.6], C.leather)
        .box([-3.95, 3.0, 0.8], [0.15, 0.4, 1.2], C.leatherD);
    }
    if (star >= 3) {
      // Leaf crown with glowing toxin drops + twig strapped on the back.
      for (const [x, z, h, rz] of [[-1.6, 0.9, 1.6, 0.4], [0, 0.6, 2.1, 0], [1.6, 0.9, 1.6, -0.4]] as const) {
        head.box([x, 2.6 + h / 2, z], [0.9, h, 0.5], C.leaf, { rot: [0, 0, rz] })
          .box([x, 2.7 + h, z], [0.5, 0.5, 0.5], C.leafL);
      }
      head.box([-0.9, 3.4, 0.2], [0.4, 0.4, 0.4], C.toxin, { mat: "glow" })
        .box([1.0, 3.6, 0.3], [0.35, 0.35, 0.35], C.toxin, { mat: "glow" });
      body.box([1.0, 5.6, -1.6], [0.6, 0.6, 6.0], C.twig, { rot: [0.35, 0.2, 0] });
      for (const s of sacs) s.box([0, 0, 0], [0.5, 0.5, 0.5], C.toxin, { mat: "glow" });
    }

    return { body, head, jaw, lids, throat, armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1), sacs };
  },

  pose(r, c) {
    const { body, head, jaw, lids, throat } = r;
    // Signature: this toad breathes slow and deep, puffs its throat on a ~4.6 s period.
    const slow = c.time * (0.9 + c.sig * 0.2);
    const blinkPhase = (c.time * 0.31 + c.sig * 7) % 3.4;
    lids.group.scale.y = blinkPhase < 0.14 || c.state === "hit" ? 1 : 0.05;
    const sacWobble = (amp: number, speed: number) => r.sacs.forEach((s, i) => {
      const w = Math.sin(c.time * speed + i * 1.7);
      s.group.scale.setScalar(1 + w * amp);
      s.group.rotation.z = w * amp * 0.8;
    });

    switch (c.state) {
      case "idle": {
        const crouch = c.combat ? 0.35 : 0;
        body.group.scale.y = 1 + Math.sin(slow * 2) * 0.025 - crouch * 0.06;
        body.group.position.y = -crouch;
        const puff = c.combat ? 0.12 + Math.sin(c.time * 3) * 0.05 : bell(((slow * 0.22) % 1), 0.55, 0.9) * 0.55;
        throat.group.scale.set(1 + puff * 0.35, 1 + puff, 1 + puff * 0.9);
        head.group.rotation.x = c.combat ? 0.08 : Math.sin(slow * 0.7) * 0.04;
        jaw.group.rotation.x = c.combat ? 0.06 + Math.max(0, Math.sin(c.time * 2.2)) * 0.06 : 0;
        sacWobble(c.combat ? 0.08 : 0.04, c.combat ? 7 : 3.5);
        break;
      }
      case "move": {
        // Two short hops per cycle: hind legs drive, front arms reach, body pitches up then lands.
        const hop = (c.p * 2) % 1, air = bell(hop, 0.1, 0.8);
        body.group.position.y = air * 2.6;
        body.group.rotation.x = -air * 0.25 + bell(hop, 0.75, 1) * 0.12;
        r.legL.group.rotation.x = r.legR.group.rotation.x = -air * 0.9;
        r.legL.group.position.z = r.legR.group.position.z = -1.5 - air * 1.2;
        r.armL.group.rotation.x = r.armR.group.rotation.x = -air * 0.6;
        body.group.scale.y = 1 - bell(hop, 0.8, 1) * 0.12 + air * 0.05;
        sacWobble(0.1, 9);
        break;
      }
      case "attack": {
        // Wind up (head back, throat fills) → spit at impact (jaw snaps open, head lunges) → recover.
        const s = strike(c.p, 0.5);
        head.group.rotation.x = -s * 0.32;
        head.group.position.z = Math.max(0, s) * 0.8;
        jaw.group.rotation.x = Math.max(0, s) * 0.7;
        const fill = ramp(c.p, 0, 0.45) * (1 - ramp(c.p, 0.5, 0.65));
        throat.group.scale.set(1 + fill * 0.3, 1 + fill * 0.8, 1 + fill * 0.7);
        body.group.rotation.x = -Math.max(0, s) * 0.08;
        sacWobble(0.06, 8);
        break;
      }
      case "skill": {
        // Sương Độc: gather toxin (sacs pump) → throat swells huge → wide spray → settle.
        const gather = ramp(c.p, 0, 0.4), spray = bell(c.p, 0.5, 0.95);
        const swell = gather * (1 - ramp(c.p, 0.5, 0.6));
        throat.group.scale.set(1 + swell * 0.6, 1 + swell * 1.5, 1 + swell * 1.3);
        body.group.scale.y = 1 + swell * 0.08;
        head.group.rotation.x = -swell * 0.25 + spray * 0.15;
        jaw.group.rotation.x = spray * 0.85;
        head.group.rotation.y = Math.sin(c.p * 18) * spray * 0.18; // sweeping spray
        r.sacs.forEach((s, i) => {
          const pump = Math.sin(c.time * 14 + i) * 0.12 * gather + spray * -0.12;
          s.group.scale.setScalar(1 + pump);
        });
        break;
      }
      case "hit": {
        const k = bell(c.p, 0, 1);
        body.group.rotation.x = -k * 0.3;
        body.group.position.z = -k * 0.9;
        body.group.scale.set(1 + k * 0.08, 1 - k * 0.12, 1);
        jaw.group.rotation.x = k * 0.35;
        sacWobble(0.14 * k, 16);
        break;
      }
    }
  },
});
