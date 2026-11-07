// Rắn Đoạt Hồn (catalog id storm_mage, kept for save compatibility) — bespoke rig from the
// "Rắn Đoạt Hồn" sheet. Coiled purple snake mage with a lilac belly, gold-trimmed hood, green eyes and
// forehead gem, gold talisman chains and green soul wisps circling it.
// Idle: hover-sway → breathe soul mist → eyes glow · Combat idle: watch / coil / hold the ring ·
// Move: slither → glide → surge · Attack: gather → soul bolt (impact) → recoil · Skill: gather souls →
// curse ring → pull the target's soul (impact) → absorb · Hit: struck → recoil → steady ·
// Death: slumps → dissolves into soul mist. 2★ gold collar + extra talismans; 3★ hood spikes, glowing
// hood trim and a curse ring on the ground.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  purple: 0x6a3aa8, purpleD: 0x452070, purpleL: 0x9a6ad0, belly: 0xe6d6f0, gold: 0xe8b83a, goldD: 0xa87818,
  eye: 0x6aff9a, pupil: 0x103018, fang: 0xf4f4f0, gem: 0x3aff8a, soul: 0x7affc0, paper: 0xf2e6c4, ink: 0xc03030,
  curse: 0xb070ff,
};
const NECK_Y = 2.2;

interface Parts { root: Part; body: Part; head: Part; lids: Part; tail: Part; wisps: Part; tags: Part[] }

export default defineUnit<Parts>({
  id: "storm_mage",
  motion: "ground",
  height: 9,
  durations: { idle: 4.5, attack: 0.9, skill: 1.7, hit: 0.5, move: 0.8 },
  impact: { attack: 0.55, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    const root = k.part("root", null, [0, 0, 0]);
    // Coils: three stacked rings, lowest voxel 0.2 above the tile.
    root.box([0, 0.8, 0], [5.0, 1.2, 4.2], C.purple).box([0, 0.8, 2.12], [3.4, 0.9, 0.1], C.belly)
      .box([0, 1.9, -0.2], [3.8, 1.0, 3.2], C.purpleL).box([0, 1.9, 1.42], [2.4, 0.7, 0.1], C.belly)
      .pair([1.6, 1.0, 1.5], [0.6, 0.3, 0.12], C.soul, { mat: "glow" }).pair([1.2, 2.0, -1.6], [0.5, 0.3, 0.12], C.soul, { mat: "glow" });
    const tail = k.part("tail", root, [2.4, 0.7, -1.2]);
    tail.box([0.8, 0, 0], [1.8, 0.8, 0.8], C.purple).box([1.9, 0.2, 0], [0.8, 0.5, 0.5], C.purpleD);
    const body = k.part("body", root, [0, NECK_Y, 0.4]);
    body.box([0, 1.6, 0], [1.7, 3.2, 1.5], C.purple).box([0, 1.6, 0.78], [1.1, 3.0, 0.08], C.belly);
    const head = k.part("head", body, [0, 3.3, 0.2]);
    head.box([0, 0.5, 0.5], [2.2, 1.4, 2.6], C.purple).box([0, 0.05, 1.3], [1.6, 0.5, 1.0], C.belly)
      .pair([0.62, 0.85, 1.82], [0.55, 0.45, 0.08], C.eye, { mat: "glow" }).pair([0.62, 0.85, 1.88], [0.18, 0.4, 0.04], C.pupil)
      .pair([0.4, -0.35, 1.6], [0.16, 0.5, 0.16], C.fang).box([0, 1.32, 1.4], [0.45, 0.45, 0.12], C.gem, { mat: "glow" });
    // Hood: dark cowl with gold trim framing the head.
    head.box([0, 0.9, -0.5], [3.6, 2.8, 0.7], C.purpleD).box([0, 1.55, 0.4], [2.7, 0.5, 2.6], C.purpleD)
      .pair([1.62, 0.6, 0.3], [0.5, 2.4, 1.6], C.purpleD).box([0, 1.85, 0.4], [2.8, 0.14, 2.7], C.gold)
      .pair([1.9, 0.6, 0.3], [0.12, 2.4, 1.7], C.gold, { mat: star >= 3 ? "glow" : "solid" });
    const lids = k.part("lids", head, [0, 1.1, 1.85]);
    lids.pair([0.62, -0.25, 0], [0.6, 0.5, 0.06], C.purple);
    const tag = (name: string, side: number, z: number) => {
      const t = k.part(name, head, [side * 1.9, -0.4, z]);
      t.box([0, -0.3, 0], [0.16, 0.6, 0.16], C.gold).box([0, -1.0, 0], [0.5, 0.9, 0.08], C.paper).box([0, -1.0, 0.05], [0.2, 0.5, 0.04], C.ink);
      return t;
    };
    const tags = [tag("tagR", 1, 0.6), tag("tagL", -1, 0.6)];
    if (star >= 2) {
      body.box([0, 2.9, 0.1], [2.1, 0.4, 1.9], C.gold).box([0, 2.9, 1.02], [0.45, 0.45, 0.1], C.gem, { mat: "glow" });
      tags.push(tag("tagR2", 1, -0.4), tag("tagL2", -1, -0.4));
    }
    if (star >= 3) {
      for (const x of [-0.9, 0, 0.9]) head.box([x, 2.25 + (x === 0 ? 0.25 : 0), 0.4], [0.3, 0.6 + (x === 0 ? 0.4 : 0), 0.3], C.gold, { mat: "glow" });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        root.box([Math.cos(a) * 3.4, 0.12, Math.sin(a) * 3.4], [1.4, 0.1, 0.3], C.curse, { mat: "glow", rot: [0, -a + Math.PI / 2, 0] });
      }
    }
    const wisps = k.part("wisps", root, [0, 5.2, 0]);
    for (const [x, y, z] of [[3.0, 0.6, 0.4], [-3.0, 1.6, -0.2], [0.4, 3.0, -2.2]] as const) {
      wisps.box([x, y, z], [0.9, 0.9, 0.9], C.soul, { mat: "glow" }).box([x, y - 0.75, z], [0.4, 0.6, 0.4], C.soul, { mat: "glow" });
    }
    return { root, body, head, lids, tail, wisps, tags };
  },

  pose(r, c) {
    const { root, body, head, lids, tail, wisps, tags } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    let spin = 0.8, swell = 1;
    tail.group.rotation.y = Math.sin(T * 1.7) * 0.25;
    for (const [i, t] of tags.entries()) t.group.rotation.x = Math.sin(T * 2.2 + i) * 0.15;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, coil, ring] = beats(T, c.sig, 0x51ea);
          body.group.rotation.z = Math.sin(T * 1.1) * 0.08 * watch;
          body.group.rotation.x = -0.15 * coil;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.35 * watch;
          root.group.scale.set(1 + 0.05 * coil, 1, 1 + 0.05 * coil);
          spin = 1 + 1.5 * ring;
          swell = 1 + 0.25 * ring;
          lid = Math.max(lid, 0.3 * ring);
        } else {
          // hover-sway (0–.4) → breathe soul mist (.4–.7) → eyes glow (.7–1).
          const ph = c.p % 1;
          const mist = win(ph, 0.4, 0.7, 0.06), glow = win(ph, 0.68, 1, 0.06);
          body.group.rotation.z = Math.sin(T * 1.3) * 0.1;
          body.group.rotation.x = 0.2 * mist;
          head.group.rotation.x = 0.15 * mist - 0.1 * glow;
          body.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          swell = 1 + 0.2 * glow;
          lid = Math.max(lid, 0.4 * mist);
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (6 + 4 * g);
        body.group.rotation.z = Math.sin(w) * (0.12 + 0.08 * g);
        body.group.rotation.x = 0.15 + 0.15 * g;
        root.group.scale.set(1 + Math.sin(w) * 0.05, 1, 1 - Math.sin(w) * 0.05);
        tail.group.rotation.y = Math.sin(w + 1) * 0.5;
        head.group.rotation.z = -Math.sin(w) * 0.1;
        spin = 1.5;
        break;
      }
      case "attack": {
        // gather (0–.4) → soul bolt (impact .55) → recoil.
        const p = c.p;
        const gather = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const strike = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.7, 1));
        body.group.rotation.x = -0.3 * gather + 0.45 * strike;
        head.group.rotation.x = 0.2 * gather - 0.25 * strike;
        swell = 1 + 0.4 * gather;
        spin = 1 + 3 * gather;
        lid = Math.max(lid, 0.3 * gather);
        break;
      }
      case "skill": {
        // gather souls (0–.3) → curse ring (.25–.5) → pull the soul (impact .62) → absorb (.7–1).
        const p = c.p;
        const gather = win(p, 0, 0.32, 0.06), ring = win(p, 0.25, 0.66, 0.05);
        const pull = win(p, 0.5, 0.75, 0.04), absorb = win(p, 0.7, 1, 0.08);
        body.group.position.y += 0.8 * ring;
        body.group.rotation.x = -0.25 * gather + 0.4 * pull - 0.1 * absorb;
        head.group.rotation.x = -0.3 * pull;
        wisps.group.position.z += 1.5 * pull;
        swell = 1 + 0.6 * ring - 0.4 * absorb;
        spin = 1 + 5 * ring;
        root.group.scale.setScalar(1 + 0.08 * absorb);
        lid = Math.max(lid, 0.35 * gather);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        body.group.rotation.x = -0.35 * k;
        body.group.rotation.z = shake * 0.08;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    wisps.group.rotation.y = T * spin;
    wisps.group.scale.setScalar(swell);
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Quỵ xuống: the neck slumps sideways (0–.4) → coils sag → tan thành hồn khí (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { root, body, head, lids, wisps } = r;
      const p = c.p;
      const slump = ramp(p, 0, 0.4), sag = ramp(p, 0.25, 0.6);
      body.group.rotation.z = 1.2 * slump;
      body.group.rotation.x = 0.2 * slump;
      head.group.rotation.z = -0.4 * slump;
      root.group.scale.y = 1 - 0.35 * sag;
      wisps.group.position.y += 2 * ramp(p, 0.3, 1);
      wisps.group.rotation.y = c.time * 2;
      wisps.group.scale.setScalar(1 - 0.7 * sag + bell(p, 0.6, 1) * 0.5);
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.4), bell(p, 0, 0.08));
    },
  },
});
