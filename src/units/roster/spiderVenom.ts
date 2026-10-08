// Nhện Độc Giăng Tơ (spider_venom) — low hunting spider with eight articulated legs, venom fangs and web-trap anatomy.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  shell: 0x3c283e,
  light: 0x68466b,
  dark: 0x211821,
  eye: 0xf06cff,
  fang: 0x9d7aab,
  venom: 0x8cff73,
  web: 0xcfd5df,
  silver: 0xaeb6c7,
};

interface SpiderParts {
  abdomen: Part;
  thorax: Part;
  head: Part;
  fangs: Part[];
  legs: { leg: Part; side: 1 | -1; row: number }[];
  spinneret: Part;
  webAnchor: Part;
}

export default defineUnit<SpiderParts>({
  id: "spider_venom",
  motion: "ground",
  height: 6,
  durations: { idle: 4.2, attack: 0.76, skill: 1.42, hit: 0.44, move: 0.58 },
  impact: { attack: 0.5, skill: 0.66 },

  build(k, { star }) {
    const abdomen = k.part("abdomen", null, [0, 3.1, -1.25]);
    abdomen.box([0, 0, -0.4], [4.5, 3.1, 4.7], C.shell)
      .box([0, 1, -0.45], [3.5, 0.5, 3.5], C.light);

    const thorax = k.part("thorax", abdomen, [0, -0.1, 2.45]);
    thorax.box([0, 0, 0.4], [3.8, 2.4, 3.1], C.light)
      .box([0, -0.75, 0.7], [3.1, 0.55, 2.2], C.dark);

    const head = k.part("head", thorax, [0, 0.1, 1.9]);
    head.box([0, 0, 0.5], [3.1, 1.9, 2.5], C.dark)
      .pair([0.78, 0.42, 1.45], [0.32, 0.36, 0.18], C.eye, { mat: "glow" })
      .pair([1.15, 0.12, 1.2], [0.22, 0.26, 0.16], C.eye, { mat: "glow" });

    const fangs: Part[] = [];
    for (const side of [-1, 1] as const) {
      const fang = k.part(`fang${side}`, head, [side * 0.72, -0.45, 1.45]);
      fang.box([0, -0.45, 0.45], [0.45, 1.2, 0.5], C.fang, { rot: [0.28, 0, side * 0.12] })
        .box([0, -0.95, 0.65], [0.24, 0.55, 0.24], C.venom, { mat: "glow" });
      fangs.push(fang);
    }

    const legs: SpiderParts["legs"] = [];
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < 4; row++) {
        const z = 1.35 - row * 1.15;
        const leg = k.part(`leg${side}_${row}`, thorax, [side * 1.55, -0.25, z]);
        leg.box([side * 1.25, 0, 0], [2.8, 0.38, 0.52], C.light, { rot: [0, 0, side * (0.12 + row * 0.05)] })
          .box([side * 2.35, -0.72, 0.08], [1.45, 0.34, 0.46], C.dark, { rot: [0, 0, -side * (0.25 + row * 0.03)] });
        legs.push({ leg, side, row });
      }
    }

    const spinneret = k.part("spinneret", abdomen, [0, -0.35, -2.6]);
    spinneret.pair([0.62, -0.1, -0.25], [0.55, 0.7, 1.1], C.web)
      .box([0, -0.25, -0.95], [0.42, 0.42, 0.75], C.web);

    const webAnchor = k.part("webAnchor", abdomen, [0, 0.25, -3.35]);
    webAnchor.box([0, 0, -0.4], [0.22, 0.22, 1.4], C.web, { mat: "glass" })
      .pair([0.7, 0, -0.65], [1.55, 0.16, 0.18], C.web, { rot: [0, 0, 0.5], mat: "glass" })
      .pair([0.7, 0, -0.65], [1.55, 0.16, 0.18], C.web, { rot: [0, 0, -0.5], mat: "glass" });

    if (star >= 2) {
      abdomen.pair([1.55, 0.95, -0.3], [0.35, 0.5, 2.8], C.silver);
      fangs.forEach((fang) => fang.box([0, -1.25, 0.8], [0.3, 0.45, 0.3], C.venom, { mat: "glow" }));
      spinneret.pair([0.72, -0.15, -0.8], [0.28, 0.7, 0.55], C.venom, { mat: "glow" });
    }
    if (star >= 3) {
      const crown = k.part("webCrown", abdomen, [0, 1.75, -0.1]);
      crown.pair([0.85, 0.55, 0], [0.35, 1.25, 0.35], C.web, { rot: [0, 0, 0.42], mat: "glass" })
        .box([0, 0.95, 0], [0.38, 1.45, 0.38], C.venom, { mat: "glow" });
      webAnchor.pair([1.2, 0.2, -0.9], [2.6, 0.14, 0.14], C.web, { mat: "glass" });
    }
    return { abdomen, thorax, head, fangs, legs, spinneret, webAnchor };
  },

  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.abdomen.group.position.y += Math.sin(c.time * 1.6) * 0.05 - (c.combat ? 0.12 : 0);
        r.head.group.rotation.y = Math.sin(c.time * 0.9) * (c.combat ? 0.04 : 0.1);
        r.fangs.forEach((fang, i) => { fang.group.rotation.z = (i ? -1 : 1) * Math.sin(c.time * 1.8) * 0.04; });
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        for (const leg of r.legs) {
          const phase = walk + leg.row * 0.78 + (leg.side > 0 ? Math.PI : 0);
          leg.leg.group.rotation.z = Math.sin(phase) * 0.24 * leg.side;
          leg.leg.group.rotation.x = Math.cos(phase) * 0.1;
        }
        r.abdomen.group.position.y += Math.abs(Math.sin(walk * 2)) * 0.07;
        break;
      }
      case "attack": {
        const lunge = strike(c.p, 0.5);
        r.thorax.group.position.z += Math.max(0, lunge) * 0.58;
        r.head.group.rotation.x = -Math.max(0, lunge) * 0.18;
        r.fangs.forEach((fang, i) => { fang.group.rotation.z = (i ? -1 : 1) * bell(c.p, 0.2, 0.58) * 0.28; });
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.28) * (1 - ramp(c.p, 0.86, 1));
        const pulse = bell(c.p, 0.34, 0.78);
        r.abdomen.group.position.z -= cast * 0.3;
        r.spinneret.group.rotation.x = cast * 0.55;
        r.spinneret.group.scale.set(1 + pulse * 0.14, 1 + pulse * 0.14, 1 + pulse * 0.28);
        r.webAnchor.group.position.z -= pulse * 1.2;
        r.webAnchor.group.scale.setScalar(1 + pulse * 0.42);
        r.legs.forEach(({ leg, side, row }) => { leg.group.rotation.z = side * cast * (0.08 + row * 0.02); });
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.abdomen.group.position.z -= recoil * 0.45;
        r.abdomen.group.rotation.z = recoil * 0.1;
        r.head.group.rotation.x = recoil * 0.28;
        r.legs.forEach(({ leg, side }) => { leg.group.rotation.z = side * recoil * 0.1; });
        break;
      }
    }
  },
});
