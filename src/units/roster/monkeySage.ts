// Sơn Thân (catalog id monkey_spear, kept for save compatibility) — bespoke rig from the "Sơn Thân"
// sheet. Chibi mountain monkey spirit with brown fur, a cream face, amber eyes, a gold circlet with ring
// ornaments, a topknot, red scarf, dark red and black outfit with a gold belt, and a gold Như Ý staff.
// Idle: stand → shoulder bounce → twirl staff · Combat idle: guard / shuffle / spin staff ·
// Move: step → run → dash · Attack: ready → staff sweep (impact) → follow-through combo ·
// Skill: fade → dash through → reappear behind → critical strike (impact) → vanish back ·
// Hit: struck → slide back → steady · Death: falls back → lies down → turns to golden mist.
// 2★ gold pauldrons; 3★ golden flame aura and glowing staff caps.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x8a5a34, furD: 0x5e3a20, face: 0xf2d8b0, eye: 0xf0a020, pupil: 0x201008, red: 0xb02a20, redD: 0x701810,
  black: 0x2a1c1c, gold: 0xf0b830, goldD: 0xb07c18, flame: 0xffc040,
};
const HIP_Y = 2.4;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; scarf: Part; tail: Part; staff: Part; arms: Limb[]; legs: Limb[] }

export default defineUnit<Parts>({
  id: "monkey_spear",
  motion: "ground",
  height: 10,
  durations: { idle: 4.5, attack: 0.8, skill: 1.6, hit: 0.5, move: 0.55 },
  impact: { attack: 0.55, skill: 0.62 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.0, 0.8, 1.4], C.black);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.65, 0, 0]);
      part.box([0, -1.0, 0], [0.9, 1.8, 0.9], C.redD).box([0, -2.05, 0.2], [1.0, 0.5, 1.3], C.black).box([0, -1.6, 0], [0.95, 0.25, 0.95], C.gold);
      return { part, side };
    });
    const tail = k.part("tail", hips, [0, 0.2, -0.8]);
    tail.box([0, 0, -0.6], [0.4, 0.4, 1.2], C.fur).box([0, 0.7, -1.2], [0.4, 1.4, 0.4], C.fur).box([0, 1.4, -0.9], [0.4, 0.4, 0.8], C.furD);
    const torso = k.part("torso", hips, [0, 0.3, 0]);
    torso.box([0, 1.1, 0], [2.2, 2.2, 1.5], C.red).box([0, 1.1, 0.76], [0.8, 2.0, 0.08], C.black)
      .box([0, 0.15, 0], [2.3, 0.35, 1.6], C.gold).box([0, 0.15, 0.82], [0.5, 0.5, 0.08], C.goldD);
    if (star >= 2) torso.pair([1.15, 2.1, 0], [0.8, 0.5, 1.2], C.gold);
    if (star >= 3) for (const [x, y] of [[0, 3.2], [1.4, 2.6], [-1.4, 2.6], [0.8, 3.8], [-0.8, 3.8]] as const) torso.box([x, y, -1.1], [0.6, 0.9, 0.2], C.flame, { mat: "glow" });
    const scarf = k.part("scarf", torso, [0, 2.1, -0.6]);
    scarf.box([0, 0, 0.5], [2.0, 0.45, 0.6], C.red).box([0.3, -0.3, -0.4], [0.9, 0.35, 1.2], C.red).box([0.5, -0.5, -1.2], [0.7, 0.3, 0.8], C.redD);
    const head = k.part("head", torso, [0, 2.3, 0]);
    head.box([0, 1.3, 0], [3.0, 2.6, 2.6], C.fur).box([0, 1.0, 1.32], [2.2, 1.8, 0.1], C.face)
      .pair([0.55, 1.25, 1.38], [0.55, 0.6, 0.06], C.eye).pair([0.55, 1.2, 1.42], [0.25, 0.4, 0.04], C.pupil)
      .pair([0.6, 1.7, 1.4], [0.6, 0.15, 0.06], C.furD).box([0, 0.45, 1.4], [0.7, 0.2, 0.06], C.redD).pair([0.2, 0.45, 1.44], [0.12, 0.2, 0.04], C.face)
      .pair([1.65, 1.2, 0], [0.4, 0.8, 0.7], C.face).box([0, 2.2, 0], [3.1, 0.3, 2.7], C.gold)
      .pair([1.6, 2.0, 0.7], [0.2, 0.7, 0.7], C.gold).box([0, 2.85, -0.5], [0.9, 0.8, 0.9], C.furD).box([0, 2.6, -1.4], [0.5, 0.5, 1.0], C.furD);
    const lids = k.part("lids", head, [0, 1.55, 1.36]);
    lids.pair([0.55, -0.3, 0], [0.6, 0.6, 0.06], C.fur);
    const arms: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.3, 1.9, 0]);
      part.box([side * 0.2, -0.8, 0], [0.7, 1.6, 0.7], C.fur).box([side * 0.2, -1.1, 0], [0.75, 0.3, 0.75], C.gold).box([side * 0.2, -1.75, 0.1], [0.7, 0.6, 0.7], C.face);
      return { part, side };
    });
    const staff = k.part("staff", arms[0]!.part, [0.2, -1.75, 0.3]);
    staff.box([0, 0, 0], [7.6, 0.32, 0.32], C.goldD).box([3.6, 0, 0], [0.8, 0.5, 0.5], C.red).box([-3.6, 0, 0], [0.8, 0.5, 0.5], C.red)
      .box([3.95, 0, 0], [0.3, 0.55, 0.55], C.gold, { mat: star >= 3 ? "glow" : "solid" }).box([-3.95, 0, 0], [0.3, 0.55, 0.55], C.gold, { mat: star >= 3 ? "glow" : "solid" });
    return { hips, torso, head, lids, scarf, tail, staff, arms, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, scarf, tail, staff, arms, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const [armR, armL] = [arms[0]!, arms[1]!];
    const stride = (w: number, amp: number) => {
      for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp;
      armL.part.group.rotation.x = Math.sin(w) * amp * 0.8;
    };
    tail.group.rotation.z = Math.sin(T * 1.6) * 0.2;
    scarf.group.rotation.x = -Math.sin(T * 2.4) * 0.1;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [guard, shuffle, spin] = beats(T, c.sig, 0x5a7c);
          hips.group.position.y += Math.abs(Math.sin(T * 4)) * 0.15 * shuffle;
          hips.group.position.x += Math.sin(T * 2) * 0.3 * shuffle;
          torso.group.rotation.x = 0.1 * guard;
          armR.part.group.rotation.x = -0.6 * guard - 0.3 * spin;
          staff.group.rotation.y = T * 8 * spin + 0.4 * guard;
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.25 * guard;
        } else {
          // stand (0–.35) → shoulder bounce (.35–.65) → twirl staff (.65–1).
          const ph = c.p % 1;
          const bounce = win(ph, 0.35, 0.65, 0.05), twirl = win(ph, 0.65, 1, 0.06);
          hips.group.position.y += Math.abs(Math.sin(T * 6)) * 0.15 * bounce;
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          armR.part.group.rotation.x = -0.4 - 0.4 * twirl;
          staff.group.rotation.y = c.t * 9 * twirl;
          head.group.rotation.z = Math.sin(T * 0.8) * 0.08;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (9 + 5 * g);
        stride(w, 0.45 + 0.15 * g);
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.2;
        torso.group.rotation.x = 0.15 + 0.2 * g;
        armR.part.group.rotation.x = -0.3 - 0.4 * g;
        scarf.group.rotation.x = -0.3 * g + Math.sin(w * 2) * 0.1;
        break;
      }
      case "attack": {
        // ready (0–.4) → sweep (impact .55) → combo follow-through.
        const p = c.p;
        const ready = ramp(p, 0, 0.4) * (1 - ramp(p, 0.45, 0.55));
        const sweep = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.75, 1));
        torso.group.rotation.y = 0.5 * ready - 0.6 * sweep;
        armR.part.group.rotation.x = -1.0 * ready - 0.6 * sweep;
        staff.group.rotation.y = -0.8 * ready + 1.6 * sweep;
        hips.group.position.z += 0.6 * sweep;
        stride(p * 6, 0.3 * sweep);
        break;
      }
      case "skill": {
        // fade (0–.2) → dash through (.15–.4) → behind the target (.35–.55) → crit (impact .62) → vanish back.
        const p = c.p;
        const fade = win(p, 0, 0.25, 0.05), dash = win(p, 0.15, 0.45, 0.05), behind = win(p, 0.4, 0.75, 0.04);
        const crit = win(p, 0.55, 0.72, 0.03), back = win(p, 0.75, 1, 0.06);
        hips.group.scale.setScalar(1 - 0.15 * fade - 0.15 * back);
        hips.group.position.z += 2.5 * dash + 1.5 * behind;
        hips.group.position.y += 0.6 * crit;
        torso.group.rotation.x = 0.3 * dash + 0.25 * crit;
        torso.group.rotation.y = Math.PI * behind;
        armR.part.group.rotation.x = -1.4 * behind + 0.8 * crit;
        staff.group.rotation.z = 0.45 * crit;
        stride(p * 30, 0.5 * dash);
        lid = Math.max(lid, 0.3 * fade);
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
    // Ngã xuống (0–.4) → gục: lies on its back (.3–.6) → tan biến thành ánh vàng (.7–1, shrink-out).
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
