// Quadruped body plan: connected torso → neck → head, four articulated legs, segmented tail.
// Species differ by authored proportions + features (ears, horns, mane, trunk, spots, shell),
// not by recolour alone (A24). Front = +z.
import { mirror, strike, wave, type Box, type Pose, type Rig } from "./kit";

export interface QuadSpec {
  coat: number; belly: number; dark: number; accent?: number;
  /** Torso length/width/height in voxels. */
  len: number; wid: number; hgt: number;
  leg: number; legW?: number;
  head: number; snout?: number;
  ears?: "fox" | "round" | "cat" | "long" | "none";
  horns?: "ram" | "bull" | "rhino" | "tri" | "antler" | "tusk";
  tail?: "bushy" | "thin" | "long" | "stub" | "flame";
  mane?: boolean; spots?: boolean; stripes?: boolean; trunk?: boolean; shell?: boolean; hump?: boolean;
  gait?: "trot" | "prowl" | "stomp" | "hop";
}

export function quadruped(s: QuadSpec): (r: Rig) => Pose {
  return (r) => {
    const { len: L, wid: W, hgt: H, leg, head: hd } = s;
    const lw = s.legW ?? Math.max(2, Math.round(W / 3));
    const y0 = leg + H / 2;
    // Torso with belly and back marks; pivot at body centre.
    const torso: Box[] = [
      [0, 0, 0, W, H, L, s.coat],
      [0, -H / 2 + 0.6, 0, W - 1, 1.2, L - 2, s.belly],
    ];
    if (s.spots) for (let i = 0; i < 6; i++) torso.push([((i * 5) % 3 - 1) * (W / 3), H / 2 + 0.1, (i / 5 - 0.5) * (L - 3), 1.6, 0.4, 1.6, s.dark]);
    if (s.stripes) for (let i = 0; i < 4; i++) torso.push([0, H / 2 + 0.1, (i / 3 - 0.5) * (L - 3), W + 0.2, 0.4, 0.9, s.dark]);
    if (s.hump) torso.push([0, H / 2 + 1, -L / 6, W - 1, 2, L / 3, s.coat]);
    if (s.shell) torso.push([0, H / 2 + 1.2, 0, W + 1, 2.4, L + 1, s.accent ?? s.dark], [0, H / 2 + 2.6, 0, W - 1, 1, L - 2, s.dark]);
    r.part("torso", [0, y0, 0], torso);
    // Neck overlaps torso front and head back — no gap in any pose (A24 Jaguar rule).
    const neckZ = L / 2 - 1;
    r.part("neck", [0, H / 4, neckZ], [[0, 1, 1, W - 2, H * 0.8, 3, s.coat]], "torso");
    if (s.mane) r.part("mane", [0, 0, 0], [[0, 1.5, 0.5, W + 2, H + 1, 4, s.accent ?? s.dark]], "neck");
    const head: Box[] = [
      [0, 0, 1.5, hd, hd, hd, s.coat],
      [0, -hd / 2 + 1, hd / 2 + 1.5 + (s.snout ?? 2) / 2, hd - 2, hd / 2, s.snout ?? 2, s.belly],
      [0, -hd / 2 + 1 + hd / 4, hd / 2 + 1.5 + (s.snout ?? 2), 1.4, 1, 0.6, 0x1b1410],
      ...mirror([[hd / 2 - 1, 0.8, hd + 0.2, 1, 1.2, 0.6, 0x15110f]]),
      [hd / 2 - 1, 0.8, hd + 0.2, 1, 1.2, 0.6, 0x15110f],
      [hd / 2 - 0.8, 1.1, hd + 0.35, 0.4, 0.4, 0.4, 0xffffff],
      [-hd / 2 + 1.2, 1.1, hd + 0.35, 0.4, 0.4, 0.4, 0xffffff],
    ];
    const ears = s.ears ?? "round";
    const ey = hd / 2;
    if (ears === "fox") head.push([hd / 2 - 1, ey + 1.5, 1, 2, 3, 1, s.coat], [-hd / 2 + 1, ey + 1.5, 1, 2, 3, 1, s.coat], [hd / 2 - 1, ey + 2.6, 1, 1, 1, 1.1, s.dark], [-hd / 2 + 1, ey + 2.6, 1, 1, 1, 1.1, s.dark]);
    if (ears === "cat") head.push([hd / 2 - 1, ey + 0.8, 1, 2, 1.6, 1, s.coat], [-hd / 2 + 1, ey + 0.8, 1, 2, 1.6, 1, s.coat]);
    if (ears === "round") head.push([hd / 2 - 0.5, ey + 0.6, 0.5, 2, 2, 1, s.dark], [-hd / 2 + 0.5, ey + 0.6, 0.5, 2, 2, 1, s.dark]);
    if (ears === "long") head.push([hd / 2 + 1, ey - 1, 0.5, 3, 1.2, 2, s.coat], [-hd / 2 - 1, ey - 1, 0.5, 3, 1.2, 2, s.coat]);
    const horn = s.accent ?? 0xe8dcc0;
    if (s.horns === "ram") head.push(...mirror([[hd / 2 + 1, ey - 0.5, 0, 2, 3, 3, horn], [hd / 2 + 1.5, ey - 2.5, 1.5, 1.5, 2, 1.5, horn]]), [hd / 2 + 1, ey - 0.5, 0, 2, 3, 3, horn], [hd / 2 + 1.5, ey - 2.5, 1.5, 1.5, 2, 1.5, horn]);
    if (s.horns === "bull") head.push([0, ey + 0.5, 0.5, hd + 5, 1.2, 1.2, horn], [hd / 2 + 2.3, ey + 1.6, 0.5, 1, 2, 1, horn], [-hd / 2 - 2.3, ey + 1.6, 0.5, 1, 2, 1, horn]);
    if (s.horns === "rhino") head.push([0, 0, hd + 2, 1.6, 3, 1.6, horn], [0, 1.8, hd + 2.3, 1, 1.6, 1, horn]);
    if (s.horns === "tri") head.push([0, ey + 1.5, -0.5, hd + 4, hd - 1, 1, s.accent ?? s.dark], [0, 0, hd + 2, 1.2, 2.5, 1.2, horn], ...mirror([[hd / 2 - 0.5, ey + 1, hd / 2 + 1, 1, 1, 4, horn]]), [hd / 2 - 0.5, ey + 1, hd / 2 + 1, 1, 1, 4, horn]);
    if (s.horns === "antler") for (const sx of [1, -1]) head.push([sx * 1.5, ey + 2, 0, 1, 4, 1, horn], [sx * 3, ey + 4, 0, 3, 1, 1, horn], [sx * 4, ey + 5, 0, 1, 2, 1, horn], [sx * 2, ey + 5, -0.5, 1, 2, 1, horn]);
    if (s.horns === "tusk") head.push([hd / 2 - 1, -hd / 2, hd + 1.5, 1, 1, 4, 0xf4eedc], [-hd / 2 + 1, -hd / 2, hd + 1.5, 1, 1, 4, 0xf4eedc]);
    r.part("head", [0, H * 0.5, 2], head, "neck");
    if (s.trunk) {
      r.part("trunk", [0, -hd / 4, hd + 1.5], [[0, -2, 0.5, 2, 4, 2, s.coat]], "head");
      r.part("trunk2", [0, -4, 0.5], [[0, -2, 0, 1.6, 4, 1.6, s.coat]], "trunk");
    }
    r.part("jaw", [0, -hd / 2 + 0.5, hd / 2 + 1.5], [[0, -0.4, (s.snout ?? 2) / 2, hd - 3, 0.8, (s.snout ?? 2) - 0.2, s.belly]], "head");
    r.anchor("mouth", [0, 0, hd + 3], "head");
    r.anchor("overhead", [0, hd + 3, 0], "head");
    // Legs: hip pivot at torso underside, paw block at ground.
    for (const [name, x, z] of [["legFL", W / 2 - lw / 2, L / 2 - lw], ["legFR", -W / 2 + lw / 2, L / 2 - lw], ["legBL", W / 2 - lw / 2, -L / 2 + lw], ["legBR", -W / 2 + lw / 2, -L / 2 + lw]] as const) {
      r.part(name, [x, -H / 2 + 1, z], [[0, -leg / 2, 0, lw, leg + 1, lw, s.coat], [0, -leg - 0.5, 0.4, lw + 0.4, 1, lw + 1, s.dark]], "torso");
    }
    // Tail: three pivot segments so it curls instead of swinging rigidly.
    const tail = s.tail ?? "thin";
    const tw = tail === "bushy" || tail === "flame" ? 3 : tail === "stub" ? 2 : 1.4;
    const tl = tail === "long" ? 4 : tail === "stub" ? 1.5 : 3;
    const tc = tail === "flame" ? 0xff8a2a : s.coat;
    r.part("tail1", [0, H / 4, -L / 2], [[0, 0, -tl / 2, tw, tw, tl, s.coat]], "torso");
    r.part("tail2", [0, 0, -tl], [[0, 0, -tl / 2, tw * 1.1, tw * 1.1, tl, tc]], "tail1");
    r.part("tail3", [0, 0, -tl], [[0, 0, -tl / 2, tw * 0.9, tw * 0.9, tl, tail === "bushy" || tail === "flame" ? (tail === "flame" ? 0xffe066 : 0xf4f0e8) : tc]], "tail2");
    r.anchor("tail", [0, 0, -tl], "tail3");
    r.anchor("chest", [0, 0, L / 2], "torso");

    const gait = s.gait ?? "trot";
    return (p, st, t, k, sig) => {
      const legs = [p.legFL, p.legBR, p.legFR, p.legBL];
      p.tail1.rotation.x = 0.5 + wave(t, 0.7, sig) * 0.15;
      p.tail1.rotation.y = wave(t, 0.45, sig) * 0.35;
      p.tail2.rotation.y = wave(t, 0.45, sig + 0.15) * 0.35;
      p.tail3.rotation.y = wave(t, 0.45, sig + 0.3) * 0.4;
      if (st === "idle") {
        p.torso.position.y += wave(t, 0.5, sig) * 0.25; // breathing
        p.torso.scale.y = 1 + wave(t, 0.5, sig) * 0.025;
        // Look around once per 5 s cadence; ears/eyes lead the head.
        p.head.rotation.y = Math.sin(Math.min(1, Math.max(0, (k - 0.4) * 4)) * Math.PI) * 0.45 * (sig > 0.5 ? 1 : -1);
        p.neck.rotation.x = wave(t, 0.25, sig) * 0.06;
        if (p.trunk) p.trunk.rotation.x = wave(t, 0.6, sig) * 0.25;
      } else if (st === "move") {
        const amp = gait === "stomp" ? 0.4 : gait === "prowl" ? 0.55 : 0.75;
        const hz = gait === "stomp" ? 1 : 2;
        if (gait === "hop") {
          const h = Math.abs(Math.sin(k * Math.PI * 2));
          p.torso.position.y += h * 4;
          p.torso.rotation.x = -Math.cos(k * Math.PI * 2) * 0.2;
          for (const l of [p.legBL, p.legBR]) l.rotation.x = 0.6 - h * 1.2;
          for (const l of [p.legFL, p.legFR]) l.rotation.x = -0.4 + h * 0.6;
        } else {
          legs.forEach((l, i) => (l.rotation.x = Math.sin((k * hz + (i < 2 ? 0 : 0.5)) * Math.PI * 2) * amp));
          p.torso.position.y += Math.abs(Math.sin(k * hz * Math.PI * 2)) * (gait === "stomp" ? 0.4 : 0.9);
          if (gait === "prowl") p.torso.position.y -= 1;
        }
        p.head.rotation.x = Math.sin(k * hz * Math.PI * 4) * 0.06;
      } else if (st === "attack") {
        const e = strike(k);
        p.torso.position.z += e * 3;
        p.torso.rotation.x = e * 0.15;
        p.neck.rotation.x = e * 0.35;
        p.jaw.rotation.x = Math.max(0, e) * 0.6;
        p.legFL.rotation.x = p.legFR.rotation.x = -Math.max(0, e) * 0.9;
        p.legBL.rotation.x = p.legBR.rotation.x = Math.max(0, -e) * 0.6;
      } else if (st === "skill") {
        // Rear up, roar, slam: reads as a bigger beat than a basic attack.
        const up = k < 0.45 ? Math.sin((k / 0.45) * Math.PI * 0.5) : k < 0.6 ? 1 - (k - 0.45) / 0.15 : 0;
        p.torso.rotation.x = -up * 0.55;
        p.torso.position.y += up * 3;
        p.legFL.rotation.x = p.legFR.rotation.x = -up * 1.1;
        p.jaw.rotation.x = up * 0.7;
        p.neck.rotation.x = -up * 0.3;
        if (k > 0.6 && k < 0.75) p.torso.position.y -= Math.sin(((k - 0.6) / 0.15) * Math.PI) * 1.2;
        if (p.trunk) p.trunk.rotation.x = -up * 1.4;
      } else {
        // Take hit: recoil back from the front without leaving the cell root.
        const e = Math.sin(Math.min(1, k * 2) * Math.PI) * (1 - k);
        p.torso.position.z -= e * 3;
        p.torso.rotation.x = e * -0.25;
        p.torso.rotation.z = Math.sin(k * Math.PI * 6) * e * 0.12;
        p.head.rotation.x = -e * 0.3;
      }
    };
  };
}
