// Song Đao Chồn Sóc (catalog id ferret_shadow, kept for save compatibility) — bespoke rig from the
// "Song Đao Chồn Sóc" sheet. Chibi brown squirrel-weasel duelist with a cream face, amber eyes, red
// aviator goggles on a brown cap, a red scarf, a brown leather vest with gold buckles, a huge striped
// brown-and-cream tail and two glowing crimson curved blades.
// Idle: stand → twirl both blades → alert stance · Combat idle: guard / light shuffle / lock on ·
// Move: step → run → sprint · Attack: ready → cross slash (impact) → blade spin · Skill: burst out →
// dash cut → spinning slashes → strike from behind (impact) → finisher · Hit: struck → slide back →
// steady · Death: falls → lies down → fades in red mist. 2★ gold shoulder guards; 3★ glowing goggles,
// blade edges and maple-flame aura.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x9a5a30, furD: 0x6a3a1c, cream: 0xf4e0c4, eye: 0xf0a020, pupil: 0x201008, red: 0xc02a28, redD: 0x7a1818,
  leather: 0x5a3a24, leatherD: 0x3a2416, gold: 0xe8b83a, lens: 0xffb050, blade: 0xff4a5a, bladeL: 0xffc0c8, flame: 0xff7a3a,
};
const HIP_Y = 2.4;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; scarf: Part; tail: Part; arms: Limb[]; legs: Limb[]; blades: Part[] }

export default defineUnit<Parts>({
  id: "ferret_shadow",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.55 },
  impact: { attack: 0.55, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.0, 0.8, 1.4], C.leather).box([0, -0.3, 0.72], [0.9, 0.9, 0.08], C.red).box([0, -0.3, 0.76], [0.35, 0.35, 0.04], C.flame);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.65, 0, 0]);
      part.box([0, -1.0, 0], [0.9, 1.8, 0.9], C.furD).box([0, -2.05, 0.2], [1.0, 0.5, 1.3], C.leatherD).box([0, -1.6, 0], [0.95, 0.25, 0.95], C.gold);
      return { part, side };
    });
    const tail = k.part("tail", hips, [0, 0.3, -0.8]);
    tail.box([0, 1.6, -0.8], [2.0, 3.6, 1.6], C.fur).box([0, 1.0, -0.8], [2.05, 0.5, 1.65], C.cream).box([0, 2.4, -0.8], [2.05, 0.5, 1.65], C.cream)
      .box([0, 3.7, -0.1], [2.2, 1.4, 2.2], C.fur).box([0, 3.8, 0.9], [1.8, 0.9, 0.5], C.cream);
    const torso = k.part("torso", hips, [0, 0.3, 0]);
    torso.box([0, 1.1, 0], [2.2, 2.2, 1.5], C.leather).box([0, 1.1, 0.76], [0.9, 2.0, 0.08], C.cream)
      .box([0, 0.15, 0], [2.3, 0.35, 1.6], C.leatherD).box([0, 0.15, 0.82], [0.5, 0.45, 0.08], C.gold).pair([0.7, 1.4, 0.8], [0.3, 0.3, 0.06], C.gold);
    if (star >= 2) torso.pair([1.15, 2.1, 0], [0.8, 0.5, 1.2], C.gold);
    if (star >= 3) for (const [x, y] of [[0, 3.2], [1.4, 2.6], [-1.4, 2.6], [0.8, 3.8], [-0.8, 3.8]] as const) torso.box([x, y, -1.4], [0.6, 0.9, 0.2], C.flame, { mat: "glow" });
    const scarf = k.part("scarf", torso, [0, 2.1, -0.6]);
    scarf.box([0, 0, 0.5], [2.0, 0.45, 0.6], C.red).box([-0.4, -0.3, -0.4], [0.9, 0.35, 1.2], C.red).box([-0.6, -0.5, -1.3], [0.7, 0.3, 0.9], C.redD);
    const head = k.part("head", torso, [0, 2.3, 0]);
    head.box([0, 1.3, 0], [3.0, 2.6, 2.6], C.fur).box([0, 0.9, 1.32], [2.0, 1.4, 0.1], C.cream)
      .pair([0.6, 1.25, 1.38], [0.6, 0.65, 0.06], C.eye).pair([0.6, 1.2, 1.42], [0.28, 0.45, 0.04], C.pupil).pair([0.65, 1.7, 1.4], [0.7, 0.15, 0.06], C.furD)
      .box([0, 0.75, 1.42], [0.35, 0.25, 0.06], C.furD).box([0, 0.4, 1.4], [0.7, 0.18, 0.06], C.redD).pair([0.85, 0.75, 1.4], [0.35, 0.2, 0.04], C.red)
      .pair([1.0, 2.9, -0.1], [0.8, 1.2, 0.5], C.fur).pair([1.0, 2.8, 0.05], [0.4, 0.7, 0.4], C.cream)
      .box([0, 2.3, 0.1], [3.1, 0.5, 2.7], C.leather).box([0, 2.2, 1.2], [2.6, 0.6, 0.5], C.leatherD)
      .pair([0.65, 2.2, 1.46], [0.8, 0.6, 0.12], C.lens, { mat: star >= 3 ? "glow" : "solid" }).box([0, 2.85, -0.7], [0.8, 0.9, 1.0], C.furD).box([0.3, 2.4, -1.6], [0.6, 1.0, 0.6], C.furD);
    const lids = k.part("lids", head, [0, 1.55, 1.36]);
    lids.pair([0.6, -0.3, 0], [0.65, 0.65, 0.06], C.fur);
    const arms: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.3, 1.9, 0]);
      part.box([side * 0.2, -0.8, 0], [0.7, 1.6, 0.7], C.fur).box([side * 0.2, -1.15, 0], [0.75, 0.35, 0.75], C.gold).box([side * 0.2, -1.75, 0.1], [0.7, 0.6, 0.7], C.leatherD);
      return { part, side };
    });
    const blades = arms.map((a) => {
      const b = k.part(a.side > 0 ? "bladeR" : "bladeL", a.part, [a.side * 0.2, -1.75, 0.3]);
      b.box([0, 0, 0.2], [0.35, 0.35, 0.7], C.leatherD).box([0, 0, 0.6], [0.9, 0.25, 0.2], C.gold)
        .box([0, 0.25, 1.9], [0.18, 0.6, 2.4], C.blade, { mat: "glow", rot: [-0.25, 0, 0] }).box([0, 0.8, 3.1], [0.18, 0.45, 0.8], C.blade, { mat: "glow", rot: [-0.7, 0, 0] });
      if (star >= 3) b.box([0, 0.55, 1.9], [0.1, 0.15, 2.3], C.bladeL, { mat: "glow", rot: [-0.25, 0, 0] });
      return b;
    });
    return { hips, torso, head, lids, scarf, tail, arms, legs, blades };
  },

  pose(r, c) {
    const { hips, torso, head, lids, scarf, tail, arms, legs, blades } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    const armsTo = (x: number, out = 0) => { for (const a of arms) { a.part.group.rotation.x = x; a.part.group.rotation.z = a.side * out; } };
    tail.group.rotation.z = Math.sin(T * 1.6) * 0.12;
    tail.group.rotation.x = Math.sin(T * 1.2) * 0.06;
    scarf.group.rotation.x = -Math.sin(T * 2.4) * 0.1;
    armsTo(-0.4, 0.15);

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [guard, shuffle, lock] = beats(T, c.sig, 0xf3e7);
          hips.group.position.y += Math.abs(Math.sin(T * 4)) * 0.15 * shuffle;
          hips.group.position.x += Math.sin(T * 2) * 0.3 * shuffle;
          torso.group.rotation.x = 0.12 * guard + 0.08 * lock;
          armsTo(-0.4 - 0.5 * guard - 0.3 * lock, 0.15 + 0.3 * guard);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * (1 - lock);
          lid = Math.max(lid, 0.35 * lock);
        } else {
          // stand (0–.35) → twirl both blades (.35–.7) → alert stance (.7–1).
          const ph = c.p % 1;
          const twirl = win(ph, 0.35, 0.7, 0.05), alert = win(ph, 0.68, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          for (const [i, b] of blades.entries()) b.group.rotation.x = c.t * 10 * twirl * (i ? -1 : 1);
          armsTo(-0.4 - 0.3 * twirl - 0.5 * alert, 0.15 + 0.35 * alert);
          hips.group.position.y += -0.2 * alert;
          head.group.rotation.z = Math.sin(T * 0.8) * 0.08;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (10 + 5 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.2 + 0.2 * g;
        armsTo(0.4 * g, 0.25);
        scarf.group.rotation.x = -0.3 * g + Math.sin(w * 2) * 0.1;
        tail.group.rotation.x = -0.2 * g;
        break;
      }
      case "attack": {
        // ready (0–.4) → cross slash (impact .55) → blade spin.
        const p = c.p;
        const ready = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const slash = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.75, 1));
        armsTo(-0.4 - 1.2 * ready + 0.9 * slash, 0.15 + 0.6 * ready - 0.4 * slash);
        torso.group.rotation.x = -0.1 * ready + 0.25 * slash;
        hips.group.position.z += 0.7 * slash;
        torso.group.rotation.y = Math.sin(clamp01((p - 0.6) / 0.4) * Math.PI) * 0.6;
        break;
      }
      case "skill": {
        // burst (0–.2) → dash cut (.15–.4) → spinning slashes (.35–.58) → behind strike (impact .62) → finisher.
        const p = c.p;
        const burst = win(p, 0, 0.22, 0.05), dash = win(p, 0.15, 0.42, 0.05), spin = win(p, 0.35, 0.6, 0.04);
        const strike = win(p, 0.56, 0.75, 0.03), finish = win(p, 0.75, 1, 0.06);
        hips.group.position.y += 0.5 * strike;
        torso.group.position.y += -0.2 * burst;
        hips.group.position.z += 2.4 * dash + 1.2 * spin;
        torso.group.rotation.y = clamp01((p - 0.35) / 0.25) * Math.PI * 2 * spin + Math.PI * 0.15 * finish;
        torso.group.rotation.x = 0.35 * dash + 0.3 * strike;
        armsTo(-0.4 - 1.3 * strike + 0.6 * dash, 0.15 + 1.0 * spin + 0.4 * finish);
        stride(p * 30, 0.5 * dash);
        lid = Math.max(lid, 0.3 * burst);
        break;
      }
      case "hit": {
        const p = c.p;
        const k = ramp(p, 0, 0.12) * (1 - ramp(p, 0.45, 0.88));
        const shake = (1 - ramp(p, 0, 0.24)) * Math.sin(c.t * 70);
        hips.group.position.z += -0.6 * k;
        torso.group.rotation.x = -0.25 * k;
        torso.group.rotation.z = shake * 0.06;
        head.group.rotation.x = -0.2 * k;
        lid = Math.max(lid, 0.85 * k + (p < 0.08 ? 1 : 0));
        break;
      }
    }
    lids.group.scale.y = 0.05 + 0.95 * clamp01(lid);
  },

  death: {
    // Ngã xuống (0–.4) → gục: lies on its back (.3–.6) → tan biến trong khói đỏ (.7–1, shrink-out).
    seconds: 1.2,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, scarf, legs, arms } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.2, 0.55);
      hips.group.position.y += -1.5 * fall + bell(p, 0.4, 0.5) * 0.15;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      torso.group.rotation.x = -1.2 * lie;
      scarf.group.rotation.x = 1.2 * lie;
      for (const a of arms) a.part.group.rotation.z = a.side * 0.6 * lie;
      head.group.rotation.x = 0.3 * lie;
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.25, 0.45), bell(p, 0, 0.08));
    },
  },
});
