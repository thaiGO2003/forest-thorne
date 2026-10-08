// Kiến Hộ Vệ (ant_guard) — low armored ant with independent mandibles, antennae and six legs.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  shell: 0x7c3f28, shellL: 0xa75a35, shellD: 0x44251d, joint: 0x2c1b18,
  eye: 0x16100d, tooth: 0xf1e6cf, steel: 0x7e8a91, bronze: 0xc98a3f,
  guard: 0xe3b95f, ward: 0x69d4dd, banner: 0xd24a37,
};

interface AntParts {
  thorax: Part; abdomen: Part; head: Part; mandibles: Part; antennae: Part[];
  legs: { pivot: Part; foot: Part; front: boolean; side: 1 | -1 }[];
  shield: Part;
}

export default defineUnit<AntParts>({
  id: "ant_guard",
  motion: "ground",
  height: 8,
  durations: { idle: 4.4, attack: 0.8, skill: 1.45, hit: 0.5, move: 0.62 },
  impact: { attack: 0.5, skill: 0.58 },

  build(k, { star }) {
    const thorax = k.part("thorax", null, [0, 4.4, 0]);
    thorax.box([0, 0, 0], [3.8, 3.2, 3.7], C.shell)
      .box([0, 0.7, 0.1], [3.2, 0.5, 3.0], C.shellL)
      .box([0, -1.3, 0.2], [3.2, 0.5, 3.0], C.shellD);

    const abdomen = k.part("abdomen", thorax, [0, 0.1, -2.8]);
    abdomen.box([0, 0, -0.8], [4.4, 3.5, 4.5], C.shellD)
      .box([0, 0.65, -0.55], [3.8, 0.55, 3.8], C.shellL)
      .box([0, -0.45, -2.65], [2.6, 1.6, 1.0], C.shell);

    const head = k.part("head", thorax, [0, 0.6, 2.6]);
    head.box([0, 0, 0.5], [3.8, 2.8, 3.0], C.shell)
      .pair([1.55, 0.45, 1.9], [0.35, 0.7, 0.3], C.eye)
      .pair([1.75, -0.45, 1.55], [0.35, 0.9, 1.1], C.shellD);

    const mandibles = k.part("mandibles", head, [0, -0.65, 2.0]);
    mandibles.pair([1.0, 0, 0.8], [0.55, 0.7, 2.0], C.shellD, { rot: [0, 0.35, 0.08] })
      .pair([1.15, -0.15, 1.65], [0.35, 0.45, 0.7], C.tooth, { rot: [0, 0.35, 0] });

    const antennae: Part[] = [];
    for (const side of [-1, 1] as const) {
      const a0 = k.part(`antenna${side}a`, head, [side * 1.15, 1.45, 1.45]);
      a0.box([side * 0.2, 0.65, 0.55], [0.35, 1.5, 1.3], C.joint, { rot: [-0.35, 0, side * 0.25] });
      const a1 = k.part(`antenna${side}b`, a0, [side * 0.35, 1.25, 1.0]);
      a1.box([side * 0.2, 0.55, 0.45], [0.28, 1.4, 1.1], C.shellD, { rot: [-0.45, 0, side * 0.18] });
      antennae.push(a0, a1);
    }

    const legs: AntParts["legs"] = [];
    for (const side of [-1, 1] as const) for (let i = 0; i < 3; i++) {
      const z = 1.25 - i * 1.45;
      const pivot = k.part(`leg_${side}_${i}`, thorax, [side * 1.65, -0.7, z]);
      pivot.box([side * 0.8, -0.65, 0], [1.9, 0.5, 0.55], C.joint, { rot: [0, 0, side * 0.32] });
      const foot = k.part(`foot_${side}_${i}`, pivot, [side * 1.55, -1.05, 0]);
      foot.box([side * 0.35, -0.55, 0.15], [0.5, 1.5, 0.55], C.shellD, { rot: [0, 0, -side * 0.22] })
        .box([side * 0.48, -1.28, 0.45], [0.7, 0.3, 1.1], C.joint);
      legs.push({ pivot, foot, front: i === 0, side });
    }

    const shield = k.part("shield", thorax, [0, 0.2, 2.15]);
    shield.box([0, 0, 0], [4.6, 3.3, 0.45], C.steel)
      .box([0, 0, 0.28], [3.7, 2.5, 0.18], C.guard)
      .box([0, 0, 0.44], [1.0, 1.0, 0.2], C.ward, { mat: "glow" });

    if (star >= 2) {
      thorax.pair([2.05, 0.85, 0], [0.45, 1.5, 2.8], C.steel);
      shield.box([0, 1.8, 0], [2.6, 0.35, 0.6], C.bronze)
        .pair([1.55, 0, 0.35], [0.35, 1.7, 0.3], C.ward, { mat: "glow" });
    }
    if (star >= 3) {
      const mast = k.part("commandBanner", abdomen, [0, 1.65, -1.1]);
      mast.box([0, 1.7, 0], [0.28, 3.6, 0.28], C.bronze)
        .box([0.9, 2.7, 0], [1.8, 1.0, 0.18], C.banner)
        .box([0, 0.4, 0], [1.4, 0.4, 0.35], C.ward, { mat: "glow" });
    }

    return { thorax, abdomen, head, mandibles, antennae, legs, shield };
  },

  pose(r, c) {
    const tripod = (phase: number) => r.legs.forEach((l, i) => {
      const g = ((i + (l.side > 0 ? 1 : 0)) % 2 ? -1 : 1);
      l.pivot.group.rotation.z = Math.sin(phase) * 0.25 * g * l.side;
      l.foot.group.rotation.x = Math.max(0, Math.sin(phase + g)) * -0.35;
    });
    const feelers = (amp: number) => r.antennae.forEach((a, i) => {
      a.group.rotation.z = Math.sin(c.time * 3.5 + i * 1.7) * amp * (i % 2 ? 0.6 : 1);
      a.group.rotation.x = Math.cos(c.time * 2.2 + i) * amp * 0.3;
    });

    switch (c.state) {
      case "idle":
        r.thorax.group.position.y += Math.sin(c.time * 2.1) * 0.08 - (c.combat ? 0.35 : 0);
        r.head.group.rotation.y = Math.sin(c.time * (c.combat ? 4.5 : 1.4)) * (c.combat ? 0.08 : 0.18);
        r.mandibles.group.rotation.y = Math.sin(c.time * 2.8) * 0.08;
        r.shield.group.rotation.x = c.combat ? -0.16 : 0;
        feelers(c.combat ? 0.15 : 0.28);
        break;
      case "move":
        tripod(c.p * Math.PI * 2);
        r.thorax.group.position.y += Math.abs(Math.sin(c.p * Math.PI * 2)) * 0.2;
        r.abdomen.group.rotation.y = Math.sin(c.p * Math.PI * 2) * 0.08;
        feelers(0.18);
        break;
      case "attack": {
        const s = strike(c.p, 0.5);
        r.thorax.group.position.z += Math.max(0, s) * 1.35;
        r.head.group.rotation.x = -s * 0.25;
        r.mandibles.group.scale.x = 1 + bell(c.p, 0.3, 0.72) * 0.32;
        r.mandibles.group.rotation.y = bell(c.p, 0.36, 0.68) * 0.35;
        feelers(0.12);
        break;
      }
      case "skill": {
        const brace = ramp(c.p, 0, 0.35) * (1 - ramp(c.p, 0.78, 1));
        const pulse = bell(c.p, 0.42, 0.88);
        r.thorax.group.position.y -= brace * 0.55;
        r.shield.group.position.z += brace * 0.75;
        r.shield.group.scale.set(1 + pulse * 0.08, 1 + pulse * 0.12, 1);
        r.shield.group.rotation.x = -brace * 0.22;
        r.legs.forEach((l) => { l.pivot.group.rotation.z = -l.side * brace * 0.18; });
        feelers(0.08);
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.thorax.group.position.z -= h * 0.65;
        r.thorax.group.rotation.z = h * 0.08;
        r.shield.group.rotation.x = h * 0.32;
        r.mandibles.group.rotation.x = h * 0.25;
        feelers(0.35 * h);
        break;
      }
    }
  },
});
