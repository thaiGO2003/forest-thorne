// Báo Đốm Săn (jaguar_hunt) — bespoke rig from the approved reference sheet.
// Lean tan feline with dark rosette spots, white muzzle, boxy brown ears, brown paws with white claws,
// long segmented tail with dark tip. Body → neck → head is one connected chain (A24, A90.2).
// Idle: watch/sniff/head dip/tail flick · Move: four-leg gallop · Attack: low lunge + bite/swipe ·
// Skill (Săn Mồi): crouch → leap → slash → land. 2★ dark dorsal mane; 3★ shoulder guards + fang charm.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, strike } from "../rig";

const C = {
  tan: 0xe2b26a, tanL: 0xf0c987, tanD: 0xc8954e, spot: 0x3a2414, brown: 0x6b3f22, brownD: 0x4a2a16,
  white: 0xf6f1e6, nose: 0x3b2414, eye: 0x1e120a, claw: 0xffffff, mouth: 0xb23a2e, fang: 0xfff6e6,
  mane: 0x5a3418, guard: 0x7a4a26, charm: 0xd8433a,
};

interface JaguarParts {
  torso: Part; chest: Part; neck: Part; head: Part; jaw: Part; ears: Part;
  legs: { hip: Part; paw: Part; front: boolean; side: 1 | -1 }[];
  tail: Part[];
}

export default defineUnit<JaguarParts>({
  id: "jaguar_hunt",
  motion: "ground",
  height: 10,
  durations: { idle: 5, attack: 0.85, skill: 1.6, hit: 0.5, move: 0.6 },
  impact: { attack: 0.5, skill: 0.62 },

  build(k, { star }) {
    // Torso pivot at mid-back; chest is a child so the front can lift independently during leaps.
    const torso = k.part("torso", null, [0, 5.6, -0.6]);
    torso.box([0, 0, -1.4], [3.8, 3.2, 5.2], C.tan)
      .box([0, -1.5, -1.4], [3.2, 0.4, 4.6], C.tanL) // pale belly
      .spots([0, 0, -1.4], [3.8, 3.2, 5.2], C.spot, 18, 101, 0.75);

    const chest = k.part("chest", torso, [0, 0.1, 1.2]);
    chest.box([0, 0, 1.0], [4.0, 3.4, 3.2], C.tan)
      .box([0, -1.2, 1.6], [2.6, 1.0, 2.2], C.tanL)
      .spots([0, 0, 1.0], [4.0, 3.4, 3.2], C.spot, 10, 113, 0.7);

    // Neck overlaps both chest and head so no gap opens in any pose.
    const neck = k.part("neck", chest, [0, 0.6, 2.4]);
    neck.box([0, 0.5, 0.6], [2.8, 2.8, 2.4], C.tan)
      .spots([0, 0.5, 0.6], [2.8, 2.8, 2.4], C.spot, 5, 127, 0.6);

    const head = k.part("head", neck, [0, 1.4, 1.6]);
    head.box([0, 0.3, 0.6], [3.6, 3.0, 3.0], C.tan) // broad feline skull
      .box([0, -0.4, 2.5], [2.6, 1.8, 1.6], C.white) // muzzle block
      .box([0, 0.25, 3.35], [1.0, 0.6, 0.2], C.nose)
      .pair([0.95, 0.9, 2.12], [0.6, 0.6, 0.14], C.eye)
      .pair([1.0, 1.25, 2.1], [0.9, 0.25, 0.2], C.tanD) // brow
      .pair([1.82, 0.0, 0.8], [0.12, 1.6, 1.8], C.tanD) // cheeks
      .spots([0, 1.0, 0.2], [3.6, 1.6, 2.0], C.spot, 5, 131, 0.55);

    const ears = k.part("ears", head, [0, 1.9, 0.2]);
    ears.pair([1.3, 0.6, 0], [1.0, 1.3, 0.8], C.brown)
      .pair([1.3, 0.45, 0.42], [0.5, 0.7, 0.06], C.brownD);

    const jaw = k.part("jaw", head, [0, -1.25, 1.5]);
    jaw.box([0, -0.25, 1.0], [2.4, 0.6, 1.6], C.white)
      .box([0, 0.08, 0.9], [1.8, 0.12, 1.2], C.mouth)
      .pair([0.65, 0.3, 1.65], [0.25, 0.5, 0.25], C.fang);

    // Legs: hip pivot carries the upper limb; paw is its own joint (brown sock + white claws).
    const legs = ([[1, true], [-1, true], [1, false], [-1, false]] as const).map(([side, front]) => {
      const at: [number, number, number] = front ? [side * 1.45, -1.0, 1.6] : [side * 1.45, -0.8, -3.0];
      const hip = k.part(`${front ? "f" : "h"}leg${side}`, front ? chest : torso, at);
      hip.box([0, -1.4, 0], [1.3, 3.0, 1.4], C.tan)
        .box([side * 0.66, -1.2, 0.1], [0.1, 0.6, 0.6], C.spot);
      if (!front) hip.box([0, 0.1, -0.2], [1.6, 1.4, 2.0], C.tan); // haunch mass
      const paw = k.part(`${front ? "f" : "h"}paw${side}`, hip, [0, -3.0, 0]);
      paw.box([0, -0.9, 0.1], [1.25, 1.9, 1.35], C.brown)
        .box([0, -1.75, 0.45], [1.45, 0.5, 1.8], C.brownD);
      for (const dx of [-0.42, 0, 0.42]) paw.box([dx, -1.85, 1.45], [0.3, 0.35, 0.35], C.claw);
      return { hip, paw, front, side };
    });

    // Tail: 6 chained segments, last two dark-tipped and chunky like the sheet.
    const tail: Part[] = [];
    let parent = torso;
    for (let i = 0; i < 6; i++) {
      const seg = k.part(`tail${i}`, parent, i === 0 ? [0, 0.9, -4.0] : [0, 0, -1.3]);
      const tip = i >= 4, w = tip ? 1.3 : 1.0 - i * 0.04;
      seg.box([0, 0, -0.65], [w, w, 1.45], tip ? C.brown : C.tan);
      if (!tip && i % 2 === 1) seg.box([0, w / 2 + 0.05, -0.6], [0.5, 0.12, 0.5], C.spot);
      tail.push(seg);
      parent = seg;
    }

    if (star >= 2) {
      // Dark dorsal mane running neck → back.
      neck.box([0, 2.05, 0.4], [1.2, 0.6, 2.4], C.mane);
      chest.box([0, 1.85, 0.9], [1.4, 0.5, 3.0], C.mane);
      torso.box([0, 1.75, -1.2], [1.2, 0.45, 4.6], C.mane);
      ears.pair([1.3, 1.35, 0], [0.5, 0.4, 0.4], C.brownD); // ear tufts
    }
    if (star >= 3) {
      // Leather shoulder guards + fang charm on the throat; claws glow faintly red.
      chest.pair([2.05, 0.7, 1.2], [0.4, 2.0, 2.6], C.guard).pair([2.25, 1.4, 1.2], [0.2, 0.5, 2.2], C.brownD);
      neck.box([0, -0.7, 1.8], [2.6, 0.3, 0.3], C.brownD)
        .box([0, -1.15, 1.95], [0.4, 0.7, 0.3], C.fang)
        .box([0, -1.55, 1.95], [0.3, 0.3, 0.3], C.charm, { mat: "glow" });
      for (const l of legs) if (l.front) l.paw.box([0, -1.85, 1.65], [1.2, 0.12, 0.12], C.charm, { mat: "glow" });
    }

    return { torso, chest, neck, head, jaw, ears, legs, tail };
  },

  pose(r, c) {
    const { torso, chest, neck, head, jaw, ears, legs, tail } = r;
    const swish = (amp: number, speed: number, lift = 0) => tail.forEach((s, i) => {
      s.group.rotation.y = Math.sin(c.time * speed - i * 0.55) * amp * (0.4 + i * 0.15);
      s.group.rotation.x = lift * (i === 0 ? 0.6 : 0.08) + Math.sin(c.time * speed * 0.7 - i * 0.4) * amp * 0.15;
    });

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          // Cảnh giác: low stalking crouch, head level and forward, ears pinned, tail low and twitching.
          torso.group.position.y -= 0.7;
          chest.group.rotation.x = 0.12;
          head.group.rotation.x = -0.05 + Math.sin(c.time * 2.4) * 0.03;
          ears.group.rotation.x = -0.35;
          jaw.group.rotation.x = Math.max(0, Math.sin(c.time * 1.3)) ** 6 * 0.4; // occasional snarl
          for (const l of legs) l.hip.group.rotation.x = l.front ? -0.15 : 0.2;
          swish(0.35, 5, -0.25);
        } else {
          // Inspection idle cycle: watch (0–.3) → sniff (.3–.5) → head dip (.5–.75) → tail flick (.75–1).
          const ph = c.p % 1;
          const sniff = bell(ph, 0.3, 0.5), dip = bell(ph, 0.5, 0.75), flick = bell(ph, 0.75, 1);
          torso.group.scale.y = 1 + Math.sin(c.time * 2.1) * 0.015;
          neck.group.rotation.x = dip * 0.55 - sniff * 0.15;
          head.group.rotation.y = Math.sin(ph * Math.PI * 2) * 0.35 * (1 - dip);
          head.group.rotation.x = sniff * Math.sin(c.time * 22) * 0.04 + dip * 0.2;
          ears.group.rotation.z = sniff * Math.sin(c.time * 9) * 0.08;
          swish(0.18 + flick * 0.5, 2.2 + flick * 6, 0.35);
        }
        break;
      }
      case "move": {
        // Rotary gallop: fronts and hinds out of phase, spine flexes, head steadied by neck counter-pitch.
        const w = c.p * Math.PI * 2;
        legs.forEach((l) => {
          const phase = w + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0.35 : 0);
          l.hip.group.rotation.x = Math.sin(phase) * 0.75;
          l.paw.group.rotation.x = Math.max(0, -Math.cos(phase)) * -0.9;
        });
        chest.group.rotation.x = Math.sin(w) * 0.1;
        torso.group.position.y += Math.abs(Math.sin(w)) * 0.5;
        neck.group.rotation.x = -Math.sin(w) * 0.12;
        swish(0.12, 8, 0.15);
        break;
      }
      case "attack": {
        // Lao tới → Cắn/Quật: rear legs load, body lunges low, jaw opens at impact, front paw swipes.
        const s = strike(c.p, 0.5), lunge = Math.max(0, s);
        torso.group.position.z += lunge * 2.2;
        torso.group.position.y -= ramp(c.p, 0, 0.35) * 0.6 * (1 - lunge);
        chest.group.rotation.x = -lunge * 0.18;
        neck.group.rotation.x = -lunge * 0.3;
        jaw.group.rotation.x = bell(c.p, 0.38, 0.75) * 0.8;
        ears.group.rotation.x = -0.4 * lunge;
        const swipe = legs[0]!;
        swipe.hip.group.rotation.x = -bell(c.p, 0.35, 0.7) * 1.3;
        swipe.hip.group.rotation.z = bell(c.p, 0.45, 0.75) * 0.5;
        for (const l of legs) if (!l.front) l.hip.group.rotation.x = -s * 0.5;
        swish(0.3, 9, -0.1);
        break;
      }
      case "skill": {
        // Săn Mồi: crouch (0–.25) → leap arc (.25–.6) → slash at impact → land & recover (.7–1).
        const crouch = bell(c.p, 0, 0.32), air = bell(c.p, 0.25, 0.7), land = bell(c.p, 0.65, 1);
        torso.group.position.y += -crouch * 1.2 + air * 4.5 - land * 0.6;
        torso.group.position.z += ramp(c.p, 0.25, 0.65) * 3.2 * (1 - ramp(c.p, 0.75, 1));
        torso.group.rotation.x = -air * 0.35 + land * 0.15;
        legs.forEach((l) => {
          l.hip.group.rotation.x = l.front ? -air * 1.3 + crouch * 0.3 : air * 1.0 - crouch * 0.6;
          l.paw.group.rotation.x = l.front ? air * 0.6 : -air * 0.4;
        });
        jaw.group.rotation.x = bell(c.p, 0.5, 0.75) * 0.9;
        neck.group.rotation.x = -air * 0.2;
        ears.group.rotation.x = -0.5 * (air + crouch);
        swish(0.2, 6, air * 0.6 - crouch * 0.3);
        break;
      }
      case "hit": {
        // Bị đánh trúng → lùi lại → phục hồi: recoil back, head flinches, paws stay planted.
        const k = bell(c.p, 0, 1);
        torso.group.position.z -= k * 0.9;
        torso.group.rotation.z = k * 0.12;
        neck.group.rotation.x = k * 0.35;
        head.group.rotation.y = -k * 0.25;
        ears.group.rotation.x = -k * 0.5;
        for (const l of legs) l.hip.group.rotation.x = (l.front ? 1 : -1) * k * 0.15;
        swish(0.4 * k, 14, -0.2);
        break;
      }
    }
  },
});
