// Bướm Cỏ — grass butterfly, flying wings and sequential storm casting.
import type { Part } from "../kit";
import { defineUnit, ramp } from "../rig";

interface GrassButterflyParts { body: Part; wings: { upper: Part; lower: Part; side: 1 | -1 }[]; antennae: Part[] }
const GREEN = 0x78bc43, DARK = 0x35692d, PALE = 0xc7e87e, EYE = 0x1f3722, GOLD = 0xe9dc73;

export default defineUnit<GrassButterflyParts>({
  id: "butterfly_mirror",
  motion: "fly",
  height: 10,
  durations: { idle: 3.4, attack: 0.8, skill: 1.4, hit: 0.45, move: 0.65 },
  impact: { attack: 0.5, skill: 0.55 },
  build(k, { star }) {
    const body = k.part("body", null, [0, 3, 0]);
    body.box([0, 0, 0], [1.7, 2.8, 1.5], GREEN);
    body.box([0, 1.5, 0.25], [2.25, 1.9, 2], PALE)
      .pair([0.58, 1.7, 1.3], [0.35, 0.45, 0.13], EYE);
    body.box([0, -1.65, -0.2], [0.8, 1.2, 0.9], DARK);
    const wings = ([1, -1] as const).map(side => {
      const upper = k.part(side > 0 ? "upperR" : "upperL", body, [side * 0.85, 0.45, -0.6]);
      const lower = k.part(side > 0 ? "lowerR" : "lowerL", body, [side * 0.75, -0.6, -0.5]);
      upper.box([side * 1.9, 0.9, 0], [3.5, 3.25, 0.28], GREEN)
        .box([side * 1.8, 0.9, 0.18], [2.4, 2.25, 0.1], PALE)
        .box([side * 2.0, 1.05, 0.24], [0.85, 0.95, 0.1], GOLD);
      lower.box([side * 1.55, -0.5, 0], [2.8, 2.2, 0.25], DARK)
        .box([side * 1.45, -0.45, 0.17], [1.75, 1.4, 0.08], GREEN);
      if (star >= 2) upper.box([side * 3.25, 1.85, 0.16], [0.55, 0.8, 0.25], GOLD, { mat: "glow" });
      if (star >= 3) lower.box([side * 2.2, -0.8, 0.15], [0.65, 0.7, 0.2], GOLD, { mat: "glow" });
      return { upper, lower, side };
    });
    const antennae = ([1, -1] as const).map(side => {
      const ant = k.part(side > 0 ? "antR" : "antL", body, [side * 0.45, 2.35, 0]);
      ant.box([side * 0.22, 0.8, 0], [0.2, 1.55, 0.25], DARK, { rot: [0.2, 0, side * -0.2] })
        .box([side * 0.4, 1.55, 0.2], [0.5, 0.5, 0.45], GOLD);
      return ant;
    });
    return { body, wings, antennae };
  },
  pose(r, c) {
    const t = c.time;
    const cast = c.state === "skill" ? ramp(c.p, 0.05, 0.55) * (1 - ramp(c.p, 0.65, 1)) : 0;
    const flap = Math.sin(t * (c.state === "skill" ? 12 : 5.2)) * 0.3;
    r.body.group.position.y += Math.sin(t * 3.2) * 0.24 + cast * 0.42;
    r.body.group.rotation.z = Math.sin(t * 1.8) * 0.05;
    for (const w of r.wings) {
      w.upper.group.rotation.y = -w.side * (0.4 + flap + cast * 0.65);
      w.lower.group.rotation.y = -w.side * (0.26 + flap * 0.8 + cast * 0.35);
    }
    for (let i = 0; i < r.antennae.length; i++) {
      r.antennae[i]!.group.rotation.z = (i ? -1 : 1) * Math.sin(t * 2.1) * 0.1;
    }
    if (c.state === "hit") r.body.group.rotation.x = Math.sin(c.p * Math.PI) * 0.3;
  },
});