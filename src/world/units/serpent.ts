// Serpent body plan: head → 4-6 torso/body segments → tapering tail (spec 22.4).
// Continuous sine-wave slither on ground, strike lunge on attack. Front = +z.
import { strike, wave, type Box, type Pose, type Rig } from "./kit";

export interface SerpentSpec {
  scale: number; belly: number; dark: number; eye?: number;
  segments?: number;
  thickness?: number;
  hood?: boolean; // cobra hood
  rattle?: boolean;
  crest?: boolean;
}

export function serpent(s: SerpentSpec): (r: Rig) => Pose {
  return (r) => {
    const segs = s.segments ?? 5;
    const th = s.thickness ?? 4;
    const eye = s.eye ?? 0xffdd00;

    // Head
    const headBoxes: Box[] = [
      [0, 0, 0, th, th * 0.8, th * 1.2, s.scale],
      [0, -th * 0.25, th * 0.2, th - 0.8, 0.8, th, s.belly],
      // Eyes
      [-th * 0.45, th * 0.25, th * 0.2, 0.8, 0.8, 0.8, eye],
      [th * 0.45, th * 0.25, th * 0.2, 0.8, 0.8, 0.8, eye],
      // Tongue
      [0, -th * 0.2, th * 0.9, 0.6, 0.2, 1.4, 0xdd2233],
    ];

    if (s.hood) {
      // Cobra flared hood
      headBoxes.push([-th * 0.8, 0, -th * 0.2, th * 0.8, 0.6, th * 1.5, s.scale]);
      headBoxes.push([th * 0.8, 0, -th * 0.2, th * 0.8, 0.6, th * 1.5, s.scale]);
    }

    r.part("head", [0, th * 0.6, 0], headBoxes);

    // Body segments linked behind head
    let prev = "head";
    const segLen = th * 1.1;
    for (let i = 0; i < segs; i++) {
      const name = `seg_${i}`;
      const factor = 1 - (i / segs) * 0.45;
      const w = Math.max(1.5, th * factor);
      const h = Math.max(1.2, th * 0.7 * factor);
      const boxes: Box[] = [
        [0, 0, -segLen / 2, w, h, segLen, (i % 2 === 0 ? s.scale : s.dark)],
        [0, -h / 2 + 0.3, -segLen / 2, w - 0.6, 0.6, segLen - 0.2, s.belly],
      ];
      if (i === segs - 1 && s.rattle) {
        boxes.push([0, 0.4, -segLen, 1.2, 1.2, 1.5, 0xd4a373]);
      }
      r.part(name, [0, 0, -segLen], boxes, prev);
      prev = name;
    }

    return (p, state, t, k, sig) => {
      const hz = state === "move" ? 2.5 : state === "attack" ? 3.0 : 1.2;
      const amp = state === "attack" ? 0.35 : 0.25;

      // Head undulation and pitch
      if (p.head) {
        if (state === "attack") {
          const lunge = strike(k, 0.3, 0.5);
          p.head.position.z = lunge * 6;
          p.head.rotation.x = -lunge * 0.3;
          p.head.rotation.y = 0;
        } else if (state === "hit") {
          p.head.position.z = -wave(t, 6) * 1.5;
          p.head.rotation.x = 0.4;
          p.head.rotation.y = wave(t, 4) * 0.3;
        } else {
          p.head.position.z = 0;
          p.head.rotation.x = wave(t, hz * 0.5, sig) * 0.08;
          p.head.rotation.y = wave(t, hz, sig) * (amp * 0.6);
        }
      }

      // Propagate wave down segments
      for (let i = 0; i < segs; i++) {
        const seg = p[`seg_${i}`];
        if (!seg) continue;
        const phase = sig + (i + 1) * 0.15;
        seg.rotation.y = wave(t, hz, phase) * amp;
        seg.rotation.x = wave(t, hz * 0.5, phase) * 0.05;
      }
    };
  };
}
