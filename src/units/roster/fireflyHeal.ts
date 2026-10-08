// Đom Đóm Hồi Phục (firefly_heal) — segmented hovering insect with luminous lantern abdomen and glassy wings.
import type { Part } from "../kit";
import { bell, defineUnit, ramp } from "../rig";

const C = {
  shell: 0x3c3a2c, shellL: 0x665f3a, dark: 0x24231d, eye: 0x151611,
  lantern: 0xbdf36a, lanternHot: 0xf6ffb0, wing: 0xb9e7df, vein: 0x6ca99d,
  gold: 0xdab85f, cleanse: 0x89ecff,
};

interface FireflyParts {
  thorax: Part; abdomen: Part; head: Part; antennae: Part[]; wings: Part[];
  legs: Part[]; lantern: Part; crown?: Part;
}

export default defineUnit<FireflyParts>({
  id: "firefly_heal",
  motion: "hover",
  height: 7,
  durations: { idle: 3.4, attack: 0.72, skill: 1.55, hit: 0.42, move: 0.58 },
  impact: { attack: 0.5, skill: 0.6 },

  build(k, { star }) {
    const thorax = k.part("thorax", null, [0, 5.0, 0.2]);
    thorax.box([0, 0, 0], [2.8, 2.6, 2.8], C.shell)
      .box([0, 0.8, 0], [2.3, 0.35, 2.2], C.shellL);

    const abdomen = k.part("abdomen", thorax, [0, -0.2, -2.2]);
    abdomen.box([0, 0, -0.4], [2.5, 2.4, 3.7], C.dark)
      .box([0, 0, -1.95], [2.25, 2.1, 1.0], C.shellL);

    const lantern = k.part("lantern", abdomen, [0, 0, -2.25]);
    lantern.box([0, 0, -0.65], [2.1, 1.9, 1.8], C.lantern, { mat: "glow" })
      .box([0, 0, -1.5], [1.5, 1.3, 0.55], C.lanternHot, { mat: "glow" });

    const head = k.part("head", thorax, [0, 0.2, 1.85]);
    head.box([0, 0, 0], [2.5, 2.0, 2.2], C.shellL)
      .pair([0.78, 0.25, 1.0], [0.45, 0.6, 0.25], C.eye);

    const antennae: Part[] = [];
    for (const side of [-1, 1] as const) {
      const a = k.part(`antenna${side}`, head, [side * 0.7, 0.95, 0.8]);
      a.box([side * 0.2, 0.6, 0.45], [0.22, 1.4, 1.1], C.dark, { rot: [-0.35, 0, side * 0.25] });
      antennae.push(a);
    }

    const wings: Part[] = [];
    for (const side of [-1, 1] as const) {
      const w = k.part(`wing${side}`, thorax, [side * 1.15, 0.55, -0.5]);
      w.box([side * 1.0, 0.05, -0.9], [2.4, 0.16, 3.4], C.wing, { rot: [0.1, 0, side * 0.2], mat: "glass" })
        .box([side * 1.0, 0.1, -0.9], [0.18, 0.2, 3.0], C.vein);
      wings.push(w);
    }

    const legs: Part[] = [];
    for (const side of [-1, 1] as const) for (let i = 0; i < 3; i++) {
      const l = k.part(`leg${side}_${i}`, thorax, [side * 1.1, -0.9, 0.9 - i * 0.9]);
      l.box([side * 0.65, -0.55, 0], [1.5, 0.25, 0.28], C.dark, { rot: [0, 0, side * 0.4] });
      legs.push(l);
    }

    if (star >= 2) {
      thorax.box([0, 1.45, -0.2], [2.2, 0.3, 1.9], C.gold);
      wings.forEach((w, i) => w.box([(i ? 1 : -1) * 1.7, 0.15, -1.0], [0.22, 0.14, 2.3], C.cleanse, { mat: "glow" }));
      lantern.box([0, 0.8, -0.45], [1.4, 0.22, 0.65], C.cleanse, { mat: "glow" });
    }

    let crown: Part | undefined;
    if (star >= 3) {
      crown = k.part("lanternCrown", thorax, [0, 1.65, -0.15]);
      crown.pair([0.85, 0.55, 0], [0.25, 1.35, 0.25], C.lanternHot, { rot: [0, 0, 0.35], mat: "glow" })
        .box([0, 0.95, 0], [0.3, 1.6, 0.3], C.cleanse, { mat: "glow" });
      abdomen.pair([1.35, 0, -0.7], [0.25, 1.1, 1.6], C.gold);
    }

    return { thorax, abdomen, head, antennae, wings, legs, lantern, crown };
  },

  pose(r, c) {
    const buzz = (a: number, speed = 1) => r.wings.forEach((w, i) => {
      w.group.rotation.z = (i ? -1 : 1) * (0.18 + Math.sin(c.time * 16 * speed) * a);
    });
    switch (c.state) {
      case "idle":
        r.thorax.group.position.y += Math.sin(c.time * 2.5) * 0.28;
        r.lantern.group.scale.setScalar(1 + Math.sin(c.time * 4.2) * 0.06);
        r.antennae.forEach((a, i) => a.group.rotation.z = Math.sin(c.time * 2.7 + i) * 0.12);
        buzz(0.08);
        break;
      case "move":
        r.thorax.group.rotation.x = -0.18;
        r.thorax.group.position.y += Math.sin(c.p * Math.PI * 2) * 0.22;
        buzz(0.16, 1.35);
        r.legs.forEach((l, i) => l.group.rotation.x = Math.sin(c.p * Math.PI * 2 + i) * 0.18);
        break;
      case "attack": {
        const h = bell(c.p, 0.25, 0.72);
        r.thorax.group.position.z += h * 0.65;
        r.head.group.rotation.x = -h * 0.24;
        r.lantern.group.scale.setScalar(1 + h * 0.18);
        buzz(0.14, 1.5);
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.3) * (1 - ramp(c.p, 0.84, 1));
        const pulse = bell(c.p, 0.35, 0.82);
        r.thorax.group.position.y += cast * 0.6;
        r.wings[0]!.group.rotation.z = 0.7 * cast;
        r.wings[1]!.group.rotation.z = -0.7 * cast;
        r.lantern.group.scale.setScalar(1 + pulse * 0.5);
        r.abdomen.group.rotation.x = -cast * 0.12;
        if (r.crown) r.crown.group.rotation.y = c.time * 2.8 * cast;
        break;
      }
      case "hit": {
        const h = bell(c.p);
        r.thorax.group.position.z -= h * 0.5;
        r.thorax.group.rotation.z = h * 0.22;
        r.wings.forEach((w, i) => w.group.rotation.z = (i ? 1 : -1) * h * 0.7);
        r.lantern.group.scale.setScalar(1 - h * 0.2);
        break;
      }
    }
  },
});
