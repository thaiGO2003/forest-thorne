// Sao La Làng (catalog id worm_ice, kept for save compatibility) — bespoke rig from the "Sao La Làng"
// sheet. Upright saola spirit mage: brown-and-white face with blue glowing eyes, long ice-blue curved
// horns, a white fur collar, a violet cape and robe with snowflake marks and gold trim, a blue chest gem
// and a gold halo of ice crystals floating beside its raised hand.
// Idle: stand still → cold breath → frost aura · Combat idle: watch the target / chant / hold the ward ·
// Move: step → run → ice glide · Attack: aim the spell → ice shard (impact) → frost burst · Skill:
// gather cold → call ice pillars → freeze the target (impact) → slow → shatter · Hit: struck → slide
// back → steady · Death: falls → freezes over → melts into mist. 2★ fuller fur collar + more halo
// crystals; 3★ glowing horns, ice-flame cape edge.
import type { Part } from "../kit";
import { bell, defineUnit, ramp, type DeathCtx } from "../rig";
import { beats, blinkAt, clamp01, win } from "./beats";

const C = {
  fur: 0x8a5a3a, furD: 0x5e3a24, white: 0xf4f4fa, eye: 0x6ae0ff, pupil: 0x0a2040, horn: 0x8ac8f0, hornD: 0x4a7ab0,
  robe: 0x5a4ab0, robeD: 0x3a2a80, gold: 0xe8c050, gem: 0x5ad8ff, ice: 0xbff0ff, hoof: 0x3a2a24,
};
const HIP_Y = 2.8;

interface Limb { part: Part; side: 1 | -1 }
interface Parts { hips: Part; torso: Part; head: Part; lids: Part; cape: Part; armR: Part; armL: Part; halo: Part; legs: Limb[] }

export default defineUnit<Parts>({
  id: "worm_ice",
  motion: "ground",
  height: 13,
  durations: { idle: 4.5, attack: 0.9, skill: 1.8, hit: 0.5, move: 0.65 },
  impact: { attack: 0.55, skill: 0.6 },
  blend: 0.1,

  build(k, { star }) {
    const hips = k.part("hips", null, [0, HIP_Y, 0]);
    hips.box([0, 0, 0], [2.0, 0.9, 1.4], C.robeD).box([0, -0.6, 0.3], [2.2, 1.0, 1.0], C.robe).box([0, -0.6, 0.82], [0.5, 0.5, 0.06], C.white);
    const legs: Limb[] = ([1, -1] as const).map((side) => {
      const part = k.part(side > 0 ? "legR" : "legL", hips, [side * 0.6, -0.2, 0]);
      part.box([0, -0.9, 0], [0.7, 1.6, 0.7], C.fur).box([0, -1.6, 0], [0.75, 0.4, 0.75], C.white).box([0, -2.15, 0.1], [0.75, 0.6, 0.9], C.hoof);
      return { part, side };
    });
    const torso = k.part("torso", hips, [0, 0.4, 0]);
    torso.box([0, 1.2, 0], [2.2, 2.4, 1.5], C.robe).box([0, 1.2, 0.76], [0.6, 2.2, 0.06], C.gold).box([0, 1.5, 0.8], [0.5, 0.6, 0.08], C.gem, { mat: "glow" })
      .box([0, 2.4, 0], [2.8, 0.7, 2.0], C.white).pair([0.7, 0.7, 0.78], [0.35, 0.35, 0.04], C.ice);
    if (star >= 2) torso.box([0, 2.6, -0.1], [3.2, 0.6, 2.2], C.white);
    const cape = k.part("cape", torso, [0, 2.4, -0.8]);
    cape.box([0, -2.2, -0.2], [3.2, 4.4, 0.25], C.robe).box([0, -2.2, -0.05], [2.6, 4.0, 0.08], C.robeD).box([0, -2.0, -0.36], [1.0, 1.0, 0.06], C.white)
      .box([0, -4.3, -0.2], [3.3, 0.25, 0.3], C.gold);
    if (star >= 3) cape.pair([1.62, -2.2, -0.2], [0.2, 4.4, 0.3], C.ice, { mat: "glow" });
    const head = k.part("head", torso, [0, 2.8, 0.2]);
    head.box([0, 1.0, 0], [2.0, 2.0, 2.0], C.fur).box([0, 0.5, 1.2], [1.2, 1.0, 0.8], C.white).box([0, 0.75, 1.62], [0.4, 0.25, 0.06], C.pupil)
      .box([0, 1.5, 1.02], [0.5, 1.0, 0.06], C.white).pair([0.6, 1.25, 1.02], [0.45, 0.35, 0.06], C.eye, { mat: "glow" }).pair([0.6, 1.25, 1.06], [0.18, 0.25, 0.04], C.pupil)
      .pair([1.3, 1.5, -0.2], [0.9, 0.4, 0.5], C.fur, { rot: [0, 0, -0.4] }).box([0, 2.1, 0.1], [2.1, 0.3, 2.1], C.gold);
    const hornMat = star >= 3 ? "glow" : "solid";
    head.pair([0.5, 2.8, -0.4], [0.4, 1.6, 0.4], C.horn, { mat: hornMat, rot: [-0.4, 0, -0.1] }).pair([0.6, 3.6, -1.3], [0.35, 1.4, 0.35], C.horn, { mat: hornMat, rot: [-1.0, 0, -0.1] })
      .pair([0.65, 3.6, -2.3], [0.3, 0.9, 0.3], C.hornD, { rot: [-1.6, 0, 0] });
    const lids = k.part("lids", head, [0, 1.45, 1.04]);
    lids.pair([0.6, -0.2, 0], [0.5, 0.4, 0.06], C.fur);
    const arm = (side: 1 | -1) => {
      const p = k.part(side > 0 ? "armR" : "armL", torso, [side * 1.3, 2.0, 0]);
      p.box([side * 0.15, -0.8, 0], [0.65, 1.6, 0.65], C.robe).box([side * 0.15, -1.2, 0], [0.75, 0.3, 0.75], C.gold).box([side * 0.15, -1.8, 0.1], [0.55, 0.6, 0.55], C.fur);
      return p;
    };
    const armR = arm(1), armL = arm(-1);
    const halo = k.part("halo", armR, [0.6, -1.4, 1.2]);
    const n = star >= 2 ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      halo.box([Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0], [0.22, 0.22, 0.22], C.gold);
    }
    halo.box([0, 0, 0], [0.5, 0.9, 0.5], C.ice, { mat: "glow", rot: [0, 0.6, 0] });
    return { hips, torso, head, lids, cape, armR, armL, halo, legs };
  },

  pose(r, c) {
    const { hips, torso, head, lids, cape, armR, armL, halo, legs } = r;
    const T = c.time;
    let lid = blinkAt(T, c.sig);
    const stride = (w: number, amp: number) => { for (const l of legs) l.part.group.rotation.x = Math.sin(w + (l.side > 0 ? 0 : Math.PI)) * amp; };
    halo.group.rotation.z = T * 1.2;
    halo.group.position.y += Math.sin(T * 2) * 0.1;
    cape.group.rotation.x = -Math.abs(Math.sin(T * 1.5)) * 0.06;
    armR.group.rotation.x = -0.6;

    switch (c.state) {
      case "idle": {
        if (c.combat) {
          const [watch, chant, ward] = beats(T, c.sig, 0x5a1a);
          head.group.rotation.y = Math.sin(T * 0.9 + c.sig * 3) * 0.3 * watch;
          armL.group.rotation.x = -0.9 * chant;
          lid = Math.max(lid, 0.5 * chant);
          armR.group.rotation.x = -0.6 - 0.6 * ward;
          halo.group.scale.setScalar(1 + 0.3 * ward);
        } else {
          // stand still (0–.35) → cold breath (.35–.65) → frost aura (.65–1).
          const ph = c.p % 1;
          const breath = win(ph, 0.35, 0.65, 0.05), aura = win(ph, 0.65, 1, 0.05);
          torso.group.scale.y = 1 + Math.sin(T * 1.8) * 0.02;
          head.group.rotation.x = -0.15 * breath;
          lid = Math.max(lid, 0.3 * breath);
          halo.group.scale.setScalar(1 + 0.25 * aura);
          cape.group.rotation.x = -0.2 * aura;
        }
        break;
      }
      case "move": {
        const g = c.combat ? 1 : ramp(c.p, 0.8, 1.8);
        const w = T * (9 + 3 * g);
        stride(w, 0.45 * (1 - 0.4 * g));
        hips.group.position.y += Math.abs(Math.sin(w)) * 0.15 + 0.25 * g;
        torso.group.rotation.x = 0.12 + 0.12 * g;
        cape.group.rotation.x = -0.3 - 0.2 * g;
        armL.group.rotation.x = Math.sin(w) * 0.3;
        break;
      }
      case "attack": {
        // aim (0–.4) → ice shard (impact .55) → burst.
        const p = c.p;
        const aim = ramp(p, 0, 0.4) * (1 - ramp(p, 0.75, 1));
        const cast = ramp(p, 0.45, 0.55) * (1 - ramp(p, 0.7, 1));
        armR.group.rotation.x = -0.6 - 0.8 * aim;
        armL.group.rotation.x = -0.5 * aim - 0.6 * cast;
        torso.group.rotation.x = -0.08 * aim + 0.15 * cast;
        halo.group.scale.setScalar(1 + 0.4 * aim - 0.3 * cast);
        lid = Math.max(lid, 0.4 * aim);
        break;
      }
      case "skill": {
        // gather cold (0–.3) → ice pillars (.25–.5) → freeze (impact .6) → slow → shatter (.85–1).
        const p = c.p;
        const gather = win(p, 0, 0.32, 0.06), call = win(p, 0.25, 0.75, 0.05), freeze = win(p, 0.55, 0.8, 0.04), shatter = win(p, 0.82, 1, 0.04);
        armR.group.rotation.x = -0.6 - 1.4 * call;
        armL.group.rotation.x = -1.0 * gather - 1.2 * call;
        armL.group.rotation.z = -0.4 * freeze;
        torso.group.rotation.x = -0.15 * call + 0.15 * shatter;
        hips.group.position.y += 0.3 * freeze;
        halo.group.scale.setScalar(1 + 0.6 * call);
        cape.group.rotation.x = -0.4 * call;
        lid = Math.max(lid, 0.5 * gather);
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
    // Ngã xuống (0–.4) → đóng băng: lies curled on its side (.3–.6) → tan sương (.7–1, shrink-out).
    seconds: 1.3,
    vanishAt: 0.7,
    pose(r: Parts, c: DeathCtx) {
      const { hips, torso, head, lids, legs, armR, halo } = r;
      const p = c.p;
      const fold = ramp(p, 0, 0.3), fall = ramp(p, 0.12, 0.42), lie = ramp(p, 0.25, 0.6);
      hips.group.position.y += -1.0 * fall + bell(p, 0.4, 0.5) * 0.12;
      r.cape.group.rotation.x = 0.9 * fold;
      for (const l of legs) l.part.group.rotation.x = -1.4 * fold;
      armR.group.rotation.x = -1.0;
      torso.group.rotation.z = 0.9 * lie;
      torso.group.position.x += 0.4 * lie;
      head.group.rotation.z = -0.3 * lie;
      halo.group.scale.setScalar(1 - 0.8 * fold);
      lids.group.scale.y = 0.05 + 0.95 * Math.max(ramp(p, 0.2, 0.4), bell(p, 0, 0.08));
    },
  },
});
