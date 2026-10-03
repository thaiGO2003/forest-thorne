// Bird body plan: torso → neck → head + beak, two wings (shoulder + tip), two legs with talons,
// tail fan. Ground birds stand; raptors/flyers hover at rest height (22.3). Front = +z.
import { strike, wave, type Box, type Pose, type Rig } from "./kit";

export interface BirdSpec {
  plume: number; belly: number; wing: number; beak: number; accent?: number;
  size: number;
  /** Rest height above ground in voxels; 0 = grounded. */
  hover: number;
  neck?: number; leg?: number;
  beakShape?: "hook" | "long" | "short" | "pouch" | "big";
  crest?: "comb" | "tuft" | "crown" | "plume" | "none";
  tail?: "fan" | "short" | "long";
  owl?: boolean;
}

export function bird(s: BirdSpec): (r: Rig) => Pose {
  return (r) => {
    const S = s.size;
    const neck = s.neck ?? 2;
    const leg = s.leg ?? 4;
    const y0 = leg + S / 2 + s.hover;
    r.part("torso", [0, y0, 0], [
      [0, 0, 0, S, S, S * 1.3, s.plume],
      [0, -0.6, S * 0.35, S - 1, S - 1.5, S * 0.6, s.belly],
    ]);
    r.part("neck", [0, S / 2 - 1, S * 0.5], [[0, neck / 2, 0, S * 0.55, neck + 1, S * 0.55, s.plume]], "torso");
    const H = s.owl ? S * 1.05 : S * 0.75;
    const head: Box[] = [[0, H / 2, 0.5, H, H, H, s.plume]];
    const eyeZ = H / 2 + 0.6;
    if (s.owl) {
      head.push([H / 4, H / 2 + 0.3, eyeZ - 0.3, H / 2.4, H / 2.4, 0.6, 0xf6e7a0], [-H / 4, H / 2 + 0.3, eyeZ - 0.3, H / 2.4, H / 2.4, 0.6, 0xf6e7a0],
        [H / 4, H / 2 + 0.3, eyeZ, 1, 1, 0.4, 0x111111], [-H / 4, H / 2 + 0.3, eyeZ, 1, 1, 0.4, 0x111111],
        [H / 2 - 0.6, H + 0.6, 0, 1.2, 1.6, 1, s.wing], [-H / 2 + 0.6, H + 0.6, 0, 1.2, 1.6, 1, s.wing]);
    } else {
      head.push([H / 2 - 0.2, H / 2 + 0.6, H / 4, 0.6, 1, 1, 0x15110f], [-H / 2 + 0.2, H / 2 + 0.6, H / 4, 0.6, 1, 1, 0x15110f],
        [H / 2 - 0.1, H / 2 + 0.9, H / 4 + 0.3, 0.5, 0.4, 0.4, 0xffffff], [-H / 2 + 0.1, H / 2 + 0.9, H / 4 + 0.3, 0.5, 0.4, 0.4, 0xffffff]);
    }
    const bs = s.beakShape ?? "short";
    const bz = H / 2 + 0.5;
    if (bs === "hook") head.push([0, H / 2, bz + 1, 1.6, 1.4, 2, s.beak], [0, H / 2 - 1, bz + 1.8, 1.2, 1.2, 0.8, s.beak]);
    if (bs === "short") head.push([0, H / 2 - 0.2, bz + 0.8, 1.4, 1.2, 1.6, s.beak]);
    if (bs === "long") head.push([0, H / 2, bz + 2.5, 1, 1, 5, s.beak]);
    if (bs === "pouch") head.push([0, H / 2, bz + 3, 1.6, 1, 6, s.beak], [0, H / 2 - 1.3, bz + 2.5, 1.4, 1.8, 4.5, s.accent ?? 0xf0c070]);
    if (bs === "big") head.push([0, H / 2 + 0.3, bz + 2, 2.2, 2.4, 4, s.beak], [0, H / 2 + 1.2, bz + 3.2, 2, 0.6, 1.6, s.accent ?? 0x222222]);
    const crest = s.crest ?? "none";
    const cc = s.accent ?? 0xd8342c;
    if (crest === "comb") head.push([0, H + 0.6, 0.5, 0.8, 1.6, 2.2, cc], [0, H + 1, 1.6, 0.8, 1, 0.8, cc], [0, H / 2 - 1.2, bz + 0.2, 0.8, 1.4, 0.8, cc]);
    if (crest === "tuft") head.push([0, H + 0.7, -0.5, 1, 1.4, 1.4, cc], [0, H + 1.4, -1.3, 0.8, 1, 1, cc]);
    if (crest === "crown") head.push([0, H + 0.4, 0.5, H - 0.5, 0.6, H - 0.5, 0xf5c542], [H / 3, H + 1, 0.5, 0.6, 0.8, 0.6, 0xf5c542], [-H / 3, H + 1, 0.5, 0.6, 0.8, 0.6, 0xf5c542], [0, H + 1.1, 1.5, 0.6, 1, 0.6, 0xf5c542]);
    if (crest === "plume") for (let i = 0; i < 3; i++) head.push([(i - 1) * 0.9, H + 1.5 + (i % 2), -0.5, 0.5, 2.6, 0.5, cc], [(i - 1) * 0.9, H + 3 + (i % 2), -0.5, 1.1, 0.9, 0.9, cc]);
    r.part("head", [0, neck, 0.5], head, "neck");
    r.anchor("mouth", [0, H / 2, bz + 3], "head");
    r.anchor("overhead", [0, H + 4, 0], "head");
    // Wings: shoulder pivot at torso side, tip pivot at wing end; tips go darker.
    const wl = S * 1.6;
    for (const sx of [1, -1]) {
      const side = sx > 0 ? "L" : "R";
      r.part(`wing${side}`, [sx * S / 2, S / 4, 0], [[sx * wl / 4, 0, -0.5, wl / 2, 1, S * 1.1, s.wing], [sx * wl / 4, -0.6, -0.5, wl / 2 - 0.5, 0.4, S * 0.9, s.belly]], "torso");
      r.part(`tip${side}`, [sx * wl / 2, 0, 0], [[sx * wl / 4, 0, -1, wl / 2, 0.8, S * 0.9, s.wing], [sx * wl / 2, 0, -1.5, 1, 0.8, S * 0.6, s.accent ?? s.plume]], `wing${side}`);
    }
    const tail = s.tail ?? "fan";
    const tl = tail === "long" ? S * 1.5 : tail === "short" ? S * 0.5 : S * 0.9;
    const tw = tail === "fan" ? S * 1.1 : S * 0.6;
    r.part("tail", [0, 0, -S * 0.65], [[0, 0, -tl / 2, tw, 0.8, tl, s.wing], [0, 0.1, -tl + 0.4, tw + 0.6, 0.6, 1, s.accent ?? s.wing]], "torso");
    for (const sx of [1, -1]) {
      r.part(sx > 0 ? "legL" : "legR", [sx * S / 4, -S / 2, 0], [[0, -leg / 2, 0, 1, leg, 1, s.beak], [0, -leg, 0.8, 1.6, 0.6, 2.4, s.beak], [0, -leg, -0.6, 0.6, 0.6, 1, s.beak]], "torso");
    }
    r.anchor("chest", [0, 0, S * 0.65], "torso");

    const flyer = s.hover > 0;
    return (p, st, t, k, sig) => {
      // Flyers keep a slow wing pulse even at rest; grounded birds fold.
      const flap = flyer ? wave(t, 1.6, sig) : 0;
      const fold = flyer ? 0 : 0.15;
      p.wingL.rotation.z = flap * 0.5 - fold;
      p.wingR.rotation.z = -flap * 0.5 + fold;
      p.tipL.rotation.z = flap * 0.35;
      p.tipR.rotation.z = -flap * 0.35;
      if (flyer) {
        p.torso.position.y += wave(t, 0.8, sig) * 0.8;
        p.legL.rotation.x = p.legR.rotation.x = 0.7; // tuck talons
      }
      if (st === "idle") {
        p.head.rotation.y = Math.sin(Math.min(1, Math.max(0, (k - 0.3) * 3)) * Math.PI) * (s.owl ? 1.1 : 0.6) * (sig > 0.5 ? 1 : -1);
        p.neck.rotation.x = wave(t, 0.5, sig) * 0.08;
        p.tail.rotation.x = wave(t, 0.4, sig) * 0.08;
        if (!flyer && k > 0.75 && k < 0.85) p.neck.rotation.x = Math.sin(((k - 0.75) / 0.1) * Math.PI) * 0.6; // peck
      } else if (st === "move") {
        if (flyer) {
          const f = Math.sin(k * Math.PI * 4);
          p.wingL.rotation.z = f * 0.9; p.wingR.rotation.z = -f * 0.9;
          p.tipL.rotation.z = f * 0.5; p.tipR.rotation.z = -f * 0.5;
          p.torso.rotation.x = 0.25;
        } else {
          p.legL.rotation.x = Math.sin(k * Math.PI * 4) * 0.7;
          p.legR.rotation.x = -Math.sin(k * Math.PI * 4) * 0.7;
          p.neck.position.z += Math.sin(k * Math.PI * 4) * 0.8; // head bob
          p.torso.position.y += Math.abs(Math.sin(k * Math.PI * 4)) * 0.6;
        }
      } else if (st === "attack") {
        const e = strike(k);
        p.torso.rotation.x = e * 0.3;
        p.neck.rotation.x = e * 0.5;
        p.wingL.rotation.z = 0.8 * Math.max(0, -e) - 0.3 * Math.max(0, e);
        p.wingR.rotation.z = -p.wingL.rotation.z;
        p.torso.position.z += e * 2;
      } else if (st === "skill") {
        // Rise, spread wings wide, dive-cast.
        const up = Math.sin(Math.min(1, k / 0.5) * Math.PI * 0.5) * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
        p.torso.position.y += up * 6;
        p.wingL.rotation.z = up * 1.1 + Math.sin(k * Math.PI * 10) * 0.2 * up;
        p.wingR.rotation.z = -p.wingL.rotation.z;
        p.tipL.rotation.z = up * 0.5; p.tipR.rotation.z = -up * 0.5;
        p.torso.rotation.x = k > 0.55 && k < 0.8 ? 0.6 : -up * 0.3;
        p.tail.rotation.x = -up * 0.5;
      } else {
        const e = Math.sin(Math.min(1, k * 2) * Math.PI) * (1 - k);
        p.torso.position.z -= e * 2.5;
        p.torso.rotation.x = -e * 0.4;
        p.wingL.rotation.z = e * 1.2; p.wingR.rotation.z = -e * 1.2;
        p.head.rotation.z = Math.sin(k * Math.PI * 8) * e * 0.3;
      }
    };
  };
}
