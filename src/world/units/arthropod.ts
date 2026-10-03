// Arthropod body plan: head → thorax → abdomen, 6 or 8 individually articulated legs,
// optional wings (2/4), antennae, mandibles, pincers, segmented stinger tail (22.5). Front = +z.
import { strike, wave, type Box, type Pose, type Rig } from "./kit";

export interface ArthroSpec {
  shell: number; under: number; dark: number; accent?: number;
  size: number;
  legs: 6 | 8;
  wings?: 0 | 2 | 4;
  wingTint?: number;
  /** Rest height above ground in voxels (flying insects hover). */
  hover?: number;
  antennae?: boolean; mandibles?: boolean; pincers?: boolean;
  stinger?: "wasp" | "scorpion" | "none";
  abdomen?: number; horn?: boolean; glowTail?: number;
}

export function arthropod(s: ArthroSpec): (r: Rig) => Pose {
  return (r) => {
    const S = s.size;
    const hover = s.hover ?? 0;
    const ab = s.abdomen ?? 1.3;
    const legLen = S * 0.9;
    const y0 = (hover ? hover : legLen * 0.55) + S / 3;
    r.part("thorax", [0, y0, 0], [[0, 0, 0, S, S * 0.65, S * 0.8, s.shell], [0, -S * 0.3, 0, S * 0.8, 0.6, S * 0.7, s.under]]);
    // Wasp waist: thin petiole between thorax and abdomen.
    const waist = s.stinger === "wasp" ? 1.4 : 0;
    const A = S * ab;
    const abd: Box[] = [[0, 0, -A / 2, A * 0.8, A * 0.65, A, s.shell]];
    if (s.stinger === "wasp") for (let i = 0; i < 3; i++) abd.push([0, 0, -A * (0.25 + i * 0.25), A * 0.82, A * 0.67, A * 0.1, s.dark]);
    else abd.push([0, A * 0.33, -A / 2, A * 0.5, 0.4, A * 0.7, s.dark]);
    if (s.glowTail) abd.push([0, -A * 0.1, -A * 0.85, A * 0.7, A * 0.5, A * 0.35, s.glowTail]);
    r.part("abdomen", [0, waist ? 0.4 : 0, -S * 0.4 - waist], waist ? [...abd, [0, 0, waist / 2, 1, 1, waist + 0.4, s.dark]] : abd, "thorax");
    const H = S * 0.6;
    const head: Box[] = [[0, 0, H / 2, H, H * 0.85, H, s.shell]];
    for (const sx of [1, -1]) head.push([sx * H / 2.6, H * 0.18, H * 0.95, H / 3, H / 3, 0.6, s.accent ?? 0x1a1a1a]);
    if (s.legs === 8) for (const sx of [1, -1]) head.push([sx * H / 6, H * 0.38, H + 0.1, 0.6, 0.6, 0.4, 0x8a1010], [sx * H / 3.5, H * 0.05, H + 0.15, 0.5, 0.5, 0.4, 0x8a1010]);
    if (s.horn) head.push([0, H * 0.5, H, 1.2, 1.2, 3, s.dark], [0, H * 1.1, H + 1.4, 1, 2.4, 1, s.dark]);
    r.part("head", [0, 0.2, S * 0.4], head, "thorax");
    r.anchor("mouth", [0, 0, H + 1.5], "head");
    r.anchor("overhead", [0, H + 4, 0], "head");
    if (s.antennae) for (const sx of [1, -1]) r.part(sx > 0 ? "antL" : "antR", [sx * H / 4, H * 0.4, H * 0.9], [[sx * 0.6, 1.5, 0.8, 0.4, 3, 0.4, s.dark], [sx * 1.3, 3, 1.8, 0.5, 0.5, 2, s.dark]], "head");
    if (s.mandibles) for (const sx of [1, -1]) r.part(sx > 0 ? "mandL" : "mandR", [sx * H / 4, -H * 0.25, H], [[sx * 0.3, 0, 0.9, 0.7, 0.6, 1.8, s.dark], [-sx * 0.3, 0, 1.8, 0.9, 0.6, 0.6, s.dark]], "head");
    // Legs alternate tripod (6) or quad wave (8); each leg = hip + knee pivots.
    const n = s.legs / 2;
    for (let i = 0; i < n; i++) {
      const z = (0.5 - i / (n - 1)) * S * 0.7;
      for (const sx of [1, -1]) {
        const id = `${sx > 0 ? "L" : "R"}${i}`;
        r.part(`hip${id}`, [sx * S / 2, -S * 0.1, z], [[sx * legLen / 4, legLen / 6, 0, legLen / 2, 0.8, 0.8, s.shell]], "thorax");
        r.part(`knee${id}`, [sx * legLen / 2, legLen / 3, 0], [[sx * 0.4, -legLen / 3, 0, 0.7, legLen * 0.75, 0.7, s.dark]], `hip${id}`);
        r.p[`hip${id}`].rotation.y = sx * (i - (n - 1) / 2) * 0.35;
      }
    }
    if (s.pincers) for (const sx of [1, -1]) {
      const side = sx > 0 ? "L" : "R";
      r.part(`arm${side}`, [sx * S / 2.4, 0, S * 0.35], [[sx * 1, 0, 1.5, 1.4, 1.2, 3.5, s.shell]], "thorax");
      r.part(`claw${side}`, [sx * 1, 0, 3.4], [[0, 0, 1.6, 2.6, 1.8, 3, s.shell], [sx * 0.7, 0, 3.6, 1, 1.4, 1.6, s.dark]], `arm${side}`);
      r.part(`pinch${side}`, [-sx * 0.8, 0, 2.4], [[0, 0, 1, 0.9, 1.2, 2.2, s.dark]], `claw${side}`);
    }
    if (s.stinger === "scorpion") {
      // Five tail segments arc over the back, stinger last.
      let parent = "abdomen";
      for (let i = 0; i < 5; i++) {
        const name = `tail${i}`;
        r.part(name, [0, i ? 0 : A * 0.2, i ? -2.2 : -A], [[0, 0, -1.1, 2 - i * 0.2, 1.8 - i * 0.2, 2.4, i % 2 ? s.dark : s.shell]], parent);
        r.p[name].rotation.x = i ? 0.55 : 0.9;
        parent = name;
      }
      r.part("sting", [0, 0, -2.2], [[0, 0, -1, 1.6, 1.6, 1.6, s.accent ?? 0x9b2bd8], [0, -0.9, -1.8, 0.6, 1.6, 0.6, s.accent ?? 0x9b2bd8]], parent);
      r.anchor("tail", [0, -1.8, -2], "sting");
    } else if (s.stinger === "wasp") {
      r.part("sting", [0, -A * 0.05, -A], [[0, 0, -0.8, 0.7, 0.7, 1.8, s.dark]], "abdomen");
      r.anchor("tail", [0, 0, -1.8], "sting");
    } else r.anchor("tail", [0, 0, -A], "abdomen");
    const wings = s.wings ?? 0;
    const wt = s.wingTint ?? 0xdff3ff;
    for (let w = 0; w < wings; w++) for (const sx of [1, -1]) {
      const name = `wing${sx > 0 ? "L" : "R"}${w}`;
      const wl = S * (w ? 0.9 : 1.2);
      r.part(name, [sx * S / 4, S * 0.33, -w * S * 0.25], [[sx * wl / 2, 0, -wl / 4, wl, 0.3, wl * 0.55, wt], [sx * wl * 0.9, 0.05, -wl / 4, wl * 0.2, 0.35, wl * 0.4, s.accent ?? wt]], "thorax");
    }
    r.anchor("chest", [0, 0, S * 0.4], "thorax");

    return (p, st, t, k, sig) => {
      for (let w = 0; w < wings; w++) {
        const f = wave(t, hover ? 9 : 0.5, sig + w * 0.25) * (hover ? 0.6 : 0.08);
        p[`wingL${w}`].rotation.z = 0.2 + f;
        p[`wingR${w}`].rotation.z = -0.2 - f;
      }
      if (hover) p.thorax.position.y += wave(t, 1.2, sig) * 0.8;
      // Leg cycle: phase per leg, alternating sides = tripod / wave gait.
      const walking = st === "move" ? 1 : st === "idle" ? 0.12 : 0;
      for (let i = 0; i < n; i++) for (const sx of [1, -1]) {
        const id = `${sx > 0 ? "L" : "R"}${i}`;
        const ph = (i + (sx > 0 ? 0 : 1)) % 2 ? 0.5 : 0;
        const c = Math.sin((k * (st === "move" ? 3 : 1) + ph + i * 0.1) * Math.PI * 2);
        p[`hip${id}`].rotation.y += sx * c * 0.35 * walking;
        p[`hip${id}`].rotation.z = sx * Math.max(0, c) * 0.35 * walking;
      }
      if (p.antL) { p.antL.rotation.x = wave(t, 0.9, sig) * 0.25; p.antR.rotation.x = wave(t, 0.9, sig + 0.3) * 0.25; }
      if (p.mandL) { const m = st === "attack" ? Math.max(0, strike(k)) * 0.6 : wave(t, 0.7, sig) * 0.1; p.mandL.rotation.y = m; p.mandR.rotation.y = -m; }
      if (p.tail0) for (let i = 0; i < 5; i++) p[`tail${i}`].rotation.x += wave(t, 0.6, sig + i * 0.1) * 0.05;
      if (st === "idle") {
        p.thorax.position.y += wave(t, 0.6, sig) * 0.2;
        p.head.rotation.y = wave(t, 0.2, sig) * 0.2;
        if (s.legs === 8 && k > 0.5 && k < 0.7) { // alert: front legs lift, listening
          const a = Math.sin(((k - 0.5) / 0.2) * Math.PI);
          p.hipL0.rotation.z = a * 0.7; p.hipR0.rotation.z = -a * 0.7;
          p.thorax.rotation.x = -a * 0.12;
        }
      } else if (st === "move") {
        p.thorax.position.y += Math.abs(Math.sin(k * Math.PI * 6)) * 0.3;
        p.abdomen.rotation.y = Math.sin(k * Math.PI * 2) * 0.08;
      } else if (st === "attack") {
        const e = strike(k);
        if (p.sting && s.stinger === "scorpion") for (let i = 0; i < 5; i++) p[`tail${i}`].rotation.x += e * 0.18;
        else if (s.stinger === "wasp") { p.abdomen.rotation.x = -e * 0.9; p.thorax.position.z += e * 1.5; }
        else { p.thorax.position.z += e * 2.5; p.hipL0.rotation.z = p.hipR0.rotation.z = 0; p.hipL0.rotation.x = p.hipR0.rotation.x = -Math.max(0, e) * 1; }
        if (p.armL) { p.armL.rotation.y = -e * 0.4; p.armR.rotation.y = e * 0.4; p.pinchL.rotation.y = p.pinchR.rotation.y = 0; p.pinchL.rotation.y = -Math.max(0, e) * 0.5; p.pinchR.rotation.y = Math.max(0, e) * 0.5; }
      } else if (st === "skill") {
        const up = Math.sin(Math.min(1, k / 0.4) * Math.PI * 0.5) * (k < 0.75 ? 1 : (1 - k) / 0.25);
        p.thorax.position.y += up * (hover ? 4 : 2.5);
        p.thorax.rotation.x = -up * 0.35;
        if (p.tail0) for (let i = 0; i < 5; i++) p[`tail${i}`].rotation.x += up * 0.2;
        if (p.armL) { p.armL.rotation.y = up * 0.6; p.armR.rotation.y = -up * 0.6; }
        p.abdomen.rotation.x = up * 0.4 * (s.stinger === "wasp" ? -1 : 1);
      } else {
        const e = Math.sin(Math.min(1, k * 2) * Math.PI) * (1 - k);
        p.thorax.position.z -= e * 2;
        p.thorax.rotation.z = Math.sin(k * Math.PI * 8) * e * 0.15;
        p.head.rotation.x = -e * 0.3;
      }
    };
  };
}
