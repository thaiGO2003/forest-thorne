// Kỳ Nhông Phun Lửa (salamander_flame) — long-bodied salamander with flame glands and a breath-casting throat.
import type { Part } from "../kit";
import { bell, defineUnit, ramp } from "../rig";

const C = { skin: 0x6a3429, light: 0x984735, belly: 0xd59a65, dark: 0x40231f, eye: 0xffcf4d, toe: 0xd9b57f, gland: 0xf15932, flame: 0xff9e3d, hot: 0xffea78, gold: 0xdab55f };
interface SalamanderParts {
  body: Part; throat: Part; head: Part; jaw: Part;
  legs: { hip: Part; foot: Part; side: 1 | -1; front: boolean }[]; tail: Part[]; glands: Part[];
}

export default defineUnit<SalamanderParts>({
  id: "salamander_flame", motion: "ground", height: 6,
  durations: { idle: 4, attack: 0.78, skill: 1.45, hit: 0.45, move: 0.62 },
  impact: { attack: 0.5, skill: 0.6 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 3.2, -0.8]);
    body.box([0, 0, -0.3], [4, 2.4, 5.4], C.skin).box([0, -0.8, 0.2], [3.2, 0.8, 4.2], C.belly);
    const throat = k.part("throat", body, [0, 0.1, 2.15]);
    throat.box([0, -0.1, 0.5], [3.4, 2.4, 2.5], C.belly).box([0, 0.4, 1], [2.5, 1.2, 1.3], C.light);
    const head = k.part("head", throat, [0, 0.45, 1.8]);
    head.box([0, 0, 0.65], [3.7, 2.3, 3.2], C.light).pair([1.1, 0.5, 1.8], [0.38, 0.48, 0.18], C.eye, { mat: "glow" });
    const jaw = k.part("jaw", head, [0, -0.7, 1.45]);
    jaw.box([0, 0, 0.7], [3, 0.75, 2], C.dark).box([0, -0.1, 1.55], [2.2, 0.2, 0.6], C.gland);
    const legs: SalamanderParts["legs"] = [];
    for (const side of [-1, 1] as const) for (const front of [true, false]) {
      const hip = k.part(`hip${front}${side}`, body, [side * 1.6, -0.45, front ? 1.2 : -1.7]);
      hip.box([side * 0.65, -0.48, 0], [1.7, 0.7, 1.1], C.light, { rot: [0, 0, side * 0.32] });
      const foot = k.part(`foot${front}${side}`, hip, [side * 1.3, -0.7, 0.5]);
      foot.box([0, -0.17, 0.55], [1.2, 0.38, 1.45], C.skin);
      for (const x of [-0.42, 0, 0.42]) foot.box([x, -0.17, 1.35], [0.18, 0.16, 0.6], C.toe);
      legs.push({ hip, foot, side, front });
    }
    const tail: Part[] = [];
    let tailParent = body;
    for (let i = 0; i < 4; i++) {
      const segment = k.part(`tail${i}`, tailParent, i === 0 ? [0, 0.05, -3] : [0, 0, -1.5]);
      segment.box([0, 0, -0.75], [2.5 - i * 0.42, 1.45 - i * 0.18, 1.9], i % 2 ? C.light : C.skin);
      tail.push(segment);
      tailParent = segment;
    }
    const glands: Part[] = [];
    for (let i = 0; i < 3; i++) {
      const gland = k.part(`flameGland${i}`, body, [0, 1.15, 0.8 - i * 1.45]);
      gland.box([0, 0.3, 0], [0.9, 0.95, 0.9], C.gland, { mat: "glow" });
      glands.push(gland);
    }
    if (star >= 2) {
      throat.box([0, 1.25, 0.65], [2.4, 0.28, 1.4], C.gold);
      glands.forEach((gland, i) => gland.box([0, 0.9, 0], [0.42, 0.9 + i * 0.08, 0.42], C.flame, { mat: "glow" }));
    }
    if (star >= 3) {
      head.pair([1.45, 1.05, 0.2], [0.4, 1.2, 0.5], C.hot, { rot: [0, 0, 0.25], mat: "glow" });
      tail[0]!.box([0, 1.05, -0.8], [0.45, 1, 0.45], C.flame, { mat: "glow" });
    }
    return { body, throat, head, jaw, legs, tail, glands };
  },
  pose(r, c) {
    switch (c.state) {
      case "idle":
        r.body.group.position.y += Math.sin(c.time * 1.7) * 0.05;
        r.head.group.rotation.y = Math.sin(c.time * 0.8) * (c.combat ? 0.05 : 0.13);
        r.throat.group.scale.y = 1 + Math.max(0, Math.sin(c.time * 1.4)) ** 6 * 0.08;
        break;
      case "move": {
        const walk = c.p * Math.PI * 2;
        for (const leg of r.legs) {
          const phase = walk + (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0.4 : 0);
          leg.hip.group.rotation.x = Math.sin(phase) * 0.46;
          leg.foot.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.3;
        }
        r.tail.forEach((segment, i) => { segment.group.rotation.y = Math.sin(walk - i * 0.6) * 0.18; });
        break;
      }
      case "attack": {
        const pulse = bell(c.p, 0.28, 0.72);
        r.body.group.position.z += pulse * 0.65;
        r.head.group.rotation.x = -pulse * 0.2;
        r.jaw.group.rotation.x = pulse * 0.48;
        break;
      }
      case "skill": {
        const cast = ramp(c.p, 0, 0.24) * (1 - ramp(c.p, 0.88, 1));
        const pulse = bell(c.p, 0.3, 0.82);
        r.throat.group.scale.set(1 + pulse * 0.18, 1 + pulse * 0.45, 1 + pulse * 0.22);
        r.head.group.rotation.x = -cast * 0.28;
        r.jaw.group.rotation.x = cast * 0.72;
        r.glands.forEach((gland, i) => { gland.group.scale.setScalar(1 + pulse * (0.2 + i * 0.04)); });
        break;
      }
      case "hit": {
        const recoil = bell(c.p);
        r.body.group.position.z -= recoil * 0.48;
        r.body.group.rotation.z = -recoil * 0.09;
        r.head.group.rotation.x = recoil * 0.3;
        r.jaw.group.rotation.x = recoil * 0.18;
        break;
      }
    }
  },
});
